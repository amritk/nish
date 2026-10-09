/**
 * The relay: WebTransport datagrams in, UDP out, one upstream socket per
 * session. A port of the session half of cs's `services/relay/src/main.rs`
 * (`Limits`, `SessionSlot`, `serve` and `pump`) onto `nish/net/http3-server`
 * and `nish/net/webtransport`, with the same caps, timeouts, close codes and
 * reasons.
 *
 *     const relay = new Relay(config, quicConfig, fd, verifier, entropy);
 *     // each time round the loop, `now` monotonic and `wall` Unix, both milliseconds:
 *     const signalled: boolean = relay.step(now, wall, key, grantKey, relay.timeout(now));
 *
 * **A session** is one QUIC connection carrying one WebTransport session on
 * `config.path`, and is counted against both caps the moment its first
 * Initial takes a slot, as main.rs claims its global place before the
 * handshake: at most `maxPerPeer` from one address, claimed first, and at
 * most `maxSessions` at once, given only to a connection inside its
 * address's cap. The pool has `spareSlots` QUIC slots past `maxSessions`, so
 * a client over either cap is still told why — its session is accepted, sent
 * CLOSE RATE_LIMITED and closed with QUIC application code 1 — rather than
 * dropped; at most `spareSlots` connections over their address's cap wait so
 * at once, and one past that is closed with code 1 at its first Initial, so
 * one address holds at most `maxPerPeer + spareSlots` slots. A connection that has opened no session `helloTimeout` after its
 * first Initial is closed with code 1, so a handshake alone holds neither
 * place for longer. Then the session has `helloTimeout` to send a HELLO carrying a
 * grant (`grant.ts`); a first datagram that is not one, another version, a
 * grant that does not verify, or an upstream that cannot be reached is
 * answered with CLOSE and the code grant.rs or main.rs gives it. A HELLO that
 * holds opens the upstream socket and answers HELLO_OK, and from then on DATA
 * is forwarded both ways, PING answered with PONG, and STATS sent every
 * `statsInterval`; a CLOSE from the client, a CLOSE_WEBTRANSPORT_SESSION or
 * the end of its CONNECT stream ends it, and so do `idleTimeout` without a
 * datagram (CLOSE IDLE) and more than `maxDatagramsPerSecond` in a one-second
 * window (CLOSE RATE_LIMITED). Every end closes the QUIC connection: code 0
 * after a session, 1 after a refusal, as main.rs's `connection.close`.
 *
 * **Time** is two numbers the caller passes in, so a test drives them: `now`,
 * a monotonic millisecond the timers run on, and `wall`, the Unix millisecond
 * a grant's expiry is compared with.
 *
 * **Memory.** Every table is made by the constructor from the caps: the
 * Http3Server's slots, a `WebTransport` per slot, each slot's session state
 * in arrays, the per-peer table (`peers.ts`), the timer wheel, and one
 * receive buffer, one frame buffer and one GSO batch shared by every session,
 * which the single loop makes safe. A datagram, a timer and a session's
 * whole life, its handshake included, keep nothing after warm-up
 * (`tests/link/net_relay_soak`: 0 bytes over 100,000 sessions).
 *
 * **Offload.** The client side is the carrier's: GRO on the socket, a GSO
 * flight a send. With `config.offload`, each upstream socket asks for GRO
 * (one read may be several datagrams, cut at the segment size as offload.rs
 * cuts them), and the DATA a client sends in one pass, while it is the same
 * size, leaves in one GSO send; without it, one datagram a call, as main.rs.
 */
import {
  netAddress,
  netClose,
  pollAdd,
  pollCreate,
  pollRemove,
  pollWait,
  udpBind,
  udpRecvFrom,
  udpSendTo,
} from "nish:net"
import { monotonicNanos } from "nish:process"
import { write } from "nish:io"
import { Secret } from "nish:secret"
import { H3_ALPN, H3_ERROR, H3_NEED_MORE, H3_REQUEST, Http3Config } from "nish/net/http3"
import { h3Count } from "nish/net/http3-frame"
import { Http3Server, Http3Wheel, H3_SERVER_WHEEL } from "nish/net/http3-server"
import { QuicServerConfig } from "nish/net/quic"
import { quicPacketCopy } from "nish/net/quic-packet"
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec"
import {
  WT_CLOSED,
  WT_DATAGRAM,
  WT_SESSION,
  WT_STREAM,
  WebTransport,
  WebTransportConfig,
} from "nish/net/webtransport"
import {
  CLOSE_IDLE,
  CLOSE_PROTOCOL_ERROR,
  CLOSE_RATE_LIMITED,
  CLOSE_SHUTDOWN,
  CLOSE_UPSTREAM_UNREACHABLE,
  MAX_PAYLOAD_BYTES,
  RELAY_CLOSE,
  RELAY_DATA,
  RELAY_HELLO,
  RELAY_PING,
  RELAY_PROTOCOL_VERSION,
  RELAY_U32,
  RelayFrame,
  relayDecode,
  relayEncodeClose,
  relayEncodeData,
  relayEncodeHelloOk,
  relayEncodePong,
  relayEncodeStats,
} from "./frame"
import { GRANT_OK, GrantVerifier, RelayGrant } from "./grant"
import { RELAY_PEER_KEY, RelayPeers } from "./peers"

/** QUIC's idle timeout, main.rs's `max_idle_timeout`. */
export const RELAY_QUIC_IDLE: i64 = 30000

/**
 * main.rs's QUIC keep-alive interval. The QUIC layer here sends no PING of
 * its own, so the relay keeps the path warm itself: an accepted session sends
 * STATS every `statsInterval` (2 s), an ack-eliciting datagram, and the time
 * before it is the hello's 5 s; `RelayConfig` refuses a stats interval past
 * this.
 */
