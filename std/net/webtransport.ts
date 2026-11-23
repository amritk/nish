/**
 * `nish/net/webtransport` — WebTransport over HTTP/3, server side, as
 * draft-ietf-webtrans-http3-02 has it and as Chrome and the `wtransport` 0.7
 * crate negotiate it: sessions made by an extended CONNECT (RFC 9220) with
 * `:protocol` `webtransport`, HTTP datagrams (RFC 9297) carrying the
 * session's quarter stream ID, the session's unidirectional and
 * bidirectional streams, and CLOSE_WEBTRANSPORT_SESSION and
 * DRAIN_WEBTRANSPORT_SESSION on the CONNECT stream's capsules. It is a layer
 * over one `Http3Connection` (`nish/net/http3`), whose `Http3Config` turns
 * WebTransport on with `webtransportSessions`, and is sans-IO like it.
 *
 *     import { WebTransport, WebTransportConfig, WT_SESSION, WT_DATAGRAM } from "nish/net/webtransport";
 *     import { Http3Connection, H3_NEED_MORE, H3_ERROR } from "nish/net/http3";
 *
 *     // h3's Http3Config has webtransportSessions above 0.
 *     const serve = (h3: Http3Connection): void => {
 *       // once per slot, beside its Http3Connection:
 *       const wt = new WebTransport(new WebTransportConfig(), h3);
 *       // after quic.receive(...):
 *       let event: i32 = wt.next();
 *       while (event !== H3_NEED_MORE && event !== H3_ERROR) {
 *         // WT_SESSION: wt.sessionId, wt.fields (path, get("origin")) — accept or refuse it
 *         // WT_DATAGRAM: wt.sessionId, wt.data[wt.dataStart .. wt.dataStart + wt.dataLength)
 *         if (event === WT_SESSION) { wt.accept(wt.sessionId); }
 *         if (event === WT_DATAGRAM) { wt.sendDatagram(wt.sessionId, wt.data, wt.dataStart, wt.dataLength); }
 *         event = wt.next();
 *       }
 *     };
 *
 * **Events.**
 *
 *  `next()` answers a `WT_*` event, or one of `nish/net/http3`'s for a plain
 *  request, which passes through untouched so one connection can serve both:
 *  - `WT_SESSION` (a session asked for: `sessionId`, the CONNECT stream's ID,
 *    and `fields`; the program `accept`s or `refuse`s it),
 *  - `WT_DATAGRAM` (a datagram of an accepted session, a window onto `data`),
 *  - `WT_STREAM` (the client opened a stream of an accepted session: `stream`,
 *    `bidirectional`),
 *  - `WT_STREAM_DATA` (its bytes, a window onto `data`),
 *  - `WT_STREAM_END` (its FIN),
 *  - `WT_STREAM_RESET` (the client reset its side: `errorCode`, the HTTP/3 code,
 *    and `appCode`, the WebTransport code it maps to or -1),
 *  - `WT_STREAM_STOPPED` (the client asked this side to stop writing: the same
 *    two codes),
 *  - `WT_WRITABLE` (a stream, or a CONNECT stream whose capsule was held back,
 *    can take more),
 *  - `WT_DRAIN` (the client sent DRAIN_WEBTRANSPORT_SESSION) and `WT_CLOSED`
 *    (the session is over: `errorCode`, the CLOSE capsule's code or 0, the
 *    reason a window onto `data`, and `closedByPeer`).
 *
 *  Each event names its session in `sessionId` and in `session`, its index in
 *  the table, `0 .. webtransportSessions - 1`, for a program's own per-session
 *  arrays. A window is valid until the next call.
 *
 * **Writes.** `sendDatagram` (the quarter stream ID, then the payload, one
 * QUIC DATAGRAM frame; `maxDatagramPayload` says how much fits), `openStream`,
 * `write`, `resetStream`, `stopSending`, `close` (CLOSE_WEBTRANSPORT_SESSION
 * and the FIN) and `drain`. Each answers 0 or a count, or one of
 * `nish/net/http3`'s codes: H3_AGAIN, H3_CLOSED, H3_INVALID, H3_TOO_LARGE,
 * and `WT_LIMIT` for a stream past the session's cap.
 *
 * **A session** is the CONNECT stream's ID (draft-02 §2). A request is a
 * session when its `:protocol` is `webtransport`, its `:scheme` `https`, and
 * the client's SETTINGS offered SETTINGS_H3_DATAGRAM 1 and either
 * SETTINGS_ENABLE_WEBTRANSPORT 1 or SETTINGS_WEBTRANSPORT_MAX_SESSIONS
 * (§3.1); otherwise it is answered here and never reaches the program — 501
 * for another `:protocol` (RFC 8441 §4), 400 for the rest — as is one past
 * the session cap, with 429. `accept` answers 200 with
 * `sec-webtransport-http3-draft: draft02`, the response header Chrome's
 * draft-02 client looks for. With WebTransport on, `nish/net/http3` holds a
 * request until the client's SETTINGS have arrived (§3.1), and an extended
 * CONNECT is malformed, H3_MESSAGE_ERROR, where this side did not send
 * SETTINGS_ENABLE_CONNECT_PROTOCOL (RFC 9220 §3).
 *
 * **Datagrams** (RFC 9297 §2.1). A datagram whose quarter stream ID does not
 * parse, or names a stream past 2^62, is H3_DATAGRAM_ERROR and closes the
 * connection; one for a session that is not accepted — unknown, gone, or not
 * yet answered — is dropped and counted in `datagramsDropped`.
 *
 * **Streams** (§4). A stream names its session in its first bytes;
 * `nish/net/http3` reads them and holds the stream. One for an accepted
 * session is taken, up to `maxStreams` at once, and refused past it with
 * H3_REQUEST_REJECTED; one for a session asked for but not answered, or one
 * whose CONNECT stream has not arrived, waits — up to `maxPending` at once,
 * unread, so QUIC's flow control holds the client back — and is refused with
 * WT_BUFFERED_STREAM_REJECTED past that (§4.5); one for a session that is
 * gone, refused or was never one is refused with WT_SESSION_GONE. Refusing a
 * stream resets this side and asks the client to stop.
 *
 * **Capsules** (RFC 9297 §3) on the CONNECT stream's DATA: CLOSE (0x2843: a
 * 32-bit code and a UTF-8 reason of at most 1024 bytes) and DRAIN (0x78ae,
 * empty) are read; any other type is skipped. A CLOSE outside those lengths,
 * a DRAIN with a payload, or the stream ending inside a capsule is
 * H3_DATAGRAM_ERROR, and anything after a CLOSE is H3_MESSAGE_ERROR (§5);
 * each resets the CONNECT stream and ends the session. A session ends when
 * either side sends CLOSE, or the CONNECT stream ends or is reset: every one
 * of its streams is then reset with WT_SESSION_GONE, and this side's half of
 * the CONNECT stream finished.
 *
 * **Caps are start-up numbers**: the sessions (`Http3Config.webtransportSessions`),
 * the streams of one session and the streams waiting for theirs
 * (`WebTransportConfig`), and the datagram queues, which are the QUIC
 * connection's rings (`QUIC_CONN_DATAGRAM_QUEUE` each way). Every array is
 * made by the constructor; a session, a stream and a datagram find their
 * state through the QUIC connection's stream index, never by a scan, and
 * nothing a warm session does allocates. Counters a peer drives saturate.
 *
 * **The clock.** Each session keeps the time of its last activity
 * (`monotonicNanos`, read once a call of `next`): its request, its accept,
 * a datagram or a stream event either way, a capsule. `expire(now)`, called
 * from the program's loop as `Http1Server.expire` is, ends every session
 * quiet for longer than `WebTransportConfig.idleTimeout`: one never answered
 * is refused with 503, an accepted one is closed (CLOSE with code 0 and the
 * FIN, or a reset both ways when the capsule does not fit), and one already
 * closed whose client never finished its half is let go. Each session it
 * ends that the program still held is reported by the next calls of `next`
 * as WT_CLOSED, `closedByPeer` false, code 0. A session takes at most
 * `maxDatagramsPerSecond` datagrams in each fixed one-second window, the
 * first starting when the session is asked for and the next at the first
 * datagram a second or more after it; the rest are dropped and counted in
 * `datagramsDropped`. The window does not slide, so across a boundary up to
 * twice the cap can arrive within a second.
 *
 * **Error codes.** A stream's reset and STOP_SENDING carry an HTTP/3 code;
 * a WebTransport application's 32-bit code maps into the range from
 * 0x52e4a40fa8db (`wtCodeToHttp3`, `wtCodeFromHttp3`), as Chrome maps it.
 * `wtransport` 0.7 sends its codes unmapped, so an event carries both.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from draft-ietf-webtrans-http3-02, RFC 9220 and RFC 9297, with the
 * identifiers checked against `wtransport` 0.7.0 and Chrome's behaviour; no
 * code is ported from either.
 */
import { HttpFields, httpFieldBytes, httpFieldIs } from "nish/net/http-fields"
import {
  H3_DATAGRAM_ERROR,
  H3_MESSAGE_ERROR,
  H3_NO_ERROR,
  H3_REQUEST_REJECTED,
  H3_WT_SESSION_GONE,
  h3Count,
  h3CheckWindow,
  h3Greased,
  h3PutFrameHeader,
  h3PutVarint,
  h3ReadFrameHeader,
  h3ReadVarint,
  h3VarintLength,
  Http3FrameHeader,
} from "nish/net/http3-frame"
import {
  H3_AGAIN,
  H3_CLOSED,
  H3_DATA,
  H3_DROPPED,
  H3_END,
  H3_ERROR,
  H3_GOAWAY,
  H3_INVALID,
  H3_NEED_MORE,
  H3_REQUEST,
  H3_RESET,
  H3_STOPPED,
  H3_STREAM,
  H3_TOO_LARGE,
  H3_WRITABLE,
  Http3Connection,
} from "nish/net/http3"
import { QUIC_DATAGRAM_ERR_FULL, QUIC_DATAGRAM_NONE, QUIC_DATAGRAM_OK, QuicConnection } from "nish/net/quic"
import { tryCopyBytes } from "nish/bytes"
import { quicVarintSize } from "nish/net/quic-packet"
import { quicStreamIsUni } from "nish/net/quic-stream"
import { monotonicNanos } from "nish:process"

