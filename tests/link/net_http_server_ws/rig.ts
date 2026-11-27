// The server half of `net_http_server_ws`: one `HttpServer` with a cleartext
// HTTP/1.1 listener and an h2c listener (and an HTTP/1.1 over TLS one when
// `listenTls` adds it), and the program that upgrades every
// request it takes to a WebSocket and echoes each message, fragmented as
// `tests/link/net_interop_server/ws.ts` does, until the peer closes or sends
// `bye` (`autobahn.ts` turns that off).
import { Secret } from "nish:secret"
import { netLocalPort, tcpListen } from "nish:net"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { H1_AGAIN, Http1Config } from "nish/net/http1-server"
import { Http2Config } from "nish/net/http2"
import { Router, RouterLimits } from "nish/net/router"
import { TlsServerConfig } from "nish/net/tls"
import { WS_CLOSE_INTERNAL_ERROR, WS_CLOSE_NORMAL, WS_OP_CONTINUATION, WS_OP_TEXT } from "nish/net/websocket"
import { WS_FRAGMENT } from "../net_interop_server/ws"

/** The most payload one echoed frame carries: the interop echo's, a quarter of the default 64 KiB output. */
export const RIG_FRAGMENT: i32 = WS_FRAGMENT

/** The server, its listeners, and the program answering its requests. */
export class Rig {
  h: HttpServer
  /** The HTTP/1.1 listener's port. */
  port: i32 = 0
  /** The h2c listener's port. */
  h2cPort: i32 = 0
  /** The HTTP/1.1 over TLS listener's port; 0 until `listenTls`. */
  tlsPort: i32 = 0
  /** The WebSockets the program holds, and how much of each one's message has gone back, -1 between messages. */
  sockets: HttpServerRequest[]
  sent: i32[]
  /** What `acceptWebSocket` answered last. */
  accepted: i32 = 1
  /** How many WebSockets were accepted, and how many messages echoed whole. */
  upgrades: i32 = 0
  echoed: i32 = 0
  /** How many times a message's echo stopped on `H1_AGAIN`, and how many went on when `writable` came. */
  stalled: i32 = 0
  resumed: i32 = 0
  /** The `closeCode` of every WebSocket that came out `closed`, in order. */
  codes: i32[]
  /** Arena bytes the server's own calls left allocated, summed over every `step`. */
  kept: i64 = 0
  /** Whether a 3-byte text message starting `b` has the program close the WebSocket with 1000. */
  bye: boolean = true

  /** A server under `limits` with `slots` connections on each listener, its HTTP/1.1 one under `config` on `port` (0 for any). */
  constructor(limits: HttpServerLimits, slots: i32, config: Http1Config, port: i32) {
    const router = new Router(new RouterLimits())
    router.add("GET", "/ws")
    this.h = new HttpServer(limits, router)
    const plain: i32 = tcpListen("127.0.0.1", port, 16)
    this.h.listenHttp1(plain, config, slots)
    this.port = netLocalPort(plain)
    const clear: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenH2c(clear, new Http2Config(), slots)
    this.h2cPort = netLocalPort(clear)
    this.sockets = []
    this.sent = []
    this.codes = []
  }

  /** Adds an HTTP/1.1 over TLS listener under `tls` with `slots` connections; the loop then turns with `stepSigned`. */
  listenTls(tls: TlsServerConfig, slots: i32): void {
    const fd: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenHttp1Tls(fd, tls, new Http1Config(), slots)
    this.tlsPort = netLocalPort(fd)
  }

  /** One turn of the server's loop, at most `wait` ms, then an answer to everything it handed over. */
  step(wait: i32): void {
    const before: i64 = Arena.used()
    this.h.wait(wait)
    this.keep(before)
    this.answer()
  }

  /** `step` for a rig with a TLS listener: the turn signs each handshake with `key`. */
  stepSigned(wait: i32, key: Secret<u8[]>): void {
    const before: i64 = Arena.used()
    this.h.waitSigned(wait, key)
    this.keep(before)
    this.answer()
  }

