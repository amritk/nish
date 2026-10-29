// The live checks of nish/net/postgres's PgPool, against a real server:
//
//   live <scenario> <port> <user> <password> <database> [sql ...]
//
// Every connection sets `search_path=nish_live`, the schema `exec` builds.
// `run.mjs` runs each scenario and compares its output with `expected/`.
//
//   exec        runs each `sql` argument, one group each, in order
//   auth        a query as the user; then a wrong password, 28P01
//   groups      100 groups through a pool of 4, 16 in flight a connection;
//               a 23505 fails only its own group
//   terminate   pg_terminate_backend on a pooled connection from another
//               pool; the slot is built again on its next request
//   pipeline    an error in the middle of five pipelined groups
//   arrays      text[], int8[] and int4[] parameters, unnested by the server
//   binary      one statement's rows in binary and in text, read alike
//   conduit     the Conduit article list, prepared once and run pipelined
//   batch       keyed reads through PgBatcher: users by id, articles by slug,
//               tags by article; duplicate and missing keys, two takes
//
// The `conduit` statement is the multicore server challenge's SPEC.md
// `ARTICLE_LIST_SELECT ORDER_PAGE`,
// https://github.com/arjaythedev/multicore-server-challenge/blob/c301225/SPEC.md.
// Copyright (c) 2026 arjaythedev and the challenge contributors. MIT License;
// see tests/postgres/live/LICENSE.md.
import { connectResult, netAddress, netClose, netRead, netWrite, pollAdd, pollCreate, pollModify, pollRemove, pollWait, tcpConnect } from "nish:net"
import { secret, wipe } from "nish:secret"
import {
  PG_ARRAY_ELEMENT,
  PG_BATCH_DONE,
  PG_BATCH_FAILED,
  PG_BATCH_INT,
  PG_BATCH_MISSING,
  PG_BATCH_NONE,
  PG_BATCH_ROW,
  PG_BATCH_TEXT,
  PG_COMPLETE,
  PG_ARRAY_END,
  PG_ARRAY_NULL,
  PG_ERROR,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_LOST,
  PG_NEED_MORE,
  PG_POOL_NONE,
  PG_ROW,
  PgArrayWalker,
  PgBatchConfig,
  PgBatcher,
  PgConfig,
  PgConnection,
  PgPool,
} from "nish/net/postgres"

const WANT_READ: i32 = 1
const WANT_WRITE: i32 = 2
/** `pollWait`'s readable and hangup bits. */
const READABLE: i32 = 5
/** `netRead` and `netWrite`: nothing to do now. */
const AGAIN: i32 = -11
/** A statement whose parameters, if any, the server infers. */
const noTypes = (): i32[] => new Array<i32>(0)
/** How long one `pump` waits for the server, in milliseconds. */
const PATIENCE: i32 = 10000

/** A pool slot's socket: live from `connect` until its `PG_FAILED`. */
class Socket {
  fd: i32 = -1
  live: boolean = false
  connected: boolean = false
}

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** Writes what `conn` queued; false when the socket is gone. */
const flush = (conn: PgConnection, fd: i32): boolean => {
  while (conn.outputEnd() > conn.outputStart()) {
    const n: i32 = netWrite(fd, conn.outputBuffer(), conn.outputStart(), conn.outputEnd() - conn.outputStart())
    if (n === AGAIN) {
      return true
    }
    if (n <= 0) {
      return false
    }
    conn.sent(n)
  }
  return true
}

/** One pool and its sockets on a poll loop of their own. */
class Driver {
  readonly pool: PgPool
  private readonly sockets: Socket[]
  private readonly addr: u8[]
  private readonly ready: i32[]
  /** The slot the last `next()` event came from. */
  slot: i32 = -1
  /** How many connections `pump` has made. */
  made: i32 = 0
  private readonly loop: i32
  private cursor: i32 = 0

  constructor(pool: PgPool, port: i32) {
    this.pool = pool
    this.sockets = []
    for (let s: i32 = 0; s < pool.size; s++) {
      this.sockets.push(new Socket())
    }
    this.loop = pollCreate()
    this.addr = new Array<u8>(18)
    netAddress(this.addr, "127.0.0.1", port)
    this.ready = new Array<i32>(64)
  }

  /** Makes the wanted connections, sends what is queued, and reads what arrives within `ms`; false when nothing did. */
  pump(ms: i32): boolean {
    let want: i32 = this.pool.wanted()
    while (want >= 0 && want < toI32(this.sockets.length)) {
      const socket = this.sockets[want]
      const nonce = new Array<u8>(18)
      crypto.getRandomValues(nonce)
      this.pool.connect(want, nonce)
      this.made += 1
      socket.fd = tcpConnect(this.addr)
      socket.live = true
      socket.connected = false
      if (socket.fd < 0 || pollAdd(this.loop, socket.fd, WANT_WRITE, want) < 0) {
        this.pool.connection(want).closed()
      }
      want = this.pool.wanted()
    }
    for (let s: i32 = 0; s < toI32(this.sockets.length); s++) {
      const socket = this.sockets[s]
      if (socket.fd >= 0 && socket.connected) {
        const conn = this.pool.connection(s)
        if (!flush(conn, socket.fd)) {
          conn.closed()
        }
        pollModify(this.loop, socket.fd, conn.outputEnd() > conn.outputStart() ? WANT_READ | WANT_WRITE : WANT_READ, s)
      }
    }
    const n: i32 = pollWait(this.loop, this.ready, ms)
    for (let k: i32 = 0; k < n; k++) {
      const s: i32 = this.ready[2 * k]
      if (s >= 0 && s < toI32(this.sockets.length)) {
        const socket = this.sockets[s]
        const conn = this.pool.connection(s)
        if (!socket.connected) {
          // The socket is writable once its connect finished, or failed.
          if (connectResult(socket.fd) === 0) {
            socket.connected = true
          } else {
            conn.closed()
          }
        } else if ((this.ready[2 * k + 1] & READABLE) !== 0) {
          const got: i32 = netRead(socket.fd, conn.inputBuffer(), conn.inputEnd(), conn.inputRoom())
          // A read error ends the connection as a close does. No server here
          // resets a socket; run.mjs's `reset` check pins the same branch in
          // the carrier.
          if (got === 0 || (got < 0 && got !== AGAIN)) {
            conn.closed()
          } else if (got > 0) {
            conn.received(got)
          }
        }
      }
    }
    return n > 0
  }

