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
 * **Caller-owned scratch.** The functions above make their HMAC objects and
 * their output fresh on every call, which stores allocations no arena scope
 * may release around them. `hkdfExtractInto`, `hkdfExpandInto` and
 * `hkdfExpandLabelInto` compute the same bytes in an `HkdfScratch` the caller
 * allocates once, over the hash `hashLength` names (32 for SHA-256, 48 for
 * SHA-384), and write them into the caller's array, so that a loop of key
 * derivations inside one `using a = arena()` block leaves the arena where it
 * was. Each wipes the scratch before it returns, its last block and the
 * keyed hashers of the hash it ran over, so no key material outlives the
 * call there:
 *
 *     const kdf = new HkdfScratch();                         // once
 *     hkdfExtractInto(kdf, 32, salt, ikm, prk, 0);           // 32 bytes at prk[0]
 *     hkdfExpandLabelInto(kdf, 32, prk, "key", context, 0, 0, key, 0, 16);
 *
 * They refuse what the functions above refuse, the same way: `hkdfExpandInto`
 * answers `false` where `hkdfExpandSha256` answers `null`, and
 * `hkdfExpandLabelInto` panics where `hkdfExpandLabelSha256` does. A hash
 * length other than 32 or 48, or an output window outside its array, is the
 * caller's bug and panics.
 *
 * **What the key reaches is wiped** (CLAUDE.md, "Security"). Every HMAC on
 * the way wipes its key blocks and hashers (`nish/crypto/hmac`), and `expand`
 * wipes each T(i) once the next has replaced it, and the last one before it
 * returns. The PRK `extract` answers and the output `expand` answers are the
 * caller's. A caller that holds its input keying material as a `Secret<u8[]>`
 * (`nish:secret`) derives with `hkdfSha256Secret` or `hkdfSha384Secret`,
 * which run both steps, hand the output back as a `Secret` and wipe the PRK
 * between them, or with the `*Secret` twins of each step:
 *
 *     const okm: Secret<u8[]> | null = hkdfSha256Secret(salt, ikm, info, 42);
 *
 * Written from RFC 5869 and RFC 8446 §7.1, not ported from another
 * implementation.
 */
import {
  HmacSha256,
  HmacSha256Scratch,
  HmacSha384,
  HmacSha384Scratch,
  hmacSha256,
  hmacSha384,
} from "nish/crypto/hmac"
import { SHA256_SIZE } from "nish/crypto/sha256"
import { SHA384_SIZE } from "nish/crypto/sha512"
import { Secret, exposeWith, secret, wipe } from "nish:secret"

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
    const block: u8[] = mac.digest()
    wipe(previous)
    previous = block
    at = hkdfAppend(out, at, previous)
    i += 1
  }
  wipe(previous)
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
    const block: u8[] = mac.digest()
    wipe(previous)
    previous = block
    at = hkdfAppend(out, at, previous)
    i += 1
  }
  wipe(previous)
  return out
}

// ---- Keys held as `Secret`s ------------------------------------------------
//
// The `*Secret` functions the module docs name: each reads its key only inside
// `exposeWith`, and hands the PRK and the output back as `Secret`s.

/** What `expand` needs besides the PRK, as one argument, since `exposeWith` hands on only one. */
interface HkdfExpandRequest {
  info: u8[]
  length: i32
}

/**
 * HKDF-Extract with HMAC-SHA-256 on the plain IKM, for `exposeWith` to run.
 * It keys HMAC with `salt` itself rather than through `hkdfSalt`, whose answer
 * may be `salt`, because the checker does not credit that path with leaving
 * `salt` unwritten (NL2450). The PRK is the same: an empty salt is padded to
 * the block with zeros, as the HashLen zeros of §2.2 would be.
 */
const hkdfExtractSha256Exposed = (ikm: u8[], salt: u8[]): u8[] => hmacSha256(salt, ikm)

