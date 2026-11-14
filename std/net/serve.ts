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
 * body back into the slot's fixed buffers, in bulk, and wakes the
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
 * **A pipelined burst goes out in one write.** The loop answers what the
 * tasks wrote and takes what the handler queued until neither moves, so a
 * handler that answers without waiting serves a whole burst in one turn.
 * The handler holds each answer's send while the next request on its
 * connection is queued and the output has room, and the loop flushes once
 * before it parks: one write per connection per turn, and no wake byte for a
 * task that answers while the loop runs.
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
import { copyBytes } from "nish/bytes"
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { HTTP1_NO_BODY } from "nish/net/http1-codec"
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
import { ROUTER_BAD_ESCAPE, ROUTER_METHOD_NOT_ALLOWED, Router } from "nish/net/router"
import { cancel, cancelAfter, readable, sleep, spawn, taskId } from "nish:async"
import {
  NET_UNIX_STREAM,
  netClose,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollRemove,
  pollWait,
  tcpListen,
  unixSocketPair,
} from "nish:net"

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
/** Spike: run the handler inline on the loop's task. */
const SERVE_INLINE: boolean = false

/** Spike A′: `serveOn` drives `Http1Server` itself instead of going through `HttpHandler`. */
const SERVE_DIRECT: boolean = true
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
  /**
   * The `Server` field written into the head of every answer a task writes,
   * as `server: <value>`; "", the default, writes none. The answers the
   * server writes itself carry none: a `refuse` (404, or 405 with its
   * `Allow`) and 400, 413, 431, 500 and 503. Made into bytes once, when the
   * server starts, so it costs no work per request. A control byte in it
   * panics as the server starts.
   */
  server: string = ""
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
  /** The writes the server began to send answers, counted at the end of each loop turn: a pipelined burst that fits the output is one. */
  sends: i64 = 0
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
  /** The free slots, `free[0 .. freeCount)`, the last freed on top. */
  free: i32[]
  /** The slots whose task has answered since the loop last looked, `finished[0 .. finishedCount)`, in the order they answered. */
  finished: i32[]
  /** The slots whose task the loop has started and not yet seen answer, `running[0 .. runningCount)`: the ones a hang-up can cancel. */
  running: i32[]
  /** Whether a slot is in `running`, so a slot answered and reused within a turn is listed once. */
  listed: boolean[]
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
  /** Per slot: the index in `typeBytes` of the type its task answered, or -1 when the task copied it into `types`. */
  typeIndex: i32[]
  /** Each content type the server has sent, as the bytes the loop writes into a head. */
  typeBytes: u8[][]
  /** The same content types as text, in `typeBytes`'s order: what a task compares its answer's type with. */
  typeTexts: string[]
  /** One byte, written to the wake socket. */
  one: u8[]
  /** The fields of an answer with no content type: `ServeLimits.server`'s, or none. */
  plainNames: u8[][]
  plainValues: u8[][]
  /** The fields of an answer with a content type: `ServeLimits.server`'s, then `content-type`, whose value is set per answer. */
  typedNames: u8[][]
  typedValues: u8[][]
  /** How many of `free`'s entries are free slots. */
  freeCount: i32 = 0
  /** How many of `finished`'s entries are answered slots the loop has not yet looked at. */
  finishedCount: i32 = 0
  /** How many of `running`'s entries are slots whose task is running. */
  runningCount: i32 = 0
  /** `ServeLimits.deadline`, which each task arms on itself as it starts. */
  deadline: i32 = 0
  /** The wake socket's end the tasks write to. */
  wakeFd: i32 = 0
  /** Set when the server begins to stop: each task still running, and each that starts later, is cancelled. */
  stopping: boolean = false
  /** Whether a byte is waiting in the wake socket. */
  signalled: boolean = false
  /** Whether the loop is running rather than parked: a task that answers now needs no wake byte, as the loop looks again before it parks. */
  awake: boolean = false
  /** Set by each task that answers, and cleared by the loop as it looks for answers. */
  fresh: boolean = false
  /** Set when the loop has stopped: the ticker ends. */
  stopped: boolean = false

  constructor() {
    this.reqs = []
    this.busy = []
    this.done = []
    this.tasks = []
    this.cancelled = []
    this.free = []
    this.finished = []
    this.running = []
    this.listed = []
    this.status = []
    this.lengths = []
    this.bodies = []
    this.types = []
    this.typeLengths = []
    this.typeIndex = []
    this.typeBytes = []
    this.typeTexts = []
    this.one = [toU8(1)]
    this.plainNames = []
    this.plainValues = []
    this.typedNames = []
    this.typedValues = []
  }
}

/** Makes `st`'s answer fields, with a `server` field of `server` unless it is "". */
const serveFields = (st: ServeState, server: string): void => {
  const type: u8[] = serveBytes("content-type")
  if (server !== "") {
    const value: u8[] = serveBytes(server)
    for (let i: i32 = 0; i < toI32(value.length); i++) {
      if (value[i] < 32 || value[i] === 127) {
        panic(`serve: ServeLimits.server holds the control byte ${value[i]} at ${i}`)
      }
    }
    const name: u8[] = serveBytes("server")
    st.plainNames.push(name)
    st.plainValues.push(value)
    st.typedNames.push(name)
    st.typedValues.push(value)
  }
  st.typedNames.push(type)
  st.typedValues.push(type)
}

