/**
 * `nish/crypto/rsa` — RSA signature verification: RSASSA-PKCS1-v1_5 and
 * RSASSA-PSS over SHA-256, SHA-384 and SHA-512, under a public key read from
 * its DER. Verification only; this module neither signs nor holds a private key.
 *
 *     import { RSA_HASH_SHA256, RsaPublicKey, rsaParsePublicKey, rsaVerifyPkcs1v15, rsaVerifyPss } from "nish/crypto/rsa";
 *
 *     // der: a PKCS#1 RSAPublicKey; sig: as long as the modulus
 *     const verify = (der: u8[], message: u8[], sig: u8[]): boolean => {
 *       const key: RsaPublicKey | null = rsaParsePublicKey(der);
 *       if (key === null) {
 *         return false;
 *       }
 *       return rsaVerifyPkcs1v15(key, RSA_HASH_SHA256, message, sig) || rsaVerifyPss(key, RSA_HASH_SHA256, 32, message, sig);
 *     };
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
 * defines. PKCS#1 v1.5 builds the whole encoded message it expects, `00 01 FF …
 * FF 00 DigestInfo`, and compares it with what the signature opens to, so no
 * part of the opened block is parsed (Bleichenbacher's 2006 forgery against a
 * parser that skipped trailing bytes).
 *
 *  The DigestInfo carries the NULL parameters RFC 8017 §9.2 note 1 prints; the
 *  form without them, which the RFC lets a verifier accept, is refused. PSS is
 *  RFC 8017 §8.1.2 and §9.1.2 step by step, with MGF1 over the same hash as the
 *  message, the leftmost bits of the masked block checked to be zero and the
 *  0x01 separator checked.
 *
 * **Variable time, on purpose.** A public key, a signature and a message are
 * all public, so nothing here has a secret to leak: the exponentiation
 * branches on the exponent's bits, the reductions branch on comparisons and
 * the encodings are compared with an early exit. That is why this module does
 * not use `nish:secret` or `nish/crypto/ct`.
 *
 * **The arithmetic** is written for this module from the textbook. Numbers are
 * little-endian `u32` limbs, products are taken in `u64`, and modular
 * multiplication is Montgomery's (P. L. Montgomery, "Modular multiplication
 * without trial division", Math. Comp. 44, 1985) in the coarsely integrated
 * operand scanning form of Ç. K. Koç, T. Acar and B. S. Kaliski, "Analyzing and
 * comparing Montgomery multiplication algorithms" (IEEE Micro, 1996), the same
 * algorithm as A. Menezes, P. van Oorschot and S. Vanstone, *Handbook of
 * Applied Cryptography* (1996), Algorithm 14.36, with one conditional
 * subtraction at the end.
 *
 *  The exponent is applied left to right by square and multiply (HAC Algorithm
 *  14.79's binary special case). The closest upstream is BearSSL's `i31` code
 *  (`br_i31_montymul`, `br_i31_modpow`), and nothing here follows it: BearSSL
 *  keeps 31-bit words and a constant-time structure, this keeps 32-bit words and
 *  branches freely.
 *
 * Private names carry the `rsa` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import { timingSafeEqual } from "nish/crypto/ct"
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

  /**
   * Keeps the arrays given, without a copy or a check.
   *
   * @param n The modulus, big-endian with no leading zero byte.
   * @param e The public exponent, big-endian with no leading zero byte.
   * @param bits The modulus's length in bits.
   */
  constructor(n: u8[], e: u8[], bits: i32) {
    this.n = n
    this.e = e
    this.bits = bits
  }
}

// ---------------------------------------------------------------------------
// The key's DER (X.690 §8.1, §8.3, §10.1)
// ---------------------------------------------------------------------------

/** Where an element's contents lie in its DER: `der[start .. end)`. */
class RsaDerSpan {
  /** The first byte of the contents. */
  start: i32
  /** One past the last byte of the contents. */
  end: i32

