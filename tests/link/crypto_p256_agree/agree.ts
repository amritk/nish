// P-256's fixed-base comb against its variable-base window, end to end (#628).
//
// `p256PublicKey` and `p256Sign` compute k G with `p256BaseMult`, a 4-tooth comb
// over a precomputed table of G's multiples; `p256Verify` and ECDH still compute
// it with `p256ScalarMult`, the 4-bit window over a table built from the point.
// This program requires the two to give the same encoded point, byte for byte,
// for every scalar below, and prints how many did.
//
// **The seam.** Neither multiply is exported, and this test adds no public API
// to reach them. `tests/run.js` ("p256 agree: ...") copies std/crypto/p256.ts,
// appends `seam.ts.in` to it — three exports, `p256SeamBase`,
// `p256SeamReference` and `p256SeamShared`, over the module's own private
// functions — and compiles this file as the `main.ts` of a directory holding
// that copy as `./p256`. The directory has no `main.ts`, so the link harness
// and the corpus walkers never compile this file on its own, where `./p256`
// does not exist. Only the copy is imported: `nish/crypto/p256` beside it would
// put two definitions of each private name in one flat namespace.
//
// What it runs:
//
// - RFC 6979 A.2.5's private key and its two SHA-256 nonces, against the
//   published public key and `r`s;
// - edges: 0, 1, 2, 15, 16, n - 2, n - 1, n, n + 1, p and 2^256 - 1, and the 16
//   scalars whose comb digits are all one value (all 0 is 0, all 15 is
//   2^256 - 1), then one scalar per digit position and value, every other digit
//   0, so each of the table's 240 entries is the only one read at least once;
// - Wycheproof: the `r` and the `s` of every 64-byte signature of
//   ecdsa_secp256r1_sha256_p1363 and _sha512_p1363 as scalars — the ECDSA files
//   carry public keys and no private keys, and these are 256-bit numbers chosen
//   to sit on edges — and every private key of ecdh_secp256r1_ecpoint, whose
//   shared secret `p256SeamShared` must reproduce for each valid case and refuse
//   for every other: an invalid point and, being compressed, the acceptable one;
// - a seeded corpus of 10,000 random scalars.
//
// For each scalar below n and above 0, `p256PublicKey` must also answer the
// reference's encoding, and `null` for every other. One corpus scalar in 16
// also signs a random message with `p256SignSha256` and with
// `p256SignSha256Into` in a reused scratch: the two must be equal and verify
// under the public key both multiplies agreed on.
//
// Every comb output is folded into one checksum, so equal lines mean equal bytes.
//
// `tests/run.js` runs it natively and as a `--profile wasi` module under Node.
// It does not run its TypeScript reading under Node, the third reading an
// agreement check would normally take: std/crypto/p256.ts opens arena blocks
// with `using`, which Node 22 does not parse, and mixes `u64` and `u32`
// arithmetic, which the prelude's BigInt reading refuses, so the module is not
// class A.
import { Secret, secret, wipe } from "nish:secret"
import {
  P256SignScratch,
  P256_SIGNATURE_SIZE,
  p256PublicKey,
  p256SeamBase,
  p256SeamReference,
  p256SeamShared,
  p256SignSha256,
  p256SignSha256Into,
  p256VerifySha256,
} from "./p256"
import {
  WycheproofEcdsaCase,
  wycheproofEcdsaP256Sha256P1363Cases,
  wycheproofEcdsaP256Sha512P1363Cases,
} from "../crypto_wycheproof/ecdsa_secp256r1_sha256"
import { WycheproofEcdhCase, wycheproofEcdhP256Cases } from "../crypto_wycheproof/ecdh_secp256r1"
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

/** A number in `[0, bound)` from the stream. */
const below = (state: u64[], bound: i32): i32 => toI32(nextWord(state) % toU64(bound))

/** `length` bytes from the stream. */
const randomBytes = (state: u64[], length: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8(nextWord(state) & toU64(0xff))
  }
  return out
}

/**
 * Folds `bytes` into the FNV-1a hash in `hash[0]`, with its length first so
 * that a refusal (`null`, folded as length -1) and an empty answer differ.
 */
