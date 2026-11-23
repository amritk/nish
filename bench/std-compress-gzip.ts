// gzip and zlib (std/compress/gzip.ts, std/compress/zlib.ts) under an
// instruction count, with the checksum kernels pinned off (bench/run.mjs,
// PINNED_CHECKSUM): `n` rounds over 64 KiB of generated text that each make
// a gzip round trip through GzipCompressor and GzipDecompressor, a zlib round
// trip through ZlibCompressor and ZlibDecompressor, and a streamed one that
// writes the text to a GzipWriter in pieces of 1000 bytes with a flush
// halfway and reads it back through a GzipReader fed 1500 bytes at a time.
// It reaches the headers, trailers, windows and buffers of both formats whose
// panic sites the std/ ratchet counts, so a fix to one of them shows here as
// a count that holds or falls. It prints a sum over the lengths and bytes.
import { DEFLATE_DEFAULT, DEFLATE_FAST, compressBound } from "nish/compress/deflate"
import {
  GZIP_END,
  GZIP_NEED_INPUT,
  GzipCompressor,
  GzipDecompressor,
  GzipReader,
  GzipWriter,
} from "nish/compress/gzip"
import { ZlibCompressor, ZlibDecompressor } from "nish/compress/zlib"

/** The bytes of text each round compresses. */
const CORPUS_BYTES: i32 = 65536

/**
 * `n` bytes of text: words from a fixed list picked by a 32-bit LCG, with
 * spaces, commas and line breaks, so DEFLATE finds the short and long
 * matches prose gives it. The same seed and list in every std-compress
 * program, so all of them read the same corpus.
 */
const corpus = (n: i32): u8[] => {
  const words: string[] = [
    "the",
    "of",
    "and",
    "a",
    "to",
    "in",
    "is",
    "you",
    "that",
    "it",
    "he",
    "was",
    "for",
    "on",
    "are",
    "as",
    "with",
    "his",
    "they",
    "at",
    "be",
    "this",
    "have",
    "from",
    "or",
    "one",
    "had",
    "by",
    "word",
    "but",
    "not",
    "what",
    "compression",
    "stream",
    "window",
    "header",
    "trailer",
    "checksum",
    "block",
    "symbol",
  ]
  const out: u8[] = new Array<u8>(n)
  let x: u32 = toU32(20261123)
  let i: i32 = 0
  while (i < n) {
    x = x * toU32(1103515245) + toU32(12345)
    const w: string = words[toI32(x >>> 16) % words.length]
    for (let k: i32 = 0; k < w.length && i < n; k += 1) {
      out[i] = toU8(w.charCodeAt(k))
      i += 1
    }
    if (i < n) {
      const r: u32 = (x >>> 8) & 31
      let sep: i32 = 32
      if (r === 0) {
        sep = 10
      } else if (r === 1) {
        sep = 44
      }
      out[i] = toU8(sep)
      i += 1
    }
  }
  return out
}

/** The bytes `GzipWriter.write` takes at a time, and `GzipReader.feed` is offered. */
const WRITE_PIECE: i32 = 1000
const FEED_PIECE: i32 = 1500

export const main = (): i32 => {
  const n: i32 = 3 // bench:n
  const src: u8[] = corpus(CORPUS_BYTES)
  const packed: u8[] = new Array<u8>(compressBound(CORPUS_BYTES) * 2)
  const back: u8[] = new Array<u8>(CORPUS_BYTES + 1)
  const gzc: GzipCompressor = new GzipCompressor(DEFLATE_DEFAULT)
  const gzd: GzipDecompressor = new GzipDecompressor()
  const zc: ZlibCompressor = new ZlibCompressor(DEFLATE_DEFAULT)
  const zd: ZlibDecompressor = new ZlibDecompressor()
  const writer: GzipWriter = new GzipWriter(DEFLATE_FAST)
  const reader: GzipReader = new GzipReader(toI64(CORPUS_BYTES))
  const piece: u8[] = new Array<u8>(writer.bound(WRITE_PIECE))
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    let end: i32 = gzc.compress(src, 0, CORPUS_BYTES, packed, 0)
    let got: i32 = end > 0 ? gzd.decompress(packed, 0, end, back, 0, CORPUS_BYTES) : end
    if (got !== CORPUS_BYTES) {
      console.log(`gzip round trip failed: ${end} ${got}`)
      return 1
    }
    sum += toI64(end) + toI64(back[round * 4099])
    end = zc.compress(src, 0, CORPUS_BYTES, packed, 0)
    got = end > 0 ? zd.decompress(packed, 0, end, back, 0, CORPUS_BYTES) : end
    if (got !== CORPUS_BYTES) {
      console.log(`zlib round trip failed: ${end} ${got}`)
      return 1
    }
    sum += toI64(end) + toI64(back[round * 4111])
    // Streamed: each piece's output is appended to `packed`.
    writer.start()
    let w: i32 = 0
    for (let p: i32 = 0; p < CORPUS_BYTES; p += WRITE_PIECE) {
      const len: i32 = WRITE_PIECE < CORPUS_BYTES - p ? WRITE_PIECE : CORPUS_BYTES - p
      const o: i32 = writer.write(src, p, len, piece, 0)
      if (o < 0) {
        console.log(`GzipWriter.write failed: ${o}`)
        return 1
      }
      for (let k: i32 = 0; k < o; k++) {
        packed[w + k] = piece[k]
      }
      w += o
      if (p < CORPUS_BYTES / 2 && p + len >= CORPUS_BYTES / 2) {
        const f: i32 = writer.flush(piece, 0)
        if (f < 0) {
          console.log(`GzipWriter.flush failed: ${f}`)
          return 1
        }
        for (let k: i32 = 0; k < f; k++) {
          packed[w + k] = piece[k]
        }
        w += f
      }
    }
    const tail: i32 = writer.finish(piece, 0)
    if (tail < 0) {
      console.log(`GzipWriter.finish failed: ${tail}`)
      return 1
    }
    for (let k: i32 = 0; k < tail; k++) {
      packed[w + k] = piece[k]
    }
    w += tail
    reader.start()
    let fed: i32 = 0
    let at: i32 = 0
    let r: i32 = GZIP_NEED_INPUT
    while (r !== GZIP_END) {
      r = reader.read(back, at, CORPUS_BYTES + 1 - at)
      if (r === GZIP_NEED_INPUT) {
        if (fed === w) {
          reader.endInput()
        } else {
          fed += reader.feed(packed, fed, FEED_PIECE < w - fed ? FEED_PIECE : w - fed)
        }
      } else if (r > 0) {
        at += r
      } else if (r !== GZIP_END) {
        console.log(`GzipReader.read failed: ${r}`)
        return 1
      }
    }
    if (at !== CORPUS_BYTES) {
      console.log(`streamed round trip read ${at} bytes`)
      return 1
    }
    sum += toI64(w) + toI64(back[round * 4127])
  }
  console.log(`${sum}`)
  return 0
}
