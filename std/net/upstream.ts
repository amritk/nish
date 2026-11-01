/**
 * `nish/net/upstream` — outbound HTTP/1.1 calls from a route handler that
 * never block its worker: a pool of keep-alive connections to one origin,
 * registered on the `HttpHandler`'s own poll loop and read through the
 * `nish/net/http1-client` codec.
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
import { copyBytes } from "nish/bytes"
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
} from "nish/net/http1"
import { HTTP1_INFORMATIONAL, Http1ResponseParser, http1WriteRequestHead } from "nish/net/http1-client"
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
// 1 to 17 are the codec's own `HTTP1_E_` refusals, passed through as they are.
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
/** The codec refused to write the request (the path is not a request target), or it did not fit `maxHead`. */
export const UPSTREAM_E_REQUEST: i32 = 38
/** Every call slot is taken: `get` answers this and holds nothing. */
export const UPSTREAM_E_FULL: i32 = 39

const UPSTREAM_READ: i32 = 1
const UPSTREAM_WRITE: i32 = 2
const UPSTREAM_WOULD_BLOCK: i32 = -11
const UPSTREAM_NS_PER_MS: i64 = 1000000
const UPSTREAM_READ_CHUNK: i32 = 16384

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
  /** The largest response body the codec accepts; past it the call fails `HTTP1_E_BODY_LIMIT`. */
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
  maxStatusLine: i32 = 8192
  maxHeaderBytes: i32 = 65536
  maxHeaders: i32 = 100
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
  /** The request head, written by `get`. */
  head: u8[]
  /** When the call fails `UPSTREAM_E_TIMEOUT`, on `monotonicNanos`'s clock. */
  deadline: i64 = 0
  /** Whether the response was read to its end; `error` says why not. */
  ok: boolean = false
  /** The final status code, once the response's head has arrived. */
  status: i32 = 0
  /** `UPSTREAM_E_NONE`, an `HTTP1_E_` refusal of the codec, or an `UPSTREAM_E_` code. */
  error: i32 = 0
  length: i32 = 0
  headLength: i32 = 0
  index: i32 = 0
  /** Taken by the program and not yet released. */
  taken: boolean = false

  constructor(index: i32, headRoom: i32, placeholder: HttpRequest) {
    this.index = index
    this.req = placeholder
    this.head = new Array<u8>(headRoom)
    this.body = new Array<u8>(0)
  }
}

/** One connection of the pool. */
class UpstreamConnection {
  parser: Http1ResponseParser
  input: u8[]
  fd: i32 = -1
  /** Its handler watch id. */
  id: i32 = 0
  state: i32 = 0
  /** The slot of the call it carries, or -1. */
  call: i32 = -1
  /** How much of the call's head has been written. */
  sent: i32 = 0
  /** The poll interest it is registered with, 0 for none. */
  events: i32 = 0

  constructor(id: i32, parser: Http1ResponseParser) {
    this.id = id
    this.parser = parser
    this.input = new Array<u8>(UPSTREAM_READ_CHUNK)
  }
}

/** A keep-alive pool to one origin, on an `HttpHandler`'s loop. */
export class Upstream {
  h: HttpHandler
  limits: UpstreamLimits
  /** The one address the pool connects to, checked against the policy if there is one. */
  address: u8[]
  hostNames: string[]
  hostValues: string[]
  connections: UpstreamConnection[]
  calls: UpstreamResponse[]
  free: i32[]
  /** Calls written into their slot and waiting for a connection, oldest first. */
  waiting: i32[]
  /** Calls ended and not yet taken, in the order they ended. */
  done: i32[]
  /** Why the origin is unusable; empty when it is not. For a log. */
  errorText: string = ""
  /** The handler turn `pump` last read. */
  turn: i64 = -1
  /** Not `UPSTREAM_E_NONE` when the origin is unusable: every call then fails with it. */
  error: i32 = 0
  freeCount: i32 = 0
  waitingStart: i32 = 0
  waitingCount: i32 = 0
  doneStart: i32 = 0
  doneCount: i32 = 0

  /**
   * Parses `origin`, looks its host up once (this blocks for at most
   * `limits.lookupMs`), and makes every slot and connection buffer. Panics
   * when a cap is below 1 or the watch ids run past the handler's. An
   * unusable origin is not a panic: `error` says why, and every call fails
   * with it.
   */
  constructor(h: HttpHandler, origin: string, limits: UpstreamLimits) {
    if (limits.connections < 1 || limits.calls < 1 || limits.maxHead < 1 || limits.timeoutMs < 1) {
      panic("Upstream: connections, calls, maxHead and timeoutMs must each be at least 1")
    }
    if (limits.firstId < 0 || limits.firstId + limits.connections > HANDLER_MAX_WATCHED) {
      panic(
        `Upstream: watch ids ${limits.firstId} to ${limits.firstId + limits.connections - 1} are outside 0 to ${HANDLER_MAX_WATCHED - 1}`
      )
    }
    this.h = h
    this.limits = limits
    this.address = new Array<u8>(DNS_ADDRESS_BYTES)
    this.hostNames = ["host"]
    this.hostValues = [""]
    this.connections = []
    for (let k: i32 = 0; k < limits.connections; k += 1) {
      this.connections.push(new UpstreamConnection(limits.firstId + k, upstreamParser(limits)))
    }
    const placeholder: HttpRequest = new HttpRequest(-1)
    this.calls = []
    this.free = new Array<i32>(limits.calls)
    this.waiting = new Array<i32>(limits.calls)
    this.done = new Array<i32>(limits.calls)
    for (let k: i32 = 0; k < limits.calls; k += 1) {
      this.calls.push(new UpstreamResponse(k, limits.maxHead, placeholder))
      this.free[k] = limits.calls - 1 - k
    }
    this.freeCount = limits.calls
    this.settle(origin)
  }

