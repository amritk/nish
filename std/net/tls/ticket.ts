/**
 * `nish/net/tls/ticket` — TLS 1.3 session tickets a server seals for itself
 * (RFC 8446 §4.6.1), and the strike register that makes each one single-use
 * (§8.1). `docs/security/tls.md`, "Resumption", is the design this follows.
 *
 *     import {
 *       TLS_TICKET_STRIKES_DEFAULT, TlsTicketKeyInfo, TlsTicketState, TlsTicketStrikes,
 *       tlsTicketKeyDraw, tlsTicketKeyDue, tlsTicketOpen, tlsTicketSeal, tlsTicketSize,
 *     } from "nish/net/tls/ticket";
 *     import { monotonicNanos } from "nish:process";
 *     import { wipe } from "nish:secret";
 *     // secureZero is a builtin and needs no import
 *
 *     const info = new TlsTicketKeyInfo()
 *     const key = tlsTicketKeyDraw(info, monotonicNanos())
 *     const strikes = new TlsTicketStrikes(TLS_TICKET_STRIKES_DEFAULT)
 *
 *     // Issuing: `state` is a TlsTicketState the server filled from a finished handshake.
 *     const ticket: u8[] = new Array<u8>(tlsTicketSize(state))
 *     const written = tlsTicketSeal(key, info, state, monotonicNanos(), ticket)  // 0: send no ticket
 *
 *     // Resuming (`TlsServer.resume` does this for a server): `offered` is a ticket the client sent.
 *     const now = monotonicNanos()
 *     const opened = new TlsTicketState()
 *     const fresh = tlsTicketOpen(key, info, offered, now, opened)
 *     if (fresh && strikes.take(opened.id, opened.expiresAt(), now)) {
 *       // resume with opened.psk[0 .. opened.pskLength), then secureZero(opened.psk)
 *     }
 *     // when tlsTicketKeyDue(info, now), rotate as "Keys" below says; wipe(key) before it goes
 *
 * **The ticket.** A ticket is the key id (16 bytes, public, the additional data) ‖ a fresh
 * random nonce (12) ‖ the ChaCha20-Poly1305 ciphertext of the state ‖ its tag
 * (16). The state is what a resumed handshake reads: the suite, the time the
 * ticket was issued, its lifetime, the time of the full handshake its chain
 * started from, the server name, and the resumption PSK. Its plaintext is the
 * suite (2 bytes), the issue time (8), the lifetime in seconds (4), the chain
 * start (8), the server name with a one-byte length, and the PSK with a
 * one-byte length, every integer big-endian.
 *
 * **Time.** Every time is `monotonicNanos()`, read by the caller outside `expose` and
 * handed in as `now`: keys never leave the process, so neither does a ticket,
 * and a clock that cannot step keeps the strike register honest.
 *
 * **Keys.** A ticket key is a `Secret<u8[]>` of 32 random bytes, which no
 * class may hold (NL2430): the program keeps its current and previous keys
 * in locals and lends them to `tlsTicketSeal` and `tlsTicketOpen`, which
 * read them only inside `exposeWith`. Beside each key it keeps a
 * `TlsTicketKeyInfo` — the id, the time it was drawn, how many tickets it has
 * sealed, and its seal cap. `tlsTicketKeyDraw` draws a key into a record and
 * `tlsTicketKeyDue` says when to replace it. The rotation turn is the
 * program's, because a function hands back one `Secret` and may not reassign
 * a borrowed one: `wipe(previous)`, `previous = current`,
 * `previousInfo.copyFrom(currentInfo)`, `current = tlsTicketKeyDraw(currentInfo, now)`.
 *
 * **What the module enforces from the record.** A key seals for 12 hours of
 * awake time after its draw and until its seal cap (2^30 tickets), and opens
 * for 14 hours, inclusive; a ticket opens while `now` is no earlier than its
 * issue time, no later than issue time plus lifetime, and no later than 24
 * hours after its chain started, and only when its sealed lifetime is at
 * most 7200 s and its chain start is no later than its issue time.
 *
 * **Wiping.** The plaintext of a seal or an open is a plain `u8[]` made in
 * a `using a = arena()` block, wiped with `secureZero` once, at the point
 * every path reaches; a failed open also wipes the state's PSK array. The
 * seal's exposed function wipes the copy of the plaintext it hands the
 * AEAD, and what the AEAD makes from the key is wiped by the AEAD
 * (`nish/crypto/chacha20poly1305`).
 *
 * **`TlsTicketStrikes`** records each ticket's id (its nonce) until the
 * ticket expires or 7200 s after the recording, whichever is sooner, in a
 * table made once at its capacity. It never grows and fails closed when
 * full.
 *
 * Written from the RFC and the design record, not ported from another
 * implementation. Private names carry the `tlsTicket` prefix because a `std/`
 * module's private functions share the importing program's flat symbol
 * namespace (`docs/wp26-stdlib.md` §3e).
 */

import {
  CHACHA20POLY1305_NONCE_SIZE,
  CHACHA20_KEY_SIZE,
  POLY1305_TAG_SIZE,
  chacha20Poly1305Open,
  chacha20Poly1305Seal,
} from "nish/crypto/chacha20poly1305"
import { tlsSuiteHashLength } from "nish/net/tls/schedule"
import { Secret, exposeWith, secret, wipe } from "nish:secret"

