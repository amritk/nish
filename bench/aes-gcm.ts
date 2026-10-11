// The AEADs on the record sizes a server seals and opens: WP38 S5's baseline
// (docs/wp38-simd.md §7). bench/aes-gcm.mjs builds and drives it.
//
//   aes-gcm [scale]
//
// Nine workloads, each timed alone in this process:
//
//   aes-seal-16k, aes-open-16k     AES-128-GCM on 16 KiB, a full TLS record
//   aes-seal-1200, aes-open-1200   AES-128-GCM on 1,200 bytes, a QUIC packet
//   chacha-seal-16k, ...           ChaCha20-Poly1305 on the same two sizes
//   aes-header-mask                RFC 9001 §5.4.3's mask, one 16-byte sample
//
// Each prints `time <workload> <ns> <bytes>` to stderr, the bytes being what
// the workload sealed, opened or sampled, and stdout gets one line, a checksum
// over every answer. `scale` divides every iteration count (the driver's
// `--check` passes 64), so a short run does the same work in fewer turns.
//
// The input changes on every iteration, so no call can be computed once for
// the whole loop: seal folds the iteration into the IV's first word and the
// plaintext's first word, the mask into the sample. Open reads sealed
// messages made before its clock starts, a ring of `RING` of them sealed under
// different IVs, so consecutive iterations open different messages. Each
// answer goes into the checksum: the tag, which depends on every byte, and the
// first word of a sealed message, the first and last words of an opened one,
// and all five bytes of a mask. A `null` answer ends the program
// with exit 1, so a refusal is never timed as though it had done the work.
import { aesGcmOpen, aesGcmSeal, aesHeaderMask, AesKey, aesKey } from "nish/crypto/aes"
import { chacha20Poly1305Open, chacha20Poly1305Seal } from "nish/crypto/chacha20poly1305"
import { monotonicNanos } from "nish:process"

/** Sealed messages each open workload cycles through. */
const RING: i32 = 16

/** The records each 16 KiB workload handles at scale 1: 4 MiB. */
const RECORDS_16K: i32 = 256
/** The 1,200-byte workloads' count at scale 1: about 4 MB, as many bytes as the records. */
const PACKETS_1200: i32 = 3496
/** The header masks at scale 1. */
const MASKS: i32 = 65536

/** The checksum: FNV-1a over a `u32`, which wraps, so folding costs no check of its own. */
class Fold {
  sum: u32 = 2166136261
}

const foldByte = (f: Fold, b: u8): void => {
  f.sum = (f.sum ^ toU32(b)) * 16777619
}

/** Folds `count` bytes of `bytes` from `at`. */
const foldRange = (f: Fold, bytes: u8[], at: i32, count: i32): void => {
  for (let i: i32 = at; i < at + count && i >= 0 && i < toI32(bytes.length); i++) {
    foldByte(f, bytes[i])
  }
}

/** `length` bytes of a fixed pattern: no zero run for a cipher to hide in. */
const pattern = (length: i32, seed: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8((i * 131 + seed * 7 + 17) & 255)
  }
  return out
}

/** Writes `n` big-endian into `bytes[at..at + 4)`: how an iteration reaches its input. */
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
  writeError(`aes-gcm: ${what} answered null\n`)
  return 1
}

const report = (name: string, started: i64, bytes: i32): void => {
  writeError(`time ${name} ${monotonicNanos() - started} ${bytes}\n`)
}

/**
 * The work both AEADs share, so each is timed through the same loop: `aes`
 * picks the cipher. Seal answers 0, or 1 on a `null`.
 */
const sealLoop = (
  name: string,
  aes: boolean,
  key: AesKey,
  chachaKey: u8[],
  size: i32,
  count: i32,
  f: Fold
): i32 => {
  const iv: u8[] = pattern(12, 1)
  const aad: u8[] = pattern(13, 2)
  const plaintext: u8[] = pattern(size, 3)
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    stamp(iv, 0, i)
    stamp(plaintext, 0, i)
    const sealed: u8[] | null = aes
      ? aesGcmSeal(key, iv, aad, plaintext)
      : chacha20Poly1305Seal(chachaKey, iv, aad, plaintext)
    if (sealed === null) {
      return fail(name)
    }
    foldRange(f, sealed, 0, 4)
    foldRange(f, sealed, toI32(sealed.length) - 16, 16)
  }
  report(name, started, size * count)
  return 0
}

