/**
 * `nish/net/postgres-async` — `PgAsyncPool`, PostgreSQL connections an
 * `async` task awaits a query on, so a task's query waits on its socket while
 * the executor runs the others.
 *
 *     import { spawn } from "nish:async"
 *     import { secret, wipe } from "nish:secret"
 *     import { PgConfig, pgTarget } from "nish/net/postgres"
 *     import {
 *       PgAsyncParams, PgAsyncPool, pgAsyncClaim, pgAsyncConnect, pgAsyncQuery, pgAsyncRelease,
 *     } from "nish/net/postgres-async"
 *
 *     async function title(pool: PgAsyncPool, id: i32): Promise<void> {
 *       const ticket: i32 = await pgAsyncClaim(pool)
 *       if (ticket < 0) {
 *         return  // no live connection, or none came free in time
 *       }
 *       const params = new PgAsyncParams()
 *       params.int(id)
 *       const r = await pgAsyncQuery(pool, ticket, "select title from article where id = $1", params)
 *       pgAsyncRelease(pool, ticket, r.reusable)
 *       if (r.ok() && r.rows > 0) {
 *         console.log(r.text(0, 0))
 *       }
 *     }
 *
 *     export async function main(): Promise<i32> {
 *       const config = new PgConfig()
 *       config.user = "app"
 *       const pool = new PgAsyncPool(4)
 *       const password = secret(passwordBytes())  // the program's own source
 *       const live: i32 = await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", 5432))
 *       wipe(password)
 *       spawn(title(pool, 1))
 *       spawn(title(pool, 2))
 *       // ... and close the pool once the tasks are done: `pool.close()`.
 *       return live === pool.size ? 0 : 1
 *     }
 *
 * **Why separate calls.** A spawned task shares the pool with the function that
 * spawned it, and runs in memory of its own that is freed when it ends
 * (docs/LANGUAGE.md → "What `spawn` may pass"). So a call that writes into
 * the pool may allocate nothing, and one that allocates may not write into
 * it: `pgAsyncClaim` and `pgAsyncRelease` write only numbers into the pool,
 * and `pgAsyncQuery` only reads it, building its buffers, rows and strings in
 * the task's own memory. One `async` function doing all three would be
 * refused when a task calls it ("hands `pool` to ..., which may grow it").
 *
 * **The flow.** `pgAsyncConnect`, in `main` or any function that is not a
 * spawned task, connects each slot and runs its startup and SCRAM exchange
 * on a `PgConnection`, which then wipes the password and is dropped: the
 * pool keeps only the authenticated socket, so it holds no `Secret` and a
 * task may be handed it. `pgAsyncClaim` gives a task a ticket for one free
 * connection; `pgAsyncQuery` writes Parse, Bind, Execute and Sync in one go
 * (the parameters in text, never spliced into the SQL), waits on `writable`
 * and `readable` for the socket while the executor runs the others, and reads
 * to the ReadyForQuery; `pgAsyncRelease` gives the connection back, or closes
 * it when the query left it unfit to reuse.
 *
 * **Pipelining.** Many tasks may share one connection instead of claiming
 * it whole. `pgAsyncPrepare` registers a statement's SQL once, before the
 * tasks run, and each task then runs it in five calls:
 *
 *     const ticket: i32 = await pgAsyncSeat(pool, statement)  // a place in a connection's order
 *     if (ticket >= 0) {
 *       const sent: i32 = await pgAsyncSend(pool, ticket, params)  // Bind, Execute, Sync
 *       const turn: i32 = await pgAsyncTurn(pool, ticket, sent)  // the answers before it, then its own
 *       const r = await pgAsyncAnswer(pool, ticket, turn)  // its rows, in the task's memory
 *       pgAsyncDone(pool, ticket, turn, r.reusable)
 *     }
 *
 * Up to `pool.depth` statements are in flight on a connection at once, and
 * its answers come back in the order they were sent; each task waits for the
 * answers before its own on the pool's wake and reads its own when its turn
 * comes, so one read often brings several. Each connection parses a
 * statement once, named, and sends only Bind and Execute after; a Parse the
 * server refused is sent again next time. Each statement has its own Sync, so
 * a statement the server refuses fails alone. A pipelined statement whose
 * task is cancelled before its answer is read fails alone too: its seat is
 * abandoned, and the next task to read the connection reads past that
 * answer. A connection is out of step when an answer behind which others
 * wait is lost (a socket error, a frame this module does not expect, an
 * abandoned answer that left a transaction open or changed a setting): every
 * statement behind it fails `PG_ERR_CLOSED`, and the connection closes once
 * the last is answered.
 *
 * **Its own encoder and framer.** A query is encoded and its answer framed
 * here (`pgAsyncEncode`, `pgAsyncRead`), not by `PgConnection` or
 * `PgCarrier`: those keep their buffers and rows in objects that outlive a
 * query, which a task would have to grow inside the pool, and a
 * `PgConnection` holds the password as a `Secret`, which a task may not be
 * handed. The framer applies the same checks as `PgConnection`'s (PG-28 in
 * `docs/security/postgres.md`).
 *
 * **Claiming.** When every live connection is claimed or in use,
 * `pgAsyncClaim` (and `pgAsyncSeat`, when none has room) waits on the pool's
 * wake, a socket pair `pgAsyncRelease` and each answer read write a byte to,
 * until one is free or it has waited `claimWaitMs` in all; nothing polls on a
 * clock. A ticket names a slot and that slot's
 * claim: `pgAsyncQuery` and `pgAsyncRelease` panic on one that is not the
 * slot's current claim, so two tasks never share a connection and a
 * connection is given back once.
 *
 * **Reuse.** A connection is given back only when its last query read to a
 * ReadyForQuery that says "idle" and changed no session setting: a query that
 * left a transaction open, a `SET` the server reported (a ParameterStatus),
 * a socket error, a frame this module does not expect, a reply past a cap,
 * or bytes after the ReadyForQuery closes it, so the next task never inherits
 * another's session or the rest of its answer.
 *
 * **Limits.** `PgAsyncPool`'s caps (`maxMessage`, `maxColumns`, `maxRows`,
 * `maxResultBytes`, `claimWaitMs`) bound what one query keeps; rows past
 * `maxRows` or `maxResultBytes` are read and dropped, and the query fails
 * with `PG_ERR_TOO_BIG`. `pgAsyncConnect` gives each connection at most
 * `connectWaitMs` (10 s) to connect and finish its startup. A query's wait
 * has no deadline of its own: a server that accepts and never answers holds
 * the task until it closes or the task is cancelled; bound a slow statement
 * with the server's `statement_timeout` too.
 *
 * **Cancellation.** A task that is cancelled (`nish:async`'s `cancel`, a
 * `cancelAfter` deadline, or `nish/net/serve` when the client hangs up, the
 * request's deadline passes or the server drains) stops waiting at once.
 * `pgAsyncClaim` and `pgAsyncSeat` answer `PG_ASYNC_CANCELLED` and take
 * nothing; a query
 * not yet sent fails with nothing written and its connection reusable; a
 * query cut off mid-answer fails with `PG_ERR_CLOSED`, `socketError`
 * `PG_ASYNC_CANCELLED` and `reusable` false, so the task's
 * `pgAsyncRelease` closes the connection, whose unread answer would put the
 * next task out of step. A pipelined statement (`pgAsyncSeat`) cancelled
 * after it was sent fails the same way but alone: its seat is abandoned, and
 * the task behind it, or the next to ask for a seat, reads its answer and
 * drops it, so the connection stays when that answer is a plain one. No
 * CancelRequest is sent: the server runs the statement on to its end (or,
 * for a released connection, until it sees the socket closed).
 *
 * **Memory.** Run each query in a spawned task, as `title` does above: the
 * task's region, and every buffer, row and string the query built in it,
 * is freed when the task ends, so `Arena.used()` stays where it was across
 * thousands of queries. A query awaited outside a task, through a function
 * that is handed the pool, keeps what it built until an enclosing scope
 * ends (about 9 KB a query, measured while writing
 * `tests/link/std_postgres_async_flat`).
 *
 * **Errors.** A query answers `PG_CARRIER_DONE`, or `PG_CARRIER_FAILED` with
 * `failure` a `PG_ERR_*` and `socketError` a negative errno, as
 * `nish/net/postgres-carrier` does: `PG_ERR_NONE` when the server refused the
 * statement (`errorCode` and `errorMessage` say why, and the connection is
 * reused), `PG_ERR_CLOSED` when the socket ended, a wait could not be made or
 * the task was cancelled (`socketError` `PG_ASYNC_CANCELLED`).
 * Programming errors (a ticket that is not a current claim, a size or a cap
 * out of range) panic.
 *
 * `tests/link/std_postgres_async` runs one against a loopback backend;
 * `tests/link/std_postgres_async_pipeline` pipelines statements from many tasks;
 * `tests/link/std_postgres_async_flat` reads `Arena.used()` across thousands
 * of queries. Caps and findings: `docs/security/postgres.md`.
 *
 * Written for this module; not ported from another implementation.
 */

import { cancelled, readable, readableWithin, sleep, writable, writableWithin } from "nish:async"
import {
  NET_UNIX_STREAM,
  connectResult,
  netAddress,
  netClose,
  netRead,
  netWrite,
  tcpConnect,
  unixConnect,
  unixSocketPair,
} from "nish:net"
import { monotonicNanos } from "nish:process"
import { Secret } from "nish:secret"
import { copyBytes, getI32BE, getU16BE, setI32BE, setU16BE } from "nish/bytes"
import {
  PG_ERR_CLOSED,
  PG_ERR_ENCODING,
  PG_ERR_FRAME,
  PG_ERR_NONE,
  PG_ERR_TOO_BIG,
  PG_ERR_UNEXPECTED,
  PG_FAILED,
  PG_NEED_MORE,
  PG_READY,
  PG_TARGET_OK,
  PG_POOL_NONE,
  PgConfig,
  PgConnection,
  PgTarget,
} from "nish/net/postgres"
import { PG_CARRIER_DONE, PG_CARRIER_FAILED, PG_CARRIER_FULL } from "nish/net/postgres-carrier"

/** The most connections one `PgAsyncPool` holds. */
export const PG_ASYNC_MAX_SIZE: i32 = 64

/**
 * The calling task was cancelled (`nish:async`'s `cancel`, or a deadline set
 * with `cancelAfter`): `pgAsyncClaim` answers it in place of a ticket, and a
 * query cut off by it fails with `PG_ERR_CLOSED` and this as its
 * `socketError`, which no socket read or write answers.
 */
export const PG_ASYNC_CANCELLED: i32 = -3

// `netRead` and `netWrite`: nothing to read, or no room to write, now.
const PG_ASYNC_AGAIN: i32 = -11
// `readable` or `writable` could not wait on the descriptor: EBADF.
const PG_ASYNC_BAD_FD: i32 = -9
// A ticket is `claim * PG_ASYNC_MAX_SIZE + slot`; the claim count wraps below this.
const PG_ASYNC_CLAIM_WRAP: i32 = 16777216
/** The most statements `pgAsyncPrepare` registers on one pool. */
export const PG_ASYNC_MAX_STATEMENTS: i32 = 64
/** The most statements one connection has in flight at once: `PgAsyncPool.depth`'s ceiling. */
export const PG_ASYNC_MAX_DEPTH: i32 = 16
/**
 * `pgAsyncSend`'s answer for a statement it did not send because a parameter
 * holds a NUL; `pgAsyncAnswer` fails it with `PG_ERR_ENCODING`, and the
 * connection is reused.
 */
