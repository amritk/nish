/**
 * `nish/net/serve` — an HTTP/1.1 server for an `async` program: one task and
 * one region per request, answers in request order.
 *
 *     import { Request, Response, ServeLimits, refuse, serve } from "nish/net/serve"
 *     import { Router, RouterLimits } from "nish/net/router"
 *     import { sleep } from "nish:async"
 *
 *     const HOME: i32 = 0   // module constants, in the order the routes are added
 *     const USER: i32 = 1
 *
 *     async function handle(req: Request): Promise<Response> {
 *       switch (req.route) {
 *         case HOME: return new Response(200).text("hello\n")
 *         case USER: {
 *           await sleep(5)   // a database, another service: the loop runs on
 *           return new Response(200).json(`{"id":"${req.param(0)}"}`)
 *         }
 *         default: return refuse(req)   // 404, or 405 with its Allow
 *       }
 *     }
 *
 *     export async function main(): Promise<i32> {
 *       const router = new Router(new RouterLimits())
 *       router.add("GET", "/")
 *       router.add("GET", "/users/:id")
 *       return await serve(8080, router, new ServeLimits(), handle)
 *     }
 *
 * `serve` runs `nish/net/handler`'s readiness loop as an `async` function:
 * it awaits the loop's descriptor, so the program's other tasks run while no
 * socket is ready. Each whole request it takes is handed to `handle` in a
 * task of its own, spawned with the request's slot, and the task's
 * allocations — the request it reads, the response it builds, whatever the
 * handler makes on the way — live in the task's region and go when it ends.
 *
 * **The task reads its own copy.** The task copies the request's head and
 * body out of the server's slot into its own memory before `handle` runs,
 * and when `handle` answers it writes the status, the content type and the
 * body back into the slot's fixed buffers, element by element, and wakes the
 * loop. The loop then sends the answer and frees the slot. Nothing the task
 * allocated outlives it, and the loop's arena does not grow per request once
 * its slots are warm: `tests/link/net_serve_pipelined_flat` pins
 * `Arena.used()` flat over thousands of pipelined requests. What the runtime
 * allocates outside the arena for a task and its region is not measured.
 *
 * **Answers keep request order.** The handler reads a connection's next
 * request only once the one before it is answered, so at most one request
 * per connection is in flight, and pipelined requests are answered in the
 * order they came: a later request's task starts only after the earlier one
 * is answered, so it can never finish first.
 *
 * **Every cap answers.** `ServeLimits` bounds the connections, the requests
 * in flight (503 past it), a request's header section (431) and body (413),
 * and the response a task may write (500 past it). `docs/security/serve.md`
 * is the record.
 *
 * `readable` is refused under `--emit-ts` (NL4017), so a program that serves
 * is native only.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { ROUTER_BAD_ESCAPE, Router } from "nish/net/router"
import { cancel, cancelAfter, readable, sleep, spawn, taskId } from "nish:async"
import { NET_UNIX_STREAM, netClose, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"

/** The listen backlog `serve` asks for. */
const SERVE_BACKLOG: i32 = 1024
/** Bytes a content type may have; a longer one is answered 500. */
const SERVE_TYPE_BYTES: i32 = 128
/** Distinct content types the server keeps the bytes of; past it a new type is answered 500. */
const SERVE_MAX_TYPES: i32 = 64
/** Milliseconds between the ticker's wakes, which run the handler's timeouts. */
const SERVE_TICK_MS: i32 = 1000
/** The handler's watch id for the wake socket. */
const SERVE_WAKE: i32 = 0
/** `refused` marks a response the loop answers with `HttpHandler.refuse`. */
const SERVE_REFUSE: i32 = -1
/** The status a program's malformed answer is sent as. */
const SERVE_FAILED: i32 = 500

