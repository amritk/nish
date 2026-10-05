/**
 * `nish/net/http2` — the server side of an HTTP/2 connection (RFC 9113):
 * the connection preface, SETTINGS and their acknowledgement, the stream
 * state machine of §5.1, flow control on the connection and on every stream
 * with WINDOW_UPDATE, PING, RST_STREAM, GOAWAY with the last stream
 * identifier, header blocks across CONTINUATION frames decoded by
 * `nish/net/hpack`, and extended CONNECT (RFC 8441).
 *
 * It is sans-IO: bytes in, events and bytes out, and no socket anywhere.
 * `nish/net/http2-tls` runs it over TLS with ALPN `h2`.
 *
 *     import { Http2Config, Http2Connection, H2_NEED_MORE, H2_REQUEST, H2_DATA } from "nish/net/http2";
 *
 *     const conn = new Http2Connection(new Http2Config());
 *     // send conn.output[conn.outputStart .. conn.outputEnd), then conn.consume(sent)
 *     conn.feed(received, 0, n);
 *     let event: i32 = conn.next();
 *     while (event !== H2_NEED_MORE && event !== H2_ERROR) {
 *       // H2_REQUEST: conn.stream, conn.fields (method, path, get("accept")), conn.endStream
 *       // H2_DATA: conn.data[conn.dataStart .. conn.dataStart + conn.dataLength), conn.endStream
 *       event = conn.next();
 *     }
 *     conn.respond(stream, 200, names, values, false);
 *     conn.writeData(stream, body, 0, n, true);
 *
 * **Events.** `next()` reads the frames `feed` handed it and answers the
 * first that means something to the program: `H2_REQUEST` (a stream opened
 * with a request's header section; `fields` holds it), `H2_DATA` (some of a
 * request body, a window onto the input buffer that stays valid until the
 * next `feed`), `H2_TRAILERS`, `H2_RESET` (the stream is gone: the peer reset
 * it, or broke a rule that resets it — `errorCode` says which), `H2_WINDOW`
 * (a send window that held `writeData` back has opened: `stream`, or 0 for the
 * connection's), `H2_GOAWAY` (the peer is going away; `lastStreamId`), and
 * `H2_ERROR`, final: the connection broke a rule, a GOAWAY with `errorCode`
 * is queued, and every later call answers it again. `H2_NEED_MORE` asks for
 * more input, or for the output to drain: a frame is read only while the
 * output has room for whatever it makes the connection answer, so a peer
 * that sends PINGs or SETTINGS and never reads the acknowledgements stops
 * being read rather than growing a queue. Bodies move a frame at a time and
 * nothing buffers a whole one.
 *
 * **What the connection refuses**, as RFC 9113 classes it. A connection error
 * sends GOAWAY and ends the connection: a bad preface or a first frame that is
 * not SETTINGS (PROTOCOL_ERROR, §3.4); every refusal of
 * `nish/net/http2-frame`; a frame other than CONTINUATION inside a header
 * block, or a CONTINUATION outside one (§6.10); a stream identifier that is
 * even or does not increase (§5.1.1); DATA, WINDOW_UPDATE or RST_STREAM on an
 * idle stream, and a PUSH_PROMISE from a client (PROTOCOL_ERROR); HEADERS on
 * a closed stream (STREAM_CLOSED); a header block HPACK cannot decode
 * (COMPRESSION_ERROR, RFC 7541 §2.3.2); DATA past the connection window, or a
 * window pushed past 2^31 − 1 (FLOW_CONTROL_ERROR, §6.9); a setting
 * `http2SettingError` refuses; a header block longer than `maxHeaderBlock`
 * or cut into more than `H2_MAX_FRAGMENTS` frames, and more streams reset by
 * the peer than `resetBudget` allows (ENHANCE_YOUR_CALM, §10.5). A stream
 * error resets one stream and the connection lives: a malformed request — any
 * refusal of `nish/net/http-fields`, trailers without END_STREAM, a body that
 * disagrees with `content-length` (PROTOCOL_ERROR, §8.1.1); DATA or HEADERS
 * after the peer ended the stream (STREAM_CLOSED, §5.1); DATA past the
 * stream's window, or its window pushed past 2^31 − 1 (FLOW_CONTROL_ERROR);
 * a stream past `maxStreams` (REFUSED_STREAM, §5.1.2); a stream that depends
 * on itself and a PRIORITY of the wrong length. A request whose header list
 * is longer than `maxHeaderListSize` is answered with a 431 and never reaches
 * the program (§10.5.1).
 *
 * **Caps are start-up numbers**, all in `Http2Config`: the streams open at
 * once, the windows, the largest frame and header block accepted, the header
 * list, the output buffer and the reset budget. Every buffer and every
 * stream slot is allocated by the constructor; reading DATA, writing DATA and
 * every control frame allocate nothing. A header block does allocate, through
 * `HpackDecoder` (`docs/security/http2.md`, H2-1).
 *
 * The server sends no PUSH_PROMISE and no PRIORITY, and reads PRIORITY only to
 * check it: RFC 9113 §5.3.2 deprecates the scheme. Every field it sends is a
 * literal without indexing, so its encoder's table stays empty and the peer's
 * SETTINGS_HEADER_TABLE_SIZE only ever asks it for a size update; a field
 * `httpFieldSensitive` names (`set-cookie`, `authorization`, …) is a
 * never-indexed literal, which no intermediary may index either (RFC 7541
 * §7.1.3).
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9113 and RFC 8441, not ported from another implementation.
 */
import {
  HPACK_DEFAULT_TABLE_SIZE,
  HPACK_INDEX_NEVER,
  HPACK_INDEX_WITHOUT,
  HPACK_LIST_TOO_LARGE,
  HpackDecoder,
  HpackEncoder,
  hpackHuffmanLength,
} from "nish/net/hpack"
import {
  HTTP_FIELDS_OK,
  HttpFields,
  httpFieldBytes,
  httpFieldSensitive,
  httpFieldsCheckOutgoing,
} from "nish/net/http-fields"
import {
  H2_COMPRESSION_ERROR,
  H2_DEFAULT_MAX_FRAME,
  H2_DEFAULT_WINDOW,
  H2_ENHANCE_YOUR_CALM,
  H2_FLAG_ACK,
  H2_FLAG_END_HEADERS,
  H2_FLAG_END_STREAM,
  H2_FLOW_CONTROL_ERROR,
  H2_FRAME_CONTINUATION,
  H2_FRAME_DATA,
  H2_FRAME_GOAWAY,
  H2_FRAME_HEADER_SIZE,
  H2_FRAME_HEADERS,
  H2_FRAME_PING,
  H2_FRAME_PRIORITY,
  H2_FRAME_PUSH_PROMISE,
  H2_FRAME_RST_STREAM,
  H2_FRAME_SETTINGS,
  H2_FRAME_SIZE_ERROR,
  H2_FRAME_WINDOW_UPDATE,
  H2_MAX_FRAME_LIMIT,
  H2_MAX_WINDOW,
  H2_NO_ERROR,
  H2_PROTOCOL_ERROR,
  H2_REFUSED_STREAM,
  H2_SETTINGS_ENABLE_CONNECT_PROTOCOL,
  H2_SETTINGS_HEADER_TABLE_SIZE,
  H2_SETTINGS_INITIAL_WINDOW_SIZE,
  H2_SETTINGS_MAX_CONCURRENT_STREAMS,
  H2_SETTINGS_MAX_FRAME_SIZE,
  H2_SETTINGS_MAX_HEADER_LIST_SIZE,
  H2_STREAM_CLOSED,
  Http2Frame,
  http2ParseFrame,
  http2ReadHeader,
  http2SettingCount,
  http2SettingError,
  http2SettingId,
  http2SettingValue,
  http2WriteContinuation,
  http2WriteData,
  http2WriteGoaway,
  http2WriteHeaders,
  http2WritePing,
  http2WriteRstStream,
  http2WriteSettings,
  http2WriteSettingsAck,
  http2WriteWindowUpdate,
} from "nish/net/http2-frame"

