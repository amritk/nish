/**
 * `nish/net/upstream` — outbound HTTP/1.1 calls from a route handler that
 * never block its worker: a pool of keep-alive connections to one origin,
 * registered on the `HttpHandler`'s own poll loop and read through the
 * `nish/net/http1-client-codec` codec.
 *
 *     const h = new HttpHandler(new HandlerLimits(), listener, router)
 *     const users = new Upstream(h, "http://127.0.0.1:9000", new UpstreamLimits())
 *     while (true) {
 *       h.wait(100) // one turn: the handler's sockets and the upstream's
 *       while (h.ready()) {
 *         const req = h.take()
 *         switch (req.route) {
 *           case USER: if (users.get(req, "/v1/users/7") !== UPSTREAM_E_NONE) { h.problem(req, 503, "Busy", "") } break
 *           default: h.refuse(req)
 *         }
 *       }
 *       while (users.ready()) { // the answers that arrived this turn
 *         const r = users.take() // r.req is the request that asked
 *         if (r.ok) { h.send(r.req, r.status, JSON, r.body, 0, r.length) } else { h.problem(r.req, 502, "Bad Gateway", "") }
 *         users.release(r)
 *       }
 *     }
 *
 * **`get` returns at once.** It writes the request head into a call slot
 * taken from a pool, then onto a free connection, or queues it until one is
 * free, and the program goes on serving. The asking request stays held, as
 * `nish/net/handler` allows. Each connection is watched on the handler's loop
 * under a watch id (`UpstreamLimits.firstId` and up), so the program's next
 * `h.wait` wakes for the upstream as well as for its clients; `ready` then
 * reads what arrived, once per turn, and hands back every finished call.
 *
 * **Every call ends exactly once, as a call.** A response the codec reads to
 * its end is `ok` with its `status` and body, whatever the status. Anything
 * else is `ok === false` with an `error`: one of the codec's `HTTP1_E_`
 * refusals (a malformed status line, a bare LF, conflicting framing, a body
 * past `maxBody`, a response cut short), or one of the `UPSTREAM_E_` codes
 * below (the origin was unusable, the connection failed or closed, the
 * deadline passed, the path could not be written). The program answers its
 * own client either way and gives the call back with `release`.
 *
 * **A kept-alive connection is checked before it is reused.** One the origin
 * closed or sent bytes on while it was idle is closed instead, so no call is
 * written to a dead socket or handed bytes it did not ask for. A call the
 * origin drops unanswered on a reused connection anyway (it closed as the
 * request crossed) is made once more, on a new connection; a `GET` is safe
 * to repeat. Two `Upstream`s on one handler must be given watch ids that do
 * not overlap: nothing checks it, and two with the default limits would both
 * take ids 8 to 11, each taking the other's wake-ups for its own.
 *
 * **The origin is fixed at start-up.** The constructor parses it, looks its
 * host up (blocking, once, as a program's start-up may), and keeps one
 * address; nothing is looked up again, so no later answer can move the pool
 * somewhere else. When the origin comes from input — configuration, an
 * environment variable, a request — set `UpstreamLimits.outbound`: the
 * `nish/net/outbound` policy then checks the host name before the lookup and
 * the address after it, and a refused origin fails every call with
 * `UPSTREAM_E_BLOCKED`. Only `http:` is spoken; TLS is not, so `https:` is
 * `UPSTREAM_E_ORIGIN`.
 *
 * **Every cap is set at start-up.** The connection count, the call slots
 * (calls queued, in flight and finished but not yet released), the request
 * head's room, the response limits the codec enforces, and a deadline per
 * call. The slots, their head buffers and the connections' read buffers are
 * made by the constructor; a call's body buffer grows to the largest body it
 * has held and is kept. Each connection keeps one codec for its life and
 * the next connection's, reset between them, in its spans mode: a response's
 * fields are read as spans of a buffer the codec reuses, so a warm pool
 * allocates nothing per call.
 *
 * `docs/security/upstream.md` is the record. Private helpers share the
 * importing program's flat symbol namespace (`docs/wp26-stdlib.md` §3e),
 * which is why each one carries the module's name.
 *
 * Written from RFC 9110 and RFC 9112, not ported from another implementation.
 */
import { tryCopyBytes } from "nish/bytes"
import { DNS_ADDRESS_BYTES } from "nish/net/dns-message"
import { DNS_RESOLVE_MAX_ADDRESSES } from "nish/net/dns-resolver"
import { resolveHost } from "nish/net/dns"
import { HANDLER_MAX_WATCHED, HttpHandler, HttpRequest } from "nish/net/handler"
import {
  HTTP1_BODY,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_HEAD,
  HTTP1_NEED_MORE,
  HTTP1_NO_BODY,
} from "nish/net/http1-codec"
import {
  HTTP1_E_BODY_LIMIT,
  HTTP1_INFORMATIONAL,
  Http1ResponseParser,
  http1WriteRequestHead,
} from "nish/net/http1-client-codec"
import { OutboundPolicy, outboundAddressText, outboundFilter, outboundHostAllowed } from "nish/net/outbound"
import { Url, urlParse } from "nish/net/url"
import {
  connectResult,
  netClose,
  netRead,
  netWrite,
  pollAdd,
  pollModify,
  pollRemove,
  tcpConnect,
} from "nish:net"
import { monotonicNanos } from "nish:process"

