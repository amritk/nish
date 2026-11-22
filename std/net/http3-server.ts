/**
 * `nish/net/http3-server` — HTTP/3 over QUIC on one UDP socket: a pool of
 * slots, each a reusable `QuicConnection` with an `Http3Connection` beside
 * it, a `QuicListener` in front for the datagrams no slot owns, for a
 * program that owns its readiness loop.
 *
 *     import { pollAdd, pollCreate, pollWait, udpBind } from "nish:net";
 *     import { monotonicNanos } from "nish:process";
 *     import { secret, wipe } from "nish:secret";
 *     import { H3_ERROR, H3_NEED_MORE, Http3Config, Http3Connection } from "nish/net/http3";
 *     import { Http3Server } from "nish/net/http3-server";
 *     import { QuicServerConfig } from "nish/net/quic";
 *     import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
 *
 *     // `quicConfig.alpn` is ["h3"]; `privateKey` is the P-256 key of its certificate.
 *     const run = (quicConfig: QuicServerConfig, privateKey: u8[], rounds: i32): void => {
 *       const fd: i32 = udpBind("0.0.0.0", 4433, 0);
 *       const listenerEntropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
 *       crypto.getRandomValues(listenerEntropy);
 *       const server = new Http3Server(quicConfig, new Http3Config(), fd, 64, listenerEntropy);
 *       const loop: i32 = pollCreate();
 *       pollAdd(loop, fd, 1, 0);
 *       const ready: i32[] = new Array<i32>(8);
 *       const key = secret(privateKey);
 *       for (let round: i32 = 0; round < rounds; round++) {
 *         pollWait(loop, ready, server.timeout(monotonicNanos() / 1000000));
 *         const nanos: i64 = monotonicNanos();
 *         const now: i64 = nanos / 1000000;        // milliseconds
 *         server.clock(nanos / 1000);              // the same instant in microseconds, for the pacer
 *         server.receive(now, key);                // every datagram waiting; signs handshakes with `key`
 *         server.tick(now);                        // the connections' timers
 *         let slot: i32 = server.ready();
 *         while (slot >= 0) {
 *           const h3: Http3Connection = server.connection(slot);
 *           let event: i32 = h3.next();
 *           while (event !== H3_NEED_MORE && event !== H3_ERROR) {
 *             // answer the event here: `h3.stream`, `h3.fields`, `h3.respond`, ...
 *             event = h3.next();
 *           }
 *           slot = server.ready();
 *         }
 *         server.flush(now);                       // what every touched slot has to send
 *       }
 *       wipe(key);
 *       server.stop();                             // releases every slot, wipes the static keys
 *     };
 *
 * **Routing.** A datagram goes to the slot that owns its first packet's
 * Destination Connection ID, found through a hash index of every slot's
 * connection IDs — its active local IDs, and the client's original DCID until
 * the handshake is done — never by asking each slot. The index is keyed with
 * bytes from the listener's entropy, so a client choosing its original DCIDs
 * cannot pick ones that collide. A datagram no slot owns goes to the listener,
 * which answers Version Negotiation, Retry or a stateless reset, or accepts a
 * new connection into a free slot. With no slot free, the datagram is dropped
 * and counted, and the client's own timers retry.
 *
 * **ALPN.** The QUIC configuration's ALPN list is what the TLS handshake
 * offers; a connection whose handshake chose anything but `h3` is closed by
 * its `Http3Connection`, before a byte of HTTP/3, with CRYPTO_ERROR
 * no_application_protocol (0x0178; RFC 9114 §3.1).
 *
 * **Sending.** `flush` writes each touched slot's datagrams with
 * `quicListenerTakeFlight`, a paced flight at a time in one `udpSendTo` with
 * GSO where the platform has it and one datagram at a time where it does not.
 * Each flight goes with the ECN codepoint its connection marked it with
 * (`QuicFlight.ecn`, RFC 9000 §13.4), so the peer's ACK_ECN counts are
 * validated and a CE mark shrinks the window. Where the platform sends no ECN
 * (Darwin, whose `udpSendTo` answers -95 to a marked send), the first marked
 * send goes again unmarked and no slot marks after it.
 *
 *  A -95 is also what a platform without segmentation offload answers, so a
 *  refused GSO send goes again one datagram at a time, still marked, and only a
 *  -95 to one of those turns marking off. The pacer counts the microseconds
 *  `clock` gives it, so on a path whose round trip is under a millisecond it
 *  neither waits for the next millisecond to earn credit nor holds a slot back
 *  for a whole one; without `clock` it counts whole milliseconds. A slot whose
 *  HTTP/3 side sent GOAWAY and whose requests have all finished, every byte
 *  acknowledged, is closed with H3_NO_ERROR; a closed slot is freed once its
 *  CONNECTION_CLOSE is out.
 *
 * **Timers** are a wheel of `H3_SERVER_WHEEL` one-millisecond buckets, a
 * slot in at most one: after every datagram and every flush the slot is filed
 * under its next deadline (its idle, loss and probe timers, and its pacer),
 * and `tick` runs the buckets that are due. `timeout` finds the next filled
 * bucket from a bitmap. A deadline past the wheel's horizon is filed at the
 * horizon and filed again when it comes round. So no call scans the slots.
 *
 *  The HTTP/3 side's clock (`Http3Connection.clock`, H3-5) runs on every
 *  flush and files its deadline with the rest: a slot that goes
 *  `idleTimeout` without progress while no request is in hand is closed with
 *  H3_NO_ERROR, and one whose request head has waited `headTimeout` (a
 *  client trickling its HEADERS, the slowloris of HTTP/3) with
 *  H3_EXCESSIVE_LOAD, as the program writes no timer of its own. A client
 *  that only acknowledges or sends PING keeps its QUIC connection alive but
 *  not its slot. The clock times a slot from the first `next` that finds the
 *  handshake chose `h3`, whether or not the client has let this side's
 *  streams open; a slot the program runs another protocol on, such as
 *  `hq-interop`, is left to QUIC's idle timeout.
 *
 * **Caps, fixed at start-up**: the slots, and inside each the QUIC
 * configuration's streams and buffers and the `Http3Config`'s field section,
 * body chunk, DATA frame and two timeouts.
 *
 *  A slot's connections and address are built on the first Initial accepted into
 *  it and kept, so a pool sized for its peak costs at start-up only its per-slot
 *  tables (the index, the wheel, the queues), and holds at most `size`
 *  connections once the peak has come; a datagram an established connection
 *  reads, and every datagram it sends, allocates nothing; nor does a datagram no
 *  slot owns, which the listener reads where it lies and answers into scratch
 *  made once, nor a handshake into a slot built before, whose state is the
 *  slot's — `docs/security/http3.md` (H3-1, H3-3).
 *
 * **The Date.** Every response carries one `date` field (RFC 9110 §6.6.1)
 * from the pool's `HttpDate`, which formats the IMF-fixdate at most once a
 * second for every slot; trailers carry none, and a program that sends its
 * own `date` sends that one instead. `server.date.pin(unixMs)` fixes it, for
 * a test that compares bytes.
 *
 * Written from RFC 9114 §3 and RFC 9000 §5.2, not ported from another
 * implementation. Private names carry the `http3Server` prefix
 * (`docs/wp26-stdlib.md` §3e).
 */
import { udpRecvFrom, udpSendTo } from "nish:net"
import { Secret } from "nish:secret"
import { BufferPool } from "nish/net/buffer-pool"
import { HttpDate } from "nish/net/http1-server"
import { Http3Config, Http3Connection } from "nish/net/http3"
import { H3_NO_ERROR, h3Count } from "nish/net/http3-frame"
import {
  QUIC_CONN_CID_LENGTH,
  QUIC_CONN_DATAGRAM_SIZE,
  QUIC_CONN_ENTROPY_SIZE,
  QUIC_CONN_LOCAL_CIDS,
  QUIC_CONN_MAX_STREAM_DATA,
  QuicConnection,
  QuicServerConfig,
} from "nish/net/quic"
import { QUIC_MAX_CID_LENGTH } from "nish/net/quic-packet"
import { QuicStreamPools, quicStreamGrowFree } from "nish/net/quic-stream"
import {
  QUIC_LISTEN_ACCEPT,
  QUIC_LISTENER_ANSWER_SIZE,
  QUIC_LISTENER_FLIGHT_MAX,
  QUIC_LISTENER_MIN_RESET,
  QuicFlight,
  QuicListener,
  QuicListenerAnswer,
  quicListenerFlightTime,
  quicListenerTakeFlight,
} from "nish/net/quic-listener"
import { TlsP256Signer } from "nish/net/tls"

/** The timer wheel's buckets, one millisecond each: its horizon. */
export const H3_SERVER_WHEEL: i32 = 2048

/** The most datagrams one `receive` reads, so one busy socket cannot hold the loop. */
export const H3_SERVER_RECEIVE_BURST: i32 = 256

/**
 * The answer budget's size: how many datagrams no slot owns that could get a stateless reset or a Version
 * Negotiation packet may reach the listener at once.
 */
export const H3_SERVER_ANSWER_BURST: i32 = 16
/** The milliseconds that earn the answer budget one more, up to `H3_SERVER_ANSWER_BURST`. */
export const H3_SERVER_ANSWER_INTERVAL: i64 = 100

