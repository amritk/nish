// A client hangs up while its request's task is parked on a long `sleep`
// (SERVE-8): the server cancels the task, so the await answers false at
// once, the handler's code after it runs, its `using` arena is released and
// the task ends, which `serveOn` waits for before it returns. The server's
// other connections go on, and `Arena.used()` in the server's loop is the
// same after the cancelled answer as after the next. `async_cancel`'s probe pins
// the executor's task and timer counts.
import { cancelled, readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    return new Response(200).text("hello")
  }
  if (req.route === 1) {
    {
      // Released when the block ends, whether the awaits in it succeed or fail.
      using a = arena()
      const slept: boolean = await sleep(10000)
      console.log(`after the await: it answered ${slept}, cancelled ${cancelled()}`)
      const again: boolean = await sleep(10000)
      console.log(`a later await: it answered ${again}; the task ends`)
    }
    return new Response(200).text("nobody reads this")
  }
  return refuse(req)
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const c: Conn = new Conn(8192)
  await dial(c, port)
  await sendText(c, "GET /hang HTTP/1.1\r\nhost: t\r\n\r\n")
  await sleep(50)
  hangUp(c)
  await sleep(50)
  const d: Conn = new Conn(8192)
  await dial(d, port)
  await sendText(d, "GET /hello HTTP/1.1\r\nhost: t\r\n\r\n")
  const r: string = await readResponse(d)
  console.log(`after the hang-up: ${r}`)
  hangUp(d)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/hello")
  router.add("GET", "/hang")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = 2
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const stats: ServeStats = new ServeStats()
  stats.warmAfter = 1
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  spawn(client(port, fds[1]))
  const done: i32 = await serveOn(listener, router, limits, handle, stats)
  await readable(fds[0])
  const got: u8[] = [0]
  netRead(fds[0], got, 0, 1)
  netClose(fds[0])
  netClose(fds[1])
  netClose(listener)
  console.log(`serve: ${done}, answered ${stats.answered}`)
  console.log(`arena flat: ${stats.usedEnd === stats.usedWarm}`)
  return 0
}
