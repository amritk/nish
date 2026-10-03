/**
 * `nish/net/tls/codec` — the TLS 1.3 handshake messages a server reads and
 * writes (RFC 8446 §4), as bytes.
 *
 * One reader and six writers. `tlsParseClientHello` reads a ClientHello body
 * into a `TlsClientHello`, checking its structure: every length against the
 * bytes it claims, every vector against its RFC 8446 bounds, and no extension
 * twice (§4.2). A message that breaks one answers the alert a server sends for
 * it in the hello's `alert` field (`decode_error` for a malformed or truncated
 * one, `illegal_parameter` for a duplicate), never a panic, since every byte
 * of it is the peer's. What the fields *mean* — which version, which suite,
 * whether a share is missing — is the server's to decide, in `nish/net/tls`.
 *
 * The writers each answer one whole handshake message, header included:
 * ServerHello, HelloRetryRequest, EncryptedExtensions, Certificate,
 * CertificateVerify and Finished. Their inputs come from the server and the
 * caller's configuration rather than from the peer, so they check nothing.
 *
 * The extensions read are `server_name` (RFC 6066 §3), `supported_groups`,
 * `signature_algorithms`, `supported_versions` and `key_share` (RFC 8446
 * §4.2), `application_layer_protocol_negotiation` (RFC 7301 §3.1) and
 * `quic_transport_parameters` (RFC 9001 §8.2). Every other extension is
 * skipped, which is what RFC 8446 §4.2 asks of a server that does not know it.
 *
 * Written from the RFCs, not ported from another implementation. Private
 * names carry the `tls` prefix because a `std/` module's private functions
 * share the importing program's flat symbol namespace (`docs/wp26-stdlib.md`
 * §3e).
 */

// ---- Handshake message types (RFC 8446 §4) --------------------------------

export const TLS_HANDSHAKE_CLIENT_HELLO: i32 = 1
export const TLS_HANDSHAKE_SERVER_HELLO: i32 = 2
export const TLS_HANDSHAKE_ENCRYPTED_EXTENSIONS: i32 = 8
export const TLS_HANDSHAKE_CERTIFICATE: i32 = 11
export const TLS_HANDSHAKE_CERTIFICATE_VERIFY: i32 = 15
export const TLS_HANDSHAKE_FINISHED: i32 = 20
/** The synthetic message a HelloRetryRequest puts in the transcript in place of the first ClientHello (§4.4.1). */
export const TLS_HANDSHAKE_MESSAGE_HASH: i32 = 254

// ---- Extension types (RFC 8446 §4.2, RFC 7301, RFC 9001) ------------------

export const TLS_EXT_SERVER_NAME: i32 = 0
/** `pre_shared_key` (§4.2.11): ignored here, but it must be the last extension. */
export const TLS_EXT_PRE_SHARED_KEY: i32 = 41
export const TLS_EXT_SUPPORTED_GROUPS: i32 = 10
export const TLS_EXT_SIGNATURE_ALGORITHMS: i32 = 13
export const TLS_EXT_ALPN: i32 = 16
export const TLS_EXT_SUPPORTED_VERSIONS: i32 = 43
export const TLS_EXT_KEY_SHARE: i32 = 51
export const TLS_EXT_QUIC_TRANSPORT_PARAMETERS: i32 = 57

// ---- Versions, groups and signature schemes -------------------------------

/** `legacy_version` in every TLS 1.3 hello (§4.1.2). */
export const TLS_LEGACY_VERSION: i32 = 0x0303
/** TLS 1.3 in `supported_versions` (§4.2.1). */
export const TLS_VERSION_13: i32 = 0x0304
/** x25519 (§4.2.7), the one group `nish/net/tls` agrees to. */
export const TLS_GROUP_X25519: i32 = 0x001d
/** The length of an x25519 key share (RFC 8446 §4.2.8.2). */
export const TLS_X25519_SHARE_SIZE: i32 = 32
/** `ecdsa_secp256r1_sha256` (§4.2.3), what a production server signs with. */
export const TLS_SIGNATURE_ECDSA_SECP256R1_SHA256: i32 = 0x0403
/** `rsa_pss_rsae_sha256` (§4.2.3), what RFC 8448's server signs with. */
export const TLS_SIGNATURE_RSA_PSS_RSAE_SHA256: i32 = 0x0804

