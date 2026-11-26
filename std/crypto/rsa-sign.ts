/**
 * `nish/crypto/rsa-sign` — an RSA private key of 2048 to 4096 bits held as a
 * `Secret`, and RSASSA-PSS signing with SHA-256 under it (RFC 8017 §8.1.1,
 * the TLS 1.3 scheme `rsa_pss_rsae_sha256`), in constant-time arithmetic.
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
 * `nish/crypto/x509` reads PEM keys, PKCS#1 and PKCS#8, through
 * `rsaParsePrivateKey` (`x509ParseRsaPrivateKey`).
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
 * **The salt is derived, not drawn.** `rsaSignPssSha256` and
 * `rsaSignPssSha256Into` take as the salt the SHA-256 of a fixed label, the
 * private exponent's `k` bytes and the message's hash:
 * `RSA_PSS_SHA256_SALT_SIZE` bytes that no one without the key can predict,
 * the same for the same message and different for every other, as RFC 6979
 * derives an ECDSA nonce (`nish/crypto/p256` signs that way). PSS's security
 * does not rest on the salt being random (RFC 8017 §8.1, note 4: even an
 * empty salt keeps a reduction), and a verifier cannot tell a derived salt
 * from a drawn one. So nothing here reaches `crypto.getRandomValues` or any
 * other source, and the module compiles for wasm32. `rsaSignPssSha256Salted`
 * signs with a salt the caller gives, for known-answer tests.
 *
 * **Constant time.** The private exponent is applied in a fixed 4-bit window
 * over every nibble of its `⌈k / 4⌉` limbs, leading zeros included: four Montgomery
 * squarings, a read of the whole 16-entry table that keeps one entry under an
 * `ctEq` mask, and one Montgomery multiplication, for every nibble. The
 * Montgomery multiplication (CIOS, as in `nish/crypto/rsa`) ends in a
 * subtraction whose result is kept or dropped by `ctSelect`, never a branch.
 * So the sequence of operations and the addresses read depend on the modulus's
 * length alone. The modulus, the message and the public exponent are public,
 * and the code that touches only them (R^2 mod n, the check after signing)
 * may branch on them. The salt's hash reads the private exponent through
 * SHA-256, whose work depends on the length alone.
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
 * so is the hasher that derives the salt. The parse builds the `Secret`
 * straight from the DER without a copy that outlives it. The DER itself is
 * the caller's to wipe.
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
 * bytes with the sign octet dropped; `null` for another tag, an empty,
 * negative or non-minimal INTEGER, and one past `4096`.
 */
const rsaSignInteger = (der: u8[], at: i32, end: i32): RsaSignSpan | null => {
  const e: RsaSignSpan | null = rsaSignDer(der, at, end, 0x02)
  if (e === null) {
    return null
  }
  const start: i32 = e.start
  const stop: i32 = e.end
  if (start < 0 || start >= stop || stop > 4096 || start >= toI32(der.length) || toI32(der[start]) >= 0x80) {
    return null
  }
  if (toI32(der[start]) !== 0) {
    return e
  }
  const from: i32 = start + 1
  if (from >= stop || from >= toI32(der.length) || toI32(der[from]) < 0x80) {
    return null
  }
  return new RsaSignSpan(from, stop)
}

/**
 * The significant bits of the big-endian magnitude `der[start .. end)`, whose
 * first byte is nonzero; 0 for an empty span or one past `4096`.
 */
const rsaSignBits = (der: u8[], start: i32, end: i32): i32 => {
  if (start < 0 || start >= end || end > 4096 || start >= toI32(der.length)) {
    return 0
  }
  const top: i32 = toI32(der[start])
  let topBits: i32 = 0
  for (let b: i32 = 0; b < 8; b++) {
    if (top >> b !== 0) {
      topBits = b + 1
    }
  }
  const bytes: i32 = end - start
  if (topBits < 1 || topBits > 8 || bytes < 1 || bytes > 4096) {
    return 0
  }
  return (bytes - 1) * 8 + topBits
}

