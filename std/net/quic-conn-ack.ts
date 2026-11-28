/**
 * `nish/net/quic-conn-ack` — the packet numbers one QUIC packet number space
 * has received, kept as ranges, which is what duplicate detection reads
 * (RFC 9000 §12.3) and what an ACK frame is written from (§13.2, §19.3).
 *
 *     import { QuicAckRanges } from "nish/net/quic-conn-ack";
 *
 *     const received: QuicAckRanges = new QuicAckRanges()
 *     const fresh: boolean = received.record(toI64(7), true)   // true: 7 is new and asks for an ACK
 *     const again: boolean = received.record(toI64(7), true)   // false: a duplicate, so drop the packet
 *     const payload: u8[] = []
 *     if (received.ackPending) {
 *       received.pushAck(payload, toI64(0))                    // appends ACK [7, 7], clears ackPending
 *     }
 *
 * **Bounded.** At most `QUIC_ACK_MAX_RANGES` ranges are kept, highest first.
 * A new range past that drops the lowest, and everything at or below what it
 * covered becomes the `floor`: a packet number there is answered as already
 * seen, because this side can no longer tell, and RFC 9000 §12.3 says a
 * receiver must discard a packet it cannot be sure it has not processed. So a
 * peer that sends packet numbers full of holes costs a fixed amount of memory
 * and loses only very late packets.
 *
 * **When to acknowledge.** That is the connection's choice; this module records
 * whether something ack-eliciting arrived since the last ACK it wrote
 * (`ackPending`). ACK frames carry an ACK Delay the caller supplies.
 *
 * **ECN counts.** `countEcn` adds a packet's ECN codepoint to the space's
 * ECT(0), ECT(1) or ECN-CE count (RFC 9000 §13.4.1); the caller counts a
 * packet only once `record` has accepted it, so a duplicate is not counted.
 * Once any count is above zero every ACK written is an ACK_ECN (type 0x03)
 * carrying all three, and before that a plain ACK (type 0x02).
 *
 * **Provenance.** Written from RFC 9000 §12.3, §13.2, §13.4.1 and §19.3, not ported from another
 * implementation. Private names carry the `quicAck` prefix
 * (`docs/wp26-stdlib.md` §3e).
 */
import { QUIC_MAX_VARINT } from "nish/net/quic-packet"
import { quicPushAck, quicPushAckEcn, quicPutAck, quicPutAckEcn } from "nish/net/quic-frame"

/** The most disjoint ranges a `QuicAckRanges` keeps, and so the most an ACK frame it writes lists. */
export const QUIC_ACK_MAX_RANGES: i32 = 32

/**
 * One more than `n`, or -1 when `n` is below 0 or already `QUIC_MAX_VARINT`,
 * the largest packet number or count a varint carries (RFC 9000 §16).
 * Counted down from `QUIC_MAX_VARINT`, so the sum is one `src/bounds.ts`
 * proves, never a wrap.
 */
const quicAckNext = (n: i64): i64 => {
  if (n < 0) {
    return -1
  }
  const left: i64 = QUIC_MAX_VARINT - n
  if (left < 1) {
    return -1
  }
  return QUIC_MAX_VARINT - (left - 1)
}

/**
 * One more than the ECN count `n`, or `n` once it is the largest a varint
 * carries, since an ACK_ECN frame could not write a larger one.
 */
const quicAckCountUp = (n: i64): i64 => {
  const next: i64 = quicAckNext(n)
  return next < 0 ? n : next
}

/**
 * The packet numbers received in one space. `ranges` holds `count` pairs
 * `[smallest, largest]`, highest first and never touching; `largest` is the
 * largest packet number received, or -1 before the first.
 */
export class QuicAckRanges {
  /** The largest packet number received, or -1. */
  largest: i64 = -1
  /** Every packet number at or below this is answered as already received; -1 until a range is dropped. */
  floor: i64 = -1
  private ranges: i64[]
  /** How many disjoint ranges are held, at most `QUIC_ACK_MAX_RANGES`. */
  count: i32 = 0
  /** Whether an ack-eliciting packet arrived since the last `pushAck`. */
  ackPending: boolean = false
  /** Packets of this space that arrived marked ECT(0) (codepoint 2). */
  ect0: i64 = 0
  /** Packets of this space that arrived marked ECT(1) (codepoint 1). */
  ect1: i64 = 0
  /** Packets of this space that arrived marked ECN-CE (codepoint 3). */
  ce: i64 = 0

  /**
   * Makes an empty set, nothing received yet, with room for
   * `QUIC_ACK_MAX_RANGES` ranges.
   */
  constructor() {
    // 64 slots, which a u16 length holds.
    this.ranges = new Array<i64>(toU16(QUIC_ACK_MAX_RANGES * 2))
  }

