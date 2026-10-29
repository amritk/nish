/**
 * `nish/crypto/rsa` — RSA signature verification: RSASSA-PKCS1-v1_5 and
 * RSASSA-PSS over SHA-256, SHA-384 and SHA-512, under a public key read from
 * its DER. Verification only; this module neither signs nor holds a private key.
 *
 *     import { RSA_HASH_SHA256, RsaPublicKey, rsaParsePublicKey, rsaVerifyPkcs1v15, rsaVerifyPss } from "nish/crypto/rsa";
 *
 *     const key: RsaPublicKey | null = rsaParsePublicKey(der);   // PKCS#1 RSAPublicKey
 *     const ok: boolean = key !== null && rsaVerifyPkcs1v15(key, RSA_HASH_SHA256, message, sig);
 *     const pss: boolean = key !== null && rsaVerifyPss(key, RSA_HASH_SHA256, 32, message, sig);
 *
 * **The key** is the DER of PKCS#1's `RSAPublicKey ::= SEQUENCE { modulus
 * INTEGER, publicExponent INTEGER }` (RFC 8017 §A.1.1), nothing before it and
 * nothing after it. It is read strictly: definite lengths in their shortest
 * form, each INTEGER positive and in its shortest form, a modulus of
 * `RSA_MIN_BITS` to `RSA_MAX_BITS` bits that is odd, and an exponent that is
 * odd, at least 3 and below 2^32 (so below the modulus). Anything else answers
 * `null`. The 2^32 bound is not RFC 8017's; it caps what one verification
 * costs, because the work grows with the exponent's length, and every
 * certificate in use carries 65537 (RSA-3, docs/security/crypto-rsa.md).
 *
 * **Verification** answers `false`, never a panic, for an unknown hash id, a
 * signature that is not exactly as long as the modulus or is not below it, a
 * negative salt length, and any encoding that is not exactly the one RFC 8017
 * defines. PKCS#1 v1.5 builds the whole encoded message it expects, `00 01 FF
 * … FF 00 DigestInfo`, and compares it with what the signature opens to, so no
 * part of the opened block is parsed (Bleichenbacher's 2006 forgery against a
 * parser that skipped trailing bytes). The DigestInfo carries the NULL
 * parameters RFC 8017 §9.2 note 1 prints; the form without them, which the
 * RFC lets a verifier accept, is refused. PSS is RFC 8017 §8.1.2 and §9.1.2
 * step by step, with MGF1 over the same hash as the message, the leftmost
 * bits of the masked block checked to be zero and the 0x01 separator checked.
 *
 * **Variable time, on purpose.** A public key, a signature and a message are
 * all public, so nothing here has a secret to leak: the exponentiation
 * branches on the exponent's bits, the reductions branch on comparisons and
 * the encodings are compared with an early exit. That is why this module does
 * not use `nish:secret` or `nish/crypto/ct`.
 *
 * **The arithmetic** is written for this module from the textbook. Numbers
 * are little-endian `u32` limbs, products are taken in `u64`, and modular
 * multiplication is Montgomery's (P. L. Montgomery, "Modular multiplication
 * without trial division", Math. Comp. 44, 1985) in the coarsely integrated
 * operand scanning form of Ç. K. Koç, T. Acar and B. S. Kaliski, "Analyzing
 * and comparing Montgomery multiplication algorithms" (IEEE Micro, 1996), the
 * same algorithm as A. Menezes, P. van Oorschot and S. Vanstone, *Handbook of
 * Applied Cryptography* (1996), Algorithm 14.36, with one conditional
 * subtraction at the end. The exponent is applied left to right by square
 * and multiply (HAC Algorithm 14.79's binary special case). The closest
 * upstream is BearSSL's `i31` code (`br_i31_montymul`, `br_i31_modpow`), and
 * nothing here follows it: BearSSL keeps 31-bit words and a constant-time
 * structure, this keeps 32-bit words and branches freely.
 *
 * Private names carry the `rsa` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import { sha256 } from "nish/crypto/sha256"
import { sha384, sha512 } from "nish/crypto/sha512"

/** SHA-256, the hash id `rsaVerifyPkcs1v15` and `rsaVerifyPss` take. The same number as `nish/crypto/x509`'s `X509_HASH_SHA256`. */
export const RSA_HASH_SHA256: i32 = 1

