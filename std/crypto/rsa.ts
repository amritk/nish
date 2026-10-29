/**
 * `nish/crypto/rsa` — verifying RSA signatures: PKCS #1 v1.5 and RSA-PSS, with
 * SHA-256, SHA-384 or SHA-512, for moduli of 2048 to 4096 bits.
 *
 *     import { RSA_SHA256, RsaPublicKey, rsaPublicKeyFromDer, rsaVerifyPkcs1, rsaVerifyPss } from "nish/crypto/rsa";
 *
 *     const key: RsaPublicKey | null = rsaPublicKeyFromDer(der);  // PKCS #1 RSAPublicKey
 *     if (key !== null) {
 *       const a: boolean = rsaVerifyPkcs1(key, RSA_SHA256, message, signature);
 *       const b: boolean = rsaVerifyPss(key, RSA_SHA256, 32, message, signature);
 *     }
 *
 * This module verifies and does nothing else: there is no signing, no
 * encryption and no key generation. Everything it reads — the key, the
 * message, the signature — is public, so nothing here is a `Secret` and
 * nothing is wiped.
 *
 * **Keys.** A key is the modulus n and the public exponent e, as the PKCS #1
 * `RSAPublicKey` DER of RFC 8017 §A.1.1 (`rsaPublicKeyFromDer`) or as two
 * big-endian byte strings (`rsaPublicKeyFromParts`). Only one kind of key is
 * taken: n odd with exactly 2048 to 4096 significant bits, and e odd with
 * 3 <= e < 2^32. The DER must be strict — minimal lengths, minimal
 * non-negative INTEGERs, nothing after the SEQUENCE and nothing inside it
 * after e — and a part must be minimal too, with no leading zero octet. Any
 * other key answers `null`. A smaller modulus is too weak to be worth
 * accepting, a larger one costs a verifier more than any CA asks of it, and
 * e = 1 or an even e is not an RSA key at all.
 *
 * **Signatures.** `rsaVerifyPkcs1` is RSASSA-PKCS1-v1_5-VERIFY (RFC 8017
 * §8.2.2) and `rsaVerifyPss` is RSASSA-PSS-VERIFY (§8.1.2) with MGF1 over the
 * signature's own hash and a salt of exactly the length the caller names. Each
 * has a `Digest` twin that takes the message's hash instead of the message.
 * Both refuse a signature that is not exactly as long as the modulus, or whose
 * integer is n or more, before any arithmetic. PKCS #1 v1.5 is checked the way
 * §8.2.2 step 3 says to: the whole expected encoding is built from the digest,
 * with the DigestInfo's NULL parameters, and compared with the recovered one
 * in full. The recovered DigestInfo is never parsed, which is what keeps out
 * the forgeries that lenient parsers let in (Bleichenbacher 2006 and its
 * descendants), and is also why an encoding without the NULL, which RFC 8017
 * §9.2 note 2 lets a verifier accept, is refused.
 *
 * **Not constant-time, on purpose.** The big-number arithmetic below takes
 * time that depends on the values it is given: the exponent's bits pick the
 * multiplications, a final subtraction runs or does not, and every encoding
 * check returns at its first failure. That is safe here because every value is
 * public. It is not safe for a private exponent, so none of it may be reused
 * for signing: RSA signing (#481) needs arithmetic written constant-time from
 * the start, with its own vectors and record. `docs/security/crypto-rsa.md`
 * says where that boundary lies.
 *
 * **The arithmetic** is written for this module. A number is an array of
 * `u32` limbs, least significant first, as many as the modulus needs (at most
 * 128). Products are Montgomery multiplications in the CIOS form of Koç,
 * Acar and Kaliski, "Analyzing and Comparing Montgomery Multiplication
 * Algorithms" (IEEE Micro, 1996), with `u64` products as `nish/crypto/p256`
 * uses them; R^2 mod n, which brings a number into the Montgomery domain, is
 * worked out once per key; and s^e is a left-to-right square-and-multiply
 * over e's bits.
 */

import { timingSafeEqual, timingSafeEqualAt } from "nish/crypto/ct"
import { SHA256_SIZE, sha256 } from "nish/crypto/sha256"
import { SHA384_SIZE, SHA512_SIZE, sha384, sha512 } from "nish/crypto/sha512"