/** The address form `nish:net` reads and writes. */
const H3_SERVER_ADDRESS: i32 = 18

/** What `udpSendTo` answers where the platform has no segmentation offload, or sends no ECN. */
const H3_SERVER_UNSUPPORTED: i32 = -95

/** The largest datagram read: a GRO receive of up to 64 KB. */
const H3_SERVER_RECEIVE_SIZE: i32 = 65536

/** The bytes of the largest flight `flush` writes at once: `QUIC_LISTENER_FLIGHT_MAX` datagrams. */
const H3_SERVER_FLIGHT_BYTES: i32 = QUIC_LISTENER_FLIGHT_MAX * QUIC_CONN_DATAGRAM_SIZE

/** Index entries per slot: its local connection IDs, then the client's original DCID. */
const H3_SERVER_KEYS: i32 = QUIC_CONN_LOCAL_CIDS + 1

/** The ID bytes an index keeps per slot: its entries, `QUIC_MAX_CID_LENGTH` bytes each. */
const H3_SERVER_SLOT_KEY_BYTES: i32 = H3_SERVER_KEYS * QUIC_MAX_CID_LENGTH

/** The most slots an index files: past it, one slot's ID bytes would end beyond an `i32` offset. */
const H3_SERVER_SLOT_LIMIT: i32 = 21474836

/** The index's largest table, in places: 2^30, more than twice `H3_SERVER_SLOT_LIMIT`'s entries. */
const H3_SERVER_TABLE_LIMIT: i32 = 1073741824

/** Typed constants, since a bare literal is an `f64` under `--number-mode f64`. */
const H3_SERVER_ZERO: i32 = 0
const H3_SERVER_NONE: i64 = -1

/** The index hash's masks, which keep its shifts from overflowing. */
const H3_SERVER_MASK_LOW: i64 = 0x3fffffffffff
const H3_SERVER_MASK: i64 = 0x7fffffffffff

/** A slot's states. */
const H3_SERVER_FREE: i32 = 0
const H3_SERVER_BUSY: i32 = 1

/**
 * The bucket of `time` on the wheel: 2048 is `H3_SERVER_WHEEL`, written out
 * so the divisor is a literal. Negative for a negative time not a multiple of it.
 */
const http3ServerBucket = (time: i64): i32 => toI32(time % toI64(2048))

/** The words of the wheel's bitmap: `H3_SERVER_WHEEL / 64`. */
const H3_SERVER_WHEEL_WORDS: i32 = 32

/**
 * `count` copies of `value`, built by `push`, so a negative `count` gives an
 * empty array and no length is unchecked.
 */
const http3ServerFilled = (count: i32, value: i32): i32[] => {
  const out: i32[] = []
  let i: i32 = 0
  while (i < count) {
    out.push(value)
    i = i + 1
  }
  return out
}

/** `count` zero times, built as `http3ServerFilled` builds. */
const http3ServerZeroTimes = (count: i32): i64[] => {
  const out: i64[] = []
  let i: i32 = 0
  while (i < count) {
    out.push(toI64(0))
    i = i + 1
  }
  return out
}

/**
 * Milliseconds from `now` to `from + offset`, 0 when that is at or before
 * `now`; a wait past the `i32` range keeps its low 32 bits, as `toI32` gives.
 * The sum is never formed, since it can pass the `i64` range.
 * @param from A millisecond; a negative one only with an `offset` of 0.
 * @param offset Milliseconds after `from`, 0 to 2047; one outside gives -1.
 * @param now The current millisecond.
 * @returns The wait, or -1 for an `offset` out of range.
 */
const http3ServerWait = (from: i64, offset: i32, now: i64): i32 => {
  if (offset < 0 || offset > 2047) {
    // Never taken: `next` passes an offset below `H3_SERVER_WHEEL`.
    return -1
  }
  let due: boolean = false
  if (from < 0) {
    due = from + toI64(offset) <= now
  } else if (now >= 0) {
    due = from - now <= toI64(0 - offset)
  }
  if (due) {
    return H3_SERVER_ZERO
  }
  // The low 32 bits of `from + offset - now`, from the low 32 bits of each.
  return toI32(toI64(toI32(from)) - toI64(toI32(now)) + toI64(offset))
}

/**
 * The connection IDs of every slot, by hash: an open-addressed table keyed
 * with `salt`, each ID copied into the entry it was filed as. Each slot has
 * `QUIC_CONN_LOCAL_CIDS + 1` entries, slot `s`'s from
 * `s * (QUIC_CONN_LOCAL_CIDS + 1)` up: its local connection IDs, then the
 * client's original DCID. The table has at least twice as many places as
 * entries, so it never fills.
 */
export class Http3CidIndex {
  private table: i32[]
  /** Entry `e`'s ID is `keys[e * 20 .. e * 20 + lengths[e])`; a length of 0 is no entry. */
  private keys: u8[]
  private lengths: i32[]
  /** The hash's key: eight bytes from the listener's entropy. */
  salt: u8[]

  /**
   * An empty index for `slots` slots.
   * @param slots How many slots it files IDs for, each `QUIC_CONN_LOCAL_CIDS + 1` entries; 0 or fewer
   *   files none.
   * @param salt The hash's key: its first eight bytes are copied (zeros past a shorter one); not kept.
   */
  constructor(slots: i32, salt: u8[]) {
    // Each table is built by push, one after another, so it grows at the
    // top of the arena; seeded with one slot's worth, its capacity is exact
    // at a power-of-two slot count.
    const lengths: i32[] = slots > 0 ? new Array<i32>(H3_SERVER_KEYS) : []
    for (let s: i32 = 1; s < slots && s < H3_SERVER_SLOT_LIMIT; s++) {
      for (let j: i32 = 0; j < H3_SERVER_KEYS; j++) {
        lengths.push(0)
      }
    }
    const keys: u8[] = slots > 0 ? new Array<u8>(H3_SERVER_SLOT_KEY_BYTES) : []
    for (let s: i32 = 1; s < slots && s < H3_SERVER_SLOT_LIMIT; s++) {
      for (let k: i32 = 0; k < H3_SERVER_SLOT_KEY_BYTES; k++) {
        keys.push(0)
      }
    }
    const entries: i32 = toI32(lengths.length)
    const table: i32[] = new Array<i32>(8)
    while (toI32(table.length) < H3_SERVER_TABLE_LIMIT && toI32(table.length) / 2 < entries) {
      const size: i32 = toI32(table.length)
      for (let h: i32 = 0; h < size; h++) {
        table.push(0)
      }
    }
    this.table = table
    this.keys = keys
    this.lengths = lengths
    this.salt = new Array<u8>(8)
    for (let k: i32 = 0; k < 8 && k < toI32(salt.length); k++) {
      this.salt[k] = salt[k]
    }
  }

  /** The bucket the ID `buf[at .. at + length)` starts its probe at. */
  private bucket(buf: u8[], at: i32, length: i32): i32 {
    const salt: u8[] = this.salt
    let h: i64 = toI64(length)
    // `i` is `at + k`, the byte read.
    let i: i32 = at
    for (let k: i32 = 0; k < length && i >= 0 && i < toI32(buf.length); k++) {
      const j: i32 = k & 7
      if (j >= toI32(salt.length)) {
        // Never taken: the constructor gives `salt` eight bytes.
        break
      }
      const mixed: i64 = toI64(toI32(buf[i]) ^ toI32(salt[j]))
      h = (((h << 7) & H3_SERVER_MASK_LOW) ^ (h >> 29) ^ mixed) & H3_SERVER_MASK
      i++
    }
    h = h ^ (h >> 17) ^ (h >> 31)
    return toI32(h & toI64(toI32(this.table.length) - 1))
  }

  /** Whether entry `e` holds the ID `buf[at .. at + length)`. */
  private holds(e: i32, buf: u8[], at: i32, length: i32): boolean {
    const keys: u8[] = this.keys
    const lengths: i32[] = this.lengths
    // 107374182 is `I32_MAX / QUIC_MAX_CID_LENGTH`, past `H3_SERVER_SLOT_LIMIT`'s entries.
    if (e < 0 || e >= 107374182 || e >= toI32(lengths.length) || lengths[e] !== length) {
      return false
    }
    // `p` and `i` are `e * QUIC_MAX_CID_LENGTH + k` and `at + k`, the bytes compared.
    let p: i32 = e * QUIC_MAX_CID_LENGTH
    let i: i32 = at
    for (let k: i32 = 0; k < length; k++) {
      if (i < 0 || i >= toI32(buf.length) || p < 0 || p >= toI32(keys.length) || keys[p] !== buf[i]) {
        return false
      }
      p++
      i++
    }
    return true
  }

  /**
   * The slot owning the ID `buf[at .. at + length)`.
   * @param buf The bytes holding the ID, read in place and not kept.
   * @param at Where the ID starts in `buf`.
   * @param length The ID's length in bytes.
   * @returns The slot whose entry holds exactly this ID, or -1 when none does (always for a length of 0).
   */
  find(buf: u8[], at: i32, length: i32): i32 {
    const size: i32 = toI32(this.table.length)
    let h: i32 = this.bucket(buf, at, length)
    for (let probe: i32 = 0; probe < size && h >= 0 && h < size; probe++) {
      const filed: i32 = this.table[h]
      if (filed <= 0) {
        return -1
      }
      const e: i32 = filed - 1
      if (this.holds(e, buf, at, length)) {
        return e / H3_SERVER_KEYS
      }
      h = (h + 1) & (size - 1)
    }
    return -1
  }

