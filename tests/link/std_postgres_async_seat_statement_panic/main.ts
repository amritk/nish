// pgAsyncSeat with a statement number pgAsyncPrepare never answered is a
// programming error: it panics rather than seat a task on no SQL.
// docs/security/postgres.md, "Panic sites".
import { PgAsyncPool, pgAsyncPrepare, pgAsyncSeat } from "nish/net/postgres-async"

export const main = async (): Promise<i32> => {
  const pool = new PgAsyncPool(1)
  const statement: i32 = pgAsyncPrepare(pool, "select 1")
  console.log(`statement ${statement}`)
  const ticket: i32 = await pgAsyncSeat(pool, statement + 1)
  console.log(`not reached ${ticket}`)
  return 0
}
