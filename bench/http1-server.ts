// The load-test server for `nish/net/http1-server`: one `Http1Server` pool on
// plain TCP, one readiness loop, one thread — the shape of a program built on
// the module, with nothing between the socket and the handler. `bench/http.mjs`
// pins it to one CPU and drives it with wrk; see bench/README.md, "HTTP".
//
// Every request is routed by one `nish/net/router` table, built at start-up,
// and answered by a `switch` on the route it matched; a path that matches no
// route, or matches one only for another method, is a 404.
//
//   GET /plaintext  13 bytes of text/plain
//   GET /json       {"message":"Hello, World!","n":<requests so far>}, written
//                   by a `JsonWriter` reset onto one buffer per request
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
//                   both taken as they are written, with no percent-decoding
//   POST /json      any JSON document (bench/http-body.json), parsed into the
//                   reused `JsonDocument` and written back compact
//   the extra routes  the 112 patterns of bench/http-twins/extra-routes.mjs,
//                   kept equal to it below, `ok` to a GET of one and to a POST
//                   of one with `/submit` after it: every router twin
//                   registers them
//   the route table  bench/router.ts's 112 routes, copied below, in this
//                   server only: 14 resources of six routes each and nested
//                   routes up to nine segments deep. Each answers `ok`, but
//                   GET /v1/orgs/:org/projects/:project/builds/:build/artifacts,
//                   the "deep-route" scenario, answers `<org> <project> <build>`.
//                   Its `GET /` is the ping route's, so it is left out
//
// The routes are added in that order, the real ones first. Added later, the
// two tables' literals are tried before the real routes' at each node, so the
// real routes pay for a table of 342, not of seven.
//
// A request body is gathered from `H1_BODY` events into a buffer its slot
// keeps, and answered at `H1_END`: 400 when it is not an order. A body past
// 4 KiB is the module's to refuse, with `maxBody`: 413, `Content-Length: 0`
// and `Connection: close`, before the body is read. Once each buffer exists, /json-echo allocates nothing: the decoder
// reuses the order's strings and arrays when they are equal or in place.
// /json-echo-doc reuses the document's storage, and only `newI64` formats the
// new revision into a short string.
//
// Usage: http1-server <port> <slots> [requests]. It prints `listening <port>`
// once the pool is built and serves until it is killed, or until it has
// answered `requests` requests, when it returns from `main`: a profile-guided
// build writes its profile at a normal exit, never at a signal.
import { pollAdd, pollCreate, pollModify, pollWait, tcpListen } from "nish:net"
import {
  H1_BODY,
  H1_DONE,
  H1_END,
  H1_ERROR,
  H1_NEED_MORE,
  H1_POOL_FULL,
  H1_REQUEST,
  H1_WANT_READ,
  H1_WANT_WRITE,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server"
import { Http1Parser } from "nish/net/http1"
import { ROUTER_METHOD_NOT_ALLOWED, ROUTER_NOT_FOUND, Router, RouterLimits } from "nish/net/router"
import { JsonWriter } from "nish/json"
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed"
import { JsonDocument } from "nish/json-value"

/** The listener's token; a connection's token is its slot. */
const LISTENER: i32 = -1
const ZERO: i32 = 0
/** The largest request body an echo takes; one byte more is answered 413. */
const MAX_BODY: i32 = 4096
/** The routes, in the order `Router.add` numbers them; a slot holds one until `H1_END`. */
const ROUTE_NONE: i32 = -1
const ROUTE_PLAINTEXT: i32 = 0
const ROUTE_JSON: i32 = 1
const ROUTE_ECHO: i32 = 2
const ROUTE_ECHO_DOC: i32 = 3
const ROUTE_PING: i32 = 4
const ROUTE_QUERY: i32 = 5
const ROUTE_BODY: i32 = 6
/** The extra routes' first, a GET and its POST per pattern, then the route table's first. */
const ROUTE_EXTRA: i32 = 7
const ROUTE_TABLE: i32 = 231
/** The route table's deep route, the 102nd row after its `GET /`; one past its last. */
const ROUTE_DEEP: i32 = 332
const ROUTE_COUNT: i32 = 342
const DEEP_PATTERN: string = "/v1/orgs/:org/projects/:project/builds/:build/artifacts"
const AMPERSAND: i32 = 38
const EQUALS: i32 = 61
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

const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length)
  for (let k: i32 = 0; k < toI32(s.length) && k < toI32(out.length); k++) {
    out[k] = toU8(s.charCodeAt(k))
  }
  return out
}

