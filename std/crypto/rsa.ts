/**
 * `nish/crypto/rsa` — RSA signature verification: RSASSA-PKCS1-v1_5 and
 * RSASSA-PSS (RFC 8017 §8.1 and §8.2) with SHA-256, SHA-384 or SHA-512.
 *
 *     import { RSA_HASH_SHA256, RsaPublicKey, rsaParsePublicKey, rsaVerifyPss } from "nish/crypto/rsa";
 *
 *     const key: RsaPublicKey | null = rsaParsePublicKey(der);   // PKCS#1 RSAPublicKey
 *     if (key !== null && rsaVerifyPss(key, RSA_HASH_SHA256, message, sig)) {
 *       // the holder of the private key signed `message`
 *     }
 *
 * This module verifies and does nothing else: it holds no private key, signs
 * nothing and decrypts nothing, so every value it touches is public — a key
 * someone sent, a message and a signature — and its arithmetic may branch and
 * take variable time. A TLS client checking a server's `CertificateVerify`, or
 * a certificate's signature, is what it is for.
 *
 * **What a key may be.** `rsaParsePublicKey` takes the DER `RSAPublicKey` of
 * RFC 8017 §A.1.1, `SEQUENCE { INTEGER n, INTEGER e }`, strictly: minimal
 * lengths, minimal positive integers, nothing after the sequence. The modulus
 * is 2048 to 8192 bits and odd; the exponent is odd, at least 3 and below
 * 2^32. The floor is NIST SP 800-131A's; the two ceilings bound what one
 * verification can cost, since the key comes from the peer: a modulus of 8192
 * bits and an exponent of 32 bits cost at most 64 multiplications of 256
 * limbs. BoringSSL holds the exponent to 33 bits and Go to 31 for the same
 * reason; 65537, which every certificate authority issues, is far inside both.
 *
 * **PKCS#1 v1.5 is checked by rebuilding, never by parsing.** The verifier
 * computes the one encoded message a signer would have produced, `00 01 FF…FF
 * 00 || DigestInfo || H`, and compares the whole block byte for byte. A
 * verifier that instead reads the block — finds the `00` after the padding,
 * parses the DigestInfo, takes the hash — has to get every one of its length
 * and garbage checks right, and the ones that did not (Bleichenbacher's 2006
 * e = 3 forgery, BERserk, and more since) accepted forged signatures. There is
 * no parser here to get wrong. A DigestInfo without the `NULL` parameters,
 * which RFC 8017 §9.2 note 2 says some verifiers accept, is refused: it is not
 * what this module would build.
 *
 * **PSS** is RFC 8017 §9.1.2 with MGF1 over the message hash and a salt the
 * length of that hash, which is what TLS 1.3 requires (RFC 8446 §4.2.3) and
 * what X.509 profiles mostly use. Every check of §9.1.2 is made: the trailing
 * `bc`, the zero top bits, the zero padding, the `01` separator and the final
 * hash.
 *
 * **The arithmetic** is Montgomery multiplication, the coarsely integrated
 * operand scanning form of Ç. K. Koç, T. Acar and B. S. Kaliski, "Analyzing
 * and Comparing Montgomery Multiplication Algorithms" (IEEE Micro, 1996), on
 * little-endian `u32` limbs with `u64` products, for any odd modulus. It is
 * exported as `RsaMont` because `nish/crypto/p384` does its field and scalar
 * arithmetic on it too; it is variable time, for public values only. Nothing
 * here is ported; it is written for this module from the documents it names.
 *
 * Private names carry the `rsa` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import { sha256 } from "nish/crypto/sha256"
import { sha384, sha512 } from "nish/crypto/sha512"
import { timingSafeEqual } from "nish/crypto/ct"

/** The hash a signature is over: SHA-256. */
export const RSA_HASH_SHA256: i32 = 1

/** The hash a signature is over: SHA-384. */
export const RSA_HASH_SHA384: i32 = 2

/** The hash a signature is over: SHA-512. */
export const RSA_HASH_SHA512: i32 = 3

/** The smallest modulus `rsaParsePublicKey` takes, in bits. */
export const RSA_MIN_BITS: i32 = 2048

