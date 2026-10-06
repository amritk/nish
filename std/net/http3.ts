/**
 * `nish/net/http3` — the server side of an HTTP/3 connection (RFC 9114) on
 * the streams of a `QuicConnection` (`nish/net/quic`): the control stream
 * and SETTINGS both ways, the QPACK encoder and decoder streams (opened, at
 * dynamic table capacity 0), requests and responses on bidirectional streams
 * with their bodies streamed both ways, GOAWAY, and RFC 9114's error codes.
 * Field sections are encoded and decoded by `nish/net/qpack` and checked by
 * `nish/net/http-fields`.
 *
 * It is sans-IO in the way the QUIC connection under it is: the carrier
 * hands the `QuicConnection` its datagrams and takes the ones it sends, and
 * this module reads and writes that connection's streams. `nish/net/http3-server`
 * runs it over a UDP socket with ALPN `h3`.
 *
 *     import { Http3Config, Http3Connection, H3_NEED_MORE, H3_ERROR, H3_REQUEST, H3_DATA, H3_END } from "nish/net/http3";
 *
 *     const h3 = new Http3Connection(new Http3Config(), quic);   // once per slot; restart() per connection
 *     // after quic.receive(...):
 *     let event: i32 = h3.next();
 *     while (event !== H3_NEED_MORE && event !== H3_ERROR) {
 *       // H3_REQUEST: h3.stream, h3.fields (method, path, get("accept"))
 *       // H3_DATA: h3.data[h3.dataStart .. h3.dataStart + h3.dataLength)
 *       // H3_END: the request is whole; respond
 *       event = h3.next();
 *     }
 *     h3.respond(stream, 200, names, values, false);
 *     h3.writeData(stream, body, 0, n, true);   // answers how much it took
 *
 * **Events.** `next()` reads the streams the QUIC connection has news for and
 * answers the first thing that means something to the program: `H3_REQUEST`
 * (a request's field section, in `fields`), `H3_DATA` (a piece of its body, a
 * window onto `data` valid until the next call), `H3_TRAILERS`, `H3_END` (the
 * request ended, and its `content-length`, if any, matched), `H3_RESET` (the
 * stream is gone: the client reset it or stopped it, or it broke a rule that
 * resets it — `errorCode` says which, `resetByPeer` who), `H3_WRITABLE` (a
 * stream whose write was held back can take more), `H3_GOAWAY` (the client is
 * going away; `lastStreamId` is its push ID), and `H3_ERROR`, final: the
 * connection broke a rule, it is closed with `errorCode`, and every later call
 * answers it again. `H3_NEED_MORE` asks for more datagrams. A request's events
 * come in order — REQUEST, DATA…, TRAILERS, END — and after `H3_RESET` its
 * stream has no more.
 *
 * **Back-pressure** is QUIC's flow control. A body is read only as the
 * program calls `next()`, `bodyChunk` bytes at most at a time, and QUIC gives
 * the client more credit only as its receive buffer is read. `writeData`
 * takes as much as the stream's send buffer has room for and answers how much;
 * when it took less, `H3_WRITABLE` names the stream once acknowledgements free
 * room. HEADERS and trailers go whole or not at all (`H3_AGAIN`).
 *
 * **Streams** (§6). The connection opens its control stream, sends SETTINGS
 * first on it (SETTINGS_QPACK_MAX_TABLE_CAPACITY 0, SETTINGS_QPACK_BLOCKED_STREAMS
 * 0 and SETTINGS_MAX_FIELD_SECTION_SIZE), and opens its QPACK encoder and
 * decoder streams, on which it sends nothing but their types. The client's
 * encoder and decoder streams go to `nish/net/qpack`'s capacity-0 handling.
 * A unidirectional stream of a type it does not know is asked to stop
 * (H3_STREAM_CREATION_ERROR) and read to its end (§6.2).
 *
 * **What it refuses.** A connection error closes the QUIC connection with
 * the code: a second control, encoder or decoder stream, or a push stream
 * from a client (H3_STREAM_CREATION_ERROR, §6.2.1, §6.2.2); a control stream
 * whose first frame is not SETTINGS (H3_MISSING_SETTINGS); the end, reset or
 * STOP_SENDING of any critical stream, either side's (H3_CLOSED_CRITICAL_STREAM);
 * a frame where it may not be — DATA or HEADERS on the control stream, a
 * control frame on a request stream, a second SETTINGS, DATA before HEADERS,
 * anything but the end after trailers, any PUSH_PROMISE from a client, and an
 * HTTP/2 type HTTP/3 reserves (H3_FRAME_UNEXPECTED, §7.2.8); a frame cut off
 * by its stream's end or a payload of the wrong length (H3_FRAME_ERROR, §7.1);
 * a SETTINGS frame `nish/net/http3-frame` refuses (H3_SETTINGS_ERROR); a
 * GOAWAY whose push ID rose, a MAX_PUSH_ID that fell, a CANCEL_PUSH past the
 * push IDs allowed (H3_ID_ERROR, §5.2, §7.2.7, §7.2.3); a control frame past
 * `H3_CONTROL_FRAME_MAX` (H3_EXCESSIVE_LOAD); and QPACK's three. A stream
 * error resets one request, both ways, and the connection lives: a field
 * section `nish/net/http-fields` refuses, and a body that disagrees with
 * `content-length` (H3_MESSAGE_ERROR, §4.1.2); a request stream that ends
 * before its HEADERS (H3_REQUEST_INCOMPLETE, §4.1.1); a request on a stream at
 * or past the ID of the GOAWAY this side sent (H3_REQUEST_REJECTED, §5.2).
 * A request whose field section is longer than `maxFieldSectionSize` — the
 * frame, or the section once decoded — is answered with a 431, never reaches
 * the program, and its stream is asked to stop with H3_NO_ERROR (§4.2.2,
 * §4.1.2).
 *
 * **No server push.** It never sends PUSH_PROMISE; a client's MAX_PUSH_ID is
 * allowed, checked and ignored.
 *
 * **Caps are start-up numbers**, all in `Http3Config`, and every buffer is
 * made by the constructor: the stream state for every QUIC stream slot, the
 * field section, the body chunk and the control frame. A field section's
 * names and values are copied into arrays the connection keeps, which grow to
 * the largest section seen and are then reused, so a warm connection
 * allocates nothing per request (`docs/security/http3.md`, H3-2). A peer's
 * counters saturate, and the lookup of a stream's state is the QUIC
 * connection's own hash index (`QuicStreams.slotOf`), never a scan.
 *
 * TODO(WP34 R2): extended CONNECT (RFC 9220), SETTINGS_ENABLE_CONNECT_PROTOCOL
 * and HTTP datagrams are WebTransport's. The seams are `config.extendedConnect`,
 * which `HttpFields.readRequest` is given, and the unknown SETTINGS
 * identifiers `peer` keeps.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9114 and RFC 9204, not ported from another implementation.
 */
import {
  HTTP_FIELDS_OK,
  HttpFields,
  httpFieldBytes,
  httpFieldSensitive,
  httpFieldsCheckOutgoing,
} from "nish/net/http-fields"
import {
  QPACK_FIELD_OVERHEAD,
  QPACK_OK,
  QPACK_SECTION_TOO_LARGE,
  QpackDecoder,
  QpackEncoder,
} from "nish/net/qpack"
import {
  H3_CLOSED_CRITICAL_STREAM,
  H3_EXCESSIVE_LOAD,
  H3_FRAME_CANCEL_PUSH,
  H3_FRAME_DATA,
  H3_FRAME_ERROR,
  H3_FRAME_GOAWAY,
  H3_FRAME_HEADER_MAX,
  H3_FRAME_HEADERS,
  H3_FRAME_MAX_PUSH_ID,
  H3_FRAME_PUSH_PROMISE,
  H3_FRAME_SETTINGS,
  H3_FRAME_UNEXPECTED,
  H3_ID_ERROR,
  H3_INTERNAL_ERROR,
  H3_MESSAGE_ERROR,
  H3_MISSING_SETTINGS,
  H3_NO_ERROR,
  H3_REQUEST_CANCELLED,
  H3_REQUEST_INCOMPLETE,
  H3_REQUEST_REJECTED,
  H3_SETTINGS_MAX_FIELD_SECTION_SIZE,
  H3_SETTINGS_OK,
  H3_SETTINGS_QPACK_BLOCKED_STREAMS,
  H3_SETTINGS_QPACK_MAX_TABLE_CAPACITY,
  H3_STREAM_CONTROL,
  H3_STREAM_CREATION_ERROR,
  H3_STREAM_PUSH,
  H3_STREAM_QPACK_DECODER,
  H3_STREAM_QPACK_ENCODER,
  Http3FrameHeader,
  Http3Settings,
  h3FrameHeaderSize,
  h3PutFrameHeader,
  h3PutIdFrame,
  h3PutSettings,
  h3PutVarint,
  h3ReadFrameHeader,
  h3ReadIdPayload,
  h3ReadSettings,
  h3ReadVarint,
  h3ReservedHttp2Frame,
} from "nish/net/http3-frame"
import { QUIC_STATE_CONNECTED, QuicConnection } from "nish/net/quic"
import { QUIC_STREAM_END, QUIC_STREAM_ERR_RESET, QuicStream } from "nish/net/quic-stream"

