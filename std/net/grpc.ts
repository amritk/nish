/**
 * `nish/net/grpc` — Unary and streaming gRPC calls on `nish/net/http-server`'s HTTP/2
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
 *         const msg = new ProtoReader(r.body, grpc.messageStart(r), grpc.messageEnd(r));
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
 * owes an answer, whose message is `r.body[messageStart(r) .. messageEnd(r))`.
 *
 * **A call's deadline** runs from when the server read its head: its
 * `grpc-timeout`, capped at `limits.maxTimeout`, or `maxTimeout` when it has
 * none. `reply`, `fail`, `send` and `finish` answer `DEADLINE_EXCEEDED` instead of the
 * program's answer once it has passed.
 *
 * **The answer** is `:status` 200 and `content-type: application/grpc`, then
 * the length-prefixed reply, then a trailer section with `grpc-status: 0`
 * (`reply`); or a gRPC error (`fail`): Trailers-Only when it has no message,
 * and a head followed by a trailer section with `grpc-status` and the
 * percent-encoded `grpc-message` when it has one.
 *
 * **Streaming calls.** A server-streaming call's request is one message, so
 * `call` reads it; the program then sends its replies with `send`, one
 * message each, and ends the call with `finish(r, GRPC_OK, "")`. A
 * client-streaming or bidirectional call's request is a stream of messages:
 * the program marks its route with `server.streamBody(route)`, reads the
 * call with `open`, and its messages with `next`, each time `take` hands the
 * request over:
 *
 *     let s = grpc.next(r);
 *     while (s === GRPC_MESSAGE) {
 *       const m = new ProtoReader(grpc.messageBytes(r), grpc.messageStart(r), grpc.messageEnd(r));
 *       // ... decode m, perhaps send(r, ...) a reply ...
 *       s = grpc.next(r);
 *     }
 *     if (s === GRPC_END) {
 *       grpc.finish(r, GRPC_OK, "");
 *     } // GRPC_MORE: wait for the next piece; GRPC_ANSWERED: r is the server's again
 *
 * `next` answers the faults `call` does, message by message, and a client
 * that hung up (`CANCELLED`). `send` never blocks: it answers the bytes still
 * queued, and a program that sends faster than the client reads stops above
 * a budget of its own until `pending(r)` drains. A body the server streams
 * is not under `bodyTimeout`, so a program waiting on a slow client checks
 * `expired(r)` each turn and ends the call itself; `next`, `send` and
 * `finish` answer `DEADLINE_EXCEEDED` once it has passed.
 *
 * The record of what this module refuses and why is `docs/security/grpc.md`.
 */
import { tryCopyBytes } from "nish/bytes"
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
/** `next`'s answer when it found a request message: `messageBytes(r)[messageStart(r) .. messageEnd(r))`. */
export const GRPC_MESSAGE: i32 = 2
/** `next`'s answer when the next message has not all arrived: wait until `take` hands the request over again. */
export const GRPC_MORE: i32 = 3
/** `next`'s answer when the client's stream of messages ended; the program ends the call with `finish`. */
export const GRPC_END: i32 = 4
/** `send`'s answer once the call is over: answered past its deadline, or its stream or connection gone. */
export const GRPC_ENDED: i32 = -1

/** A request index no call holds. */
const GRPC_IDLE: i32 = 0
/** A call read by `call` or `open`, whose answer has not begun. */
const GRPC_OPEN: i32 = 1
/** A call whose answer's head is sent: what is left is messages, then trailers. */
const GRPC_BEGUN: i32 = 2
/** A call that is answered, or whose stream is gone: the request is the server's again. */
const GRPC_OVER: i32 = 3
/** The largest per-call message buffer kept once its call is over. */
const GRPC_KEEP: i32 = 65536
/** The size a call's message buffer first grows to, before it doubles. */
const GRPC_GROW_FROM: i32 = 1024

