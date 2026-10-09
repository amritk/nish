/**
 * `nish/net/quic` — the server side of a QUIC version 1 connection (RFC 9000,
 * RFC 9001, RFC 9221): the TLS 1.3 handshake carried in CRYPTO frames at
 * three encryption levels, transport parameters both ways, acknowledgements
 * per packet number space, the connection-ID table, streams both ways
 * (`nish/net/quic-stream`) and DATAGRAM frames once the handshake is done.
 * Sans-IO, like the rest of `nish/net`.
 *
 *     import { QuicConnection, QuicServerConfig } from "nish/net/quic";
 *
 *     const conn = new QuicConnection(config, entropy);   // entropy: QUIC_CONN_ENTROPY_SIZE random bytes
 *     conn.receiveWindow(buf, off, len, now);              // every datagram the client sends; now in ms
 *     const input: u8[] | null = conn.signatureInput();
 *     if (input !== null) { conn.sign(tlsSignEcdsaP256(key, input)); }
 *     let n: i32 = conn.takeDatagramInto(out, 0, now);     // out: at least QUIC_CONN_DATAGRAM_SIZE bytes
 *     while (n > 0) { … send out[0 .. n) to the client … ; n = conn.takeDatagramInto(out, 0, now); }
 *     let id: i64 = conn.nextStreamEvent();                 // a stream with news: read it, write it
 *     … conn.streamRead(id, buf, 0, size) / conn.streamWrite(id, data, 0, n, fin) …
 *     … and at conn.deadline(), conn.handleTimer(now); once done, conn.reset(entropy) for the next peer
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
 * **Streams** are `nish/net/quic-stream`'s: both kinds, opened by either
 * side, with flow control per stream and for the connection raised as the
 * application reads, and the stream limits raised as streams finish. The
 * application sees them through a small surface: `nextStreamEvent` names a
 * stream with something new (opened, readable, finished, reset, stopped, or
 * writable again), `streamRead` and `streamWrite` move bytes a chunk at a
 * time with back-pressure, `openStream` opens one of the server's,
 * `streamReset` and `streamStopSending` abandon a side. `readStream` and
 * `writeStream` are the all-at-once forms, which allocate.
 *
 * **Datagrams** (RFC 9221). With `maxDatagramFrameSize` above 0 the server
 * advertises `max_datagram_frame_size` and takes DATAGRAM frames up to it; a
 * DATAGRAM frame it did not offer to take, or one larger, is
 * PROTOCOL_VIOLATION. `sendDatagram` queues a payload when the client
 * offered to take one that size and it fits a packet; it goes out within the
 * congestion window, and is never sent again. `readDatagram` hands out what
 * arrived. Each way is a fixed ring (`nish/net/quic-datagram`).
 *
 * **Loss recovery** (RFC 9002) is `nish/net/quic-recovery`'s: every
 * ack-eliciting packet is recorded in its space's ring with what it carried
 * (its CRYPTO range, its STREAM chunks, HANDSHAKE_DONE and the control
 * frames), the client's ACKs give the RTT estimate and show what was lost by
 * packet or time threshold, and what a lost packet carried is sent again,
 * from the CRYPTO bytes a level keeps until it is discarded and the bytes a
 * stream keeps until they are acknowledged; a control frame goes again with
 * its current value. When nothing is acknowledged for a probe timeout, with
 * its backoff, everything in flight is queued again and a probe goes out in
 * each space that has packets in flight, a PING if there is nothing to
 * resend (§6.2.4) — two datagrams of them during the handshake, each with
 * the oldest CRYPTO data not acknowledged. A client that shows it lacks the
 * server's handshake data (an Initial repeating CRYPTO data, an
 * ack-eliciting Handshake packet) gets it again at once, a datagram each
 * time, up to `QUIC_CONN_EARLY_RESENDS` times (§6.2.3). NewReno's window
 * holds back everything ack-eliciting but a probe; an ACK always goes.
 * PATH_RESPONSE and DATAGRAM are never sent again (RFC 9000 §13.3, RFC 9221
 * §5.2). Pacing, and GSO batching, are the carrier's:
 * `nish/net/quic-listener`.
 *
 * **Nothing allocated per packet** (QUIC-3). A connection is a slot: every
 * buffer it uses — the packet record, the stream buffers, the CRYPTO
 * reassembly, the connection-ID table, the datagram rings — is made by the
 * constructor and reused, and `reset` makes the slot a new connection for
 * the next peer. A packet is opened (`receiveWindow`) and a datagram built
 * and sealed (`takeDatagramInto`) inside a `using a = arena()` block, so the
 * AEAD's and the header protection's temporaries go when the block ends, and
 * the compiler refuses the block if anything in it could store one. The
 * handshake keeps its state in the slot too: one `TlsServer`, made by the
 * slot's first handshake and `restart`ed by each after it; every level's
 * packet keys, and a key update's, derived in place into `QuicKeysSlot`s
 * (`nish/net/quic-packet`) over the slot's HKDF scratch; the Initial
 * secrets, the stateless reset tokens and the connection IDs computed in
 * arena blocks; the transport parameters encoded and parsed into the
 * slot's own objects. After the first connection in a slot, a connection
 * keeps nothing at all (QUIC-3 in `docs/security/quic.md`).
 *
 * **Time.** The connection has no clock: `receive`, `takeDatagram` and
 * `handleTimer` take the caller's monotonic time in milliseconds, and
 * `deadline()` says when `handleTimer` is next due. Three things run on it.
 * The idle timeout (RFC 9000 §10.1) is the smaller of the two sides'
 * `max_idle_timeout`, never under `QUIC_CONN_IDLE_FLOOR` or three probe
 * timeouts; once it passes with nothing received, the connection closes
 * silently (`QUIC_STATE_TIMED_OUT`) and wipes its keys. Loss recovery's
 * timer declares packets lost by the time threshold or fires the probe
 * timeout. And after a key update the previous read keys are kept for a
 * probe timeout (`recovery.probeTimeout()`), for packets the network
 * reordered, before the next generation's are derived (RFC 9001 §6.5).
 *
 * **Key update** (RFC 9001 §6), both ways. A 1-RTT packet whose Key Phase
 * bit differs from the current one is opened with the next generation's read
 * keys, which are derived ahead of time so that a forged bit costs no
 * derivation and shows no timing difference (§6.3); if it opens, the client
 * has updated, and the server's write keys follow before anything is
 * acknowledged (§6.2). `updateKeys()` starts an update from the server once
 * the client has acknowledged a packet of the current phase (§6.1). The
 * generations take turns in two key slots and two secrets a direction, so an
 * update keeps nothing in the arena; each still costs two key derivations of
 * work, so a connection takes at most `QUIC_CONN_MAX_KEY_UPDATES` updates the
 * client starts and closes on the next with KEY_UPDATE_ERROR (QUIC-4).
 *
 * **Sans-IO and deterministic.** No socket, no clock and no random device:
 * every random choice (the TLS server random and ephemeral key, the server's
 * first connection ID, and the seed later IDs are derived from) comes from
 * the `entropy` the constructor and `reset` take, every stateless reset
 * token from the configuration's static key (RFC 9000 §10.3.2), and every
 * ACK says a delay of zero. So a recorded exchange replays byte for byte.
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
 * a peer can fill is fixed: CRYPTO reassembly by `QUIC_CONN_CRYPTO_WINDOW`,
 * each stream by the credit advertised (its buffer), the connection by
 * `maxData`, the connection-ID table by the limit advertised, the received
 * packet numbers by `QUIC_ACK_MAX_RANGES`, and datagrams by their ring.
 *
 * **Secrets.** The packet keys of each level live in this connection's key
 * slots as long as the level does, and in `TlsServer`'s (TLS-1); so do the
 * 1-RTT secrets the next key generation is derived from, and the next
 * generation's read keys. A `Secret` may not be a field (NL2430), so they are
 * plain bytes; `secureZero` wipes each level's key, IV and header-protection
 * key, and its AES schedules with ordinary stores, when the level is
 * discarded, each generation's key, IV and secret when a key update
 * replaces it, and `release()` (and `reset`) the rest — the 1-RTT keys, the
 * key-update secrets, the traffic secrets `TlsServer` holds, its ephemeral
 * key and the connection-ID seed. What no wipe reaches (`aesKeyInto`'s
 * working copy of a schedule) is recorded as QUIC-2 in
 * `docs/security/quic.md`, with #430, the follow-up that moves these structs
 * onto `nish:secret`.
 *
 * Written from RFC 9000, RFC 9001 and RFC 9221, in this module's own
 * structure; nothing here is ported from another implementation. Private
 * names carry the `quicConn` prefix (`docs/wp26-stdlib.md` §3e).
 */
import { timingSafeEqualAt } from "nish/crypto/ct"
import { HkdfScratch } from "nish/crypto/hkdf"
import { HmacSha256Scratch, hmacSha256 } from "nish/crypto/hmac"
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
  QuicKeys,
  QuicKeysSlot,
  QuicPacket,
  quicDecryptPayload,
  quicInitialSecretsInto,
  quicKeyUpdateSecretInto,
  quicKeysInto,
  quicKeysUpdateInto,
  quicPacketNumberLength,
  quicParseHeaderInto,
  quicPutLongHeader,
  quicPutShortHeader,
  quicSealInPlace,
  quicUnprotectHeader,
} from "nish/net/quic-packet"
import {
  QUIC_ERROR_APPLICATION,
  QUIC_ERROR_CRYPTO,
  QUIC_ERROR_CRYPTO_BUFFER_EXCEEDED,
  QUIC_ERROR_INTERNAL,
  QUIC_ERROR_KEY_UPDATE,
  QUIC_ERROR_NO_ERROR,
  QUIC_ERROR_PROTOCOL_VIOLATION,
  QUIC_ERROR_TRANSPORT_PARAMETER,
  QUIC_FRAME_ACK,
  QUIC_FRAME_ACK_ECN,
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_CONNECTION_CLOSE_APP,
  QUIC_FRAME_CRYPTO,
  QUIC_FRAME_DATAGRAM,
  QUIC_FRAME_DATAGRAM_LENGTH,
  QUIC_FRAME_HANDSHAKE_DONE,
  QUIC_FRAME_MAX_DATA,
  QUIC_FRAME_MAX_STREAM_DATA,
  QUIC_FRAME_MAX_STREAMS_BIDI,
  QUIC_FRAME_MAX_STREAMS_UNI,
  QUIC_FRAME_NEW_CONNECTION_ID,
  QUIC_FRAME_NEW_TOKEN,
  QUIC_FRAME_PATH_CHALLENGE,
  QUIC_FRAME_PATH_RESPONSE,
  QUIC_FRAME_PING,
  QUIC_FRAME_RESET_STREAM,
  QUIC_FRAME_RETIRE_CONNECTION_ID,
  QUIC_FRAME_STOP_SENDING,
  QUIC_FRAME_STREAM,
  QUIC_FRAME_STREAM_DATA_BLOCKED,
  QUIC_PATH_DATA_SIZE,
  QUIC_RESET_TOKEN_SIZE,
  QuicFrame,
  quicCryptoOverhead,
  quicDatagramSize,
  quicFrameAckEliciting,
  quicFrameAllowed,
  quicParseFrame,
  quicPutConnectionClose,
  quicPutCrypto,
  quicPutNewConnectionId,
  quicPutPadding,
  quicPutPathData,
  quicPutTypeOnly,
  quicPutValue,
} from "nish/net/quic-frame"
import {
  QuicTransportParameters,
  quicEncodeTransportParametersInto,
  quicParseTransportParametersInto,
} from "nish/net/quic-conn-params"
import { QuicAckRanges } from "nish/net/quic-conn-ack"
import {
  QUIC_RECOVERY_APPLICATION_CAPACITY,
  QUIC_RECOVERY_HANDSHAKE_CAPACITY,
  QUIC_RECOVERY_TIMEOUT_LOSS,
  QUIC_RECOVERY_TIMEOUT_PTO,
  QuicRecovery,
  QuicSentPackets,
} from "nish/net/quic-recovery"
import { QuicCidEntry, QuicCidTable, quicCidCopy } from "nish/net/quic-conn-cid"
import {
  QUIC_SEND_RESET_SENT,
  QUIC_STREAM_END,
  QUIC_STREAM_ERR_FINISHED,
  QUIC_STREAM_ERR_FLOW,
  QUIC_STREAM_ERR_STATE,
  QUIC_STREAM_ERR_UNKNOWN,
  QUIC_STREAM_OK,
  QuicStream,
  QuicStreams,
  quicStreamBit,
  quicStreamSetBit,
} from "nish/net/quic-stream"
import { QuicDatagramQueue } from "nish/net/quic-datagram"
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
 * carries, so no path MTU discovery is needed. `takeDatagramInto` needs this
 * much room.
 */
export const QUIC_CONN_DATAGRAM_SIZE: i32 = 1200
/**
 * How many random bytes the constructor and `reset` take: 32 for the TLS
 * server random, 32 for the x25519 key, 8 for the first connection ID and
 * 32 for the seed the later IDs and their reset tokens are derived from.
 */
export const QUIC_CONN_ENTROPY_SIZE: i32 = 104
/**
 * How far ahead of what it has handed TLS the server buffers CRYPTO data.
 * RFC 9000 §7.5 asks for at least 4096 bytes; a frame past this is
 * CRYPTO_BUFFER_EXCEEDED. One buffer of this size serves every level, since
 * the client's Initial flight is complete before its Handshake one starts.
 */
export const QUIC_CONN_CRYPTO_WINDOW: i32 = 16384
/** The most connection IDs the server keeps active for the client to use, its own first one included. */
export const QUIC_CONN_LOCAL_CIDS: i32 = 4
/** The largest per-stream credit a configuration may advertise, which is also each stream's buffer each way. */
export const QUIC_CONN_MAX_STREAM_DATA: i64 = 1048576
/** The most streams of one kind a configuration may let the client open at once, or open itself. */
export const QUIC_CONN_MAX_STREAMS: i64 = 1024
/**
 * The most bytes of stream buffer a configuration may make each connection
 * hold: every stream slot (`maxStreamsBidi + maxStreamsUni + localStreams`)
 * has `maxStreamData` bytes each way, made when the connection is, so a
 * configuration past 64 MiB of them is refused rather than allocated.
 */
export const QUIC_CONN_MAX_STREAM_BUFFERS: i64 = 67108864
/** The length of the configuration's static keys: the stateless reset key and the Retry token key. */
export const QUIC_CONN_STATIC_KEY_SIZE: i32 = 32
/**
 * The shortest idle timeout the server keeps: three times the probe timeout
 * of a path with no RTT sample yet (RFC 9002 §6.2.2, about a second), and
 * never under three times the current one either. RFC 9000 §10.1 has an
 * endpoint raise a smaller negotiated value to this, so that several probes
 * can be lost before the connection is given up.
 */
export const QUIC_CONN_IDLE_FLOOR: i64 = 3000
/**
 * The most STREAM frames one packet carries, which is how many chunks a
 * packet's record keeps for retransmission; the rest of the streams go in
 * the next packet.
 */
export const QUIC_CONN_PACKET_STREAMS: i32 = 4
/**
 * The most control frames one packet carries — NEW_CONNECTION_ID,
 * RETIRE_CONNECTION_ID and the flow-control, limit and stream-ending frames
 * of `nish/net/quic-stream` — for the same reason: the three new IDs the
 * server announces once the handshake is done fit one packet, and the rest
 * go over the next few.
 */
export const QUIC_CONN_PACKET_CONTROL: i32 = 4
/**
 * How many key updates a connection takes from its client (RFC 9001 §6).
 * Each costs two key derivations of work, though none of their memory, so
 * the cap bounds what a client can make the server derive (QUIC-4); the next one
 * closes the connection with KEY_UPDATE_ERROR. A client also has to wait
 * a probe timeout between two of them.
 */
export const QUIC_CONN_MAX_KEY_UPDATES: i32 = 64
/**
 * How many ack-eliciting datagrams a probe timeout sends in the Initial and
 * Handshake spaces (RFC 9002 §6.2.4 allows up to two). The server's first
 * flight is usually one datagram, so with one probe a lossy path loses every
 * copy of it about as often as it loses one datagram per probe timeout; two
 * square that, and stay inside the amplification limit, which a one-datagram
 * flight and two probes fill exactly. The Application Data space sends one.
 */
