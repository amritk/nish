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
//   main idle <requests> <connections> <batches> the same over an
//                                                `Http1Server`-shaped pool with
//                                                `Http1Config.idleInput` on:
//                                                each request is read through
//                                                the server's scratch buffer,
//                                                and each connection lends its
//                                                input and head buffers back
//                                                when it parks
//   main rss 0 <connections> 0                   the idle pool's connections
//                                                each served one request and
//                                                parked, then nothing timed:
//                                                prints the peak RSS in KiB
//                                                (VmHWM) as `<ns>`
//
// Times `<batches>` batches of `<requests>` requests (default 5 of 1000000)
// and prints `<shape> <ns> <requests> <checksum>` for the fastest batch; the
// checksum adds up every response's length and tenth byte (the status's
// first digit), and in the idle shape every body byte count and first body
// byte, over all batches, so two builds that answer differently disagree on
// it.

import { copyBytes } from "nish/bytes"
import { monotonicNanos } from "nish:process"
import {
  H1_BODY,
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

/** The other request the idle shape feeds: about 550 bytes, a POST with a small JSON body. */
const post = (): u8[] => {
  const body: string =
    '{"item":42,"quantity":3,"note":"leave at the door","gift":false,"coupon":"SPRING-2024"}'
  return ascii(
    "POST /api/v1/orders HTTP/1.1\r\n" +
      "Host: bench.example.com:8080\r\n" +
      "User-Agent: loadgen/1.0\r\n" +
      "Accept: application/json\r\n" +
      "Accept-Encoding: gzip, deflate\r\n" +
      "Content-Type: application/json\r\n" +
      `Content-Length: ${body.length}\r\n` +
      "X-Request-Id: 7f3c9a1e-5b2d-4e8f-a6c0-1d9b8e7f6a5c\r\n" +
      `Authorization: Token ${token()}\r\n` +
      "\r\n" +
      body
  )
}

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

/**
 * An `Http1Server` without its sockets: the same slots, pools, scratch and
 * shared `Date`, and `readable`, `next` and `flush` doing what the server's
 * do, with the read a copy of the request into the scratch buffer and the
 * send taking all the output at once. A connection is built with the
 * server's `build`, so it lends its buffers while it rests.
 */
class IdlePool {
  config: Http1Config
  connections: Http1Connection[]
  date: HttpDate
  fds: i32[]
  outputs: Http1OutputPool
  inputs: Http1OutputPool
  heads: Http1OutputPool
  scratch: u8[]
  requests: u8[][]
  body: u8[]
  names: u8[][]
  values: u8[][]
  now: i64 = 0
  sum: i64 = 0

  constructor(count: i32) {
    const config: Http1Config = new Http1Config()
    config.idleInput = true
    this.config = config
    this.connections = []
    this.fds = []
    this.outputs = new Http1OutputPool(config.outputSize)
    this.inputs = new Http1OutputPool(IDLE_FIRST_INPUT)
    this.heads = new Http1OutputPool(IDLE_FIRST_HEAD)
    this.date = new HttpDate()
    this.date.pin(toI64(1700000000) * toI64(1000))
    this.scratch = new Array<u8>(config.chunkSize)
    this.requests = [request(), post()]
    this.body = ascii('{"id":42,"name":"widget","price":1999,"tags":["a","b"],"ok":true}')
    this.names = [ascii("content-type")]
    this.values = [ascii("application/json")]
    for (let i: i32 = 0; i < count; i += 1) {
      const conn: Http1Connection = new Http1Connection(config)
      conn.pool = this.outputs
      conn.date = this.date
      conn.inputs = this.inputs
      conn.heads = this.heads
      this.connections.push(conn)
      this.fds.push(i + 3)
    }
  }

  /** As `Http1Server.holds`. */
  holds(slot: i32): boolean {
    return slot >= 0 && slot < toI32(this.fds.length) && this.fds[slot] >= 0
  }

  /** As `Http1Server.readable`, the socket holding `req`. */
  readable(slot: i32, req: u8[]): i32 {
    if (!this.holds(slot)) {
      return 16
    }
    this.date.hold()
    const conn: Http1Connection = this.connections[slot]
    let at: i32 = 0
    let moved: boolean = false
    while (true) {
      const room: i32 = conn.inputRoom()
      const want: i32 = room < toI32(this.scratch.length) ? room : toI32(this.scratch.length)
      if (want <= 0) {
        break
      }
      // The read: what is left of the request, as `netRead` copies it in.
      const left: i32 = toI32(req.length) - at
      const n: i32 = left < want ? left : want
      if (n <= 0) {
        break
      }
      copyBytes(this.scratch, 0, req, at, n)
      at = at + n
      moved = true
      conn.feed(this.scratch, 0, n)
      if (n < want) {
        break
      }
    }
    if (at !== toI32(req.length)) {
      panic("bench: the connection took less than a request")
    }
    if (moved) {
      this.now = this.now + toI64(1000)
      conn.lastActive = this.now
      conn.headArrived(this.now)
    }
    return this.settle(slot)
  }

  /** As `Http1Server.next`. */
  next(slot: i32): i32 {
    if (!this.holds(slot)) {
      return 7
    }
    const conn: Http1Connection = this.connections[slot]
    if (conn.writeHeld) {
      this.send(slot)
    }
    return conn.next()
  }

  /** As `Http1Server.flush`. */
  flush(slot: i32): i32 {
    this.date.unhold()
    return this.settle(slot)
  }

  /** As `Http1Server.settle`. */
  settle(slot: i32): i32 {
    if (!this.holds(slot)) {
      return 16
    }
    const conn: Http1Connection = this.connections[slot]
    this.send(slot)
    if (conn.isDone()) {
      return 16
    }
    conn.park()
    let wants: i32 = 0
    if (conn.inputRoom() > 0) {
      wants = wants | 1
    }
    if (conn.wantsWrite()) {
      wants = wants | 2
    }
    return wants
  }

  /** As `Http1Server.send`, with a socket that takes everything. */
  send(slot: i32): void {
    const conn: Http1Connection = this.connections[slot]
    const pending: i32 = conn.outputEnd - conn.outputStart
    if (pending > 0) {
      this.sum = this.sum + toI64(pending) + toI64(conn.output[conn.outputStart + 9])
      conn.consume(pending)
      conn.lastActive = this.now
    }
    conn.release()
  }

  /** One request on `slot`, as a program's loop over the server serves it. */
  serve(slot: i32, req: u8[]): void {
    if (this.readable(slot, req) !== 1) {
      panic("bench: the connection does not want to read")
    }
    const conn: Http1Connection = this.connections[slot]
    let event: i32 = this.next(slot)
    while (event !== H1_NEED_MORE) {
      if (event === H1_REQUEST) {
        // The handler runs at the end of the body.
      } else if (event === H1_BODY) {
        this.sum = this.sum + toI64(conn.dataLength) + toI64(conn.data[conn.dataStart])
      } else if (event === H1_END) {
        const n: i32 = toI32(this.body.length)
        if (conn.respond(200, this.names, this.values, n) !== 0 || conn.write(this.body, 0, n) !== n) {
          panic("bench: the response was refused")
        }
        conn.end()
      } else {
        panic(`bench: unexpected event ${event}`)
      }
      event = this.next(slot)
    }
    if (this.flush(slot) !== 1) {
      panic("bench: the connection does not want to read")
    }
  }
}

declare function open(path: string, flags: i32): i32
declare function read(fd: i32, buf: u8[], n: u64): i64
declare function close(fd: i32): i32

/**
 * This process's peak resident set in KiB, the `VmHWM` line of
 * /proc/self/status: the peak of this image alone, where `getrusage`'s
 * `ru_maxrss` also keeps the peak of the image that exec replaced (taskset's,
 * or the forking runner's).
 */
const peakKib = (): i64 => {
  const fd: i32 = open("/proc/self/status", 0)
  if (fd < 0) {
    panic("bench: cannot open /proc/self/status")
  }
  const buf: u8[] = new Array<u8>(8192)
  const n: i32 = toI32(read(fd, buf, toU64(buf.length)))
  close(fd)
  const key: u8[] = ascii("VmHWM:")
  for (let at: i32 = 0; at + toI32(key.length) < n; at += 1) {
    let same: boolean = true
    for (let k: i32 = 0; k < toI32(key.length); k += 1) {
      if (buf[at + k] !== key[k]) {
        same = false
        break
      }
    }
    if (same) {
      let v: i64 = 0
      for (let k: i32 = at + toI32(key.length); k < n && buf[k] !== 10; k += 1) {
        if (buf[k] >= 48 && buf[k] <= 57) {
          v = v * 10 + toI64(buf[k] - 48)
        }
      }
      return v
    }
  }
  panic("bench: no VmHWM in /proc/self/status")
}

/** `HTTP1_FIRST_INPUT` and `HTTP1_FIRST_HEAD`, the sizes `Http1Server` makes its lending pools at. */
const IDLE_FIRST_INPUT: i32 = 1024
const IDLE_FIRST_HEAD: i32 = 256

/** The idle and rss shapes: `count` slots of an `IdlePool`, a GET and a POST in turn. */
const idle = (shape: string, requests: i32, count: i32, batches: i32): i32 => {
  const b: IdlePool = new IdlePool(count)
  // One untimed pass, as for the other shapes: every slot's connection has
  // served a request and parked, its buffers lent back to the pools.
  for (let i: i32 = 0; i < count; i += 1) {
    const pick: i32 = i & 1
    b.serve(i, b.requests[pick])
  }
  if (shape === "rss") {
    console.log(`${shape} ${peakKib()} 1 ${b.sum} ${b.inputs.made} ${b.heads.made} ${b.outputs.made}`)
    return 0
  }
  b.sum = 0
  let best: i64 = 0
  let at: i32 = 0
  let turn: i32 = 0
  for (let batch: i32 = 0; batch < batches; batch += 1) {
    const started: i64 = monotonicNanos()
    for (let k: i32 = 0; k < requests; k += 1) {
      b.serve(at, b.requests[turn])
      // The GET and the POST alternate across the round, and the round's
      // length is even or odd, so each slot sees both over the batches.
      turn = turn ^ 1
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
  console.log(`${shape} ${best} ${requests} ${b.sum} ${b.inputs.made} ${b.heads.made} ${b.outputs.made}`)
  return 0
}

export const main = (): i32 => {
  const shape: string = process.argv.length > 1 ? process.argv[1] : "hot"
  const requests: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 1000000
  let count: i32 = process.argv.length > 3 ? parseInt(process.argv[3]) : 50000
  const batches: i32 = process.argv.length > 4 ? parseInt(process.argv[4]) : 5
  if (shape === "idle" || shape === "rss") {
    return idle(shape, requests, count, batches)
  }
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
