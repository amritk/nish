// The HttpArena entry's `/async-db` route: one worker's PgPool, driven on
// sockets of its own in a poll set the HttpServer watches.
//
// std's PgCarrier drives a pool on an HttpHandler's loop and takes the
// handler itself, which HttpServer does not expose; this driver is the
// carrier's plain-TCP path, cut to what the route needs: one statement, no
// TLS, no batching. A query that cannot run (no URL, the server down, the
// queue full) answers `{"items":[],"count":0}`, as HttpArena asks.
import { HttpServer, HttpServerRequest } from "nish/net/http-server"
import { H1_WANT_READ, H1_WANT_WRITE } from "nish/net/http1-server"
import { JsonWriter } from "nish/json"
import {
  PG_COMPLETE,
  PG_ERROR,
  PG_ERR_NONE,
  PG_FAILED,
  PG_GROUP_DONE,
  PG_LOST,
  PG_NEED_MORE,
  PG_READY,
  PG_ROW,
  PG_TARGET_OK,
  PgConfig,
  PgConnection,
  PgPool,
  PgTarget,
  pgTargetUrl,
} from "nish/net/postgres"
import {
  connectResult,
  netAddress,
  netClose,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollRemove,
  pollWait,
  tcpConnect,
  unixConnect,
} from "nish:net"
import { monotonicNanos } from "nish:process"
import { secret, wipe } from "nish:secret"

/** The id the driver's poll set is watched under on the HttpServer (0 is the stop signal). */
const DB_WATCH: i32 = 1
/** The query HttpArena specifies, as one prepared statement. */
const ITEMS_SQL: string =
  "SELECT id, name, category, price, quantity, active, tags, rating_score, rating_count FROM items WHERE price BETWEEN $1 AND $2 LIMIT $3"
/** The JSON a failed or empty query answers. */
const EMPTY: string = `{"items":[],"count":0}`
/** Tickets in flight are looked up in a ring this size: above the pool's queue plus every connection's groups. */
const RING: i32 = 16384
/** Requests that may wait for a connection, per worker. */
const QUEUE: i32 = 4096
/** Groups each connection may have in flight. */
const IN_FLIGHT: i32 = 8
/** Most connections a worker opens, so `QUEUE + MAX_POOL * IN_FLIGHT` stays below `RING`. */
const MAX_POOL: i32 = 1024
/** Bytes of one answer: 50 rows of the seed's widest item fit in about a quarter. */
const ANSWER_BYTES: i32 = 32768
/** How long a connect may take before it fails. */
const CONNECT_NS: i64 = 5000000000
/** `netRead`/`netWrite`'s answer for a socket with nothing to give or no room. */
const AGAIN: i32 = -11
/** The poll bits that say a socket has input (readable, or hung up). */
const READ_BITS: i32 = 5

/** The bytes of the ASCII `s`. */
const dbBytes = (s: string): u8[] => {
  const out: u8[] = []
  for (let k: i32 = 0; k < toI32(s.length); k++) {
    out.push(toU8(s.charCodeAt(k)))
  }
  return out
}

/** One query waiting on the pool: its request, its bounds and the answer built from its rows. */
class ArenaJob {
  r: HttpServerRequest | null = null
  w: JsonWriter
  min: i64 = 0
  max: i64 = 0
  limit: i64 = 0
  count: i64 = 0
  failed: boolean = false

  constructor() {
    this.w = new JsonWriter(new Array<u8>(ANSWER_BYTES), 0)
  }
}

/** One pool slot's socket. */
class ArenaSocket {
  fd: i32 = -1
  /** Whether the pool made a connection in this slot, so `next` may be asked. */
  made: boolean = false
  connected: boolean = false
  interest: i32 = 0
  /** When the connect fails, or 0 once the connection is ready. */
  deadline: i64 = 0
}

/** The parts of a `postgres://user:password@host:port/database` URL the pool's config takes. */
class ArenaUrl {
  user: string = ""
  password: string = ""
  database: string = ""
}