export const QUIC_CONN_HANDSHAKE_PROBES: i32 = 2
/**
 * How many times a connection resends its handshake data before the probe
 * timeout because the client showed it lacks it (RFC 9002 §6.2.3, "for a
 * limited number of times per connection"): a client Initial carrying
 * CRYPTO data the server already read, or an ack-eliciting Handshake packet,
 * while the server's own CRYPTO data at that level is in flight. Each
 * resend is one datagram, so a client cannot make the server answer more
 * than this many packets that way, whatever it sends.
 */
export const QUIC_CONN_EARLY_RESENDS: i32 = 2
/**
 * How many connection IDs a connection issues in all, its first included.
 * The client retiring one asks for a replacement (§5.1.1, a SHOULD), and
 * each costs two HMACs whose temporaries stay in the arena, so this bounds
 * what a client can make the server derive by retiring IDs over and over;
 * past it, a retired ID is not replaced.
 */
export const QUIC_CONN_MAX_ISSUED_CIDS: i64 = 64
/** How many DATAGRAM payloads each way a connection holds, when it takes any. */
export const QUIC_CONN_DATAGRAM_QUEUE: i32 = 8
/**
 * The largest `maxDatagramFrameSize` a configuration may advertise: 1500
 * bytes, an Ethernet path's whole UDP payload, past which no DATAGRAM frame
 * reaches a server on a real path. Each of the receive ring's entries is
 * sized to what is advertised, so every frame taken is held.
 */
export const QUIC_CONN_MAX_DATAGRAM_FRAME: i64 = 1500

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
 * drop the connection (or `reset` the slot), so that a later packet to its
 * IDs reaches `nish/net/quic-listener`, whose stateless reset tells the client.
 */
export const QUIC_STATE_TIMED_OUT: i32 = 5

// ---- What the datagram calls answer ---------------------------------------------

/** `sendDatagram` queued the payload. */
export const QUIC_DATAGRAM_OK: i32 = 0
/** `readDatagram`: nothing has arrived. */
export const QUIC_DATAGRAM_NONE: i32 = -1
/** `readDatagram`: the next datagram does not fit in the room given; it is kept. */
export const QUIC_DATAGRAM_ERR_ROOM: i32 = -2
/** `sendDatagram`: the client did not offer to take DATAGRAM frames (RFC 9221 §3), or the connection is not connected. */
export const QUIC_DATAGRAM_ERR_DISABLED: i32 = -3
/** `sendDatagram`: the payload is larger than the client takes, or than fits one packet (`maxDatagramPayload`). */
export const QUIC_DATAGRAM_ERR_TOO_BIG: i32 = -4
/** `sendDatagram`: the send ring is full; try again once a datagram has gone. */
export const QUIC_DATAGRAM_ERR_FULL: i32 = -5

/** A typed zero for the offsets below: a bare literal is an `f64` under `--number-mode f64`. */
const QUIC_CONN_FROM: i32 = 0
/** A space's key slots (`QuicConnSpace.keySlot`): the read keys', the write keys', and where Application Data's write keys start. */
const QUIC_CONN_READ_SLOT: i32 = 0
const QUIC_CONN_WRITE_SLOT: i32 = 1
const QUIC_CONN_APP_WRITE_SLOTS: i32 = 2
/** The same for the `i64` arguments of the methods below, where a literal is not given its parameter's type. */
const QUIC_CONN_NONE: i64 = 0
/** TLS's unexpected_message alert, which CRYPTO data at a level TLS is not reading is (RFC 8446 §6). */
const QUIC_CONN_ALERT_UNEXPECTED: i64 = 10

/** A packet's record: the bit that says it carried HANDSHAKE_DONE, and the kinds of control frame of its own. */
const QUIC_CONN_SENT_HANDSHAKE_DONE: i32 = 1
const QUIC_CONN_CONTROL_NEW_CID: i32 = 1
const QUIC_CONN_CONTROL_RETIRE: i32 = 2

/**
 * What a QUIC server is configured with, the same for every connection. The
 * limits are the transport parameters it advertises (RFC 9000 §18.2); the
 * stream limits and `maxStreamData` also size each connection's buffers,
 * which are made once and reused.
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
  /** `initial_max_data`: the connection's receive window, 0 to 2^62 − 1, raised as the application reads. */
  maxData: i64
  /**
   * `initial_max_stream_data_bidi_remote` (and `_uni`, and `_bidi_local`
   * when the server opens streams): each stream's receive window and the
   * size of its buffer each way, 1 to 1 MiB.
   */
  maxStreamData: i64
  /** `initial_max_streams_bidi`: how many bidirectional streams the client may have open at once, 0 to 1024. */
  maxStreamsBidi: i64
  /** `initial_max_streams_uni`: how many unidirectional streams the client may have open at once, 0 to 1024. */
  maxStreamsUni: i64
  /** How many streams of its own the server may have open at once, 0 to 1024 (`openStream`). */
  localStreams: i64
  /**
   * RFC 9221's `max_datagram_frame_size`: the largest DATAGRAM frame the
   * server takes, 0 (none, and the parameter is not sent) to 1500. The
   * server sends DATAGRAM frames only when it takes them too.
   */
  maxDatagramFrameSize: i64
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

/** One run of stream data the client sent, in order, as `readStream` answers it: `fin` when it ends the stream. */
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
 * CRYPTO bytes put back in order: a ring of `capacity` bytes indexed by
 * stream offset, with a bit per byte saying it arrived, so frames may come
 * in any order and overlap. What continues the stream from `delivered` is
 * handed to TLS from the ring itself. One serves the connection: it follows
 * the level the client is sending at, since the Initial flight is complete
 * before the Handshake one starts.
 */
class QuicConnReassembly {
  ring: u8[]
  have: u8[]
  /** The level whose bytes the ring holds. */
  level: i32 = 0
  /** How many bytes of the level have been handed to TLS. */
  delivered: i64 = 0

  constructor(capacity: i32) {
    this.ring = new Array<u8>(capacity)
    this.have = new Array<u8>((capacity + 7) >> 3)
  }

  /** Empties the ring for level `level`. */
  reset(level: i32): void {
    this.level = level
    this.delivered = 0
    this.have.fill(toU8(0))
  }

  /** The ring slot of stream offset `offset`. */
  slot(offset: i64): i32 {
    const capacity: i32 = toI32(this.ring.length)
    return capacity > 0 ? toI32(offset % toI64(capacity)) : 0
  }

  /** Whether the byte in ring slot `s` arrived and is not yet handed out. */
  arrived(s: i32): boolean {
    return quicStreamBit(this.have, s)
  }

  /** Marks ring slot `s` as holding a byte, or not. */
  mark(s: i32, on: boolean): void {
    quicStreamSetBit(this.have, s, on)
  }

  /**
   * Takes `data[from .. from + length)`, which sits at stream offset
   * `offset`. Answers `false`, taking nothing, when it reaches `capacity` or
   * more past what was delivered. Bytes already delivered are skipped.
   */
  insert(offset: i64, data: u8[], from: i32, length: i32): boolean {
    const capacity: i32 = toI32(this.ring.length)
    if (offset + toI64(length) > this.delivered + toI64(capacity)) {
      return false
    }
    for (let k: i32 = 0; k < length; k += 1) {
      const position: i64 = offset + toI64(k)
      const at: i32 = from + k
      if (position >= this.delivered && at >= 0 && at < toI32(data.length)) {
        const s: i32 = this.slot(position)
        if (s >= 0 && s < capacity) {
          this.ring[s] = data[at]
          this.mark(s, true)
        }
      }
    }
    return true
  }

  /** How many bytes from `delivered` have arrived without a gap, up to the end of the ring's array. */
  run(): i32 {
    const capacity: i32 = toI32(this.ring.length)
    const start: i32 = this.slot(this.delivered)
    let n: i32 = 0
    while (start + n < capacity && this.arrived(start + n)) {
      n += 1
    }
    return n
  }

  /** Hands out the `n` bytes `run` counted: their bits cleared, `delivered` moved past them. */
  consume(n: i32): void {
    const start: i32 = this.slot(this.delivered)
    for (let k: i32 = 0; k < n; k += 1) {
      this.mark(start + k, false)
    }
    this.delivered = this.delivered + toI64(n)
  }
}

/**
 * One packet number space's state (RFC 9000 §12.3): its keys, its numbers,
 * its CRYPTO stream, and what each of its packets in flight carried.
 *
 * The record of a packet is a row of the `sent*` arrays, indexed by the slot
 * `nish/net/quic-recovery` gave it, so it is fixed when the connection is
 * made. One row past the last slot, `staging`, is where the packet being
 * built is described; `recordSent` copies it to the packet's slot. Only the
 * Application Data space has rows for STREAM chunks and control frames,
 * since only a 1-RTT packet carries them.
 */
class QuicConnSpace {
  readKeys: QuicKeys | null = null
  writeKeys: QuicKeys | null = null
  /** The next packet number to send. */
  nextPn: i64 = 0
  /** The largest packet number the client acknowledged here, or -1. */
  largestAcked: i64 = -1
  received: QuicAckRanges
  /**
   * Every CRYPTO byte TLS wrote at this level, from stream offset 0, its
   * first `cryptoOutLength` bytes, kept until the level is discarded so that
   * a lost range can be sent again; the array is reused by the next
   * connection in the slot. The bytes from `cryptoOutHead` (offset
   * `cryptoOutOffset`) are not sent yet.
   */
  cryptoOut: u8[]
  cryptoOutLength: i32 = 0
  cryptoOutOffset: i64 = 0
  /** How many CRYPTO bytes the client sent here that were handed to TLS, for a duplicate arriving after the next level started. */
  cryptoInDelivered: i64 = 0
  /** CRYPTO bytes declared lost, to send before new ones: `[cryptoResendLow, cryptoResendHigh)`, or -1. */
  cryptoResendLow: i64 = -1
  cryptoResendHigh: i64 = -1
  /** Each packet's CRYPTO frame (offset, and length 0 for none), and its `QUIC_CONN_SENT_*` bits. */
  sentCryptoOffset: i64[]
  sentCryptoLength: i32[]
  sentFlags: u8[]
  /** Each packet's STREAM chunks, `QUIC_CONN_PACKET_STREAMS` to a row: how many, then each one's stream, offset, length and FIN. */
  sentStreamCount: i32[]
  sentStreamId: i64[]
  sentStreamOffset: i64[]
  sentStreamLength: i32[]
  sentStreamFin: u8[]
  /** Each packet's control frames, `QUIC_CONN_PACKET_CONTROL` to a row: their kind and value (a sequence number or a stream). */
  sentControlCount: i32[]
  sentControlKind: u8[]
  sentControlValue: i64[]
  /**
   * Where this space's packet keys live, made once for the slot (QUIC-3):
   * the read keys' and the write keys', and for the Application Data space a
   * second of each, which a key update derives the next generation into.
   */
  keySlots: QuicKeysSlot[]
  /** `TLS_LEVEL_INITIAL`, `_HANDSHAKE` or `_APPLICATION`, which is also the space's index. */
  level: i32 = 0
  cryptoOutHead: i32 = 0
  /** The packet `buildDatagram` is putting together here: where it starts in the datagram, or -1 for none, and its payload's end. */
  builtStart: i32 = -1
  builtEnd: i32 = 0
  /** The row the packet being built is described in: one past the last slot. */
  staging: i32 = 0
  /**
   * How many ack-eliciting probe packets this space still owes, which the
   * window does not hold back: what a probe timeout asked for (RFC 9002
   * §6.2.4), or an early resend (§6.2.3).
   */
  probes: i32 = 0
  /** Whether the keys were discarded (RFC 9001 §4.9): nothing is sent or received here again. */
  discarded: boolean = false
  /** Whether the packet being built elicits an acknowledgement, and so is recorded. */
  stagedEliciting: boolean = false

  constructor(level: i32) {
    this.level = level
    this.received = new QuicAckRanges()
    this.cryptoOut = []
    this.keySlots = []
    const slots: i32 = level === TLS_LEVEL_APPLICATION ? 4 : 2
    for (let k: i32 = 0; k < slots; k += 1) {
      this.keySlots.push(new QuicKeysSlot())
    }
    const capacity: i32 =
      level === TLS_LEVEL_APPLICATION ? QUIC_RECOVERY_APPLICATION_CAPACITY : QUIC_RECOVERY_HANDSHAKE_CAPACITY
    const rows: i32 = capacity + 1
    // Only 1-RTT packets carry STREAM and control frames (RFC 9000 §12.4).
    const chunkRows: i32 = level === TLS_LEVEL_APPLICATION ? rows : 0
    this.staging = capacity
    this.sentCryptoOffset = new Array<i64>(rows)
    this.sentCryptoLength = new Array<i32>(rows)
    this.sentFlags = new Array<u8>(rows)
    this.sentStreamCount = new Array<i32>(rows)
    this.sentStreamId = new Array<i64>(chunkRows * QUIC_CONN_PACKET_STREAMS)
    this.sentStreamOffset = new Array<i64>(chunkRows * QUIC_CONN_PACKET_STREAMS)
    this.sentStreamLength = new Array<i32>(chunkRows * QUIC_CONN_PACKET_STREAMS)
    this.sentStreamFin = new Array<u8>(chunkRows * QUIC_CONN_PACKET_STREAMS)
    this.sentControlCount = new Array<i32>(rows)
    this.sentControlKind = new Array<u8>(chunkRows * QUIC_CONN_PACKET_CONTROL)
    this.sentControlValue = new Array<i64>(chunkRows * QUIC_CONN_PACKET_CONTROL)
  }

  /** Puts the space back as a new connection has it, keeping its arrays, for a slot reused for another peer. */
  reset(): void {
    this.readKeys = null
    this.writeKeys = null
    this.nextPn = 0
    this.largestAcked = -1
    this.received.clear()
    this.cryptoOutLength = 0
    this.cryptoOutOffset = 0
    this.cryptoOutHead = 0
    this.cryptoInDelivered = 0
    this.cryptoResendLow = -1
    this.cryptoResendHigh = -1
    this.discarded = false
    this.probes = 0
    this.clearStaged()
  }

  /**
   * Appends `bytes[0 .. length)` to the CRYPTO stream kept, writing into the
   * array's old room before growing it: TLS's output buffer is read in
   * place, so its flight is not copied on the way.
   */
  appendCrypto(bytes: u8[], length: i32): void {
    for (let k: i32 = 0; k < length && k < toI32(bytes.length); k += 1) {
      const at: i32 = this.cryptoOutLength
      if (at >= 0 && at < toI32(this.cryptoOut.length)) {
        this.cryptoOut[at] = bytes[k]
      } else {
        this.cryptoOut.push(bytes[k])
      }
      this.cryptoOutLength = at + 1
    }
  }

  /**
   * Key slot `k` of this space: in the Initial and Handshake spaces 0 holds
   * the read keys and 1 the write keys; in Application Data 0 and 1 hold
   * the read keys' generations and 2 and 3 the write keys'.
   */
  keySlot(k: i32): QuicKeysSlot {
    const at: i32 = k >= 0 && k < toI32(this.keySlots.length) ? k : 0
    return this.keySlots[at]
  }

  /** Zeroes every key this space's slots hold, the AES schedules included. */
  wipeKeySlots(): void {
    for (const slot of this.keySlots) {
      slot.wipe()
    }
  }

  /** The number of STREAM chunks row `row` holds, or 0. */
  streamCount(row: i32): i32 {
    return row >= 0 && row < toI32(this.sentStreamCount.length) ? this.sentStreamCount[row] : 0
  }

  /** The number of control frames row `row` holds, or 0. */
  controlCount(row: i32): i32 {
    return row >= 0 && row < toI32(this.sentControlCount.length) ? this.sentControlCount[row] : 0
  }

  /** The CRYPTO frame's length in row `row`, or 0. */
  cryptoLength(row: i32): i32 {
    return row >= 0 && row < toI32(this.sentCryptoLength.length) ? this.sentCryptoLength[row] : 0
  }

  /** The CRYPTO frame's offset in row `row`, or 0. */
  cryptoOffset(row: i32): i64 {
    return row >= 0 && row < toI32(this.sentCryptoOffset.length) ? this.sentCryptoOffset[row] : 0
  }

  /** The `QUIC_CONN_SENT_*` bits of row `row`. */
  flags(row: i32): i32 {
    return row >= 0 && row < toI32(this.sentFlags.length) ? toI32(this.sentFlags[row]) : 0
  }

  /** Empties the staging row, for the next packet. */
  clearStaged(): void {
    this.stagedEliciting = false
    this.setCrypto(this.staging, QUIC_CONN_NONE, QUIC_CONN_FROM)
    this.setFlags(this.staging, QUIC_CONN_FROM)
    this.setCounts(this.staging, QUIC_CONN_FROM, QUIC_CONN_FROM)
  }

