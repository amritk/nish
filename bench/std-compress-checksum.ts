// CRC-32 and Adler-32 (std/compress/checksum.ts) under an instruction
// count, with the CPU kernels pinned off (bench/run.mjs, PINNED_CHECKSUM) so
// the count is the Nish walks: `n` rounds that each take both checksums of
// 64 KiB of generated text whole, then again in pieces of 1 to 64 bytes that
// carry the running value. It reaches the braided CRC loop, its tail and the
// Adler-32 sums whose panic sites the std/ ratchet counts, so a fix to one
// of them shows here as a count that holds or falls. It prints a sum of the
// checksums.
import { Crc32, adler32Update } from "nish/compress/checksum"

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
  const n: i32 = 60 // bench:n
  const src: u8[] = corpus(CORPUS_BYTES)
  const crc: Crc32 = new Crc32()
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const whole: u32 = crc.update(toU32(0), src, 0, CORPUS_BYTES)
    const adler: u32 = adler32Update(toU32(1), src, 0, CORPUS_BYTES)
    let c: u32 = toU32(0)
    let a: u32 = toU32(1)
    let p: i32 = 0
    let piece: i32 = 1 + (round % 7)
    while (p < CORPUS_BYTES) {
      const len: i32 = piece < CORPUS_BYTES - p ? piece : CORPUS_BYTES - p
      c = crc.update(c, src, p, len)
      a = adler32Update(a, src, p, len)
      p += len
      piece = piece === 64 ? 1 : piece + 1
    }
    if (c !== whole || a !== adler) {
      console.log(`round ${round}: the pieces disagree with the whole`)
      return 1
    }
    sum += toI64(whole) + toI64(adler)
  }
  console.log(`${sum}`)
  return 0
}
