/**
 * `nish/net/quic-conn-cid` — a QUIC connection's connection-ID table (RFC 9000
 * §5.1): the IDs this endpoint issued, which a datagram is routed by, and the
 * ones the peer issued, which this endpoint sends to.
 *
 *     import { QuicCidTable } from "nish/net/quic-conn-cid";
 *
 *     const ids = new QuicCidTable(4, 4);         // the active_connection_id_limit advertised; local slots
 *     ids.addLocal(serverScid, token);             // sequence 0
 *     ids.addPeer(0, 0, clientScid, none);         // the client's first SCID, sequence 0
 *     const error: i64 = ids.retireLocal(frame.value, packetDcid);
 *
 * **Local IDs** are the ones this side handed out: sequence 0 is the Source
 * Connection ID of its first packet, and each later one goes out in a
 * NEW_CONNECTION_ID frame (`nextUnannounced` answers the next one still to). The peer
 * retires one with RETIRE_CONNECTION_ID: a sequence number never issued, or
 * the one the retiring packet was itself sent to, is a PROTOCOL_VIOLATION
 * (§19.16).
 *
 * **Peer IDs** come from the peer's first packet and its NEW_CONNECTION_ID
 * frames (§19.15). A sequence number seen before must carry the same ID and
 * token, or it is a PROTOCOL_VIOLATION; an ID already given another sequence
 * number is one too. More active IDs than the limit this side advertised is
 * a CONNECTION_ID_LIMIT_ERROR (§5.1.1). Retire Prior To retires every older ID
 * at once: each is queued in `retirePending`, for this side to send
 * RETIRE_CONNECTION_ID for, and `current` moves to the oldest still active.
 * Queued retirements past twice the limit are a CONNECTION_ID_LIMIT_ERROR too
 * (§5.1.2), which bounds what a peer can make this side owe it.
 *
 * **Fixed slots.** The table is sized when it is made — `limit` slots for the
 * peer's IDs, each with room for a 20-byte ID and its token, `localCapacity`
 * for this side's, and a ring of twice the limit for owed retirements — and
 * every ID is copied into a slot, so nothing a peer sends allocates: a frame
 * reads straight from the packet through `addPeerAt`, `ownsLocalAt` and
 * `retireLocal`, and `reset` empties the table for a connection slot reused
 * for another peer. Connection IDs are compared in constant time.
 *
 * Written from RFC 9000 §5.1, §19.15 and §19.16, not ported from another
 * implementation. Private names carry the `quicCid` prefix
 * (`docs/wp26-stdlib.md` §3e).
 */
import {
  QUIC_ERROR_CONNECTION_ID_LIMIT,
  QUIC_ERROR_NO_ERROR,
  QUIC_ERROR_PROTOCOL_VIOLATION,
  QUIC_RESET_TOKEN_SIZE,
} from "nish/net/quic-frame"
import { QUIC_MAX_CID_LENGTH } from "nish/net/quic-packet"

/** A typed zero: a bare literal is an `f64` under `--number-mode f64`. */
const QUIC_CID_ZERO: i32 = 0

/**
 * One slot of the table: a connection ID and what came with it. `cid` has
 * room for the longest ID, and its first `length` bytes are this one; `used`
 * says whether the slot holds an ID at all.
 */
export class QuicCidEntry {
  sequence: i64 = 0
  cid: u8[]
  /** The stateless reset token issued with it (RFC 9000 §10.3); `hasToken` is false for a peer's sequence 0. */
  resetToken: u8[]
  length: i32 = 0
  used: boolean = false
  hasToken: boolean = false
  /** For a local ID: whether a NEW_CONNECTION_ID frame announced it yet. Sequence 0 needs none. */
  announced: boolean = false

  constructor() {
    this.cid = new Array<u8>(QUIC_MAX_CID_LENGTH)
    this.resetToken = new Array<u8>(QUIC_RESET_TOKEN_SIZE)
  }
}

/** Whether `a[aAt .. aAt + length)` equals `b[bAt .. bAt + length)`, compared in constant time over `length`. */
const quicCidSame = (a: u8[], aAt: i32, b: u8[], bAt: i32, length: i32): boolean => {
  let diff: i32 = 0
  for (let k: i32 = 0; k < length; k += 1) {
    const x: i32 = aAt + k >= 0 && aAt + k < toI32(a.length) ? toI32(a[aAt + k]) : 256
    const y: i32 = bAt + k >= 0 && bAt + k < toI32(b.length) ? toI32(b[bAt + k]) : 512
    diff = diff | (x ^ y)
  }
  return diff === 0
}

