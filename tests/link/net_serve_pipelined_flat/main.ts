// Thousands of pipelined requests on one connection, each answered by a
// task in a region of its own: `Arena.used()`, read in the server's loop,
// is the same after the last answer as after the first hundred.

import { readable, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"

const ROUNDS: i32 = 80
const BATCH: i32 = 50

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    return new Response(200).text(`item ${req.paramNumber(0)}`)
  }
  return refuse(req)
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const c: Conn = new Conn(65536)
  await dial(c, port)
  let ok: i32 = 0
  let bad: i32 = 0
  for (let round: i32 = 0; round < ROUNDS; round++) {
    let batch: string = ""
    for (let i: i32 = 0; i < BATCH; i++) {
      batch = `${batch}GET /items/${round * BATCH + i} HTTP/1.1\r\nhost: t\r\n\r\n`
    }
    await sendText(c, batch)
    for (let i: i32 = 0; i < BATCH; i++) {
      const r: string = await readResponse(c)
      if (r === `200 [text/plain; charset=utf-8] item ${round * BATCH + i}`) {
        ok++
      } else {
        bad++
      }
    }
  }
  hangUp(c)
  console.log(`client: ${ok} answered in order, ${bad} not`)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/items/:n")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = ROUNDS * BATCH
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const stats: ServeStats = new ServeStats()
  stats.warmAfter = 100
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
  console.log(`serve: ${done}, answered ${stats.answered}, failed ${stats.failed}, slots ${stats.slots}`)
  console.log(`arena flat: ${stats.usedEnd === stats.usedWarm}`)
  console.error(`arena used: ${stats.usedWarm} after ${stats.warmAfter}, ${stats.usedEnd} after ${stats.answered}`)
  return 0
}
