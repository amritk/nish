/**
 * `nish/net/quic-recovery` — QUIC loss detection and congestion control
 * (RFC 9002): the packets each packet number space has in flight, the
 * round-trip estimate, loss by packet and by time threshold, the probe
 * timeout with its backoff, NewReno, and a pacer. Sans-IO: it never sees a
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
 * ring (`QuicSentPackets`), in the order they were sent, so the memory is
 * fixed when the connection is made and nothing is allocated per packet. A
 * packet that elicits no acknowledgement (one that carries only ACK, PADDING
 * or CONNECTION_CLOSE) is not recorded: it is never in flight, and neither
 * an RTT sample nor a loss is ever taken from it (RFC 9002 §2, §5.1). The
 * caller keeps what each packet carried in its own arrays, indexed by the
 * slot `onPacketSent` answers, and reads `acked` and `lost` after each
 * `onAck` and `onTimeout` to learn which slots were settled. A slot named
 * there keeps its packet number, time and size until the next call.
 *
 * **Time and units.** Every time and every duration is the caller's
 * monotonic clock in milliseconds, which is also the timer granularity
 * (`QUIC_RECOVERY_GRANULARITY`, §6.1.2), and the arithmetic is Appendix A's
 * and Appendix B's in integers: `smoothed_rtt = (7 × smoothed_rtt +
 * adjusted_rtt) / 8`, `rttvar = (3 × rttvar + |smoothed_rtt −
 * adjusted_rtt|) / 4`, each division truncating. Sizes are bytes.
 *
 * **What the server leaves out.** It is written for the server side of a
 * connection: there is no client anti-deadlock probe (§6.2.2.1), since a
 * server never has to send to unblock its peer, and nothing reads ECN
 * (§7.1, B.7). A congestion window that the sender does not use is not
 * grown (§7.8): an acknowledgement grows it only if, when it arrived, the
 * bytes in flight were at least half the window.
 *
 * **What a peer cannot do.** Every input is checked: the ranges of an
 * acknowledgement are read only up to the count given and the array's
 * length, a packet acknowledged twice counts once, and
 * the backoff stops doubling at `QUIC_RECOVERY_MAX_BACKOFF`, so no duration
 * overflows. A peer that never acknowledges anything costs a probe each
 * timeout, at a rate that halves each time, until the idle timeout ends the
 * connection.
 *
 * Written from RFC 9002 §5 to §7 and its Appendices A and B, in this
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
/** max_datagram_size (B.1): the 1200 bytes every datagram this server sends is at most. */
export const QUIC_RECOVERY_DATAGRAM_SIZE: i64 = 1200
/** kInitialWindow (§7.2): min(10 × 1200, max(14720, 2 × 1200)), so 12000 bytes. */
export const QUIC_RECOVERY_INITIAL_WINDOW: i64 = 12000
/** kMinimumWindow (§7.2): two datagrams, 2400 bytes. */
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

/** The larger of two times or durations. */
const quicRecoveryMax = (a: i64, b: i64): i64 => (a > b ? a : b)

/**
 * The ack-eliciting packets one space sent, in a ring of `capacity` slots
 * in the order they went out: slot `slot(k)` is the `k`-th from the oldest
 * still kept, for `k` below `count`. A packet stays in its slot after it is
 * acknowledged or lost until every older one is settled too, which is what
 * lets persistent congestion see that nothing between two lost packets was
 * acknowledged (§7.6.2).
 */
export class QuicSentPackets {
  pn: i64[]
  timeSent: i64[]
  size: i32[]
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
  capacity: i32 = 0
  head: i32 = 0
  count: i32 = 0
  /** How many recorded packets are still in flight: neither acknowledged nor lost. */
  inFlight: i32 = 0
  ackedCount: i32 = 0
  lostCount: i32 = 0