  /** Answers every request the turn handed over. */
  private answer(): void {
    const h: HttpServer = this.h
    while (h.ready()) {
      const r: HttpServerRequest = h.take()
      const at: i64 = Arena.used()
      if (r.socket) {
        this.serve(r)
      } else {
        this.upgrade(r)
      }
      this.keep(at)
    }
  }

  /** Adds what the arena gained since it read `before` to `kept`: all of what is in the chunk, if a new one was opened. */
  private keep(before: i64): void {
    const after: i64 = Arena.used()
    this.kept = this.kept + (after < before ? after : after - before)
  }

  /** A new request: upgraded, or answered 400 when it cannot be. */
  private upgrade(r: HttpServerRequest): void {
    this.accepted = this.h.acceptWebSocket(r, "")
    if (this.accepted !== 0) {
      this.h.empty(r, 400)
      return
    }
    this.upgrades = this.upgrades + 1
    this.sockets.push(r)
    this.sent.push(-1)
  }

  /** Where `r` is in `sockets`. */
  private indexOf(r: HttpServerRequest): i32 {
    for (let i: i32 = 0; i < toI32(this.sockets.length); i++) {
      if (this.sockets[i] === r) {
        return i
      }
    }
    panic("net_http_server_ws: a WebSocket the program does not hold")
  }

  /** A WebSocket came out again: it closed, holds a message, or has room for the rest of one. */
  private serve(r: HttpServerRequest): void {
    const h: HttpServer = this.h
    const i: i32 = this.indexOf(r)
    if (r.closed) {
      this.codes.push(r.closeCode)
      this.forget(i)
      h.closeWebSocket(r, WS_CLOSE_NORMAL)
      return
    }
    if (!r.message) {
      return
    }
    if (this.sent[i] < 0) {
      if (this.bye && r.opcode === WS_OP_TEXT && r.messageLength === 3 && r.messageData[r.messageStart] === toU8(98)) {
        this.forget(i)
        h.closeWebSocket(r, WS_CLOSE_NORMAL)
        return
      }
      this.sent[i] = 0
    } else if (r.writable) {
      this.resumed = this.resumed + 1
    }
    this.pump(r, i)
  }

  /** Drops `sockets[i]` from the program's list. */
  private forget(i: i32): void {
    const last: i32 = toI32(this.sockets.length) - 1
    this.sockets[i] = this.sockets[last]
    this.sent[i] = this.sent[last]
    this.sockets.pop()
    this.sent.pop()
  }

  /** Sends the held message's next frames until it is all sent or the output is full; hands it back once sent. */
  private pump(r: HttpServerRequest, i: i32): void {
    const h: HttpServer = this.h
    while (this.sent[i] >= 0) {
      const done: i32 = this.sent[i]
      const left: i32 = r.messageLength - done
      const n: i32 = left < RIG_FRAGMENT ? left : RIG_FRAGMENT
      const opcode: i32 = done === 0 ? r.opcode : WS_OP_CONTINUATION
      const result: i32 = h.sendFrame(r, n === left, opcode, r.messageData, r.messageStart + done, n)
      if (result === H1_AGAIN) {
        this.stalled = this.stalled + 1
        return
      }
      if (result !== 0) {
        this.forget(i)
        h.closeWebSocket(r, WS_CLOSE_INTERNAL_ERROR)
        return
      }
      if (n === left) {
        this.sent[i] = -1
        this.echoed = this.echoed + 1
        h.received(r)
      } else {
        this.sent[i] = done + n
      }
    }
  }
}

/** A server's limits with a pool of `requests` requests and the given `bodyTimeout`. */
export const rigLimits = (requests: i32, bodyTimeout: i32): HttpServerLimits => {
  const limits = new HttpServerLimits()
  limits.requests = requests
  limits.bodyTimeout = bodyTimeout
  return limits
}
