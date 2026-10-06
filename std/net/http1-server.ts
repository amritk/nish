/**
 * `nish/net/http1-server` — the server side of HTTP/1.1 (RFC 9112): a
 * sans-IO connection that drives `nish/net/http1`'s parser, and two pools of
 * them for a program that owns its readiness loop, one on `nish:net`'s plain
 * TCP and one on `nish/net/tls-tcp` with ALPN `http/1.1`.
 *
 *     const listener = tcpListen("0.0.0.0", 8080, 128);
 *     const server = new Http1Server(new Http1Config(), listener, 64);
 *     // when the listener is readable:
 *     const slot: i32 = server.accept();
 *     if (slot >= 0) { pollAdd(loop, server.fd(slot), 1, slot); }
 *     // when a connection's token comes back:
 *     let wants: i32 = (events & 5) !== 0 ? server.readable(slot) : server.writable(slot);
 *     let event: i32 = server.next(slot);
 *     while (event !== H1_NEED_MORE && event !== H1_ERROR) {
 *       const conn: Http1Connection = server.connection(slot);
 *       // H1_REQUEST: conn.parser.methodIs("GET"), conn.parser.targetIs("/"), ...
 *       //   conn.respond(200, names, values, HTTP1_CHUNKED)
 *       // H1_BODY: conn.data[conn.dataStart .. conn.dataStart + conn.dataLength)
 *       // H1_END: conn.write(body, 0, n); conn.end()
 *       event = server.next(slot);
 *     }
 *     wants = server.flush(slot);
 *     if ((wants & H1_DONE) !== 0) { server.close(slot); }
 *     else { pollModify(loop, server.fd(slot), wants & 3, slot); }
 *
 * **Events.** `next()` answers `H1_REQUEST` (a request's head: the parser's
 * spans and `...Is` methods read it), `H1_BODY` (some of its body, de-chunked,
 * a window that stays valid until the next `next()`), `H1_END` (the request
 * is complete), `H1_WRITE` (a write that was held back may be tried again),
 * `H1_WS_MESSAGE` and `H1_WS_CLOSE` once the slot has switched to WebSocket,
 * and `H1_ERROR`, final: the request broke a rule, the response that says so
 * is queued, and the connection closes once it is sent. `H1_NEED_MORE` asks
 * for more input, for the output to drain, or for the program to finish the
 * response it owes.
 *
 * **One exchange at a time.** A request is answered before the next one on
 * the connection is read: `respond`, any number of `write`s, `end`. The
 * program may answer at once (before the body has arrived) or after
 * `H1_END`; either way the request's body is read to its end before the next
 * request starts, which is what keeps pipelined requests in order (§9.3.2).
 * Pipelined bytes wait in the parser's buffer, and once it holds
 * `inputLimit()` bytes the connection stops asking for input, so the client's
 * TCP window closes: back-pressure on the way in.
 *
 * **Streaming both ways.** A request body arrives a chunk at a time, at most
 * `chunkSize` bytes in each `H1_BODY`, whether it was sent with
 * `Content-Length` or chunked. A response is written with a length or
 * chunked, a `write` at a time into the output buffer; a `write` takes what
 * fits and answers how much, and when it could not take everything the
 * connection answers `H1_NEED_MORE` until the socket has drained half the
 * output, then `H1_WRITE`. Until then it reads nothing, so the window the
 * program is writing from stays valid: back-pressure on the way out. Nothing
 * buffers a whole body.
 *
 * **What the server decides.** The framing field (`Content-Length` or
 * `Transfer-Encoding: chunked`) and the `Connection` field are the server's;
 * the program's fields may not hold either, nor `Upgrade`, `Keep-Alive` or
 * `Content-Length`. A request that did not ask to keep the connection open
 * gets `Connection: close` and the connection closes after it; an HTTP/1.0
 * request that asked for keep-alive gets `Connection: keep-alive`; a chunked
 * response to an HTTP/1.0 request is sent unframed and ends with the
 * connection, since chunked is HTTP/1.1's. A response to HEAD, and a 204 or
 * 304, carries no body whatever the program writes (RFC 9110 §9.3.2, §15.3.5,
 * §15.4.5). A 1xx before the final response (100 Continue) is allowed; 101 is
 * `acceptWebSocket`'s.
 *
 * **Refusals.** Every refusal of `nish/net/http1`'s parser — the smuggling
 * shapes, a `Content-Length` with a `Transfer-Encoding`, two that disagree,
 * a malformed chunk size — is answered with its status (400, 413, 414, 431,
 * 501, 505), `Content-Length: 0` and `Connection: close`, and ends the
 * connection; so does a malformed WebSocket frame, with its close code.
 * `docs/security/http1.md` is the record.
 *
 * **WebSocket.** A request that asked to upgrade reaches the program like any
 * other; `acceptWebSocket(protocol)` answers it with the 101 of
 * `nish/net/websocket` when it is a valid opening handshake (RFC 6455 §4.2),
 * and once its exchange is over the slot reads frames with a `WsDecoder`
 * instead of requests, the bytes that followed the request included. A ping
 * is answered with a pong and a close with a close, by the connection.
 *
 * **Caps are start-up numbers**, all in `Http1Config`: the request target,
 * the header section and its field count, a request body, the chunk handed
 * over, the output buffer, a WebSocket message and the idle timeout; the
 * slots are the pool's size. Every buffer is allocated by the constructor or
 * grown to its cap on first use and kept, so a warmed slot serves request
 * after request with `Arena.used()` flat. Accepting a WebSocket allocates
 * (the accept key), once a connection.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9112, RFC 9110 and RFC 6455, not ported from another
 * implementation.
 */
import { Secret } from "nish:secret"
import { netClose, netRead, netWrite, tcpAccept } from "nish:net"
import {
  HTTP1_BODY,
  HTTP1_CHUNKED,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_HEAD,
  HTTP1_NO_BODY,
  HTTP1_REFUSED,
  HTTP1_UPGRADE,
  Http1Parser,
  http1WriteChunk,
  http1WriteResponseHead,
} from "nish/net/http1"
import {
  WS_CLOSE,
  WS_CLOSE_NO_STATUS,
  WS_ERROR,
  WS_MAX_CONTROL,
  WS_MESSAGE,
  WS_NEED_MORE,
  WS_OP_CLOSE,
  WS_OP_PONG,
  WS_PING,
  WsDecoder,
  websocketClosePayload,
  websocketFrameSize,
  websocketRequestKey,
  websocketUpgradeResponse,
  websocketWriteFrame,
} from "nish/net/websocket"
import { TlsServerConfig } from "nish/net/tls"
import { TLS_RECORD_DONE, TLS_RECORD_STATE_OPEN, TLS_RECORD_WANT_WRITE } from "nish/net/tls/record-server"
import { TlsTcpServer } from "nish/net/tls-tcp"

