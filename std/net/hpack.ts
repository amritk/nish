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
 *       // dec.names[i], dec.values[i], dec.neverIndexed[i], until the next decode
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
 * later `decode` answers it again without reading anything. So is
 * `HPACK_ERR_COPY_BUDGET`, a block that would make the table copy more than
 * `HPACK_COPY_FACTOR` times the larger of its size and the block's length,
 * which HTTP/2 answers with ENHANCE_YOUR_CALM.
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
 * State is a class and dispatch is a `switch`, with no closures. A decoder
 * answers its fields in arrays it owns and reuses, never the table's own
 * octets, so a caller may change one without touching the table, and keeps
 * one past the next `decode` by copying it. Once its arrays have grown to the
 * largest block and header list the peer has sent, decoding allocates
 * nothing, which bounds what a peer can make a connection hold (RFC 9113
 * §10.5.1; `docs/security/http2.md`, H2-1). Private helpers share the
 * importing program's flat symbol namespace (`docs/wp26-stdlib.md` §3e),
 * which is why each one carries the module's name.
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

/**
 * A block that asked the table to take more octets than its copy budget
 * allows: `HPACK_COPY_FACTOR` times the larger of the table's maximum size
 * and the block's own length. Valid HPACK, but no encoder needs it, and
 * HTTP/2 answers it with ENHANCE_YOUR_CALM, not COMPRESSION_ERROR.
 */
export const HPACK_ERR_COPY_BUDGET: i32 = -9

/**
 * How many times the larger of the table's maximum size and a block's length
 * the decoder copies into its table for one block, at most
 * (`docs/security/http2.md`, H2-1). An index naming a dynamic entry is one or
 * two octets, and a literal with incremental indexing that names it copies
 * the name out of the table and back in, so without a budget a block of them
 * costs about three times the table's size of work per two octets it holds.
 * Four leaves an encoder room to re-add a full table's worth of fields twice
 * over in one block, which none needs, since every add past the table's size
 * evicts one of its own.
 */
export const HPACK_COPY_FACTOR: i32 = 4

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

/** Appends the octets of the ASCII string `text` to `out`. */
const hpackAppendText = (out: u8[], text: string): void => {
  const n: i32 = toI32(text.length)
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)))
  }
}

/** Appends `src[at, at + n)`, a window the caller has checked, to `out`. */
const hpackAppend = (out: u8[], src: u8[], at: i32, n: i32): void => {
  // The length test is the caller's check again, there so the prover drops the bounds check.
  for (let i: i32 = at; i < at + n && i >= 0 && i < toI32(src.length); i += 1) {
    out.push(src[i])
  }
}

