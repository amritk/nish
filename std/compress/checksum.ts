/**
 * `nish/compress/checksum` — the two checksums the compressed formats carry:
 * CRC-32 (ISO 3309, the polynomial gzip's trailer uses, RFC 1952 §8) and
 * Adler-32 (zlib's trailer, RFC 1950 §9).
 *
 *     import { Crc32 } from "nish/compress/checksum";
 *
 *     const crc = new Crc32(); // the tables, once
 *     let c: u32 = crc.update(toU32(0), body, 0, 100);
 *     c = crc.update(c, body, 100, toI32(body.length) - 100); // the same as one call
 *
 * A module has no global state, so CRC-32's tables live in a `Crc32` object:
 * build one and keep it, because building it is 4,096 table entries (about
 * ten microseconds) and an update of a 5 KB body is under one. `crc32`
 * is the one-off convenience that builds a table for one call.
 *
 * CRC-32 is slicing-by-8: eight 256-entry tables, eight bytes per step with
 * one table read per byte and no dependency between the reads of a step
 * (Kounavis and Berry, "A Systematic Approach to Building High Performance
 * Software-based CRC Generators", 2005). From 80 bytes on it is also braided
 * five ways (Kadatch and Jenkins, 2010), so five steps are in flight at once;
 * the braids have a second set of eight tables. Adler-32 defers its two modulo
 * reductions to once every 5,552 bytes, the most that cannot overflow 32 bits
 * (RFC 1950 §9 and zlib's `NMAX`).
 *
 * Neither is a cryptographic hash: both detect accidental corruption only.
 * Written from the specifications, not ported from another implementation.
 *
 * The table reads in `update` are `nish:unsafe`'s `uncheckedGet`: every index
 * is a byte plus a multiple of 256 below 2,048, and both tables are built here
 * at exactly that length and never replaced, which is the whole proof. The input
 * window is checked once, before the loop.
 */
import { uncheckedGet, uncheckedSet } from "nish:unsafe"

/** The reflected CRC-32 polynomial, x^32 + x^26 + ... + 1 (RFC 1952 §8). */
const CRC32_POLY: i64 = 0xedb88320

/** The entries of the eight slicing tables, 256 each. */
const CRC32_TABLE_SIZE: i32 = 2048

/**
 * The braids `Crc32.update` runs at once over a long input, each over every
 * fifth 8-byte word, and the bytes a block of one word per braid spans.
 */
const CRC32_BRAIDS: i32 = 5
const CRC32_BLOCK: i32 = 40

/** The shortest input `Crc32.update` braids: two blocks, one braided and the last joined. */
const CRC32_BRAID_MIN: i32 = 80

/** zlib's `NMAX`: the most bytes Adler-32's sums take before they must be reduced. */
const ADLER32_NMAX: i32 = 5552

/** The Adler-32 modulus, the largest prime below 2^16 (RFC 1950 §9). */
const ADLER32_BASE: i32 = 65521

/**
 * The little-endian 64-bit word at `buf[p .. p + 8)`, which the caller has
 * checked. `p`'s range makes each `p + k` an `add nsw`, which lets LLVM load
 * the word at once.
 */
const checksumLoad64 = (buf: u8[], p: integer<0, 2147483639>): u64 =>
  toU64(uncheckedGet(buf, p)) |
  (toU64(uncheckedGet(buf, p + 1)) << toU64(8)) |
  (toU64(uncheckedGet(buf, p + 2)) << toU64(16)) |
  (toU64(uncheckedGet(buf, p + 3)) << toU64(24)) |
  (toU64(uncheckedGet(buf, p + 4)) << toU64(32)) |
  (toU64(uncheckedGet(buf, p + 5)) << toU64(40)) |
  (toU64(uncheckedGet(buf, p + 6)) << toU64(48)) |
  (toU64(uncheckedGet(buf, p + 7)) << toU64(56))

/**
 * One slicing-by-8 step: the register `c` advanced over the eight bytes of
 * `w`. `t` is the 2,048-entry table, which every caller has checked.
 */
