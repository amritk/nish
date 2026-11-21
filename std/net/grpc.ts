/**
 * `nish/net/grpc` — unary gRPC calls on `nish/net/http-server`'s HTTP/2
 * listeners (`listenHttp2Tls` and `listenH2c`). A call is a route: its
 * `:path` is `/<package>.<Service>/<Method>`, so the program adds it to the
 * server's `Router` as any other path, takes the request, and hands it here
 * to be read as a call and answered.
 *
 *     import { GrpcLimits, GrpcServer, GRPC_CALL } from "nish/net/grpc";
 *     import { ProtoReader, ProtoWriter } from "nish/net/protobuf";
 *
 *     const grpc = new GrpcServer(server, new GrpcLimits());
 *     const getSum: i32 = router.add("POST", "/benchmark.BenchmarkService/GetSum");
 *     // ... after server.wait(...):
 *     while (server.ready()) {
 *       const r = server.take();
 *       if (r.route === getSum && grpc.call(r) === GRPC_CALL) {
 *         const msg = new ProtoReader(r.body, grpc.messageStart(r), r.bodyLength);
 *         // ... decode, compute, encode the reply into w ...
 *         grpc.reply(r, w.buf, 0, w.end);
 *       }
 *     }
 *
 * **`call` reads the request and answers every fault itself.** A
 * `content-type` other than `application/grpc` or `application/grpc+proto`
 * is answered 415, and a request that did not come on HTTP/2 is answered 505,
 * as plain HTTP. The rest are gRPC statuses in the Trailers-Only form (one
 * HEADERS frame carrying `grpc-status`, ending the stream): a malformed
 * `grpc-timeout` is `INTERNAL`, a call already past its deadline
 * `DEADLINE_EXCEEDED`, a compressed message `UNIMPLEMENTED` (no
 * `grpc-encoding` is offered), a declared length past `maxMessage`
 * `RESOURCE_EXHAUSTED`, and a body that is not exactly one length-prefixed
 * message `INTERNAL`. It answers `GRPC_CALL` only for a call the program now
 * owes an answer, whose message is `r.body[messageStart(r) .. r.bodyLength)`.
 *
 * **A call's deadline** runs from when the server read its head: its
 * `grpc-timeout`, capped at `limits.maxTimeout`, or `maxTimeout` when it has
 * none. `reply` and `fail` answer `DEADLINE_EXCEEDED` instead of the
 * program's answer once it has passed.
 *
 * **The answer** is `:status` 200 and `content-type: application/grpc`, then
 * the length-prefixed reply, then a trailer section with `grpc-status: 0`
 * (`reply`); or a gRPC error (`fail`): Trailers-Only when it has no message,
 * and a head followed by a trailer section with `grpc-status` and the
 * percent-encoded `grpc-message` when it has one.
 *
 * The record of what this module refuses and why is `docs/security/grpc.md`.
 */
import { HANDLER_ABSENT, HANDLER_DROPPED, HANDLER_SENT } from "nish/net/handler"
import { httpFieldBytes } from "nish/net/http-fields"
import { HTTP1_CHUNKED } from "nish/net/http1-codec"
import { HttpServer, HttpServerRequest } from "nish/net/http-server"

/** The call succeeded. */
export const GRPC_OK: i32 = 0
/** The call was cancelled, usually by the caller. */
export const GRPC_CANCELLED: i32 = 1
/** An error with no better status. */
export const GRPC_UNKNOWN: i32 = 2
/** The caller's argument is invalid, whatever the server's state. */
export const GRPC_INVALID_ARGUMENT: i32 = 3
/** The deadline passed before the call was answered. */
export const GRPC_DEADLINE_EXCEEDED: i32 = 4
/** Something the call names was not found. */
export const GRPC_NOT_FOUND: i32 = 5
/** Something the call would create already exists. */
export const GRPC_ALREADY_EXISTS: i32 = 6
/** The caller may not do this. */
export const GRPC_PERMISSION_DENIED: i32 = 7
/** A resource ran out, a message too long for the server among them. */
export const GRPC_RESOURCE_EXHAUSTED: i32 = 8
/** The system is not in the state the call needs. */
export const GRPC_FAILED_PRECONDITION: i32 = 9
/** The call was aborted, usually by a conflict. */
export const GRPC_ABORTED: i32 = 10
/** A value was past the valid range. */
export const GRPC_OUT_OF_RANGE: i32 = 11
/** The method, or a feature the call asks for, is not implemented. */
export const GRPC_UNIMPLEMENTED: i32 = 12
/** An invariant the protocol or the server expects is broken. */
export const GRPC_INTERNAL: i32 = 13
/** The service is unavailable for now; the call may be retried. */
export const GRPC_UNAVAILABLE: i32 = 14
/** Data was lost or corrupted beyond recovery. */
export const GRPC_DATA_LOSS: i32 = 15
/** The caller is not authenticated. */
export const GRPC_UNAUTHENTICATED: i32 = 16

