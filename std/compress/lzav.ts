/**
 * `nish/compress/lzav` — LZAV's stream format 4, both ways, in pure Nish: a
 * fast byte-oriented LZ77 compressor with no entropy stage, and a decompressor
 * that refuses malformed input with an error code.
 *
 *     import { LzavCompressor, lzavBound, lzavDecompress } from "nish/compress/lzav";
 *
 *     const lzav = new LzavCompressor(); // the 1 MiB hash table, once
 *     const out: u8[] = new Array<u8>(lzavBound(len));
 *     const end: i32 = lzav.compress(src, off, len, out, 0); // -1: no room
 *     const got: i32 = lzavDecompress(out, 0, end, back, 0, len); // < 0: an error
 *
 * **What it is for.** LZAV trades ratio for speed: on text it writes about a
 * seventh more bytes than `nish/compress/deflate` at level 1, compresses about
 * twice as fast, and decompresses faster still on small inputs
 * (`bench/lzav/README.md` has the figures).
 * Use it for data this program, or another LZAV build, will read back — a
 * cache, a spill file, a message between two of your own processes. For a
 * format a browser or another tool reads, use `nish/compress/gzip`.
 *
 * **The stream is raw.** It holds no length, checksum or magic beyond its
 * first byte, so the reader must know the exact decompressed length:
 * `lzavDecompress` takes it and answers `LZAV_ERR_LENGTH` when the stream
 * decodes to anything else. Frame it yourself — a length prefix, and a
 * `nish/compress/checksum` CRC if corruption must be told from truncation.
 *
 * **Compatible with upstream LZAV.** `compress` writes, byte for byte, what
 * LZAV 7's `lzav_compress_default` writes for the same input, and
 * `lzavDecompress` reads any format-4 stream LZAV's compressors write,
 * `lzav_compress_hi`'s included. Not ported: `lzav_compress_hi` itself, and
 * reading the older format 3, which answers `LZAV_ERR_FORMAT`.
 *
 * **Decompression is bounded and total.** It writes only
 * `out[at .. at + n)`, and every malformed stream — a reference before the
 * start of the output, a block running past either end, a length that
 * disagrees, an unknown format byte — answers its negative `LZAV_ERR_*`
 * code; nothing a stream holds can panic or read outside `src[off .. off +
 * len)`. A stream that is not one LZAV wrote may still decode to some bytes
 * of the right length: the format has no checksum.
 *
 * **What is unchecked.** The hot loops read and write through `nish:unsafe`'s
 * `uncheckedGet` and `uncheckedSet`. Each such index is one of: a hash-table
 * slot, masked below the table's size; a position in the input below
 * `len - 25 + 6`, which the compressor's scan stops short of; or, in the
 * decompressor, a range of `out` or `src` checked against its window's end
 * before the copy. The compressor writes through checked stores, but for a
 * reference block's four header bytes, stored at once after one range check.
 *
 * Ported from LZAV 7.1 (`lzav_compress`, its block writers and
 * `lzav_decompress_4`), with the decompressor's word copies rewritten to
 * check their ranges.
 *
 * Ported from LZAV (https://github.com/avaneev/lzav), lzav.h. Copyright (c)
 * 2023-2026 Aleksey Vaneev. Used under the MIT licence; see std/LICENSE-lzav.
 */
import { uncheckedGet, uncheckedSet } from "nish:unsafe"
import { copyBytes } from "nish/bytes"

/** `compress`: `out` has less room after `at` than `lzavBound(len)`. */
export const LZAV_NO_ROOM: i32 = -1

/** `lzavDecompress`: an empty stream for a nonzero length, or the reverse. */
export const LZAV_ERR_PARAMS: i32 = -1

/** The stream ends inside a block, or is shorter than any stream LZAV writes. */
export const LZAV_ERR_TRUNCATED: i32 = -2

/** A block would write past the decompressed length. */
export const LZAV_ERR_OUTPUT: i32 = -3

/** A reference before the start of the output, or of distance 0. */
export const LZAV_ERR_DISTANCE: i32 = -4

/** The stream ends before the decompressed length is reached. */
export const LZAV_ERR_LENGTH: i32 = -5

