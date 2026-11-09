// `nish/net/serve` end to end on loopback: routed GET and POST with
// parameters, 404 and 405, two pipelined requests answered in order though
// the first one's task sleeps longer, keep-alive, and the header and body
// caps answered 431 and 413. `main` awaits the server and the client together.
import { readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "./client"

const HELLO: i32 = 0
const USER: i32 = 1
const ECHO: i32 = 2
const SLOW: i32 = 3

async function handle(req: Request): Promise<Response> {
  switch (req.route) {
    case HELLO:
      return new Response(200).text("hello")
    case USER:
      return new Response(200).json(`{"id":${req.paramNumber(0)},"name":"${req.param(1)}","q":"${req.query("q")}"}`)
    case ECHO:
      return new Response(201).text(`${req.method()} ${req.path()} tag=${req.header("x-tag")} body=${req.text()}`)
    case SLOW: {
      const ms: i32 = req.paramNumber(0)
      await sleep(ms)
      return new Response(200).text(`slept ${ms}`)
    }
    default:
      return refuse(req)
  }
}

async function show(c: Conn, label: string): Promise<void> {
  const r: string = await readResponse(c)
  console.log(`${label}: ${r}`)
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const c: Conn = new Conn(8192)

  // A header section past the cap: 431, and the connection ends.
  await dial(c, port)
  let big: string = ""
  for (let i: i32 = 0; i < 40; i++) {
    big = `${big}x-pad-${i}: ${"abcdefghijklmnopqrstuvwxyz0123456789"}\r\n`
  }
  await sendText(c, `GET /hello HTTP/1.1\r\nhost: t\r\n${big}\r\n`)
  await show(c, "header cap")
  hangUp(c)

  // A body past the cap: 413, and the connection ends.
  await dial(c, port)
  await sendText(c, "POST /echo HTTP/1.1\r\nhost: t\r\ncontent-length: 100\r\n\r\n")
  await show(c, "body cap")
  hangUp(c)

  // One keep-alive connection for everything else.
  await dial(c, port)
  await sendText(c, "GET /hello HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "get")
  await sendText(c, "GET /users/42/ada%20l?q=a+b HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "params")
  await sendText(c, "POST /echo HTTP/1.1\r\nhost: t\r\nx-tag: seven\r\ncontent-length: 4\r\n\r\nping")
  await show(c, "post")
  await sendText(c, "GET /nowhere HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "404")
  await sendText(c, "DELETE /hello HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "405")
  // Pipelined: the first task sleeps 60 ms, the second 1 ms; the answers still come in order.
  await sendText(c, "GET /slow/60 HTTP/1.1\r\nhost: t\r\n\r\nGET /slow/1 HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "pipelined 1")
  await show(c, "pipelined 2")
  await show(c, "after drain")
  hangUp(c)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/hello")
  router.add("GET", "/users/:id/:name")
  router.add("POST", "/echo")
  router.add("GET", "/slow/:ms")
  const limits: ServeLimits = new ServeLimits()
  limits.headerBytes = 1024
  limits.bodyBytes = 64
  limits.maxRequests = 7
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const stats: ServeStats = new ServeStats()
  // The client says when it has printed its last line, so the stats come after it.
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
  console.log(`serve: ${done}, answered ${stats.answered}, busy ${stats.busy}, failed ${stats.failed}, slots ${stats.slots}`)
  return 0
}
