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
 *     const title = async (pool: PgAsyncPool, id: i32): Promise<void> => {
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
 *     export const main = async (): Promise<i32> => {
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
import { getI32BE, getU16BE, tryCopyBytes } from "nish/bytes"
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
 * holds a NUL, its Bind would pass 2^30 bytes, or its `values` and `nulls`
 * differ in length; `pgAsyncAnswer` fails it with `PG_ERR_ENCODING`, and the connection is reused.
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
// the queue's head moving wakes it and few others. A seat waiting for its
// turn waits the same way on a turn lane, the one its seat index picks.
const PG_ASYNC_LANES: i32 = 128
// The wake the tasks waiting for a slot, or for a seat outside the queue,
// wait on: after the turn lanes and before the queue lanes.
const PG_ASYNC_POOL_WAKE: i32 = PG_ASYNC_LANES
const PG_ASYNC_WAKES: i32 = PG_ASYNC_LANES * 2 + 1
// What a query reads first; it grows by doubling up to one `maxMessage`.
const PG_ASYNC_INPUT_SIZE: i32 = 8192
// Loop turns a seat yields for its turn before it parks on its turn lane.
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
// Every wrap above is a power of two, so a count steps with a mask one below it.
const PG_ASYNC_CLAIM_MASK: i32 = PG_ASYNC_CLAIM_WRAP - 1
const PG_ASYNC_SEAT_MASK: i32 = PG_ASYNC_SEAT_WRAP - 1
const PG_ASYNC_SEQ_MASK: i32 = PG_ASYNC_SEQ_WRAP - 1
const PG_ASYNC_QUEUE_MASK: i32 = PG_ASYNC_QUEUE_WRAP - 1

/**
 * `n` plus one, wrapped below `mask` plus one, a power of two: `(n + 1) %
 * wrap` for `n` below that wrap. A count at or past the mask, or below 0,
 * which no step makes, starts again at 0.
 */
const pgAsyncStep = (n: i32, mask: i32): i32 => (n >= 0 && n < mask ? n + 1 : 0)

/**
 * How far `from` is behind `to`, two counts that wrap below `mask` plus one,
 * a power of two: `(to - from + wrap) % wrap` for counts below the wrap. Both
 * are at least 0, so their difference is exact before the mask takes it; a
 * negative count, which no step makes, is no distance.
 */
const pgAsyncGap = (to: i32, from: i32, mask: i32): i32 => {
  if (to < 0 || from < 0) {
    return 0
  }
  return (to - from) & mask
}

/**
 * Where wake `w`'s socket pair starts in `wakes`, `2w`: -1 for a wake below 0
 * or at 2^30 or past it, which every caller checks against `wakes` before it
 * reads.
 */
const pgAsyncPair = (w: i32): i32 => (w >= 0 && w < 1073741824 ? w * 2 : -1)

/** `n` plus one, held at the `i32` ceiling: a statistic that counts on, never back. */
const pgAsyncCount = (n: i32): i32 => (n < 2147483647 ? n + 1 : n)

/**
 * `n` less 1, but not below 0: a waiter count is above 0 when a task takes
 * itself off it, and a ring's unseen count only ever compares with 0.
 */
const pgAsyncUncount = (n: i32): i32 => (n > 0 ? n - 1 : 0)

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
  /**
   * How many times `pgAsyncClaim` or `pgAsyncSeat` waited because no live
   * connection had room, held at 2^31 - 1 rather than wrapping.
   */
  waits: i32 = 0
  /**
   * How many times `pgAsyncTurn` waited for the answers seated ahead of its
   * own, held at 2^31 - 1 rather than wrapping.
   */
  turnWaits: i32 = 0
  /**
   * How many connections were closed rather than given back: by
   * `pgAsyncRelease`, or once a lost pipeline emptied. It is held at
   * 2^31 - 1 rather than wrapping.
   */
  dropped: i32 = 0
  /**
   * The most milliseconds `pgAsyncConnect` gives one connection to connect
   * and finish its startup before it closes it and moves on; 0 or less waits
   * for as long as the server takes.
   */
  connectWaitMs: i32 = 10000
  /** How many connections `pgAsyncConnect` made, in all, held at 2^31 - 1 rather than wrapping. */
  connects: i32 = 0
  /**
   * The queue number of the first task still waiting for a seat. Of the
   * tasks waiting, in the order they began to wait, the first as many as
   * there are free seats may each take one, and a task that has not waited
   * takes none while any is queued.
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
   * Per turn lane, then one for the pool, then one per queue lane: a socket pair
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
   * wake: one per turn lane, one for the pool and one per queue lane. Each opens
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
    // As `u16`s the lengths need no check: the size is 1 to 64 here, so the
    // most any of them holds is 64 seats of 64 statements.
    const slots: u16 = toU16(size)
    const statements: u16 = slots * toU16(PG_ASYNC_MAX_STATEMENTS)
    const seats: u16 = slots * toU16(PG_ASYNC_MAX_DEPTH)
    const wakes: u16 = toU16(PG_ASYNC_WAKES)
    this.fds = new Array<i32>(slots)
    this.claimed = new Array<u8>(slots)
    this.claims = new Array<i32>(slots)
    this.statements = []
    this.prepared = new Array<u8>(statements)
    this.inputs = []
    this.inStart = new Array<i32>(slots)
    this.inEnd = new Array<i32>(slots)
    this.inAnswer = new Array<i32>(slots)
    this.inParsed = new Array<u8>(slots)
    this.nextSeq = new Array<i32>(slots)
    this.served = new Array<i32>(slots)
    this.doomAt = new Array<i32>(slots)
    this.seated = new Array<i32>(slots)
    this.writing = new Array<u8>(slots)
    this.seatUsed = new Array<u8>(seats)
    this.seatSeq = new Array<i32>(seats)
    this.seatStatement = new Array<i32>(seats)
    this.seatParse = new Array<u8>(seats)
    this.seatWaiting = new Array<u8>(seats)
    this.seatClaims = new Array<i32>(seats)
    this.seatAbandoned = new Array<u8>(seats)
    this.skipping = new Array<u8>(slots)
    this.wakes = new Array<i32>(wakes * toU16(2))
    this.wakePending = new Array<u8>(wakes)
    this.wakeBytes = new Array<u8>(8)
    this.wakePair = new Array<i32>(2)
    this.waiters = new Array<i32>(wakes)
    this.wakeRings = new Array<i32>(wakes)
    this.wakeUnseen = new Array<i32>(wakes)
    this.seatGone = new Array<u8>(PG_ASYNC_QUEUE)
    for (let s: i32 = 0; s < toI32(this.fds.length) && s < toI32(this.doomAt.length); s++) {
      this.fds[s] = -1
      this.doomAt[s] = -1
      this.inputs.push(new Array<u8>(PG_ASYNC_INPUT_SIZE))
    }
    for (let w: i32 = 0; w < toI32(this.wakes.length); w++) {
      this.wakes[w] = -1
    }
  }

  /**
   * The number of slots connected now, claimed or not.
   * @returns The count, 0 to `size`.
   */
  live(): i32 {
    // A `u32` count wraps rather than checks: it never passes `size`.
    let n: u32 = 0
    for (let s: i32 = 0; s < toI32(this.fds.length); s++) {
      if (this.fds[s] >= 0) {
        n += 1
      }
    }
    return toI32(n)
  }

  /**
   * Ends every connection: a Terminate is offered to each socket, which is
   * then closed, claimed or not, and closes the wakes. Call it once the tasks
   * that hold tickets are done; a ticket used afterwards panics.
   */
  close(): void {
    const terminate: u8[] = [88, 0, 0, 0, 4]
    for (
      let s: i32 = 0;
      s < toI32(this.fds.length) && s < toI32(this.claimed.length) && s < toI32(this.claims.length);
      s++
    ) {
      // The slot is marked closed before the calls, which the bounds above do not outlive.
      const fd: i32 = this.fds[s]
      this.fds[s] = -1
      this.claimed[s] = 0
      this.claims[s] = pgAsyncStep(this.claims[s], PG_ASYNC_CLAIM_MASK)
      if (fd >= 0) {
        netWrite(fd, terminate, 0, toI32(terminate.length))
        netClose(fd)
      }
      pgAsyncForget(this, s)
    }
    // Every slot's seats, which lie one after another.
    for (
      let seat: i32 = 0;
      seat < toI32(this.seatUsed.length) &&
      seat < toI32(this.seatWaiting.length) &&
      seat < toI32(this.seatAbandoned.length) &&
      seat < toI32(this.seatClaims.length);
      seat++
    ) {
      this.seatUsed[seat] = 0
      this.seatWaiting[seat] = 0
      this.seatAbandoned[seat] = 0
      this.seatClaims[seat] = pgAsyncStep(this.seatClaims[seat], PG_ASYNC_SEAT_MASK)
    }
    for (let w: i32 = 0; w < toI32(this.wakes.length); w++) {
      const fd: i32 = this.wakes[w]
      this.wakes[w] = -1
      if (fd >= 0) {
        netClose(fd)
      }
    }
  }
}

/** Resets slot `s`'s pipeline: nothing in flight, nothing prepared, nothing buffered. */
const pgAsyncForget = (pool: PgAsyncPool, s: i32): void => {
  // 64 is PG_ASYNC_MAX_SIZE, written as a literal: the prover takes a bound
  // from a literal but not from a module constant, and the bound proves the
  // `prepared` offsets below cannot overflow.
  if (s < 0 || s >= 64) {
    return
  }
  if (
    s >= toI32(pool.nextSeq.length) ||
    s >= toI32(pool.served.length) ||
    s >= toI32(pool.doomAt.length) ||
    s >= toI32(pool.seated.length) ||
    s >= toI32(pool.writing.length) ||
    s >= toI32(pool.inStart.length) ||
    s >= toI32(pool.inEnd.length) ||
    s >= toI32(pool.inAnswer.length) ||
    s >= toI32(pool.inParsed.length) ||
    s >= toI32(pool.skipping.length)
  ) {
    // No such slot: nothing to reset.
    return
  }
  const first: i32 = s * PG_ASYNC_MAX_STATEMENTS
  // 64 is PG_ASYNC_MAX_STATEMENTS, a literal for the same reason.
  for (let q: i32 = 0; q < 64; q++) {
    const at: i32 = first + q
    if (at < toI32(pool.prepared.length)) {
      pool.prepared[at] = 0
    }
  }
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
    const at: i32 = this.cell(row, column)
    if (at < 0 || at >= toI32(this.values.length)) {
      panic("nish/net/postgres-async: a cell out of range")
    }
    return this.values[at]
  }

  /**
   * Whether a cell is NULL; panics on a row or column out of range.
   * @param row The row, from 0.
   * @param column The column, from 0.
   * @returns True for a NULL.
   */
  isNull(row: i32, column: i32): boolean {
    const at: i32 = this.cell(row, column)
    if (at < 0 || at >= toI32(this.nulls.length)) {
      panic("nish/net/postgres-async: a cell out of range")
    }
    return this.nulls[at]
  }

  /**
   * A cell read as a decimal `i32`, or `fallback` when it is NULL or not one;
   * panics on a row or column out of range.
   * @param row The row, from 0.
   * @param column The column, from 0.
   * @param fallback The answer for a NULL or a cell that is not a decimal `i32`.
   * @returns The number.
   */
  int(row: i32, column: i32, fallback: i32): i32 {
    if (this.isNull(row, column)) {
      return fallback
    }
    return pgAsyncDecimal(this.text(row, column), fallback)
  }

  /**
   * The index into `values` of a cell, or -1 for a row or column out of
   * range; the caller panics on -1, as its contract says.
   */
  private cell(row: i32, column: i32): i32 {
    if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) {
      return -1
    }
    // In `i64` the sum cannot overflow; past the cells kept it is out of range too.
    const at: i64 = toI64(row) * toI64(this.columns) + toI64(column)
    return at < toI64(this.values.length) ? toI32(at) : -1
  }
}

