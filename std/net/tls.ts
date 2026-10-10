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
 * server random and the ephemeral x25519 private key are constructor
 * arguments, so a test injects RFC 8448's and a server draws them with
 * `crypto.getRandomValues`. Signing is handed off the same way: once the
 * Certificate is written the server stops at `TLS_STATE_WAIT_SIGNATURE`, the
 * caller signs `signatureInput()` with its own key (`tlsSignEcdsaP256` for a
 * P-256 key) and hands the signature to `sign`. That keeps the private key out
 * of this module, and it lets RFC 8448's trace, which signs with RSA-PSS, be
 * replayed with its own signature.
 *
 * **What is negotiated.** TLS 1.3 only. The suites `TLS_AES_128_GCM_SHA256`,
 * `TLS_CHACHA20_POLY1305_SHA256` and `TLS_AES_256_GCM_SHA384`, the first of
 * them the client lists; the group x25519; the configuration's one signature
 * scheme. A client that offers x25519 in `supported_groups` without a share
 * gets one HelloRetryRequest (§4.1.4), and a second ClientHello still without
 * the share is refused. `server_name` is read and exposed as `serverName`.
 * ALPN picks the first of the configuration's protocols the client offers.
 * `quic_transport_parameters` is read and written only when the configuration
 * says the carrier is QUIC. PSKs, 0-RTT, NewSessionTicket and client
 * authentication are not here: a PSK or early-data offer is ignored, so the
 * client falls back to a full handshake. The resumption master secret a
 * ticket would come from is derived all the same, and readable once the
 * client's Finished is accepted.
 *
 * **Refusals are alerts.** `receive` and `sign` answer 0 or a TLS alert
 * description (`TLS_ALERT_*` in `nish/net/tls/codec`); after one the server
 * is in `TLS_STATE_FAILED` and answers the same alert to every call. Nothing
 * the peer sends can make it panic.
 *
 * **Secrets.** The ECDHE secret, and the copy of the ephemeral key it is
 * computed with, are `Secret`s (`nish:secret`) wiped on every path. What the
 * server keeps in its fields — the caller's ephemeral key bytes, since a
 * `Secret` may not be a field, and the handshake, traffic and exporter secrets
 * its carrier reads — is wiped by its carrier, and by `restart` before the
 * next connection uses the arrays. The resumption master secret, which no
 * carrier reads yet, is wiped by `fail` and `restart` alone (CLAUDE.md
 * §Security; TLS-1 in `docs/security/tls.md`).
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
import { Secret, expose, secret, wipe } from "nish:secret"
import { HkdfScratch, hkdfExtractSha256, hkdfExtractSha384 } from "nish/crypto/hkdf"
import { SHA256_SIZE } from "nish/crypto/sha256"
import { SHA384_SIZE } from "nish/crypto/sha512"
import { P256SignScratch, P256_SIGNATURE_SIZE, p256SignSha256, p256SignSha256Into } from "nish/crypto/p256"
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
  TLS_GROUP_X25519,
  TLS_HANDSHAKE_CLIENT_HELLO,
  TLS_HANDSHAKE_FINISHED,
  TLS_RANDOM_SIZE,
  TLS_VERSION_13,
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
  tlsWriteHelloRetryRequest,
  tlsWriteServerHello,
} from "nish/net/tls/codec"
import {
  TlsTranscript,
  tlsDeriveSecretInto,
  tlsFinishedVerifyDataInto,
  tlsMasterSecretInto,
  tlsSuiteHashLength,
} from "nish/net/tls/schedule"

// ---- Levels ------------------------------------------------------------------

/** Cleartext: ClientHello, HelloRetryRequest and ServerHello (QUIC's Initial packets). */
export const TLS_LEVEL_INITIAL: i32 = 0
/** Under the handshake traffic secrets: EncryptedExtensions through both Finished messages. */
export const TLS_LEVEL_HANDSHAKE: i32 = 1
/** Under the application traffic secrets. T1 writes nothing here; the level exists for its secrets. */
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
  scratch: P256SignScratch
  /** `r || s` as `p256SignSha256Into` writes it. */
  rs: u8[]
  /** The DER signatures, index `length - TLS_P256_DER_MIN`. */
  ders: u8[][]

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

/** Whether an x25519 shared secret is all zeros, reading every byte (run inside `expose`). */
const tlsIsZeroSecret = (shared: u8[]): boolean => timingSafeEqual(shared, new Array<u8>(X25519_SIZE))

