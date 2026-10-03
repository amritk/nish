/**
 * `nish/net/quic-frame` — the frames of QUIC version 1 (RFC 9000 §19), read
 * from a decrypted packet payload and written into one, and the transport
 * error codes a connection closes with (§20.1).
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
 * **Every frame type of RFC 9000 is read**, 0x00 to 0x1e, so a type outside
 * that range is the one parse error a well-formed packet cannot produce. What
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
 * **No copy of the bulk.** A CRYPTO or STREAM frame's data, a NEW_TOKEN's
 * token, a PATH_CHALLENGE's eight bytes and a CONNECTION_CLOSE's reason are
 * left in the payload and described by `dataStart` and `dataLength`, so a
 * connection reassembles straight from the packet. One `QuicFrame` is reused
 * for every frame of every packet: `quicParseFrame` overwrites every field it
 * reads and resets the rest.
 *
 * **The writers** append one frame to an array and answer whether they could:
 * `false`, with nothing appended, for a value no varint holds or a window
 * outside the array given. Their inputs are this endpoint's own, never a
 * peer's. `quicFrameAllowed` is RFC 9000 §12.4's table of which frames each
 * packet type may carry.
 *
 * Written from RFC 9000 §12.4, §19 and §20, in this module's own structure;
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
  quicVarintLength,
  quicVarintPush,
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
 *   `connectionId` and `resetToken`. RETIRE_CONNECTION_ID: `value`.
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
  connectionId: u8[]
  resetToken: u8[]
  /** The frame type, with every STREAM type answered as `QUIC_FRAME_STREAM`. */
  type: i32 = 0
  /** One past the frame's last byte, where the next frame starts. */
  end: i32 = 0
  dataStart: i32 = 0
  dataLength: i32 = 0
  ackRangeCount: i32 = 0
  fin: boolean = false

  constructor() {
    this.ackRanges = []
    this.connectionId = []
    this.resetToken = []
  }
}

/**
 * The cursor `quicParseFrame` reads with: a window of the payload, and
 * `failed` once a read ran past it, after which every read fails too. So a
 * frame's fields are read in order and `failed` tested once.
 */
class QuicFrameReader {
  data: u8[]
  at: i32
  end: i32
  failed: boolean = false

  constructor(data: u8[], at: i32, end: i32) {
    this.data = data
    this.at = at
    this.end = end
  }
}

