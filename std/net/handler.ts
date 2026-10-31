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
 * Misuse — a status outside 200 to 599, a reserved field (`Content-Length`,
 * `Transfer-Encoding`, `Connection`, `Upgrade`, `Keep-Alive`), more body than
 * the length said, a second `start` — panics: it is a bug in the program,
 * never something a peer can cause. What a peer can cause answers a code the
 * program may ignore, so no answer needs its result bound.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9110, RFC 9112 and RFC 9457, not ported from another
 * implementation.
 */
import { copyBytes } from "nish/bytes"
import { JsonWriter } from "nish/json"
import { httpFieldBytes } from "nish/net/http-fields"
import { HTTP1_CHUNKED, HTTP1_NO_BODY, http1HexValue } from "nish/net/http1"
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
import { pollAdd, pollCreate, pollModify, pollRemove, pollWait } from "nish:net"

/** An answer sent, or queued to be sent. */
export const HANDLER_SENT: i32 = 0
/** An answer for a request whose connection closed first: nothing was sent. */
export const HANDLER_DROPPED: i32 = -21
/** `HttpRequest.query` and `header`: no such name. */
export const HANDLER_ABSENT: i32 = -20

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
/** How long the listener rests after an accept fails for want of descriptors or memory: 100 ms. */
const HANDLER_ACCEPT_REST: i64 = 100000000
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
  /** The most connections at once. */
  slots: i32 = 256
  /** The JSON scratch buffer's size: the largest body `json` and `problem` can write. */
  jsonBytes: i32 = 65536
  /** The most readiness events one `wait` takes. */
  maxEvents: i32 = 256

  constructor() {
    this.http = new Http1Config()
    this.http.maxBody = HANDLER_ONE_MIB
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
  /** Four per field, into `head`: name start and end, value start and end. */
  spans: i32[]
  /** The route parameters as `[start, end)` pairs into `head`, in the pattern's order. */
  params: i32[]
  /** The body, `body[0 .. bodyLength)`. */
  body: u8[]
  /** What the carrier had no room for yet: `pending[pendingStart .. pendingEnd)`. */
  pending: u8[]
  /** The index `Router.add` answered for the route, or a negative `ROUTER_*` code. */
  route: i32 = 0
  /** How many parameter pairs `params` holds. */
  paramCount: i32 = 0
  methodStart: i32 = 0
  methodEnd: i32 = 0
  targetStart: i32 = 0
  targetEnd: i32 = 0
  /** Where the path ends: the target's first `?`, or its end. */
  pathEnd: i32 = 0
  headerCount: i32 = 0
  bodyLength: i32 = 0
  /** The connection's slot, and its generation when this request was read. */
  slot: i32 = 0
  gen: i32 = 0
  /** Its index in the handler's pool. */
  index: i32 = 0
  state: i32 = 0
  pendingStart: i32 = 0
  pendingEnd: i32 = 0

  constructor(index: i32) {
    this.index = index
    this.head = []
    this.spans = []
    this.params = []
    this.body = []
    this.pending = []
  }

  /** Whether the method is exactly `method` (methods are case-sensitive, RFC 9110 §9.1). */
  methodIs(method: string): boolean {
    return handlerSpanIs(this.head, this.methodStart, this.methodEnd, method)
  }

  /** Whether the path, the target up to its `?`, is exactly `path`. */
  pathIs(path: string): boolean {
    return handlerSpanIs(this.head, this.targetStart, this.pathEnd, path)
  }

  /** Where parameter `k` starts in `head`. Panics on a parameter the route does not have. */
  paramStart(k: i32): i32 {
    this.checkParam(k)
    return this.params[2 * k]
  }

  /** Where parameter `k` ends in `head`. */
  paramEnd(k: i32): i32 {
    this.checkParam(k)
    return this.params[2 * k + 1]
  }

  /** Whether parameter `k`, raw, is exactly `text`. */
  paramIs(k: i32, text: string): boolean {
    this.checkParam(k)
    return handlerSpanIs(this.head, this.params[2 * k], this.params[2 * k + 1], text)
  }

  /**
   * Parameter `k` percent-decoded into `out` from 0 (`routerDecode`): its
   * length, `ROUTER_BAD_ESCAPE` for a malformed escape, or `ROUTER_NO_ROOM`
   * when `out` is too short. Nothing is written on a code.
   */
  param(k: i32, out: u8[]): i32 {
    this.checkParam(k)
    return routerDecode(this.head, this.params[2 * k], this.params[2 * k + 1], out)
  }

  /** Parameter `k` read as a decimal number that is not negative and fits an `i32`, or -1. */
  paramDecimal(k: i32): i32 {
    this.checkParam(k)
    return handlerDecimal(this.head, this.params[2 * k], this.params[2 * k + 1])
  }

  checkParam(k: i32): void {
    if (k < 0 || k >= this.paramCount) {
      panic(`HttpRequest.param: the route has ${this.paramCount} parameter(s), not one at ${k}`)
    }
  }

  /**
   * The first query parameter named `name`, its value decoded into `out` from
   * 0 — `+` as a space and `%XX` as its byte, the form encoding
   * (application/x-www-form-urlencoded) — and its length; a name is compared
   * decoded too. `HANDLER_ABSENT` when no parameter has the name,
   * `ROUTER_BAD_ESCAPE` for a malformed escape in its value, `ROUTER_NO_ROOM`
   * when `out` is too short. A name with no `=` has an empty value.
   */
  query(name: string, out: u8[]): i32 {
    const at: i32 = this.queryIndex(name)
    if (at < 0) {
      return HANDLER_ABSENT
    }
    return handlerFormDecode(this.head, this.queryValueStart, this.queryValueEnd, out)
  }

  /** Whether the query holds a parameter named `name`. */
  hasQuery(name: string): boolean {
    return this.queryIndex(name) >= 0
  }

  /** The span `queryIndex` found, raw. */
  queryValueStart: i32 = 0
  queryValueEnd: i32 = 0

  /** Finds the first parameter named `name`: where its pair starts, or -1; its raw value goes to `queryValue...`. */
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
      if (handlerFormIs(this.head, at, keyEnd, name)) {
        this.queryValueStart = keyEnd < pairEnd ? keyEnd + 1 : pairEnd
        this.queryValueEnd = pairEnd
        return at
      }
      at = pairEnd + 1
    }
    return -1
  }

  /** The index of the first field named `name`, which is lowercase, or `HANDLER_ABSENT`. */
  header(name: string): i32 {
    for (let i: i32 = 0; i < this.headerCount; i++) {
      if (handlerSpanIs(this.head, this.spans[4 * i], this.spans[4 * i + 1], name)) {
        return i
      }
    }
    return HANDLER_ABSENT
  }

  /** Where field `i`'s value starts in `head`. */
  valueStart(i: i32): i32 {
    return this.spans[4 * i + 2]
  }

  /** Where field `i`'s value ends in `head`. */
  valueEnd(i: i32): i32 {
    return this.spans[4 * i + 3]
  }

  /** Whether the first field named `name` (lowercase) has exactly the value `value`. */
  headerIs(name: string, value: string): boolean {
    const i: i32 = this.header(name)
    return i >= 0 && handlerSpanIs(this.head, this.spans[4 * i + 2], this.spans[4 * i + 3], value)
  }
}

