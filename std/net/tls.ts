/**
 * `nish/net/tls` — the server side of a TLS 1.3 handshake (RFC 8446), from
 * the client's first ClientHello to its Finished, carrier-agnostic and
 * sans-IO.
 *
 *     import { TlsServer, TLS_LEVEL_INITIAL } from "nish/net/tls";
 *
 *     const server = new TlsServer(config, serverRandom, x25519Private);
 *     const alert: i32 = server.receive(TLS_LEVEL_INITIAL, bytes, 0, n);
 *     // …and for the slot's next connection:
 *     server.restart(nextRandom, nextPrivate);
 *     // send server.takeOutput(TLS_LEVEL_INITIAL), install the handshake
 *     // secrets, sign server.signatureInput(), call server.sign(signature), …
 *
 * **Carrier-agnostic.** The server reads and writes handshake *messages*, not
 * records or packets. Bytes go in and come out tagged with the level they
 * belong to — Initial (cleartext: ClientHello, ServerHello), Handshake
 * (EncryptedExtensions through both Finished messages) or Application — and
 * the secrets for each level are readable as soon as they are known. TLS over
 * TCP (WP34 T2) wraps a level's bytes in records protected under that level's
 * secret; QUIC (Q2) puts them in CRYPTO frames of the matching packet number
 * space (RFC 9001 §4.1.3). Neither needs anything else from here.
 *
 * **Sans-IO.** Nothing here reads a socket, a clock or the random device. The
 * server random and the ephemeral private key (32 bytes, the x25519 key or,
 * its top bit cleared, the secp256r1 scalar) are constructor arguments, so a test injects RFC 8448's and a server draws them with
 * `crypto.getRandomValues`. Signing is handed off the same way: once the
 * Certificate is written the server stops at `TLS_STATE_WAIT_SIGNATURE`, the
 * caller signs `signatureInput()` with its own key (`tlsSignEcdsaP256` for a
 * P-256 key) and hands the signature to `sign`. That keeps the private key out
 * of this module, and it lets RFC 8448's trace, which signs with RSA-PSS, be
 * replayed with its own signature.
 *
 * **What is negotiated.** TLS 1.3 only. The suites `TLS_AES_128_GCM_SHA256`,
 * `TLS_CHACHA20_POLY1305_SHA256` and `TLS_AES_256_GCM_SHA384`, the first of
 * them the client lists; the group x25519 whenever the client lists it, and
 * secp256r1 for a client that lists only that; the configuration's one
 * signature scheme. A client that lists the chosen group in `supported_groups`
 * without a share for it gets one HelloRetryRequest (§4.1.4), and a second
 * ClientHello still without the share is refused. A secp256r1 share must be
 * an uncompressed point on the curve (§4.2.8.2); any other is
 * `illegal_parameter`. `server_name` is read and exposed as `serverName`.
 * ALPN picks the first of the configuration's protocols the client offers.
 * `quic_transport_parameters` is read and written only when the configuration
 * says the carrier is QUIC. 0-RTT and client authentication are not here:
 * an early-data offer is ignored.
 *
 * **Resumption.** A server the carrier calls `enableTickets` on, over TCP only,
 * resumes with a session ticket in `psk_dhe_ke` mode (RFC 8446 §2.2, §4.2.11)
 * and issues one after each handshake. The ticket keys and the strike register
 * are the program's, lent to each call and never kept: a ClientHello that
 * offers a ticket stops at `TLS_STATE_WAIT_TICKET`, and `resume` reads the
 * identities in the client's order, verifies the binder of the one it selects,
 * records its id, and answers a resumed flight — or a full handshake when no
 * identity can be used (`docs/security/tls.md`, "Resumption").
 *
 *  Once connected, `issue` writes one NewSessionTicket at the Application level.
 *  Sealing draws the ticket's nonce and `issue` the `ticket_age_add` from the
 *  random device; nothing else here does. Over QUIC the hand-off is never
 *  called, so a PSK offer gets a full handshake.
 *
 * **Refusals are alerts.** `receive` and `sign` answer 0 or a TLS alert
 * description (`TLS_ALERT_*` in `nish/net/tls/codec`); after one the server
 * is in `TLS_STATE_FAILED` and answers the same alert to every call. Nothing
 * the peer sends can make it panic.
 *
 * **Secrets.** Every secret the server holds is a `Secret` (`nish:secret`): the
 * ECDHE secret and the words it is computed in, wiped on every path; the
 * ephemeral key, copied into the `ephemeral` field by `restart` with the
 * caller's array zeroed; and the handshake, traffic, exporter and resumption
 * secrets, and a resumed handshake's PSK, early secret and binder key, fields
 * of the two `TlsSecretPool`s, read only inside `expose`.
 *
 *  `wipe` zeroes them all, and `restart` calls it before the next connection;
 *  the carriers call it when a connection ends, and `wipeSecret` and
 *  `wipeEphemeral` as each secret's work is done. `fail` wipes the resumption
 *  master secret and the PSK's secrets, and `issue` the resumption master secret
 *  once the ticket is sealed (CLAUDE.md §Security; TLS-1 in
 *  `docs/security/tls.md`).
 *
 * **Memory.** A `TlsServer` keeps its state in buffers it allocates once —
 * the messages in and out, the transcript, the secrets, the HKDF scratch —
 * and `restart` hands them to the next connection, so a carrier that keeps
 * one per slot runs every handshake after the first without moving the arena
 * (TLS-3; `tests/link/net_tls_memory`). What a message allocates on the way
 * dies inside a `using a = arena()` block or an arena scope of its own.
 *
 * The state is a class and a `switch`, with no closures. Written from RFC
 * 8446, RFC 7301, RFC 6066 and RFC 9001, not ported from another
 * implementation.
 */
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"
import { HkdfScratch } from "nish/crypto/hkdf"
import { hmacSha256, hmacSha384 } from "nish/crypto/hmac"
import { SHA256_SIZE } from "nish/crypto/sha256"
import { SHA384_SIZE } from "nish/crypto/sha512"
import {
  P256SignScratch,
  P256_SIGNATURE_SIZE,
  p256Ecdh,
  p256PublicKey,
  p256SignSha256,
  p256SignSha256Into,
} from "nish/crypto/p256"
import { timingSafeEqual, timingSafeEqualAt } from "nish/crypto/ct"
import { X25519_SIZE, x25519, x25519Base } from "nish/crypto/x25519"
import {
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_DECRYPT_ERROR,
  TLS_ALERT_HANDSHAKE_FAILURE,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_MISSING_EXTENSION,
  TLS_ALERT_NO_APPLICATION_PROTOCOL,
  TLS_ALERT_PROTOCOL_VERSION,
  TLS_ALERT_UNEXPECTED_MESSAGE,
  TLS_GROUP_SECP256R1,
  TLS_GROUP_X25519,
  TLS_HANDSHAKE_CLIENT_HELLO,
  TLS_HANDSHAKE_FINISHED,
  TLS_RANDOM_SIZE,
  TLS_VERSION_13,
  TLS_P256_SHARE_SIZE,
  TLS_X25519_SHARE_SIZE,
  TlsClientHelloView,
  tlsHexInto,
  tlsReadClientHello,
  tlsWindowHasU16,
  tlsWindowString,
  tlsWriteCertificate,
  tlsWriteCertificateVerify,
  tlsWriteCertificateVerifyContent,
  tlsWriteEncryptedExtensions,
  tlsWriteFinished,
  tlsSelectPskIdentity,
  tlsWriteHelloRetryRequest,
  tlsWriteNewSessionTicket,
  tlsWriteServerHello,
  tlsWriteServerHelloPsk,
} from "nish/net/tls/codec"
import {
  TLS_AES_256_GCM_SHA384,
  TlsTranscript,
  tlsBinderKeyInto,
  tlsBinderVerify,
  tlsDeriveSecretInto,
  tlsFinishedVerifyDataInto,
  tlsHandshakeSaltInto,
  tlsMasterSecretInto,
  tlsPskEarlySecretInto,
  tlsResumptionPskInto,
  tlsSuiteHashLength,
} from "nish/net/tls/schedule"
import {
  TLS_TICKET_LIFETIME_SECONDS,
  TLS_TICKET_PSK_MAX,
  TLS_TICKET_SERVER_NAME_MAX,
  TlsTicketKeyInfo,
  TlsTicketState,
  TlsTicketStrikes,
  tlsTicketOpen,
  tlsTicketSeal,
  tlsTicketSize,
} from "nish/net/tls/ticket"

// ---- Levels ------------------------------------------------------------------

/** Cleartext: ClientHello, HelloRetryRequest and ServerHello (QUIC's Initial packets). */
export const TLS_LEVEL_INITIAL: i32 = 0
/** Under the handshake traffic secrets: EncryptedExtensions through both Finished messages. */
export const TLS_LEVEL_HANDSHAKE: i32 = 1
/** Under the application traffic secrets: the one NewSessionTicket `issue` writes. */
export const TLS_LEVEL_APPLICATION: i32 = 2

// ---- States --------------------------------------------------------------------

/** Waiting for a ClientHello at the Initial level, the first or the one after a HelloRetryRequest. */
export const TLS_STATE_WAIT_CLIENT_HELLO: i32 = 0
/** The Certificate is written; `signatureInput()` is ready and `sign` is due. */
export const TLS_STATE_WAIT_SIGNATURE: i32 = 1
/** The server's flight is written; waiting for the client's Finished at the Handshake level. */
export const TLS_STATE_WAIT_FINISHED: i32 = 2
/** The client's Finished verified. Application data may flow both ways. */
export const TLS_STATE_CONNECTED: i32 = 3
/** An alert was answered; `alert` holds it, and every later call answers it again. */
export const TLS_STATE_FAILED: i32 = 4
/** A ClientHello offered a ticket to a server with tickets on; `resume` is due, with the keys and the strike register. */
export const TLS_STATE_WAIT_TICKET: i32 = 5

/**
 * The longest handshake message accepted, in bytes. A ClientHello carrying a
 * post-quantum share is a few kilobytes; nothing a client sends a TLS 1.3
 * server comes near this, and the cap is what bounds the buffer a peer can
 * make the server hold.
 */
export const TLS_MAX_HANDSHAKE_MESSAGE: i32 = 65536

/** SSL 3.0's version number; a ClientHello whose `legacy_version` is this or below is refused (RFC 8446 §D.5). */
const TLS_SSL3_VERSION: i32 = 0x0300

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_FROM: i32 = 0

/**
 * What a server is configured with, the same for every connection. An
 * interface, so a caller writes it as an object literal.
 */
export interface TlsServerConfig {
  /** DER certificates, leaf first. At least one. */
  certificateChain: u8[][]
  /**
   * The ALPN protocols the server speaks, most preferred first. Empty means
   * the server does not negotiate ALPN over TCP, and refuses every client
   * over QUIC, where ALPN is mandatory (RFC 9001 §8.1).
   */
  alpn: string[]
  /** The server's transport parameters, opaque, sent in EncryptedExtensions only when `quic`. */
  quicTransportParameters: u8[]
  /**
   * Extensions this module does not interpret, already encoded (each a type,
   * a length and a body), written first in EncryptedExtensions:
   * `record_size_limit` is the record layer's, for one. Empty for none.
   */
  extraExtensions: u8[]
  /**
   * The signature scheme the caller's key signs with, sent in
   * CertificateVerify: `TLS_SIGNATURE_ECDSA_SECP256R1_SHA256` for a P-256
   * key. A client that does not list it is refused with `handshake_failure`.
   */
  signatureScheme: i32
  /** Whether the carrier is QUIC, which turns `quic_transport_parameters` on both ways. */
  quic: boolean
}

/** The most a 24-bit length can say: the bound on a handshake message's body (RFC 8446 §4). */
const TLS_MAX_U24: i32 = 16777215

/**
 * Whether `config` can be written at all: at least one certificate, every
 * certificate and the whole Certificate message within their 24-bit lengths,
 * every ALPN protocol 1 to 255 bytes, and EncryptedExtensions' extensions
 * within their 16-bit length. A configuration that breaks one would make the
 * server write a message whose length field is wrong, so the constructor
 * refuses it instead.
 */
const tlsConfigFits = (config: TlsServerConfig): boolean => {
  if (toI32(config.certificateChain.length) === 0) {
    return false
  }
  // The request context (1) and the list's length (3), then per certificate
  // its length (3), its bytes and its empty extensions (2).
  let certificate: i32 = 4
  for (const der of config.certificateChain) {
    const n: i32 = toI32(der.length)
    if (n < 1 || n > TLS_MAX_U24 - certificate - 5) {
      return false
    }
    certificate = certificate + 5 + n
  }
  // ALPN's type, lengths and the one name (at most 4 + 2 + 1 + 255), the
  // server_name acknowledgement (4), and the transport parameters' type and
  // length (4), beside what the caller passes through.
  const extensions: i32 =
    266 + toI32(config.extraExtensions.length) + toI32(config.quicTransportParameters.length)
  for (const protocol of config.alpn) {
    const n: i32 = toI32(protocol.length)
    if (n < 1 || n > 255) {
      return false
    }
  }
  return extensions <= 65535
}

/**
 * Whether the bytes `data[at .. at + length)` spell `text`, one character a
 * byte: ALPN's byte-wise comparison (RFC 7301 §3.2), and the one a host name
 * is held to against the last.
 */
