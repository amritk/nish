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
 * are decompressed one after another into the same output; anything after the
 * last member that is not another member is `GZIP_ERR_HEADER`, so trailing
 * garbage is refused, not ignored. The `limit` bounds the whole output.
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
  INFLATE_DONE,
  INFLATE_NEED_INPUT,
  INFLATE_NEED_OUTPUT,
  Inflater,
  deflateBound,
} from "nish/compress/deflate"
import { copyBytes } from "nish/bytes"

/** A gzip header that is not one: the wrong magic, a method other than DEFLATE, a reserved flag, or a bad header CRC. */
export const GZIP_ERR_HEADER: i32 = -9

/** The trailer's CRC-32 is not the CRC-32 of the data. */
export const GZIP_ERR_CRC: i32 = -10

/** The trailer's length is not the data's length mod 2^32. */
export const GZIP_ERR_SIZE: i32 = -11

/** `GzipReader`: no more output yet; give it input. */
export const GZIP_NEED_INPUT: i32 = 0

/** `GzipReader`: the stream has ended and every byte of it was read. */
export const GZIP_END: i32 = -100

/** The gzip header's and trailer's bytes. */
const GZIP_HEADER_SIZE: i32 = 10
const GZIP_TRAILER_SIZE: i32 = 8

/** The bytes a `GzipWriter` holds before it compresses them: one window of history and two of input. */
const GZIP_WRITER_HISTORY: i32 = 32768
const GZIP_WRITER_INPUT: i32 = 65536

/** The bytes of decoded output a `GzipReader` keeps: the 32 KB window and 32 KB to hand out. */
const GZIP_READER_WINDOW: i32 = 32768
const GZIP_READER_OUTPUT: i32 = 65536

/** The bytes a `GzipReader` buffers of input. */
const GZIP_READER_INPUT: i32 = 16384