/** `call`'s answer for a call the program now owes an answer. */
export const GRPC_CALL: i32 = 1
/** `call`'s answer when it answered the request itself, with an HTTP status or a gRPC error; the request is the server's again. */
export const GRPC_ANSWERED: i32 = 0

/** The length prefix: one compressed-flag byte and a four-byte big-endian length. */
const GRPC_PREFIX: i32 = 5
/** The most digits `grpc-timeout` may carry before its unit. */
const GRPC_TIMEOUT_DIGITS: i32 = 8
const GRPC_NANOS_PER_MS: i64 = 1000000

/** The caps a `GrpcServer` holds its calls to. */
export class GrpcLimits {
  /** The longest request message, in bytes, the length prefix may declare; past it a call is `RESOURCE_EXHAUSTED`. 0 to 2^30. The server's `maxBody` caps the whole body first, answering 413. */
  maxMessage: i32 = 4194304
  /** The longest deadline a call is given, in milliseconds from its head, whatever its `grpc-timeout` asks. 1 to 2^31 - 1. */
  maxTimeout: i32 = 30000
}

/**
 * Reads unary gRPC calls from an `HttpServer`'s HTTP/2 requests and answers
 * them. It keeps no state per call: every answer reads the request again.
 */
export class GrpcServer {
  private server: HttpServer
  private maxMessage: i32
  private maxTimeout: i64
  private contentType: u8[][]
  private grpcType: u8[][]
  private okNames: u8[][]
  private okValues: u8[][]
  private onlyNames: u8[][]
  /** `onlyValues[s]` is `[application/grpc, "<s>"]`, the Trailers-Only fields for status `s`. */
  private onlyValues: u8[][][]
  private statusName: u8[]
  private messageName: u8[]
  private prefix: u8[]

  /**
   * A gRPC reader and answerer over `server`. Panics on a limit outside its range.
   * @param server the server whose requests `call` reads and answers
   * @param limits the message and deadline caps
   */
  constructor(server: HttpServer, limits: GrpcLimits) {
    if (limits.maxMessage < 0 || limits.maxMessage > 1073741824) {
      panic(`GrpcServer: maxMessage ${limits.maxMessage} is outside 0 to 2^30`)
    }
    if (limits.maxTimeout < 1) {
      panic(`GrpcServer: maxTimeout ${limits.maxTimeout} is below 1`)
    }
    this.server = server
    this.maxMessage = limits.maxMessage
    this.maxTimeout = toI64(limits.maxTimeout) * GRPC_NANOS_PER_MS
    const grpcType: u8[] = httpFieldBytes("application/grpc")
    this.contentType = [httpFieldBytes("content-type")]
    this.grpcType = [grpcType]
    this.statusName = httpFieldBytes("grpc-status")
    this.messageName = httpFieldBytes("grpc-message")
    this.okNames = [this.statusName]
    this.okValues = [httpFieldBytes("0")]
    this.onlyNames = [this.contentType[0], this.statusName]
    this.onlyValues = []
    for (let s: i32 = 0; s <= GRPC_UNAUTHENTICATED; s++) {
      this.onlyValues.push([grpcType, httpFieldBytes(`${s}`)])
    }
    this.prefix = [toU8(0), toU8(0), toU8(0), toU8(0), toU8(0)]
  }

  /**
   * Reads `r` as a unary call. Answers it itself, and says so, when it is
   * not one the program can answer: 415 for a `content-type` other than
   * `application/grpc` or `application/grpc+proto`, 505 off HTTP/2, and
   * otherwise a gRPC error in the Trailers-Only form (see the module's
   * comment). Never panics on what the peer sent.
   * @param r a request `take` handed over and not yet answered
   * @returns `GRPC_CALL` when the program owes `r` an answer through `reply` or `fail`, or `GRPC_ANSWERED` when `r` is the server's again
   */
  call(r: HttpServerRequest): i32 {
    if (r.version !== 2) {
      this.server.empty(r, 505)
      return GRPC_ANSWERED
    }
    if (
      !r.headerIs("content-type", "application/grpc") &&
      !r.headerIs("content-type", "application/grpc+proto")
    ) {
      this.server.empty(r, 415)
      return GRPC_ANSWERED
    }
    const timeout: i64 = this.timeout(r)
    if (timeout < 0) {
      this.only(r, GRPC_INTERNAL)
      return GRPC_ANSWERED
    }
    if (monotonicNanos() - r.since > timeout) {
      this.only(r, GRPC_DEADLINE_EXCEEDED)
      return GRPC_ANSWERED
    }
    const status: i32 = this.framing(r)
    if (status !== GRPC_OK) {
      this.only(r, status)
      return GRPC_ANSWERED
    }
    return GRPC_CALL
  }

