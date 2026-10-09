/**
 * `nish/net/quic-conn-params` — QUIC's transport parameters (RFC 9000 §18),
 * the bytes each endpoint carries in TLS's `quic_transport_parameters`
 * extension (RFC 9001 §8.2), encoded and parsed.
 *
 *     import { QuicTransportParameters, quicEncodeTransportParameters,
 *              quicParseTransportParameters } from "nish/net/quic-conn-params";
 *
 *     const mine = new QuicTransportParameters();
 *     mine.initialMaxData = 65536;
 *     const bytes: u8[] = quicEncodeTransportParameters(mine);   // for TlsServerConfig
 *     const theirs = quicParseTransportParameters(clientBytes, false);
 *     if (theirs.error !== 0) { … close with theirs.error … }
 *
 * A `QuicTransportParameters` starts at every parameter's default (§18.2),
 * so a parse leaves a parameter the peer did not send at the value the RFC
 * says it then has. The encoder writes a parameter only when it differs from
 * that default, plus the connection IDs, which have none.
 *
 * **What a parse refuses**, each a TRANSPORT_PARAMETER_ERROR (§7.4, §18.2):
 * an ID or a length that does not fit, a parameter running past the bytes, a
 * known parameter sent twice, a varint-valued parameter whose value is not
 * exactly one varint, `disable_active_migration` with a value, a server-only
 * parameter from a client (`original_destination_connection_id`,
 * `preferred_address`, `retry_source_connection_id`,
 * `stateless_reset_token`), a stateless reset token that is not 16 bytes, a
 * connection ID over 20 bytes, `max_udp_payload_size` below 1200,
 * `ack_delay_exponent` above 20, `max_ack_delay` at 2^14 or above,
 * `active_connection_id_limit` below 2, and a stream count above 2^60.
 * Unknown parameters, the reserved ones (31 × N + 27) among them, are
 * skipped, as §18.1 asks; a second copy of an unknown one is not noticed.
 * Whether `initial_source_connection_id` is present and right is the
 * connection's check, because it needs the packet the ID came in.
 *
 * Written from RFC 9000 §18, in this module's own structure; nothing here is
 * ported from another implementation. Private names carry the
 * `quicParams` prefix (`docs/wp26-stdlib.md` §3e).
 */
import {
  QUIC_MAX_CID_LENGTH,
  quicVarintLength,
  quicVarintPush,
  quicVarintRead,
  quicVarintSize,
} from "nish/net/quic-packet"
import {
  QUIC_ERROR_NO_ERROR,
  QUIC_ERROR_TRANSPORT_PARAMETER,
  QUIC_RESET_TOKEN_SIZE,
} from "nish/net/quic-frame"

// ---- Parameter IDs (RFC 9000 §18.2) ---------------------------------------------

export const QUIC_TP_ORIGINAL_DCID: i32 = 0x00
export const QUIC_TP_MAX_IDLE_TIMEOUT: i32 = 0x01
export const QUIC_TP_STATELESS_RESET_TOKEN: i32 = 0x02
export const QUIC_TP_MAX_UDP_PAYLOAD_SIZE: i32 = 0x03
export const QUIC_TP_INITIAL_MAX_DATA: i32 = 0x04
export const QUIC_TP_INITIAL_MAX_STREAM_DATA_BIDI_LOCAL: i32 = 0x05
export const QUIC_TP_INITIAL_MAX_STREAM_DATA_BIDI_REMOTE: i32 = 0x06
export const QUIC_TP_INITIAL_MAX_STREAM_DATA_UNI: i32 = 0x07
export const QUIC_TP_INITIAL_MAX_STREAMS_BIDI: i32 = 0x08
export const QUIC_TP_INITIAL_MAX_STREAMS_UNI: i32 = 0x09
export const QUIC_TP_ACK_DELAY_EXPONENT: i32 = 0x0a
export const QUIC_TP_MAX_ACK_DELAY: i32 = 0x0b
export const QUIC_TP_DISABLE_ACTIVE_MIGRATION: i32 = 0x0c
export const QUIC_TP_PREFERRED_ADDRESS: i32 = 0x0d
export const QUIC_TP_ACTIVE_CONNECTION_ID_LIMIT: i32 = 0x0e
export const QUIC_TP_INITIAL_SCID: i32 = 0x0f
export const QUIC_TP_RETRY_SCID: i32 = 0x10
/**
 * `max_datagram_frame_size` (RFC 9221 §3): the largest DATAGRAM frame, type
 * and Length included, the sender takes; absent or 0, it takes none.
 */
