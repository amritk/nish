// ChaCha20-Poly1305 seal and open at 64 B, 1 KiB, 16 KiB and 1 MiB: WP38
// S10's measure (docs/wp38-simd.md §3.1). bench/chacha20.mjs builds it with
// bench/chacha20/kernel.c and drives it.
//
//   chacha20 std|kernel [scale]
//
// `std` times std/crypto/chacha20poly1305.ts, the scalar Nish that ships.
// `kernel` times bench/chacha20/aead.ts, the same file with ChaCha20's
// keystream loop handed to kernel.c, whose path (`scalar`, `vec128`, `avx2`,
// `neon`) the environment's `BENCH_CHACHA20` names. Ten workloads, each timed
// alone in this process:
//
//   seal-64 ... seal-1m, open-64 ... open-1m   the AEAD at the four sizes
//   chacha20-16k, poly1305-16k                 each half alone on 16 KiB
//
// The halves say where the AEAD's time goes, which is what decides whether
// Poly1305 is worth a kernel too; poly1305-16k runs the same Nish in both
// modes. Each workload prints `time <workload> <ns> <bytes> <ops>` to stderr
// and stdout gets one line, a checksum over every answer, which both modes
// and every path must print alike. `scale` divides every iteration count
// (the driver's `--check` passes 64).
//
// The input changes on every iteration, as bench/aes-gcm.ts's does: seal and
// the halves stamp the iteration into the nonce and the first plaintext word,
// open reads a ring of `RING` messages sealed before its clock starts. The
// first word and the tag of a sealed message, the first and last words of an
// opened one and of a keystream, and every word of a Poly1305 tag go into
// the checksum. A `null` answer ends the program with exit 1.
import {
  chacha20 as protoChacha20,
  chacha20Poly1305Open as protoOpen,
  chacha20Poly1305Seal as protoSeal,
} from "./chacha20/aead"
import { chacha20, chacha20Poly1305Open, chacha20Poly1305Seal, poly1305 } from "nish/crypto/chacha20poly1305"
import { monotonicNanos } from "nish:process"

/** Sealed messages each open workload cycles through. */
const RING: i32 = 16

/** The bytes each workload covers at scale 1: 32 MiB. */
const TOTAL: i32 = 33554432

/** The checksum, carried between workloads: FNV-1a over `u32` words. */
class Fold {
  sum: u32 = 2166136261
}

/** Folds the big-endian word at `bytes[at..at + 4)` into `sum`. */
const foldWord = (sum: u32, bytes: u8[], at: i32): u32 => {
  if (at < 0 || at + 4 > toI32(bytes.length)) {
    return sum
  }
  const w: u32 =
    (toU32(bytes[at]) << 24) |
    (toU32(bytes[at + 1]) << 16) |
    (toU32(bytes[at + 2]) << 8) |
    toU32(bytes[at + 3])
  return (sum ^ w) * 16777619
}

/** `length` bytes of a fixed pattern: no zero run for a cipher to hide in. */
const pattern = (length: i32, seed: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8((i * 131 + seed * 7 + 17) & 255)
  }
  return out
}

/** Writes `n` big-endian into `bytes[at..at + 4)`. */
const stamp = (bytes: u8[], at: i32, n: i32): void => {
  if (at < 0 || at + 4 > toI32(bytes.length)) {
    return
  }
  bytes[at] = toU8((n >> 24) & 255)
  bytes[at + 1] = toU8((n >> 16) & 255)
  bytes[at + 2] = toU8((n >> 8) & 255)
  bytes[at + 3] = toU8(n & 255)
}

const fail = (what: string): i32 => {
  writeError(`chacha20: ${what} answered null\n`)
  return 1
}

const seal = (kernel: boolean, key: u8[], iv: u8[], aad: u8[], plaintext: u8[]): u8[] | null =>
  kernel ? protoSeal(key, iv, aad, plaintext) : chacha20Poly1305Seal(key, iv, aad, plaintext)

const open = (kernel: boolean, key: u8[], iv: u8[], aad: u8[], sealed: u8[]): u8[] | null =>
  kernel ? protoOpen(key, iv, aad, sealed) : chacha20Poly1305Open(key, iv, aad, sealed)

const report = (name: string, started: i64, bytes: i32, ops: i32): void => {
  writeError(`time ${name} ${monotonicNanos() - started} ${bytes} ${ops}\n`)
}

/** How many `size`-byte messages make the workload's bytes at `scale`: at least one. */
const countFor = (size: i32, scale: i32): i32 => {
  const n: i32 = TOTAL / size / scale
  return n < 1 ? 1 : n
}

