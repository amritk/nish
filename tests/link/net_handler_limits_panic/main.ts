// The three-argument constructor still panics on limits it cannot use: a
// program that wants an `Err` calls `openHttpHandler`.
import { HandlerLimits, HttpHandler } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import { tcpListen } from "nish:net"

export const main = (): i32 => {
  const limits = new HandlerLimits()
  limits.slots = 0
  const h = new HttpHandler(limits, tcpListen("127.0.0.1", 0, 8), new Router(new RouterLimits()))
  console.log(`FAIL  made a handler on ${h.listener}`)
  return 0
}
