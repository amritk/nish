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
 * A resumed handshake (RFC 8446 §2.2) starts from the ticket's PSK instead,
 * and binds the ClientHello to it before anything else is derived:
 *
 *     PSK        = HKDF-Expand-Label(resumption master, "resumption", ticket_nonce, HashLen)
 *     early      = HKDF-Extract(0, PSK)
 *     binder key = Derive-Secret(early, "res binder", "")
 *     binder     = HMAC(Expand-Label(binder key, "finished", "", HashLen), Hash(truncated ClientHello))
 *     handshake  = HKDF-Extract(Derive-Secret(early, "derived", ""), ECDHE)
 *
 * and goes on from the handshake secret as the full handshake does.
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
 * **Held.** Each step also has a `*Held` form that reads its secrets from
 * `Secret`s the caller holds and writes the secret it derives over the bytes
 * of one, in place, so a connection keeps each stage of the schedule in one
 * `Secret` for its life and ratchets it: `tlsDeriveSecretHeld`,
 * `tlsHandshakeSecretHeld`, `tlsMasterSecretHeld`, and the two that answer
 * plain bytes, `tlsFinishedVerifyDataHeld` (`verify_data` goes on the wire)
 * and `tlsTrafficKeysFromHeld` (the cipher reads the key and IV). Every
 * plain intermediate is wiped before it returns.
 *
 * **Secrets are `Secret`s.** The one-shot functions take every secret they
 * read (a traffic secret, the ECDHE secret, a stage of the schedule) as a
 * `Secret<u8[]>` (`nish:secret`) and answer every secret they derive as one;
 * each reads its key only inside `exposeWith` and wipes the intermediates it
 * made (the "derived" salts, the `finished_key`, the zero inputs) before it
 * returns, and HMAC wipes its key blocks. The caller owns what it is handed
 * and wipes it. What a `Secret` cannot reach is TLS-1 in
 * `docs/security/tls.md`. The transcript hashes, the labels and a Finished
 * message's `verify_data` are public and stay plain.
 *
 * Written from RFC 8446, not ported from another implementation.
 */
import {
  HkdfScratch,
  hkdfExpandLabelHeldInto,
  hkdfExpandLabelInto,
  hkdfExpandLabelSha256Held,
  hkdfExpandLabelSha256Secret,
  hkdfExpandLabelSha384Held,
  hkdfExpandLabelSha384Secret,
  hkdfExtractInto,
} from "nish/crypto/hkdf"
import {
  hmacCopySha256,
  hmacCopySha384,
  hmacSha256,
  hmacSha256Secret,
  hmacSha384,
  hmacSha384Secret,
} from "nish/crypto/hmac"
import { tlsHexInto } from "nish/net/tls/codec"
import { timingSafeEqualAt } from "nish/crypto/ct"
import { SHA256_SIZE, Sha256, sha256 } from "nish/crypto/sha256"
import { SHA384_SIZE, Sha384, sha384 } from "nish/crypto/sha512"
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"

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
 *
 * @param suite A cipher suite code point, such as `TLS_AES_128_GCM_SHA256`.
 * @returns The suite's hash length in bytes (32 or 48), or 0 for a suite this module does not negotiate.
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

/**
 * The AEAD key length of `suite`: 16 for AES-128-GCM, 32 for the other two, 0 for an unknown suite.
 *
 * @param suite A cipher suite code point, such as `TLS_AES_128_GCM_SHA256`.
 * @returns The suite's AEAD key length in bytes (16 or 32), or 0 for a suite this module does not negotiate.
 */
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
 * bytes from `prk` (RFC 8446's Secret), the label (without its `"tls13 "`
 * prefix, which is added) and `context`, held as a `Secret`. It panics as
 * `hkdfExpandLabelSha256Secret` (or its SHA-384 twin) does.
 *
 * @param hashLength 48 for SHA-384; any other value runs SHA-256.
 * @param prk The secret to expand. It stays the caller's: this function does not wipe it.
 * @param label The label without its `"tls13 "` prefix, such as `"key"` or `"c hs traffic"`.
 * @param context The public context bytes, usually a transcript hash; empty for none.
 * @param length How many bytes to derive.
 * @returns A fresh `Secret` holding the `length` derived bytes, which the caller owns and wipes.
 */
export const tlsExpandLabel = (
  hashLength: i32,
  prk: Secret<u8[]>,
  label: string,
  context: u8[],
  length: i32
): Secret<u8[]> => {
  if (hashLength === SHA384_SIZE) {
    return hkdfExpandLabelSha384Secret(prk, label, context, length)
  }
  return hkdfExpandLabelSha256Secret(prk, label, context, length)
}

/** HMAC-SHA-256 keyed with the plain salt over the plain IKM, for the inner `exposeWith` of `tlsExtract` to run. */
const tlsExtractSha256Exposed = (ikm: u8[], salt: u8[]): u8[] => hmacSha256(salt, ikm)

