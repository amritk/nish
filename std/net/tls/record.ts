/**
 * `nish/net/tls/record` — the TLS 1.3 record layer (RFC 8446 §5): the
 * framing of a byte stream into records, the protection of one direction of
 * it under a traffic secret, and the next secret a KeyUpdate moves to.
 *
 *     import { TlsRecordProtection, TlsRecordReader } from "nish/net/tls/record";
 *
 *     const write = new TlsRecordProtection();
 *     write.install(TLS_AES_128_GCM_SHA256, serverApplicationSecret);
 *     const n: i32 = write.seal(TLS_CONTENT_APPLICATION_DATA, data, 0, len, 0, out, at);
 *
 * **Framing.** A record is a five-byte header — the content type, a legacy
 * version and a 16-bit length — and that many bytes. `TlsRecordReader` holds
 * the bytes of a stream that are not yet a whole record, in a buffer allocated
 * once and big enough for the largest record the RFC allows (2^14 + 256 bytes
 * of body), and says as soon as a header is in whether the record is one this
 * layer will read: a content type it does not know is `unexpected_message`,
 * and a length past the limit is `record_overflow`, before any of the body is
 * waited for. The legacy version is ignored, as §5.1 says it must be.
 *
 * **Protection.** `TlsRecordProtection` is one direction of a connection:
 * cleartext until `install` gives it a suite and a traffic secret, then
 * TLSCiphertext (§5.2) under the AEAD the suite names. Each record's nonce is
 * the traffic IV XORed with the 64-bit record sequence number (§5.3), and its
 * additional data is the record's own header. Inside, the content is followed
 * by its real type and by zero padding (§5.4); `open` finds the type by
 * reading every byte of the decrypted record whatever the padding is, so how
 * much padding there was is not in its timing, and refuses a record that is
 * padding and nothing else. Both `seal` and `open` write into a buffer the
 * caller owns and answer a count, and what they allocate on the way dies with
 * the call (docs/LANGUAGE.md, "Memory model"), so a connection that has
 * finished its handshake moves records without moving the arena.
 *
 * **Refusals are alerts.** Every function that can refuse answers the alert to
 * send, negated, as a negative count: `-TLS_ALERT_BAD_RECORD_MAC` for a record
 * that does not authenticate, `-TLS_ALERT_RECORD_OVERFLOW` for one past the
 * limits, `-TLS_ALERT_UNEXPECTED_MESSAGE` for a type that cannot be here, and
 * `-TLS_ALERT_INTERNAL_ERROR` for a mistake of the caller's — a window outside
 * its array, an output too small, content over 2^14 bytes. Nothing the peer
 * sends can make it panic.
 *
 * **Secrets.** A traffic secret arrives as plain bytes, since that is how
 * `nish/net/tls` hands it over. The key, the IV and the AES key schedule
 * derived from it are held in the protection's fields, because a `Secret` may
 * not be one (NL2430), in arrays the protection reuses for every key it is
 * given, and are zeroed when it is installed again or cleared — the key and
 * IV with `secureZero`. The schedule is `u64` words, which `secureZero` does
 * not take, and the copies made while deriving die unwiped or wiped by stores
 * the optimiser may drop (TLS-2 in `docs/security/tls.md`).
 *
 * The record layer is sans-IO: `nish/net/tls/record-server` runs it over a
 * stream for `TlsServer`, and `nish/net/tls-tcp` puts that on a socket.
 * Written from RFC 8446 §5, not ported from another implementation.
 */
import { AesKey, aesGcmOpen, aesGcmSeal, aesKey } from "nish/crypto/aes"
import { chacha20Poly1305Open, chacha20Poly1305Seal } from "nish/crypto/chacha20poly1305"
import {
  TLS_ALERT_INTERNAL_ERROR,
  TLS_ALERT_UNEXPECTED_MESSAGE,
  TLS_LEGACY_VERSION,
} from "nish/net/tls/codec"
import {
  TLS_CHACHA20_POLY1305_SHA256,
  TLS_IV_SIZE,
  tlsExpandLabel,
  tlsSuiteHashLength,
  tlsSuiteKeyLength,
  tlsTrafficIv,
  tlsTrafficKey,
} from "nish/net/tls/schedule"

