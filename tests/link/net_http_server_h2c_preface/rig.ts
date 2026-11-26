// What the `net_http_server_h2c_*` preface cases share: a server whose
// HTTP/1.1 listener takes h2c peers by their preface (or, `plain`, one that
// does not), one loopback client, and the turns that move bytes between them.
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { Http2Config } from "nish/net/http2"
import { connectResult, netAddress, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollWait, tcpConnect, tcpListen } from "nish:net"
import { bare } from "../net_http_server/taken"
import { ascii, ZERO } from "../net_tls_record_common/bytes"

/** What `netRead` answers when nothing is waiting. */
const AGAIN: i32 = -11

/** A server with one HTTP/1.1 listener and a client connected to it. */
export class Preface {
  h: HttpServer
  client: i32 = -1
  /** Every byte the client has read, in order. */
  got: u8[]
  /** Whether the client has read the server's end of the connection. */
  ended: boolean = false

  /** A server under `limits` whose listener takes h2c peers when `h2c`, and a client connected to it. */
  constructor(limits: HttpServerLimits, h2c: boolean) {
    const h: HttpServer = bare(limits)
    const listener: i32 = tcpListen("127.0.0.1", 0, 8)
    if (h2c) {
      h.listenHttp1(listener, new Http1Config(), toI32(4), new Http2Config())
    } else {
      h.listenHttp1(listener, new Http1Config(), toI32(4))
    }
    const addr: u8[] = new Array<u8>(18)
    netAddress(addr, "127.0.0.1", netLocalPort(listener))
    const client: i32 = tcpConnect(addr)
    const loop: i32 = pollCreate()
    const ready: i32[] = new Array<i32>(2)
    pollAdd(loop, client, 2, ZERO)
    if (pollWait(loop, ready, 5000) !== 1 || connectResult(client) !== 0) {
      panic("connect failed")
    }
    this.h = h
    this.client = client
    this.got = []
  }

  /** Writes `bytes` from the client, whole. */
  send(bytes: u8[]): void {
    if (netWrite(this.client, bytes, ZERO, toI32(bytes.length)) !== toI32(bytes.length)) {
      panic("short write")
    }
  }

  /** Writes `text` from the client, whole. */
  sendText(text: string): void {
    this.send(ascii(text))
  }

  /** Turns the server's loop `n` times, a millisecond each at most. */
  turn(n: i32): void {
    for (let k: i32 = 0; k < n; k++) {
      this.h.wait(toI32(1))
    }
  }

  /** Turns the server until it has a request, and takes it; panics when none comes. */
  take(): HttpServerRequest {
    let turns: i32 = 0
    while (!this.h.ready() && turns < 5000) {
      this.h.wait(toI32(1))
      turns += 1
    }
    if (!this.h.ready()) {
      panic("no request")
    }
    return this.h.take()
  }

  /** Turns the server and reads the client until it holds `want` bytes, or the server's end, or `turns` turns pass. */
  read(want: i32, turns: i32): void {
    const buf: u8[] = new Array<u8>(4096)
    let k: i32 = 0
    while (!this.ended && toI32(this.got.length) < want && k < turns) {
      this.h.wait(toI32(1))
      const n: i32 = netRead(this.client, buf, ZERO, toI32(buf.length))
      if (n > 0) {
        for (let i: i32 = 0; i < n && i < toI32(buf.length); i++) {
          this.got.push(buf[i])
        }
      } else if (n !== AGAIN) {
        this.ended = true
      }
      k += 1
    }
  }

  /** What the client has read, up to its first line end, as text. */
  firstLine(): string {
    let line: string = ""
    for (let i: i32 = 0; i < toI32(this.got.length); i++) {
      const c: i32 = toI32(this.got[i])
      if (c === 13 || c === 10) {
        return line
      }
      line = `${line}${String.fromCharCode(c)}`
    }
    return line
  }
}