/** HMAC-SHA-384 keyed with the plain salt over the plain IKM, as the SHA-256 one is. */
const tlsExtractSha384Exposed = (ikm: u8[], salt: u8[]): u8[] => hmacSha384(salt, ikm)

/** Exposes the IKM beside the already exposed salt: the outer `exposeWith` of `tlsExtract` over SHA-256. */
const tlsExtractSha256Salted = (salt: u8[], ikm: Secret<u8[]>): u8[] =>
  exposeWith(ikm, salt, tlsExtractSha256Exposed)

/** Exposes the IKM beside the already exposed salt, as the SHA-256 one does. */
const tlsExtractSha384Salted = (salt: u8[], ikm: Secret<u8[]>): u8[] =>
  exposeWith(ikm, salt, tlsExtractSha384Exposed)

/**
 * HKDF-Extract (RFC 5869 §2.2) over the hash `hashLength` names, held as a
 * `Secret`. Both inputs are `Secret`s, since the schedule salts every extract
 * after the first with a derived secret; an empty salt keys HMAC as HashLen
 * zeros do.
 *
 * @param hashLength 48 for SHA-384; any other value runs SHA-256.
 * @param salt The HMAC key. It stays the caller's: this function does not wipe it.
 * @param ikm The input keying material. It stays the caller's as well.
 * @returns A fresh `Secret` holding the HashLen-byte PRK, which the caller owns and wipes.
 */
export const tlsExtract = (hashLength: i32, salt: Secret<u8[]>, ikm: Secret<u8[]>): Secret<u8[]> => {
  if (hashLength === SHA384_SIZE) {
    const prk384: u8[] = exposeWith(salt, ikm, tlsExtractSha384Salted)
    return secret(prk384)
  }
  const prk: u8[] = exposeWith(salt, ikm, tlsExtractSha256Salted)
  return secret(prk)
}

/**
 * The hash of the empty string, the transcript `Derive-Secret(., "derived", "")` hashes.
 *
 * @param hashLength 48 for SHA-384; any other value runs SHA-256.
 * @returns The digest of no bytes, in a fresh array. It is public, so it is plain.
 */
export const tlsEmptyHash = (hashLength: i32): u8[] => {
  const none: u8[] = []
  return hashLength === SHA384_SIZE ? sha384(none) : sha256(none)
}

/**
 * Derive-Secret (RFC 8446 §7.1): Expand-Label of `prk` with `label` and a transcript hash, HashLen bytes
 * held as a `Secret`.
 *
 * @param hashLength The hash length, 32 or 48, which is also how many bytes are derived.
 * @param prk The stage of the schedule to derive from. It stays the caller's: this function does not wipe it.
 * @param label The label without its `"tls13 "` prefix, such as `"s hs traffic"`.
 * @param transcriptHash The transcript hash the secret is bound to, all of it used as the context.
 * @returns A fresh `Secret` holding the HashLen derived bytes, which the caller owns and wipes.
 */
export const tlsDeriveSecret = (
  hashLength: i32,
  prk: Secret<u8[]>,
  label: string,
  transcriptHash: u8[]
): Secret<u8[]> => tlsExpandLabel(hashLength, prk, label, transcriptHash, hashLength)

/**
 * The early secret with no PSK: HKDF-Extract of HashLen zeros under a zero salt (RFC 8446 §7.1). The zero
 * salt and the zero input are wiped before it returns.
 *
 * @param hashLength The hash length, 32 or 48.
 * @returns A fresh `Secret` holding the early secret, which the caller owns and wipes.
 */
export const tlsEarlySecret = (hashLength: i32): Secret<u8[]> => {
  const salt: Secret<u8[]> = secret(new Array<u8>(hashLength))
  const ikm: Secret<u8[]> = secret(new Array<u8>(hashLength))
  const early: Secret<u8[]> = tlsExtract(hashLength, salt, ikm)
  wipe(salt)
  wipe(ikm)
  return early
}

/**
 * The early secret of a resumed handshake: HKDF-Extract of the PSK under a
 * zero salt (RFC 8446 §7.1). The zero salt is wiped before it returns; the
 * PSK is the caller's.
 *
 * @param hashLength The hash length, 32 or 48.
 * @param psk The pre-shared key the ticket stands for. It stays the caller's to wipe.
 * @returns A fresh `Secret` holding the early secret, which the caller owns and wipes.
 */
export const tlsPskEarlySecret = (hashLength: i32, psk: Secret<u8[]>): Secret<u8[]> => {
  const salt: Secret<u8[]> = secret(new Array<u8>(hashLength))
  const early: Secret<u8[]> = tlsExtract(hashLength, salt, psk)
  wipe(salt)
  return early
}

/**
 * The binder key of a resumption PSK: `Derive-Secret(early, "res binder", "")` (RFC 8446 §7.1).
 *
 * @param hashLength The hash length, 32 or 48.
 * @param earlySecret The early secret from `tlsPskEarlySecret`. It stays the caller's: this does not wipe it.
 * @returns A fresh `Secret` holding the binder key, which the caller owns and wipes.
 */