/**
 * The HTTP/1.1 server: a carrier, its readiness loop, a router and a pool of
 * requests. One per thread; nothing in it is shared.
 */
export class HttpHandler {
  server: Http1Server
  router: Router
  /** Every request the pool has made, and the indices of the free ones. */
  requests: HttpRequest[]
  free: i32[]
  /** Whole requests waiting for `take`, a ring of `queue.length` with `queueCount` from `queueStart`. */
  queue: i32[]
  /** Per slot: its generation, its request (-1 for none), and whether it holds a connection. */
  slotGen: i32[]
  current: i32[]
  open: boolean[]
  /** `pollWait`'s output. */
  readyFds: i32[]
  /** Per watched id: whether its descriptor was ready in the last `wait`. */
  watchedFired: boolean[]
  /** `json` and `problem` write here. */
  scratch: u8[]
  writer: JsonWriter
  /** `refuse`'s scratch for `Router.match`. */
  probe: i32[]
  /** One field for `send`; two for a 405. */
  typeName: u8[][]
  typeValue: u8[][]
  allowNames: u8[][]
  allowValues: u8[][]
  /** Each `Allow` value made, by the bit mask of the methods it lists: made once a mask and kept. */
  allowMasks: i64[]
  allowBytes: u8[][]
  jsonType: u8[]
  problemType: u8[]
  noFields: u8[][]
  /**
   * When an accept failed for want of a resource (EMFILE, ENFILE, ENOMEM):
   * the listener is out of the loop until then, which it would otherwise wake
   * every turn while its connection waits. 0 while it is in the loop.
   */
  acceptRestUntil: i64 = 0
  listener: i32 = 0
  loop: i32 = 0
  queueStart: i32 = 0
  queueCount: i32 = 0
  outputSize: i32 = 0
  /** Set by `drain`: accept nothing more and close each connection once it is idle. */
  draining: boolean = false
  /** Whether `json` gave out the writer for a value `sendJson` has not yet sent. */
  jsonBegun: boolean = false

