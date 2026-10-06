/**
 * `nish/net/http3-server` — HTTP/3 over QUIC on one UDP socket: a pool of
 * slots, each a reusable `QuicConnection` with an `Http3Connection` beside
 * it, a `QuicListener` in front for the datagrams no slot owns, for a
 * program that owns its readiness loop.
 *
 *     const fd = udpBind("0.0.0.0", 4433, 0);
 *     const server = new Http3Server(quicConfig, new Http3Config(), fd, 64, listenerEntropy);
 *     // quicConfig.alpn is ["h3"]; pollAdd(loop, fd, 1, 0)
 *     // each time round the loop, with `now` in milliseconds:
 *     pollWait(loop, ready, server.timeout(now));
 *     server.receive(now, key);                  // every datagram waiting; signs handshakes with `key`
 *     server.tick(now);                          // the connections' timers
 *     let slot: i32 = server.ready();
 *     while (slot >= 0) {
 *       const h3: Http3Connection = server.connection(slot);
 *       let event: i32 = h3.next();
 *       while (event !== H3_NEED_MORE && event !== H3_ERROR) { … ; event = h3.next(); }
 *       slot = server.ready();
 *     }
 *     server.flush(now);                         // what every touched slot has to send
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
 * offers; a connection whose handshake chose anything but `h3` is closed with
 * CRYPTO_ERROR no_application_protocol (0x0178) and never reaches its
 * `Http3Connection` (RFC 9114 §3.1).
 *
 * **Sending.** `flush` writes each touched slot's datagrams with
 * `quicListenerTakeFlight`, a paced flight at a time in one `udpSendTo` with
 * GSO where the platform has it and one datagram at a time where it does not.
 * A slot whose HTTP/3 side sent GOAWAY and whose requests have all finished,
 * every byte acknowledged, is closed with H3_NO_ERROR; a closed slot is freed
 * once its CONNECTION_CLOSE is out.
 *
 * **Timers** are a wheel of `H3_SERVER_WHEEL` one-millisecond buckets, a
 * slot in at most one: after every datagram and every flush the slot is filed
 * under its next deadline (its idle, loss and probe timers, and its pacer),
 * and `tick` runs the buckets that are due. `timeout` finds the next filled
 * bucket from a bitmap. A deadline past the wheel's horizon is filed at the
 * horizon and filed again when it comes round. So no call scans the slots.
 *
 * **Caps, fixed at start-up**: the slots, and inside each the QUIC
 * configuration's streams and buffers and the `Http3Config`'s field section,
 * body chunk and DATA frame. The constructor makes every slot's connections;
 * a datagram an established connection reads, and every datagram it sends,
 * allocates nothing. What does allocate is a new connection's — the listener's
 * work on a datagram no slot owns, and the QUIC handshake (TLS-3) —
 * `docs/security/http3.md` lists it.
 *
 * Written from RFC 9114 §3 and RFC 9000 §5.2, not ported from another
 * implementation. Private names carry the `http3Server` prefix
 * (`docs/wp26-stdlib.md` §3e).
 */
import { udpRecvFrom, udpSendTo } from "nish:net"
import { Secret } from "nish:secret"
import { H3_ALPN, Http3Config, Http3Connection } from "nish/net/http3"
import { H3_NO_ERROR } from "nish/net/http3-frame"
import {
  QUIC_CONN_CID_LENGTH,
  QUIC_CONN_DATAGRAM_SIZE,
  QUIC_CONN_ENTROPY_SIZE,
  QUIC_CONN_LOCAL_CIDS,
  QUIC_STATE_CONNECTED,
  QuicConnection,
  QuicServerConfig,
} from "nish/net/quic"
import { QUIC_MAX_CID_LENGTH } from "nish/net/quic-packet"
import {
  QUIC_LISTEN_ACCEPT,
  QUIC_LISTENER_FLIGHT_MAX,
  QuicFlight,
  QuicListener,
  QuicListenerAnswer,
  quicListenerPaceTime,
  quicListenerTakeFlight,
} from "nish/net/quic-listener"
import { tlsSignEcdsaP256 } from "nish/net/tls"

