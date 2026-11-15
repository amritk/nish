// The server and client halves `main.ts` and `deep.ts` share: an `App` that
// answers the routes (or holds `/slow`), a non-blocking loopback `Client`,
// the reads and waits between them, and the deep pipeline `deep.ts` runs
// alone under a small stack.
import { copyBytes } from "nish/bytes"
import { JsonWriter } from "nish/json"
import { HTTP1_CHUNKED } from "nish/net/http1-codec"
import { HANDLER_ABSENT, HANDLER_DROPPED, HANDLER_SENT } from "nish/net/handler"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
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
export const HOME: i32 = 0
export const USER: i32 = 1
export const ECHO: i32 = 2
export const SLOW: i32 = 3
export const STREAM: i32 = 4
export const REMOVE: i32 = 5
export const PROBLEM: i32 = 6
export const BIG: i32 = 7
export const HOLD: i32 = 8

export const CAP: i32 = 65536
export const FIVE_SECONDS: i64 = 5000000000
export const MILLISECOND: i64 = 1000000
/** The body of `GET /big`, and how many of it a peer pipelines and does not read. */
export const BIG_LENGTH: i32 = 200000
export const BIG_COUNT: i32 = 128

/** The server half: the handler, and the requests it holds unanswered on purpose. */
export class App {
  h: HttpServer
  held: HttpServerRequest[]
  heldCount: i32 = 0
  text: u8[]
  hello: u8[]
  octets: u8[]
  name: u8[]
  streamNames: u8[][]
  streamValues: u8[][]
  pieces: u8[][]
  big: u8[]
  port: i32 = 0
  failures: i32 = 0
  /** How many `GET /big` the program has answered. */
  bigCount: i32 = 0
  /** How many requests the program has taken. */
  taken: i32 = 0

  constructor(idleMs: i32, bodyMs: i32, requests: i32, maxBody: i32, headerBytes: i32) {
    const router = new Router(new RouterLimits())
    router.add("GET", "/")
    router.add("GET", "/users/:id")
    router.add("POST", "/echo")
    router.add("GET", "/slow")
    router.add("GET", "/stream")
    router.add("DELETE", "/users/:id")
    router.add("GET", "/problem")
    router.add("GET", "/big")
    router.add("POST", "/hold")
    const limits = new HttpServerLimits()
    limits.requests = requests
    limits.maxBody = maxBody
    limits.bodyTimeout = bodyMs
    const config = new Http1Config()
    config.idleTimeout = idleMs
    if (headerBytes > config.maxHeaderBytes) {
      // Room to read a whole burst at once, and to queue every answer to it.
      config.maxHeaderBytes = headerBytes
      config.outputSize = headerBytes * 8
      limits.maxHead = headerBytes + 16384
    }
    const listener: i32 = tcpListen("127.0.0.1", 0, 64)
    this.port = netLocalPort(listener)
    this.h = new HttpServer(limits, router)
    this.h.listenHttp1(listener, config, toI32(8))
    this.held = []
    this.text = ascii("text/plain")
    this.hello = ascii("hello")
    this.octets = ascii("application/octet-stream")
    this.name = new Array<u8>(64)
    this.streamNames = [ascii("content-type")]
    this.streamValues = [ascii("text/plain")]
    this.pieces = [ascii("one,"), ascii("two,"), ascii("three")]
    this.big = new Array<u8>(BIG_LENGTH)
  }

  /** One turn of the handler, then every whole request answered (or held, for `/slow`). */
  turn(): void {
    this.h.wait(toI32(1))
    while (this.h.ready()) {
      this.answer(this.h.take())
    }
  }

  answer(req: HttpServerRequest): void {
    const h: HttpServer = this.h
    this.taken += 1
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
      case HOLD:
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
      case BIG:
        this.bigCount += 1
        h.send(req, 200, this.octets, this.big, ZERO, BIG_LENGTH)
        break
      default:
        h.refuse(req)
    }
  }
}

