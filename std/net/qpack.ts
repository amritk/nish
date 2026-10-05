/**
 * `nish/net/qpack` — QPACK, the field compression of HTTP/3, as RFC 9204
 * defines it with a dynamic table of capacity 0: the Appendix A static table,
 * the §4.1.1 prefixed integer up to 62 bits, the §4.1.2 string literal with an
 * N-bit prefix, the §4.5 field-line representations under a Required Insert
 * Count of 0, and what the encoder and decoder streams of §4.2 may carry when
 * neither side ever inserts.
 *
 *     import { QpackDecoder, QpackEncoder, QPACK_OK } from "nish/net/qpack";
 *
 *     const enc = new QpackEncoder();                     // one per connection
 *     const section: u8[] = [];
 *     enc.beginSection(section);
 *     enc.encodeField(section, name, 0, toI32(name.length), value, 0, toI32(value.length), false, true);
 *
 *     const dec = new QpackDecoder(16384);                // one per connection, reused
 *     if (dec.decode(section, 0, toI32(section.length)) === QPACK_OK) {
 *       // field i: dec.bytes[dec.nameStart[i], + dec.nameLength[i]), and the value alike
 *     }
 *
 * **Capacity 0 is the whole dynamic table.** This endpoint advertises
 * SETTINGS_QPACK_MAX_TABLE_CAPACITY 0 (the default, §5), so a peer's encoder
 * may never insert, every field section it sends has a Required Insert Count
 * of 0, and nothing in it may name the dynamic table. Its own encoder never
 * inserts either, whatever the peer allows, so the field sections it writes
 * begin `00 00` and reference the static table alone. That is what lets a
 * stream be decoded the moment its HEADERS frame is whole: there is nothing to
 * block on (§2.1.2) and nothing to acknowledge (§4.4.1).
 *
 * **What is refused.** `QpackDecoder.decode` answers QPACK_DECOMPRESSION_FAILED
 * for a section that ends inside a representation, an integer past 2^62 - 1
 * (or padded past the nine continuation bytes such an integer needs), a
 * non-zero Required Insert Count (§4.5.1.1), a negative Base (§4.5.1.2), any
 * reference to the dynamic table, relative or post-Base (§2.2.3), a static
 * index past 98, and Huffman padding that is not EOS's prefix or an EOS inside
 * a string. `receiveEncoderStream` answers QPACK_ENCODER_STREAM_ERROR for a Set
 * Dynamic Table Capacity above 0 (§4.3.1), any Insert (§3.2.2: every entry is
 * larger than the table) and any Duplicate (§2.2.3: there is nothing to
 * duplicate). The encoder's `receiveDecoderStream` answers
 * QPACK_DECODER_STREAM_ERROR for a Section Acknowledgment (§4.4.1: no section
 * it sent needs one), any Insert Count Increment (§4.4.3: it has inserted
 * nothing) and a stream ID past 2^62 - 1. Each of those is a connection error,
 * so each is sticky: the same answer comes back from every later call without
 * reading anything, and `reason` says which rule it was (`QPACK_REASON_*`).
 *
 * **What is accepted.** A Set Dynamic Table Capacity of 0 on the encoder
 * stream, and a Stream Cancellation on the decoder stream, read a byte at a
 * time so that an instruction may be split across STREAM frames anywhere. The
 * only instruction this endpoint may want to send is a Stream Cancellation on
 * its own decoder stream, which §4.2 lets a decoder of capacity 0 omit; it is
 * `qpackPushStreamCancellation`. Opening the two streams (types
 * `QPACK_ENCODER_STREAM` and `QPACK_DECODER_STREAM`) and refusing a second one
 * of either are HTTP/3's.
 *
 * A field section larger than the decoder's limit — each field its name, its
 * value and 32 bytes, as SETTINGS_MAX_FIELD_SECTION_SIZE counts it (RFC 9114
 * §4.2.2) — answers `QPACK_SECTION_TOO_LARGE`, which is negative because it is
 * not one of the RFC's codes: no table depends on the section, so decoding
 * stops there, nothing is kept, and the next section decodes normally. HTTP/3
 * answers it with a 431, not by closing the connection.
 *
 * **Byte windows, and nothing allocated per section.** Names and values go in
 * as windows `(buf, off, len)` and come out as windows into the decoder's own
 * `bytes`, which holds every name and value of the last section back to back.
 * The decoder's arrays are emptied with `pop`, which keeps their storage, so a
 * connection's decoder stops allocating once it has seen its largest section
 * (WP34 N9). A window outside its buffer is the program's mistake and panics.
 *
 * The Huffman code is RFC 7541 Appendix B's, which §4.1.2 uses unmodified, and
 * comes from `nish/net/hpack` rather than a copy. The integers are this
 * module's own because QPACK needs 62 bits and HPACK's stop at 31.
 *
 * Written from RFC 9204, not ported from another implementation. Private
 * names carry the `qpack` prefix because a `std/` module's private functions
 * share the importing program's flat symbol namespace (`docs/wp26-stdlib.md`
 * §3e).
 */