/** The hash a signature is made over: SHA-256. */
export const RSA_SHA256: i32 = 1
/** The hash a signature is made over: SHA-384. */
export const RSA_SHA384: i32 = 2
/** The hash a signature is made over: SHA-512. */
export const RSA_SHA512: i32 = 3

/** The shortest modulus taken, in bits. */
const RSA_MIN_BITS: i32 = 2048
/** The longest modulus taken, in bits. */
const RSA_MAX_BITS: i32 = 4096
/** The length of each DigestInfo prefix below, the part before the digest. */
const RSA_DIGEST_INFO_PREFIX: i32 = 19

/**
 * An RSA public key that `rsaPublicKeyFromDer` or `rsaPublicKeyFromParts`
 * accepted, with what verifying under it needs worked out once.
 *
 * Nish has no private constructors, so the constructor applies the key policy
 * itself rather than trusting its caller: a key built with `new` from a
 * modulus or exponent the policy refuses has `valid` false and every verify
 * under it answers `false`.
 */
export class RsaPublicKey {
  /** Whether n and e met the policy; nothing below means anything when not. */
  readonly valid: boolean
  /** The public exponent e. */
  readonly exponent: u32
  /** The modulus's significant bits, 2048 to 4096. */
  readonly bits: i32
  /** k of RFC 8017: the modulus's length in bytes, which is every signature's length. */
  readonly size: i32
  /** n, as `limbCount` limbs, least significant first. */
  readonly limbs: u32[]
  readonly limbCount: i32
  /** -n^-1 mod 2^32, the factor each Montgomery reduction step multiplies by. */
  readonly n0inv: u32
  /** R^2 mod n for R = 2^(32 * limbCount), which takes a number into the Montgomery domain. */
  readonly rr: u32[]

  /** The key with modulus `n`, big-endian and minimal, and exponent `e`. */
  constructor(n: u8[], e: u32) {
    const ok: boolean = rsaModulusOk(n) && e >= 3 && (e & 1) === 1
    const size: i32 = ok ? toI32(n.length) : 0
    const limbCount: i32 = (size + 3) >> 2
    const limbs: u32[] = ok ? rsaLimbsFromBytes(n, limbCount) : []
    this.valid = ok
    this.exponent = ok ? e : 0
    this.bits = ok ? rsaBitLength(n) : 0
    this.size = size
    this.limbs = limbs
    this.limbCount = limbCount
    this.n0inv = ok ? rsaNegInverse(limbs[0]) : 0
    this.rr = ok ? rsaMontRR(limbs, limbCount) : []
  }
}

/** The significant bits of a big-endian number whose first byte is not zero. */
const rsaBitLength = (n: u8[]): i32 => 8 * toI32(n.length) - (toI32(Math.clz32(toU32(n[0]))) - 24)

/**
 * Whether `n` is a modulus the policy takes: minimal (no leading zero byte),
 * odd, and 2048 to 4096 bits long. The length is compared as the `number` it
 * is, before any `toI32`, for `timingSafeEqual`'s reason, against bare
 * literals so the comparison holds in either number mode: 256 and 512 octets
 * are `RSA_MIN_BITS / 8` and `RSA_MAX_BITS / 8`.
 */
const rsaModulusOk = (n: u8[]): boolean => {
  const length: number = n.length
  if (length < 256 || length > 512) {
    return false
  }
  if (n[0] === 0 || (n[toI32(n.length) - 1] & 1) === 0) {
    return false
  }
  const bits: i32 = rsaBitLength(n)
  return bits >= RSA_MIN_BITS && bits <= RSA_MAX_BITS
}

/** The big-endian `bytes` as `limbs` limbs, least significant first; `bytes` fits in them. */
const rsaLimbsFromBytes = (bytes: u8[], limbs: i32): u32[] => {
  const out: u32[] = new Array<u32>(limbs)
  const len: i32 = toI32(bytes.length)
  const outLen: i32 = toI32(out.length)
  for (let i: i32 = 0; i < len; i++) {
    const at: i32 = i >> 2
    // Always true, since the caller sized `limbs` to hold `bytes`; the guard is the bounds proof.
    if (at < outLen) {
      out[at] = out[at] | (toU32(bytes[len - 1 - i]) << (toU32(i & 3) << toU32(3)))
    }
  }
  return out
}

