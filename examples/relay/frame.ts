/**
 * The browser <-> relay wire format, ported from cs's
 * `services/relay/src/frame.rs`, which is itself a second implementation of
 * `packages/protocol/src/session.ts`. The numbers are read off those two, and
 * the tests in `tests/link/net_relay` decode the fixtures `session.ts`
 * produced, because a codec that only agrees with itself proves nothing.
 *
 * Little-endian throughout, and strings are NUL-terminated UTF-8, because that
 * is what `session.ts`'s `ByteWriter` writes. A frame is its type byte and a
 * body laid out per type:
 *
 * | Type | Byte | Body |
 * | --- | --- | --- |
 * | HELLO | 0x01 | version u8, token string |
 * | HELLO_OK | 0x02 | session id u32, max payload u16 |
 * | DATA | 0x03 | seq u16, the rest is the payload |
 * | PING | 0x04 | id u32, sent-at micros u64 |
 * | PONG | 0x05 | id u32, sent-at micros u64, relay dwell micros u32 |
 * | CLOSE | 0x06 | code u16, reason string |
 * | STATS | 0x07 | upstream RTT micros u32, client-to-relay u32, upstream u32 |
 *
 * **Decoding** reads a window `buf[off .. off + len)` into a `RelayFrame`
 * the caller owns, and never copies: DATA's payload and HELLO's token are
 * windows onto the same buffer, so forwarding a datagram costs a bounds check.
 * It answers the frame type, or one of the three errors frame.rs has —
 * `FRAME_TRUNCATED`, `FRAME_UNKNOWN_TYPE` (the byte in `type`) and
 * `FRAME_UNTERMINATED`. A HELLO_OK, PONG or STATS from a client is not
 * malformed but confused, so it is answered as its type with `fromRelay` set
 * and nothing after the type byte read, as frame.rs's `Frame::Unexpected`.
 * Invalid UTF-8 in a string (`nish/net/websocket`'s strict check) is read as
 * the empty string, as frame.rs reads it.
 *
 * **Encoding** writes into the caller's array at `at` and answers the frame's
 * length, or -1 when it does not fit; nothing allocates. A window outside its
 * array is the program's mistake and panics.
 */

import { h3CheckWindow } from "nish/net/http3-frame"
import { quicPacketCopy } from "nish/net/quic-packet"
import { websocketIsUtf8 } from "nish/net/websocket"

/** The version a client states in its HELLO. */
export const RELAY_PROTOCOL_VERSION: i32 = 1

/** The largest DATA payload forwarded: a conservative sub-MTU, so a forwarded payload never fragments. */
export const MAX_PAYLOAD_BYTES: i32 = 1200

/** The frame types. */
export const RELAY_HELLO: i32 = 0x01
export const RELAY_HELLO_OK: i32 = 0x02
export const RELAY_DATA: i32 = 0x03
export const RELAY_PING: i32 = 0x04
export const RELAY_PONG: i32 = 0x05
export const RELAY_CLOSE: i32 = 0x06
export const RELAY_STATS: i32 = 0x07

/**
 * Why a session ended, the whole set of `session.ts`'s `CloseCode`, including
 * the codes only a shutting-down or misbehaving relay sends: an enum with
 * holes in it is how two implementations drift.
 */
export const CLOSE_NORMAL: i32 = 0
export const CLOSE_TOKEN_INVALID: i32 = 1
export const CLOSE_TOKEN_EXPIRED: i32 = 2
export const CLOSE_RATE_LIMITED: i32 = 3
export const CLOSE_UPSTREAM_UNREACHABLE: i32 = 4
export const CLOSE_IDLE: i32 = 5
export const CLOSE_SHUTDOWN: i32 = 6
export const CLOSE_PROTOCOL_ERROR: i32 = 7

/** What `relayDecode` answers for a frame it cannot read. */
export const FRAME_TRUNCATED: i32 = -1
export const FRAME_UNKNOWN_TYPE: i32 = -2
export const FRAME_UNTERMINATED: i32 = -3

/** The fixed lengths of the frames the relay writes. */
export const RELAY_HELLO_OK_SIZE: i32 = 7
export const RELAY_DATA_HEADER: i32 = 3
export const RELAY_PONG_SIZE: i32 = 17
export const RELAY_STATS_SIZE: i32 = 13

