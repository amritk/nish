// A handler handed a failed `pollCreate` (any negative but -1) has no loop:
// its constructor does not panic, and each `wait` answers `HANDLER_NO_LOOP`
// at once, without blocking or queueing, so a caller stops instead of
// spinning on a turn that can never see a socket.
import { HANDLER_NO_LOOP, HandlerLimits, HttpHandler } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import { netClose, tcpListen } from "nish:net"

export const main = (): i32 => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  const listener: i32 = tcpListen("127.0.0.1", 0, 8)
  const h = new HttpHandler(new HandlerLimits(), listener, router, -2)
  // Without the dead-loop guard, `wait` polls loop -2, which fails at once,
  // and answers 0, so the case fails on `first: 0` rather than hanging.
  const first: i32 = h.wait(-1)
  const second: i32 = h.wait(1000)
  console.log(`first: ${first === HANDLER_NO_LOOP ? "HANDLER_NO_LOOP" : `${first}`}`)
  console.log(`second: ${second === HANDLER_NO_LOOP ? "HANDLER_NO_LOOP" : `${second}`}`)
  console.log(`queued: ${h.next() === null ? "none" : "some"}`)
  // A dead handler watches nothing, so `tryWatch` refuses instead of
  // answering `Ok(true)`.
  console.log(`tryWatch: ${h.tryWatch(listener, 0).ok ? "Ok" : "Err"}`)
  netClose(listener)
  return 0
}
