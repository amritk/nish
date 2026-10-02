/**
 * `nish/net/tls/schedule` — the TLS 1.3 key schedule and transcript hash
 * (RFC 8446 §4.4.1, §7.1, §7.3) for the three cipher suites `nish/net/tls`
 * negotiates.
 *
 * The schedule is a chain of HKDF steps over the suite's hash, SHA-256 for
 * `TLS_AES_128_GCM_SHA256` and `TLS_CHACHA20_POLY1305_SHA256` and SHA-384 for
 * `TLS_AES_256_GCM_SHA384`. Without a PSK it runs:
 *
 *     early      = HKDF-Extract(0, 0)
 *     handshake  = HKDF-Extract(Derive-Secret(early, "derived", ""), ECDHE)
 *     c/s hs traffic = Derive-Secret(handshake, "c hs traffic" / "s hs traffic", CH..SH)
 *     master     = HKDF-Extract(Derive-Secret(handshake, "derived", ""), 0)
 *     c/s ap traffic, exporter = Derive-Secret(master, "c ap traffic" / "s ap traffic" / "exp master", CH..server Finished)
 *
 * Every function takes the hash length (32 or 48) rather than a suite, because
 * that is all that changes between them; `tlsSuiteHashLength` turns a suite
 * into one. The traffic key and IV are here too, because T2's record layer
 * needs them and RFC 8448 prints them beside the secrets.
 *
 * **Secrets are not wiped.** Every function here answers or holds a secret,
 * and each stays in arena memory until that memory is reused, because the
 * language has no store the optimiser may not remove (CLAUDE.md §Security,
 * TLS-1 in `docs/security/tls.md`).
 *
 * Written from RFC 8446, not ported from another implementation.
 */
import { hkdfExpandSha256, hkdfExpandSha384, hkdfExtractSha256, hkdfExtractSha384 } from "nish/crypto/hkdf"
import { hmacSha256, hmacSha384 } from "nish/crypto/hmac"
import { SHA256_SIZE, Sha256, sha256 } from "nish/crypto/sha256"
import { SHA384_SIZE, Sha384, sha384 } from "nish/crypto/sha512"

/** `TLS_AES_128_GCM_SHA256` (RFC 8446 §B.4). */
export const TLS_AES_128_GCM_SHA256: i32 = 0x1301
/** `TLS_AES_256_GCM_SHA384` (RFC 8446 §B.4). */
export const TLS_AES_256_GCM_SHA384: i32 = 0x1302
/** `TLS_CHACHA20_POLY1305_SHA256` (RFC 8446 §B.4). */
export const TLS_CHACHA20_POLY1305_SHA256: i32 = 0x1303

/** The length of every TLS 1.3 AEAD nonce, and so of every traffic IV (RFC 8446 §5.3). */
export const TLS_IV_SIZE: i32 = 12

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_SCHEDULE_FROM: i32 = 0

/**
 * The hash length of `suite`: 32 for the two SHA-256 suites, 48 for
 * `TLS_AES_256_GCM_SHA384`, and 0 for any suite this module does not
 * negotiate, which is how a caller tells the two apart.
 */
export const tlsSuiteHashLength = (suite: i32): i32 => {
  switch (suite) {
    case TLS_AES_128_GCM_SHA256:
      return SHA256_SIZE
    case TLS_CHACHA20_POLY1305_SHA256:
      return SHA256_SIZE
    case TLS_AES_256_GCM_SHA384:
      return SHA384_SIZE
    default:
      return 0
  }
}

/** The AEAD key length of `suite`: 16 for AES-128-GCM, 32 for the other two, 0 for an unknown suite. */
export const tlsSuiteKeyLength = (suite: i32): i32 => {
  switch (suite) {
    case TLS_AES_128_GCM_SHA256:
      return 16
    case TLS_CHACHA20_POLY1305_SHA256:
      return 32
    case TLS_AES_256_GCM_SHA384:
      return 32
    default:
      return 0
  }
}

// TEMPORARY(WP34 expand-label): `hkdfExpandLabelSha256` and
// `hkdfExpandLabelSha384` are being added to `nish/crypto/hkdf` by the
// expand-label stage, with exactly this signature. Until that merges this
// module carries the two copies below, under names of their own so that the
// two cannot collide once both are in a program. When it lands, delete these
// two functions and `tlsTemporaryHkdfLabel`, and import the real ones in
// `tlsExpandLabel`. This pull request must not ship them.

