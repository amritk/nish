// `nish/net/serve` end to end on loopback: routed GET and POST with
// parameters, 404 and 405, two pipelined requests answered in order (the
// second read only once the first, whose task sleeps longer, is answered),
// keep-alive, the header and body caps answered 431 and 413, the answers a
// bad Response gets, a body with no content type, and a client that hangs up
// while its task runs. `main` awaits the server, then the
// client's done signal.
import { readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "./client"

const HELLO: i32 = 0
const USER: i32 = 1
const ECHO: i32 = 2
const SLOW: i32 = 3
const BIG: i32 = 4
const BAD: i32 = 5

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
    case BIG: {
      const big: u8[] = new Array<u8>(300)
      big.fill(120)
      return new Response(200).bytes("text/plain", big, 0, 300)
    }
    case BAD: {
      const k: string = req.query("k")
      if (k === "type") {
        const none: u8[] = []
        return new Response(200).bytes("text/plain\r\nx-evil: 1", none, 0, 0)
      }
      if (k === "untyped") {
        const raw: u8[] = new Array<u8>(3)
        raw.fill(120)
        return new Response(200).bytes("", raw, 0, 3)
      }
      if (k === "empty") {
        return new Response(204).text("a body a 204 cannot carry")
      }
      return new Response(99).text("no such status")
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
  await sendText(c, "GET /big HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "response cap")
  await sendText(c, "GET /bad HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "bad status")
  await sendText(c, "GET /bad?k=type HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "bad type")
  await sendText(c, "GET /bad?k=empty HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "204 with a body")
  await sendText(c, "GET /bad?k=untyped HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "no content type")
  // With one request in flight, another connection's request is answered 503;
  // with two connections open, a third is closed as it is accepted.
  await sendText(c, "GET /slow/100 HTTP/1.1\r\nhost: t\r\n\r\n")
  await sleep(20)
  const c2: Conn = new Conn(8192)
  await dial(c2, port)
  await sendText(c2, "GET /hello HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c2, "in flight")
  const c3: Conn = new Conn(8192)
  await dial(c3, port)
  await show(c3, "connections")
  await show(c, "held")
  hangUp(c2)
  hangUp(c3)
  // A client hangs up while its task runs (SERVE-10). The late answer goes
  // nowhere, and the connection slot it held is free again: with `c` open and
  // two connections allowed, `c5` is accepted only if it is, and it is answered
  // its own "hello", never the dropped "slept 80".
  await sleep(10)
  const c4: Conn = new Conn(8192)
  await dial(c4, port)
  await sendText(c4, "GET /slow/80 HTTP/1.1\r\nhost: t\r\n\r\n")
  await sleep(10)
  hangUp(c4)
  await sleep(150)
  const c5: Conn = new Conn(8192)
  await dial(c5, port)
  await sendText(c5, "GET /hello HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c5, "after a hang-up")
  hangUp(c5)
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
  router.add("GET", "/big")
  router.add("GET", "/bad")
  const limits: ServeLimits = new ServeLimits()
  limits.headerBytes = 1024
  limits.bodyBytes = 64
  limits.connections = 2
  limits.inFlight = 1
  limits.responseBytes = 256
  limits.maxRequests = 16
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