/** Copies `length` bytes of `from` at `at` into the start of `to`, and zeroes the rest of `to`. */
const quicCidCopy = (to: u8[], from: u8[], at: i32, length: i32): void => {
  for (let k: i32 = 0; k < toI32(to.length); k += 1) {
    to[k] = k < length && at + k >= 0 && at + k < toI32(from.length) ? from[at + k] : toU8(0)
  }
}

/** The index of the used entry with the smallest sequence number above `after`, only unannounced ones when `unannounced`, or -1. */
const quicCidOldest = (entries: QuicCidEntry[], after: i64, unannounced: boolean): i32 => {
  let best: i32 = -1
  let bestSequence: i64 = -1
  for (let k: i32 = 0; k < toI32(entries.length); k += 1) {
    const entry: QuicCidEntry = entries[k]
    if (
      entry.used &&
      entry.sequence > after &&
      (!unannounced || !entry.announced) &&
      (bestSequence < 0 || entry.sequence < bestSequence)
    ) {
      best = k
      bestSequence = entry.sequence
    }
  }
  return best
}

/** The index of the first unused entry, or -1 when every one is taken. */
const quicCidFree = (entries: QuicCidEntry[]): i32 => {
  for (let k: i32 = 0; k < toI32(entries.length); k += 1) {
    if (!entries[k].used) {
      return k
    }
  }
  return -1
}

/** Empties one slot: its sequence and flags reset and its bytes zeroed, the token among them. */
const quicCidClear = (entry: QuicCidEntry): void => {
  entry.used = false
  entry.hasToken = false
  entry.announced = false
  entry.sequence = 0
  entry.length = 0
  secureZero(entry.cid)
  secureZero(entry.resetToken)
}

/** `count` empty slots. */
const quicCidSlots = (count: i32): QuicCidEntry[] => {
  const out: QuicCidEntry[] = []
  for (let k: i32 = 0; k < count; k += 1) {
    out.push(new QuicCidEntry())
  }
  return out
}

/**
 * Both sides of one connection's IDs. `limit` is the
 * `active_connection_id_limit` this side advertised, which bounds the peer's.
 */
export class QuicCidTable {
  local: QuicCidEntry[]
  peer: QuicCidEntry[]
  /** Peer sequence numbers this side must send RETIRE_CONNECTION_ID for, oldest first, as a ring of `retireCount` from `retireHead`. */
  retirePending: i64[]
  /** The next local sequence number to issue. */
  nextLocal: i64 = 0
  /** The peer's highest Retire Prior To so far. */
  peerRetirePriorTo: i64 = 0
  limit: i64 = 2
  /** The index in `peer` of the ID this side sends to, or -1 before the peer gave one. */
  current: i32 = -1
  retireHead: i32 = 0
  retireCount: i32 = 0

  /** A table for an advertised `limit` (2 to 8 in practice) with `localCapacity` slots for this side's IDs. */
  constructor(limit: i64, localCapacity: i32) {
    const peerSlots: i32 = limit < 1 ? 1 : toI32(limit)
    this.local = quicCidSlots(localCapacity)
    this.peer = quicCidSlots(peerSlots)
    this.retirePending = new Array<i64>(peerSlots * 2)
    this.limit = limit
  }

  /** Empties the table, for a connection slot reused for another peer; the slots and their bytes are kept, zeroed. */
  reset(): void {
    for (const entry of this.local) {
      quicCidClear(entry)
    }
    for (const entry of this.peer) {
      quicCidClear(entry)
    }
    this.nextLocal = 0
    this.peerRetirePriorTo = 0
    this.current = -1
    this.retireHead = 0
    this.retireCount = 0
  }

  /**
   * Issues the first `length` bytes of `cid` as the next local ID, with its
   * 16-byte reset token (or none, empty, for sequence 0), and answers its
   * sequence number; -1 when every local slot is taken.
   */
  addLocal(cid: u8[], resetToken: u8[]): i64 {
    const k: i32 = quicCidFree(this.local)
    if (k < 0) {
      return -1
    }
    const entry: QuicCidEntry = this.local[k]
    const sequence: i64 = this.nextLocal
    const length: i32 = toI32(cid.length) > QUIC_MAX_CID_LENGTH ? QUIC_MAX_CID_LENGTH : toI32(cid.length)
    quicCidCopy(entry.cid, cid, 0, length)
    entry.length = length
    entry.hasToken = toI32(resetToken.length) === QUIC_RESET_TOKEN_SIZE
    quicCidCopy(entry.resetToken, resetToken, 0, entry.hasToken ? QUIC_RESET_TOKEN_SIZE : 0)
    entry.sequence = sequence
    entry.used = true
    // Sequence 0 travels in the long header's SCID, never in a frame.
    entry.announced = sequence === 0
    this.nextLocal = sequence + 1
    return sequence
  }