/**
 * `Derive-Secret(early, "derived", "")` with no PSK, the salt the handshake
 * secret is extracted under: a constant of the hash alone (RFC 8448 §3 prints
 * the SHA-256 one; the SHA-384 one was computed with Python's hmac and
 * hashlib). It is written out rather than derived because the functions below
 * run on the ECDHE secret inside `expose`, and Expand-Label may panic with a
 * computed message, which such a function may not reach.
 */
const TLS_DERIVED_SALT_SHA256: string = "6f2615a108c702c5678f54fc9dbab69716c076189c48250cebeac3576c3611ba"
const TLS_DERIVED_SALT_SHA384: string =
  "1591dac5cbbf0330a4a84de9c753330e92d01f0a88214b4464972fd668049e93e52f2b16fad922fdc0584478428f282b"

/** The bytes of a lowercase hex constant of this module, in a fresh array. */
const tlsHexBytes = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(text.length) >> 1)
  tlsHexInto(text, out, TLS_FROM)
  return out
}

/** The SHA-256 handshake secret: HKDF-Extract of the ECDHE secret under the derived salt (run inside `expose`). */
const tlsHandshakeFromEcdhe256 = (ecdhe: u8[]): u8[] =>
  hkdfExtractSha256(tlsHexBytes(TLS_DERIVED_SALT_SHA256), ecdhe)

/** The SHA-384 handshake secret: HKDF-Extract of the ECDHE secret under the derived salt (run inside `expose`). */
const tlsHandshakeFromEcdhe384 = (ecdhe: u8[]): u8[] =>
  hkdfExtractSha384(tlsHexBytes(TLS_DERIVED_SALT_SHA384), ecdhe)

/** The secret of `level` from one side's pair, or `null` for any other level or one not derived yet (still empty). */
const tlsSecretAt = (level: i32, handshake: u8[], application: u8[]): u8[] | null => {
  const chosen: u8[] = level === TLS_LEVEL_APPLICATION ? application : handshake
  if ((level !== TLS_LEVEL_HANDSHAKE && level !== TLS_LEVEL_APPLICATION) || toI32(chosen.length) === 0) {
    return null
  }
  return chosen
}

// ---- The exchange, in a scope of its own --------------------------------------

/**
 * The x25519 exchange's inputs and answers as big-endian 64-bit words: the
 * ephemeral private key and the client's share in, the server's public key
 * and the handshake secret out, and the alert. It is a class of numbers and
 * nothing else on purpose. `x25519` answers its shared secret as a `Secret`,
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
 * fields, where `secureZero` cannot reach, so each is zeroed by an ordinary
 * store as soon as it has been read, which stands because the words stay
 * reachable from their `TlsServer` (TLS-1 in `docs/security/tls.md`).
 */
