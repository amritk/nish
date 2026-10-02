/**
 * `nish/net/tls` — the server side of a TLS 1.3 handshake (RFC 8446), from
 * the client's first ClientHello to its Finished, carrier-agnostic and
 * sans-IO.
 *
 *     import { TlsServer, TLS_LEVEL_INITIAL } from "nish/net/tls";
 *
 *     const server = new TlsServer(config, serverRandom, x25519Private);
 *     const alert: i32 = server.receive(TLS_LEVEL_INITIAL, bytes, 0, n);
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
 * client falls back to a full handshake.
 *
 * **Refusals are alerts.** `receive` and `sign` answer 0 or a TLS alert
 * description (`TLS_ALERT_*` in `nish/net/tls/codec`); after one the server
 * is in `TLS_STATE_FAILED` and answers the same alert to every call. Nothing
 * the peer sends can make it panic.
 *
 * **Secrets are not wiped.** The ephemeral private key, the ECDHE secret, the
 * handshake and master secrets and every traffic secret stay in arena memory
 * until it is reused (CLAUDE.md §Security; TLS-1 in `docs/security/tls.md`).
 *
 * The state is a class and a `switch`, with no closures; a message allocates
 * only what the handshake keeps. Written from RFC 8446, RFC 7301, RFC 6066
 * and RFC 9001, not ported from another implementation.
 */
