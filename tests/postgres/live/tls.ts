// nish/net/postgres-carrier's TLS against a live server: one query through a
// PgCarrier whose PgConfig asks for TLS, printing what the server's
// pg_stat_ssl says of the connection it ran on.
//
//   tls <pg port> <user> <password> <database> <mode> <roots file> <server name>
//
// `mode` is disable, require or verify-full (`PgConfig.tls`); the roots file
// and server name are `PgConfig.tlsRootsPath` and `tlsServerName`, `-` for
// none. A query that runs prints `ssl <true|false> <protocol|none>` and exits
// 0; a failed one prints the carrier's failure and socket error and exits 1.
// `tests/postgres/live/run.mjs`'s `tls` check runs it.
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { PG_TLS_DISABLE, PG_TLS_REQUIRE, PG_TLS_VERIFY_FULL, PgConfig, PgPool, pgTarget } from "nish/net/postgres"
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

const modeOf = (s: string): i32 => {
  if (s === "require") {
    return PG_TLS_REQUIRE
  }
  if (s === "verify-full") {
    return PG_TLS_VERIFY_FULL
  }
  return PG_TLS_DISABLE
}

export const main = (): i32 => {
  if (process.argv.length < 8) {
    console.log("usage: tls <pg port> <user> <password> <database> <mode> <roots file> <server name>")
    return 2
  }
  const config = new PgConfig()
  config.user = process.argv[2]
  config.database = process.argv[4]
  config.tls = modeOf(process.argv[5])
  config.tlsRootsPath = process.argv[6] === "-" ? "" : process.argv[6]
  config.tlsServerName = process.argv[7] === "-" ? "" : process.argv[7]
  const password = secret(bytesOf(process.argv[3]))
  const pool = new PgPool(config, password, toI32(1), toI32(4))
  wipe(password)
  const types: i32[] = []
  pool.register(
    "ssl",
    "select 'ssl ' || ssl::text || ' ' || coalesce(version, 'none') from pg_stat_ssl where pid = pg_backend_pid()",
    types,
  )

  // The carrier turns on an HttpHandler's loop; nothing connects to this one.
  const listener: i32 = tcpListen("127.0.0.1", toI32(0), toI32(1))
  if (listener < 0) {
    console.log(`listen failed: ${listener}`)
    return 1
  }
  const handler = new HttpHandler(new HandlerLimits(), listener, new Router(new RouterLimits()))
  const carrier = new PgCarrier(new PgCarrierLimits(), pool, pgTarget("127.0.0.1", parseInt(process.argv[1])), handler)
  carrier.run(null, toI32(0))
  let status: i32 = 1
  let finished: boolean = false
  const deadline: i64 = monotonicNanos() + THIRTY_SECONDS
  while (!finished && monotonicNanos() < deadline) {
    handler.wait(toI32(50))
    let event: i32 = carrier.next()
    while (event !== PG_CARRIER_NONE) {
      if (event === PG_CARRIER_BUILD) {
        carrier.connection().bindStart("ssl")
        carrier.connection().bindEnd()
        carrier.send()
      } else if (event === PG_CARRIER_ROW) {
        console.log(carrier.connection().columnText(toI32(0)))
      } else if (event === PG_CARRIER_DONE || event === PG_CARRIER_MISSING) {
        status = 0
        finished = true
      } else if (event === PG_CARRIER_FAILED) {
        console.log(`failed: failure ${carrier.failure}, socket ${carrier.socketError}`)
        finished = true
      }
      event = carrier.next()
    }
  }
  if (!finished) {
    console.log("timed out")
  }
  carrier.close()
  pool.dispose()
  return status
}
