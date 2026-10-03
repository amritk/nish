/**
 * `nish/net/quic-conn-cid` — a QUIC connection's connection-ID table (RFC 9000
 * §5.1): the IDs this endpoint issued, which a datagram is routed by, and the
 * ones the peer issued, which this endpoint sends to.
 *
 *     import { QuicCidTable } from "nish/net/quic-conn-cid";
 *
 *     const ids = new QuicCidTable(4);            // the active_connection_id_limit this side advertised
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
 * Written from RFC 9000 §5.1, §19.15 and §19.16, not ported from another
 * implementation. Private names carry the `quicCid` prefix
 * (`docs/wp26-stdlib.md` §3e).
 */
import { timingSafeEqual } from "nish/crypto/ct"
import {
  QUIC_ERROR_CONNECTION_ID_LIMIT,
  QUIC_ERROR_NO_ERROR,
  QUIC_ERROR_PROTOCOL_VIOLATION,
} from "nish/net/quic-frame"

/** One connection ID and what came with it. */
export class QuicCidEntry {
  sequence: i64 = 0
  cid: u8[]
  /** The stateless reset token issued with it (RFC 9000 §10.3), or empty for sequence 0. */
  resetToken: u8[]
  retired: boolean = false
  /** For a local ID: whether a NEW_CONNECTION_ID frame announced it yet. Sequence 0 needs none. */
  announced: boolean = false

  constructor(sequence: i64, cid: u8[], resetToken: u8[]) {
    this.sequence = sequence
    this.cid = cid
    this.resetToken = resetToken
  }
}

/**
 * Both sides of one connection's IDs. `limit` is the
 * `active_connection_id_limit` this side advertised, which bounds the peer's.
 */
export class QuicCidTable {
  local: QuicCidEntry[]
  peer: QuicCidEntry[]
  /** Peer sequence numbers this side must send RETIRE_CONNECTION_ID for, oldest first. */
  retirePending: i64[]
  /** The next local sequence number to issue. */
  nextLocal: i64 = 0
  /** The peer's highest Retire Prior To so far. */
  peerRetirePriorTo: i64 = 0
  limit: i64 = 2
  /** The index in `peer` of the ID this side sends to. */
  current: i32 = 0

  constructor(limit: i64) {
    this.local = []
    this.peer = []
    this.retirePending = []
    this.limit = limit
  }

  /** Issues `cid` as the next local ID, with its reset token, and answers its sequence number. */
  addLocal(cid: u8[], resetToken: u8[]): i64 {
    const sequence: i64 = this.nextLocal
    const entry: QuicCidEntry = new QuicCidEntry(sequence, cid, resetToken)
    // Sequence 0 travels in the long header's SCID, never in a frame.
    entry.announced = sequence === 0
    this.local.push(entry)
    this.nextLocal = sequence + 1
    return sequence
  }

  /** How many local IDs are active: the table holds no retired one. */
  activeLocal(): i32 {
    return toI32(this.local.length)
  }

  /** Whether `dcid` is an active local ID: whether a packet sent to it is this connection's. */
  ownsLocal(dcid: u8[]): boolean {
    for (const entry of this.local) {
      if (timingSafeEqual(entry.cid, dcid)) {
        return true
      }
    }
    return false
  }

  /**
   * The peer retires local ID `sequence` (RETIRE_CONNECTION_ID), in a packet
   * sent to `packetDcid`. Answers `QUIC_ERROR_NO_ERROR`, or
   * `QUIC_ERROR_PROTOCOL_VIOLATION` for a sequence number never issued or the
   * ID the packet itself was sent to (§19.16). Retiring one twice is fine. Retired IDs are dropped from the table.
   */
  retireLocal(sequence: i64, packetDcid: u8[]): i64 {
    if (sequence < 0 || sequence >= this.nextLocal) {
      return QUIC_ERROR_PROTOCOL_VIOLATION
    }
    let found: boolean = false
    for (const entry of this.local) {
      if (entry.sequence === sequence) {
        if (timingSafeEqual(entry.cid, packetDcid)) {
          return QUIC_ERROR_PROTOCOL_VIOLATION
        }
        found = true
      }
    }
    if (!found) {
      return QUIC_ERROR_NO_ERROR
    }
    // A retired ID is forgotten, so a peer that retires one ID after another
    // cannot grow the table: it holds only the active ones.
    const kept: QuicCidEntry[] = []
    for (const entry of this.local) {
      if (entry.sequence !== sequence) {
        kept.push(entry)
      }
    }
    this.local = kept
    return QUIC_ERROR_NO_ERROR
  }