/** The low `k` bytes of the number in `limbs`, big-endian. */
const rsaBytesFromLimbs = (limbs: u32[], k: i32): u8[] => {
  const out: u8[] = new Array<u8>(k)
  const limbLen: i32 = toI32(limbs.length)
  for (let i: i32 = 0; i < k; i++) {
    const at: i32 = i >> 2
    // Always true for the callers' k = key.size; the guard is the bounds proof.
    if (at < limbLen) {
      out[k - 1 - i] = toU8(limbs[at] >>> (toU32(i & 3) << toU32(3)))
    }
  }
  return out
}

/** Whether the `count`-limb number `a` is below `n`. */
const rsaLess = (a: u32[], n: u32[], count: i32): boolean => {
  if (count > toI32(a.length) || count > toI32(n.length)) {
    return false
  }
  for (let i: i32 = count - 1; i >= 0; i--) {
    if (a[i] !== n[i]) {
      return a[i] < n[i]
    }
  }
  return false
}

/** `a -= n` over `count` limbs, wrapping: the caller knows the answer fits. */
const rsaSubInPlace = (a: u32[], n: u32[], count: i32): void => {
  if (count > toI32(a.length) || count > toI32(n.length)) {
    return
  }
  let borrow: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const d: u64 = toU64(a[i]) - toU64(n[i]) - borrow
    a[i] = toU32(d)
    borrow = (d >>> 32) & 1
  }
}

/**
 * -n0^-1 mod 2^32 for an odd `n0`, by Newton's iteration x <- x(2 - n0 x): an
 * odd number is its own inverse mod 8, and each step doubles the bits that
 * are right, so four steps take 3 to 48.
 */
const rsaNegInverse = (n0: u32): u32 => {
  const two: u32 = 2
  let x: u32 = n0
  for (let i: i32 = 0; i < 4; i++) {
    x = x * (two - n0 * x)
  }
  const zero: u32 = 0
  return zero - x
}

/**
 * R^2 mod n, by doubling 1 modulo n 2 * 32 * `count` times. Each doubling is a
 * shift and at most one subtraction, so this costs some 2 * 32 * `count`^2
 * limb operations once per key, which a verify then never pays.
 */
const rsaMontRR = (n: u32[], count: i32): u32[] => {
  const r: u32[] = new Array<u32>(count)
  const rLen: i32 = toI32(r.length)
  r[0] = 1
  for (let step: i32 = 0; step < 64 * count; step++) {
    let carry: u32 = 0
    for (let i: i32 = 0; i < rLen; i++) {
      const word: u32 = r[i]
      r[i] = (word << 1) | carry
      carry = word >>> 31
    }
    // r < n before the doubling, so 2r < 2n and one subtraction brings it
    // back below n; with a carry out the wrapping subtraction lands on the
    // right value all the same.
    if (carry !== 0 || !rsaLess(r, n, count)) {
      rsaSubInPlace(r, n, count)
    }
  }
  return r
}

/**
 * `out = a * b * R^-1 mod n`, for `a` and `b` below n, in the CIOS form:
 * each pass adds one limb of `a` times `b` into `t` and then adds the
 * multiple of n that clears `t`'s lowest limb, shifting it out. `t` is
 * scratch of `limbCount + 2` limbs. `out` may be `a` or `b`, since it is only
 * written at the end.
 *
 * No `u64` sum here can overflow: a limb product is at most (2^32 - 1)^2, and
 * adding two more 32-bit values to it gives exactly 2^64 - 1.
 */
const rsaMontMul = (key: RsaPublicKey, out: u32[], a: u32[], b: u32[], t: u32[]): void => {
  const count: i32 = key.limbCount
  const n: u32[] = key.limbs
  // Never taken for a key from rsaPublicKeyFromParts and the arrays its callers
  // size; the guard is the bounds proof for every index below.
  if (
    count < 1 ||
    count > toI32(n.length) ||
    count > toI32(a.length) ||
    count > toI32(b.length) ||
    count > toI32(out.length) ||
    count + 2 > toI32(t.length)
  ) {
    return
  }
  const tLen: i32 = toI32(t.length)
  for (let j: i32 = 0; j < tLen; j++) {
    t[j] = 0
  }
  for (let i: i32 = 0; i < count; i++) {
    const ai: u64 = toU64(a[i])
    let c: u64 = 0
    for (let j: i32 = 0; j < count; j++) {
      const w: u64 = ai * toU64(b[j]) + toU64(t[j]) + c
      t[j] = toU32(w)
      c = w >>> 32
    }
    const top: u64 = toU64(t[count]) + c
    t[count] = toU32(top)
    t[count + 1] = toU32(top >>> 32)
    const m: u64 = toU64(t[0] * key.n0inv)
    c = (m * toU64(n[0]) + toU64(t[0])) >>> 32
    for (let j: i32 = 1; j < count; j++) {
      const w: u64 = m * toU64(n[j]) + toU64(t[j]) + c
      t[j - 1] = toU32(w)
      c = w >>> 32
    }
    const top2: u64 = toU64(t[count]) + c
    t[count - 1] = toU32(top2)
    t[count] = t[count + 1] + toU32(top2 >>> 32)
  }
  // t < 2n, with its top bit, if any, in t[count].
  if (t[count] !== 0 || !rsaLess(t, n, count)) {
    rsaSubInPlace(t, n, count)
  }
  for (let j: i32 = 0; j < count; j++) {
    out[j] = t[j]
  }
}

