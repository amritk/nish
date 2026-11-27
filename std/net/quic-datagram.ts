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

/** `n` zeroed bytes, allocated at once when `n` fits a u16 and grown otherwise. */
const quicDatagramBytes = (n: i32): u8[] => {
  if (n >= 0 && n <= 65535) {
    return new Array<u8>(toU16(n))
  }
  const out: u8[] = []
  for (let k: i32 = 0; k < n; k += 1) {
    out.push(0)
  }
  return out
}

/** `n` zeroed lengths, allocated at once when `n` fits a u16 and grown otherwise. */
const quicDatagramLengths = (n: i32): i32[] => {
  if (n >= 0 && n <= 65535) {
    return new Array<i32>(toU16(n))
  }
  const out: i32[] = []
  for (let k: i32 = 0; k < n; k += 1) {
    out.push(0)
  }
  return out
}

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
   * payload and a 4-byte length per entry. A negative size, or a product past 2^31 - 1 bytes, makes a
   * ring of no entries, which refuses every `push`.
   *
   * @param entries How many datagrams the ring holds at most before `push` refuses the next.
   * @param entrySize The largest payload, in bytes, an entry holds; a longer one is dropped, not split.
   */
  constructor(entries: i32, entrySize: i32) {
    // Two i32s, so the product fits an i64.
    const bytes: i64 = toI64(entries) * toI64(entrySize)
    const fits: boolean = entries >= 0 && entrySize >= 0 && bytes <= 2147483647
    // `bytes` is at most 2^31 - 1 when it fits.
    this.data = quicDatagramBytes(fits ? toI32(bytes) : 0)
    this.lengths = quicDatagramLengths(fits ? entries : 0)
    this.entrySize = entrySize
  }

  /**
   * Where entry `k`'s bytes start in `data`. Every entry lies inside `data`, whose length is an
   * i32, so for an entry the offset fits; any other `k` gives an offset `quicPacketCopy` refuses.
   */
  private offset(k: i32): i32 {
    const at: i64 = toI64(k) * toI64(this.entrySize)
    // Past 2^31 - 1 it is no entry's, and -1 is an offset every copy refuses.
    return at < 0 || at > 2147483647 ? -1 : toI32(at)
  }

  /**
   * The entry `j` places after `head`, wrapped around the ring; 0 for a ring of no entries or a
   * negative head or `j`. Summed in i64, where two i32 values cannot overflow.
   */
  private slot(j: i32): i32 {
    const entries: i64 = toI64(this.lengths.length)
    const head: i32 = this.head
    if (entries <= 0 || head < 0 || j < 0) {
      return 0
    }
    return toI32((toI64(head) + toI64(j)) % entries)
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
    const entries: i32 = toI32(this.lengths.length)
    const count: i32 = this.count
    if (
      count >= entries ||
      length < 0 ||
      length > this.entrySize ||
      from < 0 ||
      from > toI32(buf.length) - length
    ) {
      this.countDropped()
      return false
    }
    const k: i32 = this.slot(count)
    quicPacketCopy(this.data, this.offset(k), buf, from, length)
    if (k >= 0 && k < entries) {
      this.lengths[k] = length
    }
    this.count = count + 1
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

  /**
   * Forgets the oldest datagram unsent and counts it in `dropped`, for one
   * that no packet can carry any more; an empty ring is left as it is.
   */
  dropOldest(): void {
    if (this.count > 0) {
      this.countDropped()
    }
    this.drop()
  }

  /** Counts one datagram in `dropped`, which stops at 2^31 - 1 rather than wrap. */
  private countDropped(): void {
    const dropped: i32 = this.dropped
    if (dropped < 2147483647) {
      this.dropped = dropped + 1
    }
  }

  /**
   * Moves the oldest datagram behind the newest, unsent and not counted as
   * dropped, so the ones queued after it go out first; for one too large
   * for now that a later packet may carry. A ring of one is left as it is.
   */
  deferOldest(): void {
    const entries: i32 = toI32(this.lengths.length)
    const count: i32 = this.count
    const head: i32 = this.head
    // `head` is an entry whenever `count` is 1 or more; the test says so for the bounds proof.
    if (count < 2 || head < 0 || head >= entries) {
      return
    }
    if (count < entries) {
      const k: i32 = this.slot(count)
      const length: i32 = this.lengths[head]
      quicPacketCopy(this.data, this.offset(k), this.data, this.offset(head), length)
      if (k >= 0 && k < entries) {
        this.lengths[k] = length
      }
    }
    this.head = this.slot(toI32(1))
  }

  /** Forgets the oldest datagram. */
  private drop(): void {
    const count: i32 = this.count
    if (count > 0) {
      this.head = this.slot(toI32(1))
      this.count = count - 1
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
    quicPacketCopy(buf, at, this.data, this.offset(this.head), length)
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
    const next: i32 = quicPutDatagram(buf, at, end, this.data, this.offset(this.head), length)
    if (next < 0) {
      return at
    }
    this.drop()
    return next
  }
}
