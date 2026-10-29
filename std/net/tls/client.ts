/**
 * `nish/net/tls/client` — the client side of a TLS 1.3 handshake (RFC 8446),
 * from its ClientHello to its Finished, carrier-agnostic and sans-IO: the
 * mirror of `nish/net/tls`'s `TlsServer`.
 *
 *     import { TlsClient, TlsClientConfig } from "nish/net/tls/client";
 *
 *     const client = new TlsClient(new TlsClientConfig("example.com", ["h2"]), random, x25519Key, p256Key);
 *     client.start();
 *     // send client.takeOutput(TLS_LEVEL_INITIAL); hand the server's bytes to
 *     // client.receive(level, bytes, 0, n); install secrets as they are known;
 *     // at TLS_CLIENT_STATE_WAIT_AUTH check peerCertificates() and the
 *     // signature, then client.authenticate(ok) (or client.reject(alert)).
 *
 * It lives in a module of its own, beside `nish/net/tls` and not re-exported
 * by it, since Nish has no re-exports; the levels and `TLS_SECRET_*` indices
 * it shares with the server are `nish/net/tls`'s.
 *
 * **Carrier-agnostic.** As the server does, the client reads and writes
 * handshake *messages* tagged with their level — the ClientHello and the
 * ServerHello at Initial, the rest of the server's flight and the client's
 * Finished at Handshake — and its secrets are readable as they become known.
 * `nish/net/tls/record-client` puts it on a byte stream.
 *
 * **Sans-IO.** The client random and both private keys, x25519's and P-256's,
 * are constructor arguments. Nothing here reads a socket, a clock or the
 * random device.
 *
 * **Authentication is the caller's.** Once the server's CertificateVerify is
 * read, the client stops at `TLS_CLIENT_STATE_WAIT_AUTH` without looking at
 * the chain or the signature: `peerCertificates`, `verifyScheme`,
 * `verifyContent` and `verifySignature` hand them out, and only
 * `authenticate(true)` goes on to the server's Finished and writes the
 * client's. A caller that drives this class directly must make that call
 * itself, after checking the chain against its trust anchors and the
 * signature over `verifyContent()` under the leaf's key: nothing here does
 * either, and nothing proves the peer is who `serverName` says until then
 * (`docs/security/tls.md`, "The client").
 *
 * **What is offered.** TLS 1.3 only, with a 32-byte `legacy_session_id` for
 * middlebox compatibility (§D.4). The suites, groups and first key share are
 * the configuration's: by default the three suites this tree negotiates and
 * the group x25519. `secp256r1` may be configured and its share is sent, but
 * a server that selects it fails the handshake with `internal_error`:
 * `nish/crypto/p256` has no ECDH yet. `signature_algorithms` lists ECDSA
 * P-256 and P-384 and RSA-PSS; `server_name` is sent unless the name is an
 * IP literal (RFC 6066 §3); ALPN is the configuration's. One
 * HelloRetryRequest is answered (§4.1.4); resumption, 0-RTT and client
 * certificates are not here, and a NewSessionTicket is read and dropped.
 *
 * **Refusals are alerts.** `receive`, `authenticate` and `reject` answer 0 or
 * a TLS alert description (`TLS_ALERT_*` in `nish/net/tls/codec`); after one
 * the client is in `TLS_CLIENT_STATE_FAILED`, every secret it held is wiped,
 * and it answers the same alert to every call. Nothing the peer sends can
 * make it panic.
 *
 * **Secrets.** Both private keys are copied into `Secret` fields and the
 * caller's arrays zeroed; the one the server did not pick is wiped when it
 * picks, and both once the exchange is done. The ECDHE secret is a `Secret`
 * wiped on every path; the handshake, traffic and exporter secrets are the
 * fields of two `TlsSecretPool`s. `fail` and `wipe` zero them all.
 *
 * The state is a class and a `switch`, with no closures. Written from RFC
 * 8446, RFC 7301 and RFC 6066, not ported from another implementation.
 */
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"
import { SHA256_SIZE } from "nish/crypto/sha256"
import { SHA384_SIZE } from "nish/crypto/sha512"
import { timingSafeEqual, timingSafeEqualAt } from "nish/crypto/ct"
import { X25519_SIZE, x25519, x25519Base } from "nish/crypto/x25519"
import { P256_SCALAR_SIZE, p256PublicKey } from "nish/crypto/p256"
import {
  TLS_ALERT_BAD_CERTIFICATE,
  TLS_ALERT_DECODE_ERROR,
  TLS_ALERT_DECRYPT_ERROR,
  TLS_ALERT_ILLEGAL_PARAMETER,
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_MISSING_EXTENSION,
  TLS_ALERT_PROTOCOL_VERSION,
  TLS_ALERT_UNEXPECTED_MESSAGE,
  TLS_ALERT_UNSUPPORTED_EXTENSION,
  TLS_GROUP_SECP256R1,
  TLS_GROUP_X25519,
  TLS_HANDSHAKE_CERTIFICATE,
  TLS_HANDSHAKE_CERTIFICATE_VERIFY,
  TLS_HANDSHAKE_ENCRYPTED_EXTENSIONS,
  TLS_HANDSHAKE_FINISHED,
  TLS_HANDSHAKE_NEW_SESSION_TICKET,
  TLS_HANDSHAKE_SERVER_HELLO,
  TLS_LEGACY_VERSION,
  TLS_P256_SHARE_SIZE,
  TLS_RANDOM_SIZE,
  TLS_VERSION_13,
  TLS_X25519_SHARE_SIZE,
  TlsServerFlightView,
  tlsCertificateVerifyContent,
  tlsClientOffersScheme,
  tlsCopyCertificates,
  tlsReadCertificate,
  tlsReadCertificateVerify,
  tlsReadEncryptedExtensions,
  tlsReadNewSessionTicket,
  tlsReadServerHello,
  tlsServerHelloDowngrade,
  tlsWindowString,
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

/** Built; `start` has not written the ClientHello yet. */
export const TLS_CLIENT_STATE_START: i32 = 0
/** The ClientHello is out; a ServerHello or HelloRetryRequest comes next, at the Initial level. */
export const TLS_CLIENT_STATE_WAIT_SERVER_HELLO: i32 = 1
/** The handshake secrets are known; EncryptedExtensions comes next, at the Handshake level. */
export const TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS: i32 = 2
export const TLS_CLIENT_STATE_WAIT_CERTIFICATE: i32 = 3
export const TLS_CLIENT_STATE_WAIT_CERTIFICATE_VERIFY: i32 = 4
/**
 * The server's chain and signature are read and wait for the caller's
 * verdict: `authenticate` or `reject`. Bytes that arrive meanwhile are held,
 * not read.
 */
export const TLS_CLIENT_STATE_WAIT_AUTH: i32 = 5
/** The caller accepted the server; its Finished comes next. */
export const TLS_CLIENT_STATE_WAIT_FINISHED: i32 = 6
/** Both Finished are done and the application secrets known. */
export const TLS_CLIENT_STATE_CONNECTED: i32 = 7
export const TLS_CLIENT_STATE_FAILED: i32 = 8

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_CLIENT_FROM: i32 = 0

/** The legacy_session_id the client sends (§4.1.2, §D.4): 32 bytes, so that middleboxes see a resumption. */
const TLS_CLIENT_SESSION_ID_SIZE: i32 = 32

/** The longest `server_name` a ClientHello carries: a DNS name's 253 characters, under the extension's own bound. */
const TLS_CLIENT_SERVER_NAME_MAX: i32 = 253

/**
 * What a client is configured with, the same for every connection. The
 * constructor fills in the defaults; a caller may narrow `suites` or `groups`
 * or change `shareGroup` before handing it to a `TlsClient`, which checks it.
 */
export class TlsClientConfig {
  /** The host the client means to reach: sent as `server_name` unless it is an IP literal, and the name the caller authenticates. */
  serverName: string
  /** The ALPN protocols offered, most preferred first; empty sends no ALPN. Each is 1 to 255 bytes. */
  alpn: string[]
  /** The cipher suites offered, most preferred first: a non-empty subset of the three this tree negotiates. */
  suites: i32[]
  /** The groups offered in `supported_groups`: a non-empty subset of x25519 and secp256r1. */
  groups: i32[]
  /** The group of the one key share the first ClientHello carries; one of `groups`. */
  shareGroup: i32

  constructor(serverName: string, alpn: string[]) {
    this.serverName = serverName
    this.alpn = alpn
    this.suites = [TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256]
    this.groups = [TLS_GROUP_X25519]
    this.shareGroup = TLS_GROUP_X25519
  }
}

/** Whether `suite` is one this tree negotiates. */
const tlsClientKnowsSuite = (suite: i32): boolean => tlsSuiteHashLength(suite) !== 0

/** Whether `group` is one the client can send a share for. */
const tlsClientKnowsGroup = (group: i32): boolean =>
  group === TLS_GROUP_X25519 || group === TLS_GROUP_SECP256R1

/**
 * Whether `name` is an IP literal, which RFC 6066 §3 keeps out of
 * `server_name`: dotted decimal (digits and dots only), or anything with a
 * colon, which no DNS name has.
 */
export const tlsClientIsIpLiteral = (name: string): boolean => {
  let digits: boolean = true
  for (let k: i32 = 0; k < toI32(name.length); k++) {
    const c: i32 = name.charCodeAt(k)
    if (c === 58) {
      return true
    }
    if (c !== 46 && (c < 48 || c > 57)) {
      digits = false
    }
  }
  return digits && toI32(name.length) > 0
}

/**
 * Whether `config` can be offered: suites and groups non-empty and known, the
 * share's group among the groups, every ALPN protocol 1 to 255 bytes, and a
 * server name of at most 253 bytes.
 */
const tlsClientConfigFits = (config: TlsClientConfig): boolean => {
  if (toI32(config.suites.length) === 0 || toI32(config.groups.length) === 0) {
    return false
  }
  for (const suite of config.suites) {
    if (!tlsClientKnowsSuite(suite)) {
      return false
    }
  }
  for (const group of config.groups) {
    if (!tlsClientKnowsGroup(group)) {
      return false
    }
  }
  if (config.groups.indexOf(config.shareGroup) < 0) {
    return false
  }
  for (const protocol of config.alpn) {
    if (toI32(protocol.length) < 1 || toI32(protocol.length) > 255) {
      return false
    }
  }
  return toI32(config.serverName.length) <= TLS_CLIENT_SERVER_NAME_MAX
}

/** Whether an x25519 shared secret is all zeros, reading every byte (run inside `expose`). */
const tlsClientIsZeroSecret = (shared: u8[]): boolean => timingSafeEqual(shared, new Array<u8>(X25519_SIZE))

/** Wipes the bytes a `Secret` holds, for `exposeWith`; answers `answer`. */
const tlsClientZeroHeld = (held: u8[], answer: i32): i32 => {
  wipe(held)
  return answer
}

/** `data[at .. at + length)` in a fresh array. */
const tlsClientCopy = (data: u8[], at: i32, length: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  for (let k: i32 = 0; k < toI32(out.length); k++) {
    const from: i32 = at + k
    if (from >= 0 && from < toI32(data.length)) {
      out[k] = data[from]
    }
  }
  return out
}

export class TlsClient {
  config: TlsClientConfig
  clientRandom: u8[]
  /** The x25519 private key, copied in by the constructor; wiped once the server picks a group, unless it picked x25519, then once the exchange is done. */
  readonly x25519Key: Secret<u8[]>
  /** The P-256 private key, held the same way. */
  readonly p256Key: Secret<u8[]>
  /** The legacy_session_id sent, which the ServerHello must echo. */
  sessionId: u8[]
  transcript: TlsTranscript
  /**
   * The first ClientHello, kept plain until the ServerHello names the hash:
   * the transcript feeds one hash only, so it starts from this copy.
   */
  firstHello: u8[]
  /** The bytes received at the current level and not yet read: `input[0 .. inputLength)`, whole messages and the start of the next. */
  input: u8[]
  /** What the client has written at the Initial level and not handed on. */
  outputInitial: u8[]
  /** What the client has written at the Handshake level and not handed on: its Finished. */
  outputHandshake: u8[]
  /** Nothing is ever written at the Application level; empty, for `takeOutput`'s sake. */
  outputApplication: u8[]
  secrets256: TlsSecretPool
  secrets384: TlsSecretPool
  /** The server message last read, as windows into `input`. */
  view: TlsServerFlightView
  /** The HelloRetryRequest's cookie, echoed in the second ClientHello; empty if it sent none. */
  cookie: u8[]
  /** The server's DER certificates, leaf first, once its Certificate is read. */
  certificates: u8[][]
  /** What the server's CertificateVerify signs (§4.4.3), once its Certificate is read. */
  content: u8[]
  /** The CertificateVerify signature, as it came on the wire. */
  signature: u8[]
  /** A transcript hash on its way into the schedule: HashLen bytes of it. */
  hashes: u8[]
  /** The ALPN protocol the server chose, one of the configuration's, or empty. */
  alpnChosen: string = ""
  /** Which of the negotiated pool's secrets are known: bit `1 << TLS_SECRET_*` for each, as `TlsServer.held`. */
  held: i32 = 0
  state: i32 = 0
  /** The alert the client failed with, or 0. */
  alert: i32 = 0
  /** The negotiated cipher suite, or 0 before the ServerHello (or HelloRetryRequest) is read. */
  suite: i32 = 0
  hashLength: i32 = 0
  /** The group of the key share the last ClientHello carried. */
  shareGroup: i32 = 0
  /** The CertificateVerify scheme. */
  scheme: i32 = 0
  inputLength: i32 = 0
  outputInitialLength: i32 = 0
  outputHandshakeLength: i32 = 0
  outputApplicationLength: i32 = 0
  /** Whether a HelloRetryRequest was read, so a second is fatal. */
  retried: boolean = false
  /** Whether `server_name` was sent, so that only then may the server acknowledge it. */
  sentServerName: boolean = false

  /**
   * A client for one connection under `config`, with the 32-byte client
   * random and the 32-byte x25519 and P-256 private keys drawn for it; both
   * keys are copied in and the caller's arrays zeroed. A random or key of
   * another length, or a configuration it cannot offer, leaves the client
   * failed with `internal_error` before it writes anything.
   */
  constructor(config: TlsClientConfig, clientRandom: u8[], x25519Private: u8[], p256Private: u8[]) {
    const x25519Length: i32 = toI32(x25519Private.length)
    const p256Length: i32 = toI32(p256Private.length)
    this.config = config
    this.clientRandom = clientRandom
    this.x25519Key = secret(new Array<u8>(X25519_SIZE))
    this.p256Key = secret(new Array<u8>(P256_SCALAR_SIZE))
    exposeWith(this.x25519Key, x25519Private, tlsHeldCopyIn)
    exposeWith(this.p256Key, p256Private, tlsHeldCopyIn)
    secureZero(x25519Private)
    secureZero(p256Private)
    // Public, and derived from the public random, so it gives nothing away;
    // its only job is to make the hello look like a resumption (§D.4).
    this.sessionId = tlsClientCopy(clientRandom, TLS_CLIENT_FROM, TLS_CLIENT_SESSION_ID_SIZE)
    this.transcript = new TlsTranscript(0)
    this.firstHello = []
    this.input = new Array<u8>(1024)
    this.outputInitial = []
    this.outputHandshake = new Array<u8>(4 + SHA384_SIZE)
    this.outputApplication = []
    this.secrets256 = new TlsSecretPool(SHA256_SIZE)
    this.secrets384 = new TlsSecretPool(SHA384_SIZE)
    this.view = new TlsServerFlightView()
    this.cookie = []
    this.certificates = []
    this.content = []
    this.signature = []
    this.hashes = new Array<u8>(SHA384_SIZE)
    this.shareGroup = config.shareGroup
    if (
      toI32(clientRandom.length) !== TLS_RANDOM_SIZE ||
      x25519Length !== X25519_SIZE ||
      p256Length !== P256_SCALAR_SIZE ||
      !tlsClientConfigFits(config)
    ) {
      this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
  }

  /** Writes the first ClientHello at the Initial level. Answers 0, or the alert the client failed with; a second call is `internal_error`. */
  start(): i32 {
    if (this.state === TLS_CLIENT_STATE_FAILED) {
      return this.alert
    }
    if (this.state !== TLS_CLIENT_STATE_START) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    const at: i32 = this.outputInitialLength
    const end: i32 = this.writeHello()
    if (end < 0) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    this.firstHello = tlsClientCopy(this.outputInitial, at, end - at)
    this.state = TLS_CLIENT_STATE_WAIT_SERVER_HELLO
    return 0
  }

  /**
   * Writes a ClientHello with a share of `shareGroup` and the cookie, if any,
   * after what the Initial output holds, and answers where it ends; -1 when
   * the key for the share gives no public key.
   */
  writeHello(): i32 {
    const share: u8[] | null =
      this.shareGroup === TLS_GROUP_X25519 ? x25519Base(this.x25519Key) : p256PublicKey(this.p256Key)
    if (share === null) {
      return -1
    }
    const serverName: string = tlsClientIsIpLiteral(this.config.serverName) ? "" : this.config.serverName
    this.sentServerName = toI32(serverName.length) > 0
    const none: u8[] = []
    const at: i32 = this.outputInitialLength
    const length: i32 = tlsWriteClientHello(
      none,
      TLS_CLIENT_FROM,
      this.clientRandom,
      this.sessionId,
      this.config.suites,
      this.config.groups,
      this.shareGroup,
      share,
      serverName,
      this.config.alpn,
      this.cookie
    )
    this.reserveOutput(at + length)
    const end: i32 = tlsWriteClientHello(
      this.outputInitial,
      at,
      this.clientRandom,
      this.sessionId,
      this.config.suites,
      this.config.groups,
      this.shareGroup,
      share,
      serverName,
      this.config.alpn,
      this.cookie
    )
    this.sent(TLS_LEVEL_INITIAL, at, end)
    return end
  }

  /** Fails the handshake with `alert` and answers it, wiping every secret the client holds. */
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

  /** Whether the handshake has derived secret `index` (`TLS_SECRET_*`). */
  known(index: i32): boolean {
    return index >= 0 && index < 31 && (this.held & (1 << index)) !== 0
  }

  /** Whether the secret the client *reads* `level` under — the server's, `serverHandshake` or `serverApplication` — is known yet. */
  readKnown(level: i32): boolean {
    if (level === TLS_LEVEL_HANDSHAKE) {
      return this.known(TLS_SECRET_SERVER_HANDSHAKE)
    }
    return level === TLS_LEVEL_APPLICATION && this.known(TLS_SECRET_SERVER_APPLICATION)
  }

  /** Whether the secret the client *writes* `level` under — `clientHandshake` or `clientApplication` — is known yet. */
  writeKnown(level: i32): boolean {
    if (level === TLS_LEVEL_HANDSHAKE) {
      return this.known(TLS_SECRET_CLIENT_HANDSHAKE)
    }
    return level === TLS_LEVEL_APPLICATION && this.known(TLS_SECRET_CLIENT_APPLICATION)
  }

  /** Zeroes secret `index` of `secrets()` once a carrier has taken what it needs from it; it stays known. */
  wipeSecret(index: i32): void {
    this.secrets().zero(index)
  }

  /** Wipes every secret the client holds: both private keys and both pools. `fail` calls it, and the carriers when a connection ends. */
  wipe(): void {
    wipe(this.x25519Key)
    wipe(this.p256Key)
    this.secrets256.wipe()
    this.secrets384.wipe()
  }

  /** The level the server's next bytes must arrive at, or -1 when the state expects none. */
  expectedLevel(): i32 {
    switch (this.state) {
      case TLS_CLIENT_STATE_WAIT_SERVER_HELLO:
        return TLS_LEVEL_INITIAL
      case TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS:
      case TLS_CLIENT_STATE_WAIT_CERTIFICATE:
      case TLS_CLIENT_STATE_WAIT_CERTIFICATE_VERIFY:
      case TLS_CLIENT_STATE_WAIT_AUTH:
      case TLS_CLIENT_STATE_WAIT_FINISHED:
        return TLS_LEVEL_HANDSHAKE
      case TLS_CLIENT_STATE_CONNECTED:
        return TLS_LEVEL_APPLICATION
      default:
        return -1
    }
  }

  /** Makes `input` hold at least `need` bytes, keeping the ones it holds; it doubles, and never grows past one largest message. */
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

  /** Makes the Initial output hold at least `need` bytes, keeping the ones it holds. */
  reserveOutput(need: i32): void {
    const capacity: i32 = toI32(this.outputInitial.length)
    if (need <= capacity) {
      return
    }
    const grown: u8[] = new Array<u8>(need)
    for (let k: i32 = 0; k < toI32(grown.length) && k < this.outputInitialLength && k < capacity; k++) {
      grown[k] = this.outputInitial[k]
    }
    this.outputInitial = grown
  }

  /**
   * Takes the handshake bytes `data[off .. off + len)` the server sent at
   * `level`, a whole message, part of one or several, and reads every
   * message they complete. Answers 0, or the alert the client fails with.
   *
   * A level other than the one the state expects is `unexpected_message`, as
   * is a byte left over once a message ends the server's flight at its level
   * (a ServerHello, a HelloRetryRequest or a Finished): RFC 8446 §5.1 forbids
   * a message to straddle a key change. A window outside `data` is
   * `internal_error`. At `TLS_CLIENT_STATE_WAIT_AUTH` the bytes are held
   * until `authenticate`. Once connected, the Application level takes
   * NewSessionTickets, which are checked and dropped; anything else there is
   * `unexpected_message`, KeyUpdate being the record layer's.
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
    const most: i32 = TLS_MAX_HANDSHAKE_MESSAGE + 4
    let taken: i32 = 0
    while (taken < len) {
      // A level's bytes may hold several messages, so they are taken a
      // largest message at a time, each read before the next is copied in.
      if (level !== this.expectedLevel()) {
        return this.fail(TLS_ALERT_UNEXPECTED_MESSAGE)
      }
      const room: i32 = most - this.inputLength
      if (room <= 0) {
        return this.fail(TLS_ALERT_DECODE_ERROR)
      }
      const take: i32 = len - taken < room ? len - taken : room
      this.reserveInput(this.inputLength + take)
      for (
        let k: i32 = 0;
        k < take && off + taken + k < toI32(data.length) && this.inputLength < toI32(this.input.length);
        k++
      ) {
        this.input[this.inputLength] = data[off + taken + k]
        this.inputLength = this.inputLength + 1
      }
      taken = taken + take
      const alert: i32 = this.drain()
      if (alert !== 0) {
        return this.fail(alert)
      }
    }
    return 0
  }

  /**
   * Reads every whole message at the front of `input`, dropping each once
   * read, until a partial one is left or the state waits on the caller.
   * Answers 0 or the alert.
   */
  drain(): i32 {
    while (this.state !== TLS_CLIENT_STATE_WAIT_AUTH && this.inputLength >= 4) {
      const length: i32 = (toI32(this.input[1]) << 16) | (toI32(this.input[2]) << 8) | toI32(this.input[3])
      if (length > TLS_MAX_HANDSHAKE_MESSAGE) {
        return TLS_ALERT_DECODE_ERROR
      }
      const whole: i32 = 4 + length
      if (this.inputLength < whole) {
        return 0
      }
      const type: i32 = toI32(this.input[0])
      const alert: i32 = this.handleMessage(type, length)
      if (alert !== 0) {
        return alert
      }
      this.consume(whole)
      const endsFlight: boolean = type === TLS_HANDSHAKE_SERVER_HELLO || type === TLS_HANDSHAKE_FINISHED
      if (endsFlight && this.inputLength > 0) {
        return TLS_ALERT_UNEXPECTED_MESSAGE
      }
    }
    return 0
  }

  /** Drops the first `count` bytes of `input`, moving the rest to its front. */
  consume(count: i32): void {
    const rest: i32 = this.inputLength - count
    for (let k: i32 = 0; k < rest && count + k < toI32(this.input.length); k++) {
      this.input[k] = this.input[count + k]
    }
    this.inputLength = rest
  }

  /** Dispatches one whole message, `input[0 .. 4 + length)`, of type `type`, by state. */
  handleMessage(type: i32, length: i32): i32 {
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
      case TLS_CLIENT_STATE_CONNECTED:
        return type === TLS_HANDSHAKE_NEW_SESSION_TICKET
          ? this.handleTicket(length)
          : TLS_ALERT_UNEXPECTED_MESSAGE
      default:
        return TLS_ALERT_UNEXPECTED_MESSAGE
    }
  }

  /**
   * The checks a ServerHello and a HelloRetryRequest share, in the order
   * that names a TLS 1.2 server for its version: the structure, then
   * `supported_versions` and the downgrade sentinel (§4.1.3), then the
   * extensions, the echoed session id, null compression and an offered
   * suite. Answers 0 or the alert.
   */
  checkHello(view: TlsServerFlightView): i32 {
    if (view.alert !== 0) {
      return view.alert
    }
    if (!view.hasSupportedVersions) {
      return !view.isRetry && tlsServerHelloDowngrade(view)
        ? TLS_ALERT_ILLEGAL_PARAMETER
        : TLS_ALERT_PROTOCOL_VERSION
    }
    if (view.selectedVersion !== TLS_VERSION_13 || view.legacyVersion !== TLS_LEGACY_VERSION) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    if (view.extensionAlert !== 0) {
      return view.extensionAlert
    }
    if (
      view.sessionIdLength !== TLS_CLIENT_SESSION_ID_SIZE ||
      !timingSafeEqualAt(
        view.data,
        view.sessionIdAt,
        this.sessionId,
        TLS_CLIENT_FROM,
        TLS_CLIENT_SESSION_ID_SIZE
      ) ||
      view.compression !== 0
    ) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    if (this.config.suites.indexOf(view.suite) < 0) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    // §4.1.4: the ServerHello after a HelloRetryRequest keeps its suite.
    if (this.retried && view.suite !== this.suite) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    return 0
  }

  /** A ServerHello or HelloRetryRequest, `input[0 .. 4 + length)`. */
  handleServerHello(length: i32): i32 {
    const view: TlsServerFlightView = this.view
    tlsReadServerHello(view, this.input, 4, length)
    if (view.isRetry && this.retried) {
      // §4.1.4: a second HelloRetryRequest.
      return TLS_ALERT_UNEXPECTED_MESSAGE
    }
    const checked: i32 = this.checkHello(view)
    if (checked !== 0) {
      return checked
    }
    if (view.isRetry) {
      return this.handleRetry(length)
    }
    if (!view.hasKeyShare) {
      return TLS_ALERT_MISSING_EXTENSION
    }
    if (view.shareGroup !== this.shareGroup) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    const shareSize: i32 = this.shareGroup === TLS_GROUP_X25519 ? TLS_X25519_SHARE_SIZE : TLS_P256_SHARE_SIZE
    if (view.shareLength !== shareSize) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    if (!this.retried) {
      this.startTranscript(view.suite)
    }
    this.transcript.update(this.input, TLS_CLIENT_FROM, 4 + length)
    const alert: i32 = this.exchangeKeys()
    if (alert !== 0) {
      return alert
    }
    const pool: TlsSecretPool = this.secrets()
    const h: i32 = this.hashLength
    this.transcript.hashInto(this.hashes, TLS_CLIENT_FROM)
    tlsDeriveSecretHeld(h, pool.handshake, "c hs traffic", this.hashes, TLS_CLIENT_FROM, pool.clientHandshake)
    tlsDeriveSecretHeld(h, pool.handshake, "s hs traffic", this.hashes, TLS_CLIENT_FROM, pool.serverHandshake)
    this.held =
      this.held |
      (1 << TLS_SECRET_HANDSHAKE) |
      (1 << TLS_SECRET_CLIENT_HANDSHAKE) |
      (1 << TLS_SECRET_SERVER_HANDSHAKE)
    this.state = TLS_CLIENT_STATE_WAIT_ENCRYPTED_EXTENSIONS
    return 0
  }

  /** Starts the transcript over `suite`'s hash, from the first ClientHello. */
  startTranscript(suite: i32): void {
    this.suite = suite
    this.hashLength = tlsSuiteHashLength(suite)
    this.transcript.reset(this.hashLength)
    this.transcript.update(this.firstHello, TLS_CLIENT_FROM, toI32(this.firstHello.length))
  }

  /**
   * A HelloRetryRequest (§4.1.4), checked by `checkHello` already: it must
   * name a group the client offered and did not send a share for, or carry
   * a cookie, and changes the hello. The transcript restarts from
   * `message_hash` (§4.4.1), and the second ClientHello carries a share of
   * the new group and echoes the cookie. The key of the group not picked is
   * wiped now.
   */
  handleRetry(length: i32): i32 {
    const view: TlsServerFlightView = this.view
    if (!view.hasKeyShare && !view.hasCookie) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    if (
      view.hasKeyShare &&
      (this.config.groups.indexOf(view.shareGroup) < 0 || view.shareGroup === this.shareGroup)
    ) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    this.retried = true
    this.startTranscript(view.suite)
    this.transcript.restartWithMessageHash()
    this.transcript.update(this.input, TLS_CLIENT_FROM, 4 + length)
    if (view.hasCookie) {
      this.cookie = tlsClientCopy(view.data, view.cookieAt, view.cookieLength)
    }
    if (view.hasKeyShare) {
      this.shareGroup = view.shareGroup
    }
    this.wipeUnpicked()
    // The first hello is not needed again; the second goes out after it.
    this.firstHello = []
    if (this.writeHello() < 0) {
      return TLS_ALERT_INTERNAL_ERROR
    }
    return 0
  }

  /** Zeroes both private keys, once the exchange is done or cannot be. */
  wipeKeys(): void {
    exposeWith(this.x25519Key, TLS_CLIENT_FROM, tlsClientZeroHeld)
    exposeWith(this.p256Key, TLS_CLIENT_FROM, tlsClientZeroHeld)
  }

  /** Zeroes the private key of the group the client's share is not of. */
  wipeUnpicked(): void {
    if (this.shareGroup === TLS_GROUP_X25519) {
      exposeWith(this.p256Key, TLS_CLIENT_FROM, tlsClientZeroHeld)
    } else {
      exposeWith(this.x25519Key, TLS_CLIENT_FROM, tlsClientZeroHeld)
    }
  }

  /**
   * The ECDHE exchange with the server's share, `input[view.shareAt ..)`, and
   * the handshake secret from it. Both private keys are wiped on every path,
   * and the shared and early secrets before it returns. An all-zero x25519
   * secret is `illegal_parameter` (RFC 7748 §6.1, RFC 8446 §7.4.2). A
   * secp256r1 share is `internal_error`: `nish/crypto/p256` has no ECDH.
   */
  exchangeKeys(): i32 {
    const view: TlsServerFlightView = this.view
    if (this.shareGroup !== TLS_GROUP_X25519) {
      this.wipeKeys()
      return TLS_ALERT_INTERNAL_ERROR
    }
    const peer: u8[] = tlsClientCopy(view.data, view.shareAt, view.shareLength)
    const shared: Secret<u8[]> | null = x25519(this.x25519Key, peer)
    this.wipeKeys()
    if (shared === null) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    if (expose(shared, tlsClientIsZeroSecret)) {
      wipe(shared)
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    const h: i32 = this.hashLength
    const early: Secret<u8[]> = tlsEarlySecret(h)
    tlsHandshakeSecretHeld(h, early, shared, this.secrets().handshake)
    wipe(early)
    wipe(shared)
    return 0
  }

  /** EncryptedExtensions (§4.3.1): ALPN, if any, must be one the client offered, and `server_name` acknowledged only if sent. */
  handleEncryptedExtensions(length: i32): i32 {
    const view: TlsServerFlightView = this.view
    tlsReadEncryptedExtensions(view, this.input, 4, length)
    if (view.alert !== 0) {
      return view.alert
    }
    if (view.extensionAlert !== 0) {
      return view.extensionAlert
    }
    if (view.serverNameAcknowledged && !this.sentServerName) {
      return TLS_ALERT_UNSUPPORTED_EXTENSION
    }
    if (view.hasAlpn) {
      const chosen: string = tlsWindowString(view.data, view.alpnAt, view.alpnLength)
      if (this.config.alpn.indexOf(chosen) < 0) {
        // RFC 7301 §3.2 leaves the alert open; a protocol never offered is
        // a value the client cannot accept.
        return TLS_ALERT_ILLEGAL_PARAMETER
      }
      this.alpnChosen = chosen
    }
    this.transcript.update(this.input, TLS_CLIENT_FROM, 4 + length)
    this.state = TLS_CLIENT_STATE_WAIT_CERTIFICATE
    return 0
  }

  /** The server's Certificate (§4.4.2): its request context must be empty. The chain is copied out, and what CertificateVerify signs computed. */
  handleCertificate(length: i32): i32 {
    const view: TlsServerFlightView = this.view
    tlsReadCertificate(view, this.input, 4, length)
    if (view.alert !== 0) {
      return view.alert
    }
    if (view.extensionAlert !== 0) {
      return view.extensionAlert
    }
    if (view.contextLength !== 0) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    this.certificates = tlsCopyCertificates(view)
    this.transcript.update(this.input, TLS_CLIENT_FROM, 4 + length)
    this.content = tlsCertificateVerifyContent(this.transcript.hash())
    this.state = TLS_CLIENT_STATE_WAIT_CERTIFICATE_VERIFY
    return 0
  }

  /** CertificateVerify (§4.4.3): a scheme the client offered. The signature is kept, unchecked, for the caller; the client then waits on it. */
  handleCertificateVerify(length: i32): i32 {
    const view: TlsServerFlightView = this.view
    tlsReadCertificateVerify(view, this.input, 4, length)
    if (view.alert !== 0) {
      return view.alert
    }
    if (!tlsClientOffersScheme(view.scheme)) {
      return TLS_ALERT_ILLEGAL_PARAMETER
    }
    this.scheme = view.scheme
    this.signature = tlsClientCopy(view.data, view.signatureAt, view.signatureLength)
    this.transcript.update(this.input, TLS_CLIENT_FROM, 4 + length)
    this.state = TLS_CLIENT_STATE_WAIT_AUTH
    return 0
  }

  /**
   * The server's Finished (§4.4.4), checked in constant time against the one
   * its handshake secret gives (`decrypt_error` if it differs). Then the
   * master secret, the application and exporter secrets, and the client's
   * Finished at the Handshake level; the handshake secret is wiped.
   */
  handleFinished(length: i32): i32 {
    const h: i32 = this.hashLength
    if (length !== h) {
      return TLS_ALERT_DECODE_ERROR
    }
    const pool: TlsSecretPool = this.secrets()
    this.transcript.hashInto(this.hashes, TLS_CLIENT_FROM)
    const expected: u8[] = tlsFinishedVerifyDataHeld(h, pool.serverHandshake, this.hashes, TLS_CLIENT_FROM)
    const matches: boolean = timingSafeEqualAt(this.input, 4, expected, TLS_CLIENT_FROM, h)
    secureZero(expected)
    if (!matches) {
      return TLS_ALERT_DECRYPT_ERROR
    }
    this.transcript.update(this.input, TLS_CLIENT_FROM, 4 + length)
    this.transcript.hashInto(this.hashes, TLS_CLIENT_FROM)
    // The master secret is derived over the handshake secret, which has no
    // other use left.
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
    const at: i32 = this.outputHandshakeLength
    const end: i32 = tlsWriteFinished(this.outputHandshake, at, verifyData, TLS_CLIENT_FROM, h)
    secureZero(verifyData)
    this.sent(TLS_LEVEL_HANDSHAKE, at, end)
    this.held =
      (this.held |
        (1 << TLS_SECRET_CLIENT_APPLICATION) |
        (1 << TLS_SECRET_SERVER_APPLICATION) |
        (1 << TLS_SECRET_EXPORTER)) &
      ~(1 << TLS_SECRET_HANDSHAKE)
    this.state = TLS_CLIENT_STATE_CONNECTED
    return 0
  }

  /** A NewSessionTicket (§4.6.1) once connected: checked for its structure and dropped, since this client does not resume. */
  handleTicket(length: i32): i32 {
    tlsReadNewSessionTicket(this.view, this.input, 4, length)
    return this.view.alert
  }

  /** The server's DER certificates, leaf first; empty before its Certificate is read. */
  peerCertificates(): u8[][] {
    return this.certificates
  }

  /** The CertificateVerify scheme (`TLS_SIGNATURE_*`); 0 before it is read. */
  verifyScheme(): i32 {
    return this.scheme
  }

  /** What the CertificateVerify signature is over (§4.4.3): 64 spaces, the server's context string, a zero byte and the transcript hash. */
  verifyContent(): u8[] {
    return this.content
  }

  /** The CertificateVerify signature as sent: DER for ECDSA, raw for RSA-PSS. */
  verifySignature(): u8[] {
    return this.signature
  }

  /** The ALPN protocol the server chose, or empty when it chose none. */
  alpn(): string {
    return this.alpnChosen
  }

  /**
   * The caller's verdict on the server's chain and signature, at
   * `TLS_CLIENT_STATE_WAIT_AUTH`: `true` goes on to the server's Finished,
   * reading what was held meanwhile; `false` is `reject(bad_certificate)`.
   * Answers 0 or the alert; in any other state, `internal_error`.
   */
  authenticate(ok: boolean): i32 {
    if (!ok) {
      return this.reject(TLS_ALERT_BAD_CERTIFICATE)
    }
    if (this.state === TLS_CLIENT_STATE_FAILED) {
      return this.alert
    }
    if (this.state !== TLS_CLIENT_STATE_WAIT_AUTH) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    this.state = TLS_CLIENT_STATE_WAIT_FINISHED
    const alert: i32 = this.drain()
    if (alert !== 0) {
      return this.fail(alert)
    }
    return 0
  }

  /**
   * Refuses the server at `TLS_CLIENT_STATE_WAIT_AUTH` with `alert`, the
   * caller's reason (`bad_certificate`, `certificate_expired`,
   * `unknown_ca`, `decrypt_error`…): the client fails with it and answers it.
   * An alert outside 1 to 255 is taken as `bad_certificate`. In any other
   * state, `internal_error`.
   */
  reject(alert: i32): i32 {
    if (this.state === TLS_CLIENT_STATE_FAILED) {
      return this.alert
    }
    if (this.state !== TLS_CLIENT_STATE_WAIT_AUTH) {
      return this.fail(TLS_ALERT_INTERNAL_ERROR)
    }
    return this.fail(alert >= 1 && alert <= 255 ? alert : TLS_ALERT_BAD_CERTIFICATE)
  }

  /** A message the client wrote at `level`, `output[at .. end)`, goes into the transcript once its hash is known and stays on the output. */
  sent(level: i32, at: i32, end: i32): void {
    if (level === TLS_LEVEL_INITIAL) {
      if (this.hashLength !== 0) {
        this.transcript.update(this.outputInitial, at, end - at)
      }
      this.outputInitialLength = end
    } else {
      this.transcript.update(this.outputHandshake, at, end - at)
      this.outputHandshakeLength = end
    }
  }

  /** The handshake bytes written at `level` since the last call, in a fresh array, and forgets them. */
  takeOutput(level: i32): u8[] {
    const none: u8[] = []
    switch (level) {
      case TLS_LEVEL_INITIAL: {
        const out: u8[] = tlsClientCopy(this.outputInitial, TLS_CLIENT_FROM, this.outputInitialLength)
        this.outputInitialLength = 0
        return out
      }
      case TLS_LEVEL_HANDSHAKE: {
        const out: u8[] = tlsClientCopy(this.outputHandshake, TLS_CLIENT_FROM, this.outputHandshakeLength)
        this.outputHandshakeLength = 0
        return out
      }
      default:
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
}
