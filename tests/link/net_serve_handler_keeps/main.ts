// A handler that hands its `Request` to a task of its own keeps the lent
// head past its task's end, when the server parses the connection's next
// request into it: `serveOn` refuses the handler where `serveTask`
// instantiates it (NL2822).

import { sleep, spawn } from "nish:async"
import { tcpListen } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, serveOn } from "nish/net/serve"

async function peek(req: Request): Promise<void> {
  await sleep(10)
  console.log(req.path())
}

async function handle(req: Request): Promise<Response> {
  spawn(peek(req))
  return new Response(200).text("ok")
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/")
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  return await serveOn(listener, router, new ServeLimits(), handle, new ServeStats())
}