/**
 * The extra routes' patterns, kept equal to bench/http-twins/extra-routes.mjs,
 * which check.mjs asks every server, this one included.
 */
const extraRoutes = (): string[] => {
  const statics: string[] = [
    "/catalog/products",
    "/catalog/categories",
    "/catalog/brands",
    "/cart/items",
    "/cart/totals",
    "/checkout/shipping",
    "/checkout/payment",
    "/checkout/review",
    "/orders/recent",
    "/orders/archived",
    "/account/addresses",
    "/account/cards",
    "/account/security",
    "/support/tickets",
    "/support/faq",
    "/stores/nearby",
    "/stores/hours",
    "/promotions/active",
    "/reviews/latest",
    "/wishlist/shared",
  ]
  const params: string[] = [
    "/orders/:orderId",
    "/orders/:orderId/items",
    "/orders/:orderId/items/:itemId",
    "/orders/:orderId/items/:itemId/returns",
    "/products/:productId",
    "/products/:productId/reviews",
    "/products/:productId/reviews/:reviewId",
    "/customers/:customerId/orders",
  ]
  const prefixes: string[] = ["", "/:locale", "/v2", "/v2/:locale"]
  const out: string[] = []
  for (const prefix of prefixes) {
    for (const route of statics) {
      out.push(prefix + route)
    }
    for (const route of params) {
      out.push(prefix + route)
    }
  }
  return out
}

/**
 * bench/router.ts's route table, copied whole: one "METHOD /pattern" per
 * route, in `Router.add` order. This server adds every row but the first,
 * `GET /`, which is its ping route.
 */
const routeTable = (): string[] => [
  "GET /",
  "GET /robots.txt",
  "GET /health",
  "GET /metrics",
  "GET /static/*",
  "GET /v1",
  "GET /v1/users",
  "POST /v1/users",
  "GET /v1/users/:id",
  "PUT /v1/users/:id",
  "DELETE /v1/users/:id",
  "GET /v1/users/:id/events",
  "GET /v1/orgs",
  "POST /v1/orgs",
  "GET /v1/orgs/:id",
  "PUT /v1/orgs/:id",
  "DELETE /v1/orgs/:id",
  "GET /v1/orgs/:id/events",
  "GET /v1/projects",
  "POST /v1/projects",
  "GET /v1/projects/:id",
  "PUT /v1/projects/:id",
  "DELETE /v1/projects/:id",
  "GET /v1/projects/:id/events",
  "GET /v1/builds",
  "POST /v1/builds",
  "GET /v1/builds/:id",
  "PUT /v1/builds/:id",
  "DELETE /v1/builds/:id",
  "GET /v1/builds/:id/events",
  "GET /v1/repos",
  "POST /v1/repos",
  "GET /v1/repos/:id",
  "PUT /v1/repos/:id",
  "DELETE /v1/repos/:id",
  "GET /v1/repos/:id/events",
  "GET /v1/issues",
  "POST /v1/issues",
  "GET /v1/issues/:id",
  "PUT /v1/issues/:id",
  "DELETE /v1/issues/:id",
  "GET /v1/issues/:id/events",
  "GET /v1/pulls",
  "POST /v1/pulls",
  "GET /v1/pulls/:id",
  "PUT /v1/pulls/:id",
  "DELETE /v1/pulls/:id",
  "GET /v1/pulls/:id/events",
  "GET /v1/teams",
  "POST /v1/teams",
  "GET /v1/teams/:id",
  "PUT /v1/teams/:id",
  "DELETE /v1/teams/:id",
  "GET /v1/teams/:id/events",
  "GET /v1/keys",
  "POST /v1/keys",
  "GET /v1/keys/:id",
  "PUT /v1/keys/:id",
  "DELETE /v1/keys/:id",
  "GET /v1/keys/:id/events",
  "GET /v1/hooks",
  "POST /v1/hooks",
  "GET /v1/hooks/:id",
  "PUT /v1/hooks/:id",
  "DELETE /v1/hooks/:id",
  "GET /v1/hooks/:id/events",
  "GET /v1/releases",
  "POST /v1/releases",
  "GET /v1/releases/:id",
  "PUT /v1/releases/:id",
  "DELETE /v1/releases/:id",
  "GET /v1/releases/:id/events",
  "GET /v1/packages",
  "POST /v1/packages",
  "GET /v1/packages/:id",
  "PUT /v1/packages/:id",
  "DELETE /v1/packages/:id",
  "GET /v1/packages/:id/events",
  "GET /v1/gists",
  "POST /v1/gists",
  "GET /v1/gists/:id",
  "PUT /v1/gists/:id",
  "DELETE /v1/gists/:id",
  "GET /v1/gists/:id/events",
  "GET /v1/events",
  "POST /v1/events",
  "GET /v1/events/:id",
  "PUT /v1/events/:id",
  "DELETE /v1/events/:id",
  "GET /v1/events/:id/events",
  "GET /v1/orgs/:org/members",
  "GET /v1/orgs/:org/members/:user",
  "DELETE /v1/orgs/:org/members/:user",
  "GET /v1/orgs/:org/teams/:team",
  "GET /v1/orgs/:org/teams/:team/members",
  "GET /v1/orgs/:org/projects/:project",
  "PATCH /v1/orgs/:org/projects/:project",
  "GET /v1/orgs/:org/projects/:project/settings",
  "GET /v1/orgs/:org/projects/:project/builds",
  "POST /v1/orgs/:org/projects/:project/builds",
  "GET /v1/orgs/:org/projects/:project/builds/:build",
  "DELETE /v1/orgs/:org/projects/:project/builds/:build",
  "GET /v1/orgs/:org/projects/:project/builds/:build/artifacts",
  "GET /v1/orgs/:org/projects/:project/builds/:build/logs/*",
  "GET /v1/repos/:owner/:repo",
  "GET /v1/repos/:owner/:repo/issues",
  "GET /v1/repos/:owner/:repo/issues/:number",
  "GET /v1/repos/:owner/:repo/issues/:number/comments",
  "GET /v1/repos/:owner/:repo/pulls/:number/files",
  "GET /v1/repos/:owner/:repo/contents/*",
  "GET /v2/users/:id",
  "GET /v2/users/:id/keys/:key",
]