/** The ALPN protocol identifier of HTTP/3 (RFC 9114 §3.1). */
export const H3_ALPN: string = "h3"

/** `next` has nothing more until more datagrams arrive. */
export const H3_NEED_MORE: i32 = 0
/** A request's field section: `stream`, `fields`. */
export const H3_REQUEST: i32 = 1
/** Request body bytes: `stream`, `data[dataStart .. dataStart + dataLength)`. */
export const H3_DATA: i32 = 2
/** A trailer section: `stream`, `fields`. */
export const H3_TRAILERS: i32 = 3
/** The request ended whole: `stream`. */
export const H3_END: i32 = 4
/** The stream is gone: `stream`, `errorCode`, `resetByPeer`. */
export const H3_RESET: i32 = 5
/** A stream whose write was held back can take more: `stream`. */
export const H3_WRITABLE: i32 = 6
/** The client sent GOAWAY: `lastStreamId`, its push ID. */
export const H3_GOAWAY: i32 = 7
/** The connection failed with `errorCode` and is closed. Final. */
export const H3_ERROR: i32 = 8

/** A write that can take nothing yet: Linux's EAGAIN, as `nish:net` spells it. */
export const H3_AGAIN: i32 = -11
/** A write of fields or a status the program may not send, or out of order: Linux's EINVAL. */
export const H3_INVALID: i32 = -22
/** A write to a stream that is not an open request: Linux's EPIPE. */
export const H3_CLOSED: i32 = -32
/** A field section past what the client takes, or past a stream's buffer: Linux's EMSGSIZE. */
export const H3_TOO_LARGE: i32 = -90

/** The largest control-stream frame read whole: SETTINGS, GOAWAY, MAX_PUSH_ID, CANCEL_PUSH. */
export const H3_CONTROL_FRAME_MAX: i32 = 1024

/** The request streams' phases, and the unidirectional streams'. */
const H3_PHASE_HEADERS: i32 = 0
const H3_PHASE_BODY: i32 = 1
const H3_PHASE_TRAILED: i32 = 2
const H3_PHASE_SKIP: i32 = 3
const H3_PHASE_DISCARD: i32 = 4
const H3_PHASE_DONE: i32 = 5
const H3_PHASE_UNI_TYPE: i32 = 6
const H3_PHASE_CONTROL: i32 = 7
const H3_PHASE_ENCODER: i32 = 8
const H3_PHASE_DECODER: i32 = 9

/** A stream slot's flags. */
const H3_FLAG_DELIVERED: i32 = 1
const H3_FLAG_HEADERS_SENT: i32 = 2
const H3_FLAG_SEND_DONE: i32 = 4
const H3_FLAG_RECV_DONE: i32 = 8
const H3_FLAG_STOP_NOTED: i32 = 16
const H3_FLAG_BLOCKED: i32 = 32
const H3_FLAG_COUNTED: i32 = 64

/** The connection's states. */
const H3_STATE_OPEN: i32 = 0
const H3_STATE_FAILED: i32 = 1

/** What `requestFrame` answers when it read a frame header and the stream has more to read. */
const H3_CONTINUE: i32 = -1

/** A frame type no frame has, for a payload being skipped. */
const H3_SKIP_TYPE: i64 = -1

/** A reserved frame type (0x1f * 0 + 0x21) the connection pads a stream's send buffer with to be told when it drains. */
const H3_FILLER_TYPE: i32 = 0x21

/** Typed constants, since a bare literal is an `f64` under `--number-mode f64`. */
const H3_ZERO: i32 = 0
const H3_ONE: i32 = 1
const H3_NONE: i64 = -1
const H3_STATUS_TOO_LARGE: i32 = 431
const H3_DIGIT_ZERO: i32 = 48

/** The largest body chunk or DATA frame a configuration may ask for. */
const H3_MAX_CHUNK: i32 = 1048576

/** The bytes a slot keeps for a frame header being read or written. */
const H3_HEAD: i32 = 16

/**
 * The connection's caps, fixed when it is made. `maxFieldSectionSize` is
 * advertised in SETTINGS and is the largest HEADERS frame read and the
 * largest section decoded; `bodyChunk` the most body handed to the program at
 * once; `writeChunk` the largest DATA frame written.
 */
export class Http3Config {
  /** SETTINGS_MAX_FIELD_SECTION_SIZE (§4.2.2): past it a request is answered with a 431. */
  maxFieldSectionSize: i32 = 16384
  /** The body buffer: the largest `H3_DATA` window. */
  bodyChunk: i32 = 16384
  /** The largest DATA frame `writeData` starts. */
  writeChunk: i32 = 16384
  /**
   * Whether `:protocol` is accepted (RFC 9220's extended CONNECT). Off, and
   * not advertised: TODO(WP34 R2) sends SETTINGS_ENABLE_CONNECT_PROTOCOL.
   */
  extendedConnect: boolean = false
}

/** Panics unless `value` lies in `[low, high]`: a cap out of range is the program's mistake. */
const http3CheckCap = (what: string, value: i32, low: i32, high: i32): void => {
  if (value < low || value > high) {
    panic(`Http3Connection: ${what} of ${value}, outside ${low} to ${high}`)
  }
}