/** s^e mod n for `s` below n: into the Montgomery domain, square-and-multiply over e, and out again. */
const rsaPublicOp = (key: RsaPublicKey, s: u32[]): u32[] => {
  const count: i32 = key.limbCount
  const t: u32[] = new Array<u32>(count + 2)
  const x: u32[] = new Array<u32>(count)
  rsaMontMul(key, x, s, key.rr, t)
  const acc: u32[] = new Array<u32>(count)
  const accLen: i32 = toI32(acc.length)
  for (let j: i32 = 0; j < accLen && j < toI32(x.length); j++) {
    acc[j] = x[j]
  }
  const e: u32 = key.exponent
  for (let bit: i32 = 30 - toI32(Math.clz32(e)); bit >= 0; bit--) {
    rsaMontMul(key, acc, acc, acc, t)
    if (((e >>> toU32(bit)) & 1) !== 0) {
      rsaMontMul(key, acc, acc, x, t)
    }
  }
  const one: u32[] = new Array<u32>(count)
  one[0] = 1
  rsaMontMul(key, acc, acc, one, t)
  return acc
}

/**
 * RSAVP1 of RFC 8017 §5.2.2 with the length check of §8.1.2 step 1 and
 * §8.2.2 step 1: `sig` as an integer, raised to e mod n, as `key.size` bytes.
 * `null` when the key is not valid, `sig` is not exactly `key.size` bytes, or
 * its integer is n or more.
 */
const rsaRecover = (key: RsaPublicKey, sig: u8[]): u8[] | null => {
  if (!key.valid || toI32(sig.length) !== key.size) {
    return null
  }
  const s: u32[] = rsaLimbsFromBytes(sig, key.limbCount)
  if (!rsaLess(s, key.limbs, key.limbCount)) {
    return null
  }
  return rsaBytesFromLimbs(rsaPublicOp(key, s), key.size)
}

/** The digest length of `hash`, or 0 when it names no hash this module has. */
const rsaDigestSize = (hash: i32): i32 => {
  if (hash === RSA_SHA256) {
    return SHA256_SIZE
  }
  if (hash === RSA_SHA384) {
    return SHA384_SIZE
  }
  return hash === RSA_SHA512 ? SHA512_SIZE : 0
}

/** The digest of `data` under `hash`, which `rsaDigestSize` already found to be one of the three. */
const rsaHash = (hash: i32, data: u8[]): u8[] => {
  if (hash === RSA_SHA256) {
    return sha256(data)
  }
  return hash === RSA_SHA384 ? sha384(data) : sha512(data)
}

/** Whether `digest` is a digest of `hash`'s length, for a `hash` this module has. */
const rsaDigestOk = (hash: i32, digest: u8[]): boolean => {
  const hLen: i32 = rsaDigestSize(hash)
  return hLen !== 0 && toI32(digest.length) === hLen
}

/**
 * The DER of the DigestInfo of RFC 8017 §9.2 note 1 up to the digest itself:
 * a SEQUENCE of the AlgorithmIdentifier, with NULL parameters, and the
 * OCTET STRING's header.
 */
const rsaDigestInfoPrefix = (hash: i32): u8[] => {
  if (hash === RSA_SHA256) {
    return [
      0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00,
      0x04, 0x20,
    ]
  }
  if (hash === RSA_SHA384) {
    return [
      0x30, 0x41, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x02, 0x05, 0x00,
      0x04, 0x30,
    ]
  }
  return [
    0x30, 0x51, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x03, 0x05, 0x00,
    0x04, 0x40,
  ]
}