export const RELAY_KEEP_ALIVE: i64 = 3000

/** The poll tokens: the client socket, the signal descriptor, then each slot's upstream socket from 2. */
export const RELAY_TOKEN_CLIENT: i32 = 0
export const RELAY_TOKEN_SIGNAL: i32 = 1
export const RELAY_TOKEN_UPSTREAM: i32 = 2

/** A session's states. */
export const RELAY_FREE: i32 = 0
/** The QUIC handshake, or a connection with no session yet. */
export const RELAY_CONNECTING: i32 = 1
/** Accepted, waiting for its HELLO. */
export const RELAY_HELLO_WAIT: i32 = 2
/** Forwarding. */
export const RELAY_PUMPING: i32 = 3
/** Closed by the relay; the QUIC slot is on its way back to the pool. */
export const RELAY_CLOSING: i32 = 4

/** main.rs's caps and timeouts, as start-up numbers. */
export class RelayConfig {
  /** How long an accepted session may go without its HELLO, ms. */
  helloTimeout: i64 = 5000
  /** How long a session may go without a datagram from its client, ms. */
  idleTimeout: i64 = 10000
  /** How often STATS goes to each session, and the idle timeout is checked, ms. */
  statsInterval: i64 = 2000
  /** Sessions at once, across every client. */
  maxSessions: i32 = 4096
  /** Sessions one remote address may hold at once. */
  maxPerPeer: i32 = 64
  /** Datagrams a session may send in a one-second window. */
  maxDatagramsPerSecond: i32 = 256
  /** QUIC slots past `maxSessions`, so that a client over a cap is told so. */
  spareSlots: i32 = 64
  /** The WebTransport path sessions are taken on; any other is answered 404. */
  path: string = "/cs"
  /** GRO on each upstream socket and GSO for each pass's DATA (offload.rs's `--offload`). */
  offload: boolean = false
  /** Whether each session's start and end is logged on stdout, as main.rs logs them. */
  verbose: boolean = true
}

/** Panics unless `value` lies in `[low, high]`: a cap out of range is the program's mistake. */
const relayCheck = (what: string, value: i64, low: i64, high: i64): void => {
  if (value < low || value > high) {
    panic(`Relay: ${what} of ${value}, outside ${low} to ${high}`)
  }
}

/**
 * The QUIC configuration the relay serves with: HTTP/3, DATAGRAM frames up
 * to 1,500 bytes, QUIC's 30-second idle timeout, and streams cut to what a
 * datagram-only WebTransport session needs (the CONNECT stream, and HTTP/3's
 * three unidirectional streams each way), so 4,096 slots stay small.
 */
export const relayQuicConfig = (chain: u8[][], resetKey: u8[], retryKey: u8[]): QuicServerConfig => ({
  certificateChain: chain,
  alpn: [H3_ALPN],
  signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
  retry: false,
  maxData: toI64(16384),
  maxStreamData: toI64(2048),
  maxStreamsBidi: toI64(2),
  maxStreamsUni: toI64(4),
  localStreams: toI64(3),
  maxDatagramFrameSize: toI64(1500),
  maxIdleTimeout: RELAY_QUIC_IDLE,
  activeConnectionIdLimit: toI64(4),
  retryTokenLifetime: toI64(10000),
  statelessResetKey: resetKey,
  retryTokenKey: retryKey,
})

/** The HTTP/3 configuration: one WebTransport session a connection, and a field section a CONNECT fits. */
export const relayH3Config = (): Http3Config => {
  const config = new Http3Config()
  config.maxFieldSectionSize = 1000
  config.bodyChunk = 1024
  config.writeChunk = 1024
  config.webtransportSessions = 1
  return config
}

/** `n` plus one, stopping at a u32's top: a STATS counter, which the frame writes in 32 bits. */
const relayCount32 = (n: i64): i64 => (n < RELAY_U32 ? n + 1 : RELAY_U32)

/** Typed constants, since a bare literal handed to a method is an `f64` under `--number-mode f64`. */
const RELAY_ZERO: i32 = 0
const RELAY_NONE: i32 = -1
const RELAY_NONE64: i64 = -1
const RELAY_QUIC_NO_ERROR: i64 = 0
const RELAY_QUIC_REFUSED: i64 = 1
const RELAY_NOT_FOUND: i32 = 404
const RELAY_ADDRESS: i32 = 18
/** How often a slot with nothing timed is looked at again, to notice its connection has gone, ms. */
const RELAY_RECHECK: i64 = 1000
/** The most datagrams one GSO send carries, and the most one upstream readiness reads. */
const RELAY_BATCH: i32 = 64
/** What a read without GRO is handed, as main.rs's 2 kB; with GRO, the kernel's ceiling. */
const RELAY_READ_PLAIN: i32 = 2048
const RELAY_READ_COALESCED: i32 = 65536
/** What `udpSendTo` answers where the platform has no segmentation offload. */
const RELAY_NO_GSO: i32 = -95