/** Reads the user, password and database out of `url`, which `pgTargetUrl` has accepted. */
const arenaUrl = (url: string): ArenaUrl => {
  const out = new ArenaUrl()
  const scheme: i32 = url.indexOf("://")
  const from: i32 = scheme < 0 ? 0 : scheme + 3
  let slash: i32 = url.indexOf("/", from)
  if (slash < 0) {
    slash = toI32(url.length)
  }
  const authority: string = url.substring(from, slash)
  const at: i32 = authority.indexOf("@")
  if (at >= 0) {
    const info: string = authority.substring(0, at)
    const colon: i32 = info.indexOf(":")
    out.user = colon < 0 ? info : info.substring(0, colon)
    out.password = colon < 0 ? "" : info.substring(colon + 1)
  }
  if (slash < toI32(url.length)) {
    let end: i32 = url.indexOf("?", slash)
    if (end < 0) {
      end = toI32(url.length)
    }
    out.database = url.substring(slash + 1, end)
  }
  return out
}

/** The decimal `text` as a pool size, or `fallback` when absent or not one. */
const arenaCount = (text: string | null, fallback: i32): i32 => {
  if (text === null || text.length === 0) {
    return fallback
  }
  let v: i32 = 0
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    const c: i32 = toI32(text.charCodeAt(k))
    if (c < 48 || c > 57 || v > 100000) {
      return fallback
    }
    v = v * 10 + (c - 48)
  }
  return v
}

/** One worker's database side. */
export class ArenaDb {
  pool: PgPool | null = null
  target: PgTarget
  address: u8[]
  sockets: ArenaSocket[] = []
  ready: i32[] = []
  nonce: u8[]
  loop: i32 = -1
  jobs: ArenaJob[] = []
  free: i32[] = []
  /** `ring[ticket % RING]`: the job a ticket is for, or -1. */
  ring: i32[] = []
  empty: u8[]
  jsonType: u8[]
  rating: u8[]
  /** How many queries answered empty because the database failed them. */
  failures: i64 = 0

  /**
   * A pool on `url` (`DATABASE_URL`) of `maxConn` (`DATABASE_MAX_CONN`, 256
   * when unset) connections shared out over `workers`. No URL, or one
   * `pgTargetUrl` refuses, leaves the pool unmade and every query empty.
   */
  constructor(url: string | null, maxConn: string | null, workers: i32) {
    this.empty = dbBytes(EMPTY)
    this.jsonType = dbBytes("application/json")
    this.rating = dbBytes("rating")
    this.address = new Array<u8>(18)
    this.nonce = new Array<u8>(18)
    this.target = pgTargetUrl(url === null ? "" : url)
    if (url === null || this.target.failure !== PG_TARGET_OK) {
      return
    }
    const host: string = this.target.host === "localhost" ? "127.0.0.1" : this.target.host
    if (!this.target.unix && netAddress(this.address, host, this.target.port) < 0) {
      return
    }
    const parts: ArenaUrl = arenaUrl(url)
    const config = new PgConfig()
    config.user = parts.user
    config.database = parts.database
    config.maxInFlight = IN_FLIGHT
    // At least one connection a worker, so a `DATABASE_MAX_CONN` below the
    // worker count opens one per worker, more than it names in all.
    let size: i32 = arenaCount(maxConn, 256) / (workers < 1 ? 1 : workers)
    if (size < 1) {
      size = 1
    }
    if (size > MAX_POOL) {
      size = MAX_POOL
    }
    const password = secret(dbBytes(parts.password))
    const pool = new PgPool(config, password, size, QUEUE)
    wipe(password)
    const types: i32[] = []
    pool.register("items", ITEMS_SQL, types)
    this.pool = pool
    for (let s: i32 = 0; s < size; s++) {
      this.sockets.push(new ArenaSocket())
      this.ready.push(0)
      this.ready.push(0)
    }
    for (let k: i32 = 0; k < RING; k++) {
      this.ring.push(-1)
    }
  }