/** SHA-384. */
export const RSA_HASH_SHA384: i32 = 2

/** SHA-512. */
export const RSA_HASH_SHA512: i32 = 3

/** The smallest modulus `rsaParsePublicKey` accepts, in bits. A policy that wants 2048 checks `bits` itself. */
export const RSA_MIN_BITS: i32 = 1024

/** The largest modulus `rsaParsePublicKey` accepts, in bits. */
export const RSA_MAX_BITS: i32 = 8192

/**
 * A public key as `rsaParsePublicKey` read it. One built by hand is not
 * checked: the verifiers answer it without a panic, and their answer means
 * something only for a key the parser would accept. They read `n` and `e`,
 * never `bits`.
 */
export class RsaPublicKey {
  /** The modulus, big-endian with no leading zero byte. */
  n: u8[]
  /** The public exponent, big-endian with no leading zero byte. */
  e: u8[]
  /** The modulus's length in bits: 2048 for a 2048-bit key. */
  bits: i32

  constructor(n: u8[], e: u8[], bits: i32) {
    this.n = n
    this.e = e
    this.bits = bits
  }
}

// ---------------------------------------------------------------------------
// The key's DER (X.690 §8.1, §8.3, §10.1)
// ---------------------------------------------------------------------------

/**
 * Where the contents of the element at `der[at]` start, when it has the
 * identifier `tag` and a definite length in its shortest form that fits
 * before `end`; -1 otherwise. The length is `rsaDerLength`'s answer for the
 * same arguments. Lengths of more than two octets are refused: the largest
 * key's DER is about a kilobyte.
 */
const rsaDerContents = (der: u8[], at: i32, end: i32, tag: i32): i32 => {
  if (at < 0 || at + 2 > end || toI32(der[at]) !== tag) {
    return -1
  }
  const first: i32 = toI32(der[at + 1])
  let start: i32 = at + 2
  let length: i32 = first
  if (first === 0x81) {
    if (at + 3 > end) {
      return -1
    }
    length = toI32(der[at + 2])
    if (length < 0x80) {
      return -1
    }
    start = at + 3
  } else if (first === 0x82) {
    if (at + 4 > end) {
      return -1
    }
    length = (toI32(der[at + 2]) << 8) | toI32(der[at + 3])
    if (length < 0x100) {
      return -1
    }
    start = at + 4
  } else if (first >= 0x80) {
    return -1
  }
  if (length > end - start) {
    return -1
  }
  return start
}

/** The contents length of the element `rsaDerContents` found at `der[at]`. */
const rsaDerLength = (der: u8[], at: i32): i32 => {
  const first: i32 = toI32(der[at + 1])
  if (first === 0x81) {
    return toI32(der[at + 2])
  }
  if (first === 0x82) {
    return (toI32(der[at + 2]) << 8) | toI32(der[at + 3])
  }
  return first
}

/**
 * The magnitude of the positive INTEGER whose contents are `der[start ..
 * start + length)`, big-endian with no leading zero byte; `null` for an empty
 * one, a negative one, and one not in its shortest form (a leading 0x00 that
 * a clear top bit after it did not need).
 */
const rsaDerUnsigned = (der: u8[], start: i32, length: i32): u8[] | null => {
  const end: i32 = start + length
  if (start < 0 || length < 1 || end > toI32(der.length) || toI32(der[start]) >= 0x80) {
    return null
  }
  let from: i32 = start
  if (toI32(der[start]) === 0) {
    if (length === 1 || toI32(der[start + 1]) < 0x80) {
      return null
    }
    from = start + 1
  }
  const out: u8[] = new Array<u8>(end - from)
  for (let i: i32 = from; i < end; i++) {
    out[i - from] = der[i]
  }
  return out
}