  /** The next event from any live slot, `slot` naming it; `PG_NEED_MORE` once all are drained. A `PG_FAILED` slot's socket is closed. */
  next(): i32 {
    while (this.cursor >= 0 && this.cursor < toI32(this.sockets.length)) {
      const s: i32 = this.cursor
      const socket = this.sockets[s]
      if (socket.live) {
        const event: i32 = this.pool.next(s)
        if (event !== PG_NEED_MORE) {
          this.slot = s
          if (event === PG_FAILED) {
            if (socket.fd >= 0) {
              pollRemove(this.loop, socket.fd)
              netClose(socket.fd)
            }
            socket.fd = -1
            socket.live = false
          }
          return event
        }
      }
      this.cursor += 1
    }
    this.cursor = 0
    return PG_NEED_MORE
  }

  /** Ends every live connection and wipes the pool. */
  close(): void {
    for (let s: i32 = 0; s < toI32(this.sockets.length); s++) {
      const socket = this.sockets[s]
      if (socket.fd >= 0) {
        const conn = this.pool.connection(s)
        conn.terminate()
        flush(conn, socket.fd)
        netClose(socket.fd)
        socket.fd = -1
      }
    }
    this.pool.dispose()
  }
}

/** A pool of `size` connections as the arguments say, `extra` appended to the password. */
const makePool = (size: i32, queue: i32, extra: string): PgPool => {
  const config = new PgConfig()
  config.user = process.argv[3]
  config.database = process.argv[5]
  config.options = "-c search_path=nish_live"
  config.applicationName = "nish-live"
  const password = secret(bytesOf(process.argv[4] + extra))
  const pool = new PgPool(config, password, size, queue)
  wipe(password)
  return pool
}

/** Queues an unnamed statement and opens its bind: the caller adds parameters, then `bindEnd()`. */
const adhoc = (conn: PgConnection, sql: string, types: i32[]): void => {
  conn.prepare("", sql, types)
  conn.bindStart("")
}

/** The server's last error on `conn` as `code severity: message`, or `none`. */
const errorOf = (conn: PgConnection): string => {
  const e = conn.lastError
  return e !== null ? `${e.code} ${e.severity}: ${e.message}` : "none"
}

/** The SQLSTATE of the server's last error on `conn`, or "". */
const codeOf = (conn: PgConnection): string => {
  const e = conn.lastError
  return e !== null ? e.code : ""
}

/** A group's error, as a line. */
const failed = (ticket: i32, conn: PgConnection): string => `request ${ticket} failed: ${errorOf(conn)}`

/** `exec`: each SQL argument in its own group, in order on one connection. */
const exec = (port: i32): i32 => {
  const pool = makePool(toI32(1), toI32(256), "")
  const d = new Driver(pool, port)
  const count: i32 = toI32(process.argv.length) - 6
  for (let k: i32 = 0; k < count; k++) {
    pool.request()
  }
  let done: i32 = 0
  let code: i32 = 0
  while (done < count && code === 0) {
    let slot: i32 = pool.dispatch()
    while (slot >= 0) {
      const conn = pool.connection(slot)
      adhoc(conn, process.argv[6 + pool.ticket], noTypes())
      conn.bindEnd()
      pool.send()
      slot = pool.dispatch()
    }
    if (!d.pump(PATIENCE)) {
      console.log("timed out")
      return 1
    }
    let event: i32 = d.next()
    while (event !== PG_NEED_MORE) {
      const conn = pool.connection(d.slot)
      if (event === PG_ERROR) {
        console.log(failed(pool.ticket, conn))
        code = 1
      } else if (event === PG_GROUP_DONE) {
        done += 1
      } else if (event === PG_LOST || event === PG_FAILED) {
        console.log(`connection failed: ${conn.failure} ${errorOf(conn)}`)
        return 1
      }
      event = d.next()
    }
  }
  d.close()
  console.log(`${done} statements`)
  return code
}

