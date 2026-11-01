// `PgCarrier` over loopback: an `HttpHandler`, the carrier and a stand-in
// PostgreSQL server, all on one thread. Each turn serves the stand-in, waits
// on the handler, hands the requests taken to the carrier and reads its
// events until `PG_CARRIER_NONE`.
//
// The stand-in speaks the protocol's extended query flow with no
// authentication: it answers Parse, Describe, Bind, Execute and Sync as a
// server does, holds an Execute of `slow` until told to go on, closes the
// connection on an Execute of `die` (and on a batch holding a key past 4999),
// and answers the batcher's statement with a row `v<key>` for each key below
// 1000.
//
//   1. Routing: a plain query's row answers its request, a batch of keys
//      answers each request with its own row, and a key with no row is 404.
//   2. The slow query: while one query is held by the server, another client
//      is answered.
//   3. Loss: a connection that ends under a plain query or a batch fails
//      them, and the next query is answered on a new connection.
//   4. The flat arena: four thousand queries, half of them batched, leave
//      `Arena.used()` unchanged.
//   5. Connects: a server that accepts and never answers fails the query at
//      the connect timeout, a port with no listener fails it at once, and a
//      full carrier answers PG_CARRIER_FULL.
import { copyBytes } from "nish/bytes"
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import {
  PG_CARRIER_BUILD,
  PG_CARRIER_DONE,
  PG_CARRIER_FAILED,
  PG_CARRIER_FULL,
  PG_CARRIER_MISSING,
  PG_CARRIER_NONE,
  PG_CARRIER_ROW,
  PG_ERR_CLOSED,
  PgBatchConfig,
  PgBatcher,
  PgCarrier,
  PgCarrierLimits,
  PgConfig,
  PgConnection,
  PgPool,
  pgTarget,
} from "nish/net/postgres"
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
  tcpAccept,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { secret, wipe } from "nish:secret"

const ZERO: i32 = 0
const AGAIN: i32 = -11
const FIVE_SECONDS: i64 = 5000000000
const MILLISECOND: i64 = 1000000

// The routes, in the order they are added, which are also the query tags.
const ECHO: i32 = 0
const SLOW: i32 = 1
const DIE: i32 = 2
const USERS: i32 = 3

// What a stand-in connection's bound statement is.
const KIND_OTHER: i32 = 0
const KIND_ECHO: i32 = 1
const KIND_SLOW: i32 = 2
const KIND_DIE: i32 = 3
const KIND_USERS: i32 = 4

const ascii = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(text.length)
  for (let k: i32 = 0; k < toI32(text.length) && k < toI32(out.length); k++) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

/** Whether `buf[at ..)` holds `name` and then a NUL. */
const cstrIs = (buf: u8[], at: i32, end: i32, name: u8[]): boolean => {
  const n: i32 = toI32(name.length)
  if (at < 0 || at + n >= end || end > toI32(buf.length)) {
    return false
  }
  for (let k: i32 = 0; k < n; k++) {
    if (buf[at + k] !== name[k]) {
      return false
    }
  }
  return toI32(buf[at + n]) === 0
}

/** Where the NUL ending the string at `at` is, or `end`. */
const cstrEnd = (buf: u8[], at: i32, end: i32): i32 => {
  let k: i32 = at
  while (k >= 0 && k < end && k < toI32(buf.length) && toI32(buf[k]) !== 0) {
    k += 1
  }
  return k
}

const be32 = (buf: u8[], at: i32): i32 =>
  (toI32(buf[at]) << 24) | (toI32(buf[at + 1]) << 16) | (toI32(buf[at + 2]) << 8) | toI32(buf[at + 3])

const be16 = (buf: u8[], at: i32): i32 => (toI32(buf[at]) << 8) | toI32(buf[at + 1])

/** One connection the stand-in accepted: what it read and has to write, and its bound statement. */
class BackendConn {
  input: u8[]
  output: u8[]
  param: u8[]
  fd: i32 = -1
  inLen: i32 = 0
  outStart: i32 = 0
  outLen: i32 = 0
  lenAt: i32 = 0
  paramLen: i32 = 0
  kind: i32 = 0
  started: boolean = false

