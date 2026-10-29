/**
 * `nish/net/tls-client` — the client side of a TLS 1.3 handshake (RFC 8446),
 * from the ClientHello to the client's Finished, carrier-agnostic and sans-IO,
 * the mirror of `nish/net/tls`'s `TlsServer`.
 *
 *     import { TlsClient, TLS_CLIENT_STATE_WAIT_AUTHENTICATION } from "nish/net/tls-client";
 *
 *     const client = new TlsClient(config, clientRandom, x25519Private);
 *     client.start();
 *     // send client.takeOutput(TLS_LEVEL_INITIAL), feed the server's bytes
 *     // to client.receive(level, bytes, 0, n), install the secrets, and when
 *     // the state is TLS_CLIENT_STATE_WAIT_AUTHENTICATION:
 *     client.authenticate(chainAlert, signatureValid);
 *
 * **Carrier-agnostic and sans-IO**, as `TlsServer` is: handshake messages go
 * in and come out tagged with their level (`TLS_LEVEL_*` of `nish/net/tls`),
 * the secrets for each level are readable from `secrets()` as soon as they
 * are known, and the client random and the ephemeral x25519 key are
 * constructor arguments. `nish/net/tls/record-client` puts the levels in
 * records over a byte stream.
 *
 * **What is offered.** TLS 1.3 only, the configuration's suites (any of
 * `TLS_AES_128_GCM_SHA256`, `TLS_AES_256_GCM_SHA384`,
 * `TLS_CHACHA20_POLY1305_SHA256`), the group x25519 with a share (or, under
 * `deferShare`, without one, which asks the server for a HelloRetryRequest),
 * the signature schemes ECDSA P-256 and P-384, RSA-PSS and Ed25519 (and RSA
 * PKCS#1 v1.5 for certificates), `server_name` for a DNS name and never an IP
 * literal, and ALPN when the configuration lists protocols. PSK, 0-RTT,
 * client certificates and TLS 1.2 are not here: a server that answers TLS 1.2
 * is refused with `protocol_version`, and a CertificateRequest with
 * `unexpected_message`. The group secp256r1 is not offered, so a server that
 * asks for it in a HelloRetryRequest is refused (`docs/security/tls-client.md`).
 *
 * **Authentication is handed off.** Once the server's CertificateVerify is
 * read the client stops at `TLS_CLIENT_STATE_WAIT_AUTHENTICATION`, holding the
 * chain (`chain`, leaf first, DER), the name it asked for (`serverName`), and
 * the signature's scheme, content and bytes (`scheme`, `signatureContent`,
 * `signature`). The caller checks the chain and the signature with its own
 * verifiers and answers with `authenticate`; `tlsClientAuthenticate` does
 * both through two functions of the caller's. Nothing here validates a
 * certificate path or verifies a signature, so a program links only the
 * verifiers it trusts.
 *
 * **Refusals are alerts.** `start`, `receive` and `authenticate` answer 0 or
 * a TLS alert description; after one the client is in
 * `TLS_CLIENT_STATE_FAILED` and answers the same alert to every call. Nothing
 * the peer sends can make it panic.
 *
 * **Secrets.** The ephemeral key is copied into the client's own `Secret`,
 * the caller's array zeroed, and wiped once the shared secret is computed. The ECDHE output and the
 * early secret are wiped before the ServerHello's handling returns; the
 * handshake, traffic and exporter secrets live in a `TlsSecretPool` of
 * `nish/net/tls`, read only inside `expose`, and `wipe` zeroes them all.
 *
 * Written from RFC 8446, RFC 7301 and RFC 6066, not ported from another
 * implementation.
 */
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"
import { SHA256_SIZE } from "nish/crypto/sha256"
import { SHA384_SIZE } from "nish/crypto/sha512"
import { timingSafeEqual, timingSafeEqualAt } from "nish/crypto/ct"
import { X25519_SIZE, x25519, x25519Base } from "nish/crypto/x25519"
import {
  TLS_ALERT_BAD_CERTIFICATE,
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_DECRYPT_ERROR,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_UNEXPECTED_MESSAGE,
  TLS_EXT_COOKIE,
  TLS_EXT_EARLY_DATA,
  TLS_GROUP_X25519,
  TLS_HANDSHAKE_CERTIFICATE,
  TLS_HANDSHAKE_CERTIFICATE_VERIFY,
  TLS_HANDSHAKE_CLIENT_HELLO,
  TLS_HANDSHAKE_ENCRYPTED_EXTENSIONS,
  TLS_HANDSHAKE_FINISHED,
  TLS_HANDSHAKE_SERVER_HELLO,
  TLS_RANDOM_SIZE,
  TLS_VERSION_13,
  TlsClientHelloView,
  TlsServerMessageView,
  tlsReadCertificateVerify,
  tlsReadClientHello,
  tlsReadEncryptedExtensions,
  tlsReadServerCertificate,
  tlsReadServerHello,
  tlsWindowHasU16,
  tlsWindowString,
  tlsWriteCertificateVerifyContent,
  tlsWriteClientHello,
  tlsWriteFinished,
} from "nish/net/tls/codec"
import {
  TLS_AES_128_GCM_SHA256,
  TLS_AES_256_GCM_SHA384,
  TLS_CHACHA20_POLY1305_SHA256,
  TlsTranscript,
  tlsDeriveSecretHeld,
  tlsEarlySecret,
  tlsFinishedVerifyDataHeld,
  tlsHandshakeSecretHeld,
  tlsMasterSecretHeld,
  tlsSuiteHashLength,
} from "nish/net/tls/schedule"
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_MAX_HANDSHAKE_MESSAGE,
  TLS_SECRET_CLIENT_APPLICATION,
  TLS_SECRET_CLIENT_HANDSHAKE,
  TLS_SECRET_EXPORTER,
  TLS_SECRET_HANDSHAKE,
  TLS_SECRET_SERVER_APPLICATION,
  TLS_SECRET_SERVER_HANDSHAKE,
  TlsSecretPool,
  tlsHeldCopyIn,
} from "nish/net/tls"

