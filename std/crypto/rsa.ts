/**
 * `nish/crypto/rsa` — RSA signature verification: RSASSA-PKCS1-v1_5 and
 * RSASSA-PSS (RFC 8017) with SHA-256, SHA-384 and SHA-512, the schemes TLS
 * certificates and handshakes sign with.
 *
 *     import { RSA_SHA256, RsaPublicKey, rsaParsePublicKey, rsaVerifyPkcs1 } from "nish/crypto/rsa";
 *
 *     const key: RsaPublicKey | null = rsaParsePublicKey(spki);
 *     const ok: boolean = key !== null && rsaVerifyPkcs1(key, RSA_SHA256, message, sig);
 *
 * A key comes in as the DER SubjectPublicKeyInfo of RFC 5280 §4.1.2.7 that a
 * certificate carries, with the algorithm rsaEncryption (RFC 8017 A.1: the
 * parameters NULL) or id-RSASSA-PSS (RFC 4055 §3.1: the parameters absent or
 * a SEQUENCE), and the key the RSAPublicKey of RFC 8017 A.1.1. The DER is
 * read strictly: definite minimal lengths, positive minimal INTEGERs, nothing
 * after the last element. The modulus is 2048 to 8192 bits and the exponent
 * odd, at least 3 and at most 2^32; anything else is `null`. A PSS key's
 * parameters are not read: its signatures verify with whichever hash the
 * caller names, the PSS rules below, and `rsaVerifyPkcs1` refuses the key.
 *
 * A signature is the modulus's length in big-endian bytes, as RFC 8017
 * §8.2.2 and §8.1.2 take it; a signature of another length, or one that is
 * not below the modulus, answers `false`, as does an unknown hash id. Nothing
 * here panics on what an attacker sends.
 *
 * **PKCS#1 v1.5** (§8.2.2) encodes the expected message whole — 00 01, the
 * padding FF bytes, 00, the hash's DigestInfo and the digest (§9.2) — and
 * compares it with the opened signature byte for byte. Nothing parses the
 * DigestInfo, so there is no ASN.1 in the signature for a forgery to hide in
 * (the Bleichenbacher 2006 class of attack).
 *
 * **PSS** (§8.1.2, §9.1.2) uses MGF1 with the message's hash and a salt as
 * long as the digest, the parameters TLS 1.3's rsa_pss_* schemes and the
 * Web PKI fix. A signature made with another salt length or MGF hash answers
 * `false`.
 *
 * Every value here — the key, the message and the signature — is public, so
 * the module runs on `nish/crypto/bignum`'s variable-time arithmetic. There
 * is no signing and no decryption, and so no private key.
 *
 * Written for this module from RFC 8017; nothing is ported.
 */
import { sha256 } from "nish/crypto/sha256"
import { sha384, sha512 } from "nish/crypto/sha512"
import { timingSafeEqual } from "nish/crypto/ct"
import { copyBytes, setU32BE } from "nish/bytes"
import {
  BnModulus,
  bnCompare,
  bnFromBytes,
  bnFromMont,
  bnModulus,
  bnMontPow,
  bnToBytes,
  bnToMont,
} from "nish/crypto/bignum"

/** The hash id of SHA-256, for `rsaVerifyPkcs1` and `rsaVerifyPss`. */
export const RSA_SHA256: i32 = 0

/** The hash id of SHA-384. */
export const RSA_SHA384: i32 = 1

/** The hash id of SHA-512. */
export const RSA_SHA512: i32 = 2

/** The smallest modulus accepted, in bits. */
export const RSA_MIN_BITS: i32 = 2048

/** The largest modulus accepted, in bits. */
export const RSA_MAX_BITS: i32 = 8192

/** An RSA public key that `rsaParsePublicKey` accepted. */
export class RsaPublicKey {
  /** The modulus n with its Montgomery constants. */
  modulus: BnModulus
  /** The modulus's length in bytes: every signature's length. */
  size: i32
  /** The modulus's length in bits, 2048 to 8192. */
  bits: i32
  /** The public exponent e, as two limbs. */
  exponent: u32[]
  /** Whether the key came as id-RSASSA-PSS, which signs with PSS only. */
  pssOnly: boolean

  constructor(modulus: BnModulus, size: i32, bits: i32, exponent: u32[], pssOnly: boolean) {
    this.modulus = modulus
    this.size = size
    this.bits = bits
    this.exponent = exponent
    this.pssOnly = pssOnly
  }
}

/** A position in DER being read, and the end it may not pass. */
class RsaDerCursor {
  at: i32
  end: i32

