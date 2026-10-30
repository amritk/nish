/**
 * `nish/net/websocket` — RFC 6455 WebSocket framing and both sides of the
 * opening handshake, sans-IO: bytes in, events and bytes out.
 *
 * **The server's handshake.** `nish/net/http1` reads the client's request;
 * `websocketRequestKey(parser)` answers its `Sec-WebSocket-Key` when the head
 * is a valid opening handshake (§4.2.1), `websocketOfferedProtocols(parser)`
 * the subprotocols it offers, and `websocketUpgradeResponse(key, protocol)`
 * writes the 101 that accepts it, with `Sec-WebSocket-Accept` from
 * `websocketAcceptKey` (§4.2.2): the base64 of the SHA-1 of the key and a
 * fixed GUID. What `HTTP1_UPGRADE`'s `upgradeBytes()` answers is the first
 * input for the decoder.
 *
 * **The client's handshake** (§4.1). `websocketClientKey(nonce)` spells 16
 * random bytes as the key, `websocketUpgradeRequest(host, target, key,
 * protocols)` writes the GET that asks to upgrade, and
 * `websocketCheckResponse(parser, key, offered)` reads the server's answer,
 * parsed by `nish/net/http1-client` after `expectUpgrade()`: it answers the
 * negotiated subprotocol, or which rule of §4.1 the response broke. What
 * `HTTP1_UPGRADE`'s `tunnelBytes()` answers is the first input for
 * `WsDecoder(false, …)`. This module draws no randomness: the nonce and every
 * frame's mask key are the caller's, from `crypto.getRandomValues`.
 *
 * **The decoder** is a push-pull machine like `Http1Parser`: `feed` any slice,
 * then call `next()` until it answers `WS_NEED_MORE`.
 *
 *     const d = new WsDecoder(true, maxMessage); // a server: frames must be masked
 *     d.feed(received, 0, n);
 *     let event: i32 = d.next();
 *     while (event !== WS_NEED_MORE) {
 *       // WS_MESSAGE: d.opcode is WS_OP_TEXT or WS_OP_BINARY, the message
 *       //   is d.data[0 .. d.dataLen), valid until the next call
 *       // WS_PING / WS_PONG: the payload, the same way
 *       // WS_CLOSE: d.closeCode and d.closeReason; answer with a close
 *       // WS_ERROR: fail the connection, sending a close with d.closeCode
 *       event = d.next();
 *     }
 *
 * Fragments are joined: `WS_MESSAGE` comes once, with the whole message, and
 * control frames between the fragments of a message come out in their place
 * (§5.4). `WS_CLOSE` and `WS_ERROR` are final and repeat on every later call;
 * input after them is dropped.
 *
 * **What it refuses** (`WS_ERROR`, and the status code to close with):
 *
 * - 1002, a protocol error: a reserved bit set, since no extension is
 *   negotiated (§5.2); a reserved opcode; a control frame that is fragmented or
 *   longer than 125 bytes (§5.5); a frame masked when the decoder expects it
 *   not to be, or the reverse (§5.1); a length not in its minimal form, or a
 *   64-bit length with its top bit set (§5.2); a continuation with no message
 *   to continue, or a new message while one is unfinished (§5.4); a close
 *   frame with a one-byte payload, or a status code that may not be sent
 *   (§5.5.1, §7.4).
 * - 1007: a text message, or a close reason, that is not UTF-8 (§8.1). A text
 *   message is checked as each fragment arrives, so a bad byte is refused
 *   without waiting for the rest.
 * - 1009: a message longer than `maxMessage` (§7.4.1), refused from the frame
 *   header that would pass it, before its payload arrives.
 *
 * **The encoder** is `websocketFrame`, which writes one frame with the mask a
 * client supplies (the mask key is randomness, so it is an argument here), and
 * `websocketClosePayload` for a close frame's code and reason. Both refuse
 * (`null`) what the decoder would.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 6455, not ported from another implementation.
 */
import { base64StdPadEncode, base64urlDecode } from "nish/crypto/base64url"
import { sha1 } from "nish/crypto/sha1"
import {
  HTTP1_NO_BODY,
  Http1Parser,
  http1IsOws,
  http1IsToken,
  http1ResponseHead,
  http1SameWord,
  http1Text,
} from "nish/net/http1"
import { Http1ResponseParser, http1UpgradeRequestHead } from "nish/net/http1-client"

/** The GUID RFC 6455 §1.3 appends to the client's key before hashing it. */
export const WS_GUID: string = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

// Opcodes (§5.2).
export const WS_OP_CONTINUATION: i32 = 0
export const WS_OP_TEXT: i32 = 1
export const WS_OP_BINARY: i32 = 2
export const WS_OP_CLOSE: i32 = 8
export const WS_OP_PING: i32 = 9
export const WS_OP_PONG: i32 = 10

// Close status codes (§7.4.1).
export const WS_CLOSE_NORMAL: i32 = 1000
export const WS_CLOSE_GOING_AWAY: i32 = 1001
export const WS_CLOSE_PROTOCOL_ERROR: i32 = 1002
export const WS_CLOSE_UNSUPPORTED: i32 = 1003
/** Reported for a close frame with no status; never sent. */
export const WS_CLOSE_NO_STATUS: i32 = 1005
export const WS_CLOSE_INVALID_DATA: i32 = 1007
export const WS_CLOSE_POLICY: i32 = 1008
export const WS_CLOSE_TOO_BIG: i32 = 1009
export const WS_CLOSE_INTERNAL_ERROR: i32 = 1011

/** The longest payload a control frame may carry (§5.5). */
export const WS_MAX_CONTROL: i32 = 125

