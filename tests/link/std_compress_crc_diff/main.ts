// `Crc32.update` over every length 0..4096 at every offset 0..15 of one
// buffer, each from a register of its own, and over 1, 3 and 16 MiB at
// every offset 0..15, each `3 * off` bytes short so the length's residue
// mod 16 moves with the start's: a digest of the 65,552 answers and each
// large one. Whichever path the process picked — PCLMULQDQ, the ARMv8 CRC32
// instructions or the Nish walk under `NISH_CRC32=soft` — prints the same,
// which the "crc32 kernel" section of `tests/run.js` checks; the expected
// values are Node's `zlib.crc32`.
import { Crc32 } from "nish/compress/checksum"

/** 16 MiB and the 15 bytes the last offset reads past it. */
const BIG: i32 = 16777232

export const main = (): i32 => {
  const k: Crc32 = new Crc32()
  const buf: u8[] = new Array<u8>(BIG)
  let x: u32 = toU32(7)
  for (let i: i32 = 0; i < BIG; i += 1) {
    x = x * toU32(1103515245) + toU32(12345)
    buf[i] = toU8(x >>> 24)
  }
  // Each answer is folded in by a multiply, so a wrong one anywhere, or two
  // swapped, moves the digest.
  const golden: u32 = 2654435761
  let digest: u32 = toU32(0)
  for (let off: i32 = 0; off < 16; off += 1) {
    for (let len: i32 = 0; len <= 4096; len += 1) {
      const start: u32 = toU32(len) * golden
      digest = digest * toU32(31) + k.update(start, buf, off, len)
    }
  }
  console.log(`digest: ${toI64(digest)}`)
  const sizes: i32[] = [1 << 20, 3 << 20, 16 << 20]
  for (const n of sizes) {
    for (let off: i32 = 0; off < 16; off += 1) {
      const len: i32 = n - off * 3
      console.log(`${n >> 20} MiB less ${off * 3} at ${off}: ${toI64(k.update(toU32(0), buf, off, len))}`)
    }
  }
  return 0
}
