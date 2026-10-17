// WP41's bar (docs/wp41-mul-wide.md §2), natively: bench/mul-wide.mjs builds
// and drives it.
//
//   mul-wide <kernel> [scale]
//
// `kernel` is `base` or `std` (bench/mul-wide-kernels.ts); the MACs are 2^12
// divided by `scale`. It prints `time poly1305 <ns> <bytes>` to stderr, the
// nanoseconds of macRun alone, and `checksum <sum>` to stdout.
import { monotonicNanos } from "nish:process"
import { MACS, MESSAGE_BYTES, macRun } from "./mul-wide-kernels.ts"

export const main = (): i32 => {
  if (process.argv.length < 2 || (process.argv[1] !== "base" && process.argv[1] !== "std")) {
    writeError("mul-wide: the kernel is base or std\n")
    return 2
  }
  const kernel: i32 = process.argv[1] === "base" ? 0 : 1
  let scale: i32 = 1
  if (process.argv.length > 2) {
    scale = parseInt(process.argv[2])
  }
  if (scale < 1) {
    writeError("mul-wide: the scale is a positive count\n")
    return 2
  }
  const macs: i32 = MACS / scale
  const started: i64 = monotonicNanos()
  const sum: u32 = macRun(kernel, macs, MESSAGE_BYTES)
  writeError(`time poly1305 ${monotonicNanos() - started} ${macs * MESSAGE_BYTES}\n`)
  if (sum === 0) {
    writeError("mul-wide: a kernel answered null\n")
    return 1
  }
  console.log(`checksum ${sum}`)
  return 0
}