  constructor(capacity: i32) {
    this.capacity = capacity
    this.pn = new Array<i64>(capacity)
    this.timeSent = new Array<i64>(capacity)
    this.size = new Array<i32>(capacity)
    this.state = new Array<u8>(capacity)
    this.acked = new Array<i32>(capacity)
    this.lost = new Array<i32>(capacity)
  }

  /** The ring slot of the `k`-th packet kept, counting from the oldest. */
  slot(k: i32): i32 {
    return (this.head + k) % this.capacity
  }

  /** The state of slot `s`, or free for a slot outside the ring. */
  stateAt(s: i32): i32 {
    if (s < 0 || s >= toI32(this.state.length)) {
      return QUIC_RECOVERY_FREE
    }
    return toI32(this.state[s])
  }

  /** Sets slot `s`'s state. */
  setState(s: i32, value: i32): void {
    if (s >= 0 && s < toI32(this.state.length)) {
      this.state[s] = toU8(value)
    }
  }

  /** The packet number in slot `s`, or -1. */
  pnAt(s: i32): i64 {
    return s >= 0 && s < toI32(this.pn.length) ? this.pn[s] : -1
  }

  /** When the packet in slot `s` was sent, or -1. */
  timeAt(s: i32): i64 {
    return s >= 0 && s < toI32(this.timeSent.length) ? this.timeSent[s] : -1
  }

  /** The size of the packet in slot `s`, or 0. */
  sizeAt(s: i32): i32 {
    return s >= 0 && s < toI32(this.size.length) ? this.size[s] : 0
  }

  /** The `k`-th slot the last call acknowledged, or -1. */
  ackedSlot(k: i32): i32 {
    return k >= 0 && k < this.ackedCount && k < toI32(this.acked.length) ? this.acked[k] : -1
  }

  /** The `k`-th slot the last call declared lost, or -1. */
  lostSlot(k: i32): i32 {
    return k >= 0 && k < this.lostCount && k < toI32(this.lost.length) ? this.lost[k] : -1
  }

  /** Whether slot `s` holds a packet still in flight. */
  inFlightAt(s: i32): boolean {
    return this.stateAt(s) === QUIC_RECOVERY_SENT
  }

  /** Whether every slot is taken, so nothing more can be recorded until a packet is settled. */
  full(): boolean {
    this.compact()
    return this.count >= this.capacity
  }

  /** Frees the oldest slots that are settled, acknowledged or lost. */
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

  /** Forgets the results of the last call. */
  clearResults(): void {
    this.ackedCount = 0
    this.lostCount = 0
  }

  /** Takes packet `s` out of flight. */
  settle(s: i32, state: i32): void {
    this.setState(s, state)
    this.inFlight = this.inFlight - 1
    this.bytesInFlight = this.bytesInFlight - toI64(this.sizeAt(s))
  }

  /** Settles packet `s` as lost and lists it in `lost`. */
  markLost(s: i32): void {
    this.settle(s, QUIC_RECOVERY_LOST_NOW)
    if (this.lostCount < toI32(this.lost.length)) {
      this.lost[this.lostCount] = s
      this.lostCount = this.lostCount + 1
    }
  }

  /** Drops every packet, as when the space's keys are discarded (A.11). */
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
  /** The pacer's credit in bytes (§7.7), and the time it was last topped up, or -1. */
  pacerBudget: i64 = 0
  pacerTime: i64 = -1
  /** pto_count (A.3): how many probe timeouts fired since the last acknowledgement. */
  ptoCount: i32 = 0
  /** The space the last `onTimeout` acted on, or -1. */
  timeoutSpace: i32 = -1
  /** How many congestion events reduced the window, and how many of them were persistent congestion. */
  congestionEvents: i32 = 0
  persistentCongestions: i32 = 0
  /** Whether the handshake is confirmed (RFC 9001 §4.1.2), which the caller sets: the peer's max_ack_delay then bounds its ACK delays, and the Application Data space has a probe timeout. */
  handshakeConfirmed: boolean = false

