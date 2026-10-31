// `nish/net/handler` over loopback: Nish clients against an `HttpHandler` in
// the same loop. The handler's turn runs between each client write and read.
//
//   1. Routing: a text route, a parameter and a decoded query as JSON, HEAD on
//      a GET route, 404 and 405 (with its `Allow`) as problem+json, a body
//      echoed, a chunked response streamed in pieces, a 204.
//   2. Limits: a declared body over the cap is answered 413 and the
//      connection ends; a body at the cap is taken whole.
//   3. Pipelining: three requests in one write are answered in order.
//   4. The late answer: a request held while its peer leaves answers
//      HANDLER_DROPPED, also once a new connection has taken its slot, and the
//      new connection is answered as if nothing happened.
//   5. The flat arena: a warm connection serves two thousand requests with
//      `Arena.used()` unchanged and no request made past the pool.
//   6. The drain: an idle connection closes at once, no new one is accepted,
//      and a held request is still answered before its connection closes,
//      with `Connection: close` and no pipelined request read behind it.
import { copyBytes } from "nish/bytes"
import { JsonWriter } from "nish/json"
import { HTTP1_CHUNKED } from "nish/net/http1"
import {
  HANDLER_ABSENT,
  HANDLER_DROPPED,
  HANDLER_SENT,
  HandlerLimits,
  HttpHandler,
  HttpRequest,
} from "nish/net/handler"
import { ROUTER_BAD_ESCAPE, Router, RouterLimits } from "nish/net/router"
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollRemove,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

// The routes, in the order they are added.
const HOME: i32 = 0
const USER: i32 = 1
const ECHO: i32 = 2
const SLOW: i32 = 3
const STREAM: i32 = 4
const REMOVE: i32 = 5
const PROBLEM: i32 = 6

const CAP: i32 = 65536
const FIVE_SECONDS: i64 = 5000000000

/** The server half: the handler, and the requests it holds unanswered on purpose. */
class App {
  h: HttpHandler
  held: HttpRequest[]
  heldCount: i32 = 0
  text: u8[]
  hello: u8[]
  octets: u8[]
  name: u8[]
  streamNames: u8[][]
  streamValues: u8[][]
  pieces: u8[][]
  port: i32 = 0
  failures: i32 = 0

  constructor(idleMs: i32) {
    const router = new Router(new RouterLimits())
    router.add("GET", "/")
    router.add("GET", "/users/:id")
    router.add("POST", "/echo")
    router.add("GET", "/slow")
    router.add("GET", "/stream")
    router.add("DELETE", "/users/:id")
    router.add("GET", "/problem")
    const limits = new HandlerLimits()
    limits.slots = 8
    limits.http.maxBody = CAP
    limits.http.idleTimeout = idleMs
    const listener: i32 = tcpListen("127.0.0.1", 0, 64)
    this.port = netLocalPort(listener)
    this.h = new HttpHandler(limits, listener, router)
    this.held = []
    this.text = ascii("text/plain")
    this.hello = ascii("hello")
    this.octets = ascii("application/octet-stream")
    this.name = new Array<u8>(64)
    this.streamNames = [ascii("content-type")]
    this.streamValues = [ascii("text/plain")]
    this.pieces = [ascii("one,"), ascii("two,"), ascii("three")]
  }

  /** One turn of the handler, then every whole request answered (or held, for `/slow`). */
  turn(): void {
    this.h.wait(toI32(1))
    while (this.h.ready()) {
      this.answer(this.h.take())
    }
  }

  answer(req: HttpRequest): void {
    const h: HttpHandler = this.h
    switch (req.route) {
      case HOME:
        h.send(req, 200, this.text, this.hello, ZERO, toI32(this.hello.length))
        break
      case USER: {
        const id: i32 = req.paramDecimal(ZERO)
        const n: i32 = req.query("name", this.name)
        if (id < 0 || n === ROUTER_BAD_ESCAPE) {
          h.problem(req, 400, "Bad Request", "the id is a number and the name a well-formed query value")
          break
        }
        const w: JsonWriter = h.json()
        w.beginObject()
        w.key("id")
        w.i32(id)
        if (n !== HANDLER_ABSENT) {
          w.key("name")
          w.stringBytes(this.name, ZERO, n)
        }
        w.endObject()
        h.sendJson(req, 200)
        break
      }
      case ECHO:
        h.send(req, 200, this.octets, req.body, ZERO, req.bodyLength)
        break
      case SLOW:
        if (this.heldCount < toI32(this.held.length)) {
          this.held[this.heldCount] = req
        } else {
          this.held.push(req)
        }
        this.heldCount += 1
        break
      case STREAM:
        h.start(req, 200, this.streamNames, this.streamValues, HTTP1_CHUNKED)
        for (let k: i32 = 0; k < toI32(this.pieces.length); k++) {
          h.write(req, this.pieces[k], ZERO, toI32(this.pieces[k].length))
        }
        h.end(req)
        break
      case REMOVE:
        h.empty(req, 204)
        break
      case PROBLEM: {
        // A detail twice the JSON buffer: the problem goes without it.
        let detail: string = "x"
        for (let k: i32 = 0; k < 17; k++) {
          detail = detail + detail
        }
        h.problem(req, 418, "I'm a teapot", detail)
        break
      }
      default:
        h.refuse(req)
    }
  }
}

