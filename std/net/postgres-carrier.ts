/**
 * nish/net/postgres-carrier: `PgCarrier`, a `PgPool`'s queries on an
 * `HttpHandler`'s loop, so a route handler queries PostgreSQL without
 * blocking its worker.
 *
 * `nish/net/postgres` reads no socket, clock or entropy source; this module is
 * the one that does, and it is kept apart so that one stays sans-IO. The
 * carrier's sockets sit in an epoll set the handler watches (`HttpHandler.watch`), a
 * route handler hands a request to `run` (or to `runInt` and `runText` for an
 * attached `PgBatcher`), and `next()` answers `PG_CARRIER_BUILD` to bind a
 * plain query on `connection()`, its rows, and one final event —
 * `PG_CARRIER_DONE`, `PG_CARRIER_MISSING` or `PG_CARRIER_FAILED` — with
 * `request()` the `HttpRequest` to answer. It connects its pool's slots
 * itself, gives up on one that has not answered in `connectTimeoutMs`, and
 * sizes every table from `PgCarrierLimits` at construction.
 *
 * `tests/link/std_postgres_carrier` runs one against a loopback backend;
 * `tests/postgres/carrier.ts` against a live server. Caps and findings:
 * `docs/security/postgres.md`.
 *
 * Written for this module; not ported from another implementation.
 */
