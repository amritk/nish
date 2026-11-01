// Releasing a call twice is the program's bug: it panics rather than let two
// calls share a slot, which would hand one request's answer to another.
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import { Upstream, UpstreamLimits } from "nish/net/upstream"
import { tcpListen } from "nish:net"

export const main = (): i32 => {
  const router = new Router(new RouterLimits())
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const h = new HttpHandler(new HandlerLimits(), listener, router)
  // An unusable origin ends each call at once, with no socket.
  const u = new Upstream(h, "https://127.0.0.1/", new UpstreamLimits())
  u.get(new HttpRequest(-1), "/")
  const r = u.take()
  u.release(r)
  u.release(r)
  console.log("FAIL  a call was released twice")
  return 0
}
