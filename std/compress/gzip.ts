/**
 * `nish/compress/gzip` — the gzip file format (RFC 1952) around
 * `nish/compress/deflate`: a ten-byte header, the DEFLATE stream, and a
 * trailer of the CRC-32 and the length of the data mod 2^32. What an HTTP
 * `Content-Encoding: gzip` body is.
 *
 *     import { DEFLATE_FAST, compressBound } from "nish/compress/deflate";
 *     import { GzipCompressor, GzipDecompressor } from "nish/compress/gzip";
 *
 *     const gz = new GzipCompressor(DEFLATE_FAST); // once per thread
 *     const out: u8[] = new Array<u8>(compressBound(8192)); // once
 *     const end: i32 = gz.compress(body, 0, n, out, 0); // -1: no room
 *
 *     const gunzip = new GzipDecompressor();
 *     const got: i32 = gunzip.decompress(src, 0, len, back, 0, 1 << 20); // < 0: an error
 *
 * **One shot.** `GzipCompressor` and `GzipDecompressor` own every table a
 * call needs and allocate nothing per call; `gzipCompress` and
 * `gzipDecompress` build one for a single call. The header written carries no
 * name, no comment and a zero modification time, `XFL` 4 at level 1 and 2 at
 * 9, and `OS` 255 ("unknown"), so the same input gives the same bytes on
 * every machine.
 *
 * **Reading is strict.** A header with a method other than 8 or a reserved
 * flag bit is `GZIP_ERR_HEADER`; `FEXTRA`, `FNAME`, `FCOMMENT` and `FHCRC` are
 * read and skipped, the header CRC checked. A wrong CRC-32 is `GZIP_ERR_CRC`,
 * a wrong length `GZIP_ERR_SIZE`. Members may follow one another (§2.2) and
 * are decompressed one after another into the same output. Bytes after the
 * last member are read as another member's header, so trailing garbage is
 * refused, not ignored: two or more bytes without the `1f 8b` magic are
 * `GZIP_ERR_HEADER`, while a single byte, or fewer than 10 that start with
 * `1f 8b`, is `DEFLATE_ERR_TRUNCATED`. The `limit` bounds the whole output.
 *
 * **Streaming.** `GzipWriter` compresses a body that arrives in pieces and
 * `GzipReader` decompresses one: see each class.
 *
 * Written from RFC 1952.
 */
import { Crc32 } from "nish/compress/checksum"
import {
  DEFLATE_ERR_OUTPUT_LIMIT,
  DEFLATE_ERR_TRUNCATED,
  DEFLATE_NO_ROOM,
  Deflater,
  FixedDeflater,
  INFLATE_DONE,
  INFLATE_NEED_INPUT,
  INFLATE_NEED_OUTPUT,
  Inflater,
  deflateBound,
  fixedDeflateBound,
} from "nish/compress/deflate"
import { copyBytes } from "nish/bytes"

/** A gzip header that is not one: the wrong magic, a method other than DEFLATE, a reserved flag, or a bad header CRC. */
export const GZIP_ERR_HEADER: i32 = -9

/** The trailer's CRC-32 is not the CRC-32 of the data. */
export const GZIP_ERR_CRC: i32 = -10

/** The trailer's length is not the data's length mod 2^32. */
export const GZIP_ERR_SIZE: i32 = -11

/**
 * `GzipWriter`: the body is finished, so `write`, `flush` and `finish` take
 * nothing more until `start` begins another. Answered after `finish` has
 * returned the trailer, and from a call whose compression overran the room
 * `bound` promised, which leaves the body cut short: its output so far is
 * not a gzip member. Codes from -16 to -19 are left to
 * `nish/compress/deflate`.
 */
export const GZIP_ERR_FINISHED: i32 = -20

/** `GzipReader`: no more output yet; give it input. */
export const GZIP_NEED_INPUT: i32 = 0

/** `GzipReader`: the stream has ended and every byte of it was read. */
export const GZIP_END: i32 = -100

/** The gzip header's and trailer's bytes. */
const GZIP_HEADER_SIZE: i32 = 10
const GZIP_TRAILER_SIZE: i32 = 8

/** The bytes a `GzipWriter` holds: 32 KB of history, and up to 64 KB of input before it compresses them. */
const GZIP_WRITER_HISTORY: i32 = 32768
const GZIP_WRITER_INPUT: i32 = 65536

/** The 32 KB window of decoded output a `GzipReader` keeps behind what it hands out. */
const GZIP_READER_WINDOW: i32 = 32768

/** The bytes a `GzipReader` buffers of input. */
const GZIP_READER_INPUT: i32 = 16384

