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
 * **Allocated once.** The objects allocate their tables once and nothing per
 * call; the free functions build one for a single call.
 *
 * **What is written and what is refused.** The header written is `0x78` and
 * the `FLEVEL` of the level, with no preset dictionary. Reading refuses a
 * method other than 8, a window over 32 KB, a header whose check fails
 * (`ZLIB_ERR_HEADER`) and a preset dictionary (`ZLIB_ERR_DICTIONARY`, since
 * none can be supplied); a wrong Adler-32 is `ZLIB_ERR_ADLER`, and bytes
 * after the trailer are `DEFLATE_ERR_TRAILING`.
 *
 * Written from RFC 1950.
 */
import { adler32, adler32Range } from "nish/compress/checksum"
import {
  DEFLATE_ERR_OUTPUT_LIMIT,
  DEFLATE_ERR_TRAILING,
  DEFLATE_ERR_TRUNCATED,
  DEFLATE_ERR_WINDOW,
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
  private readonly deflater: Deflater

  /**
   * A compressor at `level`, 0 to 9; another level panics.
   *
   * @param level How hard to compress, `DEFLATE_STORE` (0) to
   *   `DEFLATE_BEST` (9); it also picks the header's `FLEVEL`.
   */
  constructor(level: i32) {
    this.deflater = new Deflater(level)
  }

  /**
   * Compresses `src[off .. off + len)` into `out` from `at` as one zlib
   * stream and answers where it ends, or `DEFLATE_NO_ROOM` (-1) when `out`
   * cannot hold it; `compressBound(len)` bytes always can. A window outside
   * its array panics. Allocates nothing.
   *
   * @param src The array that holds the data to compress.
   * @param off Where in `src` the data starts.
   * @param len How many bytes of data to compress.
   * @param out The caller's array the stream is written into.
   * @param at Where in `out` the stream starts.
   * @returns The index in `out` one past the stream's last byte, so the
   *   stream is `out[at .. result)`; or `DEFLATE_NO_ROOM`, after which the
   *   bytes of `out` from `at` may have been overwritten and mean nothing.
   */
  compress(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    zlibWindow("ZlibCompressor.compress", src, off, len)
    zlibWindow("ZlibCompressor.compress", out, at, 0)
    // The header's two bytes, and room for at least the trailer's four
    // after them. Positions are added in i64: the window was checked in
    // `zlibWindow`, but the prover does not carry that across the call.
    const n: i32 = toI32(out.length)
    const second: i32 = toI32(toI64(at) + 1)
    if (at < 0 || at >= n || second < 0 || second >= n || toI64(n) - toI64(at) < 6) {
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
    // FLEVEL is two bits, so the mask changes nothing and bounds `flg`;
    // FCHECK makes `cmf * 256 + flg` (0x7800 + flg) a multiple of 31.
    let flg: i32 = (flevel & 3) * 64
    flg += (toI32(31) - ((0x7800 + flg) % 31)) % 31
    out[at] = toU8(cmf)
    out[second] = toU8(flg)
    const end: i32 = this.deflater.compress(src, off, len, out, toI32(toI64(at) + 2))
    // A trailer that cannot fit is refused before the input is checksummed.
    if (end < 0 || toI64(end) + 4 > toI64(out.length)) {
      return DEFLATE_NO_ROOM
    }
    // `out`'s length is read again after the checksum for the trailer's
    // stores: the prover forgets an array's length across a call.
    const a: u32 = adler32(src, off, len)
    const e1: i32 = toI32(toI64(end) + 1)
    const e2: i32 = toI32(toI64(end) + 2)
    const e3: i32 = toI32(toI64(end) + 3)
    const m: i32 = toI32(out.length)
    if (end < 0 || end >= m || e1 < 0 || e1 >= m || e2 < 0 || e2 >= m || e3 < 0 || e3 >= m) {
      return DEFLATE_NO_ROOM
    }
    out[end] = toU8(a >>> 24)
    out[e1] = toU8((a >>> 16) & 255)
    out[e2] = toU8((a >>> 8) & 255)
    out[e3] = toU8(a & 255)
    return toI32(toI64(end) + 4)
  }
}

/** A zlib decompressor, allocated once. Not shared between threads. */
export class ZlibDecompressor {
  private readonly inflater: Inflater

  /** Builds the tables. */
  constructor() {
    this.inflater = new Inflater()
  }

  /**
   * Decompresses the zlib stream `src[off .. off + len)` into `out` from
   * `at`, writing at most `limit` bytes and never past `out`'s end, and
   * answers where the output ends, or a negative `ZLIB_ERR_*` or
   * `DEFLATE_ERR_*`. A window outside its array, or a negative `limit`,
   * panics: `decompressRange` answers those instead. Allocates nothing.
   *
   * @param src The array that holds the zlib stream.
   * @param off Where in `src` the stream starts.
   * @param len How many bytes the stream is; every one must belong to it,
   *   since a byte after the trailer is `DEFLATE_ERR_TRAILING`.
   * @param out The caller's array the data is written into.
   * @param at Where in `out` the data starts.
   * @param limit The most bytes of data to accept; a longer stream is
   *   `DEFLATE_ERR_OUTPUT_LIMIT`, as is one that reaches the end of `out`.
   * @returns The index in `out` one past the data's last byte, so the data
   *   is `out[at .. result)`; or a negative code: `DEFLATE_ERR_TRUNCATED`
   *   (the input ends inside the stream), `ZLIB_ERR_HEADER`,
   *   `ZLIB_ERR_DICTIONARY`, `ZLIB_ERR_ADLER`, `DEFLATE_ERR_TRAILING`,
   *   `DEFLATE_ERR_OUTPUT_LIMIT` or another `DEFLATE_ERR_*`. After an error
   *   the bytes of `out` from `at` may have been overwritten and mean
   *   nothing.
   */
  decompress(src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 {
    // One test for every argument, so the call's misuse is one panic site.
    if (off < 0 || len < 0 || off > toI32(src.length) - len || at < 0 || at > toI32(out.length) || limit < 0) {
      panic("ZlibDecompressor.decompress: a window outside its array, or a negative limit")
    }
    return this.decompressRange(src, off, toI32(toI64(off) + toI64(len)), out, at, limit)
  }

  /**
   * `decompress` over `src[off .. end)`, a range given by its two ends, that
   * answers a misuse rather than panicking: a range outside `src`, an output
   * start outside `out` or a negative `limit` is `DEFLATE_ERR_WINDOW`, with
   * nothing read or written. `nish/net/http-compress`'s decoder calls this
   * one, so a body it decodes reaches no panic.
   *
   * @internal Called by std/net/http-compress.ts's body decoder.
   * @param src The array that holds the zlib stream.
   * @param off Where in `src` the stream starts.
   * @param end One past the stream's last byte.
   * @param out The caller's array the data is written into.
   * @param at Where in `out` the data starts.
   * @param limit The most bytes of data to accept.
   * @returns The index in `out` one past the data's last byte, or a negative
   *   code, as `decompress` answers; or `DEFLATE_ERR_WINDOW`.
   */
  decompressRange(src: u8[], off: i32, end: i32, out: u8[], at: i32, limit: i32): i32 {
    if (off < 0 || off > end || end > toI32(src.length) || at < 0 || at > toI32(out.length) || limit < 0) {
      return DEFLATE_ERR_WINDOW
    }
    const n: i32 = toI32(src.length)
    // Taken in 64 bits: `off` is at most the input's end, but the prover
    // cannot see that `off + 2` stays in range from the test below.
    const second: i32 = toI32(toI64(off) + 1)
    const start: i32 = toI32(toI64(off) + 2)
    if (end - off < 2 || off >= n || second < 0 || second >= n) {
      return DEFLATE_ERR_TRUNCATED
    }
    const cmf: i32 = toI32(src[off])
    const flg: i32 = toI32(src[second])
    if ((cmf & 15) !== 8 || cmf >> 4 > 7 || (cmf * 256 + flg) % 31 !== 0) {
      return ZLIB_ERR_HEADER
    }
    if ((flg & 0x20) !== 0) {
      return ZLIB_ERR_DICTIONARY
    }
    let outEnd: i32 = toI32(out.length)
    if (toI64(limit) < toI64(outEnd) - toI64(at)) {
      outEnd = toI32(toI64(at) + toI64(limit))
    }
    const inf: Inflater = this.inflater
    inf.reset()
    const r: i32 = inf.inflateAll(src, start, end, out, at, outEnd)
    if (r === INFLATE_NEED_OUTPUT) {
      return DEFLATE_ERR_OUTPUT_LIMIT
    }
    if (r !== INFLATE_DONE) {
      return r
    }
    const q: i32 = inf.inPos
    const q1: i32 = toI32(toI64(q) + 1)
    const q2: i32 = toI32(toI64(q) + 2)
    const q3: i32 = toI32(toI64(q) + 3)
    if (
      toI64(end) - toI64(q) < 4 ||
      q < 0 ||
      q >= n ||
      q1 < 0 ||
      q1 >= n ||
      q2 < 0 ||
      q2 >= n ||
      q3 < 0 ||
      q3 >= n
    ) {
      return DEFLATE_ERR_TRUNCATED
    }
    const want: u32 = (toU32(src[q]) << 24) | (toU32(src[q1]) << 16) | (toU32(src[q2]) << 8) | toU32(src[q3])
    const outPos: i32 = inf.outPos
    // `inflateAll` wrote `out[at .. outPos)`, so `adler32Range` answers no -1.
    const got: i64 = adler32Range(out, at, outPos)
    if (got < 0) {
      return DEFLATE_ERR_WINDOW
    }
    if (got !== toI64(want)) {
      return ZLIB_ERR_ADLER
    }
    if (toI64(q) + 4 !== toI64(end)) {
      return DEFLATE_ERR_TRAILING
    }
    return outPos
  }
}

/**
 * `ZlibCompressor.compress` at `level`, building the compressor for this call
 * alone.
 *
 * @param src The array that holds the data to compress.
 * @param off Where in `src` the data starts.
 * @param len How many bytes of data.
 * @param out The caller's array the stream is written into.
 * @param at Where in `out` the stream starts.
 * @param level How hard to compress, 0 to 9; another level panics.
 * @returns The index in `out` one past the stream's last byte, or
 *   `DEFLATE_NO_ROOM`, as `ZlibCompressor.compress` answers.
 */
export const zlibCompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, level: i32): i32 =>
  new ZlibCompressor(level).compress(src, off, len, out, at)

/**
 * `ZlibDecompressor.decompress`, building the decompressor for this call
 * alone.
 *
 * @param src The array that holds the zlib stream.
 * @param off Where in `src` the stream starts.
 * @param len How many bytes the stream is, trailer included.
 * @param out The caller's array the data is written into.
 * @param at Where in `out` the data starts.
 * @param limit The most bytes of data to accept.
 * @returns The index in `out` one past the data's last byte, or a negative
 *   code, as `ZlibDecompressor.decompress` answers.
 */
export const zlibDecompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 =>
  new ZlibDecompressor().decompress(src, off, len, out, at, limit)
