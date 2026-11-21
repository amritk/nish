// The server half of `net_grpc`: one `HttpServer` with an h2c listener, an
// HTTP/1.1 listener, and (when signed) an HTTP/2 over TLS listener on
// loopback, a `GrpcServer` over it, and the program that answers its calls.
// `step` has the shape the scripted clients of `./client` turn a server's
// loop with.
import { Secret } from "nish:secret"
import { netLocalPort, tcpListen } from "nish:net"
import { GRPC_CALL, GRPC_INVALID_ARGUMENT, GRPC_NOT_FOUND, GRPC_PERMISSION_DENIED, GrpcLimits, GrpcServer } from "nish/net/grpc"
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
  /** What `reply` and `fail` answered, in the order they were called. */
  results: i32[]

  /** A server with `slots` connections per listener: h2c and HTTP/1.1, and HTTP/2 over TLS when `signed`; `maxTimeout` in ms caps each call's deadline. */
  constructor(signed: boolean, slots: i32, maxTimeout: i32) {
    const router = new Router(new RouterLimits())
    router.add("POST", "/benchmark.BenchmarkService/GetSum")
    router.add("POST", "/benchmark.BenchmarkService/Denied")
    router.add("POST", "/benchmark.BenchmarkService/Missing")
    router.add("POST", "/benchmark.BenchmarkService/Slow")
    router.add("POST", "/benchmark.BenchmarkService/Control")
    this.h = new HttpServer(new HttpServerLimits(), router)
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

  /** The program: each call's answer; `call` has answered the rest. */
  answer(r: HttpServerRequest): void {
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
      default:
        this.h.refuse(r)
    }
  }
}
