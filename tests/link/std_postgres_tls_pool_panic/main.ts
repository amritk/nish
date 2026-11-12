// A `PgPool` whose `PgConfig.tls` asks for TLS, driven by hand rather than
// by a `PgCarrier`, is a programming error: only the carrier speaks TLS, so
// `connect` panics rather than make a connection that would run in the
// clear. docs/security/postgres.md, "Panic sites".
import { PG_TLS_DISABLE, PG_TLS_REQUIRE, PgConfig, PgPool } from "nish/net/postgres"
import { secret, wipe } from "nish:secret"

/** Makes the first connection of a hand-driven pool under TLS mode `tls`. */
const connect = (tls: i32): void => {
  const config = new PgConfig()
  config.user = "app"
  config.tls = tls
  const password = secret(new Array<u8>(2))
  const pool = new PgPool(config, password, 1, 4)
  wipe(password)
  pool.request()
  pool.dispatch()
  pool.connect(pool.wanted(), new Array<u8>(18))
}

export const main = (): i32 => {
  connect(PG_TLS_DISABLE)
  console.log("a hand-driven pool without TLS connected")
  connect(PG_TLS_REQUIRE)
  console.log("not reached")
  return 0
}