/** The largest modulus `rsaParsePublicKey` takes, in bits. */
export const RSA_MAX_BITS: i32 = 8192

/** All eight bits of a byte, typed so that f64 mode keeps the shift in i32. */
const RSA_BYTE_MASK: i32 = 0xff

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const RSA_FROM: i32 = 0

// ---------------------------------------------------------------------------
// Limbs
// ---------------------------------------------------------------------------

/**
 * The integer in the big-endian bytes `bytes[off .. off + len)` as `k`
 * little-endian `u32` limbs. Bytes that do not fit in `k` limbs are dropped
 * from the top; every caller sizes `k` so that none do.
 */
export const rsaLimbsFromBytes = (bytes: u8[], off: i32, len: i32, k: i32): u32[] => {
  const out: u32[] = new Array<u32>(k)
  const total: i32 = toI32(bytes.length)
  for (let i: i32 = 0; i < len; i++) {
    const at: i32 = off + len - 1 - i
    const limb: i32 = i >> 2
    if (limb < toI32(out.length) && at >= 0 && at < total) {
      out[limb] = out[limb] | (toU32(bytes[at]) << toU32((i & 3) << 3))
    }
  }
  return out
}

/** The low `len` bytes of the limbs `a`, big-endian; limbs above them are not looked at. */
export const rsaLimbsToBytes = (a: u32[], len: i32): u8[] => {
  const out: u8[] = new Array<u8>(len)
  const k: i32 = toI32(a.length)
  for (let i: i32 = 0; i < len; i++) {
    const limb: i32 = i >> 2
    if (limb < k) {
      out[len - 1 - i] = toU8(a[limb] >> toU32((i & 3) << 3))
    }
  }
  return out
}

/** Whether `a < b`, both `k` limbs long. */
export const rsaLimbsBelow = (a: u32[], b: u32[], k: i32): boolean => {
  if (toI32(a.length) < k || toI32(b.length) < k) {
    return false
  }
  for (let i: i32 = k - 1; i >= 0; i--) {
    if (a[i] !== b[i]) {
      return a[i] < b[i]
    }
  }
  return false
}

/** Whether every one of the `k` limbs of `a` is zero. */
export const rsaLimbsIsZero = (a: u32[], k: i32): boolean => {
  if (toI32(a.length) < k) {
    return false
  }
  for (let i: i32 = 0; i < k; i++) {
    if (a[i] !== 0) {
      return false
    }
  }
  return true
}

/** `out = a - b` over `k` limbs, answering the borrow out of the top: 1 when `a < b`. */
const rsaLimbsSub = (out: u32[], a: u32[], b: u32[], k: i32): u32 => {
  let borrow: u64 = 0
  if (toI32(out.length) < k || toI32(a.length) < k || toI32(b.length) < k) {
    return toU32(borrow)
  }
  for (let i: i32 = 0; i < k; i++) {
    const d: u64 = toU64(a[i]) - toU64(b[i]) - borrow
    out[i] = toU32(d)
    borrow = (d >> 32) & 1
  }
  return toU32(borrow)
}

/** `out = a + b` over `k` limbs, answering the carry out of the top. */
const rsaLimbsAdd = (out: u32[], a: u32[], b: u32[], k: i32): u32 => {
  let carry: u64 = 0
  if (toI32(out.length) < k || toI32(a.length) < k || toI32(b.length) < k) {
    return toU32(carry)
  }
  for (let i: i32 = 0; i < k; i++) {
    const s: u64 = toU64(a[i]) + toU64(b[i]) + carry
    out[i] = toU32(s)
    carry = s >> 32
  }
  return toU32(carry)
}

/** The number of significant bits in the limbs of `a`: 0 for zero. */
const rsaLimbsBits = (a: u32[]): i32 => {
  for (let i: i32 = toI32(a.length) - 1; i >= 0; i--) {
    const limb: u32 = a[i]
    if (limb !== 0) {
      let bits: i32 = 0
      for (let v: u32 = limb; v !== 0; v = v >> 1) {
        bits = bits + 1
      }
      return 32 * i + bits
    }
  }
  return 0
}