/** The number of significant bits in the big-endian `v`, which has no leading zero byte. */
const rsaBitLength = (v: u8[]): i32 => {
  const length: i32 = toI32(v.length)
  if (length === 0) {
    return 0
  }
  let top: i32 = toI32(v[0])
  let bits: i32 = (length - 1) << 3
  while (top > 0) {
    bits += 1
    top = top >> 1
  }
  return bits
}

/** Whether the big-endian `a` is below `b`, both without a leading zero byte. */
const rsaBytesBelow = (a: u8[], b: u8[]): boolean => {
  const aLength: i32 = toI32(a.length)
  const bLength: i32 = toI32(b.length)
  if (aLength !== bLength) {
    return aLength < bLength
  }
  for (let i: i32 = 0; i < aLength && i < bLength; i++) {
    if (a[i] !== b[i]) {
      return a[i] < b[i]
    }
  }
  return false
}

/**
 * Reads the DER of a PKCS#1 `RSAPublicKey` (RFC 8017 §A.1.1), the whole of
 * `der`. Answers `null` for anything but one SEQUENCE of two positive,
 * minimally encoded INTEGERs with definite, minimal lengths and nothing
 * after it; for a modulus that is even or not `RSA_MIN_BITS` to
 * `RSA_MAX_BITS` bits long; and for an exponent that is even, below 3, or
 * not below 2^32 (which also keeps it below the modulus).
 */
export const rsaParsePublicKey = (der: u8[]): RsaPublicKey | null => {
  const total: i32 = toI32(der.length)
  const body: i32 = rsaDerContents(der, 0, total, 0x30)
  if (body < 0 || body + rsaDerLength(der, 0) !== total) {
    return null
  }
  const nStart: i32 = rsaDerContents(der, body, total, 0x02)
  if (nStart < 0) {
    return null
  }
  const nEnd: i32 = nStart + rsaDerLength(der, body)
  const eStart: i32 = rsaDerContents(der, nEnd, total, 0x02)
  if (eStart < 0) {
    return null
  }
  const eLength: i32 = rsaDerLength(der, nEnd)
  if (eStart + eLength !== total) {
    return null
  }
  const n: u8[] | null = rsaDerUnsigned(der, nStart, nEnd - nStart)
  const e: u8[] | null = rsaDerUnsigned(der, eStart, eLength)
  if (n === null || e === null) {
    return null
  }
  const bits: i32 = rsaBitLength(n)
  if (bits < RSA_MIN_BITS || bits > RSA_MAX_BITS || (toI32(n[toI32(n.length) - 1]) & 1) === 0) {
    return null
  }
  const eLast: i32 = toI32(e[toI32(e.length) - 1])
  if (toI32(e.length) > 4 || (eLast & 1) === 0 || (toI32(e.length) === 1 && eLast < 3)) {
    return null
  }
  return new RsaPublicKey(n, e, bits)
}

// ---------------------------------------------------------------------------
// Montgomery arithmetic on little-endian u32 limbs
// ---------------------------------------------------------------------------

/** The big-endian `bytes` as `limbs` little-endian `u32` limbs, limb 0 the least significant; `bytes` fits. */
const rsaLimbsFromBytes = (bytes: u8[], limbs: i32): u32[] => {
  const out: u32[] = new Array<u32>(limbs)
  const size: i32 = toI32(out.length)
  const length: i32 = toI32(bytes.length)
  for (let i: i32 = 0; i < length; i++) {
    const shift: i32 = length - 1 - i
    const limb: i32 = shift >> 2
    if (limb >= 0 && limb < size) {
      out[limb] = out[limb] | (toU32(bytes[i]) << toU32((shift & 3) << 3))
    }
  }
  return out
}