/** Whether the byte before `der[end]` is odd: the last byte of a magnitude ending there. */
const rsaSignOdd = (der: u8[], end: i32): boolean => {
  if (end < 1 || end > 4096) {
    return false
  }
  const last: i32 = end - 1
  return last < der.length && (toI32(der[last]) & 1) === 1
}

/**
 * The `3 k` key bytes: `n`, `d` and `e`, each right-aligned in `k` bytes, out
 * of the spans the parse found, which fit `k`; empty for a `k` out of range.
 */
const rsaSignKeyBytes = (der: u8[], k: i32, n: RsaSignSpan, d: RsaSignSpan, e: RsaSignSpan): u8[] => {
  if (k < 256 || k > 512) {
    return []
  }
  const total: i32 = k * 3
  const out: u8[] = new Array<u8>(total)
  rsaSignPlace(out, 0, k, der, n)
  rsaSignPlace(out, k, k, der, d)
  rsaSignPlace(out, 2 * k, k, der, e)
  return out
}

/**
 * Copies the bytes of `span` into the last of the `width` bytes of `out` at
 * `at`; a span wider than `width` copies nothing.
 */
const rsaSignPlace = (out: u8[], at: i32, width: i32, der: u8[], span: RsaSignSpan): void => {
  const start: i32 = span.start
  const stop: i32 = span.end
  if (
    start < 0 ||
    start > 4096 ||
    stop < 0 ||
    stop < start ||
    stop > 4096 ||
    at < 0 ||
    at > 1024 ||
    width < 0 ||
    width > 512
  ) {
    return
  }
  const length: i32 = stop - start
  if (length < 0 || length > width) {
    return
  }
  const pad: i32 = width - length
  const to: i32 = at + pad
  for (let i: i32 = 0; i < length; i++) {
    const o: i32 = to + i
    const s: i32 = start + i
    if (o >= 0 && o < out.length && s >= 0 && s < der.length) {
      out[o] = der[s]
    }
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
  if (seq === null || seq.end !== end || end > 4096) {
    return null
  }
  const version: RsaSignSpan | null = rsaSignDer(der, seq.start, seq.end, 0x02)
  if (version === null) {
    return null
  }
  const vs: i32 = version.start
  if (vs < 0 || vs >= toI32(der.length) || version.end !== vs + 1 || toI32(der[vs]) !== 0) {
    return null
  }
  const n: RsaSignSpan | null = rsaSignInteger(der, version.end, seq.end)
  if (n === null) {
    return null
  }
  const e: RsaSignSpan | null = rsaSignInteger(der, n.end, seq.end)
  if (e === null) {
    return null
  }
  const d: RsaSignSpan | null = rsaSignInteger(der, e.end, seq.end)
  if (d === null) {
    return null
  }
  // p, q, dP, dQ and qInv: read for their form, not kept.
  let at: i32 = d.end
  for (let i: i32 = 0; i < 5; i++) {
    const v: RsaSignSpan | null = rsaSignInteger(der, at, seq.end)
    if (v === null) {
      return null
    }
    at = v.end
  }
  if (at !== seq.end) {
    return null
  }
  const total: i32 = toI32(der.length)
  const ns: i32 = n.start
  const ne: i32 = n.end
  const es: i32 = e.start
  const ee: i32 = e.end
  const ds: i32 = d.start
  const de: i32 = d.end
  if (
    ns < 0 ||
    ne <= ns ||
    ne > total ||
    es < 0 ||
    ee <= es ||
    ee > total ||
    ds < 0 ||
    de < ds ||
    de > total
  ) {
    return null
  }
  const bits: i32 = rsaSignBits(der, ns, ne)
  const eBits: i32 = rsaSignBits(der, es, ee)
  if (
    bits < 2048 ||
    bits > 4096 ||
    !rsaSignOdd(der, ne) ||
    eBits < 2 ||
    eBits > 32 ||
    !rsaSignOdd(der, ee) ||
    de - ds > ne - ns
  ) {
    return null
  }
  const key: Secret<u8[]> = secret(rsaSignKeyBytes(der, ne - ns, n, d, e))
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
 * The hashers `rsaSignPssSha256SaltedInto` hashes with, made once and reused, so a
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

  /**
   * The derived salt for the message hash `mHash` (32 bytes), written into
   * `salt` (32 bytes): the SHA-256 of "nish rsa-pss-sha256 salt", the private
   * exponent `d` and `mHash`. The hasher's state, block and schedule, which
   * held `d`'s blocks, are wiped before it returns.
   *
   * @param d A copy of the private exponent, which the caller wipes.
   * @param mHash The message's SHA-256.
   * @param salt The array the salt is written into.
   * @returns Whether the salt was written.
   */
  saltInto(d: u8[], mHash: u8[], salt: u8[]): boolean {
    if (toI32(mHash.length) !== 32 || toI32(salt.length) !== 32) {
      return false
    }
    const label: u8[] = [
      110, 105, 115, 104, 32, 114, 115, 97, 45, 112, 115, 115, 45, 115, 104, 97, 50, 53, 54, 32, 115, 97, 108,
      116,
    ]
    hmacCopySha256(this.fresh, this.work)
    this.work.update(label, 0, 24)
    this.work.update(d, 0, toI32(d.length))
    this.work.update(mHash, 0, 32)
    const ok: boolean = this.work.digestInto(salt, 0)
    wipe(this.work.state)
    wipe(this.work.block)
    wipe(this.work.schedule)
    this.work.fill = 0
    this.work.total = 0
    return ok
  }
}

/**
 * RSASSA-PSS-SIGN (RFC 8017 §8.1.1) with SHA-256, MGF1-SHA-256 and the salt
 * given: for known-answer tests. A salt of any length up to `emLen - 34`
 * bytes is taken; TLS's `rsa_pss_rsae_sha256` wants
 * `RSA_PSS_SHA256_SALT_SIZE` bytes, which `rsaSignPssSha256` derives. `null`
 * for a salt too long for the key, a
 * `Secret` that is not a key from `rsaParsePrivateKey`, and a signature that
 * fails the check against `e`.
 *
 * @param priv The key, borrowed.
 * @param msg The message, hashed here.
 * @param salt The salt.
 * @returns The `k`-byte signature, or `null`.
 */
export const rsaSignPssSha256Salted = (priv: Secret<u8[]>, msg: u8[], salt: u8[]): u8[] | null => {
  const em: u8[] | null = rsaSignPssEncode(
    new RsaSignScratch(),
    msg,
    0,
    toI32(msg.length),
    salt,
    rsaPrivateKeyBits(priv)
  )
  if (em === null) {
    return null
  }
  return exposeWith(priv, em, rsaSignPrivateOp)
}

/**
 * `rsaSignPssSha256Salted` over `msg[off .. off + len)`, writing the `k`-byte
 * signature at `out[at]`, hashing in `sc` and releasing every allocation of
 * its own before it returns: for a server whose memory may not grow per
 * handshake (`rsaSignPssSha256Into` derives the salt). Answers `false`, leaving `out` as it was, when either window is
 * outside its array (`k` is `rsaPrivateKeyBits(priv)` rounded up to bytes),
 * for a salt too long for the key, a `Secret` that is not a key and a
 * signature that fails the check against `e`.
 *
 * @param sc The hashers, made once by the caller.
 * @param priv The key, borrowed.
 * @param msg The array holding the message.
 * @param off The message's first index.
 * @param len The message's length.
 * @param salt The salt.
 * @param out The array the signature is written into.
 * @param at The index of the signature's first byte.
 * @returns Whether a signature was written.
 */
export const rsaSignPssSha256SaltedInto = (
  sc: RsaSignScratch,
  priv: Secret<u8[]>,
  msg: u8[],
  off: i32,
  len: i32,
  salt: u8[],
  out: u8[],
  at: i32
): boolean => {
  const bits: i32 = rsaPrivateKeyBits(priv)
  if (bits < 2048 || bits > 4096) {
    return false
  }
  const k: i32 = toI32((bits + 7) / 8)
  if (off < 0 || len < 0 || off > toI32(msg.length) - len || at < 0 || at > toI32(out.length) - k) {
    return false
  }
  using _scope = arena()
  const em: u8[] | null = rsaSignPssEncode(sc, msg, off, len, salt, bits)
  if (em === null) {
    return false
  }
  const signature: u8[] | null = exposeWith(priv, em, rsaSignPrivateOp)
  if (signature === null || toI32(signature.length) !== k) {
    return false
  }
  const sig: u8[] = signature
  for (let i: i32 = 0; i < sig.length; i++) {
    const o: i32 = toI32(toI64(at) + toI64(i))
    if (o >= 0 && o < out.length) {
      out[o] = sig[i]
    }
  }
  return true
}

/**
 * RSASSA-PSS-SIGN (RFC 8017 §8.1.1) with SHA-256, MGF1-SHA-256 and the
 * `RSA_PSS_SHA256_SALT_SIZE`-byte salt derived from the key and the message
 * (see the module's comment): TLS 1.3's `rsa_pss_rsae_sha256`. `null` for a
 * `Secret` that is not a key from `rsaParsePrivateKey` and a signature that
 * fails the check against `e`.
 *
 * @param priv The key, borrowed.
 * @param msg The message, hashed here.
 * @returns The `k`-byte signature, or `null`.
 */
export const rsaSignPssSha256 = (priv: Secret<u8[]>, msg: u8[]): u8[] | null => {
  const sc: RsaSignScratch = new RsaSignScratch()
  const mHash: u8[] = new Array<u8>(32)
  if (!sc.hashInto(msg, 0, toI32(msg.length), -1, mHash, 0)) {
    return null
  }
  const salt: u8[] = new Array<u8>(32)
  if (!rsaSignSaltInto(sc, priv, mHash, salt)) {
    return null
  }
  return rsaSignPssSha256Salted(priv, msg, salt)
}

/**
 * `rsaSignPssSha256` over `msg[off .. off + len)`, writing the `k`-byte
 * signature at `out[at]`, hashing in `sc` and releasing every allocation of
 * its own before it returns: `rsaSignPssSha256SaltedInto` with the derived
 * salt. Answers `false`, leaving `out` as it was, when either window is
 * outside its array, for a `Secret` that is not a key and a signature that
 * fails the check against `e`.
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
  if (off < 0 || len < 0 || off > toI32(msg.length) - len) {
    return false
  }
  using _scope = arena()
  const mHash: u8[] = new Array<u8>(32)
  if (!sc.hashInto(msg, off, len, -1, mHash, 0)) {
    return false
  }
  const salt: u8[] = new Array<u8>(32)
  if (!rsaSignSaltInto(sc, priv, mHash, salt)) {
    return false
  }
  return rsaSignPssSha256SaltedInto(sc, priv, msg, off, len, salt, out, at)
}

/**
 * The derived salt for `mHash`, hashed in `sc`, written into `salt`: a copy
 * of the private exponent is taken with `expose`, hashed and wiped, the shape
 * `p256SignSha256Into` has, since a function `exposeWith` runs may not write
 * through its argument and a hasher made inside it would store arrays no
 * arena block may release around. Whether it was written; `false` for a key
 * value of the wrong shape.
 */
const rsaSignSaltInto = (sc: RsaSignScratch, priv: Secret<u8[]>, mHash: u8[], salt: u8[]): boolean => {
  const d: u8[] = expose(priv, rsaSignExponentCopy)
  if (toI32(d.length) === 0) {
    return false
  }
  const ok: boolean = sc.saltInto(d, mHash, salt)
  wipe(d)
  return ok
}

/** A copy of the private exponent's `k` bytes, for `rsaSignSaltInto`; empty for a key value of the wrong shape. */
const rsaSignExponentCopy = (key: u8[]): u8[] => {
  const k: i32 = rsaSignKeySize(key)
  if (k < 256 || k > 512) {
    return []
  }
  const d: u8[] = new Array<u8>(k)
  for (let i: i32 = 0; i < toI32(d.length) && i < 512; i++) {
    const j: i32 = k + i
    if (j < toI32(key.length)) {
      d[i] = key[j]
    }
  }
  return d
}

// ---------------------------------------------------------------------------
// EMSA-PSS (RFC 8017 §9.1.1) and MGF1 (§B.2.1)
// ---------------------------------------------------------------------------

/**
 * EMSA-PSS-ENCODE of `msg[off .. off + len)` with `salt`, for a modulus of
 * `bits` bits (emBits = bits - 1), hashing in `sc`, returned as `k` bytes:
 * the `emLen`-byte EM, behind a zero byte when `emLen` is `k - 1`. `null`
 * for `bits` out of range, a salt that does not fit (emLen < 32 + sLen + 2)
 * and a message window outside `msg`.
 */
const rsaSignPssEncode = (
  sc: RsaSignScratch,
  msg: u8[],
  off: i32,
  len: i32,
  salt: u8[],
  bits: i32
): u8[] | null => {
  if (bits < 2048 || bits > 4096) {
    return null
  }
  const k: i32 = toI32((bits + 7) / 8)
  const emBits: i32 = bits - 1
  const emLen: i32 = toI32((emBits + 7) / 8)
  const sLen: i32 = toI32(salt.length)
  if (sLen < 0 || sLen > 478 || sLen > emLen - 34) {
    return null
  }
  // M' = 00 x 8 || mHash || salt, and H = Hash(M').
  const prime: u8[] = new Array<u8>(40 + sLen)
  if (!sc.hashInto(msg, off, len, -1, prime, 8)) {
    return null
  }
  for (let i: i32 = 0; i < sLen; i++) {
    const p: i32 = 40 + i
    if (p < prime.length) {
      prime[p] = salt[i]
    }
  }
  const out: u8[] = new Array<u8>(k)
  const from: i32 = k - emLen
  const dbLen: i32 = emLen - 33
  const hAt: i32 = from + dbLen
  if (from < 0 || from > 1 || !sc.hashInto(prime, 0, toI32(prime.length), -1, out, hAt)) {
    return null
  }
  // DB = PS || 01 || salt, masked by MGF1(H): the mask is written into `out`
  // first, a block at a time, and DB XORed in after it.
  const block: u8[] = new Array<u8>(32)
  for (let done: i32 = 0; done < dbLen; done = done + 32) {
    if (!sc.hashInto(out, hAt, 32, toI32(done / 32), block, 0)) {
      return null
    }
    for (let i: i32 = 0; i < 32; i++) {
      const o: i32 = from + done + i
      if (done + i < dbLen && o < out.length && i < block.length) {
        out[o] = block[i]
      }
    }
  }
  const one: i32 = toI32(toI64(hAt) - toI64(sLen) - 1)
  if (one >= 0 && one < out.length) {
    out[one] = out[one] ^ 1
  }
  for (let i: i32 = 0; i < sLen; i++) {
    const o: i32 = toI32(toI64(one) + 1 + toI64(i))
    if (o >= 0 && o < out.length) {
      out[o] = out[o] ^ salt[i]
    }
  }
  // Clear the leftmost 8 emLen - emBits bits.
  if (from < out.length && k >= 1 && k <= out.length) {
    out[from] = toU8(toI32(out[from]) & (0xff >> (8 * emLen - emBits)))
    out[k - 1] = 0xbc
  }
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
  if (k === 0 || key.length === 0 || toI32(key[0]) === 0) {
    return 0
  }
  const bits: i32 = rsaSignBits(key, 0, k)
  if (bits < 2048 || bits > 4096) {
    return 0
  }
  return bits
}

/** A copy of the `k` bytes of the key value from `from`; empty for one of the wrong shape. */
const rsaSignKeyPart = (key: u8[], part: i32): u8[] => {
  const k: i32 = rsaSignKeySize(key)
  if (k < 256 || k > 512 || part < 0 || part > 2) {
    return []
  }
  const out: u8[] = new Array<u8>(k)
  for (let i: i32 = 0; i < k; i++) {
    const s: i32 = part * k + i
    if (s >= 0 && s < key.length && i < out.length) {
      out[i] = key[s]
    }
  }
  return out
}

/** A copy of the key's first `k` bytes, `n`. */
const rsaSignKeyModulus = (key: u8[]): u8[] => rsaSignKeyPart(key, 0)

/** A copy of the key's last `k` bytes, `e`. */
const rsaSignKeyExponent = (key: u8[]): u8[] => rsaSignKeyPart(key, 2)

/**
 * Whether the parsed key value holds together: `d` below `n` (compared over
 * all `k` bytes, without an early exit) and RSASP1 of 2 opening to 2 under
 * `e`, which `rsaSignPrivateOp`'s own check does.
 */
const rsaSignKeySound = (key: u8[]): boolean => {
  const k: i32 = rsaSignKeySize(key)
  if (k < 256 || k > 512 || rsaSignKeyBits(key) === 0) {
    return false
  }
  // d - n, borrow out of the top: set when d < n.
  let borrow: i32 = 0
  for (let i: i32 = k - 1; i >= 0; i--) {
    const di: i32 = k + i
    if (di < key.length && i < key.length) {
      const diff: i32 = toI32(key[di]) - toI32(key[i]) - borrow
      borrow = (diff >> 8) & 1
    }
  }
  const two: u8[] = new Array<u8>(k)
  const last: i32 = k - 1
  if (last >= 0 && last < two.length) {
    two[last] = 2
  }
  const s: u8[] | null = rsaSignPrivateOp(key, two)
  return borrow === 1 && s !== null
}

// ---------------------------------------------------------------------------
// Constant-time Montgomery arithmetic
// ---------------------------------------------------------------------------
//
// Every limb array is `128` long and `t` two more, the most a
// 4096-bit modulus takes; `count`, the modulus's own limbs, is 64 to 128, and
// the limbs past it stay zero. Each helper checks those lengths on entry and
// does nothing when they do not hold, which no caller here lets happen.

/**
 * The `len` big-endian bytes of `src` at `off` as `count` little-endian `u32`
 * limbs in `out`.
 */
const rsaSignLimbs = (out: u32[], src: u8[], off: i32, len: i32, count: i32): void => {
  if (count < 0 || count > 128 || off < 0 || off > 1024 || len < 0 || len > 512) {
    return
  }
  for (let limb: i32 = 0; limb < count; limb++) {
    let v: u32 = 0
    for (let b: i32 = 0; b < 4; b++) {
      const j: i32 = len - 1 - (limb * 4 + b)
      const s: i32 = off + j
      if (j >= 0 && s >= 0 && s < src.length) {
        v = v | (toU32(src[s]) << toU32(b * 8))
      }
    }
    if (limb < out.length) {
      out[limb] = v
    }
  }
}

/** The low `k` bytes of the limbs `a`, big-endian; empty for a `k` out of range. */
const rsaSignBytes = (a: u32[], k: i32): u8[] => {
  if (k < 0 || k > 512 || a.length < 128) {
    return []
  }
  const out: u8[] = new Array<u8>(k)
  for (let j: i32 = 0; j < k; j++) {
    const o: i32 = k - 1 - j
    if (o >= 0 && o < out.length) {
      out[o] = toU8(a[toI32(j / 4)] >> toU32((j & 3) << 3))
    }
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

/** Whether every limb array is as long as `128`, `t` two more, and `count` fits. */
const rsaSignShaped = (out: u32[], a: u32[], n: u32[], t: u32[], count: i32): boolean =>
  count >= 1 && count <= 128 && out.length >= 128 && a.length >= 128 && n.length >= 128 && t.length >= 130

/**
 * `out = t - n` when the `count + 1`-limb value `t` (its top limb `top`, 0 or
 * 1) is at least `n`, else `out = t`, for `t` below 2n: the subtraction is
 * always done and the answer chosen by mask. `out` is not `t`.
 */
const rsaSignReduce = (out: u32[], t: u32[], top: u32, n: u32[], count: i32): void => {
  if (count < 1 || count > 128 || out.length < 128 || t.length < 128 || n.length < 128) {
    return
  }
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
 * with `t` as scratch and the final subtraction by mask. `out` may be `a` or
 * `b`. Every sum is at most (2^32 - 1) + (2^32 - 1)^2 + (2^32 - 1) = 2^64 - 1.
 */
const rsaSignMontMul = (out: u32[], a: u32[], b: u32[], n: u32[], n0inv: u32, t: u32[], count: i32): void => {
  if (
    !rsaSignShaped(out, a, n, t, count) ||
    b.length < 128 ||
    count > 128 ||
    count < 1 ||
    t.length < 130 ||
    a.length < 128 ||
    n.length < 128
  ) {
    return
  }
  for (let i: i32 = 0; i < 130; i++) {
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

/**
 * R^2 mod n into `r`, by doubling 1 modulo `n` 64 count times; `t` is
 * scratch. Public: it reads `n` only.
 */
const rsaSignR2 = (r: u32[], n: u32[], t: u32[], count: i32): void => {
  if (!rsaSignShaped(r, r, n, t, count) || count > 128 || count < 1 || r.length < 128 || t.length < 128) {
    return
  }
  for (let i: i32 = 0; i < 128; i++) {
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
 * length or not below `n`, and a failed check. Every limb array that held
 * `d` or a power of `m` is wiped.
 */
const rsaSignPrivateOp = (key: u8[], m: u8[]): u8[] | null => {
  const k: i32 = rsaSignKeySize(key)
  if (k < 256 || k > 512 || toI32(m.length) !== k || key.length < k || (toI32(key[k - 1]) & 1) === 0) {
    return null
  }
  const count: i32 = toI32((k + 3) / 4)
  const n: u32[] = new Array<u32>(128)
  rsaSignLimbs(n, key, 0, k, count)
  const ml: u32[] = new Array<u32>(128)
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
  const t: u32[] = new Array<u32>(130)
  const r2: u32[] = new Array<u32>(128)
  rsaSignR2(r2, n, t, count)
  const one: u32[] = new Array<u32>(128)
  one[0] = 1
  // table[j] = m^j R mod n, j = 0 to 15, one after another in one array.
  const table: u32[] = new Array<u32>(2048)
  const entry: u32[] = new Array<u32>(128)
  const mm: u32[] = new Array<u32>(128)
  rsaSignMontMul(entry, one, r2, n, n0inv, t, count)
  rsaSignMontMul(mm, ml, r2, n, n0inv, t, count)
  for (let j: i32 = 0; j < 16; j++) {
    for (let l: i32 = 0; l < count; l++) {
      table[j * count + l] = entry[l]
    }
    rsaSignMontMul(entry, entry, mm, n, n0inv, t, count)
  }
  const acc: u32[] = new Array<u32>(128)
  for (let l: i32 = 0; l < count; l++) {
    acc[l] = table[l]
  }
  const dl: u32[] = new Array<u32>(128)
  rsaSignLimbs(dl, key, k, k, count)
  const sel: u32[] = new Array<u32>(128)
  // Every nibble of d's limbs, from the top, leading zeros included.
  for (let nib: i32 = 8 * count - 1; nib >= 0; nib--) {
    const limb: i32 = toI32(nib / 8)
    const nibble: u32 = (dl[limb] >> toU32((nib & 7) * 4)) & 15
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
  const el: u32[] = new Array<u32>(128)
  rsaSignLimbs(el, key, 2 * k, k, count)
  rsaSignMontMul(mm, acc, r2, n, n0inv, t, count)
  for (let l: i32 = 0; l < count; l++) {
    entry[l] = mm[l]
  }
  let started: boolean = false
  for (let bit: i32 = 32 * count - 1; bit >= 0; bit--) {
    const limb: i32 = toI32(bit / 32)
    const set: u32 = (el[limb] >> toU32(bit & 31)) & 1
    if (started) {
      rsaSignMontMul(entry, entry, entry, n, n0inv, t, count)
      if (set === 1) {
        rsaSignMontMul(entry, entry, mm, n, n0inv, t, count)
      }
    } else if (set === 1) {
      started = true
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
  wipe(dl)
  if (differ !== 0 || !started) {
    return null
  }
  return signature
}
