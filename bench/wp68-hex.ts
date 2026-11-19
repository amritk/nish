// WP68 S1 (docs/wp68-shared-libraries.md §4): the hex-digit decoders std/ and
// src/ carry, timed side by side, to pick the one a shared copy starts from.
// Each side decodes every element of the same 4 MiB buffer and folds the
// values into a checksum the program prints; all must agree. `chainB` is
// `chainA` byte for byte, so the distance between those two is the run's noise
// band. Every round writes one element at a position that moves with the
// round, so no round's input is another's. The minimum of each side over the
// rounds is printed:
//
//   build/seed/bin/nish bench/wp68-hex.ts --link build/wp68-hex --profile speed
//   taskset -c 2 build/wp68-hex
//
// Four inputs are timed, each with its own twin band and checksums:
//
// - "mixed bytes": `u8` drawn at random from 32 symbols, 22 of them hex
//   digits; the other ten are the bytes next to each range (`/ : @` and the
//   backtick, `G`, `g`), 0x00, space, 0x80 and 0xff. Every class at random is
//   the worst case for a copy that branches on the class, so its ratios are a
//   maximum, not a typical gain.
// - "random hex bytes": lower-case hex digits at random, the shape of a hash.
//   The digit-or-letter branch is still taken at random, so this is not a
//   predictable case.
// - "digit bytes": `0` to `9` only, where every branch goes the same way: the
//   predictable case.
// - "mixed code units": `i32` code units, as `charCodeAt` gives most callers,
//   drawn from the 22 hex digits, -1 (the "no byte" several callers pass), the
//   neighbours `/ : @`, 0x00 and five units from 0x100 up (0x130, 0x660,
//   0xff10, 0xff21, 0xff41). The table there is `guarded`: it answers -1 for
//   anything outside `[0, 256)` before it indexes.
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

/** The candidate for an `i32` caller: -1 outside `[0, 256)`, else the table. */
const guardedValue = (c: i32): i32 => {
  if (c < 0 || c >= 256) {
    return -1
  }
  const v: i32 = toI32(HEX[c])
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

const unitsChainA = (buf: i32[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(chainValue(buf[i]) + 1) * toI64((i & 7) + 1)
  }
  return s
}

const unitsChainB = (buf: i32[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(chainTwin(buf[i]) + 1) * toI64((i & 7) + 1)
  }
  return s
}

const unitsLower = (buf: i32[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(lowerValue(buf[i]) + 1) * toI64((i & 7) + 1)
  }
  return s
}

const unitsMask = (buf: i32[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(maskValue(buf[i]) + 1) * toI64((i & 7) + 1)
  }
  return s
}

const unitsGuarded = (buf: i32[]): i64 => {
  let s: i64 = 0
  for (let i = 0; i < buf.length; i++) {
    s += toI64(guardedValue(buf[i]) + 1) * toI64((i & 7) + 1)
  }
  return s
}

/** Times every side over 4 MiB of bytes drawn from `symbols`, whose length is `mask + 1`, and prints the report under `title`. */
const measure = (title: string, symbols: i32[], mask: u32): i32 => {
  console.log(title)
  const buf = new Array<u8>(SIZE)
  let x: u32 = 2463534242
  for (let i = 0; i < SIZE && i < buf.length; i++) {
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    const draw: i32 = toI32(x & mask)
    buf[i] = toU8(symbols[draw])
  }
  const names: string[] = ["chainA", "chainB", "lower", "mask", "table"]
  const best: i64[] = [-1, -1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0, 0]
  for (let round = 0; round < ROUNDS; round++) {
    const at: i32 = (round * MOVE) % SIZE
    if (at < 0 || at >= buf.length) {
      return 1
    }
    const pick: i32 = round & toI32(mask)
    buf[at] = toU8(symbols[pick])
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

/** As `measure`, over 4 MiB of `i32` code units, with the guarded table as the fifth side. */
const measureUnits = (title: string, symbols: i32[], mask: u32): i32 => {
  console.log(title)
  const buf = new Array<i32>(SIZE)
  let x: u32 = 2463534242
  for (let i = 0; i < SIZE && i < buf.length; i++) {
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    const draw: i32 = toI32(x & mask)
    buf[i] = symbols[draw]
  }
  const names: string[] = ["chainA", "chainB", "lower", "mask", "guarded"]
  const best: i64[] = [-1, -1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0, 0]
  for (let round = 0; round < ROUNDS; round++) {
    const at: i32 = (round * MOVE) % SIZE
    if (at < 0 || at >= buf.length) {
      return 1
    }
    const pick: i32 = round & toI32(mask)
    buf[at] = symbols[pick]
    for (let k = 0; k < 5; k++) {
      const side: i32 = (round + k) % 5
      if (side < 0 || side >= best.length || side >= sums.length) {
        return 1
      }
      const t0 = monotonicNanos()
      let s: i64 = 0
      for (let p = 0; p < PASSES; p++) {
        if (side === 0) {
          s += unitsChainA(buf)
        } else if (side === 1) {
          s += unitsChainB(buf)
        } else if (side === 2) {
          s += unitsLower(buf)
        } else if (side === 3) {
          s += unitsMask(buf)
        } else {
          s += unitsGuarded(buf)
        }
      }
      best[side] = least(best[side], monotonicNanos() - t0)
      sums[side] = (sums[side] * 31 + s) % 1000000007
    }
  }
  return report(names, best, sums)
}

export const main = (): i32 => {
  // 22 hex digits, then ten bytes beside or outside the ranges.
  // biome-ignore format: one class a line
  const mixed: i32[] = [
    48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
    97, 98, 99, 100, 101, 102, 65, 66, 67, 68, 69, 70,
    47, 58, 64, 96, 71, 103, 0, 32, 128, 255,
  ]
  const randomHex: i32[] = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102]
  const digits: i32[] = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 48, 49, 50, 51, 52, 53]
  // biome-ignore format: one class a line
  const units: i32[] = [
    48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
    97, 98, 99, 100, 101, 102, 65, 66, 67, 68, 69, 70,
    -1, 0, 47, 58, 64, 304, 1632, 65296, 65313, 65345,
  ]
  const a = measure("mixed bytes: 32 symbols, 22 of them hex digits, every class at random", mixed, 31)
  const b = measure("random hex bytes: lower-case hex digits at random", randomHex, 15)
  const c = measure("digit bytes: 0 to 9 only, every branch the same way", digits, 15)
  const d = measureUnits(
    "mixed code units: i32, 22 hex digits and 10 others, 5 of them from 0x100 up",
    units,
    31
  )
  return a + b + c + d
}