// ---- The wire's constants ------------------------------------------------------

/** `change_cipher_spec`: the compatibility record of RFC 8446 §D.4, one byte of 1. */
export const TLS_CONTENT_CHANGE_CIPHER_SPEC: i32 = 20
/** `alert` (§6): a level and a description. */
export const TLS_CONTENT_ALERT: i32 = 21
/** `handshake` (§4). */
export const TLS_CONTENT_HANDSHAKE: i32 = 22
/** `application_data`, and the outer type of every protected record. */
export const TLS_CONTENT_APPLICATION_DATA: i32 = 23

/** The bytes before a record's body: its type, a legacy version and a 16-bit length. */
export const TLS_RECORD_HEADER_SIZE: i32 = 5
/** The most content one record carries: 2^14 bytes (§5.1). */
export const TLS_MAX_PLAINTEXT: i32 = 16384
/** The longest body a protected record may have: 2^14 + 256 bytes (§5.2). */
export const TLS_MAX_CIPHERTEXT: i32 = 16640
/** The longest whole record, header included. */
export const TLS_MAX_RECORD: i32 = 16645
/** The AEAD tag every protected record ends with; all three suites' is 16 bytes. */
export const TLS_RECORD_TAG_SIZE: i32 = 16
/** The longest a decrypted record may be: the content, its type, and its padding (§5.4). */
const TLS_MAX_INNER_PLAINTEXT: i32 = 16385

/** The KeyUpdate handshake message (§4.6.3). */
export const TLS_HANDSHAKE_KEY_UPDATE: i32 = 24

/** `close_notify` (§6.1): the sender writes nothing more. */
export const TLS_ALERT_CLOSE_NOTIFY: i32 = 0
/** `bad_record_mac`: a protected record did not authenticate. */
export const TLS_ALERT_BAD_RECORD_MAC: i32 = 20
/** `record_overflow`: a record longer than the limits allow. */
export const TLS_ALERT_RECORD_OVERFLOW: i32 = 22
/** `user_canceled` (§6.1): a warning that the peer is abandoning the handshake; a close follows. */
export const TLS_ALERT_USER_CANCELED: i32 = 90

/** An alert's level byte for `close_notify` and `user_canceled`. TLS 1.3 reads nothing into it (§6). */
export const TLS_ALERT_LEVEL_WARNING: i32 = 1
/** An alert's level byte for every error alert. */
export const TLS_ALERT_LEVEL_FATAL: i32 = 2

/**
 * How many records one key protects before a writer moves to the next with a
 * KeyUpdate: 2^24. AES-GCM's limit is 2^24.5 full-size records per key (RFC
 * 8446 §5.5), and this is under it with room; ChaCha20-Poly1305's is far past
 * it, and one rule for all three suites keeps the writer simple.
 */
export const TLS_KEY_UPDATE_RECORDS: i64 = 16777216

/**
 * The sequence number no record is sealed or opened at: 2^53 − 1. The counter
 * must never wrap (§5.3), and stopping here, at a number no connection
 * reaches, keeps the `i64` it is held in far from its own overflow.
 */
export const TLS_LAST_SEQUENCE: i64 = 9007199254740991

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const TLS_RECORD_FROM: i32 = 0

/**
 * The traffic secret a KeyUpdate moves one direction to (RFC 8446 §7.2):
 * `HKDF-Expand-Label(secret, "traffic upd", "", Hash.length)` over the hash
 * `hashLength` names. The old secret is the caller's to wipe.
 */
export const tlsNextTrafficSecret = (hashLength: i32, secret: u8[]): u8[] => {
  const none: u8[] = []
  return tlsExpandLabel(hashLength, secret, "traffic upd", none, hashLength)
}

/** Whether `[off, off + len)` is a window inside an array of `length` elements: every caller's range check. */
export const tlsRecordWindowFits = (length: i32, off: i32, len: i32): boolean =>
  off >= 0 && len >= 0 && off <= length - len