  constructor(at: i32, end: i32) {
    this.at = at
    this.end = end
  }
}

/**
 * The content length of the element at the cursor, which must have the tag
 * `tag`, with the cursor moved past its header; or -1 for another tag, a
 * length that is indefinite, longer than two bytes or not minimal, or content
 * that runs past the cursor's end.
 */
const rsaDerElement = (der: u8[], c: RsaDerCursor, tag: i32): i32 => {
  if (c.end - c.at < 2 || toI32(der[c.at]) !== tag) {
    return -1
  }
  const first: i32 = toI32(der[c.at + 1])
  let length: i32 = first
  let header: i32 = 2
  if (first === 0x81) {
    if (c.end - c.at < 3) {
      return -1
    }
    length = toI32(der[c.at + 2])
    header = 3
    if (length < 0x80) {
      return -1
    }
  } else if (first === 0x82) {
    if (c.end - c.at < 4) {
      return -1
    }
    length = toI32(der[c.at + 2]) * 256 + toI32(der[c.at + 3])
    header = 4
    if (length < 0x100) {
      return -1
    }
  } else if (first >= 0x80) {
    return -1
  }
  if (length > c.end - c.at - header) {
    return -1
  }
  c.at = c.at + header
  return length
}

/**
 * Whether the element at the cursor is tagged `tag` and runs exactly to the
 * cursor's end, with the cursor moved into its content.
 */
const rsaDerWhole = (der: u8[], c: RsaDerCursor, tag: i32): boolean => {
  const length: i32 = rsaDerElement(der, c, tag)
  return length >= 0 && length === c.end - c.at
}

/**
 * The magnitude of the positive INTEGER at the cursor, without its sign byte,
 * with the cursor moved past it; or an empty array for another tag, a bad
 * length, a negative value, zero, or a leading byte DER forbids.
 */
const rsaDerPositive = (der: u8[], c: RsaDerCursor): u8[] => {
  const out: u8[] = []
  const length: i32 = rsaDerElement(der, c, 0x02)
  if (length < 1) {
    return out
  }
  let at: i32 = c.at
  const end: i32 = c.at + length
  c.at = end
  if (toI32(der[at]) >= 0x80) {
    return out
  }
  if (toI32(der[at]) === 0) {
    if (length === 1 || toI32(der[at + 1]) < 0x80) {
      return out
    }
    at = at + 1
  }
  const value: u8[] = new Array<u8>(end - at)
  copyBytes(value, 0, der, at, end - at)
  return value
}

/**
 * Whether the nine bytes at `at` are the OID content 1.2.840.113549.1.1.`last`
 * (PKCS #1): `last` 1 is rsaEncryption and 10 is id-RSASSA-PSS.
 */
const rsaIsPkcs1Oid = (der: u8[], at: i32, last: i32): boolean => {
  const oid: u8[] = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01]
  for (let i: i32 = 0; i < 8; i++) {
    if (der[at + i] !== oid[i]) {
      return false
    }
  }
  return toI32(der[at + 8]) === last
}

/**
 * The RSA public key a DER SubjectPublicKeyInfo holds, or `null` when it is
 * not one this module verifies with: DER that is not strict, an algorithm
 * other than rsaEncryption with NULL parameters or id-RSASSA-PSS with none
 * or a SEQUENCE, a BIT STRING with unused bits, a modulus that is even or
 * outside 2048 to 8192 bits, or an exponent that is even, below 3 or above
 * 2^32.
 */
export const rsaParsePublicKey = (spki: u8[]): RsaPublicKey | null => {
  const c = new RsaDerCursor(0, toI32(spki.length))
  if (!rsaDerWhole(spki, c, 0x30)) {
    return null
  }
  const spkiEnd: i32 = c.end
  // AlgorithmIdentifier: the OID, then its parameters.
  const algLength: i32 = rsaDerElement(spki, c, 0x30)
  if (algLength < 0) {
    return null
  }
  const algEnd: i32 = c.at + algLength
  c.end = algEnd
  if (rsaDerElement(spki, c, 0x06) !== 9) {
    return null
  }
  const oidAt: i32 = c.at
  c.at = c.at + 9
  let pssOnly: boolean = false
  if (rsaIsPkcs1Oid(spki, oidAt, 1)) {
    if (rsaDerElement(spki, c, 0x05) !== 0 || c.at !== algEnd) {
      return null
    }
  } else if (rsaIsPkcs1Oid(spki, oidAt, 10)) {
    pssOnly = true
    if (c.at !== algEnd && !rsaDerWhole(spki, c, 0x30)) {
      return null
    }
  } else {
    return null
  }
  // subjectPublicKey: a BIT STRING with no unused bits around RSAPublicKey.
  c.at = algEnd
  c.end = spkiEnd
  if (!rsaDerWhole(spki, c, 0x03) || c.at === c.end || toI32(spki[c.at]) !== 0) {
    return null
  }
  c.at = c.at + 1
  if (!rsaDerWhole(spki, c, 0x30)) {
    return null
  }
  const n: u8[] = rsaDerPositive(spki, c)
  const e: u8[] = rsaDerPositive(spki, c)
  if (toI32(n.length) === 0 || toI32(e.length) === 0 || c.at !== c.end) {
    return null
  }
  return rsaPublicKeyFrom(n, e, pssOnly)
}

