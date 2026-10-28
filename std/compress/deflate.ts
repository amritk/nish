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
 * allocated by the constructor, about 330 KB for a `Deflater` and 4 KB for an
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
import { uncheckedGet, uncheckedSet } from "nish:unsafe"
import { copyBytes } from "nish/bytes"

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

/** The largest stored block (§3.2.4). */
const DEFLATE_STORED_MAX: i32 = 65535

/** Huffman's multiplier for the hash (Knuth's 2^32 / phi). */
const DEFLATE_HASH_MUL: i64 = 2654435761

/** Decoder table entry kinds, in bits 8 to 10 of an entry. */
const INF_LITERAL: i32 = 0
const INF_LENGTH: i32 = 1
const INF_END: i32 = 2
const INF_SLOW: i32 = 3
const INF_INVALID: i32 = 4

/** The bits the literal/length and distance tables index directly; a longer code is decoded a bit at a time. */
const INF_LIT_BITS: i32 = 10
const INF_DIST_BITS: i32 = 8
const INF_CL_BITS: i32 = 7

/** The decoder's resumable states. */
const INF_S_BLOCK: i32 = 0
const INF_S_STORED: i32 = 1
const INF_S_HUFF: i32 = 2
const INF_S_DONE: i32 = 3

/**
 * The most bytes `Deflater.compress` writes for `n` bytes of input, at any
 * level: the input stored, five bytes of framing for every 65,535 and for
 * every block, and slack for the last partial byte. `n` is at most
 * 2^31 - 1 less the framing; a negative `n` answers 0.
 */
export const deflateBound = (n: i32): i32 => {
  if (n < 0) {
    return 0
  }
  return n + ((n >> 16) + (n >> 14) + 2) * 5 + 8
}

/**
 * The most bytes a compressed body of `n` input bytes takes in any of this
 * directory's formats: `deflateBound(n)` with room for gzip's 18 bytes of
 * header and trailer, which covers zlib's 6.
 */
export const compressBound = (n: i32): i32 => deflateBound(n) + 18

