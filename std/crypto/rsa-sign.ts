/**
 * `nish/crypto/rsa-sign` — RSASSA-PSS signing with SHA-256 (RFC 8017 §8.1.1,
 * the TLS 1.3 scheme `rsa_pss_rsae_sha256`) under an RSA private key of 2048
 * to 4096 bits held as a `Secret`, in constant-time arithmetic.
 *
 *     import { rsaParsePrivateKey, rsaSignPssSha256 } from "nish/crypto/rsa-sign";
 *     import { Secret, wipe } from "nish:secret";
 *
 *     // der: a PKCS#1 RSAPrivateKey, which the caller wipes
 *     const signOnce = (der: u8[], message: u8[]): u8[] | null => {
 *       const key: Secret<u8[]> | null = rsaParsePrivateKey(der, 0, toI32(der.length));
 *       if (key === null) {
 *         return null;
 *       }
 *       const signature: u8[] | null = rsaSignPssSha256(key, message);
 *       wipe(key);
 *       return signature;
 *     };
 *
 * **Native only** for `rsaSignPssSha256` and `rsaSignPssSha256Into`, which draw
 * their salt from `crypto.getRandomValues`; the parse, `rsaSignRaw` and the
 * salted `rsaSignPssSha256Salted` reach no randomness.
 *
 * **The key** is PKCS#1's `RSAPrivateKey` (RFC 8017 §A.1.2), version 0 (two
 * primes), read strictly: definite lengths in their shortest form, every
 * INTEGER positive and minimal, nothing after the last. The modulus is odd and
 * `RSA_SIGN_MIN_BITS` to `RSA_SIGN_MAX_BITS` bits, the public exponent odd, at
 * least 3 and below 2^32, and the private exponent nonzero and below the
 * modulus. The key is then tried: 2 is signed and the signature raised to the
 * public exponent must give 2 back, so a private exponent that does not belong
 * to the modulus is refused at load, not at the first handshake. The CRT
 * values (`p`, `q`, `dP`, `dQ`, `qInv`) are parsed for their form and not
 * kept: signing does not use them (below). The `Secret` holds the modulus,
 * the private exponent and the public exponent, each as many big-endian bytes
 * as the modulus has (`k`), in that order: `3 k` bytes.
 *
 * **Constant time.** The private exponent is applied in a fixed 4-bit window
 * over all `2 k` of its nibbles, leading zeros included: four Montgomery
 * squarings, a read of the whole 16-entry table that keeps one entry under an
 * `ctEq` mask, and one Montgomery multiplication, for every nibble. The
 * Montgomery multiplication (CIOS, as in `nish/crypto/rsa`) ends in a
 * subtraction whose result is kept or dropped by `ctSelect`, never a branch.
 * So the sequence of operations and the addresses read depend on the modulus's
 * length alone. The modulus, the message and the public exponent are public,
 * and the code that touches only them (R^2 mod n, the check after signing)
 * may branch on them.
 *
 * **No CRT, no blinding.** Signing is one exponentiation by `d` modulo `n`,
 * about four times the work of the CRT form, so no secret prime is ever a
 * modulus and the Bellcore fault (one faulty half-exponentiation factors `n`)
 * has nothing to strike. Every signature is still raised to `e` and compared
 * with the encoded message before it is returned, and one that does not
 * match answers `null`. The exponent is not blinded; the fixed window is the
 * defence against timing (RSA-S2 in docs/security/crypto-rsa.md).
 *
 * **Wiping.** Every limb array the exponentiation computes in, the window
 * table and the product, is wiped before the exposing function returns, and
 * the parse builds the `Secret` straight from the DER without a copy that
 * outlives it. The DER itself is the caller's to wipe.
 *
 * Private names carry the `rsaSign` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */

import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"
import { hmacCopySha256 } from "nish/crypto/hmac"
import { Sha256 } from "nish/crypto/sha256"

/** The fewest modulus bits a signing key may have. */
export const RSA_SIGN_MIN_BITS: i32 = 2048