/** Runs `select current_user` through a pool with the password plus `extra`, printing what came back. */
const login = (port: i32, extra: string, label: string): i32 => {
  const pool = makePool(toI32(1), toI32(4), extra)
  const d = new Driver(pool, port)
  pool.request()
  let over: boolean = false
  while (!over) {
    let slot: i32 = pool.dispatch()
    while (slot >= 0) {
      const conn = pool.connection(slot)
      adhoc(conn, "select current_user", noTypes())
      conn.bindEnd()
      pool.send()
      slot = pool.dispatch()
    }
    if (!d.pump(PATIENCE)) {
      console.log("timed out")
      return 1
    }
    let event: i32 = d.next()
    while (event !== PG_NEED_MORE) {
      const conn = pool.connection(d.slot)
      if (event === PG_ROW) {
        console.log(`${label}: ${conn.columnText(toI32(0)) === process.argv[3] ? "the row names the user" : "a row naming someone else"}`)
      } else if (event === PG_GROUP_DONE) {
        console.log(`${label}: request ${pool.ticket} answered`)
        over = true
      } else if (event === PG_LOST) {
        console.log(`${label}: request ${pool.ticket} lost`)
      } else if (event === PG_FAILED) {
        console.log(`${label}: connection failed: ${conn.failure} ${errorOf(conn)}`)
        over = true
      }
      event = d.next()
    }
  }
  d.close()
  console.log(`${label}: password wiped: ${pool.passwordWiped()}`)
  return 0
}

const auth = (port: i32): i32 => login(port, "", "right password") + login(port, "!", "wrong password")

/** The first column of the first row `sql` answers, on a connection of its own; "" for none. */
const one = (port: i32, sql: string): string => {
  const pool = makePool(toI32(1), toI32(1), "")
  const d = new Driver(pool, port)
  pool.request()
  let text: string = ""
  let over: boolean = false
  while (!over) {
    const slot: i32 = pool.dispatch()
    if (slot >= 0) {
      const conn = pool.connection(slot)
      adhoc(conn, sql, noTypes())
      conn.bindEnd()
      pool.send()
    }
    if (!d.pump(PATIENCE)) {
      console.log("timed out")
      over = true
    }
    let event: i32 = d.next()
    while (event !== PG_NEED_MORE) {
      const conn = pool.connection(d.slot)
      if (event === PG_ROW && text === "") {
        text = conn.columnText(toI32(0))
      } else if (event === PG_ERROR) {
        console.log(failed(pool.ticket, conn))
      } else if (event === PG_GROUP_DONE || event === PG_FAILED) {
        over = true
      }
      event = d.next()
    }
  }
  d.close()
  return text
}

/**
 * `groups`: 100 groups through 4 connections, once all 4 are ready. Each
 * inserts its ticket into `live_rows` and doubles it; every 25th from the 7th
 * inserts a duplicate key into `live_uniq` first, so its own insert and probe
 * are skipped and the groups beside it on the connection commit.
 */
const groups = (port: i32): i32 => {
  const total: i32 = 100
  const size: i32 = 4
  const pool = makePool(size, toI32(128), "")
  pool.register("probe", "select $1::int4 * 2", [toI32(23)])
  pool.register("dup", "insert into live_uniq values (1)", noTypes())
  pool.register("put", "insert into live_rows values ($1::int4)", [toI32(23)])
  const d = new Driver(pool, port)
  const rows: i32[] = new Array<i32>(total)
  const dones: i32[] = new Array<i32>(total)
  const carried: i32[] = new Array<i32>(size)
  const codes: string[] = []
  for (let t: i32 = 0; t < total; t++) {
    codes.push("")
    pool.request()
  }
  let done: i32 = 0
  let peak: i32 = 0
  let bad: i32 = 0
  // With no connection ready, each dispatch wants one more: all four start at once.
  for (let s: i32 = 0; s < size; s++) {
    pool.dispatch()
  }
  while (done < total && bad === 0) {
    // Hold the requests until every connection is ready, so each carries some.
    let warm: boolean = d.made === size
    for (let s: i32 = 0; s < size && warm; s++) {
      warm = pool.connection(s).txStatus !== 0
    }
    let slot: i32 = warm ? pool.dispatch() : PG_POOL_NONE
    while (slot >= 0) {
      const conn = pool.connection(slot)
      if (slot < toI32(carried.length)) {
        carried[slot] += 1
      }
      if (pool.ticket % 25 === 7) {
        conn.bindStart("dup")
        conn.bindEnd()
      }
      conn.bindStart("put")
      conn.paramInt(toI64(pool.ticket))
      conn.bindEnd()
      conn.bindStart("probe")
      conn.paramInt(toI64(pool.ticket))
      conn.bindEnd()
      pool.send()
      peak = conn.inFlight > peak ? conn.inFlight : peak
      slot = pool.dispatch()
    }
    if (!d.pump(PATIENCE)) {
      console.log("timed out")
      return 1
    }
    let event: i32 = d.next()
    while (event !== PG_NEED_MORE) {
      const conn = pool.connection(d.slot)
      const t: i32 = pool.ticket
      if (t >= 0 && t < total && t < toI32(rows.length) && t < toI32(dones.length) && t < toI32(codes.length)) {
        if (event === PG_ROW) {
          rows[t] = conn.int(toI32(0)) === toI64(t) * toI64(2) ? rows[t] + 1 : rows[t] + 1000
        } else if (event === PG_ERROR) {
          codes[t] = codeOf(conn)
        } else if (event === PG_GROUP_DONE) {
          dones[t] += 1
          done += 1
        }
      }
      if (event === PG_LOST || event === PG_FAILED) {
        console.log(`connection failed: ${conn.failure} ${errorOf(conn)}`)
        bad = 1
      }
      event = d.next()
    }
  }
  d.close()
  let answered: i32 = 0
  let once: i32 = 0
  for (let t: i32 = 0; t < total && t < toI32(rows.length) && t < toI32(dones.length) && t < toI32(codes.length); t++) {
    once += dones[t] === 1 ? 1 : 0
    if (codes[t] !== "") {
      console.log(`group ${t}: ${codes[t]}, ${rows[t]} rows`)
    } else {
      answered += rows[t] === 1 ? 1 : 0
    }
  }
  let used: i32 = 0
  for (let s: i32 = 0; s < size && s < toI32(carried.length); s++) {
    used += carried[s] > 0 ? 1 : 0
  }
  console.log(`${once} of ${total} groups done exactly once`)
  console.log(`${answered} groups answered their probe`)
  console.log(`${d.made} connections, ${used} of them carried groups, at most ${peak} in flight on one`)
  console.log(
    `committed: ${one(port, "select count(*) || ' rows, ' || count(*) filter (where k % 25 = 7) || ' from the failed groups, ' || coalesce(sum(k), 0) || ' summed' from live_rows")}`,
  )
  return bad
}

