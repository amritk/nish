/**
 * `nish/net/handler` — complete requests and their responses over the
 * HTTP/1.1 carrier, so that a server answers requests instead of driving
 * `Http1Server`'s events by hand.
 *
 *     const HOME: i32 = 0   // module constants, in the order the routes are added
 *     const USER: i32 = 1
 *     const router = new Router(new RouterLimits())
 *     router.add("GET", "/")          // answers HOME
 *     router.add("GET", "/users/:id") // answers USER
 *     const h = new HttpHandler(new HandlerLimits(), tcpListen("0.0.0.0", 8080, 1024), router)
 *     while (true) {
 *       h.wait(1000)
 *       while (h.ready()) {
 *         const req = h.take()
 *         switch (req.route) {
 *           case HOME: h.send(req, 200, TEXT, hello, 0, hello.length); break
 *           case USER: { const w = h.json(); ...; h.sendJson(req, 200); break }
 *           default: h.refuse(req)   // 404, or 405 with its Allow
 *         }
 *       }
 *     }
 *
 * The handler owns the readiness loop, the carrier and everything between a
 * request's first byte and its last response byte: it accepts, routes each
 * request at its head, gathers its body up to the cap, and hands the program
 * the request once it is whole. Keep-alive and pipelining are the carrier's:
 * a connection's next request is read only once the one before it is
 * answered and handed over, so answers go out in request order.
 *
 * **There are no function values**, so the program pulls: `wait` runs one
 * turn of the loop, `ready` and `take` give out the whole requests it made,
 * and the program dispatches on `req.route` — the index `Router.add`
 * answered, or a negative `ROUTER_*` code — with a `switch` on module
 * constants, as `nish/net/router` describes.
 *
 * **A request may be answered later.** A request the program has taken stays
 * its own until it answers it, in the same turn or in a later one (after a
 * database answers, say). Every request taken is answered exactly once, by
 * `send`, `sendFields`, `sendJson`, `problem`, `refuse` or `start` ... `end`,
 * and once answered the request object is the handler's again: it goes back
 * to a free list and serves a later request, so the program keeps no
 * reference to it.
 *
 * **An answer that comes too late is dropped.** Each slot carries a
 * generation, bumped whenever its connection closes, and a request remembers
 * the generation it was read under. An answer for a request whose
 * connection has closed in the meantime — the peer left, the idle timeout
 * passed — answers `HANDLER_DROPPED` and sends nothing, even when a new
 * connection has taken the slot since. The answer still hands the request
 * back, so nothing leaks.
 *
 * **Nothing is allocated per request once warm.** A request's method, target
 * and header section are copied out of the carrier's head into the request's
 * own buffer at `H1_REQUEST` (the parser reuses its own for the next
 * request), and everything the program reads is a span into that copy or
 * into the body buffer. Those buffers, the free list and the queue grow to
 * the largest request seen and are kept; JSON is written into one scratch
 * buffer the handler owns. `tests/link/net_handler` pins `Arena.used()` flat
 * over thousands of requests.
 *
 * **The body cap** is the carrier's `maxBody`, which `HandlerLimits` sets to
 * one MiB: a declared length over it, or a chunked body that grows past it, is
 * answered 413 by the carrier and the connection ends. A request's body
 * buffer grows to the body it holds, so a handler holds at most its slots
 * times the cap in bodies. `docs/security/handler.md` is the record.
 *
 * **A compressed body is decoded under its own cap.** A body sent with one
 * `Content-Encoding` of `gzip`, `x-gzip` or `deflate` is decoded before the
 * program takes it, into at most `HandlerLimits.maxDecoded` bytes (one MiB):
 * `req.body` holds the decoded bytes and `req.decodedFrom` the coding they
 * came in. A body that decodes past the cap — a decompression bomb — is
 * answered 413 by the handler, and one that does not decode 400; the program
 * never takes either. Any other coding, or two codings stacked, reaches the
 * program as it arrived, with `decodedFrom` `HTTP_CODING_IDENTITY`.
 *
 * Misuse — a status outside 200 to 599, a reserved field (`Content-Length`,
 * `Transfer-Encoding`, `Connection`, `Upgrade`, `Keep-Alive`), more body than
 * the length said, a second `start` — panics: it is a bug in the program,
 * never something a peer can cause. Each answering method has a `try` twin
 * (`tryWrite`, `tryEnd`, `trySend`, ...) that answers the same misuse as an
 * `Err` instead, for a program built without panics; the class doc says
 * what each refusal leaves of the request. What a peer can cause answers a
 * code the program may ignore, so no answer needs its result bound.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9110, RFC 9112 and RFC 9457, not ported from another
 * implementation.
 */
import { tryCopyBytes } from "nish/bytes"
import { JsonWriter } from "nish/json"
import { httpFieldBytes } from "nish/net/http-fields"
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
  ROUTER_BAD_ESCAPE,
  ROUTER_METHOD_NOT_ALLOWED,
  ROUTER_NO_ROOM,
  Router,
  routerDecode,
} from "nish/net/router"
import { URL_DECODE_ALLOW_NUL, URL_DECODE_ERR_SPACE, URL_DECODE_FORM, percentDecode } from "nish/net/url"
import {
  NET_LISTEN_RING,
  pollAdd,
  pollCreate,
  pollModify,
  pollRemove,
  pollWait,
  pollWaitBatch,
  tcpListenFlags,
} from "nish:net"
import {
  HTTP_CODING_DEFLATE,
  HTTP_CODING_GZIP,
  HTTP_CODING_IDENTITY,
  HTTP_CODING_NONE,
  HTTP_DECODE_TOO_LARGE,
  HTTP_CODING_BAD_WINDOW,
  HttpBodyDecoder,
  httpBodyDecoderFault,
  httpTryContentEncoding,
} from "nish/net/http-compress"

/** `HandlerLimits.maxWaitMs`' most: a second, the interval `bodyTimeout` is checked at. */
const HANDLER_MAX_WAIT_MS: i32 = 1000
/** A core's answer when the call broke its contract: `refusal` says how, and the public method panics with it. */
const HANDLER_REFUSED: i32 = -24
/** An answer sent, or queued to be sent. */
export const HANDLER_SENT: i32 = 0
/** An answer for a request whose connection closed first: nothing was sent. */
export const HANDLER_DROPPED: i32 = -21
/** `HttpRequest.query` and `header`: no such name. */
export const HANDLER_ABSENT: i32 = -20
/** `before` and `after`: every step bound to the request's route has run, and the request is still the program's to answer. */
export const HANDLER_NEXT: i32 = -22
/** `before` and `after`: a step answered the request, so the route body must not. */
export const HANDLER_ANSWERED: i32 = -23
/** The most fields `field` adds to one answer. */
export const HANDLER_MAX_ADDED: i32 = 16
/**
 * `wait`: the handler has no readiness loop, because its constructor was
 * given a failed `pollCreate`, so no socket can ever be ready. Stop calling
 * `wait`; a loop that keeps calling it only spins.
 */
export const HANDLER_NO_LOOP: i32 = -25

/** The most descriptors `watch` takes beside the handler's own. */
export const HANDLER_MAX_WATCHED: i32 = 16

// A request's state, from the free list to the free list.
/** On the free list. */
const HANDLER_FREE: i32 = 0
/** Its head is routed and its body is arriving. */
const HANDLER_READING: i32 = 1
/** Whole, but its connection still holds more than half an output of the response before it unsent. */
const HANDLER_PARKED: i32 = 2
/** Whole and queued for `take`. */
const HANDLER_QUEUED: i32 = 3
/** Taken: the program owes it an answer. */
const HANDLER_HELD: i32 = 4
/** Its response is started and the program is still writing the body. */
const HANDLER_STREAMING: i32 = 5
/** The program has ended the response; what the carrier had no room for is still being handed over. */
const HANDLER_FLUSHING: i32 = 6

/** The listener's poll token; a slot's is the slot, and watched descriptor `id`'s is `-2 - id`. */
const HANDLER_LISTENER: i32 = -1
/** Read, error and hang-up: the readiness bits that mean the socket has something for `readable`. */
const HANDLER_READ_BITS: i32 = 5
const HANDLER_ZERO: i32 = 0
const HANDLER_ONE_MIB: i32 = 1048576
/** `tcpAccept`: none is waiting (EAGAIN), or the one that was left before it was taken (ECONNABORTED). */
const HANDLER_ACCEPT_NONE: i32 = -11
const HANDLER_ACCEPT_ABORTED: i32 = -103
/**
 * How long, at most, the listener rests after an accept fails for want of
 * descriptors, ring slots or memory: 100 ms, or until a connection closes.
 */
const HANDLER_ACCEPT_REST: i64 = 100000000
/** How often, at most, `wait` looks for a body past `bodyTimeout`: a second, in nanoseconds. */
const HANDLER_BODY_SWEEP: i64 = 1000000000
const HANDLER_NANOS_PER_MS: i64 = 1000000
/** `handlerFormByte`'s count of bytes taken, in its bits above the byte. */
const HANDLER_TOOK_ONE: i32 = 256
const HANDLER_TOOK_THREE: i32 = 768

/**
 * What an `HttpHandler` holds and refuses past. `http` is the carrier's own
 * configuration, made here with its body cap lowered to one MiB because the
 * handler holds a body whole; raise `http.maxBody` for a server that takes
 * larger bodies, knowing each slot may keep a buffer that large.
 */
export class HandlerLimits {
  /** The carrier's caps and timeouts; `http.maxBody` is the body cap, past which a request is answered 413. */
  http: Http1Config
  /**
   * The most connections at once. It is the handler's own cap, not
   * `RLIMIT_NOFILE`: with `ring` set the connections live in io_uring slots
   * and may outnumber the descriptor limit. Past it a connection is accepted
   * and closed at once.
   */
  slots: i32 = 256
  /**
   * Whether `listen` opens its listener with `NET_LISTEN_RING`, so each
   * connection is accepted into an io_uring slot rather than a descriptor.
   * Off by default. Where the kernel refuses rings, the listener serves
   * descriptors and `netRingState` says why. A connection is then a slot
   * handle, which `sendFd` and a C library through `nish:ffi` cannot take.
   */
  ring: boolean = false
  /**
   * Bytes in the JSON scratch buffer: the largest body `json` and `problem`
   * can write. A value past it makes `sendJson` answer 500. At least 256.
   */
  jsonBytes: i32 = 65536
  /** The most readiness events one `wait` takes. */
  maxEvents: i32 = 256
  /**
   * The events one `wait` gathers before it returns, once the first is in:
   * above 1, a busy ring server takes its connections' events in fewer,
   * larger batches (`pollWaitBatch`), waiting up to `maxWaitMs` for them. A
   * batch is at most `maxEvents` and at most 64 events, whatever this says.
   * It acts only on a listener `listen` opened with `ring` set, on Linux;
   * elsewhere, and at 1 (the default), `wait` is `pollWait` as before. At
   * least 1.
   */
  minEvents: i32 = 1
  /**
   * The most milliseconds one `wait` waits for `minEvents`, after its first
   * event and on top of its own timeout. It is latency added to the batch's
   * first request, and a timer or other descriptor the handler watches may
   * be heard up to this late. 0 (the default) waits no longer than
   * `pollWait` does. From 0 to 1000.
   */
  maxWaitMs: i32 = 0
  /**
   * Milliseconds from a request's head to the end of its body. A request
   * still reading its body past it has its connection closed: the carrier's
   * `idleTimeout` is refreshed by every byte, so a body trickled a byte at a
   * time would otherwise hold its slot for good (HANDLER-5). It is checked
   * each `wait`, at most once a second, so a connection may outlive it by up
   * to a second, or until `wait` returns.
   */
  bodyTimeout: i32 = 30000
  /**
   * The most bytes a `gzip` or `deflate` request body may decode to; past it
   * the request is answered 413 and never taken. 0 decodes nothing, so every
   * body reaches the program as it arrived. Each slot's body buffer may grow
   * to this as well as to `http.maxBody`.
   */
  maxDecoded: i32 = 1048576

  /**
   * The defaults: 256 slots, a 64 KiB JSON buffer, 256 events a turn and no
   * wait for a batch of them, a 30 second body timeout, a one MiB cap on a
   * decoded body, and the carrier's own defaults with the body cap lowered to
   * one MiB. Set a field to tune it.
   */
  constructor() {
    this.http = new Http1Config()
    this.http.maxBody = HANDLER_ONE_MIB
  }

  /**
   * Opens a TCP listener for an `HttpHandler` with these limits:
   * `tcpListenFlags` with `flags`, plus `NET_LISTEN_RING` when `ring` is set.
   * @param host the address to bind, such as "0.0.0.0"
   * @param port the port to bind, or 0 for one the kernel picks
   * @param backlog the kernel's queue of connections not yet accepted
   * @param flags `tcpListenFlags`' other bits: 1 for `SO_REUSEPORT`, 2 for `TCP_NODELAY`
   * @returns the listener, or a negative errno
   */
  listen(host: string, port: i32, backlog: i32, flags: i32): i32 {
    return tcpListenFlags(host, port, backlog, this.ring ? flags | NET_LISTEN_RING : flags)
  }
}

/**
 * One request, whole: its head copied out of the carrier and its body. Every
 * position is an offset into `head` or `body`, which are the request's own
 * and stay valid until it is answered.
 */