  constructor(start: i32, end: i32) {
    this.start = start
    this.end = end
  }
}

/**
 * The contents of the element at `der[at]`, when it has the identifier `tag`
 * and a definite length in its shortest form that fits before `end`; `null`
 * otherwise, and for an `at` or `end` outside `der`. Lengths of more than two
 * octets are refused: the largest key's DER is about a kilobyte.
 */
const rsaDerElement = (der: u8[], at: i32, end: i32, tag: i32): RsaDerSpan | null => {
  const total: i32 = toI32(der.length)
  if (end < 2 || end > total || at < 0 || at > end - 2 || at > total - 2 || toI32(der[at]) !== tag) {
    return null
  }
  const first: i32 = toI32(der[at + 1])
  let start: i32 = at + 2
  let length: i32 = first
  if (first === 0x81) {
    if (at > end - 3 || at > total - 3) {
      return null
    }
    length = toI32(der[at + 2])
    if (length < 0x80) {
      return null
    }
    start = at + 3
  } else if (first === 0x82) {
    if (at > end - 4 || at > total - 4) {
      return null
    }
    length = (toI32(der[at + 2]) << 8) | toI32(der[at + 3])
    if (length < 0x100) {
      return null
    }
    start = at + 4
  } else if (first >= 0x80) {
    return null
  }
  if (length > end - start) {
    return null
  }
  // In i64, as the prover cannot add two i32s it only bounds apart; the check
  // above keeps the sum at most `end`.
  return new RsaDerSpan(start, toI32(toI64(start) + toI64(length)))
}

/**
 * The magnitude of the positive INTEGER whose contents are `der[start ..
 * end)`, big-endian with no leading zero byte; `null` for an empty one, a
 * negative one, one not in its shortest form (a leading 0x00 that a clear top
 * bit after it did not need), and a range outside `der`.
 */
const rsaDerUnsigned = (der: u8[], start: i32, end: i32): u8[] | null => {
  const total: i32 = toI32(der.length)
  if (start < 0 || start >= end || start >= total || end > total || toI32(der[start]) >= 0x80) {
    return null
  }
  let from: i32 = start
  if (toI32(der[start]) === 0) {
    from = start + 1
    if (from >= end || from >= total || toI32(der[from]) < 0x80) {
      return null
    }
  }
  const first: i32 = from
  return der.filter((_b: u8, k: number): boolean => toI32(k) >= first && toI32(k) < end)
}

/**
 * The number of significant bits in the big-endian `v`, which has no leading
 * zero byte; -1 for one of 2^28 bytes or more, whose count an `i32` might
 * not hold.
 */
const rsaBitLength = (v: u8[]): i32 => {
  if (toI32(v.length) < 1) {
    return 0
  }
  const length: i32 = toI32(v.length)
  if (length > 0x0fffffff) {
    return -1
  }
  const top: i32 = toI32(v[0])
  let topBits: i32 = 0
  for (let b: i32 = 0; b < 8; b++) {
    if (top >> b !== 0) {
      topBits = b + 1
    }
  }
  // At most (2^28 - 2) 8 + 8, below 2^31, so the u32 sum is the count.
  return toI32(toU32(length - 1) * 8 + toU32(topBits))
}

/**
 * Reads the DER of a PKCS#1 `RSAPublicKey` (RFC 8017 §A.1.1), the whole of
 * `der`. Answers `null` for anything but one SEQUENCE of two positive,
 * minimally encoded INTEGERs with definite, minimal lengths and nothing
 * after it; for a modulus that is even or not `RSA_MIN_BITS` to
 * `RSA_MAX_BITS` bits long; and for an exponent that is even, below 3, or
 * not below 2^32 (which also keeps it below the modulus).
 *
 * @param der The key's DER, nothing before it and nothing after it.
 * @returns A new key whose modulus and exponent are copied out of `der`, or
 *   `null`.
 */