  constructor() {
    this.input = new Array<u8>(65536)
    this.output = new Array<u8>(65536)
    this.param = new Array<u8>(1024)
  }

  byte(b: i32): void {
    this.output[this.outLen] = toU8(b & 255)
    this.outLen += 1
  }

  int16(v: i32): void {
    this.byte(v >> 8)
    this.byte(v)
  }

  int32(v: i32): void {
    this.byte(v >> 24)
    this.byte(v >> 16)
    this.byte(v >> 8)
    this.byte(v)
  }

  setInt32(at: i32, v: i32): void {
    this.output[at] = toU8((v >> 24) & 255)
    this.output[at + 1] = toU8((v >> 16) & 255)
    this.output[at + 2] = toU8((v >> 8) & 255)
    this.output[at + 3] = toU8(v & 255)
  }

  begin(type: i32): void {
    this.byte(type)
    this.lenAt = this.outLen
    this.int32(ZERO)
  }

  end(): void {
    this.setInt32(this.lenAt, this.outLen - this.lenAt)
  }

  text(s: u8[]): void {
    for (let k: i32 = 0; k < toI32(s.length); k++) {
      this.byte(toI32(s[k]))
    }
  }

  digits(n: i32): void {
    if (n >= 10) {
      this.digits(n / 10)
    }
    this.byte(48 + (n % 10))
  }

  /** A one-column DataRow of `bytes[off, off + len)`. */
  row(bytes: u8[], off: i32, len: i32): void {
    this.begin(68)
    this.int16(toI32(1))
    this.int32(len)
    for (let k: i32 = 0; k < len; k++) {
      this.byte(toI32(bytes[off + k]))
    }
    this.end()
  }

  /** A CommandComplete `SELECT n`. */
  complete(n: i32): void {
    this.begin(67)
    this.byte(83)
    this.byte(69)
    this.byte(76)
    this.byte(69)
    this.byte(67)
    this.byte(84)
    this.byte(32)
    this.digits(n)
    this.byte(0)
    this.end()
  }
}

/** The stand-in server: a listener and the connections it accepted. */
class Backend {
  conns: BackendConn[]
  names: u8[][]
  peer: u8[]
  listener: i32
  port: i32
  /** Whether an Execute of `slow` is answered, and whether one is waiting. */
  release: boolean = false
  holding: boolean = false
  /** How many connections it accepted, and how many it closed under a query. */
  accepted: i32 = 0
  killed: i32 = 0

  constructor() {
    this.listener = tcpListen("127.0.0.1", 0, 16)
    this.port = netLocalPort(this.listener)
    this.conns = []
    for (let k: i32 = 0; k < 8; k++) {
      this.conns.push(new BackendConn())
    }
    this.names = [ascii("echo"), ascii("slow"), ascii("die"), ascii("users")]
    this.peer = new Array<u8>(32)
  }

  serve(): void {
    let fd: i32 = tcpAccept(this.listener, this.peer)
    while (fd >= 0) {
      let placed: boolean = false
      for (let k: i32 = 0; k < toI32(this.conns.length) && !placed; k++) {
        const c: BackendConn = this.conns[k]
        if (c.fd < 0) {
          c.fd = fd
          c.inLen = 0
          c.outStart = 0
          c.outLen = 0
          c.started = false
          placed = true
        }
      }
      if (!placed) {
        netClose(fd)
      }
      this.accepted += 1
      fd = tcpAccept(this.listener, this.peer)
    }
    for (let k: i32 = 0; k < toI32(this.conns.length); k++) {
      const c: BackendConn = this.conns[k]
      if (c.fd < 0) {
        continue
      }
      const got: i32 = netRead(c.fd, c.input, c.inLen, toI32(c.input.length) - c.inLen)
      if (got === 0 || (got < 0 && got !== AGAIN)) {
        this.close(c)
        continue
      }
      if (got > 0) {
        c.inLen += got
      }
      this.process(c)
      if (c.fd >= 0 && c.outLen > c.outStart) {
        const n: i32 = netWrite(c.fd, c.output, c.outStart, c.outLen - c.outStart)
        if (n > 0) {
          c.outStart += n
        }
        if (c.outStart === c.outLen) {
          c.outStart = 0
          c.outLen = 0
        }
      }
    }
  }