// `next()`'s events.
/** The input so far holds no further event; feed more. */
export const WS_NEED_MORE: i32 = 0
/** A whole text or binary message is in `data[0 .. dataLen)`. */
export const WS_MESSAGE: i32 = 1
/** A ping, its payload in `data[0 .. dataLen)`; answer with a pong carrying it. */
export const WS_PING: i32 = 2
/** A pong, its payload in `data[0 .. dataLen)`. */
export const WS_PONG: i32 = 3
/** From now on: the peer closed, with `closeCode` and `closeReason`. */
export const WS_CLOSE: i32 = 4
/** From now on: the input is refused; close with `closeCode`. */
export const WS_ERROR: i32 = 5

// The decoder's states.
const WS_S_FRAMES: i32 = 0
const WS_S_CLOSED: i32 = 1
const WS_S_ERROR: i32 = 2

/**
 * Where a UTF-8 check stands between two runs of bytes: the continuation
 * bytes still owed, and the range the next one must fall in (Unicode §3.9,
 * Table 3-7), so that a sequence cut between two fragments is checked whole.
 */
class WsUtf8 {
  need: i32 = 0
  lo: i32 = 0x80
  hi: i32 = 0xbf
}

/** Puts `state` back where a check starts: no sequence open. */
const websocketUtf8Reset = (state: WsUtf8): void => {
  state.need = 0
  state.lo = 0x80
  state.hi = 0xbf
}

/** Whether RFC 6455 §5.2 defines `opcode`: 0 to 2 for data, 8 to 10 for control. */
const websocketIsKnownOpcode = (opcode: i32): boolean =>
  (opcode >= 0 && opcode <= 2) || (opcode >= 8 && opcode <= 10)

/**
 * `websocketFrameEvent`'s answer for a fragment that does not end its
 * message: its frame is consumed, and the loop reads the next one. Never an
 * event.
 */
const WS_CONTINUE: i32 = -1

/**
 * Runs `buf[off .. off + len)` through the check `state` holds. Answers false
 * at the first byte that cannot continue well-formed UTF-8 (RFC 3629 §4: no
 * stray continuation byte, no overlong form, no surrogate, nothing past
 * U+10FFFF); a sequence still open at the end is left in `state`. The window
 * is the caller's, already checked against `buf`.
 */
const websocketUtf8Run = (state: WsUtf8, buf: u8[], off: i32, len: i32): boolean => {
  let need: i32 = state.need
  let lo: i32 = state.lo
  let hi: i32 = state.hi
  for (let k: i32 = off; k >= 0 && k < off + len && k < toI32(buf.length); k += 1) {
    const b: i32 = toI32(buf[k])
    if (need > 0) {
      if (b < lo || b > hi) {
        return false
      }
      need -= 1
      lo = 0x80
      hi = 0xbf
    } else if (b < 0x80) {
      // ASCII, NUL included: U+0000 is a character.
    } else if (b >= 0xc2 && b <= 0xdf) {
      need = 1
    } else if (b >= 0xe0 && b <= 0xef) {
      need = 2
      lo = b === 0xe0 ? 0xa0 : 0x80
      hi = b === 0xed ? 0x9f : 0xbf
    } else if (b >= 0xf0 && b <= 0xf4) {
      need = 3
      lo = b === 0xf0 ? 0x90 : 0x80
      hi = b === 0xf4 ? 0x8f : 0xbf
    } else {
      return false
    }
  }
  state.need = need
  state.lo = lo
  state.hi = hi
  return true
}

/** Whether `buf[off .. off + len)` is well-formed UTF-8. A window outside `buf` panics. */
export const websocketIsUtf8 = (buf: u8[], off: i32, len: i32): boolean => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic("websocketIsUtf8: the window is outside the buffer")
  }
  const state: WsUtf8 = new WsUtf8()
  return websocketUtf8Run(state, buf, off, len) && state.need === 0
}

/**
 * Whether `code` may be sent in a close frame, and so accepted in one
 * (§7.4): the codes RFC 6455 defines for the wire, 1012 to 1014 as IANA has
 * since registered them, and 3000 to 4999 for libraries and applications.
 * 1004, 1005, 1006 and 1015 are reserved or report-only.
 */
const websocketIsSendableCode = (code: i32): boolean =>
  (code >= 1000 && code <= 1003) || (code >= 1007 && code <= 1014) || (code >= 3000 && code <= 4999)

/**
 * One connection's frame decoder. `expectMasked` is true on a server, whose
 * client must mask every frame, and false on a client, whose server must
 * mask none (§5.1). `maxMessage` bounds a message, all its fragments together.
 */
export class WsDecoder {
  // References first, then numbers, then flags: no padding in the struct.
  /** The last event's payload is `data[0 .. dataLen)`, valid until the next `next()`. */
  data: u8[]
  /** The peer's close reason after `WS_CLOSE`, or what was wrong after `WS_ERROR`. */
  closeReason: string = ""
  /** The bytes fed and not yet consumed are `buf[start .. end)`. */
  buf: u8[]
  /** The message being assembled; its first `messageLen` bytes are live. */
  message: u8[]
  /** A control frame's payload, kept apart so a ping cannot disturb a message in progress. */
  control: u8[]
  /** The UTF-8 check of the text message being assembled. */
  utf8: WsUtf8

