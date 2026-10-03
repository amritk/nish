/**
 * `nish/net/hpack` — HPACK, the header compression of HTTP/2, as RFC 7541
 * defines it: the §5.1 integer with an N-bit prefix, the §5.2 string literal
 * with Appendix B's Huffman code, the Appendix A static table, the §2.3.2
 * dynamic table with its §4 size accounting and eviction, and the four §6
 * representations.
 *
 * It is sans-IO, like every lane of WP34 §5 below the sockets: a header block
 * goes in as bytes and comes out as fields, and fields go in and come out as
 * bytes. Framing the block (HEADERS and CONTINUATION) is HTTP/2's job, not this
 * module's, so a block handed to `HpackDecoder.decode` is already whole.
 *
 *     import { HpackDecoder, HpackEncoder, HPACK_INDEX_INCREMENTAL, HPACK_OK } from "nish/net/hpack";
 *
 *     const enc = new HpackEncoder(4096);
 *     const block: u8[] = [];
 *     enc.encodeField(block, name, value, HPACK_INDEX_INCREMENTAL, true);
 *
 *     const dec = new HpackDecoder(4096, 65536);
 *     if (dec.decode(block, 0, toI32(block.length)) === HPACK_OK) {
 *       // dec.names[i], dec.values[i], dec.neverIndexed[i]
 *     }
 *
 * Names and values are octets (`u8[]`), not strings, because a field value is
 * an octet sequence (RFC 9113 §8.2.1) and HPACK neither knows nor checks what
 * it spells. Checking a name or value is HTTP/2's job, one layer up.
 *
 * **The decoder refuses** a block that would leave its table out of step with
 * the peer's, and it answers a negative `HPACK_ERR_*` code: a block that ends
 * inside a representation, an integer past 2^31 - 1 (or one padded past the
 * five continuation bytes such an integer needs), an index of zero or past the
 * end of the tables, Huffman padding longer than seven bits or not all ones,
 * the EOS symbol inside a string, a table size update above the SETTINGS limit
 * or after the block's first field, and a block that does not begin with the
 * update a lowered limit requires (§4.2). Each of those is HTTP/2's
 * COMPRESSION_ERROR, which closes the connection, so the code is sticky: every
 * later `decode` answers it again without reading anything.
 *
 * A header list larger than the caller's limit is not one of them. The block
 * is still decoded to its end, so that the table stays in step with the
 * encoder's (RFC 9113 §10.5.1 requires it unless the connection closes), but
 * the fields past the limit are dropped and `decode` answers
 * `HPACK_LIST_TOO_LARGE`, which is positive: the next block decodes normally.
 * HTTP/2 answers that one with a 431 or a stream reset, not a GOAWAY.
 *
 * **The encoder's choices are the caller's.** Huffman or not is a per-field
 * argument, as is the representation: incremental indexing, without
 * indexing, or never indexed. A field the caller marks never indexed is always
 * sent as a literal, even when the table holds it, so that an intermediary
 * re-encoding it keeps it out of every table (§7.1.3). The encoder answers the
 * smallest representation the tables allow otherwise, which is what RFC 7541
 * Appendix C's encoder does: a full match by index, else the name by index,
 * the static table before the dynamic one and the lowest index first.
 *
 * Nothing here is constant time. HPACK's secrets are protected by the
 * never-indexed representation, not by the codec's timing (§7.1).
 *
 * State is a class and dispatch is a `switch`, with no closures. Every field
 * a decoder answers is a fresh array of its own, so a caller may change one
 * without touching the table. Private helpers share the importing program's
 * flat symbol namespace (`docs/wp26-stdlib.md` §3e), which is why each one
 * carries the module's name.
 *
 * Written from RFC 7541, not ported from another implementation. The Huffman
 * code is Appendix B's, stored as its 257 code lengths: the code is canonical
 * (shorter codes first, and symbols in order within a length), so the lengths
 * alone determine every code, and `tests/link/net_hpack_huffman` checks each
 * one against the appendix's table.
 */

/** A decode that read the whole block and answered every field. */
export const HPACK_OK: i32 = 0

/**
 * A decode that read the whole block and kept the table in step, but dropped
 * the fields past the caller's header-list limit. Not fatal.
 */
export const HPACK_LIST_TOO_LARGE: i32 = 1

/** The block ended inside a representation, an integer or a string. */
export const HPACK_ERR_TRUNCATED: i32 = -1

/** An integer past 2^31 - 1, or padded past five continuation bytes (§5.1). */
export const HPACK_ERR_INTEGER_OVERFLOW: i32 = -2

/** An index of zero, or one past the end of both tables (§2.3.3, §6.1). */
export const HPACK_ERR_INDEX: i32 = -3

/** Huffman padding longer than seven bits, or not all ones (§5.2). */
export const HPACK_ERR_HUFFMAN_PADDING: i32 = -4

/** The EOS symbol inside a Huffman-coded string (§5.2). */
export const HPACK_ERR_HUFFMAN_EOS: i32 = -5