  /** Watches the connections' poll set on `h`. */
  attach(h: HttpServer): void {
    if (this.pool === null) {
      return
    }
    this.loop = pollCreate()
    if (this.loop < 0) {
      this.pool = null
      return
    }
    h.watch(this.loop, DB_WATCH)
  }

  /** The longest the loop may block for a connect's deadline, or -1. */
  waitMs(): i32 {
    let best: i64 = -1
    let now: i64 = 0
    for (let s: i32 = 0; s < toI32(this.sockets.length); s++) {
      const deadline: i64 = this.sockets[s].deadline
      if (deadline > 0) {
        if (now === 0) {
          now = monotonicNanos()
        }
        const left: i64 = deadline > now ? deadline - now : 0
        if (best < 0 || left < best) {
          best = left
        }
      }
    }
    return best < 0 ? -1 : toI32(best / 1000000) + 1
  }

  /** Answers `/async-db?min&max&limit` on `r`: queues the query, or answers empty when it cannot run. */
  query(h: HttpServer, r: HttpServerRequest, min: i64, max: i64, limit: i64): void {
    const pool: PgPool | null = this.pool
    if (pool === null) {
      this.sendEmpty(h, r)
      return
    }
    let index: i32 = -1
    if (this.free.length > 0) {
      index = this.free[toI32(this.free.length) - 1]
      this.free.pop()
    } else if (toI32(this.jobs.length) < RING) {
      index = toI32(this.jobs.length)
      this.jobs.push(new ArenaJob())
    }
    if (index < 0) {
      this.sendEmpty(h, r)
      return
    }
    const ticket: i32 = pool.request()
    const at: i32 = ticket & (RING - 1)
    if (ticket < 0 || this.ring[at] >= 0) {
      // Unreachable while QUEUE + MAX_POOL * IN_FLIGHT (4096 + 8192 = 12288)
      // is under RING (16384): no more tickets than that are alive at once,
      // so a live ticket's cell is never one RING tickets back. Kept as a guard.
      this.free.push(index)
      this.sendEmpty(h, r)
      return
    }
    const job: ArenaJob = this.jobs[index]
    job.r = r
    job.min = min
    job.max = max
    job.limit = Math.min(Math.max(limit, 1), 50)
    job.count = 0
    job.failed = false
    const w: JsonWriter = job.w
    w.reset(w.buf, 0)
    w.beginObject()
    w.key("items")
    w.beginArray()
    this.ring[at] = index
  }

  /**
   * One pass: reads what the sockets have, answers the pool's events, sends
   * the queued queries to connections with room, connects what the pool
   * wants and writes what each connection queued.
   */
  turn(h: HttpServer): void {
    const pool: PgPool | null = this.pool
    if (pool === null) {
      return
    }
    if (h.fired(DB_WATCH)) {
      this.poll(pool)
    }
    this.timeouts(pool)
    let connect: boolean = true
    let again: boolean = true
    while (again) {
      this.events(h, pool)
      this.dispatch(h, pool)
      again = this.connectAndFlush(pool, connect)
      connect = false
    }
  }

  /** Reads every socket the poll set reports, finishing its connect first. */
  private poll(pool: PgPool): void {
    const ready: i32[] = this.ready
    const n: i32 = pollWait(this.loop, ready, 0)
    for (let k: i32 = 0; k < n && 2 * k + 1 < toI32(ready.length); k++) {
      const s: i32 = ready[2 * k]
      const bits: i32 = ready[2 * k + 1]
      if (s < 0 || s >= toI32(this.sockets.length)) {
        continue
      }
      const sock: ArenaSocket = this.sockets[s]
      if (sock.fd < 0) {
        continue
      }
      const conn: PgConnection = pool.connection(s)
      if (conn.failure !== PG_ERR_NONE) {
        continue
      }
      if (!sock.connected) {
        if (connectResult(sock.fd) !== 0) {
          this.fail(sock, conn)
          continue
        }
        sock.connected = true
      }
      const room: i32 = conn.inputRoom()
      if ((bits & READ_BITS) !== 0 && room > 0) {
        const got: i32 = netRead(sock.fd, conn.inputBuffer(), conn.inputEnd(), room)
        if (got > 0) {
          conn.received(got)
        } else if (got !== AGAIN) {
          this.fail(sock, conn)
        }
      }
    }
  }