/** The five header bytes of a record of `type` and body length `len`, written at `out[at]`. */
const tlsWriteRecordHeader = (out: u8[], at: i32, type: i32, len: i32): void => {
  if (at < 0 || at > toI32(out.length) - TLS_RECORD_HEADER_SIZE) {
    return
  }
  out[at] = toU8(type)
  out[at + 1] = toU8(TLS_LEGACY_VERSION >> 8)
  out[at + 2] = toU8(TLS_LEGACY_VERSION & 255)
  out[at + 3] = toU8(len >> 8)
  out[at + 4] = toU8(len & 255)
}

/**
 * The length of the record whose header starts at `buf[off]`, header
 * included, read from the `avail` bytes there: 0 while fewer than five are
 * in, or the alert negated when the header announces a type this layer does
 * not know (`unexpected_message`) or a body past 2^14 + 256 bytes
 * (`record_overflow`, §5.2). The legacy version is not read (§5.1).
 */
export const tlsRecordLength = (buf: u8[], off: i32, avail: i32): i32 => {
  if (!tlsRecordWindowFits(toI32(buf.length), off, avail)) {
    return -TLS_ALERT_INTERNAL_ERROR
  }
  if (avail < TLS_RECORD_HEADER_SIZE) {
    return 0
  }
  const type: i32 = toI32(buf[off])
  if (type < TLS_CONTENT_CHANGE_CIPHER_SPEC || type > TLS_CONTENT_APPLICATION_DATA) {
    return -TLS_ALERT_UNEXPECTED_MESSAGE
  }
  const length: i32 = (toI32(buf[off + 3]) << 8) | toI32(buf[off + 4])
  if (length > TLS_MAX_CIPHERTEXT) {
    return -TLS_ALERT_RECORD_OVERFLOW
  }
  return TLS_RECORD_HEADER_SIZE + length
}

/**
 * The bytes of a stream that are not yet a whole record. The buffer is
 * allocated once, `TLS_MAX_RECORD` bytes, so a reader never grows: `push`
 * takes what fits, and the bytes of a record stay until `consume` lets them
 * go. The caller reads `buffer[start .. start + next())` for the record.
 */
export class TlsRecordReader {
  buffer: u8[]
  /** The first byte not yet consumed. */
  start: i32 = 0
  /** One past the last byte pushed. */
  end: i32 = 0

  constructor() {
    this.buffer = new Array<u8>(TLS_MAX_RECORD)
  }

  /** Forgets every byte, for a connection that starts again in the same slot. */
  reset(): void {
    this.start = 0
    this.end = 0
  }

  /** How many bytes `push` would take now. */
  space(): i32 {
    return toI32(this.buffer.length) - (this.end - this.start)
  }

  /**
   * Copies as many of `data[off .. off + len)` as fit and answers how many,
   * after moving what is held to the front. A window outside `data` is
   * `-TLS_ALERT_INTERNAL_ERROR`, and nothing is copied.
   */
  push(data: u8[], off: i32, len: i32): i32 {
    if (!tlsRecordWindowFits(toI32(data.length), off, len)) {
      return -TLS_ALERT_INTERNAL_ERROR
    }
    const held: i32 = this.end - this.start
    // The held bytes move to the front only when the new ones would not fit after them.
    if (this.start > 0 && toI32(this.buffer.length) - this.end < len) {
      for (let k: i32 = 0; k < held; k++) {
        this.buffer[k] = this.buffer[this.start + k]
      }
      this.start = 0
      this.end = held
    }
    const room: i32 = toI32(this.buffer.length) - this.end
    const take: i32 = len < room ? len : room
    for (let k: i32 = 0; k < take; k++) {
      this.buffer[this.end + k] = data[off + k]
    }
    this.end = this.end + take
    return take
  }

  /**
   * The length of the whole record at `start`, header included, once every
   * byte of it is in; 0 before; or the alert negated for a header this layer
   * refuses, as `tlsRecordLength` says.
   */
  next(): i32 {
    const avail: i32 = this.end - this.start
    const length: i32 = tlsRecordLength(this.buffer, this.start, avail)
    return length > avail ? 0 : length
  }

