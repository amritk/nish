// `adler32Update` on whichever path the process picked: the check value of
// "123456789", empty input from a reduced and an unreduced value (each comes
// back as it went in), the Adler-32 a zlib trailer carries (RFC 1950 §2.2)
// against `adler32` of the same bytes, the window lengths either side of the
// kernel's 5,536-byte stretch and the loop's 5,552-byte one, all-0xff bytes,
// an unreduced start, and one checksum fed in pieces of 1..16, 31..33, 63..65
// and 127..129 bytes, each chain equal to the whole, then split once at each
// of those lengths. Its stdout is the same under `NISH_ADLER32=soft`, which
// the "adler32 kernel" section of `tests/run.js` runs it under too; the
// expected values are an Adler-32 written in JavaScript.
import { adler32, adler32Update } from "nish/compress/checksum"
import { DEFLATE_DEFAULT, DEFLATE_STORE, compressBound } from "nish/compress/deflate"
import { zlibCompress, zlibDecompress } from "nish/compress/zlib"

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

/** A big-endian u32 at `buf[at]`, as zlib's trailer stores it. */
const be32 = (buf: u8[], at: i32): u32 =>
  (toU32(buf[at]) << 24) | (toU32(buf[at + 1]) << 16) | (toU32(buf[at + 2]) << 8) | toU32(buf[at + 3])

/** zlib-compresses `src` at `level`, prints its trailer, and answers 0 when it matches and round-trips. */
const trailer = (name: string, src: u8[], level: i32): i32 => {
  const n: i32 = toI32(src.length)
  const out: u8[] = new Array<u8>(compressBound(n) + 6)
  const end: i32 = zlibCompress(src, 0, n, out, 0, level)
  const sum: u32 = be32(out, end - 4)
  console.log(`zlib ${name}: adler ${toI64(sum)}`)
  const back: u8[] = new Array<u8>(n + 1)
  const got: i32 = zlibDecompress(out, 0, end, back, 0, n + 1)
  let same: boolean = got === n
  for (let i: i32 = 0; same && i < n; i += 1) {
    same = back[i] === src[i]
  }
  return sum === adler32(src, 0, n) && same ? 0 : 1
}

export const main = (): i32 => {
  const raw: u32 = 0xffffffff
  let bad: i32 = 0
  const check: u8[] = [49, 50, 51, 52, 53, 54, 55, 56, 57]
  console.log(`check: ${toI64(adler32(check, 0, 9))}`)
  console.log(`empty: ${toI64(adler32(check, 9, 0))} ${toI64(adler32Update(raw, check, 4, 0))}`)

  bad += trailer("empty", lcg(toU32(1), 0), DEFLATE_DEFAULT)
  bad += trailer("check", check, DEFLATE_STORE)
  bad += trailer("4 KiB", lcg(toU32(2), 4096), DEFLATE_DEFAULT)
  bad += trailer("1 MiB", lcg(toU32(3), 1 << 20), DEFLATE_DEFAULT)

  const edges: i32[] = [31, 32, 33, 5535, 5536, 5537, 5551, 5552, 5553, 11071, 11072, 11073, 11104, 11105]
  const random: u8[] = lcg(toU32(5), 11105)
  const full: u8[] = new Array<u8>(1 << 20)
  full.fill(toU8(255))
  for (const n of edges) {
    console.log(
      `${n}: ${toI64(adler32(random, 0, n))} ff ${toI64(adler32(full, 0, n))} from ${toI64(raw)} ${toI64(adler32Update(raw, full, 0, n))}`
    )
  }
  console.log(`1 MiB of ff: ${toI64(adler32(full, 0, 1 << 20))} from ${toI64(raw)} ${toI64(adler32Update(raw, full, 0, 1 << 20))}`)

  const data: u8[] = lcg(toU32(4), 4096)
  const whole: u32 = adler32(data, 0, 4096)
  console.log(`whole: ${toI64(whole)}`)
  const pieces: i32[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 31, 32, 33, 63, 64, 65, 127, 128, 129]
  let chained: i32 = 0
  for (const piece of pieces) {
    let c: u32 = toU32(1)
    for (let at: i32 = 0; at < 4096; at += piece) {
      c = adler32Update(c, data, at, Math.min(piece, 4096 - at))
    }
    if (c !== whole) {
      console.log(`pieces of ${piece}: ${toI64(c)}, not the whole`)
      bad += 1
    }
    chained += 1
  }
  console.log(`pieces: ${chained} chains compared with the whole`)
  const lengths: i32[] = [4096, 4093]
  let cuts: i32 = 0
  for (const total of lengths) {
    const all: u32 = adler32(data, 0, total)
    console.log(`whole ${total}: ${toI64(all)}`)
    for (const cut of pieces) {
      const c: u32 = adler32Update(adler32(data, 0, cut), data, cut, total - cut)
      if (c !== all) {
        console.log(`${cut} then ${total - cut}: ${toI64(c)}, not the whole`)
        bad += 1
      }
      cuts += 1
    }
  }
  console.log(`split once: ${cuts} cuts compared with the whole`)
  return bad === 0 ? 0 : 1
}