/** The first byte names a format or minimum match length other than format 4's. */
export const LZAV_ERR_FORMAT: i32 = -6

/** The stream format this module writes and reads. */
const LZAV_FMT: i32 = 4

/** The longest reference distance the compressor considers. */
const LZAV_WIN_LEN: i32 = 4194304

/** The literals every stream ends with; the decompressor's reads stay this far from the end. */
const LZAV_LIT_FIN: i32 = 25

/** Inputs this long and longer use a minimum match of 6 bytes, shorter ones 5. */
const LZAV_MR5_THR: i32 = 262144

/** The largest hash table, in bytes; it holds 131,072 (word, position) pairs. */
const LZAV_HT_MAX: i32 = 1048576

/** The smallest hash table, in bytes, for inputs of up to 512 bytes. */
const LZAV_HT_MIN: i32 = 2048

/** `lzavCarryShift`'s table: `{0, 0, 2, 3, 0, 3, 5, 6}`, three bits each. */
const LZAV_CARRY_SHIFTS: i32 = 13993600

/** `lzavOffsetMask`'s widths for types 0 to 3, `{0, 9, 15, 22}`, five bits each. */
const LZAV_MASK_WIDTHS_LONG: i32 = 736544

/** Widths for types 4 to 7, `{0, 6, 12, 19}`, five bits each; also `lzavShortThreshold`'s exponents. */
const LZAV_MASK_WIDTHS_SHORT: i32 = 635072

/** The largest count a reference's varint may hold before its length overflows. */
const LZAV_COUNT_MAX: i32 = 2147483626

/** The little-endian 32-bit word at `b[p .. p + 4)`; the caller has checked the range. */
const lzavLoad32 = (b: u8[], p: integer<0, 2147483639>): u32 =>
  toU32(uncheckedGet(b, p)) |
  (toU32(uncheckedGet(b, p + 1)) << 8) |
  (toU32(uncheckedGet(b, p + 2)) << 16) |
  (toU32(uncheckedGet(b, p + 3)) << 24)

/** The little-endian 64-bit word at `b[p .. p + 8)`; the caller has checked the range. */
const lzavLoad64 = (b: u8[], p: integer<0, 2147483639>): u64 =>
  toU64(uncheckedGet(b, p)) |
  (toU64(uncheckedGet(b, p + 1)) << toU64(8)) |
  (toU64(uncheckedGet(b, p + 2)) << toU64(16)) |
  (toU64(uncheckedGet(b, p + 3)) << toU64(24)) |
  (toU64(uncheckedGet(b, p + 4)) << toU64(32)) |
  (toU64(uncheckedGet(b, p + 5)) << toU64(40)) |
  (toU64(uncheckedGet(b, p + 6)) << toU64(48)) |
  (toU64(uncheckedGet(b, p + 7)) << toU64(56))