  /** Fails every connect past its deadline. */
  private timeouts(pool: PgPool): void {
    let now: i64 = 0
    for (let s: i32 = 0; s < toI32(this.sockets.length); s++) {
      const sock: ArenaSocket = this.sockets[s]
      if (sock.deadline > 0) {
        if (now === 0) {
          now = monotonicNanos()
        }
        const conn: PgConnection = pool.connection(s)
        if (now >= sock.deadline && conn.failure === PG_ERR_NONE) {
          this.fail(sock, conn)
        }
      }
    }
  }

  private fail(sock: ArenaSocket, conn: PgConnection): void {
    conn.closed()
    sock.deadline = 0
  }

  /** Answers every event each connection's input holds. */
  private events(h: HttpServer, pool: PgPool): void {
    for (let s: i32 = 0; s < toI32(this.sockets.length); s++) {
      const sock: ArenaSocket = this.sockets[s]
      if (!sock.made) {
        continue
      }
      let event: i32 = pool.next(s)
      while (event !== PG_NEED_MORE) {
        if (event === PG_READY) {
          sock.deadline = 0
        } else if (event === PG_FAILED) {
          if (sock.fd >= 0) {
            pollRemove(this.loop, sock.fd)
            netClose(sock.fd)
            sock.fd = -1
          }
          sock.deadline = 0
        } else if (event !== PG_COMPLETE) {
          this.jobEvent(h, pool, pool.connection(s), event)
        }
        event = pool.next(s)
      }
    }
  }

  /** A row, error, end or loss of the query `pool.ticket` names. */
  private jobEvent(h: HttpServer, pool: PgPool, conn: PgConnection, event: i32): void {
    const ticket: i32 = pool.ticket
    if (ticket < 0) {
      return
    }
    const at: i32 = ticket & (RING - 1)
    const index: i32 = this.ring[at]
    if (index < 0 || index >= toI32(this.jobs.length)) {
      return
    }
    const job: ArenaJob = this.jobs[index]
    if (event === PG_ROW) {
      this.row(job, conn)
    } else if (event === PG_ERROR) {
      job.failed = true
    } else if (event === PG_GROUP_DONE || event === PG_LOST) {
      this.ring[at] = -1
      this.finish(h, index, job.failed || event === PG_LOST || conn.groupFailed)
    }
  }

  /** Appends the row `conn` holds to `job`'s answer. */
  private row(job: ArenaJob, conn: PgConnection): void {
    const w: JsonWriter = job.w
    const buf: u8[] = conn.inputBuffer()
    w.beginObject()
    w.key("id")
    w.i64(conn.int(0))
    w.key("name")
    w.stringBytes(buf, conn.colStart(1), conn.colLength(1))
    w.key("category")
    w.stringBytes(buf, conn.colStart(2), conn.colLength(2))
    w.key("price")
    w.i64(conn.int(3))
    w.key("quantity")
    w.i64(conn.int(4))
    w.key("active")
    w.boolean(conn.bool(5))
    w.key("tags")
    // jsonb's text form is JSON already.
    w.raw(buf, conn.colStart(6), conn.colLength(6))
    w.key("rating")
    w.beginObject()
    w.key("score")
    w.i64(conn.int(7))
    w.key("count")
    w.i64(conn.int(8))
    w.endObject()
    w.endObject()
    job.count += 1
  }