export const PG_ASYNC_UNSENT: i32 = -1
/**
 * `pgAsyncSend`'s answer for a statement it did not send because the task was
 * cancelled; `pgAsyncAnswer` fails it with `PG_ERR_CLOSED` and
 * `PG_ASYNC_CANCELLED`, and the connection is reused.
 */
export const PG_ASYNC_UNSENT_CANCELLED: i32 = -2
// `pgAsyncSend` answers a write that broke as this plus the socket error (0 or less).
const PG_ASYNC_BROKEN: i32 = -16
// A seat's ticket is `claim * 1024 + seat`; the seat claim count wraps below this.
const PG_ASYNC_SEAT_WRAP: i32 = 1048576
const PG_ASYNC_SEATS: i32 = 1024
// A connection's statement sequence numbers wrap below this.
const PG_ASYNC_SEQ_WRAP: i32 = 16777216
// The most tasks `pgAsyncSeat` queues in the order they began to wait; more
// wait unqueued, behind them all. Queue numbers wrap below the wrap.
const PG_ASYNC_QUEUE: i32 = 16384
const PG_ASYNC_QUEUE_WRAP: i32 = 1073741824
// The wakes the queue's tasks wait on, a task on the one its number picks, so
// the queue's head moving wakes it and few others.
const PG_ASYNC_LANES: i32 = 128
// What a query reads first; it grows by doubling up to one `maxMessage`.
const PG_ASYNC_INPUT_SIZE: i32 = 8192
// Loop turns a seat yields for its turn before it parks on its slot's wake.
const PG_ASYNC_TURN_YIELDS: i32 = 4
// ReadyForQuery's transaction status for "idle", outside any transaction.
const PG_ASYNC_IDLE: i32 = 73
const PG_ASYNC_NONCE_BYTES: i32 = 18
// The largest `maxMessage` and `maxResultBytes`, as `nish/net/postgres` caps `PgConfig.maxMessage`.
const PG_ASYNC_MAX_CAP: i32 = 1073741823
// The most rows `maxRows` may allow.
const PG_ASYNC_MAX_ROWS: i32 = 16777216
// What a kept cell costs `maxResultBytes` beyond its bytes: its string and its NULL flag.
const PG_ASYNC_CELL_COST: i32 = 16

/**
 * Authenticated PostgreSQL connections that spawned tasks share. Build one
 * and connect it with `pgAsyncConnect` outside any task; tasks then claim,
 * query and release through the `pgAsync*` functions, and the owner calls
 * `close()` once they are done. It holds no secret: only sockets and numbers.
 * The arrays are the functions' bookkeeping, readable for a test or a status
 * page; a program writes none of them.
 */
export class PgAsyncPool {
  /** Each slot's socket, or -1 while it is not connected. */
  readonly fds: i32[]
  /** Each slot's state: 0 free, 1 claimed by a ticket. */
  readonly claimed: u8[]
  /** Each slot's claim count, the high part of its current ticket. */
  readonly claims: i32[]
  /** The number of connection slots, fixed at construction. */
  readonly size: i32
  /**
   * The largest message a query accepts, in bytes, 1024 to 2^30 - 1; a larger
   * one fails it with `PG_ERR_TOO_BIG` and closes the connection.
   */
  maxMessage: i32 = 1048576
  /**
   * The most columns a row may have, 1 to 65535; more fails the query with
   * `PG_ERR_TOO_BIG` and closes the connection.
   */
  maxColumns: i32 = 1664
  /**
   * The most rows a query keeps, 1 to 2^24; later rows are read and dropped,
   * and the query fails with `PG_ERR_TOO_BIG`.
   */
  maxRows: i32 = 100000
  /**
   * The most bytes of rows a query keeps, 1024 to 2^30 - 1: each row costs
   * its DataRow's length and 16 bytes a cell. A row past it is dropped with
   * every later one, read through to the ReadyForQuery, and the query fails
   * with `PG_ERR_TOO_BIG`.
   */
  maxResultBytes: i32 = 16777216
  /**
   * The most milliseconds `pgAsyncClaim` or `pgAsyncSeat` waits for a free
   * connection before it answers `PG_CARRIER_FULL`.
   */
  claimWaitMs: i32 = 5000
  /**
   * The most statements `pgAsyncSeat` puts in flight on one connection at once,
   * 1 to `PG_ASYNC_MAX_DEPTH`.
   */
  depth: i32 = 8
  /** How many times `pgAsyncClaim` or `pgAsyncSeat` waited because no live connection had room. */
  waits: i32 = 0
  /** How many times `pgAsyncTurn` waited for the answers seated ahead of its own. */
  turnWaits: i32 = 0
  /**
   * How many connections were closed rather than given back: by
   * `pgAsyncRelease`, or once a lost pipeline emptied.
   */
  dropped: i32 = 0
  /**
   * The most milliseconds `pgAsyncConnect` gives one connection to connect
   * and finish its startup before it closes it and moves on; 0 or less waits
   * for as long as the server takes.
   */
  connectWaitMs: i32 = 10000
  /** How many connections `pgAsyncConnect` made, in all. */
  connects: i32 = 0
  /**
   * The queue number of the task `pgAsyncSeat` seats next. Tasks waiting for
   * a seat take one in turn, in the order they began to wait, and a task
   * that has not waited takes none while any is queued.
   */
  seatHead: i32 = 0
  /** The queue number the next task to wait for a seat takes. */
  seatTail: i32 = 0
  /** Per queue number, modulo its length: 1 when its task stopped waiting before its turn. */
  readonly seatGone: u8[]
  /** Each statement `pgAsyncPrepare` registered: its SQL as UTF-8. */
  readonly statements: u8[][]
  /**
   * Per slot and statement (`slot * PG_ASYNC_MAX_STATEMENTS + statement`): 1
   * once a Parse for it was sent on that connection.
   */
  readonly prepared: u8[]
  /** Per slot: answer bytes read past the last statement served, at `[inStart, inEnd)`. */
  readonly inputs: u8[][]
  /** Per slot: where the unserved bytes in `inputs` start. */
  readonly inStart: i32[]
  /** Per slot: where the unserved bytes in `inputs` end. */
  readonly inEnd: i32[]
  /**
   * Per slot: where the answer in turn ends in `inputs`, past its
   * ReadyForQuery, or -1 while it is not there whole.
   */
  readonly inAnswer: i32[]
  /** Per slot: 1 when the answer in turn begins with a ParseComplete. */
  readonly inParsed: u8[]
  /** Per slot: the sequence number the next seated statement takes. */
  readonly nextSeq: i32[]
  /** Per slot: the sequence number whose answer is read next. */
  readonly served: i32[]
  /** Per slot: the first sequence number that is not served because the connection was lost, or -1. */
  readonly doomAt: i32[]
  /** Per slot: the seats in use. */
  readonly seated: i32[]
  /** Per slot: 1 while a seated statement has not yet been written whole. */
  readonly writing: u8[]
  /** Per seat (`slot * PG_ASYNC_MAX_DEPTH + k`): 1 while a ticket holds it. */
  readonly seatUsed: u8[]
  /** Per seat: its statement's sequence number on the connection. */
  readonly seatSeq: i32[]
  /** Per seat: its statement. */
  readonly seatStatement: i32[]
  /** Per seat: 1 when its write carries the statement's Parse. */
  readonly seatParse: u8[]
  /** Per seat: 1 while its task waits for its answer's turn. */
  readonly seatWaiting: u8[]
  /** Per seat: its claim count, the high part of its current ticket. */
  readonly seatClaims: i32[]
  /**
   * Per seat: 0, or how far a seat whose task was cancelled with its answer
   * unread has gone: 1 abandoned, 2 abandoned and its ticket spent, 3 its
   * answer read past and its ticket not yet spent.
   */
  readonly seatAbandoned: u8[]
  /** Per slot: 1 while a task reads past an abandoned seat's answer. */
  readonly skipping: u8[]
  /**
   * Per slot, then one for the pool, then one per queue lane: a socket pair
   * whose read end a waiting task waits on, or -1. A pair is opened the first
   * time a task waits on its wake, so a pool nobody waits on holds none.
   */
  readonly wakes: i32[]
  /** Where `pgAsyncPark` opens a wake's socket pair, so it does not allocate. */
  readonly wakePair: i32[]
  /** Per wake: 1 while a byte is written and not yet read. */
  readonly wakePending: u8[]
  /** The bytes a wake is rung with and read back into, so neither allocates. */
  readonly wakeBytes: u8[]
  /** Per wake: the tasks waiting on it. */
  readonly waiters: i32[]
  /** Per wake: how many bytes were written to it, wrapping; a waiter that sees it move was rung. */
  readonly wakeRings: i32[]
  /** Per wake: the tasks waiting when its byte was written that have not yet woken; it is read back at 0. */
  readonly wakeUnseen: i32[]

  /**
   * A pool of `size` slots, none connected yet. A waiting task waits on a
   * wake: one per slot, one for the pool and one per queue lane. Each opens
   * its socket pair the first time a task waits on it; `close()` closes the
   * pairs opened.
   * @param size The number of connections, 1 to `PG_ASYNC_MAX_SIZE`; any
   *   other panics.
   */
  constructor(size: i32) {
    if (size < 1 || size > PG_ASYNC_MAX_SIZE) {
      panic("nish/net/postgres-async: a PgAsyncPool size out of range")
    }
    this.size = size
    this.fds = new Array<i32>(size)
    this.claimed = new Array<u8>(size)
    this.claims = new Array<i32>(size)
    this.statements = []
    this.prepared = new Array<u8>(size * PG_ASYNC_MAX_STATEMENTS)
    this.inputs = []
    this.inStart = new Array<i32>(size)
    this.inEnd = new Array<i32>(size)
    this.inAnswer = new Array<i32>(size)
    this.inParsed = new Array<u8>(size)
    this.nextSeq = new Array<i32>(size)
    this.served = new Array<i32>(size)
    this.doomAt = new Array<i32>(size)
    this.seated = new Array<i32>(size)
    this.writing = new Array<u8>(size)
    this.seatUsed = new Array<u8>(size * PG_ASYNC_MAX_DEPTH)
    this.seatSeq = new Array<i32>(size * PG_ASYNC_MAX_DEPTH)
    this.seatStatement = new Array<i32>(size * PG_ASYNC_MAX_DEPTH)
    this.seatParse = new Array<u8>(size * PG_ASYNC_MAX_DEPTH)
    this.seatWaiting = new Array<u8>(size * PG_ASYNC_MAX_DEPTH)
    this.seatClaims = new Array<i32>(size * PG_ASYNC_MAX_DEPTH)
    this.seatAbandoned = new Array<u8>(size * PG_ASYNC_MAX_DEPTH)
    this.skipping = new Array<u8>(size)
    const wakes: i32 = size + 1 + PG_ASYNC_LANES
    this.wakes = new Array<i32>(wakes * 2)
    this.wakePending = new Array<u8>(wakes)
    this.wakeBytes = new Array<u8>(8)
    this.wakePair = new Array<i32>(2)
    this.waiters = new Array<i32>(wakes)
    this.wakeRings = new Array<i32>(wakes)
    this.wakeUnseen = new Array<i32>(wakes)
    this.seatGone = new Array<u8>(PG_ASYNC_QUEUE)
    for (let s: i32 = 0; s < size; s++) {
      this.fds[s] = -1
      this.doomAt[s] = -1
      this.inputs.push(new Array<u8>(PG_ASYNC_INPUT_SIZE))
    }
    for (let w: i32 = 0; w < wakes * 2; w++) {
      this.wakes[w] = -1
    }
  }