  /** Sets row `row`'s CRYPTO frame. */
  setCrypto(row: i32, offset: i64, length: i32): void {
    if (row >= 0 && row < toI32(this.sentCryptoOffset.length) && row < toI32(this.sentCryptoLength.length)) {
      this.sentCryptoOffset[row] = offset
      this.sentCryptoLength[row] = length
    }
  }

  /** Sets row `row`'s bits. */
  setFlags(row: i32, flags: i32): void {
    if (row >= 0 && row < toI32(this.sentFlags.length)) {
      this.sentFlags[row] = toU8(flags)
    }
  }

  /** Sets how many STREAM chunks and control frames row `row` holds. */
  setCounts(row: i32, streams: i32, control: i32): void {
    if (row >= 0 && row < toI32(this.sentStreamCount.length) && row < toI32(this.sentControlCount.length)) {
      this.sentStreamCount[row] = streams
      this.sentControlCount[row] = control
    }
  }

  /** Sets STREAM chunk `j` of row `row`. */
  setChunk(row: i32, j: i32, id: i64, offset: i64, length: i32, fin: boolean): void {
    const at: i32 = row * QUIC_CONN_PACKET_STREAMS + j
    if (
      at >= 0 &&
      at < toI32(this.sentStreamId.length) &&
      at < toI32(this.sentStreamOffset.length) &&
      at < toI32(this.sentStreamLength.length) &&
      at < toI32(this.sentStreamFin.length)
    ) {
      this.sentStreamId[at] = id
      this.sentStreamOffset[at] = offset
      this.sentStreamLength[at] = length
      this.sentStreamFin[at] = toU8(fin ? 1 : 0)
    }
  }

  /** Sets control frame `j` of row `row`. */
  setControl(row: i32, j: i32, kind: i32, value: i64): void {
    const at: i32 = row * QUIC_CONN_PACKET_CONTROL + j
    if (at >= 0 && at < toI32(this.sentControlKind.length) && at < toI32(this.sentControlValue.length)) {
      this.sentControlKind[at] = toU8(kind)
      this.sentControlValue[at] = value
    }
  }

  /** Stages a CRYPTO frame at `offset`, `length` bytes, in the packet being built. */
  stageCrypto(offset: i64, length: i32): void {
    this.setCrypto(this.staging, offset, length)
    this.stagedEliciting = true
  }

  /** Stages a STREAM chunk in the packet being built; the caller keeps under `QUIC_CONN_PACKET_STREAMS`. */
  stageChunk(id: i64, offset: i64, length: i32, fin: boolean): void {
    const streams: i32 = this.streamCount(this.staging)
    this.setChunk(this.staging, streams, id, offset, length, fin)
    this.setCounts(this.staging, streams + 1, this.controlCount(this.staging))
    this.stagedEliciting = true
  }

  /** Stages a control frame in the packet being built; the caller keeps under `QUIC_CONN_PACKET_CONTROL`. */
  stageControl(kind: i32, value: i64): void {
    const control: i32 = this.controlCount(this.staging)
    this.setControl(this.staging, control, kind, value)
    this.setCounts(this.staging, this.streamCount(this.staging), control + 1)
    this.stagedEliciting = true
  }

  /** Copies the staging row to row `row`, the slot of the packet just sealed. */
  commitStaged(row: i32): void {
    const from: i32 = this.staging
    this.setCrypto(row, this.cryptoOffset(from), this.cryptoLength(from))
    this.setFlags(row, this.flags(from))
    const streams: i32 = this.streamCount(from)
    const control: i32 = this.controlCount(from)
    this.setCounts(row, streams, control)
    for (let j: i32 = 0; j < streams; j += 1) {
      const at: i32 = from * QUIC_CONN_PACKET_STREAMS + j
      if (
        at >= 0 &&
        at < toI32(this.sentStreamId.length) &&
        at < toI32(this.sentStreamOffset.length) &&
        at < toI32(this.sentStreamLength.length) &&
        at < toI32(this.sentStreamFin.length)
      ) {
        this.setChunk(
          row,
          j,
          this.sentStreamId[at],
          this.sentStreamOffset[at],
          this.sentStreamLength[at],
          toI32(this.sentStreamFin[at]) !== 0
        )
      }
    }
    for (let j: i32 = 0; j < control; j += 1) {
      const at: i32 = from * QUIC_CONN_PACKET_CONTROL + j
      if (at >= 0 && at < toI32(this.sentControlKind.length) && at < toI32(this.sentControlValue.length)) {
        this.setControl(row, j, toI32(this.sentControlKind[at]), this.sentControlValue[at])
      }
    }
  }

  /** Queues CRYPTO bytes `[offset, offset + length)` to be sent again, merged with what is queued already. */
  resendCrypto(offset: i64, length: i32): void {
    if (length <= 0 || this.discarded) {
      return
    }
    const end: i64 = offset + toI64(length)
    if (this.cryptoResendLow < 0) {
      this.cryptoResendLow = offset
      this.cryptoResendHigh = end
      return
    }
    if (offset < this.cryptoResendLow) {
      this.cryptoResendLow = offset
    }
    if (end > this.cryptoResendHigh) {
      this.cryptoResendHigh = end
    }
  }