export const QUIC_TP_MAX_DATAGRAM_FRAME_SIZE: i32 = 0x20

/** The smallest `max_udp_payload_size` allowed, and every QUIC path's minimum datagram (RFC 9000 §14). */
export const QUIC_MIN_UDP_PAYLOAD: i64 = 1200

/** A stream count's ceiling, 2^60 (§18.2). A product, because an `i64` literal past 2^53 is refused. */
const QUIC_PARAMS_MAX_STREAMS: i64 = 1073741824 * 1073741824

/**
 * One endpoint's transport parameters. Every field starts at the default
 * §18.2 gives it, and the connection IDs and token start empty with their
 * `has*` flag false. `preferredAddress` is kept as the bytes the server sent,
 * since this side never acts on it. `error` is what a parse answers:
 * `QUIC_ERROR_NO_ERROR`, or `QUIC_ERROR_TRANSPORT_PARAMETER` with
 * `errorParameter` the ID of the parameter at fault (-1 when the bytes did not
 * frame).
 */
export class QuicTransportParameters {
  error: i64 = 0
  maxIdleTimeout: i64 = 0
  maxUdpPayloadSize: i64 = 65527
  initialMaxData: i64 = 0
  initialMaxStreamDataBidiLocal: i64 = 0
  initialMaxStreamDataBidiRemote: i64 = 0
  initialMaxStreamDataUni: i64 = 0
  initialMaxStreamsBidi: i64 = 0
  initialMaxStreamsUni: i64 = 0
  ackDelayExponent: i64 = 3
  maxAckDelay: i64 = 25
  activeConnectionIdLimit: i64 = 2
  /** RFC 9221's `max_datagram_frame_size`: 0, the default, for no DATAGRAM frames. */
  maxDatagramFrameSize: i64 = 0
  errorParameter: i64 = 0
  originalDcid: u8[]
  statelessResetToken: u8[]
  preferredAddress: u8[]
  initialScid: u8[]
  retryScid: u8[]
  hasOriginalDcid: boolean = false
  hasStatelessResetToken: boolean = false
  hasPreferredAddress: boolean = false
  hasInitialScid: boolean = false
  hasRetryScid: boolean = false
  disableActiveMigration: boolean = false

  constructor() {
    this.originalDcid = []
    this.statelessResetToken = []
    this.preferredAddress = []
    this.initialScid = []
    this.retryScid = []
  }
}

/** Empties `to`, keeping its room. */
const quicParamsEmpty = (to: u8[]): void => {
  while (to.length > 0) {
    to.pop()
  }
}

/** Sets `p` back to what a new `QuicTransportParameters` holds, keeping its arrays, emptied. */
const quicParamsDefaults = (p: QuicTransportParameters): void => {
  p.error = 0
  p.maxIdleTimeout = 0
  p.maxUdpPayloadSize = 65527
  p.initialMaxData = 0
  p.initialMaxStreamDataBidiLocal = 0
  p.initialMaxStreamDataBidiRemote = 0
  p.initialMaxStreamDataUni = 0
  p.initialMaxStreamsBidi = 0
  p.initialMaxStreamsUni = 0
  p.ackDelayExponent = 3
  p.maxAckDelay = 25
  p.activeConnectionIdLimit = 2
  p.maxDatagramFrameSize = 0
  p.errorParameter = 0
  quicParamsEmpty(p.originalDcid)
  quicParamsEmpty(p.statelessResetToken)
  quicParamsEmpty(p.preferredAddress)
  quicParamsEmpty(p.initialScid)
  quicParamsEmpty(p.retryScid)
  p.hasOriginalDcid = false
  p.hasStatelessResetToken = false
  p.hasPreferredAddress = false
  p.hasInitialScid = false
  p.hasRetryScid = false
  p.disableActiveMigration = false
}

/** Appends one parameter whose value is a varint, when it differs from `fallback`, its default. */
const quicParamsPushVarint = (out: u8[], id: i32, value: i64, fallback: i64): void => {
  if (value === fallback || quicVarintSize(value) === 0) {
    return
  }
  quicVarintPush(out, toI64(id))
  quicVarintPush(out, toI64(quicVarintSize(value)))
  quicVarintPush(out, value)
}

/** Appends one parameter whose value is `bytes`, when `present`. */
const quicParamsPushBytes = (out: u8[], id: i32, bytes: u8[], present: boolean): void => {
  if (!present) {
    return
  }
  quicVarintPush(out, toI64(id))
  quicVarintPush(out, toI64(toI32(bytes.length)))
  for (const b of bytes) {
    out.push(b)
  }
}