  /** Lets the first `n` held bytes go: the record `next` answered, once it is handled. */
  consume(n: i32): void {
    const held: i32 = this.end - this.start
    let take: i32 = n < held ? n : held
    if (take < 0) {
      take = 0
    }
    this.start = this.start + take
    if (this.start === this.end) {
      this.start = 0
      this.end = 0
    }
  }
}

/**
 * One direction of a connection's record protection. Cleartext (`suite` 0)
 * until `install`; then every record is sealed or opened under the suite's
 * AEAD with the key and IV of the traffic secret it was given, and its
 * sequence number counts from 0. `contentType` is the type the last `open`
 * found inside a protected record, or the header's type for a cleartext one.
 */
export class TlsRecordProtection {
  /** The AEAD key (§7.3): the suite's key length, zeroed while the direction is cleartext. */
  key: u8[]
  /** The 12-byte traffic IV (§7.3), zeroed while the direction is cleartext. */
  iv: u8[]
  /** The AES key schedule for the two AES-GCM suites, made when a key of its size is first installed and refilled after. */
  aes: AesKey | null = null
  /** The next record's sequence number (§5.3). */
  sequence: i64 = 0
  /**
   * The sequence number at which a writer moves to the next key. Readable and
   * writable, so a test can bring the key update forward; a reader ignores it.
   */
  recordLimit: i64 = 0
  /** The negotiated suite, or 0 while the direction is cleartext. */
  suite: i32 = 0
  /** The real content type of the last record `open` answered. */
  contentType: i32 = 0

  constructor() {
    this.key = []
    this.iv = new Array<u8>(TLS_IV_SIZE)
    this.recordLimit = TLS_KEY_UPDATE_RECORDS
  }

  /** Whether records in this direction are protected. */
  isProtected(): boolean {
    return this.suite !== 0
  }

  /**
   * Back to cleartext, with the sequence number at 0 and the key, the IV and
   * the AES key schedule zeroed: the key and IV with `secureZero`, and the
   * schedule's `u64` words with ordinary stores, which stand because the
   * schedule stays reachable for the next `install` to fill (TLS-2).
   */
  clear(): void {
    secureZero(this.key)
    secureZero(this.iv)
    const aes: AesKey | null = this.aes
    if (aes !== null) {
      for (let k: i32 = 0; k < toI32(aes.roundKeys.length); k++) {
        aes.roundKeys[k] = toU64(0)
      }
      aes.hHi = toU64(0)
      aes.hLo = toU64(0)
    }
    this.suite = 0
    this.sequence = 0
    this.contentType = 0
  }

  /**
   * Protects this direction under `secret` from the next record on: the
   * suite's key and IV (§7.3), the sequence number back to 0, and what this
   * replaces zeroed by `clear`. `false`, leaving the direction cleartext, for
   * a suite `nish/net/tls/schedule` does not know or a secret that is not its
   * hash's length.
   *
   * The key, the IV and the AES key schedule are written into the arrays this
   * direction already has, which are allocated only the first time a key of
   * their size is installed, so a connection that updates its keys a million
   * times allocates nothing that outlives an update.
   */
  install(suite: i32, secret: u8[]): boolean {
    this.clear()
    const hashLength: i32 = tlsSuiteHashLength(suite)
    if (hashLength === 0 || toI32(secret.length) !== hashLength) {
      return false
    }
    this.reserve(suite)
    this.derive(suite, secret)
    this.suite = suite
    return true
  }

  /** Makes the key array, and for AES the key schedule, the size `suite` needs, when they are not already. */
  reserve(suite: i32): void {
    const keyLength: i32 = tlsSuiteKeyLength(suite)
    if (toI32(this.key.length) !== keyLength) {
      this.key = new Array<u8>(keyLength)
    }
    if (suite !== TLS_CHACHA20_POLY1305_SHA256) {
      const rounds: i32 = keyLength === 16 ? 10 : 14
      const aes: AesKey | null = this.aes
      if (aes === null || aes.rounds !== rounds) {
        this.aes = new AesKey(rounds, new Array<u64>((rounds + 1) << 3))
      }
    }
  }

