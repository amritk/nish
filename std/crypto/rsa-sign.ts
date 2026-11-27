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
 * modulus. The CRT values must hold together (RFC 8017 §3.2): `p` and `q`
 * odd, `dP` below `p`, `dQ` below `q` and `qInv` below `p`, `p q` equal to the
 * modulus and `q qInv` 1 modulo `p`. Then one value is signed twice: 2 by the
 * CRT, opened again under the public exponent, and 2 raised to the private
 * exponent and then to the public one, each of which must give 2 back, so a
 * key whose exponents do not undo each other is refused at load, not at the
 * first handshake. The key's bytes lie in the first 4096 of the array it is read from: the
 * reader bounds absolute indexes, not the key's length, so a key past index
 * 4096 of a larger buffer is refused (a 4096-bit PKCS#1 key is about 2350
 * bytes, and `nish/crypto/x509` hands it the PEM block's own DER, where a
 * PKCS#8 wrapper puts the key a few dozen bytes in). The `Secret` holds the
 * modulus, the private exponent and the public exponent, each as many
 * big-endian bytes as the modulus has (`k`); then `p`, `q`, `dP`, `dQ` and
 * `qInv`, then R^2 and R^3 modulo `p` and modulo `q`, each in `w` bytes, for
 * `w` four times half the modulus's 32-bit limbs, rounded up; then R^2 modulo
 * the modulus in `k` bytes: `4 k + 9 w` bytes, the constants computed once at
 * load.
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
 * **Constant time.** Each half exponent is applied in a fixed 4-bit window
 * over every nibble of its limbs, leading zeros included: four Montgomery
 * squarings, a read of the whole 16-entry table that keeps one entry under an
 * `ctEq` mask, and one Montgomery multiplication, for every nibble. The
 * Montgomery multiplication (CIOS, as in `nish/crypto/rsa`) ends in a
 * subtraction whose result is kept or dropped by `ctSelect`, never a branch.
 * Recombining the halves (Garner's `h = (s1 - s2) qInv mod p`, then
 * `s = s2 + q h`) is masked arithmetic of the same fixed shape. So the
 * sequence of operations and the addresses read depend on the modulus's
 * length alone. The modulus, the message and the public exponent are public,
 * and the code that touches only them (the check after signing) may branch on
 * them. The salt's hash reads the private exponent through SHA-256, whose
 * work depends on the length alone.
 *
 * **CRT, checked; no blinding.** Signing works modulo `p` and `q`, about a
 * quarter of the work of one exponentiation by `d` modulo `n`. A fault in one
 * half gives a value right modulo one prime and wrong modulo the other, which
 * factors `n` (Bellcore), so every signature is raised to `e` and compared
 * with the encoded message, and its limbs checked below `n`, before any byte
 * of it is returned; one that does not match answers `null`. The exponents
 * are not blinded; the fixed window is the defence against timing (RSA-S2 in
 * docs/security/crypto-rsa.md).
 *
 * **Wiping.** Every limb array that held a prime, an exponent, a constant
 * made from a prime or a power of the message, the window table and the
 * product among them, is wiped before the exposing function returns, and
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
  return last < toI32(der.length) && (toI32(der[last]) & 1) === 1
}

/**
 * The bytes each CRT value of a key with a `k`-byte modulus takes: `4 c`, for
 * the `c = ⌈⌈k / 4⌉ / 2⌉` limbs of half the modulus; 0 for a `k` out of range.
 */
const rsaSignHalfWidth = (k: i32): i32 => {
  if (k < 256 || k > 512) {
    return 0
  }
  const count: i32 = toI32((k + 3) / 4)
  return toI32((count + 1) / 2) * 4
}

/**
 * The key bytes for a `k`-byte modulus, `4 k + 9 w` of them with `w` from
 * `rsaSignHalfWidth`: `n`, `d` and `e` in `k` bytes each, then `p`, `q`,
 * `dP`, `dQ` and `qInv` in `w` bytes each, each right-aligned, out of the spans
 * the parse found, which fit; the four Montgomery constants after them and
 * R^2 mod n in the last `k` bytes stay zero for `rsaSignPrecompute`. Empty for
 * a `k` out of range.
 */
