/**
 * `nish/net/quic-stream` — the streams of one QUIC version 1 connection
 * (RFC 9000 §2-§4): stream IDs and their four types, the sending and
 * receiving state machines, reassembly, flow control per stream and for the
 * connection, and the stream limits. Sans-IO, like the rest of `nish/net`:
 * `nish/net/quic`'s `QuicConnection` hands it every stream frame it reads,
 * asks it for the frames to send, and reports which of them a packet that
 * was acknowledged or lost carried. An application reaches it through the
 * connection's stream calls (`openStream`, `streamWrite`, `streamRead`,
 * `nextStreamEvent` and the rest), not directly.
 *
 * **IDs** (§2.1). The low bit says who opened a stream (0 the client, 1 the
 * server) and the next one whether it carries data both ways (0) or only
 * from its opener (1). This side is a server: it opens IDs 1 and 3 modulo 4,
 * and the client 0 and 2. A frame for a stream of the client's that is past
 * the limit this side advertised is STREAM_LIMIT_ERROR; for one of the
 * server's that it has not opened, STREAM_STATE_ERROR; and a frame that only
 * makes sense on a side the stream does not have (STREAM, RESET_STREAM or
 * STREAM_DATA_BLOCKED on the server's unidirectional stream; MAX_STREAM_DATA
 * or STOP_SENDING on the client's) is STREAM_STATE_ERROR (§19.4-§19.13). A
 * client's stream opens every lower one of its type with it (§3.2).
 *
 * **Fixed slots.** The table is sized once, from the configuration: one slot
 * per stream that may be open at once — as many client-opened bidirectional
 * and unidirectional streams as this side lets the client have, and
 * `localStreams` of its own — each with a receive buffer and a send buffer
 * of `bufferSize` bytes and a bit per byte beside each. A stream lives in
 * its slot from the frame (or `open`) that starts it until both of its
 * sides are done, and then the slot is free for the next. A stream is found
 * by its ID through a hash index, never by a scan. Nothing a peer sends, and
 * nothing the application writes, allocates.
 *
 * **Receiving** (§3.2, §2.2). Data lands in the receive buffer at its offset
 * modulo the buffer's size, in any order and overlapping, with a bit set per
 * byte; what continues the stream from the last byte read is what
 * `read` hands out. The credit this side gives a stream (MAX_STREAM_DATA) is
 * never more than what the buffer can hold past the last byte read, so a
 * byte beyond it is FLOW_CONTROL_ERROR and the buffer cannot overflow; it is
 * raised by a whole buffer once the application has read half of one. The
 * connection's credit (MAX_DATA) is raised the same way, by `windowData`
 * once half of it is read. A FIN or RESET_STREAM fixes the final size, and
 * a frame that disagrees with it, or a size below what already arrived, is
 * FINAL_SIZE_ERROR (§4.5). A reset stream's bytes count as read for the
 * connection's credit.
 *
 * **Sending** (§3.1). The application writes into the send buffer as far as
 * it has room, a chunk at a time: what `write` takes is its back-pressure,
 * and the stream's event fires again once acknowledgements free room. Bytes
 * stay in the buffer until acknowledged: the acknowledged bits move the
 * buffer's start, and a range a lost packet carried is sent again from it.
 * New bytes go out only within both the stream's credit and the
 * connection's; at either limit the stream owes STREAM_DATA_BLOCKED or the
 * connection DATA_BLOCKED, once per limit. A STOP_SENDING from the peer is
 * answered with RESET_STREAM (§3.5), and RESET_STREAM from the application
 * gives up what was not sent; either is sent until acknowledged.
 *
 * **Limits** (§4.6). The client may open as many streams of each type as
 * the configuration allows at once; MAX_STREAMS raises its limit as its
 * streams finish, once half of the configured number have. The server opens
 * streams within the client's limits and its own `localStreams`; past the
 * client's limit it owes STREAMS_BLOCKED.
 *
 * Written from RFC 9000 §2-§4 and §19, in this module's own structure;
 * nothing here is ported from another implementation. Private names carry
 * the `quicStream` prefix (`docs/wp26-stdlib.md` §3e).
 */
import {
  QUIC_ERROR_FINAL_SIZE,
  QUIC_ERROR_FLOW_CONTROL,
  QUIC_ERROR_NO_ERROR,
  QUIC_ERROR_STREAM_LIMIT,
  QUIC_ERROR_STREAM_STATE,
  QUIC_FRAME_DATA_BLOCKED,
  QUIC_FRAME_MAX_DATA,
  QUIC_FRAME_MAX_STREAM_DATA,
  QUIC_FRAME_MAX_STREAMS_BIDI,
  QUIC_FRAME_MAX_STREAMS_UNI,
  QUIC_FRAME_STREAM_DATA_BLOCKED,
  QUIC_FRAME_STREAMS_BLOCKED_BIDI,
  QUIC_FRAME_STREAMS_BLOCKED_UNI,
  quicPutStream,
  quicPutStreamError,
  quicPutStreamValue,
  quicPutValue,
  quicStreamOverhead,
} from "nish/net/quic-frame"

// ---- What the stream calls answer -----------------------------------------------

/** Done: the data was taken, or the frame queued. */
export const QUIC_STREAM_OK: i32 = 0
/** No such stream: never opened, or already finished both ways and gone. */
export const QUIC_STREAM_ERR_UNKNOWN: i32 = -1
/** The stream's sending side is finished: a FIN was written, or the stream was reset. */
export const QUIC_STREAM_ERR_FINISHED: i32 = -2
/** The data would pass the credit the peer gave, or the room in the send buffer (all-or-nothing `writeStream`). */
export const QUIC_STREAM_ERR_FLOW: i32 = -3
/** The connection is not connected. */
export const QUIC_STREAM_ERR_STATE: i32 = -4
/** The stream has no such side: a write to a stream only the peer sends on, or a read of one only this side sends on. */
export const QUIC_STREAM_ERR_DIRECTION: i32 = -5
/** No stream can be opened now: the peer's MAX_STREAMS is reached (STREAMS_BLOCKED is sent), or every local slot is taken. */
export const QUIC_STREAM_ERR_LIMIT: i32 = -6
/** A read past the end: every byte up to the FIN has been read. */
export const QUIC_STREAM_END: i32 = -7
/** The peer reset the stream (RESET_STREAM): `resetCode` holds its error code. */
export const QUIC_STREAM_ERR_RESET: i32 = -8
/** The peer asked this side to stop sending (STOP_SENDING), which reset the stream: `stopCode` holds its code. */
export const QUIC_STREAM_ERR_STOPPED: i32 = -9

// ---- The states of RFC 9000 §3 --------------------------------------------------

/** A sending side with nothing written yet (§3.1 "Ready"). */
export const QUIC_SEND_READY: i32 = 0
/** Data written, not all of it sent with the FIN (§3.1 "Send"). */
export const QUIC_SEND_SEND: i32 = 1
/** Every byte and the FIN sent, not all acknowledged (§3.1 "Data Sent"). */
export const QUIC_SEND_DATA_SENT: i32 = 2
/** Every byte and the FIN acknowledged: the side is done (§3.1 "Data Recvd"). */
export const QUIC_SEND_DATA_RECVD: i32 = 3
/** RESET_STREAM sent, not yet acknowledged (§3.1 "Reset Sent"). */
export const QUIC_SEND_RESET_SENT: i32 = 4
/** RESET_STREAM acknowledged: the side is done (§3.1 "Reset Recvd"). */
export const QUIC_SEND_RESET_RECVD: i32 = 5
/** The stream has no sending side here: a unidirectional stream the peer opened. */
export const QUIC_SEND_NONE: i32 = 6

/** Receiving, the final size not known yet (§3.2 "Recv"). */
export const QUIC_RECV_RECV: i32 = 0
/** The FIN fixed the final size; bytes are still missing (§3.2 "Size Known"). */
export const QUIC_RECV_SIZE_KNOWN: i32 = 1
/** Every byte up to the final size arrived (§3.2 "Data Recvd"). */
export const QUIC_RECV_DATA_RECVD: i32 = 2
/** Every byte was read: the side is done (§3.2 "Data Read"). */
export const QUIC_RECV_DATA_READ: i32 = 3
/** The peer reset the stream (§3.2 "Reset Recvd"). */
export const QUIC_RECV_RESET_RECVD: i32 = 4
/** The application saw the reset: the side is done (§3.2 "Reset Read"). */
export const QUIC_RECV_RESET_READ: i32 = 5
/** The stream has no receiving side here: a unidirectional stream this side opened. */
export const QUIC_RECV_NONE: i32 = 6