/** A client: its socket and what it has read and not yet consumed. */
export class Client {
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

export const lower = (c: i32): i32 => (c >= 65 && c <= 90 ? c + 32 : c)

/** Whether `buf[at ..)` starts with `text`, letters compared without case. */
export const startsWith = (buf: u8[], at: i32, end: i32, text: string): boolean => {
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
export const find = (buf: u8[], from: i32, end: i32, text: string): i32 => {
  for (let at: i32 = from; at + toI32(text.length) <= end; at++) {
    if (startsWith(buf, at, end, text)) {
      return at
    }
  }
  return -1
}

/** The value of header `name` (with its `: `) in the head `buf[0 .. headEnd)` as a decimal, or -1. */
export const headerNumber = (buf: u8[], headEnd: i32, name: string): i32 => {
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

export const dial = (app: App): Client => {
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
export const sendAll = (app: App, c: Client, bytes: u8[], off: i32, len: i32): void => {
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

export const sendText = (app: App, c: Client, text: string): void => {
  const bytes: u8[] = ascii(text)
  sendAll(app, c, bytes, ZERO, toI32(bytes.length))
}

/** Reads what has arrived; false once the peer has closed. */
export const pull = (c: Client): boolean => {
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
export const consume = (c: Client): void => {
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
export const response = (app: App, c: Client, head: boolean): boolean => {
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

/** Whether the last response's body is exactly `text`, byte for byte (case counts, unlike `startsWith`). */
export const bodyIs = (c: Client, text: string): boolean => {
  if (c.bodyLength !== toI32(text.length) || c.bodyStart + c.bodyLength > toI32(c.buf.length)) {
    return false
  }
  for (let k: i32 = 0; k < c.bodyLength; k++) {
    if (toI32(c.buf[c.bodyStart + k]) !== toI32(text.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** Whether the last response's head holds `text`. */
export const headHas = (c: Client, text: string): boolean => find(c.buf, ZERO, c.bodyStart, text) >= 0

/** Turns the handler until the peer closes `c`, for five seconds at most. */
export const awaitClose = (app: App, c: Client): boolean => {
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (!c.closed && monotonicNanos() < deadline) {
    app.turn()
    pull(c)
  }
  return c.closed
}

/** Turns the handler until it holds `n` connections, for five seconds at most. */
export const awaitConnections = (app: App, n: i32): boolean => {
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (app.h.connections() !== n && monotonicNanos() < deadline) {
    app.turn()
  }
  return app.h.connections() === n
}

/** Turns the handler until it holds `n` requests on purpose. */
export const awaitHeld = (app: App, n: i32): boolean => {
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (app.heldCount < n && monotonicNanos() < deadline) {
    app.turn()
  }
  return app.heldCount >= n
}

export const check = (app: App, name: string, ok: boolean): void => {
  if (ok) {
    console.log(`PASS  ${name}`)
  } else {
    console.log(`FAIL  ${name}`)
    app.failures += 1
  }
}

/** How many `OPTIONS *` the deep pipeline sends in one write. */
export const DEEP: i32 = 25000

/**
 * Reads until `c` holds `n` answers that start `HTTP/1.1 204`, turning the
 * handler, for five seconds at most: how many it read. It scans each byte
 * once and keeps only a tail too short to hold a whole status line.
 */
export const count204 = (app: App, c: Client, n: i32): i32 => {
  const line: string = "HTTP/1.1 204 "
  const keep: i32 = toI32(line.length) - 1
  let seen: i32 = 0
  let from: i32 = 0
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (seen < n && !c.closed && monotonicNanos() < deadline) {
    app.turn()
    pull(c)
    let at: i32 = find(c.buf, from, c.length, line)
    while (at >= 0) {
      seen += 1
      from = at + toI32(line.length)
      at = find(c.buf, from, c.length, line)
    }
    if (c.length > keep) {
      const tail: i32 = from > c.length - keep ? c.length - from : keep
      copyBytes(c.buf, ZERO, c.buf, c.length - tail, tail)
      c.length = tail
      from = 0
    }
  }
  return seen
}

export const deepPipeline = (app: App, depth: i32): void => {
  const c = dial(app)
  sendText(app, c, "GET /slow HTTP/1.1\r\nHost: t\r\n\r\n")
  check(app, "a request held at the head of a deep pipeline is taken", awaitHeld(app, toI32(1)))
  // Behind the held request the connection reads but parses nothing, so the
  // whole burst waits in its input for the one answer that releases it.
  const one: string = "OPTIONS * HTTP/1.1\r\nHost: a\r\n\r\n"
  const bytes: u8[] = new Array<u8>(depth * toI32(one.length))
  for (let k: i32 = 0; k < toI32(bytes.length); k++) {
    bytes[k] = toU8(one.charCodeAt(k % toI32(one.length)))
  }
  sendAll(app, c, bytes, ZERO, toI32(bytes.length))
  for (let k: i32 = 0; k < 50; k++) {
    app.turn()
  }
  const r: HttpServerRequest = app.held[0]
  app.heldCount = 0
  check(app, "the held answer goes out", app.h.send(r, 200, app.text, app.hello, ZERO, toI32(app.hello.length)) === HANDLER_SENT)
  check(app, "and every OPTIONS * behind it, twenty-five thousand in one read, is answered 204", count204(app, c, depth) === depth)
  netClose(c.fd)
  check(app, "the deep client is gone", awaitConnections(app, toI32(0)))
}
