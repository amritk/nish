/**
 * `nish/net/quic-packet` — QUIC version 1's packets, as RFC 9000 §16-§17
 * frames them and RFC 9001 §5 protects them: the variable-length integer,
 * the long and short headers, packet-number encoding and recovery, the
 * Initial secrets, AEAD packet protection, header protection and the Retry
 * integrity tag.
 *
 *     import { quicInitialSecrets, quicKeys, quicParseHeader, quicOpenPacket,
 *              QUIC_AEAD_AES_128_GCM, QUIC_PACKET_OK } from "nish/net/quic-packet";
 *
 *     const secrets = quicInitialSecrets(clientDcid);            // RFC 9001 §5.2
 *     const keys = quicKeys(QUIC_AEAD_AES_128_GCM, secrets.client);
 *     const header = quicParseHeader(datagram, 0, 8);            // 8: our short-header DCID length
 *     const packet = quicOpenPacket(keys, datagram, header, largestReceived);
 *     if (packet.error === QUIC_PACKET_OK) { … packet.payload holds the frames … }
 *
 * The module is sans-IO: bytes in, bytes out, no socket and no clock. It
 * frames and protects packets and stops there, so it knows nothing of frames,
 * of a connection's state or of which keys a level is on; that is
 * `nish/net/quic` (WP34 Q2). Only version 1 (`0x00000001`) is spoken. A long
 * header of another version is parsed as far as RFC 8999's invariants go,
 * which is what a server needs to send Version Negotiation, and reported as
 * `QUIC_ERR_VERSION`.
 *
 * **What a parse refuses.** Every read is bounds-checked against the
 * datagram, so nothing a peer sends can make this module panic. A header
 * that runs past the datagram is `QUIC_ERR_TRUNCATED`; a clear fixed bit
 * `QUIC_ERR_FIXED_BIT`; a connection ID over 20 bytes in a version 1 header
 * `QUIC_ERR_CID_LENGTH`; a Length field reaching past the datagram
 * `QUIC_ERR_LENGTH`; a packet too short to sample for header protection
 * `QUIC_ERR_SAMPLE`; a payload that does not authenticate `QUIC_ERR_DECRYPT`;
 * and nonzero reserved bits once both protections are off
 * `QUIC_ERR_RESERVED_BITS`, which RFC 9000 §17.2 makes a connection error
 * rather than a drop, so the payload is still handed back with it. The
 * builders, whose inputs come from this side rather than from a peer, answer
 * `null` for an argument out of range.
 *
 * **Coalesced packets** (RFC 9000 §12.2) are split by length: a long header
 * carries its own Length, and `QuicHeader.end` is where the next packet in the
 * datagram starts. A short header has none, so it runs to the datagram's end.
 *
 * **Secrets are not wiped.** `QuicKeys` holds a packet key, an IV and a
 * header-protection key, and `quicKeys`, `quicKeyUpdateSecret` and the seal
 * and open functions hold traffic secrets and keys in arena memory until that
 * memory is reused, as every `nish/crypto` module does (ECC-2, X509-7). The
 * Initial keys are not secret, because anyone who reads the client's first
 * DCID can derive them (RFC 9001 §5.2); the Handshake and 1-RTT keys are,
 * and `docs/security/quic.md` records them as QUIC-1.
 *
 * **Constant time.** The AEADs and the header-protection masks are
 * `nish/crypto/aes` and `nish/crypto/chacha20poly1305`, with their guarantees.
 * What this module branches on is public: lengths, the packet type, the
 * packet number once header protection is off (it is in the clear to anyone
 * who holds the header-protection key, and RFC 9001 §5.4.1 protects it against
 * observers, not timing), and whether a payload authenticated.
 *
 * Written from RFC 9000 and RFC 9001, in this module's own structure: nothing
 * here is ported from another implementation. The packet-number decoding
 * follows the arithmetic of RFC 9000 §A.3 and the length choice the rule of
 * §A.2, neither line by line.
 *
 * Private names carry the `quicPacket` prefix because a `std/` module's
 * private functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import { aesGcmOpen, aesGcmSeal, aesHeaderMask, aesKey, AesKey } from "nish/crypto/aes"
import { chacha20HeaderMask, chacha20Poly1305Open, chacha20Poly1305Seal } from "nish/crypto/chacha20poly1305"
import { timingSafeEqual } from "nish/crypto/ct"
import { hkdfExpandLabelSha256, hkdfExpandLabelSha384, hkdfExtractSha256 } from "nish/crypto/hkdf"

/** QUIC version 1 (RFC 9000 §15), the only version this module protects. */
export const QUIC_VERSION_1: i64 = 1
/** The longest connection ID version 1 allows (RFC 9000 §17.2). */
export const QUIC_MAX_CID_LENGTH: i32 = 20
/**
 * The largest value a variable-length integer holds, 2^62 - 1 (RFC 9000 §16),
 * and so the largest packet number. Spelled as 2^30 × 2^32 - 1 because an
 * `i64` literal past 2^53 is refused (`docs/LANGUAGE.md`, numeric literals).
 */
export const QUIC_MAX_VARINT: i64 = 1073741824 * 4294967296 - 1
/** Every version 1 AEAD's tag, and so what each protected payload adds, in bytes (RFC 9001 §5.3). */
export const QUIC_AEAD_TAG_SIZE: i32 = 16
/** The bytes of ciphertext header protection samples (RFC 9001 §5.4.2). */
export const QUIC_SAMPLE_SIZE: i32 = 16
/** The Retry integrity tag, in bytes (RFC 9001 §5.8). */
export const QUIC_RETRY_TAG_SIZE: i32 = 16

/** A long-header Initial packet (RFC 9000 §17.2.2). */
export const QUIC_PACKET_INITIAL: i32 = 0
/** A long-header 0-RTT packet (RFC 9000 §17.2.3): parsed, since a server may be sent one; `quicLongHeader` builds one for a client. */
export const QUIC_PACKET_ZERO_RTT: i32 = 1
/** A long-header Handshake packet (RFC 9000 §17.2.4). */
export const QUIC_PACKET_HANDSHAKE: i32 = 2
/** A long-header Retry packet (RFC 9000 §17.2.5). */
export const QUIC_PACKET_RETRY: i32 = 3
/** A short-header, 1-RTT packet (RFC 9000 §17.3.1). */
export const QUIC_PACKET_SHORT: i32 = 4

