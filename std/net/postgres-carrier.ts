/**
 * `nish/net/postgres-carrier` — `PgCarrier`, a `PgPool`'s queries on an
 * `HttpHandler`'s loop, so a route handler queries PostgreSQL without
 * blocking its worker.
 *
 *     import { HttpRequest } from "nish/net/handler"
 *     import { PgConnection, pgTarget } from "nish/net/postgres"
 *     import {
 *       PG_CARRIER_BUILD, PG_CARRIER_DONE, PG_CARRIER_FAILED, PG_CARRIER_FULL,
 *       PG_CARRIER_MISSING, PG_CARRIER_NONE, PG_CARRIER_ROW, PgCarrier, PgCarrierLimits,
 *     } from "nish/net/postgres-carrier"
 *
 *     // A sketch: `pool` registered "article"; `handler` serves the routes;
 *     // `ARTICLE` is the route's tag, `running` the server's loop condition,
 *     // and `text` and `none` the program's content-type and empty body.
 *     const carrier = new PgCarrier(new PgCarrierLimits(), pool, pgTarget("127.0.0.1", 5432), handler)
 *     const answered: boolean[] = new Array<boolean>(256)  // one per query number
 *     while (running) {
 *       handler.wait(50)  // a timeout, so the connect timeout is checked
 *       while (handler.ready()) {
 *         const req: HttpRequest = handler.take()
 *         if (carrier.run(req, ARTICLE) === PG_CARRIER_FULL) {
 *           handler.send(req, 503, text, none, 0, 0)
 *         }
 *       }
 *       let event: i32 = carrier.next()
 *       while (event !== PG_CARRIER_NONE) {
 *         if (event === PG_CARRIER_BUILD) {
 *           const conn: PgConnection = carrier.connection()
 *           conn.bindStart("article")
 *           conn.paramInt(toI64(carrier.request().paramDecimal(0)))
 *           conn.bindEnd()
 *           carrier.send()
 *         } else if (event === PG_CARRIER_ROW && !answered[carrier.query]) {
 *           const conn: PgConnection = carrier.connection()
 *           handler.send(carrier.request(), 200, text, conn.inputBuffer(), conn.colStart(0), conn.colLength(0))
 *           answered[carrier.query] = true
 *         } else if (event === PG_CARRIER_DONE || event === PG_CARRIER_MISSING || event === PG_CARRIER_FAILED) {
 *           if (!answered[carrier.query]) {
 *             handler.send(carrier.request(), event === PG_CARRIER_FAILED ? 503 : 404, text, none, 0, 0)
 *           }
 *           answered[carrier.query] = false
 *         }
 *         event = carrier.next()
 *       }
 *     }
 *     carrier.close()
 *     pool.dispose()
 *
 * **Why a module of its own.** `nish/net/postgres` reads no socket, clock or entropy source; this module is
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
 * **Lifetime.** A query number from `run`, `runInt` or `runText`, with its
 * `tag` and `request()`, holds until the `next()` after its final event,
 * which frees the number for reuse; a row's bytes on `connection()` hold
 * only until the next call. The carrier never answers a request itself: the
 * program answers each one once, on its first row or on its final event.
 *
 * **Limits.** Every cap is fixed at construction (`PgCarrierLimits`), so a
 * full carrier answers `PG_CARRIER_FULL` rather than grow, and once the
 * connections are up nothing is allocated per query. There is no deadline on
 * a query once its connection is up; bound a slow statement with the
 * server's `statement_timeout`.
 *
 * **Errors.** A connection that is refused, reset, closed or past its connect
 * timeout fails every query on it with `PG_CARRIER_FAILED`, `failure` the
 * connection's `PG_ERR_*` and `socketError` the socket's negative errno
 * (`-110` for the timeout, 0 when the server closed cleanly; under TLS, see
 * below). A plain query
 * the server refuses answers `PG_CARRIER_ERROR`, then `PG_CARRIER_FAILED`
 * with `failure` `PG_ERR_NONE`; a batched query the server refuses answers
 * only `PG_CARRIER_FAILED` with `failure` `PG_ERR_NONE`.
 * Programming errors (a cap out of range, an unknown batcher id, `send()`
 * with no build open) panic.
 *
 * **TLS.** With `PgConfig.tls` set to `PG_TLS_REQUIRE` or `PG_TLS_VERIFY_FULL`,
 * each connection opens with an SSLRequest and reads exactly the one byte of
 * its answer, so nothing the server sends in the clear reaches the protocol:
 * after `N` nothing more is read, and after `S` the next bytes are the
 * handshake's, so anything else fails it. `S` goes on to a TLS 1.3 handshake
 * (`nish/net/tls/record-client`) driven on the same loop without blocking, the
 * StartupMessage held until it is done; any other answer fails the connection
 * with `PG_ERR_TLS`. Under `PG_TLS_VERIFY_FULL` the server's chain is checked
 * with `nish/net/tls/verify` against `PgConfig.tlsRootsPath` (or the system's
 * store) and its name against `tlsServerName` (or the target's host);
 * `PG_TLS_REQUIRE` encrypts without checking who answered. A refused
 * certificate or failed handshake is `PG_ERR_TLS` with `socketError` the TLS
 * alert (positive); a refused SSLRequest has `socketError` 0. TLS needs a TCP
 * target.
 *
 * `tests/link/std_postgres_carrier` runs one against a loopback backend,
 * `tests/link/std_postgres_tls` one over TLS; `tests/postgres/carrier.ts`
 * against a live server. Caps and findings: `docs/security/postgres.md`.
 *
 * Written for this module; not ported from another implementation.
 */
import { HANDLER_MAX_WATCHED, HttpHandler, HttpRequest } from "nish/net/handler"
import { H1_WANT_READ, H1_WANT_WRITE } from "nish/net/http1-server"
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
  PG_TLS_DISABLE,
  PG_TLS_VERIFY_FULL,
  PgBatcher,
  PgConfig,
  PgConnection,
  PgPool,
  PgTarget,
  pgSslRequest,
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
import { monotonicNanos, wallClockNanos } from "nish:process"
import { PkiRoots, pkiLoadRoots, pkiLoadSystemRoots } from "nish/crypto/pki-roots"
import { TlsClient, TlsClientConfig } from "nish/net/tls/client"
import { TLS_GROUP_SECP256R1, TLS_GROUP_X25519 } from "nish/net/tls/codec"
import { TLS_RECORD_AUTH, TlsRecordClient } from "nish/net/tls/record-client"
import { TLS_RECORD_STATE_FAILED, TLS_RECORD_STATE_OPEN } from "nish/net/tls/record-server"
import { TlsClientTrust, tlsClientTrust, tlsClientVerdict } from "nish/net/tls/verify"

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
/** A slot's TLS phase: none, the connection is cleartext. */
const PG_CARRIER_TLS_OFF: i32 = 0
/** A slot's TLS phase: the SSLRequest is being sent, or its answer awaited. */
const PG_CARRIER_TLS_ASK: i32 = 1
/** A slot's TLS phase: the server said `S`; the handshake is under way. */
const PG_CARRIER_TLS_HANDSHAKE: i32 = 2
/** A slot's TLS phase: the handshake is done; the protocol runs inside it. */
const PG_CARRIER_TLS_OPEN: i32 = 3
/** The bytes of key material a TLS client starts from: its random, an x25519 and a P-256 private key. */
const PG_CARRIER_TLS_KEY_BYTES: i32 = 32
/** The most ciphertext read from a socket at once: one largest record and its header. */
const PG_CARRIER_TLS_READ_BYTES: i32 = 16645
/** A zero that stays `i32` under `--number-mode f64`: no bytes, no offset, no alert. */
const PG_CARRIER_ZERO: i32 = 0
/** The byte a server answers an SSLRequest with to go on with TLS. */
const PG_CARRIER_TLS_YES: i32 = 83

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
  /** The id the carrier's descriptor is watched under on the handler (`HttpHandler.watch`), 0 to `HANDLER_MAX_WATCHED - 1`. */
  watch: i32 = 0
}