/** HKDF-Extract with HMAC-SHA-384 on the plain IKM, for `exposeWith` to run, as the SHA-256 one is. */
const hkdfExtractSha384Exposed = (ikm: u8[], salt: u8[]): u8[] => hmacSha384(salt, ikm)

/** HKDF-Expand with HMAC-SHA-256 on the plain PRK, for `exposeWith` to run. */
const hkdfExpandSha256Exposed = (prk: u8[], request: HkdfExpandRequest): u8[] | null =>
  hkdfExpandSha256(prk, request.info, request.length)

/** HKDF-Expand with HMAC-SHA-384 on the plain PRK, for `exposeWith` to run. */
const hkdfExpandSha384Exposed = (prk: u8[], request: HkdfExpandRequest): u8[] | null =>
  hkdfExpandSha384(prk, request.info, request.length)

/** `hkdfExtractSha256` on input keying material held as a `Secret`: the 32-byte PRK, held as one. */
export const hkdfExtractSha256Secret = (salt: u8[], ikm: Secret<u8[]>): Secret<u8[]> => {
  const prk: u8[] = exposeWith(ikm, salt, hkdfExtractSha256Exposed)
  return secret(prk)
}

/** `hkdfExtractSha384` on input keying material held as a `Secret`: the 48-byte PRK, held as one. */
export const hkdfExtractSha384Secret = (salt: u8[], ikm: Secret<u8[]>): Secret<u8[]> => {
  const prk: u8[] = exposeWith(ikm, salt, hkdfExtractSha384Exposed)
  return secret(prk)
}

/**
 * `hkdfExpandSha256` on a PRK held as a `Secret`: the output keying material,
 * held as one, or `null` where `hkdfExpandSha256` answers `null`.
 */
export const hkdfExpandSha256Secret = (prk: Secret<u8[]>, info: u8[], length: i32): Secret<u8[]> | null => {
  const request: HkdfExpandRequest = { info: info, length: length }
  const okm: u8[] | null = exposeWith(prk, request, hkdfExpandSha256Exposed)
  if (okm === null) {
    return null
  }
  return secret(okm)
}

/**
 * `hkdfExpandSha384` on a PRK held as a `Secret`: the output keying material,
 * held as one, or `null` where `hkdfExpandSha384` answers `null`.
 */
export const hkdfExpandSha384Secret = (prk: Secret<u8[]>, info: u8[], length: i32): Secret<u8[]> | null => {
  const request: HkdfExpandRequest = { info: info, length: length }
  const okm: u8[] | null = exposeWith(prk, request, hkdfExpandSha384Exposed)
  if (okm === null) {
    return null
  }
  return secret(okm)
}

/**
 * HKDF with HMAC-SHA-256, both steps (RFC 5869 §2): `length` bytes from `salt`,
 * the `Secret` input keying material and `info`, held as a `Secret`, or `null`
 * where `hkdfExpandSha256` answers `null`. The PRK is wiped before it returns.
 */
export const hkdfSha256Secret = (
  salt: u8[],
  ikm: Secret<u8[]>,
  info: u8[],
  length: i32
): Secret<u8[]> | null => {
  const prk: Secret<u8[]> = hkdfExtractSha256Secret(salt, ikm)
  const okm: Secret<u8[]> | null = hkdfExpandSha256Secret(prk, info, length)
  wipe(prk)
  return okm
}

/** `hkdfSha256Secret` with HMAC-SHA-384: the PRK is 48 bytes, and wiped before it returns. */
export const hkdfSha384Secret = (
  salt: u8[],
  ikm: Secret<u8[]>,
  info: u8[],
  length: i32
): Secret<u8[]> | null => {
  const prk: Secret<u8[]> = hkdfExtractSha384Secret(salt, ikm)
  const okm: Secret<u8[]> | null = hkdfExpandSha384Secret(prk, info, length)
  wipe(prk)
  return okm
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
    // `out` is longer than `3 + fullLength`, but the proof cannot read that
    // off the sum it was allocated with; this test is what proves the store.
    // It sits in the body rather than the loop condition, which stays the
    // plain `k < fullLength` the attribute pass counts as a bounded loop.
    if (3 + k >= toI32(out.length)) {
      panic("hkdfLabel: the label overran its buffer")
    }
    out[3 + k] = toU8(toI32(full.charCodeAt(k)))
  }
  out[3 + fullLength] = toU8(contextLength)
  hkdfAppend(out, 4 + fullLength, context)
  return out
}

