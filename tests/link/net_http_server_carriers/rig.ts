// The server half of `net_http_server_carriers` and `net_http_server_matrix`:
// one `HttpServer` with an HTTP/1.1 listener, an h2c listener, and (when
// signed) an HTTP/2 over TLS listener and an HTTP/3 listener on loopback, and
// the program that answers what it takes. `step` has the shape the scripted clients of
// `tests/link/net_interop_server/client` turn a server's loop with.
import { Secret } from "nish:secret"
import { netLocalPort, tcpListen, udpBind } from "nish:net"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
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
const BIG: i32 = 3
const SLOW: i32 = 4
const DEFER: i32 = 5
const ALT: i32 = 6
const MANY: i32 = 7

/** `/big`'s body: more than the 65535 bytes of an HTTP/2 stream's first window. */
export const RIG_BIG: i32 = 100000

/** The TCP listeners' ports, where the clients read them: HTTP/2 over TLS, h2c, and HTTP/1.1. */
export class RigH2 {
  port: i32 = 0
  h2cPort: i32 = 0
  h1Port: i32 = 0
}

/** `/alt`'s own `alt-svc` value, which the server keeps in place of its advertisement. */
export const RIG_ALT: string = `h3=":443"`

/** How many fields `/many` starts its response with: the default `maxResponseFields`, so the server's own push it past. */
export const RIG_MANY: i32 = 32

/** A server's limits with a pool of `requests` requests. */
export const rigLimits = (requests: i32): HttpServerLimits => {
  const limits = new HttpServerLimits()
  limits.requests = requests
  return limits
}

/** The server, its listeners, and the program answering its requests. */
export class Rig {
  h: HttpServer
  quicPort: i32 = 0
  h2: RigH2
  /** Whether the server has TLS and QUIC listeners, so its loop turns by `waitSigned`, not `wait`. */
  signed: boolean = false
  text: u8[]
  octets: u8[]
  hello: u8[]
  big: u8[]
  /** `/slow`'s requests, held until `answerHeld`. */
  held: HttpServerRequest[]
  /** `/defer`'s requests, answered at the start of the next `step`. */
  deferred: HttpServerRequest[]
  altNames: u8[][]
  altValues: u8[][]
  manyNames: u8[][]
  manyValues: u8[][]
  /** How many requests the program has taken. */
  taken: i32 = 0
  /** What `start` answered for the last `/many`, or 1 before one came. */
  manyResult: i32 = 1

  /** A server under `limits` with `slots` connections per listener: HTTP/1.1 and h2c, and HTTP/2 over TLS and HTTP/3 when `signed`. */
  constructor(limits: HttpServerLimits, signed: boolean, slots: i32) {
    const router = new Router(new RouterLimits())
    router.add("GET", "/hello")
    router.add("GET", "/users/:id")
    router.add("POST", "/echo")
    router.add("GET", "/big")
    router.add("GET", "/slow")
    router.add("GET", "/defer")
    router.add("GET", "/alt")
    router.add("GET", "/many")
    this.h = new HttpServer(limits, router)
    this.signed = signed
    this.h2 = new RigH2()
    const plain: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenHttp1(plain, new Http1Config(), slots)
    this.h2.h1Port = netLocalPort(plain)
    const clear: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenH2c(clear, new Http2Config(), slots)
    this.h2.h2cPort = netLocalPort(clear)
    if (signed) {
      const tcp: i32 = tcpListen("127.0.0.1", 0, 16)
      this.h.listenHttp2Tls(tcp, tcpConfig([H2_ALPN]), new Http2Config(), slots)
      this.h2.port = netLocalPort(tcp)
      const udp: i32 = udpBind("127.0.0.1", 0, 0)
      this.h.listenHttp3(udp, h3QuicConfig(new H3Limits()), h3Config(), slots, new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE))
      this.quicPort = netLocalPort(udp)
    }
    this.held = []
    this.deferred = []
    this.altNames = [ascii("alt-svc")]
    this.altValues = [ascii(RIG_ALT)]
    this.manyNames = []
    this.manyValues = []
    for (let k: i32 = 0; k < RIG_MANY; k++) {
      this.manyNames.push(ascii(`x-${k}`))
      this.manyValues.push(ascii("1"))
    }
    this.text = ascii("text/plain")
    this.octets = ascii("application/octet-stream")
    this.hello = ascii("hello\n")
    this.big = new Array<u8>(RIG_BIG)
  }

  /** One turn of the server's loop, at most `wait` ms, signing with `key` when `signed`, then an answer to every request it took. */
  step(wait: i32, key: Secret<u8[]>, current: Secret<u8[]> | null, previous: Secret<u8[]> | null): void {
    const h: HttpServer = this.h
    if (toI32(this.deferred.length) > 0) {
      const later: HttpServerRequest[] = this.deferred
      this.deferred = []
      for (const r of later) {
        h.send(r, 200, this.text, this.hello, ZERO, toI32(this.hello.length))
      }
    }
    if (this.signed) {
      h.waitSigned(wait, key)
    } else {
      h.wait(wait)
    }
    while (h.ready()) {
      this.answer(h.take())
    }
  }

  /** Answers every request `/slow` holds with `/hello`'s answer; how many there were. */
  answerHeld(): i32 {
    const n: i32 = toI32(this.held.length)
    const held: HttpServerRequest[] = this.held
    this.held = []
    for (const r of held) {
      this.h.send(r, 200, this.text, this.hello, ZERO, toI32(this.hello.length))
    }
    return n
  }

  /** The program: each route's answer, and the refusals for the rest. */
  answer(r: HttpServerRequest): void {
    const h: HttpServer = this.h
    this.taken = this.taken + 1
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
        h.send(r, 200, this.octets, this.big, ZERO, RIG_BIG)
        break
      case SLOW:
        this.held.push(r)
        break
      case DEFER:
        this.deferred.push(r)
        break
      case ALT:
        h.start(r, 200, this.altNames, this.altValues, ZERO)
        h.end(r)
        break
      case MANY:
        this.manyResult = h.start(r, 200, this.manyNames, this.manyValues, ZERO)
        if (this.manyResult === 0) {
          h.end(r)
        }
        break
      default:
        h.refuse(r)
    }
  }
}