const crc32Step = (t: u32[], c: u32, w: u64): u32 => {
  const lo: u32 = c ^ toU32(w)
  const hi: u32 = toU32(w >> toU64(32))
  return (
    uncheckedGet(t, 1792 + toI32(lo & 255)) ^
    uncheckedGet(t, 1536 + toI32((lo >>> 8) & 255)) ^
    uncheckedGet(t, 1280 + toI32((lo >>> 16) & 255)) ^
    uncheckedGet(t, 1024 + toI32(lo >>> 24)) ^
    uncheckedGet(t, 768 + toI32(hi & 255)) ^
    uncheckedGet(t, 512 + toI32((hi >>> 8) & 255)) ^
    uncheckedGet(t, 256 + toI32((hi >>> 16) & 255)) ^
    uncheckedGet(t, toI32(hi >>> 24))
  )
}

/** Panics unless `buf[off .. off + len)` lies inside `buf`. */
const checksumWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
    panic(`${what}: the window lies outside its array`)
  }
}

/**
 * CRC-32's lookup tables, built once and read by every `update`. The object
 * holds nothing else, so one may be shared by every compressor and reader in
 * a thread, and by threads that only read it.
 */
export class Crc32 {
  /** `table[k * 256 + b]`: the CRC of byte `b` followed by `k` zero bytes. */
  readonly table: u32[]
  /**
   * `braid[k * 256 + b]`: the same, followed by the 32 bytes of the other
   * four braids' words as well, which a braid steps over.
   */
  readonly braid: u32[]

  /** Builds the eight tables and their braided form. */
  constructor() {
    const t: u32[] = new Array<u32>(CRC32_TABLE_SIZE)
    for (let i: i32 = 0; i < 256; i += 1) {
      let c: u32 = toU32(i)
      for (let k: i32 = 0; k < 8; k += 1) {
        c = (c & 1) !== 0 ? toU32(CRC32_POLY) ^ (c >>> 1) : c >>> 1
      }
      uncheckedSet(t, i, c)
    }
    for (let i: i32 = 256; i < CRC32_TABLE_SIZE; i += 1) {
      const prev: u32 = uncheckedGet(t, i - 256)
      uncheckedSet(t, i, (prev >>> 8) ^ uncheckedGet(t, toI32(prev & 255)))
    }
    this.table = t
    // A register is linear in its bytes, so each braided table is its eight
    // one-bit entries, stepped over the 32 bytes, and XORs of them.
    const braid: u32[] = new Array<u32>(CRC32_TABLE_SIZE)
    const bits: u32[] = new Array<u32>(8)
    for (let k: i32 = 0; k < 8; k += 1) {
      for (let i: i32 = 0; i < 8; i += 1) {
        let c: u32 = uncheckedGet(t, k * 256 + (toI32(1) << i))
        for (let z: i32 = 0; z < (CRC32_BRAIDS - 1) * 8; z += 1) {
          c = (c >>> 8) ^ uncheckedGet(t, toI32(c & 255))
        }
        bits[i] = c
      }
      uncheckedSet(braid, k * 256, toU32(0))
      for (let b: i32 = 1; b < 256; b += 1) {
        const low: i32 = 31 - toI32(Math.clz32(toU32(b & -b)))
        if (low >= 0 && low < 8) {
          uncheckedSet(braid, k * 256 + b, uncheckedGet(braid, k * 256 + (b & (b - 1))) ^ bits[low])
        }
      }
    }
    this.braid = braid
  }

