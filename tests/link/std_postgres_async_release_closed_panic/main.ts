// Releasing a ticket after the pool's `close()` is a programming error:
// `close()` spends every ticket, so the release panics. A listening socket
// stands in for the connection, which is never queried.
// docs/security/postgres.md, "Panic sites".
import { tcpListen } from "nish:net"
import { PgAsyncPool, pgAsyncClaim, pgAsyncRelease } from "nish/net/postgres-async"

export async function main(): Promise<i32> {
  const pool = new PgAsyncPool(1)
  pool.fds[0] = tcpListen("127.0.0.1", 0, 1)
  const ticket: i32 = await pgAsyncClaim(pool)
  pool.close()
  console.log(`claimed ${ticket}, closed, live ${pool.live()}`)
  pgAsyncRelease(pool, ticket, true)
  console.log("not reached")
  return 0
}