// One pool slot's socket and what the carrier knows of it, one object per
// slot so that a slot's number is checked against the table once and its
// fields read without a check each.
class PgCarrierSlot {
  // When its connect times out, 0 for no deadline.
  deadline: i64 = 0
  // Its TLS client, once the server agreed to TLS.
  tls: TlsRecordClient | null = null
  // The slot's number in the pool.
  readonly index: i32
  // The socket, -1 for none.
  fd: i32 = -1
  // Whether its connect finished.
  connected: boolean = false
  // The events the socket is watched for, so that one unchanged is not
  // asked for again.
  interest: i32 = 0
  // Whether a connection was ever made in it.
  made: boolean = false
  // The socket error that failed it.
  error: i32 = 0
  // Its TLS phase (`PG_CARRIER_TLS_*`), and how much of the SSLRequest has
  // gone out.
  tlsPhase: i32 = 0
  tlsAsked: i32 = 0

  constructor(index: i32) {
    this.index = index
  }
}

// One query number's state: its tag, request, pool ticket (-1 for a batched
// one), and whether the server failed it.
class PgCarrierQuery {
  readonly index: i32
  tag: i32 = -1
  request: HttpRequest | null = null
  ticket: i32 = -1
  failed: boolean = false

  constructor(index: i32) {
    this.index = index
  }
}

// One batched execution's state: its batcher, run (-1 before `take`), and
// whether its run was ended. `value` is what the ticket map holds for it,
// the query count plus its number, so that it is told apart from a query.
class PgCarrierExecution {
  readonly index: i32
  readonly value: i32
  batcher: i32 = -1
  run: i32 = -1
  ended: boolean = false

  constructor(index: i32, value: i32) {
    this.index = index
    this.value = value
  }
}

// An attached batcher, whether an execution of it is queued on the pool,
// and whether it stalled this turn with every run in flight.
class PgCarrierBatch {
  readonly batcher: PgBatcher
  queued: boolean = false
  stalled: boolean = false

  constructor(batcher: PgBatcher) {
    this.batcher = batcher
  }
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
  // Each pool slot's socket and state, by slot number.
  private readonly sockets: PgCarrierSlot[]
  // TLS (`PgConfig.tls`): the name checked and the roots it is checked
  // against; the SSLRequest, the one byte its answer is read into, and the
  // buffer ciphertext is read through.
  private readonly tlsName: string
  private readonly trust: TlsClientTrust | null
  private readonly sslRequest: u8[]
  private readonly tlsAnswer: u8[]
  private readonly tlsInput: u8[]
  // Each query by number, and the stack of free ones, lowest on top.
  private readonly held: PgCarrierQuery[]
  private readonly qFree: PgCarrierQuery[]
  // Each batched execution by number, and the stack of free ones.
  private readonly executions: PgCarrierExecution[]
  private readonly eFree: PgCarrierExecution[]
  // Pool tickets to what they carry: a query, or `queries` plus an
  // execution. Open addressing, -1 for an empty slot, probed in `u32` so
  // that the step wraps under the mask.
  private readonly mapKeys: i32[]
  private readonly mapValues: i32[]
  private readonly batchers: PgCarrierBatch[]
  private conn: PgConnection | null = null
  private readonly mapMask: u32
  /** The query the last event is about, as `run` answered it; -1 for none. */
  query: i32 = -1
  /** The tag `query` was run with. */
  tag: i32 = -1
  /** Behind a `PG_CARRIER_FAILED`: the connection's `PG_ERR_*` failure when it was lost, else `PG_ERR_NONE` (the server's error, or a bind with no room). */
  failure: i32 = 0
  /** Behind a `PG_CARRIER_FAILED` for a lost connection: the socket error that ended it (`-110` for a connect timeout), or 0. */
  socketError: i32 = 0
  private readonly tlsMode: i32
  private readonly watchId: i32
  private readonly loop: i32
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
  private closed: boolean = false