/** AEAD_AES_128_GCM with SHA-256, the Initial packets' AEAD (TLS_AES_128_GCM_SHA256). */
export const QUIC_AEAD_AES_128_GCM: i32 = 1
/** AEAD_AES_256_GCM with SHA-384 (TLS_AES_256_GCM_SHA384). */
export const QUIC_AEAD_AES_256_GCM: i32 = 2
/** AEAD_CHACHA20_POLY1305 with SHA-256 (TLS_CHACHA20_POLY1305_SHA256). */
export const QUIC_AEAD_CHACHA20_POLY1305: i32 = 3

/** A packet parsed, or opened, with nothing wrong. */
export const QUIC_PACKET_OK: i32 = 0
/** The header runs past the end of the datagram. */
export const QUIC_ERR_TRUNCATED: i32 = 1
/** The fixed bit, 0x40 of the first byte, is clear (RFC 9000 §17.2, §17.3.1). */
export const QUIC_ERR_FIXED_BIT: i32 = 2
/** A long header of a version other than 1; `version`, `dcid` and `scid` are still filled in (RFC 8999 §5.1). */
export const QUIC_ERR_VERSION: i32 = 3
/** A version 1 connection ID longer than 20 bytes (RFC 9000 §17.2). */
export const QUIC_ERR_CID_LENGTH: i32 = 4
/** A long header whose Length field reaches past the end of the datagram (RFC 9000 §17.2). */
export const QUIC_ERR_LENGTH: i32 = 5
/** Too few bytes after the packet number's offset to take the 16-byte sample (RFC 9001 §5.4.2). */
export const QUIC_ERR_SAMPLE: i32 = 6
/** The payload does not authenticate under the keys given (RFC 9001 §5.3). */
export const QUIC_ERR_DECRYPT: i32 = 7
/** The payload authenticated but a reserved bit is set, a PROTOCOL_VIOLATION (RFC 9000 §17.2, §17.3.1). */
export const QUIC_ERR_RESERVED_BITS: i32 = 8
/** The packet carries no protected payload: a Retry (RFC 9000 §17.2.5). */
export const QUIC_ERR_NOT_PROTECTED: i32 = 9
/** Keys `quicKeys` or `quicKeysUpdate` did not make: a caller's own mistake, never a peer's. */
export const QUIC_ERR_KEYS: i32 = 10

/** RFC 9001 §5.2's `initial_salt` for version 1. A function, because a module constant cannot be an array. */
const quicPacketInitialSalt = (): u8[] => [
  0x38, 0x76, 0x2c, 0xf7, 0xf5, 0x59, 0x34, 0xb3, 0x4d, 0x17, 0x9a, 0xe6, 0xa4, 0xc8, 0x0c, 0xad, 0xcc, 0xbb,
  0x7f, 0x0a,
]

/** RFC 9001 §5.8's fixed AES-128-GCM key for version 1's Retry integrity tag. */
const quicPacketRetryKey = (): u8[] => [
  0xbe, 0x0c, 0x69, 0x0b, 0x9f, 0x66, 0x57, 0x5a, 0x1d, 0x76, 0x6b, 0x54, 0xe3, 0x68, 0xc8, 0x4e,
]

/** RFC 9001 §5.8's fixed nonce for version 1's Retry integrity tag. */
const quicPacketRetryNonce = (): u8[] => [
  0x46, 0x15, 0x99, 0xd3, 0x5d, 0x63, 0x2b, 0xf2, 0x23, 0x98, 0x25, 0xbb,
]

/** The largest Length a long header carries, the most a two-byte varint holds. */
const QUIC_MAX_LENGTH: i32 = 16383

/** The AEAD nonce, and so every packet IV, in bytes (RFC 9001 §5.3). */
const QUIC_IV_SIZE: i32 = 12

/**
 * One packet's header as `quicParseHeader` read it from a datagram. The
 * fields after `error` are meaningful as far as the parse got: all of them
 * when `error` is `QUIC_PACKET_OK`, and `version`, `dcid` and `scid` for
 * `QUIC_ERR_VERSION`, which is what Version Negotiation needs.
 *
 * The packet number and the low bits of the first byte are still under
 * header protection here, so the header carries where they are rather than
 * what they hold; `quicOpenPacket` reads them.
 */
export class QuicHeader {
  /** `QUIC_PACKET_OK`, or the `QUIC_ERR_*` that stopped the parse. */
  error: i32 = 0
  /** `QUIC_PACKET_INITIAL`, `_ZERO_RTT`, `_HANDSHAKE`, `_RETRY` or `_SHORT`. */
  type: i32 = 0
  /** The long header's 32-bit version, held in an `i64`; 0 for a short header, which has none. */
  version: i64 = 0
  /** The Destination Connection ID. */
  dcid: u8[]
  /** The Source Connection ID; empty for a short header. */
  scid: u8[]
  /** An Initial's token, or a Retry's; empty for every other type. */
  token: u8[]
  /** A Retry's integrity tag, the datagram's last 16 bytes; empty for every other type. */
  retryTag: u8[]
  /** Where in the datagram the packet starts. */
  start: i32 = 0
  /**
   * Where the protected packet number starts: the header-protection sample
   * starts 4 bytes after it. For a Retry, which has none, where its tag starts.
   */
  pnOffset: i32 = 0
  /** One past the packet's last byte, which is where the next coalesced packet starts. */
  end: i32 = 0

  constructor() {
    this.dcid = []
    this.scid = []
    this.token = []
    this.retryTag = []
  }
}

/**
 * One packet's protection keys (RFC 9001 §5.1): the AEAD's key and IV, and
 * the header-protection key, all derived from one traffic secret by
 * `quicKeys`. For the AES suites the two keys are also kept expanded, so a
 * connection expands them once rather than once a packet.
 */
export class QuicKeys {
  /** `QUIC_AEAD_AES_128_GCM`, `_AES_256_GCM` or `_CHACHA20_POLY1305`. */
  aead: i32 = 0
  /** The packet-protection key: 16 bytes for AES-128-GCM, 32 for the others. */
  key: u8[]
  /** The 12-byte IV the packet number is XORed into. */
  iv: u8[]
  /** The header-protection key, the same length as `key`. */
  hp: u8[]
  /** `key` expanded, for the AES suites; `null` for ChaCha20-Poly1305. */
  packetAes: AesKey | null = null
  /** `hp` expanded, for the AES suites; `null` for ChaCha20-Poly1305. */
  hpAes: AesKey | null = null

  constructor(aead: i32, key: u8[], iv: u8[], hp: u8[]) {
    this.aead = aead
    this.key = key
    this.iv = iv
    this.hp = hp
  }
}

/** The two Initial secrets RFC 9001 §5.2 derives from the client's first Destination Connection ID. */
export class QuicInitialSecrets {
  /** `client_initial_secret`: what protects the client's Initial packets. */
  client: u8[]
  /** `server_initial_secret`: what protects the server's. */
  server: u8[]