/** A session asked for: `sessionId`, `fields`. */
export const WT_SESSION: i32 = 16
/** A datagram of an accepted session: `data[dataStart .. dataStart + dataLength)`. */
export const WT_DATAGRAM: i32 = 17
/** The client opened a stream of an accepted session: `stream`, `bidirectional`. */
export const WT_STREAM: i32 = 18
/** A stream's bytes: `stream`, `data[dataStart .. dataStart + dataLength)`. */
export const WT_STREAM_DATA: i32 = 19
/** A stream's FIN: `stream`. */
export const WT_STREAM_END: i32 = 20
/** The client reset its side of `stream`: `errorCode`, `appCode`. */
export const WT_STREAM_RESET: i32 = 21
/** The client asked this side of `stream` to stop, and QUIC reset it: `errorCode`, `appCode`. */
export const WT_STREAM_STOPPED: i32 = 22
/** `stream` — a session's stream, or its CONNECT stream — can take more. */
export const WT_WRITABLE: i32 = 23
/**
 * The session is over: `errorCode`, the reason `data[dataStart .. dataStart + dataLength)`, `closedByPeer`.
 */
export const WT_CLOSED: i32 = 24
/** The client sent DRAIN_WEBTRANSPORT_SESSION: it will close the session soon. */
export const WT_DRAIN: i32 = 25

/** A stream past the session's `maxStreams`: Linux's EMFILE. */
export const WT_LIMIT: i32 = -24

/** CLOSE_WEBTRANSPORT_SESSION's capsule type (draft-02 §5). */
export const WT_CAPSULE_CLOSE: i64 = 0x2843
/** DRAIN_WEBTRANSPORT_SESSION's capsule type. */
export const WT_CAPSULE_DRAIN: i64 = 0x78ae
/** The longest reason a CLOSE capsule carries. */
export const WT_REASON_MAX: i32 = 1024
/** A stream of a session that is gone (draft-02 §4.5). */
export const WT_SESSION_GONE: i64 = H3_WT_SESSION_GONE
/** A stream refused because no more may wait for their session (§4.5). */
export const WT_BUFFERED_STREAM_REJECTED: i64 = 0x3994bd84
/** The first HTTP/3 code a WebTransport application code maps to. */
export const WT_FIRST_APP_CODE: i64 = 0x52e4a40fa8db

/** The most a configuration may set `maxStreams` and `maxPending` to. */
const WT_MAX_CAP: i32 = 4096

/** The longest `idleTimeout`, a day in milliseconds, and the highest `maxDatagramsPerSecond`. */
const WT_MAX_IDLE: i32 = 86400000
const WT_MAX_RATE: i32 = 1048576
/** Nanoseconds in a millisecond, and in a second. */
const WT_MILLI: i64 = 1000000
const WT_SECOND: i64 = 1000000000
/** The status a session asked for and never answered gets when `expire` ends it. */
const WT_STATUS_UNANSWERED: i32 = 503

/** Session states. */
const WT_FREE: i32 = 0
const WT_ASKED: i32 = 1
const WT_OPEN: i32 = 2
const WT_GONE: i32 = 3

/** A stream's bits: its side here done, and the client's side done. */
const WT_SENT: i32 = 1
const WT_RECEIVED: i32 = 2

/** Each session's slice of `reason`: a CLOSE capsule's 32-bit code, then its reason. */
const WT_REASON_STRIDE: i32 = WT_REASON_MAX + 4

/** The bytes a session keeps for a capsule header being read. */
const WT_HEAD: i32 = 16

/** The largest quarter stream ID (RFC 9297 §2.1): a stream ID is under 2^62. */
const WT_QUARTER_MAX: i64 = 1073741824 * 1073741824 - 1

/** Typed constants, since a bare literal is an `f64` under `--number-mode f64`. */
const WT_ZERO: i32 = 0
const WT_ZERO64: i64 = 0
const WT_STATUS_OK: i32 = 200
const WT_ONE: i32 = 1
const WT_NONE: i32 = -1
const WT_NONE64: i64 = -1
const WT_U32: i64 = 0xffffffff
/**
 * The golden ratio's fractional part: the fraction of a salted session
 * number times it, scaled to the bucket count, is its bucket (Knuth's
 * multiplicative hashing, worked in `f64`, which holds the 31-bit number's
 * product exactly enough for the 14 bits a bucket takes).
 */
const WT_GOLDEN: f64 = 0.6180339887498949

/** The caps of a WebTransport layer, fixed when it is made. */
export class WebTransportConfig {
  /** Streams one session may have at once, both kinds and both openers together. */
  maxStreams: i32 = 64
  /** Streams that may wait at once for a session not yet answered or not yet arrived (draft-02 §4.5). */
  maxPending: i32 = 16
  /**
   * Milliseconds a session may go without activity before `expire` ends it, 1 to 86,400,000: a
   * session asked for counts from its request, an accepted one from its last datagram or stream
   * event either way, and one this side closed from its close.
   */
  idleTimeout: i32 = 60000
  /**
   * Datagrams one session may deliver in a second, 1 to 1,048,576; the rest are dropped and counted
   * in `datagramsDropped`. Dropping is the whole defence: no count of drops closes the session.
   * Datagrams are unreliable by contract (RFC 9297), so a dropped one is a loss the application
   * already handles; a drop costs O(1); a close would punish a browser that bursts; and a client
   * past the cap gains nothing but the CPU its datagrams cost to drop.
   */
  maxDatagramsPerSecond: i32 = 1024
}

/**
 * The HTTP/3 code an application's 32-bit `code` is sent as (`WT_FIRST_APP_CODE` + n + n / 0x1e, skipping
 * the greased values).
 * @param code The application's code; only its low 32 bits are used, so a value past 2^32 - 1 or below 0
 *   is taken as those bits.
 * @returns The HTTP/3 error code, from `WT_FIRST_APP_CODE` to `wtCodeToHttp3(0xffffffff)`, never a greased
 *   value.
 */
export const wtCodeToHttp3 = (code: i64): i64 => {
  // Worked in `f64`, which holds every value here exactly: the largest is under 2^47.
  const n: f64 = toF64(code & WT_U32)
  return toI64(toF64(WT_FIRST_APP_CODE) + n + Math.floor(n / 30.0))
}

/**
 * The application code an HTTP/3 `code` carries, or -1 when it is outside the range, or one of its greased
 * values.
 * @param code An HTTP/3 error code, such as a peer's RESET_STREAM or STOP_SENDING code; any value.
 * @returns The 32-bit application code, 0 to 2^32 - 1, the inverse of `wtCodeToHttp3`; -1 for a code below
 *   `WT_FIRST_APP_CODE`, above `wtCodeToHttp3(0xffffffff)`, or greased.
 */
export const wtCodeFromHttp3 = (code: i64): i64 => {
  const last: i64 = wtCodeToHttp3(WT_U32)
  if (code < WT_FIRST_APP_CODE || code > last || h3Greased(code)) {
    return WT_NONE64
  }
  // `code` lies in the range checked above, under 2^47, so `f64` holds every value exactly.
  const shifted: f64 = toF64(code) - toF64(WT_FIRST_APP_CODE)
  return toI64(shifted - Math.floor(shifted / 31.0))
}

/** Panics unless `value` lies in `[low, high]`: a cap out of range is the program's mistake. */
const webtransportCheckCap = (what: string, value: i32, low: i32, high: i32): void => {
  if (value < low || value > high) {
    panic(`WebTransport: ${what} of ${value}, outside ${low} to ${high}`)
  }
}

/**
 * `a + b`, worked in `i64` and held to `i32`. Every caller adds an offset
 * and a length, or a count and one, that lie inside one array or one cap,
 * so the sum is an index into it or just past it and always fits.
 */
const wtAdd = (a: i32, b: i32): i32 => toI32(toI64(a) + toI64(b))

/** `a - b`, worked as `wtAdd` is, for offsets and lengths inside one array. */
const wtSub = (a: i32, b: i32): i32 => toI32(toI64(a) - toI64(b))

/**
 * A zeroed array of `n` bytes, or of none when `n` is below zero. Up to
 * 65535 bytes is one allocation; past that the array grows a byte at a time
 * from a 65535-byte start, which an `i32` length cannot make fail.
 */