  /**
   * A carrier for `pool`'s connections to `target`, its descriptor watched on
   * `handler` as `limits.watch`. Panics on a cap or watch id out of range,
   * a target that failed or is not a numeric address, TLS asked for on a Unix
   * socket, `PG_TLS_VERIFY_FULL` with no root certificate to read from
   * `tlsRootsPath` (or the system's store), or a poll set the
   * system will not create. It allocates every table here and opens its poll
   * set, but connects nothing until the first `next()`.
   *
   * @param limits The caps, read once; changing them later changes nothing.
   * @param pool The pool whose slots the carrier connects and drives. It
   *   stays the program's, to `dispose()` after `close()`.
   * @param target Where to connect: a Unix socket, or a numeric address and
   *   port, as `pgTarget` parsed it; a host name panics.
   * @param handler The handler whose `wait` watches the carrier's sockets.
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
      limits.connectTimeoutMs > 3600000 ||
      limits.watch < 0 ||
      limits.watch >= HANDLER_MAX_WATCHED
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
    const config: PgConfig = pool.settings()
    this.tlsMode = config.tls
    if (this.tlsMode !== PG_TLS_DISABLE && target.unix) {
      panic("nish/net/postgres-carrier: PgConfig.tls asks for TLS on a Unix socket")
    }
    if (this.tlsMode !== PG_TLS_DISABLE) {
      pool.carryTls()
    }
    this.tlsName = config.tlsServerName.length > 0 ? config.tlsServerName : target.host
    this.trust = this.tlsMode === PG_TLS_VERIFY_FULL ? pgCarrierTrust(config.tlsRootsPath) : null
    this.pool = pool
    this.handler = handler
    this.watchId = limits.watch
    this.unix = target.unix
    this.path = target.path
    this.nonce = new Array<u8>(PG_CARRIER_NONCE_BYTES)
    this.timeoutNs = toI64(limits.connectTimeoutMs) * toI64(1000000)
    // Every table is filled by `push` to the size the caps give, so that no
    // length is computed.
    const size: i32 = pool.size
    const ready: i32[] = []
    const sockets: PgCarrierSlot[] = []
    for (let s: i32 = 0; s < size; s++) {
      ready.push(0)
      ready.push(0)
      sockets.push(new PgCarrierSlot(s))
    }
    this.ready = ready
    this.sockets = sockets
    this.sslRequest = pgSslRequest()
    this.tlsAnswer = new Array<u8>(1)
    this.tlsInput =
      this.tlsMode !== PG_TLS_DISABLE
        ? new Array<u8>(PG_CARRIER_TLS_READ_BYTES)
        : new Array<u8>(PG_CARRIER_ZERO)
    // The free stacks are filled highest first, so that the lowest number is
    // handed out first.
    const held: PgCarrierQuery[] = []
    const qFree: PgCarrierQuery[] = []
    for (let q: i32 = 0; q < queries; q++) {
      held.push(new PgCarrierQuery(q))
    }
    let k: i32 = toI32(held.length)
    while (k > 0) {
      k -= 1
      if (k < toI32(held.length)) {
        qFree.push(held[k])
      }
    }
    this.held = held
    this.qFree = qFree
    const runs: PgCarrierExecution[] = []
    const eFree: PgCarrierExecution[] = []
    for (let e: i32 = 0; e < executions; e++) {
      runs.push(new PgCarrierExecution(e, toI32(toU32(queries) + toU32(e))))
    }
    k = toI32(runs.length)
    while (k > 0) {
      k -= 1
      if (k < toI32(runs.length)) {
        eFree.push(runs[k])
      }
    }
    this.executions = runs
    this.eFree = eFree
    // At least twice the tickets ever held, a power of two for the mask.
    const tickets: u32 = toU32(queries) + toU32(executions)
    let mapSize: u32 = 2
    while (mapSize / 2 < tickets) {
      mapSize = mapSize << 1
    }
    const keys: i32[] = []
    const values: i32[] = []
    for (let i: u32 = 0; i < mapSize; i++) {
      keys.push(-1)
      values.push(-1)
    }
    this.mapKeys = keys
    this.mapValues = values
    this.mapMask = mapSize - 1
    this.batchers = []
    this.loop = pollCreate()
    if (this.loop < 0) {
      panic("nish/net/postgres-carrier: PgCarrier could not create its poll set")
    }
    handler.watch(this.loop, limits.watch)
  }

  /**
   * Registers `batcher`'s statement on the pool and answers its id for
   * `runInt` and `runText`. Panics past 8 batchers, and wherever
   * `PgPool.register` refuses: once the pool has connected, on a NUL in the
   * batcher's name or SQL, or past 256 statements. Attach every batcher
   * before the first `next()`, which starts connecting.
   *
   * @param batcher The batcher to route keys to; the carrier keeps it.
   * @returns The batcher's id, 0 for the first attached and counting up.
   */
  attach(batcher: PgBatcher): i32 {
    const id: i32 = toI32(this.batchers.length)
    const types: i32[] = []
    if (id >= PG_CARRIER_MAX_BATCHERS || !this.pool.register(batcher.name, batcher.sql, types)) {
      panic(
        "nish/net/postgres-carrier: PgCarrier.attach past 8 batchers, after the pool connected, on a NUL in the name or SQL, or past 256 statements"
      )
    }
    this.batchers.push(new PgCarrierBatch(batcher))
    return id
  }

  /**
   * Queues a plain query for `req` (null for one of the program's own) and
   * answers its number; `PG_CARRIER_BUILD` comes for it once a connection
   * has room. `PG_CARRIER_FULL` when `queries` are waiting, the pool's
   * queue is full or the carrier is closed. Returns at once.
   *
   * @param req The request the query answers, handed back by `request()`;
   *   null for a query of the program's own.
   * @param tag The program's own number for what was asked, handed back as
   *   `tag` on every event of the query.
   * @returns The query's number, 0 up to `queries - 1` and reused once its
   *   final event has passed, or `PG_CARRIER_FULL`.
   */
  run(req: HttpRequest | null, tag: i32): i32 {
    const held: PgCarrierQuery | null = this.take(req, tag)
    if (held === null) {
      return PG_CARRIER_FULL
    }
    const ticket: i32 = this.pool.request()
    if (ticket < 0) {
      this.free(held)
      return PG_CARRIER_FULL
    }
    held.ticket = ticket
    this.mapPut(ticket, held.index)
    return held.index
  }

  /**
   * Queues `req`'s int8 `key` on batcher `batcher`, as `run` does a plain
   * query: the carrier sends it with the other keys waiting on that batcher
   * in one execution, and answers its rows to this query alone. Panics on an
   * id `attach` never gave, or a batcher whose key is text.
   *
   * @param req The request the key answers; null for the program's own.
   * @param batcher The id `attach` answered.
   * @param key The key to look up.
   * @param tag The program's own number, handed back as `tag`.
   * @returns The query's number, or `PG_CARRIER_FULL` when `queries` are
   *   waiting, the batcher's queue is full or the carrier is closed.
   */
  runInt(req: HttpRequest | null, batcher: i32, key: i64, tag: i32): i32 {
    const batch: PgCarrierBatch | null = this.batcher(batcher)
    if (batch === null) {
      panic("nish/net/postgres-carrier: PgCarrier batcher id out of range")
    }
    const held: PgCarrierQuery | null = this.take(req, tag)
    if (held === null) {
      return PG_CARRIER_FULL
    }
    if (!batch.batcher.addInt(key, held.index)) {
      this.free(held)
      return PG_CARRIER_FULL
    }
    return held.index
  }

  /**
   * Queues `req`'s text key `bytes[start, start + length)` on batcher
   * `batcher`, as `runInt` does an int8 key. The key is copied into the
   * batcher's own store, so `bytes` may change once this returns. Panics on
   * an id `attach` never gave, a batcher whose key is int8, or a window
   * outside `bytes`.
   *
   * @param req The request the key answers; null for the program's own.
   * @param batcher The id `attach` answered.
   * @param bytes The buffer holding the key, such as the request's own bytes.
   * @param start Where the key starts in `bytes`, in bytes.
   * @param length The key's length in bytes.
   * @param tag The program's own number, handed back as `tag`.
   * @returns The query's number, or `PG_CARRIER_FULL` when `queries` are
   *   waiting, the carrier is closed, or `PgBatcher.addText` refuses the key:
   *   one that is not UTF-8 or holds a NUL, a full queue or key store, or a
   *   key too long for one execution.
   */
  runText(req: HttpRequest | null, batcher: i32, bytes: u8[], start: i32, length: i32, tag: i32): i32 {
    const batch: PgCarrierBatch | null = this.batcher(batcher)
    if (batch === null) {
      panic("nish/net/postgres-carrier: PgCarrier batcher id out of range")
    }
    const held: PgCarrierQuery | null = this.take(req, tag)
    if (held === null) {
      return PG_CARRIER_FULL
    }
    if (!batch.batcher.addText(bytes, start, length, held.index)) {
      this.free(held)
      return PG_CARRIER_FULL
    }
    return held.index
  }