/** Panics unless `[off, off + len)` lies inside `buf`. */
const http3CheckWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || toI64(off) + toI64(len) > toI64(buf.length)) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${buf.length} bytes`)
  }
}

/** Empties `bytes`, keeping its storage for the next fill. */
const http3Empty = (bytes: u8[]): void => {
  while (toI32(bytes.length) > 0) {
    bytes.pop()
  }
}

/** Whether `id` is a stream the client opened carrying data both ways: a request stream. */
const http3IsRequest = (id: i64): boolean => (id & 3) === 0

/** The smaller of two `i64`s. */
const http3Min = (a: i64, b: i64): i64 => (a < b ? a : b)

/** `count` plus one, saturating at 2^31 - 1. */
const http3Count = (count: i32): i32 => (count < 2147483647 ? count + 1 : count)

/**
 * One HTTP/3 connection, server side, over `quic`. The fields after the
 * buffers are the last event's; the module comment says which event sets
 * which.
 */
export class Http3Connection {
  // Pointers and 64-bit fields first, then 32-bit ones, then flags: the
  // order the layout packs without padding.
  config: Http3Config
  quic: QuicConnection
  decoder: QpackDecoder
  encoder: QpackEncoder
  /** The last request's or trailers' fields, valid until the next of either. */
  fields: HttpFields
  /** The client's SETTINGS. */
  peer: Http3Settings
  header: Http3FrameHeader
  /** H3_DATA's bytes, and where a payload being skipped is read to. */
  data: u8[]
  /** A HEADERS payload read whole, for the decoder. */
  section: u8[]
  /** A control frame's payload, read whole. */
  control: u8[]
  /** Frame headers, SETTINGS and GOAWAY on their way out. */
  scratch: u8[]
  /** Zeros, the payload of a filler frame. */
  zeros: u8[]
  /** A response's field section, encoded, emptied and reused. */
  encoded: u8[]
  /** Copies of the decoded names and values, one array per line, reused, and the lists handed to `fields`. */
  names: u8[][]
  values: u8[][]
  nameList: u8[][]
  valueList: u8[][]
  statusName: u8[]
  statusValue: u8[]
  /** The SETTINGS this side sends. */
  settingIds: i64[]
  settingValues: i64[]
  /** Per QUIC stream slot: the stream the state is for, or -1. */
  slotId: i64[]
  /** The frame being read: its type, and what is left of its payload (-1 between frames). */
  frameType: i64[]
  frameLeft: i64[]
  /** DATA bytes received on the request, and its `content-length` or -1. */
  dataTotal: i64[]
  contentLength: i64[]
  /** Bytes still owed on the stream: a filler's payload, and the DATA frame's payload the program is writing. */
  fillLeft: i64[]
  dataLeft: i64[]
  phase: i32[]
  flags: i32[]
  /** A frame header (or a stream type) being read, `headLen[k]` bytes of `head[k * 16 ..]`. */
  headLen: i32[]
  head: u8[]
  /** Frame-header bytes owed before anything else, `pendLen[k]` of `pend[k * 16 + pendAt[k] ..]`. */
  pendAt: i32[]
  pendLen: i32[]
  pend: u8[]
  /** This side's streams, and the client's critical ones; -1 until there. */
  ownControl: i64 = -1
  ownEncoder: i64 = -1
  ownDecoder: i64 = -1
  peerControl: i64 = -1
  peerEncoder: i64 = -1
  peerDecoder: i64 = -1
  /** The stream `next` is reading, or -1. */
  active: i64 = -1
  /** The ID this side's GOAWAY named, or -1; the client's last GOAWAY push ID, and its MAX_PUSH_ID. */
  goawayId: i64 = -1
  peerGoaway: i64 = -1
  maxPushId: i64 = -1
  /** The last event's stream. */
  stream: i64 = -1
  /** H3_RESET's and H3_ERROR's code. */
  errorCode: i64 = 0
  /** H3_GOAWAY's push ID. */
  lastStreamId: i64 = 0
  /** H3_DATA's window onto `data`. */
  dataStart: i32 = 0
  dataLength: i32 = 0
  /** How much of `control` is filled. */
  controlFill: i32 = 0
  state: i32 = 0
  /** Requests open: taken and not yet finished both ways. */
  live: i32 = 0
  /** Counters for a log or a test, each saturating: requests refused after GOAWAY, answered 431, and reset for a rule. */
  rejected: i32 = 0
  tooLarge: i32 = 0
  streamErrors: i32 = 0
  /** Whether this side's three streams are open and typed, and the client's SETTINGS have arrived. */
  started: boolean = false
  settingsSeen: boolean = false
  /** Whether H3_RESET came from the client. */
  resetByPeer: boolean = false

  /**
   * A connection under `config` over `quic`, whose configuration must let a
   * HEADERS frame of `maxFieldSectionSize` fit a stream's buffer, and let
   * the client open the three unidirectional streams it needs and this side
   * open its own three (§6.2). A cap out of range panics.
   */
  constructor(config: Http3Config, quic: QuicConnection) {
    const buffer: i32 = quic.streams.bufferSize
    http3CheckCap("maxFieldSectionSize", config.maxFieldSectionSize, 1, buffer - H3_HEAD)
    http3CheckCap("bodyChunk", config.bodyChunk, 1, H3_MAX_CHUNK)
    http3CheckCap("writeChunk", config.writeChunk, 1, H3_MAX_CHUNK)
    http3CheckCap("the QUIC unidirectional stream limit", toI32(quic.streams.maxUni), 3, 1024)
    http3CheckCap("the QUIC local stream limit", toI32(quic.streams.localStreams), 3, 1024)
    this.config = config
    this.quic = quic
    this.decoder = new QpackDecoder(config.maxFieldSectionSize)
    this.encoder = new QpackEncoder()
    this.fields = new HttpFields()
    this.peer = new Http3Settings()
    this.header = new Http3FrameHeader()
    this.data = new Array<u8>(config.bodyChunk)
    this.section = new Array<u8>(config.maxFieldSectionSize)
    this.control = new Array<u8>(H3_CONTROL_FRAME_MAX)
    this.scratch = new Array<u8>(64)
    this.zeros = new Array<u8>(256)
    this.encoded = []
    this.names = []
    this.values = []
    this.nameList = []
    this.valueList = []
    this.statusName = httpFieldBytes(":status")
    this.statusValue = [48, 48, 48]
    this.settingIds = [
      H3_SETTINGS_QPACK_MAX_TABLE_CAPACITY,
      H3_SETTINGS_QPACK_BLOCKED_STREAMS,
      H3_SETTINGS_MAX_FIELD_SECTION_SIZE,
    ]
    this.settingValues = [toI64(0), toI64(0), toI64(config.maxFieldSectionSize)]
    const n: i32 = toI32(quic.streams.slots.length)
    this.slotId = new Array<i64>(n)
    this.frameType = new Array<i64>(n)
    this.frameLeft = new Array<i64>(n)
    this.dataTotal = new Array<i64>(n)
    this.contentLength = new Array<i64>(n)
    this.fillLeft = new Array<i64>(n)
    this.dataLeft = new Array<i64>(n)
    this.phase = new Array<i32>(n)
    this.flags = new Array<i32>(n)
    this.headLen = new Array<i32>(n)
    this.head = new Array<u8>(n * H3_HEAD)
    this.pendAt = new Array<i32>(n)
    this.pendLen = new Array<i32>(n)
    this.pend = new Array<u8>(n * H3_HEAD)
    this.restart()
  }

  /**
   * Puts the connection back as the constructor left it, for the QUIC
   * connection's next peer (call it after `quic.reset`): no stream known,
   * QPACK's state and the client's SETTINGS forgotten. It allocates nothing.
   */
  restart(): void {
    this.slotId.fill(H3_NONE)
    this.flags.fill(H3_ZERO)
    this.headLen.fill(H3_ZERO)
    this.pendLen.fill(H3_ZERO)
    this.fillLeft.fill(toI64(0))
    this.dataLeft.fill(toI64(0))
    this.decoder.failed = QPACK_OK
    this.decoder.reason = 0
    this.decoder.capacityInstructions = 0
    this.encoder.failed = QPACK_OK
    this.encoder.reason = 0
    this.encoder.cancellations = 0
    this.encoder.lastCancelled = -1
    this.encoder.pendingId = 0
    this.encoder.pendingShift = -1
    this.fields.clear()
    this.peer.reset()
    this.ownControl = -1
    this.ownEncoder = -1
    this.ownDecoder = -1
    this.peerControl = -1
    this.peerEncoder = -1
    this.peerDecoder = -1
    this.active = -1
    this.goawayId = -1
    this.peerGoaway = -1
    this.maxPushId = -1
    this.stream = -1
    this.errorCode = 0
    this.lastStreamId = 0
    this.dataStart = 0
    this.dataLength = 0
    this.controlFill = 0
    this.state = H3_STATE_OPEN
    this.live = 0
    this.rejected = 0
    this.tooLarge = 0
    this.streamErrors = 0
    this.started = false
    this.settingsSeen = false
    this.resetByPeer = false
  }

  // ---- The connection -----------------------------------------------------------

  /** Closes the connection with `code` (a connection error) and answers H3_ERROR. */
  fail(code: i64): i32 {
    if (this.state !== H3_STATE_FAILED) {
      this.state = H3_STATE_FAILED
      this.errorCode = code
      this.quic.close(code)
    }
    return H3_ERROR
  }

  /**
   * Whether this side sent GOAWAY and every request it took has finished
   * both ways, every byte of each response acknowledged: the carrier may
   * close the connection.
   */
  isDone(): boolean {
    const streams = this.quic.streams
    return this.goawayId >= 0 && this.live === 0 && streams.peerBidiClosed >= streams.peerBidiOpened
  }

  /** Writes `buf[0 .. n)` to this side's new stream `id` whole, as its first bytes; answers whether it took them. */
  writeNew(id: i64, buf: u8[], n: i32): boolean {
    return n > 0 && this.quic.streamWrite(id, buf, H3_ZERO, n, false) === n
  }

  /**
   * Opens this side's control stream with its type and SETTINGS, and its
   * QPACK encoder and decoder streams with their types (§6.2.1, RFC 9204
   * §4.2). A stream the client's MAX_STREAMS does not allow yet is opened on
   * a later call.
   */
  start(): void {
    const end: i32 = toI32(this.scratch.length)
    if (this.ownControl < 0) {
      const id: i64 = this.quic.openStream(false)
      if (id < 0) {
        return
      }
      this.ownControl = id
      const p: i32 = h3PutVarint(this.scratch, H3_ZERO, end, H3_STREAM_CONTROL)
      const q: i32 = h3PutSettings(this.scratch, p, end, this.settingIds, this.settingValues)
      if (!this.writeNew(id, this.scratch, q)) {
        this.fail(H3_INTERNAL_ERROR)
        return
      }
    }
    if (this.ownEncoder < 0) {
      const id: i64 = this.quic.openStream(false)
      if (id < 0) {
        return
      }
      this.ownEncoder = id
      if (
        !this.writeNew(id, this.scratch, h3PutVarint(this.scratch, H3_ZERO, end, H3_STREAM_QPACK_ENCODER))
      ) {
        this.fail(H3_INTERNAL_ERROR)
        return
      }
    }
    if (this.ownDecoder < 0) {
      const id: i64 = this.quic.openStream(false)
      if (id < 0) {
        return
      }
      this.ownDecoder = id
      if (
        !this.writeNew(id, this.scratch, h3PutVarint(this.scratch, H3_ZERO, end, H3_STREAM_QPACK_DECODER))
      ) {
        this.fail(H3_INTERNAL_ERROR)
        return
      }
    }
    this.started = true
  }

  /**
   * Reads what the QUIC connection has for the program and answers the next
   * event (see the module comment). Call it after every datagram the QUIC
   * connection takes, until it answers H3_NEED_MORE or H3_ERROR.
   */
  next(): i32 {
    if (this.state === H3_STATE_FAILED) {
      return H3_ERROR
    }
    if (this.quic.closed()) {
      this.state = H3_STATE_FAILED
      this.errorCode = this.quic.error
      return H3_ERROR
    }
    if (this.quic.state !== QUIC_STATE_CONNECTED) {
      return H3_NEED_MORE
    }
    if (!this.started) {
      this.start()
    }
    while (this.state !== H3_STATE_FAILED) {
      if (this.active < 0) {
        this.active = this.quic.nextStreamEvent()
        if (this.active < 0) {
          return H3_NEED_MORE
        }
      }
      const event: i32 = this.step(this.active)
      if (event !== H3_NEED_MORE) {
        return event
      }
      this.active = -1
    }
    return H3_ERROR
  }

  /** The next event stream `id` has, or H3_NEED_MORE when it has nothing more to say now. */
  step(id: i64): i32 {
    const k: i32 = this.quic.streams.slotOf(id)
    if (k < 0 || k >= toI32(this.slotId.length)) {
      return H3_NEED_MORE
    }
    const kind: i64 = id & 3
    if (kind === 3) {
      return this.ownStream(k)
    }
    if (kind === 1) {
      return H3_NEED_MORE
    }
    if (this.slotId[k] !== id) {
      this.open(k, id)
    }
    const phase: i32 = this.phase[k]
    if (phase >= H3_PHASE_UNI_TYPE) {
      return this.uniStep(k, id)
    }
    return this.requestStep(k, id)
  }

  /** The state of a stream the client just opened in slot `k`. */
  open(k: i32, id: i64): void {
    this.slotId[k] = id
    this.frameType[k] = H3_SKIP_TYPE
    this.frameLeft[k] = -1
    this.dataTotal[k] = 0
    this.contentLength[k] = -1
    this.fillLeft[k] = 0
    this.dataLeft[k] = 0
    this.flags[k] = 0
    this.headLen[k] = 0
    this.pendAt[k] = 0
    this.pendLen[k] = 0
    if (!http3IsRequest(id)) {
      this.phase[k] = H3_PHASE_UNI_TYPE
      return
    }
    this.phase[k] = H3_PHASE_HEADERS
    if (this.goawayId >= 0 && id >= this.goawayId) {
      // §5.2: a request past the GOAWAY this side sent is refused, both ways, unprocessed.
      this.quic.streamReset(id, H3_REQUEST_REJECTED)
      this.quic.streamStopSending(id, H3_REQUEST_REJECTED)
      this.flags[k] = H3_FLAG_SEND_DONE
      this.phase[k] = H3_PHASE_DISCARD
      this.rejected = http3Count(this.rejected)
      return
    }
    this.flags[k] = H3_FLAG_COUNTED
    this.live = this.live + 1
  }

  /** One of this side's own streams has news: the client may not stop it (§6.2.1, RFC 9204 §4.2). */
  ownStream(k: i32): i32 {
    const stream: QuicStream = this.quic.streams.slots[k]
    if (stream.stopCode >= 0) {
      return this.fail(H3_CLOSED_CRITICAL_STREAM)
    }
    return H3_NEED_MORE
  }

  /** Lets a slot's request count as finished once both of its sides are done. */
  settle(k: i32): void {
    const done: i32 = H3_FLAG_SEND_DONE | H3_FLAG_RECV_DONE | H3_FLAG_COUNTED
    if ((this.flags[k] & done) === done) {
      this.flags[k] = this.flags[k] & ~H3_FLAG_COUNTED
      this.live = this.live - 1
    }
  }

  /** Marks flags on slot `k` and settles it. */
  mark(k: i32, bits: i32): void {
    this.flags[k] = this.flags[k] | bits
    this.settle(k)
  }

  /**
   * Reads a frame header of stream `id` a byte at a time into slot `k`'s
   * `head`, so a header split across STREAM frames costs nothing to keep.
   * Answers 1 with `header` filled, 0 when more is needed, or the
   * `QUIC_STREAM_*` answer that ended the read.
   */
  readHeader(k: i32, id: i64): i32 {
    const base: i32 = k * H3_HEAD
    while (this.headLen[k] < H3_HEAD) {
      const n: i32 = this.quic.streamRead(id, this.head, base + this.headLen[k], H3_ONE)
      if (n !== 1) {
        return n
      }
      this.headLen[k] = this.headLen[k] + 1
      if (h3ReadFrameHeader(this.header, this.head, base, this.headLen[k]) > 0) {
        this.headLen[k] = 0
        return 1
      }
    }
    return H3_ZERO
  }

  // ---- Unidirectional streams ------------------------------------------------------

  /** The next event of the client's unidirectional stream `id` in slot `k`. */
  uniStep(k: i32, id: i64): i32 {
    while (this.state !== H3_STATE_FAILED) {
      const phase: i32 = this.phase[k]
      if (phase === H3_PHASE_UNI_TYPE) {
        const base: i32 = k * H3_HEAD
        const n: i32 = this.quic.streamRead(id, this.head, base + this.headLen[k], H3_ONE)
        if (n !== 1) {
          // §6.2: a stream may end or be reset before its type; nothing is owed.
          if (n < 0) {
            this.phase[k] = H3_PHASE_DONE
          }
          return H3_NEED_MORE
        }
        this.headLen[k] = this.headLen[k] + 1
        const type: i64 = h3ReadVarint(this.head, base, base + this.headLen[k])
        if (type >= 0) {
          this.headLen[k] = 0
          const event: i32 = this.typed(k, id, type)
          if (event !== H3_NEED_MORE) {
            return event
          }
        }
      } else if (phase === H3_PHASE_CONTROL) {
        return this.controlStep(k, id)
      } else if (phase === H3_PHASE_ENCODER || phase === H3_PHASE_DECODER) {
        const n: i32 = this.quic.streamRead(id, this.data, H3_ZERO, toI32(this.data.length))
        if (n === 0) {
          return H3_NEED_MORE
        }
        if (n < 0) {
          return this.fail(H3_CLOSED_CRITICAL_STREAM)
        }
        const result: i64 =
          phase === H3_PHASE_ENCODER
            ? this.decoder.receiveEncoderStream(this.data, H3_ZERO, n)
            : this.encoder.receiveDecoderStream(this.data, H3_ZERO, n)
        if (result !== QPACK_OK) {
          return this.fail(result)
        }
      } else if (phase === H3_PHASE_DISCARD) {
        return this.discard(k, id)
      } else {
        return H3_NEED_MORE
      }
    }
    return H3_ERROR
  }

  /** The client's unidirectional stream `id` turned out to be of `type` (§6.2). */
  typed(k: i32, id: i64, type: i64): i32 {
    if (type === H3_STREAM_CONTROL) {
      if (this.peerControl >= 0) {
        return this.fail(H3_STREAM_CREATION_ERROR)
      }
      this.peerControl = id
      this.phase[k] = H3_PHASE_CONTROL
      return H3_NEED_MORE
    }
    if (type === H3_STREAM_QPACK_ENCODER) {
      if (this.peerEncoder >= 0) {
        return this.fail(H3_STREAM_CREATION_ERROR)
      }
      this.peerEncoder = id
      this.phase[k] = H3_PHASE_ENCODER
      return H3_NEED_MORE
    }
    if (type === H3_STREAM_QPACK_DECODER) {
      if (this.peerDecoder >= 0) {
        return this.fail(H3_STREAM_CREATION_ERROR)
      }
      this.peerDecoder = id
      this.phase[k] = H3_PHASE_DECODER
      return H3_NEED_MORE
    }
    if (type === H3_STREAM_PUSH) {
      // §6.2.2: only a server pushes.
      return this.fail(H3_STREAM_CREATION_ERROR)
    }
    // §6.2: a type this side does not know is read and dropped, and its sender asked to stop.
    this.quic.streamStopSending(id, H3_STREAM_CREATION_ERROR)
    this.phase[k] = H3_PHASE_DISCARD
    return H3_NEED_MORE
  }

  /** Frames on the client's control stream (§6.2.1, §7.2). */
  controlStep(k: i32, id: i64): i32 {
    while (this.state !== H3_STATE_FAILED) {
      if (this.frameLeft[k] < 0) {
        const got: i32 = this.readHeader(k, id)
        if (got === 0) {
          return H3_NEED_MORE
        }
        if (got < 0) {
          return this.fail(H3_CLOSED_CRITICAL_STREAM)
        }
        const type: i64 = this.header.type
        const length: i64 = this.header.length
        if (!this.settingsSeen && type !== H3_FRAME_SETTINGS) {
          return this.fail(H3_MISSING_SETTINGS)
        }
        if (
          type === H3_FRAME_DATA ||
          type === H3_FRAME_HEADERS ||
          type === H3_FRAME_PUSH_PROMISE ||
          h3ReservedHttp2Frame(type) ||
          (type === H3_FRAME_SETTINGS && this.settingsSeen)
        ) {
          return this.fail(H3_FRAME_UNEXPECTED)
        }
        const whole: boolean =
          type === H3_FRAME_SETTINGS ||
          type === H3_FRAME_GOAWAY ||
          type === H3_FRAME_MAX_PUSH_ID ||
          type === H3_FRAME_CANCEL_PUSH
        if (whole && length > toI64(H3_CONTROL_FRAME_MAX)) {
          return this.fail(type === H3_FRAME_SETTINGS ? H3_EXCESSIVE_LOAD : H3_FRAME_ERROR)
        }
        this.frameType[k] = whole ? type : H3_SKIP_TYPE
        this.frameLeft[k] = length
        this.controlFill = 0
      }
      if (this.frameLeft[k] > 0) {
        const into: u8[] = this.frameType[k] === H3_SKIP_TYPE ? this.data : this.control
        const at: i32 = this.frameType[k] === H3_SKIP_TYPE ? H3_ZERO : this.controlFill
        const want: i32 = toI32(http3Min(this.frameLeft[k], toI64(toI32(into.length) - at)))
        const n: i32 = this.quic.streamRead(id, into, at, want)
        if (n === 0) {
          return H3_NEED_MORE
        }
        if (n < 0) {
          return this.fail(H3_CLOSED_CRITICAL_STREAM)
        }
        this.frameLeft[k] = this.frameLeft[k] - toI64(n)
        if (this.frameType[k] !== H3_SKIP_TYPE) {
          this.controlFill = this.controlFill + n
        }
      }
      if (this.frameLeft[k] === 0) {
        this.frameLeft[k] = -1
        const event: i32 = this.controlFrame(this.frameType[k])
        if (event !== H3_NEED_MORE) {
          return event
        }
      }
    }
    return H3_ERROR
  }

  /** Acts on a whole control frame of `type` in `control[0 .. controlFill)`. */
  controlFrame(type: i64): i32 {
    if (type === H3_FRAME_SETTINGS) {
      const result: i64 = h3ReadSettings(this.peer, this.control, H3_ZERO, this.controlFill)
      if (result !== H3_SETTINGS_OK) {
        return this.fail(result)
      }
      this.settingsSeen = true
      return H3_NEED_MORE
    }
    if (type === H3_SKIP_TYPE) {
      return H3_NEED_MORE
    }
    const value: i64 = h3ReadIdPayload(this.control, H3_ZERO, this.controlFill)
    if (value < 0) {
      return this.fail(H3_FRAME_ERROR)
    }
    if (type === H3_FRAME_GOAWAY) {
      // §5.2: a client's GOAWAY names a push ID, which may only fall.
      if (this.peerGoaway >= 0 && value > this.peerGoaway) {
        return this.fail(H3_ID_ERROR)
      }
      this.peerGoaway = value
      this.lastStreamId = value
      return H3_GOAWAY
    }
    if (type === H3_FRAME_MAX_PUSH_ID) {
      // §7.2.7: it may not fall. This side never pushes, so that is all it means.
      if (value < this.maxPushId) {
        return this.fail(H3_ID_ERROR)
      }
      this.maxPushId = value
      return H3_NEED_MORE
    }
    // CANCEL_PUSH (§7.2.3): no push was ever promised, so only one past the
    // push IDs allowed is an error; any other is a no-op.
    return value > this.maxPushId ? this.fail(H3_ID_ERROR) : H3_NEED_MORE
  }

  /** Reads and drops what is left of stream `id`, slot `k`, to its end or reset. */
  discard(k: i32, id: i64): i32 {
    const n: i32 = this.drop(id)
    if (n < 0) {
      this.phase[k] = H3_PHASE_DONE
      this.mark(k, H3_FLAG_RECV_DONE)
    }
    return this.writable(k, id)
  }

  /** Reads stream `id` into `data` until nothing more is there; answers 0, or the `QUIC_STREAM_*` that ended it. */
  drop(id: i64): i32 {
    let n: i32 = this.quic.streamRead(id, this.data, H3_ZERO, toI32(this.data.length))
    while (n > 0) {
      n = this.quic.streamRead(id, this.data, H3_ZERO, toI32(this.data.length))
    }
    return n
  }

  // ---- Request streams ------------------------------------------------------------

  /** The next event of request stream `id` in slot `k`. */
  requestStep(k: i32, id: i64): i32 {
    const stream: QuicStream = this.quic.streams.slots[k]
    while (this.state !== H3_STATE_FAILED) {
      const phase: i32 = this.phase[k]
      if (stream.stopCode >= 0 && (this.flags[k] & H3_FLAG_STOP_NOTED) === 0) {
        // The client stopped the response (QUIC answered with RESET_STREAM, §3.5 of RFC 9000).
        const told: boolean = (this.flags[k] & (H3_FLAG_DELIVERED | H3_FLAG_SEND_DONE)) === H3_FLAG_DELIVERED
        this.flags[k] = this.flags[k] | H3_FLAG_STOP_NOTED
        this.mark(k, H3_FLAG_SEND_DONE)
        if (told) {
          if (phase !== H3_PHASE_DONE) {
            this.phase[k] = H3_PHASE_DISCARD
          }
          return this.resetEvent(id, stream.stopCode, true)
        }
      }
      if (phase === H3_PHASE_DONE) {
        return this.writable(k, id)
      }
      if (phase === H3_PHASE_DISCARD) {
        return this.discard(k, id)
      }
      if (this.frameLeft[k] < 0) {
        const event: i32 = this.requestFrame(k, id)
        if (event === H3_CONTINUE) {
          continue
        }
        if (event !== H3_NEED_MORE) {
          return event
        }
        // The header is not all in yet, unless the stream moved on to another phase.
        if (this.phase[k] === phase) {
          return this.writable(k, id)
        }
        continue
      }
      const type: i64 = this.frameType[k]
      if (type === H3_FRAME_HEADERS) {
        // A field section is decoded whole: wait until all of it is in.
        if (stream.resetCode < 0 && stream.readable() < this.frameLeft[k]) {
          if (stream.recvFinal >= 0 && stream.recvRead + this.frameLeft[k] > stream.recvFinal) {
            return this.fail(H3_FRAME_ERROR)
          }
          return this.writable(k, id)
        }
        const length: i32 = toI32(this.frameLeft[k])
        const n: i32 = this.quic.streamRead(id, this.section, H3_ZERO, length)
        if (n < 0) {
          return this.ended(k, id, n, stream.resetCode)
        }
        if (n !== length) {
          return this.writable(k, id)
        }
        this.frameLeft[k] = -1
        const event: i32 = this.fieldSection(k, id, length)
        if (event !== H3_NEED_MORE) {
          return event
        }
        continue
      }
      // DATA, a payload being skipped, or an unknown frame's.
      const want: i32 = toI32(http3Min(this.frameLeft[k], toI64(toI32(this.data.length))))
      const resetCode: i64 = stream.resetCode
      const n: i32 = this.quic.streamRead(id, this.data, H3_ZERO, want)
      if (n === 0) {
        return this.writable(k, id)
      }
      if (n < 0) {
        return n === QUIC_STREAM_END ? this.fail(H3_FRAME_ERROR) : this.ended(k, id, n, resetCode)
      }
      this.frameLeft[k] = this.frameLeft[k] - toI64(n)
      if (type === H3_FRAME_DATA) {
        if (this.frameLeft[k] === 0) {
          this.frameLeft[k] = -1
        }
        this.dataTotal[k] = this.dataTotal[k] + toI64(n)
        if (this.contentLength[k] >= 0 && this.dataTotal[k] > this.contentLength[k]) {
          return this.streamError(k, id, H3_MESSAGE_ERROR)
        }
        this.stream = id
        this.dataStart = 0
        this.dataLength = n
        return H3_DATA
      }
      if (this.frameLeft[k] === 0) {
        this.frameLeft[k] = -1
        if (this.phase[k] === H3_PHASE_SKIP) {
          return this.answerTooLarge(k, id)
        }
      }
    }
    return H3_ERROR
  }

  /**
   * Reads the next frame header of request stream `id` and decides what its
   * payload is (§4.1, §7.2): DATA after HEADERS, HEADERS first or as
   * trailers, and anything else unknown and skipped, or refused where
   * RFC 9114 says so. A stream that ends here ends the request.
   */
  requestFrame(k: i32, id: i64): i32 {
    const stream: QuicStream = this.quic.streams.slots[k]
    const resetCode: i64 = stream.resetCode
    const got: i32 = this.readHeader(k, id)
    if (got === 0) {
      return H3_NEED_MORE
    }
    if (got < 0) {
      if (got === QUIC_STREAM_END && this.headLen[k] > 0) {
        return this.fail(H3_FRAME_ERROR)
      }
      return this.ended(k, id, got, resetCode)
    }
    const type: i64 = this.header.type
    const length: i64 = this.header.length
    const phase: i32 = this.phase[k]
    if (type === H3_FRAME_DATA) {
      if (phase !== H3_PHASE_BODY) {
        return this.fail(H3_FRAME_UNEXPECTED)
      }
      this.frameType[k] = type
      this.frameLeft[k] = length > 0 ? length : -1
      return H3_CONTINUE
    }
    if (type === H3_FRAME_HEADERS) {
      if (phase === H3_PHASE_TRAILED) {
        return this.fail(H3_FRAME_UNEXPECTED)
      }
      if (length > toI64(this.config.maxFieldSectionSize)) {
        if (phase === H3_PHASE_HEADERS) {
          // §4.2.2: the section is skipped and answered with a 431.
          this.phase[k] = H3_PHASE_SKIP
          this.frameType[k] = H3_SKIP_TYPE
          this.frameLeft[k] = length
          return H3_CONTINUE
        }
        return this.streamError(k, id, H3_EXCESSIVE_LOAD)
      }
      this.frameType[k] = type
      this.frameLeft[k] = length
      if (length === 0) {
        // An empty section has no prefix, which QPACK refuses.
        this.frameLeft[k] = -1
        return this.fieldSection(k, id, H3_ZERO)
      }
      return H3_CONTINUE
    }
    if (
      type === H3_FRAME_SETTINGS ||
      type === H3_FRAME_GOAWAY ||
      type === H3_FRAME_MAX_PUSH_ID ||
      type === H3_FRAME_CANCEL_PUSH ||
      type === H3_FRAME_PUSH_PROMISE ||
      h3ReservedHttp2Frame(type)
    ) {
      return this.fail(H3_FRAME_UNEXPECTED)
    }
    // §9: an unknown frame type is skipped, wherever it comes.
    this.frameType[k] = H3_SKIP_TYPE
    this.frameLeft[k] = length > 0 ? length : -1
    return H3_CONTINUE
  }

  /**
   * A whole HEADERS payload of `length` bytes is in `section`: the request's
   * field section, or its trailers. Decodes it, copies it into `fields` and
   * checks it there.
   */
  fieldSection(k: i32, id: i64, length: i32): i32 {
    const result: i64 = this.decoder.decode(this.section, H3_ZERO, length)
    const first: boolean = this.phase[k] === H3_PHASE_HEADERS
    if (result === QPACK_SECTION_TOO_LARGE) {
      return first ? this.answerTooLarge(k, id) : this.streamError(k, id, H3_EXCESSIVE_LOAD)
    }
    if (result !== QPACK_OK) {
      return this.fail(result)
    }
    this.copyFields()
    if (!first) {
      if (this.fields.readTrailers(this.nameList, this.valueList) !== HTTP_FIELDS_OK) {
        return this.streamError(k, id, H3_MESSAGE_ERROR)
      }
      this.phase[k] = H3_PHASE_TRAILED
      this.stream = id
      return H3_TRAILERS
    }
    if (
      this.fields.readRequest(this.nameList, this.valueList, this.config.extendedConnect) !== HTTP_FIELDS_OK
    ) {
      return this.streamError(k, id, H3_MESSAGE_ERROR)
    }
    // TODO(WP34 R2): an extended CONNECT (`fields.protocol`) becomes a WebTransport session here.
    this.contentLength[k] = this.fields.contentLength
    this.phase[k] = H3_PHASE_BODY
    this.flags[k] = this.flags[k] | H3_FLAG_DELIVERED
    this.stream = id
    return H3_REQUEST
  }

  /** Copies the decoder's fields into the connection's own arrays and the lists `fields` reads. */
  copyFields(): void {
    const d: QpackDecoder = this.decoder
    while (toI32(this.nameList.length) > 0) {
      this.nameList.pop()
    }
    while (toI32(this.valueList.length) > 0) {
      this.valueList.pop()
    }
    for (let i: i32 = 0; i < d.count; i++) {
      if (i >= toI32(this.names.length)) {
        const freshName: u8[] = []
        const freshValue: u8[] = []
        this.names.push(freshName)
        this.values.push(freshValue)
      }
      const name: u8[] = this.names[i]
      const value: u8[] = this.values[i]
      http3Empty(name)
      http3Empty(value)
      const ns: i32 = d.nameStart[i]
      const nl: i32 = d.nameLength[i]
      for (let j: i32 = ns; j < ns + nl && j >= 0 && j < toI32(d.bytes.length); j++) {
        name.push(d.bytes[j])
      }
      const vs: i32 = d.valueStart[i]
      const vl: i32 = d.valueLength[i]
      for (let j: i32 = vs; j < vs + vl && j >= 0 && j < toI32(d.bytes.length); j++) {
        value.push(d.bytes[j])
      }
      this.nameList.push(name)
      this.valueList.push(value)
    }
  }

  /**
   * The request stream ended, cleanly (`n` is `QUIC_STREAM_END`) or by the
   * client's RESET_STREAM with `resetCode`, at a frame boundary.
   */
  ended(k: i32, id: i64, n: i32, resetCode: i64): i32 {
    const phase: i32 = this.phase[k]
    this.phase[k] = H3_PHASE_DONE
    this.mark(k, H3_FLAG_RECV_DONE)
    const delivered: boolean = (this.flags[k] & H3_FLAG_DELIVERED) !== 0
    if (n === QUIC_STREAM_ERR_RESET) {
      // §4.1.1: a response to a request that will not finish is abandoned too.
      this.abandon(k, id, resetCode === H3_REQUEST_CANCELLED ? H3_REQUEST_CANCELLED : H3_REQUEST_INCOMPLETE)
      return delivered ? this.resetEvent(id, resetCode, true) : H3_NEED_MORE
    }
    if (n !== QUIC_STREAM_END) {
      return H3_NEED_MORE
    }
    if (phase === H3_PHASE_HEADERS || phase === H3_PHASE_SKIP) {
      // §4.1.1: the stream ended before a whole request.
      this.abandon(k, id, H3_REQUEST_INCOMPLETE)
      this.streamErrors = http3Count(this.streamErrors)
      return H3_NEED_MORE
    }
    if (this.contentLength[k] >= 0 && this.dataTotal[k] !== this.contentLength[k]) {
      // §4.1.2: the body is shorter than its content-length.
      this.abandon(k, id, H3_MESSAGE_ERROR)
      this.streamErrors = http3Count(this.streamErrors)
      return this.resetEvent(id, H3_MESSAGE_ERROR, false)
    }
    this.stream = id
    return H3_END
  }

  /** Resets this side's half of request stream `id` with `code`, unless it is done already. */
  abandon(k: i32, id: i64, code: i64): void {
    if ((this.flags[k] & H3_FLAG_SEND_DONE) === 0) {
      this.quic.streamReset(id, code)
    }
    this.mark(k, H3_FLAG_SEND_DONE)
  }

  /** A stream error (§8): the request is reset both ways with `code`, and the program told when it knew the request. */
  streamError(k: i32, id: i64, code: i64): i32 {
    this.streamErrors = http3Count(this.streamErrors)
    this.abandon(k, id, code)
    this.quic.streamStopSending(id, code)
    this.phase[k] = H3_PHASE_DISCARD
    if ((this.flags[k] & H3_FLAG_DELIVERED) !== 0) {
      return this.resetEvent(id, code, false)
    }
    return H3_NEED_MORE
  }

  /** H3_RESET for `id` with `code`. */
  resetEvent(id: i64, code: i64, byPeer: boolean): i32 {
    this.stream = id
    this.errorCode = code
    this.resetByPeer = byPeer
    return H3_RESET
  }

  /**
   * A request whose field section is past `maxFieldSectionSize`: answered
   * with a 431 and its stream asked to stop with H3_NO_ERROR (§4.2.2,
   * §4.1.2). The program never sees it.
   */
  answerTooLarge(k: i32, id: i64): i32 {
    this.tooLarge = http3Count(this.tooLarge)
    const empty: u8[][] = this.nameList
    while (toI32(empty.length) > 0) {
      empty.pop()
    }
    if (this.writeHead(k, id, H3_STATUS_TOO_LARGE, empty, empty, true, true) !== 0) {
      this.abandon(k, id, H3_EXCESSIVE_LOAD)
    }
    this.quic.streamStopSending(id, H3_NO_ERROR)
    this.phase[k] = H3_PHASE_DISCARD
    return H3_NEED_MORE
  }

  /**
   * The stream's write side, when a write was held back: owed bytes are
   * written, and once the buffer has room again the program is told with
   * H3_WRITABLE. Answers that, or H3_NEED_MORE.
   */
  writable(k: i32, id: i64): i32 {
    if ((this.flags[k] & H3_FLAG_BLOCKED) === 0 || (this.flags[k] & H3_FLAG_SEND_DONE) !== 0) {
      return H3_NEED_MORE
    }
    if (!this.drain(k, id) || this.quic.streams.slots[k].room() <= 0) {
      return H3_NEED_MORE
    }
    this.flags[k] = this.flags[k] & ~H3_FLAG_BLOCKED
    this.stream = id
    return H3_WRITABLE
  }

  // ---- Writing ----------------------------------------------------------------------

  /** The slot of request stream `id` when the program may write to it, else -1. */
  writeSlot(id: i64): i32 {
    if (this.state === H3_STATE_FAILED || !http3IsRequest(id)) {
      return -1
    }
    const k: i32 = this.quic.streams.slotOf(id)
    if (k < 0 || k >= toI32(this.slotId.length) || this.slotId[k] !== id) {
      return -1
    }
    const flags: i32 = this.flags[k]
    if ((flags & H3_FLAG_DELIVERED) === 0 || (flags & H3_FLAG_SEND_DONE) !== 0) {
      return -1
    }
    return this.quic.streams.slots[k].stopCode >= 0 ? -1 : k
  }

  /**
   * Writes the bytes owed on stream `id` before anything else — the rest of
   * a frame header, a filler's payload — as far as the send buffer takes
   * them. Answers whether none are owed now.
   */
  drain(k: i32, id: i64): boolean {
    const base: i32 = k * H3_HEAD
    while (this.pendLen[k] > 0) {
      const n: i32 = this.quic.streamWrite(id, this.pend, base + this.pendAt[k], this.pendLen[k], false)
      if (n <= 0) {
        return false
      }
      this.pendAt[k] = this.pendAt[k] + n
      this.pendLen[k] = this.pendLen[k] - n
    }
    while (this.fillLeft[k] > 0) {
      const want: i32 = toI32(http3Min(this.fillLeft[k], toI64(toI32(this.zeros.length))))
      const n: i32 = this.quic.streamWrite(id, this.zeros, H3_ZERO, want, false)
      if (n <= 0) {
        return false
      }
      this.fillLeft[k] = this.fillLeft[k] - toI64(n)
    }
    return true
  }

  /** Queues `buf[0 .. n)`, a frame header, as the bytes owed first on slot `k`. */
  owe(k: i32, buf: u8[], n: i32): void {
    const base: i32 = k * H3_HEAD
    for (let j: i32 = 0; j < n && j < H3_HEAD && j < toI32(buf.length); j++) {
      this.pend[base + j] = buf[j]
    }
    this.pendAt[k] = 0
    this.pendLen[k] = n < H3_HEAD ? n : H3_HEAD
  }

  /**
   * A frame of `need` bytes must go whole and the send buffer has less room:
   * the room left is filled with a reserved frame the client skips (§7.2.8),
   * so that QUIC names the stream again once acknowledgements free room.
   */
  arm(k: i32, id: i64): void {
    const room: i64 = this.quic.streams.slots[k].room()
    this.mark(k, H3_FLAG_BLOCKED)
    if (room <= 0) {
      // Nothing fits: a write that takes nothing asks QUIC for the event.
      this.quic.streamWrite(id, this.zeros, H3_ZERO, H3_ONE, false)
      return
    }
    let payload: i64 = room - 2
    if (room > 65) {
      payload = room - 3
    }
    if (room > 16386) {
      payload = room - 5
    }
    if (payload < 0) {
      payload = 0
    }
    const n: i32 = h3PutFrameHeader(
      this.scratch,
      H3_ZERO,
      toI32(this.scratch.length),
      toI64(H3_FILLER_TYPE),
      payload
    )
    this.owe(k, this.scratch, n)
    this.fillLeft[k] = payload
    if (this.drain(k, id)) {
      this.quic.streamWrite(id, this.zeros, H3_ZERO, H3_ONE, false)
    }
  }

  /**
   * Encodes `:status` (when `withStatus`) and `names`/`values` into a HEADERS
   * frame and writes it whole to stream `id`, with the FIN when `fin`.
   * Answers 0, H3_AGAIN, or H3_TOO_LARGE.
   */
  writeHead(
    k: i32,
    id: i64,
    status: i32,
    names: u8[][],
    values: u8[][],
    fin: boolean,
    withStatus: boolean
  ): i32 {
    const out: u8[] = this.encoded
    http3Empty(out)
    this.encoder.beginSection(out)
    let size: i64 = 0
    if (withStatus) {
      const ten: i32 = 10
      this.statusValue[0] = toU8(H3_DIGIT_ZERO + status / (ten * ten))
      this.statusValue[1] = toU8(H3_DIGIT_ZERO + ((status / ten) % ten))
      this.statusValue[2] = toU8(H3_DIGIT_ZERO + (status % ten))
      const nameLength: i32 = toI32(this.statusName.length)
      const valueLength: i32 = toI32(this.statusValue.length)
      this.encoder.encodeField(out, this.statusName, H3_ZERO, nameLength, this.statusValue, H3_ZERO, valueLength, false, true)
      size = toI64(nameLength + valueLength + QPACK_FIELD_OVERHEAD)
    }
    const n: i32 = toI32(names.length)
    for (let j: i32 = 0; j < n && j < toI32(names.length) && j < toI32(values.length); j++) {
      const name: u8[] = names[j]
      const value: u8[] = values[j]
      const nl: i32 = toI32(name.length)
      const vl: i32 = toI32(value.length)
      this.encoder.encodeField(out, name, H3_ZERO, nl, value, H3_ZERO, vl, httpFieldSensitive(name), true)
      size = size + toI64(nl + vl + QPACK_FIELD_OVERHEAD)
    }
    const limit: i64 = this.peer.maxFieldSectionSize
    const length: i64 = toI64(toI32(out.length))
    const total: i64 = toI64(h3FrameHeaderSize(H3_FRAME_HEADERS, length)) + length
    if ((limit >= 0 && size > limit) || total > toI64(this.quic.streams.bufferSize)) {
      return H3_TOO_LARGE
    }
    if (!this.drain(k, id)) {
      this.mark(k, H3_FLAG_BLOCKED)
      return H3_AGAIN
    }
    if (this.quic.streams.slots[k].room() < total) {
      this.arm(k, id)
      return H3_AGAIN
    }
    const hp: i32 = h3PutFrameHeader(
      this.scratch,
      H3_ZERO,
      toI32(this.scratch.length),
      H3_FRAME_HEADERS,
      length
    )
    this.quic.streamWrite(id, this.scratch, H3_ZERO, hp, false)
    this.quic.streamWrite(id, out, H3_ZERO, toI32(length), fin)
    this.flags[k] = this.flags[k] | H3_FLAG_HEADERS_SENT
    if (fin) {
      this.mark(k, H3_FLAG_SEND_DONE)
    }
    return 0
  }

  /**
   * Sends the response head on request stream `id`: `status` (200 to 599)
   * and the fields `names`/`values` (lowercase names, no pseudo-headers),
   * ending the stream when `endStream`. Answers 0; H3_CLOSED for a stream
   * that is not an open request; H3_INVALID for a second head, a status out
   * of range or a field `httpFieldsCheckOutgoing` refuses; H3_TOO_LARGE for a
   * section past the client's SETTINGS_MAX_FIELD_SECTION_SIZE; or H3_AGAIN.
   */
  respond(id: i64, status: i32, names: u8[][], values: u8[][], endStream: boolean): i32 {
    const k: i32 = this.writeSlot(id)
    if (k < 0) {
      return H3_CLOSED
    }
    if (
      (this.flags[k] & H3_FLAG_HEADERS_SENT) !== 0 ||
      status < 200 ||
      status > 599 ||
      httpFieldsCheckOutgoing(names, values) !== HTTP_FIELDS_OK
    ) {
      return H3_INVALID
    }
    return this.writeHead(k, id, status, names, values, endStream, true)
  }

  /**
   * Writes a trailer section on request stream `id` after its body, which
   * ends the stream. Answers as `respond` does; H3_INVALID before the head
   * or inside a DATA frame `writeData` has not finished.
   */
  writeTrailers(id: i64, names: u8[][], values: u8[][]): i32 {
    const k: i32 = this.writeSlot(id)
    if (k < 0) {
      return H3_CLOSED
    }
    if (
      (this.flags[k] & H3_FLAG_HEADERS_SENT) === 0 ||
      this.dataLeft[k] > 0 ||
      httpFieldsCheckOutgoing(names, values) !== HTTP_FIELDS_OK
    ) {
      return H3_INVALID
    }
    return this.writeHead(k, id, H3_ZERO, names, values, true, false)
  }

  /**
   * Writes up to `len` bytes of `buf` from `off` as the response body of
   * stream `id`, in DATA frames of at most `writeChunk`, and ends the stream
   * when `endStream` and every byte was taken. Answers how many bytes it
   * took — fewer than `len` when the send buffer filled, and H3_WRITABLE
   * then names the stream when it has room — or H3_AGAIN when it took none;
   * H3_CLOSED, or H3_INVALID before the head or when `endStream` would cut
   * short the DATA frame the last call started.
   */
  writeData(id: i64, buf: u8[], off: i32, len: i32, endStream: boolean): i32 {
    http3CheckWindow("Http3Connection.writeData", buf, off, len)
    const k: i32 = this.writeSlot(id)
    if (k < 0) {
      return H3_CLOSED
    }
    if ((this.flags[k] & H3_FLAG_HEADERS_SENT) === 0 || (endStream && toI64(len) < this.dataLeft[k])) {
      return H3_INVALID
    }
    if (!this.drain(k, id)) {
      this.mark(k, H3_FLAG_BLOCKED)
      return H3_AGAIN
    }
    if (this.dataLeft[k] === 0) {
      if (len === 0) {
        if (endStream) {
          this.quic.streamWrite(id, this.zeros, H3_ZERO, H3_ZERO, true)
          this.mark(k, H3_FLAG_SEND_DONE)
        }
        return 0
      }
      const frame: i64 = toI64(len < this.config.writeChunk ? len : this.config.writeChunk)
      const n: i32 = h3PutFrameHeader(this.scratch, H3_ZERO, toI32(this.scratch.length), H3_FRAME_DATA, frame)
      this.owe(k, this.scratch, n)
      this.dataLeft[k] = frame
      if (!this.drain(k, id)) {
        this.mark(k, H3_FLAG_BLOCKED)
        return H3_AGAIN
      }
    }
    const take: i32 = toI32(http3Min(toI64(len), this.dataLeft[k]))
    const fin: boolean = endStream && take === len && toI64(take) === this.dataLeft[k]
    const n: i32 = this.quic.streamWrite(id, buf, off, take, fin)
    if (n < 0) {
      return H3_CLOSED
    }
    this.dataLeft[k] = this.dataLeft[k] - toI64(n)
    if (n < take) {
      this.mark(k, H3_FLAG_BLOCKED)
    }
    if (fin && n === take) {
      this.mark(k, H3_FLAG_SEND_DONE)
    }
    return n > 0 || take === 0 ? n : H3_AGAIN
  }

  /**
   * Resets request stream `id` both ways with `code` — H3_REQUEST_CANCELLED,
   * or H3_REQUEST_REJECTED for one the program did not process (§4.1.1).
   * Answers 0 or H3_CLOSED.
   */
  reset(id: i64, code: i64): i32 {
    const k: i32 = this.writeSlot(id)
    if (k < 0) {
      return H3_CLOSED
    }
    this.abandon(k, id, code)
    if (this.phase[k] !== H3_PHASE_DONE) {
      this.quic.streamStopSending(id, code)
      this.phase[k] = H3_PHASE_DISCARD
    }
    return 0
  }

  /**
   * Sends GOAWAY (§5.2): the client's requests on streams below the ID it
   * names — every stream the client has opened so far — are processed, and
   * any it opens from there on is refused with H3_REQUEST_REJECTED. A second
   * call never raises the ID. Answers 0, or H3_AGAIN before this side's
   * control stream is open.
   */
  goaway(): i32 {
    if (this.ownControl < 0 || this.state === H3_STATE_FAILED) {
      return H3_AGAIN
    }
    let id: i64 = this.quic.streams.peerBidiOpened << 2
    if (this.goawayId >= 0 && id > this.goawayId) {
      id = this.goawayId
    }
    const n: i32 = h3PutIdFrame(this.scratch, H3_ZERO, toI32(this.scratch.length), H3_FRAME_GOAWAY, id)
    if (this.quic.streamWrite(this.ownControl, this.scratch, H3_ZERO, n, false) !== n) {
      return H3_AGAIN
    }
    this.goawayId = id
    return 0
  }
}