/** The relay's sessions, their caps and timers, over one `Http3Server`. */
export class Relay {
  config: RelayConfig
  server: Http3Server
  wts: WebTransport[]
  verifier: GrantVerifier
  peers: RelayPeers
  wheel: Http3Wheel
  /** What the readiness loop answers. */
  ready: i32[]
  // Per slot.
  states: i32[]
  /** The `Http3Connection.generation` the slot's state belongs to. */
  generations: i32[]
  /** Whether the slot holds a place in `maxSessions`, and one in `peers` under the address kept in `peerAddresses`. */
  counted: boolean[]
  peerHeld: boolean[]
  peerAddresses: u8[][]
  /** Whether the slot holds neither place, and counts against `spareSlots` while it waits to be told why. */
  unplaced: boolean[]
  /** The relay's id for the session, for its log and HELLO_OK, and its CONNECT stream. */
  ids: i64[]
  sessions: i64[]
  /** When a connection with no session yet is closed: its first Initial plus `helloTimeout`. */
  connectBy: i64[]
  /** When its client was last heard, and its rate window's start and count. */
  lastHeard: i64[]
  windowStart: i64[]
  windowCount: i32[]
  /** The datagrams each way since the last STATS, for STATS. */
  fromClient: i64[]
  fromUpstream: i64[]
  /** The next downstream DATA's sequence number. */
  seqs: i32[]
  /** The upstream socket, or -1, and the address the grant named. */
  upstreams: i32[]
  upstreamAddresses: u8[][]
  /** The QUIC application code a slot closes with once its CLOSE is out. */
  closeCodes: i64[]
  /** Slots whose QUIC close waits for the next flush. */
  pending: i32[]
  /** Slots this step served, looked at again after its flush: a slot freed by that flush gives its places back at once. */
  served: i32[]
  // Shared by every session: the single loop is what makes that safe.
  frame: RelayFrame
  grant: RelayGrant
  /** One frame being written, one upstream read, and a GSO batch for one session. */
  out: u8[]
  rx: u8[]
  from: u8[]
  meta: i32[]
  batch: u8[]
  /** The last id handed out. */
  nextId: i64 = 0
  /** The monotonic microsecond the current step began: PING's dwell is measured from it. */
  stepMicros: i64 = 0
  /** The readiness loop the relay waits in. */
  loop: i32 = -1
  pendingCount: i32 = 0
  servedCount: i32 = 0
  /** The GSO batch's session, its bytes, its segment size and its datagrams. */
  batchSlot: i32 = -1
  batchLength: i32 = 0
  batchSegment: i32 = 0
  batchCount: i32 = 0
  /** Sessions holding a place in `maxSessions`, and slots holding neither place (`unplaced`). */
  live: i32 = 0
  unplacedCount: i32 = 0
  /** Counters for a log or a test, each saturating. */
  accepted: i32 = 0
  refusedFull: i32 = 0
  refusedPeer: i32 = 0
  refusedPath: i32 = 0
  refusedHello: i32 = 0
  refusedGrant: i32 = 0
  refusedUpstream: i32 = 0
  helloTimeouts: i32 = 0
  connectTimeouts: i32 = 0
  /** Connections closed at their first Initial: over their address's cap with every spare slot already waiting. */
  shed: i32 = 0
  idleClosed: i32 = 0
  rateLimited: i32 = 0
  clientClosed: i32 = 0
  disconnected: i32 = 0
  forwardedUp: i32 = 0
  forwardedDown: i32 = 0
  oversized: i32 = 0
  droppedDown: i32 = 0
  foreign: i32 = 0
  badFrames: i32 = 0
  gsoSends: i32 = 0
  groReads: i32 = 0

  /**
   * The relay on the UDP socket `fd`, already bound, serving under
   * `quicConfig` (`relayQuicConfig`) and checking grants with `verifier`.
   * `entropy` is the listener's `QUIC_LISTENER_ENTROPY_SIZE` random bytes;
   * its first eight also key the per-peer table. A cap out of range panics.
   */
  constructor(
    config: RelayConfig,
    quicConfig: QuicServerConfig,
    fd: i32,
    verifier: GrantVerifier,
    entropy: u8[]
  ) {
    relayCheck("maxSessions", toI64(config.maxSessions), 1, 65536)
    relayCheck("spareSlots", toI64(config.spareSlots), 0, 4096)
    relayCheck("maxSessions + spareSlots", toI64(config.maxSessions) + toI64(config.spareSlots), 1, 65536)
    relayCheck("maxPerPeer", toI64(config.maxPerPeer), 1, toI64(config.maxSessions))
    relayCheck("maxDatagramsPerSecond", toI64(config.maxDatagramsPerSecond), 1, 1000000)
    relayCheck("helloTimeout", config.helloTimeout, 1, RELAY_QUIC_IDLE)
    relayCheck("idleTimeout", config.idleTimeout, 1, RELAY_QUIC_IDLE)
    relayCheck("statsInterval", config.statsInterval, 1, RELAY_KEEP_ALIVE)
    if (toI32(config.path.length) < 1 || toI32(config.path.charCodeAt(0)) !== 0x2f) {
      panic(`Relay: the path "${config.path}" does not start with /`)
    }
    this.config = config
    const slots: i32 = config.maxSessions + config.spareSlots
    // The listener's entropy is wiped by its constructor, so the peer table is keyed first.
    this.peers = new RelayPeers(slots * 2, entropy)
    this.server = new Http3Server(quicConfig, relayH3Config(), fd, slots, entropy)
    this.verifier = verifier
    this.wheel = new Http3Wheel(slots)
    const wtConfig = new WebTransportConfig()
    wtConfig.maxStreams = 1
    wtConfig.maxPending = 0
    this.wts = []
    this.upstreamAddresses = []
    this.peerAddresses = []
    for (let k: i32 = 0; k < slots; k++) {
      this.wts.push(new WebTransport(wtConfig, this.server.connection(k)))
      this.upstreamAddresses.push(new Array<u8>(RELAY_ADDRESS))
      this.peerAddresses.push(new Array<u8>(RELAY_PEER_KEY))
    }
    this.states = new Array<i32>(slots)
    this.generations = new Array<i32>(slots)
    this.counted = new Array<boolean>(slots)
    this.peerHeld = new Array<boolean>(slots)
    this.unplaced = new Array<boolean>(slots)
    this.ids = new Array<i64>(slots)
    this.sessions = new Array<i64>(slots)
    this.sessions.fill(RELAY_NONE64)
    this.connectBy = new Array<i64>(slots)
    this.lastHeard = new Array<i64>(slots)
    this.windowStart = new Array<i64>(slots)
    this.windowCount = new Array<i32>(slots)
    this.fromClient = new Array<i64>(slots)
    this.fromUpstream = new Array<i64>(slots)
    this.seqs = new Array<i32>(slots)
    this.upstreams = new Array<i32>(slots)
    this.upstreams.fill(RELAY_NONE)
    this.closeCodes = new Array<i64>(slots)
    this.pending = new Array<i32>(slots)
    this.served = new Array<i32>(slots)
    this.frame = new RelayFrame()
    this.grant = new RelayGrant()
    this.out = new Array<u8>(MAX_PAYLOAD_BYTES + 64)
    this.rx = new Array<u8>(RELAY_READ_COALESCED)
    this.from = new Array<u8>(RELAY_ADDRESS)
    this.meta = [RELAY_ZERO, RELAY_ZERO]
    this.batch = new Array<u8>(RELAY_BATCH * MAX_PAYLOAD_BYTES)
    this.loop = pollCreate()
    if (this.loop < 0) {
      panic(`Relay: pollCreate answered ${this.loop}`)
    }
    this.ready = new Array<i32>(2 * RELAY_BATCH)
    pollAdd(this.loop, fd, 1, RELAY_TOKEN_CLIENT)
  }