  constructor(client: u8[], server: u8[]) {
    this.client = client
    this.server = server
  }
}

/**
 * One packet with its protection removed by `quicOpenPacket`, or as far as
 * that got. With `error` at `QUIC_PACKET_OK` or `QUIC_ERR_RESERVED_BITS`
 * every field is filled in; with `QUIC_ERR_DECRYPT` all but `payload`.
 */
export class QuicPacket {
  /** The full packet number, recovered from the truncated one (RFC 9000 §17.1). */
  packetNumber: i64 = 0
  /** The header in the clear, packet number included: the AEAD's associated data. */
  header: u8[]
  /** The decrypted frames. */
  payload: u8[]
  /** `QUIC_PACKET_OK`, or the `QUIC_ERR_*` that stopped the open. */
  error: i32 = 0
  /** The first byte with header protection removed. */
  firstByte: i32 = 0
  /** The packet number's length on the wire, 1 to 4 bytes. */
  pnLength: i32 = 0
  /** A short header's Key Phase bit (RFC 9001 §6); `false` for a long header. */
  keyPhase: boolean = false

  constructor() {
    this.header = []
    this.payload = []
  }
}

/**
 * HKDF-Expand-Label (RFC 8446 §7.1, RFC 9001 §5.1) with an empty context,
 * under the hash `aead` pairs with: SHA-384 for AES-256-GCM, SHA-256 for the
 * others. Every label and length here is a fixed one the expand accepts.
 */
const quicPacketExpandLabel = (aead: i32, secret: u8[], label: string, length: i32): u8[] =>
  aead === QUIC_AEAD_AES_256_GCM
    ? hkdfExpandLabelSha384(secret, label, [], length)
    : hkdfExpandLabelSha256(secret, label, [], length)

/**
 * The bytes `bytes[from .. to)` as a fresh array of exactly that size, so a
 * packet-sized copy is one allocation rather than a push-grown one; the
 * window is clamped to `bytes`, though every caller has checked it.
 */
const quicPacketSlice = (bytes: u8[], from: i32, to: i32): u8[] => {
  const length: i32 = toI32(bytes.length)
  const start: i32 = from < 0 ? 0 : from
  const stop: i32 = to > length ? length : to
  const size: i32 = stop > start ? stop - start : 0
  const out: u8[] = new Array<u8>(size)
  const outLength: i32 = toI32(out.length)
  for (let k: i32 = 0; k < outLength; k += 1) {
    if (start + k < toI32(bytes.length)) {
      out[k] = bytes[start + k]
    }
  }
  return out
}

/** Appends every byte of `bytes` to `out`. */
const quicPacketAppend = (out: u8[], bytes: u8[]): void => {
  for (const b of bytes) {
    out.push(b)
  }
}

/**
 * The bytes a variable-length integer needs (RFC 9000 §16): 1, 2, 4 or 8, or
 * 0 for a value that has no encoding, below zero or past 2^62 - 1.
 */
export const quicVarintSize = (value: i64): i32 => {
  if (value < 0 || value > QUIC_MAX_VARINT) {
    return 0
  }
  if (value <= 63) {
    return 1
  }
  if (value <= 16383) {
    return 2
  }
  if (value <= 1073741823) {
    return 4
  }
  return 8
}

/**
 * Appends `value` to `out` as a variable-length integer of exactly `size`
 * bytes, which may be longer than it needs (RFC 9000 §16 allows that, and a
 * Length field written before its packet is complete uses it). Answers
 * `false`, appending nothing, when `size` is not 1, 2, 4 or 8 or is too short
 * for `value`.
 */
export const quicVarintPushSized = (out: u8[], value: i64, size: i32): boolean => {
  const needed: i32 = quicVarintSize(value)
  if (needed === 0 || size < needed) {
    return false
  }
  // The two-bit prefix is log2 of the size: 0, 1, 2 or 3 for 1, 2, 4 or 8 bytes.
  let prefix: i32 = 0
  if (size === 2) {
    prefix = 1
  } else if (size === 4) {
    prefix = 2
  } else if (size === 8) {
    prefix = 3
  } else if (size !== 1) {
    return false
  }
  for (let k: i32 = size - 1; k >= 0; k -= 1) {
    const shift: i64 = toI64(k) * 8
    let b: i32 = toI32((value >> shift) & 255)
    if (k === size - 1) {
      b = b | (prefix << 6)
    }
    out.push(toU8(b))
  }
  return true
}

/**
 * Appends `value` to `out` as a variable-length integer in the fewest bytes
 * (RFC 9000 §16). Answers `false`, appending nothing, for a value below zero
 * or past 2^62 - 1.
 */
export const quicVarintPush = (out: u8[], value: i64): boolean =>
  quicVarintPushSized(out, value, quicVarintSize(value))

/**
 * The length of the variable-length integer whose first byte is at
 * `bytes[at]`, read from its two-bit prefix: 1, 2, 4 or 8. Answers 0 when
 * `at` is outside `bytes`.
 */
export const quicVarintLength = (bytes: u8[], at: i32): i32 => {
  if (at < 0 || at >= toI32(bytes.length)) {
    return 0
  }
  return 1 << toI32(bytes[at] >> 6)
}

/**
 * The variable-length integer at `bytes[at]` (RFC 9000 §16, §A.1), read only
 * from `bytes[at .. end)`. Answers -1, which no varint holds, when it does not
 * fit in that window or the window is not inside `bytes`. Advance past it by
 * `quicVarintLength(bytes, at)`.
 */
export const quicVarintRead = (bytes: u8[], at: i32, end: i32): i64 => {
  const size: i32 = quicVarintLength(bytes, at)
  if (size === 0 || end > toI32(bytes.length) || at + size > end) {
    return -1
  }
  let value: i64 = toI64(bytes[at] & 0x3f)
  for (let k: i32 = 1; k < size; k += 1) {
    value = (value << 8) | toI64(bytes[at + k])
  }
  return value
}

/**
 * How many bytes to send packet number `fullPn` in (RFC 9000 §17.1, §A.2),
 * when `largestAcked` is the largest the peer has acknowledged in its space,
 * or -1 if none: enough that twice the unacknowledged range fits, 1 to 4.
 * Answers 0 when no length will do — `fullPn` not above `largestAcked`, not a
 * packet number, or more than 2^31 packets unacknowledged.
 */