/** Panics unless `buf[off .. off + len)` lies inside `buf`. */
const gzipWindow = (what: string, buf: u8[], off: i32, len: i32): void => {
  if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${toI32(buf.length)} bytes`)
  }
}

/** Writes `v` little-endian into `out[at .. at + 4)`; the caller has checked the room. */
const gzipPut32 = (out: u8[], at: i32, v: u32): void => {
  out[at] = toU8(v & 255)
  out[at + 1] = toU8((v >>> 8) & 255)
  out[at + 2] = toU8((v >>> 16) & 255)
  out[at + 3] = toU8(v >>> 24)
}

/** The little-endian word at `b[at .. at + 4)`; the caller has checked the range. */
const gzipGet32 = (b: u8[], at: i32): u32 =>
  toU32(b[at]) | (toU32(b[at + 1]) << 8) | (toU32(b[at + 2]) << 16) | (toU32(b[at + 3]) << 24)

/** Writes the ten-byte header for `level` at `out[at]`; the caller has checked the room. */
const gzipWriteHeader = (out: u8[], at: i32, level: i32): void => {
  out[at] = 0x1f
  out[at + 1] = 0x8b
  out[at + 2] = 8
  out[at + 3] = 0
  gzipPut32(out, at + 4, toU32(0))
  // XFL (§2.3.1): 2 for the slowest level, 4 for the fastest.
  let xfl: i32 = 0
  if (level === 1) {
    xfl = 4
  } else if (level === 9) {
    xfl = 2
  }
  out[at + 8] = toU8(xfl)
  out[at + 9] = 255
}

/**
 * Reads a member header at `src[p .. end)`: answers the index of the DEFLATE
 * stream after it, `DEFLATE_ERR_TRUNCATED` when the input ends inside it,
 * or `GZIP_ERR_HEADER`.
 */
const gzipReadHeader = (crc: Crc32, src: u8[], p: i32, end: i32): i32 => {
  if (end - p < GZIP_HEADER_SIZE) {
    return end - p >= 2 && (src[p] !== 0x1f || src[p + 1] !== 0x8b) ? GZIP_ERR_HEADER : DEFLATE_ERR_TRUNCATED
  }
  if (src[p] !== 0x1f || src[p + 1] !== 0x8b || src[p + 2] !== 8) {
    return GZIP_ERR_HEADER
  }
  const flags: i32 = toI32(src[p + 3])
  if ((flags & 0xe0) !== 0) {
    return GZIP_ERR_HEADER
  }
  let q: i32 = p + GZIP_HEADER_SIZE
  if ((flags & 4) !== 0) {
    if (end - q < 2) {
      return DEFLATE_ERR_TRUNCATED
    }
    const xlen: i32 = toI32(src[q]) | (toI32(src[q + 1]) << 8)
    if (end - q - 2 < xlen) {
      return DEFLATE_ERR_TRUNCATED
    }
    q += 2 + xlen
  }
  for (let field: i32 = 8; field <= 16; field += 8) {
    if ((flags & field) !== 0) {
      while (q < end && src[q] !== 0) {
        q += 1
      }
      if (q >= end) {
        return DEFLATE_ERR_TRUNCATED
      }
      q += 1
    }
  }
  if ((flags & 2) !== 0) {
    if (end - q < 2) {
      return DEFLATE_ERR_TRUNCATED
    }
    const want: i32 = toI32(src[q]) | (toI32(src[q + 1]) << 8)
    if (toI32(crc.update(toU32(0), src, p, q - p) & 0xffff) !== want) {
      return GZIP_ERR_HEADER
    }
    q += 2
  }
  return q
}

/**
 * A gzip compressor at one level: a `Deflater` and the CRC-32 tables,
 * allocated once and reused by every call. Not shared between threads.
 */
export class GzipCompressor {
  readonly deflater: Deflater
  readonly crc: Crc32

  /** A compressor at `level`, 0 to 9 (`DEFLATE_FAST`, `DEFLATE_DEFAULT`, ...); another level panics. */
  constructor(level: i32) {
    this.deflater = new Deflater(level)
    this.crc = new Crc32()
  }

  /**
   * Compresses `src[off .. off + len)` into `out` from `at` as one gzip
   * member, and answers where it ends, or `DEFLATE_NO_ROOM` (-1) when `out`
   * cannot hold it; `compressBound(len)` bytes always can. A window outside
   * its array panics. Allocates nothing.
   */
  compress(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    gzipWindow("GzipCompressor.compress", src, off, len)
    gzipWindow("GzipCompressor.compress", out, at, 0)
    if (toI32(out.length) - at < GZIP_HEADER_SIZE + GZIP_TRAILER_SIZE) {
      return DEFLATE_NO_ROOM
    }
    gzipWriteHeader(out, at, this.deflater.level)
    const end: i32 = this.deflater.compress(src, off, len, out, at + GZIP_HEADER_SIZE)
    if (end < 0 || toI32(out.length) - end < GZIP_TRAILER_SIZE) {
      return DEFLATE_NO_ROOM
    }
    gzipPut32(out, end, this.crc.update(toU32(0), src, off, len))
    gzipPut32(out, end + 4, toU32(len))
    return end + GZIP_TRAILER_SIZE
  }
}

/**
 * A gzip decompressor: an `Inflater` and the CRC-32 tables, allocated once.
 * Not shared between threads.
 */
export class GzipDecompressor {
  readonly inflater: Inflater
  readonly crc: Crc32

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
   */
  decompress(src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 {
    gzipWindow("GzipDecompressor.decompress", src, off, len)
    gzipWindow("GzipDecompressor.decompress", out, at, 0)
    if (limit < 0) {
      panic("GzipDecompressor.decompress: a negative limit")
    }
    const room: i32 = toI32(out.length) - at
    const outEnd: i32 = at + (limit < room ? limit : room)
    const end: i32 = off + len
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
      if (end - q < GZIP_TRAILER_SIZE) {
        return DEFLATE_ERR_TRUNCATED
      }
      const n: i32 = inf.outPos - op
      if (gzipGet32(src, q) !== this.crc.update(toU32(0), out, op, n)) {
        return GZIP_ERR_CRC
      }
      if (gzipGet32(src, q + 4) !== toU32(n)) {
        return GZIP_ERR_SIZE
      }
      op = inf.outPos
      p = q + GZIP_TRAILER_SIZE
    }
    return op
  }
}

/**
 * `GzipCompressor.compress` at `level`, building the compressor for this call
 * alone (about 330 KB, allocated and filled): keep a `GzipCompressor` for
 * anything repeated.
 */
export const gzipCompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, level: i32): i32 =>
  new GzipCompressor(level).compress(src, off, len, out, at)

/** `GzipDecompressor.decompress`, building the decompressor for this call alone. */
export const gzipDecompress = (src: u8[], off: i32, len: i32, out: u8[], at: i32, limit: i32): i32 =>
  new GzipDecompressor().decompress(src, off, len, out, at, limit)

/**
 * A streaming gzip compressor, for a body that does not fit in one buffer:
 * `write` pieces, `flush` to make everything so far decodable, `finish` once.
 * It buffers up to 64 KB of input (and 32 KB of history to match against),
 * compressing whenever that fills, so output arrives in bursts. Every call
 * writes into a caller window and answers where its output ends, or
 * `DEFLATE_NO_ROOM` when the window is shorter than `bound(len)`, the most
 * that call can produce; nothing is consumed then. About 430 KB, allocated
 * once; `start` begins the next body.
 */
export class GzipWriter {
  readonly deflater: Deflater
  readonly crc: Crc32
  /** The history and the pending input. */
  readonly window: u8[]
  /** Where the pending input starts in `window`, and where it ends. */
  pending: i32
  fill: i32
  /** The CRC-32 and length of every byte written so far. */
  checksum: u32
  size: u32
  /** Whether the header has been written, and whether `finish` has. */
  started: boolean
  finished: boolean

  /** A writer at `level`, 0 to 9; another level panics. */
  constructor(level: i32) {
    this.deflater = new Deflater(level)
    this.crc = new Crc32()
    this.window = new Array<u8>(GZIP_WRITER_HISTORY + GZIP_WRITER_INPUT)
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
    this.deflater.begin(0)
    this.pending = 0
    this.fill = 0
    this.checksum = 0
    this.size = 0
    this.started = false
    this.finished = false
  }

  /** The most bytes a `write` of `len` bytes, or a `flush` or `finish` after it, can produce. */
  bound(len: i32): i32 {
    return deflateBound(GZIP_WRITER_INPUT + len) + GZIP_HEADER_SIZE + GZIP_TRAILER_SIZE + 10
  }

  /** Writes the header into `out` at `at` if it has not been; answers the new position. */
  header(out: u8[], at: i32): i32 {
    if (this.started) {
      return at
    }
    gzipWriteHeader(out, at, this.deflater.level)
    this.started = true
    return at + GZIP_HEADER_SIZE
  }

  /**
   * Compresses the pending input as non-final blocks into `out[at ..)`,
   * then slides the window so that the last 32 KB stay as history. Answers
   * the new position, or -1.
   */
  drain(out: u8[], at: i32, final: boolean): i32 {
    const d: Deflater = this.deflater
    const end: i32 = d.compressRange(
      this.window,
      this.pending,
      this.fill,
      0,
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
      const shift: i32 = this.fill - GZIP_WRITER_HISTORY
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
   * bytes from `at`. Writing after `finish` panics, as does a window outside
   * its array.
   */
  write(src: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    gzipWindow("GzipWriter.write", src, off, len)
    gzipWindow("GzipWriter.write", out, at, 0)
    if (this.finished) {
      panic("GzipWriter.write: the body has been finished")
    }
    if (toI32(out.length) - at < this.bound(len)) {
      return DEFLATE_NO_ROOM
    }
    let o: i32 = this.header(out, at)
    this.checksum = this.crc.update(this.checksum, src, off, len)
    this.size = this.size + toU32(len)
    let p: i32 = off
    const end: i32 = off + len
    const cap: i32 = toI32(this.window.length)
    while (p < end) {
      let take: i32 = cap - this.fill
      if (take > end - p) {
        take = end - p
      }
      copyBytes(this.window, this.fill, src, p, take)
      this.fill += take
      p += take
      if (this.fill === cap) {
        o = this.drain(out, o, false)
        if (o < 0) {
          panic("GzipWriter.write: a block larger than its bound")
        }
      }
    }
    return o
  }

  /**
   * Compresses everything pending and ends with an empty stored block, so a
   * reader can decode every byte written so far (zlib's `Z_SYNC_FLUSH`).
   * Answers the new end of `out`, or `DEFLATE_NO_ROOM` below `bound(0)`.
   */
  flush(out: u8[], at: i32): i32 {
    gzipWindow("GzipWriter.flush", out, at, 0)
    if (this.finished) {
      panic("GzipWriter.flush: the body has been finished")
    }
    if (toI32(out.length) - at < this.bound(0)) {
      return DEFLATE_NO_ROOM
    }
    let o: i32 = this.header(out, at)
    if (this.fill > this.pending) {
      o = this.drain(out, o, false)
    }
    o = this.deflater.writeStored(this.window, 0, 0, false, out, o, toI32(out.length))
    return o
  }

  /**
   * Compresses everything pending as the final block and writes the
   * trailer; answers the new end of `out`, or `DEFLATE_NO_ROOM` below
   * `bound(0)`. `start` begins another body.
   */
  finish(out: u8[], at: i32): i32 {
    gzipWindow("GzipWriter.finish", out, at, 0)
    if (this.finished) {
      panic("GzipWriter.finish: the body has been finished")
    }
    if (toI32(out.length) - at < this.bound(0)) {
      return DEFLATE_NO_ROOM
    }
    let o: i32 = this.header(out, at)
    o = this.drain(out, o, true)
    o = this.deflater.flushBits(out, o, toI32(out.length))
    if (o < 0 || toI32(out.length) - o < GZIP_TRAILER_SIZE) {
      panic("GzipWriter.finish: a block larger than its bound")
    }
    gzipPut32(out, o, this.checksum)
    gzipPut32(out, o + 4, this.size)
    this.finished = true
    return o + GZIP_TRAILER_SIZE
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
  readonly inflater: Inflater
  readonly crc: Crc32
  /** Input not yet decoded. */
  readonly input: u8[]
  /** The decoded window: history from `windowStart`, unread output from `readPos` to `writePos`. */
  readonly output: u8[]
  inStart: i32
  inEnd: i32
  readPos: i32
  writePos: i32
  /** Where the current member's output began, for its distances. */
  histStart: i32
  /** Where the bytes not yet checksummed start. */
  crcPos: i32
  /** 0: a member header next; 1: inside a member's stream; 2: its trailer; 3: done; < 0: failed. */
  phase: i32
  /** Whether more input may come. */
  more: boolean
  /** The member's running CRC-32 and length, and the body's total length. */
  checksum: u32
  size: u32
  total: i64
  /** The most decoded bytes `read` hands out in all. */
  readonly limit: i64
  /** Whether a member has been read; another may follow. */
  members: i32

  /** A reader that refuses more than `limit` decoded bytes in all; a negative `limit` panics. */
  constructor(limit: i64) {
    if (limit < 0) {
      panic("GzipReader: a negative limit")
    }
    this.inflater = new Inflater()
    this.crc = new Crc32()
    this.input = new Array<u8>(GZIP_READER_INPUT)
    this.output = new Array<u8>(GZIP_READER_WINDOW + GZIP_READER_OUTPUT)
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
    this.total = 0
    this.members = 0
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
    this.total = 0
    this.members = 0
  }

  /** The buffer to copy input into, from `inputEnd()` for at most `inputRoom()` bytes. */
  inputBuffer(): u8[] {
    this.compact()
    return this.input
  }

  /** Where new input goes in `inputBuffer()`. */
  inputEnd(): i32 {
    return this.inEnd
  }

  /** How many bytes `inputBuffer()` has room for. */
  inputRoom(): i32 {
    this.compact()
    return toI32(this.input.length) - this.inEnd
  }

  /** Takes `n` bytes copied into `inputBuffer()` at `inputEnd()`; more than `inputRoom()` panics. */
  commit(n: i32): void {
    if (n < 0 || n > toI32(this.input.length) - this.inEnd) {
      panic("GzipReader.commit: more bytes than the buffer has room for")
    }
    this.inEnd += n
  }

  /** Copies as much of `src[off .. off + len)` as fits and answers how much. */
  feed(src: u8[], off: i32, len: i32): i32 {
    gzipWindow("GzipReader.feed", src, off, len)
    const room: i32 = this.inputRoom()
    const take: i32 = len < room ? len : room
    copyBytes(this.input, this.inEnd, src, off, take)
    this.inEnd += take
    return take
  }

  /** Says that no input follows what has been given. */
  endInput(): void {
    this.more = false
  }

  /** Moves the undecoded input to the front of its buffer. */
  compact(): void {
    if (this.inStart > 0) {
      const n: i32 = this.inEnd - this.inStart
      copyBytes(this.input, 0, this.input, this.inStart, n)
      this.inStart = 0
      this.inEnd = n
    }
  }

  /** Adds the decoded bytes not yet checksummed to the member's CRC-32 and length. */
  sum(): void {
    const n: i32 = this.writePos - this.crcPos
    if (n > 0) {
      this.checksum = this.crc.update(this.checksum, this.output, this.crcPos, n)
      this.size = this.size + toU32(n)
      this.crcPos = this.writePos
    }
  }

  /** Slides the decoded window down once the unread output has been read and the buffer is past half. */
  slide(): void {
    if (this.readPos === this.writePos && this.writePos > GZIP_READER_WINDOW) {
      this.sum()
      const keep: i32 = GZIP_READER_WINDOW
      const shift: i32 = this.writePos - keep
      copyBytes(this.output, 0, this.output, shift, keep)
      this.readPos -= shift
      this.writePos -= shift
      this.crcPos -= shift
      this.histStart = this.histStart > shift ? this.histStart - shift : 0
    }
  }

  /** Decodes as far as the input and the output buffer allow; answers 0 or a final code. */
  advance(): i32 {
    while (true) {
      const avail: i32 = this.inEnd - this.inStart
      if (this.phase === 0) {
        if (avail === 0 && !this.more) {
          if (this.members === 0) {
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
        const made: i32 = inf.outPos - this.writePos
        this.writePos = inf.outPos
        this.total = this.total + toI64(made)
        if (this.total > this.limit) {
          return DEFLATE_ERR_OUTPUT_LIMIT
        }
        if (r === INFLATE_DONE) {
          this.sum()
          this.phase = 2
        } else if (r === INFLATE_NEED_INPUT || r === INFLATE_NEED_OUTPUT) {
          return 0
        } else {
          return r
        }
      } else if (this.phase === 2) {
        if (avail < GZIP_TRAILER_SIZE) {
          return this.more ? 0 : DEFLATE_ERR_TRUNCATED
        }
        if (gzipGet32(this.input, this.inStart) !== this.checksum) {
          return GZIP_ERR_CRC
        }
        if (gzipGet32(this.input, this.inStart + 4) !== this.size) {
          return GZIP_ERR_SIZE
        }
        this.inStart += GZIP_TRAILER_SIZE
        this.members += 1
        this.phase = 0
      } else {
        return 0
      }
    }
  }

  /** The room `input` has without compacting. */
  inputRoomRaw(): i32 {
    return toI32(this.input.length) - this.inEnd
  }

  /**
   * Copies up to `max` decoded bytes into `out` from `at` and answers how
   * many (at least 1; `max` is at least 1), or `GZIP_NEED_INPUT` when it needs more input first,
   * `GZIP_END` once the body has ended, or a negative error, after which it
   * answers that error again until `start`. A window outside `out` panics.
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
    const n0: i32 = this.writePos - this.readPos
    if (n0 === 0) {
      if (this.phase === 3) {
        return GZIP_END
      }
      return GZIP_NEED_INPUT
    }
    const n: i32 = n0 < max ? n0 : max
    copyBytes(out, at, this.output, this.readPos, n)
    this.readPos += n
    return n
  }
}
