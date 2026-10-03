/**
 * `nish/net/quic` — the server side of a QUIC version 1 connection (RFC 9000,
 * RFC 9001): the TLS 1.3 handshake carried in CRYPTO frames at three
 * encryption levels, transport parameters both ways, acknowledgements per
 * packet number space, the connection-ID table, and stream data once the
 * handshake is done. Sans-IO, like the rest of `nish/net`.
 *
 *     import { QuicConnection, QuicServerConfig } from "nish/net/quic";
 *
 *     const conn = new QuicConnection(config, entropy);   // entropy: QUIC_CONN_ENTROPY_SIZE random bytes
 *     conn.receive(datagram, now);                         // every datagram the client sends; now in ms
 *     const input: u8[] | null = conn.signatureInput();
 *     if (input !== null) { conn.sign(tlsSignEcdsaP256(key, input)); }
 *     let out: u8[] | null = conn.takeDatagram(now);
 *     while (out !== null) { … send it to the client … ; out = conn.takeDatagram(now); }
 *     let data: QuicStreamData | null = conn.readStream();  // what the client sent on its streams
 *     … and at conn.deadline(), conn.handleTimer(now)
 *
 * **What it is.** One connection, from the client's first Initial to a
 * CONNECTION_CLOSE either way. The handshake is `nish/net/tls`'s `TlsServer`,
 * driven over QUIC as RFC 9001 §4 describes: the bytes it writes at each
 * level go out in CRYPTO frames of the matching packet number space, the
 * bytes the client sends in CRYPTO frames are put back in order and handed to
 * it, and each level's packet keys are made with `nish/net/quic-packet`'s
 * `quicKeys` as soon as `TlsServer` knows the secret. The server's transport
 * parameters, `original_destination_connection_id` and
 * `initial_source_connection_id` among them, go into EncryptedExtensions; the
 * client's are parsed and checked (RFC 9000 §7.3, §7.4) before the server's
 * flight leaves.
 *
 * **What it is not, yet.** Loss recovery is WP34 Q3: nothing is
 * retransmitted, so a lost packet is lost, and the handshake completes only
 * where nothing is (loopback). Streams with flow-control updates are Q4: the
 * credit the server advertises is never raised, so a stream carries at most
 * `maxStreamData` bytes each way and the connection `maxData`. The server
 * opens no stream of its own and accepts no unidirectional stream. What a
 * server answers before a connection exists — Version Negotiation, Retry and
 * a stateless reset — is `nish/net/quic-listener`'s.
 *
 * **Time.** The connection has no clock: `receive`, `takeDatagram` and
 * `handleTimer` take the caller's monotonic time in milliseconds, and
 * `deadline()` says when `handleTimer` is next due. Two things run on it.
 * The idle timeout (RFC 9000 §10.1) is the smaller of the two sides'
 * `max_idle_timeout`, never under `QUIC_CONN_IDLE_FLOOR`; once it passes with
 * nothing received, the connection closes silently (`QUIC_STATE_TIMED_OUT`)
 * and wipes its keys. And after a key update the previous read keys are kept
 * for `QUIC_CONN_PTO`, for packets the network reordered, before the next
 * generation's are derived (RFC 9001 §6.5).
 *
 * **Key update** (RFC 9001 §6), both ways. A 1-RTT packet whose Key Phase
 * bit differs from the current one is opened with the next generation's read
 * keys, which are derived ahead of time so that a forged bit costs no
 * derivation and shows no timing difference (§6.3); if it opens, the client
 * has updated, and the server's write keys follow before anything is
 * acknowledged (§6.2). `updateKeys()` starts an update from the server once
 * the client has acknowledged a packet of the current phase (§6.1). Each
 * update the client starts costs two key derivations, which stay in the arena
 * (QUIC-4 in `docs/security/quic.md`), so a connection takes at most
 * `QUIC_CONN_MAX_KEY_UPDATES` of them and closes on the next with
 * KEY_UPDATE_ERROR.
 *
 * **Sans-IO and deterministic.** No socket, no clock and no random device:
 * every random choice (the TLS server random and ephemeral key, the server's
 * first connection ID, and the seed later IDs are derived from) comes from
 * the `entropy` the constructor takes, every stateless reset token from the
 * configuration's static key (RFC 9000 §10.3.2), and every ACK says a delay
 * of zero. So a recorded exchange replays byte for byte.
 *
 * **What a peer cannot do.** Nothing it sends makes this module panic. A
 * datagram that does not parse, a packet that does not authenticate, a
 * duplicate packet number, a packet for keys already discarded and a 1-RTT
 * packet before the handshake is done are dropped and counted in `dropped`.
 * A frame that breaks the protocol closes the connection with the transport
 * error RFC 9000 names (`QUIC_ERROR_*` in `nish/net/quic-frame`), a TLS alert
 * closes it with CRYPTO_ERROR (0x100 + the alert), and the CONNECTION_CLOSE
 * is the next datagram out. Before the client's address is validated — by a
 * Handshake packet, or by a Retry token `nish/net/quic-listener` checked —
 * the server sends at most three times what it received (§8.1). Every buffer
 * a peer can fill is bounded: CRYPTO reassembly by `QUIC_CONN_CRYPTO_WINDOW`,
 * streams by the credit advertised, the connection-ID table by the limit
 * advertised, and the received packet numbers by `QUIC_ACK_MAX_RANGES`.
 *
 * **Secrets.** The packet keys of each level live in this connection's
 * fields as long as the level does, and in `TlsServer`'s (TLS-1); so do the
 * 1-RTT secrets the next key generation is derived from, and the next
 * generation's read keys. A `Secret` may not be a field (NL2430), so they are
 * plain bytes; `secureZero` wipes each level's key, IV and header-protection
 * key when the level is discarded, each generation's key, IV and secret when
 * a key update replaces it, and `release()` the rest — the 1-RTT keys, the
 * traffic secrets `TlsServer` holds, its ephemeral key and the
 * connection-ID seed. What no wipe reaches (the expanded AES key schedules,
 * the HKDF and HMAC intermediates in arena memory) is recorded as QUIC-2 in
 * `docs/security/quic.md`, with #430, the follow-up that moves these structs
 * onto `nish:secret`.
 *
 * Written from RFC 9000 and RFC 9001, in this module's own structure;
 * nothing here is ported from another implementation. Private names carry
 * the `quicConn` prefix (`docs/wp26-stdlib.md` §3e).
 */
import { timingSafeEqual } from "nish/crypto/ct"
import { hmacSha256 } from "nish/crypto/hmac"
import {
  QUIC_AEAD_AES_128_GCM,
  QUIC_AEAD_AES_256_GCM,
  QUIC_AEAD_CHACHA20_POLY1305,
  QUIC_AEAD_TAG_SIZE,
  QUIC_ERR_RESERVED_BITS,
  QUIC_MAX_CID_LENGTH,
  QUIC_MAX_VARINT,
  QUIC_PACKET_HANDSHAKE,
  QUIC_PACKET_INITIAL,
  QUIC_PACKET_OK,
  QUIC_PACKET_SHORT,
  QuicHeader,
  QuicInitialSecrets,
  QuicKeys,
  QuicPacket,
  quicDecryptPacket,
  quicInitialSecrets,
  quicKeyUpdateSecret,
  quicKeys,
  quicKeysUpdate,
  quicLongHeader,
  quicPacketNumberLength,
  quicParseHeader,
  quicRemoveHeaderProtection,
  quicSealPacket,
  quicShortHeader,
} from "nish/net/quic-packet"
import {
  QUIC_ERROR_APPLICATION,
  QUIC_ERROR_CRYPTO,
  QUIC_ERROR_CRYPTO_BUFFER_EXCEEDED,
  QUIC_ERROR_FINAL_SIZE,
  QUIC_ERROR_FLOW_CONTROL,
  QUIC_ERROR_INTERNAL,
  QUIC_ERROR_KEY_UPDATE,
  QUIC_ERROR_NO_ERROR,
  QUIC_ERROR_PROTOCOL_VIOLATION,
  QUIC_ERROR_STREAM_LIMIT,
  QUIC_ERROR_STREAM_STATE,
  QUIC_ERROR_TRANSPORT_PARAMETER,
  QUIC_FRAME_ACK,
  QUIC_FRAME_ACK_ECN,
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_CONNECTION_CLOSE_APP,
  QUIC_FRAME_CRYPTO,
  QUIC_FRAME_HANDSHAKE_DONE,
  QUIC_FRAME_MAX_DATA,
  QUIC_FRAME_MAX_STREAM_DATA,
  QUIC_FRAME_NEW_CONNECTION_ID,
  QUIC_FRAME_NEW_TOKEN,
  QUIC_FRAME_PATH_CHALLENGE,
  QUIC_FRAME_PATH_RESPONSE,
  QUIC_FRAME_RESET_STREAM,
  QUIC_FRAME_RETIRE_CONNECTION_ID,
  QUIC_FRAME_STOP_SENDING,
  QUIC_FRAME_STREAM,
  QUIC_FRAME_STREAM_DATA_BLOCKED,
  QUIC_PATH_DATA_SIZE,
  QUIC_RESET_TOKEN_SIZE,
  QuicFrame,
  quicCryptoOverhead,
  quicFrameAckEliciting,
  quicFrameAllowed,
  quicParseFrame,
  quicPushConnectionClose,
  quicPushCrypto,
  quicPushNewConnectionId,
  quicPushPadding,
  quicPushPathData,
  quicPushStream,
  quicPushTypeOnly,
  quicPushValue,
  quicStreamOverhead,
} from "nish/net/quic-frame"
import {
  QuicTransportParameters,
  quicEncodeTransportParameters,
  quicParseTransportParameters,
} from "nish/net/quic-conn-params"
import { QuicAckRanges } from "nish/net/quic-conn-ack"
import { QuicCidEntry, QuicCidTable } from "nish/net/quic-conn-cid"
import {
  TLS_LEVEL_APPLICATION,
  TLS_LEVEL_HANDSHAKE,
  TLS_LEVEL_INITIAL,
  TLS_STATE_CONNECTED,
  TLS_STATE_WAIT_CLIENT_HELLO,
  TLS_STATE_WAIT_SIGNATURE,
  TlsServer,
  TlsServerConfig,
} from "nish/net/tls"
import { TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256 } from "nish/net/tls/schedule"

// ---- Sizes ----------------------------------------------------------------------

/** The length of every connection ID this server issues; a short header's DCID is read at this length. */
export const QUIC_CONN_CID_LENGTH: i32 = 8
/**
 * The largest datagram the server sends, and the smallest a client's first
 * Initial may arrive in (RFC 9000 §14.1): 1200 bytes, which every QUIC path
 * carries, so no path MTU discovery is needed.
 */
export const QUIC_CONN_DATAGRAM_SIZE: i32 = 1200
/**
 * How many random bytes the constructor takes: 32 for the TLS server random,
 * 32 for the x25519 key, 8 for the first connection ID and 32 for the seed
 * the later IDs and their reset tokens are derived from.
 */