  /**
   * Files entry `e` as the ID `buf[at .. at + length)`; an ID already filed
   * under any entry is left there, and nothing is filed.
   * @param e The entry: slot `s`'s `j`th is `s * (QUIC_CONN_LOCAL_CIDS + 1) + j`. It must not be filed
   *   already (`remove` it first); one out of range files nothing.
   * @param buf The bytes holding the ID, copied into the entry.
   * @param at Where the ID starts in `buf`.
   * @param length The ID's length in bytes, 1 to `QUIC_MAX_CID_LENGTH`; any other files nothing.
   */
  insert(e: i32, buf: u8[], at: i32, length: i32): void {
    const keys: u8[] = this.keys
    const lengths: i32[] = this.lengths
    // 107374182 is `I32_MAX / QUIC_MAX_CID_LENGTH`, past `H3_SERVER_SLOT_LIMIT`'s entries.
    if (length <= 0 || length > QUIC_MAX_CID_LENGTH || e < 0 || e >= toI32(lengths.length) || e >= 107374182) {
      return
    }
    if (this.find(buf, at, length) >= 0) {
      return
    }
    // `p` and `i` are `e * QUIC_MAX_CID_LENGTH + k` and `at + k`, the bytes copied.
    let p: i32 = e * QUIC_MAX_CID_LENGTH
    let i: i32 = at
    for (let k: i32 = 0; k < length && i >= 0 && i < toI32(buf.length); k++) {
      if (p < 0 || p >= toI32(keys.length)) {
        // Never taken: each entry has `QUIC_MAX_CID_LENGTH` bytes of `keys`.
        return
      }
      keys[p] = buf[i]
      p++
      i++
    }
    lengths[e] = length
    const size: i32 = toI32(this.table.length)
    let h: i32 = this.bucket(buf, at, length)
    for (let probe: i32 = 0; probe < size && h >= 0 && h < size; probe++) {
      if (this.table[h] === 0) {
        this.table[h] = e + 1
        return
      }
      h = (h + 1) & (size - 1)
    }
  }

  /**
   * Takes entry `e` out, moving later entries of its probe run back so none is lost.
   * @param e The entry, numbered as `insert` numbers it; one out of range or not filed is ignored.
   */
  remove(e: i32): void {
    const lengths: i32[] = this.lengths
    // 107374182 is `I32_MAX / QUIC_MAX_CID_LENGTH`, past `H3_SERVER_SLOT_LIMIT`'s entries.
    if (e < 0 || e >= toI32(lengths.length) || e >= 107374182 || lengths[e] === 0) {
      return
    }
    const size: i32 = toI32(this.table.length)
    const mask: i32 = size - 1
    let h: i32 = this.bucket(this.keys, e * QUIC_MAX_CID_LENGTH, lengths[e])
    let hole: i32 = -1
    for (let probe: i32 = 0; probe < size && h >= 0 && h < size; probe++) {
      if (this.table[h] === 0) {
        break
      }
      if (this.table[h] === e + 1) {
        hole = h
        break
      }
      h = (h + 1) & mask
    }
    lengths[e] = 0
    // `hole` is -1 or a place the probe found, below `size`.
    if (hole < 0 || hole >= size) {
      return
    }
    let next: i32 = (hole + 1) & mask
    for (let probe: i32 = 0; probe < size && next >= 0 && next < size && hole >= 0 && hole < size; probe++) {
      const filed: i32 = this.table[next]
      if (filed <= 0) {
        break
      }
      const other: i32 = filed - 1
      if (other >= toI32(lengths.length) || other >= 107374182) {
        // Never taken: only `insert` files an entry, and only one it numbers.
        break
      }
      const home: i32 = this.bucket(this.keys, other * QUIC_MAX_CID_LENGTH, lengths[other])
      if (home < 0 || home >= size) {
        // Never taken: `bucket` answers a place of the table.
        break
      }
      // The entry may move into the hole when its home is not between the hole and it.
      if (((hole - home) & mask) < ((next - home) & mask)) {
        this.table[hole] = this.table[next]
        hole = next
      }
      next = (next + 1) & mask
    }
    if (hole >= 0 && hole < size) {
      this.table[hole] = 0
    }
  }
}

/**
 * Slots filed by the millisecond of their next deadline: `H3_SERVER_WHEEL`
 * buckets, each a linked list of its slots, and a bitmap of the buckets that
 * hold any, so `next` passes 64 empty buckets at a time. A slot is filed in
 * at most one bucket.
 */
export class Http3Wheel {
  private head: i32[]
  private nextOf: i32[]
  private prevOf: i32[]
  /** The bucket a slot is filed in, or -1. */
  private bucketOf: i32[]
  /** Per slot, the deadline in milliseconds `file` last filed it for, before any clamp to the horizon. */
  dueAt: i64[]
  private bits: i64[]
  /** Every bucket before this time has been run. */
  cursor: i64 = -1

  /**
   * An empty wheel whose cursor is not started.
   * @param slots How many slots it files, 0 to `slots - 1`; 0 or fewer files none.
   */
  constructor(slots: i32) {
    this.head = new Array<i32>(H3_SERVER_WHEEL)
    this.nextOf = http3ServerFilled(slots, H3_SERVER_ZERO)
    this.prevOf = http3ServerFilled(slots, H3_SERVER_ZERO)
    this.bucketOf = http3ServerFilled(slots, -1)
    this.dueAt = http3ServerZeroTimes(slots)
    this.bits = new Array<i64>(H3_SERVER_WHEEL_WORDS)
  }

  /** Marks bucket `b` filled or not. */
  private flag(b: i32, on: boolean): void {
    const word: i32 = b >> 6
    if (word < 0 || word >= toI32(this.bits.length)) {
      return
    }
    const bit: i64 = toI64(1) << toI64(b & 63)
    this.bits[word] = on ? this.bits[word] | bit : this.bits[word] & ~bit
  }

  /**
   * Takes `slot` out of its bucket.
   * @param slot The slot; one out of range or not filed is ignored.
   */
  unfile(slot: i32): void {
    const head = this.head
    const nextOf = this.nextOf
    const prevOf = this.prevOf
    const bucketOf = this.bucketOf
    if (slot < 0 || slot >= toI32(bucketOf.length) || slot >= toI32(nextOf.length) || slot >= toI32(prevOf.length)) {
      // Past the first two, never taken: the constructor gives each per-slot array `slots` entries.
      return
    }
    const b: i32 = bucketOf[slot]
    if (b < 0 || b >= toI32(head.length)) {
      return
    }
    const prev: i32 = prevOf[slot]
    const next: i32 = nextOf[slot]
    if (next >= toI32(prevOf.length)) {
      // Never taken: `file` links a slot only to a slot or -1.
      return
    }
    if (prev >= 0 && prev < toI32(nextOf.length)) {
      nextOf[prev] = next
    } else {
      head[b] = next + 1
    }
    if (next >= 0) {
      prevOf[next] = prev
    }
    if (head[b] === 0) {
      this.flag(b, false)
    }
    bucketOf[slot] = -1
  }

  /**
   * Files `slot` under `due`, taking it out of any bucket it was in first. A
   * `due` before the cursor is filed at the cursor, one past the horizon
   * (`H3_SERVER_WHEEL - 1` milliseconds after the cursor) at the horizon.
   * @param slot The slot; one out of range files nothing.
   * @param due The deadline in milliseconds, on `now`'s clock; a negative one leaves the slot unfiled.
   * @param now The current millisecond: it starts the cursor when no file or tick has yet.
   */
  file(slot: i32, due: i64, now: i64): void {
    this.unfile(slot)
    const head = this.head
    const nextOf = this.nextOf
    const prevOf = this.prevOf
    const bucketOf = this.bucketOf
    const dueAt = this.dueAt
    if (
      due < 0 ||
      slot < 0 ||
      slot >= toI32(bucketOf.length) ||
      slot >= toI32(nextOf.length) ||
      slot >= toI32(prevOf.length) ||
      slot >= toI32(dueAt.length)
    ) {
      // Past the first three, never taken: the constructor gives each per-slot array `slots` entries.
      return
    }
    if (this.cursor < 0) {
      this.cursor = now
    }
    const cursor: i64 = this.cursor
    let b: i32 = -1
    if (cursor < 0) {
      // A cursor before the clock's zero: its horizon is below 2047, so the sum cannot overflow.
      const horizon: i64 = cursor + toI64(2047)
      b = http3ServerBucket(due > horizon ? horizon : due)
    } else if (due - cursor > 2047) {
      // Past the horizon, `cursor + 2047`, whose bucket is the one before the
      // cursor's; found from that bucket, since the sum can overflow.
      const at: i32 = http3ServerBucket(cursor)
      b = at > 0 ? at - 1 : 2047
    } else {
      b = http3ServerBucket(due < cursor ? cursor : due)
    }
    if (b < 0 || b >= toI32(head.length)) {
      return
    }
    const filed: i32 = head[b]
    const first: i32 = filed > 0 ? filed - 1 : -1
    nextOf[slot] = first
    prevOf[slot] = -1
    if (first >= 0 && first < toI32(prevOf.length)) {
      prevOf[first] = slot
    }
    head[b] = slot + 1
    bucketOf[slot] = b
    dueAt[slot] = due
    this.flag(b, true)
  }