  /** Watches the signal descriptor `fd` (`signalFd()`) in the relay's loop: `step` answers true once it is readable. */
  watchSignals(fd: i32): void {
    pollAdd(this.loop, fd, 1, RELAY_TOKEN_SIGNAL)
  }

  /** How many QUIC slots the relay has. */
  size(): i32 {
    return toI32(this.states.length)
  }

  /** A line of the relay's log, when it is verbose. */
  log(line: string): void {
    if (this.config.verbose) {
      write(`[relay] ${line}\n`)
    }
  }

  // ---- The loop ---------------------------------------------------------------------

  /**
   * One turn of the loop: waits up to `waitMs` (0 does not wait, negative
   * forever) for a socket or a signal, then reads every upstream that is
   * ready, every client datagram (signing a handshake with `key`; a HELLO's
   * grant is checked against `grantKey`), runs the
   * QUIC and relay timers, serves every slot with news and sends what all of
   * it produced. Answers whether a signal arrived.
   */
  step(now: i64, wall: i64, key: Secret<u8[]>, grantKey: Secret<u8[]>, waitMs: i32): boolean {
    this.stepMicros = monotonicNanos() / 1000
    const n: i32 = pollWait(this.loop, this.ready, waitMs)
    let signalled: boolean = false
    for (let k: i32 = 0; k < n && 2 * k < toI32(this.ready.length); k++) {
      const token: i32 = this.ready[2 * k]
      if (token === RELAY_TOKEN_SIGNAL) {
        signalled = true
      } else if (token >= RELAY_TOKEN_UPSTREAM) {
        this.upstreamReady(token - RELAY_TOKEN_UPSTREAM)
      }
    }
    this.server.receive(now, key)
    this.server.tick(now)
    this.timers(now)
    let slot: i32 = this.server.ready()
    while (slot >= 0) {
      this.serveSlot(slot, now, wall, grantKey)
      slot = this.server.ready()
    }
    this.flush(now)
    return signalled
  }

  /** Milliseconds until the relay or a connection has a timer due, for `step`'s wait; -1 for none. */
  timeout(now: i64): i32 {
    const quic: i32 = this.server.timeout(now)
    const own: i32 = this.wheel.next(now)
    if (quic < 0) {
      return own
    }
    return own >= 0 && own < quic ? own : quic
  }

  /** Sends what every slot has, then closes the slots whose CLOSE frame went out, and sends their CONNECTION_CLOSE. */
  flush(now: i64): void {
    this.server.flush(now)
    if (this.pendingCount > 0) {
      while (this.pendingCount > 0) {
        this.pendingCount = this.pendingCount - 1
        const slot: i32 = this.pending[this.pendingCount]
        if (this.server.holds(slot)) {
          this.server.quic(slot).close(this.closeCodes[slot])
          this.server.touch(slot)
        }
      }
      this.server.flush(now)
    }
    // `Http3Server` frees a slot inside `flush` and says nothing; a slot it
    // freed was one this step touched, so looking at those is enough, and
    // costs what the step's own work did. A connection that times out on its
    // own is noticed by the slot's next relay timer instead.
    while (this.servedCount > 0) {
      this.servedCount = this.servedCount - 1
      this.reconcile(this.served[this.servedCount], now)
    }
  }

  /** Closes every session with CLOSE SHUTDOWN, as a clean stop on a signal does, and sends it all. */
  shutdown(now: i64): void {
    for (let slot: i32 = 0; slot < this.size(); slot++) {
      const state: i32 = this.states[slot]
      if (state === RELAY_HELLO_WAIT || state === RELAY_PUMPING) {
        this.close(slot, CLOSE_SHUTDOWN, "the relay is shutting down", RELAY_QUIC_NO_ERROR, now)
      } else if (state === RELAY_CONNECTING) {
        this.close(slot, RELAY_NONE, "", RELAY_QUIC_NO_ERROR, now)
      }
    }
    this.flush(now)
  }

  // ---- A slot's life ----------------------------------------------------------------

