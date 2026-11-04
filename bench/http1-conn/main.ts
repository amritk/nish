// Http1Connection's per-request path without sockets: a keep-alive GET fed in
// one read, `next` to `H1_REQUEST` and `H1_END`, `respond` with a small JSON
// body, then what `Http1Server`'s `send` and `settle` do once the bytes are
// out (`consume`, `release`, `isDone`, `park`, `inputRoom`, `wantsWrite`).
// run.mjs builds this against an old and a new `http1-server.ts` and times
// them interleaved; see bench/http1-conn/README.md.
//
//   main hot  <requests> 1 <batches>             one connection, request after
//                                                request
//   main cold <requests> <connections> <batches> that many connections of one
//                                                pool, visited round-robin, so
//                                                each request meets a
//                                                connection out of cache
//
// Times `<batches>` batches of `<requests>` requests (default 5 of 1000000)
// and prints `<shape> <ns> <requests> <checksum>` for the fastest batch; the
// checksum adds up every response's length and tenth byte (the status's
// first digit) over all batches, so two builds that answer differently
// disagree on it.

import { monotonicNanos } from "nish:process"
import {
  H1_END,
  H1_NEED_MORE,
  H1_REQUEST,
  Http1Config,
  Http1Connection,
  Http1OutputPool,
  HttpDate,
} from "nish/net/http1-server"

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = []
  for (let i: i32 = 0; i < text.length; i += 1) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/** A 180-byte token in the shape of a JWT: three base64url parts. */
const token = (): string => {
  const alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  const parts: string[] = ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."]
  let x: i32 = 7
  for (let n: i32 = 37; n < 180; n += 1) {
    x = (x * 1103 + 12345) & 65535
    parts.push(n === 140 ? "." : alphabet.substring(x & 63, (x & 63) + 1))
  }
  return parts.join("")
}

/** The request every iteration feeds: about 330 head bytes, a load generator's GET. */
const request = (): u8[] =>
  ascii(
    "GET /api/v1/items/42 HTTP/1.1\r\n" +
      "Host: bench.example.com:8080\r\n" +
      "User-Agent: loadgen/1.0\r\n" +
      "Accept: application/json\r\n" +
      "Accept-Encoding: gzip, deflate\r\n" +
      `Authorization: Token ${token()}\r\n` +
      "\r\n"
  )

/** The state one run shares across its connections. */
class Bench {
  req: u8[]
  body: u8[]
  names: u8[][]
  values: u8[][]
  conns: Http1Connection[]
  now: i64 = 0
  sum: i64 = 0

  constructor(count: i32) {
    const config: Http1Config = new Http1Config()
    const outputs: Http1OutputPool = new Http1OutputPool(config.outputSize)
    const date: HttpDate = new HttpDate()
    date.pin(toI64(1700000000) * toI64(1000))
    this.req = request()
    this.body = ascii('{"id":42,"name":"widget","price":1999,"tags":["a","b"],"ok":true}')
    this.names = [ascii("content-type")]
    this.values = [ascii("application/json")]
    this.conns = []
    for (let i: i32 = 0; i < count; i += 1) {
      // As `Http1Server.build` makes a slot's connection.
      const conn: Http1Connection = new Http1Connection(config)
      conn.pool = outputs
      conn.date = date
      this.conns.push(conn)
    }
  }

  /** One request on `conn`, read, answered and sent. */
  serve(conn: Http1Connection): void {
    // `Http1Server.readable`: the room, the read, the clocks.
    const room: i32 = conn.inputRoom()
    const len: i32 = toI32(this.req.length)
    if (room < len || conn.feed(this.req, 0, len) !== len) {
      panic("bench: the connection took less than a request")
    }
    this.now = this.now + toI64(1000)
    conn.lastActive = this.now
    conn.headArrived(this.now)
    // The program's loop.
    let event: i32 = conn.next()
    while (event !== H1_NEED_MORE) {
      if (event === H1_REQUEST) {
        // Nothing to read until the end of a GET.
      } else if (event === H1_END) {
        const n: i32 = toI32(this.body.length)
        if (conn.respond(200, this.names, this.values, n) !== 0 || conn.write(this.body, 0, n) !== n) {
          panic("bench: the response was refused")
        }
        conn.end()
      } else {
        panic(`bench: unexpected event ${event}`)
      }
      event = conn.next()
    }
    // `Http1Server.send` and `settle`: everything is written at once.
    const pending: i32 = conn.outputEnd - conn.outputStart
    this.sum = this.sum + toI64(pending) + toI64(conn.output[conn.outputStart + 9])
    conn.consume(pending)
    conn.release()
    if (conn.isDone()) {
      panic("bench: the connection closed")
    }
    conn.park()
    if (conn.inputRoom() <= 0 || conn.wantsWrite()) {
      panic("bench: the connection does not want to read")
    }
  }
}

export const main = (): i32 => {
  const shape: string = process.argv.length > 1 ? process.argv[1] : "hot"
  const requests: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 1000000
  let count: i32 = process.argv.length > 3 ? parseInt(process.argv[3]) : 50000
  const batches: i32 = process.argv.length > 4 ? parseInt(process.argv[4]) : 5
  if (shape === "hot") {
    count = 1
  }
  const b: Bench = new Bench(count)
  // One untimed pass: every connection's buffers are made and its first
  // request read, as on a server past its warm-up.
  for (let i: i32 = 0; i < count; i += 1) {
    b.serve(b.conns[i])
  }
  b.sum = 0
  // The fastest of `batches` timed batches: a shared machine's interruptions
  // land in some batches, and the fastest is the one they missed.
  let best: i64 = 0
  let at: i32 = 0
  for (let batch: i32 = 0; batch < batches; batch += 1) {
    const started: i64 = monotonicNanos()
    for (let k: i32 = 0; k < requests; k += 1) {
      b.serve(b.conns[at])
      at += 1
      if (at === count) {
        at = 0
      }
    }
    const ns: i64 = monotonicNanos() - started
    if (batch === 0 || ns < best) {
      best = ns
    }
  }
  console.log(`${shape} ${best} ${requests} ${b.sum}`)
  return 0
}
