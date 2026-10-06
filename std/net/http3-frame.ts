/**
 * `nish/net/http3-frame` — the frames and stream types of HTTP/3 (RFC 9114
 * §6.2, §7): frame headers, SETTINGS, the one-identifier frames (GOAWAY,
 * MAX_PUSH_ID, CANCEL_PUSH), and which types are HTTP/2's reserved ones or
 * unknown. Sans-IO: every reader takes a byte window `(buf, off, len)` and
 * reads it in place, and every writer writes into the caller's buffer at an
 * offset, before an end, and answers the offset past what it wrote, or -1
 * with nothing written. Nothing here allocates.
 *
 *     import { Http3FrameHeader, h3ReadFrameHeader, h3PutFrameHeader, H3_FRAME_DATA } from "nish/net/http3-frame";
 *
 *     const h = new Http3FrameHeader();
 *     const size: i32 = h3ReadFrameHeader(h, buf, off, len);   // 0: the window ends inside the header
 *     // h.type, h.length; the payload is the next h.length bytes of the stream
 *     const at: i32 = h3PutFrameHeader(out, 0, toI32(out.length), H3_FRAME_DATA, toI64(n));
 *
 * **Frames** (§7.1) are a type and a length, each a QUIC variable-length
 * integer, and then that many bytes of payload. On a QUIC stream a frame may
 * arrive in any number of pieces, so a header is read only once both of its
 * integers are in the window (`h3ReadFrameHeader` answers 0 until then) and a
 * payload is the caller's to count down. The varints are
 * `nish/net/quic-packet`'s, which QUIC and HTTP/3 share.
 *
 * **Types.** DATA, HEADERS, CANCEL_PUSH, SETTINGS, PUSH_PROMISE, GOAWAY and
 * MAX_PUSH_ID are the seven RFC 9114 defines. The types HTTP/2 used with no
 * HTTP/3 counterpart (0x02 PRIORITY, 0x06 PING, 0x08 WINDOW_UPDATE, 0x09
 * CONTINUATION) are reserved, and receiving one is H3_FRAME_UNEXPECTED
 * (§7.2.8): `h3ReservedHttp2Frame` names them. Every other type is unknown,
 * the reserved `0x1f * N + 0x21` types that exercise that rule included
 * (§7.2.8, §9), and its frame is skipped whole wherever it arrives.
 *
 * **SETTINGS** (§7.2.4). `h3ReadSettings` reads a whole payload into an
 * `Http3Settings`: the three identifiers this endpoint understands, and the
 * first `H3_SETTINGS_KEEP` it does not, kept rather than dropped so that an
 * extension (WebTransport's, RFC 9220's) can read them. A payload that ends
 * inside a pair is H3_FRAME_ERROR (§7.1); an identifier HTTP/2 defined with
 * no HTTP/3 counterpart (0x00, 0x02 to 0x05), or one that appears twice, is
 * H3_SETTINGS_ERROR (§7.2.4, §7.2.4.1). A repeat among the unknown ones is
 * caught while they are kept, and past `H3_SETTINGS_KEEP` they are counted,
 * not compared, so a peer cannot make the read cost more than a fixed number
 * of compares per setting.
 *
 * **Stream types** (§6.2): control 0x00, push 0x01, and RFC 9204's QPACK
 * encoder 0x02 and decoder 0x03. Each is one varint at the start of a
 * unidirectional stream, written with `h3PutVarint`.
 *
 * **Error codes** (§8.1) are the `H3_*` values from 0x0100; QPACK's three
 * (0x0200 to 0x0202) are `nish/net/qpack`'s.
 *
 * Written from RFC 9114 §6.2, §7, §8.1 and §11.2, not ported from another
 * implementation. Private names carry the `h3Frame` prefix, since a `std/`
 * module's private functions share the importing program's flat symbol
 * namespace (`docs/wp26-stdlib.md` §3e).
 */
