// The server half of `net_grpc`: one `HttpServer` with an h2c listener, an
// HTTP/1.1 listener, and (when signed) an HTTP/2 over TLS listener on
// loopback, a `GrpcServer` over it, and the program that answers its calls.
// `step` has the shape the scripted clients of `./client` turn a server's
// loop with.
//
// Besides the unary calls it answers one streaming method of each kind, as a
// program would over `take`: SumAll (client streaming) and Echo
// (bidirectional) on routes marked `streamBody`, read with `open` and `next`
// each time `take` hands them over again, and Count (server streaming), read
// with `call` and fed with `send` while `pending` stays under `RIG_BUDGET`.
import { Secret } from "nish:secret"
import { netLocalPort, tcpListen } from "nish:net"
import {
  GRPC_CALL,
  GRPC_END,
  GRPC_ENDED,
  GRPC_INVALID_ARGUMENT,
  GRPC_MESSAGE,
  GRPC_MORE,
  GRPC_NOT_FOUND,
  GRPC_OK,
  GRPC_PERMISSION_DENIED,
  GrpcLimits,
  GrpcServer,
} from "nish/net/grpc"
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server"
import { Http1Config } from "nish/net/http1-server"
import { Http2Config } from "nish/net/http2"
import { H2_ALPN } from "nish/net/http2-tls"
import { ProtoReader, ProtoWriter, PROTO_OK } from "nish/net/protobuf"
import { Router, RouterLimits } from "nish/net/router"
import { tcpConfig } from "../net_tls_common/server"
import { ZERO } from "../net_tls_record_common/bytes"

// The routes, in the order they are added.
const GET_SUM: i32 = 0
const DENIED: i32 = 1
const MISSING: i32 = 2
const SLOW: i32 = 3
const CONTROL: i32 = 4
const SUM_ALL: i32 = 5
const COUNT: i32 = 6
const ECHO: i32 = 7

/** How many reply bytes Count lets the server hold unsent before it waits for them to drain. */
export const RIG_BUDGET: i32 = 4096

/** The most padding a Count reply carries. */
export const RIG_MAX_PAD: i32 = 4096

/** `GrpcLimits.maxMessage` on the rig: small, so a declared length past it fits in a test. */
export const RIG_MAX_MESSAGE: i32 = 64

/** `/benchmark.BenchmarkService/Denied`'s `grpc-message`: printable ASCII, a `%`, and two bytes of UTF-8. */
export const RIG_DENIED: string = "no 100% é"

/** `/benchmark.BenchmarkService/Control`'s `grpc-message`: a CR, an LF and a NUL, each of which would end a field sent raw. */
export const RIG_CONTROL: string = "a\r\nb\u0000c"

/** The server, its listeners, the gRPC layer over it, and the program answering its calls. */
export class GrpcRig {
  h: HttpServer
  grpc: GrpcServer
  /** HTTP/2 over TLS's port, when signed. */
  port: i32 = 0
  h2cPort: i32 = 0
  h1Port: i32 = 0
  signed: boolean = false
  /** `/Slow`'s calls, held until `answerHeld`. */
  held: HttpServerRequest[]
  /** The reply's buffer, reused for every call. */
  out: ProtoWriter
  /** How many calls `call` handed to the program. */
  calls: i32 = 0
  /** What `reply` and `fail` answered, in the order they were called; `finish` too, for the streaming calls. */
  results: i32[]
  /** SumAll's and Echo's calls, open until their stream ends, and SumAll's running total for each. */
  streams: HttpServerRequest[]
  totals: i32[]
  /** Count's calls, still sending: how many replies each has left, the next one's result, and its padding. */
  senders: HttpServerRequest[]
  left: i32[]
  counts: i32[]
  pads: i32[]
  /** Count's reply buffer, and the padding it copies from. */
  big: ProtoWriter
  padding: u8[]
  /** How many streaming calls `next` or `send` ended itself, with no answer of the program's. */
  closed: i32 = 0
  /** The most reply bytes `send` said were still queued, over every Count call. */
  maxPending: i32 = 0
  /** A server with `slots` connections per listener: h2c and HTTP/1.1, and HTTP/2 over TLS when `signed`; `maxTimeout` in ms caps each call's deadline. */
  constructor(signed: boolean, slots: i32, maxTimeout: i32) {
    const router = new Router(new RouterLimits())
    router.add("POST", "/benchmark.BenchmarkService/GetSum")
    router.add("POST", "/benchmark.BenchmarkService/Denied")
    router.add("POST", "/benchmark.BenchmarkService/Missing")
    router.add("POST", "/benchmark.BenchmarkService/Slow")
    router.add("POST", "/benchmark.BenchmarkService/Control")
    router.add("POST", "/benchmark.BenchmarkService/SumAll")
    router.add("POST", "/benchmark.BenchmarkService/Count")
    router.add("POST", "/benchmark.BenchmarkService/Echo")
    this.h = new HttpServer(new HttpServerLimits(), router)
    this.h.streamBody(SUM_ALL)
    this.h.streamBody(ECHO)
    const limits = new GrpcLimits()
    limits.maxMessage = RIG_MAX_MESSAGE
    limits.maxTimeout = maxTimeout
    this.grpc = new GrpcServer(this.h, limits)
    this.signed = signed
    const clear: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenH2c(clear, new Http2Config(), slots)
    this.h2cPort = netLocalPort(clear)
    const plain: i32 = tcpListen("127.0.0.1", 0, 16)
    this.h.listenHttp1(plain, new Http1Config(), slots)
    this.h1Port = netLocalPort(plain)
    if (signed) {
      const tcp: i32 = tcpListen("127.0.0.1", 0, 16)
      this.h.listenHttp2Tls(tcp, tcpConfig([H2_ALPN]), new Http2Config(), slots)
      this.port = netLocalPort(tcp)
    }
    this.held = []
    this.out = new ProtoWriter(new Array<u8>(16))
    this.results = []
    this.streams = []
    this.totals = []
    this.senders = []
    this.left = []
    this.counts = []
    this.pads = []
    this.big = new ProtoWriter(new Array<u8>(RIG_MAX_PAD + 16))
    this.padding = new Array<u8>(RIG_MAX_PAD)
  }