// ---- Alert descriptions (RFC 8446 §6) --------------------------------------

/** A message arrived that the handshake's state does not allow. */
export const TLS_ALERT_UNEXPECTED_MESSAGE: i32 = 10
/** No acceptable set of parameters: no common suite, group or signature scheme. */
export const TLS_ALERT_HANDSHAKE_FAILURE: i32 = 40
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
  data: u8[]
  at: i32
  end: i32
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
  if (r.failed || n < min || n > max || n > r.end - r.at) {
    r.failed = true
    return r.at
  }
  return r.at + n
}

/** The next `n` bytes, copied; failing (and answering an empty array) when fewer remain. */
const tlsReadBytes = (r: TlsReader, n: i32): u8[] => {
  const out: u8[] = []
  if (r.failed || n < 0 || n > r.end - r.at) {
    r.failed = true
    return out
  }
  for (let k: i32 = 0; k < n; k++) {
    out.push(toU8(tlsReadU8(r)))
  }
  return out
}

/** Moves to `to`, the end of a vector this reader opened. */
const tlsReadSkipTo = (r: TlsReader, to: i32): void => {
  if (to < r.at || to > r.end) {
    r.failed = true
    return
  }
  r.at = to
}

/**
 * A ClientHello as `tlsParseClientHello` read it (RFC 8446 §4.1.2). A field
 * whose extension was absent keeps its empty value, and its `has*` flag says
 * so, since an empty list and a missing extension mean different things to
 * the server (§9.2).
 */
export class TlsClientHello {
  random: u8[]
  /** `legacy_session_id`, which a server echoes (§4.1.3). */
  sessionId: u8[]
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
  /** Every extension type read, for the duplicate check. */
  extensionTypes: i32[]
  /** 0 when the message parsed, or the alert it earns: `decode_error` or `illegal_parameter`. */
  alert: i32 = 0
  legacyVersion: i32 = 0
  /** Whether `legacy_compression_methods` is the single null method TLS 1.3 requires (§4.1.2). */
  nullCompressionOnly: boolean = false
  hasSupportedVersions: boolean = false
  hasSupportedGroups: boolean = false
  hasKeyShare: boolean = false
  hasX25519Share: boolean = false
  hasSignatureAlgorithms: boolean = false
  hasServerName: boolean = false
  hasAlpn: boolean = false
  hasQuicTransportParameters: boolean = false

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
  }
}

/** Records `alert` on `hello` unless an earlier one is there: the first fault is the one reported. */
const tlsHelloRefuse = (hello: TlsClientHello, alert: i32): void => {
  if (hello.alert === 0) {
    hello.alert = alert
  }
}

/**
 * Reads a vector of 16-bit values (a `width`-byte length within `[min, max]`)
 * into `out`; an odd byte count fails the reader.
 */
const tlsReadU16Vector = (r: TlsReader, width: i32, min: i32, max: i32, out: i32[]): void => {
  const end: i32 = tlsReadVector(r, width, min, max)
  if ((end - r.at) % 2 !== 0) {
    r.failed = true
    return
  }
  while (!r.failed && r.at < end) {
    out.push(tlsReadU16(r))
  }
}

/** Whether `list` holds `value`. */
export const tlsListHas = (list: i32[], value: i32): boolean => list.indexOf(value) >= 0

/**
 * `server_name` (RFC 6066 §3): a list of names, of which a `host_name` (type
 * 0) is kept. A second `host_name` is `illegal_parameter`, as §3 says. So is a
 * host name with a byte outside printable ASCII, because a DNS host name sent
 * here is ASCII (an internationalised one in its A-label form) and the server
 * exposes it as a string.
 */
const tlsReadServerName = (r: TlsReader, hello: TlsClientHello): void => {
  const listEnd: i32 = tlsReadVector(r, 2, 1, 65535)
  while (!r.failed && r.at < listEnd) {
    const nameType: i32 = tlsReadU8(r)
    const nameEnd: i32 = tlsReadVector(r, 2, 1, 65535)
    if (nameType === 0) {
      if (hello.hasServerName) {
        tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
      }
      hello.hasServerName = true
      const parts: string[] = []
      while (!r.failed && r.at < nameEnd) {
        const c: i32 = tlsReadU8(r)
        if (c < 0x21 || c > 0x7e) {
          tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
        }
        parts.push(String.fromCharCode(c))
      }
      hello.serverName = parts.join("")
    }
    tlsReadSkipTo(r, nameEnd)
  }
}