/** `next` needs more input, or the output to drain. */
export const H2_NEED_MORE: i32 = 0
/** A stream opened with a request: `stream`, `fields`, `endStream`. */
export const H2_REQUEST: i32 = 1
/** Request body bytes: `stream`, `data[dataStart .. dataStart + dataLength)`, `endStream`. */
export const H2_DATA: i32 = 2
/** A trailer section, which ends the request: `stream`, `fields`. */
export const H2_TRAILERS: i32 = 3
/** The stream is gone, reset by the peer or for a rule it broke: `stream`, `errorCode`, `resetByPeer`. */
export const H2_RESET: i32 = 4
/** A send window that held `writeData` back has opened: `stream`, 0 for the connection's. */
export const H2_WINDOW: i32 = 5
/** The peer sent GOAWAY: `lastStreamId`, `errorCode`. */
export const H2_GOAWAY: i32 = 6
/** The connection failed with `errorCode` and a GOAWAY is queued. Final. */
export const H2_ERROR: i32 = 7

/** What `writeData` answers when nothing can be sent yet: Linux's EAGAIN, as `nish:net` spells it. */
export const H2_AGAIN: i32 = -11
/** What a write answers for fields or a status it may not send: Linux's EINVAL. */
export const H2_INVALID: i32 = -22
/** What a write answers for a stream it may not write to: Linux's EPIPE. */
export const H2_CLOSED: i32 = -32

/** The connection preface every client sends first (§3.4). */
const H2_PREFACE: string = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"

/** The preface's length. */
const H2_PREFACE_SIZE: i32 = 24

/** How many frames one header block may be cut into. */
export const H2_MAX_FRAGMENTS: i32 = 64

/**
 * Output kept free of DATA and HEADERS, so the control frames a read frame
 * can make the connection send — two WINDOW_UPDATEs, a RST_STREAM, a 431, a
 * PING or SETTINGS acknowledgement — and the GOAWAY after them always fit.
 */
const H2_CONTROL_RESERVE: i32 = 128

/**
 * How many stream identifiers the connection remembers having reset, and
 * having closed, beyond `maxStreams`: enough for the program to reset every
 * open stream at once and still ignore what the peer had in flight for each.
 */
const H2_RECENT_RESETS: i32 = 16

/** The connection's states. */
const H2_STATE_PREFACE: i32 = 0
const H2_STATE_SETTINGS: i32 = 1
const H2_STATE_OPEN: i32 = 2
const H2_STATE_FAILED: i32 = 3

/** A typed zero: a bare literal is an `f64` under `--number-mode f64`. */
const H2_ZERO: i32 = 0

/** The character `0`, typed, which a status digit is added to. */
const H2_DIGIT_ZERO: i32 = 48

/** 431 Request Header Fields Too Large (RFC 6585 §5), typed. */
const H2_STATUS_TOO_LARGE: i32 = 431

/** A typed -1, for no padding. */
const H2_NO_PAD: i32 = -1

/**
 * The connection's caps, fixed when it is made. The defaults are RFC 9113's
 * where it has one; each is advertised in the server's SETTINGS where a
 * setting names it.
 */
export class Http2Config {
  /** SETTINGS_MAX_CONCURRENT_STREAMS, and the stream slots the connection allocates. */
  maxStreams: i32 = 100
  /** SETTINGS_INITIAL_WINDOW_SIZE: what each stream may send before the server credits it. */
  initialWindowSize: i32 = 65535
  /** The connection's receive window, raised from 65,535 by a WINDOW_UPDATE at the start. */
  connectionWindowSize: i32 = 1048576
  /** SETTINGS_MAX_FRAME_SIZE: the largest frame payload read, which sizes the input buffer. */
  maxFrameSize: i32 = 16384
  /** SETTINGS_MAX_HEADER_LIST_SIZE: past it a request is answered with a 431. */
  maxHeaderListSize: i32 = 16384
  /** The largest header block, compressed, across HEADERS and CONTINUATION. */
  maxHeaderBlock: i32 = 16384
  /** SETTINGS_HEADER_TABLE_SIZE: the HPACK decoder's table. */
  headerTableSize: i32 = 4096
  /** SETTINGS_ENABLE_CONNECT_PROTOCOL (RFC 8441): whether `:protocol` is accepted. */
  enableConnectProtocol: boolean = false
  /** The output buffer, in bytes. */
  outputSize: i32 = 65536
  /** How many streams the peer may reset before finishing, net of the ones it lets finish. */
  resetBudget: i32 = 100
}

/** One stream's slot. `id` is 0 while the slot is free. */
export class Http2Stream {
  /** What the server may still send on the stream. */
  sendWindow: i64 = 0
  /** What the peer may still send on it. */
  recvWindow: i64 = 0
  /** The request's `content-length`, or -1. */
  contentLength: i64 = -1
  /** The body bytes received. */
  received: i64 = 0
  id: i32 = 0
  /** What the program has been handed since the last WINDOW_UPDATE for it. */
  recvUnacked: i32 = 0
  /** The peer sent END_STREAM: half-closed (remote). */
  remoteEnded: boolean = false
  /** The server sent END_STREAM: half-closed (local). */
  localEnded: boolean = false
  /** A final (non-1xx) response head was sent. */
  responded: boolean = false
  /** `writeData` was held back by this stream's window. */
  blocked: boolean = false
}