  /**
   * The smallest packet number of range `k`, which the caller keeps below `count`.
   *
   * @param k The range's index, 0 for the highest range.
   * @returns The range's smallest packet number, or -1 for an index outside the storage.
   */
  low(k: i32): i64 {
    // Below half the storage, `k * 2` cannot wrap.
    const half: i32 = toI32(this.ranges.length) >>> 1
    if (k < 0 || k >= half) {
      return -1
    }
    const at: i32 = k * 2
    if (at >= toI32(this.ranges.length)) {
      return -1
    }
    return this.ranges[at]
  }

  /**
   * The largest packet number of range `k`.
   *
   * @param k The range's index, 0 for the highest range; the caller keeps it below `count`.
   * @returns The range's largest packet number, or -1 for an index outside the storage.
   */
  high(k: i32): i64 {
    // Below half the storage, `k * 2 + 1` cannot wrap.
    const half: i32 = toI32(this.ranges.length) >>> 1
    if (k < 0 || k >= half) {
      return -1
    }
    const at: i32 = k * 2 + 1
    if (at >= toI32(this.ranges.length)) {
      return -1
    }
    return this.ranges[at]
  }

  /**
   * Sets range `k` to `[low, high]`. An index outside the storage changes nothing, and `count` is
   * not moved: the caller keeps the ranges ordered and disjoint.
   *
   * @param k The range's index, 0 for the highest range.
   * @param low The range's smallest packet number.
   * @param high The range's largest packet number, at least `low`.
   */
  set(k: i32, low: i64, high: i64): void {
    // Below half the storage, `k * 2 + 1` cannot wrap.
    const half: i32 = toI32(this.ranges.length) >>> 1
    if (k < 0 || k >= half) {
      return
    }
    const at: i32 = k * 2
    const next: i32 = at + 1
    if (at >= toI32(this.ranges.length) || next >= toI32(this.ranges.length)) {
      return
    }
    this.ranges[at] = low
    this.ranges[next] = high
  }

  /**
   * Whether `pn` was received, or is at or below the floor and so cannot be told apart from one that was.
   *
   * @param pn The full (decoded) packet number to look up.
   * @returns True when `pn` must be treated as already processed.
   */
  contains(pn: i64): boolean {
    if (pn <= this.floor) {
      return true
    }
    for (let k: i32 = 0; k < this.count; k += 1) {
      if (pn > this.high(k)) {
        return false
      }
      if (pn >= this.low(k)) {
        return true
      }
    }
    return false
  }

  /**
   * Records `pn` as received, `ackEliciting` saying whether its frames ask for
   * an acknowledgement. Answers `false`, changing nothing, for a packet number
   * already received (or at or below the floor), or one that is not a packet
   * number at all.
   *
   * @param pn The full (decoded) packet number, which must be in 0..2^62-1 to count.
   * @param ackEliciting Whether the packet held a frame other than ACK, PADDING or
   *   CONNECTION_CLOSE, so that it sets `ackPending`.
   * @returns True when `pn` was new and is now recorded; false for a duplicate or an out-of-range number.
   */
  record(pn: i64, ackEliciting: boolean): boolean {
    if (pn < 0 || pn > QUIC_MAX_VARINT || this.contains(pn)) {
      return false
    }
    if (pn > this.largest) {
      this.largest = pn
    }
    if (ackEliciting) {
      this.ackPending = true
    }
    // Find the first range whose largest is below `pn`: `pn` goes above it.
    let k: i32 = 0
    while (k < this.count && this.low(k) > pn) {
      k += 1
    }
    // One past `pn`, or -1 at `QUIC_MAX_VARINT`, which no range starts at.
    const joinsAbove: boolean = k > 0 && this.low(k - 1) === quicAckNext(pn)
    const joinsBelow: boolean = k < this.count && this.high(k) === pn - 1
    if (joinsAbove && joinsBelow) {
      // `pn` closes the hole between two ranges: merge them into the upper one.
      this.set(k - 1, this.low(k), this.high(k - 1))
      this.remove(k)
      return true
    }
    if (joinsAbove) {
      this.set(k - 1, pn, this.high(k - 1))
      return true
    }
    if (joinsBelow) {
      this.set(k, this.low(k), pn)
      return true
    }
    this.insert(k, pn)
    return true
  }