import {
  HPACK_OK,
  HpackHuffman,
  hpackHuffmanDecode,
  hpackHuffmanEncode,
  hpackHuffmanLength,
} from "nish/net/hpack"

/** A call that met nothing to refuse. */
export const QPACK_OK: i64 = 0

/**
 * A field section past the decoder's size limit. Not one of RFC 9204's codes
 * and not fatal: HTTP/3 answers the request with a 431.
 */
export const QPACK_SECTION_TOO_LARGE: i64 = -1

/** The decoder could not interpret a field section (§6). */
export const QPACK_DECOMPRESSION_FAILED: i64 = 0x0200

/** The decoder could not interpret an instruction on the encoder stream (§6). */
export const QPACK_ENCODER_STREAM_ERROR: i64 = 0x0201

/** The encoder could not interpret an instruction on the decoder stream (§6). */
export const QPACK_DECODER_STREAM_ERROR: i64 = 0x0202

/** The unidirectional stream type of an encoder stream (§4.2). */
export const QPACK_ENCODER_STREAM: i64 = 0x02

/** The unidirectional stream type of a decoder stream (§4.2). */
export const QPACK_DECODER_STREAM: i64 = 0x03

/** SETTINGS_QPACK_MAX_TABLE_CAPACITY's identifier (§5); this module's value is 0. */
export const QPACK_SETTINGS_MAX_TABLE_CAPACITY: i64 = 0x01

/** SETTINGS_QPACK_BLOCKED_STREAMS's identifier (§5); with no table nothing blocks, so 0. */
export const QPACK_SETTINGS_BLOCKED_STREAMS: i64 = 0x07

/** The number of entries in the static table, indexes 0 to 98 (Appendix A). */
export const QPACK_STATIC_LENGTH: i32 = 99

/** What a field costs a field section beyond its name and value (RFC 9114 §4.2.2). */
export const QPACK_FIELD_OVERHEAD: i32 = 32

/** Nothing refused yet. */
export const QPACK_REASON_NONE: i32 = 0

/** The bytes ended inside a representation, an integer or a string. */
export const QPACK_REASON_TRUNCATED: i32 = 1

/** An integer past 2^62 - 1, or padded past nine continuation bytes (§4.1.1). */
export const QPACK_REASON_INTEGER: i32 = 2

/** A field section whose Required Insert Count is not 0 (§4.5.1.1). */
export const QPACK_REASON_INSERT_COUNT: i32 = 3

/** A field section whose Base is negative (§4.5.1.2). */
export const QPACK_REASON_BASE: i32 = 4

/** A field line naming the dynamic table, by relative or post-Base index (§2.2.3). */
export const QPACK_REASON_DYNAMIC: i32 = 5

/** A static index past 98 (§3.1). */
export const QPACK_REASON_STATIC_INDEX: i32 = 6

/** Huffman padding that is not a prefix of EOS, or EOS inside a string (RFC 7541 §5.2). */
export const QPACK_REASON_HUFFMAN: i32 = 7

/** A Set Dynamic Table Capacity above 0 (§4.3.1). */
export const QPACK_REASON_CAPACITY: i32 = 8

/** An Insert with Name Reference or with Literal Name (§3.2.2, §4.3.2, §4.3.3). */
export const QPACK_REASON_INSERT: i32 = 9

/** A Duplicate (§4.3.4). */
export const QPACK_REASON_DUPLICATE: i32 = 10

/** A Section Acknowledgment (§4.4.1). */
export const QPACK_REASON_ACKNOWLEDGMENT: i32 = 11

/** An Insert Count Increment (§4.4.3). */
export const QPACK_REASON_INCREMENT: i32 = 12

/**
 * 2^62 - 1, the largest integer §4.1.1 requires. Spelled as a product: an
 * `i64` literal past 2^53 is refused. It is `QUIC_MAX_VARINT`'s value, kept
 * here rather than imported so that QPACK does not pull in QUIC's packet
 * protection for one constant.
 */
const QPACK_MAX_INTEGER: i64 = 1073741824 * 4294967296 - 1

/** What `qpackReadInteger` answers for bytes that end inside the integer. */
const QPACK_INTEGER_TRUNCATED: i64 = -1

/** What `qpackReadInteger` answers for an integer past `QPACK_MAX_INTEGER`. */
const QPACK_INTEGER_OVERFLOW: i64 = -2

/**
 * Appendix A's names, by index. A `switch` rather than a table because a
 * module constant cannot be an array
 * ([LANGUAGE.md](../../docs/LANGUAGE.md#module-constants)). Entries that
 * share a name share an arm.
 */
