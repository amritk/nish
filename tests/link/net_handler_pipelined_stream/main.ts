// `nish/net/handler`: a streamed response finished by its length keeps the
// request pipelined behind it (#1556).
//
// One write carries `GET /stream` and `GET /` back to back. The program
// starts `/stream` with a `Content-Length` of five, writes all five bytes,
// holds the request and ends it on a later turn. The carrier finishes a
// length-framed response once its last byte is out, so a handler that kept
// asking the slot for events would read `GET /` while `/stream` is still the
// program's, and the late `end` would end or drop it. The handler instead
// reads nothing more on the slot until the `end`: `GET /` is taken after it,
// both answers arrive in order, and a warm connection repeats the pair with
// the request pool flat. Last, `GET /` sent in its own write while the stream
// is held must not wake the handler's `wait` until the `end`.
import { copyBytes } from "nish/bytes"
import { HANDLER_DROPPED, HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
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
const STREAM: i32 = 0
const HOME: i32 = 1

const FIVE_SECONDS: i64 = 5000000000
/** How many turns the streamed request is held after its body is written. */
const HELD_TURNS: i32 = 4

/** The server half: the handler and the streamed request it holds unended. */
class App {
  h: HttpHandler
  port: i32 = 0
  text: u8[]
  hello: u8[]
  names: u8[][]
  values: u8[][]
  streamed: u8[]
  /** The `/stream` request whose body is written and whose `end` is put off, or null. */
  held: HttpRequest | null = null
  /** The `GET /` taken and not yet answered: the program answers it after `/stream`'s end. */
  home: HttpRequest | null = null
  /** How many `GET /` the program has taken, and how many of them while `held` was not ended. */
  homes: i32 = 0
  early: i32 = 0

  constructor() {
    const router = new Router(new RouterLimits())
    router.add("GET", "/stream")
    router.add("GET", "/")
    const limits = new HandlerLimits()
    limits.slots = 4
    const listener: i32 = tcpListen("127.0.0.1", 0, 16)
    this.port = netLocalPort(listener)
    this.h = new HttpHandler(limits, listener, router)
    this.text = ascii("text/plain")
    this.hello = ascii("hello")
    this.names = [ascii("content-type")]
    this.values = [ascii("text/plain")]
    this.streamed = ascii("abcde")
  }

  /** One turn of the handler, then every whole request answered. */
  turn(): void {
    this.h.wait(toI32(1))
    while (this.h.ready()) {
      this.answer(this.h.take())
    }
  }

  answer(req: HttpRequest): void {
    const h: HttpHandler = this.h
    if (req.route === STREAM) {
      const n: i32 = toI32(this.streamed.length)
      h.start(req, 200, this.names, this.values, n)
      h.write(req, this.streamed, ZERO, n)
      this.held = req
    } else if (req.route === HOME) {
      this.homes += 1
      if (this.held !== null) {
        this.early += 1
      }
      this.home = req
    } else {
      h.refuse(req)
    }
  }

  /**
   * Turns until `/stream` is held, `HELD_TURNS` more with it unended, then
   * ends it, turns until `GET /` is taken and answers that: whether both were.
   */
  endLate(): boolean {
    const deadline: i64 = monotonicNanos() + FIVE_SECONDS
    while (this.held === null && monotonicNanos() < deadline) {
      this.turn()
    }
    for (let k: i32 = 0; k < HELD_TURNS; k++) {
      this.turn()
    }
    const r: HttpRequest | null = this.held
    if (r === null) {
      return false
    }
    this.held = null
    this.h.end(r)
    while (this.home === null && monotonicNanos() < deadline) {
      this.turn()
    }
    const home: HttpRequest | null = this.home
    if (home === null) {
      return false
    }
    this.home = null
    this.h.send(home, 200, this.text, this.hello, ZERO, toI32(this.hello.length))
    return true
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
    this.buf = new Array<u8>(4096)
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
 * is whole: true with its status and body in `c`, false after five seconds or a close.
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
      const length: i32 = headerNumber(c.buf, headEnd, "\r\ncontent-length: ")
      if (length >= 0 && c.length - c.bodyStart >= length) {
        c.bodyLength = length
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

/** Whether the last response is a 200 whose body is exactly `text`. */
const answered = (c: Client, text: string): boolean =>
  c.status === 200 && c.bodyLength === toI32(text.length) && startsWith(c.buf, c.bodyStart, c.length, text)

/** Sends the pipelined pair, ends `/stream` late and reads both answers: whether both came, in order. */
const pair = (app: App, c: Client, both: u8[]): boolean => {
  sendAll(app, c, both)
  if (!app.endLate()) {
    return false
  }
  const first: boolean = response(app, c) && answered(c, "abcde")
  return first && response(app, c) && answered(c, "hello")
}

export const main = (): i32 => {
  const t = new Suite("handler pipelined stream")
  const app = new App()
  const c: Client = connect(app)
  const both: u8[] = ascii("GET /stream HTTP/1.1\r\nHost: t\r\n\r\nGET / HTTP/1.1\r\nHost: t\r\n\r\n")

  sendAll(app, c, both)
  t.ok("the streamed request is held unended after its whole body, then ended", app.endLate())
  t.eqI32("the request pipelined behind it is not taken before its end", app.early, toI32(0))
  t.ok("the streamed response arrives first, whole", response(app, c) && answered(c, "abcde"))
  t.ok("then the pipelined request's answer", response(app, c) && answered(c, "hello"))
  t.eqI32("which the program took once", app.homes, toI32(1))
  t.ok("and the connection stays open", !c.closed)

  // A warm connection: the pair again, with no request made past the pool.
  let good: i32 = 0
  for (let k: i32 = 0; k < 20; k++) {
    good += pair(app, c, both) ? 1 : 0
  }
  const pooled: i32 = app.h.pooled()
  for (let k: i32 = 0; k < 100; k++) {
    good += pair(app, c, both) ? 1 : 0
  }
  t.eqI32("a warm connection answers a hundred and twenty pairs in order", good, toI32(120))
  t.eqI32("with no pipelined request taken early", app.early, toI32(0))
  t.eqI32("and the pool makes no request past its warm size", app.h.pooled(), pooled)

  // `GET /` sent on its own once `/stream` is held: the slot's readiness for
  // it must not wake every `wait` while the program holds the stream.
  sendAll(app, c, ascii("GET /stream HTTP/1.1\r\nHost: t\r\n\r\n"))
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (app.held === null && monotonicNanos() < deadline) {
    app.turn()
  }
  sendAll(app, c, ascii("GET / HTTP/1.1\r\nHost: t\r\n\r\n"))
  app.turn()
  app.turn()
  const before: i64 = monotonicNanos()
  app.h.wait(toI32(300))
  t.ok("a request sent behind a held stream does not wake the handler's wait", monotonicNanos() - before >= toI64(200000000))
  const late: boolean = app.endLate() && response(app, c) && answered(c, "abcde")
  t.ok("and is answered after the stream's end", late && response(app, c) && answered(c, "hello"))

  // A second client hangs up while its stream is held: the late `end` finds
  // the connection gone, and the handler keeps answering the first.
  const gone: Client = connect(app)
  sendAll(app, gone, ascii("GET /stream HTTP/1.1\r\nHost: t\r\n\r\nGET / HTTP/1.1\r\nHost: t\r\n\r\n"))
  const goneBy: i64 = monotonicNanos() + FIVE_SECONDS
  while (app.held === null && monotonicNanos() < goneBy) {
    app.turn()
  }
  netClose(gone.fd)
  for (let k: i32 = 0; k < HELD_TURNS; k++) {
    app.turn()
  }
  const orphan: HttpRequest | null = app.held
  app.held = null
  t.ok("a stream held past its peer's hang-up ends as dropped", orphan !== null && app.h.end(orphan) === HANDLER_DROPPED)
  t.ok("with the request pipelined behind it never taken", app.home === null && app.early === 0)
  t.ok("and the other connection still answers a pair in order", pair(app, c, both))
  t.eqI32("with the pool at its warm size", app.h.pooled(), pooled)
  netClose(c.fd)
  return t.done()
}