/** The most modulus bits a signing key may have. */
export const RSA_SIGN_MAX_BITS: i32 = 4096

/** The salt length, in bytes, that `rsa_pss_rsae_sha256` requires: SHA-256's output. */
export const RSA_PSS_SHA256_SALT_SIZE: i32 = 32

/** The bytes of a DER element's contents: `der[start .. end)`. */
class RsaSignSpan {
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
 * otherwise. Lengths of more than two octets are refused: a 4096-bit key's
 * DER is under 2.5 kilobytes.
 */
const rsaSignDer = (der: u8[], at: i32, end: i32, tag: i32): RsaSignSpan | null => {
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
  return new RsaSignSpan(start, toI32(toI64(start) + toI64(length)))
}

/**
 * The magnitude of the INTEGER at `der[at]` before `end`, as the span of its
 * bytes with the sign octet dropped, and the element's end in `next`; `null`
 * for another tag, an empty, negative or non-minimal INTEGER, or zero.
 */
const rsaSignInteger = (der: u8[], at: i32, end: i32): RsaSignSpan | null => {
  const e: RsaSignSpan | null = rsaSignDer(der, at, end, 0x02)
  if (e === null || e.start >= e.end || e.start >= toI32(der.length) || toI32(der[e.start]) >= 0x80) {
    return null
  }
  if (toI32(der[e.start]) !== 0) {
    return e
  }
  const from: i32 = e.start + 1
  if (from >= e.end || from >= toI32(der.length) || toI32(der[from]) < 0x80) {
    return null
  }
  return new RsaSignSpan(from, e.end)
}

/** One past the INTEGER element whose magnitude is `span`: the element ends where its contents do. */
const rsaSignAfter = (span: RsaSignSpan): i32 => span.end

/**
 * The significant bits of the big-endian magnitude `der[start .. end)`, whose
 * first byte is nonzero.
 */
const rsaSignBits = (der: u8[], start: i32, end: i32): i32 => {
  if (start < 0 || start >= end || start >= toI32(der.length)) {
    return 0
  }
  const top: i32 = toI32(der[start])
  let topBits: i32 = 0
  for (let b: i32 = 0; b < 8; b++) {
    if (top >> b !== 0) {
      topBits = b + 1
    }
  }
  return (end - start - 1) * 8 + topBits
}

/**
 * The `3 k` key bytes: `n`, `d` and `e`, each right-aligned in `k` bytes, out
 * of the spans the parse found. The spans are known to fit `k`.
 */
const rsaSignKeyBytes = (der: u8[], k: i32, n: RsaSignSpan, d: RsaSignSpan, e: RsaSignSpan): u8[] => {
  const out: u8[] = new Array<u8>(3 * k)
  rsaSignPlace(out, 0, k, der, n)
  rsaSignPlace(out, k, k, der, d)
  rsaSignPlace(out, 2 * k, k, der, e)
  return out
}

/** Copies the bytes of `span` into the last of the `width` bytes of `out` at `at`. */
const rsaSignPlace = (out: u8[], at: i32, width: i32, der: u8[], span: RsaSignSpan): void => {
  const length: i32 = span.end - span.start
  const to: i32 = at + width - length
  for (let i: i32 = 0; i < length; i++) {
    out[to + i] = der[span.start + i]
  }
}

/**
 * Reads the DER of a PKCS#1 `RSAPrivateKey` (RFC 8017 §A.1.2) filling
 * `der[start .. end)`, and tries it once. Answers `null` for anything but
 * version 0 and its nine positive, minimal INTEGERs with definite, minimal
 * lengths and nothing after them; for a modulus that is even or outside
 * `RSA_SIGN_MIN_BITS` to `RSA_SIGN_MAX_BITS` bits; for a public exponent that is
 * even, below 3 or not below 2^32; for a private exponent of zero or not below
 * the modulus; and for a private exponent that does not undo the public one
 * (2 signed and opened again is not 2). `der` is not changed and not kept: the
 * caller wipes it.
 *
 * @param der The array holding the key's DER.
 * @param start The index of the key's SEQUENCE tag.
 * @param end One past the key's last byte.
 * @returns The key as a fresh `Secret` the caller wipes, or `null`.
 */
export const rsaParsePrivateKey = (der: u8[], start: i32, end: i32): Secret<u8[]> | null => {
  const seq: RsaSignSpan | null = rsaSignDer(der, start, end, 0x30)
  if (seq === null || seq.end !== end) {
    return null
  }
  const version: RsaSignSpan | null = rsaSignDer(der, seq.start, seq.end, 0x02)
  if (version === null || version.end !== version.start + 1 || toI32(der[version.start]) !== 0) {
    return null
  }
  const n: RsaSignSpan | null = rsaSignInteger(der, version.end, seq.end)
  if (n === null) {
    return null
  }
  const e: RsaSignSpan | null = rsaSignInteger(der, rsaSignAfter(n), seq.end)
  if (e === null) {
    return null
  }
  const d: RsaSignSpan | null = rsaSignInteger(der, rsaSignAfter(e), seq.end)
  if (d === null) {
    return null
  }
  // p, q, dP, dQ and qInv: read for their form, not kept.
  let at: i32 = rsaSignAfter(d)
  for (let i: i32 = 0; i < 5; i++) {
    const v: RsaSignSpan | null = rsaSignInteger(der, at, seq.end)
    if (v === null) {
      return null
    }
    at = rsaSignAfter(v)
  }
  if (at !== seq.end) {
    return null
  }
  const bits: i32 = rsaSignBits(der, n.start, n.end)
  const k: i32 = n.end - n.start
  const eBits: i32 = rsaSignBits(der, e.start, e.end)
  if (
    bits < RSA_SIGN_MIN_BITS ||
    bits > RSA_SIGN_MAX_BITS ||
    (toI32(der[n.end - 1]) & 1) === 0 ||
    eBits < 2 ||
    eBits > 32 ||
    (toI32(der[e.end - 1]) & 1) === 0 ||
    d.end - d.start > k
  ) {
    return null
  }
  const key: Secret<u8[]> = secret(rsaSignKeyBytes(der, k, n, d, e))
  if (!expose(key, rsaSignKeySound)) {
    wipe(key)
    return null
  }
  return key
}

/**
 * The modulus bits of a key from `rsaParsePrivateKey`, or 0 for a `Secret`
 * that is not one (its length is not `3 k` for a `k` of 256 to 512).
 *
 * @param priv The key.
 * @returns The modulus's bit length, which is public.
 */
export const rsaPrivateKeyBits = (priv: Secret<u8[]>): i32 => expose(priv, rsaSignKeyBits)

/**
 * The modulus of a key from `rsaParsePrivateKey`, as `k` big-endian bytes, to
 * hold against a certificate's public key; empty for a `Secret` that is not
 * one.
 *
 * @param priv The key.
 * @returns A fresh copy of the modulus, which is public.
 */
export const rsaPrivateKeyModulus = (priv: Secret<u8[]>): u8[] => expose(priv, rsaSignKeyModulus)

/**
 * The public exponent of a key from `rsaParsePrivateKey`, as `k` big-endian
 * bytes with leading zeros; empty for a `Secret` that is not one.
 *
 * @param priv The key.
 * @returns A fresh copy of the public exponent.
 */
export const rsaPrivateKeyExponent = (priv: Secret<u8[]>): u8[] => expose(priv, rsaSignKeyExponent)

/**
 * RSASP1 (RFC 8017 §5.2.1) alone: `m^d mod n` for the `k`-byte big-endian
 * `m`, as `k` bytes, with no padding scheme around it. It is a primitive for
 * known-answer tests and for a caller that encodes its own message; signing a
 * value an attacker chose with it is a decryption oracle. `null` for an `m`
 * that is not exactly `k` bytes or not below `n`, a `Secret` that is not a key
 * from `rsaParsePrivateKey`, and a result that fails the check against `e`.
 *
 * @param priv The key, borrowed.
 * @param m The message representative, `k` bytes.
 * @returns The signature representative, `k` bytes, or `null`.
 */
export const rsaSignRaw = (priv: Secret<u8[]>, m: u8[]): u8[] | null => exposeWith(priv, m, rsaSignPrivateOp)

/**
 * The hashers `rsaSignPssSha256Into` hashes with, made once and reused, so a
 * signature allocates nothing that outlives it: a `Sha256` keeps arrays in its
 * fields, and one made per hash inside the signer's arena would be stored
 * there. A carrier keeps one scratch, not one per connection: signing is
 * synchronous.
 */
export class RsaSignScratch {
  /** A hasher nothing is fed, which `work` is reset from. */
  private fresh: Sha256
  /** The hasher every digest is computed in. */
  private work: Sha256