  close(c: BackendConn): void {
    netClose(c.fd)
    c.fd = -1
  }

  kindOf(buf: u8[], at: i32, end: i32): i32 {
    for (let k: i32 = 0; k < toI32(this.names.length); k++) {
      if (cstrIs(buf, at, end, this.names[k])) {
        return k + 1
      }
    }
    return KIND_OTHER
  }

  /** Answers every whole message `c` read, stopping at an Execute it holds. */
  process(c: BackendConn): void {
    const input: u8[] = c.input
    let at: i32 = 0
    if (!c.started) {
      if (c.inLen < 4 || c.inLen < be32(input, ZERO)) {
        return
      }
      at = be32(input, ZERO)
      c.started = true
      c.begin(82)
      c.int32(ZERO)
      c.end()
      c.begin(83)
      c.text(ascii("client_encoding"))
      c.byte(0)
      c.text(ascii("UTF8"))
      c.byte(0)
      c.end()
      c.begin(75)
      c.int32(toI32(4242))
      c.int32(toI32(7))
      c.end()
      c.begin(90)
      c.byte(73)
      c.end()
    }
    while (c.fd >= 0 && c.inLen - at >= 5 && at >= 0 && at < toI32(input.length)) {
      const type: i32 = toI32(input[at])
      const end: i32 = at + 1 + be32(input, at + 1)
      if (end > c.inLen) {
        break
      }
      const body: i32 = at + 5
      if (type === 80) {
        // Parse
        c.begin(49)
        c.end()
      } else if (type === 68) {
        // Describe: no parameters, and NoData.
        c.begin(116)
        c.int16(ZERO)
        c.end()
        c.begin(110)
        c.end()
      } else if (type === 66) {
        // Bind: the statement and its first parameter.
        const stmt: i32 = cstrEnd(input, body, end) + 1
        c.kind = this.kindOf(input, stmt, end)
        let p: i32 = cstrEnd(input, stmt, end) + 1
        p += 2 + 2 * be16(input, p)
        const params: i32 = be16(input, p)
        p += 2
        c.paramLen = 0
        if (params > 0) {
          const len: i32 = be32(input, p)
          p += 4
          if (len > 0 && len <= toI32(c.param.length)) {
            copyBytes(c.param, ZERO, input, p, len)
            c.paramLen = len
          }
        }
        c.begin(50)
        c.end()
      } else if (type === 69) {
        // Execute
        if (c.kind === KIND_SLOW && !this.release) {
          this.holding = true
          break
        }
        if (c.kind === KIND_DIE || (c.kind === KIND_USERS && this.fatal(c))) {
          this.killed += 1
          this.close(c)
          return
        }
        this.execute(c)
      } else if (type === 83) {
        // Sync
        c.begin(90)
        c.byte(73)
        c.end()
      } else if (type === 88) {
        this.close(c)
        return
      }
      at = end
    }
    if (at > 0) {
      copyBytes(input, ZERO, input, at, c.inLen - at)
      c.inLen -= at
    }
  }

  /** Whether the batch `c` bound holds a key past 4999. */
  fatal(c: BackendConn): boolean {
    let key: i32 = 0
    for (let k: i32 = 0; k < c.paramLen; k++) {
      const d: i32 = toI32(c.param[k])
      if (d >= 48 && d <= 57) {
        key = key * 10 + d - 48
        if (key > 4999) {
          return true
        }
      } else {
        key = 0
      }
    }
    return false
  }

  execute(c: BackendConn): void {
    if (c.kind === KIND_ECHO) {
      c.row(c.param, ZERO, c.paramLen)
      c.complete(toI32(1))
    } else if (c.kind === KIND_SLOW) {
      this.holding = false
      c.row(this.names[1], ZERO, toI32(4))
      c.complete(toI32(1))
    } else if (c.kind === KIND_USERS) {
      // `{5,6,2000}`: a row `v<key>`, ordinal, for each key below 1000.
      let rows: i32 = 0
      let ord: i32 = 0
      let key: i32 = 0
      for (let k: i32 = 0; k < c.paramLen; k++) {
        const d: i32 = toI32(c.param[k])
        if (d >= 48 && d <= 57) {
          key = key * 10 + d - 48
        } else if (d === 44 || d === 125) {
          ord += 1
          if (key < 1000) {
            c.begin(68)
            c.int16(toI32(2))
            const valueAt: i32 = c.outLen
            c.int32(ZERO)
            c.byte(118)
            c.digits(key)
            c.setInt32(valueAt, c.outLen - valueAt - 4)
            const ordAt: i32 = c.outLen
            c.int32(ZERO)
            c.digits(ord)
            c.setInt32(ordAt, c.outLen - ordAt - 4)
            c.end()
            rows += 1
          }
          key = 0
        }
      }
      c.complete(rows)
    } else {
      c.complete(ZERO)
    }
  }
}

