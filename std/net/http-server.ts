/**
 * `nish/net/http-server` — one handler for HTTP/1.1 and HTTP/2 (each over TLS
 * or cleartext) and HTTP/3, with Alt-Svc advertising the HTTP/3 port.
 *
 * `HttpServer` is `HttpHandler`'s pull loop (`nish/net/handler`) over up to
 * five listeners at once. The program builds a `Router`, configures the
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
 * `limits.maxBody`, past which the request is answered 413 on every version,
 * except on an HTTP/2 route marked by `streamBody`, whose body comes in pieces.
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

import { copyBytes, tryCopyBytes } from "nish/bytes"
import { JsonWriter } from "nish/json"
import {
  HANDLER_ABSENT,
  HANDLER_ANSWERED,
  HANDLER_DROPPED,
  HANDLER_MAX_ADDED,
  HANDLER_MAX_WATCHED,
  HANDLER_NEXT,
  HANDLER_SENT,
} from "nish/net/handler"
import {
  HTTP_FIELDS_OK,
  HttpFields,
  httpFieldBytes,
  httpFieldIs,
  httpFieldsCheckOutgoing,
} from "nish/net/http-fields"
import { HTTP1_CHUNKED, HTTP1_NO_BODY, http1HexValue } from "nish/net/http1-codec"
import {
  H1_AGAIN,
  H1_ALPN,
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
  Http1TlsServer,
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
import { netRead } from "nish:net"
import { Secret } from "nish:secret"

/** The base `digits` writes a content-length in, and the byte of its digit 0. */
const HTTP_SERVER_TEN: i32 = 10
const HTTP_SERVER_ZERO_DIGIT: i32 = 48

/** The status a body past `maxBody` is answered with. */
const HTTP_SERVER_TOO_LARGE: i32 = 413
/** The status a request gets when no request record is free. */
const HTTP_SERVER_UNAVAILABLE: i32 = 503

// A request's life: free, reading its body, whole but parked behind a full output, queued for `take`,
// held by the program, streaming its response, and flushing the response's last bytes.
const HTTP_SERVER_FREE: i32 = 0
const HTTP_SERVER_READING: i32 = 1
const HTTP_SERVER_PARKED: i32 = 2
const HTTP_SERVER_QUEUED: i32 = 3
const HTTP_SERVER_HELD: i32 = 4
const HTTP_SERVER_STREAMING: i32 = 5
const HTTP_SERVER_FLUSHING: i32 = 6
/** `checkParam`'s `end` for a parameter's start offset (an i32 under `--number-mode f64`). */
const HTTP_SERVER_PARAM_START: i32 = 0
/** `checkParam`'s `end` for a parameter's end offset. */
const HTTP_SERVER_PARAM_END: i32 = 1
/** `spanAt`'s `part` for a field value's start offset. */
const HTTP_SERVER_VALUE_START: i32 = 2
/** `spanAt`'s `part` for a field value's end offset. */
const HTTP_SERVER_VALUE_END: i32 = 3