// ---- States ------------------------------------------------------------------

/** Made, `start` not yet called. */
export const TLS_CLIENT_STATE_START: i32 = 0
/** The ClientHello is written; a ServerHello or one HelloRetryRequest is next, at the Initial level. */
export const TLS_CLIENT_STATE_WAIT_SERVER_HELLO: i32 = 1
/** The handshake secrets are known; EncryptedExtensions is next, at the Handshake level. */
export const TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS: i32 = 2
/** The server's Certificate is next. */
export const TLS_CLIENT_STATE_WAIT_CERTIFICATE: i32 = 3
/** The server's CertificateVerify is next. */
export const TLS_CLIENT_STATE_WAIT_CERTIFICATE_VERIFY: i32 = 4
/** The chain and the signature wait for the caller's verdict, `authenticate`; bytes that arrive meanwhile are kept. */
export const TLS_CLIENT_STATE_WAIT_AUTHENTICATION: i32 = 5
/** The server is authenticated; its Finished is next. */
export const TLS_CLIENT_STATE_WAIT_FINISHED: i32 = 6
/** The client's Finished is written and the application secrets are known. */
export const TLS_CLIENT_STATE_CONNECTED: i32 = 7
/** Refused: `alert` says why, and every call answers it. */
export const TLS_CLIENT_STATE_FAILED: i32 = 8

/** Where a buffer of this module starts: a typed zero, so the f64 build reads it as an i32. */
const TLS_CLIENT_FROM: i32 = 0
/** The input buffer's first size: a server's flight is cut into messages, and only the Certificate is usually larger. */
const TLS_CLIENT_INPUT_START: i32 = 2048
/** The longest DNS name `server_name` carries (RFC 1035 §2.3.4, without the trailing dot). */
const TLS_CLIENT_NAME_MAX: i32 = 253
/** A message header: its type and a 24-bit length (§4). */
const TLS_CLIENT_HEADER: i32 = 4

/**
 * What a `TlsClient` offers. `serverName` is the name the server must prove
 * (sent as `server_name` unless it is an IP literal, and handed to the chain
 * check either way); `alpn` the protocols in order of preference, none to
 * send no ALPN; `suites` the cipher suites in order of preference, at least
 * one; `deferShare` sends no key share in the first ClientHello, which costs
 * a round trip (a HelloRetryRequest) and exists for tests and for servers
 * that must pick the group themselves.
 */
export interface TlsClientConfig {
  serverName: string
  alpn: string[]
  suites: i32[]
  deferShare: boolean
}

/** Whether `name` is an IPv6 literal (it holds a colon) or reads as dotted decimal, which `server_name` never carries (RFC 6066 §3). */
const tlsClientIsIpLiteral = (name: string): boolean => {
  let numeric: boolean = true
  for (let k: i32 = 0; k < toI32(name.length); k++) {
    const c: i32 = toI32(name.charCodeAt(k))
    if (c === 0x3a) {
      return true
    }
    if (c !== 0x2e && (c < 0x30 || c > 0x39)) {
      numeric = false
    }
  }
  return numeric && toI32(name.length) > 0
}

/** Whether `name` is a DNS name `server_name` may carry: 1 to 253 letters, digits, dots, hyphens and underscores. */
const tlsClientIsDnsName = (name: string): boolean => {
  const length: i32 = toI32(name.length)
  if (length < 1 || length > TLS_CLIENT_NAME_MAX) {
    return false
  }
  // Labels of 1 to 63 bytes (RFC 1035 §2.3.4) between single dots, none at
  // either end.
  let label: i32 = 0
  for (let k: i32 = 0; k < length; k++) {
    const c: i32 = toI32(name.charCodeAt(k))
    if (c === 0x2e) {
      if (label === 0) {
        return false
      }
      label = 0
      continue
    }
    const letter: boolean = (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a)
    const digit: boolean = c >= 0x30 && c <= 0x39
    if (!letter && !digit && c !== 0x2d && c !== 0x5f) {
      return false
    }
    label = label + 1
    if (label > 63) {
      return false
    }
  }
  return label > 0
}

/**
 * Whether `config` can be written as a ClientHello: one to 64 suites, every
 * one of the three this module negotiates; ALPN names of 1 to 255 bytes, each
 * byte one character; a server name that is empty, an IP literal or a DNS
 * name. A configuration that fails is the caller's fault, `internal_error`.
 */
const tlsClientConfigFits = (config: TlsClientConfig): boolean => {
  const suites: i32 = toI32(config.suites.length)
  if (suites < 1 || suites > 64) {
    return false
  }
  for (const suite of config.suites) {
    if (
      suite !== TLS_AES_128_GCM_SHA256 &&
      suite !== TLS_AES_256_GCM_SHA384 &&
      suite !== TLS_CHACHA20_POLY1305_SHA256
    ) {
      return false
    }
  }
  let alpnTotal: i32 = 0
  for (const protocol of config.alpn) {
    const length: i32 = toI32(protocol.length)
    if (length < 1 || length > 255) {
      return false
    }
    for (let k: i32 = 0; k < length; k++) {
      if (toI32(protocol.charCodeAt(k)) > 255) {
        return false
      }
    }
    alpnTotal = alpnTotal + 1 + length
  }
  // The extension body is at most 2^16 - 1 bytes, two of them the list length.
  if (alpnTotal > 65533) {
    return false
  }
  const name: string = config.serverName
  return toI32(name.length) === 0 || tlsClientIsIpLiteral(name) || tlsClientIsDnsName(name)
}