/**
 * `key_share` (RFC 8446 §4.2.8): the client's shares, each a group and its
 * key_exchange<1..2^16-1>. Two shares for one group are `illegal_parameter`
 * (§4.2.8, "Clients MUST NOT offer multiple KeyShareEntry values for the same
 * group").
 */
const tlsReadKeyShare = (r: TlsReader, hello: TlsClientHello): void => {
  hello.hasKeyShare = true
  const listEnd: i32 = tlsReadVector(r, 2, 0, 65535)
  while (!r.failed && r.at < listEnd) {
    const group: i32 = tlsReadU16(r)
    const shareEnd: i32 = tlsReadVector(r, 2, 1, 65535)
    if (tlsListHas(hello.shareGroups, group)) {
      tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
    }
    hello.shareGroups.push(group)
    if (group === TLS_GROUP_X25519) {
      hello.hasX25519Share = true
      hello.x25519Share = tlsReadBytes(r, shareEnd - r.at)
    }
    tlsReadSkipTo(r, shareEnd)
  }
}

/** `application_layer_protocol_negotiation` (RFC 7301 §3.1): ProtocolName<1..2^8-1> names in a list<2..2^16-1>. */
const tlsReadAlpn = (r: TlsReader, hello: TlsClientHello): void => {
  hello.hasAlpn = true
  const listEnd: i32 = tlsReadVector(r, 2, 2, 65535)
  while (!r.failed && r.at < listEnd) {
    const nameEnd: i32 = tlsReadVector(r, 1, 1, 255)
    hello.alpn.push(tlsReadBytes(r, nameEnd - r.at))
  }
}