/** A ticket key's id, sent in the clear at the head of each ticket it seals. */
export const TLS_TICKET_KEY_ID_SIZE: i32 = 16

/** A ticket key: 32 bytes, ChaCha20-Poly1305's key size. */
export const TLS_TICKET_KEY_SIZE: i32 = CHACHA20_KEY_SIZE

/** A ticket's nonce, which is also its id in the strike register. */
export const TLS_TICKET_NONCE_SIZE: i32 = CHACHA20POLY1305_NONCE_SIZE

/** The `ticket_lifetime` this server sends, and the longest a ticket it opens may claim, in seconds. */
export const TLS_TICKET_LIFETIME_SECONDS: i32 = 7200

/** The longest server name a ticket carries: a session with a longer one is issued none. */
export const TLS_TICKET_SERVER_NAME_MAX: i32 = 255

/** The longest resumption PSK: SHA-384's length. */
export const TLS_TICKET_PSK_MAX: i32 = 48

/** How many tickets a key seals before `tlsTicketSeal` refuses it: 2^30. */
export const TLS_TICKET_SEAL_CAP: i64 = 1073741824

/** The strike register's capacity when the program has no other figure: 65,536 ids, about 1.3 MB. */
export const TLS_TICKET_STRIKES_DEFAULT: i32 = 65536

/** Nanoseconds in a second. */
const TLS_TICKET_NANOS: i64 = 1000000000

/** A key's issue window: 12 hours of awake time after its draw, in nanoseconds. */
export const TLS_TICKET_SEAL_WINDOW: i64 = TLS_TICKET_NANOS * 43200

/** How long after its draw a key opens tickets: its issue window and one lifetime more, 14 hours. */
export const TLS_TICKET_OPEN_WINDOW: i64 = TLS_TICKET_NANOS * 50400

/** The longest a chain of resumptions runs after the full handshake it started from: 24 hours. */
export const TLS_TICKET_CHAIN_LIMIT: i64 = TLS_TICKET_NANOS * 86400

/** One server ticket lifetime, in nanoseconds: the longest a strike entry is held. */
const TLS_TICKET_LIFETIME_NANOS: i64 = TLS_TICKET_NANOS * 7200

/** The plaintext's fixed part: suite 2, issue time 8, lifetime 4, chain start 8, and the two length bytes. */
const TLS_TICKET_PLAIN_FIXED: i32 = 24

/** Where the server name's length byte sits in the plaintext. */
const TLS_TICKET_NAME_AT: i32 = 22

/**
 * `a + b`, held at the `i64` range's ends rather than past them. Two values of one
 * sign sum within 2^64 of zero, so their sum in `u64` reads across the sign bit only
 * when it has left the range.
 */
const tlsTicketAdd = (a: i64, b: i64): i64 => {
  if (a >= 0) {
    if (b < 0) {
      return a + b
    }
    const sum: i64 = toI64(toU64(a) + toU64(b))
    return sum >= 0 ? sum : toI64((toU64(0) - toU64(1)) >> toU64(1))
  }
  if (b >= 0) {
    return a + b
  }
  const sum: i64 = toI64(toU64(a) + toU64(b))
  return sum < 0 ? sum : toI64(toU64(1) << toU64(63))
}

/** `now - then` for a `now` no earlier than `then`: exact, since two `i64`s in that order differ by less than 2^64. */
const tlsTicketElapsed = (now: i64, then: i64): u64 => toU64(now) - toU64(then)

/**
 * A ticket key's public record. A class, so the program may keep it in a
 * field or anywhere else; the key it describes is a `Secret` the program
 * keeps in a local.
 */
export class TlsTicketKeyInfo {
  /** The key id, the ticket's additional data. */
  id: u8[]
  /** When the key was drawn, in `monotonicNanos()`. */
  createdAt: i64
  /** How many tickets the key has sealed. */
  sealed: i64
  /** How many it may seal: `TLS_TICKET_SEAL_CAP` unless the program lowers it. */
  sealCap: i64

  /**
   * Makes a blank record, nothing sealed yet and the cap at
   * `TLS_TICKET_SEAL_CAP`, for `tlsTicketKeyDraw` to fill.
   */
  constructor() {
    this.id = new Array<u8>(TLS_TICKET_KEY_ID_SIZE)
    this.createdAt = 0
    this.sealed = 0
    this.sealCap = TLS_TICKET_SEAL_CAP
  }

  /**
   * Copies `other` into this record, as the rotation turn does from the current key's to the previous one's.
   * The id is copied byte by byte into this record's own array, so the two records share nothing.
   *
   * @param other The record to copy from, left unchanged.
   */
  copyFrom(other: TlsTicketKeyInfo): void {
    const to: u8[] = this.id
    const from: u8[] = other.id
    // Both ids are `TLS_TICKET_KEY_ID_SIZE` bytes from the constructor, so the length bounds never stop the copy.
    for (let k: i32 = 0; k < TLS_TICKET_KEY_ID_SIZE && k < toI32(to.length) && k < toI32(from.length); k++) {
      to[k] = from[k]
    }
    this.createdAt = other.createdAt
    this.sealed = other.sealed
    this.sealCap = other.sealCap
  }
}

