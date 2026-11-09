// pgAsyncRelease with a ticket that is not a slot's current claim is a
// programming error: it panics rather than give back a connection another
// task may hold. docs/security/postgres.md, "Panic sites".
import { PgAsyncPool, pgAsyncRelease } from "nish/net/postgres-async"

export const main = (): i32 => {
  const pool = new PgAsyncPool(1)
  console.log(`live ${pool.live()} of ${pool.size}`)
  pgAsyncRelease(pool, 0, true)
  console.log("not reached")
  return 0
}