// ---- The control frames a packet's record names ---------------------------------

/** MAX_DATA, the connection's credit. */
export const QUIC_STREAM_CONTROL_MAX_DATA: i32 = 3
/** MAX_STREAM_DATA for the stream the record's value names. */
export const QUIC_STREAM_CONTROL_MAX_STREAM_DATA: i32 = 4
/** MAX_STREAMS for bidirectional streams. */
export const QUIC_STREAM_CONTROL_MAX_STREAMS_BIDI: i32 = 5
/** MAX_STREAMS for unidirectional streams. */
export const QUIC_STREAM_CONTROL_MAX_STREAMS_UNI: i32 = 6
/** DATA_BLOCKED. */
export const QUIC_STREAM_CONTROL_DATA_BLOCKED: i32 = 7
/** STREAM_DATA_BLOCKED for the stream the value names. */
export const QUIC_STREAM_CONTROL_STREAM_DATA_BLOCKED: i32 = 8
/** STREAMS_BLOCKED for bidirectional streams. */
export const QUIC_STREAM_CONTROL_STREAMS_BLOCKED_BIDI: i32 = 9
/** STREAMS_BLOCKED for unidirectional streams. */
export const QUIC_STREAM_CONTROL_STREAMS_BLOCKED_UNI: i32 = 10
/** RESET_STREAM for the stream the value names. */
export const QUIC_STREAM_CONTROL_RESET: i32 = 11
/** STOP_SENDING for the stream the value names. */
export const QUIC_STREAM_CONTROL_STOP_SENDING: i32 = 12

/** The ceiling of a stream count, 2^60 (§4.6). A product, because an `i64` literal past 2^53 is refused. */
const QUIC_STREAM_MAX_COUNT: i64 = 1073741824 * 1073741824

/** A typed zero and one, since a bare literal is an `f64` under `--number-mode f64`. */
const QUIC_STREAM_ZERO: i64 = 0
const QUIC_STREAM_ONE: i32 = 1
const QUIC_STREAM_NO_BYTES: i32 = 0

/** Whether `id` is a stream this side, the server, opens: its low bit is 1. */
export const quicStreamIsLocal = (id: i64): boolean => (id & 1) !== 0

/** Whether `id` is a unidirectional stream: its second bit is 1. */
export const quicStreamIsUni = (id: i64): boolean => (id & 2) !== 0

/** Whether bit `k` of `bits` is set; false outside the array. */
export const quicStreamBit = (bits: u8[], k: i32): boolean => {
  const at: i32 = k >> 3
  return at >= 0 && at < toI32(bits.length) && (toI32(bits[at]) & (QUIC_STREAM_ONE << (k & 7))) !== 0
}

/** Sets or clears bit `k` of `bits`. */
export const quicStreamSetBit = (bits: u8[], k: i32, on: boolean): void => {
  const at: i32 = k >> 3
  if (at < 0 || at >= toI32(bits.length)) {
    return
  }
  const mask: i32 = QUIC_STREAM_ONE << (k & 7)
  const old: i32 = toI32(bits[at])
  bits[at] = toU8(on ? old | mask : old & ~mask)
}

/** The smaller of two `i64`s. */
const quicStreamMin = (a: i64, b: i64): i64 => (a < b ? a : b)

/**
 * One stream slot. `id` is -1 while the slot is free. The fields are
 * readable — the states, `resetCode` once the peer reset it, `stopCode` once
 * it asked this side to stop — and written only by `QuicStreams`.
 */
export class QuicStream {
  id: i64 = -1
  /** The receive buffer: byte `o` of the stream at `o % size`, its bit in `recvHave` set while unread. */
  recvBuf: u8[]
  recvHave: u8[]
  /** How far the application has read. */
  recvRead: i64 = 0
  /** Every byte below this has arrived. */
  recvContiguous: i64 = 0
  /** The highest offset any frame reached, which flow control counts. */
  recvHighest: i64 = 0
  /** The final size once a FIN or RESET_STREAM fixed it, or -1. */
  recvFinal: i64 = -1
  /** The credit this side gave: no byte at or past this offset may arrive. */
  recvLimit: i64 = 0
  /** The peer's RESET_STREAM error code, or -1. */
  resetCode: i64 = -1
  /** The STOP_SENDING error code this side asked with, or -1. */
  stopSendingCode: i64 = -1
  /** The send buffer: byte `o` at `o % size`, its bit in `sendAcked` set once acknowledged and not yet released. */
  sendBuf: u8[]
  sendAcked: u8[]
  /** Every byte below this was acknowledged, and its room released. */
  sendBase: i64 = 0
  /** The next byte never sent: the stream's credit and the connection's count up to here. */
  sendNext: i64 = 0
  /** One past the last byte written. */
  sendEnd: i64 = 0
  /** The credit the peer gave: no byte at or past this offset may be sent. */
  sendLimit: i64 = 0
  /** Bytes a lost packet carried, `[resendLow, resendHigh)`, or -1; `resendFin` when the FIN was among them. */
  resendLow: i64 = -1
  resendHigh: i64 = -1
  /** The error code of this side's RESET_STREAM, and its final size. */
  resetSentCode: i64 = 0
  resetFinal: i64 = 0
  /** The peer's STOP_SENDING error code, or -1. */
  stopCode: i64 = -1
  /** The limit the last STREAM_DATA_BLOCKED named, or -1. */
  blockedAt: i64 = -1
  sendState: i32 = 0
  recvState: i32 = 0
  /** Whether the application wrote the FIN, a frame carried it, and the peer acknowledged it. */
  finQueued: boolean = false
  finSent: boolean = false
  finAcked: boolean = false
  resendFin: boolean = false
  /** What this stream owes the peer: MAX_STREAM_DATA, STREAM_DATA_BLOCKED, RESET_STREAM, STOP_SENDING. */
  maxDataOwed: boolean = false
  blockedOwed: boolean = false
  resetOwed: boolean = false
  stopOwed: boolean = false
  /** Whether a write was cut short for room, so freed room is an event. */
  wantsWrite: boolean = false
  /** Whether the slot is in the event ring. */
  queued: boolean = false

  constructor(bufferSize: i32) {
    this.recvBuf = new Array<u8>(bufferSize)
    this.recvHave = new Array<u8>((bufferSize + 7) >> 3)
    this.sendBuf = new Array<u8>(bufferSize)
    this.sendAcked = new Array<u8>((bufferSize + 7) >> 3)
  }

  /** The buffer index of stream offset `offset`. */
  at(offset: i64): i32 {
    const size: i32 = toI32(this.recvBuf.length)
    return size > 0 ? toI32(offset % toI64(size)) : 0
  }

  /** How many bytes can be read now. */
  readable(): i64 {
    return this.recvContiguous - this.recvRead
  }

  /** How many more bytes the send buffer takes. */
  room(): i64 {
    return toI64(toI32(this.sendBuf.length)) - (this.sendEnd - this.sendBase)
  }

  /** Whether the sending side has a frame to go: lost bytes, new bytes, or a FIN not yet sent. */
  wantsToSend(): boolean {
    if (this.sendState === QUIC_SEND_NONE || this.sendState >= QUIC_SEND_DATA_RECVD) {
      return false
    }
    return (
      this.resendLow >= 0 ||
      this.resendFin ||
      this.sendNext < this.sendEnd ||
      (this.finQueued && !this.finSent)
    )
  }

  /** Whether both sides are done, so the slot can be freed (§3.3). */
  finished(): boolean {
    const sendDone: boolean =
      this.sendState === QUIC_SEND_NONE ||
      this.sendState === QUIC_SEND_DATA_RECVD ||
      this.sendState === QUIC_SEND_RESET_RECVD
    const recvDone: boolean =
      this.recvState === QUIC_RECV_NONE ||
      this.recvState === QUIC_RECV_DATA_READ ||
      this.recvState === QUIC_RECV_RESET_READ
    return sendDone && recvDone
  }

