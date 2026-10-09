/**
 * `nish/net/quic-listener` — what a QUIC version 1 server answers to a
 * datagram no connection owns: Version Negotiation for a version it does not
 * speak (RFC 9000 §6, §17.2.1), a Retry that asks a client to prove its
 * address before any connection state exists (§8.1.2, §17.2.5), and a
 * stateless reset for a packet sent to a connection the server no longer has
 * (§10.3). Sans-IO, like the rest of `nish/net`, and stateless in the sense
 * the RFC means: nothing it answers depends on any connection.
 *
 *     import { QuicListener, QuicListenerAnswer, QUIC_LISTEN_ACCEPT, QUIC_LISTENER_ANSWER_SIZE } from "nish/net/quic-listener";
 *
 *     const listener = new QuicListener(config, entropy);      // entropy: QUIC_LISTENER_ENTROPY_SIZE random bytes
 *     const answer = new QuicListenerAnswer(QUIC_LISTENER_ANSWER_SIZE);  // once, beside the listener
 *     // For a datagram buf[at .. at + len) whose first packet no connection owns:
 *     if (listener.handleWindow(buf, at, len, fromAddress, now, answer) === QUIC_LISTEN_ACCEPT) {
 *       const conn = new QuicConnection(config, connectionEntropy);
 *       if (answer.retried) { conn.acceptRetry(answer.originalDcid, answer.retryScid); }
 *       conn.receiveWindow(buf, at, len, now);
 *     } else if (toI32(answer.reply.length) > 0) {
 *       … send answer.reply back to fromAddress …
 *     }
 *
 * **Nothing is kept per datagram** (H3-3 in `docs/security/http3.md`).
 * `handleWindow` reads the datagram where it lies, its header parsed in
 * place, and writes every answer into the caller's `QuicListenerAnswer`,
 * whose arrays were given their room once; every MAC, key and seal is
 * computed in scratch the listener made at start-up. `handle` is the same
 * over a whole array, into an answer of its own each time, for a caller
 * that keeps them.
 *
 * **Routing is the caller's.** The listener sees only datagrams the caller
 * could not hand to a live connection, and it must see only those: a stateless
 * reset carries the token for the packet's connection ID, and handing the
 * listener a packet for a connection that is still alive would give that
 * token, which ends the connection, to whoever sent it (RFC 9000 §21.11).
 *
 * **Retry tokens** (§8.1.4) are this server's own format: a marker byte, the
 * time the token was issued, and the client's original Destination
 * Connection ID, then 16 bytes of HMAC-SHA256 under the configuration's
 * `retryTokenKey` over all of that, the Retry's Source Connection ID (which
 * the client's next Initial must be sent to) and the client's address as the
 * caller gives it, port included. So a token is good only from the address
 * it was sent to, only for the connection it was issued for, and only for
 * `retryTokenLifetime` milliseconds. A token that carries the marker and fails
 * any of that is an invalid Retry token, which closes the attempt with
 * INVALID_TOKEN (§8.1.2); a token without the marker, which some other
 * server issued, is treated as no token at all (§8.1.3).
 *
 * **Stateless resets** (§10.3) end in the token `quicStatelessResetToken`
 * derives (computed in place, by `quicConnResetTokenInto`) from the configuration's static key and the packet's connection
 * ID, so a server that restarted with the same key can end the connections
 * it lost. RFC 9000 §10.3 and §10.3.3 bound them, and each bound is held
 * here. A reset is sent only for a short header, and is always shorter than
 * the datagram that caused it, so two endpoints resetting each other shrink
 * to nothing; one byte shorter for a datagram of 43 bytes or fewer, and
 * never under 21 bytes, so a datagram of 21 or fewer gets none. That also
 * bounds amplification at less than one to one. They are rate limited:
 * `QUIC_LISTENER_RESET_BURST` at once, then one per
 * `QUIC_LISTENER_RESET_INTERVAL` milliseconds. Each reset's other bytes are
 * unpredictable, from the listener's own generator.
 *
 * **Pacing** (RFC 9002 §7.7) is the carrier's send loop, so it is here
 * beside the rest of what the carrier calls: `quicListenerTakePaced` takes a
 * connection's next datagram only when its pacer has the credit for it, and
 * `quicListenerPaceTime` says when it will. The pacer earns 5/4 of the
 * congestion window per smoothed RTT and lets a burst of at most the initial
 * window go at once, so a flight leaves spread over the round trip instead
 * of in one burst that overruns a queue on the path.
 *
 *     let out: u8[] | null = quicListenerTakePaced(conn, now);
 *     while (out !== null) { … send it … ; out = quicListenerTakePaced(conn, now); }
 *     … and wake at the earlier of conn.deadline() and quicListenerPaceTime(conn, now)
 *
 * **GSO and GRO** (`nish:net`'s `UDP_SEGMENT` and `UDP_GRO`). A carrier that
 * sends with segmentation offload takes a whole flight at once:
 * `quicListenerTakeFlight` writes as many datagrams as the pacer has credit
 * for back to back into one buffer, every one `QUIC_CONN_DATAGRAM_SIZE`
 * bytes but the last, which is what one `udpSendTo` with that segment size
 * cuts back into datagrams; each is written in place, so a flight allocates
 * nothing. The flight is paced as a whole: it is as long as the pacer's
 * credit, and charged to it datagram by datagram, so a burst is never more
 * than the initial window however the carrier sends it. On the receiving
 * side, `quicListenerReceiveSegments` hands a connection the datagrams of
 * one GRO receive, segment by segment, in place.
 *
 *     const flight = new QuicFlight();
 *     const n: i32 = quicListenerTakeFlight(conn, now, buf, 0, toI32(buf.length), flight);
 *     if (n > 0) { udpSendTo(fd, buf, 0, n, peer, flight.count > 1 ? flight.segment : 0, 0); }
 *
 * **Sans-IO and deterministic.** The caller gives the time, the client's
 * address and, once, `QUIC_LISTENER_ENTROPY_SIZE` random bytes: every
 * unpredictable byte the listener sends (a Retry's connection ID and unused
 * bits, Version Negotiation's unused bits, a reset's padding and length) is
 * HMAC-SHA256 under that seed of a counter. So a recorded exchange replays
 * byte for byte.
 *
 * **Secrets.** The seed lives in the listener and the static keys in the
 * caller's `QuicServerConfig`, for the server's lifetime, as plain bytes,
 * since a `Secret` may not be a field (NL2430); QUIC-5 in
 * `docs/security/quic.md` records it, with #430.
 *
 * Written from RFC 9000, in this module's own structure; nothing here is
 * ported from another implementation. Private names carry the
 * `quicListener` prefix (`docs/wp26-stdlib.md` §3e).
 */