  /**
   * Brings `slot`'s relay state up to its connection's: a slot whose
   * connection has gone gives its places back, and one holding a new
   * connection takes them (or is marked over the global cap). Called whenever
   * the slot has news and whenever its timer fires, so a connection the
   * carrier freed is noticed within `RELAY_RECHECK`.
   */
  reconcile(slot: i32, now: i64): void {
    const generation: i32 = this.server.connection(slot).generation
    const holds: boolean = this.server.holds(slot)
    if (generation === this.generations[slot] && (holds || this.states[slot] === RELAY_FREE)) {
      return
    }
    if (this.states[slot] !== RELAY_FREE) {
      this.release(slot)
      this.states[slot] = RELAY_FREE
    }
    this.generations[slot] = generation
    if (!holds) {
      return
    }
    this.states[slot] = RELAY_CONNECTING
    this.nextId = this.nextId < RELAY_U32 ? this.nextId + 1 : 1
    this.ids[slot] = this.nextId
    this.sessions[slot] = RELAY_NONE64
    // A connection that never opens a session goes at the hello deadline, counted from here.
    this.connectBy[slot] = now + this.config.helloTimeout
    // Both places are claimed before the handshake is done, the address's first: a global place goes only
    // to a connection inside its address's cap, so handshakes alone from one address hold at most
    // `maxPerPeer` of them. The slot keeps its own copy of the address, which `release` gives back by.
    const peer: u8[] = this.peerAddresses[slot]
    const from: u8[] = this.server.addresses[slot]
    for (let k: i32 = 0; k < RELAY_PEER_KEY && k < toI32(from.length) && k < toI32(peer.length); k++) {
      peer[k] = from[k]
    }
    this.peerHeld[slot] = this.peers.claim(peer, this.config.maxPerPeer)
    this.counted[slot] = this.peerHeld[slot] && this.live < this.config.maxSessions
    if (this.counted[slot]) {
      this.live = this.live + 1
    }
    if (!this.peerHeld[slot]) {
      // Over its address's cap: it may wait in a spare slot to be told why, but no more of them wait than
      // there are spare slots, so one address holds at most `maxPerPeer + spareSlots` slots.
      if (this.unplacedCount >= this.config.spareSlots) {
        this.shed = h3Count(this.shed)
        this.close(slot, RELAY_NONE, "", RELAY_QUIC_REFUSED, now)
        return
      }
      this.unplaced[slot] = true
      this.unplacedCount = this.unplacedCount + 1
    }
    this.wheel.file(slot, this.recheck(slot, now), now)
  }

  /** When a connecting slot is looked at next: in `RELAY_RECHECK`, or at its deadline if that is sooner. */
  recheck(slot: i32, now: i64): i64 {
    const next: i64 = now + RELAY_RECHECK
    return this.connectBy[slot] < next ? this.connectBy[slot] : next
  }

  /** Gives back what `slot` holds: its place in both caps, its upstream socket and its timer. */
  release(slot: i32): void {
    if (this.counted[slot]) {
      this.counted[slot] = false
      this.live = this.live - 1
    }
    if (this.unplaced[slot]) {
      this.unplaced[slot] = false
      this.unplacedCount = this.unplacedCount - 1
    }
    if (this.peerHeld[slot]) {
      // The slot's own copy of its address: by now the carrier may have handed the slot to another client.
      this.peers.release(this.peerAddresses[slot])
      this.peerHeld[slot] = false
    }
    const fd: i32 = this.upstreams[slot]
    if (fd >= 0) {
      pollRemove(this.loop, fd)
      netClose(fd)
      this.upstreams[slot] = RELAY_NONE
    }
    if (this.batchSlot === slot) {
      this.batchSlot = RELAY_NONE
      this.batchCount = 0
      this.batchLength = 0
    }
    this.wheel.unfile(slot)
  }

  /**
   * Ends `slot`'s session: a CLOSE frame with `code` and `reason` when `code`
   * is not -1 and the session was accepted, then, once that has been sent,
   * the QUIC connection closed with application code `quicCode`.
   */
  close(slot: i32, code: i32, reason: string, quicCode: i64, now: i64): void {
    const state: i32 = this.states[slot]
    if (state === RELAY_FREE || state === RELAY_CLOSING) {
      return
    }
    this.flushBatch()
    const session: i64 = this.sessions[slot]
    if (code >= 0 && session >= 0) {
      const n: i32 = relayEncodeClose(this.out, RELAY_ZERO, code, reason)
      if (n > 0) {
        this.wts[slot].sendDatagram(session, this.out, RELAY_ZERO, n)
      }
    }
    this.release(slot)
    this.states[slot] = RELAY_CLOSING
    this.closeCodes[slot] = quicCode
    if (this.pendingCount < toI32(this.pending.length)) {
      this.pending[this.pendingCount] = slot
      this.pendingCount = this.pendingCount + 1
    }
    this.server.touch(slot)
    // Looked at again until the carrier has freed the slot.
    this.wheel.file(slot, now + RELAY_RECHECK, now)
    if (this.config.verbose) {
      // The line dies here: a session's end allocates nothing that outlives it.
      using a = arena()
      this.log(`session ${this.ids[slot]} closed (${code}${reason.length > 0 ? `, ${reason}` : ""})`)
    }
  }