/** The caps a server holds every request and connection to; each field is read once, by `serve`. */
export class ServeLimits {
  /** The most connections open at once; a connection past it is accepted and closed at once, and its client sees the connection reset. */
  connections: i32 = 256
  /** The most requests in flight — handed to a task and not yet answered — at once; past it a request is answered 503. */
  inFlight: i32 = 256
  /** The most bytes a request's header section may have; past it the request is answered 431 and its connection ends. */
  headerBytes: i32 = 16384
  /** The most bytes a request body may have; past it the request is answered 413 and its connection ends. */
  bodyBytes: i32 = 1048576
  /** The most bytes a response body may have; a task that answers more is answered 500 instead. */
  responseBytes: i32 = 65536
  /**
   * Milliseconds a request's task may run, from its start to its answer;
   * past it the task is cancelled: each await it is parked on, and each it
   * makes later, answers false at once, so it runs to its end and its slot
   * is freed. 0 or less sets no limit.
   */
  deadline: i32 = 30000
  /**
   * Milliseconds a connection may take to send a whole request head, from
   * its first byte; past it the connection is closed. The bound on a client
   * that trickles its head (slowloris): it holds a connection this long, no
   * longer.
   */
  headTimeout: i32 = 30000
  /**
   * Milliseconds a connection may go without a byte read or written, as a
   * keep-alive connection does between requests; past it the connection is
   * closed, freeing its slot.
   */
  idleTimeout: i32 = 60000
  /**
   * How many requests to answer before stopping: the server then stops
   * accepting, finishes what it holds and returns. 0, the default, serves
   * for good.
   */
  maxRequests: i32 = 0
}

/** What a server did, for a log line or a test; `serveOn` fills it as it runs. */
export class ServeStats {
  /** Requests answered, by a task or by the server itself. */
  answered: i32 = 0
  /** Requests answered 503 because `inFlight` tasks were already running. */
  busy: i32 = 0
  /** Answers a task wrote that broke a cap or a rule, answered 500 instead. */
  failed: i32 = 0
  /** How many slots the server made: the most requests ever in flight at once. */
  slots: i32 = 0
  /** After how many answers to read `usedWarm`; 0 reads it never. */
  warmAfter: i32 = 0
  /** `Arena.used()` in the server's loop once `warmAfter` requests were answered. */
  usedWarm: i64 = 0
  /** `Arena.used()` in the server's loop once `maxRequests` were answered, before draining. */
  usedEnd: i64 = 0
}

/**
 * A request, as `handle` reads it: the task's own copy of the head and body,
 * valid for as long as the task runs.
 */
export class Request {
  /** The index `Router.add` answered for the route, or a negative `ROUTER_*` code. */
  route: i32 = 0
  /** The request as the handler parsed it, copied into the task: its spans, its head and its body. */
  raw: HttpRequest

  /**
   * A request over `raw`, which it keeps.
   * @param raw the parsed request, the task's own
   */
  constructor(raw: HttpRequest) {
    this.raw = raw
    this.route = raw.route
  }

  /**
   * The method.
   * @returns the method as it came on the wire, such as `"GET"`
   */
  method(): string {
    return String.fromBytes(this.raw.head, this.raw.methodStart, this.raw.methodEnd)
  }

  /**
   * The path: the target up to its `?`, still percent-encoded.
   * @returns the raw path, such as `"/users/7"`
   */
  path(): string {
    return String.fromBytes(this.raw.head, this.raw.targetStart, this.raw.pathEnd)
  }

  /**
   * Route parameter `k`, percent-decoded. Panics when the request's route has no parameter `k`.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the decoded value, or an empty string when it holds a malformed escape
   */
  param(k: i32): string {
    const out: u8[] = new Array<u8>(this.raw.paramEnd(k) - this.raw.paramStart(k))
    const n: i32 = this.raw.param(k, out)
    return n < 0 ? "" : String.fromBytes(out, 0, n)
  }

  /**
   * Route parameter `k` read as a decimal number that is not negative and fits an `i32`. Panics when the request's route has no parameter `k`.
   * @param k the parameter's position in the route pattern, from 0
   * @returns the number, or -1 when it is empty, holds a non-digit or overflows
   */
  paramNumber(k: i32): i32 {
    return this.raw.paramDecimal(k)
  }

  /**
   * Whether route parameter `k` holds a malformed percent escape, which a program answers 400. Panics when the request's route has no parameter `k`.
   * @param k the parameter's position in the route pattern, from 0
   * @returns true when decoding the parameter fails
   */
  paramMalformed(k: i32): boolean {
    const out: u8[] = new Array<u8>(this.raw.paramEnd(k) - this.raw.paramStart(k))
    return this.raw.param(k, out) === ROUTER_BAD_ESCAPE
  }

  /**
   * The first query parameter named `name`, form-decoded (`+` as a space, `%XX` as its byte).
   * @param name the parameter name, compared decoded
   * @returns the decoded value, or an empty string when there is none or it is malformed
   */
  query(name: string): string {
    if (this.raw.queryIndex(name) < 0) {
      return ""
    }
    const out: u8[] = new Array<u8>(this.raw.queryValueEnd - this.raw.queryValueStart)
    const n: i32 = this.raw.query(name, out)
    return n < 0 ? "" : String.fromBytes(out, 0, n)
  }