/** A client: its socket and what it has read and not yet consumed. */
class Client {
  fd: i32 = -1
  buf: u8[]
  length: i32 = 0
  /** The last response read: its status, where its body starts and how long it is. */
  status: i32 = 0
  bodyStart: i32 = 0
  bodyLength: i32 = 0
  responseLength: i32 = 0
  closed: boolean = false

  constructor() {
    this.buf = new Array<u8>(262144)
  }
}

const lower = (c: i32): i32 => (c >= 65 && c <= 90 ? c + 32 : c)

/** Whether `buf[at ..)` starts with `text`, letters compared without case. */
const startsWith = (buf: u8[], at: i32, end: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (at < 0 || at + n > end || end > toI32(buf.length)) {
    return false
  }
  for (let k: i32 = 0; k < n; k++) {
    if (lower(toI32(buf[at + k])) !== lower(toI32(text.charCodeAt(k)))) {
      return false
    }
  }
  return true
}

/** Where `text` first appears in `buf[from .. end)`, or -1. */
const find = (buf: u8[], from: i32, end: i32, text: string): i32 => {
  for (let at: i32 = from; at + toI32(text.length) <= end; at++) {
    if (startsWith(buf, at, end, text)) {
      return at
    }
  }
  return -1
}

/** The value of header `name` (with its `: `) in the head `buf[0 .. headEnd)` as a decimal, or -1. */
const headerNumber = (buf: u8[], headEnd: i32, name: string): i32 => {
  const at: i32 = find(buf, ZERO, headEnd, name)
  if (at < 0) {
    return -1
  }
  let n: i32 = 0
  let k: i32 = at + toI32(name.length)
  while (k >= 0 && k < headEnd && k < toI32(buf.length) && toI32(buf[k]) >= 48 && toI32(buf[k]) <= 57) {
    n = n * 10 + toI32(buf[k]) - 48
    k += 1
  }
  return n
}

const connect = (app: App): Client => {
  const c = new Client()
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", app.port)
  c.fd = tcpConnect(addr)
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)
  pollAdd(loop, c.fd, 2, ZERO)
  if (pollWait(loop, ready, 5000) !== 1 || connectResult(c.fd) !== 0) {
    panic("connect failed")
  }
  pollRemove(loop, c.fd)
  netClose(loop)
  return c
}

/** Sends all of `bytes`, turning the handler while the socket is full. */
const sendAll = (app: App, c: Client, bytes: u8[], off: i32, len: i32): void => {
  let at: i32 = off
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (at < off + len && monotonicNanos() < deadline) {
    const n: i32 = netWrite(c.fd, bytes, at, off + len - at)
    if (n > 0) {
      at += n
    } else {
      app.turn()
    }
  }
}

const send = (app: App, c: Client, text: string): void => {
  const bytes: u8[] = ascii(text)
  sendAll(app, c, bytes, ZERO, toI32(bytes.length))
}

/** Reads what has arrived; false once the peer has closed. */
const pull = (c: Client): boolean => {
  const room: i32 = toI32(c.buf.length) - c.length
  if (room <= 0) {
    return true
  }
  const n: i32 = netRead(c.fd, c.buf, c.length, room)
  if (n > 0) {
    c.length += n
  } else if (n === 0) {
    c.closed = true
  }
  return n !== 0
}

/** Drops the response before the one just read from `c.buf`. */
const consume = (c: Client): void => {
  const used: i32 = c.responseLength
  if (used > 0) {
    copyBytes(c.buf, ZERO, c.buf, used, c.length - used)
    c.length -= used
    c.responseLength = 0
  }
}