/** A table size update above the limit the decoder's SETTINGS allow (§6.3). */
export const HPACK_ERR_TABLE_SIZE: i32 = -6

/** A table size update after the block's first field (§4.2). */
export const HPACK_ERR_SIZE_UPDATE_POSITION: i32 = -7

/**
 * A block after the SETTINGS limit was lowered below the table's size that did
 * not begin with an update to at most the smallest limit since (§4.2).
 */
export const HPACK_ERR_SIZE_UPDATE_MISSING: i32 = -8

/** Add the field to the dynamic table (§6.2.1). */
export const HPACK_INDEX_INCREMENTAL: i32 = 0

/** Do not add the field, but let an intermediary choose (§6.2.2). */
export const HPACK_INDEX_WITHOUT: i32 = 1

/** Never add the field to any table, here or downstream (§6.2.3). */
export const HPACK_INDEX_NEVER: i32 = 2

/** The number of entries in the static table (Appendix A). */
export const HPACK_STATIC_LENGTH: i32 = 61

/** What an entry costs beyond its name and value (§4.1). */
export const HPACK_ENTRY_OVERHEAD: i32 = 32

/** SETTINGS_HEADER_TABLE_SIZE's initial value (RFC 9113 §6.5.2). */
export const HPACK_DEFAULT_TABLE_SIZE: i32 = 4096

/**
 * Appendix B's code length for each symbol, 0 to 255 and then EOS (256), one
 * letter a symbol: `A` is 5 bits and `Z` is 30, which are the shortest and
 * longest lengths the code has.
 */
const HPACK_HUFFMAN_LENGTHS: string =
  "ISXXXXXXXTZXXZXXXXXXXXZXXXXXXXXXBFFHIBDGFFDGDBBBAAABBBBBBBCDKBHFIBCCCCCCCCCCCCCCCCCCCCCCDCDIOIJBKABABABBBACCBBBABCBAABCCCCCKGJIXPRPPRRRSRSSSSSTSTTRSTSSSSQRSRSSTRQPRRSSQSRRTQRSSQQRQSRSSPRRRSRRSVVPORSRUVVVWWVTUOQVWWVWTQQVVXWWWPTPQRQQSRRUUTTVSVWVVWWWWWXWWWWWVZ"

/** The EOS symbol, which only ever appears as padding (§5.2). */
const HPACK_EOS: i32 = 256

/** The longest code, in bits. */
const HPACK_HUFFMAN_MAX_BITS: i32 = 30

/**
 * Appendix A's names, by index. A `switch` rather than a table because a
 * module constant cannot be an array
 * ([LANGUAGE.md](../../docs/LANGUAGE.md#module-constants)); LLVM turns a
 * `switch` whose arms each return a constant into a lookup.
 */
const hpackStaticName = (index: i32): string => {
  switch (index) {
    case 1:
      return ":authority"
    case 2:
      return ":method"
    case 3:
      return ":method"
    case 4:
      return ":path"
    case 5:
      return ":path"
    case 6:
      return ":scheme"
    case 7:
      return ":scheme"
    case 8:
      return ":status"
    case 9:
      return ":status"
    case 10:
      return ":status"
    case 11:
      return ":status"
    case 12:
      return ":status"
    case 13:
      return ":status"
    case 14:
      return ":status"
    case 15:
      return "accept-charset"
    case 16:
      return "accept-encoding"
    case 17:
      return "accept-language"
    case 18:
      return "accept-ranges"
    case 19:
      return "accept"
    case 20:
      return "access-control-allow-origin"
    case 21:
      return "age"
    case 22:
      return "allow"
    case 23:
      return "authorization"
    case 24:
      return "cache-control"
    case 25:
      return "content-disposition"
    case 26:
      return "content-encoding"
    case 27:
      return "content-language"
    case 28:
      return "content-length"
    case 29:
      return "content-location"
    case 30:
      return "content-range"
    case 31:
      return "content-type"
    case 32:
      return "cookie"
    case 33:
      return "date"
    case 34:
      return "etag"
    case 35:
      return "expect"
    case 36:
      return "expires"
    case 37:
      return "from"
    case 38:
      return "host"
    case 39:
      return "if-match"
    case 40:
      return "if-modified-since"
    case 41:
      return "if-none-match"
    case 42:
      return "if-range"
    case 43:
      return "if-unmodified-since"
    case 44:
      return "last-modified"
    case 45:
      return "link"
    case 46:
      return "location"
    case 47:
      return "max-forwards"
    case 48:
      return "proxy-authenticate"
    case 49:
      return "proxy-authorization"
    case 50:
      return "range"
    case 51:
      return "referer"
    case 52:
      return "refresh"
    case 53:
      return "retry-after"
    case 54:
      return "server"
    case 55:
      return "set-cookie"
    case 56:
      return "strict-transport-security"
    case 57:
      return "transfer-encoding"
    case 58:
      return "user-agent"
    case 59:
      return "vary"
    case 60:
      return "via"
    default:
      return "www-authenticate"
  }
}