  /**
   * The value of the first header field named `name`.
   * @param name the field name in lowercase, as the parser keeps every name
   * @returns the value, or an empty string when no field has the name
   */
  header(name: string): string {
    const i: i32 = this.raw.header(name)
    return i < 0 ? "" : String.fromBytes(this.raw.head, this.raw.valueStart(i), this.raw.valueEnd(i))
  }

  /**
   * The body as text.
   * @returns the body's bytes as a string, empty for none
   */
  text(): string {
    return String.fromBytes(this.raw.body, 0, this.raw.bodyLength)
  }
}

/**
 * The answer `handle` gives: a status, a content type and a body. Build it
 * with `new Response(status)` and one of `text`, `json` or `bytes`, or with
 * `refuse`.
 */
export class Response {
  /** The `Content-Type` value; empty sends none, and the body goes without one. */
  type: string = ""
  /** The body, `body[0 .. length)`. */
  body: u8[]
  /** The status, from 200 to 599; any other is answered 500. */
  status: i32 = 200
  /** How many bytes of `body` are the body. */
  length: i32 = 0

  /**
   * An answer with `status` and no body yet.
   * @param status the status, from 200 to 599
   */
  constructor(status: i32) {
    this.status = status
    this.body = []
  }

  /**
   * Sets a plain-text body.
   * @param s the body
   * @returns this response, for a chain
   */
  text(s: string): Response {
    return this.bytes("text/plain; charset=utf-8", serveBytes(s), toI32(0), toI32(s.length))
  }

  /**
   * Sets a JSON body the program wrote.
   * @param s the JSON text
   * @returns this response, for a chain
   */
  json(s: string): Response {
    return this.bytes("application/json", serveBytes(s), toI32(0), toI32(s.length))
  }

  /**
   * Sets a body of bytes with a content type.
   * @param type the `Content-Type` value
   * @param buf the buffer holding the body, kept by the response
   * @param off where the body starts in `buf`
   * @param len how many body bytes there are
   * @returns this response, for a chain
   */
  bytes(type: string, buf: u8[], off: i32, len: i32): Response {
    if (off < 0 || len < 0 || off + len > toI32(buf.length)) {
      panic(`Response.bytes: [${off}, ${off + len}) is outside a buffer of ${buf.length}`)
    }
    this.type = type
    if (off === 0) {
      this.body = buf
    } else {
      const copy: u8[] = new Array<u8>(len)
      for (let i: i32 = 0; i < toI32(copy.length); i++) {
        copy[i] = buf[off + i]
      }
      this.body = copy
    }
    this.length = len
    return this
  }
}

/**
 * The answer for a request the router refused: 405 with an `Allow` field
 * naming the methods the path has, and 404 for anything else.
 * @param _req the request to refuse; the loop answers it from the request it holds
 * @returns a response the server answers as `HttpHandler.refuse` does
 */
export const refuse = (_req: Request): Response => new Response(SERVE_REFUSE)

/**
 * The shared state between the loop and its tasks: one slot per request in
 * flight. Each slot's buffers are made once, the first time the slot is
 * used, and kept.
 */
class ServeState {
  /** The request each slot holds, the handler's until it is answered. */
  reqs: HttpRequest[]
  /** Whether a slot holds a request. */
  busy: boolean[]
  /** Whether a slot's task has written its answer. */
  done: boolean[]
  /** Each slot's task, as `taskId()` answered it; 0 until the task starts. */
  tasks: i64[]
  /** Whether a slot's task was cancelled, so it is cancelled once. */
  cancelled: boolean[]
  /** `ServeLimits.deadline`, which each task arms on itself as it starts. */
  deadline: i32 = 0
  /** Set when the server begins to stop: each task still running, and each that starts later, is cancelled. */
  stopping: boolean = false
  /** The status each task answered, or `SERVE_REFUSE`. */
  status: i32[]
  /** The bytes each task wrote into `bodies`, or -1 when its body broke `responseBytes`. */
  lengths: i32[]
  /** The response body each task writes. */
  bodies: u8[][]
  /** The content type each task writes. */
  types: u8[][]
  /** The bytes each task wrote into `types`, or -1 when the type was too long. */
  typeLengths: i32[]
  /** One byte, written to the wake socket. */
  one: u8[]
  /** No fields: the names and values of an answer with a body and no content type. */
  none: u8[][]
  /** The wake socket's end the tasks write to. */
  wakeFd: i32 = 0
  /** Whether a byte is waiting in the wake socket. */
  signalled: boolean = false
  /** Set when the loop has stopped: the ticker ends. */
  stopped: boolean = false

