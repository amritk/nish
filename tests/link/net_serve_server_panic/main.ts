// A `ServeLimits.server` holding a control byte is a programming error: CR and
// LF would end the field and let it add another, so `serveOn` panics as it
// starts, before it accepts a connection. docs/security/serve.md, SERVE-15.
import { netClose, tcpListen } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, serveOn } from "nish/net/serve"

// biome-ignore lint/suspicious/useAwait: `serveOn` takes an async handler, and this answer waits on nothing
async function answer(_req: Request): Promise<Response> {
  return new Response(204)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = 1
  limits.server = "nish\r\nx-injected: 1"
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  console.log("listening")
  const done: i32 = await serveOn(listener, router, limits, answer, new ServeStats())
  console.log(`not reached ${done}`)
  netClose(listener)
  return 0
}
