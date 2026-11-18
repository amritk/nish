// WP68 S1 (docs/wp68-shared-libraries.md §4): the hex-digit decoders std/ and
// src/ carry, timed side by side, to pick the one a shared copy starts from.
// Each side decodes every byte of the same 4 MiB buffer and folds the values
// into a checksum the program prints; all must agree. `chainB` is `chainA`
// byte for byte, so the distance between those two is the run's noise band.
// Every round writes one byte at a position that moves with the round, so no
// round's input is another's. The minimum of each side over the rounds is
// printed:
//
//   build/seed/bin/nish bench/wp68-hex.ts --link build/wp68-hex --profile speed
//   taskset -c 2 build/wp68-hex
//
// Two inputs are timed, each with its own twin band and checksums. "mixed"
// draws from 32 symbols, 22 of them hex digits, every class at random: the
// worst case for a copy that branches on the class, so its ratios are a
// maximum, not a typical gain. "hash" draws lower-case hex digits only, the
// shape of a hash, where every branch is predictable.
import { monotonicNanos } from "nish:process"
import { least, report } from "./wp68-report"

// biome-ignore format: one row a line, 32 bytes each
const HEX: readonly u8[] = [
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 255, 255, 255, 255, 255, 255,
  255, 10, 11, 12, 13, 14, 15, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  255, 10, 11, 12, 13, 14, 15, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
]

/** Every class at random: the worst case for a copy that branches on the class. */
const MIXED: string = "0123456789abcdefABCDEFgxyz %-_GZ"
/** Lower-case digits only, the shape of a hash: the predictable case. */
const HASH: string = "0123456789abcdef"
const ROUNDS: i32 = 9
const PASSES: i32 = 20
const SIZE: i32 = 4194304
const MOVE: i32 = 5237

/** `http1HexValue`, std/net/http1-codec.ts, verbatim but for its name: the copy six files repeat. */
const chainValue = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48
  }
  if (c >= 97 && c <= 102) {
    return c - 87
  }
  if (c >= 65 && c <= 70) {
    return c - 55
  }
  return -1
}

/** Its twin, for the noise band. */
const chainTwin = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48
  }
  if (c >= 97 && c <= 102) {
    return c - 87
  }
  if (c >= 65 && c <= 70) {
    return c - 55
  }
  return -1
}

/** `hexDigit`, std/math.ts: one range for both cases by setting bit 5. */
const lowerValue = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48
  }
  const lower: i32 = c | 32
  return lower >= 97 && lower <= 102 ? lower - 87 : -1
}

/** `manifestHexDigit`, src/manifest.ts: the value from the low bits. */
const maskValue = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c & 15
  }
  if ((c >= 97 && c <= 102) || (c >= 65 && c <= 70)) {
    return (c & 7) + 9
  }
  return -1
}

/** The candidate: one load from a 256-entry table indexed by the byte. */
const tableValue = (b: u8): i32 => {
  const v: i32 = toI32(HEX[b])
  return v === 255 ? -1 : v
}

const sumChainA = (buf: u8[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(chainValue(toI32(buf[i])) + 1) * toI64((i & 7) + 1)
  }
  return s
}

const sumChainB = (buf: u8[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(chainTwin(toI32(buf[i])) + 1) * toI64((i & 7) + 1)
  }
  return s
}

const sumLower = (buf: u8[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(lowerValue(toI32(buf[i])) + 1) * toI64((i & 7) + 1)
  }
  return s
}

const sumMask = (buf: u8[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(maskValue(toI32(buf[i])) + 1) * toI64((i & 7) + 1)
  }
  return s
}

const sumTable = (buf: u8[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(tableValue(buf[i]) + 1) * toI64((i & 7) + 1)
  }
  return s
}

/** Times every side over 4 MiB drawn from `symbols`, whose length is `mask + 1`, and prints the report under `title`. */
const measure = (title: string, symbols: string, mask: u32): i32 => {
  console.log(title)
  const buf = new Array<u8>(SIZE)
  let x: u32 = 2463534242
  for (let i = 0; i < SIZE && i < buf.length; i++) {
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    buf[i] = toU8(symbols.charCodeAt(toI32(x & mask)))
  }
  const names: string[] = ["chainA", "chainB", "lower", "mask", "table"]
  const best: i64[] = [-1, -1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0, 0]
  for (let round = 0; round < ROUNDS; round++) {
    const at: i32 = (round * MOVE) % SIZE
    if (at < 0 || at >= buf.length) {
      return 1
    }
    buf[at] = toU8(symbols.charCodeAt(round & toI32(mask)))
    // Each round starts at a different side, so no side always runs first.
    for (let k = 0; k < 5; k++) {
      const side: i32 = (round + k) % 5
      if (side < 0 || side >= best.length || side >= sums.length) {
        return 1
      }
      const t0 = monotonicNanos()
      let s: i64 = 0
      for (let p = 0; p < PASSES; p++) {
        if (side === 0) {
          s += sumChainA(buf)
        } else if (side === 1) {
          s += sumChainB(buf)
        } else if (side === 2) {
          s += sumLower(buf)
        } else if (side === 3) {
          s += sumMask(buf)
        } else {
          s += sumTable(buf)
        }
      }
      best[side] = least(best[side], monotonicNanos() - t0)
      sums[side] = (sums[side] * 31 + s) % 1000000007
    }
  }
  return report(names, best, sums)
}

export const main = (): i32 => {
  const mixed = measure("mixed: 32 symbols, 22 of them hex digits, every class at random", MIXED, 31)
  const hash = measure("hash: lower-case hex digits only", HASH, 15)
  return mixed + hash
}
