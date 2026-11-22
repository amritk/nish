/**
 * `nish/net/tls/codec` — the TLS 1.3 handshake messages a server and a
 * client read and write (RFC 8446 §4), as bytes.
 *
 *     import {
 *       TLS_VERSION_13, TlsClientHelloView, tlsCopyWindow, tlsEncodeServerHello,
 *       tlsReadClientHello, tlsWindowHasU16
 *     } from "nish/net/tls/codec";
 *
 *     // `body` is a ClientHello without its four-byte handshake header;
 *     // `random`, `suite` and `serverShare` are the server's own.
 *     const hello = new TlsClientHelloView()
 *     tlsReadClientHello(hello, body, 0, toI32(body.length))
 *     if (hello.alert !== 0) {
 *       // send hello.alert, such as TLS_ALERT_DECODE_ERROR (50), and close
 *     } else if (tlsWindowHasU16(hello.data, hello.versionsAt, hello.versionsLength, TLS_VERSION_13)) {
 *       const sessionId: u8[] = tlsCopyWindow(hello.data, hello.sessionIdAt, hello.sessionIdLength)
 *       const reply: u8[] = tlsEncodeServerHello(random, sessionId, suite, serverShare)
 *     }
 *
 * **One reader and eight writers.** `tlsParseClientHello` reads a ClientHello
 * body into a `TlsClientHello`, checking its structure: every length against
 * the bytes it claims, every vector against its RFC 8446 bounds, and no
 * extension twice (§4.2). A message that breaks one answers the alert a server
 * sends for it in the hello's `alert` field (`decode_error` for a malformed or
 * truncated one, `illegal_parameter` for a duplicate), never a panic, since
 * every byte of it is the peer's. What the fields *mean* — which version,
 * which suite, whether a share is missing — is the server's to decide, in
 * `nish/net/tls`.
 *
 * **Reading without copying.** `tlsReadClientHello` is the same reader for a
 * server that keeps its state in a slot: it reads into a `TlsClientHelloView`
 * made once, whose fields are windows into the message rather than copies of
 * it, so a ClientHello read allocates nothing, and `tlsParseClientHello`
 * copies a view's windows out.
 *
 * **The writers trust their inputs.** Each answers one whole handshake
 * message, header included: ServerHello, a resumed ServerHello that names the
 * PSK it accepts, HelloRetryRequest, EncryptedExtensions, Certificate,
 * CertificateVerify, Finished and NewSessionTicket. Their inputs come from the
 * server and the caller's configuration rather than from the peer, so they
 * check nothing. Each is a `tlsWrite*` function that writes into the caller's
 * array at an offset — run over an empty array, it measures — and a
 * `tlsEncode*` one that answers the message in a fresh array.
 *
 * **The client's side is the mirror**: `tlsWriteClientHello` and
 * `tlsEncodeClientHello` write the hello `nish/net/tls/client` sends, and five
 * readers — `tlsReadServerHello` (a HelloRetryRequest too),
 * `tlsReadEncryptedExtensions`, `tlsReadCertificate`,
 * `tlsReadCertificateVerify` and `tlsReadNewSessionTicket` — read the
 * server's flight into a `TlsServerFlightView` made once, as windows, with
 * the same checks and the same alerts in its `alert` field. A server's bytes
 * are the peer's just as a client's are, so these readers never panic either
 * (the `tls-server-flight` fuzz target).
 *
 * **Extensions.** The ones read are `server_name` (RFC 6066 §3),
 * `supported_groups`, `signature_algorithms`, `supported_versions` and
 * `key_share` (RFC 8446 §4.2), `application_layer_protocol_negotiation`
 * (RFC 7301 §3.1), `quic_transport_parameters` (RFC 9001 §8.2) and
 * `record_size_limit` (RFC 8449 §4), and `pre_shared_key` and
 * `psk_key_exchange_modes` (RFC 8446 §4.2.11, §4.2.9),
 * whose identities and binders the reader checks against their syntax but
 * does not open: a ticket and its binder are the server's to judge. Every
 * other extension is skipped, which is what RFC 8446 §4.2 asks of a server
 * that does not know it.
 *
 * Written from the RFCs, not ported from another implementation. Private
 * names carry the `tls` prefix because a `std/` module's private functions
 * share the importing program's flat symbol namespace (`docs/wp26-stdlib.md`
 * §3e).
 */

// ---- Handshake message types (RFC 8446 §4) --------------------------------

/**
 * `client_hello` (§4.1.2): the first message of a handshake, and the client's second after a
 * HelloRetryRequest.
 */
export const TLS_HANDSHAKE_CLIENT_HELLO: i32 = 1
/** `server_hello` (§4.1.3), which a HelloRetryRequest shares, told apart by its `random`. */
export const TLS_HANDSHAKE_SERVER_HELLO: i32 = 2
/** `new_session_ticket` (§4.6.1): a ticket the server sends after the handshake, for resumption. */
export const TLS_HANDSHAKE_NEW_SESSION_TICKET: i32 = 4
/** `encrypted_extensions` (§4.3.1): the server's extensions that do not belong in its ServerHello. */
export const TLS_HANDSHAKE_ENCRYPTED_EXTENSIONS: i32 = 8
/** `certificate` (§4.4.2): the server's chain, leaf first. */
export const TLS_HANDSHAKE_CERTIFICATE: i32 = 11
/** `certificate_verify` (§4.4.3): a signature over the transcript under the leaf's key. */
export const TLS_HANDSHAKE_CERTIFICATE_VERIFY: i32 = 15
/** `finished` (§4.4.4): the MAC over the transcript that closes a side's flight. */
export const TLS_HANDSHAKE_FINISHED: i32 = 20
/** The synthetic message a HelloRetryRequest puts in the transcript in place of the first ClientHello (§4.4.1). */
export const TLS_HANDSHAKE_MESSAGE_HASH: i32 = 254

// ---- Extension types (RFC 8446 §4.2, RFC 7301, RFC 9001) ------------------

/** `server_name` (RFC 6066 §3): the host name the client asks for, or the server's empty acknowledgement. */
export const TLS_EXT_SERVER_NAME: i32 = 0
/** `pre_shared_key` (§4.2.11): the client's identities and binders, which must be the last extension. */
export const TLS_EXT_PRE_SHARED_KEY: i32 = 41
/** `early_data` (§4.2.10): read past here, since the server takes no 0-RTT data. */
export const TLS_EXT_EARLY_DATA: i32 = 42
/** `psk_key_exchange_modes` (§4.2.9): which modes the client will resume in. */
export const TLS_EXT_PSK_KEY_EXCHANGE_MODES: i32 = 45
/** `supported_groups` (§4.2.7): the key-exchange groups the client offers. */
export const TLS_EXT_SUPPORTED_GROUPS: i32 = 10
/** `signature_algorithms` (§4.2.3): the schemes a CertificateVerify may be signed with. */
export const TLS_EXT_SIGNATURE_ALGORITHMS: i32 = 13
/** `application_layer_protocol_negotiation` (RFC 7301 §3.1): the protocols offered, or the one chosen. */
export const TLS_EXT_ALPN: i32 = 16
/** `supported_versions` (§4.2.1): where TLS 1.3 is offered and chosen, since `legacy_version` stays 1.2. */
export const TLS_EXT_SUPPORTED_VERSIONS: i32 = 43
/** `key_share` (§4.2.8): the (EC)DHE shares, or a HelloRetryRequest's `selected_group`. */
export const TLS_EXT_KEY_SHARE: i32 = 51
/** `quic_transport_parameters` (RFC 9001 §8.2): QUIC's own parameters, opaque to TLS. */
export const TLS_EXT_QUIC_TRANSPORT_PARAMETERS: i32 = 57
/** `record_size_limit` (RFC 8449 §4): the largest protected record plaintext the sender will take, content type included. */
export const TLS_EXT_RECORD_SIZE_LIMIT: i32 = 28
/** The smallest `record_size_limit` a peer may send (RFC 8449 §4); below it is `illegal_parameter`. */
export const TLS_RECORD_SIZE_LIMIT_MIN: i32 = 64
/**
 * The largest `record_size_limit` TLS 1.3 can use (RFC 8449 §4): 2^14 bytes
 * of content and the content-type byte. A larger value means this.
 */
export const TLS_RECORD_SIZE_LIMIT_MAX: i32 = 16385
/** `cookie` (§4.2.2): what a HelloRetryRequest may carry and the client's second ClientHello echoes. */
export const TLS_EXT_COOKIE: i32 = 44

// ---- Versions, groups and signature schemes -------------------------------

/** `legacy_version` in every TLS 1.3 hello (§4.1.2). */
export const TLS_LEGACY_VERSION: i32 = 0x0303
/** TLS 1.3 in `supported_versions` (§4.2.1). */
export const TLS_VERSION_13: i32 = 0x0304
/** x25519 (§4.2.7), the group `nish/net/tls` prefers. */
export const TLS_GROUP_X25519: i32 = 0x001d
/** The length of an x25519 key share (RFC 8446 §4.2.8.2). */
export const TLS_X25519_SHARE_SIZE: i32 = 32
/** `ecdsa_secp256r1_sha256` (§4.2.3), what a production server signs with. */
export const TLS_SIGNATURE_ECDSA_SECP256R1_SHA256: i32 = 0x0403
/** `rsa_pss_rsae_sha256` (§4.2.3), what RFC 8448's server signs with. */
export const TLS_SIGNATURE_RSA_PSS_RSAE_SHA256: i32 = 0x0804
/** `ecdsa_secp384r1_sha384` (§4.2.3), offered by the client. */
export const TLS_SIGNATURE_ECDSA_SECP384R1_SHA384: i32 = 0x0503
/** `rsa_pss_rsae_sha384` (§4.2.3), offered by the client. */
export const TLS_SIGNATURE_RSA_PSS_RSAE_SHA384: i32 = 0x0805
/** `rsa_pss_rsae_sha512` (§4.2.3), offered by the client. */
export const TLS_SIGNATURE_RSA_PSS_RSAE_SHA512: i32 = 0x0806
/** secp256r1 (§4.2.7), the second group the client offers and the server agrees to. */
export const TLS_GROUP_SECP256R1: i32 = 0x0017
/** The length of a secp256r1 key share: an uncompressed point, 0x04 then X and Y (§4.2.8.2). */
export const TLS_P256_SHARE_SIZE: i32 = 65

// ---- Alert descriptions (RFC 8446 §6) --------------------------------------

/** A message arrived that the handshake's state does not allow. */
export const TLS_ALERT_UNEXPECTED_MESSAGE: i32 = 10
/** No acceptable set of parameters: no common suite, group or signature scheme. */
export const TLS_ALERT_HANDSHAKE_FAILURE: i32 = 40
/** The client's verdict on a server certificate it does not accept, which `TlsClient.authenticate(false)` sends by default. */
export const TLS_ALERT_BAD_CERTIFICATE: i32 = 42
/** A field well formed but wrong: a duplicate, a bad share, a second retry without the share. */
export const TLS_ALERT_ILLEGAL_PARAMETER: i32 = 47
/** A message that does not parse: a length past its bytes, a vector out of its bounds, trailing bytes. */
export const TLS_ALERT_DECODE_ERROR: i32 = 50
/** A Finished that does not verify. */
export const TLS_ALERT_DECRYPT_ERROR: i32 = 51
/** A peer that does not offer TLS 1.3. */
export const TLS_ALERT_PROTOCOL_VERSION: i32 = 70
/** A failure of this side's own: a bad configuration, randomness or signature, or a call out of order. */
export const TLS_ALERT_INTERNAL_ERROR: i32 = 80
/** An extension the handshake needs is absent (§9.2, RFC 9001 §8.2). */
export const TLS_ALERT_MISSING_EXTENSION: i32 = 109
/** ALPN offered no protocol the server accepts (RFC 7301 §3.2, RFC 9001 §8.1). */
export const TLS_ALERT_NO_APPLICATION_PROTOCOL: i32 = 120
/** An extension in a server message that the client never offered (§4.2). */
export const TLS_ALERT_UNSUPPORTED_EXTENSION: i32 = 110

/** `psk_ke` (§4.2.9): resumption from the PSK alone, without forward secrecy, which the server never selects. */
export const TLS_PSK_KE: i32 = 0
/** `psk_dhe_ke` (§4.2.9): resumption with an (EC)DHE exchange, the one mode the server resumes in. */
export const TLS_PSK_DHE_KE: i32 = 1

/** The size of a hello's `random` (§4.1.2). */
export const TLS_RANDOM_SIZE: i32 = 32

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_CODEC_FROM: i32 = 0

/**
 * A cursor over `data[at .. end)` for the `tlsRead*` functions below, which
 * read big-endian integers and the length prefixes of TLS vectors (RFC 8446
 * §3.4). They are functions rather than methods so that a literal argument
 * takes its parameter's `i32` under `--number-mode f64`.
 *
 * A read past `end`, or a vector whose length breaks its bounds, sets
 * `failed` and answers 0, and every later read then fails too. So a parser
 * can read a whole structure and test `failed` once, and a truncated message
 * cannot read a byte that is not its own: `end` never passes the window the
 * reader was opened on.
 */
class TlsReader {
  /** @internal Read by the free functions of this module. */
  data: u8[]
  /** @internal Read by the free functions of this module. */
  at: i32
  /** @internal Read by the free functions of this module. */
  end: i32
  /** @internal Read by the free functions of this module. */
  failed: boolean = false

  constructor(data: u8[], at: i32, end: i32) {
    this.data = data
    this.at = at
    this.end = end
  }
}

/** The next byte, or 0 and a failed reader at the end of the window. */
const tlsReadU8 = (r: TlsReader): i32 => {
  const at: i32 = r.at
  if (r.failed || at < 0 || at >= r.end || at >= toI32(r.data.length)) {
    r.failed = true
    return 0
  }
  r.at = at + 1
  return toI32(r.data[at])
}

/** The next two bytes, big-endian. */
const tlsReadU16 = (r: TlsReader): i32 => {
  const hi: i32 = tlsReadU8(r)
  return (hi << 8) | tlsReadU8(r)
}

/**
 * Reads a `width`-byte length (1, 2 or 3) and answers where the vector it
 * opens ends. A length below `min`, above `max` or past `end` fails, and
 * answers the current position so that the vector reads as empty.
 */
const tlsReadVector = (r: TlsReader, width: i32, min: i32, max: i32): i32 => {
  let n: i32 = 0
  for (let k: i32 = 0; k < width; k++) {
    n = (n << 8) | tlsReadU8(r)
  }
  const at: i32 = r.at
  const end: i32 = r.end
  // A width of at most 3 bytes reads at most 2^24 - 1, and a position is
  // never past `data.length`: the bounds refuse only a reader no caller opens.
  if (
    r.failed ||
    n < min ||
    n > max ||
    n < 0 ||
    n > 16777215 ||
    at < 0 ||
    at > 1073741823 ||
    end < 0 ||
    end < at ||
    n > end - at
  ) {
    r.failed = true
    return at
  }
  return at + n
}

/**
 * Narrows the reader to a list that ends at `listEnd`, which a vector read just
 * opened, and answers the end to restore (`r.end = outer`) once its entries
 * are read. Every entry of a TLS list must lie inside the list's declared
 * length, not merely inside the message or the extension around it, so an
 * entry whose own length runs past the list fails the reader.
 */
const tlsReadList = (r: TlsReader, listEnd: i32): i32 => {
  const outer: i32 = r.end
  r.end = listEnd
  return outer
}

/**
 * How many bytes lie from the reader's position to `to`, an end a vector
 * read of this reader answered. A `to` before the position, which no such
 * end is, fails the reader and answers 0.
 */
const tlsReadSpan = (r: TlsReader, to: i32): i32 => {
  const at: i32 = r.at
  if (at < 0 || to < 0 || to < at) {
    r.failed = true
    return 0
  }
  return to - at
}