  /**
   * The slot at the head of the bucket for `time`, taken out of it.
   * @param time A millisecond: its bucket is `time` modulo `H3_SERVER_WHEEL`, which also holds a slot
   *   filed at the horizon for a later deadline, so the caller compares `dueAt`.
   * @returns The slot taken, or -1 when the bucket is empty.
   */
  take(time: i64): i32 {
    const head = this.head
    const b: i32 = http3ServerBucket(time)
    if (b < 0 || b >= toI32(head.length)) {
      return -1
    }
    const filed: i32 = head[b]
    if (filed <= 0) {
      return -1
    }
    const slot: i32 = filed - 1
    this.unfile(slot)
    return slot
  }

  /**
   * Milliseconds from `now` to the first filled bucket, at most the horizon.
   * @param now The current millisecond; the search starts at the cursor, or at `now` before it starts.
   * @returns 0 when that bucket's time is at or before `now`, the milliseconds until it otherwise, or -1
   *   when every bucket is empty.
   */
  next(now: i64): i32 {
    const head = this.head
    const bits = this.bits
    // From the cursor: a bucket before it has run, and one at `now` after a
    // tick is the horizon's, a full turn of the wheel away.
    const from: i64 = this.cursor < 0 ? now : this.cursor
    const start: i32 = http3ServerBucket(from)
    if (start < 0 || start > 2047) {
      // Below 0 only for a time before the clock's zero, which has no bucket; never above 2047.
      return -1
    }
    // The milliseconds past `from` searched, to `H3_SERVER_WHEEL`.
    let offset: i32 = 0
    while (offset < 2048) {
      if (from < 0 && offset > 0) {
        // Past a negative `from`, every time up to the clock's zero has no bucket.
        return -1
      }
      const b: i32 = (start + offset) & 2047
      const word: i32 = b >> 6
      if (word >= toI32(bits.length) || b >= toI32(head.length)) {
        // Never taken: the constructor gives `head` a place per bucket and `bits` a bit.
        return -1
      }
      if (bits[word] === 0) {
        // An empty word: on to the next one.
        offset = offset + (64 - (b & 63))
      } else if (head[b] !== 0) {
        return http3ServerWait(from, offset, now)
      } else {
        offset = offset + 1
      }
    }
    return -1
  }
}

/**
 * The pool. `slot`s are indices from 0 to `size() - 1`; `connection(slot)`
 * is the HTTP/3 side of each and `quic(slot)` the QUIC side.
 */
export class Http3Server {
  /** The QUIC configuration of the listener and every slot's connection; `stop` wipes its two keys. */
  quicConfig: QuicServerConfig
  /** The HTTP/3 configuration each slot's `Http3Connection` is built with. */
  private config: Http3Config
  /** Answers the datagrams no slot owns, and accepts new connections into free slots; `stop` releases it. */
  listener: QuicListener
  /** What the listener answers into, made once: its reply and IDs are refilled in their own room. */
  answer: QuicListenerAnswer
  /** The slots built so far, 0 up: each built on the first Initial accepted into it, or the first ask for it. */
  quics: QuicConnection[]
  /** The HTTP/3 side of each slot in `quics`, at the same index: what `connection` answers. */
  conns: Http3Connection[]
  /**
   * The `date` every slot's responses carry, formatted once a second for all
   * of them: each slot's `Http3Connection.date` is its bytes, refreshed by
   * `connection` and `ready`. `date.pin` fixes its clock.
   */
  date: HttpDate
  /** The connection IDs of every slot holding a connection, which route each datagram to its slot. */
  index: Http3CidIndex
  /** Each slot's next deadline, filed by `flush` and run by `tick`; `timeout` reads it. */
  wheel: Http3Wheel
  /**
   * Where each slot sends now: its client's address as the first datagram
   * came from, then wherever the connection follows the client to
   * (`QuicConnection.sendAddress`, copied here by `flush` before each slot's flight once
   * `quic(slot).pathKnown`). Not validated until `quic(slot).addressValidated` is set (RFC 9000 §8.1): a
   * Retry token the listener checked, with `quicConfig.retry` on, or a Handshake packet
   * from the client. Before then it is the source of one UDP datagram, which
   * anyone can forge, so a cap or an allow-list keyed on it waits for that.
   * After the handshake it changes when the client's address does (a NAT
   * rebinding, §9.3), first to an address not yet validated, so a cap keyed
   * on the address a session started from keeps its own copy.
   */
  addresses: u8[][]
  /** What `receive` reads into, and where `flush` writes a flight. */
  private rx: u8[]
  private tx: u8[]
  private from: u8[]
  private meta: i32[]
  /**
   * `QUIC_CONN_ENTROPY_SIZE` bytes of scratch, refilled from `crypto.getRandomValues` for each slot built
   * and each connection accepted; it holds the last one's until the next, and `stop` zeroes it.
   */
  entropy: u8[]
  private flight: QuicFlight
  /** Signs every slot's CertificateVerify in `serve`, one for the server, keeping nothing per signature. */
  private signer: TlsP256Signer
  /** Each slot's connection-ID index signature, so it is refiled only when its IDs changed. */
  private signatures: i64[]
  private state: i32[]
  /** The slots with datagrams for the program, a ring, and the slots with something to send, a stack. */
  private readyRing: i32[]
  private dirtyStack: i32[]
  /** Released slots, a stack: a slot never built is taken from `used` instead. */
  private free: i32[]
  /** Per slot: 1 while on the ready ring, 2 while on the dirty stack. */
  private queued: i32[]
  /**
   * The stream buffers every slot's connection borrows from, made by the
   * constructor for the stream table `quicConfig` gives every slot: `null`
   * when its streams have none. Each pool makes a buffer only when a stream
   * first needs one, so an idle server holds none (QUIC-3). It is made even
   * for a configuration `quicConnConfigFits` refuses; a slot's connection
   * shares it only when its stream buffers are the pools' size.
   */
  streamPools: QuicStreamPools | null = null
  /** The `bodyChunk`-byte read buffers every slot's `Http3Connection` borrows, one at most each. */
  dataPool: BufferPool
  /** The `maxFieldSectionSize`-byte HEADERS buffers every slot's `Http3Connection` borrows around a decode. */
  sectionPool: BufferPool
  /** When the answer budget was last topped up, -1 before the first answer. */
  private answerRefilled: i64 = -1
  /** The caller's clock in microseconds, from `clock`, or -1: what each connection's pacer counts. */
  private micros: i64 = -1
  /** The UDP socket every datagram is read from and sent on, as the constructor was given it. */
  fd: i32 = -1
  private readyHead: i32 = 0
  private readyCount: i32 = 0
  private dirtyCount: i32 = 0
  private freeCount: i32 = 0
  /** How many slots the pool may hold, which `size` answers. */
  private slots: i32 = 1
  /** The slots ever accepted into, 0 up: one past it has never held a connection, so is free without being on `free`. */
  private used: i32 = 0
  /** What is left of the answer budget (see `answerRefilled`). */
  private answerBudget: i32 = 0
  /** Connections accepted into a slot, for a log or a test; saturating at 2^31 - 1. */
  accepted: i32 = 0
  /** Initials dropped because no slot was free, saturating at 2^31 - 1. */
  refused: i32 = 0
  /** Datagrams no slot owns dropped past the answer budget before the listener read them, saturating. */
  limited: i32 = 0
  private sendErrors: i32 = 0
  /**
   * The ECN bits of the datagram being handed on (`udpRecvFrom`'s second
   * metadata word, 0 where the platform does not report them), which `serve`
   * gives the slot's connection as its `arrivalEcn`, so that the server's
   * ACKs echo the counts (RFC 9000 §13.4.1). `receive` sets it for every
   * datagram it reads; a caller of `datagram` sets it before the call.
   */
  arrivalEcn: i32 = 0
  /** Whether the platform sends ECN marks: true until a marked send answers -95, and every slot's `ecnMarking` with it. */
  ecn: boolean = true
  /** Set by `stop`: a slot built after it is released as it is made, so it holds no keys. */
  private stopped: boolean = false

