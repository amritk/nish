// The QUIC frame parser (`nish/net/quic-frame`) over a peer's bytes, as a
// libFuzzer target: `fuzzOne` takes one input and keeps nothing past it, and a
// refusal is a transport error code, so a panic here is a finding
// (docs/security/quic.md).
//
// The whole input is one decrypted packet payload, read as a connection reads
// it: one `QuicFrame` reused for every frame, parsed at 0 and then at each
// frame's `end`, until a frame is refused, makes no progress, or the payload
// is used up. A frame that parses is held to its documented shape — every
// window it points at lies inside what it consumed, its ACK ranges fit the
// frame's array — and a frame that breaks it panics, so the contract is
// checked rather than only the absence of a bounds failure.
import {
  QUIC_FRAME_ACK,
  QUIC_FRAME_ACK_ECN,
  QUIC_FRAME_MAX_ACK_RANGES,
  QuicFrame,
  quicFrameAckEliciting,
  quicFrameAllowed,
  quicParseFrame,
} from "nish/net/quic-frame"
import { QUIC_PACKET_SHORT } from "nish/net/quic-packet"

/** Panics unless the window `[start, start + length)` lies inside `[from, end)`. */
const checkWindow = (start: i32, length: i32, from: i32, end: i32, what: string): void => {
  if (length < 0 || (length > 0 && (start < from || start + length > end))) {
    panic(what)
  }
}

/**
 * Checks a frame that parsed from `at`: it consumed something, stayed inside
 * the payload, and every window and ACK range it reports sits inside it.
 */
const checkFrame = (frame: QuicFrame, at: i32, end: i32): void => {
  if (frame.end <= at || frame.end > end) {
    panic("the frame's end is outside the payload")
  }
  checkWindow(frame.dataStart, frame.dataLength, at, frame.end, "the data window is outside the frame")
  checkWindow(frame.connectionIdStart, frame.connectionIdLength, at, frame.end, "the connection ID is outside the frame")
  if (frame.type === QUIC_FRAME_ACK || frame.type === QUIC_FRAME_ACK_ECN) {
    if (frame.ackRangeCount < 1 || frame.ackRangeCount > QUIC_FRAME_MAX_ACK_RANGES) {
      panic("the ACK range count is outside the frame's array")
    }
    // Each range is [smallest, largest] at or below the frame's largest, and
    // never below packet number zero.
    for (let k: i32 = 0; k < frame.ackRangeCount; k += 1) {
      const smallest: i64 = frame.ackRanges[k * 2]
      const largest: i64 = frame.ackRanges[k * 2 + 1]
      if (smallest < 0 || smallest > largest || largest > frame.largest) {
        panic("an ACK range is out of order")
      }
    }
  }
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  const frame: QuicFrame = new QuicFrame()
  let at: i32 = 0
  while (at < n) {
    if (quicParseFrame(frame, data, at, n) !== 0) {
      break
    }
    checkFrame(frame, at, n)
    // What a connection asks of every frame next; neither may panic for a
    // type the parser answered.
    quicFrameAllowed(frame.type, QUIC_PACKET_SHORT)
    quicFrameAckEliciting(frame.type)
    if (frame.end <= at) {
      break
    }
    at = frame.end
  }
}