  constructor() {
    this.reqs = []
    this.busy = []
    this.done = []
    this.tasks = []
    this.cancelled = []
    this.status = []
    this.lengths = []
    this.bodies = []
    this.types = []
    this.typeLengths = []
    this.one = [toU8(1)]
    this.none = []
  }
}

/** The lowest free slot, making one when every slot is busy and `inFlight` allows; -1 when none. */
const serveFreeSlot = (st: ServeState, limits: ServeLimits): i32 => {
  const n: i32 = toI32(st.busy.length)
  for (let k: i32 = 0; k < n; k++) {
    if (!st.busy[k]) {
      return k
    }
  }
  if (n >= limits.inFlight) {
    return -1
  }
  st.reqs.push(new HttpRequest(-1))
  st.busy.push(false)
  st.done.push(false)
  st.tasks.push(toI64(0))
  st.cancelled.push(false)
  st.status.push(toI32(0))
  st.lengths.push(toI32(0))
  st.bodies.push(new Array<u8>(limits.responseBytes))
  st.types.push(new Array<u8>(SERVE_TYPE_BYTES))
  st.typeLengths.push(toI32(0))
  return n
}

/**
 * Cancels slot `k`'s task, once: its awaits answer false from now on, so it
 * runs to its end and writes an answer nobody may read.
 */
const serveCancel = (st: ServeState, k: i32): void => {
  if (!st.cancelled[k] && st.tasks[k] !== 0) {
    st.cancelled[k] = true
    cancel(st.tasks[k])
  }
}

/** Whether any slot still holds a request. */
const serveAnyBusy = (st: ServeState): boolean => {
  for (let k: i32 = 0; k < toI32(st.busy.length); k++) {
    if (st.busy[k]) {
      return true
    }
  }
  return false
}

/** Sends slot `k`'s answer, as its task wrote it. */
const serveAnswer = (h: HttpHandler, st: ServeState, k: i32, typeCache: u8[][], stats: ServeStats): void => {
  const r: HttpRequest = st.reqs[k]
  const status: i32 = st.status[k]
  if (status === SERVE_REFUSE) {
    h.refuse(r)
    return
  }
  const length: i32 = st.lengths[k]
  if (status < 200 || status > 599 || length < 0 || st.typeLengths[k] < 0) {
    stats.failed += 1
    h.problem(r, SERVE_FAILED, "Internal Server Error", "")
    return
  }
  if (st.typeLengths[k] === 0) {
    if (length === 0) {
      h.empty(r, status)
    } else {
      h.sendFields(r, status, st.none, st.none, st.bodies[k], toI32(0), length)
    }
    return
  }
  const type: i32 = serveType(typeCache, st.types[k], st.typeLengths[k])
  if (type < 0) {
    stats.failed += 1
    h.problem(r, SERVE_FAILED, "Internal Server Error", "")
    return
  }
  h.send(r, status, typeCache[type], st.bodies[k], toI32(0), length)
}

/** The index in `cache` of the bytes `type[0 .. len)`, adding them while there is room; -1 when full or when they hold a control byte. */
const serveType = (cache: u8[][], type: u8[], len: i32): i32 => {
  if (len < 0 || len > toI32(type.length)) {
    return -1
  }
  for (let i: i32 = 0; i < toI32(cache.length); i++) {
    const c: u8[] = cache[i]
    if (toI32(c.length) === len) {
      let same: boolean = true
      for (let j: i32 = 0; j < toI32(c.length) && j < toI32(type.length) && same; j++) {
        same = c[j] === type[j]
      }
      if (same) {
        return i
      }
    }
  }
  if (toI32(cache.length) >= SERVE_MAX_TYPES) {
    return -1
  }
  // A control byte other than a tab would make the carrier refuse the head,
  // which the handler treats as a program's mistake and panics on.
  for (let j: i32 = 0; j < len && j < toI32(type.length); j++) {
    if ((type[j] < 32 && type[j] !== 9) || type[j] === 127) {
      return -1
    }
  }
  const copy: u8[] = new Array<u8>(len)
  for (let j: i32 = 0; j < toI32(copy.length) && j < toI32(type.length); j++) {
    copy[j] = type[j]
  }
  cache.push(copy)
  return toI32(cache.length) - 1
}

