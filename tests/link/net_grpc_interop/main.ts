// The gRPC server the interop job calls with grpcurl and ghz
// (`.github/workflows/interop.yml`, job `grpc`; `tests/interop/grpc/`).
//
//   main serve
//
// prints `ports tls <port> h2c <port>` (HTTP/2 over TLS and h2c, on
// 127.0.0.1) and answers the benchmark service of `../net_grpc/rig` until
// SIGTERM or SIGINT. Every call's deadline is capped at `CAP_MS`, and `/Slow`
// is answered once that deadline has passed, so it ends DEADLINE_EXCEEDED.
//
// With no arguments it checks, over h2c in one process, the pieces `serve`'s
// loop is made of: a rig of its own, with a 60 ms cap, answers GetSum, and
// `release` answers a held `/Slow` call only once it is past that deadline.
// It does not call `serve` or use the TLS listener.
import { Secret, secret, wipe } from "nish:secret"
import { Suite } from "nish/testing"
import { H2_FLAG_END_STREAM, http2WriteData } from "nish/net/http2-frame"
import { n32 } from "../net_quic_frame/typed"
import { leafPrivate } from "../net_tls_common/server"
import { NO_PAD, ZERO } from "../net_http2/peer"
import { H2cClient } from "../net_grpc/client"
import { GrpcRig } from "../net_grpc/rig"
import { release, serve } from "./serve"

/** The self-check's cap, short enough to outwait. */
const SHORT_CAP: i32 = 60

/** A request head for `method` of the benchmark service, with no `grpc-timeout`. */
const callOf = (method: string): string[] => [":method", "POST", ":scheme", "http", ":path", `/benchmark.BenchmarkService/${method}`, ":authority", "example.com", "content-type", "application/grpc", "te", "trailers"]

/** A length-prefixed SumRequest of `a` and `b`, each 0 to 127. */
const sumOf = (a: i32, b: i32): u8[] => [toU8(0), toU8(0), toU8(0), toU8(0), toU8(4), toU8(8), toU8(a), toU8(16), toU8(b)]

/** `bytes` as `FrameLog` shows a DATA frame's text, one character a byte. */
const shown = (bytes: u8[]): string => {
  const parts: string[] = []
  for (const b of bytes) {
    parts.push(String.fromCharCode(toI32(b)))
  }
  return parts.join("")
}

/** Whether `frames` answer stream 1 with 200, `application/grpc`, and SumReply { result: `result` } (0 to 127): its 5-byte prefix, its 2 bytes, then `grpc-status: 0` trailers. */
const summed = (frames: string, result: i32): boolean =>
  frames.indexOf("HEADERS 1 :status=200 ") >= 0 &&
  frames.indexOf(" content-type=application/grpc ") > 0 &&
  frames.indexOf(`DATA 1 5 "${shown([toU8(0), toU8(0), toU8(0), toU8(0), toU8(2)])}"; DATA 1 2 "${shown([toU8(8), toU8(result)])}"; HEADERS 1 end grpc-status=0`) >= 0

const selfCheck = (): i32 => {
  const t = new Suite("grpc interop server")
  const key: Secret<u8[]> = secret(leafPrivate())
  const rig = new GrpcRig(true, toI32(4), SHORT_CAP)
  t.ok("a rig like serve's listens: HTTP/2 over TLS and h2c", rig.port > 0 && rig.h2cPort > 0)
  const c = new H2cClient(rig)
  t.ok("an h2c connection", c.connect(rig.h2cPort))
  const none: i32[] = []
  const noValues: i64[] = []
  c.wire.preface()
  c.wire.settings(none, noValues)
  c.wire.settingsAck()
  c.wire.headers(n32(1), callOf("GetSum"), 0)
  c.wire.add(http2WriteData(c.wire.scratch, ZERO, n32(1), sumOf(n32(2), n32(3)), ZERO, n32(9), H2_FLAG_END_STREAM, NO_PAD))
  c.wire.headers(n32(3), callOf("Slow"), 0)
  c.wire.add(http2WriteData(c.wire.scratch, ZERO, n32(3), sumOf(n32(1), n32(1)), ZERO, n32(9), H2_FLAG_END_STREAM, NO_PAD))
  c.flush(key)
  // SETTINGS, WINDOW_UPDATE and the ack; GetSum's head, its prefix and its
  // message as two DATA frames, and its trailers.
  const first: string = c.awaitFrames(n32(7), key)
  t.ok("GetSum 2 + 3: SumReply { result: 5 }, then grpc-status 0", summed(first, n32(5)))
  t.ok("Slow: held, unanswered before its deadline", rig.held.length === 1 && release(rig) === 0 && first.indexOf("HEADERS 3") < 0)
  const since: i64 = monotonicNanos()
  let released: i32 = 0
  for (let turn: i32 = 0; turn < 400 && released === 0 && monotonicNanos() - since < 1000000000; turn++) {
    c.turn(key)
    released = release(rig)
  }
  const late: i64 = monotonicNanos() - since
  t.ok("released once past the capped deadline", released === 1 && rig.held.length === 0 && late >= 50000000)
  const last: string = c.awaitFrames(n32(1), key)
  t.ok("Slow ends Trailers-Only with grpc-status 4, DEADLINE_EXCEEDED, and no message", last.indexOf("HEADERS 3 end :status=200 ") === 0 && last.indexOf(" grpc-status=4 ") > 0 && last.indexOf("grpc-message") < 0)
  wipe(key)
  return t.done()
}

export const main = (): i32 => {
  if (toI32(process.argv.length) >= 2 && process.argv[1] === "serve") {
    return serve()
  }
  return selfCheck()
}