/** `s` as a decimal `i32`, or `fallback` when it is not one. */
const pgAsyncDecimal = (s: string, fallback: i32): i32 => {
  const n: i32 = toI32(s.length)
  if (n < 1 || n > 11) {
    return fallback
  }
  let negative: boolean = false
  // At most 11 digits fit a `u64` with room to spare, and `u64` arithmetic
  // wraps rather than checks, so the sum needs no overflow test.
  let v: u64 = 0
  for (let at: i32 = 0; at < n; at++) {
    const c: i32 = toI32(s.charCodeAt(at))
    if (at === 0 && c === 45) {
      negative = true
    } else if (c < 48 || c > 57) {
      return fallback
    } else {
      v = v * toU64(10) + toU64(c - 48)
    }
  }
  const w: i64 = toI64(v)
  if (w < 0 || w > 2147483648) {
    return fallback
  }
  if (negative && n === 1) {
    return fallback
  }
  if (negative) {
    return toI32(-w)
  }
  return w > toI64(2147483647) ? fallback : toI32(w)
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
    slot >= toI32(pool.claimed.length) ||
    slot >= toI32(pool.claims.length) ||
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
  for (let s: i32 = 0; s < toI32(pool.fds.length); s++) {
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
    // The handshake awaited, so the slot is checked against the arrays again.
    if (made && s < toI32(pool.fds.length) && s < toI32(pool.claimed.length)) {
      pool.fds[s] = fd
      pool.claimed[s] = 0
      pool.connects = pgAsyncCount(pool.connects)
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
    while (true) {
      const start: i32 = conn.outputStart()
      const end: i32 = conn.outputEnd()
      if (start < 0 || end <= start) {
        break
      }
      // Both are at least 0 and `end` is past `start`, so the difference is exact.
      const n: i32 = netWrite(fd, conn.outputBuffer(), start, end - start)
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
    const since: i32 = pgAsyncSince(began)
    if (since < 0 || since >= waitMs) {
      return false
    }
    const left: i32 = waitMs - since
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
  // A clock read after `began` is never behind it; a reading that is, or a
  // negative one, counts as no time.
  const now: i64 = monotonicNanos()
  const ms: i64 = began >= 0 && now >= 0 && now >= began ? (now - began) / toI64(1000000) : toI64(0)
  return ms > toI64(1073741823) ? 1073741823 : toI32(ms)
}

/**
 * Wakes the tasks waiting on wake `w` (a turn lane, the pool's or a queue lane):
 * one byte on its socket pair, unless one is already there or none waits.
 * The byte stays until every task then waiting has woken: the runtime reports
 * at most 64 ready sockets a turn, and a byte read back by the first of
 * many would leave the rest waiting until their time ran out.
 */
const pgAsyncSignal = (pool: PgAsyncPool, w: i32): void => {
  if (w < 0 || w >= toI32(pool.waiters.length) || w >= toI32(pool.wakePending.length)) {
    // No such wake: nobody waits on it.
    return
  }
  // A wake's pair is `wakes[2w]` (read end) and `wakes[2w + 1]` (write end).
  const start: i32 = pgAsyncPair(w)
  if (start < 0 || start >= toI32(pool.wakes.length)) {
    return
  }
  const end: i32 = start + 1
  if (end >= toI32(pool.wakes.length) || toI32(pool.wakeBytes.length) < 1) {
    return
  }
  const fd: i32 = pool.wakes[end]
  if (pool.waiters[w] <= 0 || fd < 0) {
    return
  }
  if (toI32(pool.wakePending[w]) === 0) {
    pool.wakeBytes[0] = 1
    if (netWrite(fd, pool.wakeBytes, 0, 1) !== 1) {
      return
    }
  }
  // The write was a call, so the wake is checked against the arrays again.
  if (
    w >= toI32(pool.waiters.length) ||
    w >= toI32(pool.wakePending.length) ||
    w >= toI32(pool.wakeUnseen.length) ||
    w >= toI32(pool.wakeRings.length)
  ) {
    return
  }
  pool.wakePending[w] = 1
  // Rung again while its byte is there, the byte now stays for every task
  // waiting at this ring too: one that waited again after the last ring would
  // otherwise see the byte read back before it was polled, and wait for ever.
  pool.wakeUnseen[w] = pool.waiters[w]
  pool.wakeRings[w] = pgAsyncStep(pool.wakeRings[w], PG_ASYNC_QUEUE_MASK)
}

/**
 * The seats a task could take now: on each live connection no task claimed
 * whole, none doomed and none mid-write, `depth` less those in flight. A
 * connection mid-write is left out because a task woken for it would only
 * wait again; the write's end wakes the pool once more.
 */
const pgAsyncFreeSeats = (pool: PgAsyncPool): i32 => {
  let free: i32 = 0
  for (
    let s: i32 = 0;
    s < toI32(pool.fds.length) &&
    s < toI32(pool.claimed.length) &&
    s < toI32(pool.doomAt.length) &&
    s < toI32(pool.writing.length) &&
    s < toI32(pool.seated.length);
    s++
  ) {
    if (
      pool.fds[s] >= 0 &&
      toI32(pool.claimed[s]) === 0 &&
      pool.doomAt[s] < 0 &&
      toI32(pool.writing[s]) === 0 &&
      pool.seated[s] < pool.depth
    ) {
      // In `i64` the sum cannot overflow; it never passes 64 slots of 16 seats.
      const next: i64 = toI64(free) + toI64(pool.depth) - toI64(pool.seated[s])
      free = next > toI64(2147483647) ? 2147483647 : toI32(next)
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
  pgAsyncSignal(pool, PG_ASYNC_POOL_WAKE)
  const queued: i32 = pgAsyncGap(pool.seatTail, pool.seatHead, PG_ASYNC_QUEUE_MASK)
  if (queued === 0) {
    return
  }
  const free: i32 = pgAsyncFreeSeats(pool)
  let wake: i32 = free < 1 ? 1 : free
  wake = wake > queued ? queued : wake
  wake = wake > PG_ASYNC_LANES ? PG_ASYNC_LANES : wake
  for (let k: i32 = 0; k < wake; k++) {
    // The queue lane of the `k`th task waiting, after the pool's own wake.
    const lane: i32 =
      ((pool.seatHead & (PG_ASYNC_LANES - 1)) + (k & (PG_ASYNC_LANES - 1))) & (PG_ASYNC_LANES - 1)
    pgAsyncSignal(pool, PG_ASYNC_POOL_WAKE + 1 + lane)
  }
}

/** Reads wake `w`'s byte back once every task it was written for has woken, so its waiters wait again. */
const pgAsyncDrain = (pool: PgAsyncPool, w: i32): void => {
  if (w < 0 || w >= toI32(pool.wakeUnseen.length) || w >= toI32(pool.wakePending.length)) {
    // No such wake: no byte to read back.
    return
  }
  const start: i32 = pgAsyncPair(w)
  if (start < 0 || start >= toI32(pool.wakes.length)) {
    return
  }
  const fd: i32 = pool.wakes[start]
  if (toI32(pool.wakePending[w]) === 1 && pool.wakeUnseen[w] <= 0 && fd >= 0) {
    pool.wakePending[w] = 0
    netRead(fd, pool.wakeBytes, 0, 8)
  }
}

/**
 * Waits on wake `w` for up to `ms` milliseconds (no limit when negative),
 * opening its socket pair the first time, or 1 ms when no pair can be opened.
 * A cancelled task returns at once.
 */
const pgAsyncPark = async (pool: PgAsyncPool, w: i32, ms: i32): Promise<void> => {
  const start: i32 = pgAsyncPair(w)
  if (
    w < 0 ||
    start < 0 ||
    start >= toI32(pool.wakes.length) ||
    w >= toI32(pool.waiters.length) ||
    w >= toI32(pool.wakeRings.length)
  ) {
    // No such wake: wait as a task with no pair does, then look again.
    await sleep(1)
    return
  }
  const end: i32 = start + 1
  if (pool.wakes[start] < 0 && end < toI32(pool.wakes.length) && toI32(pool.wakePair.length) >= 2) {
    if (unixSocketPair(NET_UNIX_STREAM, pool.wakePair) >= 0) {
      // Opened before this task counts as waiting, so no byte is written to a
      // wake without a pair. Out of descriptors, it sleeps 1 ms and tries again.
      if (
        start < toI32(pool.wakes.length) &&
        end < toI32(pool.wakes.length) &&
        toI32(pool.wakePair.length) >= 2
      ) {
        pool.wakes[start] = pool.wakePair[0]
        pool.wakes[end] = pool.wakePair[1]
      }
    }
  }
  if (
    start >= toI32(pool.wakes.length) ||
    w >= toI32(pool.waiters.length) ||
    w >= toI32(pool.wakeRings.length)
  ) {
    return
  }
  const fd: i32 = pool.wakes[start]
  const rings: i32 = pool.wakeRings[w]
  pool.waiters[w] = pgAsyncCount(pool.waiters[w])
  if (fd < 0) {
    await sleep(1)
  } else {
    await readableWithin(fd, ms)
  }
  // The wait was a call, so the wake is checked against the arrays again.
  if (
    w >= toI32(pool.waiters.length) ||
    w >= toI32(pool.wakeRings.length) ||
    w >= toI32(pool.wakeUnseen.length)
  ) {
    return
  }
  pool.waiters[w] = pgAsyncUncount(pool.waiters[w])
  if (pool.wakeRings[w] !== rings) {
    // Waiting when the byte was written: one fewer it waits for.
    pool.wakeUnseen[w] = pgAsyncUncount(pool.wakeUnseen[w])
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
    for (
      let s: i32 = 0;
      s < toI32(pool.fds.length) &&
      s < toI32(pool.claimed.length) &&
      s < toI32(pool.claims.length) &&
      s < toI32(pool.seated.length) &&
      s < toI32(pool.doomAt.length);
      s++
    ) {
      if (pool.fds[s] < 0) {
        continue
      }
      live = true
      if (toI32(pool.claimed[s]) === 0 && pool.seated[s] === 0 && pool.doomAt[s] < 0) {
        // The claim count wraps below 2^24, so the ticket, the count times 64
        // slots plus the slot, is below 2^30.
        const claim: i32 = pgAsyncStep(pool.claims[s], PG_ASYNC_CLAIM_MASK) & PG_ASYNC_CLAIM_MASK
        pool.claimed[s] = 1
        pool.claims[s] = claim
        if (waited) {
          // Another waiter may find room this one did not take.
          pgAsyncWakePool(pool)
        }
        return claim * PG_ASYNC_MAX_SIZE + (s & (PG_ASYNC_MAX_SIZE - 1))
      }
    }
    if (!live) {
      return PG_POOL_NONE
    }
    const limit: i32 = pool.claimWaitMs
    const since: i32 = pgAsyncSince(began)
    if (limit <= 0 || since < 0 || since >= limit) {
      return PG_CARRIER_FULL
    }
    const left: i32 = limit - since
    const skipped: boolean = await pgAsyncSkipAny(pool)
    if (skipped) {
      continue
    }
    pool.waits = pgAsyncCount(pool.waits)
    waited = true
    await pgAsyncPark(pool, PG_ASYNC_POOL_WAKE, left)
    pgAsyncDrain(pool, PG_ASYNC_POOL_WAKE)
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
  if (
    slot < 0 ||
    slot >= toI32(pool.fds.length) ||
    slot >= toI32(pool.claimed.length) ||
    slot >= toI32(pool.claims.length)
  ) {
    // `pgAsyncSlot` panicked already on a ticket with no slot.
    return
  }
  const fd: i32 = pool.fds[slot]
  pool.claimed[slot] = 0
  pool.claims[slot] = pgAsyncStep(pool.claims[slot], PG_ASYNC_CLAIM_MASK)
  if (!reusable) {
    pool.fds[slot] = -1
    pool.dropped = pgAsyncCount(pool.dropped)
    netClose(fd)
    pgAsyncForget(pool, slot)
  }
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
    const at: i32 = n % PG_ASYNC_QUEUE
    if (at >= 0 && at < toI32(pool.seatGone.length)) {
      pool.seatGone[at] = 1
    }
    return
  }
  pool.seatHead = pgAsyncStep(pool.seatHead, PG_ASYNC_QUEUE_MASK)
  while (pool.seatHead !== pool.seatTail) {
    const at: i32 = pool.seatHead % PG_ASYNC_QUEUE
    if (at < 0 || at >= toI32(pool.seatGone.length) || toI32(pool.seatGone[at]) === 0) {
      break
    }
    pool.seatGone[at] = 0
    pool.seatHead = pgAsyncStep(pool.seatHead, PG_ASYNC_QUEUE_MASK)
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
    let bestSeated: i32 = 0
    let free: i32 = 0
    for (
      let s: i32 = 0;
      s < toI32(pool.fds.length) &&
      s < toI32(pool.claimed.length) &&
      s < toI32(pool.doomAt.length) &&
      s < toI32(pool.seated.length) &&
      s < toI32(pool.writing.length);
      s++
    ) {
      if (pool.fds[s] < 0) {
        continue
      }
      live = true
      const seated: i32 = pool.seated[s]
      if (toI32(pool.claimed[s]) !== 0 || pool.doomAt[s] >= 0 || seated >= pool.depth) {
        continue
      }
      // In `i64` the sum cannot overflow; it never passes 64 slots of 16 seats.
      const next: i64 = toI64(free) + toI64(pool.depth) - toI64(seated)
      free = next > toI64(2147483647) ? 2147483647 : toI32(next)
      if (toI32(pool.writing[s]) !== 0) {
        continue
      }
      if (best < 0 || seated < bestSeated) {
        best = s
        bestSeated = seated
      }
    }
    // First come, first seated: under load a task that lost the seat it was
    // woken for to another would wait on until `claimWaitMs` failed it. Of
    // the queue, the first as many as there are free seats may take one, so
    // seats freed together go in one loop turn; a task outside the queue
    // takes one only while none waits.
    const turn: boolean =
      queued >= 0
        ? pgAsyncGap(queued, pool.seatHead, PG_ASYNC_QUEUE_MASK) < free
        : pool.seatHead === pool.seatTail
    if (best >= 0 && turn) {
      // `best` is below 64 and `statement` below 64, so the offset is exact;
      // it is then checked against its array.
      const known: i32 =
        (best & (PG_ASYNC_MAX_SIZE - 1)) * PG_ASYNC_MAX_STATEMENTS +
        (statement & (PG_ASYNC_MAX_STATEMENTS - 1))
      for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
        const seat: i32 = pgAsyncSeatAt(best, k)
        if (
          seat < 0 ||
          seat >= toI32(pool.seatUsed.length) ||
          seat >= toI32(pool.seatWaiting.length) ||
          seat >= toI32(pool.seatSeq.length) ||
          seat >= toI32(pool.seatStatement.length) ||
          seat >= toI32(pool.seatParse.length) ||
          seat >= toI32(pool.seatClaims.length) ||
          known < 0 ||
          known >= toI32(pool.prepared.length) ||
          best >= toI32(pool.nextSeq.length) ||
          best >= toI32(pool.seated.length) ||
          best >= toI32(pool.writing.length)
        ) {
          // Past the slot's seats: none free on it.
          break
        }
        if (toI32(pool.seatUsed[seat]) !== 0) {
          continue
        }
        // The seat claim count wraps below 2^20, so the ticket, the count
        // times 1024 seats plus the seat, is below 2^30.
        const claim: i32 = pgAsyncStep(pool.seatClaims[seat], PG_ASYNC_SEAT_MASK) & PG_ASYNC_SEAT_MASK
        pool.seatUsed[seat] = 1
        pool.seatWaiting[seat] = 0
        pool.seatSeq[seat] = pool.nextSeq[best]
        pool.seatStatement[seat] = statement
        pool.seatParse[seat] = toI32(pool.prepared[known]) === 0 ? 1 : 0
        pool.prepared[known] = 1
        pool.nextSeq[best] = pgAsyncStep(pool.nextSeq[best], PG_ASYNC_SEQ_MASK)
        pool.seated[best] = pgAsyncCount(pool.seated[best])
        pool.writing[best] = 1
        pool.seatClaims[seat] = claim
        // The next in the queue may find a seat this one did not take.
        pgAsyncUnqueue(pool, queued)
        return claim * PG_ASYNC_SEATS + (seat & (PG_ASYNC_SEATS - 1))
      }
    }
    if (!live) {
      pgAsyncUnqueue(pool, queued)
      return PG_POOL_NONE
    }
    const limit: i32 = pool.claimWaitMs
    const since: i32 = pgAsyncSince(began)
    if (limit <= 0 || since < 0 || since >= limit) {
      pgAsyncUnqueue(pool, queued)
      return PG_CARRIER_FULL
    }
    const left: i32 = limit - since
    if (queued < 0 && pgAsyncGap(pool.seatTail, pool.seatHead, PG_ASYNC_QUEUE_MASK) < PG_ASYNC_QUEUE) {
      queued = pool.seatTail
      pool.seatTail = pgAsyncStep(pool.seatTail, PG_ASYNC_QUEUE_MASK)
    }
    const skipped: boolean = await pgAsyncSkipAny(pool)
    if (skipped) {
      continue
    }
    // A queued task waits on its queue lane, after the pool's own wake.
    const w: i32 = queued >= 0 ? PG_ASYNC_POOL_WAKE + 1 + (queued & (PG_ASYNC_LANES - 1)) : PG_ASYNC_POOL_WAKE
    pool.waits = pgAsyncCount(pool.waits)
    await pgAsyncPark(pool, w, left)
    pgAsyncDrain(pool, w)
  }
}

/** `ticket`'s seat, after checking it is the seat's current claim; panics otherwise. */
const pgAsyncSeatOf = (pool: PgAsyncPool, ticket: i32): i32 => {
  const seat: i32 = ticket >= 0 ? ticket % PG_ASYNC_SEATS : -1
  if (
    seat < 0 ||
    seat >= toI32(pool.seatUsed.length) ||
    seat >= toI32(pool.seatClaims.length) ||
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
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  if (
    seat < 0 ||
    seat >= toI32(pool.seatStatement.length) ||
    seat >= toI32(pool.seatParse.length) ||
    s < 0 ||
    s >= toI32(pool.fds.length)
  ) {
    // `pgAsyncSeatOf` panicked already on a ticket with no seat.
    return PG_ASYNC_UNSENT
  }
  const statement: i32 = pool.seatStatement[seat]
  if (statement < 0 || statement >= toI32(pool.statements.length)) {
    // `pgAsyncSeat` seats only a registered statement.
    return PG_ASYNC_UNSENT
  }
  const fd: i32 = pool.fds[s]
  const out: u8[] | null = pgAsyncEncode(
    pool.statements[statement],
    statement,
    toI32(pool.seatParse[seat]) === 1,
    params
  )
  if (out === null) {
    return PG_ASYNC_UNSENT
  }
  let sent: i32 = 0
  while (sent >= 0 && sent < toI32(out.length)) {
    // Both are at least 0 and `sent` is short of the end, so the difference is exact.
    const total: i32 = toI32(out.length)
    let rest: i32 = 0
    if (sent >= 0 && total >= 0) {
      rest = total - sent
    }
    const n: i32 = netWrite(fd, out, sent, rest)
    if (n === PG_ASYNC_AGAIN) {
      const waited: boolean = await writable(fd)
      const failed: i32 = pgAsyncWaitFailure(waited)
      if (failed === PG_ASYNC_CANCELLED && sent === 0) {
        return PG_ASYNC_UNSENT_CANCELLED
      }
      if (failed !== 0) {
        return pgAsyncBroken(failed)
      }
    } else if (n <= 0) {
      return n < PG_ASYNC_BROKEN ? pgAsyncBroken(n) : PG_ASYNC_BROKEN
    } else {
      // A write takes no more than it was given, so `sent` stays within `out`.
      const next: i64 = toI64(sent) + toI64(n)
      sent = next > toI64(out.length) ? toI32(out.length) : toI32(next)
    }
  }
  return sent
}

/**
 * What `pgAsyncSend` answers for a broken write: `PG_ASYNC_BROKEN` beside
 * the failure `e` (0 or below), so it stays below -15, and no lower than
 * the least `i32`.
 */
const pgAsyncBroken = (e: i32): i32 => {
  const sum: i64 = toI64(PG_ASYNC_BROKEN) + toI64(e)
  return sum < toI64(-2147483648) ? -2147483648 : toI32(sum)
}

/**
 * How far `seq` is past `served`, a slot's next answer, in the order of its
 * pipeline: both wrap below `PG_ASYNC_SEQ_WRAP`.
 */
const pgAsyncAhead = (served: i32, seq: i32): i32 => pgAsyncGap(seq, served, PG_ASYNC_SEQ_MASK)

/**
 * Where slot `s`'s `k`th seat is in the seat arrays, `s * PG_ASYNC_MAX_DEPTH
 * + k`: -1 for a slot or depth out of range, and every caller checks the
 * seat against the arrays it reads.
 */
const pgAsyncSeatAt = (s: i32, k: i32): i32 => {
  if (s < 0 || s >= PG_ASYNC_MAX_SIZE || k < 0 || k >= PG_ASYNC_MAX_DEPTH) {
    return -1
  }
  return (s & (PG_ASYNC_MAX_SIZE - 1)) * PG_ASYNC_MAX_DEPTH + (k & (PG_ASYNC_MAX_DEPTH - 1))
}

/**
 * Whether seat `seat`'s answer is lost: its connection failed at or before
 * it. A seat that is not in the pool has no answer to read, so it counts as
 * lost.
 */
const pgAsyncLostSeat = (pool: PgAsyncPool, seat: i32): boolean => {
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  if (
    seat < 0 ||
    s < 0 ||
    seat >= toI32(pool.seatSeq.length) ||
    s >= toI32(pool.doomAt.length) ||
    s >= toI32(pool.served.length)
  ) {
    return true
  }
  const at: i32 = pool.doomAt[s]
  const served: i32 = pool.served[s]
  return at >= 0 && pgAsyncAhead(served, pool.seatSeq[seat]) >= pgAsyncAhead(served, at)
}

/**
 * Whether seat `seat`'s answer is the next its connection gives, lost or
 * not. A seat that is not in the pool is never served.
 */
const pgAsyncServed = (pool: PgAsyncPool, seat: i32): boolean => {
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  if (seat < 0 || s < 0 || seat >= toI32(pool.seatSeq.length) || s >= toI32(pool.served.length)) {
    return false
  }
  return pool.served[s] === pool.seatSeq[seat]
}

/**
 * Whether seat `seat`'s answer is the next its connection gives and is not
 * lost. A seat that is not in the pool never has its turn.
 */
const pgAsyncInTurn = (pool: PgAsyncPool, seat: i32): boolean =>
  pgAsyncServed(pool, seat) && !pgAsyncLostSeat(pool, seat)

/** The turn lane seat `seat` waits on: distinct for the seats of any eight slots in a row. */
const pgAsyncTurnLane = (seat: i32): i32 => seat % PG_ASYNC_LANES

/**
 * Whether a task waiting on slot `s`, other than `except`'s, may go on: its
 * turn came, its answer is lost, or an abandoned answer ahead of it waits to
 * be read past. No task waits on a slot that is not in the pool.
 */
const pgAsyncReady = (pool: PgAsyncPool, s: i32, except: i32): boolean => {
  if (s < 0 || s >= toI32(pool.served.length)) {
    return false
  }
  const served: i32 = pool.served[s]
  let waiting: boolean = false
  for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
    const seat: i32 = pgAsyncSeatAt(s, k)
    if (seat < 0 || seat >= toI32(pool.seatWaiting.length) || seat >= toI32(pool.seatSeq.length)) {
      // Past the pool's seats: none more on this slot.
      break
    }
    if (seat === except || toI32(pool.seatWaiting[seat]) === 0) {
      continue
    }
    if (pool.seatSeq[seat] === served || pgAsyncLostSeat(pool, seat)) {
      return true
    }
    waiting = true
  }
  return waiting && pgAsyncSkippable(pool, s) >= 0
}

/**
 * Wakes the seats waiting for their turn on slot `s`, other than `except`'s,
 * when one of them may go on: each on its turn lane, in the order their
 * answers come. A seat whose answer is read wakes the next within the same
 * loop turn only when the loop runs them in that order. The runtime promises
 * only the kernel's order: Linux epoll hands back distinct descriptors in the
 * order they became ready, so lanes rung in order run in order there, while
 * kqueue specifies no order and a seat run early re-parks and costs a turn.
 * One wake shared by them all ran them in the order they last waited, often
 * the reverse, so seats freed together were freed one a turn.
 */
const pgAsyncWakeTurns = (pool: PgAsyncPool, s: i32, except: i32): void => {
  if (!pgAsyncReady(pool, s, except)) {
    return
  }
  let after: i32 = -1
  for (let n: i32 = 0; n < PG_ASYNC_MAX_DEPTH; n++) {
    // Read again each round: the signal below is a call.
    if (s < 0 || s >= toI32(pool.served.length)) {
      return
    }
    const served: i32 = pool.served[s]
    let next: i32 = -1
    let nextAhead: i32 = PG_ASYNC_SEQ_WRAP
    for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
      const seat: i32 = pgAsyncSeatAt(s, k)
      if (seat < 0 || seat >= toI32(pool.seatSeq.length) || seat >= toI32(pool.seatWaiting.length)) {
        // Past the pool's seats: none more on this slot.
        break
      }
      const ahead: i32 = pgAsyncAhead(served, pool.seatSeq[seat])
      if (seat !== except && toI32(pool.seatWaiting[seat]) === 1 && ahead > after && ahead < nextAhead) {
        next = seat
        nextAhead = ahead
      }
    }
    if (next < 0) {
      return
    }
    pgAsyncSignal(pool, pgAsyncTurnLane(next))
    after = nextAhead
  }
}

/**
 * Marks slot `s` lost from sequence number `seq` on, settles the abandoned
 * seats it loses, and wakes those it fails. A slot that is not in the pool
 * has nothing to lose.
 */
const pgAsyncDoom = (pool: PgAsyncPool, s: i32, seq: i32): void => {
  if (s < 0 || s >= toI32(pool.doomAt.length) || s >= toI32(pool.served.length)) {
    return
  }
  const at: i32 = pool.doomAt[s]
  const served: i32 = pool.served[s]
  if (at < 0 || pgAsyncAhead(served, seq) < pgAsyncAhead(served, at)) {
    pool.doomAt[s] = seq
  }
  // A seat freed here closes the connection only once no seat is left on it;
  // the one being read past is settled by its reader.
  for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
    const seat: i32 = pgAsyncSeatAt(s, k)
    // Checked each round: settling a seat is a call.
    if (
      seat < 0 ||
      seat >= toI32(pool.seatAbandoned.length) ||
      seat >= toI32(pool.seatSeq.length) ||
      seat >= toI32(pool.seatUsed.length) ||
      s >= toI32(pool.skipping.length) ||
      s >= toI32(pool.served.length)
    ) {
      // Past the pool's seats: none more on this slot.
      break
    }
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
  pgAsyncWakeTurns(pool, s, -1)
}

/**
 * Leaves seat `seat` to the pool: its task was cancelled with its answer
 * unread, so the next task to wait on the connection, or for a seat on it,
 * reads past that answer instead of the connection being closed. A seat that
 * is not in the pool has nothing to leave.
 */
const pgAsyncAbandon = (pool: PgAsyncPool, seat: i32): void => {
  if (seat < 0 || seat >= toI32(pool.seatAbandoned.length)) {
    return
  }
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  pool.seatAbandoned[seat] = 1
  pgAsyncWakeTurns(pool, s, seat)
  pgAsyncWakePool(pool)
}

/**
 * An abandoned seat whose answer is read past or lost: freed once its ticket is
 * spent, else marked so `pgAsyncDone` frees it. A seat that is not in the pool
 * has nothing to settle.
 */
const pgAsyncSettle = (pool: PgAsyncPool, seat: i32): void => {
  if (seat < 0 || seat >= toI32(pool.seatAbandoned.length)) {
    return
  }
  if (toI32(pool.seatAbandoned[seat]) === 2) {
    pgAsyncFree(pool, seat)
  } else {
    pool.seatAbandoned[seat] = 3
  }
}

/** The abandoned seat in turn on slot `s` when no task reads past it yet, or -1. */
const pgAsyncSkippable = (pool: PgAsyncPool, s: i32): i32 => {
  if (
    s < 0 ||
    s >= toI32(pool.fds.length) ||
    s >= toI32(pool.skipping.length) ||
    s >= toI32(pool.served.length)
  ) {
    return -1
  }
  if (pool.fds[s] < 0 || toI32(pool.skipping[s]) !== 0) {
    return -1
  }
  const served: i32 = pool.served[s]
  for (let k: i32 = 0; k < PG_ASYNC_MAX_DEPTH; k++) {
    const seat: i32 = pgAsyncSeatAt(s, k)
    if (
      seat < 0 ||
      seat >= toI32(pool.seatAbandoned.length) ||
      seat >= toI32(pool.seatUsed.length) ||
      seat >= toI32(pool.seatSeq.length)
    ) {
      // Past the pool's seats: none more on this slot.
      break
    }
    const state: i32 = toI32(pool.seatAbandoned[seat])
    if (
      toI32(pool.seatUsed[seat]) === 1 &&
      (state === 1 || state === 2) &&
      pool.seatSeq[seat] === served &&
      !pgAsyncLostSeat(pool, seat)
    ) {
      return seat
    }
  }
  return -1
}

/**
 * Moves the unread bytes of slot `s` to the front of `input`, its input, and
 * answers where the next read goes. It answers -1 when the input has no room
 * left, when its marks are out of order (`pgAsyncAnswer` then fails the
 * answer, or the reader past it loses the connection), and for a slot that
 * is not in the pool.
 */
const pgAsyncRoom = (pool: PgAsyncPool, s: i32, input: u8[]): i32 => {
  if (s < 0 || s >= toI32(pool.inStart.length) || s >= toI32(pool.inEnd.length)) {
    return -1
  }
  const start: i32 = pool.inStart[s]
  const end: i32 = pool.inEnd[s]
  if (start < 0 || end < start || end > toI32(input.length)) {
    return -1
  }
  let room: i32 = end
  if (start > 0) {
    // `end` is at or past `start`, so the difference is the bytes kept.
    room = end - start
    if (!tryCopyBytes(input, 0, input, start, room)) {
      return -1
    }
    pool.inEnd[s] = room
    pool.inStart[s] = 0
  }
  return room < toI32(input.length) ? room : -1
}

/**
 * Records `got` more bytes read into slot `s`'s input at `end`, where
 * `pgAsyncRoom` put the read: a read takes no more than it was given, so the
 * sum stays within the input's `length`.
 */
const pgAsyncTook = (pool: PgAsyncPool, s: i32, end: i32, got: i32, length: i32): void => {
  if (s < 0 || s >= toI32(pool.inEnd.length)) {
    return
  }
  const next: i64 = toI64(end) + toI64(got)
  pool.inEnd[s] = next > toI64(length) ? length : toI32(next)
}

/**
 * Marks the statement seat `seat` runs on slot `s` as not prepared, so the
 * next seat that runs it sends its Parse again. A seat or statement out of
 * the pool's range has nothing prepared.
 */
const pgAsyncUnprepare = (pool: PgAsyncPool, s: i32, seat: i32): void => {
  // 64 is both PG_ASYNC_MAX_SIZE and PG_ASYNC_MAX_STATEMENTS, written as a
  // literal: the prover takes a bound from a literal but not from a module
  // constant, and the bounds prove the offset below cannot overflow.
  if (s < 0 || s >= 64 || seat < 0 || seat >= toI32(pool.seatStatement.length)) {
    return
  }
  const q: i32 = pool.seatStatement[seat]
  if (q < 0 || q >= 64) {
    return
  }
  const at: i32 = s * PG_ASYNC_MAX_STATEMENTS + q
  if (at < toI32(pool.prepared.length)) {
    pool.prepared[at] = 0
  }
}

/**
 * Moves slot `s` past the answer in turn, seat `seat`'s at sequence number
 * `seq`: its input to where the answer ends, and its order to the next seat.
 * A Parse in the seat's write the answer does not show taken marks its
 * statement for parsing again. A slot or seat that is not in the pool has
 * nothing to move past.
 */
const pgAsyncPast = (pool: PgAsyncPool, s: i32, seat: i32, seq: i32): void => {
  if (
    s < 0 ||
    s >= toI32(pool.inStart.length) ||
    s >= toI32(pool.inEnd.length) ||
    s >= toI32(pool.inAnswer.length) ||
    s >= toI32(pool.inParsed.length) ||
    s >= toI32(pool.served.length) ||
    seat < 0 ||
    seat >= toI32(pool.seatParse.length)
  ) {
    return
  }
  const end: i32 = pool.inEnd[s]
  const start: i32 = pool.inAnswer[s] >= 0 ? pool.inAnswer[s] : end
  if (start === end) {
    pool.inStart[s] = 0
    pool.inEnd[s] = 0
  } else {
    pool.inStart[s] = start
  }
  pool.served[s] = pgAsyncStep(seq, PG_ASYNC_SEQ_MASK)
  if (toI32(pool.seatParse[seat]) === 1 && toI32(pool.inParsed[s]) === 0) {
    pgAsyncUnprepare(pool, s, seat)
  }
}

/** Marks slot `s` as read by no task, when it is in the pool. */
const pgAsyncUnskip = (pool: PgAsyncPool, s: i32): void => {
  if (s >= 0 && s < toI32(pool.skipping.length)) {
    pool.skipping[s] = 0
  }
}

/**
 * Reads past the answer of `seat`, an abandoned seat in turn on slot `s`,
 * and serves the next. An answer that is not a plain one ending idle (a
 * frame this module does not expect, a transaction left open, a setting
 * changed) or larger than the pool's input loses the connection from it on,
 * as does a socket error. A cancelled reader stops and leaves the bytes read
 * for the next. A slot that is not in the pool has nothing to read past.
 */
const pgAsyncSkip = async (pool: PgAsyncPool, s: i32, seat: i32): Promise<void> => {
  if (
    s < 0 ||
    s >= toI32(pool.served.length) ||
    s >= toI32(pool.fds.length) ||
    s >= toI32(pool.inputs.length) ||
    s >= toI32(pool.skipping.length)
  ) {
    return
  }
  const seq: i32 = pool.served[s]
  const fd: i32 = pool.fds[s]
  const input: u8[] = pool.inputs[s]
  pool.skipping[s] = 1
  let fit: boolean = true
  while (!pgAsyncScan(pool, s)) {
    const end: i32 = pgAsyncRoom(pool, s, input)
    if (end < 0 || end >= toI32(input.length)) {
      fit = false
      break
    }
    const got: i32 = netRead(fd, input, end, toI32(input.length) - end)
    if (got === PG_ASYNC_AGAIN) {
      const waited: boolean = await readable(fd)
      if (pgAsyncLostSeat(pool, seat)) {
        pgAsyncUnskip(pool, s)
        pgAsyncSettle(pool, seat)
        return
      }
      if (!waited && cancelled()) {
        // Another task reads on from where this one stopped.
        pgAsyncUnskip(pool, s)
        pgAsyncWakeTurns(pool, s, -1)
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
      pgAsyncTook(pool, s, end, got, toI32(input.length))
    }
  }
  pgAsyncUnskip(pool, s)
  // `pgAsyncPlain` answers false for an answer with no end found.
  if (!fit || !pgAsyncPlain(pool, s)) {
    pgAsyncDoom(pool, s, seq)
    return
  }
  pgAsyncPast(pool, s, seat, seq)
  pgAsyncSettle(pool, seat)
  pgAsyncWakeTurns(pool, s, -1)
  pgAsyncWakePool(pool)
}

/**
 * Whether the answer in turn on slot `s`, at `[inStart, inAnswer)`, leaves
 * the connection as it found it: only the frames a statement's answer has,
 * ending with a ReadyForQuery that is idle. An answer with no end found, or
 * a slot that is not in the pool, is not one.
 */
const pgAsyncPlain = (pool: PgAsyncPool, s: i32): boolean => {
  if (
    s < 0 ||
    s >= toI32(pool.inputs.length) ||
    s >= toI32(pool.inAnswer.length) ||
    s >= toI32(pool.inStart.length)
  ) {
    return false
  }
  const input: u8[] = pool.inputs[s]
  const length: i32 = toI32(input.length)
  const stop: i32 = pool.inAnswer[s]
  if (stop < 0 || stop > length) {
    return false
  }
  let at: i32 = pool.inStart[s]
  // `at < length - 5` and `at <= stop - 5` are `at + 5 < length` and
  // `at + 5 <= stop`, written so they cannot overflow.
  while (at >= 0 && at < length - 5 && at <= stop - 5) {
    const type: i32 = toI32(input[at])
    // The frame's length, read here rather than with `getI32BE`, whose call
    // would end what the prover knows of `input`.
    const size: i32 =
      (toI32(input[at + 1]) << 24) |
      (toI32(input[at + 2]) << 16) |
      (toI32(input[at + 3]) << 8) |
      toI32(input[at + 4])
    // Not reached for a length under 4: `pgAsyncScan` refused one before this
    // answer could be read past. Kept so this walk does not rest on that. A
    // frame past `stop` is not one of this answer's.
    const left: i32 = stop - at
    if (size < 4 || size >= left) {
      return false
    }
    // In i64: the frame ends before `stop`, so the sum fits an i32.
    const next: i32 = toI32(toI64(at) + toI64(1) + toI64(size))
    if (type === 90) {
      return next === stop && size === 5 && toI32(input[at + 5]) === PG_ASYNC_IDLE
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
 * left. Wakes the tasks waiting for room. A seat that is not in the pool has
 * nothing to give back.
 */
const pgAsyncFree = (pool: PgAsyncPool, seat: i32): void => {
  const s: i32 = toI32(seat / PG_ASYNC_MAX_DEPTH)
  if (
    seat < 0 ||
    s < 0 ||
    seat >= toI32(pool.seatUsed.length) ||
    seat >= toI32(pool.seatWaiting.length) ||
    seat >= toI32(pool.seatAbandoned.length) ||
    seat >= toI32(pool.seatClaims.length) ||
    s >= toI32(pool.seated.length) ||
    s >= toI32(pool.doomAt.length) ||
    s >= toI32(pool.fds.length)
  ) {
    return
  }
  pool.seatUsed[seat] = 0
  pool.seatWaiting[seat] = 0
  pool.seatAbandoned[seat] = 0
  pool.seatClaims[seat] = pgAsyncStep(pool.seatClaims[seat], PG_ASYNC_SEAT_MASK)
  pool.seated[s] = pgAsyncUncount(pool.seated[s])
  if (pool.doomAt[s] >= 0 && pool.seated[s] === 0) {
    const fd: i32 = pool.fds[s]
    if (fd >= 0) {
      pool.fds[s] = -1
      pool.dropped = pgAsyncCount(pool.dropped)
      netClose(fd)
    }
    pgAsyncForget(pool, s)
  }
  pgAsyncWakePool(pool)
}

/**
 * Whether the answer in turn on slot `s` lies whole in its input, from
 * `inStart`: `inAnswer` is set to where it ends, past its ReadyForQuery, or
 * to -1 for a frame length no answer has, which `pgAsyncAnswer` fails. A
 * slot that is not in the pool, or whose marks are out of order, holds no
 * whole answer.
 */
const pgAsyncScan = (pool: PgAsyncPool, s: i32): boolean => {
  if (
    s < 0 ||
    s >= toI32(pool.inputs.length) ||
    s >= toI32(pool.inEnd.length) ||
    s >= toI32(pool.inStart.length) ||
    s >= toI32(pool.inParsed.length) ||
    s >= toI32(pool.inAnswer.length)
  ) {
    return false
  }
  const input: u8[] = pool.inputs[s]
  const length: i32 = toI32(input.length)
  const end: i32 = pool.inEnd[s]
  const most: i32 = pool.maxMessage
  if (end < 0 || end > length) {
    return false
  }
  let at: i32 = pool.inStart[s]
  pool.inParsed[s] = 0
  // `at < length - 4` is `at + 5 <= length`, written so it cannot overflow.
  while (at >= 0 && at < length - 4) {
    const left: i32 = end - at
    if (left < 5) {
      return false
    }
    // Read here rather than with `getI32BE`, whose call would end what the
    // prover knows of `input` and the pool's arrays.
    const size: i32 =
      (toI32(input[at + 1]) << 24) |
      (toI32(input[at + 2]) << 16) |
      (toI32(input[at + 3]) << 8) |
      toI32(input[at + 4])
    if (size < 4 || size > most) {
      pool.inAnswer[s] = -1
      return true
    }
    if (left - 1 < size) {
      return false
    }
    const type: i32 = toI32(input[at])
    // In i64: the frame ends at or before `end`, so the sum fits an i32.
    at = toI32(toI64(at) + toI64(1) + toI64(size))
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
  if (
    seat < 0 ||
    s < 0 ||
    seat >= toI32(pool.seatSeq.length) ||
    seat >= toI32(pool.seatWaiting.length) ||
    s >= toI32(pool.writing.length)
  ) {
    // Not reached: `pgAsyncSeatOf` panicked on a ticket of no seat. A seat
    // out of the pool's arrays has no answer to wait for.
    return PG_ASYNC_BROKEN
  }
  const seq: i32 = pool.seatSeq[seat]
  if (sent === PG_ASYNC_UNSENT || sent === PG_ASYNC_UNSENT_CANCELLED) {
    // Nothing went out; `pgAsyncDone` hands its place in the order back
    // while `writing` keeps any other seat from being taken here.
    return sent
  }
  pool.writing[s] = 0
  if (sent >= 0) {
    pool.seatWaiting[seat] = 1
  }
  pgAsyncWakePool(pool)
  if (sent < 0) {
    pgAsyncDoom(pool, s, seq)
    return sent <= PG_ASYNC_BROKEN ? sent : PG_ASYNC_BROKEN
  }
  let gaveUp: boolean = false
  let yields: i32 = 0
  while (!pgAsyncServed(pool, seat) && !pgAsyncLostSeat(pool, seat)) {
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
      pool.turnWaits = pgAsyncCount(pool.turnWaits)
      await pgAsyncPark(pool, pgAsyncTurnLane(seat), -1)
      // The last of the waiters the byte woke reads it, as in the claim and
      // seat loops: a seat that waits again must not park on a byte nobody reads.
      pgAsyncDrain(pool, pgAsyncTurnLane(seat))
    }
  }
  // Checked again: the waits above are calls.
  if (seat < toI32(pool.seatWaiting.length)) {
    pool.seatWaiting[seat] = 0
  }
  pgAsyncDrain(pool, pgAsyncTurnLane(seat))
  if (pgAsyncLostSeat(pool, seat)) {
    return pgAsyncBroken(cancelled() ? PG_ASYNC_CANCELLED : 0)
  }
  if (gaveUp) {
    // Its answer is on its way and this task will not read it: the next one does.
    pgAsyncAbandon(pool, seat)
    return PG_ASYNC_BROKEN + PG_ASYNC_CANCELLED
  }
  if (s >= toI32(pool.fds.length) || s >= toI32(pool.inputs.length)) {
    // Not reached: the slot's arrays are as long as `seatSeq` is in slots.
    pgAsyncDoom(pool, s, seq)
    return PG_ASYNC_BROKEN
  }
  const fd: i32 = pool.fds[s]
  const input: u8[] = pool.inputs[s]
  while (!pgAsyncScan(pool, s)) {
    const end: i32 = pgAsyncRoom(pool, s, input)
    if (end < 0 || end >= toI32(input.length)) {
      // Past the input: `pgAsyncAnswer` reads the rest of it alone.
      if (s < toI32(pool.inAnswer.length)) {
        pool.inAnswer[s] = -1
      }
      return 0
    }
    const got: i32 = netRead(fd, input, end, toI32(input.length) - end)
    if (got === PG_ASYNC_AGAIN) {
      const waited: boolean = await readable(fd)
      const failed: i32 = pgAsyncWaitFailure(waited)
      if (failed === PG_ASYNC_CANCELLED) {
        // The bytes read stay in the input for the task that reads past the rest.
        pgAsyncAbandon(pool, seat)
        return pgAsyncBroken(failed)
      }
      if (failed !== 0) {
        pgAsyncDoom(pool, s, seq)
        return pgAsyncBroken(failed)
      }
    } else if (got <= 0) {
      pgAsyncDoom(pool, s, seq)
      return pgAsyncBroken(got)
    } else {
      pgAsyncTook(pool, s, end, got, toI32(input.length))
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
 * @param ticket The ticket `pgAsyncTurn` used; any other panics. One whose
 *   turn has not come, or whose connection failed at or before it, fails the
 *   answer without reading, with `PG_ERR_CLOSED` and `reusable` false.
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
  if (
    !pgAsyncInTurn(pool, seat) ||
    s < 0 ||
    s >= toI32(pool.inputs.length) ||
    s >= toI32(pool.inStart.length) ||
    s >= toI32(pool.inEnd.length) ||
    s >= toI32(pool.inAnswer.length) ||
    s >= toI32(pool.fds.length)
  ) {
    // Read before its turn, or after its connection failed: there is no
    // answer of its own to read.
    return pgAsyncLost(new PgAsyncResult(), PG_ERR_CLOSED, 0)
  }
  // Copied into the task's memory: the spawn rules read an array of the pool
  // handed across an `await` as one the callee may grow.
  const input: u8[] = pool.inputs[s]
  const fd: i32 = pool.fds[s]
  const from: i32 = pool.inStart[s]
  const to: i32 = pool.inAnswer[s] >= 0 ? pool.inAnswer[s] : pool.inEnd[s]
  // `to` is at or past `from` here, so the difference is the bytes.
  let count: i32 = 0
  if (from >= 0 && from <= to && to <= toI32(input.length)) {
    count = to - from
  }
  if (count < 0 || count > 65535) {
    // Not reached: an input is `PG_ASYNC_INPUT_SIZE` bytes. `pgAsyncZeroed`
    // would build a longer one by `push`, which the spawn rules read as
    // growing the pool, so this answer is failed as one too big to carry.
    return pgAsyncLost(new PgAsyncResult(), PG_ERR_TOO_BIG, 0)
  }
  const carried: u8[] = new Array<u8>(toU16(count))
  if (!tryCopyBytes(carried, 0, input, from, toI32(carried.length))) {
    return pgAsyncLost(new PgAsyncResult(), PG_ERR_CLOSED, 0)
  }
  return await pgAsyncRead(
    fd,
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
  if (
    seat < 0 ||
    s < 0 ||
    seat >= toI32(pool.seatSeq.length) ||
    seat >= toI32(pool.seatAbandoned.length) ||
    seat >= toI32(pool.seatClaims.length) ||
    seat >= toI32(pool.seatParse.length) ||
    s >= toI32(pool.nextSeq.length) ||
    s >= toI32(pool.writing.length) ||
    s >= toI32(pool.served.length)
  ) {
    // Not reached: `pgAsyncSeatOf` panicked on a ticket of no seat. A seat
    // out of the pool's arrays holds nothing to spend.
    return
  }
  const seq: i32 = pool.seatSeq[seat]
  const abandoned: i32 = toI32(pool.seatAbandoned[seat])
  if (abandoned === 1) {
    // Its answer is not read past yet: the ticket is spent, the seat stays until it is.
    pool.seatAbandoned[seat] = 2
    pool.seatClaims[seat] = pgAsyncStep(pool.seatClaims[seat], PG_ASYNC_SEAT_MASK)
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
    pool.writing[s] = 0
    if (toI32(pool.seatParse[seat]) === 1) {
      pgAsyncUnprepare(pool, s, seat)
    }
    pgAsyncFree(pool, seat)
    return
  }
  if (turn >= 0 && pool.served[s] === seq) {
    pgAsyncPast(pool, s, seat, seq)
    if (!reusable) {
      // A lost frame, a transaction left open or a setting changed: the
      // statements behind this one would be read out of step, or run in a
      // session they did not ask for.
      pgAsyncDoom(pool, s, pgAsyncStep(seq, PG_ASYNC_SEQ_MASK))
    }
    pgAsyncWakeTurns(pool, s, seat)
  } else if (turn >= 0) {
    // Its answer was asked for before its turn and never read: nothing reads
    // past it, so the seats behind it would wait for good. The connection is
    // lost from here, as for an answer read out of step.
    pgAsyncDoom(pool, s, seq)
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
 *   a text one, a Bind past 2^30 bytes, or unequal `values` and `nulls` fails it the same way.
 * @returns The answer; its `reusable` goes to `pgAsyncRelease`.
 */
export const pgAsyncQuery = async (
  pool: PgAsyncPool,
  ticket: i32,
  sql: string,
  params: PgAsyncParams
): Promise<PgAsyncResult> => {
  pgAsyncCheckCaps(pool)
  const slot: i32 = pgAsyncSlot(pool, ticket)
  const result = new PgAsyncResult()
  if (slot < 0 || slot >= toI32(pool.fds.length)) {
    // Not reached: `pgAsyncSlot` panicked on a ticket of no slot. A slot out
    // of the pool's arrays has no connection to send on.
    return pgAsyncLost(result, PG_ERR_CLOSED, 0)
  }
  const fd: i32 = pool.fds[slot]
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
  while (sent >= 0 && sent < toI32(out.length)) {
    // `sent` is at least 0 and below the `length` here, so the difference is the rest.
    const total: i32 = toI32(out.length)
    let rest: i32 = 0
    if (sent >= 0 && total >= 0) {
      rest = total - sent
    }
    const n: i32 = netWrite(fd, out, sent, rest)
    if (n === PG_ASYNC_AGAIN) {
      const waited: boolean = await writable(fd)
      const failed: i32 = pgAsyncWaitFailure(waited)
      if (failed !== 0) {
        return pgAsyncLost(result, PG_ERR_CLOSED, failed)
      }
    } else if (n <= 0) {
      return pgAsyncLost(result, PG_ERR_CLOSED, n)
    } else {
      // A write takes no more than it was given, so `sent` stays within `out`.
      const next: i64 = toI64(sent) + toI64(n)
      sent = next > toI64(out.length) ? toI32(out.length) : toI32(next)
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
 * `params`, or null for a NUL in a parameter, more than 65535 of them, a
 * value without its null mark or one past them, or SQL or a Bind past 2^30
 * bytes, more than one message holds. `name` -1 is the unnamed
 * statement; 0 or more names it `n<name>`, which the connection keeps.
 */
const pgAsyncEncode = (sql: u8[], name: i32, parse: boolean, params: PgAsyncParams): u8[] | null => {
  const values: string[] = params.values
  const nulls: boolean[] = params.nulls
  const count: i32 = toI32(values.length)
  // A parameter without its null mark (an array pushed to directly, past the
  // methods) would send a Bind whose count is not what follows it.
  if (count > 65535 || count !== toI32(nulls.length)) {
    return null
  }
  // A message's length is an i32 on the wire; each kept under 2^30 leaves the sums below room.
  const cap: i32 = 1073741823
  const sqlLength: i32 = toI32(sql.length)
  if (sqlLength > cap) {
    return null
  }
  // The statement's name: none, or `n` and its decimal digits (at most 2), as `pgAsyncLabel` writes it.
  let named: i32 = 0
  if (name >= 10) {
    named = 3
  } else if (name >= 0) {
    named = 2
  }
  // The length, "" portal, the statement's name and NUL, no parameter formats,
  // the count, no result formats: 4 + 1 + named + 1 + 2 + 2 + 2. Each sum is
  // counted in i64, where no two i32s can wrap it, before it is kept.
  let bind: i32 = toI32(12) + named
  for (let i: i32 = 0; i < toI32(values.length) && i < toI32(nulls.length); i++) {
    const size: i32 = nulls[i] ? toI32(0) : toI32(values[i].length)
    const next: i64 = toI64(bind) + toI64(4) + toI64(size)
    if (next > toI64(cap)) {
      return null
    }
    bind = toI32(next)
  }
  // Each part is pushed in order, so no write needs a position the prover must follow.
  const out: u8[] = []
  if (parse) {
    // The length, the statement's name and NUL, the SQL and its NUL, no parameter types.
    out.push(80)
    pgAsyncPushI32(out, sqlLength + named + toI32(8))
    pgAsyncLabel(out, name)
    out.push(0)
    for (let i: i32 = 0; i < toI32(sql.length); i++) {
      out.push(sql[i])
    }
    out.push(0)
    out.push(0)
    out.push(0)
  }
  // The unnamed portal, the statement's name, no parameter format codes (all text), the count.
  out.push(66)
  pgAsyncPushI32(out, bind)
  out.push(0)
  pgAsyncLabel(out, name)
  out.push(0)
  out.push(0)
  out.push(0)
  out.push(toU8(count >> 8))
  out.push(toU8(count & 255))
  for (let i: i32 = 0; i < toI32(values.length) && i < toI32(nulls.length); i++) {
    if (nulls[i]) {
      pgAsyncPushI32(out, -1)
      continue
    }
    const v: string = values[i]
    pgAsyncPushI32(out, toI32(v.length))
    for (let j: i32 = 0; j < toI32(v.length); j++) {
      const c: i32 = toI32(v.charCodeAt(j))
      if (c === 0) {
        return null
      }
      out.push(toU8(c))
    }
  }
  // No result format codes: every column in text.
  out.push(0)
  out.push(0)
  // Execute ("" portal, no row limit) and Sync.
  out.push(69)
  pgAsyncPushI32(out, 9)
  out.push(0)
  pgAsyncPushI32(out, 0)
  out.push(83)
  pgAsyncPushI32(out, 4)
  return out
}

/** Appends `v`'s four bytes to `out`, most significant first, as the protocol sends an Int32. */
const pgAsyncPushI32 = (out: u8[], v: i32): void => {
  const u: u32 = toU32(v)
  out.push(toU8(u >> 24))
  out.push(toU8((u >> 16) & 255))
  out.push(toU8((u >> 8) & 255))
  out.push(toU8(u & 255))
}

/**
 * Appends a prepared statement's name to `out`: `n` and the decimal digits
 * of `name` (at most 2), or nothing for a negative `name`.
 */
const pgAsyncLabel = (out: u8[], name: i32): void => {
  if (name >= 10) {
    out.push(110)
    out.push(toU8(toI32(48) + toI32(name / 10)))
    out.push(toU8(toI32(48) + (name % 10)))
  } else if (name >= 0) {
    out.push(110)
    out.push(toU8(toI32(48) + name))
  }
}

/**
 * A zeroed byte array of `n` bytes, or an empty one for a negative `n`. Up to
 * 64 KiB it is one `new Array` of a `u16` length, which needs no check; a
 * longer one, the rare buffer for a message past that, is built by `push`.
 */
const pgAsyncZeroed = (n: i32): u8[] => {
  if (n >= 0 && n <= 65535) {
    return new Array<u8>(toU16(n))
  }
  const out: u8[] = []
  while (toI32(out.length) < n) {
    out.push(0)
  }
  return out
}

/** `s`'s UTF-8 bytes, or null when one is zero, which a C string in the protocol cannot hold. */
const pgAsyncBytes = (s: string): u8[] | null => {
  const n: i32 = toI32(s.length)
  const b: u8[] = pgAsyncZeroed(n)
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
  // `pgAsyncCheckCaps` has already held every cap inside its range, so this
  // never fails; it is what lets the prover bound the sums below by the caps.
  if (
    maxMessage < 4 ||
    maxMessage > PG_ASYNC_MAX_CAP ||
    maxRows > PG_ASYNC_MAX_ROWS ||
    maxResultBytes < 0 ||
    maxResultBytes > PG_ASYNC_MAX_CAP
  ) {
    return pgAsyncLost(result, PG_ERR_TOO_BIG, 0)
  }
  // The seed is part of the pool's input, far shorter than this.
  if (toI32(seed.length) > PG_ASYNC_MAX_CAP) {
    return pgAsyncLost(result, PG_ERR_TOO_BIG, 0)
  }
  // `PG_ASYNC_MAX_CAP`, one past it, and five short of one past it, as
  // literals: inside a loop the prover takes a bound from a literal or a local
  // constant, not from a module constant.
  const cap: i32 = 1073741823
  const capEnd: i32 = 1073741824
  const capHead: i32 = 1073741819
  // The buffer starts the size of the seed, not a zero-filled 8 KiB: an answer
  // already scanned whole is parsed without clearing memory it never reads, and
  // only a read past it grows the buffer.
  let buf: u8[] = pgAsyncZeroed(toI32(seed.length))
  if (!tryCopyBytes(buf, 0, seed, 0, toI32(seed.length))) {
    return pgAsyncLost(result, PG_ERR_FRAME, 0)
  }
  let start: i32 = 0
  let end: i32 = toI32(seed.length)
  let refused: boolean = false
  let tooBig: boolean = false
  let changed: boolean = false
  let shaped: boolean = false
  // What is left of `maxResultBytes` for the rows, tags and error fields kept.
  let left: i32 = maxResultBytes
  while (true) {
    // Always false: `start` never passes `end`, `end` never passes the
    // buffer, the buffer is never longer than the seed or `maxMessage + 1`, and
    // `left` only shrinks from `maxResultBytes`. Each bound is stated on its
    // own because the prover reads ranges, not the chain between them.
    if (
      start < 0 ||
      end < 0 ||
      start > end ||
      start > capEnd ||
      end > capEnd ||
      end > toI32(buf.length) ||
      left < 0 ||
      left > cap
    ) {
      return pgAsyncLost(result, PG_ERR_FRAME, 0)
    }
    // A whole message at `start` is taken here; anything short of one reads more below.
    const have: i32 = end - start
    if (have >= 5) {
      // Always false, since five bytes lie between `start` and `end`; it
      // proves the header's reads and, with `length`, the frame's end.
      if (start > toI32(buf.length) - 5 || start > capHead) {
        return pgAsyncLost(result, PG_ERR_FRAME, 0)
      }
      const type: i32 = toI32(buf[start])
      const length: i32 = getI32BE(buf, start + 1)
      if (length < 4) {
        return pgAsyncLost(result, PG_ERR_FRAME, 0)
      }
      // `maxMessage` is never past `PG_ASYNC_MAX_CAP`; the second test bounds the sums below.
      if (length > maxMessage || length > cap) {
        return pgAsyncLost(result, PG_ERR_TOO_BIG, 0)
      }
      if (have - 1 >= length) {
        const body: i32 = start + 5
        const stop: i32 = start + 1 + length
        // The body's length, `stop - body`, which the prover bounds by `maxMessage`.
        const size: i32 = length - 4
        start = stop
        if (type === 90) {
          // 'Z': ReadyForQuery, the end of the answer.
          if (size !== 1 || body < 0 || body >= toI32(buf.length)) {
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
          if (size < 2) {
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
          const cost: i32 = size + columns * PG_ASYNC_CELL_COST
          const rows: i32 = result.rows
          if (tooBig || rows < 0 || rows >= maxRows || cost < 0 || cost > left) {
            tooBig = true
            continue
          }
          left -= cost
          if (!pgAsyncRow(buf, body + 2, stop, columns, result)) {
            return pgAsyncLost(result, PG_ERR_FRAME, 0)
          }
          result.columns = columns
          shaped = true
          result.rows = rows + 1
          continue
        }
        if (type === 67) {
          // 'C': CommandComplete, a NUL-ended tag.
          if (size < 1 || stop > toI32(buf.length) || toI32(buf[stop - 1]) !== 0) {
            return pgAsyncLost(result, PG_ERR_FRAME, 0)
          }
          // A tag is kept, so it costs the budget too; past it, the answer fails.
          if (size > left) {
            tooBig = true
            continue
          }
          left -= size
          result.tag = String.fromBytes(buf, body, stop - 1)
          continue
        }
        if (type === 69) {
          // 'E': ErrorResponse, fields of a code byte and a NUL-ended value.
          // Its kept fields cost the budget, bounded by the frame; past it, none is kept.
          refused = true
          if (size > left) {
            tooBig = true
            continue
          }
          left -= size
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
    }
    // Room for the rest of the message at `start`, then more input.
    if (start > 0) {
      if (!tryCopyBytes(buf, 0, buf, start, end - start)) {
        return pgAsyncLost(result, PG_ERR_FRAME, 0)
      }
      end -= start
      start = 0
    }
    if (end === toI32(buf.length)) {
      // A full buffer holds less than one whole message, so it is shorter
      // than `maxMessage + 1`; the test lets the prover read that.
      if (end < 0 || end > maxMessage || end > cap || maxMessage > cap) {
        return pgAsyncLost(result, PG_ERR_TOO_BIG, 0)
      }
      const twice: i32 = end < PG_ASYNC_INPUT_SIZE ? PG_ASYNC_INPUT_SIZE : end * 2
      const grown: u8[] = pgAsyncZeroed(twice > maxMessage + 1 ? maxMessage + 1 : twice)
      if (!tryCopyBytes(grown, 0, buf, 0, end)) {
        return pgAsyncLost(result, PG_ERR_FRAME, 0)
      }
      buf = grown
    }
    // Always false, as above; it proves the read's range below.
    if (start < 0 || end < 0 || start > end || start > capEnd || end > capEnd || end > toI32(buf.length)) {
      return pgAsyncLost(result, PG_ERR_FRAME, 0)
    }
    const room: i32 = toI32(buf.length) - end
    let want: i32 = room
    if (bounded) {
      // The rest of the frame at `start`, and the next header unless it is the ReadyForQuery.
      const held: i32 = end - start
      want = toI32(5) - held
      if (held >= 5 && start < toI32(buf.length) - 5) {
        const length: i32 = getI32BE(buf, start + 1)
        // A length past `maxMessage` was failed before this read.
        if (length < 4) {
          return pgAsyncLost(result, PG_ERR_FRAME, 0)
        }
        if (length > maxMessage || length > cap) {
          return pgAsyncLost(result, PG_ERR_FRAME, 0)
        }
        const rest: i32 = toI32(1) + length - held
        want = toI32(buf[start]) === 90 ? rest : rest + 5
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
      // A read never passes the room it was given, so this never fails; the
      // sum is taken in `i64` because the prover cannot chain `got <= want <= room`.
      const next: i64 = toI64(end) + toI64(got)
      if (next > toI64(buf.length)) {
        return pgAsyncLost(result, PG_ERR_FRAME, 0)
      }
      end = toI32(next)
    }
  }
}

/** One DataRow's `columns` cells in `[at, stop)` into `result`; false for a frame that does not add up. */
const pgAsyncRow = (buf: u8[], at: i32, stop: i32, columns: i32, result: PgAsyncResult): boolean => {
  // `stop` never passes the buffer; the test lets the prover read each cell's range.
  if (at < 0 || at > stop || stop > toI32(buf.length)) {
    return false
  }
  // `PG_ASYNC_MAX_CAP`, and the last place a cell's length can start in a
  // frame that ends by one past it, as literals, which the prover reads inside
  // a loop where it does not read a module constant.
  const cap: i32 = 1073741823
  const lastCell: i32 = 1073741820
  let p: i32 = at
  for (let c: i32 = 0; c < columns; c++) {
    if (p < 0 || p > stop - 4 || p > toI32(buf.length) - 4 || p > lastCell) {
      return false
    }
    const n: i32 =
      (toI32(buf[p]) << 24) | (toI32(buf[p + 1]) << 16) | (toI32(buf[p + 2]) << 8) | toI32(buf[p + 3])
    const from: i32 = p + 4
    if (n === -1) {
      result.values.push("")
      result.nulls.push(true)
      p = from
      continue
    }
    // A cell never passes the frame, which is never past `PG_ASYNC_MAX_CAP`;
    // the second test is what lets the prover bound the sum below.
    if (n < 0 || n > stop - from || n > cap) {
      return false
    }
    const cellEnd: i32 = from + n
    result.values.push(String.fromBytes(buf, from, cellEnd))
    result.nulls.push(false)
    p = cellEnd
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