export const quicPacketNumberLength = (fullPn: i64, largestAcked: i64): i32 => {
  if (fullPn < 0 || fullPn > QUIC_MAX_VARINT || largestAcked < -1 || fullPn <= largestAcked) {
    return 0
  }
  // `fullPn - largestAcked` packets are in flight with the new one, and the
  // receiver's window is centred on what it expects, so the encoding has to
  // span twice that: `unacked <= 2^(8n - 1)` for n bytes.
  const unacked: i64 = fullPn - largestAcked
  for (let n: i32 = 1; n <= 4; n += 1) {
    const half: i64 = toI64(1) << (toI64(n) * 8 - 1)
    if (unacked <= half) {
      return n
    }
  }
  return 0
}

/**
 * The full packet number from the `pnLength`-byte `truncatedPn` on the wire,
 * given `largestPn`, the largest packet number this endpoint has processed in
 * that space, or -1 for none (RFC 9000 §17.1, §A.3): the one closest to
 * `largestPn + 1` whose low bytes are `truncatedPn`. Answers -1 when
 * `pnLength` is not 1 to 4 or `truncatedPn` does not fit in it.
 */
export const quicPacketNumberDecode = (largestPn: i64, truncatedPn: i64, pnLength: i32): i64 => {
  if (pnLength < 1 || pnLength > 4 || largestPn < -1 || largestPn > QUIC_MAX_VARINT) {
    return -1
  }
  const window: i64 = toI64(1) << (toI64(pnLength) * 8)
  if (truncatedPn < 0 || truncatedPn >= window) {
    return -1
  }
  const expected: i64 = largestPn + 1
  const halfWindow: i64 = window >> 1
  const candidate: i64 = (expected & ~(window - 1)) | truncatedPn
  // The candidate shares `expected`'s high bits; one window up or down is
  // nearer when it falls outside (expected - half, expected + half]. The
  // bound checks keep the answer inside [0, 2^62). One case is left that
  // RFC 9000 §A.3's pseudocode does not catch: with `largestPn` at 2^62 - 1,
  // `expected` is 2^62 itself, and a candidate equal to it falls through
  // both tests. Every packet number below 2^62 with these low bytes is a
  // window down, and the nearest of them is the answer.
  if (candidate <= expected - halfWindow && candidate < QUIC_MAX_VARINT + 1 - window) {
    return candidate + window
  }
  if ((candidate > expected + halfWindow || candidate > QUIC_MAX_VARINT) && candidate >= window) {
    return candidate - window
  }
  return candidate
}

/** Whether `cid` is a connection ID version 1 allows: 0 to 20 bytes. */
const quicPacketCidFits = (cid: u8[]): boolean => toI32(cid.length) <= QUIC_MAX_CID_LENGTH

/**
 * Appends what every version 1 long header starts with (RFC 9000 §17.2): the
 * first byte, the version, and each connection ID after its length.
 */
const quicPacketPushLongPrefix = (out: u8[], first: i32, dcid: u8[], scid: u8[]): void => {
  out.push(toU8(first))
  out.push(toU8(0))
  out.push(toU8(0))
  out.push(toU8(0))
  out.push(toU8(toI32(QUIC_VERSION_1)))
  out.push(toU8(toI32(dcid.length)))
  quicPacketAppend(out, dcid)
  out.push(toU8(toI32(scid.length)))
  quicPacketAppend(out, scid)
}

/** Appends the low `pnLength` bytes of `packetNumber`, big-endian. */
const quicPacketPushNumber = (out: u8[], packetNumber: i64, pnLength: i32): void => {
  for (let k: i32 = pnLength - 1; k >= 0; k -= 1) {
    out.push(toU8(toI32((packetNumber >> (toI64(k) * 8)) & 255)))
  }
}

/**
 * The unprotected long header of an Initial, 0-RTT or Handshake packet
 * (RFC 9000 §17.2), ending with the packet number in `pnLength` bytes, for a
 * payload of `payloadLength` bytes that `quicSealPacket` will protect. The
 * Length field counts the packet number, the payload and the AEAD tag, and is
 * always written in two bytes (RFC 9000 §16 allows the longer form), so the
 * header's size does not move with the payload's and a caller padding a
 * packet to a size knows the header first. `token` goes in an Initial and
 * must be empty otherwise.
 *
 * Answers `null` for another `type`, a connection ID over 20 bytes, a token
 * on a non-Initial packet, a `pnLength` outside 1 to 4, a packet number that
 * is not one, a negative `payloadLength`, or a Length past 16383, the most two
 * bytes hold and far more than a datagram carries.
 */
export const quicLongHeader = (
  type: i32,
  dcid: u8[],
  scid: u8[],
  token: u8[],
  packetNumber: i64,
  pnLength: i32,
  payloadLength: i32
): u8[] | null => {
  const tokenLength: i32 = toI32(token.length)
  if (
    (type !== QUIC_PACKET_INITIAL && type !== QUIC_PACKET_ZERO_RTT && type !== QUIC_PACKET_HANDSHAKE) ||
    (type !== QUIC_PACKET_INITIAL && tokenLength !== 0) ||
    !quicPacketCidFits(dcid) ||
    !quicPacketCidFits(scid) ||
    pnLength < 1 ||
    pnLength > 4 ||
    packetNumber < 0 ||
    packetNumber > QUIC_MAX_VARINT ||
    payloadLength < 0 ||
    payloadLength > QUIC_MAX_LENGTH - pnLength - QUIC_AEAD_TAG_SIZE
  ) {
    return null
  }
  const out: u8[] = []
  quicPacketPushLongPrefix(out, (type << 4) | (pnLength - 1) | 0xc0, dcid, scid)
  if (type === QUIC_PACKET_INITIAL) {
    quicVarintPush(out, toI64(tokenLength))
    quicPacketAppend(out, token)
  }
  quicVarintPushSized(out, toI64(pnLength + payloadLength + QUIC_AEAD_TAG_SIZE), 2)
  quicPacketPushNumber(out, packetNumber, pnLength)
  return out
}

/**
 * The unprotected short header of a 1-RTT packet (RFC 9000 §17.3.1): the
 * first byte with the spin and key-phase bits, the Destination Connection ID
 * and the packet number in `pnLength` bytes. Answers `null` for a connection
 * ID over 20 bytes, a `pnLength` outside 1 to 4 or a packet number that is
 * not one.
 */
export const quicShortHeader = (
  dcid: u8[],
  spin: boolean,
  keyPhase: boolean,
  packetNumber: i64,
  pnLength: i32
): u8[] | null => {
  if (
    !quicPacketCidFits(dcid) ||
    pnLength < 1 ||
    pnLength > 4 ||
    packetNumber < 0 ||
    packetNumber > QUIC_MAX_VARINT
  ) {
    return null
  }
  const out: u8[] = []
  const spinBit: i32 = spin ? 0x20 : 0
  const keyPhaseBit: i32 = keyPhase ? 0x04 : 0
  out.push(toU8((pnLength - 1) | spinBit | keyPhaseBit | 0x40))
  quicPacketAppend(out, dcid)
  quicPacketPushNumber(out, packetNumber, pnLength)
  return out
}