const qpackStaticName = (index: i32): string => {
  switch (index) {
    case 0:
      return ":authority"
    case 1:
      return ":path"
    case 2:
      return "age"
    case 3:
      return "content-disposition"
    case 4:
      return "content-length"
    case 5:
      return "cookie"
    case 6:
      return "date"
    case 7:
      return "etag"
    case 8:
      return "if-modified-since"
    case 9:
      return "if-none-match"
    case 10:
      return "last-modified"
    case 11:
      return "link"
    case 12:
      return "location"
    case 13:
      return "referer"
    case 14:
      return "set-cookie"
    case 15:
    case 16:
    case 17:
    case 18:
    case 19:
    case 20:
    case 21:
      return ":method"
    case 22:
    case 23:
      return ":scheme"
    case 24:
    case 25:
    case 26:
    case 27:
    case 28:
    case 63:
    case 64:
    case 65:
    case 66:
    case 67:
    case 68:
    case 69:
    case 70:
    case 71:
      return ":status"
    case 29:
    case 30:
      return "accept"
    case 31:
      return "accept-encoding"
    case 32:
      return "accept-ranges"
    case 33:
    case 34:
    case 75:
      return "access-control-allow-headers"
    case 35:
      return "access-control-allow-origin"
    case 36:
    case 37:
    case 38:
    case 39:
    case 40:
    case 41:
      return "cache-control"
    case 42:
    case 43:
      return "content-encoding"
    case 44:
    case 45:
    case 46:
    case 47:
    case 48:
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
      return "content-type"
    case 55:
      return "range"
    case 56:
    case 57:
    case 58:
      return "strict-transport-security"
    case 59:
    case 60:
      return "vary"
    case 61:
      return "x-content-type-options"
    case 62:
      return "x-xss-protection"
    case 72:
      return "accept-language"
    case 73:
    case 74:
      return "access-control-allow-credentials"
    case 76:
    case 77:
    case 78:
      return "access-control-allow-methods"
    case 79:
      return "access-control-expose-headers"
    case 80:
      return "access-control-request-headers"
    case 81:
    case 82:
      return "access-control-request-method"
    case 83:
      return "alt-svc"
    case 84:
      return "authorization"
    case 85:
      return "content-security-policy"
    case 86:
      return "early-data"
    case 87:
      return "expect-ct"
    case 88:
      return "forwarded"
    case 89:
      return "if-range"
    case 90:
      return "origin"
    case 91:
      return "purpose"
    case 92:
      return "server"
    case 93:
      return "timing-allow-origin"
    case 94:
      return "upgrade-insecure-requests"
    case 95:
      return "user-agent"
    case 96:
      return "x-forwarded-for"
    default:
      return "x-frame-options"
  }
}

/** Appendix A's values, by index; the entries with none answer the empty string. */
const qpackStaticValue = (index: i32): string => {
  switch (index) {
    case 1:
      return "/"
    case 2:
      return "0"
    case 4:
      return "0"
    case 15:
      return "CONNECT"
    case 16:
      return "DELETE"
    case 17:
      return "GET"
    case 18:
      return "HEAD"
    case 19:
      return "OPTIONS"
    case 20:
      return "POST"
    case 21:
      return "PUT"
    case 22:
      return "http"
    case 23:
      return "https"
    case 24:
      return "103"
    case 25:
      return "200"
    case 26:
      return "304"
    case 27:
      return "404"
    case 28:
      return "503"
    case 29:
      return "*/*"
    case 30:
      return "application/dns-message"
    case 31:
      return "gzip, deflate, br"
    case 32:
      return "bytes"
    case 33:
      return "cache-control"
    case 34:
      return "content-type"
    case 35:
      return "*"
    case 36:
      return "max-age=0"
    case 37:
      return "max-age=2592000"
    case 38:
      return "max-age=604800"
    case 39:
      return "no-cache"
    case 40:
      return "no-store"
    case 41:
      return "public, max-age=31536000"
    case 42:
      return "br"
    case 43:
      return "gzip"
    case 44:
      return "application/dns-message"
    case 45:
      return "application/javascript"
    case 46:
      return "application/json"
    case 47:
      return "application/x-www-form-urlencoded"
    case 48:
      return "image/gif"
    case 49:
      return "image/jpeg"
    case 50:
      return "image/png"
    case 51:
      return "text/css"
    case 52:
      return "text/html; charset=utf-8"
    case 53:
      return "text/plain"
    case 54:
      return "text/plain;charset=utf-8"
    case 55:
      return "bytes=0-"
    case 56:
      return "max-age=31536000"
    case 57:
      return "max-age=31536000; includesubdomains"
    case 58:
      return "max-age=31536000; includesubdomains; preload"
    case 59:
      return "accept-encoding"
    case 60:
      return "origin"
    case 61:
      return "nosniff"
    case 62:
      return "1; mode=block"
    case 63:
      return "100"
    case 64:
      return "204"
    case 65:
      return "206"
    case 66:
      return "302"
    case 67:
      return "400"
    case 68:
      return "403"
    case 69:
      return "421"
    case 70:
      return "425"
    case 71:
      return "500"
    case 73:
      return "FALSE"
    case 74:
      return "TRUE"
    case 75:
      return "*"
    case 76:
      return "get"
    case 77:
      return "get, post, options"
    case 78:
      return "options"
    case 79:
      return "content-length"
    case 80:
      return "content-type"
    case 81:
      return "get"
    case 82:
      return "post"
    case 83:
      return "clear"
    case 85:
      return "script-src 'none'; object-src 'none'; base-uri 'none'"
    case 86:
      return "1"
    case 91:
      return "prefetch"
    case 93:
      return "*"
    case 94:
      return "1"
    case 97:
      return "deny"
    case 98:
      return "sameorigin"
    default:
      return ""
  }
}
/** Panics unless `buf[off, off + len)` lies inside `buf`. */
const qpackCheckWindow = (where: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || toI64(off) + toI64(len) > toI64(buf.length)) {
    panic(`${where}: the window [${off}, ${off} + ${len}) is outside a buffer of ${buf.length} bytes`)
  }
}