  /**
   * The request `query` was run for. Panics when it was run with none, or no
   * event named a query.
   *
   * @returns The request handed to `run`, `runInt` or `runText`, valid until
   *   the `next()` after the query's final event.
   */
  request(): HttpRequest {
    const held: PgCarrierQuery | null = this.queryAt(this.query)
    const req: HttpRequest | null = held !== null ? held.request : null
    if (req === null) {
      panic("nish/net/postgres-carrier: PgCarrier.request with no request for the query")
    }
    return req
  }

  /**
   * The connection the last `PG_CARRIER_BUILD` or row is on. Panics before
   * any.
   *
   * @returns The pool's connection, to bind a query on after
   *   `PG_CARRIER_BUILD` or read a row from after `PG_CARRIER_ROW`; its row
   *   holds only until the next call to `next()`.
   */
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
   *
   * @returns True when bytes for the group go to the server, even when the
   *   query itself was dropped and will end `PG_CARRIER_FAILED`; false when
   *   nothing was written and the query fails.
   */
  send(): boolean {
    const held: PgCarrierQuery | null = this.queryAt(this.building)
    if (held === null) {
      panic("nish/net/postgres-carrier: PgCarrier.send with no PG_CARRIER_BUILD open")
    }
    this.building = -1
    if (this.pool.send()) {
      return true
    }
    const conn: PgConnection = this.connection()
    if (conn.bindCancel()) {
      // The group may hold the connection's prepares, which still go; the query does not.
      held.failed = true
      if (this.pool.send()) {
        return true
      }
    }
    // Nothing was written: a live connection dropped the query, and a failed
    // one reports it lost with the rest.
    if (conn.failure === PG_ERR_NONE) {
      this.mapRemove(held.ticket)
      this.dropped = held.index
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
   * `PG_CARRIER_NONE` once the carrier is closed, which connects nothing.
   * The call first frees the query whose final event it answered last.
   *
   * @returns One of the `PG_CARRIER_*` events, `PG_CARRIER_NONE` to stop
   *   calling until the handler's next turn.
   */
  next(): i32 {
    if (this.closed) {
      return PG_CARRIER_NONE
    }
    if (this.building >= 0) {
      panic("nish/net/postgres-carrier: PgCarrier.next before send() ended the PG_CARRIER_BUILD")
    }
    if (this.finished >= 0) {
      const done: PgCarrierQuery | null = this.queryAt(this.finished)
      if (done !== null) {
        this.free(done)
      }
      this.finished = -1
    }
    while (true) {
      if (this.dropped >= 0) {
        const held: PgCarrierQuery | null = this.queryAt(this.dropped)
        this.dropped = -1
        if (held !== null) {
          this.failure = PG_ERR_NONE
          this.socketError = 0
          return this.final(held, PG_CARRIER_FAILED)
        }
      }
      if (this.drainRun >= 0) {
        const event: i32 = this.drain()
        if (event !== PG_CARRIER_NONE) {
          return event
        }
      }
      const left: i32 = this.shedLeft
      if (left > 0) {
        this.shedLeft = left - 1
        const batch: PgCarrierBatch | null = this.batcher(this.shedBatcher)
        const held: PgCarrierQuery | null = batch !== null ? this.queryAt(batch.batcher.shed()) : null
        if (held !== null) {
          return this.final(held, PG_CARRIER_FAILED)
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

  /**
   * Tells every connection the session is over, writes what it can of that,
   * and closes the sockets and the carrier's poll set, which closing takes
   * off the handler's watch. Queries still in flight get no further event:
   * their requests are the program's to answer. After it, `run`, `runInt`
   * and `runText` answer `PG_CARRIER_FULL` and `next()` `PG_CARRIER_NONE`;
   * a second `close()` does nothing. The pool is the program's to `dispose()`.
   */
  close(): void {
    if (this.closed) {
      return
    }
    this.closed = true
    const sockets: PgCarrierSlot[] = this.sockets
    for (let s: i32 = 0; s < toI32(sockets.length); s++) {
      const slot: PgCarrierSlot = sockets[s]
      const fd: i32 = slot.fd
      if (fd >= 0) {
        const conn: PgConnection = this.pool.connection(slot.index)
        const tls: TlsRecordClient | null = slot.tls
        if (slot.tlsPhase === PG_CARRIER_TLS_OFF || slot.tlsPhase === PG_CARRIER_TLS_OPEN) {
          conn.terminate()
          this.flushSlot(slot, conn, fd)
        }
        if (tls !== null) {
          tls.close()
          this.flushTls(tls, fd)
        }
        this.dropSocket(slot, fd)
      }
    }
    netClose(this.loop)
  }

  // Reads what the sockets the poll set reports have, finishes their
  // connects, and fails the connections past their connect timeout.
  private poll(): void {
    if (this.handler.fired(this.watchId)) {
      const ready: i32[] = this.ready
      const n: i32 = pollWait(this.loop, ready, toI32(0))
      // `ready` holds a slot and its event bits for each of the `n` sockets.
      // In `u32`, which wraps by definition, and checked against `ready`
      // before each read.
      let k: u32 = 0
      let left: i32 = n
      while (left > 0) {
        left -= 1
        const i: i32 = toI32(k)
        k += 2
        if (i < 0 || i >= toI32(ready.length) - 1) {
          break
        }
        const at: i32 = ready[i]
        const bits: i32 = ready[i + 1]
        const slot: PgCarrierSlot | null = this.slotAt(at)
        if (slot !== null && slot.fd >= 0) {
          this.service(slot, bits)
        }
      }
    }
    let now: i64 = 0
    const sockets: PgCarrierSlot[] = this.sockets
    for (let s: i32 = 0; s < toI32(sockets.length); s++) {
      const slot: PgCarrierSlot = sockets[s]
      const deadline: i64 = slot.deadline
      if (deadline > 0) {
        if (now === 0) {
          now = monotonicNanos()
        }
        // A connection the server already failed keeps that failure.
        if (now >= deadline && this.pool.connection(slot.index).failure === PG_ERR_NONE) {
          this.fail(slot, PG_CARRIER_TIMED_OUT)
        }
      }
    }
    const batchers: PgCarrierBatch[] = this.batchers
    for (let b: i32 = 0; b < toI32(batchers.length); b++) {
      batchers[b].stalled = false
    }
  }

  // One ready socket: a connect finished, or input to read.
  private service(slot: PgCarrierSlot, bits: i32): void {
    const conn: PgConnection = this.pool.connection(slot.index)
    if (conn.failure !== PG_ERR_NONE) {
      return
    }
    const fd: i32 = slot.fd
    if (!slot.connected) {
      const result: i32 = connectResult(fd)
      if (result !== 0) {
        this.fail(slot, result)
        return
      }
      slot.connected = true
    }
    if (slot.tlsPhase !== PG_CARRIER_TLS_OFF) {
      if ((bits & PG_CARRIER_READ_BITS) !== 0) {
        this.serviceTls(slot, fd, conn)
      }
      return
    }
    const room: i32 = conn.inputRoom()
    if ((bits & PG_CARRIER_READ_BITS) !== 0 && room > 0) {
      const got: i32 = netRead(fd, conn.inputBuffer(), conn.inputEnd(), room)
      if (got > 0) {
        conn.received(got)
      } else if (got !== PG_CARRIER_AGAIN) {
        this.fail(slot, got)
      }
    }
  }

  // Ends `slot`'s connection for `error`: its events then say so.
  private fail(slot: PgCarrierSlot, error: i32): void {
    this.pool.connection(slot.index).closed()
    slot.error = error
    slot.deadline = 0
  }

  // Reads `slot`'s socket under TLS: the one byte answering the
  // SSLRequest, else ciphertext for the record layer, whose plaintext is
  // then moved into the connection's input.
  private serviceTls(slot: PgCarrierSlot, fd: i32, conn: PgConnection): void {
    if (slot.tlsPhase === PG_CARRIER_TLS_ASK) {
      if (slot.tlsAsked < toI32(this.sslRequest.length)) {
        // The answer is read only once the whole SSLRequest is out.
        return
      }
      // Exactly one byte, so nothing the server sends in the clear around
      // it reaches the backend parser (CVE-2021-23222): bytes after `N` are
      // never read, and bytes after `S` go to the record layer as the start
      // of the handshake, which a TLS server's ServerHello must be, so
      // anything else fails it.
      const answer: u8[] = this.tlsAnswer
      const got: i32 = netRead(fd, answer, 0, 1)
      if (got === PG_CARRIER_AGAIN) {
        return
      }
      if (got <= 0) {
        this.fail(slot, got)
      } else if (answer.length > 0 && toI32(answer[0]) === PG_CARRIER_TLS_YES) {
        slot.tls = pgCarrierTlsStart(this.tlsName)
        slot.tlsPhase = PG_CARRIER_TLS_HANDSHAKE
      } else {
        this.failTls(slot, PG_CARRIER_ZERO)
      }
      return
    }
    const tls: TlsRecordClient | null = slot.tls
    if (tls === null) {
      return
    }
    const input: u8[] = this.tlsInput
    let room: i32 = tls.space()
    if (room > toI32(input.length)) {
      room = toI32(input.length)
    }
    if (room > 0) {
      const got: i32 = netRead(fd, input, 0, room)
      if (got > 0) {
        tls.receive(input, PG_CARRIER_ZERO, got)
      } else if (got === 0) {
        tls.end()
      } else if (got !== PG_CARRIER_AGAIN) {
        tls.abort()
        this.fail(slot, got)
        return
      }
    }
    this.advanceTls(slot, tls, conn)
  }

  // Gives `slot`'s handshake the verdict it waits on, notes it open, and
  // moves what plaintext `conn` has room for into its input: whether any
  // moved, so that `next()` looks at the slot again.
  private advanceTls(slot: PgCarrierSlot, tls: TlsRecordClient, conn: PgConnection): boolean {
    if ((tls.interest() & TLS_RECORD_AUTH) !== 0) {
      const trust: TlsClientTrust | null = this.trust
      if (trust !== null) {
        const verdict: i32 = tlsClientVerdict(tls.tls, trust, wallClockNanos() / toI64(1000000))
        if (verdict !== 0) {
          tls.reject(verdict)
        } else {
          tls.authenticate(true)
        }
      } else {
        // PG_TLS_REQUIRE: encryption against a passive eavesdropper only,
        // as libpq's `sslmode=require`; `docs/security/postgres.md` argues it.
        tls.authenticate(true)
      }
    }
    if (tls.state === TLS_RECORD_STATE_FAILED) {
      this.failTls(slot, tls.failure())
      return false
    }
    if (slot.tlsPhase === PG_CARRIER_TLS_HANDSHAKE && tls.state === TLS_RECORD_STATE_OPEN) {
      slot.tlsPhase = PG_CARRIER_TLS_OPEN
    }
    if (slot.tlsPhase !== PG_CARRIER_TLS_OPEN) {
      return false
    }
    let moved: boolean = false
    let room: i32 = conn.inputRoom()
    while (room > 0) {
      const got: i32 = tls.read(conn.inputBuffer(), conn.inputEnd(), room)
      if (got > 0) {
        conn.received(got)
        moved = true
      } else if (got === 0) {
        // The server's close_notify: the stream ended cleanly.
        this.fail(slot, PG_CARRIER_ZERO)
        return true
      } else {
        if (tls.state === TLS_RECORD_STATE_FAILED) {
          this.failTls(slot, tls.failure())
          return true
        }
        return moved
      }
      room = conn.inputRoom()
    }
    return moved
  }

  // Fails `slot` with `PG_ERR_TLS`: `alert` the TLS alert behind it, 0
  // for a refused SSLRequest. One write sends the alert a refusal sealed,
  // when the socket has room for it.
  private failTls(slot: PgCarrierSlot, alert: i32): void {
    this.pool.connection(slot.index).tlsFailed()
    slot.error = alert
    slot.deadline = 0
    const tls: TlsRecordClient | null = slot.tls
    const fd: i32 = slot.fd
    if (tls !== null && fd >= 0) {
      this.flushTls(tls, fd)
    }
  }

  // The events of every slot's connection, resuming at `at`.
  private slots(): i32 {
    const sockets: PgCarrierSlot[] = this.sockets
    while (true) {
      const s: i32 = this.at
      if (s < 0 || s >= toI32(sockets.length)) {
        return PG_CARRIER_NONE
      }
      const slot: PgCarrierSlot = sockets[s]
      if (!slot.made) {
        this.at = s + 1
        continue
      }
      const event: i32 = this.pool.next(s)
      if (event === PG_NEED_MORE) {
        this.at = s + 1
        continue
      }
      const routed: i32 = this.route(slot, event)
      if (routed !== PG_CARRIER_NONE) {
        return routed
      }
    }
  }

  // One pool event from `slot`, as the carrier's own; `PG_CARRIER_NONE`
  // for one it keeps, `PG_CARRIER_AGAIN_PASS` when a run's events are owed.
  private route(slot: PgCarrierSlot, event: i32): i32 {
    const conn: PgConnection = this.pool.connection(slot.index)
    if (event === PG_READY) {
      slot.deadline = 0
      return PG_CARRIER_NONE
    }
    if (event === PG_FAILED) {
      const fd: i32 = slot.fd
      if (fd >= 0) {
        this.dropSocket(slot, fd)
      }
      slot.deadline = 0
      return PG_CARRIER_NONE
    }
    const ticket: i32 = this.pool.ticket
    const v: i32 = ticket < 0 ? -1 : this.mapGet(ticket)
    const held: PgCarrierQuery[] = this.held
    const queries: i32 = toI32(held.length)
    if (v >= 0 && v < queries) {
      this.conn = conn
      return this.routePlain(slot, held[v], ticket, event, conn)
    }
    const exec: PgCarrierExecution | null =
      queries >= 0 && v >= queries && v >= 0 ? this.executionAt(v - queries) : null
    if (exec === null) {
      // A notice, or the event of a query no longer held.
      return PG_CARRIER_NONE
    }
    this.conn = conn
    return this.routeBatch(slot, exec, ticket, event, conn)
  }

  private routePlain(
    slot: PgCarrierSlot,
    held: PgCarrierQuery,
    ticket: i32,
    event: i32,
    conn: PgConnection
  ): i32 {
    if (event === PG_ROW || event === PG_COMPLETE) {
      this.announce(held)
      return event === PG_ROW ? PG_CARRIER_ROW : PG_CARRIER_COMPLETE
    }
    if (event === PG_ERROR) {
      held.failed = true
      this.announce(held)
      return PG_CARRIER_ERROR
    }
    if (event === PG_GROUP_DONE) {
      this.mapRemove(ticket)
      const failed: boolean = held.failed || conn.groupFailed
      this.failure = PG_ERR_NONE
      this.socketError = 0
      return this.final(held, failed ? PG_CARRIER_FAILED : PG_CARRIER_DONE)
    }
    if (event === PG_LOST) {
      this.mapRemove(ticket)
      this.failure = conn.failure
      this.socketError = slot.error
      return this.final(held, PG_CARRIER_FAILED)
    }
    return PG_CARRIER_NONE
  }

  private routeBatch(
    slot: PgCarrierSlot,
    exec: PgCarrierExecution,
    ticket: i32,
    event: i32,
    conn: PgConnection
  ): i32 {
    const id: i32 = exec.batcher
    const batch: PgCarrierBatch | null = this.batcher(id)
    if (batch === null) {
      // An execution no batcher holds is no longer held either.
      return PG_CARRIER_NONE
    }
    const b: PgBatcher = batch.batcher
    const r: i32 = exec.run
    if (event === PG_LOST && r < 0) {
      // Lost before a connection took it: its requests would wait on a
      // server that cannot be reached, so one execution's worth fail now.
      this.mapRemove(ticket)
      this.freeExecution(exec)
      batch.queued = false
      this.shedBatcher = id
      this.shedLeft = b.maxRequests
      this.failure = conn.failure
      this.socketError = slot.error
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
      exec.ended = true
      this.startDrain(id, r, PG_ERR_NONE, toI32(0))
      return PG_CARRIER_AGAIN_PASS
    }
    if (event === PG_ERROR || event === PG_GROUP_DONE || event === PG_LOST) {
      const lost: boolean = event === PG_LOST
      if (event !== PG_ERROR) {
        this.mapRemove(ticket)
        this.freeExecution(exec)
      }
      if (!exec.ended) {
        b.fail(r)
        exec.ended = true
        this.startDrain(id, r, lost ? conn.failure : PG_ERR_NONE, lost ? slot.error : toI32(0))
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
    const batch: PgCarrierBatch | null = this.batcher(this.drainBatcher)
    if (batch === null) {
      this.drainRun = -1
      return PG_CARRIER_NONE
    }
    const b: PgBatcher = batch.batcher
    const event: i32 = b.next(this.drainRun)
    const held: PgCarrierQuery | null = this.queryAt(b.tag)
    if (event === PG_BATCH_NONE || held === null) {
      this.drainRun = -1
      return PG_CARRIER_NONE
    }
    if (event === PG_BATCH_ROW) {
      this.announce(held)
      return PG_CARRIER_ROW
    }
    if (event === PG_BATCH_FAILED) {
      this.failure = this.drainFailure
      this.socketError = this.drainError
      return this.final(held, PG_CARRIER_FAILED)
    }
    this.failure = PG_ERR_NONE
    this.socketError = 0
    return this.final(held, event === PG_BATCH_DONE ? PG_CARRIER_DONE : PG_CARRIER_MISSING)
  }

  // Queues an execution for each batcher with requests waiting, then hands
  // waiting tickets to connections: a plain query's is the program's to
  // build, an execution's is bound here.
  private dispatch(): i32 {
    const batchers: PgCarrierBatch[] = this.batchers
    const eFree: PgCarrierExecution[] = this.eFree
    for (let id: i32 = 0; id < toI32(batchers.length); id++) {
      const batch: PgCarrierBatch = batchers[id]
      if (batch.queued || batch.stalled || batch.batcher.waiting() === 0) {
        continue
      }
      const lastExec: i32 = toI32(eFree.length) - 1
      if (lastExec >= 0 && eFree.length > 0) {
        const exec: PgCarrierExecution = eFree[lastExec]
        eFree.pop()
        const ticket: i32 = this.pool.request()
        if (ticket < 0) {
          eFree.push(exec)
          break
        }
        exec.batcher = id
        exec.run = -1
        exec.ended = false
        this.mapPut(ticket, exec.value)
        batch.queued = true
      }
    }
    const slot: i32 = this.pool.dispatch()
    if (slot < 0) {
      return PG_CARRIER_NONE
    }
    const conn: PgConnection = this.pool.connection(slot)
    const ticket: i32 = this.pool.ticket
    const v: i32 = this.mapGet(ticket)
    const held: PgCarrierQuery[] = this.held
    const queries: i32 = toI32(held.length)
    if (v >= 0 && v < queries) {
      this.conn = conn
      this.building = v
      this.announce(held[v])
      return PG_CARRIER_BUILD
    }
    const exec: PgCarrierExecution | null =
      queries >= 0 && v >= queries && v >= 0 ? this.executionAt(v - queries) : null
    const batch: PgCarrierBatch | null = exec !== null ? this.batcher(exec.batcher) : null
    if (exec === null || batch === null) {
      this.pool.send()
      return PG_CARRIER_AGAIN_PASS
    }
    const b: PgBatcher = batch.batcher
    batch.queued = false
    const r: i32 = b.take(conn)
    if (r < 0) {
      // Every run is in flight, or the connection had no room for the bind:
      // the requests stay queued for the next turn.
      batch.stalled = true
      this.pool.send()
      if (conn.failure === PG_ERR_NONE) {
        this.mapRemove(ticket)
        this.freeExecution(exec)
      }
      return PG_CARRIER_AGAIN_PASS
    }
    exec.run = r
    if (!this.pool.send() && conn.failure === PG_ERR_NONE) {
      this.mapRemove(ticket)
      this.freeExecution(exec)
      b.fail(r)
      this.startDrain(exec.batcher, r, PG_ERR_NONE, toI32(0))
    }
    return PG_CARRIER_AGAIN_PASS
  }

  // Connects the slots the pool wants (when `connect`), then writes what
  // each connection queued and asks for writability while some stays.
  // True when a socket failed and its events are owed.
  private connectAndFlush(connect: boolean): boolean {
    let failed: boolean = false
    const sockets: PgCarrierSlot[] = this.sockets
    if (connect) {
      let want: i32 = this.pool.wanted()
      // In `u64`, which wraps by definition: a monotonic clock is centuries
      // short of the top.
      const deadline: i64 = want >= 0 ? toI64(toU64(monotonicNanos()) + toU64(this.timeoutNs)) : toI64(0)
      while (want >= 0 && want < toI32(sockets.length)) {
        const slot: PgCarrierSlot = sockets[want]
        crypto.getRandomValues(this.nonce)
        this.pool.connect(want, this.nonce)
        slot.made = true
        slot.connected = false
        slot.interest = H1_WANT_WRITE
        slot.error = 0
        slot.deadline = deadline
        slot.tlsPhase = this.tlsMode !== PG_TLS_DISABLE ? PG_CARRIER_TLS_ASK : PG_CARRIER_TLS_OFF
        slot.tlsAsked = 0
        const fd: i32 = this.unix ? unixConnect(this.path) : tcpConnect(this.address)
        slot.fd = fd
        if (fd < 0) {
          this.fail(slot, fd)
          failed = true
        } else if (pollAdd(this.loop, fd, H1_WANT_WRITE, want) < 0) {
          this.fail(slot, toI32(-1))
          failed = true
        }
        want = this.pool.wanted()
      }
    }
    for (let s: i32 = 0; s < toI32(sockets.length); s++) {
      const slot: PgCarrierSlot = sockets[s]
      const fd: i32 = slot.fd
      if (fd < 0 || !slot.connected) {
        continue
      }
      const conn: PgConnection = this.pool.connection(s)
      if (conn.failure !== PG_ERR_NONE) {
        continue
      }
      const tls: TlsRecordClient | null = slot.tls
      if (tls !== null && this.advanceTls(slot, tls, conn)) {
        // Plaintext the record layer held, which no poll would report.
        failed = true
      }
      if (conn.failure !== PG_ERR_NONE) {
        failed = true
        continue
      }
      const written: i32 = this.flushSlot(slot, conn, fd)
      if (written < 0) {
        if (tls !== null) {
          tls.abort()
        }
        this.fail(slot, written)
        failed = true
        continue
      }
      const wants: i32 = this.pending(slot, conn) ? H1_WANT_READ | H1_WANT_WRITE : H1_WANT_READ
      if (wants !== slot.interest) {
        pollModify(this.loop, fd, wants, s)
        slot.interest = wants
      }
    }
    return failed
  }

  // Whether `slot` has bytes for the socket that it has not taken.
  private pending(slot: PgCarrierSlot, conn: PgConnection): boolean {
    const phase: i32 = slot.tlsPhase
    if (phase === PG_CARRIER_TLS_ASK) {
      return slot.tlsAsked < toI32(this.sslRequest.length)
    }
    const tls: TlsRecordClient | null = slot.tls
    if (tls !== null && tls.outputEnd > tls.outputStart) {
      return true
    }
    return (
      (phase === PG_CARRIER_TLS_OFF || phase === PG_CARRIER_TLS_OPEN) && conn.outputEnd() > conn.outputStart()
    )
  }

  // Writes what `slot` owes its socket, as its TLS phase has it: the
  // SSLRequest, the handshake, `conn`'s bytes sealed, or `conn`'s bytes as
  // they are. The socket error when it fails, else 0.
  private flushSlot(slot: PgCarrierSlot, conn: PgConnection, fd: i32): i32 {
    const phase: i32 = slot.tlsPhase
    if (phase === PG_CARRIER_TLS_OFF) {
      return this.flush(conn, fd)
    }
    if (phase === PG_CARRIER_TLS_ASK) {
      const request: u8[] = this.sslRequest
      const length: i32 = toI32(request.length)
      let asked: i32 = slot.tlsAsked
      while (asked >= 0 && asked < length) {
        const n: i32 = netWrite(fd, request, asked, length - asked)
        if (n === PG_CARRIER_AGAIN) {
          return 0
        }
        if (n <= 0) {
          return n < 0 ? n : -1
        }
        // A write takes at most what it was given, so this is at most `length`.
        const sent: i64 = toI64(asked) + toI64(n)
        asked = sent < toI64(length) ? toI32(sent) : length
        slot.tlsAsked = asked
      }
      return 0
    }
    const tls: TlsRecordClient | null = slot.tls
    if (tls === null) {
      return 0
    }
    while (true) {
      const written: i32 = this.flushTls(tls, fd)
      if (written !== 0 || tls.outputEnd > tls.outputStart) {
        return written
      }
      const start: i32 = conn.outputStart()
      const end: i32 = conn.outputEnd()
      if (phase !== PG_CARRIER_TLS_OPEN || start < 0 || end < 0 || end <= start) {
        return 0
      }
      const sealed: i32 = tls.write(conn.outputBuffer(), start, end - start)
      if (sealed <= 0) {
        return 0
      }
      conn.sent(sealed)
    }
  }

  // Writes the records `tls` has sealed until the socket takes no more; the
  // socket error when it fails, else 0.
  private flushTls(tls: TlsRecordClient, fd: i32): i32 {
    while (true) {
      const start: i32 = tls.outputStart
      const end: i32 = tls.outputEnd
      if (start < 0 || end < 0 || end <= start) {
        return 0
      }
      const n: i32 = netWrite(fd, tls.output, start, end - start)
      if (n === PG_CARRIER_AGAIN) {
        return 0
      }
      if (n <= 0) {
        return n < 0 ? n : -1
      }
      tls.consume(n)
    }
  }

  // Writes what `conn` queued until the socket takes no more; the socket
  // error when it fails, else 0.
  private flush(conn: PgConnection, fd: i32): i32 {
    while (true) {
      const start: i32 = conn.outputStart()
      const end: i32 = conn.outputEnd()
      if (start < 0 || end < 0 || end <= start) {
        return 0
      }
      const n: i32 = netWrite(fd, conn.outputBuffer(), start, end - start)
      if (n === PG_CARRIER_AGAIN) {
        return 0
      }
      if (n <= 0) {
        return n < 0 ? n : -1
      }
      conn.sent(n)
    }
  }

  // Names `held` as the query the event is about.
  private announce(held: PgCarrierQuery): void {
    this.query = held.index
    this.tag = held.tag
  }

  // Takes `slot`'s socket `fd` off the poll set and closes it.
  private dropSocket(slot: PgCarrierSlot, fd: i32): void {
    pollRemove(this.loop, fd)
    netClose(fd)
    slot.fd = -1
    const tls: TlsRecordClient | null = slot.tls
    if (tls !== null) {
      tls.wipe()
      slot.tls = null
    }
  }

  // Answers `held`'s final `event`; the query is freed on the next call.
  private final(held: PgCarrierQuery, event: i32): i32 {
    this.announce(held)
    this.finished = held.index
    return event
  }

  // The slot numbered `s`, or null for a number no slot has.
  private slotAt(s: i32): PgCarrierSlot | null {
    const sockets: PgCarrierSlot[] = this.sockets
    return s >= 0 && s < toI32(sockets.length) ? sockets[s] : null
  }

  // The query numbered `q`, or null for a number no query has.
  private queryAt(q: i32): PgCarrierQuery | null {
    const held: PgCarrierQuery[] = this.held
    return q >= 0 && q < toI32(held.length) ? held[q] : null
  }

  // The execution numbered `e`, or null for a number no execution has.
  private executionAt(e: i32): PgCarrierExecution | null {
    const runs: PgCarrierExecution[] = this.executions
    return e >= 0 && e < toI32(runs.length) ? runs[e] : null
  }

  // The batcher `attach` numbered `id`, or null for an id it never gave.
  private batcher(id: i32): PgCarrierBatch | null {
    const batchers: PgCarrierBatch[] = this.batchers
    return id >= 0 && id < toI32(batchers.length) ? batchers[id] : null
  }

  // A free query for `req` and `tag`, or null when none is free or the carrier is closed.
  private take(req: HttpRequest | null, tag: i32): PgCarrierQuery | null {
    const free: PgCarrierQuery[] = this.qFree
    if (this.closed || free.length === 0) {
      return null
    }
    const last: i32 = toI32(free.length) - 1
    if (last >= 0 && free.length > 0) {
      const held: PgCarrierQuery = free[last]
      free.pop()
      held.tag = tag
      held.request = req
      held.ticket = -1
      held.failed = false
      return held
    }
    return null
  }

  private free(held: PgCarrierQuery): void {
    held.request = null
    this.qFree.push(held)
  }

  private freeExecution(exec: PgCarrierExecution): void {
    this.eFree.push(exec)
  }

  // The map's size is twice the tickets ever held, so a probe always meets
  // an empty slot and every loop below ends. A slot index outside the
  // arrays cannot occur, since the mask is their length less one; the
  // guards on it take the path for a key not found.
  private mapPut(key: i32, value: i32): void {
    const keys: i32[] = this.mapKeys
    const values: i32[] = this.mapValues
    const mask: u32 = this.mapMask
    let b: u32 = toU32(key) & mask
    while (true) {
      const i: i32 = toI32(b)
      if (i < 0 || i >= toI32(keys.length)) {
        return
      }
      if (keys[i] === -1) {
        if (i < toI32(values.length)) {
          keys[i] = key
          values[i] = value
        }
        return
      }
      b = (b + 1) & mask
    }
  }

  private mapGet(key: i32): i32 {
    const keys: i32[] = this.mapKeys
    const values: i32[] = this.mapValues
    const mask: u32 = this.mapMask
    let b: u32 = toU32(key) & mask
    while (true) {
      const i: i32 = toI32(b)
      if (i < 0 || i >= toI32(keys.length)) {
        return -1
      }
      const k: i32 = keys[i]
      if (k === key) {
        return i < toI32(values.length) ? values[i] : -1
      }
      if (k === -1) {
        return -1
      }
      b = (b + 1) & mask
    }
  }

  // Removes `key`, shifting back the entries after it that would no longer
  // be found past the hole, so that no tombstone is ever left.
  private mapRemove(key: i32): void {
    const keys: i32[] = this.mapKeys
    const values: i32[] = this.mapValues
    const mask: u32 = this.mapMask
    let b: u32 = toU32(key) & mask
    let hole: i32 = -1
    while (true) {
      const i: i32 = toI32(b)
      if (i < 0 || i >= toI32(keys.length)) {
        return
      }
      const k: i32 = keys[i]
      if (k === key) {
        hole = i
        break
      }
      if (k === -1) {
        return
      }
      b = (b + 1) & mask
    }
    let j: u32 = b
    while (true) {
      j = (j + 1) & mask
      const at: i32 = toI32(j)
      if (at < 0 || at >= toI32(keys.length) || at >= toI32(values.length)) {
        break
      }
      const k: i32 = keys[at]
      if (k === -1) {
        break
      }
      // The entry at `at` stays when its home is cyclically within (hole, at].
      const home: i32 = toI32(toU32(k) & mask)
      const stays: boolean = hole <= at ? home > hole && home <= at : home > hole || home <= at
      if (!stays && hole >= 0 && hole < toI32(keys.length) && hole < toI32(values.length)) {
        keys[hole] = k
        values[hole] = values[at]
        hole = at
      }
    }
    if (hole >= 0 && hole < toI32(keys.length)) {
      keys[hole] = -1
    }
  }
}

/**
 * The roots `PG_TLS_VERIFY_FULL` checks a server's chain against: the PEM
 * file at `path`, or the system's store when it is empty. Panics when no
 * root could be read, since no server could then be trusted.
 */
const pgCarrierTrust = (path: string): TlsClientTrust => {
  const roots: PkiRoots = path.length > 0 ? pkiLoadRoots(path, [], []) : pkiLoadSystemRoots()
  if (toI32(roots.roots.length) === 0) {
    panic("nish/net/postgres-carrier: PG_TLS_VERIFY_FULL with no root certificate to read")
  }
  return tlsClientTrust(roots)
}

/**
 * A TLS 1.3 client for `name`, offering ALPN `postgresql` as libpq does,
 * with fresh random and key shares; `TlsClient` copies the keys and zeroes
 * the arrays they came in. It offers secp256r1 beside x25519: a server
 * before PostgreSQL 18 accepts only `ssl_ecdh_curve`, prime256v1 unless
 * set, and asks for that share with a HelloRetryRequest.
 */
const pgCarrierTlsStart = (name: string): TlsRecordClient => {
  const random: u8[] = new Array<u8>(PG_CARRIER_TLS_KEY_BYTES)
  const x25519: u8[] = new Array<u8>(PG_CARRIER_TLS_KEY_BYTES)
  const p256: u8[] = new Array<u8>(PG_CARRIER_TLS_KEY_BYTES)
  crypto.getRandomValues(random)
  crypto.getRandomValues(x25519)
  crypto.getRandomValues(p256)
  const config = new TlsClientConfig(name, ["postgresql"])
  config.groups = [TLS_GROUP_X25519, TLS_GROUP_SECP256R1]
  return new TlsRecordClient(new TlsClient(config, random, x25519, p256))
}
