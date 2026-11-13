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
//   main idle <requests> <connections> <batches> [evict]
//                                                the same over an
//                                                `Http1Server`-shaped pool with
//                                                `Http1Config.idleInput` on:
//                                                each request is read through
//                                                the server's scratch buffer,
//                                                and each connection lends its
//                                                input and head buffers back
//                                                when it parks
//   main direct <requests> <connections> <batches> [evict]
//                                                the idle shape with the read
//                                                landing in the lent input
//                                                buffer itself, no scratch copy:
//                                                a variant `Http1Server` does
//                                                not have, measured here only
//   main rss <passes> <connections> 0            the idle pool's connections
//                                                each served <passes> requests
//                                                (0 is one) and parked, then
//                                                nothing timed: prints the
//                                                peak RSS in KiB (VmHWM) as
//                                                `<ns>`
//   main rss-default <passes> <connections> 0    the rss shape on the default
//                                                config: no `idleInput`, so a
//                                                parked connection keeps its
//                                                input and head buffers
//
// With `[evict]` MiB (default 0), the idle and direct shapes write one byte
// of every cache line of an eviction ring that big between requests, a slice
// per request so that each round over the connections sweeps all of it: with
// a ring larger than the last-level cache, every request finds its connection
// in DRAM, as on a server whose kernel and other work run between one
// connection's requests. Only the requests are timed then, each between two
// clock reads, and the sweep is not.
//
// Times `<batches>` batches of `<requests>` requests (default 5 of 1000000)
// and prints `<shape> <ns> <requests> <checksum>` for the fastest batch; the
// checksum adds up every response's length and tenth byte (the status's
// first digit), and in the idle and direct shapes each request's method,
// target and `Content-Type` as the handler matches them and every body byte
// count and first body byte, over all batches, so two builds that answer
// differently disagree on it.