/**
 * HKDF-Expand-Label with HMAC-SHA-256 (RFC 8446 §7.1): `length` bytes from
 * `prk` (RFC 8446's Secret), `"tls13 " + label` and `context`. Panics on an argument out of the
 * range the module docs give, a secret shorter than 32 bytes among them.
 */
export const hkdfExpandLabelSha256 = (prk: u8[], label: string, context: u8[], length: i32): u8[] => {
  const okm: u8[] | null = hkdfExpandSha256(
    prk,
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
 * `prk` (RFC 8446's Secret), `"tls13 " + label` and `context`. Panics on an argument out of the
 * range the module docs give, a secret shorter than 48 bytes among them.
 */
export const hkdfExpandLabelSha384 = (prk: u8[], label: string, context: u8[], length: i32): u8[] => {
  const okm: u8[] | null = hkdfExpandSha384(
    prk,
    hkdfLabel("hkdfExpandLabelSha384", label, context, length),
    length
  )
  if (okm === null) {
    panic("hkdfExpandLabelSha384: a secret shorter than 48 bytes")
  }
  return okm
}

// ---- Caller-owned scratch ----------------------------------------------------

/** The longest `HkdfLabel`: two length bytes, `label<7..255>` and `context<0..255>`, each with its length byte. */
const HKDF_LABEL_MAX: i32 = 514

/**
 * What the `*Into` functions compute in: an HMAC scratch for each hash, the
 * previous output block T(i - 1), and the `HkdfLabel` HKDF-Expand-Label
 * builds. Allocate one per long-lived owner — a connection slot, say — and
 * hand it to every derivation; it carries nothing from one call to the next.
 */
export class HkdfScratch {
  sha256: HmacSha256Scratch
  sha384: HmacSha384Scratch
  /** T(i - 1), HashLen bytes of it; wiped before every function returns. */
  previous: u8[]
  /** The one-byte block counter `i`. */
  counter: u8[]
  /** HKDF-Expand-Label's `info`, built here: public, so it is not wiped. */
  label: u8[]

  constructor() {
    this.sha256 = new HmacSha256Scratch()
    this.sha384 = new HmacSha384Scratch()
    this.previous = new Array<u8>(SHA384_SIZE)
    this.counter = new Array<u8>(1)
    this.label = new Array<u8>(HKDF_LABEL_MAX)
  }

  /** Zeroes the key material the last derivation left: T(i - 1) and both keyed hashers. */
  wipe(): void {
    secureZero(this.previous)
    this.sha256.wipe()
    this.sha384.wipe()
  }
}

/** Panics unless `hashLength` is 32 or 48, the two hashes HKDF runs over here. */
const hkdfCheckHash = (caller: string, hashLength: i32): void => {
  if (hashLength !== SHA256_SIZE && hashLength !== SHA384_SIZE) {
    panic(`${caller}: a hash length of ${hashLength}, not 32 or 48`)
  }
}

/** Panics unless `out[at .. at + length)` is a window inside `out`. */
const hkdfCheckOutput = (caller: string, out: u8[], at: i32, length: i32): void => {
  if (at < 0 || length < 0 || at > toI32(out.length) - length) {
    panic(`${caller}: the output window is outside its array`)
  }
}

/** Zeroes what the last derivation over `hashLength` left in `s`: T(i - 1) and that hash's keyed hashers. */
const hkdfWipe = (s: HkdfScratch, hashLength: i32): void => {
  secureZero(s.previous)
  if (hashLength === SHA384_SIZE) {
    s.sha384.wipe()
  } else {
    s.sha256.wipe()
  }
}

/** Keys the scratch's HMAC for `hashLength` with `key[off .. off + len)`. */
const hkdfMacBegin = (s: HkdfScratch, hashLength: i32, key: u8[], off: i32, len: i32): void => {
  if (hashLength === SHA384_SIZE) {
    s.sha384.begin(key, off, len)
  } else {
    s.sha256.begin(key, off, len)
  }
}

/** Feeds `data[off .. off + len)` to the scratch's HMAC for `hashLength`. */
const hkdfMacUpdate = (s: HkdfScratch, hashLength: i32, data: u8[], off: i32, len: i32): void => {
  if (hashLength === SHA384_SIZE) {
    s.sha384.update(data, off, len)
  } else {
    s.sha256.update(data, off, len)
  }
}

/** Writes the HMAC for `hashLength`'s tag at `out[at]`. */
const hkdfMacFinish = (s: HkdfScratch, hashLength: i32, out: u8[], at: i32): void => {
  if (hashLength === SHA384_SIZE) {
    s.sha384.finishInto(out, at)
  } else {
    s.sha256.finishInto(out, at)
  }
}

/**
 * HKDF-Extract (RFC 5869 §2.2) over the hash `hashLength` names, the PRK's
 * HashLen bytes written at `out[at]`. An empty `salt` keys HMAC with no bytes,
 * which HMAC pads to the block with zeros, exactly as the HashLen zeros §2.2
 * asks for would be. An `ikm` longer than 2^31 - 1 bytes panics, as
 * `hmacSha256` does.
 */
export const hkdfExtractInto = (
  s: HkdfScratch,
  hashLength: i32,
  salt: u8[],
  ikm: u8[],
  out: u8[],
  at: i32
): void => {
  hkdfCheckHash("hkdfExtractInto", hashLength)
  hkdfCheckOutput("hkdfExtractInto", out, at, hashLength)
  if (ikm.length > 2147483647) {
    panic("hkdfExtractInto: input keying material longer than 2^31 - 1 bytes")
  }
  hkdfMacBegin(s, hashLength, salt, HKDF_FROM, toI32(salt.length))
  hkdfMacUpdate(s, hashLength, ikm, HKDF_FROM, toI32(ikm.length))
  hkdfMacFinish(s, hashLength, out, at)
  hkdfWipe(s, hashLength)
}

/**
 * The T(1) | T(2) | … loop of RFC 5869 §2.3, `length` bytes of it at
 * `out[at]`, with `info` the first `infoLen` bytes of `info`.
 * The callers have checked every bound.
 */
const hkdfExpandWindow = (
  s: HkdfScratch,
  hashLength: i32,
  prk: u8[],
  info: u8[],
  infoLen: i32,
  out: u8[],
  at: i32,
  length: i32
): void => {
  const counterLength: i32 = 1
  let done: i32 = 0
  let i: i32 = 1
  while (done < length) {
    hkdfMacBegin(s, hashLength, prk, HKDF_FROM, toI32(prk.length))
    if (i > 1) {
      hkdfMacUpdate(s, hashLength, s.previous, HKDF_FROM, hashLength)
    }
    hkdfMacUpdate(s, hashLength, info, HKDF_FROM, infoLen)
    s.counter[0] = toU8(i)
    hkdfMacUpdate(s, hashLength, s.counter, HKDF_FROM, counterLength)
    hkdfMacFinish(s, hashLength, s.previous, HKDF_FROM)
    for (let k: i32 = 0; k < hashLength && done < length && k < toI32(s.previous.length); k += 1) {
      out[at + done] = s.previous[k]
      done += 1
    }
    i += 1
  }
  hkdfWipe(s, hashLength)
}

/**
 * HKDF-Expand (RFC 5869 §2.3) over the hash `hashLength` names: `length`
 * bytes from `prk` and `info`, written at `out[at]`. `false`, writing nothing,
 * where `hkdfExpandSha256` answers `null`: a `length` negative or past
 * 255 × HashLen, an `info` longer than 2^31 - 1 bytes, or a `prk` shorter than
 * HashLen.
 */
export const hkdfExpandInto = (
  s: HkdfScratch,
  hashLength: i32,
  prk: u8[],
  info: u8[],
  out: u8[],
  at: i32,
  length: i32
): boolean => {
  hkdfCheckHash("hkdfExpandInto", hashLength)
  if (
    length < 0 ||
    length > HKDF_MAX_BLOCKS * hashLength ||
    info.length > 2147483647 ||
    toI32(prk.length) < hashLength
  ) {
    return false
  }
  hkdfCheckOutput("hkdfExpandInto", out, at, length)
  hkdfExpandWindow(s, hashLength, prk, info, toI32(info.length), out, at, length)
  return true
}

/**
 * HKDF-Expand-Label (RFC 8446 §7.1) over the hash `hashLength` names: `length`
 * bytes from `prk` (RFC 8446's Secret), `"tls13 " + label` and the context
 * `context[contextOff .. contextOff + contextLen)`, written at `out[at]`. It
 * panics where `hkdfExpandLabelSha256` does — a length outside 0 to 255, a
 * label empty or past 249 bytes, a context past 255, a secret shorter than
 * HashLen — and on a context window outside its array.
 */
export const hkdfExpandLabelInto = (
  s: HkdfScratch,
  hashLength: i32,
  prk: u8[],
  label: string,
  context: u8[],
  contextOff: i32,
  contextLen: i32,
  out: u8[],
  at: i32,
  length: i32
): void => {
  hkdfCheckHash("hkdfExpandLabelInto", hashLength)
  if (length < 0 || length > 255) {
    panic(`hkdfExpandLabelInto: a length of ${length} bytes, outside 0 to 255`)
  }
  if (label.length === 0 || label.length > 249) {
    panic(`hkdfExpandLabelInto: a label of ${toI32(label.length)} bytes, outside 1 to 249`)
  }
  if (
    contextOff < 0 ||
    contextLen < 0 ||
    contextOff > toI32(context.length) - contextLen ||
    contextLen > 255
  ) {
    panic("hkdfExpandLabelInto: the context window is outside its array or longer than 255 bytes")
  }
  if (toI32(prk.length) < hashLength) {
    panic("hkdfExpandLabelInto: a secret shorter than HashLen")
  }
  hkdfCheckOutput("hkdfExpandLabelInto", out, at, length)
  // The `HkdfLabel` struct, as `hkdfLabel` builds it, into the scratch.
  const prefixLength: i32 = toI32(HKDF_LABEL_PREFIX.length)
  const labelLength: i32 = toI32(label.length)
  const fullLength: i32 = prefixLength + labelLength
  const info: u8[] = s.label
  info[0] = toU8(length >> 8)
  info[1] = toU8(length & 0xff)
  info[2] = toU8(fullLength)
  for (let k: i32 = 0; k < prefixLength && 3 + k < toI32(info.length); k += 1) {
    info[3 + k] = toU8(toI32(HKDF_LABEL_PREFIX.charCodeAt(k)))
  }
  for (let k: i32 = 0; k < labelLength && 3 + prefixLength + k < toI32(info.length); k += 1) {
    info[3 + prefixLength + k] = toU8(toI32(label.charCodeAt(k)))
  }
  const contextAt: i32 = 3 + fullLength
  info[contextAt] = toU8(contextLen)
  for (let k: i32 = 0; k < contextLen && contextAt + 1 + k < toI32(info.length); k += 1) {
    info[contextAt + 1 + k] = context[contextOff + k]
  }
  hkdfExpandWindow(s, hashLength, prk, info, contextAt + 1 + contextLen, out, at, length)
}