  maxMessage: i32 = 0
  dataLen: i32 = 0
  /** The last event's opcode: `WS_OP_TEXT` or `WS_OP_BINARY` for a message, the control opcode otherwise. */
  opcode: i32 = 0
  /** The peer's status code after `WS_CLOSE` (`WS_CLOSE_NO_STATUS` when it sent none), or the one to send after `WS_ERROR`. */
  closeCode: i32 = 0
  start: i32 = 0
  end: i32 = 0
  state: i32 = 0
  /** The opcode of the message whose fragments are arriving, or 0 between messages. */
  messageOpcode: i32 = 0
  messageLen: i32 = 0

  expectMasked: boolean = false

  constructor(expectMasked: boolean, maxMessage: i32) {
    this.expectMasked = expectMasked
    // Below zero allows only empty messages, as zero does.
    this.maxMessage = maxMessage
    if (maxMessage < 0) {
      this.maxMessage = 0
    }
    this.buf = new Array<u8>(1024)
    this.message = new Array<u8>(256)
    this.control = new Array<u8>(WS_MAX_CONTROL)
    this.data = this.control
    this.utf8 = new WsUtf8()
    this.reset()
  }

  /**
   * Appends `data[off .. off + len)` to the input. A window outside `data`
   * panics; after `WS_CLOSE` or `WS_ERROR` the input is dropped.
   */
  feed(data: u8[], off: i32, len: i32): void {
    const size: i32 = toI32(data.length)
    if (off < 0 || len < 0 || off > size || len > size - off) {
      panic("WsDecoder: the window is outside the buffer")
    }
    if (this.state !== WS_S_FRAMES) {
      return
    }
    websocketReserve(this, len)
    const buf: u8[] = this.buf
    const at: i32 = this.end
    // A whole array is one `set`; `set` takes no window of its source.
    if (off === 0 && len === size) {
      buf.set(data, at)
      this.end = at + len
      return
    }
    for (let k: i32 = 0; k < len; k += 1) {
      const to: i32 = at + k
      if (to >= 0 && to < toI32(buf.length)) {
        buf[to] = data[off + k]
      }
    }
    this.end = at + len
  }

  /** The next event the input holds; see the module comment. */
  next(): i32 {
    return websocketNext(this)
  }

  /**
   * Puts the decoder back as the constructor left it, for the next
   * connection, keeping the buffers it has grown: a slot that is reused
   * allocates nothing to start over.
   */
  reset(): void {
    this.state = WS_S_FRAMES
    this.start = 0
    this.end = 0
    this.dataLen = 0
    this.opcode = 0
    this.closeCode = 0
    this.closeReason = ""
    this.messageOpcode = 0
    this.messageLen = 0
    this.data = this.control
    websocketUtf8Reset(this.utf8)
  }
}

/** Makes room for `len` more input bytes at `d.end`, moving the live bytes down first. */
const websocketReserve = (d: WsDecoder, len: i32): void => {
  const old: u8[] = d.buf
  const capacity: i32 = toI32(old.length)
  if (len <= capacity - d.end) {
    return
  }
  const live: i32 = d.end - d.start
  let size: i32 = capacity
  while (size - live < len) {
    if (size > 1073741823) {
      panic("WsDecoder: more than 2^31 - 1 bytes buffered")
    }
    size = size * 2
  }
  const buf: u8[] = size === capacity ? old : new Array<u8>(size)
  const from: i32 = d.start
  for (let k: i32 = 0; k < live && k < toI32(buf.length); k += 1) {
    buf[k] = old[from + k]
  }
  d.buf = buf
  d.start = 0
  d.end = live
}

/** Refuses the input; the connection is to be closed with `code`. Answers `WS_ERROR`. */
const websocketFail = (d: WsDecoder, code: i32, reason: string): i32 => {
  d.state = WS_S_ERROR
  d.closeCode = code
  d.closeReason = reason
  d.dataLen = 0
  return WS_ERROR
}

/**
 * Copies the frame payload at `buf[from .. from + len)` into `to[at ..)`,
 * unmasking it with the key at `buf[maskAt .. maskAt + 4)` when `masked`
 * (§5.3: byte i is XORed with key byte i mod 4).
 */
const websocketUnmaskInto = (
  buf: u8[],
  from: i32,
  len: i32,
  masked: boolean,
  maskAt: i32,
  to: u8[],
  at: i32
): void => {
  // The four key bytes in one word, high byte first, rotated a byte left
  // after each payload byte, so its top byte is always key byte k mod 4.
  let key: u32 = 0
  if (masked) {
    key =
      (toU32(buf[maskAt]) << 24) |
      (toU32(buf[maskAt + 1]) << 16) |
      (toU32(buf[maskAt + 2]) << 8) |
      toU32(buf[maskAt + 3])
  }
  for (let k: i32 = 0; k < len; k += 1) {
    to[at + k] = buf[from + k] ^ toU8(key >>> 24)
    key = (key << 8) | (key >>> 24)
  }
}

/** Grows `d.message` so that `need` bytes fit, keeping its live bytes. */
const websocketMessageRoom = (d: WsDecoder, need: i32): void => {
  const old: u8[] = d.message
  let size: i32 = toI32(old.length)
  if (need <= size) {
    return
  }
  while (size < need) {
    size = size > 1073741823 ? 2147483647 : size * 2
  }
  const grown: u8[] = new Array<u8>(size)
  for (let k: i32 = 0; k < d.messageLen && k < toI32(grown.length) && k < toI32(old.length); k += 1) {
    grown[k] = old[k]
  }
  d.message = grown
}

/**
 * Reads the close frame payload now in `d.control` (§5.5.1): no payload is
 * `WS_CLOSE_NO_STATUS`, one byte is refused, and otherwise a sendable status
 * code and a UTF-8 reason. Answers `WS_CLOSE` or the refusal.
 */