/** The call was read to its end: `ok`. */
export const UPSTREAM_E_NONE: i32 = 0
// 1 to 18 are the codec's own `HTTP1_E_` refusals, passed through as they are.
/** The origin is not an `http:` URL with a host and nothing past its authority but `/`. */
export const UPSTREAM_E_ORIGIN: i32 = 32
/** The origin's host could not be looked up at start-up. */
export const UPSTREAM_E_LOOKUP: i32 = 33
/** The outbound policy refused the origin's host name or every address it has. */
export const UPSTREAM_E_BLOCKED: i32 = 34
/** The connection to the origin could not be made. */
export const UPSTREAM_E_CONNECT: i32 = 35
/** The call's deadline passed before its response ended. */
export const UPSTREAM_E_TIMEOUT: i32 = 36
/** The connection failed or closed before a response began. */
export const UPSTREAM_E_CLOSED: i32 = 37
/**
 * The path does not start with `/` (an absolute-form or asterisk target is
 * not this pool's to send), the codec refused to write it, or the head did
 * not fit `maxHead`.
 */
export const UPSTREAM_E_REQUEST: i32 = 38
/** Every call slot is taken: `get` answers this and holds nothing. */
export const UPSTREAM_E_FULL: i32 = 39
/** The connection failed (it was reset, say) while the response was being read: what came is not the whole of it. */
export const UPSTREAM_E_RESET: i32 = 40

const UPSTREAM_READ: i32 = 1
const UPSTREAM_WRITE: i32 = 2
const UPSTREAM_WOULD_BLOCK: i32 = -11
const UPSTREAM_NS_PER_MS: i64 = 1000000
const UPSTREAM_READ_CHUNK: i32 = 16384
/** The largest body a call takes, whatever `maxBody` says: doubling the buffer up to it stays in i32's range. */
const UPSTREAM_MAX_BODY: i64 = 1073741824

/** Room for every address one lookup gives. */
const UPSTREAM_ADDRESS_ROOM: i32 = DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES

/** A connection with no socket. */
const UPSTREAM_C_CLOSED: i32 = 0
/** Connecting, with a call waiting on it. */
const UPSTREAM_C_CONNECTING: i32 = 1
/** Carrying a call: its head being written, or its response being read. */
const UPSTREAM_C_BUSY: i32 = 2
/** Open and kept alive, with no call on it. */
const UPSTREAM_C_IDLE: i32 = 3

/** The caps of one `Upstream`, all read once by its constructor. */
export class UpstreamLimits {
  /** Checks the origin's host and address when set; set it whenever the origin comes from input. */
  outbound: OutboundPolicy | null = null
  /** The largest response body the codec accepts, at most 1 GiB; past it the call fails `HTTP1_E_BODY_LIMIT`. */
  maxBody: i64 = 1048576
  /** Connections to the origin, at most; each takes one handler watch id. */
  connections: i32 = 4
  /** Call slots: calls queued, in flight, and finished but not yet released, at most. */
  calls: i32 = 256
  /** The first handler watch id the connections take: they use `firstId` to `firstId + connections - 1`. */
  firstId: i32 = 8
  /** A call fails `UPSTREAM_E_TIMEOUT` this long after `get` if its response has not ended. */
  timeoutMs: i32 = 10000
  /** How long the constructor's one lookup of the origin's host may take. */
  lookupMs: i32 = 5000
  /** Room for one request head: the request line, `Host` and the empty line. */
  maxHead: i32 = 8192
  /** The longest status line a response may have, in bytes. */
  maxStatusLine: i32 = 8192
  /** The most bytes a response's header section may take. */
  maxHeaderBytes: i32 = 65536
  /** The most field lines a response may carry, trailers included. */
  maxHeaders: i32 = 100
  /** The most bytes a response's trailer section may take. */
  maxTrailerBytes: i32 = 8192
}

/**
 * One call: the request that asked, then, once `ready` hands it back, how it
 * ended. The object is the pool's again after `release`.
 */
