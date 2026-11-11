// pgAsyncDone with a ticket that is not a current seat is a programming
// error: it panics rather than free a place another task may hold.
// docs/security/postgres.md, "Panic sites".
import { PgAsyncPool, pgAsyncDone } from "nish/net/postgres-async"

export const main = (): i32 => {
  const pool = new PgAsyncPool(1)
  console.log(`live ${pool.live()} of ${pool.size}`)
  pgAsyncDone(pool, 0, 0, true)
  console.log("not reached")
  return 0
}