// ---------------------------------------------------------------------------
// Montgomery arithmetic
// ---------------------------------------------------------------------------

/**
 * Arithmetic modulo one odd modulus `n` of `k` limbs, in the Montgomery
 * domain with R = 2^(32k): `mul` answers `a b R^-1 mod n`, so a value enters
 * the domain as `toMont(a) = a R mod n` and leaves it by `fromMont`. `add` and
 * `sub` are the same in either domain. Every input is a fully reduced value
 * below `n`, `k` limbs long, and every answer is one too; an output may be the
 * same array as an input.
 *
 * It is variable time — it branches on the final subtraction and on exponent
 * bits — and is for public values only: an RSA signature and key, and the
 * coordinates and scalars of an ECDSA verification.
 */
export class RsaMont {
  /** The modulus, `k` little-endian limbs. */
  n: u32[]
  k: i32
  /** `-n^-1 mod 2^32`, the factor that clears one limb per step. */
  n0inv: u32
  /** `R^2 mod n`, which `toMont` multiplies by. */
  r2: u32[]
  /** Scratch for `mul`'s running sum, `k + 2` limbs, kept so a multiply allocates nothing. */
  t: u32[]

  constructor(n: u32[], k: i32, n0inv: u32, r2: u32[]) {
    this.n = n
    this.k = k
    this.n0inv = n0inv
    this.r2 = r2
    this.t = new Array<u32>(k + 2)
  }

  /** `out = a b R^-1 mod n`, coarsely integrated operand scanning. */
  mul(out: u32[], a: u32[], b: u32[]): void {
    const k: i32 = this.k
    const n: u32[] = this.n
    const t: u32[] = this.t
    if (
      toI32(out.length) < k ||
      toI32(a.length) < k ||
      toI32(b.length) < k ||
      toI32(n.length) < k ||
      toI32(t.length) < k + 2 ||
      k < 1
    ) {
      return
    }
    for (let j: i32 = 0; j < toI32(t.length); j++) {
      t[j] = 0
    }
    for (let i: i32 = 0; i < k; i++) {
      // t += a * b[i]. Each step is below (2^32 - 1)^2 + 2 (2^32 - 1) = 2^64 - 1.
      const bi: u64 = toU64(b[i])
      let carry: u64 = 0
      for (let j: i32 = 0; j < k; j++) {
        const s: u64 = toU64(t[j]) + toU64(a[j]) * bi + carry
        t[j] = toU32(s)
        carry = s >> 32
      }
      const top: u64 = toU64(t[k]) + carry
      t[k] = toU32(top)
      t[k + 1] = toU32(top >> 32)
      // t += q n with q chosen to clear t[0], then shift down one limb.
      const q: u64 = toU64(t[0] * this.n0inv)
      carry = (toU64(t[0]) + q * toU64(n[0])) >> 32
      for (let j: i32 = 1; j < k; j++) {
        const s: u64 = toU64(t[j]) + q * toU64(n[j]) + carry
        t[j - 1] = toU32(s)
        carry = s >> 32
      }
      const last: u64 = toU64(t[k]) + carry
      t[k - 1] = toU32(last)
      t[k] = t[k + 1] + toU32(last >> 32)
    }
    // t is below 2n now; one subtraction brings it below n.
    if (t[k] !== 0 || !rsaLimbsBelow(t, n, k)) {
      rsaLimbsSub(out, t, n, k)
    } else {
      for (let j: i32 = 0; j < k; j++) {
        out[j] = t[j]
      }
    }
  }

  /** `out = a R mod n`: `a` into the Montgomery domain. */
  toMont(out: u32[], a: u32[]): void {
    this.mul(out, a, this.r2)
  }

  /** `out = a R^-1 mod n`: `a` out of the Montgomery domain. */
  fromMont(out: u32[], a: u32[]): void {
    const one: u32[] = new Array<u32>(this.k)
    one[0] = 1
    this.mul(out, a, one)
  }

  /** `out = a + b mod n`. */
  add(out: u32[], a: u32[], b: u32[]): void {
    const k: i32 = this.k
    const carry: u32 = rsaLimbsAdd(out, a, b, k)
    if (carry !== 0 || !rsaLimbsBelow(out, this.n, k)) {
      rsaLimbsSub(out, out, this.n, k)
    }
  }