/** The length prefix: one compressed-flag byte and a four-byte big-endian length. */
const GRPC_PREFIX: i32 = 5
/** The HTTP status of every answer that reaches gRPC's own framing. */
const GRPC_HTTP_OK: i32 = 200
/** The HTTP status of a call over HTTP/1.1 or HTTP/3. */
const GRPC_HTTP_VERSION_NOT_SUPPORTED: i32 = 505
/** The HTTP status of a request whose `content-type` is not gRPC's. */
const GRPC_HTTP_UNSUPPORTED_MEDIA_TYPE: i32 = 415
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
 * `a + b`, worked in `i64` and held to `i32`. Every caller adds an offset
 * and a length that lie inside one array, so the sum is an index into it or
 * just past it and always fits.
 */
const grpcAdd = (a: i32, b: i32): i32 => toI32(toI64(a) + toI64(b))

/** `a - b`, worked as `grpcAdd` is, for offsets and lengths inside one array. */
const grpcSub = (a: i32, b: i32): i32 => toI32(toI64(a) - toI64(b))

/**
 * A zeroed array of `n` bytes, or of none when `n` is below zero. Up to
 * 65535 bytes is one allocation; past that the array grows a byte at a time
 * from a 65535-byte start, which an `i32` length cannot make fail.
 */
const grpcBytes = (n: i32): u8[] => {
  if (n < 0) {
    return []
  }
  if (n <= 65535) {
    return new Array<u8>(toU16(n))
  }
  const out: u8[] = new Array<u8>(65535)
  for (let k: i32 = 65535; k < n; k += 1) {
    out.push(0)
  }
  return out
}

/** The answer `grpcPrefixLength` gives for a compressed message. */
const GRPC_COMPRESSED: i64 = -2

/**
 * The length the 5-byte message prefix at `body[at]` declares: 0 to 2^32 - 1
 * for an uncompressed message, `GRPC_COMPRESSED` for a compressed one, and
 * -1 for a flag byte that is neither, or a prefix not wholly inside `body`.
 */
const grpcPrefixLength = (body: u8[], at: i32): i64 => {
  // 5 is `GRPC_PREFIX`, written as the literal the bound proofs read.
  if (at < 0 || at > toI32(body.length) - 5) {
    return -1
  }
  const flag: i32 = toI32(body[at])
  if (flag === 1) {
    return GRPC_COMPRESSED
  }
  if (flag !== 0) {
    return -1
  }
  return (
    (toI64(body[at + 1]) << 24) |
    (toI64(body[at + 2]) << 16) |
    (toI64(body[at + 3]) << 8) |
    toI64(body[at + 4])
  )
}

/** `len`'s uncompressed length prefix, fresh: the server may hold it until it is sent. */
const grpcPrefix = (len: i32): u8[] => [
  toU8(0),
  toU8((len >> 24) & 255),
  toU8((len >> 16) & 255),
  toU8((len >> 8) & 255),
  toU8(len & 255),
]

/** What a `GrpcServer` keeps for the call at one request index. */
class GrpcCall {
  /** `GRPC_IDLE` (0), `GRPC_OPEN`, `GRPC_BEGUN` or `GRPC_OVER`. */
  state: i32 = 0
  /** How many bytes at the front of `body` `next` has read and not yet handed back with `consume`. */
  readAt: i32 = 0
  /** The length of the message `next` is copying into `buf`, or -1 for none. */
  want: i32 = -1
  /** How many of that message's bytes are copied. */
  have: i32 = 0
  /** The buffer a message split across pieces is copied into. */
  buf: u8[]
  /** Whether the last message is in `buf`, not `body`. */
  inBuf: boolean = false
  /** Where the last message starts. */
  start: i32 = 0
  /** Where the last message ends. */
  end: i32 = 0
  /** The `since` of the request the call was opened for. */
  since: i64 = 0
  /** The `stream` of the request the call was opened for. */
  stream: i64 = 0

  constructor() {
    this.buf = []
  }
}

/**
 * Reads gRPC calls from an `HttpServer`'s HTTP/2 requests and answers them:
 * unary calls (`call`, `reply`, `fail`) and streaming ones (`open`, `next`,
 * `begin`, `send`, `finish`). What it keeps per call is indexed by the
 * request's `index`, and is the call's until it is answered.
 */
