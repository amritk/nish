// `nish/net/grpc` over HTTP/2 over TLS and h2c, in one process over
// loopback: the scripted clients of `./client` against one `HttpServer` with
// a `GrpcServer` over it, answering the unary GetSum call of the benchmark
// service and the errors of `rig.ts`.
//
//   1. HTTP/2 over TLS: GetSum answered with 200, `application/grpc`, the
//      length-prefixed SumReply and `grpc-status: 0` trailers; an error with a
//      message as a head then trailers, the message percent-encoded; an error
//      with none as Trailers-Only.
//   2. h2c: GetSum again, under `application/grpc+proto` too; the two errors
//      again, and one whose message holds a CR, an LF and a NUL; another
//      content-type is 415; a compressed message is UNIMPLEMENTED, one longer
//      than `maxMessage` (by one, or with bit 31 set) RESOURCE_EXHAUSTED, and
//      a prefix that does not match the body (or no prefix, a partial one, or
//      an unknown flag) INTERNAL.
//   3. Deadlines: a `grpc-timeout` already past is DEADLINE_EXCEEDED before
//      the program sees the call, a call answered after its deadline is
//      DEADLINE_EXCEEDED from `reply`, and each malformed `grpc-timeout` is
//      refused with INTERNAL.
//   4. The cap: on a second server whose `maxTimeout` is 60 ms, a call asking
//      for 99999999 hours, and one asking for nothing, are past their
//      deadlines 120 ms later.
//   5. Streaming, over HTTP/2 over TLS and h2c each: SumAll (client
//      streaming) with a message split across three DATA frames, and three
//      messages in one, answered only once the stream ends; Echo
//      (bidirectional) answering a message before the client's stream ends;
//      a SumAll the client cancels with RST_STREAM, and one whose deadline
//      passes mid-stream; each framing fault of a streamed message; Count
//      (server streaming) sending three replies, then a hundred of a kilobyte
//      each past the flow-control window, the rig holding no more than its
//      budget queued until the window opens; and `send` and `finish` past the
//      deadline answering DEADLINE_EXCEEDED.
//   6. HTTP/1.1: a gRPC call over it is 505.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { H2_FLAG_END_STREAM, http2WriteData } from "nish/net/http2-frame"
import { HANDLER_SENT } from "nish/net/handler"
import { n32 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { NO_PAD, Wire, ZERO } from "../net_http2/peer"
import { H1Client, H2cClient, H2TlsClient } from "./client"
import { ProtoWriter } from "nish/net/protobuf"
import { GrpcRig, RIG_BUDGET, RIG_MAX_MESSAGE } from "./rig"

/** `GrpcLimits.maxTimeout`'s default, which the main rig keeps. */
const DEFAULT_TIMEOUT: i32 = 30000
/** The second rig's `maxTimeout`, short enough to outwait in a test. */
const SHORT_TIMEOUT: i32 = 60

const SERVICE: string = "/benchmark.BenchmarkService"

/** A gRPC call's request head: POST to `method` of the service, with `contentType`, and `grpc-timeout` when `timeout` is not empty. */
const callOf = (method: string, contentType: string, timeout: string): string[] => {
  const pairs: string[] = [":method", "POST", ":scheme", "https", ":path", `${SERVICE}/${method}`, ":authority", "example.com", "content-type", contentType, "te", "trailers"]
  if (timeout.length > 0) {
    pairs.push("grpc-timeout")
    pairs.push(timeout)
  }
  return pairs
}

/** A SumRequest of `a` and `b` (each 0 to 127), length-prefixed: `00 00000004 08 a 10 b`. */
const sumOf = (a: i32, b: i32): u8[] => [toU8(0), toU8(0), toU8(0), toU8(0), toU8(4), toU8(8), toU8(a), toU8(16), toU8(b)]

/** A DATA frame on `stream` carrying `bytes` and ending the stream. */
const body = (wire: Wire, stream: i32, bytes: u8[]): void => {
  wire.add(http2WriteData(wire.scratch, ZERO, stream, bytes, ZERO, toI32(bytes.length), H2_FLAG_END_STREAM, NO_PAD))
}

/** A DATA frame on `stream` carrying `bytes`, the stream left open. */
const piece = (wire: Wire, stream: i32, bytes: u8[]): void => {
  wire.add(http2WriteData(wire.scratch, ZERO, stream, bytes, ZERO, toI32(bytes.length), 0, NO_PAD))
}

/** `a`, then `b`, then `c`, as one array. */
const joined = (a: u8[], b: u8[], c: u8[]): u8[] => {
  const out: u8[] = []
  for (const x of a) {
    out.push(x)
  }
  for (const x of b) {
    out.push(x)
  }
  for (const x of c) {
    out.push(x)
  }
  return out
}

/** A CountRequest of `count` replies from `start`, each padded with `pad` bytes, length-prefixed. */
const countOf = (count: i32, start: i32, pad: i32): u8[] => {
  const w = new ProtoWriter(new Array<u8>(16))
  w.int32(1, count)
  w.int32(2, start)
  w.int32(3, pad)
  const out: u8[] = [toU8(0), toU8(0), toU8(0), toU8(0), toU8(w.end)]
  for (let k: i32 = 0; k < w.end; k++) {
    out.push(w.buf[k])
  }
  return out
}

/** The bytes of every DATA frame on `stream` in `frames`, as `FrameLog.take` joins them. */
const dataBytes = (frames: string, stream: i32): i32 => {
  const start: string = `; DATA ${stream} `
  const text: string = `; ${frames}`
  let total: i32 = 0
  let at: i32 = text.indexOf(start)
  while (at >= 0) {
    let k: i32 = at + toI32(start.length)
    let n: i32 = 0
    while (k < toI32(text.length) && toI32(text.charCodeAt(k)) >= 48 && toI32(text.charCodeAt(k)) <= 57) {
      n = n * 10 + toI32(text.charCodeAt(k)) - 48
      k++
    }
    total = total + n
    at = text.indexOf(start, k)
  }
  return total
}

/** `bytes` as `FrameLog` shows a DATA frame's text, one character a byte. */
const shown = (bytes: u8[]): string => {
  const parts: string[] = []
  for (const b of bytes) {
    parts.push(String.fromCharCode(toI32(b)))
  }
  return parts.join("")
}

/** The first frame of `frames` (as `FrameLog.take` joins them) that starts with `start`, or empty. */
const frameOf = (frames: string, start: string): string => {
  const at: i32 = frames.startsWith(start) ? 0 : frames.indexOf(`; ${start}`)
  if (at < 0) {
    return ""
  }
  const from: i32 = at === 0 && frames.startsWith(start) ? 0 : at + 2
  const end: i32 = frames.indexOf("; ", from)
  return end < 0 ? frames.substring(from) : frames.substring(from, end)
}

/** Whether `frames` answer `stream` with 200, `application/grpc`, and the SumReply of `result` (0 to 127): its 5-byte prefix, its 2 bytes, then `grpc-status: 0` trailers. */
const replied = (frames: string, stream: i32, result: i32): boolean =>
  frameOf(frames, `HEADERS ${stream} :status=200 `).indexOf(" content-type=application/grpc content-length=7") > 0 &&
  frames.indexOf(`DATA ${stream} 5 "${shown([toU8(0), toU8(0), toU8(0), toU8(0), toU8(2)])}"; DATA ${stream} 2 "${shown([toU8(8), toU8(result)])}"; HEADERS ${stream} end grpc-status=0`) >= 0

/** Whether `frames` answer `stream` in the Trailers-Only form with `status`: one HEADERS frame, ending the stream. */
const only = (frames: string, stream: i32, status: i32): boolean =>
  frameOf(frames, `HEADERS ${stream} end :status=200 `).indexOf(` content-type=application/grpc grpc-status=${status} content-length=0`) > 0 &&
  frames.indexOf(`DATA ${stream} `) < 0

/** HTTP/2 over TLS: GetSum, an error with a message, and one without. */
const tlsChecks = (t: Suite, rig: GrpcRig, key: Secret<u8[]>): void => {
  const h2 = new H2TlsClient(rig)
  t.ok("HTTP/2 over TLS: a handshake offering h2, the server's signature and Finished verified", h2.handshake(rig.port, key) && h2.verified)
  const none: i32[] = []
  const noValues: i64[] = []
  h2.wire.preface()
  h2.wire.settings(none, noValues)
  h2.wire.settingsAck()
  h2.wire.headers(n32(1), callOf("GetSum", "application/grpc", ""), 0)
  body(h2.wire, n32(1), sumOf(n32(2), n32(3)))
  h2.wire.headers(n32(3), callOf("Denied", "application/grpc", ""), 0)
  body(h2.wire, n32(3), sumOf(n32(0), n32(0)))
  h2.wire.headers(n32(5), callOf("Missing", "application/grpc", ""), 0)
  body(h2.wire, n32(5), sumOf(n32(0), n32(0)))
  h2.flush(key)
  // SETTINGS, WINDOW_UPDATE and the ack; GetSum's head, message and
  // trailers; Denied's head and trailers; Missing's one HEADERS.
  const frames: string = h2.awaitFrames(n32(10), key)
  t.ok("GetSum: 200, application/grpc, SumReply { result: 5 } length-prefixed, then grpc-status 0 in trailers", replied(frames, n32(1), n32(5)))
  t.ok("an error with a message: a head, then grpc-status and the message percent-encoded", frameOf(frames, "HEADERS 3 :status=200 ").indexOf(" content-type=application/grpc") > 0 && frames.indexOf("HEADERS 3 end grpc-status=7 grpc-message=no 100%25 %C3%A9") >= 0)
  t.ok("an error without one: Trailers-Only", only(frames, n32(5), n32(5)) && frames.indexOf("DATA 5") < 0)
  t.ok("the program saw the three calls; reply and fail each sent", rig.calls === 3 && rig.results.length === 3 && rig.results[0] === HANDLER_SENT && rig.results[1] === HANDLER_SENT && rig.results[2] === HANDLER_SENT)
}

/** h2c: GetSum, the content-types, and each way the message's framing is refused. */
const h2cChecks = (t: Suite, rig: GrpcRig, key: Secret<u8[]>): void => {
  const c = new H2cClient(rig)
  t.ok("h2c: a connection to the cleartext listener", c.connect(rig.h2cPort))
  const none: i32[] = []
  const noValues: i64[] = []
  const calls: i32 = rig.calls
  c.wire.preface()
  c.wire.settings(none, noValues)
  c.wire.settingsAck()
  c.wire.headers(n32(1), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(1), sumOf(n32(40), n32(2)))
  c.wire.headers(n32(3), callOf("GetSum", "application/grpc+proto", ""), 0)
  body(c.wire, n32(3), sumOf(n32(1), n32(1)))
  c.wire.headers(n32(5), callOf("GetSum", "text/plain", ""), 0)
  body(c.wire, n32(5), sumOf(n32(1), n32(1)))
  c.wire.headers(n32(7), callOf("GetSum", "application/grpc+json", ""), 0)
  body(c.wire, n32(7), sumOf(n32(1), n32(1)))
  // Compressed: the flag byte is 1.
  c.wire.headers(n32(9), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(9), [toU8(1), toU8(0), toU8(0), toU8(0), toU8(0)])
  // A length one past maxMessage, with no message behind it.
  c.wire.headers(n32(11), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(11), [toU8(0), toU8(0), toU8(0), toU8(0), toU8(RIG_MAX_MESSAGE + 1)])
  // A length of 4 over a 2-byte message.
  c.wire.headers(n32(13), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(13), [toU8(0), toU8(0), toU8(0), toU8(0), toU8(4), toU8(8), toU8(1)])
  // No body at all.
  c.wire.headers(n32(15), callOf("GetSum", "application/grpc", ""), H2_FLAG_END_STREAM)
  // A flag byte gRPC does not define.
  c.wire.headers(n32(17), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(17), [toU8(2), toU8(0), toU8(0), toU8(0), toU8(0)])
  // Lengths of 2^31 and 2^32 - 1: negative as an i32.
  c.wire.headers(n32(19), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(19), [toU8(0), toU8(128), toU8(0), toU8(0), toU8(0)])
  c.wire.headers(n32(21), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(21), [toU8(0), toU8(255), toU8(255), toU8(255), toU8(255)])
  // A body of one byte, and of four: part of a prefix.
  c.wire.headers(n32(23), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(23), [toU8(0)])
  c.wire.headers(n32(25), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(25), [toU8(0), toU8(0), toU8(0), toU8(0)])
  // The errors of the TLS checks, and one whose message holds CR, LF and NUL.
  c.wire.headers(n32(27), callOf("Denied", "application/grpc", ""), 0)
  body(c.wire, n32(27), sumOf(n32(0), n32(0)))
  c.wire.headers(n32(29), callOf("Missing", "application/grpc", ""), 0)
  body(c.wire, n32(29), sumOf(n32(0), n32(0)))
  c.wire.headers(n32(31), callOf("Control", "application/grpc", ""), 0)
  body(c.wire, n32(31), sumOf(n32(0), n32(0)))
  // A length of 1 over a 2-byte message: a byte past the declared one.
  c.wire.headers(n32(33), callOf("GetSum", "application/grpc", ""), 0)
  body(c.wire, n32(33), [toU8(0), toU8(0), toU8(0), toU8(0), toU8(1), toU8(8), toU8(1)])
  c.flush(key)
  // SETTINGS, WINDOW_UPDATE and the ack; three frames for each GetSum; one
  // HEADERS for each 415 and each Trailers-Only; two for each error with a
  // message.
  const frames: string = c.awaitFrames(n32(29), key)
  t.ok("GetSum over h2c: SumReply { result: 42 } and grpc-status 0", replied(frames, n32(1), n32(42)))
  t.ok("content-type application/grpc+proto is a call too", replied(frames, n32(3), n32(2)))
  t.ok("content-type text/plain: 415", frames.indexOf("HEADERS 5 end :status=415") >= 0)
  t.ok("content-type application/grpc+json: 415", frames.indexOf("HEADERS 7 end :status=415") >= 0)
  t.ok("a compressed message: UNIMPLEMENTED", only(frames, n32(9), n32(12)))
  t.ok("a length past maxMessage: RESOURCE_EXHAUSTED", only(frames, n32(11), n32(8)))
  t.ok("a length of 2^31, and of 2^32 - 1: RESOURCE_EXHAUSTED, not wrapped", only(frames, n32(19), n32(8)) && only(frames, n32(21), n32(8)))
  t.ok("a length the body does not match: INTERNAL", only(frames, n32(13), n32(13)))
  t.ok("a body longer than its declared length: INTERNAL", only(frames, n32(33), n32(13)))
  t.ok("no length prefix: INTERNAL", only(frames, n32(15), n32(13)))
  t.ok("an unknown flag byte: INTERNAL", only(frames, n32(17), n32(13)))
  t.ok("a body of 1 byte, and of 4, shorter than the prefix: INTERNAL", only(frames, n32(23), n32(13)) && only(frames, n32(25), n32(13)))
  t.ok("over h2c too, an error with a message: a head, then grpc-status and the message percent-encoded", frameOf(frames, "HEADERS 27 :status=200 ").indexOf(" content-type=application/grpc") > 0 && frames.indexOf("HEADERS 27 end grpc-status=7 grpc-message=no 100%25 %C3%A9") >= 0)
  t.ok("over h2c too, an error without one: Trailers-Only", only(frames, n32(29), n32(5)) && frames.indexOf("DATA 29") < 0)
  t.ok("a CR, LF and NUL in grpc-message reach the peer as %0D, %0A and %00", frames.indexOf("HEADERS 31 end grpc-status=3 grpc-message=a%0D%0Ab%00c") >= 0)
  t.ok("the program saw only the five well-formed calls", rig.calls - calls === 5)
}

/** `grpc-timeout`: one already past, one that passes while the program holds the call, and malformed ones. */
const deadlineChecks = (t: Suite, rig: GrpcRig, key: Secret<u8[]>): void => {
  const c = new H2cClient(rig)
  t.ok("deadlines: an h2c connection", c.connect(rig.h2cPort))
  const none: i32[] = []
  const noValues: i64[] = []
  const calls: i32 = rig.calls
  c.wire.preface()
  c.wire.settings(none, noValues)
  c.wire.settingsAck()
  c.wire.headers(n32(1), callOf("GetSum", "application/grpc", "1n"), 0)
  body(c.wire, n32(1), sumOf(n32(1), n32(1)))
  c.wire.headers(n32(3), callOf("Slow", "application/grpc", "50m"), 0)
  body(c.wire, n32(3), sumOf(n32(1), n32(1)))
  c.wire.headers(n32(5), callOf("GetSum", "application/grpc", "1S"), 0)
  body(c.wire, n32(5), sumOf(n32(3), n32(4)))
  c.wire.headers(n32(7), callOf("GetSum", "application/grpc", "99999999H"), 0)
  body(c.wire, n32(7), sumOf(n32(3), n32(5)))
  c.flush(key)
  // SETTINGS, WINDOW_UPDATE and the ack; the past one's Trailers-Only; three
  // frames for each GetSum.
  const first: string = c.awaitFrames(n32(12), key)
  t.ok("grpc-timeout 1n: DEADLINE_EXCEEDED before the program sees the call", only(first, n32(1), n32(4)))
  t.ok("grpc-timeout 1S: answered", replied(first, n32(5), n32(7)))
  t.ok("grpc-timeout 99999999H: answered", replied(first, n32(7), n32(8)))
  t.ok("the held call is the program's, unanswered", rig.held.length === 1 && first.indexOf("HEADERS 3") < 0)
  // Turn the loop past the held call's 50 ms, then answer it.
  const since: i64 = monotonicNanos()
  for (let turn: i32 = 0; turn < 200 && monotonicNanos() - since < 80000000; turn++) {
    c.turn(key)
  }
  const results: i32 = toI32(rig.results.length)
  t.ok("answering it after 50 ms", rig.answerHeld() === 1 && rig.results[results] === HANDLER_SENT)
  t.ok("reply sends DEADLINE_EXCEEDED, not the message", only(c.awaitFrames(n32(1), key), n32(3), n32(4)))
  // Malformed: no unit, no digits, an unknown unit, nine digits, two signs, empty.
  const bad: string[] = ["100", "S", "1x", "123456789S", "-1S", "+1S", ""]
  for (let k: i32 = 0; k < toI32(bad.length); k++) {
    const pairs: string[] = callOf("GetSum", "application/grpc", "x")
    pairs[pairs.length - 1] = bad[k]
    c.wire.headers(n32(9 + 2 * k), pairs, 0)
    body(c.wire, n32(9 + 2 * k), sumOf(n32(1), n32(1)))
  }
  c.flush(key)
  const refused: string = c.awaitFrames(toI32(bad.length), key)
  for (let k: i32 = 0; k < toI32(bad.length); k++) {
    t.ok(`grpc-timeout "${bad[k]}": INTERNAL`, only(refused, n32(9 + 2 * k), n32(13)))
  }
  t.ok("the program saw the held call and the three it answered, none malformed", rig.calls - calls === 3)
}

/** `maxTimeout` caps a deadline: on a rig whose cap is SHORT_TIMEOUT, a call asking for far longer, and one asking for nothing, expire at it. */
const capChecks = (t: Suite, key: Secret<u8[]>): void => {
  const rig = new GrpcRig(false, toI32(4), SHORT_TIMEOUT)
  const c = new H2cClient(rig)
  t.ok("maxTimeout 60 ms: an h2c connection to a second server", c.connect(rig.h2cPort))
  const none: i32[] = []
  const noValues: i64[] = []
  c.wire.preface()
  c.wire.settings(none, noValues)
  c.wire.settingsAck()
  c.wire.headers(n32(1), callOf("Slow", "application/grpc", "99999999H"), 0)
  body(c.wire, n32(1), sumOf(n32(1), n32(1)))
  c.wire.headers(n32(3), callOf("Slow", "application/grpc", ""), 0)
  body(c.wire, n32(3), sumOf(n32(1), n32(1)))
  c.flush(key)
  // SETTINGS, WINDOW_UPDATE and the ack.
  const first: string = c.awaitFrames(n32(3), key)
  t.ok("grpc-timeout 99999999H and none: both held by the program, neither refused", rig.held.length === 2 && first.indexOf("HEADERS 1") < 0 && first.indexOf("HEADERS 3") < 0)
  const since: i64 = monotonicNanos()
  for (let turn: i32 = 0; turn < 400 && monotonicNanos() - since < 120000000; turn++) {
    c.turn(key)
  }
  t.ok("answered after 120 ms, both are past maxTimeout", rig.answerHeld() === 2)
  const late: string = c.awaitFrames(n32(2), key)
  t.ok("reply sends DEADLINE_EXCEEDED for each: the cap is maxTimeout, not what was asked", only(late, n32(1), n32(4)) && only(late, n32(3), n32(4)))
}

/** One client of either kind, and every frame it has read, joined. */
class Peer {
  tls: boolean
  h2: H2TlsClient
  c: H2cClient
  wire: Wire
  rig: GrpcRig
  text: string = ""

  constructor(rig: GrpcRig, tls: boolean) {
    this.tls = tls
    this.rig = rig
    this.h2 = new H2TlsClient(rig)
    this.c = new H2cClient(rig)
    this.wire = tls ? this.h2.wire : this.c.wire
  }

  /** Connects, then sends the preface and SETTINGS; false when the connect or handshake failed. */
  connect(key: Secret<u8[]>): boolean {
    const up: boolean = this.tls ? this.h2.handshake(this.rig.port, key) && this.h2.verified : this.c.connect(this.rig.h2cPort)
    const none: i32[] = []
    const noValues: i64[] = []
    this.wire.preface()
    this.wire.settings(none, noValues)
    this.wire.settingsAck()
    this.flush(key)
    return up
  }

  flush(key: Secret<u8[]>): void {
    if (this.tls) {
      this.h2.flush(key)
    } else {
      this.c.flush(key)
    }
  }

  /** Turns the server's loop `n` times; over h2c, reads what came too. */
  turns(n: i32, key: Secret<u8[]>): void {
    for (let k: i32 = 0; k < n; k++) {
      if (this.tls) {
        this.rig.step(n32(5), key)
      } else {
        this.c.turn(key)
      }
    }
  }

  /** Turns the server's loop for `ms` milliseconds or more. */
  wait(ms: i64, key: Secret<u8[]>): void {
    const since: i64 = monotonicNanos()
    for (let turn: i32 = 0; turn < 400 && monotonicNanos() - since < ms * toI64(1000000); turn++) {
      this.turns(n32(1), key)
    }
  }

  /** Reads until a frame shows `marker`; answers every frame read on the connection, joined. */
  until(marker: string, key: Secret<u8[]>): string {
    if (this.text.indexOf(marker) >= 0) {
      return this.text
    }
    const got: string = this.tls ? this.h2.awaitText(marker, key) : this.c.awaitText(marker, key)
    if (got.length > 0) {
      this.text = this.text.length > 0 ? `${this.text}; ${got}` : got
    }
    return this.text
  }
}

/** The three streaming methods, over HTTP/2 over TLS (`tls`) or h2c. */
const streamChecks = (t: Suite, rig: GrpcRig, tls: boolean, key: Secret<u8[]>): void => {
  const over: string = tls ? "over TLS" : "over h2c"
  const p = new Peer(rig, tls)
  t.ok(`streaming ${over}: a connection`, p.connect(key))
  const calls: i32 = rig.calls
  const closed: i32 = rig.closed
  // SumAll, one message split across three DATA frames, each flushed alone.
  p.wire.headers(n32(1), callOf("SumAll", "application/grpc", ""), 0)
  piece(p.wire, n32(1), [toU8(0), toU8(0), toU8(0)])
  p.flush(key)
  p.turns(n32(3), key)
  piece(p.wire, n32(1), [toU8(0), toU8(4), toU8(8), toU8(2)])
  p.flush(key)
  p.turns(n32(3), key)
  t.ok(`SumAll ${over}: no answer while the client's stream is open`, p.until("HEADERS 1", key).indexOf("HEADERS 1") < 0 && rig.streams.length === 1)
  piece(p.wire, n32(1), [toU8(16), toU8(3)])
  body(p.wire, n32(1), new Array<u8>(0))
  p.flush(key)
  t.ok(`SumAll ${over}: a message split across three DATA frames, answered at the end of the stream`, replied(p.until("HEADERS 1 end", key), n32(1), n32(5)))
  // SumAll, three messages in one DATA frame.
  p.wire.headers(n32(3), callOf("SumAll", "application/grpc", ""), 0)
  body(p.wire, n32(3), joined(sumOf(n32(1), n32(2)), sumOf(n32(3), n32(4)), sumOf(n32(5), n32(6))))
  p.flush(key)
  t.ok(`SumAll ${over}: three messages in one DATA frame`, replied(p.until("HEADERS 3 end", key), n32(3), n32(21)))
  // Echo: a message answered while the client's stream is open, then another with its end.
  p.wire.headers(n32(5), callOf("Echo", "application/grpc", ""), 0)
  piece(p.wire, n32(5), sumOf(n32(2), n32(3)))
  p.flush(key)
  const first: string = p.until(`DATA 5 2 "${shown([toU8(8), toU8(5)])}"`, key)
  t.ok(`Echo ${over}: 200 and a reply before the client's stream ends`, frameOf(first, "HEADERS 5 :status=200 ").indexOf(" content-type=application/grpc") > 0 && first.indexOf(`DATA 5 2 "${shown([toU8(8), toU8(5)])}"`) > 0 && first.indexOf("HEADERS 5 end") < 0)
  body(p.wire, n32(5), sumOf(n32(4), n32(4)))
  p.flush(key)
  t.ok(`Echo ${over}: the second reply, then grpc-status 0 at the end of the stream`, p.until("HEADERS 5 end", key).indexOf(`DATA 5 2 "${shown([toU8(8), toU8(8)])}"; HEADERS 5 end grpc-status=0`) > 0)
  // SumAll, cancelled by the client mid-stream.
  p.wire.headers(n32(7), callOf("SumAll", "application/grpc", ""), 0)
  piece(p.wire, n32(7), sumOf(n32(1), n32(1)))
  p.flush(key)
  p.turns(n32(3), key)
  const open: boolean = rig.streams.length === 1
  p.wire.rst(n32(7), n32(8))
  p.flush(key)
  p.turns(n32(5), key)
  t.ok(`SumAll ${over}: RST_STREAM CANCEL ends the call, the program's read with it, and nothing is sent`, open && rig.streams.length === 0 && rig.closed - closed === 1 && p.until("HEADERS 7", key).indexOf("HEADERS 7") < 0)
  // SumAll, its 40 ms deadline passing mid-stream.
  p.wire.headers(n32(9), callOf("SumAll", "application/grpc", "40m"), 0)
  piece(p.wire, n32(9), sumOf(n32(1), n32(1)))
  p.flush(key)
  p.wait(toI64(60), key)
  t.ok(`SumAll ${over}: a deadline passing mid-stream is DEADLINE_EXCEEDED`, only(p.until("HEADERS 9 end", key), n32(9), n32(4)) && rig.streams.length === 0)
  // The framing faults, each in a streamed request.
  const faults: u8[][] = [
    [toU8(0), toU8(0), toU8(0), toU8(0), toU8(RIG_MAX_MESSAGE + 1)],
    [toU8(1), toU8(0), toU8(0), toU8(0), toU8(0)],
    [toU8(2), toU8(0), toU8(0), toU8(0), toU8(0)],
    [toU8(0), toU8(0), toU8(0), toU8(0), toU8(4), toU8(8), toU8(1)],
    [toU8(0), toU8(0), toU8(0)],
  ]
  const statuses: i32[] = [8, 12, 13, 13, 13]
  const names: string[] = ["a length past maxMessage", "a compressed message", "an unknown flag byte", "a message the stream ends inside", "a prefix the stream ends inside"]
  for (let k: i32 = 0; k < toI32(faults.length); k++) {
    p.wire.headers(n32(11 + 2 * k), callOf("SumAll", "application/grpc", ""), 0)
    body(p.wire, n32(11 + 2 * k), faults[k])
  }
  p.flush(key)
  for (let k: i32 = 0; k < toI32(faults.length); k++) {
    t.ok(`SumAll ${over}: ${names[k]}: grpc-status ${statuses[k]}`, only(p.until(`HEADERS ${11 + 2 * k} end`, key), n32(11 + 2 * k), statuses[k]))
  }
  t.ok(`SumAll ${over}: each fault ended the call, none answered by the program`, rig.streams.length === 0 && rig.closed - closed === 7)
  // Count: three replies, then grpc-status 0.
  p.wire.headers(n32(21), callOf("Count", "application/grpc", ""), 0)
  body(p.wire, n32(21), countOf(n32(3), n32(65), n32(0)))
  p.flush(key)
  const three: string = p.until("HEADERS 21 end", key)
  const a: i32 = three.indexOf(`DATA 21 2 "${shown([toU8(8), toU8(65)])}"`)
  const b: i32 = three.indexOf(`DATA 21 2 "${shown([toU8(8), toU8(66)])}"`)
  const c: i32 = three.indexOf(`DATA 21 2 "${shown([toU8(8), toU8(67)])}"`)
  t.ok(`Count ${over}: three replies in order, then grpc-status 0`, frameOf(three, "HEADERS 21 :status=200 ").indexOf(" content-type=application/grpc") > 0 && a > 0 && a < b && b < c && c < three.indexOf("HEADERS 21 end grpc-status=0") && dataBytes(three, n32(21)) === 21)
  // Count: a hundred replies of 1010 bytes each, past the 65535-byte window.
  rig.maxPending = 0
  p.wire.headers(n32(23), callOf("Count", "application/grpc", ""), 0)
  body(p.wire, n32(23), countOf(n32(100), n32(1), n32(1000)))
  p.flush(key)
  p.turns(n32(20), key)
  t.ok(`Count ${over}: a slow reader stalls the sender, no more than its budget and one reply queued`, rig.senders.length === 1 && rig.left[0] > 0 && rig.maxPending > RIG_BUDGET && rig.maxPending <= RIG_BUDGET + 1010)
  p.wire.windowUpdate(n32(0), n32(1000000))
  p.wire.windowUpdate(n32(23), n32(1000000))
  p.flush(key)
  const hundred: string = p.until("HEADERS 23 end", key)
  t.ok(`Count ${over}: the window opened, all hundred replies, then grpc-status 0`, dataBytes(hundred, n32(23)) === 101000 && hundred.indexOf("HEADERS 23 end grpc-status=0") > 0 && rig.senders.length === 0)
  // Count, stalled past its 40 ms deadline without the server's loop turning: send answers DEADLINE_EXCEEDED.
  const sendClosed: i32 = rig.closed
  p.wire.headers(n32(25), callOf("Count", "application/grpc", "40m"), 0)
  body(p.wire, n32(25), countOf(n32(100), n32(1), n32(1000)))
  p.flush(key)
  p.turns(n32(3), key)
  const since: i64 = monotonicNanos()
  while (monotonicNanos() - since < toI64(60000000)) {}
  p.wire.windowUpdate(n32(25), n32(1000000))
  p.flush(key)
  t.ok(`Count ${over}: send past the deadline ends the call DEADLINE_EXCEEDED`, p.until("HEADERS 25 end", key).indexOf("HEADERS 25 end grpc-status=4") > 0 && rig.closed - sendClosed === 1 && rig.senders.length === 0)
  // Count, every reply queued and the deadline passing while they wait: finish answers DEADLINE_EXCEEDED.
  const results: i32 = toI32(rig.results.length)
  p.wire.headers(n32(27), callOf("Count", "application/grpc", "40m"), 0)
  body(p.wire, n32(27), countOf(n32(68), n32(1), n32(1000)))
  p.flush(key)
  p.turns(n32(3), key)
  const queued: boolean = rig.senders.length === 1 && rig.left[0] === 0
  p.wait(toI64(60), key)
  p.wire.windowUpdate(n32(27), n32(1000000))
  p.flush(key)
  const late: string = p.until("HEADERS 27 end", key)
  t.ok(`Count ${over}: finish past the deadline ends the call DEADLINE_EXCEEDED, after the replies queued before it`, queued && dataBytes(late, n32(27)) === 68 * 1010 && late.indexOf("HEADERS 27 end grpc-status=4") > 0 && toI32(rig.results.length) === results + 1 && rig.results[results] === HANDLER_SENT && rig.senders.length === 0)
  t.ok(`streaming ${over}: the program saw all fourteen calls, the faulted ones too`, rig.calls - calls === 14)
}

/**
 * The Trailers-Only answers: 150 on one connection, past its 100 stream
 * slots, each giving its slot back; and a streamed call answered so before
 * the client's stream ends, whose later DATA does not hand it back to the
 * program.
 */
const onlyChecks = (t: Suite, rig: GrpcRig, tls: boolean, key: Secret<u8[]>): void => {
  const over: string = tls ? "over TLS" : "over h2c"
  const p = new Peer(rig, tls)
  t.ok(`Trailers-Only ${over}: a connection`, p.connect(key))
  let answered: boolean = true
  for (let batch: i32 = 0; batch < 3; batch++) {
    for (let k: i32 = 0; k < 50; k++) {
      const stream: i32 = 1 + 2 * (50 * batch + k)
      p.wire.headers(stream, callOf("Missing", "application/grpc", ""), 0)
      body(p.wire, stream, sumOf(n32(0), n32(0)))
    }
    p.flush(key)
    const frames: string = p.until(`HEADERS ${1 + 2 * (50 * batch + 49)} end`, key)
    for (let k: i32 = 0; k < 50; k++) {
      answered = answered && only(frames, 1 + 2 * (50 * batch + k), n32(5))
    }
  }
  t.ok(`Trailers-Only ${over}: 150 calls on one connection, each NOT_FOUND, none refused`, answered && p.text.indexOf("RST_STREAM") < 0)
  const calls: i32 = rig.calls
  // SumAll: a message that does not parse, failed while the client's stream is open.
  p.wire.headers(n32(301), callOf("SumAll", "application/grpc", ""), 0)
  piece(p.wire, n32(301), [toU8(0), toU8(0), toU8(0), toU8(0), toU8(2), toU8(8), toU8(128)])
  p.flush(key)
  const failed: boolean = only(p.until("HEADERS 301 end", key), n32(301), n32(3))
  piece(p.wire, n32(301), sumOf(n32(1), n32(1)))
  body(p.wire, n32(301), sumOf(n32(1), n32(1)))
  p.wire.headers(n32(303), callOf("GetSum", "application/grpc", ""), 0)
  body(p.wire, n32(303), sumOf(n32(2), n32(3)))
  p.flush(key)
  t.ok(`SumAll ${over}: INVALID_ARGUMENT before the stream ends; the client's later DATA is not handed back, and the next call is answered`, failed && replied(p.until("HEADERS 303 end", key), n32(303), n32(5)) && rig.calls - calls === 2 && rig.streams.length === 0)
}

/** HTTP/1.1: gRPC needs HTTP/2. */
const h1Checks = (t: Suite, rig: GrpcRig, key: Secret<u8[]>): void => {
  const c = new H1Client(rig)
  const request: string = `POST ${SERVICE}/GetSum HTTP/1.1\r\nhost: example.com\r\ncontent-type: application/grpc\r\ncontent-length: 0\r\n\r\n`
  t.ok("HTTP/1.1: a connection", c.send(rig.h1Port, request, key))
  t.ok("a gRPC call over it: 505", c.await("\r\n\r\n", key).indexOf("HTTP/1.1 505 ") === 0)
}

export const main = (): i32 => {
  const t = new Suite("grpc")
  const key: Secret<u8[]> = secret(leafPrivate())
  const rig = new GrpcRig(true, toI32(4), DEFAULT_TIMEOUT)
  t.ok("the server listens: HTTP/2 over TLS, h2c and HTTP/1.1", rig.port > 0 && rig.h2cPort > 0 && rig.h1Port > 0)
  tlsChecks(t, rig, key)
  h2cChecks(t, rig, key)
  deadlineChecks(t, rig, key)
  streamChecks(t, rig, true, key)
  streamChecks(t, rig, false, key)
  onlyChecks(t, rig, true, key)
  onlyChecks(t, rig, false, key)
  capChecks(t, key)
  h1Checks(t, rig, key)
  wipe(key)
  return t.done()
}