import { AesKey, aesGcmSeal, aesKeyInto } from "nish/crypto/aes"
import { timingSafeEqualAt } from "nish/crypto/ct"
import { HkdfScratch } from "nish/crypto/hkdf"
import { HmacSha256Scratch } from "nish/crypto/hmac"
import {
  QUIC_AEAD_AES_128_GCM,
  QUIC_ERR_VERSION,
  QUIC_MAX_CID_LENGTH,
  QUIC_PACKET_INITIAL,
  QUIC_PACKET_OK,
  QUIC_PACKET_SHORT,
  QUIC_RETRY_TAG_SIZE,
  QuicHeader,
  QuicKeys,
  QuicKeysSlot,
  QuicPacket,
  quicDecryptPayload,
  quicInitialSecretsInto,
  quicKeysInto,
  quicLongHeaderSize,
  quicPacketCopy,
  quicParseHeaderInto,
  quicPutLongHeader,
  quicSealInPlace,
  quicUnprotectHeader,
} from "nish/net/quic-packet"
import { QUIC_ERROR_INVALID_TOKEN, QUIC_RESET_TOKEN_SIZE, quicPutConnectionClose } from "nish/net/quic-frame"
import {
  QUIC_CONN_CID_LENGTH,
  QUIC_CONN_DATAGRAM_SIZE,
  QUIC_CONN_STATIC_KEY_SIZE,
  QuicConnection,
  QuicServerConfig,
  quicConnResetTokenInto,
} from "nish/net/quic"

// ---- What `handle` answers ----------------------------------------------------

/** Nothing to send and no connection to make: the datagram is dropped. */
export const QUIC_LISTEN_DROP: i32 = 0
/** Make a connection and hand it the datagram; after a Retry, `acceptRetry` it first. */
export const QUIC_LISTEN_ACCEPT: i32 = 1
/** Send `reply`, a Version Negotiation packet (RFC 9000 §17.2.1). */
export const QUIC_LISTEN_VERSION_NEGOTIATION: i32 = 2
/** Send `reply`, a Retry packet with an address-validation token (§17.2.5). */
export const QUIC_LISTEN_RETRY: i32 = 3
/** Send `reply`, an Initial carrying CONNECTION_CLOSE with INVALID_TOKEN (§8.1.2). */
export const QUIC_LISTEN_INVALID_TOKEN: i32 = 4
/** Send `reply`, a stateless reset (§10.3). */
export const QUIC_LISTEN_STATELESS_RESET: i32 = 5

// ---- Sizes and limits -----------------------------------------------------------

/** How many random bytes the constructor takes: the seed of every unpredictable byte the listener sends. */
export const QUIC_LISTENER_ENTROPY_SIZE: i32 = 32
/** The most stateless resets the listener sends at once, before the rate limit applies. */
export const QUIC_LISTENER_RESET_BURST: i32 = 16
/** After the burst, one stateless reset per this many milliseconds. */
export const QUIC_LISTENER_RESET_INTERVAL: i64 = 100
/**
 * The smallest stateless reset (RFC 9000 §10.3): a first byte, at least 38
 * unpredictable bits after the fixed ones, and the 16-byte token.
 */
export const QUIC_LISTENER_MIN_RESET: i32 = 21
/** The longest a Retry token may be accepted for, in milliseconds: a client returns one within a round trip. */
export const QUIC_LISTENER_MAX_TOKEN_LIFETIME: i64 = 60000

/** The first byte of every Retry token this listener issues. */
const QUIC_LISTENER_TOKEN_MARKER: i32 = 0x52
/** A Retry token's MAC length: HMAC-SHA256 cut to 128 bits. */
const QUIC_LISTENER_TOKEN_MAC_SIZE: i32 = 16
/** A Retry token's fixed part before the original DCID: the marker, eight bytes of time, the DCID's length. */
const QUIC_LISTENER_TOKEN_HEAD: i32 = 10
/** Up to this datagram length a reset is exactly one byte shorter (RFC 9000 §10.3). */
const QUIC_LISTENER_SHORT_TRIGGER: i32 = 43
/** The generator's block, one HMAC-SHA256 tag: the bytes `refill` makes at a time. */
const QUIC_LISTENER_POOL: i32 = 32
/** The generator's message: its counter, eight bytes. */
const QUIC_LISTENER_BLOCK: i32 = 8
/** A typed 0, the start of a whole array, since a bare literal is an `f64` under `--number-mode f64`. */
const QUIC_LISTENER_FROM: i32 = 0

/**
 * The largest answer the listener sends, and so the room `QuicListenerAnswer`
 * makes for `reply`: a stateless reset is at most a full datagram (RFC 9000
 * §10.3); a Version Negotiation packet, which echoes two IDs of up to 255
 * bytes, a Retry and the INVALID_TOKEN close are all shorter.
 */