/** A string's bytes: native strings are UTF-8, so its code units are its bytes. */
const serveBytes = (s: string): u8[] => {
  const n: i32 = toI32(s.length)
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i++) {
    out[i] = toU8(s.charCodeAt(i))
  }
  return out
}

/** One request's task: copies it in, runs `handle`, writes the answer into slot `k` and wakes the loop. */
const serveTask = async (
  handle: (req: Request) => Promise<Response>,
  st: ServeState,
  k: i32
): Promise<void> => {
  const self: i64 = taskId()
  st.tasks[k] = self
  if (st.stopping) {
    cancel(self)
  } else if (st.deadline > 0) {
    cancelAfter(self, st.deadline)
  }
  // The copy is written out here, not in a helper: a helper handed both the
  // shared request and the task's own would be refused, as it could store
  // one into the other.
  const src: HttpRequest = st.reqs[k]
  const r: HttpRequest = new HttpRequest(-1)
  let end: i32 = src.targetEnd
  for (let i: i32 = 0; i < 4 * src.headerCount; i++) {
    if (src.spans[i] > end) {
      end = src.spans[i]
    }
  }
  const head: u8[] = new Array<u8>(end)
  for (let i: i32 = 0; i < end; i++) {
    head[i] = src.head[i]
  }
  const spans: i32[] = new Array<i32>(4 * src.headerCount)
  for (let i: i32 = 0; i < 4 * src.headerCount; i++) {
    spans[i] = src.spans[i]
  }
  const params: i32[] = new Array<i32>(2 * src.paramCount)
  for (let i: i32 = 0; i < 2 * src.paramCount; i++) {
    params[i] = src.params[i]
  }
  const body: u8[] = new Array<u8>(src.bodyLength)
  for (let i: i32 = 0; i < src.bodyLength; i++) {
    body[i] = src.body[i]
  }
  r.head = head
  r.spans = spans
  r.params = params
  r.body = body
  r.route = src.route
  r.paramCount = src.paramCount
  r.methodStart = src.methodStart
  r.methodEnd = src.methodEnd
  r.targetStart = src.targetStart
  r.targetEnd = src.targetEnd
  r.pathEnd = src.pathEnd
  r.headerCount = src.headerCount
  r.bodyLength = src.bodyLength
  const res: Response = await handle(new Request(r))
  st.status[k] = res.status
  const out: u8[] = st.bodies[k]
  if (res.length > toI32(out.length)) {
    st.lengths[k] = -1
  } else {
    for (let i: i32 = 0; i < res.length; i++) {
      out[i] = res.body[i]
    }
    st.lengths[k] = res.length
  }
  const type: u8[] = st.types[k]
  const n: i32 = toI32(res.type.length)
  if (n > toI32(type.length)) {
    st.typeLengths[k] = -1
  } else {
    for (let i: i32 = 0; i < n; i++) {
      type[i] = toU8(res.type.charCodeAt(i))
    }
    st.typeLengths[k] = n
  }
  st.done[k] = true
  if (!st.signalled) {
    st.signalled = true
    netWrite(st.wakeFd, st.one, 0, 1)
  }
}

/** Wakes the loop every `SERVE_TICK_MS`, so the handler's timeouts run while no socket is ready; ends once the loop stops. */
const serveTick = async (st: ServeState): Promise<void> => {
  while (!st.stopped) {
    await sleep(SERVE_TICK_MS)
    if (!st.stopped && !st.signalled) {
      st.signalled = true
      netWrite(st.wakeFd, st.one, 0, 1)
    }
  }
}

/**
 * `serve` on a listening socket the program made — `tcpListen` on port 0 in
 * a test, or `tcpListenFlags` with SO_REUSEPORT for a worker — filling
 * `stats` as it runs.
 * @param listener the listening socket, still the program's to close
 * @param router the routes, added before the call
 * @param limits the caps; see `ServeLimits`
 * @param handle the program's answer to a request, run as its own task
 * @param stats where the server counts what it did, the caller's
 * @returns 0 once stopped
 */