export const tlsBinderKey = (hashLength: i32, earlySecret: Secret<u8[]>): Secret<u8[]> =>
  tlsDeriveSecret(hashLength, earlySecret, "res binder", tlsEmptyHash(hashLength))

/**
 * The salt the handshake secret is extracted under, `Derive-Secret(early,
 * "derived", "")` (RFC 8446 §7.1): what `tlsHandshakeSecret` derives and
 * wipes itself, answered for a caller that extracts in place.
 *
 * @param hashLength The hash length, 32 or 48.
 * @param earlySecret The early secret. It stays the caller's: this function does not wipe it.
 * @returns A fresh `Secret` holding the salt, which the caller owns and wipes once the extract is done.
 */
export const tlsHandshakeSalt = (hashLength: i32, earlySecret: Secret<u8[]>): Secret<u8[]> =>
  tlsDeriveSecret(hashLength, earlySecret, "derived", tlsEmptyHash(hashLength))

/**
 * The PSK a ticket stands for: `HKDF-Expand-Label(resumption_master_secret,
 * "resumption", ticket_nonce, HashLen)` (RFC 8446 §4.6.1).
 *
 * @param hashLength The hash length, 32 or 48, which is also how many bytes are derived.
 * @param resumptionMasterSecret The connection's resumption master secret. It stays the caller's to wipe.
 * @param ticketNonce The `ticket_nonce` of the NewSessionTicket, all of it used as the context. It is public.
 * @returns A fresh `Secret` holding the PSK, which the caller owns and wipes.
 */
export const tlsResumptionPsk = (
  hashLength: i32,
  resumptionMasterSecret: Secret<u8[]>,
  ticketNonce: u8[]
): Secret<u8[]> => tlsExpandLabel(hashLength, resumptionMasterSecret, "resumption", ticketNonce, hashLength)

/**
 * The handshake secret: HKDF-Extract of the ECDHE secret under
 * `Derive-Secret(early, "derived", "")`, which is wiped before it returns.
 *
 * @param hashLength The hash length, 32 or 48.
 * @param earlySecret The early secret. It stays the caller's: this function does not wipe it.
 * @param ecdhe The shared secret of the key exchange. It stays the caller's to wipe as well.
 * @returns A fresh `Secret` holding the handshake secret, which the caller owns and wipes.
 */
export const tlsHandshakeSecret = (
  hashLength: i32,
  earlySecret: Secret<u8[]>,
  ecdhe: Secret<u8[]>
): Secret<u8[]> => {
  const derived: Secret<u8[]> = tlsDeriveSecret(hashLength, earlySecret, "derived", tlsEmptyHash(hashLength))
  const handshake: Secret<u8[]> = tlsExtract(hashLength, derived, ecdhe)
  wipe(derived)
  return handshake
}

/**
 * The master secret: HKDF-Extract of HashLen zeros under
 * `Derive-Secret(handshake, "derived", "")`, which is wiped before it returns,
 * as the zeros are.
 *
 * @param hashLength The hash length, 32 or 48.
 * @param handshakeSecret The handshake secret. It stays the caller's: this function does not wipe it.
 * @returns A fresh `Secret` holding the master secret, which the caller owns and wipes.
 */
export const tlsMasterSecret = (hashLength: i32, handshakeSecret: Secret<u8[]>): Secret<u8[]> => {
  const derived: Secret<u8[]> = tlsDeriveSecret(
    hashLength,
    handshakeSecret,
    "derived",
    tlsEmptyHash(hashLength)
  )
  const zeros: Secret<u8[]> = secret(new Array<u8>(hashLength))
  const master: Secret<u8[]> = tlsExtract(hashLength, derived, zeros)
  wipe(derived)
  wipe(zeros)
  return master
}

/**
 * A Finished message's `verify_data` (RFC 8446 §4.4.4): the HMAC of the
 * transcript hash under `finished_key = Expand-Label(baseKey, "finished", "",
 * HashLen)`, where `baseKey` is the sender's handshake traffic secret. The
 * `finished_key` is wiped before it returns; `verify_data` goes on the wire,
 * so it is plain.
 *
 * @param hashLength The hash length, 32 or 48.
 * @param baseKey The sender's handshake traffic secret. It stays the caller's: this does not wipe it.
 * @param transcriptHash The transcript hash up to, and not including, the Finished message.
 * @returns The HashLen bytes of `verify_data`, plain, in a fresh array.
 */
export const tlsFinishedVerifyData = (hashLength: i32, baseKey: Secret<u8[]>, transcriptHash: u8[]): u8[] => {
  const none: u8[] = []
  const finishedKey: Secret<u8[]> = tlsExpandLabel(hashLength, baseKey, "finished", none, hashLength)
  const verifyData: u8[] =
    hashLength === SHA384_SIZE
      ? hmacSha384Secret(finishedKey, transcriptHash)
      : hmacSha256Secret(finishedKey, transcriptHash)
  wipe(finishedKey)
  return verifyData
}

