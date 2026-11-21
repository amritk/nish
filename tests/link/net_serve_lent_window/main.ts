// A lent head stays its task's while the task runs: a pipelined request
// behind a handler that waits is not parsed into the head the handler reads
// until the handler has answered (docs/security/serve.md, "Nothing rewrites
// a lent head while its task runs"). The second request of each pair has a
// longer path, so a parse into the waiting handler's head would show in its
// answer.

import { readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"

const PAIRS: i32 = 3

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    const before: string = req.path()
    await sleep(20)
    return new Response(200).text(`slow ${before} ${req.path()} ${req.paramNumber(0)}`)
  }
  if (req.route === 1) {
    return new Response(200).text(`fast ${req.path()}`)
  }
  return refuse(req)
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const c: Conn = new Conn(65536)
  await dial(c, port)
  for (let i: i32 = 0; i < PAIRS; i++) {
    await sendText(
      c,
      `GET /slow/${i} HTTP/1.1\r\nhost: t\r\n\r\nGET /fast/${i}0000000000000000 HTTP/1.1\r\nhost: t\r\n\r\n`
    )
    const first: string = await readResponse(c)
    console.log(`client: ${first}`)
    const second: string = await readResponse(c)
    console.log(`client: ${second}`)
  }
  hangUp(c)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/slow/:n")
  router.add("GET", "/fast/:n")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = PAIRS * 2
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
  console.log(`serve: ${done}, answered ${stats.answered}, failed ${stats.failed}`)
  return 0
}