/** Reads one extension body, `r.at .. end`, of type `type`; an unknown type is skipped. */
const tlsReadExtension = (r: TlsReader, type: i32, end: i32, hello: TlsClientHello): void => {
  switch (type) {
    case TLS_EXT_SERVER_NAME:
      tlsReadServerName(r, hello)
      break
    case TLS_EXT_SUPPORTED_GROUPS:
      hello.hasSupportedGroups = true
      tlsReadU16Vector(r, 2, 2, 65535, hello.groups)
      break
    case TLS_EXT_SIGNATURE_ALGORITHMS:
      hello.hasSignatureAlgorithms = true
      tlsReadU16Vector(r, 2, 2, 65534, hello.signatureSchemes)
      break
    case TLS_EXT_ALPN:
      tlsReadAlpn(r, hello)
      break
    case TLS_EXT_SUPPORTED_VERSIONS:
      hello.hasSupportedVersions = true
      tlsReadU16Vector(r, 1, 2, 254, hello.versions)
      break
    case TLS_EXT_KEY_SHARE:
      tlsReadKeyShare(r, hello)
      break
    case TLS_EXT_QUIC_TRANSPORT_PARAMETERS:
      hello.hasQuicTransportParameters = true
      hello.quicTransportParameters = tlsReadBytes(r, end - r.at)
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
 * Reads the ClientHello body `data[off .. off + len)` — the message without
 * its four-byte handshake header — into a fresh `TlsClientHello`. Its `alert`
 * is 0 when the body parsed; otherwise the first fault decides it:
 * `decode_error` for a length past its bytes, a vector out of its bounds or
 * bytes left over, and `illegal_parameter` for an extension sent twice (§4.2),
 * a `pre_shared_key` that is not the last extension (§4.2.11),
 * two shares for one group, or a bad `server_name`. A window outside `data`
 * is `decode_error` too, rather than a panic.
 */
export const tlsParseClientHello = (data: u8[], off: i32, len: i32): TlsClientHello => {
  const hello = new TlsClientHello()
  if (off < 0 || len < 0 || off > toI32(data.length) - len) {
    hello.alert = TLS_ALERT_DECODE_ERROR
    return hello
  }
  const end: i32 = off + len
  const r = new TlsReader(data, off, end)
  hello.legacyVersion = tlsReadU16(r)
  hello.random = tlsReadBytes(r, TLS_RANDOM_SIZE)
  const sessionEnd: i32 = tlsReadVector(r, 1, 0, 32)
  hello.sessionId = tlsReadBytes(r, sessionEnd - r.at)
  tlsReadU16Vector(r, 2, 2, 65534, hello.cipherSuites)
  const compressionEnd: i32 = tlsReadVector(r, 1, 1, 255)
  hello.nullCompressionOnly = compressionEnd - r.at === 1 && tlsReadU8(r) === 0
  tlsReadSkipTo(r, compressionEnd)
  // A hello with no extensions block is well formed (§4.1.2 keeps it for
  // TLS 1.2 and earlier); it offers no TLS 1.3, which the server refuses.
  if (!r.failed && r.at < end) {
    const extensionsEnd: i32 = tlsReadVector(r, 2, 0, 65535)
    // The extensions vector's own end bounds every extension in it: one whose
    // length runs past it is malformed even when the message's length still
    // balances.
    const messageEnd: i32 = r.end
    r.end = extensionsEnd
    while (!r.failed && r.at < extensionsEnd) {
      const type: i32 = tlsReadU16(r)
      const bodyEnd: i32 = tlsReadVector(r, 2, 0, 65535)
      if (r.failed) {
        break
      }
      if (tlsListHas(hello.extensionTypes, type)) {
        tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
      }
      // §4.2.11: `pre_shared_key` must be the last extension, and a server
      // checks that even though it does not take the PSK.
      if (type === TLS_EXT_PRE_SHARED_KEY && bodyEnd !== extensionsEnd) {
        tlsHelloRefuse(hello, TLS_ALERT_ILLEGAL_PARAMETER)
      }
      hello.extensionTypes.push(type)
      // The extension's own end bounds every read inside it, so a vector in
      // one extension cannot run on into the next.
      const outerEnd: i32 = r.end
      r.end = bodyEnd
      tlsReadExtension(r, type, bodyEnd, hello)
      r.end = outerEnd
    }
    r.end = messageEnd
  }
  if (r.failed || r.at !== end) {
    tlsHelloRefuse(hello, TLS_ALERT_DECODE_ERROR)
  }
  return hello
}

/**
 * A handshake message under construction, for the `tlsPut*` functions below:
 * big-endian integers, raw bytes, and vectors whose length prefix is written
 * once their contents are. Functions rather than methods, as the reader's are.
 */
class TlsWriter {
  out: u8[]

  constructor() {
    this.out = []
  }
}

const tlsPutU8 = (w: TlsWriter, v: i32): void => {
  w.out.push(toU8(v & 255))
}

const tlsPutU16 = (w: TlsWriter, v: i32): void => {
  tlsPutU8(w, v >> 8)
  tlsPutU8(w, v)
}

const tlsPutBytes = (w: TlsWriter, b: u8[]): void => {
  for (const x of b) {
    w.out.push(x)
  }
}

/** Opens a vector with a `width`-byte length prefix, answering where its contents start. */
const tlsPutOpen = (w: TlsWriter, width: i32): i32 => {
  for (let k: i32 = 0; k < width; k++) {
    w.out.push(toU8(0))
  }
  return toI32(w.out.length)
}

/** Writes the length of the vector `tlsPutOpen(w, width)` started at `start`, now that its contents are in. */
const tlsPutClose = (w: TlsWriter, start: i32, width: i32): void => {
  let n: i32 = toI32(w.out.length) - start
  for (let at: i32 = start - 1; at >= start - width; at--) {
    if (at >= 0 && at < toI32(w.out.length)) {
      w.out[at] = toU8(n & 255)
    }
    n = n >> 8
  }
}

/** Starts a handshake message of `type` (§4): the type, then a 24-bit length `tlsFinishMessage` fills in. */
const tlsStartMessage = (type: i32): TlsWriter => {
  const w = new TlsWriter()
  tlsPutU8(w, type)
  tlsPutOpen(w, 3)
  return w
}

/** Writes the length of the message `tlsStartMessage` began, and answers its bytes. */
const tlsFinishMessage = (w: TlsWriter): u8[] => {
  tlsPutClose(w, 4, 3)
  return w.out
}

/** The fixed `random` that marks a ServerHello as a HelloRetryRequest: SHA-256 of "HelloRetryRequest" (§4.1.3). */
const tlsHelloRetryRandom = (): u8[] => [
  toU8(0xcf),
  toU8(0x21),
  toU8(0xad),
  toU8(0x74),
  toU8(0xe5),
  toU8(0x9a),
  toU8(0x61),
  toU8(0x11),
  toU8(0xbe),
  toU8(0x1d),
  toU8(0x8c),
  toU8(0x02),
  toU8(0x1e),
  toU8(0x65),
  toU8(0xb8),
  toU8(0x91),
  toU8(0xc2),
  toU8(0xa2),
  toU8(0x11),
  toU8(0x16),
  toU8(0x7a),
  toU8(0xbb),
  toU8(0x8c),
  toU8(0x5e),
  toU8(0x07),
  toU8(0x9e),
  toU8(0x09),
  toU8(0xe2),
  toU8(0xc8),
  toU8(0xa8),
  toU8(0x33),
  toU8(0x9c),
]

/** The `supported_versions` a server hello carries: TLS 1.3 alone (§4.2.1). */
const tlsWriteSelectedVersion = (w: TlsWriter): void => {
  tlsPutU16(w, TLS_EXT_SUPPORTED_VERSIONS)
  tlsPutU16(w, 2)
  tlsPutU16(w, TLS_VERSION_13)
}

/**
 * What a ServerHello and a HelloRetryRequest open with (§4.1.3): the legacy
 * version, `random`, the echoed session id, the suite and null compression.
 */
const tlsWriteHelloHead = (w: TlsWriter, random: u8[], sessionId: u8[], suite: i32): void => {
  tlsPutU16(w, TLS_LEGACY_VERSION)
  tlsPutBytes(w, random)
  const session: i32 = tlsPutOpen(w, 1)
  tlsPutBytes(w, sessionId)
  tlsPutClose(w, session, 1)
  tlsPutU16(w, suite)
  tlsPutU8(w, 0)
}

/**
 * A ServerHello (§4.1.3) choosing `suite` and TLS 1.3, echoing the client's
 * `sessionId`, and carrying the server's x25519 share. The extensions are
 * `key_share` then `supported_versions`, the order RFC 8448 §3 shows.
 */
export const tlsEncodeServerHello = (random: u8[], sessionId: u8[], suite: i32, x25519Public: u8[]): u8[] => {
  const w = tlsStartMessage(TLS_HANDSHAKE_SERVER_HELLO)
  tlsWriteHelloHead(w, random, sessionId, suite)
  const extensions: i32 = tlsPutOpen(w, 2)
  tlsPutU16(w, TLS_EXT_KEY_SHARE)
  const share: i32 = tlsPutOpen(w, 2)
  tlsPutU16(w, TLS_GROUP_X25519)
  const key: i32 = tlsPutOpen(w, 2)
  tlsPutBytes(w, x25519Public)
  tlsPutClose(w, key, 2)
  tlsPutClose(w, share, 2)
  tlsWriteSelectedVersion(w)
  tlsPutClose(w, extensions, 2)
  return tlsFinishMessage(w)
}

/**
 * A HelloRetryRequest (§4.1.4): a ServerHello whose `random` is the fixed
 * HelloRetryRequest value, choosing `suite`, echoing `sessionId`, and asking
 * for a share of `group` in `key_share`. No cookie is sent.
 */
export const tlsEncodeHelloRetryRequest = (sessionId: u8[], suite: i32, group: i32): u8[] => {
  const w = tlsStartMessage(TLS_HANDSHAKE_SERVER_HELLO)
  tlsWriteHelloHead(w, tlsHelloRetryRandom(), sessionId, suite)
  const extensions: i32 = tlsPutOpen(w, 2)
  tlsPutU16(w, TLS_EXT_KEY_SHARE)
  tlsPutU16(w, 2)
  tlsPutU16(w, group)
  tlsWriteSelectedVersion(w)
  tlsPutClose(w, extensions, 2)
  return tlsFinishMessage(w)
}

/**
 * EncryptedExtensions (§4.3.1). `extra` is extensions the caller encodes
 * itself, written first and as they are; then the chosen ALPN protocol when
 * `alpn` is not empty (RFC 7301 §3.1, a list of exactly one), an empty
 * `server_name` when `acknowledgeServerName` (RFC 6066 §3's acknowledgement),
 * and the server's `quic_transport_parameters` when `quicTransportParameters`
 * is not `null`.
 */
export const tlsEncodeEncryptedExtensions = (
  extra: u8[],
  alpn: u8[],
  acknowledgeServerName: boolean,
  quicTransportParameters: u8[] | null
): u8[] => {
  const w = tlsStartMessage(TLS_HANDSHAKE_ENCRYPTED_EXTENSIONS)
  const extensions: i32 = tlsPutOpen(w, 2)
  tlsPutBytes(w, extra)
  if (toI32(alpn.length) > 0) {
    tlsPutU16(w, TLS_EXT_ALPN)
    const body: i32 = tlsPutOpen(w, 2)
    const list: i32 = tlsPutOpen(w, 2)
    const name: i32 = tlsPutOpen(w, 1)
    tlsPutBytes(w, alpn)
    tlsPutClose(w, name, 1)
    tlsPutClose(w, list, 2)
    tlsPutClose(w, body, 2)
  }
  if (acknowledgeServerName) {
    tlsPutU16(w, TLS_EXT_SERVER_NAME)
    tlsPutU16(w, 0)
  }
  if (quicTransportParameters !== null) {
    tlsPutU16(w, TLS_EXT_QUIC_TRANSPORT_PARAMETERS)
    const body: i32 = tlsPutOpen(w, 2)
    tlsPutBytes(w, quicTransportParameters)
    tlsPutClose(w, body, 2)
  }
  tlsPutClose(w, extensions, 2)
  return tlsFinishMessage(w)
}

/**
 * A server's Certificate (§4.4.2): an empty request context, then each DER
 * certificate of `chain`, leaf first, with no extensions of its own.
 */
export const tlsEncodeCertificate = (chain: u8[][]): u8[] => {
  const w = tlsStartMessage(TLS_HANDSHAKE_CERTIFICATE)
  tlsPutU8(w, 0)
  const list: i32 = tlsPutOpen(w, 3)
  for (const certificate of chain) {
    const entry: i32 = tlsPutOpen(w, 3)
    tlsPutBytes(w, certificate)
    tlsPutClose(w, entry, 3)
    tlsPutU16(w, 0)
  }
  tlsPutClose(w, list, 3)
  return tlsFinishMessage(w)
}

/** A CertificateVerify (§4.4.3): the signature scheme and the signature as it goes on the wire. */
export const tlsEncodeCertificateVerify = (scheme: i32, signature: u8[]): u8[] => {
  const w = tlsStartMessage(TLS_HANDSHAKE_CERTIFICATE_VERIFY)
  tlsPutU16(w, scheme)
  const body: i32 = tlsPutOpen(w, 2)
  tlsPutBytes(w, signature)
  tlsPutClose(w, body, 2)
  return tlsFinishMessage(w)
}

/** A Finished (§4.4.4) carrying `verifyData`. */
export const tlsEncodeFinished = (verifyData: u8[]): u8[] => {
  const w = tlsStartMessage(TLS_HANDSHAKE_FINISHED)
  tlsPutBytes(w, verifyData)
  return tlsFinishMessage(w)
}

/**
 * What a server's CertificateVerify signs (§4.4.3): 64 spaces, the context
 * string "TLS 1.3, server CertificateVerify", a zero byte, and the transcript
 * hash through Certificate.
 */
export const tlsCertificateVerifyContent = (transcriptHash: u8[]): u8[] => {
  const out: u8[] = []
  for (let k: i32 = 0; k < 64; k++) {
    out.push(toU8(0x20))
  }
  const context: string = "TLS 1.3, server CertificateVerify"
  const contextLength: i32 = toI32(context.length)
  for (let k: i32 = 0; k < contextLength; k++) {
    out.push(toU8(context.charCodeAt(k)))
  }
  out.push(toU8(TLS_CODEC_FROM))
  for (const b of transcriptHash) {
    out.push(b)
  }
  return out
}
