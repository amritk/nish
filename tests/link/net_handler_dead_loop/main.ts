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
  // A dead loop's `wait(-1)` must return, not block for a socket: a block
  // here hangs the case past its timeout.
  const first: i32 = h.wait(-1)
  const second: i32 = h.wait(1000)
  console.log(`first: ${first === HANDLER_NO_LOOP ? "HANDLER_NO_LOOP" : `${first}`}`)
  console.log(`second: ${second === HANDLER_NO_LOOP ? "HANDLER_NO_LOOP" : `${second}`}`)
  console.log(`queued: ${h.next() === null ? "none" : "some"}`)
  netClose(listener)
  return 0
}