  /**
   * A pool of `size` slots serving HTTP/3 under `config` over QUIC under
   * `quicConfig` on the UDP socket `fd`. `listenerEntropy` is the
   * listener's `QUIC_LISTENER_ENTROPY_SIZE` random bytes, whose first eight
   * also key the connection-ID index (wiped in the caller's array, as the
   * listener does). No slot's connections are made here: each slot's are
   * built on the first Initial accepted into it. From here on
   * `quicConfig`'s `statelessResetKey` and `retryTokenKey` are the server's:
   * `stop` wipes them, so the configuration is this server's alone.
   * @param quicConfig The QUIC configuration, kept by reference and shared by the listener and every slot.
   * @param config The HTTP/3 configuration, kept by reference; its `bodyChunk` and `maxFieldSectionSize`
   *   size the shared buffer pools.
   * @param fd The bound UDP socket, kept; the server does not close it.
   * @param size How many slots, 1 to 65536; any other panics, as does an `idleTimeout` or `headTimeout`
   *   under 1.
   * @param listenerEntropy `QUIC_LISTENER_ENTROPY_SIZE` random bytes, copied and then zeroed in this array.
   */
  constructor(quicConfig: QuicServerConfig, config: Http3Config, fd: i32, size: i32, listenerEntropy: u8[]) {
    if (size < 1 || size > 65536) {
      panic(`Http3Server: ${size} slots, outside 1 to 65536`)
    }
    // Checked here as well as by each slot's connection, which is built only on its first Initial.
    if (config.idleTimeout < 1) {
      panic(`Http3Server: idleTimeout of ${config.idleTimeout}, outside 1 to 2147483647`)
    }
    if (config.headTimeout < 1) {
      panic(`Http3Server: headTimeout of ${config.headTimeout}, outside 1 to 2147483647`)
    }
    this.quicConfig = quicConfig
    this.config = config
    this.fd = fd
    this.slots = size
    this.index = new Http3CidIndex(size, listenerEntropy)
    this.listener = new QuicListener(quicConfig, listenerEntropy)
    this.answer = new QuicListenerAnswer(QUIC_LISTENER_ANSWER_SIZE)
    this.wheel = new Http3Wheel(size)
    this.quics = []
    this.conns = []
    this.date = new HttpDate()
    // Formatted once now, so no slot ever sends the bytes before a first format.
    this.date.current()
    this.addresses = []
    this.entropy = new Array<u8>(QUIC_CONN_ENTROPY_SIZE)
    this.dataPool = new BufferPool("Http3Server.data", config.bodyChunk, size)
    this.sectionPool = new BufferPool("Http3Server.section", config.maxFieldSectionSize, size)
    // Room for every buffer each pool can lend, so that giving one back never grows the arena.
    const none: u8[] = []
    quicStreamGrowFree(this.dataPool.free, size, none)
    quicStreamGrowFree(this.sectionPool.free, size, none)
    // The stream table every slot's connection will have, read from the
    // configuration as `QuicConnection` reads it: a shape outside its bounds
    // gets no pools, and a connection whose configuration does not fit has no
    // table to share them with.
    const streamData: i64 = quicConfig.maxStreamData
    const bidi: i64 = quicConfig.maxStreamsBidi
    const uni: i64 = quicConfig.maxStreamsUni
    const local: i64 = quicConfig.localStreams
    // `QUIC_CONN_MAX_STREAMS`, written out so each count's bound is known to the sum below.
    const most: i64 = 1024
    if (
      streamData >= 1 &&
      streamData <= QUIC_CONN_MAX_STREAM_DATA &&
      bidi >= 0 &&
      bidi <= most &&
      uni >= 0 &&
      uni <= most &&
      local >= 0 &&
      local <= most &&
      (bidi > 0 || uni > 0 || local > 0)
    ) {
      this.streamPools = new QuicStreamPools(toI32(streamData), toI32(bidi + uni + local), size)
    }
    this.rx = new Array<u8>(H3_SERVER_RECEIVE_SIZE)
    this.tx = new Array<u8>(H3_SERVER_FLIGHT_BYTES)
    this.from = new Array<u8>(H3_SERVER_ADDRESS)
    this.meta = [H3_SERVER_ZERO, H3_SERVER_ZERO]
    this.flight = new QuicFlight()
    this.signer = new TlsP256Signer()
    this.signatures = http3ServerZeroTimes(size)
    this.state = http3ServerFilled(size, H3_SERVER_ZERO)
    this.readyRing = http3ServerFilled(size, H3_SERVER_ZERO)
    this.dirtyStack = http3ServerFilled(size, H3_SERVER_ZERO)
    // Released slots only: one never used is taken at `used`.
    this.free = http3ServerFilled(size, H3_SERVER_ZERO)
    this.queued = http3ServerFilled(size, H3_SERVER_ZERO)
  }

  /**
   * Builds the next slot, `quics.length`: its QUIC connection under fresh
   * entropy, sharing `streamPools` when its stream table is the one they
   * were made for, its HTTP/3 connection on the pool's buffers and `date`,
   * and its address.
   */
  private build(): void {
    crypto.getRandomValues(this.entropy)
    const quic = new QuicConnection(this.quicConfig, this.entropy)
    quic.ecnMarking = this.ecn
    this.quics.push(quic)
    const pools: QuicStreamPools | null = this.streamPools
    if (pools !== null && pools.data.size === quic.streams.bufferSize && quic.streams.slots.length > 0) {
      quic.streams.share(pools)
    }
    const conn: Http3Connection = new Http3Connection(this.config, quic)
    conn.share(this.dataPool, this.sectionPool)
    conn.date = this.date.current()
    this.conns.push(conn)
    this.addresses.push(new Array<u8>(H3_SERVER_ADDRESS))
    if (this.stopped) {
      conn.release()
    }
  }

  /** `slot` when it is one of the pool's, built with every slot before it if it was not; 0 when it is out of range. */
  private slotAt(slot: i32): i32 {
    const at: i32 = slot >= 0 && slot < this.slots ? slot : H3_SERVER_ZERO
    while (toI32(this.quics.length) <= at) {
      this.build()
    }
    return at
  }

  /** Whether every slot holds a connection: none released, and none left never used. */
  private full(): boolean {
    return this.freeCount <= 0 && this.used >= this.slots
  }

  /**
   * How many slots the pool has, built or not.
   * @returns The constructor's `size`, 1 to 65536.
   */
  size(): i32 {
    return this.slots
  }

  /**
   * How many slots hold a connection.
   * @returns 0 to `size()`.
   */
  busy(): i32 {
    const used: i32 = this.used
    const freed: i32 = this.freeCount
    // Never taken: both count up from 0.
    if (used < 0 || freed < 0) {
      return H3_SERVER_ZERO
    }
    return used - freed
  }

  /**
   * Whether `slot` holds a connection.
   * @param slot Any number.
   * @returns True from the accept into it until it is freed; false for a slot out of range.
   */
  holds(slot: i32): boolean {
    return slot >= 0 && slot < toI32(this.state.length) && this.state[slot] === H3_SERVER_BUSY
  }

  /**
   * The HTTP/3 connection of `slot`, its `date` brought up to now; a slot out
   * of range names the first. A slot not built yet is built here, with every
   * slot before it, so a program that binds something to each slot's
   * connection up front gets the one its slot keeps.
   * @param slot The slot, 0 to `size() - 1`.
   * @returns The slot's connection, kept by the pool and reused by every connection the slot holds.
   */
  connection(slot: i32): Http3Connection {
    this.date.current()
    const at: i32 = slot >= 0 && slot < this.slots ? slot : H3_SERVER_ZERO
    const conns: Http3Connection[] = this.conns
    // `build` grows `conns` and `quics` together, so this builds as `slotAt` does.
    for (;;) {
      if (at >= 0 && at < toI32(conns.length)) {
        return conns[at]
      }
      this.build()
    }
  }

  /**
   * The QUIC connection of `slot`, built as `connection` builds it; a slot out of range names the first.
   * @param slot The slot, 0 to `size() - 1`.
   * @returns The slot's QUIC connection, kept by the pool and reset for each connection the slot holds.
   */
  quic(slot: i32): QuicConnection {
    const at: i32 = slot >= 0 && slot < this.slots ? slot : H3_SERVER_ZERO
    const quics: QuicConnection[] = this.quics
    for (;;) {
      if (at >= 0 && at < toI32(quics.length)) {
        return quics[at]
      }
      this.build()
    }
  }

  /**
   * Marks `slot` as having news for the program, so that `ready` answers it,
   * and something to send, so that the next `flush` sends it; a slot already
   * marked is not marked twice.
   * @param slot The slot; one that holds no connection is ignored.
   */
  touch(slot: i32): void {
    const queued: i32[] = this.queued
    const ring: i32[] = this.readyRing
    // Past `holds`, never taken: `queued` is `size` long, as `state` is.
    if (!this.holds(slot) || slot < 0 || slot >= toI32(queued.length)) {
      return
    }
    const head: i32 = this.readyHead
    const count: i32 = this.readyCount
    const length: i32 = toI32(ring.length)
    // Never false past its first two terms: `ready` keeps `head` in the ring, which is at most 65536 long.
    if ((queued[slot] & 1) === 0 && count < length && head >= 0 && head <= 65535 && count >= 0 && count <= 65535) {
      // `(head + count) % length`, both below `length`.
      const sum: i32 = head + count
      const at: i32 = sum >= length ? sum - length : sum
      if (at >= 0 && at < length) {
        ring[at] = slot
        this.readyCount = count + 1
        queued[slot] = queued[slot] | 1
      }
    }
    this.dirty(slot)
  }

  /** Puts `slot` on the dirty stack, for `flush`. */
  private dirty(slot: i32): void {
    const queued: i32[] = this.queued
    const stack: i32[] = this.dirtyStack
    const count: i32 = this.dirtyCount
    // Never false past its second term: every caller passes a slot `holds`, and the count starts at 0.
    if (slot >= 0 && slot < toI32(queued.length) && count >= 0) {
      if ((queued[slot] & 2) === 0 && count < toI32(stack.length)) {
        stack[count] = slot
        this.dirtyCount = count + 1
        queued[slot] = queued[slot] | 2
      }
    }
  }

