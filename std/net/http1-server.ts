/**
 * `nish/net/http1-server` — the server side of HTTP/1.1 (RFC 9112): a
 * sans-IO connection that drives `nish/net/http1-codec`'s parser, and two pools of
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
 *     else if (server.rearm(slot, wants)) { pollModify(loop, server.fd(slot), wants & 3, slot); }
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
 * `Content-Length` or chunked. A response is written with a length or chunked,
 * a `write` at a time into the output buffer; a `write` takes what fits and
 * answers how much, and when it could not take everything the connection
 * answers `H1_NEED_MORE` until the socket has drained half the output, then
 * `H1_WRITE`. Until then it reads nothing, so the window the program is writing
 * from stays valid: back-pressure on the way out.
 *
 *  Nothing buffers a whole body. On an `Http1Server` slot `sendBody` sends a
 *  body with a length from the program's own array, the queued output with it,
 *  and copies only what the socket did not take, under the same rules.
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
 * **The Date.** Every final response, an error included, carries a `Date`
 * field (RFC 9110 §6.6.1) from `HttpDate`, which formats the IMF-fixdate at
 * most once a second; a 1xx carries none. The pool's slots share one, so a
 * busy server formats a second once, not once a slot. A program that sets its
 * own `date` field sends that one instead, so a response has one `Date`.
 * `Http1Server` reads the clock once per serve call — from `readable` or
 * `writable` to the `flush` that ends it — and every response written in
 * between carries that reading; one written outside a serve call, an answer
 * given later, reads the clock then. `date.pin(unixMs)` fixes it, for a test
 * that compares bytes.
 *
 * **Refusals.** Every refusal of `nish/net/http1-codec`'s parser — the smuggling
 * shapes, a `Content-Length` with a `Transfer-Encoding`, two that disagree,
 * a malformed chunk size — is answered with its status (400, 413, 414, 431,
 * 501, 505), `Content-Length: 0` and `Connection: close`, and ends the
 * connection; so does a malformed WebSocket frame, with its close code.
 * `docs/security/http1-codec.md` is the record.
 *
 * **WebSocket.** A request that asked to upgrade reaches the program like any
 * other; `acceptWebSocket(protocol)` answers it with the 101 of
 * `nish/net/websocket` when it is a valid opening handshake (RFC 6455 §4.2),
 * and once its exchange is over the slot reads frames with a `WsDecoder`
 * instead of requests, the bytes that followed the request included. A ping
 * is answered with a pong and a close with a close, by the connection.
 *
 * **Caps are start-up numbers**, all in `Http1Config`: the request target, the
 * header section and its field count, a request body, the chunk handed over,
 * the output buffer, a WebSocket message, the idle timeout and the deadline for
 * a whole request head (`headTimeout`, against slowloris); the slots are the
 * pool's size.
 *
 *  `Http1Server` builds a slot's connection on the first accept into it and
 *  keeps it, so a pool sized for its peak costs at start-up only what does not
 *  depend on the size, and holds at most `size` connections once the peak has
 *  come; `Http1TlsServer` does the same for a slot's connection and, through
 *  `TlsTcpServer`, its TLS state. Every buffer is allocated with its slot or
 *  grown to its cap on first use and kept, so a warmed slot serves request after
 *  request with `Arena.used()` flat. Accepting a WebSocket allocates (the accept
 *  key), once a connection.
 *
 * **Output is borrowed.** The pools' slots share an `Http1OutputPool`: a
 * connection takes an `outputSize` buffer when it first needs room to write
 * and gives it back once its carrier has sent everything, so the output
 * memory a pool holds follows the connections the socket is holding back,
 * not its size. A pool that ever had `n` connections writing at once keeps
 * `n` buffers and allocates no more.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9112, RFC 9110 and RFC 6455, not ported from another
 * implementation.
 */
