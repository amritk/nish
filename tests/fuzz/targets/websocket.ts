// The WebSocket frame decoder (`nish/net/websocket`) over a peer's bytes, as a
// libFuzzer target: `fuzzOne` takes one input and keeps nothing past it, and a
// refusal is `WS_ERROR` with a close code, so a panic here is a finding
// (docs/security/http1.md, which covers it).
//
// The first five bytes are settings and the rest is the frame stream:
//
// - byte 0 picks the decoder: bit 0 a server's (`expectMasked`, every frame
//   masked) or a client's (none masked); bits 1 and 2 `maxMessage` (0, 16, 125
//   or 65536), so that the limit is met by small and by extended lengths.
// - bytes 1 to 4 are the sizes of the pieces the stream is cut into, used in
//   turn; a size of 0 takes everything left. Bytes 1 to 4 are also the mask
//   key the round trip below sends with.
//
// After each piece the events are drained the way an endpoint drains them,
// and what the module promises is checked as it goes: a text message is
// UTF-8; a message, re-sent as one frame through `websocketFrame` to a fresh
// decoder of the same kind, comes back as itself; a ping's payload makes a
// pong; and the close code of a `WS_CLOSE` or `WS_ERROR` makes a close payload,
// since the decoder refuses what the encoder would.
import {
  WS_CLOSE,
  WS_CLOSE_NO_STATUS,
  WS_ERROR,
  WS_MESSAGE,
  WS_NEED_MORE,
  WS_OP_BINARY,
  WS_OP_PONG,
  WS_OP_TEXT,
  WS_PING,
  WS_PONG,
  WsDecoder,
  websocketClosePayload,
  websocketFrame,
  websocketIsUtf8,
} from "nish/net/websocket"

/** The `maxMessage` the second and third bits of `config` ask for. */
const pickLimit = (config: i32): i32 => {
  const which: i32 = (config / 2) % 4
  if (which === 0) {
    return 0
  }
  if (which === 1) {
    return 16
  }
  return which === 2 ? 125 : 65536
}

/** `d.data[0 .. d.dataLen)` as an array of its own, read byte by byte. */
const payloadOf = (d: WsDecoder): u8[] => {
  const n: i32 = d.dataLen
  if (n < 0) {
    panic("websocket fuzz: a negative payload length")
  }
  const out: u8[] = new Array<u8>(n)
  const data: u8[] = d.data
  for (let k: i32 = 0; k < n; k += 1) {
    out[k] = data[k]
  }
  return out
}

/**
 * Sends `payload` as one frame to a fresh decoder like `d` and checks that it
 * answers the same message: the encoder and the decoder agree on the framing.
 */
const roundTrip = (d: WsDecoder, opcode: i32, payload: u8[], mask: u8[]): void => {
  const n: i32 = toI32(payload.length)
  const frame: u8[] | null = websocketFrame(true, opcode, payload, 0, n, d.expectMasked ? mask : null)
  if (frame === null) {
    panic("websocket fuzz: the encoder refuses a message the decoder read")
  }
  const again: WsDecoder = new WsDecoder(d.expectMasked, d.maxMessage)
  again.feed(frame, 0, toI32(frame.length))
  if (again.next() !== WS_MESSAGE || again.opcode !== opcode || again.dataLen !== n) {
    panic("websocket fuzz: a re-sent message does not come back")
  }
  for (let k: i32 = 0; k < n; k += 1) {
    if (again.data[k] !== payload[k]) {
      panic("websocket fuzz: a re-sent message comes back changed")
    }
  }
  if (again.next() !== WS_NEED_MORE) {
    panic("websocket fuzz: a re-sent message is followed by an event")
  }
}

/** Answers true once the decoder has stopped for good, after `WS_CLOSE` or `WS_ERROR`. */
const drain = (d: WsDecoder, mask: u8[]): boolean => {
  let e: i32 = d.next()
  while (e !== WS_NEED_MORE) {
    if (e === WS_MESSAGE) {
      const opcode: i32 = d.opcode
      if (opcode !== WS_OP_TEXT && opcode !== WS_OP_BINARY) {
        panic("websocket fuzz: a message that is neither text nor binary")
      }
      const payload: u8[] = payloadOf(d)
      if (opcode === WS_OP_TEXT && !websocketIsUtf8(payload, 0, toI32(payload.length))) {
        panic("websocket fuzz: a text message that is not UTF-8")
      }
      roundTrip(d, opcode, payload, mask)
    } else if (e === WS_PING) {
      const payload: u8[] = payloadOf(d)
      if (websocketFrame(true, WS_OP_PONG, payload, 0, toI32(payload.length), null) === null) {
        panic("websocket fuzz: a ping whose payload makes no pong")
      }
    } else if (e === WS_PONG) {
      payloadOf(d)
    } else if (e === WS_CLOSE) {
      const code: i32 = d.closeCode
      if (code !== WS_CLOSE_NO_STATUS && websocketClosePayload(code, d.closeReason) === null) {
        panic("websocket fuzz: a close the encoder could not echo")
      }
      return true
    } else if (e === WS_ERROR) {
      if (websocketClosePayload(d.closeCode, "") === null) {
        panic("websocket fuzz: a refusal whose close code may not be sent")
      }
      return true
    } else {
      panic("websocket fuzz: an event the module does not define")
    }
    e = d.next()
  }
  return false
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n < 5) {
    return
  }
  const config: i32 = toI32(data[0])
  const d: WsDecoder = new WsDecoder(config % 2 === 1, pickLimit(config))
  const mask: u8[] = [data[1], data[2], data[3], data[4]]
  let at: i32 = 5
  let piece: i32 = 0
  while (at < n) {
    const size: i32 = toI32(data[1 + (piece % 4)])
    piece += 1
    const take: i32 = size === 0 || size > n - at ? n - at : size
    d.feed(data, at, take)
    at += take
    if (drain(d, mask)) {
      return
    }
  }
}