  /** Empties the slot for stream `id`, with `recvLimit` and `sendLimit` its first credits; the buffers' bits are cleared. */
  open(id: i64, recvLimit: i64, sendLimit: i64): void {
    this.id = id
    this.recvHave.fill(toU8(0))
    this.sendAcked.fill(toU8(0))
    this.recvRead = 0
    this.recvContiguous = 0
    this.recvHighest = 0
    this.recvFinal = -1
    this.recvLimit = recvLimit
    this.resetCode = -1
    this.stopSendingCode = -1
    this.sendBase = 0
    this.sendNext = 0
    this.sendEnd = 0
    this.sendLimit = sendLimit
    this.resendLow = -1
    this.resendHigh = -1
    this.resetSentCode = 0
    this.resetFinal = 0
    this.stopCode = -1
    this.blockedAt = -1
    // A unidirectional stream has one side (§2.1).
    const uni: boolean = quicStreamIsUni(id)
    const local: boolean = quicStreamIsLocal(id)
    this.sendState = uni && !local ? QUIC_SEND_NONE : QUIC_SEND_READY
    this.recvState = uni && local ? QUIC_RECV_NONE : QUIC_RECV_RECV
    this.finQueued = false
    this.finSent = false
    this.finAcked = false
    this.resendFin = false
    this.maxDataOwed = false
    this.blockedOwed = false
    this.resetOwed = false
    this.stopOwed = false
    this.wantsWrite = false
  }

  /** Merges `[offset, offset + length)` into the range to send again, with the FIN when it was lost too. */
  resend(offset: i64, length: i32, fin: boolean): void {
    if (this.sendState === QUIC_SEND_NONE || this.sendState >= QUIC_SEND_DATA_RECVD) {
      return
    }
    // Bytes below the buffer's start were acknowledged and their room reused.
    const low: i64 = offset < this.sendBase ? this.sendBase : offset
    const high: i64 = offset + toI64(length)
    if (high > low) {
      if (this.resendLow < 0) {
        this.resendLow = low
        this.resendHigh = high
      } else {
        if (low < this.resendLow) {
          this.resendLow = low
        }
        if (high > this.resendHigh) {
          this.resendHigh = high
        }
      }
    }
    // A FIN the peer acknowledged through another copy needs no resend.
    this.resendFin = this.resendFin || (fin && !this.finAcked)
  }
}

/**
 * The streams of one connection: their slots, the index by ID, the limits
 * both ways, the connection's flow control both ways, and the ring of
 * streams with something new for the application (`nextEvent`). The
 * counters are readable for a test or a log.
 */
export class QuicStreams {
  slots: QuicStream[]
  /** Open addressing by ID: `index[h]` is a slot plus one, 0 for empty. */
  index: i32[]
  /** Slots with news for the application, `eventCount` of them from `eventHead`. */
  events: i32[]
  /** The configured limits on the client's streams at once and this side's own. */
  maxBidi: i64 = 0
  maxUni: i64 = 0
  localStreams: i64 = 0
  /** How many of each type the client opened, the limit advertised, and how many of them finished. */
  peerBidiOpened: i64 = 0
  peerUniOpened: i64 = 0
  peerBidiLimit: i64 = 0
  peerUniLimit: i64 = 0
  peerBidiClosed: i64 = 0
  peerUniClosed: i64 = 0
  /** How many of each type this side opened, the client's limits, and how many of this side's are open. */
  localBidiOpened: i64 = 0
  localUniOpened: i64 = 0
  localBidiLimit: i64 = 0
  localUniLimit: i64 = 0
  localOpen: i64 = 0
  /** The peer's credit for each stream type as it opens (its transport parameters). */
  peerBidiLocalCredit: i64 = 0
  peerBidiRemoteCredit: i64 = 0
  peerUniCredit: i64 = 0
  /** The connection's receive credit: what was advertised, its window, what arrived, and what was read. */
  recvMaxData: i64 = 0
  windowData: i64 = 0
  recvTotal: i64 = 0
  recvConsumed: i64 = 0
  /** The connection's send credit from the peer, what was sent against it, and what is written but not sent. */
  sendMaxData: i64 = 0
  sendTotal: i64 = 0
  writtenTotal: i64 = 0
  /** The transport error `locate` answered -2 for. */
  locateError: i64 = 0
  /** The limit the last DATA_BLOCKED named, or -1. */
  dataBlockedAt: i64 = -1
  /** The limit each STREAMS_BLOCKED named, or -1. */
  streamsBlockedBidiAt: i64 = -1
  streamsBlockedUniAt: i64 = -1
  /** What the last `putNextChunk` or `putNextControl` wrote, for the packet's record. */
  lastId: i64 = 0
  lastOffset: i64 = 0
  lastValue: i64 = 0
  /** The bytes of each stream's buffer, each way. */
  bufferSize: i32 = 0
  lastLength: i32 = 0
  lastKind: i32 = 0
  lastFin: boolean = false
  eventHead: i32 = 0
  eventCount: i32 = 0
  /** Where the next packet's search for a stream to send starts, and how many it has looked at. */
  cursor: i32 = 0
  scanned: i32 = 0
  /** Whether some stream may owe a control frame, so `putNextControl` looks at the slots at all. */
  streamOwes: boolean = false
  /** What the connection owes: MAX_DATA, DATA_BLOCKED, MAX_STREAMS and STREAMS_BLOCKED of each type. */
  maxDataOwed: boolean = false
  dataBlockedOwed: boolean = false
  maxStreamsBidiOwed: boolean = false
  maxStreamsUniOwed: boolean = false
  streamsBlockedBidiOwed: boolean = false
  streamsBlockedUniOwed: boolean = false

  /**
   * The table for a connection that lets the client open `maxBidi`
   * bidirectional and `maxUni` unidirectional streams at once and opens
   * `localStreams` of its own, each stream with `bufferSize` bytes each way,
   * and a connection receive window of `windowData` bytes.
   */
  constructor(maxBidi: i64, maxUni: i64, localStreams: i64, bufferSize: i32, windowData: i64) {
    const count: i32 = toI32(maxBidi + maxUni + localStreams)
    this.slots = []
    for (let k: i32 = 0; k < count; k += 1) {
      this.slots.push(new QuicStream(bufferSize))
    }
    let size: i32 = 4
    while (size < count * 2) {
      size = size * 2
    }
    this.index = new Array<i32>(size)
    this.events = new Array<i32>(count > 0 ? count : QUIC_STREAM_ONE)
    this.bufferSize = bufferSize
    this.maxBidi = maxBidi
    this.maxUni = maxUni
    this.localStreams = localStreams
    this.windowData = windowData
    this.reset()
  }

  /** Frees every slot and puts every counter back, for a connection slot reused for another peer. */
  reset(): void {
    for (const stream of this.slots) {
      stream.id = -1
      stream.queued = false
    }
    this.index.fill(0)
    this.eventHead = 0
    this.eventCount = 0
    this.peerBidiOpened = 0
    this.peerUniOpened = 0
    this.peerBidiLimit = this.maxBidi
    this.peerUniLimit = this.maxUni
    this.peerBidiClosed = 0
    this.peerUniClosed = 0
    this.localBidiOpened = 0
    this.localUniOpened = 0
    this.localBidiLimit = 0
    this.localUniLimit = 0
    this.localOpen = 0
    this.peerBidiLocalCredit = 0
    this.peerBidiRemoteCredit = 0
    this.peerUniCredit = 0
    this.recvMaxData = this.windowData
    this.recvTotal = 0
    this.recvConsumed = 0
    this.sendMaxData = 0
    this.sendTotal = 0
    this.writtenTotal = 0
    this.dataBlockedAt = -1
    this.streamsBlockedBidiAt = -1
    this.streamsBlockedUniAt = -1
    this.cursor = 0
    this.scanned = 0
    this.streamOwes = false
    this.maxDataOwed = false
    this.dataBlockedOwed = false
    this.maxStreamsBidiOwed = false
    this.maxStreamsUniOwed = false
    this.streamsBlockedBidiOwed = false
    this.streamsBlockedUniOwed = false
  }

