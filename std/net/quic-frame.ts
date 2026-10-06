/**
 * `nish/net/quic-frame` — the frames of QUIC version 1 (RFC 9000 §19) and
 * RFC 9221's DATAGRAM, read from a decrypted packet payload and written into
 * one, and the transport error codes a connection closes with (§20.1).
 *
 *     import { QuicFrame, quicParseFrame, quicPushAck, QUIC_FRAME_CRYPTO } from "nish/net/quic-frame";
 *
 *     const frame = new QuicFrame();                       // one per connection, reused
 *     let at: i32 = 0;
 *     while (at < toI32(payload.length)) {
 *       const error: i64 = quicParseFrame(frame, payload, at, toI32(payload.length));
 *       if (error !== 0) { … close the connection with `error` … }
 *       if (frame.type === QUIC_FRAME_CRYPTO) { … payload[frame.dataStart .. + frame.dataLength) … }
 *       at = frame.end;
 *     }
 *
 * **Every frame type of RFC 9000 is read**, 0x00 to 0x1e, and RFC 9221's
 * DATAGRAM, 0x30 and 0x31, so a type outside those is the one parse error a
 * well-formed packet cannot produce. What
 * a frame *means* is `nish/net/quic`'s: this module checks only what §19 says
 * of the encoding itself, and answers the transport error the RFC names for
 * each break — `QUIC_ERROR_FRAME_ENCODING` for a truncated field, a length
 * past the packet, an ACK range below packet number zero, an offset past
 * 2^62 − 1, a stream count past 2^60, an empty NEW_TOKEN, a connection ID
 * outside 1 to 20 bytes or a Retire Prior To above its own sequence number;
 * `QUIC_ERROR_PROTOCOL_VIOLATION` for a frame type spelled in more bytes than
 * it needs (§12.4). Every read is bounds-checked against the window the caller
 * gives, so nothing a peer sends can make this module panic.
 *
 * **No copy of the bulk.** A CRYPTO, STREAM or DATAGRAM frame's data, a
 * NEW_TOKEN's token, a PATH_CHALLENGE's eight bytes and a CONNECTION_CLOSE's
 * reason are left in the payload and described by `dataStart` and
 * `dataLength`, and a NEW_CONNECTION_ID's ID and token by windows of their
 * own, so a connection reassembles straight from the packet. One `QuicFrame`
 * is reused for every frame of every packet: `quicParseFrame` overwrites
 * every field it reads and resets the rest, and stores nothing but numbers,
 * so a payload made inside an arena block can be read inside it.
 *
 * **The writers** come in two forms. A `put` writer writes one frame into a
 * caller's buffer at an offset, before an end, and answers the offset past
 * it, or -1 with nothing written; a `push` writer appends one to an array
 * and answers whether it could, by growing the array and calling the `put`
 * form, so each frame has one encoder. Either refuses a value no varint
 * holds or a window outside the array given. Their inputs are this
 * endpoint's own, never a peer's. `quicFrameAllowed` is RFC 9000 §12.4's
 * table of which frames each packet type may carry.
 *
 * Written from RFC 9000 §12.4, §19 and §20 and RFC 9221 §4, in this module's own structure;
 * nothing here is ported from another implementation. Private names carry the
 * `quicFrame` prefix because a `std/` module's private functions share the
 * importing program's flat symbol namespace (`docs/wp26-stdlib.md` §3e).
 */
import {
  QUIC_MAX_CID_LENGTH,
  QUIC_MAX_VARINT,
  QUIC_PACKET_HANDSHAKE,
  QUIC_PACKET_INITIAL,
  QUIC_PACKET_SHORT,
  QUIC_PACKET_ZERO_RTT,
  quicPacketGrow,
  quicVarintLength,
  quicVarintPut,
  quicVarintRead,
  quicVarintSize,
} from "nish/net/quic-packet"

// ---- Frame types (RFC 9000 §19, Table 3 of §12.4) ------------------------------

export const QUIC_FRAME_PADDING: i32 = 0x00
export const QUIC_FRAME_PING: i32 = 0x01
/** ACK without ECN counts. */
export const QUIC_FRAME_ACK: i32 = 0x02
/** ACK with the three ECN counts after the ranges. */
export const QUIC_FRAME_ACK_ECN: i32 = 0x03
export const QUIC_FRAME_RESET_STREAM: i32 = 0x04
export const QUIC_FRAME_STOP_SENDING: i32 = 0x05
export const QUIC_FRAME_CRYPTO: i32 = 0x06
export const QUIC_FRAME_NEW_TOKEN: i32 = 0x07
/**
 * The first of the eight STREAM types, 0x08 to 0x0f. `quicParseFrame` answers
 * every one of them as this type, with the three low bits read into
 * `offset`, `dataLength` and `fin` (§19.8).
 */
export const QUIC_FRAME_STREAM: i32 = 0x08
export const QUIC_FRAME_MAX_DATA: i32 = 0x10
export const QUIC_FRAME_MAX_STREAM_DATA: i32 = 0x11
export const QUIC_FRAME_MAX_STREAMS_BIDI: i32 = 0x12
export const QUIC_FRAME_MAX_STREAMS_UNI: i32 = 0x13
export const QUIC_FRAME_DATA_BLOCKED: i32 = 0x14
export const QUIC_FRAME_STREAM_DATA_BLOCKED: i32 = 0x15
export const QUIC_FRAME_STREAMS_BLOCKED_BIDI: i32 = 0x16
export const QUIC_FRAME_STREAMS_BLOCKED_UNI: i32 = 0x17
export const QUIC_FRAME_NEW_CONNECTION_ID: i32 = 0x18
export const QUIC_FRAME_RETIRE_CONNECTION_ID: i32 = 0x19
export const QUIC_FRAME_PATH_CHALLENGE: i32 = 0x1a
export const QUIC_FRAME_PATH_RESPONSE: i32 = 0x1b
/** CONNECTION_CLOSE with a transport error code and the frame type that caused it. */
export const QUIC_FRAME_CONNECTION_CLOSE: i32 = 0x1c
/** CONNECTION_CLOSE with an application error code, allowed only in 1-RTT packets. */
export const QUIC_FRAME_CONNECTION_CLOSE_APP: i32 = 0x1d
export const QUIC_FRAME_HANDSHAKE_DONE: i32 = 0x1e
/**
 * DATAGRAM (RFC 9221 §4): an unreliable application payload. Type 0x30 runs
 * to the end of the packet and 0x31 carries a Length; `quicParseFrame`
 * answers both as this type, with `fin` set for 0x31 (it had a Length).
 */
export const QUIC_FRAME_DATAGRAM: i32 = 0x30
/** The DATAGRAM type with a Length field (RFC 9221 §4), which `quicPutDatagram` always writes. */
export const QUIC_FRAME_DATAGRAM_LENGTH: i32 = 0x31

// ---- Transport error codes (RFC 9000 §20.1) ------------------------------------