export class HttpRequest {
  /** The method, the target and the header section, as the parser kept them (field names lowercased). */
  head: u8[]
  /**
   * Four per field, into `head`: name start and end, value start and end.
   * @internal Filled by `HttpHandler` in this module when it copies the head, and read by `header`, `valueStart` and `valueEnd`.
   */
  spans: i32[]
  /**
   * The route parameters as `[start, end)` pairs into `head`, in the pattern's order.
   * @internal Filled by `HttpHandler` in this module from `Router.match`; programs read them through `paramStart`, `param` and the rest.
   */
  params: i32[]
  /** The body, `body[0 .. bodyLength)`. */
  body: u8[]
  /**
   * What the carrier had no room for yet: `pending[pendingStart .. pendingEnd)`.
   * @internal Written and flushed by `HttpHandler` in this module while it streams the response.
   */
  pending: u8[]
  /**
   * When the head was read, as the handler's turn saw it (`monotonicNanos`); `bodyTimeout` runs from here.
   * @internal Stamped and checked by `HttpHandler` in this module to close a connection whose body trickles past `bodyTimeout`.
   */
  since: i64 = 0
  /** The index `Router.add` answered for the route, or a negative `ROUTER_*` code. */
  route: i32 = 0
  /**
   * How many parameter pairs `params` holds.
   * @internal Set by `HttpHandler` in this module after routing; the param accessors check `k` against it.
   */
  paramCount: i32 = 0
  /** Where the method starts in `head`; the method is `head[methodStart .. methodEnd)`, for a log line or a `Router.match`. */
  methodStart: i32 = 0
  /** Where the method ends in `head`, one past its last byte. */
  methodEnd: i32 = 0
  /** Where the request target (path and query) starts in `head`; the target is `head[targetStart .. targetEnd)`. */
  targetStart: i32 = 0
  /** Where the request target ends in `head`, one past its last byte. */
  targetEnd: i32 = 0
  /**
   * Where the path ends: the target's first `?`, or its end.
   * @internal Set by `HttpHandler` in this module from the router's `pathEnd` once it has routed the request,
   * so the path is scanned once; copied by std/net/serve.ts with the head, and read by `pathIs` and `queryIndex`.
   */
  pathEnd: i32 = 0
  /**
   * How many bytes of `head` are this request's head: every span lies inside `head[0 .. headLength)`.
   * @internal Set by `HttpHandler` in this module when it copies the head, and read by std/net/serve.ts to copy a request.
   */
  headLength: i32 = 0
  /**
   * How many fields `spans` describes.
   * @internal Set by `HttpHandler` in this module when it copies the head, and read by `header`.
   */
  headerCount: i32 = 0
  /** How many bytes of `body` are the request's body, 0 for none; read the body as `body[0 .. bodyLength)`. */
  bodyLength: i32 = 0
  /**
   * The content coding the handler decoded `body` from: `HTTP_CODING_GZIP`
   * or `HTTP_CODING_DEFLATE`, or `HTTP_CODING_IDENTITY` for a body that is
   * as it arrived. Its `Content-Encoding` field is kept in `head` either way.
   */
  decodedFrom: i32 = 0
  /**
   * The status the handler answers in the program's place, 413 or 400, or 0.
   * @internal Set by `HttpHandler` in this module when a body does not decode, and answered by `ready`.
   */
  refusal: i32 = 0
  /** The connection's slot, and its generation when this request was read. */
  slot: i32 = 0
  /**
   * The slot's generation when this request was read.
   * @internal Read by `HttpHandler` in this module, which drops a reply to a slot that has since closed and been reused.
   */
  gen: i32 = 0
  /** Its index in the handler's pool. */
  index: i32 = 0
  /**
   * Where the request is in its life, one of the module's private `HANDLER_*` states.
   * @internal Moved by `HttpHandler` in this module from the free list through reading, queued, held and streaming, and back.
   */
  state: i32 = 0
  /**
   * Where the unsent bytes in `pending` start.
   * @internal Advanced by `HttpHandler` in this module as the carrier takes pending bytes.
   */
  pendingStart: i32 = 0
  /**
   * Where the unsent bytes in `pending` end.
   * @internal Advanced by `HttpHandler` in this module as `write` keeps what the carrier had no room for.
   */
  pendingEnd: i32 = 0
  /**
   * The steps `before` has still to hand out, one bit each; loaded from the router by the first `before`.
   * @internal Moved only by `HttpHandler.before` in this module.
   */
  stepsLeft: i32 = 0
  /**
   * The steps `before` handed out that `after` has still to hand out again.
   * @internal Moved by `HttpHandler.before` and `after` in this module.
   */
  stepsRan: i32 = 0
  /**
   * Whether `before` has loaded the route's steps into `stepsLeft`.
   * @internal Set by `HttpHandler.before` and cleared when the request is read, in this module.
   */
  stepped: boolean = false
  /**
   * How many fields `field` added: `addedNames[0 .. added)` beside `addedValues`.
   * @internal Counted by `HttpHandler.field` in this module, read by `start`, and cleared when the request is read.
   */
  added: i32 = 0
  /**
   * The names `field` added, kept by reference until the answer starts.
   * @internal Grown by `HttpHandler.field` in this module, to at most `HANDLER_MAX_ADDED`, and kept for the requests after.
   */
  addedNames: u8[][]
  /**
   * The values `field` added, `addedValues[k]` for `addedNames[k]`.
   * @internal Grown beside `addedNames` by `HttpHandler.field` in this module.
   */
  addedValues: u8[][]

  /**
   * An empty request for the handler's pool; its buffers grow to the first
   * request it holds and are kept for the ones after.
   * @param index its place in the handler's pool, which the free list and the queue name it by
   */
  constructor(index: i32) {
    this.index = index
    this.head = []
    this.spans = []
    this.params = []
    this.body = []
    this.pending = []
    this.addedNames = []
    this.addedValues = []
  }

  /**
   * Whether the method is exactly `method` (methods are case-sensitive, RFC 9110 §9.1).
   * @param method the method name to compare with, such as `"GET"`
   * @returns true when the request's method is byte for byte `method`
   */
  methodIs(method: string): boolean {
    return handlerSpanIs(this.head, this.methodStart, this.methodEnd, method)
  }

  /**
   * Whether the path, the target up to its `?`, is exactly `path`.
   * @param path the raw path to compare with, still percent-encoded as it came on the wire
   * @returns true when the target's path, without its query, is byte for byte `path`
   */
  pathIs(path: string): boolean {
    return handlerSpanIs(this.head, this.targetStart, this.pathEnd, path)
  }

  /**
   * Where parameter `k` starts in `head`. Panics on a parameter the route does not have, a caller contract; `tryParam...` answers `Err` instead.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the byte offset in `head` of the parameter's first raw byte
   */
  paramStart(k: i32): i32 {
    return this.paramBound(k, HANDLER_ZERO)
  }

  /**
   * Where parameter `k` ends in `head`. Panics on a parameter the route does not have, a caller contract; `tryParam...` answers `Err` instead.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the byte offset in `head` just past the parameter's last raw byte
   */
  paramEnd(k: i32): i32 {
    return this.paramBound(k, toI32(1))
  }

  /**
   * Whether parameter `k`, raw, is exactly `text`. Panics on a parameter the route does not have, a caller contract; `tryParam...` answers `Err` instead.
   * @param k the parameter's position in the route pattern, from 0
   * @param text the value to compare with, as it would appear still percent-encoded
   * @returns true when the raw parameter bytes are exactly `text`
   */
  paramIs(k: i32, text: string): boolean {
    return handlerSpanIs(this.head, this.paramBound(k, HANDLER_ZERO), this.paramBound(k, toI32(1)), text)
  }

  /**
   * Parameter `k` percent-decoded into `out` from 0 (`routerDecode`): its
   * length, `ROUTER_BAD_ESCAPE` for a malformed escape, or `ROUTER_NO_ROOM`
   * when `out` is too short. Nothing is written on a code. Panics on a parameter the route does not have, a caller contract; `tryParam...` answers `Err` instead.
   * @param k the parameter's position in the route pattern, from 0
   * @param out where the decoded bytes go, from index 0; the caller's buffer
   * @returns how many decoded bytes were written, or a negative `ROUTER_*` code
   */
  param(k: i32, out: u8[]): i32 {
    return routerDecode(this.head, this.paramBound(k, HANDLER_ZERO), this.paramBound(k, toI32(1)), out)
  }

  /**
   * Parameter `k` read as a decimal number that is not negative and fits an
   * `i32`, or -1. Panics on a parameter the route does not have, a caller contract; `tryParam...` answers `Err` instead.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the number the parameter's digits spell, or -1 when it is empty, holds a non-digit or overflows
   */
  paramDecimal(k: i32): i32 {
    return handlerDecimal(this.head, this.paramBound(k, HANDLER_ZERO), this.paramBound(k, toI32(1)))
  }

  /**
   * Where parameter `k` starts in `head`, or an error naming the parameter the route does not have.
   * @param k the parameter's position in the route pattern, from 0
   * @returns `Ok` with the byte offset in `head` of the parameter's first raw byte, or `Err` when the route has no parameter `k`
   */
  tryParamStart(k: i32): Result<i32, string> {
    return this.tryParamBound(k, HANDLER_ZERO)
  }

  /**
   * Where parameter `k` ends in `head`, or an error naming the parameter the route does not have.
   * @param k the parameter's position in the route pattern, from 0
   * @returns `Ok` with the byte offset in `head` just past the parameter's last raw byte, or `Err` when the route has no parameter `k`
   */
  tryParamEnd(k: i32): Result<i32, string> {
    return this.tryParamBound(k, toI32(1))
  }

  /**
   * Parameter `k` read as a decimal number, as `paramDecimal` reads it, or an
   * error naming the parameter the route does not have.
   * @param k the parameter's position in the route pattern, from 0
   * @returns `Ok` with the number, or -1 when the parameter is empty, holds a non-digit or overflows; `Err` when the route has no parameter `k`
   */
  tryParamDecimal(k: i32): Result<i32, string> {
    const start = this.tryParamBound(k, HANDLER_ZERO)
    if (start.isErr()) {
      return Err(start.error)
    }
    const end = this.tryParamBound(k, toI32(1))
    if (end.isErr()) {
      return Err(end.error)
    }
    return Ok(handlerDecimal(this.head, start.value, end.value))
  }

  /**
   * Parameter `k`'s start (`side` 0) or end (`side` 1) in `head`: the one
   * place the parameter contract panics.
   */
  private paramBound(k: i32, side: i32): i32 {
    const bound: i32 = this.paramAt(k, side)
    if (bound < 0) {
      // A parameter the route does not have: the program's own mistake.
      panic(this.paramFault(k))
    }
    return bound
  }

  /**
   * Parameter `k`'s start (`side` 0) or end (`side` 1) in `head`, or why the
   * route has no parameter `k`.
   */
  private tryParamBound(k: i32, side: i32): Result<i32, string> {
    const bound: i32 = this.paramAt(k, side)
    if (bound < 0) {
      return Err(this.paramFault(k))
    }
    return Ok(bound)
  }

  /**
   * Parameter `k`'s start (`side` 0) or end (`side` 1) in `head`, or -1 when
   * the route has no parameter `k`: an offset in `head` is never negative, so
   * -1 is no answer a span gives. It builds no `Result`, so the hot path
   * allocates nothing. The literal bound on `k` comes first, so `2 * k + 1`
   * is seen not to overflow; a route holds far fewer parameters.
   */
  private paramAt(k: i32, side: i32): i32 {
    if (k < 0 || k >= this.paramCount || k > 65535) {
      return -1
    }
    const at: i32 = 2 * k
    if (at + 1 >= toI32(this.params.length)) {
      return -1
    }
    return side === 0 ? this.params[at] : this.params[at + 1]
  }

  /** Why `paramAt` gave -1 for parameter `k`. */
  private paramFault(k: i32): string {
    if (k < 0 || k >= this.paramCount) {
      return `HttpRequest.param: the route has ${this.paramCount} parameter(s), not one at ${k}`
    }
    if (k > 65535) {
      return `HttpRequest.param: parameter ${k} is past the 65536 a route can hold`
    }
    return `HttpRequest.param: the request holds no span for parameter ${k}`
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
    return this.queryScan(name, out, true)
  }

  /**
   * Whether the query holds a parameter named `name`.
   * @param name the parameter name to look for, compared with each name after decoding
   * @returns true when some pair in the query has that name, even with an empty value
   */
  hasQuery(name: string): boolean {
    return this.queryIndex(name) >= 0
  }

  /** The span `queryIndex` found, raw. */
  queryValueStart: i32 = 0
  /** Where the raw value `queryIndex` found ends in `head`, one past its last byte; it starts at `queryValueStart`. */
  queryValueEnd: i32 = 0

  /**
   * Finds the first parameter named `name`: where its pair starts, or -1; its raw value goes to `queryValue...`.
   * @param name the parameter name to look for, compared with each name after decoding
   * @returns the byte offset in `head` where the matching `name=value` pair starts, or -1 when none matches
   */
  queryIndex(name: string): i32 {
    // Without `decode` the walk writes nothing to `out`.
    return this.queryScan(name, this.head, false)
  }

  /**
   * `queryIndex`'s walk: with `decode`, the matching value decoded into `out`
   * as `query` answers it (`HANDLER_ABSENT` when none matches), else the
   * pair's start or -1. The decode reads the span the walk proved inside
   * `head`, so it needs no check of its own.
   */
  private queryScan(name: string, out: u8[], decode: boolean): i32 {
    const none: i32 = decode ? HANDLER_ABSENT : -1
    // The target lies inside `head`; the bound says so to the prover.
    const length: i32 = toI32(this.head.length)
    const end: i32 = this.targetEnd < length ? this.targetEnd : length
    // A path that runs to the target's end has no query.
    const pathEnd: i32 = this.pathEnd
    if (pathEnd < 0 || pathEnd >= end || pathEnd >= length) {
      return none
    }
    let at: i32 = pathEnd + 1
    while (at < end) {
      let pairEnd: i32 = at
      while (
        pairEnd >= 0 &&
        pairEnd < end &&
        pairEnd < toI32(this.head.length) &&
        toI32(this.head[pairEnd]) !== 38
      ) {
        pairEnd += 1
      }
      let keyEnd: i32 = at
      while (
        keyEnd >= 0 &&
        keyEnd < pairEnd &&
        keyEnd < toI32(this.head.length) &&
        toI32(this.head[keyEnd]) !== 61
      ) {
        keyEnd += 1
      }
      if (handlerFormIs(this.head, at, keyEnd, name)) {
        // A pair with no `=` has an empty value, at its end. The length is
        // worked in 64 bits: both ends lie inside `head`, so it is exact, but
        // the prover keeps no lower bound on `keyEnd` across the loop.
        const valueStart: i32 = keyEnd < pairEnd ? keyEnd + 1 : pairEnd
        const valueLength: i32 = keyEnd < pairEnd ? toI32(toI64(pairEnd) - toI64(keyEnd) - 1) : 0
        this.queryValueStart = valueStart
        this.queryValueEnd = pairEnd
        return decode ? handlerFormDecode(this.head, valueStart, valueLength, out) : at
      }
      // The last pair ends the query.
      if (pairEnd >= end) {
        return none
      }
      at = pairEnd + 1
    }
    return none
  }