  /**
   * The CRC-32 of the bytes `crc` was the CRC of, followed by
   * `buf[off .. off + len)`. Start a new checksum from 0. A window outside
   * `buf` panics.
   */
  update(crc: u32, buf: u8[], off: i32, len: i32): u32 {
    checksumWindow("Crc32.update", buf, off, len)
    const t: u32[] = this.table
    const bt: u32[] = this.braid
    if (toI32(t.length) !== CRC32_TABLE_SIZE || toI32(bt.length) !== CRC32_TABLE_SIZE) {
      panic("Crc32.update: the table is not its size")
    }
    let c: u32 = ~crc
    let p: i32 = off
    const end: i32 = off + len
    if (len >= CRC32_BRAID_MIN) {
      // Braided (Kadatch and Jenkins, "Everything we know about CRC but
      // afraid to forget", 2010): five chains, each over every fifth 8-byte
      // word, so a step's table reads overlap the other four's instead of
      // waiting on its own last. A braid's table also steps it over the
      // other braids' 32 bytes, so before each block every register sits at
      // its own word's place. The last block is taken one word at a time
      // with the plain table, each braid's register joining as its word
      // comes, which adds them into one.
      const blocks: i32 = len / CRC32_BLOCK
      const lastBlock: i32 = off + (blocks - 1) * CRC32_BLOCK
      let c1: u32 = 0
      let c2: u32 = 0
      let c3: u32 = 0
      let c4: u32 = 0
      // Each word's position is a local the loop condition bounds, which
      // is what lets it enter the loader's range without a check.
      let p1: i32 = p + 8
      let p2: i32 = p + 16
      let p3: i32 = p + 24
      let p4: i32 = p + 32
      while (
        p < lastBlock &&
        p >= 0 &&
        p1 >= 0 &&
        p2 >= 0 &&
        p3 >= 0 &&
        p4 >= 0 &&
        p4 <= 2147483639 &&
        p3 <= 2147483639 &&
        p2 <= 2147483639 &&
        p1 <= 2147483639 &&
        p <= 2147483639
      ) {
        c = crc32Step(bt, c, checksumLoad64(buf, p))
        c1 = crc32Step(bt, c1, checksumLoad64(buf, p1))
        c2 = crc32Step(bt, c2, checksumLoad64(buf, p2))
        c3 = crc32Step(bt, c3, checksumLoad64(buf, p3))
        c4 = crc32Step(bt, c4, checksumLoad64(buf, p4))
        p += CRC32_BLOCK
        p1 += CRC32_BLOCK
        p2 += CRC32_BLOCK
        p3 += CRC32_BLOCK
        p4 += CRC32_BLOCK
      }
      if (
        p >= 0 &&
        p1 >= 0 &&
        p2 >= 0 &&
        p3 >= 0 &&
        p4 >= 0 &&
        p4 <= 2147483639 &&
        p3 <= 2147483639 &&
        p2 <= 2147483639 &&
        p1 <= 2147483639 &&
        p <= 2147483639
      ) {
        c = crc32Step(t, c, checksumLoad64(buf, p))
        c = crc32Step(t, c ^ c1, checksumLoad64(buf, p1))
        c = crc32Step(t, c ^ c2, checksumLoad64(buf, p2))
        c = crc32Step(t, c ^ c3, checksumLoad64(buf, p3))
        c = crc32Step(t, c ^ c4, checksumLoad64(buf, p4))
        p += CRC32_BLOCK
      }
    }
    const whole: i32 = end - (len & 7)
    while (p < whole && p >= 0 && p <= 2147483639) {
      c = crc32Step(t, c, checksumLoad64(buf, p))
      p += 8
    }
    while (p < end) {
      c = uncheckedGet(t, toI32((c ^ toU32(uncheckedGet(buf, p))) & 255)) ^ (c >>> 8)
      p += 1
    }
    return ~c
  }
}

/**
 * The CRC-32 of `buf[off .. off + len)`. It builds a `Crc32` for the one
 * call, which costs about as much as checksumming 5 KB: keep a `Crc32` for
 * anything repeated. A window outside `buf` panics.
 */
export const crc32 = (buf: u8[], off: i32, len: i32): u32 => new Crc32().update(toU32(0), buf, off, len)

/**
 * The Adler-32 of the bytes `adler` was the Adler-32 of, followed by
 * `buf[off .. off + len)` (RFC 1950 §9). Start a new checksum from 1. A
 * window outside `buf` panics.
 */
export const adler32Update = (adler: u32, buf: u8[], off: i32, len: i32): u32 => {
  checksumWindow("adler32Update", buf, off, len)
  let s1: u32 = adler & 0xffff
  let s2: u32 = adler >>> 16
  let p: i32 = off
  const end: i32 = off + len
  while (p < end) {
    let stop: i32 = p + ADLER32_NMAX
    if (stop > end) {
      stop = end
    }
    while (p + 4 <= stop) {
      s1 += toU32(uncheckedGet(buf, p))
      s2 += s1
      s1 += toU32(uncheckedGet(buf, p + 1))
      s2 += s1
      s1 += toU32(uncheckedGet(buf, p + 2))
      s2 += s1
      s1 += toU32(uncheckedGet(buf, p + 3))
      s2 += s1
      p += 4
    }
    while (p < stop) {
      s1 += toU32(uncheckedGet(buf, p))
      s2 += s1
      p += 1
    }
    s1 = s1 % toU32(ADLER32_BASE)
    s2 = s2 % toU32(ADLER32_BASE)
  }
  return (s2 << 16) | s1
}

/** The Adler-32 of `buf[off .. off + len)`. A window outside `buf` panics. */
export const adler32 = (buf: u8[], off: i32, len: i32): u32 => adler32Update(toU32(1), buf, off, len)