/**
 * Whether `sig` is a PKCS #1 v1.5 signature under `key` of a message whose
 * `hash` digest is `digest`: RSASSA-PKCS1-v1_5-VERIFY of RFC 8017 §8.2.2
 * from step 2 on. `false`, never a panic, for an invalid key, a `hash` that
 * is not `RSA_SHA256`, `RSA_SHA384` or `RSA_SHA512`, a digest of the wrong
 * length and any signature that does not verify.
 *
 * The encoding 00 01 FF..FF 00 || DigestInfo || digest is built here and
 * compared with the recovered one in full, so nothing in the recovered bytes
 * is parsed.
 */
export const rsaVerifyPkcs1Digest = (key: RsaPublicKey, hash: i32, digest: u8[], sig: u8[]): boolean => {
  if (!rsaDigestOk(hash, digest)) {
    return false
  }
  const em: u8[] | null = rsaRecover(key, sig)
  if (em === null) {
    return false
  }
  const k: i32 = key.size
  const hLen: i32 = toI32(digest.length)
  const tLen: i32 = RSA_DIGEST_INFO_PREFIX + hLen
  // k is at least 256 and tLen at most 83, so the padding string is far
  // longer than the 8 octets §9.2 step 3 asks of it.
  const expected: u8[] = new Array<u8>(k)
  const eLen: i32 = toI32(expected.length)
  expected[1] = 0x01
  for (let i: i32 = 2; i < k - tLen - 1 && i < eLen; i++) {
    expected[i] = 0xff
  }
  const prefix: u8[] = rsaDigestInfoPrefix(hash)
  const pLen: i32 = toI32(prefix.length)
  for (let i: i32 = 0; i < RSA_DIGEST_INFO_PREFIX && i < pLen; i++) {
    expected[k - tLen + i] = prefix[i]
  }
  for (let i: i32 = 0; i < hLen; i++) {
    expected[k - hLen + i] = digest[i]
  }
  return timingSafeEqual(em, expected)
}

/**
 * Whether `sig` is a PKCS #1 v1.5 signature under `key` of `msg`, hashed with
 * `hash`: `rsaVerifyPkcs1Digest` of `msg`'s digest.
 */
export const rsaVerifyPkcs1 = (key: RsaPublicKey, hash: i32, msg: u8[], sig: u8[]): boolean =>
  rsaDigestSize(hash) !== 0 && rsaVerifyPkcs1Digest(key, hash, rsaHash(hash, msg), sig)

/**
 * MGF1 of RFC 8017 §B.2.1 over `hash`: `len` bytes of
 * Hash(seed || 0) || Hash(seed || 1) || ..., the counter four bytes
 * big-endian, for the `hLen`-byte seed at `seed[seedAt ..]`.
 */
const rsaMgf1 = (hash: i32, seed: u8[], seedAt: i32, hLen: i32, len: i32): u8[] => {
  const out: u8[] = new Array<u8>(len)
  const outLen: i32 = toI32(out.length)
  const block: u8[] = new Array<u8>(hLen + 4)
  const blockLen: i32 = toI32(block.length)
  // Never taken for the callers' checked hash and hLen; the guard is the
  // bounds proof for the counter bytes below.
  if (hLen < 1 || hLen + 3 >= blockLen) {
    return out
  }
  for (let i: i32 = 0; i < hLen; i++) {
    block[i] = seed[seedAt + i]
  }
  let done: i32 = 0
  for (let counter: i32 = 0; done < outLen; counter++) {
    block[hLen] = toU8(counter >> 24)
    block[hLen + 1] = toU8(counter >> 16)
    block[hLen + 2] = toU8(counter >> 8)
    block[hLen + 3] = toU8(counter)
    const h: u8[] = rsaHash(hash, block)
    const hHave: i32 = toI32(h.length)
    if (hHave < hLen) {
      return out
    }
    for (let j: i32 = 0; j < hHave && j < hLen && done < outLen; j++) {
      out[done] = h[j]
      done++
    }
  }
  return out
}

