// `nish/net/handler`'s steps over loopback: a program that binds three steps
// with `Router.use` and runs them with `HttpHandler.before` and `after`.
//
//   - `ID` runs on every route but `/plain`, on 404 and on 405, and adds an
//     `x-request-id` field to whatever answers the request.
//   - `AUTH` runs on `/admin` alone and refuses with 401 a request with no
//     `authorization` field, so neither the route body nor `TAG` runs.
//   - `TAG` runs on `/` and `/admin` and adds `x-tag` after the body.
//   - `LATE` runs on `/late` alone, after its body, and answers 503 in the
//     body's place, so the after-steps below it do not run.
//
// The log of each request names its steps in the order they ran: before-steps
// lowest id first, after-steps the reverse. `/plain` is bound to no step: it
// runs none and its answer has no field it did not name. A warm connection
// then serves stepped and plain requests with `Arena.used()` unchanged.
import { copyBytes } from "nish/bytes"
import {
  HANDLER_ABSENT,
  HANDLER_ANSWERED,
  HandlerLimits,
  HttpHandler,
  HttpRequest,
} from "nish/net/handler"
import { ROUTER_METHOD_NOT_ALLOWED, ROUTER_NOT_FOUND, Router, RouterLimits } from "nish/net/router"
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
import { Suite } from "nish/testing"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

// The routes, in the order they are added.
const HOME: i32 = 0
const ADMIN: i32 = 1
const PLAIN: i32 = 2
const LATE: i32 = 3

const FIVE_SECONDS: i64 = 5000000000
/** How many request ids the program cycles through, made before the first request. */
const IDS: i32 = 8

/** The server half: the handler, its steps, and what the last request ran. */
class App {
  h: HttpHandler
  port: i32 = 0
  /** The step ids `Router.step` named. */
  id: i32 = 0
  auth: i32 = 0
  tag: i32 = 0
  late: i32 = 0
  text: u8[]
  hello: u8[]
  idName: u8[]
  ids: u8[][]
  tagName: u8[]
  tagValue: u8[]
  /** How many requests have been given an id. */
  served: i32 = 0
  /** Whether to keep `log`; off for the arena rounds. */
  logging: boolean = true
  /** What the last request ran: `b<step>`, `body`, `a<step>`, in order. */
  log: string[]

  constructor() {
    const router = new Router(new RouterLimits())
    router.add("GET", "/")
    router.add("GET", "/admin")
    router.add("GET", "/plain")
    router.add("GET", "/late")
    this.id = router.step()
    this.auth = router.step()
    this.tag = router.step()
    this.late = router.step()
    router.use(HOME, this.id)
    router.use(ADMIN, this.id)
    router.use(ROUTER_NOT_FOUND, this.id)
    router.use(ROUTER_METHOD_NOT_ALLOWED, this.id)
    router.use(ADMIN, this.auth)
    router.use(HOME, this.tag)
    router.use(ADMIN, this.tag)
    router.use(LATE, this.id)
    router.use(LATE, this.late)
    const limits = new HandlerLimits()
    limits.slots = 4
    const listener: i32 = tcpListen("127.0.0.1", 0, 16)
    this.port = netLocalPort(listener)
    this.h = new HttpHandler(limits, listener, router)
    this.text = ascii("text/plain")
    this.hello = ascii("hello")
    this.idName = ascii("x-request-id")
    this.ids = []
    for (let k: i32 = 0; k < IDS; k++) {
      this.ids.push(ascii(`r${k}`))
    }
    this.tagName = ascii("x-tag")
    this.tagValue = ascii("on")
    this.log = []
  }

  /** One turn of the handler, then every whole request answered. */
  turn(): void {
    this.h.wait(toI32(1))
    while (this.h.ready()) {
      this.answer(this.h.take())
    }
  }

  /** Logs `what` with `step` after it, or alone when `step` is -1; nothing, and no string made, with `logging` off. */
  private note(what: string, step: i32): void {
    if (this.logging) {
      this.log.push(step < 0 ? what : `${what}${step}`)
    }
  }