  /**
   * The number of slots connected now, claimed or not.
   * @returns The count, 0 to `size`.
   */
  live(): i32 {
    let n: i32 = 0
    for (let s: i32 = 0; s < this.size; s++) {
      if (this.fds[s] >= 0) {
        n += 1
      }
    }
    return n
  }

  /**
   * Ends every connection: a Terminate is offered to each socket, which is
   * then closed, claimed or not, and closes the wakes. Call it once the tasks
   * that hold tickets are done; a ticket used afterwards panics.
   */
  close(): void {
    const terminate: u8[] = [88, 0, 0, 0, 4]
    for (let s: i32 = 0; s < this.size; s++) {
      const fd: i32 = this.fds[s]
      if (fd >= 0) {
        netWrite(fd, terminate, 0, 5)
        netClose(fd)
        this.fds[s] = -1
      }
      this.claimed[s] = 0
      this.claims[s] = (this.claims[s] + 1) % PG_ASYNC_CLAIM_WRAP
      for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
        const seat: i32 = s * PG_ASYNC_MAX_DEPTH + k
        this.seatUsed[seat] = 0
        this.seatWaiting[seat] = 0
        this.seatAbandoned[seat] = 0
        this.seatClaims[seat] = (this.seatClaims[seat] + 1) % PG_ASYNC_SEAT_WRAP
      }
      pgAsyncForget(this, s)
    }
    for (let w: i32 = 0; w < toI32(this.wakes.length); w++) {
      if (this.wakes[w] >= 0) {
        netClose(this.wakes[w])
        this.wakes[w] = -1
      }
    }
  }
}

/** Resets slot `s`'s pipeline: nothing in flight, nothing prepared, nothing buffered. */
const pgAsyncForget = (pool: PgAsyncPool, s: i32): void => {
  pool.nextSeq[s] = 0
  pool.served[s] = 0
  pool.doomAt[s] = -1
  pool.seated[s] = 0
  pool.writing[s] = 0
  pool.inStart[s] = 0
  pool.inEnd[s] = 0
  pool.inAnswer[s] = -1
  pool.inParsed[s] = 0
  pool.skipping[s] = 0
  for (let q: i32 = 0; q < PG_ASYNC_MAX_STATEMENTS; q++) {
    pool.prepared[s * PG_ASYNC_MAX_STATEMENTS + q] = 0
  }
}

/**
 * A query's parameters, in text, in the order `$1`, `$2`, ... name them. A
 * task builds its own; the values travel apart from the SQL, so none is ever
 * read as SQL.
 */
export class PgAsyncParams {
  /** Each parameter's text, `""` for a NULL. */
  readonly values: string[]
  /** Whether each parameter is NULL. */
  readonly nulls: boolean[]

  /** No parameters yet. */
  constructor() {
    this.values = []
    this.nulls = []
  }

  /**
   * Adds a text parameter.
   * @param value The text, sent as its UTF-8 bytes.
   */
  text(value: string): void {
    this.values.push(value)
    this.nulls.push(false)
  }

  /**
   * Adds an integer parameter, sent as its decimal text.
   * @param value The number.
   */
  int(value: i32): void {
    this.values.push(`${value}`)
    this.nulls.push(false)
  }

  /** Adds a NULL parameter. */
  none(): void {
    this.values.push("")
    this.nulls.push(true)
  }
}

/**
 * One query's answer, in the task's own memory: its rows as text, its tag,
 * and how it ended.
 */
export class PgAsyncResult {
  /** `PG_CARRIER_DONE` when the query worked, `PG_CARRIER_FAILED` when it did not. */
  code: i32
  /** When it failed: a `PG_ERR_*`, `PG_ERR_NONE` when the server refused the statement. */
  failure: i32 = 0
  /**
   * When the socket failed: its negative errno, 0 when the server closed
   * cleanly, `PG_ASYNC_CANCELLED` when the task was cancelled.
   */
  socketError: i32 = 0
  /** Whether the connection may serve another query: hand it to `pgAsyncRelease`. */
  reusable: boolean = false
  /** The number of columns in each row (the first row's; every row must match). */
  columns: i32 = 0
  /** The number of rows kept. */
  rows: i32 = 0
  /** The command tag, e.g. `SELECT 2` or `UPDATE 1`; `""` for an empty query. */
  tag: string = ""
  /** The server's SQLSTATE when it refused the statement, e.g. `42P01`. */
  errorCode: string = ""
  /** The server's message when it refused the statement. */
  errorMessage: string = ""
  /** Every kept cell's text, row by row; `""` for a NULL. */
  readonly values: string[]
  /** Whether each kept cell is NULL, as `values`. */
  readonly nulls: boolean[]

  /** An answer with no rows that worked, until the query fills it in. */
  constructor() {
    this.code = PG_CARRIER_DONE
    this.values = []
    this.nulls = []
  }

  /**
   * Whether the query worked.
   * @returns True for `PG_CARRIER_DONE`.
   */
  ok(): boolean {
    return this.code === PG_CARRIER_DONE
  }

  /**
   * A cell's text, `""` for a NULL; panics on a row or column out of range.
   * @param row The row, from 0.
   * @param column The column, from 0.
   * @returns The text the server sent.
   */
  text(row: i32, column: i32): string {
    return this.values[this.cell(row, column)]
  }

  /**
   * Whether a cell is NULL; panics on a row or column out of range.
   * @param row The row, from 0.
   * @param column The column, from 0.
   * @returns True for a NULL.
   */
  isNull(row: i32, column: i32): boolean {
    return this.nulls[this.cell(row, column)]
  }

  /**
   * A cell read as a decimal `i32`, or `fallback` when it is NULL or not one.
   * @param row The row, from 0.
   * @param column The column, from 0.
   * @param fallback The answer for a NULL or a cell that is not a decimal `i32`.
   * @returns The number.
   */
  int(row: i32, column: i32, fallback: i32): i32 {
    const at: i32 = this.cell(row, column)
    if (this.nulls[at]) {
      return fallback
    }
    return pgAsyncDecimal(this.values[at], fallback)
  }

  /** The index into `values` of a cell, after the bounds check. */
  private cell(row: i32, column: i32): i32 {
    if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) {
      panic("nish/net/postgres-async: a cell out of range")
    }
    return row * this.columns + column
  }
}

/** `s` as a decimal `i32`, or `fallback` when it is not one. */
const pgAsyncDecimal = (s: string, fallback: i32): i32 => {
  const n: i32 = toI32(s.length)
  if (n === 0 || n > 11) {
    return fallback
  }
  let at: i32 = 0
  const negative: boolean = s.charCodeAt(0) === 45
  if (negative) {
    at = 1
    if (n === 1) {
      return fallback
    }
  }
  let v: i64 = 0
  while (at < n) {
    const c: i32 = toI32(s.charCodeAt(at))
    if (c < 48 || c > 57) {
      return fallback
    }
    v = v * toI64(10) + toI64(c - 48)
    at += 1
  }
  if (negative) {
    v = -v
  }
  if (v < toI64(-2147483648) || v > toI64(2147483647)) {
    return fallback
  }
  return toI32(v)
}

/**
 * The one place a wait's outcome becomes a failure code: 0 when `readable`
 * or `writable` waited, else what a query or a connect fails with
 * (`PG_ERR_CLOSED` beside it): `PG_ASYNC_CANCELLED` when the task was
 * cancelled, which fails every wait it makes, else EBADF.
 */
const pgAsyncWaitFailure = (waited: boolean): i32 => {
  if (waited) {
    return 0
  }
  return cancelled() ? PG_ASYNC_CANCELLED : PG_ASYNC_BAD_FD
}

/** `ticket`'s slot, after checking it is the slot's current claim; panics otherwise. */
const pgAsyncSlot = (pool: PgAsyncPool, ticket: i32): i32 => {
  const slot: i32 = ticket >= 0 ? ticket % PG_ASYNC_MAX_SIZE : -1
  if (
    slot < 0 ||
    slot >= pool.size ||
    toI32(pool.claimed[slot]) !== 1 ||
    toI32(ticket / PG_ASYNC_MAX_SIZE) !== pool.claims[slot]
  ) {
    panic("nish/net/postgres-async: a ticket that is not a current claim")
  }
  return slot
}

/**
 * Connects every slot of `pool` that is not connected, one after another,
 * and authenticates each on a `PgConnection` (startup, then SCRAM-SHA-256 or
 * `trust`), which wipes its copy of the password once the proof is made and
 * is then dropped. Call it from `main` or another function that is not a
 * spawned task: it holds the password. A slot that fails stays unconnected;
 * call it again to retry.
 * @param pool The pool to fill.
 * @param config The startup parameters and caps for the handshake.
 * @param password The role's password as UTF-8 bytes; copied for each
 *   connection, so the caller wipes its own afterwards.
 * @param target Where the server is, as `pgTarget` made it; a TCP host must
 *   be a numeric address, and a target that failed panics.
 * @returns The number of slots connected after the call.
 */
export const pgAsyncConnect = async (
  pool: PgAsyncPool,
  config: PgConfig,
  password: Secret<u8[]>,
  target: PgTarget
): Promise<i32> => {
  if (target.failure !== PG_TARGET_OK) {
    panic("nish/net/postgres-async: pgAsyncConnect to a target that failed")
  }
  const address: u8[] = new Array<u8>(18)
  if (!target.unix && netAddress(address, target.host, target.port) < 0) {
    panic("nish/net/postgres-async: a TCP host must be a numeric address")
  }
  const nonce: u8[] = new Array<u8>(PG_ASYNC_NONCE_BYTES)
  for (let s: i32 = 0; s < pool.size; s++) {
    if (pool.fds[s] >= 0) {
      continue
    }
    crypto.getRandomValues(nonce)
    const conn = new PgConnection(config, password, nonce)
    const fd: i32 = target.unix ? unixConnect(target.path) : tcpConnect(address)
    if (fd < 0) {
      conn.dispose()
      continue
    }
    const made: boolean = await pgAsyncStartup(conn, fd, monotonicNanos(), pool.connectWaitMs)
    conn.dispose()
    if (made) {
      pool.fds[s] = fd
      pool.claimed[s] = 0
      pool.connects += 1
      pgAsyncForget(pool, s)
    } else {
      netClose(fd)
    }
  }
  return pool.live()
}

/**
 * Runs `conn`'s startup on `fd` until it is ready (true) or has failed
 * (false), failing too once `waitMs` have passed since `began` (a
 * `monotonicNanos` reading) when `waitMs` is above 0.
 */
const pgAsyncStartup = async (conn: PgConnection, fd: i32, began: i64, waitMs: i32): Promise<boolean> => {
  const connected: boolean = await pgAsyncWaitUntil(fd, true, began, waitMs)
  if (!connected || connectResult(fd) !== 0) {
    return false
  }
  while (true) {
    while (conn.outputEnd() > conn.outputStart()) {
      const n: i32 = netWrite(
        fd,
        conn.outputBuffer(),
        conn.outputStart(),
        conn.outputEnd() - conn.outputStart()
      )
      if (n === PG_ASYNC_AGAIN) {
        const waited: boolean = await pgAsyncWaitUntil(fd, true, began, waitMs)
        if (!waited) {
          return false
        }
      } else if (n <= 0) {
        conn.closed()
        return false
      } else {
        conn.sent(n)
      }
    }
    const event: i32 = conn.next()
    if (event === PG_READY) {
      return conn.txStatus === PG_ASYNC_IDLE
    }
    if (event === PG_FAILED) {
      return false
    }
    // A step that queued an answer (the SCRAM messages) writes it before it
    // reads: the server says nothing more until it has that answer.
    if (event === PG_NEED_MORE && conn.outputEnd() === conn.outputStart()) {
      const room: i32 = conn.inputRoom()
      const got: i32 = room > 0 ? netRead(fd, conn.inputBuffer(), conn.inputEnd(), room) : 0
      if (got === PG_ASYNC_AGAIN) {
        const waited: boolean = await pgAsyncWaitUntil(fd, false, began, waitMs)
        if (!waited) {
          return false
        }
      } else if (got <= 0) {
        conn.closed()
        return false
      } else {
        conn.received(got)
      }
    }
  }
}

