// An HTTP/1.1 server under load: the program bench/http.mjs times. It is a
// plain-TCP `Http1Server` in one readiness loop, written the way a program on
// `nish/net/http1-server` is (tests/link/net_http1_server's `H1Loop`), and
// answers every request the way a plaintext benchmark asks a server to: 200,
// `Content-Type: text/plain`, the 13 bytes `Hello, World!`, keep-alive.
//
//   http-server <requests> [port]
//
// It listens on 127.0.0.1 (on any free port without one), prints `port <n>`,
// serves until it has answered `requests` requests and every connection has
// closed, and then prints `served <n> checksum <c>`: the requests it answered
// and a checksum of each response's status and body length, the one the driver
// makes of what its client received. A column that answered nothing, or
// answered something else, cannot print the checksum its client made. Ten
// seconds without a wake ends the program with exit 1 rather than a hang.
//
// Nothing allocates per request: the fields and the body are made once, and
// `respond`, `write` and `end` copy into the connection's own output buffer.
import { netLocalPort, pollAdd, pollCreate, pollModify, pollWait, tcpListen } from "nish:net"
import {
  H1_DONE,
  H1_ERROR,
  H1_NEED_MORE,
  H1_REQUEST,
  H1_WANT_READ,
  H1_WANT_WRITE,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server"

/** The slots in the pool: more than the driver's connections, so none is refused. */
const SLOTS: i32 = 256
/** The listener's token; a connection's token is its slot. */
const LISTENER: i32 = 1000000
/** The most a wait may last before the program decides a wake was lost. */
const WAIT_MS: i32 = 10000

/** The bytes of `text`, which is ASCII. */
const ascii = (text: string): u8[] => {
  const out: u8[] = []
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(text.charCodeAt(k)))
  }
  return out
}

/** The decimal number `text` spells, or -1. */
const decimal = (text: string): i32 => {
  const length: i32 = toI32(text.length)
  if (length === 0 || length > 9) {
    return -1
  }
  let n: i32 = 0
  for (let k: i32 = 0; k < length; k++) {
    const digit: i32 = toI32(text.charCodeAt(k)) - 48
    if (digit < 0 || digit > 9) {
      return -1
    }
    n = n * 10 + digit
  }
  return n
}

/** The server, its program, and the count and fold of what it answered. */
class Bench {
  loop: i32
  listener: i32
  server: Http1Server
  ready: i32[]
  names: u8[][]
  values: u8[][]
  none: u8[][]
  body: u8[]
  answered: i32 = 0
  /** The sum, wrapping, of each response's `hash`: bench/http.mjs's client sums the same, in whatever order its connections finish. */
  checksum: u32 = 0

  constructor(port: i32) {
    this.loop = pollCreate()
    this.listener = tcpListen("127.0.0.1", port, 512)
    this.server = new Http1Server(new Http1Config(), this.listener, SLOTS)
    this.ready = new Array<i32>(2 * 64)
    this.names = [ascii("Content-Type")]
    this.values = [ascii("text/plain")]
    this.none = []
    this.body = ascii("Hello, World!")
    pollAdd(this.loop, this.listener, H1_WANT_READ, LISTENER)
  }

  /** Adds one response to the checksum: FNV-1a over its status and then its body length. */
  fold(status: i32, length: i32): void {
    let hash: u32 = 2166136261
    hash = (hash ^ toU32(status)) * toU32(16777619)
    hash = (hash ^ toU32(length)) * toU32(16777619)
    this.checksum = this.checksum + hash
  }

  /** Accepts every waiting connection. A full pool closes the connection, which its client reports. */
  accept(): void {
    while (true) {
      const slot: i32 = this.server.accept()
      if (slot < 0) {
        return
      }
      pollAdd(this.loop, this.server.fd(slot), H1_WANT_READ, slot)
    }
  }

  /** A request's head: `/plaintext` gets the body, anything else a 404. */
  answer(conn: Http1Connection): void {
    this.answered = this.answered + 1
    if (conn.parser.targetIs("/plaintext")) {
      conn.respond(toI32(200), this.names, this.values, toI32(this.body.length))
      conn.write(this.body, toI32(0), toI32(this.body.length))
      this.fold(toI32(200), toI32(this.body.length))
    } else {
      conn.respond(toI32(404), this.none, this.none, toI32(0))
      this.fold(toI32(404), toI32(0))
    }
    conn.end()
  }

  /** A connection's descriptor is ready: read it, answer what it asked, then re-arm it or close it. */
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
    pollModify(this.loop, this.server.fd(slot), wants & (H1_WANT_READ | H1_WANT_WRITE), slot)
  }

  /** Serves until `requests` are answered and no connection is left; false when a wait ran out. */
  run(requests: i32): boolean {
    while (this.answered < requests || this.server.busy() > 0) {
      const n: i32 = pollWait(this.loop, this.ready, WAIT_MS)
      if (n <= 0) {
        return false
      }
      for (let i: i32 = 0; i < n; i++) {
        const who: i32 = this.ready[2 * i]
        if (who === LISTENER) {
          this.accept()
        } else {
          this.serve(who, this.ready[2 * i + 1])
        }
      }
    }
    return true
  }
}

export const main = (): i32 => {
  const argc: i32 = toI32(process.argv.length)
  const requests: i32 = argc >= 2 ? decimal(process.argv[1]) : -1
  const port: i32 = argc >= 3 ? decimal(process.argv[2]) : 0
  if (requests < 1 || port < 0 || port > 65535 || argc > 3) {
    console.error("usage: http-server <requests> [port]")
    return 2
  }
  const bench = new Bench(port)
  if (bench.listener < 0) {
    console.error(`http-server: cannot listen on port ${port} (${bench.listener})`)
    return 1
  }
  console.log(`port ${netLocalPort(bench.listener)}`)
  if (!bench.run(requests)) {
    console.error(`http-server: no wake for ${WAIT_MS} ms after ${bench.answered} requests`)
    return 1
  }
  console.log(`served ${bench.answered} checksum ${bench.checksum}`)
  return 0
}