/** The limbs `a` as `size` big-endian bytes; the value fits. */
const rsaBytesFromLimbs = (a: u32[], size: i32): u8[] => {
  const out: u8[] = new Array<u8>(size)
  const limbs: i32 = toI32(a.length)
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    const shift: i32 = size - 1 - i
    const limb: i32 = shift >> 2
    if (limb >= 0 && limb < limbs) {
      out[i] = toU8(a[limb] >> toU32((shift & 3) << 3))
    }
  }
  return out
}

/**
 * -n^-1 mod 2^32 for the odd limb `n0`, by Newton's iteration: an odd `x`
 * with `x * n0 = 1` mod 2^b gives `x (2 - x n0)` with it mod 2^2b, and
 * `x = n0` already holds mod 8, so four steps reach 2^48.
 */
const rsaMontInverse = (n0: u32): u32 => {
  let x: u32 = n0
  for (let i: i32 = 0; i < 4; i++) {
    const nx: u32 = toU32(toU64(n0) * toU64(x))
    x = toU32(toU64(x) * toU64(toU32(2 - toU64(nx))))
  }
  return toU32(0 - toU64(x))
}

/** Whether the `count`-limb value `a` is at least `n`, compared from the top limb. */
const rsaAtLeast = (a: u32[], n: u32[], count: i32): boolean => {
  if (count > toI32(a.length) || count > toI32(n.length)) {
    return true
  }
  for (let i: i32 = count - 1; i >= 0; i--) {
    if (a[i] !== n[i]) {
      return a[i] > n[i]
    }
  }
  return true
}

/** `a = a - n` over `count` limbs, dropping the borrow out of the top. */
const rsaSubInPlace = (a: u32[], n: u32[], count: i32): void => {
  if (count > toI32(a.length) || count > toI32(n.length)) {
    return
  }
  let borrow: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const d: u64 = toU64(a[i]) - toU64(n[i]) - borrow
    a[i] = toU32(d)
    borrow = (d >> 32) & 1
  }
}

/**
 * `out = a b R^-1 mod n`, R = 2^(32 count), for `a` and `b` below `n`: Koç,
 * Acar and Kaliski's CIOS. `t` is scratch of `count + 2` limbs. Each row adds
 * `a b[i]` into `t`, then the multiple `m n` of the modulus that clears the
 * low limb, and shifts down a limb; `t` stays below 2n, and one subtraction
 * of `n` brings it below `n`. Every sum is at most (2^32 - 1) + (2^32 - 1)^2
 * + (2^32 - 1) = 2^64 - 1, so a `u64` holds it.
 */
const rsaMontMul = (out: u32[], a: u32[], b: u32[], n: u32[], n0inv: u32, t: u32[], count: i32): void => {
  if (
    count < 1 ||
    count > toI32(out.length) ||
    count > toI32(a.length) ||
    count > toI32(b.length) ||
    count > toI32(n.length) ||
    count + 2 > toI32(t.length)
  ) {
    return
  }
  for (let i: i32 = 0; i < toI32(t.length); i++) {
    t[i] = 0
  }
  for (let i: i32 = 0; i < count; i++) {
    const bi: u64 = toU64(b[i])
    let carry: u64 = 0
    for (let j: i32 = 0; j < count; j++) {
      const s: u64 = toU64(t[j]) + toU64(a[j]) * bi + carry
      t[j] = toU32(s)
      carry = s >> 32
    }
    const top: u64 = toU64(t[count]) + carry
    t[count] = toU32(top)
    t[count + 1] = toU32(top >> 32)
    const m: u64 = toU64(toU32(toU64(t[0]) * toU64(n0inv)))
    let c: u64 = (toU64(t[0]) + m * toU64(n[0])) >> 32
    for (let j: i32 = 1; j < count; j++) {
      const s: u64 = toU64(t[j]) + m * toU64(n[j]) + c
      t[j - 1] = toU32(s)
      c = s >> 32
    }
    const last: u64 = toU64(t[count]) + c
    t[count - 1] = toU32(last)
    t[count] = t[count + 1] + toU32(last >> 32)
  }
  if (t[count] !== 0 || rsaAtLeast(t, n, count)) {
    rsaSubInPlace(t, n, count)
  }
  for (let i: i32 = 0; i < count; i++) {
    out[i] = t[i]
  }
}