/** A header that stopped at `error`, with what it had read so far. */
const quicPacketRefuse = (header: QuicHeader, error: i32): QuicHeader => {
  header.error = error
  return header
}

/**
 * Reads a one-byte connection-ID length at `at` and that many bytes after it
 * into `cid`, inside `[at, end)`. Answers the offset past the ID, or -1 when it
 * does not fit.
 */
const quicPacketReadCid = (bytes: u8[], at: i32, end: i32, cid: u8[]): i32 => {
  if (at >= end) {
    return -1
  }
  const length: i32 = toI32(bytes[at])
  if (at + 1 + length > end) {
    return -1
  }
  for (let k: i32 = at + 1; k < at + 1 + length; k += 1) {
    if (k < toI32(bytes.length)) {
      cid.push(bytes[k])
    }
  }
  return at + 1 + length
}

/**
 * Parses the header of the packet starting at `datagram[at]`, which is how a
 * datagram of coalesced packets is walked: parse at 0, then at the answer's
 * `end`, until `end` is the datagram's length (RFC 9000 §12.2).
 * `shortDcidLength` is the length of the connection IDs this endpoint hands
 * out, which is the only way to know where a short header's DCID ends
 * (RFC 9000 §17.3.1); one outside 0 to 20 reads as `QUIC_ERR_TRUNCATED`.
 *
 * The answer's `error` says what stopped it; nothing a peer sends panics.
 */
export const quicParseHeader = (datagram: u8[], at: i32, shortDcidLength: i32): QuicHeader => {
  const header: QuicHeader = new QuicHeader()
  const end: i32 = toI32(datagram.length)
  header.start = at
  header.end = end
  if (at < 0 || at >= end) {
    return quicPacketRefuse(header, QUIC_ERR_TRUNCATED)
  }
  const first: i32 = toI32(datagram[at])
  if ((first & 0x80) === 0) {
    header.type = QUIC_PACKET_SHORT
    if ((first & 0x40) === 0) {
      return quicPacketRefuse(header, QUIC_ERR_FIXED_BIT)
    }
    if (shortDcidLength < 0 || shortDcidLength > QUIC_MAX_CID_LENGTH || at + 1 + shortDcidLength > end) {
      return quicPacketRefuse(header, QUIC_ERR_TRUNCATED)
    }
    header.dcid = quicPacketSlice(datagram, at + 1, at + 1 + shortDcidLength)
    header.pnOffset = at + 1 + shortDcidLength
    return header
  }
  if (at + 5 > end) {
    return quicPacketRefuse(header, QUIC_ERR_TRUNCATED)
  }
  let version: i64 = 0
  for (let k: i32 = at + 1; k < at + 5; k += 1) {
    if (k < toI32(datagram.length)) {
      version = (version << 8) | toI64(datagram[k])
    }
  }
  header.version = version
  const afterDcid: i32 = quicPacketReadCid(datagram, at + 5, end, header.dcid)
  if (afterDcid < 0) {
    return quicPacketRefuse(header, QUIC_ERR_TRUNCATED)
  }
  let cursor: i32 = quicPacketReadCid(datagram, afterDcid, end, header.scid)
  if (cursor < 0) {
    return quicPacketRefuse(header, QUIC_ERR_TRUNCATED)
  }
  if (version !== QUIC_VERSION_1) {
    return quicPacketRefuse(header, QUIC_ERR_VERSION)
  }
  if ((first & 0x40) === 0) {
    return quicPacketRefuse(header, QUIC_ERR_FIXED_BIT)
  }
  if (!quicPacketCidFits(header.dcid) || !quicPacketCidFits(header.scid)) {
    return quicPacketRefuse(header, QUIC_ERR_CID_LENGTH)
  }
  const type: i32 = (first >> 4) & 3
  header.type = type
  if (type === QUIC_PACKET_RETRY) {
    // A Retry has no Length and no packet number: the token runs to the
    // integrity tag, and the tag to the end of the datagram (§17.2.5).
    if (cursor + QUIC_RETRY_TAG_SIZE > end) {
      return quicPacketRefuse(header, QUIC_ERR_TRUNCATED)
    }
    header.token = quicPacketSlice(datagram, cursor, end - QUIC_RETRY_TAG_SIZE)
    header.retryTag = quicPacketSlice(datagram, end - QUIC_RETRY_TAG_SIZE, end)
    header.pnOffset = end - QUIC_RETRY_TAG_SIZE
    return header
  }
  if (type === QUIC_PACKET_INITIAL) {
    const tokenLength: i64 = quicVarintRead(datagram, cursor, end)
    if (tokenLength < 0) {
      return quicPacketRefuse(header, QUIC_ERR_TRUNCATED)
    }
    cursor += quicVarintLength(datagram, cursor)
    if (tokenLength > toI64(end - cursor)) {
      return quicPacketRefuse(header, QUIC_ERR_TRUNCATED)
    }
    const tokenEnd: i32 = cursor + toI32(tokenLength)
    header.token = quicPacketSlice(datagram, cursor, tokenEnd)
    cursor = tokenEnd
  }
  const length: i64 = quicVarintRead(datagram, cursor, end)
  if (length < 0) {
    return quicPacketRefuse(header, QUIC_ERR_TRUNCATED)
  }
  cursor += quicVarintLength(datagram, cursor)
  if (length > toI64(end - cursor)) {
    return quicPacketRefuse(header, QUIC_ERR_LENGTH)
  }
  header.pnOffset = cursor
  header.end = cursor + toI32(length)
  return header
}

/**
 * The secrets of RFC 9001 §5.2 for the client's first Destination Connection
 * ID, `dcid`: `initial_secret` is HKDF-Extract under version 1's salt, and the
 * client's and the server's are expanded from it with the labels `client in`
 * and `server in`. Answers `null` for a `dcid` over 20 bytes.
 */
export const quicInitialSecrets = (dcid: u8[]): QuicInitialSecrets | null => {
  if (!quicPacketCidFits(dcid)) {
    return null
  }
  const initial: u8[] = hkdfExtractSha256(quicPacketInitialSalt(), dcid)
  return new QuicInitialSecrets(
    quicPacketExpandLabel(QUIC_AEAD_AES_128_GCM, initial, "client in", 32),
    quicPacketExpandLabel(QUIC_AEAD_AES_128_GCM, initial, "server in", 32)
  )
}

