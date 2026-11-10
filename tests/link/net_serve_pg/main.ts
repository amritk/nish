// A serve handler that reaches its spawner's state: the handler arrow captures
// a `PgAsyncPool` and a counter `main` owns, claims a connection, awaits a
// pooled query against the stand-in backend (../std_postgres_async/server.ts)
// and answers with the row's text. Two requests on one keep-alive connection,
// a third whose parameter the backend echoes back, and a route with no
// handler, answered 404. `main` awaits the server, then the client's done
// signal, and prints the counter the handler kept.
import { readable, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { secret, wipe } from "nish:secret"
import { PgConfig, pgTarget } from "nish/net/postgres"
import { PgAsyncParams, PgAsyncPool, pgAsyncClaim, pgAsyncConnect, pgAsyncQuery, pgAsyncRelease } from "nish/net/postgres-async"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"
import { Board, backend } from "../std_postgres_async/server"

/** What the handler counts; `main` owns it and reads it after the server ends. */
class Tally {
  served: i32 = 0
  missing: i32 = 0
}

async function show(c: Conn, label: string): Promise<void> {
  const r: string = await readResponse(c)
  console.log(`${label}: ${r}`)
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const c: Conn = new Conn(8192)
  await dial(c, port)
  await sendText(c, "GET /quick HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "quick")
  await sendText(c, "GET /echo/h%C3%A9llo HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "echo")
  await sendText(c, "GET /bad HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "bad")
  await sendText(c, "GET /nowhere HTTP/1.1\r\nhost: t\r\n\r\n")
  await show(c, "404")
  hangUp(c)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const pgListen: i32 = tcpListen("127.0.0.1", 0, 16)
  const board = new Board()
  spawn(backend(pgListen, board))
  const config = new PgConfig()
  config.user = "app"
  const pw: u8[] = [112, 119]
  const password = secret(pw)
  const pool = new PgAsyncPool(1)
  const live: i32 = await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", netLocalPort(pgListen)))
  wipe(password)
  console.log(`connected ${live} of 1`)

  const router: Router = new Router(new RouterLimits())
  router.add("GET", "/quick")
  router.add("GET", "/echo/:text")
  router.add("GET", "/bad")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = 4
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const stats: ServeStats = new ServeStats()
  const tally = new Tally()
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  spawn(client(port, fds[1]))
  const done: i32 = await serveOn(
    listener,
    router,
    limits,
    async (req: Request): Promise<Response> => {
      if (req.route < 0) {
        return refuse(req)
      }
      const ticket: i32 = await pgAsyncClaim(pool)
      if (ticket < 0) {
        return new Response(503).text("no connection")
      }
      const params = new PgAsyncParams()
      let sql: string = "quick"
      if (req.route === 1) {
        sql = "echo"
        params.text(req.param(0))
      } else if (req.route === 2) {
        sql = "bad"
      }
      const r = await pgAsyncQuery(pool, ticket, sql, params)
      pgAsyncRelease(pool, ticket, r.reusable)
      if (!r.ok() || r.rows === 0) {
        tally.missing += 1
        return new Response(404).text(`no row: ${r.errorCode}`)
      }
      tally.served += 1
      return new Response(200).text(r.text(0, 0))
    },
    stats,
  )
  await readable(fds[0])
  const got: u8[] = [0]
  netRead(fds[0], got, 0, 1)
  netClose(fds[0])
  netClose(fds[1])
  netClose(listener)
  pool.close()
  netClose(pgListen)
  console.log(`serve: ${done}, answered ${stats.answered}; the handler served ${tally.served}, missed ${tally.missing}; statements seen ${board.seen}`)
  return 0
}