  /**
   * The next slot with news for the program: call its connection's `next` until it has none.
   * @returns A slot holding a connection that a datagram or `touch` marked since `ready` last answered it,
   *   each such slot once, or -1 when none is left.
   */
  ready(): i32 {
    this.date.current()
    const ring: i32[] = this.readyRing
    const queued: i32[] = this.queued
    for (;;) {
      const count: i32 = this.readyCount
      if (count <= 0) {
        return -1
      }
      const head: i32 = this.readyHead
      const length: i32 = toI32(ring.length)
      // Never taken: `touch` and this loop keep `head` in the ring.
      if (head < 0 || head >= length) {
        return -1
      }
      const slot: i32 = ring[head]
      // `(head + 1) % length`.
      this.readyHead = head + 1 < length ? head + 1 : H3_SERVER_ZERO
      this.readyCount = count - 1
      // Never false: `touch` puts only a slot it holds on the ring.
      if (slot >= 0 && slot < toI32(queued.length)) {
        queued[slot] = queued[slot] & ~1
      }
      if (this.holds(slot)) {
        return slot
      }
    }
  }

  /**
   * Reads every datagram waiting on the socket, in at most
   * `H3_SERVER_RECEIVE_BURST` receives, and hands each to its slot or the listener,
   * signing a handshake's CertificateVerify with `key` (ECDSA P-256) when one
   * asks. A GRO receive is cut into its datagrams in place. Answers how many
   * datagrams it read.
   * @param now The current millisecond on the caller's monotonic clock.
   * @param key The certificate's private key; read only to sign, and not kept.
   * @returns How many datagrams it handed on, each GRO segment counted, those then dropped included; it
   *   stops at the first receive that finds nothing or fails.
   */
  receive(now: i64, key: Secret<u8[]>): i32 {
    let count: i32 = 0
    for (let burst: i32 = 0; burst < H3_SERVER_RECEIVE_BURST; burst++) {
      const n: i32 = udpRecvFrom(
        this.fd,
        this.rx,
        H3_SERVER_ZERO,
        H3_SERVER_RECEIVE_SIZE,
        this.from,
        this.meta
      )
      const meta: i32[] = this.meta
      // Past the first term, never taken: `udpRecvFrom` reads at most the
      // `H3_SERVER_RECEIVE_SIZE` it is given, and `meta` is the constructor's two words.
      if (n < 0 || n > 65536 || toI32(meta.length) < 2) {
        return count
      }
      const segment: i32 = meta[0] > 0 ? meta[0] : n
      // One receive is one ECN codepoint for every GRO segment of it.
      this.arrivalEcn = meta[1] & 3
      let at: i32 = 0
      while (at >= 0 && at < n && segment > 0) {
        const left: i32 = n - at
        const length: i32 = left < segment ? left : segment
        this.datagram(this.rx, at, length, this.from, now, key)
        count = h3Count(count)
        if (length < left) {
          at = at + length
        } else {
          at = n
        }
      }
    }
    return count
  }

  /**
   * One datagram, `buf[at .. at + len)`, from `address`: to the slot that
   * owns its first packet's Destination Connection ID, or to the listener.
   * One too short to carry its DCID, or whose DCID is longer than
   * `QUIC_MAX_CID_LENGTH`, or a window outside `buf`, is dropped.
   * @param buf The bytes holding the datagram, read in place.
   * @param at Where the datagram starts in `buf`.
   * @param len Its length in bytes.
   * @param address Where it came from, in `nish:net`'s 18-byte form; copied when it starts a connection.
   * @param now The current millisecond on the caller's monotonic clock.
   * @param key The certificate's private key, as `receive` takes it.
   */
  datagram(buf: u8[], at: i32, len: i32, address: u8[], now: i64, key: Secret<u8[]>): void {
    const end: i64 = toI64(at) + toI64(len)
    // The fourth term never decides: a window of at least a byte inside `buf` starts in it.
    if (len < 1 || at < 0 || end > toI64(buf.length) || at >= toI32(buf.length)) {
      return
    }
    // RFC 8999: a long header carries the DCID's length; a short one is ours, of our length.
    let dcidAt: i32 = at + 1
    let dcidLength: i32 = QUIC_CONN_CID_LENGTH
    if ((toI32(buf[at]) & 0x80) !== 0) {
      if (len < 6 || at >= toI32(buf.length) - 5) {
        return
      }
      const lengthAt: i32 = at + 5
      // Never taken, nor the second term above: a window of six bytes or more holds its sixth.
      if (lengthAt >= toI32(buf.length)) {
        return
      }
      dcidLength = toI32(buf[lengthAt])
      dcidAt = lengthAt + 1
    }
    if (dcidLength > QUIC_MAX_CID_LENGTH || toI64(dcidAt) + toI64(dcidLength) > end) {
      return
    }
    const slot: i32 = this.index.find(buf, dcidAt, dcidLength)
    if (slot >= 0) {
      this.serve(slot, buf, at, len, address, now, key)
      return
    }
    this.unowned(buf, at, len, address, now, key)
  }

  /**
   * A datagram no slot owns: the listener decides, reading it where it lies
   * in `buf` and answering into `answer`, and may make a connection in a
   * free slot, which reads the same window. Nothing is copied (H3-3).
   */
  private unowned(buf: u8[], at: i32, len: i32, address: u8[], now: i64, key: Secret<u8[]>): void {
    if (!this.worthListening(buf, at, len, now)) {
      return
    }
    const answer: QuicListenerAnswer = this.answer
    if (this.listener.handleWindow(buf, at, len, address, now, answer) !== QUIC_LISTEN_ACCEPT) {
      const reply: i32 = toI32(answer.reply.length)
      if (reply > 0) {
        this.send(answer.reply, H3_SERVER_ZERO, reply, address, H3_SERVER_ZERO, H3_SERVER_ZERO)
      }
      return
    }
    // A slot released before is taken first, then the next never used, so the
    // first accepts take slots 0, 1, 2 ... and a pool that never fills never
    // builds its last slots.
    let slot: i32 = 0
    const free: i32[] = this.free
    const freed: i32 = this.freeCount
    const used: i32 = this.used
    if (freed > 0) {
      // Never taken: `release` pushes at most one entry per slot onto `free`, `size` long.
      if (freed > toI32(free.length)) {
        return
      }
      this.freeCount = freed - 1
      slot = free[freed - 1]
    } else if (used < this.slots) {
      slot = this.slotAt(used)
      this.used = used + 1
    } else {
      return
    }
    const quics: QuicConnection[] = this.quics
    const conns: Http3Connection[] = this.conns
    const addresses: u8[][] = this.addresses
    const state: i32[] = this.state
    const signatures: i64[] = this.signatures
    crypto.getRandomValues(this.entropy)
    // Never taken: a released slot was built, `slotAt` builds the one it answers, and
    // `state` and `signatures` are `size` long.
    if (
      slot < 0 ||
      slot >= toI32(quics.length) ||
      slot >= toI32(conns.length) ||
      slot >= toI32(addresses.length) ||
      slot >= toI32(state.length) ||
      slot >= toI32(signatures.length)
    ) {
      return
    }
    const quic: QuicConnection = quics[slot]
    const conn: Http3Connection = conns[slot]
    const to: u8[] = addresses[slot]
    // Marked busy before its connections restart, which read neither array.
    state[slot] = H3_SERVER_BUSY
    signatures[slot] = H3_SERVER_NONE
    quic.reset(this.entropy)
    conn.restart()
    if (answer.retried) {
      quic.acceptRetry(answer.originalDcid, answer.retryScid)
    }
    for (let k: i32 = 0; k < toI32(to.length) && k < toI32(address.length); k++) {
      to[k] = address[k]
    }
    this.accepted = h3Count(this.accepted)
    this.serve(slot, buf, at, len, address, now, key)
  }

  /**
   * Whether the listener could answer `buf[at .. at + len)` at all, read
   * from its first bytes: what it would drop without a word is dropped
   * here, before the listener parses it. That is a short header too short for a stateless reset; a long
   * one shorter than a full Initial, which neither Version Negotiation nor a
   * new connection answers (RFC 9000 §14.1, §6.1); version 0; a version 1
   * packet that is not an Initial, or whose DCID is under 8 bytes (§7.2);
   * and an Initial when no slot is free, which is counted in `refused`.
   * A stateless reset and a Version Negotiation packet, the answers that do
   * not start a connection, are also held to `takeAnswer`'s budget.
   */
  private worthListening(buf: u8[], at: i32, len: i32, now: i64): boolean {
    // Never taken: `datagram` passes a window of at least a byte inside `buf`.
    if (at < 0 || at >= toI32(buf.length)) {
      return false
    }
    const first: i32 = toI32(buf[at])
    if ((first & 0x80) === 0) {
      return len > QUIC_LISTENER_MIN_RESET && this.takeAnswer(now)
    }
    if (len < QUIC_CONN_DATAGRAM_SIZE) {
      return false
    }
    // Never taken, nor the test in the loop: the window, `QUIC_CONN_DATAGRAM_SIZE` bytes or more,
    // holds its first six.
    if (at >= toI32(buf.length) - 5) {
      return false
    }
    const lengthAt: i32 = at + 5
    if (lengthAt >= toI32(buf.length)) {
      return false
    }
    let version: i32 = 0
    for (let k: i32 = 1; k <= 4; k++) {
      const byteAt: i32 = at + k
      if (byteAt < toI32(buf.length)) {
        version = (version << 8) | toI32(buf[byteAt])
      }
    }
    if (version !== 1) {
      return version !== 0 && this.takeAnswer(now)
    }
    if ((first & 0x30) !== 0 || toI32(buf[lengthAt]) < 8) {
      return false
    }
    if (this.full()) {
      this.refused = h3Count(this.refused)
      return false
    }
    return true
  }

