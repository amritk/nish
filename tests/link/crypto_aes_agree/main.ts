// The AES kernels against the bitsliced walkers, end to end (WP38 S5).
//
// Natively, each seam of `nish/crypto/aes` is a branch on `nish_aes_hw`: the
// runtime kernel where this machine has AES-NI and PCLMULQDQ (or the ARMv8 AES
// and PMULL instructions), the bitsliced Nish code where it has not or the
// process runs with `NISH_AES=soft`. This program prints the same lines down
// either path. `tests/run.js` ("aes kernel: ...") runs it both ways and
// requires the two outputs byte for byte equal, and `expected.out` pins them.
//
// What it runs, through the public functions only, so every seam is reached
// from its one caller:
//
// - the GCM specification's test cases 1–6 and 13–18 (McGrew and Viega,
//   Appendix B; SP 800-38D's vectors), against their published answers. Cases
//   5, 6, 17 and 18 have 8- and 60-byte IVs, so J0 is GHASH of the IV: the
//   GHASH seam (the kernel) absorbs the IV and `ghashLengths` then multiplies
//   outside the seams (the walker's `ghashMultiply`), which holds only if the
//   kernel leaves the GHASH state in the walker's two big-endian words;
// - RFC 9001's AES header-protection samples of Appendix A.2 and A.3 (A.5 is
//   ChaCha20's packet, which AES does not reach);
// - every Wycheproof AES-GCM case `tests/link/crypto_aes` runs, sealed and
//   opened, the ones built for a J0 whose 32-bit counter wraps among them;
// - a seeded corpus: keys of 16 and 32 bytes, IVs of 12 bytes and of 1, 8, 16,
//   60 and random lengths, AADs of 0 to 47 bytes, and plaintexts of every
//   length from 0 to 64 and random lengths up to 4,096, each sealed, opened
//   and opened again with one bit flipped, plus `aesEncryptBlock` and
//   `aesHeaderMask` on random blocks. The specification's keys are made with
//   `aesKey`; Wycheproof's and the corpus's are installed into a reused
//   `AesKey` with `aesKeyInto`.
//
// Every output is folded into one checksum, so equal lines mean equal bytes.
import {
  AES_BLOCK,
  AesKey,
  aesEncryptBlock,
  aesGcmOpen,
  aesGcmSeal,
  aesHeaderMask,
  aesKey,
  aesKeyInto,
} from "nish/crypto/aes"
import { WycheproofAesGcmCase, wycheproofAesGcmCases } from "../crypto_wycheproof/aes_gcm"
import { fromHex, toHex } from "../crypto_aes/hex"

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

/** The key, or a panic: every key here is a valid length. */
const keyOf = (bytes: u8[]): AesKey => {
  const key: AesKey | null = aesKey(bytes)
  if (key === null) {
    panic("no AES key from a 16- or 32-byte key")
  }
  return key
}

/**
 * `bytes` installed with `aesKeyInto` into whichever of the two reused keys
 * has its length, or a panic: every key here is 16 or 32 bytes. A key `aesKey`
 * makes is a fresh allocation that no arena block may be put around, so the
 * loops below install theirs into keys made before them.
 */
const install = (narrow: AesKey, wide: AesKey, bytes: u8[]): AesKey => {
  const key: AesKey = toI32(bytes.length) === 32 ? wide : narrow
  if (!aesKeyInto(bytes, key)) {
    panic("aesKeyInto refused a key of the right length")
  }
  return key
}

/** One GCM specification case sealed, folded, and compared with its answer. */
const gcmCase = (hash: u64[], key: string, iv: string, aad: string, plaintext: string, sealed: string): i32 => {
  const out: u8[] | null = aesGcmSeal(keyOf(fromHex(key)), fromHex(iv), fromHex(aad), fromHex(plaintext))
  fold(hash, out)
  const opened: u8[] | null = aesGcmOpen(keyOf(fromHex(key)), fromHex(iv), fromHex(aad), fromHex(sealed))
  fold(hash, opened)
  return toHex(out) === sealed && toHex(opened) === plaintext ? 1 : 0
}

const K0: string = "00000000000000000000000000000000"
const K00: string = "0000000000000000000000000000000000000000000000000000000000000000"
const K: string = "feffe9928665731c6d6a8f9467308308"
const KK: string = "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308"
const IV0: string = "000000000000000000000000"
const IV: string = "cafebabefacedbaddecaf888"
const IV8: string = "cafebabefacedbad"
const IV60: string =
  "9313225df88406e555909c5aff5269aa6a7a9538534f7da1e4c303d2a318a728c3c0c95156809539fcf0e2429a6b525416aedbf5a0de6a57a637b39b"
