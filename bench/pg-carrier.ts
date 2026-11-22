// nish/net/postgres-carrier's event loop under an instruction count: a
// PgCarrier on an HttpHandler, and a stand-in PostgreSQL server in the same
// process over loopback, all on one thread, as
// tests/link/std_postgres_carrier drives one. Each of `n` rounds queues
// eight plain queries and eight int8 keys on an attached PgBatcher (queries
// of the program's own, with no request), then turns until every one has
// had its final event: the stand-in serves, the handler waits without
// blocking, and the carrier's events are read. A plain query's
// PG_CARRIER_BUILD binds one int8 parameter, which the stand-in answers as
// a one-column row; the eight keys go out in one execution, answered with a
// two-column row for each key below 1000. It reaches the carrier's dispatch,
// Bind/Execute build and DataRow routing, and the PgConnection decode
// beneath them, whose panic sites the std/ ratchet counts in
// std/net/postgres-carrier.ts and std/net/postgres.ts, so a fix to one of
// them shows here as a count that holds or falls. It prints the fold of
// every row read and the count of each final event.
import { copyBytes } from "nish/bytes"
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { PgBatchConfig, PgBatcher, PgConfig, PgConnection, PgPool, pgTarget } from "nish/net/postgres"
import {
  PG_CARRIER_BUILD,
  PG_CARRIER_DONE,
  PG_CARRIER_FAILED,
  PG_CARRIER_FULL,
  PG_CARRIER_MISSING,
  PG_CARRIER_NONE,
  PG_CARRIER_ROW,
  PgCarrier,
  PgCarrierLimits,
} from "nish/net/postgres-carrier"
import { Router, RouterLimits } from "nish/net/router"
import { netClose, netLocalPort, netRead, netWrite, tcpAccept, tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"

const ZERO: i32 = 0
/** `netRead`: nothing to read now. */
const AGAIN: i32 = -11
/** The plain queries and the batched keys each round queues. */
const PLAIN: i32 = 8
const KEYS: i32 = 8
/** The query tags. */
const ECHO: i32 = 0
const USERS: i32 = 1
/** What a stand-in connection's bound statement is. */
const KIND_OTHER: i32 = 0
const KIND_ECHO: i32 = 1
const KIND_USERS: i32 = 2
/** The most turns one round may take before the bench gives up on it. */
const TURNS: i32 = 10000

/** One byte into FNV-1a 32. */
const mix = (h: u32, b: i32): u32 => (h ^ toU32(b & 255)) * 16777619

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

  /** A CommandComplete `SELECT n`. */
  complete(n: i32): void {
    this.begin(67)
    this.text(ascii("SELECT "))
    this.digits(n)
    this.byte(0)
    this.end()
  }
}

/** The stand-in server: a listener and the connections it accepted. */
class Backend {
  conns: BackendConn[]
  echo: u8[]
  users: u8[]
  peer: u8[]
  listener: i32
  port: i32

  constructor() {
    this.listener = tcpListen("127.0.0.1", 0, 16)
    this.port = netLocalPort(this.listener)
    this.conns = []
    for (let k: i32 = 0; k < 4; k++) {
      this.conns.push(new BackendConn())
    }
    this.echo = ascii("echo")
    this.users = ascii("users")
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
      fd = tcpAccept(this.listener, this.peer)
    }
    for (let k: i32 = 0; k < toI32(this.conns.length); k++) {
      const c: BackendConn = this.conns[k]
      if (c.fd < 0) {
        continue
      }
      const got: i32 = netRead(c.fd, c.input, c.inLen, toI32(c.input.length) - c.inLen)
      if (got === 0 || (got < 0 && got !== AGAIN)) {
        netClose(c.fd)
        c.fd = -1
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

  /** Answers every whole message `c` read: the startup with no authentication, then the extended query flow. */
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
    while (c.inLen - at >= 5 && at >= 0 && at < toI32(input.length)) {
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
        c.kind = KIND_OTHER
        if (cstrIs(input, stmt, end, this.echo)) {
          c.kind = KIND_ECHO
        } else if (cstrIs(input, stmt, end, this.users)) {
          c.kind = KIND_USERS
        }
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
        this.execute(c)
      } else if (type === 83) {
        // Sync
        c.begin(90)
        c.byte(73)
        c.end()
      }
      at = end
    }
    if (at > 0) {
      copyBytes(input, ZERO, input, at, c.inLen - at)
      c.inLen -= at
    }
  }