  /**
   * The index of the first field named `name`, which is lowercase, or `HANDLER_ABSENT`.
   * @param name the field name in lowercase, since the parser lowercased every name it kept
   * @returns the field's index for `valueStart` and `valueEnd`, or `HANDLER_ABSENT` when no field has the name
   */
  header(name: string): i32 {
    // `at` steps four slots a field, so it is `4 * i` without the product;
    // the literal bound keeps the step from overflowing.
    let at: i32 = 0
    for (let i: i32 = 0; i < this.headerCount && at < 1048576 && at + 1 < toI32(this.spans.length); i++) {
      if (handlerSpanIs(this.head, this.spans[at], this.spans[at + 1], name)) {
        return i
      }
      at += 4
    }
    return HANDLER_ABSENT
  }

  /**
   * Where field `i`'s value starts in `head`. Panics on an `i` that is not a
   * field index, a caller contract: pass only what `header` answered, after
   * checking it is not `HANDLER_ABSENT`.
   * @param i a field index, as `header` answered it
   * @returns the byte offset in `head` of the value's first byte
   */
  valueStart(i: i32): i32 {
    return this.valueBound(i, toI32(2))
  }

  /**
   * Where field `i`'s value ends in `head`. Panics on an `i` that is not a
   * field index, a caller contract: pass only what `header` answered, after
   * checking it is not `HANDLER_ABSENT`.
   * @param i a field index, as `header` answered it
   * @returns the byte offset in `head` just past the value's last byte
   */
  valueEnd(i: i32): i32 {
    return this.valueBound(i, toI32(3))
  }

  /**
   * Where field `i`'s value starts in `head`, or an error when `i` is not a
   * field index `header` answered.
   * @param i a field index, as `header` answered it
   * @returns `Ok` with the byte offset in `head` of the value's first byte, or `Err` naming `i`
   */
  tryValueStart(i: i32): Result<i32, string> {
    return this.tryValueBound(i, toI32(2))
  }

  /**
   * Where field `i`'s value ends in `head`, or an error when `i` is not a
   * field index `header` answered.
   * @param i a field index, as `header` answered it
   * @returns `Ok` with the byte offset in `head` just past the value's last byte, or `Err` naming `i`
   */
  tryValueEnd(i: i32): Result<i32, string> {
    return this.tryValueBound(i, toI32(3))
  }

  /** Field `i`'s value start (`part` 2) or end (`part` 3): the one place the field contract panics. */
  private valueBound(i: i32, part: i32): i32 {
    const bound: i32 = this.valueAt(i, part)
    if (bound < 0) {
      // A field index `header` did not answer: the program's own mistake.
      panic(this.valueFault(i))
    }
    return bound
  }

  /** Field `i`'s value start (`part` 2) or end (`part` 3) in `head`, or why `i` is no field index. */
  private tryValueBound(i: i32, part: i32): Result<i32, string> {
    const bound: i32 = this.valueAt(i, part)
    if (bound < 0) {
      return Err(this.valueFault(i))
    }
    return Ok(bound)
  }

  /**
   * Field `i`'s value start (`part` 2) or end (`part` 3) in `head`, or -1 when
   * `i` is no field index: an offset in `head` is never negative. It builds
   * no `Result`, so the hot path allocates nothing.
   */
  private valueAt(i: i32, part: i32): i32 {
    const at: i32 = handlerSpanSlot(i, part)
    if (i < 0 || i >= this.headerCount || at < 0 || at >= toI32(this.spans.length)) {
      return -1
    }
    return this.spans[at]
  }

  /** Why `valueAt` gave -1 for field `i`. */
  private valueFault(i: i32): string {
    return `HttpRequest.value: ${i} is not a field index of the ${this.headerCount} \`header\` answers`
  }

  /**
   * Whether the first field named `name` (lowercase) has exactly the value `value`.
   * @param name the field name in lowercase
   * @param value the value to compare with, byte for byte and case-sensitive
   * @returns true when the field is present and its first occurrence has exactly that value
   */
  headerIs(name: string, value: string): boolean {
    // An absent field (`HANDLER_ABSENT`) is no field index: both answer -1.
    const i: i32 = this.header(name)
    const start: i32 = this.valueAt(i, toI32(2))
    const end: i32 = this.valueAt(i, toI32(3))
    if (start < 0 || end < 0) {
      return false
    }
    return handlerSpanIs(this.head, start, end, value)
  }
}

/**
 * The HTTP/1.1 server: a carrier, its readiness loop, a router and a pool of
 * requests. One per thread; nothing in it is shared.
 *
 * A `try` twin refuses a broken contract with an `Err`, and what it leaves
 * depends on whether the response's head went out:
 *
 * - **Refused before the head** — a request not taken or already answered,
 *   a status outside 200 to 599, a one-shot answer's body window outside its
 *   buffer (`trySend`): nothing is sent and `r` is as it was, so a request
 *   still owed an answer can be answered again (a bare 500, say).
 * - **Abandoned after the head** — a head the carrier refuses (a reserved
 *   field, a name or value that is not field text), a `tryWrite` window
 *   outside its buffer or more body than the declared length (the head went
 *   out with `tryStart`, so these fall here, not above), or a body short of
 *   it (`tryEnd`): the response cannot be completed, so the connection is
 *   closed and `r` is the handler's again. Nothing more is owed for `r`; a
 *   further answer for it is refused too.
 *
 * The plain methods panic with the same message where their twins refuse.
 */
export class HttpHandler {
  /**
   * The HTTP/1.1 carrier the handler drives.
   * @internal Read only by this class, which accepts, reads, flushes and closes connections through it.
   */
  server: Http1Server
  private router: Router
  /** Every request the pool has made, and the indices of the free ones. */
  private requests: HttpRequest[]
  private free: i32[]
  /** Whole requests waiting for `take`, a ring of `queue.length` with `queueCount` from `queueStart`. */
  private queue: i32[]
  /** Per slot: its generation, its request (-1 for none), and whether it holds a connection. */
  private slotGen: i32[]
  private current: i32[]
  private open: boolean[]
  /** Whether a slot is in `owed`: an answer's send was put off for the request queued behind it. */
  private owing: boolean[]
  /** The slots whose send `flush` still owes, `owedCount` of them. */
  private owed: i32[]
  /** `HandlerLimits.minEvents`: above 1 with `maxWaitMs` above 0, `wait` calls `pollWaitBatch`. */
  private minEvents: i32 = 1
  /** `HandlerLimits.maxWaitMs`. */
  private maxWaitMs: i32 = 0
  /** `pollWait`'s output. */
  private readyFds: i32[]
  /** Per watched id: whether its descriptor was ready in the last `wait`. */
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
  /** Decodes `gzip` and `deflate` bodies under `HandlerLimits.maxDecoded`; null while that is 0. */
  private decoder: HttpBodyDecoder | null
  private noFields: u8[][]
  /** Per length: the array `start` gathers an answer's fields and the fields `field` added into, kept for the answers after. */
  private namesBy: u8[][][]
  private valuesBy: u8[][][]
  /**
   * When an accept failed for want of a resource (EMFILE for descriptors,
   * ENFILE for ring slots, ENOMEM): the listener is out of the loop until
   * then, or until a connection closes (`forget`), which it would otherwise
   * wake every turn while its connection waits. 0 while it is in the loop.
   */
  private acceptRestUntil: i64 = 0
  /** `bodyTimeout` in nanoseconds. */
  private bodyTimeout: i64 = 0
  /**
   * When the current turn's sockets were ready (`monotonicNanos`): a head read in it is stamped with this.
   * @internal Read by std/net/upstream.ts, whose `pump` compares it with the last turn it saw to run once per handler turn.
   */
  turnAt: i64 = 0
  /** When `wait` next looks for a body past `bodyTimeout`. */
  private bodyCheckAt: i64 = 0
  private listener: i32 = 0
  /**
   * The readiness loop's descriptor, from `pollCreate`.
   * @internal Read by std/net/upstream.ts to add its upstream sockets to the same loop, so one `wait` serves both.
   */
  loop: i32 = 0
  private queueStart: i32 = 0
  private queueCount: i32 = 0
  private owedCount: i32 = 0
  /** `HandlerLimits.maxDecoded`, 0 to decode nothing. */
  private maxDecoded: i32 = 0
  private sent: i64 = 0
  private outputSize: i32 = 0
  /** Set by `drain`: accept nothing more and close each connection once it is idle. */
  private draining: boolean = false
  /** Set by `deferSends`: a send may wait for `flush`. Off, every answer is sent as it ends. */
  private deferring: boolean = false
  /** Whether `json` gave out the writer for a value `sendJson` has not yet sent. */
  private jsonBegun: boolean = false
  /** Why the last core answered `HANDLER_REFUSED`. */
  private refusal: string = ""

  /**
   * A handler over `listener`, a listening socket the program made
   * (`tcpListen`, or `tcpListenFlags` with SO_REUSEPORT for a worker of
   * `nish/net/prefork`), routing through `router`, whose routes are added
   * before the first `wait`. `limits.ring` acts only through the listener:
   * open it with `limits.listen`, since a listener from `tcpListen` stays on
   * descriptors whatever `ring` says.
   * @param limits the caps and timeouts. `slots`, `jsonBytes`, `maxEvents`,
   *   `bodyTimeout`, `minEvents` and `maxWaitMs` are read once here, so
   *   changing them later has no effect; `http` is kept by the carrier, which reads its timeouts and
   *   caps live
   * @param listener the listening socket's descriptor, still the program's to close
   * @param router the routes, which the handler keeps and consults at each request head
   * @param loop a readiness loop from `pollCreate` for the handler to own, or
   *   -1 (the default) to make one here; any other negative is a failed
   *   `pollCreate` passed through. A failed loop, passed in or made here,
   *   leaves the handler dead: it watches nothing and each `wait` answers
   *   `HANDLER_NO_LOOP` at once. Panics on limits below their least, a
   *   contract of this constructor: use `openHttpHandler` for a `Result`,
   *   which also answers a failed `pollCreate` as an `Err`.
   */
  constructor(limits: HandlerLimits, listener: i32, router: Router, loop: i32 = -1) {
    handlerCheckLimits(limits)
    this.maxDecoded = limits.maxDecoded
    this.decoder = handlerDecoder(limits.maxDecoded)
    this.bodyTimeout = toI64(limits.bodyTimeout) * HANDLER_NANOS_PER_MS
    this.minEvents = limits.minEvents
    this.maxWaitMs = limits.maxWaitMs
    this.server = new Http1Server(limits.http, listener, limits.slots)
    this.router = router
    this.listener = listener
    this.outputSize = limits.http.outputSize
    this.requests = []
    this.free = []
    this.queue = new Array<i32>(16)
    this.slotGen = handlerInts(limits.slots, HANDLER_ZERO)
    this.current = handlerInts(limits.slots, -1)
    this.open = handlerFlags(limits.slots)
    this.owing = handlerFlags(limits.slots)
    this.owed = handlerInts(limits.slots, HANDLER_ZERO)
    this.readyFds = handlerInts(handlerAdd(limits.maxEvents, limits.maxEvents), HANDLER_ZERO)
    this.watchedFired = handlerFlags(HANDLER_MAX_WATCHED)
    this.scratch = handlerBytes(limits.jsonBytes)
    this.writer = new JsonWriter(this.scratch, HANDLER_ZERO)
    this.probe = handlerInts(handlerProbeLength(router.maxParams), HANDLER_ZERO)
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
    this.namesBy = []
    this.valuesBy = []
    this.loop = loop === -1 ? pollCreate() : loop
    // A failed loop leaves the handler dead, and `wait` says so.
    if (this.loop >= 0) {
      pollAdd(this.loop, listener, H1_WANT_READ, HANDLER_LISTENER)
    }
  }

  // ---- The loop -------------------------------------------------------------------

  /**
   * Watches `fd` for reading beside the handler's sockets, as `id` (0 to
   * `HANDLER_MAX_WATCHED - 1`): `fired(id)` says whether it was ready in the
   * last `wait`. For a program's own descriptors — `signalFd()` for a
   * graceful stop, a pipe from another thread.
   * @param fd the program's descriptor to watch for reading; it stays the program's to read and close
   * @param id the name `fired` asks about it by, from 0 to `HANDLER_MAX_WATCHED - 1`
   */
  watch(fd: i32, id: i32): void {
    if (id < 0 || id >= HANDLER_MAX_WATCHED) {
      panic(`HttpHandler.watch: id ${id} is outside 0 to ${HANDLER_MAX_WATCHED - 1}`)
    }
    pollAdd(this.loop, fd, H1_WANT_READ, -2 - id)
  }

  /**
   * `watch`, with an id outside the range answered as an `Err` instead of a panic.
   * @param fd the program's descriptor to watch for reading; it stays the program's to read and close
   * @param id the name `fired` asks about it by, from 0 to `HANDLER_MAX_WATCHED - 1`
   * @returns `Ok(true)` once `fd` is watched, or `Err` naming the id outside the range or the handler's lack of a readiness loop
   */
  tryWatch(fd: i32, id: i32): Result<boolean, string> {
    if (id < 0 || id >= HANDLER_MAX_WATCHED) {
      return Err(`HttpHandler.watch: id ${id} is outside 0 to ${HANDLER_MAX_WATCHED - 1}`)
    }
    if (this.loop < 0) {
      return Err("HttpHandler.watch: the handler has no readiness loop")
    }
    pollAdd(this.loop, fd, H1_WANT_READ, -2 - id)
    return Ok(true)
  }

  /**
   * Whether watched descriptor `id` was ready in the last `wait`.
   * @param id the name the descriptor was given to `watch`
   * @returns true when it was readable in the last turn; false for an id outside the range
   */
  fired(id: i32): boolean {
    return (
      id >= 0 && id < HANDLER_MAX_WATCHED && id < toI32(this.watchedFired.length) && this.watchedFired[id]
    )
  }

