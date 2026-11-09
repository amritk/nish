// `PgAsyncPool` over loopback: spawned tasks claim, query and release
// connections to a stand-in backend (./server.ts) in the same process.
//
//   1. Overlap: a pool of two; task A's `hold` is answered only once tasks B
//      and C have both finished, and C has to wait for the connection B gives
//      back. A was in flight the whole time, so the order B, C, A proves the
//      tasks overlapped, with no clock read.
//   2. One task, in sequence: parameters in text with a NULL, a statement the
//      server refuses (the connection is reused), rows past `maxRows`, then
//      a NUL in a parameter (refused before anything is sent, so the
//      connection is reused), a transaction left open and a session setting
//      changed, each of which closes its connection, so no later task inherits it; with none left,
//      a claim answers PG_POOL_NONE.
//   3. Loss: after a reconnect, a connection that ends under a query fails
//      it with PG_ERR_CLOSED and is closed; the other is still served.
import { sleep, spawn } from "nish:async"
import { netLocalPort, tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"
import { PgConfig, pgTarget } from "nish/net/postgres"
import {
  PgAsyncParams,
  PgAsyncPool,
  PgAsyncResult,
  pgAsyncClaim,
  pgAsyncConnect,
  pgAsyncQuery,
  pgAsyncRelease,
} from "nish/net/postgres-async"
import { Board, backend } from "./server"

/** A line describing `r`. */
const describe = (label: string, r: PgAsyncResult): string => {
  const first: string = r.rows > 0 && r.columns > 0 ? ` first=${r.text(0, 0)}` : ""
  return `${label}: ok=${r.ok()} failure=${r.failure} socket=${r.socketError} rows=${r.rows} tag=${r.tag} reusable=${r.reusable}${first}`
}

/** Claims, runs `sql` with no parameters, releases, prints, and counts itself done. */
async function client(pool: PgAsyncPool, board: Board, sql: string, label: string): Promise<void> {
  const ticket: i32 = await pgAsyncClaim(pool)
  if (ticket < 0) {
    console.log(`${label}: no connection (${ticket})`)
    board.done += 1
    return
  }
  const r = await pgAsyncQuery(pool, ticket, sql, new PgAsyncParams())
  pgAsyncRelease(pool, ticket, r.reusable)
  console.log(describe(label, r))
  board.done += 1
}

/** Section 2, one statement after another on whichever connection is free. */
async function checks(pool: PgAsyncPool, board: Board): Promise<void> {
  let ticket: i32 = await pgAsyncClaim(pool)
  const params = new PgAsyncParams()
  params.text("héllo")
  params.int(-7)
  params.none()
  let r = await pgAsyncQuery(pool, ticket, "echo", params)
  pgAsyncRelease(pool, ticket, r.reusable)
  console.log(describe("echo", r))
  console.log(`echo cells: ${r.columns} ${r.text(0, 0)} ${r.int(0, 1, 0)} null=${r.isNull(0, 2)} ${r.isNull(0, 0)}`)

  ticket = await pgAsyncClaim(pool)
  r = await pgAsyncQuery(pool, ticket, "bad", new PgAsyncParams())
  pgAsyncRelease(pool, ticket, r.reusable)
  console.log(describe("bad", r))
  console.log(`bad error: ${r.errorCode} ${r.errorMessage}`)

  ticket = await pgAsyncClaim(pool)
  const nul = new PgAsyncParams()
  nul.text("a\u0000b")
  r = await pgAsyncQuery(pool, ticket, "echo", nul)
  pgAsyncRelease(pool, ticket, r.reusable)
  console.log(describe("nul", r))

  pool.maxRows = 3
  ticket = await pgAsyncClaim(pool)
  r = await pgAsyncQuery(pool, ticket, "many", new PgAsyncParams())
  pgAsyncRelease(pool, ticket, r.reusable)
  pool.maxRows = 100000
  console.log(describe("many", r))

  ticket = await pgAsyncClaim(pool)
  r = await pgAsyncQuery(pool, ticket, "begin", new PgAsyncParams())
  pgAsyncRelease(pool, ticket, r.reusable)
  console.log(describe("begin", r))
  console.log(`live after begin: ${pool.live()}`)

  ticket = await pgAsyncClaim(pool)
  r = await pgAsyncQuery(pool, ticket, "set", new PgAsyncParams())
  pgAsyncRelease(pool, ticket, r.reusable)
  console.log(describe("set", r))
  console.log(`live after set: ${pool.live()}`)

  ticket = await pgAsyncClaim(pool)
  console.log(`claim with none live: ${ticket}`)
  board.done += 1
}

/** Spawns two backends on `listen` and fills `pool` from them. */
async function fill(pool: PgAsyncPool, board: Board, listen: i32, port: i32): Promise<i32> {
  spawn(backend(listen, board))
  spawn(backend(listen, board))
  const config = new PgConfig()
  config.user = "app"
  const pw: u8[] = [112, 119]
  const password = secret(pw)
  const live: i32 = await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", port))
  wipe(password)
  return live
}

export async function main(): Promise<i32> {
  const listen: i32 = tcpListen("127.0.0.1", 0, 16)
  if (listen < 0) {
    return 1
  }
  const port: i32 = netLocalPort(listen)
  const board = new Board()
  const pool = new PgAsyncPool(2)
  let live: i32 = await fill(pool, board, listen, port)
  console.log(`connected ${live} of 2`)

  spawn(client(pool, board, "hold", "A"))
  spawn(client(pool, board, "quick", "B"))
  spawn(client(pool, board, "quick", "C"))
  while (board.done < 3) {
    await sleep(1)
  }
  console.log(`a claim slept while both were held: ${pool.waits > 0}`)

  spawn(checks(pool, board))
  while (board.done < 4) {
    await sleep(1)
  }
  console.log(`dropped ${pool.dropped}`)

  live = await fill(pool, board, listen, port)
  console.log(`connected ${live} of 2`)
  spawn(client(pool, board, "die", "D"))
  while (board.done < 5) {
    await sleep(1)
  }
  console.log(`live after die: ${pool.live()}`)
  spawn(client(pool, board, "quick", "E"))
  while (board.done < 6) {
    await sleep(1)
  }
  console.log(`statements seen: ${board.seen}`)
  pool.close()
  return 0
}