export class UpstreamResponse {
  /** The handler's request this call answers. */
  req: HttpRequest
  /** The body, in `body[0 .. length)`; the buffer is reused, so read `length`, not `body.length`. */
  body: u8[]
  /** The request head, written by `get`. @internal */
  head: u8[]
  /** When the call fails `UPSTREAM_E_TIMEOUT`, on `monotonicNanos`'s clock. @internal */
  deadline: i64 = 0
  /** The final status code, once the response's head has arrived. */
  status: i32 = 0
  /** `UPSTREAM_E_NONE`, an `HTTP1_E_` refusal of the codec, or an `UPSTREAM_E_` code. */
  error: i32 = 0
  /** How many bytes of `body` the response filled. */
  length: i32 = 0
  /** @internal Call bookkeeping that `Upstream` reads and writes. */
  headLength: i32 = 0
  /** @internal Call bookkeeping that `Upstream` reads and writes. */
  index: i32 = 0
  /** Whether the response was read to its end; `error` says why not. */
  ok: boolean = false
  /** Taken by the program and not yet released. @internal */
  taken: boolean = false
  /** Made once more already, after a reused connection dropped it unanswered. @internal */
  retried: boolean = false

  /**
   * An empty call slot; `Upstream` makes its pool of them.
   * @param index The slot's place in the pool.
   * @param headRoom The most bytes the request head may take; below 1, none.
   * @param placeholder The request the slot names until a call takes it.
   */
  constructor(index: i32, headRoom: i32, placeholder: HttpRequest) {
    this.index = index
    this.req = placeholder
    this.head = upstreamBytes(headRoom)
    this.body = new Array<u8>(0)
  }
}

/** One connection of the pool. */
class UpstreamConnection {
  /** @internal Connection state that `Upstream` reads and writes. */
  parser: Http1ResponseParser
  /** @internal Connection state that `Upstream` reads and writes. */
  input: u8[]
  /** @internal Connection state that `Upstream` reads and writes. */
  fd: i32 = -1
  /** Its handler watch id. @internal */
  id: i32 = 0
  /** @internal Connection state that `Upstream` reads and writes. */
  state: i32 = 0
  /** The slot of the call it carries, or -1. @internal */
  call: i32 = -1
  /** How much of the call's head has been written. @internal */
  sent: i32 = 0
  /** The poll interest it is registered with, 0 for none. @internal */
  events: i32 = 0
  /** Whether the call it carries went out on a connection kept alive from an earlier call. @internal */
  reused: boolean = false
  /** Whether any byte of the call's response has arrived. @internal */
  answered: boolean = false

  constructor(id: i32, parser: Http1ResponseParser) {
    this.id = id
    this.parser = parser
    this.input = new Array<u8>(UPSTREAM_READ_CHUNK)
  }
}

/** A keep-alive pool to one origin, on an `HttpHandler`'s loop. */
export class Upstream {
  private h: HttpHandler
  private limits: UpstreamLimits
  /** The one address the pool connects to, checked against the policy if there is one. */
  private address: u8[]
  private hostNames: string[]
  private hostValues: string[]
  private connections: UpstreamConnection[]
  private calls: UpstreamResponse[]
  private free: i32[]
  /** Calls written into their slot and waiting for a connection, oldest first. */
  private waiting: UpstreamQueue
  /** Calls ended and not yet taken, in the order they ended. */
  private done: UpstreamQueue
  /** Why the origin is unusable; empty when it is not. For a log. */
  errorText: string = ""
  /** The handler turn `pump` last read. */
  private turn: i64 = -1
  /** Not `UPSTREAM_E_NONE` when the origin is unusable: every call then fails with it. */
  error: i32 = 0
  private freeCount: i32 = 0

  /**
   * Parses `origin`, looks its host up once (this blocks for at most
   * `limits.lookupMs`), and makes every slot and connection buffer. Panics
   * when a cap is below 1 or the watch ids run past the handler's. An
   * unusable origin is not a panic: `error` says why, and every call fails
   * with it.
   * @param h The handler whose poll loop the connections are watched on.
   * @param origin The `http://` URL of the origin every call goes to.
   * @param limits The pool's sizes, watch ids, deadlines and the codec's caps.
   */
  constructor(h: HttpHandler, origin: string, limits: UpstreamLimits) {
    // Read once into locals: the checks below then still hold after the calls that build the pool.
    const connections: i32 = limits.connections
    const slots: i32 = limits.calls
    const firstId: i32 = limits.firstId
    if (connections < 1 || slots < 1 || limits.maxHead < 1 || limits.timeoutMs < 1) {
      panic("Upstream: connections, calls, maxHead and timeoutMs must each be at least 1")
    }
    // Both are in 0 .. 2^31, so their unsigned sum cannot wrap.
    if (firstId < 0 || toU32(firstId) + toU32(connections) > toU32(HANDLER_MAX_WATCHED)) {
      panic(
        `Upstream: ${connections} watch ids from ${firstId} are not all inside 0 to ${HANDLER_MAX_WATCHED - 1}`
      )
    }
    this.h = h
    this.limits = limits
    this.address = new Array<u8>(DNS_ADDRESS_BYTES)
    this.hostNames = ["host"]
    this.hostValues = [""]
    this.connections = []
    for (let k: i32 = 0; k < connections; k += 1) {
      // `firstId + k` is below `firstId + connections`, which the check above holds to HANDLER_MAX_WATCHED.
      const id: i32 = toI32(toU32(firstId) + toU32(k))
      this.connections.push(new UpstreamConnection(id, upstreamParser(limits)))
    }
    const placeholder: HttpRequest = new HttpRequest(-1)
    this.calls = []
    const free: i32[] = upstreamSlots(slots)
    for (let k: i32 = 0; k < slots && k < toI32(free.length); k += 1) {
      // `k` is below `slots`, so `slots - 1 - k` is in 0 .. slots - 1 and the unsigned difference cannot wrap.
      free[k] = toI32(toU32(slots) - 1 - toU32(k))
    }
    for (let k: i32 = 0; k < slots; k += 1) {
      this.calls.push(new UpstreamResponse(k, limits.maxHead, placeholder))
    }
    this.free = free
    this.waiting = new UpstreamQueue(upstreamSlots(slots))
    this.done = new UpstreamQueue(upstreamSlots(slots))
    this.freeCount = slots
    this.settle(origin)
  }