  /**
   * One turn of the loop: waits up to `timeoutMs` (-1 for no limit) for a
   * socket to be ready, accepts, reads and writes what is, closes the
   * connections past their timeouts, and answers how many whole requests
   * are waiting for `take`.
   * @param timeoutMs the longest to block, in milliseconds, or -1 to block until something is ready
   * @returns how many whole requests are queued for `take` after this turn,
   *   or `HANDLER_NO_LOOP` at once, without blocking, from a handler whose
   *   constructor was given a failed `pollCreate`
   */
  wait(timeoutMs: i32): i32 {
    if (this.loop < 0) {
      return HANDLER_NO_LOOP
    }
    this.flush()
    const fired: boolean[] = this.watchedFired
    for (let id: i32 = 0; id < HANDLER_MAX_WATCHED && id < toI32(fired.length); id++) {
      fired[id] = false
    }
    if (this.acceptRestUntil > 0 && monotonicNanos() >= this.acceptRestUntil) {
      this.endAcceptRest()
    }
    let timeout: i32 = timeoutMs
    if (this.acceptRestUntil > 0 && !this.draining) {
      // Wake for the listener's return, whatever the program asked.
      const rest: i32 = handlerAdd(
        toI32(handlerSince(monotonicNanos(), this.acceptRestUntil) / toI64(1000000)),
        1
      )
      if (timeout < 0 || rest < timeout) {
        timeout = rest
      }
    }
    if (this.deferring && this.queueCount > 0) {
      // A send `flush` made let a parked request in: it is ready now. Only
      // owed sends can do that; without `deferSends` a request left queued
      // is the program's to take, and the turn blocks as it always has.
      timeout = 0
    }
    // A turn that must not block (`timeout` 0) never waits for a batch.
    const n: i32 =
      this.minEvents > 1 && this.maxWaitMs > 0 && timeout !== 0
        ? pollWaitBatch(this.loop, this.readyFds, timeout, this.minEvents, this.maxWaitMs)
        : pollWait(this.loop, this.readyFds, timeout)
    const now: i64 = monotonicNanos()
    this.turnAt = now
    const fds: i32[] = this.readyFds
    // Two numbers an event; the literal bound keeps `2 * k + 1` in an `i32`.
    for (let k: i32 = 0; k < n && k < 1048576; k++) {
      const at: i32 = 2 * k
      if (at + 1 >= toI32(fds.length)) {
        break
      }
      const token: i32 = fds[at]
      const bits: i32 = fds[at + 1]
      if (token === HANDLER_LISTENER) {
        this.acceptAll()
      } else if (token <= -2) {
        const id: i32 = handlerSub(-2, token)
        if (id >= 0 && id < HANDLER_MAX_WATCHED && id < toI32(fired.length)) {
          fired[id] = true
        }
      } else if (token >= 0 && this.server.holds(token)) {
        if ((bits & HANDLER_READ_BITS) !== 0) {
          this.server.readable(token)
        } else {
          this.server.writable(token)
        }
        this.drive(token)
      }
    }
    if (this.server.expire(now) > 0) {
      this.sweep()
    }
    if (now >= this.bodyCheckAt) {
      this.bodyCheckAt = handlerLater(now, HANDLER_BODY_SWEEP)
      this.expireBodies(now)
    }
    return this.queueCount
  }

  /**
   * Lets the handler put a connection's send off until `flush`, so the
   * answers to a pipelined burst go out in one write. Off by default, so an
   * answer is sent as it ends. A program that turns it on calls `flush` (or
   * `wait`, which flushes) after each turn of answers, before it blocks;
   * `nish/net/serve` does.
   */
  deferSends(): void {
    this.deferring = true
  }

  /**
   * Begins a graceful stop: the handler accepts no more connections, closes
   * each idle one now, and closes each other one once the request on it is
   * answered and sent, so `connections()` falls to 0 as the program answers
   * what it holds. A request already read on a draining connection is still
   * handed over and answered. The listener is the program's to close.
   */
  drain(): void {
    if (this.draining) {
      return
    }
    this.draining = true
    if (this.acceptRestUntil === 0) {
      pollRemove(this.loop, this.listener)
    }
    const open: boolean[] = this.open
    const current: i32[] = this.current
    for (let s: i32 = 0; s < toI32(open.length) && s < toI32(current.length); s++) {
      const isOpen: boolean = open[s]
      const idle: boolean = current[s] === -1
      if (isOpen && this.server.holds(s) && idle && (this.server.resting(s) || !this.owesOutput(s))) {
        this.closeSlot(s)
      } else if (isOpen && this.server.holds(s)) {
        // Its exchange is its last: the answer says `Connection: close` if
        // it is not yet started, and no pipelined request is read behind it.
        const conn: Http1Connection | null = this.server.tryConnection(s)
        if (conn !== null) {
          conn.closeAfter = true
        }
      }
    }
  }

  /** Whether `slot`'s connection has output waiting for its socket; false when the server gives it none. */
  private owesOutput(slot: i32): boolean {
    const conn: Http1Connection | null = this.server.tryConnection(slot)
    return conn !== null && conn.wantsWrite()
  }

  /** Takes every waiting connection. */
  private acceptAll(): void {
    if (this.draining) {
      return
    }
    let slot: i32 = this.server.accept()
    while (slot >= 0 || slot === H1_POOL_FULL || slot === HANDLER_ACCEPT_ABORTED) {
      const open: boolean[] = this.open
      const current: i32[] = this.current
      // The carrier hands only its own slots, each with a place in both.
      if (slot >= 0 && slot < toI32(open.length) && slot < toI32(current.length)) {
        open[slot] = true
        current[slot] = -1
        pollAdd(this.loop, this.server.fd(slot), H1_WANT_READ, slot)
      }
      slot = this.server.accept()
    }
    if (slot !== HANDLER_ACCEPT_NONE) {
      // Out of descriptors (-24), ring slots (-23) or memory: the connection
      // stays in the backlog and the listener stays readable, so rest it
      // rather than spin, until a close frees one or the rest ends.
      pollRemove(this.loop, this.listener)
      this.acceptRestUntil = handlerLater(monotonicNanos(), HANDLER_ACCEPT_REST)
    }
  }

  /**
   * Sends every answer whose send was put off, so the connection's answers to
   * a pipelined burst go out in one write. `wait` calls it before it blocks; a
   * program that blocks elsewhere, as `nish/net/serve` does, calls it first.
   */
  flush(): void {
    const n: i32 = this.owedCount
    this.owedCount = 0
    const owed: i32[] = this.owed
    const owing: boolean[] = this.owing
    const open: boolean[] = this.open
    for (let k: i32 = 0; k < n && k < toI32(owed.length); k++) {
      const slot: i32 = owed[k]
      if (slot < 0 || slot >= toI32(owing.length) || slot >= toI32(open.length)) {
        continue
      }
      owing[slot] = false
      const conn: Http1Connection | null =
        open[slot] && this.server.holds(slot) ? this.server.tryConnection(slot) : null
      if (conn !== null) {
        this.settle(slot, conn)
      }
    }
  }

  /**
   * How many times the handler handed a connection's waiting output to its
   * socket: one per connection per pass, however many answers it holds.
   * @returns the count of sends since the handler was made, each one write or a few for a partial one
   */
  sends(): i64 {
    return this.sent
  }