/** Whether `buf[off, off + len)` spells `text`, which is ASCII. */
const qpackSameText = (buf: u8[], off: i32, len: i32, text: string): boolean => {
  if (len !== toI32(text.length)) {
    return false
  }
  for (let i: i32 = 0; i < len && i < toI32(text.length); i += 1) {
    const at: i32 = off + i
    if (at < 0 || at >= toI32(buf.length) || toI32(buf[at]) !== toI32(text.charCodeAt(i))) {
      return false
    }
  }
  return true
}

/** Appends the bytes of `text`, which is ASCII. */
const qpackPushText = (out: u8[], text: string): void => {
  const n: i32 = toI32(text.length)
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)))
  }
}

/** Appends `src[off, off + len)` to `out`. */
const qpackPushBytes = (out: u8[], src: u8[], off: i32, len: i32): void => {
  const end: i32 = off + len
  for (let i: i32 = off; i >= 0 && i < end && i < toI32(src.length); i += 1) {
    out.push(src[i])
  }
}

/**
 * Appends `value` as a §4.1.1 integer with a `prefixBits`-bit prefix, the first
 * byte's high bits being `flags`. A value outside 0 to 2^62 - 1, or a prefix
 * outside 1 to 8 bits, panics: both are the program's choice.
 */
const qpackPushInteger = (out: u8[], flags: i32, prefixBits: i32, value: i64): void => {
  if (prefixBits < 1 || prefixBits > 8 || value < 0 || value > QPACK_MAX_INTEGER) {
    panic(`qpackPushInteger: a value of ${value} with a ${prefixBits}-bit prefix`)
  }
  const max: i32 = (1 << prefixBits) - 1
  if (value < toI64(max)) {
    out.push(toU8(flags | toI32(value)))
    return
  }
  out.push(toU8(flags | max))
  let rest: i64 = value - toI64(max)
  while (rest >= toI64(128)) {
    out.push(toU8(toI32(rest & toI64(127)) | 128))
    rest = rest >> toI64(7)
  }
  out.push(toU8(toI32(rest)))
}

/**
 * Appends `src[off, off + len)` as a §4.1.2 string literal with a
 * `prefixBits`-bit prefix: the Huffman flag is the prefix's top bit, the
 * length the `prefixBits - 1` bits below it, and `flags` the bits above.
 * When `huffman` is true the string is Huffman-coded if that makes it
 * shorter, and sent raw otherwise, as an empty string always is.
 */
const qpackPushString = (
  h: HpackHuffman,
  out: u8[],
  flags: i32,
  prefixBits: i32,
  src: u8[],
  off: i32,
  len: i32,
  huffman: boolean
): void => {
  const lengthBits: i32 = prefixBits - 1
  const coded: i32 = huffman ? hpackHuffmanLength(h, src, off, len) : len
  if (coded < len) {
    qpackPushInteger(out, flags | (1 << lengthBits), lengthBits, toI64(coded))
    hpackHuffmanEncode(h, src, off, len, out)
    return
  }
  qpackPushInteger(out, flags, lengthBits, toI64(len))
  qpackPushBytes(out, src, off, len)
}

/**
 * Appends a Stream Cancellation for `streamId` (§4.4.2), the one instruction a
 * decoder of capacity 0 may send on its decoder stream, and may also omit.
 * A stream ID outside 0 to 2^62 - 1 panics.
 */