/** `next`: nothing to hand over until more input arrives, the output drains, or the program answers. */
export const H1_NEED_MORE: i32 = 0
/** A request's head was read: `parser` holds it. */
export const H1_REQUEST: i32 = 1
/** Request body bytes: `data[dataStart .. dataStart + dataLength)`, valid until the next `next()`. */
export const H1_BODY: i32 = 2
/** The request is complete. */
export const H1_END: i32 = 3
/** A `write`, `respond`, `end` or `sendFrame` that answered `H1_AGAIN` may be tried again. */
export const H1_WRITE: i32 = 4
/** A WebSocket message: `opcode`, `data[dataStart .. dataStart + dataLength)`. */
export const H1_WS_MESSAGE: i32 = 5
/** The WebSocket peer closed with `status` (1005 for none); the close is answered. Final. */
export const H1_WS_CLOSE: i32 = 6
/** The input broke a rule; `status` is the HTTP status or WebSocket close code sent. Final. */
export const H1_ERROR: i32 = 7

/** Nothing fits yet: Linux's EAGAIN, as `nish:net` spells it. */
export const H1_AGAIN: i32 = -11
/** Something the server may not send: Linux's EINVAL. */
export const H1_INVALID: i32 = -22
/** No exchange the call belongs to: Linux's EPIPE. */
export const H1_CLOSED: i32 = -32
/** `accept`: every slot was busy, so the connection was accepted and closed. Linux's ENOBUFS. */
export const H1_POOL_FULL: i32 = -105

/** Interest bits, the same as `nish/net/tls/record-server`'s: the low two are `pollModify`'s events. */
export const H1_WANT_READ: i32 = 1
export const H1_WANT_WRITE: i32 = 2
/** The slot's connection is over and every byte is sent: `close` it. */
export const H1_DONE: i32 = 16

/** The ALPN protocol identifier of HTTP/1.1 (RFC 7301 §6). */
export const H1_ALPN: string = "http/1.1"

/** A typed zero: a bare literal is an `f64` under `--number-mode f64`. */
const H1_ZERO: i32 = 0

/** A free slot's descriptor. */
const H1_FREE: i32 = -1

/** The address form's length, from `nish:net`. */
const H1_ADDRESS_SIZE: i32 = 18

/**
 * Output kept free of response bytes and frames, so that what the connection
 * writes on its own — an error response, a pong, a close frame — always fits.
 */
const H1_CONTROL_RESERVE: i32 = 256

/** The most a chunk's framing adds: eight hex digits and two CRLFs. */
const H1_CHUNK_OVERHEAD: i32 = 12

/** The longest request line a head can need beyond the target: the method, two spaces, the version, CRLF. */
const H1_LINE_OVERHEAD: i32 = 44

// The connection's states.
const H1_S_HTTP: i32 = 0
const H1_S_WEBSOCKET: i32 = 1
/** Sending what is left, then done. */
const H1_S_CLOSING: i32 = 2
/** `H1_ERROR` was answered; sending what is left, then done. */
const H1_S_FAILED: i32 = 3

// Where the current exchange's response stands.
const H1_R_NONE: i32 = 0
const H1_R_BODY: i32 = 1
const H1_R_DONE: i32 = 2

/** Panics unless `value` is in `low .. high`: a cap no connection could work with is the program's mistake. */
const http1ServerCheckCap = (name: string, value: i32, low: i32, high: i32): void => {
  if (value < low || value > high) {
    panic(`Http1Config.${name}: ${value} is outside ${low} to ${high}`)
  }
}

/**
 * The caps of every connection made from it, fixed when the connection is
 * made. Each is a number the program sets once, at start-up.
 */
export class Http1Config {
  /** The longest request target; past it, 414. */
  maxTarget: i32 = 8192
  /** The longest header section, and trailer section; past it, 431. */
  maxHeaderBytes: i32 = 16384
  /** The most fields in a header section, trailers counted; past it, 431. */
  maxHeaders: i32 = 100
  /** The longest request body, declared or de-chunked; past it, 413. */
  maxBody: i32 = 1073741824
  /** The most body bytes one `H1_BODY` hands over, and how much is read from the socket at once. */
  chunkSize: i32 = 16384
  /** The output buffer, in bytes: the most of a response waiting for the socket. */
  outputSize: i32 = 65536
  /** The longest WebSocket message, its fragments together; past it, close 1009. */
  maxMessage: i32 = 1048576
  /** Milliseconds without a byte read or written after which `expire` closes a slot. */
  idleTimeout: i32 = 60000
}

/** The reason phrase a status is sent with; RFC 9112 §4 lets a client ignore it. */
const http1ServerReason = (status: i32): string => {
  switch (status) {
    case 100:
      return "Continue"
    case 101:
      return "Switching Protocols"
    case 200:
      return "OK"
    case 201:
      return "Created"
    case 204:
      return "No Content"
    case 206:
      return "Partial Content"
    case 301:
      return "Moved Permanently"
    case 302:
      return "Found"
    case 304:
      return "Not Modified"
    case 400:
      return "Bad Request"
    case 403:
      return "Forbidden"
    case 404:
      return "Not Found"
    case 405:
      return "Method Not Allowed"
    case 408:
      return "Request Timeout"
    case 413:
      return "Content Too Large"
    case 414:
      return "URI Too Long"
    case 426:
      return "Upgrade Required"
    case 431:
      return "Request Header Fields Too Large"
    case 500:
      return "Internal Server Error"
    case 501:
      return "Not Implemented"
    case 503:
      return "Service Unavailable"
    case 505:
      return "HTTP Version Not Supported"
    default:
      return "Status"
  }
}