/**
 * The reader's position plus `n`, unchecked against the window, which
 * `tlsReadSkipTo` and the vector reads check. A position past 2^30 - 1,
 * which no buffer this module reads reaches, fails the reader and answers
 * the position.
 */
const tlsReadAhead = (r: TlsReader, n: i32): i32 => {
  const at: i32 = r.at
  if (at < 0 || at > 1073741823 || n < 0 || n > 1073741823) {
    r.failed = true
    return at
  }
  return at + n
}

/**
 * The length of the window `from .. to` a 16-bit vector read opened at
 * `from` and answered `to` for: 0 when the read failed and left `to` before
 * `from`, which the failed reader reports.
 */
const tlsWindowLength = (from: i32, to: i32): i32 => (from < 0 || to < 0 || to < from ? 0 : to - from)

/** Moves to `to`, the end of a vector this reader opened. */
const tlsReadSkipTo = (r: TlsReader, to: i32): void => {
  if (to < r.at || to > r.end) {
    r.failed = true
    return
  }
  r.at = to
}

/**
 * A ClientHello as `tlsReadClientHello` read it, without a byte copied: every
 * field the server needs is a window `(…At, …Length)` into `data`, the buffer
 * the hello was read from, and the rest are numbers and flags. A field whose
 * extension was absent keeps an empty window, and its `has*` flag says so,
 * since an empty list and a missing extension mean different things to the
 * server (§9.2). Make one per connection and read every hello into it: it
 * allocates nothing after its constructor, so a handshake that keeps its state
 * in a slot reads its ClientHellos without moving the arena.
 */
export class TlsClientHelloView {
  /**
   * The buffer the windows point into: the one the last hello was read from.
   *
   * @internal Read by `net/tls.ts`.
   */
  data: u8[]
  /**
   * One bit per extension type read, for the duplicate check (§4.2); cleared by each read.
   *
   * @internal Read by the free functions of this module.
   */
  extensionSeen: u32[]
  /**
   * One bit per group a share was offered for, for the duplicate check (§4.2.8).
   *
   * @internal Read by the free functions of this module.
   */
  shareSeen: u32[]
  /**
   * The reader each read runs, kept so that a read allocates none.
   *
   * @internal Read by the free functions of this module.
   */
  reader: TlsReader
  /** 0 when the message parsed, or the alert it earns: `decode_error` or `illegal_parameter`. */
  alert: i32 = 0
  /** `legacy_version` as sent; TLS 1.3 fixes it at 0x0303 and negotiates the real version in `supported_versions` (§4.1.2). */
  legacyVersion: i32 = 0
  /** Where the client's 32-byte `random` starts in `data`; its length is always 32. */
  randomAt: i32 = 0
  /** `legacy_session_id`, which a server echoes (§4.1.3). */
  sessionIdAt: i32 = 0
  /** The `legacy_session_id`'s length in bytes, 0 to 32. */
  sessionIdLength: i32 = 0
  /** `cipher_suites`, 16-bit values in the client's order. */
  suitesAt: i32 = 0
  /** The `cipher_suites` window's length in bytes, two a suite. */
  suitesLength: i32 = 0
  /** `supported_versions`, 16-bit values. */
  versionsAt: i32 = 0
  /** The `supported_versions` window's length in bytes, two a version; 0 when the extension was absent. */
  versionsLength: i32 = 0
  /** `supported_groups`, 16-bit values. */
  groupsAt: i32 = 0
  /** The `supported_groups` window's length in bytes, two a group; 0 when the extension was absent. */
  groupsLength: i32 = 0
  /** `signature_algorithms`, 16-bit values. */
  schemesAt: i32 = 0
  /** The `signature_algorithms` window's length in bytes, two a scheme; 0 when the extension was absent. */
  schemesLength: i32 = 0
  /** The `client_shares` list of `key_share`, every entry in it. */
  sharesAt: i32 = 0
  /** The `client_shares` window's length in bytes; 0 when `key_share` was absent. */
  sharesLength: i32 = 0
  /** The x25519 share's key_exchange, as sent; its length is the server's to check. */
  x25519ShareAt: i32 = 0
  /** The x25519 share's length in bytes as sent, 0 when none was offered; a usable share is 32. */
  x25519ShareLength: i32 = 0
  /** The secp256r1 share's key_exchange, as sent; its length is the server's to check. */
  p256ShareAt: i32 = 0
  /** The secp256r1 share's length in bytes as sent, 0 when none was offered; a usable share is 65. */
  p256ShareLength: i32 = 0
  /** The `host_name` of `server_name`, or empty. */
  serverNameAt: i32 = 0
  /** The `host_name`'s length in bytes, 0 when `server_name` was absent. */
  serverNameLength: i32 = 0
  /** ALPN's `protocol_name_list`, each name a length byte and its bytes (RFC 7301 §3.1). */
  alpnAt: i32 = 0
  /** The ALPN list's length in bytes, its length bytes included; 0 when ALPN was absent. */
  alpnLength: i32 = 0
  /** The client's `quic_transport_parameters`, opaque (RFC 9001 §8.2). */
  quicAt: i32 = 0
  /** The QUIC transport parameters' length in bytes, 0 when the extension was absent. */
  quicLength: i32 = 0
  /** The extensions block, every extension in it. */
  extensionsAt: i32 = 0
  /** The extensions block's length in bytes, 0 for a hello with none. */
  extensionsLength: i32 = 0
  /** `pre_shared_key`'s `identities` list (§4.2.11): each an identity<1..2^16-1> and a 32-bit obfuscated age. */
  pskIdentitiesAt: i32 = 0
  /** The `identities` window's length in bytes, 0 when `pre_shared_key` was absent. */
  pskIdentitiesLength: i32 = 0
  /** How many identities `identities` holds; the binder count must match it (§4.2.11). */
  pskIdentityCount: i32 = 0
  /**
   * Where `binders`' two-byte length starts: the ClientHello up to here, its
   * handshake header included, is what each binder is computed over
   * (§4.2.11.2).
   */
  pskBindersPrefixAt: i32 = 0
  /** `pre_shared_key`'s `binders` list: each a PskBinderEntry<32..255>. */
  pskBindersAt: i32 = 0
  /** The `binders` window's length in bytes, 0 when `pre_shared_key` was absent. */
  pskBindersLength: i32 = 0
  /** How many binders `binders` holds, one an identity. */
  pskBinderCount: i32 = 0
  /** `psk_key_exchange_modes`' `ke_modes`, one byte a mode (§4.2.9). */
  pskModesAt: i32 = 0
  /** The `ke_modes` window's length in bytes, one a mode; 0 when the extension was absent. */
  pskModesLength: i32 = 0
  /** The identity `tlsSelectPskIdentity` last chose: its bytes and its obfuscated ticket age. */
  pskIdentityAt: i32 = 0
  /** The chosen identity's length in bytes, 0 until `tlsSelectPskIdentity` chooses one. */
  pskIdentityLength: i32 = 0
  /** The chosen identity's `obfuscated_ticket_age`, as sent: the ticket's age in milliseconds plus its `ticket_age_add`, modulo 2^32 (§4.2.11.1). */
  pskTicketAge: u32 = 0
  /** That identity's binder, the entry of the same index in `binders`. */
  pskBinderAt: i32 = 0
  /**
   * The chosen binder's length in bytes, 32 to 255: `tlsReadPreSharedKey` refuses a shorter one
   * when it parses the extension. It must equal the suite's hash length.
   */
  pskBinderLength: i32 = 0
  /** Whether `ke_modes` lists `psk_dhe_ke`, the one mode the server resumes in. */
  pskDheKe: boolean = false
  /** Whether `legacy_compression_methods` is the single null method TLS 1.3 requires (§4.1.2). */
  nullCompressionOnly: boolean = false
  /** Whether the hello carried `supported_versions`: without it the client does not offer TLS 1.3 (§4.2.1). */
  hasSupportedVersions: boolean = false
  /** Whether the hello carried `supported_groups`. */
  hasSupportedGroups: boolean = false
  /** Whether the hello carried `key_share`, even an empty one. */
  hasKeyShare: boolean = false
  /** Whether `key_share` offered an x25519 share, so `x25519ShareAt` names one. */
  hasX25519Share: boolean = false
  /** Whether `key_share` offered a secp256r1 share, so `p256ShareAt` names one. */
  hasP256Share: boolean = false
  /** Whether the hello carried `signature_algorithms`. */
  hasSignatureAlgorithms: boolean = false
  /** Whether the hello carried `server_name` with a `host_name` in it. */
  hasServerName: boolean = false
  /** Whether the hello carried ALPN. */
  hasAlpn: boolean = false
  /** Whether the hello carried `quic_transport_parameters`, which a QUIC handshake requires (RFC 9001 §8.2). */
  hasQuicTransportParameters: boolean = false
  /** Whether the hello carried `record_size_limit` (RFC 8449). */
  hasRecordSizeLimit: boolean = false
  /**
   * The client's `record_size_limit`, at least `TLS_RECORD_SIZE_LIMIT_MIN`
   * and at most `TLS_RECORD_SIZE_LIMIT_MAX`, a larger value lowered to it;
   * 0 when the hello carried none.
   */
  recordSizeLimit: i32 = 0
  /** Whether the hello carried `pre_shared_key`, which must be its last extension (§4.2.11). */
  hasPreSharedKey: boolean = false
  /** Whether the hello carried `psk_key_exchange_modes`, without which a server must not resume (§4.2.9). */
  hasPskModes: boolean = false

  /**
   * Makes an empty view, every window empty and every flag false, for
   * `tlsReadClientHello` to fill.
   */
  constructor() {
    this.data = []
    this.extensionSeen = new Array<u32>(TLS_U16_BITMAP_WORDS)
    this.shareSeen = new Array<u32>(TLS_U16_BITMAP_WORDS)
    this.reader = new TlsReader(this.data, TLS_CODEC_FROM, TLS_CODEC_FROM)
  }

  /**
   * Forgets the last hello: every window empty, every flag down, both bitmaps clear.
   *
   * @internal Read by the free functions of this module.
   */
  clear(): void {
    this.alert = 0
    this.legacyVersion = 0
    this.randomAt = 0
    this.sessionIdAt = 0
    this.sessionIdLength = 0
    this.suitesAt = 0
    this.suitesLength = 0
    this.versionsAt = 0
    this.versionsLength = 0
    this.groupsAt = 0
    this.groupsLength = 0
    this.schemesAt = 0
    this.schemesLength = 0
    this.sharesAt = 0
    this.sharesLength = 0
    this.x25519ShareAt = 0
    this.x25519ShareLength = 0
    this.p256ShareAt = 0
    this.p256ShareLength = 0
    this.serverNameAt = 0
    this.serverNameLength = 0
    this.alpnAt = 0
    this.alpnLength = 0
    this.quicAt = 0
    this.quicLength = 0
    this.extensionsAt = 0
    this.extensionsLength = 0
    this.pskIdentitiesAt = 0
    this.pskIdentitiesLength = 0
    this.pskIdentityCount = 0
    this.pskBindersPrefixAt = 0
    this.pskBindersAt = 0
    this.pskBindersLength = 0
    this.pskBinderCount = 0
    this.pskModesAt = 0
    this.pskModesLength = 0
    this.pskDheKe = false
    this.pskIdentityAt = 0
    this.pskIdentityLength = 0
    this.pskTicketAge = toU32(0)
    this.pskBinderAt = 0
    this.pskBinderLength = 0
    this.nullCompressionOnly = false
    this.hasSupportedVersions = false
    this.hasSupportedGroups = false
    this.hasKeyShare = false
    this.hasX25519Share = false
    this.hasP256Share = false
    this.hasSignatureAlgorithms = false
    this.hasServerName = false
    this.hasAlpn = false
    this.hasQuicTransportParameters = false
    this.hasRecordSizeLimit = false
    this.recordSizeLimit = 0
    this.hasPreSharedKey = false
    this.hasPskModes = false
    for (let k: i32 = 0; k < toI32(this.extensionSeen.length); k++) {
      this.extensionSeen[k] = toU32(0)
    }
    for (let k: i32 = 0; k < toI32(this.shareSeen.length); k++) {
      this.shareSeen[k] = toU32(0)
    }
  }
}

/** Enough 32-bit words for one bit per 16-bit value. */
const TLS_U16_BITMAP_WORDS: i32 = 2048

/** Sets `value`'s bit in `bits` and answers whether it was already set: the duplicate checks of §4.2 and §4.2.8. */
const tlsMarkSeen = (bits: u32[], value: i32): boolean => {
  const word: i32 = (value >> 5) & (TLS_U16_BITMAP_WORDS - 1)
  const bit: u32 = toU32(1) << toU32(value & 31)
  if (word < 0 || word >= toI32(bits.length)) {
    return false
  }
  const seen: boolean = (bits[word] & bit) !== toU32(0)
  bits[word] = bits[word] | bit
  return seen
}

/** Records `alert` on `hello` unless an earlier one is there: the first fault is the one reported. */
const tlsHelloRefuse = (hello: TlsClientHelloView, alert: i32): void => {
  if (hello.alert === 0) {
    hello.alert = alert
  }
}

/**
 * Reads a vector of 16-bit values (a `width`-byte length within `[min, max]`)
 * and answers where it ends; an odd byte count fails the reader. The values
 * are the window from `r.at` before the call to the answer.
 */
const tlsReadU16Vector = (r: TlsReader, width: i32, min: i32, max: i32): i32 => {
  const end: i32 = tlsReadVector(r, width, min, max)
  if (tlsReadSpan(r, end) % 2 !== 0) {
    r.failed = true
    return r.at
  }
  tlsReadSkipTo(r, end)
  return end
}

/**
 * Whether `list` holds `value`.
 *
 * @param list The values to look in, such as a `TlsClientHello`'s `cipherSuites` or `groups`.
 * @param value The code point to look for, such as a suite or a group.
 * @returns true when `value` is somewhere in `list`.
 */
export const tlsListHas = (list: i32[], value: i32): boolean => list.indexOf(value) >= 0

/**
 * Whether the 16-bit values `data[at .. at + length)` hold `value`: how a
 * server asks a `TlsClientHelloView`'s windows what it offers without copying
 * them. The values are big-endian pairs; a last odd byte, and any part of the
 * window outside `data`, is not read.
 *
 * @param data The buffer the window points into, such as a view's `data`.
 * @param at Where the window starts in `data`, in bytes.
 * @param length How many bytes the window holds, two a value.
 * @param value The 16-bit code point to look for, such as `TLS_VERSION_13`.
 * @returns true when one of the window's values is `value`.
 */
export const tlsWindowHasU16 = (data: u8[], at: i32, length: i32, value: i32): boolean => {
  const end: i64 = toI64(at) + toI64(length)
  for (let k: i32 = at; k >= 0 && k < toI32(data.length) - 1 && toI64(k) + 1 < end; k += 2) {
    if (((toI32(data[k]) << 8) | toI32(data[k + 1])) === value) {
      return true
    }
  }
  return false
}

/**
 * `server_name` (RFC 6066 §3): a list of names, of which a `host_name` (type
 * 0) is kept. A second `host_name` is `illegal_parameter`, as §3 says. So is a
 * host name with a byte outside printable ASCII, because a DNS host name sent
 * here is ASCII (an internationalised one in its A-label form) and the server
 * exposes it as a string.
 */