/** Where `head[start .. end)` first holds `b`, or `end`. */
const indexOf = (head: u8[], start: i32, end: i32, b: i32): i32 => {
  let i: i32 = start
  while (i >= 0 && i < end && i < head.length && toI32(head[i]) !== b) {
    i = i + 1
  }
  return i
}

class Bench {
  server: Http1Server
  loop: i32 = -1
  listener: i32 = -1
  ready: i32[]
  plainBody: u8[]
  textNames: u8[][]
  textValues: u8[][]
  jsonNames: u8[][]
  jsonValues: u8[][]
  notFound: u8[]
  jsonBuf: u8[]
  writer: JsonWriter
  /** Each slot's request body; empty until the slot's first echo. */
  bodies: u8[][]
  /** How many body bytes each slot holds; past `MAX_BODY` once one is too long. */
  bodyLength: i32[]
  /** Each slot's `ROUTE_*`. */
  route: i32[]
  order: Order
  decoder: JsonDecoder
  doc: JsonDocument
  badRequest: u8[]
  tooLarge: u8[]
  hi: u8[]
  ok: u8[]
  queryNames: u8[][]
  queryValues: u8[][]
  space: u8[]
  router: Router
  /** The matched route's parameters, `[start, end)` pairs into the head. */
  params: i32[]
  requests: i32 = 0
  /** Return from `run` once this many requests are answered; 0 serves forever. */
  limit: i32 = 0

