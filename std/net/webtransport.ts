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
 *
 *     const wt = new WebTransport(new WebTransportConfig(), h3);   // once per slot, beside its Http3Connection
 *     // after quic.receive(...):
 *     let event: i32 = wt.next();
 *     while (event !== H3_NEED_MORE && event !== H3_ERROR) {
 *       // WT_SESSION: wt.sessionId, wt.fields (path, get("origin")) — accept or refuse it
 *       // WT_DATAGRAM: wt.sessionId, wt.data[wt.dataStart .. wt.dataStart + wt.dataLength)
 *       if (event === WT_SESSION) { wt.accept(wt.sessionId); }
 *       if (event === WT_DATAGRAM) { wt.sendDatagram(wt.sessionId, wt.data, wt.dataStart, wt.dataLength); }
 *       event = wt.next();
 *     }
 *
 * **Events.** `next()` answers a `WT_*` event, or one of `nish/net/http3`'s
 * for a plain request, which passes through untouched so one connection can
 * serve both: `WT_SESSION` (a session asked for: `sessionId`, the CONNECT
 * stream's ID, and `fields`; the program `accept`s or `refuse`s it),
 * `WT_DATAGRAM` (a datagram of an accepted session, a window onto `data`),
 * `WT_STREAM` (the client opened a stream of an accepted session: `stream`,
 * `bidirectional`), `WT_STREAM_DATA` (its bytes, a window onto `data`),
 * `WT_STREAM_END` (its FIN), `WT_STREAM_RESET` (the client reset its side:
 * `errorCode`, the HTTP/3 code, and `appCode`, the WebTransport code it maps
 * to or -1), `WT_STREAM_STOPPED` (the client asked this side to stop writing:
 * the same two codes), `WT_WRITABLE` (a stream, or a CONNECT stream whose
 * capsule was held back, can take more), `WT_DRAIN` (the client sent
 * DRAIN_WEBTRANSPORT_SESSION) and `WT_CLOSED` (the session is over:
 * `errorCode`, the CLOSE capsule's code or 0, the reason a window onto
 * `reason`, and `closedByPeer`). Each event names its session in `sessionId`
 * and in `session`, its index in the table, `0 .. webtransportSessions - 1`,
 * for a program's own per-session arrays. A window is valid until the next
 * call.
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
import { quicPacketCopy, quicVarintSize } from "nish/net/quic-packet"
import { quicStreamIsUni } from "nish/net/quic-stream"

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
/** The session is over: `errorCode`, `reason[reasonStart .. reasonStart + reasonLength)`, `closedByPeer`. */
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
/** Knuth's multiplicative constant, 2^32 over the golden ratio: odd, so the product keeps every bit of the salted number. */
const WT_HASH_MULTIPLIER: i64 = 2654435761

/** The caps of a WebTransport layer, fixed when it is made. */
export class WebTransportConfig {
  /** Streams one session may have at once, both kinds and both openers together. */
  maxStreams: i32 = 64
  /** Streams that may wait at once for a session not yet answered or not yet arrived (draft-02 §4.5). */
  maxPending: i32 = 16
}

/** The HTTP/3 code an application's 32-bit `code` is sent as (`WT_FIRST_APP_CODE` + n + n / 0x1e, skipping the greased values). */
export const wtCodeToHttp3 = (code: i64): i64 => {
  const n: i64 = code & WT_U32
  return WT_FIRST_APP_CODE + n + n / toI64(0x1e)
}

/** The application code an HTTP/3 `code` carries, or -1 when it is outside the range, or one of its greased values. */
export const wtCodeFromHttp3 = (code: i64): i64 => {
  const last: i64 = wtCodeToHttp3(WT_U32)
  if (code < WT_FIRST_APP_CODE || code > last || h3Greased(code)) {
    return WT_NONE64
  }
  const shifted: i64 = code - WT_FIRST_APP_CODE
  return shifted - shifted / toI64(0x1f)
}

/** Panics unless `value` lies in `[low, high]`: a cap out of range is the program's mistake. */
const webtransportCheckCap = (what: string, value: i32, low: i32, high: i32): void => {
  if (value < low || value > high) {
    panic(`WebTransport: ${what} of ${value}, outside ${low} to ${high}`)
  }
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
  streams: i64[]
  sessions: i64[]
  next: i32[]
  prev: i32[]
  /** Each bucket's first and last entry, or -1. */
  heads: i32[]
  tails: i32[]
  salt: i64 = 0
  freeHead: i32 = -1
  count: i32 = 0

  constructor(size: i32) {
    const n: i32 = size > 0 ? size : WT_ONE
    this.streams = new Array<i64>(n)
    this.sessions = new Array<i64>(n)
    this.next = new Array<i32>(n)
    this.prev = new Array<i32>(n)
    let buckets: i32 = 2
    while (buckets < n * 2) {
      buckets = buckets * 2
    }
    this.heads = new Array<i32>(buckets)
    this.tails = new Array<i32>(buckets)
    const entropy: u8[] = new Array<u8>(4)
    crypto.getRandomValues(entropy)
    for (let j: i32 = 0; j < toI32(entropy.length); j++) {
      this.salt = (this.salt << toI64(8)) | toI64(toI32(entropy[j]))
    }
    this.reset()
  }

  /** Empties the room. */
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

  /** The bucket of session ID `session`: its stream number, salted, times an odd constant, high bits. */
  bucket(session: i64): i32 {
    const x: i64 = ((session >> toI64(2)) ^ this.salt) & toI64(0x7fffffff)
    const mixed: i64 = (x * WT_HASH_MULTIPLIER) >> toI64(16)
    return toI32(mixed & toI64(toI32(this.heads.length) - 1))
  }

  /** Files stream `stream`, waiting for session `session`; answers whether there was room. */
  add(stream: i64, session: i64): boolean {
    const e: i32 = this.freeHead
    if (e < 0 || e >= toI32(this.next.length)) {
      return false
    }
    this.freeHead = this.next[e]
    const b: i32 = this.bucket(session)
    const tail: i32 = this.tails[b]
    this.streams[e] = stream
    this.sessions[e] = session
    this.next[e] = -1
    this.prev[e] = tail
    if (tail >= 0 && tail < toI32(this.next.length)) {
      this.next[tail] = e
    } else {
      this.heads[b] = e
    }
    this.tails[b] = e
    this.count = this.count + 1
    return true
  }

  /** The oldest entry waiting for session `session`, or -1. */
  first(session: i64): i32 {
    let e: i32 = this.heads[this.bucket(session)]
    for (
      let guard: i32 = 0;
      guard < toI32(this.next.length) && e >= 0 && e < toI32(this.next.length);
      guard++
    ) {
      if (this.sessions[e] === session) {
        return e
      }
      e = this.next[e]
    }
    return WT_NONE
  }

  /** Takes entry `e` out of the room and answers its stream. */
  take(e: i32): i64 {
    const stream: i64 = this.streams[e]
    const b: i32 = this.bucket(this.sessions[e])
    const before: i32 = this.prev[e]
    const after: i32 = this.next[e]
    if (before >= 0 && before < toI32(this.next.length)) {
      this.next[before] = after
    } else {
      this.heads[b] = after
    }
    if (after >= 0 && after < toI32(this.prev.length)) {
      this.prev[after] = before
    } else {
      this.tails[b] = before
    }
    this.next[e] = this.freeHead
    this.freeHead = e
    this.count = this.count - 1
    return stream
  }
}

/**
 * The WebTransport sessions of one HTTP/3 connection. The fields after the
 * tables are the last event's; the module comment says which event sets
 * which.
 */
export class WebTransport {
  config: WebTransportConfig
  h3: Http3Connection
  quic: QuicConnection
  /** The request fields of the last WT_SESSION: `h3.fields`. */
  fields: HttpFields
  header: Http3FrameHeader
  /** A datagram read whole, and one being sent; a CLOSE capsule being written. */
  datagram: u8[]
  outgoing: u8[]
  capsuleOut: u8[]
  /** The window of WT_DATAGRAM, WT_STREAM_DATA and WT_CLOSED: `datagram`, `h3.data`, or `reason`. */
  data: u8[]
  /** Each session's CLOSE payload as it arrives, `WT_REASON_MAX + 4` bytes a session. */
  reason: u8[]
  /** The response fields of an accepted session, and of a refusal. */
  acceptNames: u8[][]
  acceptValues: u8[][]
  none: u8[][]
  // Per session.
  sessionIds: i64[]
  /** The capsule being read: its type, and what is left of its payload (-1 between capsules). */
  capType: i64[]
  capLeft: i64[]
  states: i32[]
  /** The CONNECT stream's QUIC slot. */
  sessionSlot: i32[]
  /** The first of its streams (a QUIC slot, threaded through `nextStream`), and how many. */
  firstStream: i32[]
  streamCount: i32[]
  /** Whether the client's CLOSE has been read: nothing may follow it. */
  closeRead: boolean[]
  /** A capsule header being read, `capHeadLen[s]` bytes of `capHead[s * 16 ..]`, and the CLOSE payload's fill. */
  capHeadLen: i32[]
  capHead: u8[]
  capFill: i32[]
  /** Counters for a log or a rate cap, each saturating: datagrams in and out. */
  datagramsIn: i32[]
  datagramsOut: i32[]
  /** The free sessions, a stack. */
  free: i32[]
  // Per QUIC stream slot.
  /** The session whose CONNECT stream the slot holds, or -1. */
  sessionAt: i32[]
  /** The stream the slot's stream state is for, its session, its neighbours in that session's list, and its bits. */
  streamIds: i64[]
  streamSession: i32[]
  nextStream: i32[]
  prevStream: i32[]
  streamBits: i32[]
  /** The streams waiting for a session. */
  waiting: WebTransportWaiting
  /** Sessions accepted while streams waited for them, `adoptCount` of them: `next` takes those streams first. */
  adoptions: i32[]
  /** The last event's session ID, stream, and codes. */
  sessionId: i64 = -1
  stream: i64 = -1
  errorCode: i64 = 0
  appCode: i64 = -1
  /** Where the capsules of a DATA window are being read: `h3.data[capAt .. capEnd)`, for session `capSession`. */
  capAt: i32 = 0
  capEnd: i32 = 0
  capSession: i32 = -1
  /** The last event's session index, and its window onto `data`. */
  session: i32 = -1
  dataStart: i32 = 0
  dataLength: i32 = 0
  freeCount: i32 = 0
  adoptCount: i32 = 0
  /** The `h3.generation` this layer's state belongs to. */
  generation: i32 = 0
  /** Counters for a log or a test, each saturating: datagrams dropped, sessions refused here, streams refused. */
  datagramsDropped: i32 = 0
  sessionsRefused: i32 = 0
  streamsRefused: i32 = 0
  /** WT_STREAM's kind, and whether WT_CLOSED came from the client. */
  bidirectional: boolean = false
  closedByPeer: boolean = false

  /**
   * The WebTransport layer of `h3`, whose `Http3Config` must have
   * `webtransportSessions` above 0. A cap out of range panics.
   */
  constructor(config: WebTransportConfig, h3: Http3Connection) {
    const sessions: i32 = h3.config.webtransportSessions
    // `Http3Connection` already holds the count to `H3_MAX_SESSIONS`; what can be wrong here is a connection with WebTransport off.
    if (sessions < 1) {
      panic("WebTransport: the Http3Connection has WebTransport off (webtransportSessions 0)")
    }
    webtransportCheckCap("maxStreams", config.maxStreams, 1, WT_MAX_CAP)
    webtransportCheckCap("maxPending", config.maxPending, 0, WT_MAX_CAP)
    this.config = config
    this.h3 = h3
    this.quic = h3.quic
    this.fields = h3.fields
    this.header = new Http3FrameHeader()
    const entry: i32 = h3.quic.datagramsIn.entrySize
    this.datagram = new Array<u8>(entry > 0 ? entry : WT_ONE)
    this.outgoing = new Array<u8>(h3.quic.datagramsOut.entrySize + 8)
    this.capsuleOut = new Array<u8>(WT_REASON_MAX + 4 + WT_HEAD)
    this.data = this.datagram
    this.reason = new Array<u8>(sessions * WT_REASON_STRIDE)
    this.acceptNames = [httpFieldBytes("sec-webtransport-http3-draft")]
    this.acceptValues = [httpFieldBytes("draft02")]
    this.none = []
    this.sessionIds = new Array<i64>(sessions)
    this.capType = new Array<i64>(sessions)
    this.capLeft = new Array<i64>(sessions)
    this.states = new Array<i32>(sessions)
    this.sessionSlot = new Array<i32>(sessions)
    this.firstStream = new Array<i32>(sessions)
    this.streamCount = new Array<i32>(sessions)
    this.closeRead = new Array<boolean>(sessions)
    this.capHeadLen = new Array<i32>(sessions)
    this.capHead = new Array<u8>(sessions * WT_HEAD)
    this.capFill = new Array<i32>(sessions)
    this.datagramsIn = new Array<i32>(sessions)
    this.datagramsOut = new Array<i32>(sessions)
    this.free = new Array<i32>(sessions)
    const n: i32 = toI32(h3.quic.streams.slots.length)
    const slots: i32 = n > 0 ? n : WT_ONE
    this.sessionAt = new Array<i32>(slots)
    this.streamIds = new Array<i64>(slots)
    this.streamSession = new Array<i32>(slots)
    this.nextStream = new Array<i32>(slots)
    this.prevStream = new Array<i32>(slots)
    this.streamBits = new Array<i32>(slots)
    this.waiting = new WebTransportWaiting(config.maxPending)
    this.adoptions = new Array<i32>(sessions)
    this.restart()
  }

  /** Forgets every session and stream, for the connection's next peer; `next` calls it when `h3` restarted. */
  restart(): void {
    this.generation = this.h3.generation
    this.sessionIds.fill(WT_NONE64)
    this.states.fill(WT_FREE)
    this.sessionAt.fill(WT_NONE)
    this.streamIds.fill(WT_NONE64)
    this.streamSession.fill(WT_NONE)
    this.freeCount = 0
    for (let s: i32 = toI32(this.free.length) - 1; s >= 0; s--) {
      this.free[this.freeCount] = s
      this.freeCount = this.freeCount + 1
    }
    this.waiting.reset()
    this.adoptCount = 0
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
  current(): void {
    if (this.generation !== this.h3.generation) {
      this.restart()
    }
  }

  // ---- Lookups ---------------------------------------------------------------------

  /** The index of the session whose CONNECT stream is `id`, or -1: one probe of QUIC's stream index. */
  sessionOf(id: i64): i32 {
    const k: i32 = this.quic.streams.slotOf(id)
    if (k < 0 || k >= toI32(this.sessionAt.length)) {
      return WT_NONE
    }
    const s: i32 = this.sessionAt[k]
    return s >= 0 && s < toI32(this.sessionIds.length) && this.sessionIds[s] === id ? s : WT_NONE
  }

  /** The QUIC slot of a session's stream `id` that this layer tracks, or -1. */
  streamSlot(id: i64): i32 {
    const k: i32 = this.quic.streams.slotOf(id)
    if (k < 0 || k >= toI32(this.streamIds.length) || this.streamIds[k] !== id) {
      return WT_NONE
    }
    return k
  }

  /** The session of `id` when it is accepted and not gone, else -1. */
  openSession(id: i64): i32 {
    this.current()
    const s: i32 = this.sessionOf(id)
    return s >= 0 && this.states[s] === WT_OPEN ? s : WT_NONE
  }

  // ---- Events ----------------------------------------------------------------------

  /**
   * Reads what the connection has and answers the next event (see the
   * module comment): a `WT_*` one, or a plain request's `H3_*` one. Call it
   * until it answers H3_NEED_MORE or H3_ERROR.
   */
  next(): i32 {
    this.current()
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
  receiveDatagram(): i32 {
    const n: i32 = this.quic.readDatagram(this.datagram, WT_ZERO, toI32(this.datagram.length))
    if (n === QUIC_DATAGRAM_NONE || n < 0) {
      return WT_ZERO
    }
    const quarter: i64 = h3ReadVarint(this.datagram, WT_ZERO, n)
    if (quarter < 0 || quarter > WT_QUARTER_MAX) {
      // RFC 9297 §2.1: a quarter stream ID that does not parse, or is too large.
      this.h3.fail(H3_DATAGRAM_ERROR)
      return WT_ONE
    }
    const s: i32 = this.sessionOf(quarter * 4)
    if (s < 0 || this.states[s] !== WT_OPEN) {
      // §2.1.1: no session to take it; dropped.
      this.datagramsDropped = h3Count(this.datagramsDropped)
      return WT_ONE
    }
    const at: i32 = h3VarintLength(this.datagram, WT_ZERO)
    this.datagramsIn[s] = h3Count(this.datagramsIn[s])
    this.session = s
    this.sessionId = this.sessionIds[s]
    this.data = this.datagram
    this.dataStart = at
    this.dataLength = n - at
    return WT_DATAGRAM
  }

  /** What an `Http3Connection` event means here: a `WT_*` event, the same event passed through, or H3_NEED_MORE. */
  route(event: i32): i32 {
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
    const k: i32 = h3.slot >= 0 && h3.slot < toI32(this.streamIds.length) ? h3.slot : WT_NONE
    const s: i32 = k >= 0 ? this.sessionAt[k] : WT_NONE
    if (s >= 0 && s < toI32(this.sessionIds.length) && this.sessionIds[s] === id) {
      return this.connectEvent(s, event)
    }
    if (k < 0 || this.streamIds[k] !== id) {
      // A plain request's, or one about a stream this layer refused or let go of.
      return event === H3_STOPPED ? H3_NEED_MORE : event
    }
    const t: i32 = this.streamSession[k]
    this.stream = id
    this.session = t
    this.sessionId = t >= 0 && t < toI32(this.sessionIds.length) ? this.sessionIds[t] : WT_NONE64
    if (event === H3_DATA) {
      this.data = h3.data
      this.dataStart = h3.dataStart
      this.dataLength = h3.dataLength
      return WT_STREAM_DATA
    }
    if (event === H3_END) {
      this.settle(k, WT_RECEIVED)
      return WT_STREAM_END
    }
    if (event === H3_RESET) {
      this.codes(h3.errorCode)
      this.settle(k, WT_RECEIVED)
      return WT_STREAM_RESET
    }
    if (event === H3_STOPPED) {
      this.codes(h3.errorCode)
      this.settle(k, WT_SENT)
      return WT_STREAM_STOPPED
    }
    return event === H3_WRITABLE ? WT_WRITABLE : H3_NEED_MORE
  }

  /** Sets `errorCode` to `code` and `appCode` to what it maps to. */
  codes(code: i64): void {
    this.errorCode = code
    this.appCode = wtCodeFromHttp3(code)
  }

  /** An event of session `s`'s CONNECT stream. */
  connectEvent(s: i32, event: i32): i32 {
    const h3: Http3Connection = this.h3
    this.session = s
    this.sessionId = this.sessionIds[s]
    this.stream = this.sessionIds[s]
    if (event === H3_DATA) {
      if (this.states[s] === WT_GONE && !this.closeRead[s]) {
        // This side closed it: what the client still sends is not read.
        return H3_NEED_MORE
      }
      this.capSession = s
      this.capAt = h3.dataStart
      this.capEnd = h3.dataStart + h3.dataLength
      return this.capsules()
    }
    if (event === H3_END || event === H3_RESET) {
      // The client's half is over, and the session with it (draft-02 §5).
      const id: i64 = this.sessionIds[s]
      const wasGone: boolean = this.states[s] === WT_GONE
      const inside: boolean = this.capLeft[s] >= 0 || this.capHeadLen[s] > 0
      this.release(s)
      if (wasGone) {
        // This side's half is finished already.
        return H3_NEED_MORE
      }
      if (event === H3_RESET) {
        // `nish/net/http3` abandoned this side's half with the reset, the client's or its own.
        return this.closedEvent(s, WT_ZERO64, WT_ZERO, h3.resetByPeer)
      }
      if (inside) {
        // RFC 9297 §3.3: the stream ended inside a capsule.
        h3.reset(id, H3_DATAGRAM_ERROR)
        return this.closedEvent(s, WT_ZERO64, WT_ZERO, false)
      }
      this.finish(id)
      return this.closedEvent(s, WT_ZERO64, WT_ZERO, true)
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
  finish(id: i64): boolean {
    if (this.h3.writeData(id, this.reason, WT_ZERO, WT_ZERO, true) >= 0) {
      return true
    }
    this.h3.reset(id, H3_NO_ERROR)
    return false
  }

  /** WT_CLOSED for session `s` with `code` and the reason `reason[s * 1028 + 4 ..][0 .. length)`. */
  closedEvent(s: i32, code: i64, length: i32, byPeer: boolean): i32 {
    this.session = s
    this.errorCode = code & WT_U32
    this.appCode = this.errorCode
    this.closedByPeer = byPeer
    this.data = this.reason
    this.dataStart = s * WT_REASON_STRIDE + 4
    this.dataLength = length
    return WT_CLOSED
  }

  // ---- Sessions --------------------------------------------------------------------

  /**
   * An extended CONNECT arrived on `id`: a session when it is one this side
   * takes, answered here when not.
   */
  asked(id: i64): i32 {
    const h3: Http3Connection = this.h3
    const f: HttpFields = h3.fields
    const k: i32 = this.quic.streams.slotOf(id)
    if (k >= 0 && k < toI32(this.sessionAt.length)) {
      const stale: i32 = this.sessionAt[k]
      if (stale >= 0 && stale < toI32(this.sessionIds.length) && this.sessionIds[stale] >= 0) {
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
    if (k < 0 || k >= toI32(this.sessionAt.length)) {
      return H3_NEED_MORE
    }
    this.freeCount = this.freeCount - 1
    const s: i32 = this.free[this.freeCount]
    this.sessionIds[s] = id
    this.states[s] = WT_ASKED
    this.sessionSlot[s] = k
    this.firstStream[s] = -1
    this.streamCount[s] = 0
    this.capType[s] = -1
    this.capLeft[s] = -1
    this.closeRead[s] = false
    this.capHeadLen[s] = 0
    this.capFill[s] = 0
    this.datagramsIn[s] = 0
    this.datagramsOut[s] = 0
    this.sessionAt[k] = s
    this.session = s
    this.sessionId = id
    this.stream = id
    return WT_SESSION
  }

  /** Answers the request on `id` with `status` and stops reading it: a session refused. */
  answer(id: i64, status: i32): void {
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
   */
  accept(id: i64): i32 {
    this.current()
    const s: i32 = this.sessionOf(id)
    if (s < 0 || this.states[s] !== WT_ASKED) {
      return H3_CLOSED
    }
    const result: i32 = this.h3.respond(id, WT_STATUS_OK, this.acceptNames, this.acceptValues, false)
    if (result !== 0) {
      return result
    }
    this.states[s] = WT_OPEN
    // The streams that waited for it are taken by the next calls of `next`, each with its WT_STREAM.
    if (this.waiting.first(id) >= 0 && this.adoptCount < toI32(this.adoptions.length)) {
      this.adoptions[this.adoptCount] = s
      this.adoptCount = this.adoptCount + 1
    }
    return 0
  }

  /**
   * Refuses session `id` with `status`, 400 to 599 (draft-02 §3.2): the
   * response ends the stream, and what the client still sends is dropped.
   * Answers 0, H3_INVALID for a status out of range, or H3_CLOSED.
   */
  refuse(id: i64, status: i32): i32 {
    this.current()
    const s: i32 = this.sessionOf(id)
    if (s < 0 || this.states[s] !== WT_ASKED) {
      return H3_CLOSED
    }
    if (status < 400 || status > 599) {
      return H3_INVALID
    }
    this.answer(id, status)
    this.release(s)
    return 0
  }

  /**
   * Ends session `s` here: every stream reset with WT_SESSION_GONE and asked
   * to stop, the streams waiting for it refused, and its slot freed.
   */
  release(s: i32): void {
    this.end(s)
    const k: i32 = this.sessionSlot[s]
    if (k >= 0 && k < toI32(this.sessionAt.length) && this.sessionAt[k] === s) {
      this.sessionAt[k] = -1
    }
    this.sessionIds[s] = -1
    this.states[s] = WT_FREE
    if (this.capSession === s) {
      this.capSession = -1
    }
    if (this.freeCount < toI32(this.free.length)) {
      this.free[this.freeCount] = s
      this.freeCount = this.freeCount + 1
    }
  }

  /** Resets every stream of session `s` and refuses those waiting for it; the session is gone. */
  end(s: i32): void {
    if (this.states[s] === WT_FREE) {
      return
    }
    let k: i32 = this.firstStream[s]
    for (let guard: i32 = 0; guard < WT_MAX_CAP && k >= 0 && k < toI32(this.streamIds.length); guard++) {
      const following: i32 = this.nextStream[k]
      this.h3.refuseStream(this.streamIds[k], WT_SESSION_GONE)
      this.streamIds[k] = -1
      this.streamSession[k] = -1
      k = following
    }
    this.firstStream[s] = -1
    this.streamCount[s] = 0
    this.dropPending(this.sessionIds[s])
    this.states[s] = WT_GONE
  }

  /** Refuses with WT_SESSION_GONE every stream waiting for session `id`. */
  dropPending(id: i64): void {
    if (this.waiting.count === 0) {
      return
    }
    let e: i32 = this.waiting.first(id)
    for (let guard: i32 = 0; guard < WT_MAX_CAP && e >= 0; guard++) {
      this.refuseStream(this.waiting.take(e), WT_SESSION_GONE)
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
   */
  close(id: i64, code: i64, buf: u8[], off: i32, len: i32): i32 {
    h3CheckWindow("WebTransport.close", buf, off, len)
    const s: i32 = this.openSession(id)
    if (s < 0) {
      return H3_CLOSED
    }
    if (len > WT_REASON_MAX) {
      return H3_INVALID
    }
    const out: u8[] = this.capsuleOut
    const end: i32 = toI32(out.length)
    let p: i32 = h3PutFrameHeader(out, WT_ZERO, end, WT_CAPSULE_CLOSE, toI64(4 + len))
    const value: i64 = code & WT_U32
    out[p] = toU8(toI32((value >> toI64(24)) & toI64(255)))
    out[p + 1] = toU8(toI32((value >> toI64(16)) & toI64(255)))
    out[p + 2] = toU8(toI32((value >> toI64(8)) & toI64(255)))
    out[p + 3] = toU8(toI32(value & toI64(255)))
    p = p + 4
    quicPacketCopy(out, p, buf, off, len)
    const result: i32 = this.h3.writeDataWhole(id, out, WT_ZERO, p + len, true)
    if (result !== 0) {
      return result
    }
    this.end(s)
    return 0
  }

  /**
   * Sends DRAIN_WEBTRANSPORT_SESSION on session `id`: the client should
   * finish and close it. Answers 0, H3_AGAIN, or H3_CLOSED.
   */
  drain(id: i64): i32 {
    const s: i32 = this.openSession(id)
    if (s < 0) {
      return H3_CLOSED
    }
    const out: u8[] = this.capsuleOut
    const end: i32 = toI32(out.length)
    const p: i32 = h3PutFrameHeader(out, WT_ZERO, end, WT_CAPSULE_DRAIN, toI64(0))
    return this.h3.writeDataWhole(id, out, WT_ZERO, p, false)
  }

  // ---- Capsules --------------------------------------------------------------------

  /**
   * Reads the capsules of the DATA window `h3.data[capAt .. capEnd)` of
   * session `capSession`'s CONNECT stream, and answers the first event they
   * make, or H3_NEED_MORE once the window is read.
   */
  capsules(): i32 {
    const s: i32 = this.capSession
    const bytes: u8[] = this.h3.data
    const base: i32 = s * WT_HEAD
    while (this.capAt < this.capEnd && this.capAt >= 0 && this.capAt < toI32(bytes.length)) {
      if (this.closeRead[s]) {
        // §5: nothing may follow a CLOSE.
        return this.malformed(s, H3_MESSAGE_ERROR)
      }
      if (this.capLeft[s] < 0) {
        // The header, a byte at a time into the session's own buffer: it may be split across DATA frames.
        const have: i32 = this.capHeadLen[s]
        if (have >= WT_HEAD || base + have >= toI32(this.capHead.length)) {
          return this.malformed(s, H3_DATAGRAM_ERROR)
        }
        this.capHead[base + have] = bytes[this.capAt]
        this.capAt = this.capAt + 1
        this.capHeadLen[s] = have + 1
        if (h3ReadFrameHeader(this.header, this.capHead, base, have + 1) === 0) {
          continue
        }
        this.capHeadLen[s] = 0
        const type: i64 = this.header.type
        const length: i64 = this.header.length
        if (type === WT_CAPSULE_CLOSE && (length < 4 || length > toI64(WT_REASON_MAX + 4))) {
          return this.malformed(s, H3_DATAGRAM_ERROR)
        }
        if (type === WT_CAPSULE_DRAIN && length !== toI64(0)) {
          return this.malformed(s, H3_DATAGRAM_ERROR)
        }
        this.capType[s] = type
        this.capLeft[s] = length
        this.capFill[s] = 0
      } else {
        const want: i64 = toI64(this.capEnd - this.capAt)
        const take: i32 = toI32(this.capLeft[s] < want ? this.capLeft[s] : want)
        if (this.capType[s] === WT_CAPSULE_CLOSE) {
          quicPacketCopy(this.reason, s * WT_REASON_STRIDE + this.capFill[s], bytes, this.capAt, take)
          this.capFill[s] = this.capFill[s] + take
        }
        this.capAt = this.capAt + take
        this.capLeft[s] = this.capLeft[s] - toI64(take)
      }
      if (this.capLeft[s] === toI64(0)) {
        this.capLeft[s] = -1
        const event: i32 = this.capsule(s, this.capType[s])
        if (event !== H3_NEED_MORE) {
          return event
        }
      }
    }
    this.capSession = -1
    return H3_NEED_MORE
  }

  /** A whole capsule of `type` on session `s`'s CONNECT stream. */
  capsule(s: i32, type: i64): i32 {
    this.session = s
    this.sessionId = this.sessionIds[s]
    this.stream = this.sessionIds[s]
    if (type === WT_CAPSULE_DRAIN) {
      return this.states[s] === WT_GONE ? H3_NEED_MORE : WT_DRAIN
    }
    if (type !== WT_CAPSULE_CLOSE) {
      // RFC 9297 §3.2: a capsule type this side does not know is skipped.
      return H3_NEED_MORE
    }
    this.closeRead[s] = true
    if (this.states[s] === WT_GONE) {
      // This side closed it first, and finished its half then.
      return H3_NEED_MORE
    }
    const at: i32 = s * WT_REASON_STRIDE
    let code: i64 = 0
    for (let j: i32 = 0; j < 4 && at + j < toI32(this.reason.length); j++) {
      code = (code << toI64(8)) | toI64(toI32(this.reason[at + j]))
    }
    this.end(s)
    const length: i32 = this.capFill[s] - 4
    // §5: the CLOSE is answered by finishing this side's half; when that cannot go, the session is over here and now.
    if (!this.finish(this.sessionIds[s])) {
      this.release(s)
    }
    return this.closedEvent(s, code, length, true)
  }

  /** A capsule that breaks a rule on session `s`: its CONNECT stream reset both ways with `code`, and the session over. */
  malformed(s: i32, code: i64): i32 {
    const id: i64 = this.sessionIds[s]
    const wasGone: boolean = this.states[s] === WT_GONE
    this.capSession = -1
    this.release(s)
    this.h3.reset(id, code)
    this.h3.discardRequest(id, code)
    this.stream = id
    this.sessionId = id
    return wasGone ? H3_NEED_MORE : this.closedEvent(s, WT_ZERO64, WT_ZERO, false)
  }

  // ---- Streams ---------------------------------------------------------------------

  /** A stream named session `session` in its first bytes (H3_STREAM): taken, kept waiting or refused. */
  arrived(id: i64, session: i64): i32 {
    const s: i32 = this.sessionOf(session)
    if (s >= 0 && this.states[s] === WT_OPEN) {
      return this.adopt(s, id)
    }
    if ((s >= 0 && this.states[s] === WT_ASKED) || (s < 0 && this.h3.awaitsRequest(session))) {
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
  adoptWaiting(): i32 {
    const s: i32 = this.adoptions[this.adoptCount - 1]
    if (s >= 0 && s < toI32(this.states.length) && this.states[s] === WT_OPEN) {
      const e: i32 = this.waiting.first(this.sessionIds[s])
      if (e >= 0) {
        return this.adopt(s, this.waiting.take(e))
      }
    }
    this.adoptCount = this.adoptCount - 1
    return H3_NEED_MORE
  }

  /** Refuses stream `id` with `code`, counted. */
  refuseStream(id: i64, code: i64): void {
    this.streamsRefused = h3Count(this.streamsRefused)
    this.h3.refuseStream(id, code)
  }

  /**
   * Takes the client's stream `id` into session `s`, unless the session
   * holds `maxStreams` already: answers WT_STREAM, or H3_NEED_MORE for one
   * refused with H3_REQUEST_REJECTED.
   */
  adopt(s: i32, id: i64): i32 {
    if (this.streamCount[s] >= this.config.maxStreams) {
      this.refuseStream(id, H3_REQUEST_REJECTED)
      return H3_NEED_MORE
    }
    const bidi: boolean = !quicStreamIsUni(id)
    if (this.h3.acceptStream(id) !== 0 || this.link(s, id, bidi ? WT_ZERO : WT_SENT) < 0) {
      return H3_NEED_MORE
    }
    this.session = s
    this.sessionId = this.sessionIds[s]
    this.stream = id
    this.bidirectional = bidi
    return WT_STREAM
  }

  /** Puts stream `id` at the head of session `s`'s list with `bits`; answers its slot, or -1. */
  link(s: i32, id: i64, bits: i32): i32 {
    const k: i32 = this.quic.streams.slotOf(id)
    if (k < 0 || k >= toI32(this.streamIds.length)) {
      return WT_NONE
    }
    if (this.streamIds[k] >= 0) {
      // QUIC freed this slot under a stream whose end no event told (a STOP_SENDING it answered and saw acknowledged): let go of it now.
      this.unlink(k)
    }
    const head: i32 = this.firstStream[s]
    this.streamIds[k] = id
    this.streamSession[k] = s
    this.streamBits[k] = bits
    this.prevStream[k] = -1
    this.nextStream[k] = head
    if (head >= 0 && head < toI32(this.prevStream.length)) {
      this.prevStream[head] = k
    }
    this.firstStream[s] = k
    this.streamCount[s] = this.streamCount[s] + 1
    return k
  }

  /** Marks `bits` done on the stream in slot `k`, and takes it off its session once both sides are. */
  settle(k: i32, bits: i32): void {
    this.streamBits[k] = this.streamBits[k] | bits
    if ((this.streamBits[k] & (WT_SENT | WT_RECEIVED)) === (WT_SENT | WT_RECEIVED)) {
      this.unlink(k)
    }
  }

  /** Takes the stream in slot `k` off its session's list. */
  unlink(k: i32): void {
    const s: i32 = this.streamSession[k]
    const before: i32 = this.prevStream[k]
    const after: i32 = this.nextStream[k]
    if (before >= 0 && before < toI32(this.nextStream.length)) {
      this.nextStream[before] = after
    } else if (s >= 0 && s < toI32(this.firstStream.length)) {
      this.firstStream[s] = after
    }
    if (after >= 0 && after < toI32(this.prevStream.length)) {
      this.prevStream[after] = before
    }
    if (s >= 0 && s < toI32(this.streamCount.length)) {
      this.streamCount[s] = this.streamCount[s] - 1
    }
    this.streamIds[k] = -1
    this.streamSession[k] = -1
  }

  /**
   * Opens a stream of this side's for session `id` (draft-02 §4.1, §4.2).
   * Answers its ID; WT_LIMIT when the session holds `maxStreams`; H3_AGAIN
   * while the client's MAX_STREAMS allows no more; or H3_CLOSED.
   */
  openStream(id: i64, bidirectional: boolean): i64 {
    const s: i32 = this.openSession(id)
    if (s < 0) {
      return toI64(H3_CLOSED)
    }
    if (this.streamCount[s] >= this.config.maxStreams) {
      return toI64(WT_LIMIT)
    }
    const stream: i64 = this.h3.openStream(id, bidirectional)
    if (stream < 0) {
      return stream
    }
    this.link(s, stream, bidirectional ? WT_ZERO : WT_RECEIVED)
    return stream
  }

  /**
   * Writes up to `len` bytes of `buf` from `off` to session stream `id`, with
   * its FIN when `fin` and all were taken. Answers how many it took, or
   * H3_AGAIN, or H3_CLOSED (see `Http3Connection.writeStream`).
   */
  write(id: i64, buf: u8[], off: i32, len: i32, fin: boolean): i32 {
    this.current()
    const k: i32 = this.streamSlot(id)
    if (k < 0) {
      return H3_CLOSED
    }
    const n: i32 = this.h3.writeStream(id, buf, off, len, fin)
    if (fin && n === len) {
      this.settle(k, WT_SENT)
    }
    return n
  }

  /** Resets this side of session stream `id` with the application's `code` (mapped, `wtCodeToHttp3`). Answers 0 or H3_CLOSED. */
  resetStream(id: i64, code: i64): i32 {
    this.current()
    const k: i32 = this.streamSlot(id)
    if (k < 0) {
      return H3_CLOSED
    }
    const result: i32 = this.h3.resetStream(id, wtCodeToHttp3(code))
    if (result !== 0) {
      return result
    }
    this.settle(k, WT_SENT)
    return 0
  }

  /** Asks the client to stop its side of session stream `id` with the application's `code`, and drops what it sends. Answers 0 or H3_CLOSED. */
  stopSending(id: i64, code: i64): i32 {
    this.current()
    const k: i32 = this.streamSlot(id)
    if (k < 0 || (this.streamBits[k] & WT_RECEIVED) !== 0) {
      return H3_CLOSED
    }
    const result: i32 = this.h3.stopStream(id, wtCodeToHttp3(code))
    if (result !== 0) {
      return result
    }
    this.settle(k, WT_RECEIVED)
    return 0
  }

  // ---- Datagrams -------------------------------------------------------------------

  /**
   * The largest payload `sendDatagram` takes for session `id` now: what the
   * QUIC connection's `maxDatagramPayload` leaves after the quarter stream
   * ID; 0 for a session not accepted.
   */
  maxDatagramPayload(id: i64): i32 {
    if (this.openSession(id) < 0) {
      return WT_ZERO
    }
    const room: i32 = this.quic.maxDatagramPayload() - quicVarintSize(id >> toI64(2))
    return room > 0 ? room : WT_ZERO
  }

  /**
   * Sends `buf[off .. off + len)` as an HTTP datagram of session `id` (RFC
   * 9297 §2.1): its quarter stream ID, then the payload, one QUIC DATAGRAM
   * frame, never sent again if lost. Answers 0; H3_TOO_LARGE past
   * `maxDatagramPayload`; H3_AGAIN while QUIC's queue is full; or H3_CLOSED
   * for a session not accepted.
   */
  sendDatagram(id: i64, buf: u8[], off: i32, len: i32): i32 {
    h3CheckWindow("WebTransport.sendDatagram", buf, off, len)
    const s: i32 = this.openSession(id)
    if (s < 0) {
      return H3_CLOSED
    }
    const out: u8[] = this.outgoing
    const p: i32 = h3PutVarint(out, WT_ZERO, toI32(out.length), id >> toI64(2))
    // The quarter stream ID and the payload must fit what QUIC sends now (`maxDatagramPayload`, without the ID's room).
    if (p < 0 || len > this.quic.maxDatagramPayload() - p || p + len > toI32(out.length)) {
      return H3_TOO_LARGE
    }
    quicPacketCopy(out, p, buf, off, len)
    const result: i32 = this.quic.sendDatagram(out, WT_ZERO, p + len)
    if (result === QUIC_DATAGRAM_OK) {
      this.datagramsOut[s] = h3Count(this.datagramsOut[s])
      return 0
    }
    return result === QUIC_DATAGRAM_ERR_FULL ? H3_AGAIN : H3_TOO_LARGE
  }
}