const tlsReadServerName = (r: TlsReader, hello: TlsClientHelloView): void => {
  const listEnd: i32 = tlsReadVector(r, 2, 1, 65535)
  // The list's own end bounds every entry in it (see `tlsReadList`).
  const outerEnd: i32 = tlsReadList(r, listEnd)
  while (!r.failed && r.at < listEnd) {
    const nameType: i32 = tlsReadU8(r)
    const nameEnd: i32 = tlsReadVector(r, 2, 1, 65535)
    if (nameType === 0) {
      if (hello.hasServerName) {
        tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
      }
      hello.hasServerName = true
      hello.serverNameAt = r.at
      hello.serverNameLength = tlsReadSpan(r, nameEnd)
      while (!r.failed && r.at < nameEnd) {
        const c: i32 = tlsReadU8(r)
        if (c < 0x21 || c > 0x7e) {
          tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
        }
      }
    }
    tlsReadSkipTo(r, nameEnd)
  }
  r.end = outerEnd
}

/**
 * `key_share` (RFC 8446 §4.2.8): the client's shares, each a group and its
 * key_exchange<1..2^16-1>. Two shares for one group are `illegal_parameter`
 * (§4.2.8, "Clients MUST NOT offer multiple KeyShareEntry values for the same
 * group").
 */
const tlsReadKeyShare = (r: TlsReader, hello: TlsClientHelloView): void => {
  hello.hasKeyShare = true
  const listEnd: i32 = tlsReadVector(r, 2, 0, 65535)
  hello.sharesAt = r.at
  hello.sharesLength = tlsReadSpan(r, listEnd)
  // The list's own end bounds every entry in it (see `tlsReadList`).
  const outerEnd: i32 = tlsReadList(r, listEnd)
  while (!r.failed && r.at < listEnd) {
    const group: i32 = tlsReadU16(r)
    const shareEnd: i32 = tlsReadVector(r, 2, 1, 65535)
    if (tlsMarkSeen(hello.shareSeen, group)) {
      tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
    }
    if (group === TLS_GROUP_X25519 && !r.failed) {
      hello.hasX25519Share = true
      hello.x25519ShareAt = r.at
      hello.x25519ShareLength = tlsReadSpan(r, shareEnd)
    }
    if (group === TLS_GROUP_SECP256R1 && !r.failed) {
      hello.hasP256Share = true
      hello.p256ShareAt = r.at
      hello.p256ShareLength = tlsReadSpan(r, shareEnd)
    }
    tlsReadSkipTo(r, shareEnd)
  }
  r.end = outerEnd
}

/** `application_layer_protocol_negotiation` (RFC 7301 §3.1): ProtocolName<1..2^8-1> names in a list<2..2^16-1>. */
const tlsReadAlpn = (r: TlsReader, hello: TlsClientHelloView): void => {
  hello.hasAlpn = true
  const listEnd: i32 = tlsReadVector(r, 2, 2, 65535)
  hello.alpnAt = r.at
  hello.alpnLength = tlsReadSpan(r, listEnd)
  // The list's own end bounds every entry in it (see `tlsReadList`).
  const outerEnd: i32 = tlsReadList(r, listEnd)
  while (!r.failed && r.at < listEnd) {
    const nameEnd: i32 = tlsReadVector(r, 1, 1, 255)
    tlsReadSkipTo(r, nameEnd)
  }
  r.end = outerEnd
}

/**
 * `pre_shared_key` (§4.2.11): `identities<7..2^16-1>`, each an
 * `identity<1..2^16-1>` and a 32-bit obfuscated ticket age, then
 * `binders<33..2^16-1>`, each a `PskBinderEntry<32..255>`. A length the
 * syntax forbids fails the reader, and so is `decode_error`; that the two
 * lists hold as many entries as each other is `tlsReadClientHello`'s to check
 * once the whole hello has parsed. Nothing is opened or verified here.
 */
const tlsReadPreSharedKey = (r: TlsReader, hello: TlsClientHelloView): void => {
  hello.hasPreSharedKey = true
  const identitiesEnd: i32 = tlsReadVector(r, 2, 7, 65535)
  hello.pskIdentitiesAt = r.at
  hello.pskIdentitiesLength = tlsReadSpan(r, identitiesEnd)
  // The list's own end bounds every entry in it (see `tlsReadList`).
  let outerEnd: i32 = tlsReadList(r, identitiesEnd)
  // Each entry is at least 7 bytes of a list of at most 65535, so the count
  // bound never ends the walk early.
  let identities: i32 = 0
  while (!r.failed && r.at < identitiesEnd && identities < 65535) {
    const identityEnd: i32 = tlsReadVector(r, 2, 1, 65535)
    tlsReadSkipTo(r, identityEnd)
    // obfuscated_ticket_age, which the server reads only for the identity it selects.
    tlsReadSkipTo(r, tlsReadAhead(r, 4))
    if (!r.failed) {
      identities++
    }
  }
  hello.pskIdentityCount = identities
  r.end = outerEnd
  hello.pskBindersPrefixAt = r.at
  const bindersEnd: i32 = tlsReadVector(r, 2, 33, 65535)
  hello.pskBindersAt = r.at
  hello.pskBindersLength = tlsReadSpan(r, bindersEnd)
  outerEnd = tlsReadList(r, bindersEnd)
  let binders: i32 = 0
  while (!r.failed && r.at < bindersEnd && binders < 65535) {
    const binderEnd: i32 = tlsReadVector(r, 1, 32, 255)
    tlsReadSkipTo(r, binderEnd)
    if (!r.failed) {
      binders++
    }
  }
  hello.pskBinderCount = binders
  r.end = outerEnd
}

/**
 * `psk_key_exchange_modes` (§4.2.9): `ke_modes<1..255>`, one byte a mode. An
 * empty list fails the reader; a mode the server does not know is passed
 * over, and `psk_dhe_ke` is the one it records.
 */
const tlsReadPskModes = (r: TlsReader, hello: TlsClientHelloView): void => {
  hello.hasPskModes = true
  const modesEnd: i32 = tlsReadVector(r, 1, 1, 255)
  hello.pskModesAt = r.at
  hello.pskModesLength = tlsReadSpan(r, modesEnd)
  while (!r.failed && r.at < modesEnd) {
    if (tlsReadU8(r) === TLS_PSK_DHE_KE) {
      hello.pskDheKe = true
    }
  }
}

/**
 * `record_size_limit` (RFC 8449 §4), the body `r.at .. end`: a bare
 * `uint16`. A body of another length fails the reader, `decode_error`, and
 * is checked before the value so that a short value with trailing bytes is
 * not reported as `illegal_parameter`; a value below 64 is
 * `illegal_parameter`; one above the TLS 1.3 maximum is read as that maximum.
 */
const tlsReadRecordSizeLimit = (r: TlsReader, end: i32, hello: TlsClientHelloView): void => {
  if (tlsReadSpan(r, end) !== 2) {
    r.failed = true
    return
  }
  const limit: i32 = tlsReadU16(r)
  hello.hasRecordSizeLimit = true
  if (limit < TLS_RECORD_SIZE_LIMIT_MIN) {
    tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
  }
  hello.recordSizeLimit = limit > TLS_RECORD_SIZE_LIMIT_MAX ? TLS_RECORD_SIZE_LIMIT_MAX : limit
}

/** Reads one extension body, `r.at .. end`, of type `type`; an unknown type is skipped. */
const tlsReadExtension = (r: TlsReader, type: i32, end: i32, hello: TlsClientHelloView): void => {
  switch (type) {
    case TLS_EXT_SERVER_NAME:
      tlsReadServerName(r, hello)
      break
    case TLS_EXT_SUPPORTED_GROUPS:
      hello.hasSupportedGroups = true
      hello.groupsAt = tlsReadAhead(r, 2)
      hello.groupsLength = tlsWindowLength(hello.groupsAt, tlsReadU16Vector(r, 2, 2, 65535))
      break
    case TLS_EXT_SIGNATURE_ALGORITHMS:
      hello.hasSignatureAlgorithms = true
      hello.schemesAt = tlsReadAhead(r, 2)
      hello.schemesLength = tlsWindowLength(hello.schemesAt, tlsReadU16Vector(r, 2, 2, 65534))
      break
    case TLS_EXT_ALPN:
      tlsReadAlpn(r, hello)
      break
    case TLS_EXT_SUPPORTED_VERSIONS:
      hello.hasSupportedVersions = true
      hello.versionsAt = tlsReadAhead(r, 1)
      hello.versionsLength = tlsWindowLength(hello.versionsAt, tlsReadU16Vector(r, 1, 2, 254))
      break
    case TLS_EXT_KEY_SHARE:
      tlsReadKeyShare(r, hello)
      break
    case TLS_EXT_PRE_SHARED_KEY:
      tlsReadPreSharedKey(r, hello)
      break
    case TLS_EXT_PSK_KEY_EXCHANGE_MODES:
      tlsReadPskModes(r, hello)
      break
    case TLS_EXT_QUIC_TRANSPORT_PARAMETERS:
      hello.hasQuicTransportParameters = true
      hello.quicAt = r.at
      hello.quicLength = tlsReadSpan(r, end)
      tlsReadSkipTo(r, end)
      break
    case TLS_EXT_RECORD_SIZE_LIMIT:
      tlsReadRecordSizeLimit(r, end, hello)
      break
    default:
      tlsReadSkipTo(r, end)
      break
  }
  // Every reader above stops where its own vectors end, and none can pass
  // the extension's end, which is the reader's while it runs; an extension
  // body with bytes left after them is malformed (RFC 8446 §4.2), so this is
  // where trailing bytes are refused.
  if (r.at !== end) {
    r.failed = true
  }
}

/**
 * Reads the ClientHello body `data[off .. off + len)` — the message without its
 * four-byte handshake header — into `hello`, which forgets the last one first.
 * Its `alert` is 0 when the body parsed; otherwise the first fault decides it:
 * `decode_error` for a length past its bytes, a vector out of its bounds or
 * bytes left over, and `illegal_parameter` for an extension sent twice (§4.2),
 * a `pre_shared_key` that is not the last extension (§4.2.11), two shares for
 * one group, or a bad `server_name`. A window outside `data` is `decode_error`
 * too, rather than a panic.
 *
 * A hello that parses but offers `pre_shared_key` with a different number of
 * identities and binders is `illegal_parameter`, and one that offers it without
 * `psk_key_exchange_modes` is `missing_extension` (§4.2.9): rows 10 to 13 of
 * the fallback table in `docs/security/tls.md`, "Resumption". Nothing is
 * copied: the windows point into `data`, which must outlive the use made of
 * them.
 *
 * @param hello The view to read into, cleared first; its `alert` is the verdict.
 * @param data The buffer that holds the message, which the view's windows then point into.
 * @param off Where the body starts in `data`, in bytes, just past the handshake header.
 * @param len How many bytes the body is, from `off`.
 */
export const tlsReadClientHello = (hello: TlsClientHelloView, data: u8[], off: i32, len: i32): void => {
  hello.clear()
  hello.data = data
  if (off < 0 || len < 0 || off > toI32(data.length) - len) {
    hello.alert = TLS_ALERT_DECODE_ERROR
    return
  }
  // The guard above keeps the sum inside `data.length`.
  const end: i32 = toI32(toI64(off) + toI64(len))
  const r: TlsReader = hello.reader
  r.data = data
  r.at = off
  r.end = end
  r.failed = false
  hello.legacyVersion = tlsReadU16(r)
  hello.randomAt = r.at
  tlsReadSkipTo(r, tlsReadAhead(r, TLS_RANDOM_SIZE))
  const sessionEnd: i32 = tlsReadVector(r, 1, 0, 32)
  hello.sessionIdAt = r.at
  hello.sessionIdLength = tlsReadSpan(r, sessionEnd)
  tlsReadSkipTo(r, sessionEnd)
  hello.suitesAt = tlsReadAhead(r, 2)
  hello.suitesLength = tlsWindowLength(hello.suitesAt, tlsReadU16Vector(r, 2, 2, 65534))
  const compressionEnd: i32 = tlsReadVector(r, 1, 1, 255)
  hello.nullCompressionOnly = tlsReadSpan(r, compressionEnd) === 1 && tlsReadU8(r) === 0
  tlsReadSkipTo(r, compressionEnd)
  // A hello with no extensions block is well formed (§4.1.2 keeps it for
  // TLS 1.2 and earlier); it offers no TLS 1.3, which the server refuses.
  if (!r.failed && r.at < end) {
    const extensionsEnd: i32 = tlsReadVector(r, 2, 0, 65535)
    hello.extensionsAt = r.at
    hello.extensionsLength = tlsReadSpan(r, extensionsEnd)
    // The extensions vector's own end bounds every extension in it: one whose
    // length runs past it is malformed even when the message's length still
    // balances.
    const messageEnd: i32 = tlsReadList(r, extensionsEnd)
    while (!r.failed && r.at < extensionsEnd) {
      const type: i32 = tlsReadU16(r)
      const bodyEnd: i32 = tlsReadVector(r, 2, 0, 65535)
      if (r.failed) {
        break
      }
      if (tlsMarkSeen(hello.extensionSeen, type)) {
        tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
      }
      // §4.2.11: `pre_shared_key` must be the last extension, checked
      // before its body is read, so that this fault is reported first.
      if (type === TLS_EXT_PRE_SHARED_KEY && bodyEnd !== extensionsEnd) {
        tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
      }
      // The extension's own end bounds every read inside it, so a vector in
      // one extension cannot run on into the next.
      const outerEnd: i32 = tlsReadList(r, bodyEnd)
      tlsReadExtension(r, type, bodyEnd, hello)
      r.end = outerEnd
    }
    r.end = messageEnd
  }
  if (r.failed || r.at !== end) {
    tlsHelloRefuse(hello, TLS_ALERT_DECODE_ERROR)
    return
  }
  // Checked once the whole hello has parsed, so that a malformed one is
  // `decode_error` whatever these say (row 13 before rows 12 and 10).
  if (hello.hasPreSharedKey && hello.pskIdentityCount !== hello.pskBinderCount) {
    tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
  }
  if (hello.hasPreSharedKey && !hello.hasPskModes) {
    tlsHelloRefuse(hello, TLS_ALERT_MISSING_EXTENSION)
  }
}

/**
 * Points `hello`'s `pskIdentity*`, `pskTicketAge` and `pskBinder*` at the
 * offer's identity number `index` and the binder of the same number, and
 * answers whether there is one: false for an index out of range, or a hello
 * that offered no `pre_shared_key` or did not parse. It walks the lists
 * `tlsReadClientHello` checked, and allocates nothing.
 *
 * @param hello A view `tlsReadClientHello` has read into; its PSK windows are cleared first either way.
 * @param index Which identity to choose, from 0, in the client's order.
 * @returns true when the identity and its binder were found and the windows point at them.
 */
export const tlsSelectPskIdentity = (hello: TlsClientHelloView, index: i32): boolean => {
  hello.pskIdentityAt = 0
  hello.pskIdentityLength = 0
  hello.pskTicketAge = toU32(0)
  hello.pskBinderAt = 0
  hello.pskBinderLength = 0
  if (hello.alert !== 0 || !hello.hasPreSharedKey || index < 0 || index >= hello.pskIdentityCount) {
    return false
  }
  const data: u8[] = hello.data
  // A list of at most 65535 bytes holds fewer entries than that.
  if (index > 65535) {
    return false
  }
  let at: i32 = hello.pskIdentitiesAt
  for (let k: i32 = 0; k <= index && at >= 0 && at < toI32(data.length) - 1; k++) {
    const length: i32 = tlsWindowU16(data, at)
    // Past 2^31 - 1 the sum wraps negative, which is refused with the rest.
    const age: i32 = toI32(toI64(at) + 2 + toI64(length))
    if (age < 0 || age > toI32(data.length) - 4) {
      return false
    }
    if (k === index) {
      hello.pskIdentityAt = at + 2
      hello.pskIdentityLength = length
      hello.pskTicketAge = tlsWindowU32(data, age)
      break
    }
    at = age + 4
  }
  // An identity is never empty (§4.2.11), so an empty window means the walk
  // ran off the data before reaching it.
  if (hello.pskIdentityLength === 0) {
    return false
  }
  at = hello.pskBindersAt
  for (let k: i32 = 0; k <= index && at >= 0 && at < toI32(data.length); k++) {
    const length: i32 = toI32(data[at])
    if (k === index) {
      hello.pskBinderAt = at + 1
      hello.pskBinderLength = length
      return true
    }
    at = toI32(toI64(at) + 1 + toI64(length))
  }
  return false
}