  /**
   * Takes the peer's transport parameters (RFC 9000 §18.2): its limits on
   * the streams this side opens, the credit each kind of stream starts with,
   * and the connection's.
   */
  setPeerLimits(
    maxData: i64,
    bidiLocal: i64,
    bidiRemote: i64,
    uni: i64,
    maxStreamsBidi: i64,
    maxStreamsUni: i64
  ): void {
    this.sendMaxData = maxData
    this.peerBidiLocalCredit = bidiLocal
    this.peerBidiRemoteCredit = bidiRemote
    this.peerUniCredit = uni
    this.localBidiLimit = maxStreamsBidi
    this.localUniLimit = maxStreamsUni
  }

  /** The hash bucket `id` starts its probe at. */
  bucket(id: i64): i32 {
    const mixed: i64 = (id >> 2) ^ (id << 3) ^ (id >> 13)
    return toI32(mixed & toI64(toI32(this.index.length) - 1))
  }

  /** The slot of stream `id`, or -1 when it is not open. */
  slotOf(id: i64): i32 {
    const size: i32 = toI32(this.index.length)
    let h: i32 = this.bucket(id)
    for (let probe: i32 = 0; probe < size; probe += 1) {
      if (h < 0 || h >= size) {
        return -1
      }
      const entry: i32 = this.index[h] - 1
      if (entry < 0) {
        return -1
      }
      if (entry < toI32(this.slots.length) && this.slots[entry].id === id) {
        return entry
      }
      h = (h + 1) & (size - 1)
    }
    return -1
  }

  /** The stream `id`, or `null` when it is not open. */
  find(id: i64): QuicStream | null {
    const k: i32 = this.slotOf(id)
    return k >= 0 && k < toI32(this.slots.length) ? this.slots[k] : null
  }

  /** Puts slot `k` in the index under its stream's ID. */
  indexInsert(k: i32, id: i64): void {
    const size: i32 = toI32(this.index.length)
    let h: i32 = this.bucket(id)
    for (let probe: i32 = 0; probe < size; probe += 1) {
      if (h < 0 || h >= size) {
        return
      }
      if (this.index[h] === 0) {
        this.index[h] = k + 1
        return
      }
      h = (h + 1) & (size - 1)
    }
  }

  /** Takes slot `k`, holding `id`, out of the index, moving later entries of its probe run back so none is lost. */
  indexRemove(k: i32, id: i64): void {
    const size: i32 = toI32(this.index.length)
    const mask: i32 = size - 1
    let h: i32 = this.bucket(id)
    let found: i32 = -1
    for (let probe: i32 = 0; probe < size && h >= 0 && h < size; probe += 1) {
      if (this.index[h] === 0) {
        return
      }
      if (this.index[h] === k + 1) {
        found = h
        break
      }
      h = (h + 1) & mask
    }
    if (found < 0) {
      return
    }
    let hole: i32 = found
    let next: i32 = (found + 1) & mask
    for (
      let probe: i32 = 0;
      probe < size && next >= 0 && next < size && hole >= 0 && hole < size;
      probe += 1
    ) {
      const entry: i32 = this.index[next] - 1
      if (entry < 0) {
        break
      }
      const home: i32 = entry < toI32(this.slots.length) ? this.bucket(this.slots[entry].id) : next
      // The entry may move into the hole when its home is not between the hole and it.
      const distanceNext: i32 = (next - home) & mask
      const distanceHole: i32 = (hole - home) & mask
      if (distanceHole < distanceNext) {
        this.index[hole] = this.index[next]
        hole = next
      }
      next = (next + 1) & mask
    }
    if (hole >= 0 && hole < size) {
      this.index[hole] = 0
    }
  }

  /** Puts slot `k` on the event ring, unless it is there already. */
  queue(k: i32): void {
    const size: i32 = toI32(this.events.length)
    if (k < 0 || k >= toI32(this.slots.length) || this.slots[k].queued || this.eventCount >= size) {
      return
    }
    const at: i32 = (this.eventHead + this.eventCount) % size
    if (at >= 0 && at < size) {
      this.events[at] = k
      this.eventCount = this.eventCount + 1
      this.slots[k].queued = true
    }
  }

  /**
   * The ID of the next stream with something new for the application — a
   * stream the peer opened, bytes or a FIN to read, a reset, a STOP_SENDING,
   * or room to write again after a short write — or -1 when there is none.
   * Each stream comes up once however much happened to it; read and write it
   * until it has nothing more to say.
   */
  nextEvent(): i64 {
    const size: i32 = toI32(this.events.length)
    while (this.eventCount > 0 && size > 0) {
      const at: i32 = this.eventHead
      this.eventHead = (at + 1) % size
      this.eventCount = this.eventCount - 1
      const k: i32 = at >= 0 && at < size ? this.events[at] : -1
      if (k >= 0 && k < toI32(this.slots.length)) {
        const stream: QuicStream = this.slots[k]
        stream.queued = false
        if (stream.id >= 0) {
          return stream.id
        }
      }
    }
    return -1
  }

  /** A free slot, or -1. */
  freeSlot(): i32 {
    for (let k: i32 = 0; k < toI32(this.slots.length); k += 1) {
      if (this.slots[k].id < 0) {
        return k
      }
    }
    return -1
  }

  /** Opens `id` in a free slot with its first credits; answers the slot, or -1 when none is free. */
  openSlot(id: i64): i32 {
    const k: i32 = this.freeSlot()
    if (k < 0 || k >= toI32(this.slots.length)) {
      return -1
    }
    const local: boolean = quicStreamIsLocal(id)
    const uni: boolean = quicStreamIsUni(id)
    const buffer: i64 = toI64(this.bufferSize)
    // This side's credit: a whole buffer, for every stream it receives on,
    // and none on its own unidirectional streams, which it only sends on.
    const recvLimit: i64 = local && uni ? QUIC_STREAM_ZERO : buffer
    let sendLimit: i64 = this.peerBidiLocalCredit
    if (local) {
      sendLimit = uni ? this.peerUniCredit : this.peerBidiRemoteCredit
    }
    this.slots[k].open(id, recvLimit, sendLimit)
    this.indexInsert(k, id)
    return k
  }

  /**
   * Frees slot `k` once both of its stream's sides are done (§3.3). A stream
   * the peer opened counts toward raising its limit: MAX_STREAMS is owed
   * once half the configured number have finished since the last one.
   */
  release(k: i32): void {
    if (k < 0 || k >= toI32(this.slots.length)) {
      return
    }
    const stream: QuicStream = this.slots[k]
    if (stream.id < 0 || !stream.finished()) {
      return
    }
    const id: i64 = stream.id
    this.indexRemove(k, id)
    stream.id = -1
    if (quicStreamIsLocal(id)) {
      this.localOpen = this.localOpen - 1
      return
    }
    if (quicStreamIsUni(id)) {
      this.peerUniClosed = this.peerUniClosed + 1
      if (this.peerUniClosed + this.maxUni - this.peerUniLimit >= (this.maxUni + 1) / 2) {
        this.peerUniLimit = this.peerUniClosed + this.maxUni
        this.maxStreamsUniOwed = true
      }
      return
    }
    this.peerBidiClosed = this.peerBidiClosed + 1
    if (this.peerBidiClosed + this.maxBidi - this.peerBidiLimit >= (this.maxBidi + 1) / 2) {
      this.peerBidiLimit = this.peerBidiClosed + this.maxBidi
      this.maxStreamsBidiOwed = true
    }
  }