  /** `out = a - b mod n`. */
  sub(out: u32[], a: u32[], b: u32[]): void {
    const k: i32 = this.k
    if (rsaLimbsSub(out, a, b, k) !== 0) {
      rsaLimbsAdd(out, out, this.n, k)
    }
  }

  /**
   * `out = base^exp` in the Montgomery domain, `base` in it too, by
   * left-to-right square and multiply over the bits of `exp` (little-endian
   * limbs of any length). An exponent of zero answers R mod n, the domain's 1.
   */
  pow(out: u32[], base: u32[], exp: u32[]): void {
    const k: i32 = this.k
    const acc: u32[] = new Array<u32>(k)
    const one: u32[] = new Array<u32>(k)
    one[0] = 1
    this.toMont(acc, one)
    // Squarings start at the first set bit, so leading zero limbs cost nothing.
    let started: boolean = false
    for (let w: i32 = toI32(exp.length) - 1; w >= 0; w--) {
      const word: u32 = exp[w]
      for (let b: i32 = 31; b >= 0; b--) {
        if (started) {
          this.mul(acc, acc, acc)
        }
        if (((word >> toU32(b)) & 1) !== 0) {
          this.mul(acc, acc, base)
          started = true
        }
      }
    }
    if (toI32(out.length) < k || toI32(acc.length) < k) {
      return
    }
    for (let j: i32 = 0; j < k; j++) {
      out[j] = acc[j]
    }
  }
}

/**
 * The Montgomery context for the odd modulus `n`, `k` limbs with a non-zero
 * top limb, or `null` for an even one, which has no inverse mod 2^32.
 */