/** The next varint, or 0 and a failed reader when it does not fit in the window. */
const quicFrameVarint = (r: QuicFrameReader): i64 => {
  if (r.failed) {
    return 0
  }
  const value: i64 = quicVarintRead(r.data, r.at, r.end)
  if (value < 0) {
    r.failed = true
    return 0
  }
  r.at = r.at + quicVarintLength(r.data, r.at)
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

/** The bytes `data[from .. from + length)`, copied; the caller has checked the window. */
const quicFrameCopy = (data: u8[], from: i32, length: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  const n: i32 = toI32(out.length)
  for (let k: i32 = 0; k < n; k += 1) {
    if (from + k >= 0 && from + k < toI32(data.length)) {
      out[k] = data[from + k]
    }
  }
  return out
}

/** Stores the `index`-th ACK range pair, growing the array the first time a slot is used. */
const quicFrameStoreRange = (frame: QuicFrame, index: i32, smallest: i64, largest: i64): void => {
  const at: i32 = index * 2
  const ranges: i64[] = frame.ackRanges
  if (at + 1 < toI32(ranges.length)) {
    ranges[at] = smallest
    ranges[at + 1] = largest
    return
  }
  ranges.push(smallest)
  ranges.push(largest)
}

/** Resets every field a previous frame may have set, so a reused `QuicFrame` holds only this one. */
const quicFrameReset = (frame: QuicFrame, at: i32): void => {
  const none: u8[] = []
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
  frame.connectionId = none
  frame.resetToken = none
}

/**
 * The ranges of an ACK frame (§19.3.1): the first range down from `largest`,
 * then each Gap and ACK Range Length pair below it. A range that reaches
 * below packet number zero is `QUIC_ERROR_FRAME_ENCODING`. Answers 0 or that.
 */
const quicFrameReadAck = (r: QuicFrameReader, frame: QuicFrame, ecn: boolean): i64 => {
  frame.largest = quicFrameVarint(r)
  frame.ackDelay = quicFrameVarint(r)
  const count: i64 = quicFrameVarint(r)
  const first: i64 = quicFrameVarint(r)
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
    const gap: i64 = quicFrameVarint(r)
    const length: i64 = quicFrameVarint(r)
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
    frame.ect0 = quicFrameVarint(r)
    frame.ect1 = quicFrameVarint(r)
    frame.ce = quicFrameVarint(r)
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
const quicFrameReadStream = (r: QuicFrameReader, frame: QuicFrame, bits: i32): i64 => {
  frame.streamId = quicFrameVarint(r)
  if ((bits & 0x04) !== 0) {
    frame.offset = quicFrameVarint(r)
  }
  // Without a Length the data runs to the end of the packet.
  const length: i64 = (bits & 0x02) !== 0 ? quicFrameVarint(r) : toI64(r.end - r.at)
  frame.fin = (bits & 0x01) !== 0
  if (r.failed) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  return quicFrameReadData(r, frame, length)
}

/** NEW_CONNECTION_ID (§19.15): a sequence number, Retire Prior To, a 1 to 20 byte ID and a 16-byte reset token. */
const quicFrameReadNewConnectionId = (r: QuicFrameReader, frame: QuicFrame): i64 => {
  frame.value = quicFrameVarint(r)
  frame.retirePriorTo = quicFrameVarint(r)
  const lengthAt: i32 = quicFrameSkip(r, 1)
  if (r.failed || lengthAt < 0 || lengthAt >= toI32(r.data.length)) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  const length: i32 = toI32(r.data[lengthAt])
  const cidAt: i32 = quicFrameSkip(r, toI64(length))
  const tokenAt: i32 = quicFrameSkip(r, toI64(QUIC_RESET_TOKEN_SIZE))
  if (r.failed || length < 1 || length > QUIC_MAX_CID_LENGTH || frame.retirePriorTo > frame.value) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  frame.connectionId = quicFrameCopy(r.data, cidAt, length)
  frame.resetToken = quicFrameCopy(r.data, tokenAt, QUIC_RESET_TOKEN_SIZE)
  return QUIC_ERROR_NO_ERROR
}

/** A frame of one varint-length field followed by that many bytes, left in place: NEW_TOKEN's token, a close's reason. */
const quicFrameReadBytes = (r: QuicFrameReader, frame: QuicFrame): void => {
  const length: i64 = quicFrameVarint(r)
  frame.dataStart = quicFrameSkip(r, length)
  frame.dataLength = r.failed ? 0 : toI32(length)
}

/**
 * The body of a frame of type `type` (already read and known), from the
 * reader's position. Answers 0, or the transport error the RFC names.
 */
const quicFrameReadBody = (r: QuicFrameReader, frame: QuicFrame, type: i32): i64 => {
  switch (type) {
    case QUIC_FRAME_PADDING: {
      // Padding is a run of zero bytes; read it as one frame, so a packet of
      // a thousand padding bytes is one call rather than a thousand.
      while (r.at < r.end && r.at >= 0 && r.at < toI32(r.data.length) && toI32(r.data[r.at]) === 0) {
        r.at = r.at + 1
      }
      return QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_PING:
    case QUIC_FRAME_HANDSHAKE_DONE:
      return QUIC_ERROR_NO_ERROR
    case QUIC_FRAME_ACK:
      return quicFrameReadAck(r, frame, false)
    case QUIC_FRAME_ACK_ECN:
      return quicFrameReadAck(r, frame, true)
    case QUIC_FRAME_RESET_STREAM: {
      frame.streamId = quicFrameVarint(r)
      frame.errorCode = quicFrameVarint(r)
      frame.value = quicFrameVarint(r)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_STOP_SENDING: {
      frame.streamId = quicFrameVarint(r)
      frame.errorCode = quicFrameVarint(r)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_CRYPTO: {
      frame.offset = quicFrameVarint(r)
      const length: i64 = quicFrameVarint(r)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : quicFrameReadData(r, frame, length)
    }
    case QUIC_FRAME_NEW_TOKEN: {
      quicFrameReadBytes(r, frame)
      // §19.7: an empty token is FRAME_ENCODING_ERROR.
      return r.failed || frame.dataLength === 0 ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_MAX_STREAM_DATA:
    case QUIC_FRAME_STREAM_DATA_BLOCKED: {
      frame.streamId = quicFrameVarint(r)
      frame.value = quicFrameVarint(r)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_MAX_DATA:
    case QUIC_FRAME_DATA_BLOCKED:
    case QUIC_FRAME_RETIRE_CONNECTION_ID: {
      frame.value = quicFrameVarint(r)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_NEW_CONNECTION_ID:
      return quicFrameReadNewConnectionId(r, frame)
    case QUIC_FRAME_PATH_CHALLENGE:
    case QUIC_FRAME_PATH_RESPONSE: {
      frame.dataStart = quicFrameSkip(r, toI64(QUIC_PATH_DATA_SIZE))
      frame.dataLength = QUIC_PATH_DATA_SIZE
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_CONNECTION_CLOSE: {
      frame.errorCode = quicFrameVarint(r)
      frame.frameType = quicFrameVarint(r)
      quicFrameReadBytes(r, frame)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    case QUIC_FRAME_CONNECTION_CLOSE_APP: {
      frame.errorCode = quicFrameVarint(r)
      quicFrameReadBytes(r, frame)
      return r.failed ? QUIC_ERROR_FRAME_ENCODING : QUIC_ERROR_NO_ERROR
    }
    default: {
      // The four stream-count frames share one rule: a count past 2^60 is a
      // FRAME_ENCODING_ERROR (§19.11, §19.14). Every other type was handled
      // above or is STREAM's, which `quicParseFrame` routes separately.
      frame.value = quicFrameVarint(r)
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
  const r: QuicFrameReader = new QuicFrameReader(payload, at, end)
  const typeLength: i32 = quicVarintLength(payload, at)
  const type: i64 = quicFrameVarint(r)
  if (r.failed) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  if (type > toI64(QUIC_FRAME_HANDSHAKE_DONE)) {
    return QUIC_ERROR_FRAME_ENCODING
  }
  const small: i32 = toI32(type)
  frame.type = small >= QUIC_FRAME_STREAM && small <= 0x0f ? QUIC_FRAME_STREAM : small
  // §12.4: a frame type is written in the fewest bytes. Every type here fits
  // in one, so a longer spelling is the peer's mistake.
  if (typeLength !== 1) {
    return QUIC_ERROR_PROTOCOL_VIOLATION
  }
  const error: i64 =
    frame.type === QUIC_FRAME_STREAM
      ? quicFrameReadStream(r, frame, small & 7)
      : quicFrameReadBody(r, frame, small)
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

/** Appends `bytes[from .. from + length)` to `out`; the caller has checked the window. */
const quicFrameAppend = (out: u8[], bytes: u8[], from: i32, length: i32): void => {
  for (let k: i32 = from; k < from + length && k < toI32(bytes.length); k += 1) {
    if (k >= 0) {
      out.push(bytes[k])
    }
  }
}

/** Whether `from .. from + length` is a window of `bytes`. */
const quicFrameWindowFits = (bytes: u8[], from: i32, length: i32): boolean =>
  from >= 0 && length >= 0 && from <= toI32(bytes.length) - length

/** Whether every value is a varint, which is what a frame of them needs. */
const quicFrameVarints3 = (a: i64, b: i64, c: i64): boolean =>
  quicVarintSize(a) !== 0 && quicVarintSize(b) !== 0 && quicVarintSize(c) !== 0

/** Appends `count` PADDING frames, which are `count` zero bytes. A count below one appends nothing. */
export const quicPushPadding = (out: u8[], count: i32): void => {
  for (let k: i32 = 0; k < count; k += 1) {
    out.push(toU8(0))
  }
}

/** Appends a frame that is its type alone: PING or HANDSHAKE_DONE. Answers `false` for another type. */
export const quicPushTypeOnly = (out: u8[], type: i32): boolean => {
  if (type !== QUIC_FRAME_PING && type !== QUIC_FRAME_HANDSHAKE_DONE) {
    return false
  }
  out.push(toU8(type))
  return true
}

/**
 * Appends an ACK frame (§19.3) for the `rangeCount` pairs of `ranges`, each
 * `[smallest, largest]`, from the highest down and not touching (each pair's
 * largest at least two below the smallest of the pair before it), with
 * `ackDelay` already scaled by this endpoint's exponent. Answers `false`,
 * appending nothing, for no ranges, ranges out of that order, a pair the
 * array does not hold, or a value no varint holds.
 */
export const quicPushAck = (out: u8[], ranges: i64[], rangeCount: i32, ackDelay: i64): boolean => {
  if (rangeCount < 1 || rangeCount * 2 > toI32(ranges.length) || quicVarintSize(ackDelay) === 0) {
    return false
  }
  const body: u8[] = [toU8(QUIC_FRAME_ACK)]
  let previousSmallest: i64 = 0
  for (let k: i32 = 0; k < rangeCount; k += 1) {
    const at: i32 = k * 2
    const next: i32 = at + 1
    if (at < 0 || at >= toI32(ranges.length) || next < 0 || next >= toI32(ranges.length)) {
      return false
    }
    const smallest: i64 = ranges[at]
    const largest: i64 = ranges[next]
    if (smallest < 0 || largest < smallest || largest > QUIC_MAX_VARINT) {
      return false
    }
    if (k === 0) {
      quicVarintPush(body, largest)
      quicVarintPush(body, ackDelay)
      quicVarintPush(body, toI64(rangeCount - 1))
    } else {
      // Gap: the packets missing between this range and the one above, less one (§19.3.1).
      const gap: i64 = previousSmallest - largest - 2
      if (gap < 0) {
        return false
      }
      quicVarintPush(body, gap)
    }
    quicVarintPush(body, largest - smallest)
    previousSmallest = smallest
  }
  quicFrameAppend(out, body, 0, toI32(body.length))
  return true
}

/**
 * The bytes a CRYPTO frame's header takes for `length` bytes of data at
 * `offset`: the type, the offset and the length.
 */
export const quicCryptoOverhead = (offset: i64, length: i32): i32 =>
  1 + quicVarintSize(offset) + quicVarintSize(toI64(length))

/**
 * Appends a CRYPTO frame (§19.6) carrying `data[from .. from + length)` at
 * stream offset `offset`. Answers `false`, appending nothing, for a window
 * outside `data` or an offset whose end passes 2^62 − 1.
 */
export const quicPushCrypto = (out: u8[], offset: i64, data: u8[], from: i32, length: i32): boolean => {
  if (!quicFrameWindowFits(data, from, length) || offset < 0 || offset > QUIC_MAX_VARINT - toI64(length)) {
    return false
  }
  out.push(toU8(QUIC_FRAME_CRYPTO))
  quicVarintPush(out, offset)
  quicVarintPush(out, toI64(length))
  quicFrameAppend(out, data, from, length)
  return true
}

/**
 * The bytes a STREAM frame's header takes for `length` bytes of data on
 * `streamId` at `offset`: the type, the stream ID, the offset when it is not
 * zero, and the length, which `quicPushStream` always writes.
 */
export const quicStreamOverhead = (streamId: i64, offset: i64, length: i32): i32 =>
  1 + quicVarintSize(streamId) + (offset === 0 ? 0 : quicVarintSize(offset)) + quicVarintSize(toI64(length))

/**
 * Appends a STREAM frame (§19.8) carrying `data[from .. from + length)` on
 * `streamId` at `offset`, with FIN when `fin`. The Length field is always
 * written, so another frame may follow; the Offset field only when it is not
 * zero. Answers `false`, appending nothing, for a window outside `data`, a
 * stream ID that is not a varint or an end past 2^62 − 1.
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
  const offsetBit: i32 = offset === 0 ? 0 : 0x04
  const finBit: i32 = fin ? 0x01 : 0
  out.push(toU8(QUIC_FRAME_STREAM | offsetBit | 0x02 | finBit))
  quicVarintPush(out, streamId)
  if (offset !== 0) {
    quicVarintPush(out, offset)
  }
  quicVarintPush(out, toI64(length))
  quicFrameAppend(out, data, from, length)
  return true
}

/**
 * Appends a frame of one varint after its type: MAX_DATA, MAX_STREAMS_BIDI,
 * MAX_STREAMS_UNI, DATA_BLOCKED, STREAMS_BLOCKED_BIDI, STREAMS_BLOCKED_UNI or
 * RETIRE_CONNECTION_ID. Answers `false` for another type or a value no
 * varint holds, and for a stream count past 2^60.
 */
export const quicPushValue = (out: u8[], type: i32, value: i64): boolean => {
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
  if (!known || quicVarintSize(value) === 0 || (counts && value > QUIC_FRAME_MAX_STREAMS)) {
    return false
  }
  out.push(toU8(type))
  quicVarintPush(out, value)
  return true
}

/**
 * Appends a MAX_STREAM_DATA or STREAM_DATA_BLOCKED frame: the stream ID and
 * the limit. Answers `false` for another type or a value no varint holds.
 */
export const quicPushStreamValue = (out: u8[], type: i32, streamId: i64, value: i64): boolean => {
  if (
    (type !== QUIC_FRAME_MAX_STREAM_DATA && type !== QUIC_FRAME_STREAM_DATA_BLOCKED) ||
    quicVarintSize(streamId) === 0 ||
    quicVarintSize(value) === 0
  ) {
    return false
  }
  out.push(toU8(type))
  quicVarintPush(out, streamId)
  quicVarintPush(out, value)
  return true
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
  if (
    cidLength < 1 ||
    cidLength > QUIC_MAX_CID_LENGTH ||
    toI32(resetToken.length) !== QUIC_RESET_TOKEN_SIZE ||
    retirePriorTo < 0 ||
    retirePriorTo > sequence ||
    quicVarintSize(sequence) === 0
  ) {
    return false
  }
  out.push(toU8(QUIC_FRAME_NEW_CONNECTION_ID))
  quicVarintPush(out, sequence)
  quicVarintPush(out, retirePriorTo)
  out.push(toU8(cidLength))
  quicFrameAppend(out, connectionId, 0, cidLength)
  quicFrameAppend(out, resetToken, 0, QUIC_RESET_TOKEN_SIZE)
  return true
}

/**
 * Appends a PATH_CHALLENGE or PATH_RESPONSE frame carrying the eight bytes
 * `data[from .. from + 8)`. Answers `false` for another type or a window
 * outside `data`.
 */
export const quicPushPathData = (out: u8[], type: i32, data: u8[], from: i32): boolean => {
  if (
    (type !== QUIC_FRAME_PATH_CHALLENGE && type !== QUIC_FRAME_PATH_RESPONSE) ||
    !quicFrameWindowFits(data, from, QUIC_PATH_DATA_SIZE)
  ) {
    return false
  }
  out.push(toU8(type))
  quicFrameAppend(out, data, from, QUIC_PATH_DATA_SIZE)
  return true
}

/**
 * Appends a RESET_STREAM frame (§19.4) or, with `finalSize` at -1, a
 * STOP_SENDING frame (§19.5). Answers `false` for a value no varint holds.
 */
export const quicPushStreamError = (out: u8[], streamId: i64, errorCode: i64, finalSize: i64): boolean => {
  const reset: boolean = finalSize !== -1
  if (!quicFrameVarints3(streamId, errorCode, reset ? finalSize : 0)) {
    return false
  }
  out.push(toU8(reset ? QUIC_FRAME_RESET_STREAM : QUIC_FRAME_STOP_SENDING))
  quicVarintPush(out, streamId)
  quicVarintPush(out, errorCode)
  if (reset) {
    quicVarintPush(out, finalSize)
  }
  return true
}

/**
 * Appends a CONNECTION_CLOSE frame (§19.19): with `application` false the
 * transport form 0x1c, carrying `frameType`, the type of the frame that
 * caused the error (0 when none did); with `application` true the 0x1d form,
 * which has no frame type. `reason` is the phrase, UTF-8, possibly empty.
 * Answers `false` for a value no varint holds.
 */
export const quicPushConnectionClose = (
  out: u8[],
  application: boolean,
  errorCode: i64,
  frameType: i64,
  reason: u8[]
): boolean => {
  const reasonLength: i32 = toI32(reason.length)
  if (!quicFrameVarints3(errorCode, application ? 0 : frameType, toI64(reasonLength))) {
    return false
  }
  out.push(toU8(application ? QUIC_FRAME_CONNECTION_CLOSE_APP : QUIC_FRAME_CONNECTION_CLOSE))
  quicVarintPush(out, errorCode)
  if (!application) {
    quicVarintPush(out, frameType)
  }
  quicVarintPush(out, toI64(reasonLength))
  quicFrameAppend(out, reason, 0, reasonLength)
  return true
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
  out.push(toU8(QUIC_FRAME_NEW_TOKEN))
  quicVarintPush(out, toI64(length))
  quicFrameAppend(out, token, 0, length)
  return true
}