  /** How many peer IDs are active: `prune` keeps the table to the active ones. */
  activePeer(): i32 {
    return toI32(this.peer.length)
  }

  /**
   * Takes a peer ID (its first packet's SCID as sequence 0, or a
   * NEW_CONNECTION_ID frame's). Answers `QUIC_ERROR_NO_ERROR`,
   * `QUIC_ERROR_PROTOCOL_VIOLATION` for a sequence number reused with another
   * ID or token or an ID reused under another sequence number, or
   * `QUIC_ERROR_CONNECTION_ID_LIMIT` when the active IDs or the queued
   * retirements would pass what §5.1 allows, in which case the table is left
   * as it was. The tokens are compared in constant time, since a token is
   * what a stateless reset is checked against.
   */
  addPeer(sequence: i64, retirePriorTo: i64, cid: u8[], resetToken: u8[]): i64 {
    for (const entry of this.peer) {
      if (entry.sequence === sequence) {
        const sameToken: boolean =
          toI32(entry.resetToken.length) === toI32(resetToken.length) &&
          timingSafeEqual(entry.resetToken, resetToken)
        return timingSafeEqual(entry.cid, cid) && sameToken
          ? QUIC_ERROR_NO_ERROR
          : QUIC_ERROR_PROTOCOL_VIOLATION
      }
      if (timingSafeEqual(entry.cid, cid)) {
        return QUIC_ERROR_PROTOCOL_VIOLATION
      }
    }
    // Count what the frame would leave before changing anything, so a frame
    // refused for a limit leaves the table as it was.
    const priorTo: i64 = retirePriorTo > this.peerRetirePriorTo ? retirePriorTo : this.peerRetirePriorTo
    let active: i64 = sequence < priorTo ? 0 : 1
    let pending: i64 = toI64(toI32(this.retirePending.length)) + (sequence < priorTo ? 1 : 0)
    for (const old of this.peer) {
      if (old.sequence < priorTo) {
        pending += 1
      } else {
        active += 1
      }
    }
    if (active > this.limit || pending > this.limit * 2) {
      return QUIC_ERROR_CONNECTION_ID_LIMIT
    }
    this.peer.push(new QuicCidEntry(sequence, cid, resetToken))
    this.peerRetirePriorTo = priorTo
    // §19.15: an ID already below Retire Prior To is retired as it arrives,
    // and every older one with it.
    for (const old of this.peer) {
      if (!old.retired && old.sequence < priorTo) {
        old.retired = true
        this.retirePending.push(old.sequence)
      }
    }
    this.prune()
    return QUIC_ERROR_NO_ERROR
  }

  /**
   * Drops retired peer IDs from the table, so it holds at most the active
   * ones, and points `current` at the oldest active one (or 0 when none is).
   */
  prune(): void {
    const kept: QuicCidEntry[] = []
    for (const entry of this.peer) {
      if (!entry.retired) {
        kept.push(entry)
      }
    }
    this.peer = kept
    let best: i32 = 0
    let bestSequence: i64 = -1
    for (let k: i32 = 0; k < toI32(kept.length); k += 1) {
      if (bestSequence < 0 || kept[k].sequence < bestSequence) {
        best = k
        bestSequence = kept[k].sequence
      }
    }
    this.current = best
  }

  /** The peer ID this side sends to: the oldest active one, or empty before the peer gave any. */
  currentPeer(): u8[] {
    const at: i32 = this.current
    if (at >= 0 && at < toI32(this.peer.length)) {
      return this.peer[at].cid
    }
    const none: u8[] = []
    return none
  }

  /** The oldest queued retirement, or -1 when none is queued. Taking it removes it. */
  takeRetire(): i64 {
    if (toI32(this.retirePending.length) === 0) {
      return -1
    }
    const first: i64 = this.retirePending[0]
    const rest: i64[] = []
    for (let k: i32 = 1; k < toI32(this.retirePending.length); k += 1) {
      rest.push(this.retirePending[k])
    }
    this.retirePending = rest
    return first
  }

  /** The first local ID still to be announced in a NEW_CONNECTION_ID frame, or `null`. */
  nextUnannounced(): QuicCidEntry | null {
    for (const entry of this.local) {
      if (!entry.announced) {
        return entry
      }
    }
    return null
  }
}