  /** One turn of the server's loop, at most `wait` ms, signing with `key` when `signed`, then an answer to every request it took. */
  step(wait: i32, key: Secret<u8[]>): void {
    if (this.signed) {
      this.h.waitSigned(wait, key)
    } else {
      this.h.wait(wait)
    }
    while (this.h.ready()) {
      this.answer(this.h.take())
    }
    // A stream whose client has gone quiet is not handed over again: its deadline is checked here.
    for (let k: i32 = toI32(this.streams.length) - 1; k >= 0; k--) {
      if (this.grpc.expired(this.streams[k])) {
        this.pump(k)
      }
    }
    for (let k: i32 = toI32(this.senders.length) - 1; k >= 0; k--) {
      this.feed(k)
    }
  }

  /** Answers every call `/Slow` holds with GetSum's answer to its message; how many there were. */
  answerHeld(): i32 {
    const n: i32 = toI32(this.held.length)
    const held: HttpServerRequest[] = this.held
    this.held = []
    for (const r of held) {
      this.getSum(r)
    }
    return n
  }

  /** GetSum: `SumRequest { int32 a = 1; int32 b = 2; }` in, `SumReply { int32 result = 1; }` out. */
  private getSum(r: HttpServerRequest): void {
    const msg = new ProtoReader(r.body, this.grpc.messageStart(r), r.bodyLength)
    let a: i32 = 0
    let b: i32 = 0
    while (msg.next()) {
      if (msg.field === 1) {
        a = msg.int32()
      } else if (msg.field === 2) {
        b = msg.int32()
      }
    }
    if (msg.failed !== PROTO_OK) {
      this.results.push(this.grpc.fail(r, GRPC_NOT_FOUND, ""))
      return
    }
    this.out.reset()
    this.out.int32(1, a + b)
    this.results.push(this.grpc.reply(r, this.out.buf, ZERO, this.out.end))
  }

  /** SumRequest `a + b` from `buf[from .. to)`, or -1 when it does not parse. */
  private sumIn(buf: u8[], from: i32, to: i32): i32 {
    const msg = new ProtoReader(buf, from, to)
    let sum: i32 = 0
    while (msg.next()) {
      if (msg.field === 1 || msg.field === 2) {
        sum = sum + msg.int32()
      }
    }
    return msg.failed === PROTO_OK ? sum : -1
  }

  /** The index of `r` in `streams`, or -1 before `open` read it. */
  private streamOf(r: HttpServerRequest): i32 {
    for (let k: i32 = 0; k < toI32(this.streams.length); k++) {
      if (this.streams[k] === r) {
        return k
      }
    }
    return -1
  }

  /** Drops `streams[k]`, its call over. */
  private unstream(k: i32): void {
    const last: i32 = toI32(this.streams.length) - 1
    this.streams[k] = this.streams[last]
    this.totals[k] = this.totals[last]
    this.streams.pop()
    this.totals.pop()
  }

