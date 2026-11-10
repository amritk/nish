// `ServeLimits.server` names the server in the head of every answer a task
// writes, a typed one and one with no content type, as `server: <value>`;
// left "", it writes no `server` field at all. A `refuse` (404 here) is
// written by the server, as a 400 is, and carries none either way.
import { readable, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, headerOf, readResponse, sendText } from "../net_serve/client"

// biome-ignore lint/suspicious/useAwait: `serveOn` takes an async handler, and these answers wait on nothing
async function answer(req: Request): Promise<Response> {
  if (req.route === 0) {
    return new Response(200).text("hello")
  }
  if (req.route === 1) {
    return new Response(204)
  }
  return refuse(req)
}

/** Asks `path` on a fresh connection and prints the answer and its `server` field. */
async function ask(port: i32, label: string, path: string): Promise<void> {
  const conn: Conn = new Conn(8192)
  await dial(conn, port)
  await sendText(conn, `GET ${path} HTTP/1.1\r\nhost: t\r\n\r\n`)
  const r: string = await readResponse(conn)
  // A fresh connection's first answer starts at 0, and `readResponse` leaves `start` past it.
  const raw: string = String.fromBytes(conn.buf, 0, conn.start)
  const server: string = headerOf(raw, "server")
  console.log(`${label} ${path}: ${r} | server=${server.length > 0 ? server : "(none)"}`)
  hangUp(conn)
}

async function client(port: i32, label: string, doneFd: i32): Promise<void> {
  await ask(port, label, "/text")
  await ask(port, label, "/empty")
  await ask(port, label, "/nope")
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

/** Serves three answers, the last a `refuse`, with `server` as `ServeLimits.server`. */
async function round(label: string, server: string): Promise<void> {
  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/text")
  router.add("GET", "/empty")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = 3
  limits.server = server
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  spawn(client(port, label, fds[1]))
  const stats: ServeStats = new ServeStats()
  const done: i32 = await serveOn(listener, router, limits, answer, stats)
  await readable(fds[0])
  const got: u8[] = [0]
  netRead(fds[0], got, 0, 1)
  console.log(`${label}: serve ${done}, answered ${stats.answered}`)
  netClose(fds[0])
  netClose(fds[1])
  netClose(listener)
}

export async function main(): Promise<i32> {
  await round("named", "nish")
  await round("unnamed", "")
  return 0
}
