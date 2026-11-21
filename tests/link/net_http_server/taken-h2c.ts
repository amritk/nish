// The `net_http_server_trailers_*` panic tests' HTTP/2 request: a server with
// the routes of `taken.ts`, an h2c listener on loopback, a client that sends
// the preface and one GET and never reads, and the request the server takes.
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http2Config } from "nish/net/http2"
import { H2_FLAG_END_STREAM } from "nish/net/http2-frame"
import { connectResult, netAddress, netLocalPort, netWrite, pollAdd, pollCreate, pollWait, tcpConnect, tcpListen } from "nish:net"
import { Wire, getOf } from "../net_http2/peer"
import { ZERO } from "../net_tls_record_common/bytes"
import { bare } from "./taken"

/** A server, its h2c listener, and the one request it has taken, on stream 1. */
export class TakenH2c {
  h: HttpServer
  req: HttpServerRequest
  client: i32 = -1

  /** Serves one `GET path` from a loopback h2c client and takes it. */
  constructor(path: string) {
    const h: HttpServer = bare(new HttpServerLimits())
    const listener: i32 = tcpListen("127.0.0.1", 0, 8)
    h.listenH2c(listener, new Http2Config(), toI32(4))
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", netLocalPort(listener))
    const client: i32 = tcpConnect(addr)
    const loop: i32 = pollCreate()
    const ready: i32[] = new Array<i32>(2)
    pollAdd(loop, client, 2, ZERO)
    if (pollWait(loop, ready, 5000) !== 1 || connectResult(client) !== 0) {
      panic("connect failed")
    }
    const wire = new Wire()
    const none: i32[] = []
    const noValues: i64[] = []
    wire.preface()
    wire.settings(none, noValues)
    wire.headers(toI32(1), getOf(path), H2_FLAG_END_STREAM)
    const request: u8[] = wire.take()
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