  /** How many CRYPTO bytes are waiting to be sent. */
  cryptoUnsent(): i32 {
    return this.cryptoOutLength - this.cryptoOutHead
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

/**
 * `quicStatelessResetToken` of the ID `cid[at .. at + length)` into
 * `out[outAt ..]`, computed in a connection's own HMAC scratch inside an
 * arena block, so issuing an ID keeps nothing (QUIC-3). The scratch and the
 * full MAC are wiped before it returns.
 */
const quicConnResetTokenInto = (
  mac: HmacSha256Scratch,
  key: u8[],
  cid: u8[],
  at: i32,
  length: i32,
  out: u8[],
  outAt: i32
): void => {
  using _scope = arena()
  const tag: u8[] = new Array<u8>(32)
  mac.begin(key, QUIC_CONN_FROM, toI32(key.length))
  mac.update(cid, at, length)
  mac.finishInto(tag, QUIC_CONN_FROM)
  for (
    let k: i32 = 0;
    k < QUIC_RESET_TOKEN_SIZE && k < toI32(tag.length) && outAt + k < toI32(out.length);
    k += 1
  ) {
    out[outAt + k] = tag[k]
  }
  secureZero(tag)
  mac.wipe()
}

/** Puts `from[at .. at + length)` in `to`, emptied first, in the room `to` already has. */
const quicConnRefill = (to: u8[], from: u8[], at: i32, length: i32): void => {
  while (to.length > 0) {
    to.pop()
  }
  for (let k: i32 = 0; k < length && at + k >= 0 && at + k < toI32(from.length); k += 1) {
    to.push(from[at + k])
  }
}

/**
 * Secret `index` (0 or 1) of a direction's pool, of the length `aead`'s hash
 * gives: what a key update derives the next traffic secret into.
 */
const quicConnSecretAt = (pool: u8[][], aead: i32, index: i32): u8[] => {
  let wanted: i32 = index === 1 ? 1 : 0
  if (aead === QUIC_AEAD_AES_256_GCM) {
    wanted = wanted + 2
  }
  const at: i32 = wanted < toI32(pool.length) ? wanted : 0
  return pool[at]
}

/** Two secrets of SHA-256's length and two of SHA-384's, for one direction's key updates. */
const quicConnSecretPool = (): u8[][] => [
  new Array<u8>(32),
  new Array<u8>(32),
  new Array<u8>(48),
  new Array<u8>(48),
]

/** Whether the configuration's limits are ones this module can honour. */
const quicConnConfigFits = (config: QuicServerConfig): boolean =>
  config.maxStreamData >= 1 &&
  config.maxStreamData <= QUIC_CONN_MAX_STREAM_DATA &&
  config.maxStreamsBidi >= 0 &&
  config.maxStreamsBidi <= QUIC_CONN_MAX_STREAMS &&
  config.maxStreamsUni >= 0 &&
  config.maxStreamsUni <= QUIC_CONN_MAX_STREAMS &&
  config.localStreams >= 0 &&
  config.localStreams <= QUIC_CONN_MAX_STREAMS &&
  (config.maxStreamsBidi + config.maxStreamsUni + config.localStreams) * config.maxStreamData * 2 <=
    QUIC_CONN_MAX_STREAM_BUFFERS &&
  config.maxDatagramFrameSize >= 0 &&
  config.maxDatagramFrameSize <= QUIC_CONN_MAX_DATAGRAM_FRAME &&
  config.maxData >= 0 &&
  config.maxData <= QUIC_MAX_VARINT &&
  config.maxIdleTimeout >= 0 &&
  config.maxIdleTimeout <= QUIC_MAX_VARINT &&
  config.activeConnectionIdLimit >= 2 &&
  config.activeConnectionIdLimit <= 8 &&
  toI32(config.statelessResetKey.length) === QUIC_CONN_STATIC_KEY_SIZE

/**
 * One server connection, which is also a reusable slot. Make one, hand it
 * every datagram the client sends with `receiveWindow` (or `receive`), sign
 * when `signatureInput()` asks, send what `takeDatagramInto()` writes until
 * it answers 0, and use streams and datagrams once `state` is
 * `QUIC_STATE_CONNECTED`. Once it has closed, `reset` makes it a new
 * connection for the next client, with its buffers kept.
 *
 * The fields are readable: `state`, `error` (the transport error or
 * application code the connection closed with), `dropped`, `alpn` and
 * `serverName` once the handshake has read them, `peerParameters`, `streams`
 * (the stream table), and `cids`, the connection-ID table, which a server
 * that runs many connections routes datagrams by (`ownsConnectionId`).
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
  /** The DCID of the client's first Initial, which the Initial keys come from: its first `originalDcidLength` bytes. */
  originalDcid: u8[]
  /** The SCID of the client's first Initial: where long-header packets go, and what its transport parameters must name. */
  peerScid: u8[]
  /** The server's first connection ID, the SCID of every long-header packet it sends. */
  localScid: u8[]
  tls: TlsServer | null = null
  /** The slot's `TlsServer`, made by its first handshake and `restart`ed by every one after (QUIC-3). */
  tlsSlot: TlsServer | null = null
  /** Its configuration, made once: the parameters it carries are `localEncoded`, rewritten for each connection. */
  tlsConfig: TlsServerConfig
  /** The server's transport parameters, set for each connection, and their encoding. */
  localParameters: QuicTransportParameters
  localEncoded: u8[]
  /** The client's transport parameters, parsed into the slot's own object. */
  parsedParameters: QuicTransportParameters
  /** Where every key derivation and HMAC of the connection runs. */
  kdf: HkdfScratch
  /** The Initial secrets of RFC 9001 §5.2, the client's and the server's. */
  initialClient: u8[]
  initialServer: u8[]
  /**
   * The 1-RTT secrets a key update derives, two of each hash's length a
   * direction (SHA-256's first, then SHA-384's), used in turn: the next
   * generation's goes in the one the current generation's is not in.
   */
  writeSecrets: u8[][]
  readSecrets: u8[][]
  /** A connection ID being issued and its stateless reset token, before the table copies them. */
  cidScratch: u8[]
  tokenScratch: u8[]
  initial: QuicConnSpace
  handshake: QuicConnSpace
  application: QuicConnSpace
  cids: QuicCidTable
  /** Loss detection, the RTT estimate, the congestion window and the pacer (RFC 9002). */
  recovery: QuicRecovery
  /** The client's transport parameters, once the handshake has checked them; until then, every default. */
  peerParameters: QuicTransportParameters
  /** The defaults `peerParameters` starts from, made once and set back by `reset`. */
  defaultParameters: QuicTransportParameters
  /** Bytes received and sent, for the anti-amplification limit (RFC 9000 §8.1). */
  bytesReceived: i64 = 0
  bytesSent: i64 = 0
  /** The ALPN protocol the handshake chose. */
  alpn: string = ""
  /** The client's `server_name`, or empty. */
  serverName: string = ""
  /** The streams, both ways (`nish/net/quic-stream`). */
  streams: QuicStreams
  /** DATAGRAM payloads waiting to be sent, and those the client sent waiting to be read. */
  datagramsOut: QuicDatagramQueue
  datagramsIn: QuicDatagramQueue
  /** The CRYPTO bytes the client sent, put back in order. */
  cryptoIn: QuicConnReassembly
  /** PATH_CHALLENGE data to answer: a ring of four, eight bytes each, `pathCount` from `pathHead`. */
  pathData: u8[]
  frame: QuicFrame
  /** The header and the packet numbers of the packet being read, reused for every one. */
  header: QuicHeader
  packet: QuicPacket
  /** For a connection `acceptRetry` set up: the DCID of the client's Initial before the Retry, and the Retry's SCID. */
  retryOriginalDcid: u8[]
  retryScid: u8[]
  /** An empty array, which a cleared secret or ID is set to. */
  none: u8[]
  /** The latest time the caller gave, in milliseconds; time never runs backwards here. */
  now: i64 = 0
  /** When the idle timer last restarted (RFC 9000 §10.1), or -1 before the first packet. */
  idleSince: i64 = -1
  /**
   * The 1-RTT secrets of the current generation, the next generation's read
   * secret, and its read keys (RFC 9001 §6.1, §6.3). `otherReadKeys` holds
   * the next generation's while `otherIsNext`, and for a probe timeout after
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
  /** The packet number of a client key update read but not applied yet, or -1. */
  phasePending: i64 = -1
  /** The largest DATAGRAM frame the client takes (its `max_datagram_frame_size`), 0 for none. */
  peerMaxDatagramFrame: i64 = 0
  originalDcidLength: i32 = 0
  peerScidLength: i32 = 0
  pathHead: i32 = 0
  pathCount: i32 = 0
  state: i32 = 0
  /** Packets dropped without closing the connection: unparseable, unauthenticated, duplicated, or for keys not held. */
  dropped: i32 = 0
  /** Key updates the client started, against `QUIC_CONN_MAX_KEY_UPDATES`. */
  keyUpdates: i32 = 0
  /** Which of the Application Data space's two read slots, and two write slots, hold the current keys. */
  appReadSlot: i32 = 0
  appWriteSlot: i32 = 0
  /** Which of `readSecrets` and `writeSecrets` (0 or 1) holds the current secret, or -1 for `TlsServer`'s own. */
  readSecretCurrent: i32 = -1
  writeSecretCurrent: i32 = -1
  /** Handshake data sent again early, against `QUIC_CONN_EARLY_RESENDS` (RFC 9002 §6.2.3). */
  earlyResends: i32 = 0
  /** The level at which the packet just read showed the client lacks the server's handshake data, or -1. */
  resendLevel: i32 = -1
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
  /** Whether the packet just read brought CRYPTO bytes for TLS, or retired an ID that wants replacing. */
  cryptoArrived: boolean = false
  topUpOwed: boolean = false

  /**
   * A connection under `config`, with `entropy` its `QUIC_CONN_ENTROPY_SIZE`
   * random bytes, which are copied out and then wiped in the caller's array.
   * Every buffer the connection will use is made here, sized by `config`.
   * Entropy of another length, or limits outside what `QuicServerConfig`
   * documents, leave the connection closing with INTERNAL_ERROR before it
   * reads anything; it then sends nothing.
   */
  constructor(config: QuicServerConfig, entropy: u8[]) {
    this.config = config
    this.serverRandom = new Array<u8>(32)
    this.ephemeralPrivate = new Array<u8>(32)
    this.localScid = new Array<u8>(QUIC_CONN_CID_LENGTH)
    this.cidSeed = new Array<u8>(32)
    this.originalDcid = new Array<u8>(QUIC_MAX_CID_LENGTH)
    this.peerScid = new Array<u8>(QUIC_MAX_CID_LENGTH)
    this.initial = new QuicConnSpace(TLS_LEVEL_INITIAL)
    this.handshake = new QuicConnSpace(TLS_LEVEL_HANDSHAKE)
    this.application = new QuicConnSpace(TLS_LEVEL_APPLICATION)
    this.cids = new QuicCidTable(
      config.activeConnectionIdLimit >= 2 && config.activeConnectionIdLimit <= 8
        ? config.activeConnectionIdLimit
        : 2,
      QUIC_CONN_LOCAL_CIDS
    )
    this.recovery = new QuicRecovery()
    this.defaultParameters = new QuicTransportParameters()
    this.peerParameters = this.defaultParameters
    // A configuration that does not fit closes the connection at once (see
    // `begin`), so it gets no stream or datagram buffers at all.
    const fits: boolean = quicConnConfigFits(config)
    const streams: i64 = fits ? config.maxStreamsBidi : QUIC_CONN_NONE
    const uni: i64 = fits ? config.maxStreamsUni : QUIC_CONN_NONE
    const local: i64 = fits ? config.localStreams : QUIC_CONN_NONE
    const buffer: i32 = fits ? toI32(config.maxStreamData) : QUIC_CONN_FROM
    this.streams = new QuicStreams(streams, uni, local, buffer, fits ? config.maxData : QUIC_CONN_NONE)
    // The rings are made only when DATAGRAM frames are offered at all.
    const datagrams: i32 = fits && config.maxDatagramFrameSize > 0 ? QUIC_CONN_DATAGRAM_QUEUE : 0
    this.datagramsOut = new QuicDatagramQueue(datagrams, QUIC_CONN_DATAGRAM_SIZE)
    this.datagramsIn = new QuicDatagramQueue(
      datagrams,
      fits ? toI32(config.maxDatagramFrameSize) : QUIC_CONN_FROM
    )
    this.cryptoIn = new QuicConnReassembly(QUIC_CONN_CRYPTO_WINDOW)
    this.pathData = new Array<u8>(QUIC_PATH_DATA_SIZE * 4)
    this.frame = new QuicFrame()
    this.header = new QuicHeader()
    this.packet = new QuicPacket()
    this.none = []
    this.retryOriginalDcid = []
    this.retryScid = []
    this.localParameters = new QuicTransportParameters()
    this.localEncoded = []
    this.parsedParameters = new QuicTransportParameters()
    const extra: u8[] = []
    this.tlsConfig = {
      certificateChain: config.certificateChain,
      alpn: config.alpn,
      quicTransportParameters: this.localEncoded,
      extraExtensions: extra,
      signatureScheme: config.signatureScheme,
      quic: true,
    }
    this.kdf = new HkdfScratch()
    this.initialClient = new Array<u8>(32)
    this.initialServer = new Array<u8>(32)
    this.writeSecrets = quicConnSecretPool()
    this.readSecrets = quicConnSecretPool()
    this.cidScratch = new Array<u8>(QUIC_CONN_CID_LENGTH)
    this.tokenScratch = new Array<u8>(QUIC_RESET_TOKEN_SIZE)
    this.appReadSecret = this.none
    this.appWriteSecret = this.none
    this.nextReadSecret = this.none
    this.begin(entropy)
  }

  /**
   * Makes this slot a new connection for the next client, with `entropy`
   * its `QUIC_CONN_ENTROPY_SIZE` fresh random bytes (wiped in the caller's
   * array): every secret of the last connection is wiped first, as
   * `release()` does, and every buffer is kept and emptied. The limits are
   * the constructor's configuration's. A slot reset this way allocates
   * nothing, and neither does the next handshake (QUIC-3 in
   * `docs/security/quic.md`).
   */
  reset(entropy: u8[]): void {
    this.wipeAll()
    this.initial.reset()
    this.handshake.reset()
    this.application.reset()
    this.cids.reset()
    this.recovery.reset()
    this.streams.reset()
    this.datagramsOut.reset()
    this.datagramsIn.reset()
    this.cryptoIn.reset(TLS_LEVEL_INITIAL)
    this.peerParameters = this.defaultParameters
    // The slot keeps its `TlsServer`, wiped by `wipeAll`; the next handshake restarts it.
    this.tls = null
    this.error = 0
    this.errorFrameType = 0
    this.bytesReceived = 0
    this.bytesSent = 0
    this.alpn = ""
    this.serverName = ""
    quicConnRefill(this.retryOriginalDcid, this.none, QUIC_CONN_FROM, QUIC_CONN_FROM)
    quicConnRefill(this.retryScid, this.none, QUIC_CONN_FROM, QUIC_CONN_FROM)
    this.appReadSecret = this.none
    this.appWriteSecret = this.none
    this.nextReadSecret = this.none
    this.otherReadKeys = null
    this.appReadSlot = 0
    this.appWriteSlot = 0
    this.readSecretCurrent = -1
    this.writeSecretCurrent = -1
    this.earlyResends = 0
    this.resendLevel = -1
    this.now = 0
    this.idleSince = -1
    this.readPhaseLowest = -1
    this.readPhaseHighest = -1
    this.writePhaseFirst = 0
    this.keyRetainUntil = -1
    this.phasePending = -1
    this.peerMaxDatagramFrame = 0
    this.originalDcidLength = 0
    this.peerScidLength = 0
    this.pathHead = 0
    this.pathCount = 0
    this.state = QUIC_STATE_WAIT_INITIAL
    this.dropped = 0
    this.keyUpdates = 0
    this.errorIsApplication = false
    this.closeSent = false
    this.addressValidated = false
    this.handshakeComplete = false
    this.handshakeDonePending = false
    this.retried = false
    this.elicitingSent = false
    this.otherIsNext = false
    this.readPhase = false
    this.writePhase = false
    this.cryptoArrived = false
    this.topUpOwed = false
    this.begin(entropy)
  }

  /** Takes `entropy` (and wipes it), or closes with INTERNAL_ERROR for entropy or a configuration that does not fit. */
  begin(entropy: u8[]): void {
    quicCidCopy(this.serverRandom, entropy, 0, 32)
    quicCidCopy(this.ephemeralPrivate, entropy, 32, 32)
    quicCidCopy(this.localScid, entropy, 64, QUIC_CONN_CID_LENGTH)
    quicCidCopy(this.cidSeed, entropy, 72, 32)
    const fits: boolean = toI32(entropy.length) === QUIC_CONN_ENTROPY_SIZE && quicConnConfigFits(this.config)
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
    quicConnRefill(this.retryOriginalDcid, originalDcid, QUIC_CONN_FROM, toI32(originalDcid.length))
    quicConnRefill(this.retryScid, retryScid, QUIC_CONN_FROM, toI32(retryScid.length))
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
    return this.ownsConnectionIdAt(dcid, QUIC_CONN_FROM, toI32(dcid.length))
  }

  /** `ownsConnectionId` of the ID `buf[at .. at + length)`, read in place, so a carrier routes without a copy. */
  ownsConnectionIdAt(buf: u8[], at: i32, length: i32): boolean {
    if (this.cids.ownsLocalAt(buf, at, length)) {
      return true
    }
    return (
      !this.handshakeComplete &&
      this.originalDcidLength > 0 &&
      length === this.originalDcidLength &&
      timingSafeEqualAt(buf, at, this.originalDcid, QUIC_CONN_FROM, length)
    )
  }

  /** `receiveWindow` of a whole datagram. */
  receive(datagram: u8[], now: i64): i64 {
    return this.receiveWindow(datagram, QUIC_CONN_FROM, toI32(datagram.length), now)
  }

  /**
   * Takes one datagram from the client, `buf[off .. off + len)`, which
   * arrived at `now` (the caller's monotonic time in milliseconds): every
   * packet in it is opened and its frames acted on, in order. `buf` is read,
   * never written, so a GRO receive buffer is handed over a datagram at a
   * time. Answers 0, or the error the connection closed with — in which case
   * `takeDatagramInto` writes the CONNECTION_CLOSE to send. A packet that
   * cannot be used is dropped and counted (see the module header). Once the
   * connection has closed, or its idle timeout has passed by `now`, every
   * datagram is ignored.
   */
  receiveWindow(buf: u8[], off: i32, len: i32, now: i64): i64 {
    this.runClocks(now)
    if (this.closed()) {
      return this.error
    }
    if (off < 0 || len < 0 || off > toI32(buf.length) - len) {
      this.drop()
      return 0
    }
    // §14.1: a client's first Initial comes in a datagram of at least 1200 bytes.
    if (this.state === QUIC_STATE_WAIT_INITIAL && len < QUIC_CONN_DATAGRAM_SIZE) {
      this.drop()
      return 0
    }
    const end: i32 = off + len
    let at: i32 = off
    let counted: boolean = false
    while (at < end) {
      if (quicParseHeaderInto(this.header, buf, at, end, QUIC_CONN_CID_LENGTH) !== QUIC_PACKET_OK) {
        this.drop()
        break
      }
      counted = this.receivePacket(buf, this.header) || counted
      const type: i32 = this.header.type
      const next: i32 = this.header.end
      if (this.closed() || type === QUIC_PACKET_SHORT || next <= at) {
        break
      }
      at = next
    }
    // A datagram counts toward the amplification limit once one of its packets
    // proves it is this connection's (RFC 9000 §8.1).
    if (counted) {
      this.bytesReceived = this.bytesReceived + toI64(len)
    }
    // Loss recovery's timer runs after the datagram, so an acknowledgement
    // it carries settles what it acknowledges before a probe is owed.
    this.runRecoveryTimer()
    return this.closed() ? this.error : QUIC_ERROR_NO_ERROR
  }

  /**
   * Starts the connection from the client's first Initial, `header`: the
   * original DCID and the client's SCID, and the Initial keys (RFC 9001
   * §5.2). Answers whether it could: the client's DCID must be at least 8
   * bytes (§7.2). The rest of the connection — its first local ID and the
   * `TlsServer` — is made by `establish` once the Initial has opened, so an
   * Initial that does not authenticate costs only its keys.
   */
  start(buf: u8[], header: QuicHeader): boolean {
    if (
      header.dcidLength < 8 ||
      header.dcidLength > QUIC_MAX_CID_LENGTH ||
      header.scidLength > QUIC_MAX_CID_LENGTH
    ) {
      return false
    }
    const secrets: boolean = quicInitialSecretsInto(
      this.kdf,
      buf,
      header.dcidStart,
      header.dcidLength,
      this.initialClient,
      this.initialServer
    )
    if (!secrets) {
      return false
    }
    this.initial.readKeys = quicKeysInto(
      this.kdf,
      this.initial.keySlot(QUIC_CONN_READ_SLOT),
      QUIC_AEAD_AES_128_GCM,
      this.initialClient
    )
    this.initial.writeKeys = quicKeysInto(
      this.kdf,
      this.initial.keySlot(QUIC_CONN_WRITE_SLOT),
      QUIC_AEAD_AES_128_GCM,
      this.initialServer
    )
    quicCidCopy(this.originalDcid, buf, header.dcidStart, header.dcidLength)
    this.originalDcidLength = header.dcidLength
    quicCidCopy(this.peerScid, buf, header.scidStart, header.scidLength)
    this.peerScidLength = header.scidLength
    this.state = QUIC_STATE_HANDSHAKE
    return true
  }

  /**
   * The rest of `start`, once the first Initial has opened: the first local
   * connection ID, and the slot's `TlsServer` started with transport
   * parameters that name both IDs (RFC 9000 §7.3), the Retry's when
   * `acceptRetry` set one up, and the first ID's stateless reset token
   * (§18.2).
   */
  establish(): void {
    const none: u8[] = this.none
    const token: u8[] = this.tokenScratch
    quicConnResetTokenInto(
      this.kdf.sha256,
      this.config.statelessResetKey,
      this.localScid,
      QUIC_CONN_FROM,
      QUIC_CONN_CID_LENGTH,
      token,
      QUIC_CONN_FROM
    )
    this.cids.addLocal(this.localScid, token)
    this.cids.addPeerAt(
      QUIC_CONN_NONE,
      QUIC_CONN_NONE,
      this.peerScid,
      QUIC_CONN_FROM,
      this.peerScidLength,
      none,
      QUIC_CONN_FROM,
      false
    )
    // §8.1.2: a Retry token the listener checked has validated the address.
    this.addressValidated = this.retried

    // The parameters, and their encoding, are rewritten in the slot's own
    // arrays, which grow only when a connection needs more than any before.
    const params: QuicTransportParameters = this.localParameters
    if (this.retried) {
      quicConnRefill(
        params.originalDcid,
        this.retryOriginalDcid,
        QUIC_CONN_FROM,
        toI32(this.retryOriginalDcid.length)
      )
    } else {
      quicConnRefill(params.originalDcid, this.originalDcid, QUIC_CONN_FROM, this.originalDcidLength)
    }
    params.hasOriginalDcid = true
    params.initialScid = this.localScid
    params.hasInitialScid = true
    quicConnRefill(params.retryScid, this.retryScid, QUIC_CONN_FROM, toI32(this.retryScid.length))
    params.hasRetryScid = this.retried
    quicConnRefill(params.statelessResetToken, token, QUIC_CONN_FROM, QUIC_RESET_TOKEN_SIZE)
    params.hasStatelessResetToken = true
    secureZero(token)
    params.maxIdleTimeout = this.config.maxIdleTimeout
    params.initialMaxData = this.config.maxData
    params.initialMaxStreamDataBidiRemote = this.config.maxStreamData
    params.initialMaxStreamsBidi = this.config.maxStreamsBidi
    // Each of these is advertised only when the configuration uses it, so a
    // configuration without them sends the parameters it always has.
    params.initialMaxStreamDataBidiLocal = this.config.localStreams > 0 ? this.config.maxStreamData : 0
    params.initialMaxStreamsUni = this.config.maxStreamsUni
    params.initialMaxStreamDataUni = this.config.maxStreamsUni > 0 ? this.config.maxStreamData : 0
    params.maxDatagramFrameSize = this.config.maxDatagramFrameSize
    params.activeConnectionIdLimit = this.config.activeConnectionIdLimit
    // The server never migrates and asks the client not to (§9): path
    // validation beyond answering PATH_CHALLENGE is not here.
    params.disableActiveMigration = true
    quicEncodeTransportParametersInto(params, this.localEncoded)
    // One `TlsServer` a slot, made by its first handshake (so its flight is
    // sized for these parameters) and restarted, wiped, by each after it.
    const tls: TlsServer | null = this.tlsSlot
    if (tls !== null) {
      tls.restart(this.serverRandom, this.ephemeralPrivate)
      this.tls = tls
    } else {
      const made: TlsServer = new TlsServer(this.tlsConfig, this.serverRandom, this.ephemeralPrivate)
      this.tlsSlot = made
      this.tls = made
    }
  }

  /**
   * One packet of a datagram. Answers whether the packet was used: whether it
   * authenticated as this connection's.
   */
  receivePacket(buf: u8[], header: QuicHeader): boolean {
    const type: i32 = header.type
    const first: boolean = this.state === QUIC_STATE_WAIT_INITIAL
    if (first && (type !== QUIC_PACKET_INITIAL || !this.start(buf, header))) {
      this.drop()
      return false
    }
    const used: boolean = this.openPacket(buf, header, first)
    // A first Initial that does not open leaves nothing behind but its keys:
    // the next datagram is read as a first Initial again.
    if (first && !used) {
      this.unstart()
    }
    return used
  }

  /** Undoes `start`, for a first Initial that turned out not to authenticate. */
  unstart(): void {
    this.state = QUIC_STATE_WAIT_INITIAL
    this.addressValidated = false
    this.idleSince = -1
    this.initial.reset()
    this.originalDcidLength = 0
    this.peerScidLength = 0
  }

  /**
   * Opens one packet of a connection already started, and acts on its frames.
   * The opening and the frames run inside an arena block (`openScoped`), so
   * their temporaries go when it ends; what may grow a buffer of the slot —
   * a first Initial's `TlsServer` and parameters, a key update, TLS reading
   * the CRYPTO bytes and what it answers — runs after it. Answers whether
   * the packet was used.
   */
  openPacket(buf: u8[], header: QuicHeader, first: boolean): boolean {
    const type: i32 = header.type
    const space: QuicConnSpace | null = this.spaceOf(type)
    if (space === null || !this.addressedHere(buf, header)) {
      this.drop()
      return false
    }
    const keys: QuicKeys | null = space.readKeys
    // RFC 9001 §5.7: no 1-RTT packet is processed before the handshake is complete.
    if (keys === null || space.discarded || (type === QUIC_PACKET_SHORT && !this.handshakeComplete)) {
      this.drop()
      return false
    }
    this.cryptoArrived = false
    this.topUpOwed = false
    this.phasePending = -1
    this.resendLevel = -1
    let used: boolean = false
    {
      using _scope = arena()
      used = this.openScoped(buf, header, space, keys)
    }
    if (!used) {
      return false
    }
    if (first) {
      this.establish()
    }
    if (this.phasePending >= 0 && !this.closed()) {
      this.applyPhase(this.phasePending)
    }
    if (this.closed()) {
      return true
    }
    if (type === QUIC_PACKET_HANDSHAKE) {
      // §8.1: a Handshake packet proves the client holds its address; RFC
      // 9001 §4.9.1: the server is then done with the Initial keys.
      this.addressValidated = true
      this.discard(this.initial)
    }
    if (this.cryptoArrived) {
      this.feedTls()
    }
    this.afterTls()
    if (this.topUpOwed) {
      this.topUpConnectionIds()
    }
    if (this.resendLevel >= 0 && !this.closed()) {
      this.resendEarly(this.resendLevel)
    }
    return true
  }

  /**
   * `openPacket`'s half inside the arena block: header protection off, the
   * payload decrypted (with the other key generation's keys when the Key
   * Phase bit says so), and every frame acted on. Nothing it calls stores
   * an allocation, which is what lets the block release the packet's
   * temporaries. Answers whether the packet was used rather than dropped.
   */
  openScoped(buf: u8[], header: QuicHeader, space: QuicConnSpace, keys: QuicKeys): boolean {
    const packet: QuicPacket = this.packet
    // Every key generation shares the header-protection key (RFC 9001 §6),
    // so the current keys take it off whatever the Key Phase bit says.
    const clear: u8[] = quicUnprotectHeader(keys, buf, header, space.received.largest, packet)
    const type: i32 = header.type
    const other: boolean = type === QUIC_PACKET_SHORT && packet.keyPhase !== this.readPhase
    const open: QuicKeys | null = other ? this.otherReadKeys : keys
    if (open === null || packet.packetNumber < 0) {
      this.drop()
      return false
    }
    const payload: u8[] | null = quicDecryptPayload(open, buf, header, clear, packet)
    if (payload === null) {
      this.drop()
      return false
    }
    // §17.2, §17.3.1: reserved bits set under a valid tag close the connection.
    if (packet.error === QUIC_ERR_RESERVED_BITS) {
      this.fail(QUIC_ERROR_PROTOCOL_VIOLATION, QUIC_CONN_NONE)
      return true
    }
    const pn: i64 = packet.packetNumber
    if (space.received.contains(pn)) {
      this.drop()
      return true
    }
    if (type === QUIC_PACKET_SHORT && !this.notePhase(pn, other)) {
      return true
    }
    const eliciting: boolean = this.receiveFrames(space, type, payload, buf, header)
    if (this.closed()) {
      return true
    }
    // RFC 9002 §6.2.3: a client that sends an ack-eliciting Handshake packet
    // while the server's Handshake data is in flight may not have it all.
    if (eliciting && type === QUIC_PACKET_HANDSHAKE) {
      this.resendLevel = TLS_LEVEL_HANDSHAKE
    }
    space.received.record(pn, eliciting)
    // §10.1: a packet received and processed restarts the idle timer.
    this.idleSince = this.now
    this.elicitingSent = false
    return true
  }

  /**
   * Checks a 1-RTT packet `pn` that opened under the current read keys, or,
   * when `other`, under the other set (RFC 9001 §6.2, §6.4, §6.5). Under the
   * next generation's it is a key update, which `applyPhase` carries out
   * once the packet is read. Under the previous generation's it is a packet
   * the network delayed. Either is KEY_UPDATE_ERROR when it breaks §6.4's
   * order — a higher packet number under older keys than a lower one
   * already had — and an update past `QUIC_CONN_MAX_KEY_UPDATES` is too.
   * Answers whether the connection is still open.
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
    if (this.writePhase === this.readPhase && this.keyUpdates >= QUIC_CONN_MAX_KEY_UPDATES) {
      this.fail(QUIC_ERROR_KEY_UPDATE, QUIC_CONN_NONE)
      return false
    }
    this.phasePending = pn
    return true
  }

  /**
   * Carries out the client's key update `notePhase` found in packet `pn`
   * (RFC 9001 §6.2): the write keys follow, unless the server started this
   * update, before anything acknowledges the packet; the read keys move on,
   * and the previous ones are kept for a probe timeout.
   */
  applyPhase(pn: i64): void {
    if (this.writePhase === this.readPhase) {
      this.keyUpdates = this.keyUpdates + 1
      if (!this.updateWriteKeys()) {
        this.fail(QUIC_ERROR_INTERNAL, QUIC_CONN_NONE)
        return
      }
    }
    const previous: QuicKeys | null = this.application.readKeys
    this.application.readKeys = this.otherReadKeys
    this.otherReadKeys = previous
    this.otherIsNext = false
    this.appReadSlot = 1 - this.appReadSlot
    secureZero(this.appReadSecret)
    this.appReadSecret = this.nextReadSecret
    this.readSecretCurrent = this.readSecretCurrent === 0 ? 1 : 0
    this.nextReadSecret = this.none
    this.readPhase = !this.readPhase
    this.readPhaseLowest = pn
    this.readPhaseHighest = pn
    this.keyRetainUntil = this.now + this.recovery.probeTimeout()
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
    const target: i32 = this.writeSecretCurrent === 0 ? 1 : 0
    const secret: u8[] = quicConnSecretAt(this.writeSecrets, keys.aead, target)
    if (!quicKeyUpdateSecretInto(this.kdf, keys.aead, this.appWriteSecret, secret)) {
      return false
    }
    const slot: QuicKeysSlot = this.application.keySlot(QUIC_CONN_APP_WRITE_SLOTS + 1 - this.appWriteSlot)
    const next: QuicKeys | null = quicKeysUpdateInto(this.kdf, slot, keys, secret)
    if (next === null) {
      secureZero(secret)
      return false
    }
    quicConnWipePacketKey(keys)
    secureZero(this.appWriteSecret)
    this.application.writeKeys = next
    this.appWriteSecret = secret
    this.writeSecretCurrent = target
    this.appWriteSlot = 1 - this.appWriteSlot
    this.writePhase = !this.writePhase
    this.writePhaseFirst = this.application.nextPn
    return true
  }

  /**
   * Derives the next generation's read secret and keys from the current
   * ones, into `otherReadKeys`, wiping the previous generation's key and IV
   * that sat there (RFC 9001 §6.3, §6.5). It runs when the 1-RTT keys are
   * installed and a probe timeout after each update, never while a packet is
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
    const secret: u8[] = quicConnSecretAt(this.readSecrets, keys.aead, this.readSecretCurrent === 0 ? 1 : 0)
    if (!quicKeyUpdateSecretInto(this.kdf, keys.aead, this.appReadSecret, secret)) {
      return
    }
    this.nextReadSecret = secret
    this.otherReadKeys = quicKeysUpdateInto(
      this.kdf,
      this.application.keySlot(1 - this.appReadSlot),
      keys,
      secret
    )
    this.otherIsNext = this.otherReadKeys !== null
  }

  /**
   * Whether `header`'s connection IDs are this connection's: a long header
   * from the client's first SCID to the server's ID (or, for an Initial,
   * the original DCID), a short header to an active local ID. Read in place
   * from `buf`.
   */
  addressedHere(buf: u8[], header: QuicHeader): boolean {
    if (header.type === QUIC_PACKET_SHORT) {
      return this.cids.ownsLocalAt(buf, header.dcidStart, header.dcidLength)
    }
    if (
      header.scidLength !== this.peerScidLength ||
      !timingSafeEqualAt(buf, header.scidStart, this.peerScid, QUIC_CONN_FROM, this.peerScidLength)
    ) {
      return false
    }
    if (
      header.dcidLength === QUIC_CONN_CID_LENGTH &&
      timingSafeEqualAt(buf, header.dcidStart, this.localScid, QUIC_CONN_FROM, QUIC_CONN_CID_LENGTH)
    ) {
      return true
    }
    return (
      header.type === QUIC_PACKET_INITIAL &&
      header.dcidLength === this.originalDcidLength &&
      timingSafeEqualAt(buf, header.dcidStart, this.originalDcid, QUIC_CONN_FROM, this.originalDcidLength)
    )
  }

  /**
   * Acts on every frame of a packet's payload, in order, and answers whether
   * any asked for an acknowledgement. A payload with no frames, a frame that
   * does not parse and a frame the packet type may not carry close the
   * connection (RFC 9000 §12.4).
   */
  receiveFrames(
    space: QuicConnSpace,
    packetType: i32,
    payload: u8[],
    buf: u8[],
    header: QuicHeader
  ): boolean {
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
      this.receiveFrame(space, frame, payload, at, buf, header)
      if (this.closed() || frame.end <= at) {
        return eliciting
      }
      at = frame.end
    }
    return eliciting
  }