/**
 * Reads one response, turning the handler until it is whole: true with its
 * status and body in `c`, or false after five seconds or the peer's close.
 * `head` says it answers a HEAD, so its length is not followed by a body.
 */
const response = (app: App, c: Client, head: boolean): boolean => {
  consume(c)
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline) {
    const headEnd: i32 = find(c.buf, ZERO, c.length, "\r\n\r\n")
    if (headEnd > 0) {
      const bodyStart: i32 = headEnd + 4
      c.status = headerNumber(c.buf, headEnd, "HTTP/1.1 ")
      c.bodyStart = bodyStart
      const length: i32 = head ? 0 : headerNumber(c.buf, headEnd, "\r\ncontent-length: ")
      if (length >= 0) {
        if (c.length - bodyStart >= length) {
          c.bodyLength = length
          c.responseLength = bodyStart + length
          return true
        }
      } else {
        const last: i32 = find(c.buf, bodyStart, c.length, "0\r\n\r\n")
        if (last >= 0) {
          c.bodyLength = last + 5 - bodyStart
          c.responseLength = last + 5
          return true
        }
      }
    }
    if (c.closed) {
      return false
    }
    app.turn()
    pull(c)
  }
  return false
}

/** Whether the last response's body is exactly `text`. */
const bodyIs = (c: Client, text: string): boolean =>
  c.bodyLength === toI32(text.length) && startsWith(c.buf, c.bodyStart, c.bodyStart + c.bodyLength, text)

/** Whether the last response's head holds `text`. */
const headHas = (c: Client, text: string): boolean => find(c.buf, ZERO, c.bodyStart, text) >= 0

/** Turns the handler until the peer closes `c`, for five seconds at most. */
const awaitClose = (app: App, c: Client): boolean => {
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (!c.closed && monotonicNanos() < deadline) {
    app.turn()
    pull(c)
  }
  return c.closed
}

/** Turns the handler until it holds `n` connections, for five seconds at most. */
const awaitConnections = (app: App, n: i32): boolean => {
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (app.h.connections() !== n && monotonicNanos() < deadline) {
    app.turn()
  }
  return app.h.connections() === n
}

/** Turns the handler until it holds `n` requests on purpose. */
const awaitHeld = (app: App, n: i32): boolean => {
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (app.heldCount < n && monotonicNanos() < deadline) {
    app.turn()
  }
  return app.heldCount >= n
}

const check = (app: App, name: string, ok: boolean): void => {
  if (ok) {
    console.log(`PASS  ${name}`)
  } else {
    console.log(`FAIL  ${name}`)
    app.failures += 1
  }
}