export const serveOn = async (
  listener: i32,
  router: Router,
  limits: ServeLimits,
  handle: (req: Request) => Promise<Response>,
  stats: ServeStats
): Promise<i32> => {
  if (limits.connections < 1 || limits.inFlight < 1 || limits.responseBytes < 0) {
    panic(
      `serve: connections ${limits.connections} and inFlight ${limits.inFlight} need at least 1, responseBytes ${limits.responseBytes} at least 0`
    )
  }
  const hl: HandlerLimits = new HandlerLimits()
  hl.slots = limits.connections
  hl.http.maxHeaderBytes = limits.headerBytes
  hl.http.maxBody = limits.bodyBytes
  hl.http.headTimeout = limits.headTimeout
  hl.http.idleTimeout = limits.idleTimeout
  const h: HttpHandler = new HttpHandler(hl, listener, router)
  const st: ServeState = new ServeState()
  st.deadline = limits.deadline
  const fds: i32[] = [0, 0]
  const made: i32 = unixSocketPair(NET_UNIX_STREAM, fds)
  if (made < 0) {
    panic(`serve: the wake socket could not be made: ${made}`)
  }
  st.wakeFd = fds[1]
  h.watch(fds[0], SERVE_WAKE)
  const drained: u8[] = new Array<u8>(64)
  const typeCache: u8[][] = []
  spawn(serveTick(st))
  let draining: boolean = false
  while (true) {
    h.wait(0)
    if (h.fired(SERVE_WAKE)) {
      st.signalled = false
      while (netRead(fds[0], drained, 0, 64) > 0) {
        // Each read takes up to 64 wake bytes; the loop empties the socket.
      }
    }
    let moved: boolean = true
    while (moved) {
      moved = false
      for (let k: i32 = 0; k < toI32(st.busy.length); k++) {
        if (st.busy[k] && st.done[k]) {
          serveAnswer(h, st, k, typeCache, stats)
          st.busy[k] = false
          st.done[k] = false
          st.cancelled[k] = false
          st.tasks[k] = 0
          stats.answered += 1
          moved = true
        } else if (st.busy[k] && (st.stopping || h.hungUp(st.reqs[k]))) {
          // Its client hung up, or the server is stopping: nobody waits for
          // this answer, so the task is told to stop waiting too.
          serveCancel(st, k)
        }
      }
      while (h.ready()) {
        const r: HttpRequest = h.take()
        const k: i32 = serveFreeSlot(st, limits)
        moved = true
        if (k < 0) {
          h.problem(r, 503, "Service Unavailable", "")
          stats.busy += 1
          stats.answered += 1
          continue
        }
        st.reqs[k] = r
        st.busy[k] = true
        st.done[k] = false
        st.cancelled[k] = false
        st.tasks[k] = 0
        spawn(serveTask(handle, st, k))
      }
    }
    stats.slots = toI32(st.busy.length)
    if (stats.warmAfter > 0 && stats.usedWarm === 0 && stats.answered >= stats.warmAfter) {
      stats.usedWarm = Arena.used()
    }
    if (!draining && limits.maxRequests > 0 && stats.answered >= limits.maxRequests) {
      draining = true
      stats.usedEnd = Arena.used()
      h.drain()
      st.stopping = true
      for (let k: i32 = 0; k < toI32(st.busy.length); k++) {
        if (st.busy[k] && !st.done[k]) {
          serveCancel(st, k)
        }
      }
    }
    if (draining && h.connections() === 0 && !serveAnyBusy(st)) {
      break
    }
    await readable(h.loop)
  }
  st.stopped = true
  netClose(fds[0])
  netClose(fds[1])
  netClose(h.loop)
  return 0
}

/**
 * Serves HTTP/1.1 on `port` on every address, handing each request to
 * `handle` in a task of its own, until `limits.maxRequests` are answered (for
 * good when it is 0).
 * @param port the TCP port to listen on
 * @param router the routes, added before the call; a request's `route` is the index `Router.add` answered
 * @param limits the caps; see `ServeLimits`
 * @param handle the program's answer to a request, run as its own task
 * @returns 0 once stopped, or the negative error `tcpListen` answered
 */
export const serve = async (
  port: i32,
  router: Router,
  limits: ServeLimits,
  handle: (req: Request) => Promise<Response>
): Promise<i32> => {
  const listener: i32 = tcpListen("0.0.0.0", port, SERVE_BACKLOG)
  if (listener < 0) {
    return listener
  }
  const done: i32 = await serveOn(listener, router, limits, handle, new ServeStats())
  netClose(listener)
  return done
}