/** Appendix A's values, by index; every entry past 16 has an empty value. */
const hpackStaticValue = (index: i32): string => {
  switch (index) {
    case 2:
      return "GET"
    case 3:
      return "POST"
    case 4:
      return "/"
    case 5:
      return "/index.html"
    case 6:
      return "http"
    case 7:
      return "https"
    case 8:
      return "200"
    case 9:
      return "204"
    case 10:
      return "206"
    case 11:
      return "304"
    case 12:
      return "400"
    case 13:
      return "404"
    case 14:
      return "500"
    case 16:
      return "gzip, deflate"
    default:
      return ""
  }
}

/** The bytes of an ASCII string. */
const hpackBytesOf = (text: string): u8[] => {
  const out: u8[] = []
  const n: i32 = toI32(text.length)
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)))
  }
  return out
}

/** A copy of `bytes`, so that an answered field and a table entry never alias. */
const hpackCopy = (bytes: u8[]): u8[] => {
  const out: u8[] = []
  for (const b of bytes) {
    out.push(b)
  }
  return out
}

/** Whether `bytes` spell the ASCII string `text`. */
const hpackSameAsText = (bytes: u8[], text: string): boolean => {
  const n: i32 = toI32(bytes.length)
  if (n !== toI32(text.length)) {
    return false
  }
  // Bounded by both lengths, which are equal here, so the prover drops both
  // bounds checks rather than trusting the comparison above.
  for (let i: i32 = 0; i < n && i < toI32(text.length); i += 1) {
    if (toI32(bytes[i]) !== toI32(text.charCodeAt(i))) {
      return false
    }
  }
  return true
}