// Which carrier a request came in on.
const HTTP_SERVER_H1: i32 = 1
const HTTP_SERVER_H2: i32 = 2
const HTTP_SERVER_H3: i32 = 3
// Poll tokens: an HTTP/1.1 slot is its `h1Slots` index, an HTTP/2 slot is past `HTTP_SERVER_H2_BASE`,
// a watched descriptor is `-2 - id`, and a listener's token less -100 is its entry in `restUntil`.
const HTTP_SERVER_H1_LISTENER: i32 = -100
const HTTP_SERVER_H2_LISTENER: i32 = -101
const HTTP_SERVER_H3_SOCKET: i32 = -102
const HTTP_SERVER_H2C_LISTENER: i32 = -103
const HTTP_SERVER_H1_TLS_LISTENER: i32 = -104
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
  /**
   * The trailer field names `trailers` was given: the program's own array, held until the stream ends.
   * @internal Read by `HttpServer` in this module once the body's last pending byte is with the carrier.
   */
  trailerNames: u8[][]
  /**
   * The trailer field values `trailers` was given, `trailerValues[k]` for `trailerNames[k]`.
   * @internal Read by `HttpServer` in this module beside `trailerNames`.
   */
  trailerValues: u8[][]
  /**
   * The names `field` added, kept by reference until the answer starts.
   * @internal Grown by `HttpServer.field` in this module, to at most `HANDLER_MAX_ADDED`, and kept for the requests after.
   */
  addedNames: u8[][]
  /**
   * The values `field` added, `addedValues[k]` for `addedNames[k]`.
   * @internal Grown beside `addedNames` by `HttpServer.field` in this module.
   */
  addedValues: u8[][]
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
  /**
   * Whether the body comes in pieces: an HTTP/2 request on a route `streamBody` marked, handed over at its
   * head. `body[0 .. bodyLength)` is then what arrived and `consume` has not taken yet.
   */
  streaming: boolean = false
  /** Whether the whole body has arrived: always true unless `streaming`, where END_STREAM or trailers set it. */
  bodyEnded: boolean = true
  /**
   * Whether the request is in the queue again for the program that holds it, to say a piece, the end or a reset came.
   * @internal Set by `HttpServer` in this module for a streaming request, and cleared by `take` or when it goes back.
   */
  again: boolean = false
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
  /**
   * The steps `before` has still to hand out, one bit each; loaded from the router by the first `before`.
   * @internal Moved only by `HttpServer.before` in this module.
   */
  stepsLeft: i32 = 0
  /**
   * The steps `before` handed out that `after` has still to hand out again.
   * @internal Moved by `HttpServer.before` and `after` in this module.
   */
  stepsRan: i32 = 0
  /**
   * How many fields `field` added: `addedNames[0 .. added)` beside `addedValues`.
   * @internal Counted by `HttpServer.field` in this module, read by `start`, and cleared when a request is read into it.
   */
  added: i32 = 0
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
   * Whether `trailers` ended the response, so its stream ends with `trailerNames` and `trailerValues`, not an empty DATA frame.
   * @internal Set by `HttpServer.trailers` in this module on HTTP/2, and cleared when a request is read into it.
   */
  trailing: boolean = false
  /**
   * Whether `before` has loaded the route's steps into `stepsLeft`.
   * @internal Set by `HttpServer.before` and cleared when a request is read into it, in this module.
   */
  stepped: boolean = false

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
    this.trailerNames = []
    this.trailerValues = []
    this.addedNames = []
    this.addedValues = []
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
    return this.checkParam(k, HTTP_SERVER_PARAM_START)
  }

  /**
   * Where parameter `k` ends in `head`.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the byte offset in `head` just past the parameter's last raw byte
   */
  paramEnd(k: i32): i32 {
    return this.checkParam(k, HTTP_SERVER_PARAM_END)
  }

  /**
   * Whether parameter `k`, raw, is exactly `text`.
   * @param k the parameter's position in the route pattern, from 0
   * @param text the value to compare with, as it would appear still percent-encoded
   * @returns true when the raw parameter bytes are exactly `text`
   */
  paramIs(k: i32, text: string): boolean {
    return httpServerSpanIs(
      this.head,
      this.checkParam(k, HTTP_SERVER_PARAM_START),
      this.checkParam(k, HTTP_SERVER_PARAM_END),
      text
    )
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
    return routerDecode(
      this.head,
      this.checkParam(k, HTTP_SERVER_PARAM_START),
      this.checkParam(k, HTTP_SERVER_PARAM_END),
      out
    )
  }

  /**
   * Parameter `k` read as a decimal number that is not negative and fits an `i32`, or -1.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the number the parameter's digits spell, or -1 when it is empty, holds a non-digit or overflows
   */
  paramDecimal(k: i32): i32 {
    return httpServerDecimal(
      this.head,
      this.checkParam(k, HTTP_SERVER_PARAM_START),
      this.checkParam(k, HTTP_SERVER_PARAM_END)
    )
  }

  /**
   * Parameter `k`'s start (`end` 0) or end (`end` 1) offset in `head`.
   * Panics on a parameter the route does not have. `params` holds two
   * entries for each of the router's parameters, so the bound on its length
   * never refuses a `k` below `paramCount`.
   */
  private checkParam(k: i32, end: i32): i32 {
    const params: i32[] = this.params
    const wide: i64 = toI64(k) * toI64(2) + toI64(end)
    const at: i32 = wide < toI64(0) || wide >= toI64(params.length) ? -1 : toI32(wide)
    if (k < 0 || k >= this.paramCount || at < 0 || at >= toI32(params.length)) {
      panic(`HttpServerRequest.param: the route has ${this.paramCount} parameter(s), not one at ${k}`)
    }
    return params[at]
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
    const head: u8[] = this.head
    // Each scan below also stops at the end of `head`, so `end` needs no clamp.
    const end: i32 = this.targetEnd
    const from: i32 = this.pathEnd
    if (from >= end) {
      return -1
    }
    let at: i32 = from < 0 ? 0 : from + 1
    while (at >= 0 && at < end) {
      let pairEnd: i32 = at
      while (pairEnd < end && pairEnd < toI32(head.length) && toI32(head[pairEnd]) !== 38) {
        pairEnd += 1
      }
      let keyEnd: i32 = at
      while (keyEnd < pairEnd && keyEnd < toI32(head.length) && toI32(head[keyEnd]) !== 61) {
        keyEnd += 1
      }
      if (httpServerFormIs(head, at, keyEnd, name)) {
        this.queryValueStart = keyEnd < pairEnd ? keyEnd + 1 : pairEnd
        this.queryValueEnd = pairEnd
        return at
      }
      if (pairEnd >= end) {
        break
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
    const count: i32 = this.headerCount
    // `spans` holds four entries per field, so `k` never stops the loop before `count` does.
    let k: i32 = 0
    for (let i: i32 = 0; i < count && k >= 0 && k < toI32(this.spans.length) - 3; i++) {
      if (httpServerSpanIs(this.head, this.spans[k], this.spans[k + 1], name)) {
        return i
      }
      k += 4
    }
    return HANDLER_ABSENT
  }

  /**
   * Where field `i`'s value starts in `head`, or -1 when the request holds no field `i`.
   * @param i a field index, as `header` answered it
   * @returns the byte offset in `head` of the value's first byte, or -1 for an index `header` cannot answer
   */
  valueStart(i: i32): i32 {
    return this.spanAt(i, HTTP_SERVER_VALUE_START)
  }

  /**
   * Where field `i`'s value ends in `head`, or -1 when the request holds no field `i`.
   * @param i a field index, as `header` answered it
   * @returns the byte offset in `head` just past the value's last byte, or -1 for an index `header` cannot answer
   */
  valueEnd(i: i32): i32 {
    return this.spanAt(i, HTTP_SERVER_VALUE_END)
  }

  /** Entry `part` of field `i`'s four in `spans`, or -1 past the fields the request holds. */
  private spanAt(i: i32, part: i32): i32 {
    const wide: i64 = toI64(i) * toI64(4) + toI64(part)
    const at: i32 = wide < toI64(0) || wide >= toI64(this.spans.length) ? -1 : toI32(wide)
    if (i < 0 || i >= this.headerCount || at < 0 || at >= toI32(this.spans.length)) {
      return -1
    }
    return this.spans[at]
  }

  /**
   * Whether the first field named `name` (lowercase) has exactly the value `value`.
   * @param name the field name in lowercase
   * @param value the value to compare with, byte for byte and case-sensitive
   * @returns true when the field is present and its first occurrence has exactly that value
   */
  headerIs(name: string, value: string): boolean {
    const i: i32 = this.header(name)
    return (
      i >= 0 &&
      httpServerSpanIs(
        this.head,
        this.spanAt(i, HTTP_SERVER_VALUE_START),
        this.spanAt(i, HTTP_SERVER_VALUE_END),
        value
      )
    )
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

/**
 * A zeroed array of `n` elements, `zero` each. The first 65535 come from
 * one `new Array` whose `u16` length needs no runtime check; only a length
 * past that, which a large `jsonBytes` or `maxHead` gives, pushes the rest.
 * An `n` at or below 0 gives an empty array; one past `i32` stops there.
 *
 * @param n - the element count
 * @param zero - the value of each element
 * @returns the array
 */
const httpServerZeros = <T>(n: i64, zero: T): T[] => {
  let want: i32 = 2147483647
  if (n <= toI64(0)) {
    want = 0
  } else if (n < toI64(2147483647)) {
    want = toI32(n)
  }
  const head: i32 = want >= 65535 ? 65535 : want
  const out: T[] = new Array<T>(toU16(head))
  for (let k = head; k < want; k++) {
    out.push(zero)
  }
  return out
}

/**
 * `n` zeroed cells, clamped to 0 through 65535, in an array no one else holds.
 *
 * `spans` takes its array from here rather than from `httpServerZeros`: an
 * array a plain function returns from `new` is one `HttpServerRequest` can keep
 * boxed inside the object (`src/inline-arrays.ts`), which saves a header and a
 * load per field lookup.
 *
 * @param n - how many cells
 * @returns `n` zeros, or 65535 of them past that, or none below 0
 */
const httpServerCells = (n: i64): i32[] => new Array<i32>(httpServerU16(n))

/**
 * `n` clamped to 0 through 65535.
 *
 * @param n - the count to clamp
 * @returns `n` as a `u16`, 0 below 0 and 65535 above it
 */
const httpServerU16 = (n: i64): u16 => {
  if (n <= toI64(0)) {
    return toU16(0)
  }
  if (n >= toI64(65535)) {
    return toU16(65535)
  }
  return toU16(toI32(n))
}

/**
 * Cell `col` of row `row` in a table of rows `width` wide, as an index into
 * its `length` elements, or -1 when that cell lies outside them.
 *
 * @param row - the row
 * @param width - the elements per row
 * @param col - the column within the row
 * @param length - the table's element count
 * @returns the index, or -1
 */
const httpServerCell = (row: i32, width: i32, col: i32, length: i32): i32 => {
  const wide: i64 = toI64(row) * toI64(width) + toI64(col)
  return wide < toI64(0) || wide >= toI64(length) ? -1 : toI32(wide)
}

/**
 * The `monotonicNanos` instant `ns` nanoseconds after `at`. Worked in `u64`,
 * whose wrapping sum has the bits of the signed one: an instant is centuries
 * short of 2^63 and every delay a constant or a checked limit, so neither wraps.
 */
const httpServerAfter = (at: i64, ns: i64): i64 => toI64(toU64(at) + toU64(ns))

/** `until - now` in nanoseconds, worked in `u64` for the same reason as `httpServerAfter`. */
const httpServerLeft = (until: i64, now: i64): i64 => toI64(toU64(until) - toU64(now))

/**
 * Whether more than `ns` nanoseconds lie between the `monotonicNanos`
 * instants `since` and `now`; a `now` at or before `since` is no time at all.
 */
const httpServerPast = (now: i64, since: i64, ns: i64): boolean =>
  now > since && toU64(now) - toU64(since) > toU64(ns)

/** Whether `bytes[start .. end)` is exactly `text`. */
const httpServerSpanIs = (bytes: u8[], start: i32, end: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  const size: i32 = toI32(bytes.length)
  if (start < 0 || end > size || toI64(end) - toI64(start) !== toI64(n)) {
    return false
  }
  let j: i32 = 0
  for (let k: i32 = start; k < size && j < n; k++) {
    if (toI32(bytes[k]) !== toI32(text.charCodeAt(j))) {
      return false
    }
    j += 1
  }
  return j === n
}

/** `bytes[start .. end)` as a decimal number that is not negative and fits an `i32`, or -1. */
const httpServerDecimal = (bytes: u8[], start: i32, end: i32): i32 => {
  if (start < 0 || end <= start || toI64(end) - toI64(start) > toI64(10) || end > toI32(bytes.length)) {
    return -1
  }
  let n: i32 = 0
  for (let k: i32 = start; k < end && k < toI32(bytes.length); k++) {
    const digit: i32 = toI32(bytes[k]) - 48
    if (digit < 0 || digit > 9 || n < 0 || n > 214748364) {
      return -1
    }
    const next: i64 = toI64(n) * toI64(10) + toI64(digit)
    if (next > toI64(2147483647)) {
      return -1
    }
    n = toI32(next)
  }
  return n
}

/**
 * The byte the form encoding spells at `bytes[at ..)`, before `end`, and how
 * many bytes it took, packed as `byte | taken << 8`; -1 for a malformed escape.
 */
const httpServerFormByte = (bytes: u8[], at: i32, end: i32): i32 => {
  if (at < 0 || at >= toI32(bytes.length)) {
    return -1 // outside the bytes: nothing there to decode
  }
  const c: i32 = toI32(bytes[at])
  if (c === 43) {
    return 32 | HTTP_SERVER_TOOK_ONE
  }
  if (c !== 37) {
    return c | HTTP_SERVER_TOOK_ONE
  }
  if (at >= end - 2 || at >= toI32(bytes.length) - 2) {
    return -1
  }
  const hi: i32 = http1HexValue(toI32(bytes[at + 1]))
  const lo: i32 = http1HexValue(toI32(bytes[at + 2]))
  if (hi < 0 || lo < 0 || hi > 15 || lo > 15) {
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
    const took: i32 = packed >> 8
    if (
      packed < 0 ||
      k >= n ||
      (packed & 255) !== toI32(name.charCodeAt(k)) ||
      toI64(took) > toI64(end) - toI64(at)
    ) {
      return false
    }
    at = toI32(toI64(at) + toI64(took))
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
  // `queryIndex` found the span in the head, so this does not fire.
  if (start < 0 || end < start) {
    return ROUTER_BAD_ESCAPE
  }
  const length: i32 = percentDecode(
    bytes,
    start,
    toI32(toI64(end) - toI64(start)),
    out,
    HTTP_SERVER_ZERO,
    URL_DECODE_FORM | URL_DECODE_ALLOW_NUL
  )
  if (length === URL_DECODE_ERR_SPACE) {
    return ROUTER_NO_ROOM
  }
  return length < 0 ? ROUTER_BAD_ESCAPE : length
}

/** The generation after `gen`: it only has to differ from the last one, so it wraps to 0 past i32. */
const httpServerNextGen = (gen: i32): i32 => (gen < 2147483647 ? gen + 1 : 0)

/** Entry `at` of the per-slot table `xs`, or -1 outside it. */
const httpServerAt = (xs: i32[], at: i32): i32 => (at >= 0 && at < toI32(xs.length) ? xs[at] : -1)

/** Adds `by` to entry `at` of the per-slot count `xs` and gives the new count, or -1 outside the table or past i32. */
const httpServerAdd = (xs: i32[], at: i32, by: i32): i32 => {
  if (at < 0 || at >= toI32(xs.length)) {
    return -1
  }
  const next: i64 = toI64(xs[at]) + toI64(by)
  if (next < -2147483648 || next > 2147483647) {
    return -1
  }
  xs[at] = toI32(next)
  return toI32(next)
}

/** Panics unless `limits.<name>`, `value`, is within `low` to `high`. */
const httpServerLimit = (name: string, value: i32, low: i32, high: i32): void => {
  if (value < low || value > high) {
    panic(`HttpServer: limits.${name} ${value} is outside ${low} to ${high}`)
  }
}

// The HTTP/2 connection preface (RFC 9113 §3.4), which `listenHttp1`'s `h2c` reads a connection's first bytes against.
const HTTP_SERVER_H2C_PREFACE: string = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"
const HTTP_SERVER_H2C_PREFACE_SIZE: i32 = 24

/**
 * Feeds `conn` the `[off, end)` of `buf` that an h2c sniff read ahead, behind
 * the window's range test, spelled so the prover reads it: the sniff stops at
 * its head's 24 bytes, so the test always holds. -1 should it ever fail.
 */
const httpServerFeedHead = (conn: Http1Connection, buf: u8[], off: i32, end: i32): i32 => {
  if (off >= 0 && off <= end && end <= toI32(buf.length)) {
    return conn.feed(buf, off, end - off)
  }
  return toI32(-1)
}

/**
 * One HTTP/1.1 slot's bookkeeping beside the carrier's connection in it: the
 * slot number, its carrier, its generation, its request, and whether it is
 * open, waits for a free request or is being driven. `listenHttp1` and
 * `listenHttp1Tls` make one per carrier slot.
 */
class HttpServerH1Slot {
  /** The request the slot is reading or answering, null for none. */
  current: HttpServerRequest | null = null
  /** The slot's first bytes while `sniff`: 24 on a listener that takes h2c peers, none on any other. */
  head: u8[] = []
  /** When the slot was accepted, in `monotonicNanos`: while `sniff`, its `prefaceTimeout` starts here. */
  since: i64 = 0
  /** The slot's index in the server's `h1Slots`, which is also its poll token. */
  slot: i32
  /** The slot's number in its own carrier. */
  carrier: i32
  /** Its carrier's `outputSize`. */
  outputSize: i32
  /** The interest a TLS slot is armed for, which `h1Arm` compares against; the cleartext carrier keeps its own. */
  armed: i32 = 0
  /** Bumped each time the slot closes, so an answer still owed to the connection before is dropped; it wraps. */
  gen: i32 = 0
  /**
   * 0 while no `drive` of it runs, 1 while one does, 2 once a call inside it
   * (an answer screened while it reads) asked for another pass. The nested
   * call only marks it, so the depth stays one however many screened
   * requests one write pipelines.
   */
  driving: i32 = 0
  /** How many of `head` are read. */
  got: i32 = 0
  /** Whether the slot is on the TLS carrier (`listenHttp1Tls`) rather than the cleartext one. */
  tls: boolean
  /** Whether the carrier's connection in the slot is open. */
  open: boolean = false
  /** Whether it stopped reading for want of a free request and waits on `starved`. */
  starved: boolean = false
  /**
   * Whether the slot is on a listener that takes h2c peers and has not yet
   * read the byte that decides (`listenHttp1`'s `h2c`): `head` holds what it
   * has read of the preface so far.
   */
  sniff: boolean = false

  constructor(slot: i32, tls: boolean, carrier: i32, outputSize: i32) {
    this.slot = slot
    this.tls = tls
    this.carrier = carrier
    this.outputSize = outputSize
  }
}

/**
 * One handler for HTTP/1.1 (cleartext and over TLS), HTTP/2 (over TLS and
 * cleartext) and HTTP/3: configure up to one listener of each kind, then
 * loop on `waitSigned` (or `wait`), `ready` and `take`, answering each
 * request with `send`, `json` and `sendJson`, `problem`, `refuse`, or
 * `start`, `write` and `end`.
 */
export class HttpServer {
  private router: Router
  /** Every request of the pool, made up front, and the free ones. */
  private requests: HttpServerRequest[]
  private free: HttpServerRequest[]
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

  // HTTP/1.1: the two carriers, and a record per slot of either. Cleartext
  // slot `s` is record `h1Base + s`, TLS slot `s` is record `h1TlsBase + s`.
  private h1: Http1Server | null = null
  private h1Tls: Http1TlsServer | null = null
  private h1Base: i32 = 0
  private h1TlsBase: i32 = 0
  /** Per listener (`-100 - token`): when its rest for want of descriptors ends, 0 while it is not resting. */
  private restUntil: i64[]
  private h1Slots: HttpServerH1Slot[]
  /** Slots that stopped reading for want of a free request, in the order they did. */
  private starved: HttpServerH1Slot[]

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
  /** Which routes take their body in pieces, by route index, and how many do. */
  private streamRoutes: boolean[]
  private streamCount: i32 = 0
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
  /** The HTTP/1.1 over TLS listener, -1 until `listenHttp1Tls`. */
  private h1TlsFd: i32 = -1
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
   * yet: add them with `listenHttp1`, `listenHttp1Tls`, `listenH2c`,
   * `listenHttp2Tls` and `listenHttp3`.
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
      const r: HttpServerRequest = new HttpServerRequest(k)
      this.requests.push(r)
      this.free.push(r)
    }
    this.queue = httpServerZeros(toI64(limits.requests), toI32(0))
    this.streamRoutes = []
    this.readyFds = httpServerZeros(toI64(2) * toI64(limits.maxEvents), toI32(0))
    this.watchedFired = new Array<boolean>(HANDLER_MAX_WATCHED)
    this.scratch = httpServerZeros(toI64(limits.jsonBytes), toU8(0))
    this.writer = new JsonWriter(this.scratch, HTTP_SERVER_ZERO)
    this.probe = httpServerZeros(toI64(2) * toI64(router.maxParams) + toI64(2), toI32(0))
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
      this.digitBufs.push(httpServerZeros(toI64(d), toU8(0)))
    }
    this.altSvcName = httpFieldBytes("alt-svc")
    this.altNames = [this.altSvcName]
    const altValues: u8[][] = [this.altSvcName]
    this.altValues = altValues
    if (this.altSvcMaxAge === 0) {
      this.altSvc = httpFieldBytes("clear")
      const clear: u8[] = httpFieldBytes("clear")
      if (toI32(altValues.length) > 0) {
        altValues[0] = clear
      }
    }
    this.contentLengthName = httpFieldBytes("content-length")
    this.hostName = httpFieldBytes("host")
    this.outNames = []
    this.outValues = []
    this.h1Slots = []
    this.starved = []
    this.restUntil = new Array<i64>(5)
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
   * to `slots` connections. Panics on a second cleartext HTTP/1.1 listener,
   * when `config` would let in a head past `limits.maxHead` (its `maxTarget`,
   * its `maxHeaderBytes` and 44 bytes of request line) or more fields than
   * `limits.maxFields`, or when `slots`, with the TLS listener's if it came
   * first, pass 1048576. `config.maxBody` is set to `limits.maxBody`.
   *
   * With `h2c`, the listener also takes cleartext HTTP/2 peers by prior
   * knowledge: each connection's first bytes are read, up to 24, against the
   * HTTP/2 preface. One whose 24 bytes are the preface is served as h2c
   * with `h2c`'s caps, as `listenH2c` serves it (up to `slots` such
   * connections, beside the HTTP/1.1 ones); one whose first byte to differ
   * comes sooner, or that ends first, is served as HTTP/1.1, with what was
   * read as the start of its input. One that sends part of the preface and
   * then nothing is closed `limits.prefaceTimeout` after it was accepted.
   * There is no `Upgrade: h2c`. Without `h2c`, nothing is read ahead and
   * every connection is HTTP/1.1. Panics also, with `h2c`, as `listenH2c`
   * does on its `config` and `slots`, and when an h2c listener is already
   * configured.
   * @param fd the listening socket's descriptor, still the program's to close
   * @param config the carrier's caps and timeouts, kept by the carrier
   * @param slots the most connections held at once
   * @param h2c the h2c carrier's caps, to take h2c peers on this listener; null, the default, for none
   */
  listenHttp1(fd: i32, config: Http1Config, slots: i32, h2c: Http2Config | null = null): void {
    if (this.h1Fd >= 0) {
      panic("HttpServer.listenHttp1: an HTTP/1.1 listener is already configured")
    }
    this.checkHttp1("listenHttp1", config, slots)
    if (h2c !== null) {
      this.clearHttp2("listenHttp1", fd, h2c, slots)
    }
    this.h1 = new Http1Server(config, fd, slots)
    this.h1Fd = fd
    this.h1Base = this.h1Grow(slots, false, config.outputSize)
    if (h2c !== null) {
      const table: HttpServerH1Slot[] = this.h1Slots
      for (let k: i32 = this.h1Base; k >= 0 && k < toI32(table.length); k++) {
        table[k].head = new Array<u8>(HTTP_SERVER_H2C_PREFACE_SIZE)
      }
    }
    pollAdd(this.loop, fd, H1_WANT_READ, HTTP_SERVER_H1_LISTENER)
  }

  /**
   * Serves HTTP/1.1 over TLS (ALPN `http/1.1`, or none) on `fd`, a listening
   * TCP socket the program made, with up to `slots` connections, on a port of
   * its own: a client that offers only another protocol is shut down, never
   * handed to the HTTP/2 listener. Its requests say `secure` true and its
   * responses carry Alt-Svc as HTTP/2 over TLS ones do. Panics as
   * `listenHttp1` does, on a second listener of this kind, or when `slots`,
   * with the cleartext listener's if it came first, pass 1048576.
   * `config.maxBody` is set to `limits.maxBody`. Serve it with `waitSigned`.
   * @param fd the listening socket's descriptor, still the program's to close
   * @param tls the certificate chain and TLS settings
   * @param config the carrier's caps and timeouts, kept by the carrier
   * @param slots the most connections held at once
   */
  listenHttp1Tls(fd: i32, tls: TlsServerConfig, config: Http1Config, slots: i32): void {
    if (this.h1TlsFd >= 0) {
      panic("HttpServer.listenHttp1Tls: an HTTP/1.1 over TLS listener is already configured")
    }
    this.checkHttp1("listenHttp1Tls", config, slots)
    this.h1Tls = new Http1TlsServer(tls, config, fd, slots)
    this.h1TlsFd = fd
    this.h1TlsBase = this.h1Grow(slots, true, config.outputSize)
    pollAdd(this.loop, fd, H1_WANT_READ, HTTP_SERVER_H1_TLS_LISTENER)
  }

  /**
   * Panics, naming `name`, when `config` would let in a head past
   * `limits.maxHead` or more fields than `limits.maxFields`, on fewer than
   * one slot, or on more than the HTTP/1.1 tokens hold; then sets
   * `config.maxBody` to `limits.maxBody`.
   */
  private checkHttp1(name: string, config: Http1Config, slots: i32): void {
    const head: i64 = toI64(config.maxTarget) + toI64(config.maxHeaderBytes) + HTTP_SERVER_H1_LINE_OVERHEAD
    if (head > toI64(this.maxHead)) {
      panic(
        `HttpServer.${name}: maxTarget ${config.maxTarget} + maxHeaderBytes ${config.maxHeaderBytes} + 44 is more than limits.maxHead ${this.maxHead}`
      )
    }
    if (config.maxHeaders > this.maxFields) {
      panic(
        `HttpServer.${name}: maxHeaders ${config.maxHeaders} is more than limits.maxFields ${this.maxFields}`
      )
    }
    if (slots < 1) {
      panic(`HttpServer.${name}: slots ${slots} is below 1`)
    }
    // A slot's record index is its poll token, which must stay below the HTTP/2 tokens.
    if (toI64(toI32(this.h1Slots.length)) + toI64(slots) > toI64(HTTP_SERVER_H2_BASE)) {
      panic(
        `HttpServer.${name}: slots ${slots} and the ${this.h1Slots.length} HTTP/1.1 slots listened before are more than 1048576`
      )
    }
    config.maxBody = this.maxBody
  }

  /** Appends a record for each of a new carrier's `slots` and answers the index of its first. */
  private h1Grow(slots: i32, tls: boolean, outputSize: i32): i32 {
    const table: HttpServerH1Slot[] = this.h1Slots
    const base: i32 = toI32(table.length)
    for (let s: i32 = 0; s < slots; s++) {
      table.push(new HttpServerH1Slot(toI32(table.length), tls, s, outputSize))
    }
    return base
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
    this.clearHttp2("listenH2c", fd, config, slots)
    this.h2cFd = fd
    pollAdd(this.loop, fd, H1_WANT_READ, HTTP_SERVER_H2C_LISTENER)
  }

  /**
   * The h2c carrier, on `fd` and with `slots` slots, for `listenH2c` or for
   * `listenHttp1`'s `h2c`: there is one at most, so a second panics.
   */
  private clearHttp2(name: string, fd: i32, config: Http2Config, slots: i32): void {
    if (this.h2c !== null) {
      panic(`HttpServer.${name}: an h2c listener is already configured`)
    }
    this.checkHttp2(name, config, slots)
    const base: i32 = this.h2Grow(slots, this.perOf(config))
    this.h2cBase = base
    const clear: boolean[] = this.h2Clear
    for (let v: i32 = base; v >= 0 && v < toI32(clear.length) && toI64(v) < toI64(base) + toI64(slots); v++) {
      clear[v] = true
    }
    this.h2c = new Http2CleartextServer(config, fd, slots, this.prefaceTimeout)
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
    const size: i64 = toI64(base) * toI64(width) + toI64(slots) * toI64(width)
    const streams: i32[] = httpServerZeros(size, toI32(0))
    const reqs: i32[] = httpServerZeros(size, toI32(-1))
    const oldStreams: i32[] = this.h2Streams
    const oldReqs: i32[] = this.h2Reqs
    for (let v: i32 = 0; v < base; v++) {
      for (let i: i32 = 0; i < was; i++) {
        const to: i32 = httpServerCell(v, width, i, toI32(streams.length))
        const from: i32 = httpServerCell(v, was, i, toI32(oldStreams.length))
        if (
          to >= 0 &&
          to < toI32(streams.length) &&
          to < toI32(reqs.length) &&
          from >= 0 &&
          from < toI32(oldStreams.length) &&
          from < toI32(oldReqs.length)
        ) {
          streams[to] = oldStreams[from]
          reqs[to] = oldReqs[from]
        }
      }
    }
    if (width !== was && was > 0) {
      for (let k: i32 = 0; k < toI32(this.requests.length); k++) {
        const r: HttpServerRequest = this.requests[k]
        if (r.kind === HTTP_SERVER_H2 && r.entry >= 0) {
          r.entry = httpServerCell(r.entry / was, width, r.entry % was, toI32(streams.length))
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
    this.h3Gen = httpServerZeros(toI64(slots), toI32(0))
    this.h3Count = httpServerZeros(toI64(slots), toI32(0))
    this.h3Streams = httpServerZeros(toI64(slots) * toI64(this.perConnection3), toI64(0))
    this.h3Reqs = httpServerZeros(toI64(slots) * toI64(this.perConnection3), toI32(0))
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
    const alt: u8[][] = this.altValues
    if (toI32(alt.length) > 0) {
      alt[0] = value
    }
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
    const fired: boolean[] = this.watchedFired
    return id >= 0 && id < toI32(fired.length) && fired[id]
  }

  /**
   * One turn of the loop for a server with no TLS or QUIC listener: as
   * `waitSigned`, with no key. It serves cleartext HTTP/1.1 and h2c
   * (`listenH2c`). Panics when an HTTP/1.1 or HTTP/2 over TLS or an HTTP/3
   * listener is configured, since a handshake there needs the key.
   * @param timeoutMs the longest to block, in milliseconds, or -1 to block until something is ready
   * @returns how many whole requests are queued for `take` after this turn
   */
  wait(timeoutMs: i32): i32 {
    if (this.h2Fd >= 0 || this.h1TlsFd >= 0 || this.h3 !== null) {
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
   * @param key the certificate's private key, P-256 or RSA as `signatureScheme` says; borrowed for the call, still the caller's to wipe
   * @returns how many whole requests are queued for `take` after this turn
   */
  waitSigned(timeoutMs: i32, key: Secret<u8[]>): i32 {
    return this.turnWith(timeoutMs, key)
  }

  /** `waitSigned`'s turn, with no key under `wait`, which serves no listener that reads one. */
  private turnWith(timeoutMs: i32, key: Secret<u8[]> | null): i32 {
    const fired: boolean[] = this.watchedFired
    const watched: i32 = toI32(fired.length)
    for (let id: i32 = 0; id < watched; id++) {
      fired[id] = false
    }
    // A starved slot driven here may read a head, so it reads the clock of now.
    this.turnAt = monotonicNanos()
    this.feedStarved()
    let now: i64 = monotonicNanos()
    let timeout: i32 = this.queueCount > 0 ? 0 : timeoutMs
    timeout = this.restListener(this.h1Fd, HTTP_SERVER_H1_LISTENER, now, timeout)
    timeout = this.restListener(this.h2Fd, HTTP_SERVER_H2_LISTENER, now, timeout)
    timeout = this.restListener(this.h2cFd, HTTP_SERVER_H2C_LISTENER, now, timeout)
    timeout = this.restListener(this.h1TlsFd, HTTP_SERVER_H1_TLS_LISTENER, now, timeout)
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
    const ready: i32[] = this.readyFds
    for (let k: i32 = 0; k < n; k++) {
      // `pollWait` fills at most `slots / 2` pairs.
      const at: i32 = toI32(toI64(2) * toI64(k))
      const after: i32 = toI32(toI64(2) * toI64(k) + toI64(1))
      if (at < 0 || at >= toI32(ready.length) || after < 0 || after >= toI32(ready.length)) {
        break
      }
      const token: i32 = ready[at]
      const events: i32 = ready[after]
      if (token === HTTP_SERVER_H1_LISTENER) {
        this.acceptHttp1()
      } else if (token === HTTP_SERVER_H2_LISTENER) {
        this.acceptHttp2()
      } else if (token === HTTP_SERVER_H2C_LISTENER) {
        this.acceptH2c()
      } else if (token === HTTP_SERVER_H1_TLS_LISTENER) {
        this.acceptHttp1Tls()
      } else if (token === HTTP_SERVER_H3_SOCKET) {
        this.h3Readable = true
      } else if (token <= -2 && token > HTTP_SERVER_H1_LISTENER) {
        const id: i32 = toI32(toI64(-2) - toI64(token))
        if (id >= 0 && id < toI32(fired.length)) {
          fired[id] = true
        }
      } else if (token >= HTTP_SERVER_H2_BASE) {
        this.h2Serve(toI32(toI64(token) - toI64(HTTP_SERVER_H2_BASE)), events, key)
      } else if (token >= 0) {
        this.h1Serve(token, events, key)
      }
    }
    if (h3 !== null && key !== null) {
      this.h3Turn(h3, now, key)
    }
    const h1: Http1Server | null = this.h1
    const h1Tls: Http1TlsServer | null = this.h1Tls
    // Both carriers expire before the one sweep that forgets what either closed.
    const closed: i32 = h1 !== null ? h1.expire(now) : 0
    const closedTls: i32 = h1Tls !== null ? h1Tls.expire(now) : 0
    if (closed > 0 || closedTls > 0) {
      this.h1Sweep()
    }
    this.feedStarved()
    if (now >= this.sweepAt) {
      this.sweepAt = httpServerAfter(now, HTTP_SERVER_SWEEP)
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
    const left: i64 = httpServerLeft(this.sweepAt, now)
    const ms: i64 = left / HTTP_SERVER_NANOS_PER_MS
    const whole: i32 = ms >= 0 && ms < 2147483647 ? toI32(ms) : 2147483646
    let cap: i32 = HTTP_SERVER_ZERO
    if (left > 0 && whole < 2147483647) {
      cap = whole + 1
    }
    return timeout < 0 || cap < timeout ? cap : timeout
  }

  /**
   * Puts a listener rested for want of descriptors back once its rest is
   * over, and answers `timeout` shortened to wake for that.
   */
  private restListener(fd: i32, token: i32, now: i64, timeout: i32): i32 {
    const rests: i64[] = this.restUntil
    const at: i32 = this.restAt(token)
    if (at < 0 || at >= toI32(rests.length)) {
      return timeout
    }
    const until: i64 = rests[at]
    if (until === 0 || fd < 0) {
      return timeout
    }
    if (now >= until) {
      rests[at] = 0
      if (!this.draining) {
        pollAdd(this.loop, fd, H1_WANT_READ, token)
      }
      return timeout
    }
    if (this.draining) {
      return timeout
    }
    const wait: i64 = httpServerLeft(until, now) / HTTP_SERVER_NANOS_PER_MS
    const ms: i32 = wait >= 0 && wait < 2147483647 ? toI32(wait) : 2147483646
    const rest: i32 = ms < 2147483647 ? ms + 1 : ms
    return timeout < 0 || rest < timeout ? rest : timeout
  }

  /** Where listener `token`'s deadline sits in `restUntil`, or -1 for a token that names no listener. */
  private restAt(token: i32): i32 {
    const at: i64 = toI64(HTTP_SERVER_H1_LISTENER) - toI64(token)
    return at >= 0 && at < toI64(this.restUntil.length) ? toI32(at) : -1
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
    this.unlisten(this.h1TlsFd, HTTP_SERVER_H1_TLS_LISTENER)
    for (const s of this.h1Slots) {
      const conn: Http1Connection | null = s.open ? this.h1Conn(s) : null
      if (conn !== null && this.h1Holds(s)) {
        if (s.tls && s.current === null && !conn.wantsWrite()) {
          // TLS may still hold sealed records: `settle` closes once they are sent.
          this.settle(s, conn)
        } else if (s.current === null && (this.h1Resting(s) || !conn.wantsWrite())) {
          this.h1Close(s)
        } else {
          conn.closeAfter = true
        }
      }
    }
    for (let v: i32 = 0; v < toI32(this.h2Open.length); v++) {
      if (this.h2Open[v] && this.h2Holds(v)) {
        const conn: Http2Connection | null = this.h2Prefaced(v)
        if (conn === null) {
          // No preface yet, so no connection to say GOAWAY on.
          this.h2Close(v)
        } else {
          conn.goaway()
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
    const rests: i64[] = this.restUntil
    const at: i32 = this.restAt(token)
    if (fd >= 0 && at >= 0 && at < toI32(rests.length) && rests[at] === 0) {
      pollRemove(this.loop, fd)
    }
  }

  /**
   * How many connections are open, of every version.
   * @returns the connections the carriers hold, which falls to 0 after `drain` as they finish
   */
  connections(): i32 {
    const h1: Http1Server | null = this.h1
    const h1Tls: Http1TlsServer | null = this.h1Tls
    const h2: Http2TlsServer | null = this.h2
    const h2c: Http2CleartextServer | null = this.h2c
    const h3: Http3Server | null = this.h3
    const one: i32 = h1 !== null ? h1.busy() : 0
    const oneTls: i32 = h1Tls !== null ? h1Tls.busy() : 0
    const two: i32 = h2 !== null ? h2.busy() : 0
    const clear: i32 = h2c !== null ? h2c.busy() : 0
    const three: i32 = h3 !== null ? h3.busy() : 0
    // Each carrier's count is an `i32`; their sum saturates rather than wraps.
    const n: i64 = toI64(one) + toI64(oneTls) + toI64(two) + (toI64(clear) + toI64(three))
    return n > toI64(2147483647) ? 2147483647 : toI32(n)
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
        const s: HttpServerH1Slot | null = this.h1Record(this.h1Base, slot)
        if (s === null) {
          // `listenHttp1` makes a record for every carrier slot, so a slot
          // without one is no connection the server can serve: it is
          // closed, never left open and unwatched.
          h1.close(slot)
        } else {
          this.h1Opened(s, h1.fd(slot))
        }
      }
      slot = h1.accept()
    }
    if (slot !== HTTP_SERVER_ACCEPT_NONE) {
      // Out of descriptors or memory: the connection stays in the backlog
      // and the listener stays readable, so rest it rather than spin.
      this.rest(this.h1Fd, HTTP_SERVER_H1_LISTENER)
    }
  }

  /** Takes every waiting HTTP/1.1 over TLS connection, each handshake with a fresh random and key share. */
  private acceptHttp1Tls(): void {
    const h1Tls: Http1TlsServer | null = this.h1Tls
    if (h1Tls === null || this.draining) {
      return
    }
    while (true) {
      crypto.getRandomValues(this.rnd)
      crypto.getRandomValues(this.keyBuf)
      const slot: i32 = h1Tls.accept(this.rnd, this.keyBuf)
      if (slot >= 0) {
        const s: HttpServerH1Slot | null = this.h1Record(this.h1TlsBase, slot)
        if (s === null) {
          // As in `acceptHttp1`: a carrier slot without a record is closed.
          h1Tls.close(slot)
        } else {
          this.h1Opened(s, h1Tls.fd(slot))
        }
      } else if (slot === HTTP_SERVER_ACCEPT_NONE) {
        return
      } else if (slot !== TLS_TCP_POOL_FULL && slot !== HTTP_SERVER_ACCEPT_ABORTED) {
        // Out of descriptors or memory: rest the listener, as `acceptHttp1` does.
        this.rest(this.h1TlsFd, HTTP_SERVER_H1_TLS_LISTENER)
        return
      }
    }
  }

  /** The record of carrier slot `slot` on the carrier whose records start at `base`, or null past the table. */
  private h1Record(base: i32, slot: i32): HttpServerH1Slot | null {
    const v: i64 = toI64(base) + toI64(slot)
    return this.h1Slot(v <= toI64(2147483647) ? toI32(v) : toI32(-1))
  }

  /** A slot its carrier has just accepted on `fd`: open, with no request, and watched for reading. */
  private h1Opened(s: HttpServerH1Slot, fd: i32): void {
    s.open = true
    s.current = null
    s.armed = H1_WANT_READ
    s.sniff = toI32(s.head.length) === HTTP_SERVER_H2C_PREFACE_SIZE
    s.got = 0
    s.since = this.turnAt
    pollAdd(this.loop, fd, H1_WANT_READ, s.slot)
  }

  /** A ready HTTP/1.1 socket: read or written, a TLS handshake signed with `key`, then driven. */
  private h1Serve(slot: i32, events: i32, key: Secret<u8[]> | null): void {
    const s: HttpServerH1Slot | null = this.h1Slot(slot)
    if (s === null || !this.h1Holds(s)) {
      return
    }
    const read: boolean = (events & HTTP_SERVER_READ_BITS) !== 0
    const h1Tls: Http1TlsServer | null = this.h1Tls
    if (s.tls && h1Tls !== null) {
      let wants: i32 = read ? h1Tls.readable(s.carrier) : h1Tls.writable(s.carrier)
      // A handshake signs once; the bound only stops a carrier that kept asking.
      for (
        let turn: i32 = 0;
        turn < 4 && key !== null && (wants & TLS_RECORD_SIGN) !== 0 && h1Tls.holds(s.carrier);
        turn++
      ) {
        wants = h1Tls.signP256(s.carrier, key)
      }
    } else {
      const h1: Http1Server | null = this.h1
      if (h1 !== null && s.sniff && !this.h1Sniff(s, h1)) {
        return
      }
      if (h1 !== null) {
        if (read) {
          h1.readable(s.carrier)
        } else {
          h1.writable(s.carrier)
        }
      }
    }
    this.drive(s)
  }

  /**
   * A ready socket on a listener that takes h2c peers, not yet decided:
   * reads into `s.head` up to the preface's 24 bytes. The first byte that
   * differs from the preface, the peer's end or a failed read gives the slot
   * to HTTP/1.1, with what was read as its first input; 24 that match move
   * the socket to the h2c carrier. Answers whether the slot is HTTP/1.1's
   * now, for `h1Serve` to read on; false while it waits for more, or once it
   * is h2c's or closed.
   */
  private h1Sniff(s: HttpServerH1Slot, h1: Http1Server): boolean {
    const fd: i32 = h1.fd(s.carrier)
    const head: u8[] = s.head
    const want: string = HTTP_SERVER_H2C_PREFACE
    let got: i32 = s.got
    while (got >= 0 && got < toI32(head.length)) {
      const n: i32 = netRead(fd, head, got, toI32(head.length) - got)
      if (n === HTTP_SERVER_ACCEPT_NONE) {
        return false
      }
      if (n <= 0) {
        // The peer's end or a failure: HTTP/1.1 reads it again and answers it as it does today.
        return this.h1Decided(s, h1)
      }
      // `netRead` answers at most the bytes it was asked for, so the unsigned sum is at most 24.
      const end: i32 = toI32(toU32(got) + toU32(n))
      for (let k: i32 = got; k < end && k < toI32(head.length) && k < toI32(want.length); k++) {
        if (toI32(head[k]) !== toI32(want.charCodeAt(k))) {
          s.got = end
          return this.h1Decided(s, h1)
        }
      }
      got = end
      s.got = end
    }
    this.h1ToH2c(s, h1)
    return false
  }

  /**
   * Slot `s` is HTTP/1.1's: what it read ahead is its connection's first
   * input, stamped as `readable` stamps what it reads. False, with the slot
   * closed, should the connection not take it all.
   */
  private h1Decided(s: HttpServerH1Slot, h1: Http1Server): boolean {
    s.sniff = false
    const head: u8[] = s.head
    const got: i32 = s.got
    if (got <= 0) {
      return true
    }
    const conn: Http1Connection = h1.connection(s.carrier)
    // A fresh connection has room for a head, past the 24 bytes this hands it.
    const taken: i32 = httpServerFeedHead(conn, head, toI32(0), got)
    conn.lastActive = this.turnAt
    conn.headArrived(this.turnAt)
    if (taken !== got) {
      this.h1Close(s)
      return false
    }
    return true
  }

  /**
   * Slot `s` read the whole preface: its socket leaves HTTP/1.1's loop and
   * carrier, unclosed, for the h2c carrier, which takes the 24 bytes as
   * `listenH2c`'s accept would have read them, and is served at once.
   */
  private h1ToH2c(s: HttpServerH1Slot, h1: Http1Server): void {
    s.sniff = false
    const h2c: Http2CleartextServer | null = this.h2c
    // `listenHttp1` makes the h2c carrier with the sniffing records, and an
    // unread slot is released, so neither close is reached; each keeps the socket owned.
    if (h2c === null) {
      this.h1Close(s)
      return
    }
    const freed: i32 = h1.release(s.carrier)
    if (freed < 0) {
      this.h1Close(s)
      return
    }
    pollRemove(this.loop, freed)
    this.h1Forget(s)
    const slot: i32 = h2c.adopt(freed, s.head)
    if (slot < 0) {
      return
    }
    const v: i64 = toI64(this.h2cBase) + toI64(slot)
    const at: i32 = v <= 2147483647 ? toI32(v) : toI32(-1)
    if (this.h2Opened(at, freed)) {
      this.h2Serve(at, H1_WANT_READ, null)
    } else {
      h2c.close(slot)
    }
  }

  /** Whether `s`'s carrier holds a connection in it. */
  private h1Holds(s: HttpServerH1Slot): boolean {
    if (s.tls) {
      const h1Tls: Http1TlsServer | null = this.h1Tls
      return h1Tls !== null && h1Tls.holds(s.carrier)
    }
    const h1: Http1Server | null = this.h1
    return h1 !== null && h1.holds(s.carrier)
  }

  /** The connection in `s`, which a TLS carrier shares while the slot has read nothing; null with no carrier. */
  private h1Conn(s: HttpServerH1Slot): Http1Connection | null {
    if (s.tls) {
      const h1Tls: Http1TlsServer | null = this.h1Tls
      return h1Tls !== null ? h1Tls.connection(s.carrier) : null
    }
    const h1: Http1Server | null = this.h1
    return h1 !== null ? h1.connection(s.carrier) : null
  }

  /**
   * `s`'s carrier's next event; `H1_ERROR` with no carrier, or for a TLS slot
   * whose handshake chose another protocol: the carrier's own `refused` reads
   * false once its shutdown has moved TLS past open, and would then hand on a
   * request the client sent after its Finished.
   */
  private h1Next(s: HttpServerH1Slot): i32 {
    if (s.tls) {
      const h1Tls: Http1TlsServer | null = this.h1Tls
      if (h1Tls === null) {
        return H1_ERROR
      }
      const chosen: string = h1Tls.alpn(s.carrier)
      return chosen === "" || chosen === H1_ALPN ? h1Tls.next(s.carrier) : H1_ERROR
    }
    const h1: Http1Server | null = this.h1
    return h1 !== null ? h1.next(s.carrier) : H1_ERROR
  }

  /** What `s`'s carrier sends now and the interest it answers; `H1_DONE` with no carrier. */
  private h1Flush(s: HttpServerH1Slot): i32 {
    if (s.tls) {
      const h1Tls: Http1TlsServer | null = this.h1Tls
      return h1Tls !== null ? h1Tls.flush(s.carrier) : H1_DONE
    }
    const h1: Http1Server | null = this.h1
    return h1 !== null ? h1.flush(s.carrier) : H1_DONE
  }

  /**
   * Whether TLS slot `s`, whose flush answered `wants`, still has sealed
   * records to send or is shutting down after `conn` ended: closing it now
   * would drop what `TlsTcpServer.close` cannot send in one attempt, so a
   * draining server waits for `H1_DONE`. Always false for a cleartext slot,
   * whose unsent bytes are `conn`'s own.
   */
  private h1Sealing(s: HttpServerH1Slot, conn: Http1Connection, wants: i32): boolean {
    return s.tls && ((wants & H1_WANT_WRITE) !== 0 || conn.isDone())
  }

  /** Whether `s` rests its buffers while idle; a TLS slot never does. */
  private h1Resting(s: HttpServerH1Slot): boolean {
    const h1: Http1Server | null = this.h1
    return !s.tls && h1 !== null && h1.resting(s.carrier)
  }

  /** Arms `s`'s socket for `wants`, unless it is armed for it already. */
  private h1Arm(s: HttpServerH1Slot, wants: i32): void {
    const interest: i32 = wants & (H1_WANT_READ | H1_WANT_WRITE)
    if (s.tls) {
      const h1Tls: Http1TlsServer | null = this.h1Tls
      if (h1Tls !== null && h1Tls.holds(s.carrier) && s.armed !== interest) {
        s.armed = interest
        pollModify(this.loop, h1Tls.fd(s.carrier), interest, s.slot)
      }
      return
    }
    const h1: Http1Server | null = this.h1
    if (h1 !== null && h1.rearm(s.carrier, wants)) {
      pollModify(this.loop, h1.fd(s.carrier), interest, s.slot)
    }
  }

  /**
   * Turns `slot`'s events into requests until it needs more input, then
   * settles it. A head with no free request left waits: the slot stops
   * reading and goes on `starved` until a request is handed back.
   */
  private drive(s: HttpServerH1Slot): void {
    if (s.driving !== 0) {
      s.driving = 2
      return
    }
    s.driving = 1
    this.drivePass(s)
    while (s.driving === 2 && s.open) {
      s.driving = 1
      this.drivePass(s)
    }
    s.driving = 0
  }

  /** `drive` for the slot request `r` was read on; nothing once that slot has no record, as `live` then says too. */
  private driveOf(r: HttpServerRequest): void {
    const s: HttpServerH1Slot | null = this.h1Slot(r.slot)
    if (s !== null) {
      this.drive(s)
    }
  }

  /** One pass of `drive`: the slot's events until it needs more input, then `settle`. */
  private drivePass(s: HttpServerH1Slot): void {
    const conn: Http1Connection | null = this.h1Conn(s)
    if (conn === null) {
      return
    }
    let event: i32 = H1_NEED_MORE
    if (!this.starve(s) && !this.unended(s)) {
      event = this.h1Next(s)
      while (event !== H1_NEED_MORE && event !== H1_ERROR) {
        // A TLS slot's connection is built by the read that brought its first plaintext.
        const live: Http1Connection | null = this.h1Conn(s)
        if (live === null) {
          break
        }
        if (event === H1_REQUEST) {
          this.begin(s, live)
        } else if (event === H1_BODY) {
          this.gather(s, live)
        } else if (event === H1_END) {
          this.whole(s, live)
        } else if (event === H1_WRITE) {
          this.resume(s, live)
        }
        if (this.starve(s) || this.unended(s)) {
          break
        }
        event = this.h1Next(s)
      }
    }
    if (event === H1_ERROR) {
      // The carrier has written its refusal and ends the connection; a
      // request it was reading is nobody's.
      this.releaseReading(s)
    }
    const after: Http1Connection | null = this.h1Conn(s)
    this.settle(s, after !== null ? after : conn)
  }

  /**
   * Whether `slot`'s response is under way with every byte handed over but
   * not yet ended. The carrier finishes a `Content-Length` response once its
   * last byte is written and would read the next request on the next `next`,
   * so the slot is not asked until the program's `end`: until then the
   * response is the program's, and a draining connection stays open for it.
   */
  private unended(s: HttpServerH1Slot): boolean {
    const r: HttpServerRequest | null = s.current
    if (r === null) {
      return false
    }
    return r.state === HTTP_SERVER_STREAMING && r.pendingEnd === r.pendingStart
  }

  /** Whether `s` must wait for a free request before it reads a head: it then joins `starved`. */
  private starve(s: HttpServerH1Slot): boolean {
    if (s.current !== null || toI32(this.free.length) > 0) {
      return false
    }
    if (!s.starved) {
      s.starved = true
      this.starved.push(s)
    }
    return true
  }

  /** Drives the starved slots again while requests are free. */
  private feedStarved(): void {
    const starved: HttpServerH1Slot[] = this.starved
    while (toI32(this.free.length) > 0) {
      const head: i32 = this.starvedHead
      if (head < 0 || head >= toI32(starved.length)) {
        break
      }
      const s: HttpServerH1Slot = starved[head]
      this.starvedHead = head + 1
      s.starved = false
      if (s.open && this.h1Holds(s)) {
        this.drive(s)
      }
    }
    // Drop the spent slots once they are half the list, so each is moved O(1) times.
    const spent: i32 = this.starvedHead
    const length: i32 = toI32(starved.length)
    if (spent > 0 && spent <= length && spent >= length - spent) {
      let j: i32 = 0
      for (let k: i32 = spent; k < toI32(starved.length) && j < toI32(starved.length); k++) {
        starved[j] = starved[k]
        j += 1
      }
      for (let k: i32 = 0; k < spent && toI32(starved.length) > 0; k++) {
        starved.pop()
      }
      this.starvedHead = 0
    }
  }

  /** Sends what `slot` holds and re-arms it, or closes it once it is over; enqueues a parked request once there is room. */
  private settle(s: HttpServerH1Slot, conn: Http1Connection): void {
    let wants: i32 = this.h1Flush(s)
    if ((wants & H1_DONE) !== 0) {
      this.h1Close(s)
      return
    }
    if (this.draining && s.current === null && !conn.wantsWrite() && !this.h1Sealing(s, conn, wants)) {
      this.h1Close(s)
      return
    }
    if (s.starved) {
      wants = wants & ~H1_WANT_READ
    }
    this.h1Arm(s, wants)
    const r: HttpServerRequest | null = s.current
    if (r !== null && r.state === HTTP_SERVER_PARKED && this.roomy(s, conn)) {
      this.h1Ready(r)
    }
  }

  /** Whether `conn`'s output holds at most half of slot `s`'s output size unsent, so a response head fits behind it. */
  private roomy(s: HttpServerH1Slot, conn: Http1Connection): boolean {
    return toI64(conn.outputEnd) - toI64(conn.outputStart) <= toI64(s.outputSize) / toI64(2)
  }

  /** A head: a free request, the head copied into it, and its route. */
  private begin(s: HttpServerH1Slot, conn: Http1Connection): void {
    if (this.draining) {
      // A head read during the drain is the connection's last.
      conn.closeAfter = true
    }
    const r: HttpServerRequest | null = this.obtain()
    if (r === null) {
      // `drivePass` asked `starve` first, so a request was free; were none,
      // the head is answered 503 and the connection ends, and the body
      // events after it find no request and are passed over.
      conn.closeAfter = true
      conn.respond(HTTP_SERVER_UNAVAILABLE, this.noFields, this.noFields, toI32(0))
      return
    }
    const p = conn.parser
    copyBytes(r.head, HTTP_SERVER_ZERO, p.head, HTTP_SERVER_ZERO, p.headLength)
    const from: i32[] = p.spans
    const into: i32[] = r.spans
    // Four spans per field. `listenHttp1` refuses a `maxHeaders` past
    // `maxFields`, the parser stops at `maxHeaders`, and `obtain` made
    // `into` 4 * `maxFields` long, so every span fits; a head that did not
    // is refused 431 whole rather than copied in part.
    const used: i64 = toI64(p.headerCount) * toI64(4)
    if (p.headerCount < 0 || used > toI64(toI32(from.length)) || used > toI64(toI32(into.length))) {
      this.free.push(r)
      conn.closeAfter = true
      conn.respond(toI32(431), this.noFields, this.noFields, toI32(0))
      return
    }
    // The length tests below only restate the refusal above for the prover,
    // which keeps no fact from it: they never end the copy early.
    const n: i32 = toI32(used)
    for (let k: i32 = 0; k < n && k < toI32(from.length) && k < toI32(into.length); k++) {
      into[k] = from[k]
    }
    r.headerCount = p.headerCount
    r.methodStart = p.methodStart
    r.methodEnd = p.methodEnd
    r.targetStart = p.targetStart
    r.targetEnd = p.targetEnd
    r.kind = HTTP_SERVER_H1
    r.version = 1
    r.secure = s.tls
    r.slot = s.slot
    r.gen = s.gen
    if (r.methodIs("CONNECT")) {
      // Its 501 ends the connection: the client may already be sending what
      // it meant for a tunnel.
      conn.closeAfter = true
    }
    this.admit(r, false)
    s.current = r
  }

  /** Body bytes: appended to the request's body, which the carrier's cap bounds. */
  private gather(s: HttpServerH1Slot, conn: Http1Connection): void {
    const r: HttpServerRequest | null = s.current
    if (r !== null) {
      this.append(r, conn.data, conn.dataStart, conn.dataLength)
    }
  }

  /** The request is whole: queued for `take`, or parked while the response before it is still mostly unsent. */
  private whole(s: HttpServerH1Slot, conn: Http1Connection): void {
    const r: HttpServerRequest | null = s.current
    if (r === null) {
      return
    }
    if (this.roomy(s, conn)) {
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
    const head: u8[] = r.head
    const target: i32 = r.targetStart
    const one: boolean = toI64(r.targetEnd) - toI64(target) === toI64(1)
    if (
      one &&
      target >= 0 &&
      target < toI32(head.length) &&
      toI32(head[target]) === 42 &&
      r.methodIs("OPTIONS")
    ) {
      return 204
    }
    return 0
  }

  /** `H1_WRITE`: the carrier has room again for the response under way. */
  private resume(s: HttpServerH1Slot, conn: Http1Connection): void {
    const r: HttpServerRequest | null = s.current
    if (r === null) {
      return
    }
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
    const left: i32 = toI32(toI64(r.pendingEnd) - toI64(r.pendingStart))
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
    const s: HttpServerH1Slot | null = this.h1Slot(r.slot)
    if (s !== null) {
      const held: HttpServerRequest | null = s.current
      if (held !== null && held.index === r.index) {
        s.current = null
      }
    }
    this.release(r)
  }

  /** Hands back the request `s` was reading when the carrier refused it. */
  private releaseReading(s: HttpServerH1Slot): void {
    const r: HttpServerRequest | null = s.current
    if (r !== null && r.state === HTTP_SERVER_READING) {
      s.current = null
      this.release(r)
    }
  }

  /**
   * Closes slot `s` and bumps its generation, so any answer still owed for it is
   * dropped. A request the server alone holds goes back now; one queued or
   * taken goes back when `ready` passes it or the program answers it.
   */
  private h1Close(s: HttpServerH1Slot): void {
    if (s.tls) {
      const h1Tls: Http1TlsServer | null = this.h1Tls
      if (h1Tls !== null) {
        h1Tls.close(s.carrier)
      }
    } else {
      const h1: Http1Server | null = this.h1
      if (h1 !== null) {
        h1.close(s.carrier)
      }
    }
    this.h1Forget(s)
  }

  /** The bookkeeping of a slot the carrier has closed. */
  private h1Forget(s: HttpServerH1Slot): void {
    s.open = false
    s.gen = httpServerNextGen(s.gen)
    const r: HttpServerRequest | null = s.current
    s.current = null
    if (r !== null) {
      this.drop(r)
    }
  }

  /** Every slot the carrier's `expire` closed. */
  private h1Sweep(): void {
    for (const s of this.h1Slots) {
      if (s.open && !this.h1Holds(s)) {
        this.h1Forget(s)
      }
    }
  }

  // ---- The pool -------------------------------------------------------------------

  /** A free request, its buffers made at their caps on first use; null when none is free. */
  private obtain(): HttpServerRequest | null {
    const free: HttpServerRequest[] = this.free
    const last: i32 = toI32(free.length) - 1
    if (last < 0) {
      return null
    }
    const r: HttpServerRequest = free[last]
    // `last` proved the index; the prover keeps no length fact past that
    // read, so the pop is guarded again rather than left a site.
    if (free.length > 0) {
      free.pop()
    }
    if (toI32(r.head.length) === 0) {
      r.head = httpServerZeros(toI64(this.maxHead), toU8(0))
      r.spans = httpServerCells(toI64(4) * toI64(this.maxFields))
      r.params = httpServerZeros(toI64(2) * toI64(this.router.maxParams) + toI64(2), toI32(0))
    }
    return r
  }

  /**
   * A head is in `r`: its path's end found, its reading state set and its
   * route matched. Its body buffer grows to the declared length unless
   * `mayStream` (an HTTP/2 request whose body is still to come) and its route
   * takes the body in pieces, which never hold more than a stream window.
   */
  private admit(r: HttpServerRequest, mayStream: boolean): void {
    const head: u8[] = r.head
    let pathEnd: i32 = r.targetStart
    while (
      pathEnd >= 0 &&
      pathEnd < r.targetEnd &&
      pathEnd < toI32(head.length) &&
      toI32(head[pathEnd]) !== 63
    ) {
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
    r.trailing = false
    r.streaming = false
    r.bodyEnded = true
    r.stepped = false
    r.added = 0
    this.route(r)
    const declared: i32 = this.declared(r)
    if (declared > toI32(r.body.length) && !(mayStream && this.streamsBody(r.route))) {
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
      const router: Router = this.router
      const get: i32 = router.methodIndex("GET")
      const starts: i32[] = router.methodStart
      const ends: i32[] = router.methodEnd
      if (get >= 0 && get < toI32(starts.length) && get < toI32(ends.length)) {
        const viaGet: i32 = router.match(
          router.methodBytes,
          starts[get],
          ends[get],
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
    // The caller's `maxBody` check keeps the sum inside an `i32`.
    const wide: i64 = toI64(r.bodyLength) + toI64(n)
    const need: i32 = wide > toI64(2147483647) ? 2147483647 : toI32(wide)
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
      // Doubling past i32 is past `tier` too, which the clamp below gives.
      let doubled: i32 = tier
      if (have < 1073741824) {
        doubled = have * 2
      }
      size = have < HTTP_SERVER_BODY_FIRST ? HTTP_SERVER_BODY_FIRST : doubled
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
    const head: u8[] = r.head
    const end: i32 = r.valueEnd(i)
    const ten: i64 = toI64(HTTP_SERVER_TEN)
    let n: i32 = 0
    for (let k: i32 = r.valueStart(i); k >= 0 && k < end && k < toI32(head.length); k++) {
      const d: i32 = toI32(head[k]) - HTTP_SERVER_ZERO_DIGIT
      if (d < 0 || d > 9 || toI64(n) > (toI64(this.maxBody) - toI64(d)) / ten) {
        return -1
      }
      n = toI32(toI64(n) * ten + toI64(d))
    }
    return n
  }

  /** Queues `r` for `take`. The ring holds every request, so it never fills. */
  private enqueue(r: HttpServerRequest): void {
    r.state = HTTP_SERVER_QUEUED
    this.queuePush(r.index)
  }

  /** Puts request `index` at the back of the ring; nothing when the ring is full, which it never is. */
  private queuePush(index: i32): void {
    const queue: i32[] = this.queue
    const size: i32 = toI32(queue.length)
    const count: i32 = this.queueCount
    const start: i32 = this.queueStart
    if (count < 0 || count >= size || start < 0 || start >= size) {
      return
    }
    // Both are below `size`, so one wrap brings the sum back into the ring.
    const sum: i64 = toI64(start) + toI64(count)
    const at: i32 = toI32(sum >= toI64(size) ? sum - toI64(size) : sum)
    if (at >= 0 && at < toI32(queue.length)) {
      queue[at] = index
      this.queueCount = count + 1
    }
  }

  /** The request at the front of the ring, or null when it is empty. */
  private queueFront(): HttpServerRequest | null {
    const queue: i32[] = this.queue
    const start: i32 = this.queueStart
    if (this.queueCount <= 0 || start < 0 || start >= toI32(queue.length)) {
      return null
    }
    return this.requestAt(queue[start])
  }

  /** Drops the front of the ring. */
  private queueShift(): void {
    const start: i32 = this.queueStart
    const count: i32 = this.queueCount
    if (count <= 0 || start < 0 || start >= toI32(this.queue.length)) {
      return
    }
    const after: i64 = toI64(start) + toI64(1)
    this.queueStart = after < toI64(toI32(this.queue.length)) ? toI32(after) : 0
    this.queueCount = count - 1
  }

  /** Hands `r` back to the pool, and frees its HTTP/2 or HTTP/3 stream entry. */
  private release(r: HttpServerRequest): void {
    if (r.state === HTTP_SERVER_FREE) {
      return
    }
    if (r.again) {
      this.unqueue(r)
    }
    if (r.streaming && !r.bodyEnded && this.live(r)) {
      // Answered before the body ended: the client may stop sending (RFC 9113 §8.1). With no room for
      // the reset the stream stays held, so the client's window, not this server, bounds what it sends.
      const conn: Http2Connection | null = this.h2Conn(r.slot)
      if (conn !== null) {
        conn.reset(toI32(r.stream), H2_NO_ERROR)
      }
    }
    this.unlink(r)
    r.state = HTTP_SERVER_FREE
    this.free.push(r)
  }

  /**
   * Queues held streaming request `r` again for the program, once until `take`
   * hands it over, to say a piece, the end of its body or a reset came. One
   * queued for the first time is already there, and one whose answer is
   * flushing is past caring.
   */
  private requeue(r: HttpServerRequest): void {
    if (r.again || (r.state !== HTTP_SERVER_HELD && r.state !== HTTP_SERVER_STREAMING)) {
      return
    }
    r.again = true
    this.queuePush(r.index)
  }

  /** Takes `r`'s second place out of the queue, closing the gap so the ring still holds each request at most once. */
  private unqueue(r: HttpServerRequest): void {
    r.again = false
    const queue: i32[] = this.queue
    let found: boolean = false
    let before: i32 = -1
    let at: i32 = this.queueStart
    for (let k: i32 = 0; k < this.queueCount && at >= 0 && at < toI32(queue.length); k++) {
      if (found && before >= 0 && before < toI32(queue.length)) {
        queue[before] = queue[at]
      } else if (queue[at] === r.index) {
        found = true
      }
      before = at
      const after: i64 = toI64(at) + toI64(1)
      at = after < toI64(toI32(queue.length)) ? toI32(after) : 0
    }
    const count: i32 = this.queueCount
    if (found && count > 0) {
      this.queueCount = count - 1
    }
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
    // A carrier takes at most what it was offered, so this never passes `pendingEnd`.
    const next: i64 = toI64(r.pendingStart) + toI64(n)
    if (next >= toI64(r.pendingEnd)) {
      r.pendingStart = 0
      r.pendingEnd = 0
    } else {
      r.pendingStart = toI32(next)
    }
  }

  /**
   * Appends bytes to `r`'s pending buffer, grown to
   * `min(2^30, max(needed, 2 × current))`; `write` has refused a remainder
   * past 2^30. False, with nothing kept, when the bytes still do not fit
   * or the window lies outside `buf`: `write` then cuts the response.
   */
  private keep(r: HttpServerRequest, buf: u8[], off: i32, len: i32): boolean {
    const live: i32 = toI32(toI64(r.pendingEnd) - toI64(r.pendingStart))
    if (toI64(r.pending.length) - toI64(r.pendingEnd) < toI64(len)) {
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
    const end: i64 = toI64(r.pendingEnd) + toI64(len)
    if (end > toI64(r.pending.length) || !tryCopyBytes(r.pending, r.pendingEnd, buf, off, len)) {
      return false
    }
    r.pendingEnd = toI32(end)
    return true
  }

  // ---- Requests -------------------------------------------------------------------

  /**
   * Whether a request is waiting for `take`: a whole one, the head of a
   * `streaming` one, or a streaming one the program holds coming back with
   * a piece, its end or a reset. Requests whose connection or stream closed
   * while first queued are handed back here, unseen.
   * @returns true when `take` will give out a request
   */
  ready(): boolean {
    return this.next() !== null
  }

  /** The request `take` gives out next, after handing back the ones queued unseen, or null for none. */
  private next(): HttpServerRequest | null {
    while (this.queueCount > 0) {
      const r: HttpServerRequest | null = this.queueFront()
      if (r === null) {
        // Not a request: skip it.
        this.queueShift()
        continue
      }
      // A streaming request queued again is the program's, live or not: it learns of a reset by taking it.
      // One whose answer ended since (`end`, `trailers`) is flushing on its own, and stays out of `take`.
      const held: boolean = r.state === HTTP_SERVER_HELD || r.state === HTTP_SERVER_STREAMING
      if ((r.again && held) || (!r.again && this.live(r))) {
        return r
      }
      this.queueShift()
      if (r.again) {
        r.again = false
      } else {
        this.release(r)
      }
    }
    return null
  }

  /**
   * The next request, of any version, which the program now owes an answer;
   * a `streaming` request it already holds comes out again each time more
   * of its body, its end or a reset arrives, at most once per wait. Panics
   * when none is `ready`.
   * @returns the oldest queued request, the program's until it answers it
   */
  take(): HttpServerRequest {
    const r: HttpServerRequest | null = this.next()
    if (r === null) {
      panic("HttpServer.take: no request is ready")
    }
    this.queueShift()
    if (r.again) {
      r.again = false
    } else {
      r.state = HTTP_SERVER_HELD
    }
    return r
  }

  /**
   * Marks `route` as taking its request body in pieces on the HTTP/2
   * listeners: such a request comes out of `take` at its head, with
   * `streaming` set, and again whenever a piece, the end of the body or a
   * reset arrives. The program reads `body` up to `bodyLength`, hands bytes
   * back with `consume`, and only then does the peer get window to send
   * more. HTTP/1.1 and HTTP/3 requests to `route` keep the whole body, up to
   * `maxBody`. Panics when `route` is not one of the router's.
   * @param route a route index the server's router gave out
   */
  streamBody(route: i32): void {
    this.router.paramCount(route)
    while (toI32(this.streamRoutes.length) <= route) {
      this.streamRoutes.push(false)
    }
    const routes: boolean[] = this.streamRoutes
    const count: i32 = this.streamCount
    if (route >= 0 && route < toI32(routes.length) && !routes[route]) {
      routes[route] = true
      // One per route, and a router has far fewer than two billion.
      if (count < 2147483647) {
        this.streamCount = count + 1
      }
    }
  }

  /** Whether `route` takes its body in pieces. */
  private streamsBody(route: i32): boolean {
    return route >= 0 && route < toI32(this.streamRoutes.length) && this.streamRoutes[route]
  }

  /**
   * Hands the first `n` bytes of `r`'s body back: what follows moves to the
   * front of `body` and `bodyLength` drops by `n`. For a `streaming` request
   * the peer is credited `n` bytes of window, so it may send that much more.
   * Panics when `r` is another server's, is not the program's, or `n` is
   * negative or past `bodyLength`.
   * @param r a request the program holds
   * @param n how many bytes from the front of `body` the program is done with
   */
  consume(r: HttpServerRequest, n: i32): void {
    this.own(r, "consume")
    if (r.state !== HTTP_SERVER_HELD && r.state !== HTTP_SERVER_STREAMING) {
      panic("HttpServer.consume: the request is not the program's")
    }
    const length: i32 = r.bodyLength
    if (n < 0 || n > length) {
      panic(`HttpServer.consume: ${n} bytes is outside the body's ${length}`)
    }
    const left: i32 = toI32(toI64(length) - toI64(n))
    copyBytes(r.body, HTTP_SERVER_ZERO, r.body, n, left)
    r.bodyLength = left
    if (r.streaming && n > 0 && this.live(r)) {
      const conn: Http2Connection | null = this.h2Conn(r.slot)
      if (conn !== null) {
        conn.consumeBody(toI32(r.stream), n)
      }
      this.h2Settle(r.slot)
    }
  }

  /**
   * How many bytes of `r`'s response are written but not yet sent, so a
   * program streaming an answer can wait for them to drain.
   * @param r one of this server's requests
   * @returns the response bytes the server still holds for `r`
   */
  pending(r: HttpServerRequest): i32 {
    this.own(r, "pending")
    return toI32(toI64(r.pendingEnd) - toI64(r.pendingStart))
  }

  /**
   * The next step to run before `r`'s route body, lowest id first, or
   * `HANDLER_NEXT` once every step `Router.use` bound to `r.route` has run,
   * or `HANDLER_ANSWERED` once a step has answered `r`; the same on every
   * version. A step reads `r`, and may answer it — `refuse`, `problem`,
   * `empty` or any other answer — or add answer fields with `field`; call
   * `before` again straight after each step, before the next `take`, until it
   * answers a negative code. Only a request `take` handed over runs steps: the
   * answers the server sends itself run none. Panics on another server's request.
   *
   *     let s = server.before(req)
   *     while (s >= 0) { switch (s) { case AUTH: ... } s = server.before(req) }
   *     if (s === HANDLER_NEXT) { switch (req.route) { ... } }
   *
   * @param r a request `take` handed over
   * @returns the next step's id, `HANDLER_NEXT`, or `HANDLER_ANSWERED`
   */
  before(r: HttpServerRequest): i32 {
    this.own(r, "before")
    if (r.state !== HTTP_SERVER_HELD) {
      return HANDLER_ANSWERED
    }
    if (!r.stepped) {
      r.stepped = true
      r.stepsLeft = this.router.steps(r.route)
      r.stepsRan = 0
    }
    const left: i32 = r.stepsLeft
    if (left === 0) {
      return HANDLER_NEXT
    }
    const low: i32 = toI32(toI64(left) & (toI64(0) - toI64(left)))
    r.stepsLeft = left ^ low
    r.stepsRan = r.stepsRan | low
    return toI32(31) - toI32(Math.clz32(toU32(low)))
  }

  /**
   * The next step to run after `r`'s route body has chosen its answer and
   * before it sends it: the steps `before` handed out, highest id first, then
   * `HANDLER_NEXT`; or `HANDLER_ANSWERED` once a step has answered `r`. A
   * step here may still `field` or answer in the body's place. A request
   * `before` was never called for runs no step here. Panics on another
   * server's request.
   * @param r a request `take` handed over, not yet answered
   * @returns the next step's id, `HANDLER_NEXT`, or `HANDLER_ANSWERED`
   */
  after(r: HttpServerRequest): i32 {
    this.own(r, "after")
    if (r.state !== HTTP_SERVER_HELD) {
      return HANDLER_ANSWERED
    }
    const ran: i32 = r.stepped ? r.stepsRan : 0
    if (ran === 0) {
      return HANDLER_NEXT
    }
    const step: i32 = toI32(31) - toI32(Math.clz32(toU32(ran)))
    r.stepsRan = ran ^ (1 << step)
    return step
  }

  /**
   * Adds the field `name: value` to `r`'s answer, after the fields the answer
   * names itself, whichever answer it is and on every version; the added
   * fields count against `maxResponseFields`. Both are kept by reference, so
   * they stay the caller's bytes, unchanged, until the answer starts. Panics
   * past `HANDLER_MAX_ADDED` fields, on a request not held, or on another
   * server's request; a name or value a carrier refuses panics as the
   * answer's own would.
   * @param r a request `take` handed over, not yet answered
   * @param name the field name, a lowercase token
   * @param value the field value, field text
   */
  field(r: HttpServerRequest, name: u8[], value: u8[]): void {
    this.own(r, "field")
    if (r.state !== HTTP_SERVER_HELD) {
      panic(`HttpServer.field: the request is not one taken and unanswered (state ${r.state})`)
    }
    const at: i32 = r.added
    if (at >= HANDLER_MAX_ADDED) {
      panic(`HttpServer.field: more than ${HANDLER_MAX_ADDED} fields added to one answer`)
    }
    const names: u8[][] = r.addedNames
    const values: u8[][] = r.addedValues
    if (at >= 0 && at < toI32(names.length) && at < toI32(values.length)) {
      names[at] = name
      values[at] = value
    } else {
      r.addedNames.push(name)
      r.addedValues.push(value)
    }
    r.added = at + 1
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
      const conn: Http2Connection | null = this.h2Conn(r.slot)
      return conn === null || conn.inputEnded
    }
    const conn: Http1Connection | null = this.h1ConnOf(r)
    return r.kind === HTTP_SERVER_H1 && conn !== null && conn.ended()
  }

  /** Panics, naming `who`, unless `r` is one of this server's own requests. */
  private own(r: HttpServerRequest, who: string): void {
    const index: i32 = r.index
    if (index < 0 || index >= toI32(this.requests.length) || this.requests[index] !== r) {
      panic(`HttpServer.${who}: the request is another server's`)
    }
  }

  /** The connection of the HTTP/1.1 slot request `r` was read on, or null when that slot has no record or no carrier. */
  private h1ConnOf(r: HttpServerRequest): Http1Connection | null {
    const s: HttpServerH1Slot | null = this.h1Slot(r.slot)
    return s !== null ? this.h1Conn(s) : null
  }

  /** HTTP/1.1 slot `slot`'s record, or null for a number outside the table the HTTP/1.1 listeners made one per carrier slot. */
  private h1Slot(slot: i32): HttpServerH1Slot | null {
    const slots: HttpServerH1Slot[] = this.h1Slots
    return slot >= 0 && slot < toI32(slots.length) ? slots[slot] : null
  }

  /** Request `at` of the pool, or null for -1 or any other number outside it. */
  private requestAt(at: i32): HttpServerRequest | null {
    const requests: HttpServerRequest[] = this.requests
    return at >= 0 && at < toI32(requests.length) ? requests[at] : null
  }

  /** Whether `r`'s connection is the one it was read on, still open, and its stream not reset. */
  private live(r: HttpServerRequest): boolean {
    if (r.kind === HTTP_SERVER_H1) {
      const s: HttpServerH1Slot | null = this.h1Slot(r.slot)
      return s !== null && this.h1Holds(s) && s.gen === r.gen
    }
    if (r.hung) {
      return false
    }
    if (r.kind === HTTP_SERVER_H2) {
      return this.h2Holds(r.slot) && httpServerAt(this.h2Gen, r.slot) === r.gen
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
      const reqs: i32[] = this.h2Reqs
      if (e < toI32(reqs.length) && reqs[e] === r.index && httpServerAt(this.h2Gen, r.slot) === r.gen) {
        reqs[e] = -1
        if (httpServerAdd(this.h2Count, r.slot, -1) === 0) {
          this.h2Idle(r.slot, this.turnAt)
        }
      }
    } else if (r.kind === HTTP_SERVER_H3) {
      const reqs: i32[] = this.h3Reqs
      if (e < toI32(reqs.length) && reqs[e] === r.index && httpServerAt(this.h3Gen, r.slot) === r.gen) {
        reqs[e] = -1
        httpServerAdd(this.h3Count, r.slot, -1)
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
      const conn: Http1Connection | null = this.h1ConnOf(r)
      if (conn === null) {
        return HANDLER_DROPPED // `live` holds no HTTP/1.1 request without its slot's carrier
      }
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
    let sent: i32 = -1
    if (r.kind === HTTP_SERVER_H2) {
      const conn: Http2Connection | null = this.h2Conn(r.slot)
      if (conn !== null) {
        sent = conn.respond(toI32(r.stream), status, this.outNames, this.outValues, endNow)
      }
      if (sent === H2_INVALID) {
        panic(
          "HttpServer.start: the HTTP/2 carrier refused the head: a name that is not a lowercase token, a reserved field, or a value that is not field text"
        )
      }
    } else {
      const h3: Http3Server | null = this.h3
      if (h3 !== null) {
        sent = h3.connection(r.slot).respond(r.stream, status, this.outNames, this.outValues, endNow)
      }
      if (sent === H3_INVALID) {
        panic(
          "HttpServer.start: the HTTP/3 carrier refused the head: a name that is not a lowercase token, a reserved field, or a value that is not field text"
        )
      }
    }
    if (sent !== 0) {
      // Closed under it, out of room, a head past the peer's limit, or no carrier.
      this.abort(r)
      return HANDLER_DROPPED
    }
    r.ended = endNow
    this.nudge(r)
    return HANDLER_SENT
  }

  /**
   * Gathers the response's fields into `outNames` and `outValues`: the
   * program's, then those `field` added, then Alt-Svc and content-length
   * where they are owed and neither the program nor a step gave one. False
   * when that is more than `maxResponseFields`.
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
      !this.hasField(names, given, this.altSvcName) &&
      !this.hasField(r.addedNames, r.added, this.altSvcName)
    const addLength: boolean =
      r.kind !== HTTP_SERVER_H1 &&
      !r.quiet &&
      bodyLength >= 0 &&
      !this.hasField(names, given, this.contentLengthName) &&
      !this.hasField(r.addedNames, r.added, this.contentLengthName)
    const added: i32 = r.added
    const wide: i64 = toI64(given) + toI64(added) + toI64(addAlt ? 1 : 0) + toI64(addLength ? 1 : 0)
    if (wide > toI64(this.maxResponseFields)) {
      return false
    }
    const count: i32 = toI32(wide)
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
    const namesBy: u8[][][] = this.outNamesBy
    const valuesBy: u8[][][] = this.outValuesBy
    // The loop above made both tables longer than `count`.
    if (count < 0 || count >= toI32(namesBy.length) || count >= toI32(valuesBy.length)) {
      return false
    }
    const outN: u8[][] = namesBy[count]
    const outV: u8[][] = valuesBy[count]
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
    // Every slot below is under `count`, which fits: it was compared with `maxResponseFields`.
    const addedNames: u8[][] = r.addedNames
    const addedValues: u8[][] = r.addedValues
    for (let k: i32 = 0; k < added && k < toI32(addedNames.length) && k < toI32(addedValues.length); k++) {
      const slot: i32 = toI32(toI64(given) + toI64(k))
      if (slot >= 0 && slot < toI32(outN.length) && slot < toI32(outV.length)) {
        outN[slot] = addedNames[k]
        outV[slot] = addedValues[k]
      }
    }
    let at: i32 = toI32(toI64(given) + toI64(added))
    if (altSvc !== null && addAlt) {
      if (at >= 0 && at < toI32(outN.length) && at < toI32(outV.length)) {
        outN[at] = this.altSvcName
        outV[at] = altSvc
      }
      at = toI32(toI64(at) + toI64(1))
    }
    if (addLength) {
      const length: u8[] = this.digits(bodyLength)
      if (at >= 0 && at < toI32(outN.length) && at < toI32(outV.length)) {
        outN[at] = this.contentLengthName
        outV[at] = length
      }
    }
    this.outNames = outN
    this.outValues = outV
    return true
  }

  /** Whether `names[0 .. count)` holds `name`, in any case. */
  private hasField(names: u8[][], count: i32, name: u8[]): boolean {
    for (let k: i32 = 0; k < count && k < toI32(names.length); k++) {
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
    // An i32 has at most ten digits.
    while (rest >= 10 && count < 10) {
      rest = rest / 10
      count += 1
    }
    // The constructor gives every count from 0 to 10 its buffer.
    const bufs: u8[][] = this.digitBufs
    const out: u8[] = count < toI32(bufs.length) ? bufs[count] : new Array<u8>(toU16(count))
    rest = n
    for (let k: i32 = count - 1; k >= 0 && k < toI32(out.length); k--) {
      out[k] = toU8(toI64(HTTP_SERVER_ZERO_DIGIT) + toI64(rest % 10))
      rest = rest / 10
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
      const s: HttpServerH1Slot | null = this.h1Slot(r.slot)
      if (s !== null && this.live(r)) {
        this.h1Close(s)
      }
      return
    }
    if (r.kind === HTTP_SERVER_H2) {
      if (this.h2Holds(r.slot) && httpServerAt(this.h2Gen, r.slot) === r.gen) {
        const conn: Http2Connection | null = this.h2Conn(r.slot)
        if (conn === null || conn.reset(toI32(r.stream), H2_INTERNAL_ERROR) === H2_AGAIN) {
          // No room even for the reset: the connection is past saving.
          this.h2Close(r.slot)
          return
        }
        this.h2Settle(r.slot)
      }
      return
    }
    const h3: Http3Server | null = this.h3
    if (h3 !== null && h3.holds(r.slot) && h3.connection(r.slot).generation === r.gen) {
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
    if (toI64(r.pendingEnd) - toI64(r.pendingStart) + toI64(len) > toI64(HTTP_SERVER_MAX_BODY)) {
      // A remainder past 2^30, the longest array the runtime grows to:
      // nothing of it is written, and the response is cut.
      this.abort(r)
      return HANDLER_DROPPED
    }
    // Both are at least 0 here, so the difference fits.
    if (r.left >= 0) {
      r.left = toI32(toI64(r.left) - toI64(len))
    }
    let taken: i32 = 0
    if (r.pendingEnd === r.pendingStart) {
      taken = this.carry(r, buf, off, len, false)
      if (taken < 0) {
        this.abort(r)
        return HANDLER_DROPPED
      }
    }
    // `carry` took at most `len`, and `off + len` is within `buf`.
    if (
      taken < len &&
      !this.keep(r, buf, toI32(toI64(off) + toI64(taken)), toI32(toI64(len) - toI64(taken)))
    ) {
      this.abort(r)
      return HANDLER_DROPPED
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
    let taken: i32 = -1
    if (r.kind === HTTP_SERVER_H1) {
      // `write` keeps `len` within what the head declared, so the carrier
      // refuses only a closed connection here.
      const conn: Http1Connection | null = this.h1ConnOf(r)
      if (conn !== null) {
        taken = conn.write(buf, off, len)
      }
      if (taken === H1_AGAIN) {
        return 0
      }
    } else if (r.kind === HTTP_SERVER_H2) {
      const conn: Http2Connection | null = this.h2Conn(r.slot)
      if (conn !== null) {
        taken = conn.writeData(toI32(r.stream), buf, off, len, last)
      }
      if (taken === H2_AGAIN) {
        return 0
      }
    } else {
      const h3: Http3Server | null = this.h3
      if (h3 !== null) {
        taken = h3.connection(r.slot).writeData(r.stream, buf, off, len, last)
      }
      if (taken === H3_AGAIN) {
        return 0
      }
    }
    return taken < 0 ? -1 : taken
  }

  /** After the program wrote to `r`: what the carrier holds is sent now on HTTP/1.1 and HTTP/2, and by the turn's flush on HTTP/3. */
  private nudge(r: HttpServerRequest): void {
    const h3: Http3Server | null = this.h3
    if (r.kind === HTTP_SERVER_H1) {
      this.driveOf(r)
    } else if (r.kind === HTTP_SERVER_H2) {
      if (this.h2Holds(r.slot)) {
        this.h2Settle(r.slot)
      }
    } else if (h3 !== null && h3.holds(r.slot)) {
      h3.touch(r.slot)
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
    const conn: Http1Connection | null = r.kind === HTTP_SERVER_H1 ? this.h1ConnOf(r) : null
    if (!this.live(r) || (r.kind === HTTP_SERVER_H1 && conn === null)) {
      this.release(r)
      return HANDLER_DROPPED
    }
    if (r.left > 0 && !r.quiet) {
      panic(`HttpServer.end: the body is ${r.left} byte(s) short of the length the response declared`)
    }
    if (r.kind === HTTP_SERVER_H1 && conn !== null) {
      this.finishH1(r, conn)
      this.driveOf(r)
      return HANDLER_SENT
    }
    r.state = HTTP_SERVER_FLUSHING
    this.push(r)
    this.nudge(r)
    return HANDLER_SENT
  }

  /**
   * Ends `r`'s HTTP/2 response with a trailer section, the fields
   * `names[k]`: `values[k]`, in place of `end`: one HEADERS frame with
   * END_STREAM after the body (RFC 9113 §8.1), sent once the body's last
   * byte is with the carrier. `r` is the server's again once they are sent.
   * The arrays are read until then, not copied: arrays that stay as they
   * are, or ones kept per request (by `r.index`), which `take` hands out
   * again only after the trailers went. An answer that ends with trailers
   * starts with a body length above 0 or `HTTP1_CHUNKED`, since a head
   * declaring 0 has ended the stream; on a HEAD request, a 204 or a 304 the
   * head ended it too, and the trailers are dropped as body bytes are.
   * Panics on another server's request, when the response is not started,
   * on HTTP/1.1 or HTTP/3 (neither carrier sends trailers through the
   * façade), on a head that declared a body length of 0, on a body short of
   * the declared length, or on fields the carrier refuses (a name that is
   * not a lowercase token, a value that is not field text, a
   * connection-specific field, or names and values of different lengths).
   * @param r a request whose response `start` began on HTTP/2; the server's again once the trailers are sent
   * @param names the trailer field names, lowercase, as bytes beside `values`; read until the trailers are sent
   * @param values each trailer field's value, `values[k]` for `names[k]`; read until the trailers are sent
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection or
   *   stream closed first, or there are more fields than
   *   `limits.maxResponseFields` and the stream was reset for it
   */
  trailers(r: HttpServerRequest, names: u8[][], values: u8[][]): i32 {
    this.own(r, "trailers")
    if (r.state !== HTTP_SERVER_STREAMING) {
      panic(`HttpServer.trailers: the response is not started (state ${r.state})`)
    }
    if (r.kind === HTTP_SERVER_H1) {
      panic("HttpServer.trailers: trailers are not sent on HTTP/1.1; end the response with end")
    }
    if (r.kind === HTTP_SERVER_H3) {
      panic("HttpServer.trailers: trailers are not sent on HTTP/3; end the response with end")
    }
    if (httpFieldsCheckOutgoing(names, values) !== HTTP_FIELDS_OK) {
      panic(
        "HttpServer.trailers: the HTTP/2 carrier refuses the fields: a name that is not a lowercase token, a connection-specific field, a value that is not field text, or names and values of different lengths"
      )
    }
    if (r.ended && !r.quiet) {
      panic(
        "HttpServer.trailers: the head declared a body length of 0, which ended the stream; start with HTTP1_CHUNKED"
      )
    }
    if (!this.live(r)) {
      this.release(r)
      return HANDLER_DROPPED
    }
    if (r.left > 0 && !r.quiet) {
      panic(`HttpServer.trailers: the body is ${r.left} byte(s) short of the length the response declared`)
    }
    if (toI32(names.length) > this.maxResponseFields) {
      this.abort(r)
      this.release(r)
      return HANDLER_DROPPED
    }
    r.trailing = !r.quiet
    r.trailerNames = names
    r.trailerValues = values
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
    const left: i32 = toI32(toI64(r.pendingEnd) - toI64(r.pendingStart))
    if (left > 0) {
      // Trailers end the stream themselves, so the body's last DATA frame does not.
      const last: boolean = r.state === HTTP_SERVER_FLUSHING && !r.trailing
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
      const done: i32 = r.trailing ? this.carryTrailers(r) : this.carryEnd(r)
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
    // A local zero: the window prover reads locals, not module constants.
    const zero: i32 = 0
    let done: i32 = -1
    if (r.kind === HTTP_SERVER_H2) {
      const conn: Http2Connection | null = this.h2Conn(r.slot)
      if (conn !== null) {
        done = conn.writeData(toI32(r.stream), r.pending, zero, zero, true)
      }
      if (done === H2_AGAIN) {
        return 0
      }
    } else {
      const h3: Http3Server | null = this.h3
      if (h3 !== null) {
        done = h3.connection(r.slot).writeData(r.stream, r.pending, zero, zero, true)
      }
      if (done === H3_AGAIN) {
        return 0
      }
    }
    return done < 0 ? -1 : 1
  }

  /**
   * Ends `r`'s HTTP/2 stream with the trailer section `trailers` was given:
   * 1 when it is sent, 0 when the output has no room yet, -1 when the stream
   * is gone or the section is too large for the output, which resets it.
   */
  private carryTrailers(r: HttpServerRequest): i32 {
    const conn: Http2Connection | null = this.h2Conn(r.slot)
    if (conn === null) {
      return -1
    }
    const done: i32 = conn.writeTrailers(toI32(r.stream), r.trailerNames, r.trailerValues)
    if (done === H2_AGAIN) {
      return 0
    }
    if (done === H2_INVALID) {
      this.abort(r)
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
    const type: u8[][] = this.typeValue
    if (toI32(type.length) > 0) {
      type[0] = contentType
    }
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
      const allowed: u8[] = this.allowFor(r)
      const allow: u8[][] = this.allowValues
      if (toI32(allow.length) > 1) {
        allow[1] = allowed
      }
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
    const starts: i32[] = router.methodStart
    const ends: i32[] = router.methodEnd
    const methods: i32 = toI32(starts.length)
    let mask: i64 = 0
    for (let m: i32 = 0; m < methods && m < toI32(starts.length) && m < toI32(ends.length); m++) {
      const route: i32 = router.match(
        router.methodBytes,
        starts[m],
        ends[m],
        r.head,
        r.targetStart,
        r.targetEnd,
        this.probe
      )
      if (route >= 0) {
        mask = mask | (toI64(1) << toI64(m))
      }
    }
    const masks: i64[] = this.allowMasks
    const bytes: u8[][] = this.allowBytes
    for (let k: i32 = 0; k < toI32(masks.length) && k < toI32(bytes.length); k++) {
      if (masks[k] === mask) {
        return bytes[k]
      }
    }
    let get: boolean = false
    let head: boolean = false
    const value: u8[] = []
    for (let m: i32 = 0; m < methods && m < toI32(starts.length) && m < toI32(ends.length); m++) {
      if ((mask & (toI64(1) << toI64(m))) !== toI64(0)) {
        const start: i32 = starts[m]
        const end: i32 = ends[m]
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
    const path: u8[] = f.path
    const pathLength: i32 = toI32(path.length)
    if (toI32(path.length) === 1 && toI32(path[0]) === 42 && httpFieldIs(f.method, "OPTIONS")) {
      return 204
    }
    // Counts what `fromFields` lays out: `:authority`, when present, as a
    // `host` field in place of every `host` field the head carries.
    const authority: boolean = toI32(f.authority.length) > 0
    const names: u8[][] = f.names
    const values: u8[][] = f.values
    let fields: i32 = authority ? 1 : 0
    let bytes: i64 = toI64(f.method.length) + toI64(pathLength) + toI64(4) + toI64(f.authority.length)
    // Stops counting once either passes i32, which is past every cap.
    for (let k: i32 = 0; k < toI32(names.length) && k < toI32(values.length) && bytes < 2147483647; k++) {
      const counted: boolean = !authority || !httpFieldIs(names[k], "host")
      if (counted && fields < 2147483647 && bytes < 2147483647) {
        fields += 1
        // `bytes` is under 2^31 here, so it narrows exactly.
        bytes = toI64(toI32(bytes)) + toI64(names[k].length) + toI64(values[k].length)
      }
    }
    if (fields > this.maxFields || bytes > toI64(this.maxHead)) {
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
   * in place of any `host` field. False when the head or its spans have no
   * room for it, which `screen`'s 431 past `maxHead` and `maxFields` leaves
   * for none; the caller then refuses the stream.
   */
  private fromFields(r: HttpServerRequest, f: HttpFields): boolean {
    this.headAt = 0
    r.methodStart = 0
    if (!this.put(r, f.method)) {
      return false
    }
    r.methodEnd = this.headAt
    r.targetStart = this.headAt
    if (!this.put(r, f.path)) {
      return false
    }
    r.targetEnd = this.headAt
    let n: i32 = 0
    const authority: boolean = toI32(f.authority.length) > 0
    if (authority) {
      if (!this.putField(r, n, this.hostName, f.authority)) {
        return false
      }
      n += 1
    }
    const names: u8[][] = f.names
    const values: u8[][] = f.values
    for (let k: i32 = 0; k < toI32(names.length) && k < toI32(values.length) && n < 2147483647; k++) {
      const name: u8[] = names[k]
      if (!authority || !httpFieldIs(name, "host")) {
        if (!this.putField(r, n, name, values[k])) {
          return false
        }
        n += 1
      }
    }
    r.headerCount = n
    return true
  }

  /** Copies `bytes` into `r`'s head at `headAt`; false, with nothing copied, when they do not fit. */
  private put(r: HttpServerRequest, bytes: u8[]): boolean {
    const n: i32 = toI32(bytes.length)
    const end: i64 = toI64(this.headAt) + toI64(n)
    if (end > toI64(r.head.length) || !tryCopyBytes(r.head, this.headAt, bytes, HTTP_SERVER_ZERO, n)) {
      return false
    }
    this.headAt = toI32(end)
    return true
  }

  /** Copies field `n`, `name`: `value`, into `r`'s head and spans; false when either has no room for it. */
  private putField(r: HttpServerRequest, n: i32, name: u8[], value: u8[]): boolean {
    // Four spans per field, and `spans` is far shorter than 2^31, so `4 * n` fits.
    if (n < 0 || n > 536870911) {
      return false
    }
    const k: i32 = n * 4
    const spans: i32[] = r.spans
    if (k > toI32(spans.length) - 4) {
      return false
    }
    const nameStart: i32 = this.headAt
    if (!this.put(r, name)) {
      return false
    }
    const nameEnd: i32 = this.headAt
    if (!this.put(r, value)) {
      return false
    }
    spans[k] = nameStart
    spans[k + 1] = nameEnd
    spans[k + 2] = nameEnd
    spans[k + 3] = this.headAt
    return true
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
        // `h2Grow` gave the listener `[h2TlsBase, h2TlsBase + slots)`; a slot past it is closed.
        const v: i64 = toI64(this.h2TlsBase) + toI64(slot)
        if (!this.h2Opened(v <= 2147483647 ? toI32(v) : toI32(-1), h2.fd(slot))) {
          h2.close(slot)
        }
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
        // `h2Grow` gave the listener `[h2cBase, h2cBase + slots)`; a slot past it is closed.
        const v: i64 = toI64(this.h2cBase) + toI64(slot)
        if (!this.h2Opened(v <= 2147483647 ? toI32(v) : toI32(-1), h2c.fd(slot))) {
          h2c.close(slot)
        }
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
    const until: i64 = httpServerAfter(monotonicNanos(), HTTP_SERVER_ACCEPT_REST)
    const rests: i64[] = this.restUntil
    const at: i32 = this.restAt(token)
    if (at >= 0 && at < toI32(rests.length)) {
      rests[at] = until
    }
  }

  /** The first entry of HTTP/2 slot `v`'s stream table, or -1 outside the table. */
  private h2Base(v: i32): i32 {
    const base: i64 = toI64(v) * toI64(this.perConnection2)
    return v >= 0 && base >= 0 && base < toI64(toI32(this.h2Reqs.length)) ? toI32(base) : -1
  }

  /** One past the last entry of HTTP/2 slot `v`'s stream table, or -1 outside the table. */
  private h2End(v: i32): i32 {
    const end: i64 = (toI64(v) + toI64(1)) * toI64(this.perConnection2)
    return v >= 0 && end >= 0 && end <= toI64(toI32(this.h2Reqs.length)) ? toI32(end) : -1
  }

  /** Marks HTTP/2 slot `v` idle since `since`, or busy for 0; nothing outside the table. */
  private h2Idle(v: i32, since: i64): void {
    const idleSince: i64[] = this.h2IdleSince
    if (v >= 0 && v < toI32(idleSince.length)) {
      idleSince[v] = since
    }
  }

  /**
   * HTTP/2 slot `v`, just accepted on socket `fd`: an empty stream table,
   * idle, and in the loop. False, with nothing registered, for a slot past
   * the tables `h2Grow` sized; the caller then closes the connection.
   */
  private h2Opened(v: i32, fd: i32): boolean {
    const open: boolean[] = this.h2Open
    const count: i32[] = this.h2Count
    const idleSince: i64[] = this.h2IdleSince
    // `h2Grow` sizes the three together, and no listener asks for two billion slots.
    const wide: i64 = toI64(HTTP_SERVER_H2_BASE) + toI64(v)
    if (
      v < 0 ||
      v >= toI32(open.length) ||
      v >= toI32(count.length) ||
      v >= toI32(idleSince.length) ||
      wide > 2147483647
    ) {
      return false
    }
    const token: i32 = toI32(wide)
    open[v] = true
    count[v] = 0
    idleSince[v] = this.turnAt
    const reqs: i32[] = this.h2Reqs
    const end: i32 = this.h2End(v)
    for (let e: i32 = this.h2Base(v); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      reqs[e] = -1
    }
    pollAdd(this.loop, fd, H1_WANT_READ, token)
    return true
  }

  /** Whether HTTP/2 slot `v` is on the h2c carrier: false outside the slot table. */
  private h2IsClear(v: i32): boolean {
    const clear: boolean[] = this.h2Clear
    return v >= 0 && v < toI32(clear.length) && clear[v]
  }

  /** HTTP/2 slot `v`'s number in its own carrier's table, or -1 outside the slot table. */
  private h2Local(v: i32): i32 {
    const clear: boolean[] = this.h2Clear
    if (v < 0 || v >= toI32(clear.length)) {
      return -1
    }
    const base: i32 = clear[v] ? this.h2cBase : this.h2TlsBase
    return base >= 0 && base <= v ? v - base : -1
  }

  /** Whether HTTP/2 slot `v`'s carrier holds a connection there. */
  private h2Holds(v: i32): boolean {
    const at: i32 = this.h2Local(v)
    if (this.h2IsClear(v)) {
      const h2c: Http2CleartextServer | null = this.h2c
      return h2c !== null && h2c.holds(at)
    }
    const h2: Http2TlsServer | null = this.h2
    return h2 !== null && h2.holds(at)
  }

  /** HTTP/2 slot `v`'s connection, or null with no carrier for its kind of slot or outside the table. */
  private h2Conn(v: i32): Http2Connection | null {
    const at: i32 = this.h2Local(v)
    if (at < 0) {
      return null
    }
    if (this.h2IsClear(v)) {
      const h2c: Http2CleartextServer | null = this.h2c
      return h2c === null ? null : h2c.connection(at)
    }
    const h2: Http2TlsServer | null = this.h2
    return h2 === null ? null : h2.connection(at)
  }

  /** HTTP/2 slot `v`'s connection once it has its preface (a TLS slot has it at once), or null before. */
  private h2Prefaced(v: i32): Http2Connection | null {
    const h2c: Http2CleartextServer | null = this.h2c
    if (this.h2IsClear(v) && (h2c === null || !h2c.prefaced(this.h2Local(v)))) {
      return null
    }
    return this.h2Conn(v)
  }

  /** HTTP/2 slot `v`'s next event, as its carrier's `next` answers: `H2_ERROR` with no carrier. */
  private h2Next(v: i32): i32 {
    const at: i32 = this.h2Local(v)
    if (at < 0) {
      return H2_ERROR
    }
    if (this.h2IsClear(v)) {
      const h2c: Http2CleartextServer | null = this.h2c
      return h2c === null ? H2_ERROR : h2c.next(at)
    }
    const h2: Http2TlsServer | null = this.h2
    return h2 === null ? H2_ERROR : h2.next(at)
  }

  /**
   * Sends what HTTP/2 slot `v` holds: its interest, with `TLS_RECORD_DONE`
   * (`H2C_DONE`) once it is over, with no carrier, or outside the slot table.
   */
  private h2Flush(v: i32): i32 {
    const at: i32 = this.h2Local(v)
    if (at < 0) {
      return TLS_RECORD_DONE
    }
    if (this.h2IsClear(v)) {
      const h2c: Http2CleartextServer | null = this.h2c
      return h2c === null ? TLS_RECORD_DONE : h2c.flush(at)
    }
    const h2: Http2TlsServer | null = this.h2
    return h2 === null ? TLS_RECORD_DONE : h2.flush(at)
  }

  /** HTTP/2 slot `v`'s socket, or -1 with no carrier. */
  private h2FdOf(v: i32): i32 {
    const at: i32 = this.h2Local(v)
    if (this.h2IsClear(v)) {
      const h2c: Http2CleartextServer | null = this.h2c
      return h2c === null ? -1 : h2c.fd(at)
    }
    const h2: Http2TlsServer | null = this.h2
    return h2 === null ? -1 : h2.fd(at)
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
    const h2c: Http2CleartextServer | null = this.h2c
    const h2: Http2TlsServer | null = this.h2
    if (this.h2IsClear(v)) {
      if (h2c !== null) {
        const slot: i32 = toI32(toI64(v) - toI64(this.h2cBase))
        if (read) {
          h2c.readable(slot)
        } else {
          h2c.writable(slot)
        }
      }
    } else if (key !== null && h2 !== null) {
      const slot: i32 = toI32(toI64(v) - toI64(this.h2TlsBase))
      let wants: i32 = read ? h2.readable(slot) : h2.writable(slot)
      for (let turn: i32 = 0; turn < 4 && h2.holds(slot) && (wants & TLS_RECORD_SIGN) !== 0; turn++) {
        wants = h2.signP256(slot, key)
      }
    }
    const conn: Http2Connection | null = this.h2Holds(v) ? this.h2Conn(v) : null
    if (conn !== null) {
      let event: i32 = this.h2Next(v)
      while (event !== H2_NEED_MORE && event !== H2_ERROR) {
        this.h2Event(v, conn, event)
        event = this.h2Next(v)
      }
      if (conn.inputEnded) {
        this.h2Ended(v)
      }
    }
    this.h2Settle(v)
  }

  /**
   * `slot`'s peer has stopped sending, so no streaming request on it will
   * get more of its body: each one still waiting is marked hung up and goes
   * back to the program, once, and its stream is reset CANCEL. A hung-up
   * request's answer is dropped without touching its stream, so a stream
   * left open would keep the connection from ever being done. That holds for
   * an answer already streaming or flushing too: its peer can never close the
   * stream's other half, so the reset cuts the answer short, by design.
   */
  private h2Ended(slot: i32): void {
    const conn: Http2Connection | null = this.h2Conn(slot)
    if (conn === null) {
      return
    }
    const reqs: i32[] = this.h2Reqs
    const end: i32 = this.h2End(slot)
    for (let e: i32 = this.h2Base(slot); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      const at: i32 = reqs[e]
      if (at >= 0) {
        const r: HttpServerRequest | null = this.requestAt(at)
        if (r !== null && r.streaming && !r.bodyEnded && !r.hung) {
          this.drop(r)
          this.requeue(r)
          conn.reset(toI32(r.stream), H2_CANCEL)
        }
      }
    }
  }

  /** One HTTP/2 event of `slot`'s connection. */
  private h2Event(slot: i32, conn: Http2Connection, event: i32): void {
    const id: i32 = conn.stream
    if (event === H2_REQUEST) {
      const f: HttpFields = conn.fields
      const status: i32 = this.screen(f)
      // A declared length past `maxBody` is refused once the route is known, since a streaming route takes any.
      const long: boolean = status === HTTP_SERVER_TOO_LARGE && this.streamCount > 0
      if (status > 0 && !long) {
        this.h2Direct(slot, conn, id, status, conn.endStream)
        return
      }
      const e: i32 = this.h2Entry(slot)
      const r: HttpServerRequest | null = e >= 0 ? this.obtain() : null
      if (r === null) {
        conn.reset(id, H2_REFUSED_STREAM)
        return
      }
      if (!this.fromFields(r, f)) {
        // Still free: `admit` has not taken it.
        this.free.push(r)
        conn.reset(id, H2_REFUSED_STREAM)
        return
      }
      r.kind = HTTP_SERVER_H2
      r.version = 2
      r.secure = !this.h2IsClear(slot)
      r.stream = toI64(id)
      r.slot = slot
      r.gen = httpServerAt(this.h2Gen, slot)
      r.entry = e
      const streams: i32[] = this.h2Streams
      const reqs: i32[] = this.h2Reqs
      // `h2Entry` found `e` in the table, which `h2Grow` sizes with `h2Streams`.
      if (e >= 0 && e < toI32(streams.length) && e < toI32(reqs.length)) {
        streams[e] = id
        reqs[e] = r.index
      }
      httpServerAdd(this.h2Count, slot, 1)
      this.h2Idle(slot, toI64(0))
      this.admit(r, !conn.endStream)
      const streaming: boolean = !conn.endStream && this.streamsBody(r.route)
      if (long && !streaming) {
        this.release(r)
        this.h2Direct(slot, conn, id, status, conn.endStream)
        return
      }
      if (streaming) {
        conn.hold(id)
        r.streaming = true
        r.bodyEnded = false
        this.enqueue(r)
      } else if (conn.endStream) {
        this.enqueue(r)
      }
      return
    }
    const at: i32 = this.h2Find(slot, id)
    const r: HttpServerRequest | null = this.requestAt(at)
    if (r === null) {
      return
    }
    if (r.streaming) {
      this.h2Piece(conn, r, event)
      return
    }
    if (event === H2_DATA) {
      if (r.state !== HTTP_SERVER_READING) {
        return
      }
      if (toI64(r.bodyLength) + toI64(conn.dataLength) > toI64(this.maxBody)) {
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
   * One HTTP/2 event of streaming request `r`: a piece of its body is kept for
   * the program while it holds `r` and credited back at once otherwise, the
   * end of its body or a reset is marked, and the program is told by `r`
   * coming out of `take` again. What is kept is bounded by the stream's
   * window, which only `consume` credits.
   */
  private h2Piece(conn: Http2Connection, r: HttpServerRequest, event: i32): void {
    if (event === H2_DATA) {
      const n: i32 = conn.dataLength
      if (
        r.state === HTTP_SERVER_QUEUED ||
        r.state === HTTP_SERVER_HELD ||
        r.state === HTTP_SERVER_STREAMING
      ) {
        // The stream window keeps the sum inside an `i32`.
        const wide: i64 = toI64(r.bodyLength) + toI64(n)
        const need: i32 = wide > toI64(2147483647) ? 2147483647 : toI32(wide)
        if (toI32(r.body.length) < need) {
          const have: i32 = toI32(r.body.length)
          const cap: i32 = conn.streamWindow()
          // Doubling past i32 is past `cap` too, which the clamp below gives.
          let doubled: i32 = cap
          if (have < 1073741824) {
            doubled = have * 2
          }
          let size: i32 = have < HTTP_SERVER_BODY_FIRST ? HTTP_SERVER_BODY_FIRST : doubled
          if (size > cap) {
            size = cap
          }
          if (size < need) {
            size = need
          }
          const grown: u8[] = new Array<u8>(size)
          copyBytes(grown, HTTP_SERVER_ZERO, r.body, HTTP_SERVER_ZERO, r.bodyLength)
          r.body = grown
        }
        copyBytes(r.body, r.bodyLength, conn.data, conn.dataStart, n)
        r.bodyLength = need
      } else {
        conn.consumeBody(conn.stream, n)
      }
      r.bodyEnded = conn.endStream
    } else if (event === H2_TRAILERS) {
      r.bodyEnded = true
    } else if (event === H2_RESET) {
      this.drop(r)
      this.unlink(r)
    } else {
      return
    }
    this.requeue(r)
  }

  /**
   * Answers stream `id` with `status` and no body, then resets it with
   * NO_ERROR when the client is still sending (RFC 9113 §8.1); with
   * INTERNAL_ERROR when there is no room for the answer. Over TLS it
   * carries `alt-svc` like every other answer; over h2c it carries none.
   */
  private h2Direct(slot: i32, conn: Http2Connection, id: i32, status: i32, ended: boolean): void {
    const alt: boolean = this.altSvc !== null && !this.h2IsClear(slot)
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
    const reqs: i32[] = this.h2Reqs
    const end: i32 = this.h2End(slot)
    for (let e: i32 = this.h2Base(slot); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      if (reqs[e] === -1) {
        return e
      }
    }
    return -1
  }

  /** The request `slot` holds for stream `id`, or -1. */
  private h2Find(slot: i32, id: i32): i32 {
    const reqs: i32[] = this.h2Reqs
    const streams: i32[] = this.h2Streams
    const end: i32 = this.h2End(slot)
    for (let e: i32 = this.h2Base(slot); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      if (reqs[e] >= 0 && e < toI32(streams.length) && streams[e] === id) {
        return reqs[e]
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
      const open: boolean[] = this.h2Open
      if (slot >= 0 && slot < toI32(open.length) && open[slot]) {
        this.h2Forget(slot)
      }
      return
    }
    let wants: i32 = this.h2Flush(slot)
    for (let pass: i32 = 0; pass < 4096 && this.h2Holds(slot) && this.h2PushAll(slot); pass++) {
      wants = this.h2Flush(slot)
    }
    // A WINDOW_UPDATE `consume` owed while the output was full goes out now:
    // a peer at a closed window sends nothing that would make `next` send it.
    const conn: Http2Connection | null = this.h2Holds(slot) ? this.h2Conn(slot) : null
    if (conn !== null && conn.settleCredit()) {
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
    // `h2Opened` registered the slot under this token, so it fits.
    const token: i64 = toI64(HTTP_SERVER_H2_BASE) + toI64(slot)
    if (token <= 2147483647) {
      pollModify(this.loop, this.h2FdOf(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), toI32(token))
    }
  }

  /** Pushes every response `slot` is sending: whether any moved a byte or ended. */
  private h2PushAll(slot: i32): boolean {
    let moved: boolean = false
    const reqs: i32[] = this.h2Reqs
    const end: i32 = this.h2End(slot)
    for (let e: i32 = this.h2Base(slot); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      const r: HttpServerRequest | null = this.requestAt(reqs[e])
      if (r !== null && this.moves(r)) {
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
    const before: i64 = toI64(r.pendingEnd) - toI64(r.pendingStart)
    this.push(r)
    return r.state === HTTP_SERVER_FREE || toI64(r.pendingEnd) - toI64(r.pendingStart) < before
  }

  /** Closes `slot` and forgets it. */
  private h2Close(slot: i32): void {
    const h2c: Http2CleartextServer | null = this.h2c
    const h2: Http2TlsServer | null = this.h2
    const at: i32 = this.h2Local(slot)
    if (at >= 0 && this.h2IsClear(slot)) {
      if (h2c !== null) {
        h2c.close(at)
      }
    } else if (at >= 0 && h2 !== null) {
      h2.close(at)
    }
    this.h2Forget(slot)
  }

  /**
   * The bookkeeping of a slot the carrier has closed: its generation moves
   * on, so what is owed for it is dropped, and the requests only the server
   * held go back.
   */
  private h2Forget(slot: i32): void {
    const open: boolean[] = this.h2Open
    const gen: i32[] = this.h2Gen
    const count: i32[] = this.h2Count
    // `h2Grow` sizes the three together.
    if (slot < 0 || slot >= toI32(open.length) || slot >= toI32(gen.length) || slot >= toI32(count.length)) {
      return
    }
    open[slot] = false
    // The generation only has to differ from the last one, so it wraps.
    const was: i32 = gen[slot]
    gen[slot] = was < 2147483647 ? was + 1 : 0
    count[slot] = 0
    const reqs: i32[] = this.h2Reqs
    const end: i32 = this.h2End(slot)
    for (let e: i32 = this.h2Base(slot); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      const r: HttpServerRequest | null = this.requestAt(reqs[e])
      reqs[e] = -1
      if (r !== null) {
        r.entry = -1
        this.drop(r)
        if (r.streaming) {
          this.requeue(r)
        }
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
      const meta: i32[] = this.h3Meta
      const given: i32 = toI32(meta.length) > 0 ? meta[0] : 0
      const segment: i32 = given > 0 ? given : n
      let at: i32 = 0
      while (at >= 0 && at < n) {
        const left: i32 = n - at
        const length: i32 = left < segment ? left : segment
        if (this.h3Owned(h3, rx, at, length)) {
          h3.datagram(rx, at, length, this.h3From, ms, key)
        }
        if (count < 2147483647) {
          count += 1
        }
        // `length` is at most `n - at`, so `at` stays within `n`.
        at = toI32(toI64(at) + toI64(length))
      }
    }
    return count
  }

  /** Whether a connection of `h3` owns the datagram `buf[at .. at + len)`, by its first packet's Destination Connection ID, read as `Http3Server.datagram` reads it. */
  private h3Owned(h3: Http3Server, buf: u8[], at: i32, len: i32): boolean {
    const end: i64 = toI64(at) + toI64(len)
    if (len < 1 || at < 0 || at >= toI32(buf.length) || end > toI64(buf.length)) {
      return false
    }
    let dcidOffset: i32 = 1
    let dcidLength: i32 = QUIC_CONN_CID_LENGTH
    if ((toI32(buf[at]) & 0x80) !== 0) {
      const lengthAt: i32 = toI32(toI64(at) + toI64(5))
      if (len < 6 || lengthAt < 0 || lengthAt >= toI32(buf.length)) {
        return false
      }
      dcidLength = toI32(buf[lengthAt])
      dcidOffset = 6
    }
    if (dcidLength > QUIC_MAX_CID_LENGTH || toI64(dcidOffset) + toI64(dcidLength) > toI64(len)) {
      return false
    }
    // The ID ends within `at + len`, which fits in `buf`.
    return h3.index.find(buf, toI32(toI64(at) + toI64(dcidOffset)), dcidLength) >= 0
  }

  /** Serves `slot`'s HTTP/3 events, then pushes its responses. */
  private h3Serve(h3: Http3Server, slot: i32): void {
    const conn: Http3Connection = h3.connection(slot)
    if (httpServerAt(this.h3Gen, slot) !== conn.generation) {
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
    const reqs: i32[] = this.h3Reqs
    const end: i32 = this.h3End(slot)
    for (let e: i32 = this.h3Base(slot); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      const r: HttpServerRequest | null = this.requestAt(reqs[e])
      if (r !== null) {
        this.moves(r)
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
      const r: HttpServerRequest | null = e >= 0 ? this.obtain() : null
      if (r === null) {
        conn.reset(id, H3_REQUEST_REJECTED)
        return
      }
      if (!this.fromFields(r, f)) {
        // Still free: `admit` has not taken it.
        this.free.push(r)
        conn.reset(id, H3_REQUEST_REJECTED)
        return
      }
      r.kind = HTTP_SERVER_H3
      r.version = 3
      r.secure = true
      r.stream = id
      r.slot = slot
      r.gen = conn.generation
      r.entry = e
      const streams: i64[] = this.h3Streams
      const reqs: i32[] = this.h3Reqs
      // `h3Entry` found `e` in the table, which `listenHttp3` sizes with `h3Streams`.
      if (e >= 0 && e < toI32(streams.length) && e < toI32(reqs.length)) {
        streams[e] = id
        reqs[e] = r.index
      }
      httpServerAdd(this.h3Count, slot, 1)
      this.admit(r, false)
      return
    }
    const at: i32 = this.h3Find(slot, id)
    const r: HttpServerRequest | null = this.requestAt(at)
    if (r === null) {
      return
    }
    if (event === H3_DATA) {
      if (r.state !== HTTP_SERVER_READING) {
        return
      }
      if (toI64(r.bodyLength) + toI64(conn.dataLength) > toI64(this.maxBody)) {
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

  /** The first entry of HTTP/3 slot `v`'s stream table, or -1 outside the table. */
  private h3Base(v: i32): i32 {
    const base: i64 = toI64(v) * toI64(this.perConnection3)
    return v >= 0 && base >= 0 && base < toI64(toI32(this.h3Reqs.length)) ? toI32(base) : -1
  }

  /** One past the last entry of HTTP/3 slot `v`'s stream table, or -1 outside the table. */
  private h3End(v: i32): i32 {
    const end: i64 = (toI64(v) + toI64(1)) * toI64(this.perConnection3)
    return v >= 0 && end >= 0 && end <= toI64(toI32(this.h3Reqs.length)) ? toI32(end) : -1
  }

  /** A free entry of `slot`'s stream table, or -1 when it is full. */
  private h3Entry(slot: i32): i32 {
    const reqs: i32[] = this.h3Reqs
    const end: i32 = this.h3End(slot)
    for (let e: i32 = this.h3Base(slot); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      if (reqs[e] === -1) {
        return e
      }
    }
    return -1
  }

  /** The request `slot` holds for stream `id`, or -1. */
  private h3Find(slot: i32, id: i64): i32 {
    const reqs: i32[] = this.h3Reqs
    const end: i32 = this.h3End(slot)
    const streams: i64[] = this.h3Streams
    for (let e: i32 = this.h3Base(slot); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      if (reqs[e] >= 0 && e < toI32(streams.length) && streams[e] === id) {
        return reqs[e]
      }
    }
    return -1
  }

  /**
   * Forgets `slot`'s stream table, its connection gone or restarted as
   * generation `gen`: the requests only the server held go back.
   */
  private h3Clear(slot: i32, gen: i32): void {
    const reqs: i32[] = this.h3Reqs
    const end: i32 = this.h3End(slot)
    for (let e: i32 = this.h3Base(slot); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      const r: HttpServerRequest | null = this.requestAt(reqs[e])
      reqs[e] = -1
      if (r !== null) {
        r.entry = -1
        this.drop(r)
      }
    }
    const count: i32[] = this.h3Count
    const gens: i32[] = this.h3Gen
    // `listenHttp3` sizes the two together.
    if (slot >= 0 && slot < toI32(count.length) && slot < toI32(gens.length)) {
      count[slot] = 0
      gens[slot] = gen
    }
  }

  // ---- Timeouts -------------------------------------------------------------------

  /**
   * Once a second: a body slower than `bodyTimeout` is cut off (its HTTP/1.1
   * connection closed, its stream reset), an HTTP/2 connection with no
   * stream for `idleTimeout` is closed, and stream tables of connections
   * the carriers dropped are forgotten.
   */
  private expireAll(now: i64): void {
    for (const s of this.h1Slots) {
      if (
        s.open &&
        s.sniff &&
        s.got > 0 &&
        httpServerAfter(s.since, toI64(this.prefaceTimeout) * HTTP_SERVER_NANOS_PER_MS) <= now
      ) {
        // Part of the preface and then silence: the slot has held its 24 bytes long enough.
        this.h1Close(s)
      }
      const r: HttpServerRequest | null = s.current
      if (r !== null && this.late(r, now) && this.h1Holds(s)) {
        this.h1Close(s)
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
    return r.state === HTTP_SERVER_READING && httpServerPast(now, r.since, this.bodyTimeout)
  }

  /** `expireAll` for HTTP/2 slot `s`. */
  private h2Expire(s: i32, now: i64): void {
    if (!this.h2Holds(s)) {
      this.h2Forget(s)
      return
    }
    const conn: Http2Connection | null = this.h2Prefaced(s)
    if (conn === null) {
      // `prefaceTimeout` holds it till then; `idleTimeout` runs from the preface.
      this.h2Idle(s, now)
      return
    }
    const streams: i32[] = this.h2Streams
    const reqs: i32[] = this.h2Reqs
    const end: i32 = this.h2End(s)
    for (let e: i32 = this.h2Base(s); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      const r: HttpServerRequest | null = this.requestAt(reqs[e])
      if (r !== null && this.late(r, now) && e < toI32(streams.length)) {
        const sent: i32 = conn.reset(streams[e], H2_CANCEL)
        this.release(r)
        if (sent === H2_AGAIN) {
          // No room to send the reset: end the connection, as `abort` does.
          this.h2Close(s)
          return
        }
      }
    }
    const idleSince: i64[] = this.h2IdleSince
    const since: i64 = s >= 0 && s < toI32(idleSince.length) ? idleSince[s] : 0
    if (httpServerAt(this.h2Count, s) === 0 && since > 0 && httpServerPast(now, since, this.idleTimeout)) {
      this.h2Close(s)
      return
    }
    this.h2Settle(s)
  }

  /** `expireAll` for HTTP/3 slot `s`. */
  private h3Expire(h3: Http3Server, s: i32, now: i64): void {
    if (!h3.holds(s) || h3.connection(s).generation !== httpServerAt(this.h3Gen, s)) {
      this.h3Clear(s, h3.holds(s) ? h3.connection(s).generation : httpServerAt(this.h3Gen, s))
      return
    }
    const conn: Http3Connection = h3.connection(s)
    const streams: i64[] = this.h3Streams
    const reqs: i32[] = this.h3Reqs
    const end: i32 = this.h3End(s)
    for (let e: i32 = this.h3Base(s); e >= 0 && e < end && e < toI32(reqs.length); e++) {
      const r: HttpServerRequest | null = this.requestAt(reqs[e])
      if (r !== null && this.late(r, now) && e < toI32(streams.length)) {
        conn.reset(streams[e], H3_REQUEST_CANCELLED)
        this.release(r)
        h3.touch(s)
      }
    }
  }
}