/** The timer wheel's buckets, one millisecond each: its horizon. */
export const H3_SERVER_WHEEL: i32 = 2048

/** The most datagrams one `receive` reads, so one busy socket cannot hold the loop. */
export const H3_SERVER_RECEIVE_BURST: i32 = 256

/** The address form `nish:net` reads and writes. */
const H3_SERVER_ADDRESS: i32 = 18

/** What `udpRecvFrom` and `udpSendTo` answer when the socket has nothing, or no room. */
const H3_SERVER_WOULD_BLOCK: i32 = -11

/** What `udpSendTo` answers where the platform has no segmentation offload. */
const H3_SERVER_NO_GSO: i32 = -95

/** The largest datagram read: a GRO receive of up to 64 KB. */
const H3_SERVER_RECEIVE_SIZE: i32 = 65536

/** CRYPTO_ERROR with TLS's no_application_protocol alert (RFC 9001 §4.8, RFC 7301 §3.2). */
const H3_SERVER_NO_ALPN: i64 = 0x0178

/** Index entries per slot: its local connection IDs, then the client's original DCID. */
const H3_SERVER_KEYS: i32 = QUIC_CONN_LOCAL_CIDS + 1

/** Typed constants, since a bare literal is an `f64` under `--number-mode f64`. */
const H3_SERVER_ZERO: i32 = 0
const H3_SERVER_NONE: i64 = -1

/** A slot's states. */
const H3_SERVER_FREE: i32 = 0
const H3_SERVER_BUSY: i32 = 1

/** `count` plus one, saturating at 2^31 - 1. */
const http3ServerCount = (count: i32): i32 => (count < 2147483647 ? count + 1 : count)

/** The bucket of `time` on the wheel. */
const http3ServerBucket = (time: i64): i32 => toI32(time % toI64(H3_SERVER_WHEEL))

/**
 * The connection IDs of every slot, by hash: open addressing over
 * `table`, whose entries are an index into `keys` plus one. Entry `e`
 * belongs to slot `e / H3_SERVER_KEYS`.
 */
export class Http3CidIndex {
  table: i32[]
  /** Entry `e`'s ID is `keys[e * 20 .. e * 20 + lengths[e])`; a length of 0 is no entry. */
  keys: u8[]
  lengths: i32[]
  /** The hash's key: eight bytes from the listener's entropy. */
  salt: u8[]

  constructor(slots: i32, salt: u8[]) {
    const entries: i32 = slots * H3_SERVER_KEYS
    let size: i32 = 8
    while (size < entries * 2) {
      size = size * 2
    }
    this.table = new Array<i32>(size)
    this.keys = new Array<u8>(entries * QUIC_MAX_CID_LENGTH)
    this.lengths = new Array<i32>(entries)
    this.salt = new Array<u8>(8)
    for (let k: i32 = 0; k < 8 && k < toI32(salt.length); k++) {
      this.salt[k] = salt[k]
    }
  }

  /** The bucket the ID `buf[at .. at + length)` starts its probe at. */
  bucket(buf: u8[], at: i32, length: i32): i32 {
    let h: i64 = toI64(length)
    for (let k: i32 = 0; k < length && at + k >= 0 && at + k < toI32(buf.length); k++) {
      const j: i32 = k & 7
      const mixed: i64 = toI64(toI32(buf[at + k]) ^ toI32(this.salt[j]))
      h = (((h << 7) & toI64(0x3fffffffffff)) ^ (h >> 29) ^ mixed) & toI64(0x7fffffffffff)
    }
    h = h ^ (h >> 17) ^ (h >> 31)
    return toI32(h & toI64(toI32(this.table.length) - 1))
  }

