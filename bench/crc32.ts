// CRC-32 on the sizes a checksum meets, and the gzip round trip it sits in:
// WP38's CRC-32 kernel's measure (docs/wp38-simd.md §3.1). bench/crc32.mjs
// builds and drives it.
//
//   crc32 [scale]
//
// Six workloads, each timed alone in this process:
//
//   crc-64, crc-4k, crc-64k, crc-1m   `Crc32.update` on 64 B, 4 KiB, 64 KiB
//                                     and 1 MiB, 64 MiB of input each
//   gzip-compress-1m                  `GzipCompressor.compress` of 1 MiB
//   gzip-decompress-1m                `GzipDecompressor.decompress` of it back
//
// Each prints `time <workload> <ns> <bytes> <ops>` to stderr and stdout gets
// one line, a checksum over every answer. `scale` divides every iteration
// count (the driver's `--check` passes 64), so a short run does the same work
// in fewer turns. Which path ran, kernel or tables, is the process's
// (`NISH_CRC32`), not this program's: the driver names it.
//
// The checksum loops feed each call's answer into the next as its starting
// value, so no call can be lifted out of the loop, and the window moves by a
// byte each turn, so every start offset mod 16 is met. The gzip input is
// letters from a 16-letter alphabet, which compresses about 2:1 as text does:
// incompressible bytes would be stored blocks, CRC-32 nearly all of the work.
import { Crc32 } from "nish/compress/checksum"
import { DEFLATE_DEFAULT, compressBound } from "nish/compress/deflate"
import { GzipCompressor, GzipDecompressor } from "nish/compress/gzip"
import { monotonicNanos } from "nish:process"

/** The bytes each checksum workload covers at scale 1: 64 MiB. */
const CRC_BYTES: i32 = 67108864
/** The 1 MiB the gzip workloads compress, and their round trips at scale 1. */
const GZIP_BYTES: i32 = 1048576
const GZIP_OPS: i32 = 16

/** `n` letters, a to p, from a 32-bit LCG's top four bits. */
const letters = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  let x: u32 = toU32(20261030)
  for (let i: i32 = 0; i < n; i += 1) {
    x = x * toU32(1103515245) + toU32(12345)
    out[i] = toU8((x >>> 28) + toU32(97))
  }
  return out
}

const report = (name: string, started: i64, bytes: i64, ops: i32): void => {
  writeError(`time ${name} ${monotonicNanos() - started} ${bytes} ${ops}\n`)
}

/** `count` checksums of `size` bytes of `data`, chained; answers the last. */
const crcLoop = (name: string, k: Crc32, data: u8[], size: i32, count: i32, seed: u32): u32 => {
  let c: u32 = seed
  const room: i32 = toI32(data.length) - size
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i += 1) {
    c = k.update(c, data, i % 16 <= room ? i % 16 : 0, size)
  }
  report(name, started, toI64(size) * toI64(count), count)
  return c
}

export const main = (): i32 => {
  let scale: i32 = 1
  if (process.argv.length > 1) {
    scale = parseInt(process.argv[1])
  }
  if (scale < 1) {
    writeError("crc32: the scale is a positive count\n")
    return 2
  }
  const data: u8[] = letters(GZIP_BYTES + 16)
  const k: Crc32 = new Crc32()
  let sum: u32 = toU32(0)
  const sizes: i32[] = [64, 4096, 65536, 1048576]
  const names: string[] = ["crc-64", "crc-4k", "crc-64k", "crc-1m"]
  for (let s: i32 = 0; s < sizes.length; s += 1) {
    const count: i32 = CRC_BYTES / sizes[s] / scale
    sum = crcLoop(names[s], k, data, sizes[s], count, sum)
  }

  const ops: i32 = Math.max(1, GZIP_OPS / scale)
  const packer: GzipCompressor = new GzipCompressor(DEFLATE_DEFAULT)
  const packed: u8[] = new Array<u8>(compressBound(GZIP_BYTES) + 32)
  let end: i32 = 0
  let started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < ops; i += 1) {
    end = packer.compress(data, i % 16, GZIP_BYTES, packed, 0)
    if (end <= 0) {
      writeError(`crc32: compress answered ${end}\n`)
      return 1
    }
  }
  report("gzip-compress-1m", started, toI64(GZIP_BYTES) * toI64(ops), ops)
  sum = (sum ^ toU32(end)) * toU32(16777619)

  const unpacker: GzipDecompressor = new GzipDecompressor()
  const back: u8[] = new Array<u8>(GZIP_BYTES + 1)
  started = monotonicNanos()
  for (let i: i32 = 0; i < ops; i += 1) {
    const got: i32 = unpacker.decompress(packed, 0, end, back, 0, GZIP_BYTES + 1)
    if (got !== GZIP_BYTES) {
      writeError(`crc32: decompress answered ${got}\n`)
      return 1
    }
  }
  report("gzip-decompress-1m", started, toI64(GZIP_BYTES) * toI64(ops), ops)
  sum = (sum ^ k.update(toU32(0), back, 0, GZIP_BYTES)) * toU32(16777619)
  console.log(`checksum ${toI64(sum)}`)
  return 0
}
