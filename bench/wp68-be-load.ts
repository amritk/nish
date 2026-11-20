// WP68 S1 (docs/wp68-shared-libraries.md §4): the big-endian 32-bit loads std/
// carries, timed side by side, to pick the one a shared copy starts from. Each
// side reads the word at every offset of the same 4 MiB buffer, aligned or
// not, and folds the words into a checksum the program prints; all must agree.
// Every round writes one byte at a position that moves with the round, so no
// round's input is another's. `bytesB` is `bytesA` byte for byte, so the
// distance between those two is the run's noise band. The minimum of each side
// over the rounds is printed:
//
//   build/seed/bin/nish bench/wp68-be-load.ts --link build/wp68-be-load --profile speed
//   taskset -c 2 build/wp68-be-load
//
// `getU32BE` is the one the libraries run most: `getI32BE` wraps it, and the
// postgres decoders call that per array word, per int4 value and per message
// (std/net/postgres.ts, std/net/postgres-async.ts). This bench times the load alone; what a change
// is worth to those callers is bench/pg-decode's to say.
//
// Not timed, so unmeasured: `p256LoadWord`, `bcryptSaltWords`, and the inline
// loads in zlib, http1-server, tls/codec and std/net/websocket.ts:432;
// `aesLoad32` (std/crypto/aes.ts), which is `sha1LoadWord` with its shift
// counts written as `toU32(24)`; the inline `i32` loads that sign-extend the
// top byte (std/net/postgres.ts:1749 and :1983, std/net/postgres-async.ts:2210,
// std/net/websocket.ts:566); and std/net/tls.ts:2403, an `i64` load narrowed
// by `toU32`.
import { monotonicNanos } from "nish:process"
import { least, report } from "./wp68-report"

const ROUNDS: i32 = 9
const PASSES: i32 = 10
const SIZE: i32 = 4194304
const MOVE: i32 = 5237

/** `getU32BE`, std/bytes.ts, verbatim but for its name: the top byte multiplied in. */
const bytesA = (b: u8[], off: i32): u32 =>
  toU32(b[off]) * toU32(0x1000000) +
  ((toU32(b[off + 1]) << 16) | (toU32(b[off + 2]) << 8) | toU32(b[off + 3]))

/** Its twin, for the noise band. */
const bytesB = (b: u8[], off: i32): u32 =>
  toU32(b[off]) * toU32(0x1000000) +
  ((toU32(b[off + 1]) << 16) | (toU32(b[off + 2]) << 8) | toU32(b[off + 3]))

/** `sha1LoadWord`, std/crypto/sha1.ts: four shifts OR'd in `u32`. */
const shifts = (buf: u8[], at: i32): u32 =>
  (toU32(buf[at]) << 24) | (toU32(buf[at + 1]) << 16) | (toU32(buf[at + 2]) << 8) | toU32(buf[at + 3])

/** `http2FrameU32`, std/net/http2-frame.ts: the same in `i64`. */
const wide = (buf: u8[], at: i32): i64 =>
  (toI64(buf[at]) << toI64(24)) |
  (toI64(buf[at + 1]) << toI64(16)) |
  (toI64(buf[at + 2]) << toI64(8)) |
  toI64(buf[at + 3])

/** Every word of `buf` read by side `side`, folded with its offset. */
const sumSide = (buf: u8[], side: i32): i64 => {
  let s: i64 = 0
  const last: i32 = toI32(buf.length) - 4
  if (side === 0) {
    for (let i: i32 = 0; i <= last; i += 1) {
      s += toI64(bytesA(buf, i)) ^ toI64(i)
    }
  } else if (side === 1) {
    for (let i: i32 = 0; i <= last; i += 1) {
      s += toI64(bytesB(buf, i)) ^ toI64(i)
    }
  } else if (side === 2) {
    for (let i: i32 = 0; i <= last; i += 1) {
      s += toI64(shifts(buf, i)) ^ toI64(i)
    }
  } else {
    for (let i: i32 = 0; i <= last; i += 1) {
      s += wide(buf, i) ^ toI64(i)
    }
  }
  return s
}

export const main = (): i32 => {
  const buf = new Array<u8>(SIZE)
  let x: u32 = 2463534242
  for (let i = 0; i < SIZE && i < buf.length; i++) {
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    buf[i] = toU8(x & 255)
  }
  const names: string[] = ["bytesA", "bytesB", "shifts", "wide"]
  const best: i64[] = [-1, -1, -1, -1]
  const sums: i64[] = [0, 0, 0, 0]
  for (let round = 0; round < ROUNDS; round++) {
    const at: i32 = (round * MOVE) % SIZE
    if (at < 0 || at >= buf.length) {
      return 1
    }
    buf[at] = toU8(round)
    // Each round starts at a different side, so no side always runs first.
    for (let k = 0; k < 4; k++) {
      const side: i32 = (round + k) % 4
      if (side < 0 || side >= best.length || side >= sums.length) {
        return 1
      }
      const t0 = monotonicNanos()
      let s: i64 = 0
      for (let p = 0; p < PASSES; p++) {
        s += sumSide(buf, side)
      }
      best[side] = least(best[side], monotonicNanos() - t0)
      // Every bit of `s` is folded, so a load wrong in its top byte shows. `s`
      // is under 10 passes of 2^22 words of 2^32, about 2^58, and the running
      // sum is under 31 * 2^30, so the fold stays inside `i64`.
      sums[side] = (sums[side] * 31 + s) % 1000000007
    }
  }
  return report(names, best, sums)
}