  /**
   * Takes one answer to a datagram no slot owns from the budget —
   * `H3_SERVER_ANSWER_BURST` at once, then one per
   * `H3_SERVER_ANSWER_INTERVAL` milliseconds — topping it up first. Past it
   * the datagram is dropped before the listener sees it, so a flood of
   * garbage costs no answer and no MAC past the budget (H3-3); counted in `limited`.
   */
  private takeAnswer(now: i64): boolean {
    let refilled: i64 = this.answerRefilled
    let budget: i32 = this.answerBudget
    if (refilled < 0 || now < refilled) {
      refilled = now
      budget = H3_SERVER_ANSWER_BURST
    } else if (now >= 0) {
      // Always taken: `now` is at least `refilled`, which is not negative here.
      const elapsed: i64 = now - refilled
      // 100 is `H3_SERVER_ANSWER_INTERVAL`, written out so the divisor is a literal.
      const earned: i64 = elapsed / toI64(100)
      // The second term never decides: an interval earned is 100 elapsed.
      if (earned > 0 && elapsed > 0) {
        // The budget is 0 to `H3_SERVER_ANSWER_BURST`, 16, so 16 intervals or more always fill it.
        const gain: i32 = earned < 16 ? toI32(earned) : 16
        if (gain < 16 && gain >= 0 && budget >= 0 && budget < 16) {
          const sum: i32 = budget + gain
          budget = sum < H3_SERVER_ANSWER_BURST ? sum : H3_SERVER_ANSWER_BURST
        } else {
          budget = H3_SERVER_ANSWER_BURST
        }
        // `refilled + earned * H3_SERVER_ANSWER_INTERVAL`: the part of an interval left over counts
        // toward the next answer.
        const rest: i32 = toI32(elapsed % 100)
        // Always taken: `elapsed` is positive, so its remainder is 0 to 99.
        if (rest >= 0 && rest < 100) {
          refilled = now - toI64(rest)
        }
      }
    }
    this.answerRefilled = refilled
    if (budget <= 0) {
      this.answerBudget = budget
      this.limited = h3Count(this.limited)
      return false
    }
    this.answerBudget = budget - 1
    return true
  }

  /**
   * Gives the server the caller's monotonic clock in microseconds: the
   * instant the `now` of the calls that follow names, `monotonicNanos() /
   * 1000` where `now` is `monotonicNanos() / 1000000`. The pacer counts it;
   * every timer still counts `now`. One that is not inside `now`'s
   * millisecond is not read.
   * @param micros The instant in microseconds; one outside the millisecond `now` names, such as -1, makes
   *   the pacer count whole milliseconds.
   */
  clock(micros: i64): void {
    this.micros = micros
  }

  /**
   * Hands `slot`'s connection a datagram from `address`, signs when the
   * handshake asks, and refiles its IDs and timer. The connection decides
   * from the address whether the client moved (RFC 9000 §9.3); an address
   * that is not 18 bytes long leaves it where it is.
   * @param slot A slot that holds a connection, as `datagram` finds it; one outside the pool is ignored.
   * @param buf The bytes holding the datagram, read in place.
   * @param at Where the datagram starts in `buf`.
   * @param len Its length in bytes.
   * @param address Where it came from, in `nish:net`'s 18-byte form.
   * @param now The current millisecond on the caller's monotonic clock.
   * @param key The certificate's private key, as `receive` takes it.
   */
  serve(slot: i32, buf: u8[], at: i32, len: i32, address: u8[], now: i64, key: Secret<u8[]>): void {
    const quics: QuicConnection[] = this.quics
    if (slot < 0 || slot >= toI32(quics.length)) {
      return
    }
    const quic: QuicConnection = quics[slot]
    quic.recovery.micros = this.micros
    quic.arrivalEcn = this.arrivalEcn
    quic.receiveWindowFrom(buf, at, len, address, now)
    const input: u8[] | null = quic.signatureInput()
    if (input !== null) {
      const signature: u8[] | null = this.signer.sign(key, input)
      if (signature !== null) {
        quic.sign(signature)
      }
    }
    this.refile(slot)
    this.touch(slot)
  }

  /** Files `slot`'s connection IDs in the index again when they changed. */
  private refile(slot: i32): void {
    const quics: QuicConnection[] = this.quics
    if (slot < 0 || slot >= toI32(quics.length)) {
      // Never taken: every caller passes a slot of the pool.
      return
    }
    const quic: QuicConnection = quics[slot]
    const signature: i64 =
      (quic.cids.nextLocal << 16) |
      (toI64(quic.cids.activeLocal()) << 8) |
      (toI64(quic.originalDcidLength) << 1) |
      (quic.handshakeComplete ? toI64(1) : toI64(0))
    const signatures: i64[] = this.signatures
    // `slot` is under 65536, the most slots the constructor takes, so its first entry below fits.
    if (slot >= toI32(signatures.length) || slot > 65535) {
      // Never taken: `signatures` has an entry per slot.
      return
    }
    if (signature === signatures[slot]) {
      return
    }
    signatures[slot] = signature
    this.unindex(slot)
    // 5 is `H3_SERVER_KEYS` and 4 `QUIC_CONN_LOCAL_CIDS`, written out so the entries' bound is known.
    const keys: i32 = 5
    const cids: i32 = 4
    const first: i32 = slot * keys
    const local = quic.cids.local
    for (let j: i32 = 0; j < cids && j < toI32(local.length); j++) {
      const entry = local[j]
      if (entry.used) {
        this.index.insert(first + j, entry.cid, H3_SERVER_ZERO, entry.length)
      }
    }
    if (!quic.handshakeComplete && quic.originalDcidLength > 0) {
      this.index.insert(first + cids, quic.originalDcid, H3_SERVER_ZERO, quic.originalDcidLength)
    }
  }

  /**
   * Sends `buf[at .. at + len)` to `to` with the ECN codepoint `ecn`, cut
   * into `segment`-byte datagrams when it is above 0; answers whether it went.
   */
  private send(buf: u8[], at: i32, len: i32, to: u8[], segment: i32, ecn: i32): boolean {
    const sent: i32 = udpSendTo(this.fd, buf, at, len, to, segment, ecn)
    if (sent >= 0) {
      return true
    }
    if (sent !== H3_SERVER_UNSUPPORTED || (segment <= 0 && ecn === 0)) {
      this.sendErrors = h3Count(this.sendErrors)
      return false
    }
    // -95: no segmentation offload, or no ECN, or both. One datagram at a
    // time, still marked: a -95 to a datagram with no segment is the mark's.
    let mark: i32 = ecn
    if (segment <= 0) {
      this.unmark()
      mark = H3_SERVER_ZERO
    }
    const step: i32 = segment > 0 ? segment : len
    if (at < 0 || len < 0) {
      // Never taken: `udpSendTo` above took `buf[at .. at + len)`.
      return false
    }
    let p: i32 = at
    let left: i32 = len
    while (left > 0) {
      const n: i32 = left < step ? left : step
      let one: i32 = udpSendTo(this.fd, buf, p, n, to, H3_SERVER_ZERO, mark)
      if (one === H3_SERVER_UNSUPPORTED && mark !== 0) {
        // No ECN here: this datagram and the rest go unmarked and no slot
        // marks again. The packets just counted as marked fail their
        // connection's validation.
        this.unmark()
        mark = H3_SERVER_ZERO
        one = udpSendTo(this.fd, buf, p, n, to, H3_SERVER_ZERO, mark)
      }
      if (one < 0) {
        this.sendErrors = h3Count(this.sendErrors)
        return false
      }
      if (n < 0 || n > left) {
        // Never taken: `n` is the smaller of `left` and a positive `step`.
        return false
      }
      left = left - n
      // `p + n`, at most `at + len`, which `udpSendTo` took, so it fits an i32.
      p = toI32(toI64(p) + toI64(n))
    }
    return true
  }

  /** The platform sends no ECN: no slot's connection marks from now on. */
  unmark(): void {
    this.ecn = false
    for (let slot: i32 = 0; slot < toI32(this.quics.length); slot++) {
      this.quics[slot].ecnMarking = false
    }
  }

  /**
   * Sends what every touched slot has, as far as its pacer lets it, closes a
   * slot whose HTTP/3 side is done after GOAWAY, frees a slot whose
   * connection has closed, and files each in the wheel under its next
   * deadline.
   * @param now The current millisecond on the caller's monotonic clock.
   */
  flush(now: i64): void {
    const stack: i32[] = this.dirtyStack
    const queued: i32[] = this.queued
    for (;;) {
      const count: i32 = this.dirtyCount
      // Past the first term, never taken: `dirty` pushes only below the stack's length.
      if (count <= 0 || count > toI32(stack.length)) {
        return
      }
      const top: i32 = count - 1
      this.dirtyCount = top
      const slot: i32 = stack[top]
      // Always taken: the stack holds slots of the pool.
      if (slot >= 0 && slot < toI32(queued.length)) {
        queued[slot] = queued[slot] & ~2
      }
      if (this.holds(slot)) {
        this.flushSlot(slot, now)
      }
    }
  }