  /** Settles the origin: its `Host` value and the one address, or `error`. */
  private settle(origin: string): void {
    const url: Url | null = urlParse(origin)
    if (
      url === null ||
      url.scheme !== "http" ||
      url.host === "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.query !== null ||
      url.fragment !== null ||
      (url.path !== "" && url.path !== "/")
    ) {
      this.fail(UPSTREAM_E_ORIGIN, `${origin} is not an http: origin`)
      return
    }
    const host: string = url.host
    const port: i32 = url.port >= 0 ? url.port : 80
    const named: string = host.indexOf(":") >= 0 ? `[${host}]` : host
    this.hostValues = [url.port >= 0 ? `${named}:${port}` : named]
    const policy: OutboundPolicy | null = this.limits.outbound
    if (policy !== null && !outboundHostAllowed(policy, host)) {
      this.fail(UPSTREAM_E_BLOCKED, `${host} is not a host the outbound policy allows`)
      return
    }
    const addresses: u8[] = new Array<u8>(UPSTREAM_ADDRESS_ROOM)
    const ttls: i32[] = new Array<i32>(DNS_RESOLVE_MAX_ADDRESSES)
    const count: i32 = resolveHost(host, this.limits.lookupMs, port, addresses, ttls)
    if (count <= 0) {
      this.fail(
        UPSTREAM_E_LOOKUP,
        `${host} could not be looked up (${count === 0 ? "no address" : `code ${count}`})`
      )
      return
    }
    let usable: i32 = count < DNS_RESOLVE_MAX_ADDRESSES ? count : DNS_RESOLVE_MAX_ADDRESSES
    if (policy !== null) {
      // Only the bytes checked here are connected to: there is no second lookup.
      usable = outboundFilter(policy, addresses, usable)
      if (usable === 0) {
        this.fail(
          UPSTREAM_E_BLOCKED,
          `${host} resolves to ${outboundAddressText(addresses, 0)}, which the outbound policy does not allow`
        )
        return
      }
    }
    // `usable` is at least 1 here, so the first address is filled and the copy does not fail.
    if (!tryCopyBytes(this.address, 0, addresses, 0, DNS_ADDRESS_BYTES)) {
      this.fail(UPSTREAM_E_LOOKUP, `${host} gave no address to copy`)
    }
  }

  private fail(code: i32, text: string): void {
    this.error = code
    this.errorText = text
  }

  // ---- Calls ------------------------------------------------------------------