/** Panics unless `buf[off .. off + len)` lies inside `buf`. */
const gzipWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${toI32(buf.length)} bytes`)
  }
}

/** The byte at `b[i]`, or -1 when `i` is outside `b`. */
const gzipByte = (b: u8[], i: i32): i32 => (i >= 0 && i < toI32(b.length) ? toI32(b[i]) : -1)

/**
 * Writes `v` little-endian into `out[at .. at + 4)` and answers whether
 * those four bytes lie inside `out`; when they do not, it may have written
 * the first of them.
 */
const gzipPut32 = (out: u8[], at: i32, v: u32): boolean => {
  const n: i32 = toI32(out.length)
  for (let k: i32 = 0; k < 4; k += 1) {
    const i: i32 = toI32(toI64(at) + toI64(k))
    if (i < 0 || i >= n) {
      return false
    }
    out[i] = toU8((v >>> toU32(k * 8)) & 255)
  }
  return true
}

/** The little-endian word at `b[at .. at + 4)`, or -1 when those bytes are not all inside `b`. */
const gzipGet32 = (b: u8[], at: i32): i64 => {
  let v: i64 = 0
  for (let k: i32 = 0; k < 4; k += 1) {
    const c: i32 = gzipByte(b, toI32(toI64(at) + toI64(k)))
    if (c < 0) {
      return -1
    }
    v = v | (toI64(c & 255) << toI64(k * 8))
  }
  return v
}

/**
 * Writes the ten-byte header for `level` at `out[at]` and answers the
 * position after it, or `DEFLATE_NO_ROOM` when the ten bytes do not lie
 * inside `out`.
 */
const gzipWriteHeader = (out: u8[], at: i32, level: i32): i32 => {
  // XFL (§2.3.1): 2 for the slowest level, 4 for the fastest.
  let xfl: i32 = 0
  if (level === 1) {
    xfl = 4
  } else if (level === 9) {
    xfl = 2
  }
  // ID1, ID2, CM (8, DEFLATE), FLG 0, MTIME 0, XFL, OS 255.
  const n: i32 = toI32(out.length)
  for (let k: i32 = 0; k < GZIP_HEADER_SIZE; k += 1) {
    const i: i32 = toI32(toI64(at) + toI64(k))
    if (i < 0 || i >= n) {
      return DEFLATE_NO_ROOM
    }
    let b: i32 = 0
    if (k === 0) {
      b = 0x1f
    } else if (k === 1) {
      b = 0x8b
    } else if (k === 2) {
      b = 8
    } else if (k === 8) {
      b = xfl
    } else if (k === 9) {
      b = 255
    }
    out[i] = toU8(b)
  }
  return toI32(toI64(at) + toI64(GZIP_HEADER_SIZE))
}

/**
 * Reads a member header at `src[p .. end)`: answers the index of the DEFLATE
 * stream after it, `DEFLATE_ERR_TRUNCATED` when the input ends inside it,
 * or `GZIP_ERR_HEADER`.
 */
const gzipReadHeader = (crc: Crc32, src: u8[], p: i32, end: i32): i32 => {
  // Positions are added in i64 and every byte is read through `gzipByte`:
  // the callers' windows lie inside `src`, but the prover does not carry
  // that into this function. Each step is checked against `end` before it
  // is taken, so no sum leaves the i32 range.
  const b0: i32 = gzipByte(src, p)
  const b1: i32 = gzipByte(src, toI32(toI64(p) + 1))
  if (toI64(end) - toI64(p) < toI64(GZIP_HEADER_SIZE)) {
    return toI64(end) - toI64(p) >= 2 && b0 >= 0 && b1 >= 0 && (b0 !== 0x1f || b1 !== 0x8b)
      ? GZIP_ERR_HEADER
      : DEFLATE_ERR_TRUNCATED
  }
  const b2: i32 = gzipByte(src, toI32(toI64(p) + 2))
  const flags: i32 = gzipByte(src, toI32(toI64(p) + 3))
  if (b0 < 0 || b1 < 0 || b2 < 0 || flags < 0) {
    return DEFLATE_ERR_TRUNCATED
  }
  if (b0 !== 0x1f || b1 !== 0x8b || b2 !== 8) {
    return GZIP_ERR_HEADER
  }
  if ((flags & 0xe0) !== 0) {
    return GZIP_ERR_HEADER
  }
  let q: i32 = toI32(toI64(p) + toI64(GZIP_HEADER_SIZE))
  if ((flags & 4) !== 0) {
    const x0: i32 = gzipByte(src, q)
    const x1: i32 = gzipByte(src, toI32(toI64(q) + 1))
    if (toI64(end) - toI64(q) < 2 || x0 < 0 || x1 < 0) {
      return DEFLATE_ERR_TRUNCATED
    }
    const xlen: i32 = (x0 & 255) | ((x1 & 255) << 8)
    if (toI64(end) - toI64(q) - 2 < toI64(xlen)) {
      return DEFLATE_ERR_TRUNCATED
    }
    q = toI32(toI64(q) + toI64(xlen) + 2)
  }
  for (let field: i32 = 8; field <= 16; field += 8) {
    if ((flags & field) !== 0) {
      // FNAME, then FCOMMENT: zero-terminated.
      let c: i32 = gzipByte(src, q)
      while (q < end && c > 0) {
        q = toI32(toI64(q) + 1)
        c = gzipByte(src, q)
      }
      if (q >= end || c < 0) {
        return DEFLATE_ERR_TRUNCATED
      }
      q = toI32(toI64(q) + 1)
    }
  }
  if ((flags & 2) !== 0) {
    const h0: i32 = gzipByte(src, q)
    const h1: i32 = gzipByte(src, toI32(toI64(q) + 1))
    if (toI64(end) - toI64(q) < 2 || h0 < 0 || h1 < 0) {
      return DEFLATE_ERR_TRUNCATED
    }
    const want: i32 = (h0 & 255) | ((h1 & 255) << 8)
    if (toI32(crc.update(toU32(0), src, p, toI32(toI64(q) - toI64(p))) & 0xffff) !== want) {
      return GZIP_ERR_HEADER
    }
    q = toI32(toI64(q) + 2)
  }
  return q
}

/**
 * Writes the trailer, `crc` then `size`, at `out[at]` and answers the
 * position after it, or `DEFLATE_NO_ROOM` when its eight bytes do not lie
 * inside `out`.
 */
const gzipTrailer = (out: u8[], at: i32, crc: u32, size: u32): i32 => {
  if (!gzipPut32(out, at, crc) || !gzipPut32(out, toI32(toI64(at) + 4), size)) {
    return DEFLATE_NO_ROOM
  }
  return toI32(toI64(at) + toI64(GZIP_TRAILER_SIZE))
}

/**
 * A gzip compressor at one level: a `Deflater` and the CRC-32 tables,
 * allocated once and reused by every call. Not shared between threads.
 */
export class GzipCompressor {
  private readonly deflater: Deflater
  private readonly crc: Crc32

  /**
   * A compressor at `level`, 0 to 9 (`DEFLATE_FAST`, `DEFLATE_DEFAULT`, ...);
   * another level panics.
   *
   * @param level How hard to compress, `DEFLATE_STORE` (0) to
   *   `DEFLATE_BEST` (9); 1 and 9 also set the header's `XFL`.
   */
  constructor(level: i32) {
    this.deflater = new Deflater(level)
    this.crc = new Crc32()
  }

  /**
   * Compresses `src[off .. off + len)` into `out` from `at` as one gzip
   * member, and answers where it ends, or `DEFLATE_NO_ROOM` (-1) when `out`
   * cannot hold it; `compressBound(len)` bytes always can. A window outside
   * its array panics. Allocates nothing.
   *
   * @param src The array that holds the data to compress.
   * @param off Where in `src` the data starts.
   * @param len How many bytes of data to compress.
   * @param out The caller's array the member is written into.
   * @param at Where in `out` the member starts.
   * @returns The index in `out` one past the member's last byte, so the
   *   member is `out[at .. result)`; or `DEFLATE_NO_ROOM`, after which the
   *   bytes of `out` from `at` may have been overwritten and mean nothing.
   */
  compress(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    gzipWindow("GzipCompressor.compress", src, off, len)
    gzipWindow("GzipCompressor.compress", out, at, 0)
    if (toI64(toI32(out.length)) - toI64(at) < toI64(GZIP_HEADER_SIZE + GZIP_TRAILER_SIZE)) {
      return DEFLATE_NO_ROOM
    }
    const body: i32 = gzipWriteHeader(out, at, this.deflater.level)
    if (body < 0) {
      return DEFLATE_NO_ROOM
    }
    const end: i32 = this.deflater.compress(src, off, len, out, body)
    return end < 0
      ? DEFLATE_NO_ROOM
      : gzipTrailer(out, end, this.crc.update(toU32(0), src, off, len), toU32(len))
  }
}

/**
 * The most bytes `GzipFixedCompressor.compress` writes for `n` bytes of input.
 *
 * @param n The length of the input, in bytes; a negative `n` answers the
 *   bound of 0.
 * @returns A size in bytes, not a position: a `room` of this many always
 *   holds the member. Or `DEFLATE_NO_ROOM` when `n` is over 1,908,874,322,
 *   where the size is more than 2^31 - 1 and no array holds it.
 */
export const gzipFixedBound = (n: i32): i32 => {
  // Past this `n`, `fixedDeflateBound(n) + 18` (n + n / 8 + 34) is more
  // than 2^31 - 1.
  if (n > 1908874322) {
    return DEFLATE_NO_ROOM
  }
  return toI32(toI64(fixedDeflateBound(n)) + toI64(GZIP_HEADER_SIZE + GZIP_TRAILER_SIZE))
}

/**
 * A gzip compressor for short inputs: a `FixedDeflater` (one fixed-Huffman
 * block, 16 KB window) and the CRC-32 tables, allocated once. Each call
 * depends on its input alone. Not shared between threads.
 */
export class GzipFixedCompressor {
  private readonly deflater: FixedDeflater
  private readonly crc: Crc32

  /** Builds the tables. */
  constructor() {
    this.deflater = new FixedDeflater()
    this.crc = new Crc32()
  }

  /**
   * Compresses `src[off .. off + len)` into `out[at .. at + room)` as one gzip
   * member, and answers where it ends, or `DEFLATE_NO_ROOM` (-1) as soon as
   * it would need more than `room` bytes, so a caller passing the most it
   * will take stops early on an input that does not shrink.
   * `gzipFixedBound(len)` always fits. A window outside its array panics.
   * Allocates nothing.
   *
   * @param src The array that holds the data to compress.
   * @param off Where in `src` the data starts.
   * @param len How many bytes of data to compress.
   * @param out The caller's array the member is written into.
   * @param at Where in `out` the member starts.
   * @param room How many bytes of `out` from `at` the member may use; the
   *   window `out[at .. at + room)` must lie inside `out`.
   * @returns The index in `out` one past the member's last byte, so the
   *   member is `out[at .. result)`; or `DEFLATE_NO_ROOM`, after which the
   *   bytes of `out[at .. at + room)` may have been overwritten and mean
   *   nothing.
   */
  compress(src: u8[], off: i32, len: i32, out: u8[], at: i32, room: i32): i32 {
    gzipWindow("GzipFixedCompressor.compress", src, off, len)
    gzipWindow("GzipFixedCompressor.compress", out, at, room)
    if (room < GZIP_HEADER_SIZE + GZIP_TRAILER_SIZE) {
      return DEFLATE_NO_ROOM
    }
    const body: i32 = gzipWriteHeader(out, at, 1)
    if (body < 0) {
      return DEFLATE_NO_ROOM
    }
    const end: i32 = this.deflater.compress(
      src,
      off,
      len,
      out,
      body,
      toI32(toI64(room) - toI64(GZIP_HEADER_SIZE + GZIP_TRAILER_SIZE))
    )
    return end < 0
      ? DEFLATE_NO_ROOM
      : gzipTrailer(out, end, this.crc.update(toU32(0), src, off, len), toU32(len))
  }
}

/**
 * A gzip decompressor: an `Inflater` and the CRC-32 tables, allocated once.
 * Not shared between threads.
 */
export class GzipDecompressor {
  private readonly inflater: Inflater
  private readonly crc: Crc32

  /** Builds the tables. */
  constructor() {
    this.inflater = new Inflater()
    this.crc = new Crc32()
  }

  /**
   * Decompresses every member of `src[off .. off + len)` into `out` from
   * `at`, writing at most `limit` bytes and never past `out`'s end, and
   * answers where the output ends; or `DEFLATE_ERR_OUTPUT_LIMIT` when the
   * data is longer, `GZIP_ERR_HEADER`, `GZIP_ERR_CRC`, `GZIP_ERR_SIZE`,
   * `DEFLATE_ERR_TRUNCATED` or another `DEFLATE_ERR_*` for a malformed
   * stream. An empty input is truncated. A window outside its array, or a
   * negative `limit`, panics. Allocates nothing.
   *
   * @param src The array that holds the gzip data, one member or several.
   * @param off Where in `src` the first member starts.
   * @param len How many bytes the members are; every one must belong to a
   *   member. Bytes after the last are read as another member's header:
   *   two or more without the `1f 8b` magic are `GZIP_ERR_HEADER`, and a
   *   single byte, or fewer than 10 that start with `1f 8b`, is
   *   `DEFLATE_ERR_TRUNCATED`; a header that parses is decoded as a member.
   * @param out The caller's array the data is written into, the members'
   *   one after another.
   * @param at Where in `out` the data starts.
   * @param limit The most bytes of data to accept over all the members; a
   *   longer body is `DEFLATE_ERR_OUTPUT_LIMIT`, as is one that reaches the
   *   end of `out`.
   * @returns The index in `out` one past the data's last byte, so the data
   *   is `out[at .. result)`; or one of the negative codes above, after
   *   which the bytes of `out` from `at` may have been overwritten and mean
   *   nothing.
   */
  decompress(src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 {
    gzipWindow("GzipDecompressor.decompress", src, off, len)
    gzipWindow("GzipDecompressor.decompress", out, at, 0)
    if (limit < 0) {
      panic("GzipDecompressor.decompress: a negative limit")
    }
    // Positions are added in i64: the windows were checked in `gzipWindow`,
    // but the prover does not carry that across the call.
    let outEnd: i32 = toI32(out.length)
    if (toI64(limit) < toI64(outEnd) - toI64(at)) {
      outEnd = toI32(toI64(at) + toI64(limit))
    }
    const end: i32 = toI32(toI64(off) + toI64(len))
    let p: i32 = off
    let op: i32 = at
    let first: boolean = true
    while (first || p < end) {
      first = false
      const body: i32 = gzipReadHeader(this.crc, src, p, end)
      if (body < 0) {
        return body
      }
      const inf: Inflater = this.inflater
      inf.reset()
      const r: i32 = inf.inflate(src, body, end, false, out, op, outEnd, op)
      if (r === INFLATE_NEED_OUTPUT) {
        return DEFLATE_ERR_OUTPUT_LIMIT
      }
      if (r !== INFLATE_DONE) {
        return r
      }
      const q: i32 = inf.inPos
      const wantCrc: i64 = gzipGet32(src, q)
      const wantSize: i64 = gzipGet32(src, toI32(toI64(q) + 4))
      if (toI64(end) - toI64(q) < toI64(GZIP_TRAILER_SIZE) || wantCrc < 0 || wantSize < 0) {
        return DEFLATE_ERR_TRUNCATED
      }
      const n: i32 = toI32(toI64(inf.outPos) - toI64(op))
      if (wantCrc !== toI64(this.crc.update(toU32(0), out, op, n))) {
        return GZIP_ERR_CRC
      }
      if (wantSize !== toI64(toU32(n))) {
        return GZIP_ERR_SIZE
      }
      op = inf.outPos
      p = toI32(toI64(q) + toI64(GZIP_TRAILER_SIZE))
    }
    return op
  }
}

/**
 * `GzipCompressor.compress` at `level`, building the compressor for this call
 * alone (about 330 KB, allocated and filled): keep a `GzipCompressor` for
 * anything repeated.
 *
 * @param src The array that holds the data to compress.
 * @param off Where in `src` the data starts.
 * @param len How many bytes of data to compress.
 * @param out The caller's array the member is written into.
 * @param at Where in `out` the member starts.
 * @param level How hard to compress, 0 to 9; another level panics.
 * @returns The index in `out` one past the member's last byte, or
 *   `DEFLATE_NO_ROOM`, as `GzipCompressor.compress` answers.
 */
export const gzipCompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, level: i32): i32 =>
  new GzipCompressor(level).compress(src, off, len, out, at)

/**
 * `GzipDecompressor.decompress`, building the decompressor for this call
 * alone.
 *
 * @param src The array that holds the gzip data, one member or several.
 * @param off Where in `src` the first member starts.
 * @param len How many bytes the members are.
 * @param out The caller's array the data is written into.
 * @param at Where in `out` the data starts.
 * @param limit The most bytes of data to accept over all the members.
 * @returns The index in `out` one past the data's last byte, or a negative
 *   code, as `GzipDecompressor.decompress` answers.
 */
export const gzipDecompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 =>
  new GzipDecompressor().decompress(src, off, len, out, at, limit)

/**
 * A streaming gzip compressor, for a body that does not fit in one buffer:
 * `write` pieces, `flush` to make everything so far decodable, `finish` once.
 * It buffers up to 64 KB of input (and 32 KB of history to match against),
 * compressing whenever that fills, so output arrives in bursts. Every call
 * writes into a caller window and answers where its output ends, or
 * `DEFLATE_NO_ROOM` when the window is shorter than `bound(len)`, the most
 * that call can produce; nothing is consumed then. After `finish`, and
 * after a call whose output overran `bound`, every call answers
 * `GZIP_ERR_FINISHED` until `start`. About 430 KB, allocated once; `start`
 * begins the next body.
 */
export class GzipWriter {
  private readonly deflater: Deflater
  private readonly crc: Crc32
  /** The history and the pending input. */
  private readonly window: u8[]
  /** Where the pending input starts in `window`, and where it ends. */
  private pending: i32
  private fill: i32
  /** The CRC-32 and length of every byte written so far. */
  private checksum: u32
  private size: u32
  /** Whether the header has been written, and whether `finish` has. */
  private started: boolean
  private finished: boolean

  /**
   * A writer at `level`, 0 to 9; another level panics. It is ready for a
   * first body without a call to `start`.
   *
   * @param level How hard to compress, `DEFLATE_STORE` (0) to
   *   `DEFLATE_BEST` (9).
   */
  constructor(level: i32) {
    this.deflater = new Deflater(level)
    this.crc = new Crc32()
    // GZIP_WRITER_HISTORY + GZIP_WRITER_INPUT, as a literal the prover reads.
    this.window = new Array<u8>(98304)
    this.pending = 0
    this.fill = 0
    this.checksum = 0
    this.size = 0
    this.started = false
    this.finished = false
    this.start()
  }

  /** Begins a new body: the next output starts with a header. */
  start(): void {
    // Push every position the tables hold a window behind the new body, so
    // that no match reaches into the last one.
    this.deflater.finish(this.fill)
    this.deflater.reset()
    this.deflater.begin(toI32(0))
    this.pending = 0
    this.fill = 0
    this.checksum = 0
    this.size = 0
    this.started = false
    this.finished = false
  }

  /**
   * The most bytes a `write` of `len` bytes, or a `flush` or `finish` after
   * it, can produce. Less than 64 KB is pending before the call, and the
   * call compresses once per 64 KB pending: `deflateBound` of all of it,
   * with the constant part of `deflateBound` again for each compression
   * after the first.
   *
   * @param len The length of the next `write`, in bytes; 0 for a `flush` or
   *   `finish`.
   * @returns A size in bytes, not a position: the room `out` must have from
   *   `at` for that call not to answer `DEFLATE_NO_ROOM`. Or
   *   `DEFLATE_NO_ROOM` itself when `len` is over 2,145,000,000, where the
   *   size comes near 2^31 - 1; a `write` of such a piece answers
   *   `DEFLATE_NO_ROOM` whatever `out` is.
   */
  bound(len: i32): i32 {
    // Up to this `len`, `deflateBound(65536 + len)` and the sum below stay
    // under 2^31 - 1: 2,146,473,015 at the limit.
    if (len > 2145000000) {
      return DEFLATE_NO_ROOM
    }
    // One deflateBound constant (18) per 64 KB the call compresses, then
    // the header, the trailer and 10 bytes of slack.
    const n: i32 = toI32(toI64(len) + toI64(GZIP_WRITER_INPUT))
    return toI32(
      toI64(deflateBound(n)) + toI64((len >> 16) + 1) * 18 + toI64(GZIP_HEADER_SIZE + GZIP_TRAILER_SIZE + 10)
    )
  }

  /** Whether `out` has `bound(len)` bytes from `at`. */
  private hasRoom(out: u8[], at: i32, len: i32): boolean {
    const b: i32 = this.bound(len)
    return b >= 0 && toI64(toI32(out.length)) - toI64(at) >= toI64(b)
  }

  /** Ends the body after an overrun of `bound`; answers `GZIP_ERR_FINISHED`. */
  private fail(): i32 {
    this.finished = true
    return GZIP_ERR_FINISHED
  }

  /** Writes the header into `out` at `at` if it has not been; answers the new position, or -1. */
  private header(out: u8[], at: i32): i32 {
    if (this.started) {
      return at
    }
    const o: i32 = gzipWriteHeader(out, at, this.deflater.level)
    if (o >= 0) {
      this.started = true
    }
    return o
  }

  /**
   * Compresses the pending input as non-final blocks into `out[at ..)`,
   * then slides the window so that the last 32 KB stay as history. Answers
   * the new position, or -1.
   */
  private drain(out: u8[], at: i32, final: boolean): i32 {
    const d: Deflater = this.deflater
    const end: i32 = d.compressRange(
      this.window,
      this.pending,
      this.fill,
      toI32(0),
      final,
      out,
      at,
      toI32(out.length)
    )
    if (end < 0) {
      return -1
    }
    this.pending = this.fill
    if (this.fill > GZIP_WRITER_HISTORY) {
      const shift: i32 = toI32(toI64(this.fill) - toI64(GZIP_WRITER_HISTORY))
      copyBytes(this.window, 0, this.window, shift, GZIP_WRITER_HISTORY)
      this.fill = GZIP_WRITER_HISTORY
      this.pending = GZIP_WRITER_HISTORY
      d.slide(shift)
    }
    return end
  }

  /**
   * Takes `src[off .. off + len)` and answers where the output it produced
   * in `out` from `at` ends (often `at`: input waits until 64 KB are
   * pending), or `DEFLATE_NO_ROOM` when `out` has less than `bound(len)`
   * bytes from `at`. Writing after `finish` answers `GZIP_ERR_FINISHED`; a
   * window outside its array panics.
   *
   * @param src The array that holds the next piece of the body; its bytes
   *   are copied, so the caller may reuse it once `write` returns.
   * @param off Where in `src` the piece starts.
   * @param len How many bytes the piece is.
   * @param out The caller's array the output is written into.
   * @param at Where in `out` the output starts.
   * @returns The index in `out` one past the last byte written, so the
   *   caller sends `out[at .. result)`, which may be empty; or
   *   `DEFLATE_NO_ROOM`, when nothing was taken and nothing written; or
   *   `GZIP_ERR_FINISHED`, after `finish` (nothing taken or written) or
   *   when the output overran `bound(len)`, after which the bytes of `out`
   *   from `at` mean nothing and the body cannot be completed.
   */
  write(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    gzipWindow("GzipWriter.write", src, off, len)
    gzipWindow("GzipWriter.write", out, at, 0)
    if (this.finished) {
      return GZIP_ERR_FINISHED
    }
    if (!this.hasRoom(out, at, len)) {
      return DEFLATE_NO_ROOM
    }
    let o: i32 = this.header(out, at)
    if (o < 0) {
      return this.fail()
    }
    this.checksum = this.crc.update(this.checksum, src, off, len)
    this.size = this.size + toU32(len)
    let p: i32 = off
    const end: i32 = toI32(toI64(off) + toI64(len))
    // Compressed once 64 KB is pending, the first window too: `pending` is
    // at most `GZIP_WRITER_HISTORY` here, so the window always has the room.
    // Fields are added in i64: the prover keeps no facts about them.
    while (p < end) {
      let take: i64 = toI64(GZIP_WRITER_INPUT) - (toI64(this.fill) - toI64(this.pending))
      if (take > toI64(end) - toI64(p)) {
        take = toI64(end) - toI64(p)
      }
      const t: i32 = toI32(take)
      copyBytes(this.window, this.fill, src, p, t)
      this.fill = toI32(toI64(this.fill) + toI64(t))
      p = toI32(toI64(p) + toI64(t))
      if (toI64(this.fill) - toI64(this.pending) === toI64(GZIP_WRITER_INPUT)) {
        o = this.drain(out, o, false)
        if (o < 0) {
          return this.fail()
        }
      }
    }
    return o
  }

  /**
   * Compresses everything pending and ends with an empty stored block, so a
   * reader can decode every byte written so far (zlib's `Z_SYNC_FLUSH`).
   * Answers the new end of `out`, or `DEFLATE_NO_ROOM` below `bound(0)`.
   * Flushing after `finish` answers `GZIP_ERR_FINISHED`; a window outside
   * `out` panics.
   *
   * @param out The caller's array the output is written into.
   * @param at Where in `out` the output starts.
   * @returns The index in `out` one past the last byte written, so the
   *   caller sends `out[at .. result)`; or `DEFLATE_NO_ROOM`, when nothing
   *   was written; or `GZIP_ERR_FINISHED`, after `finish` or when the
   *   output overran `bound(0)`, as `write` answers it.
   */
  flush(out: u8[], at: i32): i32 {
    gzipWindow("GzipWriter.flush", out, at, 0)
    if (this.finished) {
      return GZIP_ERR_FINISHED
    }
    if (!this.hasRoom(out, at, toI32(0))) {
      return DEFLATE_NO_ROOM
    }
    let o: i32 = this.header(out, at)
    if (o >= 0 && this.fill > this.pending) {
      o = this.drain(out, o, false)
    }
    if (o >= 0) {
      o = this.deflater.writeStored(this.window, toI32(0), toI32(0), false, out, o, toI32(out.length))
    }
    return o < 0 ? this.fail() : o
  }

  /**
   * Compresses everything pending as the final block and writes the
   * trailer; answers the new end of `out`, or `DEFLATE_NO_ROOM` below
   * `bound(0)`. `start` begins another body; until then `write`, `flush`
   * and `finish` answer `GZIP_ERR_FINISHED`. A window outside `out`
   * panics.
   *
   * @param out The caller's array the output is written into.
   * @param at Where in `out` the output starts.
   * @returns The index in `out` one past the trailer's last byte, so the
   *   caller sends `out[at .. result)` as the end of the body; or
   *   `DEFLATE_NO_ROOM`, when nothing was written and the body is not yet
   *   finished; or `GZIP_ERR_FINISHED`, after `finish` or when the output
   *   overran `bound(0)`, as `write` answers it.
   */
  finish(out: u8[], at: i32): i32 {
    gzipWindow("GzipWriter.finish", out, at, 0)
    if (this.finished) {
      return GZIP_ERR_FINISHED
    }
    if (!this.hasRoom(out, at, toI32(0))) {
      return DEFLATE_NO_ROOM
    }
    let o: i32 = this.header(out, at)
    if (o >= 0) {
      o = this.drain(out, o, true)
    }
    if (o >= 0) {
      o = this.deflater.flushBits(out, o, toI32(out.length))
    }
    if (o >= 0) {
      o = gzipTrailer(out, o, this.checksum, this.size)
    }
    this.finished = true
    return o < 0 ? GZIP_ERR_FINISHED : o
  }
}

/**
 * A streaming gzip decompressor, for a body that arrives in pieces or does
 * not fit in memory. Sans-IO in the `nish/net/postgres` shape: copy input
 * into `inputBuffer()` at `inputEnd()` and `commit` it (or `feed` a window),
 * then call `read` until it answers `GZIP_NEED_INPUT`; at the end of the
 * input, `endInput()`. `read(out, at, max)` copies up to `max` decoded bytes
 * and answers how many, `GZIP_NEED_INPUT`, `GZIP_END` once the stream and its
 * trailer are through, or a negative error, final. A total of more than
 * `limit` decoded bytes is `DEFLATE_ERR_OUTPUT_LIMIT`. Concatenated members
 * are read as one body, as by `GzipDecompressor`. About 100 KB, allocated
 * once; `start` begins the next body.
 */
export class GzipReader {
  private readonly inflater: Inflater
  private readonly crc: Crc32
  /** Input not yet decoded. */
  private readonly input: u8[]
  /** The decoded window: history from `windowStart`, unread output from `readPos` to `writePos`. */
  private readonly output: u8[]
  private inStart: i32
  private inEnd: i32
  private readPos: i32
  private writePos: i32
  /** Where the current member's output began, for its distances. */
  private histStart: i32
  /** Where the bytes not yet checksummed start. */
  private crcPos: i32
  /** 0: a member header next; 1: inside a member's stream; 2: its trailer; 3: done; < 0: failed. */
  private phase: i32
  /** Whether more input may come. */
  private more: boolean
  /** The member's running CRC-32 and length. */
  private checksum: u32
  private size: u32
  /** How many more decoded bytes the body may have, from `limit` down. */
  private left: i64
  /** The most decoded bytes `read` hands out in all. */
  private readonly limit: i64
  /** Whether a member has been read; another may follow. */
  private sawMember: boolean

  /**
   * A reader that refuses more than `limit` decoded bytes in all; a negative
   * `limit` panics. It is ready for a first body without a call to `start`.
   *
   * @param limit The most decoded bytes one body may have, over all its
   *   members; past it, `read` answers `DEFLATE_ERR_OUTPUT_LIMIT`. `start`
   *   keeps it.
   */
  constructor(limit: i64) {
    if (limit < 0) {
      panic("GzipReader: a negative limit")
    }
    this.inflater = new Inflater()
    this.crc = new Crc32()
    this.input = new Array<u8>(GZIP_READER_INPUT)
    // The window and 64 KB of output to hand out after it, as a literal the
    // prover reads.
    this.output = new Array<u8>(98304)
    this.limit = limit
    this.inStart = 0
    this.inEnd = 0
    this.readPos = 0
    this.writePos = 0
    this.histStart = 0
    this.crcPos = 0
    this.phase = 0
    this.more = true
    this.checksum = 0
    this.size = 0
    this.left = this.limit
    this.sawMember = false
  }

  /** Begins a new body, dropping any input and output left over. */
  start(): void {
    this.inStart = 0
    this.inEnd = 0
    this.readPos = 0
    this.writePos = 0
    this.histStart = 0
    this.crcPos = 0
    this.phase = 0
    this.more = true
    this.checksum = 0
    this.size = 0
    this.left = this.limit
    this.sawMember = false
  }

  /**
   * The buffer to copy input into, from `inputEnd()` for at most
   * `inputRoom()` bytes; then `commit` how many were copied. It may first
   * move the input not yet decoded to the front, so read `inputEnd()` after
   * this call.
   *
   * @returns The reader's own 16 KB input buffer, the same array every call
   *   and every body: not the caller's to keep, and only its bytes from
   *   `inputEnd()` are the caller's to write.
   */
  inputBuffer(): u8[] {
    this.compact()
    return this.input
  }

  /**
   * Where new input goes in `inputBuffer()`.
   *
   * @returns An index into `inputBuffer()`. `inputBuffer()`, `inputRoom()`,
   *   `commit` and `feed` may change it, so read it after them.
   */
  inputEnd(): i32 {
    return this.inEnd
  }

  /**
   * How many bytes `inputBuffer()` has room for, from `inputEnd()`. Like
   * `inputBuffer()`, it may first move the input not yet decoded to the
   * front.
   *
   * @returns A count of bytes; 0 when the buffer is full of input not yet
   *   decoded, which `read` must use up before more fits.
   */
  inputRoom(): i32 {
    this.compact()
    return this.inputRoomRaw()
  }

  /**
   * Takes `n` bytes copied into `inputBuffer()` at `inputEnd()`; more than
   * `inputRoom()` panics.
   *
   * @param n How many bytes were copied, from 0 to `inputRoom()`; a
   *   negative `n` panics.
   */
  commit(n: i32): void {
    if (n < 0 || n > this.inputRoomRaw()) {
      panic("GzipReader.commit: more bytes than the buffer has room for")
    }
    this.inEnd = toI32(toI64(this.inEnd) + toI64(n))
  }

  /**
   * Copies as much of `src[off .. off + len)` as fits and answers how much.
   * A window outside `src` panics.
   *
   * @param src The array that holds the next input; its bytes are copied,
   *   so the caller may reuse it once `feed` returns.
   * @param off Where in `src` the input starts.
   * @param len How many bytes of input are offered.
   * @returns How many bytes were taken, from 0 to `len`: the caller offers
   *   the rest again after `read` has used some input up.
   */
  feed(src: u8[], off: i32, len: i32): i32 {
    gzipWindow("GzipReader.feed", src, off, len)
    const room: i32 = this.inputRoom()
    const take: i32 = len < room ? len : room
    copyBytes(this.input, this.inEnd, src, off, take)
    this.inEnd = toI32(toI64(this.inEnd) + toI64(take))
    return take
  }

  /** Says that no input follows what has been given. */
  endInput(): void {
    this.more = false
  }

  /** Moves the undecoded input to the front of its buffer. */
  private compact(): void {
    if (this.inStart > 0) {
      const n: i32 = toI32(toI64(this.inEnd) - toI64(this.inStart))
      copyBytes(this.input, 0, this.input, this.inStart, n)
      this.inStart = 0
      this.inEnd = n
    }
  }

  /** Adds the decoded bytes not yet checksummed to the member's CRC-32 and length. */
  private sum(): void {
    const n: i32 = toI32(toI64(this.writePos) - toI64(this.crcPos))
    if (n > 0) {
      this.checksum = this.crc.update(this.checksum, this.output, this.crcPos, n)
      this.size = this.size + toU32(n)
      this.crcPos = this.writePos
    }
  }

  /** Slides the decoded window down once the unread output has been read and the buffer is past half. */
  private slide(): void {
    if (this.readPos === this.writePos && this.writePos > GZIP_READER_WINDOW) {
      this.sum()
      // Positions are moved in i64: the prover keeps no facts about fields.
      const keep: i32 = GZIP_READER_WINDOW
      const shift: i32 = toI32(toI64(this.writePos) - toI64(keep))
      copyBytes(this.output, 0, this.output, shift, keep)
      this.readPos = toI32(toI64(this.readPos) - toI64(shift))
      this.writePos = toI32(toI64(this.writePos) - toI64(shift))
      this.crcPos = toI32(toI64(this.crcPos) - toI64(shift))
      this.histStart = this.histStart > shift ? toI32(toI64(this.histStart) - toI64(shift)) : 0
    }
  }

  /** Decodes as far as the input and the output buffer allow; answers 0 or a final code. */
  private advance(): i32 {
    while (true) {
      const avail: i64 = toI64(this.inEnd) - toI64(this.inStart)
      if (this.phase === 0) {
        if (avail === 0 && !this.more) {
          if (!this.sawMember) {
            return DEFLATE_ERR_TRUNCATED
          }
          this.phase = 3
          return 0
        }
        const body: i32 = gzipReadHeader(this.crc, this.input, this.inStart, this.inEnd)
        if (body === DEFLATE_ERR_TRUNCATED) {
          if (this.more) {
            if (this.inputRoomRaw() === 0 && this.inStart === 0) {
              return GZIP_ERR_HEADER
            }
            return 0
          }
          return DEFLATE_ERR_TRUNCATED
        }
        if (body < 0) {
          return body
        }
        this.inStart = body
        this.inflater.reset()
        this.histStart = this.writePos
        this.checksum = 0
        this.size = 0
        this.phase = 1
      } else if (this.phase === 1) {
        this.slide()
        const outEnd: i32 = toI32(this.output.length)
        if (this.writePos === outEnd) {
          return 0
        }
        const inf: Inflater = this.inflater
        const r: i32 = inf.inflate(
          this.input,
          this.inStart,
          this.inEnd,
          this.more,
          this.output,
          this.writePos,
          outEnd,
          this.histStart
        )
        this.inStart = inf.inPos
        const made: i64 = toI64(inf.outPos) - toI64(this.writePos)
        this.writePos = inf.outPos
        // `left` never goes below 0 and `inflate` never moves `outPos`
        // back; the first two tests say so to the prover.
        const left: i64 = this.left
        if (left < 0 || made < 0 || made > left) {
          return DEFLATE_ERR_OUTPUT_LIMIT
        }
        this.left = left - made
        if (r === INFLATE_DONE) {
          this.sum()
          this.phase = 2
        } else if (r === INFLATE_NEED_INPUT || r === INFLATE_NEED_OUTPUT) {
          return 0
        } else {
          return r
        }
      } else if (this.phase === 2) {
        if (avail < toI64(GZIP_TRAILER_SIZE)) {
          return this.more ? 0 : DEFLATE_ERR_TRUNCATED
        }
        const wantCrc: i64 = gzipGet32(this.input, this.inStart)
        const wantSize: i64 = gzipGet32(this.input, toI32(toI64(this.inStart) + 4))
        if (wantCrc < 0 || wantSize < 0) {
          return DEFLATE_ERR_TRUNCATED
        }
        if (wantCrc !== toI64(this.checksum)) {
          return GZIP_ERR_CRC
        }
        if (wantSize !== toI64(this.size)) {
          return GZIP_ERR_SIZE
        }
        this.inStart = toI32(toI64(this.inStart) + toI64(GZIP_TRAILER_SIZE))
        this.sawMember = true
        this.phase = 0
      } else {
        return 0
      }
    }
  }

  /** The room `input` has without compacting. */
  private inputRoomRaw(): i32 {
    return toI32(toI64(toI32(this.input.length)) - toI64(this.inEnd))
  }

  /**
   * Copies up to `max` decoded bytes into `out` from `at` and answers how
   * many (at least 1; `max` is at least 1), or `GZIP_NEED_INPUT` when it needs more input first,
   * `GZIP_END` once the body has ended, or a negative error, after which it
   * answers that error again until `start`. A window outside `out` panics.
   *
   * @param out The caller's array the decoded bytes are copied into.
   * @param at Where in `out` they start.
   * @param max The most bytes to copy, at least 1; `out[at .. at + max)`
   *   must lie inside `out`.
   * @returns A count, not a position: the bytes are `out[at .. at + result)`.
   *   Or `GZIP_NEED_INPUT` (0), `GZIP_END` (-100), or a negative error code
   *   (`GZIP_ERR_*`, `DEFLATE_ERR_TRUNCATED`, `DEFLATE_ERR_OUTPUT_LIMIT` or
   *   another `DEFLATE_ERR_*`), which is final.
   */
  read(out: u8[], at: i32, max: i32): i32 {
    gzipWindow("GzipReader.read", out, at, max)
    if (max < 1) {
      panic("GzipReader.read: room for no bytes")
    }
    if (this.phase < 0) {
      return this.phase
    }
    if (this.readPos === this.writePos) {
      const r: i32 = this.advance()
      if (r < 0) {
        this.phase = r
        return r
      }
    }
    const n0: i32 = toI32(toI64(this.writePos) - toI64(this.readPos))
    if (n0 === 0) {
      if (this.phase === 3) {
        return GZIP_END
      }
      return GZIP_NEED_INPUT
    }
    const n: i32 = n0 < max ? n0 : max
    copyBytes(out, at, this.output, this.readPos, n)
    this.readPos = toI32(toI64(this.readPos) + toI64(n))
    return n
  }
}