import { quicVarintLength, quicVarintPut, quicVarintRead, quicVarintSize } from "nish/net/quic-packet"

// ---- Frame types (§7.2, §11.2.1) ------------------------------------------------

/** DATA (§7.2.1): a piece of a message's content. */
export const H3_FRAME_DATA: i64 = 0x00
/** HEADERS (§7.2.2): a QPACK-encoded field section. */
export const H3_FRAME_HEADERS: i64 = 0x01
/** CANCEL_PUSH (§7.2.3): one push ID. */
export const H3_FRAME_CANCEL_PUSH: i64 = 0x03
/** SETTINGS (§7.2.4): identifier and value pairs, first on a control stream. */
export const H3_FRAME_SETTINGS: i64 = 0x04
/** PUSH_PROMISE (§7.2.5): a push ID and a request's field section; only a server sends it. */
export const H3_FRAME_PUSH_PROMISE: i64 = 0x05
/** GOAWAY (§7.2.6): a stream ID from a server, a push ID from a client. */
export const H3_FRAME_GOAWAY: i64 = 0x07
/** MAX_PUSH_ID (§7.2.7): the largest push ID a client lets a server use. */
export const H3_FRAME_MAX_PUSH_ID: i64 = 0x0d

// ---- Unidirectional stream types (§6.2, RFC 9204 §4.2) --------------------------

/** The control stream: SETTINGS first, then the connection's control frames. */
export const H3_STREAM_CONTROL: i64 = 0x00
/** A push stream, which only a server opens. */
export const H3_STREAM_PUSH: i64 = 0x01
/** QPACK's encoder stream. */
export const H3_STREAM_QPACK_ENCODER: i64 = 0x02
/** QPACK's decoder stream. */
export const H3_STREAM_QPACK_DECODER: i64 = 0x03

// ---- Settings (§7.2.4.1, RFC 9204 §5) -------------------------------------------

/** SETTINGS_QPACK_MAX_TABLE_CAPACITY. */
export const H3_SETTINGS_QPACK_MAX_TABLE_CAPACITY: i64 = 0x01
/** SETTINGS_MAX_FIELD_SECTION_SIZE: the largest field section the sender takes, as §4.2.2 counts it. */
export const H3_SETTINGS_MAX_FIELD_SECTION_SIZE: i64 = 0x06
/** SETTINGS_QPACK_BLOCKED_STREAMS. */
export const H3_SETTINGS_QPACK_BLOCKED_STREAMS: i64 = 0x07

/** How many identifiers `Http3Settings` keeps that it does not understand. */
export const H3_SETTINGS_KEEP: i32 = 8

// ---- Error codes (§8.1) ---------------------------------------------------------

/** What `h3ReadSettings` answers for a payload it read whole. */
export const H3_SETTINGS_OK: i64 = 0
export const H3_NO_ERROR: i64 = 0x0100
export const H3_GENERAL_PROTOCOL_ERROR: i64 = 0x0101
export const H3_INTERNAL_ERROR: i64 = 0x0102
export const H3_STREAM_CREATION_ERROR: i64 = 0x0103
export const H3_CLOSED_CRITICAL_STREAM: i64 = 0x0104
export const H3_FRAME_UNEXPECTED: i64 = 0x0105
export const H3_FRAME_ERROR: i64 = 0x0106
export const H3_EXCESSIVE_LOAD: i64 = 0x0107
export const H3_ID_ERROR: i64 = 0x0108
export const H3_SETTINGS_ERROR: i64 = 0x0109
export const H3_MISSING_SETTINGS: i64 = 0x010a
export const H3_REQUEST_REJECTED: i64 = 0x010b
export const H3_REQUEST_CANCELLED: i64 = 0x010c
export const H3_REQUEST_INCOMPLETE: i64 = 0x010d
export const H3_MESSAGE_ERROR: i64 = 0x010e
export const H3_CONNECT_ERROR: i64 = 0x010f
export const H3_VERSION_FALLBACK: i64 = 0x0110