/** Stores `w` little-endian into `b[p .. p + 8)`; the caller has checked the range. */
const lzavStore64 = (b: u8[], p: integer<0, 2147483639>, w: u64): void => {
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
const lzavCtz64 = (x: u64): i32 => {
  const lo: u32 = toU32(x)
  const hi: u32 = toU32(x >> toU64(32))
  const low: i32 = toI32(31) - Math.clz32(lo & (toU32(0) - lo))
  const high: i32 = toI32(63) - Math.clz32(hi & (toU32(0) - hi))
  return lo !== 0 ? low : high
}

/**
 * The hash-table word after the first four bytes at `p`: one byte for a
 * minimum match of 5, two for 6. The caller has checked `b[p .. p + 6)`.
 */
const lzavWord2 = (b: u8[], p: integer<0, 2147483639>, mref: i32): u32 =>
  mref === 5 ? toU32(uncheckedGet(b, p + 4)) : toU32(uncheckedGet(b, p + 4)) | (toU32(uncheckedGet(b, p + 5)) << 8)

/** The index in the `u32` hash table of the pair `(iw1, iw2)` hashes to; `hmask` keeps it 8-byte aligned and inside the table. */
const lzavHash = (iw1: u32, iw2: u32, hmask: u32): i32 =>
  toI32(((((iw2 ^ 0x85a308d3) * (iw1 ^ 0x243f6a88)) >> 12) & hmask) >> 2)

/**
 * How many bytes from `a` and from `b` agree, counting from `o` (the first
 * `o` are known to), at most `max`. `a + max` lies inside `src`, which the
 * caller has checked, and `b < a`.
 */
const lzavMatchLength = (src: u8[], a: i32, b: i32, max: i32, o: i32): i32 => {
  let k: i32 = o
  while (k + 8 <= max) {
    const pa: i32 = a + k
    const pb: i32 = b + k
    if (pa < 0 || pb < 0 || pa > 2147483639 || pb > 2147483639) {
      break
    }
    const x: u64 = lzavLoad64(src, pa) ^ lzavLoad64(src, pb)
    if (x !== toU64(0)) {
      return k + (lzavCtz64(x) >> 3)
    }
    k += 8
  }
  while (k < max && uncheckedGet(src, a + k) === uncheckedGet(src, b + k)) {
    k++
  }
  return k < max ? k : max
}

/**
 * How many bytes before `a` and before `b` agree, walking backward, at most
 * `max`; the byte just before each is known to. `b - max` and `a - max` lie
 * inside `src`.
 */
const lzavMatchBack = (src: u8[], a: i32, b: i32, max: i32): i32 => {
  let k: i32 = 1
  while (k < max && uncheckedGet(src, a - k - 1) === uncheckedGet(src, b - k - 1)) {
    k++
  }
  return k
}

/**
 * Writes `v - sv` as format 4's variable-length count from `out[op]` and
 * answers where it ends: one byte below 255, else 255 and a 16-bit word, or
 * 255 and two 16-bit words whose first has its top bit set.
 */
const lzavWriteVarint = (out: u8[], op: i32, v: i32, sv: i32): i32 => {
  if (v < 255 + sv) {
    out[op] = toU8(v - sv)
    return op + 1
  }
  const w: i32 = v - sv
  out[op] = 255
  if (w < 32768) {
    out[op + 1] = toU8(w)
    out[op + 2] = toU8(w >> 8)
    return op + 3
  }
  out[op + 1] = toU8(w)
  out[op + 2] = toU8(((w >> 8) & 0x7f) | 0x80)
  out[op + 3] = toU8(w >> 15)
  out[op + 4] = toU8(w >> 23)
  return op + 5
}

/**
 * The most bytes `compress` writes for `n` input bytes: about `n + n / 128 +
 * 32` (LZAV's `lzav_compress_bound`). `0` when that overflows an `i32`.
 */
export const lzavBound = (n: i32): i32 => {
  if (n <= 0) {
    return 32
  }
  let la: i32 = 0
  if (n < LZAV_MR5_THR) {
    const l2: i32 = n / 21
    la = ((n - l2 * 5 + 15) / 16) * 2 - l2 + 32
  } else {
    const k: i32 = 271
    const l2: i32 = n / (k + 6)
    la = ((n - l2 * 6 + k - 1) / k) * 3 - l2 + 32
  }
  return la > 2147483647 - n ? 0 : la + n
}

/** Panics unless `buf[off .. off + len)` is a window of `buf`. */
const lzavWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
    panic(`${what}: a window outside its array`)
  }
}

/**
 * For a block type `bt` (0 to 7), how many spare high bits its last offset
 * byte leaves for the next block's distance: `{0, 0, 2, 3, 0, 3, 5, 6}`,
 * three bits each in one word.
 */
const lzavCarryShift = (bt: i32): i32 => (LZAV_CARRY_SHIFTS >> ((bt & 7) * 3)) & 7

/**
 * For a reference of `bytes` offset bytes (1 to 3), the distance below which
 * its short variant, type `bytes + 4`, applies: 2^6, 2^12 or 2^19, the
 * exponents five bits each in one word.
 */
const lzavShortThreshold = (bytes: i32): i32 => toI32(1) << ((LZAV_MASK_WIDTHS_SHORT >> ((bytes & 3) * 5)) & 31)

/**
 * LZAV's compressor and its hash table, 1 MiB allocated once by the
 * constructor; `compress` allocates nothing. Not safe to share between
 * threads: build one per thread.
 */
