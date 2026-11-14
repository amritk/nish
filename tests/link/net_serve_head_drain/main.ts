// Two of the handler's rules `serve` keeps in its own `ServeConns` (SERVE-17):
// a HEAD reaches only a route GET reaches, and its answer has the GET's
// length but no body (HANDLER-6); and once the server drains, the answer of
// a request still running says `Connection: close`, and a request pipelined
// behind it is never read (HANDLER-9).
import { readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, headerOf, readResponse, sendText } from "../net_serve/client"

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    return new Response(200).text("hello page!")
  }
  if (req.route === 1) {
    return new Response(201).text("posted")
  }
  if (req.route === 2) {
    const slept: boolean = await sleep(5000)
    console.log(`slow: the sleep answered ${slept}`)
    return new Response(200).text("slow")
  }
  return refuse(req)
}

/** Reads one more chunk; false once the peer has closed. */
async function more(conn: Conn): Promise<boolean> {
  while (true) {
    const n: i32 = netRead(conn.fd, conn.buf, conn.end, toI32(conn.buf.length) - conn.end)
    if (n === -11) {
      await readable(conn.fd)
      continue
    }
    if (n <= 0) {
      conn.closed = true
      return false
    }
    conn.end += n
    return true
  }
}

/** Reads one response head and nothing after it: its status line's code and the named fields. */
async function readHead(conn: Conn): Promise<string> {
  while (true) {
    for (let i: i32 = conn.start; i + 3 < conn.end; i++) {
      if (conn.buf[i] === toU8(13) && conn.buf[i + 1] === toU8(10) && conn.buf[i + 2] === toU8(13) && conn.buf[i + 3] === toU8(10)) {
        const head: string = String.fromBytes(conn.buf, conn.start, i + 4)
        conn.start = i + 4
        const allow: string = headerOf(head, "allow")
        return `${head.substring(9, 12)} length=${headerOf(head, "content-length")} connection=${headerOf(head, "connection")}${allow.length > 0 ? ` allow=${allow}` : ""}`
      }
    }
    const got: boolean = await more(conn)
    if (!got) {
      return "closed"
    }
  }
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const a: Conn = new Conn(8192)
  await dial(a, port)
  await sendText(a, "HEAD /page HTTP/1.1\r\nhost: t\r\n\r\n")
  const r1: string = await readHead(a)
  console.log(`HEAD /page: ${r1}`)
  // Were a body sent after the HEAD's head, it would be read here as the GET's answer.
  await sendText(a, "GET /page HTTP/1.1\r\nhost: t\r\n\r\n")
  const r2: string = await readResponse(a)
  console.log(`then GET /page: ${r2}`)
  await sendText(a, "HEAD /form HTTP/1.1\r\nhost: t\r\n\r\n")
  const r3: string = await readHead(a)
  console.log(`HEAD /form: ${r3}`)
  // A slow request, with another pipelined behind it in the same write.
  await sendText(a, "GET /slow HTTP/1.1\r\nhost: t\r\n\r\nGET /page HTTP/1.1\r\nhost: t\r\n\r\n")
  await sleep(50)
  // The answer that reaches `maxRequests` starts the drain.
  const b: Conn = new Conn(8192)
  await dial(b, port)
  await sendText(b, "POST /form HTTP/1.1\r\nhost: t\r\ncontent-length: 0\r\n\r\n")
  const r4: string = await readResponse(b)
  console.log(`the second client: ${r4}`)
  hangUp(b)
  const r5: string = await readHead(a)
  console.log(`draining, the slow answer: ${r5}`)
  let open: boolean = await more(a)
  while (open) {
    open = await more(a)
  }
  const rest: string = String.fromBytes(a.buf, a.start, a.end)
  console.log(`then the connection closes: ${a.closed}, after the body "${rest}", the pipelined GET unanswered: ${rest.indexOf("HTTP/1.1") < 0}`)
  hangUp(a)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/page")
  router.add("POST", "/form")
  router.add("GET", "/slow")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = 4
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