/** The largest frame header: two eight-byte varints. */
export const H3_FRAME_HEADER_MAX: i32 = 16

/** The setting bits `Http3Settings.seen` records, one per identifier it understands. */
const H3_FRAME_SEEN_CAPACITY: i32 = 1
const H3_FRAME_SEEN_FIELD_SECTION: i32 = 2
const H3_FRAME_SEEN_BLOCKED: i32 = 4

/** A typed -1 and 0, since a bare literal is an `f64` under `--number-mode f64`. */
const H3_FRAME_NONE: i64 = -1
const H3_FRAME_ZERO: i32 = 0

/**
 * One frame header as `h3ReadFrameHeader` read it: the type, the payload's
 * length, and how many bytes the two varints took.
 */
export class Http3FrameHeader {
  type: i64 = 0
  length: i64 = 0
  size: i32 = 0
}

/**
 * The peer's SETTINGS as `h3ReadSettings` read them. The three it understands
 * hold RFC 9114's and RFC 9204's defaults until a frame sets them:
 * `maxFieldSectionSize` is -1, unlimited (§7.2.4.1). The first
 * `H3_SETTINGS_KEEP` identifiers it does not understand are kept with their
 * values, in order, and the rest counted in `dropped`.
 */
export class Http3Settings {
  unknownIds: i64[]
  unknownValues: i64[]
  maxTableCapacity: i64 = 0
  maxFieldSectionSize: i64 = -1
  blockedStreams: i64 = 0
  /** The bits of the identifiers understood that the frame set. */
  seen: i32 = 0
  /** How many unknown identifiers are kept. */
  unknownCount: i32 = 0
  /** How many more there were, saturating at 2^31 - 1. */
  dropped: i32 = 0

  constructor() {
    this.unknownIds = new Array<i64>(H3_SETTINGS_KEEP)
    this.unknownValues = new Array<i64>(H3_SETTINGS_KEEP)
  }

  /** Back to the defaults, for the next connection. */
  reset(): void {
    this.maxTableCapacity = 0
    this.maxFieldSectionSize = -1
    this.blockedStreams = 0
    this.seen = 0
    this.unknownCount = 0
    this.dropped = 0
  }

  /** The value of an identifier this module does not understand, or -1 when the frame did not carry it (or carried it past the kept ones). */
  unknown(id: i64): i64 {
    for (let k: i32 = 0; k < this.unknownCount && k < H3_SETTINGS_KEEP; k++) {
      if (this.unknownIds[k] === id) {
        return this.unknownValues[k]
      }
    }
    return H3_FRAME_NONE
  }

  /** Records one pair; answers `H3_SETTINGS_OK` or H3_SETTINGS_ERROR for a reserved or repeated identifier. */
  take(id: i64, value: i64): i64 {
    if (id === 0x00 || (id >= 0x02 && id <= 0x05)) {
      return H3_SETTINGS_ERROR
    }
    let bit: i32 = 0
    if (id === H3_SETTINGS_QPACK_MAX_TABLE_CAPACITY) {
      bit = H3_FRAME_SEEN_CAPACITY
      this.maxTableCapacity = value
    } else if (id === H3_SETTINGS_MAX_FIELD_SECTION_SIZE) {
      bit = H3_FRAME_SEEN_FIELD_SECTION
      this.maxFieldSectionSize = value
    } else if (id === H3_SETTINGS_QPACK_BLOCKED_STREAMS) {
      bit = H3_FRAME_SEEN_BLOCKED
      this.blockedStreams = value
    }
    if (bit !== 0) {
      if ((this.seen & bit) !== 0) {
        return H3_SETTINGS_ERROR
      }
      this.seen = this.seen | bit
      return H3_SETTINGS_OK
    }
    if (this.unknown(id) >= 0) {
      return H3_SETTINGS_ERROR
    }
    const at: i32 = this.unknownCount
    if (at >= 0 && at < H3_SETTINGS_KEEP) {
      this.unknownIds[at] = id
      this.unknownValues[at] = value
      this.unknownCount = at + 1
    } else if (this.dropped < 2147483647) {
      this.dropped = this.dropped + 1
    }
    return H3_SETTINGS_OK
  }
}