  constructor(listener: i32, slots: i32) {
    this.listener = listener
    const config: Http1Config = new Http1Config()
    config.maxBody = MAX_BODY
    this.server = new Http1Server(config, listener, slots)
    this.loop = pollCreate()
    this.ready = new Array<i32>(128)
    this.plainBody = bytesOf("Hello, World!")
    this.textNames = [bytesOf("Server"), bytesOf("Content-Type")]
    this.textValues = [bytesOf("nish"), bytesOf("text/plain")]
    this.jsonNames = [bytesOf("Server"), bytesOf("Content-Type")]
    this.jsonValues = [bytesOf("nish"), bytesOf("application/json")]
    this.notFound = bytesOf("not found")
    this.jsonBuf = new Array<u8>(MAX_BODY + 256)
    this.writer = new JsonWriter(this.jsonBuf, ZERO)
    this.bodies = []
    this.bodyLength = new Array<i32>(slots)
    this.route = new Array<i32>(slots)
    for (let k: i32 = 0; k < slots; k++) {
      this.bodies.push(new Array<u8>(0))
      this.route[k] = ROUTE_NONE
    }
    this.order = new Order()
    this.decoder = new JsonDecoder(this.jsonBuf, ZERO, ZERO, new JsonLimits())
    this.doc = new JsonDocument(new JsonLimits())
    this.badRequest = bytesOf("bad request")
    this.tooLarge = bytesOf("payload too large")
    this.hi = bytesOf("Hi")
    this.ok = bytesOf("ok")
    this.queryNames = [bytesOf("Server"), bytesOf("Content-Type"), bytesOf("x-powered-by")]
    this.queryValues = [bytesOf("nish"), bytesOf("text/plain"), bytesOf("benchmark")]
    this.space = bytesOf(" ")
    const limits: RouterLimits = new RouterLimits()
    this.router = new Router(limits)
    this.params = new Array<i32>(2 * limits.maxParams)
    this.add("GET", "/plaintext", ROUTE_PLAINTEXT)
    this.add("GET", "/json", ROUTE_JSON)
    this.add("POST", "/json-echo", ROUTE_ECHO)
    this.add("POST", "/json-echo-doc", ROUTE_ECHO_DOC)
    this.add("GET", "/", ROUTE_PING)
    this.add("GET", "/id/:id", ROUTE_QUERY)
    this.add("POST", "/json", ROUTE_BODY)
    let next: i32 = ROUTE_EXTRA
    for (const pattern of extraRoutes()) {
      this.add("GET", pattern, next)
      this.add("POST", `${pattern}/submit`, next + 1)
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
      this.add(row.slice(0, space), pattern, next)
      next += 1
    }
    if (next !== ROUTE_COUNT) {
      panic(`http1-server: the route table ends at ${next}, not ${ROUTE_COUNT}`)
    }
  }

  /** Adds one route, which must be numbered `route`: the `switch` in `answer` is written against the numbers. */
  add(method: string, pattern: string, route: i32): void {
    const got: i32 = this.router.add(method, pattern)
    if (got !== route) {
      panic(`http1-server: ${method} ${pattern} was answered ${got}, not route ${route}`)
    }
  }

  /** Routes a request at its head: starts a body route's body, or answers any other request from the head alone. */
  begin(slot: i32, conn: Http1Connection): void {
    const p: Http1Parser = conn.parser
    const route: i32 = this.router.match(
      p.head,
      p.methodStart,
      p.methodEnd,
      p.head,
      p.targetStart,
      p.targetEnd,
      this.params
    )
    this.bodyLength[slot] = 0
    switch (route) {
      case ROUTE_ECHO:
      case ROUTE_ECHO_DOC:
      case ROUTE_BODY:
        this.route[slot] = route
        if (this.bodies[slot].length === 0) {
          this.bodies[slot] = new Array<u8>(MAX_BODY)
        }
        break
      default:
        this.route[slot] = ROUTE_NONE
        this.answer(conn, route)
    }
  }

  /** Appends one `H1_BODY` chunk to the slot's body, or marks the body too long. */
  gather(slot: i32, conn: Http1Connection): void {
    if (this.route[slot] === ROUTE_NONE) {
      return
    }
    const have: i32 = this.bodyLength[slot]
    const n: i32 = conn.dataLength
    if (have + n > MAX_BODY) {
      this.bodyLength[slot] = MAX_BODY + 1
      return
    }
    const body: u8[] = this.bodies[slot]
    const data: u8[] = conn.data
    for (let k: i32 = 0; k < n; k++) {
      body[have + k] = data[conn.dataStart + k]
    }
    this.bodyLength[slot] = have + n
  }