/** The key length of `aead` in bytes, or 0 for no AEAD this module knows. */
const quicPacketKeyLength = (aead: i32): i32 => {
  if (aead === QUIC_AEAD_AES_128_GCM) {
    return 16
  }
  if (aead === QUIC_AEAD_AES_256_GCM || aead === QUIC_AEAD_CHACHA20_POLY1305) {
    return 32
  }
  return 0
}

/** The length of `aead`'s hash, which is its traffic secret's length: 48 for SHA-384, else 32. */
const quicPacketSecretLength = (aead: i32): i32 => (aead === QUIC_AEAD_AES_256_GCM ? 48 : 32)

/** Whether `secret` is a traffic secret for `aead`: an AEAD this module knows, and its hash's length. */
const quicPacketSecretFits = (aead: i32, secret: u8[]): boolean =>
  quicPacketKeyLength(aead) !== 0 && toI32(secret.length) === quicPacketSecretLength(aead)

/**
 * Whether `keys` has the shape `quicKeys` gives: a known AEAD, key and
 * header-protection key of its length, a 12-byte IV, and for the AES suites
 * both keys expanded. The constructor is public only because the language
 * has no private one, so keys made by hand are checked here, once, rather
 * than failing deep inside an AEAD as though a peer had forged the packet.
 */
const quicPacketKeysUsable = (keys: QuicKeys): boolean => {
  const keyLength: i32 = quicPacketKeyLength(keys.aead)
  if (
    keyLength === 0 ||
    toI32(keys.key.length) !== keyLength ||
    toI32(keys.hp.length) !== keyLength ||
    toI32(keys.iv.length) !== QUIC_IV_SIZE
  ) {
    return false
  }
  return keys.aead === QUIC_AEAD_CHACHA20_POLY1305 || (keys.packetAes !== null && keys.hpAes !== null)
}

/**
 * Keys for `aead` with the packet key and IV derived from `secret` (RFC 9001
 * §5.1) and the header-protection key given, which a key update keeps
 * (§6). The caller has checked `secret` with `quicPacketSecretFits`.
 */
const quicPacketDerive = (aead: i32, secret: u8[], hp: u8[], hpAes: AesKey | null): QuicKeys => {
  const keys: QuicKeys = new QuicKeys(
    aead,
    quicPacketExpandLabel(aead, secret, "quic key", quicPacketKeyLength(aead)),
    quicPacketExpandLabel(aead, secret, "quic iv", QUIC_IV_SIZE),
    hp
  )
  keys.hpAes = hpAes
  if (aead !== QUIC_AEAD_CHACHA20_POLY1305) {
    keys.packetAes = aesKey(keys.key)
  }
  return keys
}

/**
 * The packet-protection keys of RFC 9001 §5.1 from a traffic `secret`: the
 * AEAD key (`quic key`), the IV (`quic iv`) and the header-protection key
 * (`quic hp`), each HKDF-Expand-Label with an empty context under the hash
 * `aead` pairs with. Answers `null` for an `aead` this module does not know,
 * or a secret that is not that hash's length.
 */
export const quicKeys = (aead: i32, secret: u8[]): QuicKeys | null => {
  if (!quicPacketSecretFits(aead, secret)) {
    return null
  }
  const hp: u8[] = quicPacketExpandLabel(aead, secret, "quic hp", quicPacketKeyLength(aead))
  return quicPacketDerive(aead, secret, hp, aead === QUIC_AEAD_CHACHA20_POLY1305 ? null : aesKey(hp))
}

/**
 * The next generation's traffic secret for a key update (RFC 9001 §6.1):
 * HKDF-Expand-Label(`secret`, `quic ku`, "", Hash.length). The
 * header-protection key does not change with it (§6), so the new keys are
 * `quicKeysUpdate` of the old keys and this. Answers `null` where `quicKeys`
 * would.
 */
export const quicKeyUpdateSecret = (aead: i32, secret: u8[]): u8[] | null => {
  if (!quicPacketSecretFits(aead, secret)) {
    return null
  }
  return quicPacketExpandLabel(aead, secret, "quic ku", quicPacketSecretLength(aead))
}

/**
 * The next generation's keys in a key update (RFC 9001 §6): the packet key
 * and IV derived from `nextSecret`, which `quicKeyUpdateSecret` made from the
 * current secret, and `keys`' header-protection key kept, expanded as it was,
 * since header protection never changes with the phase. Answers `null` for
 * keys `quicKeys` did not make or a secret of the wrong length.
 */
export const quicKeysUpdate = (keys: QuicKeys, nextSecret: u8[]): QuicKeys | null => {
  if (!quicPacketKeysUsable(keys) || !quicPacketSecretFits(keys.aead, nextSecret)) {
    return null
  }
  return quicPacketDerive(keys.aead, nextSecret, keys.hp, keys.hpAes)
}

/** The bits of the first byte header protection covers: four in a long header, five in a short one (RFC 9001 §5.4.1). */
const quicPacketProtectedBits = (first: i32): i32 => ((first & 0x80) !== 0 ? 0x0f : 0x1f)

/** The first byte's reserved bits: 0x0c in a long header, 0x18 in a short one (RFC 9000 §17.2, §17.3.1). */
const quicPacketReservedBits = (first: i32): i32 => ((first & 0x80) !== 0 ? 0x0c : 0x18)

/** The AEAD nonce for `packetNumber` (RFC 9001 §5.3): the IV with the number XORed into its low 8 bytes, big-endian. */
const quicPacketNonce = (keys: QuicKeys, packetNumber: i64): u8[] => {
  const nonce: u8[] = new Array<u8>(QUIC_IV_SIZE)
  const nonceLength: i32 = toI32(nonce.length)
  for (let k: i32 = 0; k < nonceLength; k += 1) {
    // Byte `k` of the nonce takes byte `k - 4` of the number's eight.
    const pn: i64 = k < 4 ? 0 : (packetNumber >> (toI64(11 - k) * 8)) & 255
    const iv: i32 = k < toI32(keys.iv.length) ? toI32(keys.iv[k]) : 0
    nonce[k] = toU8(iv ^ toI32(pn))
  }
  return nonce
}

/** The five-byte header-protection mask for `sample` under `keys` (RFC 9001 §5.4.3, §5.4.4), or `null`. */
const quicPacketMask = (keys: QuicKeys, sample: u8[]): u8[] | null => {
  if (keys.aead === QUIC_AEAD_CHACHA20_POLY1305) {
    return chacha20HeaderMask(keys.hp, sample)
  }
  const hpAes: AesKey | null = keys.hpAes
  if (hpAes !== null) {
    return aesHeaderMask(hpAes, sample)
  }
  return null
}