export const qpackPushStreamCancellation = (out: u8[], streamId: i64): void => {
  qpackPushInteger(out, 64, 6, streamId)
}

/** Whether the section being decoded has a byte left at `d.at`. */
const qpackHasByte = (d: QpackDecoder, src: u8[]): boolean =>
  d.at >= 0 && d.at < d.end && d.at < toI32(src.length)

/** The `QPACK_REASON_*` for a negative `qpackReadInteger` answer. */
const qpackIntegerReason = (status: i64): i32 =>
  status === QPACK_INTEGER_TRUNCATED ? QPACK_REASON_TRUNCATED : QPACK_REASON_INTEGER

/**
 * Reads a §4.1.1 integer whose prefix is the low `prefixBits` bits of the
 * byte at `d.at`, and answers it, or `QPACK_INTEGER_TRUNCATED` or
 * `QPACK_INTEGER_OVERFLOW`. Nine continuation bytes carry 63 bits, so a
 * tenth is refused even when its bits are zero.
 */
const qpackReadInteger = (d: QpackDecoder, src: u8[], prefixBits: i32): i64 => {
  if (!qpackHasByte(d, src)) {
    return QPACK_INTEGER_TRUNCATED
  }
  const max: i32 = (1 << prefixBits) - 1
  const first: i32 = toI32(src[d.at]) & max
  d.at += 1
  if (first < max) {
    return toI64(first)
  }
  let value: i64 = toI64(max)
  for (let shift: i32 = 0; shift <= 56; shift += 7) {
    if (!qpackHasByte(d, src)) {
      return QPACK_INTEGER_TRUNCATED
    }
    const b: i32 = toI32(src[d.at])
    d.at += 1
    const digit: i64 = toI64(b & 127)
    if (digit > (QPACK_MAX_INTEGER - value) >> toI64(shift)) {
      return QPACK_INTEGER_OVERFLOW
    }
    value += digit << toI64(shift)
    if ((b & 128) === 0) {
      return value
    }
  }
  return QPACK_INTEGER_OVERFLOW
}

/**
 * Reads a §4.1.2 string literal with a `prefixBits`-bit prefix at `d.at` and
 * appends its octets to `d.bytes`, answering a `QPACK_REASON_*`, `NONE` when
 * it read one. The length is checked against what the section has left
 * before anything is read, so a Huffman string costs at most 8/5 of the
 * bytes the section spent on it.
 */
const qpackReadString = (d: QpackDecoder, src: u8[], prefixBits: i32): i32 => {
  if (!qpackHasByte(d, src)) {
    return QPACK_REASON_TRUNCATED
  }
  const lengthBits: i32 = prefixBits - 1
  const huffman: boolean = (toI32(src[d.at]) & (1 << lengthBits)) !== 0
  const n: i64 = qpackReadInteger(d, src, lengthBits)
  if (n < 0) {
    return qpackIntegerReason(n)
  }
  if (n > toI64(d.end - d.at)) {
    return QPACK_REASON_TRUNCATED
  }
  const start: i32 = d.at
  const end: i32 = start + toI32(n)
  d.at = end
  if (huffman) {
    return hpackHuffmanDecode(d.huffman, src, start, end - start, d.bytes) === HPACK_OK
      ? QPACK_REASON_NONE
      : QPACK_REASON_HUFFMAN
  }
  qpackPushBytes(d.bytes, src, start, end - start)
  return QPACK_REASON_NONE
}

/**
 * One HTTP/3 connection's receiving side: the field sections the peer's
 * encoder sends on request streams, and the peer's encoder stream.
 *
 * `decode` answers a section's fields as windows into `bytes`: field `i`'s
 * name is `bytes[nameStart[i], + nameLength[i])`, its value likewise, and
 * `neverIndexed[i]` is its N bit, which an intermediary forwarding it must
 * keep (§4.5.4). All of them are replaced by every call.
 */
export class QpackDecoder {
  huffman: HpackHuffman
  /** The connection error a call met, which every later call answers; `QPACK_OK` until then. */
  failed: i64
  bytes: u8[]
  nameStart: i32[]
  nameLength: i32[]
  valueStart: i32[]
  valueLength: i32[]
  neverIndexed: boolean[]
  /** SETTINGS_MAX_FIELD_SECTION_SIZE as RFC 9114 §4.2.2 counts it. */
  maxFieldSectionSize: i32
  /** Which rule `failed` broke, a `QPACK_REASON_*`. */
  reason: i32
  /** How many Set Dynamic Table Capacity 0 instructions the encoder stream carried. */
  capacityInstructions: i32
  /** How many fields the last `decode` answered. */
  count: i32
  /** Where the next read of the section being decoded starts, and where it ends. */
  at: i32
  end: i32