/**
 * Waits until `fd` is writable (`write`) or readable: true once it is, false
 * when the wait failed, the task is cancelled, or `waitMs` (when above 0)
 * have passed since `began`, a `monotonicNanos` reading.
 */
const pgAsyncWaitUntil = async (fd: i32, write: boolean, began: i64, waitMs: i32): Promise<boolean> => {
  let waited: boolean = false
  if (waitMs <= 0 && write) {
    waited = await writable(fd)
  } else if (waitMs <= 0) {
    waited = await readable(fd)
  } else {
    const left: i32 = waitMs - pgAsyncSince(began)
    if (left <= 0) {
      return false
    }
    if (write) {
      waited = await writableWithin(fd, left)
    } else {
      waited = await readableWithin(fd, left)
    }
  }
  return pgAsyncWaitFailure(waited) === 0
}

/** Milliseconds since `began`, a `monotonicNanos` reading. */
const pgAsyncSince = (began: i64): i32 => {
  const ms: i64 = (monotonicNanos() - began) / toI64(1000000)
  return ms > toI64(1073741823) ? 1073741823 : toI32(ms)
}

/**
 * Wakes the tasks waiting on wake `w` (a slot, or `pool.size` for the pool):
 * one byte on its socket pair, unless one is already there or none waits.
 * The byte stays until every task then waiting has woken: the runtime reports
 * at most 64 ready sockets a turn, and a byte read back by the first of
 * many would leave the rest waiting until their time ran out.
 */
const pgAsyncSignal = (pool: PgAsyncPool, w: i32): void => {
  const fd: i32 = pool.wakes[w * 2 + 1]
  if (pool.waiters[w] <= 0 || fd < 0) {
    return
  }
  if (toI32(pool.wakePending[w]) === 0) {
    pool.wakeBytes[0] = 1
    if (netWrite(fd, pool.wakeBytes, 0, 1) !== 1) {
      return
    }
    pool.wakePending[w] = 1
  }
  // Rung again while its byte is there, the byte now stays for every task
  // waiting at this ring too: one that waited again after the last ring would
  // otherwise see the byte read back before it was polled, and wait for ever.
  pool.wakeUnseen[w] = pool.waiters[w]
  pool.wakeRings[w] = (pool.wakeRings[w] + 1) % PG_ASYNC_QUEUE_WRAP
}

/**
 * The seats a task could take now or once a write in progress ends: on each
 * live connection no task claimed whole and none doomed, `depth` less those
 * in flight.
 */
const pgAsyncFreeSeats = (pool: PgAsyncPool): i32 => {
  let free: i32 = 0
  for (let s: i32 = 0; s < pool.size; s++) {
    if (
      pool.fds[s] >= 0 &&
      toI32(pool.claimed[s]) === 0 &&
      pool.doomAt[s] < 0 &&
      pool.seated[s] < pool.depth
    ) {
      free += pool.depth - pool.seated[s]
    }
  }
  return free
}

/**
 * Wakes the tasks waiting for a slot or seat: those outside the queue, and as
 * many of the queue's first as there are free seats, at least its head, so
 * seats freed together are taken in one loop turn and not one a turn.
 */
const pgAsyncWakePool = (pool: PgAsyncPool): void => {
  pgAsyncSignal(pool, pool.size)
  const queued: i32 = (pool.seatTail - pool.seatHead + PG_ASYNC_QUEUE_WRAP) % PG_ASYNC_QUEUE_WRAP
  if (queued === 0) {
    return
  }
  const free: i32 = pgAsyncFreeSeats(pool)
  let wake: i32 = free < 1 ? 1 : free
  wake = wake > queued ? queued : wake
  wake = wake > PG_ASYNC_LANES ? PG_ASYNC_LANES : wake
  for (let k: i32 = 0; k < wake; k++) {
    pgAsyncSignal(pool, pool.size + 1 + ((pool.seatHead + k) % PG_ASYNC_LANES))
  }
}

/** Reads wake `w`'s byte back once every task it was written for has woken, so its waiters wait again. */
const pgAsyncDrain = (pool: PgAsyncPool, w: i32): void => {
  const fd: i32 = pool.wakes[w * 2]
  if (toI32(pool.wakePending[w]) === 1 && pool.wakeUnseen[w] <= 0 && fd >= 0) {
    netRead(fd, pool.wakeBytes, 0, 8)
    pool.wakePending[w] = 0
  }
}

/**
 * Waits on wake `w` for up to `ms` milliseconds (no limit when negative),
 * opening its socket pair the first time, or 1 ms when no pair can be opened.
 * A cancelled task returns at once.
 */
const pgAsyncPark = async (pool: PgAsyncPool, w: i32, ms: i32): Promise<void> => {
  if (pool.wakes[w * 2] < 0 && unixSocketPair(NET_UNIX_STREAM, pool.wakePair) >= 0) {
    // Opened before this task counts as waiting, so no byte is written to a
    // wake without a pair. Out of descriptors, it sleeps 1 ms and tries again.
    pool.wakes[w * 2] = pool.wakePair[0]
    pool.wakes[w * 2 + 1] = pool.wakePair[1]
  }
  const fd: i32 = pool.wakes[w * 2]
  const rings: i32 = pool.wakeRings[w]
  pool.waiters[w] += 1
  if (fd < 0) {
    await sleep(1)
  } else {
    await readableWithin(fd, ms)
  }
  pool.waiters[w] -= 1
  if (pool.wakeRings[w] !== rings) {
    // Waiting when the byte was written: one fewer it waits for.
    pool.wakeUnseen[w] -= 1
  }
}

/**
 * Claims a free connection for the calling task, the whole of it: one with
 * no pipelined statement in flight. While every live one is busy it waits
 * until `pgAsyncRelease` or a pipelined answer frees one and wakes it, for at
 * most `pool.claimWaitMs` in all. A cancelled task claims nothing, so a
 * connection is never taken by a task that would close it at its first wait.
 * It writes only numbers into the pool, so a spawned task may call it.
 * @param pool The pool.
 * @returns A ticket (0 or more) for `pgAsyncQuery` and then exactly one
 *   `pgAsyncRelease`; `PG_POOL_NONE` (-1) when no slot is connected;
 *   `PG_CARRIER_FULL` (-2) when none came free in time;
 *   `PG_ASYNC_CANCELLED` (-3) when the calling task is cancelled, before or
 *   while it waits.
 */
export const pgAsyncClaim = async (pool: PgAsyncPool): Promise<i32> => {
  const began: i64 = monotonicNanos()
  let waited: boolean = false
  while (true) {
    if (cancelled()) {
      return PG_ASYNC_CANCELLED
    }
    let live: boolean = false
    for (let s: i32 = 0; s < pool.size; s++) {
      if (pool.fds[s] < 0) {
        continue
      }
      live = true
      if (toI32(pool.claimed[s]) === 0 && pool.seated[s] === 0 && pool.doomAt[s] < 0) {
        pool.claimed[s] = 1
        pool.claims[s] = (pool.claims[s] + 1) % PG_ASYNC_CLAIM_WRAP
        if (waited) {
          // Another waiter may find room this one did not take.
          pgAsyncWakePool(pool)
        }
        return pool.claims[s] * PG_ASYNC_MAX_SIZE + s
      }
    }
    if (!live) {
      return PG_POOL_NONE
    }
    const left: i32 = pool.claimWaitMs - pgAsyncSince(began)
    if (left <= 0) {
      return PG_CARRIER_FULL
    }
    const skipped: boolean = await pgAsyncSkipAny(pool)
    if (skipped) {
      continue
    }
    pool.waits += 1
    waited = true
    await pgAsyncPark(pool, pool.size, left)
    pgAsyncDrain(pool, pool.size)
  }
}

/**
 * Gives a claimed connection back, or closes it when `reusable` is false, and
 * wakes the tasks waiting for one; the ticket is spent either way, and a
 * ticket that is not the slot's current claim (a second release, or one after
 * `close()`) panics. It writes only numbers into the pool, so a spawned task
 * may call it.
 * @param pool The pool the ticket came from.
 * @param ticket The ticket `pgAsyncClaim` answered.
 * @param reusable The query's `reusable`; false closes the connection.
 */
export const pgAsyncRelease = (pool: PgAsyncPool, ticket: i32, reusable: boolean): void => {
  const slot: i32 = pgAsyncSlot(pool, ticket)
  if (!reusable) {
    netClose(pool.fds[slot])
    pool.fds[slot] = -1
    pool.dropped += 1
    pgAsyncForget(pool, slot)
  }
  pool.claimed[slot] = 0
  pool.claims[slot] = (pool.claims[slot] + 1) % PG_ASYNC_CLAIM_WRAP
  pgAsyncWakePool(pool)
}

/**
 * Registers a statement the pipelined calls run by its number, prepared once
 * on each connection, the first time a task sends it there. Call it from
 * `main` or another function that is not a spawned task, before the tasks
 * start: it grows the pool.
 * @param pool The pool.
 * @param sql One statement, `$1`, `$2`, ... naming the parameters.
 * @returns The statement's number for `pgAsyncSeat`, 0 or more; -1 when the
 *   SQL holds a NUL or `PG_ASYNC_MAX_STATEMENTS` are registered already.
 */
export const pgAsyncPrepare = (pool: PgAsyncPool, sql: string): i32 => {
  const bytes = pgAsyncBytes(sql)
  if (bytes === null || toI32(pool.statements.length) >= PG_ASYNC_MAX_STATEMENTS) {
    return -1
  }
  pool.statements.push(bytes)
  return toI32(pool.statements.length) - 1
}

/**
 * Takes queue number `n` out of the seat queue: at its head, moves the head
 * past it and past every number whose task left already, and wakes the
 * waiters so the new head looks for a seat; otherwise marks it gone. -1 is
 * no number.
 */
const pgAsyncUnqueue = (pool: PgAsyncPool, n: i32): void => {
  if (n < 0) {
    return
  }
  if (n !== pool.seatHead) {
    pool.seatGone[n % PG_ASYNC_QUEUE] = 1
    return
  }
  pool.seatHead = (pool.seatHead + 1) % PG_ASYNC_QUEUE_WRAP
  while (pool.seatHead !== pool.seatTail && toI32(pool.seatGone[pool.seatHead % PG_ASYNC_QUEUE]) !== 0) {
    pool.seatGone[pool.seatHead % PG_ASYNC_QUEUE] = 0
    pool.seatHead = (pool.seatHead + 1) % PG_ASYNC_QUEUE_WRAP
  }
  pgAsyncWakePool(pool)
}