export class LzavCompressor {
  /** (first word, position) pairs, as `u32`s: index `2k` and `2k + 1`. */
  private readonly ht: u32[]
  /** Where the latest reference block's last offset byte is, for the next block's carry bits. */
  private carryAt: i32
  /** How far the next distance shifts before its low bits are carried into `carryAt`. */
  private carryShift: i32

  constructor() {
    this.ht = new Array<u32>(LZAV_HT_MAX >> 2)
    this.carryAt = 0
    this.carryShift = 0
  }

  /**
   * Compresses `src[off .. off + len)` into `out` from `at` as one format-4
   * stream, and answers where it ends, or `LZAV_NO_ROOM` when `out` has
   * fewer than `lzavBound(len)` bytes after `at` (what upstream LZAV asks,
   * though the stream is usually shorter). An empty input writes nothing. A
   * window outside its array panics.
   */
  compress(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    lzavWindow("LzavCompressor.compress", src, off, len)
    lzavWindow("LzavCompressor.compress", out, at, 0)
    if (len === 0) {
      return at
    }
    const bound: i32 = lzavBound(len)
    if (bound === 0 || toI32(out.length) - at < bound) {
      return LZAV_NO_ROOM
    }
    const mref: i32 = len < LZAV_MR5_THR ? 5 : 6
    out[at] = toU8((LZAV_FMT << 4) | mref)
    if (len < 32) {
      return this.writeShort(src, off, len, out, at + 1)
    }
    return this.compressLong(src, off, len, out, at + 1, mref)
  }

  /** A whole input under 32 bytes: one literal block, padded with zeros to the 25 literals the format ends with. */
  private writeShort(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    let op: i32 = at
    if (len < 16) {
      out[op] = toU8(len)
      op++
    } else {
      out[op] = 0
      out[op + 1] = toU8(len - 16)
      op += 2
    }
    copyBytes(out, op, src, off, len)
    op += len
    for (let i: i32 = len; i < LZAV_LIT_FIN && op >= 0 && op < toI32(out.length); i++) {
      out[op] = 0
      op++
    }
    return op
  }