/**
 * A ClientHello as `tlsParseClientHello` read it (RFC 8446 §4.1.2), each field
 * copied out of the message into an array of its own: the same hello as a
 * `TlsClientHelloView`, for a caller that wants values rather than windows. A
 * field whose extension was absent keeps its empty value, and its `has*` flag
 * says so.
 */
export class TlsClientHello {
  /** The client's 32-byte `random`. */
  random: u8[]
  /** `legacy_session_id`, which a server echoes (§4.1.3). */
  sessionId: u8[]
  /** `cipher_suites`, 16-bit values in the client's order. */
  cipherSuites: i32[]
  /** `supported_versions`, in the client's order. */
  versions: i32[]
  /** `supported_groups`, in the client's order. */
  groups: i32[]
  /** Every group a key share was offered for, in order. */
  shareGroups: i32[]
  /** The x25519 share's key_exchange, as sent; its length is the server's to check. */
  x25519Share: u8[]
  /** `signature_algorithms`, in the client's order. */
  signatureSchemes: i32[]
  /** The `host_name` of `server_name`, or empty. */
  serverName: string = ""
  /** The ALPN protocol names offered, each as its bytes (RFC 7301 §3.1). */
  alpn: u8[][]
  /** The client's `quic_transport_parameters`, opaque (RFC 9001 §8.2). */
  quicTransportParameters: u8[]
  /** Every extension type read, in order. */
  extensionTypes: i32[]
  /** `pre_shared_key`'s identities, in the client's order, and each one's obfuscated ticket age (§4.2.11). */
  pskIdentities: u8[][]
  /** Each identity's `obfuscated_ticket_age`, as sent: entry `i` belongs to `pskIdentities[i]`. */
  pskTicketAges: u32[]
  /** `pre_shared_key`'s binders, one an identity. */
  pskBinders: u8[][]
  /** `psk_key_exchange_modes`, one byte a mode. */
  pskModes: u8[]
  /**
   * How many bytes of the body come before `binders`: the body truncated
   * there, after its handshake header, is what each binder covers
   * (§4.2.11.2).
   */
  pskBindersPrefix: i32 = 0
  /** 0 when the message parsed, or the alert it earns: `decode_error` or `illegal_parameter`. */
  alert: i32 = 0
  /** `legacy_version` as sent; TLS 1.3 fixes it at 0x0303 and negotiates the real version in `supported_versions` (§4.1.2). */
  legacyVersion: i32 = 0
  /** Whether `legacy_compression_methods` is the single null method TLS 1.3 requires (§4.1.2). */
  nullCompressionOnly: boolean = false
  /** Whether the hello carried `supported_versions`: without it the client does not offer TLS 1.3 (§4.2.1). */
  hasSupportedVersions: boolean = false
  /** Whether the hello carried `supported_groups`. */
  hasSupportedGroups: boolean = false
  /** Whether the hello carried `key_share`, even an empty one. */
  hasKeyShare: boolean = false
  /** Whether `key_share` offered an x25519 share, so `x25519Share` holds one. */
  hasX25519Share: boolean = false
  /** Whether the hello carried `signature_algorithms`. */
  hasSignatureAlgorithms: boolean = false
  /** Whether the hello carried `server_name` with a `host_name` in it. */
  hasServerName: boolean = false
  /** Whether the hello carried ALPN. */
  hasAlpn: boolean = false
  /** Whether the hello carried `quic_transport_parameters`, which a QUIC handshake requires (RFC 9001 §8.2). */
  hasQuicTransportParameters: boolean = false
  /** The client's `record_size_limit` (RFC 8449), lowered to the TLS 1.3 maximum, or 0 when it sent none. */
  recordSizeLimit: i32 = 0
  /** Whether the hello carried `pre_shared_key`, which must be its last extension (§4.2.11). */
  hasPreSharedKey: boolean = false
  /** Whether the hello carried `psk_key_exchange_modes`, without which a server must not resume (§4.2.9). */
  hasPskModes: boolean = false
  /** Whether `psk_key_exchange_modes` lists `psk_dhe_ke`. */
  pskDheKe: boolean = false

  /**
   * Makes an empty hello, every field empty and every flag false, for
   * `tlsParseClientHello` to fill.
   */
  constructor() {
    this.random = []
    this.sessionId = []
    this.cipherSuites = []
    this.versions = []
    this.groups = []
    this.shareGroups = []
    this.x25519Share = []
    this.signatureSchemes = []
    this.alpn = []
    this.quicTransportParameters = []
    this.extensionTypes = []
    this.pskIdentities = []
    this.pskTicketAges = []
    this.pskBinders = []
    this.pskModes = []
  }
}

/**
 * The big-endian 16-bit value at `data[at]`, `data[at + 1]`, which the caller
 * has checked lie inside `data`.
 */
const tlsWindowU16 = (data: u8[], at: i32): i32 => toI32(tlsWindowUint(data, at, 2))

/** The big-endian 32-bit value at `data[at .. at + 4)`, which the caller has checked lie inside `data`. */
const tlsWindowU32 = (data: u8[], at: i32): u32 => tlsWindowUint(data, at, 4)

/** The big-endian value of the `width` bytes (at most 4) from `data[at]` that lie inside `data`. */
const tlsWindowUint = (data: u8[], at: i32, width: i32): u32 => {
  let v: u32 = toU32(0)
  if (at < 0) {
    return v
  }
  for (let j: i32 = at; j < toI32(data.length) && j - at < width; j++) {
    v = (v << 8) | toU32(data[j])
  }
  return v
}

/**
 * A copy of `data[at .. at + length)`, which is how a window of a view becomes
 * an array of its own that outlives the buffer it was read from.
 *
 * @param data The buffer the window points into.
 * @param at Where the window starts in `data`, in bytes.
 * @param length How many bytes to copy; a negative one copies none.
 * @returns A fresh array of the window's bytes; it stops where `data` ends, so it is
 *   shorter than `length` when the window runs past the buffer.
 */
export const tlsCopyWindow = (data: u8[], at: i32, length: i32): u8[] => {
  const out: u8[] = []
  for (let k: i32 = 0; k < length; k++) {
    // Past 2^31 - 1 the sum wraps negative, which ends the copy as the buffer's end does.
    const j: i32 = toI32(toI64(at) + toI64(k))
    if (j < 0 || j >= toI32(data.length)) {
      break
    }
    out.push(data[j])
  }
  return out
}

/** The 16-bit values of `data[at .. at + length)`, in a fresh list. */
const tlsCopyU16Window = (data: u8[], at: i32, length: i32): i32[] => {
  const out: i32[] = []
  const end: i64 = toI64(at) + toI64(length)
  // The step is widened because the `push` forgets the bound on `k`; a sum
  // past 2^31 - 1 wraps negative and ends the walk.
  for (let k: i32 = at; k >= 0 && k < toI32(data.length) - 1 && toI64(k) + 1 < end; k = toI32(toI64(k) + 2)) {
    out.push((toI32(data[k]) << 8) | toI32(data[k + 1]))
  }
  return out
}

/**
 * The bytes of `data[at .. at + length)` as a string of one character a byte:
 * ASCII here, a host name.
 *
 * @param data The buffer the window points into.
 * @param at Where the window starts in `data`, in bytes.
 * @param length How many bytes the window holds; any part outside `data` is left out.
 * @returns A fresh string, one character for each byte read.
 */
export const tlsWindowString = (data: u8[], at: i32, length: i32): string => {
  const parts: string[] = []
  const end: i64 = toI64(at) + toI64(length)
  for (let k: i32 = at; toI64(k) < end && k >= 0 && k < toI32(data.length); k++) {
    parts.push(String.fromCharCode(toI32(data[k])))
  }
  return parts.join("")
}

/**
 * Reads the ClientHello body `data[off .. off + len)` — the message without
 * its four-byte handshake header — into a fresh `TlsClientHello`, with
 * `tlsReadClientHello`'s checks and its `alert`, every field copied out.
 *
 * @param data The buffer that holds the message; nothing in the answer points into it.
 * @param off Where the body starts in `data`, in bytes, just past the handshake header.
 * @param len How many bytes the body is, from `off`.
 * @returns A fresh hello whose `alert` is 0 when the body parsed, or the alert it earns.
 */
export const tlsParseClientHello = (data: u8[], off: i32, len: i32): TlsClientHello => {
  const view = new TlsClientHelloView()
  tlsReadClientHello(view, data, off, len)
  const hello = new TlsClientHello()
  hello.alert = view.alert
  if (off < 0 || len < 0 || off > toI32(data.length) - len) {
    return hello
  }
  hello.legacyVersion = view.legacyVersion
  hello.random = tlsCopyWindow(data, view.randomAt, TLS_RANDOM_SIZE)
  hello.sessionId = tlsCopyWindow(data, view.sessionIdAt, view.sessionIdLength)
  hello.cipherSuites = tlsCopyU16Window(data, view.suitesAt, view.suitesLength)
  hello.versions = tlsCopyU16Window(data, view.versionsAt, view.versionsLength)
  hello.groups = tlsCopyU16Window(data, view.groupsAt, view.groupsLength)
  hello.signatureSchemes = tlsCopyU16Window(data, view.schemesAt, view.schemesLength)
  hello.x25519Share = tlsCopyWindow(data, view.x25519ShareAt, view.x25519ShareLength)
  hello.serverName = tlsWindowString(data, view.serverNameAt, view.serverNameLength)
  hello.quicTransportParameters = tlsCopyWindow(data, view.quicAt, view.quicLength)
  // The key shares, ALPN names and extension types, walked again; the read
  // above has checked every length these loops follow. Positions are summed
  // in 64 bits, and one that wraps past 2^31 - 1 ends its walk.
  let at: i32 = view.sharesAt
  const sharesEnd: i64 = toI64(view.sharesAt) + toI64(view.sharesLength)
  while (at >= 0 && at < toI32(data.length) - 3 && toI64(at) + 4 <= sharesEnd) {
    const skip: i32 = tlsWindowU16(data, toI32(toI64(at) + 2))
    hello.shareGroups.push(tlsWindowU16(data, at))
    at = toI32(toI64(at) + 4 + toI64(skip))
  }
  at = view.alpnAt
  const alpnEnd: i64 = toI64(view.alpnAt) + toI64(view.alpnLength)
  while (at >= 0 && at < toI32(data.length) && toI64(at) < alpnEnd) {
    const n: i32 = toI32(data[at])
    hello.alpn.push(tlsCopyWindow(data, at + 1, n))
    at = toI32(toI64(at) + 1 + toI64(n))
  }
  at = view.extensionsAt
  const extensionsEnd: i64 = toI64(view.extensionsAt) + toI64(view.extensionsLength)
  while (at >= 0 && at < toI32(data.length) - 3 && toI64(at) + 4 <= extensionsEnd) {
    const skip: i32 = tlsWindowU16(data, toI32(toI64(at) + 2))
    hello.extensionTypes.push(tlsWindowU16(data, at))
    at = toI32(toI64(at) + 4 + toI64(skip))
  }
  hello.nullCompressionOnly = view.nullCompressionOnly
  hello.hasSupportedVersions = view.hasSupportedVersions
  hello.hasSupportedGroups = view.hasSupportedGroups
  hello.hasKeyShare = view.hasKeyShare
  hello.hasX25519Share = view.hasX25519Share
  hello.hasSignatureAlgorithms = view.hasSignatureAlgorithms
  hello.hasServerName = view.hasServerName
  hello.hasAlpn = view.hasAlpn
  hello.hasQuicTransportParameters = view.hasQuicTransportParameters
  hello.recordSizeLimit = view.recordSizeLimit
  hello.hasPreSharedKey = view.hasPreSharedKey
  hello.hasPskModes = view.hasPskModes
  hello.pskDheKe = view.pskDheKe
  hello.pskModes = tlsCopyWindow(data, view.pskModesAt, view.pskModesLength)
  if (view.hasPreSharedKey) {
    // Both are in `[0, data.length]`, the prefix's end past `off`.
    hello.pskBindersPrefix = toI32(toI64(view.pskBindersPrefixAt) - toI64(off))
  }
  for (let k: i32 = 0; k < view.pskIdentityCount && tlsSelectPskIdentity(view, k); k++) {
    hello.pskIdentities.push(tlsCopyWindow(data, view.pskIdentityAt, view.pskIdentityLength))
    hello.pskTicketAges.push(view.pskTicketAge)
    hello.pskBinders.push(tlsCopyWindow(data, view.pskBinderAt, view.pskBinderLength))
  }
  return hello
}

/**
 * The writers below put a handshake message into the caller's array at an
 * offset and answer where it ends. A byte that would land outside the array
 * is dropped rather than written, and the answer is still where the message
 * ends, so a writer run over an empty array is how long its message is: the
 * `tlsEncode*` functions measure that way, allocate the message's array and
 * write it again, and a server that keeps its output in a buffer of its own
 * makes room first and writes in place. The `tlsPut*` helpers are the same
 * shape: they take the position and answer the next.
 *
 * A position is never past 2^30 - 1, far past any TLS message (§4 allows
 * 2^24 - 1 a body). A step that would pass it, or
 * that starts from a negative position, answers -1, and every later step
 * from -1 answers -1 again: so a writer handed a field too long for any
 * message, or an offset no array reaches, answers -1 and writes nothing past
 * the failure, and its caller tests the end once.
 */
const tlsAdvance = (at: i32, n: i32): i32 => {
  // 2^30 - 1 each, so the sum stays inside an `i32`.
  if (at < 0 || at > 1073741823 || n < 0 || n > 1073741823) {
    return -1
  }
  const next: i32 = at + n
  return next > 1073741823 ? -1 : next
}

const tlsPutU8 = (out: u8[], at: i32, v: i32): i32 => {
  const next: i32 = tlsAdvance(at, 1)
  if (next >= 0 && at >= 0 && at < toI32(out.length)) {
    out[at] = toU8(v & 255)
  }
  return next
}

const tlsPutU16 = (out: u8[], at: i32, v: i32): i32 => tlsPutU8(out, tlsPutU8(out, at, v >> 8), v)

const tlsPutU32 = (out: u8[], at: i32, v: u32): i32 => {
  const p: i32 = tlsPutU16(out, at, toI32((v >> 16) & 0xffff))
  return tlsPutU16(out, p, toI32(v & 0xffff))
}

/** `bytes[off .. off + len)`, at `out[at]`; -1 when `off .. off + len` is not inside `bytes`. */
const tlsPutWindow = (out: u8[], at: i32, bytes: u8[], off: i32, len: i32): i32 => {
  const size: i32 = toI32(bytes.length)
  if (off < 0 || off > size || len < 0 || len > size - off) {
    return -1
  }
  const next: i32 = tlsAdvance(at, len)
  // Measuring over an empty array: nothing would land, so nothing is copied.
  if (next < 0 || toI32(out.length) === 0) {
    return next
  }
  for (let j: i32 = off; j < size && j - off < len; j++) {
    tlsPutU8(out, toI32(toI64(at) + toI64(j - off)), toI32(bytes[j]))
  }
  return next
}

const tlsPutBytes = (out: u8[], at: i32, b: u8[]): i32 =>
  tlsPutWindow(out, at, b, TLS_CODEC_FROM, toI32(b.length))