/** The low 32 bits, for a field written as a u32, and where a u32 counter stops. */
export const RELAY_U32: i64 = 0xffffffff

/** One decoded frame: every field any type has, each set by the type that has it. */
export class RelayFrame {
  /** PING's id (a u32) and the client's clock in microseconds (a u64, its bits). */
  id: i64 = 0
  sentAtMicros: i64 = 0
  /** The type byte, also when `FRAME_UNKNOWN_TYPE` is answered for it. */
  type: i32 = 0
  /** HELLO's version. */
  version: i32 = 0
  /** HELLO's token or CLOSE's reason: a window onto the buffer decoded, without its NUL. */
  textStart: i32 = 0
  textLength: i32 = 0
  /** DATA's sequence number, and its payload, a window onto the buffer decoded. */
  seq: i32 = 0
  payloadStart: i32 = 0
  payloadLength: i32 = 0
  /** CLOSE's code. */
  code: i32 = 0
  /** A HELLO_OK, PONG or STATS from a client: named rather than read. */
  fromRelay: boolean = false
}

/** The little-endian u16 at `buf[at]`. */
const relayU16 = (buf: u8[], at: i32): i32 => toI32(buf[at]) | (toI32(buf[at + 1]) << 8)

/** The little-endian u32 at `buf[at]`, as an i64. */
const relayU32 = (buf: u8[], at: i32): i64 =>
  toI64(buf[at]) | (toI64(buf[at + 1]) << 8) | (toI64(buf[at + 2]) << 16) | (toI64(buf[at + 3]) << 24)

/** The little-endian u64 at `buf[at]`, its bits in an i64. */
const relayU64 = (buf: u8[], at: i32): i64 => relayU32(buf, at) | (relayU32(buf, at + 4) << 32)

/**
 * Reads the NUL-terminated string at `buf[at .. end)` into `f`'s text window
 * and answers the offset past its NUL, or `FRAME_UNTERMINATED`.
 */
const relayString = (f: RelayFrame, buf: u8[], at: i32, end: i32): i32 => {
  let p: i32 = at
  while (p >= 0 && p < end && p < toI32(buf.length) && buf[p] !== 0) {
    p = p + 1
  }
  if (p >= end) {
    return FRAME_UNTERMINATED
  }
  f.textStart = at
  f.textLength = websocketIsUtf8(buf, at, p - at) ? p - at : 0
  return p + 1
}

/** Whether `type` is a frame only a relay sends. */
const relaySentByRelay = (type: i32): boolean =>
  type === RELAY_HELLO_OK || type === RELAY_PONG || type === RELAY_STATS

/**
 * Decodes the frame in `buf[off .. off + len)` into `f`: its type, or
 * `FRAME_TRUNCATED`, `FRAME_UNKNOWN_TYPE` or `FRAME_UNTERMINATED`. Never
 * copies; see the module comment.
 */
export const relayDecode = (f: RelayFrame, buf: u8[], off: i32, len: i32): i32 => {
  h3CheckWindow("relayDecode", buf, off, len)
  f.fromRelay = false
  f.textStart = off
  f.textLength = 0
  f.payloadStart = off
  f.payloadLength = 0
  if (len < 1) {
    return FRAME_TRUNCATED
  }
  const end: i32 = off + len
  const type: i32 = toI32(buf[off])
  const at: i32 = off + 1
  f.type = type
  if (type === RELAY_HELLO) {
    if (len < 2) {
      return FRAME_TRUNCATED
    }
    f.version = toI32(buf[at])
    const past: i32 = relayString(f, buf, at + 1, end)
    return past < 0 ? past : type
  }
  if (type === RELAY_DATA) {
    if (len < RELAY_DATA_HEADER) {
      return FRAME_TRUNCATED
    }
    f.seq = relayU16(buf, at)
    f.payloadStart = at + 2
    f.payloadLength = end - (at + 2)
    return type
  }
  if (type === RELAY_PING) {
    if (len < 13) {
      return FRAME_TRUNCATED
    }
    f.id = relayU32(buf, at)
    f.sentAtMicros = relayU64(buf, at + 4)
    return type
  }
  if (type === RELAY_CLOSE) {
    if (len < 3) {
      return FRAME_TRUNCATED
    }
    f.code = relayU16(buf, at)
    const past: i32 = relayString(f, buf, at + 2, end)
    return past < 0 ? past : type
  }
  if (relaySentByRelay(type)) {
    f.fromRelay = true
    return type
  }
  return FRAME_UNKNOWN_TYPE
}