  /**
   * The slot a frame for stream `id` refers to (§3.2, §4.6, §19.8): opening
   * it, and every lower stream of its type, when it is the peer's and new.
   * `receiving` says whether the frame is about the stream's receiving half
   * (STREAM, RESET_STREAM, STREAM_DATA_BLOCKED) or its sending half
   * (STOP_SENDING, MAX_STREAM_DATA). Answers the slot; -1 for a stream that
   * finished and is gone, whose frames are ignored; or -2 with `locateError`
   * holding STREAM_LIMIT_ERROR for the peer's stream past the limit, or
   * STREAM_STATE_ERROR for one of this side's that it has not opened or a
   * unidirectional stream without the half the frame is about (§19.4-§19.13).
   */
  locate(id: i64, receiving: boolean): i32 {
    if (quicStreamIsUni(id) && quicStreamIsLocal(id) === receiving) {
      this.locateError = QUIC_ERROR_STREAM_STATE
      return -2
    }
    const sequence: i64 = id >> 2
    const uni: boolean = quicStreamIsUni(id)
    if (quicStreamIsLocal(id)) {
      const opened: i64 = uni ? this.localUniOpened : this.localBidiOpened
      if (sequence >= opened) {
        this.locateError = QUIC_ERROR_STREAM_STATE
        return -2
      }
      return this.slotOf(id)
    }
    const limit: i64 = uni ? this.peerUniLimit : this.peerBidiLimit
    if (sequence >= limit) {
      this.locateError = QUIC_ERROR_STREAM_LIMIT
      return -2
    }
    let opened: i64 = uni ? this.peerUniOpened : this.peerBidiOpened
    if (sequence < opened) {
      return this.slotOf(id)
    }
    // §3.2: a stream opens every lower one of its type with it.
    let found: i32 = -1
    while (opened <= sequence) {
      const next: i64 = (opened << 2) | (id & 3)
      const k: i32 = this.openSlot(next)
      opened = opened + 1
      if (k >= 0) {
        this.queue(k)
        found = k
      }
    }
    if (uni) {
      this.peerUniOpened = opened
    } else {
      this.peerBidiOpened = opened
    }
    return found
  }

  /**
   * Counts the peer's bytes on `stream` up to `end` against the credit this
   * side gave, for the stream and for the connection (§4.1): past either it
   * is FLOW_CONTROL_ERROR. Answers 0 or that.
   */
  creditReceived(stream: QuicStream, end: i64): i64 {
    if (end > stream.recvLimit) {
      return QUIC_ERROR_FLOW_CONTROL
    }
    if (end > stream.recvHighest) {
      this.recvTotal = this.recvTotal + (end - stream.recvHighest)
      stream.recvHighest = end
      if (this.recvTotal > this.recvMaxData) {
        return QUIC_ERROR_FLOW_CONTROL
      }
    }
    return QUIC_ERROR_NO_ERROR
  }

  /**
   * A STREAM frame: `length` bytes of `buf` from `from`, at stream offset
   * `offset`, and the FIN when `fin`. Answers 0, or the transport error that
   * closes the connection: the stream's ID (see `locate`), a stream only this
   * side sends on, the final size, or the credit.
   */
  onStream(id: i64, offset: i64, buf: u8[], from: i32, length: i32, fin: boolean): i64 {
    const k: i32 = this.locate(id, true)
    if (k === -2) {
      return this.locateError
    }
    if (k < 0 || k >= toI32(this.slots.length)) {
      return QUIC_ERROR_NO_ERROR
    }
    const stream: QuicStream = this.slots[k]
    const end: i64 = offset + toI64(length)
    if (stream.recvFinal >= 0 && (end > stream.recvFinal || (fin && end !== stream.recvFinal))) {
      return QUIC_ERROR_FINAL_SIZE
    }
    if (fin && end < stream.recvHighest) {
      return QUIC_ERROR_FINAL_SIZE
    }
    const credit: i64 = this.creditReceived(stream, end)
    if (credit !== QUIC_ERROR_NO_ERROR) {
      return credit
    }
    if (stream.recvState >= QUIC_RECV_DATA_RECVD) {
      // Everything arrived already, or the stream was reset: nothing new.
      return QUIC_ERROR_NO_ERROR
    }
    if (fin) {
      stream.recvFinal = end
      stream.recvState = QUIC_RECV_SIZE_KNOWN
    }
    const before: i64 = stream.recvContiguous
    const size: i32 = toI32(stream.recvBuf.length)
    for (let k2: i32 = 0; k2 < length; k2 += 1) {
      const position: i64 = offset + toI64(k2)
      const src: i32 = from + k2
      if (position >= stream.recvContiguous && src >= 0 && src < toI32(buf.length)) {
        const slot: i32 = stream.at(position)
        if (slot >= 0 && slot < size) {
          stream.recvBuf[slot] = buf[src]
          quicStreamSetBit(stream.recvHave, slot, true)
        }
      }
    }
    while (
      stream.recvContiguous < stream.recvHighest &&
      quicStreamBit(stream.recvHave, stream.at(stream.recvContiguous))
    ) {
      stream.recvContiguous = stream.recvContiguous + 1
    }
    if (stream.recvFinal >= 0 && stream.recvContiguous === stream.recvFinal) {
      stream.recvState = QUIC_RECV_DATA_RECVD
    }
    if (stream.recvContiguous > before || fin) {
      this.queue(k)
    }
    return QUIC_ERROR_NO_ERROR
  }

  /** RESET_STREAM (§19.4): the peer abandons the stream at `finalSize` with `code`. Answers 0 or the transport error. */
  onReset(id: i64, code: i64, finalSize: i64): i64 {
    const k: i32 = this.locate(id, true)
    if (k === -2) {
      return this.locateError
    }
    if (k < 0 || k >= toI32(this.slots.length)) {
      return QUIC_ERROR_NO_ERROR
    }
    const stream: QuicStream = this.slots[k]
    if ((stream.recvFinal >= 0 && stream.recvFinal !== finalSize) || finalSize < stream.recvHighest) {
      return QUIC_ERROR_FINAL_SIZE
    }
    const credit: i64 = this.creditReceived(stream, finalSize)
    if (credit !== QUIC_ERROR_NO_ERROR) {
      return credit
    }
    stream.recvFinal = finalSize
    if (stream.recvState === QUIC_RECV_DATA_READ || stream.recvState >= QUIC_RECV_RESET_RECVD) {
      return QUIC_ERROR_NO_ERROR
    }
    // §4.5: a reset stream's bytes count as consumed for the connection.
    this.consume(finalSize - stream.recvRead)
    stream.recvRead = finalSize
    stream.recvContiguous = finalSize
    stream.recvHave.fill(toU8(0))
    stream.recvState = QUIC_RECV_RESET_RECVD
    stream.resetCode = code
    stream.maxDataOwed = false
    stream.stopOwed = false
    this.queue(k)
    return QUIC_ERROR_NO_ERROR
  }

  /**
   * STOP_SENDING (§19.5): the peer wants no more of the stream, which this
   * side answers with RESET_STREAM carrying the same code (§3.5). Answers 0
   * or the transport error.
   */
  onStopSending(id: i64, code: i64): i64 {
    const k: i32 = this.locate(id, false)
    if (k === -2) {
      return this.locateError
    }
    if (k < 0 || k >= toI32(this.slots.length)) {
      return QUIC_ERROR_NO_ERROR
    }
    const stream: QuicStream = this.slots[k]
    if (stream.stopCode < 0) {
      stream.stopCode = code
      this.resetSlot(k, code)
      this.queue(k)
    }
    return QUIC_ERROR_NO_ERROR
  }

  /** MAX_STREAM_DATA (§19.10): more credit for the stream. Answers 0 or the transport error. */
  onMaxStreamData(id: i64, limit: i64): i64 {
    const k: i32 = this.locate(id, false)
    if (k === -2) {
      return this.locateError
    }
    if (k >= 0 && k < toI32(this.slots.length)) {
      const stream: QuicStream = this.slots[k]
      if (limit > stream.sendLimit) {
        stream.sendLimit = limit
        stream.blockedOwed = false
        if (stream.wantsWrite || stream.sendNext < stream.sendEnd) {
          this.queue(k)
        }
      }
    }
    return QUIC_ERROR_NO_ERROR
  }

  /** STREAM_DATA_BLOCKED (§19.13): only the ID is checked; credit follows reading, not asking. */
  onStreamDataBlocked(id: i64): i64 {
    const k: i32 = this.locate(id, true)
    return k === -2 ? this.locateError : QUIC_ERROR_NO_ERROR
  }

  /** MAX_DATA (§19.9): more credit for the connection. */
  onMaxData(limit: i64): void {
    if (limit > this.sendMaxData) {
      this.sendMaxData = limit
      this.dataBlockedOwed = false
    }
  }

  /** MAX_STREAMS (§19.11): the peer lets this side open more streams of a type. */
  onMaxStreams(uni: boolean, limit: i64): void {
    if (uni && limit > this.localUniLimit) {
      this.localUniLimit = limit
      this.streamsBlockedUniOwed = false
    } else if (!uni && limit > this.localBidiLimit) {
      this.localBidiLimit = limit
      this.streamsBlockedBidiOwed = false
    }
  }

