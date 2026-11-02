// The load-test server for `nish/net/http1-server`, driven the way a program
// built on it is meant to be: through `nish/net/handler`'s `HttpHandler`, one
// readiness loop, one thread. `bench/http.mjs` pins it to one CPU and drives
// it with wrk; see bench/README.md, "HTTP". `bench/http-app-carrier.ts`
// answers the same contract by driving `Http1Server`'s events by hand, so
// that `bench/http.mjs`, given both builds, reads what the request and
// response layer costs over the carrier:
//
//   node bench/http.mjs handler=build/bench/h1 carrier=build/bench/h1-carrier
//
// Every request is routed by one `nish/net/router` table, built at start-up,
// and answered by a `switch` on the route it matched; a path that matches no
// route, or matches one only for another method, is a 404.
//
//   GET /plaintext  13 bytes of text/plain
//   GET /json       {"message":"Hello, World!","n":<requests so far>}, written
//                   by the handler's `JsonWriter`
//   POST /json-echo      an order (bench/http-payload.json) decoded by
//                        `jsonDecode` into one reused `Order`, its revision
//                        raised by one, and written back by `jsonEncode`
//   POST /json-echo-doc  the same answer for an order, through one reused
//                        `JsonDocument`: parse, `set` the revision, `write`.
//                        It is laxer than /json-echo: any object with an
//                        integer `revision` is echoed, where /json-echo
//                        answers 400 to anything that is not a whole order
//   GET /           `Hi`, the ping route
//   GET /id/:id?name=<name>  `<id> <name>` and an `x-powered-by: benchmark`
//                   field: the route's one parameter and one query parameter,
//                   read through `HttpRequest.queryIndex`, with no
//                   percent-decoding
//   POST /json      any JSON document (bench/http-body.json), parsed into the
//                   reused `JsonDocument` and written back compact
//   the extra routes  the 112 patterns of bench/http-twins/extra-routes.mjs
//                   (`bench/http-app-routes.ts`), `ok` to a GET of one and to
//                   a POST of one with `/submit` after it: every router twin
//                   registers them
//   the route table  bench/router.ts's 112 routes (`bench/http-app-routes.ts`),
//                   in this server only. Each answers `ok`, but
//                   GET /v1/orgs/:org/projects/:project/builds/:build/artifacts,
//                   the "deep-route" scenario, answers `<org> <project> <build>`.
//                   Its `GET /` is the ping route's, so it is left out
//
// The routes are added in that order, the real ones first. A request is
// answered once its body is whole; a body past 4 KiB is the carrier's to
// refuse, with `maxBody`: 413 before the body is read.
//
// Usage: http1-server <port> <slots> [requests]. It prints `listening <port>`
// once the handler is built and serves until it is killed, or until it has
// answered `requests` requests, when it returns from `main`: a profile-guided
// build writes its profile at a normal exit, never at a signal. With
// BENCH_CORES=N above 1 it runs as N workers under `nish/net/prefork` (see
// `main`), `requests` counted per worker.
//
// BENCH_QUICKACK, read once at start-up, sets TCP_QUICKACK the ways
// bench/quickack/ measures: `reset0` to 0 after each response, `once0` to 0
// once per connection, at its first request, `reset1` to 1 after each
// response. Unset, or any other value, the server makes no call at all.
import { JsonWriter } from "nish/json"
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed"
import { JsonDocument } from "nish/json-value"
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import {
  PREFORK_STOPPED,
  PreforkConfig,
  preforkArgs,
  preforkWith,
  preforkWorkerCount,
} from "nish/net/prefork"
import { Router, RouterLimits } from "nish/net/router"
import {
  netAddress,
  NET_TCP_QUICKACK,
  netClose,
  netSetOption,
  pollAdd,
  pollCreate,
  pollWait,
  tcpListenFlags,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net"
import { getenv } from "nish:process"
import { extraRoutes, routeTable } from "./http-app-routes"

const ZERO: i32 = 0
const OK: i32 = 200
const BAD_REQUEST: i32 = 400
const NOT_FOUND: i32 = 404
const TURN_MS: i32 = 1000
/** The largest request body an echo takes; one byte more is answered 413 by the carrier. */
const MAX_BODY: i32 = 4096
/** BENCH_QUICKACK's modes; see the header. */
const QUICKACK_NONE: i32 = 0
const QUICKACK_RESET0: i32 = 1
const QUICKACK_ONCE0: i32 = 2
const QUICKACK_RESET1: i32 = 3
/** The routes, in the order `Router.add` numbers them, as in `bench/http-app-carrier.ts`. */
const ROUTE_PLAINTEXT: i32 = 0
const ROUTE_JSON: i32 = 1
const ROUTE_ECHO: i32 = 2
const ROUTE_ECHO_DOC: i32 = 3
const ROUTE_PING: i32 = 4
const ROUTE_QUERY: i32 = 5
const ROUTE_BODY: i32 = 6
const ROUTE_EXTRA: i32 = 7
const ROUTE_TABLE: i32 = 231
const ROUTE_DEEP: i32 = 332
const ROUTE_COUNT: i32 = 342
const DEEP_PATTERN: string = "/v1/orgs/:org/projects/:project/builds/:build/artifacts"
/** The highest revision an echo raises; past it, an `i32` would overflow, which aborts. */
const LAST_REVISION: i32 = 2147483646

class Customer {
  // `i64`, not `i32`: `jsonEncode` writes the fields in this order, so they
  // cannot be sorted widest first, and an `i32` here would leave 8 bytes of padding.
  id: i64 = 0
  name: string = ""
  email: string = ""
  verified: boolean = false
}

class Item {
  sku: string = ""
  name: string = ""
  qty: i32 = 0
  // `f64` round-trips the payload's prices: `JsonWriter.f64` prints the
  // shortest digits that read back as the same double, as `String(v)` does.
  price: f64 = 0
}

class Shipping {
  method: string = ""
  street: string = ""
  city: string = ""
  region: string = ""
  postal: string = ""
}

/** The order `bench/http-payload.json` holds; `jsonEncode` writes it in this field order. */
class Order {
  id: i32 = 0
  revision: i32 = 0
  name: string = ""
  customer: Customer
  currency: string = ""
  total: f64 = 0
  items: Item[]
  tags: string[]
  shipping: Shipping
  notes: string | null = null
  paid: boolean = false
  constructor() {
    this.customer = new Customer()
    this.items = []
    this.tags = []
    this.shipping = new Shipping()
  }
}

const appBytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/** Adds one route, which must be numbered `route`: the `switch` in `answer` is written against the numbers. */
const appAdd = (router: Router, method: string, pattern: string, route: i32): void => {
  const got: i32 = router.add(method, pattern)
  if (got !== route) {
    panic(`http1-server: ${method} ${pattern} was answered ${got}, not route ${route}`)
  }
}

class AppBench {
  h: HttpHandler
  doc: JsonDocument
  order: Order
  decoder: JsonDecoder
  /** Each slot's connection generation BENCH_QUICKACK's `once0` last set; -1 before any. */
  seenGen: i32[]
  textNames: u8[][]
  textValues: u8[][]
  jsonNames: u8[][]
  jsonValues: u8[][]
  queryNames: u8[][]
  queryValues: u8[][]
  plainBody: u8[]
  hi: u8[]
  ok: u8[]
  notFound: u8[]
  badRequest: u8[]
  /** One response body assembled from spans of the request, for the query and deep routes. */
  out: u8[]
  requests: i32 = 0
  /** Return from `run` once this many requests are answered; 0 serves forever. */
  limit: i32 = 0
  /** BENCH_QUICKACK's `QUICKACK_*`, read once in `main`; 0 is `QUICKACK_NONE`. */
  quickack: i32 = 0

  constructor(listener: i32, slots: i32) {
    const limits: HandlerLimits = new HandlerLimits()
    limits.slots = slots
    limits.http.maxBody = MAX_BODY
    limits.maxEvents = 128
    const router: Router = new Router(new RouterLimits())
    appAdd(router, "GET", "/plaintext", ROUTE_PLAINTEXT)
    appAdd(router, "GET", "/json", ROUTE_JSON)
    appAdd(router, "POST", "/json-echo", ROUTE_ECHO)
    appAdd(router, "POST", "/json-echo-doc", ROUTE_ECHO_DOC)
    appAdd(router, "GET", "/", ROUTE_PING)
    appAdd(router, "GET", "/id/:id", ROUTE_QUERY)
    appAdd(router, "POST", "/json", ROUTE_BODY)
    let next: i32 = ROUTE_EXTRA
    for (const pattern of extraRoutes()) {
      appAdd(router, "GET", pattern, next)
      appAdd(router, "POST", `${pattern}/submit`, next + 1)
      next += 2
    }
    if (next !== ROUTE_TABLE) {
      panic(`http1-server: the extra routes end at ${next}, not ${ROUTE_TABLE}`)
    }
    const rows: string[] = routeTable()
    for (let r: i32 = 1; r < toI32(rows.length); r++) {
      const row: string = rows[r]
      const space: i32 = toI32(row.indexOf(" "))
      const pattern: string = row.slice(space + 1)
      if ((pattern === DEEP_PATTERN) !== (next === ROUTE_DEEP)) {
        panic(`http1-server: ${row} is route ${next}, and ROUTE_DEEP is ${ROUTE_DEEP}`)
      }
      appAdd(router, row.slice(0, space), pattern, next)
      next += 1
    }
    if (next !== ROUTE_COUNT) {
      panic(`http1-server: the route table ends at ${next}, not ${ROUTE_COUNT}`)
    }
    this.h = new HttpHandler(limits, listener, router)
    this.doc = new JsonDocument(new JsonLimits())
    this.order = new Order()
    this.decoder = new JsonDecoder(this.h.scratch, ZERO, ZERO, new JsonLimits())
    this.seenGen = new Array<i32>(slots)
    for (let k: i32 = 0; k < slots; k++) {
      this.seenGen[k] = -1
    }
    this.textNames = [appBytesOf("Server"), appBytesOf("Content-Type")]
    this.textValues = [appBytesOf("nish"), appBytesOf("text/plain")]
    this.jsonNames = [appBytesOf("Server"), appBytesOf("Content-Type")]
    this.jsonValues = [appBytesOf("nish"), appBytesOf("application/json")]
    this.queryNames = [appBytesOf("Server"), appBytesOf("Content-Type"), appBytesOf("x-powered-by")]
    this.queryValues = [appBytesOf("nish"), appBytesOf("text/plain"), appBytesOf("benchmark")]
    this.plainBody = appBytesOf("Hello, World!")
    this.hi = appBytesOf("Hi")
    this.ok = appBytesOf("ok")
    this.notFound = appBytesOf("not found")
    this.badRequest = appBytesOf("bad request")
    this.out = new Array<u8>(256)
  }

  text(r: HttpRequest, status: i32, body: u8[]): void {
    this.h.sendFields(r, status, this.textNames, this.textValues, body, ZERO, toI32(body.length))
  }

  /** Answers one whole request from its route. */
  answer(r: HttpRequest): void {
    this.requests = this.requests + 1
    switch (r.route) {
      case ROUTE_PLAINTEXT:
        this.text(r, OK, this.plainBody)
        break
      case ROUTE_JSON: {
        const w: JsonWriter = this.h.json()
        w.beginObject()
        w.key("message")
        w.string("Hello, World!")
        w.key("n")
        w.i32(this.requests)
        w.endObject()
        this.json(r)
        break
      }
      case ROUTE_ECHO:
        this.echo(r)
        break
      case ROUTE_ECHO_DOC:
        this.echoDoc(r)
        break
      case ROUTE_BODY:
        this.rewrite(r)
        break
      case ROUTE_PING:
        this.text(r, OK, this.hi)
        break
      case ROUTE_QUERY:
        this.query(r)
        break
      case ROUTE_DEEP:
        this.deep(r)
        break
      default:
        // An extra route or a row of the route table answers `ok`; what
        // matches no route, or matches one only for another method, is 404.
        if (r.route >= ROUTE_EXTRA) {
          this.text(r, OK, this.ok)
        } else {
          this.text(r, NOT_FOUND, this.notFound)
        }
    }
  }

  /** Answers the value the handler's writer holds, as the carrier server does; 400 when it is not one. */
  json(r: HttpRequest): void {
    const w: JsonWriter = this.h.writer
    if (!w.complete()) {
      this.text(r, BAD_REQUEST, this.badRequest)
      return
    }
    this.h.sendFields(r, OK, this.jsonNames, this.jsonValues, this.h.scratch, ZERO, w.end)
  }

  /** `/json-echo`: decodes the order into `this.order`, raises its revision and encodes it back. */
  echo(r: HttpRequest): void {
    const d: JsonDecoder = this.decoder
    d.reset(r.body, ZERO, r.bodyLength)
    const order: Order = this.order
    if (jsonDecode(d, order) !== 0 || order.revision > LAST_REVISION) {
      this.text(r, BAD_REQUEST, this.badRequest)
      return
    }
    order.revision += 1
    jsonEncode(this.h.json(), order)
    this.json(r)
  }

  /** `/json-echo-doc`: parses the body, sets its revision one higher and writes it back. */
  echoDoc(r: HttpRequest): void {
    const doc: JsonDocument = this.doc
    const root: i32 = doc.parse(r.body, ZERO, r.bodyLength)
    const revision: i32 = root < 0 ? -1 : doc.get(root, "revision")
    if (
      revision < 0 ||
      !doc.isI64(revision) ||
      doc.i64(revision) > toI64(LAST_REVISION) ||
      doc.i64(revision) < toI64(-2147483648) ||
      doc.set(root, "revision", doc.newI64(doc.i64(revision) + toI64(1))) !== 0
    ) {
      this.text(r, BAD_REQUEST, this.badRequest)
      return
    }
    doc.write(root, this.h.json())
    this.json(r)
  }

  /** `POST /json`: parses any JSON document and writes it back, compact. */
  rewrite(r: HttpRequest): void {
    const doc: JsonDocument = this.doc
    const root: i32 = doc.parse(r.body, ZERO, r.bodyLength)
    if (root < 0) {
      this.text(r, BAD_REQUEST, this.badRequest)
      return
    }
    doc.write(root, this.h.json())
    this.json(r)
  }

  /** Appends `r.head[start .. end)` to `this.out` at `at`, growing it; answers the new end. */
  put(r: HttpRequest, at: i32, start: i32, end: i32): i32 {
    this.room(at + end - start)
    for (
      let k: i32 = start;
      k < end && k < toI32(r.head.length) && at + k - start < toI32(this.out.length);
      k++
    ) {
      this.out[at + k - start] = r.head[k]
    }
    return at + end - start
  }

  /** Appends one space to `this.out` at `at`, growing it; answers the new end. */
  space(at: i32): i32 {
    this.room(at + 1)
    if (at >= 0 && at < toI32(this.out.length)) {
      this.out[at] = 32
      return at + 1
    }
    return at
  }

  /** Grows `this.out`, doubling, until it holds `need` bytes; what it held is kept. */
  room(need: i32): void {
    let size: i32 = toI32(this.out.length)
    while (need > size) {
      size = size * 2
    }
    if (size > toI32(this.out.length)) {
      const grown: u8[] = new Array<u8>(size)
      for (let k: i32 = 0; k < toI32(this.out.length) && k < toI32(grown.length); k++) {
        grown[k] = this.out[k]
      }
      this.out = grown
    }
  }

  /** `GET /id/:id?name=<name>`: answers `<id> <name>`, both as written, the name empty when the query has none. */
  query(r: HttpRequest): void {
    let end: i32 = this.put(r, ZERO, r.paramStart(ZERO), r.paramEnd(ZERO))
    end = this.space(end)
    if (r.queryIndex("name") >= 0) {
      end = this.put(r, end, r.queryValueStart, r.queryValueEnd)
    }
    this.h.sendFields(r, OK, this.queryNames, this.queryValues, this.out, ZERO, end)
  }

  /** The deep route: answers its three parameters, `<org> <project> <build>`, as they are written. */
  deep(r: HttpRequest): void {
    let end: i32 = 0
    for (let k: i32 = 0; k < 3; k++) {
      end = this.put(r, k === 0 ? end : this.space(end), r.paramStart(k), r.paramEnd(k))
    }
    this.h.sendFields(r, OK, this.textNames, this.textValues, this.out, ZERO, end)
  }

  /** BENCH_QUICKACK's `once0`: TCP_QUICKACK to 0 at a connection's first request. */
  ackOnce(r: HttpRequest): void {
    const slot: i32 = r.slot
    if (slot >= 0 && slot < toI32(this.seenGen.length) && this.seenGen[slot] !== r.gen) {
      this.seenGen[slot] = r.gen
      netSetOption(this.h.server.fd(slot), NET_TCP_QUICKACK, 0)
    }
  }

  run(): void {
    while (this.limit === 0 || this.requests < this.limit) {
      this.h.wait(TURN_MS)
      while (this.h.ready()) {
        const r: HttpRequest = this.h.take()
        if (this.quickack === QUICKACK_ONCE0) {
          this.ackOnce(r)
        }
        this.answer(r)
        if (this.quickack === QUICKACK_RESET0 || this.quickack === QUICKACK_RESET1) {
          // The carrier's `fd` for the request's connection, which is open: a
          // request the handler gives is one it has not yet forgotten.
          netSetOption(this.h.server.fd(r.slot), NET_TCP_QUICKACK, this.quickack === QUICKACK_RESET1 ? 1 : 0)
        }
      }
    }
  }
}

/** The worker count `BENCH_CORES` asks for; 1 when it is unset or not a number. */
const benchCores = (): i32 => {
  const env: string | null = getenv("BENCH_CORES")
  const n: i32 = env !== null ? parseInt(env) : 1
  // A worker's index travels in two bytes (`awaitPeers`).
  if (n > 65535) {
    return 65535
  }
  return n > 1 ? n : 1
}

/** The `QUICKACK_*` BENCH_QUICKACK names; `QUICKACK_NONE` when it is unset or unknown. */
const benchQuickack = (): i32 => {
  const env: string | null = getenv("BENCH_QUICKACK")
  if (env === null) {
    return QUICKACK_NONE
  }
  if (env === "reset0") {
    return QUICKACK_RESET0
  }
  if (env === "once0") {
    return QUICKACK_ONCE0
  }
  if (env === "reset1") {
    return QUICKACK_RESET1
  }
  return QUICKACK_NONE
}

/** `value` (below 65536) into `buf`'s first two bytes, little-endian. */
const twoBytesOf = (buf: u8[], value: i32): u8[] => {
  buf[0] = toU8(value & 255)
  buf[1] = toU8(value >> 8)
  return buf
}

/**
 * Worker `index` of `count`, its listener bound, until every worker has bound
 * one: the others tell worker 0 over UDP on the same port number, resending
 * until it answers, and worker 0 waits for them all. wrk opens its connections
 * once, at `listening`, so one opened before a worker bound would stay on
 * another worker for the whole run. Five seconds at most either way.
 */
const awaitPeers = (index: i32, count: i32, port: i32): void => {
  const fd: i32 = udpBind("127.0.0.1", index === 0 ? port : 0, 0)
  const loop: i32 = pollCreate()
  pollAdd(loop, fd, 1, 0)
  const ready: i32[] = new Array<i32>(2)
  const buf: u8[] = new Array<u8>(2)
  const from: u8[] = new Array<u8>(18)
  const meta: i32[] = new Array<i32>(2)
  const seen: boolean[] = new Array<boolean>(count)
  let left: i32 = index === 0 ? count - 1 : 1
  const to: u8[] = new Array<u8>(18)
  netAddress(to, "127.0.0.1", port)
  for (let tries: i32 = 0; tries < 500 && left > 0; tries++) {
    if (index !== 0) {
      udpSendTo(fd, twoBytesOf(buf, index), 0, 2, to, 0, 0)
    }
    if (pollWait(loop, ready, 10) > 0) {
      let n: i32 = udpRecvFrom(fd, buf, 0, 2, from, meta)
      while (n > 0) {
        const peer: i32 = n === 2 ? toI32(buf[0]) | (toI32(buf[1]) << 8) : -1
        if (index !== 0) {
          left = 0
        } else if (peer > 0 && peer < seen.length && !seen[peer]) {
          seen[peer] = true
          left = left - 1
        }
        if (index === 0) {
          udpSendTo(fd, buf, 0, 2, from, 0, 0)
        }
        n = udpRecvFrom(fd, buf, 0, 2, from, meta)
      }
    }
  }
  netClose(loop)
  netClose(fd)
}

export const main = (): i32 => {
  // With BENCH_CORES above 1 (`bench/http.mjs --cores`) the same server runs
  // once per core under `nish/net/prefork`, each worker on its own
  // SO_REUSEPORT listener; the process wrk is timed against is the supervisor.
  const cores: i32 = benchCores()
  let worker: i32 = 0
  let count: i32 = 1
  if (cores > 1) {
    const config: PreforkConfig = new PreforkConfig()
    config.workers = cores
    count = preforkWorkerCount(cores, getenv("NISH_WORKERS"))
    worker = preforkWith(process.argv, config)
    if (worker < 0) {
      return worker === PREFORK_STOPPED ? 0 : 1
    }
  }
  const args: string[] = preforkArgs(process.argv)
  const port: i32 = args.length > 1 ? parseInt(args[1]) : 8080
  const slots: i32 = args.length > 2 ? parseInt(args[2]) : 1024
  const limit: i32 = args.length > 3 ? parseInt(args[3]) : 0
  const listener: i32 = tcpListenFlags("127.0.0.1", port, 4096, cores > 1 ? 1 : 0)
  if (listener < 0) {
    console.log(`listen failed ${listener}`)
    return 1
  }
  const bench: AppBench = new AppBench(listener, slots)
  bench.limit = limit
  bench.quickack = benchQuickack()
  if (count > 1) {
    awaitPeers(worker, count, port)
  }
  // Only once the handler is built: a driver that starts timing on this line
  // must not time the constructor. One line, from worker 0.
  if (worker === 0) {
    console.log(`listening ${port}`)
  }
  bench.run()
  return 0
}