const websocketReadClose = (d: WsDecoder, len: i32): i32 => {
  const payload: u8[] = d.control
  if (len === 0) {
    d.closeCode = WS_CLOSE_NO_STATUS
    d.closeReason = ""
    d.state = WS_S_CLOSED
    return WS_CLOSE
  }
  if (len === 1) {
    return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a close frame with a one-byte payload")
  }
  const code: i32 = (toI32(payload[0]) << 8) | toI32(payload[1])
  if (!websocketIsSendableCode(code)) {
    return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a close status code that may not be sent")
  }
  const reasonStart: i32 = 2
  if (!websocketIsUtf8(payload, reasonStart, len - 2)) {
    return websocketFail(d, WS_CLOSE_INVALID_DATA, "a close reason that is not UTF-8")
  }
  const parts: string[] = []
  for (let k: i32 = 2; k < len && k < toI32(payload.length); k += 1) {
    parts.push(String.fromCharCode(toI32(payload[k])))
  }
  d.closeCode = code
  d.closeReason = parts.join("")
  d.state = WS_S_CLOSED
  return WS_CLOSE
}

/**
 * Reads one frame from the input, if a whole one is there, and answers its
 * event: `WS_NEED_MORE` for no whole frame and for a fragment that does not
 * end its message, or the frame's event, or the refusal. Every check that the
 * header alone decides is made before the payload is waited for.
 */
const websocketFrameEvent = (d: WsDecoder): i32 => {
  const buf: u8[] = d.buf
  const at: i32 = d.start
  const ready: i32 = d.end - at
  if (ready < 2 || at < 0 || at + 1 >= toI32(buf.length)) {
    return WS_NEED_MORE
  }
  const b0: i32 = toI32(buf[at])
  const b1: i32 = toI32(buf[at + 1])
  const fin: boolean = (b0 & 0x80) !== 0
  const opcode: i32 = b0 & 0x0f
  const masked: boolean = (b1 & 0x80) !== 0
  const short: i32 = b1 & 0x7f
  // The bytes of the extended length: two after 126, eight after 127.
  let extended: i32 = 0
  if (short === 126) {
    extended = 2
  } else if (short === 127) {
    extended = 8
  }
  const headerLength: i32 = 2 + extended + (masked ? 4 : 0)
  if (ready < headerLength) {
    return WS_NEED_MORE
  }
  if ((b0 & 0x70) !== 0) {
    return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a reserved bit set with no extension negotiated")
  }
  const control: boolean = opcode >= 8
  if (!websocketIsKnownOpcode(opcode)) {
    return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a reserved opcode")
  }
  if (masked !== d.expectMasked) {
    return websocketFail(
      d,
      WS_CLOSE_PROTOCOL_ERROR,
      d.expectMasked ? "an unmasked frame from a client" : "a masked frame from a server"
    )
  }
  // The payload length (§5.2), held to `i32` and refused before it is used.
  let length: i32 = short
  if (extended === 2) {
    length = (toI32(buf[at + 2]) << 8) | toI32(buf[at + 3])
    if (length < 126) {
      return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a 16-bit length under 126")
    }
  } else if (extended === 8) {
    if ((toI32(buf[at + 2]) & 0x80) !== 0) {
      return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a 64-bit length with its top bit set")
    }
    // Anything in the high four bytes, or a top bit in the low four, is more
    // than an `i32` holds and so more than any `maxMessage`.
    let high: i32 = 0
    for (let k: i32 = 2; k < 6; k += 1) {
      high = high | toI32(buf[at + k])
    }
    if (high !== 0 || (toI32(buf[at + 6]) & 0x80) !== 0) {
      return websocketFail(d, WS_CLOSE_TOO_BIG, "a frame longer than 2^31 - 1 bytes")
    }
    length =
      (toI32(buf[at + 6]) << 24) | (toI32(buf[at + 7]) << 16) | (toI32(buf[at + 8]) << 8) | toI32(buf[at + 9])
    if (length < 65536) {
      return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a 64-bit length under 65536")
    }
  }
  if (control) {
    if (!fin) {
      return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a fragmented control frame")
    }
    if (length > WS_MAX_CONTROL) {
      return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a control frame longer than 125 bytes")
    }
  } else {
    if (opcode === WS_OP_CONTINUATION && d.messageOpcode === 0) {
      return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a continuation with no message to continue")
    }
    if (opcode !== WS_OP_CONTINUATION && d.messageOpcode !== 0) {
      return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a new message before the last one ended")
    }
    if (length > d.maxMessage - d.messageLen) {
      return websocketFail(d, WS_CLOSE_TOO_BIG, "a message longer than the limit")
    }
  }
  if (ready - headerLength < length) {
    return WS_NEED_MORE
  }
  // The whole frame is here: take it out of the input.
  const payloadAt: i32 = at + headerLength
  const maskAt: i32 = payloadAt - 4
  d.start = payloadAt + length
  if (control) {
    websocketUnmaskInto(buf, payloadAt, length, masked, maskAt, d.control, 0)
    d.opcode = opcode
    d.data = d.control
    d.dataLen = length
    if (opcode === WS_OP_CLOSE) {
      return websocketReadClose(d, length)
    }
    return opcode === WS_OP_PING ? WS_PING : WS_PONG
  }
  if (opcode !== WS_OP_CONTINUATION) {
    d.messageOpcode = opcode
    // A new message starts its UTF-8 check afresh, in place: nothing is
    // allocated per message.
    websocketUtf8Reset(d.utf8)
  }
  const from: i32 = d.messageLen
  websocketMessageRoom(d, from + length)
  websocketUnmaskInto(buf, payloadAt, length, masked, maskAt, d.message, from)
  d.messageLen = from + length
  if (d.messageOpcode === WS_OP_TEXT && !websocketUtf8Run(d.utf8, d.message, from, length)) {
    return websocketFail(d, WS_CLOSE_INVALID_DATA, "a text message that is not UTF-8")
  }
  if (!fin) {
    return WS_CONTINUE
  }
  if (d.messageOpcode === WS_OP_TEXT && d.utf8.need !== 0) {
    return websocketFail(d, WS_CLOSE_INVALID_DATA, "a text message that ends inside a character")
  }
  // The message is handed out whole, and the next data frame starts a new one
  // at the front of the same buffer, so `data` holds until the next call.
  d.opcode = d.messageOpcode
  d.messageOpcode = 0
  d.data = d.message
  d.dataLen = d.messageLen
  d.messageLen = 0
  return WS_MESSAGE
}