/**
 * The key with the modulus `n` and exponent `e`, positive big-endian
 * magnitudes with no leading zero, or `null` past the limits
 * `rsaParsePublicKey` names.
 */
const rsaPublicKeyFrom = (n: u8[], e: u8[], pssOnly: boolean): RsaPublicKey | null => {
  const size: i32 = toI32(n.length)
  let bits: i32 = size * 8
  for (let top: i32 = toI32(n[0]); top < 0x80; top = top * 2) {
    bits = bits - 1
  }
  if (bits < RSA_MIN_BITS || bits > RSA_MAX_BITS) {
    return null
  }
  const eLength: i32 = toI32(e.length)
  if (eLength > 5 || (toI32(e[eLength - 1]) & 1) === 0) {
    return null
  }
  const exponent: u32[] = bnFromBytes(e, 0, eLength, 2)
  const three: u32 = 3
  const one: u32 = 1
  if (
    exponent[1] > one ||
    (exponent[1] === one && exponent[0] !== 0) ||
    (exponent[1] === 0 && exponent[0] < three)
  ) {
    return null
  }
  const modulus: BnModulus | null = bnModulus(bnFromBytes(n, 0, size, (size + 3) >> 2))
  if (modulus === null) {
    return null
  }
  return new RsaPublicKey(modulus, size, bits, exponent, pssOnly)
}

/** The digest of `msg` under the hash `hashId`, or an empty array for an unknown id. */
const rsaHash = (hashId: i32, msg: u8[]): u8[] => {
  if (hashId === RSA_SHA256) {
    return sha256(msg)
  }
  if (hashId === RSA_SHA384) {
    return sha384(msg)
  }
  if (hashId === RSA_SHA512) {
    return sha512(msg)
  }
  return []
}

/**
 * The signature `sig` raised to the key's exponent, as the modulus's length
 * in bytes (RFC 8017 §5.2.2 RSAVP1 between OS2IP and I2OSP), or an empty
 * array when `sig` is the wrong length or not below the modulus.
 */
const rsaOpen = (key: RsaPublicKey, sig: u8[]): u8[] => {
  if (toI32(sig.length) !== key.size) {
    return []
  }
  const mod: BnModulus = key.modulus
  const s: u32[] = bnFromBytes(sig, 0, key.size, mod.limbs)
  if (bnCompare(s, mod.m) >= 0) {
    return []
  }
  bnToMont(s, s, mod)
  bnMontPow(s, s, key.exponent, mod)
  bnFromMont(s, s, mod)
  return bnToBytes(s, key.size)
}

/**
 * The DER DigestInfo of RFC 8017 §9.2 note 1, up to the digest, for a
 * SHA-2 digest of `hLength` bytes (32, 48 or 64). The three differ only in
 * the outer length, the last arc of the hash's OID (2.16.840.1.101.3.4.2.1,
 * .2 or .3) and the digest's length.
 */
const rsaDigestInfoPrefix = (hLength: i32): u8[] => {
  const prefix: u8[] = [
    0x30, 0x00, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x00, 0x05, 0x00,
    0x04, 0x00,
  ]
  prefix[1] = toU8(hLength + 17)
  prefix[14] = toU8((hLength - 16) >> 4)
  prefix[18] = toU8(hLength)
  return prefix
}

/**
 * Whether `sig` is an RSASSA-PKCS1-v1_5 signature of `msg` under `key` with
 * the hash `hashId` (RFC 8017 §8.2.2): the opened signature must equal the
 * EMSA-PKCS1-v1_5 encoding of the message's digest, every byte. A key that
 * came as id-RSASSA-PSS, an unknown hash id, and a signature of the wrong
 * length or not below the modulus all answer `false`.
 */
