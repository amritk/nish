// `nish/net/upstream` over loopback: an `HttpHandler`, the upstreams its
// routes call, and the raw servers those upstreams reach, all turned by the
// same loop. The servers are this program's own sockets, read and written
// between the handler's turns.
//
//   1. The slow upstream: a client whose route waits on an upstream that
//      never answers does not stall another client, whether that one is
//      answered by the program or through a second upstream; the slow call
//      ends `UPSTREAM_E_TIMEOUT` at its deadline and its client gets a 504.
//   2. Keep-alive: calls in a row reuse one connection, and each answer is
//      tagged with the request that asked.
//   3. Every codec refusal is a failed call: a malformed status line, a bare
//      LF, conflicting framing, a body past `maxBody` and a body cut short
//      each end `ok === false` with the codec's `HTTP1_E_` code, and the next
//      call is answered on a new connection.
//   4. The outbound policy: an origin at a private address is refused
//      `UPSTREAM_E_BLOCKED` with nothing connected, and allowed once the
//      policy permits it; an origin that is not `http:` is `UPSTREAM_E_ORIGIN`,
//      and a path the codec will not write is `UPSTREAM_E_REQUEST`.
//   5. The warm pool: three thousand calls on one connection make no call
//      slot, connection or body buffer past the ones the pool started with,
//      and past a thousand of warm-up, two thousand more leave
//      `Arena.used()` where it was: a call allocates nothing.
import { copyBytes } from "nish/bytes"
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import {
  HTTP1_E_BARE_LF,
  HTTP1_E_BODY_LIMIT,
  HTTP1_E_FRAMING,
  HTTP1_E_STATUS_LINE,
  HTTP1_E_TRUNCATED,
} from "nish/net/http1-client"
import { OutboundPolicy } from "nish/net/outbound"
import { Router, RouterLimits } from "nish/net/router"
import {
  UPSTREAM_E_BLOCKED,
  UPSTREAM_E_NONE,
  UPSTREAM_E_ORIGIN,
  UPSTREAM_E_REQUEST,
  UPSTREAM_E_TIMEOUT,
  Upstream,
  UpstreamLimits,
  UpstreamResponse,
} from "nish/net/upstream"
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
  tcpAccept,
  tcpConnect,
  tcpListen,
} from "nish:net"

const ZERO: i32 = 0
const FIVE_SECONDS: i64 = 5000000000
const MILLISECOND: i64 = 1000000

// The routes, in the order they are added.
const HOME: i32 = 0
const SLOW: i32 = 1
const FAST: i32 = 2


const ascii = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length)
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

/** Where `text` first appears in `buf[0 .. end)`, or -1. */
const find = (buf: u8[], end: i32, text: string): i32 => {
  const n: i32 = toI32(text.length)
  for (let at: i32 = 0; at + n <= end; at++) {
    let k: i32 = 0
    while (k < n && toI32(buf[at + k]) === toI32(text.charCodeAt(k))) {
      k += 1
    }
    if (k === n) {
      return at
    }
  }
  return -1
}