import { HttpHandler, HttpRequest } from "nish/net/handler"
import {
  PG_BATCH_DONE,
  PG_BATCH_FAILED,
  PG_BATCH_NONE,
  PG_BATCH_ROW,
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
  PgBatcher,
  PgConnection,
  PgPool,
  PgTarget,
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

/** The client nonce a SCRAM exchange starts with, as `PgPool.connect` takes it. */
const PG_CARRIER_NONCE_BYTES: i32 = 18

/** `PgCarrier.next()`: nothing more this turn; wait on the handler again. */
export const PG_CARRIER_NONE: i32 = 0
/** A plain query has its connection: bind it on `connection()`, then call `send()`. */
export const PG_CARRIER_BUILD: i32 = 1
/** A row for `query`, to read on `connection()` before the next call. */
export const PG_CARRIER_ROW: i32 = 2
/** A plain query's statement finished: `connection().tagRows()` reads its tag. */
export const PG_CARRIER_COMPLETE: i32 = 3
/** The server refused a plain query's statement: `connection().lastError` says why, and `PG_CARRIER_FAILED` follows. */
export const PG_CARRIER_ERROR: i32 = 4
/** `query` is over and it worked: answer its request. A final event. */
export const PG_CARRIER_DONE: i32 = 5
/** A batched query's key has no row. A final event. */
export const PG_CARRIER_MISSING: i32 = 6
/** `query` is over and it failed (`failure` and `socketError` say how). A final event. */
export const PG_CARRIER_FAILED: i32 = 7
/** `run`, `runInt` or `runText`: no room for another query now. */
export const PG_CARRIER_FULL: i32 = -2

/** `netRead` and `netWrite`: nothing to do now. */
const PG_CARRIER_AGAIN: i32 = -11
/** The readiness bits `pollAdd` takes and `pollWait` answers. */
const PG_CARRIER_READ: i32 = 1
const PG_CARRIER_WRITE: i32 = 2
/** A ready socket with input to read: readable, or hung up or in error. */
const PG_CARRIER_READ_BITS: i32 = 5
/** The socket error a connection past its connect timeout reports (ETIMEDOUT). */
const PG_CARRIER_TIMED_OUT: i32 = -110
/** The most batchers one carrier routes. */
const PG_CARRIER_MAX_BATCHERS: i32 = 8
/** The most queries or executions one carrier holds. */
const PG_CARRIER_MAX_QUERIES: i32 = 65536
/** Where `next()` is in its pass, so that a call resumes where the last stopped. */
const PG_CARRIER_POLL: i32 = 0
const PG_CARRIER_SLOTS: i32 = 1
const PG_CARRIER_DISPATCH: i32 = 2
const PG_CARRIER_FLUSH: i32 = 3
/** `pgCarrierDispatch`: look again, something is owed. */
const PG_CARRIER_AGAIN_PASS: i32 = -1

/**
 * The caps a `PgCarrier` is built with, all set before it starts: nothing
 * grows after.
 */
export class PgCarrierLimits {
  /** The most queries waiting at once, plain and batched (1 to 65536). */
  queries: i32 = 256
  /** The most batched executions waiting or in flight at once (1 to 65536). */
  executions: i32 = 64
  /** How long a connection has to connect and authenticate before it fails, in milliseconds (1 to 3600000). */
  connectTimeoutMs: i32 = 5000
  /** The id the carrier's descriptor is watched under on the handler (`HttpHandler.watch`). */
  watch: i32 = 0
}

/**
 * A `PgPool` on an `HttpHandler`'s loop: the pool's sockets sit in one
 * epoll set of the carrier's own, which the handler watches beside its
 * connections, so that a route handler queries PostgreSQL without blocking
 * its worker. Each turn the program waits on the handler, hands the requests
 * it takes to `run` (or `runInt` and `runText`, for an attached `PgBatcher`),
 * and reads `next()` until `PG_CARRIER_NONE`: every query gets its rows and
 * then exactly one final event (`PG_CARRIER_DONE`, `PG_CARRIER_MISSING` or
 * `PG_CARRIER_FAILED`), with `request()` the `HttpRequest` to answer and
 * `tag` the program's own number for what was asked.
 *
 * The carrier connects the slots the pool wants to `target`, which must be a
 * Unix socket or a numeric address (it resolves no names), reads and writes
 * their bytes, fails a connection that has not authenticated within
 * `connectTimeoutMs`, and closes a failed one's socket. A connection that
 * fails takes the queries on it with it, each `PG_CARRIER_FAILED`. Every
 * table is sized at construction from `PgCarrierLimits`: `run` answers
 * `PG_CARRIER_FULL` rather than grow one, and once its connections are up
 * nothing is allocated per query. A final event's query is freed on the
 * following `next()` call, so `query`, `tag` and `request()` hold until then.
 */
export class PgCarrier {
  private readonly pool: PgPool
  private readonly handler: HttpHandler
  private readonly path: string
  private readonly address: u8[]
  private readonly nonce: u8[]
  private readonly ready: i32[]
  private readonly timeoutNs: i64
  // Each pool slot's socket (-1 for none), whether its connect finished,
  // whether a connection was ever made in it, when its connect times out
  // (0 for no deadline), and the socket error that failed it.
  private readonly fds: i32[]
  private readonly connected: boolean[]
  private readonly made: boolean[]
  private readonly deadlines: i64[]
  private readonly errors: i32[]
  // Each query's tag, request, pool ticket (-1 for a batched one), whether
  // the server failed it, and the stack of free ones.
  private readonly qTags: i32[]
  private readonly qRequests: (HttpRequest | null)[]
  private readonly qTickets: i32[]
  private readonly qFailed: boolean[]
  private readonly qFree: i32[]
  // Each batched execution's batcher, run (-1 before `take`), whether its run
  // was ended, and the stack of free ones.
  private readonly eBatchers: i32[]
  private readonly eRuns: i32[]
  private readonly eEnded: boolean[]
  private readonly eFree: i32[]
  // Pool tickets to what they carry: a query, or `queries` plus an
  // execution. Open addressing, -1 for an empty slot.
  private readonly mapKeys: i32[]
  private readonly mapValues: i32[]
  private readonly batchers: PgBatcher[]
  private readonly batchQueued: boolean[]
  private readonly batchStalled: boolean[]
  private conn: PgConnection | null = null
  /** The query the last event is about, as `run` answered it; -1 for none. */
  query: i32 = -1
  /** The tag `query` was run with. */
  tag: i32 = -1
  /** Behind a `PG_CARRIER_FAILED`: the connection's `PG_ERR_*` failure when it was lost, else `PG_ERR_NONE` (the server's error, or a bind with no room). */
  failure: i32 = 0
  /** Behind a `PG_CARRIER_FAILED` for a lost connection: the socket error that ended it (`-110` for a connect timeout), or 0. */
  socketError: i32 = 0
  private readonly watchId: i32
  private readonly loop: i32
  private qFreeCount: i32 = 0
  private eFreeCount: i32 = 0
  private readonly mapMask: i32
  // What a call owes: the query being built, one dropped unsent, the query
  // whose final event was answered last, a run's events, and requests shed
  // from a batcher whose execution was lost.
  private building: i32 = -1
  private dropped: i32 = -1
  private finished: i32 = -1
  private drainBatcher: i32 = -1
  private drainRun: i32 = -1
  private drainFailure: i32 = 0
  private drainError: i32 = 0
  private shedBatcher: i32 = -1
  private shedLeft: i32 = 0
  private phase: i32 = 0
  private at: i32 = 0
  private readonly unix: boolean
  private connecting: boolean = true

  /**
   * A carrier for `pool`'s connections to `target`, its descriptor watched on
   * `handler` as `limits.watch`. Panics on a cap out of range, a target that
   * failed or is not a numeric address, or a watch id the handler refuses.
   */
  constructor(limits: PgCarrierLimits, pool: PgPool, target: PgTarget, handler: HttpHandler) {
    const queries: i32 = limits.queries
    const executions: i32 = limits.executions
    if (
      queries < 1 ||
      queries > PG_CARRIER_MAX_QUERIES ||
      executions < 1 ||
      executions > PG_CARRIER_MAX_QUERIES ||
      limits.connectTimeoutMs < 1 ||
      limits.connectTimeoutMs > 3600000
    ) {
      panic("nish/net/postgres-carrier: a PgCarrierLimits cap out of range")
    }
    if (target.failure !== PG_TARGET_OK) {
      panic("nish/net/postgres-carrier: a PgCarrier for a target that failed")
    }
    this.address = new Array<u8>(18)
    if (!target.unix && netAddress(this.address, target.host, target.port) < 0) {
      panic("nish/net/postgres-carrier: a PgCarrier's TCP host must be a numeric address")
    }
    this.pool = pool
    this.handler = handler
    this.watchId = limits.watch
    this.unix = target.unix
    this.path = target.path
    this.nonce = new Array<u8>(PG_CARRIER_NONCE_BYTES)
    this.timeoutNs = toI64(limits.connectTimeoutMs) * toI64(1000000)
    const size: i32 = pool.size
    this.ready = new Array<i32>(2 * size)
    this.fds = new Array<i32>(size)
    this.connected = new Array<boolean>(size)
    this.made = new Array<boolean>(size)
    this.deadlines = new Array<i64>(size)
    this.errors = new Array<i32>(size)
    for (let s: i32 = 0; s < size && s < toI32(this.fds.length); s++) {
      this.fds[s] = -1
    }
    this.qTags = new Array<i32>(queries)
    this.qRequests = new Array<HttpRequest | null>(queries)
    this.qTickets = new Array<i32>(queries)
    this.qFailed = new Array<boolean>(queries)
    this.qFree = new Array<i32>(queries)
    // Pushed highest first, so that the lowest is handed out first.
    for (let q: i32 = 0; q < queries && q < toI32(this.qFree.length); q++) {
      this.qFree[q] = queries - 1 - q
    }
    this.qFreeCount = queries
    this.eBatchers = new Array<i32>(executions)
    this.eRuns = new Array<i32>(executions)
    this.eEnded = new Array<boolean>(executions)
    this.eFree = new Array<i32>(executions)
    for (let e: i32 = 0; e < executions && e < toI32(this.eFree.length); e++) {
      this.eFree[e] = executions - 1 - e
    }
    this.eFreeCount = executions
    // At least twice the tickets ever held, a power of two for the mask.
    let mapSize: i32 = 2
    while (mapSize / 2 < queries + executions) {
      mapSize *= 2
    }
    this.mapKeys = new Array<i32>(mapSize)
    this.mapValues = new Array<i32>(mapSize)
    for (let i: i32 = 0; i < mapSize && i < toI32(this.mapKeys.length); i++) {
      this.mapKeys[i] = -1
    }
    this.mapMask = mapSize - 1
    this.batchers = []
    this.batchQueued = new Array<boolean>(PG_CARRIER_MAX_BATCHERS)
    this.batchStalled = new Array<boolean>(PG_CARRIER_MAX_BATCHERS)
    this.loop = pollCreate()
    if (this.loop < 0) {
      panic("nish/net/postgres-carrier: PgCarrier could not create its poll set")
    }
    handler.watch(this.loop, limits.watch)
  }

  /**
   * Registers `batcher`'s statement on the pool and answers its id for
   * `runInt` and `runText`. Panics once the pool has connected, as
   * `PgPool.register` refuses then, and past 8 batchers.
   */
  attach(batcher: PgBatcher): i32 {
    const id: i32 = toI32(this.batchers.length)
    const types: i32[] = []
    if (id >= PG_CARRIER_MAX_BATCHERS || !this.pool.register(batcher.name, batcher.sql, types)) {
      panic("nish/net/postgres-carrier: PgCarrier.attach after the pool connected, or past 8 batchers")
    }
    this.batchers.push(batcher)
    return id
  }

  /**
   * Queues a plain query for `req` (null for one of the program's own) and
   * answers its number; `PG_CARRIER_BUILD` comes for it once a connection
   * has room. `PG_CARRIER_FULL` when `queries` are waiting or the pool's
   * queue is full. Returns at once.
   */
  run(req: HttpRequest | null, tag: i32): i32 {
    const q: i32 = this.take(req, tag)
    if (q < 0) {
      return PG_CARRIER_FULL
    }
    const ticket: i32 = this.pool.request()
    if (ticket < 0) {
      this.free(q)
      return PG_CARRIER_FULL
    }
    this.qTickets[q] = ticket
    this.mapPut(ticket, q)
    return q
  }

  /** Queues `req`'s int8 `key` on batcher `batcher`, as `run` does a plain query; `PG_CARRIER_FULL` also when the batcher's queue is. */
  runInt(req: HttpRequest | null, batcher: i32, key: i64, tag: i32): i32 {
    const b: PgBatcher = this.batcher(batcher)
    const q: i32 = this.take(req, tag)
    if (q < 0) {
      return PG_CARRIER_FULL
    }
    if (!b.addInt(key, q)) {
      this.free(q)
      return PG_CARRIER_FULL
    }
    return q
  }

  /** Queues `req`'s text key `bytes[start, start + length)` on batcher `batcher`, as `runInt` does; also `PG_CARRIER_FULL` when `PgBatcher.addText` refuses the key. */
  runText(req: HttpRequest | null, batcher: i32, bytes: u8[], start: i32, length: i32, tag: i32): i32 {
    const b: PgBatcher = this.batcher(batcher)
    const q: i32 = this.take(req, tag)
    if (q < 0) {
      return PG_CARRIER_FULL
    }
    if (!b.addText(bytes, start, length, q)) {
      this.free(q)
      return PG_CARRIER_FULL
    }
    return q
  }

  /** The request `query` was run for. Panics when it was run with none, or no event named a query. */
  request(): HttpRequest {
    const q: i32 = this.query
    const req: HttpRequest | null = q >= 0 && q < toI32(this.qRequests.length) ? this.qRequests[q] : null
    if (req === null) {
      panic("nish/net/postgres-carrier: PgCarrier.request with no request for the query")
    }
    return req
  }

  /** The connection the last `PG_CARRIER_BUILD` or row is on. Panics before any. */
  connection(): PgConnection {
    const conn: PgConnection | null = this.conn
    if (conn === null) {
      panic("nish/net/postgres-carrier: PgCarrier.connection before any query had one")
    }
    return conn
  }

  /**
   * Ends the query `PG_CARRIER_BUILD` handed out, as `PgPool.send` does,
   * and answers whether it went. A bind left open is dropped, and the query
   * fails; one with nothing written fails at once, on the next `next()`.
   * Panics when no build is open.
   */
  send(): boolean {
    const q: i32 = this.building
    if (q < 0 || q >= toI32(this.qTickets.length)) {
      panic("nish/net/postgres-carrier: PgCarrier.send with no PG_CARRIER_BUILD open")
    }
    this.building = -1
    if (this.pool.send()) {
      return true
    }
    const conn: PgConnection = this.connection()
    if (conn.bindCancel()) {
      // The group may hold the connection's prepares, which still go; the query does not.
      this.qFailed[q] = true
      if (this.pool.send()) {
        return true
      }
    }
    // Nothing was written: a live connection dropped the query, and a failed
    // one reports it lost with the rest.
    if (conn.failure === PG_ERR_NONE) {
      this.mapRemove(this.qTickets[q])
      this.dropped = q
    }
    return false
  }

  /**
   * The next event, resuming where the last call stopped: the events the
   * pool's connections read, then the queries handed to connections
   * (`PG_CARRIER_BUILD`), then `PG_CARRIER_NONE` once their bytes are
   * written and nothing more can happen until the handler's next turn. The
   * connect timeout is checked here, so the program's `wait` timeout bounds
   * how late it fires. Panics while a `PG_CARRIER_BUILD` is unsent.
   */
  next(): i32 {
    if (this.building >= 0) {
      panic("nish/net/postgres-carrier: PgCarrier.next before send() ended the PG_CARRIER_BUILD")
    }
    if (this.finished >= 0) {
      this.free(this.finished)
      this.finished = -1
    }
    while (true) {
      if (this.dropped >= 0) {
        const q: i32 = this.dropped
        this.dropped = -1
        this.failure = PG_ERR_NONE
        this.socketError = 0
        return this.final(q, PG_CARRIER_FAILED)
      }
      if (this.drainRun >= 0) {
        const event: i32 = this.drain()
        if (event !== PG_CARRIER_NONE) {
          return event
        }
      }
      if (this.shedLeft > 0) {
        this.shedLeft -= 1
        const q: i32 = this.batcher(this.shedBatcher).shed()
        if (q >= 0) {
          return this.final(q, PG_CARRIER_FAILED)
        }
        this.shedLeft = 0
      }
      if (this.phase === PG_CARRIER_POLL) {
        this.poll()
        this.phase = PG_CARRIER_SLOTS
        this.at = 0
      }
      if (this.phase === PG_CARRIER_SLOTS) {
        const event: i32 = this.slots()
        if (event === PG_CARRIER_AGAIN_PASS) {
          continue
        }
        if (event !== PG_CARRIER_NONE) {
          return event
        }
        this.phase = PG_CARRIER_DISPATCH
      }
      if (this.phase === PG_CARRIER_DISPATCH) {
        const event: i32 = this.dispatch()
        if (event === PG_CARRIER_AGAIN_PASS) {
          continue
        }
        if (event !== PG_CARRIER_NONE) {
          return event
        }
        this.phase = PG_CARRIER_FLUSH
      }
      // Connects run once a pass, so that a server refusing at once cannot
      // spin the loop; a socket that failed has its events read before the
      // turn ends.
      const failed: boolean = this.connectAndFlush(this.connecting)
      this.connecting = false
      if (failed) {
        this.phase = PG_CARRIER_SLOTS
        this.at = 0
        continue
      }
      this.phase = PG_CARRIER_POLL
      this.connecting = true
      return PG_CARRIER_NONE
    }
  }

  /** Tells every connection the session is over, writes what it can of that, and closes the sockets and the carrier's poll set. The pool is the program's to `dispose()`. */
  close(): void {
    for (let s: i32 = 0; s < toI32(this.fds.length); s++) {
      const fd: i32 = this.fds[s]
      if (fd >= 0) {
        const conn: PgConnection = this.pool.connection(s)
        conn.terminate()
        this.flush(conn, fd)
        pollRemove(this.loop, fd)
        netClose(fd)
        this.fds[s] = -1
      }
    }
    netClose(this.loop)
  }

  // Reads what the sockets the poll set reports have, finishes their
  // connects, and fails the connections past their connect timeout.
  private poll(): void {
    if (this.handler.fired(this.watchId)) {
      const n: i32 = pollWait(this.loop, this.ready, toI32(0))
      for (let k: i32 = 0; k < n && 2 * k + 1 < toI32(this.ready.length); k++) {
        const s: i32 = this.ready[2 * k]
        const bits: i32 = this.ready[2 * k + 1]
        if (s >= 0 && s < toI32(this.fds.length) && this.fds[s] >= 0) {
          this.service(s, bits)
        }
      }
    }
    let now: i64 = 0
    for (let s: i32 = 0; s < toI32(this.deadlines.length); s++) {
      const deadline: i64 = this.deadlines[s]
      if (deadline > 0) {
        if (now === 0) {
          now = monotonicNanos()
        }
        if (now >= deadline) {
          this.fail(s, PG_CARRIER_TIMED_OUT)
        }
      }
    }
    for (let b: i32 = 0; b < toI32(this.batchStalled.length); b++) {
      this.batchStalled[b] = false
    }
  }

  // One ready socket: a connect finished, or input to read.
  private service(s: i32, bits: i32): void {
    const conn: PgConnection = this.pool.connection(s)
    if (conn.failure !== PG_ERR_NONE) {
      return
    }
    const fd: i32 = this.fds[s]
    if (!this.connected[s]) {
      const result: i32 = connectResult(fd)
      if (result !== 0) {
        this.fail(s, result)
        return
      }
      this.connected[s] = true
    }
    const room: i32 = conn.inputRoom()
    if ((bits & PG_CARRIER_READ_BITS) !== 0 && room > 0) {
      const got: i32 = netRead(fd, conn.inputBuffer(), conn.inputEnd(), room)
      if (got > 0) {
        conn.received(got)
      } else if (got !== PG_CARRIER_AGAIN) {
        this.fail(s, got)
      }
    }
  }

  // Ends slot `s`'s connection for `error`: its events then say so.
  private fail(s: i32, error: i32): void {
    this.pool.connection(s).closed()
    this.errors[s] = error
    this.deadlines[s] = 0
  }

  // The events of every slot's connection, resuming at `at`.
  private slots(): i32 {
    while (this.at < toI32(this.made.length)) {
      const s: i32 = this.at
      if (!this.made[s]) {
        this.at += 1
        continue
      }
      const event: i32 = this.pool.next(s)
      if (event === PG_NEED_MORE) {
        this.at += 1
        continue
      }
      const routed: i32 = this.route(s, event)
      if (routed !== PG_CARRIER_NONE) {
        return routed
      }
    }
    return PG_CARRIER_NONE
  }

  // One pool event from slot `s`, as the carrier's own; `PG_CARRIER_NONE`
  // for one it keeps, `PG_CARRIER_AGAIN_PASS` when a run's events are owed.
  private route(s: i32, event: i32): i32 {
    const conn: PgConnection = this.pool.connection(s)
    if (event === PG_READY) {
      this.deadlines[s] = 0
      return PG_CARRIER_NONE
    }
    if (event === PG_FAILED) {
      const fd: i32 = this.fds[s]
      if (fd >= 0) {
        pollRemove(this.loop, fd)
        netClose(fd)
        this.fds[s] = -1
      }
      this.deadlines[s] = 0
      return PG_CARRIER_NONE
    }
    const ticket: i32 = this.pool.ticket
    const v: i32 = ticket < 0 ? -1 : this.mapGet(ticket)
    if (v < 0) {
      // A notice, or the event of a query no longer held.
      return PG_CARRIER_NONE
    }
    this.conn = conn
    const queries: i32 = toI32(this.qTags.length)
    if (v < queries) {
      return this.routePlain(s, v, ticket, event, conn)
    }
    return this.routeBatch(s, v - queries, ticket, event, conn)
  }

  private routePlain(s: i32, q: i32, ticket: i32, event: i32, conn: PgConnection): i32 {
    if (event === PG_ROW || event === PG_COMPLETE) {
      this.query = q
      this.tag = this.qTags[q]
      return event === PG_ROW ? PG_CARRIER_ROW : PG_CARRIER_COMPLETE
    }
    if (event === PG_ERROR) {
      this.qFailed[q] = true
      this.query = q
      this.tag = this.qTags[q]
      return PG_CARRIER_ERROR
    }
    if (event === PG_GROUP_DONE) {
      this.mapRemove(ticket)
      const failed: boolean = this.qFailed[q] || conn.groupFailed
      this.failure = PG_ERR_NONE
      this.socketError = 0
      return this.final(q, failed ? PG_CARRIER_FAILED : PG_CARRIER_DONE)
    }
    if (event === PG_LOST) {
      this.mapRemove(ticket)
      this.failure = conn.failure
      this.socketError = this.errors[s]
      return this.final(q, PG_CARRIER_FAILED)
    }
    return PG_CARRIER_NONE
  }

  private routeBatch(s: i32, e: i32, ticket: i32, event: i32, conn: PgConnection): i32 {
    const id: i32 = this.eBatchers[e]
    const b: PgBatcher = this.batcher(id)
    const r: i32 = this.eRuns[e]
    if (event === PG_LOST && r < 0) {
      // Lost before a connection took it: its requests would wait on a
      // server that cannot be reached, so one execution's worth fail now.
      this.mapRemove(ticket)
      this.freeExecution(e)
      this.batchQueued[id] = false
      this.shedBatcher = id
      this.shedLeft = b.maxRequests
      this.failure = conn.failure
      this.socketError = this.errors[s]
      return PG_CARRIER_AGAIN_PASS
    }
    if (r < 0) {
      return PG_CARRIER_NONE
    }
    if (event === PG_ROW) {
      if (b.row(r, conn)) {
        this.startDrain(id, r, PG_ERR_NONE, toI32(0))
        return PG_CARRIER_AGAIN_PASS
      }
      return PG_CARRIER_NONE
    }
    if (event === PG_COMPLETE) {
      b.end(r)
      this.eEnded[e] = true
      this.startDrain(id, r, PG_ERR_NONE, toI32(0))
      return PG_CARRIER_AGAIN_PASS
    }
    if (event === PG_ERROR || event === PG_GROUP_DONE || event === PG_LOST) {
      const lost: boolean = event === PG_LOST
      if (event !== PG_ERROR) {
        this.mapRemove(ticket)
        this.freeExecution(e)
      }
      if (!this.eEnded[e]) {
        b.fail(r)
        this.eEnded[e] = true
        this.startDrain(id, r, lost ? conn.failure : PG_ERR_NONE, lost ? this.errors[s] : toI32(0))
        return PG_CARRIER_AGAIN_PASS
      }
    }
    return PG_CARRIER_NONE
  }

  private startDrain(id: i32, r: i32, failure: i32, error: i32): void {
    this.drainBatcher = id
    this.drainRun = r
    this.drainFailure = failure
    this.drainError = error
  }

  // The next of the events a run owes, as the carrier's own.
  private drain(): i32 {
    const b: PgBatcher = this.batcher(this.drainBatcher)
    const event: i32 = b.next(this.drainRun)
    const q: i32 = b.tag
    if (event === PG_BATCH_NONE || q < 0 || q >= toI32(this.qTags.length)) {
      this.drainRun = -1
      return PG_CARRIER_NONE
    }
    if (event === PG_BATCH_ROW) {
      this.query = q
      this.tag = this.qTags[q]
      return PG_CARRIER_ROW
    }
    if (event === PG_BATCH_FAILED) {
      this.failure = this.drainFailure
      this.socketError = this.drainError
      return this.final(q, PG_CARRIER_FAILED)
    }
    this.failure = PG_ERR_NONE
    this.socketError = 0
    return this.final(q, event === PG_BATCH_DONE ? PG_CARRIER_DONE : PG_CARRIER_MISSING)
  }

  // Queues an execution for each batcher with requests waiting, then hands
  // waiting tickets to connections: a plain query's is the program's to
  // build, an execution's is bound here.
  private dispatch(): i32 {
    for (let id: i32 = 0; id < toI32(this.batchers.length) && id < PG_CARRIER_MAX_BATCHERS; id++) {
      if (this.batchQueued[id] || this.batchStalled[id] || this.batchers[id].waiting() === 0 || this.eFreeCount === 0) {
        continue
      }
      const ticket: i32 = this.pool.request()
      if (ticket < 0) {
        break
      }
      this.eFreeCount -= 1
      const e: i32 = this.eFree[this.eFreeCount]
      this.eBatchers[e] = id
      this.eRuns[e] = -1
      this.eEnded[e] = false
      this.mapPut(ticket, toI32(this.qTags.length) + e)
      this.batchQueued[id] = true
    }
    const slot: i32 = this.pool.dispatch()
    if (slot < 0) {
      return PG_CARRIER_NONE
    }
    const conn: PgConnection = this.pool.connection(slot)
    const ticket: i32 = this.pool.ticket
    const v: i32 = this.mapGet(ticket)
    const queries: i32 = toI32(this.qTags.length)
    if (v >= 0 && v < queries) {
      this.conn = conn
      this.building = v
      this.query = v
      this.tag = this.qTags[v]
      return PG_CARRIER_BUILD
    }
    if (v < 0) {
      this.pool.send()
      return PG_CARRIER_AGAIN_PASS
    }
    const e: i32 = v - queries
    const id: i32 = this.eBatchers[e]
    const b: PgBatcher = this.batcher(id)
    this.batchQueued[id] = false
    const r: i32 = b.take(conn)
    if (r < 0) {
      // Every run is in flight, or the connection had no room for the bind:
      // the requests stay queued for the next turn.
      this.batchStalled[id] = true
      this.pool.send()
      if (conn.failure === PG_ERR_NONE) {
        this.mapRemove(ticket)
        this.freeExecution(e)
      }
      return PG_CARRIER_AGAIN_PASS
    }
    this.eRuns[e] = r
    if (!this.pool.send() && conn.failure === PG_ERR_NONE) {
      this.mapRemove(ticket)
      this.freeExecution(e)
      b.fail(r)
      this.startDrain(id, r, PG_ERR_NONE, toI32(0))
    }
    return PG_CARRIER_AGAIN_PASS
  }

  // Connects the slots the pool wants (when `connect`), then writes what
  // each connection queued and asks for writability while some stays.
  // True when a socket failed and its events are owed.
  private connectAndFlush(connect: boolean): boolean {
    let failed: boolean = false
    if (connect) {
      let slot: i32 = this.pool.wanted()
      while (slot >= 0 && slot < toI32(this.fds.length)) {
        crypto.getRandomValues(this.nonce)
        this.pool.connect(slot, this.nonce)
        this.made[slot] = true
        this.connected[slot] = false
        this.errors[slot] = 0
        this.deadlines[slot] = monotonicNanos() + this.timeoutNs
        const fd: i32 = this.unix ? unixConnect(this.path) : tcpConnect(this.address)
        this.fds[slot] = fd
        if (fd < 0) {
          this.fail(slot, fd)
          failed = true
        } else if (pollAdd(this.loop, fd, PG_CARRIER_WRITE, slot) < 0) {
          this.fail(slot, toI32(-1))
          failed = true
        }
        slot = this.pool.wanted()
      }
    }
    for (let s: i32 = 0; s < toI32(this.fds.length); s++) {
      const fd: i32 = this.fds[s]
      if (fd < 0 || !this.connected[s]) {
        continue
      }
      const conn: PgConnection = this.pool.connection(s)
      if (conn.failure !== PG_ERR_NONE) {
        continue
      }
      const written: i32 = this.flush(conn, fd)
      if (written < 0) {
        this.fail(s, written)
        failed = true
        continue
      }
      const wants: i32 = conn.outputEnd() > conn.outputStart() ? PG_CARRIER_READ | PG_CARRIER_WRITE : PG_CARRIER_READ
      pollModify(this.loop, fd, wants, s)
    }
    return failed
  }

  // Writes what `conn` queued until the socket takes no more; the socket
  // error when it fails, else 0.
  private flush(conn: PgConnection, fd: i32): i32 {
    while (conn.outputEnd() > conn.outputStart()) {
      const n: i32 = netWrite(fd, conn.outputBuffer(), conn.outputStart(), conn.outputEnd() - conn.outputStart())
      if (n === PG_CARRIER_AGAIN) {
        return 0
      }
      if (n <= 0) {
        return n < 0 ? n : -1
      }
      conn.sent(n)
    }
    return 0
  }

  // Answers query `q`'s final `event`; the query is freed on the next call.
  private final(q: i32, event: i32): i32 {
    this.query = q
    this.tag = this.qTags[q]
    this.finished = q
    return event
  }

  private batcher(id: i32): PgBatcher {
    if (id < 0 || id >= toI32(this.batchers.length)) {
      panic("nish/net/postgres-carrier: PgCarrier batcher id out of range")
    }
    return this.batchers[id]
  }

  // A free query for `req` and `tag`, or -1.
  private take(req: HttpRequest | null, tag: i32): i32 {
    if (this.qFreeCount === 0) {
      return -1
    }
    this.qFreeCount -= 1
    const q: i32 = this.qFree[this.qFreeCount]
    this.qTags[q] = tag
    this.qRequests[q] = req
    this.qTickets[q] = -1
    this.qFailed[q] = false
    return q
  }

  private free(q: i32): void {
    this.qRequests[q] = null
    this.qFree[this.qFreeCount] = q
    this.qFreeCount += 1
  }

  private freeExecution(e: i32): void {
    this.eFree[this.eFreeCount] = e
    this.eFreeCount += 1
  }

  private mapPut(key: i32, value: i32): void {
    const mask: i32 = this.mapMask
    let i: i32 = key & mask
    while (this.mapKeys[i] !== -1) {
      i = (i + 1) & mask
    }
    this.mapKeys[i] = key
    this.mapValues[i] = value
  }

  private mapGet(key: i32): i32 {
    const mask: i32 = this.mapMask
    let i: i32 = key & mask
    while (this.mapKeys[i] !== -1) {
      if (this.mapKeys[i] === key) {
        return this.mapValues[i]
      }
      i = (i + 1) & mask
    }
    return -1
  }

  // Removes `key`, shifting back the entries after it that would no longer
  // be found past the hole, so that no tombstone is ever left.
  private mapRemove(key: i32): void {
    const mask: i32 = this.mapMask
    let i: i32 = key & mask
    while (this.mapKeys[i] !== key) {
      if (this.mapKeys[i] === -1) {
        return
      }
      i = (i + 1) & mask
    }
    let j: i32 = i
    while (true) {
      j = (j + 1) & mask
      const k: i32 = this.mapKeys[j]
      if (k === -1) {
        break
      }
      // The entry at `j` stays when its home is cyclically within (i, j].
      const home: i32 = k & mask
      const stays: boolean = i <= j ? home > i && home <= j : home > i || home <= j
      if (!stays) {
        this.mapKeys[i] = k
        this.mapValues[i] = this.mapValues[j]
        i = j
      }
    }
    this.mapKeys[i] = -1
  }
}
