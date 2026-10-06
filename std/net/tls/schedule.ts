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
 * **In place.** Each step also has an `*Into` form that computes in an
 * `HkdfScratch` the caller owns and writes into the caller's array, and
 * `TlsTranscript` resets and reads its hash in hashers it allocated once, so
 * a handshake that keeps its state in a connection slot can run the whole
 * schedule inside `using a = arena()` blocks and leave the arena where it was
 * (TLS-3 in `docs/security/tls.md`). The scratch is wiped by every step.
 *
 * **Secrets are not wiped.** Every function here answers or holds a secret as
 * plain bytes, and each stays in arena memory until that memory is reused.
 * `secureZero`, the store no optimiser removes, is on `main`, and `std/` may
 * call it once a release ships it (CLAUDE.md §Security, TLS-1 in
 * `docs/security/tls.md`).
 *
 * Written from RFC 8446, not ported from another implementation.
 */
import {
  HkdfScratch,
  hkdfExpandLabelInto,
  hkdfExpandLabelSha256,
  hkdfExpandLabelSha384,
  hkdfExtractInto,
  hkdfExtractSha256,
  hkdfExtractSha384,
} from "nish/crypto/hkdf"
import { hmacCopySha256, hmacCopySha384, hmacSha256, hmacSha384 } from "nish/crypto/hmac"
import { tlsHexInto } from "nish/net/tls/codec"
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
    ? hkdfExpandLabelSha384(secret, label, context, length)
    : hkdfExpandLabelSha256(secret, label, context, length)

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
 * only the one `hashLength` names is fed. So are a fresh pair, which `reset`
 * starts the transcript again from, and a twin pair `hashInto` reads the hash
 * through: all six are made once, so a transcript reused for the next
 * connection with `reset` allocates nothing that outlives a call.
 */
export class TlsTranscript {
  /** 32 for SHA-256, 48 for SHA-384. */
  hashLength: i32
  sha256: Sha256
  sha384: Sha384
  /** Never fed: the initial hash values `reset` copies from. */
  fresh256: Sha256
  fresh384: Sha384
  /** Where `hashInto` finishes a copy of the running hash, so that the transcript goes on. */
  twin256: Sha256
  twin384: Sha384

  constructor(hashLength: i32) {
    this.hashLength = hashLength
    this.sha256 = new Sha256()
    this.sha384 = new Sha384()
    this.fresh256 = new Sha256()
    this.fresh384 = new Sha384()
    this.twin256 = new Sha256()
    this.twin384 = new Sha384()
  }

  /** Starts an empty transcript over the hash `hashLength` names, in the hashers it already has. */
  reset(hashLength: i32): void {
    this.hashLength = hashLength
    hmacCopySha256(this.fresh256, this.sha256)
    hmacCopySha384(this.fresh384, this.sha384)
  }

  /** Absorbs `data[off .. off + len)`, a whole handshake message or part of one. */
  update(data: u8[], off: i32, len: i32): void {
    if (this.hashLength === SHA384_SIZE) {
      this.sha384.update(data, off, len)
    } else {
      this.sha256.update(data, off, len)
    }
  }

  /**
   * Writes the transcript hash of everything absorbed so far, `hashLength`
   * bytes, at `out[at]`; the transcript goes on. What the digest allocates
   * dies with the call. A window outside `out` writes what fits.
   */
  hashInto(out: u8[], at: i32): void {
    let digest: u8[] = []
    if (this.hashLength === SHA384_SIZE) {
      hmacCopySha384(this.sha384, this.twin384)
      digest = this.twin384.digest()
    } else {
      hmacCopySha256(this.sha256, this.twin256)
      digest = this.twin256.digest()
    }
    for (let k: i32 = 0; k < toI32(digest.length) && at + k >= 0 && at + k < toI32(out.length); k++) {
      out[at + k] = digest[k]
    }
  }

  /** The transcript hash of everything absorbed so far, in a fresh array; the transcript goes on. */
  hash(): u8[] {
    const out: u8[] = new Array<u8>(this.hashLength)
    this.hashInto(out, TLS_SCHEDULE_FROM)
    return out
  }

  /**
   * Replaces the transcript so far, which must be exactly the first
   * ClientHello, by `message_hash` (type 254, a 24-bit length of HashLen,
   * then Hash(ClientHello1)), as RFC 8446 §4.4.1 has a server do before it
   * absorbs its HelloRetryRequest.
   */
  restartWithMessageHash(): void {
    const first: u8[] = new Array<u8>(SHA384_SIZE)
    this.hashInto(first, TLS_SCHEDULE_FROM)
    const header: u8[] = [toU8(254), toU8(0), toU8(0), toU8(this.hashLength)]
    const headerLength: i32 = 4
    this.reset(this.hashLength)
    this.update(header, TLS_SCHEDULE_FROM, headerLength)
    this.update(first, TLS_SCHEDULE_FROM, this.hashLength)
  }
}

// ---- The schedule in place -------------------------------------------------------

/** SHA-256 of the empty string, Derive-Secret's context for "derived" (RFC 8446 §7.1). */
const TLS_EMPTY_HASH_SHA256: string = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
/** SHA-384 of the empty string. */
const TLS_EMPTY_HASH_SHA384: string =
  "38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b"