  constructor(maxFieldSectionSize: i32) {
    if (maxFieldSectionSize < 0) {
      panic(`QpackDecoder: a field-section limit of ${maxFieldSectionSize}`)
    }
    this.huffman = new HpackHuffman()
    this.maxFieldSectionSize = maxFieldSectionSize
    this.failed = QPACK_OK
    this.reason = QPACK_REASON_NONE
    this.capacityInstructions = 0
    this.bytes = []
    this.nameStart = []
    this.nameLength = []
    this.valueStart = []
    this.valueLength = []
    this.neverIndexed = []
    this.count = 0
    this.at = 0
    this.end = 0
  }

  /**
   * Decodes one whole field section, `section[off, off + len)`, and answers
   * `QPACK_OK`, `QPACK_SECTION_TOO_LARGE` or QPACK_DECOMPRESSION_FAILED; the
   * module comment lists what each means. A decoder whose encoder stream was
   * refused answers QPACK_ENCODER_STREAM_ERROR again instead, since the
   * connection is closing. Anything but `QPACK_OK` leaves no fields.
   */
  decode(section: u8[], off: i32, len: i32): i64 {
    qpackCheckWindow("QpackDecoder.decode", section, off, len)
    this.clear()
    if (this.failed !== QPACK_OK) {
      return this.failed
    }
    this.at = off
    this.end = off + len
    const result: i64 = this.decodeLines(section)
    if (result !== QPACK_OK) {
      this.clear()
    }
    if (result === QPACK_DECOMPRESSION_FAILED) {
      this.failed = result
    }
    return result
  }

  /**
   * Reads the encoder stream's next bytes, `buf[off, off + len)`, and answers
   * `QPACK_OK` or QPACK_ENCODER_STREAM_ERROR (or, once a section was refused,
   * QPACK_DECOMPRESSION_FAILED again). At capacity 0 the one
   * instruction a peer may send is Set Dynamic Table Capacity 0, the single
   * byte `0x20`, so every other first byte is refused on sight: its top bits
   * already say which instruction it begins, and none of them can be valid.
   */
  receiveEncoderStream(buf: u8[], off: i32, len: i32): i64 {
    qpackCheckWindow("QpackDecoder.receiveEncoderStream", buf, off, len)
    if (this.failed !== QPACK_OK) {
      return this.failed
    }
    const end: i32 = off + len
    for (let i: i32 = off; i >= 0 && i < end && i < toI32(buf.length); i += 1) {
      const b: i32 = toI32(buf[i])
      if (b === 32) {
        this.capacityInstructions += 1
      } else {
        if ((b & 192) !== 0) {
          this.reason = QPACK_REASON_INSERT
        } else if ((b & 32) !== 0) {
          this.reason = QPACK_REASON_CAPACITY
        } else {
          this.reason = QPACK_REASON_DUPLICATE
        }
        this.failed = QPACK_ENCODER_STREAM_ERROR
        return this.failed
      }
    }
    return QPACK_OK
  }

  /** Empties the fields, keeping the arrays' storage for the next section. */
  clear(): void {
    while (this.bytes.length > 0) {
      this.bytes.pop()
    }
    while (this.nameStart.length > 0) {
      this.nameStart.pop()
    }
    while (this.nameLength.length > 0) {
      this.nameLength.pop()
    }
    while (this.valueStart.length > 0) {
      this.valueStart.pop()
    }
    while (this.valueLength.length > 0) {
      this.valueLength.pop()
    }
    while (this.neverIndexed.length > 0) {
      this.neverIndexed.pop()
    }
    this.count = 0
  }

  /** Records `reason` and answers QPACK_DECOMPRESSION_FAILED. */
  refuse(reason: i32): i64 {
    this.reason = reason
    return QPACK_DECOMPRESSION_FAILED
  }

  /** The refusal for a negative `qpackReadInteger` answer. */
  refuseInteger(status: i64): i64 {
    return this.refuse(qpackIntegerReason(status))
  }

  /** Records a field whose name and value end where `bytes` ends now. */
  addField(nameStart: i32, valueStart: i32, neverIndexed: boolean): void {
    this.nameStart.push(nameStart)
    this.nameLength.push(valueStart - nameStart)
    this.valueStart.push(valueStart)
    this.valueLength.push(toI32(this.bytes.length) - valueStart)
    this.neverIndexed.push(neverIndexed)
    this.count += 1
  }