/** Empties `bytes`, keeping its storage for the next fill. */
const hpackEmpty = (bytes: u8[]): void => {
  while (toI32(bytes.length) > 0) {
    bytes.pop()
  }
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

/** Whether `bytes` hold the same octets as `store[at, at + n)`, a window inside `store`. */
const hpackSameAsWindow = (bytes: u8[], store: u8[], at: i32, n: i32): boolean => {
  if (toI32(bytes.length) !== n) {
    return false
  }
  for (let i: i32 = 0; i < n && i < toI32(bytes.length); i += 1) {
    if (bytes[i] !== store[at + i]) {
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

  /** Points the cursor at `buf[off, off + len)` instead, which must lie inside `buf`. */
  reset(buf: u8[], off: i32, len: i32): void {
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
 * Every entry's octets live in one store, `bytes`: its name, then its value,
 * oldest entry first. `entries` says where each entry sits, two numbers to an
 * entry — where it starts in `bytes` and how long its name is; its value runs
 * to where the next one starts — oldest first from entry `first` on, so that
 * adding one is two `push`es and evicting one moves `first`. The evicted
 * prefix of `entries`, and of `bytes`, is shifted out in place once it is half
 * of either, which keeps both amortised constant time without a ring's index
 * arithmetic. Shifting and popping keep an array's storage, and `bytes` never
 * holds more than three times `maxSize`, so a table the peer fills and empties
 * for as long as it likes stops allocating once its arrays have grown that far
 * (`docs/security/http2.md`, H2-1). Dynamic index 1, the newest entry, is the
 * last.
 */
export class HpackTable {
  bytes: u8[]
  entries: i32[]
  first: i32
  size: i32
  maxSize: i32

  constructor(maxSize: i32) {
    if (maxSize < 0) {
      panic(`HpackTable: a maximum size of ${maxSize}`)
    }
    this.bytes = []
    this.entries = []
    this.first = 0
    this.size = 0
    this.maxSize = maxSize
  }

  /** How many entries `entries` describes, evicted ones included. */
  slots(): i32 {
    return toI32(this.entries.length) >> 1
  }

  /** How many entries the table holds. */
  count(): i32 {
    return this.slots() - this.first
  }

  /** Where dynamic entry `i`, 1 being the newest, sits in `entries`; `i` must be in range. */
  slot(i: i32): i32 {
    return this.slots() - i
  }

  /** Where entry `k` of `entries` starts in `bytes`. */
  startOf(k: i32): i32 {
    return this.entries[k * 2]
  }

  /** Where entry `k` of `entries` ends in `bytes`: where the next starts, or the end of `bytes`. */
  endOf(k: i32): i32 {
    return k + 1 < this.slots() ? this.entries[k * 2 + 2] : toI32(this.bytes.length)
  }

  /** What entry `k` of `entries` costs (§4.1); it fits an `i32` because the table holds it. */
  costOf(k: i32): i32 {
    return this.endOf(k) - this.startOf(k) + HPACK_ENTRY_OVERHEAD
  }

  /** Where the name of dynamic entry `i` starts in `bytes`. */
  nameStart(i: i32): i32 {
    return this.startOf(this.slot(i))
  }

  /** How many octets the name of dynamic entry `i` has. */
  nameLength(i: i32): i32 {
    return this.entries[this.slot(i) * 2 + 1]
  }

  /** Where the value of dynamic entry `i` starts in `bytes`, straight after its name. */
  valueStart(i: i32): i32 {
    return this.nameStart(i) + this.nameLength(i)
  }

  /** How many octets the value of dynamic entry `i` has. */
  valueLength(i: i32): i32 {
    return this.endOf(this.slot(i)) - this.valueStart(i)
  }

  /** What dynamic entry `i` costs (§4.1). */
  entrySize(i: i32): i32 {
    return this.costOf(this.slot(i))
  }

  /** A fresh copy of the name of dynamic entry `i`. It allocates; the codec reads the window instead. */
  name(i: i32): u8[] {
    const out: u8[] = []
    hpackAppend(out, this.bytes, this.nameStart(i), this.nameLength(i))
    return out
  }

  /** A fresh copy of the value of dynamic entry `i`, as `name` makes the name. */
  value(i: i32): u8[] {
    const out: u8[] = []
    hpackAppend(out, this.bytes, this.valueStart(i), this.valueLength(i))
    return out
  }

  /** Evicts the oldest entries until the size is at most `limit` (§4.4). */
  evictTo(limit: i32): void {
    while (toI64(this.size) > toI64(limit) && this.count() > 0) {
      this.size -= this.costOf(this.first)
      this.first += 1
    }
    this.compact()
  }

  /** Shifts the evicted prefix out of `entries`, and out of `bytes`, once it is half of either. */
  compact(): void {
    const end: i32 = toI32(this.bytes.length)
    const start: i32 = this.count() > 0 ? this.startOf(this.first) : end
    const n: i32 = this.slots()
    if (this.first > 0 && this.first * 2 >= n) {
      const live: i32 = (n - this.first) * 2
      const from: i32 = this.first * 2
      for (let k: i32 = 0; k < live; k += 1) {
        this.entries[k] = this.entries[from + k]
      }
      while (toI32(this.entries.length) > live) {
        this.entries.pop()
      }
      this.first = 0
    }
    if (start > 0 && start * 2 >= end) {
      for (let k: i32 = start; k < end; k += 1) {
        this.bytes[k - start] = this.bytes[k]
      }
      while (toI32(this.bytes.length) > end - start) {
        this.bytes.pop()
      }
      for (let k: i32 = this.first; k < this.slots(); k += 1) {
        this.entries[k * 2] -= start
      }
    }
  }

  /**
   * Adds a field as the newest entry, copying its octets in, evicting first
   * to make room. An entry larger than the whole table empties it and is not
   * added (§4.4): that is not an error. Neither array may be `bytes` itself,
   * since eviction may move what it holds.
   */
  add(name: u8[], value: u8[]): void {
    const cost: i64 = hpackEntrySize(name, value)
    if (cost > toI64(this.maxSize)) {
      const nothing: i32 = 0
      this.evictTo(nothing)
      return
    }
    this.evictTo(this.maxSize - toI32(cost))
    this.entries.push(toI32(this.bytes.length))
    this.entries.push(toI32(name.length))
    for (const b of name) {
      this.bytes.push(b)
    }
    for (const b of value) {
      this.bytes.push(b)
    }
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
 * The size classes of a decoded field's storage: class `j` holds arrays made
 * with room for 2^j octets, up to 2^23, past any header list a connection
 * would accept; a longer field grows the last class's array once.
 */
const HPACK_FIELD_CLASSES: i32 = 24

/**
 * What an `HpackDecoder` decodes a block with: the read position, reset for
 * each block; a literal's name and value as they are read, before they are
 * counted, copied or indexed; and the arrays the fields gave back, by size
 * class, each class made when first needed.
 */
export class HpackWork {
  cursor: HpackCursor
  nameScratch: u8[]
  valueScratch: u8[]
  pools: u8[][][]

  constructor() {
    this.nameScratch = []
    this.valueScratch = []
    const nothing: i32 = 0
    this.cursor = new HpackCursor(this.nameScratch, nothing, nothing)
    this.pools = []
  }

  /** The smallest size class with room for `length` octets: the first `j` with 2^j past it, at most the last. */
  classOf(length: i32): i32 {
    let j: i32 = 0
    while (j < HPACK_FIELD_CLASSES - 1 && 1 << j <= length) {
      j += 1
    }
    return j
  }

  /** The pool of class `j`, made the first time a field needs it. */
  pool(j: i32): u8[][] {
    while (toI32(this.pools.length) <= j) {
      const fresh: u8[][] = []
      this.pools.push(fresh)
    }
    return this.pools[j]
  }

  /**
   * An empty array with room for `length` octets: one an earlier block gave
   * back, emptied, to its class's pool, or, once the pool is empty, a new one made with
   * the class's room.
   */
  take(length: i32): u8[] {
    const j: i32 = this.classOf(length)
    const pool: u8[][] = this.pool(j)
    const kept: i32 = toI32(pool.length)
    if (kept === 0) {
      const made: u8[] = new Array<u8>(1 << j)
      hpackEmpty(made)
      return made
    }
    const out: u8[] = pool[kept - 1]
    pool.pop()
    return out
  }
}

/**
 * One HTTP/2 connection's receiving side: its dynamic table, the SETTINGS
 * limit the table may grow to, and the header-list limit.
 *
 * `decode` answers the block's fields in `names`, `values` and
 * `neverIndexed`, which it empties and refills on every call. Each name and
 * value is an array the decoder owns, taken from its working storage's pools
 * by its length and given back, emptied, at the next block, so **a field is
 * valid until the next `decode`**: a caller that keeps one past it copies it,
 * since the next block may refill the same array with another field. That is
 * what keeps the storage a peer can make a connection hold bounded by the
 * header-list limit, however many blocks it sends and whatever becomes of
 * their streams (`docs/security/http2.md`, H2-1): a class `j` array holds a
 * field of at least 2^(j-1) octets, so no class ever holds more than about
 * twice the limit, and only the classes up to log2 of the limit, plus one,
 * hold any. `settingsLimit` is the SETTINGS_HEADER_TABLE_SIZE this endpoint
 * advertised and the peer acknowledged; the table starts at it.
 * `maxHeaderListSize` counts each field as its name, its value and 32 bytes,
 * as SETTINGS_MAX_HEADER_LIST_SIZE does (RFC 9113 §6.5.2).
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
  /** The storage a block is decoded with, made by the first `decode`, so an idle connection holds none. */
  work: HpackWork | null = null
  /**
   * The octets every block so far has copied to index a field: a name
   * named by index, copied out of a table into the scratch, and each field
   * `table.add` copies in. A block may add at most its budget to it
   * (`HPACK_COPY_FACTOR`); it is public so that tests can read it.
   */
  tableCopied: i64 = 0

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

  /** The decoder's working storage, made the first time it is asked for. */
  working(): HpackWork {
    const work: HpackWork | null = this.work
    if (work !== null) {
      return work
    }
    const made: HpackWork = new HpackWork()
    this.work = made
    return made
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

  /** Appends the name at static or dynamic index `index`, which must be in range, to `out`. */
  appendNameAt(index: i32, out: u8[]): void {
    if (index <= HPACK_STATIC_LENGTH) {
      hpackAppendText(out, hpackStaticName(index))
      return
    }
    const i: i32 = index - HPACK_STATIC_LENGTH
    hpackAppend(out, this.table.bytes, this.table.nameStart(i), this.table.nameLength(i))
  }

  /** Appends the value at `index` to `out`, as `appendNameAt` does the name. */
  appendValueAt(index: i32, out: u8[]): void {
    if (index <= HPACK_STATIC_LENGTH) {
      hpackAppendText(out, hpackStaticValue(index))
      return
    }
    const i: i32 = index - HPACK_STATIC_LENGTH
    hpackAppend(out, this.table.bytes, this.table.valueStart(i), this.table.valueLength(i))
  }

  /** How many octets the name at `index` has. */
  nameLengthAt(index: i32): i32 {
    if (index <= HPACK_STATIC_LENGTH) {
      return toI32(hpackStaticName(index).length)
    }
    return this.table.nameLength(index - HPACK_STATIC_LENGTH)
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
    return toI64(this.table.entrySize(index - HPACK_STATIC_LENGTH))
  }

  /** Whether `index` names an entry of either table. */
  hasIndex(index: i32): boolean {
    return index >= 1 && index <= HPACK_STATIC_LENGTH + this.table.count()
  }

  /** Empties the fields and gives each one's array back, emptied, to its class's pool, for the next block. */
  clear(): void {
    while (toI32(this.names.length) > 0) {
      const work: HpackWork = this.working()
      const last: i32 = toI32(this.names.length) - 1
      const name: u8[] = this.names[last]
      const value: u8[] = this.values[last]
      this.names.pop()
      this.values.pop()
      work.pool(work.classOf(toI32(name.length))).push(name)
      work.pool(work.classOf(toI32(value.length))).push(value)
      // Emptied as it goes back, so a reference a caller kept past the block reads nothing until the array is taken again.
      hpackEmpty(name)
      hpackEmpty(value)
      this.neverIndexed.pop()
    }
  }

  /**
   * Decodes one whole header block, `block[off, off + len)`, and answers
   * `HPACK_OK`, `HPACK_LIST_TOO_LARGE` or a negative `HPACK_ERR_*` code; the
   * module comment lists what each means. After a negative answer the fields
   * are empty and the decoder is spent.
   */
  decode(block: u8[], off: i32, len: i32): i32 {
    this.clear()
    if (this.failed !== 0) {
      return this.failed
    }
    const cursor: HpackCursor = this.working().cursor
    cursor.reset(block, off, len)
    const result: i32 = this.decodeFields(cursor)
    if (result < 0) {
      this.failed = result
      this.clear()
    }
    return result
  }

  /**
   * The body of `decode`: one pass over the representations.
   *
   * A field is counted against the header-list limit before it is copied out,
   * and one past the limit is never copied. That is what keeps a block of
   * one-byte indexes, each naming a large dynamic entry, from copying the
   * entry's size per byte read: past the limit an indexed field costs a
   * lookup and nothing else, and a literal whose name is an index costs its
   * value's octets, which the block holds, and a lookup. The one copy a peer
   * can ask for past the limit is a literal with incremental indexing, which
   * the table must take: its name and value are copied into the table, at
   * most the table's maximum size per field, after its name is copied into
   * the scratch when it is an index, and a block whose copies pass
   * `HPACK_COPY_FACTOR` times the larger of the table's size and its own
   * length ends the connection (`docs/security/http2.md`, H2-1). A
   * literal's strings are read into the two scratch arrays, which the block's
   * own length and the table's size bound, and a field within the limit is
   * copied into the pools, which the limit bounds; nothing is allocated once
   * those have grown to the largest block and list seen.
   */
  decodeFields(c: HpackCursor): i32 {
    let listSize: i64 = 0
    let tooLarge: boolean = false
    let sawField: boolean = false
    // What this block has asked the table to copy, against its budget.
    let copied: i64 = 0
    const length: i32 = c.end - c.pos
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
          const size: i64 = this.sizeAt(index)
          listSize += size
          tooLarge = tooLarge || listSize > toI64(this.maxHeaderListSize)
          if (!tooLarge) {
            // The entry's cost less the overhead is its name and value.
            const nameLength: i32 = this.nameLengthAt(index)
            const name: u8[] = this.working().take(nameLength)
            this.appendNameAt(index, name)
            const value: u8[] = this.working().take(toI32(size) - HPACK_ENTRY_OVERHEAD - nameLength)
            this.appendValueAt(index, value)
            this.names.push(name)
            this.values.push(value)
            this.neverIndexed.push(false)
          }
          break
        }
        default: {
          const index: i32 = hpackDecodeInteger(c, rep === HPACK_REP_INCREMENTAL ? 6 : 4)
          if (index < 0) {
            return index
          }
          if (index !== 0 && !this.hasIndex(index)) {
            return HPACK_ERR_INDEX
          }
          const work: HpackWork = this.working()
          // A new name is read into the scratch; one named by index stays in its table until it is needed.
          const name: u8[] = work.nameScratch
          hpackEmpty(name)
          if (index === 0) {
            const status: i32 = hpackDecodeString(this.huffman, c, name)
            if (status < 0) {
              return status
            }
          }
          const value: u8[] = work.valueScratch
          hpackEmpty(value)
          const status: i32 = hpackDecodeString(this.huffman, c, value)
          if (status < 0) {
            return status
          }
          const nameLength: i32 = index === 0 ? toI32(name.length) : this.nameLengthAt(index)
          const size: i64 = toI64(nameLength) + toI64(value.length) + toI64(HPACK_ENTRY_OVERHEAD)
          sawField = true
          listSize += size
          tooLarge = tooLarge || listSize > toI64(this.maxHeaderListSize)
          const incremental: boolean = rep === HPACK_REP_INCREMENTAL
          const fits: boolean = size <= toI64(this.table.maxSize)
          // The table copies the field in, and an indexed name out first.
          const added: boolean = incremental && fits
          const nameOut: i64 = index !== 0 ? toI64(nameLength) : toI64(0)
          const cost: i64 = added ? size - toI64(HPACK_ENTRY_OVERHEAD) + nameOut : toI64(0)
          copied += cost
          const scale: i32 = this.table.maxSize > length ? this.table.maxSize : length
          if (copied > toI64(HPACK_COPY_FACTOR) * toI64(scale)) {
            return HPACK_ERR_COPY_BUDGET
          }
          // An indexed name is copied out only when the table takes the field,
          // into the scratch, or the program does, straight into its field; both
          // before the table changes, since adding the field, or emptying the
          // table for one too large, may evict the entry the name came from and
          // move what `bytes` holds (§4.4). A field that is neither costs its
          // value's octets and a lookup.
          if (index !== 0 && added) {
            this.appendNameAt(index, name)
          }
          if (!tooLarge) {
            const kept: u8[] = work.take(nameLength)
            if (index === 0 || added) {
              const from: i32 = 0
              hpackAppend(kept, name, from, toI32(name.length))
            } else {
              this.appendNameAt(index, kept)
            }
            this.names.push(kept)
            this.values.push(this.copyOf(value))
            this.neverIndexed.push(rep === HPACK_REP_NEVER)
          }
          if (added) {
            this.tableCopied += cost
            this.table.add(name, value)
          } else if (incremental) {
            const nothing: i32 = 0
            this.table.evictTo(nothing)
          }
        }
      }
    }
    return tooLarge ? HPACK_LIST_TOO_LARGE : HPACK_OK
  }

  /** A pooled copy of `bytes`, for the caller. */
  copyOf(bytes: u8[]): u8[] {
    const out: u8[] = this.working().take(toI32(bytes.length))
    for (const b of bytes) {
      out.push(b)
    }
    return out
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
      const t: HpackTable = this.table
      if (
        hpackSameAsWindow(name, t.bytes, t.nameStart(i), t.nameLength(i)) &&
        hpackSameAsWindow(value, t.bytes, t.valueStart(i), t.valueLength(i))
      ) {
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
      if (hpackSameAsWindow(name, this.table.bytes, this.table.nameStart(i), this.table.nameLength(i))) {
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
      this.table.add(name, value)
    }
  }
}