/** Whether two byte arrays hold the same bytes. */
const hpackSameBytes = (a: u8[], b: u8[]): boolean => {
  const n: i32 = toI32(a.length)
  if (n !== toI32(b.length)) {
    return false
  }
  for (let i: i32 = 0; i < n && i < toI32(b.length); i += 1) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

/**
 * What an entry of this name and value costs in the table (§4.1), in `i64`
 * because two lengths of up to 2^31 - 1 and the overhead do not fit an `i32`.
 */
const hpackEntrySize = (name: u8[], value: u8[]): i64 =>
  toI64(name.length) + toI64(value.length) + toI64(HPACK_ENTRY_OVERHEAD)

/** Panics unless `[off, off + len)` lies inside `buf`; the window is the caller's. */
const hpackCheckWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || toI64(off) + toI64(len) > toI64(buf.length)) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${toI32(buf.length)} bytes`)
  }
}

/**
 * Appendix B's Huffman code, rebuilt from its lengths, with the tables that
 * both directions read. Built once per encoder or decoder rather than once per
 * string; a program may build its own to call `hpackHuffmanEncode` and
 * `hpackHuffmanDecode` directly.
 *
 * Canonical means that the codes of one length are consecutive integers in
 * symbol order, and that the first code of a length is one past the last code
 * of the length before, shifted left by the difference. So `firstCode[L]` and
 * `countAt[L]` say which `L`-bit integers are codes, and `symbols` lists the
 * symbols in code order, `baseRank[L]` being where length `L` starts in it.
 */
export class HpackHuffman {
  /** The code of each symbol, aligned on its least significant bit. */
  codes: i32[]
  /** The length of each symbol's code, in bits. */
  lengths: i32[]
  /** The symbols in code order. */
  symbols: i32[]
  /** The first code of each length, by length (0 to 30). */
  firstCode: i32[]
  /** How many codes each length has, by length. */
  countAt: i32[]
  /** Where each length's symbols start in `symbols`, by length. */
  baseRank: i32[]

  constructor() {
    this.codes = new Array<i32>(257)
    this.lengths = new Array<i32>(257)
    this.symbols = new Array<i32>(257)
    this.firstCode = new Array<i32>(31)
    this.countAt = new Array<i32>(31)
    this.baseRank = new Array<i32>(31)
    for (let sym: i32 = 0; sym <= HPACK_EOS; sym += 1) {
      this.lengths[sym] = toI32(HPACK_HUFFMAN_LENGTHS.charCodeAt(sym)) - 60
    }
    let code: i32 = 0
    let rank: i32 = 0
    for (let len: i32 = 5; len <= HPACK_HUFFMAN_MAX_BITS; len += 1) {
      this.firstCode[len] = code
      this.baseRank[len] = rank
      for (let sym: i32 = 0; sym <= HPACK_EOS; sym += 1) {
        if (this.lengths[sym] === len) {
          this.codes[sym] = code
          this.symbols[rank] = sym
          code += 1
          rank += 1
        }
      }
      this.countAt[len] = rank - this.baseRank[len]
      code = code << 1
    }
  }
}

/** The length of `src[off, off + len)` once Huffman-coded, in bytes. */
export const hpackHuffmanLength = (h: HpackHuffman, src: u8[], off: i32, len: i32): i32 => {
  hpackCheckWindow("hpackHuffmanLength", src, off, len)
  let bits: i64 = 0
  const end: i32 = off + len
  // The window check has already proved `0 <= i < src.length` for every `i`
  // below `end`; the loop condition says so again, which is what lets the
  // prover drop the bounds check on each read. The two loops below do the same.
  for (let i: i32 = off; i >= 0 && i < end && i < toI32(src.length); i += 1) {
    bits += toI64(h.lengths[toI32(src[i])])
  }
  const bytes: i64 = (bits + toI64(7)) >> toI64(3)
  if (bytes > toI64(2147483647)) {
    panic("hpackHuffmanLength: more than 2^31 - 1 bytes once coded")
  }
  return toI32(bytes)
}

/**
 * Appends `src[off, off + len)` Huffman-coded to `out`, padded to a byte
 * with the most significant bits of EOS, which are all ones (§5.2).
 *
 * The accumulator holds fewer than eight waiting bits between symbols, and a
 * code is at most 30, so it never needs more than 37 bits.
 */
export const hpackHuffmanEncode = (h: HpackHuffman, src: u8[], off: i32, len: i32, out: u8[]): void => {
  hpackCheckWindow("hpackHuffmanEncode", src, off, len)
  let acc: i64 = 0
  let bits: i32 = 0
  const end: i32 = off + len
  for (let i: i32 = off; i >= 0 && i < end && i < toI32(src.length); i += 1) {
    const sym: i32 = toI32(src[i])
    const n: i32 = h.lengths[sym]
    acc = (acc << toI64(n)) | toI64(h.codes[sym])
    bits += n
    while (bits >= 8) {
      bits -= 8
      out.push(toU8((acc >> toI64(bits)) & toI64(255)))
    }
    acc = acc & ((toI64(1) << toI64(bits)) - toI64(1))
  }
  if (bits > 0) {
    const pad: i32 = 8 - bits
    out.push(toU8(((acc << toI64(pad)) | ((toI64(1) << toI64(pad)) - toI64(1))) & toI64(255)))
  }
}

/**
 * Appends the Huffman decoding of `src[off, off + len)` to `out`, and answers
 * `HPACK_OK`, `HPACK_ERR_HUFFMAN_EOS` or `HPACK_ERR_HUFFMAN_PADDING`.
 *
 * It reads one bit at a time, and after each one asks whether the bits since
 * the last symbol are a code of their length. Because the code is complete,
 * thirty bits always are. What is left when the input ends is padding, which
 * §5.2 requires to be a prefix of EOS — all ones — and shorter than a byte.
 * `out` keeps what was decoded before an error; a caller discards it.
 */
export const hpackHuffmanDecode = (h: HpackHuffman, src: u8[], off: i32, len: i32, out: u8[]): i32 => {
  hpackCheckWindow("hpackHuffmanDecode", src, off, len)
  let code: i32 = 0
  let bits: i32 = 0
  const end: i32 = off + len
  for (let i: i32 = off; i >= 0 && i < end && i < toI32(src.length); i += 1) {
    const byte: i32 = toI32(src[i])
    for (let k: i32 = 7; k >= 0; k -= 1) {
      code = (code << 1) | ((byte >> k) & 1)
      bits += 1
      if (bits >= 5) {
        const at: i32 = code - h.firstCode[bits]
        if (at >= 0 && at < h.countAt[bits]) {
          const sym: i32 = h.symbols[h.baseRank[bits] + at]
          if (sym === HPACK_EOS) {
            return HPACK_ERR_HUFFMAN_EOS
          }
          out.push(toU8(sym))
          code = 0
          bits = 0
        }
      }
    }
  }
  if (bits > 7 || code !== (1 << bits) - 1) {
    return HPACK_ERR_HUFFMAN_PADDING
  }
  return HPACK_OK
}

/**
 * A read position in a header block: the bytes, where the next read starts,
 * and where the block ends. The primitives below advance `pos`.
 */
export class HpackCursor {
  buf: u8[]
  pos: i32
  end: i32

  /** A cursor over `buf[off, off + len)`, which must lie inside `buf`. */
  constructor(buf: u8[], off: i32, len: i32) {
    hpackCheckWindow("HpackCursor", buf, off, len)
    this.buf = buf
    this.pos = off
    this.end = off + len
  }
}

/**
 * Appends `value` as a §5.1 integer with a `prefixBits`-bit prefix, the
 * first byte's high bits being `flags` (the representation's pattern).
 * A negative value, or a prefix outside 1 to 8 bits, panics: both are the
 * program's choice.
 */
export const hpackEncodeInteger = (out: u8[], flags: i32, prefixBits: i32, value: i32): void => {
  if (prefixBits < 1 || prefixBits > 8 || value < 0) {
    panic(`hpackEncodeInteger: a value of ${value} with a ${prefixBits}-bit prefix, outside 1 to 8`)
  }
  const max: i32 = (1 << prefixBits) - 1
  if (value < max) {
    out.push(toU8(flags | value))
    return
  }
  out.push(toU8(flags | max))
  let rest: i32 = value - max
  while (rest >= 128) {
    out.push(toU8((rest & 127) | 128))
    rest = rest >> 7
  }
  out.push(toU8(rest))
}

/**
 * Reads a §5.1 integer whose prefix is the low `prefixBits` bits of the byte at
 * the cursor, and answers it, or `HPACK_ERR_TRUNCATED` or
 * `HPACK_ERR_INTEGER_OVERFLOW`, both negative. A prefix outside 1 to 8 bits
 * panics, as it does for `hpackEncodeInteger`.
 *
 * An `i32` needs at most five continuation bytes after a full prefix, so a
 * sixth is refused even when its bits are zero; otherwise a run of `0x80`
 * bytes would be read for as long as the peer cared to send it.
 */
export const hpackDecodeInteger = (c: HpackCursor, prefixBits: i32): i32 => {
  if (prefixBits < 1 || prefixBits > 8) {
    panic(`hpackDecodeInteger: a ${prefixBits}-bit prefix, outside 1 to 8`)
  }
  if (c.pos >= c.end) {
    return HPACK_ERR_TRUNCATED
  }
  const max: i32 = (1 << prefixBits) - 1
  const first: i32 = toI32(c.buf[c.pos]) & max
  c.pos += 1
  if (first < max) {
    return first
  }
  let value: i64 = toI64(max)
  for (let shift: i32 = 0; shift <= 28; shift += 7) {
    if (c.pos >= c.end) {
      return HPACK_ERR_TRUNCATED
    }
    const b: i32 = toI32(c.buf[c.pos])
    c.pos += 1
    value += toI64(b & 127) << toI64(shift)
    if (value > toI64(2147483647)) {
      return HPACK_ERR_INTEGER_OVERFLOW
    }
    if ((b & 128) === 0) {
      return toI32(value)
    }
  }
  return HPACK_ERR_INTEGER_OVERFLOW
}

/**
 * Appends `data` as a §5.2 string literal: Huffman-coded when `huffman` is
 * true, else raw. A caller who wants the shorter of the two compares
 * `hpackHuffmanLength` with the raw length.
 */
export const hpackEncodeString = (h: HpackHuffman, out: u8[], data: u8[], huffman: boolean): void => {
  const n: i32 = toI32(data.length)
  if (huffman) {
    hpackEncodeInteger(out, 128, 7, hpackHuffmanLength(h, data, 0, n))
    hpackHuffmanEncode(h, data, 0, n, out)
    return
  }
  hpackEncodeInteger(out, 0, 7, n)
  for (const b of data) {
    out.push(b)
  }
}

/**
 * Reads a §5.2 string literal at the cursor and appends its octets to `out`,
 * answering `HPACK_OK` or a negative `HPACK_ERR_*` code. The length is checked
 * against what the block has left before anything is read.
 */
export const hpackDecodeString = (h: HpackHuffman, c: HpackCursor, out: u8[]): i32 => {
  if (c.pos >= c.end) {
    return HPACK_ERR_TRUNCATED
  }
  const huffman: boolean = (toI32(c.buf[c.pos]) & 128) !== 0
  const n: i32 = hpackDecodeInteger(c, 7)
  if (n < 0) {
    return n
  }
  if (n > c.end - c.pos) {
    return HPACK_ERR_TRUNCATED
  }
  const at: i32 = c.pos
  c.pos += n
  if (huffman) {
    return hpackHuffmanDecode(h, c.buf, at, n, out)
  }
  for (let i: i32 = at; i < at + n; i += 1) {
    out.push(c.buf[i])
  }
  return HPACK_OK
}

/**
 * The dynamic table (§2.3.2, §4): a FIFO of fields, newest first by index,
 * whose size — every entry's name and value plus 32 — never passes `maxSize`.
 *
 * The entries are kept oldest first in `names` and `values` from `first` on,
 * so that adding one is a `push` and evicting one moves `first`; the evicted
 * prefix is dropped by a copy once it is half the arrays, which keeps both
 * amortised constant time without a ring's index arithmetic. Dynamic index 1,
 * the newest entry, is the last element.
 */
export class HpackTable {
  names: u8[][]
  values: u8[][]
  first: i32
  size: i32
  maxSize: i32

  constructor(maxSize: i32) {
    if (maxSize < 0) {
      panic(`HpackTable: a maximum size of ${maxSize}`)
    }
    this.names = []
    this.values = []
    this.first = 0
    this.size = 0
    this.maxSize = maxSize
  }

  /** How many entries the table holds. */
  count(): i32 {
    return toI32(this.names.length) - this.first
  }

  /** The name of dynamic entry `i`, 1 being the newest; `i` must be in range. */
  name(i: i32): u8[] {
    return this.names[toI32(this.names.length) - i]
  }

  /** The value of dynamic entry `i`, 1 being the newest. */
  value(i: i32): u8[] {
    return this.values[toI32(this.values.length) - i]
  }

  /** Evicts the oldest entries until the size is at most `limit` (§4.4). */
  evictTo(limit: i32): void {
    while (toI64(this.size) > toI64(limit) && this.count() > 0) {
      this.size -= toI32(hpackEntrySize(this.names[this.first], this.values[this.first]))
      this.first += 1
    }
    if (this.first >= 16 && this.first * 2 >= toI32(this.names.length)) {
      const names: u8[][] = []
      const values: u8[][] = []
      for (let i: i32 = this.first; i < toI32(this.names.length); i += 1) {
        names.push(this.names[i])
        values.push(this.values[i])
      }
      this.names = names
      this.values = values
      this.first = 0
    }
  }

  /**
   * Adds a field as the newest entry, evicting first to make room. An entry
   * larger than the whole table empties it and is not added (§4.4): that is
   * not an error.
   */
  add(name: u8[], value: u8[]): void {
    const cost: i64 = hpackEntrySize(name, value)
    if (cost > toI64(this.maxSize)) {
      const nothing: i32 = 0
      this.evictTo(nothing)
      return
    }
    this.evictTo(this.maxSize - toI32(cost))
    this.names.push(name)
    this.values.push(value)
    this.size += toI32(cost)
  }

  /** Sets the maximum size, evicting what no longer fits (§4.3). */
  resize(maxSize: i32): void {
    if (maxSize < 0) {
      panic(`HpackTable.resize: a maximum size of ${maxSize}`)
    }
    this.maxSize = maxSize
    this.evictTo(maxSize)
  }
}

/** The four kinds of representation, as the decoder's `switch` reads them. */
const HPACK_REP_INDEXED: i32 = 0
const HPACK_REP_INCREMENTAL: i32 = 1
const HPACK_REP_SIZE_UPDATE: i32 = 2
const HPACK_REP_NEVER: i32 = 3
const HPACK_REP_WITHOUT: i32 = 4

/** Which representation a block's next byte starts (§6, Figures 5–12). */
const hpackRepresentationOf = (b: i32): i32 => {
  if ((b & 128) !== 0) {
    return HPACK_REP_INDEXED
  }
  if ((b & 64) !== 0) {
    return HPACK_REP_INCREMENTAL
  }
  if ((b & 32) !== 0) {
    return HPACK_REP_SIZE_UPDATE
  }
  if ((b & 16) !== 0) {
    return HPACK_REP_NEVER
  }
  return HPACK_REP_WITHOUT
}

/**
 * One HTTP/2 connection's receiving side: its dynamic table, the SETTINGS
 * limit the table may grow to, and the header-list limit.
 *
 * `decode` answers the block's fields in `names`, `values` and
 * `neverIndexed`, which it replaces on every call. `settingsLimit` is the
 * SETTINGS_HEADER_TABLE_SIZE this endpoint advertised and the peer
 * acknowledged; the table starts at it. `maxHeaderListSize` counts each field
 * as its name, its value and 32 bytes, as SETTINGS_MAX_HEADER_LIST_SIZE does
 * (RFC 9113 §6.5.2).
 */
export class HpackDecoder {
  table: HpackTable
  huffman: HpackHuffman
  settingsLimit: i32
  maxHeaderListSize: i32
  /** The smallest limit set since the last size update, or -1 when none is owed. */
  owedUpdate: i32
  /** The fatal error a decode met, which every later decode answers; 0 until then. */
  failed: i32
  names: u8[][]
  values: u8[][]
  neverIndexed: boolean[]

  constructor(settingsLimit: i32, maxHeaderListSize: i32) {
    if (maxHeaderListSize < 0) {
      panic(`HpackDecoder: a header-list limit of ${maxHeaderListSize}`)
    }
    this.table = new HpackTable(settingsLimit)
    this.huffman = new HpackHuffman()
    this.settingsLimit = settingsLimit
    this.maxHeaderListSize = maxHeaderListSize
    this.owedUpdate = -1
    this.failed = 0
    this.names = []
    this.values = []
    this.neverIndexed = []
  }

  /**
   * Takes a new SETTINGS_HEADER_TABLE_SIZE, once the peer has acknowledged it.
   * A limit below the table's current maximum obliges the peer's encoder to
   * begin its next block with an update to at most the smallest limit set
   * since its last one (§4.2); the decoder holds it to that.
   */
  setSettingsLimit(limit: i32): void {
    if (limit < 0) {
      panic(`HpackDecoder.setSettingsLimit: a limit of ${limit}`)
    }
    this.settingsLimit = limit
    if (limit < this.table.maxSize && (this.owedUpdate < 0 || limit < this.owedUpdate)) {
      this.owedUpdate = limit
    }
  }

  /**
   * The name of static or dynamic index `index`, which must be in range. A
   * dynamic name is the table's own array, not a copy: it may become another
   * entry's name, since the table never changes an entry, but it is never
   * answered to the caller as it is.
   */
  nameAt(index: i32): u8[] {
    if (index <= HPACK_STATIC_LENGTH) {
      return hpackBytesOf(hpackStaticName(index))
    }
    return this.table.name(index - HPACK_STATIC_LENGTH)
  }

  /**
   * A fresh copy of the name at `index`, for the caller: built straight from
   * the static table, or copied once from the dynamic one, so that nothing
   * else is allocated on the way.
   */
  copyNameAt(index: i32): u8[] {
    if (index <= HPACK_STATIC_LENGTH) {
      return hpackBytesOf(hpackStaticName(index))
    }
    return hpackCopy(this.table.name(index - HPACK_STATIC_LENGTH))
  }

  /** A fresh copy of the value at `index`, as `copyNameAt` makes the name. */
  copyValueAt(index: i32): u8[] {
    if (index <= HPACK_STATIC_LENGTH) {
      return hpackBytesOf(hpackStaticValue(index))
    }
    return hpackCopy(this.table.value(index - HPACK_STATIC_LENGTH))
  }

  /** What the entry at `index` counts towards a header list, without building it. */
  sizeAt(index: i32): i64 {
    if (index <= HPACK_STATIC_LENGTH) {
      return (
        toI64(hpackStaticName(index).length) +
        toI64(hpackStaticValue(index).length) +
        toI64(HPACK_ENTRY_OVERHEAD)
      )
    }
    const i: i32 = index - HPACK_STATIC_LENGTH
    return hpackEntrySize(this.table.name(i), this.table.value(i))
  }

  /** Whether `index` names an entry of either table. */
  hasIndex(index: i32): boolean {
    return index >= 1 && index <= HPACK_STATIC_LENGTH + this.table.count()
  }

  /**
   * Decodes one whole header block, `block[off, off + len)`, and answers
   * `HPACK_OK`, `HPACK_LIST_TOO_LARGE` or a negative `HPACK_ERR_*` code; the
   * module comment lists what each means. After a negative answer the fields
   * are empty and the decoder is spent.
   */
  decode(block: u8[], off: i32, len: i32): i32 {
    this.names = []
    this.values = []
    this.neverIndexed = []
    if (this.failed !== 0) {
      return this.failed
    }
    const result: i32 = this.decodeFields(new HpackCursor(block, off, len))
    if (result < 0) {
      this.failed = result
      this.names = []
      this.values = []
      this.neverIndexed = []
    }
    return result
  }

  /**
   * The body of `decode`: one pass over the representations.
   *
   * A field is counted against the header-list limit before it is copied out,
   * and one past the limit is never copied. That is what keeps a block of
   * one-byte indexes, each naming a large dynamic entry, from allocating the
   * entry's size per byte read: past the limit an indexed field costs a
   * lookup and nothing else. A literal's strings come from the block itself,
   * so what they allocate is bounded by the block's length.
   */
  decodeFields(c: HpackCursor): i32 {
    let listSize: i64 = 0
    let tooLarge: boolean = false
    let sawField: boolean = false
    if (this.owedUpdate >= 0) {
      if (c.pos >= c.end || hpackRepresentationOf(toI32(c.buf[c.pos])) !== HPACK_REP_SIZE_UPDATE) {
        return HPACK_ERR_SIZE_UPDATE_MISSING
      }
    }
    while (c.pos < c.end) {
      const rep: i32 = hpackRepresentationOf(toI32(c.buf[c.pos]))
      switch (rep) {
        case HPACK_REP_SIZE_UPDATE: {
          if (sawField) {
            return HPACK_ERR_SIZE_UPDATE_POSITION
          }
          const size: i32 = hpackDecodeInteger(c, 5)
          if (size < 0) {
            return size
          }
          if (size > this.settingsLimit || (this.owedUpdate >= 0 && size > this.owedUpdate)) {
            return HPACK_ERR_TABLE_SIZE
          }
          this.owedUpdate = -1
          this.table.resize(size)
          break
        }
        case HPACK_REP_INDEXED: {
          const index: i32 = hpackDecodeInteger(c, 7)
          if (index < 0) {
            return index
          }
          if (!this.hasIndex(index)) {
            return HPACK_ERR_INDEX
          }
          sawField = true
          listSize += this.sizeAt(index)
          tooLarge = tooLarge || listSize > toI64(this.maxHeaderListSize)
          if (!tooLarge) {
            this.names.push(this.copyNameAt(index))
            this.values.push(this.copyValueAt(index))
            this.neverIndexed.push(false)
          }
          break
        }
        default: {
          const index: i32 = hpackDecodeInteger(c, rep === HPACK_REP_INCREMENTAL ? 6 : 4)
          if (index < 0) {
            return index
          }
          let name: u8[] = []
          if (index === 0) {
            const status: i32 = hpackDecodeString(this.huffman, c, name)
            if (status < 0) {
              return status
            }
          } else if (this.hasIndex(index)) {
            name = this.nameAt(index)
          } else {
            return HPACK_ERR_INDEX
          }
          const value: u8[] = []
          const status: i32 = hpackDecodeString(this.huffman, c, value)
          if (status < 0) {
            return status
          }
          // The table takes these arrays as they are: `name` may be another
          // entry's, which is safe because no entry is ever changed, and the
          // caller is handed copies below.
          if (rep === HPACK_REP_INCREMENTAL) {
            this.table.add(name, value)
          }
          sawField = true
          listSize += hpackEntrySize(name, value)
          tooLarge = tooLarge || listSize > toI64(this.maxHeaderListSize)
          if (!tooLarge) {
            this.names.push(hpackCopy(name))
            this.values.push(hpackCopy(value))
            this.neverIndexed.push(rep === HPACK_REP_NEVER)
          }
        }
      }
    }
    return tooLarge ? HPACK_LIST_TOO_LARGE : HPACK_OK
  }
}

/**
 * One HTTP/2 connection's sending side: its dynamic table and the size
 * updates it owes the peer.
 *
 * The table starts at `maxSize`, which both ends must already agree on —
 * HTTP/2's 4096 until SETTINGS say otherwise — so no update is sent for it.
 */
export class HpackEncoder {
  table: HpackTable
  huffman: HpackHuffman
  /** The smallest size set since the last block, or -1 when no update is owed. */
  owedMinimum: i32

  constructor(maxSize: i32) {
    this.table = new HpackTable(maxSize)
    this.huffman = new HpackHuffman()
    this.owedMinimum = -1
  }

  /**
   * Sets the table's maximum size, which must not pass the peer's
   * SETTINGS_HEADER_TABLE_SIZE; the encoder cannot know that limit, so it is
   * the caller's to keep. Call it between blocks: the next `encodeField`
   * begins with the update, or with two when the size went down and then up
   * again, the smallest first (§4.2).
   */
  setMaxTableSize(maxSize: i32): void {
    if (this.owedMinimum < 0 || maxSize < this.owedMinimum) {
      this.owedMinimum = maxSize
    }
    this.table.resize(maxSize)
  }

  /**
   * The index of an entry holding both `name` and `value`, or 0 when neither
   * table has one. The static table is searched first, then the dynamic one
   * from the newest entry.
   */
  findField(name: u8[], value: u8[]): i32 {
    for (let i: i32 = 1; i <= HPACK_STATIC_LENGTH; i += 1) {
      if (hpackSameAsText(name, hpackStaticName(i)) && hpackSameAsText(value, hpackStaticValue(i))) {
        return i
      }
    }
    const n: i32 = this.table.count()
    for (let i: i32 = 1; i <= n; i += 1) {
      if (hpackSameBytes(name, this.table.name(i)) && hpackSameBytes(value, this.table.value(i))) {
        return HPACK_STATIC_LENGTH + i
      }
    }
    return 0
  }

  /** The lowest index whose entry has `name`, or 0 when neither table has one. */
  findName(name: u8[]): i32 {
    for (let i: i32 = 1; i <= HPACK_STATIC_LENGTH; i += 1) {
      if (hpackSameAsText(name, hpackStaticName(i))) {
        return i
      }
    }
    const n: i32 = this.table.count()
    for (let i: i32 = 1; i <= n; i += 1) {
      if (hpackSameBytes(name, this.table.name(i))) {
        return HPACK_STATIC_LENGTH + i
      }
    }
    return 0
  }

  /**
   * Appends one field to the block in `out`: by index when a table holds it
   * and `indexing` is not `HPACK_INDEX_NEVER`, else as a literal of the kind
   * `indexing` names, its name by index when a table has it and its strings
   * Huffman-coded when `huffman` is true. Any other `indexing` panics.
   */
  encodeField(out: u8[], name: u8[], value: u8[], indexing: i32, huffman: boolean): void {
    if (indexing < HPACK_INDEX_INCREMENTAL || indexing > HPACK_INDEX_NEVER) {
      panic(`HpackEncoder.encodeField: an indexing mode of ${indexing}`)
    }
    if (this.owedMinimum >= 0) {
      if (this.owedMinimum < this.table.maxSize) {
        hpackEncodeInteger(out, 32, 5, this.owedMinimum)
      }
      hpackEncodeInteger(out, 32, 5, this.table.maxSize)
      this.owedMinimum = -1
    }
    if (indexing !== HPACK_INDEX_NEVER) {
      const full: i32 = this.findField(name, value)
      if (full > 0) {
        hpackEncodeInteger(out, 128, 7, full)
        return
      }
    }
    const nameIndex: i32 = this.findName(name)
    switch (indexing) {
      case HPACK_INDEX_INCREMENTAL:
        hpackEncodeInteger(out, 64, 6, nameIndex)
        break
      case HPACK_INDEX_WITHOUT:
        hpackEncodeInteger(out, 0, 4, nameIndex)
        break
      default:
        hpackEncodeInteger(out, 16, 4, nameIndex)
    }
    if (nameIndex === 0) {
      hpackEncodeString(this.huffman, out, name, huffman)
    }
    hpackEncodeString(this.huffman, out, value, huffman)
    if (indexing === HPACK_INDEX_INCREMENTAL) {
      this.table.add(hpackCopy(name), hpackCopy(value))
    }
  }
}
