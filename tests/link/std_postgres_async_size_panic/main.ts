// A PgAsyncPool of more than 64 connections is a programming error: the
// constructor panics rather than allocate them. docs/security/postgres.md,
// "Panic sites".
import { PgAsyncPool } from "nish/net/postgres-async"

export const main = (): i32 => {
  console.log(`a pool of ${new PgAsyncPool(64).size} made`)
  const pool = new PgAsyncPool(65)
  console.log(`not reached ${pool.size}`)
  return 0
}