const P64: string =
  "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255"
const P60: string =
  "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39"
const A: string = "feedfacedeadbeeffeedfacedeadbeefabaddad2"

/** Test cases 1–6 and 13–18, as `tests/link/crypto_aes` checks them; answers how many held. */
const gcmVectors = (hash: u64[]): i32 => {
  let held: i32 = 0
  held += gcmCase(hash, K0, IV0, "", "", "58e2fccefa7e3061367f1d57a4e7455a")
  held += gcmCase(hash, K0, IV0, "", K0, "0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf")
  held += gcmCase(
    hash,
    K,
    IV,
    "",
    P64,
    "42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e091473f59854d5c2af327cd64a62cf35abd2ba6fab4"
  )
  held += gcmCase(
    hash,
    K,
    IV,
    A,
    P60,
    "42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e0915bc94fbc3221a5db94fae95ae7121a47"
  )
  held += gcmCase(
    hash,
    K,
    IV8,
    A,
    P60,
    "61353b4c2806934a777ff51fa22a4755699b2a714fcdc6f83766e5f97b6c742373806900e49f24b22b097544d4896b424989b5e1ebac0f07c23f45983612d2e79e3b0785561be14aaca2fccb"
  )
  held += gcmCase(
    hash,
    K,
    IV60,
    A,
    P60,
    "8ce24998625615b603a033aca13fb894be9112a5c3a211a8ba262a3cca7e2ca701e4a9a4fba43c90ccdcb281d48c7c6fd62875d2aca417034c34aee5619cc5aefffe0bfa462af43c1699d050"
  )
  held += gcmCase(hash, K00, IV0, "", "", "530f8afbc74536b9a963b4f1c4cb738b")
  held += gcmCase(hash, K00, IV0, "", K0, "cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919")
  held += gcmCase(
    hash,
    KK,
    IV,
    "",
    P64,
    "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015adb094dac5d93471bdec1a502270e3cc6c"
  )
  held += gcmCase(
    hash,
    KK,
    IV,
    A,
    P60,
    "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f66276fc6ece0f4e1768cddf8853bb2d551b"
  )
  held += gcmCase(
    hash,
    KK,
    IV8,
    A,
    P60,
    "c3762df1ca787d32ae47c13bf19844cbaf1ae14d0b976afac52ff7d79bba9de0feb582d33934a4f0954cc2363bc73f7862ac430e64abe499f47c9b1f3a337dbf46a792c45e454913fe2ea8f2"
  )
  held += gcmCase(
    hash,
    KK,
    IV60,
    A,
    P60,
    "5a8def2f0c9e53f1f75d7853659e2a20eeb2b22aafde6419a058ab4f6f746bf40fc0c3b780f244452da3ebf1c5d82cdea2418997200ef82e44ae7e3fa44a8266ee1c8eb0c8b5d4cf5ae9f19a"
  )
  return held
}

/** RFC 9001 A.2's and A.3's header-protection masks; answers how many held. */
const headerMasks = (hash: u64[]): i32 => {
  const client: u8[] | null = aesHeaderMask(
    keyOf(fromHex("9f50449e04a0e810283a1e9933adedd2")),
    fromHex("d1b1c98dd7689fb8ec11d242b123dc9b")
  )
  const server: u8[] | null = aesHeaderMask(
    keyOf(fromHex("c206b8d9b9f0f37644430b490eeaa314")),
    fromHex("2cd0991cd25b0aac406a5816b6394100")
  )
  fold(hash, client)
  fold(hash, server)
  return (toHex(client) === "437b9aec36" ? 1 : 0) + (toHex(server) === "2ec0d8356a" ? 1 : 0)
}

/** Every Wycheproof case sealed and opened; answers how many held as upstream says. */
const wycheproof = (hash: u64[], cases: WycheproofAesGcmCase[]): i32 => {
  const narrow: AesKey = new AesKey(10, new Array<u64>(88))
  const wide: AesKey = new AesKey(14, new Array<u64>(120))
  let held: i32 = 0
  for (const c of cases) {
    using a = arena()
    const key: AesKey = install(narrow, wide, fromHex(c.key))
    const sealed: string = `${c.ct}${c.tag}`
    const opened: u8[] | null = aesGcmOpen(key, fromHex(c.iv), fromHex(c.aad), fromHex(sealed))
    fold(hash, opened)
    if (!c.valid) {
      held += opened === null ? 1 : 0
      continue
    }
    const resealed: u8[] | null = aesGcmSeal(key, fromHex(c.iv), fromHex(c.aad), fromHex(c.msg))
    fold(hash, resealed)
    held += toHex(opened) === c.msg && toHex(resealed) === sealed ? 1 : 0
  }
  return held
}

