/**
 * `nish/net/quic-listener` — what a QUIC version 1 server answers to a
 * datagram no connection owns: Version Negotiation for a version it does not
 * speak (RFC 9000 §6, §17.2.1), a Retry that asks a client to prove its
 * address before any connection state exists (§8.1.2, §17.2.5), and a
 * stateless reset for a packet sent to a connection the server no longer has
 * (§10.3). Sans-IO, like the rest of `nish/net`, and stateless in the sense
 * the RFC means: nothing it answers depends on any connection.
 *
 *     import { QuicListener, QuicListenerAnswer, QUIC_LISTEN_ACCEPT } from "nish/net/quic-listener";
 *
 *     const listener = new QuicListener(config, entropy);      // entropy: QUIC_LISTENER_ENTROPY_SIZE random bytes
 *     // For a datagram whose first packet no connection owns (`ownsConnectionId`):
 *     const answer: QuicListenerAnswer = listener.handle(datagram, fromAddress, now);
 *     if (answer.kind === QUIC_LISTEN_ACCEPT) {
 *       const conn = new QuicConnection(config, connectionEntropy);
 *       if (answer.retried) { conn.acceptRetry(answer.originalDcid, answer.retryScid); }
 *       conn.receive(datagram, now);
 *     } else if (toI32(answer.reply.length) > 0) {
 *       … send answer.reply back to fromAddress …
 *     }
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
 * derives from the configuration's static key and the packet's connection
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
import { timingSafeEqual } from "nish/crypto/ct"
import { hmacSha256 } from "nish/crypto/hmac"
import {
  QUIC_AEAD_AES_128_GCM,
  QUIC_ERR_VERSION,
  QUIC_MAX_CID_LENGTH,
  QUIC_PACKET_INITIAL,
  QUIC_PACKET_OK,
  QUIC_PACKET_SHORT,
  QuicHeader,
  QuicInitialSecrets,
  QuicKeys,
  QuicPacket,
  quicInitialSecrets,
  quicKeys,
  quicLongHeader,
  quicOpenPacket,
  quicParseHeader,
  quicRetryPacket,
  quicSealPacket,
} from "nish/net/quic-packet"
import { QUIC_ERROR_INVALID_TOKEN, QUIC_RESET_TOKEN_SIZE, quicPushConnectionClose } from "nish/net/quic-frame"
import {
  QUIC_CONN_CID_LENGTH,
  QUIC_CONN_DATAGRAM_SIZE,
  QUIC_CONN_STATIC_KEY_SIZE,
  QuicConnection,
  QuicServerConfig,
  quicStatelessResetToken,
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

/**
 * What `QuicListener.handle` decided about one datagram: `kind` is a
 * `QUIC_LISTEN_*`, and `reply` the datagram to send back, empty when there is
 * none. For `QUIC_LISTEN_ACCEPT` after a Retry, `retried` is set and
 * `originalDcid` and `retryScid` are what `QuicConnection.acceptRetry` takes.
 */
export class QuicListenerAnswer {
  reply: u8[]
  originalDcid: u8[]
  retryScid: u8[]
  kind: i32 = 0
  retried: boolean = false

  constructor() {
    this.reply = []
    this.originalDcid = []
    this.retryScid = []
  }
}

/** The bytes `bytes[from .. from + length)`, copied into an array of exactly that size. */
const quicListenerSlice = (bytes: u8[], from: i32, length: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  const n: i32 = toI32(out.length)
  for (let k: i32 = 0; k < n; k += 1) {
    if (from + k >= 0 && from + k < toI32(bytes.length)) {
      out[k] = bytes[from + k]
    }
  }
  return out
}

/** Appends every byte of `bytes` to `out`. */
const quicListenerAppend = (out: u8[], bytes: u8[]): void => {
  for (const b of bytes) {
    out.push(b)
  }
}

/** Appends `value`'s low `size` bytes to `out`, big-endian. */
const quicListenerPushNumber = (out: u8[], value: i64, size: i32): void => {
  for (let k: i32 = size - 1; k >= 0; k -= 1) {
    out.push(toU8(toI32((value >> (toI64(k) * 8)) & 255)))
  }
}

