/**
 * `nish/net/quic-datagram` — a fixed ring of QUIC DATAGRAM payloads (RFC
 * 9221), one each way per connection: what the application queued to send,
 * waiting for room in a packet and in the congestion window, and what the
 * peer sent, waiting for the application to read it. Sans-IO, like the rest
 * of `nish/net`; `nish/net/quic`'s `QuicConnection` owns both rings and the
 * application reaches them through its `sendDatagram` and `readDatagram`.
 *
 *     import { QuicDatagramQueue } from "nish/net/quic-datagram";
 *
 *     const outgoing: QuicDatagramQueue = new QuicDatagramQueue(16, 1200);  // 16 payloads, each 1200 bytes at most
 *     if (!outgoing.push(message, 0, toI32(message.length))) { … full or too big: dropped … }
 *     at = outgoing.putFrame(packet, at, packetEnd);                         // `at` again when nothing fit
 *
 *     const incoming: QuicDatagramQueue = new QuicDatagramQueue(16, 1200);
 *     const length: i32 = incoming.pop(into, 0, toI32(into.length));         // -1 empty, -2 `into` too small
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
  /** Each entry's payload length in bytes, 0 to `entrySize`; entry `k`'s is `lengths[k]`. */
  lengths: i32[]
  /**
   * The largest payload an entry holds, in bytes, fixed when the ring is made; it is also the
   * stride of `data`. A longer datagram is refused and counted in `dropped`.
   */
  entrySize: i32 = 0
  /** The index of the oldest entry; the `j`-th oldest is entry `(head + j) % capacity()`. */
  head: i32 = 0
  /** How many datagrams wait in the ring, from 0 to its entry count. */
  count: i32 = 0
  /** Datagrams refused for want of room or for their size, which the peer's side counts as dropped. */
  dropped: i32 = 0

  /**
   * Makes an empty ring, allocating all of its storage now: `entries * entrySize` bytes of
   * payload and a 4-byte length per entry.
   *
   * @param entries How many datagrams the ring holds at most before `push` refuses the next.
   * @param entrySize The largest payload, in bytes, an entry holds; a longer one is dropped, not split.
   */
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

  /**
   * How many datagrams the ring holds at most.
   *
   * @returns The `entries` the ring was made with, however many it holds now (that is `count`).
   */
  capacity(): i32 {
    return toI32(this.lengths.length)
  }

  /**
   * Copies `buf[from .. from + length)` in as the newest datagram. Answers
   * whether it could: not when the ring is full, nor for a payload past
   * `entrySize` or a window outside `buf`, each of which counts in `dropped`.
   *
   * @param buf The bytes to take the payload from; copied, not kept.
   * @param from The offset in `buf` of the payload's first byte.
   * @param length The payload's size in bytes, 0 to `entrySize`.
   * @returns True when the datagram was queued; false when it was dropped instead.
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

  /**
   * The oldest datagram's length, or -1 when the ring is empty.
   *
   * @returns The size in bytes of the datagram `pop` or `putFrame` would take next, or -1 when there is none.
   */
  peekLength(): i32 {
    const k: i32 = this.head
    return this.count > 0 && k >= 0 && k < toI32(this.lengths.length) ? this.lengths[k] : -1
  }

  /** Forgets the oldest datagram. */
  private drop(): void {
    if (this.count > 0) {
      this.head = (this.head + 1) % this.capacity()
      this.count = this.count - 1
    }
  }

  /**
   * Copies the oldest datagram into `buf` at `at` and forgets it. Answers
   * its length, -1 when the ring is empty, or -2, keeping it, when it does
   * not fit in `cap` bytes from `at` inside `buf`.
   *
   * @param buf The buffer to copy the payload into.
   * @param at The offset in `buf` to copy it to.
   * @param cap How many bytes from `at` the caller lets the payload take.
   * @returns The payload's size in bytes, -1 when the ring is empty, or -2 when it does not fit in `cap` or
   *   `at` puts it outside `buf`, in which case it stays queued for a bigger buffer or a good window.
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
   *
   * @param buf The packet payload being built.
   * @param at The offset to write the frame at.
   * @param end One past the last byte the frame may use, the packet's room or the congestion window's.
   * @returns The offset past the DATAGRAM frame, or `at` itself when nothing was written.
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