/**
 * The AEAD key a traffic secret gives `suite`'s record protection (RFC 8446
 * §7.3), held as a `Secret`; empty for a suite this module does not negotiate.
 *
 * @param suite The negotiated cipher suite, such as `TLS_AES_128_GCM_SHA256`.
 * @param trafficSecret The traffic secret the key comes from. It stays the caller's to wipe.
 * @returns A fresh `Secret` holding the suite's key (16 or 32 bytes), or an empty one for an unknown suite.
 *     The caller owns and wipes it.
 */
export const tlsTrafficKey = (suite: i32, trafficSecret: Secret<u8[]>): Secret<u8[]> => {
  const none: u8[] = []
  const hashLength: i32 = tlsSuiteHashLength(suite)
  if (hashLength === 0) {
    return secret(new Array<u8>(0))
  }
  return tlsExpandLabel(hashLength, trafficSecret, "key", none, tlsSuiteKeyLength(suite))
}

/**
 * The 12-byte IV a traffic secret gives `suite`'s record protection (RFC 8446
 * §7.3), held as a `Secret`; empty for a suite this module does not negotiate.
 *
 * @param suite The negotiated cipher suite, such as `TLS_AES_128_GCM_SHA256`.
 * @param trafficSecret The traffic secret the IV comes from. It stays the caller's to wipe.
 * @returns A fresh `Secret` holding the 12-byte IV, or an empty one for an unknown suite. The caller owns
 *     and wipes it.
 */