class TlsExchangeWords {
  key0: u64 = 0
  key1: u64 = 0
  key2: u64 = 0
  key3: u64 = 0
  share0: u64 = 0
  share1: u64 = 0
  share2: u64 = 0
  share3: u64 = 0
  public0: u64 = 0
  public1: u64 = 0
  public2: u64 = 0
  public3: u64 = 0
  secret0: u64 = 0
  secret1: u64 = 0
  secret2: u64 = 0
  secret3: u64 = 0
  secret4: u64 = 0
  secret5: u64 = 0
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

/**
 * The exchange of RFC 8446 §7.4.2 on `w`: the server's public key and the
 * handshake secret from the ephemeral key and the client's share, both
 * written back as words, the key's words zeroed once read. Answers 0,
 * `illegal_parameter` for a share whose shared secret is all zeros (§7.4.2,
 * RFC 7748 §6.1), or `internal_error` when the exchange answers nothing. The
 * copy of the key and the ECDHE secret are `Secret`s wiped on every path, and
 * the handshake secret's bytes with `secureZero` once they are words. The
 * compiler brackets this function with an arena scope of its own (see
 * `TlsExchangeWords`), so what x25519 and HKDF allocate is gone when it
 * returns.
 */
const tlsExchange = (w: TlsExchangeWords): i32 => {
  const raw: u8[] = new Array<u8>(X25519_SIZE)
  tlsWordInto(raw, 0, w.key0)
  tlsWordInto(raw, 8, w.key1)
  tlsWordInto(raw, 16, w.key2)
  tlsWordInto(raw, 24, w.key3)
  w.key0 = toU64(0)
  w.key1 = toU64(0)
  w.key2 = toU64(0)
  w.key3 = toU64(0)
  const share: u8[] = new Array<u8>(X25519_SIZE)
  tlsWordInto(share, 0, w.share0)
  tlsWordInto(share, 8, w.share1)
  tlsWordInto(share, 16, w.share2)
  tlsWordInto(share, 24, w.share3)
  const key: Secret<u8[]> = secret(raw)
  const serverPublic: u8[] | null = x25519Base(key)
  const shared: Secret<u8[]> | null = x25519(key, share)
  wipe(key)
  if (shared === null) {
    return TLS_ALERT_INTERNAL_ERROR
  }
  // RFC 7748 §6.1 leaves the all-zero check to the protocol, and RFC 8446
  // §7.4.2 makes it: a low-order client share gives the zero secret, which
  // anybody can compute. The secret is secret, so the compare reads it all.
  if (serverPublic === null || expose(shared, tlsIsZeroSecret)) {
    wipe(shared)
    return serverPublic === null ? TLS_ALERT_INTERNAL_ERROR : TLS_ALERT_ILLEGAL_PARAMETER
  }
  const handshake: u8[] =
    w.hashLength === SHA384_SIZE
      ? expose(shared, tlsHandshakeFromEcdhe384)
      : expose(shared, tlsHandshakeFromEcdhe256)
  wipe(shared)
  w.public0 = tlsWordAt(serverPublic, 0)
  w.public1 = tlsWordAt(serverPublic, 8)
  w.public2 = tlsWordAt(serverPublic, 16)
  w.public3 = tlsWordAt(serverPublic, 24)
  w.secret0 = tlsWordAt(handshake, 0)
  w.secret1 = tlsWordAt(handshake, 8)
  w.secret2 = tlsWordAt(handshake, 16)
  w.secret3 = tlsWordAt(handshake, 24)
  w.secret4 = tlsWordAt(handshake, 32)
  w.secret5 = tlsWordAt(handshake, 40)
  secureZero(handshake)
  return 0
}

// ---- Buffers -------------------------------------------------------------------

/** The first input buffer: room for the ClientHello of every common client. It grows only for a longer one. */
const TLS_INPUT_START: i32 = 2048
/** The Initial output: a HelloRetryRequest and a ServerHello, each with a 32-byte session id, fit with room. */
const TLS_INITIAL_OUTPUT_SIZE: i32 = 256
/** The longest DER ECDSA P-256 signature, what the flight is first sized for: two 33-byte integers and their headers. */
const TLS_ECDSA_SIGNATURE_MAX: i32 = 72
/** Which secret each of a server's secret arrays holds, by index into `secrets256` and `secrets384`. */
const TLS_SECRET_HANDSHAKE: i32 = 0
const TLS_SECRET_CLIENT_HANDSHAKE: i32 = 1
const TLS_SECRET_SERVER_HANDSHAKE: i32 = 2
const TLS_SECRET_CLIENT_APPLICATION: i32 = 3
const TLS_SECRET_SERVER_APPLICATION: i32 = 4
const TLS_SECRET_EXPORTER: i32 = 5
const TLS_SECRET_CLIENT_FINISHED: i32 = 6
/** The CertificateVerify input sits beside them: 98 bytes and the transcript hash. */
const TLS_SECRET_TO_BE_SIGNED: i32 = 7
const TLS_SECRET_RESUMPTION: i32 = 8
/** What CertificateVerify signs besides the hash (RFC 8446 §4.4.3): 64 spaces, the 33-byte context and a zero. */
const TLS_CERTIFICATE_VERIFY_PREFIX: i32 = 98

/**
 * One array per `TLS_SECRET_*` index, in that order, each `hashLength` bytes
 * (the CertificateVerify input's 98 more). A literal, so the pool is
 * allocated at exactly its size rather than grown by `push`.
 */
const tlsSecretPool = (hashLength: i32): u8[][] => [
  new Array<u8>(hashLength),
  new Array<u8>(hashLength),
  new Array<u8>(hashLength),
  new Array<u8>(hashLength),
  new Array<u8>(hashLength),
  new Array<u8>(hashLength),
  new Array<u8>(hashLength),
  new Array<u8>(hashLength + TLS_CERTIFICATE_VERIFY_PREFIX),
  new Array<u8>(hashLength),
]

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

/**
 * One TLS 1.3 server handshake. Make one per connection, or one per slot and
 * `restart` it for each connection the slot takes; feed it what the client
 * sends with `receive`, send what `takeOutput` answers (or what the output
 * buffers hold, for a carrier that reads them in place), and sign when the
 * state says so.
 *
 * The fields are readable: `state` and `alert`, the negotiated `suite`,
 * `serverName`, `alpn` and the client's `clientTransportParameters`, and the
 * traffic, exporter and resumption secrets. `readSecret` and `writeSecret`
 * answer the traffic secrets by level.
 *
 * **What it allocates.** Everything it keeps is allocated by the constructor
 * and reused by `restart`: the input and output buffers, the transcript's
 * hashers, the HKDF scratch, and an array of exactly HashLen bytes for every
 * secret under each hash, which the secret fields point at as each is
 * derived and away from again when the next connection starts. `receive` and
 * `sign` do their work inside `using a = arena()` blocks, so the compiler has
 * proved that what they allocate on the way dies before they return. Four
 * things grow or are made outside those blocks: the input buffer, doubled up
 * to the largest message when a ClientHello does not fit (once per slot);
 * the Handshake-level output, when a signature is longer than an ECDSA one;
 * the `serverName` string, made when the client's host name differs from the
 * last one this server held; and, over QUIC only, the array the client's
 * transport parameters are copied into, which grows only when a client's
 * are longer than any before (TLS-3).
 */
export class TlsServer {
  config: TlsServerConfig
  serverRandom: u8[]
  ephemeralPrivate: u8[]
  /** The client's `host_name`, or empty. */
  serverName: string = ""
  /** The ALPN protocol chosen, one of the configuration's, or empty. */
  alpn: string = ""
  /** The last host name a client of this server sent, kept across `restart` so that the next one naming it reuses the string. */
  lastServerName: string = ""
  /** The client's `quic_transport_parameters`, opaque; empty unless the carrier is QUIC. */
  clientTransportParameters: u8[]
  /** The array `clientTransportParameters` points at once read, kept across `restart` and refilled in the room it has. */
  clientParameters: u8[]
  transcript: TlsTranscript
  /** The bytes received at the current level and not yet a whole message: `input[0 .. inputLength)`. */
  input: u8[]
  /** What the server has written at the Initial level and not handed on: `outputInitial[0 .. outputInitialLength)`. */
  outputInitial: u8[]
  /** What the server has written at the Handshake level and not handed on: `outputHandshake[0 .. outputHandshakeLength)`. */
  outputHandshake: u8[]
  handshakeSecret: u8[]
  clientHandshakeSecret: u8[]
  serverHandshakeSecret: u8[]
  clientApplicationSecret: u8[]
  serverApplicationSecret: u8[]
  /** `exporter_master_secret` (RFC 8446 §7.5), for a caller's own exporters. */
  exporterSecret: u8[]
  /**
   * `resumption_master_secret` (RFC 8446 §7.1), known once the client's
   * Finished is accepted: what a NewSessionTicket's PSK would be derived
   * from. Nothing here issues tickets, so it is held for the caller and wiped
   * by `fail` and `restart` (TLS-1).
   */
  resumptionSecret: u8[]
  /** The CertificateVerify input while `state` is `TLS_STATE_WAIT_SIGNATURE`. */
  toBeSigned: u8[]
  /** The client Finished's `verify_data`, known once the server's Finished is written. */
  expectedClientFinished: u8[]
  /** The empty array every secret field points at until its secret is derived. */
  none: u8[]
  /** The arrays the secret fields point into: one per `TLS_SECRET_*` index at each hash's length (`tlsSecretPool`). */
  secrets256: u8[][]
  secrets384: u8[][]
  /** The ClientHello last read, as windows into `input`. */
  hello: TlsClientHelloView
  /** Where every HKDF and HMAC of the schedule runs. */
  kdf: HkdfScratch
  /** The exchange's words (`tlsExchange`). */
  exchange: TlsExchangeWords
  /** The server's x25519 public key, unpacked from the exchange's words for the ServerHello. */
  serverPublic: u8[]
  /** A transcript hash on its way into the schedule: HashLen bytes of it. */
  hashes: u8[]
  state: i32 = 0
  /** The alert the server failed with, or 0. */
  alert: i32 = 0
  /** The negotiated cipher suite, or 0 before the first ClientHello is read. */
  suite: i32 = 0
  hashLength: i32 = 0
  inputLength: i32 = 0
  outputInitialLength: i32 = 0
  outputHandshakeLength: i32 = 0
  /** Whether a HelloRetryRequest was sent, so a second miss is fatal. */
  retried: boolean = false
  /** Whether `config` passed `tlsConfigFits`, decided once by the constructor. */
  configFits: boolean = false

