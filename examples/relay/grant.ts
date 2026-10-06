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
 * address is that long). The secret is a plain array, as `nish/crypto/hmac`
 * takes keys.
 */
import { base64urlDecode } from "nish/crypto/base64url"
import { timingSafeEqualAt } from "nish/crypto/ct"
import { HmacSha256Scratch } from "nish/crypto/hmac"
import { SHA256_SIZE } from "nish/crypto/sha256"
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

/** Checks grants against one secret, with every buffer made once. */
export class GrantVerifier {
  secret: u8[]
  mac: HmacSha256Scratch
  tag: u8[]
  json: RelayJson
  /** Every byte as a one-character string, made once, so a token's text is built from strings older than the call. */
  chars: string[]

  constructor(secret: u8[]) {
    this.chars = []
    for (let b: i32 = 0; b < 256; b++) {
      this.chars.push(String.fromCharCode(b))
    }
    this.secret = secret
    this.mac = new HmacSha256Scratch()
    this.tag = new Array<u8>(SHA256_SIZE)
    this.json = new RelayJson()
  }

  /**
   * Verifies the token `buf[off .. off + len)` at Unix millisecond `now`:
   * signature, then expiry, then shape. Answers `GRANT_OK` with the grant in
   * `out`, or the close code with the reason in `out.reason`. A window
   * outside `buf` panics; nothing in it does.
   */
  verify(buf: u8[], off: i32, len: i32, now: i64, out: RelayGrant): i32 {
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
    // The MAC is over `v1.` and the payload as it is written, before anything is decoded.
    const mac: HmacSha256Scratch = this.mac
    mac.begin(this.secret, GRANT_ZERO, toI32(this.secret.length))
    mac.update(buf, off, second - off)
    mac.finishInto(this.tag, GRANT_ZERO)
    if (
      toI32(signature.length) !== SHA256_SIZE ||
      !timingSafeEqualAt(this.tag, 0, signature, 0, SHA256_SIZE)
    ) {
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