/** RFC 8446 §7.1's HkdfLabel: the length, `"tls13 " + label` and the context, each length-prefixed. */
const tlsTemporaryHkdfLabel = (label: string, context: u8[], length: i32): u8[] => {
  const prefix: string = "tls13 "
  const info: u8[] = []
  info.push(toU8(length >> 8))
  info.push(toU8(length & 255))
  const prefixLength: i32 = toI32(prefix.length)
  const labelLength: i32 = toI32(label.length)
  info.push(toU8(prefixLength + labelLength))
  for (let i: i32 = 0; i < prefixLength; i++) {
    info.push(toU8(prefix.charCodeAt(i)))
  }
  for (let i: i32 = 0; i < labelLength; i++) {
    info.push(toU8(label.charCodeAt(i)))
  }
  info.push(toU8(toI32(context.length)))
  for (const b of context) {
    info.push(b)
  }
  return info
}

/** TEMPORARY(WP34 expand-label): HKDF-Expand-Label over SHA-256 (RFC 8446 §7.1). */
const tlsTemporaryExpandLabelSha256 = (secret: u8[], label: string, context: u8[], length: i32): u8[] => {
  const out: u8[] | null = hkdfExpandSha256(secret, tlsTemporaryHkdfLabel(label, context, length), length)
  if (out === null) {
    panic("hkdfExpandLabelSha256: a length or secret out of range")
  }
  return out
}

/** TEMPORARY(WP34 expand-label): HKDF-Expand-Label over SHA-384 (RFC 8446 §7.1). */
const tlsTemporaryExpandLabelSha384 = (secret: u8[], label: string, context: u8[], length: i32): u8[] => {
  const out: u8[] | null = hkdfExpandSha384(secret, tlsTemporaryHkdfLabel(label, context, length), length)
  if (out === null) {
    panic("hkdfExpandLabelSha384: a length or secret out of range")
  }
  return out
}

/**
 * HKDF-Expand-Label (RFC 8446 §7.1) over the hash `hashLength` names: `length`
 * bytes from `secret`, the label (without its `"tls13 "` prefix, which is
 * added) and `context`.
 */
export const tlsExpandLabel = (
  hashLength: i32,
  secret: u8[],
  label: string,
  context: u8[],
  length: i32
): u8[] =>
  hashLength === SHA384_SIZE
    ? tlsTemporaryExpandLabelSha384(secret, label, context, length)
    : tlsTemporaryExpandLabelSha256(secret, label, context, length)

/** HKDF-Extract (RFC 5869 §2.2) over the hash `hashLength` names; an empty salt is HashLen zeros. */
export const tlsExtract = (hashLength: i32, salt: u8[], ikm: u8[]): u8[] =>
  hashLength === SHA384_SIZE ? hkdfExtractSha384(salt, ikm) : hkdfExtractSha256(salt, ikm)

/** The hash of the empty string, the transcript `Derive-Secret(., "derived", "")` hashes. */
export const tlsEmptyHash = (hashLength: i32): u8[] => {
  const none: u8[] = []
  return hashLength === SHA384_SIZE ? sha384(none) : sha256(none)
}

/** Derive-Secret (RFC 8446 §7.1): Expand-Label of `secret` with `label` and a transcript hash, HashLen bytes. */
export const tlsDeriveSecret = (hashLength: i32, secret: u8[], label: string, transcriptHash: u8[]): u8[] =>
  tlsExpandLabel(hashLength, secret, label, transcriptHash, hashLength)

/** The early secret with no PSK: HKDF-Extract of HashLen zeros under a zero salt (RFC 8446 §7.1). */
export const tlsEarlySecret = (hashLength: i32): u8[] => {
  const none: u8[] = []
  return tlsExtract(hashLength, none, new Array<u8>(hashLength))
}

/** The handshake secret: HKDF-Extract of the ECDHE secret under `Derive-Secret(early, "derived", "")`. */
export const tlsHandshakeSecret = (hashLength: i32, earlySecret: u8[], ecdhe: u8[]): u8[] =>
  tlsExtract(hashLength, tlsDeriveSecret(hashLength, earlySecret, "derived", tlsEmptyHash(hashLength)), ecdhe)