  /**
   * Fills the key, the IV and the AES key schedule from `secret`, into the
   * arrays `reserve` made. The derived key and IV are wiped once copied, and
   * the schedule `aesKey` answered is zeroed, which the optimiser may drop
   * since nothing reads it again (TLS-2).
   *
   * Everything it allocates is released before it returns, by hand: HKDF's
   * HMAC keeps its hash state in objects of its own, which the compiler's
   * automatic scopes do not follow, so without the release each key update
   * would leave a few kilobytes behind. It is sound because nothing made
   * after the mark is reachable when it returns: only numbers are copied out,
   * into arrays `reserve` allocated before it.
   */
  derive(suite: i32, secret: u8[]): void {
    const mark: i64 = Arena.mark()
    const key: u8[] = tlsTrafficKey(suite, secret)
    const iv: u8[] = tlsTrafficIv(suite, secret)
    for (let k: i32 = 0; k < toI32(this.key.length) && k < toI32(key.length); k++) {
      this.key[k] = key[k]
    }
    for (let k: i32 = 0; k < toI32(this.iv.length) && k < toI32(iv.length); k++) {
      this.iv[k] = iv[k]
    }
    const aes: AesKey | null = this.aes
    const fresh: AesKey | null = suite === TLS_CHACHA20_POLY1305_SHA256 ? null : aesKey(key)
    if (aes !== null && fresh !== null) {
      for (let k: i32 = 0; k < toI32(aes.roundKeys.length) && k < toI32(fresh.roundKeys.length); k++) {
        aes.roundKeys[k] = fresh.roundKeys[k]
        fresh.roundKeys[k] = toU64(0)
      }
      aes.hHi = fresh.hHi
      aes.hLo = fresh.hLo
    }
    secureZero(key)
    secureZero(iv)
    Arena.release(mark)
  }

  /**
   * The AES key schedule when the suite is an AES-GCM one, `null` for
   * ChaCha20: a protection that carried AES keeps its schedule for the next
   * AES key, and must not use it for ChaCha20.
   */
  aesForSuite(): AesKey | null {
    return this.suite === TLS_CHACHA20_POLY1305_SHA256 ? null : this.aes
  }

  /**
   * Moves this direction to the next traffic secret (§7.2), the KeyUpdate
   * step: `secret`, the current one, is overwritten in place by the next,
   * and the keys are installed from it. What the derivation allocates is
   * released by hand, as `derive` releases its own: only bytes are copied
   * out, into `secret`, which is older than the mark. False, as `install`
   * answers, when the keys do not install.
   */
  advance(secret: u8[]): boolean {
    const suite: i32 = this.suite
    const mark: i64 = Arena.mark()
    const next: u8[] = tlsNextTrafficSecret(tlsSuiteHashLength(suite), secret)
    for (let k: i32 = 0; k < toI32(secret.length) && k < toI32(next.length); k++) {
      secret[k] = next[k]
    }
    secureZero(next)
    Arena.release(mark)
    return this.install(suite, secret)
  }

  /** The per-record nonce (§5.3): the IV with the sequence number XORed into its last eight bytes, big-endian. */
  nonceInto(nonce: u8[]): void {
    for (let k: i32 = 0; k < TLS_IV_SIZE && k < toI32(nonce.length) && k < toI32(this.iv.length); k++) {
      const shift: i32 = (TLS_IV_SIZE - 1 - k) << 3
      const byte: i32 = shift < 64 ? toI32((this.sequence >> toI64(shift)) & toI64(255)) : 0
      nonce[k] = toU8(toI32(this.iv[k]) ^ byte)
    }
  }

