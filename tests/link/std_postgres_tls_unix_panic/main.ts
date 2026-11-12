// TLS asked for on a Unix socket is a programming error: PostgreSQL answers
// an SSLRequest there, but a local socket has no name to verify, and libpq
// never sends one. The constructor panics rather than connect in the clear
// or carry a check that cannot mean anything. docs/security/postgres.md,
// "Panic sites".
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { PG_TLS_DISABLE, PG_TLS_REQUIRE, PgConfig, PgPool, pgTarget } from "nish/net/postgres"
import { PgCarrier, PgCarrierLimits } from "nish/net/postgres-carrier"
import { Router, RouterLimits } from "nish/net/router"
import { tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"

/** A carrier under TLS mode `tls` to a Unix socket nothing listens on. */
const make = (tls: i32): PgCarrier => {
  const handler = new HttpHandler(new HandlerLimits(), tcpListen("127.0.0.1", 0, 4), new Router(new RouterLimits()))
  const config = new PgConfig()
  config.user = "app"
  config.tls = tls
  const password = secret(new Array<u8>(2))
  const pool = new PgPool(config, password, 1, 4)
  wipe(password)
  return new PgCarrier(new PgCarrierLimits(), pool, pgTarget("/nonexistent", 5432), handler)
}

export const main = (): i32 => {
  make(PG_TLS_DISABLE)
  console.log("a carrier without TLS to a Unix socket made")
  make(PG_TLS_REQUIRE)
  console.log("not reached")
  return 0
}