  /** Answers job `index` with its rows, or empty when `failed` or its answer overflowed, and frees it. */
  private finish(h: HttpServer, index: i32, failed: boolean): void {
    const job: ArenaJob = this.jobs[index]
    const r: HttpServerRequest | null = job.r
    job.r = null
    this.free.push(index)
    if (r === null) {
      return
    }
    const w: JsonWriter = job.w
    if (!failed) {
      w.endArray()
      w.key("count")
      w.i64(job.count)
      w.endObject()
    }
    if (failed || w.failed !== 0 || !w.complete()) {
      this.failures += 1
      this.sendEmpty(h, r)
      return
    }
    h.send(r, 200, this.jsonType, w.buf, 0, w.written())
  }

  /** Builds each queued query on the connection the pool hands it to. */
  private dispatch(h: HttpServer, pool: PgPool): void {
    let slot: i32 = pool.dispatch()
    while (slot >= 0) {
      const at: i32 = pool.ticket & (RING - 1)
      const index: i32 = pool.ticket < 0 ? -1 : this.ring[at]
      if (index >= 0 && index < toI32(this.jobs.length)) {
        const job: ArenaJob = this.jobs[index]
        const conn: PgConnection = pool.connection(slot)
        const built: boolean =
          conn.bindStart("items") &&
          conn.paramInt(job.min) &&
          conn.paramInt(job.max) &&
          conn.paramInt(job.limit) &&
          conn.bindEnd()
        if (!built) {
          conn.bindCancel()
        }
        if (!pool.send() && conn.failure === PG_ERR_NONE) {
          // Dropped unwritten: no event will come for it.
          this.ring[at] = -1
          this.finish(h, index, true)
        }
      } else {
        pool.send()
      }
      slot = pool.dispatch()
    }
  }

  /**
   * Connects the slots the pool wants (when `connect`), then writes what
   * each connection queued, asking for writability while some stays. True
   * when a socket failed, so its events are owed.
   */
  private connectAndFlush(pool: PgPool, connect: boolean): boolean {
    let failed: boolean = false
    if (connect) {
      let want: i32 = pool.wanted()
      const deadline: i64 = monotonicNanos() + CONNECT_NS
      while (want >= 0 && want < toI32(this.sockets.length)) {
        const sock: ArenaSocket = this.sockets[want]
        crypto.getRandomValues(this.nonce)
        pool.connect(want, this.nonce)
        sock.made = true
        sock.connected = false
        sock.interest = H1_WANT_WRITE
        sock.deadline = deadline
        const fd: i32 = this.target.unix ? unixConnect(this.target.path) : tcpConnect(this.address)
        sock.fd = fd
        if (fd < 0 || pollAdd(this.loop, fd, H1_WANT_WRITE, want) < 0) {
          this.fail(sock, pool.connection(want))
          failed = true
        }
        want = pool.wanted()
      }
    }
    for (let s: i32 = 0; s < toI32(this.sockets.length); s++) {
      const sock: ArenaSocket = this.sockets[s]
      if (sock.fd < 0 || !sock.connected) {
        continue
      }
      const conn: PgConnection = pool.connection(s)
      if (conn.failure !== PG_ERR_NONE) {
        continue
      }
      if (!this.flush(conn, sock.fd)) {
        this.fail(sock, conn)
        failed = true
        continue
      }
      const wants: i32 = conn.outputEnd() > conn.outputStart() ? H1_WANT_READ | H1_WANT_WRITE : H1_WANT_READ
      if (wants !== sock.interest) {
        pollModify(this.loop, sock.fd, wants, s)
        sock.interest = wants
      }
    }
    return failed
  }

  /** Writes what `conn` queued until the socket takes no more; false when the socket failed. */
  private flush(conn: PgConnection, fd: i32): boolean {
    while (true) {
      const start: i32 = conn.outputStart()
      const end: i32 = conn.outputEnd()
      if (start < 0 || end <= start) {
        return true
      }
      const n: i32 = netWrite(fd, conn.outputBuffer(), start, end - start)
      if (n === AGAIN) {
        return true
      }
      if (n <= 0) {
        return false
      }
      conn.sent(n)
    }
  }

  private sendEmpty(h: HttpServer, r: HttpServerRequest): void {
    h.send(r, 200, this.jsonType, this.empty, 0, toI32(this.empty.length))
  }
}