const bytesAre = (buf: u8[], off: i32, len: i32, text: string): boolean => {
  if (len !== toI32(text.length)) {
    return false
  }
  for (let k: i32 = 0; k < len; k++) {
    if (toI32(buf[off + k]) !== toI32(text.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** One accepted connection of a `Mock`: what it has read, and the answer it owes. */
class MockConnection {
  fd: i32 = -1
  input: u8[]
  length: i32 = 0
  /** When the owed answer goes out; 0 for none owed. */
  dueAt: i64 = 0

  constructor() {
    this.input = new Array<u8>(16384)
  }
}

/**
 * An upstream server: answers each whole request head with `reply`, after
 * `delayMs` (-1 for never), then closes if `close` says so.
 */
class Mock {
  listener: i32 = -1
  port: i32 = 0
  reply: u8[]
  delayMs: i32 = 0
  close: boolean = false
  accepted: i32 = 0
  requests: i32 = 0
  /** The last request head read, for a test to look at. */
  lastHead: u8[]
  lastHeadLength: i32 = 0
  conns: MockConnection[]
  peer: u8[]

  constructor() {
    this.listener = tcpListen("127.0.0.1", 0, 64)
    this.port = netLocalPort(this.listener)
    this.reply = ascii("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok")
    this.lastHead = new Array<u8>(16384)
    this.conns = []
    for (let k: i32 = 0; k < 8; k++) {
      this.conns.push(new MockConnection())
    }
    this.peer = new Array<u8>(18)
  }

  origin(): string {
    return `http://127.0.0.1:${this.port}`
  }

  /** Accepts, reads and answers what is ready, without waiting. */
  serve(): void {
    while (true) {
      const fd: i32 = tcpAccept(this.listener, this.peer)
      if (fd < 0) {
        break
      }
      this.accepted += 1
      let placed: boolean = false
      for (let k: i32 = 0; k < toI32(this.conns.length) && !placed; k++) {
        const c: MockConnection = this.conns[k]
        if (c.fd < 0) {
          c.fd = fd
          c.length = 0
          c.dueAt = 0
          placed = true
        }
      }
      if (!placed) {
        netClose(fd)
      }
    }
    const now: i64 = monotonicNanos()
    for (let k: i32 = 0; k < toI32(this.conns.length); k++) {
      const c: MockConnection = this.conns[k]
      if (c.fd < 0) {
        continue
      }
      const room: i32 = toI32(c.input.length) - c.length
      const n: i32 = room > 0 ? netRead(c.fd, c.input, c.length, room) : -11
      if (n === 0 || (n < 0 && n !== -11)) {
        netClose(c.fd)
        c.fd = -1
        continue
      }
      if (n > 0) {
        c.length += n
      }
      if (c.dueAt === 0) {
        const end: i32 = find(c.input, c.length, "\r\n\r\n")
        if (end >= 0) {
          this.requests += 1
          copyBytes(this.lastHead, ZERO, c.input, ZERO, end + 4)
          this.lastHeadLength = end + 4
          copyBytes(c.input, ZERO, c.input, end + 4, c.length - end - 4)
          c.length -= end + 4
          c.dueAt = this.delayMs < 0 ? -1 : now + toI64(this.delayMs) * MILLISECOND
        }
      }
      if (c.dueAt > 0 && now >= c.dueAt) {
        c.dueAt = 0
        // Loopback takes these few bytes whole.
        netWrite(c.fd, this.reply, ZERO, toI32(this.reply.length))
        if (this.close) {
          netClose(c.fd)
          c.fd = -1
        }
      }
    }
  }
}

/** The program: a handler whose `/slow` and `/fast` routes call an upstream each. */
class App {
  h: HttpHandler
  slowMock: Mock
  fastMock: Mock
  slow: Upstream
  fast: Upstream
  /** Upstreams a test drives with its own calls, turned with the rest. */
  extra: Upstream[]
  extraDone: UpstreamResponse[]
  mocks: Mock[]
  text: u8[]
  hello: u8[]
  port: i32 = 0
  failures: i32 = 0

  constructor() {
    const router = new Router(new RouterLimits())
    router.add("GET", "/")
    router.add("GET", "/slow")
    router.add("GET", "/fast")
    const limits = new HandlerLimits()
    limits.slots = 8
    const listener: i32 = tcpListen("127.0.0.1", 0, 64)
    this.port = netLocalPort(listener)
    this.h = new HttpHandler(limits, listener, router)
    this.slowMock = new Mock()
    this.slowMock.delayMs = -1
    this.fastMock = new Mock()
    this.fastMock.reply = ascii("HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nfast")
    const slowLimits = new UpstreamLimits()
    slowLimits.firstId = 0
    slowLimits.connections = 2
    slowLimits.timeoutMs = 400
    this.slow = new Upstream(this.h, this.slowMock.origin(), slowLimits)
    const fastLimits = new UpstreamLimits()
    fastLimits.firstId = 2
    fastLimits.connections = 2
    this.fast = new Upstream(this.h, this.fastMock.origin(), fastLimits)
    this.extra = []
    this.extraDone = []
    this.mocks = [this.slowMock, this.fastMock]
    this.text = ascii("text/plain")
    this.hello = ascii("hello")
  }

  /** One turn: the handler, its routes, the answers that came back, then the servers. */
  turn(): void {
    const h: HttpHandler = this.h
    h.wait(toI32(1))
    while (h.ready()) {
      const req: HttpRequest = h.take()
      if (req.route === HOME) {
        h.send(req, 200, this.text, this.hello, ZERO, toI32(this.hello.length))
      } else if (req.route === SLOW) {
        this.call(this.slow, req)
      } else if (req.route === FAST) {
        this.call(this.fast, req)
      } else {
        h.refuse(req)
      }
    }
    this.answer(this.slow)
    this.answer(this.fast)
    for (let k: i32 = 0; k < toI32(this.extra.length); k++) {
      const u: Upstream = this.extra[k]
      while (u.ready()) {
        this.extraDone.push(u.take())
      }
    }
    for (let k: i32 = 0; k < toI32(this.mocks.length); k++) {
      this.mocks[k].serve()
    }
  }

  call(u: Upstream, req: HttpRequest): void {
    if (u.get(req, "/data") !== UPSTREAM_E_NONE) {
      this.h.problem(req, 503, "Service Unavailable", "every upstream call slot is taken")
    }
  }

  answer(u: Upstream): void {
    while (u.ready()) {
      const r: UpstreamResponse = u.take()
      if (r.ok) {
        this.h.send(r.req, r.status, this.text, r.body, ZERO, r.length)
      } else {
        this.h.problem(r.req, r.error === UPSTREAM_E_TIMEOUT ? 504 : 502, "Bad Gateway", `upstream error ${r.error}`)
      }
      u.release(r)
    }
  }

  /** Turns until `u`'s next own call is back, or five seconds pass. */
  awaitCall(u: Upstream): UpstreamResponse | null {
    const deadline: i64 = monotonicNanos() + FIVE_SECONDS
    while (monotonicNanos() < deadline) {
      this.turn()
      if (this.extraDone.length > 0) {
        // A test has one call of its own out at a time.
        return this.extraDone.pop()
      }
    }
    return null
  }
}

const check = (app: App, name: string, ok: boolean): void => {
  if (ok) {
    console.log(`PASS  ${name}`)
  } else {
    console.log(`FAIL  ${name}`)
    app.failures += 1
  }
}

/** A client of the handler: its socket and the last response it read. */
class Client {
  fd: i32 = -1
  buf: u8[]
  length: i32 = 0
  status: i32 = 0
  bodyStart: i32 = 0
  bodyLength: i32 = 0

  constructor() {
    this.buf = new Array<u8>(16384)
  }
}

const connect = (port: i32): Client => {
  const c = new Client()
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
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

const send = (c: Client, text: string): void => {
  const bytes: u8[] = ascii(text)
  if (netWrite(c.fd, bytes, ZERO, toI32(bytes.length)) !== toI32(bytes.length)) {
    panic("a request did not fit the socket")
  }
}

/** Reads one `Content-Length` response, turning the app until it is whole or `ms` pass. */
const response = (app: App, c: Client, ms: i32): boolean => {
  c.length = 0
  const deadline: i64 = monotonicNanos() + toI64(ms) * MILLISECOND
  while (monotonicNanos() < deadline) {
    app.turn()
    const n: i32 = netRead(c.fd, c.buf, c.length, toI32(c.buf.length) - c.length)
    if (n > 0) {
      c.length += n
    }
    const end: i32 = find(c.buf, c.length, "\r\n\r\n")
    const at: i32 = find(c.buf, end, "Content-Length: ")
    if (end > 12 && at > 0) {
      let length: i32 = 0
      let k: i32 = at + 16
      while (toI32(c.buf[k]) >= 48 && toI32(c.buf[k]) <= 57) {
        length = length * 10 + toI32(c.buf[k]) - 48
        k += 1
      }
      if (c.length >= end + 4 + length) {
        c.status = (toI32(c.buf[9]) - 48) * 100 + (toI32(c.buf[10]) - 48) * 10 + toI32(c.buf[11]) - 48
        c.bodyStart = end + 4
        c.bodyLength = length
        return true
      }
    }
  }
  return false
}

const slowUpstream = (app: App): void => {
  const waiting: Client = connect(app.port)
  send(waiting, "GET /slow HTTP/1.1\r\nHost: a\r\n\r\n")
  // Turn until the slow call is on the wire and the server holds it.
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (app.slowMock.requests === 0 && monotonicNanos() < deadline) {
    app.turn()
  }
  check(app, "slow: the call reached the slow server, and get returned at once", app.slowMock.requests === 1 && app.slow.pending() === 1)
  const started: i64 = monotonicNanos()
  const other: Client = connect(app.port)
  send(other, "GET / HTTP/1.1\r\nHost: a\r\n\r\n")
  const home: boolean = response(app, other, 1000)
  check(app, "slow: another client is answered by the program meanwhile", home && other.status === 200 && bytesAre(other.buf, other.bodyStart, other.bodyLength, "hello"))
  send(other, "GET /fast HTTP/1.1\r\nHost: a\r\n\r\n")
  const fast: boolean = response(app, other, 1000)
  check(app, "slow: and through a second upstream", fast && other.status === 200 && bytesAre(other.buf, other.bodyStart, other.bodyLength, "fast"))
  check(app, "slow: both inside the slow call's deadline", monotonicNanos() - started < toI64(400) * MILLISECOND && app.slow.pending() === 1)
  const late: boolean = response(app, waiting, 3000)
  check(app, "slow: the slow call ends UPSTREAM_E_TIMEOUT and its client gets a 504", late && waiting.status === 504 && find(waiting.buf, waiting.length, "upstream error 36") > 0)
  check(app, "slow: its slot and connection are given back", app.slow.pending() === 0 && app.slow.openConnections() === 0)
  netClose(waiting.fd)
  netClose(other.fd)
}

/** A test's own upstream to `mock`, turned by `app`, on watch ids from `firstId`. */
const own = (app: App, origin: string, firstId: i32, limits: UpstreamLimits): Upstream => {
  limits.firstId = firstId
  const u = new Upstream(app.h, origin, limits)
  app.extra.push(u)
  return u
}

const keepAlive = (app: App): void => {
  const mock = new Mock()
  app.mocks.push(mock)
  const limits = new UpstreamLimits()
  limits.connections = 1
  const u: Upstream = own(app, mock.origin(), 4, limits)
  let ok: boolean = true
  for (let k: i32 = 0; k < 5; k++) {
    const tag = new HttpRequest(100 + k)
    if (u.get(tag, `/item/${k}`) !== UPSTREAM_E_NONE) {
      ok = false
    }
    const r: UpstreamResponse | null = app.awaitCall(u)
    if (r === null || !r.ok || r.req !== tag || r.req.index !== 100 + k || r.status !== 200 || !bytesAre(r.body, ZERO, r.length, "ok")) {
      ok = false
    }
    if (r !== null) {
      u.release(r)
    }
  }
  check(app, "keep-alive: five calls in a row are answered, each tagged with its request", ok)
  check(app, "keep-alive: on one connection", mock.accepted === 1 && mock.requests === 5 && u.openConnections() === 1)
  check(
    app,
    "keep-alive: the request head is the path and the origin's Host",
    bytesAre(mock.lastHead, ZERO, mock.lastHeadLength, `GET /item/4 HTTP/1.1\r\nhost: 127.0.0.1:${mock.port}\r\n\r\n`)
  )
}

const refusals = (app: App): void => {
  const mock = new Mock()
  app.mocks.push(mock)
  const limits = new UpstreamLimits()
  limits.connections = 1
  limits.maxBody = 16
  const u: Upstream = own(app, mock.origin(), 5, limits)
  const cases: string[] = [
    "HTTP/1.1 2x0 OK\r\nContent-Length: 0\r\n\r\n",
    "HTTP/1.1 200 OK\nContent-Length: 0\r\n\r\n",
    "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n",
    "HTTP/1.1 200 OK\r\nContent-Length: 17\r\n\r\n12345678901234567",
    "HTTP/1.1 200 OK\r\nContent-Length: 10\r\n\r\nshort",
  ]
  const codes: i32[] = [HTTP1_E_STATUS_LINE, HTTP1_E_BARE_LF, HTTP1_E_FRAMING, HTTP1_E_BODY_LIMIT, HTTP1_E_TRUNCATED]
  const names: string[] = ["a malformed status line", "a bare LF", "conflicting framing", "a body past maxBody", "a body cut short"]
  for (let k: i32 = 0; k < toI32(cases.length); k++) {
    mock.reply = ascii(cases[k])
    // The cut-short body only ends when the server closes.
    mock.close = k === 4
    const tag = new HttpRequest(200 + k)
    u.get(tag, "/")
    const r: UpstreamResponse | null = app.awaitCall(u)
    const got: i32 = r === null ? -1 : r.error
    check(app, `refusal: ${names[k]} fails the call with code ${codes[k]}`, r !== null && !r.ok && r.req === tag && got === codes[k] && r.length === 0)
    if (r !== null) {
      u.release(r)
    }
  }
  mock.reply = ascii("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok")
  mock.close = false
  u.get(new HttpRequest(300), "/")
  const after: UpstreamResponse | null = app.awaitCall(u)
  check(app, "refusal: the next call is answered on a new connection", after !== null && after.ok && mock.accepted === 5 + 1)
  if (after !== null) {
    u.release(after)
  }
}

const policy = (app: App): void => {
  const mock = new Mock()
  app.mocks.push(mock)
  const refused = new UpstreamLimits()
  refused.connections = 1
  refused.outbound = new OutboundPolicy()
  const blocked: Upstream = own(app, mock.origin(), 6, refused)
  check(app, "policy: a loopback origin is refused at start-up", blocked.error === UPSTREAM_E_BLOCKED && blocked.errorText === "127.0.0.1 resolves to 127.0.0.1, which the outbound policy does not allow")
  const tag = new HttpRequest(400)
  const accepted: boolean = blocked.get(tag, "/") === UPSTREAM_E_NONE
  const r: UpstreamResponse | null = app.awaitCall(blocked)
  check(app, "policy: and each call fails UPSTREAM_E_BLOCKED with nothing connected", accepted && r !== null && !r.ok && r.req === tag && r.error === UPSTREAM_E_BLOCKED && mock.accepted === 0)
  const permitted = new UpstreamLimits()
  permitted.connections = 1
  const p = new OutboundPolicy()
  p.permit("127.0.0.1/32")
  permitted.outbound = p
  const allowed: Upstream = own(app, mock.origin(), 7, permitted)
  allowed.get(new HttpRequest(401), "/")
  const ok: UpstreamResponse | null = app.awaitCall(allowed)
  check(app, "policy: permitted, the same origin is called", allowed.error === UPSTREAM_E_NONE && ok !== null && ok.ok && mock.accepted === 1)
  const tls: Upstream = own(app, "https://127.0.0.1/", 8, new UpstreamLimits())
  const user: Upstream = own(app, `http://me@127.0.0.1:${mock.port}`, 8, new UpstreamLimits())
  const pathed: Upstream = own(app, `http://127.0.0.1:${mock.port}/api`, 8, new UpstreamLimits())
  check(app, "origin: https, userinfo and a path are each UPSTREAM_E_ORIGIN", tls.error === UPSTREAM_E_ORIGIN && user.error === UPSTREAM_E_ORIGIN && pathed.error === UPSTREAM_E_ORIGIN)
  allowed.get(new HttpRequest(402), "no slash")
  const bad: UpstreamResponse | null = app.awaitCall(allowed)
  check(app, "request: a path that is not a request target is UPSTREAM_E_REQUEST", bad !== null && !bad.ok && bad.error === UPSTREAM_E_REQUEST && mock.requests === 1)
}

const warmPool = (app: App): void => {
  const mock = new Mock()
  app.mocks.push(mock)
  const limits = new UpstreamLimits()
  limits.connections = 1
  limits.calls = 4
  const u: Upstream = own(app, mock.origin(), 9, limits)
  const tag = new HttpRequest(500)
  u.get(tag, "/")
  const first: UpstreamResponse | null = app.awaitCall(u)
  if (first === null) {
    check(app, "warm pool: the first call is answered", false)
    return
  }
  const body: u8[] = first.body
  u.release(first)
  const warm: boolean = warmCalls(app, u, tag, body, 1000)
  // Nothing between the two readings but the calls.
  const mark: i64 = Arena.mark()
  const used: i64 = Arena.used()
  const measured: boolean = warmCalls(app, u, tag, body, 2000)
  const markAfter: i64 = Arena.mark()
  const usedAfter: i64 = Arena.used()
  check(app, "warm pool: three thousand calls are answered", warm && measured && mock.requests === 3001)
  check(app, "warm pool: on the one connection, with every slot back and no body buffer grown", mock.accepted === 1 && u.pending() === 0 && u.openConnections() === 1)
  check(app, "warm pool: Arena.used() flat over two thousand calls past a thousand of warm-up", markAfter === mark && usedAfter === used)
  if (usedAfter !== used) {
    console.log(`      used ${used} before, ${usedAfter} after`)
  }
}

/** Makes `count` calls on `u` one after another; whether each answered `ok` in `body`. */
const warmCalls = (app: App, u: Upstream, tag: HttpRequest, body: u8[], count: i32): boolean => {
  let ok: boolean = true
  for (let k: i32 = 0; k < count && ok; k++) {
    if (u.get(tag, "/") !== UPSTREAM_E_NONE) {
      return false
    }
    const r: UpstreamResponse | null = app.awaitCall(u)
    if (r === null || !r.ok || r.body !== body || r.length !== 2) {
      ok = false
    }
    if (r !== null) {
      u.release(r)
    }
  }
  return ok
}

export function main(): i32 {
  const app = new App()
  slowUpstream(app)
  keepAlive(app)
  refusals(app)
  policy(app)
  warmPool(app)
  return app.failures === 0 ? 0 : 1
}