/** Panics unless `[off, off + len)` lies inside `buf`: a window outside its buffer is the program's mistake. */
const h3FrameCheckWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || toI64(off) + toI64(len) > toI64(buf.length)) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${buf.length} bytes`)
  }
}

/** Whether `[at, end)` is a usable place to write in `buf`. */
const h3FrameRoom = (buf: u8[], at: i32, end: i32): boolean =>
  at >= 0 && at <= end && end <= toI32(buf.length)

/**
 * The varint at `buf[at]`, read only from `buf[at .. end)`, or -1 when it
 * does not fit there. Advance past it by `h3VarintLength(buf, at)`.
 */
export const h3ReadVarint = (buf: u8[], at: i32, end: i32): i64 => quicVarintRead(buf, at, end)

/** The length of the varint whose first byte is `buf[at]`: 1, 2, 4 or 8, or 0 outside `buf`. */
export const h3VarintLength = (buf: u8[], at: i32): i32 => quicVarintLength(buf, at)

/**
 * Writes `value` as a varint in the fewest bytes at `buf[at]`, before `end`,
 * and answers the offset past it, or -1 when it does not fit or no varint
 * holds the value.
 */
export const h3PutVarint = (buf: u8[], at: i32, end: i32, value: i64): i32 => {
  const size: i32 = quicVarintSize(value)
  if (size === 0 || !h3FrameRoom(buf, at, end) || at > end - size) {
    return -1
  }
  return quicVarintPut(buf, at, value, size)
}

/** How many bytes a frame header of `type` and `length` takes, or 0 when either is no varint. */
export const h3FrameHeaderSize = (type: i64, length: i64): i32 => {
  const a: i32 = quicVarintSize(type)
  const b: i32 = quicVarintSize(length)
  return a === 0 || b === 0 ? H3_FRAME_ZERO : a + b
}

/**
 * Reads a frame header from `buf[off, off + len)` into `h` and answers how
 * many bytes it took, or 0 when the window ends inside it (and `h` is not
 * touched). Any type and any length up to 2^62 - 1 is a header; whether the
 * type is allowed where it arrived is the stream's question.
 */
export const h3ReadFrameHeader = (h: Http3FrameHeader, buf: u8[], off: i32, len: i32): i32 => {
  h3FrameCheckWindow("h3ReadFrameHeader", buf, off, len)
  const end: i32 = off + len
  const type: i64 = quicVarintRead(buf, off, end)
  if (type < 0) {
    return 0
  }
  const at: i32 = off + quicVarintLength(buf, off)
  const length: i64 = quicVarintRead(buf, at, end)
  if (length < 0) {
    return 0
  }
  h.type = type
  h.length = length
  h.size = at + quicVarintLength(buf, at) - off
  return h.size
}

/** Writes a frame header of `type` and `length` at `buf[at]`, before `end`; answers the offset past it, or -1. */
export const h3PutFrameHeader = (buf: u8[], at: i32, end: i32, type: i64, length: i64): i32 => {
  const size: i32 = h3FrameHeaderSize(type, length)
  if (size === 0 || !h3FrameRoom(buf, at, end) || at > end - size) {
    return -1
  }
  return h3PutVarint(buf, h3PutVarint(buf, at, end, type), end, length)
}

/** Whether `type` is one HTTP/2 used that HTTP/3 reserves, whose receipt is H3_FRAME_UNEXPECTED (§7.2.8). */
export const h3ReservedHttp2Frame = (type: i64): boolean =>
  type === 0x02 || type === 0x06 || type === 0x08 || type === 0x09

/** Whether `value` is one of the `0x1f * N + 0x21` values reserved to exercise the rule that unknowns are ignored (§7.2.8, §7.2.4.1, §6.2.3). */
export const h3Greased = (value: i64): boolean => value >= 0x21 && (value - 0x21) % 0x1f === 0

/**
 * Reads a whole SETTINGS payload, `buf[off, off + len)`, into `s` (which it
 * resets first). Answers `H3_SETTINGS_OK`, H3_FRAME_ERROR for a payload that
 * ends inside a pair (§7.1), or H3_SETTINGS_ERROR for a reserved or repeated
 * identifier (§7.2.4).
 */
export const h3ReadSettings = (s: Http3Settings, buf: u8[], off: i32, len: i32): i64 => {
  h3FrameCheckWindow("h3ReadSettings", buf, off, len)
  s.reset()
  const end: i32 = off + len
  let at: i32 = off
  while (at < end) {
    const id: i64 = quicVarintRead(buf, at, end)
    if (id < 0) {
      return H3_FRAME_ERROR
    }
    at = at + quicVarintLength(buf, at)
    const value: i64 = quicVarintRead(buf, at, end)
    if (value < 0) {
      return H3_FRAME_ERROR
    }
    at = at + quicVarintLength(buf, at)
    const result: i64 = s.take(id, value)
    if (result !== H3_SETTINGS_OK) {
      return result
    }
  }
  return H3_SETTINGS_OK
}

/**
 * Writes a whole SETTINGS frame of the pairs `ids[k]`, `values[k]` at
 * `buf[at]`, before `end`, and answers the offset past it, or -1 when it does
 * not fit, the lists differ in length, or a value is no varint. It writes
 * what it is given: refusing a reserved identifier is the reader's job.
 */
export const h3PutSettings = (buf: u8[], at: i32, end: i32, ids: i64[], values: i64[]): i32 => {
  const n: i32 = toI32(ids.length)
  if (n !== toI32(values.length)) {
    return -1
  }
  let length: i64 = 0
  for (let k: i32 = 0; k < n && k < toI32(ids.length) && k < toI32(values.length); k++) {
    const a: i32 = quicVarintSize(ids[k])
    const b: i32 = quicVarintSize(values[k])
    if (a === 0 || b === 0) {
      return -1
    }
    length = length + toI64(a + b)
  }
  let p: i32 = h3PutFrameHeader(buf, at, end, H3_FRAME_SETTINGS, length)
  if (p < 0 || toI64(p) + length > toI64(end)) {
    return -1
  }
  for (let k: i32 = 0; k < n && k < toI32(ids.length) && k < toI32(values.length); k++) {
    p = h3PutVarint(buf, p, end, ids[k])
    p = h3PutVarint(buf, p, end, values[k])
  }
  return p
}

/**
 * Writes a frame whose payload is one identifier — GOAWAY, MAX_PUSH_ID or
 * CANCEL_PUSH (§7.2.6, §7.2.7, §7.2.3) — at `buf[at]`, before `end`; answers
 * the offset past it, or -1.
 */
export const h3PutIdFrame = (buf: u8[], at: i32, end: i32, type: i64, id: i64): i32 => {
  const size: i32 = quicVarintSize(id)
  if (size === 0) {
    return -1
  }
  const p: i32 = h3PutFrameHeader(buf, at, end, type, toI64(size))
  return p < 0 ? -1 : h3PutVarint(buf, p, end, id)
}

/**
 * The identifier a GOAWAY, MAX_PUSH_ID or CANCEL_PUSH payload
 * `buf[off, off + len)` carries, or -1 when the payload is not exactly one
 * varint, which is H3_FRAME_ERROR (§7.1).
 */
export const h3ReadIdPayload = (buf: u8[], off: i32, len: i32): i64 => {
  h3FrameCheckWindow("h3ReadIdPayload", buf, off, len)
  const id: i64 = quicVarintRead(buf, off, off + len)
  return id >= 0 && quicVarintLength(buf, off) === len ? id : H3_FRAME_NONE
}