/**
 * A Version Negotiation packet (RFC 9000 §17.2.1) answering a packet from
 * `scid` to `dcid`: the IDs swapped, version 0, and version 1 as the only one
 * supported. `unused` fills the first byte's low six bits, under the 0x40 the
 * RFC asks for so the packet looks like QUIC to a demultiplexer.
 *
 * TODO(WP34 Q1): every other packet format is `nish/net/quic-packet`'s; this
 * belongs beside `quicRetryPacket` there, which this stage may not edit.
 */
const quicListenerVersionNegotiation = (dcid: u8[], scid: u8[], unused: i32): u8[] => {
  const out: u8[] = []
  out.push(toU8((unused & 0x3f) | 0xc0))
  quicListenerPushNumber(out, 0, 4)
  out.push(toU8(toI32(scid.length)))
  quicListenerAppend(out, scid)
  out.push(toU8(toI32(dcid.length)))
  quicListenerAppend(out, dcid)
  quicListenerPushNumber(out, 1, 4)
  return out
}

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
 */
export class QuicListener {
  config: QuicServerConfig
  seed: u8[]
  /** Unpredictable bytes not yet used, from `poolHead`, and the counter the next block is made from. */
  pool: u8[]
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
    this.seed = quicListenerSlice(entropy, 0, QUIC_LISTENER_ENTROPY_SIZE)
    this.pool = []
    this.usable =
      toI32(entropy.length) === QUIC_LISTENER_ENTROPY_SIZE &&
      toI32(config.statelessResetKey.length) === QUIC_CONN_STATIC_KEY_SIZE &&
      toI32(config.retryTokenKey.length) === QUIC_CONN_STATIC_KEY_SIZE &&
      config.retryTokenLifetime >= 1 &&
      config.retryTokenLifetime <= QUIC_LISTENER_MAX_TOKEN_LIFETIME
    secureZero(entropy)
  }

  /** `count` unpredictable bytes: HMAC-SHA256 under the seed of a counter, a block at a time. */
  random(count: i32): u8[] {
    const out: u8[] = []
    while (toI32(out.length) < count) {
      if (this.poolHead >= toI32(this.pool.length)) {
        secureZero(this.pool)
        const block: u8[] = []
        quicListenerPushNumber(block, this.counter, 8)
        this.counter = this.counter + 1
        this.pool = hmacSha256(this.seed, block)
        this.poolHead = 0
      }
      if (this.poolHead >= 0 && this.poolHead < toI32(this.pool.length)) {
        out.push(this.pool[this.poolHead])
        this.pool[this.poolHead] = toU8(0)
      }
      this.poolHead = this.poolHead + 1
    }
    return out
  }

  /** One unpredictable value in 0 to 255. */
  randomByte(): i32 {
    const one: i32 = 1
    const b: u8[] = this.random(one)
    return toI32(b.length) > 0 ? toI32(b[0]) : 0
  }

  /**
   * Decides what to answer a datagram whose first packet no connection
   * owns, from `address` (the client's address as the caller's socket
   * reports it, port included) at `now` (the caller's monotonic time in
   * milliseconds). See the module header for the rules; nothing a peer sends
   * makes it panic.
   */
  handle(datagram: u8[], address: u8[], now: i64): QuicListenerAnswer {
    const answer: QuicListenerAnswer = new QuicListenerAnswer()
    if (now > this.now) {
      this.now = now
    }
    if (!this.usable) {
      return answer
    }
    const n: i32 = toI32(datagram.length)
    const header: QuicHeader = quicParseHeader(datagram, 0, QUIC_CONN_CID_LENGTH)
    if (header.error === QUIC_ERR_VERSION) {
      // §5.2.2: answer an unsupported version only in a datagram that could
      // start a connection, and §6.1: never a Version Negotiation packet.
      if (header.version !== 0 && n >= QUIC_CONN_DATAGRAM_SIZE) {
        answer.kind = QUIC_LISTEN_VERSION_NEGOTIATION
        answer.reply = quicListenerVersionNegotiation(header.dcid, header.scid, this.randomByte())
      }
      return answer
    }
    if (header.error !== QUIC_PACKET_OK) {
      return answer
    }
    if (header.type === QUIC_PACKET_SHORT) {
      return this.statelessReset(answer, n, header.dcid)
    }
    // §14.1, §7.2, §5.2.2: only an Initial in a full-sized datagram, sent to
    // a DCID of at least 8 bytes, can start a connection; the rest is dropped.
    if (header.type !== QUIC_PACKET_INITIAL || n < QUIC_CONN_DATAGRAM_SIZE || toI32(header.dcid.length) < 8) {
      return answer
    }
    const token: u8[] = header.token
    if (toI32(token.length) === 0 || toI32(token[0]) !== QUIC_LISTENER_TOKEN_MARKER) {
      if (!this.config.retry) {
        answer.kind = QUIC_LISTEN_ACCEPT
        return answer
      }
      return this.retry(answer, header, address)
    }
    if (this.tokenValid(token, header.dcid, address)) {
      answer.kind = QUIC_LISTEN_ACCEPT
      answer.retried = true
      answer.originalDcid = quicListenerSlice(
        token,
        QUIC_LISTENER_TOKEN_HEAD,
        toI32(token[QUIC_LISTENER_TOKEN_HEAD - 1])
      )
      answer.retryScid = header.dcid
      return answer
    }
    return this.invalidToken(answer, datagram, header)
  }

  /**
   * The token's MAC over its own bytes before the MAC (`head`), the ID the
   * client is to send to, and its address: what makes a token good for one
   * address and one connection only.
   */
  tokenMac(head: u8[], retryScid: u8[], address: u8[]): u8[] {
    const message: u8[] = []
    quicListenerAppend(message, head)
    message.push(toU8(toI32(retryScid.length)))
    quicListenerAppend(message, retryScid)
    quicListenerPushNumber(message, toI64(toI32(address.length)), 4)
    quicListenerAppend(message, address)
    const mac: u8[] = hmacSha256(this.config.retryTokenKey, message)
    const out: u8[] = quicListenerSlice(mac, 0, QUIC_LISTENER_TOKEN_MAC_SIZE)
    secureZero(mac)
    return out
  }

  /** A Retry token for the client at `address`, whose first Initial went to `odcid`, now told to send to `retryScid`. */
  issueToken(odcid: u8[], retryScid: u8[], address: u8[]): u8[] {
    const token: u8[] = []
    token.push(toU8(QUIC_LISTENER_TOKEN_MARKER))
    quicListenerPushNumber(token, this.now, 8)
    token.push(toU8(toI32(odcid.length)))
    quicListenerAppend(token, odcid)
    quicListenerAppend(token, this.tokenMac(token, retryScid, address))
    return token
  }

  /**
   * Whether `token` is one this listener issued for the client at `address`
   * that was told to send to `dcid`, and still within its lifetime: the
   * lengths add up, the MAC matches (compared in constant time), and it was
   * issued no later than now and less than `retryTokenLifetime` ago.
   */
  tokenValid(token: u8[], dcid: u8[], address: u8[]): boolean {
    const length: i32 = toI32(token.length)
    if (length < QUIC_LISTENER_TOKEN_HEAD + QUIC_LISTENER_TOKEN_MAC_SIZE) {
      return false
    }
    const odcidLength: i32 = toI32(token[QUIC_LISTENER_TOKEN_HEAD - 1])
    const head: i32 = QUIC_LISTENER_TOKEN_HEAD + odcidLength
    if (odcidLength > QUIC_MAX_CID_LENGTH || head + QUIC_LISTENER_TOKEN_MAC_SIZE !== length) {
      return false
    }
    const mac: u8[] = this.tokenMac(quicListenerSlice(token, 0, head), dcid, address)
    if (!timingSafeEqual(mac, quicListenerSlice(token, head, QUIC_LISTENER_TOKEN_MAC_SIZE))) {
      return false
    }
    let issued: i64 = 0
    for (let k: i32 = 1; k < QUIC_LISTENER_TOKEN_HEAD - 1; k += 1) {
      if (k < toI32(token.length)) {
        issued = (issued << 8) | toI64(token[k])
      }
    }
    return issued <= this.now && this.now - issued < this.config.retryTokenLifetime
  }

  /**
   * A Retry for the client's first Initial (RFC 9000 §8.1.2): a new
   * connection ID for the client to send to, and a token binding it, the
   * original DCID and the client's address to now.
   */
  retry(answer: QuicListenerAnswer, header: QuicHeader, address: u8[]): QuicListenerAnswer {
    const retryScid: u8[] = this.random(QUIC_CONN_CID_LENGTH)
    const token: u8[] = this.issueToken(header.dcid, retryScid, address)
    const packet: u8[] | null = quicRetryPacket(
      header.scid,
      retryScid,
      token,
      header.dcid,
      this.randomByte() & 15
    )
    if (packet !== null) {
      answer.kind = QUIC_LISTEN_RETRY
      answer.reply = packet
    }
    return answer
  }

  /**
   * The answer to an Initial carrying an invalid Retry token (RFC 9000
   * §8.1.2): an Initial with CONNECTION_CLOSE and INVALID_TOKEN, under the
   * Initial keys of the DCID the client sent to, from that DCID. It is sent
   * only when the client's Initial authenticates, so it answers a client and
   * not noise; it is far smaller than the datagram it answers.
   */
  invalidToken(answer: QuicListenerAnswer, datagram: u8[], header: QuicHeader): QuicListenerAnswer {
    const secrets: QuicInitialSecrets | null = quicInitialSecrets(header.dcid)
    if (secrets === null) {
      return answer
    }
    const read: QuicKeys | null = quicKeys(QUIC_AEAD_AES_128_GCM, secrets.client)
    if (read === null) {
      return answer
    }
    const opened: QuicPacket = quicOpenPacket(read, datagram, header, -1)
    // The write keys are derived only for an Initial that opened, so a forged
    // token on noise costs one derivation, not two.
    const write: QuicKeys | null =
      opened.error === QUIC_PACKET_OK ? quicKeys(QUIC_AEAD_AES_128_GCM, secrets.server) : null
    if (write === null) {
      return answer
    }
    const payload: u8[] = []
    const none: u8[] = []
    quicPushConnectionClose(payload, false, QUIC_ERROR_INVALID_TOKEN, 0, none)
    const first: u8[] | null = quicLongHeader(
      QUIC_PACKET_INITIAL,
      header.scid,
      header.dcid,
      none,
      0,
      1,
      toI32(payload.length)
    )
    if (first === null) {
      return answer
    }
    const packet: u8[] | null = quicSealPacket(write, first, 0, payload)
    if (packet !== null) {
      answer.kind = QUIC_LISTEN_INVALID_TOKEN
      answer.reply = packet
    }
    return answer
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
   * A stateless reset answering an `n`-byte datagram sent to `dcid` (RFC
   * 9000 §10.3): a short-header first byte, unpredictable bytes, and the
   * token for `dcid`. It is one byte shorter than a datagram of up to 43
   * bytes and between 43 bytes and one byte short of the datagram (at most
   * 1200) otherwise, so it is always shorter; a datagram too short for that
   * to leave 21 bytes, or one past the rate limit, gets nothing.
   */
  statelessReset(answer: QuicListenerAnswer, n: i32, dcid: u8[]): QuicListenerAnswer {
    if (n <= QUIC_LISTENER_MIN_RESET || !this.takeReset()) {
      return answer
    }
    let size: i32 = n - 1
    if (n > QUIC_LISTENER_SHORT_TRIGGER) {
      const most: i32 = n - 1 < QUIC_CONN_DATAGRAM_SIZE ? n - 1 : QUIC_CONN_DATAGRAM_SIZE
      const span: i32 = most - QUIC_LISTENER_SHORT_TRIGGER + 1
      const two: i32 = 2
      const pick: u8[] = this.random(two)
      const r: i32 = toI32(pick.length) > 1 ? (toI32(pick[0]) << 8) | toI32(pick[1]) : 0
      size = QUIC_LISTENER_SHORT_TRIGGER + (span > 0 ? r % span : 0)
    }
    const reply: u8[] = this.random(size - QUIC_RESET_TOKEN_SIZE)
    if (toI32(reply.length) > 0) {
      reply[0] = toU8((toI32(reply[0]) & 0x3f) | 0x40)
    }
    quicListenerAppend(reply, quicStatelessResetToken(this.config.statelessResetKey, dcid))
    answer.kind = QUIC_LISTEN_STATELESS_RESET
    answer.reply = reply
    return answer
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