  /**
   * A handler over `listener`, a listening socket the program made
   * (`tcpListen`, or `tcpListenFlags` with SO_REUSEPORT for a worker of
   * `nish/net/prefork`), routing through `router`, whose routes are added
   * before the first `wait`.
   */
  constructor(limits: HandlerLimits, listener: i32, router: Router) {
    if (limits.slots < 1 || limits.jsonBytes < 256 || limits.maxEvents < 1) {
      panic(
        `HttpHandler: slots ${limits.slots}, jsonBytes ${limits.jsonBytes} and maxEvents ${limits.maxEvents} need at least 1, 256 and 1`
      )
    }
    this.server = new Http1Server(limits.http, listener, limits.slots)
    this.router = router
    this.listener = listener
    this.outputSize = limits.http.outputSize
    this.requests = []
    this.free = []
    this.queue = new Array<i32>(16)
    this.slotGen = new Array<i32>(limits.slots)
    this.current = new Array<i32>(limits.slots)
    this.open = new Array<boolean>(limits.slots)
    for (let s: i32 = 0; s < limits.slots; s++) {
      this.current[s] = -1
    }
    this.readyFds = new Array<i32>(2 * limits.maxEvents)
    this.watchedFired = new Array<boolean>(HANDLER_MAX_WATCHED)
    this.scratch = new Array<u8>(limits.jsonBytes)
    this.writer = new JsonWriter(this.scratch, HANDLER_ZERO)
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
    this.loop = pollCreate()
    if (this.loop < 0) {
      panic(`HttpHandler: pollCreate failed: ${this.loop}`)
    }
    pollAdd(this.loop, listener, H1_WANT_READ, HANDLER_LISTENER)
  }

  // ---- The loop -------------------------------------------------------------------

  /**
   * Watches `fd` for reading beside the handler's sockets, as `id` (0 to
   * `HANDLER_MAX_WATCHED - 1`): `fired(id)` says whether it was ready in the
   * last `wait`. For a program's own descriptors — `signalFd()` for a
   * graceful stop, a pipe from another thread.
   */
  watch(fd: i32, id: i32): void {
    if (id < 0 || id >= HANDLER_MAX_WATCHED) {
      panic(`HttpHandler.watch: id ${id} is outside 0 to ${HANDLER_MAX_WATCHED - 1}`)
    }
    pollAdd(this.loop, fd, H1_WANT_READ, -2 - id)
  }

  /** Whether watched descriptor `id` was ready in the last `wait`. */
  fired(id: i32): boolean {
    return id >= 0 && id < HANDLER_MAX_WATCHED && this.watchedFired[id]
  }

  /**
   * One turn of the loop: waits up to `timeoutMs` (-1 for no limit) for a
   * socket to be ready, accepts, reads and writes what is, closes the
   * connections past their timeouts, and answers how many whole requests
   * are waiting for `take`.
   */
  wait(timeoutMs: i32): i32 {
    for (let id: i32 = 0; id < HANDLER_MAX_WATCHED; id++) {
      this.watchedFired[id] = false
    }
    if (this.acceptRestUntil > 0 && monotonicNanos() >= this.acceptRestUntil) {
      this.acceptRestUntil = 0
      if (!this.draining) {
        pollAdd(this.loop, this.listener, H1_WANT_READ, HANDLER_LISTENER)
      }
    }
    let timeout: i32 = timeoutMs
    if (this.acceptRestUntil > 0 && !this.draining) {
      // Wake for the listener's return, whatever the program asked.
      const rest: i32 = toI32((this.acceptRestUntil - monotonicNanos()) / toI64(1000000)) + 1
      if (timeout < 0 || rest < timeout) {
        timeout = rest
      }
    }
    const n: i32 = pollWait(this.loop, this.readyFds, timeout)
    for (let k: i32 = 0; k < n; k++) {
      const token: i32 = this.readyFds[2 * k]
      if (token === HANDLER_LISTENER) {
        this.acceptAll()
      } else if (token <= -2) {
        const id: i32 = -2 - token
        if (id < HANDLER_MAX_WATCHED) {
          this.watchedFired[id] = true
        }
      } else if (token >= 0 && this.server.holds(token)) {
        if ((this.readyFds[2 * k + 1] & HANDLER_READ_BITS) !== 0) {
          this.server.readable(token)
        } else {
          this.server.writable(token)
        }
        this.drive(token)
      }
    }
    if (this.server.expire(monotonicNanos()) > 0) {
      this.sweep()
    }
    return this.queueCount
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
    for (let s: i32 = 0; s < toI32(this.open.length) && s < toI32(this.current.length); s++) {
      if (
        this.open[s] &&
        this.server.holds(s) &&
        this.current[s] === -1 &&
        !this.server.connection(s).wantsWrite()
      ) {
        this.closeSlot(s)
      } else if (this.open[s] && this.server.holds(s)) {
        // Its exchange is its last: the answer says `Connection: close` if
        // it is not yet started, and no pipelined request is read behind it.
        this.server.connection(s).closeAfter = true
      }
    }
  }

