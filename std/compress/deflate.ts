/**
 * `nish/compress/deflate` — DEFLATE (RFC 1951), both ways, in pure Nish: a
 * compressor with levels and a decompressor that refuses malformed input with
 * an error code. `nish/compress/gzip` and `nish/compress/zlib` frame it.
 *
 *     import { Deflater, Inflater, DEFLATE_FAST, deflateBound } from "nish/compress/deflate";
 *
 *     const deflater = new Deflater(DEFLATE_FAST); // tables, once
 *     const out: u8[] = new Array<u8>(deflateBound(len));
 *     const end: i32 = deflater.compress(src, off, len, out, 0); // -1: no room
 *     const inflater = new Inflater();
 *     const n: i32 = inflater.decompress(out, 0, end, back, 0, limit); // < 0: an error
 *
 * **Sans-IO and allocation-free once built.** Both objects take caller-owned
 * windows, `src[off .. off + len)` in and `out[at ..)` out, and answer where
 * the output ends. Everything a call needs — the match finder's hash chains,
 * the block's symbols, the Huffman scratch, the decoder's tables — is
 * allocated by the constructor, about 330 KB for a `Deflater` and 28 KB for an
 * `Inflater`, so build one per thread and reuse it: a call allocates nothing.
 * The free functions `deflateCompress` and `deflateDecompress` build one for
 * a single call, for a program that compresses once.
 *
 * **Levels.** `DEFLATE_STORE` (0) writes stored blocks only. 1 to 3 match
 * greedily on a four-byte hash with a short chain (`DEFLATE_FAST` is 1, about
 * libdeflate's level 1); 4 to 9 match lazily on a three-byte hash with longer
 * chains (`DEFLATE_DEFAULT` is 6). Every block is written as whichever of
 * dynamic Huffman, fixed Huffman and stored is smallest, by its exact size in
 * bits, so no level ever expands its input by more than `deflateBound`
 * allows. A block ends after 16,383 symbols.
 *
 * **Decompression is bounded and total.** `Inflater.decompress` writes at most
 * `limit` bytes, and a stream that would write more answers
 * `DEFLATE_ERR_OUTPUT_LIMIT`, so a small input cannot expand without bound.
 * Every malformed stream — a reserved block type, a stored length whose
 * complement is wrong, an over-subscribed or incomplete code, a symbol no code
 * defines, a distance before the start of the output, input that ends inside
 * the stream — answers its own negative `DEFLATE_ERR_*` code; nothing a stream
 * holds can panic. Bytes after the final block are `DEFLATE_ERR_TRAILING`
 * from `decompress`; `inflate`, the resumable step under it and
 * `nish/compress/gzip`'s reader, stops at the final block and says where.
 *
 * **What is unchecked.** The hot loops read and write through `nish:unsafe`'s
 * `uncheckedGet` and `uncheckedSet`. Each such index is one of: a table
 * entry, below a size the constructor allocated and the `readonly` field
 * keeps; a position the caller's window was checked to contain before the
 * loop; or a match candidate, which the loop checks lies in
 * `[histStart, p)` before reading it. A stream's distances and lengths are
 * checked against the output before any copy.
 *
 * Written from RFC 1951; the code-length construction follows Moffat and
 * Katajainen, "In-place calculation of minimum-redundancy codes" (1995), and
 * the length limit is the Kraft-sum repair of the counts per length. Not
 * ported from another implementation.
 */
import { uncheckedGet, uncheckedSet, wrappingAdd, wrappingMul, wrappingSub } from "nish:unsafe"
import { tryCopyBytes } from "nish/bytes"

/** Level 0: stored blocks only, the input copied with five bytes of framing per 65,535. */
export const DEFLATE_STORE: i32 = 0

/** Level 1: greedy matching on a short hash chain, for speed over ratio. */
export const DEFLATE_FAST: i32 = 1

/** Level 6: lazy matching, zlib's and gzip's default balance. */
export const DEFLATE_DEFAULT: i32 = 6

/** Level 9: lazy matching on the longest chains. */
export const DEFLATE_BEST: i32 = 9

/** `compress` and its framings: `out` has no room for the whole stream. */
export const DEFLATE_NO_ROOM: i32 = -1

/** The input ends inside the stream. */
export const DEFLATE_ERR_TRUNCATED: i32 = -2

/** A block of the reserved type 3 (RFC 1951 §3.2.3). */
export const DEFLATE_ERR_BLOCK_TYPE: i32 = -3

/** A stored block whose `NLEN` is not the complement of its `LEN` (§3.2.4). */
export const DEFLATE_ERR_STORED_LENGTH: i32 = -4

/**
 * A dynamic block's code is unusable (§3.2.7): an over-subscribed or
 * incomplete set of lengths, a repeat with nothing to repeat or past the end,
 * more than 286 literal/length or 30 distance codes, or no end-of-block code.
 */
export const DEFLATE_ERR_HUFFMAN: i32 = -5

/** A code the block's tables do not define, or literal/length 286 or 287, or distance 30 or 31. */
export const DEFLATE_ERR_SYMBOL: i32 = -6

/** A distance that reaches back before the start of the output. */
export const DEFLATE_ERR_DISTANCE: i32 = -7

/** The output would pass `limit` bytes, or the end of `out`. */
export const DEFLATE_ERR_OUTPUT_LIMIT: i32 = -8

/** `decompress`: bytes follow the final block. */
export const DEFLATE_ERR_TRAILING: i32 = -15

/**
 * A window outside its array, from the calls that answer it rather than
 * panic: `Inflater.inflateAll` and the decoders' `decompressRange`.
 */
export const DEFLATE_ERR_WINDOW: i32 = -16

/** `Inflater.inflate`: the final block has ended; `inPos` is the first byte after it. */
export const INFLATE_DONE: i32 = 1

/** `Inflater.inflate`: every byte given was used and the stream goes on; call again with more. */
export const INFLATE_NEED_INPUT: i32 = 2

/** `Inflater.inflate`: the next symbol does not fit before `outEnd`; make room and call again. */
export const INFLATE_NEED_OUTPUT: i32 = 3

/** The farthest a match reaches back (§3.2.5), and the size of the chain table. */
const DEFLATE_WINDOW: i32 = 32768

/** The longest match (§3.2.5). */
const DEFLATE_MAX_MATCH: i32 = 258

/** The bits of a hash, and the size of the head table. */
const DEFLATE_HASH_SIZE: i32 = 32768

/** The symbols one block holds before it is written. */
const DEFLATE_BLOCK_TOKENS: i32 = 16384

/** A table position this far up is slid back down before the next block. */
const DEFLATE_REBASE: i32 = 1073741824

/** Huffman's multiplier for the hash (Knuth's 2^32 / phi, 2654435761, in 32 signed bits). */
const DEFLATE_HASH_MUL: i32 = -1640531535

/** `FixedDeflater`'s largest hash table, 2^14 entries; a call clears only as much as its input needs. */
const FIXED_HASH_BITS: i32 = 14
/** `FixedDeflater`'s hash table size, `1 << FIXED_HASH_BITS`. */
const FIXED_HASH_SIZE: i32 = 16384

/** Decoder table entry kinds, in bits 8 to 10 of an entry. */
const INF_LITERAL: i32 = 0
const INF_LENGTH: i32 = 1
const INF_END: i32 = 2
const INF_SLOW: i32 = 3
const INF_INVALID: i32 = 4
/** A pointer to a subtable: its start as the value, its bits as the extra bits, the main table's bits as the length. */
const INF_SUB: i32 = 5

/**
 * The bits the literal/length and distance tables index directly; a longer
 * code is decoded through a subtable after the main table.
 */
const INF_LIT_BITS: i32 = 11
const INF_DIST_BITS: i32 = 8

/**
 * The most entries a table with its subtables can need, over every complete
 * code of up to 15 bits: what zlib's `enough` program computes for 288
 * symbols with 11 root bits and for 32 with 8 (`enough 288 11 15`,
 * `enough 32 8 15`), the figures libdeflate sizes its tables by.
 */
const INF_LIT_ENOUGH: i32 = 2342
const INF_DIST_ENOUGH: i32 = 402

/** The output the fast loop keeps in hand: the longest match and 32 bytes of copy slack. */
const INF_FAST_ROOM: i32 = 290
const INF_CL_BITS: i32 = 7

/** The decoder's resumable states. */
const INF_S_BLOCK: i32 = 0
const INF_S_STORED: i32 = 1
const INF_S_HUFF: i32 = 2
const INF_S_DONE: i32 = 3

/**
 * The most bytes `Deflater.compress` writes for `n` bytes of input, at any
 * level: the input stored, five bytes of framing for every 65,535 and for
 * every block, and slack for the last partial byte. A negative `n`
 * answers 0, and an `n` past 2,146,664,744, the largest whose bound fits,
 * answers -1: its bound would pass 2^31 - 1.
 *
 * @param n The length of the input, in bytes.
 * @returns A size in bytes, not a position: an `out` with this many bytes
 *   from `at` always holds the stream; or -1 for an `n` past 2,146,664,744.
 */
export const deflateBound = (n: i32): i32 => {
  if (n < 0) {
    return 0
  }
  if (n > 2146664744) {
    return -1
  }
  return n + ((n >> 16) + (n >> 14) + 2) * 5 + 8
}

/**
 * The most bytes a compressed body of `n` input bytes takes in any of this
 * directory's formats: `deflateBound(n)` with room for gzip's 18 bytes of
 * header and trailer, which covers zlib's 6.
 *
 * @param n The length of the input, in bytes.
 * @returns A size in bytes, not a position: an `out` with this many bytes
 *   from `at` always holds the raw, zlib or gzip stream; or -1 for an `n`
 *   past 2,146,664,726, the largest whose bound with the 18 bytes fits.
 */
export const compressBound = (n: i32): i32 => {
  const b: i32 = deflateBound(n)
  if (b < 0 || b > 2147483629) {
    return -1
  }
  return b + 18
}

/**
 * Copies `b[from .. from + 16)` to `b[to .. to + 16)` eight bytes at a time,
 * each word read after the one before it is written, which is LZ77's
 * meaning when `to - from` is at least 8. The caller has checked the range.
 */
const inflateCopy16 = (b: u8[], to: integer<0, 2147483631>, from: integer<0, 2147483631>): void => {
  const to8: i32 = to + 8
  const from8: i32 = from + 8
  deflateStore64(b, to, deflateLoad64(b, from))
  deflateStore64(b, to8, deflateLoad64(b, from8))
}

/** Stores `w` twice into `b[to .. to + 16)`; the caller has checked the range. */
const inflateFill16 = (b: u8[], to: integer<0, 2147483631>, w: u64): void => {
  const to8: i32 = to + 8
  deflateStore64(b, to, w)
  deflateStore64(b, to8, w)
}