/**
 * Takes a seat for one statement on a shared connection: the live one with
 * the fewest statements in flight, below `pool.depth`, that no task claimed
 * whole and no task is writing to. The seat fixes the statement's place in
 * the connection's order, so the calling task goes straight on, with no
 * other `await` between: `pgAsyncSend` writes the statement, `pgAsyncTurn`
 * waits for its answer, `pgAsyncAnswer` builds it and `pgAsyncDone` spends
 * the ticket. Until `pgAsyncTurn` no other seat on the connection is taken,
 * so the statements go out in the order of their seats. While no connection has room it waits until a seat
 * or a connection frees and wakes it, for at most `pool.claimWaitMs` in all;
 * waiting tasks are seated in the order they began to wait, the first as many
 * as there are seats free at once, and a task that has not waited is seated
 * only while none waits.
 * It writes only numbers into the pool, so a spawned task may call it.
 * @param pool The pool.
 * @param statement A number `pgAsyncPrepare` answered; any other panics, as
 *   does a `pool.depth` out of range.
 * @returns A ticket (0 or more) for `pgAsyncSend`, `pgAsyncTurn`,
 *   `pgAsyncAnswer` and `pgAsyncDone`, each called once; `PG_POOL_NONE` (-1) when no slot is connected;
 *   `PG_CARRIER_FULL` (-2) when no seat came free in time;
 *   `PG_ASYNC_CANCELLED` (-3) when the calling task is cancelled, before or
 *   while it waits.
 */
export const pgAsyncSeat = async (pool: PgAsyncPool, statement: i32): Promise<i32> => {
  if (statement < 0 || statement >= toI32(pool.statements.length)) {
    panic("nish/net/postgres-async: a statement pgAsyncPrepare did not register")
  }
  if (pool.depth < 1 || pool.depth > PG_ASYNC_MAX_DEPTH) {
    panic("nish/net/postgres-async: a PgAsyncPool depth out of range")
  }
  const began: i64 = monotonicNanos()
  // This task's queue number once it waits, or -1.
  let queued: i32 = -1
  while (true) {
    if (cancelled()) {
      pgAsyncUnqueue(pool, queued)
      return PG_ASYNC_CANCELLED
    }
    let live: boolean = false
    let best: i32 = -1
    let free: i32 = 0
    for (let s: i32 = 0; s < pool.size; s++) {
      if (pool.fds[s] < 0) {
        continue
      }
      live = true
      if (toI32(pool.claimed[s]) !== 0 || pool.doomAt[s] >= 0 || pool.seated[s] >= pool.depth) {
        continue
      }
      free += pool.depth - pool.seated[s]
      if (toI32(pool.writing[s]) !== 0) {
        continue
      }
      if (best < 0 || pool.seated[s] < pool.seated[best]) {
        best = s
      }
    }
    // First come, first seated: under load a task that lost the seat it was
    // woken for to another would wait on until `claimWaitMs` failed it. Of
    // the queue, the first as many as there are free seats may take one, so
    // seats freed together go in one loop turn; a task outside the queue
    // takes one only while none waits.
    const turn: boolean =
      queued >= 0
        ? (queued - pool.seatHead + PG_ASYNC_QUEUE_WRAP) % PG_ASYNC_QUEUE_WRAP < free
        : pool.seatHead === pool.seatTail
    if (best >= 0 && turn) {
      for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
        const seat: i32 = best * PG_ASYNC_MAX_DEPTH + k
        if (toI32(pool.seatUsed[seat]) !== 0) {
          continue
        }
        const known: i32 = best * PG_ASYNC_MAX_STATEMENTS + statement
        pool.seatUsed[seat] = 1
        pool.seatWaiting[seat] = 0
        pool.seatSeq[seat] = pool.nextSeq[best]
        pool.seatStatement[seat] = statement
        pool.seatParse[seat] = toI32(pool.prepared[known]) === 0 ? 1 : 0
        pool.prepared[known] = 1
        pool.nextSeq[best] = (pool.nextSeq[best] + 1) % PG_ASYNC_SEQ_WRAP
        pool.seated[best] += 1
        pool.writing[best] = 1
        pool.seatClaims[seat] = (pool.seatClaims[seat] + 1) % PG_ASYNC_SEAT_WRAP
        // The next in the queue may find a seat this one did not take.
        pgAsyncUnqueue(pool, queued)
        return pool.seatClaims[seat] * PG_ASYNC_SEATS + seat
      }
    }
    if (!live) {
      pgAsyncUnqueue(pool, queued)
      return PG_POOL_NONE
    }
    const left: i32 = pool.claimWaitMs - pgAsyncSince(began)
    if (left <= 0) {
      pgAsyncUnqueue(pool, queued)
      return PG_CARRIER_FULL
    }
    if (
      queued < 0 &&
      (pool.seatTail - pool.seatHead + PG_ASYNC_QUEUE_WRAP) % PG_ASYNC_QUEUE_WRAP < PG_ASYNC_QUEUE
    ) {
      queued = pool.seatTail
      pool.seatTail = (pool.seatTail + 1) % PG_ASYNC_QUEUE_WRAP
    }
    const skipped: boolean = await pgAsyncSkipAny(pool)
    if (skipped) {
      continue
    }
    const w: i32 = queued >= 0 ? pool.size + 1 + (queued % PG_ASYNC_LANES) : pool.size
    pool.waits += 1
    await pgAsyncPark(pool, w, left)
    pgAsyncDrain(pool, w)
  }
}

/** `ticket`'s seat, after checking it is the seat's current claim; panics otherwise. */
const pgAsyncSeatOf = (pool: PgAsyncPool, ticket: i32): i32 => {
  const seat: i32 = ticket >= 0 ? ticket % PG_ASYNC_SEATS : -1
  if (
    seat < 0 ||
    seat >= pool.size * PG_ASYNC_MAX_DEPTH ||
    toI32(pool.seatUsed[seat]) !== 1 ||
    toI32(ticket / PG_ASYNC_SEATS) !== pool.seatClaims[seat]
  ) {
    panic("nish/net/postgres-async: a ticket that is not a current seat")
  }
  return seat
}

/**
 * Writes the seat's statement: its Parse the first time the connection runs
 * it, then Bind (each parameter in text), Execute and Sync, whole, waiting on
 * the socket while other tasks run. It only reads the pool; its buffer is the
 * calling task's.
 * @param pool The pool the ticket came from.
 * @param ticket A ticket `pgAsyncSeat` answered and no `pgAsyncDone` has
 *   spent; any other panics.
 * @param params The parameters, as many as the statement names; a NUL in
 *   one sends nothing.
 * @returns What to hand `pgAsyncTurn`: the bytes written, or
 *   `PG_ASYNC_UNSENT` or `PG_ASYNC_UNSENT_CANCELLED` when nothing was, or
 *   less than -15 when the write broke.
 */
export const pgAsyncSend = async (pool: PgAsyncPool, ticket: i32, params: PgAsyncParams): Promise<i32> => {
  const seat: i32 = pgAsyncSeatOf(pool, ticket)
  if (cancelled()) {
    return PG_ASYNC_UNSENT_CANCELLED
  }
  const statement: i32 = pool.seatStatement[seat]
  const out: u8[] | null = pgAsyncEncode(
    pool.statements[statement],
    statement,
    toI32(pool.seatParse[seat]) === 1,
    params
  )
  if (out === null) {
    return PG_ASYNC_UNSENT
  }
  const fd: i32 = pool.fds[toI32(seat / PG_ASYNC_MAX_DEPTH)]
  let sent: i32 = 0
  while (sent < toI32(out.length)) {
    const n: i32 = netWrite(fd, out, sent, toI32(out.length) - sent)
    if (n === PG_ASYNC_AGAIN) {
      const waited: boolean = await writable(fd)
      const failed: i32 = pgAsyncWaitFailure(waited)
      if (failed === PG_ASYNC_CANCELLED && sent === 0) {
        return PG_ASYNC_UNSENT_CANCELLED
      }
      if (failed !== 0) {
        return PG_ASYNC_BROKEN + failed
      }
    } else if (n <= 0) {
      return PG_ASYNC_BROKEN + (n < PG_ASYNC_BROKEN ? n : 0)
    } else {
      sent += n
    }
  }
  return sent
}

/** How far `seq` is past slot `s`'s next answer, in the order of its pipeline. */
const pgAsyncAhead = (pool: PgAsyncPool, s: i32, seq: i32): i32 =>
  (seq - pool.served[s] + PG_ASYNC_SEQ_WRAP) % PG_ASYNC_SEQ_WRAP

/** Whether seat `seat`'s answer is lost: its connection failed at or before it. */
const pgAsyncLostSeat = (pool: PgAsyncPool, seat: i32): boolean => {
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  const at: i32 = pool.doomAt[s]
  return at >= 0 && pgAsyncAhead(pool, s, pool.seatSeq[seat]) >= pgAsyncAhead(pool, s, at)
}

/**
 * Whether a task waiting on slot `s`, other than `except`'s, may go on: its
 * turn came, its answer is lost, or an abandoned answer ahead of it waits to
 * be read past.
 */
const pgAsyncReady = (pool: PgAsyncPool, s: i32, except: i32): boolean => {
  let waiting: boolean = false
  for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
    const seat: i32 = s * PG_ASYNC_MAX_DEPTH + k
    if (seat === except || toI32(pool.seatWaiting[seat]) === 0) {
      continue
    }
    if (pool.seatSeq[seat] === pool.served[s] || pgAsyncLostSeat(pool, seat)) {
      return true
    }
    waiting = true
  }
  return waiting && pgAsyncSkippable(pool, s) >= 0
}

/**
 * Marks slot `s` lost from sequence number `seq` on, settles the abandoned
 * seats it loses, and wakes those it fails.
 */
const pgAsyncDoom = (pool: PgAsyncPool, s: i32, seq: i32): void => {
  if (pool.doomAt[s] < 0 || pgAsyncAhead(pool, s, seq) < pgAsyncAhead(pool, s, pool.doomAt[s])) {
    pool.doomAt[s] = seq
  }
  // A seat freed here closes the connection only once no seat is left on it;
  // the one being read past is settled by its reader.
  for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
    const seat: i32 = s * PG_ASYNC_MAX_DEPTH + k
    const state: i32 = toI32(pool.seatAbandoned[seat])
    const reading: boolean = toI32(pool.skipping[s]) === 1 && pool.seatSeq[seat] === pool.served[s]
    if (
      toI32(pool.seatUsed[seat]) === 1 &&
      (state === 1 || state === 2) &&
      !reading &&
      pgAsyncLostSeat(pool, seat)
    ) {
      pgAsyncSettle(pool, seat)
    }
  }
  if (pgAsyncReady(pool, s, -1)) {
    pgAsyncSignal(pool, s)
  }
}

/**
 * Leaves seat `seat` to the pool: its task was cancelled with its answer
 * unread, so the next task to wait on the connection, or for a seat on it,
 * reads past that answer instead of the connection being closed.
 */
const pgAsyncAbandon = (pool: PgAsyncPool, seat: i32): void => {
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  pool.seatAbandoned[seat] = 1
  if (pgAsyncReady(pool, s, seat)) {
    pgAsyncSignal(pool, s)
  }
  pgAsyncWakePool(pool)
}

/**
 * An abandoned seat whose answer is read past or lost: freed once its ticket is
 * spent, else marked so `pgAsyncDone` frees it.
 */
const pgAsyncSettle = (pool: PgAsyncPool, seat: i32): void => {
  if (toI32(pool.seatAbandoned[seat]) === 2) {
    pgAsyncFree(pool, seat)
  } else {
    pool.seatAbandoned[seat] = 3
  }
}