/** Whether a held secret is all zeros, in constant time: the ECDHE output of a small-order share (RFC 7748 §6.1). */
const tlsClientIsZero = (held: u8[]): boolean => timingSafeEqual(held, new Array<u8>(X25519_SIZE))

/** Zeroes the bytes a `Secret` holds, for `exposeWith` to run on the ephemeral key once it is spent; answers `answer`. */
const tlsClientZeroHeld = (held: u8[], answer: i32): i32 => {
  wipe(held)
  return answer
}

/** Whether extension `type`'s bit is set in a view's `extensionSeen`. */
const tlsClientSeen = (bits: u32[], type: i32): boolean => {
  const word: i32 = type >> 5
  if (word < 0 || word >= toI32(bits.length)) {
    return false
  }
  return (bits[word] & (toU32(1) << toU32(type & 31))) !== toU32(0)
}

/**
 * The client side of one TLS 1.3 handshake, from its ClientHello to its
 * Finished: see the module header. One per connection.
 */
export class TlsClient {
  config: TlsClientConfig
  clientRandom: u8[]
  /** The ephemeral x25519 private key: the caller's, wiped once the shared secret is computed. */
  readonly ephemeral: Secret<u8[]>
  /** Its public key, the share the ClientHello carries. */
  ephemeralPublic: u8[]
  /** The `server_name` sent: the configuration's, or empty for an IP literal. */
  sniName: string
  /** The name the chain must be for: the configuration's, IP literal or not. */
  serverName: string
  /** The protocol the server chose from the ALPN offer, or empty. */
  alpn: string = ""
  /** The ClientHello last sent, whole: `offered`'s windows point into it. */
  hello: u8[]
  offered: TlsClientHelloView
  view: TlsServerMessageView
  transcript: TlsTranscript
  /** The server's message being assembled, header included. */
  input: u8[]
  /** Bytes that arrived while `authenticate` was awaited, handled once it answers. */
  pending: u8[]
  outputInitial: u8[]
  outputHandshake: u8[]
  secrets256: TlsSecretPool
  secrets384: TlsSecretPool
  /** A transcript hash, HashLen bytes used. */
  hashes: u8[]
  /** The server's x25519 share, copied out of its ServerHello. */
  peerShare: u8[]
  /** The server's chain, leaf first, DER: what `authenticate`'s chain answer is about. */
  chain: u8[][]
  /** CertificateVerify's scheme (a TLS 1.3 SignatureScheme). */
  scheme: i32 = 0
  /** What CertificateVerify signs (§4.4.3): 64 spaces, the server context string, a zero and the transcript hash through Certificate. */
  signatureContent: u8[]
  /** CertificateVerify's signature. */
  signature: u8[]
  /** One bit per `TLS_SECRET_*` the handshake has derived. */
  held: i32 = 0
  state: i32 = 0
  alert: i32 = 0
  suite: i32 = 0
  hashLength: i32 = 0
  inputLength: i32 = 0
  pendingLength: i32 = 0
  outputInitialLength: i32 = 0
  outputHandshakeLength: i32 = 0
  /** Whether a HelloRetryRequest was answered, so a second is refused (§4.1.4). */
  retried: boolean = false
  /** The suite the HelloRetryRequest chose, which the ServerHello must repeat (§4.1.4). */
  retrySuite: i32 = 0
  /** Whether the ClientHello carries the x25519 share. */
  shared: boolean = false
  /** Set when a message ends its flight: any byte after it in the same call is refused (§5.1). */
  flightEnded: boolean = false

  /**
   * A client under `config` with its 32-byte `clientRandom` and its
   * ephemeral x25519 key, copied into the client's `Secret` and the caller's
   * array zeroed. A random or key of
   * another length, or a configuration `tlsClientConfigFits` refuses, leaves
   * it failed with `internal_error`, which `start` answers.
   */
  constructor(config: TlsClientConfig, clientRandom: u8[], x25519Private: u8[]) {
    this.config = config
    this.clientRandom = clientRandom
    this.ephemeral = secret(new Array<u8>(X25519_SIZE))
    this.ephemeralPublic = []
    this.serverName = config.serverName
    this.sniName = tlsClientIsIpLiteral(config.serverName) ? "" : config.serverName
    this.hello = []
    this.offered = new TlsClientHelloView()
    this.view = new TlsServerMessageView()
    this.transcript = new TlsTranscript(SHA256_SIZE)
    this.input = new Array<u8>(TLS_CLIENT_INPUT_START)
    this.pending = []
    this.outputInitial = []
    this.outputHandshake = new Array<u8>(TLS_CLIENT_HEADER + SHA384_SIZE)
    this.secrets256 = new TlsSecretPool(SHA256_SIZE)
    this.secrets384 = new TlsSecretPool(SHA384_SIZE)
    this.hashes = new Array<u8>(SHA384_SIZE)
    this.peerShare = new Array<u8>(X25519_SIZE)
    this.chain = []
    this.signatureContent = []
    this.signature = []
    this.shared = !config.deferShare
    const keyLength: i32 = toI32(x25519Private.length)
    exposeWith(this.ephemeral, x25519Private, tlsHeldCopyIn)
    secureZero(x25519Private)
    if (
      toI32(clientRandom.length) !== TLS_RANDOM_SIZE ||
      keyLength !== X25519_SIZE ||
      !tlsClientConfigFits(config)
    ) {
      this.fail(TLS_ALERT_INTERNAL_ERROR)
      return
    }
    const pub: u8[] | null = x25519Base(this.ephemeral)
    if (pub === null) {
      this.fail(TLS_ALERT_INTERNAL_ERROR)
      return
    }
    this.ephemeralPublic = pub
  }

