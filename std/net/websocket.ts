/**
 * `nish/net/websocket` — RFC 6455 WebSocket framing and the opening
 * handshake's accept key, sans-IO: bytes in, events and bytes out.
 *
 * **The handshake.** `nish/net/http1` reads the client's request;
 * `websocketRequestKey(parser)` answers its `Sec-WebSocket-Key` when the head
 * is a valid opening handshake (§4.2.1), and `websocketUpgradeResponse(key,
 * protocol)` writes the 101 that accepts it, with `Sec-WebSocket-Accept` from
 * `websocketAcceptKey` (§4.2.2): the base64 of the SHA-1 of the key and a
 * fixed GUID. What `HTTP1_UPGRADE`'s `upgradeBytes()` answers is the first
 * input for the decoder.
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
import { base64urlDecode, base64urlEncode } from "nish/crypto/base64url"
import { sha1 } from "nish/crypto/sha1"
import { HTTP1_NO_BODY, Http1Parser, http1ResponseHead } from "nish/net/http1"

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
  /** The last `WS_MESSAGE` handed out `message`; the next data frame starts a new one. */
  messageDone: boolean = false

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
  const m0: u8 = masked ? buf[maskAt] : 0
  const m1: u8 = masked ? buf[maskAt + 1] : 0
  const m2: u8 = masked ? buf[maskAt + 2] : 0
  const m3: u8 = masked ? buf[maskAt + 3] : 0
  for (let k: i32 = 0; k < len; k += 1) {
    const r: i32 = k & 3
    let key: u8 = m3
    if (r === 0) {
      key = m0
    } else if (r === 1) {
      key = m1
    } else if (r === 2) {
      key = m2
    }
    to[at + k] = buf[from + k] ^ key
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
  if (len === 1 || toI32(payload.length) < 2) {
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
  if (
    opcode !== WS_OP_CONTINUATION &&
    opcode !== WS_OP_TEXT &&
    opcode !== WS_OP_BINARY &&
    opcode !== WS_OP_CLOSE &&
    opcode !== WS_OP_PING &&
    opcode !== WS_OP_PONG
  ) {
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
    if (d.messageDone) {
      d.messageDone = false
      d.messageLen = 0
    }
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
    const check: WsUtf8 = d.utf8
    check.need = 0
    check.lo = 0x80
    check.hi = 0xbf
  }
  const from: i32 = d.messageLen
  websocketMessageRoom(d, from + length)
  websocketUnmaskInto(buf, payloadAt, length, masked, maskAt, d.message, from)
  d.messageLen = from + length
  if (d.messageOpcode === WS_OP_TEXT && !websocketUtf8Run(d.utf8, d.message, from, length)) {
    return websocketFail(d, WS_CLOSE_INVALID_DATA, "a text message that is not UTF-8")
  }
  if (!fin) {
    return WS_NEED_MORE
  }
  if (d.messageOpcode === WS_OP_TEXT && d.utf8.need !== 0) {
    return websocketFail(d, WS_CLOSE_INVALID_DATA, "a text message that ends inside a character")
  }
  d.opcode = d.messageOpcode
  d.messageOpcode = 0
  d.messageDone = true
  d.data = d.message
  d.dataLen = d.messageLen
  return WS_MESSAGE
}

/** The loop behind `next()`: frames until one has an event or the input runs out. */
const websocketNext = (d: WsDecoder): i32 => {
  while (d.state === WS_S_FRAMES) {
    const before: i32 = d.start
    const event: i32 = websocketFrameEvent(d)
    // A fragment that does not end its message consumes its frame and says
    // `WS_NEED_MORE`; only when nothing was consumed is that the answer.
    if (event !== WS_NEED_MORE || d.start === before) {
      return event
    }
  }
  return d.state === WS_S_CLOSED ? WS_CLOSE : WS_ERROR
}

// --- The encoder -------------------------------------------------------------

/**
 * One frame (§5.2): FIN, the opcode, the payload `payload[off .. off + len)`
 * and, when `mask` is not null, masked with that 4-byte key. A client masks
 * every frame with a fresh key from `crypto.getRandomValues` (§5.3); a server
 * passes null. The length takes the shortest of its three forms.
 *
 * Answers `null` for an opcode RFC 6455 does not define, a control frame that
 * is not FIN or is longer than 125 bytes, and a mask that is not 4 bytes. A
 * window outside `payload` panics. A text frame's payload is not checked here,
 * because a fragment may end inside a character; `websocketIsUtf8` checks a
 * whole message.
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
  const control: boolean = opcode === WS_OP_CLOSE || opcode === WS_OP_PING || opcode === WS_OP_PONG
  if (!control && opcode !== WS_OP_CONTINUATION && opcode !== WS_OP_TEXT && opcode !== WS_OP_BINARY) {
    return null
  }
  if (control && (!fin || len > WS_MAX_CONTROL)) {
    return null
  }
  if (mask !== null && toI32(mask.length) !== 4) {
    return null
  }
  let extended: i32 = 8
  if (len < 126) {
    extended = 0
  } else if (len < 65536) {
    extended = 2
  }
  const maskBytes: i32 = mask === null ? 0 : 4
  const headerLength: i32 = 2 + extended + maskBytes
  if (len > 2147483647 - headerLength) {
    panic("websocketFrame: a frame longer than 2^31 - 1 bytes")
  }
  const out: u8[] = new Array<u8>(headerLength + len)
  const outLength: i32 = toI32(out.length)
  const finBit: i32 = fin ? 0x80 : 0
  out[0] = toU8(finBit | opcode)
  const maskBit: i32 = mask === null ? 0 : 0x80
  if (extended === 0) {
    out[1] = toU8(maskBit | len)
  } else if (extended === 2) {
    out[1] = toU8(maskBit | 126)
    out[2] = toU8(len >> 8)
    out[3] = toU8(len)
  } else {
    out[1] = toU8(maskBit | 127)
    // The top four bytes stay zero: `len` is an `i32`.
    out[6] = toU8(len >> 24)
    out[7] = toU8(len >> 16)
    out[8] = toU8(len >> 8)
    out[9] = toU8(len)
  }
  if (mask !== null) {
    const keyAt: i32 = 2 + extended
    for (let k: i32 = 0; k < 4 && k < toI32(mask.length); k += 1) {
      out[keyAt + k] = mask[k]
    }
    // Masking and unmasking are the same XOR, so the payload is copied and
    // then goes through the decoder's own loop, reading the key just written.
    for (let k: i32 = 0; k < len && headerLength + k < outLength; k += 1) {
      out[headerLength + k] = payload[off + k]
    }
    websocketUnmaskInto(out, headerLength, len, true, keyAt, out, headerLength)
  } else {
    for (let k: i32 = 0; k < len && headerLength + k < outLength; k += 1) {
      out[headerLength + k] = payload[off + k]
    }
  }
  return out
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
 * `nish/crypto/base64url` writes the base64; the URL alphabet's two last
 * characters are swapped for the standard ones, and a 20-byte digest takes one
 * `=` of padding.
 */
export const websocketAcceptKey = (key: string): string => {
  const digest: u8[] = sha1(websocketBytesOf(`${key}${WS_GUID}`))
  return `${websocketSwapBytes(base64urlEncode(digest), 45, 43, 95, 47)}=`
}

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

/** `text` with its ASCII letters in lowercase. */
const websocketLowerAscii = (text: string): string => {
  const parts: string[] = []
  const n: i32 = toI32(text.length)
  for (let k: i32 = 0; k < n; k += 1) {
    const c: i32 = toI32(text.charCodeAt(k))
    parts.push(String.fromCharCode(c >= 65 && c <= 90 ? c + 32 : c))
  }
  return parts.join("")
}

/**
 * The client's key when the head `p` has just read is a valid opening
 * handshake (§4.2.1): a GET in HTTP/1.1, asking to upgrade to `websocket`
 * (alone, in any case), at version 13, with a valid key. Otherwise `null`, and
 * the server answers 400 (or 426 with `Sec-WebSocket-Version: 13` when only the
 * version is wrong, §4.4).
 */
export const websocketRequestKey = (p: Http1Parser): string | null => {
  if (p.method !== "GET" || p.minor !== 1) {
    return null
  }
  if (websocketLowerAscii(p.upgrade) !== "websocket") {
    return null
  }
  const version: string | null = p.header("sec-websocket-version")
  if (version === null || version !== "13") {
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