  /** `lzav_compress`'s scan, for an input of at least 32 bytes and an `out` with `lzavBound(len)` bytes of room. */
  private compressLong(src: u8[], off: i32, len: i32, out: u8[], at: i32, mref: i32): i32 {
    const ht: u32[] = this.ht
    const mref1: i32 = mref - 1
    let htsize: i32 = LZAV_HT_MIN
    while (htsize >> 2 < len && htsize < LZAV_HT_MAX) {
      htsize = htsize << 1
    }
    const hmask: u32 = toU32((htsize - 1) ^ 7)
    // Positions are absolute indices into `src`; every load below is at most
    // `ipe + 4 + 2 = off + len - 19`, inside the input.
    const ipe: i32 = off + len - LZAV_LIT_FIN
    const ipet: i32 = ipe - mref1
    const w0: u32 = lzavLoad32(src, off + 1)
    const slots: i32 = htsize >> 2
    for (let i: i32 = 0; i < slots && i + 1 < toI32(ht.length); i += 2) {
      uncheckedSet(ht, i, w0)
      uncheckedSet(ht, i + 1, toU32(off + 1))
    }
    this.carryAt = at - 1
    this.carryShift = 0
    let op: i32 = at
    let ipa: i32 = off
    let ip: i32 = off + 2
    // The running average, scaled by 2^11, of the match signal times the match length: it falls on misses and speeds the scan up.
    let mavg: i64 = toI64(LZAV_HT_MAX) * 100 / 8
    let iw1: u32 = 0
    let iw2: u32 = 0
    let hp: i32 = 0
    // The scan resumes from a hashed position (true) or from one the last match already hashed (false).
    let rehash: boolean = true
    while (true) {
      if (rehash) {
        // `ip >= 0` and the bound hold whenever `ip < ipet`; they are said for the prover.
        if (ip >= ipet || ip < 0 || ip > 2147483639) {
          break
        }
        iw1 = lzavLoad32(src, ip)
        iw2 = lzavWord2(src, ip, mref)
        hp = lzavHash(iw1, iw2, hmask)
      }
      rehash = true
      const ipo: i32 = ip
      if (iw1 === uncheckedGet(ht, hp)) {
        const wpo: i32 = toI32(uncheckedGet(ht, hp + 1))
        if (wpo >= 0 && wpo <= 2147483639 && iw2 === lzavWord2(src, wpo, mref)) {
          const d: i32 = ipo - wpo
          uncheckedSet(ht, hp + 1, toU32(d > 31 ? ipo : wpo))
          let rc: i32 = lzavMatchLength(src, ip, wpo, ipe - ip, mref)
          const ip1: i32 = ip + 1
          let lc: i32 = ip - ipa
          if (lc !== 0 && uncheckedGet(src, ip - 1) === uncheckedGet(src, wpo - 1)) {
            const back: i32 = lzavMatchBack(src, ip, wpo, lc < wpo - off ? lc : wpo - off)
            lc -= back
            rc += back
            ip -= back
          }
          if (d >= (LZAV_WIN_LEN << this.carryShift) << (lc !== 0 ? 2 : 0)) {
            ip = ip1
            continue
          }
          mavg -= mavg >> toI64(10)
          ip += rc
          const lit: i32 = ipa
          let pos: i32 = ipo
          for (let i: i32 = 0; i < 4; i++) {
            const q: i32 = ip1 + i
            if (q < 0 || q > 2147483639) {
              break
            }
            const w1: u32 = lzavLoad32(src, q)
            const w2: u32 = lzavWord2(src, q, mref)
            pos++
            const h: i32 = lzavHash(w1, w2, hmask)
            uncheckedSet(ht, h, w1)
            uncheckedSet(ht, h + 1, toU32(pos))
          }
          ipa = ip
          // Always true (`ip <= ipe`), said for the prover.
          if (ip >= 0 && ip <= 2147483639) {
            iw1 = lzavLoad32(src, ip)
            iw2 = lzavWord2(src, ip, mref)
          }
          mavg += toI64(rc) << toI64(7)
          hp = lzavHash(iw1, iw2, hmask)
          op = this.writeBlock(out, op, lc, rc, d, src, lit, mref1)
          if (ip < ipet) {
            rehash = false
            continue
          }
          break
        }
      }
      // No match here: remember this position, and skip ahead faster the longer matches stay rare.
      uncheckedSet(ht, hp, iw1)
      mavg -= mavg >> toI64(11)
      ip++
      uncheckedSet(ht, hp + 1, toU32(ipo))
      if (mavg < toI64(200) * 1024 && ipo !== ipa) {
        ip += toI32(1) + ((ipo - off) & 1) + (mavg < toI64(130) * 1024 ? toI32(1) : toI32(0))
        if (mavg < toI64(100) * 1024) {
          const adv: i32 = 100 - toI32(mavg >> toI64(10))
          ip += ipe - ip < adv ? 0 : adv
        }
      }
    }
    // The final literal block: everything after the last match, at least the 25 literals the format ends with.
    const lc: i32 = ipe - ipa + LZAV_LIT_FIN
    out[op] = 0
    op = lzavWriteVarint(out, op + 1, lc, 16)
    copyBytes(out, op, src, ipa, lc)
    return op + lc
  }

