/**
 * `nish/net/quic-recovery` — QUIC loss detection and congestion control
 * (RFC 9002): the packets each packet number space has in flight, the
 * round-trip estimate, loss by packet and by time threshold, the probe
 * timeout with its backoff, NewReno or CUBIC, and a pacer. Sans-IO: it never sees a
 * byte of a packet, only packet numbers, sizes and the caller's clock.
 *
 *     import { QuicRecovery, QUIC_RECOVERY_TIMEOUT_PTO } from "nish/net/quic-recovery";
 *
 *     const recovery = new QuicRecovery();
 *     const slot: i32 = recovery.onPacketSent(space, pn, size, now);     // every ack-eliciting packet
 *     recovery.onAck(space, frame.ackRanges, frame.ackRangeCount, delay, now);
 *     … recovery.spaces[space].acked / .lost name the slots it settled …
 *     if (now >= recovery.deadline(blocked)) { recovery.onTimeout(now, blocked); }
 *
 * **What it tracks.** Each space keeps its ack-eliciting packets in a fixed
 * ring (`QuicSentPackets`), in the order they were sent, so the memory is fixed
 * when the connection is made and nothing is allocated per packet. A packet
 * that elicits no acknowledgement (one that carries only ACK, PADDING or
 * CONNECTION_CLOSE) is not recorded: it is never in flight, and neither an RTT
 * sample nor a loss is ever taken from it (RFC 9002 §2, §5.1).
 *
 *  The caller keeps what each packet carried in its own arrays, indexed by the
 *  slot `onPacketSent` answers, and reads `acked` and `lost` after each `onAck`
 *  and `onTimeout` to learn which slots were settled. A slot named there keeps
 *  its packet number, time and size until the next call.
 *
 * **Time and units.** Every time and every duration is the caller's
 * monotonic clock in milliseconds, which is also the timer granularity
 * (`QUIC_RECOVERY_GRANULARITY`, §6.1.2), and the arithmetic is Appendix A's
 * and Appendix B's in integers: `smoothed_rtt = (7 × smoothed_rtt +
 * adjusted_rtt) / 8`, `rttvar = (3 × rttvar + |smoothed_rtt −
 * adjusted_rtt|) / 4`, each division truncating. Sizes are bytes.
 *
 * **The pacer's clock.** Pacing is not a timer, and on a path whose round
 * trip is under a millisecond a pacer that counts whole milliseconds earns
 * nothing until the next one starts, and then waits a whole one. So a
 * caller with a finer clock sets `micros` to the same instant in
 * microseconds before it calls in, and the pacer, its budget and its own
 * smoothed RTT (`pacerRtt`) count microseconds; loss detection and the
 * probe timeout still count milliseconds, at least
 * `QUIC_RECOVERY_GRANULARITY`. A `micros` outside the millisecond `now`
 * names, a stale one or none, is not read: the pacer counts `now × 1000`
 * then, and paces as a millisecond clock always did.
 *
 * **What the server leaves out.** It is written for the server side of a
 * connection: there is no client anti-deadlock probe (§6.2.2.1), since a
 * server never has to send to unblock its peer. A congestion window that
 * the sender does not use is not grown (§7.8): an acknowledgement grows it
 * only if, when it arrived, the bytes in flight were at least half the
 * window.
 *
 * **Congestion control.** `controller` picks it, once, before the first
 * packet: `QUIC_RECOVERY_NEWRENO` (Appendix B, the default) or
 * `QUIC_RECOVERY_CUBIC` (RFC 9438). Both share slow start, recovery
 * periods, persistent congestion's collapse to the minimum window and the
 * rule above for a window not in use. CUBIC keeps 0.7 of the window at a
 * congestion event rather than half, then grows along W(t) = W_max + C ×
 * (t − K)³ with C 0.4, concave up to the window it lost at and convex past
 * it, never below what Reno would have reached (its Reno-friendly region),
 * and with fast convergence. Its arithmetic is integers in bytes and
 * milliseconds, and K's cube root is found by bisection, so two machines
 * given the same events reach the same window to the byte.
 *
 * **ECN** (§7.1, B.7; RFC 9000 §13.4.2 and its Appendix A.4). A caller that
 * marks its packets ECT(0) asks `ecnCodepoint()` what to mark with, says so
 * with `onEctSent` for every packet it marked, and hands an ACK_ECN frame's
 * counts to `onAckEcn`.
 *
 *  The counts are validated against the packets marked before they are used: an
 *  ACK that newly acknowledges a marked packet without counts, a count that
 *  falls, counts past the packets marked, or an increase in ECT(0) and ECN-CE
 *  short of the marked packets newly acknowledged fails validation, as does
 *  every packet of the testing period being lost, and a failed path is marked no
 *  more (`QUIC_RECOVERY_ECN_FAILED`). Only the first
 *  `QUIC_RECOVERY_ECN_TESTING_PACKETS` are marked until one validates.
 *
 *  A rise in the ECN-CE count is a congestion event, from the largest packet
 *  newly acknowledged, so it halves the window once per recovery period as a
 *  loss does. Counts that arrive with an ACK that does not raise the largest
 *  acknowledged are neither validated nor used: they may be older than those
 *  already read.
 *
 * **What a peer cannot do.** Every input is checked: the ranges of an
 * acknowledgement are read only up to the count given and the array's
 * length, a packet acknowledged twice counts once, and
 * the backoff stops doubling at `QUIC_RECOVERY_MAX_BACKOFF`, so no duration
 * overflows. A peer that never acknowledges anything costs a probe each
 * timeout, at a rate that halves each time, until the idle timeout ends the
 * connection.
 *
 * Written from RFC 9002 §5 to §7 and its Appendices A and B, and RFC 9438, in this
 * module's own structure; nothing here is ported from another
 * implementation. Private names carry the `quicRecovery` prefix
 * (`docs/wp26-stdlib.md` §3e).
 */
import { QUIC_MAX_VARINT } from "nish/net/quic-packet"

/** The Initial space's index, which is `TLS_LEVEL_INITIAL`. */
export const QUIC_RECOVERY_INITIAL: i32 = 0
/** The Handshake space's index. */
export const QUIC_RECOVERY_HANDSHAKE: i32 = 1
/** The Application Data space's index. */
export const QUIC_RECOVERY_APPLICATION: i32 = 2
/**
 * How many packets the Initial and the Handshake space each keep in flight.
 * A server's handshake flight is a few datagrams, and the anti-amplification
 * limit holds it to three times what the client sent until its address is
 * validated, so 16 leaves room for several probes on top.
 */
export const QUIC_RECOVERY_HANDSHAKE_CAPACITY: i32 = 16
/**
 * How many packets the Application Data space keeps in flight: 128
 * full-sized datagrams is 150 KiB in flight, a 12 Mbit/s path at a 100 ms
 * round trip, against what the record costs every connection from the
 * start. When the ring is full the space sends nothing that would elicit an
 * acknowledgement until one arrives, as if the congestion window were full.
 */
export const QUIC_RECOVERY_APPLICATION_CAPACITY: i32 = 128
/** kPacketThreshold (§6.1.1): a packet three numbers below one acknowledged is lost. */
export const QUIC_RECOVERY_PACKET_THRESHOLD: i64 = 3
/** kGranularity (§6.1.2), in milliseconds: the timer resolution, and the least any loss delay or variance term is. */
export const QUIC_RECOVERY_GRANULARITY: i64 = 1
/** kInitialRtt (§6.2.2), in milliseconds: the round trip assumed before the first sample. */
export const QUIC_RECOVERY_INITIAL_RTT: i64 = 333
/**
 * max_datagram_size (B.1) on a path nothing has been learnt of: the 1200
 * bytes every datagram is at most until path MTU discovery validates more
 * (`QuicRecovery.datagramSize`).
 */
export const QUIC_RECOVERY_DATAGRAM_SIZE: i64 = 1200
/** kInitialWindow (§7.2) at 1200 bytes: min(10 × 1200, max(14720, 2 × 1200)), so 12000 bytes. */
export const QUIC_RECOVERY_INITIAL_WINDOW: i64 = 12000
/** kMinimumWindow (§7.2) at 1200 bytes: two datagrams, 2400 bytes. */
export const QUIC_RECOVERY_MINIMUM_WINDOW: i64 = 2400
/** kPersistentCongestionThreshold (§7.6.1): lost packets spanning three probe timeouts collapse the window. */
export const QUIC_RECOVERY_PERSISTENT_THRESHOLD: i64 = 3
/** The default max_ack_delay (RFC 9000 §18.2), in milliseconds, until the peer's transport parameters say otherwise. */
export const QUIC_RECOVERY_DEFAULT_MAX_ACK_DELAY: i64 = 25
/**
 * The most times the probe timeout doubles (§6.2.1). Sixteen doublings of
 * the longest probe timeout a peer can cause still fit an `i64`, and by then
 * the idle timeout has ended the connection.
 */
export const QUIC_RECOVERY_MAX_BACKOFF: i32 = 16

/** `onTimeout` ran nothing: no timer was due. */
export const QUIC_RECOVERY_TIMEOUT_NONE: i32 = 0
/** `onTimeout` declared packets lost by the time threshold; `lost` in `timeoutSpace` names them. */
export const QUIC_RECOVERY_TIMEOUT_LOSS: i32 = 1
/** `onTimeout` was a probe timeout: the caller sends a probe in `timeoutSpace` (§6.2.4). */
export const QUIC_RECOVERY_TIMEOUT_PTO: i32 = 2