  answer(req: HttpRequest): void {
    const h: HttpHandler = this.h
    if (this.logging) {
      this.log = []
    }
    let s: i32 = h.before(req)
    while (s >= 0) {
      this.note("b", s)
      if (s === this.id) {
        h.field(req, this.idName, this.ids[this.served % IDS])
        this.served += 1
      } else if (s === this.auth) {
        if (req.header("authorization") === HANDLER_ABSENT) {
          h.problem(req, 401, "Unauthorized", "")
        }
      }
      s = h.before(req)
    }
    if (s === HANDLER_ANSWERED) {
      return
    }
    this.note("body", toI32(-1))
    let a: i32 = h.after(req)
    while (a >= 0) {
      this.note("a", a)
      if (a === this.tag) {
        h.field(req, this.tagName, this.tagValue)
      } else if (a === this.late) {
        h.problem(req, 503, "Service Unavailable", "")
      }
      a = h.after(req)
    }
    if (a === HANDLER_ANSWERED) {
      return
    }
    switch (req.route) {
      case HOME:
      case ADMIN:
      case PLAIN:
      case LATE:
        h.send(req, 200, this.text, this.hello, ZERO, toI32(this.hello.length))
        break
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
  status: i32 = 0
  bodyStart: i32 = 0
  responseLength: i32 = 0
  closed: boolean = false

  constructor() {
    this.buf = new Array<u8>(65536)
  }
}

/** Whether `buf[at ..)` starts with `text`, byte for byte. */
const startsWith = (buf: u8[], at: i32, end: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (at < 0 || at + n > end || end > toI32(buf.length)) {
    return false
  }
  for (let k: i32 = 0; k < n; k++) {
    if (toI32(buf[at + k]) !== toI32(text.charCodeAt(k))) {
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

/** The decimal after `name` in `buf[0 .. headEnd)`, or -1 when `name` is not there. */
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

const sendAll = (app: App, c: Client, bytes: u8[]): void => {
  let at: i32 = 0
  const len: i32 = toI32(bytes.length)
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (at < len && monotonicNanos() < deadline) {
    const n: i32 = netWrite(c.fd, bytes, at, len - at)
    if (n > 0) {
      at += n
    } else {
      app.turn()
    }
  }
}

/**
 * Reads one response with a `content-length`, turning the handler until it
 * is whole: true with its status in `c`, false after five seconds or a close.
 */
const response = (app: App, c: Client): boolean => {
  const used: i32 = c.responseLength
  if (used > 0) {
    copyBytes(c.buf, ZERO, c.buf, used, c.length - used)
    c.length -= used
    c.responseLength = 0
  }
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline) {
    const headEnd: i32 = find(c.buf, ZERO, c.length, "\r\n\r\n")
    if (headEnd > 0) {
      c.status = headerNumber(c.buf, headEnd, "HTTP/1.1 ")
      c.bodyStart = headEnd + 4
      const length: i32 = headerNumber(c.buf, headEnd, "\r\nContent-Length: ")
      if (length >= 0 && c.length - c.bodyStart >= length) {
        c.responseLength = c.bodyStart + length
        return true
      }
    }
    if (c.closed) {
      return false
    }
    app.turn()
    const room: i32 = toI32(c.buf.length) - c.length
    const n: i32 = room > 0 ? netRead(c.fd, c.buf, c.length, room) : -1
    if (n > 0) {
      c.length += n
    } else if (n === 0) {
      c.closed = true
    }
  }
  return false
}

/** Whether the last response's head holds `text`. */
const headHas = (c: Client, text: string): boolean => find(c.buf, ZERO, c.bodyStart, text) >= 0

/** Sends `GET path` (or `method path`) with `extra` header lines and reads the answer. */
const ask = (app: App, c: Client, method: string, path: string, extra: string): boolean => {
  sendAll(app, c, ascii(`${method} ${path} HTTP/1.1\r\nHost: t\r\n${extra}\r\n`))
  return response(app, c)
}

/** Sends `home` then `plain`, `n` times, each after the last answer: how many answers were right. */
const rounds = (app: App, c: Client, home: u8[], plain: u8[], n: i32): i32 => {
  let good: i32 = 0
  for (let round: i32 = 0; round < n; round++) {
    sendAll(app, c, home)
    if (response(app, c) && c.status === 200 && headHas(c, "\r\nx-tag: on\r\n")) {
      good += 1
    }
    sendAll(app, c, plain)
    if (response(app, c) && c.status === 200 && !headHas(c, "x-request-id")) {
      good += 1
    }
  }
  return good
}

export const main = (): i32 => {
  const t = new Suite("handler steps")
  const app = new App()
  const c = connect(app)

  t.ok("GET / is answered 200", ask(app, c, "GET", "/", "") && c.status === 200)
  t.eqStr("its steps run lowest first before the body, the reverse after", app.log.join(" "), "b0 b2 body a2 a0")
  t.ok("ID's field is in the answer", headHas(c, "\r\nx-request-id: r0\r\n"))
  t.ok("and so is TAG's, added after the body", headHas(c, "\r\nx-tag: on\r\n"))
  const typeAt: i32 = find(c.buf, ZERO, c.bodyStart, "content-type")
  t.ok("after the body's own fields", typeAt >= 0 && typeAt < find(c.buf, ZERO, c.bodyStart, "x-request-id"))

  t.ok("GET /admin with no authorization is refused 401", ask(app, c, "GET", "/admin", "") && c.status === 401)
  t.eqStr("by AUTH, so neither the body nor an after-step runs", app.log.join(" "), "b0 b1")
  t.ok("and the refusal carries ID's field", headHas(c, "\r\nx-request-id: r1\r\n"))
  t.ok("but not TAG's", !headHas(c, "x-tag"))

  t.ok("GET /admin with authorization is answered 200", ask(app, c, "GET", "/admin", "Authorization: yes\r\n") && c.status === 200)
  t.eqStr("after all three steps, and all three after it", app.log.join(" "), "b0 b1 b2 body a2 a1 a0")
  t.ok("with both fields", headHas(c, "\r\nx-request-id: r2\r\n") && headHas(c, "\r\nx-tag: on\r\n"))

  t.ok("GET /nope is answered 404", ask(app, c, "GET", "/nope", "") && c.status === 404)
  t.eqStr("after the step bound to ROUTER_NOT_FOUND", app.log.join(" "), "b0 body a0")
  t.ok("whose field the handler's problem carries", headHas(c, "\r\nx-request-id: r3\r\n"))

  t.ok("POST /plain is answered 405", ask(app, c, "POST", "/plain", "Content-Length: 0\r\n") && c.status === 405)
  t.ok("with its Allow and the step's field", headHas(c, "\r\nallow: ") && headHas(c, "\r\nx-request-id: r4\r\n"))

  t.ok("GET /plain is answered 200", ask(app, c, "GET", "/plain", "") && c.status === 200)
  t.eqStr("and runs no step", app.log.join(" "), "body")
  t.ok("nor carries a field it did not name", !headHas(c, "x-request-id") && !headHas(c, "x-tag"))

  t.ok("a field added to one request is not on the next", ask(app, c, "GET", "/plain", "") && !headHas(c, "x-request-id"))

  t.ok("GET /late is answered 503 by its after-step", ask(app, c, "GET", "/late", "") && c.status === 503)
  t.eqStr("so the after-step below it does not run", app.log.join(" "), "b0 b3 body a3")
  t.ok("and the 503 carries ID's field, not the body's answer", headHas(c, "\r\nx-request-id: r5\r\n") && !headHas(c, "text/plain"))

  // A warm connection: stepped and plain requests leave the arena as it was.
  // The requests are made once, and a hundred rounds warm the pool first.
  app.logging = false
  const home: u8[] = ascii("GET / HTTP/1.1\r\nHost: t\r\n\r\n")
  const plain: u8[] = ascii("GET /plain HTTP/1.1\r\nHost: t\r\n\r\n")
  let good: i32 = rounds(app, c, home, plain, toI32(100))
  const pooled: i32 = app.h.pooled()
  const before: i64 = Arena.used()
  good += rounds(app, c, home, plain, toI32(500))
  const kept: i64 = Arena.used() - before
  t.eqI32("a warm connection answers twelve hundred stepped and plain requests", good, toI32(1200))
  t.eqI64("and the arena stays flat", kept, toI64(0))
  t.eqI32("and the pool makes no request past its warm size", app.h.pooled(), pooled)
  netClose(c.fd)
  return t.done()
}
