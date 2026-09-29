/**
 * `nish/crypto/hkdf` — HKDF as RFC 5869 defines it, over HMAC-SHA-256 and
 * HMAC-SHA-384.
 *
 * Two steps, each its own function, because TLS 1.3 calls them separately:
 *
 *     PRK = HKDF-Extract(salt, IKM)  = HMAC-Hash(salt, IKM)                    (§2.2)
 *     OKM = HKDF-Expand(PRK, info, L) = T(1) | T(2) | … truncated to L bytes   (§2.3)
 *     T(i) = HMAC-Hash(PRK, T(i-1) | info | i),  T(0) empty,  i one byte
 *
 *     import { hkdfExtractSha256, hkdfExpandSha256 } from "nish/crypto/hkdf";
 *
 *     const prk: u8[] = hkdfExtractSha256(salt, secret);
 *     const okm: u8[] | null = hkdfExpandSha256(prk, info, 42);
 *
 * The counter `i` is one byte, so `L` is at most 255 × HashLen (§2.3): 8160
 * bytes for SHA-256 and 12240 for SHA-384. A longer `L`, or a negative one,
 * answers `null` rather than panicking, because `L` usually comes from a
 * protocol field; `L = 0` answers an empty array.
 *
 * HKDF-Expand-Label, TLS 1.3's wrapper around `expand`, belongs with TLS and is
 * not here. Written from RFC 5869, not ported from another implementation.
 */
import { HmacSha256, HmacSha384, hmacSha256, hmacSha384 } from "nish/crypto/hmac"
import { SHA256_SIZE } from "nish/crypto/sha256"
import { SHA384_SIZE } from "nish/crypto/sha512"

/** The largest block counter, and so the most blocks `expand` can make (RFC 5869 §2.3). */
const HKDF_MAX_BLOCKS: i32 = 255

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const HKDF_FROM: i32 = 0

/**
 * The salt `extract` keys HMAC with: `salt` itself, or HashLen zero bytes when
 * it is empty (RFC 5869 §2.2, "if not provided"). HMAC zero-pads a short key to
 * a block anyway, so the two give one PRK; the zeros are written out so the
 * code says what the RFC says.
 */
const hkdfSalt = (salt: u8[], hashLen: i32): u8[] =>
  toI32(salt.length) === 0 ? new Array<u8>(hashLen) : salt

/**
 * Copies `block[0 .. n)` to `out[at .. at + n)`, where `n` is as much of the
 * block as `out` still has room for. Answers the new fill of `out`.
 */
const hkdfAppend = (out: u8[], at: i32, block: u8[]): i32 => {
  const outLength: i32 = toI32(out.length)
  const blockLength: i32 = toI32(block.length)
  let k: i32 = 0
  while (k < blockLength && at + k < outLength) {
    out[at + k] = block[k]
    k += 1
  }
  return at + k
}

/** HKDF-Extract with HMAC-SHA-256 (RFC 5869 §2.2): the 32-byte PRK. */
export const hkdfExtractSha256 = (salt: u8[], ikm: u8[]): u8[] => hmacSha256(hkdfSalt(salt, SHA256_SIZE), ikm)

/** HKDF-Extract with HMAC-SHA-384 (RFC 5869 §2.2): the 48-byte PRK. */
export const hkdfExtractSha384 = (salt: u8[], ikm: u8[]): u8[] => hmacSha384(hkdfSalt(salt, SHA384_SIZE), ikm)

/**
 * HKDF-Expand with HMAC-SHA-256 (RFC 5869 §2.3): `length` bytes of output
 * keying material from `prk` and `info`, or `null` when `length` is negative
 * or past 255 × 32.
 */
export const hkdfExpandSha256 = (prk: u8[], info: u8[], length: i32): u8[] | null => {
  if (length < 0 || length > HKDF_MAX_BLOCKS * SHA256_SIZE) {
    return null
  }
  const out: u8[] = new Array<u8>(length)
  const counter: u8[] = new Array<u8>(1)
  const counterLength: i32 = 1
  let previous: u8[] = []
  let at: i32 = 0
  let i: i32 = 1
  while (at < length) {
    const mac = new HmacSha256(prk)
    mac.update(previous, HKDF_FROM, toI32(previous.length))
    mac.update(info, HKDF_FROM, toI32(info.length))
    counter[0] = toU8(i)
    mac.update(counter, HKDF_FROM, counterLength)
    previous = mac.digest()
    at = hkdfAppend(out, at, previous)
    i += 1
  }
  return out
}

/**
 * HKDF-Expand with HMAC-SHA-384 (RFC 5869 §2.3): `length` bytes of output
 * keying material from `prk` and `info`, or `null` when `length` is negative
 * or past 255 × 48.
 */
export const hkdfExpandSha384 = (prk: u8[], info: u8[], length: i32): u8[] | null => {
  if (length < 0 || length > HKDF_MAX_BLOCKS * SHA384_SIZE) {
    return null
  }
  const out: u8[] = new Array<u8>(length)
  const counter: u8[] = new Array<u8>(1)
  const counterLength: i32 = 1
  let previous: u8[] = []
  let at: i32 = 0
  let i: i32 = 1
  while (at < length) {
    const mac = new HmacSha384(prk)
    mac.update(previous, HKDF_FROM, toI32(previous.length))
    mac.update(info, HKDF_FROM, toI32(info.length))
    counter[0] = toU8(i)
    mac.update(counter, HKDF_FROM, counterLength)
    previous = mac.digest()
    at = hkdfAppend(out, at, previous)
    i += 1
  }
  return out
}
