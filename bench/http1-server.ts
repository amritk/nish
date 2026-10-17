// The load-test server for `nish/net/http1-server`: one `Http1Server` pool on
// plain TCP, one readiness loop, one thread — the shape of a program built on
// the module, with nothing between the socket and the handler. `bench/http.mjs`
// pins it to one CPU and drives it with wrk; see bench/README.md, "HTTP".
//
//   GET /plaintext  13 bytes of text/plain
//   GET /json       {"message":"Hello, World!","n":<requests so far>}, written
//                   by a `JsonWriter` reset onto one buffer per request
//
// Usage: http1-server <port> <slots> [requests]. It prints `listening <port>`
// once the pool is built and serves until it is killed, or until it has
// answered `requests` requests, when it returns from `main`: a profile-guided
// build writes its profile at a normal exit, never at a signal.
import { pollAdd, pollCreate, pollModify, pollWait, tcpListen } from "nish:net"
import {
  H1_DONE,
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

/** The listener's token; a connection's token is its slot. */
const LISTENER: i32 = -1
const ZERO: i32 = 0

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
    this.jsonBuf = new Array<u8>(256)
    this.writer = new JsonWriter(this.jsonBuf, ZERO)
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
        this.answer(conn)
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
