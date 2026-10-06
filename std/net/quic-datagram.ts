/**
 * `nish/net/quic-datagram` — a fixed ring of QUIC DATAGRAM payloads (RFC
 * 9221), one each way per connection: what the application queued to send,
 * waiting for room in a packet and in the congestion window, and what the
 * peer sent, waiting for the application to read it. Sans-IO, like the rest
 * of `nish/net`; `nish/net/quic`'s `QuicConnection` owns both rings and the
 * application reaches them through its `sendDatagram` and `readDatagram`.
 *
 * **Fixed.** A ring is `entries` payloads of at most `entrySize` bytes,
 * allocated once; a payload is copied in and out, and nothing allocates
 * after the ring is made. A datagram is unreliable by definition (RFC 9221
 * §5), so a full ring refuses the next rather than growing, and what the
 * peer sends past a full receive ring, or past `entrySize`, is dropped and
 * counted in `dropped`.
 *
 * Written from RFC 9221, in this module's own structure; nothing here is
 * ported from another implementation. Private names carry the
 * `quicDatagram` prefix (`docs/wp26-stdlib.md` §3e).
 */
import { quicPutDatagram } from "nish/net/quic-frame"
import { quicPacketCopy } from "nish/net/quic-packet"

/** A ring of `entries` datagram payloads of at most `entrySize` bytes each, oldest first. */
export class QuicDatagramQueue {
  /** Entry `k`'s bytes are `data[k * entrySize ..]`, `lengths[k]` of them. */
  data: u8[]
  lengths: i32[]
  entrySize: i32 = 0
  head: i32 = 0
  count: i32 = 0
  /** Datagrams refused for want of room or for their size, which the peer's side counts as dropped. */
  dropped: i32 = 0

  constructor(entries: i32, entrySize: i32) {
    this.data = new Array<u8>(entries * entrySize)
    this.lengths = new Array<i32>(entries)
    this.entrySize = entrySize
  }

  /** Empties the ring, for a connection slot reused for another peer. */
  reset(): void {
    this.head = 0
    this.count = 0
    this.dropped = 0
  }

  /** How many datagrams the ring holds at most. */
  capacity(): i32 {
    return toI32(this.lengths.length)
  }

  /**
   * Copies `buf[from .. from + length)` in as the newest datagram. Answers
   * whether it could: not when the ring is full, nor for a payload past
   * `entrySize` or a window outside `buf`, each of which counts in `dropped`.
   */
  push(buf: u8[], from: i32, length: i32): boolean {
    const entries: i32 = this.capacity()
    if (
      this.count >= entries ||
      length < 0 ||
      length > this.entrySize ||
      from < 0 ||
      from > toI32(buf.length) - length
    ) {
      if (this.dropped < 2147483647) {
        this.dropped = this.dropped + 1
      }
      return false
    }
    const k: i32 = (this.head + this.count) % entries
    const base: i32 = k * this.entrySize
    quicPacketCopy(this.data, base, buf, from, length)
    if (k >= 0 && k < entries) {
      this.lengths[k] = length
    }
    this.count = this.count + 1
    return true
  }

  /** The oldest datagram's length, or -1 when the ring is empty. */
  peekLength(): i32 {
    const k: i32 = this.head
    return this.count > 0 && k >= 0 && k < toI32(this.lengths.length) ? this.lengths[k] : -1
  }

  /** Forgets the oldest datagram. */
  drop(): void {
    if (this.count > 0) {
      this.head = (this.head + 1) % this.capacity()
      this.count = this.count - 1
    }
  }

  /**
   * Copies the oldest datagram into `buf` at `at` and forgets it. Answers
   * its length, -1 when the ring is empty, or -2, keeping it, when it does
   * not fit in `cap` bytes from `at` inside `buf`.
   */
  pop(buf: u8[], at: i32, cap: i32): i32 {
    const length: i32 = this.peekLength()
    if (length < 0) {
      return -1
    }
    if (at < 0 || cap < length || at > toI32(buf.length) - length) {
      return -2
    }
    quicPacketCopy(buf, at, this.data, this.head * this.entrySize, length)
    this.drop()
    return length
  }

  /**
   * Writes the oldest datagram as a DATAGRAM frame into `buf[at .. end)` and
   * forgets it. Answers the offset past the frame, or `at` when the ring is
   * empty or the frame does not fit, keeping it for the next packet.
   */
  putFrame(buf: u8[], at: i32, end: i32): i32 {
    const length: i32 = this.peekLength()
    if (length < 0) {
      return at
    }
    const next: i32 = quicPutDatagram(buf, at, end, this.data, this.head * this.entrySize, length)
    if (next < 0) {
      return at
    }
    this.drop()
    return next
  }
}
