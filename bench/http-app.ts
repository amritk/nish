// The load-test server for `nish/net/handler`: `bench/http1-server.ts`'s
// contract answered through `HttpHandler` instead of `Http1Server`'s events,
// so that `bench/http.mjs`, given both builds, measures what the request and
// response layer costs over the carrier it drives.
//
//   node bench/http.mjs carrier=build/bench/h1 handler=build/bench/http-app
//
// The routes, their numbers and the route table are the carrier server's
// (`bench/http-app-routes.ts`), and every answer is byte for byte the same,
// `Server` and `Content-Type` fields included. Two things differ, both the
// handler's way of working: a request is answered once its body is whole,
// and `GET /id/:id` reads its `name` through `HttpRequest.queryIndex`.
// `POST /json-echo`, the typed decoder's route, is answered 404, which
// `bench/http.mjs` reads as `n/a`: the decoder costs the same over either
// layer, and /json-echo-doc already measures a body read through the handler.
//
// Usage: http-app <port> <slots> [requests]. It prints `listening <port>` once
// the handler is built and serves until it is killed, or until it has
// answered `requests` requests. It runs on one core; with BENCH_CORES above 1
// it prints `single-core` and exits, as `bench/http.mjs` asks.
import { JsonWriter } from "nish/json"
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"
import { HandlerLimits, HttpHandler, HttpRequest } from "nish/net/handler"
import { Router, RouterLimits } from "nish/net/router"
import { tcpListen } from "nish:net"
import { getenv } from "nish:process"
import { extraRoutes, routeTable } from "./http-app-routes"

const ZERO: i32 = 0
const OK: i32 = 200
const BAD_REQUEST: i32 = 400
const NOT_FOUND: i32 = 404
const TURN_MS: i32 = 1000
/** The largest request body an echo takes; one byte more is answered 413 by the carrier. */
const MAX_BODY: i32 = 4096
/** The routes, in the order `Router.add` numbers them, as in `bench/http1-server.ts`. */
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
/** The highest revision an echo raises, as in `bench/http1-server.ts`. */
const LAST_REVISION: i32 = 2147483646

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
    panic(`http-app: ${method} ${pattern} was answered ${got}, not route ${route}`)
  }
}

class AppBench {
  h: HttpHandler
  doc: JsonDocument
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
      panic(`http-app: the extra routes end at ${next}, not ${ROUTE_TABLE}`)
    }
    const rows: string[] = routeTable()
    for (let r: i32 = 1; r < toI32(rows.length); r++) {
      const row: string = rows[r]
      const space: i32 = toI32(row.indexOf(" "))
      const pattern: string = row.slice(space + 1)
      if ((pattern === DEEP_PATTERN) !== (next === ROUTE_DEEP)) {
        panic(`http-app: ${row} is route ${next}, and ROUTE_DEEP is ${ROUTE_DEEP}`)
      }
      appAdd(router, row.slice(0, space), pattern, next)
      next += 1
    }
    if (next !== ROUTE_COUNT) {
      panic(`http-app: the route table ends at ${next}, not ${ROUTE_COUNT}`)
    }
    this.h = new HttpHandler(limits, listener, router)
    this.doc = new JsonDocument(new JsonLimits())
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
        // An extra route or a row of the route table answers `ok`; /json-echo
        // and what matches no route, or only for another method, are 404.
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
      for (let k: i32 = 0; k < toI32(this.out.length); k++) {
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

  run(): void {
    while (this.limit === 0 || this.requests < this.limit) {
      this.h.wait(TURN_MS)
      while (this.h.ready()) {
        this.answer(this.h.take())
      }
    }
  }
}

export const main = (): i32 => {
  const cores: string | null = getenv("BENCH_CORES")
  if (cores !== null && parseInt(cores) > 1) {
    console.log("single-core")
    return 0
  }
  const args: string[] = process.argv
  const port: i32 = args.length > 1 ? parseInt(args[1]) : 8080
  const slots: i32 = args.length > 2 ? parseInt(args[2]) : 1024
  const listener: i32 = tcpListen("127.0.0.1", port, 4096)
  if (listener < 0) {
    console.log(`listen failed ${listener}`)
    return 1
  }
  const bench: AppBench = new AppBench(listener, slots)
  bench.limit = args.length > 3 ? parseInt(args[3]) : 0
  console.log(`listening ${port}`)
  bench.run()
  return 0
}
