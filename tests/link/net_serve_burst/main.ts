// A pipelined burst on one connection, as `serve` answers it: in request
// order, in one write while the answers fit the output, across partial
// writes when they do not, and with the waiting task cancelled when the
// client hangs up mid-burst. `/stats` answers the server's own counts, which
// the loop updates after each turn's flush.
import { cancelled, readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"

const BURST: i32 = 16
const BIG: i32 = 128
const BIG_BYTES: i32 = 60000

/** The answer to `req`; `answered` and `sends` are the server's counts as the task began. */
async function handle(req: Request, answered: i32, sends: i64): Promise<Response> {
  if (req.route === 0) {
    return new Response(200).text(`item ${req.paramNumber(0)}`)
  }
  if (req.route === 1) {
    return new Response(200).text(`${answered} ${sends}`)
  }
  if (req.route === 2) {
    const n: i32 = req.paramNumber(0)
    const body: u8[] = new Array<u8>(BIG_BYTES)
    for (let i: i32 = 0; i < BIG_BYTES; i++) {
      body[i] = toU8(97 + (n % 26))
    }
    return new Response(200).bytes("application/octet-stream", body, 0, BIG_BYTES)
  }
  if (req.route === 3) {
    const slept: boolean = await sleep(10000)
    console.log(`the parked task: its await answered ${slept}, cancelled ${cancelled()}`)
    return new Response(200).text("nobody reads this")
  }
  return refuse(req)
}

/** The two numbers `/stats` answered: what the server had answered and how many sends it had made. */
function statAt(r: string, k: i32): i32 {
  const text: string = r.substring(toI32(r.indexOf("] ")) + 2, toI32(r.length))
  const space: i32 = toI32(text.indexOf(" "))
  return toI32(parseInt(k === 0 ? text.substring(0, space) : text.substring(space + 1, toI32(text.length))))
}

/** Asks `/stats` on `c`: what the server had answered (`k` 0) or how many sends it had made (`k` 1). */
async function askStats(c: Conn, k: i32): Promise<i32> {
  await sendText(c, "GET /stats HTTP/1.1\r\nhost: t\r\n\r\n")
  const r: string = await readResponse(c)
  return statAt(r, k)
}

async function client(port: i32, doneFd: i32): Promise<void> {
  // A burst that fits: answered in order, in one write.
  const a: Conn = new Conn(8192)
  await dial(a, port)
  const sendsBefore: i32 = await askStats(a, 1)
  let burst: string = ""
  for (let i: i32 = 0; i < BURST; i++) {
    burst = `${burst}GET /items/${i} HTTP/1.1\r\nhost: t\r\n\r\n`
  }
  await sendText(a, burst)
  let inOrder: i32 = 0
  for (let i: i32 = 0; i < BURST; i++) {
    const r: string = await readResponse(a)
    if (r === `200 [text/plain; charset=utf-8] item ${i}`) {
      inOrder++
    }
  }
  const sendsAfter: i32 = await askStats(a, 1)
  console.log(`burst of ${BURST}: ${inOrder} answered in order`)
  // The sends between the two reads of `/stats`: the first one's answer, then the burst's.
  console.log(`burst of ${BURST}: ${sendsAfter - sendsBefore - 1} write(s)`)
  hangUp(a)

  // A burst whose answers outgrow the socket while the client does not
  // read: the server writes what fits and waits for room, in order.
  const b: Conn = new Conn(65536 + 1024)
  await dial(b, port)
  let big: string = ""
  for (let i: i32 = 0; i < BIG; i++) {
    big = `${big}GET /big/${i} HTTP/1.1\r\nhost: t\r\n\r\n`
  }
  await sendText(b, big)
  await sleep(100)
  const c: Conn = new Conn(8192)
  await dial(c, port)
  const held: i32 = await askStats(c, 0)
  hangUp(c)
  const sentEarly: i32 = held - (BURST + 2)
  console.log(`big burst: fewer than ${BIG} answered while unread: ${sentEarly < BIG}`)
  let whole: i32 = 0
  const prefix: string = "200 [application/octet-stream] "
  for (let i: i32 = 0; i < BIG; i++) {
    const r: string = await readResponse(b)
    const letter: i32 = 97 + (i % 26)
    if (
      toI32(r.length) === toI32(prefix.length) + BIG_BYTES &&
      r.substring(0, toI32(prefix.length)) === prefix &&
      toI32(r.charCodeAt(toI32(prefix.length))) === letter &&
      toI32(r.charCodeAt(toI32(r.length) - 1)) === letter
    ) {
      whole++
    }
  }
  console.log(`big burst: ${whole} of ${BIG} answered whole and in order`)
  hangUp(b)

  // A hang-up mid-burst: the answer before the parked request arrives and
  // the parked task is cancelled. The two requests behind it were already
  // read, so they are still answered, in order, into a closed connection.
  const d: Conn = new Conn(8192)
  await dial(d, port)
  await sendText(
    d,
    "GET /items/1 HTTP/1.1\r\nhost: t\r\n\r\nGET /hang HTTP/1.1\r\nhost: t\r\n\r\nGET /items/2 HTTP/1.1\r\nhost: t\r\n\r\nGET /items/3 HTTP/1.1\r\nhost: t\r\n\r\n"
  )
  const first: string = await readResponse(d)
  console.log(`before the hang-up: ${first}`)
  await sleep(50)
  hangUp(d)
  await sleep(50)
  const e: Conn = new Conn(8192)
  await dial(e, port)
  const last: i32 = await askStats(e, 0)
  // Before it: 1 + BURST + 1 on the first connection, then BIG + 1 on the next two.
  console.log(`after the hang-up: ${last - (BURST + BIG + 3)} answered on that connection`)
  hangUp(e)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/items/:n")
  router.add("GET", "/stats")
  router.add("GET", "/big/:n")
  router.add("GET", "/hang")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = BURST + BIG + 8
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  const stats: ServeStats = new ServeStats()
  spawn(client(port, fds[1]))
  const done: i32 = await serveOn(
    listener,
    router,
    limits,
    async (req: Request): Promise<Response> => await handle(req, stats.answered, stats.sends),
    stats
  )
  await readable(fds[0])
  const got: u8[] = [0]
  netRead(fds[0], got, 0, 1)
  netClose(fds[0])
  netClose(fds[1])
  netClose(listener)
  console.log(`serve: ${done}, answered ${stats.answered}, failed ${stats.failed}`)
  return 0
}
