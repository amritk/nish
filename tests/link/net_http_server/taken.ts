// What the `net_http_server_*` panic tests share: a server with the routes
// `GET /` and `GET /users/:id`, an HTTP/1.1 listener on loopback, a client
// that sends one GET and never reads, and the request the server takes.
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { Router, RouterLimits } from "nish/net/router"
import {
  connectResult,
  netAddress,
  netLocalPort,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

/** A server under `limits` with the two routes and no listener. */
export const bare = (limits: HttpServerLimits): HttpServer => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/")
  router.add("GET", "/users/:id")
  return new HttpServer(limits, router)
}

/** A server, its HTTP/1.1 listener, and the one request it has taken. */
export class Taken {
  h: HttpServer
  req: HttpServerRequest
  client: i32 = -1

  /** Serves one `GET path` from a loopback client and takes it. */
  constructor(path: string) {
    const h: HttpServer = bare(new HttpServerLimits())
    const listener: i32 = tcpListen("127.0.0.1", 0, 8)
    h.listenHttp1(listener, new Http1Config(), toI32(4))
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", netLocalPort(listener))
    const client: i32 = tcpConnect(addr)
    const loop: i32 = pollCreate()
    const ready: i32[] = new Array<i32>(2)
    pollAdd(loop, client, 2, ZERO)
    if (pollWait(loop, ready, 5000) !== 1 || connectResult(client) !== 0) {
      panic("connect failed")
    }
    const request: u8[] = ascii(`GET ${path} HTTP/1.1\r\nHost: t\r\n\r\n`)
    netWrite(client, request, ZERO, toI32(request.length))
    let turns: i32 = 0
    while (!h.ready() && turns < 5000) {
      h.wait(toI32(1))
      turns += 1
    }
    if (!h.ready()) {
      panic("no request")
    }
    this.h = h
    this.req = h.take()
    this.client = client
  }
}