/**
 * What a ticket carries: filled by the server before `tlsTicketSeal`, and by
 * `tlsTicketOpen` from a ticket that opens. Made once and reused; the server
 * name and PSK are windows of fixed arrays, `serverNameLength` and
 * `pskLength` bytes long.
 */
export class TlsTicketState {
  /** When the ticket was issued, in `monotonicNanos()`: `tlsTicketSeal` writes its `now` here. */
  issuedAt: i64
  /** When the full handshake this ticket's chain started from ran. */
  chainStart: i64
  /** The server name the session agreed, `serverNameLength` bytes of it; none when the client sent none. */
  serverName: u8[]
  /** The resumption PSK, `pskLength` bytes of it: the suite's hash length. */
  psk: u8[]
  /** The ticket's nonce, written by `tlsTicketOpen`: its id in the strike register. */
  id: u8[]
  /** The cipher suite the session agreed. */
  suite: i32
  /** The ticket's lifetime in seconds, at most `TLS_TICKET_LIFETIME_SECONDS`. */
  lifetime: i32
  /** How many bytes of `serverName` the name fills, 0 to `TLS_TICKET_SERVER_NAME_MAX`; 0 when the client sent no name. */
  serverNameLength: i32
  /** How many bytes of `psk` the PSK fills: 32 or 48, the suite's hash length. */
  pskLength: i32

  /**
   * Makes an empty state, its server name and PSK arrays at their fixed sizes
   * and both lengths 0.
   */
  constructor() {
    this.suite = 0
    this.issuedAt = 0
    this.lifetime = 0
    this.chainStart = 0
    this.serverName = new Array<u8>(TLS_TICKET_SERVER_NAME_MAX)
    this.serverNameLength = 0
    this.psk = new Array<u8>(TLS_TICKET_PSK_MAX)
    this.pskLength = 0
    this.id = new Array<u8>(TLS_TICKET_NONCE_SIZE)
  }

  /**
   * When the ticket stops opening: its issue time plus its lifetime. It opens at that instant, and not after.
   *
   * @returns The expiry in `monotonicNanos()`, which `TlsTicketStrikes.take` takes as its `expiresAt`;
   *   one past the `i64` range is held at its end.
   */
  expiresAt(): i64 {
    return tlsTicketAdd(this.issuedAt, toI64(this.lifetime) * TLS_TICKET_NANOS)
  }
}

/**
 * Draws a fresh key: 32 random bytes moved into the `Secret` it answers, a
 * fresh random id in `info`, `now` as its creation time and a count of 0.
 * The seal cap is left as the program set it.
 *
 * @param info The record to fill for the new key; its old id, time and count are overwritten.
 * @param now The draw time, in `monotonicNanos()`.
 * @returns The new key, owned by the caller, who keeps it in a local and wipes it when it is replaced.
 */
export const tlsTicketKeyDraw = (info: TlsTicketKeyInfo, now: i64): Secret<u8[]> => {
  const key: u8[] = new Array<u8>(TLS_TICKET_KEY_SIZE)
  crypto.getRandomValues(key)
  crypto.getRandomValues(info.id)
  info.createdAt = now
  info.sealed = 0
  return secret(key)
}

/**
 * True when the key `info` describes should be replaced: at the end of its issue window, or at its seal cap.
 *
 * @param info The current key's record.
 * @param now The time to judge at, in `monotonicNanos()`.
 * @returns True when the program should rotate now; the key still opens tickets for a while after.
 */
export const tlsTicketKeyDue = (info: TlsTicketKeyInfo, now: i64): boolean =>
  (now >= info.createdAt && tlsTicketElapsed(now, info.createdAt) >= toU64(TLS_TICKET_SEAL_WINDOW)) ||
  info.sealed >= info.sealCap

/** True when the key `info` describes may seal at `now`: within its issue window, inclusive, and under its cap. */
const tlsTicketKeySeals = (info: TlsTicketKeyInfo, now: i64): boolean =>
  now >= info.createdAt &&
  tlsTicketElapsed(now, info.createdAt) <= toU64(TLS_TICKET_SEAL_WINDOW) &&
  info.sealed < info.sealCap

/** True when the key `info` describes may open at `now`: within 14 hours of its draw, inclusive. */
const tlsTicketKeyOpens = (info: TlsTicketKeyInfo, now: i64): boolean =>
  now >= info.createdAt && tlsTicketElapsed(now, info.createdAt) <= toU64(TLS_TICKET_OPEN_WINDOW)

/** The plaintext's length for `state`, or -1 when the state cannot be sealed. */
const tlsTicketPlainLength = (state: TlsTicketState): i32 => {
  const hashLength: i32 = tlsSuiteHashLength(state.suite)
  const nameLength: i32 = state.serverNameLength
  const pskLength: i32 = state.pskLength
  // A known suite's hash is 32 or 48 bytes, so the PSK's bound below never refuses one the hash test passed.
  if (
    hashLength === 0 ||
    pskLength !== hashLength ||
    pskLength < 0 ||
    pskLength > 48 ||
    pskLength > toI32(state.psk.length) ||
    nameLength < 0 ||
    nameLength > 255 ||
    nameLength > toI32(state.serverName.length) ||
    state.lifetime < 0
  ) {
    return -1
  }
  return TLS_TICKET_PLAIN_FIXED + nameLength + pskLength
}