  constructor() {
    this.spaces = [
      new QuicSentPackets(QUIC_RECOVERY_HANDSHAKE_CAPACITY),
      new QuicSentPackets(QUIC_RECOVERY_HANDSHAKE_CAPACITY),
      new QuicSentPackets(QUIC_RECOVERY_APPLICATION_CAPACITY),
    ]
    this.smoothedRtt = QUIC_RECOVERY_INITIAL_RTT
    this.rttVar = QUIC_RECOVERY_INITIAL_RTT / 2
    this.maxAckDelay = QUIC_RECOVERY_DEFAULT_MAX_ACK_DELAY
    this.congestionWindow = QUIC_RECOVERY_INITIAL_WINDOW
    this.pacerBudget = QUIC_RECOVERY_INITIAL_WINDOW
    this.ssthresh = QUIC_MAX_VARINT
  }

  /** Space `space`'s packets, or `null` for an index that names no space. */
  space(space: i32): QuicSentPackets | null {
    if (space < 0 || space >= toI32(this.spaces.length)) {
      return null
    }
    return this.spaces[space]
  }

  /** bytes_in_flight (B.2): every space's packets in flight. */
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
   */
  canSend(): boolean {
    return this.bytesInFlight() + QUIC_RECOVERY_DATAGRAM_SIZE <= this.congestionWindow
  }

  /**
   * Records an ack-eliciting packet (A.5): number `pn` of space `space`,
   * `size` bytes on the wire, sent at `now`. Answers its slot, under which
   * the caller keeps what it carried, or -1, recording nothing, for a space
   * that does not exist, a size that is not positive, a packet number that is
   * not above the last one recorded, or a ring that is full.
   */
  onPacketSent(space: i32, pn: i64, size: i32, now: i64): i32 {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp === null || size <= 0 || pn <= sp.lastPn || pn > QUIC_MAX_VARINT || sp.full()) {
      return -1
    }
    const s: i32 = sp.slot(sp.count)
    if (s < 0 || s >= toI32(sp.pn.length) || s >= toI32(sp.timeSent.length) || s >= toI32(sp.size.length)) {
      return -1
    }
    sp.pn[s] = pn
    sp.timeSent[s] = now
    sp.size[s] = size
    sp.setState(s, QUIC_RECOVERY_SENT)
    sp.count = sp.count + 1
    sp.inFlight = sp.inFlight + 1
    sp.bytesInFlight = sp.bytesInFlight + toI64(size)
    sp.lastPn = pn
    sp.lastAckEliciting = now
    return s
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
   */
  onAck(space: i32, ranges: i64[], count: i32, ackDelay: i64, now: i64): i32 {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp === null || count <= 0 || toI32(ranges.length) < 2) {
      return -1
    }
    const largest: i64 = ranges[1]
    sp.compact()
    sp.clearResults()
    if (largest > sp.largestAcked) {
      sp.largestAcked = largest
    }
    // The bytes in flight before this ACK decide whether the window was in
    // use, and so whether it may grow (§7.8).
    const inUse: boolean = this.bytesInFlight() * 2 >= this.congestionWindow
    let sampleAt: i32 = -1
    for (let k: i32 = 0; k < sp.count; k += 1) {
      const s: i32 = sp.slot(k)
      // The ring is in packet-number order, so nothing past the largest acknowledged is.
      if (sp.pnAt(s) > largest) {
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
      return 0
    }
    if (sampleAt >= 0) {
      this.latestRtt = quicRecoveryMax(now - sp.timeAt(sampleAt), 0)
      // §5.3: the Initial space's ACKs are not delayed by the peer, so their delay is ignored.
      const none: i64 = 0
      this.updateRtt(space === QUIC_RECOVERY_INITIAL ? none : quicRecoveryMax(ackDelay, none), now)
    }
    this.detectLoss(sp, now)
    this.packetsLost(sp, now)
    for (let k: i32 = 0; k < sp.ackedCount; k += 1) {
      this.packetAcked(sp, sp.ackedSlot(k), inUse)
    }
    this.ptoCount = 0
    return sp.ackedCount
  }