/** The loop behind `next()`: frames until one has an event or the input runs out. */
const websocketNext = (d: WsDecoder): i32 => {
  while (d.state === WS_S_FRAMES) {
    const event: i32 = websocketFrameEvent(d)
    if (event !== WS_CONTINUE) {
      return event
    }
  }
  return d.state === WS_S_CLOSED ? WS_CLOSE : WS_ERROR
}

// --- The encoder -------------------------------------------------------------

/** The longest payload a frame may carry here: its header, at most 14 bytes, still fits an `i32` length. */
const WS_MAX_FRAME_PAYLOAD: i32 = 2147483633

/** `websocketWriteFrame`: the frame does not fit at `at`. */
export const WS_NO_ROOM: i32 = -1
/** `websocketWriteFrame`: a frame the encoder refuses to write. */
export const WS_REFUSED: i32 = -2

/** How many bytes a frame of `len` payload bytes takes, its header included. */
export const websocketFrameSize = (len: i32, masked: boolean): i32 => {
  let extended: i32 = 8
  if (len < 126) {
    extended = 0
  } else if (len < 65536) {
    extended = 2
  }
  return 2 + extended + (masked ? 4 : 0) + len
}

/**
 * Writes one frame (§5.2) into `out` at `at`: FIN, the opcode, the payload
 * `payload[off .. off + len)` and, when `mask` is not null, masked with that
 * 4-byte key. A client masks every frame with a fresh key from
 * `crypto.getRandomValues` (§5.3); a server passes null. The length takes the
 * shortest of its three forms. Answers where the frame ends, `WS_NO_ROOM` when
 * it does not fit, or `WS_REFUSED` for an opcode RFC 6455 does not define, a
 * control frame that is not FIN or is longer than 125 bytes, and a mask that
 * is not 4 bytes; on either refusal `out` is untouched. A window outside
 * `payload` panics. A text frame's payload is not checked here, because a
 * fragment may end inside a character; `websocketIsUtf8` checks a whole
 * message.
 */
export const websocketWriteFrame = (
  out: u8[],
  at: i32,
  fin: boolean,
  opcode: i32,
  payload: u8[],
  off: i32,
  len: i32,
  mask: u8[] | null
): i32 => {
  const size: i32 = toI32(payload.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic("websocketWriteFrame: the window is outside the buffer")
  }
  if (!websocketIsKnownOpcode(opcode)) {
    return WS_REFUSED
  }
  const control: boolean = opcode >= 8
  if (control && (!fin || len > WS_MAX_CONTROL)) {
    return WS_REFUSED
  }
  if (mask !== null && toI32(mask.length) !== 4) {
    return WS_REFUSED
  }
  if (len > WS_MAX_FRAME_PAYLOAD) {
    panic("websocketWriteFrame: a frame longer than 2^31 - 1 bytes")
  }
  const frameSize: i32 = websocketFrameSize(len, mask !== null)
  const outLength: i32 = toI32(out.length)
  if (at < 0 || at > outLength || frameSize > outLength - at) {
    return WS_NO_ROOM
  }
  let extended: i32 = 8
  if (len < 126) {
    extended = 0
  } else if (len < 65536) {
    extended = 2
  }
  const headerLength: i32 = frameSize - len
  const finBit: i32 = fin ? 0x80 : 0
  out[at] = toU8(finBit | opcode)
  const maskBit: i32 = mask === null ? 0 : 0x80
  if (extended === 0) {
    out[at + 1] = toU8(maskBit | len)
  } else if (extended === 2) {
    out[at + 1] = toU8(maskBit | 126)
    out[at + 2] = toU8(len >> 8)
    out[at + 3] = toU8(len)
  } else {
    out[at + 1] = toU8(maskBit | 127)
    // The top four bytes are zero: `len` is an `i32`.
    for (let k: i32 = 2; k < 6; k += 1) {
      out[at + k] = 0
    }
    out[at + 6] = toU8(len >> 24)
    out[at + 7] = toU8(len >> 16)
    out[at + 8] = toU8(len >> 8)
    out[at + 9] = toU8(len)
  }
  const payloadAt: i32 = at + headerLength
  for (let k: i32 = 0; k < len && payloadAt + k < outLength; k += 1) {
    out[payloadAt + k] = payload[off + k]
  }
  if (mask !== null) {
    const keyAt: i32 = at + 2 + extended
    for (let k: i32 = 0; k < 4 && k < toI32(mask.length); k += 1) {
      out[keyAt + k] = mask[k]
    }
    // Masking and unmasking are the same XOR, so the copied payload goes
    // through the decoder's own loop, reading the key just written.
    websocketUnmaskInto(out, payloadAt, len, true, keyAt, out, payloadAt)
  }
  return payloadAt + len
}

