// PgCarrier.next while a PG_CARRIER_BUILD is unsent is a programming error:
// it panics rather than hand out a second build on the same connection.
// docs/security/postgres.md, "Panic sites".
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { PgConfig, PgPool, pgTarget } from "nish/net/postgres"
import { PG_CARRIER_BUILD, PG_CARRIER_NONE, PgCarrier, PgCarrierLimits } from "nish/net/postgres-carrier"
import { Router, RouterLimits } from "nish/net/router"
import { netLocalPort, netWrite, tcpAccept, tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"

const FIVE_SECONDS: i64 = 5000000000

/** A carrier with `limits` on `handler`, to the server listening on `server`. */
const make = (limits: PgCarrierLimits, handler: HttpHandler, server: i32): PgCarrier => {
  const config = new PgConfig()
  config.user = "app"
  const password = secret(new Array<u8>(2))
  const pool = new PgPool(config, password, 1, 4)
  wipe(password)
  return new PgCarrier(limits, pool, pgTarget("127.0.0.1", netLocalPort(server)), handler)
}

/** AuthenticationOk, then ReadyForQuery: what a trust server answers a startup with. */
const READY: string = "R\u0000\u0000\u0000\u0008\u0000\u0000\u0000\u0000Z\u0000\u0000\u0000\u0005I"

/**
 * Reads `carrier` until it hands out a build, for five seconds at most,
 * answering the startup of the connection `server` accepts.
 */
const build = (carrier: PgCarrier, handler: HttpHandler, server: i32): boolean => {
  const deadline: i64 = monotonicNanos() + FIVE_SECONDS
  const peer: u8[] = new Array<u8>(32)
  const ready: u8[] = new Array<u8>(READY.length)
  for (let k: i32 = 0; k < toI32(ready.length) && k < toI32(READY.length); k++) {
    ready[k] = toU8(READY.charCodeAt(k))
  }
  let fd: i32 = -1
  while (monotonicNanos() < deadline) {
    if (fd < 0) {
      fd = tcpAccept(server, peer)
      if (fd >= 0) {
        netWrite(fd, ready, 0, toI32(ready.length))
      }
    }
    handler.wait(1)
    let event: i32 = carrier.next()
    while (event !== PG_CARRIER_NONE) {
      if (event === PG_CARRIER_BUILD) {
        return true
      }
      event = carrier.next()
    }
  }
  return false
}

export const main = (): i32 => {
  const handler = new HttpHandler(new HandlerLimits(), tcpListen("127.0.0.1", 0, 4), new Router(new RouterLimits()))
  const server: i32 = tcpListen("127.0.0.1", 0, 4)
  const carrier = make(new PgCarrierLimits(), handler, server)
  carrier.run(null, 0)
  console.log(`a build ${build(carrier, handler, server) ? "open" : "never handed out"}`)
  carrier.next()
  console.log("not reached")
  return 0
}