/**
 * The bytes `tlsTicketSeal` makes of `state`, 0 when it cannot seal it: a
 * suite this server does not know, a PSK of another length than its hash, or
 * a server name longer than 255 bytes, which is issued no ticket.
 *
 * @param state The state to be sealed, with its suite, server name and PSK lengths set.
 * @returns The ticket's length in bytes, the least `out` that `tlsTicketSeal` accepts, or 0.
 */
export const tlsTicketSize = (state: TlsTicketState): i32 => {
  const plain: i32 = tlsTicketPlainLength(state)
  // `tlsTicketPlainLength` answers at most 327, so the upper test never refuses.
  if (plain < 0 || plain > 327) {
    return 0
  }
  return TLS_TICKET_KEY_ID_SIZE + TLS_TICKET_NONCE_SIZE + plain + POLY1305_TAG_SIZE
}

/**
 * Writes `value`'s low `size` bytes, 0 to 8, big-endian at `at`, and answers
 * true; false, writing nothing, when they do not all fit in `buf`. Every
 * caller has sized `buf` to hold them and refuses on false.
 */
const tlsTicketPut = (buf: u8[], at: i32, value: i64, size: i32): boolean => {
  if (at < 0 || size < 0 || size > 8 || at > toI32(buf.length) - size) {
    return false
  }
  for (let j: i32 = at; j < toI32(buf.length) && j - at < size; j++) {
    const shift: i64 = toI64(size - 1) * 8 - toI64(j - at) * 8
    buf[j] = toU8(toI32((value >> shift) & 255))
  }
  return true
}

/**
 * Reads `size` bytes, 0 to 8, big-endian at `at`, or -1 when they do not all
 * lie inside `buf`. `tlsTicketParse` checks every window before it reads, so
 * no read reaches the -1; an 8-byte value may itself be -1, and only that
 * entry check stands for those.
 */
const tlsTicketGet = (buf: u8[], at: i32, size: i32): i64 => {
  let value: i64 = 0
  if (at < 0 || size < 0 || size > 8 || at > toI32(buf.length) - size) {
    return -1
  }
  for (let j: i32 = at; j < toI32(buf.length) && j - at < size; j++) {
    value = (value << 8) | toI64(buf[j])
  }
  return value
}

/**
 * Copies `length` bytes from `src[srcAt]` to `dst[dstAt]` and answers true;
 * false, copying nothing, when either window does not fit. Every caller has
 * checked both windows and refuses on false; the bounds in the loop are the
 * prover's.
 */
const tlsTicketCopy = (dst: u8[], dstAt: i32, src: u8[], srcAt: i32, length: i32): boolean => {
  if (
    length < 0 ||
    dstAt < 0 ||
    srcAt < 0 ||
    toI64(dstAt) + toI64(length) > toI64(dst.length) ||
    toI64(srcAt) + toI64(length) > toI64(src.length)
  ) {
    return false
  }
  for (let k: i32 = 0; k < length; k++) {
    // A position past an `i32` wraps negative and is skipped like one past the array.
    const to: i32 = toI32(toI64(dstAt) + toI64(k))
    const from: i32 = toI32(toI64(srcAt) + toI64(k))
    if (to >= 0 && to < toI32(dst.length) && from >= 0 && from < toI32(src.length)) {
      dst[to] = src[from]
    }
  }
  return true
}

/**
 * A copy of `buf[from .. to)`, in an array made at its exact size so that no
 * growth leaves a stray copy of a plaintext behind; empty when the window is
 * not within `buf` or is longer than 65,535 bytes, which no caller asks for:
 * a ticket over that length is refused before it is opened.
 */
const tlsTicketRange = (buf: u8[], from: i32, to: i32): u8[] => {
  const none: u8[] = []
  if (from < 0 || to > toI32(buf.length)) {
    return none
  }
  const length: i64 = toI64(to) - toI64(from)
  if (length < 0 || length > 65535) {
    return none
  }
  const out: u8[] = new Array<u8>(toU16(length))
  if (!tlsTicketCopy(out, 0, buf, from, toI32(out.length))) {
    return none
  }
  return out
}

/**
 * Seals the plaintext of `input`, laid out as the key id ‖ the nonce ‖ the
 * plaintext, under the exposed key: the `exposeWith` function of
 * `tlsTicketSeal`, which hands it one array because an arrow captures
 * nothing. The AEAD takes the plaintext as an array of its own, so the copy
 * made for it is wiped here with `wipe`, after the seal, since `secureZero`
 * is C and the function `exposeWith` runs may reach none. Empty when the AEAD refuses.
 */