/** `terminate`: one pool's backend is ended from another; the next request builds the slot again. */
const terminate = (port: i32): i32 => {
  const victim = makePool(toI32(1), toI32(4), "")
  const killer = makePool(toI32(1), toI32(4), "")
  const v = new Driver(victim, port)
  const k = new Driver(killer, port)
  // 0: ask the victim its pid; 1: end it from the killer; 2: wait for the victim to fail; 3: ask again; 4: done.
  let phase: i32 = 0
  let pid: string = ""
  // The victim's failure can be read before the killer's answer: it is printed once both are in.
  let lost: string = ""
  victim.request()
  let rounds: i32 = 0
  while (phase < 4) {
    rounds += 1
    if (rounds > 1000) {
      console.log(`stuck in phase ${phase}`)
      return 1
    }
    let slot: i32 = victim.dispatch()
    while (slot >= 0) {
      const conn = victim.connection(slot)
      adhoc(conn, "select pg_backend_pid()::text", noTypes())
      conn.bindEnd()
      victim.send()
      slot = victim.dispatch()
    }
    slot = killer.dispatch()
    while (slot >= 0) {
      const conn = killer.connection(slot)
      adhoc(conn, "select pg_terminate_backend($1::int4)", [toI32(25)])
      conn.paramText(pid)
      conn.bindEnd()
      killer.send()
      slot = killer.dispatch()
    }
    v.pump(toI32(20))
    k.pump(toI32(20))
    let event: i32 = v.next()
    while (event !== PG_NEED_MORE) {
      const conn = victim.connection(v.slot)
      if (event === PG_ROW && phase === 0) {
        pid = conn.columnText(toI32(0))
        console.log("victim: answered with its pid")
      } else if (event === PG_GROUP_DONE && phase === 0) {
        phase = 1
        killer.request()
      } else if (event === PG_ROW && phase === 3) {
        console.log(`victim: answered again, ${conn.columnText(toI32(0)) === pid ? "the same backend" : "a new backend"}`)
      } else if (event === PG_GROUP_DONE && phase === 3) {
        phase = 4
      } else if (event === PG_LOST) {
        console.log(`victim: request ${victim.ticket} lost`)
      } else if (event === PG_FAILED) {
        lost = `victim: connection failed: ${conn.failure} ${errorOf(conn)}`
      }
      event = v.next()
    }
    event = k.next()
    while (event !== PG_NEED_MORE) {
      const conn = killer.connection(k.slot)
      if (event === PG_ROW) {
        console.log(`killer: pg_terminate_backend answered ${conn.columnText(toI32(0))}`)
      } else if (event === PG_GROUP_DONE) {
        phase = 2
      } else if (event === PG_ERROR) {
        console.log(failed(killer.ticket, conn))
      }
      event = k.next()
    }
    if (phase === 2 && lost !== "") {
      console.log(lost)
      phase = 3
      victim.request()
    }
  }
  v.close()
  k.close()
  console.log(`victim: ${v.made} connections made`)
  return 0
}

/** `pipeline`: five groups in flight on one connection, the third dividing by zero before a second statement. */
const pipeline = (port: i32): i32 => {
  const pool = makePool(toI32(1), toI32(8), "")
  pool.register("div", "select 60 / $1::int4", [toI32(23)])
  const d = new Driver(pool, port)
  const divisors: i64[] = [toI64(1), toI64(2), toI64(0), toI64(5), toI64(6)]
  for (let t: i32 = 0; t < toI32(divisors.length); t++) {
    pool.request()
  }
  let done: i32 = 0
  while (done < toI32(divisors.length)) {
    let slot: i32 = pool.dispatch()
    while (slot >= 0) {
      const conn = pool.connection(slot)
      const t: i32 = pool.ticket
      if (t >= 0 && t < toI32(divisors.length)) {
        const divisor: i64 = divisors[t]
        conn.bindStart("div")
        conn.paramInt(divisor)
        conn.bindEnd()
        conn.bindStart("div")
        conn.paramInt(toI64(t + 1))
        conn.bindEnd()
      }
      pool.send()
      console.log(`request ${t} sent, ${conn.inFlight} in flight`)
      slot = pool.dispatch()
    }
    if (!d.pump(PATIENCE)) {
      console.log("timed out")
      return 1
    }
    let event: i32 = d.next()
    while (event !== PG_NEED_MORE) {
      const conn = pool.connection(d.slot)
      if (event === PG_ROW) {
        console.log(`request ${pool.ticket}: ${conn.int(toI32(0))}`)
      } else if (event === PG_ERROR) {
        console.log(failed(pool.ticket, conn))
      } else if (event === PG_GROUP_DONE) {
        console.log(`request ${pool.ticket} done${conn.groupFailed ? ", failed" : ""}`)
        done += 1
      } else if (event === PG_LOST || event === PG_FAILED) {
        console.log(`connection failed: ${conn.failure} ${errorOf(conn)}`)
        return 1
      }
      event = d.next()
    }
  }
  d.close()
  return 0
}