import { Secret } from "nish:secret"
import { copyBytes } from "nish/bytes"
import {
  HTTP_CODING_GZIP,
  HTTP_CODING_IDENTITY,
  HTTP_CODING_NONE,
  HTTP_DEFAULT_MSS,
  HTTP_OFFER_GZIP,
  HttpCompressor,
  httpAcceptEncoding,
} from "nish/net/http-compress"
import { netClose, netMss, netRead, netWrite, netWrite2, tcpAccept } from "nish:net"
import {
  HTTP1_BODY,
  HTTP1_CHUNKED,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_FIRST_HEAD,
  HTTP1_FIRST_INPUT,
  HTTP1_HEAD,
  HTTP1_NO_BODY,
  HTTP1_REFUSED,
  HTTP1_UPGRADE,
  Http1Parser,
  http1BytesAre,
  http1WriteChunk,
  http1WriteLastChunk,
  http1WriteResponseHead,
} from "nish/net/http1-codec"
import {
  WS_CLOSE,
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
import { HTTP_DATE_LAST_SECOND, HTTP_DATE_SIZE, httpDateWrite } from "nish/net/http-fields"
import { TLS_RECORD_DONE, TLS_RECORD_STATE_OPEN, TLS_RECORD_WANT_WRITE } from "nish/net/tls/record-server"
import { TlsTcpServer } from "nish/net/tls-tcp"
import { any, loadU8x16, ne } from "nish:simd"

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
/** The slot has output waiting for the socket: ask the readiness loop for writable. */
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

/** The longest WebSocket frame header, which `WsDecoder` buffers with its whole frame: 2, 8 of length, 4 of mask. */
const H1_FRAME_HEADER: i32 = 14

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

/**
 * The longest final head `respond` keeps to write again (`Http1Connection`'s
 * `headBytes`): one buffer of this size per connection, made at its first
 * kept head. A longer head is written fresh every time.
 */
const H1_HEAD_KEEP: i32 = 1024

/** The most program fields a kept head carries: a head with more is written fresh every time. */
const H1_HEAD_FIELDS: i32 = 16

/**
 * How many responses in a row may miss the kept head before `respond` stops
 * comparing and keeping until the `Date` turns: past it, a head is written as
 * if nothing were kept, so heads that never repeat cost no more than that.
 */
const H1_HEAD_MISSES: i32 = 4

// `respond`'s `Connection` field, as the kept head records it.
const H1_CONN_NONE: i32 = 0
const H1_CONN_CLOSE: i32 = 1
const H1_CONN_KEEP_ALIVE: i32 = 2

/** Whether `kept[at ..)` begins with all of `bytes`, a byte at a time: the path for a range a word load cannot prove inside its array. */
const http1ServerSameByByte = (kept: readonly u8[], at: i32, bytes: readonly u8[]): boolean => {
  for (let k: i32 = 0; k < toI32(bytes.length); k += 1) {
    if (kept[at + k] !== bytes[k]) {
      return false
    }
  }
  return true
}

/**
 * Whether `kept[at ..)` begins with all of `bytes`, eight to fifteen of them:
 * two eight-byte loads a side, the second overlapping the first. One range
 * check comes first and each load's ors are grouped in pairs, as `getU64BE`'s
 * are, so LLVM folds every eight loads into one.
 */
const http1ServerSame8 = (kept: readonly u8[], at: i32, bytes: readonly u8[]): boolean => {
  const n: i32 = toI32(bytes.length)
  const e: i32 = at + n - 8
  const f: i32 = n - 8
  if (
    !(at >= 0 && at < 2147483640 && at + 8 <= toI32(kept.length)) ||
    !(e >= 0 && e < 2147483640 && e + 8 <= toI32(kept.length)) ||
    !(toI32(bytes.length) >= 8 && f >= 0 && f < 2147483640 && f + 8 <= toI32(bytes.length))
  ) {
    return http1ServerSameByByte(kept, at, bytes)
  }
  return (
    ((toU64(kept[at]) << toU64(56)) |
      (toU64(kept[at + 1]) << toU64(48)) |
      ((toU64(kept[at + 2]) << toU64(40)) | (toU64(kept[at + 3]) << toU64(32))) |
      ((toU64(kept[at + 4]) << toU64(24)) |
        (toU64(kept[at + 5]) << toU64(16)) |
        ((toU64(kept[at + 6]) << toU64(8)) | toU64(kept[at + 7])))) ===
      ((toU64(bytes[0]) << toU64(56)) |
        (toU64(bytes[1]) << toU64(48)) |
        ((toU64(bytes[2]) << toU64(40)) | (toU64(bytes[3]) << toU64(32))) |
        ((toU64(bytes[4]) << toU64(24)) |
          (toU64(bytes[5]) << toU64(16)) |
          ((toU64(bytes[6]) << toU64(8)) | toU64(bytes[7])))) &&
    ((toU64(kept[e]) << toU64(56)) |
      (toU64(kept[e + 1]) << toU64(48)) |
      ((toU64(kept[e + 2]) << toU64(40)) | (toU64(kept[e + 3]) << toU64(32))) |
      ((toU64(kept[e + 4]) << toU64(24)) |
        (toU64(kept[e + 5]) << toU64(16)) |
        ((toU64(kept[e + 6]) << toU64(8)) | toU64(kept[e + 7])))) ===
      ((toU64(bytes[f]) << toU64(56)) |
        (toU64(bytes[f + 1]) << toU64(48)) |
        ((toU64(bytes[f + 2]) << toU64(40)) | (toU64(bytes[f + 3]) << toU64(32))) |
        ((toU64(bytes[f + 4]) << toU64(24)) |
          (toU64(bytes[f + 5]) << toU64(16)) |
          ((toU64(bytes[f + 6]) << toU64(8)) | toU64(bytes[f + 7]))))
  )
}

/** `http1ServerSame8` for four to seven bytes, with four-byte loads. */
const http1ServerSame4 = (kept: readonly u8[], at: i32, bytes: readonly u8[]): boolean => {
  const n: i32 = toI32(bytes.length)
  const e: i32 = at + n - 4
  const f: i32 = n - 4
  if (
    !(at >= 0 && at < 2147483640 && at + 4 <= toI32(kept.length)) ||
    !(e >= 0 && e < 2147483640 && e + 4 <= toI32(kept.length)) ||
    !(toI32(bytes.length) >= 4 && f >= 0 && f < 2147483640 && f + 4 <= toI32(bytes.length))
  ) {
    return http1ServerSameByByte(kept, at, bytes)
  }
  return (
    ((toU32(kept[at]) << 24) |
      (toU32(kept[at + 1]) << 16) |
      ((toU32(kept[at + 2]) << 8) | toU32(kept[at + 3]))) ===
      ((toU32(bytes[0]) << 24) | (toU32(bytes[1]) << 16) | ((toU32(bytes[2]) << 8) | toU32(bytes[3]))) &&
    ((toU32(kept[e]) << 24) |
      (toU32(kept[e + 1]) << 16) |
      ((toU32(kept[e + 2]) << 8) | toU32(kept[e + 3]))) ===
      ((toU32(bytes[f]) << 24) |
        (toU32(bytes[f + 1]) << 16) |
        ((toU32(bytes[f + 2]) << 8) | toU32(bytes[f + 3])))
  )
}

/**
 * Where `kept[at ..)` holds `bytes` and then the byte `after`: the offset one
 * past the byte that follows `after` (the space of `: `, the LF of CR LF), or
 * -1 when it does not, or when `after` would be at or past `limit`. Sixteen
 * bytes at a time with a last load that overlaps the one before; a name or
 * value under sixteen bytes is two overlapping eight- or four-byte loads, and
 * one under four a byte at a time. A kept value holds no CR (it is field
 * text), so a value that matches is the whole kept value; a name is held to
 * the kept name's length by `sameHead`, since a kept value may hold a colon.
 */
const http1ServerKept = (kept: u8[], at: i32, limit: i32, bytes: u8[], after: i32): i32 => {
  const n: i32 = toI32(bytes.length)
  if (at < 0 || limit > toI32(kept.length) || n > limit - at - 2 || toI32(kept[at + n]) !== after) {
    return -1
  }
  if (n >= 16) {
    let k: i32 = 0
    while (k < n - 16) {
      if (any(ne(loadU8x16(kept, at + k), loadU8x16(bytes, k)))) {
        return -1
      }
      k += 16
    }
    return any(ne(loadU8x16(kept, at + n - 16), loadU8x16(bytes, n - 16))) ? -1 : at + n + 2
  }
  let same: boolean = false
  if (n >= 8) {
    same = http1ServerSame8(kept, at, bytes)
  } else if (n >= 4) {
    same = http1ServerSame4(kept, at, bytes)
  } else {
    same = http1ServerSameByByte(kept, at, bytes)
  }
  return same ? at + n + 2 : -1
}

/** Panics unless `value` is in `low .. high`: a cap no connection could work with is the program's mistake. */
const http1ServerCheckCap = (name: string, value: i32, low: i32, high: i32): void => {
  if (value < low || value > high) {
    panic(`Http1Config.${name}: ${value} is outside ${low} to ${high}`)
  }
}

/** Panics unless `buf[off .. off + len)` is inside `buf`: a window past its buffer is the caller's mistake. */
const http1ServerCheckWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

/** Copies `src[off .. off + n)` to `out` at `at`, which the caller has made sure holds it, and answers where it ends. */
const http1ServerCopy = (out: u8[], at: i32, src: readonly u8[], off: i32, n: i32): i32 => {
  if (n > 0 && at >= 0 && off >= 0 && at <= toI32(out.length) - n && off <= toI32(src.length) - n) {
    // Both windows fit, as they do for every caller: one move, not a byte loop.
    copyBytes(out, at, src, off, n)
    return at + n
  }
  for (let k: i32 = 0; k < n && at + k < toI32(out.length) && off + k < toI32(src.length); k++) {
    if (at + k >= 0 && off + k >= 0) {
      out[at + k] = src[off + k]
    }
  }
  return at + n
}

/**
 * The `Date` field an origin server with a clock sends on every final
 * response (RFC 9110 §6.6.1): the IMF-fixdate of now, in 29 bytes the object
 * owns and rewrites in place, at most once a second.
 *
 * It reads the wall clock, `Date.now()`, which a wasm32 build has no host for,
 * so it lives here, in a module that is native already, while the formatting
 * it calls, `httpDateWrite`, stays in `nish/net/http-fields`, which compiles
 * for wasm32 (the split `nish/crypto/x509` and `x509-random` make). `pin`
 * replaces the clock with one instant, which is how a test asserts a response
 * byte for byte. `hold` reads the clock once for a run of responses, a serve
 * call's, until `unhold`; `pin` wins over it.
 */
export class HttpDate {
  /** The IMF-fixdate of `second`: what `current` answers, made once. */
  private bytes: u8[]
  /** The second `bytes` holds, since 1970; -1 before the first `current`. */
  private second: i64 = -1
  /** The instant `pin` fixed, in milliseconds since 1970, while `pinned`. */
  private pinnedMs: i64 = 0
  /** The clock reading `hold` took, in milliseconds since 1970, while `held`. */
  private heldMs: i64 = 0
  /** How many times `bytes` has been rewritten. */
  private rewrites: i64 = 0
  /** How many times the wall clock has been read. */
  private reads: i64 = 0
  private pinned: boolean = false
  private held: boolean = false

  /** A date on the wall clock, with nothing formatted yet. */
  constructor() {
    this.bytes = new Array<u8>(HTTP_DATE_SIZE)
  }

  /**
   * The 29 bytes for now, which are rewritten only when the second differs
   * from the one they hold — earlier as well as later, since a corrected clock
   * steps back. It allocates nothing, and the array is the same one each time,
   * so a caller copies it out rather than keeping it. A wall clock before 1970
   * or past 9999 answers the nearer of the two ends.
   *
   * @returns the object's own 29-byte IMF-fixdate of the current second, to copy before the next call rewrites it
   */
  current(): u8[] {
    let ms: i64 = this.pinnedMs
    if (!this.pinned) {
      ms = this.held ? this.heldMs : this.now()
    }
    let second: i64 = ms / 1000
    if (ms < 0) {
      second = 0
    } else if (second > HTTP_DATE_LAST_SECOND) {
      second = HTTP_DATE_LAST_SECOND
    }
    if (second !== this.second) {
      httpDateWrite(this.bytes, 0, second)
      this.second = second
      this.rewrites += 1
    }
    return this.bytes
  }

  /**
   * Makes `current` answer `unixMs`, milliseconds since 1970, until `unpin`.
   * False, and nothing changed, for an instant before 1970-01-01T00:00:00Z or
   * after 9999-12-31T23:59:59.999Z, which an IMF-fixdate cannot name.
   *
   * @param unixMs the instant every later `current` names, in milliseconds since 1970
   * @returns true once the date is pinned; false when the instant is out of the IMF-fixdate's range
   */
  pin(unixMs: i64): boolean {
    if (unixMs < 0 || unixMs / 1000 > HTTP_DATE_LAST_SECOND) {
      return false
    }
    this.pinnedMs = unixMs
    this.pinned = true
    return true
  }

  /** Puts `current` back on the wall clock. */
  unpin(): void {
    this.pinned = false
  }

  /**
   * Reads the wall clock once and makes `current` answer that reading until
   * `unhold`, so the responses of one serve call cost one read. A pinned date
   * reads nothing. A second `hold` takes a fresh reading.
   */
  hold(): void {
    if (!this.pinned) {
      this.heldMs = this.now()
    }
    this.held = true
  }

  /** Puts `current` back on a clock read per call, for a response written outside a serve call. */
  unhold(): void {
    this.held = false
  }

  /** The wall clock, in milliseconds since 1970. */
  private now(): i64 {
    this.reads += 1
    return toI64(Date.now())
  }

  /**
   * How many times the wall clock has been read: once per `hold`, and once per `current` outside one.
   *
   * @returns the count of `Date.now()` reads since the date was made, for a test that checks a serve call reads once
   */
  clockReads(): i64 {
    return this.reads
  }

  /**
   * How many times the bytes have been rewritten: one per second that `current` was asked for, at most.
   *
   * @returns the count of IMF-fixdate formats since the date was made, for a test that checks the once-a-second promise
   */
  formats(): i64 {
    return this.rewrites
  }
}

/**
 * The caps of every connection made from it, fixed when the connection is
 * made. Each is a number the program sets once, at start-up.
 */
export class Http1Config {
  /** The longest request target; past it, 414. With `maxHeaderBytes`, at most 2^30 − 44, the most a head buffer holds. */
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
  /** The longest WebSocket message, its fragments together; past it, close 1009. At most 2^30 − 14, so a whole frame fits the decoder's input. */
  maxMessage: i32 = 1048576
  /** Milliseconds without a byte read or written after which `expire` closes a slot. */
  idleTimeout: i32 = 60000
  /**
   * Milliseconds a request head may take, from its first byte to its blank
   * line, before `expire` closes the slot however steadily its bytes come. The
   * idle timeout alone restarts on every byte, so a client that sends one byte
   * of its head each `idleTimeout` would hold its slot for good (slowloris).
   */
  headTimeout: i32 = 30000
  /**
   * Lend a slot's input and head buffers back to the server between
   * exchanges: once a response is sent and no byte of the next request has
   * come, the slot gives both to pools the server's slots share, and takes
   * them again with the next byte. The memory they hold then follows the
   * connections mid-request rather than every keep-alive connection open,
   * for two pool operations a request. Off by default.
   */
  idleInput: boolean = false
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
const http1ServerReserved = (name: u8[]): boolean =>
  http1BytesAre(name, "connection") ||
  http1BytesAre(name, "upgrade") ||
  http1BytesAre(name, "keep-alive") ||
  http1BytesAre(name, "transfer-encoding") ||
  http1BytesAre(name, "content-length")

/**
 * Output buffers shared by the connections of one pool, each `size` bytes. A
 * connection borrows one when it has something to write and gives it back
 * once its carrier has sent everything, so a pool's output memory follows the
 * connections the socket is holding back, not the slots: Go's `net/http`
 * pools its writers the same way, and uWebSockets shares one per loop. A
 * buffer is made only when none is free, so the pool grows to the most
 * connections ever writing at once and then allocates nothing.
 */
export class Http1OutputPool {
  // Widest first, so the layout packs without padding.
  /** The buffers given back and not yet taken again; `made - free.length` is how many are out. */
  free: u8[][]
  private size: i32 = 0
  /** How many buffers the pool has made. */
  made: i32 = 0

  /**
   * An empty pool: no buffer is made until the first `take`.
   *
   * @param size the length in bytes of every buffer the pool makes
   */
  constructor(size: i32) {
    this.size = size
    this.free = []
  }

  /**
   * A buffer of `size` bytes: the one given back last, or a new one.
   *
   * @internal Called by `Http1Connection` in this module, when it first needs room to write and when it unparks its input and head buffers.
   */
  take(): u8[] {
    if (this.free.length > 0) {
      const buf: u8[] = this.free[this.free.length - 1]
      this.free.pop()
      return buf
    }
    this.made = this.made + 1
    return new Array<u8>(this.size)
  }

  /**
   * Takes back a buffer `take` gave.
   *
   * @internal Called by `Http1Connection` in this module, from `release` and `park`, once a borrowed buffer holds nothing it still needs.
   */
  give(buf: u8[]): void {
    this.free.push(buf)
  }
}

/**
 * One connection's HTTP/1.1 server, sans-IO: bytes in through `feed`, events
 * out of `next`, and the response the program writes in
 * `output[outputStart .. outputEnd)` for its carrier to send.
 */
export class Http1Connection {
  // What a request reads and writes comes first, so that `inputRoom`, `feed`,
  // `next`, `respond`, `write`, `end`, `consume`, `release` and `park` touch
  // the front of the object: the parser, the output and its pool, the clocks,
  // the state and the flags. What a WebSocket, an error or a configured cap
  // needs follows. Within each part the layout packs as widest first does:
  // the narrow fields of the front end on a 4-byte boundary and the cold
  // 32-bit fields bring the references behind them to an 8-byte one.
  /**
   * The request parser: its head (`methodIs`, `targetIs`, `header`, spans) is
   * the current request's from its `H1_REQUEST` until its response is done,
   * `H1_END` included, however much of a pipelined request is fed behind it.
   */
  parser: Http1Parser
  /**
   * Bytes to send are `output[outputStart .. outputEnd)`. Empty until the
   * connection first needs room to write: then its own buffer, made once, or
   * one borrowed from `pool` and given back by `release` once sent.
   */
  output: u8[]
  /** The empty array `output` is while the connection holds no buffer. */
  noOutput: u8[]
  /** Where `output` is borrowed from, for a connection of a pool; null for one that keeps its own. */
  pool: Http1OutputPool | null
  /** Where the parser's input and head buffers go while the slot rests, with `Http1Config.idleInput`; null otherwise. */
  inputs: Http1OutputPool | null
  /** Where the parser's head buffer goes while the slot rests, beside `inputs`; null otherwise. */
  heads: Http1OutputPool | null
  /**
   * The `Date` every final response carries. The connection makes its own;
   * `Http1Server` and `Http1TlsServer` put theirs here, so that every slot of a
   * pool shares one and the pool formats at most once a second. A program may
   * put another, to share it or to pin its clock.
   */
  date: HttpDate
  /** When the carrier last moved a byte for the connection, in `monotonicNanos`. */
  lastActive: i64 = 0
  /** When the head being read began to arrive, in `monotonicNanos`; meaningful while `headTimed`. */
  headSince: i64 = 0
  private state: i32 = 0
  private response: i32 = 0
  /**
   * How the response's body is framed: a length (0 or more), `HTTP1_CHUNKED`,
   * or `HTTP1_NO_BODY` for one that ends with the connection.
   *
   * @internal Read by `std/net/handler.ts` to tell a sized response from a chunked one when it checks a write against what is owed.
   */
  responseFraming: i32 = 0
  /**
   * A response with a length: the bytes it still owes.
   *
   * @internal Read by `std/net/handler.ts` to know how much of a sized body is still to write.
   */
  responseLeft: i32 = 0
  /** Where the unsent bytes start in `output`; a carrier sends from here and calls `consume` with what it sent. */
  outputStart: i32 = 0
  /** Where the unsent bytes end in `output`, one past the last; equal to `outputStart` when nothing waits. */
  outputEnd: i32 = 0
  /**
   * `output.length`, kept beside the offsets so that `acquire` and `release`
   * learn whether the connection holds a buffer without reading an array:
   * the empty one is out of cache by the time a resting connection's next
   * request comes. Only the connection assigns `output`, and with it this.
   */
  private outputCap: i32 = 0
  /** The most input the connection buffers, unread: the cap `inputRoom` holds it to. */
  bufferLimit: i32 = 0
  /** A request's head has been read and its exchange is not over. */
  private requestOpen: boolean = false
  /** The request's body has been read to its end. */
  private requestEnded: boolean = false
  /** The response carries no body (HEAD, 204, 304): what is written is dropped. */
  responseEmpty: boolean = false
  /** The connection closes once this exchange is over. */
  closeAfter: boolean = false
  /** The program accepted the request's WebSocket handshake. */
  private upgraded: boolean = false
  /** A write was held back; `next` answers nothing but `H1_WRITE` until there is room. */
  writeHeld: boolean = false
  private pongPending: boolean = false
  /** The peer's byte stream has ended. */
  private inputEnded: boolean = false
  /** A head has begun to arrive and is not read whole yet: `headSince` is its deadline's start. */
  headTimed: boolean = false
  /** Where the bytes `H1_BODY` or `H1_WS_MESSAGE` handed over start in `data`. */
  dataStart: i32 = 0
  /** How many bytes `H1_BODY` or `H1_WS_MESSAGE` handed over, from `data[dataStart]`. */
  dataLength: i32 = 0
  /** `H1_WS_MESSAGE`'s opcode: text or binary. */
  opcode: i32 = 0
  /** `H1_ERROR`'s HTTP status or WebSocket close code, or `H1_WS_CLOSE`'s close code. */
  status: i32 = 0
  private pongLength: i32 = 0
  /**
   * The TCP maximum segment size the program sets for this connection, for
   * `respondEncoded` under `HttpCompressor.segmentMode`; 0, the default,
   * leaves it to the compressor and the socket (`segmentMss`). Each accept
   * puts it back to 0.
   */
  mss: i32 = 0
  /** The MSS `Http1Server.accept` read from this connection's socket (`netMss`), or 0 when it reports none. */
  socketMss: i32 = 0
  /**
   * The plain TCP socket the carrier sends `output` on, which `sendBody`
   * writes to directly: `Http1Server.accept` sets it, and `restart` and
   * `abort` put it back to -1. -1 for a connection with no such socket (a
   * sans-IO carrier, `Http1TlsServer`'s TLS records), where `sendBody` copies
   * as `write` does.
   */
  fd: i32 = -1
  private config: Http1Config
  /**
   * The frame decoder: made when the slot first switches to WebSocket, so a
   * slot that only ever speaks HTTP never holds its buffers, then kept for
   * the slot's later peers.
   */
  ws: WsDecoder | null
  /** `H1_BODY`'s and `H1_WS_MESSAGE`'s bytes. */
  data: u8[]
  /** A ping's payload, kept until its pong fits: empty until the first ping. */
  pong: u8[]
  /** No fields, for the responses the connection writes itself: made once. */
  private noFields: u8[][]
  /**
   * The last final head `respond` wrote, `headBytes[0 .. headLength)`, kept
   * so that a response asking for the same head is a copy of it: the same
   * status, the same field names and values byte for byte, the same framing
   * and `Connection`, and the same `date` not reformatted since (`formats`).
   * Empty until the first head that is kept (one of at most `H1_HEAD_KEEP`
   * bytes, after a head of the same shape); then made once and kept for the
   * slot's later peers, since what it holds is a function of those inputs
   * alone.
   */
  private headBytes: u8[]
  /** How many bytes of `headBytes` the kept head is; 0 while none is kept. */
  private headLength: i32 = 0
  /** Where the kept head's first field line starts, past the status line. */
  private headFieldsAt: i32 = 0
  /** The kept head's status. */
  private headStatus: i32 = 0
  /** The kept head's framing: a length, `HTTP1_CHUNKED` or `HTTP1_NO_BODY`. */
  private headFraming: i32 = 0
  /** The kept head's `Connection` field: `H1_CONN_NONE`, `H1_CONN_CLOSE` or `H1_CONN_KEEP_ALIVE`. */
  private headConnection: i32 = 0
  /** How many of the program's fields the kept head carries. */
  private headFields: i32 = 0
  /**
   * The length of each of the kept head's field names and values, in order,
   * name then value: `2 * H1_HEAD_FIELDS` of them, made with `headBytes`.
   */
  private headLengths: i32[]
  /** The `HttpDate` the kept head's `Date` came from. */
  private headDate: HttpDate
  /** `headDate.formats()` when the kept head was written: a later format is a new second. */
  private headFormats: i64 = 0
  /** How many responses in a row have missed the kept head, up to `H1_HEAD_MISSES`. */
  private headMisses: i32 = 0
  /**
   * `date.formats()` when the misses reached `H1_HEAD_MISSES`: while the date
   * still has that count, `respond` neither compares nor keeps. -1 while on.
   */
  private headOff: i64 = -1
  /**
   * How many heads `respond` has copied from the kept one rather than written.
   *
   * @internal Read by `tests/link/net_http1_server_head_reuse` to tell a copied head from a written one.
   */
  headCopies: i64 = 0

  /**
   * A connection under `config`. A cap outside what the connection can work with panics.
   *
   * @param config the caps the connection is held to, read now and kept
   */
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
    http1ServerCheckCap("maxMessage", config.maxMessage, H1_ZERO, big - H1_FRAME_HEADER)
    http1ServerCheckCap("idleTimeout", config.idleTimeout, one, big)
    http1ServerCheckCap("headTimeout", config.headTimeout, one, big)
    // The buffers the peer's bytes fill grow by doubling and stop at 2^30
    // (`Http1Parser`'s input and head, `WsDecoder`'s input), so a cap whose
    // buffer could need more is refused here rather than reached by a peer:
    // the head holds the request line and the header section together, and
    // the input never holds more than the larger of the two lines or a chunk.
    http1ServerCheckCap(
      "maxTarget + maxHeaderBytes",
      config.maxTarget + config.maxHeaderBytes,
      one,
      big - H1_LINE_OVERHEAD
    )
    this.config = config
    // The parser is made first: the arena places each block after the last,
    // so its front fields sit on the lines just behind the connection's own.
    this.parser = new Http1Parser(config.maxTarget, config.maxHeaderBytes, config.maxHeaders, config.maxBody)
    this.date = new HttpDate()
    this.parser.keepText = false
    this.parser.maxChunk = config.chunkSize
    this.ws = null
    this.noOutput = []
    this.output = this.noOutput
    this.pool = null
    this.inputs = null
    this.heads = null
    this.data = this.noOutput
    this.pong = this.noOutput
    this.noFields = []
    this.headBytes = this.noOutput
    this.headDate = this.date
    this.headLengths = []
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
    const ws: WsDecoder | null = this.ws
    if (ws !== null) {
      ws.reset()
    }
    this.outputStart = 0
    this.outputEnd = 0
    this.data = this.noOutput
    this.dataStart = 0
    this.dataLength = 0
    this.opcode = 0
    this.status = 0
    this.pongLength = 0
    this.state = H1_S_HTTP
    this.response = H1_R_NONE
    this.responseFraming = 0
    this.responseLeft = 0
    this.responseEmpty = false
    this.requestOpen = false
    this.requestEnded = false
    this.closeAfter = false
    this.upgraded = false
    this.writeHeld = false
    this.pongPending = false
    this.inputEnded = false
    this.headTimed = false
    this.headSince = 0
    // A slot's next connection starts with no kept head, and its first
    // head is not taken for a repeat of the last connection's.
    this.headLength = 0
    this.headStatus = 0
    this.headMisses = 0
    this.headOff = -1
    this.mss = 0
    this.socketMss = 0
    this.fd = -1
    this.release()
    this.park()
  }

  /**
   * Gives the parser's input and head buffers to `inputs` and `heads` while
   * the connection rests between exchanges: speaking HTTP, no request open,
   * nothing fed and unread. Does nothing without the pools or otherwise.
   */
  park(): void {
    const inputs: Http1OutputPool | null = this.inputs
    const heads: Http1OutputPool | null = this.heads
    const p: Http1Parser = this.parser
    if (inputs === null || heads === null || this.state !== H1_S_HTTP || this.requestOpen || !p.resting()) {
      return
    }
    if (toI32(p.buf.length) > 0) {
      inputs.give(p.buf)
      p.buf = this.noOutput
      p.body = this.noOutput
      p.start = 0
      p.end = 0
      p.scan = 0
      p.lineStart = 0
      p.lineEnd = 0
    }
    if (toI32(p.head.length) > 0) {
      heads.give(p.head)
      p.head = this.noOutput
    }
  }

  /**
   * Takes back the buffers `park` gave away, before bytes are fed. A parked
   * buffer is `noOutput` itself, which a pointer compare finds without
   * loading the empty array's header from a line the request touches nowhere
   * else; any other empty buffer is still swapped for a lent one.
   */
  unpark(): void {
    const inputs: Http1OutputPool | null = this.inputs
    const heads: Http1OutputPool | null = this.heads
    const p: Http1Parser = this.parser
    const none: u8[] = this.noOutput
    if (inputs !== null && (p.buf === none || toI32(p.buf.length) === 0)) {
      p.buf = inputs.take()
      p.body = p.buf
    }
    if (heads !== null && (p.head === none || toI32(p.head.length) === 0)) {
      p.head = heads.take()
    }
  }

  // ---- Bytes in and out ---------------------------------------------------------

  /**
   * The most input the connection holds unread: what `inputRoom` counts against.
   *
   * @returns the cap in bytes on unread input: the buffer limit for HTTP, the message cap plus a frame header for WebSocket
   */
  inputLimit(): i32 {
    return this.state === H1_S_WEBSOCKET ? this.config.maxMessage + 14 : this.bufferLimit
  }

  /**
   * How many bytes `feed` would take now: none while a write is held back or once the connection is closing.
   *
   * @returns how many more input bytes the connection takes now; 0 asks the carrier to stop reading
   */
  inputRoom(): i32 {
    if (this.writeHeld || this.inputEnded || this.state === H1_S_CLOSING || this.state === H1_S_FAILED) {
      return 0
    }
    let room: i32 = 0
    if (this.state === H1_S_WEBSOCKET) {
      // Only a WebSocket reads the decoder and the configured message cap,
      // so a request's check stays on the connection's front fields.
      const ws: WsDecoder | null = this.ws
      room = this.inputLimit() - (ws !== null ? ws.end - ws.start : this.parser.buffered())
    } else {
      room = this.bufferLimit - this.parser.buffered()
    }
    return room > 0 ? room : 0
  }

  /**
   * Takes as much of `buf[off .. off + len)` as `inputRoom` allows and
   * answers how much; the rest is the caller's to feed again later. A window
   * outside `buf` panics.
   *
   * @param buf the bytes the carrier read from the peer
   * @param off where in `buf` the new bytes start
   * @param len how many new bytes there are
   * @returns how many of them the connection took, from `off`; the rest is the caller's to feed again
   */
  feed(buf: u8[], off: i32, len: i32): i32 {
    http1ServerCheckWindow("Http1Connection.feed", buf, off, len)
    const room: i32 = this.inputRoom()
    const n: i32 = len < room ? len : room
    if (n <= 0) {
      return 0
    }
    if (this.state === H1_S_WEBSOCKET) {
      this.decoder().feed(buf, off, n)
    } else {
      this.unpark()
      this.parser.feed(buf, off, n)
    }
    return n
  }

  /** The peer's byte stream has ended: once what it sent is answered, the connection is done. */
  endInput(): void {
    this.inputEnded = true
  }

  /**
   * Whether the peer's byte stream has ended (`endInput`): a request still
   * held on the connection is one its client hung up on, or half-closed.
   *
   * @returns true once the carrier read the end of the peer's stream
   */
  ended(): boolean {
    return this.inputEnded
  }

  /** The socket failed: nothing more is sent or read, and the connection is done. */
  abort(): void {
    this.state = H1_S_FAILED
    this.outputStart = 0
    this.outputEnd = 0
    this.pongPending = false
    this.writeHeld = false
    this.fd = -1
    this.release()
  }

  /**
   * Borrows `output` from the pool between connections of one, for a
   * connection that keeps its own makes it the first time: before anything
   * is written into it, which is why `room` calls it. It allocates only when
   * the pool has no free buffer, or for a connection's own, once.
   */
  private acquire(): void {
    if (this.outputCap > 0) {
      return
    }
    const pool: Http1OutputPool | null = this.pool
    const output: u8[] = pool !== null ? pool.take() : new Array<u8>(this.config.outputSize)
    this.output = output
    this.outputCap = toI32(output.length)
    this.outputStart = 0
    this.outputEnd = 0
  }

  /**
   * Gives `output` back to the pool once nothing in it is waiting: no bytes
   * to send, no write held back for room. The carrier calls it after each
   * send; a connection that keeps its own buffer keeps it.
   */
  release(): void {
    const pool: Http1OutputPool | null = this.pool
    if (pool === null || this.outputCap === 0 || this.outputEnd > this.outputStart || this.writeHeld) {
      return
    }
    pool.give(this.output)
    this.output = this.noOutput
    this.outputCap = 0
    this.outputStart = 0
    this.outputEnd = 0
  }

  /**
   * Marks the first `n` bytes of the output sent.
   *
   * @param n how many bytes from `outputStart` the carrier sent; more than are waiting counts as all of them
   */
  consume(n: i32): void {
    const pending: i32 = this.outputEnd - this.outputStart
    this.outputStart = this.outputStart + (n < pending ? n : pending)
    if (this.outputStart === this.outputEnd) {
      this.outputStart = 0
      this.outputEnd = 0
    }
  }

  /**
   * Whether the output holds bytes to send.
   *
   * @returns true while `output[outputStart .. outputEnd)` is not empty, so the carrier should wait for writable
   */
  wantsWrite(): boolean {
    return this.outputEnd > this.outputStart
  }

  /**
   * Whether the connection is over and everything is sent: the carrier closes it.
   *
   * @returns true once the connection is closing or failed and no byte or pong is left to send
   */
  isDone(): boolean {
    return (
      (this.state === H1_S_CLOSING || this.state === H1_S_FAILED) && !this.wantsWrite() && !this.pongPending
    )
  }

  /** The room at the end of the output, once what was sent is moved out of the way. */
  private room(): i32 {
    // Tested here, so that the usual case, an output already held, is no call.
    if (this.outputCap === 0) {
      this.acquire()
    }
    const output: u8[] = this.output
    const live: i32 = this.outputEnd - this.outputStart
    if (this.outputStart > 0) {
      if (live > 0 && this.outputStart <= toI32(output.length) - live) {
        copyBytes(output, 0, output, this.outputStart, live)
      }
      this.outputStart = 0
      this.outputEnd = live
    }
    return toI32(output.length) - this.outputEnd
  }

  /** The room a response or a frame may use: all but the control reserve. */
  private bodyRoom(): i32 {
    const r: i32 = this.room() - H1_CONTROL_RESERVE
    return r > 0 ? r : 0
  }

  // ---- Events -------------------------------------------------------------------

  /**
   * The next event; see the module comment.
   *
   * @returns one of the `H1_` events: `H1_NEED_MORE` when there is nothing to hand over yet, `H1_ERROR` once the connection has failed
   */
  next(): i32 {
    if (this.state === H1_S_FAILED) {
      return H1_ERROR
    }
    if (this.writeHeld) {
      // Half the output free before the program is asked to write again, so
      // that a slow reader is not answered one small write at a time.
      if (this.bodyRoom() * 2 < this.config.outputSize - H1_CONTROL_RESERVE) {
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
  private nextRequest(): i32 {
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
          const ws: WsDecoder = this.decoder()
          ws.reset()
          ws.feed(p.buf, p.start, p.buffered())
          this.state = H1_S_WEBSOCKET
          return this.nextFrame()
        }
        if (this.closeAfter) {
          this.state = H1_S_CLOSING
          return H1_NEED_MORE
        }
        // A pipelined head that waited behind the exchange starts its clock
        // now that it is the one being read. The carrier stamped `lastActive`
        // when it last moved a byte, which is no earlier than these bytes came.
        this.headArrived(this.lastActive)
      }
      const event: i32 = this.parser.next()
      if (event === HTTP1_HEAD) {
        // The head is whole, so its deadline is met; the next head's starts
        // when its first byte is fed (`headArrived`).
        this.headTimed = false
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
  private fail(status: i32): i32 {
    this.status = status
    if (this.response === H1_R_NONE) {
      // The control reserve keeps room for this whatever the output holds.
      this.room()
      const end: i32 = http1WriteResponseHead(
        this.output,
        this.outputEnd,
        status,
        http1ServerReason(status),
        this.noFields,
        this.noFields,
        H1_ZERO,
        "close",
        this.date.current()
      )
      if (end >= 0) {
        this.outputEnd = end
      }
    }
    this.state = H1_S_FAILED
    this.writeHeld = false
    return H1_ERROR
  }

  /** The frame decoder, made on the slot's first switch to WebSocket. */
  private decoder(): WsDecoder {
    const ws: WsDecoder | null = this.ws
    if (ws !== null) {
      return ws
    }
    const made: WsDecoder = new WsDecoder(true, this.config.maxMessage)
    this.ws = made
    return made
  }

  /** `next` once the slot has switched to WebSocket. */
  private nextFrame(): i32 {
    while (true) {
      if (this.pongPending && !this.sendPong()) {
        return H1_NEED_MORE
      }
      const ws: WsDecoder = this.decoder()
      const event: i32 = ws.next()
      if (event === WS_MESSAGE) {
        this.opcode = ws.opcode
        this.data = ws.data
        this.dataStart = 0
        this.dataLength = ws.dataLen
        return H1_WS_MESSAGE
      }
      if (event === WS_PING) {
        const n: i32 = ws.dataLen
        if (this.pong.length === 0) {
          this.pong = new Array<u8>(WS_MAX_CONTROL)
        }
        for (let k: i32 = 0; k < n && k < toI32(this.pong.length) && k < toI32(ws.data.length); k++) {
          this.pong[k] = ws.data[k]
        }
        this.pongLength = n
        this.pongPending = true
      } else if (event === WS_CLOSE) {
        this.status = ws.closeCode
        this.sendClose(ws.closeCode)
        this.state = H1_S_CLOSING
        return H1_WS_CLOSE
      } else if (event === WS_ERROR) {
        this.status = ws.closeCode
        this.sendClose(ws.closeCode)
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
  private sendPong(): boolean {
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
  private sendClose(code: i32): void {
    this.room()
    const payload: u8[] | null = websocketClosePayload(code, "")
    // A code that may not be sent (1005, for a close that had none) is
    // answered with an empty close.
    const body: u8[] = payload === null ? this.noOutput : payload
    const n: i32 = payload === null ? H1_ZERO : toI32(body.length)
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

  /**
   * Whether the program may answer the current request now.
   *
   * @returns true while a request's head has been read and no response to it has been started
   */
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
   *
   * @param status the HTTP status code to send, 100 to 599 but not 101
   * @param names the program's field names, one per field; nothing checks their
   *   case, and the reserved names are refused in any ASCII case
   * @param values each field's value, at the same index as its name
   * @param bodyLength the body's length in bytes, `HTTP1_CHUNKED`, or `HTTP1_NO_BODY`
   * @returns 0 once the head is queued, else `H1_INVALID`, `H1_AGAIN` or `H1_CLOSED` as above
   */
  respond(status: i32, names: u8[][], values: u8[][], bodyLength: i32): i32 {
    if (!this.answerable()) {
      return H1_CLOSED
    }
    if (status < 100 || status > 599 || status === 101) {
      return H1_INVALID
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
    let code: i32 = H1_CONN_NONE
    if (!interim && close) {
      connection = "close"
      code = H1_CONN_CLOSE
    } else if (!interim && this.parser.minor === 0) {
      connection = "keep-alive"
      code = H1_CONN_KEEP_ALIVE
    }
    // Asked first, so that a second that has turned is a new head.
    const date: u8[] = this.date.current()
    // Off for the rest of the second once heads stop repeating, so that a
    // program whose heads differ pays this test and no more.
    const keeping: boolean = !interim && this.date.formats() !== this.headOff
    if (keeping) {
      if (this.sameHead(status, names, values, framing, code)) {
        if (this.headLength <= this.bodyRoom()) {
          // `bodyRoom` stops short of the output's end, so the copy fits.
          copyBytes(this.output, this.outputEnd, this.headBytes, H1_ZERO, this.headLength)
          this.outputEnd += this.headLength
          this.headMisses = 0
          this.headCopies += 1
          return this.begin(close, framing, empty)
        }
      }
    }
    for (const name of names) {
      if (http1ServerReserved(name)) {
        return H1_INVALID
      }
    }
    const room: i32 = this.bodyRoom()
    const start: i32 = this.outputEnd
    const reason: string = http1ServerReason(status)
    const end: i32 = http1WriteResponseHead(
      this.output,
      start,
      status,
      reason,
      names,
      values,
      framing,
      connection,
      date
    )
    if (end === HTTP1_REFUSED) {
      return H1_INVALID
    }
    if (end < 0 || end - start > room) {
      // The head was not written, or ate into the reserve: take it back.
      if (end - start > this.config.outputSize - H1_CONTROL_RESERVE) {
        return H1_INVALID
      }
      if (start === 0) {
        return H1_INVALID
      }
      this.writeHeld = true
      return H1_AGAIN
    }
    this.outputEnd = end
    if (interim) {
      return 0
    }
    if (keeping) {
      // A head written here is a miss: the kept one did not match.
      this.headMisses += 1
      if (this.headMisses < H1_HEAD_MISSES) {
        this.keepHead(start, end, status, reason, names, values, framing, code)
      } else {
        this.headMisses = 0
        this.headOff = this.date.formats()
      }
    }
    return this.begin(close, framing, empty)
  }

  /** The final response's head is queued: the exchange now owes its body. Answers 0. */
  private begin(close: boolean, framing: i32, empty: boolean): i32 {
    this.closeAfter = close
    this.response = H1_R_BODY
    this.responseFraming = framing
    this.responseLeft = framing >= 0 ? framing : 0
    this.responseEmpty = empty
    return 0
  }

  /**
   * Whether the kept head is the one `respond` would write now: the same
   * status, framing and `Connection`, the same `date` not reformatted since,
   * and the program's fields the same in number and, one by one, byte for
   * byte. Its cost is a compare of the fields' bytes, which stops at the
   * first that differs.
   */
  private sameHead(status: i32, names: u8[][], values: u8[][], framing: i32, connection: i32): boolean {
    const count: i32 = toI32(names.length)
    if (
      this.headLength === 0 ||
      status !== this.headStatus ||
      framing !== this.headFraming ||
      connection !== this.headConnection ||
      count !== this.headFields ||
      toI32(values.length) !== count ||
      this.date !== this.headDate ||
      this.date.formats() !== this.headFormats
    ) {
      return false
    }
    const kept: u8[] = this.headBytes
    const limit: i32 = this.headLength
    let at: i32 = this.headFieldsAt
    const lengths: i32[] = this.headLengths
    // `count` is both arrays' length; testing each proves every access.
    for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length) && at >= 0; i += 1) {
      // Both lengths, so that a value cannot match the kept bytes past its
      // own field and pass for the kept head without its text checks.
      const name: u8[] = names[i]
      const value: u8[] = values[i]
      if (toI32(name.length) !== lengths[2 * i] || toI32(value.length) !== lengths[2 * i + 1]) {
        return false
      }
      at = http1ServerKept(kept, at, limit, name, 58)
      at = http1ServerKept(kept, at, limit, value, 13)
    }
    return at >= 0
  }

  /**
   * Records the final head just written at `output[start .. end)`, with what
   * it was written from, for `sameHead`. Its bytes are kept only when the
   * head before it had the same status, framing, `Connection` and number of
   * fields, so that a program whose every head differs pays a few stores per
   * response and no copy; a head longer than `H1_HEAD_KEEP`, or with more
   * than `H1_HEAD_FIELDS` fields, is never kept. The buffer is made at the
   * first head that is kept, so a connection whose heads never repeat their
   * shape holds none. `respond` stops calling it, and `sameHead`, for the
   * rest of the second once `H1_HEAD_MISSES` heads in a row are written.
   */
  private keepHead(
    start: i32,
    end: i32,
    status: i32,
    reason: string,
    names: u8[][],
    values: u8[][],
    framing: i32,
    connection: i32
  ): void {
    const n: i32 = end - start
    const fields: i32 = toI32(names.length)
    const again: boolean =
      status === this.headStatus &&
      framing === this.headFraming &&
      connection === this.headConnection &&
      fields === this.headFields
    this.headStatus = status
    this.headFraming = framing
    this.headConnection = connection
    this.headFields = fields
    this.headLength = 0
    if (n > H1_HEAD_KEEP || fields > H1_HEAD_FIELDS) {
      return
    }
    if (!again) {
      return
    }
    if (toI32(this.headBytes.length) < H1_HEAD_KEEP) {
      this.headBytes = new Array<u8>(H1_HEAD_KEEP)
      this.headLengths = new Array<i32>(2 * H1_HEAD_FIELDS)
    }
    for (let i: i32 = 0; i < fields && i < toI32(values.length); i += 1) {
      this.headLengths[2 * i] = toI32(names[i].length)
      this.headLengths[2 * i + 1] = toI32(values[i].length)
    }
    copyBytes(this.headBytes, H1_ZERO, this.output, start, n)
    // The field lines start past "HTTP/1.1 NNN " reason CRLF.
    this.headFieldsAt = 15 + toI32(reason.length)
    this.headLength = n
    this.headDate = this.date
    this.headFormats = this.date.formats()
  }

  /**
   * Writes `buf[off .. off + len)` of the response body, as much as the output
   * has room for, and answers how much: a chunk of a chunked body, or bytes
   * of one with a length (more than it still owes is `H1_INVALID`). When not
   * everything was taken, `H1_WRITE` says when to try the rest; `H1_AGAIN`
   * when nothing was. A response with no body takes everything and sends
   * nothing. `H1_CLOSED` with no response under way. A window outside `buf`
   * panics.
   *
   * @param buf the body bytes to send, which stay the caller's
   * @param off where in `buf` the window starts
   * @param len how many bytes the window holds
   * @returns how many bytes from `off` were taken, or `H1_AGAIN`, `H1_INVALID` or `H1_CLOSED` as above
   */
  write(buf: readonly u8[], off: i32, len: i32): i32 {
    http1ServerCheckWindow("Http1Connection.write", buf, off, len)
    if (this.response !== H1_R_BODY || this.state !== H1_S_HTTP) {
      return H1_CLOSED
    }
    if (this.responseEmpty || len === 0) {
      return len
    }
    const chunked: boolean = this.responseFraming === HTTP1_CHUNKED
    if (this.responseFraming >= 0 && len > this.responseLeft) {
      return H1_INVALID
    }
    const room: i32 = this.bodyRoom()
    let take: i32 = len
    if (chunked) {
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
    if (chunked) {
      this.outputEnd = http1WriteChunk(this.output, this.outputEnd, buf, off, take)
    } else {
      this.outputEnd = http1ServerCopy(this.output, this.outputEnd, buf, off, take)
      if (this.responseFraming >= 0) {
        this.responseLeft = this.responseLeft - take
      }
    }
    if (take < len) {
      this.writeHeld = true
    }
    return take
  }

  /**
   * `write` of `buf[off .. off + len)`, sent from `buf` itself where it can be:
   * under a `Content-Length` response on a connection whose carrier named its
   * socket (`fd`, set by `Http1Server.accept`) and with no write held back, the
   * queued output and the body leave in one `netWrite2`, and only what the
   * socket did not take is copied into the output, the way `write` copies it
   * (what does not fit is answered short, and `H1_WRITE` says when to send the
   * rest).
   *
   * Once it returns the connection holds no reference to `buf`, so the caller
   * may reuse or give back its bytes at once. A chunked or empty response, a
   * write held back (`H1_AGAIN` or a short answer not yet followed by
   * `H1_WRITE`), and a connection with no socket (`Http1TlsServer`, a sans-IO
   * carrier) copy all of it: it is `write`, with the same bytes on the wire.
   * Answers what `write` answers, `H1_INVALID` for more than the response still
   * owes; `H1_CLOSED` also when the socket failed during the send, which aborts
   * the connection. A window outside `buf` panics.
   *
   * @param buf the body bytes to send, free for the caller to reuse once this returns
   * @param off where in `buf` the window starts
   * @param len how many bytes the window holds
   * @returns how many bytes from `off` were sent or queued, or the error `write` would answer
   */
  sendBody(buf: readonly u8[], off: i32, len: i32): i32 {
    http1ServerCheckWindow("Http1Connection.sendBody", buf, off, len)
    if (
      this.fd < 0 ||
      this.writeHeld ||
      this.response !== H1_R_BODY ||
      this.state !== H1_S_HTTP ||
      this.responseEmpty ||
      this.responseFraming < 0 ||
      len === 0 ||
      len > this.responseLeft
    ) {
      return this.write(buf, off, len)
    }
    const pending: i32 = this.outputEnd - this.outputStart
    const n: i32 = netWrite2(this.fd, this.output, this.outputStart, pending, buf, off, len)
    if (n < 0 && n !== H1_AGAIN) {
      this.abort()
      return H1_CLOSED
    }
    let sent: i32 = 0
    // pending + len > 0 here (len > 0 above), so netWrite2 never answers 0: it is a count, H1_AGAIN or a failure.
    if (n > 0) {
      this.lastActive = monotonicNanos()
      this.consume(n)
      sent = n > pending ? n - pending : 0
      this.responseLeft = this.responseLeft - sent
    }
    if (sent < len) {
      const copied: i32 = this.write(buf, off + sent, len - sent)
      if (copied > 0) {
        sent = sent + copied
      } else if (sent === 0) {
        return copied
      }
    }
    this.release()
    return sent
  }

  /**
   * Ends the response: the last chunk of a chunked body. Answers 0;
   * `H1_INVALID` for a response with a length that still owes bytes;
   * `H1_AGAIN` when the last chunk does not fit yet; `H1_CLOSED` with no
   * response under way.
   *
   * @returns 0 once the response is complete, else `H1_INVALID`, `H1_AGAIN` or `H1_CLOSED` as above
   */
  end(): i32 {
    if (this.response !== H1_R_BODY || this.state !== H1_S_HTTP) {
      return H1_CLOSED
    }
    if (this.responseEmpty) {
      this.response = H1_R_DONE
      return 0
    }
    if (this.responseFraming >= 0 && this.responseLeft > 0) {
      return H1_INVALID
    }
    if (this.responseFraming === HTTP1_CHUNKED) {
      // The last chunk comes out of the body's room, not the reserve.
      if (this.bodyRoom() < 5) {
        this.writeHeld = true
        return H1_AGAIN
      }
      this.outputEnd = http1WriteLastChunk(this.output, this.outputEnd)
    }
    this.response = H1_R_DONE
    // A response with neither a length nor chunks ends with the connection.
    if (this.responseFraming === HTTP1_NO_BODY) {
      this.closeAfter = true
    }
    return 0
  }

  // ---- Content coding -----------------------------------------------------------

  /**
   * The content coding to answer the current request with, read from its
   * `Accept-Encoding` with gzip offered (`httpAcceptEncoding`):
   * `HTTP_CODING_GZIP`, `HTTP_CODING_IDENTITY` (also with no such field), or
   * `HTTP_CODING_NONE` when the client refuses identity and does not take
   * gzip. Allocates nothing. Read at `H1_REQUEST`, `H1_BODY` or `H1_END`
   * alike: the head stays the request's until its response is done.
   *
   * @returns the `HTTP_CODING_` value the response should use, ready to pass to `respondEncoded`
   */
  acceptEncoding(): i32 {
    return this.acceptEncodingOf(HTTP_OFFER_GZIP)
  }

  /**
   * Whether the current request's `Accept-Encoding` refuses the body as it
   * is (`httpIdentityRefused`); `respondEncoded` then gzips any body it can.
   *
   * @returns true when the client's `Accept-Encoding` rules out the body as it is, so only a compressed one is acceptable
   */
  identityRefused(): boolean {
    return this.acceptEncodingOf(toI32(0)) === HTTP_CODING_NONE
  }

  /** `httpAcceptEncoding` of the current request's `Accept-Encoding`, with `offered`. */
  private acceptEncodingOf(offered: i32): i32 {
    const parser: Http1Parser = this.parser
    const i: i32 = parser.headerIndex("accept-encoding")
    const spans: i32[] = parser.spans
    if (i < 0 || 4 * i + 3 >= toI32(spans.length)) {
      return HTTP_CODING_IDENTITY
    }
    const start: i32 = spans[4 * i + 2]
    const end: i32 = spans[4 * i + 3]
    if (start < 0 || start > end || end > toI32(parser.head.length)) {
      return HTTP_CODING_IDENTITY
    }
    return httpAcceptEncoding(parser.head, start, end, offered)
  }

  /**
   * The segment `respondEncoded` counts in under `enc.segmentMode`: this
   * connection's `mss` when the program set it, else `enc.mss` when the
   * program set it (above 0), else the socket's (`socketMss`), else
   * `HTTP_DEFAULT_MSS`.
   *
   * @param enc the compressor whose own `mss` is the fallback after this connection's
   * @returns the segment size in bytes that segment counting uses for this connection
   */
  segmentMss(enc: HttpCompressor): i32 {
    if (this.mss > 0) {
      return this.mss
    }
    if (enc.mss > 0) {
      return enc.mss
    }
    return this.socketMss > 0 ? this.socketMss : HTTP_DEFAULT_MSS
  }

  /**
   * Answers the current request with all of `body[off .. off + len)` in one
   * call: `respond`, `write` and `end`, the body compressed by `enc` when
   * `coding` (from `acceptEncoding`) is gzip and `enc.compress` takes it, with
   * `Content-Encoding: gzip` and the compressed `Content-Length`, and otherwise
   * sent as it is; `Vary: Accept-Encoding` while `enc.vary` is set and the
   * choice turned on the request (`HttpCompressor.varies`).
   *
   * Under `enc.segmentMode` the compressed response goes out only when, head
   * included, it takes fewer segments of `segmentMss(enc)` bytes than the body
   * as it is, and a response that fits one segment as it is goes so without
   * compressing (`enc.oneSegment`); `enc.decision` says what was chosen. A
   * request that refuses identity (`identityRefused`) is sent gzip whatever the
   * length, the saving or the segments (`enc.compressAnyway`). The program's
   * fields may not name `Content-Encoding` or, with `enc.vary`, `Vary`.
   *
   * The whole response is written or none of it: `H1_AGAIN` when the output has
   * no room for it yet (`H1_WRITE` says when to try again, compressing again),
   * `H1_INVALID` for a response larger than the output could ever hold or one
   * `respond` refuses, `H1_CLOSED` with no request to answer; 0 once it is
   * queued. A window outside `body` panics.
   *
   * @param status the HTTP status code to send, as `respond` takes it
   * @param names the program's field names, without `Content-Encoding` (or `Vary` under `enc.vary`)
   * @param values each field's value, at the same index as its name
   * @param body the program's bytes the body is in, read but not kept
   * @param off where in `body` the response body starts
   * @param len how many bytes the response body holds as it is
   * @param enc the compressor that gzips the body and adds the coding fields; its scratch output is reused per call
   * @param coding the coding chosen for this request, normally what `acceptEncoding` answered
   * @returns 0 once the whole response is queued, else `H1_AGAIN`, `H1_INVALID` or `H1_CLOSED` as above
   */
  respondEncoded(
    status: i32,
    names: u8[][],
    values: u8[][],
    body: u8[],
    off: i32,
    len: i32,
    enc: HttpCompressor,
    coding: i32
  ): i32 {
    http1ServerCheckWindow("Http1Connection.respondEncoded", body, off, len)
    if (!this.answerable()) {
      return H1_CLOSED
    }
    const required: boolean = coding === HTTP_CODING_GZIP && this.identityRefused()
    // `respond` and the body together, or neither: what `respond` sets is
    // put back when the body does not fit behind the head. `room` first, so
    // that what was sent is already moved out of the way and the `outputEnd`
    // put back is one `respond` did not move.
    this.room()
    const outputEnd: i32 = this.outputEnd
    const closeAfter: boolean = this.closeAfter
    let packed: i32 = -1
    let n: i32 = len
    let r: i32 = 0
    let queued: boolean = false
    const mss: i32 = this.segmentMss(enc)
    if (!required && enc.segmentMode && enc.oneSegment(coding, len, mss)) {
      // A response that fits one segment as it is cannot take fewer
      // compressed, so it goes as it is with no encoder run, unless its head
      // pushes it past the segment: then it is taken back and decided below.
      enc.identityFields(names, values)
      r = this.respond(status, enc.names, enc.values, len)
      if (r !== 0) {
        return r
      }
      queued = this.outputEnd - outputEnd + len <= enc.segmentSize(mss)
      if (!queued) {
        this.unrespond(outputEnd, closeAfter)
      }
    }
    if (!queued) {
      packed = required ? enc.compressAnyway(coding, body, off, len) : enc.compress(coding, body, off, len)
      if (packed >= 0) {
        enc.addFields(names, values)
        n = packed
      } else {
        enc.identityFields(names, values)
      }
      r = this.respond(status, enc.names, enc.values, n)
      if (r !== 0) {
        return r
      }
    }
    if (packed >= 0 && enc.segmentMode && !required) {
      // The head just written, and the one the body as it is would get.
      const head: i32 = this.outputEnd - outputEnd
      const plain: i32 = enc.http1IdentityHead(head, packed, len)
      if (!enc.fewerSegments(plain + len, head + packed, mss)) {
        this.unrespond(outputEnd, closeAfter)
        enc.identityFields(names, values)
        packed = -1
        n = len
        r = this.respond(status, enc.names, enc.values, n)
        if (r !== 0) {
          return r
        }
      }
    }
    if (!this.responseEmpty && n > this.bodyRoom()) {
      const fits: boolean = this.outputEnd - outputEnd + n <= this.config.outputSize - H1_CONTROL_RESERVE
      this.unrespond(outputEnd, closeAfter)
      if (!fits) {
        return H1_INVALID
      }
      this.writeHeld = true
      return H1_AGAIN
    }
    const w: i32 = packed >= 0 ? this.write(enc.output, toI32(0), n) : this.write(body, off, n)
    if (w !== n) {
      panic("Http1Connection.respondEncoded: a body the room was checked for did not fit")
    }
    return this.end()
  }

  /** Takes back a head `respond` just queued: `outputEnd` and `closeAfter` as they were before it. */
  private unrespond(outputEnd: i32, closeAfter: boolean): void {
    this.outputEnd = outputEnd
    this.closeAfter = closeAfter
    this.response = H1_R_NONE
    this.responseFraming = 0
    this.responseLeft = 0
    this.responseEmpty = false
  }

  // ---- WebSocket ----------------------------------------------------------------

  /**
   * Accepts the current request's WebSocket opening handshake (RFC 6455
   * §4.2.2) with `protocol`, empty for none: the 101 is queued, and once the
   * request has ended the slot reads frames. Answers 0; `H1_INVALID` when the
   * request is not a valid opening handshake (the program answers 400, or 426
   * for the wrong version) or `protocol` is not a token; `H1_AGAIN` when the
   * output has no room yet; `H1_CLOSED` with no request to answer.
   *
   * @param protocol the subprotocol to name in `Sec-WebSocket-Protocol`, one the client offered, or "" for none
   * @returns 0 once the 101 is queued, else `H1_INVALID`, `H1_AGAIN` or `H1_CLOSED` as above
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
    this.outputEnd = http1ServerCopy(this.output, this.outputEnd, head, H1_ZERO, n)
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
   *
   * @param fin true when this frame ends its message; false for a fragment that continuations follow
   * @param opcode the frame's `WS_OP_` opcode: text, binary, continuation, ping or pong, never close
   * @param buf the payload bytes, copied into the output
   * @param off where in `buf` the window starts
   * @param len how many bytes the window holds
   * @returns 0 once the frame is queued, else `H1_INVALID`, `H1_AGAIN` or `H1_CLOSED` as above
   */
  sendFrame(fin: boolean, opcode: i32, buf: u8[], off: i32, len: i32): i32 {
    http1ServerCheckWindow("Http1Connection.sendFrame", buf, off, len)
    if (this.state !== H1_S_WEBSOCKET) {
      return H1_CLOSED
    }
    if (opcode === WS_OP_CLOSE || len > this.config.outputSize - H1_CONTROL_RESERVE - 14) {
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
   *
   * @param code the close status code to send (RFC 6455 §7.4), such as 1000 for a normal close
   * @returns 0 once the close frame is queued, else `H1_INVALID` or `H1_CLOSED` as above
   */
  closeWebSocket(code: i32): i32 {
    if (this.state !== H1_S_WEBSOCKET) {
      return H1_CLOSED
    }
    if (websocketClosePayload(code, "") === null) {
      return H1_INVALID
    }
    this.sendClose(code)
    this.state = H1_S_CLOSING
    return 0
  }

  /**
   * Whether the slot has switched to WebSocket and is open.
   *
   * @returns true while `next` reads frames rather than requests and `sendFrame` may be called
   */
  isWebSocket(): boolean {
    return this.state === H1_S_WEBSOCKET
  }

  /** Whether nothing has moved for longer than the idle timeout, at `now` (`monotonicNanos`). */
  private idle(now: i64): boolean {
    return now - this.lastActive > toI64(this.config.idleTimeout) * toI64(1000000)
  }

  /**
   * Starts the head deadline at `now` (`monotonicNanos`) when bytes of a
   * request head wait to be read and its clock has not started. The carriers
   * call it after each `feed`; a program that feeds a connection itself calls
   * it the same way. Bytes that wait while the previous exchange is still
   * open start no clock: they count from when it is over (`nextRequest`).
   *
   * @param now the current time in `monotonicNanos`, which the deadline counts from
   */
  headArrived(now: i64): void {
    if (this.parser.buffered() > 0) {
      this.headAwaited(now)
    }
  }

  /**
   * Starts the head deadline at `now` (`monotonicNanos`) when the connection
   * waits for a head and its clock has not started, whether or not a byte of
   * it has been read. `Http1TlsServer` calls it when ciphertext arrives after
   * the handshake: a record trickled a byte at a time hands no plaintext to
   * `headArrived` until it is whole, so its bytes would otherwise only keep
   * the slot from going idle.
   *
   * @internal Called by `headArrived` and by `Http1TlsServer` in this module to start the slowloris clock on ciphertext.
   */
  headAwaited(now: i64): void {
    if (!this.headTimed && this.state === H1_S_HTTP && !this.requestOpen) {
      this.headTimed = true
      this.headSince = now
    }
  }

  /** Whether a head has been arriving for longer than `headTimeout` at `now` (`monotonicNanos`). */
  private headLate(now: i64): boolean {
    return this.headTimed && now - this.headSince > toI64(this.config.headTimeout) * toI64(1000000)
  }

  /**
   * Whether `expire` closes the slot at `now`: idle, or a head past its deadline.
   *
   * @internal Called by `Http1Server.expire` and `Http1TlsServer.expire` in this module to pick the slots to close.
   */
  expired(now: i64): boolean {
    return this.idle(now) || this.headLate(now)
  }

  /**
   * The soonest `expired` can turn true at or after `now` (`monotonicNanos`),
   * however the connection moves from here: `lastActive` only grows, and a
   * head clock not yet started starts no earlier than `now`, unless an
   * exchange is open: `nextRequest` starts a pipelined head's clock at
   * `lastActive` when it ends. Counting a quiet keep-alive's clock from
   * `lastActive` put it in the past once it was quiet for longer than
   * `headTimeout`, so each `expire` walked every slot.
   *
   * @param now the current time in `monotonicNanos`
   * @returns the earliest `monotonicNanos` instant at which `expired` could answer true, so `expire` can skip the slot until then
   * @internal Called by `Http1Server.expire` and `Http1TlsServer.expire` in this module to skip the slots that cannot expire yet.
   */
  expiresNoSooner(now: i64): i64 {
    const idle: i64 = this.lastActive + toI64(this.config.idleTimeout) * toI64(1000000)
    let start: i64 = now
    if (this.headTimed) {
      start = this.headSince
    } else if (this.requestOpen) {
      start = this.lastActive
    }
    const head: i64 = start + toI64(this.config.headTimeout) * toI64(1000000)
    return head < idle ? head : idle
  }
}

/**
 * The soonest any slot accepted after now can expire: no sooner than the
 * shorter of `idleTimeout` and `headTimeout` from now.
 */
const http1ExpireFloor = (config: Http1Config): i64 => {
  const shorter: i32 = config.headTimeout < config.idleTimeout ? config.headTimeout : config.idleTimeout
  return monotonicNanos() + toI64(shorter) * toI64(1000000)
}

// ---- Carriers -------------------------------------------------------------------

/**
 * A pool of HTTP/1.1 connections over plain TCP on one listening socket.
 * `slot`s are the indices `accept` answers; a slot is the program's from
 * `accept` until it calls `close`, and its descriptor is `fd(slot)`.
 */
export class Http1Server {
  private config: Http1Config
  /**
   * The connections built so far, slot `k`'s at `k`: one per slot ever
   * accepted into, and slot 0's once `connection` has asked for it.
   */
  connections: Http1Connection[]
  /**
   * The `Date` every slot's responses carry, formatted once a second for all
   * of them and read from the clock once per serve call: `readable` and
   * `writable` hold a reading and `flush` lets it go. `date.pin` fixes its clock.
   */
  date: HttpDate
  /**
   * Each slot's descriptor, or -1 while it is free, for the slots accepted
   * into so far: its length is the high-water mark, and a slot past it has
   * never been used.
   */
  fds: i32[]
  /** Each used slot's interest as the loop last armed it, for `rearm`. */
  private armed: i32[]
  /** The output buffers the slots borrow while they write. */
  outputs: Http1OutputPool
  /** The input and head buffers resting slots lend, with `Http1Config.idleInput`. */
  inputs: Http1OutputPool
  /** The head buffers resting slots lend, beside `inputs`; `made` counts how many the slots ever needed. */
  heads: Http1OutputPool
  /**
   * The slots closed since they were used, a stack whose top `accept` takes
   * before it builds a slot past the high-water mark: finding one costs the
   * same with every slot free as with all but one busy, where a scan of
   * `fds` walked the busy ones.
   */
  free: i32[]
  /** Where the socket is read into before the connection takes the bytes. */
  private scratch: u8[]
  /** The last accepted peer's address, in `nish:net`'s 18-byte form. */
  private peer: u8[]
  /** How many slots the pool may hold, which `size` answers. */
  private slots: i32 = 1
  /** The listening socket, which the program made with `tcpListen` and still owns. */
  private listener: i32 = -1
  /**
   * No slot can expire before this (`monotonicNanos`), so `expire` called
   * sooner walks none: it walks every slot only about once per the shorter
   * timeout, however many there are.
   */
  private expireAfter: i64 = 0
  /** How many calls of `expire` walked every slot, for a program measuring its cost. */
  expireScans: i32 = 0

  /**
   * A pool of `size` slots, at least one, serving `config` on `listener`.
   * No slot is built here: a slot's connection and its buffers are
   * allocated by the first `accept` into it and kept, so a pool sized for a
   * peak costs at start-up only the read scratch, the shared `Date` and the
   * output pool, and at most `size` connections once the peak has come.
   *
   * @param config the caps every slot's connection is held to
   * @param listener the listening socket from `tcpListen`, which stays the program's to close
   * @param size how many connections the pool serves at once; less than 1 counts as 1
   */
  constructor(config: Http1Config, listener: i32, size: i32) {
    this.config = config
    this.listener = listener
    this.connections = []
    this.fds = []
    this.armed = []
    this.free = []
    this.slots = size < 1 ? 1 : size
    this.outputs = new Http1OutputPool(config.outputSize)
    this.inputs = new Http1OutputPool(HTTP1_FIRST_INPUT)
    this.heads = new Http1OutputPool(HTTP1_FIRST_HEAD)
    this.date = new HttpDate()
    this.scratch = new Array<u8>(config.chunkSize)
    this.peer = new Array<u8>(H1_ADDRESS_SIZE)
  }

  /** A new connection on this pool's outputs and `Date`, for the next slot built. */
  private build(): Http1Connection {
    const conn: Http1Connection = new Http1Connection(this.config)
    conn.pool = this.outputs
    conn.date = this.date
    if (this.config.idleInput) {
      conn.inputs = this.inputs
      conn.heads = this.heads
    }
    this.connections.push(conn)
    return conn
  }

  /**
   * How many slots the pool has, built or not.
   *
   * @returns the pool's capacity in connections, as the constructor fixed it
   */
  size(): i32 {
    return this.slots
  }

  /**
   * How many slots hold a connection.
   *
   * @returns the count of slots accepted into and not yet closed
   */
  busy(): i32 {
    let n: i32 = 0
    for (const fd of this.fds) {
      if (fd >= 0) {
        n = n + 1
      }
    }
    return n
  }

  /**
   * Whether `slot` is a slot of this pool that holds a connection.
   *
   * @param slot the slot index to ask about, any value
   * @returns true when the slot is in range and accepted into, not closed
   */
  holds(slot: i32): boolean {
    return slot >= 0 && slot < toI32(this.fds.length) && this.fds[slot] >= 0
  }

  /**
   * The descriptor of `slot`, for `pollAdd`; -1 for a free or unknown one.
   *
   * @param slot the slot `accept` answered
   * @returns the slot's socket descriptor, which the pool owns and `close` closes; -1 when the slot holds none
   */
  fd(slot: i32): i32 {
    return this.holds(slot) ? this.fds[slot] : -1
  }

  /**
   * The connection of `slot`. A slot never accepted into, or out of range,
   * names slot 0's connection, which this builds when no slot has been yet
   * (the first `accept` then takes it, restarted).
   *
   * @param slot the slot `accept` answered
   * @returns the slot's connection, which the pool keeps; read its events and write its response through it
   */
  connection(slot: i32): Http1Connection {
    if (slot >= 0 && slot < toI32(this.connections.length)) {
      return this.connections[slot]
    }
    return this.connections.length > 0 ? this.connections[0] : this.build()
  }

  /**
   * Accepts the next waiting connection into a free slot and answers the
   * slot, which the program adds to its loop with `H1_WANT_READ`; -11 when
   * none is waiting, `H1_POOL_FULL` when every slot is busy (the connection
   * is closed), or `tcpAccept`'s own failure.
   *
   * @returns the new connection's slot, or a negative code as above
   */
  accept(): i32 {
    const fd: i32 = tcpAccept(this.listener, this.peer)
    if (fd < 0) {
      return fd
    }
    // A slot closed before is taken first, then the next never used, so the
    // first accepts take slots 0, 1, 2 ... and a pool that never fills never
    // builds its last slots.
    let k: i32 = H1_POOL_FULL
    if (this.free.length > 0) {
      k = this.free[this.free.length - 1]
      this.free.pop()
    } else if (toI32(this.fds.length) < this.slots) {
      k = toI32(this.fds.length)
      this.fds.push(H1_FREE)
      this.armed.push(H1_WANT_READ)
    }
    if (k < 0 || k >= toI32(this.fds.length) || k >= toI32(this.armed.length)) {
      netClose(fd)
      return H1_POOL_FULL
    }
    const conn: Http1Connection = k < toI32(this.connections.length) ? this.connections[k] : this.build()
    this.fds[k] = fd
    this.armed[k] = H1_WANT_READ
    conn.restart()
    conn.fd = fd
    // Once a connection, not a request, so a keep-alive request costs no
    // syscall: a path whose MSS moves after the handshake is not followed.
    const mss: i32 = netMss(fd)
    if (mss > 0) {
      conn.socketMss = mss
    }
    conn.lastActive = monotonicNanos()
    return k
  }

  /**
   * The socket of `slot` is readable: reads it while the connection has room
   * and the socket has more, then sends. Answers the interest. It begins a
   * serve call, which the program's `flush` of the slot ends: the responses
   * written in between carry one clock reading as their `Date`.
   *
   * @param slot the slot `accept` answered
   * @returns the `H1_WANT_` bits the slot now waits for, with `H1_DONE` once it should be closed
   */
  readable(slot: i32): i32 {
    if (!this.holds(slot)) {
      return H1_DONE
    }
    this.date.hold()
    const conn: Http1Connection = this.connections[slot]
    const fd: i32 = this.fds[slot]
    let moved: boolean = false
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
      moved = true
      conn.feed(this.scratch, H1_ZERO, n)
      // A short read emptied the socket. The loop's readiness is
      // level-triggered, so more input, or the peer's close, wakes it again;
      // reading once more here would only answer -11, at the price of a
      // system call on every request.
      if (n < want) {
        break
      }
    }
    if (moved) {
      const now: i64 = monotonicNanos()
      conn.lastActive = now
      conn.headArrived(now)
    }
    return this.settle(slot)
  }

  /**
   * The socket of `slot` is writable: sends, and begins a serve call as `readable` does. Answers the interest.
   *
   * @param slot the slot `accept` answered
   * @returns the `H1_WANT_` bits the slot now waits for, with `H1_DONE` once it should be closed
   */
  writable(slot: i32): i32 {
    if (!this.holds(slot)) {
      return H1_DONE
    }
    this.date.hold()
    return this.settle(slot)
  }

  /**
   * `slot`'s connection's next event; `H1_ERROR` for a free slot. While a
   * write is held back the output is sent first, so that the room it waits
   * for is made here and `H1_WRITE` comes in the same pass; otherwise what
   * the program writes in answer to one event and the next goes out together
   * at `flush`, as one segment rather than several.
   *
   * @param slot the slot `accept` answered
   * @returns the connection's next `H1_` event, as `Http1Connection.next` answers it
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
   * otherwise read while it has room and write while it holds bytes or a
   * write is held back (its `H1_WRITE` comes from `next` once the socket is
   * writable, even when this send emptied the output). It ends
   * the serve call, so a response written after it reads the clock anew.
   *
   * @param slot the slot `accept` answered
   * @returns the `H1_WANT_` bits to arm the slot with, or `H1_DONE` when the program should `close` it
   */
  flush(slot: i32): i32 {
    this.date.unhold()
    return this.settle(slot)
  }

  /** `flush` within a serve call: sends, answers the interest, and keeps the clock reading. */
  private settle(slot: i32): i32 {
    if (!this.holds(slot)) {
      return H1_DONE
    }
    const conn: Http1Connection = this.connections[slot]
    this.send(slot)
    if (conn.isDone()) {
      return H1_DONE
    }
    conn.park()
    let wants: i32 = 0
    if (conn.inputRoom() > 0) {
      wants = wants | H1_WANT_READ
    }
    if (conn.wantsWrite() || conn.writeHeld) {
      // A held write's `H1_WRITE` comes only from `next`. A send here that
      // emptied the output, because the peer read between `next` and
      // `flush`, leaves no byte to wait on, and a held write reads nothing,
      // so without the write bit the slot would be armed for nothing and the
      // response would never finish. The empty socket is writable at once.
      wants = wants | H1_WANT_WRITE
    }
    return wants
  }

  /** Writes what `slot`'s connection holds, which it holds, until the socket would block. */
  private send(slot: i32): void {
    const conn: Http1Connection = this.connections[slot]
    const fd: i32 = this.fds[slot]
    const pending: i32 = conn.outputEnd - conn.outputStart
    while (conn.wantsWrite()) {
      const n: i32 = netWrite(fd, conn.output, conn.outputStart, conn.outputEnd - conn.outputStart)
      if (n <= 0) {
        if (n !== H1_AGAIN) {
          conn.abort()
        }
        break
      }
      conn.consume(n)
    }
    if (conn.outputEnd - conn.outputStart < pending) {
      conn.lastActive = monotonicNanos()
    }
    conn.release()
  }

  /**
   * Whether the program must `pollModify` `slot`'s descriptor to `wants`, the
   * interest `readable`, `writable` or `flush` answered, and records it as
   * armed when it must. A keep-alive connection answers the same interest
   * request after request, and each `pollModify` is a system call
   * (`epoll_ctl`) that changes nothing.
   *
   * @param slot the slot `accept` answered
   * @param wants the interest bits a serve call answered; only `H1_WANT_READ` and `H1_WANT_WRITE` count
   * @returns true when the interest changed and the program should call
   *   `pollModify`; false when `slot` is already armed for it, or is free or
   *   out of range
   */
  rearm(slot: i32, wants: i32): boolean {
    const interest: i32 = wants & (H1_WANT_READ | H1_WANT_WRITE)
    if (!this.holds(slot) || slot >= toI32(this.armed.length) || this.armed[slot] === interest) {
      return false
    }
    this.armed[slot] = interest
    return true
  }

  /**
   * Closes `slot`'s socket, whatever is left unsent, and frees the slot.
   *
   * @param slot the slot to close; a free or unknown one is ignored
   */
  close(slot: i32): void {
    if (!this.holds(slot)) {
      return
    }
    netClose(this.fds[slot])
    this.fds[slot] = H1_FREE
    this.free.push(slot)
    if (slot < toI32(this.connections.length)) {
      this.connections[slot].abort()
    }
  }

  /**
   * Closes every slot that has been idle past `idleTimeout`, or reading one
   * head for longer than `headTimeout`, at `now` (`monotonicNanos`); answers how many.
   *
   * @param now the current time in `monotonicNanos`, which every timeout is measured against
   * @returns how many slots this call closed
   */
  expire(now: i64): i32 {
    if (now < this.expireAfter) {
      return 0
    }
    this.expireScans = this.expireScans + 1
    let soonest: i64 = http1ExpireFloor(this.config)
    let n: i32 = 0
    for (let k: i32 = 0; k < toI32(this.fds.length) && k < toI32(this.connections.length); k++) {
      if (this.fds[k] >= 0) {
        const conn = this.connections[k]
        if (conn.expired(now)) {
          this.close(k)
          n = n + 1
        } else if (conn.expiresNoSooner(now) < soonest) {
          soonest = conn.expiresNoSooner(now)
        }
      }
    }
    this.expireAfter = soonest
    return n
  }
}

/**
 * A pool of HTTP/1.1 connections over TLS 1.3 on one listening socket: one
 * `Http1Connection` beside each slot of a `TlsTcpServer`, run the way
 * `nish/net/http2-tls` runs HTTP/2. A handshake that chose ALPN `http/1.1`,
 * or none (a client that does not send ALPN speaks HTTP/1.1), reaches its
 * connection; any other protocol is shut down with `close_notify`. A slot's
 * connection is built on the first accept into it and kept, as
 * `Http1Server`'s is.
 */
export class Http1TlsServer {
  private config: Http1Config
  /** The TLS 1.3 pool underneath, one slot beside each connection; read it for a slot's TLS connection. */
  tls: TlsTcpServer
  /**
   * The connections built so far, slot `k`'s at `k`: one per slot ever
   * accepted into. `connection` never adds to it; a slot never built reads
   * `vacant` instead.
   */
  connections: Http1Connection[]
  /**
   * What `connection` answers for every slot never built: one connection no
   * slot holds and every such slot shares, so the slot never reads as
   * another slot's live request. Its first read allocates it, once per
   * server, and a caller must not change it.
   */
  private vacant: Http1Connection | null = null
  /** The `Date` every slot's responses carry, as `Http1Server.date` is. */
  date: HttpDate
  /** Where TLS decrypts into before the connection takes the bytes. */
  private scratch: u8[]
  /** The output buffers the slots borrow while they write. */
  outputs: Http1OutputPool
  /** The input and head buffers resting slots lend, with `Http1Config.idleInput`. */
  private inputs: Http1OutputPool
  private heads: Http1OutputPool
  /** No slot can expire before this (`monotonicNanos`): `Http1Server.expireAfter`. */
  private expireAfter: i64 = 0
  /** How many calls of `expire` walked every slot. */
  expireScans: i32 = 0

  /**
   * A pool of `size` slots, at least one, serving `config` over TLS under
   * `tlsConfig` on `listener`. No slot is built here: the first `accept` into
   * a slot builds its connection and, in `tls`, its handshake state, and
   * keeps them, so a pool sized for a peak costs at start-up only the read
   * scratches, the shared `Date` and the empty pools.
   *
   * @param tlsConfig the certificate chain and TLS settings every handshake uses
   * @param config the caps every slot's connection is held to
   * @param listener the listening socket from `tcpListen`, which stays the program's to close
   * @param size how many connections the pool serves at once
   */
  constructor(tlsConfig: TlsServerConfig, config: Http1Config, listener: i32, size: i32) {
    this.config = config
    this.tls = new TlsTcpServer(tlsConfig, listener, size)
    this.connections = []
    this.outputs = new Http1OutputPool(config.outputSize)
    this.inputs = new Http1OutputPool(HTTP1_FIRST_INPUT)
    this.heads = new Http1OutputPool(HTTP1_FIRST_HEAD)
    this.date = new HttpDate()
    this.scratch = new Array<u8>(config.chunkSize)
  }

  /**
   * A new connection on this pool's outputs and `Date`, for the next slot
   * built. Called by `accept` alone, as `tls` builds slots: slot `k`'s
   * connection must sit at index `k` of `connections`.
   */
  private build(): Http1Connection {
    const conn: Http1Connection = this.make()
    this.connections.push(conn)
    return conn
  }

  /** A connection on this pool's outputs and `Date` that no slot holds yet. */
  private make(): Http1Connection {
    const conn: Http1Connection = new Http1Connection(this.config)
    conn.pool = this.outputs
    conn.date = this.date
    if (this.config.idleInput) {
      conn.inputs = this.inputs
      conn.heads = this.heads
    }
    return conn
  }

  /**
   * How many slots the pool has, built or not.
   *
   * @returns the pool's capacity in connections, as `tls` holds it
   */
  size(): i32 {
    return this.tls.size()
  }

  /**
   * How many slots hold a connection.
   *
   * @returns the count of slots accepted into and not yet closed, handshakes included
   */
  busy(): i32 {
    return this.tls.busy()
  }

  /**
   * Whether `slot` holds a connection.
   *
   * @param slot the slot index to ask about, any value
   * @returns true when the slot is in range and accepted into, not closed
   */
  holds(slot: i32): boolean {
    return this.tls.holds(slot)
  }

  /**
   * The descriptor of `slot`, for `pollAdd`; -1 for a free one.
   *
   * @param slot the slot `accept` answered
   * @returns the slot's socket descriptor, which the pool owns and `close` closes; -1 when the slot holds none
   */
  fd(slot: i32): i32 {
    return this.tls.fd(slot)
  }

  /**
   * Whether `slot` holds a connection and has its HTTP/1.1 connection built,
   * as `Http2TlsServer.live` asks: a slot accepted on `tls` directly holds a
   * TLS session and no `Http1Connection`, and reads as free here.
   */
  private live(slot: i32): boolean {
    return this.tls.holds(slot) && slot < toI32(this.connections.length)
  }

  /**
   * The HTTP/1.1 connection of `slot`. A slot never accepted into answers
   * `vacant`, as a free slot answers a connection that holds nothing, and
   * builds no slot; a slot out of range names slot 0's.
   *
   * @param slot the slot `accept` answered
   * @returns the slot's connection, which the pool keeps; the shared `vacant` one, not to be changed, for a slot never built
   */
  connection(slot: i32): Http1Connection {
    const index: i32 = slot >= 0 && slot < this.tls.size() ? slot : 0
    if (index >= 0 && index < toI32(this.connections.length)) {
      return this.connections[index]
    }
    const vacant: Http1Connection | null = this.vacant
    if (vacant !== null) {
      return vacant
    }
    const made: Http1Connection = this.make()
    this.vacant = made
    return made
  }

  /**
   * The ALPN protocol `slot`'s handshake chose, or empty.
   *
   * @param slot the slot `accept` answered
   * @returns the protocol identifier the handshake agreed on, such as "http/1.1", or "" when none was chosen yet or at all
   */
  alpn(slot: i32): string {
    return this.tls.connection(slot).tls.alpn
  }

  /**
   * Whether `slot`'s handshake is done and chose a protocol other than `http/1.1`.
   *
   * @param slot the slot `accept` answered
   * @returns true when the slot will be shut down rather than served, because its client wants another protocol
   */
  refused(slot: i32): boolean {
    const chosen: string = this.alpn(slot)
    return this.tls.connection(slot).state === TLS_RECORD_STATE_OPEN && chosen !== "" && chosen !== H1_ALPN
  }

  /**
   * Accepts the next waiting connection as `TlsTcpServer.accept` does, with
   * the caller's 32-byte server random and x25519 key, and gives it a fresh
   * connection, building the slot's on its first accept. Answers the slot, or
   * what `TlsTcpServer.accept` answers.
   *
   * @param serverRandom 32 fresh random bytes for the ServerHello
   * @param ephemeralPrivate a fresh x25519 private key for this handshake alone
   * @returns the new connection's slot, or the negative code `TlsTcpServer.accept` answers
   */
  accept(serverRandom: u8[], ephemeralPrivate: u8[]): i32 {
    const slot: i32 = this.tls.accept(serverRandom, ephemeralPrivate)
    if (slot >= 0) {
      // `tls` builds a slot past its high-water mark one at a time, so this
      // builds at most the one connection, keeping slot `k`'s at `k`.
      while (toI32(this.connections.length) <= slot) {
        this.build()
      }
      const conn: Http1Connection = this.connections[slot]
      conn.restart()
      conn.lastActive = monotonicNanos()
    }
    return slot
  }

  /**
   * The socket of `slot` is readable: TLS reads it, and what the connection has to send goes after. Answers the interest.
   *
   * @param slot the slot `accept` answered
   * @returns the TLS interest bits the slot now waits for (`H1_WANT_` values), with `TLS_RECORD_DONE` once it should be closed
   */
  readable(slot: i32): i32 {
    const live: boolean = this.live(slot)
    const now: i64 = monotonicNanos()
    // What a lingering slot drains is not activity, so `idleTimeout` bounds
    // how long a client that trickles bytes after the close can hold it.
    if (live && !this.tls.lingering(slot)) {
      this.connections[slot].lastActive = now
    }
    this.tls.readable(slot)
    // Ciphertext after the handshake is the start of a head, or of a record
    // that will hold one, so the head's clock starts here; a record trickled
    // a byte at a time would hand `next` no plaintext until it is whole. The
    // handshake itself is bounded by `idleTimeout` alone (TLS-4).
    if (live && this.tls.connection(slot).state === TLS_RECORD_STATE_OPEN) {
      this.connections[slot].headAwaited(now)
    }
    return this.flush(slot)
  }

  /**
   * The socket of `slot` is writable. Answers the interest.
   *
   * @param slot the slot `accept` answered
   * @returns the TLS interest bits the slot now waits for (`H1_WANT_` values), with `TLS_RECORD_DONE` once it should be closed
   */
  writable(slot: i32): i32 {
    this.tls.writable(slot)
    return this.flush(slot)
  }

  /**
   * Signs `slot`'s CertificateVerify with `key`, as `TlsTcpServer.signP256` does. Answers the interest.
   *
   * @param slot the slot whose handshake waits for its signature
   * @param key the certificate's P-256 private key, which stays the caller's to wipe
   * @returns the TLS interest bits the slot now waits for (`H1_WANT_` values), with `TLS_RECORD_DONE` once it should be closed
   */
  signP256(slot: i32, key: Secret<u8[]>): i32 {
    this.tls.signP256(slot, key)
    return this.flush(slot)
  }

  /**
   * Moves what TLS has decrypted for `slot` into its connection, as far as
   * the connection has room, and answers the connection's next event. A free
   * slot, or one whose ALPN was another protocol, answers `H1_ERROR`.
   *
   * @param slot the slot `accept` answered
   * @returns the connection's next `H1_` event, as `Http1Connection.next` answers it
   */
  next(slot: i32): i32 {
    if (!this.live(slot) || this.refused(slot)) {
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
   * connection still holds bytes or a write is held back.
   *
   * @param slot the slot `accept` answered
   * @returns the TLS interest bits the slot now waits for (`H1_WANT_` values), with `TLS_RECORD_DONE` once it should be closed
   */
  flush(slot: i32): i32 {
    if (!this.live(slot)) {
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
    conn.park()
    const wants: i32 = this.tls.interest(slot)
    // A held write waits on the write bit even with nothing queued, as `Http1Server.flush` explains.
    return (conn.wantsWrite() || conn.writeHeld) && (wants & TLS_RECORD_DONE) === 0
      ? wants | TLS_RECORD_WANT_WRITE
      : wants
  }

  /**
   * Writes what `slot`'s connection holds into TLS, as far as TLS takes it;
   * a slot never built has nothing to write.
   */
  private send(slot: i32): void {
    if (slot < 0 || slot >= toI32(this.connections.length)) {
      return
    }
    const conn: Http1Connection = this.connections[slot]
    const pending: i32 = conn.outputEnd - conn.outputStart
    while (conn.wantsWrite()) {
      const n: i32 = this.tls.write(slot, conn.output, conn.outputStart, conn.outputEnd - conn.outputStart)
      if (n <= 0) {
        break
      }
      conn.consume(n)
    }
    if (conn.outputEnd - conn.outputStart < pending) {
      conn.lastActive = monotonicNanos()
    }
    conn.release()
  }

  /**
   * Ends `slot`'s connection and frees the slot at once, as `TlsTcpServer.close` does.
   *
   * @param slot the slot to close
   */
  close(slot: i32): void {
    this.tls.close(slot)
    if (slot >= 0 && slot < toI32(this.connections.length)) {
      this.connections[slot].abort()
    }
  }

  /**
   * Closes every slot that has been idle past `idleTimeout`, or reading one
   * head for longer than `headTimeout`, at `now` (`monotonicNanos`); answers how many.
   *
   * @param now the current time in `monotonicNanos`, which every timeout is measured against
   * @returns how many slots this call closed
   */
  expire(now: i64): i32 {
    if (now < this.expireAfter) {
      return 0
    }
    this.expireScans = this.expireScans + 1
    let soonest: i64 = http1ExpireFloor(this.config)
    let n: i32 = 0
    for (let k: i32 = 0; k < this.tls.size() && k < toI32(this.connections.length); k++) {
      if (this.tls.holds(k)) {
        const conn = this.connections[k]
        if (conn.expired(now)) {
          this.tls.close(k)
          n = n + 1
        } else if (conn.expiresNoSooner(now) < soonest) {
          soonest = conn.expiresNoSooner(now)
        }
      }
    }
    this.expireAfter = soonest
    return n
  }
}
