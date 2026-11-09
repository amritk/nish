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
 * **Why three calls.** A spawned task shares the pool with the function that
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
 * **Its own encoder and framer.** A query is encoded and its answer framed
 * here (`pgAsyncEncode`, `pgAsyncRead`), not by `PgConnection` or
 * `PgCarrier`: those keep their buffers and rows in objects that outlive a
 * query, which a task would have to grow inside the pool, and a
 * `PgConnection` holds the password as a `Secret`, which a task may not be
 * handed. The framer applies the same checks as `PgConnection`'s (PG-28 in
 * `docs/security/postgres.md`).
 *
 * **Claiming.** When every live connection is claimed, `pgAsyncClaim` sleeps
 * and looks again, 1 ms then doubling to 16 ms, until one is free or it has
 * slept `claimWaitMs` in all; a released connection is not announced, so a
 * waiter finds it on its next look. A ticket names a slot and that slot's
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
 * with `PG_ERR_TOO_BIG`. A wait has no deadline of its own: a server that
 * accepts and never answers holds the task until it closes, the task is
 * cancelled, or (in `pgAsyncConnect`) the caller gives up; bound a slow
 * statement with the server's `statement_timeout` too.
 *
 * **Cancellation.** A task that is cancelled (`nish:async`'s `cancel`, a
 * `cancelAfter` deadline, or `nish/net/serve` when the client hangs up, the
 * request's deadline passes or the server drains) stops waiting at once.
 * `pgAsyncClaim` answers `PG_ASYNC_CANCELLED` and claims nothing; a query
 * not yet sent fails with nothing written and its connection reusable; a
 * query cut off mid-answer fails with `PG_ERR_CLOSED`, `socketError`
 * `PG_ASYNC_CANCELLED` and `reusable` false, so the task's
 * `pgAsyncRelease` closes the connection, whose unread answer would put the
 * next task out of step. No CancelRequest is sent: the server runs the
 * statement on until it sees the socket closed.
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
 * `tests/link/std_postgres_async_flat` reads `Arena.used()` across thousands
 * of queries. Caps and findings: `docs/security/postgres.md`.
 *
 * Written for this module; not ported from another implementation.
 */

import { cancelled, readable, sleep, writable } from "nish:async"
import { connectResult, netAddress, netClose, netRead, netWrite, tcpConnect, unixConnect } from "nish:net"
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
// The first and the longest sleep while every connection is claimed.
const PG_ASYNC_FIRST_SLEEP_MS: i32 = 1
const PG_ASYNC_LONGEST_SLEEP_MS: i32 = 16
// What a query reads first; it grows by doubling up to one `maxMessage`.
const PG_ASYNC_INPUT_SIZE: i32 = 8192
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
  /** The largest message a query accepts, in bytes, 1024 to 2^30 - 1; a larger one fails it with `PG_ERR_TOO_BIG` and closes the connection. */
  maxMessage: i32 = 1048576
  /** The most columns a row may have, 1 to 65535; more fails the query with `PG_ERR_TOO_BIG` and closes the connection. */
  maxColumns: i32 = 1664
  /** The most rows a query keeps, 1 to 2^24; later rows are read and dropped, and the query fails with `PG_ERR_TOO_BIG`. */
  maxRows: i32 = 100000
  /**
   * The most bytes of rows a query keeps, 1024 to 2^30 - 1: each row costs
   * its DataRow's length and 16 bytes a cell. A row past it is dropped with
   * every later one, read through to the ReadyForQuery, and the query fails
   * with `PG_ERR_TOO_BIG`.
   */
  maxResultBytes: i32 = 16777216
  /** The most milliseconds `pgAsyncClaim` sleeps waiting for a free connection before it answers `PG_CARRIER_FULL`. */
  claimWaitMs: i32 = 5000
  /** How many times `pgAsyncClaim` slept because every live connection was claimed. */
  waits: i32 = 0
  /** How many connections `pgAsyncRelease` closed rather than gave back. */
  dropped: i32 = 0

  /**
   * A pool of `size` slots, none connected yet.
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
    for (let s: i32 = 0; s < size; s++) {
      this.fds[s] = -1
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
   * then closed, claimed or not. Call it once the tasks that hold tickets
   * are done; a ticket used afterwards panics.
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
    }
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
  /** When the socket failed: its negative errno, 0 when the server closed cleanly, `PG_ASYNC_CANCELLED` when the task was cancelled. */
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
    const made: boolean = await pgAsyncStartup(conn, fd)
    conn.dispose()
    if (made) {
      pool.fds[s] = fd
      pool.claimed[s] = 0
    } else {
      netClose(fd)
    }
  }
  return pool.live()
}