export const QUIC_LISTENER_ANSWER_SIZE: i32 = QUIC_CONN_DATAGRAM_SIZE

/**
 * What `QuicListener.handleWindow` decided about one datagram: `kind` is a
 * `QUIC_LISTEN_*`, and `reply` the datagram to send back, empty when there
 * is none. For `QUIC_LISTEN_ACCEPT` after a Retry, `retried` is set and
 * `originalDcid` and `retryScid` are what `QuicConnection.acceptRetry` takes.
 *
 * Make one once, with `QUIC_LISTENER_ANSWER_SIZE` as its `room`, and hand it
 * to every `handleWindow`: the constructor gives `reply` that room and each
 * ID 20 bytes, and each answer refills them in it, its length the answer's,
 * so answering allocates nothing (H3-3). A smaller room still works, and
 * grows the first time an answer needs more; `handle` makes each answer
 * with exactly the room its reply takes.
 */
export class QuicListenerAnswer {
  reply: u8[]
  originalDcid: u8[]
  retryScid: u8[]
  kind: i32 = 0
  retried: boolean = false

  constructor(room: i32) {
    this.reply = quicListenerRoom(room > 0 ? room : 0)
    this.originalDcid = quicListenerRoom(QUIC_MAX_CID_LENGTH)
    this.retryScid = quicListenerRoom(QUIC_MAX_CID_LENGTH)
  }
}

/** An empty array with room for `size` bytes, so pushing up to that many allocates nothing. */
const quicListenerRoom = (size: i32): u8[] => {
  const out: u8[] = new Array<u8>(size)
  while (out.length > 0) {
    out.pop()
  }
  return out
}

/** Sets `bytes`' length to `length` in the room it already has: popped, or pushed with zeros. */
const quicListenerResize = (bytes: u8[], length: i32): void => {
  while (toI32(bytes.length) > length) {
    bytes.pop()
  }
  while (toI32(bytes.length) < length) {
    bytes.push(toU8(0))
  }
}

/** Puts `from[at .. at + length)` in `to`, resized to `length` in its own room. */
const quicListenerRefill = (to: u8[], from: u8[], at: i32, length: i32): void => {
  quicListenerResize(to, length)
  quicPacketCopy(to, 0, from, at, length)
}

/** Writes `value`'s low `size` bytes into `buf` at `at`, big-endian. */
const quicListenerPutNumber = (buf: u8[], at: i32, value: i64, size: i32): void => {
  for (let k: i32 = 0; k < size; k += 1) {
    if (at + k >= 0 && at + k < toI32(buf.length)) {
      buf[at + k] = toU8(toI32((value >> (toI64(size - 1 - k) * 8)) & 255))
    }
  }
}

/**
 * RFC 9001 §5.8's fixed AES-128-GCM key and nonce for version 1's Retry
 * integrity tag: the listener keeps the key expanded, so a Retry's tag is
 * computed without `quicRetryIntegrityTag`'s expansion, which stores what it
 * allocates and so cannot run in an arena block.
 *
 * TODO(WP34 Q1): `nish/net/quic-packet` holds the same two constants and
 * should offer the tag over a kept key; this stage may not edit it.
 */
const quicListenerRetryKey = (): u8[] => [
  0xbe, 0x0c, 0x69, 0x0b, 0x9f, 0x66, 0x57, 0x5a, 0x1d, 0x76, 0x6b, 0x54, 0xe3, 0x68, 0xc8, 0x4e,
]
const quicListenerRetryNonce = (): u8[] => [
  0x46, 0x15, 0x99, 0xd3, 0x5d, 0x63, 0x2b, 0xf2, 0x23, 0x98, 0x25, 0xbb,
]

/** Whether `[at, at + len)` is a window inside an array of `length` elements: `p256WindowFits`' test. */
const quicListenerWindowFits = (length: i32, at: i32, len: i32): boolean =>
  at >= 0 && len >= 0 && at <= length - len

/**
 * The server's answers to datagrams no connection owns, under one
 * `QuicServerConfig`. Make one when the server starts, with the same
 * configuration its connections use, and hand it every such datagram with
 * the address it came from and the time.
 *
 * A configuration whose `statelessResetKey` or `retryTokenKey` is not
 * `QUIC_CONN_STATIC_KEY_SIZE` bytes, or whose `retryTokenLifetime` is outside
 * 1 to `QUIC_LISTENER_MAX_TOKEN_LIFETIME`, or entropy of another length, make
 * a listener that drops everything.
 *
 * Everything an answer is computed in is made here, once: the header a
 * datagram is parsed into, the HMAC and HKDF scratch, the Initial secrets
 * and key slots of the INVALID_TOKEN close, and the generator's block. So
 * `handleWindow` reads the datagram where it lies and keeps nothing.
 */
