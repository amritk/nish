// ECDSA over P-256 on the three calls a key's life makes: K5's baseline in
// WP34 (docs/wp34-hosting-cs.md, "K5: P-256, the baseline"), the measure a
// fixed-base table is judged by. bench/p256.mjs builds and drives it.
//
//   p256 [scale] [workload]
//
// Three workloads, each timed alone:
//
//   public-key   p256PublicKey, d·G, a fresh private key every iteration
//   sign         p256SignSha256 on a 64-byte message: what a TLS 1.3
//                server's CertificateVerify costs
//   verify       p256VerifySha256 of signatures made before the clock
//
// With no `workload` all three run in turn; with one, only that one runs, so
// the driver can give each its own process. Each prints `time <workload>
// <ns> <calls>` to stderr, and stdout gets one line, a checksum over every
// answer. `scale` divides every iteration count (the driver's `--check`
// passes 16), so a short run does the same work in fewer turns.
//
// The input changes on every iteration, so no call can be computed once for
// the whole loop: public-key stamps the iteration into the private key's last
// word, sign stamps it into the message's first word (and so into the digest
// and RFC 6979's nonce), and verify cycles through a ring of `RING` messages
// signed before its clock starts. Each answer goes into the checksum, a word
// at a time: the public key's first and last words of X and of Y, and every
// word of `r || s`. A `null` answer, or a signature that does not verify, ends
// the program with exit 1, so a refusal is never timed as though it had done
// the work.
import { p256PublicKey, p256SignSha256, p256VerifySha256 } from "nish/crypto/p256"
import { monotonicNanos } from "nish:process"
import { Secret, secret, wipe } from "nish:secret"

/** Signed messages the verify workload cycles through. */
const RING: i32 = 16

/** Each workload's calls at scale 1: about a fifth of a second of each on K5's 2.8 GHz x86-64. */
const KEYS: i32 = 256
const SIGNS: i32 = 256
const VERIFIES: i32 = 128

/** The checksum, carried between workloads: FNV-1a over `u32` words, which wraps, so folding costs no check. */
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

/**
 * `length` bytes of a fixed pattern. Its first byte is below 0xff whatever
 * the seed, so 32 of them are a scalar under the order n: a private key.
 */
const pattern = (length: i32, seed: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8((i * 131 + seed * 7 + 17) & 127)
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
  writeError(`p256: ${what} refused its input\n`)
  return 1
}

const report = (name: string, started: i64, calls: i32): void => {
  writeError(`time ${name} ${monotonicNanos() - started} ${calls}\n`)
}

/** The private key of iteration `i`: the pattern with `i` in its last word, never 0. */
const keyFor = (i: i32): Secret<u8[]> => {
  const d: u8[] = pattern(32, 1)
  stamp(d, 28, i)
  return secret(d)
}

/** `p256PublicKey`, `count` times, each on a new key: 0, or 1 on a `null`. */
const publicKeyLoop = (count: i32, f: Fold): i32 => {
  let sum: u32 = f.sum
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    const priv: Secret<u8[]> = keyFor(i)
    const pub: u8[] | null = p256PublicKey(priv)
    wipe(priv)
    if (pub === null) {
      return fail("public-key")
    }
    // 0x04 || X || Y: X's first and last words, then Y's.
    sum = foldWord(sum, pub, 1)
    sum = foldWord(sum, pub, 29)
    sum = foldWord(sum, pub, 33)
    sum = foldWord(sum, pub, 61)
  }
  report("public-key", started, count)
  f.sum = sum
  return 0
}

/** `p256SignSha256`, `count` times, on a message stamped with the iteration: 0, or 1 on a `null`. */
const signLoop = (count: i32, f: Fold): i32 => {
  const priv: Secret<u8[]> = keyFor(-1)
  const msg: u8[] = pattern(64, 2)
  let sum: u32 = f.sum
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    stamp(msg, 0, i)
    const sig: u8[] | null = p256SignSha256(priv, msg)
    if (sig === null) {
      wipe(priv)
      return fail("sign")
    }
    for (let at: i32 = 0; at < 64; at = at + 4) {
      sum = foldWord(sum, sig, at)
    }
  }
  report("sign", started, count)
  wipe(priv)
  f.sum = sum
  return 0
}

/** `p256VerifySha256`: `RING` messages signed before the clock, verified in turn. 0, or 1 on a refusal. */
const verifyLoop = (count: i32, f: Fold): i32 => {
  const priv: Secret<u8[]> = keyFor(-2)
  const pub: u8[] | null = p256PublicKey(priv)
  if (pub === null) {
    wipe(priv)
    return fail("verify's public key")
  }
  const msgs: u8[][] = []
  const sigs: u8[][] = []
  for (let r: i32 = 0; r < RING; r++) {
    const msg: u8[] = pattern(64, 3)
    stamp(msg, 0, r)
    const sig: u8[] | null = p256SignSha256(priv, msg)
    if (sig === null) {
      wipe(priv)
      return fail("verify's signing")
    }
    msgs.push(msg)
    sigs.push(sig)
  }
  wipe(priv)
  let sum: u32 = f.sum
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i++) {
    const r: i32 = i % RING
    // Always false, since both rings hold `RING` entries: it is the proof
    // the indices need, so the accesses below keep no bounds check.
    if (r < 0 || r >= toI32(msgs.length) || r >= toI32(sigs.length)) {
      return fail("verify")
    }
    if (!p256VerifySha256(pub, msgs[r], sigs[r])) {
      return fail("verify")
    }
    sum = (sum ^ toU32(r + 1)) * 16777619
  }
  report("verify", started, count)
  f.sum = sum
  return 0
}

export const main = (): i32 => {
  let scale: i32 = 1
  if (process.argv.length > 1) {
    scale = parseInt(process.argv[1])
  }
  if (scale < 1) {
    writeError("p256: the scale is a positive count\n")
    return 2
  }
  let only: string = ""
  if (process.argv.length > 2) {
    only = process.argv[2]
  }
  if (only !== "" && only !== "public-key" && only !== "sign" && only !== "verify") {
    writeError(`p256: no workload ${only}; public-key, sign or verify\n`)
    return 2
  }
  const f = new Fold()
  let failed: i32 = 0
  if (only === "" || only === "public-key") {
    failed = failed | publicKeyLoop(KEYS / scale, f)
  }
  if (only === "" || only === "sign") {
    failed = failed | signLoop(SIGNS / scale, f)
  }
  if (only === "" || only === "verify") {
    failed = failed | verifyLoop(VERIFIES / scale, f)
  }
  if (failed !== 0) {
    return 1
  }
  console.log(`checksum ${f.sum}`)
  return 0
}