  /**
   * Takes `slot`'s events until it needs the socket again, then sends what it
   * holds and re-arms it, or closes it once it is over. While `owable` allows,
   * the send waits for `flush`, so the answers behind this one go out with it.
   */
  private drive(slot: i32): void {
    const conn: Http1Connection | null = this.server.tryConnection(slot)
    if (conn === null) {
      // The server could build no connection for it: nothing to drive.
      this.closeSlot(slot)
      return
    }
    let event: i32 = this.unended(slot) ? H1_NEED_MORE : this.server.next(slot)
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
      event = this.unended(slot) ? H1_NEED_MORE : this.server.next(slot)
    }
    if (event === H1_ERROR) {
      // The carrier has written its refusal and ends the connection; a
      // request it was reading is nobody's.
      this.releaseReading(slot)
    } else if (this.owable(slot, conn) && slot >= 0 && slot < toI32(this.owing.length)) {
      if (this.owing[slot]) {
        return
      }
      // `owed` has a place for every slot and holds each at most once, so `n` is in range.
      const n: i32 = this.owedCount
      if (n >= 0 && n < toI32(this.owed.length)) {
        this.owing[slot] = true
        this.owed[n] = slot
        this.owedCount = n + 1
        return
      }
    }
    this.settle(slot, conn)
  }

  /**
   * Whether `slot`'s response is under way with every byte handed over but
   * not yet ended. The carrier finishes a `Content-Length` response once its
   * last byte is written and would read the next request on the next `next`,
   * so `drive` does not ask the slot again until the program's `end`: until
   * then the response is the program's, and a pipelined request behind it
   * waits (#1556).
   */
  private unended(slot: i32): boolean {
    const r: HttpRequest | null = this.requestAt(this.currentOf(slot))
    return r !== null && r.state === HANDLER_STREAMING && r.pendingEnd === r.pendingStart
  }

  /**
   * Whether `slot`'s send can wait for `flush`: `deferSends` turned that on, it has output to send, the
   * output is still roomy, so more answers fit behind it, and no request on
   * it is parked waiting for the room a send makes. A connection with nothing
   * to send is settled at once, so a hang-up closes in the pass that reads it.
   * Nor does a held write wait: its `H1_WRITE` comes only from `next`, so a
   * send put off until the peer has read would empty the output, arm the slot
   * for reading alone, and leave the rest of the response unsent.
   * `flush` runs before every poll, so a send put off here goes out before
   * the handler waits.
   */
  private owable(slot: i32, conn: Http1Connection): boolean {
    const r: HttpRequest | null = this.requestAt(this.currentOf(slot))
    return (
      this.deferring &&
      !this.draining &&
      conn.wantsWrite() &&
      !conn.writeHeld &&
      this.roomy(conn) &&
      (r === null || r.state !== HANDLER_PARKED)
    )
  }

  /** The index of the request `slot` is reading or answering, or -1 for none (or a slot out of range). */
  private currentOf(slot: i32): i32 {
    return slot >= 0 && slot < toI32(this.current.length) ? this.current[slot] : -1
  }

  /** The request at index `at`, or null for -1 (or an index out of range). */
  private requestAt(at: i32): HttpRequest | null {
    return at >= 0 && at < toI32(this.requests.length) ? this.requests[at] : null
  }

  /** The request at the head of the queue, or null when the queue is empty. */
  private queued(): HttpRequest | null {
    const start: i32 = this.queueStart
    if (this.queueCount <= 0 || start < 0 || start >= toI32(this.queue.length)) {
      return null
    }
    return this.requestAt(this.queue[start])
  }

  /** Drops the request at the head of the queue. */
  private dequeue(): void {
    this.queueStart = handlerRing(this.queueStart, 1, toI32(this.queue.length))
    this.queueCount = handlerSub(this.queueCount, 1)
  }

  /** Sends what `slot` holds and re-arms it, or closes it once it is over; enqueues a parked request once there is room. */
  private settle(slot: i32, conn: Http1Connection): void {
    if (conn.wantsWrite()) {
      // Worked in `u64`, whose wrapping sum has the bits of the signed one: a
      // count of sends is centuries short of 2^63.
      this.sent = toI64(toU64(this.sent) + toU64(1))
    }
    // `flush` arms a held write for writing even once its send emptied the output.
    const wants: i32 = this.server.flush(slot)
    if ((wants & H1_DONE) !== 0) {
      this.closeSlot(slot)
      return
    }
    if (this.draining && this.currentOf(slot) === -1 && !conn.wantsWrite()) {
      this.closeSlot(slot)
      return
    }
    if (this.server.rearm(slot, wants)) {
      pollModify(this.loop, this.server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
    }
    const r: HttpRequest | null = this.requestAt(this.currentOf(slot))
    if (r !== null && r.state === HANDLER_PARKED && this.roomy(conn)) {
      this.enqueue(r)
    }
  }

  /** Whether `conn`'s output holds at most half its size unsent, so a response head fits behind it. */
  private roomy(conn: Http1Connection): boolean {
    // `2 * unsent <= size` is `unsent <= size / 2` for whole numbers, without the doubling.
    return toI64(conn.outputEnd) - toI64(conn.outputStart) <= toI64(this.outputSize) / toI64(2)
  }

  /** A head: a request from the free list, the head copied into it, and its route. */
  private begin(slot: i32, conn: Http1Connection): void {
    const current: i32[] = this.current
    const slotGen: i32[] = this.slotGen
    // `drive` hands only the carrier's slots, each with a place in both.
    if (slot < 0 || slot >= toI32(current.length) || slot >= toI32(slotGen.length)) {
      return
    }
    const gen: i32 = slotGen[slot]
    if (this.draining) {
      // A head read during the drain is the connection's last.
      conn.closeAfter = true
    }
    const r: HttpRequest = this.obtain()
    const p = conn.parser
    const length: i32 = p.headLength
    if (toI32(r.head.length) < length) {
      r.head = handlerBytes(handlerGrown(toI32(r.head.length), length))
    }
    // `r.head` was grown to `length` above and the parser's head holds it,
    // so the copy fits; were it refused, the request goes back unread and
    // the connection closes, since its head cannot be answered.
    if (!tryCopyBytes(r.head, HANDLER_ZERO, p.head, HANDLER_ZERO, length)) {
      this.free.push(r.index)
      this.closeSlot(slot)
      return
    }
    // Only the first `4 * headerCount` spans are this head's, and only those
    // are ever read, so only those are copied.
    const spanCount: i32 = handlerSpanSlot(p.headerCount, 0)
    if (toI32(r.spans.length) < spanCount) {
      r.spans = handlerInts(handlerGrown(toI32(r.spans.length), spanCount), HANDLER_ZERO)
    }
    for (let k: i32 = 0; k < spanCount && k < toI32(r.spans.length) && k < toI32(p.spans.length); k++) {
      r.spans[k] = p.spans[k]
    }
    r.headLength = length
    r.headerCount = p.headerCount
    r.methodStart = p.methodStart
    r.methodEnd = p.methodEnd
    r.targetStart = p.targetStart
    r.targetEnd = p.targetEnd
    r.bodyLength = 0
    r.decodedFrom = HTTP_CODING_IDENTITY
    r.refusal = 0
    r.slot = slot
    r.gen = gen
    r.since = this.turnAt
    r.state = HANDLER_READING
    r.pendingStart = 0
    r.pendingEnd = 0
    r.stepped = false
    r.added = 0
    this.route(r)
    // The router found where the path ends, before any query, as it matched.
    r.pathEnd = this.router.pathEnd
    if (slot < toI32(current.length)) {
      current[slot] = r.index
    }
  }

  /**
   * Routes `r` through the router. A HEAD that only a GET route matches takes
   * that route, since a GET resource answers HEAD (RFC 9110 §9.3.2) and the
   * carrier sends no body for it.
   */
  private route(r: HttpRequest): void {
    const params: i32[] = r.params
    let route: i32 = this.router.tryMatch(
      r.head,
      r.methodStart,
      r.methodEnd,
      r.head,
      r.targetStart,
      r.targetEnd,
      params
    )
    if (route === ROUTER_METHOD_NOT_ALLOWED && r.methodIs("HEAD")) {
      const get: i32 = this.router.methodIndex("GET")
      if (
        get >= 0 &&
        get < toI32(this.router.methodStart.length) &&
        get < toI32(this.router.methodEnd.length)
      ) {
        const viaGet: i32 = this.router.tryMatch(
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
    // A route `tryMatch` answered is one the table holds, so the count is never -1.
    const count: i32 = route >= 0 ? this.router.tryParamCount(route) : 0
    r.paramCount = count > 0 ? count : 0
  }

  /** Body bytes: appended to the request's body, which the carrier's cap bounds. */
  private gather(slot: i32, conn: Http1Connection): void {
    const r: HttpRequest | null = this.requestAt(this.currentOf(slot))
    if (r === null) {
      return
    }
    const n: i32 = conn.dataLength
    // The carrier's cap keeps a body far below 2^31 bytes.
    const need: i32 = handlerAdd(r.bodyLength, n)
    if (need < 0) {
      return
    }
    if (toI32(r.body.length) < need) {
      const grown: u8[] = handlerBytes(handlerGrown(toI32(r.body.length), need))
      // `grown` holds `need`, past `bodyLength`, so the copy fits; were it
      // refused, the body is lost, so the connection closes.
      if (!tryCopyBytes(grown, HANDLER_ZERO, r.body, HANDLER_ZERO, r.bodyLength)) {
        this.closeSlot(slot)
        return
      }
      r.body = grown
    }
    if (!tryCopyBytes(r.body, r.bodyLength, conn.data, conn.dataStart, n)) {
      this.closeSlot(slot)
      return
    }
    r.bodyLength = need
  }

  /** The request is whole: queued for `take`, or parked while the response before it is still mostly unsent. */
  private whole(slot: i32, conn: Http1Connection): void {
    const r: HttpRequest | null = this.requestAt(this.currentOf(slot))
    if (r === null) {
      return
    }
    this.decode(r)
    if (this.roomy(conn)) {
      this.enqueue(r)
    } else {
      r.state = HANDLER_PARKED
    }
  }

  /**
   * Decodes `r`'s body when its one `Content-Encoding` is gzip or deflate,
   * swapping the decoded bytes in as its body; a body that decodes past
   * `maxDecoded`, or not at all, is marked for `ready` to refuse.
   */
  private decode(r: HttpRequest): void {
    if (this.maxDecoded === 0 || r.bodyLength === 0) {
      return
    }
    let coding: i32 = HTTP_CODING_IDENTITY
    const spans: i32[] = r.spans
    for (let i: i32 = 0; i < r.headerCount; i++) {
      // A head's spans are four a field; the literal bound keeps `at + 3` in an `i32`.
      const at: i32 = handlerSpanSlot(i, 0)
      if (at < 0 || at > 1048576 || at + 3 >= toI32(spans.length)) {
        break
      }
      const valueStart: i32 = spans[at + 2]
      const valueEnd: i32 = spans[at + 3]
      if (handlerSpanIs(r.head, spans[at], spans[at + 1], "content-encoding")) {
        const named: i32 = httpTryContentEncoding(r.head, valueStart, valueEnd)
        if (named === HTTP_CODING_BAD_WINDOW) {
          // The spans are the parser's own, so this is a head the handler cannot read.
          r.refusal = toI32(400)
          return
        }
        // A second field stacks its codings on the first's (RFC 9110 §5.3).
        coding = coding === HTTP_CODING_IDENTITY ? named : HTTP_CODING_NONE
      }
    }
    if (coding !== HTTP_CODING_GZIP && coding !== HTTP_CODING_DEFLATE) {
      return
    }
    const decoder = this.decoder
    if (decoder === null) {
      return
    }
    // The window is the body's own, so `tryDecode`'s bad-call answer, a 400 below, cannot come.
    const got: i32 = decoder.tryDecode(coding, r.body, HANDLER_ZERO, r.bodyLength)
    if (got < 0) {
      r.refusal = got === HTTP_DECODE_TOO_LARGE ? toI32(413) : toI32(400)
      return
    }
    // The buffers change hands, so neither is copied or grown twice.
    const decoded: u8[] = decoder.output
    decoder.output = r.body
    r.body = decoded
    r.bodyLength = got
    r.decodedFrom = coding
  }

  private enqueue(r: HttpRequest): void {
    r.state = HANDLER_QUEUED
    const old: i32[] = this.queue
    const size: i32 = toI32(old.length)
    if (this.queueCount >= size) {
      const grown: i32[] = handlerInts(handlerAdd(size, size), -1)
      for (let k: i32 = 0; k < size && k < toI32(grown.length); k++) {
        const from: i32 = handlerRing(this.queueStart, k, size)
        if (from >= 0 && from < toI32(old.length)) {
          grown[k] = old[from]
        }
      }
      this.queue = grown
      this.queueStart = 0
    }
    const queue: i32[] = this.queue
    // `handlerRing` answers in `[0, size)` for a queue of `size` places.
    const end: i32 = handlerRing(this.queueStart, this.queueCount, toI32(queue.length))
    if (end >= 0 && end < toI32(queue.length)) {
      queue[end] = r.index
      this.queueCount = handlerAdd(this.queueCount, 1)
    }
  }

  /** `H1_WRITE`: the carrier has room again for the response under way. */
  private resume(slot: i32, conn: Http1Connection): void {
    const r: HttpRequest | null = this.requestAt(this.currentOf(slot))
    if (r === null) {
      return
    }
    if (r.state !== HANDLER_STREAMING && r.state !== HANDLER_FLUSHING) {
      return
    }
    this.pushPending(r, conn)
    if (r.state === HANDLER_FLUSHING) {
      this.finish(r, conn)
    }
  }

  /** Hands the carrier as much of `r`'s pending bytes as it takes. */
  private pushPending(r: HttpRequest, conn: Http1Connection): void {
    const pending: u8[] = r.pending
    const start: i32 = r.pendingStart
    const end: i32 = r.pendingEnd
    // `keep` holds `start <= end <= pending.length`; the test says so where
    // the checker reads it, and an empty window has nothing to hand over.
    if (start < 0 || start >= end || end > toI32(pending.length)) {
      return
    }
    const taken: i32 = conn.write(pending, start, end - start)
    if (taken > 0) {
      r.pendingStart = handlerAdd(r.pendingStart, taken)
    }
    if (r.pendingStart === r.pendingEnd) {
      r.pendingStart = 0
      r.pendingEnd = 0
    }
  }

  /** Ends `r`'s response once nothing is pending, and hands `r` back; otherwise leaves it flushing. */
  private finish(r: HttpRequest, conn: Http1Connection): void {
    r.state = HANDLER_FLUSHING
    if (r.pendingEnd > r.pendingStart) {
      return
    }
    // `H1_AGAIN`: no room for the last chunk yet; `H1_WRITE` comes back here.
    if (conn.end() === H1_AGAIN) {
      return
    }
    const current: i32[] = this.current
    const slot: i32 = r.slot
    if (slot >= 0 && slot < toI32(current.length)) {
      current[slot] = -1
    }
    this.release(r)
  }

  /** A free request, or a new one. */
  private obtain(): HttpRequest {
    const free: i32[] = this.free
    const count: i32 = toI32(free.length)
    if (count > 0) {
      const at: i32 = free[count - 1]
      if (free.length > 0) {
        free.pop()
      }
      const reused: HttpRequest | null = this.requestAt(at)
      if (reused !== null) {
        return reused
      }
    }
    const r: HttpRequest = new HttpRequest(toI32(this.requests.length))
    r.params = handlerInts(handlerProbeLength(this.router.maxParams), HANDLER_ZERO)
    this.requests.push(r)
    return r
  }

  private release(r: HttpRequest): void {
    if (r.state === HANDLER_FREE) {
      return
    }
    r.state = HANDLER_FREE
    this.free.push(r.index)
  }

  /** Hands back the request `slot` was reading when the carrier refused it. */
  private releaseReading(slot: i32): void {
    const r: HttpRequest | null = this.requestAt(this.currentOf(slot))
    const current: i32[] = this.current
    if (r !== null && r.state === HANDLER_READING && slot >= 0 && slot < toI32(current.length)) {
      current[slot] = -1
      this.release(r)
    }
  }

  /**
   * Closes `slot` and bumps its generation, so any answer still owed for it is
   * dropped. A request the handler alone holds goes back now; one queued or
   * taken goes back when `ready` passes it or the program answers it.
   */
  private closeSlot(slot: i32): void {
    this.server.close(slot)
    this.forget(slot)
  }

  /** Ends the listener's rest: it is back in the loop unless the handler is draining. */
  private endAcceptRest(): void {
    this.acceptRestUntil = 0
    if (!this.draining) {
      pollAdd(this.loop, this.listener, H1_WANT_READ, HANDLER_LISTENER)
    }
  }

  /**
   * The bookkeeping of a slot the carrier has closed. Its descriptor or ring
   * slot is free again, so a listener resting for want of one comes back.
   */
  private forget(slot: i32): void {
    if (this.acceptRestUntil > 0 && !this.draining) {
      this.endAcceptRest()
    }
    const open: boolean[] = this.open
    const slotGen: i32[] = this.slotGen
    const current: i32[] = this.current
    // Every slot the carrier hands has a place in all three.
    if (
      slot < 0 ||
      slot >= toI32(open.length) ||
      slot >= toI32(slotGen.length) ||
      slot >= toI32(current.length)
    ) {
      return
    }
    open[slot] = false
    slotGen[slot] = handlerAdd(slotGen[slot], 1)
    const r: HttpRequest | null = this.requestAt(current[slot])
    current[slot] = -1
    if (r !== null) {
      if (r.state === HANDLER_READING || r.state === HANDLER_PARKED || r.state === HANDLER_FLUSHING) {
        this.release(r)
      }
    }
  }

  /** Closes every connection whose request has been reading its body for longer than `bodyTimeout` at `now`. */
  private expireBodies(now: i64): void {
    for (let s: i32 = 0; s < toI32(this.current.length) && s < toI32(this.open.length); s++) {
      const at: i32 = this.current[s]
      if (this.open[s] && at >= 0 && at < toI32(this.requests.length)) {
        const r: HttpRequest = this.requests[at]
        const since: i64 = r.since
        if (r.state === HANDLER_READING && handlerSince(since, now) > this.bodyTimeout) {
          this.closeSlot(s)
        }
      }
    }
  }

  /** Every slot the carrier's `expire` closed. */
  private sweep(): void {
    for (let s: i32 = 0; s < toI32(this.open.length); s++) {
      if (this.open[s] && !this.server.holds(s)) {
        this.forget(s)
      }
    }
  }

  // ---- Requests -------------------------------------------------------------------

  /**
   * Whether a whole request is waiting for `take`. Requests whose connection
   * closed while queued are handed back here, and a body that decoded past
   * `maxDecoded` (413) or did not decode (400) is answered here.
   * @returns true when `take` will give out a request whose connection is still open
   */
  ready(): boolean {
    while (this.queueCount > 0) {
      const r: HttpRequest | null = this.queued()
      if (r === null) {
        // A place that names no request: none is ever queued, but it is passed over all the same.
        this.dequeue()
        continue
      }
      const live: boolean = this.live(r)
      if (live && r.refusal === 0) {
        return true
      }
      this.dequeue()
      if (live) {
        r.state = HANDLER_HELD
        let sent: i32 = HANDLER_REFUSED
        if (r.refusal === 413) {
          sent = this.problemCore(
            r,
            toI32(413),
            "Content Too Large",
            "the body decodes to more than this server takes"
          )
        } else {
          sent = this.problemCore(
            r,
            toI32(400),
            "Bad Request",
            "the body is not in the coding its Content-Encoding names"
          )
        }
        // Held a line above, with a status in range, so it is not refused;
        // were it, the request goes back rather than staying held.
        if (sent === HANDLER_REFUSED) {
          this.release(r)
        }
      } else {
        this.release(r)
      }
    }
    return false
  }

  /**
   * The next whole request, which the program now owes an answer. Panics when none is `ready`.
   * @returns the oldest queued request, the program's until it answers it
   */
  take(): HttpRequest {
    const r: HttpRequest | null = this.next()
    if (r === null) {
      panic("HttpHandler.take: no request is ready")
    }
    return r
  }

  /**
   * The next whole request, as `take` hands it over, or null when none is `ready`.
   * @returns the oldest queued request, the program's until it answers it, or null
   */
  next(): HttpRequest | null {
    const r: HttpRequest | null = this.ready() ? this.queued() : null
    if (r === null) {
      return null
    }
    this.dequeue()
    r.state = HANDLER_HELD
    return r
  }

  /**
   * The next step to run before `r`'s route body, lowest id first, or
   * `HANDLER_NEXT` once every step `Router.use` bound to `r.route` has run,
   * or `HANDLER_ANSWERED` once a step has answered `r`. A step reads `r`,
   * and may answer it — `refuse`, `problem`, `empty` or any other answer —
   * or add answer fields with `field`; call `before` again straight after
   * each step, before the next `take`, until it answers a negative code.
   * Only a request `take` handed over runs steps: what the handler answers
   * itself, to a bad request, a timeout or a full pool, runs none.
   *
   *     let s = handler.before(req)
   *     while (s >= 0) { switch (s) { case AUTH: ... } s = handler.before(req) }
   *     if (s === HANDLER_NEXT) { switch (req.route) { ... } }
   *
   * @param r a request `take` handed over
   * @returns the next step's id, `HANDLER_NEXT`, or `HANDLER_ANSWERED`
   */
  before(r: HttpRequest): i32 {
    if (r.state !== HANDLER_HELD) {
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
    // The lowest bit set, `left & -left`, negated in wrapping unsigned arithmetic.
    const low: i32 = toI32(toU32(left) & (toU32(0) - toU32(left)))
    r.stepsLeft = left ^ low
    r.stepsRan = r.stepsRan | low
    return toI32(31) - toI32(Math.clz32(toU32(low)))
  }

  /**
   * The next step to run after `r`'s route body has chosen its answer and
   * before it sends it: the steps `before` handed out, highest id first, then
   * `HANDLER_NEXT`; or `HANDLER_ANSWERED` once a step has answered `r`. A
   * step here may still `field` or answer in the body's place. A request
   * `before` was never called for runs no step here.
   * @param r a request `take` handed over, not yet answered
   * @returns the next step's id, `HANDLER_NEXT`, or `HANDLER_ANSWERED`
   */
  after(r: HttpRequest): i32 {
    if (r.state !== HANDLER_HELD) {
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
   * names itself, whichever answer it is. Both are kept by reference, so they
   * stay the caller's bytes, unchanged, until the answer starts. Panics past
   * `HANDLER_MAX_ADDED` fields, or on a request not held; a name or value the
   * carrier refuses panics as the answer's own would.
   * @param r a request `take` handed over, not yet answered
   * @param name the field name, a lowercase token
   * @param value the field value, field text
   */
  field(r: HttpRequest, name: u8[], value: u8[]): void {
    if (r.state !== HANDLER_HELD) {
      panic(`HttpHandler.field: the request is not one taken and unanswered (state ${r.state})`)
    }
    const at: i32 = r.added
    if (at >= HANDLER_MAX_ADDED) {
      panic(`HttpHandler.field: more than ${HANDLER_MAX_ADDED} fields added to one answer`)
    }
    if (at >= 0 && at < toI32(r.addedNames.length) && at < toI32(r.addedValues.length)) {
      r.addedNames[at] = name
      r.addedValues[at] = value
    } else {
      r.addedNames.push(name)
      r.addedValues.push(value)
    }
    r.added = at + 1
  }

  /**
   * Whether the client of `r` has hung up: its connection is closed or
   * reused, or the peer ended its stream while `r` is held. A half-close
   * counts, as nginx counts it, so a hung task is cancelled rather than
   * kept for a reader who may be gone.
   * @param r a request `take` handed over
   * @returns true once `r`'s connection is closed or reused, or its peer's stream has ended
   */
  hungUp(r: HttpRequest): boolean {
    if (!this.live(r)) {
      return true
    }
    const conn: Http1Connection | null = this.server.tryConnection(r.slot)
    return conn === null || conn.ended()
  }

  /** Whether `r`'s connection is the one it was read on, still open. */
  private live(r: HttpRequest): boolean {
    const gens: i32[] = this.slotGen
    const slot: i32 = r.slot
    return slot >= 0 && slot < toI32(gens.length) && gens[slot] === r.gen && this.server.holds(slot)
  }

  /**
   * How many requests the pool has made: the most ever in flight at once.
   * @returns the pool's size, which only grows, so a flat count shows nothing leaks
   */
  pooled(): i32 {
    return toI32(this.requests.length)
  }

  /**
   * How many connections are open.
   * @returns the number of carrier slots holding a connection, which falls to 0 after `drain`
   */
  connections(): i32 {
    return this.server.busy()
  }

  /**
   * Whether the listener is resting: an accept failed for want of a resource
   * (EMFILE for descriptors, ENFILE for ring slots, ENOMEM), so the handler
   * takes no connection until one closes or the 100 ms rest ends. During
   * `drain()` a close does not end the rest, so it stays true until the
   * 100 ms pass.
   * @returns true while the listener is out of the loop for such a rest
   */
  resting(): boolean {
    return this.acceptRestUntil > 0
  }

  // ---- Responses ------------------------------------------------------------------

  /**
   * Starts `r`'s response: `status` (200 to 599), the fields `names[k]`:
   * `values[k]`, and a body of `bodyLength` bytes or `HTTP1_CHUNKED`; then
   * `write` the body and `end`. Answers `HANDLER_SENT`, or `HANDLER_DROPPED`
   * when `r`'s connection has closed — every later `write` and `end` for it
   * then does nothing, and `end` hands it back.
   * @param r a request taken and not yet answered
   * @param status the response status, from 200 to 599
   * @param names the field names, as bytes, beside `values`
   * @param values each field's value, `values[k]` for `names[k]`
   * @param bodyLength how many body bytes will follow, or `HTTP1_CHUNKED` for a body of unknown length
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection closed
   *   first, or when the carrier's output was too full to take the head and
   *   the connection was closed for it
   */
  start(r: HttpRequest, status: i32, names: u8[][], values: u8[][], bodyLength: i32): i32 {
    return this.kept(this.startCore(r, status, names, values, bodyLength))
  }

  /**
   * `start`, with a broken contract answered as an `Err` instead of a panic:
   * a request not taken or already answered, a status outside 200 to 599 or
   * a body length below `HTTP1_CHUNKED` leave `r` as it was; a field the
   * carrier refuses closes the connection and hands `r` back.
   * @param r a request taken and not yet answered
   * @param status the response status, from 200 to 599
   * @param names the field names, as bytes, beside `values`
   * @param values each field's value, `values[k]` for `names[k]`
   * @param bodyLength how many body bytes will follow, or `HTTP1_CHUNKED` for a body of unknown length
   * @returns `Ok` with what `start` answers, or `Err` saying which contract the call broke
   */
  tryStart(r: HttpRequest, status: i32, names: u8[][], values: u8[][], bodyLength: i32): Result<i32, string> {
    return this.checked(this.startCore(r, status, names, values, bodyLength))
  }

  /** `start`'s work, answering `HANDLER_REFUSED` where `start` panics. */
  private startCore(r: HttpRequest, status: i32, names: u8[][], values: u8[][], bodyLength: i32): i32 {
    if (r.state !== HANDLER_HELD) {
      return this.refused(`HttpHandler.start: the request is not one taken and unanswered (state ${r.state})`)
    }
    if (status < 200 || status > 599) {
      return this.refused(`HttpHandler.start: status ${status} is outside 200 to 599`)
    }
    if (bodyLength < HTTP1_CHUNKED) {
      return this.refused(`HttpHandler.start: body length ${bodyLength}`)
    }
    r.state = HANDLER_STREAMING
    const conn: Http1Connection | null = this.live(r) ? this.server.tryConnection(r.slot) : null
    if (conn === null) {
      return HANDLER_DROPPED
    }
    const framing: i32 = status === 204 || status === 304 ? HTTP1_NO_BODY : bodyLength
    let outNames: u8[][] = names
    let outValues: u8[][] = values
    if (r.added > 0) {
      outNames = handlerWithAdded(this.namesBy, names, r.addedNames, r.added)
      outValues = handlerWithAdded(this.valuesBy, values, r.addedValues, r.added)
    }
    const sent: i32 = conn.respond(status, outNames, outValues, framing)
    if (sent === H1_AGAIN) {
      // The output still holds more of the response before this one than a
      // head can fit behind — only for a head near half the output, since a
      // request waits for that much room before it is queued. Ending the
      // connection is the one answer left.
      this.closeSlot(r.slot)
      return HANDLER_DROPPED
    }
    if (sent !== 0) {
      this.abandon(r)
      return this.refused(
        `HttpHandler.start: the carrier refused the head (${sent}): a reserved field, or a name or value that is not a token or field text`
      )
    }
    return HANDLER_SENT
  }

  /**
   * Writes `buf[off .. off + len)` of `r`'s body. What the carrier has no room
   * for is copied and sent as room comes, so `buf` is the caller's again on
   * return. Answers `HANDLER_SENT` or `HANDLER_DROPPED`. A response not
   * started, a window outside `buf`, or more bytes than the declared length
   * leaves panics; `tryWrite` answers those instead, closing the connection.
   * @param r a request whose response `start` began
   * @param buf the bytes to send from; the caller's again on return
   * @param off where in `buf` the body bytes start
   * @param len how many bytes to send
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection closed first
   */
  write(r: HttpRequest, buf: u8[], off: i32, len: i32): i32 {
    return this.kept(this.writeCore(r, buf, off, len))
  }

  /**
   * `write`, with a broken contract answered as an `Err` instead of a panic.
   * A response not started leaves `r` as it was. A window outside `buf`, or
   * more bytes than the declared length leaves (whether this check or the
   * carrier finds it), abandons the response: the head is out and the body
   * cannot follow it as declared, so the connection is closed and `r` is
   * the handler's again. The caller answers nothing more for `r`.
   * @param r a request whose response `start` began
   * @param buf the bytes to send from; the caller's again on return
   * @param off where in `buf` the body bytes start
   * @param len how many bytes to send
   * @returns `Ok` with what `write` answers, or `Err` saying which contract the call broke
   */
  tryWrite(r: HttpRequest, buf: u8[], off: i32, len: i32): Result<i32, string> {
    return this.checked(this.writeCore(r, buf, off, len))
  }

  /** `write`'s work, answering `HANDLER_REFUSED` where `write` panics. */
  private writeCore(r: HttpRequest, buf: u8[], off: i32, len: i32): i32 {
    const put: i32 = this.put(r, buf, off, len)
    if (put === HANDLER_SENT) {
      this.drive(r.slot)
    }
    return put
  }

  /**
   * `write` without its pass over the connection: the bytes are in the
   * carrier's output or pending on the request, and nothing is sent or
   * re-armed. The caller owes the slot a `drive` — `write` gives it at once,
   * `sendFields` leaves it to the `end` that follows, so a whole answer takes
   * one pass instead of two.
   */
  private put(r: HttpRequest, buf: u8[], off: i32, len: i32): i32 {
    if (r.state !== HANDLER_STREAMING) {
      return this.refused(`HttpHandler.write: the response is not started (state ${r.state})`)
    }
    // From here a refusal abandons `r`: its head is out, so a body the
    // program cannot write as declared leaves no response to complete.
    if (handlerOutside(buf, off, len)) {
      this.abandon(r)
      return this.refused(`HttpHandler.write: the window ${off} + ${len} is outside its ${buf.length} bytes`)
    }
    const conn: Http1Connection | null = this.live(r) ? this.server.tryConnection(r.slot) : null
    if (conn === null) {
      return HANDLER_DROPPED
    }
    // The carrier checks the length of what it takes; what is pending it has
    // not seen, so the check counts it here.
    const owed: i32 = handlerSub(conn.responseLeft, handlerSub(r.pendingEnd, r.pendingStart))
    if (conn.responseFraming >= 0 && !conn.responseEmpty && len > owed) {
      this.abandon(r)
      return this.refused(
        `HttpHandler.write: ${len} byte(s) is more than the ${owed} the length the response declared leaves`
      )
    }
    let taken: i32 = 0
    if (r.pendingEnd === r.pendingStart) {
      // `handlerOutside` refused this window above; the test is here again,
      // next to the call, where the checker reads it.
      const end: i32 = handlerAdd(off, len)
      if (off < 0 || off > end || end > toI32(buf.length)) {
        this.abandon(r)
        return this.refused(
          `HttpHandler.write: the window ${off} + ${len} is outside its ${buf.length} bytes`
        )
      }
      taken = conn.write(buf, off, end - off)
      if (taken === H1_AGAIN) {
        taken = 0
      } else if (taken < 0) {
        // The same contract as the length check above, as `write` has always
        // answered it, and abandoned the same way.
        this.abandon(r)
        return this.refused(
          `HttpHandler.write: the carrier refused the body (${taken}): more than the length the response declared`
        )
      }
    }
    if (taken < len && !this.keep(r, buf, handlerAdd(off, taken), handlerSub(len, taken))) {
      // `put` checked the window, so `keep` copies inside it; were it
      // refused, the body cannot follow the head as declared.
      this.abandon(r)
      return this.refused(`HttpHandler.write: the ${len} byte(s) could not be kept to send`)
    }
    return HANDLER_SENT
  }

  /**
   * Appends bytes to `r`'s pending buffer, growing it once to the largest
   * response it has held. Answers `false`, with the pending bytes as they
   * were, where a copy is refused.
   */
  private keep(r: HttpRequest, buf: u8[], off: i32, len: i32): boolean {
    const live: i32 = handlerSub(r.pendingEnd, r.pendingStart)
    const want: i32 = handlerAdd(live, len)
    if (handlerSub(toI32(r.pending.length), r.pendingEnd) < len) {
      if (r.pendingStart > 0 || toI32(r.pending.length) < want) {
        const target: u8[] =
          toI32(r.pending.length) < want
            ? handlerBytes(handlerGrown(toI32(r.pending.length), want))
            : r.pending
        if (!tryCopyBytes(target, HANDLER_ZERO, r.pending, r.pendingStart, live)) {
          return false
        }
        r.pending = target
        r.pendingStart = 0
        r.pendingEnd = live
      }
    }
    if (!tryCopyBytes(r.pending, r.pendingEnd, buf, off, len)) {
      return false
    }
    r.pendingEnd = handlerAdd(r.pendingEnd, len)
    return true
  }

  /**
   * Ends `r`'s response. `r` is the handler's again: it goes back once the
   * carrier has taken every byte, and the connection's next request is read.
   * Answers `HANDLER_SENT` or `HANDLER_DROPPED`. After `deferSends` the send
   * may be put off so a pipelined burst goes out in one write: call `wait` or
   * `flush` after answering, or it waits for the next of them.
   * @param r a request whose response `start` began; the handler's again after this call
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection closed first
   */
  end(r: HttpRequest): i32 {
    return this.kept(this.endCore(r))
  }

  /**
   * `end`, with a broken contract answered as an `Err` instead of a panic: a
   * response not started leaves `r` as it was; a body short of the declared
   * length closes the connection, since the response cannot be completed,
   * and hands `r` back.
   * @param r a request whose response `start` began; the handler's again after an `Ok`
   * @returns `Ok` with what `end` answers, or `Err` saying which contract the call broke
   */
  tryEnd(r: HttpRequest): Result<i32, string> {
    return this.checked(this.endCore(r))
  }

  /** `end`'s work, answering `HANDLER_REFUSED` where `end` panics. */
  private endCore(r: HttpRequest): i32 {
    if (r.state !== HANDLER_STREAMING) {
      return this.refused(`HttpHandler.end: the response is not started (state ${r.state})`)
    }
    const slot: i32 = r.slot
    const conn: Http1Connection | null = this.live(r) ? this.server.tryConnection(slot) : null
    if (conn === null) {
      this.release(r)
      return HANDLER_DROPPED
    }
    const short: i32 = handlerSub(conn.responseLeft, handlerSub(r.pendingEnd, r.pendingStart))
    if (conn.responseFraming >= 0 && short > 0 && !conn.responseEmpty) {
      this.abandon(r)
      return this.refused(
        `HttpHandler.end: the body is ${short} byte(s) short of the length the response declared`
      )
    }
    this.finish(r, conn)
    this.drive(slot)
    return HANDLER_SENT
  }

  /**
   * Answers `r` with `status`, a `Content-Type` of `contentType` and the body `body[off .. off + len)`, in one call.
   * @param r a request taken and not yet answered; the handler's again after this call
   * @param status the response status, from 200 to 599
   * @param contentType the `Content-Type` value, as bytes
   * @param body the buffer holding the body; the caller's again on return
   * @param off where in `body` the body bytes start
   * @param len how many body bytes to send
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection closed
   *   first, or when the carrier's output was too full to take the head and
   *   the connection was closed for it
   */
  send(r: HttpRequest, status: i32, contentType: u8[], body: u8[], off: i32, len: i32): i32 {
    return this.kept(this.sendCore(r, status, contentType, body, off, len))
  }

  /**
   * `send`, with a broken contract answered as an `Err` instead of a panic,
   * as `trySendFields` answers it.
   * @param r a request taken and not yet answered; the handler's again after an `Ok`
   * @param status the response status, from 200 to 599
   * @param contentType the `Content-Type` value, as bytes
   * @param body the buffer holding the body; the caller's again on return
   * @param off where in `body` the body bytes start
   * @param len how many body bytes to send
   * @returns `Ok` with what `send` answers, or `Err` saying which contract the call broke
   */
  trySend(
    r: HttpRequest,
    status: i32,
    contentType: u8[],
    body: u8[],
    off: i32,
    len: i32
  ): Result<i32, string> {
    return this.checked(this.sendCore(r, status, contentType, body, off, len))
  }

  /** `send`'s work, answering `HANDLER_REFUSED` where `send` panics. */
  private sendCore(r: HttpRequest, status: i32, contentType: u8[], body: u8[], off: i32, len: i32): i32 {
    if (this.typeValue.length > 0) {
      this.typeValue[0] = contentType
    } else {
      this.typeValue.push(contentType)
    }
    return this.sendFieldsCore(r, status, this.typeName, this.typeValue, body, off, len)
  }

  /**
   * Answers `r` with `status`, the fields `names[k]`: `values[k]` and the body `body[off .. off + len)`, in one call.
   * @param r a request taken and not yet answered; the handler's again after this call
   * @param status the response status, from 200 to 599
   * @param names the field names, as bytes, beside `values`
   * @param values each field's value, `values[k]` for `names[k]`
   * @param body the buffer holding the body; the caller's again on return
   * @param off where in `body` the body bytes start
   * @param len how many body bytes to send
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection closed
   *   first, or when the carrier's output was too full to take the head and
   *   the connection was closed for it
   */
  sendFields(
    r: HttpRequest,
    status: i32,
    names: u8[][],
    values: u8[][],
    body: u8[],
    off: i32,
    len: i32
  ): i32 {
    return this.kept(this.sendFieldsCore(r, status, names, values, body, off, len))
  }

  /**
   * `sendFields`, with a broken contract answered as an `Err` instead of a
   * panic: a request not taken or already answered, a status outside 200 to
   * 599 or, when a body is sent (`len` above 0, a status other than 204 and
   * 304), a window outside `body` leave `r` as it was; a field the carrier
   * refuses closes the connection and hands `r` back.
   * @param r a request taken and not yet answered; the handler's again after an `Ok`
   * @param status the response status, from 200 to 599
   * @param names the field names, as bytes, beside `values`
   * @param values each field's value, `values[k]` for `names[k]`
   * @param body the buffer holding the body; the caller's again on return
   * @param off where in `body` the body bytes start
   * @param len how many body bytes to send
   * @returns `Ok` with what `sendFields` answers, or `Err` saying which contract the call broke
   */
  trySendFields(
    r: HttpRequest,
    status: i32,
    names: u8[][],
    values: u8[][],
    body: u8[],
    off: i32,
    len: i32
  ): Result<i32, string> {
    return this.checked(this.sendFieldsCore(r, status, names, values, body, off, len))
  }

  /** `sendFields`'s work, answering `HANDLER_REFUSED` where `sendFields` panics. */
  private sendFieldsCore(
    r: HttpRequest,
    status: i32,
    names: u8[][],
    values: u8[][],
    body: u8[],
    off: i32,
    len: i32
  ): i32 {
    // Only a body that is sent has a window; it is checked before the head
    // goes, so a refused one leaves `r` untouched. A chunked length or a
    // 204 or 304 sends none, as before.
    const sends: boolean = len > 0 && status !== 204 && status !== 304
    if (sends && handlerOutside(body, off, len)) {
      return this.refused(`HttpHandler.write: the window ${off} + ${len} is outside its ${body.length} bytes`)
    }
    const started: i32 = this.startCore(r, status, names, values, len)
    if (started === HANDLER_DROPPED) {
      this.release(r)
      return HANDLER_DROPPED
    }
    if (started !== HANDLER_SENT) {
      return started
    }
    if (sends) {
      // No pass between the body and the end: `end` drives the slot once.
      // The head declared `len` and the window is checked, so `put` has no
      // contract left to refuse; should it refuse one, it abandons `r`.
      if (this.put(r, body, off, len) === HANDLER_REFUSED) {
        return HANDLER_REFUSED
      }
    }
    return this.endCore(r)
  }

  /**
   * Answers `r` with `status` and no body: a 204, or a status whose meaning is all there is to say.
   * @param r a request taken and not yet answered; the handler's again after this call
   * @param status the response status, from 200 to 599
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection closed
   *   first, or when the carrier's output was too full to take the head and
   *   the connection was closed for it
   */
  empty(r: HttpRequest, status: i32): i32 {
    return this.kept(this.emptyCore(r, status))
  }

  /**
   * `empty`, with a broken contract answered as an `Err` instead of a panic:
   * a request not taken or already answered, or a status outside 200 to 599,
   * leaves `r` as it was.
   * @param r a request taken and not yet answered; the handler's again after an `Ok`
   * @param status the response status, from 200 to 599
   * @returns `Ok` with what `empty` answers, or `Err` saying which contract the call broke
   */
  tryEmpty(r: HttpRequest, status: i32): Result<i32, string> {
    return this.checked(this.emptyCore(r, status))
  }

  private emptyCore(r: HttpRequest, status: i32): i32 {
    return this.sendFieldsCore(
      r,
      status,
      this.noFields,
      this.noFields,
      this.scratch,
      HANDLER_ZERO,
      HANDLER_ZERO
    )
  }

  /**
   * The JSON writer, reset onto the handler's scratch buffer: write one value
   * with it, then `sendJson`. One JSON body at a time, since every request
   * shares the buffer.
   * @returns the handler's own writer, empty, valid until the next `json`, `sendJson` or `problem`
   */
  json(): JsonWriter {
    this.writer.reset(this.scratch, HANDLER_ZERO)
    this.jsonBegun = true
    return this.writer
  }

  /**
   * Answers `r` with `status` and the value `json`'s writer holds, as
   * `application/json`. A value the writer refused or did not finish — it
   * outgrew `jsonBytes`, say — is answered as a 500 problem instead.
   * @param r a request taken and not yet answered; the handler's again after this call
   * @param status the response status for a value that fit, from 200 to 599
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection closed
   *   first, or when the carrier's output was too full to take the head and
   *   the connection was closed for it
   */
  sendJson(r: HttpRequest, status: i32): i32 {
    return this.kept(this.sendJsonCore(r, status))
  }

  /**
   * `sendJson`, with a broken contract answered as an `Err` instead of a
   * panic: no value begun with `json`, a request not taken or already
   * answered, or a status outside 200 to 599, leaves `r` as it was.
   * @param r a request taken and not yet answered; the handler's again after an `Ok`
   * @param status the response status for a value that fit, from 200 to 599
   * @returns `Ok` with what `sendJson` answers, or `Err` saying which contract the call broke
   */
  trySendJson(r: HttpRequest, status: i32): Result<i32, string> {
    return this.checked(this.sendJsonCore(r, status))
  }

  private sendJsonCore(r: HttpRequest, status: i32): i32 {
    if (!this.jsonBegun) {
      return this.refused("HttpHandler.sendJson: no value was begun with json()")
    }
    this.jsonBegun = false
    if (!this.writer.complete()) {
      return this.problemCore(r, toI32(500), "Internal Server Error", "the response did not fit its buffer")
    }
    return this.sendCore(r, status, this.jsonType, this.scratch, HANDLER_ZERO, this.writer.end)
  }

  /**
   * Answers `r` with an RFC 9457 problem: `application/problem+json` with
   * `type` `about:blank`, `title` (the status's reason, for that type),
   * `status` and, when not empty, `detail`, a sentence for a person about
   * this occurrence. Nothing of the request is echoed, so a detail is the
   * program's own words.
   * @param r a request taken and not yet answered; the handler's again after this call
   * @param status the response status, from 200 to 599, also written into the object
   * @param title the status's reason phrase, or empty to leave it out
   * @param detail a sentence for a person about this occurrence, or empty to leave it out
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection closed
   *   first, or when the carrier's output was too full to take the head and
   *   the connection was closed for it
   */
  problem(r: HttpRequest, status: i32, title: string, detail: string): i32 {
    return this.kept(this.problemCore(r, status, title, detail))
  }

  /**
   * `problem`, with a broken contract answered as an `Err` instead of a
   * panic: a request not taken or already answered, or a status outside 200
   * to 599, leaves `r` as it was.
   * @param r a request taken and not yet answered; the handler's again after an `Ok`
   * @param status the response status, from 200 to 599, also written into the object
   * @param title the status's reason phrase, or empty to leave it out
   * @param detail a sentence for a person about this occurrence, or empty to leave it out
   * @returns `Ok` with what `problem` answers, or `Err` saying which contract the call broke
   */
  tryProblem(r: HttpRequest, status: i32, title: string, detail: string): Result<i32, string> {
    return this.checked(this.problemCore(r, status, title, detail))
  }

  private problemCore(r: HttpRequest, status: i32, title: string, detail: string): i32 {
    const length: i32 = this.writeProblem(status, title, detail)
    return this.sendCore(r, status, this.problemType, this.scratch, HANDLER_ZERO, length)
  }

  /**
   * Writes a problem object into the scratch buffer and answers its length.
   * One too large for it is written without its detail, and then without its
   * title, which leaves room enough in the least `jsonBytes`.
   */
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
   * field naming the methods the path has (RFC 9110 §15.5.6), and 404 for
   * anything else. A parameter's malformed escape is the program's to refuse,
   * when it decodes the parameter.
   * @param r a request whose `route` is negative, taken and not yet answered; the handler's again after this call
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the connection closed
   *   first, or when the carrier's output was too full to take the head and
   *   the connection was closed for it
   */
  refuse(r: HttpRequest): i32 {
    return this.kept(this.refuseCore(r))
  }

  /**
   * `refuse`, with a broken contract answered as an `Err` instead of a
   * panic: a request not taken or already answered leaves `r` as it was.
   * @param r a request whose `route` is negative, taken and not yet answered; the handler's again after an `Ok`
   * @returns `Ok` with what `refuse` answers, or `Err` saying which contract the call broke
   */
  tryRefuse(r: HttpRequest): Result<i32, string> {
    return this.checked(this.refuseCore(r))
  }

  private refuseCore(r: HttpRequest): i32 {
    if (r.route === ROUTER_METHOD_NOT_ALLOWED) {
      const length: i32 = this.writeProblem(toI32(405), "Method Not Allowed", "")
      // The `Allow` value goes in the pair the constructor made, one store a
      // 405; the length test, after `allowFor` runs, proves the index, and
      // its other branch, never taken, answers the same by making the pair.
      const allow: u8[] = this.allowFor(r)
      const values: u8[][] = this.allowValues
      if (toI32(values.length) >= 2) {
        values[1] = allow
      } else {
        this.allowValues = [this.problemType, allow]
      }
      return this.sendFieldsCore(
        r,
        toI32(405),
        this.allowNames,
        this.allowValues,
        this.scratch,
        HANDLER_ZERO,
        length
      )
    }
    return this.problemCore(r, toI32(404), "Not Found", "")
  }

  /** Records why a call broke its contract and answers `HANDLER_REFUSED`. */
  private refused(why: string): i32 {
    this.refusal = why
    return HANDLER_REFUSED
  }

  /** A core's answer for a public method: the panic it keeps for a broken contract, or the answer. */
  private kept(code: i32): i32 {
    if (code === HANDLER_REFUSED) {
      panic(this.refusal)
    }
    return code
  }

  /** A core's answer for a `try` twin. */
  private checked(code: i32): Result<i32, string> {
    if (code === HANDLER_REFUSED) {
      return Err(this.refusal)
    }
    return Ok(code)
  }

  /** Gives up on `r`'s answer: its connection is closed, since the response cannot be completed, and `r` goes back. */
  private abandon(r: HttpRequest): void {
    if (this.live(r)) {
      this.closeSlot(r.slot)
    }
    this.release(r)
  }

  /**
   * The `Allow` value for `r`'s path: each method a route of it takes, and
   * HEAD wherever GET is, since a GET route answers HEAD too. Made once for
   * each set of methods.
   */
  private allowFor(r: HttpRequest): u8[] {
    const router: Router = this.router
    const starts: i32[] = router.methodStart
    const ends: i32[] = router.methodEnd
    const methods: i32 = toI32(starts.length) < toI32(ends.length) ? toI32(starts.length) : toI32(ends.length)
    let mask: i64 = 0
    for (let m: i32 = 0; m < methods && m < toI32(starts.length) && m < toI32(ends.length); m++) {
      const start: i32 = starts[m]
      const end: i32 = ends[m]
      const route: i32 = router.tryMatch(
        router.methodBytes,
        start,
        end,
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
    const made: u8[][] = this.allowBytes
    for (let k: i32 = 0; k < toI32(masks.length) && k < toI32(made.length); k++) {
      if (masks[k] === mask) {
        return made[k]
      }
    }
    let get: boolean = false
    let head: boolean = false
    const value: u8[] = []
    for (let m: i32 = 0; m < methods && m < toI32(starts.length) && m < toI32(ends.length); m++) {
      if ((mask & (toI64(1) << toI64(m))) !== toI64(0)) {
        const start: i32 = starts[m]
        const end: i32 = ends[m]
        get = get || handlerSpanIs(router.methodBytes, start, end, "GET")
        head = head || handlerSpanIs(router.methodBytes, start, end, "HEAD")
        handlerAllowAppend(value, router.methodBytes, start, end)
      }
    }
    if (get && !head) {
      const name: u8[] = httpFieldBytes("HEAD")
      handlerAllowAppend(value, name, HANDLER_ZERO, toI32(name.length))
    }
    this.allowMasks.push(mask)
    this.allowBytes.push(value)
    return value
  }
}

/** Appends `bytes[start .. end)` to an `Allow` value, after a `, ` if it is not the first. */
const handlerAllowAppend = (value: u8[], bytes: u8[], start: i32, end: i32): void => {
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
 * The first `n` elements' length as a `u16`, at most 65535, and 0 when `n` is
 * not positive: an allocation of a `u16` length is not an `array-length`
 * site, so the helpers below allocate once up to it and push only past it.
 */
const handlerHead = (n: i32): u16 => {
  if (n <= 0) {
    return 0
  }
  return toU16(n < 65535 ? n : toI32(65535))
}

/** `n` copies of `fill`, none when `n` is not positive: one allocation up to 65535, pushed past it. */
const handlerInts = (n: i32, fill: i32): i32[] => {
  const out: i32[] = new Array<i32>(handlerHead(n))
  if (fill !== 0) {
    out.fill(fill)
  }
  for (let k: i32 = 65535; k < n; k++) {
    out.push(fill)
  }
  return out
}

/** `n` flags, each false, made as `handlerInts` makes its numbers. */
const handlerFlags = (n: i32): boolean[] => {
  const out: boolean[] = new Array<boolean>(handlerHead(n))
  for (let k: i32 = 65535; k < n; k++) {
    out.push(false)
  }
  return out
}

/** `n` zero bytes, made as `handlerInts` makes its numbers. */
const handlerBytes = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(handlerHead(n))
  for (let k: i32 = 65535; k < n; k++) {
    out.push(0)
  }
  return out
}

/** The length of `Router.match`'s scratch for routes of up to `maxParams` parameters: two a parameter and two more. */
const handlerProbeLength = (maxParams: i32): i32 => toI32(toI64(maxParams) * toI64(2) + toI64(2))

/**
 * The nanoseconds from the `monotonicNanos` instant `from` to `to`, or 0 when
 * `to` is not after it. Worked in `u64`, which has the bits of the signed
 * difference once `to` is the later.
 */
const handlerSince = (from: i64, to: i64): i64 => (to > from ? toI64(toU64(to) - toU64(from)) : toI64(0))

/**
 * The `monotonicNanos` instant `span` nanoseconds after `now`. Worked in
 * `u64`, whose wrapping sum has the bits of the signed one: an instant is
 * centuries short of 2^63 and the span a constant of a second or less.
 */
const handlerLater = (now: i64, span: i64): i64 => toI64(toU64(now) + toU64(span))

/** Place `start + k` of a ring of `size` places, in `[0, size)`; -1 for an empty ring or a negative place. */
const handlerRing = (start: i32, k: i32, size: i32): i32 => {
  const n: i64 = toI64(size)
  if (n < 1 || start < 0 || k < 0) {
    return -1
  }
  // Two non-negative `i32`s sum below 2^32, so the `i64` sum is exact.
  const at: i64 = toI64(start) + toI64(k)
  return toI32(at % n)
}

/**
 * A handler as `new HttpHandler(limits, listener, router)` makes one, with
 * limits below their least, which that constructor panics on, answered as an
 * `Err`, and a readiness loop `pollCreate` could not make, which would leave
 * that constructor's handler dead, answered as an `Err` too.
 * @param limits the caps and timeouts, as the constructor reads them
 * @param listener the listening socket's descriptor, still the program's to close
 * @param router the routes, which the handler keeps and consults at each request head
 * @returns `Ok` with the handler, or `Err` saying which limit is below its least or how `pollCreate` failed
 */
export const openHttpHandler = (
  limits: HandlerLimits,
  listener: i32,
  router: Router
): Result<HttpHandler, string> => {
  const fault: string = handlerLimitsFault(limits)
  if (fault.length > 0) {
    return Err(fault)
  }
  const loop: i32 = pollCreate()
  if (loop < 0) {
    return Err(`HttpHandler: pollCreate failed: ${loop}`)
  }
  return Ok(new HttpHandler(limits, listener, router, loop))
}

/**
 * The body decoder for a `maxDecoded` of `limit`, or null for 0, which
 * decodes nothing (`handlerCheckLimits` has refused a negative one).
 */
const handlerDecoder = (limit: i32): HttpBodyDecoder | null => {
  const fault: string = httpBodyDecoderFault(limit)
  if (fault.length > 0) {
    return null
  }
  return new HttpBodyDecoder(limit)
}

/** Panics unless `limits` can make a handler: a limit below its least is the program's mistake. */
const handlerCheckLimits = (limits: HandlerLimits): void => {
  const fault: string = handlerLimitsFault(limits)
  if (fault.length > 0) {
    panic(fault)
  }
}

/** Why `limits` cannot make a handler, or `""` when it can. */
const handlerLimitsFault = (limits: HandlerLimits): string => {
  if (limits.slots < 1 || limits.jsonBytes < 256 || limits.maxEvents < 1 || limits.bodyTimeout < 1) {
    return `HttpHandler: slots ${limits.slots}, jsonBytes ${limits.jsonBytes}, maxEvents ${limits.maxEvents} and bodyTimeout ${limits.bodyTimeout} need at least 1, 256, 1 and 1`
  }
  if (limits.maxDecoded < 0) {
    return `HttpHandler: maxDecoded ${limits.maxDecoded} is negative`
  }
  if (limits.minEvents < 1 || limits.maxWaitMs < 0 || limits.maxWaitMs > HANDLER_MAX_WAIT_MS) {
    return `HttpHandler: minEvents ${limits.minEvents} and maxWaitMs ${limits.maxWaitMs} need at least 1 and 0 to ${HANDLER_MAX_WAIT_MS}`
  }
  return ""
}

/** Whether `buf[off .. off + len)` is not a window of `buf`. */
const handlerOutside = (buf: u8[], off: i32, len: i32): boolean =>
  off < 0 || len < 0 || toI64(off) + toI64(len) > toI64(buf.length)

/** `a + b`, wrapped to an `i32`: the sum is taken in `i64`, where two `i32`s cannot overflow. */
const handlerAdd = (a: i32, b: i32): i32 => toI32(toI64(a) + toI64(b))

/** `a - b`, wrapped to an `i32`, taken in `i64` as `handlerAdd` takes a sum. */
const handlerSub = (a: i32, b: i32): i32 => toI32(toI64(a) - toI64(b))

/** Where slot `part` of field `i` sits in `spans`, four to a field, or -1 when that is past an `i32`. */
const handlerSpanSlot = (i: i32, part: i32): i32 => {
  const at: i64 = toI64(i) * toI64(4) + toI64(part)
  return at < toI64(0) || at > toI64(2147483647) ? -1 : toI32(at)
}

/** A buffer size of at least `need`: `have` doubled until it is, starting from 64. */
const handlerGrown = (have: i32, need: i32): i32 => {
  let size: i32 = have < 64 ? 64 : have
  while (size < need && size < 1073741824) {
    size = handlerAdd(size, size)
  }
  return size < need ? need : size
}

/** Whether `bytes[start .. end)` is exactly `text`. */
const handlerSpanIs = (bytes: u8[], start: i32, end: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (start < 0 || end < start || end > toI32(bytes.length) || handlerSub(end, start) !== n) {
    return false
  }
  let at: i32 = start
  for (let k: i32 = 0; k < n; k++) {
    if (at < 0 || at >= toI32(bytes.length) || toI32(bytes[at]) !== toI32(text.charCodeAt(k))) {
      return false
    }
    at = handlerAdd(at, 1)
  }
  return true
}

/** `bytes[start .. end)` as a decimal number that is not negative and fits an `i32`, or -1. */
const handlerDecimal = (bytes: u8[], start: i32, end: i32): i32 => {
  if (start < 0 || end <= start || end > toI32(bytes.length) || handlerSub(end, start) > 10) {
    return -1
  }
  let value: i32 = 0
  for (let k: i32 = start; k < end && k < toI32(bytes.length); k++) {
    const c: i32 = toI32(bytes[k])
    // A value past 999999999 has ten digits already, and an eleventh is past an `i32`.
    if (c < 48 || c > 57 || value < 0 || value > 999999999) {
      return -1
    }
    const next: i64 = toI64(value) * toI64(10) + toI64(c - 48)
    if (next > toI64(2147483647)) {
      return -1
    }
    value = toI32(next)
  }
  return value
}

/**
 * The byte the form encoding spells at `bytes[at ..)`, before `end`, and how
 * many bytes it took, packed as `byte | taken << 8`; -1 for a malformed escape.
 */
const handlerFormByte = (bytes: u8[], at: i32, end: i32): i32 => {
  // Its callers step `at` inside a span of `bytes`; the literal bound keeps
  // `at + 2` from overflowing, far past any head.
  if (at < 0 || at >= end || at >= toI32(bytes.length) || at > 1073741823) {
    return -1
  }
  const c: i32 = toI32(bytes[at])
  if (c === 43) {
    return 32 | HANDLER_TOOK_ONE
  }
  if (c !== 37) {
    return c | HANDLER_TOOK_ONE
  }
  if (at + 2 >= end || at + 2 >= toI32(bytes.length)) {
    return -1
  }
  // Both bytes read before either call, which the prover takes to move lengths.
  const high: i32 = toI32(bytes[at + 1])
  const low: i32 = toI32(bytes[at + 2])
  const hi: i32 = http1HexValue(high)
  const lo: i32 = http1HexValue(low)
  if (hi < 0 || lo < 0 || hi > 15 || lo > 15) {
    return -1
  }
  return (hi * 16 + lo) | HANDLER_TOOK_THREE
}

/** Whether `bytes[start .. end)`, form-decoded, is exactly `name`; a malformed escape matches nothing. */
const handlerFormIs = (bytes: u8[], start: i32, end: i32, name: string): boolean => {
  const n: i32 = toI32(name.length)
  let at: i32 = start
  let k: i32 = 0
  // A head is capped far below the literal bound, which keeps `at + 3` in an `i32`.
  while (at < end && at >= 0 && at < 1073741824) {
    const packed: i32 = handlerFormByte(bytes, at, end)
    if (packed < 0 || k >= n || (packed & 255) !== toI32(name.charCodeAt(k))) {
      return false
    }
    // One byte taken, or three for an escape; `handlerFormByte` kept `at` far
    // below the top of an `i32`.
    if ((packed & HANDLER_TOOK_THREE) === HANDLER_TOOK_THREE) {
      at += 3
    } else {
      at += 1
    }
    k += 1
  }
  return k === n
}

/**
 * `bytes[start .. start + len)` form-decoded into `out` from 0: its length,
 * `ROUTER_BAD_ESCAPE`, or `ROUTER_NO_ROOM`. `%00` decodes like any byte, as a
 * route parameter's does.
 */
const handlerFormDecode = (bytes: u8[], start: i32, len: i32, out: u8[]): i32 => {
  const length: i32 = percentDecode(
    bytes,
    start,
    len,
    out,
    HANDLER_ZERO,
    URL_DECODE_FORM | URL_DECODE_ALLOW_NUL
  )
  if (length === URL_DECODE_ERR_SPACE) {
    return ROUTER_NO_ROOM
  }
  return length < 0 ? ROUTER_BAD_ESCAPE : length
}

/**
 * `given` followed by `added[0 .. count)`, in the array `byLength` keeps for
 * that length: made the first time an answer has that many fields, and
 * written over by each answer after.
 */
const handlerWithAdded = (byLength: u8[][][], given: u8[][], added: u8[][], count: i32): u8[][] => {
  const have: i32 = toI32(given.length)
  const length: i32 = handlerAdd(have, count)
  if (length < 0 || added.length === 0) {
    return given
  }
  const first: u8[] = added.length > 0 ? added[0] : []
  while (toI32(byLength.length) <= length) {
    const size: i32 = toI32(byLength.length)
    const made: u8[][] = []
    for (let k: i32 = 0; k < size; k++) {
      made.push(first)
    }
    byLength.push(made)
  }
  if (length >= toI32(byLength.length)) {
    return given
  }
  const out: u8[][] = byLength[length]
  for (let k: i32 = 0; k < toI32(given.length) && k < toI32(out.length); k++) {
    out[k] = given[k]
  }
  let at: i32 = have
  for (let k: i32 = 0; k < count && k < toI32(added.length); k++) {
    if (at >= 0 && at < toI32(out.length)) {
      out[at] = added[k]
    }
    at = handlerAdd(at, 1)
  }
  return out
}