/** Panics unless `buf[off .. off + len)` lies inside `buf`. */
const deflateWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${toI32(buf.length)} bytes`)
  }
}

/**
 * Panics unless `out[p .. p + n)` lies inside `out`: the check every store of
 * the bit writer makes before its unchecked stores. A block's exact size was
 * checked against the room before it was written, so this never fires.
 */
const deflateRoom = (out: u8[], p: i32, n: i32): void => {
  if (p < 0 || p > toI32(out.length) - n) {
    panic("Deflater: a write past the room its block was sized for")
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
  uncheckedSet(b, p, toU8(w & toU64(255)))
  uncheckedSet(b, p + 1, toU8((w >> toU64(8)) & toU64(255)))
  uncheckedSet(b, p + 2, toU8((w >> toU64(16)) & toU64(255)))
  uncheckedSet(b, p + 3, toU8((w >> toU64(24)) & toU64(255)))
  uncheckedSet(b, p + 4, toU8((w >> toU64(32)) & toU64(255)))
  uncheckedSet(b, p + 5, toU8((w >> toU64(40)) & toU64(255)))
  uncheckedSet(b, p + 6, toU8((w >> toU64(48)) & toU64(255)))
  uncheckedSet(b, p + 7, toU8(w >> toU64(56)))
}

/** The number of trailing zero bits of a nonzero `x`. */
const deflateCtz64 = (x: u64): i32 => {
  const lo: u32 = toU32(x)
  if (lo !== 0) {
    return toI32(31) - Math.clz32(lo & (toU32(0) - lo))
  }
  const hi: u32 = toU32(x >> toU64(32))
  return toI32(63) - Math.clz32(hi & (toU32(0) - hi))
}

/**
 * How many bytes from `a` and from `b` agree, at most `max`; `a < b` and
 * `b + max` lie inside `src`, which the caller has checked.
 */
const deflateMatchLength = (src: u8[], a: i32, b: i32, max: i32): i32 => {
  if (a < 0 || b > 2147483639 - max) {
    panic("deflateMatchLength: a match outside its input")
  }
  let k: i32 = 0
  while (k + 8 <= max) {
    const pa: i32 = a + k
    const pb: i32 = b + k
    if (pa >= 0 && pa <= 2147483639 && pb >= 0 && pb <= 2147483639) {
      const x: u64 = deflateLoad64(src, pa) ^ deflateLoad64(src, pb)
      if (x !== toU64(0)) {
        return k + (deflateCtz64(x) >> 3)
      }
    } else {
      return k
    }
    k += 8
  }
  while (k < max && uncheckedGet(src, a + k) === uncheckedGet(src, b + k)) {
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

/** The base length of each length symbol 257 + s (§3.2.5). */
const deflateLengthBase = (s: i32): i32 => {
  if (s < 8) {
    return 3 + s
  }
  if (s === 28) {
    return 258
  }
  return ((toI32(4) + (s & 3)) << ((s >> 2) - 1)) + 3
}

/** The extra bits of each length symbol 257 + s (§3.2.5). */
const deflateLengthExtra = (s: i32): i32 => (s < 8 || s === 28 ? 0 : (s >> 2) - 1)

/** The base distance of each distance symbol (§3.2.5). */
const deflateDistBase = (d: i32): i32 => {
  if (d < 4) {
    return 1 + d
  }
  const extra: i32 = (d >> 1) - 1
  return ((toI32(2) + (d & 1)) << extra) + 1
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
 * Fills `codes[0 .. n)` with the canonical code (§3.2.2) of the lengths
 * `lens[0 .. n)`, each already bit-reversed for the LSB-first stream. `count`
 * and `next` are scratch of at least 16 entries. A length of 0 gets code 0.
 */
const deflateCanonical = (lens: i32[], n: i32, codes: i32[], count: i32[], next: i32[]): void => {
  if (
    n < 0 ||
    n > toI32(lens.length) ||
    n > toI32(codes.length) ||
    toI32(count.length) < 16 ||
    toI32(next.length) < 16
  ) {
    panic("deflateCanonical: a table smaller than its symbols")
  }
  for (let i: i32 = 0; i < 16; i += 1) {
    count[i] = 0
  }
  for (let s: i32 = 0; s < n; s += 1) {
    const l: i32 = lens[s]
    if (l >= 0 && l < 16) {
      count[l] += 1
    }
  }
  count[0] = 0
  let code: i32 = 0
  for (let l: i32 = 1; l < 16; l += 1) {
    code = (code + count[l - 1]) << 1
    next[l] = code
  }
  for (let s: i32 = 0; s < n; s += 1) {
    const l: i32 = lens[s]
    if (l > 0 && l < 16) {
      codes[s] = deflateReverse(next[l], l)
      next[l] += 1
    } else {
      codes[s] = 0
    }
  }
}

/**
 * The scratch `deflateLengths` sorts and folds in, sized for the 288
 * literal/length symbols, the largest alphabet.
 */
export class DeflateHuffmanScratch {
  /** Symbols sorted by frequency, then by symbol. */
  readonly syms: i32[]
  /** Their frequencies, then (in place) the tree, then their lengths. */
  readonly keys: i32[]
  /** The other half of each radix pass. */
  readonly tmpSyms: i32[]
  readonly tmpKeys: i32[]
  /** The radix pass's 256 buckets. */
  readonly buckets: i32[]
  /** How many codes have each length, 0 to 32. */
  readonly perLength: i32[]

  /** Allocates the scratch. */
  constructor() {
    this.syms = new Array<i32>(288)
    this.keys = new Array<i32>(288)
    this.tmpSyms = new Array<i32>(288)
    this.tmpKeys = new Array<i32>(288)
    this.buckets = new Array<i32>(256)
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
 * one, so the code is always complete. Frequencies are below 2^16.
 */
const deflateLengths = (freq: i32[], n: i32, limit: i32, lens: i32[], w: DeflateHuffmanScratch): void => {
  const syms: i32[] = w.syms
  const keys: i32[] = w.keys
  const tsyms: i32[] = w.tmpSyms
  const tkeys: i32[] = w.tmpKeys
  const buckets: i32[] = w.buckets
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
    panic("deflateLengths: an alphabet outside its scratch")
  }
  // The used symbols, by a two-pass radix sort on the 16-bit frequency.
  let used: i32 = 0
  for (let s: i32 = 0; s < n; s += 1) {
    lens[s] = 0
    const f: i32 = freq[s]
    if (f > 0) {
      uncheckedSet(tsyms, used, s)
      uncheckedSet(tkeys, used, f)
      used += 1
    }
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
    return
  }
  for (let pass: i32 = 0; pass < 2; pass += 1) {
    const shift: i32 = pass * 8
    for (let b: i32 = 0; b < 256; b += 1) {
      uncheckedSet(buckets, b, 0)
    }
    const fromSyms: i32[] = pass === 0 ? tsyms : syms
    const fromKeys: i32[] = pass === 0 ? tkeys : keys
    const toSyms: i32[] = pass === 0 ? syms : tsyms
    const toKeys: i32[] = pass === 0 ? keys : tkeys
    for (let i: i32 = 0; i < used; i += 1) {
      const b: i32 = (uncheckedGet(fromKeys, i) >> shift) & 255
      uncheckedSet(buckets, b, uncheckedGet(buckets, b) + 1)
    }
    let sum: i32 = 0
    for (let b: i32 = 0; b < 256; b += 1) {
      const c: i32 = uncheckedGet(buckets, b)
      uncheckedSet(buckets, b, sum)
      sum += c
    }
    for (let i: i32 = 0; i < used; i += 1) {
      const k: i32 = uncheckedGet(fromKeys, i)
      const b: i32 = (k >> shift) & 255
      const at: i32 = uncheckedGet(buckets, b)
      uncheckedSet(buckets, b, at + 1)
      uncheckedSet(toSyms, at, uncheckedGet(fromSyms, i))
      uncheckedSet(toKeys, at, k)
    }
  }
  // Two passes leave the sorted run back in `tsyms` / `tkeys`.
  for (let i: i32 = 0; i < used; i += 1) {
    uncheckedSet(syms, i, uncheckedGet(tsyms, i))
    uncheckedSet(keys, i, uncheckedGet(tkeys, i))
  }
  // Moffat and Katajainen, phase 1: each internal node's weight, and each
  // node's parent, in place over the ascending weights.
  uncheckedSet(keys, 0, uncheckedGet(keys, 0) + uncheckedGet(keys, 1))
  let root: i32 = 0
  let leaf: i32 = 2
  for (let next: i32 = 1; next < used - 1; next += 1) {
    if (leaf >= used || uncheckedGet(keys, root) < uncheckedGet(keys, leaf)) {
      uncheckedSet(keys, next, uncheckedGet(keys, root))
      uncheckedSet(keys, root, next)
      root += 1
    } else {
      uncheckedSet(keys, next, uncheckedGet(keys, leaf))
      leaf += 1
    }
    if (leaf >= used || (root < next && uncheckedGet(keys, root) < uncheckedGet(keys, leaf))) {
      uncheckedSet(keys, next, uncheckedGet(keys, next) + uncheckedGet(keys, root))
      uncheckedSet(keys, root, next)
      root += 1
    } else {
      uncheckedSet(keys, next, uncheckedGet(keys, next) + uncheckedGet(keys, leaf))
      leaf += 1
    }
  }
  // Phase 2: each internal node's depth.
  uncheckedSet(keys, used - 2, 0)
  for (let next: i32 = used - 3; next >= 0; next -= 1) {
    uncheckedSet(keys, next, uncheckedGet(keys, uncheckedGet(keys, next)) + 1)
  }
  // Phase 3: how many leaves sit at each depth.
  for (let l: i32 = 0; l < 33; l += 1) {
    per[l] = 0
  }
  let avail: i32 = 1
  let usedHere: i32 = 0
  let depth: i32 = 0
  root = used - 2
  let next: i32 = used - 1
  while (avail > 0) {
    while (root >= 0 && uncheckedGet(keys, root) === depth) {
      usedHere += 1
      root -= 1
    }
    while (avail > usedHere) {
      if (depth < 33) {
        per[depth] += 1
      }
      next -= 1
      avail -= 1
    }
    avail = 2 * usedHere
    depth += 1
    usedHere = 0
  }
  // The length limit: fold the deeper codes into `limit`, then lengthen
  // shorter codes until the Kraft sum is exactly 2^limit again.
  if (per[limit + 1] > 0 || depth > limit + 1) {
    for (let l: i32 = limit + 1; l < 33; l += 1) {
      per[limit] += per[l]
      per[l] = 0
    }
    let total: i32 = 0
    for (let l: i32 = limit; l > 0; l -= 1) {
      total += per[l] << (limit - l)
    }
    while (total !== 1 << limit) {
      per[limit] -= 1
      for (let l: i32 = limit - 1; l > 0; l -= 1) {
        if (per[l] !== 0) {
          per[l] -= 1
          per[l + 1] += 2
          break
        }
      }
      total -= 1
    }
  }
  // The most frequent symbols take the shortest lengths.
  let j: i32 = used
  for (let l: i32 = 1; l <= limit; l += 1) {
    for (let c: i32 = per[l]; c > 0; c -= 1) {
      j -= 1
      if (j >= 0) {
        const s: i32 = uncheckedGet(syms, j)
        if (s >= 0 && s < n) {
          lens[s] = l
        }
      }
    }
  }
}

/**
 * A DEFLATE compressor at one level: the match finder's tables, one block of
 * symbols, the Huffman scratch and the bit writer, allocated once. Not shared
 * between threads; reuse it for every call on one.
 */
export class Deflater {
  /** `head[h]`: the most recent position whose hash is `h`, plus `delta`; 0 for none. */
  readonly head: i32[]
  /** `prev[p & 32767]`: the position before `p` with `p`'s hash. */
  readonly prev: i32[]
  /** The block's symbols: a literal byte, or `dist << 9 | (256 + len - 3)`. */
  readonly tokens: i32[]
  /** The block's literal/length and distance frequencies. */
  readonly litFreq: i32[]
  readonly distFreq: i32[]
  /** The dynamic code for the block. */
  readonly litLens: i32[]
  readonly litCodes: i32[]
  readonly distLens: i32[]
  readonly distCodes: i32[]
  /** The code-length code, and the run-length coded lengths it codes. */
  readonly clFreq: i32[]
  readonly clLens: i32[]
  readonly clCodes: i32[]
  readonly rle: i32[]
  /** The fixed code (§3.2.6). */
  readonly fixedLitLens: i32[]
  readonly fixedLitCodes: i32[]
  readonly fixedDistLens: i32[]
  readonly fixedDistCodes: i32[]
  /** Length - 3 to length symbol - 257; distance to distance symbol, as `deflateDistSymbol` reads it. */
  readonly lengthSymbol: i32[]
  readonly distSymbol: i32[]
  /** Base and extra bits of each length and distance symbol. */
  readonly lengthBase: i32[]
  readonly lengthExtra: i32[]
  readonly distBase: i32[]
  readonly distExtra: i32[]
  /** Canonical-code and length-building scratch. */
  readonly countScratch: i32[]
  readonly nextScratch: i32[]
  readonly scratch: DeflateHuffmanScratch
  /** Bits written but not yet stored, low bit first, and how many. */
  bitBuf: u64
  bitCount: i32
  /** The level, 0 to 9. */
  readonly level: i32
  /** Candidates tried per position. */
  readonly maxChain: i32
  /** A match this long is taken without looking further. */
  readonly niceLength: i32
  /** A match shorter than this is checked against the next position's (levels 4 to 9); 0 for greedy. */
  readonly lazyLength: i32
  /** The shortest match taken: 4 at levels 1 to 3, whose hash covers four bytes, else 3. */
  readonly minMatch: i32
  /** A table position is an index of the current input plus this. */
  delta: i32
  /** The next call's `delta` floor: past every position the tables hold, by a whole window. */
  base: i32
  /** How many of `tokens` the block holds. */
  count: i32
  /** How many entries of `rle` the block uses. */
  rleCount: i32

  /** A compressor at `level`, 0 to 9; another level panics. */
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
    this.lengthSymbol = new Array<i32>(256)
    this.distSymbol = new Array<i32>(512)
    this.lengthBase = new Array<i32>(29)
    this.lengthExtra = new Array<i32>(29)
    this.distBase = new Array<i32>(30)
    this.distExtra = new Array<i32>(30)
    this.countScratch = new Array<i32>(16)
    this.nextScratch = new Array<i32>(16)
    this.scratch = new DeflateHuffmanScratch()
    this.bitBuf = 0
    this.bitCount = 0
    for (let s: i32 = 0; s < 29; s += 1) {
      this.lengthBase[s] = deflateLengthBase(s)
      this.lengthExtra[s] = deflateLengthExtra(s)
    }
    for (let s: i32 = 0; s < 29; s += 1) {
      const lo: i32 = this.lengthBase[s] - 3
      // Symbol 27 stops short of 258, which has symbol 28 to itself.
      let hi: i32 = 256
      if (s < 27) {
        hi = this.lengthBase[s + 1] - 3
      } else if (s === 27) {
        hi = 255
      }
      for (let l: i32 = lo; l < hi && l >= 0 && l < 256; l += 1) {
        this.lengthSymbol[l] = s
      }
    }
    for (let d: i32 = 0; d < 30; d += 1) {
      this.distBase[d] = deflateDistBase(d)
      this.distExtra[d] = deflateDistExtra(d)
    }
    // Distances 1 to 256 directly; above, by (distance - 1) >> 7 from 256 on.
    for (let d: i32 = 0; d < 30; d += 1) {
      const lo: i32 = this.distBase[d]
      const hi: i32 = d === 29 ? 32769 : this.distBase[d + 1]
      for (let dist: i32 = lo; dist < hi; dist += 1) {
        if (dist <= 256) {
          this.distSymbol[dist - 1] = d
        } else {
          const at: i32 = ((dist - 1) >> 7) + 256
          if (at < 512) {
            this.distSymbol[at] = d
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
    deflateCanonical(this.fixedLitLens, 288, this.fixedLitCodes, this.countScratch, this.nextScratch)
    deflateCanonical(this.fixedDistLens, 32, this.fixedDistCodes, this.countScratch, this.nextScratch)
  }

  /**
   * Forgets the history: the next call starts a stream from nothing. Only a
   * streaming writer needs it; `compress` starts a new stream on every call.
   */
  reset(): void {
    this.bitBuf = 0
    this.bitCount = 0
  }

  /**
   * Compresses `src[off .. off + len)` into `out` from `at` as one raw
   * DEFLATE stream, and answers where it ends, or `DEFLATE_NO_ROOM` when
   * `out` cannot hold it: `deflateBound(len)` bytes always can. A window
   * outside its array panics. Allocates nothing.
   */
  compress(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    deflateWindow("Deflater.compress", src, off, len)
    deflateWindow("Deflater.compress", out, at, 0)
    this.bitBuf = 0
    this.bitCount = 0
    this.begin(off)
    const end: i32 = this.compressRange(src, off, off + len, off, true, out, at, toI32(out.length))
    this.finish(off + len)
    if (end < 0) {
      return DEFLATE_NO_ROOM
    }
    return this.flushBits(out, end, toI32(out.length))
  }

  /**
   * Starts a stream whose history begins at index `start` of the next input:
   * every position the tables hold is pushed a window behind it.
   */
  begin(start: i32): void {
    if (this.base > DEFLATE_REBASE) {
      this.head.fill(0)
      this.prev.fill(0)
      this.base = DEFLATE_WINDOW + 1
    }
    this.delta = this.base - start
  }

  /**
   * Ends a stream whose input ended at index `end`: the next stream's
   * positions start a window past every position the tables now hold.
   */
  finish(end: i32): void {
    this.base = end + this.delta + DEFLATE_WINDOW + 1
  }

  /**
   * Moves the tables' positions down by `shift`, as the input they index
   * moves down by `shift` bytes; a position that falls below 0 is dropped.
   * The streaming writer calls it when it slides its window.
   */
  slide(shift: i32): void {
    this.delta = this.delta + shift
  }

  /**
   * Writes the whole bytes of the bit buffer, and the last partial byte
   * padded with zeros, into `out` at `op`; answers the end, or
   * `DEFLATE_NO_ROOM`.
   */
  flushBits(out: u8[], op: i32, oe: i32): i32 {
    const bytes: i32 = (this.bitCount + 7) >> 3
    if (op < 0 || oe > toI32(out.length) || bytes > oe - op) {
      return DEFLATE_NO_ROOM
    }
    let p: i32 = op
    let bb: u64 = this.bitBuf
    for (let i: i32 = 0; i < bytes; i += 1) {
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
  putBits(out: u8[], op: i32, v: i32, n: i32): i32 {
    let bb: u64 = this.bitBuf | (toU64(toU32(v)) << toU64(this.bitCount))
    let bc: i32 = this.bitCount + n
    let p: i32 = op
    if (bc >= 32) {
      deflateRoom(out, p, 4)
      uncheckedSet(out, p, toU8(bb & toU64(255)))
      uncheckedSet(out, p + 1, toU8((bb >> toU64(8)) & toU64(255)))
      uncheckedSet(out, p + 2, toU8((bb >> toU64(16)) & toU64(255)))
      uncheckedSet(out, p + 3, toU8((bb >> toU64(24)) & toU64(255)))
      bb = bb >> toU64(32)
      bc -= 32
      p += 4
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
  alignBits(out: u8[], op: i32): i32 {
    let p: i32 = op
    let bb: u64 = this.bitBuf
    let bc: i32 = this.bitCount
    deflateRoom(out, p, (bc + 7) >> 3)
    while (bc > 0) {
      uncheckedSet(out, p, toU8(bb & toU64(255)))
      bb = bb >> toU64(8)
      bc -= 8
      p += 1
    }
    this.bitBuf = 0
    this.bitCount = 0
    return p
  }

  /**
   * Compresses `src[start .. end)` as blocks into `out[op .. oe)`, matching
   * back as far as `histStart`; `final` marks the last block BFINAL. Answers
   * the new output position, with up to 31 bits still in the bit buffer, or
   * -1 when a block does not fit.
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
      panic("Deflater.compressRange: a range outside its input")
    }
    if (op < 0 || oe > toI32(out.length) || op > oe) {
      panic("Deflater.compressRange: a range outside its output")
    }
    let p: i32 = start
    let o: i32 = op
    if (start === end) {
      if (!final) {
        return o
      }
      // An empty final block, in the fixed code: ten bits.
      if ((this.bitCount + 10 + 7) >> 3 > oe - o) {
        return -1
      }
      o = this.putBits(out, o, toI32(3), toI32(3))
      return this.putBits(out, o, this.fixedLitCodes[256], this.fixedLitLens[256])
    }
    if (this.level === 0) {
      return this.writeStored(src, start, end, final, out, o, oe)
    }
    while (p < end) {
      if (p + this.delta > DEFLATE_REBASE) {
        this.rebase(p)
      }
      const q: i32 =
        this.level >= 4
          ? this.collectLazy(src, p, end, histStart)
          : this.collectGreedy(src, p, end, histStart)
      o = this.writeBlock(src, p, q, final && q === end, out, o, oe)
      if (o < 0) {
        return -1
      }
      p = q
    }
    return o
  }

  /**
   * Slides every table position down so that index `p` of the input is a
   * window above the floor again; a position more than a window behind `p`
   * becomes 0, which is never a candidate.
   */
  rebase(p: i32): void {
    const shift: i32 = p + this.delta - (DEFLATE_WINDOW + 1)
    const head: i32[] = this.head
    const prev: i32[] = this.prev
    for (let i: i32 = 0; i < toI32(head.length); i += 1) {
      const v: i32 = head[i] - shift
      head[i] = v > 0 ? v : 0
    }
    for (let i: i32 = 0; i < toI32(prev.length); i += 1) {
      const v: i32 = prev[i] - shift
      prev[i] = v > 0 ? v : 0
    }
    this.delta = this.delta - shift
    this.base = this.base - shift
  }

  /**
   * The best match at `p`, after recording `p` in the chains: answers
   * `len << 16 | dist`, or 0 for none at least `minMatch` long. `p + 4 <=
   * end`, which the caller checks.
   */
  longest(src: u8[], p: i32, end: i32, histStart: i32): i32 {
    const head: i32[] = this.head
    const prev: i32[] = this.prev
    if (toI32(head.length) !== DEFLATE_HASH_SIZE || toI32(prev.length) !== DEFLATE_WINDOW) {
      panic("Deflater.longest: a table is not its size")
    }
    const word: u32 = deflateLoad32(src, p)
    const h: i32 =
      this.minMatch === 3
        ? toI32(((word << 8) * toU32(DEFLATE_HASH_MUL)) >>> 17)
        : toI32((word * toU32(DEFLATE_HASH_MUL)) >>> 17)
    const v: i32 = p + this.delta
    let cand: i32 = uncheckedGet(head, h)
    uncheckedSet(head, h, v)
    uncheckedSet(prev, v & (DEFLATE_WINDOW - 1), cand)
    let maxLen: i32 = end - p
    if (maxLen > DEFLATE_MAX_MATCH) {
      maxLen = DEFLATE_MAX_MATCH
    }
    let best: i32 = this.minMatch - 1
    let bestDist: i32 = 0
    const limit: i32 = v - DEFLATE_WINDOW
    const nice: i32 = this.niceLength < maxLen ? this.niceLength : maxLen
    const lo: i32 = histStart + this.delta
    const mask: u32 = this.minMatch === 3 ? toU32(0xffffff) : ~toU32(0)
    let chain: i32 = this.maxChain
    while (cand >= limit && cand >= lo && cand < v && chain > 0) {
      const ci: i32 = cand - this.delta
      if (
        uncheckedGet(src, ci + best) === uncheckedGet(src, p + best) &&
        ci >= 0 &&
        ci <= 2147483639 &&
        ((deflateLoad32(src, ci) ^ word) & mask) === 0
      ) {
        const l: i32 = deflateMatchLength(src, ci, p, maxLen)
        if (l > best) {
          best = l
          bestDist = v - cand
          if (l >= nice) {
            break
          }
        }
      }
      cand = uncheckedGet(prev, cand & (DEFLATE_WINDOW - 1))
      chain -= 1
    }
    if (bestDist === 0 || best < this.minMatch) {
      return 0
    }
    // A three-byte match far back costs more than its three literals.
    if (best === 3 && bestDist > 4096) {
      return 0
    }
    return (best << 16) | bestDist
  }

  /** Records `p` in the chains without searching; `p + 4 <= src.length`. */
  insert(src: u8[], p: i32): void {
    const head: i32[] = this.head
    const prev: i32[] = this.prev
    if (toI32(head.length) !== DEFLATE_HASH_SIZE || toI32(prev.length) !== DEFLATE_WINDOW) {
      panic("Deflater.insert: a table is not its size")
    }
    const word: u32 = deflateLoad32(src, p)
    const h: i32 =
      this.minMatch === 3
        ? toI32(((word << 8) * toU32(DEFLATE_HASH_MUL)) >>> 17)
        : toI32((word * toU32(DEFLATE_HASH_MUL)) >>> 17)
    const v: i32 = p + this.delta
    uncheckedSet(prev, v & (DEFLATE_WINDOW - 1), uncheckedGet(head, h))
    uncheckedSet(head, h, v)
  }

  /** Clears the block's symbols and frequencies. */
  startBlock(): void {
    this.litFreq.fill(0)
    this.distFreq.fill(0)
    this.count = 0
  }

  /** Records the match `len`, `dist` as the block's next symbol. */
  addMatch(len: i32, dist: i32): void {
    const tokens: i32[] = this.tokens
    const n: i32 = this.count
    if (n < 0 || n >= toI32(tokens.length) || len < 3 || len > 258 || dist < 1 || dist > DEFLATE_WINDOW) {
      panic("Deflater.addMatch: a match outside the format")
    }
    uncheckedSet(tokens, n, (dist << 9) | (253 + len))
    this.count = n + 1
    const ls: i32 = uncheckedGet(this.lengthSymbol, len - 3)
    const lf: i32[] = this.litFreq
    uncheckedSet(lf, 257 + ls, uncheckedGet(lf, 257 + ls) + 1)
    const ds: i32 =
      dist <= 256
        ? uncheckedGet(this.distSymbol, dist - 1)
        : uncheckedGet(this.distSymbol, ((dist - 1) >> 7) + 256)
    const df: i32[] = this.distFreq
    uncheckedSet(df, ds, uncheckedGet(df, ds) + 1)
  }

  /** Records the literal `b` as the block's next symbol. */
  addLiteral(b: i32): void {
    const tokens: i32[] = this.tokens
    const n: i32 = this.count
    if (n < 0 || n >= toI32(tokens.length) || b < 0 || b > 255) {
      panic("Deflater.addLiteral: a literal outside the format")
    }
    uncheckedSet(tokens, n, b)
    this.count = n + 1
    const lf: i32[] = this.litFreq
    uncheckedSet(lf, b, uncheckedGet(lf, b) + 1)
  }

  /**
   * Fills the block's symbols greedily from `start`, and answers where the
   * block ends: at `end`, or where the symbol buffer filled. The match
   * finder, the chains and the symbol bookkeeping are written out in this one
   * loop over locals, because this is the fast level's whole cost.
   */
  collectGreedy(src: u8[], start: i32, end: i32, histStart: i32): i32 {
    this.startBlock()
    const head: i32[] = this.head
    const prev: i32[] = this.prev
    const tokens: i32[] = this.tokens
    const lf: i32[] = this.litFreq
    const df: i32[] = this.distFreq
    const lsym: i32[] = this.lengthSymbol
    const dsym: i32[] = this.distSymbol
    if (
      toI32(head.length) !== DEFLATE_HASH_SIZE ||
      toI32(prev.length) !== DEFLATE_WINDOW ||
      toI32(tokens.length) !== DEFLATE_BLOCK_TOKENS ||
      toI32(lf.length) < 288 ||
      toI32(df.length) < 32 ||
      toI32(lsym.length) < 256 ||
      toI32(dsym.length) < 512
    ) {
      panic("Deflater.collectGreedy: a table is not its size")
    }
    const delta: i32 = this.delta
    const lo: i32 = histStart + delta
    const maxChain: i32 = this.maxChain
    const niceLength: i32 = this.niceLength
    const room: i32 = DEFLATE_BLOCK_TOKENS - 1
    const last: i32 = end - 4
    let n: i32 = 0
    let p: i32 = start
    while (p < end && n < room) {
      let best: i32 = 0
      let bestDist: i32 = 0
      if (p >= 0 && p <= last && p <= 2147483639) {
        const word: u32 = deflateLoad32(src, p)
        const h: i32 = toI32((word * toU32(DEFLATE_HASH_MUL)) >>> 17)
        const v: i32 = p + delta
        let cand: i32 = uncheckedGet(head, h)
        uncheckedSet(head, h, v)
        uncheckedSet(prev, v & (DEFLATE_WINDOW - 1), cand)
        const maxLen: i32 = end - p < DEFLATE_MAX_MATCH ? end - p : DEFLATE_MAX_MATCH
        const nice: i32 = niceLength < maxLen ? niceLength : maxLen
        const limit: i32 = v - DEFLATE_WINDOW
        let chain: i32 = maxChain
        while (cand >= limit && cand >= lo && cand < v && chain > 0) {
          const ci: i32 = cand - delta
          if (ci >= 0 && ci <= 2147483639 && deflateLoad32(src, ci) === word) {
            const l: i32 = 4 + deflateMatchLength(src, ci + 4, p + 4, maxLen - 4)
            if (l > best) {
              best = l
              bestDist = v - cand
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
        uncheckedSet(tokens, n, (bestDist << 9) | (253 + best))
        n += 1
        const ls: i32 = 257 + uncheckedGet(lsym, best - 3)
        uncheckedSet(lf, ls, uncheckedGet(lf, ls) + 1)
        const ds: i32 =
          bestDist <= 256 ? uncheckedGet(dsym, bestDist - 1) : uncheckedGet(dsym, ((bestDist - 1) >> 7) + 256)
        uncheckedSet(df, ds, uncheckedGet(df, ds) + 1)
        // Every position the match covers goes into the chains.
        const stop: i32 = p + best
        let q: i32 = p + 1
        while (q < stop && q >= 0 && q <= last && q <= 2147483639) {
          const hq: i32 = toI32((deflateLoad32(src, q) * toU32(DEFLATE_HASH_MUL)) >>> 17)
          const vq: i32 = q + delta
          uncheckedSet(prev, vq & (DEFLATE_WINDOW - 1), uncheckedGet(head, hq))
          uncheckedSet(head, hq, vq)
          q += 1
        }
        p = stop
      } else {
        const b: i32 = toI32(uncheckedGet(src, p))
        uncheckedSet(tokens, n, b)
        n += 1
        uncheckedSet(lf, b, uncheckedGet(lf, b) + 1)
        p += 1
      }
    }
    this.count = n
    return p
  }

  /**
   * Fills the block's symbols from `p`, deferring each match by a position
   * while the next one finds a longer one; answers where the block ends.
   */
  collectLazy(src: u8[], start: i32, end: i32, histStart: i32): i32 {
    this.startBlock()
    let p: i32 = start
    const room: i32 = DEFLATE_BLOCK_TOKENS - 2
    while (p < end && this.count < room) {
      let m: i32 = 0
      if (p + 4 <= end) {
        m = this.longest(src, p, end, histStart)
      }
      if (m === 0) {
        this.addLiteral(toI32(uncheckedGet(src, p)))
        p += 1
      } else {
        let inserted: i32 = p + 1
        while (m >> 16 < this.lazyLength && p + 5 <= end && this.count < room) {
          const m2: i32 = this.longest(src, p + 1, end, histStart)
          inserted = p + 2
          if (m2 >> 16 > m >> 16) {
            this.addLiteral(toI32(uncheckedGet(src, p)))
            p += 1
            m = m2
          } else {
            break
          }
        }
        const len: i32 = m >> 16
        this.addMatch(len, m & 0xffff)
        const stop: i32 = p + len
        let q: i32 = inserted
        const last: i32 = end - 4
        while (q < stop && q <= last) {
          this.insert(src, q)
          q += 1
        }
        p = stop
      }
    }
    return p
  }

  /**
   * The bits a stored rendering of `n` bytes takes from a bit buffer holding
   * `pending` bits: each piece of up to 65,535 bytes has three header bits,
   * the padding to a byte and four bytes of `LEN` / `NLEN`.
   */
  storedBits(n: i32, pending: i32): i32 {
    let bits: i32 = 0
    let left: i32 = n
    let bc: i32 = pending
    let first: boolean = true
    while (first || left > 0) {
      first = false
      const take: i32 = left < DEFLATE_STORED_MAX ? left : DEFLATE_STORED_MAX
      const header: i32 = ((bc + 3 + 7) & ~7) - bc
      bits += header + 32 + 8 * take
      bc = 0
      left -= take
    }
    return bits
  }

  /**
   * Writes `src[start .. end)` as stored blocks, the last BFINAL when
   * `final`; answers the new position, or -1 without writing when it does
   * not fit in `out[op .. oe)`.
   */
  writeStored(src: u8[], start: i32, end: i32, final: boolean, out: u8[], op: i32, oe: i32): i32 {
    const bits: i32 = this.storedBits(end - start, this.bitCount)
    if ((this.bitCount + bits + 7) >> 3 > oe - op) {
      return -1
    }
    let p: i32 = start
    let o: i32 = op
    let first: boolean = true
    while (first || p < end) {
      first = false
      const take: i32 = end - p < DEFLATE_STORED_MAX ? end - p : DEFLATE_STORED_MAX
      const last: boolean = p + take === end
      o = this.putBits(out, o, toI32(final && last ? 1 : 0), toI32(3))
      o = this.alignBits(out, o)
      deflateRoom(out, o, 4)
      uncheckedSet(out, o, toU8(take & 255))
      uncheckedSet(out, o + 1, toU8(take >> 8))
      uncheckedSet(out, o + 2, toU8(~take & 255))
      uncheckedSet(out, o + 3, toU8((~take >> 8) & 255))
      o += 4
      copyBytes(out, o, src, p, take)
      o += take
      p += take
    }
    return o
  }

  /**
   * Builds the run-length coded lengths of the dynamic header (§3.2.7) for
   * `hlit` literal/length and `hdist` distance lengths, and their
   * frequencies in `clFreq`.
   */
  buildRle(hlit: i32, hdist: i32): void {
    const rle: i32[] = this.rle
    const freq: i32[] = this.clFreq
    const ll: i32[] = this.litLens
    const dl: i32[] = this.distLens
    if (toI32(rle.length) < 320 || toI32(freq.length) < 19 || hlit > 288 || hdist > 32) {
      panic("Deflater.buildRle: a header outside its scratch")
    }
    freq.fill(0)
    const total: i32 = hlit + hdist
    let n: i32 = 0
    let i: i32 = 0
    while (i < total) {
      const l: i32 = i < hlit ? uncheckedGet(ll, i) : uncheckedGet(dl, i - hlit)
      let run: i32 = 1
      while (
        i + run < total &&
        (i + run < hlit ? uncheckedGet(ll, i + run) : uncheckedGet(dl, i + run - hlit)) === l
      ) {
        run += 1
      }
      i += run
      if (l === 0) {
        while (run >= 11) {
          const r: i32 = run < 138 ? run : 138
          uncheckedSet(rle, n, ((r - 11) << 8) | 18)
          n += 1
          freq[18] += 1
          run -= r
        }
        if (run >= 3) {
          uncheckedSet(rle, n, ((run - 3) << 8) | 17)
          n += 1
          freq[17] += 1
          run = 0
        }
      } else {
        uncheckedSet(rle, n, l)
        n += 1
        if (l >= 0 && l < 19) {
          uncheckedSet(freq, l, uncheckedGet(freq, l) + 1)
        }
        run -= 1
        while (run >= 3) {
          const r: i32 = run < 6 ? run : 6
          uncheckedSet(rle, n, ((r - 3) << 8) | 16)
          n += 1
          freq[16] += 1
          run -= r
        }
      }
      while (run > 0) {
        uncheckedSet(rle, n, l)
        n += 1
        if (l >= 0 && l < 19) {
          uncheckedSet(freq, l, uncheckedGet(freq, l) + 1)
        }
        run -= 1
      }
    }
    this.rleCount = n
  }

  /**
   * Writes the block's symbols, `src[start .. end)`'s, as the smallest of a
   * dynamic, a fixed and a stored block; answers the new position, or -1
   * without writing when that does not fit in `out[op .. oe)`.
   */
  writeBlock(src: u8[], start: i32, end: i32, final: boolean, out: u8[], op: i32, oe: i32): i32 {
    const lf: i32[] = this.litFreq
    const df: i32[] = this.distFreq
    lf[256] = 1
    deflateLengths(lf, 286, 15, this.litLens, this.scratch)
    deflateLengths(df, 30, 15, this.distLens, this.scratch)
    this.litLens[286] = 0
    this.litLens[287] = 0
    this.distLens[30] = 0
    this.distLens[31] = 0
    deflateCanonical(this.litLens, 286, this.litCodes, this.countScratch, this.nextScratch)
    deflateCanonical(this.distLens, 30, this.distCodes, this.countScratch, this.nextScratch)
    let hlit: i32 = 286
    while (hlit > 257 && this.litLens[hlit - 1] === 0) {
      hlit -= 1
    }
    let hdist: i32 = 30
    while (hdist > 1 && this.distLens[hdist - 1] === 0) {
      hdist -= 1
    }
    this.buildRle(hlit, hdist)
    deflateLengths(this.clFreq, 19, 7, this.clLens, this.scratch)
    deflateCanonical(this.clLens, 19, this.clCodes, this.countScratch, this.nextScratch)
    let hclen: i32 = 19
    while (hclen > 4 && this.clLens[deflateClOrder(hclen - 1)] === 0) {
      hclen -= 1
    }
    // The three sizes, exactly. Extra bits are the same in both codes.
    let extra: i32 = 0
    let dynBits: i32 = hclen * 3 + 17
    let fixBits: i32 = 3
    for (let s: i32 = 0; s < 286; s += 1) {
      const f: i32 = uncheckedGet(lf, s)
      dynBits += f * uncheckedGet(this.litLens, s)
      fixBits += f * uncheckedGet(this.fixedLitLens, s)
      if (s >= 257) {
        extra += f * uncheckedGet(this.lengthExtra, s - 257)
      }
    }
    for (let d: i32 = 0; d < 30; d += 1) {
      const f: i32 = uncheckedGet(df, d)
      dynBits += f * uncheckedGet(this.distLens, d)
      fixBits += f * 5
      extra += f * uncheckedGet(this.distExtra, d)
    }
    for (let s: i32 = 0; s < 19; s += 1) {
      dynBits += this.clFreq[s] * this.clLens[s]
    }
    dynBits += 2 * this.clFreq[16] + 3 * this.clFreq[17] + 7 * this.clFreq[18]
    dynBits += extra
    fixBits += extra
    const storedBits: i32 = this.storedBits(end - start, this.bitCount)
    if (storedBits <= dynBits && storedBits <= fixBits) {
      return this.writeStored(src, start, end, final, out, op, oe)
    }
    const dynamic: boolean = dynBits < fixBits
    const bits: i32 = dynamic ? dynBits : fixBits
    if ((this.bitCount + bits + 7) >> 3 > oe - op) {
      return -1
    }
    let header: i32 = dynamic ? toI32(4) : toI32(2)
    if (final) {
      header += 1
    }
    let o: i32 = this.putBits(out, op, header, toI32(3))
    if (dynamic) {
      o = this.putBits(out, o, (hlit - 257) | ((hdist - 1) << 5) | ((hclen - 4) << 10), toI32(14))
      for (let i: i32 = 0; i < hclen; i += 1) {
        o = this.putBits(out, o, this.clLens[deflateClOrder(i)], toI32(3))
      }
      const rle: i32[] = this.rle
      const n: i32 = this.rleCount
      for (let i: i32 = 0; i < n && i < toI32(rle.length); i += 1) {
        const e: i32 = rle[i]
        const sym: i32 = e & 255
        if (sym < 0 || sym >= 19) {
          panic("Deflater.writeBlock: a code-length symbol outside 0 to 18")
        }
        o = this.putBits(out, o, this.clCodes[sym], this.clLens[sym])
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
   * code into `out` at `op`; answers the new position. The room was checked
   * by the block's exact size.
   */
  writeSymbols(lc: i32[], ll: i32[], dc: i32[], dl: i32[], out: u8[], op: i32): i32 {
    const tokens: i32[] = this.tokens
    const n: i32 = this.count
    const lsym: i32[] = this.lengthSymbol
    const lbase: i32[] = this.lengthBase
    const lextra: i32[] = this.lengthExtra
    const dsym: i32[] = this.distSymbol
    const dbase: i32[] = this.distBase
    const dextra: i32[] = this.distExtra
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
      panic("Deflater.writeSymbols: a table is not its size")
    }
    let bb: u64 = this.bitBuf
    let bc: i32 = this.bitCount
    let o: i32 = op
    for (let i: i32 = 0; i < n; i += 1) {
      const t: i32 = uncheckedGet(tokens, i)
      if (t < 256) {
        bb = bb | (toU64(toU32(uncheckedGet(lc, t))) << toU64(bc))
        bc += uncheckedGet(ll, t)
      } else {
        const len3: i32 = (t & 511) - 256
        const dist: i32 = t >> 9
        const s: i32 = uncheckedGet(lsym, len3)
        bb = bb | (toU64(toU32(uncheckedGet(lc, 257 + s))) << toU64(bc))
        bc += uncheckedGet(ll, 257 + s)
        bb = bb | (toU64(toU32(len3 + 3 - uncheckedGet(lbase, s))) << toU64(bc))
        bc += uncheckedGet(lextra, s)
        if (bc >= 32) {
          deflateRoom(out, o, 4)
          uncheckedSet(out, o, toU8(bb & toU64(255)))
          uncheckedSet(out, o + 1, toU8((bb >> toU64(8)) & toU64(255)))
          uncheckedSet(out, o + 2, toU8((bb >> toU64(16)) & toU64(255)))
          uncheckedSet(out, o + 3, toU8((bb >> toU64(24)) & toU64(255)))
          bb = bb >> toU64(32)
          bc -= 32
          o += 4
        }
        const d: i32 =
          dist <= 256 ? uncheckedGet(dsym, dist - 1) : uncheckedGet(dsym, ((dist - 1) >> 7) + 256)
        bb = bb | (toU64(toU32(uncheckedGet(dc, d))) << toU64(bc))
        bc += uncheckedGet(dl, d)
        bb = bb | (toU64(toU32(dist - uncheckedGet(dbase, d))) << toU64(bc))
        bc += uncheckedGet(dextra, d)
      }
      if (bc >= 32) {
        deflateRoom(out, o, 4)
        uncheckedSet(out, o, toU8(bb & toU64(255)))
        uncheckedSet(out, o + 1, toU8((bb >> toU64(8)) & toU64(255)))
        uncheckedSet(out, o + 2, toU8((bb >> toU64(16)) & toU64(255)))
        uncheckedSet(out, o + 3, toU8((bb >> toU64(24)) & toU64(255)))
        bb = bb >> toU64(32)
        bc -= 32
        o += 4
      }
    }
    this.bitBuf = bb
    this.bitCount = bc
    return this.putBits(out, o, lc[256], ll[256])
  }
}

/**
 * One Huffman decoding table: the entries for every `bits`-bit prefix, and
 * for the codes longer than that, the count per length and the symbols in
 * canonical order that a bit-at-a-time decode walks (§3.2.2).
 */
export class InflateTable {
  /** `entries[peek]`: value << 16 | kind << 8 | extra << 4 | length. */
  readonly entries: i32[]
  /** The prefix the table indexes. */
  readonly bits: i32
  /** How many codes have each length 0 to 15. */
  readonly count: i32[]
  /** The symbols, ordered by code. */
  readonly symbols: i32[]

  /** A table indexing `bits` bits, for an alphabet of up to `symbols` symbols. */
  constructor(bits: i32, symbols: i32) {
    this.bits = bits
    this.entries = new Array<i32>(1 << bits)
    this.count = new Array<i32>(16)
    this.symbols = new Array<i32>(symbols)
  }
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
  readonly lit: InflateTable
  readonly dist: InflateTable
  readonly codeLengths: InflateTable
  readonly fixedLit: InflateTable
  readonly fixedDist: InflateTable
  /** The lengths a dynamic header sends, literal/length then distance. */
  readonly lens: i32[]
  /** The order-indexed code-length code lengths. */
  readonly clLens: i32[]
  /** Scratch for building a table. */
  readonly offsets: i32[]
  readonly lengthBase: i32[]
  readonly lengthExtra: i32[]
  readonly distBase: i32[]
  readonly distExtra: i32[]
  /** Where `inflate` resumes: the block header, a stored block, a Huffman block, or done. */
  state: i32
  /** Whether the block being read is the final one. */
  last: boolean
  /** Whether the Huffman block uses the fixed code. */
  fixed: boolean
  /** Bytes of the current stored block still to copy. */
  storedLeft: i32
  /** Bits read but not consumed, low bit first, and how many. */
  bitBuf: u64
  bitCount: i32
  /** Where the last `inflate` stopped in its input and its output. */
  inPos: i32
  outPos: i32
  /** The input bytes the last `decompress` read, its final block included. */
  consumed: i32

  /** Builds the tables, the fixed code's among them. */
  constructor() {
    this.lit = new InflateTable(INF_LIT_BITS, 288)
    this.dist = new InflateTable(INF_DIST_BITS, 32)
    this.codeLengths = new InflateTable(INF_CL_BITS, 19)
    this.fixedLit = new InflateTable(INF_LIT_BITS, 288)
    this.fixedDist = new InflateTable(INF_DIST_BITS, 32)
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
    this.state = INF_S_BLOCK
    this.last = false
    this.fixed = false
    this.storedLeft = 0
    this.bitBuf = 0
    this.bitCount = 0
    this.inPos = 0
    this.outPos = 0
    this.consumed = 0
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
    if (fl !== 0 || fd !== 0) {
      panic("Inflater: the fixed code did not build")
    }
  }

  /** Starts a new stream: the next `inflate` reads a first block header. */
  reset(): void {
    this.state = INF_S_BLOCK
    this.last = false
    this.fixed = false
    this.storedLeft = 0
    this.bitBuf = 0
    this.bitCount = 0
  }

  /**
   * The table entry for symbol `s` of a table of `kind`.
   */
  entryOf(kind: i32, s: i32, len: i32): i32 {
    if (kind === INF_TABLE_CODELEN) {
      return (s << 16) | len
    }
    if (kind === INF_TABLE_DIST) {
      if (s >= 30) {
        return (INF_INVALID << 8) | len
      }
      return (this.distBase[s] << 16) | (this.distExtra[s] << 4) | len
    }
    if (s < 256) {
      return (s << 16) | (INF_LITERAL << 8) | len
    }
    if (s === 256) {
      return (INF_END << 8) | len
    }
    if (s >= 286) {
      return (INF_INVALID << 8) | len
    }
    return (this.lengthBase[s - 257] << 16) | (INF_LENGTH << 8) | (this.lengthExtra[s - 257] << 4) | len
  }

  /**
   * Builds `t` from the code lengths `lens[from .. from + n)`; answers 0, or
   * `DEFLATE_ERR_HUFFMAN` for an over-subscribed set or an incomplete one
   * (an incomplete set of a single one-bit code is allowed, as RFC 1951
   * §3.2.7 allows one distance code).
   */
  build(t: InflateTable, lens: i32[], from: i32, n: i32, kind: i32): i32 {
    const count: i32[] = t.count
    const syms: i32[] = t.symbols
    const entries: i32[] = t.entries
    const offs: i32[] = this.offsets
    const bits: i32 = t.bits
    if (
      from < 0 ||
      n < 0 ||
      from > toI32(lens.length) - n ||
      n > toI32(syms.length) ||
      toI32(count.length) < 16 ||
      toI32(offs.length) < 16 ||
      toI32(entries.length) !== 1 << bits
    ) {
      panic("Inflater.build: a table outside its scratch")
    }
    for (let l: i32 = 0; l < 16; l += 1) {
      count[l] = 0
    }
    for (let s: i32 = 0; s < n; s += 1) {
      const l: i32 = lens[from + s]
      if (l < 0 || l > 15) {
        return DEFLATE_ERR_HUFFMAN
      }
      count[l] += 1
    }
    count[0] = 0
    // The Kraft sum: over-subscribed is an error; incomplete is allowed for
    // one one-bit code only.
    let left: i32 = 1
    let codes: i32 = 0
    for (let l: i32 = 1; l < 16; l += 1) {
      left = (left << 1) - count[l]
      codes += count[l]
      if (left < 0) {
        return DEFLATE_ERR_HUFFMAN
      }
    }
    if (left > 0 && codes !== 0 && !(kind !== INF_TABLE_CODELEN && codes === 1 && count[1] === 1)) {
      return DEFLATE_ERR_HUFFMAN
    }
    offs[1] = 0
    for (let l: i32 = 1; l < 15; l += 1) {
      offs[l + 1] = offs[l] + count[l]
    }
    for (let s: i32 = 0; s < n; s += 1) {
      const l: i32 = lens[from + s]
      if (l > 0 && l < 16) {
        const at: i32 = offs[l]
        if (at >= 0 && at < toI32(syms.length)) {
          syms[at] = s
        }
        offs[l] = at + 1
      }
    }
    // A prefix whose code is longer than the table, or none at all, decodes
    // the slow way, which also finds an undefined code.
    const size: i32 = 1 << bits
    const slow: i32 = INF_SLOW << 8
    for (let i: i32 = 0; i < size; i += 1) {
      uncheckedSet(entries, i, slow)
    }
    let code: i32 = 0
    let k: i32 = 0
    for (let l: i32 = 1; l <= bits && l < 16; l += 1) {
      const codesHere: i32 = uncheckedGet(count, l)
      for (let c: i32 = 0; c < codesHere; c += 1) {
        if (k >= 0 && k < toI32(syms.length)) {
          const e: i32 = this.entryOf(kind, syms[k], l)
          const step: i32 = 1 << l
          for (let r: i32 = deflateReverse(code, l); r < size; r += step) {
            uncheckedSet(entries, r, e)
          }
        }
        k += 1
        code += 1
      }
      code = code << 1
    }
    return 0
  }

  /**
   * Decodes the symbol at the bottom of `bb`, holding `bc` valid bits, one
   * bit at a time from the counts (§3.2.2): answers the table entry of the
   * symbol with its true code length, or -1 when the bits run out before a
   * code ends (`bc` too small), or -2 when no code matches.
   */
  slowDecode(t: InflateTable, kind: i32, bb: u64, bc: i32): i32 {
    const count: i32[] = t.count
    const syms: i32[] = t.symbols
    let code: i32 = 0
    let first: i32 = 0
    let index: i32 = 0
    let b: u64 = bb
    for (let l: i32 = 1; l < 16 && l < toI32(count.length); l += 1) {
      if (l > bc) {
        return -1
      }
      code = code | toI32(b & toU64(1))
      b = b >> toU64(1)
      const c: i32 = count[l]
      if (code - c < first) {
        const at: i32 = index + (code - first)
        if (at < 0 || at >= toI32(syms.length)) {
          return -2
        }
        return this.entryOf(kind, syms[at], l)
      }
      index += c
      first = (first + c) << 1
      code = code << 1
    }
    return -2
  }

  /** Reads bytes of `src` into the bit buffer from `inPos` while it has room and `end` allows. */
  fill(src: u8[], end: i32): void {
    let bb: u64 = this.bitBuf
    let bc: i32 = this.bitCount
    let ip: i32 = this.inPos
    if (ip < 0 || end > toI32(src.length)) {
      panic("Inflater.fill: a window outside its input")
    }
    while (bc <= 56 && ip < end) {
      bb = bb | (toU64(uncheckedGet(src, ip)) << toU64(bc))
      ip += 1
      bc += 8
    }
    this.bitBuf = bb
    this.bitCount = bc
    this.inPos = ip
  }

  /** The low `n` bits of the bit buffer, consumed; the caller has checked that `n` are there. */
  take(n: i32): i32 {
    const v: i32 = toI32(this.bitBuf & ((toU64(1) << toU64(n)) - toU64(1)))
    this.bitBuf = this.bitBuf >> toU64(n)
    this.bitCount = this.bitCount - n
    return v
  }

  /**
   * Gives back the whole bytes of the bit buffer to the input, after dropping
   * the bits to the next byte boundary: where a stored block's `LEN`, or the
   * framing after the final block, begins.
   */
  unread(): void {
    const drop: i32 = this.bitCount & 7
    this.bitBuf = this.bitBuf >> toU64(drop)
    this.bitCount = this.bitCount - drop
    this.inPos = this.inPos - (this.bitCount >> 3)
    this.bitBuf = 0
    this.bitCount = 0
  }

  /**
   * Reads a dynamic block's header (§3.2.7) from the bit buffer and `src`,
   * and builds its tables. Answers 0, `INFLATE_NEED_INPUT` when the input ran
   * out first (nothing is consumed then: the caller rewinds), or an error.
   */
  readDynamic(src: u8[], end: i32): i32 {
    this.fill(src, end)
    if (this.bitCount < 14) {
      return INFLATE_NEED_INPUT
    }
    const hlit: i32 = this.take(toI32(5)) + 257
    const hdist: i32 = this.take(toI32(5)) + 1
    const hclen: i32 = this.take(toI32(4)) + 4
    if (hlit > 286 || hdist > 30) {
      return DEFLATE_ERR_HUFFMAN
    }
    const cl: i32[] = this.clLens
    for (let i: i32 = 0; i < 19; i += 1) {
      cl[deflateClOrder(i)] = 0
    }
    for (let i: i32 = 0; i < hclen; i += 1) {
      this.fill(src, end)
      if (this.bitCount < 3) {
        return INFLATE_NEED_INPUT
      }
      cl[deflateClOrder(i)] = this.take(toI32(3))
    }
    const r: i32 = this.build(this.codeLengths, cl, toI32(0), toI32(19), INF_TABLE_CODELEN)
    if (r !== 0) {
      return r
    }
    const lens: i32[] = this.lens
    const entries: i32[] = this.codeLengths.entries
    const total: i32 = hlit + hdist
    let i: i32 = 0
    while (i < total) {
      this.fill(src, end)
      const e: i32 = entries[toI32(this.bitBuf & toU64(127))]
      if (((e >> 8) & 7) === INF_SLOW) {
        // Only an incomplete code-length code leaves a prefix unfilled.
        return this.bitCount >= 7 ? DEFLATE_ERR_SYMBOL : INFLATE_NEED_INPUT
      }
      const l: i32 = e & 15
      if (l > this.bitCount) {
        return INFLATE_NEED_INPUT
      }
      this.take(l)
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
        if (sym === 16) {
          if (i === 0) {
            return DEFLATE_ERR_HUFFMAN
          }
          if (this.bitCount < 2) {
            return INFLATE_NEED_INPUT
          }
          value = lens[i - 1]
          rep = toI32(3) + this.take(toI32(2))
        } else if (sym === 17) {
          if (this.bitCount < 3) {
            return INFLATE_NEED_INPUT
          }
          rep = toI32(3) + this.take(toI32(3))
        } else {
          if (this.bitCount < 7) {
            return INFLATE_NEED_INPUT
          }
          rep = toI32(11) + this.take(toI32(7))
        }
        if (i + rep > total) {
          return DEFLATE_ERR_HUFFMAN
        }
        for (let k: i32 = 0; k < rep && i < toI32(lens.length); k += 1) {
          lens[i] = value
          i += 1
        }
      }
    }
    if (lens[256] === 0) {
      return DEFLATE_ERR_HUFFMAN
    }
    const rl: i32 = this.build(this.lit, lens, toI32(0), hlit, INF_TABLE_LITLEN)
    if (rl !== 0) {
      return rl
    }
    return this.build(this.dist, lens, hlit, hdist, INF_TABLE_DIST)
  }

  /**
   * Decodes from `src[ip .. inEnd)` into `out[op .. outEnd)`, resuming where
   * the last call stopped; a match may reach back to `histStart`. `more`
   * says whether input may follow `inEnd`: with it, running out is
   * `INFLATE_NEED_INPUT` (every byte up to `inPos` is used, and the bit
   * buffer keeps what it read ahead), without it `DEFLATE_ERR_TRUNCATED`.
   * Answers `INFLATE_DONE` once the final block has ended, with `inPos` the
   * first byte after it; `INFLATE_NEED_OUTPUT` when the next symbol does not
   * fit; or a negative `DEFLATE_ERR_*`. `inPos` and `outPos` say where it
   * stopped. Windows outside their arrays panic.
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
    this.inPos = ip
    this.outPos = op
    const r: i32 = this.step(src, inEnd, more, out, outEnd, histStart)
    // Whole bytes the bit buffer read ahead go back to the input, so that a
    // caller may drop everything before `inPos`.
    const back: i32 = this.bitCount >> 3
    this.inPos = this.inPos - back
    this.bitCount = this.bitCount - 8 * back
    this.bitBuf = this.bitBuf & ((toU64(1) << toU64(this.bitCount)) - toU64(1))
    return r
  }

  /** `inflate`'s state machine, once its windows are checked. */
  step(src: u8[], inEnd: i32, more: boolean, out: u8[], outEnd: i32, histStart: i32): i32 {
    while (true) {
      const s: i32 = this.state
      if (s === INF_S_DONE) {
        return INFLATE_DONE
      }
      if (s === INF_S_BLOCK) {
        if (this.last) {
          this.unread()
          this.state = INF_S_DONE
          return INFLATE_DONE
        }
        const saveBuf: u64 = this.bitBuf
        const saveCount: i32 = this.bitCount
        const savePos: i32 = this.inPos
        this.fill(src, inEnd)
        if (this.bitCount < 3) {
          this.bitBuf = saveBuf
          this.bitCount = saveCount
          this.inPos = savePos
          return more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
        }
        const header: i32 = this.take(toI32(3))
        const type: i32 = header >> 1
        if (type === 0) {
          this.unread()
          if (inEnd - this.inPos < 4) {
            this.bitBuf = saveBuf
            this.bitCount = saveCount
            this.inPos = savePos
            return more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
          }
          const at: i32 = this.inPos
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
        let n: i32 = this.storedLeft
        const inAvail: i32 = inEnd - this.inPos
        const outAvail: i32 = outEnd - this.outPos
        if (n > inAvail) {
          n = inAvail
        }
        if (n > outAvail) {
          n = outAvail
        }
        copyBytes(out, this.outPos, src, this.inPos, n)
        this.inPos += n
        this.outPos += n
        this.storedLeft -= n
        if (this.storedLeft > 0) {
          if (this.outPos === outEnd) {
            return INFLATE_NEED_OUTPUT
          }
          return more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
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
   * The Huffman block loop: decodes symbols until the end of the block
   * (answers 0, the state back at a block header), or until the input or
   * the output runs short or the stream is malformed (answers that code).
   */
  huffman(src: u8[], inEnd: i32, more: boolean, out: u8[], outEnd: i32, histStart: i32): i32 {
    const lt: InflateTable = this.fixed ? this.fixedLit : this.lit
    const dt: InflateTable = this.fixed ? this.fixedDist : this.dist
    const le: i32[] = lt.entries
    const de: i32[] = dt.entries
    if (toI32(le.length) !== 1 << INF_LIT_BITS || toI32(de.length) !== 1 << INF_DIST_BITS) {
      panic("Inflater.huffman: a table is not its size")
    }
    const litMask: u64 = toU64((1 << INF_LIT_BITS) - 1)
    const distMask: u64 = toU64((1 << INF_DIST_BITS) - 1)
    let bb: u64 = this.bitBuf
    let bc: i32 = this.bitCount
    let ip: i32 = this.inPos
    let op: i32 = this.outPos
    let status: i32 = 0
    while (true) {
      // The fast loop: while eight bytes of input and the longest match
      // with eight bytes of slack fit, no symbol can run short, so none is
      // checked for it. A symbol the fast loop does not decode (an end of
      // block, a long code, an error) is rewound and left to the careful
      // step below, which then hands back here.
      while (ip >= 0 && ip <= inEnd - 8 && ip <= 2147483639 && op >= 0 && op <= outEnd - 274) {
        const fBb: u64 = bb
        const fBc: i32 = bc
        const fIp: i32 = ip
        bb = bb | (deflateLoad64(src, ip) << toU64(bc))
        ip += (63 - bc) >> 3
        bc = bc | 56
        let e: i32 = uncheckedGet(le, toI32(bb & litMask))
        if ((e & 0x700) === 0) {
          // A literal; with at least 41 bits left, so may the next two be.
          const n: i32 = e & 15
          bb = bb >> toU64(n)
          bc -= n
          uncheckedSet(out, op, toU8(e >> 16))
          op += 1
          e = uncheckedGet(le, toI32(bb & litMask))
          if ((e & 0x700) === 0) {
            const n2: i32 = e & 15
            bb = bb >> toU64(n2)
            bc -= n2
            uncheckedSet(out, op, toU8(e >> 16))
            op += 1
            e = uncheckedGet(le, toI32(bb & litMask))
            if ((e & 0x700) === 0) {
              const n3: i32 = e & 15
              bb = bb >> toU64(n3)
              bc -= n3
              uncheckedSet(out, op, toU8(e >> 16))
              op += 1
            }
          }
          continue
        }
        if (((e >> 8) & 7) !== INF_LENGTH) {
          bb = fBb
          bc = fBc
          ip = fIp
          break
        }
        const n: i32 = e & 15
        bb = bb >> toU64(n)
        const lx: i32 = (e >> 4) & 15
        const len: i32 = (e >> 16) + toI32(bb & ((toU64(1) << toU64(lx)) - toU64(1)))
        bb = bb >> toU64(lx)
        const d: i32 = uncheckedGet(de, toI32(bb & distMask))
        if ((d & 0x700) !== 0) {
          bb = fBb
          bc = fBc
          ip = fIp
          break
        }
        const dn: i32 = d & 15
        const dx: i32 = (d >> 4) & 15
        bb = bb >> toU64(dn)
        const dist: i32 = (d >> 16) + toI32(bb & ((toU64(1) << toU64(dx)) - toU64(1)))
        bb = bb >> toU64(dx)
        bc -= n + lx + dn + dx
        if (dist > op - histStart) {
          status = DEFLATE_ERR_DISTANCE
          break
        }
        let from: i32 = op - dist
        const stop: i32 = op + len
        if (dist >= 8) {
          while (op < stop && from >= 0 && from <= 2147483639 && op >= 0 && op <= 2147483639) {
            deflateStore64(out, op, deflateLoad64(out, from))
            op += 8
            from += 8
          }
          op = stop
        } else {
          while (op < stop && from >= 0 && from < op) {
            uncheckedSet(out, op, uncheckedGet(out, from))
            op += 1
            from += 1
          }
          op = stop
        }
      }
      if (status !== 0) {
        break
      }
      const sBb: u64 = bb
      const sBc: i32 = bc
      const sIp: i32 = ip
      // Refill to at least 56 bits: every symbol, its extra bits, its
      // distance and their extra bits take at most 48.
      if (ip >= 0 && ip <= 2147483639 && ip + 8 <= inEnd) {
        bb = bb | (deflateLoad64(src, ip) << toU64(bc))
        ip += (63 - bc) >> 3
        bc = bc | 56
      } else {
        while (bc <= 56 && ip < inEnd) {
          bb = bb | (toU64(uncheckedGet(src, ip)) << toU64(bc))
          ip += 1
          bc += 8
        }
      }
      let e: i32 = uncheckedGet(le, toI32(bb & litMask))
      let kind: i32 = (e >> 8) & 7
      if (kind === INF_SLOW) {
        e = this.slowDecode(lt, INF_TABLE_LITLEN, bb, bc)
        if (e === -1) {
          status = INFLATE_NEED_INPUT
        } else if (e < 0) {
          status = DEFLATE_ERR_SYMBOL
        }
        kind = (e >> 8) & 7
      }
      if (status === 0 && (e & 15) > bc) {
        status = INFLATE_NEED_INPUT
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
      const n: i32 = e & 15
      bb = bb >> toU64(n)
      bc -= n
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
        const lx: i32 = (e >> 4) & 15
        if (lx > bc) {
          bb = sBb
          bc = sBc
          ip = sIp
          status = more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
          break
        }
        const len: i32 = (e >> 16) + toI32(bb & ((toU64(1) << toU64(lx)) - toU64(1)))
        bb = bb >> toU64(lx)
        bc -= lx
        let d: i32 = uncheckedGet(de, toI32(bb & distMask))
        if (((d >> 8) & 7) === INF_SLOW) {
          d = this.slowDecode(dt, INF_TABLE_DIST, bb, bc)
          if (d === -1) {
            bb = sBb
            bc = sBc
            ip = sIp
            status = more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
            break
          }
          if (d < 0) {
            status = DEFLATE_ERR_SYMBOL
            break
          }
        }
        if (((d >> 8) & 7) === INF_INVALID) {
          status = DEFLATE_ERR_SYMBOL
          break
        }
        const dn: i32 = d & 15
        const dx: i32 = (d >> 4) & 15
        if (dn + dx > bc) {
          bb = sBb
          bc = sBc
          ip = sIp
          status = more ? INFLATE_NEED_INPUT : DEFLATE_ERR_TRUNCATED
          break
        }
        bb = bb >> toU64(dn)
        const dist: i32 = (d >> 16) + toI32(bb & ((toU64(1) << toU64(dx)) - toU64(1)))
        bb = bb >> toU64(dx)
        bc -= dn + dx
        if (dist > op - histStart) {
          status = DEFLATE_ERR_DISTANCE
          break
        }
        if (len > outEnd - op) {
          bb = sBb
          bc = sBc
          ip = sIp
          status = INFLATE_NEED_OUTPUT
          break
        }
        let from: i32 = op - dist
        const stop: i32 = op + len
        if (dist >= 8 && stop + 8 <= outEnd) {
          // Eight bytes at a time; a copy may run up to seven bytes past
          // `stop`, inside `outEnd`, which the next symbol overwrites.
          while (op < stop && from >= 0 && from <= 2147483639 && op >= 0 && op <= 2147483639) {
            deflateStore64(out, op, deflateLoad64(out, from))
            op += 8
            from += 8
          }
          op = stop
        } else {
          while (op < stop) {
            uncheckedSet(out, op, uncheckedGet(out, from))
            op += 1
            from += 1
          }
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
   * Decompresses the raw DEFLATE stream `src[off .. off + len)` into `out`
   * from `at`, writing at most `limit` bytes and never past `out`'s end, and
   * answers where the output ends; or `DEFLATE_ERR_OUTPUT_LIMIT` when the
   * stream holds more, `DEFLATE_ERR_TRAILING` when bytes follow its final
   * block, or another negative `DEFLATE_ERR_*` for a malformed stream. A
   * window outside its array, or a negative `limit`, panics. Allocates
   * nothing.
   */
  decompress(src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 {
    deflateWindow("Inflater.decompress", src, off, len)
    deflateWindow("Inflater.decompress", out, at, 0)
    if (limit < 0) {
      panic("Inflater.decompress: a negative limit")
    }
    const room: i32 = toI32(out.length) - at
    const end: i32 = at + (limit < room ? limit : room)
    this.reset()
    const r: i32 = this.inflate(src, off, off + len, false, out, at, end, at)
    this.consumed = this.inPos - off
    if (r === INFLATE_NEED_OUTPUT) {
      return DEFLATE_ERR_OUTPUT_LIMIT
    }
    if (r !== INFLATE_DONE) {
      return r
    }
    if (this.inPos !== off + len) {
      return DEFLATE_ERR_TRAILING
    }
    return this.outPos
  }
}

/**
 * `Deflater.compress` at `level`, building the compressor for this call
 * alone: 330 KB allocated and filled each time, so keep a `Deflater` for
 * anything repeated.
 */
export const deflateCompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, level: i32): i32 =>
  new Deflater(level).compress(src, off, len, out, at)

/** `Inflater.decompress`, building the decompressor for this call alone. */
export const deflateDecompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 =>
  new Inflater().decompress(src, off, len, out, at, limit)