const rsaSignKeyBytes = (der: u8[], k: i32, spans: RsaSignSpan[]): u8[] => {
  const w: i32 = rsaSignHalfWidth(k)
  if (w === 0 || toI32(spans.length) !== 8) {
    return []
  }
  const out: u8[] = new Array<u8>(4 * k + 9 * w)
  for (let i: i32 = 0; i < 8; i++) {
    const at: i32 = i < 3 ? i * k : 3 * k + (i - 3) * w
    rsaSignPlace(out, at, i < 3 ? k : w, der, spans[i])
  }
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
    at > 4096 ||
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
    if (o >= 0 && o < toI32(out.length) && s >= 0 && s < toI32(der.length)) {
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
 * the modulus; for CRT values that do not hold together (`p` or `q` even,
 * `dP`, `dQ` or `qInv` out of range, `p q` not the modulus, `q qInv` not 1
 * modulo `p`); and for exponents that do not undo each other (2 signed by the
 * CRT, or raised to the private exponent, and opened again is not 2). `der`
 * is not changed and not kept: the
 * caller wipes it. A key whose `end` is past 4096 is refused, whatever its
 * length: the limit is on the index, not on `end - start`.
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
  // p, q, dP, dQ and qInv, each no wider than half the modulus's limbs.
  const spans: RsaSignSpan[] = [n, d, e]
  let at: i32 = d.end
  for (let i: i32 = 0; i < 5; i++) {
    const v: RsaSignSpan | null = rsaSignInteger(der, at, seq.end)
    if (v === null) {
      return null
    }
    spans.push(v)
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
  const w: i32 = rsaSignHalfWidth(ne - ns)
  for (let i: i32 = 3; i < 8; i++) {
    if (spans[i].end - spans[i].start > w) {
      return null
    }
  }
  const bytes: u8[] = rsaSignKeyBytes(der, ne - ns, spans)
  rsaSignPrecompute(bytes)
  const key: Secret<u8[]> = secret(bytes)
  if (!expose(key, rsaSignKeySound)) {
    wipe(key)
    return null
  }
  return key
}

/**
 * The modulus bits of a key from `rsaParsePrivateKey`, or 0 for a `Secret`
 * that is not one (its length is not `4 k + 9 w` for a `k` of 256 to 512).
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
      this.work.update(c, toI32(0), toI32(4))
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
    this.work.update(label, toI32(0), toI32(24))
    this.work.update(d, toI32(0), toI32(d.length))
    this.work.update(mHash, toI32(0), toI32(32))
    const ok: boolean = this.work.digestInto(salt, toI32(0))
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
 * signature at `out[at]` and hashing in `sc`, for a server whose memory may not
 * grow per handshake; `rsaSignPssSha256Into` derives the salt. Its arena scope
 * frees what it allocates. Answers `false`, leaving `out` as it was, when either
 * window is outside its array (`k` is `rsaPrivateKeyBits(priv)` rounded up to
 * bytes), for a salt too long for the key, a `Secret` that is not a key and a
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
  for (let i: i32 = 0; i < toI32(sig.length); i++) {
    const o: i32 = toI32(toI64(at) + toI64(i))
    if (o >= 0 && o < toI32(out.length)) {
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
  if (!sc.hashInto(msg, toI32(0), toI32(msg.length), toI32(-1), mHash, toI32(0))) {
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
 * signature at `out[at]` and hashing in `sc`: `rsaSignPssSha256SaltedInto`
 * with the derived salt. The hash and the salt it allocates are released when
 * its `arena()` scope closes on return; that release covers only what is
 * allocated inside the scope, so it holds while no caller keeps a reference
 * to them, and `sc` and `out` are the caller's. Answers `false`, leaving `out`
 * as it was, when either window is outside its array, for a `Secret` that is
 * not a key, and for a signature that fails the check against `e`.
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
  if (!sc.hashInto(msg, off, len, toI32(-1), mHash, toI32(0))) {
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
  if (!sc.hashInto(msg, off, len, toI32(-1), prime, toI32(8))) {
    return null
  }
  for (let i: i32 = 0; i < sLen; i++) {
    const p: i32 = 40 + i
    if (p < toI32(prime.length)) {
      prime[p] = salt[i]
    }
  }
  const out: u8[] = new Array<u8>(k)
  const from: i32 = k - emLen
  const dbLen: i32 = emLen - 33
  const hAt: i32 = from + dbLen
  if (from < 0 || from > 1 || !sc.hashInto(prime, toI32(0), toI32(prime.length), toI32(-1), out, hAt)) {
    return null
  }
  // DB = PS || 01 || salt, masked by MGF1(H): the mask is written into `out`
  // first, a block at a time, and DB XORed in after it.
  const block: u8[] = new Array<u8>(32)
  for (let done: i32 = 0; done < dbLen; done = done + 32) {
    if (!sc.hashInto(out, hAt, toI32(32), toI32(done / 32), block, toI32(0))) {
      return null
    }
    for (let i: i32 = 0; i < 32; i++) {
      const o: i32 = from + done + i
      if (done + i < dbLen && o < toI32(out.length) && i < toI32(block.length)) {
        out[o] = block[i]
      }
    }
  }
  const one: i32 = toI32(toI64(hAt) - toI64(sLen) - 1)
  if (one >= 0 && one < toI32(out.length)) {
    out[one] = out[one] ^ 1
  }
  for (let i: i32 = 0; i < sLen; i++) {
    const o: i32 = toI32(toI64(one) + 1 + toI64(i))
    if (o >= 0 && o < toI32(out.length)) {
      out[o] = out[o] ^ salt[i]
    }
  }
  // Clear the leftmost 8 emLen - emBits bits.
  if (from < toI32(out.length) && k >= 1 && k <= toI32(out.length)) {
    out[from] = toU8(toI32(out[from]) & (toI32(0xff) >> (8 * emLen - emBits)))
    out[k - 1] = 0xbc
  }
  return out
}

// ---------------------------------------------------------------------------
// The key's shape
// ---------------------------------------------------------------------------

/**
 * `k` for a key value of `4 k + 9 w` bytes (`rsaSignKeyBytes`) with `k` 256
 * to 512, else 0. The length grows with `k`, so one `k` at most has it.
 */
const rsaSignKeySize = (key: u8[]): i32 => {
  const total: i32 = toI32(key.length)
  for (let k: i32 = 256; k <= 512; k++) {
    if (4 * k + 9 * rsaSignHalfWidth(k) === total) {
      return k
    }
  }
  return 0
}

/** The modulus bits of the key value, or 0 for one of the wrong shape or a leading zero byte. */
const rsaSignKeyBits = (key: u8[]): i32 => {
  const k: i32 = rsaSignKeySize(key)
  // biome-ignore lint/style/useExplicitLengthCheck: the panic prover reads `length < 1` as a bound for the key[0] after it and does not read `=== 0`
  if (k === 0 || key.length < 1) {
    return 0
  }
  if (key[0] === 0) {
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
    if (s >= 0 && s < toI32(key.length) && i < toI32(out.length)) {
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
 * Whether the parsed key value holds together, without a branch on a secret
 * until the answer: `d` below `n`; `p` and `q` odd; `dP` below `p`, `dQ` below
 * `q` and `qInv` below `p` (RFC 8017 §3.2); `p q = n`; `q qInv = 1 mod p`,
 * which also refuses `p = q`; then RSASP1 of 2 by the CRT, opened again under
 * `e` by `rsaSignPrivateOp`'s own check, and 2 raised to `d` and then to `e`
 * giving 2, since `d` itself still derives the salt.
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
    if (di < toI32(key.length) && i < toI32(key.length)) {
      const diff: i32 = toI32(key[di]) - toI32(key[i]) - borrow
      borrow = (diff >> 8) & 1
    }
  }
  const crt: u32 = rsaSignCrtSound(key, k)
  const two: u8[] = new Array<u8>(k)
  const last: i32 = k - 1
  if (last >= 0 && last < toI32(two.length)) {
    two[last] = 2
  }
  const s: u8[] | null = rsaSignPrivateOp(key, two)
  const full: boolean = rsaSignFullOpens(key, two)
  return borrow === 1 && crt === 0 && s !== null && full
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
  if (count < 0 || count > 128 || off < 0 || off > 4096 || len < 0 || len > 512) {
    return
  }
  for (let limb: i32 = 0; limb < count; limb++) {
    let v: u32 = 0
    for (let b: i32 = 0; b < 4; b++) {
      const j: i32 = len - 1 - (limb * 4 + b)
      const s: i32 = off + j
      if (j >= 0 && s >= 0 && s < toI32(src.length)) {
        v = v | (toU32(src[s]) << toU32(b * 8))
      }
    }
    if (limb < toI32(out.length)) {
      out[limb] = v
    }
  }
}

/** The low `k` bytes of the limbs `a`, big-endian; empty for a `k` out of range. */
const rsaSignBytes = (a: u32[], k: i32): u8[] => {
  if (k < 0 || k > 512 || toI32(a.length) < 128) {
    return []
  }
  const out: u8[] = new Array<u8>(k)
  for (let j: i32 = 0; j < k; j++) {
    const o: i32 = k - 1 - j
    if (o >= 0 && o < toI32(out.length)) {
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

/**
 * `out = t - n` when the `count + 1`-limb value `t` (its top limb `top`, 0 or
 * 1) is at least `n`, else `out = t`, for `t` below 2n: the subtraction is
 * always done and the answer chosen by mask. `out` is not `t`.
 */
const rsaSignReduce = (out: u32[], t: u32[], top: u32, n: u32[], count: i32): void => {
  if (count < 1 || count > 128 || toI32(out.length) < 128 || toI32(t.length) < 128 || toI32(n.length) < 128) {
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
    toI32(out.length) < 128 ||
    toI32(b.length) < 128 ||
    count > 128 ||
    count < 1 ||
    toI32(t.length) < 130 ||
    toI32(a.length) < 128 ||
    toI32(n.length) < 128
  ) {
    return
  }
  for (let i: i32 = 0; i < count; i++) {
    // The first row reads `t` as zero, so no loop clears it first (one that
    // the compiler would make a `memset` call).
    const live: u64 = i === 0 ? 0 : 0xffffffff
    const bi: u64 = toU64(b[i])
    let carry: u64 = 0
    for (let j: i32 = 0; j < count; j++) {
      const s: u64 = (toU64(t[j]) & live) + toU64(a[j]) * bi + carry
      t[j] = toU32(s)
      carry = s >> 32
    }
    const top: u64 = (toU64(t[count]) & live) + carry
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
 * One step of the fixed window: `acc = acc^16 table[nibble] R^-1 mod n`. Four
 * squarings, then every entry of the 16-entry `table` (entry `j` at `j count`)
 * read in full and the one at `nibble` kept by a `ctEq` mask into `sel`, then
 * one multiplication: the same work and the same addresses for every nibble.
 */
const rsaSignWindowStep = (
  acc: u32[],
  table: u32[],
  sel: u32[],
  nibble: u32,
  n: u32[],
  n0inv: u32,
  t: u32[],
  count: i32
): void => {
  if (count < 1 || count > 128 || toI32(table.length) < 16 * count || toI32(sel.length) < 128) {
    return
  }
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

/**
 * R^2 mod n into `r`, by doubling 1 modulo `n` 64 count times; `t` is
 * scratch. The reduction is masked, so it may run on a secret prime.
 */
const rsaSignR2 = (r: u32[], n: u32[], t: u32[], count: i32): void => {
  if (toI32(n.length) < 128 || count > 128 || count < 1 || toI32(r.length) < 128 || toI32(t.length) < 130) {
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
 * `out = a + b mod n` for `a` and `b` below `n`: the sum into `t`, then the
 * masked subtraction of `rsaSignReduce`. `out` may be `a` or `b`; `t` is
 * neither.
 */
const rsaSignModAdd = (out: u32[], a: u32[], b: u32[], n: u32[], t: u32[], count: i32): void => {
  if (count < 1 || count > 128 || toI32(a.length) < 128 || toI32(b.length) < 128 || toI32(t.length) < 128) {
    return
  }
  let carry: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const s: u64 = toU64(a[i]) + toU64(b[i]) + carry
    t[i] = toU32(s)
    carry = s >> 32
  }
  rsaSignReduce(out, t, toU32(carry), n, count)
}

/**
 * `out = a - b mod n` for `a` and `b` below `n`: the difference into `t`, then
 * `n` added back under a `ctEq` mask of the borrow, never a branch. `out` may
 * be `a` or `b`; `t` is neither.
 */
const rsaSignModSub = (out: u32[], a: u32[], b: u32[], n: u32[], t: u32[], count: i32): void => {
  if (
    count < 1 ||
    count > 128 ||
    toI32(out.length) < 128 ||
    toI32(a.length) < 128 ||
    toI32(b.length) < 128 ||
    toI32(n.length) < 128 ||
    toI32(t.length) < 128
  ) {
    return
  }
  let borrow: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const d: u64 = toU64(a[i]) - toU64(b[i]) - borrow
    t[i] = toU32(d)
    borrow = (d >> 32) & 1
  }
  const back: u32 = ctEq(toU32(borrow), 1)
  let carry: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const s: u64 = toU64(t[i]) + toU64(n[i] & back) + carry
    out[i] = toU32(s)
    carry = s >> 32
  }
}

/** 1 when the `count`-limb `a` is below `b`, else 0: the borrow out of `a - b`, with no early exit. */
const rsaSignLess = (a: u32[], b: u32[], count: i32): u32 => {
  if (count < 1 || count > 128 || toI32(a.length) < 128 || toI32(b.length) < 128) {
    return 0
  }
  let borrow: u64 = 0
  for (let i: i32 = 0; i < count; i++) {
    const d: u64 = toU64(a[i]) - toU64(b[i]) - borrow
    borrow = (d >> 32) & 1
  }
  return toU32(borrow)
}

/**
 * `out = a b`, `2 count` limbs from two of `count`, by schoolbook rows of a
 * fixed length: the work depends on `count` alone. Each sum is at most
 * 2^64 - 1, as in `rsaSignMontMul`. `out` is neither `a` nor `b`.
 */
const rsaSignMul = (out: u32[], a: u32[], b: u32[], count: i32): void => {
  if (count < 1 || count > 64 || toI32(out.length) < 128 || toI32(a.length) < 128 || toI32(b.length) < 128) {
    return
  }
  for (let i: i32 = 0; i < 2 * count; i++) {
    out[i] = 0
  }
  for (let i: i32 = 0; i < count; i++) {
    const ai: u64 = toU64(a[i])
    let carry: u64 = 0
    for (let j: i32 = 0; j < count; j++) {
      const s: u64 = toU64(out[i + j]) + ai * toU64(b[j]) + carry
      out[i + j] = toU32(s)
      carry = s >> 32
    }
    out[i + count] = toU32(carry)
  }
}

/** The low `len` bytes of the limbs `a`, big-endian, written into `out` at `at`. */
const rsaSignStore = (out: u8[], at: i32, len: i32, a: u32[]): void => {
  if (at < 0 || len < 0 || len > 512 || toI32(a.length) < 128) {
    return
  }
  for (let j: i32 = 0; j < len; j++) {
    const o: i32 = at + len - 1 - j
    if (o >= 0 && o < toI32(out.length)) {
      out[o] = toU8(a[toI32(j / 4)] >> toU32((j & 3) << 3))
    }
  }
}

/**
 * Fills the Montgomery constants of the key bytes `key` (`rsaSignKeyBytes`)
 * from its own `n`, `p` and `q`, so that signing computes none of them: R^2
 * and R^3 mod `p` and mod `q` for R = 2^(32 c), and R^2 mod `n` for
 * R = 2^(32 ⌈k / 4⌉). R^2 is 1 doubled modulo the prime under `rsaSignReduce`'s
 * mask and R^3 one Montgomery product of R^2 with itself, so nothing branches
 * on `p` or `q`. Every limb array is wiped. A key of the wrong shape is left
 * as it is.
 */
const rsaSignPrecompute = (key: u8[]): void => {
  const k: i32 = rsaSignKeySize(key)
  const w: i32 = rsaSignHalfWidth(k)
  if (k < 256 || k > 512 || w < 4 || w > 256) {
    return
  }
  const count: i32 = toI32((k + 3) / 4)
  const c: i32 = toI32(w / 4)
  const x: u32[] = new Array<u32>(128)
  const r2: u32[] = new Array<u32>(128)
  const r3: u32[] = new Array<u32>(128)
  const t: u32[] = new Array<u32>(130)
  for (let half: i32 = 0; half < 2; half++) {
    rsaSignLimbs(x, key, 3 * k + half * w, w, c)
    rsaSignR2(r2, x, t, c)
    rsaSignMontMul(r3, r2, r2, x, rsaSignMontInverse(x[0]), t, c)
    rsaSignStore(key, 3 * k + (2 * half + 5) * w, w, r2)
    rsaSignStore(key, 3 * k + (2 * half + 6) * w, w, r3)
  }
  rsaSignLimbs(x, key, 0, k, count)
  rsaSignR2(r2, x, t, count)
  rsaSignStore(key, 3 * k + 9 * w, k, r2)
  wipe(x)
  wipe(r2)
  wipe(r3)
  wipe(t)
}

/**
 * 0 when the CRT values of the key bytes `key` hold together, nonzero
 * otherwise, with no branch on them: `p` and `q` odd, `dP` below `p`, `dQ`
 * below `q`, `qInv` below `p`, `p q = n` over every limb of the product, and
 * `q qInv = 1 mod p` (two Montgomery products: `q qInv R^-1`, then by R^2).
 * Every limb array is wiped.
 */
const rsaSignCrtSound = (key: u8[], k: i32): u32 => {
  const w: i32 = rsaSignHalfWidth(k)
  if (k < 256 || k > 512 || w < 4 || w > 256 || toI32(key.length) !== 4 * k + 9 * w) {
    return 1
  }
  const count: i32 = toI32((k + 3) / 4)
  const c: i32 = toI32(w / 4)
  const base: i32 = 3 * k
  const n: u32[] = new Array<u32>(128)
  rsaSignLimbs(n, key, 0, k, count)
  const p: u32[] = new Array<u32>(128)
  rsaSignLimbs(p, key, base, w, c)
  const q: u32[] = new Array<u32>(128)
  rsaSignLimbs(q, key, base + w, w, c)
  const dp: u32[] = new Array<u32>(128)
  rsaSignLimbs(dp, key, base + 2 * w, w, c)
  const dq: u32[] = new Array<u32>(128)
  rsaSignLimbs(dq, key, base + 3 * w, w, c)
  const qinv: u32[] = new Array<u32>(128)
  rsaSignLimbs(qinv, key, base + 4 * w, w, c)
  const r2p: u32[] = new Array<u32>(128)
  rsaSignLimbs(r2p, key, base + 5 * w, w, c)
  let bad: u32 = ((p[0] & 1) ^ 1) | ((q[0] & 1) ^ 1)
  bad = bad | (rsaSignLess(dp, p, c) ^ 1) | (rsaSignLess(dq, q, c) ^ 1) | (rsaSignLess(qinv, p, c) ^ 1)
  const prod: u32[] = new Array<u32>(128)
  rsaSignMul(prod, p, q, c)
  for (let l: i32 = 0; l < 2 * c; l++) {
    bad = bad | (prod[l] ^ (l < count ? n[l] : 0))
  }
  const t: u32[] = new Array<u32>(130)
  const p0inv: u32 = rsaSignMontInverse(p[0])
  rsaSignMontMul(prod, q, qinv, p, p0inv, t, c)
  rsaSignMontMul(prod, prod, r2p, p, p0inv, t, c)
  bad = bad | (prod[0] ^ 1)
  for (let l: i32 = 1; l < c; l++) {
    bad = bad | prod[l]
  }
  wipe(p)
  wipe(q)
  wipe(dp)
  wipe(dq)
  wipe(qinv)
  wipe(r2p)
  wipe(prod)
  wipe(t)
  return bad
}

/**
 * `acc = b^x R mod n` for `mm = b R mod n`, R = 2^(32 count): the 16 powers
 * `b^j R` into `table`, then the fixed 4-bit window over every nibble of the
 * `count` limbs of `x`, leading zeros included. `one` holds 1, `r2` R^2 mod n;
 * `entry` and `sel` are scratch.
 */
const rsaSignPow = (
  acc: u32[],
  mm: u32[],
  x: u32[],
  n: u32[],
  n0inv: u32,
  r2: u32[],
  one: u32[],
  table: u32[],
  entry: u32[],
  sel: u32[],
  t: u32[],
  count: i32
): void => {
  if (
    count < 1 ||
    count > 128 ||
    toI32(table.length) < 16 * count ||
    toI32(acc.length) < 128 ||
    toI32(x.length) < 128 ||
    toI32(entry.length) < 128
  ) {
    return
  }
  rsaSignMontMul(entry, one, r2, n, n0inv, t, count)
  for (let j: i32 = 0; j < 16; j++) {
    for (let l: i32 = 0; l < count; l++) {
      table[j * count + l] = entry[l]
    }
    rsaSignMontMul(entry, entry, mm, n, n0inv, t, count)
  }
  for (let l: i32 = 0; l < count; l++) {
    acc[l] = table[l]
  }
  for (let nib: i32 = 8 * count - 1; nib >= 0; nib--) {
    const nibble: u32 = (x[toI32(nib / 8)] >> toU32((nib & 7) * 4)) & 15
    rsaSignWindowStep(acc, table, sel, nibble, n, n0inv, t, count)
  }
}

/**
 * One half of the CRT: `acc = m^dx R mod x` for the prime `x` of `c` limbs,
 * its exponent `dx`, its R^2 and R^3 (R = 2^(32 c)), and the `count`-limb
 * `m`. `m R mod x` is `mh R^3 + ml R^2`, each Montgomery-multiplied by R^-1,
 * for m = mh R + ml with both halves below R: no division by the secret
 * prime. `table`, `entry`, `mm` and `sel` are scratch.
 */
const rsaSignHalf = (
  acc: u32[],
  m: u32[],
  x: u32[],
  r2: u32[],
  r3: u32[],
  dx: u32[],
  one: u32[],
  table: u32[],
  entry: u32[],
  mm: u32[],
  sel: u32[],
  t: u32[],
  count: i32,
  c: i32
): void => {
  if (
    c < 1 ||
    c > 64 ||
    count < c ||
    count > 2 * c ||
    toI32(m.length) < 128 ||
    toI32(entry.length) < 128 ||
    toI32(sel.length) < 128 ||
    toI32(x.length) < 128
  ) {
    return
  }
  const x0inv: u32 = rsaSignMontInverse(x[0])
  for (let l: i32 = 0; l < c; l++) {
    sel[l] = m[l]
    const h: i32 = c + l
    entry[l] = h < count ? m[h] : 0
  }
  rsaSignMontMul(mm, entry, r3, x, x0inv, t, c)
  rsaSignMontMul(acc, sel, r2, x, x0inv, t, c)
  rsaSignModAdd(mm, mm, acc, x, t, c)
  rsaSignPow(acc, mm, dx, x, x0inv, r2, one, table, entry, sel, t, c)
}

/**
 * 0 when `s^e mod n` is `m`, nonzero otherwise, for the plain `s` below R and
 * the `count`-limb `e`. `e`, `s` and `m` are public, so square and multiply
 * may branch on the exponent's bits. `entry` and `mm` are scratch.
 */
const rsaSignOpens = (
  s: u32[],
  m: u32[],
  el: u32[],
  n: u32[],
  n0inv: u32,
  r2: u32[],
  one: u32[],
  entry: u32[],
  mm: u32[],
  t: u32[],
  count: i32
): u32 => {
  if (
    count < 1 ||
    count > 128 ||
    toI32(m.length) < 128 ||
    toI32(el.length) < 128 ||
    toI32(entry.length) < 128 ||
    toI32(mm.length) < 128
  ) {
    return 1
  }
  rsaSignMontMul(mm, s, r2, n, n0inv, t, count)
  for (let l: i32 = 0; l < count; l++) {
    entry[l] = mm[l]
  }
  let started: boolean = false
  for (let bit: i32 = 32 * count - 1; bit >= 0; bit--) {
    const set: u32 = (el[toI32(bit / 32)] >> toU32(bit & 31)) & 1
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
  let differ: u32 = started ? 0 : 1
  for (let l: i32 = 0; l < count; l++) {
    differ = differ | (entry[l] ^ m[l])
  }
  return differ
}

/**
 * RSASP1 under the key bytes `key` (`rsaSignKeyBytes`) by the CRT (RFC 8017
 * §5.2.1, step 2b): `s1 = m^dP mod p` and `s2 = m^dQ mod q`, each a fixed
 * 4-bit window over every nibble of a half-length exponent modulo a
 * half-length prime, then `h = (s1 - s2) qInv mod p` and `s = s2 + q h`, for
 * the `k`-byte `m` below `n`. The answer is raised to `e` and compared with
 * `m`, its limbs past `n`'s and its value against `n` checked too, before any
 * byte of it is returned, so a fault in either half, which would give a value
 * right modulo one prime and wrong modulo the other and so factor `n`
 * (Bellcore), answers `null`. `null` too for a key of the wrong shape and an
 * `m` of the wrong length or not below `n`. Every limb array that held a
 * prime, an exponent, a constant made from a prime or a power of `m` is
 * wiped.
 */
const rsaSignPrivateOp = (key: u8[], m: u8[]): u8[] | null => {
  const k: i32 = rsaSignKeySize(key)
  const w: i32 = rsaSignHalfWidth(k)
  if (
    k < 256 ||
    k > 512 ||
    w < 4 ||
    w > 256 ||
    toI32(m.length) !== k ||
    toI32(key.length) < k ||
    (toI32(key[k - 1]) & 1) === 0
  ) {
    return null
  }
  const count: i32 = toI32((k + 3) / 4)
  const c: i32 = toI32(w / 4)
  const base: i32 = 3 * k
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
  const p: u32[] = new Array<u32>(128)
  rsaSignLimbs(p, key, base, w, c)
  const q: u32[] = new Array<u32>(128)
  rsaSignLimbs(q, key, base + w, w, c)
  const dp: u32[] = new Array<u32>(128)
  rsaSignLimbs(dp, key, base + 2 * w, w, c)
  const dq: u32[] = new Array<u32>(128)
  rsaSignLimbs(dq, key, base + 3 * w, w, c)
  const qinv: u32[] = new Array<u32>(128)
  rsaSignLimbs(qinv, key, base + 4 * w, w, c)
  const r2p: u32[] = new Array<u32>(128)
  rsaSignLimbs(r2p, key, base + 5 * w, w, c)
  const r3p: u32[] = new Array<u32>(128)
  rsaSignLimbs(r3p, key, base + 6 * w, w, c)
  const r2q: u32[] = new Array<u32>(128)
  rsaSignLimbs(r2q, key, base + 7 * w, w, c)
  const r3q: u32[] = new Array<u32>(128)
  rsaSignLimbs(r3q, key, base + 8 * w, w, c)
  const r2n: u32[] = new Array<u32>(128)
  rsaSignLimbs(r2n, key, base + 9 * w, k, count)
  const one: u32[] = new Array<u32>(128)
  one[0] = 1
  const t: u32[] = new Array<u32>(130)
  // table[j] = m^j R mod p (then mod q), j = 0 to 15, one after another.
  const table: u32[] = new Array<u32>(1024)
  const entry: u32[] = new Array<u32>(128)
  const mm: u32[] = new Array<u32>(128)
  const sel: u32[] = new Array<u32>(128)
  const sp: u32[] = new Array<u32>(128)
  const sq: u32[] = new Array<u32>(128)
  rsaSignHalf(sp, ml, p, r2p, r3p, dp, one, table, entry, mm, sel, t, count, c)
  rsaSignHalf(sq, ml, q, r2q, r3q, dq, one, table, entry, mm, sel, t, count, c)
  const p0inv: u32 = rsaSignMontInverse(p[0])
  // s2 out of Montgomery form mod q, then into it mod p (s2 < q < R).
  rsaSignMontMul(sq, sq, one, q, rsaSignMontInverse(q[0]), t, c)
  rsaSignMontMul(entry, sq, r2p, p, p0inv, t, c)
  // h = (s1 - s2) qInv mod p: the R of s1 R - s2 R cancels in the product.
  rsaSignModSub(entry, sp, entry, p, t, c)
  rsaSignMontMul(entry, entry, qinv, p, p0inv, t, c)
  // s = s2 + q h, below n, in at most 2 c limbs.
  const s: u32[] = new Array<u32>(128)
  rsaSignMul(s, entry, q, c)
  let carry: u64 = 0
  for (let l: i32 = 0; l < 2 * c; l++) {
    const v: u64 = toU64(s[l]) + toU64(l < c ? sq[l] : toU32(0)) + carry
    s[l] = toU32(v)
    carry = v >> 32
  }
  // The check: no limb past n's, s below n, and s^e mod n is m.
  let differ: u32 = toU32(carry) | (rsaSignLess(s, n, count) ^ 1)
  for (let l: i32 = count; l < 2 * c; l++) {
    differ = differ | s[l]
  }
  const el: u32[] = new Array<u32>(128)
  rsaSignLimbs(el, key, 2 * k, k, count)
  differ = differ | rsaSignOpens(s, ml, el, n, rsaSignMontInverse(n[0]), r2n, one, entry, mm, t, count)
  const ok: boolean = differ === 0
  const signature: u8[] = ok ? rsaSignBytes(s, k) : []
  wipe(p)
  wipe(q)
  wipe(dp)
  wipe(dq)
  wipe(qinv)
  wipe(r2p)
  wipe(r3p)
  wipe(r2q)
  wipe(r3q)
  wipe(t)
  wipe(table)
  wipe(entry)
  wipe(mm)
  wipe(sel)
  wipe(sp)
  wipe(sq)
  wipe(s)
  if (!ok) {
    return null
  }
  return signature
}

/**
 * Whether `m^d mod n`, by the fixed 4-bit window over every nibble of the
 * `⌈k / 4⌉` limbs of `d`, opens to `m` under `e`: the load's check that `d`,
 * which signing no longer reads but the salt does, is `e`'s inverse. It is
 * run once per key, never per signature. Every limb array that held `d` or a
 * power of `m` is wiped.
 */
const rsaSignFullOpens = (key: u8[], m: u8[]): boolean => {
  const k: i32 = rsaSignKeySize(key)
  const w: i32 = rsaSignHalfWidth(k)
  if (k < 256 || k > 512 || w < 4 || w > 256 || toI32(m.length) !== k) {
    return false
  }
  const count: i32 = toI32((k + 3) / 4)
  const n: u32[] = new Array<u32>(128)
  rsaSignLimbs(n, key, 0, k, count)
  const ml: u32[] = new Array<u32>(128)
  rsaSignLimbs(ml, m, 0, k, count)
  const dl: u32[] = new Array<u32>(128)
  rsaSignLimbs(dl, key, k, k, count)
  const el: u32[] = new Array<u32>(128)
  rsaSignLimbs(el, key, 2 * k, k, count)
  const r2n: u32[] = new Array<u32>(128)
  rsaSignLimbs(r2n, key, 3 * k + 9 * w, k, count)
  const one: u32[] = new Array<u32>(128)
  one[0] = 1
  const n0inv: u32 = rsaSignMontInverse(n[0])
  const t: u32[] = new Array<u32>(130)
  const table: u32[] = new Array<u32>(2048)
  const entry: u32[] = new Array<u32>(128)
  const mm: u32[] = new Array<u32>(128)
  const sel: u32[] = new Array<u32>(128)
  const acc: u32[] = new Array<u32>(128)
  rsaSignMontMul(mm, ml, r2n, n, n0inv, t, count)
  rsaSignPow(acc, mm, dl, n, n0inv, r2n, one, table, entry, sel, t, count)
  rsaSignMontMul(acc, acc, one, n, n0inv, t, count)
  const differ: u32 = rsaSignOpens(acc, ml, el, n, n0inv, r2n, one, entry, mm, t, count)
  wipe(dl)
  wipe(t)
  wipe(table)
  wipe(entry)
  wipe(mm)
  wipe(sel)
  wipe(acc)
  return differ === 0
}