const wtBytes = (n: i32): u8[] => {
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

/** A zeroed array of `n` `i32`s, made as `wtBytes` makes one. */
const wtI32s = (n: i32): i32[] => {
  if (n < 0) {
    return []
  }
  if (n <= 65535) {
    return new Array<i32>(toU16(n))
  }
  const out: i32[] = new Array<i32>(65535)
  for (let k: i32 = 65535; k < n; k += 1) {
    out.push(0)
  }
  return out
}

/** A zeroed array of `n` `i64`s, made as `wtBytes` makes one. */
const wtI64s = (n: i32): i64[] => {
  if (n < 0) {
    return []
  }
  if (n <= 65535) {
    return new Array<i64>(toU16(n))
  }
  const out: i64[] = new Array<i64>(65535)
  for (let k: i32 = 65535; k < n; k += 1) {
    out.push(0)
  }
  return out
}

/** The bucket count for `n` waiting streams: the least power of two at least `2 * n`, and at least 2. */
const wtBuckets = (n: i32): i32 => {
  for (let shift: i32 = 0; shift < 30; shift++) {
    const size: i32 = 1 << shift
    if (size >= n) {
      return 2 << shift
    }
  }
  return 1073741824
}

/**
 * The streams waiting for a session (draft-02 §4.5): at most `size`, filed
 * by the session ID they named in a hash keyed with bytes of entropy, each
 * bucket a list in arrival order. A session's waiting streams, and whether a
 * request's stream has any, are found by one probe and a walk of that
 * bucket, never by a pass over the room, so a client choosing session IDs
 * cannot make a request, an accept or a close cost the room's size.
 */
export class WebTransportWaiting {
  /** Entry `e`: the stream, the session it named, its bucket's neighbours; a free entry's `next` threads the free list. */
  private streams: i64[]
  private sessions: i64[]
  private next: i32[]
  private prev: i32[]
  /** Each bucket's first and last entry, or -1. */
  private heads: i32[]
  private tails: i32[]
  private salt: i64 = 0
  private freeHead: i32 = -1
  /** How many streams are waiting now. */
  count: i32 = 0

  /**
   * Makes an empty room, its hash salted with 4 bytes from `crypto.getRandomValues`.
   * @param size How many streams may wait at once; 0 or less makes room for 1.
   */
  constructor(size: i32) {
    const n: i32 = size > 0 ? size : WT_ONE
    this.streams = wtI64s(n)
    this.sessions = wtI64s(n)
    this.next = wtI32s(n)
    this.prev = wtI32s(n)
    const buckets: i32 = wtBuckets(n)
    this.heads = wtI32s(buckets)
    this.tails = wtI32s(buckets)
    const entropy: u8[] = wtBytes(4)
    crypto.getRandomValues(entropy)
    for (let j: i32 = 0; j < toI32(entropy.length); j++) {
      this.salt = (this.salt << toI64(8)) | toI64(toI32(entropy[j]))
    }
    this.reset()
  }

  /** @internal Empties the room; called by `WebTransport` in this module, not for callers. */
  reset(): void {
    this.heads.fill(WT_NONE)
    this.tails.fill(WT_NONE)
    const n: i32 = toI32(this.next.length)
    for (let e: i32 = 0; e < n; e++) {
      this.next[e] = e + 1 < n ? e + 1 : WT_NONE
    }
    this.freeHead = 0
    this.count = 0
  }

  /** The bucket of session ID `session`: its stream number, salted, hashed by `WT_GOLDEN`. */
  private bucket(session: i64): i32 {
    const x: i64 = ((session >> toI64(2)) ^ this.salt) & toI64(0x7fffffff)
    const scaled: f64 = toF64(x) * WT_GOLDEN
    return toI32((scaled - Math.floor(scaled)) * toF64(toI32(this.heads.length)))
  }

  /**
   * Files stream `stream`, waiting for session `session`; answers whether there was room.
   * @internal Called by `WebTransport` in this module; not for callers.
   */
  add(stream: i64, session: i64): boolean {
    const next: i32[] = this.next
    const prev: i32[] = this.prev
    const heads: i32[] = this.heads
    const tails: i32[] = this.tails
    const streams: i64[] = this.streams
    const sessions: i64[] = this.sessions
    const e: i32 = this.freeHead
    const b: i32 = this.bucket(session)
    // Every entry array has the room's size and both bucket arrays the bucket count, so only a full room fails here.
    if (
      e < 0 ||
      e >= toI32(next.length) ||
      e >= toI32(prev.length) ||
      e >= toI32(streams.length) ||
      e >= toI32(sessions.length) ||
      b < 0 ||
      b >= toI32(heads.length) ||
      b >= toI32(tails.length)
    ) {
      return false
    }
    this.freeHead = next[e]
    const tail: i32 = tails[b]
    streams[e] = stream
    sessions[e] = session
    next[e] = -1
    prev[e] = tail
    if (tail >= 0 && tail < toI32(next.length)) {
      next[tail] = e
    } else {
      heads[b] = e
    }
    tails[b] = e
    const count: i32 = this.count
    if (count >= 0 && count < toI32(next.length)) {
      this.count = count + 1
    }
    return true
  }

  /**
   * The oldest entry waiting for session `session`, or -1.
   * @internal Called by `WebTransport` in this module; not for callers.
   */
  first(session: i64): i32 {
    const heads: i32[] = this.heads
    const next: i32[] = this.next
    const sessions: i64[] = this.sessions
    const b: i32 = this.bucket(session)
    if (b < 0 || b >= toI32(heads.length)) {
      return WT_NONE
    }
    let e: i32 = heads[b]
    for (
      let guard: i32 = 0;
      guard < toI32(next.length) && e >= 0 && e < toI32(next.length) && e < toI32(sessions.length);
      guard++
    ) {
      if (sessions[e] === session) {
        return e
      }
      e = next[e]
    }
    return WT_NONE
  }

  /**
   * Takes entry `e`, one `first` answered, out of the room and answers its
   * stream, or -1 for an `e` that is not an entry of the room.
   * @internal Called by `WebTransport` in this module; not for callers.
   */
  take(e: i32): i64 {
    const next: i32[] = this.next
    const prev: i32[] = this.prev
    const heads: i32[] = this.heads
    const tails: i32[] = this.tails
    const streams: i64[] = this.streams
    const sessions: i64[] = this.sessions
    if (
      e < 0 ||
      e >= toI32(next.length) ||
      e >= toI32(prev.length) ||
      e >= toI32(streams.length) ||
      e >= toI32(sessions.length)
    ) {
      return WT_NONE64
    }
    const b: i32 = this.bucket(sessions[e])
    if (b < 0 || b >= toI32(heads.length) || b >= toI32(tails.length)) {
      return WT_NONE64
    }
    const stream: i64 = streams[e]
    const before: i32 = prev[e]
    const after: i32 = next[e]
    if (before >= 0 && before < toI32(next.length)) {
      next[before] = after
    } else {
      heads[b] = after
    }
    if (after >= 0 && after < toI32(prev.length)) {
      prev[after] = before
    } else {
      tails[b] = before
    }
    next[e] = this.freeHead
    this.freeHead = e
    const count: i32 = this.count
    if (count > 0) {
      this.count = count - 1
    }
    return stream
  }
}

/** One session index's state, kept by `WebTransport` in its table. */
class WebTransportSession {
  /** The session's ID, its CONNECT stream's ID; -1 while free. */
  id: i64 = -1
  /** The type of the capsule being read. */
  capType: i64 = -1
  /** What is left of the capsule's payload, or -1 between capsules. */
  capLeft: i64 = -1
  /** A capsule header being read, which may be split across DATA frames. */
  capHead: u8[]
  /** When it was last active (`monotonicNanos`). */
  lastActive: i64 = 0
  /** When its datagram second began (`monotonicNanos`). */
  rateSince: i64 = 0
  /** Its CLOSE payload as it arrives: the 32-bit code, then the reason, `WT_REASON_MAX + 4` bytes. */
  reason: u8[]
  /** Its index in the table, the `session` of its events. */
  index: i32 = 0
  /** WT_FREE, WT_ASKED, WT_OPEN or WT_GONE. */
  state: i32 = 0
  /** The CONNECT stream's QUIC slot. */
  slot: i32 = -1
  /** The first of its streams, a QUIC slot threaded through each stream's `next`, or -1. */
  firstStream: i32 = -1
  /** How many streams it holds, up to `maxStreams`. */
  streams: i32 = 0
  /** How many bytes of a capsule header `capHead` holds. */
  capHeadLen: i32 = 0
  /** How much of `reason` the CLOSE payload has filled. */
  capFill: i32 = 0
  /** Datagrams in, saturating. */
  datagramsIn: i32 = 0
  /** Datagrams out, saturating. */
  datagramsOut: i32 = 0
  /** How many datagrams its second has taken. */
  rateCount: i32 = 0
  /** Whether the client's CLOSE has been read: nothing may follow it. */
  closeRead: boolean = false

  /**
   * A free session.
   * @param index Its index in the table.
   */
  constructor(index: i32) {
    this.index = index
    this.capHead = wtBytes(WT_HEAD)
    this.reason = wtBytes(WT_REASON_STRIDE)
  }
}

/** One QUIC stream slot's state, kept by `WebTransport` for a session's stream. */
class WebTransportStream {
  /** The stream this slot's state is for, or -1. */
  id: i64 = -1
  /** Its session's index, or -1. */
  session: i32 = -1
  /** The next stream in its session's list, a QUIC slot, or -1. */
  next: i32 = -1
  /** The stream before it in its session's list, a QUIC slot, or -1. */
  prev: i32 = -1
  /** WT_SENT and WT_RECEIVED, once each side is done. */
  bits: i32 = 0
}

/**
 * The WebTransport sessions of one HTTP/3 connection. The fields after the
 * tables are the last event's; the module comment says which event sets
 * which.
 */
export class WebTransport {
  /** The caps this layer was made with; the arrays they size are made by the constructor. */
  config: WebTransportConfig
  private h3: Http3Connection
  private quic: QuicConnection
  /** The request fields of the last WT_SESSION: the same object as the `Http3Connection`'s `fields`. */
  fields: HttpFields
  private header: Http3FrameHeader
  /** A datagram read whole, and one being sent; a CLOSE capsule being written. */
  private datagram: u8[]
  private outgoing: u8[]
  private capsuleOut: u8[]
  /**
   * The buffer the window of WT_DATAGRAM, WT_STREAM_DATA and WT_CLOSED lies in: this layer's own
   * datagram buffer, the `Http3Connection`'s `data`, or the session's own store of its CLOSE
   * reason. Valid until the next call.
   */
  data: u8[]
  /** The response fields of an accepted session, and of a refusal. */
  private acceptNames: u8[][]
  private acceptValues: u8[][]
  private none: u8[][]
  // Per session. The four public arrays below are a read-only view of each
  // session's own state, copied after every event that changes it: a write to
  // one is overwritten at that session's next event.
  /** Each session's state, by session index. */
  private table: WebTransportSession[]
  /** Each session's ID, its CONNECT stream's ID, by session index; -1 for a free index. Read-only: copied from the session at each event. */
  sessionIds: i64[]
  /**
   * How many streams each session holds, the client's and this side's together, up to `maxStreams`;
   * a stream stops counting once both of its sides are over. Read-only: copied from the session at each event.
   */
  streamCount: i32[]
  /** Counters for a log or a rate cap, each saturating: datagrams in and out. Read-only: copied from the session at each event. */
  datagramsIn: i32[]
  /** How many datagrams each session sent, saturating at 2^31 - 1; zeroed when a session is asked for. Read-only: copied from the session at each event. */
  datagramsOut: i32[]
  /** The free sessions, a stack. */
  private free: i32[]
  /** Sessions `expire` ended that `next` has not yet reported, `expiredCount` of them, with their IDs. */
  private expiredSessions: i32[]
  private expiredIds: i64[]
  /** The time `next` last read, which stamps activity; and no session can expire before `expireAfter`. */
  private now: i64 = 0
  private expireAfter: i64 = 0
  // Per QUIC stream slot.
  /** The session whose CONNECT stream the slot holds, or -1. */
  sessionAt: i32[]
  /** The state of the session stream each slot holds. */
  private slots: WebTransportStream[]
  /** The streams waiting for a session. */
  waiting: WebTransportWaiting
  /** Sessions accepted while streams waited for them, `adoptCount` of them: `next` takes those streams first. */
  private adoptions: i32[]
  /** The last event's session ID, stream, and codes. */
  sessionId: i64 = -1
  /**
   * The stream ID of the last event about a stream: the client's or this side's stream, or the
   * session's CONNECT stream; a WT_DATAGRAM leaves it as it was.
   */
  stream: i64 = -1
  /**
   * The HTTP/3 code of the last WT_STREAM_RESET or WT_STREAM_STOPPED, or the 32-bit code of the
   * last WT_CLOSED's CLOSE capsule (0 when the session ended without one).
   */
  errorCode: i64 = 0
  /**
   * The WebTransport code `errorCode` maps to (`wtCodeFromHttp3`), or -1 when it maps to none; for
   * WT_CLOSED, `errorCode` itself.
   */
  appCode: i64 = -1
  /** How many of `expiredSessions` `next` has still to report. */
  private expiredCount: i32 = 0
  /** Where the capsules of a DATA window are being read: `h3.data[capAt .. capEnd)`, for session `capSession`. */
  private capAt: i32 = 0
  private capEnd: i32 = 0
  private capSession: i32 = -1
  /** The last event's session index, and its window onto `data`. */
  session: i32 = -1
  /** Where the last event's window starts in `data`. */
  dataStart: i32 = 0
  /** How many bytes the last event's window has. */
  dataLength: i32 = 0
  /** How many session indexes are free; a valid request for a session while none is free is answered 429. */
  freeCount: i32 = 0
  private adoptCount: i32 = 0
  /** The `h3.generation` this layer's state belongs to. */
  private generation: i32 = 0
  /** Counters for a log or a test, each saturating: datagrams dropped, sessions refused here, streams refused. */
  datagramsDropped: i32 = 0
  /** How many requests for a session this layer answered with a 400, 429 or 501, or `refuse` refused. */
  sessionsRefused: i32 = 0
  private streamsRefused: i32 = 0
  /** WT_STREAM's kind, and whether WT_CLOSED came from the client. */
  bidirectional: boolean = false
  /**
   * Whether the last WT_CLOSED came from the client: its CLOSE capsule, its FIN, or a reset the
   * client sent; false when this side ended the session, including when it reset the stream for a
   * malformed capsule or a FIN inside one.
   */
  closedByPeer: boolean = false

  /**
   * The WebTransport layer of `h3`, whose `Http3Config` must have
   * `webtransportSessions` above 0. A cap out of range panics.
   * @param config The caps: `maxStreams` 1 to 4096, `maxPending` 0 to 4096, `idleTimeout` 1 to
   *   86,400,000 and `maxDatagramsPerSecond` 1 to 1,048,576; kept, not copied.
   * @param h3 The connection this layer reads and writes, kept for the layer's life; its restarts
   *   restart this layer too.
   */
  constructor(config: WebTransportConfig, h3: Http3Connection) {
    const sessions: i32 = h3.config.webtransportSessions
    // `Http3Connection` already holds the count to `H3_MAX_SESSIONS`; what can be wrong here is a connection with WebTransport off.
    if (sessions < 1) {
      panic("WebTransport: the Http3Connection has WebTransport off (webtransportSessions 0)")
    }
    webtransportCheckCap("maxStreams", config.maxStreams, 1, WT_MAX_CAP)
    webtransportCheckCap("maxPending", config.maxPending, 0, WT_MAX_CAP)
    webtransportCheckCap("idleTimeout", config.idleTimeout, 1, WT_MAX_IDLE)
    webtransportCheckCap("maxDatagramsPerSecond", config.maxDatagramsPerSecond, 1, WT_MAX_RATE)
    this.config = config
    this.h3 = h3
    this.quic = h3.quic
    this.fields = h3.fields
    this.header = new Http3FrameHeader()
    const entry: i32 = h3.quic.datagramsIn.entrySize
    this.datagram = wtBytes(entry > 0 ? entry : WT_ONE)
    this.outgoing = wtBytes(wtAdd(h3.quic.datagramsOut.entrySize, 8))
    this.capsuleOut = wtBytes(WT_REASON_MAX + 4 + WT_HEAD)
    this.data = this.datagram
    this.acceptNames = [httpFieldBytes("sec-webtransport-http3-draft")]
    this.acceptValues = [httpFieldBytes("draft02")]
    this.none = []
    const table: WebTransportSession[] = []
    for (let s: i32 = 0; s < sessions; s++) {
      table.push(new WebTransportSession(s))
    }
    this.table = table
    this.sessionIds = wtI64s(sessions)
    this.streamCount = wtI32s(sessions)
    this.datagramsIn = wtI32s(sessions)
    this.datagramsOut = wtI32s(sessions)
    this.free = wtI32s(sessions)
    this.expiredSessions = wtI32s(sessions)
    this.expiredIds = wtI64s(sessions)
    this.now = monotonicNanos()
    const n: i32 = toI32(h3.quic.streams.slots.length)
    const count: i32 = n > 0 ? n : WT_ONE
    this.sessionAt = wtI32s(count)
    const slots: WebTransportStream[] = []
    for (let k: i32 = 0; k < count; k++) {
      slots.push(new WebTransportStream())
    }
    this.slots = slots
    this.waiting = new WebTransportWaiting(config.maxPending)
    this.adoptions = wtI32s(sessions)
    this.restart()
  }

  /** Forgets every session and stream, for the connection's next peer; `next` calls it when `h3` restarted. */
  private restart(): void {
    this.generation = this.h3.generation
    const table: WebTransportSession[] = this.table
    for (let s: i32 = 0; s < toI32(table.length); s++) {
      const w: WebTransportSession = table[s]
      w.state = WT_FREE
      w.id = -1
      this.publish(w)
    }
    this.sessionAt.fill(WT_NONE)
    const slots: WebTransportStream[] = this.slots
    for (let k: i32 = 0; k < toI32(slots.length); k++) {
      const t: WebTransportStream = slots[k]
      t.id = -1
      t.session = -1
    }
    const free: i32[] = this.free
    let count: i32 = 0
    for (let s: i32 = toI32(free.length) - 1; s >= 0; s--) {
      if (count >= 0 && count < toI32(free.length)) {
        free[count] = s
        count = count + 1
      }
    }
    this.freeCount = count
    this.waiting.reset()
    this.adoptCount = 0
    this.expiredCount = 0
    this.expireAfter = 0
    this.capAt = 0
    this.capEnd = 0
    this.capSession = -1
    this.sessionId = -1
    this.stream = -1
    this.session = -1
    this.errorCode = 0
    this.appCode = -1
    this.dataStart = 0
    this.dataLength = 0
    this.datagramsDropped = 0
    this.sessionsRefused = 0
    this.streamsRefused = 0
    this.bidirectional = false
    this.closedByPeer = false
  }

  /** Restarts this layer when its connection restarted since the last call. */
  private current(): void {
    if (this.generation !== this.h3.generation) {
      this.restart()
    }
  }

  // ---- Lookups ---------------------------------------------------------------------

  /** Session index `s`, or null for one out of range. */
  private at(s: i32): WebTransportSession | null {
    const table: WebTransportSession[] = this.table
    if (s >= 0 && s < toI32(table.length)) {
      return table[s]
    }
    return null
  }

  /** The stream state of QUIC slot `k`, or null for one out of range. */
  private slotAt(k: i32): WebTransportStream | null {
    const slots: WebTransportStream[] = this.slots
    if (k >= 0 && k < toI32(slots.length)) {
      return slots[k]
    }
    return null
  }

  /** Copies session `w`'s ID and counters into the public per-session arrays. */
  private publish(w: WebTransportSession): void {
    const s: i32 = w.index
    const ids: i64[] = this.sessionIds
    if (s >= 0 && s < toI32(ids.length)) {
      ids[s] = w.id
    }
    const streams: i32[] = this.streamCount
    if (s >= 0 && s < toI32(streams.length)) {
      streams[s] = w.streams
    }
    const into: i32[] = this.datagramsIn
    if (s >= 0 && s < toI32(into.length)) {
      into[s] = w.datagramsIn
    }
    const out: i32[] = this.datagramsOut
    if (s >= 0 && s < toI32(out.length)) {
      out[s] = w.datagramsOut
    }
  }

  /** The session whose CONNECT stream is `id`, or null: one probe of QUIC's stream index. */
  private sessionOf(id: i64): WebTransportSession | null {
    const k: i32 = this.quic.streams.slotOf(id)
    const at: i32[] = this.sessionAt
    if (k < 0 || k >= toI32(at.length)) {
      return null
    }
    const w: WebTransportSession | null = this.at(at[k])
    if (w === null || w.id !== id) {
      return null
    }
    return w
  }

  /** The state of a session's stream `id` that this layer tracks, or null. */
  private streamOf(id: i64): WebTransportStream | null {
    const t: WebTransportStream | null = this.slotAt(this.quic.streams.slotOf(id))
    if (t === null || t.id !== id) {
      return null
    }
    return t
  }

  /** The session of `id` when it is accepted and not gone, else null. */
  private openSession(id: i64): WebTransportSession | null {
    this.current()
    const w: WebTransportSession | null = this.sessionOf(id)
    if (w === null || w.state !== WT_OPEN) {
      return null
    }
    return w
  }

  // ---- Events ----------------------------------------------------------------------

  /**
   * Reads what the connection has and answers the next event (see the
   * module comment): a `WT_*` one, or a plain request's `H3_*` one. Call it
   * until it answers H3_NEED_MORE or H3_ERROR.
   * @returns A `WT_*` event; an `Http3Connection` event passed through, for a plain request or
   *   H3_GOAWAY; H3_NEED_MORE when there is nothing more to read now; or H3_ERROR, when
   *   `Http3Connection.next` answers it.
   */
  next(): i32 {
    this.current()
    const clock: i64 = monotonicNanos()
    // The clock never runs back, so a session's deadline only moves later.
    this.now = clock > this.now ? clock : this.now
    const expired: i32 = this.expiredCount
    if (expired > 0) {
      const i: i32 = expired - 1
      this.expiredCount = i
      const ids: i64[] = this.expiredIds
      const sessions: i32[] = this.expiredSessions
      if (i < toI32(ids.length) && i < toI32(sessions.length)) {
        const w: WebTransportSession | null = this.at(sessions[i])
        if (w !== null) {
          const id: i64 = ids[i]
          this.sessionId = id
          this.stream = id
          return this.closedEvent(w, WT_ZERO64, WT_ZERO, false)
        }
      }
    }
    for (let guard: i32 = 0; guard < 1000000; guard++) {
      if (this.adoptCount > 0) {
        const event: i32 = this.adoptWaiting()
        if (event !== H3_NEED_MORE) {
          return event
        }
        continue
      }
      if (this.capSession >= 0) {
        const event: i32 = this.capsules()
        if (event !== H3_NEED_MORE) {
          return event
        }
        continue
      }
      const got: i32 = this.receiveDatagram()
      if (got === WT_DATAGRAM) {
        return got
      }
      if (got === 1) {
        continue
      }
      const event: i32 = this.h3.next()
      if (event === H3_NEED_MORE || event === H3_ERROR) {
        return event
      }
      const routed: i32 = this.route(event)
      if (routed !== H3_NEED_MORE) {
        return routed
      }
      if (this.generation !== this.h3.generation) {
        return H3_NEED_MORE
      }
    }
    return H3_NEED_MORE
  }

  /**
   * Reads one QUIC datagram, if one is waiting: answers WT_DATAGRAM for one
   * of an accepted session, 1 for one dropped, or 0 when none is there.
   */
  private receiveDatagram(): i32 {
    const buf: u8[] = this.datagram
    const n: i32 = this.quic.readDatagram(buf, WT_ZERO, toI32(buf.length))
    if (n === QUIC_DATAGRAM_NONE || n < 0) {
      return WT_ZERO
    }
    const quarter: i64 = h3ReadVarint(buf, WT_ZERO, n)
    if (quarter < 0 || quarter > WT_QUARTER_MAX) {
      // RFC 9297 §2.1: a quarter stream ID that does not parse, or is too large.
      this.h3.fail(H3_DATAGRAM_ERROR)
      return WT_ONE
    }
    // Under 2^60, so the stream ID it names is under 2^62.
    const w: WebTransportSession | null = this.sessionOf(quarter << toI64(2))
    if (w === null || w.state !== WT_OPEN) {
      // §2.1.1: no session to take it; dropped.
      this.datagramsDropped = h3Count(this.datagramsDropped)
      return WT_ONE
    }
    const now: i64 = this.now
    const since: i64 = w.rateSince
    // `rateSince` is a reading of the same clock as `now`, which never runs back.
    if (now < 0 || since < 0 || since > now || now - since >= WT_SECOND) {
      w.rateSince = now
      w.rateCount = 0
    }
    const taken: i32 = w.rateCount
    if (taken < 0 || taken >= this.config.maxDatagramsPerSecond) {
      // Past the session's datagrams a second: dropped, as one QUIC could not queue would be.
      this.datagramsDropped = h3Count(this.datagramsDropped)
      return WT_ONE
    }
    w.rateCount = wtAdd(taken, 1)
    w.lastActive = now
    const at: i32 = h3VarintLength(buf, WT_ZERO)
    w.datagramsIn = h3Count(w.datagramsIn)
    this.publish(w)
    this.session = w.index
    this.sessionId = w.id
    this.data = buf
    this.dataStart = at
    this.dataLength = wtSub(n, at)
    return WT_DATAGRAM
  }

  /** What an `Http3Connection` event means here: a `WT_*` event, the same event passed through, or H3_NEED_MORE. */
  private route(event: i32): i32 {
    const h3: Http3Connection = this.h3
    const id: i64 = h3.stream
    if (event === H3_STREAM) {
      return this.arrived(id, h3.session)
    }
    if (event === H3_GOAWAY) {
      return event
    }
    if (event === H3_DROPPED) {
      // A request that never reached the program: no session will come of it.
      this.dropPending(id)
      return H3_NEED_MORE
    }
    if (event === H3_REQUEST) {
      if (toI32(h3.fields.protocol.length) > 0) {
        return this.asked(id)
      }
      // A plain request: no session, so nothing waiting for one on its stream.
      this.dropPending(id)
      return event
    }
    // The slot the event's stream was in: QUIC may have freed it with the read that ended it.
    const k: i32 = h3.slot
    const at: i32[] = this.sessionAt
    if (k >= 0 && k < toI32(at.length)) {
      const w: WebTransportSession | null = this.at(at[k])
      if (w !== null && w.id === id) {
        return this.connectEvent(w, event)
      }
    }
    const t: WebTransportStream | null = this.slotAt(k)
    if (t === null || t.id !== id) {
      // A plain request's, or one about a stream this layer refused or let go of.
      return event === H3_STOPPED ? H3_NEED_MORE : event
    }
    const owner: WebTransportSession | null = this.at(t.session)
    this.touch(t)
    this.stream = id
    this.session = t.session
    this.sessionId = owner !== null ? owner.id : WT_NONE64
    if (event === H3_DATA) {
      this.data = h3.data
      this.dataStart = h3.dataStart
      this.dataLength = h3.dataLength
      return WT_STREAM_DATA
    }
    if (event === H3_END) {
      this.settle(t, WT_RECEIVED)
      return WT_STREAM_END
    }
    if (event === H3_RESET) {
      this.codes(h3.errorCode)
      this.settle(t, WT_RECEIVED)
      return WT_STREAM_RESET
    }
    if (event === H3_STOPPED) {
      this.codes(h3.errorCode)
      this.settle(t, WT_SENT)
      return WT_STREAM_STOPPED
    }
    return event === H3_WRITABLE ? WT_WRITABLE : H3_NEED_MORE
  }

  /** Sets `errorCode` to `code` and `appCode` to what it maps to. */
  private codes(code: i64): void {
    this.errorCode = code
    this.appCode = wtCodeFromHttp3(code)
  }

  /** An event of session `w`'s CONNECT stream. */
  private connectEvent(w: WebTransportSession, event: i32): i32 {
    const h3: Http3Connection = this.h3
    w.lastActive = this.now
    this.session = w.index
    this.sessionId = w.id
    this.stream = w.id
    if (event === H3_DATA) {
      if (w.state === WT_GONE && !w.closeRead) {
        // This side closed it: what the client still sends is not read.
        return H3_NEED_MORE
      }
      this.capSession = w.index
      this.capAt = h3.dataStart
      this.capEnd = wtAdd(h3.dataStart, h3.dataLength)
      return this.capsules()
    }
    if (event === H3_END || event === H3_RESET) {
      // The client's half is over, and the session with it (draft-02 §5).
      const id: i64 = w.id
      const wasGone: boolean = w.state === WT_GONE
      const inside: boolean = w.capLeft >= 0 || w.capHeadLen > 0
      this.release(w)
      if (wasGone) {
        // This side's half is finished already.
        return H3_NEED_MORE
      }
      if (event === H3_RESET) {
        // `nish/net/http3` abandoned this side's half with the reset, the client's or its own.
        return this.closedEvent(w, WT_ZERO64, WT_ZERO, h3.resetByPeer)
      }
      if (inside) {
        // RFC 9297 §3.3: the stream ended inside a capsule.
        h3.reset(id, H3_DATAGRAM_ERROR)
        return this.closedEvent(w, WT_ZERO64, WT_ZERO, false)
      }
      this.finish(id)
      return this.closedEvent(w, WT_ZERO64, WT_ZERO, true)
    }
    // Trailers on a CONNECT stream mean nothing to a session.
    return event === H3_WRITABLE ? WT_WRITABLE : H3_NEED_MORE
  }

  /**
   * Finishes this side's half of CONNECT stream `id` with its FIN, or with
   * a reset both ways when the FIN cannot go — a session never answered has
   * no head for it to follow. Answers whether the FIN went: after a reset
   * the stream is dropped unread, so no event will end the session later.
   */
  private finish(id: i64): boolean {
    if (this.h3.writeData(id, this.capsuleOut, WT_ZERO, WT_ZERO, true) >= 0) {
      return true
    }
    this.h3.reset(id, H3_NO_ERROR)
    return false
  }

  /** WT_CLOSED for session `w` with `code` and the reason `w.reason[4 .. 4 + length)`. */
  private closedEvent(w: WebTransportSession, code: i64, length: i32, byPeer: boolean): i32 {
    this.session = w.index
    this.errorCode = code & WT_U32
    this.appCode = this.errorCode
    this.closedByPeer = byPeer
    this.data = w.reason
    this.dataStart = 4
    this.dataLength = length
    return WT_CLOSED
  }

  // ---- Sessions --------------------------------------------------------------------

  /**
   * An extended CONNECT arrived on `id`: a session when it is one this side
   * takes, answered here when not.
   */
  private asked(id: i64): i32 {
    const h3: Http3Connection = this.h3
    const f: HttpFields = h3.fields
    const k: i32 = this.quic.streams.slotOf(id)
    const at: i32[] = this.sessionAt
    if (k >= 0 && k < toI32(at.length)) {
      const stale: WebTransportSession | null = this.at(at[k])
      if (stale !== null && stale.id >= 0) {
        // QUIC freed this slot under a session's CONNECT stream with no event to say so: let go of
        // that session now, before the cap below counts it.
        this.release(stale)
      }
    }
    let status: i32 = 0
    const peer = h3.peer
    if (!httpFieldIs(f.protocol, "webtransport")) {
      status = 501
    } else if (
      !httpFieldIs(f.scheme, "https") ||
      peer.h3Datagram !== toI64(1) ||
      (peer.enableWebtransport !== toI64(1) && peer.webtransportMaxSessions <= 0)
    ) {
      status = 400
    } else if (this.freeCount <= 0) {
      status = 429
    }
    if (status !== 0) {
      this.answer(id, status)
      this.dropPending(id)
      return H3_NEED_MORE
    }
    if (k < 0 || k >= toI32(at.length)) {
      return H3_NEED_MORE
    }
    const free: i32[] = this.free
    const i: i32 = wtSub(this.freeCount, 1)
    if (i < 0 || i >= toI32(free.length)) {
      return H3_NEED_MORE
    }
    const w: WebTransportSession | null = this.at(free[i])
    if (w === null) {
      return H3_NEED_MORE
    }
    this.freeCount = i
    w.id = id
    w.state = WT_ASKED
    w.slot = k
    w.firstStream = -1
    w.streams = 0
    w.capType = -1
    w.capLeft = -1
    w.closeRead = false
    w.capHeadLen = 0
    w.capFill = 0
    w.datagramsIn = 0
    w.datagramsOut = 0
    w.lastActive = this.now
    w.rateSince = this.now
    w.rateCount = 0
    this.publish(w)
    at[k] = w.index
    this.session = w.index
    this.sessionId = id
    this.stream = id
    return WT_SESSION
  }

  /** Answers the request on `id` with `status` and stops reading it: a session refused. */
  private answer(id: i64, status: i32): void {
    this.sessionsRefused = h3Count(this.sessionsRefused)
    if (this.h3.respond(id, status, this.none, this.none, true) !== 0) {
      this.h3.reset(id, H3_REQUEST_REJECTED)
    }
    this.h3.discardRequest(id, H3_NO_ERROR)
  }

  /**
   * Accepts session `id` with a 200 (draft-02 §3.2): its datagrams and
   * streams reach the program from now on, the streams that waited for it
   * first. Answers 0, H3_AGAIN when the response does not fit yet, or
   * H3_CLOSED for one that is not a session asked for.
   * @param id The session's ID, the `sessionId` of its WT_SESSION.
   * @returns 0 once the 200 is written; H3_AGAIN while the stream has no room for it; H3_TOO_LARGE
   *   when the head is past the client's SETTINGS_MAX_FIELD_SECTION_SIZE or the stream's buffer; or
   *   H3_CLOSED for an ID that is not a session asked for and not yet answered, or a stream that can
   *   no longer be written.
   */
  accept(id: i64): i32 {
    this.current()
    const w: WebTransportSession | null = this.sessionOf(id)
    if (w === null || w.state !== WT_ASKED) {
      return H3_CLOSED
    }
    const result: i32 = this.h3.respond(id, WT_STATUS_OK, this.acceptNames, this.acceptValues, false)
    if (result !== 0) {
      return result
    }
    w.state = WT_OPEN
    w.lastActive = this.now
    // The streams that waited for it are taken by the next calls of `next`, each with its WT_STREAM.
    const list: i32[] = this.adoptions
    const c: i32 = this.adoptCount
    if (this.waiting.first(id) >= 0 && c >= 0 && c < toI32(list.length)) {
      list[c] = w.index
      this.adoptCount = c + 1
    }
    return 0
  }

  /**
   * Refuses session `id` with `status`, 400 to 599 (draft-02 §3.2): the
   * response ends the stream, and what the client still sends is dropped.
   * Answers 0, H3_INVALID for a status out of range, or H3_CLOSED.
   * @param id The session's ID, the `sessionId` of its WT_SESSION.
   * @param status The response status, 400 to 599.
   * @returns 0 once the session is let go; H3_INVALID for a status outside 400 to 599; or H3_CLOSED
   *   for an ID that is not a session asked for and not yet answered.
   */
  refuse(id: i64, status: i32): i32 {
    this.current()
    const w: WebTransportSession | null = this.sessionOf(id)
    if (w === null || w.state !== WT_ASKED) {
      return H3_CLOSED
    }
    if (status < 400 || status > 599) {
      return H3_INVALID
    }
    this.answer(id, status)
    this.release(w)
    return 0
  }

  /**
   * Ends session `w` here: every stream reset with WT_SESSION_GONE and asked
   * to stop, the streams waiting for it refused, and its slot freed.
   */
  private release(w: WebTransportSession): void {
    this.end(w)
    const k: i32 = w.slot
    const at: i32[] = this.sessionAt
    if (k >= 0 && k < toI32(at.length) && at[k] === w.index) {
      at[k] = -1
    }
    w.id = -1
    w.state = WT_FREE
    this.publish(w)
    if (this.capSession === w.index) {
      this.capSession = -1
    }
    const free: i32[] = this.free
    const c: i32 = this.freeCount
    if (c >= 0 && c < toI32(free.length)) {
      free[c] = w.index
      this.freeCount = c + 1
    }
  }

  /** Resets every stream of session `w` and refuses those waiting for it; the session is gone. */
  private end(w: WebTransportSession): void {
    if (w.state === WT_FREE) {
      return
    }
    let k: i32 = w.firstStream
    for (let guard: i32 = 0; guard < WT_MAX_CAP; guard++) {
      const t: WebTransportStream | null = this.slotAt(k)
      if (t === null) {
        break
      }
      const following: i32 = t.next
      this.h3.refuseStream(t.id, WT_SESSION_GONE)
      t.id = -1
      t.session = -1
      k = following
    }
    w.firstStream = -1
    w.streams = 0
    this.publish(w)
    this.dropPending(w.id)
    w.state = WT_GONE
    // A closed session's clock restarts: the client has `idleTimeout` to finish its half.
    w.lastActive = this.now
  }

  /** Refuses with WT_SESSION_GONE every stream waiting for session `id`. */
  private dropPending(id: i64): void {
    if (this.waiting.count === 0) {
      return
    }
    let e: i32 = this.waiting.first(id)
    for (let guard: i32 = 0; guard < WT_MAX_CAP && e >= 0; guard++) {
      const stream: i64 = this.waiting.take(e)
      if (stream < 0) {
        return
      }
      this.refuseStream(stream, WT_SESSION_GONE)
      e = this.waiting.first(id)
    }
  }

  /**
   * Closes session `id` (draft-02 §5): CLOSE_WEBTRANSPORT_SESSION with the
   * application's `code` and the reason `buf[off .. off + len)`, at most
   * 1024 bytes of UTF-8, then the FIN; every stream of the session is reset
   * with WT_SESSION_GONE. Answers 0; H3_INVALID for a reason too long;
   * H3_AGAIN while the CONNECT stream has no room for the capsule, and
   * WT_WRITABLE then names it; or H3_CLOSED.
   * @param id The session's ID.
   * @param code The application's code; only its low 32 bits are sent.
   * @param buf The buffer holding the reason; only read, and copied into the capsule. A window outside
   *   it panics, whatever the session's state.
   * @param off Where the reason starts in `buf`.
   * @param len How many bytes the reason has, at most 1024.
   * @returns 0 once the capsule and the FIN are written; H3_INVALID for a reason past 1024 bytes;
   *   H3_AGAIN while the CONNECT stream has no room for the capsule; H3_TOO_LARGE for a capsule past
   *   the stream's buffer; or H3_CLOSED for a session not accepted or already gone, or a CONNECT
   *   stream that can no longer be written.
   */
  close(id: i64, code: i64, buf: u8[], off: i32, len: i32): i32 {
    h3CheckWindow("WebTransport.close", buf, off, len)
    const w: WebTransportSession | null = this.openSession(id)
    if (w === null) {
      return H3_CLOSED
    }
    if (len < 0 || len > 1024) {
      return H3_INVALID
    }
    const out: u8[] = this.capsuleOut
    const end: i32 = toI32(out.length)
    const p: i32 = h3PutFrameHeader(out, WT_ZERO, end, WT_CAPSULE_CLOSE, toI64(len + 4))
    const value: i64 = code & WT_U32
    const head: u8[] = [
      toU8(toI32((value >> toI64(24)) & toI64(255))),
      toU8(toI32((value >> toI64(16)) & toI64(255))),
      toU8(toI32((value >> toI64(8)) & toI64(255))),
      toU8(toI32(value & toI64(255))),
    ]
    const at: i32 = wtAdd(p, 4)
    if (p < 0 || !tryCopyBytes(out, p, head, WT_ZERO, 4) || !tryCopyBytes(out, at, buf, off, len)) {
      return H3_TOO_LARGE
    }
    const result: i32 = this.h3.writeDataWhole(id, out, WT_ZERO, wtAdd(at, len), true)
    if (result !== 0) {
      return result
    }
    this.end(w)
    return 0
  }

  /**
   * Sends DRAIN_WEBTRANSPORT_SESSION on session `id`: the client should
   * finish and close it. Answers 0, H3_AGAIN, or H3_CLOSED.
   * @param id The session's ID.
   * @returns 0 once the capsule is written; H3_AGAIN while the CONNECT stream has no room for it; or
   *   H3_CLOSED for a session not accepted or already gone, or a CONNECT stream that can no longer be
   *   written.
   */
  drain(id: i64): i32 {
    if (this.openSession(id) === null) {
      return H3_CLOSED
    }
    const out: u8[] = this.capsuleOut
    const end: i32 = toI32(out.length)
    const p: i32 = h3PutFrameHeader(out, WT_ZERO, end, WT_CAPSULE_DRAIN, toI64(0))
    return this.h3.writeDataWhole(id, out, WT_ZERO, p, false)
  }

  /** Stamps the session of stream `t` as active now. */
  private touch(t: WebTransportStream): void {
    const w: WebTransportSession | null = this.at(t.session)
    if (w !== null) {
      w.lastActive = this.now
    }
  }

  // ---- The clock -------------------------------------------------------------------

  /** `idleTimeout` in nanoseconds: at most a day's, so worked exactly in `f64`. */
  private idleNanos(): i64 {
    return toI64(toF64(this.config.idleTimeout) * toF64(WT_MILLI))
  }

  /**
   * Ends every session quiet for longer than `idleTimeout` at `now` (see
   * the module comment): one never answered is refused with 503, an
   * accepted one closed with code 0, and one already closed whose client
   * never finished its half let go. Call it from the program's loop; it
   * returns at once before the soonest deadline it last saw. The next calls
   * of `next` report each session the program held as WT_CLOSED.
   * @param now The current time, from `monotonicNanos`; a negative one ends none.
   * @returns How many sessions it ended.
   */
  expire(now: i64): i32 {
    this.current()
    const idle: i64 = this.idleNanos()
    if (now < 0 || idle < 0 || now < this.expireAfter) {
      return 0
    }
    this.now = now > this.now ? now : this.now
    // The least time left to any session, from `now`.
    let wait: i64 = idle
    let n: i32 = 0
    const table: WebTransportSession[] = this.table
    for (let s: i32 = 0; s < toI32(table.length); s++) {
      const w: WebTransportSession = table[s]
      const state: i32 = w.state
      if (state !== WT_FREE) {
        const last: i64 = w.lastActive
        // Activity stamped after `now` (by a later `next`) is no quiet at all.
        const quiet: i64 = last >= 0 && last <= now ? now - last : WT_ZERO64
        if (quiet > idle) {
          this.timeOut(w, state)
          n = wtAdd(n, 1)
        } else if (quiet >= 0 && idle - quiet < wait) {
          wait = idle - quiet
        }
      }
    }
    // A clock reading plus at most a day: under 2^63 for 290 years of uptime.
    this.expireAfter = now + wait
    return n
  }

  /**
   * The soonest `expire` could end a session, at or after `now`: activity
   * only moves a session's deadline later.
   * @param now The current time, from `monotonicNanos`.
   * @returns The earliest `monotonicNanos` instant at which `expire` could end a session; `now` plus
   *   `idleTimeout` when no session is held, and `now` itself for a negative `now`.
   */
  expiresNoSooner(now: i64): i64 {
    const idle: i64 = this.idleNanos()
    if (now < 0 || idle < 0) {
      return now
    }
    let wait: i64 = idle
    const table: WebTransportSession[] = this.table
    for (let s: i32 = 0; s < toI32(table.length); s++) {
      const w: WebTransportSession = table[s]
      if (w.state !== WT_FREE) {
        const last: i64 = w.lastActive
        const quiet: i64 = last >= 0 && last <= now ? now - last : WT_ZERO64
        if (quiet >= idle) {
          return now
        }
        if (quiet >= 0 && idle - quiet < wait) {
          wait = idle - quiet
        }
      }
    }
    // As in `expire`: a clock reading plus at most a day.
    return now + wait
  }

  /** Ends session `w`, in `state`, for its idleness, and queues its WT_CLOSED unless the program let go of it already. */
  private timeOut(w: WebTransportSession, state: i32): void {
    const id: i64 = w.id
    if (state === WT_ASKED) {
      this.answer(id, WT_STATUS_UNANSWERED)
      this.release(w)
    } else if (state === WT_OPEN) {
      if (this.close(id, WT_ZERO64, this.capsuleOut, WT_ZERO, WT_ZERO) !== 0) {
        // No room for the capsule: reset the CONNECT stream both ways, after which no event ends the session.
        this.h3.reset(id, H3_NO_ERROR)
        this.release(w)
      }
    } else {
      // Closed here, or by the client's CLOSE, and the client never finished its half: stop reading it.
      this.h3.discardRequest(id, H3_NO_ERROR)
      this.release(w)
      return
    }
    const sessions: i32[] = this.expiredSessions
    const ids: i64[] = this.expiredIds
    const c: i32 = this.expiredCount
    if (c >= 0 && c < toI32(sessions.length) && c < toI32(ids.length)) {
      sessions[c] = w.index
      ids[c] = id
      this.expiredCount = c + 1
    }
  }

  // ---- Capsules --------------------------------------------------------------------

  /**
   * Reads the capsules of the DATA window `h3.data[capAt .. capEnd)` of
   * session `capSession`'s CONNECT stream, and answers the first event they
   * make, or H3_NEED_MORE once the window is read.
   */
  private capsules(): i32 {
    const w: WebTransportSession | null = this.at(this.capSession)
    if (w === null) {
      this.capSession = -1
      return H3_NEED_MORE
    }
    const bytes: u8[] = this.h3.data
    while (this.capAt < this.capEnd && this.capAt >= 0 && this.capAt < toI32(bytes.length)) {
      const at: i32 = this.capAt
      if (w.closeRead) {
        // §5: nothing may follow a CLOSE.
        return this.malformed(w, H3_MESSAGE_ERROR)
      }
      const left: i64 = w.capLeft
      if (left < 0) {
        // The header, a byte at a time into the session's own buffer: it may be split across DATA frames.
        const have: i32 = w.capHeadLen
        const head: u8[] = w.capHead
        if (have < 0 || have >= toI32(head.length) || at < 0 || at >= toI32(bytes.length)) {
          return this.malformed(w, H3_DATAGRAM_ERROR)
        }
        head[have] = bytes[at]
        this.capAt = wtAdd(at, 1)
        w.capHeadLen = have + 1
        if (h3ReadFrameHeader(this.header, head, WT_ZERO, have + 1) === 0) {
          continue
        }
        w.capHeadLen = 0
        const type: i64 = this.header.type
        const length: i64 = this.header.length
        if (type === WT_CAPSULE_CLOSE && (length < 4 || length > toI64(WT_REASON_STRIDE))) {
          return this.malformed(w, H3_DATAGRAM_ERROR)
        }
        if (type === WT_CAPSULE_DRAIN && length !== toI64(0)) {
          return this.malformed(w, H3_DATAGRAM_ERROR)
        }
        w.capType = type
        w.capLeft = length
        w.capFill = 0
      } else {
        const want: i64 = toI64(wtSub(this.capEnd, at))
        const take: i32 = toI32(left < want ? left : want)
        if (take < 0) {
          return this.malformed(w, H3_DATAGRAM_ERROR)
        }
        // The CLOSE's length was held to `reason`'s size above, so the copy fits.
        if (w.capType === WT_CAPSULE_CLOSE && !tryCopyBytes(w.reason, w.capFill, bytes, at, take)) {
          return this.malformed(w, H3_DATAGRAM_ERROR)
        }
        if (w.capType === WT_CAPSULE_CLOSE) {
          w.capFill = wtAdd(w.capFill, take)
        }
        this.capAt = wtAdd(at, take)
        w.capLeft = left - toI64(take)
      }
      if (w.capLeft === toI64(0)) {
        w.capLeft = -1
        const event: i32 = this.capsule(w, w.capType)
        if (event !== H3_NEED_MORE) {
          return event
        }
      }
    }
    this.capSession = -1
    return H3_NEED_MORE
  }

  /** A whole capsule of `type` on session `w`'s CONNECT stream. */
  private capsule(w: WebTransportSession, type: i64): i32 {
    this.session = w.index
    this.sessionId = w.id
    this.stream = w.id
    if (type === WT_CAPSULE_DRAIN) {
      return w.state === WT_GONE ? H3_NEED_MORE : WT_DRAIN
    }
    if (type !== WT_CAPSULE_CLOSE) {
      // RFC 9297 §3.2: a capsule type this side does not know is skipped.
      return H3_NEED_MORE
    }
    w.closeRead = true
    if (w.state === WT_GONE) {
      // This side closed it first, and finished its half then.
      return H3_NEED_MORE
    }
    const reason: u8[] = w.reason
    let code: i64 = 0
    for (let j: i32 = 0; j < 4 && j < toI32(reason.length); j++) {
      code = (code << toI64(8)) | toI64(toI32(reason[j]))
    }
    this.end(w)
    // A CLOSE's payload is its 4-byte code and then the reason, 1028 bytes at most.
    const fill: i32 = w.capFill
    const length: i32 = fill >= 4 && fill <= 1028 ? fill - 4 : WT_ZERO
    // §5: the CLOSE is answered by finishing this side's half; when that cannot go, the session is over here and now.
    if (!this.finish(w.id)) {
      this.release(w)
    }
    return this.closedEvent(w, code, length, true)
  }

  /** A capsule that breaks a rule on session `w`: its CONNECT stream reset both ways with `code`, and the session over. */
  private malformed(w: WebTransportSession, code: i64): i32 {
    const id: i64 = w.id
    const wasGone: boolean = w.state === WT_GONE
    this.capSession = -1
    this.release(w)
    this.h3.reset(id, code)
    this.h3.discardRequest(id, code)
    this.stream = id
    this.sessionId = id
    return wasGone ? H3_NEED_MORE : this.closedEvent(w, WT_ZERO64, WT_ZERO, false)
  }

  // ---- Streams ---------------------------------------------------------------------

  /** A stream named session `session` in its first bytes (H3_STREAM): taken, kept waiting or refused. */
  private arrived(id: i64, session: i64): i32 {
    const w: WebTransportSession | null = this.sessionOf(session)
    if (w !== null && w.state === WT_OPEN) {
      return this.adopt(w, id)
    }
    if ((w !== null && w.state === WT_ASKED) || (w === null && this.h3.awaitsRequest(session))) {
      // draft-02 §4.5: it waits, unread, for its session.
      if (this.waiting.count < this.config.maxPending && this.waiting.add(id, session)) {
        return H3_NEED_MORE
      }
      this.refuseStream(id, WT_BUFFERED_STREAM_REJECTED)
      return H3_NEED_MORE
    }
    this.refuseStream(id, WT_SESSION_GONE)
    return H3_NEED_MORE
  }

  /**
   * Takes the oldest stream still waiting for the last session accepted
   * with streams waiting: answers its WT_STREAM, or H3_NEED_MORE once that
   * session has none left (or is gone), when the next session's turn comes.
   */
  private adoptWaiting(): i32 {
    const list: i32[] = this.adoptions
    const i: i32 = wtSub(this.adoptCount, 1)
    if (i < 0 || i >= toI32(list.length)) {
      this.adoptCount = 0
      return H3_NEED_MORE
    }
    const w: WebTransportSession | null = this.at(list[i])
    if (w !== null && w.state === WT_OPEN) {
      const e: i32 = this.waiting.first(w.id)
      const stream: i64 = e >= 0 ? this.waiting.take(e) : WT_NONE64
      if (stream >= 0) {
        return this.adopt(w, stream)
      }
    }
    this.adoptCount = i
    return H3_NEED_MORE
  }

  /** Refuses stream `id` with `code`, counted. */
  private refuseStream(id: i64, code: i64): void {
    this.streamsRefused = h3Count(this.streamsRefused)
    this.h3.refuseStream(id, code)
  }

  /**
   * Takes the client's stream `id` into session `w`, unless the session
   * holds `maxStreams` already: answers WT_STREAM, or H3_NEED_MORE for one
   * refused with H3_REQUEST_REJECTED.
   */
  private adopt(w: WebTransportSession, id: i64): i32 {
    if (w.streams >= this.config.maxStreams) {
      this.refuseStream(id, H3_REQUEST_REJECTED)
      return H3_NEED_MORE
    }
    const bidi: boolean = !quicStreamIsUni(id)
    if (this.h3.acceptStream(id) !== 0 || this.link(w, id, bidi ? WT_ZERO : WT_SENT) < 0) {
      return H3_NEED_MORE
    }
    this.session = w.index
    this.sessionId = w.id
    this.stream = id
    this.bidirectional = bidi
    return WT_STREAM
  }

  /** Puts stream `id` at the head of session `w`'s list with `bits`; answers its slot, or -1. */
  private link(w: WebTransportSession, id: i64, bits: i32): i32 {
    const k: i32 = this.quic.streams.slotOf(id)
    const t: WebTransportStream | null = this.slotAt(k)
    if (t === null) {
      return WT_NONE
    }
    if (t.id >= 0) {
      // QUIC freed this slot under a stream whose end no event told (a STOP_SENDING it answered and saw acknowledged): let go of it now.
      this.unlink(t)
    }
    const head: i32 = w.firstStream
    t.id = id
    t.session = w.index
    t.bits = bits
    t.prev = -1
    t.next = head
    const first: WebTransportStream | null = this.slotAt(head)
    if (first !== null) {
      first.prev = k
    }
    w.firstStream = k
    // At most `maxStreams`, 4096: `adopt` and `openStream` check it first.
    w.streams = wtAdd(w.streams, 1)
    this.publish(w)
    return k
  }

  /** Marks `bits` done on stream `t`, and takes it off its session once both sides are. */
  private settle(t: WebTransportStream, bits: i32): void {
    t.bits = t.bits | bits
    if ((t.bits & (WT_SENT | WT_RECEIVED)) === (WT_SENT | WT_RECEIVED)) {
      this.unlink(t)
    }
  }

  /** Takes stream `t` off its session's list. */
  private unlink(t: WebTransportStream): void {
    const w: WebTransportSession | null = this.at(t.session)
    const before: WebTransportStream | null = this.slotAt(t.prev)
    const after: WebTransportStream | null = this.slotAt(t.next)
    if (before !== null) {
      before.next = t.next
    } else if (w !== null) {
      w.firstStream = t.next
    }
    if (after !== null) {
      after.prev = t.prev
    }
    if (w !== null) {
      w.streams = wtSub(w.streams, 1)
      this.publish(w)
    }
    t.id = -1
    t.session = -1
  }

  /**
   * Opens a stream of this side's for session `id` (draft-02 §4.1, §4.2).
   * Answers its ID; WT_LIMIT when the session holds `maxStreams`; H3_AGAIN
   * while the client's MAX_STREAMS allows no more; or H3_CLOSED.
   * @param id The session's ID.
   * @param bidirectional Whether the stream is bidirectional; a unidirectional one has no side for
   *   the client to write.
   * @returns The new stream's ID; WT_LIMIT when the session holds `maxStreams`; H3_AGAIN while the
   *   client's MAX_STREAMS allows no more; or H3_CLOSED for a session not accepted, or one already
   *   gone.
   */
  openStream(id: i64, bidirectional: boolean): i64 {
    const w: WebTransportSession | null = this.openSession(id)
    if (w === null) {
      return toI64(H3_CLOSED)
    }
    if (w.streams >= this.config.maxStreams) {
      return toI64(WT_LIMIT)
    }
    const stream: i64 = this.h3.openStream(id, bidirectional)
    if (stream < 0) {
      return stream
    }
    this.link(w, stream, bidirectional ? WT_ZERO : WT_RECEIVED)
    return stream
  }

  /**
   * Writes up to `len` bytes of `buf` from `off` to session stream `id`, with
   * its FIN when `fin` and all were taken. Answers how many it took, or
   * H3_AGAIN, or H3_CLOSED (see `Http3Connection.writeStream`).
   * @param id The stream's ID, one of a session this layer took or opened.
   * @param buf The buffer holding the bytes; only read, and what is taken is copied.
   * @param off Where the bytes start in `buf`.
   * @param len How many bytes to write.
   * @param fin Whether to end this side of the stream once every byte is taken.
   * @returns How many bytes it took, fewer than `len` only when the send buffer filled (0 for a bare
   *   FIN); H3_AGAIN when it took none; or H3_CLOSED for a stream this layer does not hold or with no
   *   side here to write.
   */
  write(id: i64, buf: u8[], off: i32, len: i32, fin: boolean): i32 {
    this.current()
    const t: WebTransportStream | null = this.streamOf(id)
    if (t === null) {
      return H3_CLOSED
    }
    const n: i32 = this.h3.writeStream(id, buf, off, len, fin)
    if (n >= 0) {
      this.touch(t)
    }
    if (fin && n === len) {
      this.settle(t, WT_SENT)
    }
    return n
  }

  /**
   * Resets this side of session stream `id` with the application's `code` (mapped, `wtCodeToHttp3`).
   * @param id The stream's ID, one of a session this layer took or opened.
   * @param code The application's code; only its low 32 bits are sent, mapped.
   * @returns 0 once the reset is sent, or H3_CLOSED for a stream this layer does not hold.
   */
  resetStream(id: i64, code: i64): i32 {
    this.current()
    const t: WebTransportStream | null = this.streamOf(id)
    if (t === null) {
      return H3_CLOSED
    }
    const result: i32 = this.h3.resetStream(id, wtCodeToHttp3(code))
    if (result !== 0) {
      return result
    }
    this.settle(t, WT_SENT)
    return 0
  }

  /**
   * Asks the client to stop its side of session stream `id` with the application's `code`, and drops
   * what it sends.
   * @param id The stream's ID, one of a session this layer took or opened.
   * @param code The application's code; only its low 32 bits are sent, mapped (`wtCodeToHttp3`).
   * @returns 0 once STOP_SENDING is sent, or H3_CLOSED for a stream this layer does not hold or
   *   whose client side is already over.
   */
  stopSending(id: i64, code: i64): i32 {
    this.current()
    const t: WebTransportStream | null = this.streamOf(id)
    if (t === null || (t.bits & WT_RECEIVED) !== 0) {
      return H3_CLOSED
    }
    const result: i32 = this.h3.stopStream(id, wtCodeToHttp3(code))
    if (result !== 0) {
      return result
    }
    this.settle(t, WT_RECEIVED)
    return 0
  }

  // ---- Datagrams -------------------------------------------------------------------

  /**
   * The largest payload `sendDatagram` takes for session `id` now: what the
   * QUIC connection's `maxDatagramPayload` leaves after the quarter stream
   * ID; 0 for a session not accepted.
   * @param id The session's ID.
   * @returns The most payload bytes one datagram may carry now, 0 or more.
   */
  maxDatagramPayload(id: i64): i32 {
    if (this.openSession(id) === null) {
      return WT_ZERO
    }
    const room: i32 = wtSub(this.quic.maxDatagramPayload(), quicVarintSize(id >> toI64(2)))
    return room > 0 ? room : WT_ZERO
  }

  /**
   * Sends `buf[off .. off + len)` as an HTTP datagram of session `id` (RFC
   * 9297 §2.1): its quarter stream ID, then the payload, one QUIC DATAGRAM
   * frame, never sent again if lost. Answers 0; H3_TOO_LARGE past
   * `maxDatagramPayload`; H3_AGAIN while QUIC's queue is full; or H3_CLOSED
   * for a session not accepted.
   * @param id The session's ID.
   * @param buf The buffer holding the payload; only read, and copied into the datagram. A window
   *   outside it panics, whatever the session's state.
   * @param off Where the payload starts in `buf`.
   * @param len How many bytes the payload has.
   * @returns 0 once the datagram is queued; H3_AGAIN while QUIC's queue is full; H3_TOO_LARGE past
   *   `maxDatagramPayload`, or when QUIC refuses it for any other reason; or H3_CLOSED for a session
   *   not accepted, or one already gone.
   */
  sendDatagram(id: i64, buf: u8[], off: i32, len: i32): i32 {
    h3CheckWindow("WebTransport.sendDatagram", buf, off, len)
    const w: WebTransportSession | null = this.openSession(id)
    if (w === null) {
      return H3_CLOSED
    }
    const out: u8[] = this.outgoing
    const p: i32 = h3PutVarint(out, WT_ZERO, toI32(out.length), id >> toI64(2))
    // The quarter stream ID and the payload must fit what QUIC sends now (`maxDatagramPayload`, without the ID's room).
    if (p < 0 || len > wtSub(this.quic.maxDatagramPayload(), p) || !tryCopyBytes(out, p, buf, off, len)) {
      return H3_TOO_LARGE
    }
    const result: i32 = this.quic.sendDatagram(out, WT_ZERO, wtAdd(p, len))
    if (result === QUIC_DATAGRAM_OK) {
      w.lastActive = this.now
      w.datagramsOut = h3Count(w.datagramsOut)
      this.publish(w)
      return 0
    }
    return result === QUIC_DATAGRAM_ERR_FULL ? H3_AGAIN : H3_TOO_LARGE
  }
}