export class QuicListener {
  config: QuicServerConfig
  seed: u8[]
  /** Unpredictable bytes not yet used, from `poolHead`, and the counter the next block is made from. */
  pool: u8[]
  /** The counter's eight bytes, the generator's HMAC message. */
  block: u8[]
  /** What `handleWindow` parses a datagram's header into, in place. */
  header: QuicHeader
  /** Every HMAC and HKDF the listener computes runs here; its `sha256` makes tokens, resets and the generator's blocks. */
  kdf: HkdfScratch
  /** A full HMAC-SHA256 tag, wiped once its 16 bytes are used. */
  tag: u8[]
  /** A Retry token MAC's length fields: the Retry SCID's one byte, the address's four. */
  lengths: u8[]
  /** The Initial secrets of an INVALID_TOKEN close, and its keys, both directions. */
  initialClient: u8[]
  initialServer: u8[]
  readSlot: QuicKeysSlot
  writeSlot: QuicKeysSlot
  packet: QuicPacket
  /** The client's SCID and the DCID it sent to, copied out for `quicPutLongHeader`, which reads IDs from 0. */
  peerCid: u8[]
  ownCid: u8[]
  /** An empty array: the INVALID_TOKEN close's token and reason. */
  none: u8[]
  /** Version 1's fixed Retry key (RFC 9001 §5.8), expanded once. */
  retryKey: AesKey
  /** What `handle` answers into before it copies the answer out. */
  spare: QuicListenerAnswer
  counter: i64 = 0
  /** The latest time the caller gave, in milliseconds; time never runs backwards here. */
  now: i64 = 0
  /** When the reset budget was last topped up (-1: never yet), and the stateless resets that may go now. */
  resetRefilled: i64 = -1
  resetBudget: i32 = 0
  poolHead: i32 = 0
  /** Stateless resets sent, and ones the rate limit held back. */
  resetsSent: i32 = 0
  resetsLimited: i32 = 0
  /** Whether the configuration and entropy were usable. */
  usable: boolean = false

