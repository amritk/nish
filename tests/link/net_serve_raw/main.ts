// The bytes `nish/net/serve` answers, pinned whole: a plain-text and a JSON
// answer, a 404, the 500 a wrong Response gets (and the server answering
// after it), the 503 past `inFlight`, a HEAD (head only, its length kept),
// and a pipelined batch answered in order. Each CRLF reads `|` and the
// `Date` value `<date>`; every other byte, header order included, is the
// server's. `main` awaits the server, then the client's done signal.
import { readable, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readRaw, sendText } from "../net_serve/client"

const PLAIN: i32 = 0
const JSON_ROUTE: i32 = 1
const WRONG: i32 = 2
const SLOW: i32 = 3

async function handle(req: Request): Promise<Response> {
  switch (req.route) {
    case PLAIN:
      return new Response(200).text("Hello, World!")
    case JSON_ROUTE:
      return new Response(200).json(`{"message":"Hello, World!"}`)
    case WRONG: {
      const res: Response = new Response(200).text("short")
      res.length = -1
      return res
    }
    case SLOW: {
      // Held until the client has had its 503: one byte says it started,
      // and the client's byte back lets it answer.
      const fd: i32 = toI32(parseInt(req.header("x-signal")))
      const one: u8[] = [1]
      netWrite(fd, one, 0, 1)
      await readable(fd)
      netRead(fd, one, 0, 1)
      return new Response(200).text("slept")
    }
    default:
      return refuse(req)
  }
}

async function show(c: Conn, label: string, bodiless: boolean): Promise<void> {
  const raw: string = await readRaw(c, bodiless)
  console.log(`${label}: ${raw}`)
}

async function client(port: i32, doneFd: i32, signal: i32, held: i32): Promise<void> {
  const c: Conn = new Conn(8192)
  await dial(c, port)
  await sendText(c, "GET /plaintext HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "plaintext", false)
  await sendText(c, "GET /json HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "json", false)
  await sendText(c, "GET /nowhere HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "404", false)
  await sendText(c, "GET /wrong HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "wrong response", false)
  await sendText(c, "GET /plaintext HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "after it", false)
  await sendText(c, "HEAD /plaintext HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "head", true)
  // One request in flight on `c`, held by its handler until the client
  // says; another connection's is answered 503 meanwhile.
  await sendText(c, `GET /slow HTTP/1.1\r\nhost: t\r\nx-signal: ${held}\r\n\r\n`)
  const step: u8[] = [0]
  await readable(signal)
  netRead(signal, step, 0, 1)
  const c2: Conn = new Conn(8192)
  await dial(c2, port)
  await sendText(c2, "GET /plaintext HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c2, "in flight", false)
  hangUp(c2)
  netWrite(signal, step, 0, 1)
  await show(c, "held", false)
  // Three requests in one write: three answers, in request order.
  await sendText(c, "GET /json HTTP/1.1\r\nhost: t\r\n\r\nGET /nowhere HTTP/1.1\r\nhost: t\r\n\r\nGET /plaintext HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "pipelined 1", false)
  await show(c, "pipelined 2", false)
  await show(c, "pipelined 3", false)
  hangUp(c)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/plaintext")
  router.add("GET", "/json")
  router.add("GET", "/wrong")
  router.add("GET", "/slow")
  const limits: ServeLimits = new ServeLimits()
  limits.connections = 2
  limits.inFlight = 1
  limits.maxRequests = 11
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const stats: ServeStats = new ServeStats()
  const signal: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, signal)
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  spawn(client(port, fds[1], signal[1], signal[0]))
  const done: i32 = await serveOn(listener, router, limits, handle, stats)
  await readable(fds[0])
  const got: u8[] = [0]
  netRead(fds[0], got, 0, 1)
  netClose(fds[0])
  netClose(fds[1])
  netClose(signal[0])
  netClose(signal[1])
  netClose(listener)
  console.log(`serve: ${done}, answered ${stats.answered}, busy ${stats.busy}, failed ${stats.failed}`)
  return 0
}
