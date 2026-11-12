// The server half of `net_http_server_carriers`: one `HttpServer` with an
// HTTP/2 over TLS listener and an HTTP/3 listener on loopback, and the program
// that answers what it takes. `step` has the shape the scripted clients of
// `tests/link/net_interop_server/client` turn a server's loop with.
import { Secret } from "nish:secret"
import { netLocalPort, tcpListen, udpBind } from "nish:net"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http2Config } from "nish/net/http2"
import { H2_ALPN } from "nish/net/http2-tls"
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener"
import { Router, RouterLimits } from "nish/net/router"
import { tcpConfig } from "../net_tls_common/server"
import { h3Config, H3Limits, h3QuicConfig } from "../net_http3/peer"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

// The routes, in the order they are added.
const HELLO: i32 = 0
const USER: i32 = 1
const ECHO: i32 = 2

/** The HTTP/2 listener's port, where the clients read it. */
export class RigH2 {
  port: i32 = 0
}

/** The server, its two listeners, and the program answering its requests. */
export class Rig {
  h: HttpServer
  quicPort: i32 = 0
  h2: RigH2
  text: u8[]
  octets: u8[]
  hello: u8[]

  constructor() {
    const router = new Router(new RouterLimits())
    router.add("GET", "/hello")
    router.add("GET", "/users/:id")
    router.add("POST", "/echo")
    this.h = new HttpServer(new HttpServerLimits(), router)
    const tcp: i32 = tcpListen("127.0.0.1", 0, 8)
    this.h.listenHttp2Tls(tcp, tcpConfig([H2_ALPN]), new Http2Config(), toI32(4))
    this.h2 = new RigH2()
    this.h2.port = netLocalPort(tcp)
    const udp: i32 = udpBind("127.0.0.1", 0, 0)
    this.h.listenHttp3(udp, h3QuicConfig(new H3Limits()), h3Config(), toI32(4), new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE))
    this.quicPort = netLocalPort(udp)
    this.text = ascii("text/plain")
    this.octets = ascii("application/octet-stream")
    this.hello = ascii("hello\n")
  }

  /** One turn of the server's loop, at most `wait` ms, signing with `key`, then an answer to every request it took. */
  step(wait: i32, key: Secret<u8[]>, current: Secret<u8[]> | null, previous: Secret<u8[]> | null): void {
    const h: HttpServer = this.h
    h.waitSigned(wait, key)
    while (h.ready()) {
      this.answer(h.take())
    }
  }

  /** The program: each route's answer, and the refusals for the rest. */
  answer(r: HttpServerRequest): void {
    const h: HttpServer = this.h
    switch (r.route) {
      case HELLO:
        h.send(r, 200, this.text, this.hello, ZERO, toI32(this.hello.length))
        break
      case USER: {
        const w = h.json()
        w.beginObject()
        w.key("id")
        w.i32(r.paramDecimal(0))
        w.endObject()
        h.sendJson(r, 200)
        break
      }
      case ECHO:
        h.send(r, 200, this.octets, r.body, ZERO, r.bodyLength)
        break
      default:
        h.refuse(r)
    }
  }
}