/**
 * One frame, as `websocketWriteFrame` writes it, in an array of its own; the
 * same refusals answer `null`. A window outside `payload` panics.
 */
export const websocketFrame = (
  fin: boolean,
  opcode: i32,
  payload: u8[],
  off: i32,
  len: i32,
  mask: u8[] | null
): u8[] | null => {
  const size: i32 = toI32(payload.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic("websocketFrame: the window is outside the buffer")
  }
  if (len > WS_MAX_FRAME_PAYLOAD) {
    panic("websocketFrame: a frame longer than 2^31 - 1 bytes")
  }
  const out: u8[] = new Array<u8>(websocketFrameSize(len, mask !== null))
  const at: i32 = 0
  return websocketWriteFrame(out, at, fin, opcode, payload, off, len, mask) < 0 ? null : out
}

/**
 * The payload of a close frame (§5.5.1): `code` in two bytes, then `reason`.
 * Answers `null` for a code that may not be sent (1005, 1006 and 1015 among
 * them; §7.4), a reason that is not UTF-8, and one longer than 123 bytes,
 * which would take the frame past 125.
 */
export const websocketClosePayload = (code: i32, reason: string): u8[] | null => {
  const n: i32 = toI32(reason.length)
  if (!websocketIsSendableCode(code) || n > WS_MAX_CONTROL - 2) {
    return null
  }
  const out: u8[] = new Array<u8>(n + 2)
  const outLength: i32 = toI32(out.length)
  out[0] = toU8(code >> 8)
  out[1] = toU8(code)
  for (let k: i32 = 0; k < n && k + 2 < outLength; k += 1) {
    out[k + 2] = toU8(reason.charCodeAt(k))
  }
  const reasonStart: i32 = 2
  if (!websocketIsUtf8(out, reasonStart, n)) {
    return null
  }
  return out
}

// --- The opening handshake ----------------------------------------------------