/** Whether `buf[off ..]` holds the preface. */
const http2IsPreface = (buf: u8[], off: i32): boolean => {
  for (let k: i32 = 0; k < H2_PREFACE_SIZE && off + k < toI32(buf.length); k++) {
    if (toI32(buf[off + k]) !== toI32(H2_PREFACE.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** Moves `buf[start, end)` to the front of `buf` and answers where it now ends. */
const http2Compact = (buf: u8[], start: i32, end: i32): i32 => {
  const keep: i32 = end - start
  if (start > 0) {
    for (let k: i32 = 0; k < keep && k < toI32(buf.length) && start + k < toI32(buf.length); k++) {
      buf[k] = buf[start + k]
    }
  }
  return keep
}

/** Writes `id` at `at` in the ring `ring` and answers where the next one goes. */
const http2Remember = (ring: i32[], at: i32, id: i32): i32 => {
  const slot: i32 = at % toI32(ring.length)
  if (slot >= 0 && slot < toI32(ring.length)) {
    ring[slot] = id
  }
  return slot + 1
}

/** Panics unless `[off, off + len)` lies inside `buf`. */
const http2CheckWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || toI64(off) + toI64(len) > toI64(buf.length)) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${buf.length} bytes`)
  }
}

/** Panics unless `value` lies in `[low, high]`: a cap out of range is the program's mistake. */
const http2CheckCap = (what: string, value: i32, low: i32, high: i32): void => {
  if (value < low || value > high) {
    panic(`Http2Connection: ${what} of ${value}, outside ${low} to ${high}`)
  }
}

/**
 * One HTTP/2 connection, server side. The fields after the buffers are the
 * last event's; the module comment says which event sets which.
 */
export class Http2Connection {
  // Pointers and 64-bit fields first, then 32-bit ones, then flags: the
  // order the layout packs without padding.
  config: Http2Config
  frame: Http2Frame
  /** Bytes fed and not read yet are `input[inputStart .. inputEnd)`. */
  input: u8[]
  /** Bytes to send are `output[outputStart .. outputEnd)`. */
  output: u8[]
  /** The header block being gathered across CONTINUATION frames. */
  block: u8[]
  /** Where a response's header block is encoded, emptied and reused. */
  encoded: u8[]
  decoder: HpackDecoder
  encoder: HpackEncoder
  /** The last request's or trailers' fields. */
  fields: HttpFields
  streams: Http2Stream[]
  /** The identifiers the server reset most recently, a ring. */
  resets: i32[]
  /** The identifiers of the streams closed most recently, however they closed, a ring. */
  closed: i32[]
  /** The bytes of `:status` and of a three-digit status, reused for every response. */
  statusName: u8[]
  statusValue: u8[]
  /** GOAWAY's debug data, which the server never sends: one empty array, made once. */
  noDebug: u8[]
  /** The server's SETTINGS, made once and sent by every `restart`. */
  settingIds: i32[]
  settingValues: i64[]
  /** The peer's SETTINGS_INITIAL_WINDOW_SIZE. */
  peerInitialWindow: i64 = 65535
  /** The peer's SETTINGS_MAX_HEADER_LIST_SIZE, advisory; -1 until it sends one. */
  peerMaxHeaderList: i64 = -1
  /** The window a new stream starts with on the receiving side. */
  localInitialWindow: i64 = 65535
  /** The connection's send window. */
  sendWindow: i64 = 65535
  /** The connection's receive window, and what has been handed on since it was last credited. */
  recvWindow: i64 = 65535
  recvUnacked: i64 = 0
  /** H2_DATA's bytes: the input buffer, valid until the next `feed`. */
  data: u8[]
  /** H2_RESET's, H2_GOAWAY's and H2_ERROR's code. */
  errorCode: i64 = 0
  inputStart: i32 = 0
  inputEnd: i32 = 0
  outputStart: i32 = 0
  outputEnd: i32 = 0
  blockLength: i32 = 0
  /** The stream the open header block is on, or 0 when none is open. */
  blockStream: i32 = 0
  /** A stream error the HEADERS that opened the block carried. */
  blockError: i32 = 0
  blockFragments: i32 = 0
  resetAt: i32 = 0
  closedAt: i32 = 0
  state: i32 = 0
  /** The highest stream identifier the peer has opened. */
  lastPeerStream: i32 = 0
  /** Streams with a slot. */
  active: i32 = 0
  /** The peer's SETTINGS_MAX_FRAME_SIZE. */
  peerMaxFrameSize: i32 = 16384
  /** What is left of `config.resetBudget`. */
  resetCredit: i32 = 0
  /** The last event's stream. */
  stream: i32 = 0
  /** H2_DATA's window onto `data`. */
  dataStart: i32 = 0
  dataLength: i32 = 0
  /** H2_GOAWAY's last stream identifier. */
  lastStreamId: i32 = 0
  /** The last stream identifier the server's first GOAWAY named, which no later one may raise (§6.8). */
  sentLast: i32 = 0
  blockEndStream: boolean = false
  /** Whether the peer has acknowledged the server's SETTINGS. */
  settingsAcked: boolean = false
  /** `writeData` was held back by the connection's window. */
  sendBlocked: boolean = false
  goawaySent: boolean = false
  goawayReceived: boolean = false
  /** The peer's byte stream has ended (`endInput`). */
  inputEnded: boolean = false
  /** Whether the last H2_REQUEST, H2_DATA or H2_TRAILERS ended its stream. */
  endStream: boolean = false
  /** Whether H2_RESET came from the peer's RST_STREAM rather than a rule its stream broke. */
  resetByPeer: boolean = false

  /**
   * A connection under `config`, with its SETTINGS — and the WINDOW_UPDATE
   * that raises the connection's window, when `connectionWindowSize` asks
   * for one — already in `output`, since a server's preface is its SETTINGS
   * (§3.4). A cap outside what RFC 9113 allows panics.
   */
  constructor(config: Http2Config) {
    http2CheckCap("maxStreams", config.maxStreams, 1, 65536)
    http2CheckCap("initialWindowSize", config.initialWindowSize, 1, H2_MAX_WINDOW)
    http2CheckCap("connectionWindowSize", config.connectionWindowSize, H2_DEFAULT_WINDOW, H2_MAX_WINDOW)
    http2CheckCap("maxFrameSize", config.maxFrameSize, H2_DEFAULT_MAX_FRAME, H2_MAX_FRAME_LIMIT)
    http2CheckCap("maxHeaderListSize", config.maxHeaderListSize, 0, H2_MAX_WINDOW)
    http2CheckCap("maxHeaderBlock", config.maxHeaderBlock, 1, H2_MAX_WINDOW)
    http2CheckCap("headerTableSize", config.headerTableSize, 0, H2_MAX_WINDOW)
    http2CheckCap("outputSize", config.outputSize, 1024, H2_MAX_WINDOW)
    http2CheckCap("resetBudget", config.resetBudget, 0, H2_MAX_WINDOW)
    this.config = config
    this.frame = new Http2Frame()
    this.input = new Array<u8>(config.maxFrameSize + H2_FRAME_HEADER_SIZE)
    this.output = new Array<u8>(config.outputSize)
    this.block = new Array<u8>(config.maxHeaderBlock)
    this.encoded = []
    this.decoder = new HpackDecoder(HPACK_DEFAULT_TABLE_SIZE, config.maxHeaderListSize)
    this.encoder = new HpackEncoder(HPACK_DEFAULT_TABLE_SIZE)
    this.fields = new HttpFields()
    this.streams = []
    for (let k: i32 = 0; k < config.maxStreams; k++) {
      this.streams.push(new Http2Stream())
    }
    this.resets = new Array<i32>(config.maxStreams + H2_RECENT_RESETS)
    this.closed = new Array<i32>(config.maxStreams + H2_RECENT_RESETS)
    this.statusName = httpFieldBytes(":status")
    this.noDebug = []
    this.statusValue = [48, 48, 48]
    this.data = this.input
    this.settingIds = [
      H2_SETTINGS_HEADER_TABLE_SIZE,
      H2_SETTINGS_MAX_CONCURRENT_STREAMS,
      H2_SETTINGS_INITIAL_WINDOW_SIZE,
      H2_SETTINGS_MAX_FRAME_SIZE,
      H2_SETTINGS_MAX_HEADER_LIST_SIZE,
    ]
    this.settingValues = [
      toI64(config.headerTableSize),
      toI64(config.maxStreams),
      toI64(config.initialWindowSize),
      toI64(config.maxFrameSize),
      toI64(config.maxHeaderListSize),
    ]
    if (config.enableConnectProtocol) {
      this.settingIds.push(H2_SETTINGS_ENABLE_CONNECT_PROTOCOL)
      this.settingValues.push(toI64(1))
    }
    this.restart()
  }

  /**
   * Puts the connection back as the constructor left it, for the next peer:
   * every stream closed, both HPACK tables empty, and the server's SETTINGS
   * in `output` again. It allocates nothing, which is what lets a carrier
   * reuse one connection per slot (WP34 N9).
   */
  restart(): void {
    const config: Http2Config = this.config
    this.inputStart = 0
    this.inputEnd = 0
    this.outputStart = 0
    this.outputEnd = 0
    this.blockLength = 0
    this.blockStream = 0
    this.blockEndStream = false
    this.blockError = 0
    this.blockFragments = 0
    for (const s of this.streams) {
      s.id = 0
    }
    this.resets.fill(0)
    this.resetAt = 0
    this.closed.fill(0)
    this.closedAt = 0
    this.decoder.table.resize(H2_ZERO)
    this.decoder.table.resize(HPACK_DEFAULT_TABLE_SIZE)
    this.decoder.settingsLimit = HPACK_DEFAULT_TABLE_SIZE
    this.decoder.owedUpdate = -1
    this.decoder.failed = 0
    this.encoder.table.resize(H2_ZERO)
    this.encoder.table.resize(HPACK_DEFAULT_TABLE_SIZE)
    this.encoder.owedMinimum = -1
    this.state = H2_STATE_PREFACE
    this.lastPeerStream = 0
    this.active = 0
    this.peerInitialWindow = toI64(H2_DEFAULT_WINDOW)
    this.peerMaxFrameSize = H2_DEFAULT_MAX_FRAME
    this.peerMaxHeaderList = -1
    this.settingsAcked = false
    this.sendWindow = toI64(H2_DEFAULT_WINDOW)
    this.recvUnacked = 0
    this.sendBlocked = false
    this.goawaySent = false
    this.goawayReceived = false
    this.inputEnded = false
    this.stream = 0
    this.endStream = false
    this.dataStart = 0
    this.dataLength = 0
    this.errorCode = 0
    this.resetByPeer = false
    this.lastStreamId = 0
    this.sentLast = 0
    this.resetCredit = config.resetBudget
    const big: i64 = toI64(H2_DEFAULT_WINDOW)
    this.localInitialWindow = toI64(config.initialWindowSize) > big ? toI64(config.initialWindowSize) : big
    this.recvWindow = toI64(config.connectionWindowSize)
    this.outputEnd = http2WriteSettings(this.output, H2_ZERO, this.settingIds, this.settingValues)
    const raise: i32 = config.connectionWindowSize - H2_DEFAULT_WINDOW
    if (raise > 0) {
      this.outputEnd = http2WriteWindowUpdate(this.output, this.outputEnd, H2_ZERO, raise)
    }
  }

  // ---- Bytes in and out ---------------------------------------------------------

  /** How many bytes `feed` would take now. */
  inputRoom(): i32 {
    return toI32(this.input.length) - (this.inputEnd - this.inputStart)
  }

  /**
   * Takes as much of `buf[off, off + len)` as the input buffer has room for,
   * and answers how much; the rest is the caller's to feed again once `next`
   * has read what is there. Moves the unread bytes to the front of the
   * buffer, which ends the last H2_DATA's window. Once the connection has
   * failed it takes everything and keeps nothing.
   */
  feed(buf: u8[], off: i32, len: i32): i32 {
    http2CheckWindow("Http2Connection.feed", buf, off, len)
    if (this.state === H2_STATE_FAILED) {
      return len
    }
    const room: i32 = this.inputTail()
    const n: i32 = len < room ? len : room
    for (let k: i32 = 0; k < n; k++) {
      this.input[this.inputEnd + k] = buf[off + k]
    }
    this.inputEnd = this.inputEnd + n
    return n
  }

  /**
   * Moves the unread input to the front of its buffer, which ends the last
   * H2_DATA's window, and answers the room after it: where a carrier may read
   * straight into `input` from `inputEnd`, then `received` what it read.
   */
  inputTail(): i32 {
    this.inputEnd = http2Compact(this.input, this.inputStart, this.inputEnd)
    this.inputStart = 0
    return toI32(this.input.length) - this.inputEnd
  }

  /** Takes `n` bytes a carrier read into `input` at `inputEnd`, after `inputTail` gave it the room. */
  received(n: i32): void {
    const room: i32 = toI32(this.input.length) - this.inputEnd
    if (n < 0 || n > room) {
      panic(`Http2Connection.received: ${n} bytes into ${room} of room`)
    }
    if (this.state !== H2_STATE_FAILED) {
      this.inputEnd = this.inputEnd + n
    }
  }

  /** Marks the first `n` bytes of the output sent. */
  consume(n: i32): void {
    const pending: i32 = this.outputEnd - this.outputStart
    this.outputStart = this.outputStart + (n < pending ? n : pending)
    if (this.outputStart === this.outputEnd) {
      this.outputStart = 0
      this.outputEnd = 0
    }
  }

  /** Whether the output holds bytes to send. */
  wantsWrite(): boolean {
    return this.outputEnd > this.outputStart
  }

  /**
   * Whether the connection is over: everything is sent, and it failed, or no
   * stream is left after a GOAWAY went either way or after the peer's byte
   * stream ended (`endInput`) with nothing of it left unread.
   */
  isDone(): boolean {
    if (this.wantsWrite()) {
      return false
    }
    const unread: boolean = this.inputEnd > this.inputStart
    const over: boolean = this.goawaySent || this.goawayReceived || (this.inputEnded && !unread)
    return this.state === H2_STATE_FAILED || (over && this.active === 0)
  }

  /**
   * The peer's byte stream has ended, so nothing more will be fed: once the
   * requests it already sent are answered, the connection is done.
   */
  endInput(): void {
    this.inputEnded = true
  }

  /** The room left at the end of the output, once what was sent is moved out of the way. */
  room(): i32 {
    this.outputEnd = http2Compact(this.output, this.outputStart, this.outputEnd)
    this.outputStart = 0
    return toI32(this.output.length) - this.outputEnd
  }

  /** The room DATA and HEADERS may use: all but the control reserve. */
  bodyRoom(): i32 {
    const r: i32 = this.room() - H2_CONTROL_RESERVE
    return r > 0 ? r : 0
  }

  /** Appends a frame a writer put at the end of the output, when it fit (`end >= 0`), and answers whether it did. */
  wrote(end: i32): boolean {
    if (end >= 0) {
      this.outputEnd = end
    }
    return end >= 0
  }

  // ---- Streams ------------------------------------------------------------------

  /** The slot holding stream `id`, or `null`. */
  find(id: i32): Http2Stream | null {
    if (id <= 0) {
      return null
    }
    for (const s of this.streams) {
      if (s.id === id) {
        return s
      }
    }
    return null
  }

  /** Opens stream `id` in a free slot; the caller has checked there is one. */
  open(id: i32): Http2Stream {
    for (const s of this.streams) {
      if (s.id === 0) {
        s.id = id
        s.sendWindow = this.peerInitialWindow
        s.recvWindow = this.localInitialWindow
        s.recvUnacked = 0
        s.contentLength = -1
        s.received = 0
        s.remoteEnded = false
        s.localEnded = false
        s.responded = false
        s.blocked = false
        this.active = this.active + 1
        return s
      }
    }
    panic("Http2Connection.open: no free slot")
  }

  /** Frees the slot of a stream that is closed. */
  release(s: Http2Stream): void {
    if (s.id !== 0) {
      this.closedAt = http2Remember(this.closed, this.closedAt, s.id)
      s.id = 0
      this.active = this.active - 1
    }
  }

  /** The peer ended stream `s`; closes it when the server had too. */
  remoteEnd(s: Http2Stream): void {
    s.remoteEnded = true
    if (s.localEnded) {
      this.release(s)
    }
  }

  /** The server ended stream `s`; closes it when the peer had too, and credits the reset budget. */
  localEnd(s: Http2Stream): void {
    s.localEnded = true
    if (this.resetCredit < this.config.resetBudget) {
      this.resetCredit = this.resetCredit + 1
    }
    if (s.remoteEnded) {
      this.release(s)
    }
  }

  /** Whether the server reset stream `id` recently, so frames still in flight for it are ignored (§5.4.2). */
  recentlyReset(id: i32): boolean {
    return id > 0 && this.resets.indexOf(id) >= 0
  }

  /**
   * Whether stream `id` is one the connection remembers closing. A HEADERS
   * below the highest identifier on a stream it does not remember was never
   * opened, and is the out-of-order identifier §5.1.1 calls PROTOCOL_ERROR
   * rather than a frame on a closed stream (STREAM_CLOSED, §5.1).
   */
  recentlyClosed(id: i32): boolean {
    return id > 0 && this.closed.indexOf(id) >= 0
  }

  /**
   * Sends RST_STREAM for `id` with `code`, frees its slot if it has one, and
   * remembers it; answers false, changing nothing, when the frame did not fit.
   */
  resetStream(id: i32, code: i32): boolean {
    if (!this.wrote(http2WriteRstStream(this.output, this.outputEnd, id, toI64(code)))) {
      return false
    }
    const s: Http2Stream | null = this.find(id)
    if (s !== null) {
      this.release(s)
    }
    this.resetAt = http2Remember(this.resets, this.resetAt, id)
    return true
  }

  /** A stream error on `s`: resets it, and answers the H2_RESET that tells the program. */
  streamError(s: Http2Stream, code: i32): i32 {
    const id: i32 = s.id
    this.resetStream(id, code)
    this.stream = id
    this.errorCode = toI64(code)
    this.resetByPeer = false
    return H2_RESET
  }

  /**
   * Writes GOAWAY with `code`, naming the last stream the peer had opened when
   * the server's first GOAWAY went: no later one may name a higher stream
   * (§6.8). Answers whether it fit.
   */
  sendGoaway(code: i32): boolean {
    const last: i32 = this.goawaySent ? this.sentLast : this.lastPeerStream
    if (
      !this.wrote(
        http2WriteGoaway(this.output, this.outputEnd, last, toI64(code), this.noDebug, H2_ZERO, H2_ZERO)
      )
    ) {
      return false
    }
    this.goawaySent = true
    this.sentLast = last
    return true
  }

  /** A connection error: queues GOAWAY with `code` and answers H2_ERROR. */
  fail(code: i32): i32 {
    if (this.state !== H2_STATE_FAILED) {
      this.state = H2_STATE_FAILED
      this.errorCode = toI64(code)
      this.sendGoaway(code)
      this.inputStart = 0
      this.inputEnd = 0
      this.blockStream = 0
    }
    return H2_ERROR
  }

  /**
   * Hands `n` received bytes back to the connection's window, and to `s`'s
   * when it is still open for receiving, with a WINDOW_UPDATE once half a
   * window is owed.
   */
  credit(s: Http2Stream | null, n: i32): void {
    this.recvUnacked = this.recvUnacked + toI64(n)
    const half: i64 = toI64(this.config.connectionWindowSize / 2)
    if (this.recvUnacked > toI64(0) && this.recvUnacked >= half) {
      const inc: i32 = toI32(this.recvUnacked)
      this.wrote(http2WriteWindowUpdate(this.output, this.outputEnd, H2_ZERO, inc))
      this.recvWindow = this.recvWindow + this.recvUnacked
      this.recvUnacked = 0
    }
    if (s !== null && !s.remoteEnded) {
      s.recvUnacked = s.recvUnacked + n
      if (s.recvUnacked > 0 && s.recvUnacked >= this.config.initialWindowSize / 2) {
        this.wrote(http2WriteWindowUpdate(this.output, this.outputEnd, s.id, s.recvUnacked))
        s.recvWindow = s.recvWindow + toI64(s.recvUnacked)
        s.recvUnacked = 0
      }
    }
  }

  // ---- Reading ------------------------------------------------------------------

  /** Reads frames until one is an event for the program, and answers it. */
  next(): i32 {
    while (true) {
      if (this.state === H2_STATE_FAILED) {
        return H2_ERROR
      }
      if (this.room() < H2_CONTROL_RESERVE) {
        return H2_NEED_MORE
      }
      const available: i32 = this.inputEnd - this.inputStart
      if (this.state === H2_STATE_PREFACE) {
        if (available < H2_PREFACE_SIZE) {
          return H2_NEED_MORE
        }
        if (!http2IsPreface(this.input, this.inputStart)) {
          return this.fail(H2_PROTOCOL_ERROR)
        }
        this.inputStart = this.inputStart + H2_PREFACE_SIZE
        this.state = H2_STATE_SETTINGS
        continue
      }
      const f: Http2Frame = this.frame
      if (!http2ReadHeader(f, this.input, this.inputStart, available)) {
        return H2_NEED_MORE
      }
      if (f.length > this.config.maxFrameSize) {
        return this.fail(H2_FRAME_SIZE_ERROR)
      }
      if (available < H2_FRAME_HEADER_SIZE + f.length) {
        return H2_NEED_MORE
      }
      const error: i32 = http2ParseFrame(f, this.input, this.inputStart, this.config.maxFrameSize)
      this.inputStart = this.inputStart + H2_FRAME_HEADER_SIZE + f.length
      if (error !== H2_NO_ERROR) {
        return this.fail(error)
      }
      const event: i32 = this.handleFrame(f)
      if (event !== H2_NEED_MORE) {
        return event
      }
    }
  }

  /** One frame that parsed: the rules no single frame type owns, then the type's own. */
  handleFrame(f: Http2Frame): i32 {
    if (this.blockStream !== 0 && (f.type !== H2_FRAME_CONTINUATION || f.streamId !== this.blockStream)) {
      return this.fail(H2_PROTOCOL_ERROR)
    }
    if (this.state === H2_STATE_SETTINGS) {
      if (f.type !== H2_FRAME_SETTINGS || f.has(H2_FLAG_ACK)) {
        return this.fail(H2_PROTOCOL_ERROR)
      }
      this.state = H2_STATE_OPEN
    }
    switch (f.type) {
      case H2_FRAME_DATA:
        return this.handleData(f)
      case H2_FRAME_HEADERS:
        return this.handleHeaders(f)
      case H2_FRAME_PRIORITY:
        return this.handlePriority(f)
      case H2_FRAME_RST_STREAM:
        return this.handleRstStream(f)
      case H2_FRAME_SETTINGS:
        return this.handleSettings(f)
      case H2_FRAME_PUSH_PROMISE:
        return this.fail(H2_PROTOCOL_ERROR)
      case H2_FRAME_PING:
        if (!f.has(H2_FLAG_ACK)) {
          this.wrote(http2WritePing(this.output, this.outputEnd, this.input, f.contentStart, true))
        }
        return H2_NEED_MORE
      case H2_FRAME_GOAWAY:
        this.goawayReceived = true
        this.lastStreamId = f.lastStreamId
        this.errorCode = f.errorCode
        return H2_GOAWAY
      case H2_FRAME_WINDOW_UPDATE:
        return this.handleWindowUpdate(f)
      case H2_FRAME_CONTINUATION:
        return this.handleContinuation(f)
      default:
        return H2_NEED_MORE
    }
  }

  /** Whether `id` names an idle stream: one the peer has not opened yet. */
  isIdle(id: i32): boolean {
    // An even identifier is the server's to open (§5.1.1), and this server
    // opens none, so every even stream is idle for as long as it lives.
    return id % 2 === 0 || id > this.lastPeerStream
  }

  /**
   * Whether frames on stream `id`, which has no slot, are dropped without a
   * word: the server reset it and these were in flight (§5.4.2), or it was
   * opened after the server's GOAWAY and so never opened at all (§6.8).
   */
  discarded(id: i32): boolean {
    return this.recentlyReset(id) || (this.goawaySent && id > this.sentLast)
  }

  /** DATA (§6.1): flow control first, on the whole payload, then the stream's state. */
  handleData(f: Http2Frame): i32 {
    const id: i32 = f.streamId
    const size: i32 = f.length
    const s: Http2Stream | null = this.find(id)
    if (s === null && this.isIdle(id)) {
      return this.fail(H2_PROTOCOL_ERROR)
    }
    if (toI64(size) > this.recvWindow) {
      return this.fail(H2_FLOW_CONTROL_ERROR)
    }
    this.recvWindow = this.recvWindow - toI64(size)
    if (s === null) {
      this.credit(null, size)
      if (!this.discarded(id)) {
        this.resetStream(id, H2_STREAM_CLOSED)
      }
      return H2_NEED_MORE
    }
    const end: boolean = f.has(H2_FLAG_END_STREAM)
    const received: i64 = s.received + toI64(f.contentLength)
    const declared: boolean = s.contentLength >= toI64(0)
    let error: i32 = H2_NO_ERROR
    if (s.remoteEnded) {
      error = H2_STREAM_CLOSED
    } else if (toI64(size) > s.recvWindow) {
      error = H2_FLOW_CONTROL_ERROR
    } else if (declared && (received > s.contentLength || (end && received !== s.contentLength))) {
      error = H2_PROTOCOL_ERROR
    }
    if (error !== H2_NO_ERROR) {
      this.credit(null, size)
      return this.streamError(s, error)
    }
    s.recvWindow = s.recvWindow - toI64(size)
    s.received = received
    this.credit(end ? null : s, size)
    this.stream = id
    this.endStream = end
    this.data = this.input
    this.dataStart = f.contentStart
    this.dataLength = f.contentLength
    if (end) {
      this.remoteEnd(s)
    } else if (f.contentLength === 0) {
      return H2_NEED_MORE
    }
    return H2_DATA
  }

  /** Appends a fragment of a header block; a block past `maxHeaderBlock` or `H2_MAX_FRAGMENTS` ends the connection. */
  gather(f: Http2Frame): boolean {
    this.blockFragments = this.blockFragments + 1
    if (
      this.blockFragments > H2_MAX_FRAGMENTS ||
      f.contentLength > toI32(this.block.length) - this.blockLength
    ) {
      return false
    }
    for (let k: i32 = 0; k < f.contentLength; k++) {
      this.block[this.blockLength + k] = this.input[f.contentStart + k]
    }
    this.blockLength = this.blockLength + f.contentLength
    return true
  }

  /** HEADERS (§6.2): starts a header block, and ends it when END_HEADERS says so. */
  handleHeaders(f: Http2Frame): i32 {
    this.blockStream = f.streamId
    this.blockEndStream = f.has(H2_FLAG_END_STREAM)
    this.blockError = f.streamError
    this.blockLength = 0
    this.blockFragments = 0
    return this.handleContinuation(f)
  }

  /** CONTINUATION (§6.10): only inside a header block, which `handleFrame` has checked it continues. */
  handleContinuation(f: Http2Frame): i32 {
    if (this.blockStream === 0) {
      return this.fail(H2_PROTOCOL_ERROR)
    }
    if (!this.gather(f)) {
      return this.fail(H2_ENHANCE_YOUR_CALM)
    }
    return f.has(H2_FLAG_END_HEADERS) ? this.endBlock() : H2_NEED_MORE
  }

  /**
   * A whole header block: decoded first, whatever becomes of its stream,
   * because the decoder's table must stay in step with the peer's encoder
   * (§4.3); then a new stream's request, or an open stream's trailers.
   */
  endBlock(): i32 {
    const id: i32 = this.blockStream
    this.blockStream = 0
    const decoded: i32 = this.decoder.decode(this.block, H2_ZERO, this.blockLength)
    if (decoded < 0) {
      return this.fail(H2_COMPRESSION_ERROR)
    }
    const s: Http2Stream | null = this.find(id)
    if (s !== null) {
      return this.trailers(s, decoded)
    }
    if (!this.isIdle(id)) {
      if (this.discarded(id)) {
        return H2_NEED_MORE
      }
      return this.fail(this.recentlyClosed(id) ? H2_STREAM_CLOSED : H2_PROTOCOL_ERROR)
    }
    if (id % 2 === 0) {
      return this.fail(H2_PROTOCOL_ERROR)
    }
    this.lastPeerStream = id
    if (this.goawaySent) {
      return H2_NEED_MORE
    }
    if (this.blockError !== 0) {
      this.resetStream(id, this.blockError)
      return H2_NEED_MORE
    }
    if (decoded === HPACK_LIST_TOO_LARGE) {
      this.tooLarge(id)
      return H2_NEED_MORE
    }
    if (this.active >= this.config.maxStreams) {
      this.resetStream(id, H2_REFUSED_STREAM)
      return H2_NEED_MORE
    }
    const shape: i32 = this.fields.readRequest(
      this.decoder.names,
      this.decoder.values,
      this.config.enableConnectProtocol
    )
    if (shape !== HTTP_FIELDS_OK || (this.blockEndStream && this.fields.contentLength > toI64(0))) {
      this.resetStream(id, H2_PROTOCOL_ERROR)
      return H2_NEED_MORE
    }
    const opened: Http2Stream = this.open(id)
    opened.contentLength = this.fields.contentLength
    this.stream = id
    this.endStream = this.blockEndStream
    if (this.blockEndStream) {
      this.remoteEnd(opened)
    }
    return H2_REQUEST
  }

  /** A header block on an open stream: trailers, which must end it (§8.1). */
  trailers(s: Http2Stream, decoded: i32): i32 {
    if (s.remoteEnded) {
      return this.streamError(s, H2_STREAM_CLOSED)
    }
    if (this.blockError !== 0) {
      return this.streamError(s, this.blockError)
    }
    if (
      !this.blockEndStream ||
      decoded === HPACK_LIST_TOO_LARGE ||
      this.fields.readTrailers(this.decoder.names, this.decoder.values) !== HTTP_FIELDS_OK ||
      (s.contentLength >= toI64(0) && s.received !== s.contentLength)
    ) {
      return this.streamError(s, H2_PROTOCOL_ERROR)
    }
    this.stream = s.id
    this.endStream = true
    this.remoteEnd(s)
    return H2_TRAILERS
  }

  /**
   * A request whose header list passed `maxHeaderListSize`: a 431 with
   * END_STREAM, then a RST_STREAM with NO_ERROR when the peer is still
   * sending (§8.1), so the stream never reaches the program.
   */
  tooLarge(id: i32): void {
    this.encodeStatus(H2_STATUS_TOO_LARGE)
    const n: i32 = toI32(this.encoded.length)
    this.wrote(
      http2WriteHeaders(
        this.output,
        this.outputEnd,
        id,
        this.encoded,
        H2_ZERO,
        n,
        H2_FLAG_END_STREAM | H2_FLAG_END_HEADERS,
        H2_NO_PAD
      )
    )
    if (!this.blockEndStream) {
      this.resetStream(id, H2_NO_ERROR)
    }
  }

  /** Empties `encoded` and starts a block with `:status`, or with nothing for 0 (trailers). */
  encodeStatus(status: i32): void {
    while (toI32(this.encoded.length) > 0) {
      this.encoded.pop()
    }
    if (status > 0) {
      this.statusValue[0] = toU8(status / 100 + H2_DIGIT_ZERO)
      this.statusValue[1] = toU8(((status / 10) % 10) + H2_DIGIT_ZERO)
      this.statusValue[2] = toU8((status % 10) + H2_DIGIT_ZERO)
      this.encoder.encodeField(this.encoded, this.statusName, this.statusValue, HPACK_INDEX_WITHOUT, false)
    }
  }

  /** PRIORITY (§6.3): checked and otherwise ignored, and it opens nothing. */
  handlePriority(f: Http2Frame): i32 {
    if (f.streamError === 0) {
      return H2_NEED_MORE
    }
    const s: Http2Stream | null = this.find(f.streamId)
    if (s !== null) {
      return this.streamError(s, f.streamError)
    }
    this.resetStream(f.streamId, f.streamError)
    return H2_NEED_MORE
  }

  /** RST_STREAM (§6.4): the stream is closed; on an idle one it is a connection error. */
  handleRstStream(f: Http2Frame): i32 {
    if (this.isIdle(f.streamId)) {
      return this.fail(H2_PROTOCOL_ERROR)
    }
    const s: Http2Stream | null = this.find(f.streamId)
    if (s === null) {
      return H2_NEED_MORE
    }
    this.release(s)
    this.resetCredit = this.resetCredit - 1
    if (this.resetCredit < 0) {
      return this.fail(H2_ENHANCE_YOUR_CALM)
    }
    this.stream = f.streamId
    this.errorCode = f.errorCode
    this.resetByPeer = true
    return H2_RESET
  }

  /**
   * SETTINGS (§6.5): the peer's acknowledgement puts the server's own
   * settings in force; anything else is the peer's, each value checked, then
   * acknowledged. A new SETTINGS_INITIAL_WINDOW_SIZE moves every stream's send
   * window by the difference (§6.9.2), and opening one answers H2_WINDOW.
   */
  handleSettings(f: Http2Frame): i32 {
    if (f.has(H2_FLAG_ACK)) {
      if (!this.settingsAcked) {
        this.settingsAcked = true
        this.decoder.setSettingsLimit(this.config.headerTableSize)
        const delta: i64 = toI64(this.config.initialWindowSize) - this.localInitialWindow
        this.localInitialWindow = toI64(this.config.initialWindowSize)
        for (const s of this.streams) {
          if (s.id !== 0) {
            s.recvWindow = s.recvWindow + delta
          }
        }
      }
      return H2_NEED_MORE
    }
    let opened: boolean = false
    const n: i32 = http2SettingCount(f)
    for (let k: i32 = 0; k < n; k++) {
      const id: i32 = http2SettingId(f, this.input, k)
      const value: i64 = http2SettingValue(f, this.input, k)
      const error: i32 = http2SettingError(id, value)
      if (error !== H2_NO_ERROR) {
        return this.fail(error)
      }
      if (id === H2_SETTINGS_HEADER_TABLE_SIZE) {
        const size: i32 = toI32(Math.min(value, toI64(HPACK_DEFAULT_TABLE_SIZE)))
        if (size !== this.encoder.table.maxSize) {
          this.encoder.setMaxTableSize(size)
        }
      } else if (id === H2_SETTINGS_INITIAL_WINDOW_SIZE) {
        const delta: i64 = value - this.peerInitialWindow
        this.peerInitialWindow = value
        for (const s of this.streams) {
          if (s.id !== 0) {
            s.sendWindow = s.sendWindow + delta
            if (s.sendWindow > toI64(H2_MAX_WINDOW)) {
              return this.fail(H2_FLOW_CONTROL_ERROR)
            }
            if (delta > toI64(0) && s.blocked) {
              s.blocked = false
              opened = true
            }
          }
        }
      } else if (id === H2_SETTINGS_MAX_FRAME_SIZE) {
        this.peerMaxFrameSize = toI32(value)
      } else if (id === H2_SETTINGS_MAX_HEADER_LIST_SIZE) {
        this.peerMaxHeaderList = value
      }
    }
    this.wrote(http2WriteSettingsAck(this.output, this.outputEnd))
    if (opened) {
      this.stream = 0
      return H2_WINDOW
    }
    return H2_NEED_MORE
  }

  /** WINDOW_UPDATE (§6.9): a send window grows, and a write it held back may go on. */
  handleWindowUpdate(f: Http2Frame): i32 {
    const inc: i64 = toI64(f.increment)
    if (f.streamId === 0) {
      this.sendWindow = this.sendWindow + inc
      if (this.sendWindow > toI64(H2_MAX_WINDOW)) {
        return this.fail(H2_FLOW_CONTROL_ERROR)
      }
      if (this.sendBlocked) {
        this.sendBlocked = false
        this.stream = 0
        return H2_WINDOW
      }
      return H2_NEED_MORE
    }
    const s: Http2Stream | null = this.find(f.streamId)
    if (s === null) {
      return this.isIdle(f.streamId) ? this.fail(H2_PROTOCOL_ERROR) : H2_NEED_MORE
    }
    if (f.streamError !== 0) {
      return this.streamError(s, f.streamError)
    }
    s.sendWindow = s.sendWindow + inc
    if (s.sendWindow > toI64(H2_MAX_WINDOW)) {
      return this.streamError(s, H2_FLOW_CONTROL_ERROR)
    }
    if (s.blocked) {
      s.blocked = false
      this.stream = s.id
      return H2_WINDOW
    }
    return H2_NEED_MORE
  }

  // ---- Writing ------------------------------------------------------------------

  /** The stream the program may still send on, or `null`. */
  writable(id: i32): Http2Stream | null {
    if (this.state === H2_STATE_FAILED) {
      return null
    }
    const s: Http2Stream | null = this.find(id)
    return s !== null && !s.localEnded ? s : null
  }

  /**
   * Encodes `:status` and `names`/`values` and sends the block as HEADERS and
   * as many CONTINUATION frames as the peer's SETTINGS_MAX_FRAME_SIZE needs,
   * with END_STREAM when `endStream`. Answers 0, `H2_INVALID` for fields
   * `httpFieldsCheckOutgoing` refuses or a status outside 100 to 599,
   * `H2_AGAIN` when the output has no room for it yet, or `H2_CLOSED`.
   * Nothing is encoded until it is sure to be sent, so the HPACK state never
   * moves for a block that was not.
   */
  sendHead(s: Http2Stream, status: i32, names: u8[][], values: u8[][], endStream: boolean): i32 {
    if (httpFieldsCheckOutgoing(names, values) !== HTTP_FIELDS_OK) {
      return H2_INVALID
    }
    // A literal costs its strings and at most eleven bytes of prefixes; two
    // table size updates and `:status` are inside the forty-eight on top.
    let bound: i64 = toI64(48)
    for (let k: i32 = 0; k < toI32(names.length) && k < toI32(values.length); k++) {
      bound = bound + toI64(names[k].length) + toI64(values[k].length) + toI64(11)
    }
    const frames: i64 = bound / toI64(this.peerMaxFrameSize) + toI64(1)
    const need: i64 = bound + frames * toI64(H2_FRAME_HEADER_SIZE)
    if (need > toI64(this.bodyRoom())) {
      return toI64(this.output.length) < need + toI64(H2_CONTROL_RESERVE) ? H2_INVALID : H2_AGAIN
    }
    this.encodeStatus(status)
    for (let k: i32 = 0; k < toI32(names.length) && k < toI32(values.length); k++) {
      const value: u8[] = values[k]
      // One choice covers the name and the value, so Huffman is taken only
      // when it shortens the value and does not lengthen the name: neither
      // string is then longer than the bound above counted it.
      const name: u8[] = names[k]
      const huffman: boolean =
        hpackHuffmanLength(this.encoder.huffman, value, H2_ZERO, toI32(value.length)) < toI32(value.length) &&
        hpackHuffmanLength(this.encoder.huffman, name, H2_ZERO, toI32(name.length)) <= toI32(name.length)
      const indexing: i32 = httpFieldSensitive(name) ? HPACK_INDEX_NEVER : HPACK_INDEX_WITHOUT
      this.encoder.encodeField(this.encoded, name, value, indexing, huffman)
    }
    const total: i32 = toI32(this.encoded.length)
    let at: i32 = 0
    let first: boolean = true
    while (first || at < total) {
      const left: i32 = total - at
      const chunk: i32 = left < this.peerMaxFrameSize ? left : this.peerMaxFrameSize
      const last: boolean = at + chunk >= total
      const flags: i32 =
        (last ? H2_FLAG_END_HEADERS : H2_ZERO) | (first && endStream ? H2_FLAG_END_STREAM : H2_ZERO)
      this.wrote(
        first
          ? http2WriteHeaders(this.output, this.outputEnd, s.id, this.encoded, at, chunk, flags, H2_NO_PAD)
          : http2WriteContinuation(this.output, this.outputEnd, s.id, this.encoded, at, chunk, flags)
      )
      at = at + chunk
      first = false
    }
    if (endStream) {
      this.localEnd(s)
    }
    return 0
  }

  /**
   * Answers stream `id` with `status` and the fields `names[k]`: `values[k]`,
   * lowercase and none of them connection-specific; END_STREAM when
   * `endStream`. A 1xx status but 101 may come before the final one and may
   * not end the stream. Answers as `sendHead` does.
   */
  respond(id: i32, status: i32, names: u8[][], values: u8[][], endStream: boolean): i32 {
    const s: Http2Stream | null = this.writable(id)
    if (s === null) {
      return H2_CLOSED
    }
    const interim: boolean = status >= 100 && status < 200
    // 101 switches protocols, which HTTP/2 does not do (§8.6).
    if (status < 100 || status > 599 || status === 101 || s.responded || (interim && endStream)) {
      return H2_INVALID
    }
    const result: i32 = this.sendHead(s, status, names, values, endStream)
    if (result === 0 && !interim) {
      s.responded = true
    }
    return result
  }

  /** Ends stream `id` with a trailer section, after its response head (§8.1). Answers as `sendHead` does. */
  writeTrailers(id: i32, names: u8[][], values: u8[][]): i32 {
    const s: Http2Stream | null = this.writable(id)
    if (s === null) {
      return H2_CLOSED
    }
    if (!s.responded) {
      return H2_INVALID
    }
    return this.sendHead(s, H2_ZERO, names, values, true)
  }

  /**
   * Sends as much of `buf[off, off + len)` on stream `id` as the stream's
   * window, the connection's window, and the output allow, in frames no
   * larger than the peer's SETTINGS_MAX_FRAME_SIZE, and answers how much.
   * END_STREAM goes on the last frame when `endStream` and every byte was
   * taken; `len` 0 with `endStream` sends an empty DATA that ends the stream.
   * Answers `H2_AGAIN` when nothing could be taken — after H2_WINDOW for the
   * stream or the connection, or once the output has drained, it may be
   * tried again — and `H2_CLOSED` for a stream with no final response head
   * or that has ended.
   */
  writeData(id: i32, buf: u8[], off: i32, len: i32, endStream: boolean): i32 {
    http2CheckWindow("Http2Connection.writeData", buf, off, len)
    const s: Http2Stream | null = this.writable(id)
    if (s === null || !s.responded) {
      return H2_CLOSED
    }
    let sent: i32 = 0
    while (sent < len) {
      const room: i32 = this.bodyRoom() - H2_FRAME_HEADER_SIZE
      let chunk: i64 = Math.min(toI64(len - sent), toI64(this.peerMaxFrameSize))
      chunk = Math.min(chunk, Math.min(s.sendWindow, this.sendWindow))
      chunk = Math.min(chunk, toI64(room))
      if (chunk <= toI64(0)) {
        if (s.sendWindow <= toI64(0)) {
          s.blocked = true
        }
        if (this.sendWindow <= toI64(0)) {
          this.sendBlocked = true
        }
        break
      }
      const n: i32 = toI32(chunk)
      const last: boolean = endStream && sent + n === len
      this.wrote(
        http2WriteData(
          this.output,
          this.outputEnd,
          id,
          buf,
          off + sent,
          n,
          last ? H2_FLAG_END_STREAM : 0,
          H2_NO_PAD
        )
      )
      s.sendWindow = s.sendWindow - chunk
      this.sendWindow = this.sendWindow - chunk
      sent = sent + n
    }
    if (len === 0 && endStream) {
      if (this.bodyRoom() < H2_FRAME_HEADER_SIZE) {
        return H2_AGAIN
      }
      this.wrote(
        http2WriteData(this.output, this.outputEnd, id, buf, off, H2_ZERO, H2_FLAG_END_STREAM, H2_NO_PAD)
      )
    }
    if (endStream && sent === len) {
      this.localEnd(s)
    }
    return sent === 0 && len > 0 ? H2_AGAIN : sent
  }

  /**
   * Resets stream `id` with `code` (§6.4), from the program's side: CANCEL,
   * say. Answers 0, `H2_AGAIN` when the output has no room for the frame yet
   * (the stream stays open), or `H2_CLOSED`.
   */
  reset(id: i32, code: i32): i32 {
    if (this.state === H2_STATE_FAILED || this.find(id) === null) {
      return H2_CLOSED
    }
    this.room()
    return this.resetStream(id, code) ? 0 : H2_AGAIN
  }

  /**
   * Starts a graceful close (§6.8): GOAWAY with NO_ERROR naming the last
   * stream the peer opened. Streams already open finish; newer ones are
   * ignored; `isDone` once the last has closed and everything is sent.
   * Answers 0, also when a GOAWAY was already sent or the connection has
   * failed, or `H2_AGAIN` when the output has no room for the frame yet.
   */
  goaway(): i32 {
    if (this.state === H2_STATE_FAILED || this.goawaySent) {
      return 0
    }
    this.room()
    return this.sendGoaway(H2_NO_ERROR) ? 0 : H2_AGAIN
  }
}