const tlsTicketSealExposed = (key: u8[], input: u8[]): u8[] => {
  const head: i32 = TLS_TICKET_KEY_ID_SIZE + TLS_TICKET_NONCE_SIZE
  const plain: u8[] = tlsTicketRange(input, head, toI32(input.length))
  const sealed: u8[] | null = chacha20Poly1305Seal(
    key,
    tlsTicketRange(input, TLS_TICKET_KEY_ID_SIZE, head),
    tlsTicketRange(input, 0, TLS_TICKET_KEY_ID_SIZE),
    plain
  )
  wipe(plain)
  if (sealed === null) {
    const none: u8[] = []
    return none
  }
  return sealed
}

/**
 * Seals `state` under `key`, the key `info` describes, into `out` from index
 * 0, and answers the ticket's length; 0 when it seals nothing: a key past its
 * issue window or at its seal cap, a state `tlsTicketSize` refuses, or an
 * `out` too short. The issue time sealed is `now`, which is also written to
 * `state.issuedAt`; the nonce is drawn fresh, and `info` counts the ticket.
 * The plaintext is built after the key id and nonce in one array, the one
 * `exposeWith` hands its function, and wiped once, after the seal and its
 * refusals.
 *
 * @param key The ticket key, lent: it is read only inside `exposeWith`, and stays the caller's to wipe.
 * @param info The key's record: its id heads the ticket and its count goes up by one on a seal.
 * @param state What the ticket carries; its `issuedAt` is overwritten with `now`, unless the key
 *   cannot seal at `now`, the state does not fit a ticket or `out` is too short.
 * @param now The issue time, in `monotonicNanos()`.
 * @param out Where the ticket is written, from index 0; at least `tlsTicketSize(state)` bytes.
 * @returns How many bytes of `out` hold the ticket, or 0 when nothing was sealed.
 */
export const tlsTicketSeal = (
  key: Secret<u8[]>,
  info: TlsTicketKeyInfo,
  state: TlsTicketState,
  now: i64,
  out: u8[]
): i32 => {
  const plainLength: i32 = tlsTicketPlainLength(state)
  const size: i32 = tlsTicketSize(state)
  const nameLength: i32 = state.serverNameLength
  const pskLength: i32 = state.pskLength
  const id: u8[] = info.id
  // `tlsTicketPlainLength` has bounded the plaintext and both lengths, and a key that seals has `sealed`
  // under its cap, so the tests after the first three never refuse a record `tlsTicketKeyDraw` filled.
  if (
    !tlsTicketKeySeals(info, now) ||
    plainLength < 0 ||
    size > toI32(out.length) ||
    plainLength > 327 ||
    nameLength < 0 ||
    nameLength > 255 ||
    pskLength < 0 ||
    pskLength > 48 ||
    toI32(id.length) !== TLS_TICKET_KEY_ID_SIZE
  ) {
    return 0
  }
  using _scope = arena()
  state.issuedAt = now
  const head: i32 = TLS_TICKET_KEY_ID_SIZE + TLS_TICKET_NONCE_SIZE
  const input: u8[] = new Array<u8>(toU16(head + plainLength))
  const nonce: u8[] = new Array<u8>(TLS_TICKET_NONCE_SIZE)
  crypto.getRandomValues(nonce)
  const nameAt: i32 = head + TLS_TICKET_NAME_AT
  const pskAt: i32 = nameAt + 1 + nameLength
  // `input` was made at the plaintext's size, so every field fits; a state
  // whose arrays are shorter than its lengths is refused, not sealed short.
  const filled: boolean =
    tlsTicketCopy(input, 0, id, 0, TLS_TICKET_KEY_ID_SIZE) &&
    tlsTicketCopy(input, TLS_TICKET_KEY_ID_SIZE, nonce, 0, TLS_TICKET_NONCE_SIZE) &&
    tlsTicketPut(input, head, toI64(state.suite), 2) &&
    tlsTicketPut(input, head + 2, now, 8) &&
    tlsTicketPut(input, head + 10, toI64(state.lifetime), 4) &&
    tlsTicketPut(input, head + 14, state.chainStart, 8) &&
    tlsTicketPut(input, nameAt, toI64(nameLength), 1) &&
    tlsTicketCopy(input, nameAt + 1, state.serverName, 0, nameLength) &&
    tlsTicketPut(input, pskAt, toI64(pskLength), 1) &&
    tlsTicketCopy(input, pskAt + 1, state.psk, 0, pskLength)
  if (!filled) {
    secureZero(input)
    return 0
  }
  const sealed: u8[] = exposeWith(key, input, tlsTicketSealExposed)
  let written: i32 = 0
  if (
    toI32(sealed.length) === plainLength + POLY1305_TAG_SIZE &&
    tlsTicketCopy(out, 0, input, 0, head) &&
    tlsTicketCopy(out, head, sealed, 0, toI32(sealed.length))
  ) {
    // Under its cap, so the count never reaches the `i64` top `tlsTicketAdd` would hold it at.
    info.sealed = tlsTicketAdd(info.sealed, 1)
    written = size
  }
  secureZero(input)
  return written
}

/**
 * Opens `ticket`'s ciphertext under the exposed key: the `exposeWith` function
 * of `tlsTicketOpen`. The plaintext in a fresh array, empty when the tag does
 * not verify.
 */