  /**
   * Where `r`'s message starts in `r.body`; it ends at `r.bodyLength`.
   * @param r a request `call` answered `GRPC_CALL` for
   * @returns the offset of the message's first byte, past the length prefix
   */
  messageStart(r: HttpServerRequest): i32 {
    return r.bodyLength < GRPC_PREFIX ? r.bodyLength : GRPC_PREFIX
  }

  /**
   * Whether `r`'s deadline has passed: its `grpc-timeout` capped at
   * `maxTimeout`, from when its head was read. A malformed `grpc-timeout`,
   * which `call` refused, counts as passed.
   * @param r a request `take` handed over
   * @returns true once an answer to `r` would come too late
   */
  expired(r: HttpServerRequest): boolean {
    const timeout: i64 = this.timeout(r)
    return timeout < 0 || monotonicNanos() - r.since > timeout
  }

  /**
   * Answers the call `r` with the message `buf[off .. off + len)`: status
   * 200, `content-type: application/grpc`, the length-prefixed message and a
   * trailer section with `grpc-status: 0`. Past `r`'s deadline it answers
   * `DEADLINE_EXCEEDED` instead. Panics on a window outside `buf` and as the
   * server's `start` does.
   * @param r a request `call` answered `GRPC_CALL` for; the server's again after this call
   * @param buf the encoded reply message; the caller's again on return
   * @param off where in `buf` the message starts
   * @param len the message's length in bytes, at most 2^30 - 5
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the stream closed first
   */
  reply(r: HttpServerRequest, buf: u8[], off: i32, len: i32): i32 {
    if (off < 0 || len < 0 || len > 1073741819 || off > toI32(buf.length) - len) {
      panic(`GrpcServer.reply: the window ${off} + ${len} is outside its ${buf.length} bytes`)
    }
    if (this.expired(r)) {
      return this.only(r, GRPC_DEADLINE_EXCEEDED)
    }
    const sent: i32 = this.server.start(r, 200, this.contentType, this.grpcType, GRPC_PREFIX + len)
    if (sent !== HANDLER_SENT) {
      return sent
    }
    this.prefix[0] = toU8(0)
    this.prefix[1] = toU8((len >> 24) & 255)
    this.prefix[2] = toU8((len >> 16) & 255)
    this.prefix[3] = toU8((len >> 8) & 255)
    this.prefix[4] = toU8(len & 255)
    if (this.server.write(r, this.prefix, 0, GRPC_PREFIX) !== HANDLER_SENT) {
      this.server.end(r)
      return HANDLER_DROPPED
    }
    if (this.server.write(r, buf, off, len) !== HANDLER_SENT) {
      this.server.end(r)
      return HANDLER_DROPPED
    }
    return this.server.trailers(r, this.okNames, this.okValues)
  }

  /**
   * Answers the call `r` with the gRPC error `status`: the Trailers-Only form
   * when `message` is empty, and otherwise a head and a trailer section
   * carrying `grpc-status` and `grpc-message`, the message's UTF-8 with every
   * byte outside printable ASCII, and `%`, percent-encoded. Past `r`'s
   * deadline it answers `DEADLINE_EXCEEDED` instead. Panics on a status
   * outside 1 to 16.
   * @param r a request `call` answered `GRPC_CALL` for; the server's again after this call
   * @param status the error, one of the `GRPC_*` statuses from `GRPC_CANCELLED` to `GRPC_UNAUTHENTICATED`
   * @param message what went wrong, for a person reading the client's error; empty for none
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the stream closed first
   */
  fail(r: HttpServerRequest, status: i32, message: string): i32 {
    if (status < GRPC_CANCELLED || status > GRPC_UNAUTHENTICATED) {
      panic(`GrpcServer.fail: status ${status} is outside 1 to 16`)
    }
    if (this.expired(r)) {
      return this.only(r, GRPC_DEADLINE_EXCEEDED)
    }
    if (message.length === 0) {
      return this.only(r, status)
    }
    const sent: i32 = this.server.start(r, 200, this.contentType, this.grpcType, HTTP1_CHUNKED)
    if (sent !== HANDLER_SENT) {
      return sent
    }
    // Fresh arrays, never written again: the server reads them until the trailers are sent.
    const values: u8[][] = [this.statusValue(status), grpcPercentEncode(message)]
    return this.server.trailers(r, [this.statusName, this.messageName], values)
  }