  /** Makes the two hashers. */
  constructor() {
    this.fresh = new Sha256()
    this.work = new Sha256()
  }

  /**
   * The SHA-256 digest of `data[off .. off + len)`, then of the four bytes of
   * `counter` when `counter` is not negative (MGF1's `C`), written at
   * `out[at]`.
   *
   * @param data The array holding the input.
   * @param off The input's first index.
   * @param len The input's length.
   * @param counter MGF1's block counter, or -1 for none.
   * @param out The array the digest is written into.
   * @param at The index of the digest's first byte.
   * @returns Whether `out` had room for the digest.
   */
  hashInto(data: u8[], off: i32, len: i32, counter: i32, out: u8[], at: i32): boolean {
    hmacCopySha256(this.fresh, this.work)
    this.work.update(data, off, len)
    if (counter >= 0) {
      const c: u8[] = [toU8(counter >> 24), toU8(counter >> 16), toU8(counter >> 8), toU8(counter)]
      this.work.update(c, 0, 4)
    }
    return this.work.digestInto(out, at)
  }
}

/**
 * RSASSA-PSS-SIGN (RFC 8017 §8.1.1) with SHA-256, MGF1-SHA-256 and the salt
 * given, which makes the signature deterministic: for known-answer tests. A
 * salt of any length up to `emLen - 34` bytes is taken; TLS's
 * `rsa_pss_rsae_sha256` wants `RSA_PSS_SHA256_SALT_SIZE` fresh random bytes,
 * which `rsaSignPssSha256` draws. `null` for a salt too long for the key, a
 * `Secret` that is not a key from `rsaParsePrivateKey`, and a signature that
 * fails the check against `e`.
 *
 * @param priv The key, borrowed.
 * @param msg The message, hashed here.
 * @param salt The salt.
 * @returns The `k`-byte signature, or `null`.
 */
export const rsaSignPssSha256Salted = (priv: Secret<u8[]>, msg: u8[], salt: u8[]): u8[] | null => {
  const bits: i32 = rsaPrivateKeyBits(priv)
  if (bits === 0) {
    return null
  }
  const em: u8[] | null = rsaSignPssEncode(new RsaSignScratch(), msg, 0, toI32(msg.length), salt, bits)
  if (em === null) {
    return null
  }
  return exposeWith(priv, em, rsaSignPrivateOp)
}

/**
 * RSASSA-PSS-SIGN (RFC 8017 §8.1.1) with SHA-256, MGF1-SHA-256 and a fresh
 * 32-byte salt from `crypto.getRandomValues`: TLS 1.3's
 * `rsa_pss_rsae_sha256`. Native only. `null` for a `Secret` that is not a key
 * from `rsaParsePrivateKey` and a signature that fails the check against `e`.
 *
 * @param priv The key, borrowed.
 * @param msg The message, hashed here.
 * @returns The `k`-byte signature, or `null`.
 */
export const rsaSignPssSha256 = (priv: Secret<u8[]>, msg: u8[]): u8[] | null => {
  const salt: u8[] = new Array<u8>(RSA_PSS_SHA256_SALT_SIZE)
  crypto.getRandomValues(salt)
  return rsaSignPssSha256Salted(priv, msg, salt)
}

/**
 * `rsaSignPssSha256` over `msg[off .. off + len)`, writing the `k`-byte
 * signature at `out[at]`, hashing in `sc` and releasing every allocation of
 * its own before it returns: for a server whose memory may not grow per
 * handshake. Native only. Panics when either window is outside its array
 * (`k` is `rsaPrivateKeyBits(priv)` rounded up to bytes); answers `false`,
 * leaving `out` as it was, for a `Secret` that is not a key and a signature
 * that fails the check against `e`.
 *
 * @param sc The hashers, made once by the caller.
 * @param priv The key, borrowed.
 * @param msg The array holding the message.
 * @param off The message's first index.
 * @param len The message's length.
 * @param out The array the signature is written into.
 * @param at The index of the signature's first byte.
 * @returns Whether a signature was written.
 */
export const rsaSignPssSha256Into = (
  sc: RsaSignScratch,
  priv: Secret<u8[]>,
  msg: u8[],
  off: i32,
  len: i32,
  out: u8[],
  at: i32
): boolean => {
  const bits: i32 = rsaPrivateKeyBits(priv)
  const k: i32 = toI32((bits + 7) / 8)
  if (off < 0 || len < 0 || off > toI32(msg.length) - len) {
    panic("rsaSignPssSha256Into: the message window is outside its array")
  }
  if (at < 0 || at > toI32(out.length) - k) {
    panic("rsaSignPssSha256Into: the signature window is outside its array")
  }
  if (bits === 0) {
    return false
  }
  using _scope = arena()
  const salt: u8[] = new Array<u8>(RSA_PSS_SHA256_SALT_SIZE)
  crypto.getRandomValues(salt)
  const em: u8[] | null = rsaSignPssEncode(sc, msg, off, len, salt, bits)
  if (em === null) {
    return false
  }
  const signature: u8[] | null = exposeWith(priv, em, rsaSignPrivateOp)
  if (signature === null || toI32(signature.length) !== k) {
    return false
  }
  for (let i: i32 = 0; i < k; i++) {
    out[at + i] = signature[i]
  }
  return true
}

// ---------------------------------------------------------------------------
// EMSA-PSS (RFC 8017 §9.1.1) and MGF1 (§B.2.1)
// ---------------------------------------------------------------------------

/**
 * EMSA-PSS-ENCODE of `msg[off .. off + len)` with `salt`, for a modulus of
 * `bits` bits (emBits = bits - 1), hashing in `sc`, returned as `k` bytes:
 * the `emLen`-byte EM, behind a zero byte when `emLen` is `k - 1`. `null`
 * when the salt does not fit (emLen < 32 + sLen + 2). The window is the
 * caller's to have checked.
 */
const rsaSignPssEncode = (
  sc: RsaSignScratch,
  msg: u8[],
  off: i32,
  len: i32,
  salt: u8[],
  bits: i32
): u8[] | null => {
  const k: i32 = toI32((bits + 7) / 8)
  const emBits: i32 = bits - 1
  const emLen: i32 = toI32((emBits + 7) / 8)
  const sLen: i32 = toI32(salt.length)
  if (sLen > emLen - 34) {
    return null
  }
  // M' = 00 x 8 || mHash || salt, and H = Hash(M').
  const prime: u8[] = new Array<u8>(8 + 32 + sLen)
  if (!sc.hashInto(msg, off, len, -1, prime, 8)) {
    return null
  }
  for (let i: i32 = 0; i < sLen; i++) {
    prime[40 + i] = salt[i]
  }
  const out: u8[] = new Array<u8>(k)
  const from: i32 = k - emLen
  const dbLen: i32 = emLen - 33
  if (!sc.hashInto(prime, 0, toI32(prime.length), -1, out, from + dbLen)) {
    return null
  }
  // DB = PS || 01 || salt, masked by MGF1(H): the mask is XORed into `out`
  // first, a block at a time, and DB after it.
  const block: u8[] = new Array<u8>(32)
  let counter: i32 = 0
  for (let done: i32 = 0; done < dbLen; done = done + 32) {
    if (!sc.hashInto(out, from + dbLen, 32, counter, block, 0)) {
      return null
    }
    for (let i: i32 = 0; i < 32 && done + i < dbLen; i++) {
      out[from + done + i] = block[i]
    }
    counter = counter + 1
  }
  const one: i32 = from + dbLen - sLen - 1
  out[one] = out[one] ^ 1
  for (let i: i32 = 0; i < sLen; i++) {
    out[one + 1 + i] = out[one + 1 + i] ^ salt[i]
  }
  // Clear the leftmost 8 emLen - emBits bits.
  out[from] = toU8(toI32(out[from]) & (0xff >> (8 * emLen - emBits)))
  out[k - 1] = 0xbc
  return out
}

// ---------------------------------------------------------------------------
// The key's shape
// ---------------------------------------------------------------------------

/** `k` for a key value of `3 k` bytes with `k` 256 to 512, else 0. */
const rsaSignKeySize = (key: u8[]): i32 => {
  const total: i32 = toI32(key.length)
  const k: i32 = toI32(total / 3)
  if (k * 3 !== total || k < 256 || k > 512) {
    return 0
  }
  return k
}

/** The modulus bits of the key value, or 0 for one of the wrong shape or a leading zero byte. */
const rsaSignKeyBits = (key: u8[]): i32 => {
  const k: i32 = rsaSignKeySize(key)
  if (k === 0 || toI32(key[0]) === 0) {
    return 0
  }
  const bits: i32 = rsaSignBits(key, 0, k)
  if (bits < RSA_SIGN_MIN_BITS || bits > RSA_SIGN_MAX_BITS) {
    return 0
  }
  return bits
}

/** A copy of the key's first `k` bytes, `n`. */
const rsaSignKeyModulus = (key: u8[]): u8[] => {
  const k: i32 = rsaSignKeySize(key)
  return key.filter((_b: u8, i: number): boolean => toI32(i) < k)
}

/** A copy of the key's last `k` bytes, `e`. */
const rsaSignKeyExponent = (key: u8[]): u8[] => {
  const k: i32 = rsaSignKeySize(key)
  if (k === 0) {
    return []
  }
  return key.filter((_b: u8, i: number): boolean => toI32(i) >= 2 * k)
}

/**
 * Whether the parsed key value holds together: `d` below `n` (compared over
 * all `k` bytes, without an early exit) and RSASP1 of 2 opening to 2 under
 * `e`, which `rsaSignPrivateOp`'s own check does.
 */
const rsaSignKeySound = (key: u8[]): boolean => {
  const k: i32 = rsaSignKeySize(key)
  if (k === 0 || rsaSignKeyBits(key) === 0) {
    return false
  }
  // d - n, borrow out of the top: set when d < n.
  let borrow: i32 = 0
  for (let i: i32 = k - 1; i >= 0; i--) {
    const diff: i32 = toI32(key[k + i]) - toI32(key[i]) - borrow
    borrow = (diff >> 8) & 1
  }
  const two: u8[] = new Array<u8>(k)
  two[k - 1] = 2
  const s: u8[] | null = rsaSignPrivateOp(key, two)
  return borrow === 1 && s !== null
}

// ---------------------------------------------------------------------------
// Constant-time Montgomery arithmetic
// ---------------------------------------------------------------------------

/** The `len` big-endian bytes of `src` at `off` as `count` little-endian `u32` limbs in `out`. */
const rsaSignLimbs = (out: u32[], src: u8[], off: i32, len: i32, count: i32): void => {
  for (let limb: i32 = 0; limb < count; limb++) {
    let v: u32 = 0
    for (let b: i32 = 0; b < 4; b++) {
      const j: i32 = len - 1 - (limb * 4 + b)
      if (j >= 0) {
        v = v | (toU32(src[off + j]) << toU32(b * 8))
      }
    }
    out[limb] = v
  }
}

/** The low `k` bytes of the `count` limbs `a`, big-endian. */
const rsaSignBytes = (a: u32[], k: i32): u8[] => {
  const out: u8[] = new Array<u8>(k)
  for (let j: i32 = 0; j < k; j++) {
    out[k - 1 - j] = toU8(a[toI32(j / 4)] >> toU32((j & 3) << 3))
  }
  return out
}

/** -n^-1 mod 2^32 for the odd limb `n0`, by Newton's iteration (as in `nish/crypto/rsa`). */
const rsaSignMontInverse = (n0: u32): u32 => {
  let x: u32 = n0
  for (let i: i32 = 0; i < 4; i++) {
    const nx: u32 = toU32(toU64(n0) * toU64(x))
    x = toU32(toU64(x) * toU64(toU32(2 - toU64(nx))))
  }
  return toU32(0 - toU64(x))
}

/**
 * `out = t - n` when the `count + 1`-limb value `t` (its top limb `top`, 0 or
 * 1) is at least `n`, else `out = t`, for `t` below 2n: the subtraction is
 * always done and the answer chosen by mask. `out` is not `t`.
 */
const rsaSignReduce = (out: u32[], t: u32[], top: u32, n: u32[], count: i32): void => {
  let borrow: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const d: u64 = toU64(t[i]) - toU64(n[i]) - borrow
    out[i] = toU32(d)
    borrow = (d >> 32) & 1
  }
  // `t` stays when there is no top limb and the subtraction borrowed.
  const keep: u32 = toU32(borrow) & (top ^ 1)
  const take: u32 = ctEq(keep, 0)
  for (let i: i32 = 0; i < count; i++) {
    out[i] = ctSelect(take, out[i], t[i])
  }
}