  /** Closes the connection with `error` from a stream frame of `type`, unless it is 0. */
  failOn(error: i64, type: i64): void {
    if (error !== QUIC_ERROR_NO_ERROR) {
      this.fail(error, type)
    }
  }

  /**
   * One frame, which the packet type is allowed to carry: it starts at
   * `payload[frameStart]`, and the packet's header is `header` in `buf`.
   */
  receiveFrame(
    space: QuicConnSpace,
    frame: QuicFrame,
    payload: u8[],
    frameStart: i32,
    buf: u8[],
    header: QuicHeader
  ): void {
    const type: i64 = toI64(frame.type)
    const streams: QuicStreams = this.streams
    switch (frame.type) {
      case QUIC_FRAME_ACK:
      case QUIC_FRAME_ACK_ECN:
        this.receiveAck(space, frame)
        break
      case QUIC_FRAME_CRYPTO:
        this.receiveCrypto(space, frame, payload)
        break
      case QUIC_FRAME_STREAM:
        this.failOn(
          streams.onStream(
            frame.streamId,
            frame.offset,
            payload,
            frame.dataStart,
            frame.dataLength,
            frame.fin
          ),
          type
        )
        break
      case QUIC_FRAME_RESET_STREAM:
        this.failOn(streams.onReset(frame.streamId, frame.errorCode, frame.value), type)
        break
      case QUIC_FRAME_STOP_SENDING:
        this.failOn(streams.onStopSending(frame.streamId, frame.errorCode), type)
        break
      case QUIC_FRAME_MAX_STREAM_DATA:
        this.failOn(streams.onMaxStreamData(frame.streamId, frame.value), type)
        break
      case QUIC_FRAME_STREAM_DATA_BLOCKED:
        this.failOn(streams.onStreamDataBlocked(frame.streamId), type)
        break
      case QUIC_FRAME_MAX_DATA:
        streams.onMaxData(frame.value)
        break
      case QUIC_FRAME_MAX_STREAMS_BIDI:
        streams.onMaxStreams(false, frame.value)
        break
      case QUIC_FRAME_MAX_STREAMS_UNI:
        streams.onMaxStreams(true, frame.value)
        break
      case QUIC_FRAME_DATAGRAM:
        this.receiveDatagram(frame, payload, frameStart)
        break
      case QUIC_FRAME_NEW_CONNECTION_ID: {
        // §19.15: a client that chose a zero-length connection ID has none to give.
        const error: i64 =
          this.peerScidLength === 0
            ? QUIC_ERROR_PROTOCOL_VIOLATION
            : this.cids.addPeerAt(
                frame.value,
                frame.retirePriorTo,
                payload,
                frame.connectionIdStart,
                frame.connectionIdLength,
                payload,
                frame.resetTokenStart,
                true
              )
        this.failOn(error, type)
        break
      }
      case QUIC_FRAME_RETIRE_CONNECTION_ID: {
        const error: i64 = this.cids.retireLocal(frame.value, buf, header.dcidStart, header.dcidLength)
        this.failOn(error, type)
        this.topUpOwed = error === QUIC_ERROR_NO_ERROR
        break
      }
      case QUIC_FRAME_PATH_CHALLENGE:
        this.receivePathChallenge(frame, payload)
        break
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
        // PADDING, PING, DATA_BLOCKED and STREAMS_BLOCKED ask nothing: credit
        // and limits follow what the application reads and finishes, not
        // what the client asks for.
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

  /**
   * An ACK frame: acknowledging a packet number this space never sent is a
   * PROTOCOL_VIOLATION (§13.1). Otherwise loss recovery reads it (RFC 9002
   * §5, §6.1, §7): each packet it newly acknowledges releases what it
   * carried, and each it shows lost has its frames queued again.
   */
  receiveAck(space: QuicConnSpace, frame: QuicFrame): void {
    if (frame.largest >= space.nextPn) {
      this.fail(QUIC_ERROR_PROTOCOL_VIOLATION, toI64(frame.type))
      return
    }
    if (frame.largest > space.largestAcked) {
      space.largestAcked = frame.largest
    }
    const sent: QuicSentPackets | null = this.recovery.space(space.level)
    const delay: i64 = this.ackDelayOf(frame.ackDelay)
    if (
      sent === null ||
      this.recovery.onAck(space.level, frame.ackRanges, frame.ackRangeCount, delay, this.now) <= 0
    ) {
      return
    }
    for (let k: i32 = 0; k < sent.ackedCount; k += 1) {
      this.untrack(space, sent.ackedSlot(k))
    }
    this.packetsLost(space, sent)
  }

  /**
   * An ACK frame's ACK Delay in milliseconds: the field scaled by the
   * client's `ack_delay_exponent` (RFC 9000 §19.3, §18.2). A value too large
   * to scale is held at 2^40 microseconds first, which is still far past any
   * `max_ack_delay` it is then bounded by (RFC 9002 §5.3).
   */
  ackDelayOf(field: i64): i64 {
    let exponent: i64 = this.peerParameters.ackDelayExponent
    if (exponent < 0 || exponent > 20) {
      exponent = 3
    }
    const ceiling: i64 = 1099511627776
    const value: i64 = field > ceiling || field < 0 ? ceiling : field
    return (value << exponent) / 1000
  }

  /** Every packet of `space` that loss recovery's last call declared lost: what each carried is queued again. */
  packetsLost(space: QuicConnSpace, sent: QuicSentPackets): void {
    for (let k: i32 = 0; k < sent.lostCount; k += 1) {
      this.requeue(space, sent.lostSlot(k))
    }
  }

  /**
   * Queues again what the packet in row `row` of `space` carried (RFC 9000
   * §13.3): its CRYPTO range, its STREAM chunks with their FIN, HANDSHAKE_DONE,
   * the NEW_CONNECTION_ID of an ID still active, the RETIRE_CONNECTION_ID of
   * one not queued already, and each stream control frame that still says
   * something. A DATAGRAM is never in a record, so it never goes again.
   */
  requeue(space: QuicConnSpace, row: i32): void {
    space.resendCrypto(space.cryptoOffset(row), space.cryptoLength(row))
    if ((space.flags(row) & QUIC_CONN_SENT_HANDSHAKE_DONE) !== 0) {
      this.handshakeDonePending = true
    }
    const streams: i32 = space.streamCount(row)
    for (let j: i32 = 0; j < streams; j += 1) {
      const at: i32 = row * QUIC_CONN_PACKET_STREAMS + j
      if (
        at >= 0 &&
        at < toI32(space.sentStreamId.length) &&
        at < toI32(space.sentStreamOffset.length) &&
        at < toI32(space.sentStreamLength.length) &&
        at < toI32(space.sentStreamFin.length)
      ) {
        this.streams.chunkLost(
          space.sentStreamId[at],
          space.sentStreamOffset[at],
          space.sentStreamLength[at],
          toI32(space.sentStreamFin[at]) !== 0
        )
      }
    }
    const control: i32 = space.controlCount(row)
    for (let j: i32 = 0; j < control; j += 1) {
      const at: i32 = row * QUIC_CONN_PACKET_CONTROL + j
      if (at >= 0 && at < toI32(space.sentControlKind.length) && at < toI32(space.sentControlValue.length)) {
        this.requeueControl(toI32(space.sentControlKind[at]), space.sentControlValue[at])
      }
    }
  }

  /** A lost control frame of kind `kind` (a sequence number or a stream in `value`), queued again unless it no longer matters. */
  requeueControl(kind: i32, value: i64): void {
    if (kind === QUIC_CONN_CONTROL_NEW_CID) {
      for (const entry of this.cids.local) {
        if (entry.used && entry.sequence === value) {
          entry.announced = false
        }
      }
      return
    }
    if (kind === QUIC_CONN_CONTROL_RETIRE) {
      this.cids.queueRetire(value)
      return
    }
    this.streams.controlLost(kind, value)
  }

  /**
   * A probe timeout fired (RFC 9002 §6.2.4): in every space with packets in
   * flight, everything they carry is queued again and the next packets are
   * probes, sent whatever the window says, with a PING if nothing is left to
   * carry. During the handshake that resends the Initial and the Handshake
   * flight together, which is what a client that lost both needs, and does
   * it twice (`QUIC_CONN_HANDSHAKE_PROBES`), so that one more lost datagram
   * does not cost another, doubled, probe timeout.
   */
  probe(): void {
    for (let level: i32 = 0; level < 3; level += 1) {
      const space: QuicConnSpace = this.spaceAt(level)
      const sent: QuicSentPackets | null = this.recovery.space(level)
      if (sent === null || space.discarded || sent.inFlight === 0) {
        continue
      }
      for (let k: i32 = 0; k < sent.count; k += 1) {
        const slot: i32 = sent.slot(k)
        if (sent.inFlightAt(slot)) {
          this.requeue(space, slot)
        }
      }
      space.probes = QUIC_CONN_HANDSHAKE_PROBES
      if (level === TLS_LEVEL_APPLICATION) {
        space.probes = 1
      }
    }
  }

  /**
   * Speeds up the handshake (RFC 9002 §6.2.3): the client showed at `level`
   * that it lacks the server's handshake data there — an Initial with CRYPTO
   * data the server already read, or an ack-eliciting Handshake packet —
   * so, while the server's own packets at that level are in flight, the
   * oldest one's CRYPTO data at that level and at Handshake goes again now,
   * as one probe datagram, rather than at the probe timeout. It does so at
   * most `QUIC_CONN_EARLY_RESENDS` times a connection, and not while an
   * earlier probe is still owed, so each packet the client sends asks for
   * one datagram at most. The anti-amplification limit holds it like any
   * datagram (`takeDatagramInto`).
   */
  resendEarly(level: i32): void {
    const asked: QuicSentPackets | null = this.recovery.space(level)
    if (
      asked === null ||
      asked.inFlight === 0 ||
      this.earlyResends >= QUIC_CONN_EARLY_RESENDS ||
      this.initial.probes > 0 ||
      this.handshake.probes > 0
    ) {
      return
    }
    let queued: boolean = false
    for (let at: i32 = level; at <= TLS_LEVEL_HANDSHAKE; at += 1) {
      const space: QuicConnSpace = this.spaceAt(at)
      const sent: QuicSentPackets | null = this.recovery.space(at)
      if (sent === null || space.discarded || sent.inFlight === 0) {
        continue
      }
      // Compacted, the ring's oldest slot is the oldest packet in flight.
      sent.compact()
      const oldest: i32 = sent.slot(QUIC_CONN_FROM)
      const length: i32 = space.cryptoLength(oldest)
      if (length > 0) {
        space.resendCrypto(space.cryptoOffset(oldest), length)
        space.probes = 1
        queued = true
      }
    }
    if (queued) {
      this.earlyResends += 1
    }
  }

  /**
   * A CRYPTO frame: its data put back in order, for TLS to read once the
   * packet is (`feedTls`). The buffer follows the level the client is
   * sending at; data of a level it has moved past is a duplicate of what
   * TLS already read, or, past that, a message TLS is not reading, which is
   * its alert unexpected_message (RFC 9001 §4.8). A frame too far ahead is
   * CRYPTO_BUFFER_EXCEEDED.
   */
  receiveCrypto(space: QuicConnSpace, frame: QuicFrame, payload: u8[]): void {
    const reassembly: QuicConnReassembly = this.cryptoIn
    if (space.level < reassembly.level) {
      if (frame.offset + toI64(frame.dataLength) > space.cryptoInDelivered) {
        this.fail(QUIC_ERROR_CRYPTO + QUIC_CONN_ALERT_UNEXPECTED, toI64(QUIC_FRAME_CRYPTO))
      }
      return
    }
    if (space.level > reassembly.level) {
      this.spaceAt(reassembly.level).cryptoInDelivered = reassembly.delivered
      reassembly.reset(space.level)
    }
    // RFC 9002 §6.2.3: an Initial with CRYPTO data the server already read
    // says the client did not get the server's Initial flight.
    if (space.level === TLS_LEVEL_INITIAL && frame.offset < reassembly.delivered) {
      this.resendLevel = TLS_LEVEL_INITIAL
    }
    if (!reassembly.insert(frame.offset, payload, frame.dataStart, frame.dataLength)) {
      this.fail(QUIC_ERROR_CRYPTO_BUFFER_EXCEEDED, toI64(QUIC_FRAME_CRYPTO))
      return
    }
    this.cryptoArrived = true
  }

  /** Hands TLS what now continues the CRYPTO stream, from the buffer itself; an alert closes with CRYPTO_ERROR. */
  feedTls(): void {
    const tls: TlsServer | null = this.tls
    const reassembly: QuicConnReassembly = this.cryptoIn
    if (tls === null) {
      return
    }
    // A run stops at the buffer's end, so a stream that wraps is two runs.
    for (let pass: i32 = 0; pass < 2; pass += 1) {
      const n: i32 = reassembly.run()
      if (n === 0) {
        return
      }
      const alert: i32 = tls.receive(
        reassembly.level,
        reassembly.ring,
        reassembly.slot(reassembly.delivered),
        n
      )
      reassembly.consume(n)
      if (alert !== 0) {
        this.fail(QUIC_ERROR_CRYPTO + toI64(alert), toI64(QUIC_FRAME_CRYPTO))
        return
      }
    }
  }

  /**
   * A DATAGRAM frame (RFC 9221 §4), which starts at `payload[frameStart]`:
   * one the server did not offer to take, or larger than it offered, is a
   * PROTOCOL_VIOLATION (§3); otherwise its payload waits for
   * `readDatagram`, or is dropped when the ring is full.
   */
  receiveDatagram(frame: QuicFrame, payload: u8[], frameStart: i32): void {
    const size: i64 = toI64(frame.end - frameStart)
    if (this.config.maxDatagramFrameSize === 0 || size > this.config.maxDatagramFrameSize) {
      // `fin` is how the frame says it was 0x31, the type with a Length.
      this.fail(
        QUIC_ERROR_PROTOCOL_VIOLATION,
        toI64(frame.fin ? QUIC_FRAME_DATAGRAM_LENGTH : QUIC_FRAME_DATAGRAM)
      )
      return
    }
    this.datagramsIn.push(payload, frame.dataStart, frame.dataLength)
  }

  /**
   * A PATH_CHALLENGE (§8.2.2): answered with the same eight bytes. Only the
   * latest four are kept, so a burst of challenges cannot grow anything.
   */
  receivePathChallenge(frame: QuicFrame, payload: u8[]): void {
    if (this.pathCount >= 4) {
      this.pathHead = 0
      this.pathCount = 0
    }
    const base: i32 = ((this.pathHead + this.pathCount) % 4) * QUIC_PATH_DATA_SIZE
    for (let k: i32 = 0; k < QUIC_PATH_DATA_SIZE; k += 1) {
      const from: i32 = frame.dataStart + k
      if (
        base + k >= 0 &&
        base + k < toI32(this.pathData.length) &&
        from >= 0 &&
        from < toI32(payload.length)
      ) {
        this.pathData[base + k] = payload[from]
      }
    }
    this.pathCount = this.pathCount + 1
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
      this.initial.appendCrypto(tls.outputInitial, tls.outputInitialLength)
      tls.clearOutput(TLS_LEVEL_INITIAL)
    }
    if (!this.handshake.discarded) {
      this.handshake.appendCrypto(tls.outputHandshake, tls.outputHandshakeLength)
      tls.clearOutput(TLS_LEVEL_HANDSHAKE)
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
      this.handshake.readKeys = this.keysFor(
        this.handshake.keySlot(QUIC_CONN_READ_SLOT),
        aead,
        tls.readSecret(TLS_LEVEL_HANDSHAKE)
      )
      this.handshake.writeKeys = this.keysFor(
        this.handshake.keySlot(QUIC_CONN_WRITE_SLOT),
        aead,
        tls.writeSecret(TLS_LEVEL_HANDSHAKE)
      )
    }
    if (
      !this.application.discarded &&
      this.application.writeKeys === null &&
      tls.state !== TLS_STATE_WAIT_SIGNATURE
    ) {
      const write: u8[] | null = tls.writeSecret(TLS_LEVEL_APPLICATION)
      const read: u8[] | null = tls.readSecret(TLS_LEVEL_APPLICATION)
      if (write !== null && read !== null) {
        this.application.writeKeys = this.keysFor(
          this.application.keySlot(QUIC_CONN_APP_WRITE_SLOTS + this.appWriteSlot),
          aead,
          write
        )
        this.application.readKeys = this.keysFor(this.application.keySlot(this.appReadSlot), aead, read)
        // The key update secrets start from `TlsServer`'s own arrays, so the
        // first update wipes those too, rather than leaving a copy behind.
        this.appWriteSecret = write
        this.appReadSecret = read
        this.prepareNextReadKeys()
      }
    }
    if (tls.state === TLS_STATE_CONNECTED && !this.handshakeComplete) {
      this.handshakeComplete = true
      this.recovery.handshakeConfirmed = true
      this.handshakeDonePending = true
      this.state = QUIC_STATE_CONNECTED
      this.discard(this.handshake)
      this.topUpConnectionIds()
    }
  }

  /** `quicKeysInto` `slot` of a secret TLS has, or `null` when it has none yet. */
  keysFor(slot: QuicKeysSlot, aead: i32, secret: u8[] | null): QuicKeys | null {
    if (secret === null) {
      return null
    }
    return quicKeysInto(this.kdf, slot, aead, secret)
  }

  /**
   * The client's transport parameters (RFC 9000 §7.3, §7.4, §18.2): they must
   * parse, and must name as `initial_source_connection_id` the SCID its first
   * Initial came from. Missing, that is TRANSPORT_PARAMETER_ERROR; wrong, a
   * PROTOCOL_VIOLATION. Answers whether they hold, closing the connection
   * when they do not. The streams take the client's limits from them, and
   * the datagrams its `max_datagram_frame_size`.
   */
  checkPeerParameters(tls: TlsServer): boolean {
    const p: QuicTransportParameters = quicParseTransportParametersInto(
      this.parsedParameters,
      tls.clientTransportParameters,
      false
    )
    if (p.error !== QUIC_ERROR_NO_ERROR || !p.hasInitialScid) {
      this.fail(QUIC_ERROR_TRANSPORT_PARAMETER, toI64(QUIC_FRAME_CRYPTO))
      return false
    }
    if (
      toI32(p.initialScid.length) !== this.peerScidLength ||
      !timingSafeEqualAt(p.initialScid, 0, this.peerScid, QUIC_CONN_FROM, this.peerScidLength)
    ) {
      this.fail(QUIC_ERROR_PROTOCOL_VIOLATION, toI64(QUIC_FRAME_CRYPTO))
      return false
    }
    this.peerParameters = p
    this.streams.setPeerLimits(
      p.initialMaxData,
      p.initialMaxStreamDataBidiLocal,
      p.initialMaxStreamDataBidiRemote,
      p.initialMaxStreamDataUni,
      p.initialMaxStreamsBidi,
      p.initialMaxStreamsUni
    )
    this.peerMaxDatagramFrame = p.maxDatagramFrameSize
    this.recovery.maxAckDelay = p.maxAckDelay
    return true
  }

  /** Discards a space's keys and CRYPTO state (RFC 9001 §4.9), wiping the keys. */
  discard(space: QuicConnSpace): void {
    if (space.discarded) {
      return
    }
    space.discarded = true
    // RFC 9002 §6.4: the space's packets leave flight, uncounted.
    this.recovery.discardSpace(space.level)
    space.cryptoResendLow = -1
    space.cryptoResendHigh = -1
    space.probes = 0
    quicConnWipeKeys(space.readKeys)
    quicConnWipeKeys(space.writeKeys)
    space.wipeKeySlots()
    space.readKeys = null
    space.writeKeys = null
    space.cryptoOutLength = 0
    space.cryptoOutHead = 0
  }

  /**
   * The HMAC-SHA256 under the connection's seed of the sequence number
   * `sequence`, whose first 8 bytes are the local connection ID of that
   * number, into `cidScratch`: so the IDs are unlinkable to anyone without
   * the seed and need no more entropy. It runs in the connection's HMAC
   * scratch inside an arena block, and wipes the MAC and the scratch.
   */
  deriveConnectionId(sequence: i64): void {
    const mac: HmacSha256Scratch = this.kdf.sha256
    using _scope = arena()
    const counter: u8[] = new Array<u8>(8)
    for (let k: i32 = 0; k < 8 && k < toI32(counter.length); k += 1) {
      counter[k] = toU8(toI32((sequence >> (toI64(7 - k) * 8)) & 255))
    }
    const tag: u8[] = new Array<u8>(32)
    mac.begin(this.cidSeed, QUIC_CONN_FROM, toI32(this.cidSeed.length))
    mac.update(counter, QUIC_CONN_FROM, toI32(counter.length))
    mac.finishInto(tag, QUIC_CONN_FROM)
    for (
      let k: i32 = 0;
      k < QUIC_CONN_CID_LENGTH && k < toI32(tag.length) && k < toI32(this.cidScratch.length);
      k += 1
    ) {
      this.cidScratch[k] = tag[k]
    }
    secureZero(tag)
    mac.wipe()
  }

  /**
   * Issues local connection IDs until the client holds as many as it said it
   * would take (its `active_connection_id_limit`), up to
   * `QUIC_CONN_LOCAL_CIDS` at once and `QUIC_CONN_MAX_ISSUED_CIDS` in all;
   * each goes out in a NEW_CONNECTION_ID frame with the stateless reset
   * token the configuration's static key gives it. Each ID and token is made
   * in the slot's scratch and copied into the table, so issuing keeps
   * nothing (QUIC-3).
   */
  topUpConnectionIds(): void {
    if (!this.handshakeComplete) {
      return
    }
    let want: i64 = this.peerParameters.activeConnectionIdLimit
    if (want > toI64(QUIC_CONN_LOCAL_CIDS)) {
      want = toI64(QUIC_CONN_LOCAL_CIDS)
    }
    while (this.cids.nextLocal < QUIC_CONN_MAX_ISSUED_CIDS && toI64(this.cids.activeLocal()) < want) {
      this.deriveConnectionId(this.cids.nextLocal)
      quicConnResetTokenInto(
        this.kdf.sha256,
        this.config.statelessResetKey,
        this.cidScratch,
        QUIC_CONN_FROM,
        QUIC_CONN_CID_LENGTH,
        this.tokenScratch,
        QUIC_CONN_FROM
      )
      const added: i64 = this.cids.addLocal(this.cidScratch, this.tokenScratch)
      secureZero(this.tokenScratch)
      if (added < 0) {
        return
      }
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
   * `QUIC_CONN_IDLE_FLOOR` and to three probe timeouts; -1 when both are 0,
   * for none. Until the client's transport parameters are read, the server's
   * own alone.
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
    let floor: i64 = this.recovery.probeTimeout() * 3
    if (floor < QUIC_CONN_IDLE_FLOOR) {
      floor = QUIC_CONN_IDLE_FLOOR
    }
    return timeout < floor ? floor : timeout
  }

  /** When the idle timeout passes, or -1 when there is none or the timer has not started. */
  idleDeadline(): i64 {
    const timeout: i64 = this.idleTimeout()
    return timeout >= 0 && this.idleSince >= 0 ? this.idleSince + timeout : -1
  }

  /**
   * When `handleTimer` is next due, in the caller's milliseconds: the idle
   * timeout, loss recovery's timer (a time-threshold loss or the probe
   * timeout), or the end of a key update's probe timeout, whichever comes
   * first. -1 when nothing is timed: before the first packet, once the
   * connection has closed, and with no idle timeout, nothing in flight and
   * no update pending.
   */
  deadline(): i64 {
    if (this.closed() || this.state === QUIC_STATE_WAIT_INITIAL) {
      return -1
    }
    let due: i64 = this.idleDeadline()
    if (this.keyRetainUntil >= 0 && (due < 0 || this.keyRetainUntil < due)) {
      due = this.keyRetainUntil
    }
    const recovery: i64 = this.recovery.deadline(this.amplificationBlocked())
    if (recovery >= 0 && (due < 0 || recovery < due)) {
      due = recovery
    }
    return due
  }

  /**
   * Whether the anti-amplification limit stops the server sending (RFC 9000
   * §8.1): the client's address is not validated and three times what it
   * sent leaves no room for a whole datagram.
   */
  amplificationBlocked(): boolean {
    return !this.addressValidated && this.bytesReceived * 3 - this.bytesSent < toI64(QUIC_CONN_DATAGRAM_SIZE)
  }

  /**
   * Runs whatever is due by `now`, the caller's monotonic time in
   * milliseconds; call it at `deadline()`, or any time. Past the idle timeout
   * the connection closes silently (`QUIC_STATE_TIMED_OUT`, RFC 9000 §10.1):
   * no CONNECTION_CLOSE, every key wiped. Past a key update's probe timeout
   * the previous read keys are wiped and the next generation's derived (RFC
   * 9001 §6.5). Past loss recovery's timer, packets lost by the time
   * threshold have their frames queued again, or a probe timeout queues
   * every space's packets in flight and asks for a probe (RFC 9002 §6.1.2,
   * §6.2.4): `takeDatagram` then sends it. `receive` and `takeDatagram` run
   * it themselves. Time never runs backwards here: an earlier `now` than one
   * already given counts as that one.
   */
  handleTimer(now: i64): void {
    this.runClocks(now)
    this.runRecoveryTimer()
  }

  /** `handleTimer`'s idle timeout and key retention, which `receive` runs before it reads a datagram. */
  runClocks(now: i64): void {
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

  /** Loss recovery's timer, if it is due (RFC 9002 §6.2, A.9). */
  runRecoveryTimer(): void {
    if (this.closed() || this.state === QUIC_STATE_WAIT_INITIAL) {
      return
    }
    const kind: i32 = this.recovery.onTimeout(this.now, this.amplificationBlocked())
    if (kind === QUIC_RECOVERY_TIMEOUT_LOSS) {
      const level: i32 = this.recovery.timeoutSpace
      const sent: QuicSentPackets | null = this.recovery.space(level)
      if (sent !== null) {
        this.packetsLost(this.spaceAt(level), sent)
      }
    } else if (kind === QUIC_RECOVERY_TIMEOUT_PTO) {
      this.probe()
    }
  }

  /**
   * Starts a key update from the server (RFC 9001 §6.1): the write keys move
   * to the next generation and the Key Phase bit of every packet after
   * toggles; the client follows when it reads one. Answers whether it did.
   * It does not while it may not: before the handshake is confirmed, while
   * an update is still in flight (the client has not answered the last one,
   * or answered it less than a probe timeout ago, so the next read keys are
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

  // ---- Streams ------------------------------------------------------------------

  /**
   * The ID of the next stream with something new for the application — the
   * client opened it, it has bytes or its FIN to read, it was reset or
   * stopped, or it has room to write again after a short write — or -1
   * when there is none. Each stream comes up once however much happened;
   * read and write it until it has nothing more to say.
   */
  nextStreamEvent(): i64 {
    return this.streams.nextEvent()
  }

  /**
   * Opens a stream of the server's (RFC 9000 §2.1): bidirectional when
   * `bidirectional`, else unidirectional. Answers its ID, or
   * `QUIC_STREAM_ERR_STATE` when not connected, or `QUIC_STREAM_ERR_LIMIT`
   * when the client's MAX_STREAMS is reached (STREAMS_BLOCKED then goes out)
   * or `localStreams` of the server's are open.
   */
  openStream(bidirectional: boolean): i64 {
    if (this.state !== QUIC_STATE_CONNECTED) {
      return toI64(QUIC_STREAM_ERR_STATE)
    }
    return this.streams.open(bidirectional)
  }

  /**
   * Writes up to `length` bytes of `buf` from `from` to stream `id`, and
   * finishes its sending side when `fin` and every byte fit. Answers how many
   * bytes it took — fewer than `length` when the stream's buffer is full, in
   * which case `nextStreamEvent` names it again once acknowledgements free
   * room — or a `QUIC_STREAM_ERR_*`: not connected, an unknown stream, one
   * only the client sends on, one already finished or reset, or one the
   * client asked to stop (STOP_SENDING, which this side answered with
   * RESET_STREAM).
   */
  streamWrite(id: i64, buf: u8[], from: i32, length: i32, fin: boolean): i32 {
    if (this.state !== QUIC_STATE_CONNECTED) {
      return QUIC_STREAM_ERR_STATE
    }
    return this.streams.write(id, buf, from, length, fin)
  }

  /**
   * Reads up to `length` bytes of stream `id` into `buf` from `at`. Answers
   * how many it read, 0 when nothing more has arrived yet, `QUIC_STREAM_END`
   * once every byte up to the FIN was read, `QUIC_STREAM_ERR_RESET` once the
   * client reset the stream (its code is the stream's `resetCode`), or
   * another `QUIC_STREAM_ERR_*`. Reading is what gives the client more credit.
   */
  streamRead(id: i64, buf: u8[], at: i32, length: i32): i32 {
    return this.streams.read(id, buf, at, length)
  }

  /** Abandons stream `id`'s sending side with application error `code` (RESET_STREAM). Answers `QUIC_STREAM_OK` or a `QUIC_STREAM_ERR_*`. */
  streamReset(id: i64, code: i64): i32 {
    if (this.state !== QUIC_STATE_CONNECTED) {
      return QUIC_STREAM_ERR_STATE
    }
    return this.streams.resetStream(id, code)
  }

  /** Asks the client to stop sending on stream `id`, with application error `code` (STOP_SENDING). Answers `QUIC_STREAM_OK` or a `QUIC_STREAM_ERR_*`. */
  streamStopSending(id: i64, code: i64): i32 {
    if (this.state !== QUIC_STATE_CONNECTED) {
      return QUIC_STREAM_ERR_STATE
    }
    return this.streams.stopSending(id, code)
  }

  /**
   * The next run of stream data the client sent, or `null` when there is
   * none: the all-at-once form of `nextStreamEvent` and `streamRead`, which
   * allocates the run it answers. `fin` marks the last of its stream; a
   * stream the client reset is passed over.
   */
  readStream(): QuicStreamData | null {
    let id: i64 = this.streams.nextEvent()
    while (id >= 0) {
      const stream: QuicStream | null = this.streams.find(id)
      const available: i64 = stream !== null ? stream.readable() : 0
      const data: u8[] = new Array<u8>(toI32(available))
      const n: i32 = this.streams.read(id, data, QUIC_CONN_FROM, toI32(available))
      // Every byte up to the FIN read: one more read sees the end, which lets the side finish.
      const end: boolean =
        n === QUIC_STREAM_END ||
        (n > 0 && this.streams.read(id, data, QUIC_CONN_FROM, QUIC_CONN_FROM) === QUIC_STREAM_END)
      if (n > 0 || end) {
        return new QuicStreamData(id, data, end)
      }
      // A reset stream answered QUIC_STREAM_ERR_RESET, which saw it and let
      // it finish; there is nothing to hand over.
      id = this.streams.nextEvent()
    }
    return null
  }

  /**
   * Queues all of `data` on stream `id`, finishing its sending side when
   * `fin`: the all-or-nothing form of `streamWrite`. Answers
   * `QUIC_STREAM_OK`, or `QUIC_STREAM_ERR_*`: the connection is not
   * connected, the stream is unknown, its side is already finished (or the
   * client stopped it), or the data would pass the credit the client gave
   * for the stream or the connection, or the room in the stream's buffer.
   */
  writeStream(id: i64, data: u8[], fin: boolean): i32 {
    if (this.state !== QUIC_STATE_CONNECTED) {
      return QUIC_STREAM_ERR_STATE
    }
    const stream: QuicStream | null = this.streams.find(id)
    if (stream === null) {
      return QUIC_STREAM_ERR_UNKNOWN
    }
    if (stream.finQueued || stream.stopCode >= 0 || stream.sendState >= QUIC_SEND_RESET_SENT) {
      return QUIC_STREAM_ERR_FINISHED
    }
    const length: i64 = toI64(toI32(data.length))
    if (
      stream.sendEnd + length > stream.sendLimit ||
      this.streams.writtenTotal + length > this.streams.sendMaxData ||
      length > stream.room()
    ) {
      return QUIC_STREAM_ERR_FLOW
    }
    const n: i32 = this.streams.write(id, data, QUIC_CONN_FROM, toI32(data.length), fin)
    return n < 0 ? n : QUIC_STREAM_OK
  }

  // ---- Datagrams ----------------------------------------------------------------

  /**
   * The largest DATAGRAM payload `sendDatagram` takes now: what fits the
   * client's `max_datagram_frame_size` with the frame's type and Length, and
   * a 1-RTT packet of `QUIC_CONN_DATAGRAM_SIZE` with the longest packet
   * number; 0 when the client takes none, or the server sends none.
   */
  maxDatagramPayload(): i32 {
    const entry: QuicCidEntry | null = this.cids.currentPeerEntry()
    const cid: i32 = entry !== null ? entry.length : QUIC_CONN_FROM
    let limit: i64 = toI64(QUIC_CONN_DATAGRAM_SIZE - 1 - cid - 4 - QUIC_AEAD_TAG_SIZE)
    if (this.peerMaxDatagramFrame < limit) {
      limit = this.peerMaxDatagramFrame
    }
    // The frame is its type, a Length of 1, 2 or 4 bytes, and the payload.
    let payload: i64 = limit - 2
    if (payload > 63) {
      payload = limit - 3
    }
    if (payload > 16383) {
      payload = limit - 5
    }
    const entrySize: i64 = toI64(this.datagramsOut.entrySize)
    if (payload > entrySize) {
      payload = entrySize
    }
    return payload > 0 && this.datagramsOut.capacity() > 0 ? toI32(payload) : QUIC_CONN_FROM
  }

  /**
   * Queues `buf[from .. from + length)` as a DATAGRAM (RFC 9221) for the next
   * packet the congestion window allows; it is never sent again if lost.
   * Answers `QUIC_DATAGRAM_OK`, `QUIC_DATAGRAM_ERR_DISABLED` when not
   * connected, the client takes none, or the server takes none and so sends
   * none, `QUIC_DATAGRAM_ERR_TOO_BIG` for a frame past the client's limit or
   * a payload past `maxDatagramPayload()`, or `QUIC_DATAGRAM_ERR_FULL` while
   * the ring holds `QUIC_CONN_DATAGRAM_QUEUE` waiting.
   */
  sendDatagram(buf: u8[], from: i32, length: i32): i32 {
    if (
      this.state !== QUIC_STATE_CONNECTED ||
      this.peerMaxDatagramFrame === 0 ||
      this.datagramsOut.capacity() === 0
    ) {
      return QUIC_DATAGRAM_ERR_DISABLED
    }
    if (
      length < 0 ||
      toI64(quicDatagramSize(length)) > this.peerMaxDatagramFrame ||
      length > this.maxDatagramPayload()
    ) {
      return QUIC_DATAGRAM_ERR_TOO_BIG
    }
    if (this.datagramsOut.count >= this.datagramsOut.capacity()) {
      return QUIC_DATAGRAM_ERR_FULL
    }
    return this.datagramsOut.push(buf, from, length) ? QUIC_DATAGRAM_OK : QUIC_DATAGRAM_ERR_TOO_BIG
  }

  /**
   * Copies the oldest DATAGRAM payload the client sent into `buf` at `at`,
   * at most `cap` bytes, and forgets it. Answers its length,
   * `QUIC_DATAGRAM_NONE` when none is waiting, or `QUIC_DATAGRAM_ERR_ROOM`,
   * keeping it, when it does not fit.
   */
  readDatagram(buf: u8[], at: i32, cap: i32): i32 {
    return this.datagramsIn.pop(buf, at, cap)
  }

  // ---- Sending ------------------------------------------------------------------

  /**
   * The next datagram to send, or `null` when nothing is due: the
   * allocating form of `takeDatagramInto`, which a test or a recording uses.
   */
  takeDatagram(now: i64): u8[] | null {
    const out: u8[] = new Array<u8>(QUIC_CONN_DATAGRAM_SIZE)
    const n: i32 = this.takeDatagramInto(out, QUIC_CONN_FROM, now)
    return n > 0 ? quicConnSlice(out, 0, n) : null
  }

  /**
   * Writes the next datagram to send into `out` at `at`, which needs
   * `QUIC_CONN_DATAGRAM_SIZE` bytes of room, and answers its length, or 0
   * when nothing is due (or the room is not there). Call it until it answers
   * 0 after every `receive`, `sign`, write and `close`. It coalesces an
   * Initial, a Handshake and a 1-RTT packet as each has something to carry,
   * pads a datagram with an ack-eliciting Initial to 1200 bytes (RFC 9000
   * §14.1), and before the client's address is validated sends only while
   * three times what was received allows (§8.1). After a close it writes the
   * CONNECTION_CLOSE once, then nothing. While the handshake waits for a
   * signature it writes nothing, so the server's flight leaves whole. Lost
   * data goes before new data. While the congestion window is full (RFC
   * 9002 §7), or a space's record of packets in flight is, a space sends
   * only an ACK, unless a probe timeout asked it for a probe. `now` is the
   * caller's time in milliseconds: a datagram that elicits an
   * acknowledgement restarts the idle timer when it is the first since the
   * client's last packet (RFC 9000 §10.1), and once the idle timeout has
   * passed nothing goes out. The datagram is built and sealed in place,
   * inside an arena block: nothing it does allocates past the call. This is
   * not paced: a carrier that paces calls `nish/net/quic-listener`'s
   * `quicListenerTakeFlight` instead.
   */
  takeDatagramInto(out: u8[], at: i32, now: i64): i32 {
    this.handleTimer(now)
    if (
      this.state === QUIC_STATE_WAIT_INITIAL ||
      this.state === QUIC_STATE_DRAINING ||
      this.state === QUIC_STATE_TIMED_OUT ||
      at < 0 ||
      at > toI32(out.length) - QUIC_CONN_DATAGRAM_SIZE
    ) {
      return 0
    }
    let n: i32 = 0
    if (this.state === QUIC_STATE_CLOSING) {
      using _scope = arena()
      n = this.takeCloseInto(out, at)
      return n
    }
    const tls: TlsServer | null = this.tls
    if (tls !== null && tls.state === TLS_STATE_WAIT_SIGNATURE) {
      return 0
    }
    // Unvalidated, a datagram goes only when a whole padded one fits the budget.
    if (this.amplificationBlocked()) {
      return 0
    }
    {
      using _scope = arena()
      n = this.buildDatagram(out, at)
    }
    return n
  }

  /**
   * `takeDatagramInto`'s datagram, built and sealed into `out` at `at`: one
   * packet per space with something to carry, each written in place, the
   * last padded when an Initial elicits, then each sealed where it lies.
   * Answers the datagram's length, or 0 when no space had anything.
   */
  buildDatagram(out: u8[], at: i32): i32 {
    let remaining: i32 = QUIC_CONN_DATAGRAM_SIZE
    let position: i32 = at
    let paddedInitial: boolean = false
    let eliciting: boolean = false
    const open: boolean = this.recovery.canSend()
    let last: i32 = -1
    for (let level: i32 = 0; level < 3; level += 1) {
      const space: QuicConnSpace = this.spaceAt(level)
      space.builtStart = -1
      const overhead: i32 = this.overhead(space)
      const sent: QuicSentPackets | null = this.recovery.space(level)
      if (sent === null || overhead === 0 || remaining <= overhead + 8) {
        continue
      }
      if (space.probes > 0 && sent.full()) {
        // A probe has to be recorded: the oldest packet gives up its slot,
        // and what it carried, already queued again by the probe, stays queued.
        const slot: i32 = this.recovery.evictOldest(level)
        if (slot >= 0) {
          this.requeue(space, slot)
        }
      }
      const elicit: boolean = space.probes > 0 || (open && !sent.full())
      const headerLength: i32 = overhead - QUIC_AEAD_TAG_SIZE
      const payloadStart: i32 = position + headerLength
      let payloadEnd: i32 = this.buildPayloadInto(
        space,
        out,
        payloadStart,
        payloadStart + remaining - overhead,
        elicit
      )
      if (payloadEnd <= payloadStart) {
        continue
      }
      // RFC 9001 §5.4.2: the packet number and payload give header
      // protection at least four bytes to sample from.
      const pnLength: i32 = quicPacketNumberLength(space.nextPn, space.largestAcked)
      if (pnLength + payloadEnd - payloadStart < 4) {
        payloadEnd = quicPutPadding(out, payloadEnd, 4 - pnLength - (payloadEnd - payloadStart))
      }
      eliciting = eliciting || space.stagedEliciting
      // RFC 9000 §14.1: a datagram with an ack-eliciting Initial is padded.
      if (level === TLS_LEVEL_INITIAL) {
        paddedInitial = space.stagedEliciting
      }
      space.builtStart = position
      space.builtEnd = payloadEnd
      last = level
      remaining = remaining - (payloadEnd + QUIC_AEAD_TAG_SIZE - position)
      position = payloadEnd + QUIC_AEAD_TAG_SIZE
    }
    if (last < 0) {
      return 0
    }
    if (paddedInitial && remaining > 0) {
      const padded: QuicConnSpace = this.spaceAt(last)
      padded.builtEnd = quicPutPadding(out, padded.builtEnd, remaining)
    }
    if (eliciting && !this.elicitingSent) {
      this.idleSince = this.now
      this.elicitingSent = true
    }
    // A packet that cannot be sealed, which only keys `quicKeys` did not
    // make cause, leaves the datagram unsendable: none of it goes.
    let total: i32 = 0
    let sealed: boolean = true
    for (let level: i32 = 0; level <= last; level += 1) {
      const space: QuicConnSpace = this.spaceAt(level)
      if (space.builtStart >= 0) {
        const n: i32 = this.sealAt(space, out, space.builtStart, space.builtEnd)
        sealed = sealed && n > 0
        total = total + n
      }
    }
    if (!sealed) {
      return 0
    }
    this.bytesSent = this.bytesSent + toI64(total)
    return total
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
      const entry: QuicCidEntry | null = this.cids.currentPeerEntry()
      const cid: i32 = entry !== null ? entry.length : QUIC_CONN_FROM
      return 1 + cid + pnLength + QUIC_AEAD_TAG_SIZE
    }
    // First byte, version, both IDs with their lengths, the Length (two
    // bytes, always) and, for an Initial, the empty token's length.
    const token: i32 = space.level === TLS_LEVEL_INITIAL ? 1 : 0
    return 7 + this.peerScidLength + QUIC_CONN_CID_LENGTH + token + 2 + pnLength + QUIC_AEAD_TAG_SIZE
  }

  /**
   * The frames of one packet of `space`, written into `out[start .. end)`:
   * an ACK when one is due, and, when `elicit` allows frames that elicit an
   * acknowledgement, CRYPTO data (lost bytes first), at the application
   * level HANDSHAKE_DONE, RETIRE_CONNECTION_ID, NEW_CONNECTION_ID,
   * PATH_RESPONSE, the streams' control frames, DATAGRAMs and stream data,
   * and for a probe with nothing else to carry a PING. Answers the offset
   * past the last frame, `start` when nothing is due. What it carries is
   * written to the space's staging row, and `stagedEliciting` says whether
   * anything elicits an acknowledgement.
   */
  buildPayloadInto(space: QuicConnSpace, out: u8[], start: i32, end: i32, elicit: boolean): i32 {
    let at: i32 = start
    space.clearStaged()
    if (space.received.ackPending) {
      // One too large for the room is left out and stays due.
      const next: i32 = space.received.putAck(out, at, end, QUIC_CONN_NONE)
      if (next >= 0) {
        at = next
      }
    }
    if (!elicit) {
      return at
    }
    at = this.buildCrypto(space, out, at, end)
    if (space.level === TLS_LEVEL_APPLICATION) {
      at = this.buildApplication(space, out, at, end)
    }
    if (space.probes > 0 && !space.stagedEliciting && at < end) {
      at = quicPutTypeOnly(out, at, end, QUIC_FRAME_PING)
      space.stagedEliciting = true
    }
    return at
  }

  /**
   * One CRYPTO frame into `out[at .. end)`: the bytes lost first, from the
   * level's kept stream, then those not sent yet. The level's CRYPTO stream
   * is kept whole, so a byte's index in `cryptoOut` is its offset.
   */
  buildCrypto(space: QuicConnSpace, out: u8[], at: i32, end: i32): i32 {
    if (space.cryptoResendLow >= 0) {
      const low: i64 = space.cryptoResendLow
      const want: i32 = toI32(space.cryptoResendHigh - low)
      const left: i32 = end - at - quicCryptoOverhead(low, want)
      const n: i32 = left < want ? left : want
      if (n <= 0) {
        return at
      }
      const next: i32 = quicPutCrypto(out, at, end, low, space.cryptoOut, toI32(low), n)
      if (next < 0) {
        return at
      }
      space.stageCrypto(low, n)
      space.cryptoResendLow = low + toI64(n)
      if (space.cryptoResendLow >= space.cryptoResendHigh) {
        space.cryptoResendLow = -1
        space.cryptoResendHigh = -1
      }
      return next
    }
    const unsent: i32 = space.cryptoUnsent()
    if (unsent <= 0) {
      return at
    }
    const left: i32 = end - at - quicCryptoOverhead(space.cryptoOutOffset, unsent)
    const n: i32 = left < unsent ? left : unsent
    if (n <= 0) {
      return at
    }
    const next: i32 = quicPutCrypto(
      out,
      at,
      end,
      space.cryptoOutOffset,
      space.cryptoOut,
      space.cryptoOutHead,
      n
    )
    if (next < 0) {
      return at
    }
    space.stageCrypto(space.cryptoOutOffset, n)
    space.cryptoOutHead = space.cryptoOutHead + n
    space.cryptoOutOffset = space.cryptoOutOffset + toI64(n)
    return next
  }

  /**
   * The 1-RTT frames beyond ACK, as many as fit in `out[at .. end)` and in
   * the packet's record: `QUIC_CONN_PACKET_CONTROL` control frames and
   * `QUIC_CONN_PACKET_STREAMS` STREAM frames, and every DATAGRAM that fits.
   */
  buildApplication(space: QuicConnSpace, out: u8[], start: i32, end: i32): i32 {
    let at: i32 = start
    if (this.handshakeDonePending && at < end) {
      at = quicPutTypeOnly(out, at, end, QUIC_FRAME_HANDSHAKE_DONE)
      this.handshakeDonePending = false
      space.setFlags(space.staging, QUIC_CONN_SENT_HANDSHAKE_DONE)
      space.stagedEliciting = true
    }
    // RETIRE_CONNECTION_ID is at most 9 bytes, NEW_CONNECTION_ID with an
    // 8-byte ID at most 42, PATH_RESPONSE 9.
    while (
      this.cids.retireCount > 0 &&
      end - at >= 9 &&
      space.controlCount(space.staging) < QUIC_CONN_PACKET_CONTROL
    ) {
      const sequence: i64 = this.cids.takeRetire()
      at = quicPutValue(out, at, end, QUIC_FRAME_RETIRE_CONNECTION_ID, sequence)
      space.stageControl(QUIC_CONN_CONTROL_RETIRE, sequence)
    }
    let entry: QuicCidEntry | null = this.cids.nextUnannounced()
    while (entry !== null && end - at >= 42 && space.controlCount(space.staging) < QUIC_CONN_PACKET_CONTROL) {
      const next: i32 = quicPutNewConnectionId(
        out,
        at,
        end,
        entry.sequence,
        QUIC_CONN_NONE,
        entry.cid,
        entry.length,
        entry.resetToken
      )
      if (next < 0) {
        break
      }
      at = next
      entry.announced = true
      space.stageControl(QUIC_CONN_CONTROL_NEW_CID, entry.sequence)
      entry = this.cids.nextUnannounced()
    }
    while (this.pathCount > 0 && end - at >= 9) {
      const next: i32 = quicPutPathData(
        out,
        at,
        end,
        QUIC_FRAME_PATH_RESPONSE,
        this.pathData,
        (this.pathHead % 4) * QUIC_PATH_DATA_SIZE
      )
      if (next < 0) {
        break
      }
      at = next
      this.pathHead = (this.pathHead + 1) % 4
      this.pathCount = this.pathCount - 1
      // Ack-eliciting, but never sent again (RFC 9000 §13.3).
      space.stagedEliciting = true
    }
    const streams: QuicStreams = this.streams
    while (space.controlCount(space.staging) < QUIC_CONN_PACKET_CONTROL) {
      const next: i32 = streams.putNextControl(out, at, end)
      if (next <= at) {
        break
      }
      at = next
      space.stageControl(streams.lastKind, streams.lastValue)
    }
    // DATAGRAMs ride in any packet the window lets elicit, and are recorded
    // only by size: a lost one is not sent again (RFC 9221 §5.2).
    let datagram: i32 = this.datagramsOut.putFrame(out, at, end)
    while (datagram > at) {
      at = datagram
      space.stagedEliciting = true
      datagram = this.datagramsOut.putFrame(out, at, end)
    }
    streams.beginPacket()
    while (space.streamCount(space.staging) < QUIC_CONN_PACKET_STREAMS) {
      const next: i32 = streams.putNextChunk(out, at, end)
      if (next <= at) {
        break
      }
      at = next
      space.stageChunk(streams.lastId, streams.lastOffset, streams.lastLength, streams.lastFin)
    }
    return at
  }

  /**
   * Seals the packet of `space` whose payload `buildDatagram` wrote from
   * `start` plus its header to `payloadEnd`: the header written in front of
   * it, the payload sealed where it lies, and the packet recorded. Answers
   * the packet's length, or 0 when it could not be sealed, which only keys
   * `quicKeys` did not make cause.
   */
  sealAt(space: QuicConnSpace, out: u8[], start: i32, payloadEnd: i32): i32 {
    const keys: QuicKeys | null = space.writeKeys
    const pn: i64 = space.nextPn
    const pnLength: i32 = quicPacketNumberLength(pn, space.largestAcked)
    const headerLength: i32 = this.overhead(space) - QUIC_AEAD_TAG_SIZE
    const payloadLength: i32 = payloadEnd - start - headerLength
    const entry: QuicCidEntry | null = this.cids.currentPeerEntry()
    const headerEnd: i32 =
      space.level === TLS_LEVEL_APPLICATION
        ? quicPutShortHeader(
            out,
            start,
            entry !== null ? entry.cid : this.none,
            entry !== null ? entry.length : 0,
            false,
            this.writePhase,
            pn,
            pnLength
          )
        : quicPutLongHeader(
            out,
            start,
            space.level === TLS_LEVEL_INITIAL ? QUIC_PACKET_INITIAL : QUIC_PACKET_HANDSHAKE,
            this.peerScid,
            this.peerScidLength,
            this.localScid,
            QUIC_CONN_CID_LENGTH,
            this.none,
            pn,
            pnLength,
            payloadLength
          )
    if (keys === null || headerEnd !== start + headerLength) {
      return 0
    }
    const end: i32 = quicSealInPlace(keys, out, start, headerLength, payloadLength, pn)
    if (end < 0) {
      return 0
    }
    space.nextPn = pn + 1
    this.recordSent(space, pn, end - start)
    return end - start
  }

  /**
   * Hands an ack-eliciting packet just sealed to loss recovery (RFC 9002
   * §A.5), with what it carried copied from the staging row to its slot. A
   * packet that elicits nothing (an ACK, a CONNECTION_CLOSE) is not
   * recorded. `buildDatagram` builds nothing ack-eliciting into a space
   * whose record is full, so recovery does not refuse one; if it ever did,
   * what the packet carried is queued again at once, as though lost.
   */
  recordSent(space: QuicConnSpace, pn: i64, size: i32): void {
    if (!space.stagedEliciting) {
      return
    }
    const slot: i32 = this.recovery.onPacketSent(space.level, pn, size, this.now)
    if (slot >= 0) {
      space.commitStaged(slot)
      if (space.probes > 0) {
        space.probes -= 1
        // §6.2.4: a second probe carries unacknowledged data too. When the
        // first took everything queued, the oldest — what it just carried —
        // goes again.
        if (space.probes > 0 && space.cryptoResendLow < 0) {
          space.resendCrypto(space.cryptoOffset(slot), space.cryptoLength(slot))
        }
      }
    } else {
      this.requeue(space, space.staging)
    }
    space.clearStaged()
  }

  /** An acknowledged packet in row `row`: each stream chunk and stream control frame it carried is settled. */
  untrack(space: QuicConnSpace, row: i32): void {
    const streams: i32 = space.streamCount(row)
    for (let j: i32 = 0; j < streams; j += 1) {
      const at: i32 = row * QUIC_CONN_PACKET_STREAMS + j
      if (
        at >= 0 &&
        at < toI32(space.sentStreamId.length) &&
        at < toI32(space.sentStreamOffset.length) &&
        at < toI32(space.sentStreamLength.length) &&
        at < toI32(space.sentStreamFin.length)
      ) {
        this.streams.chunkAcked(
          space.sentStreamId[at],
          space.sentStreamOffset[at],
          space.sentStreamLength[at],
          toI32(space.sentStreamFin[at]) !== 0
        )
      }
    }
    const control: i32 = space.controlCount(row)
    for (let j: i32 = 0; j < control; j += 1) {
      const at: i32 = row * QUIC_CONN_PACKET_CONTROL + j
      if (at >= 0 && at < toI32(space.sentControlKind.length) && at < toI32(space.sentControlValue.length)) {
        this.streams.controlAcked(toI32(space.sentControlKind[at]), space.sentControlValue[at])
      }
    }
  }

  /**
   * The one CONNECTION_CLOSE this side owes, written into `out` at `at`,
   * then nothing (0). It goes in every space the server still has keys for,
   * since the client may not yet have the newest (RFC 9000 §10.2.3); in an
   * Initial or Handshake packet an application's close is sent as the
   * transport close APPLICATION_ERROR, since those packets may not carry
   * 0x1d (§12.4). Before the handshake is complete no 1-RTT packet carries
   * it, because the client cannot yet read one.
   */
  takeCloseInto(out: u8[], at: i32): i32 {
    if (this.closeSent) {
      return 0
    }
    this.closeSent = true
    let position: i32 = at
    const limit: i32 = at + QUIC_CONN_DATAGRAM_SIZE
    for (let level: i32 = 0; level < 3; level += 1) {
      const space: QuicConnSpace = this.spaceAt(level)
      const overhead: i32 = this.overhead(space)
      if (overhead === 0 || (level === TLS_LEVEL_APPLICATION && !this.handshakeComplete)) {
        continue
      }
      space.clearStaged()
      const payloadStart: i32 = position + overhead - QUIC_AEAD_TAG_SIZE
      const room: i32 = limit - QUIC_AEAD_TAG_SIZE
      let payloadEnd: i32 =
        level === TLS_LEVEL_APPLICATION || !this.errorIsApplication
          ? quicPutConnectionClose(
              out,
              payloadStart,
              room,
              this.errorIsApplication,
              this.error,
              this.errorFrameType,
              this.none
            )
          : quicPutConnectionClose(
              out,
              payloadStart,
              room,
              false,
              QUIC_ERROR_APPLICATION,
              QUIC_CONN_NONE,
              this.none
            )
      if (payloadEnd < 0) {
        continue
      }
      const pnLength: i32 = quicPacketNumberLength(space.nextPn, space.largestAcked)
      if (pnLength + payloadEnd - payloadStart < 4) {
        payloadEnd = quicPutPadding(out, payloadEnd, 4 - pnLength - (payloadEnd - payloadStart))
      }
      position = position + this.sealAt(space, out, position, payloadEnd)
    }
    this.bytesSent = this.bytesSent + toI64(position - at)
    return position - at
  }

  /**
   * Wipes everything secret the connection and its `TlsServer` still hold:
   * every level's packet keys, the next generation's read keys, the traffic
   * secrets and expected client Finished, the ephemeral key, the
   * connection-ID seed and the stateless reset tokens (QUIC-2). Call it when
   * the connection is done with (or `reset` the slot, which does the same
   * first); the connection is closed after it and sends nothing more.
   */
  release(): void {
    this.wipeAll()
    if (!this.closed()) {
      this.state = QUIC_STATE_CLOSING
      this.error = QUIC_ERROR_NO_ERROR
    }
    this.closeSent = true
  }

  /**
   * Wipes every key and secret the connection holds and discards every
   * level: `release()`'s work, the idle timeout's and `reset`'s. That takes
   * in both sides' stateless reset tokens and `TlsServer`'s expected client
   * Finished.
   */
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
    for (const secret of this.writeSecrets) {
      secureZero(secret)
    }
    for (const secret of this.readSecrets) {
      secureZero(secret)
    }
    secureZero(this.initialClient)
    secureZero(this.initialServer)
    secureZero(this.cidSeed)
    secureZero(this.ephemeralPrivate)
    // The stateless reset tokens of both sides' IDs: either one ends the
    // connection for whoever learns it (RFC 9000 §10.3).
    for (const entry of this.cids.local) {
      secureZero(entry.resetToken)
    }
    for (const entry of this.cids.peer) {
      secureZero(entry.resetToken)
    }
    secureZero(this.peerParameters.statelessResetToken)
    secureZero(this.localParameters.statelessResetToken)
    const tls: TlsServer | null = this.tls
    if (tls !== null) {
      // The server's encoded transport parameters carry its first ID's token.
      secureZero(tls.config.quicTransportParameters)
      secureZero(tls.expectedClientFinished)
      secureZero(tls.handshakeSecret)
      secureZero(tls.clientHandshakeSecret)
      secureZero(tls.serverHandshakeSecret)
      secureZero(tls.clientApplicationSecret)
      secureZero(tls.serverApplicationSecret)
      secureZero(tls.exporterSecret)
    }
  }
}
