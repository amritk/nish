// The server half of `net_http_server_stream`: one `HttpServer` with an
// HTTP/1.1 listener, an h2c listener and an HTTP/2 over TLS listener on
// loopback, whose routes `/upload`, `/lazy` and `/early` take their body in
// pieces (`HttpServer.streamBody`), and the program that reads them.
import { Secret } from "nish:secret"
import { netLocalPort, tcpListen } from "nish:net"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { Http2Config } from "nish/net/http2"
import { H2_ALPN } from "nish/net/http2-tls"
import { Router, RouterLimits } from "nish/net/router"
import { tcpConfig } from "../net_tls_common/server"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

// The routes, in the order they are added.
const UPLOAD: i32 = 0
const LAZY: i32 = 1
const EARLY: i32 = 2
const ECHO: i32 = 3

/** The server's `maxBody`: a streamed body runs to many times this. */
export const STREAM_MAX_BODY: i32 = 1000

/** The server, its listeners, and the program reading its streamed bodies. */
export class StreamRig {
  h: HttpServer
  /** The ports of the HTTP/2 over TLS, h2c and HTTP/1.1 listeners. */
  tlsPort: i32 = 0
  h2cPort: i32 = 0
  h1Port: i32 = 0
  text: u8[]
  /** Body bytes `/upload` consumed of the request it is reading. */
  total: i32 = 0
  /** The most body bytes any streamed request held unconsumed when taken, and the longest its `body` array grew. */
  maxHeld: i32 = 0
  maxArray: i32 = 0
  /** How many times the program took a request, and took one hung up. */
  takes: i32 = 0
  hung: i32 = 0
  /** What each answer to a hung-up request returned. */
  hungResults: i32[]
  /** `streaming`/`bodyEnded` as each request was first taken, and what `pending` said then. */
  firsts: string[]
  /** What each answered request was answered with: route, then the body length the answer names. */
  answers: string[]
  /** The requests the program is part way through. */
  reading: HttpServerRequest[]

  /** A server under `limits`, with `slots` connections per listener. */
  constructor(limits: HttpServerLimits, slots: i32) {
    const router = new Router(new RouterLimits())
    router.add("POST", "/upload")
    router.add("POST", "/lazy")
    router.add("POST", "/early")
    router.add("POST", "/echo")
    this.h = new HttpServer(limits, router)
    this.h.streamBody(UPLOAD)
    this.h.streamBody(LAZY)
    this.h.streamBody(EARLY)
    // Marking a route twice is the same as once.
    this.h.streamBody(EARLY)
    const plain: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenHttp1(plain, new Http1Config(), slots)
    this.h1Port = netLocalPort(plain)
    const clear: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenH2c(clear, new Http2Config(), slots)
    this.h2cPort = netLocalPort(clear)
    const tcp: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenHttp2Tls(tcp, tcpConfig([H2_ALPN]), new Http2Config(), slots)
    this.tlsPort = netLocalPort(tcp)
    this.text = ascii("text/plain")
    this.hungResults = []
    this.firsts = []
    this.answers = []
    this.reading = []
  }

  /** One turn of the server's loop, at most `wait` ms, then the program's turn at every request it can take. */
  step(wait: i32, key: Secret<u8[]>): void {
    this.h.waitSigned(wait, key)
    while (this.h.ready()) {
      this.answer(this.h.take())
    }
  }

  /** Answers `r` with 200 and `text` as its body. */
  private say(r: HttpServerRequest, text: string): void {
    const body: u8[] = ascii(text)
    this.answers.push(`${r.route} ${text}`)
    this.forget(r)
    this.h.send(r, 200, this.text, body, ZERO, toI32(body.length))
  }

  /** The program's turn at `r`: a hung-up request answered, then each route's reading. */
  answer(r: HttpServerRequest): void {
    const h: HttpServer = this.h
    this.takes = this.takes + 1
    if (r.bodyLength > this.maxHeld) {
      this.maxHeld = r.bodyLength
    }
    if (r.streaming && toI32(r.body.length) > this.maxArray) {
      this.maxArray = toI32(r.body.length)
    }
    if (h.hungUp(r)) {
      this.hung = this.hung + 1
      this.total = 0
      this.forget(r)
      this.hungResults.push(h.send(r, 200, this.text, this.text, ZERO, ZERO))
      return
    }
    if (this.first(r)) {
      this.firsts.push(`${r.route} ${r.streaming}/${r.bodyEnded} pending ${h.pending(r)}`)
    }
    switch (r.route) {
      case UPLOAD:
        this.total = this.total + r.bodyLength
        h.consume(r, r.bodyLength)
        if (r.bodyEnded) {
          const total: i32 = this.total
          this.total = 0
          this.say(r, `${total}`)
        }
        break
      case LAZY:
        if (r.bodyEnded) {
          this.say(r, `${r.bodyLength}`)
        }
        break
      case EARLY:
        this.say(r, "early")
        break
      case ECHO:
        this.say(r, `${r.bodyLength}`)
        break
      default:
        h.refuse(r)
    }
  }

  /** Whether this is the first time the program takes `r`; it is part way through `r` from now on. */
  private first(r: HttpServerRequest): boolean {
    for (const seen of this.reading) {
      if (seen === r) {
        return false
      }
    }
    this.reading.push(r)
    return true
  }

  /** The program is done with `r`. */
  private forget(r: HttpServerRequest): void {
    const kept: HttpServerRequest[] = []
    for (const seen of this.reading) {
      if (seen !== r) {
        kept.push(seen)
      }
    }
    this.reading = kept
  }
}
