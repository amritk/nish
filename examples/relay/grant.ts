/**
 * Whether a client may reach the endpoint it named: a port of cs's
 * `services/relay/src/grant.rs`.
 *
 * A relay that forwards UDP to any host a client asks for is a reflector,
 * so the upstream is not the client's choice. It is named inside a token
 * signed by a service holding a shared secret, `signGrant` in
 * `packages/protocol/src/session.ts`, and the relay forwards only where the
 * signature says:
 *
 *     v1.<base64url(json)>.<base64url(hmac-sha256("v1." + base64url(json)))>
 *
 * Two details are load-bearing, as in grant.rs:
 *
 * - **The signature is checked before the payload is parsed.** Parsing JSON
 *   nobody has authenticated is surface there is no reason to offer.
 * - **The comparison is constant-time** (`timingSafeEqualAt`): a byte-by-byte
 *   `===` on a MAC leaks how much of a forgery was right.
 *
 * Then expiry, then shape. Each refusal is the close code and reason grant.rs
 * gives it: TOKEN_INVALID for a token that is not three parts, a version
 * other than `v1`, a signature that is not base64url ("malformed token"), a
 * MAC that does not match ("bad signature"), a payload that is not base64url,
 * not the JSON `./json.ts` reads, or lacks a string `host`, an integer
 * `port` within u16 or an integer `expiresAt` ("malformed payload");
 * TOKEN_EXPIRED for an `expiresAt` at or before now ("token expired"). It
 * never panics on input. Two differences from grant.rs, both narrower: an
 * `expiresAt` with a fraction is refused (grant.rs truncates one; `Date.now()`
 * writes none), and a host past `RELAY_HOST_MAX` bytes is malformed (no
 * address is that long). The secret is a `Secret<u8[]>` the caller owns and
 * wipes; it is exposed only to the HMAC, inside `exposeWith`.
 */
import { Secret, exposeWith, wipe } from "nish:secret"
import { base64urlDecode } from "nish/crypto/base64url"
import { timingSafeEqualAt } from "nish/crypto/ct"
import { SHA256_BLOCK, SHA256_SIZE } from "nish/crypto/sha256"
import { h3CheckWindow } from "nish/net/http3-frame"
import { quicPacketCopy } from "nish/net/quic-packet"
import { tlsWindowString } from "nish/net/tls/codec"
import { CLOSE_TOKEN_EXPIRED, CLOSE_TOKEN_INVALID } from "./frame"
import { JSON_INTEGER, JSON_STRING, RelayJson } from "./json"

/** What `verify` answers for a grant that holds. */
export const GRANT_OK: i32 = -1

/** The longest host a grant may name, in bytes: a DNS name's limit. */
export const RELAY_HOST_MAX: i32 = 253

/** A typed zero, since a bare literal handed to a method is an `f64` under `--number-mode f64`. */
const GRANT_ZERO: i32 = 0

/** A grant that verified, or why it did not. */
export class RelayGrant {
  /** Unix milliseconds after which the grant is refused. */
  expiresAt: i64 = 0
  /** The host, `host[0 .. hostLength)`, and the port. */
  host: u8[]
  hostLength: i32 = 0
  port: i32 = 0
  /** The close code of a refusal, and its reason. */
  code: i32 = 0
  reason: string = ""

  constructor() {
    this.host = new Array<u8>(RELAY_HOST_MAX)
  }

  /** The host as text, for a log line or `netAddress`. */
  hostText(): string {
    return tlsWindowString(this.host, GRANT_ZERO, this.hostLength)
  }
}

/** Records refusal `code` with `reason` in `out`, and answers `code`. */
const grantReject = (out: RelayGrant, code: i32, reason: string): i32 => {
  out.code = code
  out.reason = reason
  return code
}

/** `x` rotated right by `n` bits (FIPS 180-4 §3.2). */
const grantRotr = (x: u32, n: u32): u32 => (x >>> n) | (x << (toU32(32) - n))

/**
 * The SHA-256 of `data` (FIPS 180-4 §6.2), with every array a local the call
 * makes and wipes. It is not `nish/crypto/sha256`'s because `Sha256` keeps its
 * arrays in fields, a store the `using a = arena()` analysis does not follow
 * through `exposeWith`, so `verify`'s block could not hold the exposed HMAC.
 */