/** The text elements `arrays` binds, NULL among them where `ARRAY_NULL` stands. */
const ARRAY_NULL: string = "<null>"
const awkward = (): string[] => [ARRAY_NULL, "\"", "\\", ",", "{", "}", " x y ", "NULL", "", "é€", ARRAY_NULL]

/** Builds request `t` of `arrays`: one Bind, its array built the way that request names. */
const bindArray = (conn: PgConnection, t: i32): void => {
  if (t === 0 || t === 1) {
    conn.bindStart("texts")
    conn.arrayStart()
    if (t === 0) {
      for (const item of awkward()) {
        if (item === ARRAY_NULL) {
          conn.arrayNull()
        } else {
          const b: u8[] = bytesOf(item)
          conn.arrayElement(b, toI32(0), toI32(b.length))
        }
      }
    }
    conn.arrayEnd()
  } else if (t === 2 || t === 3) {
    const min: i64 = (toI64(-922337203) * toI64(1000000000) - toI64(685477580)) * toI64(10) - toI64(8)
    const values: i64[] = [toI64(7), toI64(-1), toI64(0), min, -(min + toI64(1))]
    conn.bindStart("ints")
    conn.paramIntArray(values, toI32(0), t === 2 ? toI32(values.length) : toI32(0))
  } else {
    // The literal is text, so the server reads it as the type it inferred: int4 here.
    conn.bindStart("int4s")
    conn.arrayStart()
    const digits: u8[] = bytesOf("-42")
    conn.arrayElement(digits, toI32(0), toI32(3))
    conn.arrayElement(digits, toI32(1), toI32(2))
    conn.arrayEnd()
  }
  conn.bindEnd()
}

/**
 * `arrays`: array parameters built element by element and from an `i64[]`,
 * unnested by the server; awkward text, NULLs, the empty array, the extreme
 * int8s, and a text literal the server reads as `int4[]`.
 */
const arrays = (port: i32): i32 => {
  const pool = makePool(toI32(1), toI32(8), "")
  pool.register("texts", "select x, ord from unnest($1::text[]) with ordinality as u(x, ord)", noTypes())
  pool.register("ints", "select x, ord from unnest($1::int8[]) with ordinality as u(x, ord)", noTypes())
  pool.register("int4s", "select x + 1, pg_typeof(x)::text from unnest($1::int4[]) as u(x)", noTypes())
  const d = new Driver(pool, port)
  const requests: i32 = 5
  for (let t: i32 = 0; t < requests; t++) {
    pool.request()
  }
  let done: i32 = 0
  while (done < requests) {
    let slot: i32 = pool.dispatch()
    while (slot >= 0) {
      const t: i32 = pool.ticket
      if (t >= 0 && t < requests) {
        bindArray(pool.connection(slot), t)
      }
      pool.send()
      slot = pool.dispatch()
    }
    if (!d.pump(PATIENCE)) {
      console.log("timed out")
      return 1
    }
    let event: i32 = d.next()
    while (event !== PG_NEED_MORE) {
      const conn = pool.connection(d.slot)
      if (event === PG_ROW) {
        const x: string = conn.isNull(toI32(0)) ? "NULL" : `[${conn.columnText(toI32(0))}]`
        console.log(`request ${pool.ticket}: ${conn.columnText(toI32(1))} ${x}`)
      } else if (event === PG_ERROR) {
        console.log(failed(pool.ticket, conn))
      } else if (event === PG_GROUP_DONE) {
        console.log(`request ${pool.ticket} done${conn.groupFailed ? ", failed" : ""}`)
        done += 1
      } else if (event === PG_LOST || event === PG_FAILED) {
        console.log(`connection failed: ${conn.failure} ${errorOf(conn)}`)
        return 1
      }
      event = d.next()
    }
  }
  d.close()
  return 0
}

/** The statement `binary` runs: every column kind the binary decoders read, at its edges. */
const KINDS: string =
  "select x.n::int2, x.n::int4, x.big, x.ok, x.f, x.label, x.at, x.at::timestamp from (values " +
  "(-7, '-9223372036854775808'::int8, true, -1.5::float8, 'é€ text', '2025-12-31 23:59:19.409876+00'::timestamptz), " +
  "(32767, 9223372036854775807, false, 0.1, '', '1999-12-31 23:59:59.999999+00'), " +
  "(-32768, 9007199254740993, null, null, null, '2024-02-29 23:59:59.9995+00'), " +
  "(0, -1, true, 0, 'x', '0001-01-01 00:00:00+00'), " +
  "(1, 1, false, 1e300, 'y', 'infinity')) as x(n, big, ok, f, label, at)"

/** The time a decoder wrote to `out` when it answered `n`, or `?` when it refused it. */
const timeOf = (n: i32, out: u8[]): string => (n < 0 ? "?" : String.fromBytes(out, 0, n))