  /** Counts `bytes` read (or abandoned by a reset) toward the connection's credit, raising it once half the window is used. */
  consume(bytes: i64): void {
    this.recvConsumed = this.recvConsumed + bytes
    if (
      this.recvConsumed + this.windowData - this.recvMaxData >= this.windowData / 2 &&
      this.windowData > 0
    ) {
      this.recvMaxData = this.recvConsumed + this.windowData
      this.maxDataOwed = true
    }
  }

  /**
   * Opens a stream of this side's (§2.1): bidirectional when `bidi`, else
   * unidirectional. Answers its ID, or `QUIC_STREAM_ERR_LIMIT` when the
   * peer's limit is reached (STREAMS_BLOCKED is then owed) or every slot for
   * this side's streams is taken.
   */
  open(bidi: boolean): i64 {
    const opened: i64 = bidi ? this.localBidiOpened : this.localUniOpened
    const limit: i64 = bidi ? this.localBidiLimit : this.localUniLimit
    if (opened >= limit) {
      if (bidi && this.streamsBlockedBidiAt !== limit) {
        this.streamsBlockedBidiOwed = true
      } else if (!bidi && this.streamsBlockedUniAt !== limit) {
        this.streamsBlockedUniOwed = true
      }
      return toI64(QUIC_STREAM_ERR_LIMIT)
    }
    if (this.localOpen >= this.localStreams || opened >= QUIC_STREAM_MAX_COUNT) {
      return toI64(QUIC_STREAM_ERR_LIMIT)
    }
    const id: i64 = (opened << 2) | (bidi ? 1 : 3)
    if (this.openSlot(id) < 0) {
      return toI64(QUIC_STREAM_ERR_LIMIT)
    }
    if (bidi) {
      this.localBidiOpened = opened + 1
    } else {
      this.localUniOpened = opened + 1
    }
    this.localOpen = this.localOpen + 1
    return id
  }

  /**
   * Writes up to `length` bytes of `buf` from `from` to stream `id`, and its
   * FIN when `fin` and every byte fit. Answers how many bytes it took — fewer
   * than `length` when the send buffer is full, and the stream's event fires
   * once acknowledgements free room — or a `QUIC_STREAM_ERR_*`.
   */
  write(id: i64, buf: u8[], from: i32, length: i32, fin: boolean): i32 {
    const k: i32 = this.slotOf(id)
    if (
      k < 0 ||
      k >= toI32(this.slots.length) ||
      from < 0 ||
      length < 0 ||
      from > toI32(buf.length) - length
    ) {
      return QUIC_STREAM_ERR_UNKNOWN
    }
    const stream: QuicStream = this.slots[k]
    if (stream.sendState === QUIC_SEND_NONE) {
      return QUIC_STREAM_ERR_DIRECTION
    }
    if (stream.stopCode >= 0) {
      return QUIC_STREAM_ERR_STOPPED
    }
    if (stream.finQueued || stream.sendState >= QUIC_SEND_RESET_SENT) {
      return QUIC_STREAM_ERR_FINISHED
    }
    const room: i64 = stream.room()
    const n: i32 = toI64(length) < room ? length : toI32(room)
    const size: i32 = toI32(stream.sendBuf.length)
    for (let j: i32 = 0; j < n; j += 1) {
      const slot: i32 = stream.at(stream.sendEnd + toI64(j))
      if (slot >= 0 && slot < size && from + j >= 0 && from + j < toI32(buf.length)) {
        stream.sendBuf[slot] = buf[from + j]
      }
    }
    stream.sendEnd = stream.sendEnd + toI64(n)
    this.writtenTotal = this.writtenTotal + toI64(n)
    stream.wantsWrite = n < length
    if (fin && n === length) {
      stream.finQueued = true
    }
    if (n > 0 || stream.finQueued) {
      stream.sendState = QUIC_SEND_SEND
    }
    return n
  }

  /**
   * Reads up to `length` bytes of stream `id` into `buf` from `at`. Answers
   * how many it read; 0 when nothing is there yet; `QUIC_STREAM_END` once
   * every byte up to the FIN was read; `QUIC_STREAM_ERR_RESET` once the peer
   * reset it; or another `QUIC_STREAM_ERR_*`. Reading half a buffer gives the
   * peer more credit. A stream's receiving side is done when a read answers
   * `QUIC_STREAM_END` or `QUIC_STREAM_ERR_RESET`, so read until one does.
   */
  read(id: i64, buf: u8[], at: i32, length: i32): i32 {
    const k: i32 = this.slotOf(id)
    if (k < 0 || k >= toI32(this.slots.length) || at < 0 || length < 0 || at > toI32(buf.length) - length) {
      return QUIC_STREAM_ERR_UNKNOWN
    }
    const stream: QuicStream = this.slots[k]
    if (stream.recvState === QUIC_RECV_NONE) {
      return QUIC_STREAM_ERR_DIRECTION
    }
    if (stream.recvState >= QUIC_RECV_RESET_RECVD) {
      stream.recvState = QUIC_RECV_RESET_READ
      this.release(k)
      return QUIC_STREAM_ERR_RESET
    }
    const available: i64 = stream.readable()
    const n: i32 = toI64(length) < available ? length : toI32(available)
    const size: i32 = toI32(stream.recvBuf.length)
    for (let j: i32 = 0; j < n; j += 1) {
      const slot: i32 = stream.at(stream.recvRead + toI64(j))
      if (slot >= 0 && slot < size && at + j >= 0 && at + j < toI32(buf.length)) {
        buf[at + j] = stream.recvBuf[slot]
        quicStreamSetBit(stream.recvHave, slot, false)
      }
    }
    stream.recvRead = stream.recvRead + toI64(n)
    if (n > 0) {
      this.consume(toI64(n))
    }
    if (
      stream.recvState === QUIC_RECV_RECV &&
      stream.recvRead + toI64(size) - stream.recvLimit >= toI64(size / 2)
    ) {
      stream.recvLimit = stream.recvRead + toI64(size)
      stream.maxDataOwed = true
      this.streamOwes = true
    }
    // The read that finds nothing left past the FIN is the one that answers
    // the end, and only then is the side done: a slot is never freed under a
    // reader that has not seen the end yet.
    if (n === 0 && stream.recvState === QUIC_RECV_DATA_RECVD && stream.recvRead === stream.recvFinal) {
      stream.recvState = QUIC_RECV_DATA_READ
      this.release(k)
      return QUIC_STREAM_END
    }
    return n
  }

  /** Abandons the sending side of slot `k` with `code` (§3.1, §19.4): what was not sent is dropped and RESET_STREAM is owed. */
  resetSlot(k: i32, code: i64): void {
    if (k < 0 || k >= toI32(this.slots.length)) {
      return
    }
    const stream: QuicStream = this.slots[k]
    if (stream.sendState === QUIC_SEND_NONE || stream.sendState >= QUIC_SEND_DATA_RECVD) {
      return
    }
    this.writtenTotal = this.writtenTotal - (stream.sendEnd - stream.sendNext)
    stream.sendEnd = stream.sendNext
    stream.sendState = QUIC_SEND_RESET_SENT
    stream.resetSentCode = code
    stream.resetFinal = stream.sendNext
    stream.resetOwed = true
    this.streamOwes = true
    stream.resendLow = -1
    stream.resendHigh = -1
    stream.resendFin = false
    stream.blockedOwed = false
  }

  /** Resets stream `id`'s sending side with `code`. Answers `QUIC_STREAM_OK` or a `QUIC_STREAM_ERR_*`. */
  resetStream(id: i64, code: i64): i32 {
    const k: i32 = this.slotOf(id)
    if (k < 0 || k >= toI32(this.slots.length)) {
      return QUIC_STREAM_ERR_UNKNOWN
    }
    const stream: QuicStream = this.slots[k]
    if (stream.sendState === QUIC_SEND_NONE) {
      return QUIC_STREAM_ERR_DIRECTION
    }
    if (stream.sendState >= QUIC_SEND_DATA_RECVD) {
      return QUIC_STREAM_ERR_FINISHED
    }
    this.resetSlot(k, code)
    return QUIC_STREAM_OK
  }