/** A slot's states: free, a packet in flight, one acknowledged, one declared lost, and one this call declared lost. */
const QUIC_RECOVERY_FREE: i32 = 0
const QUIC_RECOVERY_SENT: i32 = 1
const QUIC_RECOVERY_ACKED: i32 = 2
const QUIC_RECOVERY_LOST: i32 = 3
const QUIC_RECOVERY_LOST_NOW: i32 = 4
/** The bit of a slot's state byte that says its packet was sent marked ECT(0), kept beside the state so a slot costs no second byte. */
const QUIC_RECOVERY_MARKED: i32 = 128
/** The bit of a slot's state byte that says its packet was a path MTU probe, whose loss is not congestion (RFC 9000 §14.4). */
const QUIC_RECOVERY_PROBE: i32 = 64
/** The state bits of a slot's state byte, below the two flags. */
const QUIC_RECOVERY_STATE_BITS: i32 = 63

/** The ECT(0) codepoint (RFC 3168), the only one this module asks a caller to mark with. */
export const QUIC_RECOVERY_ECT0: i32 = 2
/** How many packets are marked while ECN is tested, before a marked one is acknowledged (RFC 9000 A.4). */
export const QUIC_RECOVERY_ECN_TESTING_PACKETS: i32 = 10
/** ECN's states (RFC 9000 A.4): testing, marking the first packets; unknown, those sent and none validated yet; capable; and failed, for the connection's life. */
export const QUIC_RECOVERY_ECN_TESTING: i32 = 0
/**
 * ECN is unknown: the testing packets are sent, none is validated yet, and nothing more is marked
 * until one is.
 */
export const QUIC_RECOVERY_ECN_UNKNOWN: i32 = 1
/** The path is ECN-capable: a marked packet's counts validated, and every packet is marked from here on. */
export const QUIC_RECOVERY_ECN_CAPABLE: i32 = 2
/**
 * Validation failed: nothing is marked again for the connection's life, unless `restartEcn` tests a new path.
 */
export const QUIC_RECOVERY_ECN_FAILED: i32 = 3

/** Microseconds in a millisecond: the pacer's clock against the caller's `now`. */
const QUIC_RECOVERY_MICROS: i64 = 1000

/**
 * The most window the pacer earns by, in bytes: 4 GiB a round trip, faster
 * than any path such a window could be on. It and the minute `pacerRefill`
 * counts at most keep the product of the two inside an `i64`.
 */
const QUIC_RECOVERY_PACER_WINDOW: i64 = 4294967296

/** The congestion controller of RFC 9002 §7 and Appendix B: NewReno. The default. */
export const QUIC_RECOVERY_NEWRENO: i32 = 0
/** The congestion controller of RFC 9438: CUBIC, with its Reno-friendly region and fast convergence. */
export const QUIC_RECOVERY_CUBIC: i32 = 1

/**
 * CUBIC's longest span in milliseconds: K and every `t − K` its curve is
 * read at are clamped to ±40 s. A cube of it times twice the largest UDP
 * payload stays inside an `i64` (2 × 65535 × 40000³ < 2^63), and K reaches
 * it only after a fall of 25600 datagrams, 30 MB at 1200 bytes.
 */
const QUIC_RECOVERY_CUBIC_SPAN: i64 = 40000
/**
 * C (0.4 segments/s³) on milliseconds: W(t) = W_max + 2 × size × (t − K)³ / 5 × 10⁹
 * bytes, `size` the datagram size and t in milliseconds (RFC 9438 §4.2).
 */
const QUIC_RECOVERY_CUBIC_SCALE: i64 = 5000000000

/** The larger of two times or durations. */
const quicRecoveryMax = (a: i64, b: i64): i64 => (a > b ? a : b)

/** `x` clamped to −`QUIC_RECOVERY_CUBIC_SPAN` .. `QUIC_RECOVERY_CUBIC_SPAN`. */
const quicRecoveryCubicClamp = (x: i64): i64 =>
  x > QUIC_RECOVERY_CUBIC_SPAN
    ? QUIC_RECOVERY_CUBIC_SPAN
    : x < -QUIC_RECOVERY_CUBIC_SPAN
      ? -QUIC_RECOVERY_CUBIC_SPAN
      : x

/**
 * The integer cube root of `x`, the largest r with r³ <= x, for 0 <= x <=
 * `QUIC_RECOVERY_CUBIC_SPAN`³, found by bisection over 0 .. the span: 16
 * steps, the same answer on every machine, no floating point.
 *
 * @param x The cube, 0 to 40000³.
 * @returns Its root, 0 to 40000.
 */
