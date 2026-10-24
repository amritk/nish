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
//   conduit     the Conduit article list, prepared once and run pipelined
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
  } else if (scenario === "conduit") {
    return conduit(port)
  }
  console.log(`unknown scenario ${scenario}`)
  return 2
}