const fold = (hash: u64[], bytes: u8[] | null): void => {
  const prime: u64 = toU64(0x01000193)
  const mask: u64 = (toU64(1) << toU64(32)) - toU64(1)
  let h: u64 = hash[0]
  const length: i32 = bytes === null ? -1 : toI32(bytes.length)
  for (let i: i32 = 0; i < 4; i++) {
    h = ((h ^ toU64((length >> (8 * i)) & 0xff)) * prime) & mask
  }
  if (bytes !== null) {
    for (let i: i32 = 0; i < toI32(bytes.length); i++) {
      h = ((h ^ toU64(bytes[i])) * prime) & mask
    }
  }
  hash[0] = h
}

// RFC 6979 A.2.5.
const PRIVATE: string = "c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721"
const PUBLIC: string =
  "0460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299"
const SAMPLE_K: string = "a6e3c57dd01abe90086538398355dd4c3b17aa873382b0f24d6129493d8aad60"
const SAMPLE_R: string = "efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716"
const TEST_K: string = "d16b6ae827f17175e040871a1c7ec3500192c4c92677336ec2537acaee0008e0"
const TEST_R: string = "f1abb023518351cd71d881567b1ea663ed3efcf6c5132b354f28d3b0b7d38367"

// The group order n and the field prime p (SEC 2 §2.4.2).
const N: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"
const P: string = "ffffffff00000001000000000000000000000000ffffffffffffffffffffffff"

/** The number of random scalars in the corpus. */
const CORPUS: i32 = 10000

/** What the checks counted: scalars run and agreed, and the public keys and signatures behind them. */
class Tally {
  scalars: i32 = 0
  agreed: i32 = 0
  keys: i32 = 0
  signed: i32 = 0
  reported: i32 = 0
}

/** 1 when the 32 big-endian bytes `k` are in [1, n), 0 otherwise. */
const inRange = (k: u8[], n: u8[]): i32 => {
  let zero: i32 = 1
  for (let i: i32 = 0; i < 32; i++) {
    if (toI32(k[i]) !== 0) {
      zero = 0
    }
  }
  if (zero === 1) {
    return 0
  }
  for (let i: i32 = 0; i < 32; i++) {
    const a: i32 = toI32(k[i])
    const b: i32 = toI32(n[i])
    if (a !== b) {
      return a < b ? 1 : 0
    }
  }
  return 0
}

/** The 32 bytes of `hex` read as a big-endian integer of any length up to 33 bytes, as Wycheproof writes them. */
const scalarOf = (hex: string): u8[] => {
  const bytes: u8[] = fromHex(hex)
  const out: u8[] = new Array<u8>(32)
  const length: i32 = toI32(bytes.length)
  for (let i: i32 = 0; i < 32; i++) {
    const at: i32 = length - 32 + i
    out[i] = at >= 0 && at < length ? bytes[at] : 0
  }
  return out
}

/** `p256PublicKey` on a copy of `k`, so the `Secret` it is given owns bytes no one else reads. */
const publicKeyOf = (k: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(fromHex(toHex(k)))
  const pub: u8[] | null = p256PublicKey(key)
  wipe(key)
  return pub
}

/**
 * k G by the comb, folded, and held to the reference and to `p256PublicKey`;
 * answers the comb's encoding. A disagreement is named, the first ten of them.
 */
const agree = (hash: u64[], tally: Tally, n: u8[], name: string, k: u8[]): u8[] => {
  const base: u8[] = p256SeamBase(k)
  const reference: u8[] = p256SeamReference(k)
  fold(hash, base)
  tally.scalars = tally.scalars + 1
  const pub: u8[] | null = publicKeyOf(k)
  const keyHeld: boolean = inRange(k, n) === 1 ? pub !== null && toHex(pub) === toHex(reference) : pub === null
  if (toHex(base) === toHex(reference) && keyHeld) {
    tally.agreed = tally.agreed + 1
  } else if (tally.reported < 10) {
    tally.reported = tally.reported + 1
    console.log(`disagree: ${name} k = ${toHex(k)}`)
    console.log(`  comb      ${toHex(base)}`)
    console.log(`  reference ${toHex(reference)}`)
    console.log(`  public    ${toHex(pub)}`)
  }
  if (pub !== null) {
    tally.keys = tally.keys + 1
  }
  return base
}

/** The x coordinate of an encoded point, as hex. */
const xOf = (point: u8[]): string => toHex(point).substring(2, 66)