export const quicRecoveryCbrt = (x: i64): i64 => {
  let lo: i64 = 0
  let hi: i64 = QUIC_RECOVERY_CUBIC_SPAN
  if (x <= lo) {
    return lo
  }
  if (x >= hi * hi * hi) {
    return hi
  }
  // lo³ <= x < hi³ holds at every step.
  while (hi - lo > 1) {
    const mid: i64 = (lo + hi) / 2
    if (mid * mid * mid <= x) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * The ack-eliciting packets one space sent, in a ring of `capacity` slots
 * in the order they went out: slot `slot(k)` is the `k`-th from the oldest
 * still kept, for `k` below `count`. A packet stays in its slot after it is
 * acknowledged or lost until every older one is settled too, which is what
 * lets persistent congestion see that nothing between two lost packets was
 * acknowledged (§7.6.2).
 */
export class QuicSentPackets {
  /** @internal Read only by this module; `pnAt` answers for a slot. */
  pn: i64[]
  /**
   * When each slot's packet was sent, the `now` `onPacketSent` was given, in milliseconds;
   * loss detection and RTT samples read it.
   */
  timeSent: i64[]
  /** When each packet was sent on the pacer's clock, in microseconds. */
  fineSent: i64[]
  /** @internal Read only by this module: each slot's packet size in bytes, for the congestion window. */
  size: i32[]
  /** Each slot's state, with `QUIC_RECOVERY_MARKED` set if its packet was sent marked ECT(0). */
  state: u8[]
  /** The slots the last `onAck` acknowledged, `ackedCount` of them, oldest first. */
  acked: i32[]
  /** The slots the last `onAck` or `onTimeout` declared lost, `lostCount` of them, oldest first. */
  lost: i32[]
  /** The largest packet number the peer acknowledged in this space, or -1. */
  largestAcked: i64 = -1
  /** The packet number of the last packet recorded, or -1: each must be larger (RFC 9000 §12.3). */
  lastPn: i64 = -1
  /** loss_time (A.3): when the oldest packet not yet lost by the packet threshold becomes lost by time, or -1. */
  lossTime: i64 = -1
  /** time_of_last_ack_eliciting_packet (A.3), or -1 before the first. */
  lastAckEliciting: i64 = -1
  /** The bytes of this space's packets in flight. */
  bytesInFlight: i64 = 0
  private capacity: i32 = 0
  private head: i32 = 0
  /**
   * How many packets the ring keeps, in flight and settled; a test reads it to see what a flight
   * recorded.
   */
  count: i32 = 0
  /** How many recorded packets are still in flight: neither acknowledged nor lost. */
  inFlight: i32 = 0
  /** @internal Read by `net/quic.ts`: how many slots of `acked` the last `onAck` filled. */
  ackedCount: i32 = 0
  /** How many slots of `lost` the last `onAck` or `onTimeout` filled. */
  lostCount: i32 = 0
  /** How many of this space's packets, recorded or not, were sent marked ECT(0). */
  ectSent: i64 = 0
  /** The ECN counts of the last ACK_ECN frame validated in this space (RFC 9000 §19.3.2). */
  ect0: i64 = 0
  /** The ECT(1) count of the last ACK_ECN frame validated in this space. */
  ect1: i64 = 0
  /** The ECN-CE count of the last ACK_ECN frame validated in this space; a rise is a congestion event. */
  ce: i64 = 0

  /**
   * An empty ring; `QuicRecovery` makes one for each space.
   *
   * @param capacity How many sent packets the ring records at once, fixed for its life: in flight and
   *   settled alike, until `compact` drops the settled ones. `QUIC_RECOVERY_HANDSHAKE_CAPACITY` or
   *   `QUIC_RECOVERY_APPLICATION_CAPACITY`.
   */
  constructor(capacity: i32) {
    this.capacity = capacity
    this.pn = new Array<i64>(capacity)
    this.timeSent = new Array<i64>(capacity)
    this.fineSent = new Array<i64>(capacity)
    this.size = new Array<i32>(capacity)
    this.state = new Array<u8>(capacity)
    this.acked = new Array<i32>(capacity)
    this.lost = new Array<i32>(capacity)
  }

  /**
   * The ring slot of the `k`-th packet kept, counting from the oldest.
   * @internal Read by quic.ts, and in quic-recovery.ts outside the class.
   */
  slot(k: i32): i32 {
    return (this.head + k) % this.capacity
  }

  /**
   * The state of slot `s`, or free for a slot outside the ring.
   *
   * @param s A ring slot, as `onPacketSent`, `ackedSlot` or `lostSlot` answers it; any other index is safe.
   * @returns The slot's state without its ECT(0) mark: free, in flight, acknowledged, lost, or lost now
   *   (`markLost`'s mark for a packet the current call declared lost).
   */
  stateAt(s: i32): i32 {
    if (s < 0 || s >= toI32(this.state.length)) {
      return QUIC_RECOVERY_FREE
    }
    return toI32(this.state[s]) & QUIC_RECOVERY_STATE_BITS
  }

  /**
   * Sets slot `s`'s state.
   * @internal Read in quic-recovery.ts outside the class.
   */
  setState(s: i32, value: i32): void {
    if (s >= 0 && s < toI32(this.state.length)) {
      this.state[s] = toU8((toI32(this.state[s]) & (QUIC_RECOVERY_MARKED | QUIC_RECOVERY_PROBE)) | value)
    }
  }

  /**
   * The packet number in slot `s`, or -1.
   *
   * @param s A ring slot, as `onPacketSent`, `ackedSlot` or `lostSlot` answers it; any other index is safe.
   * @returns The packet number recorded there, or -1 for an index outside the ring.
   */
  pnAt(s: i32): i64 {
    return s >= 0 && s < toI32(this.pn.length) ? this.pn[s] : -1
  }

  /**
   * When the packet in slot `s` was sent, or -1.
   *
   * @param s A ring slot, as `onPacketSent`, `ackedSlot` or `lostSlot` answers it; any other index is safe.
   * @returns The `now` it was recorded at, in the caller's milliseconds, or -1 for an index outside the ring.
   */
  timeAt(s: i32): i64 {
    return s >= 0 && s < toI32(this.timeSent.length) ? this.timeSent[s] : -1
  }

  /**
   * When the packet in slot `s` was sent on the pacer's clock, in microseconds, or -1.
   *
   * @param s A ring slot, as `onPacketSent`, `ackedSlot` or `lostSlot` answers it; any other index is safe.
   * @returns The send time in microseconds (`now × 1000` when `micros` was not current), or -1 for an
   *   index outside the ring.
   */
  fineAt(s: i32): i64 {
    return s >= 0 && s < toI32(this.fineSent.length) ? this.fineSent[s] : -1
  }

  /**
   * The size of the packet in slot `s`, or 0.
   *
   * @param s A ring slot, as `onPacketSent`, `ackedSlot` or `lostSlot` answers it; any other index is safe.
   * @returns Its size on the wire in bytes, or 0 for an index outside the ring.
   */
  sizeAt(s: i32): i32 {
    return s >= 0 && s < toI32(this.size.length) ? this.size[s] : 0
  }

  /**
   * Whether the packet in slot `s` was sent marked ECT(0).
   *
   * @param s A ring slot, as `onPacketSent`, `ackedSlot` or `lostSlot` answers it; any other index is safe.
   * @returns True when `onEctSent` marked it; false for an index outside the ring.
   */
  markedAt(s: i32): boolean {
    return s >= 0 && s < toI32(this.state.length) && (toI32(this.state[s]) & QUIC_RECOVERY_MARKED) !== 0
  }

  /**
   * Sets whether the packet in slot `s` was sent marked ECT(0).
   * @internal Read in quic-recovery.ts outside the class.
   */
  setMarked(s: i32, value: boolean): void {
    if (s >= 0 && s < toI32(this.state.length)) {
      const kept: i32 = toI32(this.state[s]) & (QUIC_RECOVERY_STATE_BITS | QUIC_RECOVERY_PROBE)
      this.state[s] = toU8(kept | (value ? QUIC_RECOVERY_MARKED : 0))
    }
  }

  /**
   * Whether the packet in slot `s` was a path MTU probe (RFC 8899), whose
   * loss says nothing of congestion.
   *
   * @param s A ring slot, as `onPacketSent`, `ackedSlot` or `lostSlot` answers it; any other index is safe.
   * @returns True when `onProbeSent` marked it; false for an index outside the ring.
   */
  probeAt(s: i32): boolean {
    return s >= 0 && s < toI32(this.state.length) && (toI32(this.state[s]) & QUIC_RECOVERY_PROBE) !== 0
  }

  /**
   * Sets whether the packet in slot `s` was a path MTU probe.
   * @internal Read in quic-recovery.ts outside the class.
   */
  setProbe(s: i32, value: boolean): void {
    if (s >= 0 && s < toI32(this.state.length)) {
      const kept: i32 = toI32(this.state[s]) & (QUIC_RECOVERY_STATE_BITS | QUIC_RECOVERY_MARKED)
      this.state[s] = toU8(kept | (value ? QUIC_RECOVERY_PROBE : 0))
    }
  }

  /**
   * The `k`-th slot the last call acknowledged, or -1.
   *
   * @param k The position in `acked`, from 0 to `ackedCount - 1`, oldest first.
   * @returns The slot, or -1 for `k` out of range. It names that packet only until the next call that
   *   records, settles or frees a packet in this space, any of which can free or reuse the slot:
   *   `onPacketSent`, `onAck`, `onAckEcn`, `onTimeout`, `evictOldest`, `discardSpace` and `reset` on the
   *   recovery, and this ring's own `full` and `compact`.
   */
  ackedSlot(k: i32): i32 {
    return k >= 0 && k < this.ackedCount && k < toI32(this.acked.length) ? this.acked[k] : -1
  }

  /**
   * The `k`-th slot the last call declared lost, or -1.
   *
   * @param k The position in `lost`, from 0 to `lostCount - 1`, oldest first.
   * @returns The slot, or -1 for `k` out of range. It names that packet only until the next call that
   *   records, settles or frees a packet in this space, any of which can free or reuse the slot:
   *   `onPacketSent`, `onAck`, `onAckEcn`, `onTimeout`, `evictOldest`, `discardSpace` and `reset` on the
   *   recovery, and this ring's own `full` and `compact`.
   */
  lostSlot(k: i32): i32 {
    return k >= 0 && k < this.lostCount && k < toI32(this.lost.length) ? this.lost[k] : -1
  }

  /**
   * Whether slot `s` holds a packet still in flight.
   *
   * @param s A ring slot, as `onPacketSent`, `ackedSlot` or `lostSlot` answers it; any other index is safe.
   * @returns True for a packet neither acknowledged nor lost; false for an index outside the ring.
   */
  inFlightAt(s: i32): boolean {
    return this.stateAt(s) === QUIC_RECOVERY_SENT
  }

  /**
   * Whether every slot is taken, so nothing more can be recorded until a packet is settled.
   *
   * @returns True when `onPacketSent` would refuse a packet for want of room. Settled slots at the oldest
   *   end are freed first, so asking can change `count`.
   */
  full(): boolean {
    this.compact()
    return this.count >= this.capacity
  }

  /**
   * Frees the oldest slots that are settled, acknowledged or lost.
   * @internal Read by quic.ts, and in quic-recovery.ts outside the class.
   */
  compact(): void {
    while (this.count > 0 && this.stateAt(this.head) !== QUIC_RECOVERY_SENT) {
      this.setState(this.head, QUIC_RECOVERY_FREE)
      this.head = (this.head + 1) % this.capacity
      this.count = this.count - 1
    }
    if (this.count === 0) {
      this.head = 0
    }
  }

  /**
   * Forgets the results of the last call.
   * @internal Read in quic-recovery.ts outside the class.
   */
  clearResults(): void {
    this.ackedCount = 0
    this.lostCount = 0
  }

  /**
   * Takes packet `s` out of flight.
   * @internal Read in quic-recovery.ts outside the class.
   */
  settle(s: i32, state: i32): void {
    this.setState(s, state)
    this.inFlight = this.inFlight - 1
    this.bytesInFlight = this.bytesInFlight - toI64(this.sizeAt(s))
  }

  /**
   * Settles packet `s` as lost and lists it in `lost`.
   * @internal Read in quic-recovery.ts outside the class.
   */
  markLost(s: i32): void {
    this.settle(s, QUIC_RECOVERY_LOST_NOW)
    if (this.lostCount < toI32(this.lost.length)) {
      this.lost[this.lostCount] = s
      this.lostCount = this.lostCount + 1
    }
  }

  /**
   * Drops every packet, as when the space's keys are discarded (A.11).
   * @internal Read in quic-recovery.ts outside the class.
   */
  clear(): void {
    for (let s: i32 = 0; s < toI32(this.state.length); s += 1) {
      this.state[s] = toU8(QUIC_RECOVERY_FREE)
    }
    this.head = 0
    this.count = 0
    this.inFlight = 0
    this.bytesInFlight = 0
    this.lossTime = -1
    this.lastAckEliciting = -1
    this.clearResults()
  }

  /**
   * Empties the ring and forgets every number, for a connection slot reused for another peer.
   * @internal Read in quic-recovery.ts outside the class.
   */
  reset(): void {
    this.clear()
    this.largestAcked = -1
    this.lastPn = -1
    this.ectSent = 0
    this.ect0 = 0
    this.ect1 = 0
    this.ce = 0
  }
}

/** Whether `pn` falls in one of the first `count` `[smallest, largest]` pairs of `ranges`. */
const quicRecoveryInRanges = (ranges: i64[], count: i32, pn: i64): boolean => {
  for (let k: i32 = 0; k < count; k += 1) {
    const low: i32 = k * 2
    const high: i32 = low + 1
    if (low < 0 || low >= toI32(ranges.length) || high < 0 || high >= toI32(ranges.length)) {
      return false
    }
    if (pn >= ranges[low] && pn <= ranges[high]) {
      return true
    }
  }
  return false
}

/**
 * One connection's loss recovery and congestion control, across its three
 * packet number spaces. The fields are readable: the RTT estimate
 * (`latestRtt`, `smoothedRtt`, `rttVar`, `minRtt`), the window
 * (`congestionWindow`, `ssthresh`, `recoveryStart`), `ptoCount`, and the
 * counts a test or a log reads (`congestionEvents`, `persistentCongestions`).
 */
export class QuicRecovery {
  /**
   * The sent-packet ring of each packet number space, indexed by `QUIC_RECOVERY_INITIAL` and its
   * siblings.
   */
  spaces: QuicSentPackets[]
  /** latest_rtt (§5.1): the last sample, in milliseconds. */
  latestRtt: i64 = 0
  /** smoothed_rtt (§5.3): kInitialRtt until the first sample. */
  smoothedRtt: i64 = 0
  /** rttvar (§5.3): kInitialRtt / 2 until the first sample. */
  rttVar: i64 = 0
  /** min_rtt (§5.2): 0 until the first sample. */
  minRtt: i64 = 0
  /** When the first RTT sample was taken, or -1 before it: persistent congestion counts only packets sent since (§7.6.2). */
  firstSampleTime: i64 = -1
  /** The peer's max_ack_delay in milliseconds (RFC 9000 §18.2), which the caller sets once it has read it. */
  maxAckDelay: i64 = 0
  /** congestion_window (B.2), in bytes. */
  congestionWindow: i64 = 0
  /** ssthresh (B.2): unbounded (2^62 − 1) until the first congestion event. */
  ssthresh: i64 = 0
  /** congestion_recovery_start_time (B.2), or -1 outside recovery. */
  recoveryStart: i64 = -1
  /**
   * The congestion controller, `QUIC_RECOVERY_NEWRENO` or `QUIC_RECOVERY_CUBIC`, which the caller
   * sets once, before the first packet; `reset` keeps it.
   */
  controller: i32 = 0
  /** CUBIC's W_max (RFC 9438 §4.2) in bytes: the window its curve plateaus at, 0 before the first congestion event. */
  cubicMax: i64 = 0
  /** CUBIC's K in milliseconds: how long after `cubicEpoch` the curve reaches `cubicMax`. */
  cubicK: i64 = 0
  /** When CUBIC's congestion avoidance stage began (t = 0 of its curve), in milliseconds, or -1 outside one. */
  cubicEpoch: i64 = -1
  /** CUBIC's W_est (§4.3) in bytes: the window Reno's AIMD with β 0.7 would have reached since `cubicEpoch`. */
  cubicEst: i64 = 0
  /** What `cubicEst`'s last step truncated: the numerator of a fraction of 17 × the window then. */
  cubicEstCarry: i64 = 0
  /** CUBIC's cwnd_prior (§4.6): the window just before the last reduction, in bytes. */
  cubicPrior: i64 = 0
  /**
   * When the window last stopped being used (§5.8) during a congestion avoidance stage, or -1: the
   * curve's epoch moves on by the time it was idle, so it resumes where it stood.
   */
  cubicIdle: i64 = -1
  /** The pacer's credit in bytes (§7.7), and the time it was last topped up in microseconds, or -1. */
  pacerBudget: i64 = 0
  /**
   * When the pacer's credit was last topped up, in microseconds on the pacer's clock, or -1 before the
   * first time.
   */
  pacerTime: i64 = -1
  /** The smoothed RTT the pacer's rate is taken from, in microseconds: `smoothedRtt` on the pacer's clock. */
  pacerRtt: i64 = 0
  /** The caller's clock in microseconds, which it sets before each call when it keeps one, or -1. */
  micros: i64 = -1
  /** pto_count (A.3): how many probe timeouts fired since the last acknowledgement. */
  ptoCount: i32 = 0
  /** The space the last `onTimeout` acted on, or -1. */
  timeoutSpace: i32 = -1
  /**
   * max_datagram_size (B.1): the largest datagram the connection sends on
   * this path, 1200 until path MTU discovery validates more. The initial and
   * minimum windows and congestion avoidance's step are counted in it.
   * `resetPath`, which the constructor runs, sets it to
   * `QUIC_RECOVERY_DATAGRAM_SIZE`; a field's initializer
   * must be a literal.
   */
  datagramSize: i64 = 1200
  /** How many congestion events reduced the window, and how many of them were persistent congestion. */
  congestionEvents: i32 = 0
  /**
   * How many of `congestionEvents` were persistent congestion (§7.6), which collapses the window to
   * its minimum.
   */
  persistentCongestions: i32 = 0
  /** How many congestion events a rise in the ECN-CE count caused (§7.1). */
  ecnCongestionEvents: i32 = 0
  /** ECN's state, `QUIC_RECOVERY_ECN_TESTING` until a marked packet's counts validate or fail. */
  ecnState: i32 = 0
  /** The packets marked while testing, and of those recorded, how many and how many of them were lost. */
  ecnTestSent: i32 = 0
  /**
   * How many of the packets marked while testing ECN are recorded in a space's ring, so their loss can
   * be seen.
   */
  ecnTestRecorded: i32 = 0
  /**
   * How many marked packets were lost before ECN validated: once it reaches `ecnTestRecorded`, ECN
   * fails (RFC 9000 A.4).
   */
  ecnTestLost: i32 = 0
  /** Whether the handshake is confirmed (RFC 9001 §4.1.2), which the caller sets: the peer's max_ack_delay then bounds its ACK delays, and the Application Data space has a probe timeout. */
  handshakeConfirmed: boolean = false

  /**
   * Makes the state a new connection has, as `reset` leaves it: every space
   * empty, the RTT estimate and the window at their initial values.
   */
  constructor() {
    this.spaces = [
      new QuicSentPackets(QUIC_RECOVERY_HANDSHAKE_CAPACITY),
      new QuicSentPackets(QUIC_RECOVERY_HANDSHAKE_CAPACITY),
      new QuicSentPackets(QUIC_RECOVERY_APPLICATION_CAPACITY),
    ]
    this.reset()
  }

  /**
   * Puts everything back as a new connection has it: every space empty, the
   * RTT estimate and the window at their initial values. A connection slot
   * reused for another peer calls it; the rings are kept.
   */
  reset(): void {
    for (const sp of this.spaces) {
      sp.reset()
    }
    this.resetPath()
    this.maxAckDelay = QUIC_RECOVERY_DEFAULT_MAX_ACK_DELAY
    this.micros = -1
    this.ptoCount = 0
    this.timeoutSpace = -1
    this.congestionEvents = 0
    this.persistentCongestions = 0
    this.ecnCongestionEvents = 0
    this.restartEcn()
    this.handshakeConfirmed = false
  }

  /**
   * Starts the RTT estimate, the congestion window and the pacer again from
   * their initial values, for a connection whose peer moved to a new
   * address it has proved it holds (RFC 9000 §9.4): what was learnt of the
   * old path says nothing about the new one. The packets in flight, the
   * peer's `max_ack_delay` and the counters are kept.
   * @internal Read by quic.ts.
   */
  resetPath(): void {
    this.datagramSize = QUIC_RECOVERY_DATAGRAM_SIZE
    this.latestRtt = 0
    this.smoothedRtt = QUIC_RECOVERY_INITIAL_RTT
    this.rttVar = QUIC_RECOVERY_INITIAL_RTT / 2
    this.minRtt = 0
    this.firstSampleTime = -1
    this.congestionWindow = QUIC_RECOVERY_INITIAL_WINDOW
    this.ssthresh = QUIC_MAX_VARINT
    this.recoveryStart = -1
    this.cubicMax = 0
    this.cubicK = 0
    this.cubicEpoch = -1
    this.cubicEst = 0
    this.cubicEstCarry = 0
    this.cubicPrior = 0
    this.cubicIdle = -1
    this.pacerBudget = QUIC_RECOVERY_INITIAL_WINDOW
    this.pacerTime = -1
    this.pacerRtt = QUIC_RECOVERY_INITIAL_RTT * QUIC_RECOVERY_MICROS
  }

  /**
   * kInitialWindow (§7.2) for the current datagram size: min(10 × size,
   * max(14720, 2 × size)).
   *
   * @returns The initial window in bytes: 12000 at 1200 bytes.
   */
  initialWindow(): i64 {
    const ten: i64 = 10 * this.datagramSize
    const floor: i64 = quicRecoveryMax(14720, 2 * this.datagramSize)
    return ten < floor ? ten : floor
  }

  /**
   * kMinimumWindow (§7.2) for the current datagram size: two datagrams.
   *
   * @returns The minimum window in bytes: 2400 at 1200 bytes.
   */
  minimumWindow(): i64 {
    return 2 * this.datagramSize
  }

  /**
   * Sets max_datagram_size to `size` bytes, as path MTU discovery validates
   * a larger path or falls back from one (RFC 9002 §7.2). A window still at
   * the old initial window becomes the new one, so a connection that has
   * learnt nothing of the path yet starts from what the new size allows; a
   * window below the new minimum is raised to it. A smaller size keeps the
   * window as it is, and the pacer's held credit is cut to the new burst.
   *
   * @param size The new datagram size in bytes; anything under 1200 is taken as 1200.
   */
  setDatagramSize(size: i64): void {
    const next: i64 = quicRecoveryMax(size, QUIC_RECOVERY_DATAGRAM_SIZE)
    const atInitial: boolean = this.congestionWindow === this.initialWindow()
    this.datagramSize = next
    if (atInitial) {
      this.congestionWindow = this.initialWindow()
    }
    this.congestionWindow = quicRecoveryMax(this.congestionWindow, this.minimumWindow())
    if (this.pacerBudget > this.initialWindow()) {
      this.pacerBudget = this.initialWindow()
    }
  }

  /**
   * Tests ECN again from the start, as on a new path (RFC 9000 §13.4.2).
   * Every packet still in flight loses its mark: those sent on the old
   * path, and those sent to the new one before it was validated, which
   * went out under the old test. Their loss, or an ACK of them, says
   * nothing of the new test, and only packets marked from here on count
   * toward it.
   * @internal Read by quic.ts.
   */
  restartEcn(): void {
    for (const sp of this.spaces) {
      for (let s: i32 = 0; s < toI32(sp.state.length); s += 1) {
        sp.setMarked(s, false)
      }
    }
    this.ecnState = QUIC_RECOVERY_ECN_TESTING
    this.ecnTestSent = 0
    this.ecnTestRecorded = 0
    this.ecnTestLost = 0
  }

  /**
   * Space `space`'s packets, or `null` for an index that names no space.
   *
   * @param space A space's index: `QUIC_RECOVERY_INITIAL`, `QUIC_RECOVERY_HANDSHAKE` or
   *   `QUIC_RECOVERY_APPLICATION`.
   * @returns The space's own ring, not a copy, or `null` for any other index.
   */
  space(space: i32): QuicSentPackets | null {
    if (space < 0 || space >= toI32(this.spaces.length)) {
      return null
    }
    return this.spaces[space]
  }

  /**
   * bytes_in_flight (B.2): every space's packets in flight.
   *
   * @returns The bytes of every packet in flight, summed over the three spaces.
   */
  bytesInFlight(): i64 {
    let total: i64 = 0
    for (const sp of this.spaces) {
      total = total + sp.bytesInFlight
    }
    return total
  }

  /**
   * Whether the window has room for another full-sized datagram (B.4). The
   * caller sends nothing ack-eliciting while it has not, except a probe.
   *
   * @returns True when the bytes in flight plus `datagramSize` bytes fit the congestion window.
   */
  canSend(): boolean {
    return this.bytesInFlight() + this.datagramSize <= this.congestionWindow
  }

  /**
   * Records an ack-eliciting packet (A.5): number `pn` of space `space`,
   * `size` bytes on the wire, sent at `now`. Answers its slot, under which
   * the caller keeps what it carried, or -1, recording nothing, for a space
   * that does not exist, a size that is not positive, a packet number that is
   * not above the last one recorded, or a ring that is full.
   *
   * @param space The space's index, `QUIC_RECOVERY_INITIAL` to `QUIC_RECOVERY_APPLICATION`.
   * @param pn The packet's number: above the last one recorded and at most 2^62 − 1.
   * @param size The packet's size on the wire in bytes; must be positive.
   * @param now The send time, in the caller's milliseconds.
   * @returns The ring slot the packet is recorded in, or -1 when nothing was recorded.
   */
  onPacketSent(space: i32, pn: i64, size: i32, now: i64): i32 {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp === null || size <= 0 || pn <= sp.lastPn || pn > QUIC_MAX_VARINT || sp.full()) {
      return -1
    }
    const s: i32 = sp.slot(sp.count)
    if (
      s < 0 ||
      s >= toI32(sp.pn.length) ||
      s >= toI32(sp.timeSent.length) ||
      s >= toI32(sp.fineSent.length) ||
      s >= toI32(sp.size.length)
    ) {
      return -1
    }
    sp.pn[s] = pn
    sp.timeSent[s] = now
    sp.fineSent[s] = this.fineNow(now)
    sp.size[s] = size
    sp.setMarked(s, false)
    sp.setProbe(s, false)
    sp.setState(s, QUIC_RECOVERY_SENT)
    sp.count = sp.count + 1
    sp.inFlight = sp.inFlight + 1
    sp.bytesInFlight = sp.bytesInFlight + toI64(size)
    sp.lastPn = pn
    sp.lastAckEliciting = now
    return s
  }

  /**
   * Marks the packet in `space`'s slot `slot`, just recorded by
   * `onPacketSent`, as a path MTU probe (RFC 8899): it counts in flight and
   * its acknowledgement grows the window, but its loss is no congestion
   * event and no part of persistent congestion (RFC 9000 §14.4).
   *
   * @param space The space's index, as given to `onPacketSent`.
   * @param slot The slot `onPacketSent` answered; -1 or any other index outside the ring does nothing.
   */
  onProbeSent(space: i32, slot: i32): void {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp !== null) {
      sp.setProbe(slot, true)
    }
  }

  /**
   * The ECN codepoint to mark the next packet with (RFC 9000 A.4): ECT(0)
   * for the first `QUIC_RECOVERY_ECN_TESTING_PACKETS` and, once the path is
   * capable, for every one; 0, Not-ECT, while the testing packets wait to be
   * validated and once validation failed.
   *
   * @returns `QUIC_RECOVERY_ECT0` (2) to mark with, or 0 for Not-ECT.
   */
  ecnCodepoint(): i32 {
    const testing: boolean =
      this.ecnState === QUIC_RECOVERY_ECN_TESTING && this.ecnTestSent < QUIC_RECOVERY_ECN_TESTING_PACKETS
    return testing || this.ecnState === QUIC_RECOVERY_ECN_CAPABLE ? QUIC_RECOVERY_ECT0 : 0
  }

  /**
   * A packet of space `space` went out marked ECT(0): `slot` is the one
   * `onPacketSent` answered for it, or -1 for a packet that elicits no
   * acknowledgement and so was not recorded. Every packet of a datagram
   * marked counts, whatever `ecnCodepoint()` answers by the last of them.
   *
   * @param space The space's index, `QUIC_RECOVERY_INITIAL` to `QUIC_RECOVERY_APPLICATION`.
   * @param slot The slot `onPacketSent` answered for the packet, or -1 when it was not recorded.
   */
  onEctSent(space: i32, slot: i32): void {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp === null) {
      return
    }
    sp.ectSent = sp.ectSent + 1
    const recorded: boolean = sp.inFlightAt(slot) && !sp.markedAt(slot)
    if (recorded) {
      sp.setMarked(slot, true)
    }
    if (this.ecnState === QUIC_RECOVERY_ECN_TESTING || this.ecnState === QUIC_RECOVERY_ECN_UNKNOWN) {
      this.ecnTestSent = this.ecnTestSent + 1
      if (recorded) {
        this.ecnTestRecorded = this.ecnTestRecorded + 1
      }
      if (this.ecnTestSent >= QUIC_RECOVERY_ECN_TESTING_PACKETS) {
        this.ecnState = QUIC_RECOVERY_ECN_UNKNOWN
      }
    }
  }

  /**
   * An ACK frame for space `space` (A.7): `ranges` holds `count`
   * `[smallest, largest]` pairs, highest first, as `QuicFrame.ackRanges`
   * does, and `ackDelay` is the peer's ACK Delay in milliseconds. The
   * packets newly acknowledged are listed in the space's `acked`, those it
   * shows lost in `lost`; an RTT sample is taken when the largest
   * acknowledged is newly acknowledged (§5.1), the window grows or shrinks
   * (B.5, B.8), and the probe backoff resets. Answers how many packets were
   * newly acknowledged, or -1, changing nothing, when the space does not
   * exist or there is no range. A packet number the space never sent is the
   * caller's to refuse (RFC 9000 §13.1): only it knows the packets that
   * elicit no acknowledgement, which are not recorded here.
   *
   * @param space The space's index, `QUIC_RECOVERY_INITIAL` to `QUIC_RECOVERY_APPLICATION`.
   * @param ranges The acknowledged packet numbers, as `[smallest, largest]` pairs, highest first; only read.
   * @param count How many pairs of `ranges` to read; past the array's length the rest are ignored.
   * @param ackDelay The peer's ACK Delay, already scaled, in milliseconds.
   * @param now The time the ACK arrived, in the caller's milliseconds.
   * @returns How many recorded packets were newly acknowledged, or -1 when the space or the ranges are
   *   missing.
   */
  onAck(space: i32, ranges: i64[], count: i32, ackDelay: i64, now: i64): i32 {
    const none: i64 = -1
    return this.onAckEcn(space, ranges, count, ackDelay, now, none, none, none)
  }

  /**
   * `onAck` for an ACK frame that carries ECN counts, `ect0`, `ect1` and
   * `ce` as ACK_ECN gives them (RFC 9000 §19.3.2), or -1 each for one that
   * carries none. The counts are validated (RFC 9000 §13.4.2.1) and a rise
   * in ECN-CE is a congestion event (§7.1, B.7) before loss is detected, as
   * A.7 orders it.
   *
   * @param space The space's index, `QUIC_RECOVERY_INITIAL` to `QUIC_RECOVERY_APPLICATION`.
   * @param ranges The acknowledged packet numbers, as `[smallest, largest]` pairs, highest first; only read.
   * @param count How many pairs of `ranges` to read; past the array's length the rest are ignored.
   * @param ackDelay The peer's ACK Delay, already scaled, in milliseconds.
   * @param now The time the ACK arrived, in the caller's milliseconds.
   * @param ect0 The frame's ECT(0) count, or -1 for an ACK without counts.
   * @param ect1 The frame's ECT(1) count, or -1 for an ACK without counts.
   * @param ce The frame's ECN-CE count, or -1 for an ACK without counts.
   * @returns How many recorded packets were newly acknowledged, or -1 when the space or the ranges are
   *   missing.
   */
  onAckEcn(
    space: i32,
    ranges: i64[],
    count: i32,
    ackDelay: i64,
    now: i64,
    ect0: i64,
    ect1: i64,
    ce: i64
  ): i32 {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp === null || count <= 0 || toI32(ranges.length) < 2) {
      return -1
    }
    const largest: i64 = ranges[1]
    const raised: boolean = largest > sp.largestAcked
    sp.compact()
    sp.clearResults()
    if (raised) {
      sp.largestAcked = largest
    }
    // The bytes in flight before this ACK decide whether the window was in
    // use, and so whether it may grow (§7.8).
    const inUse: boolean = this.bytesInFlight() * 2 >= this.congestionWindow
    let sampleAt: i32 = -1
    // The send time of the first recorded packet past the largest acknowledged, or `now`: no earlier than the largest's own.
    let later: i64 = now
    for (let k: i32 = 0; k < sp.count; k += 1) {
      const s: i32 = sp.slot(k)
      // The ring is in packet-number order, so nothing past the largest acknowledged is.
      if (sp.pnAt(s) > largest) {
        later = sp.timeAt(s)
        break
      }
      if (sp.stateAt(s) === QUIC_RECOVERY_SENT && quicRecoveryInRanges(ranges, count, sp.pnAt(s))) {
        sp.settle(s, QUIC_RECOVERY_ACKED)
        if (sp.ackedCount < toI32(sp.acked.length)) {
          sp.acked[sp.ackedCount] = s
          sp.ackedCount = sp.ackedCount + 1
        }
        if (sp.pnAt(s) === largest) {
          sampleAt = s
        }
      }
    }
    if (sp.ackedCount === 0) {
      // An ACK that raises the largest to a packet never recorded (one that
      // elicits no ACK) still carries the newest counts. Skipping them here
      // would hide a CE rise for good, since the next ACK raises nothing.
      if (raised && this.ecnState !== QUIC_RECOVERY_ECN_FAILED) {
        this.processEcn(sp, raised, ect0, ect1, ce, later, now)
      }
      return 0
    }
    if (sampleAt >= 0) {
      this.latestRtt = quicRecoveryMax(now - sp.timeAt(sampleAt), 0)
      // §5.3: the Initial space's ACKs are not delayed by the peer, so their delay is ignored.
      const none: i64 = 0
      const delay: i64 = space === QUIC_RECOVERY_INITIAL ? none : quicRecoveryMax(ackDelay, none)
      const first: boolean = this.firstSampleTime < 0
      this.updateRtt(delay, now)
      this.updatePacerRtt(this.fineSample(now, sp.fineAt(sampleAt)), delay, first)
    }
    if (this.ecnState !== QUIC_RECOVERY_ECN_FAILED) {
      this.processEcn(sp, raised, ect0, ect1, ce, later, now)
    }
    this.detectLoss(sp, now)
    this.packetsLost(sp, now)
    if (this.controller === QUIC_RECOVERY_CUBIC) {
      this.cubicInUse(inUse, now)
    }
    for (let k: i32 = 0; k < sp.ackedCount; k += 1) {
      this.packetAcked(sp, sp.ackedSlot(k), inUse, now)
    }
    this.ptoCount = 0
    return sp.ackedCount
  }

  /**
   * ECN validation (RFC 9000 §13.4.2.1) and ProcessECN (B.7) for the ACK
   * `onAckEcn` just settled in `sp`, `raised` saying whether it raised the
   * largest acknowledged. A failure stops ECN for the connection and its
   * counts are not used; a pass makes the path capable once a marked packet
   * is among those acknowledged, and a rise in ECN-CE halves the window from
   * the send time of the largest packet newly acknowledged. With none newly
   * acknowledged it is timed from `later`, a send time no earlier than the
   * largest acknowledged packet's, which recovery did not record.
   */
  private processEcn(
    sp: QuicSentPackets,
    raised: boolean,
    ect0: i64,
    ect1: i64,
    ce: i64,
    later: i64,
    now: i64
  ): void {
    let marked: i64 = 0
    for (let k: i32 = 0; k < sp.ackedCount; k += 1) {
      if (sp.markedAt(sp.ackedSlot(k))) {
        marked = marked + 1
      }
    }
    if (ect0 < 0 || ect1 < 0 || ce < 0) {
      // An ACK without counts that newly acknowledges a marked packet: the path, or the peer, dropped them.
      if (marked > 0) {
        this.ecnState = QUIC_RECOVERY_ECN_FAILED
      }
      return
    }
    if (!raised) {
      return
    }
    // A count only grows, and none of them, nor their sum, can pass the
    // packets marked. Each is a varint, so the sum is taken by subtraction.
    const sent: i64 = sp.ectSent
    if (
      ect0 < sp.ect0 ||
      ect1 < sp.ect1 ||
      ce < sp.ce ||
      ect0 > sent ||
      ect1 > sent - ect0 ||
      ce > sent - ect0 - ect1 ||
      ect0 - sp.ect0 + (ce - sp.ce) < marked
    ) {
      this.ecnState = QUIC_RECOVERY_ECN_FAILED
      return
    }
    if (marked > 0) {
      this.ecnState = QUIC_RECOVERY_ECN_CAPABLE
    }
    const rose: boolean = ce > sp.ce
    sp.ect0 = ect0
    sp.ect1 = ect1
    sp.ce = ce
    if (rose) {
      const events: i32 = this.congestionEvents
      this.congestionEvent(sp.ackedCount > 0 ? sp.timeAt(sp.ackedSlot(sp.ackedCount - 1)) : later, now)
      if (this.congestionEvents > events) {
        this.ecnCongestionEvents = this.ecnCongestionEvents + 1
      }
    }
  }

  /** UpdateRtt (§5.3, A.7) with a sample in `latestRtt`, `ackDelay` the peer's delay in milliseconds. */
  private updateRtt(ackDelay: i64, now: i64): void {
    const latest: i64 = this.latestRtt
    if (this.firstSampleTime < 0) {
      this.minRtt = latest
      this.smoothedRtt = latest
      this.rttVar = latest / 2
      this.firstSampleTime = now
      return
    }
    if (latest < this.minRtt) {
      this.minRtt = latest
    }
    const delay: i64 = this.boundAckDelay(ackDelay)
    // The delay is taken off only where that leaves the sample at or above min_rtt.
    let adjusted: i64 = latest
    if (latest >= this.minRtt + delay) {
      adjusted = latest - delay
    }
    const gap: i64 = this.smoothedRtt > adjusted ? this.smoothedRtt - adjusted : adjusted - this.smoothedRtt
    this.rttVar = (3 * this.rttVar + gap) / 4
    this.smoothedRtt = (7 * this.smoothedRtt + adjusted) / 8
  }

  /** The peer's ACK delay in milliseconds as §5.3 counts it: at most max_ack_delay once the handshake is confirmed. */
  private boundAckDelay(ackDelay: i64): i64 {
    return this.handshakeConfirmed && ackDelay > this.maxAckDelay ? this.maxAckDelay : ackDelay
  }

  /**
   * `now` on the pacer's clock: `micros` when it falls inside the
   * millisecond `now` names, and `now × 1000` otherwise.
   *
   * @param now The caller's time in milliseconds.
   * @returns The same instant in microseconds.
   */
  fineNow(now: i64): i64 {
    const coarse: i64 = now * QUIC_RECOVERY_MICROS
    return this.micros >= coarse && this.micros < coarse + QUIC_RECOVERY_MICROS ? this.micros : coarse
  }

  /**
   * The pacer's RTT sample, in microseconds, for a packet sent at `sent` on
   * its clock: at least a microsecond on a fine clock, and at least
   * `QUIC_RECOVERY_GRANULARITY` on a millisecond one, where a sample of 0
   * says only that the round trip was under a millisecond. A packet sent
   * while `micros` was stale is stamped `now × 1000`, so a fine sample for it
   * runs long by up to a millisecond: only a carrier that calls `clock` on
   * some sends and not others sees that.
   */
  private fineSample(now: i64, sent: i64): i64 {
    const at: i64 = this.fineNow(now)
    const floor: i64 = at === this.micros ? 1 : QUIC_RECOVERY_GRANULARITY * QUIC_RECOVERY_MICROS
    return quicRecoveryMax(at - sent, floor)
  }

  /**
   * UpdateRtt (§5.3) for the pacer's RTT, in microseconds: `sample` the
   * sample, `ackDelay` the peer's delay in milliseconds, `first` whether it
   * is the connection's first. min_rtt is the millisecond one, at most the
   * true minimum, so a delay is taken off a little more readily than
   * `updateRtt` takes it.
   */
  private updatePacerRtt(sample: i64, ackDelay: i64, first: boolean): void {
    if (first) {
      this.pacerRtt = sample
      return
    }
    const delay: i64 = this.boundAckDelay(ackDelay) * QUIC_RECOVERY_MICROS
    let adjusted: i64 = sample
    if (sample >= this.minRtt * QUIC_RECOVERY_MICROS + delay) {
      adjusted = sample - delay
    }
    this.pacerRtt = (7 * this.pacerRtt + adjusted) / 8
  }

  /**
   * The loss delay (§6.1.2): 9/8 of the larger of the latest and the smoothed RTT, at least the granularity.
   *
   * @returns How long after a packet was sent it is lost by the time threshold, in milliseconds, at least 1.
   */
  lossDelay(): i64 {
    const delay: i64 = (9 * quicRecoveryMax(this.latestRtt, this.smoothedRtt)) / 8
    return quicRecoveryMax(delay, QUIC_RECOVERY_GRANULARITY)
  }

  /**
   * DetectAndRemoveLostPackets (A.10): every packet in flight at or below
   * the largest acknowledged is lost once it was sent a loss delay ago, or
   * three numbers below the largest acknowledged; the first that is neither
   * sets `lossTime`.
   */
  private detectLoss(sp: QuicSentPackets, now: i64): void {
    sp.lossTime = -1
    const delay: i64 = this.lossDelay()
    const lostSendTime: i64 = now - delay
    for (let k: i32 = 0; k < sp.count; k += 1) {
      const s: i32 = sp.slot(k)
      const pn: i64 = sp.pnAt(s)
      if (pn > sp.largestAcked) {
        break
      }
      if (sp.stateAt(s) !== QUIC_RECOVERY_SENT) {
        continue
      }
      if (sp.timeAt(s) <= lostSendTime || sp.largestAcked >= pn + QUIC_RECOVERY_PACKET_THRESHOLD) {
        sp.markLost(s)
      } else {
        const at: i64 = sp.timeAt(s) + delay
        if (sp.lossTime < 0 || at < sp.lossTime) {
          sp.lossTime = at
        }
      }
    }
  }

  /**
   * OnPacketsLost (B.8) for what `detectLoss` just declared lost: one
   * congestion event for the newest of them, and persistent congestion
   * when they span long enough.
   */
  private packetsLost(sp: QuicSentPackets, now: i64): void {
    if (sp.lostCount === 0) {
      return
    }
    let newest: i64 = -1
    for (let k: i32 = 0; k < sp.lostCount; k += 1) {
      if (!sp.probeAt(sp.lostSlot(k))) {
        newest = quicRecoveryMax(newest, sp.timeAt(sp.lostSlot(k)))
      }
      if (sp.markedAt(sp.lostSlot(k)) && this.ecnState !== QUIC_RECOVERY_ECN_CAPABLE) {
        this.ecnTestLost = this.ecnTestLost + 1
      }
    }
    // RFC 9000 A.4: every packet marked while testing that could be lost was.
    if (
      this.ecnState === QUIC_RECOVERY_ECN_UNKNOWN &&
      this.ecnTestRecorded > 0 &&
      this.ecnTestLost >= this.ecnTestRecorded
    ) {
      this.ecnState = QUIC_RECOVERY_ECN_FAILED
    }
    // A lost path MTU probe is no sign of congestion (RFC 9000 §14.4): only the others count.
    if (newest >= 0) {
      this.congestionEvent(newest, now)
    }
    if (newest >= 0 && this.persistentCongestion(sp)) {
      this.congestionWindow = this.minimumWindow()
      this.recoveryStart = -1
      // CUBIC starts over from slow start (RFC 9438 §4.8): its next stage is a new epoch.
      this.cubicEpoch = -1
      this.cubicIdle = -1
      this.persistentCongestions = this.persistentCongestions + 1
    }
    for (let k: i32 = 0; k < sp.lostCount; k += 1) {
      sp.setState(sp.lostSlot(k), QUIC_RECOVERY_LOST)
    }
  }

  /**
   * Whether the packets just declared lost establish persistent congestion
   * (§7.6.2): a run of lost ack-eliciting packets, all sent since the first
   * RTT sample, with nothing acknowledged between the first and the last,
   * spanning more than three probe timeouts with max_ack_delay, and holding
   * at least one packet this call declared lost.
   */
  private persistentCongestion(sp: QuicSentPackets): boolean {
    if (this.firstSampleTime < 0) {
      return false
    }
    const span: i64 = (this.ptoBase() + this.maxAckDelay) * QUIC_RECOVERY_PERSISTENT_THRESHOLD
    let first: i64 = -1
    let fresh: boolean = false
    for (let k: i32 = 0; k < sp.count; k += 1) {
      const s: i32 = sp.slot(k)
      const state: i32 = sp.stateAt(s)
      // An acknowledged probe still breaks the run; only a lost one says nothing (RFC 9000 §14.4).
      if (state === QUIC_RECOVERY_ACKED) {
        first = -1
        fresh = false
        continue
      }
      if (sp.probeAt(s)) {
        continue
      }
      const lost: boolean = state === QUIC_RECOVERY_LOST || state === QUIC_RECOVERY_LOST_NOW
      if (lost && sp.timeAt(s) < this.firstSampleTime) {
        first = -1
        fresh = false
        continue
      }
      if (!lost) {
        continue
      }
      if (first < 0) {
        first = sp.timeAt(s)
      }
      fresh = fresh || state === QUIC_RECOVERY_LOST_NOW
      if (fresh && sp.timeAt(s) - first > span) {
        return true
      }
    }
    return false
  }

  /** Whether a packet sent at `sentTime` was sent during the current recovery period (B.4). */
  private inRecovery(sentTime: i64): boolean {
    return this.recoveryStart >= 0 && sentTime <= this.recoveryStart
  }

  /**
   * OnCongestionEvent (B.6), once per recovery period: NewReno halves the
   * window. CUBIC (RFC 9438 §4.6, §4.7) keeps 0.7 of it, and remembers
   * where it was as W_max, or 0.85 of that when it is below the W_max
   * before (fast convergence), so a flow losing ground leaves room sooner.
   */
  private congestionEvent(sentTime: i64, now: i64): void {
    if (this.inRecovery(sentTime)) {
      return
    }
    this.recoveryStart = now
    const cwnd: i64 = this.congestionWindow
    if (this.controller === QUIC_RECOVERY_CUBIC) {
      this.cubicMax = cwnd < this.cubicMax ? (cwnd * 17) / 20 : cwnd
      this.cubicPrior = cwnd
      this.cubicEpoch = -1
      this.cubicIdle = -1
      this.ssthresh = (cwnd * 7) / 10
    } else {
      this.ssthresh = cwnd / 2
    }
    this.congestionWindow = quicRecoveryMax(this.ssthresh, this.minimumWindow())
    this.congestionEvents = this.congestionEvents + 1
  }

  /**
   * OnPacketAcked (B.5) for slot `s`: in slow start the window grows by the
   * packet's size; in congestion avoidance NewReno's by datagramSize × size / window,
   * CUBIC's as `cubicAcked` says. Not at all for a packet sent during
   * recovery, or when `inUse` says the window was not being used (§7.8).
   */
  private packetAcked(sp: QuicSentPackets, s: i32, inUse: boolean, now: i64): void {
    if (!inUse || this.inRecovery(sp.timeAt(s))) {
      return
    }
    const size: i64 = toI64(sp.sizeAt(s))
    if (this.congestionWindow < this.ssthresh) {
      this.congestionWindow = this.congestionWindow + size
    } else if (this.controller === QUIC_RECOVERY_CUBIC) {
      this.cubicAcked(size, now)
    } else {
      this.congestionWindow = this.congestionWindow + (this.datagramSize * size) / this.congestionWindow
    }
  }

  /**
   * CUBIC's congestion avoidance (RFC 9438 §4.2 to §4.5) for `size` bytes
   * newly acknowledged at `now`. The first acknowledgement of a stage starts
   * its epoch: K = ∛((W_max − cwnd) / C), or 0 with W_max taken as cwnd
   * when the window is already past it (after slow start). W_est then grows
   * as Reno's would with β 0.7, by α = 3(1 − β)/(1 + β) = 9/17 datagram a
   * window of acknowledgements, and by 1 once it has passed cwnd_prior. If
   * the curve W(t) is below W_est the window is W_est (the Reno-friendly
   * region); otherwise it moves toward W(t + RTT), held within cwnd ..
   * 1.5 × cwnd, by (target − cwnd) × size / cwnd: concave below W_max, convex
   * past it. Integers throughout; each division truncates, and W_est carries
   * what it truncated.
   */
  private cubicAcked(size: i64, now: i64): void {
    const cwnd: i64 = this.congestionWindow
    if (this.cubicEpoch < 0) {
      this.cubicEpoch = now
      this.cubicIdle = -1
      this.cubicEst = cwnd
      this.cubicEstCarry = 0
      if (this.cubicMax > cwnd) {
        this.cubicK = this.cubicSpan(this.cubicMax - cwnd)
      } else {
        this.cubicK = 0
        this.cubicMax = cwnd
      }
    }
    const alpha: i64 = this.cubicEst >= this.cubicPrior ? 17 : 9
    const num: i64 = alpha * size * this.datagramSize + this.cubicEstCarry
    const den: i64 = 17 * cwnd
    this.cubicEst = this.cubicEst + num / den
    this.cubicEstCarry = num % den
    const t: i64 = now - this.cubicEpoch
    if (this.cubicWindow(t) < this.cubicEst) {
      this.congestionWindow = quicRecoveryMax(cwnd, this.cubicEst)
      return
    }
    const ceiling: i64 = cwnd + cwnd / 2
    const curve: i64 = this.cubicWindow(t + this.smoothedRtt)
    const target: i64 = curve < cwnd ? cwnd : curve > ceiling ? ceiling : curve
    this.congestionWindow = cwnd + ((target - cwnd) * size) / cwnd
  }

  /**
   * W_cubic(t) (RFC 9438 §4.2) in bytes, `t` milliseconds into the epoch:
   * W_max + C × (t − K)³ in datagrams, which is W_max + 2 × size × (t − K)³ /
   * 5 × 10⁹ in bytes and milliseconds, with t − K clamped to ±40 s. The
   * division truncates toward zero.
   */
  private cubicWindow(t: i64): i64 {
    const d: i64 = quicRecoveryCubicClamp(t - this.cubicK)
    return this.cubicMax + (2 * this.datagramSize * (d * d * d)) / QUIC_RECOVERY_CUBIC_SCALE
  }

  /**
   * K (RFC 9438 §4.2) for a fall of `drop` bytes below W_max: ∛(drop / C) in
   * datagrams and seconds, which is ∛(drop × 5 × 10⁹ / (2 × size)) in
   * milliseconds, rounded down; a fall too deep for the cube to fit is 40 s.
   */
  private cubicSpan(drop: i64): i64 {
    const two: i64 = 2 * this.datagramSize
    const span: i64 = QUIC_RECOVERY_CUBIC_SPAN
    // drop >= span³ × 2 × size / (5 × 10⁹), which is 25600 × size, has K at the span or past it.
    if (drop >= 25600 * this.datagramSize) {
      return span
    }
    return quicRecoveryCbrt((drop * QUIC_RECOVERY_CUBIC_SCALE) / two)
  }

  /**
   * The application-limited rule (RFC 9438 §5.8) at an acknowledgement:
   * while the window is not in use it does not grow (`packetAcked`), and the
   * time it spends so is taken out of the curve, so a stage resumes where it
   * stood rather than at the point the clock has reached.
   */
  private cubicInUse(inUse: boolean, now: i64): void {
    if (this.cubicEpoch < 0) {
      return
    }
    if (!inUse) {
      if (this.cubicIdle < 0) {
        this.cubicIdle = now
      }
      return
    }
    if (this.cubicIdle >= 0) {
      this.cubicEpoch = this.cubicEpoch + (now - this.cubicIdle)
      this.cubicIdle = -1
    }
  }

  /**
   * The probe timeout's period without backoff (§6.2.1): smoothed_rtt +
   * max(4 × rttvar, kGranularity), plus the peer's max_ack_delay once the
   * handshake is confirmed. It is also what a key update's old keys are kept
   * for and what the idle timeout is at least three of.
   *
   * @returns The period in milliseconds, at least 1.
   */
  probeTimeout(): i64 {
    const base: i64 = this.ptoBase()
    return this.handshakeConfirmed ? base + this.maxAckDelay : base
  }

  /** smoothed_rtt + max(4 × rttvar, kGranularity): every probe timeout's period before max_ack_delay and the backoff. */
  private ptoBase(): i64 {
    return this.smoothedRtt + quicRecoveryMax(4 * this.rttVar, QUIC_RECOVERY_GRANULARITY)
  }

  /**
   * GetPtoTimeAndSpace (A.8): when the probe timeout fires, the earliest
   * over the spaces with an ack-eliciting packet in flight, with the backoff
   * applied; the Application Data space counts only once the handshake is
   * confirmed. Answers -1 with nothing in flight.
   *
   * @returns The time the probe timeout fires, in the caller's milliseconds, or -1 when no space has one.
   */
  ptoTime(): i64 {
    const space: i32 = this.ptoSpace()
    if (space < 0) {
      return -1
    }
    return this.ptoTimeOf(space)
  }

  /** The probe timeout of space `space`, from its last ack-eliciting packet, with the backoff. */
  private ptoTimeOf(space: i32): i64 {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp === null || sp.lastAckEliciting < 0) {
      return -1
    }
    const backoff: i64 = toI64(1) << toI64(this.ptoCount)
    let duration: i64 = this.ptoBase()
    if (space === QUIC_RECOVERY_APPLICATION) {
      duration = duration + this.maxAckDelay
    }
    return sp.lastAckEliciting + duration * backoff
  }

  /** The space whose probe timeout fires first, or -1 when no space may have one. */
  private ptoSpace(): i32 {
    let best: i32 = -1
    let bestTime: i64 = -1
    for (let space: i32 = 0; space < toI32(this.spaces.length); space += 1) {
      const sp: QuicSentPackets = this.spaces[space]
      if (sp.inFlight === 0 || (space === QUIC_RECOVERY_APPLICATION && !this.handshakeConfirmed)) {
        continue
      }
      const at: i64 = this.ptoTimeOf(space)
      if (best < 0 || at < bestTime) {
        best = space
        bestTime = at
      }
    }
    return best
  }

  /** The space with the earliest `lossTime`, or -1 when none is set. */
  private lossSpace(): i32 {
    let best: i32 = -1
    let bestTime: i64 = -1
    for (let space: i32 = 0; space < toI32(this.spaces.length); space += 1) {
      const at: i64 = this.spaces[space].lossTime
      if (at >= 0 && (best < 0 || at < bestTime)) {
        best = space
        bestTime = at
      }
    }
    return best
  }

  /**
   * SetLossDetectionTimer (A.8): when `onTimeout` is next due — the earliest
   * time-threshold loss, else the probe timeout — or -1 for none. With
   * `amplificationBlocked`, when the server may send nothing until the client
   * does (RFC 9000 §8.1), there is no probe timeout (§6.2.2.1).
   *
   * @param amplificationBlocked Whether the anti-amplification limit stops the server sending anything now.
   * @returns The time `onTimeout` is next due, in the caller's milliseconds, or -1 when no timer is set.
   */
  deadline(amplificationBlocked: boolean): i64 {
    const loss: i32 = this.lossSpace()
    if (loss >= 0) {
      return this.spaces[loss].lossTime
    }
    if (amplificationBlocked) {
      return -1
    }
    return this.ptoTime()
  }

  /**
   * OnLossDetectionTimeout (A.9), at `now`. When a time-threshold loss is
   * due, the space's packets are checked again and the lost ones listed in
   * its `lost`: `QUIC_RECOVERY_TIMEOUT_LOSS`. Otherwise, when the probe
   * timeout is due, the backoff doubles and the caller is to send a probe in
   * `timeoutSpace`: `QUIC_RECOVERY_TIMEOUT_PTO`. Before either is due, or
   * when nothing is timed, `QUIC_RECOVERY_TIMEOUT_NONE`.
   *
   * @param now The caller's time in milliseconds.
   * @param amplificationBlocked Whether the anti-amplification limit stops the server sending anything now.
   * @returns One of `QUIC_RECOVERY_TIMEOUT_NONE`, `QUIC_RECOVERY_TIMEOUT_LOSS` or
   *   `QUIC_RECOVERY_TIMEOUT_PTO`.
   */
  onTimeout(now: i64, amplificationBlocked: boolean): i32 {
    for (const sp of this.spaces) {
      sp.compact()
      sp.clearResults()
    }
    this.timeoutSpace = -1
    const due: i64 = this.deadline(amplificationBlocked)
    if (due < 0 || now < due) {
      return QUIC_RECOVERY_TIMEOUT_NONE
    }
    const loss: i32 = this.lossSpace()
    if (loss >= 0) {
      const sp: QuicSentPackets = this.spaces[loss]
      this.detectLoss(sp, now)
      this.packetsLost(sp, now)
      this.timeoutSpace = loss
      return QUIC_RECOVERY_TIMEOUT_LOSS
    }
    this.timeoutSpace = this.ptoSpace()
    if (this.ptoCount < QUIC_RECOVERY_MAX_BACKOFF) {
      this.ptoCount = this.ptoCount + 1
    }
    return QUIC_RECOVERY_TIMEOUT_PTO
  }

  /**
   * Gives up the oldest packet still in flight in space `space`, taking it
   * out of flight without a congestion event, so that a probe can be recorded
   * when the ring is full. The caller has already queued what the space had
   * in flight again, which is what a probe sends. Answers the slot, or -1
   * when nothing is in flight there.
   *
   * @param space The space's index, `QUIC_RECOVERY_INITIAL` to `QUIC_RECOVERY_APPLICATION`.
   * @returns The slot of the packet given up, now settled as lost, or -1 when nothing is in flight there.
   */
  evictOldest(space: i32): i32 {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp === null) {
      return -1
    }
    sp.compact()
    for (let k: i32 = 0; k < sp.count; k += 1) {
      const s: i32 = sp.slot(k)
      if (sp.stateAt(s) === QUIC_RECOVERY_SENT) {
        sp.settle(s, QUIC_RECOVERY_LOST)
        return s
      }
    }
    return -1
  }

  /**
   * OnPacketNumberSpaceDiscarded (A.11): the space's keys are gone, so its
   * packets leave flight uncounted, its timers stop, and the backoff resets.
   *
   * @param space The space's index, `QUIC_RECOVERY_INITIAL` to `QUIC_RECOVERY_APPLICATION`.
   */
  discardSpace(space: i32): void {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp === null) {
      return
    }
    sp.clear()
    this.ptoCount = 0
  }

  /** The congestion window the pacer earns by: at most `QUIC_RECOVERY_PACER_WINDOW`. */
  private pacerWindow(): i64 {
    return this.congestionWindow < QUIC_RECOVERY_PACER_WINDOW
      ? this.congestionWindow
      : QUIC_RECOVERY_PACER_WINDOW
  }

  /**
   * Tops the pacer up to `now` (§7.7), on its clock: it earns 5/4 of the
   * window per `pacerRtt`, and holds at most the initial window, which is the
   * largest burst it allows.
   */
  private pacerRefill(now: i64): void {
    const at: i64 = this.fineNow(now)
    if (this.pacerTime < 0 || at < this.pacerTime) {
      this.pacerTime = at
      return
    }
    // A minute is far past what fills the budget, and keeps the product in range.
    let elapsed: i64 = at - this.pacerTime
    if (elapsed > 60000000) {
      elapsed = 60000000
    }
    const rtt: i64 = quicRecoveryMax(this.pacerRtt, 1)
    const earned: i64 = (elapsed * this.pacerWindow() * 5) / (rtt * 4)
    this.pacerBudget = this.pacerBudget + earned
    if (this.pacerBudget > this.initialWindow()) {
      this.pacerBudget = this.initialWindow()
    }
    this.pacerTime = at
  }

  /**
   * How many milliseconds after `now` the pacer lets a datagram of `size`
   * bytes go: 0 when it may go now, else its wait in microseconds rounded
   * up to whole milliseconds, so at least 1. The rate is 5/4 of the window per `pacerRtt`
   * (§7.7's N of 1.25).
   *
   * @param now The caller's time in milliseconds; the pacer reads `micros` too when it is current.
   * @param size The datagram's size in bytes.
   * @returns The wait in whole milliseconds: 0 to send now, else at least 1.
   */
  pacerDelay(now: i64, size: i32): i64 {
    this.pacerRefill(now)
    const need: i64 = toI64(size) - this.pacerBudget
    if (need <= 0) {
      return 0
    }
    const rtt: i64 = quicRecoveryMax(this.pacerRtt, 1)
    const rate: i64 = quicRecoveryMax(this.pacerWindow() * 5, 1)
    const wait: i64 = (need * rtt * 4 + rate - 1) / rate
    return quicRecoveryMax((wait + QUIC_RECOVERY_MICROS - 1) / QUIC_RECOVERY_MICROS, 1)
  }

  /**
   * The credit a paced flight waits for before it starts, in bytes: what the
   * pacer earns in a millisecond, at least `least` and at most `most`. A
   * pacer that earns by the microsecond would otherwise let a fast
   * connection out a datagram at a time, one send each; one that earns
   * slowly still lets a datagram go as soon as it has the credit for it.
   *
   * @param least The smallest quantum, in bytes, such as one full datagram.
   * @param most The largest quantum, in bytes, such as `QUIC_LISTENER_FLIGHT_QUANTUM`.
   * @returns The bytes the pacer earns in a millisecond, held to `least` and `most`.
   */
  pacerQuantum(least: i32, most: i32): i32 {
    const rtt: i64 = quicRecoveryMax(this.pacerRtt, 1)
    const milli: i64 = (this.pacerWindow() * 5 * QUIC_RECOVERY_MICROS) / (rtt * 4)
    if (milli < toI64(least)) {
      return least
    }
    return milli > toI64(most) ? most : toI32(milli)
  }

  /**
   * Charges the pacer for a datagram of `size` bytes sent at `now`.
   *
   * @param now The send time in the caller's milliseconds; the pacer is topped up to it first.
   * @param size The datagram's size in bytes, which may take the credit below 0.
   */
  onPaced(now: i64, size: i32): void {
    this.pacerRefill(now)
    this.pacerBudget = this.pacerBudget - toI64(size)
  }
}