/** Whether `name` is one of the fields the server decides and a program may not send. */
const http1ServerReserved = (name: u8[]): boolean => {
  const n: i32 = toI32(name.length)
  const words: string[] = ["connection", "upgrade", "keep-alive", "transfer-encoding", "content-length"]
  for (const word of words) {
    if (toI32(word.length) === n && http1ServerSameWord(name, word)) {
      return true
    }
  }
  return false
}

/** Whether `bytes` is `word`, which is lowercase and as long, in any ASCII case. */
const http1ServerSameWord = (bytes: u8[], word: string): boolean => {
  for (let k: i32 = 0; k < toI32(bytes.length) && k < toI32(word.length); k++) {
    let c: i32 = toI32(bytes[k])
    if (c >= 65 && c <= 90) {
      c = c + 32
    }
    if (c !== toI32(word.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/**
 * One connection's HTTP/1.1 server, sans-IO: bytes in through `feed`, events
 * out of `next`, and the response the program writes in
 * `output[outputStart .. outputEnd)` for its carrier to send.
 */
export class Http1Connection {
  // References, then 64-bit fields, then 32-bit ones, then flags: the order
  // the layout packs without padding.
  config: Http1Config
  /** The request parser: its head (`methodIs`, `targetIs`, `header`, spans) is the last `H1_REQUEST`'s. */
  parser: Http1Parser
  /** The frame decoder, once the slot has switched to WebSocket. */
  ws: WsDecoder
  /** Bytes to send are `output[outputStart .. outputEnd)`. */
  output: u8[]
  /** `H1_BODY`'s and `H1_WS_MESSAGE`'s bytes. */
  data: u8[]
  /** A ping's payload, kept until its pong fits. */
  pong: u8[]
  /** When the carrier last moved a byte for the connection, in `monotonicNanos`. */
  lastActive: i64 = 0
  outputStart: i32 = 0
  outputEnd: i32 = 0
  dataStart: i32 = 0
  dataLength: i32 = 0
  /** `H1_WS_MESSAGE`'s opcode: text or binary. */
  opcode: i32 = 0
  /** `H1_ERROR`'s HTTP status or WebSocket close code, or `H1_WS_CLOSE`'s close code. */
  status: i32 = 0
  /** The most input the connection buffers, unread: the cap `inputRoom` holds it to. */
  bufferLimit: i32 = 0
  pongLength: i32 = 0
  state: i32 = 0
  response: i32 = 0
  /** A response with a length: the bytes it still owes. */
  responseLeft: i32 = 0
  /** The response is chunked, or has a length; with neither it ends with the connection. */
  responseChunked: boolean = false
  responseLength: boolean = false
  /** The response carries no body (HEAD, 204, 304): what is written is dropped. */
  responseEmpty: boolean = false
  /** A request's head has been read and its exchange is not over. */
  requestOpen: boolean = false
  /** The request's body has been read to its end. */
  requestEnded: boolean = false
  /** The connection closes once this exchange is over. */
  closeAfter: boolean = false
  /** The program accepted the request's WebSocket handshake. */
  upgraded: boolean = false
  /** A write was held back; `next` answers nothing but `H1_WRITE` until there is room. */
  writeHeld: boolean = false
  pongPending: boolean = false
  /** The peer's byte stream has ended. */
  inputEnded: boolean = false

  /** A connection under `config`. A cap outside what the connection can work with panics. */
  constructor(config: Http1Config) {
    const big: i32 = 1073741824
    const one: i32 = 1
    const smallest: i32 = 64
    const output: i32 = 1024
    http1ServerCheckCap("maxTarget", config.maxTarget, one, big)
    http1ServerCheckCap("maxHeaderBytes", config.maxHeaderBytes, smallest, big)
    http1ServerCheckCap("maxHeaders", config.maxHeaders, one, big)
    http1ServerCheckCap("maxBody", config.maxBody, H1_ZERO, big)
    http1ServerCheckCap("chunkSize", config.chunkSize, one, big)
    http1ServerCheckCap("outputSize", config.outputSize, output, big)
    http1ServerCheckCap("maxMessage", config.maxMessage, H1_ZERO, big)
    http1ServerCheckCap("idleTimeout", config.idleTimeout, one, big)
    this.config = config
    this.parser = new Http1Parser(config.maxTarget, config.maxHeaderBytes, config.maxHeaders, config.maxBody)
    this.parser.keepText = false
    this.parser.maxChunk = config.chunkSize
    this.ws = new WsDecoder(true, config.maxMessage)
    this.output = new Array<u8>(config.outputSize)
    this.data = this.output
    this.pong = new Array<u8>(WS_MAX_CONTROL)
    // A line must fit whole before the parser can read it, so the buffer
    // holds the longest request line or field line however small a chunk is.
    let limit: i32 = config.chunkSize
    if (config.maxHeaderBytes + 2 > limit) {
      limit = config.maxHeaderBytes + 2
    }
    if (config.maxTarget + H1_LINE_OVERHEAD > limit) {
      limit = config.maxTarget + H1_LINE_OVERHEAD
    }
    this.bufferLimit = limit
    this.restart()
  }

  /** Puts the connection back as the constructor left it, for the next peer. It allocates nothing. */
  restart(): void {
    this.parser.restart()
    this.ws.reset()
    this.outputStart = 0
    this.outputEnd = 0
    this.data = this.output
    this.dataStart = 0
    this.dataLength = 0
    this.opcode = 0
    this.status = 0
    this.pongLength = 0
    this.state = H1_S_HTTP
    this.response = H1_R_NONE
    this.responseLeft = 0
    this.responseChunked = false
    this.responseLength = false
    this.responseEmpty = false
    this.requestOpen = false
    this.requestEnded = false
    this.closeAfter = false
    this.upgraded = false
    this.writeHeld = false
    this.pongPending = false
    this.inputEnded = false
  }

  // ---- Bytes in and out ---------------------------------------------------------

  /** The most input the connection holds unread: what `inputRoom` counts against. */
  inputLimit(): i32 {
    return this.state === H1_S_WEBSOCKET ? this.config.maxMessage + 14 : this.bufferLimit
  }

  /** How many bytes `feed` would take now: none while a write is held back or once the connection is closing. */
  inputRoom(): i32 {
    if (this.writeHeld || this.inputEnded || this.state === H1_S_CLOSING || this.state === H1_S_FAILED) {
      return 0
    }
    const held: i32 = this.state === H1_S_WEBSOCKET ? this.ws.end - this.ws.start : this.parser.buffered()
    const room: i32 = this.inputLimit() - held
    return room > 0 ? room : 0
  }

  /**
   * Takes as much of `buf[off .. off + len)` as `inputRoom` allows and
   * answers how much; the rest is the caller's to feed again later. A window
   * outside `buf` panics.
   */
  feed(buf: u8[], off: i32, len: i32): i32 {
    const size: i32 = toI32(buf.length)
    if (off < 0 || len < 0 || off > size || len > size - off) {
      panic("Http1Connection.feed: the window is outside the buffer")
    }
    const room: i32 = this.inputRoom()
    const n: i32 = len < room ? len : room
    if (n <= 0) {
      return 0
    }
    if (this.state === H1_S_WEBSOCKET) {
      this.ws.feed(buf, off, n)
    } else {
      this.parser.feed(buf, off, n)
    }
    return n
  }

  /** The peer's byte stream has ended: once what it sent is answered, the connection is done. */
  endInput(): void {
    this.inputEnded = true
  }

  /** The socket failed: nothing more is sent or read, and the connection is done. */
  abort(): void {
    this.state = H1_S_FAILED
    this.outputStart = 0
    this.outputEnd = 0
    this.pongPending = false
    this.writeHeld = false
  }

  /** Marks the first `n` bytes of the output sent. */
  consume(n: i32): void {
    const pending: i32 = this.outputEnd - this.outputStart
    this.outputStart = this.outputStart + (n < pending ? n : pending)
    if (this.outputStart === this.outputEnd) {
      this.outputStart = 0
      this.outputEnd = 0
    }
  }

  /** Whether the output holds bytes to send. */
  wantsWrite(): boolean {
    return this.outputEnd > this.outputStart
  }

  /** Whether the connection is over and everything is sent: the carrier closes it. */
  isDone(): boolean {
    return (
      (this.state === H1_S_CLOSING || this.state === H1_S_FAILED) && !this.wantsWrite() && !this.pongPending
    )
  }

  /** The room at the end of the output, once what was sent is moved out of the way. */
  room(): i32 {
    const output: u8[] = this.output
    const live: i32 = this.outputEnd - this.outputStart
    if (this.outputStart > 0) {
      for (
        let k: i32 = 0;
        k < live && k < toI32(output.length) && this.outputStart + k < toI32(output.length);
        k++
      ) {
        output[k] = output[this.outputStart + k]
      }
      this.outputStart = 0
      this.outputEnd = live
    }
    return toI32(output.length) - this.outputEnd
  }

  /** The room a response or a frame may use: all but the control reserve. */
  bodyRoom(): i32 {
    const r: i32 = this.room() - H1_CONTROL_RESERVE
    return r > 0 ? r : 0
  }

  // ---- Events -------------------------------------------------------------------

  /** The next event; see the module comment. */
  next(): i32 {
    if (this.state === H1_S_FAILED) {
      return H1_ERROR
    }
    if (this.writeHeld) {
      // Half the output free before the program is asked to write again, so
      // that a slow reader is not answered one small write at a time.
      if (this.bodyRoom() * 2 < toI32(this.output.length) - H1_CONTROL_RESERVE) {
        return H1_NEED_MORE
      }
      this.writeHeld = false
      return H1_WRITE
    }
    if (this.state === H1_S_CLOSING) {
      return H1_NEED_MORE
    }
    if (this.state === H1_S_WEBSOCKET) {
      return this.nextFrame()
    }
    return this.nextRequest()
  }

  /** `next` while the connection speaks HTTP. */
  nextRequest(): i32 {
    while (true) {
      if (this.requestEnded) {
        if (this.response !== H1_R_DONE) {
          return H1_NEED_MORE
        }
        // The exchange is over: the next request, a WebSocket, or the close.
        this.requestOpen = false
        this.requestEnded = false
        this.response = H1_R_NONE
        if (this.upgraded) {
          const p: Http1Parser = this.parser
          this.ws.reset()
          this.ws.feed(p.buf, p.start, p.buffered())
          this.state = H1_S_WEBSOCKET
          return this.nextFrame()
        }
        if (this.closeAfter) {
          this.state = H1_S_CLOSING
          return H1_NEED_MORE
        }
      }
      const event: i32 = this.parser.next()
      if (event === HTTP1_HEAD) {
        this.requestOpen = true
        this.response = H1_R_NONE
        this.closeAfter = !this.parser.keepAlive
        this.upgraded = false
        return H1_REQUEST
      }
      if (event === HTTP1_BODY) {
        this.data = this.parser.body
        this.dataStart = this.parser.bodyOff
        this.dataLength = this.parser.bodyLen
        return H1_BODY
      }
      if (event === HTTP1_END) {
        this.requestEnded = true
        return H1_END
      }
      if (event === HTTP1_UPGRADE) {
        // Reached only once a response that did not switch is over.
        this.parser.declineUpgrade()
      } else if (event === HTTP1_ERROR) {
        return this.fail(this.parser.status)
      } else if (event === HTTP1_CLOSED) {
        this.state = H1_S_CLOSING
        return H1_NEED_MORE
      } else {
        // HTTP1_NEED_MORE. A request cut off by the end of the stream is
        // over: there is no one left to answer.
        if (this.inputEnded) {
          this.state = H1_S_CLOSING
        }
        return H1_NEED_MORE
      }
    }
  }

  /**
   * Refuses the request with `status`: the response that says so, when none
   * has started, and the close after it. Answers `H1_ERROR`.
   */
  fail(status: i32): i32 {
    this.status = status
    if (this.response === H1_R_NONE) {
      // The control reserve keeps room for this whatever the output holds.
      this.room()
      const none: u8[][] = []
      const end: i32 = http1WriteResponseHead(
        this.output,
        this.outputEnd,
        status,
        http1ServerReason(status),
        none,
        none,
        H1_ZERO,
        "close"
      )
      if (end >= 0) {
        this.outputEnd = end
      }
    }
    this.state = H1_S_FAILED
    this.writeHeld = false
    return H1_ERROR
  }

  /** `next` once the slot has switched to WebSocket. */
  nextFrame(): i32 {
    while (true) {
      if (this.pongPending && !this.sendPong()) {
        return H1_NEED_MORE
      }
      const event: i32 = this.ws.next()
      if (event === WS_MESSAGE) {
        this.opcode = this.ws.opcode
        this.data = this.ws.data
        this.dataStart = 0
        this.dataLength = this.ws.dataLen
        return H1_WS_MESSAGE
      }
      if (event === WS_PING) {
        const n: i32 = this.ws.dataLen
        for (let k: i32 = 0; k < n && k < toI32(this.pong.length) && k < toI32(this.ws.data.length); k++) {
          this.pong[k] = this.ws.data[k]
        }
        this.pongLength = n
        this.pongPending = true
      } else if (event === WS_CLOSE) {
        this.status = this.ws.closeCode
        this.sendClose(this.ws.closeCode)
        this.state = H1_S_CLOSING
        return H1_WS_CLOSE
      } else if (event === WS_ERROR) {
        this.status = this.ws.closeCode
        this.sendClose(this.ws.closeCode)
        this.state = H1_S_FAILED
        return H1_ERROR
      } else if (event === WS_NEED_MORE) {
        if (this.inputEnded) {
          this.state = H1_S_CLOSING
        }
        return H1_NEED_MORE
      }
      // A pong needs no answer: read on.
    }
  }

  /** Writes the pending pong if it fits, from the control reserve; answers whether it went. */
  sendPong(): boolean {
    this.room()
    const end: i32 = websocketWriteFrame(
      this.output,
      this.outputEnd,
      true,
      WS_OP_PONG,
      this.pong,
      H1_ZERO,
      this.pongLength,
      null
    )
    if (end < 0) {
      return false
    }
    this.outputEnd = end
    this.pongPending = false
    return true
  }

  /** Writes a close frame with `code` (none for 1005), from the control reserve. */
  sendClose(code: i32): void {
    this.room()
    const payload: u8[] | null = websocketClosePayload(code, "")
    const empty: u8[] = this.pong
    const body: u8[] = payload === null ? empty : payload
    const n: i32 = payload === null || code === WS_CLOSE_NO_STATUS ? H1_ZERO : toI32(body.length)
    const end: i32 = websocketWriteFrame(
      this.output,
      this.outputEnd,
      true,
      WS_OP_CLOSE,
      body,
      H1_ZERO,
      n,
      null
    )
    if (end >= 0) {
      this.outputEnd = end
    }
  }

  // ---- The response -------------------------------------------------------------

  /** Whether the program may answer the current request now. */
  answerable(): boolean {
    return this.state === H1_S_HTTP && this.requestOpen && this.response === H1_R_NONE
  }

  /**
   * Answers the current request with `status` and the fields `names[k]`:
   * `values[k]`, and the framing `bodyLength` asks for: a length, or
   * `HTTP1_CHUNKED`, or `HTTP1_NO_BODY` for a 1xx, a 204 or a 304. A 1xx
   * (but 101) is interim and the final status follows it. Answers 0;
   * `H1_INVALID` for a status outside 100 to 599 or 101, a reserved field, a
   * name or value `http1WriteResponseHead` refuses, or a head larger than the
   * output; `H1_AGAIN` when the output has no room for it yet (`H1_WRITE`
   * says when to try again); `H1_CLOSED` with no request to answer.
   */
  respond(status: i32, names: u8[][], values: u8[][], bodyLength: i32): i32 {
    if (!this.answerable()) {
      return H1_CLOSED
    }
    if (status < 100 || status > 599 || status === 101) {
      return H1_INVALID
    }
    for (const name of names) {
      if (http1ServerReserved(name)) {
        return H1_INVALID
      }
    }
    const interim: boolean = status < 200
    const empty: boolean = interim || status === 204 || status === 304 || this.parser.methodIs("HEAD")
    if (!empty && bodyLength === HTTP1_NO_BODY) {
      return H1_INVALID
    }
    let framing: i32 = bodyLength
    let close: boolean = this.closeAfter
    // Chunked is HTTP/1.1's: an HTTP/1.0 client reads the body to the close.
    if (!empty && bodyLength === HTTP1_CHUNKED && this.parser.minor === 0) {
      framing = HTTP1_NO_BODY
      close = true
    }
    let connection: string = ""
    if (!interim && close) {
      connection = "close"
    } else if (!interim && this.parser.minor === 0) {
      connection = "keep-alive"
    }
    const room: i32 = this.bodyRoom()
    const end: i32 = http1WriteResponseHead(
      this.output,
      this.outputEnd,
      status,
      http1ServerReason(status),
      names,
      values,
      framing,
      connection
    )
    if (end === HTTP1_REFUSED) {
      return H1_INVALID
    }
    if (end < 0 || end - this.outputEnd > room) {
      // The head was not written, or ate into the reserve: take it back.
      if (end - this.outputEnd > toI32(this.output.length) - H1_CONTROL_RESERVE) {
        return H1_INVALID
      }
      if (this.outputEnd === 0) {
        return H1_INVALID
      }
      this.writeHeld = true
      return H1_AGAIN
    }
    this.outputEnd = end
    if (interim) {
      return 0
    }
    this.closeAfter = close
    this.response = H1_R_BODY
    this.responseChunked = framing === HTTP1_CHUNKED
    this.responseLength = framing >= 0
    this.responseLeft = framing >= 0 ? framing : 0
    this.responseEmpty = empty
    return 0
  }

  /**
   * Writes `buf[off .. off + len)` of the response body, as much as the output
   * has room for, and answers how much: a chunk of a chunked body, or bytes
   * of one with a length (more than it still owes is `H1_INVALID`). When not
   * everything was taken, `H1_WRITE` says when to try the rest; `H1_AGAIN`
   * when nothing was. A response with no body takes everything and sends
   * nothing. `H1_CLOSED` with no response under way. A window outside `buf`
   * panics.
   */
  write(buf: u8[], off: i32, len: i32): i32 {
    const size: i32 = toI32(buf.length)
    if (off < 0 || len < 0 || off > size || len > size - off) {
      panic("Http1Connection.write: the window is outside the buffer")
    }
    if (this.response !== H1_R_BODY || this.state !== H1_S_HTTP) {
      return H1_CLOSED
    }
    if (this.responseEmpty || len === 0) {
      return len
    }
    if (this.responseLength && len > this.responseLeft) {
      return H1_INVALID
    }
    const room: i32 = this.bodyRoom()
    let take: i32 = len
    if (this.responseChunked) {
      if (take > room - H1_CHUNK_OVERHEAD) {
        take = room - H1_CHUNK_OVERHEAD
      }
    } else if (take > room) {
      take = room
    }
    if (take <= 0) {
      this.writeHeld = true
      return H1_AGAIN
    }
    if (this.responseChunked) {
      this.outputEnd = http1WriteChunk(this.output, this.outputEnd, buf, off, take)
    } else {
      const output: u8[] = this.output
      const at: i32 = this.outputEnd
      for (let k: i32 = 0; k < take && at + k < toI32(output.length); k++) {
        if (at + k >= 0) {
          output[at + k] = buf[off + k]
        }
      }
      this.outputEnd = at + take
      if (this.responseLength) {
        this.responseLeft = this.responseLeft - take
      }
    }
    if (take < len) {
      this.writeHeld = true
    }
    return take
  }

  /**
   * Ends the response: the last chunk of a chunked body. Answers 0;
   * `H1_INVALID` for a response with a length that still owes bytes;
   * `H1_AGAIN` when the last chunk does not fit yet; `H1_CLOSED` with no
   * response under way.
   */
  end(): i32 {
    if (this.response !== H1_R_BODY || this.state !== H1_S_HTTP) {
      return H1_CLOSED
    }
    if (this.responseLength && !this.responseEmpty && this.responseLeft > 0) {
      return H1_INVALID
    }
    if (this.responseChunked && !this.responseEmpty) {
      if (this.bodyRoom() < 5) {
        this.writeHeld = true
        return H1_AGAIN
      }
      const last: u8[] = this.output
      const at: i32 = this.outputEnd
      if (at >= 0 && at + 4 < toI32(last.length)) {
        last[at] = 48
        last[at + 1] = 13
        last[at + 2] = 10
        last[at + 3] = 13
        last[at + 4] = 10
      }
      this.outputEnd = at + 5
    }
    this.response = H1_R_DONE
    // A response with neither a length nor chunks ends with the connection.
    if (!this.responseChunked && !this.responseLength && !this.responseEmpty) {
      this.closeAfter = true
    }
    return 0
  }

  // ---- WebSocket ----------------------------------------------------------------

  /**
   * Accepts the current request's WebSocket opening handshake (RFC 6455
   * §4.2.2) with `protocol`, empty for none: the 101 is queued, and once the
   * request has ended the slot reads frames. Answers 0; `H1_INVALID` when the
   * request is not a valid opening handshake (the program answers 400, or 426
   * for the wrong version) or `protocol` is not a token; `H1_AGAIN` when the
   * output has no room yet; `H1_CLOSED` with no request to answer.
   */
  acceptWebSocket(protocol: string): i32 {
    if (!this.answerable()) {
      return H1_CLOSED
    }
    const key: string | null = websocketRequestKey(this.parser)
    if (key === null) {
      return H1_INVALID
    }
    const head: u8[] | null = websocketUpgradeResponse(key, protocol)
    if (head === null) {
      return H1_INVALID
    }
    const n: i32 = toI32(head.length)
    if (n > this.bodyRoom()) {
      this.writeHeld = true
      return H1_AGAIN
    }
    const output: u8[] = this.output
    const at: i32 = this.outputEnd
    for (let k: i32 = 0; k < n && at + k < toI32(output.length); k++) {
      if (at + k >= 0) {
        output[at + k] = head[k]
      }
    }
    this.outputEnd = at + n
    this.response = H1_R_DONE
    this.upgraded = true
    this.closeAfter = false
    return 0
  }

  /**
   * Sends one WebSocket frame, unmasked as a server's are (§5.1): a whole
   * text or binary message, a fragment of one (`fin` false, then
   * continuations), a ping or a pong. Answers 0; `H1_INVALID` for a frame
   * `websocketWriteFrame` refuses, a close (that is `closeWebSocket`), or one
   * larger than the output; `H1_AGAIN` when it does not fit yet; `H1_CLOSED`
   * when the slot is not an open WebSocket. A window outside `buf` panics.
   */
  sendFrame(fin: boolean, opcode: i32, buf: u8[], off: i32, len: i32): i32 {
    const size: i32 = toI32(buf.length)
    if (off < 0 || len < 0 || off > size || len > size - off) {
      panic("Http1Connection.sendFrame: the window is outside the buffer")
    }
    if (this.state !== H1_S_WEBSOCKET) {
      return H1_CLOSED
    }
    if (opcode === WS_OP_CLOSE || len > toI32(this.output.length) - H1_CONTROL_RESERVE - 14) {
      return H1_INVALID
    }
    if (websocketFrameSize(len, false) > this.bodyRoom()) {
      this.writeHeld = true
      return H1_AGAIN
    }
    const end: i32 = websocketWriteFrame(this.output, this.outputEnd, fin, opcode, buf, off, len, null)
    if (end < 0) {
      return H1_INVALID
    }
    this.outputEnd = end
    return 0
  }

  /**
   * Starts the closing handshake (§5.5.1, §7.1.2) with `code`: a close frame,
   * then the connection is done once it is sent. Answers 0, `H1_INVALID` for a
   * code that may not be sent, or `H1_CLOSED` when the slot is not an open
   * WebSocket.
   */
  closeWebSocket(code: i32): i32 {
    if (this.state !== H1_S_WEBSOCKET) {
      return H1_CLOSED
    }
    if (code === WS_CLOSE_NO_STATUS || websocketClosePayload(code, "") === null) {
      return H1_INVALID
    }
    this.sendClose(code)
    this.state = H1_S_CLOSING
    return 0
  }

  /** Whether the slot has switched to WebSocket and is open. */
  isWebSocket(): boolean {
    return this.state === H1_S_WEBSOCKET
  }

  /** Whether nothing has moved for longer than the idle timeout, at `now` (`monotonicNanos`). */
  idle(now: i64): boolean {
    return now - this.lastActive > toI64(this.config.idleTimeout) * toI64(1000000)
  }
}

// ---- Carriers -------------------------------------------------------------------

/**
 * A pool of HTTP/1.1 connections over plain TCP on one listening socket.
 * `slot`s are the indices `accept` answers; a slot is the program's from
 * `accept` until it calls `close`, and its descriptor is `fd(slot)`.
 */
export class Http1Server {
  config: Http1Config
  connections: Http1Connection[]
  /** Each slot's descriptor, or -1 while it is free. */
  fds: i32[]
  /** Where the socket is read into before the connection takes the bytes. */
  scratch: u8[]
  /** The last accepted peer's address, in `nish:net`'s 18-byte form. */
  peer: u8[]
  /** The listening socket, which the program made with `tcpListen` and still owns. */
  listener: i32 = -1

  /** A pool of `size` slots, at least one, serving `config` on `listener`. Every slot's buffers are allocated here. */
  constructor(config: Http1Config, listener: i32, size: i32) {
    this.config = config
    this.listener = listener
    this.connections = []
    this.fds = []
    const slots: i32 = size < 1 ? 1 : size
    for (let k: i32 = 0; k < slots; k++) {
      this.connections.push(new Http1Connection(config))
      this.fds.push(H1_FREE)
    }
    this.scratch = new Array<u8>(config.chunkSize)
    this.peer = new Array<u8>(H1_ADDRESS_SIZE)
  }

  /** How many slots the pool has. */
  size(): i32 {
    return toI32(this.fds.length)
  }

  /** How many slots hold a connection. */
  busy(): i32 {
    let n: i32 = 0
    for (const fd of this.fds) {
      if (fd >= 0) {
        n = n + 1
      }
    }
    return n
  }

  /** Whether `slot` is a slot of this pool that holds a connection. */
  holds(slot: i32): boolean {
    return slot >= 0 && slot < toI32(this.fds.length) && this.fds[slot] >= 0
  }

  /** The descriptor of `slot`, for `pollAdd`; -1 for a free or unknown one. */
  fd(slot: i32): i32 {
    return this.holds(slot) ? this.fds[slot] : -1
  }

  /** The connection of `slot`; a slot out of range names the first. */
  connection(slot: i32): Http1Connection {
    const at: i32 = slot >= 0 && slot < toI32(this.connections.length) ? slot : H1_ZERO
    return this.connections[at]
  }

  /**
   * Accepts the next waiting connection into a free slot and answers the
   * slot; -11 when none is waiting, `H1_POOL_FULL` when every slot is busy
   * (the connection is closed), or `tcpAccept`'s own failure.
   */
  accept(): i32 {
    const fd: i32 = tcpAccept(this.listener, this.peer)
    if (fd < 0) {
      return fd
    }
    for (let k: i32 = 0; k < toI32(this.fds.length) && k < toI32(this.connections.length); k++) {
      if (this.fds[k] < 0) {
        this.fds[k] = fd
        const conn: Http1Connection = this.connections[k]
        conn.restart()
        conn.lastActive = monotonicNanos()
        return k
      }
    }
    netClose(fd)
    return H1_POOL_FULL
  }

  /** The socket of `slot` is readable: reads it while the connection has room, then sends. Answers the interest. */
  readable(slot: i32): i32 {
    if (!this.holds(slot)) {
      return H1_DONE
    }
    const conn: Http1Connection = this.connections[slot]
    const fd: i32 = this.fds[slot]
    while (true) {
      const room: i32 = conn.inputRoom()
      const want: i32 = room < toI32(this.scratch.length) ? room : toI32(this.scratch.length)
      if (want <= 0) {
        break
      }
      const n: i32 = netRead(fd, this.scratch, H1_ZERO, want)
      if (n <= 0) {
        if (n === 0) {
          conn.endInput()
        } else if (n !== H1_AGAIN) {
          conn.abort()
        }
        break
      }
      conn.lastActive = monotonicNanos()
      conn.feed(this.scratch, H1_ZERO, n)
    }
    return this.flush(slot)
  }

  /** The socket of `slot` is writable. Answers the interest. */
  writable(slot: i32): i32 {
    return this.flush(slot)
  }

  /**
   * `slot`'s connection's next event; `H1_ERROR` for a free slot. While a
   * write is held back the output is sent first, so that the room it waits
   * for is made here and `H1_WRITE` comes in the same pass; otherwise what
   * the program writes in answer to one event and the next goes out together
   * at `flush`, as one segment rather than several.
   */
  next(slot: i32): i32 {
    if (!this.holds(slot)) {
      return H1_ERROR
    }
    const conn: Http1Connection = this.connections[slot]
    if (conn.writeHeld) {
      this.send(slot)
    }
    return conn.next()
  }

  /**
   * Sends what `slot`'s connection holds until the socket would block, and
   * answers the interest: `H1_DONE` once the connection is over and sent,
   * otherwise read while it has room and write while it holds bytes.
   */
  flush(slot: i32): i32 {
    if (!this.holds(slot)) {
      return H1_DONE
    }
    const conn: Http1Connection = this.connections[slot]
    this.send(slot)
    if (conn.isDone()) {
      return H1_DONE
    }
    let wants: i32 = 0
    if (conn.inputRoom() > 0) {
      wants = wants | H1_WANT_READ
    }
    if (conn.wantsWrite()) {
      wants = wants | H1_WANT_WRITE
    }
    return wants
  }

  /** Writes what `slot`'s connection holds, which it holds, until the socket would block. */
  send(slot: i32): void {
    const conn: Http1Connection = this.connections[slot]
    const fd: i32 = this.fds[slot]
    while (conn.wantsWrite()) {
      const n: i32 = netWrite(fd, conn.output, conn.outputStart, conn.outputEnd - conn.outputStart)
      if (n <= 0) {
        if (n !== H1_AGAIN) {
          conn.abort()
        }
        break
      }
      conn.lastActive = monotonicNanos()
      conn.consume(n)
    }
  }

  /** Closes `slot`'s socket, whatever is left unsent, and frees the slot. */
  close(slot: i32): void {
    if (!this.holds(slot)) {
      return
    }
    netClose(this.fds[slot])
    this.fds[slot] = H1_FREE
  }

  /** Closes every slot that has been idle past `idleTimeout` at `now` (`monotonicNanos`); answers how many. */
  expire(now: i64): i32 {
    let n: i32 = 0
    for (let k: i32 = 0; k < toI32(this.fds.length) && k < toI32(this.connections.length); k++) {
      if (this.fds[k] >= 0 && this.connections[k].idle(now)) {
        this.close(k)
        n = n + 1
      }
    }
    return n
  }
}

/**
 * A pool of HTTP/1.1 connections over TLS 1.3 on one listening socket: one
 * `Http1Connection` beside each slot of a `TlsTcpServer`, run the way
 * `nish/net/http2-tls` runs HTTP/2. A handshake that chose ALPN `http/1.1`,
 * or none (a client that does not send ALPN speaks HTTP/1.1), reaches its
 * connection; any other protocol is shut down with `close_notify`.
 */
export class Http1TlsServer {
  tls: TlsTcpServer
  connections: Http1Connection[]
  /** Where TLS decrypts into before the connection takes the bytes. */
  scratch: u8[]

  /** A pool of `size` slots, at least one, serving `config` over TLS under `tlsConfig` on `listener`. */
  constructor(tlsConfig: TlsServerConfig, config: Http1Config, listener: i32, size: i32) {
    this.tls = new TlsTcpServer(tlsConfig, listener, size)
    this.connections = []
    for (let k: i32 = 0; k < this.tls.size(); k++) {
      this.connections.push(new Http1Connection(config))
    }
    this.scratch = new Array<u8>(config.chunkSize)
  }

  /** How many slots the pool has. */
  size(): i32 {
    return this.tls.size()
  }

  /** How many slots hold a connection. */
  busy(): i32 {
    return this.tls.busy()
  }

  /** Whether `slot` holds a connection. */
  holds(slot: i32): boolean {
    return this.tls.holds(slot)
  }

  /** The descriptor of `slot`, for `pollAdd`; -1 for a free one. */
  fd(slot: i32): i32 {
    return this.tls.fd(slot)
  }

  /** The HTTP/1.1 connection of `slot`; a slot out of range names the first. */
  connection(slot: i32): Http1Connection {
    const at: i32 = slot >= 0 && slot < toI32(this.connections.length) ? slot : H1_ZERO
    return this.connections[at]
  }

  /** The ALPN protocol `slot`'s handshake chose, or empty. */
  alpn(slot: i32): string {
    return this.tls.connection(slot).tls.alpn
  }

  /** Whether `slot`'s handshake is done and chose a protocol other than `http/1.1`. */
  refused(slot: i32): boolean {
    const chosen: string = this.alpn(slot)
    return this.tls.connection(slot).state === TLS_RECORD_STATE_OPEN && chosen !== "" && chosen !== H1_ALPN
  }

  /**
   * Accepts the next waiting connection as `TlsTcpServer.accept` does, with
   * the caller's 32-byte server random and x25519 key, and gives it a fresh
   * connection. Answers the slot, or what `TlsTcpServer.accept` answers.
   */
  accept(serverRandom: u8[], ephemeralPrivate: u8[]): i32 {
    const slot: i32 = this.tls.accept(serverRandom, ephemeralPrivate)
    if (slot >= 0 && slot < toI32(this.connections.length)) {
      const conn: Http1Connection = this.connections[slot]
      conn.restart()
      conn.lastActive = monotonicNanos()
    }
    return slot
  }

  /** The socket of `slot` is readable: TLS reads it, and what the connection has to send goes after. Answers the interest. */
  readable(slot: i32): i32 {
    this.connection(slot).lastActive = monotonicNanos()
    this.tls.readable(slot)
    return this.flush(slot)
  }

  /** The socket of `slot` is writable. Answers the interest. */
  writable(slot: i32): i32 {
    this.tls.writable(slot)
    return this.flush(slot)
  }

  /** Signs `slot`'s CertificateVerify with `key`, as `TlsTcpServer.signP256` does. Answers the interest. */
  signP256(slot: i32, key: Secret<u8[]>): i32 {
    this.tls.signP256(slot, key)
    return this.flush(slot)
  }

  /**
   * Moves what TLS has decrypted for `slot` into its connection, as far as
   * the connection has room, and answers the connection's next event. A free
   * slot, or one whose ALPN was another protocol, answers `H1_ERROR`.
   */
  next(slot: i32): i32 {
    if (!this.holds(slot) || this.refused(slot)) {
      return H1_ERROR
    }
    const conn: Http1Connection = this.connections[slot]
    while (true) {
      const room: i32 = conn.inputRoom()
      const want: i32 = room < toI32(this.scratch.length) ? room : toI32(this.scratch.length)
      if (want <= 0) {
        break
      }
      const n: i32 = this.tls.read(slot, this.scratch, H1_ZERO, want)
      if (n === 0) {
        conn.endInput()
      }
      if (n <= 0) {
        break
      }
      conn.feed(this.scratch, H1_ZERO, n)
    }
    // A held-back write finds its room here, as in `Http1Server.next`.
    if (conn.writeHeld) {
      this.send(slot)
    }
    return conn.next()
  }

  /**
   * Writes what `slot`'s connection holds into TLS, as far as TLS takes it,
   * and sends it; shuts TLS down once the connection is over or ALPN chose
   * another protocol. Answers TLS's interest, with the write bit while the
   * connection still holds bytes.
   */
  flush(slot: i32): i32 {
    if (!this.holds(slot)) {
      return TLS_RECORD_DONE
    }
    if (this.refused(slot)) {
      return this.tls.shutdown(slot)
    }
    const conn: Http1Connection = this.connections[slot]
    this.send(slot)
    if (conn.isDone()) {
      return this.tls.shutdown(slot)
    }
    const wants: i32 = this.tls.interest(slot)
    return conn.wantsWrite() && (wants & TLS_RECORD_DONE) === 0 ? wants | TLS_RECORD_WANT_WRITE : wants
  }

  /** Writes what `slot`'s connection holds into TLS, as far as TLS takes it. */
  send(slot: i32): void {
    const conn: Http1Connection = this.connections[slot]
    while (conn.wantsWrite()) {
      const n: i32 = this.tls.write(slot, conn.output, conn.outputStart, conn.outputEnd - conn.outputStart)
      if (n <= 0) {
        break
      }
      conn.lastActive = monotonicNanos()
      conn.consume(n)
    }
  }

  /** Ends `slot`'s connection and frees the slot at once, as `TlsTcpServer.close` does. */
  close(slot: i32): void {
    this.tls.close(slot)
  }

  /** Closes every slot that has been idle past `idleTimeout` at `now` (`monotonicNanos`); answers how many. */
  expire(now: i64): i32 {
    let n: i32 = 0
    for (let k: i32 = 0; k < this.tls.size() && k < toI32(this.connections.length); k++) {
      if (this.tls.holds(k) && this.connections[k].idle(now)) {
        this.tls.close(k)
        n = n + 1
      }
    }
    return n
  }
}