  /**
   * Starts `GET path` for `req` and returns at once: `UPSTREAM_E_NONE` when
   * the call is the pool's, which hands it back through `ready` and `take`
   * however it ends; `UPSTREAM_E_FULL` when every slot is taken, and then
   * nothing is held and `req` is still the program's to answer. `path` is
   * copied out before this returns.
   * @param req The handler's request the call answers; it stays held until the call ends.
   * @param path The origin's path to get, with its query, in origin form: it starts with `/`. An empty path, or one without the leading `/`, ends the call with `UPSTREAM_E_REQUEST`, which `take` reports, while `get` still returns `UPSTREAM_E_NONE`.
   * @returns `UPSTREAM_E_NONE` when the call started, `UPSTREAM_E_FULL` when no slot is free.
   */
  get(req: HttpRequest, path: string): i32 {
    const count: i32 = this.freeCount
    if (count <= 0) {
      return UPSTREAM_E_FULL
    }
    const top: i32 = count - 1
    const free: i32[] = this.free
    // The free list holds `calls` places and `freeCount` never passes it; this only lets the index be proven.
    if (top >= toI32(free.length)) {
      return UPSTREAM_E_FULL
    }
    const r: UpstreamResponse | null = this.slot(free[top])
    if (r === null) {
      return UPSTREAM_E_FULL
    }
    this.freeCount = top
    r.req = req
    r.ok = false
    r.status = 0
    r.error = UPSTREAM_E_NONE
    r.length = 0
    r.retried = false
    // The clock counts nanoseconds since boot and the span is under 2^52 ns, so the sum is far inside
    // i64; added as u64 it is the same two's-complement sum without an overflow check.
    const span: i64 = toI64(this.limits.timeoutMs) * UPSTREAM_NS_PER_MS
    r.deadline = toI64(toU64(monotonicNanos()) + toU64(span))
    if (this.error !== UPSTREAM_E_NONE) {
      this.end(r, this.error)
      return UPSTREAM_E_NONE
    }
    // An origin-form target only: an absolute-form one would name another host on this pool's connection.
    if (path.length <= 0 || path.charCodeAt(0) !== 47) {
      this.end(r, UPSTREAM_E_REQUEST)
      return UPSTREAM_E_NONE
    }
    const n: i32 = http1WriteRequestHead(
      r.head,
      0,
      "GET",
      path,
      this.hostNames,
      this.hostValues,
      toI64(HTTP1_NO_BODY)
    )
    if (n < 0) {
      this.end(r, UPSTREAM_E_REQUEST)
      return UPSTREAM_E_NONE
    }
    r.headLength = n
    this.waiting.push(r.index)
    this.dispatch()
    return UPSTREAM_E_NONE
  }

  /**
   * Whether a finished call is waiting for `take`; reads the upstream's sockets once per handler turn.
   * @returns Whether `take` has a call to hand back.
   */
  ready(): boolean {
    this.pump()
    return this.done.count > 0
  }

  /**
   * The next finished call, which the program gives back with `release`. Panics when none is `ready`.
   * @returns The call, with `ok`, `status` and its body, or `error` saying why it failed.
   */
  take(): UpstreamResponse {
    const r: UpstreamResponse | null = this.ready() ? this.slot(this.done.shift()) : null
    if (r === null) {
      panic("Upstream.take: no call is ready")
    }
    r.taken = true
    return r
  }

  /**
   * Gives a taken call's slot back to the pool. Panics for a call not taken
   * or already released: two calls sharing a slot would hand one request's
   * answer to another.
   * @param r The call `take` handed back.
   */
  release(r: UpstreamResponse): void {
    if (!r.taken) {
      panic("Upstream.release: the call is not taken, or was released already")
    }
    const top: i32 = this.freeCount
    const free: i32[] = this.free
    // A taken slot is not on the free list, so the list has room for it: this only lets the index be proven.
    if (top < 0 || top >= toI32(free.length)) {
      return
    }
    r.taken = false
    free[top] = r.index
    this.freeCount = top + 1
  }

  /**
   * How many calls hold a slot: queued, in flight, or finished and not yet released.
   * @returns The count of slots in use.
   */
  pending(): i32 {
    // `freeCount` stays in 0 .. free.length, so the unsigned difference cannot wrap.
    return toI32(toU32(toI32(this.free.length)) - toU32(this.freeCount))
  }

  /**
   * How many connections to the origin are open.
   * @returns The count of open connections.
   */
  openConnections(): i32 {
    // Counted unsigned: it is at most `connections.length`, so it cannot wrap.
    let n: u32 = 0
    for (let k: i32 = 0; k < toI32(this.connections.length); k += 1) {
      if (this.connections[k].fd >= 0) {
        n += 1
      }
    }
    return toI32(n)
  }

  // ---- The loop ---------------------------------------------------------------

  /** Once per handler turn: reads and writes the connections that fired, then fails what is past its deadline. */
  private pump(): void {
    if (this.h.turnAt === this.turn) {
      return
    }
    this.turn = this.h.turnAt
    for (let k: i32 = 0; k < toI32(this.connections.length); k += 1) {
      const c: UpstreamConnection = this.connections[k]
      if (c.fd >= 0 && this.h.fired(c.id)) {
        this.service(c)
      }
    }
    const now: i64 = monotonicNanos()
    for (let k: i32 = 0; k < toI32(this.connections.length); k += 1) {
      const c: UpstreamConnection = this.connections[k]
      const r: UpstreamResponse | null = this.slot(c.call)
      if (r !== null && r.deadline <= now) {
        this.finish(c, UPSTREAM_E_TIMEOUT)
      }
    }
    // Every call has the same timeout, so the oldest waiting call is the first to expire.
    while (this.waiting.count > 0) {
      const r: UpstreamResponse | null = this.slot(this.waiting.peek())
      if (r === null || r.deadline > now) {
        break
      }
      this.waiting.shift()
      this.end(r, UPSTREAM_E_TIMEOUT)
    }
    this.dispatch()
  }

