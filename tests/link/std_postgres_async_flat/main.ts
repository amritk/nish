// WP49 stage 5: thousands of claimed, awaited and released Postgres queries
// leave `Arena.used()` where it was. Each query runs in a spawned task, which
// has a region of its own that ends with it, so what the claim, the encoded
// statement, the read buffer and the result allocated goes when the task
// does; the task hands back only a number, written into an array `main`
// made. The stand-in backend (../std_postgres_async/server.ts) answers in a
// task too. The arena is read between iterations of one loop in `main`, past
// a warm-up, so no enclosing scope hides a leak.
import { sleep, spawn } from "nish:async"
import { netLocalPort, tcpListen } from "nish:net"
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

const WARM: i32 = 200
const RUNS: i32 = 2000

/** Sets `marks[n]` to 2 when an `echo` of `n` and a NULL came back whole on a reusable connection, else 1. */
async function one(pool: PgAsyncPool, marks: u8[], n: i32): Promise<void> {
  const ticket: i32 = await pgAsyncClaim(pool)
  if (ticket < 0) {
    marks[n] = 1
    return
  }
  const params = new PgAsyncParams()
  params.int(n)
  params.none()
  const r = await pgAsyncQuery(pool, ticket, "echo", params)
  pgAsyncRelease(pool, ticket, r.reusable)
  marks[n] = r.ok() && r.reusable && r.int(0, 0, -1) === n && r.isNull(0, 1) ? 2 : 1
}

export async function main(): Promise<i32> {
  const listen: i32 = tcpListen("127.0.0.1", 0, 16)
  if (listen < 0) {
    return 1
  }
  const port: i32 = netLocalPort(listen)
  const board = new Board()
  spawn(backend(listen, board))
  const pool = new PgAsyncPool(1)
  const config = new PgConfig()
  config.user = "app"
  const pw: u8[] = [112, 119]
  const password = secret(pw)
  const live: i32 = await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", port))
  wipe(password)
  console.log(`connected ${live} of 1`)
  const marks: u8[] = new Array<u8>(WARM + RUNS)
  let ok: i32 = 0
  let used: i64 = 0
  for (let i: i32 = 0; i < WARM + RUNS; i += 1) {
    if (i === WARM) {
      used = Arena.used()
    }
    spawn(one(pool, marks, i))
    while (toI32(marks[i]) === 0) {
      await sleep(0)
    }
    ok += toI32(marks[i]) - 1
  }
  const usedAfter: i64 = Arena.used()
  console.log(`${ok} of ${WARM + RUNS} queries answered whole`)
  console.log(`Arena.used() flat over ${RUNS} queries: ${usedAfter === used}`)
  if (usedAfter !== used) {
    console.log(`  grew by ${usedAfter - used} bytes`)
  }
  pool.close()
  return 0
}