  /** Every event `slot`'s connection has, handled. */
  serveSlot(slot: i32, now: i64, wall: i64, grantKey: Secret<u8[]>): void {
    this.reconcile(slot, now)
    if (this.servedCount < toI32(this.served.length)) {
      this.served[this.servedCount] = slot
      this.servedCount = this.servedCount + 1
    }
    const wt: WebTransport = this.wts[slot]
    let event: i32 = wt.next()
    for (let guard: i32 = 0; guard < 100000 && event !== H3_NEED_MORE && event !== H3_ERROR; guard++) {
      if (event === WT_DATAGRAM) {
        const state: i32 = this.states[slot]
        if (state === RELAY_PUMPING) {
          this.pump(slot, wt, now)
        } else if (state === RELAY_HELLO_WAIT) {
          this.hello(slot, wt, now, wall, grantKey)
        }
      } else if (event === WT_SESSION) {
        this.session(slot, wt, now)
      } else if (event === WT_CLOSED) {
        if (wt.sessionId === this.sessions[slot]) {
          this.disconnected = h3Count(this.disconnected)
          this.close(slot, RELAY_NONE, "", RELAY_QUIC_NO_ERROR, now)
        }
      } else if (event === WT_STREAM) {
        // The relay uses datagrams alone (wp34 §2): a stream is turned away.
        wt.resetStream(wt.stream, RELAY_QUIC_NO_ERROR)
        wt.stopSending(wt.stream, RELAY_QUIC_NO_ERROR)
      } else if (event === H3_REQUEST) {
        const h3 = this.server.connection(slot)
        const none: u8[][] = []
        h3.respond(h3.stream, RELAY_NOT_FOUND, none, none, true)
      }
      event = wt.next()
    }
    this.flushBatch()
  }

  /** WT_SESSION: the path, then both caps (claimed at the first Initial), before the hello rather than after the grant. */
  session(slot: i32, wt: WebTransport, now: i64): void {
    const id: i64 = wt.sessionId
    if (this.states[slot] !== RELAY_CONNECTING || !this.isPath(wt.fields.path)) {
      // Refused rather than accepted then closed, so a misdirected client gets a status it can read.
      wt.refuse(id, RELAY_NOT_FOUND)
      this.refusedPath = h3Count(this.refusedPath)
      return
    }
    wt.accept(id)
    this.sessions[slot] = id
    // The address's cap first: a connection over it was given no global place either.
    if (!this.peerHeld[slot]) {
      this.refusedPeer = h3Count(this.refusedPeer)
      this.close(slot, CLOSE_RATE_LIMITED, "too many sessions from this address", RELAY_QUIC_REFUSED, now)
      return
    }
    if (!this.counted[slot]) {
      this.refusedFull = h3Count(this.refusedFull)
      this.close(
        slot,
        CLOSE_RATE_LIMITED,
        "the relay is holding as many sessions as it will",
        RELAY_QUIC_REFUSED,
        now
      )
      return
    }
    this.accepted = h3Count(this.accepted)
    this.states[slot] = RELAY_HELLO_WAIT
    this.wheel.file(slot, now + this.config.helloTimeout, now)
  }

  /** Whether `path` is the configured path, byte for byte. */
  isPath(path: u8[]): boolean {
    const want: string = this.config.path
    const n: i32 = toI32(want.length)
    if (toI32(path.length) !== n) {
      return false
    }
    for (let k: i32 = 0; k < n && k < toI32(path.length); k++) {
      if (toI32(path[k]) !== toI32(want.charCodeAt(k))) {
        return false
      }
    }
    return true
  }

  /** The first datagram of an accepted session: a HELLO of this version with a grant, or a refusal. */
  hello(slot: i32, wt: WebTransport, now: i64, wall: i64, grantKey: Secret<u8[]>): void {
    const f: RelayFrame = this.frame
    const type: i32 = relayDecode(f, wt.data, wt.dataStart, wt.dataLength)
    if (type !== RELAY_HELLO || f.fromRelay) {
      this.refusedHello = h3Count(this.refusedHello)
      this.close(slot, CLOSE_PROTOCOL_ERROR, "expected a hello", RELAY_QUIC_REFUSED, now)
      return
    }
    if (f.version !== RELAY_PROTOCOL_VERSION) {
      this.refusedHello = h3Count(this.refusedHello)
      this.close(slot, CLOSE_PROTOCOL_ERROR, "unsupported relay protocol version", RELAY_QUIC_REFUSED, now)
      return
    }
    const g: RelayGrant = this.grant
    if (this.verifier.verify(wt.data, f.textStart, f.textLength, wall, grantKey, g) !== GRANT_OK) {
      this.refusedGrant = h3Count(this.refusedGrant)
      this.close(slot, g.code, g.reason, RELAY_QUIC_REFUSED, now)
      return
    }
    // The upstream comes from the signed grant and nowhere else: the line that stops the relay being a reflector.
    const fd: i32 = this.openUpstream(slot, g)
    if (fd < 0) {
      this.refusedUpstream = h3Count(this.refusedUpstream)
      this.close(slot, CLOSE_UPSTREAM_UNREACHABLE, "cannot resolve the game server", RELAY_QUIC_REFUSED, now)
      return
    }
    this.upstreams[slot] = fd
    pollAdd(this.loop, fd, 1, slot + RELAY_TOKEN_UPSTREAM)
    const n: i32 = relayEncodeHelloOk(this.out, RELAY_ZERO, this.ids[slot], MAX_PAYLOAD_BYTES)
    wt.sendDatagram(this.sessions[slot], this.out, RELAY_ZERO, n)
    this.states[slot] = RELAY_PUMPING
    this.lastHeard[slot] = now
    this.windowStart[slot] = now
    this.windowCount[slot] = 0
    this.fromClient[slot] = 0
    this.fromUpstream[slot] = 0
    this.seqs[slot] = 0
    this.wheel.file(slot, now + this.config.statsInterval, now)
    if (this.config.verbose) {
      using a = arena()
      const host: string[] = []
      for (let k: i32 = 0; k < g.hostLength && k < toI32(g.host.length); k++) {
        host.push(this.verifier.chars[toI32(g.host[k])])
      }
      this.log(
        `session ${this.ids[slot]} -> ${host.join("")}:${g.port}${this.config.offload ? " (offload asked)" : ""}`
      )
    }
  }