/** The abandoned seat in turn on slot `s` when no task reads past it yet, or -1. */
const pgAsyncSkippable = (pool: PgAsyncPool, s: i32): i32 => {
  if (pool.fds[s] < 0 || toI32(pool.skipping[s]) !== 0) {
    return -1
  }
  for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
    const seat: i32 = s * PG_ASYNC_MAX_DEPTH + k
    const state: i32 = toI32(pool.seatAbandoned[seat])
    if (
      toI32(pool.seatUsed[seat]) === 1 &&
      (state === 1 || state === 2) &&
      pool.seatSeq[seat] === pool.served[s] &&
      !pgAsyncLostSeat(pool, seat)
    ) {
      return seat
    }
  }
  return -1
}

/**
 * Reads past the answer of `seat`, an abandoned seat in turn on slot `s`,
 * and serves the next. An answer that is not a plain one ending idle (a
 * frame this module does not expect, a transaction left open, a setting
 * changed) or larger than the pool's input loses the connection from it on,
 * as does a socket error. A cancelled reader stops and leaves the bytes read
 * for the next.
 */
const pgAsyncSkip = async (pool: PgAsyncPool, s: i32, seat: i32): Promise<void> => {
  const seq: i32 = pool.served[s]
  const fd: i32 = pool.fds[s]
  const input: u8[] = pool.inputs[s]
  pool.skipping[s] = 1
  let fit: boolean = true
  while (!pgAsyncScan(pool, s)) {
    if (pool.inStart[s] > 0) {
      copyBytes(input, 0, input, pool.inStart[s], pool.inEnd[s] - pool.inStart[s])
      pool.inEnd[s] -= pool.inStart[s]
      pool.inStart[s] = 0
    }
    if (pool.inEnd[s] >= toI32(input.length)) {
      fit = false
      break
    }
    const got: i32 = netRead(fd, input, pool.inEnd[s], toI32(input.length) - pool.inEnd[s])
    if (got === PG_ASYNC_AGAIN) {
      const waited: boolean = await readable(fd)
      if (pgAsyncLostSeat(pool, seat)) {
        pool.skipping[s] = 0
        pgAsyncSettle(pool, seat)
        return
      }
      if (!waited && cancelled()) {
        // Another task reads on from where this one stopped.
        pool.skipping[s] = 0
        if (pgAsyncReady(pool, s, -1)) {
          pgAsyncSignal(pool, s)
        }
        pgAsyncWakePool(pool)
        return
      }
      if (!waited) {
        fit = false
        break
      }
    } else if (got <= 0) {
      fit = false
      break
    } else {
      pool.inEnd[s] += got
    }
  }
  pool.skipping[s] = 0
  if (!fit || pool.inAnswer[s] < 0 || !pgAsyncPlain(pool, s)) {
    pgAsyncDoom(pool, s, seq)
    return
  }
  pool.inStart[s] = pool.inAnswer[s]
  if (pool.inStart[s] === pool.inEnd[s]) {
    pool.inStart[s] = 0
    pool.inEnd[s] = 0
  }
  pool.served[s] = (seq + 1) % PG_ASYNC_SEQ_WRAP
  if (toI32(pool.seatParse[seat]) === 1 && toI32(pool.inParsed[s]) === 0) {
    pool.prepared[s * PG_ASYNC_MAX_STATEMENTS + pool.seatStatement[seat]] = 0
  }
  pgAsyncSettle(pool, seat)
  if (pgAsyncReady(pool, s, -1)) {
    pgAsyncSignal(pool, s)
  }
  pgAsyncWakePool(pool)
}

/**
 * Whether the answer in turn on slot `s`, at `[inStart, inAnswer)`, leaves
 * the connection as it found it: only the frames a statement's answer has,
 * ending with a ReadyForQuery that is idle.
 */
const pgAsyncPlain = (pool: PgAsyncPool, s: i32): boolean => {
  const input: u8[] = pool.inputs[s]
  const stop: i32 = pool.inAnswer[s]
  let at: i32 = pool.inStart[s]
  while (at >= 0 && at + 5 < toI32(input.length) && at + 5 <= stop && stop <= toI32(input.length)) {
    const type: i32 = toI32(input[at])
    const next: i32 = at + 1 + getI32BE(input, at + 1)
    // Not reached: `pgAsyncScan` refused a length under 4 before this answer
    // could be read past. Kept so this walk does not rest on that.
    if (next < at + 5) {
      return false
    }
    if (type === 90) {
      return next === stop && next - at === 6 && toI32(input[at + 5]) === PG_ASYNC_IDLE
    }
    if (
      type !== 49 &&
      type !== 50 &&
      type !== 68 &&
      type !== 67 &&
      type !== 69 &&
      type !== 73 &&
      type !== 78 &&
      type !== 65
    ) {
      return false
    }
    at = next
  }
  return false
}

/**
 * Reads past one abandoned answer, on any connection where no task reads past
 * it yet, for a task waiting for room: the seats of a connection whose tasks
 * were all cancelled are otherwise never given back.
 * @returns Whether it read past one, or tried to.
 */
const pgAsyncSkipAny = async (pool: PgAsyncPool): Promise<boolean> => {
  for (let s: i32 = 0; s < pool.size; s++) {
    const seat: i32 = pgAsyncSkippable(pool, s)
    if (seat >= 0) {
      await pgAsyncSkip(pool, s, seat)
      return true
    }
  }
  return false
}

/**
 * Gives seat `seat` back; the connection closes once a lost one has no seat
 * left. Wakes the tasks waiting for room.
 */
const pgAsyncFree = (pool: PgAsyncPool, seat: i32): void => {
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  pool.seatUsed[seat] = 0
  pool.seatWaiting[seat] = 0
  pool.seatAbandoned[seat] = 0
  pool.seatClaims[seat] = (pool.seatClaims[seat] + 1) % PG_ASYNC_SEAT_WRAP
  pool.seated[s] -= 1
  if (pool.doomAt[s] >= 0 && pool.seated[s] === 0) {
    if (pool.fds[s] >= 0) {
      netClose(pool.fds[s])
      pool.fds[s] = -1
      pool.dropped += 1
    }
    pgAsyncForget(pool, s)
  }
  pgAsyncWakePool(pool)
}

/**
 * Whether the answer in turn on slot `s` lies whole in its input, from
 * `inStart`: `inAnswer` is set to where it ends, past its ReadyForQuery, or
 * to -1 for a frame length no answer has, which `pgAsyncAnswer` fails.
 */
const pgAsyncScan = (pool: PgAsyncPool, s: i32): boolean => {
  const input: u8[] = pool.inputs[s]
  const end: i32 = pool.inEnd[s]
  let at: i32 = pool.inStart[s]
  pool.inParsed[s] = 0
  while (end - at >= 5 && at >= 0 && at + 5 <= toI32(input.length)) {
    const length: i32 = getI32BE(input, at + 1)
    if (length < 4 || length > pool.maxMessage) {
      pool.inAnswer[s] = -1
      return true
    }
    if (end - at - 1 < length) {
      return false
    }
    const type: i32 = toI32(input[at])
    at += 1 + length
    if (type === 49) {
      pool.inParsed[s] = 1
    }
    if (type === 90) {
      pool.inAnswer[s] = at
      return true
    }
  }
  return false
}

/**
 * Waits for the seat's turn and reads its answer off the connection: the
 * statements seated before it are answered first, to their own tasks, and
 * what they read past their own answers begins this one. One read takes what
 * the socket holds, up to the pool's input, so the answers behind this one
 * often arrive with it. A lost connection (a socket error) fails this
 * statement and every one behind it. A task cancelled with its answer unread
 * fails alone: its seat is abandoned, and the next task to wait on the
 * connection reads past that answer, or loses the connection from it on when
 * the answer is not a plain one ending idle or is larger than the pool's
 * input. It writes only numbers into the pool, so a spawned task may call it;
 * `pgAsyncAnswer` then builds the answer in the task's memory.
 * @param pool The pool the ticket came from; a cap out of its range panics.
 * @param ticket The ticket `pgAsyncSeat` answered and `pgAsyncSend` used;
 *   any other panics.
 * @param sent What `pgAsyncSend` answered.
 * @returns What to hand `pgAsyncAnswer` and `pgAsyncDone`: 0 when the answer
 *   is there to read, else less than 0 for a statement that failed unanswered.
 */
export const pgAsyncTurn = async (pool: PgAsyncPool, ticket: i32, sent: i32): Promise<i32> => {
  pgAsyncCheckCaps(pool)
  const seat: i32 = pgAsyncSeatOf(pool, ticket)
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  const seq: i32 = pool.seatSeq[seat]
  if (sent === PG_ASYNC_UNSENT || sent === PG_ASYNC_UNSENT_CANCELLED) {
    // Nothing went out; `pgAsyncDone` hands its place in the order back
    // while `writing` keeps any other seat from being taken here.
    return sent
  }
  pool.writing[s] = 0
  pgAsyncWakePool(pool)
  if (sent < 0) {
    pgAsyncDoom(pool, s, seq)
    return sent <= PG_ASYNC_BROKEN ? sent : PG_ASYNC_BROKEN
  }
  pool.seatWaiting[seat] = 1
  let gaveUp: boolean = false
  let yields: i32 = 0
  while (pool.served[s] !== seq && !pgAsyncLostSeat(pool, seat)) {
    if (cancelled()) {
      gaveUp = true
      break
    }
    const ahead: i32 = pgAsyncSkippable(pool, s)
    if (ahead >= 0) {
      await pgAsyncSkip(pool, s, ahead)
    } else if (yields < PG_ASYNC_TURN_YIELDS) {
      // The answer ahead is usually read within a turn or two of the loop:
      // yielding costs no system call, where parking on the wake costs six.
      yields += 1
      await sleep(0)
    } else {
      pool.turnWaits += 1
      await pgAsyncPark(pool, s, -1)
      // The last of the waiters the byte woke reads it, as in the claim and
      // seat loops: a seat that waits again must not park on a byte nobody reads.
      pgAsyncDrain(pool, s)
    }
  }
  pool.seatWaiting[seat] = 0
  if (!pgAsyncReady(pool, s, seat)) {
    pgAsyncDrain(pool, s)
  }
  if (pgAsyncLostSeat(pool, seat)) {
    return PG_ASYNC_BROKEN + (cancelled() ? PG_ASYNC_CANCELLED : 0)
  }
  if (gaveUp) {
    // Its answer is on its way and this task will not read it: the next one does.
    pgAsyncAbandon(pool, seat)
    return PG_ASYNC_BROKEN + PG_ASYNC_CANCELLED
  }
  const fd: i32 = pool.fds[s]
  const input: u8[] = pool.inputs[s]
  while (!pgAsyncScan(pool, s)) {
    if (pool.inStart[s] > 0) {
      copyBytes(input, 0, input, pool.inStart[s], pool.inEnd[s] - pool.inStart[s])
      pool.inEnd[s] -= pool.inStart[s]
      pool.inStart[s] = 0
    }
    if (pool.inEnd[s] >= toI32(input.length)) {
      // Past the input: `pgAsyncAnswer` reads the rest of it alone.
      pool.inAnswer[s] = -1
      return 0
    }
    const got: i32 = netRead(fd, input, pool.inEnd[s], toI32(input.length) - pool.inEnd[s])
    if (got === PG_ASYNC_AGAIN) {
      const waited: boolean = await readable(fd)
      const failed: i32 = pgAsyncWaitFailure(waited)
      if (failed === PG_ASYNC_CANCELLED) {
        // The bytes read stay in the input for the task that reads past the rest.
        pgAsyncAbandon(pool, seat)
        return PG_ASYNC_BROKEN + failed
      }
      if (failed !== 0) {
        pgAsyncDoom(pool, s, seq)
        return PG_ASYNC_BROKEN + failed
      }
    } else if (got <= 0) {
      pgAsyncDoom(pool, s, seq)
      return PG_ASYNC_BROKEN + (got < 0 ? got : 0)
    } else {
      pool.inEnd[s] += got
    }
  }
  return 0
}