/** The server half: the handler, the carrier and what the program answered. */
class App {
  h: HttpHandler
  carrier: PgCarrier
  pool: PgPool
  backend: Backend
  answered: boolean[]
  text: u8[]
  none: u8[]
  headEnd: u8[]
  contentLength: u8[]
  port: i32 = 0
  users: i32 = 0
  failures: i32 = 0
  /** Behind the last query that failed: its tag, `failure` and `socketError`. */
  lastFailedTag: i32 = -1
  lastFailure: i32 = 0
  lastSocketError: i32 = 0
  full: i32 = 0

  constructor() {
    const router = new Router(new RouterLimits())
    router.add("GET", "/echo/:n")
    router.add("GET", "/slow")
    router.add("GET", "/die")
    router.add("GET", "/users/:id")
    const limits = new HandlerLimits()
    limits.slots = 8
    const listener: i32 = tcpListen("127.0.0.1", 0, 64)
    this.port = netLocalPort(listener)
    this.h = new HttpHandler(limits, listener, router)
    this.backend = new Backend()
    const config = new PgConfig()
    config.user = "app"
    config.database = "db"
    // One query a connection, so that a held one keeps its connection busy.
    config.maxInFlight = 1
    const password = secret(ascii("pw"))
    this.pool = new PgPool(config, password, toI32(2), toI32(64))
    wipe(password)
    const types: i32[] = []
    this.pool.register("echo", "select $1::text", types)
    this.pool.register("slow", "select 'slow'", types)
    this.pool.register("die", "select 'die'", types)
    const carrierLimits = new PgCarrierLimits()
    this.carrier = new PgCarrier(carrierLimits, this.pool, pgTarget("127.0.0.1", this.backend.port), this.h)
    const batch = new PgBatchConfig()
    batch.name = "users"
    batch.select = "select 'v' || q.key"
    this.users = this.carrier.attach(new PgBatcher(batch))
    this.answered = new Array<boolean>(carrierLimits.queries)
    this.text = ascii("text/plain")
    this.none = new Array<u8>(1)
    this.headEnd = ascii("\r\n\r\n")
    this.contentLength = ascii("\r\ncontent-length: ")
  }

  /** One turn: the stand-in, the handler, the requests taken, then the carrier's events. */
  turn(): void {
    this.backend.serve()
    this.h.wait(toI32(1))
    while (this.h.ready()) {
      this.take(this.h.take())
    }
    this.events()
  }

  take(req: HttpRequest): void {
    let q: i32 = PG_CARRIER_FULL
    if (req.route === USERS) {
      q = this.carrier.runInt(req, this.users, toI64(req.paramDecimal(ZERO)), USERS)
    } else if (req.route === ECHO || req.route === SLOW || req.route === DIE) {
      q = this.carrier.run(req, req.route)
    } else {
      this.h.refuse(req)
      return
    }
    if (q === PG_CARRIER_FULL) {
      this.full += 1
      this.h.send(req, 503, this.text, this.none, ZERO, ZERO)
    }
  }