const tlsTicketOpenExposed = (key: u8[], ticket: u8[]): u8[] => {
  const head: i32 = TLS_TICKET_KEY_ID_SIZE + TLS_TICKET_NONCE_SIZE
  const plain: u8[] | null = chacha20Poly1305Open(
    key,
    tlsTicketRange(ticket, TLS_TICKET_KEY_ID_SIZE, head),
    tlsTicketRange(ticket, 0, TLS_TICKET_KEY_ID_SIZE),
    tlsTicketRange(ticket, head, toI32(ticket.length))
  )
  if (plain === null) {
    const none: u8[] = []
    return none
  }
  return plain
}

/**
 * Reads `plain` into `out` and answers whether it is a ticket that opens at
 * `now`: a well-formed plaintext of a known suite, a sealed lifetime of at most
 * 7200 s, a chain start no later than its issue time, and `now` within its
 * bounds, each inclusive.
 */
const tlsTicketParse = (plain: u8[], now: i64, out: TlsTicketState): boolean => {
  const length: i32 = toI32(plain.length)
  if (length < TLS_TICKET_PLAIN_FIXED) {
    return false
  }
  const suite: i32 = toI32(tlsTicketGet(plain, 0, 2))
  const issuedAt: i64 = tlsTicketGet(plain, 2, 8)
  const lifetime: i64 = tlsTicketGet(plain, 10, 4)
  const chainStart: i64 = tlsTicketGet(plain, 14, 8)
  // Each length is one byte, so its bound below never refuses. The name's bound stays the literal 255
  // (`TLS_TICKET_SERVER_NAME_MAX`): the prover reads literal guards, and the sums below need it.
  const nameLength: i32 = toI32(tlsTicketGet(plain, TLS_TICKET_NAME_AT, 1))
  if (nameLength < 0 || nameLength > 255) {
    return false
  }
  const pskAt: i32 = TLS_TICKET_NAME_AT + 1 + nameLength
  if (pskAt >= length) {
    return false
  }
  const pskLength: i32 = toI32(tlsTicketGet(plain, pskAt, 1))
  if (pskLength < 0 || pskLength > 255) {
    return false
  }
  const hashLength: i32 = tlsSuiteHashLength(suite)
  if (
    pskAt + 1 + pskLength !== length ||
    hashLength === 0 ||
    pskLength !== hashLength ||
    pskLength > toI32(out.psk.length) ||
    nameLength > toI32(out.serverName.length)
  ) {
    return false
  }
  out.suite = suite
  out.issuedAt = issuedAt
  out.lifetime = toI32(lifetime)
  out.chainStart = chainStart
  out.serverNameLength = nameLength
  out.pskLength = pskLength
  // Both windows were checked above; a copy that cannot land whole refuses.
  if (
    !tlsTicketCopy(out.serverName, 0, plain, TLS_TICKET_NAME_AT + 1, nameLength) ||
    !tlsTicketCopy(out.psk, 0, plain, pskAt + 1, pskLength)
  ) {
    return false
  }
  return (
    lifetime <= toI64(TLS_TICKET_LIFETIME_SECONDS) &&
    chainStart <= issuedAt &&
    issuedAt <= now &&
    now <= out.expiresAt() &&
    tlsTicketElapsed(now, chainStart) <= toU64(TLS_TICKET_CHAIN_LIMIT)
  )
}

/**
 * True when `ticket` is long enough to hold a state, no longer than 65,535 bytes
 * (a `ticket<1..2^16-1>`, RFC 8446 §4.6.1), and names `info`'s key id.
 */
const tlsTicketNamesKey = (info: TlsTicketKeyInfo, ticket: u8[]): boolean => {
  if (
    toI32(ticket.length) <
      TLS_TICKET_KEY_ID_SIZE + TLS_TICKET_NONCE_SIZE + TLS_TICKET_PLAIN_FIXED + POLY1305_TAG_SIZE ||
    toI32(ticket.length) > 65535
  ) {
    return false
  }
  const id: u8[] = info.id
  if (toI32(id.length) !== TLS_TICKET_KEY_ID_SIZE) {
    return false
  }
  for (let k: i32 = 0; k < TLS_TICKET_KEY_ID_SIZE && k < toI32(ticket.length) && k < toI32(id.length); k++) {
    if (ticket[k] !== id[k]) {
      return false
    }
  }
  return true
}

/**
 * Opens `ticket` under `key`, the key `info` describes, into `out`, and
 * answers whether it opened at `now`. False — with nothing of the key read —
 * when the ticket names another key id, is longer than 65,535 bytes, or the key
 * is past 14 hours of awake time; false when the tag does not verify, the plaintext is malformed, or the
 * ticket is outside its bounds (`tlsTicketParse`). On true, `out` holds the
 * state and the ticket's nonce in `id`, its strike-register id. On false after
 * the AEAD ran, the state's PSK array is wiped. The plaintext is wiped once,
 * after the branch on the tag and on the parse, so the one wipe covers every
 * path.
 *
 * @param key The ticket key, lent: it is read only inside `exposeWith`, and stays the caller's to wipe.
 * @param info The key's record, whose id the ticket must name.
 * @param ticket The ticket as the client sent it: key id, nonce, ciphertext and tag.
 * @param now The time to judge the key and the ticket at, in `monotonicNanos()`.
 * @param out The state to fill; its PSK array holds secret bytes on true, which the caller wipes once used.
 * @returns True when the ticket opened and is within its bounds; it is not yet checked against the strike
 *   register, which `TlsTicketStrikes.take` does.
 */