/**
 * The transport parameters `p` as the `quic_transport_parameters`
 * extension's body (§18): each parameter as its ID, its length and its
 * value, in ID order, every varint-valued one only when it is not its
 * default, every byte-valued one only when its `has*` flag is set, and
 * `disable_active_migration` only when true. Nothing is checked: these are
 * this endpoint's own values, and a value no varint holds is left out.
 */
export const quicEncodeTransportParameters = (p: QuicTransportParameters): u8[] => {
  const out: u8[] = []
  quicEncodeTransportParametersInto(p, out)
  return out
}

/**
 * `quicEncodeTransportParameters` into `out`, which is emptied first: the
 * encoding is pushed into the room the array already has, so a connection
 * slot that keeps one array for its parameters grows it only when they
 * outgrow every earlier connection's.
 */
export const quicEncodeTransportParametersInto = (p: QuicTransportParameters, out: u8[]): void => {
  quicParamsEmpty(out)
  quicParamsPushBytes(out, QUIC_TP_ORIGINAL_DCID, p.originalDcid, p.hasOriginalDcid)
  quicParamsPushVarint(out, QUIC_TP_MAX_IDLE_TIMEOUT, p.maxIdleTimeout, 0)
  quicParamsPushBytes(out, QUIC_TP_STATELESS_RESET_TOKEN, p.statelessResetToken, p.hasStatelessResetToken)
  quicParamsPushVarint(out, QUIC_TP_MAX_UDP_PAYLOAD_SIZE, p.maxUdpPayloadSize, 65527)
  quicParamsPushVarint(out, QUIC_TP_INITIAL_MAX_DATA, p.initialMaxData, 0)
  quicParamsPushVarint(out, QUIC_TP_INITIAL_MAX_STREAM_DATA_BIDI_LOCAL, p.initialMaxStreamDataBidiLocal, 0)
  quicParamsPushVarint(out, QUIC_TP_INITIAL_MAX_STREAM_DATA_BIDI_REMOTE, p.initialMaxStreamDataBidiRemote, 0)
  quicParamsPushVarint(out, QUIC_TP_INITIAL_MAX_STREAM_DATA_UNI, p.initialMaxStreamDataUni, 0)
  quicParamsPushVarint(out, QUIC_TP_INITIAL_MAX_STREAMS_BIDI, p.initialMaxStreamsBidi, 0)
  quicParamsPushVarint(out, QUIC_TP_INITIAL_MAX_STREAMS_UNI, p.initialMaxStreamsUni, 0)
  quicParamsPushVarint(out, QUIC_TP_ACK_DELAY_EXPONENT, p.ackDelayExponent, 3)
  quicParamsPushVarint(out, QUIC_TP_MAX_ACK_DELAY, p.maxAckDelay, 25)
  const none: u8[] = []
  quicParamsPushBytes(out, QUIC_TP_DISABLE_ACTIVE_MIGRATION, none, p.disableActiveMigration)
  quicParamsPushBytes(out, QUIC_TP_PREFERRED_ADDRESS, p.preferredAddress, p.hasPreferredAddress)
  quicParamsPushVarint(out, QUIC_TP_ACTIVE_CONNECTION_ID_LIMIT, p.activeConnectionIdLimit, 2)
  quicParamsPushBytes(out, QUIC_TP_INITIAL_SCID, p.initialScid, p.hasInitialScid)
  quicParamsPushBytes(out, QUIC_TP_RETRY_SCID, p.retryScid, p.hasRetryScid)
  quicParamsPushVarint(out, QUIC_TP_MAX_DATAGRAM_FRAME_SIZE, p.maxDatagramFrameSize, 0)
}

/**
 * `bytes[from .. from + length)` into `to`, which is emptied first and
 * refilled in the room it has: a parameters object reused for connection
 * after connection keeps its arrays. The caller has checked the window.
 */
const quicParamsCopyInto = (to: u8[], data: u8[], from: i32, length: i32): void => {
  quicParamsEmpty(to)
  for (let k: i32 = 0; k < length; k += 1) {
    if (from + k >= 0 && from + k < toI32(data.length)) {
      to.push(data[from + k])
    }
  }
}

/** Fails `p` over parameter `id` and answers it. */
const quicParamsRefuse = (p: QuicTransportParameters, id: i64): QuicTransportParameters => {
  p.error = QUIC_ERROR_TRANSPORT_PARAMETER
  p.errorParameter = id
  return p
}