/** The scalar whose comb digit at every position `i` (bits i, i + 64, i + 128, i + 192) is `digit`. */
const everyDigit = (digit: i32): u8[] => {
  const out: u8[] = new Array<u8>(32)
  for (let byte: i32 = 0; byte < 32; byte++) {
    // Byte `byte` holds bits 8 (31 - byte) and up, all in one 64-bit tooth.
    const tooth: i32 = (31 - byte) >> 3
    out[byte] = ((digit >> tooth) & 1) === 1 ? 255 : 0
  }
  return out
}

/** The scalar whose comb digit at position `i` is `digit` and every other digit 0. */
const oneDigit = (i: i32, digit: i32): u8[] => {
  const out: u8[] = new Array<u8>(32)
  for (let b: i32 = 0; b < 4; b++) {
    if (((digit >> b) & 1) === 1) {
      const bit: i32 = i + 64 * b
      const shift: i32 = bit & 7
      const at: i32 = 31 - (bit >> 3)
      out[at] = toU8(toI32(out[at]) | (1 << shift))
    }
  }
  return out
}

/** The edges and the digit sweep; answers how many scalars were run. */
const edges = (hash: u64[], tally: Tally, n: u8[]): void => {
  const small: i32[] = [0, 1, 2, 15, 16]
  for (let i: i32 = 0; i < toI32(small.length); i++) {
    const k: u8[] = new Array<u8>(32)
    k[31] = toU8(small[i])
    agree(hash, tally, n, `${small[i]}`, k)
  }
  const nMinus2: u8[] = fromHex(N)
  nMinus2[31] = toU8(toI32(nMinus2[31]) - 2)
  agree(hash, tally, n, "n - 2", nMinus2)
  const nMinus1: u8[] = fromHex(N)
  nMinus1[31] = toU8(toI32(nMinus1[31]) - 1)
  agree(hash, tally, n, "n - 1", nMinus1)
  agree(hash, tally, n, "n", fromHex(N))
  const nPlus1: u8[] = fromHex(N)
  nPlus1[31] = toU8(toI32(nPlus1[31]) + 1)
  agree(hash, tally, n, "n + 1", nPlus1)
  agree(hash, tally, n, "p", fromHex(P))
  for (let digit: i32 = 0; digit < 16; digit++) {
    agree(hash, tally, n, `every digit ${digit}`, everyDigit(digit))
  }
  for (let i: i32 = 0; i < 64; i++) {
    for (let digit: i32 = 1; digit < 16; digit++) {
      agree(hash, tally, n, `digit ${i} = ${digit}`, oneDigit(i, digit))
    }
  }
}

/** The `r` and the `s` of every 64-byte signature in `cases`. */
const signatureScalars = (hash: u64[], tally: Tally, n: u8[], file: string, cases: WycheproofEcdsaCase[]): void => {
  for (let i: i32 = 0; i < toI32(cases.length); i++) {
    const c: WycheproofEcdsaCase = cases[i]
    if (toI32(c.sig.length) === 128) {
      agree(hash, tally, n, `${file} tcId ${c.tcId} r`, fromHex(c.sig.substring(0, 64)))
      agree(hash, tally, n, `${file} tcId ${c.tcId} s`, fromHex(c.sig.substring(64, 128)))
    }
  }
}

/** What the ECDH cases counted. */
class EcdhTally {
  published: i32 = 0
  refused: i32 = 0
}

/** Every ECDH case: its private key through `agree`, its shared secret through the reference multiply. */
const ecdh = (hash: u64[], tally: Tally, n: u8[], cases: WycheproofEcdhCase[]): EcdhTally => {
  const out = new EcdhTally()
  for (let i: i32 = 0; i < toI32(cases.length); i++) {
    const c: WycheproofEcdhCase = cases[i]
    const k: u8[] = scalarOf(c.priv)
    agree(hash, tally, n, `ecdh tcId ${c.tcId}`, k)
    const shared: u8[] | null = p256SeamShared(k, fromHex(c.pub))
    if (c.result === "valid") {
      if (shared !== null && toHex(shared) === c.shared) {
        out.published = out.published + 1
      } else {
        console.log(`ecdh tcId ${c.tcId}: shared ${toHex(shared)}, want ${c.shared}`)
      }
    } else if (shared === null) {
      out.refused = out.refused + 1
    } else {
      console.log(`ecdh tcId ${c.tcId} (${c.result}): a shared secret from a key that should not decode`)
    }
  }
  return out
}