  /**
   * Counts one packet's ECN codepoint, the low two bits of the IP header's
   * traffic class, in this space (RFC 9000 §13.4.1). The caller counts a
   * packet once, after `record` accepted it; Not-ECT (0) counts nothing.
   *
   * @param codepoint The datagram's ECN bits: 0 Not-ECT, 1 ECT(1), 2 ECT(0), 3 CE; higher bits are ignored.
   */
  countEcn(codepoint: i32): void {
    const bits: i32 = codepoint & 3
    if (bits === 2) {
      this.ect0 = quicAckCountUp(this.ect0)
    } else if (bits === 1) {
      this.ect1 = quicAckCountUp(this.ect1)
    } else if (bits === 3) {
      this.ce = quicAckCountUp(this.ce)
    }
  }

  /**
   * Whether an ACK written now carries ECN counts.
   *
   * @returns True once any of `ect0`, `ect1` and `ce` is above zero.
   */
  hasEcn(): boolean {
    return this.ect0 > 0 || this.ect1 > 0 || this.ce > 0
  }

  /** Removes range `k`, moving the lower ones up; `k` is a held range, below `count`. */
  private remove(k: i32): void {
    const count: i32 = this.count
    if (count <= 0 || k < 0 || k >= count) {
      return
    }
    for (let j: i32 = k + 1; j < count; j += 1) {
      this.set(j - 1, this.low(j), this.high(j))
    }
    this.count = count - 1
  }

  /**
   * Inserts the one-number range `[pn, pn]` at position `k`. When every slot
   * is taken the lowest range is dropped first and the floor raised over it;
   * if `pn` itself would be that lowest range, it is the one dropped.
   */
  private insert(k: i32, pn: i64): void {
    let count: i32 = this.count
    if (count === QUIC_ACK_MAX_RANGES) {
      if (k === count) {
        this.floor = pn
        return
      }
      this.floor = this.high(QUIC_ACK_MAX_RANGES - 1)
      count = QUIC_ACK_MAX_RANGES - 1
    }
    // `k` is 0 or more, so `j > 0` adds nothing but keeps `j - 1` from wrapping.
    for (let j: i32 = count; j > 0 && j > k; j -= 1) {
      this.set(j, this.low(j - 1), this.high(j - 1))
    }
    this.set(k, pn, pn)
    if (count < 0 || count >= QUIC_ACK_MAX_RANGES) {
      return
    }
    this.count = count + 1
  }

  /**
   * Appends an ACK frame for every range kept, with `ackDelay` (already
   * scaled by this endpoint's ACK delay exponent), and clears `ackPending`.
   * The frame is an ACK_ECN carrying the three counts once `hasEcn` holds.
   * Answers `false`, appending nothing, when nothing has been received.
   *
   * @param out The packet payload being built; the frame is appended to its end.
   * @param ackDelay The ACK Delay field's value: the time since the largest packet arrived, in
   *   microseconds divided by 2^ack_delay_exponent.
   * @returns True when the frame was appended; false, leaving `out` and `ackPending` alone, otherwise.
   */
  pushAck(out: u8[], ackDelay: i64): boolean {
    if (this.count === 0) {
      return false
    }
    const pushed: boolean = this.hasEcn()
      ? quicPushAckEcn(out, this.ranges, this.count, ackDelay, this.ect0, this.ect1, this.ce)
      : quicPushAck(out, this.ranges, this.count, ackDelay)
    if (!pushed) {
      return false
    }
    this.ackPending = false
    return true
  }

  /**
   * Writes the ACK frame `pushAck` appends into `buf` at `at`, before `end`,
   * and clears `ackPending`. Answers the offset past it, or -1, writing
   * nothing and leaving `ackPending` as it was, when nothing has been
   * received or the frame does not fit.
   *
   * @param buf The packet buffer to write into.
   * @param at The byte offset in `buf` where the frame starts.
   * @param end The byte offset the frame must end at or before.
   * @param ackDelay The ACK Delay field's value: the time since the largest packet arrived, in
   *   microseconds divided by 2^ack_delay_exponent.
   * @returns The byte offset one past the frame, or -1 when nothing was written.
   */
  putAck(buf: u8[], at: i32, end: i32, ackDelay: i64): i32 {
    if (this.count === 0) {
      return -1
    }
    const next: i32 = this.hasEcn()
      ? quicPutAckEcn(buf, at, end, this.ranges, this.count, ackDelay, this.ect0, this.ect1, this.ce)
      : quicPutAck(buf, at, end, this.ranges, this.count, ackDelay)
    if (next >= 0) {
      this.ackPending = false
    }
    return next
  }

  /** Forgets every packet number and ECN count, for a connection slot reused for another peer. */
  clear(): void {
    this.largest = -1
    this.floor = -1
    this.count = 0
    this.ackPending = false
    this.ect0 = 0
    this.ect1 = 0
    this.ce = 0
  }
}
