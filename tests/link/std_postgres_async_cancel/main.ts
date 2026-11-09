// A task holding a `PgAsyncPool` connection is cancelled
// (docs/security/postgres.md, PG-37), against the stand-in backend of
// ../std_postgres_async/server.ts:
//
//   1. Mid-query: a task claims a connection and queries `hold`, which the
//      backend does not answer yet. `cancel` fails the query's wait at once:
//      PG_ERR_CLOSED, socketError PG_ASYNC_CANCELLED and `reusable` false, so
//      its release closes the connection, whose answer is still owed.
//   2. The other connection still serves a query.
//   3. While claiming: a task claims the one live connection and then claims
//      again, sleeping while it is held; a `cancelAfter` deadline of 50 ms
//      ends the wait, the second claim answers PG_ASYNC_CANCELLED, and the
//      first ticket is given back still reusable.
//   4. A task cancelled before it claims takes nothing: its claim answers
//      PG_ASYNC_CANCELLED, and the pool serves the next task.
import { cancel, cancelAfter, cancelled, readable, sleep, spawn, taskId } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { secret, wipe } from "nish:secret"
import { PgConfig, pgTarget } from "nish/net/postgres"
import {
  PgAsyncParams,
  PgAsyncPool,
  pgAsyncClaim,
  pgAsyncConnect,
  pgAsyncQuery,
  pgAsyncRelease,
} from "nish/net/postgres-async"
import { Board, backend } from "../std_postgres_async/server"

/** Each task's handle, for `main` to cancel. */
class Handles {
  hold: i64 = 0
}

/** Sleeps `delay` ms, claims, queries `sql`, releases and prints what it answered. */
async function query(pool: PgAsyncPool, handles: Handles, sql: string, delay: i32, fd: i32): Promise<void> {
  handles.hold = taskId()
  if (delay > 0) {
    const slept: boolean = await sleep(delay)
    console.log(`${sql}: slept ${slept}`)
  }
  const ticket: i32 = await pgAsyncClaim(pool)
  if (ticket < 0) {
    console.log(`${sql}: claim ${ticket}, cancelled ${cancelled()}`)
  } else {
    const r = await pgAsyncQuery(pool, ticket, sql, new PgAsyncParams())
    pgAsyncRelease(pool, ticket, r.reusable)
    const cell: string = r.rows > 0 ? r.text(0, 0) : "-"
    console.log(`${sql}: ok=${r.ok()} failure=${r.failure} socket=${r.socketError} reusable=${r.reusable} cell=${cell} cancelled=${cancelled()}`)
  }
  const one: u8[] = [1]
  netWrite(fd, one, 0, 1)
}

/** Claims twice with a deadline armed, so the second claim is cut off. */
async function greedy(pool: PgAsyncPool, fd: i32): Promise<void> {
  cancelAfter(taskId(), 50)
  const held: i32 = await pgAsyncClaim(pool)
  const second: i32 = await pgAsyncClaim(pool)
  pgAsyncRelease(pool, held, true)
  console.log(`greedy: first ${held >= 0}, second ${second}, cancelled ${cancelled()}`)
  const one: u8[] = [1]
  netWrite(fd, one, 0, 1)
}

/** Waits for one byte on `fd`: a task said it finished. */
async function finished(fd: i32): Promise<void> {
  await readable(fd)
  const got: u8[] = [0]
  netRead(fd, got, 0, 1)
}

export async function main(): Promise<i32> {
  const listen: i32 = tcpListen("127.0.0.1", 0, 16)
  const board = new Board()
  spawn(backend(listen, board))
  spawn(backend(listen, board))
  const config = new PgConfig()
  config.user = "app"
  const pw: u8[] = [112, 119]
  const password = secret(pw)
  const pool = new PgAsyncPool(2)
  pool.claimWaitMs = 10000
  const live: i32 = await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", netLocalPort(listen)))
  wipe(password)
  console.log(`connected: ${live}`)
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  const handles = new Handles()

  // 1. Cancel a task while its query waits for the answer.
  spawn(query(pool, handles, "hold", 0, fds[1]))
  await sleep(30)
  console.log(`cancel: ${cancel(handles.hold)}`)
  await finished(fds[0])
  // The backend that still owes `hold` its answer may finish now.
  board.done = 2
  console.log(`dropped: ${pool.dropped}`)

  // 2. The other connection is unharmed.
  spawn(query(pool, handles, "quick", 0, fds[1]))
  await finished(fds[0])

  // 3. A deadline cuts off a claim that waits for the one live connection.
  spawn(greedy(pool, fds[1]))
  await finished(fds[0])

  // 4. Cancelled before it claims: it takes nothing, then the pool still serves.
  spawn(query(pool, handles, "quick", 10000, fds[1]))
  console.log(`cancel: ${cancel(handles.hold)}`)
  await finished(fds[0])
  spawn(query(pool, handles, "quick", 0, fds[1]))
  await finished(fds[0])
  console.log(`dropped: ${pool.dropped}, claimed: ${pool.claimed[0]} ${pool.claimed[1]}`)
  pool.close()
  netClose(fds[0])
  netClose(fds[1])
  netClose(listen)
  return 0
}