/** The bytes of `text`, as the language holds a string. */
const websocketBytesOf = (text: string): u8[] => {
  const n: i32 = toI32(text.length)
  const out: u8[] = new Array<u8>(n)
  const outLength: i32 = toI32(out.length)
  for (let k: i32 = 0; k < outLength && k < n; k += 1) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

/**
 * `text` with one byte replaced by another throughout: how a base64url
 * spelling becomes standard base64 (`-` and `_` for `+` and `/`) and back.
 */
const websocketSwapBytes = (text: string, from1: i32, to1: i32, from2: i32, to2: i32): string => {
  const parts: string[] = []
  const n: i32 = toI32(text.length)
  for (let k: i32 = 0; k < n; k += 1) {
    let c: i32 = toI32(text.charCodeAt(k))
    if (c === from1) {
      c = to1
    } else if (c === from2) {
      c = to2
    }
    parts.push(String.fromCharCode(c))
  }
  return parts.join("")
}

/**
 * `Sec-WebSocket-Accept` for the client's `Sec-WebSocket-Key` (§4.2.2 item
 * 5.4): the SHA-1 of the key and `WS_GUID`, in padded standard base64.
 */
export const websocketAcceptKey = (key: string): string =>
  base64StdPadEncode(sha1(websocketBytesOf(`${key}${WS_GUID}`)))

/**
 * Whether `key` is a valid `Sec-WebSocket-Key` (§4.2.1 item 5): padded
 * standard base64 that decodes to exactly 16 bytes, in its one canonical
 * spelling.
 */
export const websocketKeyIsValid = (key: string): boolean => {
  if (toI32(key.length) !== 24 || !key.endsWith("==")) {
    return false
  }
  const body: string = key.substring(0, 22)
  // A `-` or `_` is not standard base64, so it may not survive the swap as
  // if it were; `=` inside the body is refused by the decoder.
  if (toI32(body.indexOf("-")) >= 0 || toI32(body.indexOf("_")) >= 0) {
    return false
  }
  const bytes: u8[] | null = base64urlDecode(websocketSwapBytes(body, 43, 45, 47, 95))
  return bytes !== null && toI32(bytes.length) === 16
}

/**
 * The client's key when the head `p` has just read is a valid opening
 * handshake (§4.2.1): a GET in HTTP/1.1, asking to upgrade to `websocket`
 * (alone, in any case), at version 13, with a valid key. Otherwise `null`, and
 * the server answers 400 (or 426 with `Sec-WebSocket-Version: 13` when only the
 * version is wrong, §4.4).
 */
export const websocketRequestKey = (p: Http1Parser): string | null => {
  if (!p.methodIs("GET") || p.minor !== 1 || !p.upgradeIs("websocket")) {
    return null
  }
  if (!p.headerIs("sec-websocket-version", "13")) {
    return null
  }
  const key: string | null = p.header("sec-websocket-key")
  if (key === null || !websocketKeyIsValid(key)) {
    return null
  }
  return key
}

/**
 * The server's 101 response to an opening handshake (§4.2.2): `Upgrade`,
 * `Connection`, `Sec-WebSocket-Accept`, and `Sec-WebSocket-Protocol` when
 * `protocol` is not empty (the caller picks it from the client's list).
 * Answers `null` for an invalid key or a protocol that is not a token.
 */
export const websocketUpgradeResponse = (key: string, protocol: string): u8[] | null => {
  if (!websocketKeyIsValid(key)) {
    return null
  }
  const names: string[] = ["Upgrade", "Connection", "Sec-WebSocket-Accept"]
  const values: string[] = ["websocket", "Upgrade", websocketAcceptKey(key)]
  if (toI32(protocol.length) > 0) {
    names.push("Sec-WebSocket-Protocol")
    values.push(protocol)
  }
  const switching: i32 = 101
  return http1ResponseHead(switching, "Switching Protocols", names, values, HTTP1_NO_BODY)
}

/**
 * The subprotocols the opening handshake `p` has just read offers, in the
 * order offered (§4.2.1 item 8, §11.3.4): every `Sec-WebSocket-Protocol`
 * field's comma-separated list, joined, each element trimmed of OWS and the
 * empty ones dropped (RFC 9110 §5.6.1). Answers `[]` when there is no such
 * field, and `null` when an element is not a token: a server picks one of
 * these, or none, for `websocketUpgradeResponse`.
 */
export const websocketOfferedProtocols = (p: Http1Parser): string[] | null => {
  const out: string[] = []
  const head: u8[] = p.head
  const spans: i32[] = p.spans
  for (let i: i32 = 0; i < p.headerCount && 4 * i + 3 < toI32(spans.length); i += 1) {
    if (websocketSpanIs(head, spans[4 * i], spans[4 * i + 1], "sec-websocket-protocol")) {
      websocketListInto(head, spans[4 * i + 2], spans[4 * i + 3], out)
    }
  }
  for (let k: i32 = 0; k < toI32(out.length); k += 1) {
    if (!http1IsToken(out[k])) {
      return null
    }
  }
  return out
}

/** Whether `bytes[a .. b)` is `word`, which is lower case, in any ASCII case. Allocates nothing. */
const websocketSpanIs = (bytes: u8[], a: i32, b: i32, word: string): boolean => {
  const n: i32 = toI32(word.length)
  if (a < 0 || b - a !== n || b > toI32(bytes.length)) {
    return false
  }
  for (let k: i32 = 0; k < n; k += 1) {
    const at: i32 = a + k
    if (at < 0 || at >= toI32(bytes.length) || k >= toI32(word.length)) {
      return false
    }
    let c: i32 = toI32(bytes[at])
    if (c >= 65 && c <= 90) {
      c += 32
    }
    if (c !== toI32(word.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/**
 * Appends the elements of the comma-separated list in `bytes[from .. to)`
 * (RFC 9110 §5.6.1) to `out`, each trimmed of OWS, the empty ones dropped.
 */
const websocketListInto = (bytes: u8[], from: i32, to: i32, out: string[]): void => {
  if (from < 0 || to > toI32(bytes.length)) {
    return
  }
  let start: i32 = from
  for (let k: i32 = from; k <= to; k += 1) {
    if (k === to || (k >= 0 && k < toI32(bytes.length) && toI32(bytes[k]) === 44)) {
      let a: i32 = start
      let b: i32 = k
      while (a < b && a >= 0 && a < toI32(bytes.length) && http1IsOws(toI32(bytes[a]))) {
        a += 1
      }
      while (b > a && b - 1 >= 0 && b - 1 < toI32(bytes.length) && http1IsOws(toI32(bytes[b - 1]))) {
        b -= 1
      }
      if (b > a) {
        out.push(http1Text(bytes, a, b, false))
      }
      start = k + 1
    }
  }
}

/** Whether the comma-separated list `value` (RFC 9110 §5.6.1) has an element that is `word`, which is lower case, in any ASCII case. */
const websocketListHas = (value: string, word: string): boolean => {
  const n: i32 = toI32(value.length)
  let start: i32 = 0
  for (let k: i32 = 0; k <= n; k += 1) {
    if (k === n || (k >= 0 && k < n && toI32(value.charCodeAt(k)) === 44)) {
      let a: i32 = start
      let b: i32 = k
      while (a < b && a >= 0 && a < n && http1IsOws(toI32(value.charCodeAt(a)))) {
        a += 1
      }
      while (b > a && b - 1 >= 0 && b - 1 < n && http1IsOws(toI32(value.charCodeAt(b - 1)))) {
        b -= 1
      }
      if (http1SameWord(value, a, b, word)) {
        return true
      }
      start = k + 1
    }
  }
  return false
}

/**
 * The `Sec-WebSocket-Key` for a client's opening handshake (§4.1 item 7): the
 * 16-byte `nonce` in padded standard base64, 24 characters. Answers `null` for
 * a nonce of any other length. The nonce is the caller's, drawn from
 * `crypto.getRandomValues` and fresh for every connection: a key that repeats
 * or can be guessed lets a cache or an intermediary replay an old handshake's
 * answer. This module draws no randomness itself.
 */
export const websocketClientKey = (nonce: u8[]): string | null => {
  if (toI32(nonce.length) !== 16) {
    return null
  }
  return base64StdPadEncode(nonce)
}

/**
 * A client's opening handshake (§4.1 items 1 to 10): `GET target HTTP/1.1`
 * with `Host`, `Sec-WebSocket-Key`, `Sec-WebSocket-Version: 13`, the offered
 * `protocols` in one `Sec-WebSocket-Protocol` field when there are any, and
 * `Upgrade: websocket` and `Connection: Upgrade`, written by
 * `nish/net/http1-client`'s `http1UpgradeRequestHead`. Answers `null` for a
 * key `websocketKeyIsValid` refuses, a protocol that is not a token (an empty
 * one, or one holding a comma, a space, CR or LF), a protocol offered twice, an
 * empty host, and everything the request writer refuses (CR, LF or another
 * control byte in `host`, a `target` that is not a request target).
 */
export const websocketUpgradeRequest = (
  host: string,
  target: string,
  key: string,
  protocols: string[]
): u8[] | null => {
  if (toI32(host.length) === 0 || !websocketKeyIsValid(key)) {
    return null
  }
  const count: i32 = toI32(protocols.length)
  for (let i: i32 = 0; i < count; i += 1) {
    if (!http1IsToken(protocols[i])) {
      return null
    }
    for (let j: i32 = 0; j < i; j += 1) {
      if (protocols[j] === protocols[i]) {
        return null
      }
    }
  }
  const names: string[] = ["Host", "Sec-WebSocket-Key", "Sec-WebSocket-Version"]
  const values: string[] = [host, key, "13"]
  if (count > 0) {
    names.push("Sec-WebSocket-Protocol")
    values.push(protocols.join(", "))
  }
  return http1UpgradeRequestHead("GET", target, names, values, "websocket")
}

// What `websocketCheckResponse` found (`WsHandshake.error`): the handshake
// succeeded, or the first rule of §4.1 the server's response broke.
/** The server accepted the handshake; `protocol` is the subprotocol it chose. */
export const WS_HS_OK: i32 = 0
/** The status is not 101; the parser's `status` says what it is. No redirect is followed. */
export const WS_HS_STATUS: i32 = 1
/** The response is not HTTP/1.1. */
export const WS_HS_VERSION: i32 = 2
/** `Upgrade` is absent, repeated, or not `websocket` in any case. */
export const WS_HS_UPGRADE: i32 = 3
/** No `Connection` field lists `upgrade`. */
export const WS_HS_CONNECTION: i32 = 4
/** `Sec-WebSocket-Accept` is absent, repeated, or not the key's accept value. */
export const WS_HS_ACCEPT: i32 = 5
/** A `Sec-WebSocket-Extensions` field, when the client offered none. */
export const WS_HS_EXTENSION: i32 = 6
/** A `Sec-WebSocket-Protocol` that is repeated, a list, or not one the client offered. */
export const WS_HS_PROTOCOL: i32 = 7

/** `websocketCheckResponse`'s answer: `error` is a `WS_HS_*` code; `protocol` is set when it is `WS_HS_OK`. */
export class WsHandshake {
  /** The subprotocol the server chose, or `""` when it chose none. */
  protocol: string = ""
  error: i32 = 0

  constructor(error: i32, protocol: string) {
    this.error = error
    this.protocol = protocol
  }
}

/**
 * Reads the server's answer to `websocketUpgradeRequest(…, key, offered)`
 * (§4.1, the client's checks of the response): call it at the parser's
 * `HTTP1_HEAD`. It fails closed, and the connection is closed on any failure:
 * a status other than 101 (`WS_HS_STATUS`; a redirect is not followed), a
 * version other than HTTP/1.1, `Upgrade` absent, repeated or not `websocket`,
 * no `Connection` listing `upgrade`, `Sec-WebSocket-Accept` absent, repeated
 * or not `websocketAcceptKey(key)` (a forged or replayed answer), any
 * `Sec-WebSocket-Extensions` (this client offers none, so none may be in use),
 * and a `Sec-WebSocket-Protocol` that is present when nothing was offered,
 * repeated, a list, or not one of `offered`. On `WS_HS_OK` the parser's next
 * events are `HTTP1_END` and `HTTP1_UPGRADE`; its `tunnelBytes()` go to
 * `WsDecoder(false, …)`, and every frame the client sends is masked with a
 * fresh mask key from `crypto.getRandomValues` (§5.3).
 */
export const websocketCheckResponse = (
  response: Http1ResponseParser,
  key: string,
  offered: string[]
): WsHandshake => {
  if (response.status !== 101) {
    return new WsHandshake(WS_HS_STATUS, "")
  }
  if (response.minor !== 1) {
    return new WsHandshake(WS_HS_VERSION, "")
  }
  const expected: string = websocketKeyIsValid(key) ? websocketAcceptKey(key) : ""
  let upgrades: i32 = 0
  let upgradeOk: boolean = false
  let connection: boolean = false
  let accepts: i32 = 0
  let acceptOk: boolean = false
  let extensions: boolean = false
  let protocols: i32 = 0
  let protocol: string = ""
  const names: string[] = response.names
  const values: string[] = response.values
  for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
    const name: string = names[i]
    const value: string = values[i]
    if (name === "upgrade") {
      upgrades += 1
      upgradeOk = http1SameWord(value, 0, toI32(value.length), "websocket")
    } else if (name === "connection") {
      if (websocketListHas(value, "upgrade")) {
        connection = true
      }
    } else if (name === "sec-websocket-accept") {
      accepts += 1
      acceptOk = toI32(expected.length) > 0 && value === expected
    } else if (name === "sec-websocket-extensions") {
      extensions = true
    } else if (name === "sec-websocket-protocol") {
      protocols += 1
      protocol = value
    }
  }
  if (upgrades !== 1 || !upgradeOk) {
    return new WsHandshake(WS_HS_UPGRADE, "")
  }
  if (!connection) {
    return new WsHandshake(WS_HS_CONNECTION, "")
  }
  if (accepts !== 1 || !acceptOk) {
    return new WsHandshake(WS_HS_ACCEPT, "")
  }
  if (extensions) {
    return new WsHandshake(WS_HS_EXTENSION, "")
  }
  if (protocols === 0) {
    return new WsHandshake(WS_HS_OK, "")
  }
  if (protocols > 1 || !http1IsToken(protocol)) {
    return new WsHandshake(WS_HS_PROTOCOL, "")
  }
  for (let i: i32 = 0; i < toI32(offered.length); i += 1) {
    if (offered[i] === protocol) {
      return new WsHandshake(WS_HS_OK, protocol)
    }
  }
  return new WsHandshake(WS_HS_PROTOCOL, "")
}