/**
 * Builds the seat's answer, in the calling task's memory, from what
 * `pgAsyncTurn` read, reading the rest of an answer past the pool's input
 * from the socket, never past its ReadyForQuery. A statement the server
 * refuses fails alone (each has its own Sync); one seated behind a refused
 * Parse fails with SQLSTATE `26000` and the next one parses again. A frame
 * this module does not expect or a cap past which it cannot be read fails it
 * with `reusable` false. It only reads the pool, so a spawned task may call
 * it.
 * @param pool The pool the ticket came from; a cap out of its range panics.
 * @param ticket The ticket `pgAsyncTurn` used; any other panics, as does a
 *   ticket whose turn has not come.
 * @param turn What `pgAsyncTurn` answered; one below 0 fails the answer
 *   without reading, with `PG_ERR_ENCODING` for a parameter that could not be
 *   sent and `PG_ERR_CLOSED` otherwise.
 * @returns The answer; its `reusable` goes to `pgAsyncDone`.
 */
export const pgAsyncAnswer = async (pool: PgAsyncPool, ticket: i32, turn: i32): Promise<PgAsyncResult> => {
  pgAsyncCheckCaps(pool)
  const seat: i32 = pgAsyncSeatOf(pool, ticket)
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  if (turn < 0) {
    const result = new PgAsyncResult()
    if (turn === PG_ASYNC_UNSENT || turn === PG_ASYNC_UNSENT_CANCELLED) {
      result.code = PG_CARRIER_FAILED
      result.failure = turn === PG_ASYNC_UNSENT ? PG_ERR_ENCODING : PG_ERR_CLOSED
      result.socketError = turn === PG_ASYNC_UNSENT ? 0 : PG_ASYNC_CANCELLED
      result.reusable = true
      return result
    }
    return pgAsyncLost(result, PG_ERR_CLOSED, turn <= PG_ASYNC_BROKEN ? turn - PG_ASYNC_BROKEN : 0)
  }
  if (pool.served[s] !== pool.seatSeq[seat] || pgAsyncLostSeat(pool, seat)) {
    panic("nish/net/postgres-async: an answer read before its turn")
  }
  // Copied into the task's memory: the spawn rules read an array of the pool
  // handed across an `await` as one the callee may grow.
  const input: u8[] = pool.inputs[s]
  const from: i32 = pool.inStart[s]
  const to: i32 = pool.inAnswer[s] >= 0 ? pool.inAnswer[s] : pool.inEnd[s]
  const carried: u8[] = new Array<u8>(
    from >= 0 && from <= to && to <= toI32(input.length) ? to - from : toI32(0)
  )
  copyBytes(carried, 0, input, from, toI32(carried.length))
  return await pgAsyncRead(
    pool.fds[s],
    carried,
    true,
    pool.maxMessage,
    pool.maxColumns,
    pool.maxRows,
    pool.maxResultBytes
  )
}

/**
 * Spends the seat's ticket once its answer is built: the connection moves
 * past the answer, the next seat in its order is served, and the tasks
 * waiting for room are woken. A Parse that failed is sent again by the next
 * seat that runs the statement; an answer that left the connection unfit
 * fails the seats behind it, and the connection closes once the last of them
 * is answered. It writes only numbers into the pool, so a spawned task may
 * call it.
 * @param pool The pool the ticket came from.
 * @param ticket The ticket `pgAsyncAnswer` used; it is spent here, and any
 *   other panics.
 * @param turn What `pgAsyncTurn` answered.
 * @param reusable The answer's `reusable`.
 */
export const pgAsyncDone = (pool: PgAsyncPool, ticket: i32, turn: i32, reusable: boolean): void => {
  const seat: i32 = pgAsyncSeatOf(pool, ticket)
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  const seq: i32 = pool.seatSeq[seat]
  const statement: i32 = s * PG_ASYNC_MAX_STATEMENTS + pool.seatStatement[seat]
  const abandoned: i32 = toI32(pool.seatAbandoned[seat])
  if (abandoned === 1) {
    // Its answer is not read past yet: the ticket is spent, the seat stays until it is.
    pool.seatAbandoned[seat] = 2
    pool.seatClaims[seat] = (pool.seatClaims[seat] + 1) % PG_ASYNC_SEAT_WRAP
    return
  }
  if (abandoned === 3) {
    pgAsyncFree(pool, seat)
    return
  }
  if (turn === PG_ASYNC_UNSENT || turn === PG_ASYNC_UNSENT_CANCELLED) {
    // No other seat was taken here while it was being written, so its place
    // in the order is handed back.
    pool.nextSeq[s] = seq
    if (toI32(pool.seatParse[seat]) === 1) {
      pool.prepared[statement] = 0
    }
    pool.writing[s] = 0
    pgAsyncFree(pool, seat)
    return
  }
  if (turn >= 0 && pool.served[s] === seq) {
    pool.inStart[s] = pool.inAnswer[s] >= 0 ? pool.inAnswer[s] : pool.inEnd[s]
    if (pool.inStart[s] === pool.inEnd[s]) {
      pool.inStart[s] = 0
      pool.inEnd[s] = 0
    }
    pool.served[s] = (seq + 1) % PG_ASYNC_SEQ_WRAP
    if (toI32(pool.seatParse[seat]) === 1 && toI32(pool.inParsed[s]) === 0) {
      pool.prepared[statement] = 0
    }
    if (!reusable) {
      // A lost frame, a transaction left open or a setting changed: the
      // statements behind this one would be read out of step, or run in a
      // session they did not ask for.
      pgAsyncDoom(pool, s, pool.served[s])
    }
    if (pgAsyncReady(pool, s, seat)) {
      pgAsyncSignal(pool, s)
    }
  }
  pgAsyncFree(pool, seat)
}

/**
 * Runs one statement on the ticket's connection: Parse, Bind (each parameter
 * in text), Execute and Sync go out in one write, and the answer is read to
 * its ReadyForQuery, waiting on the socket while other tasks run. It only
 * reads the pool; its buffers and the answer are the calling task's.
 * @param pool The pool the ticket came from; a cap out of its range panics.
 * @param ticket A ticket `pgAsyncClaim` answered and no `pgAsyncRelease` has
 *   spent; any other panics.
 * @param sql One statement, `$1`, `$2`, ... naming the parameters; a NUL in
 *   it fails the query with `PG_ERR_ENCODING` without sending anything.
 * @param params The parameters, as many as the statement names; a NUL in
 *   a text one fails the query the same way.
 * @returns The answer; its `reusable` goes to `pgAsyncRelease`.
 */
export const pgAsyncQuery = async (
  pool: PgAsyncPool,
  ticket: i32,
  sql: string,
  params: PgAsyncParams
): Promise<PgAsyncResult> => {
  pgAsyncCheckCaps(pool)
  const fd: i32 = pool.fds[pgAsyncSlot(pool, ticket)]
  const result = new PgAsyncResult()
  if (cancelled()) {
    // Nothing is sent, so the connection is still in step and is given back.
    result.code = PG_CARRIER_FAILED
    result.failure = PG_ERR_CLOSED
    result.socketError = PG_ASYNC_CANCELLED
    result.reusable = true
    return result
  }
  const sqlBytes = pgAsyncBytes(sql)
  const out: u8[] | null = sqlBytes === null ? null : pgAsyncEncode(sqlBytes, -1, true, params)
  if (out === null) {
    result.code = PG_CARRIER_FAILED
    result.failure = PG_ERR_ENCODING
    result.reusable = true
    return result
  }
  let sent: i32 = 0
  while (sent < toI32(out.length)) {
    const n: i32 = netWrite(fd, out, sent, toI32(out.length) - sent)
    if (n === PG_ASYNC_AGAIN) {
      const waited: boolean = await writable(fd)
      const failed: i32 = pgAsyncWaitFailure(waited)
      if (failed !== 0) {
        return pgAsyncLost(result, PG_ERR_CLOSED, failed)
      }
    } else if (n <= 0) {
      return pgAsyncLost(result, PG_ERR_CLOSED, n)
    } else {
      sent += n
    }
  }
  const none: u8[] = []
  return await pgAsyncRead(
    fd,
    none,
    false,
    pool.maxMessage,
    pool.maxColumns,
    pool.maxRows,
    pool.maxResultBytes
  )
}

/**
 * Panics on a cap that is a mistake in the program, as `PgConfig`'s are. The
 * bounds keep `row * columns` in `PgAsyncResult` from overflowing: the cells
 * kept are under `maxResultBytes / 16`, below 2^26.
 */
const pgAsyncCheckCaps = (pool: PgAsyncPool): void => {
  if (
    pool.maxMessage < 1024 ||
    pool.maxMessage > PG_ASYNC_MAX_CAP ||
    pool.maxColumns < 1 ||
    pool.maxColumns > 65535 ||
    pool.maxRows < 1 ||
    pool.maxRows > PG_ASYNC_MAX_ROWS ||
    pool.maxResultBytes < 1024 ||
    pool.maxResultBytes > PG_ASYNC_MAX_CAP
  ) {
    panic("nish/net/postgres-async: a PgAsyncPool cap out of range")
  }
}

/** `result` failed for `failure`, its socket error `socketError`, and its connection unfit to reuse. */
const pgAsyncLost = (result: PgAsyncResult, failure: i32, socketError: i32): PgAsyncResult => {
  result.code = PG_CARRIER_FAILED
  result.failure = failure
  result.socketError = socketError
  result.reusable = false
  return result
}

/**
 * Parse (when `parse`), Bind, Execute and Sync for the statement `sql` and
 * `params`, or null for a NUL in a parameter. `name` -1 is the unnamed
 * statement; 0 or more names it `n<name>`, which the connection keeps.
 */
const pgAsyncEncode = (sql: u8[], name: i32, parse: boolean, params: PgAsyncParams): u8[] | null => {
  const count: i32 = toI32(params.values.length)
  if (count > 65535) {
    return null
  }
  // The statement's name: none, or `n` and its decimal digits (at most 2).
  const label: u8[] = pgAsyncLabel(name)
  const named: i32 = toI32(label.length)
  const values: u8[][] = []
  // The length, "" portal, the statement's name and NUL, no parameter formats,
  // the count, no result formats: 4 + 1 + named + 1 + 2 + 2 + 2, held as an
  // i32 in either number mode.
  let bind: i32 = toI32(12) + named
  for (let i: i32 = 0; i < count; i++) {
    const v = pgAsyncBytes(params.values[i])
    if (v === null) {
      return null
    }
    values.push(v)
    bind += toI32(4)
    if (!params.nulls[i]) {
      bind += toI32(v.length)
    }
  }
  const sqlLength: i32 = toI32(sql.length)
  // The length, the statement's name and NUL, the SQL and its NUL, no parameter types.
  const parseLength: i32 = parse ? sqlLength + named + toI32(8) : 0
  // Parse, Bind, Execute ("" portal, no row limit: 4 + 1 + 4), Sync (4).
  const total: i32 = (parse ? toI32(1) + parseLength : toI32(0)) + toI32(16) + bind
  const out: u8[] = new Array<u8>(total)
  let at: i32 = 0
  if (parse) {
    out[at] = 80
    setI32BE(out, at + 1, parseLength)
    at += 5
    for (let i: i32 = 0; i < toI32(label.length); i++) {
      out[at + i] = label[i]
    }
    at += named
    out[at] = 0
    at += 1
    for (let i: i32 = 0; i < sqlLength && at + i < total; i++) {
      out[at + i] = sql[i]
    }
    at += sqlLength
    out[at] = 0
    out[at + 1] = 0
    out[at + 2] = 0
    at += 3
  }
  out[at] = 66
  setI32BE(out, at + 1, bind)
  at += 5
  // The unnamed portal, the statement's name, no parameter format codes (all text).
  out[at] = 0
  at += 1
  for (let i: i32 = 0; i < toI32(label.length); i++) {
    out[at + i] = label[i]
  }
  at += named
  out[at] = 0
  out[at + 1] = 0
  out[at + 2] = 0
  setU16BE(out, at + 3, toU16(count))
  at += 5
  // Bounded by `values` rather than `count`, which it equals, so the prover reads the index.
  const encoded: i32 = toI32(values.length)
  for (let i: i32 = 0; i < encoded; i++) {
    if (params.nulls[i]) {
      setI32BE(out, at, -1)
      at += 4
      continue
    }
    const v: u8[] = values[i]
    setI32BE(out, at, toI32(v.length))
    copyBytes(out, at + 4, v, 0, toI32(v.length))
    at += 4 + toI32(v.length)
  }
  // No result format codes: every column in text.
  out[at] = 0
  out[at + 1] = 0
  at += 2
  out[at] = 69
  setI32BE(out, at + 1, 9)
  out[at + 5] = 0
  setI32BE(out, at + 6, 0)
  at += 10
  out[at] = 83
  setI32BE(out, at + 1, 4)
  return out
}

