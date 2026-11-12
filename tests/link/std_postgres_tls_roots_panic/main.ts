// PG_TLS_VERIFY_FULL with no root certificate to read is a programming
// error: no server could be verified, so the constructor panics rather than
// make a carrier whose every connection fails, or one that verifies nothing.
// docs/security/postgres.md, "Panic sites".
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { PG_TLS_REQUIRE, PG_TLS_VERIFY_FULL, PgConfig, PgPool, pgTarget } from "nish/net/postgres"
import { PgCarrier, PgCarrierLimits } from "nish/net/postgres-carrier"
import { Router, RouterLimits } from "nish/net/router"
import { netLocalPort, tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"

/** A carrier under TLS mode `tls`, its roots read from a file that is not there. */
const make = (tls: i32): PgCarrier => {
  const handler = new HttpHandler(new HandlerLimits(), tcpListen("127.0.0.1", 0, 4), new Router(new RouterLimits()))
  const config = new PgConfig()
  config.user = "app"
  config.tls = tls
  config.tlsRootsPath = "/nonexistent/roots.pem"
  const password = secret(new Array<u8>(2))
  const pool = new PgPool(config, password, 1, 4)
  wipe(password)
  const silent: i32 = tcpListen("127.0.0.1", 0, 4)
  return new PgCarrier(new PgCarrierLimits(), pool, pgTarget("127.0.0.1", netLocalPort(silent)), handler)
}

export const main = (): i32 => {
  make(PG_TLS_REQUIRE)
  console.log("a carrier under require, which reads no roots, made")
  make(PG_TLS_VERIFY_FULL)
  console.log("not reached")
  return 0
}