  /** UpdateRtt (§5.3, A.7) with a sample in `latestRtt`, `ackDelay` the peer's delay in milliseconds. */
  updateRtt(ackDelay: i64, now: i64): void {
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
    let delay: i64 = ackDelay
    if (this.handshakeConfirmed && delay > this.maxAckDelay) {
      delay = this.maxAckDelay
    }
    // The delay is taken off only where that leaves the sample at or above min_rtt.
    let adjusted: i64 = latest
    if (latest >= this.minRtt + delay) {
      adjusted = latest - delay
    }
    const gap: i64 = this.smoothedRtt > adjusted ? this.smoothedRtt - adjusted : adjusted - this.smoothedRtt
    this.rttVar = (3 * this.rttVar + gap) / 4
    this.smoothedRtt = (7 * this.smoothedRtt + adjusted) / 8
  }

  /** The loss delay (§6.1.2): 9/8 of the larger of the latest and the smoothed RTT, at least the granularity. */
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
  detectLoss(sp: QuicSentPackets, now: i64): void {
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
  packetsLost(sp: QuicSentPackets, now: i64): void {
    if (sp.lostCount === 0) {
      return
    }
    let newest: i64 = -1
    for (let k: i32 = 0; k < sp.lostCount; k += 1) {
      newest = quicRecoveryMax(newest, sp.timeAt(sp.lostSlot(k)))
    }
    this.congestionEvent(newest, now)
    if (this.persistentCongestion(sp)) {
      this.congestionWindow = QUIC_RECOVERY_MINIMUM_WINDOW
      this.recoveryStart = -1
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
  persistentCongestion(sp: QuicSentPackets): boolean {
    if (this.firstSampleTime < 0) {
      return false
    }
    const span: i64 = (this.ptoBase() + this.maxAckDelay) * QUIC_RECOVERY_PERSISTENT_THRESHOLD
    let first: i64 = -1
    let fresh: boolean = false
    for (let k: i32 = 0; k < sp.count; k += 1) {
      const s: i32 = sp.slot(k)
      const state: i32 = sp.stateAt(s)
      const lost: boolean = state === QUIC_RECOVERY_LOST || state === QUIC_RECOVERY_LOST_NOW
      if (state === QUIC_RECOVERY_ACKED || (lost && sp.timeAt(s) < this.firstSampleTime)) {
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
  inRecovery(sentTime: i64): boolean {
    return this.recoveryStart >= 0 && sentTime <= this.recoveryStart
  }

  /** OnCongestionEvent (B.6): halve the window, once per recovery period. */
  congestionEvent(sentTime: i64, now: i64): void {
    if (this.inRecovery(sentTime)) {
      return
    }
    this.recoveryStart = now
    this.ssthresh = this.congestionWindow / 2
    this.congestionWindow = quicRecoveryMax(this.ssthresh, QUIC_RECOVERY_MINIMUM_WINDOW)
    this.congestionEvents = this.congestionEvents + 1
  }

  /**
   * OnPacketAcked (B.5) for slot `s`: in slow start the window grows by the
   * packet's size, in congestion avoidance by 1200 × size / window; not at
   * all for a packet sent during recovery, or when `inUse` says the window
   * was not being used (§7.8).
   */
  packetAcked(sp: QuicSentPackets, s: i32, inUse: boolean): void {
    if (!inUse || this.inRecovery(sp.timeAt(s))) {
      return
    }
    const size: i64 = toI64(sp.sizeAt(s))
    if (this.congestionWindow < this.ssthresh) {
      this.congestionWindow = this.congestionWindow + size
    } else {
      this.congestionWindow =
        this.congestionWindow + (QUIC_RECOVERY_DATAGRAM_SIZE * size) / this.congestionWindow
    }
  }

  /**
   * The probe timeout's period without backoff (§6.2.1): smoothed_rtt +
   * max(4 × rttvar, kGranularity), plus the peer's max_ack_delay once the
   * handshake is confirmed. It is also what a key update's old keys are kept
   * for and what the idle timeout is at least three of.
   */
  probeTimeout(): i64 {
    const base: i64 = this.ptoBase()
    return this.handshakeConfirmed ? base + this.maxAckDelay : base
  }

  /** smoothed_rtt + max(4 × rttvar, kGranularity): every probe timeout's period before max_ack_delay and the backoff. */
  ptoBase(): i64 {
    return this.smoothedRtt + quicRecoveryMax(4 * this.rttVar, QUIC_RECOVERY_GRANULARITY)
  }

  /**
   * GetPtoTimeAndSpace (A.8): when the probe timeout fires, the earliest
   * over the spaces with an ack-eliciting packet in flight, with the backoff
   * applied; the Application Data space counts only once the handshake is
   * confirmed. Answers -1 with nothing in flight. `ptoSpace()` names the
   * space it chose.
   */
  ptoTime(): i64 {
    const space: i32 = this.ptoSpace()
    if (space < 0) {
      return -1
    }
    return this.ptoTimeOf(space)
  }

  /** The probe timeout of space `space`, from its last ack-eliciting packet, with the backoff. */
  ptoTimeOf(space: i32): i64 {
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
  ptoSpace(): i32 {
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
  lossSpace(): i32 {
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
   */
  discardSpace(space: i32): void {
    const sp: QuicSentPackets | null = this.space(space)
    if (sp === null) {
      return
    }
    sp.clear()
    this.ptoCount = 0
  }

  /**
   * Tops the pacer up to `now` (§7.7): it earns 5/4 of the window per
   * smoothed RTT, and holds at most the initial window, which is the largest
   * burst it allows.
   */
  pacerRefill(now: i64): void {
    if (this.pacerTime < 0 || now < this.pacerTime) {
      this.pacerTime = now
      return
    }
    // A minute is far past what fills the budget, and keeps the product in range.
    let elapsed: i64 = now - this.pacerTime
    if (elapsed > 60000) {
      elapsed = 60000
    }
    const rtt: i64 = quicRecoveryMax(this.smoothedRtt, QUIC_RECOVERY_GRANULARITY)
    const earned: i64 = (elapsed * this.congestionWindow * 5) / (rtt * 4)
    this.pacerBudget = this.pacerBudget + earned
    if (this.pacerBudget > QUIC_RECOVERY_INITIAL_WINDOW) {
      this.pacerBudget = QUIC_RECOVERY_INITIAL_WINDOW
    }
    this.pacerTime = now
  }

  /**
   * How many milliseconds after `now` the pacer lets a datagram of `size`
   * bytes go: 0 when it may go now, else at least 1. The rate is 5/4 of the
   * window per smoothed RTT (§7.7's N of 1.25).
   */
  pacerDelay(now: i64, size: i32): i64 {
    this.pacerRefill(now)
    const need: i64 = toI64(size) - this.pacerBudget
    if (need <= 0) {
      return 0
    }
    const rtt: i64 = quicRecoveryMax(this.smoothedRtt, QUIC_RECOVERY_GRANULARITY)
    const rate: i64 = quicRecoveryMax(this.congestionWindow * 5, 1)
    const wait: i64 = (need * rtt * 4 + rate - 1) / rate
    return quicRecoveryMax(wait, 1)
  }

  /** Charges the pacer for a datagram of `size` bytes sent at `now`. */
  onPaced(now: i64, size: i32): void {
    this.pacerRefill(now)
    this.pacerBudget = this.pacerBudget - toI64(size)
  }
}