  /** Takes every waiting connection. */
  acceptAll(): void {
    if (this.draining) {
      return
    }
    let slot: i32 = this.server.accept()
    while (slot >= 0 || slot === H1_POOL_FULL || slot === HANDLER_ACCEPT_ABORTED) {
      if (slot >= 0) {
        this.open[slot] = true
        this.current[slot] = -1
        pollAdd(this.loop, this.server.fd(slot), H1_WANT_READ, slot)
      }
      slot = this.server.accept()
    }
    if (slot !== HANDLER_ACCEPT_NONE) {
      // Out of descriptors or memory: the connection stays in the backlog
      // and the listener stays readable, so rest it rather than spin.
      pollRemove(this.loop, this.listener)
      this.acceptRestUntil = monotonicNanos() + HANDLER_ACCEPT_REST
    }
  }

  /**
   * Takes `slot`'s events until it needs the socket again, then sends what it
   * holds and re-arms it, or closes it once it is over.
   */
  drive(slot: i32): void {
    const conn: Http1Connection = this.server.connection(slot)
    let event: i32 = this.server.next(slot)
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
      event = this.server.next(slot)
    }
    if (event === H1_ERROR) {
      // The carrier has written its refusal and ends the connection; a
      // request it was reading is nobody's.
      this.releaseReading(slot)
    }
    const wants: i32 = this.server.flush(slot)
    if ((wants & H1_DONE) !== 0) {
      this.closeSlot(slot)
      return
    }
    if (this.draining && this.current[slot] === -1 && !conn.wantsWrite()) {
      this.closeSlot(slot)
      return
    }
    if (this.server.rearm(slot, wants)) {
      pollModify(this.loop, this.server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
    }
    const at: i32 = this.current[slot]
    if (at >= 0 && this.requests[at].state === HANDLER_PARKED && this.roomy(conn)) {
      this.enqueue(this.requests[at])
    }
  }

  /** Whether `conn`'s output holds at most half its size unsent, so a response head fits behind it. */
  roomy(conn: Http1Connection): boolean {
    return (conn.outputEnd - conn.outputStart) * 2 <= this.outputSize
  }

  /** A head: a request from the free list, the head copied into it, and its route. */
  begin(slot: i32, conn: Http1Connection): void {
    if (this.draining) {
      // A head read during the drain is the connection's last.
      conn.closeAfter = true
    }
    const r: HttpRequest = this.obtain()
    const p = conn.parser
    const length: i32 = p.headLength
    if (toI32(r.head.length) < length) {
      r.head = new Array<u8>(handlerGrown(toI32(r.head.length), length))
    }
    copyBytes(r.head, HANDLER_ZERO, p.head, HANDLER_ZERO, length)
    const spanCount: i32 = 4 * p.headerCount
    if (toI32(r.spans.length) < spanCount) {
      r.spans = new Array<i32>(handlerGrown(toI32(r.spans.length), spanCount))
    }
    for (let k: i32 = 0; k < spanCount; k++) {
      r.spans[k] = p.spans[k]
    }
    r.headerCount = p.headerCount
    r.methodStart = p.methodStart
    r.methodEnd = p.methodEnd
    r.targetStart = p.targetStart
    r.targetEnd = p.targetEnd
    let pathEnd: i32 = r.targetStart
    while (pathEnd < r.targetEnd && toI32(r.head[pathEnd]) !== 63) {
      pathEnd += 1
    }
    r.pathEnd = pathEnd
    r.bodyLength = 0
    r.slot = slot
    r.gen = this.slotGen[slot]
    r.state = HANDLER_READING
    r.pendingStart = 0
    r.pendingEnd = 0
    this.route(r)
    this.current[slot] = r.index
  }