/** A row of `KINDS`, each column read with the binary or the text decoder for its type, NULL as `NULL`. */
const kindsRow = (conn: PgConnection, binary: boolean, out: u8[]): string => {
  const parts: string[] = []
  const b: u8[] = conn.inputBuffer()
  for (let c: i32 = 0; c < conn.columns; c++) {
    if (conn.isNull(c)) {
      parts.push("NULL")
    } else if (c <= 2) {
      parts.push(`${binary ? conn.binaryInt(c) : conn.int(c)}`)
    } else if (c === 3) {
      parts.push(`${binary ? conn.binaryBool(c) : conn.bool(c)}`)
    } else if (c === 4) {
      parts.push(binary ? `${conn.binaryFloat(c)}` : conn.columnText(c))
    } else if (c === 5) {
      parts.push(`[${conn.columnText(c)}]`)
    } else if (binary) {
      parts.push(timeOf(conn.binary.timestamp(b, conn.colStart(c), conn.colLength(c), out, toI32(0)), out))
    } else {
      parts.push(timeOf(conn.text.timestamp(b, conn.colStart(c), conn.colLength(c), out, toI32(0)), out))
    }
  }
  return parts.join(" ")
}

/**
 * `binary`: one statement bound twice in one group, its rows asked for in
 * binary, then in text; ints at their edges, a bool, a float8, UTF-8 text,
 * times before and after 2000 cut to milliseconds, and infinity refused.
 */
const binary = (port: i32): i32 => {
  const pool = makePool(toI32(1), toI32(8), "")
  pool.register("kinds", KINDS, noTypes())
  const d = new Driver(pool, port)
  const out: u8[] = new Array<u8>(24)
  pool.request()
  let done: boolean = false
  let executions: i32 = 0
  while (!done) {
    let slot: i32 = pool.dispatch()
    while (slot >= 0) {
      const conn = pool.connection(slot)
      conn.bindStartBinary("kinds")
      conn.bindEnd()
      conn.bindStart("kinds")
      conn.bindEnd()
      pool.send()
      slot = pool.dispatch()
    }
    if (!d.pump(PATIENCE)) {
      console.log("timed out")
      return 1
    }
    let event: i32 = d.next()
    while (event !== PG_NEED_MORE) {
      const conn = pool.connection(d.slot)
      if (event === PG_ROW) {
        const isBinary: boolean = executions === 0
        conn.text.reset()
        conn.binary.reset()
        const line: string = kindsRow(conn, isBinary, out)
        const failed: boolean = isBinary ? conn.binary.failed : conn.text.failed
        console.log(`${isBinary ? "binary" : "text"}: ${line}${failed ? " (failed)" : ""}`)
      } else if (event === PG_COMPLETE) {
        executions += 1
      } else if (event === PG_ERROR) {
        console.log(failed(pool.ticket, conn))
      } else if (event === PG_GROUP_DONE) {
        console.log(`request ${pool.ticket} done${conn.groupFailed ? ", failed" : ""}`)
        done = true
      } else if (event === PG_LOST || event === PG_FAILED) {
        console.log(`connection failed: ${conn.failure} ${errorOf(conn)}`)
        return 1
      }
      event = d.next()
    }
  }
  d.close()
  return 0
}

const HEX: string = "0123456789abcdef"

/** `s` as a JSON string. */
const jsonString = (s: string): string => {
  const out: string[] = ["\""]
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    const c: i32 = toI32(s.charCodeAt(k))
    if (c === 34) {
      out.push("\\\"")
    } else if (c === 92) {
      out.push("\\\\")
    } else if (c < 32) {
      out.push(`\\u00${HEX.slice(c >> 4, (c >> 4) + 1)}${HEX.slice(c & 15, (c & 15) + 1)}`)
    } else {
      out.push(String.fromCharCode(c))
    }
  }
  out.push("\"")
  return out.join("")
}

/** Column `c` as a JSON string, or `null`. */
const jsonText = (conn: PgConnection, c: i32): string => (conn.isNull(c) ? "null" : jsonString(conn.columnText(c)))

/** Column `c`, a `timestamptz`, as RFC 3339 in UTC with milliseconds. */
const jsonTime = (conn: PgConnection, c: i32, out: u8[]): string => {
  const n: i32 = conn.text.timestamp(conn.inputBuffer(), conn.colStart(c), conn.colLength(c), out, toI32(0))
  return n < 0 ? "\"?\"" : `"${String.fromBytes(out, 0, n)}"`
}

/** Column `c`, a `text[]`, as a JSON array of strings. */
const jsonTags = (conn: PgConnection, c: i32, walker: PgArrayWalker, out: u8[]): string => {
  walker.begin(conn.inputBuffer(), conn.colStart(c), conn.colLength(c))
  const items: string[] = []
  let event: i32 = walker.next()
  while (event === PG_ARRAY_ELEMENT || event === PG_ARRAY_NULL) {
    const n: i32 = event === PG_ARRAY_NULL ? -1 : walker.copy(out, toI32(0))
    items.push(event === PG_ARRAY_NULL ? "null" : n < 0 ? "\"?\"" : jsonString(String.fromBytes(out, 0, n)))
    event = walker.next()
  }
  return event === PG_ARRAY_END ? `[${items.join(",")}]` : "\"?\""
}