/**
 * A prepared statement's name, `n` and the decimal digits of `name` (at most
 * 2), or none for a negative `name`.
 */
const pgAsyncLabel = (name: i32): u8[] => {
  if (name >= 10) {
    return [110, toU8(toI32(48) + toI32(name / 10)), toU8(toI32(48) + (name % 10))]
  }
  if (name >= 0) {
    return [110, toU8(toI32(48) + name)]
  }
  return []
}

/** `s`'s UTF-8 bytes, or null when one is zero, which a C string in the protocol cannot hold. */
const pgAsyncBytes = (s: string): u8[] | null => {
  const n: i32 = toI32(s.length)
  const b: u8[] = new Array<u8>(n)
  const room: i32 = toI32(b.length)
  // Bounded by each length it indexes, which are equal, so the prover reads both.
  for (let i: i32 = 0; i < n && i < room; i++) {
    const c: i32 = toI32(s.charCodeAt(i))
    if (c === 0) {
      return null
    }
    b[i] = toU8(c)
  }
  return b
}

/**
 * Reads the answer to one Parse, Bind, Execute and Sync from `fd`, through
 * its ReadyForQuery, under the caps, starting from `seed`, the part of it
 * already read. With `bounded` (a pipelined connection), no read passes the
 * answer's ReadyForQuery, so the next answer stays on the socket; without
 * it, input past the answer leaves the connection unfit to reuse. The result
 * is made here rather than handed in: the spawn rules read a callee that
 * grows an array it was handed across an `await` as one that may grow the
 * caller's pool.
 */
const pgAsyncRead = async (
  fd: i32,
  seed: u8[],
  bounded: boolean,
  maxMessage: i32,
  maxColumns: i32,
  maxRows: i32,
  maxResultBytes: i32
): Promise<PgAsyncResult> => {
  const result = new PgAsyncResult()
  // The buffer starts the size of the seed, not a zero-filled 8 KiB: an answer
  // already scanned whole is parsed without clearing memory it never reads, and
  // only a read past it grows the buffer.
  let buf: u8[] = new Array<u8>(toI32(seed.length))
  copyBytes(buf, 0, seed, 0, toI32(seed.length))
  let start: i32 = 0
  let end: i32 = toI32(seed.length)
  let refused: boolean = false
  let tooBig: boolean = false
  let changed: boolean = false
  let shaped: boolean = false
  // The bytes of rows, tags and error fields kept, under `maxResultBytes`.
  let kept: i32 = 0
  while (true) {
    // Every whole message in [start, end).
    while (end - start >= 5) {
      // Always true, since `end` never passes the buffer; it proves the reads below.
      if (start < 0 || start + 5 > toI32(buf.length)) {
        return pgAsyncLost(result, PG_ERR_FRAME, 0)
      }
      const type: i32 = toI32(buf[start])
      const length: i32 = getI32BE(buf, start + 1)
      if (length < 4) {
        return pgAsyncLost(result, PG_ERR_FRAME, 0)
      }
      if (length > maxMessage) {
        return pgAsyncLost(result, PG_ERR_TOO_BIG, 0)
      }
      if (end - start - 1 < length) {
        break
      }
      const body: i32 = start + 5
      const stop: i32 = start + 1 + length
      start = stop
      if (type === 90) {
        // 'Z': ReadyForQuery, the end of the answer.
        if (stop - body !== 1 || body < 0 || body >= toI32(buf.length)) {
          return pgAsyncLost(result, PG_ERR_FRAME, 0)
        }
        // Bytes after the ReadyForQuery answer no statement this one sent,
        // so the connection is out of step and closed rather than given
        // back. A pipelined read stops at the ReadyForQuery, so none are
        // read here unless the server sent them inside this answer.
        result.reusable = toI32(buf[body]) === PG_ASYNC_IDLE && !changed && start === end
        if (refused || tooBig) {
          result.code = PG_CARRIER_FAILED
          result.failure = tooBig ? PG_ERR_TOO_BIG : PG_ERR_NONE
        }
        return result
      }
      if (type === 68) {
        // 'D': DataRow, a count then each column's length (-1 for NULL) and bytes.
        if (stop - body < 2) {
          return pgAsyncLost(result, PG_ERR_FRAME, 0)
        }
        const columns: i32 = toI32(getU16BE(buf, body))
        if (columns > maxColumns) {
          return pgAsyncLost(result, PG_ERR_TOO_BIG, 0)
        }
        if (shaped && columns !== result.columns) {
          return pgAsyncLost(result, PG_ERR_FRAME, 0)
        }
        // The frame's length bounds its cells' bytes; each cell costs its string besides.
        const cost: i32 = stop - body + columns * PG_ASYNC_CELL_COST
        if (tooBig || result.rows >= maxRows || cost > maxResultBytes - kept) {
          tooBig = true
          continue
        }
        kept += cost
        if (!pgAsyncRow(buf, body + 2, stop, columns, result)) {
          return pgAsyncLost(result, PG_ERR_FRAME, 0)
        }
        result.columns = columns
        shaped = true
        result.rows += 1
        continue
      }
      if (type === 67) {
        // 'C': CommandComplete, a NUL-ended tag.
        if (stop - body < 1 || toI32(buf[stop - 1]) !== 0) {
          return pgAsyncLost(result, PG_ERR_FRAME, 0)
        }
        // A tag is kept, so it costs the budget too; past it, the answer fails.
        if (stop - body > maxResultBytes - kept) {
          tooBig = true
          continue
        }
        kept += stop - body
        result.tag = String.fromBytes(buf, body, stop - 1)
        continue
      }
      if (type === 69) {
        // 'E': ErrorResponse, fields of a code byte and a NUL-ended value.
        // Its kept fields cost the budget, bounded by the frame; past it, none is kept.
        refused = true
        if (stop - body > maxResultBytes - kept) {
          tooBig = true
          continue
        }
        kept += stop - body
        if (!pgAsyncError(buf, body, stop, result)) {
          return pgAsyncLost(result, PG_ERR_FRAME, 0)
        }
        continue
      }
      if (type === 83) {
        // 'S': a ParameterStatus after startup is a session setting a statement changed.
        changed = true
        continue
      }
      if (type === 49 || type === 50 || type === 73 || type === 78 || type === 65) {
        // ParseComplete, BindComplete, EmptyQueryResponse, a notice, a notification.
        continue
      }
      return pgAsyncLost(result, PG_ERR_UNEXPECTED, 0)
    }
    // Room for the rest of the message at `start`, then more input.
    if (start > 0) {
      copyBytes(buf, 0, buf, start, end - start)
      end -= start
      start = 0
    }
    if (end === toI32(buf.length)) {
      const twice: i32 = toI32(buf.length) < PG_ASYNC_INPUT_SIZE ? PG_ASYNC_INPUT_SIZE : toI32(buf.length) * 2
      const grown: u8[] = new Array<u8>(
        twice > maxMessage + 1 && end < maxMessage + 1 ? maxMessage + 1 : twice
      )
      copyBytes(grown, 0, buf, 0, end)
      buf = grown
    }
    const room: i32 = toI32(buf.length) - end
    let want: i32 = room
    if (bounded) {
      // The rest of the frame at `start`, and the next header unless it is the ReadyForQuery.
      want = toI32(5) - (end - start)
      if (end - start >= 5 && start >= 0 && start < toI32(buf.length)) {
        const length: i32 = getI32BE(buf, start + 1)
        want = toI32(1) + length - (end - start) + (toI32(buf[start]) === 90 ? toI32(0) : toI32(5))
      }
      if (want > room) {
        want = room
      } else if (want < 1) {
        want = 1
      }
    }
    const got: i32 = netRead(fd, buf, end, want)
    if (got === PG_ASYNC_AGAIN) {
      const waited: boolean = await readable(fd)
      const failed: i32 = pgAsyncWaitFailure(waited)
      if (failed !== 0) {
        return pgAsyncLost(result, PG_ERR_CLOSED, failed)
      }
    } else if (got <= 0) {
      return pgAsyncLost(result, PG_ERR_CLOSED, got)
    } else {
      end += got
    }
  }
}

/** One DataRow's `columns` cells in `[at, stop)` into `result`; false for a frame that does not add up. */
const pgAsyncRow = (buf: u8[], at: i32, stop: i32, columns: i32, result: PgAsyncResult): boolean => {
  let p: i32 = at
  for (let c: i32 = 0; c < columns; c++) {
    if (stop - p < 4 || p < 0 || p + 3 >= toI32(buf.length)) {
      return false
    }
    const n: i32 =
      (toI32(buf[p]) << 24) | (toI32(buf[p + 1]) << 16) | (toI32(buf[p + 2]) << 8) | toI32(buf[p + 3])
    p += 4
    if (n === -1) {
      result.values.push("")
      result.nulls.push(true)
      continue
    }
    if (n < 0 || n > stop - p) {
      return false
    }
    result.values.push(String.fromBytes(buf, p, p + n))
    result.nulls.push(false)
    p += n
  }
  return p === stop
}

/**
 * An ErrorResponse's SQLSTATE and message in `[at, stop)` into `result`; false
 * for a frame that does not add up.
 */
const pgAsyncError = (buf: u8[], at: i32, stop: i32, result: PgAsyncResult): boolean => {
  let p: i32 = at
  // `stop` never passes the buffer; each loop also tests `buf.length` so the prover reads the index.
  while (p >= 0 && p < stop && p < toI32(buf.length)) {
    const field: i32 = toI32(buf[p])
    if (field === 0) {
      return p === stop - 1
    }
    let e: i32 = p + 1
    while (e < stop && e < toI32(buf.length) && toI32(buf[e]) !== 0) {
      e += 1
    }
    if (e >= stop || e >= toI32(buf.length)) {
      return false
    }
    if (field === 67) {
      result.errorCode = String.fromBytes(buf, p + 1, e)
    } else if (field === 77) {
      result.errorMessage = String.fromBytes(buf, p + 1, e)
    }
    p = e + 1
  }
  return false
}