  /** Answers `r` with `status` in the Trailers-Only form: one HEADERS frame that ends the stream. */
  private only(r: HttpServerRequest, status: i32): i32 {
    return this.server.start(r, 200, this.onlyNames, this.onlyValues[status], 0)
  }

  /** The decimal bytes of `status`, from the Trailers-Only table. */
  private statusValue(status: i32): u8[] {
    return this.onlyValues[status][1]
  }

  /**
   * How long `r` may take, in nanoseconds from its head: its `grpc-timeout`
   * capped at `maxTimeout`, `maxTimeout` without one, or -1 for a malformed
   * one (not 1 to 8 ASCII digits and one of the units `H M S m u n`).
   */
  private timeout(r: HttpServerRequest): i64 {
    const i: i32 = r.header("grpc-timeout")
    if (i === HANDLER_ABSENT) {
      return this.maxTimeout
    }
    const start: i32 = r.valueStart(i)
    const end: i32 = r.valueEnd(i)
    const digits: i32 = end - start - 1
    if (digits < 1 || digits > GRPC_TIMEOUT_DIGITS || start < 0 || end > toI32(r.head.length)) {
      return -1
    }
    let value: i64 = 0
    for (let k: i32 = start; k < end - 1; k++) {
      const c: i32 = toI32(r.head[k])
      if (c < 48 || c > 57) {
        return -1
      }
      value = value * 10 + toI64(c - 48)
    }
    const unit: i32 = toI32(r.head[end - 1])
    let scale: i64 = 0
    if (unit === 72) {
      scale = 3600000000000 // H
    } else if (unit === 77) {
      scale = 60000000000 // M
    } else if (unit === 83) {
      scale = 1000000000 // S
    } else if (unit === 109) {
      scale = 1000000 // m
    } else if (unit === 117) {
      scale = 1000 // u
    } else if (unit === 110) {
      scale = 1 // n
    } else {
      return -1
    }
    // Compare before multiplying: 99999999 hours is past what an i64 holds in nanoseconds.
    if (value > this.maxTimeout / scale) {
      return this.maxTimeout
    }
    const nanos: i64 = value * scale
    return nanos < this.maxTimeout ? nanos : this.maxTimeout
  }

  /** `GRPC_OK` when `r.body` is exactly one uncompressed length-prefixed message within `maxMessage`; otherwise the status to answer. */
  private framing(r: HttpServerRequest): i32 {
    const n: i32 = r.bodyLength
    const body: u8[] = r.body
    if (n < GRPC_PREFIX || n > toI32(body.length)) {
      return GRPC_INTERNAL
    }
    const flag: i32 = toI32(body[0])
    if (flag === 1) {
      return GRPC_UNIMPLEMENTED
    }
    if (flag !== 0) {
      return GRPC_INTERNAL
    }
    const length: i64 =
      (toI64(body[1]) << 24) | (toI64(body[2]) << 16) | (toI64(body[3]) << 8) | toI64(body[4])
    if (length > toI64(this.maxMessage)) {
      return GRPC_RESOURCE_EXHAUSTED
    }
    if (length !== toI64(n - GRPC_PREFIX)) {
      return GRPC_INTERNAL
    }
    return GRPC_OK
  }
}

/** `message` as UTF-8, with every byte outside `0x20 .. 0x7e`, and `%`, written `%XX` (uppercase hex), as `grpc-message` carries it. */
const grpcPercentEncode = (message: string): u8[] => {
  const out: u8[] = []
  const hex: string = "0123456789ABCDEF"
  for (let k: i32 = 0; k < toI32(message.length); k++) {
    const b: i32 = message.charCodeAt(k) & 255
    if (b < 32 || b > 126 || b === 37) {
      out.push(toU8(37))
      out.push(toU8(hex.charCodeAt(b >> 4)))
      out.push(toU8(hex.charCodeAt(b & 15)))
    } else {
      out.push(toU8(b))
    }
  }
  return out
}
