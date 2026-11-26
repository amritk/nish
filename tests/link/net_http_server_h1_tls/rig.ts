// The server half of `net_http_server_h1_tls`: one `HttpServer` with a
// cleartext HTTP/1.1 listener, an HTTP/1.1 over TLS listener (listened second,
// so the TLS carrier's records sit after the cleartext one's, or first, so
// they start at 0) and an HTTP/3 listener for Alt-Svc to name, and the program
// that answers what it takes.
import { Secret } from "nish:secret"
import { netLocalPort, tcpListen, udpBind } from "nish:net"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener"
import { Router, RouterLimits } from "nish/net/router"
import { tcpConfig } from "../net_tls_common/server"
import { h3Config, H3Limits, h3QuicConfig } from "../net_http3/peer"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

// The routes, in the order they are added.
const HELLO: i32 = 0
const USER: i32 = 1
const ECHO: i32 = 2
const BIG: i32 = 3

/** How many bytes `/big` answers: more than loopback's socket buffers hold while the client does not read. */
export const BIG_LENGTH: i32 = 8388608

/** The server, its listeners, and the program answering its requests. */
export class Rig {
  h: HttpServer
  /** The HTTP/1.1 over TLS listener's port. */
  port: i32 = 0
  /** The cleartext HTTP/1.1 listener's port. */
  plainPort: i32 = 0
  /** The HTTP/3 listener's port, which Alt-Svc names. */
  quicPort: i32 = 0
  text: u8[]
  octets: u8[]
  hello: u8[]
  /** `/big`'s body, made at its first request. */
  big: u8[]
  /** How many requests the program has taken, and how many of them said `secure`. */
  taken: i32 = 0
  secure: i32 = 0
  /** Arena bytes the server's own `waitSigned` and `send` calls left allocated, summed over every `step`. */
  kept: i64 = 0

  /**
   * A server under `limits` with `slots` connections on each HTTP/1.1
   * listener, the TLS one offering `alpn`, and `config` for the TLS carrier;
   * the TLS listener is listened before the cleartext one when `tlsFirst`.
   */
  constructor(limits: HttpServerLimits, alpn: string[], config: Http1Config, slots: i32, tlsFirst: boolean) {
    const router = new Router(new RouterLimits())
    router.add("GET", "/hello")
    router.add("GET", "/users/:id")
    router.add("POST", "/echo")
    router.add("GET", "/big")
    this.h = new HttpServer(limits, router)
    const tcp: i32 = tcpListen("127.0.0.1", 0, 16)
    if (tlsFirst) {
      this.h.listenHttp1Tls(tcp, tcpConfig(alpn), config, slots)
    }
    const plain: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenHttp1(plain, new Http1Config(), slots)
    this.plainPort = netLocalPort(plain)
    if (!tlsFirst) {
      this.h.listenHttp1Tls(tcp, tcpConfig(alpn), config, slots)
    }
    this.port = netLocalPort(tcp)
    const udp: i32 = udpBind("127.0.0.1", 0, 0)
    this.h.listenHttp3(udp, h3QuicConfig(new H3Limits()), h3Config(), slots, new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE))
    this.quicPort = netLocalPort(udp)
    this.text = ascii("text/plain")
    this.octets = ascii("application/octet-stream")
    this.hello = ascii("hello")
    this.big = []
  }

  /** One turn of the server's loop, at most `wait` ms, signing with `key`, then an answer to every request it took. */
  step(wait: i32, key: Secret<u8[]>): void {
    const h: HttpServer = this.h
    const before: i64 = Arena.used()
    h.waitSigned(wait, key)
    this.keep(before)
    while (h.ready()) {
      this.answer(h.take())
    }
  }

  /** Adds what the arena gained since it read `before` to `kept`: all of what is in the chunk, if a new one was opened. */
  private keep(before: i64): void {
    const after: i64 = Arena.used()
    this.kept = this.kept + (after < before ? after : after - before)
  }

  /** The program: each route's answer, and a refusal for the rest. */
  private answer(r: HttpServerRequest): void {
    const h: HttpServer = this.h
    this.taken = this.taken + 1
    if (r.secure) {
      this.secure = this.secure + 1
    }
    const before: i64 = Arena.used()
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
      case BIG:
        if (toI32(this.big.length) === 0) {
          this.big = new Array<u8>(BIG_LENGTH)
        }
        h.send(r, 200, this.octets, this.big, ZERO, BIG_LENGTH)
        break
      default:
        h.refuse(r)
    }
    this.keep(before)
  }
}