  /** Whether entry `e` holds the ID `buf[at .. at + length)`. */
  holds(e: i32, buf: u8[], at: i32, length: i32): boolean {
    if (e < 0 || e >= toI32(this.lengths.length) || this.lengths[e] !== length) {
      return false
    }
    const base: i32 = e * QUIC_MAX_CID_LENGTH
    for (let k: i32 = 0; k < length; k++) {
      if (at + k < 0 || at + k >= toI32(buf.length) || this.keys[base + k] !== buf[at + k]) {
        return false
      }
    }
    return true
  }

  /** The slot owning the ID `buf[at .. at + length)`, or -1. */
  find(buf: u8[], at: i32, length: i32): i32 {
    const size: i32 = toI32(this.table.length)
    let h: i32 = this.bucket(buf, at, length)
    for (let probe: i32 = 0; probe < size && h >= 0 && h < size; probe++) {
      const e: i32 = this.table[h] - 1
      if (e < 0) {
        return -1
      }
      if (this.holds(e, buf, at, length)) {
        return e / H3_SERVER_KEYS
      }
      h = (h + 1) & (size - 1)
    }
    return -1
  }

  /** Files entry `e` as the ID `buf[at .. at + length)`; an ID already filed under another entry is left there. */
  insert(e: i32, buf: u8[], at: i32, length: i32): void {
    if (length <= 0 || length > QUIC_MAX_CID_LENGTH || e < 0 || e >= toI32(this.lengths.length)) {
      return
    }
    if (this.find(buf, at, length) >= 0) {
      return
    }
    const base: i32 = e * QUIC_MAX_CID_LENGTH
    for (let k: i32 = 0; k < length && at + k >= 0 && at + k < toI32(buf.length); k++) {
      this.keys[base + k] = buf[at + k]
    }
    this.lengths[e] = length
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

  /** Takes entry `e` out, moving later entries of its probe run back so none is lost. */
  remove(e: i32): void {
    if (e < 0 || e >= toI32(this.lengths.length) || this.lengths[e] === 0) {
      return
    }
    const size: i32 = toI32(this.table.length)
    const mask: i32 = size - 1
    const base: i32 = e * QUIC_MAX_CID_LENGTH
    let h: i32 = this.bucket(this.keys, base, this.lengths[e])
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
    this.lengths[e] = 0
    if (hole < 0) {
      return
    }
    let next: i32 = (hole + 1) & mask
    for (let probe: i32 = 0; probe < size && next >= 0 && next < size && hole >= 0 && hole < size; probe++) {
      const other: i32 = this.table[next] - 1
      if (other < 0) {
        break
      }
      const home: i32 = this.bucket(this.keys, other * QUIC_MAX_CID_LENGTH, this.lengths[other])
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
 * Slots filed by the millisecond of their next deadline: `head[b]` is a
 * bucket's first slot plus one, `nextOf` and `prevOf` link a bucket's slots,
 * and `bits` marks the buckets that hold any.
 */
export class Http3Wheel {
  head: i32[]
  nextOf: i32[]
  prevOf: i32[]
  /** The bucket a slot is filed in, or -1, and the deadline it was filed for. */
  bucketOf: i32[]
  dueAt: i64[]
  bits: i64[]
  /** Every bucket before this time has been run. */
  cursor: i64 = -1

  constructor(slots: i32) {
    this.head = new Array<i32>(H3_SERVER_WHEEL)
    this.nextOf = new Array<i32>(slots)
    this.prevOf = new Array<i32>(slots)
    this.bucketOf = new Array<i32>(slots)
    this.bucketOf.fill(-1)
    this.dueAt = new Array<i64>(slots)
    this.bits = new Array<i64>(H3_SERVER_WHEEL / 64)
  }

  /** Marks bucket `b` filled or not. */
  flag(b: i32, on: boolean): void {
    const word: i32 = b >> 6
    if (word < 0 || word >= toI32(this.bits.length)) {
      return
    }
    const bit: i64 = toI64(1) << toI64(b & 63)
    this.bits[word] = on ? this.bits[word] | bit : this.bits[word] & ~bit
  }

  /** Takes `slot` out of its bucket. */
  unfile(slot: i32): void {
    if (slot < 0 || slot >= toI32(this.bucketOf.length)) {
      return
    }
    const b: i32 = this.bucketOf[slot]
    if (b < 0 || b >= H3_SERVER_WHEEL) {
      return
    }
    const prev: i32 = this.prevOf[slot]
    const next: i32 = this.nextOf[slot]
    if (prev >= 0 && prev < toI32(this.nextOf.length)) {
      this.nextOf[prev] = next
    } else {
      this.head[b] = next + 1
    }
    if (next >= 0 && next < toI32(this.prevOf.length)) {
      this.prevOf[next] = prev
    }
    if (this.head[b] === 0) {
      this.flag(b, false)
    }
    this.bucketOf[slot] = -1
  }

  /** Files `slot` under `due`, kept inside the wheel's horizon from `now`; a negative `due` files nothing. */
  file(slot: i32, due: i64, now: i64): void {
    this.unfile(slot)
    if (due < 0 || slot < 0 || slot >= toI32(this.bucketOf.length)) {
      return
    }
    if (this.cursor < 0) {
      this.cursor = now
    }
    let at: i64 = due < this.cursor ? this.cursor : due
    const horizon: i64 = this.cursor + toI64(H3_SERVER_WHEEL - 1)
    if (at > horizon) {
      at = horizon
    }
    const b: i32 = http3ServerBucket(at)
    if (b < 0 || b >= H3_SERVER_WHEEL) {
      return
    }
    const first: i32 = this.head[b] - 1
    this.nextOf[slot] = first
    this.prevOf[slot] = -1
    if (first >= 0 && first < toI32(this.prevOf.length)) {
      this.prevOf[first] = slot
    }
    this.head[b] = slot + 1
    this.bucketOf[slot] = b
    this.dueAt[slot] = due
    this.flag(b, true)
  }

  /** The slot at the head of the bucket for `time`, taken out of it, or -1. */
  take(time: i64): i32 {
    const b: i32 = http3ServerBucket(time)
    const slot: i32 = b >= 0 && b < H3_SERVER_WHEEL ? this.head[b] - 1 : -1
    if (slot >= 0) {
      this.unfile(slot)
    }
    return slot
  }

  /** Milliseconds from `now` to the first filled bucket, at most the horizon, or -1 when none is. */
  next(now: i64): i32 {
    const from: i64 = this.cursor < 0 || this.cursor > now ? now : this.cursor
    const end: i64 = from + toI64(H3_SERVER_WHEEL)
    let time: i64 = from
    while (time < end) {
      const b: i32 = http3ServerBucket(time)
      const word: i32 = b >> 6
      if (word < 0 || word >= toI32(this.bits.length)) {
        return -1
      }
      if (this.bits[word] === 0) {
        // An empty word: on to the next one.
        time = time + toI64(64 - (b & 63))
      } else if (this.head[b] !== 0) {
        return time <= now ? H3_SERVER_ZERO : toI32(time - now)
      } else {
        time = time + 1
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
  quicConfig: QuicServerConfig
  listener: QuicListener
  quics: QuicConnection[]
  conns: Http3Connection[]
  index: Http3CidIndex
  wheel: Http3Wheel
  /** Each slot's client address, as its first datagram came from. */
  addresses: u8[][]
  /** What `receive` reads into, and where `flush` writes a flight. */
  rx: u8[]
  tx: u8[]
  from: u8[]
  meta: i32[]
  entropy: u8[]
  flight: QuicFlight
  /** Each slot's connection-ID index signature, so it is refiled only when its IDs changed. */
  signatures: i64[]
  state: i32[]
  /** The slots with datagrams for the program, a ring, and the slots with something to send, a stack. */
  readyRing: i32[]
  dirtyStack: i32[]
  /** Free slots, a stack. */
  free: i32[]
  /** Per slot: 1 while on the ready ring, 2 while on the dirty stack. */
  queued: i32[]
  fd: i32 = -1
  readyHead: i32 = 0
  readyCount: i32 = 0
  dirtyCount: i32 = 0
  freeCount: i32 = 0
  /** Counters for a log or a test, saturating: connections accepted, datagrams dropped for want of a slot, sends that failed. */
  accepted: i32 = 0
  refused: i32 = 0
  sendErrors: i32 = 0

  /**
   * A pool of `size` slots serving HTTP/3 under `config` over QUIC under
   * `quicConfig` on the UDP socket `fd`. `listenerEntropy` is the
   * listener's `QUIC_LISTENER_ENTROPY_SIZE` random bytes, whose first eight
   * also key the connection-ID index (wiped in the caller's array, as the
   * listener does). Every slot's connections are made here.
   */
  constructor(quicConfig: QuicServerConfig, config: Http3Config, fd: i32, size: i32, listenerEntropy: u8[]) {
    if (size < 1 || size > 65536) {
      panic(`Http3Server: ${size} slots, outside 1 to 65536`)
    }
    this.quicConfig = quicConfig
    this.fd = fd
    this.index = new Http3CidIndex(size, listenerEntropy)
    this.listener = new QuicListener(quicConfig, listenerEntropy)
    this.wheel = new Http3Wheel(size)
    this.quics = []
    this.conns = []
    this.addresses = []
    this.entropy = new Array<u8>(QUIC_CONN_ENTROPY_SIZE)
    for (let k: i32 = 0; k < size; k++) {
      crypto.getRandomValues(this.entropy)
      const quic = new QuicConnection(quicConfig, this.entropy)
      this.quics.push(quic)
      this.conns.push(new Http3Connection(config, quic))
      this.addresses.push(new Array<u8>(H3_SERVER_ADDRESS))
    }
    this.rx = new Array<u8>(H3_SERVER_RECEIVE_SIZE)
    this.tx = new Array<u8>(QUIC_LISTENER_FLIGHT_MAX * QUIC_CONN_DATAGRAM_SIZE)
    this.from = new Array<u8>(H3_SERVER_ADDRESS)
    this.meta = [H3_SERVER_ZERO, H3_SERVER_ZERO]
    this.flight = new QuicFlight()
    this.signatures = new Array<i64>(size)
    this.state = new Array<i32>(size)
    this.readyRing = new Array<i32>(size)
    this.dirtyStack = new Array<i32>(size)
    this.free = new Array<i32>(size)
    this.queued = new Array<i32>(size)
    for (let k: i32 = size - 1; k >= 0; k--) {
      this.free[this.freeCount] = k
      this.freeCount = this.freeCount + 1
    }
  }

  /** How many slots the pool has. */
  size(): i32 {
    return toI32(this.quics.length)
  }

  /** How many slots hold a connection. */
  busy(): i32 {
    return this.size() - this.freeCount
  }

  /** Whether `slot` holds a connection. */
  holds(slot: i32): boolean {
    return slot >= 0 && slot < toI32(this.state.length) && this.state[slot] === H3_SERVER_BUSY
  }

  /** The HTTP/3 connection of `slot`; a slot out of range names the first. */
  connection(slot: i32): Http3Connection {
    const at: i32 = slot >= 0 && slot < toI32(this.conns.length) ? slot : H3_SERVER_ZERO
    return this.conns[at]
  }

  /** The QUIC connection of `slot`; a slot out of range names the first. */
  quic(slot: i32): QuicConnection {
    const at: i32 = slot >= 0 && slot < toI32(this.quics.length) ? slot : H3_SERVER_ZERO
    return this.quics[at]
  }

  /** Puts `slot` on the ready ring and the dirty stack, unless it is on them. */
  touch(slot: i32): void {
    if (!this.holds(slot)) {
      return
    }
    if ((this.queued[slot] & 1) === 0 && this.readyCount < toI32(this.readyRing.length)) {
      const at: i32 = (this.readyHead + this.readyCount) % toI32(this.readyRing.length)
      this.readyRing[at] = slot
      this.readyCount = this.readyCount + 1
      this.queued[slot] = this.queued[slot] | 1
    }
    this.dirty(slot)
  }

  /** Puts `slot` on the dirty stack, for `flush`. */
  dirty(slot: i32): void {
    if ((this.queued[slot] & 2) === 0 && this.dirtyCount < toI32(this.dirtyStack.length)) {
      this.dirtyStack[this.dirtyCount] = slot
      this.dirtyCount = this.dirtyCount + 1
      this.queued[slot] = this.queued[slot] | 2
    }
  }

  /** The next slot with news for the program, or -1: call its connection's `next` until it has none. */
  ready(): i32 {
    while (this.readyCount > 0) {
      const slot: i32 = this.readyRing[this.readyHead]
      this.readyHead = (this.readyHead + 1) % toI32(this.readyRing.length)
      this.readyCount = this.readyCount - 1
      this.queued[slot] = this.queued[slot] & ~1
      if (this.holds(slot)) {
        return slot
      }
    }
    return -1
  }

  /**
   * Reads every datagram waiting on the socket, at most
   * `H3_SERVER_RECEIVE_BURST`, and hands each to its slot or the listener,
   * signing a handshake's CertificateVerify with `key` (ECDSA P-256) when one
   * asks. A GRO receive is cut into its datagrams in place. Answers how many
   * datagrams it read.
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
      if (n < 0) {
        return count
      }
      const segment: i32 = this.meta[0] > 0 ? this.meta[0] : n
      let at: i32 = 0
      while (at < n && segment > 0) {
        const length: i32 = n - at < segment ? n - at : segment
        this.datagram(this.rx, at, length, this.from, now, key)
        count = count + 1
        at = at + length
      }
    }
    return count
  }

  /**
   * One datagram, `buf[at .. at + len)`, from `address`: to the slot that
   * owns its first packet's Destination Connection ID, or to the listener.
   */
  datagram(buf: u8[], at: i32, len: i32, address: u8[], now: i64, key: Secret<u8[]>): void {
    if (len < 1 || at < 0 || at + len > toI32(buf.length)) {
      return
    }
    // RFC 8999: a long header carries the DCID's length; a short one is ours, of our length.
    let dcidAt: i32 = at + 1
    let dcidLength: i32 = QUIC_CONN_CID_LENGTH
    if ((toI32(buf[at]) & 0x80) !== 0) {
      if (len < 6) {
        return
      }
      dcidLength = toI32(buf[at + 5])
      dcidAt = at + 6
    }
    if (dcidLength > QUIC_MAX_CID_LENGTH || dcidAt + dcidLength > at + len) {
      return
    }
    const slot: i32 = this.index.find(buf, dcidAt, dcidLength)
    if (slot >= 0) {
      this.serve(slot, buf, at, len, now, key)
      return
    }
    this.unowned(buf, at, len, address, now, key)
  }

  /** A datagram no slot owns: the listener decides, and may make a connection in a free slot. */
  unowned(buf: u8[], at: i32, len: i32, address: u8[], now: i64, key: Secret<u8[]>): void {
    const datagram: u8[] = new Array<u8>(len)
    for (let k: i32 = 0; k < len; k++) {
      datagram[k] = buf[at + k]
    }
    const answer: QuicListenerAnswer = this.listener.handle(datagram, address, now)
    if (answer.kind !== QUIC_LISTEN_ACCEPT) {
      const reply: i32 = toI32(answer.reply.length)
      if (reply > 0) {
        this.send(answer.reply, H3_SERVER_ZERO, reply, address, H3_SERVER_ZERO)
      }
      return
    }
    if (this.freeCount <= 0) {
      this.refused = http3ServerCount(this.refused)
      return
    }
    this.freeCount = this.freeCount - 1
    const slot: i32 = this.free[this.freeCount]
    crypto.getRandomValues(this.entropy)
    const quic: QuicConnection = this.quics[slot]
    quic.reset(this.entropy)
    this.conns[slot].restart()
    if (answer.retried) {
      quic.acceptRetry(answer.originalDcid, answer.retryScid)
    }
    const to: u8[] = this.addresses[slot]
    for (let k: i32 = 0; k < H3_SERVER_ADDRESS && k < toI32(address.length); k++) {
      to[k] = address[k]
    }
    this.state[slot] = H3_SERVER_BUSY
    this.signatures[slot] = H3_SERVER_NONE
    this.accepted = http3ServerCount(this.accepted)
    this.serve(slot, buf, at, len, now, key)
  }

  /** Hands `slot`'s connection a datagram, signs when the handshake asks, and refiles its IDs and timer. */
  serve(slot: i32, buf: u8[], at: i32, len: i32, now: i64, key: Secret<u8[]>): void {
    const quic: QuicConnection = this.quics[slot]
    quic.receiveWindow(buf, at, len, now)
    const input: u8[] | null = quic.signatureInput()
    if (input !== null) {
      const signature: u8[] | null = tlsSignEcdsaP256(key, input)
      if (signature !== null) {
        quic.sign(signature)
      }
    }
    if (quic.state === QUIC_STATE_CONNECTED && quic.alpn !== H3_ALPN) {
      quic.fail(H3_SERVER_NO_ALPN, toI64(0))
    }
    this.refile(slot)
    this.touch(slot)
  }

  /** Files `slot`'s connection IDs in the index again when they changed. */
  refile(slot: i32): void {
    const quic: QuicConnection = this.quics[slot]
    const signature: i64 =
      (quic.cids.nextLocal << 16) |
      (toI64(quic.cids.activeLocal()) << 8) |
      (toI64(quic.originalDcidLength) << 1) |
      (quic.handshakeComplete ? toI64(1) : toI64(0))
    if (signature === this.signatures[slot]) {
      return
    }
    this.signatures[slot] = signature
    const first: i32 = slot * H3_SERVER_KEYS
    for (let j: i32 = 0; j < H3_SERVER_KEYS; j++) {
      this.index.remove(first + j)
    }
    for (let j: i32 = 0; j < QUIC_CONN_LOCAL_CIDS && j < toI32(quic.cids.local.length); j++) {
      const entry = quic.cids.local[j]
      if (entry.used) {
        this.index.insert(first + j, entry.cid, H3_SERVER_ZERO, entry.length)
      }
    }
    if (!quic.handshakeComplete && quic.originalDcidLength > 0) {
      this.index.insert(
        first + QUIC_CONN_LOCAL_CIDS,
        quic.originalDcid,
        H3_SERVER_ZERO,
        quic.originalDcidLength
      )
    }
  }

  /** Sends `buf[at .. at + len)` to `to`, cut into `segment`-byte datagrams when it is above 0; answers whether it went. */
  send(buf: u8[], at: i32, len: i32, to: u8[], segment: i32): boolean {
    const sent: i32 = udpSendTo(this.fd, buf, at, len, to, segment, H3_SERVER_ZERO)
    if (sent >= 0) {
      return true
    }
    if (sent !== H3_SERVER_NO_GSO || segment <= 0) {
      this.sendErrors = http3ServerCount(this.sendErrors)
      return false
    }
    // No segmentation offload here: one datagram at a time.
    let p: i32 = at
    while (p < at + len) {
      const n: i32 = at + len - p < segment ? at + len - p : segment
      if (udpSendTo(this.fd, buf, p, n, to, H3_SERVER_ZERO, H3_SERVER_ZERO) < 0) {
        this.sendErrors = http3ServerCount(this.sendErrors)
        return false
      }
      p = p + n
    }
    return true
  }

  /**
   * Sends what every touched slot has, as far as its pacer lets it, closes a
   * slot whose HTTP/3 side is done after GOAWAY, frees a slot whose
   * connection has closed, and files each in the wheel under its next
   * deadline.
   */
  flush(now: i64): void {
    while (this.dirtyCount > 0) {
      this.dirtyCount = this.dirtyCount - 1
      const slot: i32 = this.dirtyStack[this.dirtyCount]
      this.queued[slot] = this.queued[slot] & ~2
      if (this.holds(slot)) {
        this.flushSlot(slot, now)
      }
    }
  }

  /** `flush` of one slot. */
  flushSlot(slot: i32, now: i64): void {
    const quic: QuicConnection = this.quics[slot]
    if (this.conns[slot].isDone() && !quic.closed()) {
      quic.close(H3_NO_ERROR)
    }
    const to: u8[] = this.addresses[slot]
    for (let guard: i32 = 0; guard < 64; guard++) {
      const n: i32 = quicListenerTakeFlight(
        quic,
        now,
        this.tx,
        H3_SERVER_ZERO,
        toI32(this.tx.length),
        this.flight
      )
      if (n <= 0) {
        break
      }
      const segment: i32 = this.flight.count > 1 ? this.flight.segment : H3_SERVER_ZERO
      if (!this.send(this.tx, H3_SERVER_ZERO, n, to, segment)) {
        break
      }
    }
    if (quic.closed()) {
      this.release(slot)
      return
    }
    this.refile(slot)
    let due: i64 = quic.deadline()
    const pace: i32 = toI32(quicListenerPaceTime(quic, now))
    if (pace > 0 && (due < 0 || now + toI64(pace) < due)) {
      due = now + toI64(pace)
    }
    this.wheel.file(slot, due, now)
  }

  /** Frees `slot`: its IDs leave the index and its timer the wheel. */
  release(slot: i32): void {
    const first: i32 = slot * H3_SERVER_KEYS
    for (let j: i32 = 0; j < H3_SERVER_KEYS; j++) {
      this.index.remove(first + j)
    }
    this.wheel.unfile(slot)
    this.quics[slot].release()
    this.state[slot] = H3_SERVER_FREE
    if (this.freeCount < toI32(this.free.length)) {
      this.free[this.freeCount] = slot
      this.freeCount = this.freeCount + 1
    }
  }

  /** Runs the timers due by `now`, and marks each slot it ran for `flush`. */
  tick(now: i64): void {
    const wheel: Http3Wheel = this.wheel
    if (wheel.cursor < 0) {
      wheel.cursor = now
    }
    let steps: i32 = 0
    while (wheel.cursor <= now && steps < H3_SERVER_WHEEL) {
      let slot: i32 = wheel.take(wheel.cursor)
      while (slot >= 0) {
        if (this.holds(slot)) {
          if (wheel.dueAt[slot] > now) {
            // Filed at the horizon: not due yet, so filed again.
            wheel.file(slot, wheel.dueAt[slot], now)
          } else {
            this.quics[slot].handleTimer(now)
            this.dirty(slot)
          }
        }
        slot = wheel.take(wheel.cursor)
      }
      wheel.cursor = wheel.cursor + 1
      steps++
    }
    if (wheel.cursor <= now) {
      wheel.cursor = now + 1
    }
  }

  /** Milliseconds until `tick` has a timer to run, for `pollWait`; -1 when no slot has one. */
  timeout(now: i64): i32 {
    return this.wheel.next(now)
  }
}