  /**
   * Writes one record of content type `type` holding `data[off .. off + len)`
   * at `out[at]` and answers its length, header included. Cleartext, it is a
   * TLSPlaintext, `padding` must be 0 and `type` may not be
   * `application_data`; protected, it is a TLSCiphertext
   * whose inner plaintext carries `type` and then `padding` zero bytes
   * (§5.4), and the sequence number moves on. `-TLS_ALERT_INTERNAL_ERROR`,
   * with nothing written, for content over 2^14 bytes, a padding that would
   * take the inner plaintext past 2^14 + 1, a window outside `data`, too
   * little room at `out[at]`, or a sequence number that would wrap.
   */
  seal(type: i32, data: u8[], off: i32, len: i32, padding: i32, out: u8[], at: i32): i32 {
    if (!tlsRecordWindowFits(toI32(data.length), off, len) || len > TLS_MAX_PLAINTEXT || padding < 0) {
      return -TLS_ALERT_INTERNAL_ERROR
    }
    if (this.suite === 0) {
      // Application data is never sent in the clear, as `open` never reads
      // it so: a cleartext direction asked for some has lost its keys.
      if (
        type === TLS_CONTENT_APPLICATION_DATA ||
        padding !== 0 ||
        !tlsRecordWindowFits(toI32(out.length), at, TLS_RECORD_HEADER_SIZE + len)
      ) {
        return -TLS_ALERT_INTERNAL_ERROR
      }
      tlsWriteRecordHeader(out, at, type, len)
      for (let k: i32 = 0; k < len; k++) {
        out[at + TLS_RECORD_HEADER_SIZE + k] = data[off + k]
      }
      return TLS_RECORD_HEADER_SIZE + len
    }
    if (padding > TLS_MAX_INNER_PLAINTEXT - 1 - len || this.sequence === TLS_LAST_SEQUENCE) {
      return -TLS_ALERT_INTERNAL_ERROR
    }
    const inner: i32 = len + 1 + padding
    const body: i32 = inner + TLS_RECORD_TAG_SIZE
    if (!tlsRecordWindowFits(toI32(out.length), at, TLS_RECORD_HEADER_SIZE + body)) {
      return -TLS_ALERT_INTERNAL_ERROR
    }
    const plaintext: u8[] = new Array<u8>(inner)
    for (let k: i32 = 0; k < len && k < toI32(plaintext.length); k++) {
      plaintext[k] = data[off + k]
    }
    plaintext[len] = toU8(type)
    const aad: u8[] = new Array<u8>(5)
    tlsWriteRecordHeader(aad, TLS_RECORD_FROM, TLS_CONTENT_APPLICATION_DATA, body)
    const nonce: u8[] = new Array<u8>(12)
    this.nonceInto(nonce)
    const aes: AesKey | null = this.aesForSuite()
    const sealed: u8[] | null =
      aes !== null
        ? aesGcmSeal(aes, nonce, aad, plaintext)
        : chacha20Poly1305Seal(this.key, nonce, aad, plaintext)
    if (sealed === null || toI32(sealed.length) !== body) {
      return -TLS_ALERT_INTERNAL_ERROR
    }
    tlsWriteRecordHeader(out, at, TLS_CONTENT_APPLICATION_DATA, body)
    for (let k: i32 = 0; k < body && k < toI32(sealed.length); k++) {
      out[at + TLS_RECORD_HEADER_SIZE + k] = sealed[k]
    }
    this.sequence = this.sequence + toI64(1)
    return TLS_RECORD_HEADER_SIZE + body
  }