  /**
   * The grant's upstream as an address in the slot's buffer, and a UDP
   * socket for it on the unspecified address of its family: the socket, or
   * -1. There is no DNS in `nish:net`, so the host is an address literal or
   * `localhost`; a name is unreachable, as one that will not resolve is in
   * main.rs.
   */
  openUpstream(slot: i32, g: RelayGrant): i32 {
    const to: u8[] = this.upstreamAddresses[slot]
    if (!this.address(g, to)) {
      return RELAY_NONE
    }
    let v4: boolean = to[10] === 255 && to[11] === 255
    for (let k: i32 = 0; k < 10; k++) {
      v4 = v4 && to[k] === 0
    }
    const bind: string = v4 ? "0.0.0.0" : "::"
    let fd: i32 = udpBind(bind, RELAY_ZERO, this.config.offload ? 2 : 0)
    if (fd < 0 && this.config.offload) {
      // No GRO here (Darwin, or an old kernel): the socket works one datagram at a time.
      fd = udpBind(bind, RELAY_ZERO, RELAY_ZERO)
    }
    return fd
  }

  /**
   * The grant's upstream as an address in `to`. The host text `netAddress`
   * reads is built from the verifier's one-character strings, which are older
   * than the block, so it dies with the block.
   */
  address(g: RelayGrant, to: u8[]): boolean {
    using a = arena()
    const parts: string[] = []
    for (let k: i32 = 0; k < g.hostLength && k < toI32(g.host.length); k++) {
      parts.push(this.verifier.chars[toI32(g.host[k])])
    }
    const host: string = parts.join("")
    return netAddress(to, host === "localhost" ? "127.0.0.1" : host, g.port) === 0
  }

  /** A datagram of a forwarding session: the rate window, then the frame. */
  pump(slot: i32, wt: WebTransport, now: i64): void {
    this.lastHeard[slot] = now
    // A fixed window rather than a token bucket: the client sends at a constant tick rate.
    if (now - this.windowStart[slot] >= 1000) {
      this.windowStart[slot] = now
      this.windowCount[slot] = 0
    }
    this.windowCount[slot] = h3Count(this.windowCount[slot])
    if (this.windowCount[slot] > this.config.maxDatagramsPerSecond) {
      this.rateLimited = h3Count(this.rateLimited)
      this.close(slot, CLOSE_RATE_LIMITED, "sending far faster than the tick rate", RELAY_QUIC_NO_ERROR, now)
      return
    }
    const f: RelayFrame = this.frame
    const type: i32 = relayDecode(f, wt.data, wt.dataStart, wt.dataLength)
    if (type === RELAY_DATA) {
      if (f.payloadLength > MAX_PAYLOAD_BYTES) {
        this.oversized = h3Count(this.oversized)
        return
      }
      this.fromClient[slot] = relayCount32(this.fromClient[slot])
      this.sendUp(slot, wt.data, f.payloadStart, f.payloadLength)
    } else if (type === RELAY_PING) {
      // Dwell is how long the PING spent inside the relay, which the client subtracts from its round trip.
      const dwell: i64 = monotonicNanos() / 1000 - this.stepMicros
      const n: i32 = relayEncodePong(this.out, RELAY_ZERO, f.id, f.sentAtMicros, dwell > 0 ? dwell : 0)
      wt.sendDatagram(this.sessions[slot], this.out, RELAY_ZERO, n)
    } else if (type === RELAY_CLOSE) {
      this.clientClosed = h3Count(this.clientClosed)
      this.close(slot, RELAY_NONE, "", RELAY_QUIC_NO_ERROR, now)
    } else if (type !== RELAY_HELLO) {
      // A frame only a relay sends, or one that does not decode: counted, not fatal.
      this.badFrames = h3Count(this.badFrames)
    }
  }

  /**
   * Forwards `buf[off .. off + len)` upstream. Without offload, one send;
   * with it, into the pass's batch while the payloads are the same size, a
   * shorter one ending it, so one GSO send carries them.
   */
  sendUp(slot: i32, buf: u8[], off: i32, len: i32): void {
    const fd: i32 = this.upstreams[slot]
    if (fd < 0) {
      return
    }
    this.forwardedUp = h3Count(this.forwardedUp)
    if (!this.config.offload || len === 0) {
      this.flushBatch()
      // A failed send is dropped rather than fatal: the path is unreliable by construction.
      udpSendTo(fd, buf, off, len, this.upstreamAddresses[slot], RELAY_ZERO, RELAY_ZERO)
      return
    }
    if (this.batchSlot !== slot || len > this.batchSegment || this.batchCount >= RELAY_BATCH) {
      this.flushBatch()
      this.batchSlot = slot
      this.batchSegment = len
    }
    quicPacketCopy(this.batch, this.batchLength, buf, off, len)
    this.batchLength = this.batchLength + len
    this.batchCount = this.batchCount + 1
    if (len < this.batchSegment) {
      this.flushBatch()
    }
  }

  /** Sends the batch: one GSO send when it holds more than one, one datagram at a time where there is no GSO. */
  flushBatch(): void {
    const slot: i32 = this.batchSlot
    const count: i32 = this.batchCount
    const length: i32 = this.batchLength
    this.batchSlot = RELAY_NONE
    this.batchCount = 0
    this.batchLength = 0
    if (slot < 0 || count === 0 || slot >= toI32(this.upstreams.length)) {
      return
    }
    const fd: i32 = this.upstreams[slot]
    const to: u8[] = this.upstreamAddresses[slot]
    if (count === 1) {
      udpSendTo(fd, this.batch, RELAY_ZERO, length, to, RELAY_ZERO, RELAY_ZERO)
      return
    }
    const sent: i32 = udpSendTo(fd, this.batch, RELAY_ZERO, length, to, this.batchSegment, RELAY_ZERO)
    if (sent >= 0) {
      this.gsoSends = h3Count(this.gsoSends)
      return
    }
    if (sent !== RELAY_NO_GSO) {
      return
    }
    for (let at: i32 = 0; at < length; at = at + this.batchSegment) {
      const n: i32 = length - at < this.batchSegment ? length - at : this.batchSegment
      udpSendTo(fd, this.batch, at, n, to, RELAY_ZERO, RELAY_ZERO)
    }
  }