  /**
   * The body of `decode`: the prefix, then one pass over the field lines,
   * each told apart by its first byte's pattern (§4.5.2 to §4.5.6).
   */
  decodeLines(src: u8[]): i64 {
    const insertCount: i64 = qpackReadInteger(this, src, 8)
    if (insertCount < 0) {
      return this.refuseInteger(insertCount)
    }
    if (insertCount !== toI64(0)) {
      return this.refuse(QPACK_REASON_INSERT_COUNT)
    }
    if (!qpackHasByte(this, src)) {
      return this.refuse(QPACK_REASON_TRUNCATED)
    }
    // With a Required Insert Count of 0, a Sign bit of 1 makes the Base
    // 0 - Delta Base - 1, which is negative whatever Delta Base is. A Base of
    // 0 or more is accepted at any value, since nothing may use it (§4.5.1.2).
    const negative: boolean = (toI32(src[this.at]) & 128) !== 0
    const deltaBase: i64 = qpackReadInteger(this, src, 7)
    if (deltaBase < 0) {
      return this.refuseInteger(deltaBase)
    }
    if (negative) {
      return this.refuse(QPACK_REASON_BASE)
    }
    let size: i64 = 0
    while (qpackHasByte(this, src)) {
      const b: i32 = toI32(src[this.at])
      let neverIndexed: boolean = false
      const nameStart: i32 = toI32(this.bytes.length)
      // Where the value starts once it is in `bytes`; -1 while it is still to
      // be read as a string literal, which every form but the indexed one has.
      let valueStart: i32 = -1
      if ((b & 128) !== 0) {
        // Indexed Field Line (§4.5.2): `1 T index(6+)`.
        if ((b & 64) === 0) {
          return this.refuse(QPACK_REASON_DYNAMIC)
        }
        const index: i64 = qpackReadInteger(this, src, 6)
        if (index < 0) {
          return this.refuseInteger(index)
        }
        if (index >= toI64(QPACK_STATIC_LENGTH)) {
          return this.refuse(QPACK_REASON_STATIC_INDEX)
        }
        qpackPushText(this.bytes, qpackStaticName(toI32(index)))
        valueStart = toI32(this.bytes.length)
        qpackPushText(this.bytes, qpackStaticValue(toI32(index)))
      } else if ((b & 64) !== 0) {
        // Literal Field Line with Name Reference (§4.5.4): `01 N T index(4+)`.
        if ((b & 16) === 0) {
          return this.refuse(QPACK_REASON_DYNAMIC)
        }
        neverIndexed = (b & 32) !== 0
        const index: i64 = qpackReadInteger(this, src, 4)
        if (index < 0) {
          return this.refuseInteger(index)
        }
        if (index >= toI64(QPACK_STATIC_LENGTH)) {
          return this.refuse(QPACK_REASON_STATIC_INDEX)
        }
        qpackPushText(this.bytes, qpackStaticName(toI32(index)))
      } else if ((b & 32) !== 0) {
        // Literal Field Line with Literal Name (§4.5.6): `001 N H length(3+)`.
        neverIndexed = (b & 16) !== 0
        const status: i32 = qpackReadString(this, src, 4)
        if (status !== QPACK_REASON_NONE) {
          return this.refuse(status)
        }
      } else {
        // `0001` is an Indexed Field Line with Post-Base Index (§4.5.3) and
        // `0000` a Literal Field Line with Post-Base Name Reference (§4.5.5):
        // both name the dynamic table.
        return this.refuse(QPACK_REASON_DYNAMIC)
      }
      if (valueStart < 0) {
        valueStart = toI32(this.bytes.length)
        const status: i32 = qpackReadString(this, src, 8)
        if (status !== QPACK_REASON_NONE) {
          return this.refuse(status)
        }
      }
      size += toI64(this.bytes.length) - toI64(nameStart) + toI64(QPACK_FIELD_OVERHEAD)
      if (size > toI64(this.maxFieldSectionSize)) {
        return QPACK_SECTION_TOO_LARGE
      }
      this.addField(nameStart, valueStart, neverIndexed)
    }
    return QPACK_OK
  }
}

/**
 * One HTTP/3 connection's sending side: field sections that reference the
 * static table alone, and the peer's decoder stream.
 *
 * It never inserts, so it needs no state for the peer's table capacity or its
 * blocked-streams limit, whatever the peer's SETTINGS allow, and it never sends
 * anything on its own encoder stream once the stream type is written.
 */
export class QpackEncoder {
  huffman: HpackHuffman
  /** The connection error the decoder stream met, which every later call answers. */
  failed: i64
  /** Which rule `failed` broke, a `QPACK_REASON_*`. */
  reason: i32
  /** How many Stream Cancellations the decoder stream carried, and the last one's stream. */
  cancellations: i32
  lastCancelled: i64
  /** The stream ID of a Stream Cancellation still being read, and its next shift; -1 between instructions. */
  pendingId: i64
  pendingShift: i32

  constructor() {
    this.huffman = new HpackHuffman()
    this.failed = QPACK_OK
    this.reason = QPACK_REASON_NONE
    this.cancellations = 0
    this.lastCancelled = -1
    this.pendingId = 0
    this.pendingShift = -1
  }

