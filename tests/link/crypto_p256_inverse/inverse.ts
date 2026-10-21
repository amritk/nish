// P-256's two scalar inversions held to each other, bit for bit (#758).
//
// `p256Sign` and `p256SignSha256Into` invert the nonce with
// `p256ScalarInverse`, Bernstein and Yang's safegcd in 20 batches of 30
// divsteps; `p256ScalarInvert`, the Fermat ladder `a^(n - 2)` it replaced,
// stays in the module as the reference (and as `p256Verify`'s inversion of the
// public `s`). This program requires the two to answer the same 32 bytes for
// every scalar below, and prints how many did.
//
// **The seam.** Neither inversion is exported, and this test adds no public
// API to reach them. `tests/run.js` ("p256 inverse: ...") copies
// std/crypto/p256.ts, appends `seam.ts.in` to it — `p256SeamInverse` and
// `p256SeamInvert`, each taking 32 big-endian bytes, reducing them mod n,
// inverting in the Montgomery domain and answering the plain inverse — and
// compiles this file as the `main.ts` of a directory holding that copy as
// `./p256`, the shape tests/link/crypto_p256_agree takes.
//
// What it runs:
//
// - the inverses of 2 and of n - 1 that arithmetic gives, (n + 1) / 2 and
//   n - 1;
// - edges: 0 (whose inverse both answer as 0), 1, 2, 3, n - 2, n - 1, n
//   (which reduces to 0), n + 1, 2^256 - 1, every 2^k and 2^k - 1, every byte
//   repeated across all 32 (0x55..., 0xaa..., 0xff... among them), and n plus
//   and minus each 2^(30 j), where a signed-30 limb boundary falls;
// - a seeded corpus of 10,000 random 32-byte scalars.
//
// Every safegcd output is folded into one checksum, so equal lines mean equal
// bytes. `tests/run.js` runs it natively and as a `--profile wasi` module
// under Node.
import { p256SeamInverse, p256SeamInvert } from "./p256"
import { fromHex, toHex } from "../crypto_p256/hex"

/** xorshift64 (Marsaglia, 2003): a fixed stream of test words, not a secret. */
const nextWord = (state: u64[]): u64 => {
  let x: u64 = state[0]
  x = x ^ (x << toU64(13))
  x = x ^ (x >> toU64(7))
  x = x ^ (x << toU64(17))
  state[0] = x
  return x
}

/** Folds `bytes` into the FNV-1a hash in `hash[0]`. */
const fold = (hash: u64[], bytes: u8[]): void => {
  const prime: u64 = toU64(0x01000193)
  const mask: u64 = (toU64(1) << toU64(32)) - toU64(1)
  let h: u64 = hash[0]
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    h = ((h ^ toU64(bytes[i])) * prime) & mask
  }
  hash[0] = h
}

// The group order n (SEC 2 §2.4.2), and the inverse of 2 mod n.
const N: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"
const HALF: string = "7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a9"

/** The number of random scalars in the corpus. */
const CORPUS: i32 = 10000

/** What the checks counted. */
class Tally {
  scalars: i32 = 0
  agreed: i32 = 0
  reported: i32 = 0
}

/** Both inversions of `k`, folded and compared; the safegcd answer. */
const agree = (hash: u64[], tally: Tally, name: string, k: u8[]): u8[] => {
  const inverse: u8[] = p256SeamInverse(k)
  const reference: u8[] = p256SeamInvert(k)
  fold(hash, inverse)
  tally.scalars = tally.scalars + 1
  if (toHex(inverse) === toHex(reference)) {
    tally.agreed = tally.agreed + 1
  } else if (tally.reported < 10) {
    tally.reported = tally.reported + 1
    console.log(`disagree: ${name} k = ${toHex(k)}`)
    console.log(`  safegcd ${toHex(inverse)}`)
    console.log(`  fermat  ${toHex(reference)}`)
  }
  return inverse
}

/** 32 big-endian bytes of `a + 2^bit` (mod 2^256) when `add`, of `a - 2^bit` otherwise. */
const offset = (a: u8[], bit: i32, add: boolean): u8[] => {
  const out: u8[] = new Array<u8>(32)
  if (toI32(a.length) < 32) {
    return out
  }
  let carry: i32 = 0
  for (let i: i32 = 31; i >= 0; i--) {
    const byteIndex: i32 = 31 - i
    let step: i32 = 0
    if (byteIndex === bit / 8) {
      step = 1 << (bit % 8)
    }
    const sum: i32 = add ? toI32(a[i]) + step + carry : toI32(a[i]) - step - carry
    out[i] = toU8(sum & 0xff)
    if (add) {
      carry = sum > 0xff ? 1 : 0
    } else {
      carry = sum < 0 ? 1 : 0
    }
  }
  return out
}

/** 32 bytes of zero. */
const zeros = (): u8[] => new Array<u8>(32)

/** 2^bit as 32 big-endian bytes, `bit` in [0, 256). */
const power = (bit: i32): u8[] => offset(zeros(), bit, true)

export const main = (): i32 => {
  const hash: u64[] = [(toU64(0x81) << toU64(24)) | toU64(0x1c9dc5)]
  const n: u8[] = fromHex(N)
  const one: u8[] = power(0)
  const two: u8[] = power(1)

  const known = new Tally()
  let published: i32 = 0
  if (toHex(agree(hash, known, "2", two)) === HALF) {
    published = published + 1
  }
  const nMinusOne: u8[] = offset(n, 0, false)
  if (toHex(agree(hash, known, "n - 1", nMinusOne)) === toHex(nMinusOne)) {
    published = published + 1
  }
  console.log(`known: ${known.agreed} of ${known.scalars} scalars agree, ${published} as arithmetic gives`)

  const edges = new Tally()
  agree(hash, edges, "0", zeros())
  agree(hash, edges, "1", one)
  agree(hash, edges, "3", offset(two, 0, true))
  agree(hash, edges, "n - 2", offset(n, 1, false))
  agree(hash, edges, "n", n)
  agree(hash, edges, "n + 1", offset(n, 0, true))
  for (let bit: i32 = 0; bit < 256; bit++) {
    const p: u8[] = power(bit)
    agree(hash, edges, `2^${bit}`, p)
    agree(hash, edges, `2^${bit} - 1`, offset(p, 0, false))
  }
  agree(hash, edges, "2^256 - 1", offset(zeros(), 0, false))
  for (let b: i32 = 1; b < 256; b++) {
    const repeated: u8[] = new Array<u8>(32)
    for (let i: i32 = 0; i < 32; i++) {
      repeated[i] = toU8(b)
    }
    agree(hash, edges, `byte ${b} repeated`, repeated)
  }
  for (let j: i32 = 0; j < 9; j++) {
    agree(hash, edges, `n + 2^${30 * j}`, offset(n, 30 * j, true))
    agree(hash, edges, `n - 2^${30 * j}`, offset(n, 30 * j, false))
  }
  console.log(`edges: ${edges.agreed} of ${edges.scalars} scalars agree`)

  const corpus = new Tally()
  const state: u64[] = [(toU64(0x1e3779b9) << toU64(32)) | toU64(0x7f4a7c15)]
  for (let c: i32 = 0; c < CORPUS; c++) {
    const k: u8[] = new Array<u8>(32)
    for (let i: i32 = 0; i < 32; i++) {
      k[i] = toU8(nextWord(state) & toU64(0xff))
    }
    agree(hash, corpus, `corpus ${c}`, k)
  }
  console.log(`corpus: ${corpus.agreed} of ${corpus.scalars} scalars agree`)
  console.log(`checksum: ${hash[0]}`)
  return 0
}
