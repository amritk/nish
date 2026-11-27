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
 *     const handle = async (req: Request): Promise<Response> => {
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
 *     export const main = async (): Promise<i32> => {
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
 * task's allocations — the `Request` it reads through, the response it
 * builds, whatever `handle` makes on the way — live in the task's region and
 * go when it ends.
 *
 * **The task reads the request in place.** Until it is answered, a request's
 * head is the connection parser's own buffer, and the task reads it, its
 * spans and its body where the server parsed them, with no copy: the record
 * is lent to the task (`lend` of `nish:async`), which the compiler holds to
 * reading it and writing numbers into it (NL2822). A connection that closes
 * while the task runs leaves the buffers to the record until the task ends,
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
import { cancel, cancelAfter, lend, readable, sleep, spawn, taskId } from "nish:async"
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
// A poll reports 256 sockets at most, and `readyFds` holds two slots for each:
// 512. The turn loop bounds `k` by 256 directly, so the prover sees `k + k` fit.
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
// A connection slot's exchange state, `ServeExchange.state`: these SERVE_*
// numbers are not `HttpHandler`'s HANDLER_* ones (its FLUSHING is 6, and
// `serve` has no STREAMING), and `serve` does not keep them in
// `HttpRequest.state`, since a slot holds no record between exchanges.
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
  /**
   * Answers that failed: one a task wrote that broke a cap or a rule, or a
   * request the server could not hand a task, answered 500 instead before
   * its head; and one whose head or body the carrier refused, whose
   * connection is closed with it unfinished.
   */
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
 * A request, as `handle` reads it: the server's parsed record, read in place
 * (`lend` of `nish:async`), its head and body valid for as long as the task
 * runs. Copy out what must outlive the task.
 */
export class Request {
  /** The index `Router.add` answered for the route, or a negative `ROUTER_*` code. */
  route: i32 = 0
  /** The request as the server parsed it, lent to the task: its spans, its head and its body. */
  raw: HttpRequest

  /**
   * A request over `raw`, which it keeps.
   * @param raw the parsed request, lent to the task for as long as it runs
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
    return this.paramText(k, serveSpanBuffer(this.raw.paramStart(k), this.raw.paramEnd(k)))
  }

  /**
   * Route parameter `k`, percent-decoded, as `param` reads it, or an error
   * naming the parameter the route does not have.
   * @param k the parameter's position in the route pattern, from 0
   * @returns `Ok` with the decoded value, or an empty string when it holds a malformed escape; `Err` when the route has no parameter `k`
   */
  tryParam(k: i32): Result<string, string> {
    const out: Result<u8[], string> = this.paramBuffer(k)
    if (out.isErr()) {
      return Err(out.error)
    }
    return Ok(this.paramText(k, out.value))
  }

  /** Route parameter `k` decoded into `out`, which holds its raw bytes, as text; empty for a malformed escape. */
  private paramText(k: i32, out: u8[]): string {
    const n: i32 = this.raw.param(k, out)
    return n < 0 ? "" : String.fromBytes(out, 0, n)
  }

  /**
   * Route parameter `k` read as a decimal number, as `paramNumber` reads it,
   * or an error naming the parameter the route does not have.
   * @param k the parameter's position in the route pattern, from 0
   * @returns `Ok` with the number, or -1 when it is empty, holds a non-digit or overflows; `Err` when the route has no parameter `k`
   */
  tryParamNumber(k: i32): Result<i32, string> {
    return this.raw.tryParamDecimal(k)
  }

  /**
   * Whether route parameter `k` holds a malformed percent escape, as
   * `paramMalformed` answers it, or an error naming the parameter the route
   * does not have.
   * @param k the parameter's position in the route pattern, from 0
   * @returns `Ok` with true when decoding the parameter fails; `Err` when the route has no parameter `k`
   */
  tryParamMalformed(k: i32): Result<boolean, string> {
    const out: Result<u8[], string> = this.paramBuffer(k)
    if (out.isErr()) {
      return Err(out.error)
    }
    return Ok(this.raw.param(k, out.value) === ROUTER_BAD_ESCAPE)
  }

  /** A buffer as long as route parameter `k`'s raw bytes, which its decoding never outgrows; `Err` when the route has no parameter `k`. */
  private paramBuffer(k: i32): Result<u8[], string> {
    const start: Result<i32, string> = this.raw.tryParamStart(k)
    if (start.isErr()) {
      return Err(start.error)
    }
    const end: Result<i32, string> = this.raw.tryParamEnd(k)
    if (end.isErr()) {
      return Err(end.error)
    }
    return Ok(serveSpanBuffer(start.value, end.value))
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
    const out: u8[] = serveSpanBuffer(this.raw.paramStart(k), this.raw.paramEnd(k))
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
    const out: u8[] = serveSpanBuffer(this.raw.queryValueStart, this.raw.queryValueEnd)
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
    const set: Result<Response, string> = this.tryBytes(type, buf, off, len)
    if (set.isErr()) {
      panic(set.error)
    }
    return this
  }

  /**
   * Sets a body of bytes with a content type, as `bytes` does, or an error
   * when the window lies outside `buf`; nothing is set on an error.
   * @param type the `Content-Type` value
   * @param buf the buffer holding the body, kept by the response
   * @param off where the body starts in `buf`
   * @param len how many body bytes there are
   * @returns `Ok` with this response, for a chain, or `Err` when `[off, off + len)` is not inside `buf`
   */
  tryBytes(type: string, buf: u8[], off: i32, len: i32): Result<Response, string> {
    // In i64, where two i32s cannot overflow.
    const end: i64 = toI64(off) + toI64(len)
    if (off < 0 || len < 0 || end > toI64(buf.length)) {
      return Err(`Response.bytes: [${off}, ${end}) is outside a buffer of ${buf.length}`)
    }
    this.type = type
    if (off === 0) {
      this.body = buf
    } else {
      const copy: u8[] = serveSpanBuffer(0, len)
      copyBytes(copy, 0, buf, off, len)
      this.body = copy
    }
    this.length = len
    return Ok(this)
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
  /** The request each slot holds: its connection's own parser state, lent to the task (`lend`) until the loop takes it back. */
  reqs: HttpRequest[]
  /**
   * Per slot: the head and spans its connection's parser takes if the
   * connection restarts while the slot's task still reads the old ones in
   * place. Empty at first; then what an earlier such task was left with.
   */
  spareHeads: u8[][]
  spareSpans: i32[][]
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
    this.spareHeads = []
    this.spareSpans = []
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

/**
 * The last freed slot, making one when every slot is busy and `inFlight`
 * allows; -1 when none. A slot made here starts on `rec`, the record its
 * first request is read from, which the caller sets again for each one.
 */
const serveFreeSlot = (st: ServeState, limits: ServeLimits, rec: HttpRequest): i32 => {
  const free: i32[] = st.free
  const top: i32 = st.freeCount
  if (top > 0 && top <= toI32(free.length)) {
    st.freeCount = top - 1
    return free[top - 1]
  }
  const n: i32 = toI32(st.busy.length)
  if (n >= limits.inFlight) {
    return -1
  }
  st.reqs.push(rec)
  st.spareHeads.push(new Array<u8>(0))
  st.spareSpans.push(new Array<i32>(0))
  st.slots.push(toI32(0))
  st.gens.push(toI32(0))
  st.busy.push(false)
  st.done.push(false)
  st.tasks.push(toI64(0))
  st.cancelled.push(false)
  st.status.push(toI32(0))
  st.lengths.push(toI32(0))
  st.bodies.push(serveU8s(limits.responseBytes))
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
  const cancelled: boolean[] = st.cancelled
  const tasks: i64[] = st.tasks
  if (k < 0 || k >= toI32(cancelled.length) || k >= toI32(tasks.length)) {
    return
  }
  const task: i64 = tasks[k]
  if (!cancelled[k] && task !== 0) {
    cancelled[k] = true
    cancel(task)
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

/** Sends slot `k`'s answer, as its task wrote it; one it cannot send is counted in `stats.failed`. */
const serveAnswer = (c: ServeConns, st: ServeState, k: i32, stats: ServeStats): void => {
  // Every per-slot array grows together in `serveFreeSlot`, so `k`, a slot
  // that array made, is inside each; the reads take them as locals to see it.
  const slots: i32[] = st.slots
  const gens: i32[] = st.gens
  const statuses: i32[] = st.status
  const lengths: i32[] = st.lengths
  const typeLengths: i32[] = st.typeLengths
  const typeIndex: i32[] = st.typeIndex
  const bodies: u8[][] = st.bodies
  const types: u8[][] = st.types
  if (
    k < 0 ||
    k >= toI32(slots.length) ||
    k >= toI32(gens.length) ||
    k >= toI32(statuses.length) ||
    k >= toI32(lengths.length) ||
    k >= toI32(typeLengths.length) ||
    k >= toI32(typeIndex.length) ||
    k >= toI32(bodies.length) ||
    k >= toI32(types.length)
  ) {
    // `k` is no slot `serveFreeSlot` made, so it names no connection to
    // answer: the answer is lost, and counted failed like one that cannot
    // be framed below.
    serveCountFailed(stats)
    return
  }
  const s: i32 = slots[k]
  const gen: i32 = gens[k]
  const status: i32 = statuses[k]
  if (status === SERVE_REFUSE) {
    c.refuse(s, gen)
    return
  }
  const length: i32 = lengths[k]
  const typeLength: i32 = typeLengths[k]
  if (status < 200 || status > 599 || length < 0 || typeLength < 0) {
    serveCountFailed(stats)
    c.problem(s, gen, SERVE_FAILED, c.failed)
    return
  }
  if (typeLength === 0) {
    if (!c.send(s, gen, status, st.plainNames, st.plainValues, bodies[k], length)) {
      serveCountFailed(stats)
    }
    return
  }
  const body: u8[] = bodies[k]
  const known: i32 = typeIndex[k]
  const type: i32 = known >= 0 ? known : serveType(st, types[k], typeLength)
  const typeBytes: u8[][] = st.typeBytes
  const typedValues: u8[][] = st.typedValues
  const last: i32 = toI32(typedValues.length) - 1
  if (type < 0 || type >= toI32(typeBytes.length) || last < 0) {
    serveCountFailed(stats)
    c.problem(s, gen, SERVE_FAILED, c.failed)
    return
  }
  typedValues[last] = typeBytes[type]
  if (!c.send(s, gen, status, st.typedNames, typedValues, body, length)) {
    serveCountFailed(stats)
  }
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
  // which `ServeConns.send` answers by closing the connection unanswered.
  for (let j: i32 = 0; j < len && j < toI32(type.length); j++) {
    if ((type[j] < 32 && type[j] !== 9) || type[j] === 127) {
      return -1
    }
  }
  const copy: u8[] = serveU8s(len)
  for (let j: i32 = 0; j < toI32(copy.length) && j < toI32(type.length); j++) {
    copy[j] = type[j]
  }
  cache.push(copy)
  st.typeTexts.push(String.fromBytes(copy, 0, len))
  return toI32(cache.length) - 1
}

/** A buffer as long as `[start, end)`, empty when `end` is not past `start`: the room a span's decoding never outgrows. */
const serveSpanBuffer = (start: i32, end: i32): u8[] => {
  // In i64, where two i32s cannot overflow.
  const n: i64 = toI64(end) - toI64(start)
  if (n <= 0 || n > toI64(I32_MOST)) {
    return new Array<u8>(0)
  }
  return serveU8s(toI32(n))
}

/** The most an `i32` holds. */
const I32_MOST: i32 = 2147483647

/** `2 * maxParams + 2` slots for a router's spans, for a `maxParams` the router took (0 to 256). */
const serveParamSlots = (maxParams: i32): i32 => {
  if (maxParams < 0 || maxParams > 65535) {
    return 2
  }
  return 2 * maxParams + 2
}

/** `x`, or 2^63 - 1 where `x` is larger: the most an `i64` holds. */
const serveBelow2p63 = (x: u64): u64 => {
  const most: u64 = (toU64(1) << toU64(63)) - toU64(1)
  return x > most ? most : x
}

/** A zeroed array of `n` bytes, empty when `n` is not positive. */
const serveU8s = (n: i32): u8[] => {
  if (n <= 0) {
    return new Array<u8>(0)
  }
  // The guard rules out a negative length, but the check is the length's
  // type's (an `i32`), not a guard's: this one site keeps it.
  return new Array<u8>(n)
}

/** A zeroed array of `n` integers, empty when `n` is not positive. */
const serveI32s = (n: i32): i32[] => {
  if (n <= 0) {
    return new Array<i32>(0)
  }
  // The guard rules out a negative length, but the check is the length's
  // type's (an `i32`), not a guard's: this one site keeps it.
  return new Array<i32>(n)
}

/** An array of `n` falses, empty when `n` is not positive. */
const serveFlags = (n: i32): boolean[] => {
  if (n <= 0) {
    return new Array<boolean>(0)
  }
  // The guard rules out a negative length, but the check is the length's
  // type's (an `i32`), not a guard's: this one site keeps it.
  return new Array<boolean>(n)
}

/** A string's bytes: native strings are UTF-8, so its code units are its bytes. */
const serveBytes = (s: string): u8[] => {
  const out: u8[] = serveU8s(toI32(s.length))
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(s.length); i++) {
    out[i] = toU8(s.charCodeAt(i))
  }
  return out
}

/** One request's task: runs `handle` on the record it reads in place, writes the answer into slot `k` and wakes the loop. */
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
  const res: Response = await handle(new Request(lend(st.reqs[k])))
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
  const end: i32 = w.end
  const out: u8[] = serveU8s(end)
  copyBytes(out, 0, buf, 0, toI32(out.length))
  return out
}

/** Counts one failed answer in `stats`, holding at the largest `i32` rather than wrapping. */
const serveCountFailed = (stats: ServeStats): void => {
  const failed: i32 = stats.failed
  if (failed < 2147483647) {
    stats.failed = failed + 1
  }
}

/** Whether `bytes[start .. end)` is the ASCII text `text`. */
const serveSpanIs = (bytes: u8[], start: i32, end: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (
    start < 0 ||
    start > 1073741823 ||
    n > 1073741823 ||
    end > toI32(bytes.length) ||
    toI64(end) - toI64(start) !== toI64(n)
  ) {
    return false
  }
  for (let k: i32 = 0; k < n && k <= 1073741823; k++) {
    const at: i32 = start + k
    if (at < 0 || at >= toI32(bytes.length) || toI32(bytes[at]) !== toI32(text.charCodeAt(k))) {
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
  while (size < need) {
    // `size` starts at 64 and only doubles, so the low test never holds.
    if (size < 0 || size > 1073741823) {
      break
    }
    size = size * 2
  }
  return size < need ? need : size
}

/** One slot's exchange: what it needs after its task's spawn, and its record until then. */
class ServeExchange {
  /** The slot's connection as of its last drive: the carrier lends one to a busy slot, so `driveOn` sets it again. */
  conn: Http1Connection
  /** The record, from the head's parse to the task's spawn (`lendOut`); `ServeConns.none` otherwise. */
  rec: HttpRequest
  /** What the output had no room for yet, `pending[pendingStart .. pendingEnd)`; `noBytes` until the slot needs its own. */
  pending: u8[]
  /** One of the SERVE_* states; 0 is `SERVE_IDLE`. */
  state: i32 = 0
  /** The route `begin` matched: what `refuse` answers from once the record is given back. */
  route: i32 = 0
  pendingStart: i32 = 0
  pendingEnd: i32 = 0
  /** Whether `rec` is this exchange's, not `none`. */
  holds: boolean = false

  constructor(conn: Http1Connection, none: HttpRequest, noBytes: u8[]) {
    this.conn = conn
    this.rec = none
    this.pending = noBytes
  }
}

/**
 * The connections: an `Http1Server` driven straight from the loop. A slot
 * holds an `HttpRequest` record only from the head's parse to its task's
 * spawn: `begin` takes a spare one (building one only when every built
 * record is held), `lendOut` hands it to the task, which reads it in place,
 * and `giveBack` takes it back once the task ends; a 503, or a connection
 * closed first, gives it back at once. The record's head and spans are the
 * parser's own: the parser keeps them until the exchange's answer is sent,
 * and a connection that restarts while the task runs leaves them to the
 * record and takes the slot's spares instead (`lendParsed`). What an
 * exchange needs past the spawn — its state, its route for a 404 or 405, the answer's pending bytes — is
 * the slot's own, in a `ServeExchange`: a few dozen bytes, and the pending
 * array, which doubles from 64 bytes until it holds the most of an answer
 * the output could not take (under 2 × `responseBytes`, at most the power of
 * two at or above it) and is kept for the slot's next answer. An exchange
 * moves idle → reading → (parked →) queued → held → (flushing →) idle; a
 * slot whose connection closes goes idle and its generation moves on, so an
 * answer for it is dropped.
 */
class ServeConns {
  server: Http1Server
  router: Router
  /** The spare request records, `spare[0 .. spareCount)`, the last given back on top; every record built has a place here. */
  spare: HttpRequest[]
  /** Each slot's exchange, made (`growSlots`) as `acceptAll` first fills the slot. */
  ex: ServeExchange[]
  /** The record an exchange points at while it holds none; never read. */
  none: HttpRequest
  noBytes: u8[]
  /** Each slot's generation: moves on when its connection closes. */
  slotGen: i32[]
  /** Whether a slot holds a connection the loop accepted and has not forgotten. */
  open: boolean[]
  /** Whether a slot's send is owed, so it is listed in `owed` once. */
  owing: boolean[]
  /** The slots whose send waits for the end of the turn, `owed[0 .. owedCount)`. */
  owed: i32[]
  /**
   * The queued exchanges' slots, a ring from `queueStart`, and each one's
   * generation when queued. Its length stays a power of two, so a position
   * wraps with a mask.
   */
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
  /**
   * The ring's first slot. The ring's length is a power of two, so each step
   * is a sum worked in 64 bits and masked: wrapping and masking give the same
   * slot, and no step can overflow.
   */
  queueStart: i32 = 0
  queueCount: i32 = 0
  owedCount: i32 = 0
  spareCount: i32 = 0
  outputSize: i32 = 0
  /** The most slots the carrier hands out, `limits.connections`. */
  slotLimit: i32 = 0
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
    this.slotLimit = limits.connections
    this.spare = []
    this.ex = []
    this.none = new HttpRequest(-1)
    this.noBytes = []
    const slots: i32 = limits.connections
    this.slotGen = serveI32s(slots)
    this.open = serveFlags(slots)
    this.owing = serveFlags(slots)
    this.owed = serveI32s(slots)
    this.queue = new Array<i32>(16)
    this.queueGen = new Array<i32>(16)
    // Two per event, for the 256 one poll reports.
    this.readyFds = new Array<i32>(512)
    this.probe = serveI32s(serveParamSlots(router.maxParams))
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
    const ready: i32[] = this.readyFds
    // 256 events at most bound `k`, so `k + k` cannot overflow.
    for (let k: i32 = 0; k < n && k < 256; k++) {
      const at: i32 = k + k
      if (at < 0 || at >= toI32(ready.length) - 1) {
        break
      }
      const token: i32 = ready[at]
      const bits: i32 = ready[at + 1]
      if (token === SERVE_LISTENER) {
        this.acceptAll()
      } else if (token === SERVE_WAKE) {
        woken = true
      } else if (token >= 0 && this.server.holds(token)) {
        if ((bits & SERVE_READ_BITS) !== 0) {
          this.server.readable(token)
        } else {
          this.server.writable(token)
        }
        this.drive(token)
      }
    }
    if (this.server.expire(now) > 0) {
      // The carrier closed idle or late connections: forget them.
      const open: boolean[] = this.open
      for (let s: i32 = 0; s < toI32(open.length); s++) {
        if (open[s] && !this.server.holds(s)) {
          this.forget(s)
        }
      }
    }
    if (now >= this.bodyCheckAt) {
      this.bodyCheckAt = serveLater(now, SERVE_BODY_SWEEP)
      const open: boolean[] = this.open
      const ex: ServeExchange[] = this.ex
      for (let s: i32 = 0; s < toI32(open.length) && s < toI32(ex.length); s++) {
        const e: ServeExchange = ex[s]
        if (open[s] && e.state === SERVE_READING && e.holds) {
          if (serveSince(e.rec.since, now) > SERVE_BODY_TIMEOUT) {
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
    const open: boolean[] = this.open
    const ex: ServeExchange[] = this.ex
    for (let s: i32 = 0; s < toI32(open.length) && s < toI32(ex.length); s++) {
      const e: ServeExchange = ex[s]
      if (open[s] && this.server.holds(s)) {
        if (e.state === SERVE_IDLE && !e.conn.wantsWrite()) {
          this.closeSlot(s)
        } else {
          e.conn.closeAfter = true
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
        // so a slot's entries are made on its first connection: a server
        // sized for many connections pays for the ones it has had.
        if (slot >= toI32(this.ex.length)) {
          this.growSlots(slot)
        }
        // The carrier hands out fewer slots than `open` has, and `growSlots`
        // covers `slot`: anything else is a slot it cannot serve.
        const open: boolean[] = this.open
        const ex: ServeExchange[] = this.ex
        if (slot < toI32(open.length) && slot < toI32(ex.length)) {
          open[slot] = true
          const e: ServeExchange = ex[slot]
          e.state = SERVE_IDLE
          pollAdd(this.loop, this.server.fd(slot), H1_WANT_READ, slot)
        } else {
          this.server.close(slot)
        }
      }
      slot = this.server.accept()
    }
    if (slot !== SERVE_ACCEPT_NONE) {
      pollRemove(this.loop, this.listener)
      this.acceptRestUntil = serveLater(monotonicNanos(), SERVE_ACCEPT_REST)
    }
  }

  /** Sends what each slot owes, once per turn. */
  flush(): void {
    const n: i32 = this.owedCount
    this.owedCount = 0
    const owed: i32[] = this.owed
    for (let k: i32 = 0; k < n && k < toI32(owed.length); k++) {
      const slot: i32 = owed[k]
      const owing: boolean[] = this.owing
      if (slot >= 0 && slot < toI32(owing.length)) {
        owing[slot] = false
      }
      const open: boolean[] = this.open
      if (slot >= 0 && slot < toI32(open.length) && open[slot] && this.server.holds(slot)) {
        const ex: ServeExchange[] = this.ex
        if (slot < toI32(ex.length)) {
          this.settle(slot, ex[slot].conn)
        }
      }
    }
  }

  /** Runs slot `s`'s events until it needs bytes, then owes or makes its send. */
  drive(s: i32): void {
    const ex: ServeExchange[] = this.ex
    if (s >= 0 && s < toI32(ex.length)) {
      this.driveOn(s, ex[s])
    }
  }

  /** `drive` for a caller that holds slot `s`'s exchange `e`. */
  driveOn(s: i32, e: ServeExchange): void {
    // A slot's connection is lent to it while it is busy and given back when
    // it rests, so the exchange takes the one it holds now.
    const conn: Http1Connection = this.server.connection(s)
    e.conn = conn
    let event: i32 = this.server.next(s)
    while (event !== H1_NEED_MORE && event !== H1_ERROR) {
      if (event === H1_REQUEST) {
        this.begin(s, conn)
      } else if (event === H1_BODY && e.state === SERVE_READING && e.holds) {
        const r: HttpRequest = e.rec
        const n: i32 = conn.dataLength
        const sum: i64 = toI64(r.bodyLength) + toI64(n)
        if (sum > toI64(I32_MOST)) {
          // The carrier caps a body at `limits.bodyBytes`, an `i32`.
          this.closeSlot(s)
          return
        }
        const need: i32 = toI32(sum)
        if (toI32(r.body.length) < need) {
          const grown: u8[] = serveU8s(serveGrown(toI32(r.body.length), need))
          copyBytes(grown, 0, r.body, 0, r.bodyLength)
          r.body = grown
        }
        copyBytes(r.body, r.bodyLength, conn.data, conn.dataStart, n)
        r.bodyLength = need
      } else if (event === H1_END && e.state === SERVE_READING) {
        if (this.roomy(conn)) {
          this.enqueue(s)
        } else {
          e.state = SERVE_PARKED
        }
      } else if (event === H1_WRITE && e.state === SERVE_FLUSHING) {
        this.finish(e)
      }
      event = this.server.next(s)
    }
    if (event === H1_ERROR) {
      // The carrier has written its refusal and ends the connection.
      if (e.state === SERVE_READING) {
        e.state = SERVE_IDLE
        this.release(s)
      }
    } else if (
      !this.draining &&
      conn.wantsWrite() &&
      !conn.writeHeld &&
      this.roomy(conn) &&
      e.state !== SERVE_PARKED
    ) {
      // The send waits for the turn's end, to go out with the answers after it.
      const owing: boolean[] = this.owing
      const owed: i32[] = this.owed
      const at: i32 = this.owedCount
      if (s >= 0 && s < toI32(owing.length) && owing[s]) {
        return
      }
      // A slot is owed once, so `owed` has room for every slot `owing` has.
      if (s >= 0 && s < toI32(owing.length) && at >= 0 && at < toI32(owed.length)) {
        owing[s] = true
        owed[at] = s
        this.owedCount = at + 1
        return
      }
    }
    this.settle(s, conn)
  }

  /** Sends slot `s`'s output and rearms it; a parked exchange is queued once there is room. */
  settle(s: i32, conn: Http1Connection): void {
    if (conn.wantsWrite()) {
      this.sent = serveLater(this.sent, toI64(1))
    }
    const wants: i32 = this.server.flush(s)
    const ex: ServeExchange[] = this.ex
    if (s < 0 || s >= toI32(ex.length)) {
      return
    }
    const e: ServeExchange = ex[s]
    if ((wants & H1_DONE) !== 0) {
      this.closeSlot(s)
      return
    }
    if (this.draining && e.state === SERVE_IDLE && !conn.wantsWrite()) {
      this.closeSlot(s)
      return
    }
    if (this.server.rearm(s, wants)) {
      pollModify(this.loop, this.server.fd(s), wants & (H1_WANT_READ | H1_WANT_WRITE), s)
    }
    if (e.state === SERVE_PARKED && this.roomy(conn)) {
      this.enqueue(s)
    }
  }

  /** Whether the output is at most half full: room for an answer's head behind what is there. */
  roomy(conn: Http1Connection): boolean {
    return toI64(conn.outputEnd) - toI64(conn.outputStart) <= toI64(this.outputSize) / toI64(2)
  }

  /**
   * Grows the per-slot arrays to cover `slot`: doubling from 64 slots while
   * few are used, then straight to `slotLimit`. The arena keeps every
   * outgrown array, so doubling all the way would leave as much again behind.
   * A server sized for many connections pays for the ones it has had.
   */
  growSlots(slot: i32): void {
    // An exchange's connection is set each time its slot is driven; until
    // then it names the pool's first, which this does not lend the slot.
    const conn: Http1Connection = this.server.connection(toI32(-1))
    const have: i32 = toI32(this.ex.length)
    let n: i32 = this.slotLimit
    if (have <= 512) {
      n = have < 32 ? 64 : have + have
      if (n > this.slotLimit) {
        n = this.slotLimit
      }
    }
    if (n <= slot && slot < 2147483647) {
      n = slot + 1
    }
    while (toI32(this.ex.length) < n) {
      this.ex.push(new ServeExchange(conn, this.none, this.noBytes))
    }
  }

  /** Takes a spare record, building one only when every built record is held. */
  acquire(): HttpRequest {
    const spare: HttpRequest[] = this.spare
    const top: i32 = this.spareCount
    if (top > 0 && top <= toI32(spare.length)) {
      this.spareCount = top - 1
      return spare[top - 1]
    }
    const r: HttpRequest = new HttpRequest(-1)
    r.params = serveI32s(serveParamSlots(this.router.maxParams))
    spare.push(r)
    this.spareCount = 0
    return r
  }

  /** Keeps `r` as a spare for `acquire`. */
  keepSpare(r: HttpRequest): void {
    const spare: HttpRequest[] = this.spare
    const at: i32 = this.spareCount
    // Every record was made by `acquire`, which keeps it in `spare`, so the
    // ones given back fit: the push only covers a count that went wrong.
    if (at >= 0 && at < toI32(spare.length)) {
      spare[at] = r
      this.spareCount = at + 1
    } else {
      spare.push(r)
      this.spareCount = toI32(spare.length)
    }
  }

  /** Gives slot `s`'s record back, if it holds one: nobody will read it. */
  release(s: i32): void {
    const ex: ServeExchange[] = this.ex
    if (s < 0 || s >= toI32(ex.length)) {
      return
    }
    const e: ServeExchange = ex[s]
    if (e.holds) {
      e.holds = false
      this.keepSpare(e.rec)
      e.rec = this.none
    }
  }

  /**
   * Hands slot `s`'s record to a task that reads it in place: the slot holds
   * it no more, and its connection lends the parser's head and spans, which
   * the record points at, until `giveBack`. A restart meanwhile takes `head`
   * and `spans` for the next peer and leaves the record its own.
   *
   * @returns the record, or null when `s` is no slot or holds no record:
   *   `take` gives only a slot `begin` routed, so null is this module's own
   *   fault, and the caller answers it 500
   */
  lendOut(s: i32, head: u8[], spans: i32[]): HttpRequest | null {
    const ex: ServeExchange[] = this.ex
    if (s < 0 || s >= toI32(ex.length)) {
      return null
    }
    const e: ServeExchange = ex[s]
    if (!e.holds) {
      return null
    }
    const r: HttpRequest = e.rec
    e.holds = false
    e.rec = this.none
    e.conn.lendParsed(head, spans)
    return r
  }

  /**
   * Takes back record `r` that `lendOut` gave for slot `s` at generation
   * `gen`, once its task has ended, into the spares.
   *
   * @returns true when the connection restarted meanwhile: `r`'s head and spans are then nobody else's, the spares for the next `lendOut`
   */
  giveBack(r: HttpRequest, s: i32, gen: i32): boolean {
    this.keepSpare(r)
    if (!this.live(s, gen)) {
      return true
    }
    const ex: ServeExchange[] = this.ex
    return s < 0 || s >= toI32(ex.length) || !ex[s].conn.unlendParsed()
  }

  /** Points a record for slot `s` at the head the parser read, and routes it. */
  begin(s: i32, conn: Http1Connection): void {
    if (this.draining) {
      // A head read during the drain is the connection's last.
      conn.closeAfter = true
    }
    // `s` is a slot the server made, inside both per-slot arrays; a slot
    // outside them holds no connection, so there is nothing to route.
    const ex: ServeExchange[] = this.ex
    const gens: i32[] = this.slotGen
    if (s < 0 || s >= toI32(ex.length) || s >= toI32(gens.length)) {
      return
    }
    // Read before `acquire`, a call after which the prover no longer knows `gens`'s length.
    const gen: i32 = gens[s]
    const e: ServeExchange = ex[s]
    if (!e.holds) {
      e.rec = this.acquire()
      e.holds = true
    }
    const r: HttpRequest = e.rec
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
    r.gen = gen
    r.since = this.turnAt
    e.state = SERVE_READING
    e.pendingStart = 0
    e.pendingEnd = 0
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
          r.params
        )
        if (viaGet >= 0) {
          route = viaGet
        }
      }
    }
    r.route = route
    e.route = route
    r.paramCount = route >= 0 ? router.paramCount(route) : 0
    // The router found where the path ends, before any query, as it matched.
    r.pathEnd = router.pathEnd
  }

  /** Queues slot `s`'s whole exchange for a task. */
  enqueue(s: i32): void {
    const ex: ServeExchange[] = this.ex
    const gens: i32[] = this.slotGen
    if (s < 0 || s >= toI32(ex.length) || s >= toI32(gens.length)) {
      return
    }
    ex[s].state = SERVE_QUEUED
    const gen: i32 = gens[s]
    const size: i32 = toI32(this.queue.length)
    if (this.queueCount >= size) {
      // The queue holds each slot once, so it never needs more than 2^30.
      if (size < 1 || size > 1073741823) {
        this.closeSlot(s)
        return
      }
      const queue: i32[] = this.queue
      const queueGen: i32[] = this.queueGen
      const grown: i32[] = serveI32s(size + size)
      const grownGen: i32[] = serveI32s(size + size)
      const start: i32 = this.queueStart
      for (let k: i32 = 0; k < size && k < toI32(grown.length) && k < toI32(grownGen.length); k++) {
        const from: i32 = toI32(toI64(start) + toI64(k)) & (size - 1)
        if (from >= 0 && from < toI32(queue.length) && from < toI32(queueGen.length)) {
          grown[k] = queue[from]
          grownGen[k] = queueGen[from]
        }
      }
      this.queue = grown
      this.queueGen = grownGen
      this.queueStart = 0
    }
    const queue: i32[] = this.queue
    const queueGen: i32[] = this.queueGen
    const count: i32 = this.queueCount
    const at: i32 = toI32(toI64(this.queueStart) + toI64(count)) & (toI32(queue.length) - 1)
    if (
      at >= 0 &&
      at < toI32(queue.length) &&
      at < toI32(queueGen.length) &&
      count >= 0 &&
      count < I32_MOST
    ) {
      queue[at] = s
      queueGen[at] = gen
      this.queueCount = count + 1
    }
  }

  /** Whether a queued exchange is ready, dropping those whose connection closed. */
  ready(): boolean {
    while (this.queueCount > 0) {
      const queue: i32[] = this.queue
      const queueGen: i32[] = this.queueGen
      const start: i32 = this.queueStart
      if (start < 0 || start >= toI32(queue.length) || start >= toI32(queueGen.length)) {
        return false
      }
      if (this.live(queue[start], queueGen[start])) {
        return true
      }
      this.queueStart = toI32(toI64(start) + toI64(1)) & (toI32(queue.length) - 1)
      const count: i32 = this.queueCount
      this.queueCount = count > 0 ? count - 1 : 0
    }
    return false
  }

  /**
   * The next queued exchange's slot, now held; call after `ready`.
   *
   * @returns the slot, or -1 when nothing is queued or the queue's next entry is no slot the server made; the caller stops taking then
   */
  take(): i32 {
    const queue: i32[] = this.queue
    const start: i32 = this.queueStart
    const count: i32 = this.queueCount
    if (count <= 0 || start < 0 || start >= toI32(queue.length)) {
      return -1
    }
    const s: i32 = queue[start]
    this.queueStart = toI32(toI64(start) + toI64(1)) & (toI32(queue.length) - 1)
    this.queueCount = count - 1
    const ex: ServeExchange[] = this.ex
    if (s < 0 || s >= toI32(ex.length)) {
      return -1
    }
    ex[s].state = SERVE_HELD
    return s
  }

  /** Whether slot `s` still holds the connection it had at generation `gen`. */
  live(s: i32, gen: i32): boolean {
    const gens: i32[] = this.slotGen
    return s >= 0 && s < toI32(gens.length) && gens[s] === gen && this.server.holds(s)
  }

  /** Whether nobody waits for the answer of slot `s`'s exchange at generation `gen`. */
  hungUp(s: i32, gen: i32): boolean {
    if (!this.live(s, gen)) {
      return true
    }
    const ex: ServeExchange[] = this.ex
    return s < 0 || s >= toI32(ex.length) || ex[s].conn.ended()
  }

  closeSlot(s: i32): void {
    this.server.close(s)
    this.forget(s)
  }

  /** Marks slot `s` closed: its exchange is nobody's and its generation moves on. */
  forget(s: i32): void {
    const open: boolean[] = this.open
    if (s >= 0 && s < toI32(open.length)) {
      open[s] = false
    }
    const gens: i32[] = this.slotGen
    if (s >= 0 && s < toI32(gens.length)) {
      const gen: i32 = gens[s]
      // A generation only tells this slot's turns apart, so after the largest it starts again at 0.
      if (gen < 2147483647) {
        gens[s] = gen + 1
      } else {
        gens[s] = 0
      }
    }
    const ex: ServeExchange[] = this.ex
    if (s >= 0 && s < toI32(ex.length)) {
      ex[s].state = SERVE_IDLE
    }
    this.release(s)
  }

  /**
   * Answers slot `s`'s held exchange at generation `gen`, unless its
   * connection closed: the head, `len` bytes of `body` unless the status has
   * none, the end. What the output cannot take waits in the slot's
   * `pending` for `H1_WRITE`. A head or body the carrier refuses (a head
   * larger than the output, say, from a long `ServeLimits.server`) cannot
   * be answered any more: the connection is closed, as when the output has
   * no room for the head.
   *
   * @returns false when the carrier refused the answer and the connection was closed
   */
  send(s: i32, gen: i32, status: i32, names: u8[][], values: u8[][], body: u8[], len: i32): boolean {
    const ex: ServeExchange[] = this.ex
    if (!this.live(s, gen) || s < 0 || s >= toI32(ex.length)) {
      return true
    }
    const e: ServeExchange = ex[s]
    const conn: Http1Connection = e.conn
    const bodiless: boolean = status === 204 || status === 304
    const sent: i32 = conn.respond(status, names, values, bodiless ? HTTP1_NO_BODY : len)
    if (sent === H1_AGAIN) {
      // The output still holds more of the answer before this one than a
      // head can fit behind: ending the connection is the one answer left.
      this.closeSlot(s)
      return true
    }
    if (sent !== 0) {
      this.closeSlot(s)
      return false
    }
    if (len > 0 && !bodiless) {
      const start: i32 = 0
      let taken: i32 = conn.write(body, start, len)
      if (taken === H1_AGAIN) {
        taken = 0
      } else if (taken < 0) {
        // The head is out: the rest of the answer cannot follow it.
        this.closeSlot(s)
        return false
      }
      if (taken < len) {
        const rest: i32 = len - taken
        if (toI32(e.pending.length) < rest) {
          e.pending = serveU8s(serveGrown(toI32(e.pending.length), rest))
        }
        copyBytes(e.pending, 0, body, taken, rest)
        e.pendingEnd = rest
      }
    }
    this.finish(e)
    this.driveOn(s, e)
    return true
  }

  /** Writes what the answer still has pending and ends it; the exchange is over once both are done. */
  finish(e: ServeExchange): void {
    const conn: Http1Connection = e.conn
    e.state = SERVE_FLUSHING
    const start: i32 = e.pendingStart
    const end: i32 = e.pendingEnd
    if (start >= 0 && end >= 0 && end > start) {
      const left: i32 = end - start
      const taken: i32 = conn.write(e.pending, start, left)
      let at: i32 = start
      if (taken > 0 && taken <= left && left >= 0) {
        // What is still unwritten; never negative, as `taken <= left`.
        const rest: i32 = left - taken
        if (rest >= 0) {
          at = end - rest
          e.pendingStart = at
        }
      }
      if (at < end) {
        return
      }
      e.pendingStart = 0
      e.pendingEnd = 0
    }
    // `H1_AGAIN`: no room for the end yet; `H1_WRITE` comes back here.
    if (conn.end() !== H1_AGAIN) {
      e.state = SERVE_IDLE
    }
  }

  /** Answers slot `s`'s exchange at `gen` with 404, or 405 and the methods its path has. */
  refuse(s: i32, gen: i32): void {
    const ex: ServeExchange[] = this.ex
    if (!this.live(s, gen) || s < 0 || s >= toI32(ex.length)) {
      return
    }
    const e: ServeExchange = ex[s]
    if (e.route === ROUTER_METHOD_NOT_ALLOWED) {
      // The parser still keeps this exchange's head: it reads the next only
      // once this one is answered.
      const p = e.conn.parser
      const allow: u8[] = this.allowFor(p.head, p.targetStart, p.targetEnd)
      // The constructor makes `allowValues` two long: content-type, allow.
      const values: u8[][] = this.allowValues
      if (toI32(values.length) > 1) {
        values[1] = allow
      }
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

  /** The `allow` value for the path `bytes[targetStart .. targetEnd)`: the methods with a route for it, and HEAD where GET has one. */
  allowFor(bytes: u8[], targetStart: i32, targetEnd: i32): u8[] {
    const router: Router = this.router
    const starts: i32[] = router.methodStart
    const ends: i32[] = router.methodEnd
    const methods: i32 = toI32(starts.length) < toI32(ends.length) ? toI32(starts.length) : toI32(ends.length)
    let mask: i64 = 0
    for (let m: i32 = 0; m < toI32(starts.length) && m < toI32(ends.length); m++) {
      const route: i32 = router.match(
        router.methodBytes,
        starts[m],
        ends[m],
        bytes,
        targetStart,
        targetEnd,
        this.probe
      )
      if (route >= 0) {
        mask = mask | (toI64(1) << toI64(m))
      }
    }
    const masks: i64[] = this.allowMasks
    const known: u8[][] = this.allowBytes
    for (let k: i32 = 0; k < toI32(masks.length) && k < toI32(known.length); k++) {
      if (masks[k] === mask) {
        return known[k]
      }
    }
    let get: boolean = false
    let head: boolean = false
    const value: u8[] = []
    for (let m: i32 = 0; m < methods && m < toI32(starts.length) && m < toI32(ends.length); m++) {
      if ((mask & (toI64(1) << toI64(m))) !== toI64(0)) {
        const start: i32 = starts[m]
        const end: i32 = ends[m]
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
    // order within this turn, and the answers are sent together. They carry
    // one clock reading as their `Date`, as a carrier's serve call does,
    // rather than one read per answer; it is let go once they are sent.
    c.server.date.hold()
    let moved: boolean = true
    while (moved || st.fresh) {
      moved = false
      st.fresh = false
      // A task appends its slot as it answers; none runs while the loop
      // does, so the list is read whole and emptied.
      for (let i: i32 = 0; i < st.finishedCount && i < toI32(st.finished.length); i++) {
        const k: i32 = st.finished[i]
        serveAnswer(c, st, k, stats)
        const r: HttpRequest = st.reqs[k]
        if (c.giveBack(r, st.slots[k], st.gens[k])) {
          st.spareHeads[k] = r.head
          st.spareSpans[k] = r.spans
        }
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
        if (s < 0) {
          break
        }
        // `lendOut` sets the slot's record for each request, the first too.
        const k: i32 = serveFreeSlot(st, limits, c.none)
        moved = true
        if (k < 0) {
          c.release(s)
          c.problem(s, c.slotGen[s], 503, c.unavailable)
          stats.busy += 1
          stats.answered += 1
          continue
        }
        const lent: HttpRequest | null = c.lendOut(s, st.spareHeads[k], st.spareSpans[k])
        if (lent === null) {
          // No record to hand a task: the slot goes back unused, and the
          // client gets a 500 rather than a task reading a record nobody made.
          const free: i32[] = st.free
          if (st.freeCount >= 0 && st.freeCount < toI32(free.length)) {
            free[st.freeCount] = k
            st.freeCount += 1
          }
          c.problem(s, c.slotGen[s], SERVE_FAILED, c.failed)
          serveCountFailed(stats)
          stats.answered += 1
          continue
        }
        st.reqs[k] = lent
        st.slots[k] = s
        st.gens[k] = c.slotGen[s]
        st.busy[k] = true
        st.done[k] = false
        st.cancelled[k] = false
        st.tasks[k] = 0
        if (!st.listed[k]) {
          st.listed[k] = true
          st.running[st.runningCount] = k
          st.runningCount += 1
        }
        // The task reads the record in place, and its connection's parser
        // head and spans with it: `giveBack` takes them back once it ends.
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
    c.server.date.unhold()
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

/**
 * `a + b` on a clock reading or a count, held at the `i64` range's ends where
 * the sum would leave it, which a clock centuries short of 2^63 never makes
 * it do. Two values of opposite signs add in `i64`, as they cannot leave the
 * range. Two of one sign add as magnitudes in `u64`, where they are below
 * 2^64 and so exact: a sum of values at least 0 is the `u64` sum, and a sum
 * of values below 0 is `-1 - ((-1 - a) + (-1 - b) + 1)`. Each magnitude is
 * held below 2^63 before it is read back as an `i64`, so the read is exact
 * too, and the bounds prover sees no sum that can overflow.
 */
const serveLater = (a: i64, b: i64): i64 => {
  if (a >= 0) {
    if (b < 0) {
      return a + b
    }
    const sum: u64 = toU64(a) + toU64(b)
    return toI64(serveBelow2p63(sum))
  }
  if (b >= 0) {
    return a + b
  }
  const past: u64 = toU64(-1 - a) + toU64(-1 - b) + toU64(1)
  const k: i64 = toI64(serveBelow2p63(past))
  if (k < 0) {
    // Not taken: `k` is below 2^63. The test is what proves `-1 - k` fits.
    return -1
  }
  return -1 - k
}

/**
 * How long from `from` to `to` on a clock reading: 0 when `to` is not after
 * it. Where the two have one sign the difference fits an `i64`; where `from`
 * is below 0 and `to` is not, it is the magnitudes' sum, taken in `u64` and
 * held below 2^63 as `serveLater` holds one.
 */
const serveSince = (from: i64, to: i64): i64 => {
  if (to <= from) {
    return 0
  }
  if (from >= 0) {
    if (to >= 0) {
      return to - from
    }
    // Not taken: `to` is after `from`, which is at least 0.
    return 0
  }
  if (to < 0) {
    return to - from
  }
  const sum: u64 = toU64(to) + toU64(-1 - from) + toU64(1)
  return toI64(serveBelow2p63(sum))
}