/** `r = 2 r mod n` over `count` limbs, for `r` below `n`; `r[count]` takes the bit the doubling carries out, so the comparison with `n` sees it. */
const rsaDoubleMod = (r: u32[], n: u32[], count: i32): void => {
  if (count < 1 || count > toI32(n.length) || count + 1 > toI32(r.length)) {
    return
  }
  let carry: u32 = 0
  for (let i: i32 = 0; i < count; i++) {
    const v: u32 = r[i]
    r[i] = (v << 1) | carry
    carry = v >> 31
  }
  r[count] = carry
  if (carry !== 0 || rsaAtLeast(r, n, count)) {
    rsaSubInPlace(r, n, count)
    r[count] = 0
  }
}

/**
 * R^2 mod n, R = 2^(32 count), for the `count`-limb odd `n`. Writing 32 count
 * as `s 2^j` with `s` odd, doubling 1 modulo `n` 32 count + s times gives
 * R 2^s, and each Montgomery squaring of R 2^x gives R 2^2x, so `j` of them
 * reach R 2^(32 count) = R^2: about a quarter of the work of doubling all the
 * way.
 */
const rsaMontR2 = (n: u32[], n0inv: u32, t: u32[], count: i32): u32[] => {
  let s: i32 = count << 5
  let squarings: i32 = 0
  while (s > 0 && (s & 1) === 0) {
    s = s >> 1
    squarings += 1
  }
  const r: u32[] = new Array<u32>(count + 1)
  r[0] = 1
  for (let k: i32 = 0; k < (count << 5) + s; k++) {
    rsaDoubleMod(r, n, count)
  }
  for (let k: i32 = 0; k < squarings; k++) {
    rsaMontMul(r, r, r, n, n0inv, t, count)
  }
  return r
}

/**
 * `s^e mod n` as `size` big-endian bytes, for an odd `n` and an `s` below it.
 * R^2 mod n comes from `rsaMontR2`; `s` is moved into
 * the Montgomery domain by one multiplication by it, raised by square and
 * multiply from the exponent's top bit, and moved out by a multiplication by 1.
 */
const rsaModPow = (s: u8[], e: u8[], n: u8[], size: i32): u8[] => {
  const count: i32 = (toI32(n.length) + 3) >> 2
  const nl: u32[] = rsaLimbsFromBytes(n, count)
  const n0inv: u32 = rsaMontInverse(nl[0])
  const t: u32[] = new Array<u32>(count + 2)
  const r2: u32[] = rsaMontR2(nl, n0inv, t, count)
  const base: u32[] = new Array<u32>(count)
  rsaMontMul(base, rsaLimbsFromBytes(s, count), r2, nl, n0inv, t, count)
  const acc: u32[] = new Array<u32>(count)
  for (let i: i32 = 0; i < toI32(acc.length) && i < toI32(base.length); i++) {
    acc[i] = base[i]
  }
  const bits: i32 = rsaBitLength(e)
  const eLength: i32 = toI32(e.length)
  for (let k: i32 = bits - 2; k >= 0; k--) {
    rsaMontMul(acc, acc, acc, nl, n0inv, t, count)
    const at: i32 = eLength - 1 - (k >> 3)
    if (at >= 0 && at < eLength && ((toI32(e[at]) >> (k & 7)) & 1) === 1) {
      rsaMontMul(acc, acc, base, nl, n0inv, t, count)
    }
  }
  const one: u32[] = new Array<u32>(count)
  one[0] = 1
  rsaMontMul(acc, acc, one, nl, n0inv, t, count)
  return rsaBytesFromLimbs(acc, size)
}

/**
 * RSAVP1 (RFC 8017 §5.2.2) after §8.1.2 and §8.2.2's step 1: the signature as
 * `size` big-endian bytes raised to `e` mod `n`, or `null` when the signature
 * is not exactly as long as the modulus or its integer is not below `n`.
 * `size` is the encoded message's length, the modulus's or one byte less; a
 * value too large for it answers `null`.
 */