  /**
   * Reads the whole record `record[off .. off + len)`, header included, and
   * writes its content at `out[at]`: answers the content's length and sets
   * `contentType`. Cleartext, the content is the body and the type the
   * header's: `application_data` is `unexpected_message`, since it is never
   * sent in the clear, and a body over 2^14 bytes is `record_overflow`.
   * Protected, the header's type must be `application_data`
   * (`unexpected_message` otherwise), the body must authenticate under this
   * record's nonce with the header as additional data (`bad_record_mac`), the
   * decrypted record may be no longer than 2^14 + 1 bytes
   * (`record_overflow`), and its last non-zero byte is the real type — one
   * that is all zeros is `unexpected_message` (§5.4). Every refusal is the
   * alert negated; a window outside `record`, a `len` that is not the
   * header's, or too little room at `out[at]` is `-TLS_ALERT_INTERNAL_ERROR`.
   */
  open(record: u8[], off: i32, len: i32, out: u8[], at: i32): i32 {
    if (!tlsRecordWindowFits(toI32(record.length), off, len) || len < TLS_RECORD_HEADER_SIZE) {
      return -TLS_ALERT_INTERNAL_ERROR
    }
    const declared: i32 = tlsRecordLength(record, off, len)
    if (declared < 0) {
      return declared
    }
    if (declared !== len) {
      return -TLS_ALERT_INTERNAL_ERROR
    }
    const type: i32 = toI32(record[off])
    const body: i32 = len - TLS_RECORD_HEADER_SIZE
    if (this.suite === 0) {
      if (type === TLS_CONTENT_APPLICATION_DATA) {
        return -TLS_ALERT_UNEXPECTED_MESSAGE
      }
      if (body > TLS_MAX_PLAINTEXT) {
        return -TLS_ALERT_RECORD_OVERFLOW
      }
      if (!tlsRecordWindowFits(toI32(out.length), at, body)) {
        return -TLS_ALERT_INTERNAL_ERROR
      }
      for (let k: i32 = 0; k < body; k++) {
        out[at + k] = record[off + TLS_RECORD_HEADER_SIZE + k]
      }
      this.contentType = type
      return body
    }
    if (type !== TLS_CONTENT_APPLICATION_DATA) {
      return -TLS_ALERT_UNEXPECTED_MESSAGE
    }
    if (body < TLS_RECORD_TAG_SIZE + 1) {
      return -TLS_ALERT_BAD_RECORD_MAC
    }
    if (this.sequence === TLS_LAST_SEQUENCE) {
      return -TLS_ALERT_INTERNAL_ERROR
    }
    const sealed: u8[] = new Array<u8>(body)
    for (let k: i32 = 0; k < body && k < toI32(sealed.length); k++) {
      sealed[k] = record[off + TLS_RECORD_HEADER_SIZE + k]
    }
    const aad: u8[] = new Array<u8>(5)
    for (let k: i32 = 0; k < TLS_RECORD_HEADER_SIZE && k < toI32(aad.length); k++) {
      aad[k] = record[off + k]
    }
    const nonce: u8[] = new Array<u8>(12)
    this.nonceInto(nonce)
    const aes: AesKey | null = this.aesForSuite()
    const inner: u8[] | null =
      aes !== null ? aesGcmOpen(aes, nonce, aad, sealed) : chacha20Poly1305Open(this.key, nonce, aad, sealed)
    if (inner === null) {
      return -TLS_ALERT_BAD_RECORD_MAC
    }
    // The record authenticated, so it is the peer's, and its number is spent
    // whatever its content turns out to be.
    this.sequence = this.sequence + toI64(1)
    const innerLength: i32 = toI32(inner.length)
    if (innerLength > TLS_MAX_INNER_PLAINTEXT) {
      return -TLS_ALERT_RECORD_OVERFLOW
    }
    // The last non-zero byte and where it is, found by reading every byte
    // and keeping each non-zero one by mask, so neither the time nor the
    // addresses read depend on how much of the record was padding.
    let last: i32 = -1
    let found: i32 = 0
    for (let k: i32 = 0; k < innerLength; k++) {
      const b: i32 = toI32(inner[k])
      const keep: i32 = (0 - b) >> 31
      last = (k & keep) | (last & ~keep)
      found = (b & keep) | (found & ~keep)
    }
    if (last < 0) {
      return -TLS_ALERT_UNEXPECTED_MESSAGE
    }
    if (!tlsRecordWindowFits(toI32(out.length), at, last)) {
      return -TLS_ALERT_INTERNAL_ERROR
    }
    for (let k: i32 = 0; k < last && k < innerLength; k++) {
      out[at + k] = inner[k]
    }
    this.contentType = found
    return last
  }
}
