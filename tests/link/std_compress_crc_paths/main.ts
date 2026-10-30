// `Crc32.update` on whichever path the process picked: the check value of
// "123456789", empty input, the CRC-32 and ISIZE a gzip trailer carries
// (RFC 1952 §2.3.1) against `crc32` of the same bytes, and one checksum fed
// in pieces of 1..16, 63..65 and 127..129 bytes, each chain equal to the
// whole, then split once at each of those lengths, the first `k` bytes and
// the rest, over 4096 bytes and over 4093, whose length is no multiple of 16. Its stdout is the same under `NISH_CRC32=soft`, which the
// "crc32 kernel" section of `tests/run.js` runs it under too; the expected
// values are Node's `zlib.crc32`.
import { Crc32, crc32 } from "nish/compress/checksum"
import { DEFLATE_DEFAULT, DEFLATE_STORE, compressBound } from "nish/compress/deflate"
import { gzipCompress, gzipDecompress } from "nish/compress/gzip"

/** `n` bytes of a 32-bit LCG's top bytes, from `seed`. */
const lcg = (seed: u32, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  let x: u32 = seed
  for (let i: i32 = 0; i < n; i += 1) {
    x = x * toU32(1103515245) + toU32(12345)
    out[i] = toU8(x >>> 24)
  }
  return out
}

/** A little-endian u32 at `buf[at]`. */
const le32 = (buf: u8[], at: i32): u32 =>
  toU32(buf[at]) | (toU32(buf[at + 1]) << 8) | (toU32(buf[at + 2]) << 16) | (toU32(buf[at + 3]) << 24)

/** Gzips `src` at `level`, prints its trailer, and answers 0 when it matches and round-trips. */
const trailer = (name: string, src: u8[], level: i32): i32 => {
  const n: i32 = toI32(src.length)
  const out: u8[] = new Array<u8>(compressBound(n))
  const end: i32 = gzipCompress(src, 0, n, out, 0, level)
  const crc: u32 = le32(out, end - 8)
  const size: u32 = le32(out, end - 4)
  console.log(`gzip ${name}: crc ${toI64(crc)} isize ${toI64(size)}`)
  const back: u8[] = new Array<u8>(n + 1)
  const got: i32 = gzipDecompress(out, 0, end, back, 0, n + 1)
  let same: boolean = got === n
  for (let i: i32 = 0; same && i < n; i += 1) {
    same = back[i] === src[i]
  }
  return crc === crc32(src, 0, n) && toI32(size) === n && same ? 0 : 1
}

export const main = (): i32 => {
  const k: Crc32 = new Crc32()
  const dead: u32 = 0xdeadbeef
  let bad: i32 = 0
  const check: u8[] = [49, 50, 51, 52, 53, 54, 55, 56, 57]
  console.log(`check: ${toI64(crc32(check, 0, 9))}`)
  console.log(`empty: ${toI64(crc32(check, 9, 0))} ${toI64(k.update(dead, check, 4, 0))}`)

  bad += trailer("empty", lcg(toU32(1), 0), DEFLATE_DEFAULT)
  bad += trailer("check", check, DEFLATE_STORE)
  bad += trailer("4 KiB", lcg(toU32(2), 4096), DEFLATE_DEFAULT)
  bad += trailer("1 MiB", lcg(toU32(3), 1 << 20), DEFLATE_DEFAULT)

  const data: u8[] = lcg(toU32(4), 4096)
  const whole: u32 = crc32(data, 0, 4096)
  console.log(`whole: ${toI64(whole)}`)
  const pieces: i32[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 63, 64, 65, 127, 128, 129]
  for (const piece of pieces) {
    let c: u32 = toU32(0)
    for (let at: i32 = 0; at < 4096; at += piece) {
      c = k.update(c, data, at, Math.min(piece, 4096 - at))
    }
    if (c !== whole) {
      console.log(`pieces of ${piece}: ${toI64(c)}, not the whole`)
      bad += 1
    }
  }
  console.log(`pieces: ${pieces.length} splits`)
  const lengths: i32[] = [4096, 4093]
  for (const total of lengths) {
    const all: u32 = crc32(data, 0, total)
    console.log(`whole ${total}: ${toI64(all)}`)
    for (const cut of pieces) {
      const c: u32 = k.update(k.update(toU32(0), data, 0, cut), data, cut, total - cut)
      if (c !== all) {
        console.log(`${cut} then ${total - cut}: ${toI64(c)}, not the whole`)
        bad += 1
      }
    }
  }
  console.log(`split once: ${pieces.length * lengths.length} cuts`)
  return bad === 0 ? 0 : 1
}
