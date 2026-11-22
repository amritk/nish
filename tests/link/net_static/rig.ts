// The server half of `net_static`: one `HttpServer` with an HTTP/1.1
// listener, an h2c listener, an HTTP/2 over TLS listener and an HTTP/3
// listener on loopback, and beside it an `HttpHandler` on a listener of its
// own, both serving the fixture directory through one `StaticFiles`. `step`
// has the shape the scripted clients of `./client` turn a server's loop with.
import { Secret } from "nish:secret"
import { netLocalPort, tcpListen, udpBind } from "nish:net"
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { Http2Config } from "nish/net/http2"
import { H2_ALPN } from "nish/net/http2-tls"
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener"
import { Router, RouterLimits } from "nish/net/router"
import { STATIC_NOT_FOUND, StaticFiles, StaticLimits } from "nish/net/static"
import { tcpConfig } from "../net_tls_common/server"
import { h3Config, H3Limits, h3QuicConfig } from "../net_http3/peer"
import { RigH2 } from "../net_http_server_carriers/rig"

/** The fixture directory the program writes and serves, relative to the repository root the suite runs it from. */
export const WWW: string = "build/link/net_static/www"

// The routes, in the order they are added.
const FILES: i32 = 0
const POSTED: i32 = 1

/** The routes both servers take: `GET /static/*`, and `POST /static/*` so `StaticFiles` answers 405 itself. */
const staticRouter = (): Router => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/static/*")
  router.add("POST", "/static/*")
  return router
}

/** The server, its listeners, the handler, and the program answering both. */
export class StaticRig {
  h: HttpServer
  handler: HttpHandler
  handlerPort: i32 = 0
  quicPort: i32 = 0
  h2: RigH2
  /** Always: the server has TLS and QUIC listeners, so its loop turns by `waitSigned`. */
  signed: boolean = true
  files: StaticFiles
  /** What the last `serve` or `serveHandler` answered. */
  last: i32 = 0
  /** How many requests either server's program refused as not found. */
  missing: i32 = 0
  /** Whether the handler's program answers through `tryServeHandler`. */
  tryMode: boolean = false
  /** In `tryMode`, the `Err` a second `tryServeHandler` of an answered request gave, or `""`. */
  again: string = ""

  constructor(limits: StaticLimits) {
    const serverLimits = new HttpServerLimits()
    serverLimits.requests = 16
    this.h = new HttpServer(serverLimits, staticRouter())
    this.h2 = new RigH2()
    const plain: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenHttp1(plain, new Http1Config(), 4)
    this.h2.h1Port = netLocalPort(plain)
    const clear: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenH2c(clear, new Http2Config(), 4)
    this.h2.h2cPort = netLocalPort(clear)
    const tcp: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenHttp2Tls(tcp, tcpConfig([H2_ALPN]), new Http2Config(), 4)
    this.h2.port = netLocalPort(tcp)
    const udp: i32 = udpBind("127.0.0.1", 0, 0)
    this.h.listenHttp3(udp, h3QuicConfig(new H3Limits()), h3Config(), 4, new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE))
    this.quicPort = netLocalPort(udp)
    const handlerListener: i32 = tcpListen("127.0.0.1", 0, 16)
    this.handlerPort = netLocalPort(handlerListener)
    const handlerLimits = new HandlerLimits()
    handlerLimits.slots = 4
    this.handler = new HttpHandler(handlerLimits, handlerListener, staticRouter())
    this.files = new StaticFiles(WWW, limits)
  }

  /** One turn of both loops, at most `wait` ms for the server, then an answer to every request either took. */
  step(wait: i32, key: Secret<u8[]>, current: Secret<u8[]> | null, previous: Secret<u8[]> | null): void {
    const h: HttpServer = this.h
    h.waitSigned(wait, key)
    while (h.ready()) {
      this.answer(h.take())
    }
    const handler: HttpHandler = this.handler
    handler.wait(0)
    while (handler.ready()) {
      this.answerHandler(handler.take())
    }
  }

  /** The program on the server: the rest of the path after `/static/` from the directory, a 404 for what it does not serve. */
  answer(r: HttpServerRequest): void {
    if (r.route !== FILES && r.route !== POSTED) {
      this.h.refuse(r)
      return
    }
    this.last = this.files.serve(this.h, r, r.paramStart(0), r.paramEnd(0))
    if (this.last === STATIC_NOT_FOUND) {
      this.missing += 1
      this.h.refuse(r)
    }
  }

  /** The same program on the handler. */
  answerHandler(r: HttpRequest): void {
    if (r.route !== FILES && r.route !== POSTED) {
      this.handler.refuse(r)
      return
    }
    if (this.tryMode) {
      const served: Result<i32, string> = this.files.tryServeHandler(this.handler, r, r.paramStart(0), r.paramEnd(0))
      this.last = served.isOk() ? served.value : -1
      if (this.last !== STATIC_NOT_FOUND) {
        // Answered (or not): a second answer is a broken contract, an `Err`.
        const twice: Result<i32, string> = this.files.tryServeHandler(this.handler, r, r.paramStart(0), r.paramEnd(0))
        this.again = twice.isErr() ? twice.error : ""
      }
    } else {
      this.last = this.files.serveHandler(this.handler, r, r.paramStart(0), r.paramEnd(0))
    }
    if (this.last === STATIC_NOT_FOUND) {
      this.missing += 1
      this.handler.refuse(r)
    }
  }
}