export const QUIC_ERROR_NO_ERROR: i64 = 0x00
export const QUIC_ERROR_INTERNAL: i64 = 0x01
export const QUIC_ERROR_CONNECTION_REFUSED: i64 = 0x02
export const QUIC_ERROR_FLOW_CONTROL: i64 = 0x03
export const QUIC_ERROR_STREAM_LIMIT: i64 = 0x04
export const QUIC_ERROR_STREAM_STATE: i64 = 0x05
export const QUIC_ERROR_FINAL_SIZE: i64 = 0x06
export const QUIC_ERROR_FRAME_ENCODING: i64 = 0x07
export const QUIC_ERROR_TRANSPORT_PARAMETER: i64 = 0x08
export const QUIC_ERROR_CONNECTION_ID_LIMIT: i64 = 0x09
export const QUIC_ERROR_PROTOCOL_VIOLATION: i64 = 0x0a
export const QUIC_ERROR_INVALID_TOKEN: i64 = 0x0b
export const QUIC_ERROR_APPLICATION: i64 = 0x0c
export const QUIC_ERROR_CRYPTO_BUFFER_EXCEEDED: i64 = 0x0d
export const QUIC_ERROR_KEY_UPDATE: i64 = 0x0e
export const QUIC_ERROR_AEAD_LIMIT_REACHED: i64 = 0x0f
export const QUIC_ERROR_NO_VIABLE_PATH: i64 = 0x10
/** CRYPTO_ERROR is this plus the TLS alert description (RFC 9001 §4.8): 0x0100 to 0x01ff. */
export const QUIC_ERROR_CRYPTO: i64 = 0x0100

/**
 * The most ACK ranges a `QuicFrame` keeps. A frame may list more, and every
 * one is still checked; the ones past this are counted in `ackRangeTotal`
 * but not stored. Loss recovery, which would read them, is WP34 Q3.
 */
export const QUIC_FRAME_MAX_ACK_RANGES: i32 = 32

/** A stream count's ceiling, 2^60 (RFC 9000 §4.6, §19.11). Spelled as a product: an `i64` literal past 2^53 is refused. */
const QUIC_FRAME_MAX_STREAMS: i64 = 1073741824 * 1073741824

/** The length of a stateless reset token (RFC 9000 §10.3). */
export const QUIC_RESET_TOKEN_SIZE: i32 = 16

/** The length of a PATH_CHALLENGE's and a PATH_RESPONSE's data (RFC 9000 §19.17). */
export const QUIC_PATH_DATA_SIZE: i32 = 8

/**
 * One frame as `quicParseFrame` read it. Which fields mean something depends
 * on `type`; the rest hold zero, or empty arrays.
 *
 * - ACK and ACK_ECN: `largest`, `ackDelay` (still scaled by the peer's
 *   exponent), the ranges as `[smallest, largest]` pairs from the highest
 *   down in `ackRanges` (`ackRangeCount` pairs stored, `ackRangeTotal` read),
 *   and for ACK_ECN the counts `ect0`, `ect1` and `ce`.
 * - CRYPTO: `offset` and the data `dataStart`, `dataLength`.
 * - STREAM: `streamId`, `offset`, the data, and `fin`.
 * - NEW_TOKEN and PATH_CHALLENGE / PATH_RESPONSE: the token or data.
 * - RESET_STREAM: `streamId`, `errorCode`, the final size in `value`.
 * - STOP_SENDING: `streamId`, `errorCode`.
 * - MAX_DATA, MAX_STREAMS_*, DATA_BLOCKED, STREAMS_BLOCKED_*: `value`.
 * - MAX_STREAM_DATA, STREAM_DATA_BLOCKED: `streamId` and `value`.
 * - NEW_CONNECTION_ID: the sequence number in `value`, `retirePriorTo`,
 *   the ID's window `connectionIdStart` / `connectionIdLength` and the
 *   reset token's `resetTokenStart` (16 bytes) in the payload.
 *   RETIRE_CONNECTION_ID: `value`.
 * - DATAGRAM: the payload as the data, and `fin` when the frame carried a
 *   Length (type 0x31).
 * - CONNECTION_CLOSE: `errorCode`, `frameType` (0x1c only) and the reason
 *   phrase as the data.
 */
export class QuicFrame {
  streamId: i64 = 0
  offset: i64 = 0
  value: i64 = 0
  errorCode: i64 = 0
  frameType: i64 = 0
  retirePriorTo: i64 = 0
  largest: i64 = 0
  ackDelay: i64 = 0
  ackRanges: i64[]
  ackRangeTotal: i64 = 0
  ect0: i64 = 0
  ect1: i64 = 0
  ce: i64 = 0
  /** The frame type, with every STREAM type answered as `QUIC_FRAME_STREAM`. */
  type: i32 = 0
  /** One past the frame's last byte, where the next frame starts. */
  end: i32 = 0
  dataStart: i32 = 0
  dataLength: i32 = 0
  ackRangeCount: i32 = 0
  connectionIdStart: i32 = 0
  connectionIdLength: i32 = 0
  resetTokenStart: i32 = 0
  fin: boolean = false

  constructor() {
    // Sized once, so reading an ACK stores nothing new into the frame.
    this.ackRanges = new Array<i64>(QUIC_FRAME_MAX_ACK_RANGES * 2)
  }
}

/**
 * The cursor `quicParseFrame` reads with: a window of the payload, and
 * `failed` once a read ran past it, after which every read fails too. So a
 * frame's fields are read in order and `failed` tested once. It holds only
 * positions; the payload is passed beside it, so reading a frame stores no
 * pointer to it anywhere and a payload made inside an arena block can be
 * read inside it.
 */
class QuicFrameReader {
  at: i32
  end: i32
  failed: boolean = false

  constructor(at: i32, end: i32) {
    this.at = at
    this.end = end
  }
}

/** The next varint, or 0 and a failed reader when it does not fit in the window. */
const quicFrameVarint = (r: QuicFrameReader, d: u8[]): i64 => {
  if (r.failed) {
    return 0
  }
  const value: i64 = quicVarintRead(d, r.at, r.end)
  if (value < 0) {
    r.failed = true
    return 0
  }
  r.at = r.at + quicVarintLength(d, r.at)
  return value
}

/**
 * Skips `length` bytes, answering where they start; a length past the window
 * fails the reader and answers the current position.
 */
const quicFrameSkip = (r: QuicFrameReader, length: i64): i32 => {
  const at: i32 = r.at
  if (r.failed || length < 0 || length > toI64(r.end - at)) {
    r.failed = true
    return at
  }
  r.at = at + toI32(length)
  return at
}

/** Stores the `index`-th ACK range pair; the caller keeps `index` under `QUIC_FRAME_MAX_ACK_RANGES`. */
const quicFrameStoreRange = (frame: QuicFrame, index: i32, smallest: i64, largest: i64): void => {
  const at: i32 = index * 2
  const ranges: i64[] = frame.ackRanges
  if (at >= 0 && at + 1 < toI32(ranges.length)) {
    ranges[at] = smallest
    ranges[at + 1] = largest
  }
}