/** `keys`' AEAD over `plaintext` with `aad`: the ciphertext and its tag, or `null`. */
const quicPacketSeal = (keys: QuicKeys, nonce: u8[], aad: u8[], plaintext: u8[]): u8[] | null => {
  if (keys.aead === QUIC_AEAD_CHACHA20_POLY1305) {
    return chacha20Poly1305Seal(keys.key, nonce, aad, plaintext)
  }
  const packetAes: AesKey | null = keys.packetAes
  if (packetAes !== null) {
    return aesGcmSeal(packetAes, nonce, aad, plaintext)
  }
  return null
}

/** `keys`' AEAD opening `sealed` with `aad`: the plaintext, or `null` when it does not authenticate. */
const quicPacketOpen = (keys: QuicKeys, nonce: u8[], aad: u8[], sealed: u8[]): u8[] | null => {
  if (keys.aead === QUIC_AEAD_CHACHA20_POLY1305) {
    return chacha20Poly1305Open(keys.key, nonce, aad, sealed)
  }
  const packetAes: AesKey | null = keys.packetAes
  if (packetAes !== null) {
    return aesGcmOpen(packetAes, nonce, aad, sealed)
  }
  return null
}

/**
 * Protects one packet (RFC 9001 §5.3, §5.4.1): `header` is what
 * `quicLongHeader` or `quicShortHeader` built, ending with the packet number,
 * and `packetNumber` is the full number its last bytes truncate. The answer
 * is the header under header protection followed by the AEAD-sealed payload
 * and its tag, ready to send or to coalesce.
 *
 * The header and the arguments are held to each other, because a packet that
 * disagrees with its own header is one the peer silently drops: the header's
 * packet-number bytes must be `packetNumber`'s low bytes, and a long header's
 * two-byte Length must count this `payload`. The sample is the 16 bytes from
 * 4 past the packet number's start, so the packet number and payload together
 * must be at least 4 bytes; a shorter payload has to be padded first (RFC 9001
 * §5.4.2). Answers `null` for any of those, for a header too short for its
 * packet-number length, and for keys `quicKeys` did not make.
 */
export const quicSealPacket = (
  keys: QuicKeys,
  header: u8[],
  packetNumber: i64,
  payload: u8[]
): u8[] | null => {
  const headerLength: i32 = toI32(header.length)
  if (headerLength < 2) {
    return null
  }
  const first: i32 = toI32(header[0])
  const pnLength: i32 = (first & 3) + 1
  const pnOffset: i32 = headerLength - pnLength
  const payloadLength: i32 = toI32(payload.length)
  if (
    !quicPacketKeysUsable(keys) ||
    pnOffset < 1 ||
    pnLength + payloadLength < 4 ||
    packetNumber < 0 ||
    packetNumber > QUIC_MAX_VARINT
  ) {
    return null
  }
  for (let k: i32 = 0; k < pnLength; k += 1) {
    const want: i32 = toI32((packetNumber >> (toI64(pnLength - 1 - k) * 8)) & 255)
    if (pnOffset + k < headerLength && toI32(header[pnOffset + k]) !== want) {
      return null
    }
  }
  if (
    (first & 0x80) !== 0 &&
    quicVarintRead(header, pnOffset - 2, pnOffset) !== toI64(pnLength + payloadLength + QUIC_AEAD_TAG_SIZE)
  ) {
    return null
  }
  const sealed: u8[] | null = quicPacketSeal(keys, quicPacketNonce(keys, packetNumber), header, payload)
  if (sealed === null) {
    return null
  }
  const sealedLength: i32 = toI32(sealed.length)
  const packet: u8[] = new Array<u8>(headerLength + sealedLength)
  const packetLength: i32 = toI32(packet.length)
  for (let k: i32 = 0; k < headerLength && k < packetLength; k += 1) {
    packet[k] = header[k]
  }
  for (let k: i32 = 0; k < sealedLength && headerLength + k < packetLength; k += 1) {
    if (headerLength + k >= 0) {
      packet[headerLength + k] = sealed[k]
    }
  }
  const sampleAt: i32 = pnOffset + 4
  const mask: u8[] | null = quicPacketMask(
    keys,
    quicPacketSlice(packet, sampleAt, sampleAt + QUIC_SAMPLE_SIZE)
  )
  if (mask === null) {
    return null
  }
  packet[0] = toU8(first ^ (toI32(mask[0]) & quicPacketProtectedBits(first)))
  for (let k: i32 = 0; k < pnLength && k + 1 < toI32(mask.length); k += 1) {
    packet[pnOffset + k] = packet[pnOffset + k] ^ mask[k + 1]
  }
  return packet
}

/**
 * Removes header protection from the packet `header` describes (RFC 9001
 * §5.4.1): the answer's `firstByte`, `pnLength`, `packetNumber`, `keyPhase`
 * and `header` are filled in, the packet number recovered against
 * `largestPn`, the largest this endpoint has processed in the packet's space
 * (or -1). The header-protection key never changes with a key update, so a
 * caller holding two generations of keys calls this, reads `keyPhase`, and
 * hands the answer to `quicDecryptPacket` with the generation it names
 * (RFC 9001 §6.3).
 *
 * `error` is the header's own for a header that did not parse,
 * `QUIC_ERR_NOT_PROTECTED` for a Retry, `QUIC_ERR_KEYS` for keys `quicKeys`
 * did not make, and `QUIC_ERR_SAMPLE` for a packet too short to sample.
 */