/**
 * Whether `sig` is an RSA-PSS signature under `key`, with MGF1 over `hash`
 * and a salt of exactly `saltLen` bytes, of a message whose `hash` digest is
 * `digest`: RSASSA-PSS-VERIFY of RFC 8017 §8.1.2 with EMSA-PSS-VERIFY of
 * §9.1.2 from step 3 on. `false`, never a panic, for an invalid key, a `hash`
 * this module does not have, a digest of the wrong length, a `saltLen` below 0
 * or above emLen - hLen - 2, and any signature that does not verify.
 *
 * The salt length is the caller's to name, as TLS 1.3 and X.509 both fix it
 * (to the digest length, nearly always); a verifier that worked it out from
 * the signature would accept salts its caller never meant to allow.
 */
export const rsaVerifyPssDigest = (
  key: RsaPublicKey,
  hash: i32,
  saltLen: i32,
  digest: u8[],
  sig: u8[]
): boolean => {
  if (!rsaDigestOk(hash, digest)) {
    return false
  }
  const hLen: i32 = toI32(digest.length)
  // §8.1.2 step 2c and §9.1.2: EM is emLen = ceil(emBits / 8) bytes, for
  // emBits = modBits - 1, so it is one byte shorter than k when modBits - 1
  // is a multiple of 8.
  const emBits: i32 = key.bits - 1
  const emLen: i32 = (emBits + 7) >> 3
  if (saltLen < 0 || saltLen > emLen - hLen - 2) {
    return false
  }
  const m: u8[] | null = rsaRecover(key, sig)
  if (m === null) {
    return false
  }
  // I2OSP(m, emLen) of §8.1.2 step 2c: m must fit in emLen bytes.
  const off: i32 = key.size - emLen
  if (off === 1 && m[0] !== 0) {
    return false
  }
  // §9.1.2 step 4: the trailer field.
  if (m[off + emLen - 1] !== 0xbc) {
    return false
  }
  // §9.1.2 step 6: the 8 * emLen - emBits leftmost bits of maskedDB are zero.
  const dbLen: i32 = emLen - hLen - 1
  const topMask: u8 = toU8(toU32(0xff) >> toU32(8 * emLen - emBits))
  if ((m[off] & (0xff ^ topMask)) !== 0) {
    return false
  }
  // Steps 7 to 10: unmask DB, clear those bits, and check that it is
  // PS || 0x01 || salt with PS all zero and the salt exactly saltLen bytes.
  const db: u8[] = rsaMgf1(hash, m, off + dbLen, hLen, dbLen)
  const dbHave: i32 = toI32(db.length)
  for (let i: i32 = 0; i < dbLen && i < dbHave; i++) {
    db[i] = db[i] ^ m[off + i]
  }
  db[0] = db[0] & topMask
  const psLen: i32 = dbLen - saltLen - 1
  for (let i: i32 = 0; i < psLen && i < dbHave; i++) {
    if (db[i] !== 0) {
      return false
    }
  }
  if (db[psLen] !== 0x01) {
    return false
  }
  // Steps 12 to 14: H' = Hash(00 x 8 || mHash || salt), compared with H.
  const mPrime: u8[] = new Array<u8>(8 + hLen + saltLen)
  const mPrimeLen: i32 = toI32(mPrime.length)
  for (let i: i32 = 0; i < hLen && 8 + i < mPrimeLen; i++) {
    mPrime[8 + i] = digest[i]
  }
  for (let i: i32 = 0; i < saltLen; i++) {
    mPrime[8 + hLen + i] = db[dbLen - saltLen + i]
  }
  return timingSafeEqualAt(m, off + dbLen, rsaHash(hash, mPrime), 0, hLen)
}

/**
 * Whether `sig` is an RSA-PSS signature under `key` of `msg`, with `hash`
 * for the message, for MGF1 and for H, and a salt of `saltLen` bytes:
 * `rsaVerifyPssDigest` of `msg`'s digest.
 */
export const rsaVerifyPss = (key: RsaPublicKey, hash: i32, saltLen: i32, msg: u8[], sig: u8[]): boolean =>
  rsaDigestSize(hash) !== 0 && rsaVerifyPssDigest(key, hash, saltLen, rsaHash(hash, msg), sig)

/**
 * The key with big-endian modulus `n` and public exponent `e`, or `null` when
 * either is not minimal (a leading zero octet, or empty) or the pair breaks
 * the key policy: n odd with 2048 to 4096 bits, e odd with 3 <= e < 2^32.
 */