  /** Asks the peer to stop sending on stream `id`, with `code` (STOP_SENDING, §3.5). Answers `QUIC_STREAM_OK` or a `QUIC_STREAM_ERR_*`. */
  stopSending(id: i64, code: i64): i32 {
    const k: i32 = this.slotOf(id)
    if (k < 0 || k >= toI32(this.slots.length)) {
      return QUIC_STREAM_ERR_UNKNOWN
    }
    const stream: QuicStream = this.slots[k]
    if (stream.recvState === QUIC_RECV_NONE) {
      return QUIC_STREAM_ERR_DIRECTION
    }
    if (stream.recvState >= QUIC_RECV_DATA_RECVD) {
      return QUIC_STREAM_ERR_FINISHED
    }
    if (stream.stopSendingCode < 0) {
      stream.stopSendingCode = code
      stream.stopOwed = true
      this.streamOwes = true
    }
    return QUIC_STREAM_OK
  }

  /** Starts a packet: the next `putNextChunk` calls look at each stream at most once. */
  beginPacket(): void {
    this.scanned = 0
  }

  /**
   * Writes one STREAM frame into `buf[at .. end)` for the next stream, in
   * turn, that has one to send: its lost bytes first, else as many new ones
   * as fit and both credits allow, with the FIN when the rest fits. Answers
   * the offset past it, with `lastId`, `lastOffset`, `lastLength` and
   * `lastFin` describing it for the packet's record; or `at` when no stream
   * has a frame that fits.
   */
  putNextChunk(buf: u8[], at: i32, end: i32): i32 {
    const count: i32 = toI32(this.slots.length)
    while (this.scanned < count && count > 0) {
      const k: i32 = this.cursor % count
      this.cursor = (k + 1) % count
      this.scanned = this.scanned + 1
      if (k >= 0 && k < count) {
        const stream: QuicStream = this.slots[k]
        if (stream.id >= 0 && stream.wantsToSend()) {
          const next: i32 =
            stream.resendLow >= 0 || stream.resendFin
              ? this.putResend(stream, buf, at, end)
              : this.putNew(stream, k, buf, at, end)
          if (next > at) {
            return next
          }
        }
      }
    }
    return at
  }

  /**
   * One STREAM frame of what `stream` lost: its lost bytes, skipping those
   * acknowledged since, with the FIN only when they run to the final size
   * (§4.5); or, with no bytes left to send again, a lost FIN alone, as a
   * frame of no bytes at the final size.
   */
  putResend(stream: QuicStream, buf: u8[], at: i32, end: i32): i32 {
    if (stream.resendLow >= 0) {
      let low: i64 = stream.resendLow < stream.sendBase ? stream.sendBase : stream.resendLow
      while (low < stream.resendHigh && quicStreamBit(stream.sendAcked, stream.at(low))) {
        low = low + 1
      }
      const want: i32 = toI32(stream.resendHigh - low)
      if (want <= 0) {
        stream.resendLow = -1
        stream.resendHigh = -1
      } else {
        const room: i32 = end - at - quicStreamOverhead(stream.id, low, want)
        if (room <= 0) {
          return at
        }
        const n: i32 = room < want ? room : want
        const fin: boolean = stream.resendFin && n === want && low + toI64(n) === stream.sendEnd
        const next: i32 = quicPutStream(buf, at, end, stream.id, low, stream.sendBuf, stream.at(low), n, fin)
        if (next < 0) {
          return at
        }
        this.noteChunk(stream.id, low, n, fin)
        if (n === want) {
          stream.resendLow = -1
          stream.resendHigh = -1
        } else {
          stream.resendLow = low + toI64(n)
        }
        if (fin) {
          stream.resendFin = false
        }
        return next
      }
    }
    if (!stream.resendFin) {
      return at
    }
    const next: i32 = quicPutStream(
      buf,
      at,
      end,
      stream.id,
      stream.sendEnd,
      stream.sendBuf,
      QUIC_STREAM_NO_BYTES,
      QUIC_STREAM_NO_BYTES,
      true
    )
    if (next < 0) {
      return at
    }
    this.noteChunk(stream.id, stream.sendEnd, QUIC_STREAM_NO_BYTES, true)
    stream.resendFin = false
    return next
  }

  /** Describes the STREAM frame just written, for the packet's record. */
  noteChunk(id: i64, offset: i64, length: i32, fin: boolean): void {
    this.lastId = id
    this.lastOffset = offset
    this.lastLength = length
    this.lastFin = fin
  }

  /**
   * One STREAM frame of `stream`'s new bytes within both credits. A stream
   * held back by a credit owes the matching BLOCKED frame, once per limit.
   */
  putNew(stream: QuicStream, k: i32, buf: u8[], at: i32, end: i32): i32 {
    const unsent: i64 = stream.sendEnd - stream.sendNext
    const streamCredit: i64 = stream.sendLimit - stream.sendNext
    const connectionCredit: i64 = this.sendMaxData - this.sendTotal
    let allowed: i64 = quicStreamMin(unsent, quicStreamMin(streamCredit, connectionCredit))
    if (allowed < 0) {
      allowed = 0
    }
    if (allowed < unsent) {
      if (streamCredit < unsent && stream.blockedAt !== stream.sendLimit) {
        stream.blockedOwed = true
        this.streamOwes = true
      }
      if (connectionCredit < unsent && this.dataBlockedAt !== this.sendMaxData) {
        this.dataBlockedOwed = true
      }
    }
    const want: i32 = toI32(allowed)
    const finNow: boolean = stream.finQueued && !stream.finSent && allowed === unsent
    if (want === 0 && !finNow) {
      return at
    }
    const room: i32 = end - at - quicStreamOverhead(stream.id, stream.sendNext, want)
    if (room < 0 || (room === 0 && want > 0)) {
      return at
    }
    const n: i32 = room < want ? room : want
    const fin: boolean = finNow && n === want
    const next: i32 = quicPutStream(
      buf,
      at,
      end,
      stream.id,
      stream.sendNext,
      stream.sendBuf,
      stream.at(stream.sendNext),
      n,
      fin
    )
    if (next < 0) {
      return at
    }
    this.noteChunk(stream.id, stream.sendNext, n, fin)
    stream.sendNext = stream.sendNext + toI64(n)
    this.sendTotal = this.sendTotal + toI64(n)
    if (fin) {
      stream.finSent = true
      stream.sendState = QUIC_SEND_DATA_SENT
    }
    if (k >= 0 && stream.wantsWrite && stream.room() > 0) {
      this.queue(k)
    }
    return next
  }

  /**
   * Writes the next control frame owed, if it fits in `buf[at .. end)`:
   * MAX_DATA, the MAX_STREAMS and BLOCKED frames, then each stream's
   * MAX_STREAM_DATA, STREAM_DATA_BLOCKED, RESET_STREAM and STOP_SENDING.
   * Answers the offset past it, with `lastKind` (a
   * `QUIC_STREAM_CONTROL_*`) and `lastValue` (the stream it names, or 0)
   * for the packet's record; or `at` when nothing owed fits.
   */
  putNextControl(buf: u8[], at: i32, end: i32): i32 {
    this.lastValue = 0
    if (this.maxDataOwed) {
      const next: i32 = quicPutValue(buf, at, end, QUIC_FRAME_MAX_DATA, this.recvMaxData)
      if (next > at) {
        this.maxDataOwed = false
        this.lastKind = QUIC_STREAM_CONTROL_MAX_DATA
        return next
      }
    }
    if (this.maxStreamsBidiOwed) {
      const next: i32 = quicPutValue(buf, at, end, QUIC_FRAME_MAX_STREAMS_BIDI, this.peerBidiLimit)
      if (next > at) {
        this.maxStreamsBidiOwed = false
        this.lastKind = QUIC_STREAM_CONTROL_MAX_STREAMS_BIDI
        return next
      }
    }
    if (this.maxStreamsUniOwed) {
      const next: i32 = quicPutValue(buf, at, end, QUIC_FRAME_MAX_STREAMS_UNI, this.peerUniLimit)
      if (next > at) {
        this.maxStreamsUniOwed = false
        this.lastKind = QUIC_STREAM_CONTROL_MAX_STREAMS_UNI
        return next
      }
    }
    if (this.dataBlockedOwed) {
      const next: i32 = quicPutValue(buf, at, end, QUIC_FRAME_DATA_BLOCKED, this.sendMaxData)
      if (next > at) {
        this.dataBlockedOwed = false
        this.dataBlockedAt = this.sendMaxData
        this.lastKind = QUIC_STREAM_CONTROL_DATA_BLOCKED
        return next
      }
    }
    if (this.streamsBlockedBidiOwed) {
      const next: i32 = quicPutValue(buf, at, end, QUIC_FRAME_STREAMS_BLOCKED_BIDI, this.localBidiLimit)
      if (next > at) {
        this.streamsBlockedBidiOwed = false
        this.streamsBlockedBidiAt = this.localBidiLimit
        this.lastKind = QUIC_STREAM_CONTROL_STREAMS_BLOCKED_BIDI
        return next
      }
    }
    if (this.streamsBlockedUniOwed) {
      const next: i32 = quicPutValue(buf, at, end, QUIC_FRAME_STREAMS_BLOCKED_UNI, this.localUniLimit)
      if (next > at) {
        this.streamsBlockedUniOwed = false
        this.streamsBlockedUniAt = this.localUniLimit
        this.lastKind = QUIC_STREAM_CONTROL_STREAMS_BLOCKED_UNI
        return next
      }
    }
    if (!this.streamOwes) {
      return at
    }
    let fits: boolean = true
    for (const stream of this.slots) {
      if (
        stream.id >= 0 &&
        (stream.maxDataOwed || stream.blockedOwed || stream.resetOwed || stream.stopOwed)
      ) {
        const next: i32 = this.putStreamControl(stream, buf, at, end)
        if (next > at) {
          this.lastValue = stream.id
          return next
        }
        fits = false
      }
    }
    // Only a look that found nothing owed at all clears the hint; one that
    // found frames too large for the room leaves it for the next packet.
    this.streamOwes = !fits
    return at
  }