export class GrpcServer {
  private server: HttpServer
  private maxMessage: i32
  private maxTimeout: i64
  private contentType: u8[][]
  private grpcType: u8[][]
  /** `application/grpc`, the `content-type` of every answer. */
  private grpcTypeBytes: u8[]
  private okNames: u8[][]
  private okValues: u8[][]
  private onlyNames: u8[][]
  private statusName: u8[]
  private messageName: u8[]
  /** `[grpc-status]`, the trailer names of a status with no message. */
  private statusNames: u8[][]
  /** Per request index: the call there, idle until `call` or `open` reads one. */
  private calls: GrpcCall[]

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
    const contentType: u8[] = httpFieldBytes("content-type")
    this.contentType = [contentType]
    this.grpcType = [grpcType]
    this.grpcTypeBytes = grpcType
    this.statusName = httpFieldBytes("grpc-status")
    this.messageName = httpFieldBytes("grpc-message")
    this.okNames = [this.statusName]
    this.okValues = [httpFieldBytes("0")]
    this.onlyNames = [contentType, this.statusName]
    this.statusNames = [this.statusName]
    this.calls = []
  }

  /**
   * Reads `r` as a unary call, or a server-streaming one: a request that is
   * one message, whole. Answers it itself, and says so, when it is
   * not one the program can answer: 415 for a `content-type` other than
   * `application/grpc` or `application/grpc+proto`, 505 off HTTP/2, and
   * otherwise a gRPC error in the Trailers-Only form (see the module's
   * comment). Never panics on what the peer sent; panics on a request whose
   * body comes in pieces (`streaming`), which `open` and `next` read.
   * @param r a request `take` handed over and not yet answered
   * @returns `GRPC_CALL` when the program owes `r` an answer through `reply`, `fail`, or `send` and `finish`, or `GRPC_ANSWERED` when `r` is the server's again
   */
  call(r: HttpServerRequest): i32 {
    if (r.streaming) {
      panic("GrpcServer.call: the request's body comes in pieces; read it with open and next")
    }
    if (!this.admit(r)) {
      return GRPC_ANSWERED
    }
    const status: i32 = this.framing(r)
    if (status !== GRPC_OK) {
      this.only(r, status)
      return GRPC_ANSWERED
    }
    const c: GrpcCall | null = this.slot(r)
    if (c === null) {
      this.only(r, GRPC_INTERNAL)
      return GRPC_ANSWERED
    }
    c.start = GRPC_PREFIX
    c.end = r.bodyLength
    return GRPC_CALL
  }

  /**
   * Reads `r` as a call whose request is a stream of messages, client
   * streaming or bidirectional, whether its body comes in pieces (a route
   * `HttpServer.streamBody` marked, on HTTP/2) or whole. Answers it itself,
   * and says so, as `call` does: 415, 505, a malformed `grpc-timeout`
   * (`INTERNAL`) or a deadline already past. Its messages are read with
   * `next`. Never panics on what the peer sent.
   * @param r a request `take` handed over and not yet answered
   * @returns `GRPC_CALL` when the program owes `r` an answer, or `GRPC_ANSWERED` when `r` is the server's again
   */
  open(r: HttpServerRequest): i32 {
    if (!this.admit(r)) {
      return GRPC_ANSWERED
    }
    if (this.slot(r) === null) {
      this.only(r, GRPC_INTERNAL)
      return GRPC_ANSWERED
    }
    return GRPC_CALL
  }

  /**
   * Reads the call's next request message, across as many DATA frames as it
   * came in. A message whole in `r.body` is read in place; one split across
   * pieces is copied, piece by piece, into a buffer of the call's, each
   * piece handed back with `consume` so the client may send more. Answers
   * the call itself, and returns `GRPC_ANSWERED`, on a message whose prefix
   * declares more than `maxMessage` bytes (`RESOURCE_EXHAUSTED`), a
   * compressed one (`UNIMPLEMENTED`), an unknown flag byte or a body that
   * ends inside a message (`INTERNAL`), a deadline past (`DEADLINE_EXCEEDED`)
   * and a client that hung up (`CANCELLED`, which the server drops). Never
   * panics on what the peer sent; panics on a request `open` or `call` did
   * not answer `GRPC_CALL` for. A message read in place is handed back to
   * the client's window only by a later `next`, so a program calls `next`
   * until it answers `GRPC_MORE`, `GRPC_END` or `GRPC_ANSWERED` before it
   * waits for `take`.
   * @param r a call `open` read
   * @returns `GRPC_MESSAGE` for a message, valid until the next call of `next`; `GRPC_MORE` to wait until `take` hands `r` over again; `GRPC_END` when the client's stream ended; `GRPC_ANSWERED` when `r` is the server's again
   */
  next(r: HttpServerRequest): i32 {
    const c: GrpcCall = this.held(r, "next")
    if (c.state === GRPC_OVER) {
      return GRPC_ANSWERED
    }
    if (this.server.hungUp(r)) {
      this.close(r, GRPC_CANCELLED, "")
      return GRPC_ANSWERED
    }
    if (this.expired(r)) {
      this.close(r, GRPC_DEADLINE_EXCEEDED, "")
      return GRPC_ANSWERED
    }
    const body: u8[] = r.body
    const total: i32 = r.bodyLength
    let at: i32 = c.readAt
    if (at < 0 || total < 0 || total < at || total > toI32(body.length)) {
      // A body length the request's own bytes do not hold: nothing here reads as a message.
      this.close(r, GRPC_INTERNAL, "")
      return GRPC_ANSWERED
    }
    if (c.want < 0) {
      const left: i32 = total - at
      if (left < GRPC_PREFIX) {
        if (r.bodyEnded) {
          if (left === 0) {
            return GRPC_END
          }
          this.close(r, GRPC_INTERNAL, "")
          return GRPC_ANSWERED
        }
        // A prefix not yet whole waits where it is: fewer than 5 bytes never fill the window.
        this.server.consume(r, at)
        c.readAt = 0
        return GRPC_MORE
      }
      const length: i64 = grpcPrefixLength(body, at)
      if (length === GRPC_COMPRESSED) {
        this.close(r, GRPC_UNIMPLEMENTED, "")
        return GRPC_ANSWERED
      }
      if (length < 0) {
        this.close(r, GRPC_INTERNAL, "")
        return GRPC_ANSWERED
      }
      if (length > toI64(this.maxMessage)) {
        this.close(r, GRPC_RESOURCE_EXHAUSTED, "")
        return GRPC_ANSWERED
      }
      const n: i32 = toI32(length)
      at = grpcAdd(at, GRPC_PREFIX)
      if (grpcSub(left, GRPC_PREFIX) >= n) {
        c.readAt = grpcAdd(at, n)
        c.inBuf = false
        c.start = at
        c.end = c.readAt
        return GRPC_MESSAGE
      }
      if (r.bodyEnded) {
        // The rest can never come: answered before anything is allocated for it.
        this.close(r, GRPC_INTERNAL, "")
        return GRPC_ANSWERED
      }
      c.want = n
      c.have = 0
    }
    const need: i32 = grpcSub(c.want, c.have)
    const avail: i32 = grpcSub(total, at)
    const piece: i32 = avail < need ? avail : need
    if (!this.grow(c, grpcAdd(c.have, piece)) || !tryCopyBytes(c.buf, c.have, body, at, piece)) {
      // A piece the call's buffer cannot take: its counts no longer describe the message.
      this.close(r, GRPC_INTERNAL, "")
      return GRPC_ANSWERED
    }
    c.have = grpcAdd(c.have, piece)
    at = grpcAdd(at, piece)
    if (c.have === c.want) {
      c.readAt = at
      c.inBuf = true
      c.start = 0
      c.end = c.want
      c.want = -1
      return GRPC_MESSAGE
    }
    this.server.consume(r, at)
    c.readAt = 0
    if (r.bodyEnded) {
      this.close(r, GRPC_INTERNAL, "")
      return GRPC_ANSWERED
    }
    return GRPC_MORE
  }

  /**
   * The array that holds the message `call` or `next` found last: `r.body`,
   * or the call's own buffer for a message `next` copied out of pieces.
   * @param r a call `call` answered `GRPC_CALL` for, or `next` answered `GRPC_MESSAGE` for
   * @returns the array whose `[messageStart(r) .. messageEnd(r))` is the message
   */
  messageBytes(r: HttpServerRequest): u8[] {
    const c: GrpcCall | null = this.at(r)
    return c !== null && c.inBuf ? c.buf : r.body
  }

  /**
   * Where the message `call` or `next` found last starts in `messageBytes(r)`;
   * for a unary call that is past the length prefix in `r.body`.
   * @param r a call `call` answered `GRPC_CALL` for, or `next` answered `GRPC_MESSAGE` for
   * @returns the offset of the message's first byte
   */
  messageStart(r: HttpServerRequest): i32 {
    const c: GrpcCall | null = this.at(r)
    if (c !== null) {
      return c.start
    }
    return r.bodyLength < GRPC_PREFIX ? r.bodyLength : GRPC_PREFIX
  }

  /**
   * Where the message `call` or `next` found last ends in `messageBytes(r)`;
   * for a unary call that is `r.bodyLength`.
   * @param r a call `call` answered `GRPC_CALL` for, or `next` answered `GRPC_MESSAGE` for
   * @returns the offset just past the message's last byte
   */
  messageEnd(r: HttpServerRequest): i32 {
    const c: GrpcCall | null = this.at(r)
    return c !== null ? c.end : r.bodyLength
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
   * Sends the head of the call's answer, `:status` 200 and `content-type:
   * application/grpc`, so its reply messages can follow with `send`; `send`
   * begins it too. Once begun the call ends with `finish` (or `fail`).
   * Panics on a request `open` or `call` did not answer `GRPC_CALL` for.
   * @param r a call `call` or `open` read
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the stream closed first and `r` is the server's again
   */
  begin(r: HttpServerRequest): i32 {
    const c: GrpcCall = this.held(r, "begin")
    if (c.state === GRPC_BEGUN) {
      return HANDLER_SENT
    }
    if (c.state === GRPC_OVER) {
      return HANDLER_DROPPED
    }
    const sent: i32 = this.server.start(r, GRPC_HTTP_OK, this.contentType, this.grpcType, HTTP1_CHUNKED)
    if (sent !== HANDLER_SENT) {
      this.gone(r)
      return sent
    }
    c.state = GRPC_BEGUN
    return HANDLER_SENT
  }

  /**
   * Sends one reply message, `buf[off .. off + len)`, length-prefixed,
   * beginning the answer if it has not begun. It never blocks: what the
   * connection cannot take yet is queued, and the answer is how much is, so
   * a program sending many messages stops above a budget of its own and goes
   * back to its wait until `HttpServer.pending(r)` drops. Past the deadline
   * it ends the call `DEADLINE_EXCEEDED` instead. Panics on a window outside
   * `buf`, or a request `open` or `call` did not answer `GRPC_CALL` for.
   * @param r a call `call` or `open` read
   * @param buf the encoded reply message; the caller's again on return
   * @param off where in `buf` the message starts
   * @param len the message's length in bytes, at most 2^30 - 5
   * @returns the bytes of the answer still queued, 0 or more, or `GRPC_ENDED` once the call is over and `r` is the server's again
   */
  send(r: HttpServerRequest, buf: u8[], off: i32, len: i32): i32 {
    if (off < 0 || len < 0 || len > 1073741819 || off > toI32(buf.length) - len) {
      panic(`GrpcServer.send: the window ${off} + ${len} is outside its ${buf.length} bytes`)
    }
    const c: GrpcCall = this.held(r, "send")
    if (c.state === GRPC_OVER) {
      return GRPC_ENDED
    }
    if (this.expired(r)) {
      this.close(r, GRPC_DEADLINE_EXCEEDED, "")
      return GRPC_ENDED
    }
    if (this.begin(r) !== HANDLER_SENT) {
      return GRPC_ENDED
    }
    if (
      this.server.write(r, grpcPrefix(len), toI32(0), GRPC_PREFIX) !== HANDLER_SENT ||
      this.server.write(r, buf, off, len) !== HANDLER_SENT
    ) {
      this.gone(r)
      return GRPC_ENDED
    }
    return this.server.pending(r)
  }

  /**
   * Ends the call with `status`: trailers carrying `grpc-status` and, when
   * `message` is not empty, `grpc-message`, percent-encoded as `fail`'s is.
   * A call whose answer has not begun is answered Trailers-Only when
   * `message` is empty. Past the deadline it answers `DEADLINE_EXCEEDED`
   * instead. Panics on a status outside 0 to 16, or a request `open` or
   * `call` did not answer `GRPC_CALL` for.
   * @param r a call `call` or `open` read; the server's again after this call
   * @param status `GRPC_OK`, or the error, one of the `GRPC_*` statuses to `GRPC_UNAUTHENTICATED`
   * @param message what went wrong, for a person reading the client's error; empty for none
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the stream closed first
   */
  finish(r: HttpServerRequest, status: i32, message: string): i32 {
    if (status < GRPC_OK || status > GRPC_UNAUTHENTICATED) {
      panic(`GrpcServer.finish: status ${status} is outside 0 to 16`)
    }
    const c: GrpcCall = this.held(r, "finish")
    if (c.state === GRPC_OVER) {
      return HANDLER_DROPPED
    }
    if (this.expired(r)) {
      return this.close(r, GRPC_DEADLINE_EXCEEDED, "")
    }
    return this.close(r, status, message)
  }

  /**
   * Answers the call `r` with the message `buf[off .. off + len)`: status
   * 200, `content-type: application/grpc`, the length-prefixed message and a
   * trailer section with `grpc-status: 0`. Past `r`'s deadline it answers
   * `DEADLINE_EXCEEDED` instead. Panics on a window outside `buf`, on a call
   * whose answer has begun, and as the server's `start` does.
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
    const c: GrpcCall | null = this.at(r)
    if (c !== null && c.state === GRPC_BEGUN) {
      panic("GrpcServer.reply: the call's answer has begun; end it with finish")
    }
    if (c !== null && c.state === GRPC_OVER) {
      return HANDLER_DROPPED
    }
    this.over(r)
    if (this.expired(r)) {
      return this.only(r, GRPC_DEADLINE_EXCEEDED)
    }
    const sent: i32 = this.server.start(r, GRPC_HTTP_OK, this.contentType, this.grpcType, GRPC_PREFIX + len)
    if (sent !== HANDLER_SENT) {
      this.server.end(r)
      return sent
    }
    if (
      this.server.write(r, grpcPrefix(len), toI32(0), GRPC_PREFIX) !== HANDLER_SENT ||
      this.server.write(r, buf, off, len) !== HANDLER_SENT
    ) {
      this.server.end(r)
      return HANDLER_DROPPED
    }
    return this.server.trailers(r, this.okNames, this.okValues)
  }

  /**
   * Answers the call `r` with the gRPC error `status`: the Trailers-Only form
   * when `message` is empty, and otherwise a head and a trailer section
   * carrying `grpc-status` and `grpc-message`, the message's UTF-8 with every
   * byte outside printable ASCII, and `%`, percent-encoded. On a call whose
   * answer has begun it ends it as `finish` does. Past `r`'s deadline it
   * answers `DEADLINE_EXCEEDED` instead. Panics on a status outside 1 to 16.
   * @param r a request `call` or `open` answered `GRPC_CALL` for; the server's again after this call
   * @param status the error, one of the `GRPC_*` statuses from `GRPC_CANCELLED` to `GRPC_UNAUTHENTICATED`
   * @param message what went wrong, for a person reading the client's error; empty for none
   * @returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the stream closed first
   */
  fail(r: HttpServerRequest, status: i32, message: string): i32 {
    if (status < GRPC_CANCELLED || status > GRPC_UNAUTHENTICATED) {
      panic(`GrpcServer.fail: status ${status} is outside 1 to 16`)
    }
    const c: GrpcCall | null = this.at(r)
    if (c !== null && c.state === GRPC_OVER) {
      return HANDLER_DROPPED
    }
    if (this.expired(r)) {
      return this.close(r, GRPC_DEADLINE_EXCEEDED, "")
    }
    return this.close(r, status, message)
  }

  /**
   * Grows the call's message buffer to hold at least `size` bytes, keeping
   * the `have` already copied: doubled from 1 KiB, and never past the
   * message's declared length, so what the call holds tracks what the client
   * sent rather than what its prefix declared. False when the bytes already
   * copied do not fit the grown buffer.
   */
  private grow(c: GrpcCall, size: i32): boolean {
    const held: i32 = toI32(c.buf.length)
    if (held >= size) {
      return true
    }
    const want: i32 = c.want
    let grown: i32 = held < GRPC_GROW_FROM ? GRPC_GROW_FROM : held
    while (grown < size) {
      grown = grown >= grpcSub(want, grown) ? want : grpcAdd(grown, grown)
    }
    if (grown > want) {
      grown = want
    }
    const bigger: u8[] = grpcBytes(grown)
    if (!tryCopyBytes(bigger, 0, c.buf, 0, c.have)) {
      return false
    }
    c.buf = bigger
    return true
  }

  /** The version, `content-type`, `grpc-timeout` and deadline checks `call` and `open` share; false once it answered `r` itself. */
  private admit(r: HttpServerRequest): boolean {
    if (r.version !== 2) {
      this.server.empty(r, GRPC_HTTP_VERSION_NOT_SUPPORTED)
      return false
    }
    if (
      !r.headerIs("content-type", "application/grpc") &&
      !r.headerIs("content-type", "application/grpc+proto")
    ) {
      this.server.empty(r, GRPC_HTTP_UNSUPPORTED_MEDIA_TYPE)
      return false
    }
    const timeout: i64 = this.timeout(r)
    if (timeout < 0) {
      this.only(r, GRPC_INTERNAL)
      return false
    }
    if (monotonicNanos() - r.since > timeout) {
      this.only(r, GRPC_DEADLINE_EXCEEDED)
      return false
    }
    return true
  }

  /**
   * Makes room for `r`'s index in the per-call state and opens a call there;
   * null for a request with no index (below zero), which holds no call.
   */
  private slot(r: HttpServerRequest): GrpcCall | null {
    const i: i32 = r.index
    const calls: GrpcCall[] = this.calls
    while (i >= 0 && toI32(calls.length) <= i) {
      calls.push(new GrpcCall())
    }
    if (i < 0 || i >= toI32(calls.length)) {
      return null
    }
    const c: GrpcCall = calls[i]
    c.state = GRPC_OPEN
    c.readAt = 0
    c.want = -1
    c.have = 0
    c.inBuf = false
    c.start = 0
    c.end = 0
    c.since = r.since
    c.stream = r.stream
    return c
  }

  /**
   * `r`'s call when one is open, begun or over there for this request, or null.
   * The façade reuses a request object and its index for a later request, so a
   * call left there by an earlier one, told apart by its head's turn and its
   * stream, is not `r`'s.
   */
  private at(r: HttpServerRequest): GrpcCall | null {
    const i: i32 = r.index
    const calls: GrpcCall[] = this.calls
    if (i < 0 || i >= toI32(calls.length)) {
      return null
    }
    const c: GrpcCall = calls[i]
    if (c.state === GRPC_IDLE || c.since !== r.since || c.stream !== r.stream) {
      return null
    }
    return c
  }

  /** `r`'s call once `call` or `open` read it; panics, naming `who`, on a request neither did. */
  private held(r: HttpServerRequest, who: string): GrpcCall {
    const c: GrpcCall | null = this.at(r)
    if (c === null) {
      panic(`GrpcServer.${who}: the request is not a call that open or call read`)
    }
    return c
  }

  /** Marks `r`'s call over, if it has one, and lets go of a large message buffer. */
  private over(r: HttpServerRequest): void {
    const c: GrpcCall | null = this.at(r)
    if (c === null) {
      return
    }
    c.state = GRPC_OVER
    c.want = -1
    if (toI32(c.buf.length) > GRPC_KEEP) {
      c.buf = []
    }
  }

  /** `r`'s stream closed under an answer the server started: hands `r` back and marks the call over. */
  private gone(r: HttpServerRequest): void {
    this.server.end(r)
    this.over(r)
  }

  /**
   * Ends the call `r` with `status` and, when not empty, `message`: trailers
   * when its answer has begun, Trailers-Only when it has not and `message`
   * is empty, and otherwise a head and then trailers.
   */
  private close(r: HttpServerRequest, status: i32, message: string): i32 {
    const c: GrpcCall | null = this.at(r)
    const begun: boolean = c !== null && c.state === GRPC_BEGUN
    this.over(r)
    if (!begun) {
      if (message.length === 0) {
        return this.only(r, status)
      }
      const sent: i32 = this.server.start(r, GRPC_HTTP_OK, this.contentType, this.grpcType, HTTP1_CHUNKED)
      if (sent !== HANDLER_SENT) {
        this.server.end(r)
        return sent
      }
    }
    // Fresh arrays, never written again: the server reads them until the trailers are sent.
    if (message.length === 0) {
      return this.server.trailers(r, this.statusNames, [grpcStatusValue(status)])
    }
    const values: u8[][] = [grpcStatusValue(status), grpcPercentEncode(message)]
    return this.server.trailers(r, [this.statusName, this.messageName], values)
  }

  /**
   * Answers `r` with `status` in the Trailers-Only form: one HEADERS frame
   * that ends the stream, then `end`, which hands `r` back whether the head
   * went or the stream closed first. A head declaring no body still leaves
   * the request the program's until `end`.
   */
  private only(r: HttpServerRequest, status: i32): i32 {
    const values: u8[][] = [this.grpcTypeBytes, grpcStatusValue(status)]
    const sent: i32 = this.server.start(r, GRPC_HTTP_OK, this.onlyNames, values, toI32(0))
    const ended: i32 = this.server.end(r)
    return sent === HANDLER_SENT ? ended : sent
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
    const head: u8[] = r.head
    const start: i32 = r.valueStart(i)
    const end: i32 = r.valueEnd(i)
    if (start < 0 || end < 1 || end < start || end > toI32(head.length)) {
      return -1
    }
    const last: i32 = end - 1
    const digits: i32 = last - start
    if (digits < 1 || digits > GRPC_TIMEOUT_DIGITS) {
      return -1
    }
    let value: i32 = 0
    for (let k: i32 = start; k >= 0 && k < last; k++) {
      const c: i32 = toI32(head[k])
      if (c < 48 || c > 57) {
        return -1
      }
      // At most 8 digits: `value` stays below 10^8, so the step never wraps.
      if (value >= 0 && value <= 99999999) {
        value = value * 10 + (c - 48)
      }
    }
    const unit: i32 = toI32(head[last])
    let scale: f64 = 0
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
    // Worked in f64: 99999999 hours is past what an i64 holds in nanoseconds.
    // Below `maxTimeout` (under 2^53) the product of two whole numbers is exact.
    const nanos: f64 = toF64(value) * scale
    const max: i64 = this.maxTimeout
    return nanos < toF64(max) ? toI64(nanos) : max
  }

  /** `GRPC_OK` when `r.body` is exactly one uncompressed length-prefixed message within `maxMessage`; otherwise the status to answer. */
  private framing(r: HttpServerRequest): i32 {
    const n: i32 = r.bodyLength
    const body: u8[] = r.body
    if (n < GRPC_PREFIX || n > toI32(body.length)) {
      return GRPC_INTERNAL
    }
    const length: i64 = grpcPrefixLength(body, 0)
    if (length === GRPC_COMPRESSED) {
      return GRPC_UNIMPLEMENTED
    }
    if (length < 0) {
      return GRPC_INTERNAL
    }
    if (length > toI64(this.maxMessage)) {
      return GRPC_RESOURCE_EXHAUSTED
    }
    if (length !== toI64(grpcSub(n, GRPC_PREFIX))) {
      return GRPC_INTERNAL
    }
    return GRPC_OK
  }
}

/** The decimal bytes of `status`, as `grpc-status` carries it. */
const grpcStatusValue = (status: i32): u8[] => httpFieldBytes(`${status}`)

/** The uppercase hex digit of `v`, 0 to 15. */
const grpcHex = (v: i32): u8 => {
  const d: i32 = v & 15
  return toU8(d < 10 ? 48 + d : 55 + d)
}

/** `message` as UTF-8, with every byte outside `0x20 .. 0x7e`, and `%`, written `%XX` (uppercase hex), as `grpc-message` carries it. */
const grpcPercentEncode = (message: string): u8[] => {
  const out: u8[] = []
  for (let k: i32 = 0; k < toI32(message.length); k++) {
    const b: i32 = toI32(message.charCodeAt(k)) & toI32(255)
    if (b < 32 || b > 126 || b === 37) {
      out.push(toU8(37))
      out.push(grpcHex(b >> 4))
      out.push(grpcHex(b & 15))
    } else {
      out.push(toU8(b))
    }
  }
  return out
}