  /** Answers an echo once its body is whole. */
  finish(slot: i32, conn: Http1Connection): void {
    const route: i32 = this.route[slot]
    if (route === ROUTE_NONE) {
      return
    }
    this.route[slot] = ROUTE_NONE
    this.requests = this.requests + 1
    const length: i32 = this.bodyLength[slot]
    if (length > MAX_BODY) {
      this.reply(conn, 413, this.tooLarge)
      return
    }
    const w: JsonWriter = this.writer
    w.reset(this.jsonBuf, ZERO)
    let ok: boolean = false
    if (route === ROUTE_ECHO) {
      ok = this.echo(this.bodies[slot], length, w)
    } else if (route === ROUTE_ECHO_DOC) {
      ok = this.echoDoc(this.bodies[slot], length, w)
    } else {
      ok = this.rewrite(this.bodies[slot], length, w)
    }
    if (!ok || w.failed !== 0) {
      this.reply(conn, 400, this.badRequest)
      return
    }
    conn.respond(200, this.jsonNames, this.jsonValues, w.end)
    conn.write(this.jsonBuf, ZERO, w.end)
    conn.end()
  }

  /** `/json-echo`: decodes the order into `this.order`, raises its revision and encodes it onto `w`. */
  echo(body: u8[], length: i32, w: JsonWriter): boolean {
    const d: JsonDecoder = this.decoder
    d.reset(body, ZERO, length)
    const order: Order = this.order
    if (jsonDecode(d, order) !== 0 || order.revision > LAST_REVISION) {
      return false
    }
    order.revision += 1
    jsonEncode(w, order)
    return true
  }

  /** `/json-echo-doc`: parses the body into `this.doc`, sets its revision one higher and writes it onto `w`. */
  echoDoc(body: u8[], length: i32, w: JsonWriter): boolean {
    const doc: JsonDocument = this.doc
    const root: i32 = doc.parse(body, ZERO, length)
    if (root < 0) {
      return false
    }
    const revision: i32 = doc.get(root, "revision")
    // The typed route's range: an `i32` revision with a next one.
    if (
      revision < 0 ||
      !doc.isI64(revision) ||
      doc.i64(revision) > toI64(LAST_REVISION) ||
      doc.i64(revision) < toI64(-2147483648)
    ) {
      return false
    }
    if (doc.set(root, "revision", doc.newI64(doc.i64(revision) + toI64(1))) !== 0) {
      return false
    }
    doc.write(root, w)
    return true
  }

  /** `POST /json`: parses any JSON document into `this.doc` and writes it back onto `w`, compact. */
  rewrite(body: u8[], length: i32, w: JsonWriter): boolean {
    const doc: JsonDocument = this.doc
    const root: i32 = doc.parse(body, ZERO, length)
    if (root < 0) {
      return false
    }
    doc.write(root, w)
    return true
  }

  reply(conn: Http1Connection, status: i32, body: u8[]): void {
    conn.respond(status, this.textNames, this.textValues, toI32(body.length))
    conn.write(body, ZERO, toI32(body.length))
    conn.end()
  }

  /** Answers one request from its head and its `route`; a body, if any, is read and ignored. */
  answer(conn: Http1Connection, route: i32): void {
    this.requests = this.requests + 1
    switch (route) {
      case ROUTE_PLAINTEXT:
        conn.respond(200, this.textNames, this.textValues, toI32(this.plainBody.length))
        conn.write(this.plainBody, ZERO, toI32(this.plainBody.length))
        conn.end()
        break
      case ROUTE_JSON: {
        const w: JsonWriter = this.writer
        w.reset(this.jsonBuf, ZERO)
        w.beginObject()
        w.key("message")
        w.string("Hello, World!")
        w.key("n")
        w.i32(this.requests)
        w.endObject()
        conn.respond(200, this.jsonNames, this.jsonValues, w.end)
        conn.write(this.jsonBuf, ZERO, w.end)
        conn.end()
        break
      }
      case ROUTE_PING:
        this.reply(conn, 200, this.hi)
        break
      case ROUTE_QUERY:
        this.query(conn)
        break
      case ROUTE_DEEP:
        this.deep(conn)
        break
      case ROUTER_NOT_FOUND:
      case ROUTER_METHOD_NOT_ALLOWED:
        this.reply(conn, 404, this.notFound)
        break
      default:
        // An extra route or a row of the route table; the router answers no other number.
        this.reply(conn, 200, this.ok)
    }
  }