  /** The next control frame `stream` owes, if it fits; sets `lastKind`. */
  putStreamControl(stream: QuicStream, buf: u8[], at: i32, end: i32): i32 {
    if (stream.maxDataOwed) {
      const next: i32 = quicPutStreamValue(
        buf,
        at,
        end,
        QUIC_FRAME_MAX_STREAM_DATA,
        stream.id,
        stream.recvLimit
      )
      if (next > at) {
        stream.maxDataOwed = false
        this.lastKind = QUIC_STREAM_CONTROL_MAX_STREAM_DATA
        return next
      }
    }
    if (stream.blockedOwed) {
      const next: i32 = quicPutStreamValue(
        buf,
        at,
        end,
        QUIC_FRAME_STREAM_DATA_BLOCKED,
        stream.id,
        stream.sendLimit
      )
      if (next > at) {
        stream.blockedOwed = false
        stream.blockedAt = stream.sendLimit
        this.lastKind = QUIC_STREAM_CONTROL_STREAM_DATA_BLOCKED
        return next
      }
    }
    if (stream.resetOwed) {
      const next: i32 = quicPutStreamError(buf, at, end, stream.id, stream.resetSentCode, stream.resetFinal)
      if (next > at) {
        stream.resetOwed = false
        this.lastKind = QUIC_STREAM_CONTROL_RESET
        return next
      }
    }
    if (stream.stopOwed) {
      const next: i32 = quicPutStreamError(buf, at, end, stream.id, stream.stopSendingCode, -1)
      if (next > at) {
        stream.stopOwed = false
        this.lastKind = QUIC_STREAM_CONTROL_STOP_SENDING
        return next
      }
    }
    return at
  }

  /**
   * A packet that carried bytes `[offset, offset + length)` of stream `id`,
   * and its FIN when `fin`, was acknowledged: the bytes are marked, the
   * buffer's start moves past every acknowledged one, and once all of them
   * and the FIN are, the sending side is done (§3.1 "Data Recvd").
   */
  chunkAcked(id: i64, offset: i64, length: i32, fin: boolean): void {
    const k: i32 = this.slotOf(id)
    if (k < 0 || k >= toI32(this.slots.length)) {
      return
    }
    const stream: QuicStream = this.slots[k]
    const top: i64 = offset + toI64(length) < stream.sendEnd ? offset + toI64(length) : stream.sendEnd
    for (let o: i64 = offset < stream.sendBase ? stream.sendBase : offset; o < top; o += 1) {
      quicStreamSetBit(stream.sendAcked, stream.at(o), true)
    }
    const before: i64 = stream.sendBase
    while (stream.sendBase < stream.sendNext && quicStreamBit(stream.sendAcked, stream.at(stream.sendBase))) {
      quicStreamSetBit(stream.sendAcked, stream.at(stream.sendBase), false)
      stream.sendBase = stream.sendBase + 1
    }
    if (fin) {
      stream.finAcked = true
    }
    if (stream.sendState === QUIC_SEND_DATA_SENT && stream.finAcked && stream.sendBase === stream.sendEnd) {
      stream.sendState = QUIC_SEND_DATA_RECVD
      this.release(k)
      return
    }
    if (stream.sendBase > before && stream.wantsWrite) {
      this.queue(k)
    }
  }

  /** A packet that carried those bytes was lost: they are queued to go again, unless the side is done or reset. */
  chunkLost(id: i64, offset: i64, length: i32, fin: boolean): void {
    const stream: QuicStream | null = this.find(id)
    if (stream !== null) {
      stream.resend(offset, length, fin)
    }
  }

  /**
   * A packet that carried control frame `kind` (for stream `value`, or 0)
   * was acknowledged: a RESET_STREAM acknowledged ends its sending side
   * (§3.1 "Reset Recvd").
   */
  controlAcked(kind: i32, value: i64): void {
    if (kind !== QUIC_STREAM_CONTROL_RESET) {
      return
    }
    const k: i32 = this.slotOf(value)
    if (k >= 0 && k < toI32(this.slots.length) && this.slots[k].sendState === QUIC_SEND_RESET_SENT) {
      this.slots[k].sendState = QUIC_SEND_RESET_RECVD
      this.release(k)
    }
  }

  /**
   * A packet that carried control frame `kind` was lost: it is owed again
   * with the current value, while it still says something (§13.3) — a
   * BLOCKED frame only while the limit it named still holds.
   */
  controlLost(kind: i32, value: i64): void {
    if (kind === QUIC_STREAM_CONTROL_MAX_DATA) {
      this.maxDataOwed = true
    } else if (kind === QUIC_STREAM_CONTROL_MAX_STREAMS_BIDI) {
      this.maxStreamsBidiOwed = true
    } else if (kind === QUIC_STREAM_CONTROL_MAX_STREAMS_UNI) {
      this.maxStreamsUniOwed = true
    } else if (kind === QUIC_STREAM_CONTROL_DATA_BLOCKED) {
      this.dataBlockedOwed = this.dataBlockedAt === this.sendMaxData && this.sendTotal >= this.sendMaxData
    } else if (kind === QUIC_STREAM_CONTROL_STREAMS_BLOCKED_BIDI) {
      this.streamsBlockedBidiOwed = this.streamsBlockedBidiAt === this.localBidiLimit
    } else if (kind === QUIC_STREAM_CONTROL_STREAMS_BLOCKED_UNI) {
      this.streamsBlockedUniOwed = this.streamsBlockedUniAt === this.localUniLimit
    } else {
      this.streamControlLost(kind, value)
    }
  }

  /** A lost control frame of stream `id`. */
  streamControlLost(kind: i32, id: i64): void {
    const stream: QuicStream | null = this.find(id)
    if (stream === null) {
      return
    }
    this.streamOwes = true
    if (kind === QUIC_STREAM_CONTROL_MAX_STREAM_DATA) {
      stream.maxDataOwed = stream.recvState === QUIC_RECV_RECV
    } else if (kind === QUIC_STREAM_CONTROL_STREAM_DATA_BLOCKED) {
      stream.blockedOwed = stream.blockedAt === stream.sendLimit && stream.sendNext >= stream.sendLimit
    } else if (kind === QUIC_STREAM_CONTROL_RESET) {
      stream.resetOwed = stream.sendState === QUIC_SEND_RESET_SENT
    } else if (kind === QUIC_STREAM_CONTROL_STOP_SENDING) {
      stream.stopOwed = stream.recvState < QUIC_RECV_DATA_RECVD
    }
  }
}