import { copyBytes } from "nish/bytes"
import { netRead, netWrite2, unixSocketPair } from "nish:net"
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
import { Http1Parser } from "nish/net/http1-codec"

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
  /** Read into the lent input buffer, not the scratch: the `direct` shape. */
  direct: boolean = false
  /** The eviction ring, the slice of it each request sweeps, and where the next slice starts. */
  ring: u8[]
  slice: i32 = 0
  ringAt: i32 = 0

  constructor(count: i32, direct: boolean, evictMib: i32, idleInput: boolean) {
    const config: Http1Config = new Http1Config()
    config.idleInput = idleInput
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
    this.direct = direct
    this.ring = new Array<u8>(evictMib * 1048576)
    if (evictMib > 0) {
      // A whole number of lines per request, at least one round's worth of
      // slices to the ring.
      this.slice = ((evictMib * 1048576) / count / 64) * 64
      if (this.slice < 64) {
        panic("bench: the eviction ring is smaller than a line per connection")
      }
    }
    for (let i: i32 = 0; i < count; i += 1) {
      const conn: Http1Connection = new Http1Connection(config)
      conn.pool = this.outputs
      conn.date = this.date
      if (idleInput) {
        conn.inputs = this.inputs
        conn.heads = this.heads
      }
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
      if (this.direct) {
        // The read into the parser's own buffer when the room `inputRoom`
        // gave fits in it: what `feed` does after the read, without the copy.
        conn.unpark()
        const p: Http1Parser = conn.parser
        if (toI32(p.buf.length) - p.end >= n) {
          copyBytes(p.buf, p.end, req, at, n)
          p.end = p.end + n
        } else {
          copyBytes(this.scratch, 0, req, at, n)
          conn.feed(this.scratch, 0, n)
        }
      } else {
        copyBytes(this.scratch, 0, req, at, n)
        conn.feed(this.scratch, 0, n)
      }
      at = at + n
      moved = true
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
        // The handler's routing, on the head; it answers at the end of the body.
        const p: Http1Parser = conn.parser
        if (p.methodIs("GET") && p.targetIs("/api/v1/items/42")) {
          this.sum = this.sum + toI64(1)
        } else if (p.methodIs("POST") && p.targetIs("/api/v1/orders")) {
          this.sum = this.sum + toI64(2)
        } else {
          panic("bench: the request was routed nowhere")
        }
        if (p.headerIs("content-type", "application/json")) {
          this.sum = this.sum + toI64(4)
        }
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

  /** Writes a byte of every line of the ring's next slice. */
  sweep(): void {
    const ring: u8[] = this.ring
    const end: i32 = this.ringAt + this.slice
    for (let k: i32 = this.ringAt; k < end; k += 64) {
      ring[k] = toU8(ring[k] + 1)
    }
    this.ringAt = end + this.slice <= toI32(ring.length) ? end : 0
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

/**
 * The idle, direct and rss shapes: `count` slots of an `IdlePool`. Slot `i`
 * serves the GET on even rounds over the slots and the POST on odd ones when
 * `i` is even, the other way round when it is odd.
 */
const idle = (shape: string, requests: i32, count: i32, batches: i32, evictMib: i32): i32 => {
  const measuring: boolean = shape === "rss" || shape === "rss-default"
  const b: IdlePool = new IdlePool(count, shape === "direct", evictMib, shape !== "rss-default")
  const evicting: boolean = b.slice > 0
  // One untimed pass, as for the other shapes: every slot's connection has
  // served a request and parked, its buffers lent back to the pools, and the
  // whole ring has been written once. The rss shapes make `requests` passes,
  // at least one: a slot keeps its response head from its second on.
  const passes: i32 = measuring && requests > 1 ? requests : 1
  for (let pass: i32 = 0; pass < passes; pass += 1) {
    for (let i: i32 = 0; i < count; i += 1) {
      if (evicting) {
        b.sweep()
      }
      const pick: i32 = (i + pass) & 1
      b.serve(i, b.requests[pick])
    }
  }
  if (measuring) {
    console.log(`${shape} ${peakKib()} ${passes} ${b.sum} ${b.inputs.made} ${b.heads.made} ${b.outputs.made}`)
    return 0
  }
  b.sum = 0
  let best: i64 = 0
  let at: i32 = 0
  let round: i32 = 1
  for (let batch: i32 = 0; batch < batches; batch += 1) {
    let timed: i64 = 0
    const started: i64 = monotonicNanos()
    for (let k: i32 = 0; k < requests; k += 1) {
      const pick: i32 = (at + round) & 1
      const req: u8[] = b.requests[pick]
      if (evicting) {
        b.sweep()
        const before: i64 = monotonicNanos()
        b.serve(at, req)
        timed = timed + (monotonicNanos() - before)
      } else {
        b.serve(at, req)
      }
      at += 1
      if (at === count) {
        at = 0
        round += 1
      }
    }
    const ns: i64 = evicting ? timed : monotonicNanos() - started
    if (batch === 0 || ns < best) {
      best = ns
    }
  }
  console.log(`${shape} ${best} ${requests} ${b.sum} ${b.inputs.made} ${b.heads.made} ${b.outputs.made}`)
  return 0
}

/**
 * The GET the challenge's load generator sends for an article list, its
 * headers in its order, with an `Authorization: Token` the length of the
 * HS256 JWT it signs (147 bytes): about 300 head bytes and no body.
 */
const articles = (): u8[] => {
  const alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  const parts: string[] = ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."]
  let x: i32 = 11
  for (let n: i32 = 37; n < 147; n += 1) {
    x = (x * 1103 + 12345) & 65535
    parts.push(n === 103 ? "." : alphabet.substring(x & 63, (x & 63) + 1))
  }
  return ascii(
    "GET /api/articles?limit=10&offset=20 HTTP/1.1\r\n" +
      "Host: 127.0.0.1:8080\r\n" +
      "User-Agent: conduit-loadgen/1\r\n" +
      "Accept: application/json\r\n" +
      "Accept-Encoding: gzip\r\n" +
      `Authorization: Token ${parts.join("")}\r\n` +
      "\r\n"
  )
}

/** A 2,600-byte JSON answer, the size of the article list the challenge returns. */
const articleList = (): u8[] => {
  const parts: string[] = ['{"articles":[']
  let len: i32 = 13
  let k: i32 = 0
  while (len < 2560) {
    const item: string =
      `${k > 0 ? "," : ""}{"slug":"article-${k}","title":"Title ${k}","favoritesCount":${k * 7},` +
      `"author":{"username":"user${k}","following":false}}`
    parts.push(item)
    len += item.length
    k += 1
  }
  const tail: string = `],"articlesCount":${k}}`
  parts.push(tail)
  len += tail.length
  const out: u8[] = ascii(parts.join(""))
  while (toI32(out.length) < 2600) {
    out.push(toU8(32))
  }
  return out
}

/** The answer goes out through `sendBody`; run.mjs builds a base without it with `write`. */
const VIA_SEND_BODY: boolean = true

/**
 * The stages shape: `count` slots of an `IdlePool` answering the load
 * generator's GET with 2,600 bytes through `sendBody`, each slot's socket one
 * end of a Unix stream pair the bench drains between requests, so the
 * response really crosses `sendmsg`. Requests go round-robin, so each lands
 * on a connection that has rested while every other one was served.
 *
 * A request is cut by a clock read between stages, eight in all:
 *   recv      `readable`: room, the read into the scratch, `feed` (and the
 *             lending `unpark` does), `headArrived`, and its `settle`
 *   parse     the `next` that answers `H1_REQUEST`: the head parsed
 *   dispatch  the `next` that answers `H1_END`, and the `next` after the
 *             answer that answers `H1_NEED_MORE`: the event path
 *   respond   `respond`: the head built, `Date` and all
 *   sendBody  `sendBody` and `end`: the write path, the `sendmsg` included
 *   park      `flush`: `send`, `release`, `isDone`, `park`, the interest
 * Each span holds one clock read. Before the requests, the same number of
 * bare clock reads and of bare `netWrite2` calls on the same socket with the
 * same head and body lengths, each between two clock reads, are timed the
 * same way; run.mjs subtracts the first from every span and the second from
 * `sendBody`, leaving the library's own cost.
 *
 * Prints `stages <ns> <requests> <checksum> <made...>` for the batch with the
 * smallest total, `<ns>` the sum of its spans, then a second line:
 * `clock <ns> writev <ns>` and `<stage> <ns>` for each stage, every figure a
 * total over `requests`.
 */
const stages = (requests: i32, count: i32, batches: i32, calibrate: boolean): i32 => {
  const b: IdlePool = new IdlePool(count, false, 0, true)
  const req: u8[] = articles()
  const body: u8[] = articleList()
  const n: i32 = toI32(body.length)
  const names: u8[][] = [ascii("Content-Type")]
  const values: u8[][] = [ascii("application/json")]
  const pair: i32[] = [-1, -1]
  if (unixSocketPair(1, pair) !== 0) {
    panic("bench: no Unix socket pair")
  }
  const drain: u8[] = new Array<u8>(65536)
  for (let i: i32 = 0; i < count; i += 1) {
    b.connections[i].fd = pair[0] // sendBody only
  }
  let sum: i64 = 0
  let headLen: i32 = 0
  let bestSpans: i64 = 0
  let bestStages: i64[] = []
  // One untimed pass: every slot has served the GET and parked.
  for (let pass: i32 = 0; pass <= batches; pass += 1) {
    const at: i64[] = [0, 0, 0, 0, 0, 0, 0]
    let k: i32 = 0
    let slot: i32 = 0
    const total: i32 = pass === 0 ? count : requests
    while (k < total) {
      const conn: Http1Connection = b.connections[slot]
      const t0: i64 = monotonicNanos()
      if (b.readable(slot, req) !== 1) {
        panic("bench: the connection does not want to read")
      }
      const t1: i64 = monotonicNanos()
      if (b.next(slot) !== H1_REQUEST) {
        panic("bench: no request")
      }
      const t2: i64 = monotonicNanos()
      if (b.next(slot) !== H1_END) {
        panic("bench: the GET did not end")
      }
      const t3: i64 = monotonicNanos()
      if (conn.respond(200, names, values, n) !== 0) {
        panic("bench: the response was refused")
      }
      const t4: i64 = monotonicNanos()
      headLen = conn.outputEnd - conn.outputStart
      sum = sum + toI64(headLen) + toI64(conn.output[conn.outputStart + 9])
      const sent: i32 = conn.sendBody(body, 0, n)
      conn.end()
      const t5: i64 = monotonicNanos()
      if (b.next(slot) !== H1_NEED_MORE) {
        panic("bench: an event after the answer")
      }
      const t6: i64 = monotonicNanos()
      if (b.flush(slot) !== 1) {
        panic("bench: the connection does not want to read")
      }
      const t7: i64 = monotonicNanos()
      sum = sum + toI64(sent)
      at[0] = at[0] + (t1 - t0)
      at[1] = at[1] + (t2 - t1)
      at[2] = at[2] + (t3 - t2) + (t6 - t5)
      at[3] = at[3] + (t4 - t3)
      at[4] = at[4] + (t5 - t4)
      at[5] = at[5] + (t7 - t6)
      let got: i32 = 1
      while (got > 0) {
        got = netRead(pair[1], drain, 0, toI32(drain.length))
      }
      k += 1
      slot += 1
      if (slot === count) {
        slot = 0
      }
    }
    if (pass === 0) {
      sum = 0
      continue
    }
    let spans: i64 = 0
    for (let s: i32 = 0; s < 6; s += 1) {
      spans = spans + at[s]
    }
    if (pass === 1 || spans < bestSpans) {
      bestSpans = spans
      bestStages = at
    }
  }
  // The clock alone: as many reads as the requests make spans, back to back.
  let clock: i64 = 0
  let writev: i64 = 0
  for (let pass: i32 = 0; calibrate && pass < batches; pass += 1) {
    const started: i64 = monotonicNanos()
    let last: i64 = started
    for (let k: i32 = 0; k < requests; k += 1) {
      last = monotonicNanos()
    }
    const c: i64 = last - started
    if (pass === 0 || c < clock) {
      clock = c
    }
    // `sendBody`'s system call alone, on the same socket with the same lengths.
    const head: u8[] = new Array<u8>(headLen)
    let w: i64 = 0
    for (let k: i32 = 0; VIA_SEND_BODY && k < requests; k += 1) {
      const before: i64 = monotonicNanos()
      netWrite2(pair[0], head, 0, headLen, body, 0, n)
      w = w + (monotonicNanos() - before)
      let got: i32 = 1
      while (got > 0) {
        got = netRead(pair[1], drain, 0, toI32(drain.length))
      }
    }
    if (pass === 0 || w < writev) {
      writev = w
    }
  }
  console.log(`stages ${bestSpans} ${requests} ${sum} ${b.inputs.made} ${b.heads.made} ${b.outputs.made}`)
  const cells: string[] = [`clock ${clock} writev ${writev}`]
  // The stages one request is cut into, in the order they run.
  const named: string[] = ["recv", "parse", "dispatch", "respond", "sendBody", "park"]
  for (let s: i32 = 0; s < 6; s += 1) {
    cells.push(`${named[s]} ${bestStages[s]}`)
  }
  console.log(cells.join(" "))
  return 0
}

export const main = (): i32 => {
  const shape: string = process.argv.length > 1 ? process.argv[1] : "hot"
  const requests: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 1000000
  let count: i32 = process.argv.length > 3 ? parseInt(process.argv[3]) : 50000
  const batches: i32 = process.argv.length > 4 ? parseInt(process.argv[4]) : 5
  const evictMib: i32 = process.argv.length > 5 ? parseInt(process.argv[5]) : 0
  // The ring is evictMib * 1048576 bytes in an i32: 2048 MiB is past it.
  if (evictMib < 0 || evictMib > 2047) {
    panic("bench: the eviction ring must be 0 to 2047 MiB")
  }
  // stages-loop is the stages shape without its calibration, for counting
  // the loop alone under perf stat.
  if (shape === "stages" || shape === "stages-loop") {
    return stages(requests, count, batches, shape === "stages")
  }
  if (shape === "idle" || shape === "direct" || shape === "rss" || shape === "rss-default") {
    return idle(shape, requests, count, batches, evictMib)
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