  /**
   * A server for one connection under `config`, with the 32-byte server
   * random and the 32-byte x25519 private key drawn for it. A random or key of
   * another length, or a configuration `tlsConfigFits` refuses, leaves the
   * server failed with `internal_error` before it reads anything.
   */
  constructor(config: TlsServerConfig, serverRandom: u8[], ephemeralPrivate: u8[]) {
    this.config = config
    this.serverRandom = serverRandom
    this.ephemeralPrivate = ephemeralPrivate
    this.none = []
    this.clientTransportParameters = this.none
    this.clientParameters = []
    this.transcript = new TlsTranscript(0)
    this.configFits = tlsConfigFits(config)
    this.input = new Array<u8>(TLS_INPUT_START)
    this.outputInitial = new Array<u8>(TLS_INITIAL_OUTPUT_SIZE)
    this.outputHandshake = new Array<u8>(this.configFits ? tlsFlightCapacity(config) : TLS_FROM)
    this.secrets256 = tlsSecretPool(SHA256_SIZE)
    this.secrets384 = tlsSecretPool(SHA384_SIZE)
    this.hello = new TlsClientHelloView()
    this.kdf = new HkdfScratch()
    this.exchange = new TlsExchangeWords()
    this.serverPublic = new Array<u8>(X25519_SIZE)
    this.hashes = new Array<u8>(SHA384_SIZE)
    this.handshakeSecret = this.none
    this.clientHandshakeSecret = this.none
    this.serverHandshakeSecret = this.none
    this.clientApplicationSecret = this.none
    this.serverApplicationSecret = this.none
    this.exporterSecret = this.none
    this.resumptionSecret = this.none
    this.toBeSigned = this.none
    this.expectedClientFinished = this.none
    this.restart(serverRandom, ephemeralPrivate)
  }