  /** How many local IDs are active: a retired one leaves its slot. */
  activeLocal(): i32 {
    let n: i32 = 0
    for (const entry of this.local) {
      if (entry.used) {
        n += 1
      }
    }
    return n
  }

  /** Whether `dcid` is an active local ID: whether a packet sent to it is this connection's. */
  ownsLocal(dcid: u8[]): boolean {
    return this.ownsLocalAt(dcid, QUIC_CID_ZERO, toI32(dcid.length))
  }

  /** Whether `buf[at .. at + length)` is an active local ID. Every slot is compared, each in constant time. */
  ownsLocalAt(buf: u8[], at: i32, length: i32): boolean {
    let owned: boolean = false
    for (const entry of this.local) {
      if (entry.used && entry.length === length && quicCidSame(entry.cid, 0, buf, at, length)) {
        owned = true
      }
    }
    return owned
  }

  /**
   * The peer retires local ID `sequence` (RETIRE_CONNECTION_ID), in a packet
   * sent to `buf[at .. at + length)`. Answers `QUIC_ERROR_NO_ERROR`, or
   * `QUIC_ERROR_PROTOCOL_VIOLATION` for a sequence number never issued or the
   * ID the packet itself was sent to (§19.16). Retiring one twice is fine. A
   * retired ID leaves its slot, so a peer that retires one ID after another
   * cannot grow the table.
   */
  retireLocal(sequence: i64, buf: u8[], at: i32, length: i32): i64 {
    if (sequence < 0 || sequence >= this.nextLocal) {
      return QUIC_ERROR_PROTOCOL_VIOLATION
    }
    for (const entry of this.local) {
      if (entry.used && entry.sequence === sequence) {
        if (entry.length === length && quicCidSame(entry.cid, 0, buf, at, length)) {
          return QUIC_ERROR_PROTOCOL_VIOLATION
        }
        quicCidClear(entry)
      }
    }
    return QUIC_ERROR_NO_ERROR
  }

  /** How many peer IDs are active: retired ones leave their slots. */
  activePeer(): i32 {
    let n: i32 = 0
    for (const entry of this.peer) {
      if (entry.used) {
        n += 1
      }
    }
    return n
  }

  /** `addPeerAt` of whole arrays: `resetToken` empty for none. */
  addPeer(sequence: i64, retirePriorTo: i64, cid: u8[], resetToken: u8[]): i64 {
    return this.addPeerAt(
      sequence,
      retirePriorTo,
      cid,
      QUIC_CID_ZERO,
      toI32(cid.length),
      resetToken,
      QUIC_CID_ZERO,
      toI32(resetToken.length) === QUIC_RESET_TOKEN_SIZE
    )
  }

