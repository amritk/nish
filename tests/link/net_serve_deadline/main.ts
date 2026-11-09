// `ServeLimits.deadline` (SERVE-8): a handler that runs past it is
// cancelled. Its parked `sleep` answers false at once, so it can still
// answer, here with a 503 the client reads on the same connection, and the
// connection serves the next request. A handler that answers within the
// deadline never sees it, and its timer goes with its task.
import { cancelled, readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { monotonicNanos } from "nish:process"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    const quick: boolean = await sleep(10)
    return new Response(200).text(`quick ${quick}, cancelled ${cancelled()}`)
  }
  if (req.route === 1) {
    const slept: boolean = await sleep(10000)
    if (!slept && cancelled()) {
      return new Response(503).text("past the deadline")
    }
    return new Response(200).text("in time")
  }
  return refuse(req)
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const c: Conn = new Conn(8192)
  await dial(c, port)
  await sendText(c, "GET /quick HTTP/1.1\r\nhost: t\r\n\r\n")
  const a: string = await readResponse(c)
  console.log(`quick: ${a}`)
  const start: i64 = monotonicNanos()
  await sendText(c, "GET /slow HTTP/1.1\r\nhost: t\r\n\r\n")
  const b: string = await readResponse(c)
  console.log(`slow: ${b}`)
  const ms: i64 = (monotonicNanos() - start) / toI64(1000000)
  console.log(`slow answered within 2 s: ${ms < toI64(2000)}`)
  await sendText(c, "GET /quick HTTP/1.1\r\nhost: t\r\n\r\n")
  const d: string = await readResponse(c)
  console.log(`after it, same connection: ${d}`)
  hangUp(c)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/quick")
  router.add("GET", "/slow")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = 3
  limits.deadline = 200
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const stats: ServeStats = new ServeStats()
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
  return 0
}