export const tlsTrafficIv = (suite: i32, trafficSecret: Secret<u8[]>): Secret<u8[]> => {
  const none: u8[] = []
  const hashLength: i32 = tlsSuiteHashLength(suite)
  if (hashLength === 0) {
    return secret(new Array<u8>(0))
  }
  return tlsExpandLabel(hashLength, trafficSecret, "iv", none, TLS_IV_SIZE)
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
  private hashLength: i32
  private sha256: Sha256
  private sha384: Sha384
  /** Never fed: the initial hash values `reset` copies from. */
  private fresh256: Sha256
  private fresh384: Sha384
  /** Where `hashInto` finishes a copy of the running hash, so that the transcript goes on. */
  private twin256: Sha256
  private twin384: Sha384

  /**
   * Makes an empty transcript and all six of its hashers, once, so that `reset` can reuse them.
   *
   * @param hashLength 32 to hash with SHA-256, 48 to hash with SHA-384.
   */
  constructor(hashLength: i32) {
    this.hashLength = hashLength
    this.sha256 = new Sha256()
    this.sha384 = new Sha384()
    this.fresh256 = new Sha256()
    this.fresh384 = new Sha384()
    this.twin256 = new Sha256()
    this.twin384 = new Sha384()
  }

  /**
   * Starts an empty transcript over the hash `hashLength` names, in the hashers it already has.
   *
   * @internal Read by `net/tls.ts` and `net/tls/client.ts`.
   */
  reset(hashLength: i32): void {
    this.hashLength = hashLength
    hmacCopySha256(this.fresh256, this.sha256)
    hmacCopySha384(this.fresh384, this.sha384)
  }

  /**
   * Absorbs `data[off .. off + len)`, a whole handshake message or part of one.
   *
   * @param data The array that holds the message bytes.
   * @param off Where in `data` the bytes to absorb start.
   * @param len How many bytes, from `off`, to absorb.
   */
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
   *
   * @internal Read by `net/tls.ts` and `net/tls/client.ts`.
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

  /**
   * The transcript hash of everything absorbed so far, in a fresh array; the transcript goes on.
   *
   * @returns The `hashLength` bytes of the hash so far. It is public, so it is plain.
   */
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
 * `tlsDeriveSecret` in place: Derive-Secret (RFC 8446 §7.1) of `prk` with
 * `label` and the transcript hash `transcriptHash[hashOff .. hashOff +
 * hashLength)`, its HashLen bytes written at `out[0]`. The scratch is wiped
 * before it returns. It panics as `hkdfExpandLabelInto` does, a window outside
 * its array included.
 *
 * @param kdf The caller's HKDF scratch, which this computes in and wipes.
 * @param hashLength The hash length, 32 or 48, which is also how many bytes are written.
 * @param prk The stage of the schedule to derive from, plain. It stays the caller's to wipe.
 * @param label The label without its `"tls13 "` prefix, such as `"s hs traffic"`.
 * @param transcriptHash The array that holds the transcript hash.
 * @param hashOff Where in `transcriptHash` the `hashLength` bytes of the hash start.
 * @param out Where the derived secret is written, from index 0; the caller owns and wipes it.
 */
export const tlsDeriveSecretInto = (
  kdf: HkdfScratch,
  hashLength: i32,
  prk: u8[],
  label: string,
  transcriptHash: u8[],
  hashOff: i32,
  out: u8[]
): void => {
  hkdfExpandLabelInto(
    kdf,
    hashLength,
    prk,
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
 * wiped before it returns, and so is the scratch.
 *
 * @param kdf The caller's HKDF scratch, which this computes in and wipes.
 * @param hashLength The hash length, 32 or 48, which is also how many bytes are written.
 * @param handshakeSecret The handshake secret, plain. It stays the caller's to wipe.
 * @param out Where the master secret is written, from index 0; the caller owns and wipes it.
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
 *
 * @param kdf The caller's HKDF scratch, which this computes in and wipes.
 * @param hashLength The hash length, 32 or 48, which is also how many bytes are written.
 * @param baseKey The sender's handshake traffic secret, plain. It stays the caller's to wipe.
 * @param transcriptHash The array that holds the transcript hash up to the Finished message.
 * @param hashOff Where in `transcriptHash` the `hashLength` bytes of the hash start.
 * @param out Where `verify_data` is written. It goes on the wire, so it is plain.
 * @param at Where in `out` the HashLen bytes of `verify_data` start.
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
 * `tlsPskEarlySecret` in place: HKDF-Extract of `psk` under a zero salt
 * (RFC 8446 §7.1), written at `out[0]`. The scratch is wiped; the zero salt
 * holds nothing to wipe.
 *
 * @param kdf The caller's HKDF scratch, which this computes in and wipes.
 * @param hashLength The hash length, 32 or 48, which is also how many bytes are written.
 * @param psk The pre-shared key, plain. It stays the caller's to wipe.
 * @param out Where the early secret is written, from index 0; the caller owns and wipes it.
 */
export const tlsPskEarlySecretInto = (kdf: HkdfScratch, hashLength: i32, psk: u8[], out: u8[]): void => {
  hkdfExtractInto(kdf, hashLength, new Array<u8>(hashLength), psk, out, TLS_SCHEDULE_FROM)
}

/**
 * `tlsBinderKey` in place: `Derive-Secret(early, "res binder", "")`, written at `out[0]`. The scratch is
 * wiped before it returns.
 *
 * @param kdf The caller's HKDF scratch, which this computes in and wipes.
 * @param hashLength The hash length, 32 or 48, which is also how many bytes are written.
 * @param earlySecret The early secret, plain. It stays the caller's to wipe.
 * @param out Where the binder key is written, from index 0; the caller owns and wipes it.
 */
export const tlsBinderKeyInto = (kdf: HkdfScratch, hashLength: i32, earlySecret: u8[], out: u8[]): void => {
  const empty: u8[] = new Array<u8>(hashLength)
  tlsEmptyHashInto(hashLength, empty)
  tlsDeriveSecretInto(kdf, hashLength, earlySecret, "res binder", empty, TLS_SCHEDULE_FROM, out)
}

/**
 * `tlsHandshakeSalt` in place: `Derive-Secret(early, "derived", "")`, the
 * salt a resumed handshake extracts its handshake secret under, written at
 * `out[0]`. The caller wipes it once the extract is done. The scratch is wiped
 * before it returns.
 *
 * @param kdf The caller's HKDF scratch, which this computes in and wipes.
 * @param hashLength The hash length, 32 or 48, which is also how many bytes are written.
 * @param earlySecret The early secret, plain. It stays the caller's to wipe.
 * @param out Where the salt is written, from index 0.
 */
export const tlsHandshakeSaltInto = (
  kdf: HkdfScratch,
  hashLength: i32,
  earlySecret: u8[],
  out: u8[]
): void => {
  const empty: u8[] = new Array<u8>(hashLength)
  tlsEmptyHashInto(hashLength, empty)
  tlsDeriveSecretInto(kdf, hashLength, earlySecret, "derived", empty, TLS_SCHEDULE_FROM, out)
}

/**
 * `tlsResumptionPsk` in place: `HKDF-Expand-Label(resumption_master_secret,
 * "resumption", ticketNonce[nonceOff .. nonceOff + nonceLength), HashLen)`
 * (RFC 8446 §4.6.1), written at `out[0]`. The scratch is wiped before it
 * returns. A nonce window outside `ticketNonce`, or longer than 255 bytes,
 * panics, as `hkdfExpandLabelInto` does.
 *
 * @param kdf The caller's HKDF scratch, which this computes in and wipes.
 * @param hashLength The hash length, 32 or 48, which is also how many bytes are written.
 * @param resumptionMasterSecret The connection's resumption master secret, plain. It stays the caller's.
 * @param ticketNonce The array that holds the ticket's `ticket_nonce`, which is public.
 * @param nonceOff Where in `ticketNonce` the nonce starts.
 * @param nonceLength How many bytes the nonce is.
 * @param out Where the PSK is written, from index 0; the caller owns and wipes it.
 */
export const tlsResumptionPskInto = (
  kdf: HkdfScratch,
  hashLength: i32,
  resumptionMasterSecret: u8[],
  ticketNonce: u8[],
  nonceOff: i32,
  nonceLength: i32,
  out: u8[]
): void => {
  hkdfExpandLabelInto(
    kdf,
    hashLength,
    resumptionMasterSecret,
    "resumption",
    ticketNonce,
    nonceOff,
    nonceLength,
    out,
    TLS_SCHEDULE_FROM,
    hashLength
  )
}

/**
 * Whether `binder[binderOff .. binderOff + binderLength)` is the PSK binder
 * RFC 8446 §4.2.11.2 asks for: the HMAC, under `finished_key =
 * Expand-Label(binderKey, "finished", "", HashLen)`, of
 * `truncatedHash[hashOff .. hashOff + hashLength)`, the transcript hash of
 * the ClientHello up to its binders list. A binder that is not HashLen bytes
 * long, or whose window is not inside `binder`, is `false` (row 9 of
 * "Resumption" in `docs/security/tls.md`). The comparison reads every byte
 * whatever it finds; the binder the server computed is wiped before it
 * returns, as `tlsFinishedVerifyDataInto` wipes the finished key and the
 * scratch.
 *
 * @param kdf The caller's HKDF scratch, which this computes in and wipes.
 * @param hashLength The hash length, 32 or 48.
 * @param binderKey The binder key from `tlsBinderKeyInto`, plain. It stays the caller's to wipe.
 * @param truncatedHash The array that holds the hash of the ClientHello up to its binders list.
 * @param hashOff Where in `truncatedHash` the `hashLength` bytes of that hash start.
 * @param binder The array that holds the binder the client sent, usually the received ClientHello.
 * @param binderOff Where in `binder` the client's binder starts.
 * @param binderLength How many bytes the client's binder is.
 * @returns `true` when the client's binder matches the one the server computed, so the client holds the PSK.
 */
export const tlsBinderVerify = (
  kdf: HkdfScratch,
  hashLength: i32,
  binderKey: u8[],
  truncatedHash: u8[],
  hashOff: i32,
  binder: u8[],
  binderOff: i32,
  binderLength: i32
): boolean => {
  if (binderLength !== hashLength) {
    return false
  }
  const expected: u8[] = new Array<u8>(hashLength)
  tlsFinishedVerifyDataInto(kdf, hashLength, binderKey, truncatedHash, hashOff, expected, TLS_SCHEDULE_FROM)
  const verified: boolean = timingSafeEqualAt(binder, binderOff, expected, TLS_SCHEDULE_FROM, hashLength)
  secureZero(expected)
  return verified
}

/**
 * `tlsTrafficKey` and `tlsTrafficIv` in place: the AEAD key a traffic secret
 * gives `suite` (RFC 8446 §7.3) written into `key`, which must be the suite's
 * key length, and its 12-byte IV into `iv`. `false`, writing nothing, for a
 * suite this module does not negotiate, a secret that is not its hash's
 * length, or a key or IV array of the wrong length. When it derives, the
 * scratch is wiped before it returns.
 *
 * @param kdf The caller's HKDF scratch, which this computes in and wipes.
 * @param suite The negotiated cipher suite, such as `TLS_AES_128_GCM_SHA256`.
 * @param trafficSecret The traffic secret, plain, of the suite's hash length. It stays the caller's to wipe.
 * @param key Where the AEAD key is written: an array of exactly the suite's key length (16 or 32 bytes).
 * @param iv Where the IV is written: an array of exactly 12 bytes.
 * @returns `true` when the key and IV were written; `false`, with nothing written, for a bad suite or length.
 */
export const tlsTrafficKeysInto = (
  kdf: HkdfScratch,
  suite: i32,
  trafficSecret: u8[],
  key: u8[],
  iv: u8[]
): boolean => {
  const none: u8[] = []
  const hashLength: i32 = tlsSuiteHashLength(suite)
  const keyLength: i32 = tlsSuiteKeyLength(suite)
  if (
    hashLength === 0 ||
    toI32(trafficSecret.length) !== hashLength ||
    toI32(key.length) !== keyLength ||
    toI32(iv.length) !== TLS_IV_SIZE
  ) {
    return false
  }
  hkdfExpandLabelInto(
    kdf,
    hashLength,
    trafficSecret,
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
    trafficSecret,
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

// ---- The schedule into held `Secret`s --------------------------------------

/** The length of the bytes a `Secret` holds, which is public, for `expose` to read. */
const tlsHeldLength = (bytes: u8[]): i32 => toI32(bytes.length)

/** Overwrites the bytes a `Secret` holds with `from`, for `exposeWith` to run on the destination. */
const tlsHeldCopy = (held: u8[], from: u8[]): void => {
  for (let k: i32 = 0; k < toI32(held.length) && k < toI32(from.length); k++) {
    held[k] = from[k]
  }
}

/** `transcriptHash[hashOff .. hashOff + hashLength)` in a fresh array: the context a held form hands HKDF. */
const tlsHeldWindow = (hashLength: i32, transcriptHash: u8[], hashOff: i32): u8[] => {
  const window: u8[] = new Array<u8>(hashLength)
  for (let k: i32 = 0; k < toI32(window.length); k++) {
    window[k] = transcriptHash[hashOff + k]
  }
  return window
}

/**
 * Panics naming `caller` unless `hashLength` is 32 or 48 and `held` holds
 * `hashLength` bytes, as every secret of the schedule does.
 */
const tlsHeldCheck = (caller: string, hashLength: i32, held: Secret<u8[]>): void => {
  if (hashLength !== SHA256_SIZE && hashLength !== SHA384_SIZE) {
    panic(`${caller}: a hash length of ${hashLength}, not 32 or 48`)
  }
  const length: i32 = expose(held, tlsHeldLength)
  if (length !== hashLength) {
    panic(`${caller}: a secret of ${length} bytes, not ${hashLength}`)
  }
}

/** HKDF-Extract of `ikm` under `salt`, both held, written over `dst`'s bytes; the plain PRK is wiped. */
const tlsExtractHeld = (hashLength: i32, salt: Secret<u8[]>, ikm: Secret<u8[]>, dst: Secret<u8[]>): void => {
  const prk: u8[] =
    hashLength === SHA384_SIZE
      ? exposeWith(salt, ikm, tlsExtractSha384Salted)
      : exposeWith(salt, ikm, tlsExtractSha256Salted)
  exposeWith(dst, prk, tlsHeldCopy)
  wipe(prk)
}

/**
 * `tlsDeriveSecret` into a held `Secret`: Derive-Secret (RFC 8446 §7.1) of
 * `prk` with `label` and the transcript hash `transcriptHash[hashOff ..
 * hashOff + hashLength)`, written over the HashLen bytes `dst` holds. `dst`
 * may be `prk`. Panics unless `hashLength` is 32 or 48 and both hold
 * HashLen bytes.
 *
 * @param hashLength The hash length, 32 or 48.
 * @param prk The held stage of the schedule to derive from. It is only overwritten when it is also `dst`.
 * @param label The label without its `"tls13 "` prefix, such as `"c ap traffic"`.
 * @param transcriptHash The array that holds the transcript hash, which is public.
 * @param hashOff Where in `transcriptHash` the `hashLength` bytes of the hash start.
 * @param dst The held secret whose bytes the result overwrites. The caller still owns and wipes it.
 */
export const tlsDeriveSecretHeld = (
  hashLength: i32,
  prk: Secret<u8[]>,
  label: string,
  transcriptHash: u8[],
  hashOff: i32,
  dst: Secret<u8[]>
): void => {
  tlsHeldCheck("tlsDeriveSecretHeld", hashLength, prk)
  tlsHeldCheck("tlsDeriveSecretHeld", hashLength, dst)
  const context: u8[] = tlsHeldWindow(hashLength, transcriptHash, hashOff)
  if (hashLength === SHA384_SIZE) {
    hkdfExpandLabelSha384Held(dst, prk, label, context)
  } else {
    hkdfExpandLabelSha256Held(dst, prk, label, context)
  }
}

/**
 * `tlsHandshakeSecret` into a held `Secret`: HKDF-Extract of `ecdhe` under
 * `Derive-Secret(early, "derived", "")`, written over `dst`'s HashLen bytes.
 * The salt is wiped before it returns; `dst` may be `earlySecret`. Panics
 * unless `hashLength` is 32 or 48 and `earlySecret` and `dst` hold HashLen
 * bytes.
 *
 * @param hashLength The hash length, 32 or 48.
 * @param earlySecret The held early secret. It is only overwritten when it is also `dst`.
 * @param ecdhe The held shared secret of the key exchange. It stays the caller's to wipe.
 * @param dst The held secret whose bytes the handshake secret overwrites. The caller still owns and wipes it.
 */
export const tlsHandshakeSecretHeld = (
  hashLength: i32,
  earlySecret: Secret<u8[]>,
  ecdhe: Secret<u8[]>,
  dst: Secret<u8[]>
): void => {
  tlsHeldCheck("tlsHandshakeSecretHeld", hashLength, dst)
  const derived: Secret<u8[]> = secret(new Array<u8>(hashLength))
  tlsDeriveSecretHeld(
    hashLength,
    earlySecret,
    "derived",
    tlsEmptyHash(hashLength),
    TLS_SCHEDULE_FROM,
    derived
  )
  tlsExtractHeld(hashLength, derived, ecdhe, dst)
  wipe(derived)
}

/**
 * `tlsMasterSecret` into a held `Secret`: HKDF-Extract of HashLen zeros under
 * `Derive-Secret(handshake, "derived", "")`, written over `dst`'s HashLen
 * bytes. The salt and the zeros are wiped before it returns; `dst` may be
 * `handshakeSecret`. Panics unless `hashLength` is 32 or 48 and both hold
 * HashLen bytes.
 *
 * @param hashLength The hash length, 32 or 48.
 * @param handshakeSecret The held handshake secret. It is only overwritten when it is also `dst`.
 * @param dst The held secret whose bytes the master secret overwrites. The caller still owns and wipes it.
 */
export const tlsMasterSecretHeld = (
  hashLength: i32,
  handshakeSecret: Secret<u8[]>,
  dst: Secret<u8[]>
): void => {
  tlsHeldCheck("tlsMasterSecretHeld", hashLength, dst)
  const derived: Secret<u8[]> = secret(new Array<u8>(hashLength))
  tlsDeriveSecretHeld(
    hashLength,
    handshakeSecret,
    "derived",
    tlsEmptyHash(hashLength),
    TLS_SCHEDULE_FROM,
    derived
  )
  const zeros: Secret<u8[]> = secret(new Array<u8>(hashLength))
  tlsExtractHeld(hashLength, derived, zeros, dst)
  wipe(derived)
  wipe(zeros)
}

/**
 * `tlsFinishedVerifyData` from a held base key and a window of a transcript:
 * the HMAC of `transcriptHash[hashOff .. hashOff + hashLength)` under
 * `finished_key = Expand-Label(baseKey, "finished", "", HashLen)` (RFC 8446
 * §4.4.4). The finished key is held and wiped before it returns;
 * `verify_data` goes on the wire, so it is plain. Panics unless `hashLength`
 * is 32 or 48 and `baseKey` holds HashLen bytes.
 *
 * @param hashLength The hash length, 32 or 48.
 * @param baseKey The sender's held handshake traffic secret. It stays the caller's: this does not wipe it.
 * @param transcriptHash The array that holds the transcript hash up to the Finished message.
 * @param hashOff Where in `transcriptHash` the `hashLength` bytes of the hash start.
 * @returns The HashLen bytes of `verify_data`, plain, in a fresh array.
 */
export const tlsFinishedVerifyDataHeld = (
  hashLength: i32,
  baseKey: Secret<u8[]>,
  transcriptHash: u8[],
  hashOff: i32
): u8[] => {
  tlsHeldCheck("tlsFinishedVerifyDataHeld", hashLength, baseKey)
  const none: u8[] = []
  const finishedKey: Secret<u8[]> = secret(new Array<u8>(hashLength))
  if (hashLength === SHA384_SIZE) {
    hkdfExpandLabelSha384Held(finishedKey, baseKey, "finished", none)
  } else {
    hkdfExpandLabelSha256Held(finishedKey, baseKey, "finished", none)
  }
  const transcript: u8[] = tlsHeldWindow(hashLength, transcriptHash, hashOff)
  const verifyData: u8[] =
    hashLength === SHA384_SIZE
      ? hmacSha384Secret(finishedKey, transcript)
      : hmacSha256Secret(finishedKey, transcript)
  wipe(finishedKey)
  return verifyData
}

/**
 * `tlsTrafficKeysInto` from a held traffic secret: the AEAD key it gives
 * `suite` (RFC 8446 §7.3) written into `key`, which must be the suite's key
 * length, and its 12-byte IV into `iv`. Both stay plain, since the cipher
 * reads them. `false`, writing nothing, for a suite this module does not
 * negotiate, a secret that is not its hash's length, or a key or IV array of
 * the wrong length.
 *
 * @param suite The negotiated cipher suite, such as `TLS_AES_128_GCM_SHA256`.
 * @param trafficSecret The held traffic secret, of the suite's hash length. It stays the caller's to wipe.
 * @param key Where the AEAD key is written: an array of exactly the suite's key length (16 or 32 bytes).
 * @param iv Where the IV is written: an array of exactly 12 bytes.
 * @returns `true` when the key and IV were written; `false`, with nothing written, for a bad suite or length.
 */
export const tlsTrafficKeysFromHeld = (
  suite: i32,
  trafficSecret: Secret<u8[]>,
  key: u8[],
  iv: u8[]
): boolean => {
  const none: u8[] = []
  const hashLength: i32 = tlsSuiteHashLength(suite)
  const keyLength: i32 = tlsSuiteKeyLength(suite)
  if (
    hashLength === 0 ||
    expose(trafficSecret, tlsHeldLength) !== hashLength ||
    toI32(key.length) !== keyLength ||
    toI32(iv.length) !== TLS_IV_SIZE
  ) {
    return false
  }
  hkdfExpandLabelHeldInto(hashLength, trafficSecret, "key", none, key, TLS_SCHEDULE_FROM, keyLength)
  hkdfExpandLabelHeldInto(hashLength, trafficSecret, "iv", none, iv, TLS_SCHEDULE_FROM, TLS_IV_SIZE)
  return true
}