/** Seal, `count` times: 0, or 1 on a `null`. */
const sealLoop = (name: string, kernel: boolean, key: u8[], size: i32, count: i32, f: Fold): i32 => {
  const iv: u8[] = pattern(12, 1)
  const aad: u8[] = pattern(13, 2)
  const plaintext: u8[] = pattern(size, 3)
  let sum: u32 = f.sum
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    stamp(iv, 0, i)
    stamp(plaintext, 0, i)
    const sealed: u8[] | null = seal(kernel, key, iv, aad, plaintext)
    if (sealed === null) {
      return fail(name)
    }
    const tag: i32 = toI32(sealed.length) - 16
    sum = foldWord(sum, sealed, 0)
    sum = foldWord(sum, sealed, tag)
    sum = foldWord(sum, sealed, tag + 4)
    sum = foldWord(sum, sealed, tag + 8)
    sum = foldWord(sum, sealed, tag + 12)
  }
  report(name, started, size * count, count)
  f.sum = sum
  return 0
}

/** Open: `RING` messages sealed before the clock, opened in turn. 0, or 1 on a `null`. */
const openLoop = (name: string, kernel: boolean, key: u8[], size: i32, count: i32, f: Fold): i32 => {
  const aad: u8[] = pattern(13, 2)
  const iv: u8[] = pattern(12, 4)
  const plaintext: u8[] = pattern(size, 5)
  const sealed: u8[][] = []
  for (let r: i32 = 0; r < RING; r++) {
    stamp(iv, 0, r)
    stamp(plaintext, 0, r)
    const s: u8[] | null = seal(kernel, key, iv, aad, plaintext)
    if (s === null) {
      return fail(name)
    }
    sealed.push(s)
  }
  let sum: u32 = f.sum
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    const r: i32 = i % RING
    if (r < 0 || r >= toI32(sealed.length)) {
      return fail(name)
    }
    stamp(iv, 0, r)
    const opened: u8[] | null = open(kernel, key, iv, aad, sealed[r])
    if (opened === null) {
      return fail(name)
    }
    sum = foldWord(sum, opened, 0)
    sum = foldWord(sum, opened, toI32(opened.length) - 4)
  }
  report(name, started, size * count, count)
  f.sum = sum
  return 0
}

/** ChaCha20 alone on 16 KiB: the AEAD's cipher half, counter 1 as the AEAD runs it. */
const cipherLoop = (kernel: boolean, key: u8[], count: i32, f: Fold): i32 => {
  const iv: u8[] = pattern(12, 6)
  const data: u8[] = pattern(16384, 7)
  let sum: u32 = f.sum
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    stamp(iv, 0, i)
    stamp(data, 0, i)
    const out: u8[] | null = kernel ? protoChacha20(key, 1, iv, data) : chacha20(key, 1, iv, data)
    if (out === null) {
      return fail("chacha20-16k")
    }
    sum = foldWord(sum, out, 0)
    sum = foldWord(sum, out, toI32(out.length) - 4)
  }
  report("chacha20-16k", started, 16384 * count, count)
  f.sum = sum
  return 0
}

/** Poly1305 alone on 16 KiB, the one-time key stamped with the iteration. */
const macLoop = (count: i32, f: Fold): i32 => {
  const key: u8[] = pattern(32, 8)
  const msg: u8[] = pattern(16384, 9)
  let sum: u32 = f.sum
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    stamp(key, 0, i)
    stamp(msg, 0, i)
    const tag: u8[] | null = poly1305(key, msg)
    if (tag === null) {
      return fail("poly1305-16k")
    }
    sum = foldWord(sum, tag, 0)
    sum = foldWord(sum, tag, 4)
    sum = foldWord(sum, tag, 8)
    sum = foldWord(sum, tag, 12)
  }
  report("poly1305-16k", started, 16384 * count, count)
  f.sum = sum
  return 0
}

export const main = (): i32 => {
  if (process.argv.length < 2 || (process.argv[1] !== "std" && process.argv[1] !== "kernel")) {
    writeError("usage: chacha20 std|kernel [scale]\n")
    return 2
  }
  const kernel: boolean = process.argv[1] === "kernel"
  let scale: i32 = 1
  if (process.argv.length > 2) {
    scale = parseInt(process.argv[2])
  }
  if (scale < 1) {
    writeError("chacha20: the scale is a positive count\n")
    return 2
  }
  const key: u8[] = pattern(32, 10)
  const f = new Fold()
  let failed: i32 = 0
  failed = failed | sealLoop("seal-64", kernel, key, 64, countFor(64, scale), f)
  failed = failed | sealLoop("seal-1k", kernel, key, 1024, countFor(1024, scale), f)
  failed = failed | sealLoop("seal-16k", kernel, key, 16384, countFor(16384, scale), f)
  failed = failed | sealLoop("seal-1m", kernel, key, 1048576, countFor(1048576, scale), f)
  failed = failed | openLoop("open-64", kernel, key, 64, countFor(64, scale), f)
  failed = failed | openLoop("open-1k", kernel, key, 1024, countFor(1024, scale), f)
  failed = failed | openLoop("open-16k", kernel, key, 16384, countFor(16384, scale), f)
  failed = failed | openLoop("open-1m", kernel, key, 1048576, countFor(1048576, scale), f)
  failed = failed | cipherLoop(kernel, key, countFor(16384, scale), f)
  failed = failed | macLoop(countFor(16384, scale), f)
  if (failed !== 0) {
    return 1
  }
  console.log(`checksum ${f.sum}`)
  return 0
}