  /**
   * Appends the prefix every field section of this encoder begins with: a
   * Required Insert Count of 0 and a Base of 0, the bytes `00 00`.
   */
  beginSection(out: u8[]): void {
    out.push(0)
    out.push(0)
  }

  /**
   * Appends one field line, `name[nameOff, + nameLen)` and
   * `value[valueOff, + valueLen)`, to the section in `out`. A field the static
   * table holds whole is one Indexed Field Line; otherwise it is a literal,
   * with its name by static index when the table has the name, the lowest
   * index first, and each of its strings Huffman-coded when `huffman` is
   * true and the code is the shorter spelling.
   *
   * A field marked `neverIndexed` is always a literal with the N bit set, even
   * when the static table holds it, so that an intermediary re-encoding it
   * keeps it out of every dynamic table downstream (§4.5.4, §7.1.3).
   */
  encodeField(
    out: u8[],
    name: u8[],
    nameOff: i32,
    nameLen: i32,
    value: u8[],
    valueOff: i32,
    valueLen: i32,
    neverIndexed: boolean,
    huffman: boolean
  ): void {
    qpackCheckWindow("QpackEncoder.encodeField", name, nameOff, nameLen)
    qpackCheckWindow("QpackEncoder.encodeField", value, valueOff, valueLen)
    let nameIndex: i32 = -1
    for (let i: i32 = 0; i < QPACK_STATIC_LENGTH; i += 1) {
      if (qpackSameText(name, nameOff, nameLen, qpackStaticName(i))) {
        if (!neverIndexed && qpackSameText(value, valueOff, valueLen, qpackStaticValue(i))) {
          qpackPushInteger(out, 192, 6, toI64(i))
          return
        }
        if (nameIndex < 0) {
          nameIndex = i
        }
        if (neverIndexed) {
          // A never-indexed field is a literal whatever the table holds, so
          // the lowest index with its name is all there is to find.
          break
        }
      }
    }
    // `01 N 1` for a static name reference, `001 N` for a literal name.
    if (nameIndex >= 0) {
      qpackPushInteger(out, neverIndexed ? 112 : 80, 4, toI64(nameIndex))
    } else {
      qpackPushString(this.huffman, out, neverIndexed ? 48 : 32, 4, name, nameOff, nameLen, huffman)
    }
    qpackPushString(this.huffman, out, 0, 8, value, valueOff, valueLen, huffman)
  }

  /**
   * Reads the decoder stream's next bytes, `buf[off, off + len)`, and answers
   * `QPACK_OK` or QPACK_DECODER_STREAM_ERROR. A Stream Cancellation is
   * accepted and counted, its stream ID read across calls when the bytes
   * split it. A Section Acknowledgment and an Insert Count Increment are
   * refused on their first byte: this encoder sent no section that needs
   * acknowledging and inserted nothing to count.
   */
  receiveDecoderStream(buf: u8[], off: i32, len: i32): i64 {
    qpackCheckWindow("QpackEncoder.receiveDecoderStream", buf, off, len)
    if (this.failed !== QPACK_OK) {
      return this.failed
    }
    const end: i32 = off + len
    for (let i: i32 = off; i >= 0 && i < end && i < toI32(buf.length); i += 1) {
      const b: i32 = toI32(buf[i])
      if (this.pendingShift < 0) {
        if ((b & 128) !== 0) {
          return this.refuse(QPACK_REASON_ACKNOWLEDGMENT)
        }
        if ((b & 64) === 0) {
          return this.refuse(QPACK_REASON_INCREMENT)
        }
        if ((b & 63) < 63) {
          this.cancelled(toI64(b & 63))
        } else {
          this.pendingId = 63
          this.pendingShift = 0
        }
      } else {
        const digit: i64 = toI64(b & 127)
        if (
          this.pendingShift > 56 ||
          digit > (QPACK_MAX_INTEGER - this.pendingId) >> toI64(this.pendingShift)
        ) {
          return this.refuse(QPACK_REASON_INTEGER)
        }
        this.pendingId += digit << toI64(this.pendingShift)
        if ((b & 128) === 0) {
          this.cancelled(this.pendingId)
          this.pendingShift = -1
        } else {
          this.pendingShift += 7
        }
      }
    }
    return QPACK_OK
  }

  /** Counts a Stream Cancellation for `streamId`. */
  cancelled(streamId: i64): void {
    this.cancellations += 1
    this.lastCancelled = streamId
  }

  /** Records `reason` and answers QPACK_DECODER_STREAM_ERROR, which sticks. */
  refuse(reason: i32): i64 {
    this.reason = reason
    this.failed = QPACK_DECODER_STREAM_ERROR
    return this.failed
  }
}