/** Panics unless `buf[off .. off + len)` lies inside `buf`. */
const deflateWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${toI32(buf.length)} bytes`)
  }
}

/**
 * The little-endian 32-bit word at `b[p .. p + 4)`; the caller has checked the
 * range. `p`'s range is what lets `p + 3` be an `add nsw`, which is what lets
 * LLVM fold the four byte loads into one.
 */
const deflateLoad32 = (b: u8[], p: integer<0, 2147483639>): u32 =>
  toU32(uncheckedGet(b, p)) |
  (toU32(uncheckedGet(b, p + 1)) << 8) |
  (toU32(uncheckedGet(b, p + 2)) << 16) |
  (toU32(uncheckedGet(b, p + 3)) << 24)

/**
 * The multiplicative hash of a little-endian `word`: the top `32 - shift`
 * bits of its product with `DEFLATE_HASH_MUL`, a head-table index.
 */
const deflateHash = (word: u32, shift: i32): i32 =>
  // Multiplicative hashing keeps the low 32 bits of the product and reads its
  // top bits, so the multiply wraps by design; the shift, not the product,
  // bounds the index.
  wrappingMul(toI32(word), DEFLATE_HASH_MUL) >>> shift

/**
 * The little-endian 64-bit word at `b[p .. p + 8)`; the caller has checked the
 * range. Eight byte loads, not two `deflateLoad32`s: LLVM folds these into
 * one load, and a word built from two halves keeps `deflateStore64` from
 * becoming one store.
 */
const deflateLoad64 = (b: u8[], p: integer<0, 2147483639>): u64 =>
  toU64(uncheckedGet(b, p)) |
  (toU64(uncheckedGet(b, p + 1)) << toU64(8)) |
  (toU64(uncheckedGet(b, p + 2)) << toU64(16)) |
  (toU64(uncheckedGet(b, p + 3)) << toU64(24)) |
  (toU64(uncheckedGet(b, p + 4)) << toU64(32)) |
  (toU64(uncheckedGet(b, p + 5)) << toU64(40)) |
  (toU64(uncheckedGet(b, p + 6)) << toU64(48)) |
  (toU64(uncheckedGet(b, p + 7)) << toU64(56))

/** Stores `w` little-endian into `b[p .. p + 8)`; the caller has checked the range. */
const deflateStore64 = (b: u8[], p: integer<0, 2147483639>, w: u64): void => {
  uncheckedSet(b, p, toU8(w))
  uncheckedSet(b, p + 1, toU8(w >> toU64(8)))
  uncheckedSet(b, p + 2, toU8(w >> toU64(16)))
  uncheckedSet(b, p + 3, toU8(w >> toU64(24)))
  uncheckedSet(b, p + 4, toU8(w >> toU64(32)))
  uncheckedSet(b, p + 5, toU8(w >> toU64(40)))
  uncheckedSet(b, p + 6, toU8(w >> toU64(48)))
  uncheckedSet(b, p + 7, toU8(w >> toU64(56)))
}

/** The number of trailing zero bits of a nonzero `x`. */
const deflateCtz64 = (x: u64): i32 => {
  // Both halves, then a select rather than a branch on which is nonzero.
  const lo: u32 = toU32(x)
  const hi: u32 = toU32(x >> toU64(32))
  const low: i32 = toI32(31) - Math.clz32(lo & (toU32(0) - lo))
  const high: i32 = toI32(63) - Math.clz32(hi & (toU32(0) - hi))
  return lo !== 0 ? low : high
}

/**
 * `off + len` for a window of `a` that `deflateWindow` accepted, or -1 for
 * one outside `a`. It is `a.length` less the room the window leaves: each
 * step subtracts two values from zero up, so the bounds prover sees no sum
 * that can overflow.
 */
const deflateWindowEnd = (a: u8[], off: i32, len: i32): i32 => {
  if (off < 0 || len < 0) {
    return -1
  }
  const n: i32 = toI32(a.length)
  const room: i32 = n - off
  if (room < 0) {
    return -1
  }
  const gap: i32 = room - len
  return gap < 0 ? -1 : n - gap
}

/**
 * How many bytes from `a` and from `b` agree, at most `max` and at most
 * `DEFLATE_MAX_MATCH`; `a < b` and `b + max` lie inside `src`, which the
 * caller has checked.
 */
const deflateMatchLength = (src: u8[], a: i32, b: i32, max: i32): i32 => {
  // `src` is at most 2^31 - 1 bytes and `b + max` lies inside it, so a
  // position past 2,147,483,389 only starts a match within 258 bytes of the
  // largest array's end: that one is reported as none, a valid if shorter
  // answer, and the bound is what lets `a + k` and `b + k` be proven sums.
  // `k`'s caps are no-ops for a caller, whose `max` is at most 258.
  if (a < 0 || b < 0 || a > 2147483389 || b > 2147483389) {
    return 0
  }
  let k: i32 = 0
  while (k >= 0 && k <= 250 && k + 8 <= max) {
    const pa: i32 = a + k
    const pb: i32 = b + k
    const x: u64 = deflateLoad64(src, pa) ^ deflateLoad64(src, pb)
    if (x !== toU64(0)) {
      return k + (deflateCtz64(x) >> 3)
    }
    k += 8
  }
  while (k >= 0 && k < 258 && k < max) {
    if (uncheckedGet(src, a + k) !== uncheckedGet(src, b + k)) {
      return k
    }
    k += 1
  }
  return k
}

/** `code`'s low `len` bits in the reverse order, as DEFLATE packs a Huffman code (§3.1.1). */
const deflateReverse = (code: i32, len: i32): i32 => {
  let v: i32 = code
  let r: i32 = 0
  for (let i: i32 = 0; i < len; i += 1) {
    r = (r << 1) | (v & 1)
    v = v >> 1
  }
  return r
}

/**
 * The base length of each length symbol 257 + s (§3.2.5); every `s` past 27
 * answers symbol 28's, 258.
 */
const deflateLengthBase = (s: i32): i32 => {
  if (s < 8) {
    return 3 + s
  }
  if (s >= 28) {
    return 258
  }
  // 4 to 7 times 2^((s >> 2) - 1), plus 3.
  const mant: i32 = toI32(4) + (s & 3)
  switch (s >> 2) {
    case 2:
      return mant * 2 + 3
    case 3:
      return mant * 4 + 3
    case 4:
      return mant * 8 + 3
    case 5:
      return mant * 16 + 3
    default:
      return mant * 32 + 3
  }
}

/**
 * The extra bits of each length symbol 257 + s (§3.2.5); every `s` past 27
 * answers symbol 28's, 0.
 */
const deflateLengthExtra = (s: i32): i32 => (s < 8 || s >= 28 ? 0 : (s >> 2) - 1)

/**
 * The base distance of each distance symbol (§3.2.5); every `d` past 29
 * answers symbol 29's, 24577.
 */
const deflateDistBase = (d: i32): i32 => {
  if (d < 4) {
    return 1 + d
  }
  if (d >= 29) {
    return 24577
  }
  // 2 or 3 times 2^((d >> 1) - 1), plus 1.
  const mant: i32 = toI32(2) + (d & 1)
  switch (d >> 1) {
    case 2:
      return mant * 2 + 1
    case 3:
      return mant * 4 + 1
    case 4:
      return mant * 8 + 1
    case 5:
      return mant * 16 + 1
    case 6:
      return mant * 32 + 1
    case 7:
      return mant * 64 + 1
    case 8:
      return mant * 128 + 1
    case 9:
      return mant * 256 + 1
    case 10:
      return mant * 512 + 1
    case 11:
      return mant * 1024 + 1
    case 12:
      return mant * 2048 + 1
    case 13:
      return mant * 4096 + 1
    default:
      return mant * 8192 + 1
  }
}

/** The extra bits of each distance symbol (§3.2.5). */
const deflateDistExtra = (d: i32): i32 => (d < 4 ? 0 : (d >> 1) - 1)

/** The order the code-length code's lengths are sent in (§3.2.7). */
const deflateClOrder = (i: i32): i32 => {
  switch (i) {
    case 0:
      return 16
    case 1:
      return 17
    case 2:
      return 18
    case 3:
      return 0
    case 4:
      return 8
    case 5:
      return 7
    case 6:
      return 9
    case 7:
      return 6
    case 8:
      return 10
    case 9:
      return 5
    case 10:
      return 11
    case 11:
      return 4
    case 12:
      return 12
    case 13:
      return 3
    case 14:
      return 13
    case 15:
      return 2
    case 16:
      return 14
    case 17:
      return 1
    default:
      return 15
  }
}

/** The fixed literal/length code's length for symbol `s` (§3.2.6). */
const deflateFixedLitLength = (s: i32): i32 => {
  if (s < 144) {
    return 8
  }
  if (s < 256) {
    return 9
  }
  if (s < 280) {
    return 7
  }
  return 8
}

/**
 * The fixed code (§3.2.6) of literal/length symbol `s`, bit-reversed for the
 * LSB-first stream: what `deflateCanonical` gives the fixed lengths, written
 * out by its four runs: from 0x30, 0x190, 0 and 0xc0.
 */
const deflateFixedLitCode = (s: i32): i32 => {
  if (s < 144) {
    return deflateReverse(0x30 + s, 8)
  }
  if (s < 256) {
    return deflateReverse(s + 256, 9)
  }
  if (s < 280) {
    return deflateReverse(s - 256, 7)
  }
  return deflateReverse(s - 88, 8)
}

/**
 * Fills `codes[0 .. n)` with the canonical code (§3.2.2) of the lengths
 * `lens[0 .. n)`, each already bit-reversed for the LSB-first stream. `count`
 * and `next` are scratch of at least 16 entries. A length of 0 gets code 0.
 * Answers false, filling nothing, when a table is smaller than that, `n`
 * is past 288, the largest alphabet, or the lengths oversubscribe the code;
 * the lengths `deflateLengths` sets and every caller's tables rule all three
 * out.
 */
const deflateCanonical = (lens: i32[], n: i32, codes: i32[], count: i32[], next: i32[]): boolean => {
  if (
    n < 0 ||
    n > 288 ||
    n > toI32(lens.length) ||
    n > toI32(codes.length) ||
    toI32(count.length) < 16 ||
    toI32(next.length) < 16
  ) {
    return false
  }
  for (let i: i32 = 0; i < 16; i += 1) {
    count[i] = 0
  }
  for (let s: i32 = 0; s < n; s += 1) {
    const l: i32 = lens[s]
    if (l >= 0 && l < 16) {
      const c: i32 = count[l]
      if (c >= 288) {
        return false
      }
      count[l] = c + 1
    }
  }
  count[0] = 0
  let code: i32 = 0
  for (let l: i32 = 1; l < 16; l += 1) {
    // The codes of lengths below `l` take at most the first 2^(l - 1) of
    // its prefixes, so a code that fits never passes 2^14 here; lengths
    // that oversubscribe the code fail.
    const c: i32 = count[l - 1]
    if (c < 0 || c > 288 || code < 0 || code > 16384) {
      return false
    }
    code = (code + c) << 1
    next[l] = code
  }
  // Each length's next code is kept bit-reversed, as it is written, and
  // incremented that way: clear the ones below its highest zero and set it.
  for (let l: i32 = 1; l < 16; l += 1) {
    next[l] = deflateReverse(next[l], l)
  }
  for (let s: i32 = 0; s < n; s += 1) {
    const l: i32 = lens[s]
    if (l > 0 && l < 16) {
      const r: i32 = next[l]
      codes[s] = r
      // `top` is the `l` low bits. Flipping `r` from its highest zero below
      // `l` up clears the ones above that zero and sets it.
      const top: i32 = ~(toI32(-1) << l)
      if (r !== top) {
        const from: i32 = toI32(-1) << (31 - toI32(Math.clz32(toU32(r ^ top))))
        next[l] = r ^ (top & from)
      }
    } else {
      codes[s] = 0
    }
  }
  return true
}

/**
 * The scratch `deflateLengths` sorts and folds in, sized for the 288
 * literal/length symbols, the largest alphabet.
 */
export class DeflateHuffmanScratch {
  /** @internal Used by `deflateLengths`. Symbols sorted by frequency, then by symbol. */
  readonly syms: i32[]
  /** @internal Used by `deflateLengths`. Their frequencies, then (in place) the tree, then their lengths. */
  readonly keys: i32[]
  /** @internal Used by `deflateLengths`. The other half of each radix pass. */
  readonly tmpSyms: i32[]
  /** @internal Used by `deflateLengths`. */
  readonly tmpKeys: i32[]
  /** @internal Used by `deflateLengths`. The radix pass's 256 buckets. */
  readonly buckets: u16[]
  /** @internal Used by `deflateLengths`. How many codes have each length, 0 to 32. */
  readonly perLength: i32[]

  /** Allocates the scratch. */
  constructor() {
    this.syms = new Array<i32>(288)
    this.keys = new Array<i32>(288)
    this.tmpSyms = new Array<i32>(288)
    this.tmpKeys = new Array<i32>(288)
    this.buckets = new Array<u16>(256)
    this.perLength = new Array<i32>(33)
  }
}

/**
 * Sets `lens[0 .. n)` to code lengths of at most `limit` bits for the
 * frequencies `freq[0 .. n)`: a minimum-redundancy code (Moffat and
 * Katajainen's in-place construction over the symbols sorted by frequency),
 * then, if a length passed `limit`, the counts per length repaired until the
 * Kraft sum is exactly 1 again. A symbol of frequency 0 gets length 0. With
 * fewer than two used symbols, symbols are given length 1 until two have
 * one, so the code is always complete. Answers false, setting nothing, when
 * the alphabet or `limit` is outside the scratch's sizes or a frequency is
 * 2^16 or more, which every caller's tables and blocks rule out. Those
 * bounds keep every weight below 2^25 and every count at most 288, which
 * the guards below check where the bounds prover reads them; one that fails
 * answers false with `lens[0 .. n)` already zeroed.
 */
const deflateLengths = (freq: i32[], n: i32, limit: i32, lens: i32[], w: DeflateHuffmanScratch): boolean => {
  const syms: i32[] = w.syms
  const keys: i32[] = w.keys
  const tsyms: i32[] = w.tmpSyms
  const tkeys: i32[] = w.tmpKeys
  const buckets: u16[] = w.buckets
  const per: i32[] = w.perLength
  if (
    n < 2 ||
    n > 288 ||
    n > toI32(freq.length) ||
    n > toI32(lens.length) ||
    toI32(syms.length) < 288 ||
    toI32(keys.length) < 288 ||
    toI32(tsyms.length) < 288 ||
    toI32(tkeys.length) < 288 ||
    toI32(buckets.length) < 256 ||
    toI32(per.length) < 33 ||
    limit < 1 ||
    limit > 15
  ) {
    return false
  }
  // The used symbols, by a two-pass radix sort on the 16-bit frequency.
  let used: i32 = 0
  let wide: i32 = 0
  for (let s: i32 = 0; s < n; s += 1) {
    const f: i32 = freq[s]
    if (f > 65535) {
      return false
    }
    if (f > 0) {
      wide = wide | f
      uncheckedSet(tsyms, used, s)
      uncheckedSet(tkeys, used, f)
      used += 1
    }
  }
  for (let s: i32 = 0; s < n; s += 1) {
    lens[s] = 0
  }
  if (used < 2) {
    // One code or none: every decoder wants a complete code, so give two
    // symbols one bit each.
    let given: i32 = 0
    for (let s: i32 = 0; s < n && given < 2; s += 1) {
      if (freq[s] > 0) {
        lens[s] = 1
        given += 1
      }
    }
    for (let s: i32 = 0; s < n && given < 2; s += 1) {
      if (lens[s] === 0) {
        lens[s] = 1
        given += 1
      }
    }
    return true
  }
  // Every frequency below 256 needs only the low pass.
  const passes: i32 = wide > 255 ? 2 : 1
  for (let pass: i32 = 0; pass < passes; pass += 1) {
    const shift: i32 = pass === 0 ? 0 : 8
    for (let b: i32 = 0; b < 256; b += 1) {
      uncheckedSet(buckets, b, toU16(0))
    }
    const fromSyms: i32[] = pass === 0 ? tsyms : syms
    const fromKeys: i32[] = pass === 0 ? tkeys : keys
    const toSyms: i32[] = pass === 0 ? syms : tsyms
    const toKeys: i32[] = pass === 0 ? keys : tkeys
    for (let i: i32 = 0; i < used; i += 1) {
      const b: i32 = (uncheckedGet(fromKeys, i) >> shift) & 255
      // A bucket holds at most `used`, at most 288, symbols.
      const c: i32 = toI32(uncheckedGet(buckets, b))
      if (c >= 288) {
        return false
      }
      uncheckedSet(buckets, b, toU16(c + 1))
    }
    // Each bucket's first slot. The counts are 16-bit, so 256 of them cannot
    // overflow `sum`. They are never negative, so every prefix is at most the
    // total: when that is `used`, at most 288, no slot stored here lost a
    // bit to `toU16`, and when it is not, the sort fails.
    let sum: i32 = 0
    for (let b: i32 = 0; b < 256; b += 1) {
      const c: u16 = uncheckedGet(buckets, b)
      uncheckedSet(buckets, b, toU16(sum))
      sum += toI32(c)
    }
    if (sum !== used) {
      return false
    }
    for (let i: i32 = 0; i < used; i += 1) {
      const k: i32 = uncheckedGet(fromKeys, i)
      const b: i32 = (k >> shift) & 255
      // Each bucket's next slot is below `used`, so inside the 288 entries
      // `toSyms` and `toKeys` hold.
      const at: i32 = toI32(uncheckedGet(buckets, b))
      if (at >= 288) {
        return false
      }
      uncheckedSet(buckets, b, toU16(at + 1))
      uncheckedSet(toSyms, at, uncheckedGet(fromSyms, i))
      uncheckedSet(toKeys, at, k)
    }
  }
  // Two passes leave the sorted run back in `tsyms` / `tkeys`.
  if (passes === 2) {
    for (let i: i32 = 0; i < used; i += 1) {
      uncheckedSet(syms, i, uncheckedGet(tsyms, i))
      uncheckedSet(keys, i, uncheckedGet(tkeys, i))
    }
  }
  // Moffat and Katajainen, phase 1: each internal node's weight, and each
  // node's parent, in place over the ascending weights. A weight is at most
  // the sum of 288 frequencies below 2^16, so below 2^25.
  const w0: i32 = uncheckedGet(keys, 0)
  const w1: i32 = uncheckedGet(keys, 1)
  if (w0 < 0 || w0 > 33554431 || w1 < 0 || w1 > 33554431) {
    return false
  }
  uncheckedSet(keys, 0, w0 + w1)
  let root: i32 = 0
  let leaf: i32 = 2
  for (let next: i32 = 1; next < used - 1; next += 1) {
    // `root` names an internal node, below `next`, so below 287.
    if (root > 286) {
      return false
    }
    if (leaf >= used || uncheckedGet(keys, root) < uncheckedGet(keys, leaf)) {
      uncheckedSet(keys, next, uncheckedGet(keys, root))
      uncheckedSet(keys, root, next)
      root += 1
    } else {
      uncheckedSet(keys, next, uncheckedGet(keys, leaf))
      leaf += 1
    }
    if (root > 286) {
      return false
    }
    const first: i32 = uncheckedGet(keys, next)
    if (leaf >= used || (root < next && uncheckedGet(keys, root) < uncheckedGet(keys, leaf))) {
      const second: i32 = uncheckedGet(keys, root)
      if (first < 0 || first > 33554431 || second < 0 || second > 33554431) {
        return false
      }
      uncheckedSet(keys, next, first + second)
      uncheckedSet(keys, root, next)
      root += 1
    } else {
      const second: i32 = uncheckedGet(keys, leaf)
      if (first < 0 || first > 33554431 || second < 0 || second > 33554431) {
        return false
      }
      uncheckedSet(keys, next, first + second)
      leaf += 1
    }
  }
  // Phase 2: each internal node's depth, one more than its parent's, which
  // is below the 287 internal nodes.
  uncheckedSet(keys, used - 2, 0)
  for (let next: i32 = used - 3; next >= 0; next -= 1) {
    const up: i32 = uncheckedGet(keys, uncheckedGet(keys, next))
    if (up > 286) {
      return false
    }
    uncheckedSet(keys, next, up + 1)
  }
  // Phase 3: how many leaves sit at each depth, every depth past `limit`
  // counted at `limit + 1`, which the length limit below folds into `limit`
  // whatever the depth. A tree of at most 288 leaves is under 288 deep and
  // has under 288 internal nodes at any depth.
  for (let l: i32 = 0; l < 33; l += 1) {
    per[l] = 0
  }
  let avail: i32 = 1
  let usedHere: i32 = 0
  let depth: i32 = 0
  root = used - 2
  while (avail > 0) {
    if (depth < 0 || depth >= 288) {
      return false
    }
    while (root >= 0 && uncheckedGet(keys, root) === depth) {
      if (usedHere >= 288) {
        return false
      }
      usedHere += 1
      root -= 1
    }
    let slot: i32 = limit + 1
    if (depth <= limit) {
      slot = depth
    }
    // `usedHere` is never negative, so `avail > 0` only restates the first test.
    while (avail > usedHere && avail > 0) {
      const c: i32 = per[slot]
      if (c >= 288) {
        return false
      }
      per[slot] = c + 1
      avail -= 1
    }
    avail = usedHere << 1
    depth += 1
    usedHere = 0
  }
  // The length limit: fold the deeper codes into `limit`, then lengthen
  // shorter codes until the Kraft sum is exactly 2^limit again.
  const over: i32 = per[limit + 1]
  if (over > 0) {
    const kept: i32 = per[limit]
    if (kept > 288 || over > 288) {
      return false
    }
    per[limit] = kept + over
    per[limit + 1] = 0
    // The Kraft sum in units of 2^-limit, by Horner's rule: after length
    // `l` it is at most 288 << (l - 1), below 2^23 for `l` up to 15.
    let total: i32 = 0
    for (let l: i32 = 1; l <= limit; l += 1) {
      const c: i32 = per[l]
      if (c < 0 || c > 288 || total < 0 || total > 8388607) {
        return false
      }
      total = total * 2 + c
    }
    // Each pass takes one off the sum: a code of `limit` bits goes, and one
    // of a shorter length `l` becomes two of `l + 1`.
    const want: i32 = toI32(1) << limit
    // `want` is at least 2, so `total > 0` only restates the first test.
    while (total > want && total > 0) {
      const most: i32 = per[limit]
      if (most < 1) {
        return false
      }
      per[limit] = most - 1
      let l: i32 = limit - 1
      while (l > 0 && per[l] === 0) {
        l -= 1
      }
      if (l <= 0) {
        return false
      }
      const c: i32 = per[l]
      const below: i32 = per[l + 1]
      if (c < 1 || below > 286) {
        return false
      }
      per[l] = c - 1
      per[l + 1] = below + 2
      total -= 1
    }
    if (total !== want) {
      return false
    }
  }
  // The most frequent symbols take the shortest lengths; the counts per
  // length add up to `used`.
  let j: i32 = used
  for (let l: i32 = 1; l <= limit; l += 1) {
    for (let c: i32 = per[l]; c > 0; c -= 1) {
      if (j <= 0) {
        return false
      }
      j -= 1
      const s: i32 = uncheckedGet(syms, j)
      if (s < 0 || s >= n) {
        return false
      }
      lens[s] = l
    }
  }
  return j === 0
}

/**
 * A DEFLATE compressor at one level: the match finder's tables, one block of
 * symbols, the Huffman scratch and the bit writer, allocated once. Not shared
 * between threads; reuse it for every call on one.
 */
export class Deflater {
  /** `head[h]`: the most recent position whose hash is `h`, plus `delta`; 0 for none. */
  private readonly head: i32[]
  /** `prev[p & 32767]`: the position before `p` with `p`'s hash. */
  private readonly prev: i32[]
  /** The block's symbols: a literal byte, or `dist << 9 | (256 + len - 3)`. */
  private readonly tokens: i32[]
  /** The block's literal/length and distance frequencies. */
  private readonly litFreq: i32[]
  private readonly distFreq: i32[]
  /** The dynamic code for the block. */
  private readonly litLens: i32[]
  private readonly litCodes: i32[]
  private readonly distLens: i32[]
  private readonly distCodes: i32[]
  /** The code-length code, and the run-length coded lengths it codes. */
  private readonly clFreq: i32[]
  private readonly clLens: i32[]
  private readonly clCodes: i32[]
  private readonly rle: i32[]
  /** The fixed code (§3.2.6). */
  private readonly fixedLitLens: i32[]
  private readonly fixedLitCodes: i32[]
  private readonly fixedDistLens: i32[]
  private readonly fixedDistCodes: i32[]
  /** Length - 3 to length symbol - 257; distance to distance symbol, as `deflateDistSymbol` reads it. */
  private readonly lengthSymbol: u8[]
  private readonly distSymbol: u8[]
  /**
   * Base and extra bits of each length and distance symbol. A base is a
   * `u16` so the writer's `length - base` is an `i32` difference whose
   * range the prover knows without a guard.
   */
  private readonly lengthBase: u16[]
  private readonly lengthExtra: u8[]
  private readonly distBase: u16[]
  private readonly distExtra: u8[]
  /** Canonical-code and length-building scratch. */
  private readonly countScratch: i32[]
  private readonly nextScratch: i32[]
  private readonly scratch: DeflateHuffmanScratch
  /** Bits written but not yet stored, low bit first, and how many. */
  private bitBuf: u64
  /** 0 to 31 between writes; every reader checks it, as a field has no proven range. */
  private bitCount: i32
  /** Set when a store would have run past `out`: the call answers `DEFLATE_NO_ROOM`. */
  private overrun: boolean
  /** @internal Used by `GzipCompressor`, `GzipWriter` (std/compress/gzip.ts) and `ZlibCompressor` (std/compress/zlib.ts). The level, 0 to 9. */
  readonly level: i32
  /** Candidates tried per position. */
  private readonly maxChain: i32
  /** A match this long is taken without looking further. */
  private readonly niceLength: i32
  /** A match shorter than this is checked against the next position's (levels 4 to 9); 0 for greedy. */
  private readonly lazyLength: i32
  /** The shortest match taken: 4 at levels 1 to 3, whose hash covers four bytes, else 3. */
  private readonly minMatch: i32
  /** A table position is an index of the current input plus this. */
  private delta: i32
  /** The next call's `delta` floor: past every position the tables hold, by a whole window. */
  private base: i32
  /** How many of `tokens` the block holds. */
  private count: i32
  /** How many entries of `rle` the block uses. */
  private rleCount: i32

  /**
   * A compressor at `level`, 0 to 9; another level panics.
   *
   * @param level How hard to compress: `DEFLATE_STORE` (0) stores,
   *   `DEFLATE_FAST` (1) to 3 match greedily, 4 to `DEFLATE_BEST` (9) match
   *   lazily on longer chains, `DEFLATE_DEFAULT` being 6.
   */
  constructor(level: i32) {
    if (level < 0 || level > 9) {
      panic(`Deflater: level ${level} is outside 0 to 9`)
    }
    this.level = level
    let chain: i32 = 0
    let nice: i32 = 0
    let lazy: i32 = 0
    switch (level) {
      case 1:
        chain = 2
        nice = 32
        break
      case 2:
        chain = 6
        nice = 64
        break
      case 3:
        chain = 12
        nice = 128
        break
      case 4:
        chain = 12
        nice = 64
        lazy = 8
        break
      case 5:
        chain = 24
        nice = 128
        lazy = 16
        break
      case 6:
        chain = 48
        nice = 128
        lazy = 16
        break
      case 7:
        chain = 96
        nice = 258
        lazy = 32
        break
      case 8:
        chain = 256
        nice = 258
        lazy = 128
        break
      case 9:
        chain = 1024
        nice = 258
        lazy = 258
        break
      default:
        break
    }
    this.maxChain = chain
    this.niceLength = nice
    this.lazyLength = lazy
    this.minMatch = level >= 4 ? 3 : 4
    this.head = new Array<i32>(DEFLATE_HASH_SIZE)
    this.prev = new Array<i32>(DEFLATE_WINDOW)
    this.delta = 0
    this.base = DEFLATE_WINDOW + 1
    this.tokens = new Array<i32>(DEFLATE_BLOCK_TOKENS)
    this.count = 0
    this.litFreq = new Array<i32>(288)
    this.distFreq = new Array<i32>(32)
    this.litLens = new Array<i32>(288)
    this.litCodes = new Array<i32>(288)
    this.distLens = new Array<i32>(32)
    this.distCodes = new Array<i32>(32)
    this.clFreq = new Array<i32>(19)
    this.clLens = new Array<i32>(19)
    this.clCodes = new Array<i32>(19)
    this.rle = new Array<i32>(320)
    this.rleCount = 0
    this.fixedLitLens = new Array<i32>(288)
    this.fixedLitCodes = new Array<i32>(288)
    this.fixedDistLens = new Array<i32>(32)
    this.fixedDistCodes = new Array<i32>(32)
    this.lengthSymbol = new Array<u8>(256)
    this.distSymbol = new Array<u8>(512)
    this.lengthBase = new Array<u16>(29)
    this.lengthExtra = new Array<u8>(29)
    this.distBase = new Array<u16>(30)
    this.distExtra = new Array<u8>(30)
    this.countScratch = new Array<i32>(16)
    this.nextScratch = new Array<i32>(16)
    this.scratch = new DeflateHuffmanScratch()
    this.bitBuf = 0
    this.bitCount = 0
    this.overrun = false
    for (let s: i32 = 0; s < 29; s += 1) {
      this.lengthBase[s] = toU16(deflateLengthBase(s))
      this.lengthExtra[s] = toU8(deflateLengthExtra(s))
    }
    for (let s: i32 = 0; s < 29; s += 1) {
      const lo: i32 = deflateLengthBase(s) - 3
      // Symbol 27 stops short of 258, which has symbol 28 to itself.
      let hi: i32 = 256
      if (s < 27) {
        const next: i32 = s + 1
        hi = deflateLengthBase(next) - 3
      } else if (s === 27) {
        hi = 255
      }
      for (let l: i32 = lo; l < hi && l >= 0 && l < 256; l += 1) {
        this.lengthSymbol[l] = toU8(s)
      }
    }
    for (let d: i32 = 0; d < 30; d += 1) {
      this.distBase[d] = toU16(deflateDistBase(d))
      this.distExtra[d] = toU8(deflateDistExtra(d))
    }
    // Distances 1 to 256 directly; above, by (distance - 1) >> 7 from 256 on.
    for (let d: i32 = 0; d < 30; d += 1) {
      const lo: i32 = deflateDistBase(d)
      let hi: i32 = 32769
      if (d < 29) {
        const next: i32 = d + 1
        hi = deflateDistBase(next)
      }
      for (let dist: i32 = lo; dist < hi && dist >= 1 && dist <= 32768; dist += 1) {
        if (dist <= 256) {
          this.distSymbol[dist - 1] = toU8(d)
        } else {
          const at: i32 = ((dist - 1) >> 7) + 256
          if (at < 512) {
            this.distSymbol[at] = toU8(d)
          }
        }
      }
    }
    for (let s: i32 = 0; s < 288; s += 1) {
      this.fixedLitLens[s] = deflateFixedLitLength(s)
    }
    for (let d: i32 = 0; d < 32; d += 1) {
      this.fixedDistLens[d] = 5
    }
    for (let s: i32 = 0; s < 288; s += 1) {
      this.fixedLitCodes[s] = deflateFixedLitCode(s)
    }
    for (let d: i32 = 0; d < 32; d += 1) {
      this.fixedDistCodes[d] = deflateReverse(d, 5)
    }
  }

  /**
   * @internal Called by `GzipWriter` (std/compress/gzip.ts).
   * Forgets the history: the next call starts a stream from nothing. Only a
   * streaming writer needs it; `compress` starts a new stream on every call.
   */
  reset(): void {
    this.bitBuf = 0
    this.bitCount = 0
    this.overrun = false
  }

  /**
   * Compresses `src[off .. off + len)` into `out` from `at` as one raw
   * DEFLATE stream, and answers where it ends, or `DEFLATE_NO_ROOM` when
   * `out` cannot hold it: `deflateBound(len)` bytes always can. A window
   * outside its array panics. Allocates nothing.
   *
   * @param src The array that holds the data to compress.
   * @param off Where in `src` the data starts.
   * @param len How many bytes of data to compress.
   * @param out The caller's array the stream is written into.
   * @param at Where in `out` the stream starts.
   * @returns The index in `out` one past the stream's last byte, so the
   *   stream is `out[at .. result)`; or `DEFLATE_NO_ROOM`, after which the
   *   bytes of `out` from `at` may have been overwritten and mean nothing.
   *   Each call is a whole stream: nothing carries over to the next.
   */
  compress(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    deflateWindow("Deflater.compress", src, off, len)
    deflateWindow("Deflater.compress", out, at, 0)
    this.bitBuf = 0
    this.bitCount = 0
    this.overrun = false
    const srcEnd: i32 = deflateWindowEnd(src, off, len)
    this.begin(off)
    const end: i32 = this.compressRange(src, off, srcEnd, off, true, out, at, toI32(out.length))
    this.finish(srcEnd)
    if (end < 0) {
      // Every other -1 under `compressRange` (a table not its size, a code
      // that does not build, a position past i32) cannot happen: the
      // constructor sizes the tables, the codes are built from frequencies
      // this class counted, and `begin` and `rebase` keep positions low. So
      // this is a lack of room, which a larger `out` cures.
      return DEFLATE_NO_ROOM
    }
    return this.flushBits(out, end, toI32(out.length))
  }

  /**
   * @internal Called by `GzipWriter` (std/compress/gzip.ts).
   * Starts a stream whose history begins at index `start` of the next input:
   * every position the tables hold is pushed a window behind it.
   */
  begin(start: i32): void {
    let base: i32 = this.base
    // 32769 is DEFLATE_WINDOW + 1, spelled out for the bounds prover.
    if (base > DEFLATE_REBASE || base < 32769) {
      this.forget()
      base = DEFLATE_WINDOW + 1
    }
    if (start < 0) {
      // No stream starts before its input; the next write answers -1.
      this.overrun = true
      return
    }
    this.delta = base - start
  }

  /**
   * @internal Called by `GzipWriter` (std/compress/gzip.ts).
   * Ends a stream whose input ended at index `end`: the next stream's
   * positions start a window past every position the tables now hold.
   */
  finish(end: i32): void {
    const v: i32 = this.position(end)
    // Past the rebase floor (DEFLATE_REBASE, spelled out for the bounds
    // prover), the next `begin` clears the tables.
    this.base = v < 0 || v > 1073741824 ? DEFLATE_REBASE + 1 : v + DEFLATE_WINDOW + 1
  }

  /**
   * @internal Called by `GzipWriter` (std/compress/gzip.ts).
   * Moves the tables' positions down by `shift`, as the input they index
   * moves down by `shift` bytes; a position that falls below 0 is dropped.
   * The streaming writer calls it when it slides its window.
   */
  slide(shift: i32): void {
    const delta: i32 = this.delta
    // DEFLATE_REBASE - 1 and DEFLATE_REBASE, spelled out for the bounds prover.
    if (shift < 0 || shift > 1073741823 || delta > 1073741824) {
      // A slide no rebase can follow: drop the history instead. The output
      // stays valid DEFLATE; only matches into the dropped history are lost.
      // `GzipWriter` never gets here: it shifts by 1 to 65,536 right after a
      // `compressRange`, which rebased any position past DEFLATE_REBASE, so
      // `delta` is at most DEFLATE_REBASE.
      this.forget()
      this.delta = DEFLATE_WINDOW + 1
      return
    }
    this.delta = delta + shift
  }

  /** Empties the tables, so that no position is a candidate. */
  private forget(): void {
    this.head.fill(0)
    this.prev.fill(0)
    this.base = DEFLATE_WINDOW + 1
  }

  /**
   * The table position of input index `p`, `p + delta`, or -1 when that is
   * negative or past the i32 range.
   */
  private position(p: i32): i32 {
    const delta: i32 = this.delta
    if (p < 0) {
      return -1
    }
    if (delta <= 0) {
      const v: i32 = p + delta
      return v < 0 ? -1 : v
    }
    // `p + delta`, as 2147483647 less the room left above it: each step
    // subtracts two values from zero up, so none can overflow.
    const gap: i32 = 2147483647 - delta - p
    return gap < 0 ? -1 : 2147483647 - gap
  }

  /**
   * @internal Called by `GzipWriter` (std/compress/gzip.ts).
   * Writes the whole bytes of the bit buffer, and the last partial byte
   * padded with zeros, into `out` at `op`; answers the end, or
   * `DEFLATE_NO_ROOM`, which a pending `begin` refusal also answers.
   */
  flushBits(out: u8[], op: i32, oe: i32): i32 {
    return this.settle(this.writeBits(out, op, oe))
  }

  /** `flushBits` without settling `overrun`: a step inside a write. */
  private writeBits(out: u8[], op: i32, oe: i32): i32 {
    const bc: i32 = this.bitCount
    if (bc < 0 || bc > 63 || op < 0 || oe < 0 || oe > toI32(out.length)) {
      return DEFLATE_NO_ROOM
    }
    const bytes: i32 = (bc + 7) >> 3
    // `op + bytes`, as `oe` less the room the bytes leave: each step is
    // checked to be from zero up, so none can overflow.
    const room: i32 = oe - op
    if (room < 0) {
      return DEFLATE_NO_ROOM
    }
    const gap: i32 = room - bytes
    if (gap < 0) {
      return DEFLATE_NO_ROOM
    }
    const end: i32 = oe - gap
    let p: i32 = op
    let bb: u64 = this.bitBuf
    while (p < end) {
      uncheckedSet(out, p, toU8(bb & toU64(255)))
      bb = bb >> toU64(8)
      p += 1
    }
    this.bitBuf = 0
    this.bitCount = 0
    return p
  }

  /**
   * Appends the low `n` bits of `v` (`n` at most 32) to the bit buffer,
   * storing whole words into `out` at `op`; answers the new `op`. The caller
   * has checked the room.
   */
  private putBits(out: u8[], op: i32, v: i32, n: i32): i32 {
    const c: i32 = this.bitCount
    if (c < 0 || c > 31 || n < 0 || n > 32) {
      // No caller passes more than 32 bits, and every write leaves under 32.
      this.overrun = true
      return op
    }
    let bb: u64 = this.bitBuf | (toU64(toU32(v)) << toU64(c))
    let bc: i32 = c + n
    let p: i32 = op
    if (bc >= 32) {
      if (p >= 0 && p <= toI32(out.length) - 4) {
        uncheckedSet(out, p, toU8(bb & toU64(255)))
        uncheckedSet(out, p + 1, toU8((bb >> toU64(8)) & toU64(255)))
        uncheckedSet(out, p + 2, toU8((bb >> toU64(16)) & toU64(255)))
        uncheckedSet(out, p + 3, toU8((bb >> toU64(24)) & toU64(255)))
        p += 4
      } else {
        this.overrun = true
      }
      bb = bb >> toU64(32)
      bc -= 32
    }
    this.bitBuf = bb
    this.bitCount = bc
    return p
  }

  /**
   * Stores whole bytes of the bit buffer into `out` at `op` and drops the
   * partial byte's padding: the byte alignment a stored block's `LEN`
   * starts at. Answers the new `op`; the caller has checked the room.
   */
  private alignBits(out: u8[], op: i32): i32 {
    const p: i32 = this.writeBits(out, op, toI32(out.length))
    if (p < 0) {
      this.overrun = true
      return op
    }
    return p
  }

  /**
   * @internal Called by `GzipWriter` (std/compress/gzip.ts).
   * Compresses `src[start .. end)` as blocks into `out[op .. oe)`, matching
   * back as far as `histStart`; `final` marks the last block BFINAL. Answers
   * the new output position, with up to 31 bits still in the bit buffer, or
   * -1 when a range lies outside its array or a block does not fit.
   */
  compressRange(
    src: u8[],
    start: i32,
    end: i32,
    histStart: i32,
    final: boolean,
    out: u8[],
    op: i32,
    oe: i32
  ): i32 {
    if (start < 0 || histStart < 0 || histStart > start || start > end || end > toI32(src.length)) {
      return this.settle(toI32(-1))
    }
    if (op < 0 || oe < 0 || oe > toI32(out.length) || op > oe) {
      return this.settle(toI32(-1))
    }
    let p: i32 = start
    let o: i32 = op
    if (start === end) {
      if (!final) {
        return o
      }
      // An empty final block, in the fixed code: ten bits.
      const bc: i32 = this.bitCount
      if (bc < 0 || bc > 31 || (bc + 17) >> 3 > oe - o) {
        return this.settle(toI32(-1))
      }
      o = this.putBits(out, o, toI32(3), toI32(3))
      return this.settle(this.putBits(out, o, deflateFixedLitCode(256), deflateFixedLitLength(256)))
    }
    if (this.level === 0) {
      return this.writeStored(src, start, end, final, out, o, oe)
    }
    while (p < end) {
      const v: i32 = this.position(p)
      if (v < 0) {
        return this.settle(toI32(-1))
      }
      if (v > DEFLATE_REBASE) {
        this.rebase(p, v)
      }
      const q: i32 =
        this.level >= 4
          ? this.collectLazy(src, p, end, histStart)
          : this.collectGreedy(src, p, end, histStart)
      if (q < 0) {
        return this.settle(toI32(-1))
      }
      o = this.writeBlock(src, p, q, final && q === end, out, o, oe)
      if (o < 0) {
        return this.settle(toI32(-1))
      }
      p = q
    }
    return this.settle(o)
  }

  /**
   * Answers `o`, or -1 when a store since the last call would have run past
   * `out` (`overrun`), which it clears: the end of every writing entry point.
   */
  private settle(o: i32): i32 {
    if (this.overrun) {
      this.overrun = false
      return -1
    }
    return o
  }

  /**
   * Slides every table position down so that index `p` of the input is a
   * window above the floor again; a position more than a window behind `p`
   * becomes 0, which is never a candidate. `v` is `p`'s position.
   */
  private rebase(p: i32, v: i32): void {
    // 1073741824 is DEFLATE_REBASE, spelled out for the bounds prover.
    if (p < 0 || v <= 1073741824) {
      return
    }
    const shift: i32 = v - (DEFLATE_WINDOW + 1)
    // A table entry is a position or 0, the never-a-candidate fill; only a
    // positive one shifts, and one that falls out of the window becomes 0.
    const head: i32[] = this.head
    const prev: i32[] = this.prev
    for (let i: i32 = 0; i < toI32(head.length); i += 1) {
      const e: i32 = head[i]
      let h: i32 = 0
      if (e > shift) {
        h = e - shift
      }
      head[i] = h
    }
    for (let i: i32 = 0; i < toI32(prev.length); i += 1) {
      const e: i32 = prev[i]
      let h: i32 = 0
      if (e > shift) {
        h = e - shift
      }
      prev[i] = h
    }
    this.delta = 32769 - p // DEFLATE_WINDOW + 1 - p
    // `base` is a position, never negative; a stream's next `begin` restarts
    // the tables from any `base` below the window's floor.
    const base: i32 = this.base
    this.base = base > shift ? base - shift : 0
  }

  /**
   * The best match at `p`, after recording `p` in the chains: answers
   * `len << 16 | dist`, or 0 for none at least `minMatch` long. `p + 4 <=
   * end`, which the caller checks. Answers -1, recording nothing, when a
   * table is not its size or `p` is outside that bound; the constructor and
   * the caller rule both out.
   */
  private longest(src: u8[], p: i32, end: i32, histStart: i32): i32 {
    const head: i32[] = this.head
    const prev: i32[] = this.prev
    if (
      toI32(head.length) !== DEFLATE_HASH_SIZE ||
      toI32(prev.length) !== DEFLATE_WINDOW ||
      p < 0 ||
      p > 2147483639 ||
      end < 4 ||
      p > end - 4 ||
      end > toI32(src.length)
    ) {
      return -1
    }
    const minMatch: i32 = this.minMatch
    if (minMatch < 3 || minMatch > 4) {
      return -1
    }
    const v: i32 = this.position(p)
    if (v < 0) {
      return -1
    }
    const at: integer<0, 2147483639> = p
    const word: u32 = deflateLoad32(src, at)
    const h: i32 = minMatch === 3 ? deflateHash(word << 8, 17) : deflateHash(word, 17)
    let cand: i32 = uncheckedGet(head, h)
    uncheckedSet(head, h, v)
    uncheckedSet(prev, v & (DEFLATE_WINDOW - 1), cand)
    // Where a whole longest match fits, eight bytes past `p` can be read
    // whatever the match, and nothing is clamped.
    const roomy: boolean = p <= end - DEFLATE_MAX_MATCH
    const maxLen: i32 = roomy ? DEFLATE_MAX_MATCH : end - p
    let best: i32 = minMatch - 1
    let bestDist: i32 = 0
    // Past 2,147,483,389 a match runs within 258 bytes of the largest
    // array's end; `p` is recorded but reported as matching nothing, a valid
    // if shorter answer, and the bound is what lets `p + best` be a proven sum.
    if (p > 2147483389) {
      return 0
    }
    if (histStart < 0) {
      return -1
    }
    const back: i32 = p - histStart
    if (back < 0) {
      return -1
    }
    // A candidate is at most a window back and no further than `histStart`:
    // its distance, `v` less its position, is 1 to `span`.
    const span: i32 = back < DEFLATE_WINDOW ? back : DEFLATE_WINDOW
    const nice: i32 = this.niceLength < maxLen ? this.niceLength : maxLen
    const mask: u32 = minMatch === 3 ? toU32(0xffffff) : ~toU32(0)
    let chain: i32 = this.maxChain
    // A position is never negative, so `cand >= 0` only tells the prover so;
    // nor is a match longer than 258 (DEFLATE_MAX_MATCH, spelled out for the
    // prover), and the bound on `best` tells it that `p + best` fits.
    while (cand >= 0 && chain > 0 && best >= 0 && best < 258) {
      // The byte that would make a match the longest yet: most candidates
      // fail on it, so the scan for one that has it holds `best` still.
      const b: i32 = best
      const want: u8 = uncheckedGet(src, p + b)
      let hit: i32 = 0
      while (cand >= 0 && chain > 0) {
        const dist: i32 = v - cand
        if (dist < 1 || dist > span) {
          break
        }
        // `cand`'s input index, `cand - delta`; `span` keeps it at or past
        // `histStart`, and the check tells the prover so.
        const cd: i32 = p - dist
        if (cd < 0) {
          break
        }
        if (uncheckedGet(src, cd + b) === want) {
          hit = dist
          break
        }
        cand = uncheckedGet(prev, cand & (DEFLATE_WINDOW - 1))
        chain -= 1
      }
      // `hit` is a distance the scan checked, 1 to `span`, or 0 for none,
      // and a scan stops on one with `chain` left; the check tells the
      // prover so.
      if (hit < 1 || hit > span || chain < 1) {
        break
      }
      const cd: i32 = p - hit
      if (cd < 0) {
        break
      }
      const ci: integer<0, 2147483639> = cd
      let l: i32 = 0
      if (roomy) {
        const x: u64 = deflateLoad64(src, ci) ^ deflateLoad64(src, at)
        l = x !== toU64(0) ? deflateCtz64(x) >> 3 : deflateMatchLength(src, ci, p, DEFLATE_MAX_MATCH)
      } else if (((deflateLoad32(src, ci) ^ word) & mask) === 0) {
        l = deflateMatchLength(src, ci, p, maxLen)
      }
      if (l > best) {
        best = l
        bestDist = hit
        if (l >= nice) {
          break
        }
      }
      cand = uncheckedGet(prev, cand & (DEFLATE_WINDOW - 1))
      chain -= 1
    }
    if (bestDist === 0 || best < minMatch) {
      return 0
    }
    // A three-byte match far back costs more than its three literals.
    if (best === 3 && bestDist > 4096) {
      return 0
    }
    return (best << 16) | bestDist
  }

  /** Clears the block's symbols and frequencies. */
  private startBlock(): void {
    this.litFreq.fill(0)
    this.distFreq.fill(0)
    this.count = 0
  }

  /**
   * Fills the block's symbols greedily from `start`, and answers where the
   * block ends: at `end`, or where the symbol buffer filled; -1 when a table
   * is not its size, which the constructor rules out. The match finder, the
   * chains and the symbol bookkeeping are written out in this one loop over
   * locals, because this is the fast level's whole cost.
   */
  private collectGreedy(src: u8[], start: i32, end: i32, histStart: i32): i32 {
    this.startBlock()
    const head: i32[] = this.head
    const prev: i32[] = this.prev
    const tokens: i32[] = this.tokens
    const lf: i32[] = this.litFreq
    const df: i32[] = this.distFreq
    const lsym: u8[] = this.lengthSymbol
    const dsym: u8[] = this.distSymbol
    if (
      toI32(head.length) !== DEFLATE_HASH_SIZE ||
      toI32(prev.length) !== DEFLATE_WINDOW ||
      toI32(tokens.length) !== DEFLATE_BLOCK_TOKENS ||
      toI32(lf.length) < 288 ||
      toI32(df.length) < 32 ||
      toI32(lsym.length) < 256 ||
      toI32(dsym.length) < 512
    ) {
      return -1
    }
    if (start < 0 || end < 0 || end > toI32(src.length) || histStart < 0) {
      return -1
    }
    const maxChain: i32 = this.maxChain
    const niceLength: i32 = this.niceLength
    const room: i32 = DEFLATE_BLOCK_TOKENS - 1
    const last: i32 = end - 4
    const full: i32 = end - DEFLATE_MAX_MATCH
    let n: i32 = 0
    let p: i32 = start
    while (p < end && n < room) {
      let best: i32 = 0
      let bestDist: i32 = 0
      let at0: i32 = 0
      // Past 2,147,483,381 a match runs within 266 bytes of the largest
      // array's end; such a `p` is taken as a literal, and the bound is what
      // lets the match's sums be proven.
      if (p >= 0 && p >= histStart && p <= last && p <= 2147483381) {
        const v: i32 = this.position(p)
        if (v < 0) {
          return -1
        }
        at0 = v
        const at: integer<0, 2147483639> = p
        const word: u32 = deflateLoad32(src, at)
        const h: i32 = deflateHash(word, 17)
        let cand: i32 = uncheckedGet(head, h)
        uncheckedSet(head, h, v)
        uncheckedSet(prev, v & (DEFLATE_WINDOW - 1), cand)
        // `maxLen - 4`, which `p` at most `last` keeps at least 0.
        const tail: i32 = p <= full ? DEFLATE_MAX_MATCH - 4 : last - p
        const maxLen: i32 = p <= full ? DEFLATE_MAX_MATCH : end - p
        const nice: i32 = niceLength < maxLen ? niceLength : maxLen
        // A candidate is at most a window back and no further than
        // `histStart`: its distance, `v` less its position, is 1 to `span`.
        const back: i32 = p - histStart
        const span: i32 = back < DEFLATE_WINDOW ? back : DEFLATE_WINDOW
        let chain: i32 = maxChain
        while (cand >= 0 && chain > 0) {
          const dist: i32 = v - cand
          if (dist < 1 || dist > span) {
            break
          }
          // `cand`'s input index, `cand - delta`, at or past `histStart`.
          const ci: i32 = p - dist
          if (ci >= 0 && ci <= 2147483639 && deflateLoad32(src, ci) === word) {
            let l: i32 = 0
            if (p <= full && ci <= 2147483627) {
              const a4: i32 = ci + 4
              const b4: i32 = p + 4
              const x: u64 = deflateLoad64(src, a4) ^ deflateLoad64(src, b4)
              if (x !== toU64(0)) {
                l = toI32(4) + (deflateCtz64(x) >> 3)
              } else {
                const m: i32 = deflateMatchLength(src, ci + 12, p + 12, DEFLATE_MAX_MATCH - 12)
                if (m < 0 || m > 246) {
                  return -1
                }
                l = 12 + m
              }
            } else {
              const m: i32 = deflateMatchLength(src, ci + 4, p + 4, tail)
              if (m < 0 || m > 254) {
                return -1
              }
              l = 4 + m
            }
            if (l > best) {
              best = l
              bestDist = dist
              if (l >= nice) {
                break
              }
            }
          }
          cand = uncheckedGet(prev, cand & (DEFLATE_WINDOW - 1))
          chain -= 1
        }
      }
      if (best >= 4) {
        // A match is 4 to 258 bytes at a distance of 1 to the window, and
        // starts where the search ran; the checks tell the prover so, with
        // DEFLATE_MAX_MATCH and DEFLATE_WINDOW spelled out for it.
        const len: i32 = best
        const dist: i32 = bestDist
        const v: i32 = at0
        if (p < 0 || p > 2147483381 || len > 258 || dist < 1 || dist > 32768 || v < 0 || v > 2147483389) {
          return -1
        }
        uncheckedSet(tokens, n, (dist << 9) | (253 + len))
        n += 1
        const ls: i32 = 257 + toI32(uncheckedGet(lsym, len - 3))
        const lc: i32 = uncheckedGet(lf, ls)
        const ds: i32 = toI32(
          dist <= 256 ? uncheckedGet(dsym, dist - 1) : uncheckedGet(dsym, ((dist - 1) >> 7) + 256)
        )
        const dc: i32 = uncheckedGet(df, ds)
        if (lc >= DEFLATE_BLOCK_TOKENS || dc >= DEFLATE_BLOCK_TOKENS) {
          return -1
        }
        uncheckedSet(lf, ls, lc + 1)
        uncheckedSet(df, ds, dc + 1)
        // Every position the match covers goes into the chains.
        const stop: i32 = p + len
        // The positions up to `last` that the match covers, as `p + k` with
        // their positions `v + k`.
        const cnt: i32 = stop <= last ? len : end - p - 3
        for (let k: i32 = 1; k < cnt && k < 258; k += 1) {
          const q: i32 = p + k
          const vq: i32 = v + k
          const hq: i32 = deflateHash(deflateLoad32(src, q), 17)
          uncheckedSet(prev, vq & (DEFLATE_WINDOW - 1), uncheckedGet(head, hq))
          uncheckedSet(head, hq, vq)
        }
        p = stop
      } else {
        const b: i32 = toI32(uncheckedGet(src, p))
        uncheckedSet(tokens, n, b)
        n += 1
        const c: i32 = uncheckedGet(lf, b)
        if (c >= DEFLATE_BLOCK_TOKENS) {
          return -1
        }
        uncheckedSet(lf, b, c + 1)
        p += 1
      }
    }
    this.count = n
    return p
  }

  /**
   * Fills the block's symbols from `p`, deferring each match by a position
   * while the next one finds a longer one; answers where the block ends, or
   * -1 when a table is not its size or the match finder answers a match
   * outside the format, which the constructor and `longest` rule out. The
   * symbol bookkeeping and the chain inserts are written out over locals, as
   * in `collectGreedy`.
   */
  private collectLazy(src: u8[], start: i32, end: i32, histStart: i32): i32 {
    this.startBlock()
    const head: i32[] = this.head
    const prev: i32[] = this.prev
    const tokens: i32[] = this.tokens
    const lf: i32[] = this.litFreq
    const df: i32[] = this.distFreq
    const lsym: u8[] = this.lengthSymbol
    const dsym: u8[] = this.distSymbol
    if (
      toI32(head.length) !== DEFLATE_HASH_SIZE ||
      toI32(prev.length) !== DEFLATE_WINDOW ||
      toI32(tokens.length) !== DEFLATE_BLOCK_TOKENS ||
      toI32(lf.length) < 288 ||
      toI32(df.length) < 32 ||
      toI32(lsym.length) < 256 ||
      toI32(dsym.length) < 512
    ) {
      return -1
    }
    const three: boolean = this.minMatch === 3
    const lazyLength: i32 = this.lazyLength
    const room: i32 = DEFLATE_BLOCK_TOKENS - 2
    if (start < 0 || end < 0) {
      return -1
    }
    const last: i32 = end - 4
    let n: i32 = 0
    let p: i32 = start
    // The match `longest` found one position on, when it beat the one at
    // `p` and the position was taken as a literal: the next turn takes it
    // up without searching again. 0 for none.
    let carry: i32 = 0
    // The first position `longest` has not recorded.
    let inserted: i32 = p
    // A carried match is written even when the block is otherwise full: the
    // room leaves two tokens of slack.
    while (p < end && n <= room && (n < room || carry !== 0)) {
      let m: i32 = carry
      carry = 0
      if (m === 0 && p <= last) {
        m = this.longest(src, p, end, histStart)
        inserted = p + 1
      }
      if (m < 0) {
        return -1
      }
      if (m !== 0 && m >> 16 < lazyLength && p < last && n < room) {
        const p1: i32 = p + 1
        const m2: i32 = this.longest(src, p1, end, histStart)
        if (m2 < 0) {
          return -1
        }
        inserted = p + 2
        if (m2 >> 16 > m >> 16) {
          carry = m2
          m = 0
        }
      }
      if (m === 0) {
        const b: i32 = toI32(uncheckedGet(src, p))
        uncheckedSet(tokens, n, b)
        n += 1
        const c: i32 = uncheckedGet(lf, b)
        if (c >= DEFLATE_BLOCK_TOKENS) {
          return -1
        }
        uncheckedSet(lf, b, c + 1)
        p += 1
      } else {
        const len: i32 = m >> 16
        const dist: i32 = m & 0xffff
        if (p < 0 || len < 3 || len > DEFLATE_MAX_MATCH || dist < 1 || dist > DEFLATE_WINDOW) {
          return -1
        }
        uncheckedSet(tokens, n, (dist << 9) | (253 + len))
        n += 1
        const ls: i32 = 257 + toI32(uncheckedGet(lsym, len - 3))
        const lc: i32 = uncheckedGet(lf, ls)
        const ds: i32 = toI32(
          dist <= 256 ? uncheckedGet(dsym, dist - 1) : uncheckedGet(dsym, ((dist - 1) >> 7) + 256)
        )
        const dc: i32 = uncheckedGet(df, ds)
        if (lc >= DEFLATE_BLOCK_TOKENS || dc >= DEFLATE_BLOCK_TOKENS) {
          return -1
        }
        uncheckedSet(lf, ls, lc + 1)
        uncheckedSet(df, ds, dc + 1)
        // The positions the match covers that `longest` did not record go
        // into the chains.
        // `p + len` as `end` less the room past the match, which `longest`
        // keeps from going negative.
        const left: i32 = end - p
        if (left < 0) {
          return -1
        }
        const over: i32 = left - len
        if (over < 0) {
          return -1
        }
        const stop: i32 = end - over
        const insertEnd: i32 = stop <= last ? stop : last + 1
        let q: i32 = inserted
        let vq: i32 = this.position(q)
        while (q < insertEnd && q >= 0 && q <= 2147483639 && vq >= 0 && vq < 2147483647) {
          const qa: integer<0, 2147483639> = q
          const word: u32 = deflateLoad32(src, qa)
          const hq: i32 = three ? deflateHash(word << 8, 17) : deflateHash(word, 17)
          uncheckedSet(prev, vq & (DEFLATE_WINDOW - 1), uncheckedGet(head, hq))
          uncheckedSet(head, hq, vq)
          q += 1
          vq += 1
        }
        if (q < insertEnd) {
          return -1
        }
        p = stop
      }
    }
    this.count = n
    return p
  }

  /**
   * The bytes a stored rendering of `n` bytes adds to them, counted from the
   * start of a bit buffer holding `pending` bits (under 64): each piece of
   * up to 65,535 bytes has three header bits, the padding to a byte and four
   * bytes of `LEN` / `NLEN`. The answer is under 2^18.
   */
  private storedExtra(n: i32, pending: i32): i32 {
    if (n < 0 || pending < 0 || pending > 63) {
      return -1
    }
    // The pieces after the first, each of 65,535 bytes but the last.
    const more: i32 = n > 65535 ? (n - 1) / 65535 : 0
    if (more < 0 || more > 32768) {
      return -1
    }
    return ((pending + 10) >> 3) + 4 + more * 5
  }

  /**
   * @internal Called by `GzipWriter` (std/compress/gzip.ts).
   * Writes `src[start .. end)` as stored blocks, the last BFINAL when
   * `final`; answers the new position, or -1 without writing when it does
   * not fit in `out[op .. oe)` or the ranges are backwards or negative.
   */
  writeStored(src: u8[], start: i32, end: i32, final: boolean, out: u8[], op: i32, oe: i32): i32 {
    if (start < 0 || end < start || end < 0 || op < 0 || oe < op) {
      return -1
    }
    const n: i32 = end - start
    const room: i32 = oe - op
    const extra: i32 = this.storedExtra(n, this.bitCount)
    if (extra < 0 || room < extra || n > room - extra) {
      return -1
    }
    const len: i32 = toI32(out.length)
    if (len < 0) {
      return -1
    }
    const lim: i32 = len - 4
    let left: i32 = n
    let o: i32 = op
    let first: boolean = true
    while (first || left > 0) {
      first = false
      // A stored block's length is 16 bits: 65,535.
      const l0: i32 = left
      if (l0 < 0 || l0 > n) {
        return -1
      }
      const take: i32 = l0 < 65535 ? l0 : 65535
      if (take < 0 || take > 65535) {
        return -1
      }
      o = this.putBits(out, o, toI32(final && take === l0 ? 1 : 0), toI32(3))
      const at: i32 = this.alignBits(out, o)
      o = at
      const p: i32 = end - l0
      if (at >= 0 && at <= lim && tryCopyBytes(out, at + 4, src, p, take)) {
        uncheckedSet(out, at, toU8(take & 255))
        uncheckedSet(out, at + 1, toU8(take >> 8))
        uncheckedSet(out, at + 2, toU8(~take & 255))
        uncheckedSet(out, at + 3, toU8((~take >> 8) & 255))
        // The copy put `take` bytes after `at + 4` inside `out`, so `after`
        // is not negative and the new position is at most `len`.
        const gap: i32 = lim - at
        const after: i32 = gap < 0 ? -1 : gap - take
        if (after < 0) {
          return -1
        }
        o = len - after
      } else {
        this.overrun = true
      }
      const rem: i32 = l0 - take
      if (rem < 0) {
        return -1
      }
      left = rem
    }
    return this.settle(o)
  }

  /**
   * Builds the run-length coded lengths of the dynamic header (§3.2.7) for
   * `hlit` literal/length and `hdist` distance lengths, and their
   * frequencies in `clFreq`. Answers false, the scratch then unusable, when
   * it is not its size, the counts are past the format's or a length is past
   * 15, which the constructor, `writeBlock` and the length builder rule out.
   */
  private buildRle(hlit: i32, hdist: i32): boolean {
    const rle: i32[] = this.rle
    const freq: i32[] = this.clFreq
    const ll: i32[] = this.litLens
    const dl: i32[] = this.distLens
    freq.fill(0)
    if (
      toI32(rle.length) < 320 ||
      toI32(freq.length) < 19 ||
      hlit < 0 ||
      hlit > 288 ||
      hdist < 0 ||
      hdist > 32
    ) {
      return false
    }
    // At most 320 lengths, each giving at most one entry, and each count is
    // at most the number of entries: the checks below fail only on a scratch
    // or length table this writer did not fill.
    const total: i32 = hlit + hdist
    let n: i32 = 0
    let i: i32 = 0
    while (i < total) {
      const at: i32 = i
      if (at < 0) {
        return false
      }
      const l: i32 = at < hlit ? uncheckedGet(ll, at) : uncheckedGet(dl, at - hlit)
      let run: i32 = 1
      while (
        run < 320 &&
        at + run < total &&
        (at + run < hlit ? uncheckedGet(ll, at + run) : uncheckedGet(dl, at + run - hlit)) === l
      ) {
        run += 1
      }
      const k: i32 = run
      if (k < 1 || k > 320) {
        return false
      }
      i = at + k
      let left: i32 = k
      if (l === 0) {
        while (left >= 11) {
          const r0: i32 = left
          const r: i32 = r0 < 138 ? r0 : 138
          const at18: i32 = n
          const f18: i32 = freq[18]
          if (r < 11 || r > 138 || r0 > 320 || at18 < 0 || at18 >= 320 || f18 < 0 || f18 >= 320) {
            return false
          }
          uncheckedSet(rle, at18, ((r - 11) << 8) | 18)
          n = at18 + 1
          freq[18] = f18 + 1
          left = r0 - r
        }
        const r3: i32 = left
        if (r3 >= 3) {
          const at17: i32 = n
          const f17: i32 = freq[17]
          if (r3 > 10 || at17 < 0 || at17 >= 320 || f17 < 0 || f17 >= 320) {
            return false
          }
          uncheckedSet(rle, at17, ((r3 - 3) << 8) | 17)
          n = at17 + 1
          freq[17] = f17 + 1
          left = 0
        }
      } else {
        const next: i32 = this.rlePut(n, l)
        if (next < 0) {
          return false
        }
        n = next
        left = k - 1
        while (left >= 3) {
          const r0: i32 = left
          const r: i32 = r0 < 6 ? r0 : 6
          const at16: i32 = n
          const f16: i32 = freq[16]
          if (r < 3 || r > 6 || r0 > 320 || at16 < 0 || at16 >= 320 || f16 < 0 || f16 >= 320) {
            return false
          }
          uncheckedSet(rle, at16, ((r - 3) << 8) | 16)
          n = at16 + 1
          freq[16] = f16 + 1
          left = r0 - r
        }
      }
      while (left > 0) {
        const next: i32 = this.rlePut(n, l)
        if (next < 0) {
          return false
        }
        n = next
        left -= 1
      }
    }
    this.rleCount = n
    return true
  }

  /**
   * Appends length `l` at `rle[n]` and counts it in `clFreq`; answers -1,
   * writing nothing, when `n` is outside the 320-entry scratch, `l` is not a
   * code length 0 to 15, or its count would pass 320.
   * @param n The entry's position in `rle`.
   * @param l The code length to append.
   * @returns The next entry's position, or -1.
   */
  private rlePut(n: i32, l: i32): i32 {
    const rle: i32[] = this.rle
    const freq: i32[] = this.clFreq
    if (n < 0 || n >= 320 || l < 0 || l > 15 || toI32(rle.length) < 320 || toI32(freq.length) < 19) {
      return -1
    }
    const f: i32 = uncheckedGet(freq, l)
    if (f < 0 || f >= 320) {
      return -1
    }
    uncheckedSet(rle, n, l)
    uncheckedSet(freq, l, f + 1)
    return n + 1
  }

  /**
   * Writes the block's symbols, `src[start .. end)`'s, as the smallest of a
   * dynamic, a fixed and a stored block; answers the new position, or -1
   * without writing when that does not fit in `out[op .. oe)`. Answers -1
   * too, the stream then unusable, when a table is not its size, a range is
   * backwards or negative, or the header holds a code-length symbol past 18,
   * which the constructor, `compressRange` and `buildRle` rule out.
   */
  private writeBlock(src: u8[], start: i32, end: i32, final: boolean, out: u8[], op: i32, oe: i32): i32 {
    const lf: i32[] = this.litFreq
    const df: i32[] = this.distFreq
    const ll: i32[] = this.litLens
    const dl: i32[] = this.distLens
    const cf: i32[] = this.clFreq
    const cl: i32[] = this.clLens
    const cc: i32[] = this.clCodes
    if (
      toI32(lf.length) < 288 ||
      toI32(ll.length) < 288 ||
      toI32(dl.length) < 32 ||
      toI32(cf.length) < 19 ||
      toI32(cl.length) < 19 ||
      toI32(cc.length) < 19 ||
      start < 0 ||
      end < start ||
      op < 0 ||
      oe < op
    ) {
      return -1
    }
    lf[256] = 1
    if (!deflateLengths(lf, 286, 15, ll, this.scratch) || !deflateLengths(df, 30, 15, dl, this.scratch)) {
      return -1
    }
    ll[286] = 0
    ll[287] = 0
    dl[30] = 0
    dl[31] = 0
    if (
      !deflateCanonical(ll, 286, this.litCodes, this.countScratch, this.nextScratch) ||
      !deflateCanonical(dl, 30, this.distCodes, this.countScratch, this.nextScratch)
    ) {
      return -1
    }
    let hlit: i32 = 286
    while (hlit > 257 && ll[hlit - 1] === 0) {
      hlit -= 1
    }
    let hdist: i32 = 30
    while (hdist > 1 && dl[hdist - 1] === 0) {
      hdist -= 1
    }
    // The call may move any of `this`'s tables, as far as the bounds prover
    // knows, so their sizes are checked again.
    if (
      !this.buildRle(hlit, hdist) ||
      toI32(cf.length) < 19 ||
      toI32(cl.length) < 19 ||
      toI32(cc.length) < 19
    ) {
      return -1
    }
    if (
      !deflateLengths(cf, 19, 7, cl, this.scratch) ||
      !deflateCanonical(cl, 19, cc, this.countScratch, this.nextScratch)
    ) {
      return -1
    }
    let hclen: i32 = 19
    while (hclen > 4) {
      const k: i32 = deflateClOrder(hclen - 1)
      if (k < 0 || k >= 19) {
        return -1
      }
      if (cl[k] !== 0) {
        break
      }
      hclen -= 1
    }
    // The three sizes, exactly. Extra bits are the same in both codes. A
    // block holds at most 16,384 symbols of at most 15 bits and 13 extra
    // bits, so every count is at most 16,384, every length and extra below
    // 16, and every sum below 2^24 (16,777,216); the checks tell the bounds
    // prover so, and fail only on tables the constructor and the match
    // finders rule out.
    const lens: i32 = hclen
    if (lens < 4 || lens > 19) {
      return -1
    }
    let extra: i32 = 0
    let dynBits: i32 = lens * 3 + 17
    let fixBits: i32 = 3
    const lx: u8[] = this.lengthExtra
    const dx: u8[] = this.distExtra
    const fl: i32[] = this.fixedLitLens
    if (toI32(lx.length) < 29 || toI32(dx.length) < 30 || toI32(fl.length) < 286 || toI32(df.length) < 30) {
      return -1
    }
    for (let s: i32 = 0; s < 286; s += 1) {
      const f: i32 = uncheckedGet(lf, s)
      const dyn: i32 = uncheckedGet(ll, s)
      const fix: i32 = uncheckedGet(fl, s)
      const x: i32 = s >= 257 ? toI32(uncheckedGet(lx, s - 257)) : 0
      if (
        f < 0 ||
        f > 16384 ||
        dyn < 0 ||
        dyn > 15 ||
        fix < 0 ||
        fix > 15 ||
        x < 0 ||
        x > 15 ||
        dynBits < 0 ||
        dynBits > 16777215 ||
        fixBits < 0 ||
        fixBits > 16777215 ||
        extra < 0 ||
        extra > 16777215
      ) {
        return -1
      }
      dynBits += f * dyn
      fixBits += f * fix
      extra += f * x
    }
    for (let d: i32 = 0; d < 30; d += 1) {
      const f: i32 = uncheckedGet(df, d)
      const dyn: i32 = uncheckedGet(dl, d)
      const x: i32 = toI32(uncheckedGet(dx, d))
      if (
        f < 0 ||
        f > 16384 ||
        dyn < 0 ||
        dyn > 15 ||
        x < 0 ||
        x > 15 ||
        dynBits < 0 ||
        dynBits > 16777215 ||
        fixBits < 0 ||
        fixBits > 16777215 ||
        extra < 0 ||
        extra > 16777215
      ) {
        return -1
      }
      dynBits += f * dyn
      fixBits += f * 5
      extra += f * x
    }
    // The header's code-length symbols, each with its code and, for 16, 17
    // and 18, its 2, 3 or 7 repeat bits; `buildRle` writes at most 320.
    for (let s: i32 = 0; s < 19; s += 1) {
      const f: i32 = cf[s]
      const len: i32 = cl[s]
      let rep: i32 = 0
      if (s === 16) {
        rep = 2
      } else if (s === 17) {
        rep = 3
      } else if (s === 18) {
        rep = 7
      }
      if (f < 0 || f > 320 || len < 0 || len > 7 || rep < 0 || rep > 7 || dynBits < 0 || dynBits > 16777215) {
        return -1
      }
      dynBits += f * (len + rep)
    }
    if (
      dynBits < 0 ||
      dynBits > 16777215 ||
      fixBits < 0 ||
      fixBits > 16777215 ||
      extra < 0 ||
      extra > 16777215
    ) {
      return -1
    }
    const dynSize: i32 = dynBits + extra
    const fixSize: i32 = fixBits + extra
    const bc: i32 = this.bitCount
    if (bc < 0 || bc > 63) {
      return -1
    }
    // The stored size, `8 * (n + storedExtra) - bc` bits, is at most a size
    // `b` exactly when `n + storedExtra` is at most `(b + bc) >> 3` bytes.
    const n: i32 = end - start
    const storedExtra: i32 = this.storedExtra(n, bc)
    if (storedExtra < 0 || storedExtra > 262143) {
      return -1
    }
    const dynBytes: i32 = (dynSize + bc) >> 3
    const fixBytes: i32 = (fixSize + bc) >> 3
    if (n <= dynBytes - storedExtra && n <= fixBytes - storedExtra) {
      return this.writeStored(src, start, end, final, out, op, oe)
    }
    const dynamic: boolean = dynSize < fixSize
    const bytes: i32 = dynamic ? (bc + dynSize + 7) >> 3 : (bc + fixSize + 7) >> 3
    if (bytes > oe - op) {
      return -1
    }
    let o: i32 = this.putBits(
      out,
      op,
      (dynamic ? toI32(4) : toI32(2)) | (final ? toI32(1) : toI32(0)),
      toI32(3)
    )
    if (dynamic) {
      // `hlit` and `hdist` are 257 to 286 and 1 to 30; the check tells the
      // bounds prover so.
      const nl: i32 = hlit
      const nd: i32 = hdist
      if (nl < 257 || nl > 286 || nd < 1 || nd > 30) {
        return -1
      }
      o = this.putBits(out, o, (nl - 257) | ((nd - 1) << 5) | ((lens - 4) << 10), toI32(14))
      for (let i: i32 = 0; i < lens; i += 1) {
        const k: i32 = deflateClOrder(i)
        if (k < 0 || k >= 19) {
          return -1
        }
        o = this.putBits(out, o, cl[k], toI32(3))
      }
      const rle: i32[] = this.rle
      const runs: i32 = this.rleCount
      for (let i: i32 = 0; i < runs && i < toI32(rle.length); i += 1) {
        const e: i32 = rle[i]
        const sym: i32 = e & 255
        if (sym < 0 || sym >= 19) {
          return -1
        }
        o = this.putBits(out, o, cc[sym], cl[sym])
        if (sym === 16) {
          o = this.putBits(out, o, e >> 8, toI32(2))
        } else if (sym === 17) {
          o = this.putBits(out, o, e >> 8, toI32(3))
        } else if (sym === 18) {
          o = this.putBits(out, o, e >> 8, toI32(7))
        }
      }
      o = this.writeSymbols(this.litCodes, this.litLens, this.distCodes, this.distLens, out, o)
    } else {
      o = this.writeSymbols(
        this.fixedLitCodes,
        this.fixedLitLens,
        this.fixedDistCodes,
        this.fixedDistLens,
        out,
        o
      )
    }
    return o
  }

  /**
   * Writes the block's symbols and its end-of-block code under the given
   * code into `out` at `op`; answers the new position, or -1 when a table is
   * not its size, which the constructor rules out. The room was checked by
   * the block's exact size.
   */
  private writeSymbols(lc: i32[], ll: i32[], dc: i32[], dl: i32[], out: u8[], op: i32): i32 {
    const tokens: i32[] = this.tokens
    const n: i32 = this.count
    const lsym: u8[] = this.lengthSymbol
    const lbase: u16[] = this.lengthBase
    const lextra: u8[] = this.lengthExtra
    const dsym: u8[] = this.distSymbol
    const dbase: u16[] = this.distBase
    const dextra: u8[] = this.distExtra
    if (
      toI32(lc.length) < 288 ||
      toI32(ll.length) < 288 ||
      toI32(dc.length) < 32 ||
      toI32(dl.length) < 32 ||
      n > toI32(tokens.length) ||
      toI32(lsym.length) < 256 ||
      toI32(lbase.length) < 29 ||
      toI32(lextra.length) < 29 ||
      toI32(dsym.length) < 512 ||
      toI32(dbase.length) < 30 ||
      toI32(dextra.length) < 30
    ) {
      return -1
    }
    // Each token adds at most 15 + 5 bits of length and 15 + 13 of
    // distance, flushing a word after each half, so the count stays under
    // 64; the checks tell the bounds prover so, and fail only on tables the
    // constructor rules out.
    let bb: u64 = this.bitBuf
    let bc: i32 = this.bitCount
    let o: i32 = op
    for (let i: i32 = 0; i < n; i += 1) {
      const c0: i32 = bc
      if (c0 < 0 || c0 > 31) {
        return -1
      }
      const t: i32 = uncheckedGet(tokens, i)
      let c: i32 = c0
      if (t < 256) {
        const a: i32 = uncheckedGet(ll, t)
        if (a < 0 || a > 15) {
          return -1
        }
        bb = bb | (toU64(toU32(uncheckedGet(lc, t))) << toU64(c0))
        c = c0 + a
      } else {
        // The low byte of a match token is its length less 3: bits 0 to 8 hold
        // 253 + length, 256 to 511, so bit 8 is always set.
        const len3: i32 = t & 255
        const dist: i32 = t >> 9
        const s: i32 = toI32(uncheckedGet(lsym, len3))
        const ls: i32 = 257 + s
        const a: i32 = uncheckedGet(ll, ls)
        if (a < 0 || a > 15) {
          return -1
        }
        const x: i32 = toI32(uncheckedGet(lextra, s))
        bb = bb | (toU64(toU32(uncheckedGet(lc, ls))) << toU64(c0))
        const c1: i32 = c0 + a
        bb = bb | (toU64(toU32(len3 + 3 - toI32(uncheckedGet(lbase, s)))) << toU64(c1))
        const c2: i32 = c1 + x
        let c3: i32 = c2
        if (c2 >= 32) {
          if (o >= 0 && o <= toI32(out.length) - 4) {
            uncheckedSet(out, o, toU8(bb))
            uncheckedSet(out, o + 1, toU8(bb >> toU64(8)))
            uncheckedSet(out, o + 2, toU8(bb >> toU64(16)))
            uncheckedSet(out, o + 3, toU8(bb >> toU64(24)))
            o += 4
          } else {
            this.overrun = true
          }
          bb = bb >> toU64(32)
          c3 = c2 - 32
        }
        const d: i32 = toI32(
          dist <= 256 ? uncheckedGet(dsym, dist - 1) : uncheckedGet(dsym, ((dist - 1) >> 7) + 256)
        )
        const da: i32 = uncheckedGet(dl, d)
        if (da < 0 || da > 15) {
          return -1
        }
        const dx: i32 = toI32(uncheckedGet(dextra, d))
        bb = bb | (toU64(toU32(uncheckedGet(dc, d))) << toU64(c3))
        const c4: i32 = c3 + da
        bb = bb | (toU64(toU32(dist - toI32(uncheckedGet(dbase, d)))) << toU64(c4))
        c = c4 + dx
      }
      bc = c
      if (c >= 32) {
        if (o >= 0 && o <= toI32(out.length) - 4) {
          uncheckedSet(out, o, toU8(bb))
          uncheckedSet(out, o + 1, toU8(bb >> toU64(8)))
          uncheckedSet(out, o + 2, toU8(bb >> toU64(16)))
          uncheckedSet(out, o + 3, toU8(bb >> toU64(24)))
          o += 4
        } else {
          this.overrun = true
        }
        bb = bb >> toU64(32)
        bc = c - 32
      }
    }
    this.bitBuf = bb
    this.bitCount = bc
    return this.putBits(out, o, lc[256], ll[256])
  }
}

/**
 * The most bytes `FixedDeflater.compress` writes for `n` bytes of input: nine
 * bits a byte, the block's header and end code, and the eight bytes of slack
 * its word-wide bit writer stores past the last whole byte. A negative `n`
 * answers the bound of 0, and an `n` past 1,908,874,339, the largest whose
 * bound fits, answers -1: its bound would pass 2^31 - 1.
 *
 * @param n The length of the input, in bytes.
 * @returns A size in bytes, not a position: a `room` of this many always
 *   holds the block; or -1 for an `n` past 1,908,874,339.
 */
export const fixedDeflateBound = (n: i32): i32 => {
  if (n < 0) {
    return 16
  }
  if (n > 1908874339) {
    return -1
  }
  return n + (n >> 3) + 16
}

/**
 * A one-block DEFLATE compressor in the fixed Huffman code (BTYPE=01, §3.2.6)
 * for short inputs such as an HTTP response body: one hash probe per position,
 * matches at most 16,384 back, no code to build or send. It carries
 * nothing from one call to the next: the hash table, sized to the input, is
 * cleared at the start of every call, so the output is a function of the
 * input alone. About 70 KB of tables; reuse one per thread.
 */
export class FixedDeflater {
  /** `head[h]`: one past the last position, from the input's start, whose four bytes hash to `h`; 0 for none. */
  private readonly head: i32[]
  /** Per byte: its fixed code, bit-reversed, below bit 16, and the code's length above. */
  private readonly literal: i32[]
  /** Per length - 3: the length symbol's code and then its extra bits, below bit 16, and how many bits above. */
  private readonly length: i32[]
  /** Distance to distance symbol, as `Deflater.distSymbol` maps it. */
  private readonly distSymbol: u8[]
  /** Per distance symbol: its five-bit code, bit-reversed; its base distance; its extra bits. */
  private readonly distCode: i32[]
  private readonly distBase: u16[]
  private readonly distExtra: u8[]

  /** The tables, once. */
  constructor() {
    this.head = new Array<i32>(FIXED_HASH_SIZE)
    this.literal = new Array<i32>(256)
    this.length = new Array<i32>(256)
    this.distSymbol = new Array<u8>(512)
    this.distCode = new Array<i32>(30)
    this.distBase = new Array<u16>(30)
    this.distExtra = new Array<u8>(30)
    const lens: i32[] = new Array<i32>(288)
    for (let s: i32 = 0; s < 288; s += 1) {
      lens[s] = deflateFixedLitLength(s)
    }
    for (let b: i32 = 0; b < 256; b += 1) {
      this.literal[b] = deflateFixedLitCode(b) | (lens[b] << 16)
    }
    for (let s: i32 = 0; s < 29; s += 1) {
      const base: i32 = deflateLengthBase(s)
      const extra: i32 = deflateLengthExtra(s)
      // Symbol 27 stops short of 258, which has symbol 28 to itself.
      let top: i32 = 259
      if (s < 28) {
        const next: i32 = s + 1
        top = deflateLengthBase(next)
      }
      const n: i32 = deflateFixedLitLength(257 + s)
      // The bounds on `base`, `n` and `extra` hold for every symbol; they
      // let the prover see the entry's sums fit.
      for (
        let l: i32 = base;
        l < top &&
        l >= 3 &&
        l <= 258 &&
        base >= 3 &&
        base <= 258 &&
        n >= 0 &&
        n <= 9 &&
        extra >= 0 &&
        extra <= 5;
        l += 1
      ) {
        this.length[l - 3] = deflateFixedLitCode(257 + s) | ((l - base) << n) | ((n + extra) << 16)
      }
    }
    for (let d: i32 = 0; d < 30; d += 1) {
      this.distCode[d] = deflateReverse(d, 5)
      this.distBase[d] = toU16(deflateDistBase(d))
      this.distExtra[d] = toU8(deflateDistExtra(d))
    }
    // Distances 1 to 256 directly; above, by (distance - 1) >> 7 from 256 on.
    for (let d: i32 = 0; d < 30; d += 1) {
      const lo: i32 = toI32(this.distBase[d])
      let hi: i32 = 32769
      if (d < 29) {
        hi = toI32(this.distBase[d + 1])
      }
      for (let dist: i32 = lo; dist < hi && dist >= 1 && dist <= 32768; dist += 1) {
        if (dist <= 256) {
          this.distSymbol[dist - 1] = toU8(d)
        } else {
          const at: i32 = ((dist - 1) >> 7) + 256
          if (at < 512) {
            this.distSymbol[at] = toU8(d)
          }
        }
      }
    }
  }

  /**
   * Compresses `src[off .. off + len)` as one final fixed-Huffman block into
   * `out[at .. at + room)`, and answers where it ends, or `DEFLATE_NO_ROOM` as
   * soon as it would need more than `room` bytes: a caller that only wants
   * the output when it is smaller passes the most it will take, and an input
   * that does not compress is abandoned part way. `fixedDeflateBound(len)`
   * always fits. A window outside its array panics. Answers
   * `DEFLATE_NO_ROOM` too, writing nothing, when a table is not its size,
   * which the constructor rules out. Allocates nothing.
   *
   * @param src The array that holds the data to compress.
   * @param off Where in `src` the data starts.
   * @param len How many bytes of data to compress.
   * @param out The caller's array the block is written into.
   * @param at Where in `out` the block starts.
   * @param room How many bytes of `out` from `at` the block may use; the
   *   window `out[at .. at + room)` must lie inside `out`.
   * @returns The index in `out` one past the block's last byte, so the
   *   stream is `out[at .. result)`; or `DEFLATE_NO_ROOM`, after which the
   *   bytes of `out[at .. at + room)` may have been overwritten and mean
   *   nothing.
   */
  compress(src: u8[], off: i32, len: i32, out: u8[], at: i32, room: i32): i32 {
    deflateWindow("FixedDeflater.compress", src, off, len)
    deflateWindow("FixedDeflater.compress", out, at, room)
    const head: i32[] = this.head
    const literal: i32[] = this.literal
    const length: i32[] = this.length
    const dsym: u8[] = this.distSymbol
    const dcode: i32[] = this.distCode
    const dbase: u16[] = this.distBase
    const dextra: u8[] = this.distExtra
    if (
      toI32(head.length) !== 1 << FIXED_HASH_BITS ||
      toI32(literal.length) !== 256 ||
      toI32(length.length) !== 256 ||
      toI32(dsym.length) !== 512 ||
      toI32(dcode.length) !== 30 ||
      toI32(dbase.length) !== 30 ||
      toI32(dextra.length) !== 30
    ) {
      return DEFLATE_NO_ROOM
    }
    // A table about the input's size: clearing it is most of a short call's
    // fixed cost, and a larger one finds no more matches.
    let bits: i32 = 8
    while (bits < FIXED_HASH_BITS && 1 << bits < len) {
      bits += 1
    }
    head.fill(0, 0, 1 << bits)
    const shift: i32 = 32 - bits
    // `deflateWindow` has checked both windows, so neither end is -1.
    const end: i32 = deflateWindowEnd(src, off, len)
    const outEnd: i32 = deflateWindowEnd(out, at, room)
    if (off < 0 || at < 0 || end < 0 || outEnd < 0) {
      return DEFLATE_NO_ROOM
    }
    // Matches start where eight bytes can be read; the last few are literals.
    const last: i32 = end - 8
    // A flush writes four bytes of the final output, so one that would pass
    // the room's end means the whole cannot fit.
    const oe: i32 = outEnd - 4
    // BFINAL = 1, BTYPE = 01.
    let bb: u64 = toU64(3)
    let bc: i32 = 3
    let o: i32 = at
    let p: i32 = off
    while (p < end) {
      // Each test below fails only on a table this class did not fill: `p`
      // lies in [off, end), `bc` is under 32 between symbols, a code with
      // its extra bits is at most 13 bits, and a match ends by `end`.
      const pc: i32 = p
      const c0: i32 = bc
      if (pc < 0 || pc > 2147483646 || c0 < 0 || c0 > 31) {
        return DEFLATE_NO_ROOM
      }
      let matched: i32 = 0
      let dist: i32 = 0
      if (pc <= last && pc <= 2147483639) {
        const pi: integer<0, 2147483639> = pc
        const w: u64 = deflateLoad64(src, pi)
        const h: i32 = deflateHash(toU32(w), shift)
        // The table holds 0 or `q - off + 1` for an earlier position `q`, so
        // the candidate `pc - dist` lies in [off - 1, pc).
        const seen: i32 = uncheckedGet(head, h)
        const rel: i32 = pc - off
        if (rel < 0) {
          return DEFLATE_NO_ROOM
        }
        uncheckedSet(head, h, rel + 1)
        const dd: i32 = seen < 1 ? 0 : rel + 1 - seen
        if (dd >= 1 && dd <= 16384) {
          dist = dd
          const cand: i32 = pc - dd
          if (cand >= off && cand >= 0 && cand <= 2147483639) {
            const ci: integer<0, 2147483639> = cand
            const x: u64 = deflateLoad64(src, ci) ^ w
            if (toU32(x) === toU32(0)) {
              const left: i32 = end - pc
              const max: i32 = left < DEFLATE_MAX_MATCH ? left : DEFLATE_MAX_MATCH
              if (max < 8 || max > 258) {
                return DEFLATE_NO_ROOM
              }
              if (x !== toU64(0)) {
                matched = deflateCtz64(x) >> 3
              } else {
                const more: i32 = deflateMatchLength(src, cand + 8, pc + 8, max - 8)
                if (more < 0 || more > 250) {
                  return DEFLATE_NO_ROOM
                }
                matched = 8 + more
              }
            }
          }
        }
      }
      let c: i32 = c0
      if (matched === 0) {
        const lc: i32 = uncheckedGet(literal, toI32(uncheckedGet(src, pc)))
        const ln: i32 = lc >> 16
        bb = bb | (toU64(toU32(lc & 0xffff)) << toU64(c0))
        c = c0 + ln
        p = pc + 1
      } else {
        // The first four bytes agree, so a match is at least 4.
        const mt: i32 = matched
        const dv: i32 = dist
        if (mt < 4 || mt > 258 || dv < 1 || dv > 16384) {
          return DEFLATE_NO_ROOM
        }
        const lc: i32 = uncheckedGet(length, mt - 3)
        const ln: i32 = lc >> 16
        const d1: i32 = dv - 1
        const d: i32 = toI32(dv <= 256 ? uncheckedGet(dsym, d1) : uncheckedGet(dsym, (d1 >> 7) + 256))
        const dn: i32 = toI32(uncheckedGet(dextra, d))
        bb = bb | (toU64(toU32(lc & 0xffff)) << toU64(c0))
        const c1: i32 = c0 + ln
        bb = bb | (toU64(toU32(uncheckedGet(dcode, d))) << toU64(c1))
        const c2: i32 = c1 + 5
        bb = bb | (toU64(toU32(dv - toI32(uncheckedGet(dbase, d)))) << toU64(c2))
        c = c2 + dn
        // One position near the match's end goes into the table, for the
        // next repeat of what follows it; the rest are skipped.
        const rest: i32 = end - pc
        const gap: i32 = rest < 0 ? -1 : rest - mt
        if (gap < 0) {
          return DEFLATE_NO_ROOM
        }
        const next: i32 = end - gap
        if (next < 2) {
          return DEFLATE_NO_ROOM
        }
        const q: i32 = next - 2
        if (q >= off && q <= last && q <= 2147483639) {
          const qi: integer<0, 2147483639> = q
          const hq: i32 = deflateHash(deflateLoad32(src, qi), shift)
          uncheckedSet(head, hq, q - off + 1)
        }
        p = next
      }
      // At most 31 + 13 + 5 + 13 = 62 bits are pending, so one flush leaves
      // fewer than 32.
      const ct: i32 = c
      bc = ct
      if (ct >= 32) {
        const oc: i32 = o
        if (oc < 0 || oc > 2147483643 || oc > oe) {
          return DEFLATE_NO_ROOM
        }
        uncheckedSet(out, oc, toU8(bb))
        uncheckedSet(out, oc + 1, toU8(bb >> toU64(8)))
        uncheckedSet(out, oc + 2, toU8(bb >> toU64(16)))
        uncheckedSet(out, oc + 3, toU8(bb >> toU64(24)))
        bb = bb >> toU64(32)
        bc = ct - 32
        o = oc + 4
      }
    }
    // The end-of-block code, 256: seven zero bits.
    const cf: i32 = bc
    const of: i32 = o
    if (cf < 0 || cf > 31 || of < 0) {
      return DEFLATE_NO_ROOM
    }
    const bytes: i32 = (cf + 14) >> 3
    const g: i32 = outEnd - of
    const after: i32 = g < 0 ? -1 : g - bytes
    if (after < 0) {
      return DEFLATE_NO_ROOM
    }
    // `fin` is `of + bytes`; the bytes are written from the last back.
    const fin: i32 = outEnd - after
    if (fin < 0) {
      return DEFLATE_NO_ROOM
    }
    for (let i: i32 = 0; i < bytes; i += 1) {
      uncheckedSet(out, fin - 1 - i, toU8(bb >> toU64(toI32(8) * (bytes - 1 - i))))
    }
    return fin
  }
}

/**
 * One Huffman decoding table: the entries for every `bits`-bit prefix, and
 * for the codes longer than that, the count per length and the symbols in
 * canonical order that a bit-at-a-time decode walks (§3.2.2).
 */
export class InflateTable {
  /**
   * @internal Used by `Inflater`.
   * `entries[peek]`: value << 16 | extra << 11 | kind << 8 | length. The low
   * byte is the length alone, so a bit buffer shifts by an entry as it is.
   */
  readonly entries: i32[]
  /** @internal Used by `Inflater`. The prefix the table indexes. */
  readonly bits: i32
  /** @internal Used by `Inflater`. How many codes have each length 0 to 15. */
  readonly count: i32[]
  /** @internal Used by `Inflater`. The symbols, ordered by code. */
  readonly symbols: i32[]

  /**
   * A table indexing `bits` bits, for an alphabet of up to `symbols`
   * symbols, with room for `capacity` entries: the main table and its
   * subtables. The arrays are allocated here and filled by `Inflater`.
   *
   * @param bits How many bits of the next code the main table indexes at
   *   once; a longer code goes through a subtable.
   * @param symbols The size of the alphabet the table decodes, such as 288
   *   for literal/length codes or 32 for distances. Only its low 16 bits are
   *   read.
   * @param capacity How many entries to allocate for the main table and
   *   all its subtables; `Inflater` passes zlib's `enough` figures. Only its
   *   low 16 bits are read.
   */
  constructor(bits: i32, symbols: i32, capacity: i32) {
    this.bits = bits
    // Every figure `Inflater` passes is under 65536, so `toU16` keeps every
    // bit; a u16 length can never be negative, so it needs no check.
    this.entries = new Array<i32>(toU16(capacity))
    this.count = new Array<i32>(16)
    this.symbols = new Array<i32>(toU16(symbols))
  }
}

/**
 * Copies `entries[0 .. end)` to `entries[end .. 2 * end)`: a table for codes
 * one bit longer, each shorter code repeated under both values of the new
 * bit. Answers false, copying nothing, unless `2 * end` is within the table.
 */
const inflateDouble = (entries: i32[], end: i32): boolean => {
  if (end < 0) {
    return false
  }
  // `2 * end` as `n - ((n - end) - end)`: each step subtracts one value at
  // least zero from another, so the bounds prover proves all three, and the
  // middle one is negative exactly when `2 * end` is past the table.
  const n: i32 = toI32(entries.length)
  const room: i32 = n - end
  if (room < 0) {
    return false
  }
  const gap: i32 = room - end
  if (gap < 0) {
    return false
  }
  // A counter below a bound needs no overflow check, and the loop without
  // one is a vector copy.
  const twice: i32 = n - gap
  for (let j: i32 = end; j < twice; j += 1) {
    uncheckedSet(entries, j, uncheckedGet(entries, j - end))
  }
  return true
}

/** The kind of table `inflateBuild` builds: what each symbol decodes to. */
const INF_TABLE_LITLEN: i32 = 0
const INF_TABLE_DIST: i32 = 1
const INF_TABLE_CODELEN: i32 = 2

/**
 * A DEFLATE decompressor: the decoding tables, the fixed code's, and the state
 * that lets `inflate` stop at the end of its input or output and resume.
 * Not shared between threads.
 */
export class Inflater {
  private readonly lit: InflateTable
  private readonly dist: InflateTable
  private readonly codeLengths: InflateTable
  private readonly fixedLit: InflateTable
  private readonly fixedDist: InflateTable
  /** The lengths a dynamic header sends, literal/length then distance. */
  private readonly lens: i32[]
  /** The order-indexed code-length code lengths. */
  private readonly clLens: i32[]
  /** Scratch for building a table. */
  private readonly offsets: i32[]
  /** Each symbol's table entry with a length of 0, per kind of table: `entryOf(kind, s, 0)`. */
  private readonly litEntries: i32[]
  private readonly distEntries: i32[]
  private readonly clEntries: i32[]
  private readonly lengthBase: i32[]
  private readonly lengthExtra: i32[]
  private readonly distBase: i32[]
  private readonly distExtra: i32[]
  /** Where `inflate` resumes: the block header, a stored block, a Huffman block, or done. */
  private state: i32
  /** Whether the block being read is the final one. */
  private last: boolean
  /** Whether the Huffman block uses the fixed code. */
  private fixed: boolean
  /**
   * What building the fixed code answered: 0, or the error a fixed block
   * then answers, which the fixed lengths rule out.
   */
  private fixedStatus: i32
  /** Bytes of the current stored block still to copy. */
  private storedLeft: i32
  /** Bits read but not consumed, low bit first, and how many. */
  private bitBuf: u64
  private bitCount: i32
  /**
   * Where the last `inflate` stopped in its input: the first byte it did not
   * use, or after `INFLATE_DONE` the first byte after the final block.
   */
  inPos: i32
  /** Where the last `inflate` stopped in its output: one past the last byte it wrote. */
  outPos: i32
  /** The input bytes the last `decompress` read, its final block included. */
  consumed: i32

  /** Builds the tables, the fixed code's among them. */
  constructor() {
    this.lit = new InflateTable(INF_LIT_BITS, 288, INF_LIT_ENOUGH)
    this.dist = new InflateTable(INF_DIST_BITS, 32, INF_DIST_ENOUGH)
    this.codeLengths = new InflateTable(INF_CL_BITS, 19, 1 << INF_CL_BITS)
    this.fixedLit = new InflateTable(INF_LIT_BITS, 288, INF_LIT_ENOUGH)
    this.fixedDist = new InflateTable(INF_DIST_BITS, 32, INF_DIST_ENOUGH)
    this.lens = new Array<i32>(320)
    this.clLens = new Array<i32>(19)
    this.offsets = new Array<i32>(16)
    this.lengthBase = new Array<i32>(29)
    this.lengthExtra = new Array<i32>(29)
    this.distBase = new Array<i32>(32)
    this.distExtra = new Array<i32>(32)
    for (let s: i32 = 0; s < 29; s += 1) {
      this.lengthBase[s] = deflateLengthBase(s)
      this.lengthExtra[s] = deflateLengthExtra(s)
    }
    for (let d: i32 = 0; d < 30; d += 1) {
      this.distBase[d] = deflateDistBase(d)
      this.distExtra[d] = deflateDistExtra(d)
    }
    this.litEntries = new Array<i32>(288)
    this.distEntries = new Array<i32>(32)
    this.clEntries = new Array<i32>(19)
    this.state = INF_S_BLOCK
    this.last = false
    this.fixed = false
    this.storedLeft = 0
    this.bitBuf = 0
    this.bitCount = 0
    this.inPos = 0
    this.outPos = 0
    this.consumed = 0
    this.fixedStatus = 0
    for (let s: i32 = 0; s < 288; s += 1) {
      this.litEntries[s] = this.entryOf(INF_TABLE_LITLEN, s, toI32(0))
    }
    for (let s: i32 = 0; s < 32; s += 1) {
      this.distEntries[s] = this.entryOf(INF_TABLE_DIST, s, toI32(0))
    }
    for (let s: i32 = 0; s < 19; s += 1) {
      this.clEntries[s] = this.entryOf(INF_TABLE_CODELEN, s, toI32(0))
    }
    for (let s: i32 = 0; s < 288; s += 1) {
      this.lens[s] = deflateFixedLitLength(s)
    }
    // The fixed distance code has 32 five-bit codes, 30 and 31 among them,
    // which decode as errors (§3.2.6).
    const fl: i32 = this.build(this.fixedLit, this.lens, toI32(0), toI32(288), INF_TABLE_LITLEN)
    for (let d: i32 = 0; d < 32; d += 1) {
      this.lens[d] = 5
    }
    const fd: i32 = this.build(this.fixedDist, this.lens, toI32(0), toI32(32), INF_TABLE_DIST)
    this.fixedStatus = fl !== 0 ? fl : fd
  }

  /**
   * Starts a new stream: the next `inflate` reads a first block header and
   * whatever the last stream left in the bit buffer is dropped. A new
   * `Inflater` is already at the start, and `decompress` resets itself;
   * call this before reusing one for another stream through `inflate`.
   */
  reset(): void {
    this.state = INF_S_BLOCK
    this.last = false
    this.fixed = false
    this.storedLeft = 0
    this.bitBuf = 0
    this.bitCount = 0
  }

  /**
   * The table entry for symbol `s` of a table of `kind`: an invalid entry,
   * which fails the stream when it is read, for a symbol past the alphabet
   * or a base table not its size, which the constructor rules out.
   */
  private entryOf(kind: i32, s: i32, len: i32): i32 {
    if (kind === INF_TABLE_CODELEN) {
      return (s << 16) | len
    }
    const db: i32[] = this.distBase
    const dx: i32[] = this.distExtra
    const lb: i32[] = this.lengthBase
    const lx: i32[] = this.lengthExtra
    if (
      s < 0 ||
      toI32(db.length) < 30 ||
      toI32(dx.length) < 30 ||
      toI32(lb.length) < 29 ||
      toI32(lx.length) < 29
    ) {
      return (INF_INVALID << 8) | len
    }
    if (kind === INF_TABLE_DIST) {
      if (s >= 30) {
        return (INF_INVALID << 8) | len
      }
      return (db[s] << 16) | (dx[s] << 11) | len
    }
    if (s < 256) {
      return (s << 16) | (INF_LITERAL << 8) | len
    }
    // `s` is 256 here exactly when it is at most 256.
    if (s <= 256) {
      return (INF_END << 8) | len
    }
    if (s >= 286) {
      return (INF_INVALID << 8) | len
    }
    return (lb[s - 257] << 16) | (INF_LENGTH << 8) | (lx[s - 257] << 11) | len
  }

  /**
   * Builds `t` from the code lengths `lens[from .. from + n)`; answers 0, or
   * `DEFLATE_ERR_HUFFMAN` for an over-subscribed set or an incomplete one
   * (an incomplete set of a single one-bit code is allowed, as RFC 1951
   * §3.2.7 allows one distance code). Answers `DEFLATE_ERR_HUFFMAN` too,
   * the table then unusable, when `lens[from .. from + n)` is outside `lens`
   * or a table is not its size, which the callers and `InflateTable` rule
   * out.
   */
  private build(t: InflateTable, lens: i32[], from: i32, n: i32, kind: i32): i32 {
    const count: i32[] = t.count
    const syms: i32[] = t.symbols
    const entries: i32[] = t.entries
    const offs: i32[] = this.offsets
    const bits: i32 = t.bits
    if (
      bits < 1 ||
      bits > 15 ||
      from < 0 ||
      n < 0 ||
      n > 288 ||
      n > toI32(syms.length) ||
      toI32(count.length) < 16 ||
      toI32(offs.length) < 16 ||
      toI32(entries.length) < 1 << bits
    ) {
      return DEFLATE_ERR_HUFFMAN
    }
    // `from + n` as `lens.length - ((lens.length - from) - n)`: each step
    // subtracts a value at least zero, so the bounds prover proves all
    // three, and the middle one is negative exactly when the run is past
    // `lens`.
    const room: i32 = toI32(lens.length) - from
    if (room < 0) {
      return DEFLATE_ERR_HUFFMAN
    }
    const gap: i32 = room - n
    if (gap < 0) {
      return DEFLATE_ERR_HUFFMAN
    }
    const hi: i32 = toI32(lens.length) - gap
    for (let l: i32 = 0; l < 16; l += 1) {
      count[l] = 0
    }
    // A count is at most the `n` lengths seen, and `n` at most 288, the
    // literal/length alphabet. The bounds prover reads a decimal literal in a
    // guard, not a named constant or a hex one.
    for (let i: i32 = from; i < hi; i += 1) {
      const l: i32 = uncheckedGet(lens, i)
      if (l < 0 || l > 15) {
        return DEFLATE_ERR_HUFFMAN
      }
      const c: i32 = count[l]
      if (c < 0 || c >= 288) {
        return DEFLATE_ERR_HUFFMAN
      }
      count[l] = c + 1
    }
    const unused: i32 = count[0]
    if (unused < 0 || unused > n) {
      return DEFLATE_ERR_HUFFMAN
    }
    const codes: i32 = n - unused
    count[0] = 0
    // The Kraft sum: over-subscribed is an error; incomplete is allowed for
    // one one-bit code only. `left` is the codes still free at length `l`,
    // at most 2^(l - 1) before the step, and a count at most `n`.
    let left: i32 = 1
    for (let l: i32 = 1; l < 16; l += 1) {
      const c: i32 = count[l]
      const free: i32 = left
      if (free < 0 || free > 16384) {
        return DEFLATE_ERR_HUFFMAN
      }
      if (c < 0 || c > 288) {
        return DEFLATE_ERR_HUFFMAN
      }
      left = free * 2 - c
    }
    if (left < 0) {
      return DEFLATE_ERR_HUFFMAN
    }
    if (left > 0 && codes !== 0 && !(kind !== INF_TABLE_CODELEN && codes === 1 && count[1] === 1)) {
      return DEFLATE_ERR_HUFFMAN
    }
    // Sorted by length, then symbol, with no branch per symbol: the unused
    // symbols (length 0) go after the rest, where nothing reads them.
    // The running sum is at most `codes`, checked as it grows.
    let acc: i32 = 0
    for (let l: i32 = 1; l < 16; l += 1) {
      const c: i32 = count[l]
      const sum: i32 = acc
      if (sum < 0 || sum > 288) {
        return DEFLATE_ERR_HUFFMAN
      }
      if (c < 0 || c > 288) {
        return DEFLATE_ERR_HUFFMAN
      }
      offs[l] = sum
      acc = sum + c
    }
    offs[0] = codes
    for (let i: i32 = from; i < hi; i += 1) {
      const l: i32 = uncheckedGet(lens, i)
      if (l < 0 || l > 15) {
        return DEFLATE_ERR_HUFFMAN
      }
      const at: i32 = offs[l]
      if (at < 0 || at >= toI32(syms.length)) {
        return DEFLATE_ERR_HUFFMAN
      }
      syms[at] = i - from
      offs[l] = at + 1
    }
    // `bits` is 1 to 15, so `size` is 2 to 2^15; the guard tells the bounds
    // prover so, which does not range a shift.
    const size: i32 = 1 << bits
    if (size < 2 || size > 32768) {
      return DEFLATE_ERR_HUFFMAN
    }
    const slow: i32 = INF_SLOW << 8
    let tmpl: i32[] = this.clEntries
    if (kind === INF_TABLE_LITLEN) {
      tmpl = this.litEntries
    } else if (kind === INF_TABLE_DIST) {
      tmpl = this.distEntries
    }
    let len: i32 = 1
    while (len < 16 && count[len] === 0) {
      len += 1
    }
    if (left > 0 || len > bits) {
      // No code, one incomplete one-bit code, or every code longer than the
      // table: every prefix starts as the slow way, which also finds an
      // undefined code, and the short codes are written over it.
      for (let i: i32 = 0; i < size; i += 1) {
        uncheckedSet(entries, i, slow)
      }
      let code: i32 = 0
      let k: i32 = 0
      for (let l: i32 = 1; l <= bits && l < 16; l += 1) {
        const codesHere: i32 = uncheckedGet(count, l)
        const step: i32 = 1 << l
        if (step < 2 || step > 32768) {
          return DEFLATE_ERR_HUFFMAN
        }
        for (let c: i32 = 0; c < codesHere; c += 1) {
          // `k` is under `codes`, and `code` under 2^l: the set is not
          // over-subscribed, checked above.
          const at: i32 = k
          const cur: i32 = code
          if (at < 0 || at >= toI32(syms.length) || cur < 0 || cur > 32767) {
            return DEFLATE_ERR_HUFFMAN
          }
          const s: i32 = syms[at]
          if (s < 0 || s >= toI32(tmpl.length)) {
            return DEFLATE_ERR_HUFFMAN
          }
          const e: i32 = tmpl[s] | l
          for (let r: i32 = deflateReverse(cur, l); r < size; r += step) {
            uncheckedSet(entries, r, e)
          }
          k = at + 1
          code = cur + 1
        }
        code = code << 1
      }
      return 0
    }
    // A complete code whose shortest codes fit the table. The codes in
    // canonical order, kept bit-reversed (the table is indexed by the
    // stream's low bits first): each is written once into a table of
    // `end = 2^len` entries, and the table is doubled by copying each time
    // the length grows, which repeats every code at every slot it prefixes.
    // A reversed code is incremented by clearing the ones below its highest
    // zero and setting that zero.
    let code: i32 = 0
    let end: i32 = 1 << len
    let k: i32 = 0
    let here: i32 = 0
    while (len <= bits && len >= 0 && len < toI32(count.length)) {
      here = count[len]
      while (here > 0) {
        if (k < 0 || k >= toI32(syms.length) || code < 0 || code >= end || end < 1 || end > size) {
          return DEFLATE_ERR_HUFFMAN
        }
        const s: i32 = syms[k]
        if (s < 0 || s >= toI32(tmpl.length)) {
          return DEFLATE_ERR_HUFFMAN
        }
        uncheckedSet(entries, code, tmpl[s] | len)
        k += 1
        if (code === end - 1) {
          // The last code, all ones: the code is complete within the table.
          while (end < size) {
            if (!inflateDouble(entries, end)) {
              return DEFLATE_ERR_HUFFMAN
            }
            end = end << 1
          }
          return 0
        }
        // `code` differs from `end - 1`, so the count of leading zeros is
        // under 32 and the shift inside the width.
        const top: i32 = toI32(31) - Math.clz32(toU32(code ^ (end - 1)))
        if (top < 0 || top > 14) {
          return DEFLATE_ERR_HUFFMAN
        }
        code = (code & ~(-1 << top)) | (1 << top)
        here -= 1
      }
      len += 1
      while (len < 16 && count[len] === 0) {
        len += 1
      }
      while (end < size && end < 1 << len) {
        if (!inflateDouble(entries, end)) {
          return DEFLATE_ERR_HUFFMAN
        }
        end = end << 1
      }
    }
    here = len < 16 ? count[len] : 0
    // Codes longer than the table remain, `here` of them of length `len`,
    // and `code` is the next, reversed, its low `bits` bits a slot of the
    // main table. The codes that share a slot get a subtable after the
    // tables already built, as wide as it takes for them to fill it (the
    // code is complete, so they do), and the slot points to it. A subtable
    // entry carries the bits past the main table's as its length.
    // A subtable's start is packed into an entry's top bits, so a table and
    // its subtables fit 2^15 entries.
    const limit: i32 = toI32(entries.length)
    if (limit > 32767) {
      return DEFLATE_ERR_HUFFMAN
    }
    let prefix: i32 = -1
    let start: i32 = 0
    let subEnd: i32 = size
    while (true) {
      if (len < bits || len < 1 || len > 15) {
        return DEFLATE_ERR_HUFFMAN
      }
      if ((code & (size - 1)) !== prefix) {
        prefix = code & (size - 1)
        let subBits: i32 = len - bits
        let used: i32 = here
        // `used` is under 2^subBits, at most 2^13, when it doubles, and
        // `bits + subBits` at most 15 after the step.
        while (subBits < 14 && bits + subBits < 15 && used < 1 << subBits) {
          const wider: i32 = subBits
          const twice: i32 = used
          if (wider < 0 || wider > 13 || twice < 0 || twice > 8191) {
            return DEFLATE_ERR_HUFFMAN
          }
          subBits = wider + 1
          const at: i32 = bits + subBits
          if (at > 15) {
            return DEFLATE_ERR_HUFFMAN
          }
          const c: i32 = count[at]
          if (c < 0 || c > 288) {
            return DEFLATE_ERR_HUFFMAN
          }
          used = twice * 2 + c
        }
        // The subtable goes after the last one, and must fit the table.
        const base: i32 = subEnd
        const width: i32 = 1 << subBits
        if (base < 0 || base > 32767 || width < 1 || width > 16384 || prefix < 0) {
          return DEFLATE_ERR_HUFFMAN
        }
        const next: i32 = base + width
        if (next > limit) {
          return DEFLATE_ERR_HUFFMAN
        }
        start = base
        subEnd = next
        uncheckedSet(entries, prefix, (base << 16) | (INF_SUB << 8) | (subBits << 11) | bits)
      }
      if (k < 0 || k >= toI32(syms.length)) {
        return DEFLATE_ERR_HUFFMAN
      }
      const s: i32 = syms[k]
      if (s < 0 || s >= toI32(tmpl.length)) {
        return DEFLATE_ERR_HUFFMAN
      }
      const e: i32 = tmpl[s] | (len - bits)
      k += 1
      // The code past the main table's bits is under 2^14, as is the
      // stride, and the subtable ends within the table's 2^15 entries.
      const first: i32 = start
      const stop: i32 = subEnd
      const high: i32 = code >> bits
      const stride: i32 = toI32(1) << (len - bits)
      if (
        first < 0 ||
        first > 32767 ||
        stop > 32767 ||
        high < 0 ||
        high > 16383 ||
        stride < 1 ||
        stride > 16384
      ) {
        return DEFLATE_ERR_HUFFMAN
      }
      for (let i: i32 = first + high; i < stop; i += stride) {
        uncheckedSet(entries, i, e)
      }
      const top: i32 = 1 << len
      if (top < 2 || top > 32768) {
        return DEFLATE_ERR_HUFFMAN
      }
      const full: i32 = top - 1
      if (code === full) {
        return 0
      }
      // As above: `code` is not `full`, so the leading zeros are under 32.
      const lead: i32 = toI32(31) - Math.clz32(toU32(code ^ full))
      if (lead < 0 || lead > 14) {
        return DEFLATE_ERR_HUFFMAN
      }
      code = (code & ~(-1 << lead)) | (1 << lead)
      // At least one code of this length remains, and at most `n`: the code
      // is complete, so the last code, `full`, comes before the count runs
      // out.
      const remain: i32 = here
      if (remain < 1 || remain > 288) {
        return DEFLATE_ERR_HUFFMAN
      }
      here = remain - 1
      while (here === 0 && len < 15) {
        const next: i32 = len + 1
        if (next < 0 || next >= toI32(count.length)) {
          return DEFLATE_ERR_HUFFMAN
        }
        len = next
        here = count[next]
      }
    }
  }

  /**
   * Decodes the symbol at the bottom of `bb`, holding `bc` valid bits, one
   * bit at a time from the counts (§3.2.2): answers the table entry of the
   * symbol with its true code length, or -1 when the bits run out before a
   * code ends (`bc` too small), or -2 when no code matches.
   */
  private slowDecode(t: InflateTable, kind: i32, bb: u64, bc: i32): i32 {
    const count: i32[] = t.count
    const syms: i32[] = t.symbols
    let code: i32 = 0
    let first: i32 = 0
    let index: i32 = 0
    let b: u64 = bb
    // A built table has at most 288 symbols and no code past 15 bits, so a
    // count and `index` are at most 288 and `code` and `first` under 2^16:
    // a value past those is a table `build` did not make, and no code
    // matches.
    for (let l: i32 = 1; l < 16 && l < toI32(count.length); l += 1) {
      if (l > bc) {
        return -1
      }
      const cur: i32 = code | toI32(b & toU64(1))
      b = b >> toU64(1)
      const c: i32 = count[l]
      const base: i32 = first
      const seen: i32 = index
      if (c < 0 || c > 288 || cur < 0 || cur > 65535 || base < 0 || base > 65535 || seen < 0 || seen > 288) {
        return -2
      }
      if (cur - c < base) {
        const at: i32 = seen + (cur - base)
        if (at < 0 || at >= toI32(syms.length)) {
          return -2
        }
        return this.entryOf(kind, syms[at], l)
      }
      index = seen + c
      first = (base + c) * 2
      code = cur * 2
    }
    return -2
  }

  /**
   * Reads bytes of `src` into the bit buffer from `inPos` while it has room
   * and `end` allows. Answers false, reading nothing, when `inPos` is
   * negative, `end` past `src` or the bit count outside 0 to 63, which
   * `inflate` rules out.
   */
  private fill(src: u8[], end: i32): boolean {
    let bb: u64 = this.bitBuf
    let bc: i32 = this.bitCount
    let ip: i32 = this.inPos
    // The buffer holds under 64 bits.
    if (bc < 0 || bc > 63 || ip < 0 || end > toI32(src.length)) {
      return false
    }
    // `ip < end - 7` keeps `ip` at most 2^31 - 9: the third test never
    // fails, and tells the bounds prover so.
    if (end >= 8 && ip < end - 7 && ip <= 2147483639) {
      // A word at once, whole bytes of it counted, as the fast loop does.
      const at: integer<0, 2147483639> = ip
      bb = bb | (deflateLoad64(src, at) << toU64(bc))
      ip += (63 - bc) >> 3
      bc = bc | 56
    } else {
      while (bc <= 56 && ip < end) {
        bb = bb | (toU64(uncheckedGet(src, ip)) << toU64(bc))
        ip += 1
        bc += 8
      }
    }
    this.bitBuf = bb
    this.bitCount = bc
    this.inPos = ip
    return true
  }

  /**
   * Gives back the whole bytes of the bit buffer to the input, keeping the
   * bits short of a byte. Answers false, changing nothing, when the bit
   * count is outside 0 to 63 or the bytes would take `inPos` below zero:
   * the buffer only holds bytes read from before `inPos`, so neither
   * happens.
   */
  private giveBack(): boolean {
    const bc: i32 = this.bitCount
    const ip: i32 = this.inPos
    if (bc < 0 || bc > 63 || ip < 0) {
      return false
    }
    const back: i32 = ip - (bc >> 3)
    if (back < 0) {
      return false
    }
    this.inPos = back
    this.bitCount = bc & 7
    this.bitBuf = this.bitBuf & ((toU64(1) << toU64(this.bitCount)) - toU64(1))
    return true
  }

  /**
   * Gives back the whole bytes of the bit buffer to the input, after dropping
   * the bits to the next byte boundary: where a stored block's `LEN`, or the
   * framing after the final block, begins. Answers false as `giveBack` does.
   */
  private unread(): boolean {
    if (!this.giveBack()) {
      return false
    }
    this.bitBuf = 0
    this.bitCount = 0
    return true
  }

  /**
   * Reads a dynamic block's header (§3.2.7) from the bit buffer and `src`,
   * and builds its tables. Answers 0, `INFLATE_NEED_INPUT` when the input ran
   * out first (nothing is consumed then: the caller rewinds), or an error:
   * `DEFLATE_ERR_TRUNCATED` too when `inPos` is negative, `end` past `src`
   * or the bit count outside 0 to 63, and `DEFLATE_ERR_HUFFMAN` when the code-length table is not its
   * size, which `inflate` and the constructor rule out.
   */
  private readDynamic(src: u8[], end: i32): i32 {
    // The bit buffer in locals: the lengths are stored into an `i32[]`,
    // which the fields could alias, and every symbol would reload them.
    let bb: u64 = this.bitBuf
    let bc: i32 = this.bitCount
    let ip: i32 = this.inPos
    // The buffer holds under 64 bits.
    if (bc < 0 || bc > 63 || ip < 0 || end > toI32(src.length)) {
      return DEFLATE_ERR_TRUNCATED
    }
    if (end >= 8 && ip < end - 7 && ip <= 2147483639) {
      const at: integer<0, 2147483639> = ip
      bb = bb | (deflateLoad64(src, at) << toU64(bc))
      ip += (63 - bc) >> 3
      bc = bc | 56
    } else {
      while (bc <= 56 && ip < end) {
        bb = bb | (toU64(uncheckedGet(src, ip)) << toU64(bc))
        ip += 1
        bc += 8
      }
    }
    if (bc < 14) {
      return INFLATE_NEED_INPUT
    }
    const hlit: i32 = toI32(bb & toU64(31)) + 257
    const hdist: i32 = toI32((bb >> toU64(5)) & toU64(31)) + 1
    const hclen: i32 = toI32((bb >> toU64(10)) & toU64(15)) + 4
    bb = bb >> toU64(14)
    bc -= 14
    if (hlit > 286 || hdist > 30) {
      return DEFLATE_ERR_HUFFMAN
    }
    const cl: i32[] = this.clLens
    if (toI32(cl.length) < 19) {
      return DEFLATE_ERR_HUFFMAN
    }
    for (let i: i32 = 0; i < 19; i += 1) {
      const k: i32 = deflateClOrder(i)
      if (k < 0 || k >= 19) {
        return DEFLATE_ERR_HUFFMAN
      }
      cl[k] = 0
    }
    for (let i: i32 = 0; i < hclen; i += 1) {
      // Under 64 bits, as above.
      if (bc < 0 || bc > 63) {
        return DEFLATE_ERR_TRUNCATED
      }
      if (bc < 3) {
        if (ip >= 0 && end >= 8 && ip < end - 7 && ip <= 2147483639) {
          const at: integer<0, 2147483639> = ip
          bb = bb | (deflateLoad64(src, at) << toU64(bc))
          ip += (63 - bc) >> 3
          bc = bc | 56
        } else {
          while (bc <= 56 && ip < end) {
            bb = bb | (toU64(uncheckedGet(src, ip)) << toU64(bc))
            ip += 1
            bc += 8
          }
        }
        if (bc < 3) {
          return INFLATE_NEED_INPUT
        }
      }
      const k: i32 = deflateClOrder(i)
      if (k < 0 || k >= 19) {
        return DEFLATE_ERR_HUFFMAN
      }
      cl[k] = toI32(bb & toU64(7))
      bb = bb >> toU64(3)
      bc -= 3
    }
    const r: i32 = this.build(this.codeLengths, cl, toI32(0), toI32(19), INF_TABLE_CODELEN)
    if (r !== 0) {
      return r
    }
    const lens: i32[] = this.lens
    const entries: i32[] = this.codeLengths.entries
    if (toI32(entries.length) < 128) {
      return DEFLATE_ERR_HUFFMAN
    }
    const total: i32 = hlit + hdist
    let i: i32 = 0
    while (i < total) {
      // Under 64 bits, as above.
      if (bc < 0 || bc > 63) {
        return DEFLATE_ERR_TRUNCATED
      }
      // A code-length code is at most 7 bits and its repeat count at most 7.
      if (bc < 14) {
        if (ip >= 0 && end >= 8 && ip < end - 7 && ip <= 2147483639) {
          const at: integer<0, 2147483639> = ip
          bb = bb | (deflateLoad64(src, at) << toU64(bc))
          ip += (63 - bc) >> 3
          // `bc | 56`, as a sum the bounds prover follows.
          bc = toI32(56) + (bc & 7)
        } else {
          while (bc <= 56 && ip < end) {
            bb = bb | (toU64(uncheckedGet(src, ip)) << toU64(bc))
            ip += 1
            bc += 8
          }
        }
      }
      const e: i32 = uncheckedGet(entries, toI32(bb & toU64(127)))
      if (((e >> 8) & 7) === INF_SLOW) {
        // Only an incomplete code-length code leaves a prefix unfilled.
        return bc >= 7 ? DEFLATE_ERR_SYMBOL : INFLATE_NEED_INPUT
      }
      const l: i32 = e & 15
      if (l > bc) {
        return INFLATE_NEED_INPUT
      }
      bb = bb >> toU64(l)
      bc -= l
      const sym: i32 = e >> 16
      if (sym < 16) {
        if (i < 0 || i >= toI32(lens.length)) {
          return DEFLATE_ERR_HUFFMAN
        }
        lens[i] = sym
        i += 1
      } else {
        let rep: i32 = 0
        let value: i32 = 0
        let x: i32 = 0
        if (sym === 16) {
          if (i <= 0 || i > toI32(lens.length)) {
            return DEFLATE_ERR_HUFFMAN
          }
          value = lens[i - 1]
          x = 2
          rep = 3
        } else if (sym === 17) {
          x = 3
          rep = 3
        } else {
          x = 7
          rep = 11
        }
        if (bc < x) {
          return INFLATE_NEED_INPUT
        }
        // At most 7 bits.
        const more: i32 = toI32(bb & ((toU64(1) << toU64(x)) - toU64(1)))
        if (more < 0 || more > 127) {
          return DEFLATE_ERR_HUFFMAN
        }
        rep += more
        bb = bb >> toU64(x)
        const have: i32 = bc
        if (have < 0 || have > 64) {
          return DEFLATE_ERR_HUFFMAN
        }
        bc = have - x
        if (i < 0 || rep > total - i) {
          return DEFLATE_ERR_HUFFMAN
        }
        // `total` is at most 286 + 30, under `lens.length`'s 320: the second
        // test never stops the loop.
        for (let k: i32 = 0; k < rep && i < toI32(lens.length); k += 1) {
          lens[i] = value
          i += 1
        }
      }
    }
    if (toI32(lens.length) <= 256 || lens[256] === 0) {
      return DEFLATE_ERR_HUFFMAN
    }
    const rl: i32 = this.build(this.lit, lens, toI32(0), hlit, INF_TABLE_LITLEN)
    if (rl !== 0) {
      return rl
    }
    const rd: i32 = this.build(this.dist, lens, hlit, hdist, INF_TABLE_DIST)
    if (rd !== 0) {
      return rd
    }
    this.bitBuf = bb
    this.bitCount = bc
    this.inPos = ip
    return 0
  }

  /**
   * Decodes from `src[ip .. inEnd)` into `out[op .. outEnd)`, resuming where
   * the last call stopped: the resumable step under `decompress`, for a
   * stream that arrives in pieces or an output buffer that is drained
   * between calls. `GzipDecompressor`, `GzipReader` and `ZlibDecompressor`
   * are built on it. `inPos` and `outPos` say where it stopped. Windows
   * outside their arrays panic. Allocates nothing.
   *
   * @param src The array that holds the compressed input.
   * @param ip Where in `src` this call's input starts; the bytes before it
   *   that an earlier call read ahead are in the bit buffer, not re-read.
   * @param inEnd One past this call's last input byte.
   * @param more Whether input may follow `inEnd`: with it, running out is
   *   `INFLATE_NEED_INPUT` (every byte up to `inPos` is used, and the bit
   *   buffer keeps what it read ahead), without it `DEFLATE_ERR_TRUNCATED`.
   * @param out The array the decoded bytes are written into.
   * @param op Where in `out` this call writes first.
   * @param outEnd One past the last byte of `out` this call may write.
   * @param histStart The earliest byte of `out` a match may copy from; the
   *   bytes from it to `op` must be the stream's earlier output, up to the
   *   32 KB window.
   * @returns `INFLATE_DONE` once the final block has ended, with `inPos` the
   *   first byte after it; `INFLATE_NEED_INPUT` when the input ran out with
   *   `more`; `INFLATE_NEED_OUTPUT` when the next symbol does not fit before
   *   `outEnd`; or a negative `DEFLATE_ERR_*` for a malformed stream.
   */
  inflate(
    src: u8[],
    ip: i32,
    inEnd: i32,
    more: boolean,
    out: u8[],
    op: i32,
    outEnd: i32,
    histStart: i32
  ): i32 {
    if (ip < 0 || ip > inEnd || inEnd > toI32(src.length)) {
      panic("Inflater.inflate: an input window outside its array")
    }
    if (histStart < 0 || histStart > op || op > outEnd || outEnd > toI32(out.length)) {
      panic("Inflater.inflate: an output window outside its array")
    }
    return this.run(src, ip, inEnd, more, out, op, outEnd, histStart)
  }

  /**
   * `inflate` for a whole stream in one call: `more` is false and matches
   * copy from `op` on, which is what a one-shot decoder passes. Its checks
   * test the parameters themselves, so a caller that has tested the same
   * ends proves them away; `inflate`'s `histStart <= op` is one a caller
   * passing `op` for both cannot prove. A window outside its array is
   * `DEFLATE_ERR_WINDOW`, with nothing read or written.
   *
   * @internal Called by the one-shot decoders of std/compress/gzip.ts and
   * std/compress/zlib.ts.
   * @param src The array that holds the compressed stream.
   * @param ip Where in `src` the stream starts.
   * @param inEnd One past the stream's last byte; running out before the
   *   final block is `DEFLATE_ERR_TRUNCATED`.
   * @param out The array the decoded bytes are written into.
   * @param op Where in `out` the first decoded byte goes.
   * @param outEnd One past the last byte of `out` this call may write.
   * @returns As `inflate` answers, never `INFLATE_NEED_INPUT`; or
   *   `DEFLATE_ERR_WINDOW` for a window outside its array.
   */
  inflateAll(src: u8[], ip: i32, inEnd: i32, out: u8[], op: i32, outEnd: i32): i32 {
    if (ip < 0 || ip > inEnd || inEnd > toI32(src.length) || op < 0 || op > outEnd || outEnd > toI32(out.length)) {
      return DEFLATE_ERR_WINDOW
    }
    return this.run(src, ip, inEnd, false, out, op, outEnd, op)
  }

  /** `inflate` and `inflateAll` once their windows are checked. */
  private run(
    src: u8[],
    ip: i32,
    inEnd: i32,
    more: boolean,
    out: u8[],
    op: i32,
    outEnd: i32,
    histStart: i32
  ): i32 {
    this.inPos = ip
    this.outPos = op
    const r: i32 = this.step(src, inEnd, more, out, outEnd, histStart)
    // Whole bytes the bit buffer read ahead go back to the input, so that a
    // caller may drop everything before `inPos`.
    if (!this.giveBack()) {
      return DEFLATE_ERR_TRUNCATED
    }
    return r
  }

  /** `inflate`'s state machine, once its windows are checked. */
  private step(src: u8[], inEnd: i32, more: boolean, out: u8[], outEnd: i32, histStart: i32): i32 {
    while (true) {
      const s: i32 = this.state
      if (s === INF_S_DONE) {
        return INFLATE_DONE
      }
      if (s === INF_S_BLOCK) {
        if (this.last) {
          if (!this.unread()) {
            return DEFLATE_ERR_TRUNCATED
          }
          this.state = INF_S_DONE
          return INFLATE_DONE
        }
        const saveBuf: u64 = this.bitBuf
        const saveCount: i32 = this.bitCount
        const savePos: i32 = this.inPos
        if (!this.fill(src, inEnd)) {
          return DEFLATE_ERR_TRUNCATED
        }
        const have: i32 = this.bitCount
        if (have < 3) {
          this.bitBuf = saveBuf
          this.bitCount = saveCount
          this.inPos = savePos
          return more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
        }
        const header: i32 = toI32(this.bitBuf & toU64(7))
        this.bitBuf = this.bitBuf >> toU64(3)
        this.bitCount = have - 3
        const type: i32 = header >> 1
        if (type === 0) {
          if (!this.unread()) {
            return DEFLATE_ERR_TRUNCATED
          }
          const at: i32 = this.inPos
          if (at < 0) {
            return DEFLATE_ERR_TRUNCATED
          }
          // `at <= inEnd - 4` keeps `at` at most 2^31 - 5: the third test is
          // never true, and tells the bounds prover so.
          if (inEnd < 4 || at > inEnd - 4 || at > 2147483643) {
            this.bitBuf = saveBuf
            this.bitCount = saveCount
            this.inPos = savePos
            return more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
          }
          const len: i32 = toI32(uncheckedGet(src, at)) | (toI32(uncheckedGet(src, at + 1)) << 8)
          const nlen: i32 = toI32(uncheckedGet(src, at + 2)) | (toI32(uncheckedGet(src, at + 3)) << 8)
          if ((len ^ 0xffff) !== nlen) {
            return DEFLATE_ERR_STORED_LENGTH
          }
          this.inPos = at + 4
          this.storedLeft = len
          this.last = (header & 1) !== 0
          this.state = INF_S_STORED
        } else if (type === 1) {
          if (this.fixedStatus !== 0) {
            return this.fixedStatus
          }
          this.last = (header & 1) !== 0
          this.fixed = true
          this.state = INF_S_HUFF
        } else if (type === 2) {
          const r: i32 = this.readDynamic(src, inEnd)
          if (r === INFLATE_NEED_INPUT) {
            this.bitBuf = saveBuf
            this.bitCount = saveCount
            this.inPos = savePos
            return more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
          }
          if (r !== 0) {
            return r
          }
          this.last = (header & 1) !== 0
          this.fixed = false
          this.state = INF_S_HUFF
        } else {
          return DEFLATE_ERR_BLOCK_TYPE
        }
      } else if (s === INF_S_STORED) {
        const r: i32 = this.stored(src, inEnd, more, out, outEnd)
        if (r !== 0) {
          return r
        }
        this.state = INF_S_BLOCK
      } else {
        const r: i32 = this.huffman(src, inEnd, more, out, outEnd, histStart)
        if (r !== 0) {
          return r
        }
      }
    }
  }

  /**
   * One stored block's copy: as much of what is left of it as both rooms
   * hold. Answers 0 once the block is done, `INFLATE_NEED_OUTPUT` or
   * `INFLATE_NEED_INPUT` when a room ran out first, and
   * `DEFLATE_ERR_TRUNCATED` or `DEFLATE_ERR_STORED_LENGTH` for a window or a
   * length `step` and `inflate` rule out.
   */
  private stored(src: u8[], inEnd: i32, more: boolean, out: u8[], outEnd: i32): i32 {
    const ip: i32 = this.inPos
    const opos: i32 = this.outPos
    // `inflate` checked `inPos <= inEnd` and `outPos <= outEnd`, and
    // every step keeps both.
    if (ip < 0 || ip > inEnd || opos < 0 || opos > outEnd) {
      return DEFLATE_ERR_TRUNCATED
    }
    const inAvail: i32 = inEnd - ip
    const outAvail: i32 = outEnd - opos
    if (inAvail < 0 || outAvail < 0 || inEnd < 0 || outEnd < 0) {
      return DEFLATE_ERR_TRUNCATED
    }
    // A stored length is 16 bits.
    const left: i32 = this.storedLeft
    if (left < 0 || left > 65535) {
      return DEFLATE_ERR_STORED_LENGTH
    }
    let n: i32 = left
    if (n > inAvail) {
      n = inAvail
    }
    if (n > outAvail) {
      n = outAvail
    }
    // `n` is at most each room, and each room at least zero: `ip + n`
    // and `opos + n` are the ends less what is left of each room.
    const inGap: i32 = inAvail - n
    const outGap: i32 = outAvail - n
    if (inGap < 0 || outGap < 0) {
      return DEFLATE_ERR_TRUNCATED
    }
    // `inflate` checked both windows, so the copy always fits; the prover
    // cannot follow them through the fields. One that did not answers
    // `DEFLATE_ERR_TRUNCATED` through the same exit as a block cut short.
    const copied: boolean = tryCopyBytes(out, opos, src, ip, n)
    this.inPos = inEnd - inGap
    this.outPos = outEnd - outGap
    this.storedLeft = left - n
    if (!copied || this.storedLeft > 0) {
      if (copied && this.outPos === outEnd) {
        return INFLATE_NEED_OUTPUT
      }
      return more && copied ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
    }
    return 0
  }

  /**
   * The Huffman block loop: decodes symbols until the end of the block
   * (answers 0, the state back at a block header), or until the input or
   * the output runs short or the stream is malformed (answers that code).
   * Answers `DEFLATE_ERR_HUFFMAN` when a table is not its size, which the
   * constructor rules out, and `DEFLATE_ERR_TRUNCATED` when `inEnd` or
   * `outEnd` is negative, which `step` rules out.
   */
  private huffman(src: u8[], inEnd: i32, more: boolean, out: u8[], outEnd: i32, histStart: i32): i32 {
    const lt: InflateTable = this.fixed ? this.fixedLit : this.lit
    const dt: InflateTable = this.fixed ? this.fixedDist : this.dist
    const le: i32[] = lt.entries
    const de: i32[] = dt.entries
    if (toI32(le.length) !== INF_LIT_ENOUGH || toI32(de.length) !== INF_DIST_ENOUGH) {
      return DEFLATE_ERR_HUFFMAN
    }
    if (inEnd < 0 || outEnd < 0 || histStart < 0) {
      return DEFLATE_ERR_TRUNCATED
    }
    const litMask: u64 = (toU64(1) << toU64(INF_LIT_BITS)) - toU64(1)
    const distMask: u64 = (toU64(1) << toU64(INF_DIST_BITS)) - toU64(1)
    // The fast loop runs while eight bytes of input can be loaded and the
    // longest match, with sixteen bytes of copy slack, fits the output.
    const inFast: i32 = inEnd - 8
    const outFast: i32 = outEnd - INF_FAST_ROOM
    let bb: u64 = this.bitBuf
    let bc: i32 = this.bitCount
    let ip: i32 = this.inPos
    let op: i32 = this.outPos
    let status: i32 = 0
    let ended: boolean = false
    while (true) {
      // The fast loop: after a refill the buffer holds 64 bits of input, of
      // which it counts the whole bytes (56 to 63), and a length, its extra
      // bits, a distance and its extra bits take at most 48. So no symbol is
      // checked for running short, every symbol is decoded here (the end of
      // the block and errors included), and the next symbol's entry is
      // looked up before the refill rather than after it, from the 16 or
      // more bits still in hand, which takes the refill off the chain of
      // lookups. The careful step below takes over where the input or the
      // output runs short.
      //
      // The bit count may carry borrows above its low byte, which alone is
      // the count: subtracting a whole entry, whose low byte is its length,
      // costs no mask, and every shift reads the low six bits only. It is
      // masked again when the loop ends.
      if (ip >= 0 && ip <= inFast && ip <= 2147483639 && op <= outFast) {
        const first: integer<0, 2147483639> = ip
        bb = bb | (deflateLoad64(src, first) << toU64(bc))
        ip = wrappingAdd(ip, toI32(7) - ((bc >> 3) & 7))
        bc = bc | 56
        let e: i32 = uncheckedGet(le, toI32(bb & litMask))
        while (true) {
          if ((e & 0x700) === 0) {
            // A literal of at most eleven bits; with 45 or more bits left,
            // so may the next two be.
            bb = bb >> toU64(e)
            bc = wrappingSub(bc, e)
            uncheckedSet(out, op, toU8(e >> 16))
            op = wrappingAdd(op, 1)
            e = uncheckedGet(le, toI32(bb & litMask))
            if ((e & 0x700) === 0) {
              bb = bb >> toU64(e)
              bc = wrappingSub(bc, e)
              uncheckedSet(out, op, toU8(e >> 16))
              op = wrappingAdd(op, 1)
              e = uncheckedGet(le, toI32(bb & litMask))
              if ((e & 0x700) === 0) {
                bb = bb >> toU64(e)
                bc = wrappingSub(bc, e)
                uncheckedSet(out, op, toU8(e >> 16))
                op = wrappingAdd(op, 1)
                e = uncheckedGet(le, toI32(bb & litMask))
              }
            }
          } else {
            if ((e & 0x700) === INF_SUB << 8) {
              // A code longer than the table: its last bits index a subtable.
              bb = bb >> toU64(e)
              bc = wrappingSub(bc, e)
              // The subtable's start and the index into it are both under
              // 2^16, so the sum is an i32.
              e = uncheckedGet(
                le,
                ((e >> 16) & 65535) + (toI32(bb) & 32767 & ~(toI32(-1) << ((e >> 11) & 15)))
              )
            } else if ((e & 0x700) === INF_SLOW << 8) {
              // Only a table built for an incomplete code (none at all, or
              // one one-bit code) has these, and every code it does have
              // is in the table: with all the bits in hand, no code matches.
              status = DEFLATE_ERR_SYMBOL
              break
            }
            bb = bb >> toU64(e)
            bc = wrappingSub(bc, e)
            if ((e & 0x700) !== INF_LENGTH << 8) {
              if ((e & 0x700) === INF_LITERAL << 8) {
                uncheckedSet(out, op, toU8(e >> 16))
                op = wrappingAdd(op, 1)
                e = uncheckedGet(le, toI32(bb & litMask))
              } else {
                if ((e & 0x700) === INF_END << 8) {
                  this.state = INF_S_BLOCK
                } else {
                  status = DEFLATE_ERR_SYMBOL
                }
                ended = true
                break
              }
            } else {
              const lx: i32 = (e >> 11) & 15
              // A length base is at most 258 and its extra bits at most 5;
              // the two masks only bound the sum for the prover.
              const len: i32 = ((e >> 16) & 65535) + (toI32(bb) & 32767 & ~(-1 << lx))
              bb = bb >> toU64(lx)
              bc = wrappingSub(bc, lx)
              let d: i32 = uncheckedGet(de, toI32(bb & distMask))
              if ((d & 0x700) === INF_SUB << 8) {
                bb = bb >> toU64(d)
                bc = wrappingSub(bc, d)
                // As for the literal/length subtable.
                d = uncheckedGet(
                  de,
                  ((d >> 16) & 65535) + (toI32(bb) & 32767 & ~(toI32(-1) << ((d >> 11) & 15)))
                )
              }
              if ((d & 0x700) !== 0) {
                // A slow entry, as for the literal/length table, or one of
                // the two distance codes that decode as errors.
                status = DEFLATE_ERR_SYMBOL
                break
              }
              bb = bb >> toU64(d)
              bc = wrappingSub(bc, d)
              const dx: i32 = (d >> 11) & 15
              // A distance base is under 2^15 and its extra bits at most 13.
              const dist: i32 = ((d >> 16) & 65535) + (toI32(bb) & 32767 & ~(-1 << dx))
              bb = bb >> toU64(dx)
              bc = wrappingSub(bc, dx)
              // `op` stays at or past `histStart`, which is not negative, so
              // the test of `at` fails only on a position this loop broke.
              const at: i32 = op
              if (at < 0 || dist > at - histStart) {
                status = DEFLATE_ERR_DISTANCE
                break
              }
              // The next entry, before the copy, so that its lookup and the
              // copy overlap.
              e = uncheckedGet(le, toI32(bb & litMask))
              const stop: i32 = wrappingAdd(op, len)
              if (dist >= 8) {
                // Sixteen bytes at a time: a copy runs at most fifteen bytes
                // past `stop`, inside `outEnd`, and the next symbol
                // overwrites them. `op` and `op - dist` lie in
                // [histStart, outEnd - 290], so the bounds in the condition
                // always hold; they are what lets the positions enter the
                // copy's range without a check, and the bytes loop after is
                // what would finish a copy they ever stopped.
                // `dist` is at most `at - histStart`, so `from` is at or past `histStart`.
                let to: i32 = at
                let from: i32 = at - dist
                while (to < stop && to >= 0 && to <= 2147483631 && from >= 0 && from <= 2147483631) {
                  inflateCopy16(out, to, from)
                  to = wrappingAdd(to, 16)
                  from = wrappingAdd(from, 16)
                }
                while (to < stop) {
                  uncheckedSet(out, to, uncheckedGet(out, from))
                  to = wrappingAdd(to, 1)
                  from = wrappingAdd(from, 1)
                }
              } else if (dist === 1) {
                // A run of one byte, sixteen at a time, bounded as above.
                // `at` is past `histStart` by at least `dist`.
                const four: u64 = toU64(uncheckedGet(out, at - 1)) * toU64(0x01010101)
                const w: u64 = four | (four << toU64(32))
                let to: i32 = op
                while (to < stop && to >= 0 && to <= 2147483631) {
                  inflateFill16(out, to, w)
                  to = wrappingAdd(to, 16)
                }
                while (to < stop) {
                  uncheckedSet(out, to, toU8(w))
                  to = wrappingAdd(to, 1)
                }
              } else {
                // As above.
                let from: i32 = at - dist
                let to: i32 = at
                while (to < stop) {
                  uncheckedSet(out, to, uncheckedGet(out, from))
                  to = wrappingAdd(to, 1)
                  from = wrappingAdd(from, 1)
                }
              }
              op = stop
            }
          }
          if (ip < 0 || ip > inFast || ip > 2147483639 || op > outFast) {
            break
          }
          const at: integer<0, 2147483639> = ip
          bb = bb | (deflateLoad64(src, at) << toU64(bc))
          ip = wrappingAdd(ip, toI32(7) - ((bc >> 3) & 7))
          bc = bc | 56
        }
      }
      bc = bc & 63
      if (status !== 0 || ended) {
        break
      }
      const sBb: u64 = bb
      const sBc: i32 = bc
      const sIp: i32 = ip
      // Refill to at least 56 bits where eight bytes remain, else as many
      // as there are: a symbol is decoded only once all its bits are here.
      if (ip >= 0 && ip <= inFast) {
        bb = bb | (deflateLoad64(src, ip) << toU64(bc))
        ip += (63 - bc) >> 3
        // `bc | 56`, as a sum the bounds prover follows.
        bc = toI32(56) + (bc & 7)
      } else {
        while (bc <= 56 && ip < inEnd) {
          bb = bb | (toU64(uncheckedGet(src, ip)) << toU64(bc))
          ip += 1
          bc += 8
        }
      }
      const e: i32 = this.lookup(lt, INF_TABLE_LITLEN, le, bb, bc)
      if (e === -1) {
        status = INFLATE_NEED_INPUT
      } else if (e < 0) {
        status = DEFLATE_ERR_SYMBOL
      }
      if (status !== 0) {
        if (status === INFLATE_NEED_INPUT) {
          bb = sBb
          bc = sBc
          ip = sIp
          if (!more) {
            status = DEFLATE_ERR_TRUNCATED
          }
        }
        break
      }
      const kind: i32 = (e >> 8) & 7
      const n: i32 = e & 15
      bb = bb >> toU64(n)
      // `lookup` answers only a code whose bits are all here.
      const left: i32 = bc - n
      bc = left
      if (kind === INF_LITERAL) {
        if (op >= outEnd) {
          bb = sBb
          bc = sBc
          ip = sIp
          status = INFLATE_NEED_OUTPUT
          break
        }
        uncheckedSet(out, op, toU8(e >> 16))
        op += 1
      } else if (kind === INF_LENGTH) {
        const lx: i32 = (e >> 11) & 15
        if (lx > left) {
          bb = sBb
          bc = sBc
          ip = sIp
          status = more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
          break
        }
        // A length base is at most 258 and its extra bits at most 5: an
        // entry past those is one `build` did not make.
        const lbase: i32 = e >> 16
        const lextra: i32 = toI32(bb & ((toU64(1) << toU64(lx)) - toU64(1)))
        if (lbase < 0 || lbase > 258 || lextra < 0 || lextra > 32767) {
          status = DEFLATE_ERR_SYMBOL
          break
        }
        const len: i32 = lbase + lextra
        bb = bb >> toU64(lx)
        const rest: i32 = left - lx
        bc = rest
        const d: i32 = this.lookup(dt, INF_TABLE_DIST, de, bb, bc)
        if (d === -1) {
          bb = sBb
          bc = sBc
          ip = sIp
          status = more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
          break
        }
        if (d < 0 || ((d >> 8) & 7) === INF_INVALID) {
          status = DEFLATE_ERR_SYMBOL
          break
        }
        const dn: i32 = d & 15
        const dx: i32 = (d >> 11) & 15
        const used: i32 = dn + dx
        if (used > rest) {
          bb = sBb
          bc = sBc
          ip = sIp
          status = more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
          break
        }
        bb = bb >> toU64(dn)
        // A distance base is 1 to 24577 and its extra bits at most 13, as
        // for a length.
        const dbase: i32 = d >> 16
        const dextra: i32 = toI32(bb & ((toU64(1) << toU64(dx)) - toU64(1)))
        if (dbase < 1 || dbase > 32768 || dextra < 0 || dextra > 32767) {
          status = DEFLATE_ERR_SYMBOL
          break
        }
        const dist: i32 = dbase + dextra
        bb = bb >> toU64(dx)
        bc = rest - used
        // `inflate` checked `histStart <= outPos <= outEnd`, and every step
        // keeps it.
        if (histStart < 0 || op < 0 || op < histStart || op > outEnd) {
          status = DEFLATE_ERR_TRUNCATED
          break
        }
        const span: i32 = op - histStart
        const room: i32 = outEnd - op
        if (room < 0) {
          status = DEFLATE_ERR_TRUNCATED
          break
        }
        if (dist > span) {
          status = DEFLATE_ERR_DISTANCE
          break
        }
        // `op + len` is `outEnd` less the room the copy leaves.
        const gap: i32 = room - len
        if (gap < 0) {
          bb = sBb
          bc = sBc
          ip = sIp
          status = INFLATE_NEED_OUTPUT
          break
        }
        const stop: i32 = outEnd - gap
        // `dist` is at least 1, so the second test never stops the copy.
        let from: i32 = op - dist
        while (op < stop && from < op) {
          uncheckedSet(out, op, uncheckedGet(out, from))
          op += 1
          from += 1
        }
      } else if (kind === INF_END) {
        this.state = INF_S_BLOCK
        break
      } else {
        status = DEFLATE_ERR_SYMBOL
        break
      }
    }
    this.bitBuf = bb
    this.bitCount = bc
    this.inPos = ip
    this.outPos = op
    return status
  }

  /**
   * The entry of the symbol at the bottom of `bb`, holding `bc` valid bits,
   * from `t` (whose entries are `entries`), with its whole code length in
   * the low four bits, through a subtable or the slow way as the table
   * says: -1 when the bits run out before the code ends, -2 when no code
   * matches, as it is too for an entry outside `entries`, which `build`
   * rules out. A code is decoded only once all its bits are here.
   */
  private lookup(t: InflateTable, kind: i32, entries: i32[], bb: u64, bc: i32): i32 {
    // Codes are at most 15 bits, and a table is under 2^15 entries: a
    // table past those is one `build` did not make.
    const bits: i32 = t.bits
    if (bits < 1 || bits > 15) {
      return -2
    }
    const mask: u64 = (toU64(1) << toU64(bits)) - toU64(1)
    const i: i32 = toI32(bb & mask)
    if (i < 0 || i >= toI32(entries.length)) {
      return -2
    }
    let e: i32 = entries[i]
    if (((e >> 8) & 7) === INF_SUB) {
      const root: i32 = e & 15
      const subMask: u64 = (toU64(1) << toU64((e >> 11) & 15)) - toU64(1)
      const start: i32 = e >> 16
      const off: i32 = toI32((bb >> toU64(root)) & subMask)
      if (start < 0 || start > 32767 || off < 0 || off > 32767) {
        return -2
      }
      const at: i32 = start + off
      if (at >= toI32(entries.length)) {
        return -2
      }
      const sub: i32 = entries[at]
      e = (sub & ~15) | (root + (sub & 15))
    } else if (((e >> 8) & 7) === INF_SLOW) {
      return this.slowDecode(t, kind, bb, bc)
    }
    return (e & 15) > bc ? -1 : e
  }

  /**
   * Decompresses the raw DEFLATE stream `src[off .. off + len)` into `out`
   * from `at`, writing at most `limit` bytes and never past `out`'s end, and
   * answers where the output ends; or `DEFLATE_ERR_OUTPUT_LIMIT` when the
   * stream holds more, `DEFLATE_ERR_TRAILING` when bytes follow its final
   * block, or another negative `DEFLATE_ERR_*` for a malformed stream. A
   * window outside its array, or a negative `limit`, panics. Allocates
   * nothing.
   *
   * @param src The array that holds the raw DEFLATE stream.
   * @param off Where in `src` the stream starts.
   * @param len How many bytes the stream is; every one must belong to it,
   *   since a byte after the final block is `DEFLATE_ERR_TRAILING`.
   * @param out The caller's array the data is written into.
   * @param at Where in `out` the data starts.
   * @param limit The most bytes of data to accept; a longer stream is
   *   `DEFLATE_ERR_OUTPUT_LIMIT`, as is one that reaches the end of `out`.
   * @returns The index in `out` one past the data's last byte, so the data
   *   is `out[at .. result)`; or a negative `DEFLATE_ERR_*` code. After an
   *   error the bytes of `out` from `at` may have been overwritten and mean
   *   nothing. Either way `consumed` says how far into `src` it read.
   */
  decompress(src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 {
    deflateWindow("Inflater.decompress", src, off, len)
    deflateWindow("Inflater.decompress", out, at, 0)
    if (limit < 0) {
      panic("Inflater.decompress: a negative limit")
    }
    // `deflateWindow` checked `off + len` against `src` and `at` against
    // `out`, so the stream ends `src.length` less the bytes after it, and the
    // output `out.length` less the room it leaves; the input is read from
    // `off` on.
    if (off < 0 || len < 0 || at < 0) {
      this.consumed = 0
      return DEFLATE_ERR_TRUNCATED
    }
    const after: i32 = toI32(src.length) - off
    const room: i32 = toI32(out.length) - at
    if (after < 0 || room < 0) {
      this.consumed = 0
      return DEFLATE_ERR_TRUNCATED
    }
    const inGap: i32 = after - len
    const take: i32 = limit < room ? limit : room
    if (inGap < 0 || take < 0) {
      this.consumed = 0
      return DEFLATE_ERR_TRUNCATED
    }
    const outGap: i32 = room - take
    if (outGap < 0) {
      this.consumed = 0
      return DEFLATE_ERR_TRUNCATED
    }
    const inEnd: i32 = toI32(src.length) - inGap
    const end: i32 = toI32(out.length) - outGap
    this.reset()
    const r: i32 = this.inflate(src, off, inEnd, false, out, at, end, at)
    const pos: i32 = this.inPos
    if (pos < 0) {
      this.consumed = 0
      return DEFLATE_ERR_TRUNCATED
    }
    this.consumed = pos - off
    if (r === INFLATE_NEED_OUTPUT) {
      return DEFLATE_ERR_OUTPUT_LIMIT
    }
    if (r !== INFLATE_DONE) {
      return r
    }
    if (this.inPos !== inEnd) {
      return DEFLATE_ERR_TRAILING
    }
    return this.outPos
  }
}

/**
 * `Deflater.compress` at `level`, building the compressor for this call
 * alone: 330 KB allocated and filled each time, so keep a `Deflater` for
 * anything repeated.
 *
 * @param src The array that holds the data to compress.
 * @param off Where in `src` the data starts.
 * @param len How many bytes of data to compress.
 * @param out The caller's array the stream is written into.
 * @param at Where in `out` the stream starts.
 * @param level How hard to compress, 0 to 9; another level panics.
 * @returns The index in `out` one past the stream's last byte, or
 *   `DEFLATE_NO_ROOM`, as `Deflater.compress` answers.
 */
export const deflateCompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, level: i32): i32 =>
  new Deflater(level).compress(src, off, len, out, at)

/**
 * `Inflater.decompress`, building the decompressor for this call alone.
 *
 * @param src The array that holds the raw DEFLATE stream.
 * @param off Where in `src` the stream starts.
 * @param len How many bytes the stream is.
 * @param out The caller's array the data is written into.
 * @param at Where in `out` the data starts.
 * @param limit The most bytes of data to accept.
 * @returns The index in `out` one past the data's last byte, or a negative
 *   `DEFLATE_ERR_*` code, as `Inflater.decompress` answers.
 */
export const deflateDecompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 =>
  new Inflater().decompress(src, off, len, out, at, limit)
