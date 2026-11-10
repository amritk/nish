// A `nish/net/serve` handler awaiting `nish/net/postgres-async`'s pool against
// a live server: the handler arrow captures the pool and a tally `main` owns,
// claims a connection, runs `select $1::int * 2` and answers the row's text.
//
//   serve-pool <pg port> <user> <password> <database> <http port>
//
// It prints `listening` once its HTTP port is open, answers three requests
// (`tests/postgres/live/run.mjs`'s `servepool` check asks `/double/21`, then
// `/double/x`, which the server refuses, then a route with no handler) and
// then prints the tally and exits 0.
import { tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"
import { PgConfig, pgTarget } from "nish/net/postgres"
import { PgAsyncParams, PgAsyncPool, pgAsyncClaim, pgAsyncConnect, pgAsyncQuery, pgAsyncRelease } from "nish/net/postgres-async"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** What the handler counts; `main` owns it and reads it once the server ends. */
class Tally {
  served: i32 = 0
  failed: i32 = 0
}

export async function main(): Promise<i32> {
  if (process.argv.length < 6) {
    console.log("usage: serve-pool <pg port> <user> <password> <database> <http port>")
    return 2
  }
  const config = new PgConfig()
  config.user = process.argv[2]
  config.database = process.argv[4]
  const password = secret(bytesOf(process.argv[3]))
  const pool = new PgAsyncPool(2)
  const live: i32 = await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", parseInt(process.argv[1])))
  wipe(password)
  if (live <= 0) {
    console.log(`connect failed: ${live}`)
    return 1
  }
  const listener: i32 = tcpListen("127.0.0.1", parseInt(process.argv[5]), toI32(16))
  if (listener < 0) {
    console.log(`listen failed: ${listener}`)
    return 1
  }
  const router = new Router(new RouterLimits())
  router.add("GET", "/double/:n")
  const limits = new ServeLimits()
  limits.maxRequests = 3
  const stats = new ServeStats()
  const tally = new Tally()
  console.log("listening")
  const done: i32 = await serveOn(
    listener,
    router,
    limits,
    async (req: Request): Promise<Response> => {
      if (req.route !== 0) {
        return refuse(req)
      }
      const ticket: i32 = await pgAsyncClaim(pool)
      if (ticket < 0) {
        return new Response(503).text("no connection\n")
      }
      const params = new PgAsyncParams()
      params.text(req.param(0))
      const r = await pgAsyncQuery(pool, ticket, "select $1::int * 2", params)
      pgAsyncRelease(pool, ticket, r.reusable)
      if (!r.ok() || r.rows === 0) {
        tally.failed += 1
        return new Response(400).text(`refused: ${r.errorCode}\n`)
      }
      tally.served += 1
      return new Response(200).text(`${r.text(0, 0)}\n`)
    },
    stats,
  )
  pool.close()
  console.log(`serve ${done}: answered ${stats.answered}, served ${tally.served}, refused ${tally.failed}`)
  return 0
}
