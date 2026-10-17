// The load-test server for `nish/net/http1-server`: one `Http1Server` pool on
// plain TCP, one readiness loop, one thread — the shape of a program built on
// the module, with nothing between the socket and the handler. `bench/http.mjs`
// pins it to one CPU and drives it with wrk; see bench/README.md, "HTTP".
//
//   GET /plaintext  13 bytes of text/plain
//   GET /json       {"message":"Hello, World!","n":<requests so far>}, written
//                   by a `JsonWriter` reset onto one buffer per request
//   POST /json-echo      an order (bench/http-payload.json) decoded by
//                        `jsonDecode` into one reused `Order`, its revision
//                        raised by one, and written back by `jsonEncode`
//   POST /json-echo-doc  the same answer through one reused `JsonDocument`:
//                        parse, `set` the revision, `write`
//
// A request body is gathered from `H1_BODY` events into a buffer its slot
// keeps, and answered at `H1_END`: 413 past 4 KiB, 400 when it is not an
// order. Once each buffer exists, /json-echo allocates nothing: the decoder
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
import { JsonWriter } from "nish/json"
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed"
import { JsonDocument } from "nish/json-value"

/** The listener's token; a connection's token is its slot. */
const LISTENER: i32 = -1
const ZERO: i32 = 0
/** The largest request body an echo takes; one byte more is answered 413. */
const MAX_BODY: i32 = 4096
/** What a slot's request is waiting for at `H1_END`. */
const ROUTE_NONE: i32 = 0
const ROUTE_ECHO: i32 = 1
const ROUTE_ECHO_DOC: i32 = 2
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
  requests: i32 = 0
  /** Return from `run` once this many requests are answered; 0 serves forever. */
  limit: i32 = 0

  constructor(listener: i32, slots: i32) {
    this.listener = listener
    this.server = new Http1Server(new Http1Config(), listener, slots)
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
    }
    this.order = new Order()
    this.decoder = new JsonDecoder(this.jsonBuf, ZERO, ZERO, new JsonLimits())
    this.doc = new JsonDocument(new JsonLimits())
    this.badRequest = bytesOf("bad request")
    this.tooLarge = bytesOf("payload too large")
  }

  /** Starts an echo at its head, or answers any other request from the head alone. */
  begin(slot: i32, conn: Http1Connection): void {
    let route: i32 = ROUTE_NONE
    if (conn.parser.methodIs("POST")) {
      if (conn.parser.targetIs("/json-echo")) {
        route = ROUTE_ECHO
      } else if (conn.parser.targetIs("/json-echo-doc")) {
        route = ROUTE_ECHO_DOC
      }
    }
    this.route[slot] = route
    this.bodyLength[slot] = 0
    if (route === ROUTE_NONE) {
      this.answer(conn)
    } else if (this.bodies[slot].length === 0) {
      this.bodies[slot] = new Array<u8>(MAX_BODY)
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
    const ok: boolean =
      route === ROUTE_ECHO
        ? this.echo(this.bodies[slot], length, w)
        : this.echoDoc(this.bodies[slot], length, w)
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

  reply(conn: Http1Connection, status: i32, body: u8[]): void {
    conn.respond(status, this.textNames, this.textValues, toI32(body.length))
    conn.write(body, ZERO, toI32(body.length))
    conn.end()
  }

  /** Answers one request from its head; a body, if any, is read and ignored. */
  answer(conn: Http1Connection): void {
    this.requests = this.requests + 1
    if (conn.parser.targetIs("/json")) {
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
    } else if (conn.parser.targetIs("/plaintext")) {
      conn.respond(200, this.textNames, this.textValues, toI32(this.plainBody.length))
      conn.write(this.plainBody, ZERO, toI32(this.plainBody.length))
      conn.end()
    } else {
      conn.respond(404, this.textNames, this.textValues, toI32(this.notFound.length))
      conn.write(this.notFound, ZERO, toI32(this.notFound.length))
      conn.end()
    }
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