export const quicRemoveHeaderProtection = (
  keys: QuicKeys,
  datagram: u8[],
  header: QuicHeader,
  largestPn: i64
): QuicPacket => {
  const packet: QuicPacket = new QuicPacket()
  const datagramLength: i32 = toI32(datagram.length)
  if (header.error !== QUIC_PACKET_OK) {
    packet.error = header.error
    return packet
  }
  if (header.type === QUIC_PACKET_RETRY) {
    packet.error = QUIC_ERR_NOT_PROTECTED
    return packet
  }
  if (!quicPacketKeysUsable(keys)) {
    packet.error = QUIC_ERR_KEYS
    return packet
  }
  const pnOffset: i32 = header.pnOffset
  const sampleAt: i32 = pnOffset + 4
  if (
    header.start < 0 ||
    header.start >= pnOffset ||
    header.end > datagramLength ||
    sampleAt + QUIC_SAMPLE_SIZE > header.end
  ) {
    packet.error = QUIC_ERR_SAMPLE
    return packet
  }
  const mask: u8[] | null = quicPacketMask(
    keys,
    quicPacketSlice(datagram, sampleAt, sampleAt + QUIC_SAMPLE_SIZE)
  )
  if (mask === null || toI32(mask.length) < 5) {
    packet.error = QUIC_ERR_KEYS
    return packet
  }
  const protectedFirst: i32 = toI32(datagram[header.start])
  const long: boolean = (protectedFirst & 0x80) !== 0
  const first: i32 = protectedFirst ^ (toI32(mask[0]) & quicPacketProtectedBits(protectedFirst))
  const pnLength: i32 = (first & 3) + 1
  // The sample check above put 20 bytes after `pnOffset` inside the packet,
  // so the packet number's at most 4 are there too.
  const clear: u8[] = quicPacketSlice(datagram, header.start, pnOffset + pnLength)
  clear[0] = toU8(first)
  let truncated: i64 = 0
  for (let k: i32 = 0; k < pnLength; k += 1) {
    const at: i32 = pnOffset - header.start + k
    if (at >= 0 && at < toI32(clear.length) && k + 1 < toI32(mask.length)) {
      const b: u8 = clear[at] ^ mask[k + 1]
      clear[at] = b
      truncated = (truncated << 8) | toI64(b)
    }
  }
  packet.firstByte = first
  packet.pnLength = pnLength
  packet.packetNumber = quicPacketNumberDecode(largestPn, truncated, pnLength)
  packet.keyPhase = !long && (first & 0x04) !== 0
  packet.header = clear
  return packet
}

/**
 * Decrypts the payload of a packet whose header protection
 * `quicRemoveHeaderProtection` took off (RFC 9001 §5.3), filling in
 * `packet.payload` and setting `packet.error`: `QUIC_ERR_KEYS` for keys
 * `quicKeys` did not make, `QUIC_ERR_DECRYPT` when it does not authenticate
 * under `keys`, and `QUIC_ERR_RESERVED_BITS` when it
 * does but the header's reserved bits are not zero (RFC 9000 §17.2, §17.3.1),
 * which the caller is to close the connection over. Answers whether the
 * payload authenticated. A packet already in error is left as it is.
 */
export const quicDecryptPacket = (
  keys: QuicKeys,
  datagram: u8[],
  header: QuicHeader,
  packet: QuicPacket
): boolean => {
  if (packet.error !== QUIC_PACKET_OK) {
    return false
  }
  if (!quicPacketKeysUsable(keys)) {
    packet.error = QUIC_ERR_KEYS
    return false
  }
  const payloadStart: i32 = header.start + toI32(packet.header.length)
  const sealed: u8[] = quicPacketSlice(datagram, payloadStart, header.end)
  const plain: u8[] | null = quicPacketOpen(
    keys,
    quicPacketNonce(keys, packet.packetNumber),
    packet.header,
    sealed
  )
  if (plain === null) {
    packet.error = QUIC_ERR_DECRYPT
    return false
  }
  packet.payload = plain
  if ((packet.firstByte & quicPacketReservedBits(packet.firstByte)) !== 0) {
    packet.error = QUIC_ERR_RESERVED_BITS
  }
  return true
}

/**
 * Opens one packet of a datagram (RFC 9001 §5.3, §5.4): header protection
 * off, the packet number recovered against `largestPn` (or -1), and the
 * payload decrypted. The answer's `error` is `QUIC_PACKET_OK` with `payload`
 * holding the frames, or the `QUIC_ERR_*` of the step that failed — see
 * `quicRemoveHeaderProtection` and `quicDecryptPacket`.
 */
export const quicOpenPacket = (
  keys: QuicKeys,
  datagram: u8[],
  header: QuicHeader,
  largestPn: i64
): QuicPacket => {
  const packet: QuicPacket = quicRemoveHeaderProtection(keys, datagram, header, largestPn)
  quicDecryptPacket(keys, datagram, header, packet)
  return packet
}

/**
 * The Retry integrity tag of RFC 9001 §5.8: AES-128-GCM under version 1's
 * fixed key and nonce over an empty plaintext, with the Retry pseudo-packet —
 * `odcid`'s length and bytes, then the Retry packet up to its tag — as the
 * associated data. `odcid` is the Destination Connection ID of the client's
 * Initial the Retry answers. Answers `null` for an `odcid` over 20 bytes.
 */
export const quicRetryIntegrityTag = (odcid: u8[], retryWithoutTag: u8[]): u8[] | null => {
  const key: AesKey | null = aesKey(quicPacketRetryKey())
  if (key === null || !quicPacketCidFits(odcid)) {
    return null
  }
  const pseudo: u8[] = []
  pseudo.push(toU8(toI32(odcid.length)))
  quicPacketAppend(pseudo, odcid)
  quicPacketAppend(pseudo, retryWithoutTag)
  return aesGcmSeal(key, quicPacketRetryNonce(), pseudo, [])
}

/**
 * A whole Retry packet (RFC 9000 §17.2.5, RFC 9001 §5.8): the long header with
 * `unused` in the first byte's low four bits (the server picks them; mask
 * them with randomness), the client's SCID as `dcid`, the server's new SCID,
 * the address-validation `token`, and the integrity tag over `odcid`, the
 * DCID the client's Initial was sent to. Answers `null` for a connection ID
 * over 20 bytes, an empty token (a client discards that Retry, §17.2.5.2) or
 * `unused` outside 0 to 15.
 */
export const quicRetryPacket = (
  dcid: u8[],
  scid: u8[],
  token: u8[],
  odcid: u8[],
  unused: i32
): u8[] | null => {
  if (
    !quicPacketCidFits(dcid) ||
    !quicPacketCidFits(scid) ||
    toI32(token.length) === 0 ||
    unused < 0 ||
    unused > 15
  ) {
    return null
  }
  const out: u8[] = []
  quicPacketPushLongPrefix(out, unused | 0xf0, dcid, scid)
  quicPacketAppend(out, token)
  const tag: u8[] | null = quicRetryIntegrityTag(odcid, out)
  if (tag === null) {
    return null
  }
  quicPacketAppend(out, tag)
  return out
}

/**
 * Whether the Retry `header` describes carries a valid integrity tag for
 * `odcid`, the DCID of the Initial this client sent (RFC 9001 §5.8). The tag
 * is recomputed over the datagram's bytes and compared in constant time.
 * Answers `false` for a header that is not a Retry that parsed.
 */
export const quicRetryVerify = (odcid: u8[], datagram: u8[], header: QuicHeader): boolean => {
  if (header.error !== QUIC_PACKET_OK || header.type !== QUIC_PACKET_RETRY) {
    return false
  }
  const tag: u8[] | null = quicRetryIntegrityTag(
    odcid,
    quicPacketSlice(datagram, header.start, header.pnOffset)
  )
  if (tag === null) {
    return false
  }
  return timingSafeEqual(tag, header.retryTag)
}