const routing = (app: App): void => {
  const c = connect(app)
  send(app, c, "GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a GET of a text route is answered 200 with its body", response(app, c, false) && c.status === 200 && bodyIs(c, "hello"))
  check(app, "and its content type", headHas(c, "\r\ncontent-type: text/plain\r\n"))

  send(app, c, "GET /users/42?x=1&name=a%20b+c HTTP/1.1\r\nHost: t\r\n\r\n")
  check(
    app, "a parameter and a form-decoded query come back as JSON",
    response(app, c, false) && c.status === 200 && bodyIs(c, "{\"id\":42,\"name\":\"a b c\"}")
  )
  check(app, "as application/json", headHas(c, "\r\ncontent-type: application/json\r\n"))

  send(app, c, "GET /users/7 HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a query without the name leaves it out", response(app, c, false) && bodyIs(c, "{\"id\":7}"))

  send(app, c, "GET /users/7?name=a%00b HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a %00 in the query decodes to a NUL byte, as in a parameter", response(app, c, false) && bodyIs(c, "{\"id\":7,\"name\":\"a\\u0000b\"}"))

  send(app, c, "GET /users/7?name=%zz HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a malformed escape in the query is the program's 400", response(app, c, false) && c.status === 400)

  send(app, c, "HEAD / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "HEAD takes the GET route and is answered with its length and no body", response(app, c, true) && c.status === 200 && headHas(c, "\r\ncontent-length: 5\r\n"))

  send(app, c, "GET /nowhere HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "an unknown path is 404", response(app, c, false) && c.status === 404)
  check(app, "as an RFC 9457 problem", headHas(c, "\r\ncontent-type: application/problem+json\r\n") && bodyIs(c, "{\"type\":\"about:blank\",\"title\":\"Not Found\",\"status\":404}"))

  send(app, c, "PUT /users/3 HTTP/1.1\r\nHost: t\r\nContent-Length: 0\r\n\r\n")
  check(app, "a method the path does not take is 405", response(app, c, false) && c.status === 405)
  check(app, "with an Allow naming GET and DELETE, and HEAD for the GET", headHas(c, "\r\nallow: GET, DELETE, HEAD\r\n"))
  send(app, c, "PATCH /users/3 HTTP/1.1\r\nHost: t\r\nContent-Length: 0\r\n\r\n")
  check(app, "and a second one reuses the Allow value made for the first", response(app, c, false) && c.status === 405 && headHas(c, "DELETE"))

  send(app, c, "GET /problem HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a problem too large for the JSON buffer is sent without its detail", response(app, c, false) && c.status === 418 && bodyIs(c, "{\"type\":\"about:blank\",\"title\":\"I'm a teapot\",\"status\":418}"))

  send(app, c, "GET /users/%zz HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a parameter that is not a number is the program's 400", response(app, c, false) && c.status === 400)

  send(app, c, "POST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: 11\r\n\r\nhello world")
  check(app, "a body is echoed", response(app, c, false) && c.status === 200 && bodyIs(c, "hello world"))

  send(app, c, "POST /echo HTTP/1.1\r\nHost: t\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n4\r\ndefg\r\n0\r\n\r\n")
  check(app, "a chunked body is gathered whole", response(app, c, false) && bodyIs(c, "abcdefg"))

  send(app, c, "GET /stream HTTP/1.1\r\nHost: t\r\n\r\n")
  check(
    app, "a response written in three pieces arrives chunked",
    response(app, c, false) && c.status === 200 && headHas(c, "transfer-encoding: chunked") && bodyIs(c, "4\r\none,\r\n4\r\ntwo,\r\n5\r\nthree\r\n0\r\n\r\n")
  )

  send(app, c, "DELETE /users/9 HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "an empty answer is a 204 with no body", response(app, c, true) && c.status === 204 && c.bodyLength === 0)
  netClose(c.fd)
  check(app, "the client's close is seen", awaitConnections(app, toI32(0)))
}

const limits = (app: App): void => {
  const c = connect(app)
  send(app, c, `POST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: ${CAP + 1}\r\n\r\n`)
  check(app, "a declared body one byte over the cap is answered 413", response(app, c, false) && c.status === 413)
  check(app, "and the connection ends", awaitClose(app, c))
  netClose(c.fd)

  const d = connect(app)
  const body: u8[] = new Array<u8>(CAP)
  for (let k: i32 = 0; k < toI32(body.length); k++) {
    body[k] = toU8(97 + (k % 26))
  }
  send(app, d, `POST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: ${CAP}\r\n\r\n`)
  sendAll(app, d, body, ZERO, CAP)
  let same: boolean = response(app, d, false) && d.status === 200 && d.bodyLength === CAP
  for (let k: i32 = 0; same && k < toI32(body.length); k++) {
    same = d.buf[d.bodyStart + k] === body[k]
  }
  check(app, "a body exactly at the cap is taken whole and echoed byte for byte", same)
  netClose(d.fd)
  check(app, "both clients are gone", awaitConnections(app, toI32(0)))
}

const pipelining = (app: App): void => {
  const c = connect(app)
  send(app, c, "GET /users/1 HTTP/1.1\r\nHost: t\r\n\r\nPOST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: 3\r\n\r\nabcGET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "the first of three pipelined requests is answered first", response(app, c, false) && bodyIs(c, "{\"id\":1}"))
  check(app, "then the second", response(app, c, false) && bodyIs(c, "abc"))
  check(app, "then the third", response(app, c, false) && bodyIs(c, "hello"))
  netClose(c.fd)
  check(app, "the pipelining client is gone", awaitConnections(app, toI32(0)))
}

const lateAnswer = (app: App): void => {
  const pooled: i32 = app.h.pooled()
  const c = connect(app)
  send(app, c, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a request the program holds is taken", awaitHeld(app, toI32(1)))
  netClose(c.fd)
  check(app, "its peer leaves, and the idle timeout ends the connection before the answer", awaitConnections(app, toI32(0)))
  const r: HttpRequest = app.held[0]
  check(app, "the late answer is dropped", app.h.send(r, 200, app.text, app.hello, ZERO, toI32(app.hello.length)) === HANDLER_DROPPED)

  const d = connect(app)
  send(app, d, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a second request is held", awaitHeld(app, toI32(2)))
  netClose(d.fd)
  check(app, "and its peer leaves and times out too", awaitConnections(app, toI32(0)))
  const e = connect(app)
  send(app, e, "GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a new connection on the freed slot is answered", response(app, e, false) && bodyIs(e, "hello"))
  const s: HttpRequest = app.held[1]
  check(app, "an answer for the old connection is dropped though the slot is in use again", app.h.problem(s, 503, "Service Unavailable", "") === HANDLER_DROPPED)
  send(app, e, "GET /users/5 HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "and the new connection never sees it", response(app, e, false) && e.status === 200 && bodyIs(e, "{\"id\":5}"))
  check(app, "the dropped requests went back to the pool", app.h.pooled() <= pooled + 2)
  app.heldCount = 0
  netClose(e.fd)
  check(app, "the last client is gone", awaitConnections(app, toI32(0)))
}

const flat = (app: App): void => {
  const c = connect(app)
  const request: u8[] = ascii("GET /users/12?name=flat HTTP/1.1\r\nHost: t\r\n\r\nPOST /echo HTTP/1.1\r\nHost: t\r\nContent-Length: 4\r\n\r\nflat")
  let good: i32 = 0
  for (let round: i32 = 0; round < 100; round++) {
    sendAll(app, c, request, ZERO, toI32(request.length))
    if (response(app, c, false) && response(app, c, false)) {
      good += 1
    }
  }
  const pooled: i32 = app.h.pooled()
  const before: i64 = Arena.used()
  for (let round: i32 = 0; round < 1000; round++) {
    sendAll(app, c, request, ZERO, toI32(request.length))
    if (response(app, c, false) && c.status === 200 && response(app, c, false) && c.bodyLength === 4) {
      good += 1
    }
  }
  const kept: i64 = Arena.used() - before
  check(app, "a warm connection answers two thousand more requests, two pipelined at a time", good === 1100)
  check(app, "and the arena stays flat", kept === toI64(0))
  check(app, "and the pool makes no request past its warm size", app.h.pooled() === pooled)
  netClose(c.fd)
  check(app, "the warm client is gone", awaitConnections(app, toI32(0)))
}

const draining = (app: App): void => {
  const idle = connect(app)
  send(app, idle, "GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "before the drain a keep-alive client is answered", response(app, idle, false) && bodyIs(idle, "hello"))
  const busy = connect(app)
  send(app, busy, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "and a request the program holds is taken", awaitHeld(app, toI32(1)))
  app.h.drain()
  check(app, "a drain closes the idle connection at once", awaitClose(app, idle))
  check(app, "and keeps the busy one", app.h.connections() === 1)
  const late = connect(app)
  app.turn()
  check(app, "a draining handler accepts no new connection", app.h.connections() === 1)
  const r: HttpRequest = app.held[0]
  app.heldCount = 0
  check(app, "the held request is still answered", app.h.send(r, 200, app.text, app.hello, ZERO, toI32(app.hello.length)) === HANDLER_SENT)
  check(app, "and its client reads the answer", response(app, busy, false) && bodyIs(busy, "hello"))
  check(app, "then that connection closes too", awaitClose(app, busy))
  check(app, "and none are left", app.h.connections() === 0)
  netClose(idle.fd)
  netClose(busy.fd)
  netClose(late.fd)
}

const drainingPipelined = (app: App): void => {
  const c = connect(app)
  send(app, c, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\nGET / HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a held request with another pipelined behind it is taken", awaitHeld(app, toI32(1)))
  app.h.drain()
  const r: HttpRequest = app.held[0]
  app.heldCount = 0
  app.h.send(r, 200, app.text, app.hello, ZERO, toI32(app.hello.length))
  check(app, "a draining connection's answer says it closes", response(app, c, false) && headHas(c, "\r\nConnection: close\r\n"))
  check(app, "and the pipelined request is not read: the connection closes", awaitClose(app, c) && c.length === c.responseLength)
  check(app, "and none are left", app.h.connections() === 0)
  netClose(c.fd)
}

export const main = (): i32 => {
  const app = new App(toI32(60000))
  check(app, "the handler answers its codes as named", HANDLER_SENT === 0 && HANDLER_DROPPED < 0 && HANDLER_ABSENT < 0)
  routing(app)
  limits(app)
  pipelining(app)
  // A peer that closes may only have half-closed and still be waiting for
  // its answer, so a held request's connection ends at the idle timeout:
  // a short one here.
  lateAnswer(new App(toI32(300)))
  flat(app)
  draining(new App(toI32(60000)))
  drainingPipelined(new App(toI32(60000)))
  return app.failures === 0 ? 0 : 1
}