/** Resets every field a previous frame may have set, so a reused `QuicFrame` holds only this one. */
const quicFrameReset = (frame: QuicFrame, at: i32): void => {
  frame.type = 0
  frame.end = at
  frame.streamId = 0
  frame.offset = 0
  frame.value = 0
  frame.errorCode = 0
  frame.frameType = 0
  frame.retirePriorTo = 0
  frame.fin = false
  frame.dataStart = at
  frame.dataLength = 0
  frame.largest = 0
  frame.ackDelay = 0
  frame.ackRangeCount = 0
  frame.ackRangeTotal = 0
  frame.ect0 = 0
  frame.ect1 = 0
  frame.ce = 0
  frame.connectionIdStart = at
  frame.connectionIdLength = 0
  frame.resetTokenStart = at
}

/**
 * The ranges of an ACK frame (§19.3.1): the first range down from `largest`,
 * then each Gap and ACK Range Length pair below it. A range that reaches
 * below packet number zero is `QUIC_ERROR_FRAME_ENCODING`. Answers 0 or that.
 */
const quicFrameReadAck = (r: QuicFrameReader, d: u8[], frame: QuicFrame, ecn: boolean): i64 => {
  frame.largest = quicFrameVarint(r, d)
  frame.ackDelay = quicFrameVarint(r, d)
  const count: i64 = quicFrameVarint(r, d)
  const first: i64 = quicFrameVarint(r, d)
  if (r.failed) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  let smallest: i64 = frame.largest - first
  if (smallest < 0) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  quicFrameStoreRange(frame, 0, smallest, frame.largest)
  let stored: i32 = 1
  // Each further range takes at least two bytes, so the loop is bounded by the
  // payload whatever count the peer claims: a short read ends it.
  for (let k: i64 = 0; k < count; k += 1) {
    const gap: i64 = quicFrameVarint(r, d)
    const length: i64 = quicFrameVarint(r, d)
    if (r.failed) {
      return QUIC_ERROR_FRAME_ENCODING
    }
    // The next range's largest is two below this one's smallest, less the gap.
    const top: i64 = smallest - gap - 2
    const bottom: i64 = top - length
    if (top < 0 || bottom < 0) {
      return QUIC_ERROR_FRAME_ENCODING
    }
    if (stored < QUIC_FRAME_MAX_ACK_RANGES) {
      quicFrameStoreRange(frame, stored, bottom, top)
      stored = stored + 1
    }
    smallest = bottom
  }
  frame.ackRangeCount = stored
  frame.ackRangeTotal = count + 1
  if (ecn) {
    frame.ect0 = quicFrameVarint(r, d)
    frame.ect1 = quicFrameVarint(r, d)
    frame.ce = quicFrameVarint(r, d)
  }
  return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
}

/**
 * The data of a CRYPTO or STREAM frame, `length` bytes from the reader's
 * position; past the window, or reaching past offset 2^62 − 1 (§19.6,
 * §19.8), it is `QUIC_ERROR_FRAME_ENCODING`.
 */
const quicFrameReadData = (r: QuicFrameReader, frame: QuicFrame, length: i64): i64 => {
  frame.dataStart = quicFrameSkip(r, length)
  if (r.failed) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  frame.dataLength = toI32(length)
  return frame.offset > QUIC_MAX_VARINT - length ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
}

/** STREAM (§19.8): the type's three low bits say whether Offset and Length are present and whether FIN is set. */
const quicFrameReadStream = (r: QuicFrameReader, d: u8[], frame: QuicFrame, bits: i32): i64 => {
  frame.streamId = quicFrameVarint(r, d)
  if ((bits & 0x04) !== 0) {
    frame.offset = quicFrameVarint(r, d)
  }
  // Without a Length the data runs to the end of the packet.
  const length: i64 = (bits & 0x02) !== 0 ? quicFrameVarint(r, d) : toI64(r.end - r.at)
  frame.fin = (bits & 0x01) !== 0
  if (r.failed) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  return quicFrameReadData(r, frame, length)
}

/** DATAGRAM (RFC 9221 §4): with a Length, that many bytes; without, the rest of the packet. */
const quicFrameReadDatagram = (r: QuicFrameReader, d: u8[], frame: QuicFrame, hasLength: boolean): i64 => {
  const length: i64 = hasLength ? quicFrameVarint(r, d) : toI64(r.end - r.at)
  frame.fin = hasLength
  frame.dataStart = quicFrameSkip(r, length)
  if (r.failed) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  frame.dataLength = toI32(length)
  return QUIC_ERROR_NO_ERROR
}

/** NEW_CONNECTION_ID (§19.15): a sequence number, Retire Prior To, a 1 to 20 byte ID and a 16-byte reset token. */
const quicFrameReadNewConnectionId = (r: QuicFrameReader, d: u8[], frame: QuicFrame): i64 => {
  frame.value = quicFrameVarint(r, d)
  frame.retirePriorTo = quicFrameVarint(r, d)
  const lengthAt: i32 = quicFrameSkip(r, 1)
  if (r.failed || lengthAt < 0 || lengthAt >= toI32(d.length)) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  const length: i32 = toI32(d[lengthAt])
  const cidAt: i32 = quicFrameSkip(r, toI64(length))
  const tokenAt: i32 = quicFrameSkip(r, toI64(QUIC_RESET_TOKEN_SIZE))
  if (r.failed || length < 1 || length > QUIC_MAX_CID_LENGTH || frame.retirePriorTo > frame.value) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  frame.connectionIdStart = cidAt
  frame.connectionIdLength = length
  frame.resetTokenStart = tokenAt
  return QUIC_ERROR_NO_ERROR
}

/** A frame of one varint-length field followed by that many bytes, left in place: NEW_TOKEN's token, a close's reason. */
const quicFrameReadBytes = (r: QuicFrameReader, d: u8[], frame: QuicFrame): void => {
  const length: i64 = quicFrameVarint(r, d)
  frame.dataStart = quicFrameSkip(r, length)
  frame.dataLength = r.failed ? 0 : toI32(length)
}

/**
 * The body of a frame of type `type` (already read and known), from the
 * reader's position. Answers 0, or the transport error the RFC names.
 */