/** The last freed slot, making one when every slot is busy and `inFlight` allows; -1 when none. */
const serveFreeSlot = (st: ServeState, limits: ServeLimits): i32 => {
  if (st.freeCount > 0) {
    st.freeCount -= 1
    return st.free[st.freeCount]
  }
  const n: i32 = toI32(st.busy.length)
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
  st.typeIndex.push(toI32(-1))
  st.free.push(toI32(0))
  st.finished.push(toI32(0))
  st.running.push(toI32(0))
  st.listed.push(false)
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
const serveAnswer = (h: HttpHandler, st: ServeState, k: i32, stats: ServeStats): void => {
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
    if (length === 0 && st.plainNames.length === 0) {
      h.empty(r, status)
    } else {
      h.sendFields(r, status, st.plainNames, st.plainValues, st.bodies[k], toI32(0), length)
    }
    return
  }
  const type: i32 = st.typeIndex[k] >= 0 ? st.typeIndex[k] : serveType(st, st.types[k], st.typeLengths[k])
  if (type < 0) {
    stats.failed += 1
    h.problem(r, SERVE_FAILED, "Internal Server Error", "")
    return
  }
  const last: i32 = toI32(st.typedValues.length) - 1
  st.typedValues[last] = st.typeBytes[type]
  h.sendFields(r, status, st.typedNames, st.typedValues, st.bodies[k], toI32(0), length)
}