/** The bytes of `text`, one a character: ASCII here, an ALPN protocol id. */
const tlsPutAscii = (out: u8[], at: i32, text: string): i32 => {
  const length: i32 = toI32(text.length)
  const next: i32 = tlsAdvance(at, length)
  if (next < 0) {
    return next
  }
  for (let k: i32 = 0; k < length; k++) {
    tlsPutU8(out, toI32(toI64(at) + toI64(k)), toI32(text.charCodeAt(k)))
  }
  return next
}

/**
 * Writes the `width`-byte length of the vector whose contents run from
 * `start` to `end`, into the `width` bytes before `start` that the caller
 * left for it. A failed writer (`end` -1) or a vector longer than `width`
 * bytes can say answers -1; otherwise `end`.
 */
const tlsPutLength = (out: u8[], start: i32, end: i32, width: i32): i32 => {
  if (
    start < 3 ||
    start > 1073741823 ||
    end < 0 ||
    end < start ||
    end > 1073741823 ||
    width < 1 ||
    width > 3
  ) {
    return -1
  }
  let n: i32 = end - start
  if (n > 16777215 || (width === 1 && n > 255) || (width === 2 && n > 65535)) {
    return -1
  }
  for (let k: i32 = 1; k <= width; k++) {
    tlsPutU8(out, start - k, n)
    n = n >> 8
  }
  return end
}

/**
 * The handshake header (§4): `type`, then a 24-bit length of the body that
 * follows it to `end`. Answers `end`, or -1 for a failed writer or a body
 * past 2^24 - 1 bytes.
 */
const tlsPutHeader = (out: u8[], at: i32, type: i32, end: i32): i32 => {
  tlsPutU8(out, at, type)
  return tlsPutLength(out, tlsAdvance(at, 4), end, 3)
}

/** The fixed `random` that marks a ServerHello as a HelloRetryRequest: SHA-256 of "HelloRetryRequest" (§4.1.3). */
const TLS_HELLO_RETRY_RANDOM: string = "cf21ad74e59a6111be1d8c021e65b891c2a211167abb8c5e079e09e2c8a8339c"

/** The value of one lowercase hex digit. */
const tlsHexNibble = (c: u8): i32 => {
  const v: i32 = toI32(c)
  return v <= 57 ? v - 48 : v - 87
}

/**
 * Writes the bytes the lowercase hex constant `text` spells at `out[at]` and
 * answers where they end: how this stack's fixed values, written out where
 * they are defined, become bytes without an array of their own.
 *
 * @param text Lowercase hex digits, two a byte; a last odd digit is ignored, and nothing else is checked.
 * @param out The array to write into; a byte that would land outside it is dropped.
 * @param at Where the first byte goes in `out`.
 * @returns `at` plus the number of bytes `text` spells, written or not; -1 when `at` is
 *   negative or the end would pass 2^30 - 1.
 */
export const tlsHexInto = (text: string, out: u8[], at: i32): i32 => {
  const digits: i32 = toI32(text.length)
  const next: i32 = tlsAdvance(at, digits >> 1)
  if (next < 0) {
    return next
  }
  // Every odd index closes a byte: the digit before it is the high nibble.
  for (let i: i32 = 1; i < digits; i++) {
    if ((i & 1) === 1) {
      const hi: i32 = tlsHexNibble(toU8(text.charCodeAt(i - 1)))
      const lo: i32 = tlsHexNibble(toU8(text.charCodeAt(i)))
      tlsPutU8(out, toI32(toI64(at) + toI64(i >> 1)), (hi << 4) | lo)
    }
  }
  return next
}

/** The `supported_versions` a server hello carries: TLS 1.3 alone (§4.2.1). */
const tlsPutSelectedVersion = (out: u8[], at: i32): i32 =>
  tlsPutU16(out, tlsPutU16(out, tlsPutU16(out, at, TLS_EXT_SUPPORTED_VERSIONS), 2), TLS_VERSION_13)

/**
 * What a ServerHello and a HelloRetryRequest open with (§4.1.3), after the
 * header: the legacy version, the random (`retry` for the HelloRetryRequest's
 * fixed one), the echoed session id, the suite and null compression.
 */
const tlsPutHelloHead = (
  out: u8[],
  at: i32,
  random: u8[],
  retry: boolean,
  sessionId: u8[],
  sessionIdOff: i32,
  sessionIdLength: i32,
  suite: i32
): i32 => {
  let p: i32 = tlsPutU16(out, at, TLS_LEGACY_VERSION)
  p = retry ? tlsHexInto(TLS_HELLO_RETRY_RANDOM, out, p) : tlsPutBytes(out, p, random)
  p = tlsPutU8(out, p, sessionIdLength)
  p = tlsPutWindow(out, p, sessionId, sessionIdOff, sessionIdLength)
  p = tlsPutU16(out, p, suite)
  return tlsPutU8(out, p, 0)
}

/**
 * A ServerHello (§4.1.3), as `tlsWriteServerHello` and
 * `tlsWriteServerHelloPsk` write it: with a `pre_shared_key` naming
 * `selectedIdentity` first when that is not negative, the order RFC 8448 §4
 * shows, then `key_share` and `supported_versions`. The share's group follows
 * from `publicKey`'s length: 65 bytes is a secp256r1 point, anything else
 * an x25519 key.
 */
const tlsPutServerHello = (
  out: u8[],
  at: i32,
  random: u8[],
  sessionId: u8[],
  sessionIdOff: i32,
  sessionIdLength: i32,
  suite: i32,
  publicKey: u8[],
  selectedIdentity: i32
): i32 => {
  let p: i32 = tlsPutHelloHead(
    out,
    tlsAdvance(at, 4),
    random,
    false,
    sessionId,
    sessionIdOff,
    sessionIdLength,
    suite
  )
  const extensions: i32 = tlsAdvance(p, 2)
  p = extensions
  if (selectedIdentity >= 0) {
    p = tlsPutU16(out, tlsPutU16(out, tlsPutU16(out, p, TLS_EXT_PRE_SHARED_KEY), 2), selectedIdentity)
  }
  p = tlsPutU16(out, p, TLS_EXT_KEY_SHARE)
  const share: i32 = tlsAdvance(p, 2)
  const group: i32 = toI32(publicKey.length) === TLS_P256_SHARE_SIZE ? TLS_GROUP_SECP256R1 : TLS_GROUP_X25519
  p = tlsPutU16(out, share, group)
  const key: i32 = tlsAdvance(p, 2)
  p = tlsPutBytes(out, key, publicKey)
  p = tlsPutLength(out, key, p, 2)
  p = tlsPutLength(out, share, p, 2)
  p = tlsPutSelectedVersion(out, p)
  p = tlsPutLength(out, extensions, p, 2)
  return tlsPutHeader(out, at, TLS_HANDSHAKE_SERVER_HELLO, p)
}

/**
 * Writes a ServerHello (§4.1.3) at `out[at]` and answers where it ends:
 * choosing `suite` and TLS 1.3, echoing the session id
 * `sessionId[sessionIdOff .. sessionIdOff + sessionIdLength)`, and carrying
 * the server's key share, secp256r1 when `serverShare` is a 65-byte point
 * and x25519 otherwise. The extensions are `key_share` then
 * `supported_versions`, the order RFC 8448 §3 shows.
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the message, handshake header first, starts in `out`.
 * @param random The server's 32-byte `random` (§4.1.3), written as it is.
 * @param sessionId The buffer that holds the client's `legacy_session_id`, such as the hello's `data`.
 * @param sessionIdOff Where the session id starts in `sessionId`.
 * @param sessionIdLength How many bytes the session id is, 0 to 32.
 * @param suite The cipher suite the server chose, such as `nish/net/tls/schedule`'s `TLS_AES_128_GCM_SHA256`.
 * @param serverShare The server's key share, its `key_exchange`: 32 bytes of x25519, or a
 *   65-byte uncompressed secp256r1 point.
 * @returns Where the message ends in `out`: `at` plus its length, written or not; -1 when
 *   `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteServerHello = (
  out: u8[],
  at: i32,
  random: u8[],
  sessionId: u8[],
  sessionIdOff: i32,
  sessionIdLength: i32,
  suite: i32,
  serverShare: u8[]
): i32 => tlsPutServerHello(out, at, random, sessionId, sessionIdOff, sessionIdLength, suite, serverShare, -1)

/**
 * Writes the ServerHello of a resumed handshake (§4.1.3, §4.2.11) at
 * `out[at]` and answers where it ends: `tlsWriteServerHello`'s, with a
 * `pre_shared_key` that names the client's identity number
 * `selectedIdentity` (a `uint16`) ahead of `key_share`, since the server
 * resumes only in `psk_dhe_ke` and so always sends its share.
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the message, handshake header first, starts in `out`.
 * @param random The server's 32-byte `random` (§4.1.3), written as it is.
 * @param sessionId The buffer that holds the client's `legacy_session_id`, such as the hello's `data`.
 * @param sessionIdOff Where the session id starts in `sessionId`.
 * @param sessionIdLength How many bytes the session id is, 0 to 32.
 * @param suite The cipher suite the server chose.
 * @param serverShare The server's key share, its `key_exchange`: 32 bytes of x25519, or a
 *   65-byte uncompressed secp256r1 point.
 * @param selectedIdentity The index, from 0, of the client's PSK identity the server accepts; only its low
 *   16 bits are written.
 * @returns Where the message ends in `out`: `at` plus its length, written or not; -1 when
 *   `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteServerHelloPsk = (
  out: u8[],
  at: i32,
  random: u8[],
  sessionId: u8[],
  sessionIdOff: i32,
  sessionIdLength: i32,
  suite: i32,
  serverShare: u8[],
  selectedIdentity: i32
): i32 =>
  tlsPutServerHello(
    out,
    at,
    random,
    sessionId,
    sessionIdOff,
    sessionIdLength,
    suite,
    serverShare,
    selectedIdentity & 0xffff
  )

/**
 * Writes a HelloRetryRequest (§4.1.4) at `out[at]` and answers where it ends:
 * a ServerHello whose `random` is the fixed HelloRetryRequest value, choosing
 * `suite`, echoing the session id, and asking for a share of `group` in
 * `key_share`. No cookie is sent.
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the message, handshake header first, starts in `out`.
 * @param sessionId The buffer that holds the client's `legacy_session_id`, such as the hello's `data`.
 * @param sessionIdOff Where the session id starts in `sessionId`.
 * @param sessionIdLength How many bytes the session id is, 0 to 32.
 * @param suite The cipher suite the server chose, which the second ServerHello must choose again.
 * @param group The group the client is asked to send a share for, such as `TLS_GROUP_X25519`.
 * @returns Where the message ends in `out`: `at` plus its length, written or not; -1 when
 *   `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteHelloRetryRequest = (
  out: u8[],
  at: i32,
  sessionId: u8[],
  sessionIdOff: i32,
  sessionIdLength: i32,
  suite: i32,
  group: i32
): i32 => {
  const none: u8[] = []
  let p: i32 = tlsPutHelloHead(
    out,
    tlsAdvance(at, 4),
    none,
    true,
    sessionId,
    sessionIdOff,
    sessionIdLength,
    suite
  )
  const extensions: i32 = tlsAdvance(p, 2)
  p = tlsPutU16(out, extensions, TLS_EXT_KEY_SHARE)
  p = tlsPutU16(out, p, 2)
  p = tlsPutU16(out, p, group)
  p = tlsPutSelectedVersion(out, p)
  p = tlsPutLength(out, extensions, p, 2)
  return tlsPutHeader(out, at, TLS_HANDSHAKE_SERVER_HELLO, p)
}

/**
 * Writes EncryptedExtensions (§4.3.1) at `out[at]` and answers where it ends.
 * `extra` is extensions the caller encodes itself, written first and as they
 * are; then the chosen ALPN protocol when `alpn` is not empty (RFC 7301 §3.1,
 * a list of exactly one), an empty `server_name` when `acknowledgeServerName`
 * (RFC 6066 §3's acknowledgement), the server's
 * `quic_transport_parameters` when `quicTransportParameters` is not `null`,
 * and the server's own `record_size_limit` (RFC 8449 §4) when
 * `recordSizeLimit` is not 0.
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the message, handshake header first, starts in `out`.
 * @param extra Whole extensions, type and length included, written first and unchecked; empty for none.
 * @param alpn The protocol the server chose, one character a byte, at most 255; empty to send no ALPN.
 * @param acknowledgeServerName Whether to send the empty `server_name` that says the server used the name.
 * @param quicTransportParameters The server's QUIC transport parameters, opaque; `null` to send none.
 * @param recordSizeLimit The largest record plaintext the server takes, content type included, written as a `uint16`; 0 to send none.
 * @returns Where the message ends in `out`: `at` plus its length, written or not; -1 when
 *   `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteEncryptedExtensions = (
  out: u8[],
  at: i32,
  extra: u8[],
  alpn: string,
  acknowledgeServerName: boolean,
  quicTransportParameters: u8[] | null,
  recordSizeLimit: i32
): i32 => {
  const extensions: i32 = tlsAdvance(at, 6)
  let p: i32 = tlsPutBytes(out, extensions, extra)
  if (toI32(alpn.length) > 0) {
    p = tlsPutU16(out, p, TLS_EXT_ALPN)
    const body: i32 = tlsAdvance(p, 2)
    const list: i32 = tlsAdvance(body, 2)
    const name: i32 = tlsAdvance(list, 1)
    p = tlsPutAscii(out, name, alpn)
    p = tlsPutLength(out, name, p, 1)
    p = tlsPutLength(out, list, p, 2)
    p = tlsPutLength(out, body, p, 2)
  }
  if (acknowledgeServerName) {
    p = tlsPutU16(out, tlsPutU16(out, p, TLS_EXT_SERVER_NAME), 0)
  }
  if (quicTransportParameters !== null) {
    p = tlsPutU16(out, p, TLS_EXT_QUIC_TRANSPORT_PARAMETERS)
    const body: i32 = tlsAdvance(p, 2)
    p = tlsPutBytes(out, body, quicTransportParameters)
    p = tlsPutLength(out, body, p, 2)
  }
  if (recordSizeLimit !== 0) {
    p = tlsPutU16(out, tlsPutU16(out, tlsPutU16(out, p, TLS_EXT_RECORD_SIZE_LIMIT), 2), recordSizeLimit)
  }
  p = tlsPutLength(out, extensions, p, 2)
  return tlsPutHeader(out, at, TLS_HANDSHAKE_ENCRYPTED_EXTENSIONS, p)
}

/**
 * Writes a server's Certificate (§4.4.2) at `out[at]` and answers where it
 * ends: an empty request context, then each DER certificate of `chain`, leaf
 * first, with no extensions of its own.
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the message, handshake header first, starts in `out`.
 * @param chain The DER certificates, leaf first, each written as it is.
 * @returns Where the message ends in `out`: `at` plus its length, written or not; -1 when
 *   `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteCertificate = (out: u8[], at: i32, chain: u8[][]): i32 => {
  const list: i32 = tlsAdvance(tlsPutU8(out, tlsAdvance(at, 4), 0), 3)
  let p: i32 = list
  for (const certificate of chain) {
    const entry: i32 = tlsAdvance(p, 3)
    p = tlsPutBytes(out, entry, certificate)
    p = tlsPutLength(out, entry, p, 3)
    p = tlsPutU16(out, p, 0)
  }
  p = tlsPutLength(out, list, p, 3)
  return tlsPutHeader(out, at, TLS_HANDSHAKE_CERTIFICATE, p)
}

/**
 * Writes a CertificateVerify (§4.4.3) at `out[at]`: the signature scheme and
 * the signature as it goes on the wire.
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the message, handshake header first, starts in `out`.
 * @param scheme The signature scheme, such as `TLS_SIGNATURE_ECDSA_SECP256R1_SHA256`.
 * @param signature The signature over `tlsCertificateVerifyContent`, in the scheme's wire encoding.
 * @returns Where the message ends in `out`: `at` plus its length, written or not; -1 when
 *   `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteCertificateVerify = (out: u8[], at: i32, scheme: i32, signature: u8[]): i32 => {
  const body: i32 = tlsAdvance(tlsPutU16(out, tlsAdvance(at, 4), scheme), 2)
  let p: i32 = tlsPutBytes(out, body, signature)
  p = tlsPutLength(out, body, p, 2)
  return tlsPutHeader(out, at, TLS_HANDSHAKE_CERTIFICATE_VERIFY, p)
}

/**
 * Writes a Finished (§4.4.4) at `out[at]`, carrying `verifyData[off .. off + len)`.
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the message, handshake header first, starts in `out`.
 * @param verifyData The buffer that holds the `verify_data`, the HMAC the key schedule computed.
 * @param off Where the `verify_data` starts in `verifyData`.
 * @param len How many bytes it is: the suite's hash length, 32 or 48.
 * @returns Where the message ends in `out`: `at` plus its length, written or not; -1 when
 *   `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteFinished = (out: u8[], at: i32, verifyData: u8[], off: i32, len: i32): i32 => {
  const p: i32 = tlsPutWindow(out, tlsAdvance(at, 4), verifyData, off, len)
  return tlsPutHeader(out, at, TLS_HANDSHAKE_FINISHED, p)
}

/**
 * Writes a NewSessionTicket (§4.6.1) at `out[at]` and answers where it ends:
 * `lifetime` in seconds, `ageAdd`, the nonce
 * `nonce[nonceOff .. nonceOff + nonceLength)`, the ticket
 * `ticket[ticketOff .. ticketOff + ticketLength)`, and `extra` as the
 * extensions, encoded by the caller and written as they are. The server sends
 * none; RFC 8448 §3's ticket carries `early_data`.
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the message, handshake header first, starts in `out`.
 * @param lifetime How long the ticket may be used, in seconds; RFC 8446 §4.6.1 caps it at seven days.
 * @param ageAdd The `ticket_age_add` that obfuscates the ticket age, which §4.6.1 wants fresh and random.
 * @param nonce The buffer that holds the `ticket_nonce`.
 * @param nonceOff Where the nonce starts in `nonce`.
 * @param nonceLength How many bytes the nonce is, 0 to 255.
 * @param ticket The buffer that holds the ticket the client will send back.
 * @param ticketOff Where the ticket starts in `ticket`.
 * @param ticketLength How many bytes the ticket is: §4.6.1 allows 1 to 65535, not checked here.
 * @param extra Whole extensions, type and length included, written unchecked; empty for none.
 * @returns Where the message ends in `out`: `at` plus its length, written or not; -1 when
 *   `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteNewSessionTicket = (
  out: u8[],
  at: i32,
  lifetime: u32,
  ageAdd: u32,
  nonce: u8[],
  nonceOff: i32,
  nonceLength: i32,
  ticket: u8[],
  ticketOff: i32,
  ticketLength: i32,
  extra: u8[]
): i32 => {
  let p: i32 = tlsPutU32(out, tlsPutU32(out, tlsAdvance(at, 4), lifetime), ageAdd)
  p = tlsPutU8(out, p, nonceLength)
  p = tlsPutWindow(out, p, nonce, nonceOff, nonceLength)
  p = tlsPutU16(out, p, ticketLength)
  p = tlsPutWindow(out, p, ticket, ticketOff, ticketLength)
  const extensions: i32 = tlsAdvance(p, 2)
  p = tlsPutBytes(out, extensions, extra)
  p = tlsPutLength(out, extensions, p, 2)
  return tlsPutHeader(out, at, TLS_HANDSHAKE_NEW_SESSION_TICKET, p)
}

/**
 * Writes what a server's CertificateVerify signs (§4.4.3) at `out[at]`: 64
 * spaces, the context string "TLS 1.3, server CertificateVerify", a zero byte,
 * and the transcript hash `transcriptHash[off .. off + len)` through
 * Certificate.
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the content starts in `out`. It has no handshake header: it is signed, not sent.
 * @param transcriptHash The buffer that holds the transcript hash through the server's Certificate.
 * @param off Where the hash starts in `transcriptHash`.
 * @param len How many bytes the hash is: the suite's hash length.
 * @returns Where the content ends in `out`: `at` plus 98 plus `len`, written or not; -1
 *   when `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteCertificateVerifyContent = (
  out: u8[],
  at: i32,
  transcriptHash: u8[],
  off: i32,
  len: i32
): i32 => {
  let p: i32 = at
  for (let k: i32 = 0; k < 64; k++) {
    p = tlsPutU8(out, p, 0x20)
  }
  p = tlsPutAscii(out, p, "TLS 1.3, server CertificateVerify")
  p = tlsPutU8(out, p, 0)
  return tlsPutWindow(out, p, transcriptHash, off, len)
}

/**
 * `n` zero bytes in a fresh array, the buffer a `tlsEncode*` fills after its
 * writer measured it; a negative `n`, the measure of a message past 2^30 - 1
 * bytes, gives an empty one, which the writer then leaves empty.
 */
