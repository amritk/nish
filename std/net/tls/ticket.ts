/**
 * `nish/net/tls/ticket` — TLS 1.3 session tickets a server seals for itself
 * (RFC 8446 §4.6.1), and the strike register that makes each one single-use
 * (§8.1). `docs/security/tls.md`, "Resumption", is the design this follows.
 *
 * A ticket is the key id (16 bytes, public, the additional data) ‖ a fresh
 * random nonce (12) ‖ the ChaCha20-Poly1305 ciphertext of the state ‖ its tag
 * (16). The state is what a resumed handshake reads: the suite, the time the
 * ticket was issued, its lifetime, the time of the full handshake its chain
 * started from, the server name, and the resumption PSK. Its plaintext is the
 * suite (2 bytes), the issue time (8), the lifetime in seconds (4), the chain
 * start (8), the server name with a one-byte length, and the PSK with a
 * one-byte length, every integer big-endian.
 *
 * Every time is `monotonicNanos()`, read by the caller outside `expose` and
 * handed in as `now`: keys never leave the process, so neither does a ticket,
 * and a clock that cannot step keeps the strike register honest.
 *
 * - **Keys.** A ticket key is a `Secret<u8[]>` of 32 random bytes, which no
 *   class may hold (NL2430): the program keeps its current and previous keys
 *   in locals and lends them to `tlsTicketSeal` and `tlsTicketOpen`, which
 *   read them only inside `exposeWith`. Beside each key it keeps a
 *   `TlsTicketKeyInfo` — the id, the time it was drawn, how many tickets it has
 *   sealed, and its seal cap. `tlsTicketKeyDraw` draws a key into a record and
 *   `tlsTicketKeyDue` says when to replace it. The rotation turn is the
 *   program's, because a function hands back one `Secret` and may not reassign
 *   a borrowed one: `wipe(previous)`, `previous = current`,
 *   `previousInfo.copyFrom(currentInfo)`, `current = tlsTicketKeyDraw(currentInfo, now)`.
 * - **What the module enforces from the record.** A key seals for 12 hours of
 *   awake time after its draw and until its seal cap (2^30 tickets), and opens
 *   for 14 hours, inclusive; a ticket opens while `now` is no earlier than its
 *   issue time, no later than issue time plus lifetime, and no later than 24
 *   hours after its chain started, and only when its sealed lifetime is at
 *   most 7200 s and its chain start is no later than its issue time.
 * - **Wiping.** The plaintext of a seal or an open is a plain `u8[]` made in
 *   a `using a = arena()` block, wiped with `secureZero` once, at the point
 *   every path reaches; a failed open also wipes the state's PSK array. The
 *   seal's exposed function wipes the copy of the plaintext it hands the
 *   AEAD, and what the AEAD makes from the key is wiped by the AEAD
 *   (`nish/crypto/chacha20poly1305`).
 * - **`TlsTicketStrikes`** records each ticket's id (its nonce) until the
 *   ticket expires or 7200 s after the recording, whichever is sooner, in a
 *   table made once at its capacity. It never grows and fails closed when
 *   full.
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

  constructor() {
    this.id = new Array<u8>(TLS_TICKET_KEY_ID_SIZE)
    this.createdAt = 0
    this.sealed = 0
    this.sealCap = TLS_TICKET_SEAL_CAP
  }

  /** Copies `other` into this record, as the rotation turn does from the current key's to the previous one's. */
  copyFrom(other: TlsTicketKeyInfo): void {
    for (let k: i32 = 0; k < TLS_TICKET_KEY_ID_SIZE; k++) {
      this.id[k] = other.id[k]
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
  serverNameLength: i32
  pskLength: i32

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

  /** When the ticket stops opening: its issue time plus its lifetime. It opens at that instant, and not after. */
  expiresAt(): i64 {
    return this.issuedAt + toI64(this.lifetime) * TLS_TICKET_NANOS
  }
}

/**
 * Draws a fresh key: 32 random bytes moved into the `Secret` it answers, a
 * fresh random id in `info`, `now` as its creation time and a count of 0.
 * The seal cap is left as the program set it.
 */
export const tlsTicketKeyDraw = (info: TlsTicketKeyInfo, now: i64): Secret<u8[]> => {
  const key: u8[] = new Array<u8>(TLS_TICKET_KEY_SIZE)
  crypto.getRandomValues(key)
  crypto.getRandomValues(info.id)
  info.createdAt = now
  info.sealed = 0
  return secret(key)
}

/** True when the key `info` describes should be replaced: at the end of its issue window, or at its seal cap. */
export const tlsTicketKeyDue = (info: TlsTicketKeyInfo, now: i64): boolean =>
  now - info.createdAt >= TLS_TICKET_SEAL_WINDOW || info.sealed >= info.sealCap

/** True when the key `info` describes may seal at `now`: within its issue window, inclusive, and under its cap. */
const tlsTicketKeySeals = (info: TlsTicketKeyInfo, now: i64): boolean =>
  now >= info.createdAt && now - info.createdAt <= TLS_TICKET_SEAL_WINDOW && info.sealed < info.sealCap

/** True when the key `info` describes may open at `now`: within 14 hours of its draw, inclusive. */
const tlsTicketKeyOpens = (info: TlsTicketKeyInfo, now: i64): boolean =>
  now >= info.createdAt && now - info.createdAt <= TLS_TICKET_OPEN_WINDOW

/** The plaintext's length for `state`, or -1 when the state cannot be sealed. */
const tlsTicketPlainLength = (state: TlsTicketState): i32 => {
  const hashLength: i32 = tlsSuiteHashLength(state.suite)
  if (
    hashLength === 0 ||
    state.pskLength !== hashLength ||
    state.pskLength > toI32(state.psk.length) ||
    state.serverNameLength < 0 ||
    state.serverNameLength > TLS_TICKET_SERVER_NAME_MAX ||
    state.serverNameLength > toI32(state.serverName.length) ||
    state.lifetime < 0
  ) {
    return -1
  }
  return TLS_TICKET_PLAIN_FIXED + state.serverNameLength + state.pskLength
}

/**
 * The bytes `tlsTicketSeal` makes of `state`, 0 when it cannot seal it: a
 * suite this server does not know, a PSK of another length than its hash, or
 * a server name longer than 255 bytes, which is issued no ticket.
 */
export const tlsTicketSize = (state: TlsTicketState): i32 => {
  const plain: i32 = tlsTicketPlainLength(state)
  return plain < 0 ? 0 : TLS_TICKET_KEY_ID_SIZE + TLS_TICKET_NONCE_SIZE + plain + POLY1305_TAG_SIZE
}

/** Writes `value`'s low `size` bytes big-endian at `at`. */
const tlsTicketPut = (buf: u8[], at: i32, value: i64, size: i32): void => {
  for (let k: i32 = 0; k < size; k++) {
    buf[at + k] = toU8(toI32((value >> (toI64(size - 1 - k) * 8)) & 255))
  }
}

/** Reads `size` bytes big-endian at `at`. */
const tlsTicketGet = (buf: u8[], at: i32, size: i32): i64 => {
  let value: i64 = 0
  for (let k: i32 = 0; k < size; k++) {
    value = (value << 8) | toI64(buf[at + k])
  }
  return value
}

/** A copy of `buf[from .. to)`. */
const tlsTicketRange = (buf: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = new Array<u8>(to - from)
  for (let k: i32 = 0; k < toI32(out.length); k++) {
    const at: i32 = from + k
    if (at >= 0 && at < toI32(buf.length)) {
      out[k] = buf[at]
    }
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
  if (!tlsTicketKeySeals(info, now) || plainLength < 0 || size > toI32(out.length)) {
    return 0
  }
  using _scope = arena()
  state.issuedAt = now
  const head: i32 = TLS_TICKET_KEY_ID_SIZE + TLS_TICKET_NONCE_SIZE
  const input: u8[] = new Array<u8>(head + plainLength)
  const nonce: u8[] = new Array<u8>(TLS_TICKET_NONCE_SIZE)
  crypto.getRandomValues(nonce)
  input.set(info.id, 0)
  input.set(nonce, TLS_TICKET_KEY_ID_SIZE)
  tlsTicketPut(input, head, toI64(state.suite), 2)
  tlsTicketPut(input, head + 2, now, 8)
  tlsTicketPut(input, head + 10, toI64(state.lifetime), 4)
  tlsTicketPut(input, head + 14, state.chainStart, 8)
  const nameAt: i32 = head + TLS_TICKET_NAME_AT
  input[nameAt] = toU8(state.serverNameLength)
  for (let k: i32 = 0; k < state.serverNameLength; k++) {
    input[nameAt + 1 + k] = state.serverName[k]
  }
  const pskAt: i32 = nameAt + 1 + state.serverNameLength
  input[pskAt] = toU8(state.pskLength)
  for (let k: i32 = 0; k < state.pskLength; k++) {
    input[pskAt + 1 + k] = state.psk[k]
  }
  const sealed: u8[] = exposeWith(key, input, tlsTicketSealExposed)
  let written: i32 = 0
  if (toI32(sealed.length) === plainLength + POLY1305_TAG_SIZE) {
    out.set(info.id, 0)
    out.set(nonce, TLS_TICKET_KEY_ID_SIZE)
    out.set(sealed, head)
    info.sealed = info.sealed + 1
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
  const nameLength: i32 = toI32(plain[TLS_TICKET_NAME_AT])
  const pskAt: i32 = TLS_TICKET_NAME_AT + 1 + nameLength
  if (pskAt >= length) {
    return false
  }
  const pskLength: i32 = toI32(plain[pskAt])
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
  for (let k: i32 = 0; k < nameLength; k++) {
    out.serverName[k] = plain[TLS_TICKET_NAME_AT + 1 + k]
  }
  out.pskLength = pskLength
  for (let k: i32 = 0; k < pskLength; k++) {
    out.psk[k] = plain[pskAt + 1 + k]
  }
  return (
    lifetime <= toI64(TLS_TICKET_LIFETIME_SECONDS) &&
    chainStart <= issuedAt &&
    issuedAt <= now &&
    now <= out.expiresAt() &&
    now - chainStart <= TLS_TICKET_CHAIN_LIMIT
  )
}

/** True when `ticket` is long enough to hold a state and names `info`'s key id. */
const tlsTicketNamesKey = (info: TlsTicketKeyInfo, ticket: u8[]): boolean => {
  if (
    toI32(ticket.length) <
    TLS_TICKET_KEY_ID_SIZE + TLS_TICKET_NONCE_SIZE + TLS_TICKET_PLAIN_FIXED + POLY1305_TAG_SIZE
  ) {
    return false
  }
  for (let k: i32 = 0; k < TLS_TICKET_KEY_ID_SIZE && k < toI32(ticket.length); k++) {
    if (ticket[k] !== info.id[k]) {
      return false
    }
  }
  return true
}

/**
 * Opens `ticket` under `key`, the key `info` describes, into `out`, and
 * answers whether it opened at `now`. False — with nothing of the key read —
 * when the ticket names another key id or the key is past 14 hours of awake
 * time; false when the tag does not verify, the plaintext is malformed, or the
 * ticket is outside its bounds (`tlsTicketParse`). On true, `out` holds the
 * state and the ticket's nonce in `id`, its strike-register id. On false after
 * the AEAD ran, the state's PSK array is wiped. The plaintext is wiped once,
 * after the branch on the tag and on the parse, so the one wipe covers every
 * path.
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
  const opened: boolean = tlsTicketParse(plain, now, out)
  if (opened) {
    for (let k: i32 = 0; k < TLS_TICKET_NONCE_SIZE; k++) {
      out.id[k] = ticket[TLS_TICKET_KEY_ID_SIZE + k]
    }
  } else {
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
  ids: u8[]
  /** Each slot's expiry: the entry is held through it, inclusive, and free strictly after. */
  expires: i64[]
  /** 1 for a slot that has ever held an id. */
  used: u8[]
  /** How many `take`s were refused because no entry was free. */
  refusedFull: i64
  /** How many ids the register holds. */
  capacity: i32
  /** How many ids are held or were held and expired: slots ever used. */
  filled: i32
  /** The farthest from its home slot any id has been recorded: no entry of an id lies further along its chain. */
  longest: i32

  constructor(capacity: i32) {
    if (capacity < 1) {
      panic("TlsTicketStrikes: a capacity below 1")
    }
    this.capacity = capacity
    this.ids = new Array<u8>(capacity * TLS_TICKET_NONCE_SIZE)
    this.expires = new Array<i64>(capacity)
    this.used = new Array<u8>(capacity)
    this.filled = 0
    this.longest = 0
    this.refusedFull = 0
  }

  /** The slot an id's probe chain starts at: FNV-1a over its bytes. */
  home(id: u8[]): i32 {
    let hash: i64 = 2166136261
    for (let k: i32 = 0; k < TLS_TICKET_NONCE_SIZE && k < toI32(id.length); k++) {
      hash = ((hash ^ toI64(id[k])) * 16777619) & 4294967295
    }
    return toI32(hash % toI64(this.capacity))
  }

  /** True when slot `slot` holds `id`. */
  holds(slot: i32, id: u8[]): boolean {
    const at: i32 = slot * TLS_TICKET_NONCE_SIZE
    for (let k: i32 = 0; k < TLS_TICKET_NONCE_SIZE && k < toI32(id.length); k++) {
      if (this.ids[at + k] !== id[k]) {
        return false
      }
    }
    return true
  }

  /** How many entries hold `id` at `now`, live or expired: what the tests read to see one id recorded once. */
  count(id: u8[]): i32 {
    let found: i32 = 0
    for (let slot: i32 = 0; slot < this.capacity; slot++) {
      if (this.used[slot] !== 0 && this.holds(slot, id)) {
        found++
      }
    }
    return found
  }

  /** How many entries are held at `now`. */
  live(now: i64): i32 {
    let held: i32 = 0
    for (let slot: i32 = 0; slot < this.capacity; slot++) {
      if (this.used[slot] !== 0 && this.expires[slot] >= now) {
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
   */
  take(id: u8[], expiresAt: i64, now: i64): boolean {
    if (toI32(id.length) !== TLS_TICKET_NONCE_SIZE) {
      return false
    }
    const bound: i64 = now + TLS_TICKET_LIFETIME_NANOS
    const until: i64 = expiresAt < bound ? expiresAt : bound
    const home: i32 = this.home(id)
    let free: i32 = -1
    for (let n: i32 = 0; n < this.capacity; n++) {
      const slot: i32 = (home + n) % this.capacity
      if (this.used[slot] === 0) {
        if (free < 0) {
          free = slot
        }
        break
      }
      if (this.expires[slot] < now) {
        if (free < 0) {
          free = slot
        }
      } else if (n <= this.longest && this.holds(slot, id)) {
        return false
      }
      if (free >= 0 && n >= this.longest) {
        break
      }
    }
    if (free < 0) {
      this.refusedFull = this.refusedFull + 1
      return false
    }
    if (this.used[free] === 0) {
      this.used[free] = 1
      this.filled = this.filled + 1
    }
    const at: i32 = free * TLS_TICKET_NONCE_SIZE
    for (let k: i32 = 0; k < TLS_TICKET_NONCE_SIZE && k < toI32(id.length); k++) {
      this.ids[at + k] = id[k]
    }
    this.expires[free] = until
    let distance: i32 = free - home
    if (distance < 0) {
      distance = distance + this.capacity
    }
    if (distance > this.longest) {
      this.longest = distance
    }
    return true
  }
}