/** The index in `st.typeBytes` of the bytes `type[0 .. len)`, adding them while there is room; -1 when full or when they hold a control byte. */
const serveType = (st: ServeState, type: u8[], len: i32): i32 => {
  const cache: u8[][] = st.typeBytes
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
  st.typeTexts.push(String.fromBytes(copy, 0, len))
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

/** Writes `res` into slot `k` and lists the slot as answered. */
const serveStore = (st: ServeState, k: i32, res: Response): void => {
  st.status[k] = res.status
  const out: u8[] = st.bodies[k]
  // A length the body cannot hold, negative or past either array, is the
  // handler's mistake: the loop answers 500 for it, as for an over-long body.
  if (res.length < 0 || res.length > toI32(out.length) || res.length > toI32(res.body.length)) {
    st.lengths[k] = -1
  } else {
    // The whole body is copied when the slot holds it, as one `set`: what lies
    // past `length` is never sent. Only a body larger than the slot is copied
    // byte by byte, up to `length`.
    if (res.body.length <= out.length) {
      out.set(res.body)
    } else {
      for (let i: i32 = 0; i < res.length && i < toI32(out.length) && i < toI32(res.body.length); i++) {
        out[i] = res.body[i]
      }
    }
    st.lengths[k] = res.length
  }
  // A type the server has sent before is found by its text, with no copy;
  // the loop copies a new one's bytes into `typeBytes` as it sends it.
  const n: i32 = toI32(res.type.length)
  let known: i32 = -1
  for (let i: i32 = 0; n > 0 && known < 0 && i < toI32(st.typeTexts.length); i++) {
    if (st.typeTexts[i] === res.type) {
      known = i
    }
  }
  st.typeIndex[k] = known
  const type: u8[] = st.types[k]
  if (known >= 0) {
    st.typeLengths[k] = n
  } else if (n > toI32(type.length)) {
    st.typeLengths[k] = -1
  } else {
    for (let i: i32 = 0; i < n && i < toI32(type.length); i++) {
      type[i] = toU8(res.type.charCodeAt(i))
    }
    st.typeLengths[k] = n
  }
  st.done[k] = true
  st.finished[st.finishedCount] = k
  st.finishedCount += 1
  st.fresh = true
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
  const head: u8[] = new Array<u8>(src.headLength)
  copyBytes(head, 0, src.head, 0, src.headLength)
  const spans: i32[] = new Array<i32>(4 * src.headerCount)
  for (let i: i32 = 0; i < toI32(spans.length) && i < toI32(src.spans.length); i++) {
    spans[i] = src.spans[i]
  }
  // No parameters and no body keep the empty arrays the constructor made.
  if (src.paramCount > 0) {
    const params: i32[] = new Array<i32>(2 * src.paramCount)
    for (let i: i32 = 0; i < toI32(params.length) && i < toI32(src.params.length); i++) {
      params[i] = src.params[i]
    }
    r.params = params
  }
  if (src.bodyLength > 0) {
    const body: u8[] = new Array<u8>(src.bodyLength)
    copyBytes(body, 0, src.body, 0, src.bodyLength)
    r.body = body
  }
  r.head = head
  r.spans = spans
  r.route = src.route
  r.paramCount = src.paramCount
  r.methodStart = src.methodStart
  r.methodEnd = src.methodEnd
  r.targetStart = src.targetStart
  r.targetEnd = src.targetEnd
  r.pathEnd = src.pathEnd
  r.headLength = src.headLength
  r.headerCount = src.headerCount
  r.bodyLength = src.bodyLength
  const res: Response = await handle(new Request(r))
  st.status[k] = res.status
  const out: u8[] = st.bodies[k]
  // A length the body cannot hold, negative or past either array, is the
  // handler's mistake: the loop answers 500 for it, as for an over-long body.
  if (res.length < 0 || res.length > toI32(out.length) || res.length > toI32(res.body.length)) {
    st.lengths[k] = -1
  } else {
    // The whole body is copied when the slot holds it, as one `set`: what lies
    // past `length` is never sent. Only a body larger than the slot is copied
    // byte by byte, up to `length`.
    if (res.body.length <= out.length) {
      out.set(res.body)
    } else {
      for (let i: i32 = 0; i < res.length && i < toI32(out.length) && i < toI32(res.body.length); i++) {
        out[i] = res.body[i]
      }
    }
    st.lengths[k] = res.length
  }
  // A type the server has sent before is found by its text, with no copy;
  // the loop copies a new one's bytes into `typeBytes` as it sends it.
  const n: i32 = toI32(res.type.length)
  let known: i32 = -1
  for (let i: i32 = 0; n > 0 && known < 0 && i < toI32(st.typeTexts.length); i++) {
    if (st.typeTexts[i] === res.type) {
      known = i
    }
  }
  st.typeIndex[k] = known
  const type: u8[] = st.types[k]
  if (known >= 0) {
    st.typeLengths[k] = n
  } else if (n > toI32(type.length)) {
    st.typeLengths[k] = -1
  } else {
    for (let i: i32 = 0; i < n && i < toI32(type.length); i++) {
      type[i] = toU8(res.type.charCodeAt(i))
    }
    st.typeLengths[k] = n
  }
  st.done[k] = true
  st.finished[st.finishedCount] = k
  st.finishedCount += 1
  st.fresh = true
  if (!st.awake && !st.signalled) {
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

// ---- Spike A′: serve drives Http1Server directly ------------------------------------
//
// The per-request task, its region and its copy stay as `serveTask` has them;
// what goes is `HttpHandler`'s request pool, queue and pass. A connection's
// request is its own `HttpRequest`, whose head and spans are the parser's (the
// carrier reads no next request until this one's response is done, and
// `serveTask` copies them as it starts), and whose body is gathered into its
// own buffer. Not built: `bodyTimeout`'s sweep.

/** The connection side of the A′ loop. */
class ServeConns {
  server: Http1Server
  router: Router
  /** Per connection: its request, its generation, whether it is open, and the serve slot answering it (-1 for none). */
  reqs: HttpRequest[]
  gen: i32[]
  open: boolean[]
  task: i32[]
  /** Per connection: body bytes the carrier had no room for, `pending[s][pendingStart[s] .. pendingEnd[s])`. */
  pending: u8[][]
  pendingStart: i32[]
  pendingEnd: i32[]
  /** Per connection: whether it is in `dirty`, the connections the end of the turn flushes. */
  marked: boolean[]
  dirty: i32[]
  /** Per serve slot: the connection and generation its request came from. */
  connOf: i32[]
  genOf: i32[]
  /** `pollWait`'s output. */
  readyFds: i32[]
  /** The finished slots the loop is answering, copied out of `ServeState.finished`. */
  batch: i32[]
  probe: i32[]
  problemNames: u8[][]
  problemValues: u8[][]
  allowNames: u8[][]
  allowValues: u8[][]
  notFound: u8[]
  notAllowed: u8[]
  failed: u8[]
  unavailable: u8[]
  /** `Allow` values made, by the set of methods each holds, so each is made once. */
  allowMasks: i64[]
  allowCache: u8[][]
  /** Serve slots whose task the loop spawns once the drive that filled them returns. */
  launch: i32[]
  sent: i64 = 0
  launchCount: i32 = 0
  dirtyCount: i32 = 0
  loop: i32 = 0
  listener: i32 = 0
  outputSize: i32 = 0
  draining: boolean = false
  /** Whether the listener is out of the poll set after EMFILE, until the ticker's next wake. */
  resting: boolean = false

  constructor(server: Http1Server, router: Router) {
    this.server = server
    this.router = router
    this.reqs = []
    this.gen = []
    this.open = []
    this.task = []
    this.pending = []
    this.pendingStart = []
    this.pendingEnd = []
    this.marked = []
    this.dirty = []
    this.connOf = []
    this.genOf = []
    this.readyFds = []
    this.batch = []
    this.launch = []
    this.allowMasks = []
    this.allowCache = []
    this.probe = new Array<i32>(2 * router.maxParams + 2)
    const type: u8[] = serveBytes("content-type")
    const problem: u8[] = serveBytes("application/problem+json")
    this.problemNames = [type]
    this.problemValues = [problem]
    this.allowNames = [type, serveBytes("allow")]
    this.allowValues = [problem, problem]
    this.notFound = serveBytes(`{"type":"about:blank","title":"Not Found","status":404}`)
    this.notAllowed = serveBytes(`{"type":"about:blank","title":"Method Not Allowed","status":405}`)
    this.failed = serveBytes(`{"type":"about:blank","title":"Internal Server Error","status":500}`)
    this.unavailable = serveBytes(`{"type":"about:blank","title":"Service Unavailable","status":503}`)
  }
}

/** Makes the per-connection and per-serve-slot arrays. */
const serveConnsSize = (c: ServeConns, connections: i32, inFlight: i32): void => {
  for (let s: i32 = 0; s < connections; s++) {
    const r: HttpRequest = new HttpRequest(-1)
    r.params = new Array<i32>(2 * c.router.maxParams + 2)
    c.reqs.push(r)
    c.gen.push(toI32(0))
    c.open.push(false)
    c.task.push(toI32(-1))
    c.pending.push(new Array<u8>(0))
    c.pendingStart.push(toI32(0))
    c.pendingEnd.push(toI32(0))
    c.marked.push(false)
    c.dirty.push(toI32(0))
  }
  for (let k: i32 = 0; k < inFlight; k++) {
    c.connOf.push(toI32(-1))
    c.genOf.push(toI32(0))
    c.batch.push(toI32(0))
    c.launch.push(toI32(0))
  }
}

/** Lists connection `s` for the end of the turn's flush. */
const serveMark = (c: ServeConns, s: i32): void => {
  if (!c.marked[s]) {
    c.marked[s] = true
    c.dirty[c.dirtyCount] = s
    c.dirtyCount += 1
  }
}

/** The bookkeeping of a connection the carrier has closed. */
const serveForget = (c: ServeConns, s: i32): void => {
  c.open[s] = false
  c.gen[s] = c.gen[s] + 1
  c.task[s] = -1
  c.pendingStart[s] = 0
  c.pendingEnd[s] = 0
}

/** Closes connection `s` and forgets it. */
const serveCloseConn = (c: ServeConns, s: i32): void => {
  c.server.close(s)
  serveForget(c, s)
}

/** Whether serve slot `k`'s client has gone: its connection closed, reused, or its peer's stream ended. */
const serveGone = (c: ServeConns, k: i32): boolean => {
  const s: i32 = c.connOf[k]
  return s < 0 || !c.server.holds(s) || c.gen[s] !== c.genOf[k] || c.server.connection(s).ended()
}

/** Routes connection `s`'s request, a HEAD taking a GET route as the handler does. */
const serveRoute = (c: ServeConns, r: HttpRequest): void => {
  const router: Router = c.router
  let route: i32 = router.match(
    r.head,
    r.methodStart,
    r.methodEnd,
    r.head,
    r.targetStart,
    r.targetEnd,
    r.params
  )
  if (route === ROUTER_METHOD_NOT_ALLOWED && r.methodIs("HEAD")) {
    const get: i32 = router.methodIndex("GET")
    if (get >= 0) {
      const viaGet: i32 = router.match(
        router.methodBytes,
        router.methodStart[get],
        router.methodEnd[get],
        r.head,
        r.targetStart,
        r.targetEnd,
        r.params
      )
      if (viaGet >= 0) {
        route = viaGet
      }
    }
  }
  r.route = route
  r.paramCount = route >= 0 ? router.paramCount(route) : 0
  r.pathEnd = router.pathEnd
}

/** Whether `bytes[start .. end)` is exactly `text`. */
const serveSpanIs = (bytes: u8[], start: i32, end: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (end - start !== n || start < 0 || end > toI32(bytes.length)) {
    return false
  }
  for (let i: i32 = 0; i < n; i++) {
    if (toI32(bytes[start + i]) !== toI32(text.charCodeAt(i))) {
      return false
    }
  }
  return true
}

/** The `Allow` value for `r`'s path. */
const serveAllow = (c: ServeConns, r: HttpRequest): u8[] => {
  const router: Router = c.router
  let mask: i64 = 0
  for (let m: i32 = 0; m < toI32(router.methodStart.length) && m < 63; m++) {
    const route: i32 = router.match(
      router.methodBytes,
      router.methodStart[m],
      router.methodEnd[m],
      r.head,
      r.targetStart,
      r.targetEnd,
      c.probe
    )
    if (route >= 0) {
      mask = mask | (toI64(1) << toI64(m))
    }
  }
  for (let i: i32 = 0; i < toI32(c.allowMasks.length) && i < toI32(c.allowCache.length); i++) {
    if (c.allowMasks[i] === mask) {
      return c.allowCache[i]
    }
  }
  const value: u8[] = []
  let get: boolean = false
  let head: boolean = false
  for (let m: i32 = 0; m < toI32(router.methodStart.length); m++) {
    const route: i32 = router.match(
      router.methodBytes,
      router.methodStart[m],
      router.methodEnd[m],
      r.head,
      r.targetStart,
      r.targetEnd,
      c.probe
    )
    if (route >= 0) {
      const start: i32 = router.methodStart[m]
      const end: i32 = router.methodEnd[m]
      get = get || serveSpanIs(router.methodBytes, start, end, "GET")
      head = head || serveSpanIs(router.methodBytes, start, end, "HEAD")
      if (value.length > 0) {
        value.push(toU8(44))
        value.push(toU8(32))
      }
      for (let i: i32 = start; i < end && i < toI32(router.methodBytes.length); i++) {
        value.push(router.methodBytes[i])
      }
    }
  }
  if (get && !head) {
    if (value.length > 0) {
      value.push(toU8(44))
      value.push(toU8(32))
    }
    value.push(toU8(72))
    value.push(toU8(69))
    value.push(toU8(65))
    value.push(toU8(68))
  }
  c.allowMasks.push(mask)
  c.allowCache.push(value)
  return value
}

/** Ends connection `s`'s response once nothing is pending; false while the carrier still owes room. */
const serveFinish = (c: ServeConns, s: i32, conn: Http1Connection): boolean => {
  if (c.pendingEnd[s] > c.pendingStart[s]) {
    return false
  }
  if (conn.end() === H1_AGAIN) {
    return false
  }
  c.task[s] = -1
  return true
}

/**
 * Answers connection `s`'s request: the head, then the body, keeping what the
 * carrier has no room for. Closes the connection when the head does not fit.
 */
const serveRespond = (
  c: ServeConns,
  s: i32,
  status: i32,
  names: u8[][],
  values: u8[][],
  body: u8[],
  len: i32
): void => {
  const conn: Http1Connection = c.server.connection(s)
  const framing: i32 = status === 204 || status === 304 ? HTTP1_NO_BODY : len
  const sent: i32 = conn.respond(status, names, values, framing)
  if (sent === H1_AGAIN) {
    serveCloseConn(c, s)
    return
  }
  if (sent !== 0) {
    panic(`serve: the carrier refused the head (${sent})`)
  }
  c.task[s] = -2
  if (len > 0 && status !== 204 && status !== 304) {
    let taken: i32 = conn.write(body, 0, len)
    if (taken === H1_AGAIN) {
      taken = 0
    } else if (taken < 0) {
      panic(`serve: the carrier refused the body (${taken})`)
    }
    if (taken < len) {
      const rest: i32 = len - taken
      if (toI32(c.pending[s].length) < rest) {
        c.pending[s] = new Array<u8>(rest)
      }
      copyBytes(c.pending[s], 0, body, taken, rest)
      c.pendingStart[s] = 0
      c.pendingEnd[s] = rest
    }
  }
  serveFinish(c, s, conn)
  serveMark(c, s)
}

/** `H1_WRITE`: hands the carrier what `s` still owes and ends the response once it is all taken. */
const serveResume = (c: ServeConns, s: i32, conn: Http1Connection): void => {
  if (c.task[s] !== -2) {
    return
  }
  const left: i32 = c.pendingEnd[s] - c.pendingStart[s]
  if (left > 0) {
    const taken: i32 = conn.write(c.pending[s], c.pendingStart[s], left)
    if (taken > 0) {
      c.pendingStart[s] += taken
    }
    if (c.pendingStart[s] === c.pendingEnd[s]) {
      c.pendingStart[s] = 0
      c.pendingEnd[s] = 0
    }
  }
  serveFinish(c, s, conn)
}

/** Answers connection `s` with a problem body, for a request no task runs. */
const serveProblem = (c: ServeConns, s: i32, status: i32, body: u8[]): void => {
  serveRespond(c, s, status, c.problemNames, c.problemValues, body, toI32(body.length))
}

/** A whole request on `s`: a serve slot and its task, or a 503 when `inFlight` are running. */
const serveDispatch = (
  c: ServeConns,
  st: ServeState,
  s: i32,
  limits: ServeLimits,
  stats: ServeStats
): void => {
  const k: i32 = serveFreeSlot(st, limits)
  if (k < 0) {
    serveProblem(c, s, 503, c.unavailable)
    stats.busy += 1
    stats.answered += 1
    return
  }
  st.reqs[k] = c.reqs[s]
  st.busy[k] = true
  st.done[k] = false
  st.cancelled[k] = false
  st.tasks[k] = 0
  c.connOf[k] = s
  c.genOf[k] = c.gen[s]
  c.task[s] = k
  if (!st.listed[k]) {
    st.listed[k] = true
    st.running[st.runningCount] = k
    st.runningCount += 1
  }
  c.launch[c.launchCount] = k
  c.launchCount += 1
}

/** Takes connection `s`'s events until it needs the socket again. */
const serveDrive = (c: ServeConns, st: ServeState, s: i32, limits: ServeLimits, stats: ServeStats): void => {
  const conn: Http1Connection = c.server.connection(s)
  let event: i32 = c.server.next(s)
  while (event !== H1_NEED_MORE && event !== H1_ERROR) {
    if (event === H1_REQUEST) {
      if (c.draining) {
        conn.closeAfter = true
      }
      const p = conn.parser
      const r: HttpRequest = c.reqs[s]
      r.head = p.head
      r.spans = p.spans
      r.headLength = p.headLength
      r.headerCount = p.headerCount
      r.methodStart = p.methodStart
      r.methodEnd = p.methodEnd
      r.targetStart = p.targetStart
      r.targetEnd = p.targetEnd
      r.bodyLength = 0
      serveRoute(c, r)
    } else if (event === H1_BODY) {
      const r: HttpRequest = c.reqs[s]
      const n: i32 = conn.dataLength
      const need: i32 = r.bodyLength + n
      if (toI32(r.body.length) < need) {
        let size: i32 = toI32(r.body.length) < 64 ? 64 : toI32(r.body.length)
        while (size < need) {
          size = size * 2
        }
        const grown: u8[] = new Array<u8>(size)
        copyBytes(grown, 0, r.body, 0, r.bodyLength)
        r.body = grown
      }
      copyBytes(r.body, r.bodyLength, conn.data, conn.dataStart, n)
      r.bodyLength = need
    } else if (event === H1_END) {
      serveDispatch(c, st, s, limits, stats)
    } else if (event === H1_WRITE) {
      serveResume(c, s, conn)
    }
    event = c.server.next(s)
  }
  // As the handler's `owable`: only a roomy output with a response to send
  // waits for the end of the turn, so a hang-up closes in the pass that reads it.
  if (
    event !== H1_ERROR &&
    !c.draining &&
    conn.wantsWrite() &&
    !conn.writeHeld &&
    (conn.outputEnd - conn.outputStart) * 2 <= c.outputSize
  ) {
    serveMark(c, s)
  } else if (!c.marked[s]) {
    serveSettle(c, s)
  }
}

/** Sends slot `k`'s answer, as its task wrote it, on its connection if that is still the one it came from. */
const serveAnswerDirect = (c: ServeConns, st: ServeState, k: i32, stats: ServeStats): void => {
  const s: i32 = c.connOf[k]
  c.connOf[k] = -1
  if (s < 0 || !c.server.holds(s) || c.gen[s] !== c.genOf[k]) {
    return
  }
  const r: HttpRequest = st.reqs[k]
  const status: i32 = st.status[k]
  if (status === SERVE_REFUSE) {
    if (r.route === ROUTER_METHOD_NOT_ALLOWED) {
      c.allowValues[1] = serveAllow(c, r)
      serveRespond(c, s, 405, c.allowNames, c.allowValues, c.notAllowed, toI32(c.notAllowed.length))
    } else {
      serveProblem(c, s, 404, c.notFound)
    }
    return
  }
  const length: i32 = st.lengths[k]
  if (status < 200 || status > 599 || length < 0 || st.typeLengths[k] < 0) {
    stats.failed += 1
    serveProblem(c, s, SERVE_FAILED, c.failed)
    return
  }
  if (st.typeLengths[k] === 0) {
    serveRespond(c, s, status, st.plainNames, st.plainValues, st.bodies[k], length)
    return
  }
  const type: i32 = st.typeIndex[k] >= 0 ? st.typeIndex[k] : serveType(st, st.types[k], st.typeLengths[k])
  if (type < 0) {
    stats.failed += 1
    serveProblem(c, s, SERVE_FAILED, c.failed)
    return
  }
  const last: i32 = toI32(st.typedValues.length) - 1
  st.typedValues[last] = st.typeBytes[type]
  serveRespond(c, s, status, st.typedNames, st.typedValues, st.bodies[k], length)
}

/** Takes every waiting connection, resting the listener on EMFILE as the handler does. */
const serveAcceptAll = (c: ServeConns): void => {
  if (c.draining) {
    return
  }
  let slot: i32 = c.server.accept()
  while (slot >= 0 || slot === H1_POOL_FULL || slot === -103) {
    if (slot >= 0) {
      c.open[slot] = true
      c.task[slot] = -1
      c.pendingStart[slot] = 0
      c.pendingEnd[slot] = 0
      pollAdd(c.loop, c.server.fd(slot), H1_WANT_READ, slot)
    }
    slot = c.server.accept()
  }
  if (slot !== -11) {
    // Out of descriptors: rest the listener until the ticker's next wake.
    pollRemove(c.loop, c.listener)
    c.resting = true
  }
}

/** Sends what connection `s` holds and re-arms it, or closes it once it is over. */
const serveSettle = (c: ServeConns, s: i32): void => {
  const conn: Http1Connection = c.server.connection(s)
  if (conn.wantsWrite()) {
    c.sent += 1
  }
  const wants: i32 = c.server.flush(s)
  if ((wants & H1_DONE) !== 0) {
    serveCloseConn(c, s)
  } else if (c.draining && c.task[s] === -1 && !conn.wantsWrite()) {
    serveCloseConn(c, s)
  } else if (c.server.rearm(s, wants)) {
    pollModify(c.loop, c.server.fd(s), wants & (H1_WANT_READ | H1_WANT_WRITE), s)
  }
}

/** Sends what each connection the turn touched holds, and re-arms or closes it. */
const serveFlushAll = (c: ServeConns): void => {
  const n: i32 = c.dirtyCount
  c.dirtyCount = 0
  for (let i: i32 = 0; i < n && i < toI32(c.dirty.length); i++) {
    const s: i32 = c.dirty[i]
    c.marked[s] = false
    if (c.open[s] && c.server.holds(s)) {
      serveSettle(c, s)
    }
  }
}

/** `serveOn` over the carrier directly (spike A′). */
const serveDirect = async (
  listener: i32,
  router: Router,
  limits: ServeLimits,
  handle: (req: Request) => Promise<Response>,
  stats: ServeStats
): Promise<i32> => {
  const config: Http1Config = new Http1Config()
  config.maxHeaderBytes = limits.headerBytes
  config.maxBody = limits.bodyBytes
  config.headTimeout = limits.headTimeout
  config.idleTimeout = limits.idleTimeout
  const c: ServeConns = new ServeConns(new Http1Server(config, listener, limits.connections), router)
  c.listener = listener
  c.outputSize = config.outputSize
  c.readyFds = new Array<i32>(2 * 256)
  serveConnsSize(c, limits.connections, limits.inFlight)
  c.loop = pollCreate()
  if (c.loop < 0) {
    panic(`serve: pollCreate failed: ${c.loop}`)
  }
  pollAdd(c.loop, listener, H1_WANT_READ, -1)
  const st: ServeState = new ServeState()
  st.deadline = limits.deadline
  serveFields(st, limits.server)
  const fds: i32[] = [0, 0]
  const made: i32 = unixSocketPair(NET_UNIX_STREAM, fds)
  if (made < 0) {
    panic(`serve: the wake socket could not be made: ${made}`)
  }
  st.wakeFd = fds[1]
  pollAdd(c.loop, fds[0], H1_WANT_READ, -2)
  const drained: u8[] = new Array<u8>(64)
  spawn(serveTick(st))
  while (true) {
    st.awake = true
    const n: i32 = pollWait(c.loop, c.readyFds, 0)
    for (let i: i32 = 0; i < n; i++) {
      const token: i32 = c.readyFds[2 * i]
      if (token === -1) {
        serveAcceptAll(c)
      } else if (token === -2) {
        st.signalled = false
        while (netRead(fds[0], drained, 0, 64) > 0) {
          // Each read takes up to 64 wake bytes; the loop empties the socket.
        }
        if (c.resting && !c.draining) {
          c.resting = false
          pollAdd(c.loop, listener, H1_WANT_READ, -1)
        }
      } else if (token >= 0 && c.server.holds(token)) {
        if ((c.readyFds[2 * i + 1] & 5) !== 0) {
          c.server.readable(token)
        } else {
          c.server.writable(token)
        }
        serveDrive(c, st, token, limits, stats)
        for (let j: i32 = 0; j < c.launchCount; j++) {
          spawn(serveTask(handle, st, c.launch[j]))
        }
        c.launchCount = 0
      }
    }
    if (c.server.expire(monotonicNanos()) > 0) {
      for (let s: i32 = 0; s < toI32(c.open.length); s++) {
        if (c.open[s] && !c.server.holds(s)) {
          serveForget(c, s)
        }
      }
    }
    // Answer what the tasks wrote; each answer lets its connection's next
    // pipelined request in, whose task may answer at once.
    while (st.finishedCount > 0) {
      const count: i32 = st.finishedCount
      for (let i: i32 = 0; i < count && i < toI32(c.batch.length); i++) {
        c.batch[i] = st.finished[i]
      }
      st.finishedCount = 0
      st.fresh = false
      for (let i: i32 = 0; i < count && i < toI32(c.batch.length); i++) {
        const k: i32 = c.batch[i]
        const s: i32 = c.connOf[k]
        serveAnswerDirect(c, st, k, stats)
        st.busy[k] = false
        st.done[k] = false
        st.cancelled[k] = false
        st.tasks[k] = 0
        st.free[st.freeCount] = k
        st.freeCount += 1
        stats.answered += 1
        if (s >= 0 && c.open[s] && c.server.holds(s)) {
          const conn: Http1Connection = c.server.connection(s)
          if ((conn.outputEnd - conn.outputStart) * 2 > c.outputSize) {
            // Mostly unsent: send it now, so the next answer's head fits.
            c.marked[s] = false
            const wants: i32 = c.server.flush(s)
            c.sent += 1
            if ((wants & H1_DONE) !== 0) {
              serveCloseConn(c, s)
              continue
            }
            if (c.server.rearm(s, wants)) {
              pollModify(c.loop, c.server.fd(s), wants & (H1_WANT_READ | H1_WANT_WRITE), s)
            }
          }
          serveDrive(c, st, s, limits, stats)
          for (let j: i32 = 0; j < c.launchCount; j++) {
            spawn(serveTask(handle, st, c.launch[j]))
          }
          c.launchCount = 0
        }
      }
    }
    let kept: i32 = 0
    for (let i: i32 = 0; i < st.runningCount && i < toI32(st.running.length); i++) {
      const k: i32 = st.running[i]
      if (st.busy[k] && !st.done[k]) {
        if (st.stopping || serveGone(c, k)) {
          serveCancel(st, k)
        }
        st.running[kept] = k
        kept += 1
      } else {
        st.listed[k] = false
      }
    }
    st.runningCount = kept
    serveFlushAll(c)
    stats.sends = c.sent
    stats.slots = toI32(st.busy.length)
    if (stats.warmAfter > 0 && stats.usedWarm === 0 && stats.answered >= stats.warmAfter) {
      stats.usedWarm = Arena.used()
    }
    if (!c.draining && limits.maxRequests > 0 && stats.answered >= limits.maxRequests) {
      stats.usedEnd = Arena.used()
      c.draining = true
      if (!c.resting) {
        pollRemove(c.loop, listener)
      }
      for (let s: i32 = 0; s < toI32(c.open.length); s++) {
        if (c.open[s] && c.server.holds(s)) {
          const conn: Http1Connection = c.server.connection(s)
          if (c.task[s] === -1 && !conn.wantsWrite()) {
            serveCloseConn(c, s)
          } else {
            conn.closeAfter = true
          }
        }
      }
      st.stopping = true
      for (let k: i32 = 0; k < toI32(st.busy.length); k++) {
        if (st.busy[k] && !st.done[k]) {
          serveCancel(st, k)
        }
      }
    }
    if (c.draining && c.server.busy() === 0 && !serveAnyBusy(st)) {
      break
    }
    if (st.finishedCount > 0) {
      continue
    }
    st.awake = false
    await readable(c.loop)
  }
  st.stopped = true
  netClose(fds[0])
  netClose(fds[1])
  netClose(c.loop)
  return 0
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
  if (SERVE_DIRECT) {
    return await serveDirect(listener, router, limits, handle, stats)
  }
  const hl: HandlerLimits = new HandlerLimits()
  hl.slots = limits.connections
  hl.http.maxHeaderBytes = limits.headerBytes
  hl.http.maxBody = limits.bodyBytes
  hl.http.headTimeout = limits.headTimeout
  hl.http.idleTimeout = limits.idleTimeout
  const h: HttpHandler = new HttpHandler(hl, listener, router)
  h.deferSends()
  const st: ServeState = new ServeState()
  st.deadline = limits.deadline
  serveFields(st, limits.server)
  const fds: i32[] = [0, 0]
  const made: i32 = unixSocketPair(NET_UNIX_STREAM, fds)
  if (made < 0) {
    panic(`serve: the wake socket could not be made: ${made}`)
  }
  st.wakeFd = fds[1]
  h.watch(fds[0], SERVE_WAKE)
  const drained: u8[] = new Array<u8>(64)
  spawn(serveTick(st))
  let draining: boolean = false
  while (true) {
    st.awake = true
    h.wait(0)
    if (h.fired(SERVE_WAKE)) {
      st.signalled = false
      while (netRead(fds[0], drained, 0, 64) > 0) {
        // Each read takes up to 64 wake bytes; the loop empties the socket.
      }
    }
    // Each pass answers what the tasks wrote and takes what the handler
    // queued: a pipelined request is queued once the one before it is
    // answered, so a burst on a connection is taken and answered in request
    // order within this turn, and the handler sends the answers together.
    let moved: boolean = true
    while (moved || st.fresh) {
      moved = false
      st.fresh = false
      // A task appends its slot as it answers; none runs while the loop
      // does, so the list is read whole and emptied.
      for (let i: i32 = 0; i < st.finishedCount && i < toI32(st.finished.length); i++) {
        const k: i32 = st.finished[i]
        serveAnswer(h, st, k, stats)
        st.busy[k] = false
        st.done[k] = false
        st.cancelled[k] = false
        st.tasks[k] = 0
        st.free[st.freeCount] = k
        st.freeCount += 1
        stats.answered += 1
        moved = true
      }
      st.finishedCount = 0
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
        if (!st.listed[k]) {
          st.listed[k] = true
          st.running[st.runningCount] = k
          st.runningCount += 1
        }
        if (SERVE_INLINE) {
          // Spike (design A upper bound): the handler runs on the loop's own
          // task over the parser's buffers, with no task, region or copy.
          const res: Response = await handle(new Request(r))
          serveStore(st, k, res)
        } else {
          spawn(serveTask(handle, st, k))
        }
      }
    }
    // A task still running whose client hung up, or any once the server is
    // stopping: nobody waits for its answer, so it is told to stop waiting
    // too. The answered ones leave the list here.
    let kept: i32 = 0
    for (let i: i32 = 0; i < st.runningCount && i < toI32(st.running.length); i++) {
      const k: i32 = st.running[i]
      if (st.busy[k] && !st.done[k]) {
        if (st.stopping || h.hungUp(st.reqs[k])) {
          serveCancel(st, k)
        }
        st.running[kept] = k
        kept += 1
      } else {
        st.listed[k] = false
      }
    }
    st.runningCount = kept
    // The turn's answers go out together, before the arena is read, so a
    // close the send causes is counted in the turn that caused it.
    h.flush()
    stats.sends = h.sends()
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
    if (h.ready()) {
      // A send let a parked request in: take it before parking.
      continue
    }
    st.awake = false
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
