// DEFLATE decompression (std/compress/deflate.ts) under an instruction
// count: the 64 KiB of generated text std-compress-deflate reads, compressed
// once at each of the levels 1, 6 and 9, then `n` rounds that decompress all
// three streams with one `Inflater`. It reaches the bit reader, the table
// build and the copy loops whose panic sites the std/ ratchet counts, so a
// fix to one of them shows here as a count that holds or falls. It prints a
// sum over the decompressed lengths and a byte of each.
import {
  DEFLATE_BEST,
  DEFLATE_DEFAULT,
  DEFLATE_FAST,
  Deflater,
  Inflater,
  compressBound,
} from "nish/compress/deflate"

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

export const main = (): i32 => {
  const n: i32 = 40 // bench:n
  const src: u8[] = corpus(CORPUS_BYTES)
  const levels: i32[] = [DEFLATE_FAST, DEFLATE_DEFAULT, DEFLATE_BEST]
  const streams: u8[][] = []
  const ends: i32[] = []
  for (let k: i32 = 0; k < levels.length; k++) {
    const out: u8[] = new Array<u8>(compressBound(CORPUS_BYTES))
    const end: i32 = new Deflater(levels[k]).compress(src, 0, CORPUS_BYTES, out, 0)
    if (end <= 0) {
      console.log(`level ${levels[k]} failed: ${end}`)
      return 1
    }
    streams.push(out)
    ends.push(end)
  }
  const back: u8[] = new Array<u8>(CORPUS_BYTES)
  const inf: Inflater = new Inflater()
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    for (let k: i32 = 0; k < streams.length; k++) {
      const got: i32 = inf.decompress(streams[k], 0, ends[k], back, 0, CORPUS_BYTES)
      if (got !== CORPUS_BYTES) {
        console.log(`stream ${k} failed: ${got}`)
        return 1
      }
      sum += toI64(got) + toI64(back[(round * 7919 + k) % CORPUS_BYTES])
    }
  }
  console.log(`${sum}`)
  return 0
}