  /** Fails the handshake with `alert`, wiping every secret, and answers it. */
  fail(alert: i32): i32 {
    this.wipe()
    this.state = TLS_CLIENT_STATE_FAILED
    this.alert = alert
    return alert
  }

  /** The pool of the negotiated hash: SHA-384's for a SHA-384 suite, SHA-256's otherwise. */
  secrets(): TlsSecretPool {
    return this.hashLength === SHA384_SIZE ? this.secrets384 : this.secrets256
  }

  /** Whether the handshake has derived secret `index` (`TLS_SECRET_*` of `nish/net/tls`). */
  known(index: i32): boolean {
    return index >= 0 && index < 31 && (this.held & (1 << index)) !== 0
  }

  /** Whether the secret the client *reads* `level` under — `serverHandshake` or `serverApplication` — is known. */
  readKnown(level: i32): boolean {
    if (level === TLS_LEVEL_HANDSHAKE) {
      return this.known(TLS_SECRET_SERVER_HANDSHAKE)
    }
    return level === TLS_LEVEL_APPLICATION && this.known(TLS_SECRET_SERVER_APPLICATION)
  }

  /** Whether the secret the client *writes* `level` under — `clientHandshake` or `clientApplication` — is known. */
  writeKnown(level: i32): boolean {
    if (level === TLS_LEVEL_HANDSHAKE) {
      return this.known(TLS_SECRET_CLIENT_HANDSHAKE)
    }
    return level === TLS_LEVEL_APPLICATION && this.known(TLS_SECRET_CLIENT_APPLICATION)
  }

  /**
   * Zeroes secret `index` of `secrets()` once a carrier has taken what it
   * needs from it; it stays known. The handshake traffic secrets are the
   * Finished keys as well, so a carrier wipes them only once the client is
   * connected.
   */
  wipeSecret(index: i32): void {
    this.secrets().zero(index)
  }

  /** Wipes every secret the client holds: the ephemeral key and both pools. */
  wipe(): void {
    wipe(this.ephemeral)
    this.secrets256.wipe()
    this.secrets384.wipe()
  }

  /**
   * Writes the first ClientHello at the Initial level. Answers 0, or the
   * alert the client failed with (`internal_error` for what the constructor
   * refused, or a second call).
   */
  start(): i32 {
    if (this.state === TLS_CLIENT_STATE_FAILED) {
      return this.alert
    }
    if (this.state !== TLS_CLIENT_STATE_START) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    const none: u8[] = []
    return this.sendHello(none, TLS_CLIENT_FROM, TLS_CLIENT_FROM)
  }

  /**
   * Sends `hello`, a whole ClientHello the caller encoded, instead of the one
   * `start` would write, as RFC 8448's trace does. It must parse, offer TLS
   * 1.3, carry exactly this client's x25519 share and nothing this client
   * cannot finish — a PSK, early data or a cookie — or the client fails with
   * `internal_error`.
   */
  startWith(hello: u8[]): i32 {
    if (this.state === TLS_CLIENT_STATE_FAILED) {
      return this.alert
    }
    const length: i32 = toI32(hello.length)
    if (
      this.state !== TLS_CLIENT_STATE_START ||
      length < TLS_CLIENT_HEADER ||
      toI32(hello[0]) !== TLS_HANDSHAKE_CLIENT_HELLO ||
      ((toI32(hello[1]) << 16) | (toI32(hello[2]) << 8) | toI32(hello[3])) !== length - TLS_CLIENT_HEADER
    ) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    const offered: TlsClientHelloView = this.offered
    tlsReadClientHello(offered, hello, TLS_CLIENT_HEADER, length - TLS_CLIENT_HEADER)
    const shareFits: boolean =
      offered.x25519ShareLength === X25519_SIZE &&
      timingSafeEqualAt(hello, offered.x25519ShareAt, this.ephemeralPublic, TLS_CLIENT_FROM, X25519_SIZE)
    if (
      offered.alert !== 0 ||
      !shareFits ||
      !tlsWindowHasU16(offered.data, offered.versionsAt, offered.versionsLength, TLS_VERSION_13) ||
      offered.hasPreSharedKey ||
      tlsClientSeen(offered.extensionSeen, TLS_EXT_EARLY_DATA) ||
      tlsClientSeen(offered.extensionSeen, TLS_EXT_COOKIE)
    ) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    this.hello = hello
    this.shared = true
    this.queueInitial(hello)
    this.state = TLS_CLIENT_STATE_WAIT_SERVER_HELLO
    return 0
  }