const tlsZeros = (n: i32): u8[] => {
  const out: u8[] = []
  for (let k: i32 = 0; k < n; k++) {
    out.push(0)
  }
  return out
}

/** The bytes of `name` as a string of one character a byte, which `tlsWriteEncryptedExtensions` writes back as they were. */
const tlsBytesString = (name: u8[]): string => tlsWindowString(name, TLS_CODEC_FROM, toI32(name.length))

/**
 * A ServerHello (§4.1.3) choosing `suite` and TLS 1.3, echoing the client's
 * `sessionId`, and carrying the server's x25519 share, in a fresh array
 * (`tlsWriteServerHello`).
 *
 * @param random The server's 32-byte `random` (§4.1.3), written as it is.
 * @param sessionId The client's whole `legacy_session_id`, 0 to 32 bytes, echoed.
 * @param suite The cipher suite the server chose.
 * @param serverShare The server's key share, its `key_exchange`: 32 bytes of x25519, or a
 *   65-byte uncompressed secp256r1 point.
 * @returns The whole message, handshake header included; empty for one past 2^30 - 1 bytes.
 */
export const tlsEncodeServerHello = (random: u8[], sessionId: u8[], suite: i32, serverShare: u8[]): u8[] => {
  const none: u8[] = []
  const sessionIdLength: i32 = toI32(sessionId.length)
  const out: u8[] = tlsZeros(
    tlsWriteServerHello(
      none,
      TLS_CODEC_FROM,
      random,
      sessionId,
      TLS_CODEC_FROM,
      sessionIdLength,
      suite,
      serverShare
    )
  )
  tlsWriteServerHello(
    out,
    TLS_CODEC_FROM,
    random,
    sessionId,
    TLS_CODEC_FROM,
    sessionIdLength,
    suite,
    serverShare
  )
  return out
}

/**
 * A resumed handshake's ServerHello naming `selectedIdentity`, in a fresh
 * array (`tlsWriteServerHelloPsk`).
 *
 * @param random The server's 32-byte `random` (§4.1.3), written as it is.
 * @param sessionId The client's whole `legacy_session_id`, 0 to 32 bytes, echoed.
 * @param suite The cipher suite the server chose.
 * @param serverShare The server's key share, its `key_exchange`: 32 bytes of x25519, or a
 *   65-byte uncompressed secp256r1 point.
 * @param selectedIdentity The index, from 0, of the client's PSK identity the server accepts; only its low
 *   16 bits are written.
 * @returns The whole message, handshake header included; empty for one past 2^30 - 1 bytes.
 */
export const tlsEncodeServerHelloPsk = (
  random: u8[],
  sessionId: u8[],
  suite: i32,
  serverShare: u8[],
  selectedIdentity: i32
): u8[] => {
  const none: u8[] = []
  const sessionIdLength: i32 = toI32(sessionId.length)
  const out: u8[] = tlsZeros(
    tlsWriteServerHelloPsk(
      none,
      TLS_CODEC_FROM,
      random,
      sessionId,
      TLS_CODEC_FROM,
      sessionIdLength,
      suite,
      serverShare,
      selectedIdentity
    )
  )
  tlsWriteServerHelloPsk(
    out,
    TLS_CODEC_FROM,
    random,
    sessionId,
    TLS_CODEC_FROM,
    sessionIdLength,
    suite,
    serverShare,
    selectedIdentity
  )
  return out
}

/**
 * A HelloRetryRequest (§4.1.4) choosing `suite`, echoing `sessionId` and
 * asking for `group`, in a fresh array (`tlsWriteHelloRetryRequest`).
 *
 * @param sessionId The client's whole `legacy_session_id`, 0 to 32 bytes, echoed.
 * @param suite The cipher suite the server chose, which the second ServerHello must choose again.
 * @param group The group the client is asked to send a share for, such as `TLS_GROUP_X25519`.
 * @returns The whole message, handshake header included; empty for one past 2^30 - 1 bytes.
 */
export const tlsEncodeHelloRetryRequest = (sessionId: u8[], suite: i32, group: i32): u8[] => {
  const none: u8[] = []
  const sessionIdLength: i32 = toI32(sessionId.length)
  const out: u8[] = tlsZeros(
    tlsWriteHelloRetryRequest(none, TLS_CODEC_FROM, sessionId, TLS_CODEC_FROM, sessionIdLength, suite, group)
  )
  tlsWriteHelloRetryRequest(out, TLS_CODEC_FROM, sessionId, TLS_CODEC_FROM, sessionIdLength, suite, group)
  return out
}

/**
 * EncryptedExtensions (§4.3.1) in a fresh array (`tlsWriteEncryptedExtensions`),
 * the ALPN protocol given as its bytes.
 *
 * @param extra Whole extensions, type and length included, written first and unchecked; empty for none.
 * @param alpn The protocol the server chose, as its bytes, at most 255; empty to send no ALPN.
 * @param acknowledgeServerName Whether to send the empty `server_name` that says the server used the name.
 * @param quicTransportParameters The server's QUIC transport parameters, opaque; `null` to send none.
 * @param recordSizeLimit The server's own `record_size_limit` (RFC 8449 §4); 0 to send none.
 * @returns The whole message, handshake header included; empty for one past 2^30 - 1 bytes.
 */
export const tlsEncodeEncryptedExtensions = (
  extra: u8[],
  alpn: u8[],
  acknowledgeServerName: boolean,
  quicTransportParameters: u8[] | null,
  recordSizeLimit: i32
): u8[] => {
  const none: u8[] = []
  const protocol: string = tlsBytesString(alpn)
  const out: u8[] = tlsZeros(
    tlsWriteEncryptedExtensions(
      none,
      TLS_CODEC_FROM,
      extra,
      protocol,
      acknowledgeServerName,
      quicTransportParameters,
      recordSizeLimit
    )
  )
  tlsWriteEncryptedExtensions(
    out,
    TLS_CODEC_FROM,
    extra,
    protocol,
    acknowledgeServerName,
    quicTransportParameters,
    recordSizeLimit
  )
  return out
}

/**
 * A server's Certificate (§4.4.2) in a fresh array (`tlsWriteCertificate`).
 *
 * @param chain The DER certificates, leaf first, each written as it is.
 * @returns The whole message, handshake header included; empty for one past 2^30 - 1 bytes.
 */
export const tlsEncodeCertificate = (chain: u8[][]): u8[] => {
  const none: u8[] = []
  const out: u8[] = tlsZeros(tlsWriteCertificate(none, TLS_CODEC_FROM, chain))
  tlsWriteCertificate(out, TLS_CODEC_FROM, chain)
  return out
}

/**
 * A CertificateVerify (§4.4.3) in a fresh array (`tlsWriteCertificateVerify`).
 *
 * @param scheme The signature scheme, such as `TLS_SIGNATURE_ECDSA_SECP256R1_SHA256`.
 * @param signature The signature over `tlsCertificateVerifyContent`, in the scheme's wire encoding.
 * @returns The whole message, handshake header included; empty for one past 2^30 - 1 bytes.
 */
export const tlsEncodeCertificateVerify = (scheme: i32, signature: u8[]): u8[] => {
  const none: u8[] = []
  const out: u8[] = tlsZeros(tlsWriteCertificateVerify(none, TLS_CODEC_FROM, scheme, signature))
  tlsWriteCertificateVerify(out, TLS_CODEC_FROM, scheme, signature)
  return out
}

/**
 * A Finished (§4.4.4) carrying `verifyData`, in a fresh array (`tlsWriteFinished`).
 *
 * @param verifyData The whole `verify_data`, the HMAC the key schedule computed: 32 or 48 bytes.
 * @returns The whole message, handshake header included; empty for one past 2^30 - 1 bytes.
 */
export const tlsEncodeFinished = (verifyData: u8[]): u8[] => {
  const none: u8[] = []
  const length: i32 = toI32(verifyData.length)
  const out: u8[] = tlsZeros(tlsWriteFinished(none, TLS_CODEC_FROM, verifyData, TLS_CODEC_FROM, length))
  tlsWriteFinished(out, TLS_CODEC_FROM, verifyData, TLS_CODEC_FROM, length)
  return out
}

/**
 * A NewSessionTicket (§4.6.1) in a fresh array (`tlsWriteNewSessionTicket`).
 *
 * @param lifetime How long the ticket may be used, in seconds; RFC 8446 §4.6.1 caps it at seven days.
 * @param ageAdd The `ticket_age_add` that obfuscates the ticket age, which §4.6.1 wants fresh and random.
 * @param nonce The whole `ticket_nonce`, 0 to 255 bytes.
 * @param ticket The whole ticket the client will send back: §4.6.1 allows 1 to 65535 bytes, not checked here.
 * @param extra Whole extensions, type and length included, written unchecked; empty for none.
 * @returns The whole message, handshake header included; empty for one past 2^30 - 1 bytes.
 */
export const tlsEncodeNewSessionTicket = (
  lifetime: u32,
  ageAdd: u32,
  nonce: u8[],
  ticket: u8[],
  extra: u8[]
): u8[] => {
  const none: u8[] = []
  const nonceLength: i32 = toI32(nonce.length)
  const ticketLength: i32 = toI32(ticket.length)
  const out: u8[] = tlsZeros(
    tlsWriteNewSessionTicket(
      none,
      TLS_CODEC_FROM,
      lifetime,
      ageAdd,
      nonce,
      TLS_CODEC_FROM,
      nonceLength,
      ticket,
      TLS_CODEC_FROM,
      ticketLength,
      extra
    )
  )
  tlsWriteNewSessionTicket(
    out,
    TLS_CODEC_FROM,
    lifetime,
    ageAdd,
    nonce,
    TLS_CODEC_FROM,
    nonceLength,
    ticket,
    TLS_CODEC_FROM,
    ticketLength,
    extra
  )
  return out
}

/**
 * What a server's CertificateVerify signs (§4.4.3), in a fresh array
 * (`tlsWriteCertificateVerifyContent`).
 *
 * @param transcriptHash The whole transcript hash through the server's Certificate.
 * @returns The content to sign: 98 bytes of prefix, then the hash. It has no handshake header.
 */
export const tlsCertificateVerifyContent = (transcriptHash: u8[]): u8[] => {
  const none: u8[] = []
  const length: i32 = toI32(transcriptHash.length)
  const out: u8[] = tlsZeros(
    tlsWriteCertificateVerifyContent(none, TLS_CODEC_FROM, transcriptHash, TLS_CODEC_FROM, length)
  )
  tlsWriteCertificateVerifyContent(out, TLS_CODEC_FROM, transcriptHash, TLS_CODEC_FROM, length)
  return out
}

// ---------------------------------------------------------------------------
// The client's half: the ClientHello it writes and the server flight it reads.
// ---------------------------------------------------------------------------