/**
 * The value of a varint-valued parameter in `bytes[at .. at + length)`: it
 * must be exactly one varint filling the value. Answers -1, which no varint
 * holds, otherwise.
 */
const quicParamsVarintValue = (bytes: u8[], at: i32, length: i32): i64 => {
  const value: i64 = quicVarintRead(bytes, at, at + length)
  if (value < 0 || quicVarintLength(bytes, at) !== length) {
    return -1
  }
  return value
}

/**
 * Whether the varint-valued parameter `id` may hold `value` (§18.2): the
 * ranges the RFC sets, and any varint for the rest.
 */
const quicParamsValueFits = (id: i32, value: i64): boolean => {
  switch (id) {
    case QUIC_TP_MAX_UDP_PAYLOAD_SIZE:
      return value >= QUIC_MIN_UDP_PAYLOAD
    case QUIC_TP_ACK_DELAY_EXPONENT:
      return value <= 20
    case QUIC_TP_MAX_ACK_DELAY:
      return value < 16384
    case QUIC_TP_ACTIVE_CONNECTION_ID_LIMIT:
      return value >= 2
    case QUIC_TP_INITIAL_MAX_STREAMS_BIDI:
      return value <= QUIC_PARAMS_MAX_STREAMS
    case QUIC_TP_INITIAL_MAX_STREAMS_UNI:
      return value <= QUIC_PARAMS_MAX_STREAMS
    default:
      return true
  }
}

/** Stores the varint-valued parameter `id`; the caller has checked that it is one. */
const quicParamsStoreVarint = (p: QuicTransportParameters, id: i32, value: i64): void => {
  switch (id) {
    case QUIC_TP_MAX_IDLE_TIMEOUT:
      p.maxIdleTimeout = value
      break
    case QUIC_TP_MAX_UDP_PAYLOAD_SIZE:
      p.maxUdpPayloadSize = value
      break
    case QUIC_TP_INITIAL_MAX_DATA:
      p.initialMaxData = value
      break
    case QUIC_TP_INITIAL_MAX_STREAM_DATA_BIDI_LOCAL:
      p.initialMaxStreamDataBidiLocal = value
      break
    case QUIC_TP_INITIAL_MAX_STREAM_DATA_BIDI_REMOTE:
      p.initialMaxStreamDataBidiRemote = value
      break
    case QUIC_TP_INITIAL_MAX_STREAM_DATA_UNI:
      p.initialMaxStreamDataUni = value
      break
    case QUIC_TP_INITIAL_MAX_STREAMS_BIDI:
      p.initialMaxStreamsBidi = value
      break
    case QUIC_TP_INITIAL_MAX_STREAMS_UNI:
      p.initialMaxStreamsUni = value
      break
    case QUIC_TP_ACK_DELAY_EXPONENT:
      p.ackDelayExponent = value
      break
    case QUIC_TP_MAX_ACK_DELAY:
      p.maxAckDelay = value
      break
    default:
      p.activeConnectionIdLimit = value
      break
  }
}

/** Whether `id` is a parameter only a server may send (§18.2). */
const quicParamsServerOnly = (id: i32): boolean =>
  id === QUIC_TP_ORIGINAL_DCID ||
  id === QUIC_TP_STATELESS_RESET_TOKEN ||
  id === QUIC_TP_PREFERRED_ADDRESS ||
  id === QUIC_TP_RETRY_SCID

/**
 * Stores the byte-valued parameter `id` from `bytes[at .. at + length)`.
 * Answers whether its length is one the parameter allows: 16 for the reset
 * token, at most 20 for a connection ID, 0 for `disable_active_migration`.
 */
const quicParamsStoreBytes = (
  p: QuicTransportParameters,
  id: i32,
  bytes: u8[],
  at: i32,
  length: i32
): boolean => {
  // A connection ID or reset token is copied only once its length is one the
  // parameter allows, so a reused object's arrays never grow past it whatever
  // a peer sends. `preferred_address` is server-only and so never read from a
  // client into a server's slot; its length is the server's own.
  const cidFits: boolean = length <= QUIC_MAX_CID_LENGTH
  switch (id) {
    case QUIC_TP_ORIGINAL_DCID:
      quicParamsCopyInto(p.originalDcid, bytes, at, cidFits ? length : 0)
      p.hasOriginalDcid = true
      return cidFits
    case QUIC_TP_STATELESS_RESET_TOKEN:
      quicParamsCopyInto(p.statelessResetToken, bytes, at, length === QUIC_RESET_TOKEN_SIZE ? length : 0)
      p.hasStatelessResetToken = true
      return length === QUIC_RESET_TOKEN_SIZE
    case QUIC_TP_DISABLE_ACTIVE_MIGRATION:
      p.disableActiveMigration = true
      return length === 0
    case QUIC_TP_PREFERRED_ADDRESS:
      quicParamsCopyInto(p.preferredAddress, bytes, at, length)
      p.hasPreferredAddress = true
      return true
    case QUIC_TP_INITIAL_SCID:
      quicParamsCopyInto(p.initialScid, bytes, at, cidFits ? length : 0)
      p.hasInitialScid = true
      return cidFits
    default:
      quicParamsCopyInto(p.retryScid, bytes, at, cidFits ? length : 0)
      p.hasRetryScid = true
      return cidFits
  }
}

