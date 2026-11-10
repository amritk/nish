// pgAsyncSeat on a pool whose `depth` is outside 1..16 is a programming
// error: it panics rather than seat past a connection's order.
// docs/security/postgres.md, "Panic sites".
import { PgAsyncPool, pgAsyncPrepare, pgAsyncSeat } from "nish/net/postgres-async"

export const main = async (): Promise<i32> => {
  const pool = new PgAsyncPool(1)
  const statement: i32 = pgAsyncPrepare(pool, "select 1")
  pool.depth = 17
  console.log(`depth ${pool.depth}`)
  const ticket: i32 = await pgAsyncSeat(pool, statement)
  console.log(`not reached ${ticket}`)
  return 0
}
