/**
 * `nish/net/http-server` — one handler for HTTP/1.1, HTTP/2 (over TLS and
 * cleartext) and HTTP/3, with Alt-Svc advertising the HTTP/3 port.
 *
 * `HttpServer` is `HttpHandler`'s pull loop (`nish/net/handler`) over up to
 * four listeners at once. The program builds a `Router`, configures the
 * listeners, and loops on `waitSigned` (or `wait`, when every listener is
 * cleartext), `ready` and `take`, switching on `r.route`; one route body
 * answers every version.
 *
 *     const server = new HttpServer(new HttpServerLimits(), router)
 *     server.listenHttp1(tcpFd, new Http1Config(), 256)
 *     server.listenHttp2Tls(tlsFd, tlsConfig, new Http2Config(), 64)
 *     server.listenHttp3(udpFd, quicConfig, new Http3Config(), 64, entropy)
 *     for (;;) {
 *       server.waitSigned(1000, key)
 *       while (server.ready()) {
 *         const r: HttpServerRequest = server.take()
 *         if (r.route === HELLO) {
 *           server.send(r, 200, TEXT_PLAIN, HELLO_BODY, 0, HELLO_BODY.length)
 *         } else {
 *           server.refuse(r)
 *         }
 *       }
 *     }
 *
 * **One copy in.** Every version copies the request head once into the
 * request's own `head`, a buffer of `limits.maxHead` bytes made on the
 * request's first use and never grown: each listen call checks that no head
 * its carrier accepts can overrun it. The body is held whole, up to
 * `limits.maxBody`; past it the request is answered 413 on every version.
 *
 * **A fixed pool.** `limits.requests` requests are shared by every listener.
 * With none free, an HTTP/1.1 connection stops being read until one is, an
 * HTTP/2 stream is refused with REFUSED_STREAM and an HTTP/3 one with
 * H3_REQUEST_REJECTED, so the client may retry. No connection holds more
 * than a quarter of the pool.
 *
 * **Alt-Svc.** Once an HTTP/3 listener is configured, every HTTP/1.1 and
 * HTTP/2 over TLS response names its port (`h3=":443"; ma=86400`); with
 * `altSvcMaxAge` 0 they say `alt-svc: clear` instead. A response whose fields
 * already hold an `alt-svc` keeps the program's. An h2c response carries
 * none: it reaches clients through a proxy, and would name the backend's port.
 *
 * **One HTTP/2 slot space.** The TLS and the cleartext HTTP/2 carriers share
 * the stream tables: each listener's slots follow the other's, so every
 * HTTP/2 path below names a slot of either and the carrier is looked up once,
 * in the `h2Holds` family.
 */