export const QUIC_CONN_ENTROPY_SIZE: i32 = 104
/**
 * How far ahead of what it has handed TLS the server buffers CRYPTO data at
 * one level. RFC 9000 §7.5 asks for at least 4096 bytes; a frame past this
 * is CRYPTO_BUFFER_EXCEEDED.
 */
export const QUIC_CONN_CRYPTO_WINDOW: i32 = 16384
/** The most connection IDs the server keeps active for the client to use, its own first one included. */
export const QUIC_CONN_LOCAL_CIDS: i32 = 4
/** The largest per-stream credit a configuration may advertise, which is also each stream's receive buffer. */
export const QUIC_CONN_MAX_STREAM_DATA: i64 = 1048576
/** The most bidirectional streams a configuration may let the client open. */
export const QUIC_CONN_MAX_STREAMS: i64 = 1024
/** The length of the configuration's static keys: the stateless reset key and the Retry token key. */
export const QUIC_CONN_STATIC_KEY_SIZE: i32 = 32
/**
 * The probe timeout, in milliseconds, this module times by. Measuring the
 * round trip is loss recovery's (WP34 Q3), so until then it is RFC 9002
 * §6.2.2's for a path with no sample yet: an initial RTT of 333 ms, which
 * gives about one second.
 */
export const QUIC_CONN_PTO: i64 = 1000
/**
 * The shortest idle timeout the server keeps, three times `QUIC_CONN_PTO`:
 * RFC 9000 §10.1 has an endpoint raise a smaller negotiated value to this, so
 * that several probes can be lost before the connection is given up.
 */
export const QUIC_CONN_IDLE_FLOOR: i64 = 3000
/**
 * How many key updates a connection takes from its client (RFC 9001 §6).
 * Each costs two key derivations whose temporaries stay in the arena, so the
 * cap bounds what a client can make the server derive (QUIC-4); the next one
 * closes the connection with KEY_UPDATE_ERROR. A client also has to wait
 * `QUIC_CONN_PTO` between two of them, so 64 is over a minute of updating.
 */
export const QUIC_CONN_MAX_KEY_UPDATES: i32 = 64

// ---- States ---------------------------------------------------------------------

/** Waiting for the client's first Initial packet. */
export const QUIC_STATE_WAIT_INITIAL: i32 = 0
/** The handshake is under way. */
export const QUIC_STATE_HANDSHAKE: i32 = 1
/** The handshake is complete and confirmed; stream data flows. */
export const QUIC_STATE_CONNECTED: i32 = 2
/** This side closed the connection: one CONNECTION_CLOSE goes out, then nothing. `error` says why. */
export const QUIC_STATE_CLOSING: i32 = 3
/** The client closed the connection: nothing more goes out (RFC 9000 §10.2.2). `error` is its code. */
export const QUIC_STATE_DRAINING: i32 = 4
/**
 * The idle timeout passed (RFC 9000 §10.1): the connection closed silently,
 * its keys wiped, and nothing more goes out. Its state is to be discarded:
 * drop the connection, so that a later packet to its IDs reaches
 * `nish/net/quic-listener`, whose stateless reset tells the client.
 */
export const QUIC_STATE_TIMED_OUT: i32 = 5

// ---- writeStream's answers ------------------------------------------------------

/** The data was queued. */
export const QUIC_STREAM_OK: i32 = 0
/** No such stream: the client has not opened it. */
export const QUIC_STREAM_ERR_UNKNOWN: i32 = -1
/** The stream's sending side is already finished. */
export const QUIC_STREAM_ERR_FINISHED: i32 = -2
/** The data would pass the credit the client gave, for the stream or the connection. */
export const QUIC_STREAM_ERR_FLOW: i32 = -3
/** The connection is not connected. */
export const QUIC_STREAM_ERR_STATE: i32 = -4

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const QUIC_CONN_FROM: i32 = 0
/** The same for the `i64` arguments of the methods below, where a literal is not given its parameter's type. */
const QUIC_CONN_NONE: i64 = 0

/**
 * What a QUIC server is configured with, the same for every connection. The
 * limits are the transport parameters it advertises (RFC 9000 §18.2).
 */
export interface QuicServerConfig {
  /** DER certificates, leaf first, as `TlsServerConfig` takes them. */
  certificateChain: u8[][]
  /** The ALPN protocols the server speaks, most preferred first; QUIC requires one to match (RFC 9001 §8.1). */
  alpn: string[]
  /** The signature scheme the caller's key signs with, as `TlsServerConfig` takes it. */
  signatureScheme: i32
  /** Whether `nish/net/quic-listener` answers a client's first Initial with a Retry (§8.1.2). */
  retry: boolean
  /** `initial_max_data`: the most stream bytes the client may send over the connection, 0 to 2^62 − 1. */
  maxData: i64
  /** `initial_max_stream_data_bidi_remote`: the most bytes the client may send on each stream, 1 to 1 MiB. */
  maxStreamData: i64
  /** `initial_max_streams_bidi`: how many bidirectional streams the client may open, 0 to 1024. */
  maxStreamsBidi: i64
  /**
   * `max_idle_timeout` in milliseconds: 0 for none, at most 2^62 − 1. The
   * connection times out after the smaller of this and the client's, and
   * never sooner than `QUIC_CONN_IDLE_FLOOR`.
   */
  maxIdleTimeout: i64
  /** `active_connection_id_limit`: how many of its connection IDs the client may give the server, 2 to 8. */
  activeConnectionIdLimit: i64
  /** How long, in milliseconds, a Retry token is accepted after it was issued: 1 to 60000. */
  retryTokenLifetime: i64
  /**
   * The static key every stateless reset token is derived from
   * (`quicStatelessResetToken`, RFC 9000 §10.3.2), `QUIC_CONN_STATIC_KEY_SIZE`
   * bytes. Keep it across restarts: a server that lost a connection resets it
   * with the token this key gives for the connection ID the client sends to.
   */
  statelessResetKey: u8[]
  /** The key `nish/net/quic-listener` authenticates its Retry tokens with (§8.1.4), `QUIC_CONN_STATIC_KEY_SIZE` bytes. */
  retryTokenKey: u8[]
}

/** One run of stream data the client sent, in order: `fin` when it ends the stream. */
export class QuicStreamData {
  streamId: i64 = 0
  data: u8[]
  fin: boolean = false

  constructor(streamId: i64, data: u8[], fin: boolean) {
    this.streamId = streamId
    this.data = data
    this.fin = fin
  }
}

/**
 * Bytes of one stream (CRYPTO or STREAM) put back in order. Data is kept in
 * a ring of `capacity` bytes indexed by offset, beside a byte per slot saying
 * whether it arrived, so frames may come in any order and overlap; `take`
 * answers the run that now continues from what was delivered. A frame
 * reaching `capacity` bytes past what was delivered is refused, which is
 * what bounds the buffer. Nothing is allocated until a frame arrives out of
 * order: data that continues the stream goes straight through.
 */
class QuicConnReassembly {
  /** How many bytes have been handed out. */
  delivered: i64 = 0
  /** How many bytes past `delivered` are buffered. */
  pending: i32 = 0
  capacity: i32 = 0
  ring: u8[]
  have: u8[]
  /** Bytes that continue the stream, waiting for `take`. */
  ready: u8[]

  constructor(capacity: i32) {
    this.capacity = capacity
    this.ring = []
    this.have = []
    this.ready = []
  }

  /** The ring slot of stream offset `offset`. */
  slot(offset: i64): i32 {
    return toI32(offset % toI64(this.capacity))
  }

  /**
   * Takes `data[from .. from + length)`, which sits at stream offset
   * `offset`. Answers `false`, taking nothing, when it reaches `capacity` or
   * more past what was delivered. Bytes already delivered are skipped.
   */
  insert(offset: i64, data: u8[], from: i32, length: i32): boolean {
    const deliveredNow: i64 = this.delivered + toI64(toI32(this.ready.length))
    if (offset + toI64(length) > deliveredNow + toI64(this.capacity)) {
      return false
    }
    if (this.pending === 0 && offset <= deliveredNow) {
      // The common case: in order, or overlapping what was delivered.
      const skip: i64 = deliveredNow - offset
      for (let k: i64 = skip; k < toI64(length); k += 1) {
        const at: i32 = from + toI32(k)
        if (at >= 0 && at < toI32(data.length)) {
          this.ready.push(data[at])
        }
      }
      return true
    }
    if (toI32(this.ring.length) === 0) {
      this.ring = new Array<u8>(this.capacity)
      this.have = new Array<u8>(this.capacity)
    }
    for (let k: i32 = 0; k < length; k += 1) {
      const position: i64 = offset + toI64(k)
      const at: i32 = from + k
      if (position >= deliveredNow && at >= 0 && at < toI32(data.length)) {
        const s: i32 = this.slot(position)
        if (s >= 0 && s < toI32(this.ring.length) && s < toI32(this.have.length)) {
          if (toI32(this.have[s]) === 0) {
            this.pending = this.pending + 1
          }
          this.ring[s] = data[at]
          this.have[s] = toU8(1)
        }
      }
    }
    // Move whatever now continues the stream out of the ring.
    let next: i64 = deliveredNow
    while (this.pending > 0) {
      const s: i32 = this.slot(next)
      if (
        s < 0 ||
        s >= toI32(this.ring.length) ||
        s >= toI32(this.have.length) ||
        toI32(this.have[s]) === 0
      ) {
        break
      }
      this.ready.push(this.ring[s])
      this.have[s] = toU8(0)
      this.pending = this.pending - 1
      next += 1
    }
    return true
  }

  /** The bytes that continue the stream since the last call, and forgets them. */
  take(): u8[] {
    const out: u8[] = this.ready
    this.ready = []
    this.delivered = this.delivered + toI64(toI32(out.length))
    return out
  }
}

/** One packet number space's state (RFC 9000 §12.3): its keys, its numbers, its CRYPTO stream. */
class QuicConnSpace {
  readKeys: QuicKeys | null = null
  writeKeys: QuicKeys | null = null
  /** The next packet number to send. */
  nextPn: i64 = 0
  /** The largest packet number the client acknowledged here, or -1. */
  largestAcked: i64 = -1
  received: QuicAckRanges
  cryptoIn: QuicConnReassembly
  /** CRYPTO bytes still to send, from `cryptoOutHead`, at stream offset `cryptoOutOffset`. */
  cryptoOut: u8[]
  cryptoOutOffset: i64 = 0
  /** `TLS_LEVEL_INITIAL`, `_HANDSHAKE` or `_APPLICATION`, which is also the space's index. */
  level: i32 = 0
  cryptoOutHead: i32 = 0
  /** Whether the keys were discarded (RFC 9001 §4.9): nothing is sent or received here again. */
  discarded: boolean = false