const rsaOpen = (key: RsaPublicKey, sig: u8[], size: i32): u8[] | null => {
  const k: i32 = toI32(sig.length)
  if (k !== toI32(key.n.length) || size < 0 || size > k) {
    return null
  }
  let lead: i32 = 0
  while (lead < k && toI32(sig[lead]) === 0) {
    lead += 1
  }
  const trimmed: u8[] = new Array<u8>(k - lead)
  for (let i: i32 = lead; i < k; i++) {
    trimmed[i - lead] = sig[i]
  }
  if (!rsaBytesBelow(trimmed, key.n)) {
    return null
  }
  const m: u8[] = rsaModPow(trimmed, key.e, key.n, k)
  const mLength: i32 = toI32(m.length)
  for (let i: i32 = 0; i < mLength - size && i < mLength; i++) {
    if (toI32(m[i]) !== 0) {
      return null
    }
  }
  const out: u8[] = new Array<u8>(size)
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = m[mLength - size + i]
  }
  return out
}

// ---------------------------------------------------------------------------
// The encodings (RFC 8017 §9.1, §9.2, §B.2.1)
// ---------------------------------------------------------------------------

/** The digest length of the hash id `hash`, or 0 for an id this module does not know. */
const rsaHashSize = (hash: i32): i32 => {
  if (hash === RSA_HASH_SHA256) {
    return 32
  }
  if (hash === RSA_HASH_SHA384) {
    return 48
  }
  if (hash === RSA_HASH_SHA512) {
    return 64
  }
  return 0
}

/** The digest of `data` under the hash id `hash`, which `rsaHashSize` knows. */
const rsaDigest = (hash: i32, data: u8[]): u8[] => {
  if (hash === RSA_HASH_SHA384) {
    return sha384(data)
  }
  if (hash === RSA_HASH_SHA512) {
    return sha512(data)
  }
  return sha256(data)
}

/**
 * The DER of the DigestInfo's algorithm and the OCTET STRING header before
 * the digest, RFC 8017 §9.2 note 1: the id-sha256, id-sha384 or id-sha512 OID
 * with NULL parameters. The OIDs differ in their last octet alone.
 */
const rsaDigestInfoPrefix = (hash: i32, hashSize: i32): u8[] => {
  const out: u8[] = [
    0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00,
    0x04, 0x20,
  ]
  out[1] = toU8(hashSize + 17)
  out[14] = toU8(hash)
  out[18] = toU8(hashSize)
  return out
}