  /** Puts waiting calls on connections: a kept-alive one first, then a new one. */
  private dispatch(): void {
    while (this.waiting.count > 0) {
      const c: UpstreamConnection | null = this.idle()
      if (c === null) {
        return
      }
      c.call = this.waiting.shift()
      c.sent = 0
      c.answered = false
      c.reused = c.state === UPSTREAM_C_IDLE
      if (c.reused) {
        c.state = UPSTREAM_C_BUSY
        c.parser.expect(false, false)
        this.send(c)
      } else {
        this.connect(c)
      }
    }
  }

  /**
   * A connection free for the next call: open, idle and still usable if one
   * is, else closed, else null. An idle connection the origin has closed or
   * sent bytes on is closed here, before a call is put on it.
   */
  private idle(): UpstreamConnection | null {
    let closed: UpstreamConnection | null = null
    for (let k: i32 = 0; k < toI32(this.connections.length); k += 1) {
      const c: UpstreamConnection = this.connections[k]
      if (c.state === UPSTREAM_C_IDLE && this.usable(c)) {
        return c
      }
      if (c.state === UPSTREAM_C_CLOSED && closed === null) {
        closed = c
      }
    }
    return closed
  }

  /**
   * Whether the idle `c` has nothing to read. Anything else closes it: an end
   * of stream or an error means the origin has given it up, and bytes no call
   * asked for would be read as the next call's response.
   */
  private usable(c: UpstreamConnection): boolean {
    const start: i32 = 0
    if (netRead(c.fd, c.input, start, toI32(c.input.length)) === UPSTREAM_WOULD_BLOCK) {
      return true
    }
    this.close(c)
    return false
  }

  /** Starts a connection for the call `c` holds; a failure ends the call. */
  private connect(c: UpstreamConnection): void {
    const fd: i32 = tcpConnect(this.address)
    if (fd < 0) {
      this.finish(c, UPSTREAM_E_CONNECT)
      return
    }
    if (pollAdd(this.h.loop, fd, UPSTREAM_WRITE, upstreamToken(c.id)) < 0) {
      netClose(fd)
      this.finish(c, UPSTREAM_E_CONNECT)
      return
    }
    c.fd = fd
    c.events = UPSTREAM_WRITE
    c.state = UPSTREAM_C_CONNECTING
    // The slot's parser is kept and starts over with the new connection.
    c.parser.reset()
    c.parser.expect(false, false)
  }

  /** What a connection's turn found ready. */
  private service(c: UpstreamConnection): void {
    if (c.state === UPSTREAM_C_CONNECTING) {
      if (connectResult(c.fd) !== 0) {
        this.finish(c, UPSTREAM_E_CONNECT)
        return
      }
      c.state = UPSTREAM_C_BUSY
    }
    const r: UpstreamResponse | null = this.slot(c.call)
    if (c.state === UPSTREAM_C_BUSY && r !== null && c.sent < r.headLength) {
      this.send(c)
      return
    }
    this.receive(c)
  }

  /** Writes what the socket takes of the call's head, then waits to read. */
  private send(c: UpstreamConnection): void {
    const r: UpstreamResponse | null = this.slot(c.call)
    if (r === null) {
      this.finish(c, UPSTREAM_E_CLOSED)
      return
    }
    const head: u8[] = r.head
    const end: i32 = r.headLength
    // `get` wrote `end` bytes into `head` and `sent` only grows to `end`, so this never fires.
    if (c.sent < 0 || end > toI32(head.length)) {
      this.finish(c, UPSTREAM_E_REQUEST)
      return
    }
    let sent: i32 = c.sent
    while (sent < end) {
      // Unsigned, as `0 <= sent < end` makes the difference fit and the prover cannot relate the two.
      const left: i32 = toI32(toU32(end) - toU32(sent))
      const n: i32 = netWrite(c.fd, head, sent, left)
      if (n === UPSTREAM_WOULD_BLOCK) {
        this.interest(c, UPSTREAM_WRITE)
        return
      }
      if (n <= 0) {
        this.finish(c, UPSTREAM_E_CLOSED)
        return
      }
      // Unsigned, as `n <= left` keeps the sum at most `end`.
      sent = toI32(toU32(sent) + toU32(n))
      c.sent = sent
    }
    this.interest(c, UPSTREAM_READ)
  }

  /** Reads what arrived and runs the codec over it. */
  private receive(c: UpstreamConnection): void {
    while (c.fd >= 0) {
      const start: i32 = 0
      const n: i32 = netRead(c.fd, c.input, start, toI32(c.input.length))
      if (n === UPSTREAM_WOULD_BLOCK) {
        return
      }
      if (c.call < 0) {
        // Nothing was asked: the server closed a kept-alive connection, or spoke out of turn.
        this.close(c)
        return
      }
      if (n < 0) {
        // Not the origin's close: a close-delimited body cut off here must not end as whole.
        this.finish(c, UPSTREAM_E_RESET)
        return
      }
      if (n > 0) {
        c.answered = true
        c.parser.feed(c.input, start, n)
      } else {
        c.parser.finish()
      }
      this.parse(c)
      if (n === 0 && c.fd >= 0) {
        this.close(c)
      }
    }
  }

