// `HandlerLimits.minEvents` and `maxWaitMs` (WP63, ring batch waits):
// `openHttpHandler` answers a `minEvents` under 1, a negative `maxWaitMs` and
// one over a second with an `Err`, never a panic, and opens a handler at each
// bound (1 event, 0 ms and 1,000 ms).
import { HandlerLimits, HttpHandler, openHttpHandler } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import { netClose, tcpListen } from "nish:net"

/** Opens a handler with `minEvents` and `maxWaitMs` set and prints what it answered. */
const open = (listener: i32, router: Router, minEvents: i32, maxWaitMs: i32): void => {
  const limits = new HandlerLimits()
  limits.minEvents = minEvents
  limits.maxWaitMs = maxWaitMs
  const r: Result<HttpHandler, string> = openHttpHandler(limits, listener, router)
  if (r.isErr()) {
    console.log(`refused ${minEvents}/${maxWaitMs}: ${r.error}`)
  } else {
    console.log(`opened ${minEvents}/${maxWaitMs}`)
  }
}

export const main = (): i32 => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const listener: i32 = tcpListen("127.0.0.1", 0, 8)
  open(listener, router, 0, 1)
  open(listener, router, -5, 1)
  open(listener, router, 64, -1)
  open(listener, router, 64, 1001)
  open(listener, router, 1, 0)
  open(listener, router, 64, 1000)
  netClose(listener)
  return 0
}