  /** A listener under `config`; `entropy`'s `QUIC_LISTENER_ENTROPY_SIZE` bytes are copied, then wiped in the caller's array. */
  constructor(config: QuicServerConfig, entropy: u8[]) {
    this.config = config
    this.seed = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE)
    quicPacketCopy(this.seed, 0, entropy, 0, QUIC_LISTENER_ENTROPY_SIZE)
    this.pool = new Array<u8>(QUIC_LISTENER_POOL)
    this.poolHead = QUIC_LISTENER_POOL
    this.block = new Array<u8>(QUIC_LISTENER_BLOCK)
    this.header = new QuicHeader()
    this.kdf = new HkdfScratch()
    this.tag = new Array<u8>(QUIC_LISTENER_POOL)
    this.lengths = new Array<u8>(5)
    this.initialClient = new Array<u8>(32)
    this.initialServer = new Array<u8>(32)
    this.readSlot = new QuicKeysSlot()
    this.writeSlot = new QuicKeysSlot()
    this.packet = new QuicPacket()
    this.peerCid = new Array<u8>(QUIC_MAX_CID_LENGTH)
    this.ownCid = new Array<u8>(QUIC_MAX_CID_LENGTH)
    this.none = []
    this.spare = new QuicListenerAnswer(QUIC_LISTENER_ANSWER_SIZE)
    this.retryKey = new AesKey(10, new Array<u64>(88))
    aesKeyInto(quicListenerRetryKey(), this.retryKey)
    this.usable =
      toI32(entropy.length) === QUIC_LISTENER_ENTROPY_SIZE &&
      toI32(config.statelessResetKey.length) === QUIC_CONN_STATIC_KEY_SIZE &&
      toI32(config.retryTokenKey.length) === QUIC_CONN_STATIC_KEY_SIZE &&
      config.retryTokenLifetime >= 1 &&
      config.retryTokenLifetime <= QUIC_LISTENER_MAX_TOKEN_LIFETIME
    secureZero(entropy)
  }

  /**
   * One unpredictable value in 0 to 255: the next byte of HMAC-SHA256 under
   * the seed of a counter, a block at a time, each byte wiped once taken.
   */
  randomByte(): i32 {
    if (this.poolHead >= QUIC_LISTENER_POOL) {
      this.refill()
    }
    let b: i32 = 0
    if (this.poolHead >= 0 && this.poolHead < toI32(this.pool.length)) {
      b = toI32(this.pool[this.poolHead])
      this.pool[this.poolHead] = toU8(0)
    }
    this.poolHead = this.poolHead + 1
    return b
  }

  /** Writes `count` unpredictable bytes into `out` at `at`. */
  randomInto(out: u8[], at: i32, count: i32): void {
    for (let k: i32 = 0; k < count; k += 1) {
      const b: i32 = this.randomByte()
      if (at + k >= 0 && at + k < toI32(out.length)) {
        out[at + k] = toU8(b)
      }
    }
  }

  /** The generator's next block, HMAC-SHA256 under the seed of the counter, into `pool`. */
  refill(): void {
    quicListenerPutNumber(this.block, 0, this.counter, QUIC_LISTENER_BLOCK)
    this.counter = this.counter + 1
    const mac: HmacSha256Scratch = this.kdf.sha256
    {
      using _scope = arena()
      mac.begin(this.seed, QUIC_LISTENER_FROM, QUIC_LISTENER_ENTROPY_SIZE)
      mac.update(this.block, QUIC_LISTENER_FROM, QUIC_LISTENER_BLOCK)
      mac.finishInto(this.pool, QUIC_LISTENER_FROM)
    }
    mac.wipe()
    this.poolHead = 0
  }

  /**
   * Decides what to answer a datagram whose first packet no connection
   * owns, `datagram[at .. at + len)`, read where it lies, from `address`
   * (the client's address as the caller's socket reports it, port included)
   * at `now` (the caller's monotonic time in milliseconds), into `answer`,
   * whose arrays are refilled in their own room. Answers `answer.kind`. See
   * the module header for the rules; nothing a peer sends makes it panic,
   * and nothing it does keeps arena memory. A window outside `datagram` is
   * the caller's mistake, and panics.
   */
  handleWindow(datagram: u8[], at: i32, len: i32, address: u8[], now: i64, answer: QuicListenerAnswer): i32 {
    if (!quicListenerWindowFits(toI32(datagram.length), at, len)) {
      panic(
        `QuicListener.handleWindow: the window [${at}, ${at} + ${len}) is outside a datagram of ${toI32(datagram.length)} bytes`
      )
    }
    answer.kind = QUIC_LISTEN_DROP
    answer.retried = false
    quicListenerResize(answer.reply, 0)
    quicListenerResize(answer.originalDcid, 0)
    quicListenerResize(answer.retryScid, 0)
    if (now > this.now) {
      this.now = now
    }
    if (!this.usable) {
      return answer.kind
    }
    const header: QuicHeader = this.header
    quicParseHeaderInto(header, datagram, at, at + len, QUIC_CONN_CID_LENGTH)
    if (header.error === QUIC_ERR_VERSION) {
      // §5.2.2: answer an unsupported version only in a datagram that could
      // start a connection, and §6.1: never a Version Negotiation packet.
      if (header.version !== 0 && len >= QUIC_CONN_DATAGRAM_SIZE) {
        this.versionNegotiation(answer, datagram, header)
      }
      return answer.kind
    }
    if (header.error !== QUIC_PACKET_OK) {
      return answer.kind
    }
    if (header.type === QUIC_PACKET_SHORT) {
      this.statelessReset(answer, len, datagram, header.dcidStart, header.dcidLength)
      return answer.kind
    }
    // §14.1, §7.2, §5.2.2: only an Initial in a full-sized datagram, sent to
    // a DCID of at least 8 bytes, can start a connection; the rest is dropped.
    if (header.type !== QUIC_PACKET_INITIAL || len < QUIC_CONN_DATAGRAM_SIZE || header.dcidLength < 8) {
      return answer.kind
    }
    const tokenAt: i32 = header.tokenStart
    if (header.tokenLength === 0 || toI32(datagram[tokenAt]) !== QUIC_LISTENER_TOKEN_MARKER) {
      if (!this.config.retry) {
        answer.kind = QUIC_LISTEN_ACCEPT
        return answer.kind
      }
      this.retry(answer, datagram, header, address)
      return answer.kind
    }
    if (this.tokenValid(datagram, header, address)) {
      answer.kind = QUIC_LISTEN_ACCEPT
      answer.retried = true
      quicListenerRefill(
        answer.originalDcid,
        datagram,
        tokenAt + QUIC_LISTENER_TOKEN_HEAD,
        toI32(datagram[tokenAt + QUIC_LISTENER_TOKEN_HEAD - 1])
      )
      quicListenerRefill(answer.retryScid, datagram, header.dcidStart, header.dcidLength)
      return answer.kind
    }
    this.invalidToken(answer, datagram, header)
    return answer.kind
  }

  /**
   * `handleWindow` over the whole of `datagram`, into an answer of its own,
   * made with exactly the room its reply takes: for a caller that keeps each
   * answer, at the cost of one `QuicListenerAnswer` a datagram. A carrier
   * makes one answer and calls `handleWindow`.
   */
  handle(datagram: u8[], address: u8[], now: i64): QuicListenerAnswer {
    const spare: QuicListenerAnswer = this.spare
    this.handleWindow(datagram, QUIC_LISTENER_FROM, toI32(datagram.length), address, now, spare)
    const answer: QuicListenerAnswer = new QuicListenerAnswer(toI32(spare.reply.length))
    answer.kind = spare.kind
    answer.retried = spare.retried
    quicListenerRefill(answer.reply, spare.reply, QUIC_LISTENER_FROM, toI32(spare.reply.length))
    quicListenerRefill(
      answer.originalDcid,
      spare.originalDcid,
      QUIC_LISTENER_FROM,
      toI32(spare.originalDcid.length)
    )
    quicListenerRefill(answer.retryScid, spare.retryScid, QUIC_LISTENER_FROM, toI32(spare.retryScid.length))
    return answer
  }

  /**
   * A Version Negotiation packet (RFC 9000 §17.2.1) into `answer`, answering
   * a packet from the SCID `header` read to its DCID: the IDs swapped,
   * version 0, and version 1 as the only one supported. A random byte fills
   * the first byte's low six bits, under the 0x40 the RFC asks for so the
   * packet looks like QUIC to a demultiplexer. Each ID is at most 255 bytes,
   * so the packet is at most 521, inside `reply`'s room.
   *
   * TODO(WP34 Q1): every other packet format is `nish/net/quic-packet`'s; this
   * belongs beside `quicRetryPacket` there, which this stage may not edit.
   */
  versionNegotiation(answer: QuicListenerAnswer, datagram: u8[], header: QuicHeader): void {
    const unused: i32 = this.randomByte()
    const dcidLength: i32 = header.dcidLength
    const scidLength: i32 = header.scidLength
    const reply: u8[] = answer.reply
    quicListenerResize(reply, 11 + dcidLength + scidLength)
    reply[0] = toU8((unused & 0x3f) | 0xc0)
    quicListenerPutNumber(reply, 1, 0, 4)
    reply[5] = toU8(scidLength)
    quicPacketCopy(reply, 6, datagram, header.scidStart, scidLength)
    const dcidAt: i32 = 6 + scidLength
    quicListenerPutNumber(reply, dcidAt, toI64(dcidLength), 1)
    quicPacketCopy(reply, dcidAt + 1, datagram, header.dcidStart, dcidLength)
    quicListenerPutNumber(reply, dcidAt + 1 + dcidLength, 1, 4)
    answer.kind = QUIC_LISTEN_VERSION_NEGOTIATION
  }

  /**
   * The token MAC over `head[headAt .. headAt + headLength)`, the token's
   * own bytes before its MAC, the ID the client is to send to
   * (`scid[scidAt .. scidAt + scidLength)`) and its address, into `tag`:
   * what makes a token good for one address and one connection only. Its
   * first `QUIC_LISTENER_TOKEN_MAC_SIZE` bytes are the token's MAC; the
   * caller wipes `tag` once it has used them.
   */
  tokenMac(
    head: u8[],
    headAt: i32,
    headLength: i32,
    scid: u8[],
    scidAt: i32,
    scidLength: i32,
    address: u8[]
  ): void {
    const mac: HmacSha256Scratch = this.kdf.sha256
    const lengths: u8[] = this.lengths
    const one: i32 = 1
    const four: i32 = 4
    quicListenerPutNumber(lengths, QUIC_LISTENER_FROM, toI64(scidLength), one)
    quicListenerPutNumber(lengths, one, toI64(toI32(address.length)), four)
    {
      using _scope = arena()
      mac.begin(this.config.retryTokenKey, QUIC_LISTENER_FROM, toI32(this.config.retryTokenKey.length))
      mac.update(head, headAt, headLength)
      mac.update(lengths, QUIC_LISTENER_FROM, one)
      mac.update(scid, scidAt, scidLength)
      mac.update(lengths, one, four)
      mac.update(address, QUIC_LISTENER_FROM, toI32(address.length))
      mac.finishInto(this.tag, QUIC_LISTENER_FROM)
    }
    mac.wipe()
  }

  /**
   * Whether the token `header` read is one this listener issued for the
   * client at `address` that was told to send to the DCID `header` read,
   * and still within its lifetime: the lengths add up, the MAC matches
   * (compared in constant time), and it was issued no later than now and
   * less than `retryTokenLifetime` ago. The token is read in `datagram`.
   */
  tokenValid(datagram: u8[], header: QuicHeader, address: u8[]): boolean {
    const tokenAt: i32 = header.tokenStart
    const length: i32 = header.tokenLength
    if (length < QUIC_LISTENER_TOKEN_HEAD + QUIC_LISTENER_TOKEN_MAC_SIZE) {
      return false
    }
    const odcidLength: i32 = toI32(datagram[tokenAt + QUIC_LISTENER_TOKEN_HEAD - 1])
    const head: i32 = QUIC_LISTENER_TOKEN_HEAD + odcidLength
    if (odcidLength > QUIC_MAX_CID_LENGTH || head + QUIC_LISTENER_TOKEN_MAC_SIZE !== length) {
      return false
    }
    this.tokenMac(datagram, tokenAt, head, datagram, header.dcidStart, header.dcidLength, address)
    const same: boolean = timingSafeEqualAt(
      this.tag,
      0,
      datagram,
      tokenAt + head,
      QUIC_LISTENER_TOKEN_MAC_SIZE
    )
    secureZero(this.tag)
    if (!same) {
      return false
    }
    let issued: i64 = 0
    for (let k: i32 = 1; k < QUIC_LISTENER_TOKEN_HEAD - 1; k += 1) {
      issued = (issued << 8) | toI64(datagram[tokenAt + k])
    }
    return issued <= this.now && this.now - issued < this.config.retryTokenLifetime
  }

  /**
   * A Retry for the client's first Initial (RFC 9000 §8.1.2, §17.2.5) into
   * `answer`: a new connection ID for the client to send to, and a token
   * binding it, the original DCID and the client's address to now — a
   * marker byte, the time, the DCID, then the MAC — under the integrity tag
   * of RFC 9001 §5.8. Each part is written where it goes in `reply`.
   */
  retry(answer: QuicListenerAnswer, datagram: u8[], header: QuicHeader, address: u8[]): void {
    const scidLength: i32 = header.scidLength
    const odcidLength: i32 = header.dcidLength
    const retryScidAt: i32 = 7 + scidLength
    const tokenAt: i32 = retryScidAt + QUIC_CONN_CID_LENGTH
    const macAt: i32 = tokenAt + QUIC_LISTENER_TOKEN_HEAD + odcidLength
    const tagAt: i32 = macAt + QUIC_LISTENER_TOKEN_MAC_SIZE
    const reply: u8[] = answer.reply
    quicListenerResize(reply, tagAt + QUIC_RETRY_TAG_SIZE)
    this.randomInto(reply, retryScidAt, QUIC_CONN_CID_LENGTH)
    reply[tokenAt] = toU8(QUIC_LISTENER_TOKEN_MARKER)
    quicListenerPutNumber(reply, tokenAt + 1, this.now, 8)
    reply[tokenAt + QUIC_LISTENER_TOKEN_HEAD - 1] = toU8(odcidLength)
    quicPacketCopy(reply, tokenAt + QUIC_LISTENER_TOKEN_HEAD, datagram, header.dcidStart, odcidLength)
    this.tokenMac(reply, tokenAt, macAt - tokenAt, reply, retryScidAt, QUIC_CONN_CID_LENGTH, address)
    quicPacketCopy(reply, macAt, this.tag, 0, QUIC_LISTENER_TOKEN_MAC_SIZE)
    secureZero(this.tag)
    reply[0] = toU8((this.randomByte() & 15) | 0xf0)
    quicListenerPutNumber(reply, 1, 1, 4)
    reply[5] = toU8(scidLength)
    quicPacketCopy(reply, 6, datagram, header.scidStart, scidLength)
    reply[retryScidAt - 1] = toU8(QUIC_CONN_CID_LENGTH)
    if (this.retryTag(reply, tagAt, datagram, header.dcidStart, odcidLength)) {
      answer.kind = QUIC_LISTEN_RETRY
    } else {
      quicListenerResize(reply, 0)
    }
  }

  /**
   * The Retry integrity tag (RFC 9001 §5.8) over the pseudo-packet — the
   * original DCID `datagram[odcidAt .. odcidAt + odcidLength)`, its length
   * first, then `reply[0 .. tagAt)` — written at `reply[tagAt]`: AES-128-GCM
   * under the listener's copy of version 1's fixed key, over nothing. The
   * pseudo-packet and the AEAD's temporaries go with the arena block.
   * Answers whether it was made.
   */
  retryTag(reply: u8[], tagAt: i32, datagram: u8[], odcidAt: i32, odcidLength: i32): boolean {
    using _scope = arena()
    const pseudo: u8[] = new Array<u8>(1 + odcidLength + tagAt)
    quicListenerPutNumber(pseudo, 0, toI64(odcidLength), 1)
    quicPacketCopy(pseudo, 1, datagram, odcidAt, odcidLength)
    quicPacketCopy(pseudo, 1 + odcidLength, reply, 0, tagAt)
    const plain: u8[] = []
    const tag: u8[] | null = aesGcmSeal(this.retryKey, quicListenerRetryNonce(), pseudo, plain)
    if (tag === null || toI32(tag.length) !== QUIC_RETRY_TAG_SIZE) {
      return false
    }
    quicPacketCopy(reply, tagAt, tag, 0, QUIC_RETRY_TAG_SIZE)
    return true
  }

  /**
   * The answer to an Initial carrying an invalid Retry token (RFC 9000
   * §8.1.2), into `answer`: an Initial with CONNECTION_CLOSE and
   * INVALID_TOKEN, under the Initial keys of the DCID the client sent to,
   * from that DCID. It is sent only when the client's Initial
   * authenticates, so it answers a client and not noise; it is far smaller
   * than the datagram it answers. The keys are derived into the listener's
   * own slots, the Initial is opened in an arena block, and the close is
   * written and sealed in `reply`.
   */
  invalidToken(answer: QuicListenerAnswer, datagram: u8[], header: QuicHeader): void {
    const secrets: boolean = quicInitialSecretsInto(
      this.kdf,
      datagram,
      header.dcidStart,
      header.dcidLength,
      this.initialClient,
      this.initialServer
    )
    if (!secrets) {
      return
    }
    const read: QuicKeys | null = quicKeysInto(
      this.kdf,
      this.readSlot,
      QUIC_AEAD_AES_128_GCM,
      this.initialClient
    )
    if (read === null || !this.opens(read, datagram, header)) {
      return
    }
    // The write keys are derived only for an Initial that opened, so a forged
    // token on noise costs one derivation, not two.
    const write: QuicKeys | null = quicKeysInto(
      this.kdf,
      this.writeSlot,
      QUIC_AEAD_AES_128_GCM,
      this.initialServer
    )
    if (write === null) {
      return
    }
    const peer: i32 = header.scidLength
    const own: i32 = header.dcidLength
    quicPacketCopy(this.peerCid, 0, datagram, header.scidStart, peer)
    quicPacketCopy(this.ownCid, 0, datagram, header.dcidStart, own)
    const reply: u8[] = answer.reply
    quicListenerResize(reply, QUIC_LISTENER_ANSWER_SIZE)
    const headerLength: i32 = quicLongHeaderSize(QUIC_PACKET_INITIAL, peer, own, 0, 0, 1, 0)
    const frameEnd: i32 = quicPutConnectionClose(
      reply,
      headerLength,
      QUIC_LISTENER_ANSWER_SIZE,
      false,
      QUIC_ERROR_INVALID_TOKEN,
      0,
      this.none
    )
    const payloadLength: i32 = frameEnd - headerLength
    const put: i32 =
      headerLength > 0 && frameEnd > 0
        ? quicPutLongHeader(
            reply,
            0,
            QUIC_PACKET_INITIAL,
            this.peerCid,
            peer,
            this.ownCid,
            own,
            this.none,
            0,
            1,
            payloadLength
          )
        : -1
    const end: i32 =
      put === headerLength ? quicSealInPlace(write, reply, 0, headerLength, payloadLength, 0) : -1
    if (end > 0) {
      quicListenerResize(reply, end)
      answer.kind = QUIC_LISTEN_INVALID_TOKEN
    } else {
      quicListenerResize(reply, 0)
    }
  }

  /** Whether the Initial `header` read in `datagram` opens under `read`; what opening it allocates goes with the arena block. */
  opens(read: QuicKeys, datagram: u8[], header: QuicHeader): boolean {
    using _scope = arena()
    const packet: QuicPacket = this.packet
    const clear: u8[] = quicUnprotectHeader(read, datagram, header, -1, packet)
    const payload: u8[] | null = quicDecryptPayload(read, datagram, header, clear, packet)
    return payload !== null && packet.error === QUIC_PACKET_OK
  }

  /** Takes one stateless reset from the rate limit's budget, topping it up first. Answers whether one was there. */
  takeReset(): boolean {
    if (this.resetRefilled < 0) {
      this.resetRefilled = this.now
      this.resetBudget = QUIC_LISTENER_RESET_BURST
    }
    const earned: i64 = (this.now - this.resetRefilled) / QUIC_LISTENER_RESET_INTERVAL
    if (earned > 0) {
      const room: i64 = toI64(QUIC_LISTENER_RESET_BURST - this.resetBudget)
      this.resetBudget = this.resetBudget + toI32(earned < room ? earned : room)
      this.resetRefilled = this.resetRefilled + earned * QUIC_LISTENER_RESET_INTERVAL
    }
    if (this.resetBudget <= 0) {
      this.resetsLimited = this.resetsLimited + 1
      return false
    }
    this.resetBudget = this.resetBudget - 1
    this.resetsSent = this.resetsSent + 1
    return true
  }

  /**
   * A stateless reset into `answer`, answering an `n`-byte datagram sent to
   * the ID `datagram[dcidAt .. dcidAt + dcidLength)` (RFC 9000 §10.3): a
   * short-header first byte, unpredictable bytes, and the token for that
   * ID, computed in place by `quicConnResetTokenInto`. It is one byte
   * shorter than a datagram of up to 43 bytes and between 43 bytes and one
   * byte short of the datagram (at most 1200) otherwise, so it is always
   * shorter; a datagram too short for that to leave 21 bytes, or one past
   * the rate limit, gets nothing.
   */
  statelessReset(answer: QuicListenerAnswer, n: i32, datagram: u8[], dcidAt: i32, dcidLength: i32): void {
    if (n <= QUIC_LISTENER_MIN_RESET || !this.takeReset()) {
      return
    }
    let size: i32 = n - 1
    if (n > QUIC_LISTENER_SHORT_TRIGGER) {
      const most: i32 = n - 1 < QUIC_CONN_DATAGRAM_SIZE ? n - 1 : QUIC_CONN_DATAGRAM_SIZE
      const span: i32 = most - QUIC_LISTENER_SHORT_TRIGGER + 1
      const high: i32 = this.randomByte()
      const r: i32 = (high << 8) | this.randomByte()
      size = QUIC_LISTENER_SHORT_TRIGGER + (span > 0 ? r % span : 0)
    }
    const reply: u8[] = answer.reply
    const tokenAt: i32 = size - QUIC_RESET_TOKEN_SIZE
    quicListenerResize(reply, size)
    this.randomInto(reply, QUIC_LISTENER_FROM, tokenAt)
    reply[0] = toU8((toI32(reply[0]) & 0x3f) | 0x40)
    quicConnResetTokenInto(
      this.kdf.sha256,
      this.config.statelessResetKey,
      datagram,
      dcidAt,
      dcidLength,
      reply,
      tokenAt
    )
    answer.kind = QUIC_LISTEN_STATELESS_RESET
  }
}