  /**
   * Starts the next connection in this server's buffers, with its own
   * 32-byte random and x25519 private key, as a fresh `TlsServer` would:
   * every secret the last connection left in them is wiped with `secureZero`
   * and every secret field points at nothing again. The two arrays are kept,
   * not copied, as the constructor keeps them. A random or key of another
   * length, or a configuration `tlsConfigFits` refused, leaves the server
   * failed with `internal_error`.
   */
  restart(serverRandom: u8[], ephemeralPrivate: u8[]): void {
    this.serverRandom = serverRandom
    this.ephemeralPrivate = ephemeralPrivate
    this.state = TLS_STATE_WAIT_CLIENT_HELLO
    this.alert = 0
    this.suite = 0
    this.hashLength = 0
    this.retried = false
    this.serverName = ""
    this.alpn = ""
    this.clientTransportParameters = this.none
    this.inputLength = 0
    this.outputInitialLength = 0
    this.outputHandshakeLength = 0
    for (let k: i32 = 0; k < toI32(this.secrets256.length) && k < toI32(this.secrets384.length); k++) {
      secureZero(this.secrets256[k])
      secureZero(this.secrets384[k])
    }
    this.handshakeSecret = this.none
    this.clientHandshakeSecret = this.none
    this.serverHandshakeSecret = this.none
    this.clientApplicationSecret = this.none
    this.serverApplicationSecret = this.none
    this.exporterSecret = this.none
    this.resumptionSecret = this.none
    this.toBeSigned = this.none
    this.expectedClientFinished = this.none
    if (
      toI32(serverRandom.length) !== TLS_RANDOM_SIZE ||
      toI32(ephemeralPrivate.length) !== X25519_SIZE ||
      !this.configFits
    ) {
      this.state = TLS_STATE_FAILED
      this.alert = TLS_ALERT_INTERNAL_ERROR
    }
  }