/** Runs `conn`'s startup on `fd` until it is ready (true) or has failed (false). */
const pgAsyncStartup = async (conn: PgConnection, fd: i32): Promise<boolean> => {
  const connected: boolean = await writable(fd)
  if (pgAsyncWaitFailure(connected) !== 0 || connectResult(fd) !== 0) {
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
        const waited: boolean = await writable(fd)
        if (pgAsyncWaitFailure(waited) !== 0) {
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
    if (event === PG_NEED_MORE) {
      const room: i32 = conn.inputRoom()
      const got: i32 = room > 0 ? netRead(fd, conn.inputBuffer(), conn.inputEnd(), room) : 0
      if (got === PG_ASYNC_AGAIN) {
        const waited: boolean = await readable(fd)
        if (pgAsyncWaitFailure(waited) !== 0) {
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
 * Claims a free connection for the calling task, sleeping while every live
 * one is claimed: 1 ms, then twice as long each time up to 16 ms, for at most
 * `pool.claimWaitMs` in all. A cancelled task claims nothing, so a
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
  let slept: i32 = 0
  let nap: i32 = PG_ASYNC_FIRST_SLEEP_MS
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
      if (toI32(pool.claimed[s]) === 0) {
        pool.claimed[s] = 1
        pool.claims[s] = (pool.claims[s] + 1) % PG_ASYNC_CLAIM_WRAP
        return pool.claims[s] * PG_ASYNC_MAX_SIZE + s
      }
    }
    if (!live) {
      return PG_POOL_NONE
    }
    if (slept >= pool.claimWaitMs) {
      return PG_CARRIER_FULL
    }
    pool.waits += 1
    await sleep(nap)
    slept += nap
    nap = nap * 2 > PG_ASYNC_LONGEST_SLEEP_MS ? PG_ASYNC_LONGEST_SLEEP_MS : nap * 2
  }
}

/**
 * Gives a claimed connection back, or closes it when `reusable` is false; the
 * ticket is spent either way, and a ticket that is not the slot's current
 * claim (a second release, or one after `close()`) panics. It writes only
 * numbers into the pool, so a spawned task may call it.
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
  }
  pool.claimed[slot] = 0
  pool.claims[slot] = (pool.claims[slot] + 1) % PG_ASYNC_CLAIM_WRAP
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
  const out: u8[] | null = pgAsyncEncode(sql, params)
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
  return await pgAsyncRead(fd, pool.maxMessage, pool.maxColumns, pool.maxRows, pool.maxResultBytes)
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

/** Parse, Bind, Execute and Sync for `sql` and `params`, or null for a NUL in the SQL or a parameter. */
const pgAsyncEncode = (sql: string, params: PgAsyncParams): u8[] | null => {
  const sqlBytes = pgAsyncBytes(sql)
  const count: i32 = toI32(params.values.length)
  if (sqlBytes === null || count > 65535) {
    return null
  }
  const values: u8[][] = []
  // The length, "" portal, "" statement, no parameter formats, the count, no
  // result formats: 4 + 1 + 1 + 2 + 2 + 2, held as an i32 in either number mode.
  let bind: i32 = toI32(12)
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
  // The length, "" statement, the SQL and its NUL, no parameter types.
  const parse: i32 = toI32(sqlBytes.length) + toI32(8)
  // Parse, Bind, Execute ("" portal, no row limit: 4 + 1 + 4), Sync (4).
  const total: i32 = 1 + parse + 1 + bind + 1 + 9 + 1 + 4
  const out: u8[] = new Array<u8>(total)
  let at: i32 = 0
  out[at] = 80
  setI32BE(out, at + 1, parse)
  at += 5
  out[at] = 0
  at += 1
  copyBytes(out, at, sqlBytes, 0, toI32(sqlBytes.length))
  at += toI32(sqlBytes.length)
  out[at] = 0
  out[at + 1] = 0
  out[at + 2] = 0
  at += 3
  out[at] = 66
  setI32BE(out, at + 1, bind)
  at += 5
  // The unnamed portal and statement, no parameter format codes (all text).
  out[at] = 0
  out[at + 1] = 0
  out[at + 2] = 0
  out[at + 3] = 0
  setU16BE(out, at + 4, toU16(count))
  at += 6
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
 * its ReadyForQuery, under the caps. The result is made here rather than
 * handed in: the spawn rules read a callee that grows an array it was handed
 * across an `await` as one that may grow the caller's pool.
 */
const pgAsyncRead = async (
  fd: i32,
  maxMessage: i32,
  maxColumns: i32,
  maxRows: i32,
  maxResultBytes: i32
): Promise<PgAsyncResult> => {
  const result = new PgAsyncResult()
  let buf: u8[] = new Array<u8>(PG_ASYNC_INPUT_SIZE)
  let start: i32 = 0
  let end: i32 = 0
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
        // Bytes after it answer no statement this query sent, so the
        // connection is out of step and closed rather than given back.
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
      const grown: u8[] = new Array<u8>(
        toI32(buf.length) * 2 > maxMessage + 1 ? maxMessage + 1 : toI32(buf.length) * 2
      )
      copyBytes(grown, 0, buf, 0, end)
      buf = grown
    }
    const got: i32 = netRead(fd, buf, end, toI32(buf.length) - end)
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

/** An ErrorResponse's SQLSTATE and message in `[at, stop)` into `result`; false for a frame that does not add up. */
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
