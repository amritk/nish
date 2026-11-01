// PgCarrier.connection before any event named one is a programming error:
// it panics rather than hand back a connection no query is on.
// docs/security/postgres.md, "Panic sites".
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { PgBatchConfig, PgBatcher, PgConfig, PgPool, pgTarget } from "nish/net/postgres"
import { PG_CARRIER_BUILD, PG_CARRIER_NONE, PgCarrier, PgCarrierLimits } from "nish/net/postgres-carrier"
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

const batcher = (name: string): PgBatcher => {
  const config = new PgBatchConfig()
  config.name = name
  config.select = "select 1"
  return new PgBatcher(config)
}

export const main = (): i32 => {
  const carrier = make(new PgCarrierLimits())
  console.log(`query ${carrier.run(null, 0)} run`)
  carrier.connection()
  console.log("not reached")
  return 0
}