  /** Fails the handshake with `alert` and answers it, wiping the resumption master secret `sign` derived ahead. */
  fail(alert: i32): i32 {
    secureZero(this.secretArray(TLS_SECRET_RESUMPTION))
    this.state = TLS_STATE_FAILED
    this.alert = alert
    return alert
  }

  /** The array secret `index` lives in under the negotiated hash: exactly HashLen bytes (the CertificateVerify input, 98 more). */
  secretArray(index: i32): u8[] {
    const pool: u8[][] = this.hashLength === SHA384_SIZE ? this.secrets384 : this.secrets256
    return index >= 0 && index < toI32(pool.length) ? pool[index] : this.none
  }

  /** The level the client's next bytes must arrive at, or -1 when the state expects none. */
  expectedLevel(): i32 {
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
  reserveInput(need: i32): void {
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
  reserveOutput(level: i32, need: i32): void {
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
  handleMessage(length: i32): i32 {
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
  chooseSuite(hello: TlsClientHelloView): i32 {
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
  chooseAlpn(hello: TlsClientHelloView): i32 {
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
  takeServerName(hello: TlsClientHelloView): void {
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
  handleClientHello(length: i32): i32 {
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
    // §9.2: a certificate-authenticated handshake needs all three, and
    // `supported_groups` and `key_share` come as a pair.
    if (!hello.hasSignatureAlgorithms || !hello.hasSupportedGroups || !hello.hasKeyShare) {
      return TLS_ALERT_MISSING_EXTENSION
    }
    if (this.config.quic && !hello.hasQuicTransportParameters) {
      return TLS_ALERT_MISSING_EXTENSION
    }
    if (!tlsWindowHasU16(data, hello.groupsAt, hello.groupsLength, TLS_GROUP_X25519)) {
      return TLS_ALERT_HANDSHAKE_FAILURE
    }
    if (!tlsWindowHasU16(data, hello.schemesAt, hello.schemesLength, this.config.signatureScheme)) {
      return TLS_ALERT_HANDSHAKE_FAILURE
    }
    if (!this.retried) {
      this.suite = suite
      this.hashLength = tlsSuiteHashLength(suite)
      this.transcript.reset(this.hashLength)
    }
    this.transcript.update(data, TLS_FROM, 4 + length)
    if (!hello.hasX25519Share) {
      // §4.1.4: one HelloRetryRequest; a second ClientHello without the share
      // the first one asked for is `illegal_parameter`.
      if (this.retried) {
        return TLS_ALERT_ILLEGAL_PARAMETER
      }
      this.retried = true
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
          TLS_GROUP_X25519
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
        TLS_GROUP_X25519
      )
      this.sent(TLS_LEVEL_INITIAL, at, end)
      return 0
    }
    if (hello.x25519ShareLength !== TLS_X25519_SHARE_SIZE) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    const alpnAlert: i32 = this.chooseAlpn(hello)
    if (alpnAlert !== 0) {
      return alpnAlert
    }
    this.takeServerName(hello)
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
    const exchangeAlert: i32 = this.exchangeKeys()
    if (exchangeAlert !== 0) {
      return exchangeAlert
    }
    this.writeServerFlight()
    return 0
  }

  /**
   * Runs the x25519 exchange on the caller's ephemeral key and the client's
   * share (`tlsExchange`), outside any arena block since its scope is its
   * own, and unpacks the server's public key and the handshake secret from
   * the words, zeroing them. The ephemeral key is held as the caller's plain
   * bytes, because a `Secret` may not live in a field (NL2430); the record
   * layer wipes them once the ServerHello is written (TLS-1).
   */
  exchangeKeys(): i32 {
    const w: TlsExchangeWords = this.exchange
    const key: u8[] = this.ephemeralPrivate
    const share: u8[] = this.input
    const at: i32 = this.hello.x25519ShareAt
    w.key0 = tlsWordAt(key, 0)
    w.key1 = tlsWordAt(key, 8)
    w.key2 = tlsWordAt(key, 16)
    w.key3 = tlsWordAt(key, 24)
    w.share0 = tlsWordAt(share, at)
    w.share1 = tlsWordAt(share, at + 8)
    w.share2 = tlsWordAt(share, at + 16)
    w.share3 = tlsWordAt(share, at + 24)
    w.hashLength = this.hashLength
    const alert: i32 = tlsExchange(w)
    if (alert !== 0) {
      return alert
    }
    const pub: u8[] = this.serverPublic
    tlsWordInto(pub, 0, w.public0)
    tlsWordInto(pub, 8, w.public1)
    tlsWordInto(pub, 16, w.public2)
    tlsWordInto(pub, 24, w.public3)
    this.handshakeSecret = this.secretArray(TLS_SECRET_HANDSHAKE)
    const handshake: u8[] = this.handshakeSecret
    tlsWordInto(handshake, 0, w.secret0)
    tlsWordInto(handshake, 8, w.secret1)
    tlsWordInto(handshake, 16, w.secret2)
    tlsWordInto(handshake, 24, w.secret3)
    tlsWordInto(handshake, 32, w.secret4)
    tlsWordInto(handshake, 40, w.secret5)
    w.secret0 = toU64(0)
    w.secret1 = toU64(0)
    w.secret2 = toU64(0)
    w.secret3 = toU64(0)
    w.secret4 = toU64(0)
    w.secret5 = toU64(0)
    return 0
  }

  /**
   * ServerHello at the Initial level, the handshake traffic secrets, and
   * EncryptedExtensions and Certificate at the Handshake level, then the
   * CertificateVerify input: all in place, inside one arena block.
   */
  writeServerFlight(): void {
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
    // The secrets' arrays are the slot's, chosen before the block opens.
    this.clientHandshakeSecret = this.secretArray(TLS_SECRET_CLIENT_HANDSHAKE)
    this.serverHandshakeSecret = this.secretArray(TLS_SECRET_SERVER_HANDSHAKE)
    this.toBeSigned = this.secretArray(TLS_SECRET_TO_BE_SIGNED)
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
    tlsDeriveSecretInto(
      this.kdf,
      h,
      this.handshakeSecret,
      "c hs traffic",
      this.hashes,
      TLS_FROM,
      this.clientHandshakeSecret
    )
    tlsDeriveSecretInto(
      this.kdf,
      h,
      this.handshakeSecret,
      "s hs traffic",
      this.hashes,
      TLS_FROM,
      this.serverHandshakeSecret
    )

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
    tlsWriteCertificateVerifyContent(this.toBeSigned, TLS_FROM, this.hashes, TLS_FROM, h)
    this.state = TLS_STATE_WAIT_SIGNATURE
  }

  /**
   * What CertificateVerify signs (RFC 8446 §4.4.3), while the state is
   * `TLS_STATE_WAIT_SIGNATURE`; `null` at any other time.
   */
  signatureInput(): u8[] | null {
    if (this.state !== TLS_STATE_WAIT_SIGNATURE) {
      return null
    }
    return this.toBeSigned
  }

  /**
   * Takes the signature over `signatureInput()`, as it goes on the wire (DER
   * for ECDSA), and writes CertificateVerify and the server's Finished, after
   * which the application secrets are known. Answers 0, or `internal_error`
   * when called in another state or with an empty or over-long signature.
   * The signature is not checked here: a wrong one is the caller's bug, and
   * the client's verification is what catches it.
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
    // The secrets' arrays are the slot's, chosen before the block opens.
    this.clientApplicationSecret = this.secretArray(TLS_SECRET_CLIENT_APPLICATION)
    this.serverApplicationSecret = this.secretArray(TLS_SECRET_SERVER_APPLICATION)
    this.exporterSecret = this.secretArray(TLS_SECRET_EXPORTER)
    this.expectedClientFinished = this.secretArray(TLS_SECRET_CLIENT_FINISHED)
    using _scope = arena()
    const verifyAt: i32 = this.outputHandshakeLength
    const verifyEnd: i32 = tlsWriteCertificateVerify(
      this.outputHandshake,
      verifyAt,
      this.config.signatureScheme,
      signature
    )
    this.sent(TLS_LEVEL_HANDSHAKE, verifyAt, verifyEnd)
    this.transcript.hashInto(this.hashes, TLS_FROM)
    // The Finished's verify_data goes straight into its place in the flight.
    tlsFinishedVerifyDataInto(
      this.kdf,
      h,
      this.serverHandshakeSecret,
      this.hashes,
      TLS_FROM,
      this.outputHandshake,
      verifyEnd + 4
    )
    const finishedEnd: i32 = tlsWriteFinished(
      this.outputHandshake,
      verifyEnd,
      this.outputHandshake,
      verifyEnd + 4,
      h
    )
    this.sent(TLS_LEVEL_HANDSHAKE, verifyEnd, finishedEnd)

    this.transcript.hashInto(this.hashes, TLS_FROM)
    const master: u8[] = new Array<u8>(h)
    tlsMasterSecretInto(this.kdf, h, this.handshakeSecret, master)
    tlsDeriveSecretInto(
      this.kdf,
      h,
      master,
      "c ap traffic",
      this.hashes,
      TLS_FROM,
      this.clientApplicationSecret
    )
    tlsDeriveSecretInto(
      this.kdf,
      h,
      master,
      "s ap traffic",
      this.hashes,
      TLS_FROM,
      this.serverApplicationSecret
    )
    tlsDeriveSecretInto(this.kdf, h, master, "exp master", this.hashes, TLS_FROM, this.exporterSecret)
    tlsFinishedVerifyDataInto(
      this.kdf,
      h,
      this.clientHandshakeSecret,
      this.hashes,
      TLS_FROM,
      this.expectedClientFinished,
      TLS_FROM
    )
    // The only client Finished `handleFinished` accepts is the one just
    // computed, so the transcript through it is known now (RFC 8446 §4.6.1),
    // and the resumption master secret is derived while the master secret is.
    const clientFinished: u8[] = new Array<u8>(4 + h)
    tlsWriteFinished(clientFinished, TLS_FROM, this.expectedClientFinished, TLS_FROM, h)
    this.transcript.update(clientFinished, TLS_FROM, toI32(clientFinished.length))
    this.transcript.hashInto(this.hashes, TLS_FROM)
    tlsDeriveSecretInto(
      this.kdf,
      h,
      master,
      "res master",
      this.hashes,
      TLS_FROM,
      this.secretArray(TLS_SECRET_RESUMPTION)
    )
    secureZero(master)
    this.toBeSigned = this.none
    this.state = TLS_STATE_WAIT_FINISHED
    return 0
  }

  /**
   * The client's Finished (§4.4.4), `input[0 .. 4 + length)`: its
   * `verify_data` is HashLen bytes and must equal the HMAC the server
   * computed, compared in constant time. A wrong length is `decode_error`, a
   * wrong value `decrypt_error`. Once it verifies, the resumption master
   * secret `sign` derived is the connection's, and `resumptionSecret` points
   * at it. The transcript already holds this Finished: `sign` absorbed the
   * one it expected, and these bytes are equal to it.
   */
  handleFinished(length: i32): i32 {
    if (length !== this.hashLength) {
      return TLS_ALERT_DECODE_ERROR
    }
    if (!timingSafeEqualAt(this.input, 4, this.expectedClientFinished, TLS_FROM, this.hashLength)) {
      return TLS_ALERT_DECRYPT_ERROR
    }
    this.resumptionSecret = this.secretArray(TLS_SECRET_RESUMPTION)
    // The handshake secret has done its work: wiped, and no longer held.
    secureZero(this.handshakeSecret)
    this.handshakeSecret = this.none
    this.state = TLS_STATE_CONNECTED
    return 0
  }

  /**
   * A message the server wrote at `level`, `output[at .. end)` of that
   * level's buffer, goes into the transcript and stays on the output.
   */
  sent(level: i32, at: i32, end: i32): void {
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
   * buffers in place calls `clearOutput` instead, and allocates nothing.
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
      default:
        // Nothing is written at the Application level before NewSessionTicket, which is out of scope.
        return none
    }
  }

  /** Forgets the handshake bytes written at `level`, which a carrier has read out of the buffer itself. */
  clearOutput(level: i32): void {
    if (level === TLS_LEVEL_INITIAL) {
      this.outputInitialLength = 0
    } else if (level === TLS_LEVEL_HANDSHAKE) {
      this.outputHandshakeLength = 0
    }
  }

  /**
   * The secret the server *reads* `level` under — the client's traffic secret
   * — or `null` while it is not known yet. The Initial level has none: it is
   * cleartext in TLS, and QUIC derives its own from the connection id.
   */
  readSecret(level: i32): u8[] | null {
    return tlsSecretAt(level, this.clientHandshakeSecret, this.clientApplicationSecret)
  }

  /** The secret the server *writes* `level` under — its own traffic secret — or `null` while it is not known yet. */
  writeSecret(level: i32): u8[] | null {
    return tlsSecretAt(level, this.serverHandshakeSecret, this.serverApplicationSecret)
  }
}
