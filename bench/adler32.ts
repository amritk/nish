// Adler-32 at 64 KiB and 1 MiB on the Nish `adler32Update`: the side of WP38's
// vector Adler-32 measure that ships today (docs/wp38-simd.md §3.2).
// bench/adler32.mjs builds and drives it, beside bench/adler32/kernel.c.
//
//   adler32 [scale]
//
// Two workloads, each timed alone in this process: `adler32Update` on 64 KiB
// and on 1 MiB, 64 MiB of input each. Each prints `time <workload> <ns>
// <bytes> <ops>` to stderr and stdout gets one line, `checksum <n>`, the last
// answer. bench/adler32/kernel.c prints the same lines on the same bytes in the
// same chain, so the two checksums are equal or the kernel answers wrong.
// `scale` divides every iteration count (the driver's `--check` passes 64).
//
// Each call's answer is the next call's starting value, so no call can be
// lifted out of the loop, and the window moves by a byte each turn, so every
// start offset mod 16 is met. The input is a 32-bit LCG's top byte.
import { adler32Update } from "nish/compress/checksum"
import { monotonicNanos } from "nish:process"

/** The bytes each workload covers at scale 1: 64 MiB. */
const TOTAL: i32 = 67108864
/** The largest window and the 16 bytes it moves over. */
const DATA: i32 = 1048576 + 16

const bytes = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n)
  let x: u32 = toU32(20261030)
  for (let i: i32 = 0; i < n; i += 1) {
    x = x * toU32(1103515245) + toU32(12345)
    out[i] = toU8(x >>> 24)
  }
  return out
}

export const main = (): i32 => {
  let scale: i32 = 1
  if (process.argv.length > 1) {
    scale = parseInt(process.argv[1])
  }
  if (scale < 1) {
    writeError("adler32: the scale is a positive count\n")
    return 2
  }
  const data: u8[] = bytes(DATA)
  const sizes: i32[] = [65536, 1048576]
  const names: string[] = ["adler-64k", "adler-1m"]
  let a: u32 = toU32(1)
  for (let s: i32 = 0; s < sizes.length; s += 1) {
    const count: i32 = TOTAL / sizes[s] / scale
    const started: i64 = monotonicNanos()
    for (let i: i32 = 0; i < count; i += 1) {
      a = adler32Update(a, data, i % 16, sizes[s])
    }
    writeError(`time ${names[s]} ${monotonicNanos() - started} ${toI64(sizes[s]) * toI64(count)} ${count}\n`)
  }
  console.log(`checksum ${toI64(a)}`)
  return 0
}