  /**
   * Takes a peer ID, `cid[cidAt .. cidAt + cidLength)`, with the 16-byte token
   * at `token[tokenAt]` when `hasToken` (its first packet's SCID is sequence
   * 0, with none; a NEW_CONNECTION_ID frame's has one). Answers
   * `QUIC_ERROR_NO_ERROR`, `QUIC_ERROR_PROTOCOL_VIOLATION` for a sequence
   * number reused with another ID or token or an ID reused under another
   * sequence number, or `QUIC_ERROR_CONNECTION_ID_LIMIT` when the active IDs
   * or the queued retirements would pass what §5.1 allows, in which case the
   * table is left as it was. The tokens are compared in constant time, since
   * a token is what a stateless reset is checked against.
   */
  addPeerAt(
    sequence: i64,
    retirePriorTo: i64,
    cid: u8[],
    cidAt: i32,
    cidLength: i32,
    token: u8[],
    tokenAt: i32,
    hasToken: boolean
  ): i64 {
    if (cidLength < 0 || cidLength > QUIC_MAX_CID_LENGTH) {
      return QUIC_ERROR_PROTOCOL_VIOLATION
    }
    for (const entry of this.peer) {
      if (!entry.used) {
        continue
      }
      const sameId: boolean = entry.length === cidLength && quicCidSame(entry.cid, 0, cid, cidAt, cidLength)
      if (entry.sequence === sequence) {
        const sameToken: boolean =
          entry.hasToken === hasToken &&
          (!hasToken || quicCidSame(entry.resetToken, 0, token, tokenAt, QUIC_RESET_TOKEN_SIZE))
        return sameId && sameToken ? QUIC_ERROR_NO_ERROR : QUIC_ERROR_PROTOCOL_VIOLATION
      }
      if (sameId) {
        return QUIC_ERROR_PROTOCOL_VIOLATION
      }
    }
    // Count what the frame would leave before changing anything, so a frame
    // refused for a limit leaves the table as it was.
    const priorTo: i64 = retirePriorTo > this.peerRetirePriorTo ? retirePriorTo : this.peerRetirePriorTo
    let active: i64 = sequence < priorTo ? 0 : 1
    let pending: i64 = toI64(this.retireCount) + (sequence < priorTo ? 1 : 0)
    for (const old of this.peer) {
      if (!old.used) {
        continue
      }
      if (old.sequence < priorTo) {
        pending += 1
      } else {
        active += 1
      }
    }
    if (active > this.limit || pending > this.limit * 2 || pending > toI64(toI32(this.retirePending.length))) {
      return QUIC_ERROR_CONNECTION_ID_LIMIT
    }
    this.peerRetirePriorTo = priorTo
    // §19.15: every ID below Retire Prior To is retired, oldest first, and
    // one that arrives already below it is retired as it arrives.
    let k: i32 = quicCidOldest(this.peer, -1, false)
    while (k >= 0 && k < toI32(this.peer.length) && this.peer[k].sequence < priorTo) {
      const old: QuicCidEntry = this.peer[k]
      this.queueRetire(old.sequence)
      const after: i64 = old.sequence
      quicCidClear(old)
      k = quicCidOldest(this.peer, after, false)
    }
    if (sequence < priorTo) {
      this.queueRetire(sequence)
    } else {
      const free: i32 = quicCidFree(this.peer)
      if (free >= 0 && free < toI32(this.peer.length)) {
        const entry: QuicCidEntry = this.peer[free]
        quicCidCopy(entry.cid, cid, cidAt, cidLength)
        entry.length = cidLength
        entry.hasToken = hasToken
        quicCidCopy(entry.resetToken, token, tokenAt, hasToken ? QUIC_RESET_TOKEN_SIZE : 0)
        entry.sequence = sequence
        entry.used = true
      }
    }
    this.prune()
    return QUIC_ERROR_NO_ERROR
  }

  /** Points `current` at the oldest active peer ID, or -1 when none is. */
  prune(): void {
    this.current = quicCidOldest(this.peer, -1, false)
  }

  /** The peer ID this side sends to: its slot, or `null` before the peer gave any. */
  currentPeerEntry(): QuicCidEntry | null {
    const at: i32 = this.current
    return at >= 0 && at < toI32(this.peer.length) ? this.peer[at] : null
  }

  /** A copy of the peer ID this side sends to, or empty before the peer gave any. */
  currentPeer(): u8[] {
    const entry: QuicCidEntry | null = this.currentPeerEntry()
    const length: i32 = entry !== null ? entry.length : 0
    const out: u8[] = new Array<u8>(length)
    if (entry !== null) {
      quicCidCopy(out, entry.cid, 0, length)
    }
    return out
  }

  /** Queues a RETIRE_CONNECTION_ID for peer sequence `sequence`, unless it is queued already or the ring is full. */
  queueRetire(sequence: i64): void {
    const size: i32 = toI32(this.retirePending.length)
    for (let k: i32 = 0; k < this.retireCount; k += 1) {
      const at: i32 = (this.retireHead + k) % size
      if (at >= 0 && at < size && this.retirePending[at] === sequence) {
        return
      }
    }
    if (this.retireCount >= size || size === 0) {
      return
    }
    const at: i32 = (this.retireHead + this.retireCount) % size
    if (at >= 0 && at < size) {
      this.retirePending[at] = sequence
      this.retireCount = this.retireCount + 1
    }
  }

  /** The oldest queued retirement, or -1 when none is queued. Taking it removes it. */
  takeRetire(): i64 {
    const size: i32 = toI32(this.retirePending.length)
    if (this.retireCount === 0 || size === 0) {
      return -1
    }
    const at: i32 = this.retireHead
    const first: i64 = at >= 0 && at < size ? this.retirePending[at] : -1
    this.retireHead = (at + 1) % size
    this.retireCount = this.retireCount - 1
    return first
  }

  /** The first local ID still to be announced in a NEW_CONNECTION_ID frame, oldest first, or `null`. */
  nextUnannounced(): QuicCidEntry | null {
    const k: i32 = quicCidOldest(this.local, -1, true)
    return k >= 0 && k < toI32(this.local.length) ? this.local[k] : null
  }
}