  /**
   * Writes a ClientHello, echoing the cookie `input[cookieAt .. cookieAt +
   * cookieLength)` when that is not empty, reads it back into `offered` so
   * every later check is against the bytes sent, and queues it.
   */
  sendHello(cookie: u8[], cookieAt: i32, cookieLength: i32): i32 {
    const none: u8[] = []
    const config: TlsClientConfig = this.config
    const share: u8[] = this.shared ? this.ephemeralPublic : none
    const end: i32 = tlsWriteClientHello(
      none,
      TLS_CLIENT_FROM,
      this.clientRandom,
      this.sniName,
      config.alpn,
      config.suites,
      share,
      cookie,
      cookieAt,
      cookieLength
    )
    const hello: u8[] = new Array<u8>(end)
    tlsWriteClientHello(
      hello,
      TLS_CLIENT_FROM,
      this.clientRandom,
      this.sniName,
      config.alpn,
      config.suites,
      share,
      cookie,
      cookieAt,
      cookieLength
    )
    tlsReadClientHello(this.offered, hello, TLS_CLIENT_HEADER, end - TLS_CLIENT_HEADER)
    if (this.offered.alert !== 0) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    this.hello = hello
    this.queueInitial(hello)
    this.state = TLS_CLIENT_STATE_WAIT_SERVER_HELLO
    return 0
  }

  /** Appends `message` to the Initial level's output. */
  queueInitial(message: u8[]): void {
    const length: i32 = toI32(message.length)
    const grown: u8[] = new Array<u8>(this.outputInitialLength + length)
    for (let k: i32 = 0; k < this.outputInitialLength && k < toI32(this.outputInitial.length); k++) {
      grown[k] = this.outputInitial[k]
    }
    for (let k: i32 = 0; k < length; k++) {
      grown[this.outputInitialLength + k] = message[k]
    }
    this.outputInitial = grown
    this.outputInitialLength = this.outputInitialLength + length
  }

  /** The level the server's next bytes must arrive at, or -1 when the state expects none. */
  expectedLevel(): i32 {
    switch (this.state) {
      case TLS_CLIENT_STATE_WAIT_SERVER_HELLO:
        return TLS_LEVEL_INITIAL
      case TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS:
      case TLS_CLIENT_STATE_WAIT_CERTIFICATE:
      case TLS_CLIENT_STATE_WAIT_CERTIFICATE_VERIFY:
      case TLS_CLIENT_STATE_WAIT_AUTHENTICATION:
      case TLS_CLIENT_STATE_WAIT_FINISHED:
        return TLS_LEVEL_HANDSHAKE
      default:
        return -1
    }
  }

  /** Makes `input` hold at least `need` bytes, keeping the ones it holds; it doubles, up to the largest message. */
  reserveInput(need: i32): void {
    const capacity: i32 = toI32(this.input.length)
    if (need <= capacity) {
      return
    }
    let size: i32 = capacity
    while (size < need) {
      size = size * 2
    }
    const most: i32 = TLS_MAX_HANDSHAKE_MESSAGE + TLS_CLIENT_HEADER
    const grown: u8[] = new Array<u8>(size > most ? most : size)
    for (let k: i32 = 0; k < this.inputLength && k < toI32(grown.length) && k < capacity; k++) {
      grown[k] = this.input[k]
    }
    this.input = grown
  }