export const tlsTicketOpen = (
  key: Secret<u8[]>,
  info: TlsTicketKeyInfo,
  ticket: u8[],
  now: i64,
  out: TlsTicketState
): boolean => {
  if (!tlsTicketKeyOpens(info, now) || !tlsTicketNamesKey(info, ticket)) {
    return false
  }
  using _scope = arena()
  const plain: u8[] = exposeWith(key, ticket, tlsTicketOpenExposed)
  const opened: boolean =
    tlsTicketParse(plain, now, out) &&
    tlsTicketCopy(out.id, 0, ticket, TLS_TICKET_KEY_ID_SIZE, TLS_TICKET_NONCE_SIZE)
  if (!opened) {
    secureZero(out.psk)
  }
  secureZero(plain)
  return opened
}

/**
 * The strike register (§8.1): the ids of the tickets this process has
 * accepted, each held until its ticket expires or one server lifetime after
 * it was recorded, whichever is sooner, so that a ticket resumes at most once.
 * An open-addressed table with linear probing, made once at the capacity the
 * program gives (`TLS_TICKET_STRIKES_DEFAULT` unless it has a better figure)
 * and never grown: an expired entry is reused, and when no entry is free
 * `take` refuses and counts the refusal, failing closed. A slot never used
 * ends a probe chain; a slot once used never is unused again, so every live
 * entry of an id sits on its chain before the first unused slot.
 */
export class TlsTicketStrikes {
  /** The ids, `TLS_TICKET_NONCE_SIZE` bytes a slot. */
  private ids: u8[]
  /**
   * Each slot's expiry: the entry is held through it, inclusive, and free strictly after.
   *
   * @internal Read by `net/tls.ts`.
   */
  expires: i64[]
  /**
   * 1 for a slot that has ever held an id.
   *
   * @internal Read by `net/tls.ts`.
   */
  used: u8[]
  /** How many `take`s were refused because no entry was free. */
  refusedFull: i64
  /**
   * How many ids the register holds.
   *
   * @internal Read by `net/tls.ts`.
   */
  capacity: i32
  /** How many ids are held or were held and expired: slots ever used. */
  filled: i32
  /**
   * The farthest from its home slot any id has been recorded: no entry of an id lies further along its chain.
   * `net/tls.ts` reads it to stop a probe.
   */
  longest: i32

  /**
   * Makes the whole table now, so that no `take` ever allocates; it panics on a capacity below 1, or above
   * 178,956,969, past which the ids' table would not fit an `i32` length.
   *
   * @param capacity How many ids the register can hold at once, `TLS_TICKET_STRIKES_DEFAULT` when in doubt.
   */
  constructor(capacity: i32) {
    if (capacity < 1 || capacity > 178956969) {
      panic("TlsTicketStrikes: a capacity below 1 or above 178956969")
    }
    this.capacity = capacity
    const ids: u8[] = []
    const expires: i64[] = []
    const used: u8[] = []
    for (let slot: i32 = 0; slot < capacity; slot++) {
      for (let k: i32 = 0; k < TLS_TICKET_NONCE_SIZE; k++) {
        ids.push(0)
      }
      expires.push(0)
      used.push(0)
    }
    this.ids = ids
    this.expires = expires
    this.used = used
    this.filled = 0
    this.longest = 0
    this.refusedFull = 0
  }

  /**
   * The slot an id's probe chain starts at: FNV-1a over its bytes.
   *
   * @param id The ticket id; only its first `TLS_TICKET_NONCE_SIZE` bytes are hashed.
   * @returns A slot index, from 0 to `capacity - 1`.
   */
  home(id: u8[]): i32 {
    const capacity: i64 = toI64(this.capacity)
    // The constructor refuses a capacity below 1, so this never answers.
    if (capacity < 1) {
      return 0
    }
    // FNV-1a keeps 32 bits, which a `u64` product of a 32-bit hash and the prime holds exactly.
    let hash: u64 = 2166136261
    for (let k: i32 = 0; k < TLS_TICKET_NONCE_SIZE && k < toI32(id.length); k++) {
      hash = ((hash ^ toU64(id[k])) * 16777619) & 4294967295
    }
    return toI32(toI64(hash) % capacity)
  }

  /**
   * True when slot `slot` holds `id`.
   *
   * @internal Read by `net/tls.ts`.
   */
  holds(slot: i32, id: u8[]): boolean {
    const ids: u8[] = this.ids
    // A slot outside the table holds nothing; the constructor bounds the table at 178,956,969 slots.
    if (slot < 0 || slot > 178956969) {
      return false
    }
    const at: i32 = slot * TLS_TICKET_NONCE_SIZE
    for (let k: i32 = 0; k < TLS_TICKET_NONCE_SIZE && k < toI32(id.length); k++) {
      const j: i32 = toI32(toI64(at) + toI64(k))
      if (j < 0 || j >= toI32(ids.length) || ids[j] !== id[k]) {
        return false
      }
    }
    return true
  }