  /** `flush` of one slot. */
  private flushSlot(slot: i32, now: i64): void {
    const quics: QuicConnection[] = this.quics
    const conns: Http3Connection[] = this.conns
    const addresses: u8[][] = this.addresses
    if (slot < 0 || slot >= toI32(quics.length) || slot >= toI32(conns.length) || slot >= toI32(addresses.length)) {
      // Never taken: `flush` passes a slot that holds a connection, which `build` made in all three.
      return
    }
    const quic: QuicConnection = quics[slot]
    const conn: Http3Connection = conns[slot]
    const to: u8[] = addresses[slot]
    quic.recovery.micros = this.micros
    if (conn.isDone() && !quic.closed()) {
      quic.close(H3_NO_ERROR)
    }
    // An idle client, or one trickling a request's head, loses the slot here (H3-5).
    const clocked: i64 = conn.clock(now)
    // A PATH_RESPONSE owed on a path the connection did not move to goes
    // there, alone (RFC 9000 §9.1); asking for it runs the connection's
    // timers first, so a validation that ran out has moved it back before
    // the flight below picks where it goes.
    const probe: i32 = quic.takeProbeInto(this.tx, H3_SERVER_ZERO, now)
    if (probe > 0) {
      this.send(this.tx, H3_SERVER_ZERO, probe, quic.probeAddress, H3_SERVER_ZERO, H3_SERVER_ZERO)
    }
    if (quic.pathKnown) {
      const current: u8[] = quic.sendAddress()
      for (let k: i32 = 0; k < toI32(to.length) && k < toI32(current.length); k++) {
        to[k] = current[k]
      }
    }
    let retried: boolean = false
    for (let guard: i32 = 0; guard < 64; guard++) {
      const n: i32 = quicListenerTakeFlight(
        quic,
        now,
        this.tx,
        H3_SERVER_ZERO,
        toI32(this.tx.length),
        this.flight
      )
      if (n <= 0 && !retried) {
        // Asked once more: a stream whose lost bytes were all acknowledged
        // since gives up its new ones in the packet that finds that out (H3-7).
        retried = true
        continue
      }
      if (n <= 0) {
        break
      }
      const segment: i32 = this.flight.count > 1 ? this.flight.segment : H3_SERVER_ZERO
      if (!this.send(this.tx, H3_SERVER_ZERO, n, to, segment, this.flight.ecn)) {
        break
      }
      retried = false
    }
    if (quic.closed()) {
      // The CONNECTION_CLOSE goes whatever the pacer says: nothing follows it.
      const n: i32 = quic.takeDatagramInto(this.tx, H3_SERVER_ZERO, now)
      if (n > 0) {
        this.send(this.tx, H3_SERVER_ZERO, n, to, H3_SERVER_ZERO, quic.datagramEcn)
      }
      this.release(slot)
      return
    }
    this.refile(slot)
    // The pacer answers a time, not a delay: the slot wakes at it when it
    // comes before the connection's own deadline.
    let due: i64 = quic.deadline()
    const paced: i64 = quicListenerFlightTime(quic, now)
    if (paced > now && (due < 0 || paced < due)) {
      due = paced
    }
    if (clocked >= 0 && (due < 0 || clocked < due)) {
      due = clocked
    }
    this.wheel.file(slot, due, now)
  }

  /** Takes every one of `slot`'s connection IDs out of the index. */
  private unindex(slot: i32): void {
    // Never taken: a slot is 0 to 65535, under the most slots the constructor takes.
    if (slot < 0 || slot > 65535) {
      return
    }
    // 5 is `H3_SERVER_KEYS`, written out so the entries' bound is known.
    const keys: i32 = 5
    const first: i32 = slot * keys
    for (let j: i32 = 0; j < keys; j++) {
      this.index.remove(first + j)
    }
  }

  /** Frees `slot`: its IDs leave the index and its timer the wheel. */
  private release(slot: i32): void {
    this.unindex(slot)
    this.wheel.unfile(slot)
    const conns: Http3Connection[] = this.conns
    const state: i32[] = this.state
    if (slot < 0 || slot >= toI32(conns.length) || slot >= toI32(state.length)) {
      // Never taken: every caller passes a slot that holds a connection.
      return
    }
    // Marked free before the connection lets go of its buffers, which read
    // nothing of the server's.
    state[slot] = H3_SERVER_FREE
    conns[slot].release()
    const free: i32[] = this.free
    const count: i32 = this.freeCount
    if (count >= 0 && count < toI32(free.length)) {
      free[count] = slot
      this.freeCount = count + 1
    }
  }

  /**
   * Stops the server for good and wipes the keys it holds: every built slot's
   * connection is released (`QuicConnection.release`, which sends nothing), as
   * is one built after, by `connection` or `quic`; the listener is released;
   * and the configuration's `statelessResetKey` and `retryTokenKey`, the
   * index's salt, the connections' entropy scratch and the listener's last
   * answer (a Retry's or a reset's token) are zeroed. From then on every
   * datagram is dropped and no connection is accepted.
   *
   * The configuration's two keys are the server's once it is made with them: a
   * program that keeps a copy of either, to start the next server with, wipes
   * its own copy. The keys are zeroed in place, so give each server a
   * `QuicServerConfig` of its own: any other listener, connection or server
   * made with the same one would go on MACing Retry tokens and deriving
   * stateless reset tokens under an all-zero key, which anyone can forge.
   */
  stop(): void {
    this.stopped = true
    const conns: Http3Connection[] = this.conns
    for (let slot: i32 = 0; slot < toI32(this.quics.length); slot++) {
      if (this.holds(slot)) {
        this.release(slot)
      } else if (slot < toI32(conns.length)) {
        // Always taken: `build` grows `conns` and `quics` together.
        conns[slot].release()
      }
    }
    this.listener.release()
    secureZero(this.quicConfig.statelessResetKey)
    secureZero(this.quicConfig.retryTokenKey)
    secureZero(this.index.salt)
    secureZero(this.entropy)
    this.answer.wipe()
  }

  /**
   * Runs the timers due by `now`, and marks each slot it ran for `flush`.
   * @param now The current millisecond on the caller's monotonic clock.
   */
  tick(now: i64): void {
    // `now + 1`, where the cursor ends once `now` has run. Below zero it fits;
    // from zero it is put back together from the millisecond's high and low
    // parts, whose ranges show the sum fits.
    let after: i64 = 0
    if (now < 0) {
      after = now + 1
    } else {
      const high: i64 = now / 1048576
      const low: i64 = now % 1048576
      if (high >= 1073741824) {
        // Never taken: a millisecond of `monotonicNanos() / 1000000` is under
        // 2^44, so `high` is under 2^24.
        return
      }
      after = high * 1048576 + low + 1
    }
    const wheel: Http3Wheel = this.wheel
    let cursor: i64 = wheel.cursor
    if (cursor < 0) {
      cursor = now
    }
    // Late by more than a turn: every bucket is run once, from a turn ago, so a
    // slot filed again lands after `now` and not behind the cursor. 2048 is
    // `H3_SERVER_WHEEL`, compared on each side of zero so no difference overflows.
    if (now >= 0) {
      if (now - 2048 >= cursor) {
        cursor = now - 2047
      }
    } else if (cursor < 0) {
      const behind: i64 = now - cursor
      if (behind >= 2048) {
        // `now - 2047`.
        cursor = cursor + (behind - 2047)
      }
    }
    wheel.cursor = cursor
    for (let steps: i32 = 0; steps < H3_SERVER_WHEEL; steps++) {
      const at: i64 = wheel.cursor
      if (at > now) {
        break
      }
      let slot: i32 = wheel.take(at)
      while (slot >= 0) {
        if (this.holds(slot)) {
          const dueAt: i64[] = wheel.dueAt
          const quics: QuicConnection[] = this.quics
          if (slot >= toI32(dueAt.length) || slot >= toI32(quics.length)) {
            // Never taken: `holds` is true only of a slot of the pool.
          } else if (dueAt[slot] > now) {
            // Filed at the horizon: not due yet, so filed again.
            wheel.file(slot, dueAt[slot], now)
          } else {
            quics[slot].handleTimer(now)
            this.dirty(slot)
          }
        }
        slot = wheel.take(wheel.cursor)
      }
      // On to the next millisecond, `next + 1`, written so that no sum can
      // overflow. At `now` the cursor ends at `after`, and the loop with it.
      const next: i64 = wheel.cursor
      if (next === now) {
        wheel.cursor = after
        break
      }
      if (next < 0 && next < now) {
        wheel.cursor = next + 1
      } else if (next >= 0 && now >= 0) {
        // Both from zero, so the distance left fits.
        const ahead: i64 = now - next
        if (ahead >= 1) {
          wheel.cursor = now - (ahead - 1)
        } else {
          // Never taken: the bucket just run was at `now` or before.
          break
        }
      } else {
        // Never taken: the bucket just run was at `now` or before, and running
        // it moves the cursor only from before zero to `now`.
        break
      }
    }
    if (wheel.cursor <= now) {
      wheel.cursor = after
    }
  }

  /**
   * Milliseconds until `tick` has a timer to run, for `pollWait`.
   * @param now The current millisecond on the caller's monotonic clock.
   * @returns 0 when a timer is due now, the milliseconds until the first otherwise (at most about
   *   `H3_SERVER_WHEEL`), or -1 when no slot is filed.
   */
  timeout(now: i64): i32 {
    return this.wheel.next(now)
  }
}
