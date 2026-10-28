/**
 * `nish/compress/zlib` — the zlib format (RFC 1950) around
 * `nish/compress/deflate`: a two-byte header, the DEFLATE stream and the
 * Adler-32 of the data, big-endian. What HTTP's `Content-Encoding: deflate`
 * means (RFC 9110 §8.4.1.2), and what PNG and many protocols carry.
 *
 *     import { DEFLATE_DEFAULT } from "nish/compress/deflate";
 *     import { ZlibCompressor, ZlibDecompressor } from "nish/compress/zlib";
 *
 *     const z = new ZlibCompressor(DEFLATE_DEFAULT);
 *     const end: i32 = z.compress(src, 0, n, out, 0); // -1: no room
 *     const got: i32 = new ZlibDecompressor().decompress(out, 0, end, back, 0, n); // < 0: an error
 *
 * The objects allocate their tables once and nothing per call; the free
 * functions build one for a single call. The header written is `0x78` and
 * the `FLEVEL` of the level, with no preset dictionary. Reading refuses a
 * method other than 8, a window over 32 KB, a header whose check fails
 * (`ZLIB_ERR_HEADER`) and a preset dictionary (`ZLIB_ERR_DICTIONARY`, since
 * none can be supplied); a wrong Adler-32 is `ZLIB_ERR_ADLER`, and bytes
 * after the trailer are `DEFLATE_ERR_TRAILING`.
 *
 * Written from RFC 1950.
 */
import { adler32 } from "nish/compress/checksum"
import {
  DEFLATE_ERR_OUTPUT_LIMIT,
  DEFLATE_ERR_TRAILING,
  DEFLATE_ERR_TRUNCATED,
  DEFLATE_NO_ROOM,
  Deflater,
  INFLATE_DONE,
  INFLATE_NEED_OUTPUT,
  Inflater,
} from "nish/compress/deflate"

/** A zlib header that is not one: the wrong method, a window over 32 KB, or a failed check. */
export const ZLIB_ERR_HEADER: i32 = -12

/** The trailer's Adler-32 is not the Adler-32 of the data. */
export const ZLIB_ERR_ADLER: i32 = -13

/** The stream needs a preset dictionary (`FDICT`), which this reader has no way to be given. */
export const ZLIB_ERR_DICTIONARY: i32 = -14

/** Panics unless `buf[off .. off + len)` lies inside `buf`. */
const zlibWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${toI32(buf.length)} bytes`)
  }
}

/** A zlib compressor at one level, allocated once. Not shared between threads. */
export class ZlibCompressor {
  readonly deflater: Deflater

  /** A compressor at `level`, 0 to 9; another level panics. */
  constructor(level: i32) {
    this.deflater = new Deflater(level)
  }

  /**
   * Compresses `src[off .. off + len)` into `out` from `at` as one zlib
   * stream and answers where it ends, or `DEFLATE_NO_ROOM` (-1) when `out`
   * cannot hold it; `compressBound(len)` bytes always can. A window outside
   * its array panics. Allocates nothing.
   */
  compress(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    zlibWindow("ZlibCompressor.compress", src, off, len)
    zlibWindow("ZlibCompressor.compress", out, at, 0)
    if (toI32(out.length) - at < 6) {
      return DEFLATE_NO_ROOM
    }
    const level: i32 = this.deflater.level
    // FLEVEL (§2.2): fastest, fast, default, slowest.
    let flevel: i32 = 3
    if (level < 2) {
      flevel = 0
    } else if (level < 6) {
      flevel = 1
    } else if (level === 6) {
      flevel = 2
    }
    const cmf: i32 = 0x78
    let flg: i32 = flevel << 6
    flg += (31 - ((cmf * 256 + flg) % 31)) % 31
    out[at] = toU8(cmf)
    out[at + 1] = toU8(flg)
    const end: i32 = this.deflater.compress(src, off, len, out, at + 2)
    if (end < 0 || toI32(out.length) - end < 4) {
      return DEFLATE_NO_ROOM
    }
    const a: u32 = adler32(src, off, len)
    out[end] = toU8(a >>> 24)
    out[end + 1] = toU8((a >>> 16) & 255)
    out[end + 2] = toU8((a >>> 8) & 255)
    out[end + 3] = toU8(a & 255)
    return end + 4
  }
}

/** A zlib decompressor, allocated once. Not shared between threads. */
export class ZlibDecompressor {
  readonly inflater: Inflater

  /** Builds the tables. */
  constructor() {
    this.inflater = new Inflater()
  }

  /**
   * Decompresses the zlib stream `src[off .. off + len)` into `out` from
   * `at`, writing at most `limit` bytes and never past `out`'s end, and
   * answers where the output ends, or a negative `ZLIB_ERR_*` or
   * `DEFLATE_ERR_*`. A window outside its array, or a negative `limit`,
   * panics. Allocates nothing.
   */
  decompress(src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 {
    zlibWindow("ZlibDecompressor.decompress", src, off, len)
    zlibWindow("ZlibDecompressor.decompress", out, at, 0)
    if (limit < 0) {
      panic("ZlibDecompressor.decompress: a negative limit")
    }
    if (len < 2) {
      return DEFLATE_ERR_TRUNCATED
    }
    const cmf: i32 = toI32(src[off])
    const flg: i32 = toI32(src[off + 1])
    if ((cmf & 15) !== 8 || cmf >> 4 > 7 || (cmf * 256 + flg) % 31 !== 0) {
      return ZLIB_ERR_HEADER
    }
    if ((flg & 0x20) !== 0) {
      return ZLIB_ERR_DICTIONARY
    }
    const room: i32 = toI32(out.length) - at
    const outEnd: i32 = at + (limit < room ? limit : room)
    const inf: Inflater = this.inflater
    inf.reset()
    const end: i32 = off + len
    const r: i32 = inf.inflate(src, off + 2, end, false, out, at, outEnd, at)
    if (r === INFLATE_NEED_OUTPUT) {
      return DEFLATE_ERR_OUTPUT_LIMIT
    }
    if (r !== INFLATE_DONE) {
      return r
    }
    const q: i32 = inf.inPos
    if (end - q < 4) {
      return DEFLATE_ERR_TRUNCATED
    }
    const want: u32 =
      (toU32(src[q]) << 24) | (toU32(src[q + 1]) << 16) | (toU32(src[q + 2]) << 8) | toU32(src[q + 3])
    if (adler32(out, at, inf.outPos - at) !== want) {
      return ZLIB_ERR_ADLER
    }
    if (q + 4 !== end) {
      return DEFLATE_ERR_TRAILING
    }
    return inf.outPos
  }
}

/** `ZlibCompressor.compress` at `level`, building the compressor for this call alone. */
export const zlibCompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, level: i32): i32 =>
  new ZlibCompressor(level).compress(src, off, len, out, at)

/** `ZlibDecompressor.decompress`, building the decompressor for this call alone. */
export const zlibDecompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 =>
  new ZlibDecompressor().decompress(src, off, len, out, at, limit)