  /** An Execute: the echoed parameter as one row, or a row `v<key>`, ordinal, for each batched key below 1000. */
  execute(c: BackendConn): void {
    if (c.kind === KIND_ECHO) {
      c.begin(68)
      c.int16(toI32(1))
      c.int32(c.paramLen)
      for (let k: i32 = 0; k < c.paramLen; k++) {
        c.byte(toI32(c.param[k]))
      }
      c.end()
      c.complete(toI32(1))
    } else if (c.kind === KIND_USERS) {
      // `{5,6,2000}`
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

/** The handler, the carrier and the stand-in, and what the rounds read. */
class App {
  h: HttpHandler
  carrier: PgCarrier
  pool: PgPool
  backend: Backend
  users: i32 = 0
  fold: u32 = 2166136261
  /** The final events seen: done, missing and failed. */
  done: i32 = 0
  missing: i32 = 0
  failed: i32 = 0
  full: i32 = 0
  /** The next plain query's parameter. */
  value: i64 = 0

  constructor() {
    const router = new Router(new RouterLimits())
    router.add("GET", "/")
    const limits = new HandlerLimits()
    limits.slots = 4
    const listener: i32 = tcpListen("127.0.0.1", 0, 4)
    this.h = new HttpHandler(limits, listener, router)
    this.backend = new Backend()
    const config = new PgConfig()
    config.user = "app"
    config.database = "db"
    const password = secret(ascii("pw"))
    this.pool = new PgPool(config, password, toI32(2), toI32(64))
    wipe(password)
    const types: i32[] = []
    this.pool.register("echo", "select $1::int8", types)
    this.carrier = new PgCarrier(
      new PgCarrierLimits(),
      this.pool,
      pgTarget("127.0.0.1", this.backend.port),
      this.h
    )
    const batch = new PgBatchConfig()
    batch.name = "users"
    batch.select = "select 'v' || q.key"
    this.users = this.carrier.attach(new PgBatcher(batch))
  }

  /** The final events seen so far. */
  ended(): i32 {
    return this.done + this.missing + this.failed
  }

  /** One turn: the stand-in, the handler without blocking, then the carrier's events. */
  turn(): void {
    this.backend.serve()
    this.h.wait(ZERO)
    const c: PgCarrier = this.carrier
    let event: i32 = c.next()
    while (event !== PG_CARRIER_NONE) {
      if (event === PG_CARRIER_BUILD) {
        const conn: PgConnection = c.connection()
        conn.bindStart("echo")
        conn.paramInt(this.value)
        this.value += 7919
        conn.bindEnd()
        c.send()
      } else if (event === PG_CARRIER_ROW) {
        const conn: PgConnection = c.connection()
        const buf: u8[] = conn.inputBuffer()
        let h: u32 = mix(this.fold, c.tag)
        for (let col: i32 = 0; col < conn.columns; col++) {
          const start: i32 = conn.colStart(col)
          const end: i32 = start + conn.colLength(col)
          for (let k: i32 = start; k >= 0 && k < end && k < toI32(buf.length); k++) {
            h = mix(h, toI32(buf[k]))
          }
        }
        this.fold = h
      } else if (event === PG_CARRIER_DONE) {
        this.done += 1
      } else if (event === PG_CARRIER_MISSING) {
        this.missing += 1
      } else if (event === PG_CARRIER_FAILED) {
        this.failed += 1
      }
      event = c.next()
    }
  }

  /** One round: the plain queries and the keys, then turns until each has ended. */
  round(r: i32): boolean {
    const want: i32 = this.ended() + PLAIN + KEYS
    for (let k: i32 = 0; k < PLAIN; k++) {
      if (this.carrier.run(null, ECHO) === PG_CARRIER_FULL) {
        this.full += 1
        return false
      }
    }
    for (let k: i32 = 0; k < KEYS; k++) {
      // Keys 0 to 1199: one in six has no row and ends PG_CARRIER_MISSING.
      const key: i64 = toI64((r * KEYS + k) % 1200)
      if (this.carrier.runInt(null, this.users, key, USERS) === PG_CARRIER_FULL) {
        this.full += 1
        return false
      }
    }
    for (let t: i32 = 0; t < TURNS && this.ended() < want; t++) {
      this.turn()
    }
    return this.ended() === want
  }
}

export const main = (): i32 => {
  const n: i32 = 1500 // bench:n
  const app = new App()
  let good: i32 = 0
  for (let r: i32 = 0; r < n; r++) {
    if (app.round(r)) {
      good += 1
    }
  }
  console.log(
    `${toI64(app.fold)} rounds=${good}/${n} done=${app.done} missing=${app.missing} failed=${app.failed} full=${app.full}`
  )
  app.carrier.close()
  app.pool.dispose()
  return good === n && app.failed === 0 ? 0 : 1
}