/**
 * The next datagram `conn` sends at `now`, as `takeDatagram` answers it,
 * but only when the connection's pacer has the credit for a full datagram
 * (RFC 9002 §7.7); `null` when it has not, or when nothing is due. The
 * datagram is charged to the pacer at its real size.
 */
export const quicListenerTakePaced = (conn: QuicConnection, now: i64): u8[] | null => {
  if (conn.recovery.pacerDelay(now, QUIC_CONN_DATAGRAM_SIZE) > 0) {
    return null
  }
  const out: u8[] | null = conn.takeDatagram(now)
  if (out !== null) {
    conn.recovery.onPaced(now, toI32(out.length))
  }
  return out
}

/**
 * When `quicListenerTakePaced` next lets `conn` send a full datagram, in the
 * caller's milliseconds: `now` when it may already.
 */
export const quicListenerPaceTime = (conn: QuicConnection, now: i64): i64 =>
  now + conn.recovery.pacerDelay(now, QUIC_CONN_DATAGRAM_SIZE)

/** The most datagrams one GSO send carries: Linux's `UDP_MAX_SEGMENTS`. */
export const QUIC_LISTENER_FLIGHT_MAX: i32 = 64

/** What `quicListenerTakeFlight` wrote: how many datagrams, and the segment size to send them with. */
export class QuicFlight {
  /** The datagrams in the flight. */
  count: i32 = 0
  /** Every datagram's size but the last's, which may be shorter: the `UDP_SEGMENT` to send with. */
  segment: i32 = 0
}

