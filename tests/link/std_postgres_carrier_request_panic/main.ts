// PgCarrier.request before any event named a query is a programming error:
// it panics rather than hand back a request for no query. A query is run
// first, and no event read, so the panic is for the missing event.
// docs/security/postgres.md, "Panic sites".
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { PgConfig, PgPool, pgTarget } from "nish/net/postgres"
import { PgCarrier, PgCarrierLimits } from "nish/net/postgres-carrier"
import { Router, RouterLimits } from "nish/net/router"
import { netLocalPort, tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"

/** A carrier with `limits` on a handler of its own, to a listener that never accepts. */
const make = (limits: PgCarrierLimits): PgCarrier => {
  const handler = new HttpHandler(new HandlerLimits(), tcpListen("127.0.0.1", 0, 4), new Router(new RouterLimits()))
  const config = new PgConfig()
  config.user = "app"
  const password = secret(new Array<u8>(2))
  const pool = new PgPool(config, password, 1, 4)
  wipe(password)
  const silent: i32 = tcpListen("127.0.0.1", 0, 4)
  return new PgCarrier(limits, pool, pgTarget("127.0.0.1", netLocalPort(silent)), handler)
}

export const main = (): i32 => {
  const carrier = make(new PgCarrierLimits())
  console.log(`query ${carrier.run(null, 0)} run, no event read`)
  carrier.request()
  console.log("not reached")
  return 0
}