import { p256SignSha256 } from "nish/crypto/p256"
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
  TLS_LEGACY_VERSION,
  TLS_RANDOM_SIZE,
  TLS_VERSION_13,
  TLS_X25519_SHARE_SIZE,
  TlsClientHello,
  tlsCertificateVerifyContent,
  tlsEncodeCertificate,
  tlsEncodeCertificateVerify,
  tlsEncodeEncryptedExtensions,
  tlsEncodeFinished,
  tlsEncodeHelloRetryRequest,
  tlsEncodeServerHello,
  tlsListHas,
  tlsParseClientHello,
} from "nish/net/tls/codec"
import {
  TlsTranscript,
  tlsDeriveSecret,
  tlsEarlySecret,
  tlsFinishedVerifyData,
  tlsHandshakeSecret,
  tlsMasterSecret,
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

/**
 * Whether the bytes of `name` spell `protocol`, ALPN's byte-wise comparison
 * (RFC 7301 §3.2).
 */
const tlsAlpnMatches = (name: u8[], protocol: string): boolean => {
  const length: i32 = toI32(name.length)
  if (toI32(protocol.length) !== length) {
    return false
  }
  for (let k: i32 = 0; k < toI32(name.length) && k < toI32(protocol.length); k++) {
    if (toI32(name[k]) !== toI32(protocol.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** The bytes of `text`, which is ASCII here (an ALPN protocol id). */
const tlsAsciiBytes = (text: string): u8[] => {
  const out: u8[] = []
  const length: i32 = toI32(text.length)
  for (let k: i32 = 0; k < length; k++) {
    out.push(toU8(text.charCodeAt(k)))
  }
  return out
}

/** The minimal DER INTEGER for an unsigned big-endian magnitude: leading zeros dropped, one added when the top bit is set. */
const tlsDerInteger = (magnitude: u8[]): u8[] => {
  const body: u8[] = []
  let leading: boolean = true
  for (const b of magnitude) {
    if (leading && toI32(b) === 0) {
      continue
    }
    if (leading && toI32(b) >= 0x80) {
      body.push(toU8(0))
    }
    leading = false
    body.push(b)
  }
  // Zero is one zero octet, not an empty integer (X.690 §8.3.1).
  if (toI32(body.length) === 0) {
    body.push(toU8(0))
  }
  const out: u8[] = [toU8(0x02), toU8(toI32(body.length))]
  for (const b of body) {
    out.push(b)
  }
  return out
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
  const r: u8[] = []
  const s: u8[] = []
  for (let k: i32 = 0; k < toI32(rs.length); k++) {
    if (k < 32) {
      r.push(rs[k])
    } else {
      s.push(rs[k])
    }
  }
  const body: u8[] = tlsDerInteger(r)
  for (const b of tlsDerInteger(s)) {
    body.push(b)
  }
  // At most 2 * (2 + 33) = 70 bytes, so the length is one short-form byte.
  const out: u8[] = [toU8(0x30), toU8(toI32(body.length))]
  for (const b of body) {
    out.push(b)
  }
  return out
}

/**
 * Signs a CertificateVerify input for `ecdsa_secp256r1_sha256` with the P-256
 * private key `priv`: `p256SignSha256` (RFC 6979's deterministic nonce), DER
 * encoded. `null` for a malformed key. The answer is what `TlsServer.sign`
 * takes.
 */
export const tlsSignEcdsaP256 = (priv: u8[], content: u8[]): u8[] | null => {
  const rs: u8[] | null = p256SignSha256(priv, content)
  if (rs === null) {
    return null
  }
  return tlsEcdsaDerSignature(rs)
}

/**
 * One TLS 1.3 server handshake. Make one per connection, feed it what the
 * client sends with `receive`, send what `takeOutput` answers, and sign when
 * the state says so.
 *
 * The fields are readable: `state` and `alert`, the negotiated `suite`,
 * `serverName`, `alpn` and the client's `clientTransportParameters`, and the
 * traffic secrets. `readSecret` and `writeSecret` answer the last by level.
 */
export class TlsServer {
  config: TlsServerConfig
  state: i32 = 0
  /** The alert the server failed with, or 0. */
  alert: i32 = 0
  serverRandom: u8[]
  ephemeralPrivate: u8[]

  /** The negotiated cipher suite, or 0 before the first ClientHello is read. */
  suite: i32 = 0
  hashLength: i32 = 0
  /** Whether a HelloRetryRequest was sent, so a second miss is fatal. */
  retried: boolean = false
  /** The client's `host_name`, or empty. */
  serverName: string = ""
  /** The ALPN protocol chosen, one of the configuration's, or empty. */
  alpn: string = ""
  /** The client's `quic_transport_parameters`, opaque; empty unless the carrier is QUIC. */
  clientTransportParameters: u8[]

  transcript: TlsTranscript
  /** Bytes received at the current level and not yet a whole message. */
  input: u8[]
  outputInitial: u8[]
  outputHandshake: u8[]
  outputApplication: u8[]

  handshakeSecret: u8[]
  clientHandshakeSecret: u8[]
  serverHandshakeSecret: u8[]
  clientApplicationSecret: u8[]
  serverApplicationSecret: u8[]
  /** `exporter_master_secret` (RFC 8446 §7.5), for a caller's own exporters. */
  exporterSecret: u8[]
  /** The CertificateVerify input while `state` is `TLS_STATE_WAIT_SIGNATURE`. */
  toBeSigned: u8[]
  /** The client Finished's `verify_data`, known once the server's Finished is written. */
  expectedClientFinished: u8[]

  /**
   * A server for one connection under `config`, with the 32-byte server
   * random and the 32-byte x25519 private key drawn for it. A random or key of
   * another length, or a configuration with no certificate, leaves the server
   * failed with `internal_error` before it reads anything.
   */
  constructor(config: TlsServerConfig, serverRandom: u8[], ephemeralPrivate: u8[]) {
    this.config = config
    this.serverRandom = serverRandom
    this.ephemeralPrivate = ephemeralPrivate
    this.clientTransportParameters = []
    this.transcript = new TlsTranscript(0)
    this.input = []
    this.outputInitial = []
    this.outputHandshake = []
    this.outputApplication = []
    this.handshakeSecret = []
    this.clientHandshakeSecret = []
    this.serverHandshakeSecret = []
    this.clientApplicationSecret = []
    this.serverApplicationSecret = []
    this.exporterSecret = []
    this.toBeSigned = []
    this.expectedClientFinished = []
    if (
      toI32(serverRandom.length) !== TLS_RANDOM_SIZE ||
      toI32(ephemeralPrivate.length) !== X25519_SIZE ||
      toI32(config.certificateChain.length) === 0
    ) {
      this.state = TLS_STATE_FAILED
      this.alert = TLS_ALERT_INTERNAL_ERROR
    }
  }

  /** Fails the handshake with `alert` and answers it. */
  fail(alert: i32): i32 {
    this.state = TLS_STATE_FAILED
    this.alert = alert
    return alert
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
   * Takes the handshake bytes `data[off .. off + len)` the client sent at
   * `level`, a whole message, part of one or several, and handles every
   * message they complete. Answers 0, or the alert the server fails with.
   *
   * A level other than the one the state expects is `unexpected_message`, as
   * is a byte left over once a message ends the client's flight: each of the
   * three messages a client sends here (two ClientHellos and a Finished) is
   * the last of its flight, and RFC 8446 §5.1 forbids a message to straddle a
   * key change. A window outside `data` is `internal_error`, the caller's
   * fault and not the peer's.
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
    for (let k: i32 = off; k < off + len && k < toI32(data.length); k++) {
      this.input.push(data[k])
    }
    while (toI32(this.input.length) >= 4) {
      const length: i32 = (toI32(this.input[1]) << 16) | (toI32(this.input[2]) << 8) | toI32(this.input[3])
      if (length > TLS_MAX_HANDSHAKE_MESSAGE) {
        return this.fail(TLS_ALERT_DECODE_ERROR)
      }
      const whole: i32 = 4 + length
      if (toI32(this.input.length) < whole) {
        return 0
      }
      if (toI32(this.input.length) > whole) {
        return this.fail(TLS_ALERT_UNEXPECTED_MESSAGE)
      }
      const message: u8[] = this.input
      this.input = []
      const alert: i32 = this.handleMessage(toI32(message[0]), message, length)
      if (alert !== 0) {
        return this.fail(alert)
      }
    }
    return 0
  }

  /** Dispatches one whole message, `message[0 .. 4 + length)`, on the state. */
  handleMessage(type: i32, message: u8[], length: i32): i32 {
    switch (this.state) {
      case TLS_STATE_WAIT_CLIENT_HELLO:
        if (type !== TLS_HANDSHAKE_CLIENT_HELLO) {
          return TLS_ALERT_UNEXPECTED_MESSAGE
        }
        return this.handleClientHello(message, length)
      case TLS_STATE_WAIT_FINISHED:
        if (type !== TLS_HANDSHAKE_FINISHED) {
          return TLS_ALERT_UNEXPECTED_MESSAGE
        }
        return this.handleFinished(message, length)
      default:
        return TLS_ALERT_UNEXPECTED_MESSAGE
    }
  }

  /**
   * The first suite the client lists that this module negotiates, or 0
   * (§4.1.1: the server picks; following the client's order is the choice
   * RFC 8448's server makes).
   */
  chooseSuite(hello: TlsClientHello): i32 {
    for (const suite of hello.cipherSuites) {
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
  chooseAlpn(hello: TlsClientHello): i32 {
    this.alpn = ""
    if (hello.hasAlpn && toI32(this.config.alpn.length) > 0) {
      for (const protocol of this.config.alpn) {
        for (const name of hello.alpn) {
          if (this.alpn === "" && tlsAlpnMatches(name, protocol)) {
            this.alpn = protocol
          }
        }
      }
      if (this.alpn === "") {
        return TLS_ALERT_NO_APPLICATION_PROTOCOL
      }
    }
    if (this.config.quic && this.alpn === "") {
      return TLS_ALERT_NO_APPLICATION_PROTOCOL
    }
    return 0
  }

  /**
   * A ClientHello, the first or the second: refuse it, answer it with a
   * HelloRetryRequest, or answer it with ServerHello, EncryptedExtensions and
   * Certificate and wait for the signature. The checks run in the order a
   * reader of RFC 8446 would make them: the structure, then the version, then
   * the suite, the extensions §9.2 requires, the group, the signature scheme,
   * the share itself, and the application protocol.
   */
  handleClientHello(message: u8[], length: i32): i32 {
    const hello: TlsClientHello = tlsParseClientHello(message, 4, length)
    if (hello.alert !== 0) {
      return hello.alert
    }
    if (hello.legacyVersion < TLS_LEGACY_VERSION) {
      return TLS_ALERT_PROTOCOL_VERSION
    }
    // §4.2.1: without `supported_versions` the client offers TLS 1.2 or
    // earlier, which this server does not speak.
    if (!hello.hasSupportedVersions || !tlsListHas(hello.versions, TLS_VERSION_13)) {
      return TLS_ALERT_PROTOCOL_VERSION
    }
    if (hello.legacyVersion !== TLS_LEGACY_VERSION || !hello.nullCompressionOnly) {
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
    if (!tlsListHas(hello.groups, TLS_GROUP_X25519)) {
      return TLS_ALERT_HANDSHAKE_FAILURE
    }
    if (!tlsListHas(hello.signatureSchemes, this.config.signatureScheme)) {
      return TLS_ALERT_HANDSHAKE_FAILURE
    }
    if (!this.retried) {
      this.suite = suite
      this.hashLength = tlsSuiteHashLength(suite)
      this.transcript = new TlsTranscript(this.hashLength)
    }
    this.transcript.update(message, TLS_FROM, 4 + length)
    if (!hello.hasX25519Share) {
      // §4.1.4: one HelloRetryRequest; a second ClientHello without the share
      // the first one asked for is `illegal_parameter`.
      if (this.retried) {
        return TLS_ALERT_ILLEGAL_PARAMETER
      }
      this.retried = true
      this.transcript.restartWithMessageHash()
      const retry: u8[] = tlsEncodeHelloRetryRequest(hello.sessionId, this.suite, TLS_GROUP_X25519)
      this.transcript.update(retry, TLS_FROM, toI32(retry.length))
      this.emit(TLS_LEVEL_INITIAL, retry)
      return 0
    }
    if (toI32(hello.x25519Share.length) !== TLS_X25519_SHARE_SIZE) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    const alpnAlert: i32 = this.chooseAlpn(hello)
    if (alpnAlert !== 0) {
      return alpnAlert
    }
    this.serverName = hello.serverName
    if (this.config.quic) {
      this.clientTransportParameters = hello.quicTransportParameters
    }

    const serverPublic: u8[] | null = x25519Base(this.ephemeralPrivate)
    const shared: u8[] | null = x25519(this.ephemeralPrivate, hello.x25519Share)
    if (serverPublic === null || shared === null) {
      return TLS_ALERT_INTERNAL_ERROR
    }
    // RFC 7748 §6.1 leaves the all-zero check to the protocol, and RFC 8446
    // §7.4.2 makes it: a low-order client share gives the zero secret, which
    // anybody can compute. The secret is secret, so the compare reads it all.
    if (timingSafeEqual(shared, new Array<u8>(X25519_SIZE))) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }

    const serverHello: u8[] = tlsEncodeServerHello(
      this.serverRandom,
      hello.sessionId,
      this.suite,
      serverPublic
    )
    this.transcript.update(serverHello, TLS_FROM, toI32(serverHello.length))
    this.emit(TLS_LEVEL_INITIAL, serverHello)

    const h: i32 = this.hashLength
    this.handshakeSecret = tlsHandshakeSecret(h, tlsEarlySecret(h), shared)
    const helloHash: u8[] = this.transcript.hash()
    this.clientHandshakeSecret = tlsDeriveSecret(h, this.handshakeSecret, "c hs traffic", helloHash)
    this.serverHandshakeSecret = tlsDeriveSecret(h, this.handshakeSecret, "s hs traffic", helloHash)

    const extensions: u8[] = tlsEncodeEncryptedExtensions(
      this.config.extraExtensions,
      tlsAsciiBytes(this.alpn),
      hello.hasServerName,
      this.config.quic ? this.config.quicTransportParameters : null
    )
    this.transcript.update(extensions, TLS_FROM, toI32(extensions.length))
    this.emit(TLS_LEVEL_HANDSHAKE, extensions)
    const certificate: u8[] = tlsEncodeCertificate(this.config.certificateChain)
    this.transcript.update(certificate, TLS_FROM, toI32(certificate.length))
    this.emit(TLS_LEVEL_HANDSHAKE, certificate)

    this.toBeSigned = tlsCertificateVerifyContent(this.transcript.hash())
    this.state = TLS_STATE_WAIT_SIGNATURE
    return 0
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
    const verify: u8[] = tlsEncodeCertificateVerify(this.config.signatureScheme, signature)
    this.transcript.update(verify, TLS_FROM, toI32(verify.length))
    this.emit(TLS_LEVEL_HANDSHAKE, verify)
    const finished: u8[] = tlsEncodeFinished(
      tlsFinishedVerifyData(h, this.serverHandshakeSecret, this.transcript.hash())
    )
    this.transcript.update(finished, TLS_FROM, toI32(finished.length))
    this.emit(TLS_LEVEL_HANDSHAKE, finished)

    const serverFlightHash: u8[] = this.transcript.hash()
    const master: u8[] = tlsMasterSecret(h, this.handshakeSecret)
    this.clientApplicationSecret = tlsDeriveSecret(h, master, "c ap traffic", serverFlightHash)
    this.serverApplicationSecret = tlsDeriveSecret(h, master, "s ap traffic", serverFlightHash)
    this.exporterSecret = tlsDeriveSecret(h, master, "exp master", serverFlightHash)
    this.expectedClientFinished = tlsFinishedVerifyData(h, this.clientHandshakeSecret, serverFlightHash)
    this.toBeSigned = []
    this.state = TLS_STATE_WAIT_FINISHED
    return 0
  }

  /**
   * The client's Finished (§4.4.4): its `verify_data` is HashLen bytes and
   * must equal the HMAC the server computed, compared in constant time. A
   * wrong length is `decode_error`, a wrong value `decrypt_error`.
   */
  handleFinished(message: u8[], length: i32): i32 {
    if (length !== this.hashLength) {
      return TLS_ALERT_DECODE_ERROR
    }
    if (!timingSafeEqualAt(message, 4, this.expectedClientFinished, TLS_FROM, this.hashLength)) {
      return TLS_ALERT_DECRYPT_ERROR
    }
    this.transcript.update(message, TLS_FROM, 4 + length)
    // The handshake secret has done its work: drop the reference. It is not
    // wiped (TLS-1), only no longer held.
    this.handshakeSecret = []
    this.state = TLS_STATE_CONNECTED
    return 0
  }

  /** Appends a message to the output of `level`. */
  emit(level: i32, message: u8[]): void {
    const out: u8[] = level === TLS_LEVEL_INITIAL ? this.outputInitial : this.outputHandshake
    for (const b of message) {
      out.push(b)
    }
  }

  /**
   * The handshake bytes written at `level` since the last call, in a fresh
   * array, and forgets them. Bytes are only ever written at a level whose
   * secrets are already known, so a carrier that installs keys as they appear
   * can always protect what this answers.
   */
  takeOutput(level: i32): u8[] {
    const none: u8[] = []
    switch (level) {
      case TLS_LEVEL_INITIAL: {
        const out: u8[] = this.outputInitial
        this.outputInitial = none
        return out
      }
      case TLS_LEVEL_HANDSHAKE: {
        const out: u8[] = this.outputHandshake
        this.outputHandshake = none
        return out
      }
      default: {
        const out: u8[] = this.outputApplication
        this.outputApplication = none
        return out
      }
    }
  }

  /**
   * The secret the server *reads* `level` under — the client's traffic secret
   * — or `null` while it is not known yet. The Initial level has none: it is
   * cleartext in TLS, and QUIC derives its own from the connection id.
   */
  readSecret(level: i32): u8[] | null {
    if (level === TLS_LEVEL_HANDSHAKE && toI32(this.clientHandshakeSecret.length) > 0) {
      return this.clientHandshakeSecret
    }
    if (level === TLS_LEVEL_APPLICATION && toI32(this.clientApplicationSecret.length) > 0) {
      return this.clientApplicationSecret
    }
    return null
  }

  /** The secret the server *writes* `level` under — its own traffic secret — or `null` while it is not known yet. */
  writeSecret(level: i32): u8[] | null {
    if (level === TLS_LEVEL_HANDSHAKE && toI32(this.serverHandshakeSecret.length) > 0) {
      return this.serverHandshakeSecret
    }
    if (level === TLS_LEVEL_APPLICATION && toI32(this.serverApplicationSecret.length) > 0) {
      return this.serverApplicationSecret
    }
    return null
  }
}