/** `conduit`: the article list for three viewers and pages, the statement prepared once on one connection. */
const conduit = (port: i32): i32 => {
  const pool = makePool(toI32(1), toI32(8), "")
  pool.register(
    "article_list",
    "SELECT a.id, a.slug, a.title, a.description, a.created_at, a.updated_at, " +
      "ARRAY(SELECT t.name FROM article_tags at JOIN tags t ON t.id = at.tag_id " +
      "WHERE at.article_id = a.id ORDER BY t.name) AS tag_list, " +
      "(SELECT count(*) FROM favorites f WHERE f.article_id = a.id) AS favorites_count, " +
      "EXISTS (SELECT 1 FROM favorites f WHERE f.article_id = a.id AND f.user_id = $1) AS favorited, " +
      "u.username, u.bio, u.image, " +
      "EXISTS (SELECT 1 FROM follows fo WHERE fo.follower_id = $1 AND fo.followee_id = a.author_id) AS following " +
      "FROM articles a JOIN users u ON u.id = a.author_id " +
      "ORDER BY a.id DESC LIMIT $2 OFFSET $3",
    [toI32(20), toI32(20), toI32(20)]
  )
  const d = new Driver(pool, port)
  // viewer, limit, offset: anonymous (0), then two signed-in viewers paging.
  const viewers: i64[] = [toI64(0), toI64(1), toI64(2)]
  const limits: i64[] = [toI64(20), toI64(2), toI64(2)]
  const offsets: i64[] = [toI64(0), toI64(0), toI64(2)]
  for (let t: i32 = 0; t < toI32(viewers.length); t++) {
    pool.request()
  }
  const walker = new PgArrayWalker()
  const scratch = new Array<u8>(256)
  let done: i32 = 0
  let code: i32 = 0
  while (done < toI32(viewers.length)) {
    let slot: i32 = pool.dispatch()
    while (slot >= 0) {
      const conn = pool.connection(slot)
      const t: i32 = pool.ticket
      if (t >= 0 && t < toI32(viewers.length) && t < toI32(limits.length) && t < toI32(offsets.length)) {
        const viewer: i64 = viewers[t]
        const limit: i64 = limits[t]
        const offset: i64 = offsets[t]
        conn.bindStart("article_list")
        conn.paramInt(viewer)
        conn.paramInt(limit)
        conn.paramInt(offset)
        conn.bindEnd()
      }
      pool.send()
      slot = pool.dispatch()
    }
    if (!d.pump(PATIENCE)) {
      console.log("timed out")
      return 1
    }
    let event: i32 = d.next()
    while (event !== PG_NEED_MORE) {
      const conn = pool.connection(d.slot)
      if (event === PG_ROW) {
        conn.text.reset()
        const author: string =
          `{"username":${jsonText(conn, toI32(9))},"bio":${jsonText(conn, toI32(10))},` +
          `"image":${jsonText(conn, toI32(11))},"following":${conn.bool(toI32(12))}}`
        console.log(
          `request ${pool.ticket}: {"slug":${jsonText(conn, toI32(1))},"title":${jsonText(conn, toI32(2))},` +
            `"description":${jsonText(conn, toI32(3))},"tagList":${jsonTags(conn, toI32(6), walker, scratch)},` +
            `"createdAt":${jsonTime(conn, toI32(4), scratch)},"updatedAt":${jsonTime(conn, toI32(5), scratch)},` +
            `"favorited":${conn.bool(toI32(8))},"favoritesCount":${conn.int(toI32(7))},"author":${author}}`
        )
        if (conn.text.failed) {
          console.log(`request ${pool.ticket}: a column did not decode`)
          code = 1
        }
      } else if (event === PG_ERROR) {
        console.log(failed(pool.ticket, conn))
        code = 1
      } else if (event === PG_GROUP_DONE) {
        console.log(`request ${pool.ticket} done`)
        done += 1
      } else if (event === PG_LOST || event === PG_FAILED) {
        console.log(`connection failed: ${conn.failure} ${errorOf(conn)}`)
        return 1
      }
      event = d.next()
    }
  }
  d.close()
  console.log(`${d.made} connection, the statement prepared once`)
  return code
}

/** A batcher of `keyType` named `name`, `select` its query for one key `q.key`, taking at most `most` requests at once. */
const batcher = (name: string, keyType: i32, select: string, orderBy: string, most: i32): PgBatcher => {
  const config = new PgBatchConfig()
  config.name = name
  config.keyType = keyType
  config.select = select
  config.orderBy = orderBy
  config.maxRequests = most
  return new PgBatcher(config)
}

/** Appends `line` to `log`, a newline between lines. */
const logLine = (log: string, line: string): string => (log === "" ? line : `${log}\n${line}`)

/** Logs the events `row`, `end` or `fail` left on batcher `b`'s run `r` onto `log`; the row's first column for each `PG_BATCH_ROW`. */
const routeBatch = (b: PgBatcher, r: i32, conn: PgConnection, log: string): string => {
  let out: string = log
  let event: i32 = b.next(r)
  while (event !== PG_BATCH_NONE) {
    if (event === PG_BATCH_ROW) {
      out = logLine(out, `${b.name} ${b.tag}: ${conn.isNull(toI32(0)) ? "NULL" : conn.columnText(toI32(0))}`)
    } else if (event === PG_BATCH_DONE) {
      out = logLine(out, `${b.name} ${b.tag} done`)
    } else if (event === PG_BATCH_MISSING) {
      out = logLine(out, `${b.name} ${b.tag} missing`)
    } else if (event === PG_BATCH_FAILED) {
      out = logLine(out, `${b.name} ${b.tag} failed`)
    }
    event = b.next(r)
  }
  return out
}

/**
 * `batch`: keyed reads through three `PgBatcher`s on one pooled connection,
 * each take one group. Users by id, four requests a take, so six take two;
 * articles by slug; and tags by article, several rows a key in name order.
 * Each has a duplicate key and a key with no row. A take's line and its
 * events are logged under its request and printed batcher by batcher at the
 * end, so the output does not depend on when the server's answers arrive;
 * the take line leaves out its run handle, which does (a second take may come
 * before or after the first run is answered).
 */