  /** Takes every event the codec has for the call `c` carries. */
  private parse(c: UpstreamConnection): void {
    const p: Http1ResponseParser = c.parser
    while (c.call >= 0) {
      const event: i32 = p.next()
      const r: UpstreamResponse | null = this.slot(c.call)
      if (event === HTTP1_NEED_MORE) {
        return
      }
      if (r === null) {
        this.finish(c, UPSTREAM_E_CLOSED)
        return
      }
      if (event === HTTP1_HEAD) {
        r.status = p.status
      } else if (event === HTTP1_BODY) {
        if (!upstreamAppend(r, p.body, p.bodyOff, p.bodyLen)) {
          // The codec caps a body at `maxBody`, at most 1 GiB, so this is a body past the cap.
          this.finish(c, HTTP1_E_BODY_LIMIT)
        }
      } else if (event === HTTP1_END) {
        const again: boolean = p.keepAlive() && p.buffered() === 0
        this.finish(c, UPSTREAM_E_NONE)
        if (again) {
          c.state = UPSTREAM_C_IDLE
        } else {
          this.close(c)
        }
      } else if (event === HTTP1_ERROR) {
        this.finish(c, p.error)
      } else if (event === HTTP1_CLOSED) {
        this.finish(c, UPSTREAM_E_CLOSED)
      } else if (event !== HTTP1_INFORMATIONAL) {
        // Nothing here asks to switch protocols, so the codec has no other event for it.
        this.finish(c, UPSTREAM_E_CLOSED)
      }
    }
  }

  /**
   * Ends the call `c` carries with `code`. A connection whose call ended any
   * way but `UPSTREAM_E_NONE` is closed: what is left on it cannot be trusted
   * to start the next response.
   *
   * A call that failed on a reused connection before any byte of its response
   * came is not ended but put back at the front of the queue, once: the
   * origin closed the connection as the request crossed it, and a `GET` is
   * safe to send again. Past its deadline it is not.
   */
  private finish(c: UpstreamConnection, code: i32): void {
    const r: UpstreamResponse | null = this.slot(c.call)
    c.call = -1
    if (r !== null) {
      if (code !== UPSTREAM_E_NONE && code !== UPSTREAM_E_TIMEOUT && c.reused && !c.answered && !r.retried) {
        r.retried = true
        this.waiting.unshift(r.index)
      } else {
        this.end(r, code)
      }
    }
    if (code !== UPSTREAM_E_NONE) {
      this.close(c)
    }
  }

  /** Hands `r` to `ready` with `code`. */
  private end(r: UpstreamResponse, code: i32): void {
    r.error = code
    r.ok = code === UPSTREAM_E_NONE
    if (!r.ok) {
      r.length = 0
    }
    this.done.push(r.index)
  }

  /**
   * The call slot at `index`, or null for -1 (no call). Every index the pool
   * stores is a slot's own, so null for any other value is only the proof's.
   */
  private slot(index: i32): UpstreamResponse | null {
    if (index < 0 || index >= toI32(this.calls.length)) {
      return null
    }
    return this.calls[index]
  }

  /** Watches `c` for `events` alone. */
  private interest(c: UpstreamConnection, events: i32): void {
    if (c.events !== events) {
      pollModify(this.h.loop, c.fd, events, upstreamToken(c.id))
      c.events = events
    }
  }

  private close(c: UpstreamConnection): void {
    if (c.fd >= 0) {
      pollRemove(this.h.loop, c.fd)
      netClose(c.fd)
    }
    c.fd = -1
    c.events = 0
    c.state = UPSTREAM_C_CLOSED
    if (c.call >= 0) {
      this.finish(c, UPSTREAM_E_CLOSED)
    }
  }
}

/** A connection slot's codec, made once, reading fields as spans so that a response allocates no strings. */
const upstreamParser = (limits: UpstreamLimits): Http1ResponseParser => {
  const p: Http1ResponseParser = new Http1ResponseParser(
    limits.maxStatusLine,
    limits.maxHeaderBytes,
    limits.maxHeaders,
    // A body buffer is an i32-indexed array, so past this the codec refuses the body rather than the buffer overflowing.
    limits.maxBody < UPSTREAM_MAX_BODY ? limits.maxBody : UPSTREAM_MAX_BODY,
    limits.maxTrailerBytes
  )
  p.fieldsAsSpans()
  return p
}

/**
 * `n` zero bytes, none when `n` is below 1. Filled by `push`, so no `i32`
 * length is computed for `new Array`.
 */