const tlsBytesSpell = (data: u8[], at: i32, length: i32, text: string): boolean => {
  if (toI32(text.length) !== length) {
    return false
  }
  for (
    let k: i32 = 0;
    k < length && k < toI32(text.length) && at + k >= 0 && at + k < toI32(data.length);
    k++
  ) {
    if (toI32(data[at + k]) !== toI32(text.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** The shortest and longest DER `ECDSA-Sig-Value` of a P-256 signature: a SEQUENCE of two INTEGERs of 1 to 33 bytes. */
const TLS_P256_DER_MIN: i32 = 8
const TLS_P256_DER_MAX: i32 = 72

/**
 * The body length of the minimal DER INTEGER for the unsigned big-endian
 * magnitude `rs[at .. at + 32)`: leading zeros dropped, one added when the top
 * bit is set, and zero one zero octet rather than an empty integer (X.690
 * §8.3.1).
 */
const tlsDerIntegerLength = (rs: u8[], at: i32): i32 => {
  let first: i32 = 0
  while (first < 31 && at + first >= 0 && at + first < toI32(rs.length) && toI32(rs[at + first]) === 0) {
    first++
  }
  const top: boolean = at + first >= 0 && at + first < toI32(rs.length) && toI32(rs[at + first]) >= 0x80
  return 32 - first + (top ? 1 : 0)
}

/** That INTEGER, of body length `length`, written at `out[to ..)`; answers where it ends. */
const tlsDerIntegerInto = (out: u8[], to: i32, rs: u8[], at: i32, length: i32): i32 => {
  const end: i32 = to + 2 + length
  if (to < 0 || end > toI32(out.length)) {
    return end
  }
  out[to] = toU8(0x02)
  out[to + 1] = toU8(length)
  for (let k: i32 = 0; k < length; k++) {
    // The body's last `length` bytes are the magnitude's, a zero first when it is 33.
    const from: i32 = at + 32 - length + k
    const j: i32 = to + 2 + k
    if (j >= 0 && j < toI32(out.length)) {
      out[j] = from >= at && from >= 0 && from < toI32(rs.length) ? rs[from] : toU8(0)
    }
  }
  return end
}

/** The length of `rs`'s DER `ECDSA-Sig-Value`: the SEQUENCE's two bytes and two INTEGERs. */
const tlsEcdsaDerLength = (rs: u8[]): i32 =>
  6 + tlsDerIntegerLength(rs, TLS_FROM) + tlsDerIntegerLength(rs, 32)

/** `rs`'s DER `ECDSA-Sig-Value` into all of `der`, which is `tlsEcdsaDerLength(rs)` bytes. At most 72, so the length is one short-form byte. */
const tlsEcdsaDerInto = (der: u8[], rs: u8[]): void => {
  if (toI32(der.length) < 2) {
    return
  }
  der[0] = toU8(0x30)
  der[1] = toU8(toI32(der.length) - 2)
  const r: i32 = tlsDerIntegerLength(rs, TLS_FROM)
  tlsDerIntegerInto(der, tlsDerIntegerInto(der, 2, rs, TLS_FROM, r), rs, 32, tlsDerIntegerLength(rs, 32))
}

/**
 * An ECDSA signature `r || s` (32 bytes each, as `nish/crypto/p256` answers
 * it) as the DER `ECDSA-Sig-Value` a CertificateVerify carries (RFC 8446
 * §4.2.3), or `null` when `rs` is not 64 bytes.
 *
 * @param rs The signature's `r` then `s`, 32 big-endian bytes each.
 * @returns A fresh array of 8 to 72 bytes holding the DER encoding, or `null`.
 */
export const tlsEcdsaDerSignature = (rs: u8[]): u8[] | null => {
  if (toI32(rs.length) !== 64) {
    return null
  }
  const der: u8[] = new Array<u8>(tlsEcdsaDerLength(rs))
  tlsEcdsaDerInto(der, rs)
  return der
}

/**
 * Signs a CertificateVerify input for `ecdsa_secp256r1_sha256` with the P-256
 * private key `priv`: `p256SignSha256` (RFC 6979's deterministic nonce), DER
 * encoded. `null` for a malformed key. The answer is what `TlsServer.sign`
 * takes. The key is borrowed, as every `Secret` parameter is: the caller made
 * it, and wipes it.
 *
 * @param priv The server's P-256 private key, borrowed.
 * @param content The CertificateVerify input, as `TlsServer.signatureInput` answers it.
 * @returns A fresh array holding the DER signature, or `null` for a malformed key.
 */
export const tlsSignEcdsaP256 = (priv: Secret<u8[]>, content: u8[]): u8[] | null => {
  const rs: u8[] | null = p256SignSha256(priv, content)
  if (rs === null) {
    return null
  }
  return tlsEcdsaDerSignature(rs)
}

/**
 * Signs CertificateVerify inputs for `ecdsa_secp256r1_sha256` with nothing
 * kept per signature: `tlsSignEcdsaP256`'s answer, made in a
 * `P256SignScratch` and handed back in one of this signer's own arrays, one
 * per DER length (8 to 72 bytes), since `TlsServer.sign` takes the
 * signature's length from its array and stores what it computes, so a
 * signature it is handed cannot be a temporary. A carrier keeps one signer,
 * not one per slot: signing is synchronous, and the array it answers is read
 * by `sign` before the next signature replaces it.
 */
export class TlsP256Signer {
  /** The P-256 signer's scratch. */
  private scratch: P256SignScratch
  /** `r || s` as `p256SignSha256Into` writes it. */
  private rs: u8[]
  /** The DER signatures, index `length - TLS_P256_DER_MIN`. */
  private ders: u8[][]

  /**
   * Makes the signer's scratch and one signature array per DER length, so a
   * signature keeps nothing: the P-256 step releases what it allocates per
   * call, and the DER is written into one of these arrays.
   */
  constructor() {
    this.scratch = new P256SignScratch()
    this.rs = new Array<u8>(P256_SIGNATURE_SIZE)
    this.ders = []
    for (let length: i32 = TLS_P256_DER_MIN; length <= TLS_P256_DER_MAX; length++) {
      this.ders.push(new Array<u8>(length))
    }
  }

  /**
   * `tlsSignEcdsaP256(priv, content)`, byte for byte, in the array of this
   * signer's that has its length; `null` for a malformed key. It keeps
   * nothing: the P-256 signature releases what it allocated, and the DER is
   * written in place. The key is borrowed.
   *
   * @param priv The server's P-256 private key, borrowed.
   * @param content The CertificateVerify input, as `TlsServer.signatureInput` answers it.
   * @returns One of this signer's own arrays, which a later `sign` of the same length overwrites, or `null`.
   */
  sign(priv: Secret<u8[]>, content: u8[]): u8[] | null {
    if (
      !p256SignSha256Into(this.scratch, priv, content, TLS_FROM, toI32(content.length), this.rs, TLS_FROM)
    ) {
      return null
    }
    const at: i32 = tlsEcdsaDerLength(this.rs) - TLS_P256_DER_MIN
    if (at < 0 || at >= toI32(this.ders.length)) {
      return null
    }
    const der: u8[] = this.ders[at]
    tlsEcdsaDerInto(der, this.rs)
    return der
  }
}

/**
 * Whether an x25519 shared secret is all zeros, reading every byte (run inside `expose`).
 *
 * @param shared The exposed shared secret, `X25519_SIZE` bytes.
 * @returns True when every byte is zero (a low-order peer share, RFC 7748 §6.1), which the handshake refuses.
 */
export const tlsIsZeroSecret = (shared: u8[]): boolean => timingSafeEqual(shared, new Array<u8>(X25519_SIZE))

/**
 * `Derive-Secret(early, "derived", "")` with no PSK, the salt a full handshake's
 * secret is extracted under: a constant of the hash alone (RFC 8448 §3 prints
 * the SHA-256 one; the SHA-384 one was computed with Python's hmac and
 * hashlib). It is written out rather than derived because the functions below
 * run on the ECDHE secret inside `expose`, and Expand-Label may panic with a
 * computed message, which such a function may not reach. A resumed
 * handshake's salt is derived from the PSK's early secret by `resume`, before
 * the exchange, and reaches it the same way: as words.
 */
const TLS_DERIVED_SALT_SHA256: string = "6f2615a108c702c5678f54fc9dbab69716c076189c48250cebeac3576c3611ba"
const TLS_DERIVED_SALT_SHA384: string =
  "1591dac5cbbf0330a4a84de9c753330e92d01f0a88214b4464972fd668049e93e52f2b16fad922fdc0584478428f282b"

/**
 * The SHA-256 handshake secret: HKDF-Extract of the ECDHE secret under `salt`
 * (run inside `exposeWith`). The salt is always HashLen bytes, so this is the
 * HMAC itself: `hkdfExtractSha256` would pass it through `hkdfSalt`, which the
 * checker reads as a write through the argument `exposeWith` hands it.
 */
const tlsHandshakeFromEcdhe256 = (ecdhe: u8[], salt: u8[]): u8[] => hmacSha256(salt, ecdhe)

/** The SHA-384 handshake secret: HKDF-Extract of the ECDHE secret under `salt`, as the SHA-256 one is. */
const tlsHandshakeFromEcdhe384 = (ecdhe: u8[], salt: u8[]): u8[] => hmacSha384(salt, ecdhe)

/**
 * Wipes the bytes a `Secret` holds, for `exposeWith` to run on one secret of a holder outside its `wipe()`.
 *
 * @param held The exposed bytes, zeroed in place.
 * @param answer The value to hand back, so a caller can wipe and answer in one expression.
 * @returns `answer`, unchanged.
 */
export const tlsZeroHeld = (held: u8[], answer: i32): i32 => {
  wipe(held)
  return answer
}

/**
 * Overwrites the bytes a `Secret` holds with `from`'s, for `exposeWith` to run on the destination.
 * Only as many bytes as the shorter of the two holds are copied; the rest of `held` is left as it was.
 *
 * @param held The destination's exposed bytes, written in place.
 * @param from The bytes to copy in, read from index 0.
 * @returns 0.
 */
export const tlsHeldCopyIn = (held: u8[], from: u8[]): i32 => {
  for (let k: i32 = 0; k < toI32(held.length) && k < toI32(from.length); k++) {
    held[k] = from[k]
  }
  return 0
}

/**
 * A plain copy of a held secret, for a derivation that runs on its bytes
 * inside a `using arena()` block: the copy dies with the block, and its
 * caller `secureZero`s it before the block ends.
 *
 * @param held The exposed bytes to copy.
 * @returns A fresh plain array of the same length, which the caller must wipe.
 */
export const tlsHeldClone = (held: u8[]): u8[] => {
  const copy: u8[] = new Array<u8>(held.length)
  for (let k: i32 = 0; k < toI32(copy.length) && k < toI32(held.length); k++) {
    copy[k] = held[k]
  }
  return copy
}

/**
 * Copies the bytes one `Secret` holds over another's, for `exposeWith` to
 * run on the source with the destination as its argument: no plain copy is
 * made on the way. Answers 0.
 *
 * @param from The source's exposed bytes.
 * @param to The destination secret, borrowed; as many bytes as the shorter of the two holds are overwritten.
 * @returns 0.
 */
export const tlsHeldCopyOver = (from: u8[], to: Secret<u8[]>): i32 => exposeWith(to, from, tlsHeldCopyIn)

// ---- The exchange, in a scope of its own --------------------------------------

/**
 * The ECDHE exchange's inputs and answers as big-endian 64-bit words: the
 * group, the ephemeral private key and the client's share in (32 bytes for
 * x25519, a 65-byte point for secp256r1, so nine share words), the server's
 * public key and the handshake secret out, and the alert. It is a class of
 * numbers and nothing else on purpose. `x25519` and `p256Ecdh` answer their
 * shared secret as a `Secret`,
 * which is an allocation it stores, so neither an automatic arena scope nor a
 * `using a = arena()` block may be put around a call to it (NL2424). A
 * function whose every parameter is an object of numbers can be handed no
 * memory a pointer fits in, so everything it and its callees allocate is
 * garbage when it returns, and the compiler gives it a scope of its own
 * (docs/LANGUAGE.md, "Memory model", item 2): `tlsExchange` takes only this.
 *
 * Its fields must stay numbers: one that could hold a pointer would cost
 * `tlsExchange` that scope without a word from the compiler, and only
 * `tests/link/net_tls_memory` would notice.
 *
 * The words hold secrets — the private key and the handshake secret — in
 * fields, where `secureZero` cannot reach, so `exchangeKeys` wipes the whole
 * record with `wipe`, a volatile store, once it has unpacked the answers, on
 * the failure path too (TLS-1 in `docs/security/tls.md`).
 */
class TlsExchangeWords {
  /** `TLS_GROUP_X25519` or `TLS_GROUP_SECP256R1`: which exchange to run. */
  group: i32 = 0
  key0: u64 = 0
  key1: u64 = 0
  key2: u64 = 0
  key3: u64 = 0
  share0: u64 = 0
  share1: u64 = 0
  share2: u64 = 0
  share3: u64 = 0
  share4: u64 = 0
  share5: u64 = 0
  share6: u64 = 0
  share7: u64 = 0
  share8: u64 = 0
  public0: u64 = 0
  public1: u64 = 0
  public2: u64 = 0
  public3: u64 = 0
  public4: u64 = 0
  public5: u64 = 0
  public6: u64 = 0
  public7: u64 = 0
  public8: u64 = 0
  secret0: u64 = 0
  secret1: u64 = 0
  secret2: u64 = 0
  secret3: u64 = 0
  secret4: u64 = 0
  secret5: u64 = 0
  /**
   * The salt the handshake secret is extracted under, `hashLength` bytes of
   * it: the `TLS_DERIVED_SALT_*` constant on a full handshake, the salt
   * derived from the PSK early secret on a resumed one.
   *
   * @internal Read by the free functions of this module; `TlsServer.exchangeKeys` writes it.
   */
  salt0: u64 = 0
  /** @internal Read by the free functions of this module; `TlsServer.exchangeKeys` writes it. */
  salt1: u64 = 0
  /** @internal Read by the free functions of this module; `TlsServer.exchangeKeys` writes it. */
  salt2: u64 = 0
  /** @internal Read by the free functions of this module; `TlsServer.exchangeKeys` writes it. */
  salt3: u64 = 0
  /** @internal Read by the free functions of this module; `TlsServer.exchangeKeys` writes it. */
  salt4: u64 = 0
  /** @internal Read by the free functions of this module; `TlsServer.exchangeKeys` writes it. */
  salt5: u64 = 0
  /** 32 or 48: which handshake secret to extract. */
  hashLength: i32 = 0
}

/** The eight bytes `b[at .. at + 8)` as a big-endian word; a byte outside `b` reads as zero. */
const tlsWordAt = (b: u8[], at: i32): u64 => {
  let v: u64 = 0
  for (let k: i32 = 0; k < 8; k++) {
    const byte: u64 = at + k >= 0 && at + k < toI32(b.length) ? toU64(b[at + k]) : toU64(0)
    v = (v << toU64(8)) | byte
  }
  return v
}

/** `v` big-endian into `b[at .. at + 8)`; a byte outside `b` is dropped. */
const tlsWordInto = (b: u8[], at: i32, v: u64): void => {
  for (let k: i32 = 0; k < 8; k++) {
    const shift: i32 = (7 - k) << 3
    if (at + k >= 0 && at + k < toI32(b.length)) {
      b[at + k] = toU8(v >> toU64(shift))
    }
  }
}

/** Unpacks the handshake secret from the exchange's words into the bytes a `Secret` holds, for `exposeWith`. */
const tlsHandshakeFromWords = (held: u8[], w: TlsExchangeWords): i32 => {
  tlsWordInto(held, 0, w.secret0)
  tlsWordInto(held, 8, w.secret1)
  tlsWordInto(held, 16, w.secret2)
  tlsWordInto(held, 24, w.secret3)
  tlsWordInto(held, 32, w.secret4)
  tlsWordInto(held, 40, w.secret5)
  return 0
}

/**
 * The exchange of RFC 8446 §7.4.2 on `w`, in `w.group`: the server's public
 * key and the handshake secret from the ephemeral key and the client's share,
 * both written back as words; the caller wipes the words. Answers 0;
 * `illegal_parameter` for an x25519 share whose shared secret is all zeros
 * (§7.4.2, RFC 7748 §6.1) or a secp256r1 share that is not a point on the
 * curve (§4.2.8.2, which `p256Ecdh` checks); or `internal_error` when the
 * server's own public key cannot be made. A secp256r1 key is the same 32
 * bytes with the top bit cleared, so the scalar is below the group order. The
 * copy of the key and the ECDHE secret are `Secret`s wiped on every path, and
 * the handshake secret's bytes with `secureZero` once they are words. The
 * compiler brackets this function with an arena scope of its own (see
 * `TlsExchangeWords`), so what x25519 and HKDF allocate is gone when it
 * returns.
 */
const tlsExchange = (w: TlsExchangeWords): i32 => {
  const salt: u8[] = new Array<u8>(w.hashLength === SHA384_SIZE ? SHA384_SIZE : SHA256_SIZE)
  tlsWordInto(salt, 0, w.salt0)
  tlsWordInto(salt, 8, w.salt1)
  tlsWordInto(salt, 16, w.salt2)
  tlsWordInto(salt, 24, w.salt3)
  tlsWordInto(salt, 32, w.salt4)
  tlsWordInto(salt, 40, w.salt5)
  const p256: boolean = w.group === TLS_GROUP_SECP256R1
  const raw: u8[] = new Array<u8>(X25519_SIZE)
  tlsWordInto(raw, 0, w.key0)
  tlsWordInto(raw, 8, w.key1)
  tlsWordInto(raw, 16, w.key2)
  tlsWordInto(raw, 24, w.key3)
  if (p256) {
    // Below 2^255, so below the order n: only all zeros is refused.
    raw[0] = raw[0] & toU8(0x7f)
  }
  const share: u8[] = new Array<u8>(p256 ? TLS_P256_SHARE_SIZE : X25519_SIZE)
  tlsWordInto(share, 0, w.share0)
  tlsWordInto(share, 8, w.share1)
  tlsWordInto(share, 16, w.share2)
  tlsWordInto(share, 24, w.share3)
  tlsWordInto(share, 32, w.share4)
  tlsWordInto(share, 40, w.share5)
  tlsWordInto(share, 48, w.share6)
  tlsWordInto(share, 56, w.share7)
  tlsWordInto(share, 64, w.share8)
  const key: Secret<u8[]> = secret(raw)
  const serverPublic: u8[] | null = p256 ? p256PublicKey(key) : x25519Base(key)
  const shared: Secret<u8[]> | null = p256 ? p256Ecdh(key, share) : x25519(key, share)
  wipe(key)
  let alert: i32 = 0
  if (shared === null) {
    // x25519 answers for every share; `p256Ecdh` refuses a point off the
    // curve (§4.2.8.2), or a key `p256PublicKey` refused too.
    alert = p256 && serverPublic !== null ? TLS_ALERT_ILLEGAL_PARAMETER : TLS_ALERT_INTERNAL_ERROR
  } else {
    // RFC 7748 §6.1 leaves the all-zero check to the protocol, and RFC 8446
    // §7.4.2 makes it: a low-order client share gives the zero secret, which
    // anybody can compute. The secret is secret, so the compare reads it all.
    // RFC 8446 asks it of x25519 alone: a secp256r1 share is checked as a point.
    if (serverPublic === null) {
      alert = TLS_ALERT_INTERNAL_ERROR
    } else if (!p256 && expose(shared, tlsIsZeroSecret)) {
      alert = TLS_ALERT_ILLEGAL_PARAMETER
    } else {
      const handshake: u8[] =
        w.hashLength === SHA384_SIZE
          ? exposeWith(shared, salt, tlsHandshakeFromEcdhe384)
          : exposeWith(shared, salt, tlsHandshakeFromEcdhe256)
      w.public0 = tlsWordAt(serverPublic, 0)
      w.public1 = tlsWordAt(serverPublic, 8)
      w.public2 = tlsWordAt(serverPublic, 16)
      w.public3 = tlsWordAt(serverPublic, 24)
      w.public4 = tlsWordAt(serverPublic, 32)
      w.public5 = tlsWordAt(serverPublic, 40)
      w.public6 = tlsWordAt(serverPublic, 48)
      w.public7 = tlsWordAt(serverPublic, 56)
      w.public8 = tlsWordAt(serverPublic, 64)
      w.secret0 = tlsWordAt(handshake, 0)
      w.secret1 = tlsWordAt(handshake, 8)
      w.secret2 = tlsWordAt(handshake, 16)
      w.secret3 = tlsWordAt(handshake, 24)
      w.secret4 = tlsWordAt(handshake, 32)
      w.secret5 = tlsWordAt(handshake, 40)
      secureZero(handshake)
    }
    wipe(shared)
  }
  // One wipe every path reaches, before the one return: a wipe on each path
  // is one `opt -O2` may merge (docs/security/tls.md, "What stays in memory").
  secureZero(salt)
  return alert
}

// ---- Buffers -------------------------------------------------------------------

/** The first input buffer: room for the ClientHello of every common client. It grows only for a longer one. */
const TLS_INPUT_START: i32 = 2048
/** The Initial output: a HelloRetryRequest and a ServerHello with a 32-byte session id, a 65-byte secp256r1 share and a PSK, about 250 bytes; it grows for more. */
const TLS_INITIAL_OUTPUT_SIZE: i32 = 256
/** The longest DER ECDSA P-256 signature, what the flight is first sized for: two 33-byte integers and their headers. */
const TLS_ECDSA_SIGNATURE_MAX: i32 = 72
/**
 * Which secret of a `TlsSecretPool` an index names: what `TlsServer.known`,
 * `wipeSecret` and the pool's `zero` take, and the bit of `TlsServer.held`
 * that says the secret is derived (`1 << index`).
 */
export const TLS_SECRET_HANDSHAKE: i32 = 0
/** `client_handshake_traffic_secret` (RFC 8446 §7.1): the client's Handshake-level keys. */
export const TLS_SECRET_CLIENT_HANDSHAKE: i32 = 1
/** `server_handshake_traffic_secret` (RFC 8446 §7.1): the server's Handshake-level keys. */
export const TLS_SECRET_SERVER_HANDSHAKE: i32 = 2
/** `client_application_traffic_secret_0` (RFC 8446 §7.1): the client's first application keys. */
export const TLS_SECRET_CLIENT_APPLICATION: i32 = 3
/** `server_application_traffic_secret_0` (RFC 8446 §7.1): the server's first application keys. */
export const TLS_SECRET_SERVER_APPLICATION: i32 = 4
/** `exporter_master_secret` (RFC 8446 §7.5), for a caller's own exporters. */
export const TLS_SECRET_EXPORTER: i32 = 5
/** The client Finished's expected `verify_data` (RFC 8446 §4.4.4), plain, since the wire carries it. */
export const TLS_SECRET_CLIENT_FINISHED: i32 = 6
/** The CertificateVerify input sits beside them: 98 bytes and the transcript hash. */
export const TLS_SECRET_TO_BE_SIGNED: i32 = 7
/** `resumption_master_secret` (RFC 8446 §7.1), what a NewSessionTicket's PSK is derived from. */
export const TLS_SECRET_RESUMPTION: i32 = 8
/** The PSK a ticket opened to, held from the binder's check to the early secret's extract. */
export const TLS_SECRET_PSK: i32 = 9
/** The PSK early secret (RFC 8446 §7.1), held until the handshake secret's salt is derived from it. */
export const TLS_SECRET_EARLY: i32 = 10
/** The binder key (§4.2.11.2), held until the binder is compared. */
export const TLS_SECRET_BINDER_KEY: i32 = 11
/** What CertificateVerify signs besides the hash (RFC 8446 §4.4.3): 64 spaces, the 33-byte context and a zero. */
const TLS_CERTIFICATE_VERIFY_PREFIX: i32 = 98

/**
 * The secrets of one connection under one hash, as `TlsServer` holds them
 * in `secrets256` and `secrets384`: an array of exactly `hashLength` bytes
 * for each, allocated once and reused by every connection. The ten the key
 * schedule derives are `Secret`s (`nish:secret`), read only inside `expose`
 * and wiped by `wipe`, so the checker proves no copy of them leaves the
 * pool and that `wipe` reaches every one. The expected client Finished and
 * the CertificateVerify input are what the wire carries, and stay plain;
 * `wipe` zeroes them too (TLS-1).
 */
export class TlsSecretPool {
  /** `handshake_secret` (RFC 8446 §7.1), hash-length bytes; read it inside `expose`. */
  readonly handshake: Secret<u8[]>
  /** `client_handshake_traffic_secret` (RFC 8446 §7.1), hash-length bytes; read it inside `expose`. */
  readonly clientHandshake: Secret<u8[]>
  /** `server_handshake_traffic_secret` (RFC 8446 §7.1), hash-length bytes; read it inside `expose`. */
  readonly serverHandshake: Secret<u8[]>
  /** `client_application_traffic_secret_0` (RFC 8446 §7.1), hash-length bytes; read it inside `expose`. */
  readonly clientApplication: Secret<u8[]>
  /** `server_application_traffic_secret_0` (RFC 8446 §7.1), hash-length bytes; read it inside `expose`. */
  readonly serverApplication: Secret<u8[]>
  /** `exporter_master_secret` (RFC 8446 §7.5), for a caller's own exporters. */
  readonly exporter: Secret<u8[]>
  /**
   * `resumption_master_secret` (RFC 8446 §7.1), derived by `sign` and the
   * connection's once the client's Finished is accepted: what a
   * NewSessionTicket's PSK would be derived from.
   */
  readonly resumption: Secret<u8[]>
  /** The PSK the selected ticket opened to, on a resumed handshake only. */
  readonly psk: Secret<u8[]>
  /** The PSK early secret, on a resumed handshake only. */
  readonly early: Secret<u8[]>
  /** The binder key, from the selected ticket's early secret. */
  readonly binderKey: Secret<u8[]>
  /** The client Finished's `verify_data`, known once the server's Finished is written. */
  clientFinished: u8[]
  /** The CertificateVerify input, 98 bytes longer than the rest. */
  toBeSigned: u8[]

  /**
   * Allocates every array of the pool once, all zero, so a connection never allocates one for a secret.
   *
   * @param hashLength The suite's hash length in bytes: 32 for SHA-256, 48 for SHA-384.
   */
  constructor(hashLength: i32) {
    this.handshake = secret(new Array<u8>(hashLength))
    this.clientHandshake = secret(new Array<u8>(hashLength))
    this.serverHandshake = secret(new Array<u8>(hashLength))
    this.clientApplication = secret(new Array<u8>(hashLength))
    this.serverApplication = secret(new Array<u8>(hashLength))
    this.exporter = secret(new Array<u8>(hashLength))
    this.resumption = secret(new Array<u8>(hashLength))
    this.psk = secret(new Array<u8>(hashLength))
    this.early = secret(new Array<u8>(hashLength))
    this.binderKey = secret(new Array<u8>(hashLength))
    this.clientFinished = new Array<u8>(hashLength)
    this.toBeSigned = new Array<u8>(hashLength + TLS_CERTIFICATE_VERIFY_PREFIX)
  }

  /**
   * Wipes the one secret `index` names (`TLS_SECRET_*`), leaving the rest; any other index wipes nothing.
   *
   * @internal Read by `net/tls/client.ts` and `TlsServer`.
   */
  zero(index: i32): void {
    if (index === TLS_SECRET_HANDSHAKE) {
      exposeWith(this.handshake, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_CLIENT_HANDSHAKE) {
      exposeWith(this.clientHandshake, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_SERVER_HANDSHAKE) {
      exposeWith(this.serverHandshake, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_CLIENT_APPLICATION) {
      exposeWith(this.clientApplication, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_SERVER_APPLICATION) {
      exposeWith(this.serverApplication, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_EXPORTER) {
      exposeWith(this.exporter, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_RESUMPTION) {
      exposeWith(this.resumption, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_PSK) {
      exposeWith(this.psk, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_EARLY) {
      exposeWith(this.early, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_BINDER_KEY) {
      exposeWith(this.binderKey, TLS_FROM, tlsZeroHeld)
    } else if (index === TLS_SECRET_CLIENT_FINISHED) {
      secureZero(this.clientFinished)
    } else if (index === TLS_SECRET_TO_BE_SIGNED) {
      secureZero(this.toBeSigned)
    }
  }

  /**
   * Wipes every secret in the pool.
   *
   * @internal Read by `net/tls/client.ts` and `TlsServer`.
   */
  wipe(): void {
    wipe(this.handshake)
    wipe(this.clientHandshake)
    wipe(this.serverHandshake)
    wipe(this.clientApplication)
    wipe(this.serverApplication)
    wipe(this.exporter)
    wipe(this.resumption)
    wipe(this.psk)
    wipe(this.early)
    wipe(this.binderKey)
    secureZero(this.clientFinished)
    secureZero(this.toBeSigned)
  }
}

/**
 * The most the server's Handshake-level flight under `config` takes with an
 * ECDSA P-256 signature: EncryptedExtensions with every extension it may
 * carry and the longest configured ALPN protocol, the Certificate, a
 * CertificateVerify and a SHA-384 Finished.
 */
const tlsFlightCapacity = (config: TlsServerConfig): i32 => {
  const none: u8[] = []
  let longest: string = ""
  for (const protocol of config.alpn) {
    if (toI32(protocol.length) > toI32(longest.length)) {
      longest = protocol
    }
  }
  const extensions: i32 = tlsWriteEncryptedExtensions(
    none,
    TLS_FROM,
    config.extraExtensions,
    longest,
    true,
    config.quic ? config.quicTransportParameters : null
  )
  const certificate: i32 = tlsWriteCertificate(none, TLS_FROM, config.certificateChain)
  return extensions + certificate + 8 + TLS_ECDSA_SIGNATURE_MAX + 4 + SHA384_SIZE
}

// ---- Resumption ------------------------------------------------------------------

/** What `tlsServerStrikeProbe` finds for an id: a free entry it could be recorded in. */
const TLS_SERVER_STRIKE_FREE: i32 = 0
/** The id is held: recorded and live (row 6 of the record's table). */
const TLS_SERVER_STRIKE_HELD: i32 = 1
/** No entry is free (row 7). */
const TLS_SERVER_STRIKE_FULL: i32 = 2

/**
 * What `strikes.take(id, …, now)` would find, without recording anything:
 * the same scan as `TlsTicketStrikes.take`, bounded by `longest` the same
 * way. `resume` asks before the binder is checked, so that an identity
 * already recorded is passed over rather than costing a binder, and records
 * with `take` only once the binder verifies, so that a binder that fails
 * records nothing (row 9).
 */
const tlsServerStrikeProbe = (strikes: TlsTicketStrikes, id: u8[], now: i64): i32 => {
  const capacity: i32 = strikes.capacity
  const home: i32 = strikes.home(id)
  let free: i32 = -1
  for (let n: i32 = 0; n < capacity; n++) {
    const slot: i32 = (home + n) % capacity
    if (strikes.used[slot] === 0) {
      if (free < 0) {
        free = slot
      }
      break
    }
    if (strikes.expires[slot] < now) {
      if (free < 0) {
        free = slot
      }
    } else if (n <= strikes.longest && strikes.holds(slot, id)) {
      return TLS_SERVER_STRIKE_HELD
    }
    if (free >= 0 && n >= strikes.longest) {
      break
    }
  }
  return free < 0 ? TLS_SERVER_STRIKE_FULL : TLS_SERVER_STRIKE_FREE
}

/** `answerHello`'s index when no ticket was chosen: a full handshake. */
const TLS_NO_IDENTITY: i32 = -1

/**
 * What a NewSessionTicket adds around its ticket: the handshake header (4),
 * `ticket_lifetime` (4), `ticket_age_add` (4), the nonce's length and its one
 * byte (2), the ticket's length (2) and an empty extensions list (2).
 */
const TLS_SERVER_TICKET_OVERHEAD: i32 = 18

/** The bytes the largest ticket takes: a SHA-384 PSK and a 255-byte server name. */
const tlsServerTicketCapacity = (state: TlsTicketState): i32 => {
  state.suite = TLS_AES_256_GCM_SHA384
  state.pskLength = TLS_TICKET_PSK_MAX
  state.serverNameLength = TLS_TICKET_SERVER_NAME_MAX
  state.lifetime = TLS_TICKET_LIFETIME_SECONDS
  const size: i32 = tlsTicketSize(state)
  state.suite = 0
  state.pskLength = 0
  state.serverNameLength = 0
  state.lifetime = 0
  return size
}

/**
 * One TLS 1.3 server handshake. Make one per connection, or one per slot and
 * `restart` it for each connection the slot takes; feed it what the client
 * sends with `receive`, send what `takeOutput` answers (or what the output
 * buffers hold, for a carrier that reads them in place), and sign when the
 * state says so.
 *
 * The fields are readable: `state` and `alert`, the negotiated `suite`,
 * `serverName`, `alpn` and the client's `clientTransportParameters`, and the
 * `held` bits of the secrets derived so far. The secrets themselves are
 * `Secret` fields of `secrets()`, read through `expose`; `readKnown` and
 * `writeKnown` say whether the traffic secrets of a level are known yet.
 *
 * **What it allocates.** Everything it keeps is allocated by the constructor
 * and reused by `restart`: the input and output buffers, the transcript's
 * hashers, the HKDF scratch, the ephemeral key's 32 bytes, and HashLen bytes
 * for every secret under each hash, which each derivation writes over in place
 * and `wipe` zeroes before the next connection starts. `receive` and `sign` do
 * their work inside `using a = arena()` blocks, so the compiler has proved that
 * what they allocate on the way dies before they return.
 *
 * Four things grow or are made outside those blocks: the input buffer, doubled
 * up to the largest message when a ClientHello does not fit (once per slot);
 * the Handshake-level output, when a signature is longer than an ECDSA one; the
 * `serverName` string, made when the client's host name differs from the last
 * one this server held; and, over QUIC only, the array the client's transport
 * parameters are copied into, which grows only when a client's are longer than
 * any before (TLS-3).
 */
export class TlsServer {
  /** The configuration this server was built with: its certificate chain, ALPN list and QUIC transport parameters. */
  config: TlsServerConfig
  private serverRandom: u8[]
  /** The connection's 32-byte ephemeral private key (x25519, or the secp256r1 scalar with its top bit cleared), copied in by `restart` and wiped by the record layer once the ServerHello is written. */
  readonly ephemeral: Secret<u8[]>
  /** The client's `host_name`, or empty. */
  serverName: string = ""
  /** The ALPN protocol chosen, one of the configuration's, or empty. */
  alpn: string = ""
  /** The last host name a client of this server sent, kept across `restart` so that the next one naming it reuses the string. */
  private lastServerName: string = ""
  /** The client's `quic_transport_parameters`, opaque; empty unless the carrier is QUIC. */
  clientTransportParameters: u8[]
  /** The array `clientTransportParameters` points at once read, kept across `restart` and refilled in the room it has. */
  private clientParameters: u8[]
  private transcript: TlsTranscript
  /** The bytes received at the current level and not yet a whole message: `input[0 .. inputLength)`. */
  input: u8[]
  /**
   * What the server has written at the Initial level and not handed on: `outputInitial[0 .. outputInitialLength)`.
   *
   * @internal Read by `net/tls/record-server.ts` and `net/quic.ts`.
   */
  outputInitial: u8[]
  /**
   * What the server has written at the Handshake level and not handed on: `outputHandshake[0 .. outputHandshakeLength)`.
   *
   * @internal Read by `net/tls/record-server.ts` and `net/quic.ts`.
   */
  outputHandshake: u8[]
  /** An empty array: what `clientTransportParameters` holds until a client's are read. */
  private none: u8[]
  /** The secrets under each hash (`TlsSecretPool`); `secrets()` answers the negotiated hash's. */
  secrets256: TlsSecretPool
  /** The secrets under SHA-384, for TLS_AES_256_GCM_SHA384. */
  secrets384: TlsSecretPool
  /** The ClientHello last read, as windows into `input`. */
  private hello: TlsClientHelloView
  /** Where every HKDF and HMAC of the schedule runs. */
  private kdf: HkdfScratch
  /** The exchange's words (`tlsExchange`). */
  exchange: TlsExchangeWords
  /**
   * The server's public key for the ServerHello, unpacked from the
   * exchange's words: `publicX25519` or `publicP256`, whichever `group` names.
   */
  private serverPublic: u8[]
  /** Room for an x25519 public key, 32 bytes, made once. */
  private publicX25519: u8[]
  /** Room for a secp256r1 public key, a 65-byte uncompressed point, made once. */
  private publicP256: u8[]
  /** A transcript hash on its way into the schedule: HashLen bytes of it. */
  private hashes: u8[]
  /**
   * The salt the handshake secret is extracted under, HashLen bytes of it:
   * the `TLS_DERIVED_SALT_*` constant on a full handshake, derived from the
   * PSK early secret on a resumed one. `exchangeKeys` reads it into the
   * exchange's words and zeroes it.
   */
  salt: u8[]
  /** The transcript hash through the ClientHello's binders prefix, which a binder covers (§4.2.11.2). */
  private binderHash: u8[]
  /** What the ticket `resume` is reading opened to; its PSK is zeroed once read. */
  opened: TlsTicketState
  /** What `issue` seals; its PSK is zeroed once sealed. */
  issuing: TlsTicketState
  /** The sealed ticket, sized once for the largest. */
  private ticketScratch: u8[]
  /**
   * What the server has written at the Application level and not handed on: one NewSessionTicket.
   *
   * @internal Read by `net/tls/record-server.ts`.
   */
  outputApplication: u8[]
  /** The ticket nonce: one ticket a connection, so one byte, the same each time, keeps each PSK distinct (§4.6.1). */
  private ticketNonce: u8[]
  /** The ticket's `ticket_age_add`, drawn fresh for each ticket (§4.6.1). */
  private ageAddBytes: u8[]
  /**
   * Which of the negotiated pool's secrets the handshake has derived: bit
   * `1 << TLS_SECRET_*` for each. A secret wiped by `wipeSecret` keeps its
   * bit, since its place is still the one it was derived into.
   */
  held: i32 = 0
  /** Where the handshake stands: one of the `TLS_STATE_*` constants, `TLS_STATE_CONNECTED` once it is done and `TLS_STATE_FAILED` after an alert. */
  state: i32 = 0
  /** The alert the server failed with, or 0. */
  alert: i32 = 0
  /** The negotiated cipher suite, or 0 before the first ClientHello is read. */
  suite: i32 = 0
  /** @internal Read by `net/tls/record-server.ts`. */
  hashLength: i32 = 0
  /** @internal Read by `net/tls/record-server.ts`. */
  inputLength: i32 = 0
  /** @internal Read by `net/tls/record-server.ts` and `net/quic.ts`. */
  outputInitialLength: i32 = 0
  /** @internal Read by `net/tls/record-server.ts` and `net/quic.ts`. */
  outputHandshakeLength: i32 = 0
  /** @internal Read by `net/tls/record-server.ts`. */
  outputApplicationLength: i32 = 0
  /** Whether a HelloRetryRequest was sent, so a second miss is fatal. */
  retried: boolean = false
  /**
   * The key exchange group: `TLS_GROUP_X25519` or `TLS_GROUP_SECP256R1` once
   * the ClientHello chose it or a HelloRetryRequest asked for it, 0 before.
   */
  group: i32 = 0
  /** Whether `config` passed `tlsConfigFits`, decided once by the constructor. */
  private configFits: boolean = false
  /** Whether the carrier turned resumption on with `enableTickets`; kept across `restart`. */
  tickets: boolean = false
  /**
   * Whether this connection may be issued a ticket: tickets are on, the
   * client listed `psk_dhe_ke`, the only mode this server resumes in, and its
   * server name, if any, fits a ticket.
   *
   * @internal Read by `net/tls/record-server.ts`.
   */
  ticketWanted: boolean = false
  /**
   * Whether `issue` has run for this connection.
   *
   * @internal Read by `net/tls/record-server.ts`.
   */
  issued: boolean = false
  /** Whether this connection resumed a ticket (row 1 of the record's table). */
  resumed: boolean = false

  /**
   * A server for one connection under `config`, with the 32-byte server
   * random and the 32-byte ephemeral private key drawn for it. A random or key of
   * another length, or a configuration `tlsConfigFits` refuses, leaves the
   * server failed with `internal_error` before it reads anything.
   *
   * @param config What the server offers and answers with; held, not copied, and checked by `tlsConfigFits`.
   * @param serverRandom The 32 random bytes of the ServerHello's `random`; the array itself is kept, so the
   *   caller hands over a fresh one.
   * @param ephemeralPrivate The 32-byte ephemeral private key, for x25519 or secp256r1; copied into the server's `Secret` and then zeroed
   *   in the caller's array, as `restart` does.
   */
  constructor(config: TlsServerConfig, serverRandom: u8[], ephemeralPrivate: u8[]) {
    this.config = config
    this.serverRandom = serverRandom
    this.ephemeral = secret(new Array<u8>(X25519_SIZE))
    this.none = []
    this.clientTransportParameters = this.none
    this.clientParameters = []
    this.transcript = new TlsTranscript(0)
    this.configFits = tlsConfigFits(config)
    this.input = new Array<u8>(TLS_INPUT_START)
    this.outputInitial = new Array<u8>(TLS_INITIAL_OUTPUT_SIZE)
    this.outputHandshake = new Array<u8>(this.configFits ? tlsFlightCapacity(config) : TLS_FROM)
    this.secrets256 = new TlsSecretPool(SHA256_SIZE)
    this.secrets384 = new TlsSecretPool(SHA384_SIZE)
    this.hello = new TlsClientHelloView()
    this.kdf = new HkdfScratch()
    this.exchange = new TlsExchangeWords()
    this.publicX25519 = new Array<u8>(X25519_SIZE)
    this.publicP256 = new Array<u8>(TLS_P256_SHARE_SIZE)
    this.serverPublic = this.publicX25519
    this.hashes = new Array<u8>(SHA384_SIZE)
    this.salt = new Array<u8>(SHA384_SIZE)
    this.binderHash = new Array<u8>(SHA384_SIZE)
    this.opened = new TlsTicketState()
    this.issuing = new TlsTicketState()
    this.ticketScratch = new Array<u8>(tlsServerTicketCapacity(this.issuing))
    this.outputApplication = new Array<u8>(toI32(this.ticketScratch.length) + TLS_SERVER_TICKET_OVERHEAD)
    this.ticketNonce = new Array<u8>(1)
    this.ageAddBytes = new Array<u8>(4)
    this.restart(serverRandom, ephemeralPrivate)
  }

  /**
   * Starts the next connection in this server's buffers, with its own
   * 32-byte random and ephemeral private key, as a fresh `TlsServer` would:
   * every secret the last connection left is wiped (`wipe`) and none is
   * held. The random is kept, as the constructor keeps it; the key is copied
   * into `ephemeral` and the caller's array zeroed with `secureZero`, so the
   * only copy left is the one the server wipes. A random or key of another
   * length, or a configuration `tlsConfigFits` refused, leaves the server
   * failed with `internal_error`.
   *
   * @param serverRandom The next connection's 32 random bytes; the array itself is kept.
   * @param ephemeralPrivate The next connection's 32-byte ephemeral private key; zeroed once copied in.
   */
  restart(serverRandom: u8[], ephemeralPrivate: u8[]): void {
    const keyLength: i32 = toI32(ephemeralPrivate.length)
    this.wipe()
    this.held = 0
    exposeWith(this.ephemeral, ephemeralPrivate, tlsHeldCopyIn)
    secureZero(ephemeralPrivate)
    this.serverRandom = serverRandom
    this.state = TLS_STATE_WAIT_CLIENT_HELLO
    this.alert = 0
    this.suite = 0
    this.hashLength = 0
    this.retried = false
    this.group = 0
    this.serverName = ""
    this.alpn = ""
    this.clientTransportParameters = this.none
    this.inputLength = 0
    this.outputInitialLength = 0
    this.outputHandshakeLength = 0
    this.outputApplicationLength = 0
    this.ticketWanted = false
    this.issued = false
    this.resumed = false
    secureZero(this.salt)
    secureZero(this.opened.psk)
    secureZero(this.issuing.psk)
    if (toI32(serverRandom.length) !== TLS_RANDOM_SIZE || keyLength !== X25519_SIZE || !this.configFits) {
      this.state = TLS_STATE_FAILED
      this.alert = TLS_ALERT_INTERNAL_ERROR
    }
  }

  /**
   * Fails the handshake with `alert` and answers it, wiping the resumption
   * master secret `sign` derived ahead and what a ticket being read left: its
   * PSK, early secret and binder key, and the salt.
   */
  private fail(alert: i32): i32 {
    this.wipeResumption()
    const pool: TlsSecretPool = this.secrets()
    pool.zero(TLS_SECRET_PSK)
    pool.zero(TLS_SECRET_EARLY)
    pool.zero(TLS_SECRET_BINDER_KEY)
    secureZero(this.salt)
    secureZero(this.opened.psk)
    this.state = TLS_STATE_FAILED
    this.alert = alert
    return alert
  }

  /**
   * Wipes the resumption master secret, which `sign` derives ahead of the
   * client's Finished. `issue` calls it once the ticket is sealed, and the
   * carrier when a connection ends, closed or failed, without one (TLS-1).
   */
  wipeResumption(): void {
    this.secrets().zero(TLS_SECRET_RESUMPTION)
  }

  /**
   * The pool of the negotiated hash: SHA-384's for a SHA-384 suite, SHA-256's otherwise.
   *
   * @returns One of the server's two pools, which the server keeps and reuses for the next connection.
   */
  secrets(): TlsSecretPool {
    return this.hashLength === SHA384_SIZE ? this.secrets384 : this.secrets256
  }

  /**
   * Whether the handshake has derived secret `index` (`TLS_SECRET_*`) for this connection.
   *
   * @param index A `TLS_SECRET_*` index; any index outside 0 to 30 is never known.
   * @returns True once the secret is derived; it stays true after `wipeSecret`, until `restart`,
   *   except that `sign` clears `TLS_SECRET_TO_BE_SIGNED` and the client's Finished clears
   *   `TLS_SECRET_HANDSHAKE`.
   */
  known(index: i32): boolean {
    return index >= 0 && index < 31 && (this.held & (1 << index)) !== 0
  }

  /**
   * Whether the secret the server *reads* `level` under — the client's
   * traffic secret, `clientHandshake` or `clientApplication` of `secrets()` —
   * is known yet. The Initial level has none: it is cleartext in TLS, and
   * QUIC derives its own from the connection id.
   *
   * @param level A `TLS_LEVEL_*` level.
   * @returns True when the client's secret for `level` is derived; always false for Initial.
   */
  readKnown(level: i32): boolean {
    if (level === TLS_LEVEL_HANDSHAKE) {
      return this.known(TLS_SECRET_CLIENT_HANDSHAKE)
    }
    return level === TLS_LEVEL_APPLICATION && this.known(TLS_SECRET_CLIENT_APPLICATION)
  }

  /**
   * Whether the secret the server *writes* `level` under — `serverHandshake` or `serverApplication` — is
   * known yet.
   *
   * @param level A `TLS_LEVEL_*` level.
   * @returns True when the server's secret for `level` is derived; always false for Initial.
   */
  writeKnown(level: i32): boolean {
    if (level === TLS_LEVEL_HANDSHAKE) {
      return this.known(TLS_SECRET_SERVER_HANDSHAKE)
    }
    return level === TLS_LEVEL_APPLICATION && this.known(TLS_SECRET_SERVER_APPLICATION)
  }

  /**
   * Zeroes secret `index` of `secrets()` once a carrier has taken what it needs from it; it stays known.
   *
   * @param index A `TLS_SECRET_*` index; any other index wipes nothing.
   */
  wipeSecret(index: i32): void {
    this.secrets().zero(index)
  }

  /**
   * Zeroes the ephemeral key, which the record layer does once the ServerHello is written: not while a hello that offers a ticket waits for `resume`, whose exchange still needs it.
   */
  wipeEphemeral(): void {
    exposeWith(this.ephemeral, TLS_FROM, tlsZeroHeld)
  }

  /** Wipes every secret the server holds: the ephemeral key and both pools. `restart` calls it, and the carriers when a connection ends. */
  wipe(): void {
    wipe(this.ephemeral)
    this.secrets256.wipe()
    this.secrets384.wipe()
  }

  /** The level the client's next bytes must arrive at, or -1 when the state expects none. */
  private expectedLevel(): i32 {
    switch (this.state) {
      case TLS_STATE_WAIT_CLIENT_HELLO:
        return TLS_LEVEL_INITIAL
      case TLS_STATE_WAIT_FINISHED:
        return TLS_LEVEL_HANDSHAKE
      default:
        return -1
    }
  }

  /**
   * Makes `input` hold at least `need` bytes, keeping the ones it holds. It
   * doubles, so a slot grows it at most a handful of times however its
   * clients cut their messages, and never past the largest message `receive`
   * takes.
   */
  private reserveInput(need: i32): void {
    const capacity: i32 = toI32(this.input.length)
    if (need <= capacity) {
      return
    }
    let size: i32 = capacity
    while (size < need) {
      size = size * 2
    }
    const most: i32 = TLS_MAX_HANDSHAKE_MESSAGE + 4
    const grown: u8[] = new Array<u8>(size > most ? most : size)
    for (let k: i32 = 0; k < this.inputLength && k < toI32(grown.length) && k < capacity; k++) {
      grown[k] = this.input[k]
    }
    this.input = grown
  }

  /**
   * Makes the output of `level` hold at least `need` bytes, keeping the ones
   * it holds. Both are sized by the constructor for what this configuration
   * writes with an ECDSA signature, so only a longer signature grows the
   * Handshake level's, once per slot.
   */
  private reserveOutput(level: i32, need: i32): void {
    const initial: boolean = level === TLS_LEVEL_INITIAL
    const buffer: u8[] = initial ? this.outputInitial : this.outputHandshake
    const held: i32 = initial ? this.outputInitialLength : this.outputHandshakeLength
    const capacity: i32 = toI32(buffer.length)
    if (need <= capacity) {
      return
    }
    const grown: u8[] = new Array<u8>(need)
    for (let k: i32 = 0; k < held && k < toI32(buffer.length) && k < toI32(grown.length); k++) {
      grown[k] = buffer[k]
    }
    if (initial) {
      this.outputInitial = grown
    } else {
      this.outputHandshake = grown
    }
  }

  /**
   * Takes the handshake bytes `data[off .. off + len)` the client sent at
   * `level`, a whole message, part of one or several, and handles every
   * message they complete. Answers 0, or the alert the server fails with.
   *
   * A level other than the one the state expects is `unexpected_message`, as
   * is a byte left over once a message ends the client's flight: each of the
   * three messages a client sends here (two ClientHellos and a Finished) is
   * the last of its flight, and RFC 8446 §5.1 forbids a message to straddle a
   * key change. A window outside `data` is `internal_error`, the caller's
   * fault and not the peer's. Once the handshake is done, any further bytes
   * are `unexpected_message` too: the post-handshake messages a client may
   * send (KeyUpdate) belong to the record layer, which handles them itself.
   *
   * @param level The `TLS_LEVEL_*` level the bytes arrived at.
   * @param data The array holding the bytes; only read, and copied into the server's own buffer.
   * @param off Where in `data` the bytes start.
   * @param len How many bytes, from `off`, to take; 0 takes nothing and answers 0, once the window is
   *   checked and unless the server has already failed.
   * @returns 0, or the `TLS_ALERT_*` the server failed with (the same one again on every later call).
   */
  receive(level: i32, data: u8[], off: i32, len: i32): i32 {
    if (this.state === TLS_STATE_FAILED) {
      return this.alert
    }
    if (off < 0 || len < 0 || off > toI32(data.length) - len) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    if (len === 0) {
      return 0
    }
    if (level !== this.expectedLevel()) {
      return this.fail(TLS_ALERT_UNEXPECTED_MESSAGE)
    }
    // The buffer only ever holds one message, so bytes that would take it
    // past the largest one allowed are refused before they are copied.
    if (len > TLS_MAX_HANDSHAKE_MESSAGE + 4 - this.inputLength) {
      return this.fail(TLS_ALERT_DECODE_ERROR)
    }
    this.reserveInput(this.inputLength + len)
    for (
      let k: i32 = 0;
      k < len && off + k < toI32(data.length) && this.inputLength < toI32(this.input.length);
      k++
    ) {
      this.input[this.inputLength] = data[off + k]
      this.inputLength = this.inputLength + 1
    }
    // Every message a client sends here ends its flight, so the buffer holds
    // at most one: a byte past its end is refused below.
    if (this.inputLength < 4) {
      return 0
    }
    const length: i32 = (toI32(this.input[1]) << 16) | (toI32(this.input[2]) << 8) | toI32(this.input[3])
    if (length > TLS_MAX_HANDSHAKE_MESSAGE) {
      return this.fail(TLS_ALERT_DECODE_ERROR)
    }
    const whole: i32 = 4 + length
    if (this.inputLength < whole) {
      return 0
    }
    if (this.inputLength > whole) {
      return this.fail(TLS_ALERT_UNEXPECTED_MESSAGE)
    }
    // The message stays where it is while it is handled; the buffer is
    // empty again for whatever comes next.
    this.inputLength = 0
    const alert: i32 = this.handleMessage(length)
    if (alert !== 0) {
      return this.fail(alert)
    }
    return 0
  }

  /**
   * Dispatches one whole message, `input[0 .. 4 + length)`. `receive`
   * admits bytes only in the two states that expect them, so the state is
   * one of those two here.
   */
  private handleMessage(length: i32): i32 {
    const type: i32 = toI32(this.input[0])
    if (this.state === TLS_STATE_WAIT_CLIENT_HELLO) {
      return type === TLS_HANDSHAKE_CLIENT_HELLO
        ? this.handleClientHello(length)
        : TLS_ALERT_UNEXPECTED_MESSAGE
    }
    return type === TLS_HANDSHAKE_FINISHED ? this.handleFinished(length) : TLS_ALERT_UNEXPECTED_MESSAGE
  }

  /**
   * The first suite the client lists that this module negotiates, or 0
   * (§4.1.1: the server picks; following the client's order is the choice
   * RFC 8448's server makes).
   */
  private chooseSuite(hello: TlsClientHelloView): i32 {
    const data: u8[] = hello.data
    const end: i32 = hello.suitesAt + hello.suitesLength
    for (
      let k: i32 = hello.suitesAt;
      k + 1 < end && k >= 0 && k < toI32(data.length) && k + 1 < toI32(data.length);
      k += 2
    ) {
      const suite: i32 = (toI32(data[k]) << 8) | toI32(data[k + 1])
      if (tlsSuiteHashLength(suite) > 0) {
        return suite
      }
    }
    return 0
  }

  /**
   * ALPN (RFC 7301 §3.2): the first configured protocol the client offers.
   * Answers 0 with `alpn` set, or empty when nothing is negotiated, or
   * `no_application_protocol`.
   */
  private chooseAlpn(hello: TlsClientHelloView): i32 {
    this.alpn = ""
    if (hello.hasAlpn && toI32(this.config.alpn.length) > 0) {
      const data: u8[] = hello.data
      const end: i32 = hello.alpnAt + hello.alpnLength
      for (const protocol of this.config.alpn) {
        let at: i32 = hello.alpnAt
        while (at < end && at >= 0 && at < toI32(data.length)) {
          const n: i32 = toI32(data[at])
          if (tlsBytesSpell(data, at + 1, n, protocol)) {
            this.alpn = protocol
            return 0
          }
          at = at + 1 + n
        }
      }
      return TLS_ALERT_NO_APPLICATION_PROTOCOL
    }
    return this.config.quic ? TLS_ALERT_NO_APPLICATION_PROTOCOL : 0
  }

  /**
   * `serverName` for the host name the hello carries: kept as it is when it
   * already spells those bytes, so a slot whose clients name one host makes
   * the string once, and made again only when the name changes.
   */
  private takeServerName(hello: TlsClientHelloView): void {
    if (!hello.hasServerName) {
      this.serverName = ""
      return
    }
    if (!tlsBytesSpell(hello.data, hello.serverNameAt, hello.serverNameLength, this.lastServerName)) {
      this.lastServerName = tlsWindowString(hello.data, hello.serverNameAt, hello.serverNameLength)
    }
    this.serverName = this.lastServerName
  }

  /**
   * A ClientHello, the first or the second: refuse it, answer it with a
   * HelloRetryRequest, or answer it with ServerHello, EncryptedExtensions and
   * Certificate and wait for the signature. The checks run in the order a
   * reader of RFC 8446 would make them: the structure, then the version, then
   * the suite, the extensions §9.2 requires, the group, the signature scheme,
   * the share itself, and the application protocol.
   */
  private handleClientHello(length: i32): i32 {
    const hello: TlsClientHelloView = this.hello
    const data: u8[] = this.input
    tlsReadClientHello(hello, data, 4, length)
    if (hello.alert !== 0) {
      return hello.alert
    }
    // §4.2.1: the version is negotiated by `supported_versions` alone, and
    // `legacy_version` is not consulted for it. The one exception is SSL 3.0
    // or below, which §D.5 lets a server refuse outright. Without
    // `supported_versions` the client offers TLS 1.2 or earlier, which this
    // server does not speak.
    if (hello.legacyVersion <= TLS_SSL3_VERSION) {
      return TLS_ALERT_PROTOCOL_VERSION
    }
    if (
      !hello.hasSupportedVersions ||
      !tlsWindowHasU16(data, hello.versionsAt, hello.versionsLength, TLS_VERSION_13)
    ) {
      return TLS_ALERT_PROTOCOL_VERSION
    }
    if (!hello.nullCompressionOnly) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    const suite: i32 = this.chooseSuite(hello)
    if (suite === 0) {
      return TLS_ALERT_HANDSHAKE_FAILURE
    }
    // §4.1.4: the second ClientHello must allow the suite the
    // HelloRetryRequest chose, since the transcript is already under its hash.
    if (this.retried && suite !== this.suite) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    // A ticket offered in `psk_dhe_ke` that this server reads: the
    // identities are read by `resume`, and a hello that resumes needs no
    // signature (row 14 of "Resumption" in `docs/security/tls.md`).
    const offersTicket: boolean = this.tickets && hello.hasPreSharedKey && hello.pskDheKe
    // §9.2: a certificate-authenticated handshake needs all three, and
    // `supported_groups` and `key_share` come as a pair. A hello offering a
    // ticket has `signature_algorithms` checked by `answerHello`, once it is
    // known not to resume.
    if ((!offersTicket && !hello.hasSignatureAlgorithms) || !hello.hasSupportedGroups || !hello.hasKeyShare) {
      return TLS_ALERT_MISSING_EXTENSION
    }
    if (this.config.quic && !hello.hasQuicTransportParameters) {
      return TLS_ALERT_MISSING_EXTENSION
    }
    // x25519 first, then secp256r1: a client that lists neither shares no
    // group with this server (§4.1.1).
    const offersX25519: boolean = tlsWindowHasU16(data, hello.groupsAt, hello.groupsLength, TLS_GROUP_X25519)
    const offersP256: boolean = tlsWindowHasU16(data, hello.groupsAt, hello.groupsLength, TLS_GROUP_SECP256R1)
    if (!offersX25519 && !offersP256) {
      return TLS_ALERT_HANDSHAKE_FAILURE
    }
    if (
      !offersTicket &&
      !tlsWindowHasU16(data, hello.schemesAt, hello.schemesLength, this.config.signatureScheme)
    ) {
      return TLS_ALERT_HANDSHAKE_FAILURE
    }
    if (!this.retried) {
      this.suite = suite
      this.hashLength = tlsSuiteHashLength(suite)
      this.transcript.reset(this.hashLength)
    }
    if (offersTicket) {
      // The binders cover the transcript up to the binders list (§4.2.11.2),
      // so its hash is taken on the way through.
      const prefix: i32 = hello.pskBindersPrefixAt
      this.transcript.update(data, TLS_FROM, prefix)
      this.transcript.hashInto(this.binderHash, TLS_FROM)
      this.transcript.update(data, prefix, 4 + length - prefix)
    } else {
      this.transcript.update(data, TLS_FROM, 4 + length)
    }
    // The group is the server's choice, not the client's: x25519 whenever the
    // client lists it, secp256r1 only for a client that does not. A hello
    // without a share of that group gets one HelloRetryRequest asking for it
    // (§4.1.4), and the second hello must carry that share or is
    // `illegal_parameter`; after a retry `group` is fixed already.
    const preferred: i32 = offersX25519 ? TLS_GROUP_X25519 : TLS_GROUP_SECP256R1
    const group: i32 = this.retried ? this.group : preferred
    const p256Group: boolean = group === TLS_GROUP_SECP256R1
    const hasShare: boolean = p256Group
      ? offersP256 && hello.hasP256Share
      : offersX25519 && hello.hasX25519Share
    if (!hasShare) {
      if (this.retried) {
        return TLS_ALERT_ILLEGAL_PARAMETER
      }
      this.retried = true
      this.group = group
      const none: u8[] = []
      this.reserveOutput(
        TLS_LEVEL_INITIAL,
        tlsWriteHelloRetryRequest(
          none,
          this.outputInitialLength,
          data,
          hello.sessionIdAt,
          hello.sessionIdLength,
          suite,
          this.group
        )
      )
      using _scope = arena()
      this.transcript.restartWithMessageHash()
      const at: i32 = this.outputInitialLength
      const end: i32 = tlsWriteHelloRetryRequest(
        this.outputInitial,
        at,
        data,
        hello.sessionIdAt,
        hello.sessionIdLength,
        this.suite,
        this.group
      )
      this.sent(TLS_LEVEL_INITIAL, at, end)
      return 0
    }
    this.group = group
    const shareLength: i32 = p256Group ? hello.p256ShareLength : hello.x25519ShareLength
    if (shareLength !== (p256Group ? TLS_P256_SHARE_SIZE : TLS_X25519_SHARE_SIZE)) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    const alpnAlert: i32 = this.chooseAlpn(hello)
    if (alpnAlert !== 0) {
      return alpnAlert
    }
    this.takeServerName(hello)
    this.ticketWanted =
      this.tickets &&
      hello.hasPskModes &&
      hello.pskDheKe &&
      (!hello.hasServerName || hello.serverNameLength <= TLS_TICKET_SERVER_NAME_MAX)
    const name: u8[] = this.issuing.serverName
    const nameLength: i32 = this.ticketWanted && hello.hasServerName ? hello.serverNameLength : 0
    for (
      let k: i32 = 0;
      k < nameLength &&
      k < toI32(name.length) &&
      hello.serverNameAt + k >= 0 &&
      hello.serverNameAt + k < toI32(data.length);
      k++
    ) {
      name[k] = data[hello.serverNameAt + k]
    }
    this.issuing.serverNameLength = nameLength
    if (this.config.quic) {
      // Refilled in place, so a slot's handshakes keep nothing for it (QUIC-3).
      const parameters: u8[] = this.clientParameters
      while (parameters.length > 0) {
        parameters.pop()
      }
      for (
        let k: i32 = 0;
        k < hello.quicLength && hello.quicAt + k >= 0 && hello.quicAt + k < toI32(data.length);
        k++
      ) {
        parameters.push(data[hello.quicAt + k])
      }
      this.clientTransportParameters = parameters
    }
    if (offersTicket) {
      // The carrier lends the ticket keys and the strike register to `resume`.
      this.state = TLS_STATE_WAIT_TICKET
      return 0
    }
    return this.answerHello(TLS_NO_IDENTITY)
  }

  /**
   * Answers the ClientHello once it is known whether it resumes: the
   * ServerHello naming identity `index` and the resumed flight, or, when it
   * does not resume, the checks a certificate needs and the full flight.
   * Answers 0 or the alert.
   */
  private answerHello(index: i32): i32 {
    const hello: TlsClientHelloView = this.hello
    if (!this.resumed) {
      if (!hello.hasSignatureAlgorithms) {
        return TLS_ALERT_MISSING_EXTENSION
      }
      if (!tlsWindowHasU16(this.input, hello.schemesAt, hello.schemesLength, this.config.signatureScheme)) {
        return TLS_ALERT_HANDSHAKE_FAILURE
      }
      tlsHexInto(
        this.hashLength === SHA384_SIZE ? TLS_DERIVED_SALT_SHA384 : TLS_DERIVED_SALT_SHA256,
        this.salt,
        TLS_FROM
      )
    }
    const exchangeAlert: i32 = this.exchangeKeys()
    if (exchangeAlert !== 0) {
      return exchangeAlert
    }
    if (this.resumed) {
      this.writeResumedFlight(index)
    } else {
      this.writeServerFlight()
    }
    return 0
  }

  /**
   * Turns resumption on: from the next ClientHello, a hello offering a
   * ticket in `psk_dhe_ke` waits in `TLS_STATE_WAIT_TICKET` for `resume`,
   * and a connection whose client lists `psk_dhe_ke` may be issued a ticket
   * by `issue`. Kept across `restart`. A QUIC server never resumes, so on one
   * this does nothing.
   */
  enableTickets(): void {
    this.tickets = !this.config.quic
  }

  /**
   * Whether the ticket in `opened` may resume this hello: its suite's hash is
   * the negotiated one, its PSK is that long, and it names the server name
   * this hello names, or none when the hello names none (rows 4 and 5).
   */
  private ticketFits(): boolean {
    const hello: TlsClientHelloView = this.hello
    const opened: TlsTicketState = this.opened
    const h: i32 = this.hashLength
    if (tlsSuiteHashLength(opened.suite) !== h || opened.pskLength !== h) {
      return false
    }
    if (!hello.hasServerName) {
      return opened.serverNameLength === 0
    }
    return (
      opened.serverNameLength === hello.serverNameLength &&
      timingSafeEqualAt(hello.data, hello.serverNameAt, opened.serverName, TLS_FROM, hello.serverNameLength)
    )
  }

  /**
   * The first identity whose ticket opens under `current` or `previous`,
   * fits (`ticketFits`) and is not yet recorded in `strikes`, left selected
   * in `hello` with its ticket in `opened`; or -1, with every PSK an
   * identity opened to zeroed. A full register ends the search and is
   * counted with `take`, so that a full register fails closed into a full
   * handshake (row 7).
   */
  private selectTicket(
    current: Secret<u8[]>,
    currentInfo: TlsTicketKeyInfo,
    previous: Secret<u8[]>,
    previousInfo: TlsTicketKeyInfo,
    strikes: TlsTicketStrikes,
    now: i64
  ): i32 {
    const hello: TlsClientHelloView = this.hello
    const opened: TlsTicketState = this.opened
    const data: u8[] = this.input
    let chosen: i32 = -1
    using _scope = arena()
    for (let k: i32 = 0; k < hello.pskIdentityCount; k++) {
      if (!tlsSelectPskIdentity(hello, k)) {
        break
      }
      const ticket: u8[] = new Array<u8>(hello.pskIdentityLength)
      for (
        let n: i32 = 0;
        n < toI32(ticket.length) &&
        hello.pskIdentityAt + n >= 0 &&
        hello.pskIdentityAt + n < toI32(data.length);
        n++
      ) {
        ticket[n] = data[hello.pskIdentityAt + n]
      }
      const opens: boolean =
        tlsTicketOpen(current, currentInfo, ticket, now, opened) ||
        tlsTicketOpen(previous, previousInfo, ticket, now, opened)
      if (opens && this.ticketFits()) {
        const probe: i32 = tlsServerStrikeProbe(strikes, opened.id, now)
        if (probe === TLS_SERVER_STRIKE_FREE) {
          chosen = k
          break
        }
        if (probe === TLS_SERVER_STRIKE_FULL) {
          strikes.take(opened.id, opened.expiresAt(), now)
          secureZero(opened.psk)
          break
        }
      }
      secureZero(opened.psk)
    }
    if (chosen >= 0) {
      tlsSelectPskIdentity(hello, chosen)
    }
    return chosen
  }

  /**
   * The selected ticket's PSK, early secret and binder key, and whether the
   * hello's binder for it verifies (§4.2.11.2). The PSK and binder key are
   * zeroed before it returns; the early secret stays for `saltFromEarly`.
   */
  private bindTicket(): boolean {
    const hello: TlsClientHelloView = this.hello
    const pool: TlsSecretPool = this.secrets()
    const h: i32 = this.hashLength
    exposeWith(pool.psk, this.opened.psk, tlsHeldCopyIn)
    secureZero(this.opened.psk)
    using _scope = arena()
    const psk: u8[] = expose(pool.psk, tlsHeldClone)
    const early: u8[] = new Array<u8>(h)
    tlsPskEarlySecretInto(this.kdf, h, psk, early)
    secureZero(psk)
    exposeWith(pool.early, early, tlsHeldCopyIn)
    const binderKey: u8[] = new Array<u8>(h)
    tlsBinderKeyInto(this.kdf, h, early, binderKey)
    secureZero(early)
    exposeWith(pool.binderKey, binderKey, tlsHeldCopyIn)
    const verified: boolean = tlsBinderVerify(
      this.kdf,
      h,
      binderKey,
      this.binderHash,
      TLS_FROM,
      this.input,
      hello.pskBinderAt,
      hello.pskBinderLength
    )
    secureZero(binderKey)
    pool.zero(TLS_SECRET_PSK)
    pool.zero(TLS_SECRET_BINDER_KEY)
    return verified
  }

  /** The salt a resumed handshake secret is extracted under, `Derive-Secret(early, "derived", "")`, into `salt`. */
  private saltFromEarly(): void {
    const pool: TlsSecretPool = this.secrets()
    using _scope = arena()
    const early: u8[] = expose(pool.early, tlsHeldClone)
    tlsHandshakeSaltInto(this.kdf, this.hashLength, early, this.salt)
    secureZero(early)
  }

  /**
   * In `TLS_STATE_WAIT_TICKET`: reads the hello's tickets under the keys the
   * carrier lends, `current` and `previous` with what each `info` says of
   * them (a program with one key passes it as both), records the one it
   * resumes in `strikes`, and answers the hello, resumed or in full, as the
   * table of "Resumption" in `docs/security/tls.md` says. A selected ticket
   * whose binder fails is `decrypt_error`, with nothing recorded (row 9).
   * Answers 0, or the alert the server fails with.
   *
   * @param current The newest ticket key, lent: read only inside `exposeWith`, and the carrier's to wipe.
   * @param currentInfo The current key's record.
   * @param previous The key before it, lent as `current` is.
   * @param previousInfo The previous key's record.
   * @param strikes The register a resumed ticket's id is recorded in, so that it resumes only once.
   * @param now The time to judge the tickets at, in `monotonicNanos()`.
   * @returns 0 when the hello was answered, resumed or not, or the `TLS_ALERT_*` the server failed with:
   *   the recorded alert in `TLS_STATE_FAILED`, `internal_error` in any other state but
   *   `TLS_STATE_WAIT_TICKET`.
   */
  resume(
    current: Secret<u8[]>,
    currentInfo: TlsTicketKeyInfo,
    previous: Secret<u8[]>,
    previousInfo: TlsTicketKeyInfo,
    strikes: TlsTicketStrikes,
    now: i64
  ): i32 {
    if (this.state === TLS_STATE_FAILED) {
      return this.alert
    }
    if (this.state !== TLS_STATE_WAIT_TICKET) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    const index: i32 = this.selectTicket(current, currentInfo, previous, previousInfo, strikes, now)
    let bound: boolean = true
    let resumed: boolean = false
    if (index >= 0) {
      bound = this.bindTicket()
      resumed = bound && strikes.take(this.opened.id, this.opened.expiresAt(), now)
    }
    if (resumed) {
      this.saltFromEarly()
      this.issuing.chainStart = this.opened.chainStart
    }
    secureZero(this.opened.psk)
    this.secrets().zero(TLS_SECRET_EARLY)
    if (!bound) {
      return this.fail(TLS_ALERT_DECRYPT_ERROR)
    }
    this.resumed = resumed
    const alert: i32 = this.answerHello(resumed ? index : TLS_NO_IDENTITY)
    return alert !== 0 ? this.fail(alert) : 0
  }

  /**
   * A resumed flight: the ServerHello selecting identity `index`, the
   * handshake traffic secrets, EncryptedExtensions and the server's
   * Finished, after which the server waits for the client's.
   */
  private writeResumedFlight(index: i32): void {
    const hello: TlsClientHelloView = this.hello
    const none: u8[] = []
    this.reserveOutput(
      TLS_LEVEL_INITIAL,
      tlsWriteServerHelloPsk(
        none,
        this.outputInitialLength,
        this.serverRandom,
        hello.data,
        hello.sessionIdAt,
        hello.sessionIdLength,
        this.suite,
        this.serverPublic,
        index
      )
    )
    const extensionsEnd: i32 = tlsWriteEncryptedExtensions(
      none,
      this.outputHandshakeLength,
      this.config.extraExtensions,
      this.alpn,
      hello.hasServerName,
      this.config.quic ? this.config.quicTransportParameters : null
    )
    this.reserveOutput(TLS_LEVEL_HANDSHAKE, extensionsEnd + 4 + this.hashLength)
    // The secrets' pool is the slot's, chosen before the blocks open.
    const pool: TlsSecretPool = this.secrets()
    this.writeResumedHello(pool, index)
    this.writeServerFinished(pool)
    this.masterSecretStep(pool)
  }

  /** The resumed ServerHello, the handshake traffic secrets and EncryptedExtensions, in the room `writeResumedFlight` reserved. */
  private writeResumedHello(pool: TlsSecretPool, index: i32): void {
    const hello: TlsClientHelloView = this.hello
    using _scope = arena()
    const helloAt: i32 = this.outputInitialLength
    const helloEnd: i32 = tlsWriteServerHelloPsk(
      this.outputInitial,
      helloAt,
      this.serverRandom,
      hello.data,
      hello.sessionIdAt,
      hello.sessionIdLength,
      this.suite,
      this.serverPublic,
      index
    )
    this.sent(TLS_LEVEL_INITIAL, helloAt, helloEnd)
    this.transcript.hashInto(this.hashes, TLS_FROM)
    const handshake: u8[] = expose(pool.handshake, tlsHeldClone)
    this.deriveInto(handshake, "c hs traffic", pool.clientHandshake)
    this.deriveInto(handshake, "s hs traffic", pool.serverHandshake)
    secureZero(handshake)
    this.held = this.held | (1 << TLS_SECRET_CLIENT_HANDSHAKE) | (1 << TLS_SECRET_SERVER_HANDSHAKE)
    const extensionsAt: i32 = this.outputHandshakeLength
    const written: i32 = tlsWriteEncryptedExtensions(
      this.outputHandshake,
      extensionsAt,
      this.config.extraExtensions,
      this.alpn,
      hello.hasServerName,
      this.config.quic ? this.config.quicTransportParameters : null
    )
    this.sent(TLS_LEVEL_HANDSHAKE, extensionsAt, written)
  }

  /**
   * Runs the exchange in `group` on the caller's ephemeral key and the
   * client's share (`tlsExchange`), outside any arena block since its scope is its
   * own, and unpacks the server's public key and the handshake secret from
   * the words. The words, the ephemeral key's and the handshake secret's
   * among them, are wiped with one `wipe` after the branch on the alert, so
   * that a refused exchange leaves them zero too and `opt` has one wipe to
   * keep rather than two to merge. The ephemeral key is read out of its
   * `Secret` field a word at a time; the record layer wipes it once the
   * ServerHello is written (TLS-1).
   */
  private exchangeKeys(): i32 {
    const w: TlsExchangeWords = this.exchange
    const share: u8[] = this.input
    const p256: boolean = this.group === TLS_GROUP_SECP256R1
    const at: i32 = p256 ? this.hello.p256ShareAt : this.hello.x25519ShareAt
    // A 65-byte secp256r1 point fills nine words, an x25519 share four; the
    // rest stay zero from the last `wipe`.
    w.group = this.group
    w.key0 = exposeWith(this.ephemeral, TLS_FROM, tlsWordAt)
    w.key1 = exposeWith(this.ephemeral, TLS_FROM + 8, tlsWordAt)
    w.key2 = exposeWith(this.ephemeral, TLS_FROM + 16, tlsWordAt)
    w.key3 = exposeWith(this.ephemeral, TLS_FROM + 24, tlsWordAt)
    w.share0 = tlsWordAt(share, at)
    w.share1 = tlsWordAt(share, at + 8)
    w.share2 = tlsWordAt(share, at + 16)
    w.share3 = tlsWordAt(share, at + 24)
    if (p256) {
      w.share4 = tlsWordAt(share, at + 32)
      w.share5 = tlsWordAt(share, at + 40)
      w.share6 = tlsWordAt(share, at + 48)
      w.share7 = tlsWordAt(share, at + 56)
      w.share8 = tlsWordAt(share, at + 64)
    }
    w.hashLength = this.hashLength
    w.salt0 = tlsWordAt(this.salt, 0)
    w.salt1 = tlsWordAt(this.salt, 8)
    w.salt2 = tlsWordAt(this.salt, 16)
    w.salt3 = tlsWordAt(this.salt, 24)
    w.salt4 = tlsWordAt(this.salt, 32)
    w.salt5 = tlsWordAt(this.salt, 40)
    secureZero(this.salt)
    const alert: i32 = tlsExchange(w)
    if (alert === 0) {
      const pub: u8[] = p256 ? this.publicP256 : this.publicX25519
      tlsWordInto(pub, 0, w.public0)
      tlsWordInto(pub, 8, w.public1)
      tlsWordInto(pub, 16, w.public2)
      tlsWordInto(pub, 24, w.public3)
      tlsWordInto(pub, 32, w.public4)
      tlsWordInto(pub, 40, w.public5)
      tlsWordInto(pub, 48, w.public6)
      tlsWordInto(pub, 56, w.public7)
      tlsWordInto(pub, 64, w.public8)
      this.serverPublic = pub
      exposeWith(this.secrets().handshake, w, tlsHandshakeFromWords)
      this.held = this.held | (1 << TLS_SECRET_HANDSHAKE)
    }
    wipe(w)
    return alert
  }

  /**
   * ServerHello at the Initial level, the handshake traffic secrets, and
   * EncryptedExtensions and Certificate at the Handshake level, then the
   * CertificateVerify input: all in place, inside one arena block.
   */
  private writeServerFlight(): void {
    const hello: TlsClientHelloView = this.hello
    const h: i32 = this.hashLength
    // Room for the messages first, outside the block, measured by writing
    // them over nothing; the constructor sized both buffers for these, so
    // neither grows.
    const none: u8[] = []
    this.reserveOutput(
      TLS_LEVEL_INITIAL,
      tlsWriteServerHello(
        none,
        this.outputInitialLength,
        this.serverRandom,
        hello.data,
        hello.sessionIdAt,
        hello.sessionIdLength,
        this.suite,
        this.serverPublic
      )
    )
    const extensionsEnd: i32 = tlsWriteEncryptedExtensions(
      none,
      this.outputHandshakeLength,
      this.config.extraExtensions,
      this.alpn,
      hello.hasServerName,
      this.config.quic ? this.config.quicTransportParameters : null
    )
    this.reserveOutput(
      TLS_LEVEL_HANDSHAKE,
      tlsWriteCertificate(none, extensionsEnd, this.config.certificateChain)
    )
    // The secrets' pool is the slot's, chosen before the block opens.
    const pool: TlsSecretPool = this.secrets()
    using _scope = arena()
    const helloAt: i32 = this.outputInitialLength
    const helloEnd: i32 = tlsWriteServerHello(
      this.outputInitial,
      helloAt,
      this.serverRandom,
      hello.data,
      hello.sessionIdAt,
      hello.sessionIdLength,
      this.suite,
      this.serverPublic
    )
    this.sent(TLS_LEVEL_INITIAL, helloAt, helloEnd)

    this.transcript.hashInto(this.hashes, TLS_FROM)
    const handshake: u8[] = expose(pool.handshake, tlsHeldClone)
    this.deriveInto(handshake, "c hs traffic", pool.clientHandshake)
    this.deriveInto(handshake, "s hs traffic", pool.serverHandshake)
    secureZero(handshake)
    this.held = this.held | (1 << TLS_SECRET_CLIENT_HANDSHAKE) | (1 << TLS_SECRET_SERVER_HANDSHAKE)

    const extensionsAt: i32 = this.outputHandshakeLength
    const written: i32 = tlsWriteEncryptedExtensions(
      this.outputHandshake,
      extensionsAt,
      this.config.extraExtensions,
      this.alpn,
      hello.hasServerName,
      this.config.quic ? this.config.quicTransportParameters : null
    )
    this.sent(TLS_LEVEL_HANDSHAKE, extensionsAt, written)
    const certificateEnd: i32 = tlsWriteCertificate(
      this.outputHandshake,
      written,
      this.config.certificateChain
    )
    this.sent(TLS_LEVEL_HANDSHAKE, written, certificateEnd)

    this.transcript.hashInto(this.hashes, TLS_FROM)
    tlsWriteCertificateVerifyContent(pool.toBeSigned, TLS_FROM, this.hashes, TLS_FROM, h)
    this.held = this.held | (1 << TLS_SECRET_TO_BE_SIGNED)
    this.state = TLS_STATE_WAIT_SIGNATURE
  }

  /**
   * Derive-Secret(`prk`, `label`, the transcript hash in `hashes`) into the
   * held secret `dst` (RFC 8446 §7.1): derived into a plain array that dies
   * with the caller's arena block, copied in, and zeroed.
   */
  private deriveInto(prk: u8[], label: string, dst: Secret<u8[]>): void {
    const out: u8[] = new Array<u8>(this.hashLength)
    tlsDeriveSecretInto(this.kdf, this.hashLength, prk, label, this.hashes, TLS_FROM, out)
    exposeWith(dst, out, tlsHeldCopyIn)
    secureZero(out)
  }

  /**
   * What CertificateVerify signs (RFC 8446 §4.4.3), while the state is
   * `TLS_STATE_WAIT_SIGNATURE`; `null` at any other time.
   *
   * @returns The pool's own `toBeSigned` array, not a copy: 98 bytes and the transcript hash, which the
   *   caller signs and does not change. `null` outside `TLS_STATE_WAIT_SIGNATURE`.
   */
  signatureInput(): u8[] | null {
    if (this.state !== TLS_STATE_WAIT_SIGNATURE) {
      return null
    }
    return this.secrets().toBeSigned
  }

  /**
   * Takes the signature over `signatureInput()`, as it goes on the wire (DER
   * for ECDSA), and writes CertificateVerify and the server's Finished, after
   * which the application secrets are known. Answers 0, or `internal_error`
   * when called in another state or with an empty or over-long signature.
   * The signature is not checked here: a wrong one is the caller's bug, and
   * the client's verification is what catches it.
   *
   * @param signature The signature bytes, 1 to 65,535 of them, such as `tlsSignEcdsaP256` answers.
   * @returns 0, or the `TLS_ALERT_*` the server failed with.
   */
  sign(signature: u8[]): i32 {
    if (this.state === TLS_STATE_FAILED) {
      return this.alert
    }
    const signatureLength: i32 = toI32(signature.length)
    if (this.state !== TLS_STATE_WAIT_SIGNATURE || signatureLength === 0 || signatureLength > 65535) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    const h: i32 = this.hashLength
    this.reserveOutput(TLS_LEVEL_HANDSHAKE, this.outputHandshakeLength + 8 + signatureLength + 4 + h)
    // The secrets' pool is the slot's, chosen before the blocks open.
    const pool: TlsSecretPool = this.secrets()
    this.writeCertificateVerify(signature)
    this.writeServerFinished(pool)
    this.masterSecretStep(pool)
    this.held = this.held & ~(1 << TLS_SECRET_TO_BE_SIGNED)
    return 0
  }

  /** CertificateVerify, carrying `signature`, at the Handshake level, in the room `sign` reserved. */
  private writeCertificateVerify(signature: u8[]): void {
    using _scope = arena()
    const verifyAt: i32 = this.outputHandshakeLength
    const verifyEnd: i32 = tlsWriteCertificateVerify(
      this.outputHandshake,
      verifyAt,
      this.config.signatureScheme,
      signature
    )
    this.sent(TLS_LEVEL_HANDSHAKE, verifyAt, verifyEnd)
  }

  /**
   * The server's Finished at the Handshake level, in the room reserved for
   * it: its `verify_data`, under the server's handshake traffic secret, goes
   * straight into its place in the flight.
   */
  private writeServerFinished(pool: TlsSecretPool): void {
    const h: i32 = this.hashLength
    using _scope = arena()
    const at: i32 = this.outputHandshakeLength
    this.transcript.hashInto(this.hashes, TLS_FROM)
    const serverHandshake: u8[] = expose(pool.serverHandshake, tlsHeldClone)
    tlsFinishedVerifyDataInto(
      this.kdf,
      h,
      serverHandshake,
      this.hashes,
      TLS_FROM,
      this.outputHandshake,
      at + 4
    )
    secureZero(serverHandshake)
    const finishedEnd: i32 = tlsWriteFinished(this.outputHandshake, at, this.outputHandshake, at + 4, h)
    this.sent(TLS_LEVEL_HANDSHAKE, at, finishedEnd)
  }

  /**
   * Once the server's Finished is written, full handshake or resumed: the
   * master secret, the application and exporter secrets, the client's
   * Finished the server expects, and the resumption master secret, after
   * which the server waits for that Finished.
   */
  private masterSecretStep(pool: TlsSecretPool): void {
    const h: i32 = this.hashLength
    using _scope = arena()
    this.transcript.hashInto(this.hashes, TLS_FROM)
    const handshake: u8[] = expose(pool.handshake, tlsHeldClone)
    const master: u8[] = new Array<u8>(h)
    tlsMasterSecretInto(this.kdf, h, handshake, master)
    secureZero(handshake)
    this.deriveInto(master, "c ap traffic", pool.clientApplication)
    this.deriveInto(master, "s ap traffic", pool.serverApplication)
    this.deriveInto(master, "exp master", pool.exporter)
    const clientHandshake: u8[] = expose(pool.clientHandshake, tlsHeldClone)
    const finished: u8[] = pool.clientFinished
    tlsFinishedVerifyDataInto(this.kdf, h, clientHandshake, this.hashes, TLS_FROM, finished, TLS_FROM)
    secureZero(clientHandshake)
    // The only client Finished `handleFinished` accepts is the one just
    // computed, so the transcript through it is known now (RFC 8446 §4.6.1),
    // and the resumption master secret is derived while the master secret is.
    const clientFinished: u8[] = new Array<u8>(4 + h)
    tlsWriteFinished(clientFinished, TLS_FROM, finished, TLS_FROM, h)
    this.transcript.update(clientFinished, TLS_FROM, toI32(clientFinished.length))
    this.transcript.hashInto(this.hashes, TLS_FROM)
    this.deriveInto(master, "res master", pool.resumption)
    secureZero(master)
    this.held =
      this.held |
      (1 << TLS_SECRET_CLIENT_APPLICATION) |
      (1 << TLS_SECRET_SERVER_APPLICATION) |
      (1 << TLS_SECRET_EXPORTER) |
      (1 << TLS_SECRET_CLIENT_FINISHED)
    this.state = TLS_STATE_WAIT_FINISHED
  }

  /**
   * Once the handshake is done, at most once a connection: seals a ticket for
   * it under `key`, which `info` describes, and writes the NewSessionTicket
   * carrying it at the Application level, for the carrier to send under the
   * server's application keys. Answers whether one was written: none is when
   * tickets are off, the client did not list `psk_dhe_ke`, or the key does not
   * seal. On a connected connection's first call the resumption master secret
   * is wiped before it returns, written or not, so a carrier that issues no
   * ticket still calls this, or `wipeResumption`.
   *
   * Before the handshake is done, or on a second call, it answers false and
   * touches nothing: a secret wiped then would leave no ticket to issue, and
   * one wiped already has nothing left to wipe.
   *
   * @param key The current ticket key, lent: read only inside `exposeWith`, and still the carrier's to wipe.
   * @param info The key's record, which counts the ticket when one is sealed.
   * @param now The issue time, in `monotonicNanos()`.
   * @returns True when a NewSessionTicket was written for `takeOutput(TLS_LEVEL_APPLICATION)`.
   */
  issue(key: Secret<u8[]>, info: TlsTicketKeyInfo, now: i64): boolean {
    if (this.state !== TLS_STATE_CONNECTED || this.issued) {
      return false
    }
    this.issued = true
    const written: boolean = this.ticketWanted && this.writeTicket(key, info, now)
    this.wipeResumption()
    return written
  }

  /** The resumption PSK for nonce `ticketNonce`, into `issuing.psk` (§4.6.1). */
  private resumptionPsk(): void {
    const pool: TlsSecretPool = this.secrets()
    using _scope = arena()
    const resumption: u8[] = expose(pool.resumption, tlsHeldClone)
    tlsResumptionPskInto(
      this.kdf,
      this.hashLength,
      resumption,
      this.ticketNonce,
      TLS_FROM,
      1,
      this.issuing.psk
    )
    secureZero(resumption)
  }

  /** `issue`'s ticket: sealed into `ticketScratch`, its PSK zeroed, and the NewSessionTicket written. */
  private writeTicket(key: Secret<u8[]>, info: TlsTicketKeyInfo, now: i64): boolean {
    const issuing: TlsTicketState = this.issuing
    issuing.suite = this.suite
    issuing.lifetime = TLS_TICKET_LIFETIME_SECONDS
    issuing.pskLength = this.hashLength
    if (!this.resumed) {
      issuing.chainStart = now
    }
    this.resumptionPsk()
    const length: i32 = tlsTicketSeal(key, info, issuing, now, this.ticketScratch)
    secureZero(issuing.psk)
    if (length === 0) {
      return false
    }
    const b: u8[] = this.ageAddBytes
    crypto.getRandomValues(b)
    const ageAdd: u32 = toU32(
      (toI64(b[0]) << toI64(24)) | (toI64(b[1]) << toI64(16)) | (toI64(b[2]) << toI64(8)) | toI64(b[3])
    )
    this.outputApplicationLength = tlsWriteNewSessionTicket(
      this.outputApplication,
      TLS_FROM,
      toU32(issuing.lifetime),
      ageAdd,
      this.ticketNonce,
      TLS_FROM,
      1,
      this.ticketScratch,
      TLS_FROM,
      length,
      this.none
    )
    return true
  }

  /**
   * The client's Finished (§4.4.4), `input[0 .. 4 + length)`: its
   * `verify_data` is HashLen bytes and must equal the HMAC the server
   * computed, compared in constant time. A wrong length is `decode_error`, a
   * wrong value `decrypt_error`. Once it verifies, the resumption master
   * secret `sign` derived is the connection's, and known. The transcript already holds this Finished: `sign` absorbed the
   * one it expected, and these bytes are equal to it.
   */
  private handleFinished(length: i32): i32 {
    if (length !== this.hashLength) {
      return TLS_ALERT_DECODE_ERROR
    }
    const pool: TlsSecretPool = this.secrets()
    if (!timingSafeEqualAt(this.input, 4, pool.clientFinished, TLS_FROM, this.hashLength)) {
      return TLS_ALERT_DECRYPT_ERROR
    }
    // The handshake secret has done its work: wiped, and no longer held.
    pool.zero(TLS_SECRET_HANDSHAKE)
    this.held = (this.held | (1 << TLS_SECRET_RESUMPTION)) & ~(1 << TLS_SECRET_HANDSHAKE)
    this.state = TLS_STATE_CONNECTED
    return 0
  }

  /**
   * A message the server wrote at `level`, `output[at .. end)` of that
   * level's buffer, goes into the transcript and stays on the output.
   */
  private sent(level: i32, at: i32, end: i32): void {
    if (level === TLS_LEVEL_INITIAL) {
      this.transcript.update(this.outputInitial, at, end - at)
      this.outputInitialLength = end
    } else {
      this.transcript.update(this.outputHandshake, at, end - at)
      this.outputHandshakeLength = end
    }
  }

  /**
   * The handshake bytes written at `level` since the last call, in a fresh
   * array, and forgets them. Bytes are only ever written at a level whose
   * secrets are already known, so a carrier that installs keys as they appear
   * can always protect what this answers. A carrier that reads the output
   * buffers in place (the record server and QUIC, inside the standard
   * library) forgets them with `clearOutput` instead, and allocates nothing.
   *
   * @param level The `TLS_LEVEL_*` level to take the bytes of.
   * @returns The pending bytes, owned by the caller; empty when there are none or `level` is not a level.
   */
  takeOutput(level: i32): u8[] {
    const none: u8[] = []
    switch (level) {
      case TLS_LEVEL_INITIAL: {
        const out: u8[] = new Array<u8>(this.outputInitialLength)
        for (let k: i32 = 0; k < toI32(out.length) && k < toI32(this.outputInitial.length); k++) {
          out[k] = this.outputInitial[k]
        }
        this.outputInitialLength = 0
        return out
      }
      case TLS_LEVEL_HANDSHAKE: {
        const out: u8[] = new Array<u8>(this.outputHandshakeLength)
        for (let k: i32 = 0; k < toI32(out.length) && k < toI32(this.outputHandshake.length); k++) {
          out[k] = this.outputHandshake[k]
        }
        this.outputHandshakeLength = 0
        return out
      }
      case TLS_LEVEL_APPLICATION: {
        const out: u8[] = new Array<u8>(this.outputApplicationLength)
        for (let k: i32 = 0; k < toI32(out.length) && k < toI32(this.outputApplication.length); k++) {
          out[k] = this.outputApplication[k]
        }
        this.outputApplicationLength = 0
        return out
      }
      default:
        return none
    }
  }

  /**
   * Forgets the handshake bytes written at `level`, which a carrier has read out of the buffer itself.
   *
   * @internal Read by `net/tls/record-server.ts` and `net/quic.ts`.
   */
  clearOutput(level: i32): void {
    if (level === TLS_LEVEL_INITIAL) {
      this.outputInitialLength = 0
    } else if (level === TLS_LEVEL_HANDSHAKE) {
      this.outputHandshakeLength = 0
    } else if (level === TLS_LEVEL_APPLICATION) {
      this.outputApplicationLength = 0
    }
  }
}