export const rsaParsePublicKey = (der: u8[]): RsaPublicKey | null => {
  const total: i32 = toI32(der.length)
  const body: RsaDerSpan | null = rsaDerElement(der, 0, total, 0x30)
  if (body === null || body.end !== total) {
    return null
  }
  const nSpan: RsaDerSpan | null = rsaDerElement(der, body.start, total, 0x02)
  if (nSpan === null) {
    return null
  }
  const eSpan: RsaDerSpan | null = rsaDerElement(der, nSpan.end, total, 0x02)
  if (eSpan === null || eSpan.end !== total) {
    return null
  }
  const nRead: u8[] | null = rsaDerUnsigned(der, nSpan.start, nSpan.end)
  const eRead: u8[] | null = rsaDerUnsigned(der, eSpan.start, eSpan.end)
  if (nRead === null || eRead === null) {
    return null
  }
  const n: u8[] = nRead
  const e: u8[] = eRead
  const nLength: i32 = toI32(n.length)
  const eLength: i32 = toI32(e.length)
  if (nLength === 0 || eLength === 0) {
    return null
  }
  const nLast: i32 = toI32(n[nLength - 1])
  const eLast: i32 = toI32(e[eLength - 1])
  const bits: i32 = rsaBitLength(n)
  if (bits < RSA_MIN_BITS || bits > RSA_MAX_BITS || (nLast & 1) === 0 || eLength > 4) {
    return null
  }
  if ((eLast & 1) === 0 || (eLength === 1 && eLast < 3)) {
    return null
  }
  return new RsaPublicKey(n, e, bits)
}

// ---------------------------------------------------------------------------
// Montgomery arithmetic on little-endian u32 limbs
// ---------------------------------------------------------------------------

/**
 * The big-endian `bytes` into the first `limbs` little-endian `u32` limbs of
 * `out`, limb 0 the least significant; `bytes` fits in them. A byte before the
 * start of `bytes` is one of its leading zeros.
 */
const rsaLimbsFromBytes = (out: u32[], bytes: u8[], limbs: i32): void => {
  // `at` walks `bytes` from its last byte; once it passes the first, the
  // bytes left are the leading zeros.
  let at: i32 = toI32(bytes.length) - 1
  for (let limb: i32 = 0; limb < limbs; limb++) {
    let v: u32 = 0
    for (let b: i32 = 0; b < 4; b++) {
      if (at >= 0) {
        v = v | (toU32(bytes[at]) << toU32(b * 8))
        at = at - 1
      }
    }
    out[limb] = v
  }
}

/**
 * The limbs `a` as `size` big-endian bytes, `size` 1 to 1024; the value fits.
 * Byte `j` from the bottom is built at `1023 - j` of a 1024-byte buffer, whose
 * last `size` bytes are the answer.
 */
const rsaBytesFromLimbs = (a: u32[], size: i32): u8[] => {
  const out: u8[] = new Array<u8>(1024)
  for (let j: i32 = 0; j < size; j++) {
    out[1023 - j] = toU8(a[toI32(j / 4)] >> toU32((j & 3) << 3))
  }
  const from: i32 = 1024 - size
  return out.filter((_b: u8, k: number): boolean => toI32(k) >= from)
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
  for (let i: i32 = count - 1; i >= 0; i--) {
    if (a[i] !== n[i]) {
      return a[i] > n[i]
    }
  }
  return true
}