/**
 * `out = a b R^-1 mod n`, R = 2^(32 count), for `a` and `b` below `n`: CIOS,
 * with `t` scratch of `count + 2` limbs and the final subtraction by mask.
 * `out` may be `a` or `b`.
 */
const rsaSignMontMul = (out: u32[], a: u32[], b: u32[], n: u32[], n0inv: u32, t: u32[], count: i32): void => {
  for (let i: i32 = 0; i < count + 2; i++) {
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
  rsaSignReduce(out, t, t[count], n, count)
}

/** R^2 mod n into `r` (`count` limbs), by doubling 1 modulo `n` 64 count times; `t` is scratch of `count` limbs. Public: `n` only. */
const rsaSignR2 = (r: u32[], n: u32[], t: u32[], count: i32): void => {
  for (let i: i32 = 0; i < count; i++) {
    r[i] = 0
  }
  r[0] = 1
  for (let k: i32 = 0; k < count * 64; k++) {
    let carry: u32 = 0
    for (let i: i32 = 0; i < count; i++) {
      const v: u32 = r[i]
      t[i] = (v << 1) | carry
      carry = v >> 31
    }
    rsaSignReduce(r, t, carry, n, count)
  }
}

/**
 * RSASP1 under the key value `key` (`n || d || e`): `m^d mod n` for the
 * `k`-byte `m` below `n`, by the fixed 4-bit window, then checked by raising
 * the answer to `e`. `null` for a key of the wrong shape, an `m` of the wrong
 * length or not below `n`, and a failed check. Every limb array is wiped.
 */
const rsaSignPrivateOp = (key: u8[], m: u8[]): u8[] | null => {
  const k: i32 = rsaSignKeySize(key)
  if (k === 0 || toI32(m.length) !== k || (toI32(key[k - 1]) & 1) === 0) {
    return null
  }
  const count: i32 = toI32((k + 3) / 4)
  const n: u32[] = new Array<u32>(count)
  rsaSignLimbs(n, key, 0, k, count)
  const ml: u32[] = new Array<u32>(count)
  rsaSignLimbs(ml, m, 0, k, count)
  // `m < n`: both are public, so the compare may exit early.
  let below: i32 = 0
  for (let i: i32 = count - 1; i >= 0; i--) {
    if (below === 0 && ml[i] !== n[i]) {
      below = ml[i] < n[i] ? 1 : -1
    }
  }
  if (below !== 1) {
    return null
  }
  const n0inv: u32 = rsaSignMontInverse(n[0])
  const t: u32[] = new Array<u32>(count + 2)
  const r2: u32[] = new Array<u32>(count)
  rsaSignR2(r2, n, t, count)
  const one: u32[] = new Array<u32>(count)
  one[0] = 1
  // table[j] = m^j R mod n, j = 0 to 15, one after another in one array.
  const table: u32[] = new Array<u32>(16 * count)
  const entry: u32[] = new Array<u32>(count)
  const mm: u32[] = new Array<u32>(count)
  rsaSignMontMul(entry, one, r2, n, n0inv, t, count)
  rsaSignMontMul(mm, ml, r2, n, n0inv, t, count)
  for (let j: i32 = 0; j < 16; j++) {
    for (let l: i32 = 0; l < count; l++) {
      table[j * count + l] = entry[l]
    }
    rsaSignMontMul(entry, entry, mm, n, n0inv, t, count)
  }
  const acc: u32[] = new Array<u32>(count)
  for (let l: i32 = 0; l < count; l++) {
    acc[l] = table[l]
  }
  const sel: u32[] = new Array<u32>(count)
  // Every nibble of d, from the top, leading zeros included.
  for (let i: i32 = 0; i < 2 * k; i++) {
    const at: i32 = k + toI32(i / 2)
    const byte: u32 = toU32(key[at])
    const nibble: u32 = (i & 1) === 0 ? byte >> 4 : byte & 15
    for (let s: i32 = 0; s < 4; s++) {
      rsaSignMontMul(acc, acc, acc, n, n0inv, t, count)
    }
    for (let l: i32 = 0; l < count; l++) {
      sel[l] = 0
    }
    for (let j: i32 = 0; j < 16; j++) {
      const mask: u32 = ctEq(toU32(j), nibble)
      for (let l: i32 = 0; l < count; l++) {
        sel[l] = sel[l] | (table[j * count + l] & mask)
      }
    }
    rsaSignMontMul(acc, acc, sel, n, n0inv, t, count)
  }
  rsaSignMontMul(acc, acc, one, n, n0inv, t, count)
  const signature: u8[] = rsaSignBytes(acc, k)
  // The check: signature^e mod n is m. `e` and the signature are public, so
  // square and multiply may branch on the exponent's bits.
  rsaSignMontMul(mm, acc, r2, n, n0inv, t, count)
  for (let l: i32 = 0; l < count; l++) {
    entry[l] = mm[l]
  }
  let started: boolean = false
  for (let i: i32 = 0; i < k; i++) {
    const byte: i32 = toI32(key[2 * k + i])
    for (let b: i32 = 7; b >= 0; b--) {
      const bit: i32 = (byte >> b) & 1
      if (started) {
        rsaSignMontMul(entry, entry, entry, n, n0inv, t, count)
        if (bit === 1) {
          rsaSignMontMul(entry, entry, mm, n, n0inv, t, count)
        }
      } else if (bit === 1) {
        started = true
      }
    }
  }
  rsaSignMontMul(entry, entry, one, n, n0inv, t, count)
  let differ: u32 = 0
  for (let l: i32 = 0; l < count; l++) {
    differ = differ | (entry[l] ^ ml[l])
  }
  wipe(table)
  wipe(acc)
  wipe(sel)
  wipe(t)
  wipe(entry)
  wipe(mm)
  if (differ !== 0 || !started) {
    return null
  }
  return signature
}