const grantSha256 = (data: u8[]): u8[] => {
  const k: u32[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const h: u32[] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  // §5.1.1: the message, a 1 bit, zeros to 56 bytes into a block, and the length in bits.
  const n: i32 = toI32(data.length)
  const size: i32 = ((n + 9 + SHA256_BLOCK - 1) / SHA256_BLOCK) * SHA256_BLOCK
  const m: u8[] = new Array<u8>(size)
  quicPacketCopy(m, GRANT_ZERO, data, GRANT_ZERO, n)
  m[n] = 0x80
  const bits: u64 = toU64(n) << toU64(3)
  for (let i: i32 = 0; i < 8; i++) {
    m[size - 1 - i] = toU8(bits >>> toU64(8 * i))
  }
  const w: u32[] = new Array<u32>(64)
  if (toI32(k.length) >= 64 && toI32(h.length) >= 8 && toI32(w.length) >= 64) {
    for (let at: i32 = 0; at + SHA256_BLOCK <= size; at += SHA256_BLOCK) {
      for (let t: i32 = 0; t < 16; t++) {
        let word: u32 = 0
        for (let j: i32 = at + 4 * t; j >= 0 && j < at + 4 * t + 4 && j < toI32(m.length); j++) {
          word = (word << 8) | toU32(m[j])
        }
        w[t] = word
      }
      for (let t: i32 = 16; t < 64; t++) {
        const w2: u32 = w[t - 2]
        const w15: u32 = w[t - 15]
        const sigma1: u32 = grantRotr(w2, 17) ^ grantRotr(w2, 19) ^ (w2 >>> 10)
        const sigma0: u32 = grantRotr(w15, 7) ^ grantRotr(w15, 18) ^ (w15 >>> 3)
        w[t] = sigma1 + w[t - 7] + sigma0 + w[t - 16]
      }
      let a: u32 = h[0]
      let b: u32 = h[1]
      let c: u32 = h[2]
      let d: u32 = h[3]
      let e: u32 = h[4]
      let f: u32 = h[5]
      let g: u32 = h[6]
      let hh: u32 = h[7]
      for (let t: i32 = 0; t < 64; t++) {
        const t1: u32 =
          hh + (grantRotr(e, 6) ^ grantRotr(e, 11) ^ grantRotr(e, 25)) + ((e & f) ^ (~e & g)) + k[t] + w[t]
        const t2: u32 =
          (grantRotr(a, 2) ^ grantRotr(a, 13) ^ grantRotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))
        hh = g
        g = f
        f = e
        e = d + t1
        d = c
        c = b
        b = a
        a = t1 + t2
      }
      h[0] += a
      h[1] += b
      h[2] += c
      h[3] += d
      h[4] += e
      h[5] += f
      h[6] += g
      h[7] += hh
    }
  }
  const out: u8[] = new Array<u8>(SHA256_SIZE)
  for (let i: i32 = 0; i < 8 && i < toI32(h.length); i++) {
    out[4 * i] = toU8(h[i] >>> 24)
    out[4 * i + 1] = toU8(h[i] >>> 16)
    out[4 * i + 2] = toU8(h[i] >>> 8)
    out[4 * i + 3] = toU8(h[i])
  }
  wipe(m)
  wipe(w)
  wipe(h)
  return out
}

/** SHA-256 of `key XOR pad` (a block, the key no longer than one) followed by `data`, with the padded block wiped. */
const grantPadHash = (key: u8[], pad: i32, data: u8[]): u8[] => {
  const block: u8[] = new Array<u8>(SHA256_BLOCK + toI32(data.length))
  for (let k: i32 = 0; k < SHA256_BLOCK && k < toI32(block.length); k++) {
    block[k] = toU8((k < toI32(key.length) ? toI32(key[k]) : GRANT_ZERO) ^ pad)
  }
  quicPacketCopy(block, SHA256_BLOCK, data, GRANT_ZERO, toI32(data.length))
  const digest: u8[] = grantSha256(block)
  wipe(block)
  return digest
}

/** HMAC-SHA-256 of `message` under `key` (RFC 2104), a key past a block hashed first (§2). */
export const grantHmac = (key: u8[], message: u8[]): u8[] => {
  if (toI32(key.length) > SHA256_BLOCK) {
    const hashed: u8[] = grantSha256(key)
    const tag: u8[] = grantHmac(hashed, message)
    wipe(hashed)
    return tag
  }
  const inner: u8[] = grantPadHash(key, 0x36, message)
  const tag: u8[] = grantPadHash(key, 0x5c, inner)
  wipe(inner)
  return tag
}

/**
 * Whether `signed`'s last `SHA256_SIZE` bytes are the HMAC-SHA-256 under
 * `key` of the bytes before them, compared in constant time: the one function
 * the grant secret is exposed to. It answers a boolean, so neither the key nor
 * the tag leaves, and it wipes every intermediate it holds.
 */
const grantTagHolds = (key: u8[], signed: u8[]): boolean => {
  const n: i32 = toI32(signed.length) - SHA256_SIZE
  if (n < 0) {
    return false
  }
  const message: u8[] = new Array<u8>(n)
  quicPacketCopy(message, GRANT_ZERO, signed, GRANT_ZERO, n)
  const tag: u8[] = grantHmac(key, message)
  const holds: boolean =
    toI32(tag.length) === SHA256_SIZE && timingSafeEqualAt(tag, 0, signed, n, SHA256_SIZE)
  wipe(tag)
  return holds
}