  /**
   * Takes the handshake bytes `data[off .. off + len)` the server sent at
   * `level`, a whole message, part of one or several, and handles every
   * message they complete. Answers 0, or the alert the client fails with.
   *
   * A level other than the one the state expects is `unexpected_message`, as
   * is a byte after a message that ends the server's flight at its level — a
   * ServerHello, a HelloRetryRequest or the server's Finished — since RFC
   * 8446 §5.1 forbids a message to straddle a key change. A message longer
   * than `TLS_MAX_HANDSHAKE_MESSAGE` is `decode_error`. A window outside
   * `data` is `internal_error`, the caller's fault. Bytes that arrive while
   * `authenticate` is awaited are kept, up to one largest message, and handled
   * once it answers. Once connected, any bytes are `unexpected_message`: the
   * post-handshake messages belong to the record layer.
   */
  receive(level: i32, data: u8[], off: i32, len: i32): i32 {
    if (this.state === TLS_CLIENT_STATE_FAILED) {
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
    if (this.state === TLS_CLIENT_STATE_WAIT_AUTHENTICATION) {
      return this.keep(data, off, len)
    }
    let p: i32 = off
    const end: i32 = off + len
    while (p < end) {
      if (this.flightEnded) {
        return this.fail(TLS_ALERT_UNEXPECTED_MESSAGE)
      }
      if (this.state === TLS_CLIENT_STATE_WAIT_AUTHENTICATION) {
        return this.keep(data, p, end - p)
      }
      // The header first, then exactly the rest of its message, so the
      // buffer only ever holds the one message being assembled.
      let want: i32 = TLS_CLIENT_HEADER
      if (this.inputLength >= TLS_CLIENT_HEADER) {
        const length: i32 = (toI32(this.input[1]) << 16) | (toI32(this.input[2]) << 8) | toI32(this.input[3])
        if (length > TLS_MAX_HANDSHAKE_MESSAGE) {
          return this.fail(TLS_ALERT_DECODE_ERROR)
        }
        want = TLS_CLIENT_HEADER + length
        this.reserveInput(want)
      }
      while (p < end && this.inputLength < want) {
        this.input[this.inputLength] = data[p]
        this.inputLength = this.inputLength + 1
        p = p + 1
      }
      if (this.inputLength === want && want > TLS_CLIENT_HEADER) {
        this.inputLength = 0
        const alert: i32 = this.handleMessage(want - TLS_CLIENT_HEADER)
        if (alert !== 0) {
          return this.fail(alert)
        }
      } else if (this.inputLength === TLS_CLIENT_HEADER && want === TLS_CLIENT_HEADER) {
        // A header that ends the call is checked now, not when its body
        // comes; an empty message is whole once its header is, and none the
        // server sends may be empty, so the handler refuses it.
        const length: i32 = (toI32(this.input[1]) << 16) | (toI32(this.input[2]) << 8) | toI32(this.input[3])
        if (length > TLS_MAX_HANDSHAKE_MESSAGE) {
          return this.fail(TLS_ALERT_DECODE_ERROR)
        }
        if (length === 0) {
          this.inputLength = 0
          const alert: i32 = this.handleMessage(toI32(0))
          if (alert !== 0) {
            return this.fail(alert)
          }
        }
      }
    }
    this.flightEnded = false
    return 0
  }

  /** Keeps `data[off .. off + len)` for after `authenticate`, refusing more than one largest message's worth. */
  keep(data: u8[], off: i32, len: i32): i32 {
    if (len > TLS_MAX_HANDSHAKE_MESSAGE + TLS_CLIENT_HEADER - this.pendingLength) {
      return this.fail(TLS_ALERT_DECODE_ERROR)
    }
    const grown: u8[] = new Array<u8>(this.pendingLength + len)
    for (let k: i32 = 0; k < this.pendingLength && k < toI32(this.pending.length); k++) {
      grown[k] = this.pending[k]
    }
    for (let k: i32 = 0; k < len; k++) {
      grown[this.pendingLength + k] = data[off + k]
    }
    this.pending = grown
    this.pendingLength = this.pendingLength + len
    return 0
  }

  /** Dispatches one whole message, `input[0 .. 4 + length)`, by the state. */
  handleMessage(length: i32): i32 {
    const type: i32 = toI32(this.input[0])
    switch (this.state) {
      case TLS_CLIENT_STATE_WAIT_SERVER_HELLO:
        return type === TLS_HANDSHAKE_SERVER_HELLO
          ? this.handleServerHello(length)
          : TLS_ALERT_UNEXPECTED_MESSAGE
      case TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS:
        return type === TLS_HANDSHAKE_ENCRYPTED_EXTENSIONS
          ? this.handleEncryptedExtensions(length)
          : TLS_ALERT_UNEXPECTED_MESSAGE
      case TLS_CLIENT_STATE_WAIT_CERTIFICATE:
        return type === TLS_HANDSHAKE_CERTIFICATE
          ? this.handleCertificate(length)
          : TLS_ALERT_UNEXPECTED_MESSAGE
      case TLS_CLIENT_STATE_WAIT_CERTIFICATE_VERIFY:
        return type === TLS_HANDSHAKE_CERTIFICATE_VERIFY
          ? this.handleCertificateVerify(length)
          : TLS_ALERT_UNEXPECTED_MESSAGE
      case TLS_CLIENT_STATE_WAIT_FINISHED:
        return type === TLS_HANDSHAKE_FINISHED ? this.handleFinished(length) : TLS_ALERT_UNEXPECTED_MESSAGE
      default:
        return TLS_ALERT_UNEXPECTED_MESSAGE
    }
  }

  /**
   * A ServerHello or a HelloRetryRequest (§4.1.3, §4.1.4), checked by
   * `tlsReadServerHello` against the hello sent. A retry is answered once,
   * with a second ClientHello carrying the share and the cookie; a second
   * retry is `unexpected_message`, and a ServerHello whose suite is not the
   * retry's is `illegal_parameter`. A ServerHello's share gives the ECDHE
   * secret (an all-zero one, a small-order share, is `illegal_parameter`),
   * and the handshake traffic secrets follow.
   */
  handleServerHello(length: i32): i32 {
    const view: TlsServerMessageView = this.view
    tlsReadServerHello(view, this.offered, this.input, TLS_CLIENT_HEADER, length)
    // A second retry is refused as such (§4.1.4), whatever else is wrong
    // with it: the codec would call its group already shared.
    if (view.retry && this.retried) {
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    if (view.alert !== 0) {
      return view.alert
    }
    this.flightEnded = true
    const h: i32 = tlsSuiteHashLength(view.suite)
    if (view.retry) {
      this.retried = true
      this.retrySuite = view.suite
      // §4.4.1: the first hello is replaced by its hash, and the retry and
      // the second hello follow it under the hash of the suite chosen.
      this.transcript.reset(h)
      this.transcript.update(this.hello, TLS_CLIENT_FROM, toI32(this.hello.length))
      this.transcript.restartWithMessageHash()
      this.transcript.update(this.input, TLS_CLIENT_FROM, TLS_CLIENT_HEADER + length)
      if (view.group === TLS_GROUP_X25519) {
        this.shared = true
      }
      const alert: i32 = this.sendHello(this.input, view.cookieAt, view.cookieLength)
      if (alert !== 0) {
        return alert
      }
      this.transcript.update(this.hello, TLS_CLIENT_FROM, toI32(this.hello.length))
      return 0
    }
    if (this.retried && view.suite !== this.retrySuite) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    if (!this.retried) {
      this.transcript.reset(h)
      this.transcript.update(this.hello, TLS_CLIENT_FROM, toI32(this.hello.length))
    }
    this.transcript.update(this.input, TLS_CLIENT_FROM, TLS_CLIENT_HEADER + length)
    this.suite = view.suite
    this.hashLength = h
    for (let k: i32 = 0; k < X25519_SIZE; k++) {
      this.peerShare[k] = this.input[view.shareAt + k]
    }
    const ecdhe: Secret<u8[]> | null = x25519(this.ephemeral, this.peerShare)
    // The ephemeral key has done its one job, whatever the share was.
    exposeWith(this.ephemeral, TLS_CLIENT_FROM, tlsClientZeroHeld)
    if (ecdhe === null) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    if (expose(ecdhe, tlsClientIsZero)) {
      wipe(ecdhe)
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    const pool: TlsSecretPool = this.secrets()
    const early: Secret<u8[]> = tlsEarlySecret(h)
    tlsHandshakeSecretHeld(h, early, ecdhe, pool.handshake)
    wipe(early)
    wipe(ecdhe)
    this.transcript.hashInto(this.hashes, TLS_CLIENT_FROM)
    tlsDeriveSecretHeld(h, pool.handshake, "c hs traffic", this.hashes, TLS_CLIENT_FROM, pool.clientHandshake)
    tlsDeriveSecretHeld(h, pool.handshake, "s hs traffic", this.hashes, TLS_CLIENT_FROM, pool.serverHandshake)
    this.held =
      (1 << TLS_SECRET_HANDSHAKE) | (1 << TLS_SECRET_CLIENT_HANDSHAKE) | (1 << TLS_SECRET_SERVER_HANDSHAKE)
    this.state = TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS
    return 0
  }

  /** EncryptedExtensions (§4.3.1), checked by `tlsReadEncryptedExtensions`; its ALPN choice becomes `alpn`. */
  handleEncryptedExtensions(length: i32): i32 {
    const view: TlsServerMessageView = this.view
    tlsReadEncryptedExtensions(view, this.offered, this.input, TLS_CLIENT_HEADER, length)
    if (view.alert !== 0) {
      return view.alert
    }
    this.alpn = tlsWindowString(this.input, view.alpnAt, view.alpnLength)
    this.transcript.update(this.input, TLS_CLIENT_FROM, TLS_CLIENT_HEADER + length)
    this.state = TLS_CLIENT_STATE_WAIT_CERTIFICATE
    return 0
  }

  /** The server's Certificate (§4.4.2), read into `chain`; an empty one is `decode_error` (§4.4.2.4). */
  handleCertificate(length: i32): i32 {
    const view: TlsServerMessageView = this.view
    const chain: u8[][] = []
    tlsReadServerCertificate(view, this.offered, this.input, TLS_CLIENT_HEADER, length, chain)
    if (view.alert !== 0) {
      return view.alert
    }
    this.chain = chain
    this.transcript.update(this.input, TLS_CLIENT_FROM, TLS_CLIENT_HEADER + length)
    this.state = TLS_CLIENT_STATE_WAIT_CERTIFICATE_VERIFY
    return 0
  }

  /**
   * CertificateVerify (§4.4.3): its scheme must be one offered. The content
   * it signs is built from the transcript through Certificate, and the client
   * stops for `authenticate`.
   */
  handleCertificateVerify(length: i32): i32 {
    const view: TlsServerMessageView = this.view
    tlsReadCertificateVerify(view, this.offered, this.input, TLS_CLIENT_HEADER, length)
    if (view.alert !== 0) {
      return view.alert
    }
    const h: i32 = this.hashLength
    this.transcript.hashInto(this.hashes, TLS_CLIENT_FROM)
    const none: u8[] = []
    const content: u8[] = new Array<u8>(
      tlsWriteCertificateVerifyContent(none, TLS_CLIENT_FROM, this.hashes, TLS_CLIENT_FROM, h)
    )
    tlsWriteCertificateVerifyContent(content, TLS_CLIENT_FROM, this.hashes, TLS_CLIENT_FROM, h)
    const signature: u8[] = new Array<u8>(view.signatureLength)
    for (let k: i32 = 0; k < view.signatureLength; k++) {
      signature[k] = this.input[view.signatureAt + k]
    }
    this.scheme = view.scheme
    this.signatureContent = content
    this.signature = signature
    this.transcript.update(this.input, TLS_CLIENT_FROM, TLS_CLIENT_HEADER + length)
    this.state = TLS_CLIENT_STATE_WAIT_AUTHENTICATION
    return 0
  }

  /**
   * The caller's verdict on the server, asked for by
   * `TLS_CLIENT_STATE_WAIT_AUTHENTICATION`: `chainAlert` is 0 when `chain` is
   * trusted for `serverName`, or the alert to refuse it with (one outside 1 to
   * 255 is sent as `bad_certificate`); `signatureValid` says whether
   * `signature` under `scheme` verifies `signatureContent` with the leaf's key,
   * and `false` is `decrypt_error` (§4.4.3). Once both pass, the bytes kept
   * meanwhile are handled. A call in another state is `internal_error`.
   */
  authenticate(chainAlert: i32, signatureValid: boolean): i32 {
    if (this.state === TLS_CLIENT_STATE_FAILED) {
      return this.alert
    }
    if (this.state !== TLS_CLIENT_STATE_WAIT_AUTHENTICATION) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    if (chainAlert !== 0) {
      return this.fail(chainAlert > 0 && chainAlert < 256 ? chainAlert : TLS_ALERT_BAD_CERTIFICATE)
    }
    if (!signatureValid) {
      return this.fail(TLS_ALERT_DECRYPT_ERROR)
    }
    this.state = TLS_CLIENT_STATE_WAIT_FINISHED
    const kept: u8[] = this.pending
    const keptLength: i32 = this.pendingLength
    this.pending = []
    this.pendingLength = 0
    return this.receive(TLS_LEVEL_HANDSHAKE, kept, TLS_CLIENT_FROM, keptLength)
  }

  /**
   * The server's Finished (§4.4.4): `verify_data` must be HashLen bytes
   * (`decode_error`) equal, in constant time, to the HMAC under the server's
   * handshake secret of the transcript through CertificateVerify
   * (`decrypt_error`). The application and exporter secrets follow from the
   * transcript through it, and the client's Finished is written at the
   * Handshake level.
   */
  handleFinished(length: i32): i32 {
    const h: i32 = this.hashLength
    if (length !== h) {
      return TLS_ALERT_DECODE_ERROR
    }
    const pool: TlsSecretPool = this.secrets()
    this.transcript.hashInto(this.hashes, TLS_CLIENT_FROM)
    const expected: u8[] = tlsFinishedVerifyDataHeld(h, pool.serverHandshake, this.hashes, TLS_CLIENT_FROM)
    if (!timingSafeEqualAt(this.input, TLS_CLIENT_HEADER, expected, TLS_CLIENT_FROM, h)) {
      return TLS_ALERT_DECRYPT_ERROR
    }
    this.flightEnded = true
    this.transcript.update(this.input, TLS_CLIENT_FROM, TLS_CLIENT_HEADER + length)
    this.transcript.hashInto(this.hashes, TLS_CLIENT_FROM)
    // The master secret is written over the handshake secret, which has no
    // other use left, so no third secret is ever held.
    tlsMasterSecretHeld(h, pool.handshake, pool.handshake)
    tlsDeriveSecretHeld(
      h,
      pool.handshake,
      "c ap traffic",
      this.hashes,
      TLS_CLIENT_FROM,
      pool.clientApplication
    )
    tlsDeriveSecretHeld(
      h,
      pool.handshake,
      "s ap traffic",
      this.hashes,
      TLS_CLIENT_FROM,
      pool.serverApplication
    )
    tlsDeriveSecretHeld(h, pool.handshake, "exp master", this.hashes, TLS_CLIENT_FROM, pool.exporter)
    pool.zero(TLS_SECRET_HANDSHAKE)
    const verifyData: u8[] = tlsFinishedVerifyDataHeld(h, pool.clientHandshake, this.hashes, TLS_CLIENT_FROM)
    this.outputHandshakeLength = tlsWriteFinished(
      this.outputHandshake,
      TLS_CLIENT_FROM,
      verifyData,
      TLS_CLIENT_FROM,
      h
    )
    this.transcript.update(this.outputHandshake, TLS_CLIENT_FROM, this.outputHandshakeLength)
    this.held =
      (this.held & ~(1 << TLS_SECRET_HANDSHAKE)) |
      (1 << TLS_SECRET_CLIENT_APPLICATION) |
      (1 << TLS_SECRET_SERVER_APPLICATION) |
      (1 << TLS_SECRET_EXPORTER)
    this.state = TLS_CLIENT_STATE_CONNECTED
    return 0
  }

  /**
   * The handshake bytes written at `level` since the last call, in a fresh
   * array, and forgets them: the ClientHellos at the Initial level, the
   * client's Finished at the Handshake level.
   */
  takeOutput(level: i32): u8[] {
    const initial: boolean = level === TLS_LEVEL_INITIAL
    const buffer: u8[] = initial ? this.outputInitial : this.outputHandshake
    let length: i32 = 0
    if (initial) {
      length = this.outputInitialLength
    } else if (level === TLS_LEVEL_HANDSHAKE) {
      length = this.outputHandshakeLength
    }
    const out: u8[] = new Array<u8>(length)
    for (let k: i32 = 0; k < length && k < toI32(buffer.length); k++) {
      out[k] = buffer[k]
    }
    this.clearOutput(level)
    return out
  }

  /** Forgets the handshake bytes written at `level`, which a carrier has read out of the buffer itself. */
  clearOutput(level: i32): void {
    if (level === TLS_LEVEL_INITIAL) {
      this.outputInitialLength = 0
    } else if (level === TLS_LEVEL_HANDSHAKE) {
      this.outputHandshakeLength = 0
    }
  }
}

/**
 * Asks the caller's verifiers about the server `client` waits on and hands
 * the verdict to `authenticate`: `verifyChain(auth, chain, serverName)`
 * answers 0 or the alert to refuse the chain with (42 `bad_certificate`, 45
 * `certificate_expired`, 48 `unknown_ca`, ...), and only a chain it accepts is
 * asked `verifySignature(auth, chain, scheme, content, signature)`, which
 * checks the RFC 8446 §4.4.3 content against `chain[0]`'s key. `auth` is the
 * caller's state (trust anchors, a pinned key, a clock), passed to both.
 * Answers what `authenticate` answers.
 */
export const tlsClientAuthenticate = <A>(
  client: TlsClient,
  auth: A,
  verifyChain: (auth: A, chain: u8[][], serverName: string) => i32,
  verifySignature: (auth: A, chain: u8[][], scheme: i32, content: u8[], signature: u8[]) => boolean
): i32 => {
  if (client.state !== TLS_CLIENT_STATE_WAIT_AUTHENTICATION) {
    return client.authenticate(toI32(0), false)
  }
  const chainAlert: i32 = verifyChain(auth, client.chain, client.serverName)
  if (chainAlert !== 0) {
    return client.authenticate(chainAlert, false)
  }
  return client.authenticate(
    toI32(0),
    verifySignature(auth, client.chain, client.scheme, client.signatureContent, client.signature)
  )
}