  constructor(level: i32) {
    this.level = level
    this.received = new QuicAckRanges()
    this.cryptoIn = new QuicConnReassembly(QUIC_CONN_CRYPTO_WINDOW)
    this.cryptoOut = []
  }

  /** How many CRYPTO bytes are waiting to be sent. */
  cryptoUnsent(): i32 {
    return toI32(this.cryptoOut.length) - this.cryptoOutHead
  }
}

/** One stream the client opened: what it sent, put back in order, and what the server queued to send back. */
class QuicConnStream {
  id: i64 = 0
  recv: QuicConnReassembly
  /** The highest offset the client sent data to, which flow control counts. */
  recvHighest: i64 = 0
  /** The stream's final size once a FIN or RESET_STREAM fixed it, or -1. */
  finalSize: i64 = -1
  /** Bytes queued to send, from `sendHead`, at stream offset `sendOffset`. */
  send: u8[]
  sendOffset: i64 = 0
  /** The credit the client gave for this stream: no byte at or past this offset may be sent. */
  sendLimit: i64 = 0
  sendHead: i32 = 0
  /** Whether the end of the stream was handed to the application. */
  finDelivered: boolean = false
  /** Whether the client reset the stream; its data is then dropped. */
  reset: boolean = false
  /** Whether the application finished the sending side. */
  sendFin: boolean = false
  /** Whether a frame carrying the FIN went out, or STOP_SENDING ended the side. */
  finSent: boolean = false

  constructor(id: i64, capacity: i32, sendLimit: i64) {
    this.id = id
    this.recv = new QuicConnReassembly(capacity)
    this.send = []
    this.sendLimit = sendLimit
  }

  /** How many queued bytes have not gone out. */
  unsent(): i32 {
    return toI32(this.send.length) - this.sendHead
  }

  /** Whether a frame is owed: queued bytes, or a FIN not yet sent. */
  wantsToSend(): boolean {
    return !this.finSent && (this.unsent() > 0 || this.sendFin)
  }
}

