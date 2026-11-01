// nish/net/postgres-carrier's PgCarrier on an HttpHandler's loop, against a live
// server: it runs `select pg_sleep(...)` through the carrier and serves HTTP
// while the query is in flight, then prints the query's row.
//
//   carrier <pg port> <user> <password> <database> <http port> <seconds>
//
// It prints `listening` once its HTTP port is open and `query sent` once the
// query is handed to a connection. `tests/postgres/live/run.mjs` runs it
// against a live server and requests `/` after the second; the answer says
// whether the query was in flight. A query whose connection fails, refused
// or reset (run.mjs's `refused` and `reset` checks), prints the carrier's
// failure and socket error and exits 1.
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { PgConfig, PgConnection, PgPool, pgTarget } from "nish/net/postgres"
import {
  PG_CARRIER_BUILD,
  PG_CARRIER_DONE,
  PG_CARRIER_FAILED,
  PG_CARRIER_MISSING,
  PG_CARRIER_NONE,
  PG_CARRIER_ROW,
  PgCarrier,
  PgCarrierLimits,
} from "nish/net/postgres-carrier"
import { Router, RouterLimits } from "nish/net/router"
import { tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"

const THIRTY_SECONDS: i64 = 30000000000

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

export const main = (): i32 => {
  if (process.argv.length < 7) {
    console.log("usage: carrier <pg port> <user> <password> <database> <http port> <seconds>")
    return 2
  }
  const config = new PgConfig()
  config.user = process.argv[2]
  config.database = process.argv[4]
  const password = secret(bytesOf(process.argv[3]))
  const pool = new PgPool(config, password, toI32(2), toI32(16))
  wipe(password)
  pool.register("nap", "select 'slept ' || $1 from pg_sleep($1::float8)", [toI32(25)])

  const listener: i32 = tcpListen("127.0.0.1", parseInt(process.argv[5]), toI32(16))
  if (listener < 0) {
    console.log(`listen failed: ${listener}`)
    return 1
  }
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const handler = new HttpHandler(new HandlerLimits(), listener, router)
  const carrier = new PgCarrier(new PgCarrierLimits(), pool, pgTarget("127.0.0.1", parseInt(process.argv[1])), handler)
  console.log("listening")

  const contentType: u8[] = bytesOf("text/plain")
  const inFlight: u8[] = bytesOf("query in flight\n")
  const done: u8[] = bytesOf("query done\n")
  carrier.run(null, toI32(0))
  let napDone: boolean = false
  let served: boolean = false
  const deadline: i64 = monotonicNanos() + THIRTY_SECONDS
  while (monotonicNanos() < deadline) {
    handler.wait(toI32(50))
    while (handler.ready()) {
      const req = handler.take()
      const body: u8[] = napDone ? done : inFlight
      handler.send(req, 200, contentType, body, toI32(0), toI32(body.length))
      if (!served) {
        console.log(napDone ? "http served after the query" : "http served while the query is in flight")
        served = true
      }
    }
    let event: i32 = carrier.next()
    while (event !== PG_CARRIER_NONE) {
      if (event === PG_CARRIER_BUILD) {
        const conn: PgConnection = carrier.connection()
        conn.bindStart("nap")
        conn.paramText(process.argv[6])
        conn.bindEnd()
        carrier.send()
        console.log("query sent")
      } else if (event === PG_CARRIER_ROW) {
        console.log(carrier.connection().columnText(toI32(0)))
      } else if (event === PG_CARRIER_DONE || event === PG_CARRIER_MISSING) {
        napDone = true
      } else if (event === PG_CARRIER_FAILED) {
        console.log(`nap failed: failure ${carrier.failure}, socket ${carrier.socketError}`)
        carrier.close()
        return 1
      }
      event = carrier.next()
    }
    if (napDone && served) {
      carrier.close()
      return 0
    }
  }
  console.log("timed out")
  carrier.close()
  return 1
}