/** Writes `v`'s low `n` bytes at `out[at]`, little-endian. */
const relayPut = (out: u8[], at: i32, v: i64, n: i32): void => {
  for (let k: i32 = 0; k < n; k++) {
    out[at + k] = toU8(toI32((v >> (toI64(k) << toI64(3))) & 255))
  }
}

/** HELLO_OK: the session id and the largest payload the relay forwards. */
export const relayEncodeHelloOk = (out: u8[], at: i32, sessionId: i64, maxPayload: i32): i32 => {
  h3CheckWindow("relayEncodeHelloOk", out, at, 0)
  if (toI32(out.length) - at < RELAY_HELLO_OK_SIZE) {
    return -1
  }
  out[at] = toU8(RELAY_HELLO_OK)
  relayPut(out, at + 1, sessionId & RELAY_U32, 4)
  relayPut(out, at + 5, toI64(maxPayload & 0xffff), 2)
  return RELAY_HELLO_OK_SIZE
}

/**
 * DATA with `seq` (masked to 16 bits, so a caller keeps a plain counter) and
 * the payload `buf[off .. off + len)`. The one encode on the hot path, so it
 * fills a buffer the caller owns and writes nothing past the frame: a reused
 * buffer never leaks the previous payload into this one's length.
 */
export const relayEncodeData = (out: u8[], at: i32, seq: i32, buf: u8[], off: i32, len: i32): i32 => {
  h3CheckWindow("relayEncodeData", out, at, 0)
  h3CheckWindow("relayEncodeData", buf, off, len)
  if (toI32(out.length) - at - RELAY_DATA_HEADER < len) {
    return -1
  }
  out[at] = toU8(RELAY_DATA)
  relayPut(out, at + 1, toI64(seq & 0xffff), 2)
  quicPacketCopy(out, at + RELAY_DATA_HEADER, buf, off, len)
  return RELAY_DATA_HEADER + len
}

/** PONG: the PING's id and clock echoed, and how long the PING spent in the relay. */
export const relayEncodePong = (out: u8[], at: i32, id: i64, sentAtMicros: i64, dwellMicros: i64): i32 => {
  h3CheckWindow("relayEncodePong", out, at, 0)
  if (toI32(out.length) - at < RELAY_PONG_SIZE) {
    return -1
  }
  out[at] = toU8(RELAY_PONG)
  relayPut(out, at + 1, id & RELAY_U32, 4)
  relayPut(out, at + 5, sentAtMicros, 8)
  relayPut(out, at + 13, dwellMicros & RELAY_U32, 4)
  return RELAY_PONG_SIZE
}

/**
 * CLOSE: `code` and `reason`, which is ASCII without a NUL (every reason the
 * relay writes is a literal); -1 for one that is not, or that does not fit.
 */
export const relayEncodeClose = (out: u8[], at: i32, code: i32, reason: string): i32 => {
  h3CheckWindow("relayEncodeClose", out, at, 0)
  const n: i32 = toI32(reason.length)
  if (toI32(out.length) - at < n + 4) {
    return -1
  }
  out[at] = toU8(RELAY_CLOSE)
  relayPut(out, at + 1, toI64(code & 0xffff), 2)
  for (let k: i32 = 0; k < n; k++) {
    const c: i32 = toI32(reason.charCodeAt(k))
    if (c < 1 || c > 127) {
      return -1
    }
    out[at + 3 + k] = toU8(c)
  }
  out[at + 3 + n] = 0
  return n + 4
}

/** STATS: the path RTT in microseconds and the datagrams each way since the last STATS. */
export const relayEncodeStats = (
  out: u8[],
  at: i32,
  rttMicros: i64,
  fromClient: i64,
  fromUpstream: i64
): i32 => {
  h3CheckWindow("relayEncodeStats", out, at, 0)
  if (toI32(out.length) - at < RELAY_STATS_SIZE) {
    return -1
  }
  out[at] = toU8(RELAY_STATS)
  relayPut(out, at + 1, rttMicros & RELAY_U32, 4)
  relayPut(out, at + 5, fromClient & RELAY_U32, 4)
  relayPut(out, at + 9, fromUpstream & RELAY_U32, 4)
  return RELAY_STATS_SIZE
}