/**
 * Writes the next flight `conn` sends at `now` into `buf[at .. at + cap)`,
 * datagram after datagram, for one GSO send, and answers its length in
 * bytes (0 for none); `flight` says how many datagrams it holds and the
 * segment size. Each datagram goes only when the pacer has credit for a full
 * one (RFC 9002 §7.7) and is charged at its real size, as
 * `quicListenerTakePaced` does, so the flight is the pacer's whole credit
 * and no more. It stops at the first datagram shorter than
 * `QUIC_CONN_DATAGRAM_SIZE`, which can only be the last of a segmented send,
 * at `QUIC_LISTENER_FLIGHT_MAX` datagrams, and when `cap` has no room for
 * another.
 */
export const quicListenerTakeFlight = (
  conn: QuicConnection,
  now: i64,
  buf: u8[],
  at: i32,
  cap: i32,
  flight: QuicFlight
): i32 => {
  flight.count = 0
  flight.segment = 0
  let length: i32 = 0
  while (
    flight.count < QUIC_LISTENER_FLIGHT_MAX &&
    length + QUIC_CONN_DATAGRAM_SIZE <= cap &&
    conn.recovery.pacerDelay(now, QUIC_CONN_DATAGRAM_SIZE) <= 0
  ) {
    const n: i32 = conn.takeDatagramInto(buf, at + length, now)
    if (n <= 0) {
      return length
    }
    conn.recovery.onPaced(now, n)
    if (flight.count === 0) {
      flight.segment = n
    }
    flight.count = flight.count + 1
    length = length + n
    if (n < QUIC_CONN_DATAGRAM_SIZE) {
      return length
    }
  }
  return length
}

/**
 * Hands `conn` the datagrams of one receive, `buf[off .. off + len)`, at
 * `now`: one datagram when `segment` is 0, else a GRO receive cut every
 * `segment` bytes (the last may be shorter). Each is read in place. Answers
 * how many it handed over.
 */
export const quicListenerReceiveSegments = (
  conn: QuicConnection,
  buf: u8[],
  off: i32,
  len: i32,
  segment: i32,
  now: i64
): i32 => {
  if (segment <= 0) {
    conn.receiveWindow(buf, off, len, now)
    return 1
  }
  let count: i32 = 0
  let at: i32 = 0
  while (at < len) {
    const n: i32 = len - at < segment ? len - at : segment
    conn.receiveWindow(buf, off + at, n, now)
    at = at + n
    count += 1
  }
  return count
}
