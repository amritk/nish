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
 * `tlsReadClientHello` is the same reader for a server that keeps its state
 * in a slot: it reads into a `TlsClientHelloView` made once, whose fields are
 * windows into the message rather than copies of it, so a ClientHello read
 * allocates nothing, and `tlsParseClientHello` copies a view's windows out.
 *
 * The writers each answer one whole handshake message, header included:
 * ServerHello, HelloRetryRequest, EncryptedExtensions, Certificate,
 * CertificateVerify and Finished. Their inputs come from the server and the
 * caller's configuration rather than from the peer, so they check nothing.
 * Each is a `tlsWrite*` function that writes into the caller's array at an
 * offset — run over an empty array, it measures — and a `tlsEncode*` one
 * that answers the message in a fresh array.
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
  /** The buffer the windows point into: the one the last hello was read from. */
  data: u8[]
  /** 0 when the message parsed, or the alert it earns: `decode_error` or `illegal_parameter`. */
  alert: i32 = 0
  legacyVersion: i32 = 0
  randomAt: i32 = 0
  /** `legacy_session_id`, which a server echoes (§4.1.3). */
  sessionIdAt: i32 = 0
  sessionIdLength: i32 = 0
  /** `cipher_suites`, 16-bit values in the client's order. */
  suitesAt: i32 = 0
  suitesLength: i32 = 0
  /** `supported_versions`, 16-bit values. */
  versionsAt: i32 = 0
  versionsLength: i32 = 0
  /** `supported_groups`, 16-bit values. */
  groupsAt: i32 = 0
  groupsLength: i32 = 0
  /** `signature_algorithms`, 16-bit values. */
  schemesAt: i32 = 0
  schemesLength: i32 = 0
  /** The `client_shares` list of `key_share`, every entry in it. */
  sharesAt: i32 = 0
  sharesLength: i32 = 0
  /** The x25519 share's key_exchange, as sent; its length is the server's to check. */
  x25519ShareAt: i32 = 0
  x25519ShareLength: i32 = 0
  /** The `host_name` of `server_name`, or empty. */
  serverNameAt: i32 = 0
  serverNameLength: i32 = 0
  /** ALPN's `protocol_name_list`, each name a length byte and its bytes (RFC 7301 §3.1). */
  alpnAt: i32 = 0
  alpnLength: i32 = 0
  /** The client's `quic_transport_parameters`, opaque (RFC 9001 §8.2). */
  quicAt: i32 = 0
  quicLength: i32 = 0
  /** The extensions block, every extension in it. */
  extensionsAt: i32 = 0
  extensionsLength: i32 = 0
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
  /** One bit per extension type read, for the duplicate check (§4.2); cleared by each read. */
  extensionSeen: u32[]
  /** One bit per group a share was offered for, for the duplicate check (§4.2.8). */
  shareSeen: u32[]
  /** The reader each read runs, kept so that a read allocates none. */
  reader: TlsReader

  constructor() {
    this.data = []
    this.extensionSeen = new Array<u32>(TLS_U16_BITMAP_WORDS)
    this.shareSeen = new Array<u32>(TLS_U16_BITMAP_WORDS)
    this.reader = new TlsReader(this.data, TLS_CODEC_FROM, TLS_CODEC_FROM)
  }

  /** Forgets the last hello: every window empty, every flag down, both bitmaps clear. */
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
    this.serverNameAt = 0
    this.serverNameLength = 0
    this.alpnAt = 0
    this.alpnLength = 0
    this.quicAt = 0
    this.quicLength = 0
    this.extensionsAt = 0
    this.extensionsLength = 0
    this.nullCompressionOnly = false
    this.hasSupportedVersions = false
    this.hasSupportedGroups = false
    this.hasKeyShare = false
    this.hasX25519Share = false
    this.hasSignatureAlgorithms = false
    this.hasServerName = false
    this.hasAlpn = false
    this.hasQuicTransportParameters = false
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
  if ((end - r.at) % 2 !== 0) {
    r.failed = true
    return r.at
  }
  tlsReadSkipTo(r, end)
  return end
}

/** Whether `list` holds `value`. */
export const tlsListHas = (list: i32[], value: i32): boolean => list.indexOf(value) >= 0