/** One in-range corpus scalar signing a random message both ways, checked against its public key `pub`. */
const sign = (state: u64[], hash: u64[], tally: Tally, scratch: P256SignScratch, k: u8[], pub: u8[]): void => {
  const msg: u8[] = randomBytes(state, below(state, 64))
  const key: Secret<u8[]> = secret(fromHex(toHex(k)))
  const sig: u8[] | null = p256SignSha256(key, msg)
  const into: u8[] = new Array<u8>(P256_SIGNATURE_SIZE)
  const ok: boolean = p256SignSha256Into(scratch, key, msg, 0, toI32(msg.length), into, 0)
  wipe(key)
  fold(hash, sig)
  if (sig !== null && ok && toHex(sig) === toHex(into) && p256VerifySha256(pub, msg, sig)) {
    tally.signed = tally.signed + 1
  } else {
    console.log(`sign: k = ${toHex(k)} msg = ${toHex(msg)}: ${toHex(sig)} and ${toHex(into)}`)
  }
}

export const main = (): i32 => {
  const hash: u64[] = [(toU64(0x81) << toU64(24)) | toU64(0x1c9dc5)]
  const n: u8[] = fromHex(N)

  const rfc = new Tally()
  const pub: u8[] = agree(hash, rfc, n, "A.2.5 private key", fromHex(PRIVATE))
  const sampleR: u8[] = agree(hash, rfc, n, "A.2.5 sample k", fromHex(SAMPLE_K))
  const testR: u8[] = agree(hash, rfc, n, "A.2.5 test k", fromHex(TEST_K))
  const published: boolean = toHex(pub) === PUBLIC && xOf(sampleR) === SAMPLE_R && xOf(testR) === TEST_R
  console.log(
    `rfc 6979 a.2.5: ${rfc.agreed} of ${rfc.scalars} scalars agree, ${published ? "as" : "NOT as"} published`
  )

  const edge = new Tally()
  edges(hash, edge, n)
  console.log(
    `edges and digits: ${edge.agreed} of ${edge.scalars} scalars agree, ${edge.keys} of them public keys`
  )

  const ecdsa = new Tally()
  signatureScalars(hash, ecdsa, n, "ecdsa_secp256r1_sha256_p1363", wycheproofEcdsaP256Sha256P1363Cases())
  signatureScalars(hash, ecdsa, n, "ecdsa_secp256r1_sha512_p1363", wycheproofEcdsaP256Sha512P1363Cases())
  console.log(`wycheproof ecdsa r and s: ${ecdsa.agreed} of ${ecdsa.scalars} scalars agree`)

  const keys = new Tally()
  const ecdhCases: WycheproofEcdhCase[] = wycheproofEcdhP256Cases()
  const shared: EcdhTally = ecdh(hash, keys, n, ecdhCases)
  console.log(
    `wycheproof ecdh: ${keys.agreed} of ${keys.scalars} private keys agree, ` +
      `${shared.published} shared secrets as published, ${shared.refused} public keys refused`
  )

  const corpus = new Tally()
  const state: u64[] = [(toU64(0x2545f491) << toU64(32)) | toU64(0x4f6cdd1d)]
  const scratch = new P256SignScratch()
  for (let i: i32 = 0; i < CORPUS; i++) {
    const k: u8[] = randomBytes(state, 32)
    const base: u8[] = agree(hash, corpus, n, `corpus ${i}`, k)
    if ((i & 15) === 0 && inRange(k, n) === 1) {
      sign(state, hash, corpus, scratch, k, base)
    }
  }
  console.log(
    `corpus: ${corpus.agreed} of ${corpus.scalars} scalars agree, ${corpus.keys} public keys, ` +
      `${corpus.signed} signed both ways and verified`
  )
  console.log(`checksum: ${hash[0]}`)
  const failed: i32 =
    rfc.scalars -
    rfc.agreed +
    (edge.scalars - edge.agreed) +
    (ecdsa.scalars - ecdsa.agreed) +
    (keys.scalars - keys.agreed) +
    (corpus.scalars - corpus.agreed)
  return failed === 0 && published ? 0 : 1
}