/** The `signature_algorithms` the client offers (§4.2.3), in its order of preference. */
const tlsPutClientSchemes = (out: u8[], at: i32): i32 => {
  let p: i32 = tlsPutU16(out, at, TLS_SIGNATURE_ECDSA_SECP256R1_SHA256)
  p = tlsPutU16(out, p, TLS_SIGNATURE_ECDSA_SECP384R1_SHA384)
  p = tlsPutU16(out, p, TLS_SIGNATURE_RSA_PSS_RSAE_SHA256)
  p = tlsPutU16(out, p, TLS_SIGNATURE_RSA_PSS_RSAE_SHA384)
  return tlsPutU16(out, p, TLS_SIGNATURE_RSA_PSS_RSAE_SHA512)
}

/**
 * Whether `scheme` is one the client's `signature_algorithms` offers, the
 * only ones a server's CertificateVerify may use (§4.4.3).
 *
 * @param scheme The scheme a server's CertificateVerify names.
 * @returns true for ECDSA P-256 or P-384, or RSA-PSS (rsae) with SHA-256, SHA-384 or SHA-512.
 */
export const tlsClientOffersScheme = (scheme: i32): boolean =>
  scheme === TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 ||
  scheme === TLS_SIGNATURE_ECDSA_SECP384R1_SHA384 ||
  scheme === TLS_SIGNATURE_RSA_PSS_RSAE_SHA256 ||
  scheme === TLS_SIGNATURE_RSA_PSS_RSAE_SHA384 ||
  scheme === TLS_SIGNATURE_RSA_PSS_RSAE_SHA512

/**
 * Writes a ClientHello (§4.1.2) at `out[at]` and answers where it ends:
 * `random`, the `legacy_session_id` `sessionId`, the cipher suites `suites`,
 * null compression, then the extensions `server_name` (a `host_name`, left
 * out when `serverName` is empty), `supported_groups` (`groups`),
 * `signature_algorithms`, ALPN (left out when `alpn` is empty),
 * `supported_versions` (TLS 1.3 alone), a `key_share` with the one entry
 * `shareGroup`/`sharePublic`, and `cookie` when `cookie` is not empty (the
 * echo of a HelloRetryRequest's, §4.2.2).
 *
 * @param out The array to write into; a byte that would land outside it is dropped, so an empty one measures.
 * @param at Where the message, handshake header first, starts in `out`.
 * @param random The client's 32-byte `random` (§4.1.2), written as it is.
 * @param sessionId The `legacy_session_id`, 0 to 32 bytes; the client sends 32 for middlebox compatibility.
 * @param suites The cipher suites offered, in order of preference.
 * @param groups The groups `supported_groups` offers, in order of preference.
 * @param shareGroup The group of the one key share sent, such as `TLS_GROUP_X25519`.
 * @param sharePublic That share's public key, its `key_exchange`.
 * @param serverName The host name for `server_name`, ASCII; empty to leave the extension out.
 * @param alpn The ALPN protocols offered, one character a byte, in order; empty to leave ALPN out.
 * @param cookie A HelloRetryRequest's `cookie` to echo; empty to send none.
 * @returns Where the message ends in `out`: `at` plus its length, written or not; -1 when
 *   `at` is negative, a window is outside its buffer, or the end would pass 2^30 - 1.
 */
export const tlsWriteClientHello = (
  out: u8[],
  at: i32,
  random: u8[],
  sessionId: u8[],
  suites: i32[],
  groups: i32[],
  shareGroup: i32,
  sharePublic: u8[],
  serverName: string,
  alpn: string[],
  cookie: u8[]
): i32 => {
  let p: i32 = tlsPutU16(out, tlsAdvance(at, 4), TLS_LEGACY_VERSION)
  p = tlsPutBytes(out, p, random)
  p = tlsPutU8(out, p, toI32(sessionId.length))
  p = tlsPutBytes(out, p, sessionId)
  const suiteList: i32 = tlsAdvance(p, 2)
  p = suiteList
  for (const suite of suites) {
    p = tlsPutU16(out, p, suite)
  }
  p = tlsPutLength(out, suiteList, p, 2)
  p = tlsPutU8(out, tlsPutU8(out, p, 1), 0)
  const extensions: i32 = tlsAdvance(p, 2)
  p = extensions
  if (toI32(serverName.length) > 0) {
    p = tlsPutU16(out, p, TLS_EXT_SERVER_NAME)
    const body: i32 = tlsAdvance(p, 2)
    const list: i32 = tlsAdvance(body, 2)
    const name: i32 = tlsAdvance(tlsPutU8(out, list, 0), 2)
    p = tlsPutAscii(out, name, serverName)
    p = tlsPutLength(out, name, p, 2)
    p = tlsPutLength(out, list, p, 2)
    p = tlsPutLength(out, body, p, 2)
  }
  p = tlsPutU16(out, p, TLS_EXT_SUPPORTED_GROUPS)
  const groupsBody: i32 = tlsAdvance(p, 2)
  const groupList: i32 = tlsAdvance(groupsBody, 2)
  p = groupList
  for (const group of groups) {
    p = tlsPutU16(out, p, group)
  }
  p = tlsPutLength(out, groupList, p, 2)
  p = tlsPutLength(out, groupsBody, p, 2)
  p = tlsPutU16(out, p, TLS_EXT_SIGNATURE_ALGORITHMS)
  const schemesBody: i32 = tlsAdvance(p, 2)
  const schemeList: i32 = tlsAdvance(schemesBody, 2)
  p = tlsPutClientSchemes(out, schemeList)
  p = tlsPutLength(out, schemeList, p, 2)
  p = tlsPutLength(out, schemesBody, p, 2)
  if (toI32(alpn.length) > 0) {
    p = tlsPutU16(out, p, TLS_EXT_ALPN)
    const body: i32 = tlsAdvance(p, 2)
    const list: i32 = tlsAdvance(body, 2)
    p = list
    for (const protocol of alpn) {
      const name: i32 = tlsAdvance(p, 1)
      p = tlsPutAscii(out, name, protocol)
      p = tlsPutLength(out, name, p, 1)
    }
    p = tlsPutLength(out, list, p, 2)
    p = tlsPutLength(out, body, p, 2)
  }
  p = tlsPutU16(out, tlsPutU16(out, p, TLS_EXT_SUPPORTED_VERSIONS), 3)
  p = tlsPutU16(out, tlsPutU8(out, p, 2), TLS_VERSION_13)
  p = tlsPutU16(out, p, TLS_EXT_KEY_SHARE)
  const shareBody: i32 = tlsAdvance(p, 2)
  const shareList: i32 = tlsAdvance(shareBody, 2)
  const key: i32 = tlsAdvance(tlsPutU16(out, shareList, shareGroup), 2)
  p = tlsPutBytes(out, key, sharePublic)
  p = tlsPutLength(out, key, p, 2)
  p = tlsPutLength(out, shareList, p, 2)
  p = tlsPutLength(out, shareBody, p, 2)
  if (toI32(cookie.length) > 0) {
    p = tlsPutU16(out, p, TLS_EXT_COOKIE)
    const body: i32 = tlsAdvance(p, 2)
    const value: i32 = tlsAdvance(body, 2)
    p = tlsPutBytes(out, value, cookie)
    p = tlsPutLength(out, value, p, 2)
    p = tlsPutLength(out, body, p, 2)
  }
  p = tlsPutLength(out, extensions, p, 2)
  return tlsPutHeader(out, at, TLS_HANDSHAKE_CLIENT_HELLO, p)
}

/**
 * A ClientHello (§4.1.2) in a fresh array (`tlsWriteClientHello`).
 *
 * @param random The client's 32-byte `random` (§4.1.2), written as it is.
 * @param sessionId The `legacy_session_id`, 0 to 32 bytes; the client sends 32 for middlebox compatibility.
 * @param suites The cipher suites offered, in order of preference.
 * @param groups The groups `supported_groups` offers, in order of preference.
 * @param shareGroup The group of the one key share sent, such as `TLS_GROUP_X25519`.
 * @param sharePublic That share's public key, its `key_exchange`.
 * @param serverName The host name for `server_name`, ASCII; empty to leave the extension out.
 * @param alpn The ALPN protocols offered, one character a byte, in order; empty to leave ALPN out.
 * @param cookie A HelloRetryRequest's `cookie` to echo; empty to send none.
 * @returns The whole message, handshake header included; empty for one past 2^30 - 1 bytes.
 */
export const tlsEncodeClientHello = (
  random: u8[],
  sessionId: u8[],
  suites: i32[],
  groups: i32[],
  shareGroup: i32,
  sharePublic: u8[],
  serverName: string,
  alpn: string[],
  cookie: u8[]
): u8[] => {
  const none: u8[] = []
  const out: u8[] = tlsZeros(
    tlsWriteClientHello(
      none,
      TLS_CODEC_FROM,
      random,
      sessionId,
      suites,
      groups,
      shareGroup,
      sharePublic,
      serverName,
      alpn,
      cookie
    )
  )
  tlsWriteClientHello(
    out,
    TLS_CODEC_FROM,
    random,
    sessionId,
    suites,
    groups,
    shareGroup,
    sharePublic,
    serverName,
    alpn,
    cookie
  )
  return out
}

/**
 * One message of the server's flight as a `tlsRead*` function below read it:
 * a ServerHello or HelloRetryRequest, EncryptedExtensions, Certificate,
 * CertificateVerify or NewSessionTicket. Like `TlsClientHelloView` its fields
 * are windows into `data` and numbers, so a read allocates nothing; each read
 * forgets the last message first.
 *
 * Two verdicts, kept apart so the client can rank them. `alert` is the
 * structure's: `decode_error` for a length past its bytes, a vector out of
 * its bounds or bytes left over. `extensionAlert` is the extensions': an
 * extension sent twice, or one the client offered but this message may not
 * carry, is `illegal_parameter`; one the client never offers is
 * `unsupported_extension` (§4.2). The client reads the structure first, then
 * the version and the downgrade sentinel, then the extensions, so that a
 * TLS 1.2 ServerHello is refused for its version, not for the extensions a
 * TLS 1.2 server sends.
 */
export class TlsServerFlightView {
  /**
   * The buffer the windows point into: the one the last message was read from.
   *
   * @internal Read by `net/tls/client.ts`.
   */
  data: u8[]
  /**
   * One bit per extension type read, for the duplicate check (§4.2).
   *
   * @internal Read by the free functions of this module.
   */
  extensionSeen: u32[]
  /**
   * The reader each read runs, kept so that a read allocates none.
   *
   * @internal Read by the free functions of this module.
   */
  reader: TlsReader
  /** 0 when the message parsed, else `decode_error`. */
  alert: i32 = 0
  /** 0 when the extensions are ones this message may carry, else `illegal_parameter` or `unsupported_extension`. */
  extensionAlert: i32 = 0
  /** ServerHello's `legacy_version` as sent; a TLS 1.3 server sends 0x0303 and names 1.3 in `supported_versions` (§4.1.3). */
  legacyVersion: i32 = 0
  /** Where the server's 32-byte `random` starts in `data`; the client checks it for the downgrade sentinel (§4.1.3). */
  randomAt: i32 = 0
  /** `legacy_session_id_echo`, which must equal the session id the client sent (§4.1.3). */
  sessionIdAt: i32 = 0
  /** The echoed session id's length in bytes, 0 to 32. */
  sessionIdLength: i32 = 0
  /** The cipher suite the server chose, a 16-bit value. */
  suite: i32 = 0
  /** `legacy_compression_method`, which must be 0 (§4.1.3). */
  compression: i32 = 0
  /** `supported_versions`' `selected_version`, 0 when the extension was absent; 0x0304 for TLS 1.3. */
  selectedVersion: i32 = 0
  /** `key_share`: a ServerHello's entry, or a HelloRetryRequest's `selected_group` with an empty share. */
  shareGroup: i32 = 0
  /** Where the ServerHello's key_exchange starts in `data`. */
  shareAt: i32 = 0
  /** The key_exchange's length in bytes as sent, 0 for a HelloRetryRequest; an x25519 share is 32. */
  shareLength: i32 = 0
  /** A HelloRetryRequest's `cookie`, which the second ClientHello echoes (§4.2.2). */
  cookieAt: i32 = 0
  /** The cookie's length in bytes, 0 when none was sent. */
  cookieLength: i32 = 0
  /** EncryptedExtensions' ALPN: the one protocol the server chose (RFC 7301 §3.1). */
  alpnAt: i32 = 0
  /** The chosen protocol name's length in bytes, 0 when ALPN was absent. */
  alpnLength: i32 = 0
  /** Certificate's `certificate_request_context`, which must be empty for a server's (§4.4.2). */
  contextLength: i32 = 0
  /** Certificate's `certificate_list`, every entry in it, and how many there are. */
  certificatesAt: i32 = 0
  /** The `certificate_list` window's length in bytes. */
  certificatesLength: i32 = 0
  /** How many entries `certificate_list` holds; the first is the server's own certificate. */
  certificateCount: i32 = 0
  /** CertificateVerify's scheme and signature (§4.4.3). */
  scheme: i32 = 0
  /** Where CertificateVerify's signature starts in `data`. */
  signatureAt: i32 = 0
  /** The signature's length in bytes. */
  signatureLength: i32 = 0
  /** A ServerHello whose `random` is the HelloRetryRequest value (§4.1.3). */
  isRetry: boolean = false
  /** Whether the message carried `supported_versions`: a TLS 1.3 ServerHello must (§4.2.1). */
  hasSupportedVersions: boolean = false
  /** Whether the message carried `key_share`. */
  hasKeyShare: boolean = false
  /** Whether a HelloRetryRequest carried `cookie`. */
  hasCookie: boolean = false
  /** Whether EncryptedExtensions carried ALPN. */
  hasAlpn: boolean = false
  /** EncryptedExtensions' empty `server_name`, the acknowledgement of RFC 6066 §3. */
  serverNameAcknowledged: boolean = false

  /**
   * Makes an empty view, every window empty and every flag false, for the
   * `tlsRead*` functions to fill.
   */
  constructor() {
    this.data = []
    this.extensionSeen = new Array<u32>(TLS_U16_BITMAP_WORDS)
    this.reader = new TlsReader(this.data, TLS_CODEC_FROM, TLS_CODEC_FROM)
  }

  /**
   * Forgets the last message: every window empty, every flag down, the bitmap clear.
   *
   * @internal Read by the free functions of this module.
   */
  clear(): void {
    this.alert = 0
    this.extensionAlert = 0
    this.isRetry = false
    this.legacyVersion = 0
    this.randomAt = 0
    this.sessionIdAt = 0
    this.sessionIdLength = 0
    this.suite = 0
    this.compression = 0
    this.hasSupportedVersions = false
    this.selectedVersion = 0
    this.hasKeyShare = false
    this.shareGroup = 0
    this.shareAt = 0
    this.shareLength = 0
    this.hasCookie = false
    this.cookieAt = 0
    this.cookieLength = 0
    this.hasAlpn = false
    this.alpnAt = 0
    this.alpnLength = 0
    this.serverNameAcknowledged = false
    this.contextLength = 0
    this.certificatesAt = 0
    this.certificatesLength = 0
    this.certificateCount = 0
    this.scheme = 0
    this.signatureAt = 0
    this.signatureLength = 0
    for (let k: i32 = 0; k < toI32(this.extensionSeen.length); k++) {
      this.extensionSeen[k] = toU32(0)
    }
  }
}

/** Records `alert` as `view`'s extension verdict unless an earlier one is there. */
const tlsFlightRefuseExtension = (view: TlsServerFlightView, alert: i32): void => {
  if (view.extensionAlert === 0) {
    view.extensionAlert = alert
  }
}

/** Whether the client's hello ever offers extension `type`: what separates `illegal_parameter` from `unsupported_extension` (§4.2). */
const tlsClientOffersExtension = (type: i32): boolean =>
  type === TLS_EXT_SERVER_NAME ||
  type === TLS_EXT_SUPPORTED_GROUPS ||
  type === TLS_EXT_SIGNATURE_ALGORITHMS ||
  type === TLS_EXT_ALPN ||
  type === TLS_EXT_SUPPORTED_VERSIONS ||
  type === TLS_EXT_KEY_SHARE ||
  type === TLS_EXT_COOKIE