const batch = (port: i32): i32 => {
  const batchers: PgBatcher[] = [
    batcher("users_by_id", PG_BATCH_INT, "select u.username from users u where u.id = q.key", "", toI32(4)),
    batcher("article_by_slug", PG_BATCH_TEXT, "select a.title from articles a where a.slug = q.key", "", toI32(32)),
    batcher(
      "tags_by_article",
      PG_BATCH_INT,
      "select tg.name from article_tags at join tags tg on tg.id = at.tag_id where at.article_id = q.key",
      "t.name",
      toI32(32)
    ),
  ]
  const pool = makePool(toI32(1), toI32(8), "")
  for (const b of batchers) {
    pool.register(b.name, b.sql, noTypes())
  }
  const userIds: i64[] = [toI64(3), toI64(1), toI64(3), toI64(9), toI64(2), toI64(1)]
  for (let t: i32 = 0; t < toI32(userIds.length); t++) {
    batchers[0].addInt(userIds[t], t)
  }
  const slugs: string[] = ["quotes-2", "nope", "notes-1", "quotes-2"]
  for (let t: i32 = 0; t < toI32(slugs.length); t++) {
    const b: u8[] = bytesOf(slugs[t])
    batchers[1].addText(b, toI32(0), toI32(b.length), t)
  }
  const articleIds: i64[] = [toI64(2), toI64(1), toI64(3), toI64(2)]
  for (let t: i32 = 0; t < toI32(articleIds.length); t++) {
    batchers[2].addInt(articleIds[t], t)
  }
  const d = new Driver(pool, port)
  // Each pool request is one take of one batcher: which, the run it got, and
  // its log. The scenario makes far fewer than `ring` requests, so a slot's
  // index is its ticket and the slots are in take order.
  const ring: i32 = 64
  const whose: i32[] = new Array<i32>(ring)
  const runs: i32[] = new Array<i32>(ring)
  const logs: string[] = []
  for (let at: i32 = 0; at < ring; at++) {
    whose[at] = -1
    logs.push("")
  }
  const asked: boolean[] = new Array<boolean>(batchers.length)
  let open: i32 = 0
  let code: i32 = 0
  while (true) {
    for (let k: i32 = 0; k < toI32(batchers.length) && k < toI32(asked.length); k++) {
      if (!asked[k] && batchers[k].waiting() > 0) {
        const ticket: i32 = pool.request()
        if (ticket >= 0) {
          whose[ticket % ring] = k
          runs[ticket % ring] = -1
          asked[k] = true
          open += 1
        }
      }
    }
    if (open === 0) {
      break
    }
    let slot: i32 = pool.dispatch()
    while (slot >= 0) {
      const t: i32 = pool.ticket
      const k: i32 = whose[t % ring]
      if (k >= 0 && k < toI32(batchers.length) && k < toI32(asked.length)) {
        asked[k] = false
        const b: PgBatcher = batchers[k]
        const r: i32 = b.take(pool.connection(slot))
        runs[t % ring] = r
        logs[t % ring] = logLine(logs[t % ring], `${b.name} take, ${b.waiting()} waiting`)
      }
      if (!pool.send()) {
        open -= 1
      }
      slot = pool.dispatch()
    }
    if (!d.pump(PATIENCE)) {
      console.log("timed out")
      return 1
    }
    let event: i32 = d.next()
    while (event !== PG_NEED_MORE) {
      const conn = pool.connection(d.slot)
      // The pool's own events, a prepare's, name no request.
      const at: i32 = pool.ticket >= 0 ? pool.ticket % ring : -1
      const k: i32 = at >= 0 ? whose[at] : -1
      const r: i32 = at >= 0 ? runs[at] : -1
      if (event === PG_ERROR) {
        console.log(failed(pool.ticket, conn))
        code = 1
      }
      if ((event === PG_ROW || event === PG_COMPLETE || event === PG_ERROR) && r >= 0 && k >= 0 && k < toI32(batchers.length)) {
        const b: PgBatcher = batchers[k]
        if (event === PG_COMPLETE) {
          b.end(r)
        } else if (event === PG_ERROR) {
          b.fail(r)
        } else if (!b.row(r, conn)) {
          console.log(`${b.name}: a row refused`)
          code = 1
        }
        logs[at] = routeBatch(b, r, conn, logs[at])
      }
      if (event === PG_GROUP_DONE) {
        open -= 1
      } else if (event === PG_LOST || event === PG_FAILED) {
        console.log(`connection failed: ${conn.failure} ${errorOf(conn)}`)
        return 1
      }
      event = d.next()
    }
  }
  d.close()
  for (let k: i32 = 0; k < toI32(batchers.length); k++) {
    for (let at: i32 = 0; at < ring; at++) {
      if (whose[at] === k && logs[at] !== "") {
        console.log(logs[at])
      }
    }
  }
  return code
}

export const main = (): i32 => {
  if (process.argv.length < 6) {
    console.log("usage: live <scenario> <port> <user> <password> <database> [sql ...]")
    return 2
  }
  const scenario: string = process.argv[1]
  const port: i32 = parseInt(process.argv[2])
  if (scenario === "exec") {
    return exec(port)
  } else if (scenario === "auth") {
    return auth(port)
  } else if (scenario === "groups") {
    return groups(port)
  } else if (scenario === "terminate") {
    return terminate(port)
  } else if (scenario === "pipeline") {
    return pipeline(port)
  } else if (scenario === "arrays") {
    return arrays(port)
  } else if (scenario === "binary") {
    return binary(port)
  } else if (scenario === "conduit") {
    return conduit(port)
  } else if (scenario === "batch") {
    return batch(port)
  }
  console.log(`unknown scenario ${scenario}`)
  return 2
}