/** Writes the hash of the empty string under the hash `hashLength` names, from the constants above, at `out[0]`. */
const tlsEmptyHashInto = (hashLength: i32, out: u8[]): void => {
  tlsHexInto(
    hashLength === SHA384_SIZE ? TLS_EMPTY_HASH_SHA384 : TLS_EMPTY_HASH_SHA256,
    out,
    TLS_SCHEDULE_FROM
  )
}

/**
 * `tlsDeriveSecret` in place: Derive-Secret (RFC 8446 §7.1) of `secret` with
 * `label` and the transcript hash `transcriptHash[hashOff .. hashOff +
 * hashLength)`, its HashLen bytes written at `out[0]`.
 */
export const tlsDeriveSecretInto = (
  kdf: HkdfScratch,
  hashLength: i32,
  secret: u8[],
  label: string,
  transcriptHash: u8[],
  hashOff: i32,
  out: u8[]
): void => {
  hkdfExpandLabelInto(
    kdf,
    hashLength,
    secret,
    label,
    transcriptHash,
    hashOff,
    hashLength,
    out,
    TLS_SCHEDULE_FROM,
    hashLength
  )
}

/**
 * `tlsMasterSecret` in place: HKDF-Extract of HashLen zeros under
 * `Derive-Secret(handshake, "derived", "")`, written at `out[0]`. The salt is
 * wiped before it returns.
 */
export const tlsMasterSecretInto = (
  kdf: HkdfScratch,
  hashLength: i32,
  handshakeSecret: u8[],
  out: u8[]
): void => {
  const empty: u8[] = new Array<u8>(hashLength)
  tlsEmptyHashInto(hashLength, empty)
  const salt: u8[] = new Array<u8>(hashLength)
  tlsDeriveSecretInto(kdf, hashLength, handshakeSecret, "derived", empty, TLS_SCHEDULE_FROM, salt)
  hkdfExtractInto(kdf, hashLength, salt, new Array<u8>(hashLength), out, TLS_SCHEDULE_FROM)
  secureZero(salt)
}

/**
 * `tlsFinishedVerifyData` in place: the HMAC of `transcriptHash[hashOff ..
 * hashOff + hashLength)` under `finished_key = Expand-Label(baseKey,
 * "finished", "", HashLen)` (RFC 8446 §4.4.4), written at `out[at]`. The
 * finished key is wiped before it returns, and so is the scratch.
 */
export const tlsFinishedVerifyDataInto = (
  kdf: HkdfScratch,
  hashLength: i32,
  baseKey: u8[],
  transcriptHash: u8[],
  hashOff: i32,
  out: u8[],
  at: i32
): void => {
  const none: u8[] = []
  const finishedKey: u8[] = new Array<u8>(hashLength)
  hkdfExpandLabelInto(
    kdf,
    hashLength,
    baseKey,
    "finished",
    none,
    TLS_SCHEDULE_FROM,
    TLS_SCHEDULE_FROM,
    finishedKey,
    TLS_SCHEDULE_FROM,
    hashLength
  )
  if (hashLength === SHA384_SIZE) {
    kdf.sha384.begin(finishedKey, TLS_SCHEDULE_FROM, hashLength)
    kdf.sha384.update(transcriptHash, hashOff, hashLength)
    kdf.sha384.finishInto(out, at)
  } else {
    kdf.sha256.begin(finishedKey, TLS_SCHEDULE_FROM, hashLength)
    kdf.sha256.update(transcriptHash, hashOff, hashLength)
    kdf.sha256.finishInto(out, at)
  }
  secureZero(finishedKey)
  kdf.wipe()
}

/**
 * `tlsTrafficKey` and `tlsTrafficIv` in place: the AEAD key a traffic secret
 * gives `suite` (RFC 8446 §7.3) written into `key`, which must be the suite's
 * key length, and its 12-byte IV into `iv`. `false`, writing nothing, for a
 * suite this module does not negotiate, a secret that is not its hash's
 * length, or a key or IV array of the wrong length.
 */
export const tlsTrafficKeysInto = (
  kdf: HkdfScratch,
  suite: i32,
  secret: u8[],
  key: u8[],
  iv: u8[]
): boolean => {
  const none: u8[] = []
  const hashLength: i32 = tlsSuiteHashLength(suite)
  const keyLength: i32 = tlsSuiteKeyLength(suite)
  if (
    hashLength === 0 ||
    toI32(secret.length) !== hashLength ||
    toI32(key.length) !== keyLength ||
    toI32(iv.length) !== TLS_IV_SIZE
  ) {
    return false
  }
  hkdfExpandLabelInto(
    kdf,
    hashLength,
    secret,
    "key",
    none,
    TLS_SCHEDULE_FROM,
    TLS_SCHEDULE_FROM,
    key,
    TLS_SCHEDULE_FROM,
    keyLength
  )
  hkdfExpandLabelInto(
    kdf,
    hashLength,
    secret,
    "iv",
    none,
    TLS_SCHEDULE_FROM,
    TLS_SCHEDULE_FROM,
    iv,
    TLS_SCHEDULE_FROM,
    TLS_IV_SIZE
  )
  return true
}