  /**
   * How many entries hold `id`, live or expired: what the tests read to see one id recorded once.
   * It walks the whole table, so it is for tests and diagnostics, not for the handshake.
   *
   * @param id The ticket id to look for.
   * @returns The number of slots ever used that hold `id`.
   */
  count(id: u8[]): i32 {
    const capacity: i32 = this.capacity
    const used: u8[] = this.used
    let found: i32 = 0
    // `found` is at most `capacity`, so its bound never stops the count.
    for (let slot: i32 = 0; slot < capacity && slot < toI32(used.length); slot++) {
      if (used[slot] !== 0 && this.holds(slot, id) && found < 2147483647) {
        found++
      }
    }
    return found
  }

  /**
   * How many entries are held at `now`.
   *
   * @param now The time to judge at, in `monotonicNanos()`; an entry whose expiry is `now` still counts.
   * @returns The number of live entries, from 0 to `capacity`.
   */
  live(now: i64): i32 {
    const capacity: i32 = this.capacity
    const used: u8[] = this.used
    const expires: i64[] = this.expires
    let held: i32 = 0
    // `held` is at most `capacity`, so its bound never stops the count.
    for (
      let slot: i32 = 0;
      slot < capacity && slot < toI32(used.length) && slot < toI32(expires.length);
      slot++
    ) {
      if (used[slot] !== 0 && expires[slot] >= now && held < 2147483647) {
        held++
      }
    }
    return held
  }

  /**
   * Records `id` until `min(expiresAt, now + 7200 s)` and answers true; false
   * when `id` is still held, or when no entry is free, which is counted in
   * `refusedFull`. The probe chain is scanned for a live entry of `id` as far
   * as `longest`, the farthest any id has been recorded from its home, before
   * an expired slot on it is reused, so an expired entry ahead of the id's
   * live one cannot let it be recorded twice. Past that bound the scan only
   * looks for a free slot and stops at the first, so a `take` costs the
   * longest probe so far, not the capacity. An id of another length than a
   * nonce is refused, uncounted.
   *
   * @param id The ticket's id, its nonce (`TlsTicketState.id` after `tlsTicketOpen`).
   * @param expiresAt When the ticket expires, in `monotonicNanos()` (`TlsTicketState.expiresAt()`).
   * @param now The time of the resumption, in `monotonicNanos()`.
   * @returns True when the id was recorded and the ticket may resume; false means refuse the resumption.
   */
  take(id: u8[], expiresAt: i64, now: i64): boolean {
    if (toI32(id.length) !== TLS_TICKET_NONCE_SIZE) {
      return false
    }
    const bound: i64 = tlsTicketAdd(now, TLS_TICKET_LIFETIME_NANOS)
    const until: i64 = expiresAt < bound ? expiresAt : bound
    const capacity: i32 = this.capacity
    const used: u8[] = this.used
    const expires: i64[] = this.expires
    const ids: u8[] = this.ids
    const longest: i32 = this.longest
    const home: i32 = this.home(id)
    // The constructor makes `capacity` slots in each array and `home` answers one of them, so a table this
    // does not describe is refused, failing closed, and never reached.
    if (capacity < 1 || home < 0 || home >= capacity) {
      return false
    }
    const divisor: i64 = toI64(capacity)
    if (divisor < 1) {
      return false
    }
    let free: i32 = -1
    for (let n: i32 = 0; n < capacity; n++) {
      const slot: i32 = toI32((toI64(home) + toI64(n)) % divisor)
      if (slot < 0 || slot >= toI32(used.length) || slot >= toI32(expires.length)) {
        return false
      }
      if (used[slot] === 0) {
        if (free < 0) {
          free = slot
        }
        break
      }
      if (expires[slot] < now) {
        if (free < 0) {
          free = slot
        }
      } else if (n <= longest && this.holds(slot, id)) {
        return false
      }
      if (free >= 0 && n >= longest) {
        break
      }
    }
    if (free < 0) {
      this.refusedFull = tlsTicketAdd(this.refusedFull, 1)
      return false
    }
    if (free >= toI32(used.length) || free >= toI32(expires.length) || free > 178956969) {
      return false
    }
    const at: i32 = free * TLS_TICKET_NONCE_SIZE
    if (at > toI32(ids.length) - TLS_TICKET_NONCE_SIZE) {
      return false
    }
    if (used[free] === 0) {
      used[free] = 1
      const filled: i32 = this.filled
      // `filled` counts slots ever used, at most `capacity`, so its bound never stops it.
      if (filled < 2147483647) {
        this.filled = filled + 1
      }
    }
    for (let k: i32 = 0; k < TLS_TICKET_NONCE_SIZE && k < toI32(id.length); k++) {
      const j: i32 = toI32(toI64(at) + toI64(k))
      if (j >= 0 && j < toI32(ids.length)) {
        ids[j] = id[k]
      }
    }
    expires[free] = until
    let distance: i64 = toI64(free) - toI64(home)
    if (distance < 0) {
      distance = distance + toI64(capacity)
    }
    if (distance > toI64(longest)) {
      this.longest = toI32(distance)
    }
    return true
  }
}
