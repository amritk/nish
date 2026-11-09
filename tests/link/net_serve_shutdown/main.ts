// The server stops while a task still runs (SERVE-8): with `maxRequests`
// answered, `serveOn` drains, and a task parked on a long `sleep` for a
// client that is still connected is cancelled. Its await answers false at
// once, so it answers, the drain ends and `serveOn` returns. Before the
// cancellation stage the drain waited for the task, so `serveOn` returned
// only once its 10 s sleep ended.
import { cancelled, readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { monotonicNanos } from "nish:process"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    return new Response(200).text("quick")
  }
  if (req.route === 1) {
    const slept: boolean = await sleep(10000)
    console.log(`slow: the sleep answered ${slept}, cancelled ${cancelled()}`)
    return new Response(503).text("the server is stopping")
  }
  return refuse(req)
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const slow: Conn = new Conn(8192)
  await dial(slow, port)
  await sendText(slow, "GET /slow HTTP/1.1\r\nhost: t\r\n\r\n")
  await sleep(50)
  const quick: Conn = new Conn(8192)
  await dial(quick, port)
  await sendText(quick, "GET /quick HTTP/1.1\r\nhost: t\r\n\r\n")
  const r: string = await readResponse(quick)
  console.log(`quick: ${r}`)
  hangUp(quick)
  const s: string = await readResponse(slow)
  console.log(`slow: ${s}`)
  hangUp(slow)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/quick")
  router.add("GET", "/slow")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = 1
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const stats: ServeStats = new ServeStats()
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  const started: i64 = monotonicNanos()
  spawn(client(port, fds[1]))
  const done: i32 = await serveOn(listener, router, limits, handle, stats)
  const ms: i64 = (monotonicNanos() - started) / 1000000
  console.log(`serve: ${done}, answered ${stats.answered}, returned within 2 s: ${ms < 2000}`)
  await readable(fds[0])
  const got: u8[] = [0]
  netRead(fds[0], got, 0, 1)
  netClose(fds[0])
  netClose(fds[1])
  netClose(listener)
  return 0
}
