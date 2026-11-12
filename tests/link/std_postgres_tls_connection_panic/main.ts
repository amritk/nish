// A `PgConnection` made by hand with `PgConfig.tls` asking for TLS is a
// programming error: only `PgCarrier` speaks TLS, so the constructor panics
// rather than queue a StartupMessage the program would send in the clear.
// docs/security/postgres.md, "Panic sites".
import { PG_TLS_DISABLE, PG_TLS_VERIFY_FULL, PgConfig, PgConnection } from "nish/net/postgres"
import { secret, wipe } from "nish:secret"

const connect = (tls: i32): PgConnection => {
  const config = new PgConfig()
  config.user = "app"
  config.tls = tls
  const password = secret(new Array<u8>(2))
  const conn = new PgConnection(config, password, new Array<u8>(18))
  wipe(password)
  return conn
}

export const main = (): i32 => {
  console.log(`a connection without TLS ${connect(PG_TLS_DISABLE).outputEnd() > 0 ? "queued its startup" : "is empty"}`)
  connect(PG_TLS_VERIFY_FULL)
  console.log("not reached")
  return 0
}