import { copyBytes } from "nish/bytes"
import { JsonWriter } from "nish/json"
import { HANDLER_ABSENT, HANDLER_DROPPED, HANDLER_MAX_WATCHED, HANDLER_SENT } from "nish/net/handler"
import { HttpFields, httpFieldBytes, httpFieldIs } from "nish/net/http-fields"
import { HTTP1_CHUNKED, HTTP1_NO_BODY, http1HexValue } from "nish/net/http1-codec"
import {
  H1_AGAIN,
  H1_BODY,
  H1_DONE,
  H1_END,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_REQUEST,
  H1_WANT_READ,
  H1_WANT_WRITE,
  H1_WRITE,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server"
import {
  H2_AGAIN,
  H2_DATA,
  H2_ERROR,
  H2_INVALID,
  H2_NEED_MORE,
  H2_REQUEST,
  H2_RESET,
  H2_TRAILERS,
  Http2Config,
  Http2Connection,
} from "nish/net/http2"
import { H2_CANCEL, H2_INTERNAL_ERROR, H2_NO_ERROR, H2_REFUSED_STREAM } from "nish/net/http2-frame"
import { H2C_POOL_FULL, Http2CleartextServer } from "nish/net/http2-cleartext"
import { Http2TlsServer } from "nish/net/http2-tls"
import {
  H3_AGAIN,
  H3_DATA,
  H3_END,
  H3_ERROR,
  H3_INVALID,
  H3_NEED_MORE,
  H3_REQUEST,
  H3_RESET,
  Http3Config,
  Http3Connection,
} from "nish/net/http3"
import {
  H3_INTERNAL_ERROR,
  H3_NO_ERROR,
  H3_REQUEST_CANCELLED,
  H3_REQUEST_REJECTED,
} from "nish/net/http3-frame"
import { H3_SERVER_RECEIVE_BURST, Http3Server } from "nish/net/http3-server"
import { QUIC_CONN_CID_LENGTH, QuicServerConfig } from "nish/net/quic"
import { QUIC_MAX_CID_LENGTH } from "nish/net/quic-packet"
import {
  ROUTER_BAD_ESCAPE,
  ROUTER_METHOD_NOT_ALLOWED,
  ROUTER_NO_ROOM,
  Router,
  routerDecode,
} from "nish/net/router"
import { TlsServerConfig } from "nish/net/tls"
import { TLS_RECORD_DONE, TLS_RECORD_SIGN } from "nish/net/tls/record-server"
import { TLS_TCP_POOL_FULL } from "nish/net/tls-tcp"
import { URL_DECODE_ALLOW_NUL, URL_DECODE_ERR_SPACE, URL_DECODE_FORM, percentDecode } from "nish/net/url"
import { netLocalPort, pollAdd, pollCreate, pollModify, pollRemove, pollWait, udpRecvFrom } from "nish:net"
import { Secret } from "nish:secret"

/** The base `digits` writes a content-length in, and the byte of its digit 0. */
const HTTP_SERVER_TEN: i32 = 10
const HTTP_SERVER_ZERO_DIGIT: i32 = 48

/** The status a body past `maxBody` is answered with. */
const HTTP_SERVER_TOO_LARGE: i32 = 413

// A request's life: free, reading its body, whole but parked behind a full
// output, queued for `take`, held by the program, streaming its response,
// and flushing the response's last bytes.
const HTTP_SERVER_FREE: i32 = 0
const HTTP_SERVER_READING: i32 = 1
const HTTP_SERVER_PARKED: i32 = 2
const HTTP_SERVER_QUEUED: i32 = 3
const HTTP_SERVER_HELD: i32 = 4
const HTTP_SERVER_STREAMING: i32 = 5
const HTTP_SERVER_FLUSHING: i32 = 6

// Which carrier a request came in on.
const HTTP_SERVER_H1: i32 = 1
const HTTP_SERVER_H2: i32 = 2
const HTTP_SERVER_H3: i32 = 3

// Poll tokens: an HTTP/1.1 slot is its own number, an HTTP/2 slot is past
// `HTTP_SERVER_H2_BASE`, and a watched descriptor is `-2 - id`. A listener's
// token, less -100, is also its entry in `restUntil`.
const HTTP_SERVER_H1_LISTENER: i32 = -100
const HTTP_SERVER_H2_LISTENER: i32 = -101
const HTTP_SERVER_H3_SOCKET: i32 = -102
const HTTP_SERVER_H2C_LISTENER: i32 = -103
const HTTP_SERVER_H2_BASE: i32 = 1048576

const HTTP_SERVER_READ_BITS: i32 = 5
const HTTP_SERVER_ZERO: i32 = 0
const HTTP_SERVER_ACCEPT_NONE: i32 = -11
const HTTP_SERVER_ACCEPT_ABORTED: i32 = -103
// How long a listener rests after an accept failed for want of a resource.
const HTTP_SERVER_ACCEPT_REST: i64 = 100000000
// How often the timeouts are looked at.
const HTTP_SERVER_SWEEP: i64 = 1000000000
const HTTP_SERVER_NANOS_PER_MS: i64 = 1000000
// The method, version and line ends `Http1Server` allows beside its target and header caps.
const HTTP_SERVER_H1_LINE_OVERHEAD: i64 = 44
// The most `Http3Server.receive` bursts one turn takes.
const HTTP_SERVER_H3_ROUNDS: i32 = 64
const HTTP_SERVER_TOOK_ONE: i32 = 256
const HTTP_SERVER_TOOK_THREE: i32 = 768
const HTTP_SERVER_MAX_REQUESTS: i32 = 65536
const HTTP_SERVER_MAX_BODY: i32 = 1073741824
const HTTP_SERVER_MAX_HEAD: i32 = 1048576
// A body's small tier (`T` is the lesser of this and `maxBody`), and its first array.
const HTTP_SERVER_BODY_TIER: i32 = 65536
const HTTP_SERVER_BODY_FIRST: i32 = 64
/** The largest datagram (a GRO receive included) the drain reads, as `Http3Server.receive` reads them. */
const HTTP_SERVER_UDP_SIZE: i32 = 65536
/** A sender's address in `nish:net`'s form. */
const HTTP_SERVER_UDP_ADDRESS: i32 = 18

/** The caps an `HttpServer` holds itself to; every listener's carrier is checked against them. */
export class HttpServerLimits {
  /** The most requests held at once, across every connection and version. 1 to 65536. */
  requests: i32 = 1024
  /** The largest request body, in bytes; past it a request is answered 413. 0 to 2^30. */
  maxBody: i32 = 1048576
  /** The largest request head (method, target and fields), in bytes. 256 to 2^20. */
  maxHead: i32 = 32768
  /** The most fields a request may carry. 1 to 1024. */
  maxFields: i32 = 100
  /** The most fields a response may carry, Alt-Svc and content-length included. 2 to 256. */
  maxResponseFields: i32 = 32
  /** Milliseconds from a request's head to the end of its body. */
  bodyTimeout: i32 = 30000
  /** Milliseconds an HTTP/2 connection (over TLS or h2c) with no open stream is kept. */
  idleTimeout: i32 = 60000
  /** Milliseconds a cleartext HTTP/2 connection (`listenH2c`) has to send its 24-byte preface; after it, `idleTimeout` applies. */
  prefaceTimeout: i32 = 10000
  /** Seconds a client may remember the Alt-Svc advertisement; 0 sends `alt-svc: clear`. */
  altSvcMaxAge: i32 = 86400
  /** The port Alt-Svc names; 0 names the HTTP/3 socket's own. */
  altSvcPort: i32 = 0
  /** The most readiness events one `wait` takes. */
  maxEvents: i32 = 256
  /** Bytes in the JSON scratch buffer. At least 256. */
  jsonBytes: i32 = 65536
}

/**
 * One request, whole, from any version: its head copied out of the carrier
 * and its body. Every position is an offset into `head` or `body`, which are
 * the request's own and stay valid until it is answered.
 */
export class HttpServerRequest {
  /** The method, the target and the header section (field names lowercased); on HTTP/2 and 3, `:authority` is the field `host`. */
  head: u8[]
  /**
   * Four per field, into `head`: name start and end, value start and end.
   * @internal Filled by `HttpServer` in this module when it copies the head, and read by `header`, `valueStart` and `valueEnd`.
   */
  spans: i32[]
  /**
   * The route parameters as `[start, end)` pairs into `head`, in the pattern's order.
   * @internal Filled by `HttpServer` in this module from `Router.match`; programs read them through `paramStart`, `param` and the rest.
   */
  params: i32[]
  /** The body, `body[0 .. bodyLength)`. */
  body: u8[]
  /**
   * What the carrier had no room for yet: `pending[pendingStart .. pendingEnd)`.
   * @internal Written and flushed by `HttpServer` in this module while it streams the response.
   */
  pending: u8[]
  /**
   * When the head was read (`monotonicNanos`); `bodyTimeout` runs from here.
   * @internal Stamped and checked by `HttpServer` in this module.
   */
  since: i64 = 0
  /**
   * The HTTP/2 or HTTP/3 stream the request came on; 0 on HTTP/1.1.
   * @internal Read by `HttpServer` in this module to answer on the stream.
   */
  stream: i64 = 0
  /** The index `Router.add` answered for the route, or a negative `ROUTER_*` code. */
  route: i32 = 0
  /** The HTTP version it came in on: 1, 2 or 3. */
  version: i32 = 1
  /**
   * How many parameter pairs `params` holds.
   * @internal Set by `HttpServer` in this module after routing; the param accessors check `k` against it.
   */
  paramCount: i32 = 0
  /** Where the method starts in `head`; the method is `head[methodStart .. methodEnd)`. */
  methodStart: i32 = 0
  /** Where the method ends in `head`, one past its last byte. */
  methodEnd: i32 = 0
  /** Where the request target (path and query) starts in `head`; the target is `head[targetStart .. targetEnd)`. */
  targetStart: i32 = 0
  /** Where the request target ends in `head`, one past its last byte. */
  targetEnd: i32 = 0
  /**
   * Where the path ends: the target's first `?`, or its end.
   * @internal Set by `HttpServer` in this module when it copies the head, and read by `pathIs` and `queryIndex`.
   */
  pathEnd: i32 = 0
  /**
   * How many fields `spans` describes.
   * @internal Set by `HttpServer` in this module when it copies the head, and read by `header`.
   */
  headerCount: i32 = 0
  /** How many bytes of `body` are the request's body, 0 for none; read the body as `body[0 .. bodyLength)`. */
  bodyLength: i32 = 0
  /** The connection's slot in its carrier. */
  slot: i32 = 0
  /**
   * The slot's generation when this request was read.
   * @internal Read by `HttpServer` in this module, which drops a reply to a slot that has since closed and been reused.
   */
  gen: i32 = 0
  /** Its index in the server's pool. */
  index: i32 = 0
  /**
   * Which carrier it came on, one of the module's private `HTTP_SERVER_H*` kinds.
   * @internal Read by `HttpServer` in this module to answer through that carrier.
   */
  kind: i32 = 0
  /**
   * Where the request is in its life, one of the module's private `HTTP_SERVER_*` states.
   * @internal Moved by `HttpServer` in this module from free through reading, queued, held and streaming, and back.
   */
  state: i32 = 0
  /**
   * Its entry in its connection's stream table; -1 on HTTP/1.1.
   * @internal Kept by `HttpServer` in this module, which frees the entry when the request goes back.
   */
  entry: i32 = -1
  /**
   * The response body bytes the declared length still allows, or -1 for an unknown length.
   * @internal Counted by `HttpServer` in this module on HTTP/2 and 3, whose carriers do not count them.
   */
  left: i32 = -1
  /**
   * Where the unsent bytes in `pending` start.
   * @internal Advanced by `HttpServer` in this module as the carrier takes pending bytes.
   */
  pendingStart: i32 = 0
  /**
   * Where the unsent bytes in `pending` end.
   * @internal Advanced by `HttpServer` in this module as `write` keeps what the carrier had no room for.
   */
  pendingEnd: i32 = 0
  /** The span `queryIndex` found, raw. */
  queryValueStart: i32 = 0
  /** Where the raw value `queryIndex` found ends in `head`, one past its last byte; it starts at `queryValueStart`. */
  queryValueEnd: i32 = 0
  /** Whether it came over TLS or QUIC: true on HTTP/2 over TLS and on HTTP/3. */
  secure: boolean = false
  /**
   * Whether the peer reset the stream or stopped reading it (HTTP/2 and 3).
   * @internal Set by `HttpServer` in this module; such a request is answered `HANDLER_DROPPED`.
   */
  hung: boolean = false
  /**
   * Whether the response head ended the stream (HEAD, 204, 304, an empty body), so body bytes are dropped.
   * @internal Set and read by `HttpServer` in this module on HTTP/2 and 3.
   */
  quiet: boolean = false
  /**
   * Whether the response's stream is ended on our side.
   * @internal Set and read by `HttpServer` in this module on HTTP/2 and 3.
   */
  ended: boolean = false

  /**
   * An empty request for the server's pool; its buffers are made on its first use.
   * @param index its place in the server's pool, which the free list and the queue name it by
   */
  constructor(index: i32) {
    this.index = index
    this.head = []
    this.spans = []
    this.params = []
    this.body = []
    this.pending = []
  }

  /**
   * Whether the method is exactly `method` (methods are case-sensitive, RFC 9110 §9.1).
   * @param method the method name to compare with, such as `"GET"`
   * @returns true when the request's method is byte for byte `method`
   */
  methodIs(method: string): boolean {
    return httpServerSpanIs(this.head, this.methodStart, this.methodEnd, method)
  }

  /**
   * Whether the path, the target up to its `?`, is exactly `path`.
   * @param path the raw path to compare with, still percent-encoded as it came on the wire
   * @returns true when the target's path, without its query, is byte for byte `path`
   */
  pathIs(path: string): boolean {
    return httpServerSpanIs(this.head, this.targetStart, this.pathEnd, path)
  }

  /**
   * Where parameter `k` starts in `head`. Panics on a parameter the route does not have.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the byte offset in `head` of the parameter's first raw byte
   */
  paramStart(k: i32): i32 {
    this.checkParam(k)
    return this.params[2 * k]
  }

  /**
   * Where parameter `k` ends in `head`.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the byte offset in `head` just past the parameter's last raw byte
   */
  paramEnd(k: i32): i32 {
    this.checkParam(k)
    return this.params[2 * k + 1]
  }

  /**
   * Whether parameter `k`, raw, is exactly `text`.
   * @param k the parameter's position in the route pattern, from 0
   * @param text the value to compare with, as it would appear still percent-encoded
   * @returns true when the raw parameter bytes are exactly `text`
   */
  paramIs(k: i32, text: string): boolean {
    this.checkParam(k)
    return httpServerSpanIs(this.head, this.params[2 * k], this.params[2 * k + 1], text)
  }

  /**
   * Parameter `k` percent-decoded into `out` from 0 (`routerDecode`): its
   * length, `ROUTER_BAD_ESCAPE` for a malformed escape, or `ROUTER_NO_ROOM`
   * when `out` is too short. Nothing is written on a code.
   * @param k the parameter's position in the route pattern, from 0
   * @param out where the decoded bytes go, from index 0; the caller's buffer
   * @returns how many decoded bytes were written, or a negative `ROUTER_*` code
   */
  param(k: i32, out: u8[]): i32 {
    this.checkParam(k)
    return routerDecode(this.head, this.params[2 * k], this.params[2 * k + 1], out)
  }

  /**
   * Parameter `k` read as a decimal number that is not negative and fits an `i32`, or -1.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the number the parameter's digits spell, or -1 when it is empty, holds a non-digit or overflows
   */
  paramDecimal(k: i32): i32 {
    this.checkParam(k)
    return httpServerDecimal(this.head, this.params[2 * k], this.params[2 * k + 1])
  }

  private checkParam(k: i32): void {
    if (k < 0 || k >= this.paramCount) {
      panic(`HttpServerRequest.param: the route has ${this.paramCount} parameter(s), not one at ${k}`)
    }
  }

  /**
   * The first query parameter named `name`, its value decoded into `out` from
   * 0 — `+` as a space and `%XX` as its byte, the form encoding
   * (application/x-www-form-urlencoded) — and its length; a name is compared
   * decoded too. `HANDLER_ABSENT` when no parameter has the name,
   * `ROUTER_BAD_ESCAPE` for a malformed escape in its value, `ROUTER_NO_ROOM`
   * when `out` is too short. A name with no `=` has an empty value.
   * @param name the parameter name to look for, compared with each name after decoding
   * @param out where the decoded value goes, from index 0; the caller's buffer
   * @returns how many decoded bytes were written, or `HANDLER_ABSENT` or a negative `ROUTER_*` code
   */
  query(name: string, out: u8[]): i32 {
    const at: i32 = this.queryIndex(name)
    if (at < 0) {
      return HANDLER_ABSENT
    }
    return httpServerFormDecode(this.head, this.queryValueStart, this.queryValueEnd, out)
  }

  /**
   * Whether the query holds a parameter named `name`.
   * @param name the parameter name to look for, compared with each name after decoding
   * @returns true when some pair in the query has that name, even with an empty value
   */
  hasQuery(name: string): boolean {
    return this.queryIndex(name) >= 0
  }

  /**
   * Finds the first parameter named `name`: where its pair starts, or -1; its raw value goes to `queryValue...`.
   * @param name the parameter name to look for, compared with each name after decoding
   * @returns the byte offset in `head` where the matching `name=value` pair starts, or -1 when none matches
   */
  queryIndex(name: string): i32 {
    let at: i32 = this.pathEnd + 1
    const end: i32 = this.targetEnd
    while (at < end) {
      let pairEnd: i32 = at
      while (pairEnd < end && toI32(this.head[pairEnd]) !== 38) {
        pairEnd += 1
      }
      let keyEnd: i32 = at
      while (keyEnd < pairEnd && toI32(this.head[keyEnd]) !== 61) {
        keyEnd += 1
      }
      if (httpServerFormIs(this.head, at, keyEnd, name)) {
        this.queryValueStart = keyEnd < pairEnd ? keyEnd + 1 : pairEnd
        this.queryValueEnd = pairEnd
        return at
      }
      at = pairEnd + 1
    }
    return -1
  }

  /**
   * The index of the first field named `name`, which is lowercase, or `HANDLER_ABSENT`.
   * @param name the field name in lowercase, since the parser lowercased every name it kept
   * @returns the field's index for `valueStart` and `valueEnd`, or `HANDLER_ABSENT` when no field has the name
   */
  header(name: string): i32 {
    for (let i: i32 = 0; i < this.headerCount; i++) {
      if (httpServerSpanIs(this.head, this.spans[4 * i], this.spans[4 * i + 1], name)) {
        return i
      }
    }
    return HANDLER_ABSENT
  }

  /**
   * Where field `i`'s value starts in `head`.
   * @param i a field index, as `header` answered it
   * @returns the byte offset in `head` of the value's first byte
   */
  valueStart(i: i32): i32 {
    return this.spans[4 * i + 2]
  }

  /**
   * Where field `i`'s value ends in `head`.
   * @param i a field index, as `header` answered it
   * @returns the byte offset in `head` just past the value's last byte
   */
  valueEnd(i: i32): i32 {
    return this.spans[4 * i + 3]
  }

  /**
   * Whether the first field named `name` (lowercase) has exactly the value `value`.
   * @param name the field name in lowercase
   * @param value the value to compare with, byte for byte and case-sensitive
   * @returns true when the field is present and its first occurrence has exactly that value
   */
  headerIs(name: string, value: string): boolean {
    const i: i32 = this.header(name)
    return i >= 0 && httpServerSpanIs(this.head, this.spans[4 * i + 2], this.spans[4 * i + 3], value)
  }
}
/** Appends `bytes[start .. end)` to an `Allow` value, after a `, ` if it is not the first. */
const httpServerAllowAppend = (value: u8[], bytes: u8[], start: i32, end: i32): void => {
  if (value.length > 0) {
    value.push(toU8(44))
    value.push(toU8(32))
  }
  for (let k: i32 = start; k < end; k++) {
    if (k >= 0 && k < toI32(bytes.length)) {
      value.push(bytes[k])
    }
  }
}

/**
 * The size a `pending` buffer of `have` bytes grows to for `need`:
 * `min(2^30, max(need, 2 × have))`, in `i64` so the doubling cannot wrap.
 * The caller has refused a `need` past 2^30.
 */
const httpServerPendingSize = (have: i32, need: i64): i32 => {
  const doubled: i64 = toI64(have) * toI64(2)
  const size: i64 = need > doubled ? need : doubled
  return size > toI64(HTTP_SERVER_MAX_BODY) ? HTTP_SERVER_MAX_BODY : toI32(size)
}

/** Whether `bytes[start .. end)` is exactly `text`. */
const httpServerSpanIs = (bytes: u8[], start: i32, end: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (end - start !== n || start < 0 || end > toI32(bytes.length)) {
    return false
  }
  for (let k: i32 = 0; k < n; k++) {
    if (toI32(bytes[start + k]) !== toI32(text.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** `bytes[start .. end)` as a decimal number that is not negative and fits an `i32`, or -1. */
const httpServerDecimal = (bytes: u8[], start: i32, end: i32): i32 => {
  if (start < 0 || end <= start || end - start > 10 || end > toI32(bytes.length)) {
    return -1
  }
  let n: i64 = 0
  for (let k: i32 = start; k < end && k < toI32(bytes.length); k++) {
    const digit: i32 = toI32(bytes[k]) - 48
    if (digit < 0 || digit > 9) {
      return -1
    }
    n = n * toI64(10) + toI64(digit)
  }
  return n > toI64(2147483647) ? -1 : toI32(n)
}

/**
 * The byte the form encoding spells at `bytes[at ..)`, before `end`, and how
 * many bytes it took, packed as `byte | taken << 8`; -1 for a malformed escape.
 */
const httpServerFormByte = (bytes: u8[], at: i32, end: i32): i32 => {
  const c: i32 = toI32(bytes[at])
  if (c === 43) {
    return 32 | HTTP_SERVER_TOOK_ONE
  }
  if (c !== 37) {
    return c | HTTP_SERVER_TOOK_ONE
  }
  if (at + 2 >= end) {
    return -1
  }
  const hi: i32 = http1HexValue(toI32(bytes[at + 1]))
  const lo: i32 = http1HexValue(toI32(bytes[at + 2]))
  if (hi < 0 || lo < 0) {
    return -1
  }
  return (hi * 16 + lo) | HTTP_SERVER_TOOK_THREE
}

/** Whether `bytes[start .. end)`, form-decoded, is exactly `name`; a malformed escape matches nothing. */
const httpServerFormIs = (bytes: u8[], start: i32, end: i32, name: string): boolean => {
  const n: i32 = toI32(name.length)
  let at: i32 = start
  let k: i32 = 0
  while (at < end) {
    const packed: i32 = httpServerFormByte(bytes, at, end)
    if (packed < 0 || k >= n || (packed & 255) !== toI32(name.charCodeAt(k))) {
      return false
    }
    at += packed >> 8
    k += 1
  }
  return k === n
}

/**
 * `bytes[start .. end)` form-decoded into `out` from 0: its length,
 * `ROUTER_BAD_ESCAPE`, or `ROUTER_NO_ROOM`. `%00` decodes like any byte, as a
 * route parameter's does.
 */
const httpServerFormDecode = (bytes: u8[], start: i32, end: i32, out: u8[]): i32 => {
  const length: i32 = percentDecode(
    bytes,
    start,
    end - start,
    out,
    HTTP_SERVER_ZERO,
    URL_DECODE_FORM | URL_DECODE_ALLOW_NUL
  )
  if (length === URL_DECODE_ERR_SPACE) {
    return ROUTER_NO_ROOM
  }
  return length < 0 ? ROUTER_BAD_ESCAPE : length
}

/** Panics unless `limits.<name>`, `value`, is within `low` to `high`. */
const httpServerLimit = (name: string, value: i32, low: i32, high: i32): void => {
  if (value < low || value > high) {
    panic(`HttpServer: limits.${name} ${value} is outside ${low} to ${high}`)
  }
}

/**
 * One handler for HTTP/1.1, HTTP/2 over TLS and HTTP/3: configure up to one
 * listener of each kind, then loop on `waitSigned` (or `wait`), `ready` and
 * `take`, answering each request with `send`, `json` and `sendJson`,
 * `problem`, `refuse`, or `start`, `write` and `end`.
 */
export class HttpServer {
  private router: Router
  /** Every request of the pool, made up front, and the indices of the free ones. */
  private requests: HttpServerRequest[]
  private free: i32[]
  /** Whole requests waiting for `take`, a ring of `queue.length` with `queueCount` from `queueStart`. */
  private queue: i32[]
  /** `pollWait`'s output. */
  private readyFds: i32[]
  /** Per watched id: whether its descriptor was ready in the last turn. */
  private watchedFired: boolean[]
  /** `json` and `problem` write here. */
  scratch: u8[]
  /**
   * The JSON writer over `scratch`.
   * @internal Read only by this class; programs get it from `json`.
   */
  writer: JsonWriter
  /** `refuse`'s scratch for `Router.match`. */
  private probe: i32[]
  /** One field for `send`; two for a 405. */
  private typeName: u8[][]
  private typeValue: u8[][]
  private allowNames: u8[][]
  private allowValues: u8[][]
  /** Each `Allow` value made, by the bit mask of the methods it lists: made once a mask and kept. */
  private allowMasks: i64[]
  private allowBytes: u8[][]
  private jsonType: u8[]
  private problemType: u8[]
  private noFields: u8[][]
  /** The response field lists `outFields` builds, by length, made once each and reused. */
  private outNamesBy: u8[][][]
  private outValuesBy: u8[][][]
  /** A content-length value's digits, one buffer per digit count. */
  private digitBufs: u8[][]
  private altSvcName: u8[]
  private contentLengthName: u8[]
  /** The Alt-Svc value, set by `listenHttp3`; null without an HTTP/3 listener. */
  private altSvc: u8[] | null = null
  /** `alt-svc` alone, and its value once there is one: the fields of an HTTP/2 over TLS answer the server gives itself. */
  private altNames: u8[][]
  private altValues: u8[][]
  private bodyTimeout: i64 = 0
  private idleTimeout: i64 = 0
  /** When the current turn's sockets were ready (`monotonicNanos`): a head read in it is stamped with this. */
  private turnAt: i64 = 0
  /** When `wait` next looks for timeouts. */
  private sweepAt: i64 = 0

  // HTTP/1.1: the carrier, its listener, and per slot its generation, its request (-1 for none) and whether it is open.
  private h1: Http1Server | null = null
  /** Per listener (`-100 - token`): when its rest for want of descriptors ends, 0 while it is not resting. */
  private restUntil: i64[]
  private h1Gen: i32[]
  private h1Current: i32[]
  private h1Open: boolean[]
  /** Slots that stopped reading for want of a free request, `starved`, and whether each is in it. */
  private starved: i32[]
  private h1Starved: boolean[]
  /**
   * Per slot: 0 while no `drive` of it runs, 1 while one does, 2 once a call
   * inside it (an answer screened while it reads) asked for another pass.
   * The nested call only marks it, so the depth stays one however many
   * screened requests one write pipelines.
   */
  private h1Driving: i32[]

  /** The response fields `start` hands the carrier, set for each response. */
  private outNames: u8[][]
  private outValues: u8[][]
  /** `host`, the field an HTTP/2 or HTTP/3 `:authority` becomes. */
  private hostName: u8[]

  // HTTP/2: the two carriers, and per slot of either a stream table of
  // `perConnection2` entries. TLS slot `s` is `h2TlsBase + s`, h2c slot `s`
  // is `h2cBase + s`; `h2Clear` says which carrier a slot is on.
  private h2: Http2TlsServer | null = null
  private h2c: Http2CleartextServer | null = null
  private h2TlsBase: i32 = 0
  private h2cBase: i32 = 0
  private h2Clear: boolean[]
  private h2Gen: i32[]
  private h2Open: boolean[]
  /** When a connection last had no stream open, 0 while it has one. */
  private h2IdleSince: i64[]
  /** Per entry: its stream, and its request, -1 for a free entry. */
  private h2Streams: i32[]
  private h2Reqs: i32[]
  private h2Count: i32[]
  private rnd: u8[]
  private keyBuf: u8[]

  // HTTP/3: the carrier, and per slot a stream table of `perConnection3` entries.
  private h3: Http3Server | null = null
  /** What the drain reads datagrams into, made when it begins: a datagram, its sender and its GRO segment size. */
  private h3Rx: u8[]
  private h3From: u8[]
  private h3Meta: i32[]
  private h3Gen: i32[]
  private h3Streams: i64[]
  private h3Reqs: i32[]
  private h3Count: i32[]
  private queueStart: i32 = 0
  private queueCount: i32 = 0
  private maxBody: i32 = 0
  private maxHead: i32 = 0
  private maxFields: i32 = 0
  private maxResponseFields: i32 = 0
  private altSvcMaxAge: i32 = 0
  private altSvcPort: i32 = 0
  /** The readiness loop's descriptor, from `pollCreate`. */
  private loop: i32 = 0
  private h1Fd: i32 = -1
  private h1OutputSize: i32 = 0
  /** Where `feedStarved` takes the next slot of `starved`; the slots before it are spent. */
  private starvedHead: i32 = 0
  /** Where `fromFields` writes next in a request's head. */
  private headAt: i32 = 0
  private h2Fd: i32 = -1
  private perConnection2: i32 = 1
  /** The cleartext HTTP/2 listener, -1 until `listenH2c`. */
  private h2cFd: i32 = -1
  private prefaceTimeout: i32 = 0
  private perConnection3: i32 = 1
  /** The HTTP/3 listener's UDP socket, or -1. */
  private h3Fd: i32 = -1
  /** Set by `drain`: accept nothing more and close each connection once it is idle. */
  private draining: boolean = false
  /** Whether `json` gave out the writer for a value `sendJson` has not yet sent. */
  private jsonBegun: boolean = false
  private h3Readable: boolean = false

  /**
   * A server routing through `router`, held to `limits`. It has no listener
   * yet: add them with `listenHttp1`, `listenHttp2Tls` and `listenHttp3`.
   * Panics on a limit outside its range.
   * @param limits the caps and timeouts, read once here
   * @param router the routes, which the server keeps and consults at each request head
   */
  constructor(limits: HttpServerLimits, router: Router) {
    httpServerLimit("requests", limits.requests, 1, HTTP_SERVER_MAX_REQUESTS)
    httpServerLimit("maxBody", limits.maxBody, 0, HTTP_SERVER_MAX_BODY)
    httpServerLimit("maxHead", limits.maxHead, 256, HTTP_SERVER_MAX_HEAD)
    httpServerLimit("maxFields", limits.maxFields, 1, 1024)
    httpServerLimit("maxResponseFields", limits.maxResponseFields, 2, 256)
    httpServerLimit("bodyTimeout", limits.bodyTimeout, 1, 2147483647)
    httpServerLimit("idleTimeout", limits.idleTimeout, 1, 2147483647)
    httpServerLimit("prefaceTimeout", limits.prefaceTimeout, 1, 2147483647)
    httpServerLimit("altSvcMaxAge", limits.altSvcMaxAge, 0, 2147483647)
    httpServerLimit("altSvcPort", limits.altSvcPort, 0, 65535)
    httpServerLimit("maxEvents", limits.maxEvents, 1, 65536)
    httpServerLimit("jsonBytes", limits.jsonBytes, 256, HTTP_SERVER_MAX_BODY)
    this.router = router
    this.maxBody = limits.maxBody
    this.maxHead = limits.maxHead
    this.maxFields = limits.maxFields
    this.maxResponseFields = limits.maxResponseFields
    this.altSvcMaxAge = limits.altSvcMaxAge
    this.altSvcPort = limits.altSvcPort
    this.bodyTimeout = toI64(limits.bodyTimeout) * HTTP_SERVER_NANOS_PER_MS
    this.idleTimeout = toI64(limits.idleTimeout) * HTTP_SERVER_NANOS_PER_MS
    this.prefaceTimeout = limits.prefaceTimeout
    this.requests = []
    this.free = []
    for (let k: i32 = 0; k < limits.requests; k++) {
      this.requests.push(new HttpServerRequest(k))
      this.free.push(limits.requests - 1 - k)
    }
    this.queue = new Array<i32>(limits.requests)
    this.readyFds = new Array<i32>(2 * limits.maxEvents)
    this.watchedFired = new Array<boolean>(HANDLER_MAX_WATCHED)
    this.scratch = new Array<u8>(limits.jsonBytes)
    this.writer = new JsonWriter(this.scratch, HTTP_SERVER_ZERO)
    this.probe = new Array<i32>(2 * router.maxParams + 2)
    this.jsonType = httpFieldBytes("application/json")
    this.problemType = httpFieldBytes("application/problem+json")
    const contentType: u8[] = httpFieldBytes("content-type")
    this.typeName = [contentType]
    this.typeValue = [this.jsonType]
    this.allowNames = [contentType, httpFieldBytes("allow")]
    // The `Allow` value, `allowValues[1]`, is set for each 405.
    this.allowValues = [this.problemType, this.problemType]
    this.allowMasks = []
    this.allowBytes = []
    this.noFields = []
    this.h3Rx = []
    this.h3From = new Array<u8>(HTTP_SERVER_UDP_ADDRESS)
    this.h3Meta = [HTTP_SERVER_ZERO, HTTP_SERVER_ZERO]
    this.outNamesBy = []
    this.outValuesBy = []
    this.digitBufs = []
    for (let d: i32 = 0; d <= 10; d++) {
      this.digitBufs.push(new Array<u8>(d))
    }
    this.altSvcName = httpFieldBytes("alt-svc")
    this.altNames = [this.altSvcName]
    this.altValues = [this.altSvcName]
    if (this.altSvcMaxAge === 0) {
      this.altSvc = httpFieldBytes("clear")
      this.altValues[0] = httpFieldBytes("clear")
    }
    this.contentLengthName = httpFieldBytes("content-length")
    this.hostName = httpFieldBytes("host")
    this.outNames = []
    this.outValues = []
    this.h1Gen = []
    this.h1Current = []
    this.h1Open = []
    this.starved = []
    this.h1Starved = []
    this.h1Driving = []
    this.restUntil = new Array<i64>(4)
    this.h2Clear = []
    this.h2Gen = []
    this.h2Open = []
    this.h2IdleSince = []
    this.h2Streams = []
    this.h2Reqs = []
    this.h2Count = []
    this.rnd = new Array<u8>(32)
    this.keyBuf = new Array<u8>(32)
    this.h3Gen = []
    this.h3Streams = []
    this.h3Reqs = []
    this.h3Count = []
    this.loop = pollCreate()
    if (this.loop < 0) {
      panic(`HttpServer: pollCreate failed: ${this.loop}`)
    }
  }

  // ---- Listeners ------------------------------------------------------------------

  /**
   * Serves HTTP/1.1 on `fd`, a listening TCP socket the program made, with up
   * to `slots` connections. Panics on a second HTTP/1.1 listener, or when
   * `config` would let in a head past `limits.maxHead` (its `maxTarget`, its
   * `maxHeaderBytes` and 44 bytes of request line) or more fields than
   * `limits.maxFields`. `config.maxBody` is set to `limits.maxBody`.
   * @param fd the listening socket's descriptor, still the program's to close
   * @param config the carrier's caps and timeouts, kept by the carrier
   * @param slots the most connections held at once
   */
  listenHttp1(fd: i32, config: Http1Config, slots: i32): void {
    if (this.h1Fd >= 0) {
      panic("HttpServer.listenHttp1: an HTTP/1.1 listener is already configured")
    }
    const head: i64 = toI64(config.maxTarget) + toI64(config.maxHeaderBytes) + HTTP_SERVER_H1_LINE_OVERHEAD
    if (head > toI64(this.maxHead)) {
      panic(
        `HttpServer.listenHttp1: maxTarget ${config.maxTarget} + maxHeaderBytes ${config.maxHeaderBytes} + 44 is more than limits.maxHead ${this.maxHead}`
      )
    }
    if (config.maxHeaders > this.maxFields) {
      panic(
        `HttpServer.listenHttp1: maxHeaders ${config.maxHeaders} is more than limits.maxFields ${this.maxFields}`
      )
    }
    if (slots < 1) {
      panic(`HttpServer.listenHttp1: slots ${slots} is below 1`)
    }
    config.maxBody = this.maxBody
    this.h1 = new Http1Server(config, fd, slots)
    this.h1Fd = fd
    this.h1OutputSize = config.outputSize
    this.h1Gen = new Array<i32>(slots)
    this.h1Current = new Array<i32>(slots)
    this.h1Open = new Array<boolean>(slots)
    this.h1Starved = new Array<boolean>(slots)
    this.h1Driving = new Array<i32>(slots)
    for (let s: i32 = 0; s < slots; s++) {
      this.h1Current[s] = -1
    }
    pollAdd(this.loop, fd, H1_WANT_READ, HTTP_SERVER_H1_LISTENER)
  }

  /**
   * Serves cleartext HTTP/2 (h2c, prior knowledge: no Upgrade from
   * HTTP/1.1) on `fd`, a listening TCP socket the program made, with up to
   * `slots` connections. Meant for a server behind a TLS-terminating proxy
   * or on a trusted network: nothing on it is encrypted. A connection that
   * has not sent its 24-byte preface within `limits.prefaceTimeout` is
   * closed, and one with no open stream after it within `limits.idleTimeout`.
   * Its responses carry no Alt-Svc, and its requests say `secure` false.
   * Each connection holds at most `config.maxStreams` requests and a quarter
   * of `limits.requests`, as on `listenHttp2Tls`. Panics on a second h2c
   * listener, a `maxHeaderListSize` past `limits.maxHead`, or
   * `enableConnectProtocol`. `wait` serves it: it reads no key.
   * @param fd the listening socket's descriptor, still the program's to close
   * @param config the carrier's caps
   * @param slots the most connections held at once
   */
  listenH2c(fd: i32, config: Http2Config, slots: i32): void {
    if (this.h2cFd >= 0) {
      panic("HttpServer.listenH2c: an h2c listener is already configured")
    }
    this.checkHttp2("listenH2c", config, slots)
    this.h2cBase = this.h2Grow(slots, this.perOf(config))
    for (let v: i32 = this.h2cBase; v < this.h2cBase + slots; v++) {
      this.h2Clear[v] = true
    }
    this.h2c = new Http2CleartextServer(config, fd, slots, this.prefaceTimeout)
    this.h2cFd = fd
    pollAdd(this.loop, fd, H1_WANT_READ, HTTP_SERVER_H2C_LISTENER)
  }

  /** The checks every HTTP/2 listener's configuration passes. */
  private checkHttp2(name: string, config: Http2Config, slots: i32): void {
    if (config.maxHeaderListSize > this.maxHead) {
      panic(
        `HttpServer.${name}: maxHeaderListSize ${config.maxHeaderListSize} is more than limits.maxHead ${this.maxHead}`
      )
    }
    if (config.enableConnectProtocol) {
      panic(`HttpServer.${name}: enableConnectProtocol is not served; extended CONNECT is answered 501`)
    }
    if (slots < 1) {
      panic(`HttpServer.${name}: slots ${slots} is below 1`)
    }
  }

  /**
   * Serves HTTP/2 over TLS (ALPN `h2`) on `fd`, a listening TCP socket the
   * program made, with up to `slots` connections. Each connection holds at
   * most `config.maxStreams` requests and a quarter of `limits.requests`; a
   * stream past that is refused with REFUSED_STREAM. Panics on a second
   * listener of this kind, a `maxHeaderListSize` past `limits.maxHead`, or
   * `enableConnectProtocol`. Serve it with `waitSigned`.
   * @param fd the listening socket's descriptor, still the program's to close
   * @param tls the certificate chain and TLS settings
   * @param config the carrier's caps
   * @param slots the most connections held at once
   */
  listenHttp2Tls(fd: i32, tls: TlsServerConfig, config: Http2Config, slots: i32): void {
    if (this.h2Fd >= 0) {
      panic("HttpServer.listenHttp2Tls: an HTTP/2 over TLS listener is already configured")
    }
    this.checkHttp2("listenHttp2Tls", config, slots)
    this.h2TlsBase = this.h2Grow(slots, this.perOf(config))
    this.h2 = new Http2TlsServer(tls, config, fd, slots)
    this.h2Fd = fd
    pollAdd(this.loop, fd, H1_WANT_READ, HTTP_SERVER_H2_LISTENER)
  }

  /** The stream-table entries an HTTP/2 connection under `config` gets: its `maxStreams`, at most a quarter of the pool, at least 1. */
  private perOf(config: Http2Config): i32 {
    let per: i32 = toI32(this.requests.length) / 4
    if (config.maxStreams < per) {
      per = config.maxStreams
    }
    return per < 1 ? 1 : per
  }

  /**
   * Adds `slots` HTTP/2 slots after those there are, each table at least
   * `per` entries, and answers the first new slot. The tables share one
   * width, the widest asked for, so a wider listener moves every entry,
   * and every request's `entry`, to the new width.
   */
  private h2Grow(slots: i32, per: i32): i32 {
    const base: i32 = toI32(this.h2Open.length)
    const was: i32 = this.perConnection2
    const width: i32 = per > was ? per : was
    const streams: i32[] = new Array<i32>((base + slots) * width)
    const reqs: i32[] = new Array<i32>((base + slots) * width)
    for (let e: i32 = 0; e < toI32(reqs.length); e++) {
      reqs[e] = -1
    }
    for (let v: i32 = 0; v < base; v++) {
      for (let i: i32 = 0; i < was; i++) {
        streams[v * width + i] = this.h2Streams[v * was + i]
        reqs[v * width + i] = this.h2Reqs[v * was + i]
      }
    }
    if (width !== was) {
      for (let k: i32 = 0; k < toI32(this.requests.length); k++) {
        const r: HttpServerRequest = this.requests[k]
        if (r.kind === HTTP_SERVER_H2 && r.entry >= 0) {
          r.entry = (r.entry / was) * width + (r.entry % was)
        }
      }
    }
    this.h2Streams = streams
    this.h2Reqs = reqs
    this.perConnection2 = width
    for (let v: i32 = 0; v < slots; v++) {
      this.h2Gen.push(HTTP_SERVER_ZERO)
      this.h2Open.push(false)
      this.h2IdleSince.push(toI64(HTTP_SERVER_ZERO))
      this.h2Count.push(HTTP_SERVER_ZERO)
      this.h2Clear.push(false)
    }
    return base
  }

  /**
   * Serves HTTP/3 on `fd`, a bound UDP socket the program made, with up to
   * `slots` QUIC connections, and from then on names its port in an Alt-Svc
   * field on every HTTP/1.1 and HTTP/2 response. Each connection holds at most
   * `quic.maxStreamsBidi` requests and a quarter of `limits.requests`; a
   * stream past that is rejected with H3_REQUEST_REJECTED. Panics on a second
   * HTTP/3 listener, a `maxFieldSectionSize` past `limits.maxHead`, or
   * `webtransportSessions` above 0. Serve it with `waitSigned`.
   * @param fd the UDP socket's descriptor, still the program's to close
   * @param quic the QUIC and TLS settings
   * @param config the HTTP/3 caps
   * @param slots the most connections held at once
   * @param entropy random bytes for the listener's own secrets, as `Http3Server` takes them
   */
  listenHttp3(fd: i32, quic: QuicServerConfig, config: Http3Config, slots: i32, entropy: u8[]): void {
    if (this.h3 !== null) {
      panic("HttpServer.listenHttp3: an HTTP/3 listener is already configured")
    }
    if (config.maxFieldSectionSize > this.maxHead) {
      panic(
        `HttpServer.listenHttp3: maxFieldSectionSize ${config.maxFieldSectionSize} is more than limits.maxHead ${this.maxHead}`
      )
    }
    if (config.webtransportSessions > 0) {
      panic("HttpServer.listenHttp3: webtransportSessions is not served")
    }
    if (slots < 1) {
      panic(`HttpServer.listenHttp3: slots ${slots} is below 1`)
    }
    let per: i64 = toI64(toI32(this.requests.length) / 4)
    if (quic.maxStreamsBidi < per) {
      per = quic.maxStreamsBidi
    }
    this.perConnection3 = per < toI64(1) ? 1 : toI32(per)
    this.h3 = new Http3Server(quic, config, fd, slots, entropy)
    this.h3Fd = fd
    this.h3Gen = new Array<i32>(slots)
    this.h3Count = new Array<i32>(slots)
    this.h3Streams = new Array<i64>(slots * this.perConnection3)
    this.h3Reqs = new Array<i32>(slots * this.perConnection3)
    for (let k: i32 = 0; k < toI32(this.h3Reqs.length); k++) {
      this.h3Reqs[k] = -1
    }
    if (this.altSvcMaxAge > 0) {
      const port: i32 = this.altSvcPort > 0 ? this.altSvcPort : netLocalPort(fd)
      this.setAltSvc(httpFieldBytes(`h3=":${port}"; ma=${this.altSvcMaxAge}`))
    }
    pollAdd(this.loop, fd, H1_WANT_READ, HTTP_SERVER_H3_SOCKET)
  }

  /** Sets the `alt-svc` value every HTTP/1.1 and HTTP/2 over TLS answer carries. */
  private setAltSvc(value: u8[]): void {
    this.altSvc = value
    this.altValues[0] = value
  }

  // ---- The loop -------------------------------------------------------------------

  /**
   * Adds `fd` to the descriptors `wait` and `waitSigned` block on, as `id`:
   * `fired(id)` then says whether it was readable in the last turn. For a
   * program's own descriptors, such as `signalFd()` for a graceful stop.
   * Panics on an id outside 0 to `HANDLER_MAX_WATCHED - 1`.
   * @param fd the program's descriptor to watch for reading; it stays the program's to read and close
   * @param id the name `fired` asks about it by, from 0 to `HANDLER_MAX_WATCHED - 1`
   */
  watch(fd: i32, id: i32): void {
    if (id < 0 || id >= HANDLER_MAX_WATCHED) {
      panic(`HttpServer.watch: id ${id} is outside 0 to ${HANDLER_MAX_WATCHED - 1}`)
    }
    pollAdd(this.loop, fd, H1_WANT_READ, -2 - id)
  }

  /**
   * Whether watched descriptor `id` was ready in the last turn.
   * @param id the name the descriptor was given to `watch`
   * @returns true when it was readable in the last turn; false for an id outside the range
   */
  fired(id: i32): boolean {
    return id >= 0 && id < HANDLER_MAX_WATCHED && this.watchedFired[id]
  }

  /**
   * One turn of the loop for a server with no TLS or QUIC listener: as
   * `waitSigned`, with no key. It serves HTTP/1.1 and h2c (`listenH2c`).
   * Panics when an HTTP/2 over TLS or HTTP/3 listener is configured, since a
   * handshake there needs the key.
   * @param timeoutMs the longest to block, in milliseconds, or -1 to block until something is ready
   * @returns how many whole requests are queued for `take` after this turn
   */
  wait(timeoutMs: i32): i32 {
    if (this.h2Fd >= 0 || this.h3 !== null) {
      panic("HttpServer.wait: a TLS or QUIC listener needs the certificate's key; call waitSigned")
    }
    return this.turnWith(timeoutMs, null)
  }

  /**
   * One turn of the loop: waits up to `timeoutMs` (-1 for no limit) for a
   * socket to be ready, accepts, reads and writes what is, signs each TLS and
   * QUIC handshake with `key`, closes what is past its timeouts, and answers
   * how many whole requests are waiting for `take`.
   * @param timeoutMs the longest to block, in milliseconds, or -1 to block until something is ready
   * @param key the certificate's P-256 private key; borrowed for the call, still the caller's to wipe
   * @returns how many whole requests are queued for `take` after this turn
   */
  waitSigned(timeoutMs: i32, key: Secret<u8[]>): i32 {
    return this.turnWith(timeoutMs, key)
  }

  /** `waitSigned`'s turn, with no key under `wait`, which serves no listener that reads one. */
  private turnWith(timeoutMs: i32, key: Secret<u8[]> | null): i32 {
    for (let id: i32 = 0; id < HANDLER_MAX_WATCHED; id++) {
      this.watchedFired[id] = false
    }
    // A starved slot driven here may read a head, so it reads the clock of now.
    this.turnAt = monotonicNanos()
    this.feedStarved()
    let now: i64 = monotonicNanos()
    let timeout: i32 = this.queueCount > 0 ? 0 : timeoutMs
    timeout = this.restListener(this.h1Fd, HTTP_SERVER_H1_LISTENER, now, timeout)
    timeout = this.restListener(this.h2Fd, HTTP_SERVER_H2_LISTENER, now, timeout)
    timeout = this.restListener(this.h2cFd, HTTP_SERVER_H2C_LISTENER, now, timeout)
    const h3: Http3Server | null = this.h3
    if (h3 !== null) {
      h3.flush(now / HTTP_SERVER_NANOS_PER_MS)
      const due: i32 = h3.timeout(now / HTTP_SERVER_NANOS_PER_MS)
      if (due >= 0 && (timeout < 0 || due < timeout)) {
        timeout = due
      }
    }
    timeout = this.sweepCap(now, timeout)
    const n: i32 = pollWait(this.loop, this.readyFds, timeout)
    now = monotonicNanos()
    this.turnAt = now
    this.h3Readable = false
    for (let k: i32 = 0; k < n; k++) {
      const token: i32 = this.readyFds[2 * k]
      const events: i32 = this.readyFds[2 * k + 1]
      if (token === HTTP_SERVER_H1_LISTENER) {
        this.acceptHttp1()
      } else if (token === HTTP_SERVER_H2_LISTENER) {
        this.acceptHttp2()
      } else if (token === HTTP_SERVER_H2C_LISTENER) {
        this.acceptH2c()
      } else if (token === HTTP_SERVER_H3_SOCKET) {
        this.h3Readable = true
      } else if (token <= -2 && token > HTTP_SERVER_H1_LISTENER) {
        const id: i32 = -2 - token
        if (id < HANDLER_MAX_WATCHED) {
          this.watchedFired[id] = true
        }
      } else if (token >= HTTP_SERVER_H2_BASE) {
        this.h2Serve(token - HTTP_SERVER_H2_BASE, events, key)
      } else if (token >= 0) {
        this.h1Serve(token, events)
      }
    }
    if (h3 !== null && key !== null) {
      this.h3Turn(h3, now, key)
    }
    const h1: Http1Server | null = this.h1
    if (h1 !== null && h1.expire(now) > 0) {
      this.h1Sweep(h1)
    }
    this.feedStarved()
    if (now >= this.sweepAt) {
      this.sweepAt = now + HTTP_SERVER_SWEEP
      this.expireAll(now)
    }
    return this.queueCount
  }

  /**
   * `timeout` shortened to wake by the next sweep while any connection is
   * open, so that `bodyTimeout`, `idleTimeout`, `prefaceTimeout` and the
   * HTTP/1.1 carrier's own clocks are enforced on a quiet server under
   * `wait(-1)` too, at most one sweep late.
   */
  private sweepCap(now: i64, timeout: i32): i32 {
    if (this.connections() === 0) {
      return timeout
    }
    const left: i64 = this.sweepAt - now
    const cap: i32 = left <= 0 ? HTTP_SERVER_ZERO : toI32(left / HTTP_SERVER_NANOS_PER_MS) + 1
    return timeout < 0 || cap < timeout ? cap : timeout
  }

  /**
   * Puts a listener rested for want of descriptors back once its rest is
   * over, and answers `timeout` shortened to wake for that.
   */
  private restListener(fd: i32, token: i32, now: i64, timeout: i32): i32 {
    const until: i64 = this.restUntil[HTTP_SERVER_H1_LISTENER - token]
    if (until === 0 || fd < 0) {
      return timeout
    }
    if (now >= until) {
      this.restUntil[HTTP_SERVER_H1_LISTENER - token] = 0
      if (!this.draining) {
        pollAdd(this.loop, fd, H1_WANT_READ, token)
      }
      return timeout
    }
    if (this.draining) {
      return timeout
    }
    const rest: i32 = toI32((until - now) / HTTP_SERVER_NANOS_PER_MS) + 1
    return timeout < 0 || rest < timeout ? rest : timeout
  }

  /**
   * Begins a graceful stop: the server accepts no more connections, closes
   * each idle HTTP/1.1 connection now and each other one once its request is
   * answered, and sends GOAWAY on each HTTP/2 and HTTP/3 connection, which
   * then closes once its streams are done. A request already read is still
   * handed over and answered. The listeners are the program's to close.
   */
  drain(): void {
    if (this.draining) {
      return
    }
    this.draining = true
    this.unlisten(this.h1Fd, HTTP_SERVER_H1_LISTENER)
    this.unlisten(this.h2Fd, HTTP_SERVER_H2_LISTENER)
    this.unlisten(this.h2cFd, HTTP_SERVER_H2C_LISTENER)
    const h1: Http1Server | null = this.h1
    if (h1 !== null) {
      for (let s: i32 = 0; s < toI32(this.h1Open.length); s++) {
        if (this.h1Open[s] && h1.holds(s)) {
          const conn: Http1Connection = h1.connection(s)
          if (this.h1Current[s] === -1 && !conn.wantsWrite()) {
            this.h1Close(h1, s)
          } else {
            conn.closeAfter = true
          }
        }
      }
    }
    for (let v: i32 = 0; v < toI32(this.h2Open.length); v++) {
      if (this.h2Open[v] && this.h2Holds(v)) {
        if (this.h2Clear[v] && !this.h2cOf().prefaced(v - this.h2cBase)) {
          // No preface yet, so no connection to say GOAWAY on.
          this.h2Close(v)
        } else {
          this.h2Conn(v).goaway()
          this.h2Settle(v)
        }
      }
    }
    const h3: Http3Server | null = this.h3
    if (h3 !== null) {
      for (let s: i32 = 0; s < h3.size(); s++) {
        if (h3.holds(s)) {
          h3.connection(s).goaway()
          h3.touch(s)
        }
      }
    }
  }

  /** Takes listener `fd` out of the loop, unless it is not there: never configured, or resting. */
  private unlisten(fd: i32, token: i32): void {
    if (fd >= 0 && this.restUntil[HTTP_SERVER_H1_LISTENER - token] === 0) {
      pollRemove(this.loop, fd)
    }
  }

  /**
   * How many connections are open, of every version.
   * @returns the connections the carriers hold, which falls to 0 after `drain` as they finish
   */
  connections(): i32 {
    let n: i32 = 0
    const h1: Http1Server | null = this.h1
    if (h1 !== null) {
      n += h1.busy()
    }
    const h2: Http2TlsServer | null = this.h2
    if (h2 !== null) {
      n += h2.busy()
    }
    const h2c: Http2CleartextServer | null = this.h2c
    if (h2c !== null) {
      n += h2c.busy()
    }
    const h3: Http3Server | null = this.h3
    if (h3 !== null) {
      n += h3.busy()
    }
    return n
  }

  // ---- HTTP/1.1 -------------------------------------------------------------------

  /** Takes every waiting HTTP/1.1 connection. */
  private acceptHttp1(): void {
    const h1: Http1Server | null = this.h1
    if (h1 === null || this.draining) {
      return
    }
    let slot: i32 = h1.accept()
    while (slot >= 0 || slot === H1_POOL_FULL || slot === HTTP_SERVER_ACCEPT_ABORTED) {
      if (slot >= 0) {
        this.h1Open[slot] = true
        this.h1Current[slot] = -1
        pollAdd(this.loop, h1.fd(slot), H1_WANT_READ, slot)
      }
      slot = h1.accept()
    }
    if (slot !== HTTP_SERVER_ACCEPT_NONE) {
      // Out of descriptors or memory: the connection stays in the backlog
      // and the listener stays readable, so rest it rather than spin.
      this.rest(this.h1Fd, HTTP_SERVER_H1_LISTENER)
    }
  }

  /** A ready HTTP/1.1 socket: read or written, then driven. */
  private h1Serve(slot: i32, events: i32): void {
    const h1: Http1Server | null = this.h1
    if (h1 === null || !h1.holds(slot)) {
      return
    }
    if ((events & HTTP_SERVER_READ_BITS) !== 0) {
      h1.readable(slot)
    } else {
      h1.writable(slot)
    }
    this.drive(h1, slot)
  }

  /**
   * Turns `slot`'s events into requests until it needs more input, then
   * settles it. A head with no free request left waits: the slot stops
   * reading and goes on `starved` until a request is handed back.
   */
  private drive(h1: Http1Server, slot: i32): void {
    if (this.h1Driving[slot] !== 0) {
      this.h1Driving[slot] = 2
      return
    }
    this.h1Driving[slot] = 1
    this.drivePass(h1, slot)
    while (this.h1Driving[slot] === 2 && this.h1Open[slot]) {
      this.h1Driving[slot] = 1
      this.drivePass(h1, slot)
    }
    this.h1Driving[slot] = 0
  }

  /** One pass of `drive`: the slot's events until it needs more input, then `settle`. */
  private drivePass(h1: Http1Server, slot: i32): void {
    const conn: Http1Connection = h1.connection(slot)
    let event: i32 = H1_NEED_MORE
    if (!this.starve(slot) && !this.unended(slot)) {
      event = h1.next(slot)
      while (event !== H1_NEED_MORE && event !== H1_ERROR) {
        if (event === H1_REQUEST) {
          this.begin(slot, conn)
        } else if (event === H1_BODY) {
          this.gather(slot, conn)
        } else if (event === H1_END) {
          this.whole(slot, conn)
        } else if (event === H1_WRITE) {
          this.resume(slot, conn)
        }
        if (this.starve(slot) || this.unended(slot)) {
          break
        }
        event = h1.next(slot)
      }
    }
    if (event === H1_ERROR) {
      // The carrier has written its refusal and ends the connection; a
      // request it was reading is nobody's.
      this.releaseReading(slot)
    }
    this.settle(h1, slot, conn)
  }

  /**
   * Whether `slot`'s response is under way with every byte handed over but
   * not yet ended. The carrier finishes a `Content-Length` response once its
   * last byte is written and would read the next request on the next `next`,
   * so the slot is not asked until the program's `end`: until then the
   * response is the program's, and a draining connection stays open for it.
   */
  private unended(slot: i32): boolean {
    const at: i32 = this.h1Current[slot]
    if (at < 0) {
      return false
    }
    const r: HttpServerRequest = this.requests[at]
    return r.state === HTTP_SERVER_STREAMING && r.pendingEnd === r.pendingStart
  }

  /** Whether `slot` must wait for a free request before it reads a head: it then joins `starved`. */
  private starve(slot: i32): boolean {
    if (this.h1Current[slot] !== -1 || toI32(this.free.length) > 0) {
      return false
    }
    if (!this.h1Starved[slot]) {
      this.h1Starved[slot] = true
      this.starved.push(slot)
    }
    return true
  }

  /** Drives the starved slots again while requests are free. */
  private feedStarved(): void {
    const h1: Http1Server | null = this.h1
    if (h1 === null) {
      return
    }
    while (this.starvedHead < toI32(this.starved.length) && toI32(this.free.length) > 0) {
      const slot: i32 = this.starved[this.starvedHead]
      this.starvedHead += 1
      this.h1Starved[slot] = false
      if (this.h1Open[slot] && h1.holds(slot)) {
        this.drive(h1, slot)
      }
    }
    // Drop the spent slots once they are half the list, so each is moved O(1) times.
    const spent: i32 = this.starvedHead
    const length: i32 = toI32(this.starved.length)
    if (spent > 0 && spent * 2 >= length) {
      for (let k: i32 = spent; k < length; k++) {
        this.starved[k - spent] = this.starved[k]
      }
      for (let k: i32 = 0; k < spent; k++) {
        this.starved.pop()
      }
      this.starvedHead = 0
    }
  }

  /** Sends what `slot` holds and re-arms it, or closes it once it is over; enqueues a parked request once there is room. */
  private settle(h1: Http1Server, slot: i32, conn: Http1Connection): void {
    let wants: i32 = h1.flush(slot)
    if ((wants & H1_DONE) !== 0) {
      this.h1Close(h1, slot)
      return
    }
    if (this.draining && this.h1Current[slot] === -1 && !conn.wantsWrite()) {
      this.h1Close(h1, slot)
      return
    }
    if (this.h1Starved[slot]) {
      wants = wants & ~H1_WANT_READ
    }
    if (h1.rearm(slot, wants)) {
      pollModify(this.loop, h1.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
    }
    const at: i32 = this.h1Current[slot]
    if (at >= 0 && this.requests[at].state === HTTP_SERVER_PARKED && this.roomy(conn)) {
      this.h1Ready(this.requests[at])
    }
  }

  /** Whether `conn`'s output holds at most half its size unsent, so a response head fits behind it. */
  private roomy(conn: Http1Connection): boolean {
    return (conn.outputEnd - conn.outputStart) * 2 <= this.h1OutputSize
  }

  /** A head: a free request, the head copied into it, and its route. */
  private begin(slot: i32, conn: Http1Connection): void {
    if (this.draining) {
      // A head read during the drain is the connection's last.
      conn.closeAfter = true
    }
    const r: HttpServerRequest = this.requests[this.obtain()]
    const p = conn.parser
    copyBytes(r.head, HTTP_SERVER_ZERO, p.head, HTTP_SERVER_ZERO, p.headLength)
    const spanCount: i32 = 4 * p.headerCount
    for (let k: i32 = 0; k < spanCount; k++) {
      r.spans[k] = p.spans[k]
    }
    r.headerCount = p.headerCount
    r.methodStart = p.methodStart
    r.methodEnd = p.methodEnd
    r.targetStart = p.targetStart
    r.targetEnd = p.targetEnd
    r.kind = HTTP_SERVER_H1
    r.version = 1
    r.secure = false
    r.slot = slot
    r.gen = this.h1Gen[slot]
    if (r.methodIs("CONNECT")) {
      // Its 501 ends the connection: the client may already be sending what
      // it meant for a tunnel.
      conn.closeAfter = true
    }
    this.admit(r)
    this.h1Current[slot] = r.index
  }

  /** Body bytes: appended to the request's body, which the carrier's cap bounds. */
  private gather(slot: i32, conn: Http1Connection): void {
    const at: i32 = this.h1Current[slot]
    if (at >= 0) {
      this.append(this.requests[at], conn.data, conn.dataStart, conn.dataLength)
    }
  }

  /** The request is whole: queued for `take`, or parked while the response before it is still mostly unsent. */
  private whole(slot: i32, conn: Http1Connection): void {
    const at: i32 = this.h1Current[slot]
    if (at < 0) {
      return
    }
    const r: HttpServerRequest = this.requests[at]
    if (this.roomy(conn)) {
      this.h1Ready(r)
    } else {
      r.state = HTTP_SERVER_PARKED
    }
  }

  /** A whole HTTP/1.1 request with room for its answer: answered at once when `h1Screen` says so, else queued for `take`. */
  private h1Ready(r: HttpServerRequest): void {
    const status: i32 = this.h1Screen(r)
    if (status === 0) {
      this.enqueue(r)
      return
    }
    r.state = HTTP_SERVER_HELD
    this.empty(r, status)
  }

  /** The status an HTTP/1.1 request is answered with at once, or 0 to serve it: 501 for CONNECT and 204 for `OPTIONS *`, as `screen` answers them on HTTP/2 and HTTP/3. */
  private h1Screen(r: HttpServerRequest): i32 {
    if (r.methodIs("CONNECT")) {
      return 501
    }
    if (r.targetEnd - r.targetStart === 1 && toI32(r.head[r.targetStart]) === 42 && r.methodIs("OPTIONS")) {
      return 204
    }
    return 0
  }

  /** `H1_WRITE`: the carrier has room again for the response under way. */
  private resume(slot: i32, conn: Http1Connection): void {
    const at: i32 = this.h1Current[slot]
    if (at < 0) {
      return
    }
    const r: HttpServerRequest = this.requests[at]
    if (r.state !== HTTP_SERVER_STREAMING && r.state !== HTTP_SERVER_FLUSHING) {
      return
    }
    this.pushH1(r, conn)
    if (r.state === HTTP_SERVER_FLUSHING) {
      this.finishH1(r, conn)
    }
  }

  /** Hands the carrier as much of `r`'s pending bytes as it takes. */
  private pushH1(r: HttpServerRequest, conn: Http1Connection): void {
    const left: i32 = r.pendingEnd - r.pendingStart
    if (left === 0) {
      return
    }
    const taken: i32 = conn.write(r.pending, r.pendingStart, left)
    if (taken > 0) {
      this.taken(r, taken)
    }
  }

  /** Ends `r`'s response once nothing is pending, and hands `r` back; otherwise leaves it flushing. */
  private finishH1(r: HttpServerRequest, conn: Http1Connection): void {
    r.state = HTTP_SERVER_FLUSHING
    if (r.pendingEnd > r.pendingStart) {
      return
    }
    // `H1_AGAIN`: no room for the last chunk yet; `H1_WRITE` comes back here.
    if (conn.end() === H1_AGAIN) {
      return
    }
    this.h1Current[r.slot] = -1
    this.release(r)
  }

  /** Hands back the request `slot` was reading when the carrier refused it. */
  private releaseReading(slot: i32): void {
    const at: i32 = this.h1Current[slot]
    if (at >= 0 && this.requests[at].state === HTTP_SERVER_READING) {
      this.h1Current[slot] = -1
      this.release(this.requests[at])
    }
  }

  /**
   * Closes `slot` and bumps its generation, so any answer still owed for it is
   * dropped. A request the server alone holds goes back now; one queued or
   * taken goes back when `ready` passes it or the program answers it.
   */
  private h1Close(h1: Http1Server, slot: i32): void {
    h1.close(slot)
    this.h1Forget(slot)
  }

  /** The bookkeeping of a slot the carrier has closed. */
  private h1Forget(slot: i32): void {
    this.h1Open[slot] = false
    this.h1Gen[slot] = this.h1Gen[slot] + 1
    const at: i32 = this.h1Current[slot]
    this.h1Current[slot] = -1
    if (at >= 0) {
      this.drop(this.requests[at])
    }
  }

  /** Every slot the carrier's `expire` closed. */
  private h1Sweep(h1: Http1Server): void {
    for (let s: i32 = 0; s < toI32(this.h1Open.length); s++) {
      if (this.h1Open[s] && !h1.holds(s)) {
        this.h1Forget(s)
      }
    }
  }

  // ---- The pool -------------------------------------------------------------------

  /** The index of a free request, its buffers made at their caps on first use; -1 when none is free. */
  private obtain(): i32 {
    const count: i32 = toI32(this.free.length)
    if (count === 0) {
      return -1
    }
    const at: i32 = this.free[count - 1]
    this.free.pop()
    const r: HttpServerRequest = this.requests[at]
    if (toI32(r.head.length) === 0) {
      r.head = new Array<u8>(this.maxHead)
      r.spans = new Array<i32>(4 * this.maxFields)
      r.params = new Array<i32>(2 * this.router.maxParams + 2)
    }
    return at
  }

  /** A head is in `r`: its path's end found, its reading state set and its route matched. */
  private admit(r: HttpServerRequest): void {
    let pathEnd: i32 = r.targetStart
    while (pathEnd < r.targetEnd && toI32(r.head[pathEnd]) !== 63) {
      pathEnd += 1
    }
    r.pathEnd = pathEnd
    r.bodyLength = 0
    r.since = this.turnAt
    r.state = HTTP_SERVER_READING
    r.pendingStart = 0
    r.pendingEnd = 0
    r.hung = false
    r.quiet = r.methodIs("HEAD")
    r.left = -1
    r.ended = false
    this.route(r)
    const declared: i32 = this.declared(r)
    if (declared > toI32(r.body.length)) {
      this.growBody(r, declared)
    }
  }

  /**
   * Routes `r` through the router. A HEAD that only a GET route matches takes
   * that route, since a GET resource answers HEAD (RFC 9110 §9.3.2) and no
   * body is sent for it.
   */
  private route(r: HttpServerRequest): void {
    const params: i32[] = r.params
    let route: i32 = this.router.match(
      r.head,
      r.methodStart,
      r.methodEnd,
      r.head,
      r.targetStart,
      r.targetEnd,
      params
    )
    if (route === ROUTER_METHOD_NOT_ALLOWED && r.quiet) {
      const get: i32 = this.router.methodIndex("GET")
      if (get >= 0) {
        const viaGet: i32 = this.router.match(
          this.router.methodBytes,
          this.router.methodStart[get],
          this.router.methodEnd[get],
          r.head,
          r.targetStart,
          r.targetEnd,
          params
        )
        if (viaGet >= 0) {
          route = viaGet
        }
      }
    }
    r.route = route
    r.paramCount = route >= 0 ? this.router.paramCount(route) : 0
  }

  /** Appends `buf[start .. start + n)` to `r`'s body; the caller has kept it within `maxBody`. */
  private append(r: HttpServerRequest, buf: u8[], start: i32, n: i32): void {
    const need: i32 = r.bodyLength + n
    if (toI32(r.body.length) < need) {
      this.growBody(r, need)
    }
    copyBytes(r.body, r.bodyLength, buf, start, n)
    r.bodyLength = need
  }

  /**
   * Grows `r`'s body to hold `need` bytes, in the two tiers of
   * docs/http-one-handler.md §6. With `T = min(65536, maxBody)`, a body that
   * fits in `T` grows to `min(T, max(need, 2 × current))`, from 64; one
   * past `T` is replaced once by an array of exactly `maxBody`, which never
   * grows again. An entry so holds less than `maxBody + 3 × T` in body
   * arrays, the abandoned ones included.
   */
  private growBody(r: HttpServerRequest, need: i32): void {
    const have: i32 = toI32(r.body.length)
    const tier: i32 = this.maxBody < HTTP_SERVER_BODY_TIER ? this.maxBody : HTTP_SERVER_BODY_TIER
    let size: i32 = this.maxBody
    if (need <= tier) {
      size = have < HTTP_SERVER_BODY_FIRST ? HTTP_SERVER_BODY_FIRST : have * 2
      if (size < need) {
        size = need
      }
      if (size > tier) {
        size = tier
      }
    }
    const grown: u8[] = new Array<u8>(size)
    copyBytes(grown, HTTP_SERVER_ZERO, r.body, HTTP_SERVER_ZERO, r.bodyLength)
    r.body = grown
  }

  /**
   * The `content-length` `r` declared, or -1 for none: its body array is
   * grown toward it in one step rather than many, to the length itself up to
   * 64 KiB and to `maxBody` past that. The carrier has
   * checked the value's syntax and refused one past `maxBody`.
   */
  private declared(r: HttpServerRequest): i32 {
    const i: i32 = r.header("content-length")
    if (i < 0) {
      return -1
    }
    let n: i32 = 0
    for (let k: i32 = r.valueStart(i); k < r.valueEnd(i); k++) {
      const d: i32 = toI32(r.head[k]) - HTTP_SERVER_ZERO_DIGIT
      if (d < 0 || d > 9 || n > (this.maxBody - d) / HTTP_SERVER_TEN) {
        return -1
      }
      n = n * HTTP_SERVER_TEN + d
    }
    return n
  }

  /** Queues `r` for `take`. The ring holds every request, so it never fills. */
  private enqueue(r: HttpServerRequest): void {
    r.state = HTTP_SERVER_QUEUED
    const size: i32 = toI32(this.queue.length)
    this.queue[(this.queueStart + this.queueCount) % size] = r.index
    this.queueCount += 1
  }

  /** Hands `r` back to the pool, and frees its HTTP/2 or HTTP/3 stream entry. */
  private release(r: HttpServerRequest): void {
    if (r.state === HTTP_SERVER_FREE) {
      return
    }
    this.unlink(r)
    r.state = HTTP_SERVER_FREE
    this.free.push(r.index)
  }

  /**
   * Marks `r` hung up, its connection or stream gone, and hands it back unless
   * it is queued or the program's to answer.
   */
  private drop(r: HttpServerRequest): void {
    r.hung = true
    if (
      r.state === HTTP_SERVER_READING ||
      r.state === HTTP_SERVER_PARKED ||
      r.state === HTTP_SERVER_FLUSHING
    ) {
      this.release(r)
    }
  }

  /** `n` of `r`'s pending bytes were taken. */
  private taken(r: HttpServerRequest, n: i32): void {
    r.pendingStart += n
    if (r.pendingStart === r.pendingEnd) {
      r.pendingStart = 0
      r.pendingEnd = 0
    }
  }

  /**
   * Appends bytes to `r`'s pending buffer, grown to
   * `min(2^30, max(needed, 2 × current))`; `write` has refused a remainder
   * past 2^30.
   */
  private keep(r: HttpServerRequest, buf: u8[], off: i32, len: i32): void {
    const live: i32 = r.pendingEnd - r.pendingStart
    if (toI32(r.pending.length) - r.pendingEnd < len) {
      const need: i64 = toI64(live) + toI64(len)
      const target: u8[] =
        toI64(r.pending.length) < need
          ? new Array<u8>(httpServerPendingSize(toI32(r.pending.length), need))
          : r.pending
      copyBytes(target, HTTP_SERVER_ZERO, r.pending, r.pendingStart, live)
      r.pending = target
      r.pendingStart = 0
      r.pendingEnd = live
    }
    copyBytes(r.pending, r.pendingEnd, buf, off, len)
    r.pendingEnd += len
  }

  // ---- Requests -------------------------------------------------------------------

  /**
   * Whether a whole request is waiting for `take`. Requests whose connection
   * or stream closed while queued are handed back here.
   * @returns true when `take` will give out a request whose connection is still open
   */
  ready(): boolean {
    while (this.queueCount > 0) {
      const r: HttpServerRequest = this.requests[this.queue[this.queueStart]]
      if (this.live(r)) {
        return true
      }
      this.queueStart = (this.queueStart + 1) % toI32(this.queue.length)
      this.queueCount -= 1
      this.release(r)
    }
    return false
  }

  /**
   * The next whole request, of any version, which the program now owes an
   * answer. Panics when none is `ready`.
   * @returns the oldest queued request, the program's until it answers it
   */
  take(): HttpServerRequest {
    if (!this.ready()) {
      panic("HttpServer.take: no request is ready")
    }
    const r: HttpServerRequest = this.requests[this.queue[this.queueStart]]
    this.queueStart = (this.queueStart + 1) % toI32(this.queue.length)
    this.queueCount -= 1
    r.state = HTTP_SERVER_HELD
    return r
  }

  /**
   * Whether the client of `r` has hung up: its connection is closed or
   * reused, its HTTP/2 or HTTP/3 stream was reset, or, on HTTP/1.1 and
   * HTTP/2, the peer ended its byte stream while `r` is held. On HTTP/2 that
   * is the connection's end of input, an end of file or a read error, so it
   * includes a client that half-closed TCP after sending its request and
   * may still read an answer: `send` then says which. Panics on another
   * server's request.
   * @param r a request `take` handed over
   * @returns true once nobody is left to read `r`'s answer
   */
  hungUp(r: HttpServerRequest): boolean {
    this.own(r, "hungUp")
    if (!this.live(r)) {
      return true
    }
    if (r.kind === HTTP_SERVER_H2) {
      return this.h2Conn(r.slot).inputEnded
    }
    const h1: Http1Server | null = this.h1
    return r.kind === HTTP_SERVER_H1 && h1 !== null && h1.connection(r.slot).ended()
  }

  /** Panics, naming `who`, unless `r` is one of this server's own requests. */
  private own(r: HttpServerRequest, who: string): void {
    const index: i32 = r.index
    if (index < 0 || index >= toI32(this.requests.length) || this.requests[index] !== r) {
      panic(`HttpServer.${who}: the request is another server's`)
    }
  }

  /** Whether `r`'s connection is the one it was read on, still open, and its stream not reset. */
  private live(r: HttpServerRequest): boolean {
    if (r.kind === HTTP_SERVER_H1) {
      const h1: Http1Server | null = this.h1
      return h1 !== null && h1.holds(r.slot) && this.h1Gen[r.slot] === r.gen
    }
    if (r.hung) {
      return false
    }
    if (r.kind === HTTP_SERVER_H2) {
      return this.h2Holds(r.slot) && this.h2Gen[r.slot] === r.gen
    }
    const h3: Http3Server | null = this.h3
    return h3 !== null && h3.holds(r.slot) && h3.connection(r.slot).generation === r.gen
  }

  /** Frees the HTTP/2 or HTTP/3 stream entry `r` holds, if it still holds it. */
  private unlink(r: HttpServerRequest): void {
    const e: i32 = r.entry
    r.entry = -1
    if (e < 0) {
      return
    }
    if (r.kind === HTTP_SERVER_H2) {
      if (this.h2Reqs[e] === r.index && this.h2Gen[r.slot] === r.gen) {
        this.h2Reqs[e] = -1
        this.h2Count[r.slot] = this.h2Count[r.slot] - 1
        if (this.h2Count[r.slot] === 0) {
          this.h2IdleSince[r.slot] = this.turnAt
        }
      }
    } else if (r.kind === HTTP_SERVER_H3) {
      if (this.h3Reqs[e] === r.index && this.h3Gen[r.slot] === r.gen) {
        this.h3Reqs[e] = -1
        this.h3Count[r.slot] = this.h3Count[r.slot] - 1
      }
    }
  }

  // ---- Answers --------------------------------------------------------------------

  /**
   * Starts `r`'s response: `status` (200 to 599), the fields `names[k]`:
   * `values[k]`, and a body of `bodyLength` bytes or `HTTP1_CHUNKED` for one
   * of unknown length; then `write` the body and `end`. On HTTP/2 and HTTP/3
   * the field names must be lowercase, and a `content-length` is added for a
   * known length the fields do not give; on HTTP/1.1 and HTTP/2 the Alt-Svc
   * field is added when an HTTP/3 listener is set and the fields have none.
   * Panics on another server's request, a request not taken or already
   * answered, a status outside the range, a body length below
   * `HTTP1_CHUNKED`, or fields the carrier refuses.
   * @param r a request taken and not yet answered
   * @param status the response status, from 200 to 599
   * @param names the field names, as bytes, beside `values`
   * @param values each field's value, `values[k]` for `names[k]`
   * @param bodyLength how many body bytes will follow, or `HTTP1_CHUNKED` for a body of unknown length
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or
   *   stream closed first, or the head could not be sent (too many fields, or
   *   no room) and the request was aborted for it
   */
  start(r: HttpServerRequest, status: i32, names: u8[][], values: u8[][], bodyLength: i32): i32 {
    this.own(r, "start")
    if (r.state !== HTTP_SERVER_HELD) {
      panic(`HttpServer.start: the request is not one taken and unanswered (state ${r.state})`)
    }
    if (status < 200 || status > 599) {
      panic(`HttpServer.start: status ${status} is outside 200 to 599`)
    }
    if (bodyLength < HTTP1_CHUNKED) {
      panic(`HttpServer.start: body length ${bodyLength}`)
    }
    if (toI32(names.length) !== toI32(values.length)) {
      panic(`HttpServer.start: ${names.length} name(s) beside ${values.length} value(s)`)
    }
    r.state = HTTP_SERVER_STREAMING
    if (!this.live(r)) {
      return HANDLER_DROPPED
    }
    const noBody: boolean = status === 204 || status === 304
    r.quiet = r.quiet || noBody
    r.left = noBody ? 0 : bodyLength
    if (!this.outFields(r, names, values, bodyLength)) {
      this.abort(r)
      return HANDLER_DROPPED
    }
    if (r.kind === HTTP_SERVER_H1) {
      const conn: Http1Connection = this.h1Of().connection(r.slot)
      const sent: i32 = conn.respond(
        status,
        this.outNames,
        this.outValues,
        noBody ? HTTP1_NO_BODY : bodyLength
      )
      if (sent === H1_AGAIN) {
        // The output still holds more of the response before this one than a
        // head can fit behind: ending the connection is the one answer left.
        this.abort(r)
        return HANDLER_DROPPED
      }
      if (sent !== 0) {
        panic(
          `HttpServer.start: the carrier refused the head (${sent}): a reserved field, or a name or value that is not a token or field text`
        )
      }
      return HANDLER_SENT
    }
    const endNow: boolean = r.quiet || bodyLength === 0
    let sent: i32 = 0
    if (r.kind === HTTP_SERVER_H2) {
      sent = this.h2Conn(r.slot).respond(toI32(r.stream), status, this.outNames, this.outValues, endNow)
      if (sent === H2_INVALID) {
        panic(
          "HttpServer.start: the HTTP/2 carrier refused the head: a name that is not a lowercase token, a reserved field, or a value that is not field text"
        )
      }
    } else {
      sent = this.h3Of().connection(r.slot).respond(r.stream, status, this.outNames, this.outValues, endNow)
      if (sent === H3_INVALID) {
        panic(
          "HttpServer.start: the HTTP/3 carrier refused the head: a name that is not a lowercase token, a reserved field, or a value that is not field text"
        )
      }
    }
    if (sent !== 0) {
      // Closed under it, out of room, or a head past the peer's limit.
      this.abort(r)
      return HANDLER_DROPPED
    }
    r.ended = endNow
    this.nudge(r)
    return HANDLER_SENT
  }

  /**
   * Gathers the response's fields into `outNames` and `outValues`: the
   * program's, then Alt-Svc and content-length where they are owed and the
   * program gave none. False when that is more than `maxResponseFields`.
   */
  private outFields(r: HttpServerRequest, names: u8[][], values: u8[][], bodyLength: i32): boolean {
    const given: i32 = toI32(names.length)
    const altSvc: u8[] | null = this.altSvc
    // Never on HTTP/3, which it names, nor h2c, whose clients reach it
    // through a proxy that answers on another port.
    const addAlt: boolean =
      altSvc !== null &&
      r.kind !== HTTP_SERVER_H3 &&
      (r.kind !== HTTP_SERVER_H2 || r.secure) &&
      !this.hasField(names, this.altSvcName)
    const addLength: boolean =
      r.kind !== HTTP_SERVER_H1 &&
      !r.quiet &&
      bodyLength >= 0 &&
      !this.hasField(names, this.contentLengthName)
    const count: i32 = given + (addAlt ? 1 : 0) + (addLength ? 1 : 0)
    if (count > this.maxResponseFields) {
      return false
    }
    if (count === given) {
      this.outNames = names
      this.outValues = values
      return true
    }
    while (toI32(this.outNamesBy.length) <= count) {
      const size: i32 = toI32(this.outNamesBy.length)
      const n: u8[][] = []
      const v: u8[][] = []
      for (let k: i32 = 0; k < size; k++) {
        n.push(this.altSvcName)
        v.push(this.altSvcName)
      }
      this.outNamesBy.push(n)
      this.outValuesBy.push(v)
    }
    const outN: u8[][] = this.outNamesBy[count]
    const outV: u8[][] = this.outValuesBy[count]
    for (let k: i32 = 0; k < given; k++) {
      if (
        k < toI32(outN.length) &&
        k < toI32(outV.length) &&
        k < toI32(names.length) &&
        k < toI32(values.length)
      ) {
        outN[k] = names[k]
        outV[k] = values[k]
      }
    }
    let at: i32 = given
    if (altSvc !== null && addAlt) {
      outN[at] = this.altSvcName
      outV[at] = altSvc
      at += 1
    }
    if (addLength) {
      outN[at] = this.contentLengthName
      outV[at] = this.digits(bodyLength)
    }
    this.outNames = outN
    this.outValues = outV
    return true
  }

  /** Whether `names` holds `name`, in any case. */
  private hasField(names: u8[][], name: u8[]): boolean {
    for (let k: i32 = 0; k < toI32(names.length); k++) {
      const have: u8[] = names[k]
      if (toI32(have.length) === toI32(name.length)) {
        let same: boolean = true
        for (let i: i32 = 0; i < toI32(name.length) && i < toI32(have.length) && same; i++) {
          let c: i32 = toI32(have[i])
          if (c >= 65 && c <= 90) {
            c += 32
          }
          same = c === toI32(name[i])
        }
        if (same) {
          return true
        }
      }
    }
    return false
  }

  /** `n` in decimal, in the shared buffer for its digit count: valid until the next call. */
  private digits(n: i32): u8[] {
    let count: i32 = 1
    let rest: i32 = n
    while (rest >= HTTP_SERVER_TEN) {
      rest = (rest - (rest % HTTP_SERVER_TEN)) / HTTP_SERVER_TEN
      count += 1
    }
    const out: u8[] = this.digitBufs[count]
    rest = n
    for (let k: i32 = count - 1; k >= 0 && k < toI32(out.length); k--) {
      const digit: i32 = rest % HTTP_SERVER_TEN
      out[k] = toU8(HTTP_SERVER_ZERO_DIGIT + digit)
      rest = (rest - digit) / HTTP_SERVER_TEN
    }
    return out
  }

  /**
   * Gives up on `r`'s response: on HTTP/1.1 its connection is closed, on
   * HTTP/2 and HTTP/3 its stream is reset. The program still `end`s it.
   */
  private abort(r: HttpServerRequest): void {
    r.hung = true
    if (r.kind === HTTP_SERVER_H1) {
      const h1: Http1Server = this.h1Of()
      if (this.live(r)) {
        this.h1Close(h1, r.slot)
      }
      return
    }
    if (r.kind === HTTP_SERVER_H2) {
      if (this.h2Holds(r.slot) && this.h2Gen[r.slot] === r.gen) {
        if (this.h2Conn(r.slot).reset(toI32(r.stream), H2_INTERNAL_ERROR) === H2_AGAIN) {
          // No room even for the reset: the connection is past saving.
          this.h2Close(r.slot)
          return
        }
        this.h2Settle(r.slot)
      }
      return
    }
    const h3: Http3Server = this.h3Of()
    if (h3.holds(r.slot) && h3.connection(r.slot).generation === r.gen) {
      h3.connection(r.slot).reset(r.stream, H3_INTERNAL_ERROR)
      h3.touch(r.slot)
    }
  }

  /**
   * Writes `buf[off .. off + len)` of `r`'s body. What the carrier has no room
   * for is copied and sent as room comes, so `buf` is the caller's again on
   * return. Body bytes of a HEAD, 204 or 304 response are dropped. Panics
   * on another server's request, when the response is not started, on a window outside `buf`, or on more
   * bytes than the declared length leaves.
   * @param r a request whose response `start` began
   * @param buf the bytes to send from; the caller's again on return
   * @param off where in `buf` the body bytes start
   * @param len how many bytes to send
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or stream closed first
   */
  write(r: HttpServerRequest, buf: u8[], off: i32, len: i32): i32 {
    this.own(r, "write")
    if (r.state !== HTTP_SERVER_STREAMING) {
      panic(`HttpServer.write: the response is not started (state ${r.state})`)
    }
    if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
      panic(`HttpServer.write: the window ${off} + ${len} is outside its ${buf.length} bytes`)
    }
    if (r.left >= 0 && !r.quiet && len > r.left) {
      panic(
        `HttpServer.write: ${len} byte(s) is more than the ${r.left} the length the response declared leaves`
      )
    }
    if (!this.live(r)) {
      return HANDLER_DROPPED
    }
    if (r.quiet || len === 0) {
      return HANDLER_SENT
    }
    if (toI64(r.pendingEnd - r.pendingStart) + toI64(len) > toI64(HTTP_SERVER_MAX_BODY)) {
      // A remainder past 2^30, the longest array the runtime grows to:
      // nothing of it is written, and the response is cut.
      this.abort(r)
      return HANDLER_DROPPED
    }
    if (r.left >= 0) {
      r.left -= len
    }
    let taken: i32 = 0
    if (r.pendingEnd === r.pendingStart) {
      taken = this.carry(r, buf, off, len, false)
      if (taken < 0) {
        this.abort(r)
        return HANDLER_DROPPED
      }
    }
    if (taken < len) {
      this.keep(r, buf, off + taken, len - taken)
    }
    this.nudge(r)
    return HANDLER_SENT
  }

  /**
   * Hands `buf[off .. off + len)` to `r`'s carrier, with `last` ending the
   * stream on HTTP/2 and HTTP/3: the bytes it took, 0 for none yet, or -1
   * when the connection or stream is gone.
   */
  private carry(r: HttpServerRequest, buf: u8[], off: i32, len: i32, last: boolean): i32 {
    if (r.kind === HTTP_SERVER_H1) {
      const taken: i32 = this.h1Of().connection(r.slot).write(buf, off, len)
      if (taken === H1_AGAIN) {
        return 0
      }
      if (taken < 0) {
        panic(
          `HttpServer.write: the carrier refused the body (${taken}): more than the length the response declared`
        )
      }
      return taken
    }
    let taken: i32 = 0
    if (r.kind === HTTP_SERVER_H2) {
      taken = this.h2Conn(r.slot).writeData(toI32(r.stream), buf, off, len, last)
      if (taken === H2_AGAIN) {
        return 0
      }
    } else {
      taken = this.h3Of().connection(r.slot).writeData(r.stream, buf, off, len, last)
      if (taken === H3_AGAIN) {
        return 0
      }
    }
    return taken < 0 ? -1 : taken
  }

  /** After the program wrote to `r`: what the carrier holds is sent now on HTTP/1.1 and HTTP/2, and by the turn's flush on HTTP/3. */
  private nudge(r: HttpServerRequest): void {
    if (r.kind === HTTP_SERVER_H1) {
      this.drive(this.h1Of(), r.slot)
    } else if (r.kind === HTTP_SERVER_H2) {
      if (this.h2Holds(r.slot)) {
        this.h2Settle(r.slot)
      }
    } else {
      const h3: Http3Server = this.h3Of()
      if (h3.holds(r.slot)) {
        h3.touch(r.slot)
      }
    }
  }

  /**
   * Ends `r`'s response. `r` is the server's again: it goes back once the
   * carrier has taken every byte. Panics on another server's request, when the
   * response is not started, or its body is short of the declared length.
   * @param r a request whose response `start` began; the server's again after this call
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or stream closed first
   */
  end(r: HttpServerRequest): i32 {
    this.own(r, "end")
    if (r.state !== HTTP_SERVER_STREAMING) {
      panic(`HttpServer.end: the response is not started (state ${r.state})`)
    }
    if (!this.live(r)) {
      this.release(r)
      return HANDLER_DROPPED
    }
    if (r.left > 0 && !r.quiet) {
      panic(`HttpServer.end: the body is ${r.left} byte(s) short of the length the response declared`)
    }
    if (r.kind === HTTP_SERVER_H1) {
      this.finishH1(r, this.h1Of().connection(r.slot))
      this.drive(this.h1Of(), r.slot)
      return HANDLER_SENT
    }
    r.state = HTTP_SERVER_FLUSHING
    this.push(r)
    this.nudge(r)
    return HANDLER_SENT
  }

  /**
   * Hands an HTTP/2 or HTTP/3 stream's pending bytes to the carrier and, once
   * a flushing response has none left, ends the stream and hands `r` back.
   */
  private push(r: HttpServerRequest): void {
    if (r.state !== HTTP_SERVER_STREAMING && r.state !== HTTP_SERVER_FLUSHING) {
      return
    }
    if (!this.live(r)) {
      this.drop(r)
      return
    }
    const left: i32 = r.pendingEnd - r.pendingStart
    if (left > 0) {
      const last: boolean = r.state === HTTP_SERVER_FLUSHING
      const taken: i32 = this.carry(r, r.pending, r.pendingStart, left, last)
      if (taken < 0) {
        this.drop(r)
        return
      }
      this.taken(r, taken)
      if (last && taken === left) {
        r.ended = true
      }
    }
    if (r.state !== HTTP_SERVER_FLUSHING || r.pendingEnd > r.pendingStart) {
      return
    }
    if (!r.ended) {
      const done: i32 = this.carryEnd(r)
      if (done === 0) {
        return // no room for the end yet: the next push sends it
      }
      if (done < 0) {
        r.hung = true
      }
      r.ended = true
    }
    this.release(r)
  }

  /**
   * Ends `r`'s HTTP/2 or HTTP/3 stream with an empty DATA frame: 1 when it is
   * sent, 0 when the carrier has no room yet, -1 when the stream is gone.
   * `carry` cannot say this, since the frame is taken as 0 bytes either way.
   */
  private carryEnd(r: HttpServerRequest): i32 {
    let done: i32 = 0
    if (r.kind === HTTP_SERVER_H2) {
      done = this.h2Conn(r.slot).writeData(
        toI32(r.stream),
        r.pending,
        HTTP_SERVER_ZERO,
        HTTP_SERVER_ZERO,
        true
      )
      if (done === H2_AGAIN) {
        return 0
      }
    } else {
      done = this.h3Of()
        .connection(r.slot)
        .writeData(r.stream, r.pending, HTTP_SERVER_ZERO, HTTP_SERVER_ZERO, true)
      if (done === H3_AGAIN) {
        return 0
      }
    }
    return done < 0 ? -1 : 1
  }

  /**
   * Answers `r` with `status`, a `Content-Type` of `contentType` and the body `body[off .. off + len)`, in one call.
   * @param r a request taken and not yet answered; the server's again after this call
   * @param status the response status, from 200 to 599
   * @param contentType the `Content-Type` value, as bytes
   * @param body the buffer holding the body; the caller's again on return
   * @param off where in `body` the body bytes start
   * @param len how many body bytes to send
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or stream closed first, or the head could not be sent
   */
  send(r: HttpServerRequest, status: i32, contentType: u8[], body: u8[], off: i32, len: i32): i32 {
    this.typeValue[0] = contentType
    return this.sendFields(r, status, this.typeName, this.typeValue, body, off, len)
  }

  /**
   * Answers `r` with `status`, the fields `names[k]`: `values[k]` and the body `body[off .. off + len)`, in one call.
   * @param r a request taken and not yet answered; the server's again after this call
   * @param status the response status, from 200 to 599
   * @param names the field names, as bytes, beside `values`
   * @param values each field's value, `values[k]` for `names[k]`
   * @param body the buffer holding the body; the caller's again on return
   * @param off where in `body` the body bytes start
   * @param len how many body bytes to send
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or stream closed first, or the head could not be sent
   */
  sendFields(
    r: HttpServerRequest,
    status: i32,
    names: u8[][],
    values: u8[][],
    body: u8[],
    off: i32,
    len: i32
  ): i32 {
    const started: i32 = this.start(r, status, names, values, len)
    if (started === HANDLER_DROPPED) {
      this.release(r)
      return HANDLER_DROPPED
    }
    if (len > 0 && status !== 204 && status !== 304) {
      this.write(r, body, off, len)
    }
    return this.end(r)
  }

  /**
   * Answers `r` with `status` and no body.
   * @param r a request taken and not yet answered; the server's again after this call
   * @param status the response status, from 200 to 599
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or stream closed first, or the head could not be sent
   */
  empty(r: HttpServerRequest, status: i32): i32 {
    return this.sendFields(
      r,
      status,
      this.noFields,
      this.noFields,
      this.scratch,
      HTTP_SERVER_ZERO,
      HTTP_SERVER_ZERO
    )
  }

  /**
   * The JSON writer, reset onto the server's scratch buffer: write one value
   * with it, then `sendJson`. One JSON body at a time, since every request
   * shares the buffer.
   * @returns the server's own writer, empty, valid until the next `json`, `sendJson` or `problem`
   */
  json(): JsonWriter {
    this.writer.reset(this.scratch, HTTP_SERVER_ZERO)
    this.jsonBegun = true
    return this.writer
  }

  /**
   * Answers `r` with `status` and the value `json`'s writer holds, as
   * `application/json`. A value the writer refused or did not finish is
   * answered as a 500 problem instead. Panics when no value was begun with `json`.
   * @param r a request taken and not yet answered; the server's again after this call
   * @param status the response status for a value that fit, from 200 to 599
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or stream closed first, or the head could not be sent
   */
  sendJson(r: HttpServerRequest, status: i32): i32 {
    if (!this.jsonBegun) {
      panic("HttpServer.sendJson: no value was begun with json()")
    }
    this.jsonBegun = false
    if (!this.writer.complete()) {
      return this.problem(r, toI32(500), "Internal Server Error", "the response did not fit its buffer")
    }
    return this.send(r, status, this.jsonType, this.scratch, HTTP_SERVER_ZERO, this.writer.end)
  }

  /**
   * Answers `r` with an RFC 9457 problem: `application/problem+json` with
   * `type` `about:blank`, `title`, `status` and, when not empty, `detail`.
   * Nothing of the request is echoed.
   * @param r a request taken and not yet answered; the server's again after this call
   * @param status the response status, from 200 to 599, also written into the object
   * @param title the status's reason phrase, or empty to leave it out
   * @param detail a sentence for a person about this occurrence, or empty to leave it out
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or stream closed first, or the head could not be sent
   */
  problem(r: HttpServerRequest, status: i32, title: string, detail: string): i32 {
    const length: i32 = this.writeProblem(status, title, detail)
    return this.send(r, status, this.problemType, this.scratch, HTTP_SERVER_ZERO, length)
  }

  /** Writes a problem object into the scratch buffer and answers its length, dropping the detail and then the title until it fits. */
  private writeProblem(status: i32, title: string, detail: string): i32 {
    let length: i32 = this.writeProblemObject(status, title, detail)
    if (length < 0) {
      length = this.writeProblemObject(status, title, "")
    }
    if (length < 0) {
      length = this.writeProblemObject(status, "", "")
    }
    this.jsonBegun = false
    return length
  }

  /** `writeProblem`'s one try: the object's length, or -1 when it did not fit. */
  private writeProblemObject(status: i32, title: string, detail: string): i32 {
    const w: JsonWriter = this.json()
    w.beginObject()
    w.key("type")
    w.string("about:blank")
    if (toI32(title.length) > 0) {
      w.key("title")
      w.string(title)
    }
    w.key("status")
    w.i32(status)
    if (toI32(detail.length) > 0) {
      w.key("detail")
      w.string(detail)
    }
    w.endObject()
    return w.complete() ? w.end : -1
  }

  /**
   * Answers a request the router refused, by its `route`: 405 with an `Allow`
   * field naming the methods the path has, and 404 for anything else.
   * @param r a request whose `route` is negative, taken and not yet answered; the server's again after this call
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or stream closed first, or the head could not be sent
   */
  refuse(r: HttpServerRequest): i32 {
    if (r.route === ROUTER_METHOD_NOT_ALLOWED) {
      const length: i32 = this.writeProblem(toI32(405), "Method Not Allowed", "")
      this.allowValues[1] = this.allowFor(r)
      return this.sendFields(
        r,
        toI32(405),
        this.allowNames,
        this.allowValues,
        this.scratch,
        HTTP_SERVER_ZERO,
        length
      )
    }
    return this.problem(r, toI32(404), "Not Found", "")
  }

  /** The `Allow` value for `r`'s path: each method a route of it takes, and HEAD wherever GET is. Made once for each set of methods. */
  private allowFor(r: HttpServerRequest): u8[] {
    const router: Router = this.router
    const methods: i32 = toI32(router.methodStart.length)
    let mask: i64 = 0
    for (let m: i32 = 0; m < methods; m++) {
      const route: i32 = router.match(
        router.methodBytes,
        router.methodStart[m],
        router.methodEnd[m],
        r.head,
        r.targetStart,
        r.targetEnd,
        this.probe
      )
      if (route >= 0) {
        mask = mask | (toI64(1) << toI64(m))
      }
    }
    for (let k: i32 = 0; k < toI32(this.allowMasks.length); k++) {
      if (this.allowMasks[k] === mask) {
        return this.allowBytes[k]
      }
    }
    let get: boolean = false
    let head: boolean = false
    const value: u8[] = []
    for (let m: i32 = 0; m < methods; m++) {
      if ((mask & (toI64(1) << toI64(m))) !== toI64(0)) {
        const start: i32 = router.methodStart[m]
        const end: i32 = router.methodEnd[m]
        get = get || httpServerSpanIs(router.methodBytes, start, end, "GET")
        head = head || httpServerSpanIs(router.methodBytes, start, end, "HEAD")
        httpServerAllowAppend(value, router.methodBytes, start, end)
      }
    }
    if (get && !head) {
      const name: u8[] = httpFieldBytes("HEAD")
      httpServerAllowAppend(value, name, HTTP_SERVER_ZERO, toI32(name.length))
    }
    this.allowMasks.push(mask)
    this.allowBytes.push(value)
    return value
  }

  /** The HTTP/1.1 carrier, for a request read on it. */
  private h1Of(): Http1Server {
    const h1: Http1Server | null = this.h1
    if (h1 === null) {
      panic("HttpServer: no HTTP/1.1 listener")
    }
    return h1
  }

  /** The HTTP/2 over TLS carrier, for a slot on it. */
  private h2Of(): Http2TlsServer {
    const h2: Http2TlsServer | null = this.h2
    if (h2 === null) {
      panic("HttpServer: no HTTP/2 over TLS listener")
    }
    return h2
  }

  /** The h2c carrier, for a slot on it. */
  private h2cOf(): Http2CleartextServer {
    const h2c: Http2CleartextServer | null = this.h2c
    if (h2c === null) {
      panic("HttpServer: no h2c listener")
    }
    return h2c
  }

  /** The HTTP/3 carrier, for a request read on it. */
  private h3Of(): Http3Server {
    const h3: Http3Server | null = this.h3
    if (h3 === null) {
      panic("HttpServer: no HTTP/3 listener")
    }
    return h3
  }

  // ---- HTTP/2 and HTTP/3 heads ----------------------------------------------------

  /**
   * The status a stream's head is answered with at once, or 0 to serve it:
   * 501 for CONNECT, 204 for `OPTIONS *`, 431 for a head past `maxFields` or
   * `maxHead`, and 413 for a declared length past `maxBody`.
   */
  private screen(f: HttpFields): i32 {
    if (f.isConnect()) {
      return 501
    }
    const pathLength: i32 = toI32(f.path.length)
    if (pathLength === 1 && toI32(f.path[0]) === 42 && httpFieldIs(f.method, "OPTIONS")) {
      return 204
    }
    // Counts what `fromFields` lays out: `:authority`, when present, as a
    // `host` field in place of every `host` field the head carries.
    const authority: boolean = toI32(f.authority.length) > 0
    let fields: i32 = authority ? 1 : 0
    let bytes: i32 = toI32(f.method.length) + pathLength + 4 + toI32(f.authority.length)
    for (let k: i32 = 0; k < toI32(f.names.length); k++) {
      if (!authority || !httpFieldIs(f.names[k], "host")) {
        fields += 1
        bytes += toI32(f.names[k].length) + toI32(f.values[k].length)
      }
    }
    if (fields > this.maxFields || bytes > this.maxHead) {
      return 431
    }
    if (f.contentLength > toI64(this.maxBody)) {
      return HTTP_SERVER_TOO_LARGE
    }
    return 0
  }

  /**
   * Lays a screened head out in `r` as HTTP/1.1's reads: the method, the
   * path as the target, and the fields, with `:authority` given as `host`
   * in place of any `host` field.
   */
  private fromFields(r: HttpServerRequest, f: HttpFields): void {
    this.headAt = 0
    r.methodStart = 0
    this.put(r, f.method)
    r.methodEnd = this.headAt
    r.targetStart = this.headAt
    this.put(r, f.path)
    r.targetEnd = this.headAt
    let n: i32 = 0
    const authority: boolean = toI32(f.authority.length) > 0
    if (authority) {
      this.putField(r, n, this.hostName, f.authority)
      n += 1
    }
    for (let k: i32 = 0; k < toI32(f.names.length); k++) {
      const name: u8[] = f.names[k]
      if (!authority || !httpFieldIs(name, "host")) {
        this.putField(r, n, name, f.values[k])
        n += 1
      }
    }
    r.headerCount = n
  }

  /** Copies `bytes` into `r`'s head at `headAt`. */
  private put(r: HttpServerRequest, bytes: u8[]): void {
    const n: i32 = toI32(bytes.length)
    copyBytes(r.head, this.headAt, bytes, HTTP_SERVER_ZERO, n)
    this.headAt += n
  }

  /** Copies field `n`, `name`: `value`, into `r`'s head and spans. */
  private putField(r: HttpServerRequest, n: i32, name: u8[], value: u8[]): void {
    r.spans[4 * n] = this.headAt
    this.put(r, name)
    r.spans[4 * n + 1] = this.headAt
    r.spans[4 * n + 2] = this.headAt
    this.put(r, value)
    r.spans[4 * n + 3] = this.headAt
  }

  // ---- HTTP/2 ---------------------------------------------------------------------

  /** Takes every waiting HTTP/2 over TLS connection, each with fresh randomness. */
  private acceptHttp2(): void {
    const h2: Http2TlsServer | null = this.h2
    if (h2 === null || this.draining) {
      return
    }
    while (true) {
      crypto.getRandomValues(this.rnd)
      crypto.getRandomValues(this.keyBuf)
      const slot: i32 = h2.accept(this.rnd, this.keyBuf)
      if (slot >= 0) {
        this.h2Opened(this.h2TlsBase + slot, h2.fd(slot))
      } else if (slot === HTTP_SERVER_ACCEPT_NONE) {
        return
      } else if (slot !== TLS_TCP_POOL_FULL && slot !== HTTP_SERVER_ACCEPT_ABORTED) {
        // Out of descriptors or memory: rest the listener, as `acceptHttp1` does.
        this.rest(this.h2Fd, HTTP_SERVER_H2_LISTENER)
        return
      }
    }
  }

  /** Takes every waiting h2c connection. */
  private acceptH2c(): void {
    const h2c: Http2CleartextServer | null = this.h2c
    if (h2c === null || this.draining) {
      return
    }
    let slot: i32 = h2c.accept()
    while (slot >= 0 || slot === H2C_POOL_FULL || slot === HTTP_SERVER_ACCEPT_ABORTED) {
      if (slot >= 0) {
        this.h2Opened(this.h2cBase + slot, h2c.fd(slot))
      }
      slot = h2c.accept()
    }
    if (slot !== HTTP_SERVER_ACCEPT_NONE) {
      this.rest(this.h2cFd, HTTP_SERVER_H2C_LISTENER)
    }
  }

  /**
   * Out of descriptors or memory: the connection stays in the backlog and
   * the listener stays readable, so it leaves the loop for a while rather
   * than spin.
   */
  private rest(fd: i32, token: i32): void {
    pollRemove(this.loop, fd)
    this.restUntil[HTTP_SERVER_H1_LISTENER - token] = monotonicNanos() + HTTP_SERVER_ACCEPT_REST
  }

  /** HTTP/2 slot `v`, just accepted on socket `fd`: an empty stream table, idle, and in the loop. */
  private h2Opened(v: i32, fd: i32): void {
    this.h2Open[v] = true
    this.h2Count[v] = 0
    this.h2IdleSince[v] = this.turnAt
    const base: i32 = v * this.perConnection2
    for (let e: i32 = base; e < base + this.perConnection2; e++) {
      this.h2Reqs[e] = -1
    }
    pollAdd(this.loop, fd, H1_WANT_READ, HTTP_SERVER_H2_BASE + v)
  }

  /** Whether HTTP/2 slot `v`'s carrier holds a connection there. */
  private h2Holds(v: i32): boolean {
    if (this.h2Clear[v]) {
      const h2c: Http2CleartextServer | null = this.h2c
      return h2c !== null && h2c.holds(v - this.h2cBase)
    }
    const h2: Http2TlsServer | null = this.h2
    return h2 !== null && h2.holds(v - this.h2TlsBase)
  }

  /** HTTP/2 slot `v`'s connection. */
  private h2Conn(v: i32): Http2Connection {
    if (this.h2Clear[v]) {
      return this.h2cOf().connection(v - this.h2cBase)
    }
    return this.h2Of().connection(v - this.h2TlsBase)
  }

  /** HTTP/2 slot `v`'s next event, as its carrier's `next` answers. */
  private h2Next(v: i32): i32 {
    if (this.h2Clear[v]) {
      return this.h2cOf().next(v - this.h2cBase)
    }
    return this.h2Of().next(v - this.h2TlsBase)
  }

  /** Sends what HTTP/2 slot `v` holds: its interest, with `TLS_RECORD_DONE` (`H2C_DONE`) once it is over. */
  private h2Flush(v: i32): i32 {
    if (this.h2Clear[v]) {
      return this.h2cOf().flush(v - this.h2cBase)
    }
    return this.h2Of().flush(v - this.h2TlsBase)
  }

  /** HTTP/2 slot `v`'s socket. */
  private h2FdOf(v: i32): i32 {
    if (this.h2Clear[v]) {
      return this.h2cOf().fd(v - this.h2cBase)
    }
    return this.h2Of().fd(v - this.h2TlsBase)
  }

  /**
   * A ready HTTP/2 socket: read or written, a TLS handshake signed, its
   * events served, then settled. A TLS slot is never ready under `wait`,
   * which panics with a TLS listener, so `key` is null only for h2c.
   */
  private h2Serve(v: i32, events: i32, key: Secret<u8[]> | null): void {
    if (v < 0 || v >= toI32(this.h2Open.length) || !this.h2Open[v]) {
      return
    }
    if (!this.h2Holds(v)) {
      this.h2Forget(v)
      return
    }
    const read: boolean = (events & HTTP_SERVER_READ_BITS) !== 0
    if (this.h2Clear[v]) {
      const h2c: Http2CleartextServer = this.h2cOf()
      const slot: i32 = v - this.h2cBase
      if (read) {
        h2c.readable(slot)
      } else {
        h2c.writable(slot)
      }
    } else if (key !== null) {
      const h2: Http2TlsServer = this.h2Of()
      const slot: i32 = v - this.h2TlsBase
      let wants: i32 = read ? h2.readable(slot) : h2.writable(slot)
      for (let turn: i32 = 0; turn < 4 && h2.holds(slot) && (wants & TLS_RECORD_SIGN) !== 0; turn++) {
        wants = h2.signP256(slot, key)
      }
    }
    if (this.h2Holds(v)) {
      const conn: Http2Connection = this.h2Conn(v)
      let event: i32 = this.h2Next(v)
      while (event !== H2_NEED_MORE && event !== H2_ERROR) {
        this.h2Event(v, conn, event)
        event = this.h2Next(v)
      }
    }
    this.h2Settle(v)
  }

  /** One HTTP/2 event of `slot`'s connection. */
  private h2Event(slot: i32, conn: Http2Connection, event: i32): void {
    const id: i32 = conn.stream
    if (event === H2_REQUEST) {
      const f: HttpFields = conn.fields
      const status: i32 = this.screen(f)
      if (status > 0) {
        this.h2Direct(slot, conn, id, status, conn.endStream)
        return
      }
      const e: i32 = this.h2Entry(slot)
      const at: i32 = e >= 0 ? this.obtain() : -1
      if (at < 0) {
        conn.reset(id, H2_REFUSED_STREAM)
        return
      }
      const r: HttpServerRequest = this.requests[at]
      this.fromFields(r, f)
      r.kind = HTTP_SERVER_H2
      r.version = 2
      r.secure = !this.h2Clear[slot]
      r.stream = toI64(id)
      r.slot = slot
      r.gen = this.h2Gen[slot]
      r.entry = e
      this.h2Streams[e] = id
      this.h2Reqs[e] = at
      this.h2Count[slot] = this.h2Count[slot] + 1
      this.h2IdleSince[slot] = 0
      this.admit(r)
      if (conn.endStream) {
        this.enqueue(r)
      }
      return
    }
    const at: i32 = this.h2Find(slot, id)
    if (at < 0) {
      return
    }
    const r: HttpServerRequest = this.requests[at]
    if (event === H2_DATA) {
      if (r.state !== HTTP_SERVER_READING) {
        return
      }
      if (r.bodyLength + conn.dataLength > this.maxBody) {
        this.release(r)
        this.h2Direct(slot, conn, id, HTTP_SERVER_TOO_LARGE, conn.endStream)
        return
      }
      this.append(r, conn.data, conn.dataStart, conn.dataLength)
      if (conn.endStream) {
        this.enqueue(r)
      }
    } else if (event === H2_TRAILERS) {
      if (r.state === HTTP_SERVER_READING) {
        this.enqueue(r)
      }
    } else if (event === H2_RESET) {
      // A request still read, or flushed after its answer, is the server's
      // alone; one queued or the program's goes back when it is answered.
      this.drop(r)
      this.unlink(r)
    }
  }

  /**
   * Answers stream `id` with `status` and no body, then resets it with
   * NO_ERROR when the client is still sending (RFC 9113 §8.1); with
   * INTERNAL_ERROR when there is no room for the answer. Over TLS it
   * carries `alt-svc` like every other answer; over h2c it carries none.
   */
  private h2Direct(slot: i32, conn: Http2Connection, id: i32, status: i32, ended: boolean): void {
    const alt: boolean = this.altSvc !== null && !this.h2Clear[slot]
    const names: u8[][] = alt ? this.altNames : this.noFields
    const values: u8[][] = alt ? this.altValues : this.noFields
    if (conn.respond(id, status, names, values, true) !== 0) {
      conn.reset(id, H2_INTERNAL_ERROR)
    } else if (!ended) {
      conn.reset(id, H2_NO_ERROR)
    }
  }

  /** A free entry of `slot`'s stream table, or -1 when it is full. */
  private h2Entry(slot: i32): i32 {
    const base: i32 = slot * this.perConnection2
    for (let e: i32 = base; e < base + this.perConnection2; e++) {
      if (this.h2Reqs[e] === -1) {
        return e
      }
    }
    return -1
  }

  /** The request `slot` holds for stream `id`, or -1. */
  private h2Find(slot: i32, id: i32): i32 {
    const base: i32 = slot * this.perConnection2
    for (let e: i32 = base; e < base + this.perConnection2; e++) {
      if (this.h2Reqs[e] >= 0 && this.h2Streams[e] === id) {
        return this.h2Reqs[e]
      }
    }
    return -1
  }

  /**
   * Sends what `slot` holds, pushing each response's pending bytes while a
   * pass moves any, then re-arms it, or closes it once it is over.
   */
  private h2Settle(slot: i32): void {
    if (!this.h2Holds(slot)) {
      if (this.h2Open[slot]) {
        this.h2Forget(slot)
      }
      return
    }
    let wants: i32 = this.h2Flush(slot)
    for (let pass: i32 = 0; pass < 4096 && this.h2Holds(slot) && this.h2PushAll(slot); pass++) {
      wants = this.h2Flush(slot)
    }
    if (!this.h2Holds(slot)) {
      this.h2Forget(slot)
      return
    }
    if ((wants & TLS_RECORD_DONE) !== 0) {
      this.h2Close(slot)
      return
    }
    pollModify(
      this.loop,
      this.h2FdOf(slot),
      wants & (H1_WANT_READ | H1_WANT_WRITE),
      HTTP_SERVER_H2_BASE + slot
    )
  }

  /** Pushes every response `slot` is sending: whether any moved a byte or ended. */
  private h2PushAll(slot: i32): boolean {
    let moved: boolean = false
    const base: i32 = slot * this.perConnection2
    for (let e: i32 = base; e < base + this.perConnection2; e++) {
      const at: i32 = this.h2Reqs[e]
      if (at >= 0 && this.moves(this.requests[at])) {
        moved = true
      }
    }
    return moved
  }

  /** Pushes `r` if it is sending: whether that moved a byte or handed it back. */
  private moves(r: HttpServerRequest): boolean {
    if (r.state !== HTTP_SERVER_STREAMING && r.state !== HTTP_SERVER_FLUSHING) {
      return false
    }
    const before: i32 = r.pendingEnd - r.pendingStart
    this.push(r)
    return r.state === HTTP_SERVER_FREE || r.pendingEnd - r.pendingStart < before
  }

  /** Closes `slot` and forgets it. */
  private h2Close(slot: i32): void {
    if (this.h2Clear[slot]) {
      this.h2cOf().close(slot - this.h2cBase)
    } else {
      this.h2Of().close(slot - this.h2TlsBase)
    }
    this.h2Forget(slot)
  }

  /**
   * The bookkeeping of a slot the carrier has closed: its generation moves
   * on, so what is owed for it is dropped, and the requests only the server
   * held go back.
   */
  private h2Forget(slot: i32): void {
    this.h2Open[slot] = false
    this.h2Gen[slot] = this.h2Gen[slot] + 1
    this.h2Count[slot] = 0
    const base: i32 = slot * this.perConnection2
    for (let e: i32 = base; e < base + this.perConnection2; e++) {
      const at: i32 = this.h2Reqs[e]
      this.h2Reqs[e] = -1
      if (at >= 0) {
        const r: HttpServerRequest = this.requests[at]
        r.entry = -1
        this.drop(r)
      }
    }
  }

  // ---- HTTP/3 ---------------------------------------------------------------------

  /** One turn of the HTTP/3 carrier: datagrams read, timers run, each connection with news served, and the output sent. */
  private h3Turn(h3: Http3Server, now: i64, key: Secret<u8[]>): void {
    const ms: i64 = now / HTTP_SERVER_NANOS_PER_MS
    h3.clock(now / toI64(1000))
    if (this.h3Readable) {
      let round: i32 = 0
      while (
        round < HTTP_SERVER_H3_ROUNDS &&
        (this.draining ? this.h3Drained(h3, ms, key) : h3.receive(ms, key)) > 0
      ) {
        round += 1
      }
    }
    h3.tick(ms)
    let slot: i32 = h3.ready()
    while (slot >= 0) {
      this.h3Serve(h3, slot)
      slot = h3.ready()
    }
    h3.flush(ms)
  }

  /**
   * `receive` for a draining server: the same reads, but only a datagram a
   * connection already owns goes on, so the drain starts no connection. An
   * Initial for a new one, and anything else no connection owns, is dropped.
   */
  private h3Drained(h3: Http3Server, ms: i64, key: Secret<u8[]>): i32 {
    if (toI32(this.h3Rx.length) === 0) {
      this.h3Rx = new Array<u8>(HTTP_SERVER_UDP_SIZE)
    }
    const rx: u8[] = this.h3Rx
    let count: i32 = 0
    for (let burst: i32 = 0; burst < H3_SERVER_RECEIVE_BURST; burst++) {
      const n: i32 = udpRecvFrom(
        this.h3Fd,
        rx,
        HTTP_SERVER_ZERO,
        HTTP_SERVER_UDP_SIZE,
        this.h3From,
        this.h3Meta
      )
      if (n < 0) {
        return count
      }
      const segment: i32 = this.h3Meta[0] > 0 ? this.h3Meta[0] : n
      let at: i32 = 0
      while (at < n) {
        const length: i32 = n - at < segment ? n - at : segment
        if (this.h3Owned(h3, rx, at, length)) {
          h3.datagram(rx, at, length, this.h3From, ms, key)
        }
        count += 1
        at += length
      }
    }
    return count
  }

  /** Whether a connection of `h3` owns the datagram `buf[at .. at + len)`, by its first packet's Destination Connection ID, read as `Http3Server.datagram` reads it. */
  private h3Owned(h3: Http3Server, buf: u8[], at: i32, len: i32): boolean {
    if (len < 1) {
      return false
    }
    let dcidAt: i32 = at + 1
    let dcidLength: i32 = QUIC_CONN_CID_LENGTH
    if ((toI32(buf[at]) & 0x80) !== 0) {
      if (len < 6) {
        return false
      }
      dcidLength = toI32(buf[at + 5])
      dcidAt = at + 6
    }
    if (dcidLength > QUIC_MAX_CID_LENGTH || dcidAt + dcidLength > at + len) {
      return false
    }
    return h3.index.find(buf, dcidAt, dcidLength) >= 0
  }

  /** Serves `slot`'s HTTP/3 events, then pushes its responses. */
  private h3Serve(h3: Http3Server, slot: i32): void {
    const conn: Http3Connection = h3.connection(slot)
    if (this.h3Gen[slot] !== conn.generation) {
      this.h3Clear(slot, conn.generation)
    }
    let event: i32 = conn.next()
    while (event !== H3_NEED_MORE && event !== H3_ERROR) {
      this.h3Event(slot, conn, event)
      event = conn.next()
    }
    if (event === H3_ERROR || !h3.holds(slot)) {
      this.h3Clear(slot, conn.generation)
      return
    }
    const base: i32 = slot * this.perConnection3
    for (let e: i32 = base; e < base + this.perConnection3; e++) {
      const at: i32 = this.h3Reqs[e]
      if (at >= 0) {
        this.moves(this.requests[at])
      }
    }
  }

  /** One HTTP/3 event of `slot`'s connection. */
  private h3Event(slot: i32, conn: Http3Connection, event: i32): void {
    const id: i64 = conn.stream
    if (event === H3_REQUEST) {
      const f: HttpFields = conn.fields
      const status: i32 = this.screen(f)
      if (status > 0) {
        this.h3Direct(conn, id, status)
        return
      }
      const e: i32 = this.h3Entry(slot)
      const at: i32 = e >= 0 ? this.obtain() : -1
      if (at < 0) {
        conn.reset(id, H3_REQUEST_REJECTED)
        return
      }
      const r: HttpServerRequest = this.requests[at]
      this.fromFields(r, f)
      r.kind = HTTP_SERVER_H3
      r.version = 3
      r.secure = true
      r.stream = id
      r.slot = slot
      r.gen = conn.generation
      r.entry = e
      this.h3Streams[e] = id
      this.h3Reqs[e] = at
      this.h3Count[slot] = this.h3Count[slot] + 1
      this.admit(r)
      return
    }
    const at: i32 = this.h3Find(slot, id)
    if (at < 0) {
      return
    }
    const r: HttpServerRequest = this.requests[at]
    if (event === H3_DATA) {
      if (r.state !== HTTP_SERVER_READING) {
        return
      }
      if (r.bodyLength + conn.dataLength > this.maxBody) {
        this.release(r)
        this.h3Direct(conn, id, HTTP_SERVER_TOO_LARGE)
        return
      }
      this.append(r, conn.data, conn.dataStart, conn.dataLength)
    } else if (event === H3_END) {
      if (r.state === HTTP_SERVER_READING) {
        this.enqueue(r)
      }
    } else if (event === H3_RESET) {
      // A request still read, or flushed after its answer, is the server's
      // alone; one queued or the program's goes back when it is answered.
      this.drop(r)
      this.unlink(r)
    }
  }

  /**
   * Answers stream `id` with `status` and no body and stops reading the
   * rest of its request (RFC 9114 §4.1.1); resets it when there is no room
   * for the answer.
   */
  private h3Direct(conn: Http3Connection, id: i64, status: i32): void {
    if (conn.respond(id, status, this.noFields, this.noFields, true) !== 0) {
      conn.reset(id, H3_INTERNAL_ERROR)
    } else {
      conn.discardRequest(id, H3_NO_ERROR)
    }
  }

  /** A free entry of `slot`'s stream table, or -1 when it is full. */
  private h3Entry(slot: i32): i32 {
    const base: i32 = slot * this.perConnection3
    for (let e: i32 = base; e < base + this.perConnection3; e++) {
      if (this.h3Reqs[e] === -1) {
        return e
      }
    }
    return -1
  }

  /** The request `slot` holds for stream `id`, or -1. */
  private h3Find(slot: i32, id: i64): i32 {
    const base: i32 = slot * this.perConnection3
    for (let e: i32 = base; e < base + this.perConnection3; e++) {
      if (this.h3Reqs[e] >= 0 && this.h3Streams[e] === id) {
        return this.h3Reqs[e]
      }
    }
    return -1
  }

  /**
   * Forgets `slot`'s stream table, its connection gone or restarted as
   * generation `gen`: the requests only the server held go back.
   */
  private h3Clear(slot: i32, gen: i32): void {
    const base: i32 = slot * this.perConnection3
    for (let e: i32 = base; e < base + this.perConnection3; e++) {
      const at: i32 = this.h3Reqs[e]
      this.h3Reqs[e] = -1
      if (at >= 0) {
        const r: HttpServerRequest = this.requests[at]
        r.entry = -1
        this.drop(r)
      }
    }
    this.h3Count[slot] = 0
    this.h3Gen[slot] = gen
  }

  // ---- Timeouts -------------------------------------------------------------------

  /**
   * Once a second: a body slower than `bodyTimeout` is cut off (its HTTP/1.1
   * connection closed, its stream reset), an HTTP/2 connection with no
   * stream for `idleTimeout` is closed, and stream tables of connections
   * the carriers dropped are forgotten.
   */
  private expireAll(now: i64): void {
    const h1: Http1Server | null = this.h1
    if (h1 !== null) {
      for (let s: i32 = 0; s < toI32(this.h1Current.length); s++) {
        const at: i32 = this.h1Current[s]
        if (at >= 0 && this.late(this.requests[at], now) && h1.holds(s)) {
          this.h1Close(h1, s)
        }
      }
    }
    const h2c: Http2CleartextServer | null = this.h2c
    if (h2c !== null) {
      // Closes each connection past `prefaceTimeout` with no preface; the
      // loop below forgets it.
      h2c.expire(now)
    }
    for (let v: i32 = 0; v < toI32(this.h2Open.length); v++) {
      if (this.h2Open[v]) {
        this.h2Expire(v, now)
      }
    }
    const h3: Http3Server | null = this.h3
    if (h3 !== null) {
      for (let s: i32 = 0; s < toI32(this.h3Count.length); s++) {
        if (this.h3Count[s] > 0) {
          this.h3Expire(h3, s, now)
        }
      }
    }
  }

  /** Whether `r` is still reading its body past `bodyTimeout`. */
  private late(r: HttpServerRequest, now: i64): boolean {
    return r.state === HTTP_SERVER_READING && now - r.since > this.bodyTimeout
  }

  /** `expireAll` for HTTP/2 slot `s`. */
  private h2Expire(s: i32, now: i64): void {
    if (!this.h2Holds(s)) {
      this.h2Forget(s)
      return
    }
    if (this.h2Clear[s] && !this.h2cOf().prefaced(s - this.h2cBase)) {
      // `prefaceTimeout` holds it till then; `idleTimeout` runs from the preface.
      this.h2IdleSince[s] = now
      return
    }
    const conn: Http2Connection = this.h2Conn(s)
    const base: i32 = s * this.perConnection2
    for (let e: i32 = base; e < base + this.perConnection2; e++) {
      const at: i32 = this.h2Reqs[e]
      if (at >= 0 && this.late(this.requests[at], now)) {
        const sent: i32 = conn.reset(this.h2Streams[e], H2_CANCEL)
        this.release(this.requests[at])
        if (sent === H2_AGAIN) {
          // No room to send the reset: end the connection, as `abort` does.
          this.h2Close(s)
          return
        }
      }
    }
    if (this.h2Count[s] === 0 && this.h2IdleSince[s] > 0 && now - this.h2IdleSince[s] > this.idleTimeout) {
      this.h2Close(s)
      return
    }
    this.h2Settle(s)
  }

  /** `expireAll` for HTTP/3 slot `s`. */
  private h3Expire(h3: Http3Server, s: i32, now: i64): void {
    if (!h3.holds(s) || h3.connection(s).generation !== this.h3Gen[s]) {
      this.h3Clear(s, h3.holds(s) ? h3.connection(s).generation : this.h3Gen[s])
      return
    }
    const conn: Http3Connection = h3.connection(s)
    const base: i32 = s * this.perConnection3
    for (let e: i32 = base; e < base + this.perConnection3; e++) {
      const at: i32 = this.h3Reqs[e]
      if (at >= 0 && this.late(this.requests[at], now)) {
        conn.reset(this.h3Streams[e], H3_REQUEST_CANCELLED)
        this.release(this.requests[at])
        h3.touch(s)
      }
    }
  }
}