  /**
   * `lzav_write_blk_4`: `lc` literals from `src[lit ..)` if any, then a
   * reference of `rc` bytes at distance `d`, whose low bits ride in the
   * previous block's spare bits. Answers where the block ends.
   */
  private writeBlock(out: u8[], at: i32, lc: i32, rc: i32, d: i32, src: u8[], lit: i32, mref1: i32): i32 {
    let op: i32 = at
    let dist: i32 = d
    if (lc !== 0) {
      // A literal block carries the distance's two low bits in its header's top bits.
      const cv: i32 = (d << 6) & 0xff
      dist = d >> 2
      if (lc < 16) {
        out[op] = toU8(cv | lc)
        op++
      } else if (lc < 33) {
        out[op] = toU8(cv)
        out[op + 1] = toU8(lc - 16)
        op += 2
      } else {
        out[op] = toU8(cv)
        op = lzavWriteVarint(out, op + 1, lc, 16)
      }
      copyBytes(out, op, src, lit, lc)
      op += lc
    }
    const csh: i32 = this.carryShift
    const carried: i32 = (dist << (8 - csh)) & 0xff
    out[this.carryAt] = out[this.carryAt] | toU8(carried)
    const r: i32 = rc - mref1
    dist = dist >> csh
    let bt: i32 = toI32(1) + (dist >= 512 ? toI32(1) : toI32(0)) + (dist >= 32768 ? toI32(1) : toI32(0))
    const bytes: i32 = bt
    if (dist < lzavShortThreshold(bt)) {
      bt += 4
    }
    this.carryAt = op + bytes
    this.carryShift = lzavCarryShift(bt)
    const ov: i32 = (dist << 7) | (bt << 4) | (r < 16 ? r : 0)
    if (op >= 0 && op <= toI32(out.length) - 4) {
      // All four bytes at once: past `bytes + 1` they land where the rest of the stream (at least the final 26-byte block) overwrites them.
      const w: integer<0, 2147483639> = op
      uncheckedSet(out, w, toU8(ov))
      uncheckedSet(out, w + 1, toU8(ov >> 8))
      uncheckedSet(out, w + 2, toU8(ov >> 16))
      uncheckedSet(out, w + 3, toU8(ov >> 24))
    } else {
      for (let i: i32 = 0; i <= bytes; i++) {
        out[op + i] = toU8(ov >> (i * 8))
      }
    }
    if (r < 16) {
      return op + bytes + 1
    }
    return lzavWriteVarint(out, op + bytes + 1, r, 16)
  }
}

/** `LzavCompressor.compress`, building the compressor for this call alone. */
export const lzavCompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 =>
  new LzavCompressor().compress(src, off, len, out, at)

/**
 * For a block type `bt` (0 to 7), the mask of its distance bits in `bv << 9 |
 * bh << 1`: `{0, 0x1ff00, 0x7fff00, 0x3fffff00, 0, 0x3f00, 0xfff00, 0x7ffff00}`.
 */
const lzavOffsetMask = (bt: i32): u32 => {
  // Five bits of width per type: types 0 to 3 in the first word, 4 to 7 in the second.
  const w: i32 = ((bt < 4 ? LZAV_MASK_WIDTHS_LONG : LZAV_MASK_WIDTHS_SHORT) >> ((bt & 3) * 5)) & 31
  return ((toU32(1) << toU32(w)) - toU32(1)) << 8
}

/**
 * Decompresses the format-4 stream `src[off .. off + len)` into exactly `n`
 * bytes at `out[at ..)`, and answers `at + n`, or a negative `LZAV_ERR_*`
 * code; on an error, `out[at .. at + n)` holds whatever the stream wrote
 * before it. An empty stream decodes to `n === 0`. Writes nothing outside
 * `out[at .. at + n)` and reads nothing outside the stream. Panics only on a
 * window outside its array or a negative `n`. Allocates nothing.
 */
