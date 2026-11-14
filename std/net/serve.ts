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
 * `serve` drives `nish/net/http1-server`'s connections from a readiness loop
 * of its own, as an `async` function: it awaits the loop's descriptor, so
 * the program's other tasks run while no socket is ready. It routes each
 * request at its head, gathers its body, and hands the whole request to
 * `handle` in a task of its own, spawned with the request's slot; the
 * task's allocations — the request it reads, the response it builds,
 * whatever `handle` makes on the way — live in the task's region and go
 * when it ends.
 *
 * **The task reads its own copy.** Until it is answered, a request's head is
 * the connection parser's own buffer, read in place. The task copies the
 * head and body into its own memory before `handle` runs, as `spawn` runs it
 * that far at once,
 * and when `handle` answers it writes the status, the content type and the
 * body back into the slot's fixed buffers, in bulk, and wakes the
 * loop. The loop then sends the answer and frees the slot. Nothing the task
 * allocated outlives it, and the loop's arena does not grow per request once
 * its slots are warm: `tests/link/net_serve_pipelined_flat` pins
 * `Arena.used()` flat over thousands of pipelined requests. What the runtime
 * allocates outside the arena for a task and its region is not measured.
 *
 * **Answers keep request order.** The server reads a connection's next
 * request only once the one before it is answered, so at most one request
 * per connection is in flight, and pipelined requests are answered in the
 * order they came: a later request's task starts only after the earlier one
 * is answered, so it can never finish first.
 *
 * **A pipelined burst goes out in one write.** The loop answers what the
 * tasks wrote and takes what the connections queued until neither moves, so
 * a `handle` that answers without waiting serves a whole burst in one turn.
 * The loop holds each answer's send while the next request on its
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
import { JsonWriter } from "nish/json"
import { HttpRequest } from "nish/net/handler"
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
/** Milliseconds between the ticker's wakes, which run the connections' timeouts. */
const SERVE_TICK_MS: i32 = 1000
/** `refused` marks a response the loop answers with 404 or 405. */
const SERVE_REFUSE: i32 = -1
/** The poll token of the listening socket. */
const SERVE_LISTENER: i32 = -1
/** The poll token of the wake socket. */
const SERVE_WAKE: i32 = -2
/** The ready bits that mean a socket can be read or has hung up: EPOLLIN | EPOLLHUP's poll mapping. */
const SERVE_READ_BITS: i32 = 5
/** Sockets one poll reports at most. */
const SERVE_EVENTS: i32 = 256
/** `accept`'s answer when the backlog is empty. */
const SERVE_ACCEPT_NONE: i32 = -11
/** `accept`'s answer when a connection was reset in the backlog: the next one is tried. */
const SERVE_ACCEPT_ABORTED: i32 = -103
/** Nanoseconds the listener rests after `accept` runs out of descriptors or memory. */
const SERVE_ACCEPT_REST: i64 = 100000000
/** Nanoseconds between the checks for a request body that is too slow. */
const SERVE_BODY_SWEEP: i64 = 1000000000
/** Nanoseconds a request's body may take to arrive, from its head. */
const SERVE_BODY_TIMEOUT: i64 = 30000000000
// `HttpRequest.state` is internal: under `serve` it carries these SERVE_*
// numbers, which are not `HttpHandler`'s HANDLER_* ones (its FLUSHING is 6,
// and `serve` has no STREAMING), so the two must not be mixed.
/** A slot's exchange: no request. */
const SERVE_IDLE: i32 = 0
/** A slot's exchange: its head is read and its body is arriving. */
const SERVE_READING: i32 = 1
/** A slot's exchange: whole, waiting for room in the output before it is queued. */
const SERVE_PARKED: i32 = 2
/** A slot's exchange: whole and queued for a task. */
const SERVE_QUEUED: i32 = 3
/** A slot's exchange: a task holds it. */
const SERVE_HELD: i32 = 4
/** A slot's exchange: answered, its last bytes waiting for room. */
const SERVE_FLUSHING: i32 = 5
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
  /** The request as the server parsed it, copied into the task: its spans, its head and its body. */
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
 * @returns a response the server answers with 404, or 405 and an `Allow` field naming the methods its path has
 */
export const refuse = (_req: Request): Response => new Response(SERVE_REFUSE)