/** The master secret: HKDF-Extract of HashLen zeros under `Derive-Secret(handshake, "derived", "")`. */
export const tlsMasterSecret = (hashLength: i32, handshakeSecret: u8[]): u8[] =>
  tlsExtract(
    hashLength,
    tlsDeriveSecret(hashLength, handshakeSecret, "derived", tlsEmptyHash(hashLength)),
    new Array<u8>(hashLength)
  )

/**
 * A Finished message's `verify_data` (RFC 8446 §4.4.4): the HMAC of the
 * transcript hash under `finished_key = Expand-Label(baseKey, "finished", "",
 * HashLen)`, where `baseKey` is the sender's handshake traffic secret.
 */
export const tlsFinishedVerifyData = (hashLength: i32, baseKey: u8[], transcriptHash: u8[]): u8[] => {
  const none: u8[] = []
  const finishedKey: u8[] = tlsExpandLabel(hashLength, baseKey, "finished", none, hashLength)
  return hashLength === SHA384_SIZE
    ? hmacSha384(finishedKey, transcriptHash)
    : hmacSha256(finishedKey, transcriptHash)
}

/** The AEAD key a traffic secret gives `suite`'s record protection (RFC 8446 §7.3); empty for a suite this module does not negotiate. */
export const tlsTrafficKey = (suite: i32, secret: u8[]): u8[] => {
  const none: u8[] = []
  const hashLength: i32 = tlsSuiteHashLength(suite)
  if (hashLength === 0) {
    return none
  }
  return tlsExpandLabel(hashLength, secret, "key", none, tlsSuiteKeyLength(suite))
}

/** The 12-byte IV a traffic secret gives `suite`'s record protection (RFC 8446 §7.3); empty for a suite this module does not negotiate. */
export const tlsTrafficIv = (suite: i32, secret: u8[]): u8[] => {
  const none: u8[] = []
  const hashLength: i32 = tlsSuiteHashLength(suite)
  if (hashLength === 0) {
    return none
  }
  return tlsExpandLabel(hashLength, secret, "iv", none, TLS_IV_SIZE)
}

/**
 * The running transcript hash of RFC 8446 §4.4.1: every handshake message,
 * header included, in the order sent, over the negotiated suite's hash.
 *
 * `hash` reads the hash so far from a copy, so the transcript keeps going: the
 * schedule takes it after ServerHello, after Certificate, after
 * CertificateVerify and after the server's Finished. `restartWithMessageHash`
 * is the HelloRetryRequest rule: the first ClientHello is replaced by the
 * synthetic `message_hash` message holding its hash.
 *
 * Both hashers are kept so that the field types do not depend on the suite;
 * only the one `hashLength` names is fed.
 */
export class TlsTranscript {
  /** 32 for SHA-256, 48 for SHA-384. */
  hashLength: i32
  sha256: Sha256
  sha384: Sha384

  constructor(hashLength: i32) {
    this.hashLength = hashLength
    this.sha256 = new Sha256()
    this.sha384 = new Sha384()
  }

  /** Absorbs `data[off .. off + len)`, a whole handshake message or part of one. */
  update(data: u8[], off: i32, len: i32): void {
    if (this.hashLength === SHA384_SIZE) {
      this.sha384.update(data, off, len)
    } else {
      this.sha256.update(data, off, len)
    }
  }

  /** The transcript hash of everything absorbed so far, in a fresh array; the transcript goes on. */
  hash(): u8[] {
    if (this.hashLength === SHA384_SIZE) {
      return this.sha384.copy().digest()
    }
    return this.sha256.copy().digest()
  }

  /**
   * Replaces the transcript so far, which must be exactly the first
   * ClientHello, by `message_hash` (type 254, a 24-bit length of HashLen,
   * then Hash(ClientHello1)), as RFC 8446 §4.4.1 has a server do before it
   * absorbs its HelloRetryRequest.
   */
  restartWithMessageHash(): void {
    const first: u8[] = this.hash()
    const header: u8[] = [toU8(254), toU8(0), toU8(0), toU8(this.hashLength)]
    const headerLength: i32 = 4
    this.sha256 = new Sha256()
    this.sha384 = new Sha384()
    this.update(header, TLS_SCHEDULE_FROM, headerLength)
    this.update(first, TLS_SCHEDULE_FROM, this.hashLength)
  }
}