/** The bytes `bytes[from .. from + length)`, copied into an array of exactly that size. */
const quicConnSlice = (bytes: u8[], from: i32, length: i32): u8[] => {
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
const quicConnAppend = (out: u8[], bytes: u8[]): void => {
  for (const b of bytes) {
    out.push(b)
  }
}

/** The packet-protection AEAD that goes with a TLS 1.3 suite (RFC 9001 §5.3). */
const quicConnAead = (suite: i32): i32 => {
  if (suite === TLS_AES_256_GCM_SHA384) {
    return QUIC_AEAD_AES_256_GCM
  }
  if (suite === TLS_CHACHA20_POLY1305_SHA256) {
    return QUIC_AEAD_CHACHA20_POLY1305
  }
  return QUIC_AEAD_AES_128_GCM
}

/** Wipes a level's key, IV and header-protection key; the expanded AES schedules are out of reach (QUIC-2). */
const quicConnWipeKeys = (keys: QuicKeys | null): void => {
  quicConnWipePacketKey(keys)
  if (keys !== null) {
    secureZero(keys.hp)
  }
}

/**
 * Wipes a key generation's packet key and IV that a key update replaced. The
 * header-protection key is left alone: every generation shares it (RFC 9001
 * §6), so it goes only when the level does.
 */
const quicConnWipePacketKey = (keys: QuicKeys | null): void => {
  if (keys !== null) {
    secureZero(keys.key)
    secureZero(keys.iv)
  }
}

/**
 * The stateless reset token for the connection ID `cid` (RFC 9000 §10.3.2):
 * the first 16 bytes of HMAC-SHA256 under the server's static `key`. A
 * connection hands it to the client with each ID it issues, and
 * `nish/net/quic-listener` derives the same token from a packet's ID alone
 * once the connection is gone, which is what lets a server that lost its
 * state end the connection.
 */
export const quicStatelessResetToken = (key: u8[], cid: u8[]): u8[] => {
  const mac: u8[] = hmacSha256(key, cid)
  const token: u8[] = quicConnSlice(mac, 0, QUIC_RESET_TOKEN_SIZE)
  secureZero(mac)
  return token
}

/** Whether the configuration's limits are ones this module can honour. */
const quicConnConfigFits = (config: QuicServerConfig): boolean =>
  config.maxStreamData >= 1 &&
  config.maxStreamData <= QUIC_CONN_MAX_STREAM_DATA &&
  config.maxStreamsBidi >= 0 &&
  config.maxStreamsBidi <= QUIC_CONN_MAX_STREAMS &&
  config.maxData >= 0 &&
  config.maxData <= QUIC_MAX_VARINT &&
  config.maxIdleTimeout >= 0 &&
  config.maxIdleTimeout <= QUIC_MAX_VARINT &&
  config.activeConnectionIdLimit >= 2 &&
  config.activeConnectionIdLimit <= 8 &&
  toI32(config.statelessResetKey.length) === QUIC_CONN_STATIC_KEY_SIZE

/**
 * One server connection. Make one when a client's first Initial arrives,
 * hand it every datagram the client sends with `receive`, sign when
 * `signatureInput()` asks, send what `takeDatagram()` answers until it
 * answers `null`, and read and write stream data once `state` is
 * `QUIC_STATE_CONNECTED`.
 *
 * The fields are readable: `state`, `error` (the transport error or
 * application code the connection closed with), `dropped`, `alpn` and
 * `serverName` once the handshake has read them, `peerParameters`, and
 * `cids`, the connection-ID table, which a server that runs many connections
 * routes datagrams by (`ownsConnectionId`).
 */
export class QuicConnection {
  config: QuicServerConfig
  /** The error code the connection closed with: a transport error, `0x100 + alert`, or the application's code. */
  error: i64 = 0
  /** For a transport error: the type of the frame that caused it, or 0. */
  errorFrameType: i64 = 0
  serverRandom: u8[]
  ephemeralPrivate: u8[]
  cidSeed: u8[]
  /** The DCID of the client's first Initial, which the Initial keys come from. */
  originalDcid: u8[]
  /** The SCID of the client's first Initial: where long-header packets go, and what its transport parameters must name. */
  peerScid: u8[]
  /** The server's first connection ID, the SCID of every long-header packet it sends. */
  localScid: u8[]
  tls: TlsServer | null = null
  initial: QuicConnSpace
  handshake: QuicConnSpace
  application: QuicConnSpace
  cids: QuicCidTable
  /** The client's transport parameters, once the handshake has checked them. */
  peerParameters: QuicTransportParameters
  /** Bytes received and sent, for the anti-amplification limit (RFC 9000 §8.1). */
  bytesReceived: i64 = 0
  bytesSent: i64 = 0
  /** The ALPN protocol the handshake chose. */
  alpn: string = ""
  /** The client's `server_name`, or empty. */
  serverName: string = ""
  streams: QuicConnStream[]
  /** Stream data delivered in order and not yet read, from `eventHead`. */
  events: QuicStreamData[]
  /** PATH_CHALLENGE data to answer, eight bytes each. */
  pathResponses: u8[]
  /** The connection-level credit the client gave, and what the server has queued against it. */
  peerMaxData: i64 = 0
  sentData: i64 = 0
  /** Stream bytes the client sent, counted at each stream's highest offset, against `config.maxData`. */
  receivedData: i64 = 0
  frame: QuicFrame
  /** For a connection `acceptRetry` set up: the DCID of the client's Initial before the Retry, and the Retry's SCID. */
  retryOriginalDcid: u8[]
  retryScid: u8[]
  /** The latest time the caller gave, in milliseconds; time never runs backwards here. */
  now: i64 = 0
  /** When the idle timer last restarted (RFC 9000 §10.1), or -1 before the first packet. */
  idleSince: i64 = -1
  /**
   * The 1-RTT secrets of the current generation, the next generation's read
   * secret, and its read keys (RFC 9001 §6.1, §6.3). `otherReadKeys` holds
   * the next generation's while `otherIsNext`, and for `QUIC_CONN_PTO` after
   * an update the previous one's, for reordered packets (§6.5).
   */
  appReadSecret: u8[]
  appWriteSecret: u8[]
  nextReadSecret: u8[]
  otherReadKeys: QuicKeys | null = null
  /** The lowest and highest packet numbers opened with the current read keys, or -1. */
  readPhaseLowest: i64 = -1
  readPhaseHighest: i64 = -1
  /** The first packet number sent with the current write keys. */
  writePhaseFirst: i64 = 0
  /** When the previous read keys go and the next are derived, or -1. */
  keyRetainUntil: i64 = -1
  state: i32 = 0
  /** Packets dropped without closing the connection: unparseable, unauthenticated, duplicated, or for keys not held. */
  dropped: i32 = 0
  eventHead: i32 = 0
  /** Key updates the client started, against `QUIC_CONN_MAX_KEY_UPDATES`. */
  keyUpdates: i32 = 0
  /** How long the ACK opening the payload `buildPayload` last wrote is: 0 for none. */
  ackLength: i32 = 0
  /** Whether `error` is an application code (CONNECTION_CLOSE 0x1d) rather than a transport error. */
  errorIsApplication: boolean = false
  /** Whether the one CONNECTION_CLOSE this side owes has gone out. */
  closeSent: boolean = false
  /** Whether the client's address is validated: a Handshake packet from it was processed. */
  addressValidated: boolean = false
  /** Whether the handshake is complete, which for a server is also confirmed (RFC 9001 §4.1.2). */
  handshakeComplete: boolean = false
  handshakeDonePending: boolean = false
  /** Whether the connection was set up by `acceptRetry`. */
  retried: boolean = false
  /** Whether an ack-eliciting packet went out since the last packet was received. */
  elicitingSent: boolean = false
  /** Whether `otherReadKeys` are the next generation's rather than the previous one's. */
  otherIsNext: boolean = false
  /** The Key Phase bit of the current read keys, and of the current write keys. */
  readPhase: boolean = false
  writePhase: boolean = false

  /**
   * A connection under `config`, with `entropy` its `QUIC_CONN_ENTROPY_SIZE`
   * random bytes, which are copied out and then wiped in the caller's array.
   * Entropy of another length, or limits outside what `QuicServerConfig`
   * documents, leave the connection closing with INTERNAL_ERROR before it
   * reads anything; it then sends nothing.
   */
  constructor(config: QuicServerConfig, entropy: u8[]) {
    this.config = config
    this.serverRandom = quicConnSlice(entropy, 0, 32)
    this.ephemeralPrivate = quicConnSlice(entropy, 32, 32)
    this.localScid = quicConnSlice(entropy, 64, QUIC_CONN_CID_LENGTH)
    this.cidSeed = quicConnSlice(entropy, 72, 32)
    this.originalDcid = []
    this.peerScid = []
    this.initial = new QuicConnSpace(TLS_LEVEL_INITIAL)
    this.handshake = new QuicConnSpace(TLS_LEVEL_HANDSHAKE)
    this.application = new QuicConnSpace(TLS_LEVEL_APPLICATION)
    this.cids = new QuicCidTable(config.activeConnectionIdLimit)
    this.peerParameters = new QuicTransportParameters()
    this.streams = []
    this.events = []
    this.pathResponses = []
    this.frame = new QuicFrame()
    this.retryOriginalDcid = []
    this.retryScid = []
    this.appReadSecret = []
    this.appWriteSecret = []
    this.nextReadSecret = []
    const fits: boolean = toI32(entropy.length) === QUIC_CONN_ENTROPY_SIZE && quicConnConfigFits(config)
    secureZero(entropy)
    if (!fits) {
      this.state = QUIC_STATE_CLOSING
      this.error = QUIC_ERROR_INTERNAL
      this.closeSent = true
    }
  }

  /** Counts a dropped packet; the count stops at the largest `i32` rather than overflow. */
  drop(): void {
    if (this.dropped < 2147483647) {
      this.dropped += 1
    }
  }

  /** Whether the connection has closed, either way. */
  closed(): boolean {
    return (
      this.state === QUIC_STATE_CLOSING ||
      this.state === QUIC_STATE_DRAINING ||
      this.state === QUIC_STATE_TIMED_OUT
    )
  }

  /**
   * Sets up a connection whose client came back with a Retry token that
   * `nish/net/quic-listener` checked (RFC 9000 §8.1.2): `originalDcid` is the
   * DCID of the client's Initial before the Retry, and `retryScid` the
   * Retry's SCID, which the client now sends to. The server's transport
   * parameters then name both (§7.3), and the client's address counts as
   * validated, so the anti-amplification limit does not apply. Call it
   * before the first `receive`; answers whether it took: not once the
   * connection has started, and not for an ID over 20 bytes.
   */
  acceptRetry(originalDcid: u8[], retryScid: u8[]): boolean {
    if (
      this.state !== QUIC_STATE_WAIT_INITIAL ||
      toI32(originalDcid.length) > QUIC_MAX_CID_LENGTH ||
      toI32(retryScid.length) > QUIC_MAX_CID_LENGTH
    ) {
      return false
    }
    this.retryOriginalDcid = quicConnSlice(originalDcid, 0, toI32(originalDcid.length))
    this.retryScid = quicConnSlice(retryScid, 0, toI32(retryScid.length))
    this.retried = true
    return true
  }

  /** Closes the connection with transport error `code`, caused by a frame of `frameType` (0 for none). */
  fail(code: i64, frameType: i64): void {
    if (this.closed()) {
      return
    }
    this.state = QUIC_STATE_CLOSING
    this.error = code
    this.errorFrameType = frameType
    this.errorIsApplication = false
  }

  /**
   * Closes the connection from the application, with its own error `code`
   * (CONNECTION_CLOSE 0x1d; RFC 9000 §10.2). The next `takeDatagram` answers
   * the close, and nothing after it. Closing twice, or after the client
   * closed, does nothing.
   */
  close(code: i64): void {
    if (this.closed()) {
      return
    }
    this.state = QUIC_STATE_CLOSING
    this.error = code
    this.errorFrameType = 0
    this.errorIsApplication = true
  }

  /** The space of packets of `type`, or `null` for a 0-RTT or Retry packet. */
  spaceOf(type: i32): QuicConnSpace | null {
    if (type === QUIC_PACKET_INITIAL) {
      return this.initial
    }
    if (type === QUIC_PACKET_HANDSHAKE) {
      return this.handshake
    }
    if (type === QUIC_PACKET_SHORT) {
      return this.application
    }
    return null
  }

  /** The space of TLS level `level`. */
  spaceAt(level: i32): QuicConnSpace {
    if (level === TLS_LEVEL_INITIAL) {
      return this.initial
    }
    return level === TLS_LEVEL_HANDSHAKE ? this.handshake : this.application
  }

  /**
   * Whether a datagram whose first packet is sent to `dcid` belongs to this
   * connection: one of its active connection IDs, or, until the handshake is
   * done, the DCID of the client's first Initial. A closed connection still
   * answers for its IDs; the caller drops it once it is done with it.
   */
  ownsConnectionId(dcid: u8[]): boolean {
    if (this.cids.ownsLocal(dcid)) {
      return true
    }
    return (
      !this.handshakeComplete &&
      toI32(this.originalDcid.length) > 0 &&
      timingSafeEqual(dcid, this.originalDcid)
    )
  }

  /**
   * Takes one datagram from the client, which arrived at `now` (the
   * caller's monotonic time in milliseconds): every packet in it is opened
   * and its frames acted on, in order. Answers 0, or the error the
   * connection closed with — in which case `takeDatagram` answers the
   * CONNECTION_CLOSE to send. A packet that cannot be used is dropped and
   * counted (see the module header). Once the connection has closed, or its
   * idle timeout has passed by `now`, every datagram is ignored.
   */
  receive(datagram: u8[], now: i64): i64 {
    this.handleTimer(now)
    if (this.closed()) {
      return this.error
    }
    const n: i32 = toI32(datagram.length)
    // §14.1: a client's first Initial comes in a datagram of at least 1200 bytes.
    if (this.state === QUIC_STATE_WAIT_INITIAL && n < QUIC_CONN_DATAGRAM_SIZE) {
      this.drop()
      return 0
    }
    let at: i32 = 0
    let counted: boolean = false
    while (at < n) {
      const header: QuicHeader = quicParseHeader(datagram, at, QUIC_CONN_CID_LENGTH)
      if (header.error !== QUIC_PACKET_OK) {
        this.drop()
        break
      }
      counted = this.receivePacket(datagram, header) || counted
      if (this.closed() || header.type === QUIC_PACKET_SHORT || header.end <= at) {
        break
      }
      at = header.end
    }
    // A datagram counts toward the amplification limit once one of its packets
    // proves it is this connection's (RFC 9000 §8.1).
    if (counted) {
      this.bytesReceived = this.bytesReceived + toI64(n)
    }
    return this.closed() ? this.error : QUIC_ERROR_NO_ERROR
  }

  /**
   * Starts the connection from the client's first Initial, `header`: the
   * original DCID and the client's SCID, the Initial keys (RFC 9001 §5.2),
   * the first local connection ID, and a `TlsServer` whose transport
   * parameters name both IDs (RFC 9000 §7.3), the Retry's when `acceptRetry`
   * set one up, and the first ID's stateless reset token (§18.2). Answers
   * whether it could: the client's DCID must be at least 8 bytes (§7.2).
   */
  start(header: QuicHeader): boolean {
    if (toI32(header.dcid.length) < 8) {
      return false
    }
    const secrets: QuicInitialSecrets | null = quicInitialSecrets(header.dcid)
    if (secrets === null) {
      return false
    }
    this.initial.readKeys = quicKeys(QUIC_AEAD_AES_128_GCM, secrets.client)
    this.initial.writeKeys = quicKeys(QUIC_AEAD_AES_128_GCM, secrets.server)
    this.originalDcid = header.dcid
    this.peerScid = header.scid
    const none: u8[] = []
    const resetToken: u8[] = quicStatelessResetToken(this.config.statelessResetKey, this.localScid)
    this.cids.addLocal(this.localScid, resetToken)
    this.cids.addPeer(QUIC_CONN_NONE, QUIC_CONN_NONE, header.scid, none)
    // §8.1.2: a Retry token the listener checked has validated the address.
    this.addressValidated = this.retried

    const params: QuicTransportParameters = new QuicTransportParameters()
    params.originalDcid = this.retried ? this.retryOriginalDcid : header.dcid
    params.hasOriginalDcid = true
    params.initialScid = this.localScid
    params.hasInitialScid = true
    params.retryScid = this.retryScid
    params.hasRetryScid = this.retried
    params.statelessResetToken = resetToken
    params.hasStatelessResetToken = true
    params.maxIdleTimeout = this.config.maxIdleTimeout
    params.initialMaxData = this.config.maxData
    params.initialMaxStreamDataBidiRemote = this.config.maxStreamData
    params.initialMaxStreamsBidi = this.config.maxStreamsBidi
    params.activeConnectionIdLimit = this.config.activeConnectionIdLimit
    // The server never migrates and asks the client not to (§9): path
    // validation beyond answering PATH_CHALLENGE is not here.
    params.disableActiveMigration = true
    const extra: u8[] = []
    const tlsConfig: TlsServerConfig = {
      certificateChain: this.config.certificateChain,
      alpn: this.config.alpn,
      quicTransportParameters: quicEncodeTransportParameters(params),
      extraExtensions: extra,
      signatureScheme: this.config.signatureScheme,
      quic: true,
    }
    this.tls = new TlsServer(tlsConfig, this.serverRandom, this.ephemeralPrivate)
    this.state = QUIC_STATE_HANDSHAKE
    return true
  }

  /**
   * One packet of a datagram. Answers whether the packet was used: whether it
   * authenticated as this connection's.
   */
  receivePacket(datagram: u8[], header: QuicHeader): boolean {
    const type: i32 = header.type
    const first: boolean = this.state === QUIC_STATE_WAIT_INITIAL
    if (first && (type !== QUIC_PACKET_INITIAL || !this.start(header))) {
      this.drop()
      return false
    }
    const used: boolean = this.openPacket(datagram, header)
    // A first Initial that does not open leaves nothing behind: the next
    // datagram is read as a first Initial again.
    if (first && !used) {
      this.unstart()
    }
    return used
  }

  /** Undoes `start`, for a first Initial that turned out not to authenticate. */
  unstart(): void {
    const none: u8[] = []
    this.state = QUIC_STATE_WAIT_INITIAL
    this.addressValidated = false
    this.idleSince = -1
    this.tls = null
    this.initial = new QuicConnSpace(TLS_LEVEL_INITIAL)
    this.cids = new QuicCidTable(this.config.activeConnectionIdLimit)
    this.originalDcid = none
    this.peerScid = none
  }

  /** Opens one packet of a connection already started, and acts on its frames. Answers whether it was used. */
  openPacket(datagram: u8[], header: QuicHeader): boolean {
    const type: i32 = header.type
    const space: QuicConnSpace | null = this.spaceOf(type)
    if (space === null || !this.addressedHere(header)) {
      this.drop()
      return false
    }
    const keys: QuicKeys | null = space.readKeys
    // RFC 9001 §5.7: no 1-RTT packet is processed before the handshake is complete.
    if (keys === null || space.discarded || (type === QUIC_PACKET_SHORT && !this.handshakeComplete)) {
      this.drop()
      return false
    }
    // Every key generation shares the header-protection key (RFC 9001 §6),
    // so the current keys take it off whatever the Key Phase bit says.
    const packet: QuicPacket = quicRemoveHeaderProtection(keys, datagram, header, space.received.largest)
    const other: boolean = type === QUIC_PACKET_SHORT && packet.keyPhase !== this.readPhase
    const open: QuicKeys | null = other ? this.otherReadKeys : keys
    if (open === null || !quicDecryptPacket(open, datagram, header, packet) || packet.packetNumber < 0) {
      this.drop()
      return false
    }
    // §17.2, §17.3.1: reserved bits set under a valid tag close the connection.
    if (packet.error === QUIC_ERR_RESERVED_BITS) {
      this.fail(QUIC_ERROR_PROTOCOL_VIOLATION, QUIC_CONN_NONE)
      return true
    }
    if (space.received.contains(packet.packetNumber)) {
      this.drop()
      return true
    }
    if (type === QUIC_PACKET_SHORT && !this.notePhase(packet.packetNumber, other)) {
      return true
    }
    const eliciting: boolean = this.receiveFrames(space, type, packet.payload, header.dcid)
    if (this.closed()) {
      return true
    }
    space.received.record(packet.packetNumber, eliciting)
    // §10.1: a packet received and processed restarts the idle timer.
    this.idleSince = this.now
    this.elicitingSent = false
    if (type === QUIC_PACKET_HANDSHAKE) {
      // §8.1: a Handshake packet proves the client holds its address; RFC
      // 9001 §4.9.1: the server is then done with the Initial keys.
      this.addressValidated = true
      this.discard(this.initial)
    }
    this.afterTls()
    return true
  }

  /**
   * Books a 1-RTT packet `pn` that opened under the current read keys, or,
   * when `other`, under the other set (RFC 9001 §6.2, §6.4, §6.5). Under the
   * next generation's it is a key update: the read keys move on, and the
   * write keys too unless the server started this update. Under the previous
   * generation's it is a packet the network delayed. Either is
   * KEY_UPDATE_ERROR when it breaks §6.4's order — a higher packet number
   * under older keys than a lower one already had — and an update past
   * `QUIC_CONN_MAX_KEY_UPDATES` is too. Answers whether the connection is
   * still open.
   */
  notePhase(pn: i64, other: boolean): boolean {
    if (other && !this.otherIsNext) {
      if (this.readPhaseLowest >= 0 && pn > this.readPhaseLowest) {
        this.fail(QUIC_ERROR_KEY_UPDATE, QUIC_CONN_NONE)
        return false
      }
      return true
    }
    if (!other) {
      if (this.readPhaseLowest < 0 || pn < this.readPhaseLowest) {
        this.readPhaseLowest = pn
      }
      if (pn > this.readPhaseHighest) {
        this.readPhaseHighest = pn
      }
      return true
    }
    if (pn < this.readPhaseHighest) {
      this.fail(QUIC_ERROR_KEY_UPDATE, QUIC_CONN_NONE)
      return false
    }
    if (this.writePhase === this.readPhase) {
      // The client started this update: §6.2 has the write keys follow
      // before anything acknowledges the packet that carried it.
      if (this.keyUpdates >= QUIC_CONN_MAX_KEY_UPDATES) {
        this.fail(QUIC_ERROR_KEY_UPDATE, QUIC_CONN_NONE)
        return false
      }
      this.keyUpdates = this.keyUpdates + 1
      if (!this.updateWriteKeys()) {
        this.fail(QUIC_ERROR_INTERNAL, QUIC_CONN_NONE)
        return false
      }
    }
    const previous: QuicKeys | null = this.application.readKeys
    this.application.readKeys = this.otherReadKeys
    this.otherReadKeys = previous
    this.otherIsNext = false
    secureZero(this.appReadSecret)
    this.appReadSecret = this.nextReadSecret
    this.nextReadSecret = []
    this.readPhase = !this.readPhase
    this.readPhaseLowest = pn
    this.readPhaseHighest = pn
    this.keyRetainUntil = this.now + QUIC_CONN_PTO
    return true
  }

  /**
   * Moves the write keys to the next generation (RFC 9001 §6.1): the next
   * secret by `quic ku`, its key and IV, the Key Phase bit toggled; the old
   * key, IV and secret wiped. Answers whether it could, which it cannot only
   * for keys `quicKeys` did not make.
   */
  updateWriteKeys(): boolean {
    const keys: QuicKeys | null = this.application.writeKeys
    if (keys === null) {
      return false
    }
    const secret: u8[] | null = quicKeyUpdateSecret(keys.aead, this.appWriteSecret)
    if (secret === null) {
      return false
    }
    const next: QuicKeys | null = quicKeysUpdate(keys, secret)
    if (next === null) {
      secureZero(secret)
      return false
    }
    quicConnWipePacketKey(keys)
    secureZero(this.appWriteSecret)
    this.application.writeKeys = next
    this.appWriteSecret = secret
    this.writePhase = !this.writePhase
    this.writePhaseFirst = this.application.nextPn
    return true
  }

  /**
   * Derives the next generation's read secret and keys from the current
   * ones, into `otherReadKeys`, wiping the previous generation's key and IV
   * that sat there (RFC 9001 §6.3, §6.5). It runs when the 1-RTT keys are
   * installed and `QUIC_CONN_PTO` after each update, never while a packet is
   * being opened, so what a packet's Key Phase bit says shows in no timing.
   */
  prepareNextReadKeys(): void {
    const keys: QuicKeys | null = this.application.readKeys
    quicConnWipePacketKey(this.otherReadKeys)
    this.otherReadKeys = null
    this.otherIsNext = false
    this.keyRetainUntil = -1
    if (keys === null) {
      return
    }
    const secret: u8[] | null = quicKeyUpdateSecret(keys.aead, this.appReadSecret)
    if (secret === null) {
      return
    }
    this.nextReadSecret = secret
    this.otherReadKeys = quicKeysUpdate(keys, secret)
    this.otherIsNext = this.otherReadKeys !== null
  }

  /**
   * Whether `header`'s connection IDs are this connection's: a long header
   * from the client's first SCID to the server's ID (or, for an Initial,
   * the original DCID), a short header to an active local ID.
   */
  addressedHere(header: QuicHeader): boolean {
    if (header.type === QUIC_PACKET_SHORT) {
      return this.cids.ownsLocal(header.dcid)
    }
    if (!timingSafeEqual(header.scid, this.peerScid)) {
      return false
    }
    if (timingSafeEqual(header.dcid, this.localScid)) {
      return true
    }
    return header.type === QUIC_PACKET_INITIAL && timingSafeEqual(header.dcid, this.originalDcid)
  }

  /**
   * Acts on every frame of a packet's payload, in order, and answers whether
   * any asked for an acknowledgement. A payload with no frames, a frame that
   * does not parse and a frame the packet type may not carry close the
   * connection (RFC 9000 §12.4).
   */
  receiveFrames(space: QuicConnSpace, packetType: i32, payload: u8[], dcid: u8[]): boolean {
    const end: i32 = toI32(payload.length)
    if (end === 0) {
      this.fail(QUIC_ERROR_PROTOCOL_VIOLATION, QUIC_CONN_NONE)
      return false
    }
    const frame: QuicFrame = this.frame
    let eliciting: boolean = false
    let at: i32 = 0
    while (at < end) {
      const error: i64 = quicParseFrame(frame, payload, at, end)
      if (error !== QUIC_ERROR_NO_ERROR) {
        this.fail(error, toI64(frame.type))
        return eliciting
      }
      if (!quicFrameAllowed(frame.type, packetType)) {
        this.fail(QUIC_ERROR_PROTOCOL_VIOLATION, toI64(frame.type))
        return eliciting
      }
      eliciting = eliciting || quicFrameAckEliciting(frame.type)
      this.receiveFrame(space, frame, payload, dcid)
      if (this.closed() || frame.end <= at) {
        return eliciting
      }
      at = frame.end
    }
    return eliciting
  }

  /** One frame, which the packet type is allowed to carry. */
  receiveFrame(space: QuicConnSpace, frame: QuicFrame, payload: u8[], dcid: u8[]): void {
    const type: i64 = toI64(frame.type)
    switch (frame.type) {
      case QUIC_FRAME_ACK:
      case QUIC_FRAME_ACK_ECN:
        this.receiveAck(space, frame)
        break
      case QUIC_FRAME_CRYPTO:
        this.receiveCrypto(space, frame, payload)
        break
      case QUIC_FRAME_STREAM:
        this.receiveStream(frame, payload)
        break
      case QUIC_FRAME_RESET_STREAM: {
        const stream: QuicConnStream | null = this.streamFor(frame.streamId, type)
        if (stream !== null) {
          this.setFinalSize(stream, frame.value, type)
          stream.reset = true
        }
        break
      }
      case QUIC_FRAME_STOP_SENDING: {
        // §3.5: the client wants no more data. A full stream would answer
        // RESET_STREAM (Q4); here the sending side simply ends.
        const stream: QuicConnStream | null = this.streamFor(frame.streamId, type)
        if (stream !== null) {
          stream.finSent = true
          stream.send = []
          stream.sendHead = 0
        }
        break
      }
      case QUIC_FRAME_MAX_DATA:
        if (frame.value > this.peerMaxData) {
          this.peerMaxData = frame.value
        }
        break
      case QUIC_FRAME_MAX_STREAM_DATA: {
        const stream: QuicConnStream | null = this.streamFor(frame.streamId, type)
        if (stream !== null && frame.value > stream.sendLimit) {
          stream.sendLimit = frame.value
        }
        break
      }
      case QUIC_FRAME_STREAM_DATA_BLOCKED: {
        // Only the stream ID is checked: the server never raises credit (Q4).
        this.streamFor(frame.streamId, type)
        break
      }
      case QUIC_FRAME_NEW_CONNECTION_ID: {
        // §19.15: a client that chose a zero-length connection ID has none to give.
        const error: i64 =
          toI32(this.peerScid.length) === 0
            ? QUIC_ERROR_PROTOCOL_VIOLATION
            : this.cids.addPeer(frame.value, frame.retirePriorTo, frame.connectionId, frame.resetToken)
        if (error !== QUIC_ERROR_NO_ERROR) {
          this.fail(error, type)
        }
        break
      }
      case QUIC_FRAME_RETIRE_CONNECTION_ID: {
        const error: i64 = this.cids.retireLocal(frame.value, dcid)
        if (error !== QUIC_ERROR_NO_ERROR) {
          this.fail(error, type)
          break
        }
        this.topUpConnectionIds()
        break
      }
      case QUIC_FRAME_PATH_CHALLENGE: {
        // §8.2.2: answer with the same eight bytes. Only the latest few are
        // kept, so a burst of challenges cannot grow the queue.
        if (toI32(this.pathResponses.length) >= QUIC_PATH_DATA_SIZE * 4) {
          this.pathResponses = []
        }
        for (
          let k: i32 = frame.dataStart;
          k < frame.dataStart + frame.dataLength && k < toI32(payload.length);
          k += 1
        ) {
          if (k >= 0) {
            this.pathResponses.push(payload[k])
          }
        }
        break
      }
      // A PATH_RESPONSE answers no PATH_CHALLENGE, since the server sends none
      // (§19.18); NEW_TOKEN and HANDSHAKE_DONE go only to a client (§19.7,
      // §19.20). Each is a PROTOCOL_VIOLATION here.
      case QUIC_FRAME_PATH_RESPONSE:
      case QUIC_FRAME_NEW_TOKEN:
      case QUIC_FRAME_HANDSHAKE_DONE:
        this.fail(QUIC_ERROR_PROTOCOL_VIOLATION, type)
        break
      case QUIC_FRAME_CONNECTION_CLOSE:
        this.drain(frame.errorCode, false)
        break
      case QUIC_FRAME_CONNECTION_CLOSE_APP:
        this.drain(frame.errorCode, true)
        break
      default:
        // PADDING, PING, MAX_STREAMS, DATA_BLOCKED and STREAMS_BLOCKED ask
        // nothing of a server that opens no streams and never raises credit.
        break
    }
  }

  /** The client closed the connection: enter the draining state, sending nothing more (RFC 9000 §10.2.2). */
  drain(code: i64, application: boolean): void {
    this.state = QUIC_STATE_DRAINING
    this.error = code
    this.errorIsApplication = application
    this.closeSent = true
  }

  /** An ACK frame: acknowledging a packet number this space never sent is a PROTOCOL_VIOLATION (§13.1). */
  receiveAck(space: QuicConnSpace, frame: QuicFrame): void {
    if (frame.largest >= space.nextPn) {
      this.fail(QUIC_ERROR_PROTOCOL_VIOLATION, toI64(frame.type))
      return
    }
    if (frame.largest > space.largestAcked) {
      space.largestAcked = frame.largest
    }
  }

  /**
   * A CRYPTO frame: its data put back in order at its level, and what now
   * continues the stream handed to TLS. A frame too far ahead is
   * CRYPTO_BUFFER_EXCEEDED; an alert from TLS is CRYPTO_ERROR (RFC 9001 §4.8).
   */
  receiveCrypto(space: QuicConnSpace, frame: QuicFrame, payload: u8[]): void {
    if (!space.cryptoIn.insert(frame.offset, payload, frame.dataStart, frame.dataLength)) {
      this.fail(QUIC_ERROR_CRYPTO_BUFFER_EXCEEDED, toI64(QUIC_FRAME_CRYPTO))
      return
    }
    const bytes: u8[] = space.cryptoIn.take()
    const tls: TlsServer | null = this.tls
    if (tls === null || toI32(bytes.length) === 0) {
      return
    }
    const alert: i32 = tls.receive(space.level, bytes, QUIC_CONN_FROM, toI32(bytes.length))
    if (alert !== 0) {
      this.fail(QUIC_ERROR_CRYPTO + toI64(alert), toI64(QUIC_FRAME_CRYPTO))
      return
    }
    this.afterTls()
  }

  /**
   * The stream `id` refers to, opening it if the client may and has not yet
   * (RFC 9000 §3.2), or `null` with the connection closed. The server opens
   * no streams, so one of its IDs is STREAM_STATE_ERROR; it allows no
   * unidirectional streams and `maxStreamsBidi` bidirectional ones, so any
   * other ID past that is STREAM_LIMIT_ERROR (§4.6, §19.8).
   */
  streamFor(id: i64, frameType: i64): QuicConnStream | null {
    if ((id & 1) !== 0) {
      this.fail(QUIC_ERROR_STREAM_STATE, frameType)
      return null
    }
    if ((id & 2) !== 0 || id >> 2 >= this.config.maxStreamsBidi) {
      this.fail(QUIC_ERROR_STREAM_LIMIT, frameType)
      return null
    }
    const open: QuicConnStream | null = this.findStream(id)
    if (open !== null) {
      return open
    }
    const stream: QuicConnStream = new QuicConnStream(
      id,
      toI32(this.config.maxStreamData),
      this.peerParameters.initialMaxStreamDataBidiLocal
    )
    this.streams.push(stream)
    return stream
  }

  /** The stream `id` the client already opened, or `null`. */
  findStream(id: i64): QuicConnStream | null {
    for (const stream of this.streams) {
      if (stream.id === id) {
        return stream
      }
    }
    return null
  }

  /**
   * Fixes a stream's final size at `size` (a FIN, or RESET_STREAM): below what
   * the client already sent, or different from a size already fixed, it is
   * FINAL_SIZE_ERROR (§4.5). Answers whether it held.
   */
  setFinalSize(stream: QuicConnStream, size: i64, frameType: i64): boolean {
    if ((stream.finalSize >= 0 && stream.finalSize !== size) || size < stream.recvHighest) {
      this.fail(QUIC_ERROR_FINAL_SIZE, frameType)
      return false
    }
    if (!this.creditReceived(stream, size, frameType)) {
      return false
    }
    stream.finalSize = size
    return true
  }

  /**
   * Counts the client's data on `stream` up to offset `end` against the
   * credit the server gave, per stream and for the connection; past either
   * is FLOW_CONTROL_ERROR (§4.1). Answers whether it fit.
   */
  creditReceived(stream: QuicConnStream, end: i64, frameType: i64): boolean {
    if (end > this.config.maxStreamData) {
      this.fail(QUIC_ERROR_FLOW_CONTROL, frameType)
      return false
    }
    if (end > stream.recvHighest) {
      this.receivedData = this.receivedData + (end - stream.recvHighest)
      stream.recvHighest = end
      if (this.receivedData > this.config.maxData) {
        this.fail(QUIC_ERROR_FLOW_CONTROL, frameType)
        return false
      }
    }
    return true
  }

  /**
   * A STREAM frame: checked against the stream's final size and the credit,
   * put back in order, and what now continues the stream queued for
   * `readStream`, with the FIN once every byte up to the final size has been.
   */
  receiveStream(frame: QuicFrame, payload: u8[]): void {
    const type: i64 = toI64(QUIC_FRAME_STREAM)
    const stream: QuicConnStream | null = this.streamFor(frame.streamId, type)
    if (stream === null) {
      return
    }
    const end: i64 = frame.offset + toI64(frame.dataLength)
    if (stream.finalSize >= 0 && (end > stream.finalSize || (frame.fin && end !== stream.finalSize))) {
      this.fail(QUIC_ERROR_FINAL_SIZE, type)
      return
    }
    if (frame.fin ? !this.setFinalSize(stream, end, type) : !this.creditReceived(stream, end, type)) {
      return
    }
    if (stream.reset || stream.finDelivered) {
      return
    }
    // The credit check above keeps `end` within the ring, which is the credit's size.
    stream.recv.insert(frame.offset, payload, frame.dataStart, frame.dataLength)
    const data: u8[] = stream.recv.take()
    const fin: boolean = stream.finalSize >= 0 && stream.recv.delivered === stream.finalSize
    if (toI32(data.length) > 0 || fin) {
      stream.finDelivered = fin
      this.events.push(new QuicStreamData(stream.id, data, fin))
    }
  }

  /**
   * Whatever TLS's last step made due: its output moved into each level's
   * CRYPTO stream, the keys of each level it now has secrets for, the
   * client's transport parameters checked once it has read them, and, when
   * the handshake completes, the Handshake keys discarded (RFC 9001 §4.9.2),
   * HANDSHAKE_DONE queued (§4.1.2) and the client given more connection IDs.
   */
  afterTls(): void {
    const tls: TlsServer | null = this.tls
    if (tls === null || this.closed()) {
      return
    }
    if (!this.initial.discarded) {
      quicConnAppend(this.initial.cryptoOut, tls.takeOutput(TLS_LEVEL_INITIAL))
    }
    if (!this.handshake.discarded) {
      quicConnAppend(this.handshake.cryptoOut, tls.takeOutput(TLS_LEVEL_HANDSHAKE))
    }
    const aead: i32 = quicConnAead(tls.suite)
    if (
      !this.handshake.discarded &&
      this.handshake.writeKeys === null &&
      tls.state !== TLS_STATE_WAIT_CLIENT_HELLO
    ) {
      if (!this.checkPeerParameters(tls)) {
        return
      }
      this.alpn = tls.alpn
      this.serverName = tls.serverName
      this.handshake.readKeys = this.keysFor(aead, tls.readSecret(TLS_LEVEL_HANDSHAKE))
      this.handshake.writeKeys = this.keysFor(aead, tls.writeSecret(TLS_LEVEL_HANDSHAKE))
    }
    if (
      !this.application.discarded &&
      this.application.writeKeys === null &&
      tls.state !== TLS_STATE_WAIT_SIGNATURE
    ) {
      const write: u8[] | null = tls.writeSecret(TLS_LEVEL_APPLICATION)
      const read: u8[] | null = tls.readSecret(TLS_LEVEL_APPLICATION)
      if (write !== null && read !== null) {
        this.application.writeKeys = this.keysFor(aead, write)
        this.application.readKeys = this.keysFor(aead, read)
        // The key update secrets start from `TlsServer`'s own arrays, so the
        // first update wipes those too, rather than leaving a copy behind.
        this.appWriteSecret = write
        this.appReadSecret = read
        this.prepareNextReadKeys()
      }
    }
    if (tls.state === TLS_STATE_CONNECTED && !this.handshakeComplete) {
      this.handshakeComplete = true
      this.handshakeDonePending = true
      this.state = QUIC_STATE_CONNECTED
      this.discard(this.handshake)
      this.topUpConnectionIds()
    }
  }

  /** `quicKeys` of a secret TLS has, or `null` when it has none yet. */
  keysFor(aead: i32, secret: u8[] | null): QuicKeys | null {
    if (secret === null) {
      return null
    }
    return quicKeys(aead, secret)
  }

  /**
   * The client's transport parameters (RFC 9000 §7.3, §7.4, §18.2): they must
   * parse, and must name as `initial_source_connection_id` the SCID its first
   * Initial came from. Missing, that is TRANSPORT_PARAMETER_ERROR; wrong, a
   * PROTOCOL_VIOLATION. Answers whether they hold, closing the connection
   * when they do not.
   */
  checkPeerParameters(tls: TlsServer): boolean {
    const p: QuicTransportParameters = quicParseTransportParameters(tls.clientTransportParameters, false)
    if (p.error !== QUIC_ERROR_NO_ERROR || !p.hasInitialScid) {
      this.fail(QUIC_ERROR_TRANSPORT_PARAMETER, toI64(QUIC_FRAME_CRYPTO))
      return false
    }
    if (!timingSafeEqual(p.initialScid, this.peerScid)) {
      this.fail(QUIC_ERROR_PROTOCOL_VIOLATION, toI64(QUIC_FRAME_CRYPTO))
      return false
    }
    this.peerParameters = p
    this.peerMaxData = p.initialMaxData
    return true
  }

  /** Discards a space's keys and CRYPTO state (RFC 9001 §4.9), wiping the keys. */
  discard(space: QuicConnSpace): void {
    if (space.discarded) {
      return
    }
    space.discarded = true
    quicConnWipeKeys(space.readKeys)
    quicConnWipeKeys(space.writeKeys)
    space.readKeys = null
    space.writeKeys = null
    space.cryptoOut = []
    space.cryptoOutHead = 0
  }

  /**
   * The HMAC-SHA256 under the connection's seed of the sequence number
   * `sequence`, whose first 8 bytes are the local connection ID of that
   * number: so the IDs are unlinkable to anyone without the seed and need no
   * more entropy.
   */
  deriveConnectionId(sequence: i64): u8[] {
    const counter: u8[] = new Array<u8>(8)
    for (let k: i32 = 0; k < 8 && k < toI32(counter.length); k += 1) {
      counter[k] = toU8(toI32((sequence >> (toI64(7 - k) * 8)) & 255))
    }
    return hmacSha256(this.cidSeed, counter)
  }

  /**
   * Issues local connection IDs until the client holds as many as it said it
   * would take (its `active_connection_id_limit`), up to
   * `QUIC_CONN_LOCAL_CIDS`; each goes out in a NEW_CONNECTION_ID frame with
   * the stateless reset token the configuration's static key gives it.
   */
  topUpConnectionIds(): void {
    if (!this.handshakeComplete) {
      return
    }
    let want: i64 = this.peerParameters.activeConnectionIdLimit
    if (want > toI64(QUIC_CONN_LOCAL_CIDS)) {
      want = toI64(QUIC_CONN_LOCAL_CIDS)
    }
    while (toI64(this.cids.activeLocal()) < want) {
      const mac: u8[] = this.deriveConnectionId(this.cids.nextLocal)
      const cid: u8[] = quicConnSlice(mac, 0, QUIC_CONN_CID_LENGTH)
      secureZero(mac)
      this.cids.addLocal(cid, quicStatelessResetToken(this.config.statelessResetKey, cid))
    }
  }

  /** What CertificateVerify must sign while the handshake waits for it, else `null` (see `TlsServer.signatureInput`). */
  signatureInput(): u8[] | null {
    const tls: TlsServer | null = this.tls
    if (tls === null || this.closed()) {
      return null
    }
    return tls.signatureInput()
  }

  /**
   * Hands the signature over `signatureInput()` to TLS, which writes the
   * rest of the server's flight. Answers 0, or the CRYPTO_ERROR the
   * connection closed with when TLS refused it (a call at the wrong time, or
   * an empty signature: `internal_error`).
   */
  sign(signature: u8[]): i64 {
    const tls: TlsServer | null = this.tls
    if (tls === null || this.closed()) {
      return this.error
    }
    const alert: i32 = tls.sign(signature)
    if (alert !== 0) {
      this.fail(QUIC_ERROR_CRYPTO + toI64(alert), QUIC_CONN_NONE)
      return this.error
    }
    this.afterTls()
    return QUIC_ERROR_NO_ERROR
  }

  /**
   * The effective idle timeout in milliseconds (RFC 9000 §10.1): the smaller
   * of the two sides' `max_idle_timeout`, or the one that is not 0, raised to
   * `QUIC_CONN_IDLE_FLOOR`; -1 when both are 0, for none. Until the client's
   * transport parameters are read, the server's own alone.
   */
  idleTimeout(): i64 {
    const local: i64 = this.config.maxIdleTimeout
    const peer: i64 = this.peerParameters.maxIdleTimeout
    let timeout: i64 = local
    if (local === 0 || (peer !== 0 && peer < local)) {
      timeout = peer
    }
    if (timeout === 0) {
      return -1
    }
    return timeout < QUIC_CONN_IDLE_FLOOR ? QUIC_CONN_IDLE_FLOOR : timeout
  }

  /** When the idle timeout passes, or -1 when there is none or the timer has not started. */
  idleDeadline(): i64 {
    const timeout: i64 = this.idleTimeout()
    return timeout >= 0 && this.idleSince >= 0 ? this.idleSince + timeout : -1
  }

  /**
   * When `handleTimer` is next due, in the caller's milliseconds: the idle
   * timeout, or the end of a key update's `QUIC_CONN_PTO`, whichever comes
   * first. -1 when nothing is timed: before the first packet, once the
   * connection has closed, and with no idle timeout and no update pending.
   */
  deadline(): i64 {
    if (this.closed() || this.state === QUIC_STATE_WAIT_INITIAL) {
      return -1
    }
    const idle: i64 = this.idleDeadline()
    if (this.keyRetainUntil >= 0 && (idle < 0 || this.keyRetainUntil < idle)) {
      return this.keyRetainUntil
    }
    return idle
  }

  /**
   * Runs whatever is due by `now`, the caller's monotonic time in
   * milliseconds; call it at `deadline()`, or any time. Past the idle timeout
   * the connection closes silently (`QUIC_STATE_TIMED_OUT`, RFC 9000 §10.1):
   * no CONNECTION_CLOSE, every key wiped. Past a key update's
   * `QUIC_CONN_PTO` the previous read keys are wiped and the next
   * generation's derived (RFC 9001 §6.5). `receive` and `takeDatagram` run
   * it themselves. Time never runs backwards here: an earlier `now` than
   * one already given counts as that one.
   */
  handleTimer(now: i64): void {
    if (now > this.now) {
      this.now = now
    }
    if (this.closed() || this.state === QUIC_STATE_WAIT_INITIAL) {
      return
    }
    const idle: i64 = this.idleDeadline()
    if (idle >= 0 && this.now >= idle) {
      this.state = QUIC_STATE_TIMED_OUT
      this.error = QUIC_ERROR_NO_ERROR
      this.closeSent = true
      this.wipeAll()
      return
    }
    if (this.keyRetainUntil >= 0 && this.now >= this.keyRetainUntil) {
      this.prepareNextReadKeys()
    }
  }

  /**
   * Starts a key update from the server (RFC 9001 §6.1): the write keys move
   * to the next generation and the Key Phase bit of every packet after
   * toggles; the client follows when it reads one. Answers whether it did.
   * It does not while it may not: before the handshake is confirmed, while
   * an update is still in flight (the client has not answered the last one,
   * or answered it less than `QUIC_CONN_PTO` ago, so the next read keys are
   * not ready), and until the client has acknowledged a packet sent with the
   * current keys.
   */
  updateKeys(): boolean {
    if (
      this.state !== QUIC_STATE_CONNECTED ||
      this.writePhase !== this.readPhase ||
      !this.otherIsNext ||
      this.application.largestAcked < this.writePhaseFirst
    ) {
      return false
    }
    return this.updateWriteKeys()
  }

  /**
   * The next stream data the client sent, in order per stream, or `null`
   * when there is none. Each answer is a run of new bytes; `fin` marks the
   * last of its stream.
   */
  readStream(): QuicStreamData | null {
    if (this.eventHead >= toI32(this.events.length)) {
      if (this.eventHead > 0) {
        this.events = []
        this.eventHead = 0
      }
      return null
    }
    const at: i32 = this.eventHead
    this.eventHead = at + 1
    if (at >= 0 && at < toI32(this.events.length)) {
      return this.events[at]
    }
    return null
  }

  /**
   * Queues `data` to send on stream `streamId`, finishing the sending side
   * when `fin`. The stream must be one the client opened. Answers
   * `QUIC_STREAM_OK`, or `QUIC_STREAM_ERR_*`: the connection is not
   * connected, the stream is unknown, its side is already finished, or the
   * data would pass the credit the client gave for the stream or the
   * connection (raising credit with MAX_STREAM_DATA and MAX_DATA is the
   * client's; queueing past it is refused rather than held).
   */
  writeStream(streamId: i64, data: u8[], fin: boolean): i32 {
    if (this.state !== QUIC_STATE_CONNECTED) {
      return QUIC_STREAM_ERR_STATE
    }
    const found: QuicConnStream | null = this.findStream(streamId)
    if (found === null) {
      return QUIC_STREAM_ERR_UNKNOWN
    }
    const stream: QuicConnStream = found
    if (stream.sendFin || stream.finSent) {
      return QUIC_STREAM_ERR_FINISHED
    }
    const length: i64 = toI64(toI32(data.length))
    const end: i64 = stream.sendOffset + toI64(stream.unsent()) + length
    if (end > stream.sendLimit || this.sentData + length > this.peerMaxData) {
      return QUIC_STREAM_ERR_FLOW
    }
    quicConnAppend(stream.send, data)
    this.sentData = this.sentData + length
    stream.sendFin = fin
    return QUIC_STREAM_OK
  }

  /**
   * The next datagram to send, at most `QUIC_CONN_DATAGRAM_SIZE` bytes, or
   * `null` when nothing is due. Call it until it answers `null` after every
   * `receive`, `sign`, `writeStream` and `close`. It coalesces an Initial, a
   * Handshake and a 1-RTT packet as each has something to carry, pads a
   * datagram with an ack-eliciting Initial to 1200 bytes (RFC 9000 §14.1),
   * and before the client's address is validated sends only while three
   * times what was received allows (§8.1). After a close it answers the
   * CONNECTION_CLOSE once, then `null`. While the handshake waits for a
   * signature it answers `null`, so the server's flight leaves whole. `now`
   * is the caller's time in milliseconds: a datagram that elicits an
   * acknowledgement restarts the idle timer when it is the first since the
   * client's last packet (RFC 9000 §10.1), and once the idle timeout has
   * passed nothing goes out.
   */
  takeDatagram(now: i64): u8[] | null {
    this.handleTimer(now)
    if (
      this.state === QUIC_STATE_WAIT_INITIAL ||
      this.state === QUIC_STATE_DRAINING ||
      this.state === QUIC_STATE_TIMED_OUT
    ) {
      return null
    }
    if (this.state === QUIC_STATE_CLOSING) {
      return this.takeClose()
    }
    const tls: TlsServer | null = this.tls
    if (tls !== null && tls.state === TLS_STATE_WAIT_SIGNATURE) {
      return null
    }
    // Unvalidated, a datagram goes only when a whole padded one fits the budget.
    if (!this.addressValidated && this.bytesReceived * 3 - this.bytesSent < toI64(QUIC_CONN_DATAGRAM_SIZE)) {
      return null
    }
    const levels: i32[] = []
    const payloads: u8[][] = []
    let remaining: i32 = QUIC_CONN_DATAGRAM_SIZE
    let paddedInitial: boolean = false
    let eliciting: boolean = false
    for (let level: i32 = 0; level < 3; level += 1) {
      const space: QuicConnSpace = this.spaceAt(level)
      const overhead: i32 = this.overhead(space)
      if (overhead === 0 || remaining <= overhead + 8) {
        continue
      }
      const cryptoBefore: i64 = space.cryptoOutOffset
      const payload: u8[] = this.buildPayload(space, remaining - overhead)
      if (toI32(payload.length) === 0) {
        continue
      }
      eliciting = eliciting || toI32(payload.length) > this.ackLength
      // An Initial carries only ACK and CRYPTO, so it elicits an
      // acknowledgement exactly when it carries CRYPTO data.
      if (level === TLS_LEVEL_INITIAL) {
        paddedInitial = space.cryptoOutOffset !== cryptoBefore
      }
      levels.push(level)
      payloads.push(payload)
      remaining = remaining - overhead - toI32(payload.length)
    }
    const count: i32 = toI32(payloads.length)
    if (count === 0) {
      return null
    }
    if (paddedInitial && remaining > 0) {
      quicPushPadding(payloads[count - 1], remaining)
    }
    if (eliciting && !this.elicitingSent) {
      this.idleSince = this.now
      this.elicitingSent = true
    }
    return this.seal(levels, payloads)
  }

  /**
   * The bytes a packet of `space` takes beyond its payload: the header with
   * its packet number, and the AEAD tag. 0 when the space cannot send: no
   * keys, discarded, or no packet number length for its next number.
   */
  overhead(space: QuicConnSpace): i32 {
    if (space.writeKeys === null || space.discarded) {
      return 0
    }
    const pnLength: i32 = quicPacketNumberLength(space.nextPn, space.largestAcked)
    if (pnLength === 0) {
      return 0
    }
    if (space.level === TLS_LEVEL_APPLICATION) {
      return 1 + toI32(this.cids.currentPeer().length) + pnLength + QUIC_AEAD_TAG_SIZE
    }
    // First byte, version, both IDs with their lengths, the Length (two
    // bytes, always) and, for an Initial, the empty token's length.
    const token: i32 = space.level === TLS_LEVEL_INITIAL ? 1 : 0
    return (
      7 +
      toI32(this.peerScid.length) +
      toI32(this.localScid.length) +
      token +
      2 +
      pnLength +
      QUIC_AEAD_TAG_SIZE
    )
  }

  /**
   * The frames of one packet of `space`, at most `room` bytes: an ACK when
   * one is due, CRYPTO data, and at the application level HANDSHAKE_DONE,
   * RETIRE_CONNECTION_ID, NEW_CONNECTION_ID, PATH_RESPONSE and stream data.
   * Empty when nothing is due. Every frame but the ACK elicits an
   * acknowledgement, so the payload does exactly when it is longer than
   * `ackLength`, which this sets.
   */
  buildPayload(space: QuicConnSpace, room: i32): u8[] {
    let out: u8[] = []
    this.ackLength = 0
    if (space.received.ackPending) {
      // The ACK opens the payload, so its array becomes the payload; one too
      // large for the room is left out and stays due.
      const ack: u8[] = []
      if (space.received.pushAck(ack, QUIC_CONN_NONE)) {
        if (toI32(ack.length) <= room) {
          out = ack
          this.ackLength = toI32(ack.length)
        } else {
          space.received.ackPending = true
        }
      }
    }
    const unsent: i32 = space.cryptoUnsent()
    if (unsent > 0) {
      const left: i32 = room - toI32(out.length) - quicCryptoOverhead(space.cryptoOutOffset, unsent)
      const n: i32 = left < unsent ? left : unsent
      if (n > 0 && quicPushCrypto(out, space.cryptoOutOffset, space.cryptoOut, space.cryptoOutHead, n)) {
        space.cryptoOutHead = space.cryptoOutHead + n
        space.cryptoOutOffset = space.cryptoOutOffset + toI64(n)
        if (space.cryptoOutHead === toI32(space.cryptoOut.length)) {
          space.cryptoOut = []
          space.cryptoOutHead = 0
        }
      }
    }
    if (space.level === TLS_LEVEL_APPLICATION) {
      this.buildApplication(out, room)
    }
    return out
  }

  /** The 1-RTT frames beyond ACK, as many as fit in `room` bytes of `out`. */
  buildApplication(out: u8[], room: i32): void {
    if (this.handshakeDonePending && toI32(out.length) < room) {
      quicPushTypeOnly(out, QUIC_FRAME_HANDSHAKE_DONE)
      this.handshakeDonePending = false
    }
    // RETIRE_CONNECTION_ID is at most 9 bytes, NEW_CONNECTION_ID with an
    // 8-byte ID at most 42, PATH_RESPONSE 9.
    while (toI32(this.cids.retirePending.length) > 0 && room - toI32(out.length) >= 9) {
      quicPushValue(out, QUIC_FRAME_RETIRE_CONNECTION_ID, this.cids.takeRetire())
    }
    let entry: QuicCidEntry | null = this.cids.nextUnannounced()
    while (entry !== null && room - toI32(out.length) >= 42) {
      quicPushNewConnectionId(out, entry.sequence, 0, entry.cid, entry.resetToken)
      entry.announced = true
      entry = this.cids.nextUnannounced()
    }
    while (toI32(this.pathResponses.length) >= QUIC_PATH_DATA_SIZE && room - toI32(out.length) >= 9) {
      quicPushPathData(out, QUIC_FRAME_PATH_RESPONSE, this.pathResponses, 0)
      this.pathResponses = quicConnSlice(
        this.pathResponses,
        QUIC_PATH_DATA_SIZE,
        toI32(this.pathResponses.length) - QUIC_PATH_DATA_SIZE
      )
    }
    for (const stream of this.streams) {
      if (stream.wantsToSend()) {
        this.buildStream(out, room, stream)
      }
    }
  }

  /** One STREAM frame for `stream`, as much of its queue as fits, with the FIN when the rest fits too. */
  buildStream(out: u8[], room: i32, stream: QuicConnStream): void {
    const unsent: i32 = stream.unsent()
    const left: i32 = room - toI32(out.length) - quicStreamOverhead(stream.id, stream.sendOffset, unsent)
    if (left < 0 || (left === 0 && unsent > 0)) {
      return
    }
    const n: i32 = left < unsent ? left : unsent
    const fin: boolean = stream.sendFin && n === unsent
    if (!quicPushStream(out, stream.id, stream.sendOffset, stream.send, stream.sendHead, n, fin)) {
      return
    }
    stream.sendHead = stream.sendHead + n
    stream.sendOffset = stream.sendOffset + toI64(n)
    if (stream.sendHead === toI32(stream.send.length)) {
      stream.send = []
      stream.sendHead = 0
    }
    if (fin) {
      stream.finSent = true
    }
  }

  /**
   * Seals one packet per entry of `levels` around the matching payload and
   * answers them as one datagram, counted against the amplification limit.
   * A payload too short for the header-protection sample is padded first.
   */
  seal(levels: i32[], payloads: u8[][]): u8[] | null {
    const datagram: u8[] = []
    for (let k: i32 = 0; k < toI32(levels.length) && k < toI32(payloads.length); k += 1) {
      if (!this.sealInto(datagram, this.spaceAt(levels[k]), payloads[k])) {
        return null
      }
    }
    this.bytesSent = this.bytesSent + toI64(toI32(datagram.length))
    return datagram
  }

  /**
   * Seals one packet of `space` around `payload` and appends it to
   * `datagram`. A payload too short for the header-protection sample is
   * padded first (RFC 9001 §5.4.2). Answers whether it could; it cannot only
   * when the space has no keys, which the callers have ruled out.
   */
  sealInto(datagram: u8[], space: QuicConnSpace, payload: u8[]): boolean {
    const keys: QuicKeys | null = space.writeKeys
    const pn: i64 = space.nextPn
    const pnLength: i32 = quicPacketNumberLength(pn, space.largestAcked)
    if (pnLength + toI32(payload.length) < 4) {
      quicPushPadding(payload, 4 - pnLength - toI32(payload.length))
    }
    const none: u8[] = []
    const header: u8[] | null =
      space.level === TLS_LEVEL_APPLICATION
        ? quicShortHeader(this.cids.currentPeer(), false, this.writePhase, pn, pnLength)
        : quicLongHeader(
            space.level === TLS_LEVEL_INITIAL ? QUIC_PACKET_INITIAL : QUIC_PACKET_HANDSHAKE,
            this.peerScid,
            this.localScid,
            none,
            pn,
            pnLength,
            toI32(payload.length)
          )
    if (keys === null || header === null) {
      return false
    }
    const packet: u8[] | null = quicSealPacket(keys, header, pn, payload)
    if (packet === null) {
      return false
    }
    space.nextPn = pn + 1
    quicConnAppend(datagram, packet)
    return true
  }

  /**
   * The one CONNECTION_CLOSE this side owes, then `null`. It goes in every
   * space the server still has keys for, since the client may not yet have
   * the newest (RFC 9000 §10.2.3); in an Initial or Handshake packet an
   * application's close is sent as the transport close APPLICATION_ERROR,
   * since those packets may not carry 0x1d (§12.4). Before the handshake is
   * complete no 1-RTT packet carries it, because the client cannot yet read
   * one.
   */
  takeClose(): u8[] | null {
    if (this.closeSent) {
      return null
    }
    this.closeSent = true
    const levels: i32[] = []
    const payloads: u8[][] = []
    const reason: u8[] = []
    for (let level: i32 = 0; level < 3; level += 1) {
      const space: QuicConnSpace = this.spaceAt(level)
      if (this.overhead(space) === 0 || (level === TLS_LEVEL_APPLICATION && !this.handshakeComplete)) {
        continue
      }
      const payload: u8[] = []
      if (level === TLS_LEVEL_APPLICATION || !this.errorIsApplication) {
        quicPushConnectionClose(payload, this.errorIsApplication, this.error, this.errorFrameType, reason)
      } else {
        quicPushConnectionClose(payload, false, QUIC_ERROR_APPLICATION, 0, reason)
      }
      levels.push(level)
      payloads.push(payload)
    }
    if (toI32(levels.length) === 0) {
      return null
    }
    return this.seal(levels, payloads)
  }

  /**
   * Wipes everything secret the connection and its `TlsServer` still hold:
   * every level's packet keys, the next generation's read keys, the traffic
   * secrets, the ephemeral key and the connection-ID seed (QUIC-2). Call it when the connection is done with;
   * the connection is closed after it and sends nothing more.
   */
  release(): void {
    this.wipeAll()
    if (!this.closed()) {
      this.state = QUIC_STATE_CLOSING
      this.error = QUIC_ERROR_NO_ERROR
    }
    this.closeSent = true
  }

  /** Wipes every key and secret the connection holds and discards every level: `release()`'s work, and the idle timeout's. */
  wipeAll(): void {
    this.discard(this.initial)
    this.discard(this.handshake)
    this.discard(this.application)
    quicConnWipePacketKey(this.otherReadKeys)
    this.otherReadKeys = null
    this.otherIsNext = false
    this.keyRetainUntil = -1
    secureZero(this.appReadSecret)
    secureZero(this.appWriteSecret)
    secureZero(this.nextReadSecret)
    secureZero(this.cidSeed)
    secureZero(this.ephemeralPrivate)
    const tls: TlsServer | null = this.tls
    if (tls !== null) {
      secureZero(tls.handshakeSecret)
      secureZero(tls.clientHandshakeSecret)
      secureZero(tls.serverHandshakeSecret)
      secureZero(tls.clientApplicationSecret)
      secureZero(tls.serverApplicationSecret)
      secureZero(tls.exporterSecret)
    }
  }
}