/**
 * The shared state between the loop and its tasks: one slot per request in
 * flight. Each slot's buffers are made once, the first time the slot is
 * used, and kept.
 */
class ServeState {
  /** The request each slot holds: its connection's, read by the task before it first waits. */
  reqs: HttpRequest[]
  /** The connection slot each request was read on, and that slot's generation then: where its answer goes. */
  slots: i32[]
  gens: i32[]
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
    this.slots = []
    this.gens = []
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
  st.slots.push(toI32(0))
  st.gens.push(toI32(0))
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
const serveAnswer = (c: ServeConns, st: ServeState, k: i32, stats: ServeStats): void => {
  const s: i32 = st.slots[k]
  const gen: i32 = st.gens[k]
  const status: i32 = st.status[k]
  if (status === SERVE_REFUSE) {
    c.refuse(s, gen)
    return
  }
  const length: i32 = st.lengths[k]
  if (status < 200 || status > 599 || length < 0 || st.typeLengths[k] < 0) {
    stats.failed += 1
    c.problem(s, gen, SERVE_FAILED, c.failed)
    return
  }
  if (st.typeLengths[k] === 0) {
    c.send(s, gen, status, st.plainNames, st.plainValues, st.bodies[k], length)
    return
  }
  const type: i32 = st.typeIndex[k] >= 0 ? st.typeIndex[k] : serveType(st, st.types[k], st.typeLengths[k])
  if (type < 0) {
    stats.failed += 1
    c.problem(s, gen, SERVE_FAILED, c.failed)
    return
  }
  const last: i32 = toI32(st.typedValues.length) - 1
  st.typedValues[last] = st.typeBytes[type]
  c.send(s, gen, status, st.typedNames, st.typedValues, st.bodies[k], length)
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
  // which `ServeConns.send` treats as a program's mistake and panics on.
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

/** Wakes the loop every `SERVE_TICK_MS`, so the connections' timeouts run while no socket is ready; ends once the loop stops. */
const serveTick = async (st: ServeState): Promise<void> => {
  while (!st.stopped) {
    await sleep(SERVE_TICK_MS)
    if (!st.stopped && !st.signalled) {
      st.signalled = true
      netWrite(st.wakeFd, st.one, 0, 1)
    }
  }
}

/** The RFC 9457 problem object `{"type":"about:blank","title":…,"status":…}` as bytes. */
const serveProblem = (status: i32, title: string): u8[] => {
  const buf: u8[] = new Array<u8>(256)
  const w: JsonWriter = new JsonWriter(buf, 0)
  w.beginObject()
  w.key("type")
  w.string("about:blank")
  w.key("title")
  w.string(title)
  w.key("status")
  w.i32(status)
  w.endObject()
  const out: u8[] = new Array<u8>(w.end)
  copyBytes(out, 0, buf, 0, w.end)
  return out
}

/** Whether `bytes[start .. end)` is the ASCII text `text`. */
const serveSpanIs = (bytes: u8[], start: i32, end: i32, text: string): boolean => {
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

/** Appends `bytes[start .. end)` to an `allow` value, after ", " unless it is the first. */
const serveAllowAppend = (value: u8[], bytes: u8[], start: i32, end: i32): void => {
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

/** A buffer size at least `need`, doubling from `have` (64 at least). */
const serveGrown = (have: i32, need: i32): i32 => {
  let size: i32 = have < 64 ? 64 : have
  while (size < need && size < 1073741824) {
    size = size * 2
  }
  return size < need ? need : size
}

/**
 * The connections: an `Http1Server` driven straight from the loop. Each slot
 * has one `HttpRequest`, reused for each exchange on it, whose head and
 * spans are the parser's own: the parser keeps them until the exchange's
 * answer is sent, and the request's task copies them before it first waits,
 * as `spawn` runs it that far at once. An exchange moves idle → reading →
 * (parked →) queued → held → (flushing →) idle; a slot whose connection
 * closes goes idle and its generation moves on, so an answer for it is
 * dropped.
 */
class ServeConns {
  server: Http1Server
  router: Router
  /** Each slot's request, built on the slot's first connection. */
  reqs: HttpRequest[]
  /** Each slot's generation: moves on when its connection closes. */
  slotGen: i32[]
  /** Whether a slot holds a connection the loop accepted and has not forgotten. */
  open: boolean[]
  /** Whether a slot's send is owed, so it is listed in `owed` once. */
  owing: boolean[]
  /** The slots whose send waits for the end of the turn, `owed[0 .. owedCount)`. */
  owed: i32[]
  /** The queued exchanges' slots, a ring from `queueStart`, and each one's generation when queued. */
  queue: i32[]
  queueGen: i32[]
  /** `pollWait`'s answers: token and bits per ready socket. */
  readyFds: i32[]
  /** The parameter spans `allowFor`'s matches write. */
  probe: i32[]
  /** The fields of a problem answer, and of a 405, whose `allow` value is set per answer. */
  problemNames: u8[][]
  problemValues: u8[][]
  allowNames: u8[][]
  allowValues: u8[][]
  /** Each method set an `allow` value was made for, and that value. */
  allowMasks: i64[]
  allowBytes: u8[][]
  /** The problem bodies of 404, 405, 500 and 503. */
  notFound: u8[]
  notAllowed: u8[]
  failed: u8[]
  unavailable: u8[]
  /** When the listener comes back after a rest, or 0. */
  acceptRestUntil: i64 = 0
  /** The clock at the start of this turn, which stamps a head. */
  turnAt: i64 = 0
  /** When slow bodies are next looked for. */
  bodyCheckAt: i64 = 0
  /** Sends made: each settle of a connection with bytes to write. */
  sent: i64 = 0
  listener: i32 = 0
  loop: i32 = 0
  queueStart: i32 = 0
  queueCount: i32 = 0
  owedCount: i32 = 0
  outputSize: i32 = 0
  /** Set once the server stops taking connections and requests. */
  draining: boolean = false

  constructor(limits: ServeLimits, listener: i32, router: Router) {
    const config: Http1Config = new Http1Config()
    config.maxHeaderBytes = limits.headerBytes
    config.maxBody = limits.bodyBytes
    config.headTimeout = limits.headTimeout
    config.idleTimeout = limits.idleTimeout
    this.server = new Http1Server(config, listener, limits.connections)
    this.router = router
    this.listener = listener
    this.outputSize = config.outputSize
    this.reqs = []
    this.slotGen = new Array<i32>(limits.connections)
    this.open = new Array<boolean>(limits.connections)
    this.owing = new Array<boolean>(limits.connections)
    this.owed = new Array<i32>(limits.connections)
    this.queue = new Array<i32>(16)
    this.queueGen = new Array<i32>(16)
    this.readyFds = new Array<i32>(2 * SERVE_EVENTS)
    this.probe = new Array<i32>(2 * router.maxParams + 2)
    const contentType: u8[] = serveBytes("content-type")
    const problemType: u8[] = serveBytes("application/problem+json")
    this.problemNames = [contentType]
    this.problemValues = [problemType]
    this.allowNames = [contentType, serveBytes("allow")]
    this.allowValues = [problemType, problemType]
    this.allowMasks = []
    this.allowBytes = []
    this.notFound = serveProblem(404, "Not Found")
    this.notAllowed = serveProblem(405, "Method Not Allowed")
    this.failed = serveProblem(SERVE_FAILED, "Internal Server Error")
    this.unavailable = serveProblem(503, "Service Unavailable")
    this.loop = pollCreate()
    if (this.loop < 0) {
      panic(`serve: pollCreate failed: ${this.loop}`)
    }
    pollAdd(this.loop, listener, H1_WANT_READ, SERVE_LISTENER)
  }

  /**
   * One turn: sends what the last turn owed, takes what the sockets have
   * ready without blocking, and runs the timeouts. Answers whether the wake
   * socket was ready.
   */
  turn(): boolean {
    this.flush()
    if (this.acceptRestUntil > 0 && monotonicNanos() >= this.acceptRestUntil) {
      this.acceptRestUntil = 0
      if (!this.draining) {
        pollAdd(this.loop, this.listener, H1_WANT_READ, SERVE_LISTENER)
      }
    }
    const n: i32 = pollWait(this.loop, this.readyFds, 0)
    const now: i64 = monotonicNanos()
    this.turnAt = now
    let woken: boolean = false
    for (let k: i32 = 0; k < n; k++) {
      const token: i32 = this.readyFds[2 * k]
      if (token === SERVE_LISTENER) {
        this.acceptAll()
      } else if (token === SERVE_WAKE) {
        woken = true
      } else if (token >= 0 && this.server.holds(token)) {
        if ((this.readyFds[2 * k + 1] & SERVE_READ_BITS) !== 0) {
          this.server.readable(token)
        } else {
          this.server.writable(token)
        }
        this.drive(token)
      }
    }
    if (this.server.expire(now) > 0) {
      // The carrier closed idle or late connections: forget them.
      for (let s: i32 = 0; s < toI32(this.open.length); s++) {
        if (this.open[s] && !this.server.holds(s)) {
          this.forget(s)
        }
      }
    }
    if (now >= this.bodyCheckAt) {
      this.bodyCheckAt = now + SERVE_BODY_SWEEP
      for (let s: i32 = 0; s < toI32(this.open.length); s++) {
        if (this.open[s]) {
          const r: HttpRequest = this.reqs[s]
          if (r.state === SERVE_READING && now - r.since > SERVE_BODY_TIMEOUT) {
            this.closeSlot(s)
          }
        }
      }
    }
    return woken
  }

  /** Stops taking connections; a connection between exchanges closes, the others close after their exchange. */
  drain(): void {
    if (this.draining) {
      return
    }
    this.draining = true
    if (this.acceptRestUntil === 0) {
      pollRemove(this.loop, this.listener)
    }
    for (let s: i32 = 0; s < toI32(this.open.length); s++) {
      if (this.open[s] && this.server.holds(s)) {
        if (this.reqs[s].state === SERVE_IDLE && !this.server.connection(s).wantsWrite()) {
          this.closeSlot(s)
        } else {
          this.server.connection(s).closeAfter = true
        }
      }
    }
  }

  /** Accepts every waiting connection; out of descriptors or memory, rests the listener rather than spin. */
  acceptAll(): void {
    if (this.draining) {
      return
    }
    let slot: i32 = this.server.accept()
    while (slot >= 0 || slot === H1_POOL_FULL || slot === SERVE_ACCEPT_ABORTED) {
      if (slot >= 0) {
        // The carrier takes a freed slot first, then the next never used,
        // so a slot's record is built on its first connection, as its own
        // buffers are, and a pool that never fills never builds its last.
        while (toI32(this.reqs.length) <= slot) {
          const r: HttpRequest = new HttpRequest(toI32(this.reqs.length))
          r.params = new Array<i32>(2 * this.router.maxParams + 2)
          this.reqs.push(r)
        }
        this.open[slot] = true
        this.reqs[slot].state = SERVE_IDLE
        pollAdd(this.loop, this.server.fd(slot), H1_WANT_READ, slot)
      }
      slot = this.server.accept()
    }
    if (slot !== SERVE_ACCEPT_NONE) {
      pollRemove(this.loop, this.listener)
      this.acceptRestUntil = monotonicNanos() + SERVE_ACCEPT_REST
    }
  }

  /** Sends what each slot owes, once per turn. */
  flush(): void {
    const n: i32 = this.owedCount
    this.owedCount = 0
    for (let k: i32 = 0; k < n; k++) {
      const slot: i32 = this.owed[k]
      this.owing[slot] = false
      if (this.open[slot] && this.server.holds(slot)) {
        this.settle(slot, this.server.connection(slot))
      }
    }
  }

  /** Runs slot `s`'s events until it needs bytes, then owes or makes its send. */
  drive(s: i32): void {
    const conn: Http1Connection = this.server.connection(s)
    const r: HttpRequest = this.reqs[s]
    let event: i32 = this.server.next(s)
    while (event !== H1_NEED_MORE && event !== H1_ERROR) {
      if (event === H1_REQUEST) {
        this.begin(s, conn, r)
      } else if (event === H1_BODY && r.state === SERVE_READING) {
        const n: i32 = conn.dataLength
        const need: i32 = r.bodyLength + n
        if (toI32(r.body.length) < need) {
          const grown: u8[] = new Array<u8>(serveGrown(toI32(r.body.length), need))
          copyBytes(grown, 0, r.body, 0, r.bodyLength)
          r.body = grown
        }
        copyBytes(r.body, r.bodyLength, conn.data, conn.dataStart, n)
        r.bodyLength = need
      } else if (event === H1_END && r.state === SERVE_READING) {
        if (this.roomy(conn)) {
          this.enqueue(s)
        } else {
          r.state = SERVE_PARKED
        }
      } else if (event === H1_WRITE && r.state === SERVE_FLUSHING) {
        this.finish(r, conn)
      }
      event = this.server.next(s)
    }
    if (event === H1_ERROR) {
      // The carrier has written its refusal and ends the connection.
      if (r.state === SERVE_READING) {
        r.state = SERVE_IDLE
      }
    } else if (
      !this.draining &&
      conn.wantsWrite() &&
      !conn.writeHeld &&
      this.roomy(conn) &&
      r.state !== SERVE_PARKED
    ) {
      // The send waits for the turn's end, to go out with the answers after it.
      if (!this.owing[s]) {
        this.owing[s] = true
        this.owed[this.owedCount] = s
        this.owedCount += 1
      }
      return
    }
    this.settle(s, conn)
  }

  /** Sends slot `s`'s output and rearms it; a parked exchange is queued once there is room. */
  settle(s: i32, conn: Http1Connection): void {
    if (conn.wantsWrite()) {
      this.sent += 1
    }
    const wants: i32 = this.server.flush(s)
    if ((wants & H1_DONE) !== 0) {
      this.closeSlot(s)
      return
    }
    const r: HttpRequest = this.reqs[s]
    if (this.draining && r.state === SERVE_IDLE && !conn.wantsWrite()) {
      this.closeSlot(s)
      return
    }
    if (this.server.rearm(s, wants)) {
      pollModify(this.loop, this.server.fd(s), wants & (H1_WANT_READ | H1_WANT_WRITE), s)
    }
    if (r.state === SERVE_PARKED && this.roomy(conn)) {
      this.enqueue(s)
    }
  }

  /** Whether the output is at most half full: room for an answer's head behind what is there. */
  roomy(conn: Http1Connection): boolean {
    return (conn.outputEnd - conn.outputStart) * 2 <= this.outputSize
  }

  /** Points slot `s`'s request at the head the parser read, and routes it. */
  begin(s: i32, conn: Http1Connection, r: HttpRequest): void {
    if (this.draining) {
      // A head read during the drain is the connection's last.
      conn.closeAfter = true
    }
    const p = conn.parser
    r.head = p.head
    r.spans = p.spans
    r.headLength = p.headLength
    r.headerCount = p.headerCount
    r.methodStart = p.methodStart
    r.methodEnd = p.methodEnd
    r.targetStart = p.targetStart
    r.targetEnd = p.targetEnd
    r.bodyLength = 0
    r.slot = s
    r.gen = this.slotGen[s]
    r.since = this.turnAt
    r.state = SERVE_READING
    r.pendingStart = 0
    r.pendingEnd = 0
    const router: Router = this.router
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
    // The router found where the path ends, before any query, as it matched.
    r.pathEnd = router.pathEnd
  }

  /** Queues slot `s`'s whole exchange for a task. */
  enqueue(s: i32): void {
    this.reqs[s].state = SERVE_QUEUED
    const size: i32 = toI32(this.queue.length)
    if (this.queueCount === size) {
      const grown: i32[] = new Array<i32>(2 * size)
      const grownGen: i32[] = new Array<i32>(2 * size)
      for (let k: i32 = 0; k < size && k < toI32(grown.length) && k < toI32(grownGen.length); k++) {
        grown[k] = this.queue[(this.queueStart + k) % size]
        grownGen[k] = this.queueGen[(this.queueStart + k) % size]
      }
      this.queue = grown
      this.queueGen = grownGen
      this.queueStart = 0
    }
    const at: i32 = (this.queueStart + this.queueCount) % toI32(this.queue.length)
    this.queue[at] = s
    this.queueGen[at] = this.slotGen[s]
    this.queueCount += 1
  }

  /** Whether a queued exchange is ready, dropping those whose connection closed. */
  ready(): boolean {
    while (this.queueCount > 0) {
      if (this.live(this.queue[this.queueStart], this.queueGen[this.queueStart])) {
        return true
      }
      this.queueStart = (this.queueStart + 1) % toI32(this.queue.length)
      this.queueCount -= 1
    }
    return false
  }

  /** The next queued exchange's slot, now held; call after `ready`. */
  take(): i32 {
    const s: i32 = this.queue[this.queueStart]
    this.queueStart = (this.queueStart + 1) % toI32(this.queue.length)
    this.queueCount -= 1
    this.reqs[s].state = SERVE_HELD
    return s
  }

  /** Whether slot `s` still holds the connection it had at generation `gen`. */
  live(s: i32, gen: i32): boolean {
    return this.server.holds(s) && this.slotGen[s] === gen
  }

  /** Whether nobody waits for the answer of slot `s`'s exchange at generation `gen`. */
  hungUp(s: i32, gen: i32): boolean {
    return !this.live(s, gen) || this.server.connection(s).ended()
  }

  closeSlot(s: i32): void {
    this.server.close(s)
    this.forget(s)
  }

  /** Marks slot `s` closed: its exchange is nobody's and its generation moves on. */
  forget(s: i32): void {
    this.open[s] = false
    this.slotGen[s] = this.slotGen[s] + 1
    this.reqs[s].state = SERVE_IDLE
  }

  /**
   * Answers slot `s`'s held exchange at generation `gen`, unless its
   * connection closed: the head, `len` bytes of `body` unless the status has
   * none, the end. What the output cannot take waits in the request's
   * `pending` for `H1_WRITE`.
   */
  send(s: i32, gen: i32, status: i32, names: u8[][], values: u8[][], body: u8[], len: i32): void {
    if (!this.live(s, gen)) {
      return
    }
    const conn: Http1Connection = this.server.connection(s)
    const bodiless: boolean = status === 204 || status === 304
    const sent: i32 = conn.respond(status, names, values, bodiless ? HTTP1_NO_BODY : len)
    if (sent === H1_AGAIN) {
      // The output still holds more of the answer before this one than a
      // head can fit behind: ending the connection is the one answer left.
      this.closeSlot(s)
      return
    }
    if (sent !== 0) {
      panic(
        `serve: the carrier refused the head (${sent}): a name or value that is not a token or field text`
      )
    }
    const r: HttpRequest = this.reqs[s]
    if (len > 0 && !bodiless) {
      const start: i32 = 0
      let taken: i32 = conn.write(body, start, len)
      if (taken === H1_AGAIN) {
        taken = 0
      } else if (taken < 0) {
        panic(`serve: the carrier refused the body (${taken})`)
      }
      if (taken < len) {
        const rest: i32 = len - taken
        if (toI32(r.pending.length) < rest) {
          r.pending = new Array<u8>(serveGrown(toI32(r.pending.length), rest))
        }
        copyBytes(r.pending, 0, body, taken, rest)
        r.pendingEnd = rest
      }
    }
    this.finish(r, conn)
    this.drive(s)
  }

  /** Writes what the answer still has pending and ends it; the exchange is over once both are done. */
  finish(r: HttpRequest, conn: Http1Connection): void {
    r.state = SERVE_FLUSHING
    const left: i32 = r.pendingEnd - r.pendingStart
    if (left > 0) {
      const taken: i32 = conn.write(r.pending, r.pendingStart, left)
      if (taken > 0) {
        r.pendingStart += taken
      }
      if (r.pendingStart < r.pendingEnd) {
        return
      }
      r.pendingStart = 0
      r.pendingEnd = 0
    }
    // `H1_AGAIN`: no room for the end yet; `H1_WRITE` comes back here.
    if (conn.end() !== H1_AGAIN) {
      r.state = SERVE_IDLE
    }
  }

  /** Answers slot `s`'s exchange at `gen` with 404, or 405 and the methods its path has. */
  refuse(s: i32, gen: i32): void {
    if (!this.live(s, gen)) {
      return
    }
    const r: HttpRequest = this.reqs[s]
    if (r.route === ROUTER_METHOD_NOT_ALLOWED) {
      this.allowValues[1] = this.allowFor(r)
      this.send(
        s,
        gen,
        toI32(405),
        this.allowNames,
        this.allowValues,
        this.notAllowed,
        toI32(this.notAllowed.length)
      )
      return
    }
    this.send(
      s,
      gen,
      toI32(404),
      this.problemNames,
      this.problemValues,
      this.notFound,
      toI32(this.notFound.length)
    )
  }

  /** Answers slot `s`'s exchange at `gen` with the problem body `body` as `status`. */
  problem(s: i32, gen: i32, status: i32, body: u8[]): void {
    this.send(s, gen, status, this.problemNames, this.problemValues, body, toI32(body.length))
  }

  /** The `allow` value for `r`'s path: the methods with a route for it, and HEAD where GET has one. */
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
        get = get || serveSpanIs(router.methodBytes, start, end, "GET")
        head = head || serveSpanIs(router.methodBytes, start, end, "HEAD")
        serveAllowAppend(value, router.methodBytes, start, end)
      }
    }
    if (get && !head) {
      const name: u8[] = serveBytes("HEAD")
      serveAllowAppend(value, name, 0, toI32(name.length))
    }
    this.allowMasks.push(mask)
    this.allowBytes.push(value)
    return value
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
  const c: ServeConns = new ServeConns(limits, listener, router)
  const st: ServeState = new ServeState()
  st.deadline = limits.deadline
  serveFields(st, limits.server)
  const fds: i32[] = [0, 0]
  const made: i32 = unixSocketPair(NET_UNIX_STREAM, fds)
  if (made < 0) {
    panic(`serve: the wake socket could not be made: ${made}`)
  }
  st.wakeFd = fds[1]
  pollAdd(c.loop, fds[0], H1_WANT_READ, SERVE_WAKE)
  const drained: u8[] = new Array<u8>(64)
  spawn(serveTick(st))
  let draining: boolean = false
  while (true) {
    st.awake = true
    if (c.turn()) {
      st.signalled = false
      while (netRead(fds[0], drained, 0, 64) > 0) {
        // Each read takes up to 64 wake bytes; the loop empties the socket.
      }
    }
    // Each pass answers what the tasks wrote and takes what the connections
    // queued: a pipelined request is queued once the one before it is
    // answered, so a burst on a connection is taken and answered in request
    // order within this turn, and the answers are sent together.
    let moved: boolean = true
    while (moved || st.fresh) {
      moved = false
      st.fresh = false
      // A task appends its slot as it answers; none runs while the loop
      // does, so the list is read whole and emptied.
      for (let i: i32 = 0; i < st.finishedCount && i < toI32(st.finished.length); i++) {
        const k: i32 = st.finished[i]
        serveAnswer(c, st, k, stats)
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
      while (c.ready()) {
        const s: i32 = c.take()
        const k: i32 = serveFreeSlot(st, limits)
        moved = true
        if (k < 0) {
          c.problem(s, c.reqs[s].gen, 503, c.unavailable)
          stats.busy += 1
          stats.answered += 1
          continue
        }
        st.reqs[k] = c.reqs[s]
        st.slots[k] = s
        st.gens[k] = c.reqs[s].gen
        st.busy[k] = true
        st.done[k] = false
        st.cancelled[k] = false
        st.tasks[k] = 0
        if (!st.listed[k]) {
          st.listed[k] = true
          st.running[st.runningCount] = k
          st.runningCount += 1
        }
        spawn(serveTask(handle, st, k))
      }
    }
    // A task still running whose client hung up, or any once the server is
    // stopping: nobody waits for its answer, so it is told to stop waiting
    // too. The answered ones leave the list here.
    let kept: i32 = 0
    for (let i: i32 = 0; i < st.runningCount && i < toI32(st.running.length); i++) {
      const k: i32 = st.running[i]
      if (st.busy[k] && !st.done[k]) {
        if (st.stopping || c.hungUp(st.slots[k], st.gens[k])) {
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
    c.flush()
    stats.sends = c.sent
    stats.slots = toI32(st.busy.length)
    if (stats.warmAfter > 0 && stats.usedWarm === 0 && stats.answered >= stats.warmAfter) {
      stats.usedWarm = Arena.used()
    }
    if (!draining && limits.maxRequests > 0 && stats.answered >= limits.maxRequests) {
      draining = true
      stats.usedEnd = Arena.used()
      c.drain()
      st.stopping = true
      for (let k: i32 = 0; k < toI32(st.busy.length); k++) {
        if (st.busy[k] && !st.done[k]) {
          serveCancel(st, k)
        }
      }
    }
    if (draining && c.server.busy() === 0 && !serveAnyBusy(st)) {
      break
    }
    if (c.ready()) {
      // A send let a parked request in: take it before parking.
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