export const lzavDecompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, n: i32): i32 => {
  lzavWindow("lzavDecompress", src, off, len)
  if (n < 0) {
    panic("lzavDecompress: a negative length")
  }
  lzavWindow("lzavDecompress", out, at, n)
  if (len === 0 || n === 0) {
    return len === 0 && n === 0 ? at : LZAV_ERR_PARAMS
  }
  const prefix: i32 = toI32(src[off])
  if (prefix >> 4 !== LZAV_FMT) {
    return LZAV_ERR_FORMAT
  }
  if (len < 2 + LZAV_LIT_FIN) {
    return LZAV_ERR_TRUNCATED
  }
  const mref1: i32 = (prefix & 15) - 1
  if (mref1 < 0 || mref1 > 5) {
    return LZAV_ERR_FORMAT
  }
  const ipe: i32 = off + len
  // A block header is read only below `ipet`, so a header and the reference bytes after it (at most 9) never reach `ipe`.
  const ipet: i32 = ipe - LZAV_LIT_FIN
  const ope: i32 = at + n
  let ip: i32 = off + 1
  let op: i32 = at
  let cv: i32 = 0
  let csh: i32 = 8
  while (ip < ipet) {
    let bh: i32 = toI32(uncheckedGet(src, ip))
    if ((bh & 0x30) === 0) {
      // A literal block: its top two bits extend the next distance.
      cv = (cv << 2) | (bh >> 6)
      csh -= 2
      ip++
      let cc: i32 = bh & 15
      if (cc === 0) {
        cc = toI32(uncheckedGet(src, ip))
        ip++
        if (cc === 255) {
          let v: i32 = toI32(uncheckedGet(src, ip)) | (toI32(uncheckedGet(src, ip + 1)) << 8)
          ip += 2
          if ((v & 0x8000) !== 0) {
            v = (v & 0x7fff) | (toI32(uncheckedGet(src, ip)) << 15) | (toI32(uncheckedGet(src, ip + 1)) << 23)
            ip += 2
          }
          cc = v
        }
        if (cc > ipe - ip - 16) {
          return LZAV_ERR_TRUNCATED
        }
        cc += 16
      }
      if (cc > ipe - ip) {
        return LZAV_ERR_TRUNCATED
      }
      if (cc > ope - op) {
        return LZAV_ERR_OUTPUT
      }
      if (cc <= 16 && ope - op >= 16 && ipe - ip >= 16 && op >= 0 && ip >= 0 && op <= 2147483631 && ip <= 2147483631) {
        lzavStore64(out, op, lzavLoad64(src, ip))
        const o8: i32 = op + 8
        const i8: i32 = ip + 8
        lzavStore64(out, o8, lzavLoad64(src, i8))
      } else {
        copyBytes(out, op, src, ip, cc)
      }
      op += cc
      ip += cc
      if (ip >= ipet) {
        break
      }
      // A reference block always follows a literal block, whatever its type bits say.
      bh = toI32(uncheckedGet(src, ip))
    }
    // A reference block: `ip < ipet`, so its at most 9 bytes lie inside the stream.
    ip++
    const bt: i32 = (bh >> 4) & 7
    if (ip < 0 || ip > 2147483639) {
      // Never: `ip < ipet`. Said for the prover.
      return LZAV_ERR_TRUNCATED
    }
    const bv: u32 = lzavLoad32(src, ip)
    let d: i32 = toI32((((bv << 9) | toU32(bh << 1)) & lzavOffsetMask(bt)) >> toU32(csh))
    csh = 8 - lzavCarryShift(bt)
    const nb: i32 = bt & 3
    d = d | cv
    cv = toI32(uncheckedGet(src, ip + nb - 1)) >> csh
    ip += nb
    let cc: i32 = bh & 15
    if (cc !== 0) {
      cc += mref1
    } else {
      cc = toI32(uncheckedGet(src, ip))
      ip++
      if (cc === 255) {
        let v: i32 = toI32(uncheckedGet(src, ip)) | (toI32(uncheckedGet(src, ip + 1)) << 8)
        ip += 2
        if ((v & 0x8000) !== 0) {
          v = (v & 0x7fff) | (toI32(uncheckedGet(src, ip)) << 15) | (toI32(uncheckedGet(src, ip + 1)) << 23)
          ip += 2
        }
        cc = v
      }
      if (cc > LZAV_COUNT_MAX) {
        return LZAV_ERR_OUTPUT
      }
      cc += mref1 + 16
    }
    if (d > op - at || d === 0) {
      return LZAV_ERR_DISTANCE
    }
    if (cc > ope - op) {
      return LZAV_ERR_OUTPUT
    }
    let from: i32 = op - d
    const end: i32 = op + cc
    if (d >= 8 && ope - end >= 8) {
      // Whole words past `end` while there is room: the spill lands in output not yet written, which later blocks overwrite.
      // The index bounds always hold; they are said for the prover, and the byte loop finishes if they ever did not.
      while (op < end && op >= 0 && from >= 0 && op <= 2147483639 && from <= 2147483639) {
        lzavStore64(out, op, lzavLoad64(out, from))
        op += 8
        from += 8
      }
      if (op > end) {
        op = end
      }
    } else if (d >= 8) {
      while (op + 8 <= end && op >= 0 && from >= 0 && op <= 2147483639 && from <= 2147483639) {
        lzavStore64(out, op, lzavLoad64(out, from))
        op += 8
        from += 8
      }
    }
    while (op < end) {
      uncheckedSet(out, op, uncheckedGet(out, from))
      op++
      from++
    }
  }
  if (op !== ope) {
    return LZAV_ERR_LENGTH
  }
  return ope
}
