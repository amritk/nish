/**
 * `nish/net/quic-conn-ack` — the packet numbers one QUIC packet number space
 * has received, kept as ranges, which is what duplicate detection reads
 * (RFC 9000 §12.3) and what an ACK frame is written from (§13.2, §19.3).
 *
 *     import { QuicAckRanges } from "nish/net/quic-conn-ack";
 *
 *     const received = new QuicAckRanges();
 *     if (!received.record(packetNumber, ackEliciting)) { … a duplicate: drop it … }
 *     if (received.ackPending) { received.pushAck(payload, 0); }
 *
 * **Bounded.** At most `QUIC_ACK_MAX_RANGES` ranges are kept, highest first.
 * A new range past that drops the lowest, and everything at or below what it
 * covered becomes the `floor`: a packet number there is answered as already
 * seen, because this side can no longer tell, and RFC 9000 §12.3 says a
 * receiver must discard a packet it cannot be sure it has not processed. So a
 * peer that sends packet numbers full of holes costs a fixed amount of memory
 * and loses only very late packets.
 *
 * **When to acknowledge** is the connection's choice; this module records
 * whether something ack-eliciting arrived since the last ACK it wrote
 * (`ackPending`). ACK frames carry an ACK Delay the caller supplies, and no
 * ECN counts.
 *
 * Written from RFC 9000 §12.3, §13.2 and §19.3, not ported from another
 * implementation. Private names carry the `quicAck` prefix
 * (`docs/wp26-stdlib.md` §3e).
 */
import { QUIC_MAX_VARINT } from "nish/net/quic-packet"
import { quicPushAck } from "nish/net/quic-frame"

/** The most disjoint ranges a `QuicAckRanges` keeps, and so the most an ACK frame it writes lists. */
export const QUIC_ACK_MAX_RANGES: i32 = 32

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
  ranges: i64[]
  count: i32 = 0
  /** Whether an ack-eliciting packet arrived since the last `pushAck`. */
  ackPending: boolean = false

  constructor() {
    this.ranges = new Array<i64>(QUIC_ACK_MAX_RANGES * 2)
  }

  /** The smallest packet number of range `k`, which the caller keeps below `count`. */
  low(k: i32): i64 {
    const at: i32 = k * 2
    if (at < 0 || at >= toI32(this.ranges.length)) {
      return -1
    }
    return this.ranges[at]
  }

  /** The largest packet number of range `k`. */
  high(k: i32): i64 {
    const at: i32 = k * 2 + 1
    if (at < 0 || at >= toI32(this.ranges.length)) {
      return -1
    }
    return this.ranges[at]
  }

  /** Sets range `k` to `[low, high]`. */
  set(k: i32, low: i64, high: i64): void {
    const at: i32 = k * 2
    const next: i32 = at + 1
    if (at < 0 || at >= toI32(this.ranges.length) || next < 0 || next >= toI32(this.ranges.length)) {
      return
    }
    this.ranges[at] = low
    this.ranges[next] = high
  }

  /** Whether `pn` was received, or is at or below the floor and so cannot be told apart from one that was. */
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
    const joinsAbove: boolean = k > 0 && this.low(k - 1) === pn + 1
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

  /** Removes range `k`, moving the lower ones up. */
  remove(k: i32): void {
    for (let j: i32 = k; j + 1 < this.count; j += 1) {
      this.set(j, this.low(j + 1), this.high(j + 1))
    }
    this.count = this.count - 1
  }

  /**
   * Inserts the one-number range `[pn, pn]` at position `k`. When every slot
   * is taken the lowest range is dropped first and the floor raised over it;
   * if `pn` itself would be that lowest range, it is the one dropped.
   */
  insert(k: i32, pn: i64): void {
    if (this.count === QUIC_ACK_MAX_RANGES) {
      if (k === this.count) {
        this.floor = pn
        return
      }
      this.floor = this.high(this.count - 1)
      this.count = this.count - 1
    }
    for (let j: i32 = this.count; j > k; j -= 1) {
      this.set(j, this.low(j - 1), this.high(j - 1))
    }
    this.set(k, pn, pn)
    this.count = this.count + 1
  }

  /**
   * Appends an ACK frame for every range kept, with `ackDelay` (already
   * scaled by this endpoint's ACK delay exponent), and clears `ackPending`.
   * Answers `false`, appending nothing, when nothing has been received.
   */
  pushAck(out: u8[], ackDelay: i64): boolean {
    if (this.count === 0 || !quicPushAck(out, this.ranges, this.count, ackDelay)) {
      return false
    }
    this.ackPending = false
    return true
  }
}