export const rsaVerifyPkcs1 = (key: RsaPublicKey, hashId: i32, msg: u8[], sig: u8[]): boolean => {
  if (key.pssOnly) {
    return false
  }
  const digest: u8[] = rsaHash(hashId, msg)
  if (toI32(digest.length) === 0) {
    return false
  }
  const em: u8[] = rsaOpen(key, sig)
  if (toI32(em.length) === 0) {
    return false
  }
  // EM = 00 01 FF .. FF 00 DigestInfo digest, the FF run filling the rest.
  const hLength: i32 = toI32(digest.length)
  const prefix: u8[] = rsaDigestInfoPrefix(hLength)
  const pLength: i32 = toI32(prefix.length)
  const ff: u8 = 0xff
  const expected: u8[] = new Array<u8>(key.size)
  expected[1] = 0x01
  for (let i: i32 = 2; i < key.size - pLength - hLength - 1; i++) {
    expected[i] = ff
  }
  copyBytes(expected, key.size - hLength - pLength, prefix, 0, pLength)
  copyBytes(expected, key.size - hLength, digest, 0, hLength)
  return timingSafeEqual(em, expected)
}

/**
 * The first `length` bytes of MGF1 (RFC 8017 B.2.1) of `seed` with the hash
 * `hashId`: the digests of `seed` followed by a 32-bit counter, from 0.
 */
const rsaMgf1 = (hashId: i32, seed: u8[], length: i32): u8[] => {
  const out: u8[] = []
  const at: i32 = toI32(seed.length)
  const block: u8[] = new Array<u8>(at + 4)
  copyBytes(block, 0, seed, 0, at)
  for (let counter: u32 = 0; toI32(out.length) < length; counter++) {
    setU32BE(block, at, counter)
    const digest: u8[] = rsaHash(hashId, block)
    for (let i: i32 = 0; i < toI32(digest.length) && toI32(out.length) < length; i++) {
      out.push(digest[i])
    }
  }
  return out
}

/**
 * Whether `sig` is an RSASSA-PSS signature of `msg` under `key` with the
 * hash `hashId` (RFC 8017 §8.1.2, EMSA-PSS-VERIFY of §9.1.2), MGF1 with the
 * same hash and a salt as long as the digest. An unknown hash id, a
 * signature of the wrong length or not below the modulus, and every
 * encoding check of §9.1.2 that fails answer `false`.
 */
export const rsaVerifyPss = (key: RsaPublicKey, hashId: i32, msg: u8[], sig: u8[]): boolean => {
  const mHash: u8[] = rsaHash(hashId, msg)
  const hLength: i32 = toI32(mHash.length)
  if (hLength === 0) {
    return false
  }
  const opened: u8[] = rsaOpen(key, sig)
  if (toI32(opened.length) === 0) {
    return false
  }
  // emBits = modBits - 1; when that is a whole number of bytes the encoded
  // message is a byte shorter than the modulus, and the opened top byte must
  // be zero (§8.1.2 step 2c).
  const emBits: i32 = key.bits - 1
  const emLength: i32 = (emBits + 7) >> 3
  const skip: i32 = key.size - emLength
  if (skip === 1 && toI32(opened[0]) !== 0) {
    return false
  }
  const sLength: i32 = hLength
  if (emLength < hLength + sLength + 2 || toI32(opened[key.size - 1]) !== 0xbc) {
    return false
  }
  const dbLength: i32 = emLength - hLength - 1
  // The leftmost 8 emLen - emBits bits of maskedDB must be zero.
  const full: i32 = 0xff
  const topMask: i32 = full >> (emLength * 8 - emBits)
  if ((toI32(opened[skip]) & (full ^ topMask)) !== 0) {
    return false
  }
  const h: u8[] = new Array<u8>(hLength)
  copyBytes(h, 0, opened, skip + dbLength, hLength)
  const db: u8[] = rsaMgf1(hashId, h, dbLength)
  for (let i: i32 = 0; i < dbLength; i++) {
    db[i] = db[i] ^ opened[skip + i]
  }
  db[0] = toU8(toI32(db[0]) & topMask)
  // DB = PS (zeros) || 0x01 || salt.
  const psLength: i32 = dbLength - sLength - 1
  for (let i: i32 = 0; i < psLength; i++) {
    if (toI32(db[i]) !== 0) {
      return false
    }
  }
  if (toI32(db[psLength]) !== 1) {
    return false
  }
  // H' = Hash(00 x 8 || mHash || salt).
  const mPrime: u8[] = new Array<u8>(8 + hLength + sLength)
  copyBytes(mPrime, 8, mHash, 0, hLength)
  copyBytes(mPrime, 8 + hLength, db, dbLength - sLength, sLength)
  return timingSafeEqual(rsaHash(hashId, mPrime), h)
}