export const rsaPublicKeyFromParts = (n: u8[], e: u8[]): RsaPublicKey | null => {
  if (e.length === 0 || e.length > 4 || e[0] === 0) {
    return null
  }
  let exponent: u32 = 0
  for (let i: i32 = 0; i < toI32(e.length); i++) {
    exponent = (exponent << 8) | toU32(e[i])
  }
  const key: RsaPublicKey = new RsaPublicKey(n, exponent)
  return key.valid ? key : null
}

/**
 * The length of the DER element at `der[at]` when its tag is `tag`, its
 * length is in the minimal DER form and its contents lie inside `der[.. end)`;
 * otherwise -1. A key's longest element is under 64 KiB, so a length of more
 * than two octets is refused with the rest.
 */
const rsaDerLength = (der: u8[], at: i32, end: i32, tag: u8): i32 => {
  if (at > end - 2 || der[at] !== tag) {
    return -1
  }
  const first: i32 = toI32(der[at + 1])
  let length: i32 = first
  if (first === 0x81 && at <= end - 3) {
    length = toI32(der[at + 2])
    if (length < 0x80) {
      return -1
    }
  } else if (first === 0x82 && at <= end - 4) {
    length = (toI32(der[at + 2]) << 8) | toI32(der[at + 3])
    if (length < 0x100) {
      return -1
    }
  } else if (first >= 0x80) {
    return -1
  }
  return length > end - at - rsaDerHeader(length) ? -1 : length
}

/** The identifier and length octets in front of contents of `length` bytes, given minimal DER. */
const rsaDerHeader = (length: i32): i32 => {
  if (length < 0x80) {
    return 2
  }
  return length < 0x100 ? 3 : 4
}

/**
 * The magnitude of the DER INTEGER whose `length` contents start at
 * `der[at]`, without its sign octet, or `null` when it is negative, not
 * minimal or zero: this module wants no INTEGER that is not positive.
 */
const rsaDerPositive = (der: u8[], at: i32, length: i32): u8[] | null => {
  if (length < 1 || (der[at] & 0x80) !== 0) {
    return null
  }
  let from: i32 = at
  if (der[at] === 0) {
    // A leading zero is only there to keep a high bit from reading as a sign.
    if (length < 2 || (der[at + 1] & 0x80) === 0) {
      return null
    }
    from = at + 1
  }
  const out: u8[] = new Array<u8>(at + length - from)
  const outLen: i32 = toI32(out.length)
  for (let i: i32 = 0; i < outLen; i++) {
    out[i] = der[from + i]
  }
  return out
}

/**
 * The key a PKCS #1 `RSAPublicKey` (RFC 8017 §A.1.1) encodes, `SEQUENCE {
 * modulus INTEGER, publicExponent INTEGER }` in DER, or `null` when the DER is
 * not strict — a non-minimal length or INTEGER, a negative INTEGER, anything
 * after e or after the SEQUENCE — or the key breaks the policy
 * `rsaPublicKeyFromParts` states. The SubjectPublicKeyInfo of X.509, which
 * wraps this in an AlgorithmIdentifier and a BIT STRING, is not taken.
 */
export const rsaPublicKeyFromDer = (der: u8[]): RsaPublicKey | null => {
  // 1024 octets, twice the longest modulus: longer than any key the policy
  // takes, and short enough that the i32 offsets below cannot overflow.
  const length: number = der.length
  if (length > 1024) {
    return null
  }
  const end: i32 = toI32(der.length)
  const seqLength: i32 = rsaDerLength(der, 0, end, 0x30)
  if (seqLength < 0 || rsaDerHeader(seqLength) + seqLength !== end) {
    return null
  }
  const nAt: i32 = rsaDerHeader(seqLength)
  const nLength: i32 = rsaDerLength(der, nAt, end, 0x02)
  if (nLength < 0) {
    return null
  }
  const eAt: i32 = nAt + rsaDerHeader(nLength) + nLength
  const eLength: i32 = rsaDerLength(der, eAt, end, 0x02)
  if (eLength < 0 || eAt + rsaDerHeader(eLength) + eLength !== end) {
    return null
  }
  const n: u8[] | null = rsaDerPositive(der, nAt + rsaDerHeader(nLength), nLength)
  const e: u8[] | null = rsaDerPositive(der, eAt + rsaDerHeader(eLength), eLength)
  if (n === null || e === null) {
    return null
  }
  return rsaPublicKeyFromParts(n, e)
}