const upstreamBytes = (n: i32): u8[] => {
  const a: u8[] = []
  for (let i: i32 = 0; i < n; i += 1) {
    a.push(0)
  }
  return a
}

/** Room for `n` slot indexes, filled the way `upstreamBytes` is. */
const upstreamSlots = (n: i32): i32[] => {
  const a: i32[] = []
  for (let i: i32 = 0; i < n; i += 1) {
    a.push(0)
  }
  return a
}

/**
 * The poll token the handler's loop reports for watch id `id`: `-2 - id`.
 * Watch ids are in 0 .. HANDLER_MAX_WATCHED, so the unsigned difference is
 * that same small negative number and does not wrap past it.
 */
const upstreamToken = (id: i32): i32 => toI32(toU32(-2) - toU32(id))

/**
 * A ring of call slot indexes, one place per slot. Each slot sits in at most
 * one ring at a time, so a ring is never full when a slot is put in it.
 */
class UpstreamQueue {
  /** @internal */
  items: i32[]
  /** Where the oldest index sits. @internal */
  start: i32 = 0
  /** How many indexes the ring holds. @internal */
  count: i32 = 0

  constructor(items: i32[]) {
    this.items = items
  }

  /** The place `offset` past `start`, or -1 when the ring cannot hold it. */
  at(offset: i32): i32 {
    const n: i32 = toI32(this.items.length)
    if (this.start < 0 || this.start >= n || offset < 0 || offset >= n) {
      return -1
    }
    // Both are below `n`, under 2^31, so the unsigned sum cannot wrap, and one lap brings it back under `n`.
    const sum: u32 = toU32(this.start) + toU32(offset)
    return toI32(sum < toU32(n) ? sum : sum - toU32(n))
  }

  /** Puts `index` last. */
  push(index: i32): void {
    const count: i32 = this.count
    if (count < 0 || count >= toI32(this.items.length)) {
      return
    }
    const at: i32 = this.at(count)
    if (at >= 0 && at < toI32(this.items.length)) {
      this.items[at] = index
      this.count = count + 1
    }
  }

  /** Puts `index` first. */
  unshift(index: i32): void {
    const count: i32 = this.count
    const n: i32 = toI32(this.items.length)
    if (count < 0 || count >= n) {
      return
    }
    // One place back is `n - 1` places on, round the ring.
    const at: i32 = this.at(n - 1)
    if (at >= 0 && at < toI32(this.items.length)) {
      this.items[at] = index
      this.start = at
      this.count = count + 1
    }
  }

  /** The first index, or -1 when the ring is empty. */
  peek(): i32 {
    const items: i32[] = this.items
    const start: i32 = this.start
    if (this.count <= 0 || start < 0 || start >= toI32(items.length)) {
      return -1
    }
    return items[start]
  }

  /** Takes the first index out, or -1 when the ring is empty. */
  shift(): i32 {
    const count: i32 = this.count
    const first: i32 = this.peek()
    if (first >= 0 && count > 0) {
      // A ring of one place has no place 1 on: its next start is 0 again.
      const next: i32 = this.at(toI32(1))
      this.start = next >= 0 ? next : 0
      this.count = count - 1
    }
    return first
  }
}

/**
 * Appends `data[off .. off + len)` to `r`'s body, growing its buffer by
 * doubling when it is full: to under twice the body, and at least 1 KiB.
 * False, with the body as it was, when the body would pass
 * UPSTREAM_MAX_BODY or the window is outside `data`; the codec caps a body
 * below that, so neither comes from a response it accepted.
 */
const upstreamAppend = (r: UpstreamResponse, data: u8[], off: i32, len: i32): boolean => {
  const length: i32 = r.length
  if (length < 0 || len < 0) {
    return false
  }
  // Both are in 0 .. 2^31, so the unsigned sum cannot wrap.
  const need: u32 = toU32(length) + toU32(len)
  if (toI64(need) > UPSTREAM_MAX_BODY) {
    return false
  }
  if (need > toU32(toI32(r.body.length))) {
    let size: u32 = toI32(r.body.length) < 1024 ? 1024 : toU32(toI32(r.body.length))
    // `need` is at most 2^30, so `size` doubles to under 2^31 and the unsigned product cannot wrap.
    while (size < need) {
      size = size * 2
    }
    const old: u8[] = r.body
    if (length > toI32(old.length)) {
      return false
    }
    // Built by `push`, so no `i32` length is computed for `new Array`.
    const grown: u8[] = []
    for (let i: i32 = 0; i < length && i < toI32(old.length); i += 1) {
      grown.push(old[i])
    }
    while (toU32(grown.length) < size) {
      grown.push(0)
    }
    r.body = grown
  }
  if (!tryCopyBytes(r.body, length, data, off, len)) {
    return false
  }
  r.length = toI32(need)
  return true
}