/**
 * Checks grants, with every buffer made once. The secret is the caller's
 * `Secret`, handed to each `verify` (a `Secret` may not be a field, NL2430).
 */
export class GrantVerifier {
  json: RelayJson
  /** Every byte as a one-character string, made once, so a token's text is built from strings older than the call. */
  chars: string[]

  constructor() {
    this.chars = []
    for (let b: i32 = 0; b < 256; b++) {
      this.chars.push(String.fromCharCode(b))
    }
    this.json = new RelayJson()
  }

  /**
   * Verifies the token `buf[off .. off + len)` at Unix millisecond `now`
   * against `secret`: signature, then expiry, then shape. Answers `GRANT_OK` with the grant in
   * `out`, or the close code with the reason in `out.reason`. A window
   * outside `buf` panics; nothing in it does.
   */
  verify(buf: u8[], off: i32, len: i32, now: i64, secret: Secret<u8[]>, out: RelayGrant): i32 {
    h3CheckWindow("GrantVerifier.verify", buf, off, len)
    // What the decoding allocates dies here: only numbers leave, into `out`'s arrays.
    using a = arena()
    // Three parts, split on the dots.
    const end: i32 = off + len
    let first: i32 = -1
    let second: i32 = -1
    for (let k: i32 = off; k >= 0 && k < end && k < toI32(buf.length); k++) {
      if (buf[k] === 0x2e) {
        if (first < 0) {
          first = k
        } else if (second < 0) {
          second = k
        } else {
          return grantReject(out, CLOSE_TOKEN_INVALID, "malformed token")
        }
      }
    }
    if (second < 0 || first - off !== 2 || buf[off] !== 0x76 || buf[off + 1] !== 0x31) {
      return grantReject(out, CLOSE_TOKEN_INVALID, "malformed token")
    }
    // The two base64url parts as strings, which is what `base64urlDecode` reads.
    const macText: string[] = []
    for (let k: i32 = second + 1; k >= 0 && k < end && k < toI32(buf.length); k++) {
      macText.push(this.chars[toI32(buf[k])])
    }
    const payloadText: string[] = []
    for (let k: i32 = first + 1; k >= 0 && k < second && k < toI32(buf.length); k++) {
      payloadText.push(this.chars[toI32(buf[k])])
    }
    const signature: u8[] | null = base64urlDecode(macText.join(""))
    if (signature === null) {
      return grantReject(out, CLOSE_TOKEN_INVALID, "malformed token")
    }
    // The MAC is over `v1.` and the payload as written; the signature rides at the end for the check.
    if (toI32(signature.length) !== SHA256_SIZE) {
      return grantReject(out, CLOSE_TOKEN_INVALID, "bad signature")
    }
    const signed: u8[] = new Array<u8>(second - off + SHA256_SIZE)
    quicPacketCopy(signed, GRANT_ZERO, buf, off, second - off)
    quicPacketCopy(signed, second - off, signature, GRANT_ZERO, SHA256_SIZE)
    if (!exposeWith(secret, signed, grantTagHolds)) {
      return grantReject(out, CLOSE_TOKEN_INVALID, "bad signature")
    }

    // Authenticated from here down, so parsing is safe.
    const payload: u8[] | null = base64urlDecode(payloadText.join(""))
    const json: RelayJson = this.json
    if (payload === null || !json.read(payload, GRANT_ZERO, toI32(payload.length))) {
      return grantReject(out, CLOSE_TOKEN_INVALID, "malformed payload")
    }
    const host: i32 = json.find("host")
    const port: i32 = json.find("port")
    const expires: i32 = json.find("expiresAt")
    if (
      host < 0 ||
      port < 0 ||
      expires < 0 ||
      json.kind[host] !== JSON_STRING ||
      json.kind[port] !== JSON_INTEGER ||
      json.kind[expires] !== JSON_INTEGER ||
      json.valueLength[host] > RELAY_HOST_MAX ||
      json.integer[port] < 0 ||
      json.integer[port] > 65535
    ) {
      return grantReject(out, CLOSE_TOKEN_INVALID, "malformed payload")
    }
    const expiresAt: i64 = json.integer[expires]
    if (expiresAt <= now) {
      return grantReject(out, CLOSE_TOKEN_EXPIRED, "token expired")
    }
    const start: i32 = json.valueStart[host]
    const n: i32 = json.valueLength[host]
    quicPacketCopy(out.host, GRANT_ZERO, json.text, start, n)
    out.hostLength = n
    out.port = toI32(json.integer[port])
    out.expiresAt = expiresAt
    out.code = GRANT_OK
    out.reason = ""
    return GRANT_OK
  }
}