  /** `GET /id/:id?name=<name>`: answers `<id> <name>`, the name empty when the query has none. */
  query(conn: Http1Connection): void {
    const head: u8[] = conn.parser.head
    const end: i32 = conn.parser.targetEnd
    const idStart: i32 = this.params[0]
    const path: i32 = this.params[1]
    // The first `name` parameter's value; empty when there is none.
    let nameStart: i32 = path
    let nameEnd: i32 = path
    let at: i32 = path + 1
    while (at < end) {
      const next: i32 = indexOf(head, at, end, AMPERSAND)
      const equals: i32 = indexOf(head, at, next, EQUALS)
      if (
        equals - at === 4 &&
        at >= 0 &&
        at + 3 < head.length &&
        head[at] === 110 &&
        head[at + 1] === 97 &&
        head[at + 2] === 109 &&
        head[at + 3] === 101
      ) {
        nameStart = equals < next ? equals + 1 : next
        nameEnd = next
        at = end
      } else {
        at = next + 1
      }
    }
    conn.respond(200, this.queryNames, this.queryValues, path - idStart + 1 + nameEnd - nameStart)
    conn.write(head, idStart, path - idStart)
    conn.write(this.space, ZERO, 1)
    conn.write(head, nameStart, nameEnd - nameStart)
    conn.end()
  }

  /** The deep route: answers its three parameters, `<org> <project> <build>`, as they are written. */
  deep(conn: Http1Connection): void {
    const head: u8[] = conn.parser.head
    const p: i32[] = this.params
    conn.respond(200, this.textNames, this.textValues, p[1] - p[0] + p[3] - p[2] + p[5] - p[4] + 2)
    conn.write(head, p[0], p[1] - p[0])
    conn.write(this.space, ZERO, 1)
    conn.write(head, p[2], p[3] - p[2])
    conn.write(this.space, ZERO, 1)
    conn.write(head, p[4], p[5] - p[4])
    conn.end()
  }

  acceptAll(): void {
    while (true) {
      const slot: i32 = this.server.accept()
      if (slot >= 0) {
        pollAdd(this.loop, this.server.fd(slot), H1_WANT_READ, slot)
      } else if (slot !== H1_POOL_FULL) {
        return
      }
    }
  }

  serve(slot: i32, events: i32): void {
    if (!this.server.holds(slot)) {
      return
    }
    let wants: i32 = (events & 5) !== 0 ? this.server.readable(slot) : this.server.writable(slot)
    const conn: Http1Connection = this.server.connection(slot)
    let event: i32 = this.server.next(slot)
    while (event !== H1_NEED_MORE && event !== H1_ERROR) {
      if (event === H1_REQUEST) {
        this.begin(slot, conn)
      } else if (event === H1_BODY) {
        this.gather(slot, conn)
      } else if (event === H1_END) {
        this.finish(slot, conn)
      }
      event = this.server.next(slot)
    }
    wants = this.server.flush(slot)
    if ((wants & H1_DONE) !== 0) {
      this.server.close(slot)
      return
    }
    if (this.server.rearm(slot, wants)) {
      pollModify(this.loop, this.server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
    }
  }

  run(): void {
    pollAdd(this.loop, this.listener, 1, LISTENER)
    while (this.limit === 0 || this.requests < this.limit) {
      const n: i32 = pollWait(this.loop, this.ready, -1)
      for (let k: i32 = 0; k < n; k++) {
        const token: i32 = this.ready[2 * k]
        const events: i32 = this.ready[2 * k + 1]
        if (token === LISTENER) {
          this.acceptAll()
        } else {
          this.serve(token, events)
        }
      }
    }
  }
}

export const main = (): void => {
  const port: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 8080
  const slots: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 1024
  const limit: i32 = process.argv.length > 3 ? parseInt(process.argv[3]) : 0
  const listener: i32 = tcpListen("127.0.0.1", port, 4096)
  if (listener < 0) {
    console.log(`listen failed ${listener}`)
    return
  }
  const bench: Bench = new Bench(listener, slots)
  bench.limit = limit
  // Only once the pool is built: a driver that starts timing on this line
  // must not time the constructor.
  console.log(`listening ${port}`)
  bench.run()
}