/**
 * `off + len`, the end of a window whose start and length are each in
 * `[0, 2^31 - 1]`; a sum past that wraps negative, which every reader refuses
 * as a position. The readers below call it only on a window `tlsFlightOpen`
 * has checked lies inside its buffer.
 */
const tlsWindowEnd = (off: i32, len: i32): i32 => toI32(toI64(off) + toI64(len))

/** Opens `view` on `data[off .. off + len)` and answers its reader, or `null` for a window outside `data` (`decode_error`). */
const tlsFlightOpen = (view: TlsServerFlightView, data: u8[], off: i32, len: i32): TlsReader | null => {
  view.clear()
  view.data = data
  if (off < 0 || len < 0 || off > toI32(data.length) - len) {
    view.alert = TLS_ALERT_DECODE_ERROR
    return null
  }
  const r: TlsReader = view.reader
  r.data = data
  r.at = off
  r.end = tlsWindowEnd(off, len)
  r.failed = false
  return r
}

/** Closes a read: a failed reader, or bytes left before `end`, is `decode_error`. */
const tlsFlightClose = (view: TlsServerFlightView, r: TlsReader, end: i32): void => {
  if (r.failed || r.at !== end) {
    view.alert = TLS_ALERT_DECODE_ERROR
  }
}

/**
 * Reads one ServerHello or HelloRetryRequest extension body, `r.at .. end`,
 * of type `type`, and judges whether it may be there: `key_share` and
 * `supported_versions` in either, `cookie` in a HelloRetryRequest alone
 * (§4.2's table).
 */
const tlsReadServerHelloExtension = (r: TlsReader, type: i32, end: i32, view: TlsServerFlightView): void => {
  if (type === TLS_EXT_SUPPORTED_VERSIONS) {
    view.hasSupportedVersions = true
    view.selectedVersion = tlsReadU16(r)
  } else if (type === TLS_EXT_KEY_SHARE) {
    view.hasKeyShare = true
    view.shareGroup = tlsReadU16(r)
    if (!view.isRetry) {
      const keyEnd: i32 = tlsReadVector(r, 2, 1, 65535)
      view.shareAt = r.at
      view.shareLength = tlsReadSpan(r, keyEnd)
      tlsReadSkipTo(r, keyEnd)
    }
  } else if (type === TLS_EXT_COOKIE && view.isRetry) {
    const cookieEnd: i32 = tlsReadVector(r, 2, 1, 65535)
    view.hasCookie = true
    view.cookieAt = r.at
    view.cookieLength = tlsReadSpan(r, cookieEnd)
    tlsReadSkipTo(r, cookieEnd)
  } else {
    tlsFlightRefuseExtension(
      view,
      tlsClientOffersExtension(type) ? TLS_ALERT_ILLEGAL_PARAMETER : TLS_ALERT_UNSUPPORTED_EXTENSION
    )
    tlsReadSkipTo(r, end)
  }
  if (r.at !== end) {
    r.failed = true
  }
}

/** Reads one EncryptedExtensions body (§4.3.1): ALPN, an empty `server_name` and `supported_groups` may be there. */
const tlsReadEncryptedExtension = (r: TlsReader, type: i32, end: i32, view: TlsServerFlightView): void => {
  if (type === TLS_EXT_ALPN) {
    // RFC 7301 §3.1: the server's list holds exactly one protocol.
    const listEnd: i32 = tlsReadVector(r, 2, 2, 65535)
    const nameEnd: i32 = tlsReadVector(r, 1, 1, 255)
    view.hasAlpn = true
    view.alpnAt = r.at
    view.alpnLength = tlsReadSpan(r, nameEnd)
    tlsReadSkipTo(r, nameEnd)
    if (!r.failed && nameEnd !== listEnd) {
      tlsFlightRefuseExtension(view, TLS_ALERT_ILLEGAL_PARAMETER)
      tlsReadSkipTo(r, listEnd)
    }
  } else if (type === TLS_EXT_SERVER_NAME) {
    // RFC 6066 §3: the acknowledgement's body is empty; the check below
    // refuses one with bytes in it.
    view.serverNameAcknowledged = true
  } else if (type === TLS_EXT_SUPPORTED_GROUPS) {
    // §4.2.7: the server's own preference, which the client may note and
    // this one does not; only its syntax is checked.
    tlsReadU16Vector(r, 2, 2, 65535)
  } else {
    tlsFlightRefuseExtension(
      view,
      tlsClientOffersExtension(type) ? TLS_ALERT_ILLEGAL_PARAMETER : TLS_ALERT_UNSUPPORTED_EXTENSION
    )
    tlsReadSkipTo(r, end)
  }
  if (r.at !== end) {
    r.failed = true
  }
}

/** Reads an extensions block, each body by `hello`'s reader: true for a ServerHello or HelloRetryRequest, false for EncryptedExtensions. */
const tlsReadServerExtensions = (r: TlsReader, view: TlsServerFlightView, hello: boolean): void => {
  const extensionsEnd: i32 = tlsReadVector(r, 2, 0, 65535)
  const messageEnd: i32 = tlsReadList(r, extensionsEnd)
  while (!r.failed && r.at < extensionsEnd) {
    const type: i32 = tlsReadU16(r)
    const bodyEnd: i32 = tlsReadVector(r, 2, 0, 65535)
    if (r.failed) {
      break
    }
    if (tlsMarkSeen(view.extensionSeen, type)) {
      tlsFlightRefuseExtension(view, TLS_ALERT_ILLEGAL_PARAMETER)
    }
    const outerEnd: i32 = tlsReadList(r, bodyEnd)
    if (hello) {
      tlsReadServerHelloExtension(r, type, bodyEnd, view)
    } else {
      tlsReadEncryptedExtension(r, type, bodyEnd, view)
    }
    r.end = outerEnd
  }
  r.end = messageEnd
}

/** Whether the bytes at `data[at]` are the ones the hex constant `text` spells. */
const tlsWindowIsHex = (data: u8[], at: i32, text: string): boolean => {
  const length: i32 = toI32(text.length) >> 1
  if (at < 0 || at > toI32(data.length) - length) {
    return false
  }
  const digits: i32 = toI32(text.length)
  for (let i: i32 = 1; i < digits; i++) {
    const k: i32 = toI32(toI64(at) + toI64(i >> 1))
    if ((i & 1) === 1 && k >= 0 && k < toI32(data.length)) {
      const hi: i32 = tlsHexNibble(toU8(text.charCodeAt(i - 1)))
      const lo: i32 = tlsHexNibble(toU8(text.charCodeAt(i)))
      if (toI32(data[k]) !== ((hi << 4) | lo)) {
        return false
      }
    }
  }
  return true
}

/**
 * Reads the ServerHello body `data[off .. off + len)` — without its handshake
 * header — into `view`, which tells a HelloRetryRequest from it by its
 * `random` (§4.1.3). An absent extensions block parses: it is how a TLS 1.2
 * or older server answers, which the client refuses for its version.
 *
 * @param view The view to read into, cleared first; its `alert` and `extensionAlert` are the verdicts.
 * @param data The buffer that holds the message, which the view's windows then point into.
 * @param off Where the ServerHello body starts in `data`, in bytes, just past the handshake header.
 * @param len How many bytes the body is, from `off`.
 */
export const tlsReadServerHello = (view: TlsServerFlightView, data: u8[], off: i32, len: i32): void => {
  const r: TlsReader | null = tlsFlightOpen(view, data, off, len)
  if (r === null) {
    return
  }
  view.legacyVersion = tlsReadU16(r)
  view.randomAt = r.at
  view.isRetry =
    tlsWindowIsHex(data, r.at, TLS_HELLO_RETRY_RANDOM) && tlsWindowLength(r.at, r.end) >= TLS_RANDOM_SIZE
  tlsReadSkipTo(r, tlsReadAhead(r, TLS_RANDOM_SIZE))
  const sessionEnd: i32 = tlsReadVector(r, 1, 0, 32)
  view.sessionIdAt = r.at
  view.sessionIdLength = tlsReadSpan(r, sessionEnd)
  tlsReadSkipTo(r, sessionEnd)
  view.suite = tlsReadU16(r)
  view.compression = tlsReadU8(r)
  if (!r.failed && r.at < tlsWindowEnd(off, len)) {
    tlsReadServerExtensions(r, view, true)
  }
  tlsFlightClose(view, r, tlsWindowEnd(off, len))
}

/** The 8 bytes RFC 8446 §4.1.3 has a TLS 1.3 server put at the end of its random when it negotiates TLS 1.2 or below. */
const TLS_DOWNGRADE_12: string = "444f574e47524401"
const TLS_DOWNGRADE_11: string = "444f574e47524400"

/**
 * Whether the ServerHello in `view` carries a downgrade sentinel in the last
 * 8 bytes of its random (§4.1.3), which a TLS 1.3 client must refuse with
 * `illegal_parameter`.
 *
 * @param view A view `tlsReadServerHello` has just read into.
 * @returns true when the random ends in the TLS 1.2 or the TLS 1.1 sentinel.
 */
export const tlsServerHelloDowngrade = (view: TlsServerFlightView): boolean => {
  // A wrapped sum is negative, which `tlsWindowIsHex` answers false for.
  const at: i32 = toI32(toI64(view.randomAt) + toI64(TLS_RANDOM_SIZE - 8))
  return tlsWindowIsHex(view.data, at, TLS_DOWNGRADE_12) || tlsWindowIsHex(view.data, at, TLS_DOWNGRADE_11)
}

/**
 * Reads an EncryptedExtensions body (§4.3.1) into `view`: ALPN, an empty
 * `server_name` and `supported_groups` may be there, and any other extension
 * sets `extensionAlert`.
 *
 * @param view The view to read into, cleared first; its `alert` and `extensionAlert` are the verdicts.
 * @param data The buffer that holds the message, which the view's windows then point into.
 * @param off Where the EncryptedExtensions body starts in `data`, in bytes, just past the handshake header.
 * @param len How many bytes the body is, from `off`.
 */
export const tlsReadEncryptedExtensions = (
  view: TlsServerFlightView,
  data: u8[],
  off: i32,
  len: i32
): void => {
  const r: TlsReader | null = tlsFlightOpen(view, data, off, len)
  if (r === null) {
    return
  }
  tlsReadServerExtensions(r, view, false)
  tlsFlightClose(view, r, tlsWindowEnd(off, len))
}

/**
 * Reads a server's Certificate body (§4.4.2) into `view`: the request
 * context's length, which the client requires to be 0, and the list of
 * entries. An empty list is `decode_error`, as §4.4.2.4 has a client answer
 * it; an entry with extensions is `unsupported_extension`, because the
 * client offers none that a CertificateEntry may carry.
 *
 * @param view The view to read into, cleared first; its `alert` and `extensionAlert` are the verdicts.
 * @param data The buffer that holds the message, which the view's windows then point into.
 * @param off Where the Certificate body starts in `data`, in bytes, just past the handshake header.
 * @param len How many bytes the body is, from `off`.
 */
export const tlsReadCertificate = (view: TlsServerFlightView, data: u8[], off: i32, len: i32): void => {
  const r: TlsReader | null = tlsFlightOpen(view, data, off, len)
  if (r === null) {
    return
  }
  const contextEnd: i32 = tlsReadVector(r, 1, 0, 255)
  view.contextLength = tlsReadSpan(r, contextEnd)
  tlsReadSkipTo(r, contextEnd)
  const listEnd: i32 = tlsReadVector(r, 3, 1, 16777215)
  view.certificatesAt = r.at
  view.certificatesLength = tlsReadSpan(r, listEnd)
  const messageEnd: i32 = tlsReadList(r, listEnd)
  // Each entry is at least 6 bytes of a list of at most 2^24 - 1, so the
  // count's bound never ends the walk.
  let count: i32 = 0
  while (!r.failed && r.at < listEnd && count < 16777215) {
    tlsReadSkipTo(r, tlsReadVector(r, 3, 1, 16777215))
    const extensionsEnd: i32 = tlsReadVector(r, 2, 0, 65535)
    if (extensionsEnd !== r.at) {
      tlsFlightRefuseExtension(view, TLS_ALERT_UNSUPPORTED_EXTENSION)
    }
    tlsReadSkipTo(r, extensionsEnd)
    count++
  }
  view.certificateCount = count
  r.end = messageEnd
  tlsFlightClose(view, r, tlsWindowEnd(off, len))
}

/**
 * Reads a CertificateVerify body (§4.4.3) into `view`: the scheme and the
 * signature, neither of them checked here.
 *
 * @param view The view to read into, cleared first; its `alert` and `extensionAlert` are the verdicts.
 * @param data The buffer that holds the message, which the view's windows then point into.
 * @param off Where the CertificateVerify body starts in `data`, in bytes, just past the handshake header.
 * @param len How many bytes the body is, from `off`.
 */
export const tlsReadCertificateVerify = (view: TlsServerFlightView, data: u8[], off: i32, len: i32): void => {
  const r: TlsReader | null = tlsFlightOpen(view, data, off, len)
  if (r === null) {
    return
  }
  view.scheme = tlsReadU16(r)
  const signatureEnd: i32 = tlsReadVector(r, 2, 1, 65535)
  view.signatureAt = r.at
  view.signatureLength = tlsReadSpan(r, signatureEnd)
  tlsReadSkipTo(r, signatureEnd)
  tlsFlightClose(view, r, tlsWindowEnd(off, len))
}

/**
 * Checks a NewSessionTicket body's structure (§4.6.1) into `view`'s `alert`:
 * the client keeps no tickets, so it reads one only to discard it, but a
 * malformed one is still `decode_error`.
 *
 * @param view The view to read into, cleared first; its `alert` and `extensionAlert` are the verdicts.
 * @param data The buffer that holds the message, which the view's windows then point into.
 * @param off Where the NewSessionTicket body starts in `data`, in bytes, just past the handshake header.
 * @param len How many bytes the body is, from `off`.
 */
export const tlsReadNewSessionTicket = (view: TlsServerFlightView, data: u8[], off: i32, len: i32): void => {
  const r: TlsReader | null = tlsFlightOpen(view, data, off, len)
  if (r === null) {
    return
  }
  tlsReadSkipTo(r, tlsReadAhead(r, 8))
  tlsReadSkipTo(r, tlsReadVector(r, 1, 0, 255))
  tlsReadSkipTo(r, tlsReadVector(r, 2, 1, 65535))
  tlsReadSkipTo(r, tlsReadVector(r, 2, 0, 65534))
  tlsFlightClose(view, r, tlsWindowEnd(off, len))
}

/**
 * The DER certificates of the Certificate `tlsReadCertificate` last read into
 * `view`, leaf first, each a fresh array.
 *
 * @param view A view `tlsReadCertificate` has just read into.
 * @returns The chain, copied out of `view.data`; empty if the read failed or another message was read since.
 */
export const tlsCopyCertificates = (view: TlsServerFlightView): u8[][] => {
  const chain: u8[][] = []
  const r: TlsReader = new TlsReader(
    view.data,
    view.certificatesAt,
    tlsWindowEnd(view.certificatesAt, view.certificatesLength)
  )
  while (view.alert === 0 && !r.failed && r.at < r.end) {
    const certificateEnd: i32 = tlsReadVector(r, 3, 1, 16777215)
    chain.push(tlsCopyWindow(view.data, r.at, tlsReadSpan(r, certificateEnd)))
    tlsReadSkipTo(r, certificateEnd)
    tlsReadSkipTo(r, tlsReadVector(r, 2, 0, 65535))
  }
  return chain
}