export const rsaMontNew = (n: u32[], k: i32): RsaMont | null => {
  if (k < 1 || toI32(n.length) < k || (n[0] & 1) === 0 || n[k - 1] === 0) {
    return null
  }
  // Newton's iteration doubles the bits of n0^-1 mod 2^32 that are right;
  // n0 itself is its own inverse mod 8, so four steps reach 48.
  const n0: u32 = n[0]
  const two: u32 = 2
  const zero: u32 = 0
  let inverse: u32 = n0
  for (let i: i32 = 0; i < 4; i++) {
    inverse = inverse * (two - n0 * inverse)
  }
  const n0inv: u32 = zero - inverse
  // R^2 mod n by doubling 1 2 * 32k times, reducing as it goes: the
  // doubled value is below 2n, so one subtraction reduces it.
  const r2: u32[] = new Array<u32>(k)
  r2[0] = 1
  for (let i: i32 = 0; i < 64 * k; i++) {
    const carry: u32 = rsaLimbsAdd(r2, r2, r2, k)
    if (carry !== 0 || !rsaLimbsBelow(r2, n, k)) {
      rsaLimbsSub(r2, r2, n, k)
    }
  }
  const limbs: u32[] = new Array<u32>(k)
  for (let i: i32 = 0; i < k && i < toI32(limbs.length); i++) {
    limbs[i] = n[i]
  }
  return new RsaMont(limbs, k, n0inv, r2)
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/**
 * An RSA public key `(n, e)`. `size` is the modulus in bytes, which is the
 * length of every signature under it, and `bits` its exact bit length, which
 * PSS needs.
 */
export class RsaPublicKey {
  mont: RsaMont
  e: u32
  bits: i32
  size: i32

  constructor(mont: RsaMont, e: u32, bits: i32, size: i32) {
    this.mont = mont
    this.e = e
    this.bits = bits
    this.size = size
  }
}

/** Where one DER element's contents are: `bytes[start .. end)`. */
class RsaDerSpan {
  start: i32
  end: i32

  constructor(start: i32, end: i32) {
    this.start = start
    this.end = end
  }
}

/**
 * The element at `der[at]`, which must have identifier `tag` and lie inside
 * `der[at .. limit)`, or `null`. Lengths are DER's (X.690 §10.1): the short
 * form below 128, and the long form only above it with no leading zero
 * octet. Two length octets are the most it takes, which covers an 8192-bit
 * modulus with room to spare.
 */
const rsaDerExpect = (der: u8[], at: i32, limit: i32, tag: i32): RsaDerSpan | null => {
  if (at < 0 || at + 2 > limit || limit > toI32(der.length) || toI32(der[at]) !== tag) {
    return null
  }
  const first: i32 = toI32(der[at + 1])
  let start: i32 = at + 2
  let length: i32 = first
  if (first === 0x81) {
    if (start + 1 > limit) {
      return null
    }
    length = toI32(der[start])
    start = start + 1
    if (length < 0x80) {
      return null
    }
  } else if (first === 0x82) {
    if (start + 2 > limit) {
      return null
    }
    length = (toI32(der[start]) << 8) | toI32(der[start + 1])
    start = start + 2
    if (length < 0x100) {
      return null
    }
  } else if (first >= 0x80) {
    return null
  }
  if (length > limit - start) {
    return null
  }
  return new RsaDerSpan(start, start + length)
}

/**
 * The magnitude of a DER INTEGER's contents: the span without its one
 * permitted leading zero, or `null` unless the integer is positive and
 * minimally encoded (X.690 §8.3.2).
 */
const rsaDerPositive = (der: u8[], span: RsaDerSpan): RsaDerSpan | null => {
  if (span.end <= span.start) {
    return null
  }
  const lead: i32 = toI32(der[span.start])
  if (lead >= 0x80) {
    return null
  }
  if (lead === 0) {
    if (span.end - span.start < 2 || toI32(der[span.start + 1]) < 0x80) {
      return null
    }
    return new RsaDerSpan(span.start + 1, span.end)
  }
  return span
}

/**
 * The key in a DER `RSAPublicKey` (RFC 8017 §A.1.1), or `null` unless the
 * bytes are exactly one, strictly encoded, with a modulus of 2048 to 8192 bits
 * that is odd and an exponent that is odd, at least 3 and below 2^32. A
 * SubjectPublicKeyInfo is not this: its BIT STRING holds one.
 */
export const rsaParsePublicKey = (rsaPublicKeyDer: u8[]): RsaPublicKey | null => {
  const der: u8[] = rsaPublicKeyDer
  const total: i32 = toI32(der.length)
  const seq: RsaDerSpan | null = rsaDerExpect(der, RSA_FROM, total, 0x30)
  if (seq === null || seq.end !== total) {
    return null
  }
  const nElement: RsaDerSpan | null = rsaDerExpect(der, seq.start, seq.end, 0x02)
  if (nElement === null) {
    return null
  }
  const eElement: RsaDerSpan | null = rsaDerExpect(der, nElement.end, seq.end, 0x02)
  if (eElement === null || eElement.end !== seq.end) {
    return null
  }
  const nSpan: RsaDerSpan | null = rsaDerPositive(der, nElement)
  const eSpan: RsaDerSpan | null = rsaDerPositive(der, eElement)
  if (nSpan === null || eSpan === null) {
    return null
  }
  const size: i32 = nSpan.end - nSpan.start
  if (size < RSA_MIN_BITS / 8 || size > RSA_MAX_BITS / 8) {
    return null
  }
  const k: i32 = (size + 3) >> 2
  const n: u32[] = rsaLimbsFromBytes(der, nSpan.start, size, k)
  const bits: i32 = rsaLimbsBits(n)
  if (bits < RSA_MIN_BITS || bits > RSA_MAX_BITS) {
    return null
  }
  const eLength: i32 = eSpan.end - eSpan.start
  if (eLength > 4) {
    return null
  }
  let e: u32 = 0
  for (let i: i32 = eSpan.start; i < eSpan.end; i++) {
    if (i >= 0 && i < toI32(der.length)) {
      e = (e << 8) | toU32(der[i])
    }
  }
  if (e < 3 || (e & 1) === 0) {
    return null
  }
  const mont: RsaMont | null = rsaMontNew(n, k)
  if (mont === null) {
    return null
  }
  return new RsaPublicKey(mont, e, bits, size)
}

/**
 * RSAVP1 (RFC 8017 §5.2.2) and I2OSP: `sig^e mod n` as `key.size` big-endian
 * bytes, or `null` when `sig` is not exactly `key.size` bytes or is not below
 * `n`. Both refusals are the specification's: §8.1.2 and §8.2.2 step 1 check
 * the length, and §5.2.2 step 1 the range.
 */
const rsaPublicOp = (key: RsaPublicKey, sig: u8[]): u8[] | null => {
  if (toI32(sig.length) !== key.size) {
    return null
  }
  const m: RsaMont = key.mont
  const s: u32[] = rsaLimbsFromBytes(sig, RSA_FROM, key.size, m.k)
  if (!rsaLimbsBelow(s, m.n, m.k)) {
    return null
  }
  const base: u32[] = new Array<u32>(m.k)
  m.toMont(base, s)
  const exp: u32[] = [key.e]
  const power: u32[] = new Array<u32>(m.k)
  m.pow(power, base, exp)
  m.fromMont(power, power)
  return rsaLimbsToBytes(power, key.size)
}

// ---------------------------------------------------------------------------
// Hashes
// ---------------------------------------------------------------------------

/** The digest length of `hash` in bytes, or 0 for a hash this module does not know. */
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

/** `data` hashed by `hash`, which the caller has checked with `rsaHashSize`. */
const rsaHash = (hash: i32, data: u8[]): u8[] => {
  if (hash === RSA_HASH_SHA384) {
    return sha384(data)
  }
  if (hash === RSA_HASH_SHA512) {
    return sha512(data)
  }
  return sha256(data)
}

/**
 * The DER `DigestInfo` header that goes in front of the hash: `SEQUENCE {
 * SEQUENCE { OID, NULL }, OCTET STRING }`, as RFC 8017 §9.2 note 1 spells it
 * for each hash, the `NULL` parameters included.
 */
const rsaDigestInfoPrefix = (hash: i32): u8[] => {
  if (hash === RSA_HASH_SHA384) {
    return [
      0x30, 0x41, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x02, 0x05, 0x00,
      0x04, 0x30,
    ]
  }
  if (hash === RSA_HASH_SHA512) {
    return [
      0x30, 0x51, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x03, 0x05, 0x00,
      0x04, 0x40,
    ]
  }
  return [
    0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00,
    0x04, 0x20,
  ]
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Whether `sig` is a valid RSASSA-PKCS1-v1_5 signature of `msg` under `key`
 * with `hash` (RFC 8017 §8.2.2). The encoded message EMSA-PKCS1-v1_5 would
 * produce for `msg` (§9.2) is built in full and compared with the recovered
 * one, all `key.size` bytes of it; nothing in the recovered block is read. A
 * hash this module does not know answers `false`.
 */
export const rsaVerifyPkcs1v15 = (key: RsaPublicKey, hash: i32, msg: u8[], sig: u8[]): boolean => {
  const hashSize: i32 = rsaHashSize(hash)
  if (hashSize === 0) {
    return false
  }
  const em: u8[] | null = rsaPublicOp(key, sig)
  if (em === null) {
    return false
  }
  const prefix: u8[] = rsaDigestInfoPrefix(hash)
  const digest: u8[] = rsaHash(hash, msg)
  const size: i32 = key.size
  const tLen: i32 = toI32(prefix.length) + hashSize
  // §9.2 step 3: at least eight bytes of FF padding. A 2048-bit modulus
  // leaves far more than that for any of the three hashes.
  if (size < tLen + 11) {
    return false
  }
  const expected: u8[] = new Array<u8>(size)
  expected[1] = 0x01
  const separator: i32 = size - tLen - 1
  for (let i: i32 = 2; i < separator && i < toI32(expected.length); i++) {
    expected[i] = 0xff
  }
  for (let i: i32 = 0; i < toI32(prefix.length); i++) {
    expected[separator + 1 + i] = prefix[i]
  }
  for (let i: i32 = 0; i < toI32(digest.length); i++) {
    expected[size - hashSize + i] = digest[i]
  }
  return timingSafeEqual(em, expected)
}

/**
 * MGF1 (RFC 8017 §B.2.1) over `hash`: `len` bytes of `Hash(seed || C)` for
 * the counter C = 0, 1, 2, … as four big-endian bytes.
 */
const rsaMgf1 = (hash: i32, seed: u8[], len: i32): u8[] => {
  const hashSize: i32 = rsaHashSize(hash)
  const seedLength: i32 = toI32(seed.length)
  const out: u8[] = new Array<u8>(len)
  const block: u8[] = new Array<u8>(seedLength + 4)
  let counter: i32 = 0
  for (let done: i32 = 0; done < len; done = done + hashSize) {
    // The whole block is rewritten each round: the seed, then the counter
    // with its most significant byte first.
    for (let i: i32 = 0; i < toI32(block.length); i++) {
      if (i < seedLength) {
        block[i] = seed[i]
      } else {
        block[i] = toU8(counter >> ((seedLength + 3 - i) << 3))
      }
    }
    const chunk: u8[] = rsaHash(hash, block)
    for (let i: i32 = 0; i < toI32(chunk.length) && done + i < len; i++) {
      out[done + i] = chunk[i]
    }
    counter = counter + 1
  }
  return out
}

/**
 * Whether `sig` is a valid RSASSA-PSS signature of `msg` under `key` (RFC 8017
 * §8.1.2 and §9.1.2), with `hash` for the message, for MGF1 and for the final
 * hash, and a salt exactly as long as the hash. A hash this module does not
 * know answers `false`.
 */
export const rsaVerifyPss = (key: RsaPublicKey, hash: i32, msg: u8[], sig: u8[]): boolean => {
  const hLen: i32 = rsaHashSize(hash)
  if (hLen === 0) {
    return false
  }
  const block: u8[] | null = rsaPublicOp(key, sig)
  if (block === null) {
    return false
  }
  // §8.1.2 step 2c: EM is emLen = ceil((modBits - 1) / 8) bytes, one fewer
  // than the modulus when modBits - 1 is a multiple of 8; the byte that
  // drops must then be zero, or the integer does not fit.
  const emBits: i32 = key.bits - 1
  const emLen: i32 = (emBits + 7) >> 3
  const skip: i32 = key.size - emLen
  for (let i: i32 = 0; i < skip; i++) {
    if (toI32(block[i]) !== 0) {
      return false
    }
  }
  const sLen: i32 = hLen
  // §9.1.2 steps 3 and 4.
  if (emLen < hLen + sLen + 2 || toI32(block[skip + emLen - 1]) !== 0xbc) {
    return false
  }
  const dbLen: i32 = emLen - hLen - 1
  const h: u8[] = new Array<u8>(hLen)
  for (let i: i32 = 0; i < toI32(h.length); i++) {
    h[i] = block[skip + dbLen + i]
  }
  // Step 6: the leftmost 8 emLen - emBits bits of maskedDB are zero.
  const topMask: i32 = RSA_BYTE_MASK >> ((emLen << 3) - emBits)
  if ((toI32(block[skip]) & ~topMask) !== 0) {
    return false
  }
  // Steps 7 to 9.
  const db: u8[] = rsaMgf1(hash, h, dbLen)
  for (let i: i32 = 0; i < toI32(db.length); i++) {
    db[i] = db[i] ^ block[skip + i]
  }
  db[0] = toU8(toI32(db[0]) & topMask)
  // Step 10: zeros, then 01, then the salt.
  const separator: i32 = dbLen - sLen - 1
  for (let i: i32 = 0; i < separator && i < toI32(db.length); i++) {
    if (toI32(db[i]) !== 0) {
      return false
    }
  }
  if (toI32(db[separator]) !== 1) {
    return false
  }
  // Steps 12 and 13: M' = 00 × 8 || mHash || salt, and its hash.
  const mHash: u8[] = rsaHash(hash, msg)
  const mPrime: u8[] = new Array<u8>(8 + hLen + sLen)
  for (let i: i32 = 0; i < toI32(mHash.length); i++) {
    const at: i32 = 8 + i
    if (at < toI32(mPrime.length)) {
      mPrime[at] = mHash[i]
    }
  }
  for (let i: i32 = 0; i < sLen; i++) {
    mPrime[8 + hLen + i] = db[dbLen - sLen + i]
  }
  return timingSafeEqual(rsaHash(hash, mPrime), h)
}