const quicFrameReadBody = (r: QuicFrameReader, d: u8[], frame: QuicFrame, type: i32): i64 => {
  switch (type) {
    case QUIC_FRAME_PADDING: {
      // Padding is a run of zero bytes; read it as one frame, so a packet of
      // a thousand padding bytes is one call rather than a thousand.
      while (r.at < r.end && r.at >= 0 && r.at < toI32(d.length) && toI32(d[r.at]) === 0) {
        r.at = r.at + 1
      }
      return QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_PING:
    case QUIC_FRAME_HANDSHAKE_DONE:
      return QUIC_ERROR_NO_ERROR
    case QUIC_FRAME_ACK:
      return quicFrameReadAck(r, d, frame, false)
    case QUIC_FRAME_ACK_ECN:
      return quicFrameReadAck(r, d, frame, true)
    case QUIC_FRAME_RESET_STREAM: {
      frame.streamId = quicFrameVarint(r, d)
      frame.errorCode = quicFrameVarint(r, d)
      frame.value = quicFrameVarint(r, d)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_STOP_SENDING: {
      frame.streamId = quicFrameVarint(r, d)
      frame.errorCode = quicFrameVarint(r, d)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_CRYPTO: {
      frame.offset = quicFrameVarint(r, d)
      const length: i64 = quicFrameVarint(r, d)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : quicFrameReadData(r, frame, length)
    }
    case QUIC_FRAME_NEW_TOKEN: {
      quicFrameReadBytes(r, d, frame)
      // §19.7: an empty token is FRAME_ENCODING_ERROR.
      return r.failed || frame.dataLength === 0 ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_MAX_STREAM_DATA:
    case QUIC_FRAME_STREAM_DATA_BLOCKED: {
      frame.streamId = quicFrameVarint(r, d)
      frame.value = quicFrameVarint(r, d)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_MAX_DATA:
    case QUIC_FRAME_DATA_BLOCKED:
    case QUIC_FRAME_RETIRE_CONNECTION_ID: {
      frame.value = quicFrameVarint(r, d)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_NEW_CONNECTION_ID:
      return quicFrameReadNewConnectionId(r, d, frame)
    case QUIC_FRAME_PATH_CHALLENGE:
    case QUIC_FRAME_PATH_RESPONSE: {
      frame.dataStart = quicFrameSkip(r, toI64(QUIC_PATH_DATA_SIZE))
      frame.dataLength = QUIC_PATH_DATA_SIZE
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_CONNECTION_CLOSE: {
      frame.errorCode = quicFrameVarint(r, d)
      frame.frameType = quicFrameVarint(r, d)
      quicFrameReadBytes(r, d, frame)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_CONNECTION_CLOSE_APP: {
      frame.errorCode = quicFrameVarint(r, d)
      quicFrameReadBytes(r, d, frame)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    default: {
      // The four stream-count frames share one rule: a count past 2^60 is a
      // FRAME_ENCODING_ERROR (§19.11, §19.14). Every other type was handled
      // above or is STREAM's, which `quicParseFrame` routes separately.
      frame.value = quicFrameVarint(r, d)
      if (r.failed || frame.value > QUIC_FRAME_MAX_STREAMS) {
        return QUIC_ERROR_FRAME_ENCODING
      }
      return QUIC_ERROR_NO_ERROR
    }
  }
}

/**
 * Reads the frame starting at `payload[at]`, inside `payload[at .. end)`,
 * into `frame`, which is reset first, and answers 0 or the transport error
 * the RFC names for the break (see the module header). On 0, `frame.end` is
 * where the next frame starts; after an error the packet is not to be read
 * further, and `frame.type` still holds the type when it was read, which is
 * what CONNECTION_CLOSE reports. A window outside `payload` is
 * `QUIC_ERROR_INTERNAL`, the caller's fault rather than the peer's.
 */
export const quicParseFrame = (frame: QuicFrame, payload: u8[], at: i32, end: i32): i64 => {
  quicFrameReset(frame, at)
  if (at < 0 || end > toI32(payload.length) || at >= end) {
    return QUIC_ERROR_INTERNAL
  }
  const r: QuicFrameReader = new QuicFrameReader(at, end)
  const typeLength: i32 = quicVarintLength(payload, at)
  const type: i64 = quicFrameVarint(r, payload)
  if (r.failed) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  const datagram: boolean = type === toI64(QUIC_FRAME_DATAGRAM) || type === toI64(QUIC_FRAME_DATAGRAM_LENGTH)
  if (type > toI64(QUIC_FRAME_HANDSHAKE_DONE) && !datagram) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  const small: i32 = toI32(type)
  frame.type = small >= QUIC_FRAME_STREAM && small <= 0x0f ? QUIC_FRAME_STREAM : small
  // §12.4: a frame type is written in the fewest bytes. Every type here fits
  // in one, so a longer spelling is the peer's mistake.
  if (typeLength !== 1) {
    return QUIC_ERROR_PROTOCOL_VIOLATION
  }
  let error: i64 = QUIC_ERROR_NO_ERROR
  if (datagram) {
    frame.type = QUIC_FRAME_DATAGRAM
    error = quicFrameReadDatagram(r, payload, frame, small === QUIC_FRAME_DATAGRAM_LENGTH)
  } else if (frame.type === QUIC_FRAME_STREAM) {
    error = quicFrameReadStream(r, payload, frame, small & 7)
  } else {
    error = quicFrameReadBody(r, payload, frame, small)
  }
  frame.end = r.at
  return error
}

/**
 * Whether a frame of `type` may appear in a packet of `packetType` (RFC 9000
 * §12.4, Table 3). Initial and Handshake packets carry only PADDING, PING,
 * ACK, CRYPTO and the transport CONNECTION_CLOSE; a 0-RTT packet anything
 * but ACK, CRYPTO, NEW_TOKEN, HANDSHAKE_DONE and the retire and response
 * frames a client cannot have a reason to send yet; a 1-RTT packet anything.
 */
export const quicFrameAllowed = (type: i32, packetType: i32): boolean => {
  if (packetType === QUIC_PACKET_SHORT) {
    return true
  }
  if (packetType === QUIC_PACKET_INITIAL || packetType === QUIC_PACKET_HANDSHAKE) {
    return (
      type === QUIC_FRAME_PADDING ||
      type === QUIC_FRAME_PING ||
      type === QUIC_FRAME_ACK ||
      type === QUIC_FRAME_ACK_ECN ||
      type === QUIC_FRAME_CRYPTO ||
      type === QUIC_FRAME_CONNECTION_CLOSE
    )
  }
  if (packetType === QUIC_PACKET_ZERO_RTT) {
    return !(
      type === QUIC_FRAME_ACK ||
      type === QUIC_FRAME_ACK_ECN ||
      type === QUIC_FRAME_CRYPTO ||
      type === QUIC_FRAME_NEW_TOKEN ||
      type === QUIC_FRAME_HANDSHAKE_DONE ||
      type === QUIC_FRAME_RETIRE_CONNECTION_ID ||
      type === QUIC_FRAME_PATH_RESPONSE
    )
  }
  return false
}

/**
 * Whether a frame of `type` asks for an acknowledgement (RFC 9000 §13.2):
 * every frame but ACK, PADDING and CONNECTION_CLOSE.
 */
export const quicFrameAckEliciting = (type: i32): boolean =>
  !(
    type === QUIC_FRAME_ACK ||
    type === QUIC_FRAME_ACK_ECN ||
    type === QUIC_FRAME_PADDING ||
    type === QUIC_FRAME_CONNECTION_CLOSE ||
    type === QUIC_FRAME_CONNECTION_CLOSE_APP
  )

// ---- Writers --------------------------------------------------------------------
//
// Each frame has a `put` writer, which writes it into a caller's buffer at an
// offset and answers the offset past it (-1, writing nothing, for an argument
// out of range or a frame that does not fit before `end`), and a `push`
// writer, which appends it to an array: the `push` form grows the array by
// the frame's size and calls the `put` form, so each frame has one encoder.
// A connection builds its packets with the `put` forms, in place, with no
// allocation.

/** Whether `from .. from + length` is a window of `bytes`. */
const quicFrameWindowFits = (bytes: u8[], from: i32, length: i32): boolean =>
  from >= 0 && length >= 0 && from <= toI32(bytes.length) - length

/** Whether `size` bytes from `at` fit before `end` and inside `buf`. */
const quicFrameRoom = (buf: u8[], at: i32, end: i32, size: i32): boolean =>
  size > 0 && at >= 0 && end <= toI32(buf.length) && at <= end - size

/** Writes `bytes[from .. from + length)` into `buf` at `at`; the caller has checked both windows. */
const quicFrameCopyInto = (buf: u8[], at: i32, bytes: u8[], from: i32, length: i32): void => {
  for (let k: i32 = 0; k < length; k += 1) {
    if (at + k >= 0 && at + k < toI32(buf.length) && from + k >= 0 && from + k < toI32(bytes.length)) {
      buf[at + k] = bytes[from + k]
    }
  }
}

/** Writes one byte and answers the offset past it; the caller has checked the room. */
const quicFramePutByte = (buf: u8[], at: i32, value: i32): i32 => {
  if (at >= 0 && at < toI32(buf.length)) {
    buf[at] = toU8(value)
  }
  return at + 1
}

/** Writes a varint in the fewest bytes; the caller has checked the room and the value. */
const quicFramePutVarint = (buf: u8[], at: i32, value: i64): i32 =>
  quicVarintPut(buf, at, value, quicVarintSize(value))

/** Grows `out` by `size` bytes and answers where they start, for a `push` writer to `put` into. */
const quicFrameGrow = (out: u8[], size: i32): i32 => {
  const at: i32 = toI32(out.length)
  quicPacketGrow(out, size)
  return at
}

/** Whether every value is a varint, which is what a frame of them needs. */
const quicFrameVarints3 = (a: i64, b: i64, c: i64): boolean =>
  quicVarintSize(a) !== 0 && quicVarintSize(b) !== 0 && quicVarintSize(c) !== 0

/** Appends `count` PADDING frames, which are `count` zero bytes. A count below one appends nothing. */
export const quicPushPadding = (out: u8[], count: i32): void => {
  quicPacketGrow(out, count)
}

/**
 * Writes `count` PADDING frames, zero bytes, into `buf[at .. at + count)`,
 * clamped to `buf`, and answers the offset past them.
 */
export const quicPutPadding = (buf: u8[], at: i32, count: i32): i32 => {
  let k: i32 = 0
  while (k < count && at + k >= 0 && at + k < toI32(buf.length)) {
    buf[at + k] = toU8(0)
    k += 1
  }
  return at + k
}

/** Writes a frame that is its type alone, PING or HANDSHAKE_DONE; -1 for another type or no room. */
export const quicPutTypeOnly = (buf: u8[], at: i32, end: i32, type: i32): i32 => {
  if ((type !== QUIC_FRAME_PING && type !== QUIC_FRAME_HANDSHAKE_DONE) || !quicFrameRoom(buf, at, end, 1)) {
    return -1
  }
  return quicFramePutByte(buf, at, type)
}

/** Appends a frame that is its type alone: PING or HANDSHAKE_DONE. Answers `false` for another type. */
export const quicPushTypeOnly = (out: u8[], type: i32): boolean => {
  if (type !== QUIC_FRAME_PING && type !== QUIC_FRAME_HANDSHAKE_DONE) {
    return false
  }
  const at: i32 = quicFrameGrow(out, 1)
  return quicPutTypeOnly(out, at, at + 1, type) >= 0
}

/**
 * The size of the ACK frame `quicPutAck` writes for these ranges, or 0 when
 * it would refuse them: no ranges, ranges out of order or touching, a pair
 * the array does not hold, or a value no varint holds.
 */
export const quicAckSize = (ranges: i64[], rangeCount: i32, ackDelay: i64): i32 => {
  if (rangeCount < 1 || rangeCount * 2 > toI32(ranges.length) || quicVarintSize(ackDelay) === 0) {
    return 0
  }
  let size: i32 = 1
  let previousSmallest: i64 = 0
  for (let k: i32 = 0; k < rangeCount; k += 1) {
    const at: i32 = k * 2
    const next: i32 = at + 1
    if (at < 0 || at >= toI32(ranges.length) || next < 0 || next >= toI32(ranges.length)) {
      return 0
    }
    const smallest: i64 = ranges[at]
    const largest: i64 = ranges[next]
    if (smallest < 0 || largest < smallest || largest > QUIC_MAX_VARINT) {
      return 0
    }
    if (k === 0) {
      size = size + quicVarintSize(largest) + quicVarintSize(ackDelay) + quicVarintSize(toI64(rangeCount - 1))
    } else {
      // Gap: the packets missing between this range and the one above, less one (§19.3.1).
      const gap: i64 = previousSmallest - largest - 2
      if (gap < 0) {
        return 0
      }
      size = size + quicVarintSize(gap)
    }
    size = size + quicVarintSize(largest - smallest)
    previousSmallest = smallest
  }
  return size
}

/**
 * Writes an ACK frame (§19.3) for the `rangeCount` pairs of `ranges`, each
 * `[smallest, largest]`, from the highest down and not touching (each pair's
 * largest at least two below the smallest of the pair before it), with
 * `ackDelay` already scaled by this endpoint's exponent. Answers -1, writing
 * nothing, where `quicAckSize` answers 0 or the frame does not fit.
 */
export const quicPutAck = (
  buf: u8[],
  at: i32,
  end: i32,
  ranges: i64[],
  rangeCount: i32,
  ackDelay: i64
): i32 => {
  const size: i32 = quicAckSize(ranges, rangeCount, ackDelay)
  if (!quicFrameRoom(buf, at, end, size)) {
    return -1
  }
  let cursor: i32 = quicFramePutByte(buf, at, QUIC_FRAME_ACK)
  let previousSmallest: i64 = 0
  for (let k: i32 = 0; k < rangeCount; k += 1) {
    const pair: i32 = k * 2
    if (pair >= 0 && pair < toI32(ranges.length) && pair + 1 < toI32(ranges.length)) {
      const smallest: i64 = ranges[pair]
      const largest: i64 = ranges[pair + 1]
      if (k === 0) {
        cursor = quicFramePutVarint(buf, cursor, largest)
        cursor = quicFramePutVarint(buf, cursor, ackDelay)
        cursor = quicFramePutVarint(buf, cursor, toI64(rangeCount - 1))
      } else {
        cursor = quicFramePutVarint(buf, cursor, previousSmallest - largest - 2)
      }
      cursor = quicFramePutVarint(buf, cursor, largest - smallest)
      previousSmallest = smallest
    }
  }
  return cursor
}

/** Appends the ACK frame `quicPutAck` writes. Answers `false`, appending nothing, where it refuses. */
export const quicPushAck = (out: u8[], ranges: i64[], rangeCount: i32, ackDelay: i64): boolean => {
  const size: i32 = quicAckSize(ranges, rangeCount, ackDelay)
  if (size === 0) {
    return false
  }
  const at: i32 = quicFrameGrow(out, size)
  return quicPutAck(out, at, at + size, ranges, rangeCount, ackDelay) >= 0
}

/**
 * The bytes a CRYPTO frame's header takes for `length` bytes of data at
 * `offset`: the type, the offset and the length.
 */
export const quicCryptoOverhead = (offset: i64, length: i32): i32 =>
  1 + quicVarintSize(offset) + quicVarintSize(toI64(length))

/**
 * Writes a CRYPTO frame (§19.6) carrying `data[from .. from + length)` at
 * stream offset `offset`. Answers -1, writing nothing, for a window outside
 * `data`, an offset whose end passes 2^62 − 1, or no room.
 */
export const quicPutCrypto = (
  buf: u8[],
  at: i32,
  end: i32,
  offset: i64,
  data: u8[],
  from: i32,
  length: i32
): i32 => {
  if (
    !quicFrameWindowFits(data, from, length) ||
    offset < 0 ||
    offset > QUIC_MAX_VARINT - toI64(length) ||
    !quicFrameRoom(buf, at, end, quicCryptoOverhead(offset, length) + length)
  ) {
    return -1
  }
  let cursor: i32 = quicFramePutByte(buf, at, QUIC_FRAME_CRYPTO)
  cursor = quicFramePutVarint(buf, cursor, offset)
  cursor = quicFramePutVarint(buf, cursor, toI64(length))
  quicFrameCopyInto(buf, cursor, data, from, length)
  return cursor + length
}

/** Appends the CRYPTO frame `quicPutCrypto` writes. Answers `false`, appending nothing, where it refuses. */
export const quicPushCrypto = (out: u8[], offset: i64, data: u8[], from: i32, length: i32): boolean => {
  if (!quicFrameWindowFits(data, from, length) || offset < 0 || offset > QUIC_MAX_VARINT - toI64(length)) {
    return false
  }
  const size: i32 = quicCryptoOverhead(offset, length) + length
  const at: i32 = quicFrameGrow(out, size)
  return quicPutCrypto(out, at, at + size, offset, data, from, length) >= 0
}

/**
 * The bytes a STREAM frame's header takes for `length` bytes of data on
 * `streamId` at `offset`: the type, the stream ID, the offset when it is not
 * zero, and the length, which `quicPutStream` always writes.
 */
export const quicStreamOverhead = (streamId: i64, offset: i64, length: i32): i32 =>
  1 + quicVarintSize(streamId) + (offset === 0 ? 0 : quicVarintSize(offset)) + quicVarintSize(toI64(length))

/**
 * Writes a STREAM frame (§19.8) carrying `length` bytes of `data` on
 * `streamId` at `offset`, with FIN when `fin`. The data is read from `data`
 * as a ring: byte `k` of it is `data[(from + k) % data.length]`, so a
 * stream's send buffer is framed where it wraps without a copy; a `from`
 * plus `length` inside the array is the plain window. The Length field is
 * always written, so another frame may follow; the Offset field only when it
 * is not zero. Answers -1, writing nothing, for a `length` past the array, a
 * stream ID that is not a varint, an end past 2^62 − 1, or no room.
 */
export const quicPutStream = (
  buf: u8[],
  at: i32,
  end: i32,
  streamId: i64,
  offset: i64,
  data: u8[],
  from: i32,
  length: i32,
  fin: boolean
): i32 => {
  const size: i32 = toI32(data.length)
  if (
    from < 0 ||
    length < 0 ||
    length > size ||
    (length > 0 && from >= size) ||
    quicVarintSize(streamId) === 0 ||
    offset < 0 ||
    offset > QUIC_MAX_VARINT - toI64(length) ||
    !quicFrameRoom(buf, at, end, quicStreamOverhead(streamId, offset, length) + length)
  ) {
    return -1
  }
  const offsetBit: i32 = offset === 0 ? 0 : 0x04
  const finBit: i32 = fin ? 0x01 : 0
  let cursor: i32 = quicFramePutByte(buf, at, QUIC_FRAME_STREAM | offsetBit | 0x02 | finBit)
  cursor = quicFramePutVarint(buf, cursor, streamId)
  if (offset !== 0) {
    cursor = quicFramePutVarint(buf, cursor, offset)
  }
  cursor = quicFramePutVarint(buf, cursor, toI64(length))
  // Two runs: up to the end of the array, then from its start.
  const first: i32 = length < size - from ? length : size - from
  quicFrameCopyInto(buf, cursor, data, from, first)
  quicFrameCopyInto(buf, cursor + first, data, 0, length - first)
  return cursor + length
}

/**
 * Appends a STREAM frame (§19.8) carrying `data[from .. from + length)` on
 * `streamId` at `offset`, with FIN when `fin`, as `quicPutStream` writes it.
 * Answers `false`, appending nothing, for a window outside `data`, a stream
 * ID that is not a varint or an end past 2^62 − 1.
 */
export const quicPushStream = (
  out: u8[],
  streamId: i64,
  offset: i64,
  data: u8[],
  from: i32,
  length: i32,
  fin: boolean
): boolean => {
  if (
    !quicFrameWindowFits(data, from, length) ||
    quicVarintSize(streamId) === 0 ||
    offset < 0 ||
    offset > QUIC_MAX_VARINT - toI64(length)
  ) {
    return false
  }
  const size: i32 = quicStreamOverhead(streamId, offset, length) + length
  const at: i32 = quicFrameGrow(out, size)
  // A window inside the array is a ring that does not wrap.
  return quicPutStream(out, at, at + size, streamId, offset, data, from, length, fin) >= 0
}

/** Whether `type` is one of the frames `quicPutValue` writes, and `value` one it may carry. */
const quicFrameValueFits = (type: i32, value: i64): boolean => {
  const counts: boolean =
    type === QUIC_FRAME_MAX_STREAMS_BIDI ||
    type === QUIC_FRAME_MAX_STREAMS_UNI ||
    type === QUIC_FRAME_STREAMS_BLOCKED_BIDI ||
    type === QUIC_FRAME_STREAMS_BLOCKED_UNI
  const known: boolean =
    counts ||
    type === QUIC_FRAME_MAX_DATA ||
    type === QUIC_FRAME_DATA_BLOCKED ||
    type === QUIC_FRAME_RETIRE_CONNECTION_ID
  return known && quicVarintSize(value) !== 0 && !(counts && value > QUIC_FRAME_MAX_STREAMS)
}

/**
 * Writes a frame of one varint after its type: MAX_DATA, MAX_STREAMS_BIDI,
 * MAX_STREAMS_UNI, DATA_BLOCKED, STREAMS_BLOCKED_BIDI, STREAMS_BLOCKED_UNI or
 * RETIRE_CONNECTION_ID. Answers -1 for another type, a value no varint holds,
 * a stream count past 2^60, or no room.
 */
export const quicPutValue = (buf: u8[], at: i32, end: i32, type: i32, value: i64): i32 => {
  if (!quicFrameValueFits(type, value) || !quicFrameRoom(buf, at, end, 1 + quicVarintSize(value))) {
    return -1
  }
  return quicFramePutVarint(buf, quicFramePutByte(buf, at, type), value)
}

/** Appends the frame `quicPutValue` writes. Answers `false`, appending nothing, where it refuses. */
export const quicPushValue = (out: u8[], type: i32, value: i64): boolean => {
  if (!quicFrameValueFits(type, value)) {
    return false
  }
  const size: i32 = 1 + quicVarintSize(value)
  const at: i32 = quicFrameGrow(out, size)
  return quicPutValue(out, at, at + size, type, value) >= 0
}

/**
 * Writes a MAX_STREAM_DATA or STREAM_DATA_BLOCKED frame: the stream ID and
 * the limit. Answers -1 for another type, a value no varint holds, or no room.
 */
export const quicPutStreamValue = (
  buf: u8[],
  at: i32,
  end: i32,
  type: i32,
  streamId: i64,
  value: i64
): i32 => {
  if (
    (type !== QUIC_FRAME_MAX_STREAM_DATA && type !== QUIC_FRAME_STREAM_DATA_BLOCKED) ||
    quicVarintSize(streamId) === 0 ||
    quicVarintSize(value) === 0 ||
    !quicFrameRoom(buf, at, end, 1 + quicVarintSize(streamId) + quicVarintSize(value))
  ) {
    return -1
  }
  const cursor: i32 = quicFramePutVarint(buf, quicFramePutByte(buf, at, type), streamId)
  return quicFramePutVarint(buf, cursor, value)
}

/** Appends the frame `quicPutStreamValue` writes. Answers `false`, appending nothing, where it refuses. */
export const quicPushStreamValue = (out: u8[], type: i32, streamId: i64, value: i64): boolean => {
  if (
    (type !== QUIC_FRAME_MAX_STREAM_DATA && type !== QUIC_FRAME_STREAM_DATA_BLOCKED) ||
    quicVarintSize(streamId) === 0 ||
    quicVarintSize(value) === 0
  ) {
    return false
  }
  const size: i32 = 1 + quicVarintSize(streamId) + quicVarintSize(value)
  const at: i32 = quicFrameGrow(out, size)
  return quicPutStreamValue(out, at, at + size, type, streamId, value) >= 0
}

/** The size of a NEW_CONNECTION_ID frame, or 0 for arguments `quicPutNewConnectionId` refuses. */
const quicFrameNewCidSize = (sequence: i64, retirePriorTo: i64, cidLength: i32, tokenLength: i32): i32 => {
  if (
    cidLength < 1 ||
    cidLength > QUIC_MAX_CID_LENGTH ||
    tokenLength !== QUIC_RESET_TOKEN_SIZE ||
    retirePriorTo < 0 ||
    retirePriorTo > sequence ||
    quicVarintSize(sequence) === 0
  ) {
    return 0
  }
  return 1 + quicVarintSize(sequence) + quicVarintSize(retirePriorTo) + 1 + cidLength + QUIC_RESET_TOKEN_SIZE
}

/**
 * Writes a NEW_CONNECTION_ID frame (§19.15) for the first `cidLength` bytes
 * of `connectionId`. Answers -1 for a connection ID outside 1 to 20 bytes or
 * past the array, a reset token that is not 16 bytes, a Retire Prior To
 * above the sequence number, a value no varint holds, or no room.
 */
export const quicPutNewConnectionId = (
  buf: u8[],
  at: i32,
  end: i32,
  sequence: i64,
  retirePriorTo: i64,
  connectionId: u8[],
  cidLength: i32,
  resetToken: u8[]
): i32 => {
  const size: i32 = quicFrameNewCidSize(sequence, retirePriorTo, cidLength, toI32(resetToken.length))
  if (size === 0 || cidLength > toI32(connectionId.length) || !quicFrameRoom(buf, at, end, size)) {
    return -1
  }
  let cursor: i32 = quicFramePutByte(buf, at, QUIC_FRAME_NEW_CONNECTION_ID)
  cursor = quicFramePutVarint(buf, cursor, sequence)
  cursor = quicFramePutVarint(buf, cursor, retirePriorTo)
  cursor = quicFramePutByte(buf, cursor, cidLength)
  quicFrameCopyInto(buf, cursor, connectionId, 0, cidLength)
  quicFrameCopyInto(buf, cursor + cidLength, resetToken, 0, QUIC_RESET_TOKEN_SIZE)
  return cursor + cidLength + QUIC_RESET_TOKEN_SIZE
}

/**
 * Appends a NEW_CONNECTION_ID frame (§19.15). Answers `false` for a
 * connection ID outside 1 to 20 bytes, a reset token that is not 16 bytes, a
 * Retire Prior To above the sequence number, or a value no varint holds.
 */
export const quicPushNewConnectionId = (
  out: u8[],
  sequence: i64,
  retirePriorTo: i64,
  connectionId: u8[],
  resetToken: u8[]
): boolean => {
  const cidLength: i32 = toI32(connectionId.length)
  const size: i32 = quicFrameNewCidSize(sequence, retirePriorTo, cidLength, toI32(resetToken.length))
  if (size === 0) {
    return false
  }
  const at: i32 = quicFrameGrow(out, size)
  return (
    quicPutNewConnectionId(
      out,
      at,
      at + size,
      sequence,
      retirePriorTo,
      connectionId,
      cidLength,
      resetToken
    ) >= 0
  )
}

/**
 * Writes a PATH_CHALLENGE or PATH_RESPONSE frame carrying the eight bytes
 * `data[from .. from + 8)`. Answers -1 for another type, a window outside
 * `data`, or no room.
 */
export const quicPutPathData = (buf: u8[], at: i32, end: i32, type: i32, data: u8[], from: i32): i32 => {
  if (
    (type !== QUIC_FRAME_PATH_CHALLENGE && type !== QUIC_FRAME_PATH_RESPONSE) ||
    !quicFrameWindowFits(data, from, QUIC_PATH_DATA_SIZE) ||
    !quicFrameRoom(buf, at, end, 1 + QUIC_PATH_DATA_SIZE)
  ) {
    return -1
  }
  const cursor: i32 = quicFramePutByte(buf, at, type)
  quicFrameCopyInto(buf, cursor, data, from, QUIC_PATH_DATA_SIZE)
  return cursor + QUIC_PATH_DATA_SIZE
}

/** Appends the frame `quicPutPathData` writes. Answers `false`, appending nothing, where it refuses. */
export const quicPushPathData = (out: u8[], type: i32, data: u8[], from: i32): boolean => {
  if (
    (type !== QUIC_FRAME_PATH_CHALLENGE && type !== QUIC_FRAME_PATH_RESPONSE) ||
    !quicFrameWindowFits(data, from, QUIC_PATH_DATA_SIZE)
  ) {
    return false
  }
  const at: i32 = quicFrameGrow(out, 1 + QUIC_PATH_DATA_SIZE)
  return quicPutPathData(out, at, at + 1 + QUIC_PATH_DATA_SIZE, type, data, from) >= 0
}

/**
 * Writes a RESET_STREAM frame (§19.4) or, with `finalSize` at -1, a
 * STOP_SENDING frame (§19.5). Answers -1 for a value no varint holds, or no room.
 */
export const quicPutStreamError = (
  buf: u8[],
  at: i32,
  end: i32,
  streamId: i64,
  errorCode: i64,
  finalSize: i64
): i32 => {
  const reset: boolean = finalSize !== -1
  if (!quicFrameVarints3(streamId, errorCode, reset ? finalSize : 0)) {
    return -1
  }
  const size: i32 =
    1 + quicVarintSize(streamId) + quicVarintSize(errorCode) + (reset ? quicVarintSize(finalSize) : 0)
  if (!quicFrameRoom(buf, at, end, size)) {
    return -1
  }
  let cursor: i32 = quicFramePutByte(buf, at, reset ? QUIC_FRAME_RESET_STREAM : QUIC_FRAME_STOP_SENDING)
  cursor = quicFramePutVarint(buf, cursor, streamId)
  cursor = quicFramePutVarint(buf, cursor, errorCode)
  if (reset) {
    cursor = quicFramePutVarint(buf, cursor, finalSize)
  }
  return cursor
}

/** Appends the frame `quicPutStreamError` writes. Answers `false`, appending nothing, where it refuses. */
export const quicPushStreamError = (out: u8[], streamId: i64, errorCode: i64, finalSize: i64): boolean => {
  const reset: boolean = finalSize !== -1
  if (!quicFrameVarints3(streamId, errorCode, reset ? finalSize : 0)) {
    return false
  }
  const size: i32 =
    1 + quicVarintSize(streamId) + quicVarintSize(errorCode) + (reset ? quicVarintSize(finalSize) : 0)
  const at: i32 = quicFrameGrow(out, size)
  return quicPutStreamError(out, at, at + size, streamId, errorCode, finalSize) >= 0
}

/** The size of a CONNECTION_CLOSE frame, or 0 for a value no varint holds. */
const quicFrameCloseSize = (application: boolean, errorCode: i64, frameType: i64, reasonLength: i32): i32 => {
  if (!quicFrameVarints3(errorCode, application ? 0 : frameType, toI64(reasonLength))) {
    return 0
  }
  return (
    1 +
    quicVarintSize(errorCode) +
    (application ? 0 : quicVarintSize(frameType)) +
    quicVarintSize(toI64(reasonLength)) +
    reasonLength
  )
}

/**
 * Writes a CONNECTION_CLOSE frame (§19.19): with `application` false the
 * transport form 0x1c, carrying `frameType`, the type of the frame that
 * caused the error (0 when none did); with `application` true the 0x1d form,
 * which has no frame type. `reason` is the phrase, UTF-8, possibly empty.
 * Answers -1 for a value no varint holds, or no room.
 */
export const quicPutConnectionClose = (
  buf: u8[],
  at: i32,
  end: i32,
  application: boolean,
  errorCode: i64,
  frameType: i64,
  reason: u8[]
): i32 => {
  const reasonLength: i32 = toI32(reason.length)
  const size: i32 = quicFrameCloseSize(application, errorCode, frameType, reasonLength)
  if (!quicFrameRoom(buf, at, end, size)) {
    return -1
  }
  let cursor: i32 = quicFramePutByte(
    buf,
    at,
    application ? QUIC_FRAME_CONNECTION_CLOSE_APP : QUIC_FRAME_CONNECTION_CLOSE
  )
  cursor = quicFramePutVarint(buf, cursor, errorCode)
  if (!application) {
    cursor = quicFramePutVarint(buf, cursor, frameType)
  }
  cursor = quicFramePutVarint(buf, cursor, toI64(reasonLength))
  quicFrameCopyInto(buf, cursor, reason, 0, reasonLength)
  return cursor + reasonLength
}

/** Appends the frame `quicPutConnectionClose` writes. Answers `false`, appending nothing, where it refuses. */
export const quicPushConnectionClose = (
  out: u8[],
  application: boolean,
  errorCode: i64,
  frameType: i64,
  reason: u8[]
): boolean => {
  const size: i32 = quicFrameCloseSize(application, errorCode, frameType, toI32(reason.length))
  if (size === 0) {
    return false
  }
  const at: i32 = quicFrameGrow(out, size)
  return quicPutConnectionClose(out, at, at + size, application, errorCode, frameType, reason) >= 0
}

/**
 * Appends a NEW_TOKEN frame (§19.7) carrying `token`. Answers `false` for an
 * empty token, which §19.7 forbids.
 */
export const quicPushNewToken = (out: u8[], token: u8[]): boolean => {
  const length: i32 = toI32(token.length)
  if (length === 0) {
    return false
  }
  const size: i32 = 1 + quicVarintSize(toI64(length)) + length
  let cursor: i32 = quicFramePutByte(out, quicFrameGrow(out, size), QUIC_FRAME_NEW_TOKEN)
  cursor = quicFramePutVarint(out, cursor, toI64(length))
  quicFrameCopyInto(out, cursor, token, 0, length)
  return true
}

/**
 * The size of the DATAGRAM frame `quicPutDatagram` writes for a payload of
 * `length` bytes: the type, the Length and the payload. This is the size RFC
 * 9221 §3 holds to `max_datagram_frame_size`.
 */
export const quicDatagramSize = (length: i32): i32 => 1 + quicVarintSize(toI64(length)) + length

/**
 * Writes a DATAGRAM frame with a Length (type 0x31, RFC 9221 §4) carrying
 * `data[from .. from + length)`. Answers -1 for a window outside `data` or no room.
 */
export const quicPutDatagram = (buf: u8[], at: i32, end: i32, data: u8[], from: i32, length: i32): i32 => {
  if (!quicFrameWindowFits(data, from, length) || !quicFrameRoom(buf, at, end, quicDatagramSize(length))) {
    return -1
  }
  const cursor: i32 = quicFramePutVarint(
    buf,
    quicFramePutByte(buf, at, QUIC_FRAME_DATAGRAM_LENGTH),
    toI64(length)
  )
  quicFrameCopyInto(buf, cursor, data, from, length)
  return cursor + length
}