  /**
   * `slot`'s upstream socket is readable: every datagram waiting, at most
   * `RELAY_BATCH` reads, each from the granted address alone and cut at the
   * GRO segment size, framed as DATA and sent to the client. A datagram that
   * will not fit the client's path is dropped and counted: a snapshot is
   * worth nothing late.
   */
  upstreamReady(slot: i32): void {
    if (slot < 0 || slot >= this.size() || this.states[slot] !== RELAY_PUMPING || !this.server.holds(slot)) {
      return
    }
    const fd: i32 = this.upstreams[slot]
    const to: u8[] = this.upstreamAddresses[slot]
    const wt: WebTransport = this.wts[slot]
    const session: i64 = this.sessions[slot]
    const cap: i32 = this.config.offload ? RELAY_READ_COALESCED : RELAY_READ_PLAIN
    for (let reads: i32 = 0; reads < RELAY_BATCH; reads++) {
      const n: i32 = udpRecvFrom(fd, this.rx, RELAY_ZERO, cap, this.from, this.meta)
      if (n < 0) {
        break
      }
      if (!this.cameFrom(to)) {
        this.foreign = h3Count(this.foreign)
        continue
      }
      const segment: i32 = this.meta[0] > 0 ? this.meta[0] : n
      if (this.meta[0] > 0) {
        this.groReads = h3Count(this.groReads)
      }
      // An empty read carries no datagram, as offload.rs's `segments` yields none for one.
      for (let at: i32 = 0; at < n && segment > 0; at = at + segment) {
        const len: i32 = n - at < segment ? n - at : segment
        this.fromUpstream[slot] = relayCount32(this.fromUpstream[slot])
        this.seqs[slot] = (this.seqs[slot] + 1) & 0xffff
        const framed: i32 = relayEncodeData(this.out, RELAY_ZERO, this.seqs[slot], this.rx, at, len)
        if (framed < 0 || wt.sendDatagram(session, this.out, RELAY_ZERO, framed) !== 0) {
          this.droppedDown = h3Count(this.droppedDown)
        } else {
          this.forwardedDown = h3Count(this.forwardedDown)
        }
      }
    }
    this.server.touch(slot)
  }

  /** Whether the last read came from `to`, port included: the socket is not connected, so the relay filters. */
  cameFrom(to: u8[]): boolean {
    for (let k: i32 = 0; k < RELAY_ADDRESS && k < toI32(to.length) && k < toI32(this.from.length); k++) {
      if (this.from[k] !== to[k]) {
        return false
      }
    }
    return true
  }

  // ---- Timers -----------------------------------------------------------------------

  /** Runs the relay timers due by `now`, as `Http3Server.tick` runs the connections'. */
  timers(now: i64): void {
    const wheel: Http3Wheel = this.wheel
    if (wheel.cursor < 0) {
      wheel.cursor = now
    }
    if (now - wheel.cursor >= toI64(H3_SERVER_WHEEL)) {
      wheel.cursor = now - toI64(H3_SERVER_WHEEL - 1)
    }
    let steps: i32 = 0
    while (wheel.cursor <= now && steps < H3_SERVER_WHEEL) {
      let slot: i32 = wheel.take(wheel.cursor)
      while (slot >= 0) {
        if (wheel.dueAt[slot] > now) {
          // Filed at the horizon: not due yet, so filed again.
          wheel.file(slot, wheel.dueAt[slot], now)
        } else {
          this.timer(slot, now)
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

  /** `slot`'s timer: the connect and hello deadlines, the stats tick and idle check, or a look at a slot on its way out. */
  timer(slot: i32, now: i64): void {
    this.reconcile(slot, now)
    const state: i32 = this.states[slot]
    if (state === RELAY_HELLO_WAIT) {
      // main.rs closes a silent session without a CLOSE frame: there is nobody to read one.
      this.helloTimeouts = h3Count(this.helloTimeouts)
      this.close(slot, RELAY_NONE, "", RELAY_QUIC_REFUSED, now)
    } else if (state === RELAY_PUMPING) {
      if (now - this.lastHeard[slot] > this.config.idleTimeout) {
        this.idleClosed = h3Count(this.idleClosed)
        this.close(slot, CLOSE_IDLE, "idle", RELAY_QUIC_NO_ERROR, now)
        return
      }
      const rtt: i64 = this.server.quic(slot).recovery.smoothedRtt * 1000
      const n: i32 = relayEncodeStats(
        this.out,
        RELAY_ZERO,
        rtt,
        this.fromClient[slot],
        this.fromUpstream[slot]
      )
      this.wts[slot].sendDatagram(this.sessions[slot], this.out, RELAY_ZERO, n)
      this.fromClient[slot] = 0
      this.fromUpstream[slot] = 0
      this.server.touch(slot)
      this.wheel.file(slot, now + this.config.statsInterval, now)
    } else if (state === RELAY_CONNECTING) {
      if (now >= this.connectBy[slot]) {
        // A handshake, or a connection that pings on, with no session by the hello deadline: closed as a silent session is.
        this.connectTimeouts = h3Count(this.connectTimeouts)
        this.close(slot, RELAY_NONE, "", RELAY_QUIC_REFUSED, now)
      } else {
        this.wheel.file(slot, this.recheck(slot, now), now)
      }
    } else if (state !== RELAY_FREE) {
      this.wheel.file(slot, now + RELAY_RECHECK, now)
    }
  }
}