  /** Settles the origin: its `Host` value and the one address, or `error`. */
  settle(origin: string): void {
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
    this.hostValues[0] = url.port >= 0 ? `${named}:${port}` : named
    const policy: OutboundPolicy | null = this.limits.outbound
    if (policy !== null && !outboundHostAllowed(policy, host)) {
      this.fail(UPSTREAM_E_BLOCKED, `${host} is not a host the outbound policy allows`)
      return
    }
    const addresses: u8[] = new Array<u8>(DNS_RESOLVE_MAX_ADDRESSES * DNS_ADDRESS_BYTES)
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
    copyBytes(this.address, 0, addresses, 0, DNS_ADDRESS_BYTES)
  }

  fail(code: i32, text: string): void {
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
   */
  get(req: HttpRequest, path: string): i32 {
    if (this.freeCount === 0) {
      return UPSTREAM_E_FULL
    }
    this.freeCount -= 1
    const r: UpstreamResponse = this.calls[this.free[this.freeCount]]
    r.req = req
    r.ok = false
    r.status = 0
    r.error = UPSTREAM_E_NONE
    r.length = 0
    r.deadline = monotonicNanos() + toI64(this.limits.timeoutMs) * UPSTREAM_NS_PER_MS
    if (this.error !== UPSTREAM_E_NONE) {
      this.end(r, this.error)
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
    const at: i32 = (this.waitingStart + this.waitingCount) % toI32(this.waiting.length)
    this.waiting[at] = r.index
    this.waitingCount += 1
    this.dispatch()
    return UPSTREAM_E_NONE
  }

  /** Whether a finished call is waiting for `take`; reads the upstream's sockets once per handler turn. */
  ready(): boolean {
    this.pump()
    return this.doneCount > 0
  }

  /** The next finished call, which the program gives back with `release`. Panics when none is `ready`. */
  take(): UpstreamResponse {
    if (!this.ready()) {
      panic("Upstream.take: no call is ready")
    }
    const r: UpstreamResponse = this.calls[this.done[this.doneStart]]
    this.doneStart = (this.doneStart + 1) % toI32(this.done.length)
    this.doneCount -= 1
    r.taken = true
    return r
  }

  /**
   * Gives a taken call's slot back to the pool. Panics for a call not taken
   * or already released: two calls sharing a slot would hand one request's
   * answer to another.
   */
  release(r: UpstreamResponse): void {
    if (!r.taken) {
      panic("Upstream.release: the call is not taken, or was released already")
    }
    r.taken = false
    this.free[this.freeCount] = r.index
    this.freeCount += 1
  }

  /** How many calls hold a slot: queued, in flight, or finished and not yet released. */
  pending(): i32 {
    return toI32(this.free.length) - this.freeCount
  }

  /** How many connections to the origin are open. */
  openConnections(): i32 {
    let n: i32 = 0
    for (let k: i32 = 0; k < toI32(this.connections.length); k += 1) {
      if (this.connections[k].fd >= 0) {
        n += 1
      }
    }
    return n
  }

  // ---- The loop ---------------------------------------------------------------

  /** Once per handler turn: reads and writes the connections that fired, then fails what is past its deadline. */
  pump(): void {
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
      if (c.call >= 0 && this.calls[c.call].deadline <= now) {
        this.finish(c, UPSTREAM_E_TIMEOUT)
      }
    }
    // Every call has the same timeout, so the oldest waiting call is the first to expire.
    while (this.waitingCount > 0 && this.calls[this.waiting[this.waitingStart]].deadline <= now) {
      const r: UpstreamResponse = this.calls[this.waiting[this.waitingStart]]
      this.waitingStart = (this.waitingStart + 1) % toI32(this.waiting.length)
      this.waitingCount -= 1
      this.end(r, UPSTREAM_E_TIMEOUT)
    }
    this.dispatch()
  }

  /** Puts waiting calls on connections: a kept-alive one first, then a new one. */
  dispatch(): void {
    while (this.waitingCount > 0) {
      const c: UpstreamConnection | null = this.idle()
      if (c === null) {
        return
      }
      const index: i32 = this.waiting[this.waitingStart]
      this.waitingStart = (this.waitingStart + 1) % toI32(this.waiting.length)
      this.waitingCount -= 1
      c.call = index
      c.sent = 0
      if (c.state === UPSTREAM_C_IDLE) {
        c.state = UPSTREAM_C_BUSY
        c.parser.expect(false, false)
        this.send(c)
      } else {
        this.connect(c)
      }
    }
  }

  /** A connection free for the next call: open and idle if one is, else closed, else null. */
  idle(): UpstreamConnection | null {
    let closed: UpstreamConnection | null = null
    for (let k: i32 = 0; k < toI32(this.connections.length); k += 1) {
      const c: UpstreamConnection = this.connections[k]
      if (c.state === UPSTREAM_C_IDLE) {
        return c
      }
      if (c.state === UPSTREAM_C_CLOSED && closed === null) {
        closed = c
      }
    }
    return closed
  }

  /** Starts a connection for the call `c` holds; a failure ends the call. */
  connect(c: UpstreamConnection): void {
    const fd: i32 = tcpConnect(this.address)
    if (fd < 0) {
      this.finish(c, UPSTREAM_E_CONNECT)
      return
    }
    if (pollAdd(this.h.loop, fd, UPSTREAM_WRITE, -2 - c.id) < 0) {
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
  service(c: UpstreamConnection): void {
    if (c.state === UPSTREAM_C_CONNECTING) {
      if (connectResult(c.fd) !== 0) {
        this.finish(c, UPSTREAM_E_CONNECT)
        return
      }
      c.state = UPSTREAM_C_BUSY
    }
    if (c.state === UPSTREAM_C_BUSY && c.call >= 0 && c.sent < this.calls[c.call].headLength) {
      this.send(c)
      return
    }
    this.receive(c)
  }

  /** Writes what the socket takes of the call's head, then waits to read. */
  send(c: UpstreamConnection): void {
    const r: UpstreamResponse = this.calls[c.call]
    while (c.sent < r.headLength) {
      const n: i32 = netWrite(c.fd, r.head, c.sent, r.headLength - c.sent)
      if (n === UPSTREAM_WOULD_BLOCK) {
        this.interest(c, UPSTREAM_WRITE)
        return
      }
      if (n <= 0) {
        this.finish(c, UPSTREAM_E_CLOSED)
        return
      }
      c.sent += n
    }
    this.interest(c, UPSTREAM_READ)
  }

  /** Reads what arrived and runs the codec over it. */
  receive(c: UpstreamConnection): void {
    while (c.fd >= 0) {
      const n: i32 = netRead(c.fd, c.input, 0, toI32(c.input.length))
      if (n === UPSTREAM_WOULD_BLOCK) {
        return
      }
      if (c.call < 0) {
        // Nothing was asked: the server closed a kept-alive connection, or spoke out of turn.
        this.close(c)
        return
      }
      if (n > 0) {
        c.parser.feed(c.input, 0, n)
      } else {
        c.parser.finish()
      }
      this.parse(c)
      if (n <= 0 && c.fd >= 0) {
        this.close(c)
      }
    }
  }

  /** Takes every event the codec has for the call `c` carries. */
  parse(c: UpstreamConnection): void {
    const p: Http1ResponseParser = c.parser
    while (c.call >= 0) {
      const event: i32 = p.next()
      const r: UpstreamResponse = this.calls[c.call]
      if (event === HTTP1_NEED_MORE) {
        return
      }
      if (event === HTTP1_HEAD) {
        r.status = p.status
      } else if (event === HTTP1_BODY) {
        upstreamAppend(r, p.body, p.bodyOff, p.bodyLen)
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
   */
  finish(c: UpstreamConnection, code: i32): void {
    if (c.call >= 0) {
      const r: UpstreamResponse = this.calls[c.call]
      c.call = -1
      this.end(r, code)
    }
    if (code !== UPSTREAM_E_NONE) {
      this.close(c)
    }
  }

  /** Hands `r` to `ready` with `code`. */
  end(r: UpstreamResponse, code: i32): void {
    r.error = code
    r.ok = code === UPSTREAM_E_NONE
    if (!r.ok) {
      r.length = 0
    }
    const at: i32 = (this.doneStart + this.doneCount) % toI32(this.done.length)
    this.done[at] = r.index
    this.doneCount += 1
  }

  /** Watches `c` for `events` alone. */
  interest(c: UpstreamConnection, events: i32): void {
    if (c.events !== events) {
      pollModify(this.h.loop, c.fd, events, -2 - c.id)
      c.events = events
    }
  }

  close(c: UpstreamConnection): void {
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
    limits.maxBody,
    limits.maxTrailerBytes
  )
  p.fieldsAsSpans()
  return p
}

/** Appends `data[off .. off + len)` to `r`'s body, growing its buffer by doubling when it is full. */
const upstreamAppend = (r: UpstreamResponse, data: u8[], off: i32, len: i32): void => {
  const need: i32 = r.length + len
  if (need > toI32(r.body.length)) {
    let size: i32 = toI32(r.body.length) < 1024 ? 1024 : toI32(r.body.length)
    while (size < need) {
      size = size * 2
    }
    const grown: u8[] = new Array<u8>(size)
    copyBytes(grown, 0, r.body, 0, r.length)
    r.body = grown
  }
  copyBytes(r.body, r.length, data, off, len)
  r.length = need
}
