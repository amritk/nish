// The server half of `net_http_server_carriers` and `net_http_server_matrix`:
// one `HttpServer` with an HTTP/1.1 listener, an h2c listener, and (when
// signed) an HTTP/2 over TLS listener and an HTTP/3 listener on loopback, and
// the program that answers what it takes. `step` has the shape the scripted clients of
// `tests/link/net_interop_server/client` turn a server's loop with.
import { Secret } from "nish:secret"
import { netLocalPort, tcpListen, udpBind } from "nish:net"
import { HANDLER_ABSENT, HANDLER_ANSWERED } from "nish/net/handler"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { HTTP1_CHUNKED } from "nish/net/http1-codec"
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
const TRAILERS: i32 = 8
const TRAILERS_BARE: i32 = 9
const TRAILERS_BIG: i32 = 10
const TRAILERS_MANY: i32 = 11
const TRAILERS_HUGE: i32 = 12
const TRAILERS_HOLD: i32 = 13
const STEPPED: i32 = 14
const GUARDED: i32 = 15
const SIZED: i32 = 16

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

/** `/trailers-huge`'s trailer value: longer than an HTTP/2 connection's whole output buffer. */
export const RIG_HUGE: i32 = 70000

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
  /** Arena bytes the server's own `wait` and `send` calls left allocated, summed over every `step` and `answerHeld`. */
  kept: i64 = 0
  /** What `start` answered for the last `/many`, or 1 before one came. */
  manyResult: i32 = 1
  /** The trailer section of `/trailers`, `/trailers-bare` and `/trailers-big`: `grpc-status: 0`, `grpc-message: ok`. */
  trailerNames: u8[][]
  trailerValues: u8[][]
  /** One more trailer field than `maxResponseFields` admits, for `/trailers-many`. */
  overNames: u8[][]
  overValues: u8[][]
  /** A trailer value too long for the output buffer, for `/trailers-huge`. */
  hugeNames: u8[][]
  hugeValues: u8[][]
  /** What `trailers` answered for each trailer route, in the order they came. */
  trailerResults: i32[]
  /** `/trailers-hold`'s requests, started and held for the program to end with `trailers`. */
  streaming: HttpServerRequest[]
  /**
   * The steps `Router.use` binds to `/stepped` and `/guarded` alone, so no
   * other route runs one: `id` adds `x-request-id`, `auth` refuses a request
   * with no `authorization` field with 401, and `tag` adds `x-tag` after the body.
   * `size`, bound to `/sized` alone, adds the fields the server adds itself:
   * `alt-svc: clear`, and on HTTP/2 and HTTP/3 `content-length: 6`.
   */
  id: i32 = 0
  auth: i32 = 0
  tag: i32 = 0
  size: i32 = 0
  /** How many requests `id` has named, the number in its `x-request-id`. */
  named: i32 = 0
  /** What the steps of the last stepped request did, in order: `id`, `auth`, `body`, `tag`. */
  ran: string = ""
  idName: u8[]
  tagName: u8[]
  tagValue: u8[]
  altName: u8[]
  clearValue: u8[]
  lengthName: u8[]
  sixValue: u8[]

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
    router.add("GET", "/trailers")
    router.add("GET", "/trailers-bare")
    router.add("GET", "/trailers-big")
    router.add("GET", "/trailers-many")
    router.add("GET", "/trailers-huge")
    router.add("GET", "/trailers-hold")
    router.add("GET", "/stepped")
    router.add("GET", "/guarded")
    router.add("GET", "/sized")
    this.id = router.step()
    this.auth = router.step()
    this.tag = router.step()
    this.size = router.step()
    router.use(STEPPED, this.id)
    router.use(STEPPED, this.tag)
    router.use(GUARDED, this.id)
    router.use(GUARDED, this.auth)
    router.use(SIZED, this.size)
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
    this.trailerNames = [ascii("grpc-status"), ascii("grpc-message")]
    this.trailerValues = [ascii("0"), ascii("ok")]
    this.overNames = []
    this.overValues = []
    for (let k: i32 = 0; k <= limits.maxResponseFields; k++) {
      this.overNames.push(ascii(`x-${k}`))
      this.overValues.push(ascii("1"))
    }
    const huge: u8[] = new Array<u8>(RIG_HUGE)
    for (let k: i32 = 0; k < RIG_HUGE; k++) {
      huge[k] = 97
    }
    this.hugeNames = [ascii("x-huge")]
    this.hugeValues = [huge]
    this.trailerResults = []
    this.streaming = []
    this.text = ascii("text/plain")
    this.octets = ascii("application/octet-stream")
    this.hello = ascii("hello\n")
    this.big = new Array<u8>(RIG_BIG)
    this.idName = ascii("x-request-id")
    this.tagName = ascii("x-tag")
    this.tagValue = ascii("on")
    this.altName = ascii("alt-svc")
    this.clearValue = ascii("clear")
    this.lengthName = ascii("content-length")
    this.sixValue = ascii("6")
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
    const before: i64 = Arena.used()
    if (this.signed) {
      h.waitSigned(wait, key)
    } else {
      h.wait(wait)
    }
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

  /** Answers every request `/slow` holds with `/hello`'s answer; how many there were. */
  answerHeld(): i32 {
    const n: i32 = toI32(this.held.length)
    const held: HttpServerRequest[] = this.held
    this.held = []
    for (const r of held) {
      const before: i64 = Arena.used()
      this.h.send(r, 200, this.text, this.hello, ZERO, toI32(this.hello.length))
      this.keep(before)
    }
    return n
  }

  /** The program: each route's answer, and the refusals for the rest. */
  answer(r: HttpServerRequest): void {
    const h: HttpServer = this.h
    this.taken = this.taken + 1
    if (r.route === STEPPED || r.route === GUARDED) {
      this.ran = ""
    }
    let s: i32 = h.before(r)
    while (s >= 0) {
      if (s === this.id) {
        this.ran = `${this.ran}id `
        h.field(r, this.idName, ascii(`${this.named}`))
        this.named = this.named + 1
      } else if (s === this.auth) {
        this.ran = `${this.ran}auth `
        if (r.header("authorization") === HANDLER_ABSENT) {
          h.problem(r, 401, "Unauthorized", "")
        }
      } else if (s === this.size) {
        h.field(r, this.altName, this.clearValue)
        if (r.version !== 1) {
          h.field(r, this.lengthName, this.sixValue)
        }
      }
      s = h.before(r)
    }
    if (s === HANDLER_ANSWERED) {
      return
    }
    if (r.route === STEPPED || r.route === GUARDED) {
      this.ran = `${this.ran}body`
    }
    let a: i32 = h.after(r)
    while (a >= 0) {
      if (a === this.tag) {
        this.ran = `${this.ran} tag`
        h.field(r, this.tagName, this.tagValue)
      }
      a = h.after(r)
    }
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
      case TRAILERS:
        h.start(r, 200, this.altNames, this.altValues, HTTP1_CHUNKED)
        h.write(r, this.hello, ZERO, toI32(this.hello.length))
        this.trailerResults.push(h.trailers(r, this.trailerNames, this.trailerValues))
        break
      case TRAILERS_BARE:
        h.start(r, 200, this.altNames, this.altValues, HTTP1_CHUNKED)
        this.trailerResults.push(h.trailers(r, this.trailerNames, this.trailerValues))
        break
      case TRAILERS_BIG:
        h.start(r, 200, this.altNames, this.altValues, RIG_BIG)
        h.write(r, this.big, ZERO, RIG_BIG)
        this.trailerResults.push(h.trailers(r, this.trailerNames, this.trailerValues))
        break
      case TRAILERS_MANY:
        h.start(r, 200, this.altNames, this.altValues, HTTP1_CHUNKED)
        this.trailerResults.push(h.trailers(r, this.overNames, this.overValues))
        break
      case TRAILERS_HUGE:
        h.start(r, 200, this.altNames, this.altValues, HTTP1_CHUNKED)
        this.trailerResults.push(h.trailers(r, this.hugeNames, this.hugeValues))
        break
      case TRAILERS_HOLD:
        h.start(r, 200, this.altNames, this.altValues, HTTP1_CHUNKED)
        this.streaming.push(r)
        break
      case STEPPED:
      case GUARDED:
      case SIZED:
        h.send(r, 200, this.text, this.hello, ZERO, toI32(this.hello.length))
        break
      default:
        h.refuse(r)
    }
  }
}