  /**
   * Reads every message `streams[k]` has in: SumAll adds each to its total
   * and replies with it at the end of the stream; Echo sends each one's sum
   * back at once and finishes at the end. Stops at `GRPC_MORE`, until `take`
   * hands the call over again.
   */
  private pump(k: i32): void {
    const r: HttpServerRequest = this.streams[k]
    for (;;) {
      const got: i32 = this.grpc.next(r)
      if (got === GRPC_MORE) {
        return
      }
      if (got === GRPC_MESSAGE) {
        const sum: i32 = this.sumIn(this.grpc.messageBytes(r), this.grpc.messageStart(r), this.grpc.messageEnd(r))
        if (sum < 0) {
          this.results.push(this.grpc.fail(r, GRPC_INVALID_ARGUMENT, ""))
          break
        }
        if (r.route === SUM_ALL) {
          this.totals[k] = this.totals[k] + sum
          continue
        }
        this.out.reset()
        this.out.int32(1, sum)
        if (this.grpc.send(r, this.out.buf, ZERO, this.out.end) === GRPC_ENDED) {
          this.closed = this.closed + 1
          break
        }
        continue
      }
      if (got === GRPC_END) {
        if (r.route === SUM_ALL) {
          this.out.reset()
          this.out.int32(1, this.totals[k])
          this.results.push(this.grpc.reply(r, this.out.buf, ZERO, this.out.end))
        } else {
          this.results.push(this.grpc.finish(r, GRPC_OK, ""))
        }
        break
      }
      this.closed = this.closed + 1
      break
    }
    this.unstream(k)
  }

  /** Drops `senders[k]`, its call over. */
  private unsend(k: i32): void {
    const last: i32 = toI32(this.senders.length) - 1
    this.senders[k] = this.senders[last]
    this.left[k] = this.left[last]
    this.counts[k] = this.counts[last]
    this.pads[k] = this.pads[last]
    this.senders.pop()
    this.left.pop()
    this.counts.pop()
    this.pads.pop()
  }

  /**
   * Sends `senders[k]` more of its replies while the server holds no more
   * than `RIG_BUDGET` of its bytes unsent, then waits for them to drain
   * before finishing. A client that hung up, or a deadline that passed while
   * the call waited, ends it with `finish`, which answers DEADLINE_EXCEEDED
   * for the second.
   */
  private feed(k: i32): void {
    const r: HttpServerRequest = this.senders[k]
    while (this.left[k] > 0 && this.h.pending(r) <= RIG_BUDGET) {
      this.big.reset()
      this.big.int32(1, this.counts[k])
      if (this.pads[k] > 0) {
        this.big.bytes(2, this.padding, ZERO, this.pads[k])
      }
      const queued: i32 = this.grpc.send(r, this.big.buf, ZERO, this.big.end)
      if (queued === GRPC_ENDED) {
        this.closed = this.closed + 1
        this.unsend(k)
        return
      }
      if (queued > this.maxPending) {
        this.maxPending = queued
      }
      this.left[k] = this.left[k] - 1
      this.counts[k] = this.counts[k] + 1
    }
    if ((this.left[k] === 0 && this.h.pending(r) === 0) || this.h.hungUp(r) || this.grpc.expired(r)) {
      this.results.push(this.grpc.finish(r, GRPC_OK, ""))
      this.unsend(k)
    }
  }

  /** Count: `CountRequest { int32 count = 1; int32 start = 2; int32 pad = 3; }` in, `count` replies `CountReply { int32 result = 1; bytes pad = 2; }` out, from `start` up. */
  private count(r: HttpServerRequest): void {
    const msg = new ProtoReader(r.body, this.grpc.messageStart(r), this.grpc.messageEnd(r))
    let count: i32 = 0
    let start: i32 = 0
    let pad: i32 = 0
    while (msg.next()) {
      if (msg.field === 1) {
        count = msg.int32()
      } else if (msg.field === 2) {
        start = msg.int32()
      } else if (msg.field === 3) {
        pad = msg.int32()
      }
    }
    if (msg.failed !== PROTO_OK || count < 0 || pad < 0 || pad > RIG_MAX_PAD) {
      this.results.push(this.grpc.fail(r, GRPC_INVALID_ARGUMENT, ""))
      return
    }
    this.senders.push(r)
    this.left.push(count)
    this.counts.push(start)
    this.pads.push(pad)
    this.feed(toI32(this.senders.length) - 1)
  }

  /** The program: each call's answer; `call` and `open` have answered the rest. */
  answer(r: HttpServerRequest): void {
    if (r.route === SUM_ALL || r.route === ECHO) {
      let k: i32 = this.streamOf(r)
      if (k < 0) {
        if (this.grpc.open(r) !== GRPC_CALL) {
          return
        }
        this.calls = this.calls + 1
        this.streams.push(r)
        this.totals.push(0)
        k = toI32(this.streams.length) - 1
      }
      this.pump(k)
      return
    }
    if (this.grpc.call(r) !== GRPC_CALL) {
      return
    }
    this.calls = this.calls + 1
    switch (r.route) {
      case GET_SUM:
        this.getSum(r)
        break
      case DENIED:
        this.results.push(this.grpc.fail(r, GRPC_PERMISSION_DENIED, RIG_DENIED))
        break
      case MISSING:
        this.results.push(this.grpc.fail(r, GRPC_NOT_FOUND, ""))
        break
      case SLOW:
        this.held.push(r)
        break
      case CONTROL:
        this.results.push(this.grpc.fail(r, GRPC_INVALID_ARGUMENT, RIG_CONTROL))
        break
      case COUNT:
        this.count(r)
        break
      default:
        this.h.refuse(r)
    }
  }
}