/** An IV length for corpus case `n`: mostly 12, the fast path, and every other kind between. */
const ivLength = (state: u64[], n: i32): i32 => {
  const kind: i32 = n % 8
  if (kind === 1) {
    return 1
  }
  if (kind === 3) {
    return 8
  }
  if (kind === 5) {
    return 16
  }
  if (kind === 6) {
    return 60
  }
  if (kind === 7) {
    return 1 + below(state, 64)
  }
  return 12
}

/** The corpus's counts: cases sealed, round trips, forgeries refused. */
class Tally {
  cases: i32 = 0
  opened: i32 = 0
  refused: i32 = 0
}

/** One corpus case of `length` plaintext bytes under `key`. */
const corpusCase = (hash: u64[], state: u64[], tally: Tally, key: AesKey, n: i32, length: i32): void => {
  const iv: u8[] = randomBytes(state, ivLength(state, n))
  const aad: u8[] = randomBytes(state, n % 3 === 0 ? 0 : below(state, 48))
  const plaintext: u8[] = randomBytes(state, length)
  const sealed: u8[] | null = aesGcmSeal(key, iv, aad, plaintext)
  fold(hash, sealed)
  tally.cases = tally.cases + 1
  if (sealed === null) {
    return
  }
  const opened: u8[] | null = aesGcmOpen(key, iv, aad, sealed)
  if (opened !== null && toHex(opened) === toHex(plaintext)) {
    tally.opened = tally.opened + 1
  }
  const at: i32 = below(state, toI32(sealed.length))
  if (at >= 0 && at < toI32(sealed.length)) {
    sealed[at] = sealed[at] ^ toU8(1 << below(state, 8))
  }
  if (aesGcmOpen(key, iv, aad, sealed) === null) {
    tally.refused = tally.refused + 1
  }
  const block: u8[] = randomBytes(state, AES_BLOCK)
  fold(hash, aesEncryptBlock(key, block))
  fold(hash, aesHeaderMask(key, block))
}

/** The seeded corpus: every length 0..64, then random lengths to 4,096. */
const corpus = (hash: u64[], tally: Tally): void => {
  const state: u64[] = [(toU64(0x1e3779b9) << toU64(32)) | toU64(0x7f4a7c15)]
  const narrow: AesKey = new AesKey(10, new Array<u64>(88))
  const wide: AesKey = new AesKey(14, new Array<u64>(120))
  const count: i32 = 65 + 400
  for (let n: i32 = 0; n < count; n++) {
    using a = arena()
    const key: AesKey = install(narrow, wide, randomBytes(state, below(state, 2) === 1 ? 32 : 16))
    const length: i32 = n < 65 ? n : below(state, 4097)
    corpusCase(hash, state, tally, key, n, length)
  }
}

export const main = (): i32 => {
  // FNV-1a's offset basis, 0x811c9dc5, which an `i32` literal cannot spell.
  const hash: u64[] = [(toU64(0x81) << toU64(24)) | toU64(0x1c9dc5)]
  const vectors: i32 = gcmVectors(hash)
  console.log(`gcm specification: ${vectors} of 12 cases agree, 5, 6, 17 and 18 with 8- and 60-byte IVs`)
  const masks: i32 = headerMasks(hash)
  console.log(`rfc 9001 a.2 and a.3: ${masks} of 2 header-protection masks agree`)
  const cases: WycheproofAesGcmCase[] = wycheproofAesGcmCases()
  const held: i32 = wycheproof(hash, cases)
  console.log(`wycheproof aes_gcm: ${held} of ${cases.length} cases hold`)
  const tally = new Tally()
  corpus(hash, tally)
  console.log(`corpus: ${tally.cases} cases sealed, ${tally.opened} opened back, ${tally.refused} forgeries refused`)
  console.log(`checksum: ${hash[0]}`)
  const all: boolean =
    vectors === 12 &&
    masks === 2 &&
    held === toI32(cases.length) &&
    tally.opened === tally.cases &&
    tally.refused === tally.cases
  return all ? 0 : 1
}