/** Open: `RING` messages sealed before the clock, opened in turn. 0, or 1 on a `null`. */
const openLoop = (
  name: string,
  aes: boolean,
  key: AesKey,
  chachaKey: u8[],
  size: i32,
  count: i32,
  f: Fold
): i32 => {
  const aad: u8[] = pattern(13, 2)
  // One IV and one plaintext, stamped with the message's number: the IV is
  // stamped again before each open, which is all it takes to name it.
  const iv: u8[] = pattern(12, 4)
  const plaintext: u8[] = pattern(size, 5)
  const sealed: u8[][] = []
  for (let r: i32 = 0; r < RING; r++) {
    stamp(iv, 0, r)
    stamp(plaintext, 0, r)
    const s: u8[] | null = aes
      ? aesGcmSeal(key, iv, aad, plaintext)
      : chacha20Poly1305Seal(chachaKey, iv, aad, plaintext)
    if (s === null) {
      return fail(name)
    }
    sealed.push(s)
  }
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    const r: i32 = i % RING
    // Always false, since the ring holds `RING` messages: it is the proof
    // the index needs, so the access below keeps no bounds check.
    if (r < 0 || r >= toI32(sealed.length)) {
      return fail(name)
    }
    stamp(iv, 0, r)
    const opened: u8[] | null = aes
      ? aesGcmOpen(key, iv, aad, sealed[r])
      : chacha20Poly1305Open(chachaKey, iv, aad, sealed[r])
    if (opened === null) {
      return fail(name)
    }
    foldRange(f, opened, 0, 4)
    foldRange(f, opened, toI32(opened.length) - 4, 4)
  }
  report(name, started, size * count)
  return 0
}

/** QUIC header protection: one mask per packet, the sample stamped with the iteration. */
const maskLoop = (key: AesKey, count: i32, f: Fold): i32 => {
  const sample: u8[] = pattern(16, 6)
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    stamp(sample, 0, i)
    const mask: u8[] | null = aesHeaderMask(key, sample)
    if (mask === null) {
      return fail("aes-header-mask")
    }
    foldRange(f, mask, 0, 5)
  }
  report("aes-header-mask", started, 16 * count)
  return 0
}

export const main = (): i32 => {
  let scale: i32 = 1
  if (process.argv.length > 1) {
    scale = parseInt(process.argv[1])
  }
  if (scale < 1) {
    writeError("aes-gcm: the scale is a positive count\n")
    return 2
  }
  const key: AesKey | null = aesKey(pattern(16, 7))
  if (key === null) {
    return fail("aesKey")
  }
  const chachaKey: u8[] = pattern(32, 8)
  const records: i32 = RECORDS_16K / scale
  const packets: i32 = PACKETS_1200 / scale
  const f = new Fold()
  let failed: i32 = 0
  failed = failed | sealLoop("aes-seal-16k", true, key, chachaKey, 16384, records, f)
  failed = failed | openLoop("aes-open-16k", true, key, chachaKey, 16384, records, f)
  failed = failed | sealLoop("aes-seal-1200", true, key, chachaKey, 1200, packets, f)
  failed = failed | openLoop("aes-open-1200", true, key, chachaKey, 1200, packets, f)
  failed = failed | sealLoop("chacha-seal-16k", false, key, chachaKey, 16384, records, f)
  failed = failed | openLoop("chacha-open-16k", false, key, chachaKey, 16384, records, f)
  failed = failed | sealLoop("chacha-seal-1200", false, key, chachaKey, 1200, packets, f)
  failed = failed | openLoop("chacha-open-1200", false, key, chachaKey, 1200, packets, f)
  failed = failed | maskLoop(key, MASKS / scale, f)
  if (failed !== 0) {
    return 1
  }
  console.log(`checksum ${f.sum}`)
  return 0
}