/** Whether the 16-bit values `data[at .. at + length)` hold `value`. */
export const tlsWindowHasU16 = (data: u8[], at: i32, length: i32, value: i32): boolean => {
  for (
    let k: i32 = at;
    k + 1 < at + length && k >= 0 && k < toI32(data.length) && k + 1 < toI32(data.length);
    k += 2
  ) {
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
      hello.serverNameLength = nameEnd - r.at
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
  hello.sharesLength = listEnd - r.at
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
      hello.x25519ShareLength = shareEnd - r.at
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
  hello.alpnLength = listEnd - r.at
  // The list's own end bounds every entry in it (see `tlsReadList`).
  const outerEnd: i32 = tlsReadList(r, listEnd)
  while (!r.failed && r.at < listEnd) {
    const nameEnd: i32 = tlsReadVector(r, 1, 1, 255)
    tlsReadSkipTo(r, nameEnd)
  }
  r.end = outerEnd
}

/** Reads one extension body, `r.at .. end`, of type `type`; an unknown type is skipped. */
const tlsReadExtension = (r: TlsReader, type: i32, end: i32, hello: TlsClientHelloView): void => {
  switch (type) {
    case TLS_EXT_SERVER_NAME:
      tlsReadServerName(r, hello)
      break
    case TLS_EXT_SUPPORTED_GROUPS:
      hello.hasSupportedGroups = true
      hello.groupsAt = r.at + 2
      hello.groupsLength = tlsReadU16Vector(r, 2, 2, 65535) - hello.groupsAt
      break
    case TLS_EXT_SIGNATURE_ALGORITHMS:
      hello.hasSignatureAlgorithms = true
      hello.schemesAt = r.at + 2
      hello.schemesLength = tlsReadU16Vector(r, 2, 2, 65534) - hello.schemesAt
      break
    case TLS_EXT_ALPN:
      tlsReadAlpn(r, hello)
      break
    case TLS_EXT_SUPPORTED_VERSIONS:
      hello.hasSupportedVersions = true
      hello.versionsAt = r.at + 1
      hello.versionsLength = tlsReadU16Vector(r, 1, 2, 254) - hello.versionsAt
      break
    case TLS_EXT_KEY_SHARE:
      tlsReadKeyShare(r, hello)
      break
    case TLS_EXT_QUIC_TRANSPORT_PARAMETERS:
      hello.hasQuicTransportParameters = true
      hello.quicAt = r.at
      hello.quicLength = end - r.at
      tlsReadSkipTo(r, end)
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
 * its four-byte handshake header — into `hello`, which forgets the last one
 * first. Its `alert` is 0 when the body parsed; otherwise the first fault
 * decides it: `decode_error` for a length past its bytes, a vector out of its
 * bounds or bytes left over, and `illegal_parameter` for an extension sent
 * twice (§4.2), a `pre_shared_key` that is not the last extension (§4.2.11),
 * two shares for one group, or a bad `server_name`. A window outside `data`
 * is `decode_error` too, rather than a panic. Nothing is copied: the windows
 * point into `data`, which must outlive the use made of them.
 */
export const tlsReadClientHello = (hello: TlsClientHelloView, data: u8[], off: i32, len: i32): void => {
  hello.clear()
  hello.data = data
  if (off < 0 || len < 0 || off > toI32(data.length) - len) {
    hello.alert = TLS_ALERT_DECODE_ERROR
    return
  }
  const end: i32 = off + len
  const r: TlsReader = hello.reader
  r.data = data
  r.at = off
  r.end = end
  r.failed = false
  hello.legacyVersion = tlsReadU16(r)
  hello.randomAt = r.at
  tlsReadSkipTo(r, r.at + TLS_RANDOM_SIZE)
  const sessionEnd: i32 = tlsReadVector(r, 1, 0, 32)
  hello.sessionIdAt = r.at
  hello.sessionIdLength = sessionEnd - r.at
  tlsReadSkipTo(r, sessionEnd)
  hello.suitesAt = r.at + 2
  hello.suitesLength = tlsReadU16Vector(r, 2, 2, 65534) - hello.suitesAt
  const compressionEnd: i32 = tlsReadVector(r, 1, 1, 255)
  hello.nullCompressionOnly = compressionEnd - r.at === 1 && tlsReadU8(r) === 0
  tlsReadSkipTo(r, compressionEnd)
  // A hello with no extensions block is well formed (§4.1.2 keeps it for
  // TLS 1.2 and earlier); it offers no TLS 1.3, which the server refuses.
  if (!r.failed && r.at < end) {
    const extensionsEnd: i32 = tlsReadVector(r, 2, 0, 65535)
    hello.extensionsAt = r.at
    hello.extensionsLength = extensionsEnd - r.at
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
      // §4.2.11: `pre_shared_key` must be the last extension, and a server
      // checks that even though it does not take the PSK.
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
  }
}

/**
 * A ClientHello as `tlsParseClientHello` read it (RFC 8446 §4.1.2), each field
 * copied out of the message into an array of its own: the same hello as a
 * `TlsClientHelloView`, for a caller that wants values rather than windows. A
 * field whose extension was absent keeps its empty value, and its `has*` flag
 * says so.
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
  /** Every extension type read, in order. */
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

/** A copy of `data[at .. at + length)`. */
const tlsCopyWindow = (data: u8[], at: i32, length: i32): u8[] => {
  const out: u8[] = new Array<u8>(length < 0 ? TLS_CODEC_FROM : length)
  for (let k: i32 = 0; k < toI32(out.length) && at + k >= 0 && at + k < toI32(data.length); k++) {
    out[k] = data[at + k]
  }
  return out
}

/** The 16-bit values of `data[at .. at + length)`, in a fresh list. */
const tlsCopyU16Window = (data: u8[], at: i32, length: i32): i32[] => {
  const out: i32[] = []
  for (
    let k: i32 = at;
    k + 1 < at + length && k >= 0 && k < toI32(data.length) && k + 1 < toI32(data.length);
    k += 2
  ) {
    out.push((toI32(data[k]) << 8) | toI32(data[k + 1]))
  }
  return out
}

/** The bytes of `data[at .. at + length)` as a string of one character a byte: ASCII here, a host name. */
export const tlsWindowString = (data: u8[], at: i32, length: i32): string => {
  const parts: string[] = []
  for (let k: i32 = at; k < at + length && k >= 0 && k < toI32(data.length); k++) {
    parts.push(String.fromCharCode(toI32(data[k])))
  }
  return parts.join("")
}

/**
 * Reads the ClientHello body `data[off .. off + len)` — the message without
 * its four-byte handshake header — into a fresh `TlsClientHello`, with
 * `tlsReadClientHello`'s checks and its `alert`, every field copied out.
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
  // above has checked every length these loops follow.
  let at: i32 = view.sharesAt
  while (
    at + 4 <= view.sharesAt + view.sharesLength &&
    at >= 0 &&
    at < toI32(data.length) &&
    at + 3 < toI32(data.length)
  ) {
    // All four bytes are read before the `push`, which is a call and so
    // forgets what the guard said about `data.length`.
    const group: i32 = (toI32(data[at]) << 8) | toI32(data[at + 1])
    const skip: i32 = (toI32(data[at + 2]) << 8) | toI32(data[at + 3])
    hello.shareGroups.push(group)
    at = at + 4 + skip
  }
  at = view.alpnAt
  while (at < view.alpnAt + view.alpnLength && at >= 0 && at < toI32(data.length)) {
    const n: i32 = toI32(data[at])
    hello.alpn.push(tlsCopyWindow(data, at + 1, n))
    at = at + 1 + n
  }
  at = view.extensionsAt
  while (
    at + 4 <= view.extensionsAt + view.extensionsLength &&
    at >= 0 &&
    at < toI32(data.length) &&
    at + 3 < toI32(data.length)
  ) {
    // Read before the `push`, as in the key-share walk above.
    const kind: i32 = (toI32(data[at]) << 8) | toI32(data[at + 1])
    const skip: i32 = (toI32(data[at + 2]) << 8) | toI32(data[at + 3])
    hello.extensionTypes.push(kind)
    at = at + 4 + skip
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
 */
const tlsPutU8 = (out: u8[], at: i32, v: i32): i32 => {
  if (at >= 0 && at < toI32(out.length)) {
    out[at] = toU8(v & 255)
  }
  return at + 1
}

const tlsPutU16 = (out: u8[], at: i32, v: i32): i32 => tlsPutU8(out, tlsPutU8(out, at, v >> 8), v)

/** `bytes[off .. off + len)`, at `out[at]`. */
const tlsPutWindow = (out: u8[], at: i32, bytes: u8[], off: i32, len: i32): i32 => {
  // Measuring over an empty array: nothing would land, so nothing is copied.
  if (toI32(out.length) === 0) {
    return at + len
  }
  for (let k: i32 = 0; k < len && off + k >= 0 && off + k < toI32(bytes.length); k++) {
    tlsPutU8(out, at + k, toI32(bytes[off + k]))
  }
  return at + len
}

const tlsPutBytes = (out: u8[], at: i32, b: u8[]): i32 =>
  tlsPutWindow(out, at, b, TLS_CODEC_FROM, toI32(b.length))

/** The bytes of `text`, one a character: ASCII here, an ALPN protocol id. */
const tlsPutAscii = (out: u8[], at: i32, text: string): i32 => {
  const length: i32 = toI32(text.length)
  for (let k: i32 = 0; k < length; k++) {
    tlsPutU8(out, at + k, toI32(text.charCodeAt(k)))
  }
  return at + length
}

/**
 * Writes the `width`-byte length of the vector whose contents run from
 * `start` to `end`, into the `width` bytes before `start` that the caller
 * left for it.
 */
const tlsPutLength = (out: u8[], start: i32, end: i32, width: i32): void => {
  let n: i32 = end - start
  for (let at: i32 = start - 1; at >= start - width; at--) {
    tlsPutU8(out, at, n)
    n = n >> 8
  }
}

/** The handshake header (§4): `type`, then a 24-bit length of the body that follows it to `end`. */
const tlsPutHeader = (out: u8[], at: i32, type: i32, end: i32): void => {
  tlsPutU8(out, at, type)
  tlsPutLength(out, at + 4, end, 3)
}

/** The fixed `random` that marks a ServerHello as a HelloRetryRequest: SHA-256 of "HelloRetryRequest" (§4.1.3). */
const TLS_HELLO_RETRY_RANDOM: string = "cf21ad74e59a6111be1d8c021e65b891c2a211167abb8c5e079e09e2c8a8339c"

/** The value of one lowercase hex digit. */
const tlsHexNibble = (c: i32): i32 => (c <= 57 ? c - 48 : c - 87)

/**
 * Writes the bytes the lowercase hex constant `text` spells at `out[at]` and
 * answers where they end: how this stack's fixed values, written out where
 * they are defined, become bytes without an array of their own.
 */
export const tlsHexInto = (text: string, out: u8[], at: i32): i32 => {
  const length: i32 = toI32(text.length) >> 1
  for (let k: i32 = 0; k < length; k++) {
    const hi: i32 = tlsHexNibble(toI32(text.charCodeAt(2 * k)))
    const lo: i32 = tlsHexNibble(toI32(text.charCodeAt(2 * k + 1)))
    tlsPutU8(out, at + k, (hi << 4) | lo)
  }
  return at + length
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
 * Writes a ServerHello (§4.1.3) at `out[at]` and answers where it ends:
 * choosing `suite` and TLS 1.3, echoing the session id
 * `sessionId[sessionIdOff .. sessionIdOff + sessionIdLength)`, and carrying
 * the server's x25519 share. The extensions are `key_share` then
 * `supported_versions`, the order RFC 8448 §3 shows.
 */
export const tlsWriteServerHello = (
  out: u8[],
  at: i32,
  random: u8[],
  sessionId: u8[],
  sessionIdOff: i32,
  sessionIdLength: i32,
  suite: i32,
  x25519Public: u8[]
): i32 => {
  let p: i32 = tlsPutHelloHead(out, at + 4, random, false, sessionId, sessionIdOff, sessionIdLength, suite)
  const extensions: i32 = p + 2
  p = tlsPutU16(out, extensions, TLS_EXT_KEY_SHARE)
  const share: i32 = p + 2
  p = tlsPutU16(out, share, TLS_GROUP_X25519)
  const key: i32 = p + 2
  p = tlsPutBytes(out, key, x25519Public)
  tlsPutLength(out, key, p, 2)
  tlsPutLength(out, share, p, 2)
  p = tlsPutSelectedVersion(out, p)
  tlsPutLength(out, extensions, p, 2)
  tlsPutHeader(out, at, TLS_HANDSHAKE_SERVER_HELLO, p)
  return p
}

/**
 * Writes a HelloRetryRequest (§4.1.4) at `out[at]` and answers where it ends:
 * a ServerHello whose `random` is the fixed HelloRetryRequest value, choosing
 * `suite`, echoing the session id, and asking for a share of `group` in
 * `key_share`. No cookie is sent.
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
  let p: i32 = tlsPutHelloHead(out, at + 4, none, true, sessionId, sessionIdOff, sessionIdLength, suite)
  const extensions: i32 = p + 2
  p = tlsPutU16(out, extensions, TLS_EXT_KEY_SHARE)
  p = tlsPutU16(out, p, 2)
  p = tlsPutU16(out, p, group)
  p = tlsPutSelectedVersion(out, p)
  tlsPutLength(out, extensions, p, 2)
  tlsPutHeader(out, at, TLS_HANDSHAKE_SERVER_HELLO, p)
  return p
}

/**
 * Writes EncryptedExtensions (§4.3.1) at `out[at]` and answers where it ends.
 * `extra` is extensions the caller encodes itself, written first and as they
 * are; then the chosen ALPN protocol when `alpn` is not empty (RFC 7301 §3.1,
 * a list of exactly one), an empty `server_name` when `acknowledgeServerName`
 * (RFC 6066 §3's acknowledgement), and the server's
 * `quic_transport_parameters` when `quicTransportParameters` is not `null`.
 */
export const tlsWriteEncryptedExtensions = (
  out: u8[],
  at: i32,
  extra: u8[],
  alpn: string,
  acknowledgeServerName: boolean,
  quicTransportParameters: u8[] | null
): i32 => {
  const extensions: i32 = at + 6
  let p: i32 = tlsPutBytes(out, extensions, extra)
  if (toI32(alpn.length) > 0) {
    p = tlsPutU16(out, p, TLS_EXT_ALPN)
    const body: i32 = p + 2
    const list: i32 = body + 2
    const name: i32 = list + 1
    p = tlsPutAscii(out, name, alpn)
    tlsPutLength(out, name, p, 1)
    tlsPutLength(out, list, p, 2)
    tlsPutLength(out, body, p, 2)
  }
  if (acknowledgeServerName) {
    p = tlsPutU16(out, tlsPutU16(out, p, TLS_EXT_SERVER_NAME), 0)
  }
  if (quicTransportParameters !== null) {
    p = tlsPutU16(out, p, TLS_EXT_QUIC_TRANSPORT_PARAMETERS)
    const body: i32 = p + 2
    p = tlsPutBytes(out, body, quicTransportParameters)
    tlsPutLength(out, body, p, 2)
  }
  tlsPutLength(out, extensions, p, 2)
  tlsPutHeader(out, at, TLS_HANDSHAKE_ENCRYPTED_EXTENSIONS, p)
  return p
}

/**
 * Writes a server's Certificate (§4.4.2) at `out[at]` and answers where it
 * ends: an empty request context, then each DER certificate of `chain`, leaf
 * first, with no extensions of its own.
 */
export const tlsWriteCertificate = (out: u8[], at: i32, chain: u8[][]): i32 => {
  const list: i32 = tlsPutU8(out, at + 4, 0) + 3
  let p: i32 = list
  for (const certificate of chain) {
    const entry: i32 = p + 3
    p = tlsPutBytes(out, entry, certificate)
    tlsPutLength(out, entry, p, 3)
    p = tlsPutU16(out, p, 0)
  }
  tlsPutLength(out, list, p, 3)
  tlsPutHeader(out, at, TLS_HANDSHAKE_CERTIFICATE, p)
  return p
}

/** Writes a CertificateVerify (§4.4.3) at `out[at]`: the signature scheme and the signature as it goes on the wire. */
export const tlsWriteCertificateVerify = (out: u8[], at: i32, scheme: i32, signature: u8[]): i32 => {
  const body: i32 = tlsPutU16(out, at + 4, scheme) + 2
  const p: i32 = tlsPutBytes(out, body, signature)
  tlsPutLength(out, body, p, 2)
  tlsPutHeader(out, at, TLS_HANDSHAKE_CERTIFICATE_VERIFY, p)
  return p
}

/** Writes a Finished (§4.4.4) at `out[at]`, carrying `verifyData[off .. off + len)`. */
export const tlsWriteFinished = (out: u8[], at: i32, verifyData: u8[], off: i32, len: i32): i32 => {
  const p: i32 = tlsPutWindow(out, at + 4, verifyData, off, len)
  tlsPutHeader(out, at, TLS_HANDSHAKE_FINISHED, p)
  return p
}

/**
 * Writes what a server's CertificateVerify signs (§4.4.3) at `out[at]`: 64
 * spaces, the context string "TLS 1.3, server CertificateVerify", a zero byte,
 * and the transcript hash `transcriptHash[off .. off + len)` through
 * Certificate.
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

/** The bytes of `name` as a string of one character a byte, which `tlsWriteEncryptedExtensions` writes back as they were. */
const tlsBytesString = (name: u8[]): string => tlsWindowString(name, TLS_CODEC_FROM, toI32(name.length))

/**
 * A ServerHello (§4.1.3) choosing `suite` and TLS 1.3, echoing the client's
 * `sessionId`, and carrying the server's x25519 share, in a fresh array
 * (`tlsWriteServerHello`).
 */
export const tlsEncodeServerHello = (random: u8[], sessionId: u8[], suite: i32, x25519Public: u8[]): u8[] => {
  const none: u8[] = []
  const sessionIdLength: i32 = toI32(sessionId.length)
  const out: u8[] = new Array<u8>(
    tlsWriteServerHello(
      none,
      TLS_CODEC_FROM,
      random,
      sessionId,
      TLS_CODEC_FROM,
      sessionIdLength,
      suite,
      x25519Public
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
    x25519Public
  )
  return out
}

/** A HelloRetryRequest (§4.1.4) choosing `suite`, echoing `sessionId` and asking for `group`, in a fresh array (`tlsWriteHelloRetryRequest`). */
export const tlsEncodeHelloRetryRequest = (sessionId: u8[], suite: i32, group: i32): u8[] => {
  const none: u8[] = []
  const sessionIdLength: i32 = toI32(sessionId.length)
  const out: u8[] = new Array<u8>(
    tlsWriteHelloRetryRequest(none, TLS_CODEC_FROM, sessionId, TLS_CODEC_FROM, sessionIdLength, suite, group)
  )
  tlsWriteHelloRetryRequest(out, TLS_CODEC_FROM, sessionId, TLS_CODEC_FROM, sessionIdLength, suite, group)
  return out
}

/**
 * EncryptedExtensions (§4.3.1) in a fresh array (`tlsWriteEncryptedExtensions`),
 * the ALPN protocol given as its bytes.
 */
export const tlsEncodeEncryptedExtensions = (
  extra: u8[],
  alpn: u8[],
  acknowledgeServerName: boolean,
  quicTransportParameters: u8[] | null
): u8[] => {
  const none: u8[] = []
  const protocol: string = tlsBytesString(alpn)
  const out: u8[] = new Array<u8>(
    tlsWriteEncryptedExtensions(
      none,
      TLS_CODEC_FROM,
      extra,
      protocol,
      acknowledgeServerName,
      quicTransportParameters
    )
  )
  tlsWriteEncryptedExtensions(
    out,
    TLS_CODEC_FROM,
    extra,
    protocol,
    acknowledgeServerName,
    quicTransportParameters
  )
  return out
}

/** A server's Certificate (§4.4.2) in a fresh array (`tlsWriteCertificate`). */
export const tlsEncodeCertificate = (chain: u8[][]): u8[] => {
  const none: u8[] = []
  const out: u8[] = new Array<u8>(tlsWriteCertificate(none, TLS_CODEC_FROM, chain))
  tlsWriteCertificate(out, TLS_CODEC_FROM, chain)
  return out
}

/** A CertificateVerify (§4.4.3) in a fresh array (`tlsWriteCertificateVerify`). */
export const tlsEncodeCertificateVerify = (scheme: i32, signature: u8[]): u8[] => {
  const none: u8[] = []
  const out: u8[] = new Array<u8>(tlsWriteCertificateVerify(none, TLS_CODEC_FROM, scheme, signature))
  tlsWriteCertificateVerify(out, TLS_CODEC_FROM, scheme, signature)
  return out
}

/** A Finished (§4.4.4) carrying `verifyData`, in a fresh array (`tlsWriteFinished`). */
export const tlsEncodeFinished = (verifyData: u8[]): u8[] => {
  const none: u8[] = []
  const length: i32 = toI32(verifyData.length)
  const out: u8[] = new Array<u8>(tlsWriteFinished(none, TLS_CODEC_FROM, verifyData, TLS_CODEC_FROM, length))
  tlsWriteFinished(out, TLS_CODEC_FROM, verifyData, TLS_CODEC_FROM, length)
  return out
}

/** What a server's CertificateVerify signs (§4.4.3), in a fresh array (`tlsWriteCertificateVerifyContent`). */
export const tlsCertificateVerifyContent = (transcriptHash: u8[]): u8[] => {
  const none: u8[] = []
  const length: i32 = toI32(transcriptHash.length)
  const out: u8[] = new Array<u8>(
    tlsWriteCertificateVerifyContent(none, TLS_CODEC_FROM, transcriptHash, TLS_CODEC_FROM, length)
  )
  tlsWriteCertificateVerifyContent(out, TLS_CODEC_FROM, transcriptHash, TLS_CODEC_FROM, length)
  return out
}