/** Whether `a` and `b` hold the same bytes. Both are public, so it stops at the first difference. */
const rsaSameBytes = (a: u8[], b: u8[]): boolean => {
  const length: i32 = toI32(a.length)
  if (toI32(b.length) !== length) {
    return false
  }
  for (let i: i32 = 0; i < length && i < toI32(b.length); i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

/**
 * Verifies an RSASSA-PKCS1-v1_5 signature (RFC 8017 §8.2.2) of `msg` under
 * `key`, with the hash id `hash`. The encoded message the signature should
 * open to, `00 01 FF … FF 00 DigestInfo`, is built whole (EMSA-PKCS1-v1_5,
 * §9.2) and compared with what it does open to. `false` for an unknown hash
 * id, a modulus too short for the encoding, a signature that is not exactly
 * as long as the modulus or not below it, and any other bytes.
 */
export const rsaVerifyPkcs1v15 = (key: RsaPublicKey, hash: i32, msg: u8[], sig: u8[]): boolean => {
  const hashSize: i32 = rsaHashSize(hash)
  const k: i32 = toI32(key.n.length)
  const prefix: u8[] = rsaDigestInfoPrefix(hash, hashSize)
  const tLength: i32 = toI32(prefix.length) + hashSize
  if (hashSize === 0 || k < tLength + 11) {
    return false
  }
  const em: u8[] | null = rsaOpen(key, sig, k)
  if (em === null) {
    return false
  }
  const expected: u8[] = [0x00, 0x01]
  for (let i: i32 = 2; i < k - tLength - 1; i++) {
    expected.push(0xff)
  }
  expected.push(0x00)
  for (const byte of prefix) {
    expected.push(byte)
  }
  for (const byte of rsaDigest(hash, msg)) {
    expected.push(byte)
  }
  return rsaSameBytes(em, expected)
}

/**
 * MGF1 (RFC 8017 §B.2.1) with the hash id `hash` over `seed`, `length` bytes:
 * the digests of `seed || C` for the four-byte counters C = 0, 1, …, joined.
 */
const rsaMgf1 = (hash: i32, seed: u8[], length: i32): u8[] => {
  const out: u8[] = []
  for (let counter: i32 = 0; toI32(out.length) < length; counter++) {
    const input: u8[] = []
    for (const byte of seed) {
      input.push(byte)
    }
    input.push(toU8(counter >> 24))
    input.push(toU8(counter >> 16))
    input.push(toU8(counter >> 8))
    input.push(toU8(counter))
    for (const byte of rsaDigest(hash, input)) {
      if (toI32(out.length) < length) {
        out.push(byte)
      }
    }
  }
  return out
}

/**
 * Verifies an RSASSA-PSS signature (RFC 8017 §8.1.2) of `msg` under `key`,
 * with the hash id `hash` for the message and for MGF1, and a salt of exactly
 * `saltLen` bytes. Every check of EMSA-PSS-VERIFY (§9.1.2) is made: the
 * length, the trailing 0xbc, the leftmost `8 emLen - emBits` bits of the
 * masked block and of the unmasked one, the zero octets and the 0x01 before
 * the salt, and the hash. `false` for any of them, an unknown hash id, a
 * negative `saltLen`, and a signature that is not exactly as long as the
 * modulus or not below it.
 */
export const rsaVerifyPss = (key: RsaPublicKey, hash: i32, saltLen: i32, msg: u8[], sig: u8[]): boolean => {
  const hashSize: i32 = rsaHashSize(hash)
  if (hashSize === 0 || saltLen < 0) {
    return false
  }
  const emBits: i32 = rsaBitLength(key.n) - 1
  const emLen: i32 = (emBits + 7) >> 3
  if (saltLen > emLen || emLen < hashSize + saltLen + 2) {
    return false
  }
  const em: u8[] | null = rsaOpen(key, sig, emLen)
  if (em === null || toI32(em[emLen - 1]) !== 0xbc) {
    return false
  }
  const dbLength: i32 = emLen - hashSize - 1
  const full: i32 = 0xff
  const topMask: i32 = full >> ((emLen << 3) - emBits)
  if ((toI32(em[0]) & ~topMask) !== 0) {
    return false
  }
  const h: u8[] = []
  for (let i: i32 = dbLength; i < emLen - 1; i++) {
    h.push(em[i])
  }
  const db: u8[] = rsaMgf1(hash, h, dbLength)
  for (let i: i32 = 0; i < dbLength && i < toI32(db.length); i++) {
    db[i] = db[i] ^ em[i]
  }
  db[0] = toU8(toI32(db[0]) & topMask)
  const zeros: i32 = emLen - hashSize - saltLen - 2
  for (let i: i32 = 0; i < zeros && i < toI32(db.length); i++) {
    if (toI32(db[i]) !== 0) {
      return false
    }
  }
  if (toI32(db[zeros]) !== 0x01) {
    return false
  }
  const prime: u8[] = [0, 0, 0, 0, 0, 0, 0, 0]
  for (const byte of rsaDigest(hash, msg)) {
    prime.push(byte)
  }
  for (let i: i32 = dbLength - saltLen; i >= 0 && i < dbLength && i < toI32(db.length); i++) {
    prime.push(db[i])
  }
  return rsaSameBytes(rsaDigest(hash, prime), h)
}
