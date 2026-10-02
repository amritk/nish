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
 * protocol field; `L = 0` answers an empty array. So does an `info` longer
 * than 2^31 - 1 bytes, which `toI32` would cut to a prefix under
 * `--number-mode f64`, so that two `info`s sharing it gave one key, and a PRK
 * shorter than HashLen, which §2.3 does not allow: an empty one is a key
 * anybody can compute with.
 *
 * HKDF-Expand-Label is TLS 1.3's wrapper around `expand` (RFC 8446 §7.1), and
 * QUIC derives its packet keys with it too (RFC 9001 §5.1), so it is here once
 * for both rather than in each:
 *
 *     HKDF-Expand-Label(Secret, Label, Context, Length) =
 *         HKDF-Expand(Secret, HkdfLabel, Length)
 *     struct {
 *         uint16 length = Length;
 *         opaque label<7..255> = "tls13 " + Label;
 *         opaque context<0..255> = Context;
 *     } HkdfLabel;
 *
 *     const key: u8[] = hkdfExpandLabelSha256(secret, "quic key", [], 16);
 *
 * `label` is given without the `"tls13 "` prefix, which the function adds. Its
 * arguments come from the program rather than from the peer — a label is a
 * literal, a length a key or hash size, a context a transcript hash — so one
 * out of range is a bug in the caller, and it panics rather than answering
 * `null`: a length below 0 or above 255, a label empty or longer than 249
 * bytes (the struct's 7 to 255 less the prefix), a context longer than 255
 * bytes, and a secret shorter than HashLen.
 *
 * Written from RFC 5869 and RFC 8446 §7.1, not ported from another
 * implementation.
 */
import { HmacSha256, HmacSha384, hmacSha256, hmacSha384 } from "nish/crypto/hmac"
import { SHA256_SIZE } from "nish/crypto/sha256"
import { SHA384_SIZE } from "nish/crypto/sha512"

/** The largest block counter, and so the most blocks `expand` can make (RFC 5869 §2.3). */
const HKDF_MAX_BLOCKS: i32 = 255

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const HKDF_FROM: i32 = 0

/** What HKDF-Expand-Label puts before every label (RFC 8446 §7.1). */
const HKDF_LABEL_PREFIX: string = "tls13 "

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
 * or past 255 × 32, when `info` is longer than 2^31 - 1 bytes, or when `prk`
 * is shorter than 32 bytes.
 */
export const hkdfExpandSha256 = (prk: u8[], info: u8[], length: i32): u8[] | null => {
  if (
    length < 0 ||
    length > HKDF_MAX_BLOCKS * SHA256_SIZE ||
    info.length > 2147483647 ||
    toI32(prk.length) < SHA256_SIZE
  ) {
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
 * or past 255 × 48, when `info` is longer than 2^31 - 1 bytes, or when `prk`
 * is shorter than 48 bytes.
 */
export const hkdfExpandSha384 = (prk: u8[], info: u8[], length: i32): u8[] | null => {
  if (
    length < 0 ||
    length > HKDF_MAX_BLOCKS * SHA384_SIZE ||
    info.length > 2147483647 ||
    toI32(prk.length) < SHA384_SIZE
  ) {
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

/**
 * The `HkdfLabel` struct of RFC 8446 §7.1, the `info` HKDF-Expand-Label hands
 * to `expand`, or a panic naming `caller` when `length`, `label` or `context`
 * is outside the range the module docs give: 249 is `label<7..255>`'s 255 less
 * the prefix's 6 bytes. The lengths of `label` and `context` are compared as
 * the `number`s they are, before any `toI32`, which would saturate them under
 * `--number-mode f64`; so the bounds are literals rather than `i32` constants.
 */
const hkdfLabel = (caller: string, label: string, context: u8[], length: i32): u8[] => {
  if (length < 0 || length > 255) {
    panic(`${caller}: a length of ${length} bytes, outside 0 to 255`)
  }
  if (label.length === 0 || label.length > 249) {
    panic(`${caller}: a label of ${toI32(label.length)} bytes, outside 1 to 249`)
  }
  if (context.length > 255) {
    panic(`${caller}: a context of more than 255 bytes`)
  }
  const full: string = `${HKDF_LABEL_PREFIX}${label}`
  const fullLength: i32 = toI32(full.length)
  const contextLength: i32 = toI32(context.length)
  const out: u8[] = new Array<u8>(4 + fullLength + contextLength)
  out[0] = toU8(length >> 8)
  out[1] = toU8(length & 0xff)
  out[2] = toU8(fullLength)
  for (let k: i32 = 0; k < fullLength; k += 1) {
    out[3 + k] = toU8(toI32(full.charCodeAt(k)))
  }
  out[3 + fullLength] = toU8(contextLength)
  hkdfAppend(out, 4 + fullLength, context)
  return out
}

/**
 * HKDF-Expand-Label with HMAC-SHA-256 (RFC 8446 §7.1): `length` bytes from
 * `secret`, `"tls13 " + label` and `context`. Panics on an argument out of the
 * range the module docs give, a secret shorter than 32 bytes among them.
 */
export const hkdfExpandLabelSha256 = (secret: u8[], label: string, context: u8[], length: i32): u8[] => {
  const okm: u8[] | null = hkdfExpandSha256(
    secret,
    hkdfLabel("hkdfExpandLabelSha256", label, context, length),
    length
  )
  if (okm === null) {
    panic("hkdfExpandLabelSha256: a secret shorter than 32 bytes")
  }
  return okm
}

/**
 * HKDF-Expand-Label with HMAC-SHA-384 (RFC 8446 §7.1): `length` bytes from
 * `secret`, `"tls13 " + label` and `context`. Panics on an argument out of the
 * range the module docs give, a secret shorter than 48 bytes among them.
 */
export const hkdfExpandLabelSha384 = (secret: u8[], label: string, context: u8[], length: i32): u8[] => {
  const okm: u8[] | null = hkdfExpandSha384(
    secret,
    hkdfLabel("hkdfExpandLabelSha384", label, context, length),
    length
  )
  if (okm === null) {
    panic("hkdfExpandLabelSha384: a secret shorter than 48 bytes")
  }
  return okm
}