/** Whether `id` is one of the parameters whose value is a varint. */
const quicParamsIsVarint = (id: i32): boolean =>
  id === QUIC_TP_MAX_IDLE_TIMEOUT ||
  (id >= QUIC_TP_MAX_UDP_PAYLOAD_SIZE && id <= QUIC_TP_MAX_ACK_DELAY) ||
  id === QUIC_TP_ACTIVE_CONNECTION_ID_LIMIT

/**
 * Parses the body of a `quic_transport_parameters` extension. `fromServer`
 * says who sent it, which decides whether the server-only parameters are
 * allowed. The answer's `error` is `QUIC_ERROR_NO_ERROR`, or
 * `QUIC_ERROR_TRANSPORT_PARAMETER` for any of the breaks the module header
 * lists, with `errorParameter` naming the parameter; on an error the other
 * fields hold what was read so far and are not to be used.
 */
export const quicParseTransportParameters = (bytes: u8[], fromServer: boolean): QuicTransportParameters => {
  const p: QuicTransportParameters = new QuicTransportParameters()
  quicParseTransportParametersInto(p, bytes, fromServer)
  return p
}

/**
 * `quicParseTransportParameters` into `p`, which is set back to every
 * default first, its byte-valued fields emptied and refilled in the room
 * their arrays have: a connection slot parses each client's parameters into
 * one object of its own. Answers `p`.
 */
export const quicParseTransportParametersInto = (
  p: QuicTransportParameters,
  bytes: u8[],
  fromServer: boolean
): QuicTransportParameters => {
  quicParamsDefaults(p)
  const end: i32 = toI32(bytes.length)
  // The known IDs are 0 to 16, so one bit each of an i32 records which were
  // seen; RFC 9221's 0x20 has a flag of its own.
  let seen: i32 = 0
  let seenDatagram: boolean = false
  let at: i32 = 0
  while (at < end) {
    const id: i64 = quicVarintRead(bytes, at, end)
    if (id < 0) {
      return quicParamsRefuse(p, -1)
    }
    at = at + quicVarintLength(bytes, at)
    const length: i64 = quicVarintRead(bytes, at, end)
    if (length < 0) {
      return quicParamsRefuse(p, id)
    }
    at = at + quicVarintLength(bytes, at)
    if (length > toI64(end - at)) {
      return quicParamsRefuse(p, id)
    }
    const valueAt: i32 = at
    const valueLength: i32 = toI32(length)
    at = at + valueLength
    if (id === toI64(QUIC_TP_MAX_DATAGRAM_FRAME_SIZE)) {
      const value: i64 = quicParamsVarintValue(bytes, valueAt, valueLength)
      if (seenDatagram || value < 0) {
        return quicParamsRefuse(p, id)
      }
      seenDatagram = true
      p.maxDatagramFrameSize = value
      continue
    }
    if (id > toI64(QUIC_TP_RETRY_SCID)) {
      continue
    }
    const known: i32 = toI32(id)
    const bit: i32 = 1 << known
    if ((seen & bit) !== 0 || (!fromServer && quicParamsServerOnly(known))) {
      return quicParamsRefuse(p, id)
    }
    seen = seen | bit
    if (quicParamsIsVarint(known)) {
      const value: i64 = quicParamsVarintValue(bytes, valueAt, valueLength)
      if (value < 0 || !quicParamsValueFits(known, value)) {
        return quicParamsRefuse(p, id)
      }
      quicParamsStoreVarint(p, known, value)
    } else if (!quicParamsStoreBytes(p, known, bytes, valueAt, valueLength)) {
      return quicParamsRefuse(p, id)
    }
  }
  p.error = QUIC_ERROR_NO_ERROR
  return p
}