/** `a = a - n` over `count` limbs, dropping the borrow out of the top. */
const rsaSubInPlace = (a: u32[], n: u32[], count: i32): void => {
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
 * of `n` brings it below `n`. Every sum is
 * at most (2^32 - 1) + (2^32 - 1)^2 + (2^32 - 1) = 2^64 - 1, so a `u64` holds it.
 */
const rsaMontMul = (out: u32[], a: u32[], b: u32[], n: u32[], n0inv: u32, t: u32[], count: i32): void => {
  for (let i: i32 = 0; i < count; i++) {
    t[i] = 0
  }
  t[count] = 0
  t[count + 1] = 0
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
 * R^2 mod n into `r`, which holds zeros, R = 2^(32 count), for the
 * `count`-limb odd `n`. Writing 32 count as `s 2^j` with `s` odd, doubling 1
 * modulo `n` 32 count + s times gives R 2^s, and each Montgomery squaring of
 * R 2^x gives R 2^2x, so `j` of them reach R 2^(32 count) = R^2: about a
 * quarter of the work of doubling all the way.
 */
const rsaMontR2 = (r: u32[], n: u32[], n0inv: u32, t: u32[], count: i32): void => {
  let s: i32 = count * 32
  let squarings: i32 = 0
  // `s` is 32 to 8192, 2^13, so it halves to odd within 13 steps.
  for (let j: i32 = 0; j < 13; j++) {
    if ((s & 1) === 0) {
      s = s >> 1
      squarings = j + 1
    }
  }
  r[0] = 1
  for (let k: i32 = 0; k < count * 32; k++) {
    rsaDoubleMod(r, n, count)
  }
  for (let k: i32 = 0; k < s; k++) {
    rsaDoubleMod(r, n, count)
  }
  for (let k: i32 = 0; k < squarings; k++) {
    rsaMontMul(r, r, r, n, n0inv, t, count)
  }
}

/**
 * `s^e mod n` as big-endian bytes as long as `n`, for an odd `n`; `null`
 * for an `n` of no bytes or more than 1024, an `e` of zero, and an `s` longer
 * than `n` or not below it (RSAVP1's range check). Every limb array is 256 limbs, the most a 1024-byte `n` has, plus
 * the room `rsaDoubleMod`'s carry and `rsaMontMul`'s scratch take. R^2 mod n
 * comes from `rsaMontR2`; `s` is moved into the Montgomery domain by one
 * multiplication by it, raised by square and multiply from the exponent's top
 * bit, and moved out by a multiplication by 1.
 */
const rsaModPow = (s: u8[], e: u8[], n: u8[]): u8[] | null => {
  const nLength: i32 = toI32(n.length)
  if (nLength < 1 || nLength > 1024 || toI32(s.length) > nLength || rsaBitLength(e) < 1) {
    return null
  }
  const count: i32 = toI32((nLength + 3) / 4)
  const nl: u32[] = new Array<u32>(256)
  rsaLimbsFromBytes(nl, n, count)
  const n0inv: u32 = rsaMontInverse(nl[0])
  const t: u32[] = new Array<u32>(258)
  const r2: u32[] = new Array<u32>(257)
  rsaMontR2(r2, nl, n0inv, t, count)
  const sl: u32[] = new Array<u32>(256)
  rsaLimbsFromBytes(sl, s, count)
  // RSAVP1's range check: `s` must be below `n`. Limbs past `count` are zero
  // in both, so the compare walks all 256 from the top.
  let below: i32 = 0
  for (let i: i32 = 255; i >= 0; i--) {
    if (below === 0 && sl[i] !== nl[i]) {
      below = sl[i] < nl[i] ? 1 : -1
    }
  }
  if (below !== 1) {
    return null
  }
  const base: u32[] = new Array<u32>(256)
  rsaMontMul(base, sl, r2, nl, n0inv, t, count)
  const acc: u32[] = new Array<u32>(256)
  for (let i: i32 = 0; i < count; i++) {
    acc[i] = base[i]
  }
  // `acc` holds `s` for the top bit; each bit after it squares, and a set
  // one multiplies by `s`.
  let started: boolean = false
  for (const byte of e) {
    for (let b: i32 = 7; b >= 0; b--) {
      const bit: i32 = (toI32(byte) >> b) & 1
      if (started) {
        rsaMontMul(acc, acc, acc, nl, n0inv, t, count)
        if (bit === 1) {
          rsaMontMul(acc, acc, base, nl, n0inv, t, count)
        }
      } else if (bit === 1) {
        started = true
      }
    }
  }
  const one: u32[] = new Array<u32>(256)
  one[0] = 1
  rsaMontMul(acc, acc, one, nl, n0inv, t, count)
  return rsaBytesFromLimbs(acc, nLength)
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
  const opened: u8[] | null = rsaModPow(sig, key.e, key.n)
  if (opened === null) {
    return null
  }
  const m: u8[] = opened
  const mLength: i32 = toI32(m.length)
  if (mLength < size) {
    return null
  }
  // The bytes above the last `size` are zeros, or the value is too large.
  const out: u8[] = []
  for (let i: i32 = 0; i < toI32(m.length); i++) {
    if (i < mLength - size) {
      if (toI32(m[i]) !== 0) {
        return null
      }
    } else {
      out.push(m[i])
    }
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
  // A digest is at most 64 bytes, so the u32 sum is the body's length.
  out[1] = toU8(toU32(hashSize) + 17)
  out[14] = toU8(hash)
  out[18] = toU8(hashSize)
  return out
}

/**
 * Verifies an RSASSA-PKCS1-v1_5 signature (RFC 8017 §8.2.2) of `msg` under
 * `key`, with the hash id `hash`. The encoded message the signature should
 * open to, `00 01 FF … FF 00 DigestInfo`, is built whole (EMSA-PKCS1-v1_5,
 * §9.2) and compared with what it does open to. `false` for an unknown hash
 * id, a modulus too short for the encoding, a signature that is not exactly
 * as long as the modulus or not below it, and any other bytes.
 *
 * @param key The signer's public key.
 * @param hash `RSA_HASH_SHA256`, `RSA_HASH_SHA384` or `RSA_HASH_SHA512`.
 * @param msg The message signed, whole; it is hashed here.
 * @param sig The signature, big-endian.
 * @returns `true` only when `sig` is `key`'s signature of `msg`.
 */
export const rsaVerifyPkcs1v15 = (key: RsaPublicKey, hash: i32, msg: u8[], sig: u8[]): boolean => {
  const hashSize: i32 = rsaHashSize(hash)
  const k: i32 = toI32(key.n.length)
  // 1024 is RSA_MAX_BITS / 8: a longer modulus is one the parser refuses.
  if (hashSize < 1 || hashSize > 64 || k > 1024) {
    return false
  }
  const prefix: u8[] = rsaDigestInfoPrefix(hash, hashSize)
  // The prefix is the 19-byte literal `rsaDigestInfoPrefix` builds.
  const tLength: i32 = 19 + hashSize
  if (k < tLength + 11) {
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
  return timingSafeEqual(em, expected)
}

/**
 * XORs MGF1 (RFC 8017 §B.2.1) with the hash id `hash` over `seed` into
 * `target`, as many bytes as it holds: the digests of `seed || C` for the
 * four-byte counters C = 0, 1, …, joined.
 */
const rsaMgf1Xor = (hash: i32, seed: u8[], target: u8[]): void => {
  let pos: i32 = 0
  let counter: u32 = 0
  // Each round's digest is at least 32 bytes, so the loop ends.
  while (pos < toI32(target.length)) {
    const input: u8[] = []
    for (const byte of seed) {
      input.push(byte)
    }
    input.push(toU8(counter >> 24))
    input.push(toU8(counter >> 16))
    input.push(toU8(counter >> 8))
    input.push(toU8(counter))
    for (const byte of rsaDigest(hash, input)) {
      if (pos < toI32(target.length)) {
        target[pos] = target[pos] ^ byte
        pos += 1
      }
    }
    counter = counter + 1
  }
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
 *
 * @param key The signer's public key.
 * @param hash `RSA_HASH_SHA256`, `RSA_HASH_SHA384` or `RSA_HASH_SHA512`.
 * @param saltLen The salt's length in bytes; a signature with any other
 *   length is refused.
 * @param msg The message signed, whole; it is hashed here.
 * @param sig The signature, big-endian.
 * @returns `true` only when `sig` is `key`'s signature of `msg`.
 */
export const rsaVerifyPss = (key: RsaPublicKey, hash: i32, saltLen: i32, msg: u8[], sig: u8[]): boolean => {
  const hashSize: i32 = rsaHashSize(hash)
  const bits: i32 = rsaBitLength(key.n)
  // 8192 is RSA_MAX_BITS: a longer modulus is one the parser refuses.
  if (hashSize < 1 || hashSize > 64 || saltLen < 0 || bits < 2 || bits > 8192) {
    return false
  }
  const emBits: i32 = bits - 1
  const emLen: i32 = (emBits + 7) >> 3
  if (emLen < 1 || emLen > 1024 || saltLen > emLen || emLen < hashSize + saltLen + 2) {
    return false
  }
  const dbLength: i32 = emLen - hashSize - 1
  const opened: u8[] | null = rsaOpen(key, sig, emLen)
  if (opened === null) {
    return false
  }
  const em: u8[] = opened
  const emLength: i32 = toI32(em.length)
  if (emLength !== emLen) {
    return false
  }
  const full: i32 = 0xff
  const topMask: i32 = full >> (emLen * 8 - emBits)
  // EM is maskedDB, then H, then the trailer 0xbc; the leftmost bits of
  // maskedDB above emBits must be zero.
  const db: u8[] = []
  const h: u8[] = []
  let trailer: i32 = 0
  for (let i: i32 = 0; i < toI32(em.length); i++) {
    if (i < dbLength) {
      if (i === 0 && (toI32(em[i]) & ~topMask) !== 0) {
        return false
      }
      db.push(em[i])
    } else if (i < emLength - 1) {
      h.push(em[i])
    } else {
      trailer = toI32(em[i])
    }
  }
  if (trailer !== 0xbc) {
    return false
  }
  rsaMgf1Xor(hash, h, db)
  // DB is PS (zeros), 0x01, then the salt, which M' takes after the
  // message's digest.
  const zeros: i32 = emLen - hashSize - saltLen - 2
  const prime: u8[] = [0, 0, 0, 0, 0, 0, 0, 0]
  for (const byte of rsaDigest(hash, msg)) {
    prime.push(byte)
  }
  let separated: boolean = false
  for (let i: i32 = 0; i < toI32(db.length); i++) {
    let v: i32 = toI32(db[i])
    if (i === 0) {
      v = v & topMask
    }
    if (i < zeros) {
      if (v !== 0) {
        return false
      }
    } else if (i === zeros) {
      if (v !== 0x01) {
        return false
      }
      separated = true
    } else {
      prime.push(toU8(v))
    }
  }
  if (!separated) {
    return false
  }
  return timingSafeEqual(rsaDigest(hash, prime), h)
}

/**
 * Verifies an RSASSA-PSS signature under a public key given as its DER, as
 * `rsaVerifyPss` does after `rsaParsePublicKey`: for a caller that holds the
 * key's bytes and no `RsaPublicKey`.
 *
 * @param der The key as `rsaParsePublicKey` reads it, whole.
 * @param hash `RSA_HASH_SHA256`, `RSA_HASH_SHA384` or `RSA_HASH_SHA512`.
 * @param saltLen The salt's length in bytes.
 * @param msg The message signed, whole.
 * @param sig The signature, big-endian.
 * @returns `true` only when `der` parses and `sig` is its signature of `msg`.
 */
export const rsaVerifyPssDer = (der: u8[], hash: i32, saltLen: i32, msg: u8[], sig: u8[]): boolean => {
  const key: RsaPublicKey | null = rsaParsePublicKey(der)
  if (key === null) {
    return false
  }
  return rsaVerifyPss(key, hash, saltLen, msg, sig)
}
