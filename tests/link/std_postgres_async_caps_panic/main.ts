// A PgAsyncPool cap out of its range is a programming error, as a PgConfig
// cap is: the query panics before it touches the socket. Here `maxMessage`
// is under its least, 1024. The ticket is claimed on a pool with a
// connection (a listening socket stands in for it), so the cap check is the
// only panic this query can reach: without it the query fails on the socket
// and "not reached" prints. docs/security/postgres.md, "Panic sites".
import { tcpListen } from "nish:net"
import { PgAsyncParams, PgAsyncPool, pgAsyncClaim, pgAsyncQuery } from "nish/net/postgres-async"

export async function main(): Promise<i32> {
  const pool = new PgAsyncPool(1)
  pool.fds[0] = tcpListen("127.0.0.1", 0, 1)
  const ticket: i32 = await pgAsyncClaim(pool)
  pool.maxMessage = 1023
  console.log(`claimed ${ticket}, maxMessage ${pool.maxMessage}`)
  const r = await pgAsyncQuery(pool, ticket, "SELECT 1", new PgAsyncParams())
  console.log(`not reached ${r.rows}`)
  return 0
}