  events(): void {
    const c: PgCarrier = this.carrier
    let event: i32 = c.next()
    while (event !== PG_CARRIER_NONE) {
      if (event === PG_CARRIER_BUILD) {
        const conn: PgConnection = c.connection()
        if (c.tag === ECHO) {
          conn.bindStart("echo")
          conn.paramInt(toI64(c.request().paramDecimal(ZERO)))
        } else if (c.tag === SLOW) {
          conn.bindStart("slow")
        } else {
          conn.bindStart("die")
        }
        conn.bindEnd()
        c.send()
      } else if (event === PG_CARRIER_ROW) {
        const conn: PgConnection = c.connection()
        this.h.send(c.request(), 200, this.text, conn.inputBuffer(), conn.colStart(ZERO), conn.colLength(ZERO))
        this.answered[c.query] = true
      } else if (event === PG_CARRIER_DONE || event === PG_CARRIER_MISSING || event === PG_CARRIER_FAILED) {
        if (event === PG_CARRIER_FAILED) {
          this.lastFailedTag = c.tag
          this.lastFailure = c.failure
          this.lastSocketError = c.socketError
        }
        if (!this.answered[c.query]) {
          const status: i32 = event === PG_CARRIER_MISSING ? 404 : event === PG_CARRIER_FAILED ? 503 : 204
          this.h.send(c.request(), status, this.text, this.none, ZERO, ZERO)
        }
        this.answered[c.query] = false
      }
      event = c.next()
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
  bodyLength: i32 = 0
  responseLength: i32 = 0
  closed: boolean = false

  constructor() {
    this.buf = new Array<u8>(65536)
  }
}

/** Where `text`, in lower case, first appears in `buf[from .. end)` in any case, or -1. */
const find = (buf: u8[], from: i32, end: i32, text: u8[]): i32 => {
  const n: i32 = toI32(text.length)
  for (let at: i32 = from; at + n <= end; at++) {
    let k: i32 = 0
    while (k < n && (toI32(buf[at + k]) | (toI32(text[k]) >= 97 ? 32 : 0)) === toI32(text[k])) {
      k += 1
    }
    if (k === n) {
      return at
    }
  }
  return -1
}

const STATUS_AT: i32 = 9

/** The decimal at `buf[at ..)`. */
const decimal = (buf: u8[], at: i32, end: i32): i32 => {
  let n: i32 = 0
  let k: i32 = at
  while (k >= 0 && k < end && k < toI32(buf.length) && toI32(buf[k]) >= 48 && toI32(buf[k]) <= 57) {
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

/** Sends all of `bytes`, turning the app while the socket is full. */
const sendAll = (app: App, c: Client, bytes: u8[]): void => {
  let at: i32 = 0
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (at < toI32(bytes.length) && monotonicNanos() < deadline) {
    const n: i32 = netWrite(c.fd, bytes, at, toI32(bytes.length) - at)
    if (n > 0) {
      at += n
    } else {
      app.turn()
    }
  }
}

/** Reads what has arrived. */
const pull = (c: Client): void => {
  const room: i32 = toI32(c.buf.length) - c.length
  if (room <= 0) {
    return
  }
  const n: i32 = netRead(c.fd, c.buf, c.length, room)
  if (n > 0) {
    c.length += n
  } else if (n === 0) {
    c.closed = true
  }
}

/** Whether a whole response has arrived; with its status and body in `c` when so. */
const whole = (app: App, c: Client): boolean => {
  const headEnd: i32 = find(c.buf, ZERO, c.length, app.headEnd)
  if (headEnd < 0) {
    return false
  }
  const at: i32 = find(c.buf, ZERO, headEnd, app.contentLength)
  const length: i32 = at < 0 ? 0 : decimal(c.buf, at + toI32(app.contentLength.length), headEnd)
  if (c.length - headEnd - 4 < length) {
    return false
  }
  c.status = decimal(c.buf, STATUS_AT, headEnd)
  c.bodyStart = headEnd + 4
  c.bodyLength = length
  c.responseLength = headEnd + 4 + length
  return true
}

/** Reads one response, turning the app until it is whole or five seconds pass. */
const response = (app: App, c: Client): boolean => {
  if (c.responseLength > 0) {
    copyBytes(c.buf, ZERO, c.buf, c.responseLength, c.length - c.responseLength)
    c.length -= c.responseLength
    c.responseLength = 0
  }
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline && !c.closed) {
    if (whole(app, c)) {
      return true
    }
    app.turn()
    pull(c)
  }
  return whole(app, c)
}

/** Whether the last response is `status` with the body `body`. */
const answer = (c: Client, status: i32, body: u8[]): boolean => {
  if (c.status !== status || c.bodyLength !== toI32(body.length)) {
    return false
  }
  for (let k: i32 = 0; k < c.bodyLength && k < toI32(body.length); k++) {
    if (c.buf[c.bodyStart + k] !== body[k]) {
      return false
    }
  }
  return true
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
  sendAll(app, c, ascii("GET /echo/41 HTTP/1.1\r\nHost: t\r\n\r\n"))
  check(app, "a plain query's row answers its request", response(app, c) && answer(c, 200, ascii("41")))
  sendAll(app, c, ascii("GET /users/5 HTTP/1.1\r\nHost: t\r\n\r\nGET /users/2000 HTTP/1.1\r\nHost: t\r\n\r\nGET /users/7 HTTP/1.1\r\nHost: t\r\n\r\n"))
  check(app, "a batched key's row answers its own request", response(app, c) && answer(c, 200, ascii("v5")))
  check(app, "a key with no row is the program's 404", response(app, c) && answer(c, 404, ascii("")))
  check(app, "and the key after it still gets its row", response(app, c) && answer(c, 200, ascii("v7")))
  netClose(c.fd)
}

const slowQuery = (app: App): void => {
  const held = connect(app)
  sendAll(app, held, ascii("GET /slow HTTP/1.1\r\nHost: t\r\n\r\n"))
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (!app.backend.holding && monotonicNanos() < deadline) {
    app.turn()
  }
  check(app, "the server holds the slow query", app.backend.holding)
  const other = connect(app)
  sendAll(app, other, ascii("GET /echo/7 HTTP/1.1\r\nHost: t\r\n\r\n"))
  check(app, "another client is answered while it is held", response(app, other) && answer(other, 200, ascii("7")))
  pull(held)
  check(app, "and the held one has no answer yet", held.length === 0 && app.backend.holding)
  app.backend.release = true
  check(app, "once the server goes on, the held client is answered", response(app, held) && answer(held, 200, ascii("slow")))
  app.backend.release = false
  netClose(held.fd)
  netClose(other.fd)
}

const loss = (app: App): void => {
  const c = connect(app)
  const accepted: i32 = app.backend.accepted
  sendAll(app, c, ascii("GET /die HTTP/1.1\r\nHost: t\r\n\r\n"))
  check(app, "a query whose connection ends is the program's 503", response(app, c) && answer(c, 503, ascii("")))
  check(app, "with the connection closed behind it", app.lastFailedTag === DIE && app.lastFailure === PG_ERR_CLOSED && app.lastSocketError === 0)
  sendAll(app, c, ascii("GET /users/5001 HTTP/1.1\r\nHost: t\r\n\r\n"))
  check(app, "a batch whose connection ends fails its request", response(app, c) && answer(c, 503, ascii("")))
  check(app, "as lost with the connection", app.lastFailedTag === USERS && app.lastFailure === PG_ERR_CLOSED)
  sendAll(app, c, ascii("GET /echo/3 HTTP/1.1\r\nHost: t\r\n\r\nGET /users/8 HTTP/1.1\r\nHost: t\r\n\r\n"))
  check(app, "the next plain query is answered", response(app, c) && answer(c, 200, ascii("3")))
  check(app, "and the next batch", response(app, c) && answer(c, 200, ascii("v8")))
  check(app, "on new connections", app.backend.killed === 2 && app.backend.accepted > accepted)
  netClose(c.fd)
}

const flat = (app: App): void => {
  const c = connect(app)
  const request: u8[] = ascii(
    "GET /echo/12 HTTP/1.1\r\nHost: t\r\n\r\nGET /users/5 HTTP/1.1\r\nHost: t\r\n\r\nGET /users/6 HTTP/1.1\r\nHost: t\r\n\r\nGET /users/2000 HTTP/1.1\r\nHost: t\r\n\r\n",
  )
  const twelve: u8[] = ascii("12")
  const v5: u8[] = ascii("v5")
  const v6: u8[] = ascii("v6")
  const empty: u8[] = ascii("")
  let good: i32 = 0
  for (let round: i32 = 0; round < 100; round++) {
    sendAll(app, c, request)
    if (
      response(app, c) &&
      answer(c, 200, twelve) &&
      response(app, c) &&
      answer(c, 200, v5) &&
      response(app, c) &&
      answer(c, 200, v6) &&
      response(app, c) &&
      answer(c, 404, empty)
    ) {
      good += 1
    }
  }
  const before: i64 = Arena.used()
  for (let round: i32 = 0; round < 1000; round++) {
    sendAll(app, c, request)
    if (
      response(app, c) &&
      answer(c, 200, twelve) &&
      response(app, c) &&
      answer(c, 200, v5) &&
      response(app, c) &&
      answer(c, 200, v6) &&
      response(app, c) &&
      answer(c, 404, empty)
    ) {
      good += 1
    }
  }
  const kept: i64 = Arena.used() - before
  check(app, "every round of four pipelined queries is answered", good === 1100)
  check(app, "and the arena stays flat", kept === toI64(0))
  check(app, "and none was refused for room", app.full === 0)
  netClose(c.fd)
}

/** A carrier of its own on `app`'s handler, to a server at `port` that answers nothing. */
const quiet = (app: App, port: i32, watch: i32, timeoutMs: i32): PgCarrier => {
  const config = new PgConfig()
  config.user = "app"
  config.database = "db"
  const password = secret(ascii("pw"))
  const pool = new PgPool(config, password, toI32(1), toI32(4))
  wipe(password)
  const limits = new PgCarrierLimits()
  limits.queries = 1
  limits.watch = watch
  limits.connectTimeoutMs = timeoutMs
  return new PgCarrier(limits, pool, pgTarget("127.0.0.1", port), app.h)
}

/** Turns `app` and reads `c` until its query's final event, for five seconds at most. */
const final = (app: App, c: PgCarrier): i32 => {
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  while (monotonicNanos() < deadline) {
    app.turn()
    let event: i32 = c.next()
    while (event !== PG_CARRIER_NONE) {
      if (event === PG_CARRIER_BUILD) {
        c.connection().bindStart("none")
        c.connection().bindEnd()
        c.send()
      } else if (event === PG_CARRIER_DONE || event === PG_CARRIER_FAILED || event === PG_CARRIER_MISSING) {
        return event
      }
      event = c.next()
    }
  }
  return PG_CARRIER_NONE
}

const connects = (app: App): void => {
  // A listener nobody accepts from: the kernel completes the connect, and
  // the startup message is never answered.
  const silent: i32 = tcpListen("127.0.0.1", 0, 4)
  const timed: PgCarrier = quiet(app, netLocalPort(silent), toI32(1), toI32(100))
  const start: i64 = monotonicNanos()
  check(app, "a query is taken", timed.run(null, toI32(9)) === 0)
  check(app, "past the queries cap the carrier is full", timed.run(null, toI32(10)) === PG_CARRIER_FULL)
  const event: i32 = final(app, timed)
  const waited: i64 = monotonicNanos() - start
  check(app, "a server that never answers fails the query", event === PG_CARRIER_FAILED && timed.tag === 9)
  check(app, "at the connect timeout, as ETIMEDOUT", timed.socketError === -110 && timed.failure === PG_ERR_CLOSED)
  check(app, "not before it", waited >= toI64(100) * MILLISECOND && waited < FIVE_SECONDS)
  check(app, "its query is held until the next read", timed.run(null, toI32(11)) === PG_CARRIER_FULL)
  check(app, "and once read past, it takes another", timed.next() === PG_CARRIER_NONE && timed.run(null, toI32(11)) === 0)
  timed.close()
  netClose(silent)

  // A port with nothing listening: the connect fails at once.
  const gone: i32 = tcpListen("127.0.0.1", 0, 4)
  const port: i32 = netLocalPort(gone)
  netClose(gone)
  const refused: PgCarrier = quiet(app, port, toI32(2), toI32(5000))
  refused.run(null, toI32(4))
  const at: i64 = monotonicNanos()
  check(app, "a refused connect fails the query", final(app, refused) === PG_CARRIER_FAILED && refused.socketError === -111)
  check(app, "without waiting for the timeout", monotonicNanos() - at < toI64(1000) * MILLISECOND)
  refused.close()
}

export const main = (): i32 => {
  const app = new App()
  routing(app)
  slowQuery(app)
  loss(app)
  flat(app)
  connects(app)
  app.carrier.close()
  app.pool.dispose()
  return app.failures === 0 ? 0 : 1
}
