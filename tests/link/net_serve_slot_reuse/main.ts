// A request's task keeps its own copy of the request (SERVE-17): `serve`
// reads each request in place in the connection slot's parser and the task
// copies it before its first await. This pins the behaviour, not the copy: a
// task cancelled by its client's hang-up still reads its own method, path,
// header and body after its await, and the next connection on the slot (one
// connection slot, so the second client lands in the slot the first one's
// hang-up freed) gets its own answer. It would pass without the copy too: the
// copy is forced by the region checker (a task that keeps the slot's request
// does not compile), and the loop cancels a hung-up task in the turn its slot
// closes, before the next connection's bytes are read, so no stale read is
// reachable at run time.
import { cancelled, readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"

function describe(req: Request): string {
  return `${req.method()} ${req.path()} tag=${req.header("x-tag")} body=${req.text()}`
}

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    const slept: boolean = await sleep(10000)
    console.log(`first, after its await (answered ${slept}, cancelled ${cancelled()}): ${describe(req)}`)
    return new Response(200).text("nobody reads this")
  }
  await sleep(1)
  console.log(`second: ${describe(req)}`)
  return new Response(200).text(req.text())
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const c: Conn = new Conn(8192)
  await dial(c, port)
  await sendText(c, "POST /first HTTP/1.1\r\nhost: t\r\nx-tag: one\r\ncontent-length: 5\r\n\r\nalpha")
  await sleep(50)
  hangUp(c)
  await sleep(50)
  const d: Conn = new Conn(8192)
  await dial(d, port)
  await sendText(d, "PUT /second/x HTTP/1.1\r\nhost: t\r\nx-tag: two\r\ncontent-length: 6\r\n\r\nbravo!")
  const r: string = await readResponse(d)
  console.log(`the second client read: ${r}`)
  hangUp(d)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("POST", "/first")
  router.add("PUT", "/second/:id")
  const limits: ServeLimits = new ServeLimits()
  limits.connections = 1
  limits.maxRequests = 2
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