  /**
   * Routes `r` through the router. A HEAD that only a GET route matches takes
   * that route, since a GET resource answers HEAD (RFC 9110 §9.3.2) and the
   * carrier sends no body for it.
   */
  route(r: HttpRequest): void {
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
    if (route === ROUTER_METHOD_NOT_ALLOWED && r.methodIs("HEAD")) {
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

  /** Body bytes: appended to the request's body, which the carrier's cap bounds. */
  gather(slot: i32, conn: Http1Connection): void {
    const at: i32 = this.current[slot]
    if (at < 0) {
      return
    }
    const r: HttpRequest = this.requests[at]
    const n: i32 = conn.dataLength
    const need: i32 = r.bodyLength + n
    if (toI32(r.body.length) < need) {
      const grown: u8[] = new Array<u8>(handlerGrown(toI32(r.body.length), need))
      copyBytes(grown, HANDLER_ZERO, r.body, HANDLER_ZERO, r.bodyLength)
      r.body = grown
    }
    copyBytes(r.body, r.bodyLength, conn.data, conn.dataStart, n)
    r.bodyLength = need
  }

  /** The request is whole: queued for `take`, or parked while the response before it is still mostly unsent. */
  whole(slot: i32, conn: Http1Connection): void {
    const at: i32 = this.current[slot]
    if (at < 0) {
      return
    }
    const r: HttpRequest = this.requests[at]
    if (this.roomy(conn)) {
      this.enqueue(r)
    } else {
      r.state = HANDLER_PARKED
    }
  }

  enqueue(r: HttpRequest): void {
    r.state = HANDLER_QUEUED
    const size: i32 = toI32(this.queue.length)
    if (this.queueCount === size) {
      const grown: i32[] = new Array<i32>(2 * size)
      for (let k: i32 = 0; k < size && k < toI32(grown.length); k++) {
        grown[k] = this.queue[(this.queueStart + k) % size]
      }
      this.queue = grown
      this.queueStart = 0
    }
    this.queue[(this.queueStart + this.queueCount) % toI32(this.queue.length)] = r.index
    this.queueCount += 1
  }

  /** `H1_WRITE`: the carrier has room again for the response under way. */
  resume(slot: i32, conn: Http1Connection): void {
    const at: i32 = this.current[slot]
    if (at < 0) {
      return
    }
    const r: HttpRequest = this.requests[at]
    if (r.state !== HANDLER_STREAMING && r.state !== HANDLER_FLUSHING) {
      return
    }
    this.pushPending(r, conn)
    if (r.state === HANDLER_FLUSHING) {
      this.finish(r, conn)
    }
  }

  /** Hands the carrier as much of `r`'s pending bytes as it takes. */
  pushPending(r: HttpRequest, conn: Http1Connection): void {
    const left: i32 = r.pendingEnd - r.pendingStart
    if (left === 0) {
      return
    }
    const taken: i32 = conn.write(r.pending, r.pendingStart, left)
    if (taken > 0) {
      r.pendingStart += taken
    }
    if (r.pendingStart === r.pendingEnd) {
      r.pendingStart = 0
      r.pendingEnd = 0
    }
  }

  /** Ends `r`'s response once nothing is pending, and hands `r` back; otherwise leaves it flushing. */
  finish(r: HttpRequest, conn: Http1Connection): void {
    r.state = HANDLER_FLUSHING
    if (r.pendingEnd > r.pendingStart) {
      return
    }
    // `H1_AGAIN`: no room for the last chunk yet; `H1_WRITE` comes back here.
    if (conn.end() === H1_AGAIN) {
      return
    }
    this.current[r.slot] = -1
    this.release(r)
  }

  /** A free request, or a new one. */
  obtain(): HttpRequest {
    const count: i32 = toI32(this.free.length)
    if (count > 0) {
      const at: i32 = this.free[count - 1]
      this.free.pop()
      return this.requests[at]
    }
    const r: HttpRequest = new HttpRequest(toI32(this.requests.length))
    r.params = new Array<i32>(2 * this.router.maxParams + 2)
    this.requests.push(r)
    return r
  }

  release(r: HttpRequest): void {
    if (r.state === HANDLER_FREE) {
      return
    }
    r.state = HANDLER_FREE
    this.free.push(r.index)
  }

  /** Hands back the request `slot` was reading when the carrier refused it. */
  releaseReading(slot: i32): void {
    const at: i32 = this.current[slot]
    if (at >= 0 && this.requests[at].state === HANDLER_READING) {
      this.current[slot] = -1
      this.release(this.requests[at])
    }
  }

  /**
   * Closes `slot` and bumps its generation, so any answer still owed for it is
   * dropped. A request the handler alone holds goes back now; one queued or
   * taken goes back when `ready` passes it or the program answers it.
   */
  closeSlot(slot: i32): void {
    this.server.close(slot)
    this.forget(slot)
  }

  /** The bookkeeping of a slot the carrier has closed. */
  forget(slot: i32): void {
    this.open[slot] = false
    this.slotGen[slot] = this.slotGen[slot] + 1
    const at: i32 = this.current[slot]
    this.current[slot] = -1
    if (at >= 0) {
      const r: HttpRequest = this.requests[at]
      if (r.state === HANDLER_READING || r.state === HANDLER_PARKED || r.state === HANDLER_FLUSHING) {
        this.release(r)
      }
    }
  }

  /** Every slot the carrier's `expire` closed. */
  sweep(): void {
    for (let s: i32 = 0; s < toI32(this.open.length); s++) {
      if (this.open[s] && !this.server.holds(s)) {
        this.forget(s)
      }
    }
  }

  // ---- Requests -------------------------------------------------------------------

  /** Whether a whole request is waiting for `take`. Requests whose connection closed while queued are handed back here. */
  ready(): boolean {
    while (this.queueCount > 0) {
      const r: HttpRequest = this.requests[this.queue[this.queueStart]]
      if (this.live(r)) {
        return true
      }
      this.queueStart = (this.queueStart + 1) % toI32(this.queue.length)
      this.queueCount -= 1
      this.release(r)
    }
    return false
  }

  /** The next whole request, which the program now owes an answer. Panics when none is `ready`. */
  take(): HttpRequest {
    if (!this.ready()) {
      panic("HttpHandler.take: no request is ready")
    }
    const r: HttpRequest = this.requests[this.queue[this.queueStart]]
    this.queueStart = (this.queueStart + 1) % toI32(this.queue.length)
    this.queueCount -= 1
    r.state = HANDLER_HELD
    return r
  }

  /** Whether `r`'s connection is the one it was read on, still open. */
  live(r: HttpRequest): boolean {
    return this.server.holds(r.slot) && this.slotGen[r.slot] === r.gen
  }

  /** How many requests the pool has made: the most ever in flight at once. */
  pooled(): i32 {
    return toI32(this.requests.length)
  }

  /** How many connections are open. */
  connections(): i32 {
    return this.server.busy()
  }

  // ---- Responses ------------------------------------------------------------------

  /**
   * Starts `r`'s response: `status` (200 to 599), the fields `names[k]`:
   * `values[k]`, and a body of `bodyLength` bytes or `HTTP1_CHUNKED`; then
   * `write` the body and `end`. Answers `HANDLER_SENT`, or `HANDLER_DROPPED`
   * when `r`'s connection has closed — every later `write` and `end` for it
   * then does nothing, and `end` hands it back.
   */
  start(r: HttpRequest, status: i32, names: u8[][], values: u8[][], bodyLength: i32): i32 {
    if (r.state !== HANDLER_HELD) {
      panic(`HttpHandler.start: the request is not one taken and unanswered (state ${r.state})`)
    }
    if (status < 200 || status > 599) {
      panic(`HttpHandler.start: status ${status} is outside 200 to 599`)
    }
    if (bodyLength < HTTP1_CHUNKED) {
      panic(`HttpHandler.start: body length ${bodyLength}`)
    }
    r.state = HANDLER_STREAMING
    if (!this.live(r)) {
      return HANDLER_DROPPED
    }
    const conn: Http1Connection = this.server.connection(r.slot)
    const framing: i32 = status === 204 || status === 304 ? HTTP1_NO_BODY : bodyLength
    const sent: i32 = conn.respond(status, names, values, framing)
    if (sent === H1_AGAIN) {
      // The output still holds more of the response before this one than a
      // head can fit behind — only for a head near half the output, since a
      // request waits for that much room before it is queued. Ending the
      // connection is the one answer left.
      this.closeSlot(r.slot)
      return HANDLER_DROPPED
    }
    if (sent !== 0) {
      panic(
        `HttpHandler.start: the carrier refused the head (${sent}): a reserved field, or a name or value that is not a token or field text`
      )
    }
    return HANDLER_SENT
  }

  /**
   * Writes `buf[off .. off + len)` of `r`'s body. What the carrier has no room
   * for is copied and sent as room comes, so `buf` is the caller's again on
   * return. Answers `HANDLER_SENT` or `HANDLER_DROPPED`.
   */
  write(r: HttpRequest, buf: u8[], off: i32, len: i32): i32 {
    if (r.state !== HANDLER_STREAMING) {
      panic(`HttpHandler.write: the response is not started (state ${r.state})`)
    }
    if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
      panic(`HttpHandler.write: the window ${off} + ${len} is outside its ${buf.length} bytes`)
    }
    if (!this.live(r)) {
      return HANDLER_DROPPED
    }
    const conn: Http1Connection = this.server.connection(r.slot)
    // The carrier checks the length of what it takes; what is pending it has
    // not seen, so the check counts it here.
    const owed: i32 = conn.responseLeft - (r.pendingEnd - r.pendingStart)
    if (conn.responseFraming >= 0 && !conn.responseEmpty && len > owed) {
      panic(
        `HttpHandler.write: ${len} byte(s) is more than the ${owed} the length the response declared leaves`
      )
    }
    let taken: i32 = 0
    if (r.pendingEnd === r.pendingStart) {
      taken = conn.write(buf, off, len)
      if (taken === H1_AGAIN) {
        taken = 0
      } else if (taken < 0) {
        panic(
          `HttpHandler.write: the carrier refused the body (${taken}): more than the length the response declared`
        )
      }
    }
    if (taken < len) {
      this.keep(r, buf, off + taken, len - taken)
    }
    this.drive(r.slot)
    return HANDLER_SENT
  }

  /** Appends bytes to `r`'s pending buffer, growing it once to the largest response it has held. */
  keep(r: HttpRequest, buf: u8[], off: i32, len: i32): void {
    const live: i32 = r.pendingEnd - r.pendingStart
    if (toI32(r.pending.length) - r.pendingEnd < len) {
      if (r.pendingStart > 0 || toI32(r.pending.length) < live + len) {
        const target: u8[] =
          toI32(r.pending.length) < live + len
            ? new Array<u8>(handlerGrown(toI32(r.pending.length), live + len))
            : r.pending
        copyBytes(target, HANDLER_ZERO, r.pending, r.pendingStart, live)
        r.pending = target
        r.pendingStart = 0
        r.pendingEnd = live
      }
    }
    copyBytes(r.pending, r.pendingEnd, buf, off, len)
    r.pendingEnd += len
  }

  /**
   * Ends `r`'s response. `r` is the handler's again: it goes back once the
   * carrier has taken every byte, and the connection's next request is read.
   * Answers `HANDLER_SENT` or `HANDLER_DROPPED`.
   */
  end(r: HttpRequest): i32 {
    if (r.state !== HANDLER_STREAMING) {
      panic(`HttpHandler.end: the response is not started (state ${r.state})`)
    }
    if (!this.live(r)) {
      this.release(r)
      return HANDLER_DROPPED
    }
    const slot: i32 = r.slot
    const conn: Http1Connection = this.server.connection(slot)
    const short: i32 = conn.responseLeft - (r.pendingEnd - r.pendingStart)
    if (conn.responseFraming >= 0 && short > 0 && !conn.responseEmpty) {
      panic(`HttpHandler.end: the body is ${short} byte(s) short of the length the response declared`)
    }
    this.finish(r, conn)
    this.drive(slot)
    return HANDLER_SENT
  }

  /** Answers `r` with `status`, a `Content-Type` of `contentType` and the body `body[off .. off + len)`, in one call. */
  send(r: HttpRequest, status: i32, contentType: u8[], body: u8[], off: i32, len: i32): i32 {
    this.typeValue[0] = contentType
    return this.sendFields(r, status, this.typeName, this.typeValue, body, off, len)
  }

  /** Answers `r` with `status`, the fields `names[k]`: `values[k]` and the body `body[off .. off + len)`, in one call. */
  sendFields(
    r: HttpRequest,
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

  /** Answers `r` with `status` and no body: a 204, or a status whose meaning is all there is to say. */
  empty(r: HttpRequest, status: i32): i32 {
    return this.sendFields(r, status, this.noFields, this.noFields, this.scratch, HANDLER_ZERO, HANDLER_ZERO)
  }

  /**
   * The JSON writer, reset onto the handler's scratch buffer: write one value
   * with it, then `sendJson`. One JSON body at a time, since every request
   * shares the buffer.
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
   */
  sendJson(r: HttpRequest, status: i32): i32 {
    if (!this.jsonBegun) {
      panic("HttpHandler.sendJson: no value was begun with json()")
    }
    this.jsonBegun = false
    if (!this.writer.complete()) {
      return this.problem(r, toI32(500), "Internal Server Error", "the response did not fit its buffer")
    }
    return this.send(r, status, this.jsonType, this.scratch, HANDLER_ZERO, this.writer.end)
  }

  /**
   * Answers `r` with an RFC 9457 problem: `application/problem+json` with
   * `type` `about:blank`, `title` (the status's reason, for that type),
   * `status` and, when not empty, `detail`, a sentence for a person about
   * this occurrence. Nothing of the request is echoed, so a detail is the
   * program's own words.
   */
  problem(r: HttpRequest, status: i32, title: string, detail: string): i32 {
    const length: i32 = this.writeProblem(status, title, detail)
    return this.send(r, status, this.problemType, this.scratch, HANDLER_ZERO, length)
  }

  /**
   * Writes a problem object into the scratch buffer and answers its length.
   * One too large for it is written without its detail, and then without its
   * title, which leaves room enough in the least `jsonBytes`.
   */
  writeProblem(status: i32, title: string, detail: string): i32 {
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
  writeProblemObject(status: i32, title: string, detail: string): i32 {
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
   */
  refuse(r: HttpRequest): i32 {
    if (r.route === ROUTER_METHOD_NOT_ALLOWED) {
      const length: i32 = this.writeProblem(toI32(405), "Method Not Allowed", "")
      this.allowValues[1] = this.allowFor(r)
      return this.sendFields(
        r,
        toI32(405),
        this.allowNames,
        this.allowValues,
        this.scratch,
        HANDLER_ZERO,
        length
      )
    }
    return this.problem(r, toI32(404), "Not Found", "")
  }

  /**
   * The `Allow` value for `r`'s path: each method a route of it takes, and
   * HEAD wherever GET is, since a GET route answers HEAD too. Made once for
   * each set of methods.
   */
  allowFor(r: HttpRequest): u8[] {
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

/** A buffer size of at least `need`: `have` doubled until it is, starting from 64. */
const handlerGrown = (have: i32, need: i32): i32 => {
  let size: i32 = have < 64 ? 64 : have
  while (size < need && size < 1073741824) {
    size = size * 2
  }
  return size < need ? need : size
}

/** Whether `bytes[start .. end)` is exactly `text`. */
const handlerSpanIs = (bytes: u8[], start: i32, end: i32, text: string): boolean => {
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
const handlerDecimal = (bytes: u8[], start: i32, end: i32): i32 => {
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
const handlerFormByte = (bytes: u8[], at: i32, end: i32): i32 => {
  const c: i32 = toI32(bytes[at])
  if (c === 43) {
    return 32 | HANDLER_TOOK_ONE
  }
  if (c !== 37) {
    return c | HANDLER_TOOK_ONE
  }
  if (at + 2 >= end) {
    return -1
  }
  const hi: i32 = http1HexValue(toI32(bytes[at + 1]))
  const lo: i32 = http1HexValue(toI32(bytes[at + 2]))
  if (hi < 0 || lo < 0) {
    return -1
  }
  return (hi * 16 + lo) | HANDLER_TOOK_THREE
}

/** Whether `bytes[start .. end)`, form-decoded, is exactly `name`; a malformed escape matches nothing. */
const handlerFormIs = (bytes: u8[], start: i32, end: i32, name: string): boolean => {
  const n: i32 = toI32(name.length)
  let at: i32 = start
  let k: i32 = 0
  while (at < end) {
    const packed: i32 = handlerFormByte(bytes, at, end)
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
const handlerFormDecode = (bytes: u8[], start: i32, end: i32, out: u8[]): i32 => {
  const length: i32 = percentDecode(
    bytes,
    start,
    end - start,
    out,
    HANDLER_ZERO,
    URL_DECODE_FORM | URL_DECODE_ALLOW_NUL
  )
  if (length === URL_DECODE_ERR_SPACE) {
    return ROUTER_NO_ROOM
  }
  return length < 0 ? ROUTER_BAD_ESCAPE : length
}
