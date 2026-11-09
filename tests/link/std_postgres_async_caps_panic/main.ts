// A PgAsyncPool cap out of its range is a programming error, as a PgConfig
// cap is: the query panics before it touches the ticket or the socket. Here
// `maxMessage` is under its least, 1024. docs/security/postgres.md,
// "Panic sites".
import { PgAsyncParams, PgAsyncPool, pgAsyncQuery } from "nish/net/postgres-async"

export async function main(): Promise<i32> {
  const pool = new PgAsyncPool(1)
  pool.maxMessage = 1023
  console.log(`maxMessage ${pool.maxMessage}`)
  const r = await pgAsyncQuery(pool, 0, "SELECT 1", new PgAsyncParams())
  console.log(`not reached ${r.rows}`)
  return 0
}
