/**
 * `nish/net/websocket` — RFC 6455 WebSocket framing and both sides of the
 * opening handshake, sans-IO: bytes in, events and bytes out.
 *
 * **The server's handshake.** `nish/net/http1-codec` reads the client's request;
 * `websocketRequestKey(parser)` answers its `Sec-WebSocket-Key` when the head
 * is a valid opening handshake (§4.2.1), `websocketOfferedProtocols(parser)`
 * the subprotocols it offers, and `websocketUpgradeResponse(key, protocol)`
 * writes the 101 that accepts it, with `Sec-WebSocket-Accept` from
 * `websocketAcceptKey` (§4.2.2): the base64 of the SHA-1 of the key and a
 * fixed GUID. `websocketOriginAllowed(parser, allowed)` is the opt-in check
 * of `Origin` a server makes first, against a page on another site. A server
 * that accepts handshake after handshake keeps a `WsAcceptKey` and writes the
 * 101 into its output with `websocketRequestKeyField` and
 * `websocketWriteUpgradeResponse`, allocating nothing per handshake, as
 * `Http1Connection.acceptWebSocket` does. What `HTTP1_UPGRADE`'s `upgradeBytes()` answers is the first
 * input for the decoder.
 *
 * **The client's handshake** (§4.1). `websocketClientKey(nonce)` spells 16
 * random bytes as the key, `websocketUpgradeRequest(host, target, key,
 * protocols)` writes the GET that asks to upgrade, and
 * `websocketCheckResponse(parser, key, offered)` reads the server's answer,
 * parsed by `nish/net/http1-client-codec` after `expectUpgrade()`: it answers the
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
 *   message is checked as its bytes arrive, inside a frame as well as across
 *   fragments, so a bad byte is refused without waiting for the rest of the
 *   frame. The message buffer grows with the bytes received, not the length
 *   a frame header declares.
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
import { base64StdPadDecodedLength, base64StdPadEncode, base64StdPadEncodeInto } from "nish/crypto/base64url"
import { SHA1_SIZE, Sha1 } from "nish/crypto/sha1"
import { tryCopyBytes } from "nish/bytes"
import {
  HTTP1_NO_ROOM,
  HTTP1_REFUSED,
  Http1Parser,
  http1IsOws,
  http1IsToken,
  http1SameWord,
  http1Text,
} from "nish/net/http1-codec"
import { Http1ResponseParser, http1UpgradeRequestHead } from "nish/net/http1-client-codec"

/** The GUID RFC 6455 §1.3 appends to the client's key before hashing it. */
export const WS_GUID: string = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

// Opcodes (§5.2).
/** A frame that continues the message before it. */
export const WS_OP_CONTINUATION: i32 = 0
/** A text message, UTF-8. */
export const WS_OP_TEXT: i32 = 1
/** A binary message. */
export const WS_OP_BINARY: i32 = 2
/** A close frame: an optional status code, then an optional UTF-8 reason. */
export const WS_OP_CLOSE: i32 = 8
/** A ping, which the peer answers with a pong carrying the same payload. */
export const WS_OP_PING: i32 = 9
/** A pong, the answer to a ping or an unasked heartbeat. */
export const WS_OP_PONG: i32 = 10

// Close status codes (§7.4.1).
/** The purpose of the connection is fulfilled. */
export const WS_CLOSE_NORMAL: i32 = 1000
/** The endpoint is going away: a server shutting down, or a page closed. */
export const WS_CLOSE_GOING_AWAY: i32 = 1001
/** The peer broke the framing rules. */
export const WS_CLOSE_PROTOCOL_ERROR: i32 = 1002
/** The peer sent a kind of data the endpoint cannot take. */
export const WS_CLOSE_UNSUPPORTED: i32 = 1003
/** Reported for a close frame with no status; never sent. */
export const WS_CLOSE_NO_STATUS: i32 = 1005
/** A message's data did not fit its type, such as a text message that is not UTF-8. */
export const WS_CLOSE_INVALID_DATA: i32 = 1007
/** A message broke the endpoint's policy, when no other code fits. */
export const WS_CLOSE_POLICY: i32 = 1008
/** A message was longer than the endpoint takes. */
export const WS_CLOSE_TOO_BIG: i32 = 1009
/** The endpoint met a condition it could not handle. */
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
  /** @internal Validator state `websocketUtf8Run` reads and writes. */
  need: i32 = 0
  /** @internal Validator state `websocketUtf8Run` reads and writes. */
  lo: i32 = 0x80
  /** @internal Validator state `websocketUtf8Run` reads and writes. */
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
 * `a + b`, worked in `i64` and held to `i32`. Every caller adds an offset
 * and a length that lie inside one array, so the sum is an index into it or
 * just past it and always fits.
 */
const websocketAdd = (a: i32, b: i32): i32 => toI32(toI64(a) + toI64(b))

/** `a - b`, worked as `websocketAdd` is, for offsets inside one array. */
const websocketSub = (a: i32, b: i32): i32 => toI32(toI64(a) - toI64(b))

/**
 * A zeroed array of `n` bytes, or of none when `n` is below zero. Up to
 * 65535 bytes is one allocation; past that the array grows a byte at a time
 * from a 65535-byte start, which an `i32` length cannot make fail.
 */
const websocketBytes = (n: i32): u8[] => {
  if (n < 0) {
    return []
  }
  if (n <= 65535) {
    return new Array<u8>(toU16(n))
  }
  const out: u8[] = new Array<u8>(65535)
  for (let k: i32 = 65535; k < n; k += 1) {
    out.push(0)
  }
  return out
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
  const stop: i64 = toI64(off) + toI64(len)
  for (let k: i32 = off; k >= 0 && toI64(k) < stop && k < toI32(buf.length); k += 1) {
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

/**
 * Panics unless `buf[off .. off + len)` is inside `buf`: a window past its
 * buffer is the caller's mistake. A window guard, so a caller that proves
 * the window in range removes the panic site.
 */
const websocketCheckWindow = (what: string, buf: readonly u8[], off: i32, len: i32): void => {
  const size: i32 = toI32(buf.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${what}: the window is outside the buffer`)
  }
}

/**
 * Whether `buf[off .. off + len)` is well-formed UTF-8, no character cut short
 * at the end. The window is the caller's, already checked against `buf`, as
 * for `websocketUtf8Run`: what `websocketIsUtf8` checks before it calls this.
 */
const websocketUtf8Whole = (buf: u8[], off: i32, len: i32): boolean => {
  const state: WsUtf8 = new WsUtf8()
  return websocketUtf8Run(state, buf, off, len) && state.need === 0
}

/**
 * Whether `buf[off .. off + len)` is well-formed UTF-8: what a whole text
 * message's payload, or a close frame's reason, must be (§8.1). A window
 * outside `buf` panics.
 *
 * @param buf The array holding the bytes.
 * @param off Where the bytes start in `buf`.
 * @param len How many bytes to check; 0 is valid UTF-8.
 * @returns True when the bytes are UTF-8 with no overlong form, surrogate or code point past U+10FFFF, and no character cut short at the end.
 */
export const websocketIsUtf8 = (buf: u8[], off: i32, len: i32): boolean => {
  websocketCheckWindow("websocketIsUtf8", buf, off, len)
  return websocketUtf8Whole(buf, off, len)
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
  /** The bytes fed and not yet consumed are `buf[start .. end)`. @internal */
  buf: u8[]
  /** The message being assembled; its first `messageLen` bytes are live. @internal */
  message: u8[]
  /** A control frame's payload, kept apart so a ping cannot disturb a message in progress. @internal */
  control: u8[]
  /** The UTF-8 check of the text message being assembled. @internal */
  utf8: WsUtf8

  /** The longest message accepted, in bytes; a longer one is refused with 1009. */
  maxMessage: i32 = 0
  /** How many bytes of `data` the last event filled. */
  dataLen: i32 = 0
  /** The last event's opcode: `WS_OP_TEXT` or `WS_OP_BINARY` for a message, the control opcode otherwise. */
  opcode: i32 = 0
  /** The peer's status code after `WS_CLOSE` (`WS_CLOSE_NO_STATUS` when it sent none), or the one to send after `WS_ERROR`. */
  closeCode: i32 = 0
  /** @internal The unread bytes are `buf[start .. end)`; `nish/net/http1-server` reads them to size its input. */
  start: i32 = 0
  /** @internal The end of the unread bytes; `nish/net/http1-server` reads it with `start`. */
  end: i32 = 0
  /** @internal Decoder state the module's `websocket` helpers read and write. */
  state: i32 = 0
  /** The opcode of the message whose fragments are arriving, or 0 between messages. @internal */
  messageOpcode: i32 = 0
  /** @internal Decoder state the module's `websocket` helpers read and write. */
  messageLen: i32 = 0
  /** How many payload bytes of the text frame still arriving are unmasked and UTF-8 checked. @internal */
  frameChecked: i32 = 0

  /** Whether every frame must be masked, as a server requires of a client. */
  expectMasked: boolean = false

  /**
   * A decoder with nothing fed yet.
   * @param expectMasked True for a server, whose client masks every frame; false for a client.
   * @param maxMessage The longest message accepted, in bytes; below zero is read as zero.
   */
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
   * @param data The bytes read from the connection.
   * @param off Where the new bytes start in `data`.
   * @param len How many bytes to append.
   */
  feed(data: u8[], off: i32, len: i32): void {
    websocketCheckWindow("WsDecoder", data, off, len)
    if (this.state !== WS_S_FRAMES) {
      return
    }
    // More than 2^31 - 1 bytes waiting is more than any message.
    if (!websocketReserve(this, len) || !tryCopyBytes(this.buf, this.end, data, off, len)) {
      websocketFail(this, WS_CLOSE_TOO_BIG, "more than 2^31 - 1 bytes of input waiting")
      return
    }
    this.end = websocketAdd(this.end, len)
  }

  /**
   * The next event the input holds; see the module comment.
   * @returns A `WS_` event, `WS_NEED_MORE` when the input runs out.
   */
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
    this.frameChecked = 0
    this.data = this.control
    websocketUtf8Reset(this.utf8)
  }
}

/**
 * Makes room for `len` more input bytes at `d.end`, moving the live bytes
 * down first. Answers false, changing nothing, when the live bytes and `len`
 * together pass 2^31 - 1.
 */
const websocketReserve = (d: WsDecoder, len: i32): boolean => {
  const old: u8[] = d.buf
  const capacity: i32 = toI32(old.length)
  const start: i32 = d.start
  const end: i32 = d.end
  if (len < 0 || start < 0 || end < 0 || end < start) {
    return false
  }
  if (len <= capacity - end) {
    return true
  }
  const live: i32 = end - start
  const most: i32 = 2147483647
  if (toI64(len) > toI64(most) - toI64(live)) {
    return false
  }
  const need: i32 = websocketAdd(live, len)
  // Room enough moves the live bytes down in place; otherwise the buffer
  // at least doubles.
  let size: i32 = capacity
  if (need > capacity) {
    if (capacity > 1073741823) {
      size = 2147483647
    } else {
      size = capacity * 2
    }
    if (size < need) {
      size = need
    }
  }
  const buf: u8[] = size === capacity ? old : websocketBytes(size)
  if (!tryCopyBytes(buf, 0, old, start, live)) {
    return false
  }
  d.buf = buf
  d.start = 0
  d.end = live
  return true
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
 * (§5.3: byte i is XORed with key byte i mod 4). `phase` is how far into the
 * payload `from` is, so a payload can be unmasked a piece at a time.
 * Answers false, writing nothing, when a window lies outside its array.
 */
const websocketUnmaskInto = (
  buf: u8[],
  from: i32,
  len: i32,
  masked: boolean,
  maskAt: i32,
  phase: i32,
  to: u8[],
  at: i32
): boolean => {
  if (!masked) {
    return tryCopyBytes(to, at, buf, from, len)
  }
  const bufLength: i32 = toI32(buf.length)
  const toLength: i32 = toI32(to.length)
  if (len < 0 || from < 0 || at < 0 || from > bufLength - len || at > toLength - len) {
    return false
  }
  if (maskAt < 0 || maskAt >= bufLength - 3) {
    return false
  }
  // The four key bytes in one word, high byte first, rotated a byte left
  // after each payload byte, so its top byte is always key byte k mod 4.
  let key: u32 =
    (toU32(buf[maskAt]) << 24) |
    (toU32(buf[maskAt + 1]) << 16) |
    (toU32(buf[maskAt + 2]) << 8) |
    toU32(buf[maskAt + 3])
  for (let r: i32 = 0; r < (phase & 3); r += 1) {
    key = (key << 8) | (key >>> 24)
  }
  let s: i32 = from
  let t: i32 = at
  for (let k: i32 = 0; k < len && s >= 0 && s < bufLength && t >= 0 && t < toLength; k += 1) {
    to[t] = buf[s] ^ toU8(key >>> 24)
    key = (key << 8) | (key >>> 24)
    s += 1
    t += 1
  }
  return true
}

/**
 * Grows `d.message` so that `need` bytes fit, keeping its live bytes: the
 * message so far and the part of a text frame already checked.
 */
const websocketMessageRoom = (d: WsDecoder, need: i32): void => {
  const old: u8[] = d.message
  const oldLength: i32 = toI32(old.length)
  if (need <= oldLength) {
    return
  }
  let size: i64 = toI64(oldLength) * toI64(2)
  if (size < toI64(need)) {
    size = toI64(need)
  }
  if (size > toI64(2147483647)) {
    size = toI64(2147483647)
  }
  const grown: u8[] = websocketBytes(toI32(size))
  const live: i32 = websocketAdd(d.messageLen, d.frameChecked)
  tryCopyBytes(grown, 0, old, 0, live < oldLength ? live : oldLength)
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
  // `control` holds 125 bytes and the frame's payload was copied into it. The
  // test against 2 proves the code's two bytes; the one against `len`, the
  // reason's window.
  if (len < 2 || toI32(payload.length) < 2 || toI32(payload.length) < len) {
    return websocketFail(d, WS_CLOSE_INTERNAL_ERROR, "a close frame payload that was not kept")
  }
  const code: i32 = (toI32(payload[0]) << 8) | toI32(payload[1])
  if (!websocketIsSendableCode(code)) {
    return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a close status code that may not be sent")
  }
  const reasonStart: i32 = 2
  if (!websocketUtf8Whole(payload, reasonStart, len - 2)) {
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
  const end: i32 = d.end
  const bufLength: i32 = toI32(buf.length)
  if (at < 0 || end < 0 || end < at || end > bufLength || at >= bufLength - 1) {
    return WS_NEED_MORE
  }
  const ready: i32 = end - at
  if (ready < 2) {
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
  let keyLength: i32 = 0
  if (masked) {
    keyLength = 4
  }
  const headerLength: i32 = 2 + extended + keyLength
  if (ready < headerLength) {
    return WS_NEED_MORE
  }
  // What of the payload has arrived; at least zero, past the guard above.
  const body: i32 = ready - headerLength
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
  // `ready` covers the header, so its bytes lie inside `buf`; the checks on
  // `at` say so in the form the index proofs read.
  let length: i32 = short
  if (extended === 2) {
    if (at >= bufLength - 3) {
      return WS_NEED_MORE
    }
    length = (toI32(buf[at + 2]) << 8) | toI32(buf[at + 3])
    if (length < 126) {
      return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a 16-bit length under 126")
    }
  } else if (extended === 8) {
    if (at >= bufLength - 9) {
      return WS_NEED_MORE
    }
    if ((toI32(buf[at + 2]) & 0x80) !== 0) {
      return websocketFail(d, WS_CLOSE_PROTOCOL_ERROR, "a 64-bit length with its top bit set")
    }
    // Anything in the high four bytes, or a top bit in the low four, is more
    // than an `i32` holds and so more than any `maxMessage`.
    const high: i32 = toI32(buf[at + 2]) | toI32(buf[at + 3]) | toI32(buf[at + 4]) | toI32(buf[at + 5])
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
    if (toI64(length) > toI64(d.maxMessage) - toI64(d.messageLen)) {
      return websocketFail(d, WS_CLOSE_TOO_BIG, "a message longer than the limit")
    }
  }
  const payloadAt: i32 = websocketAdd(at, headerLength)
  const maskAt: i32 = websocketAdd(at, headerLength - 4)
  const text: boolean =
    opcode === WS_OP_TEXT || (opcode === WS_OP_CONTINUATION && d.messageOpcode === WS_OP_TEXT)
  if (text) {
    // A text frame is unmasked and checked as its bytes arrive, so a byte
    // that cannot continue UTF-8 fails the connection at once (§8.1), not
    // when the frame or the message ends.
    const arrived: i32 = body < length ? body : length
    const from: i32 = d.messageLen
    const done: i32 = d.frameChecked
    if (done === 0 && opcode === WS_OP_TEXT) {
      // A new message starts its UTF-8 check afresh, in place: nothing is
      // allocated per message.
      websocketUtf8Reset(d.utf8)
    }
    if (arrived > done) {
      // Room for the bytes that have arrived, not the length the header
      // declares: a peer that declares much and sends little costs little.
      const fresh: i32 = websocketSub(arrived, done)
      const freshAt: i32 = websocketAdd(from, done)
      websocketMessageRoom(d, websocketAdd(from, arrived))
      if (
        !websocketUnmaskInto(
          buf,
          websocketAdd(payloadAt, done),
          fresh,
          masked,
          maskAt,
          done,
          d.message,
          freshAt
        )
      ) {
        return websocketFail(d, WS_CLOSE_INTERNAL_ERROR, "a frame outside the decoder's buffers")
      }
      d.frameChecked = arrived
      if (!websocketUtf8Run(d.utf8, d.message, freshAt, fresh)) {
        return websocketFail(d, WS_CLOSE_INVALID_DATA, "a text message that is not UTF-8")
      }
    }
  }
  if (body < length) {
    return WS_NEED_MORE
  }
  // The whole frame is here: take it out of the input.
  d.start = websocketAdd(payloadAt, length)
  d.frameChecked = 0
  if (control) {
    if (!websocketUnmaskInto(buf, payloadAt, length, masked, maskAt, 0, d.control, 0)) {
      return websocketFail(d, WS_CLOSE_INTERNAL_ERROR, "a frame outside the decoder's buffers")
    }
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
  }
  const from: i32 = d.messageLen
  const total: i32 = websocketAdd(from, length)
  if (!text) {
    // A text frame's payload is already in `message`, unmasked and checked.
    websocketMessageRoom(d, total)
    if (!websocketUnmaskInto(buf, payloadAt, length, masked, maskAt, 0, d.message, from)) {
      return websocketFail(d, WS_CLOSE_INTERNAL_ERROR, "a frame outside the decoder's buffers")
    }
  }
  d.messageLen = total
  if (!fin) {
    return WS_CONTINUE
  }
  if (text && d.utf8.need !== 0) {
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

/**
 * How many bytes a frame of `len` payload bytes takes, its header included,
 * so a caller can size the buffer `websocketWriteFrame` writes into.
 *
 * @param len The payload's length in bytes, at least 0.
 * @param masked Whether the frame carries a 4-byte mask key, as every frame a client sends does.
 * @returns The frame's size in bytes: 2 to 14 bytes of header, then `len`; `WS_REFUSED` for a negative `len` or one past 2^31 - 15, whose frame `websocketWriteFrame` refuses.
 */
export const websocketFrameSize = (len: i32, masked: boolean): i32 => {
  if (len < 0 || len > WS_MAX_FRAME_PAYLOAD) {
    return WS_REFUSED
  }
  return websocketAdd(websocketHeaderLength(len, masked), len)
}

/** A frame's header length for a payload of `len` bytes, 0 to `WS_MAX_FRAME_PAYLOAD`: 2 to 14. */
const websocketHeaderLength = (len: i32, masked: boolean): i32 => {
  let key: i32 = 0
  if (masked) {
    key = 4
  }
  if (len < 126) {
    return 2 + key
  }
  if (len < 65536) {
    return 4 + key
  }
  return 10 + key
}

/**
 * Writes one frame (§5.2) into `out` at `at`: FIN, the opcode, the payload
 * `payload[off .. off + len)` and, when `mask` is not null, masked with that
 * 4-byte key. A client masks every frame with a fresh key from
 * `crypto.getRandomValues` (§5.3); a server passes null. The length takes the
 * shortest of its three forms.
 *
 * Answers where the frame ends, `WS_NO_ROOM` when it does not fit, or
 * `WS_REFUSED` for a window outside `payload`, a payload longer than
 * 2^31 - 15 bytes, an opcode RFC 6455 does not define, a control frame that
 * is not FIN or is longer than 125 bytes, and a mask that is not 4 bytes; on
 * either refusal `out` is untouched. A text frame's payload is not checked
 * here, because a fragment may end inside a character; `websocketIsUtf8`
 * checks a whole message.
 *
 * @param out The buffer the frame is written into.
 * @param at The index in `out` the frame starts at; one outside `out` answers `WS_NO_ROOM`.
 * @param fin Whether this is the message's last frame; a control frame must set it.
 * @param opcode The frame's opcode, such as `WS_OP_TEXT` or `WS_OP_PING`.
 * @param payload The array holding the payload; it is not changed, even when masked.
 * @param off Where the payload starts in `payload`.
 * @param len The payload's length in bytes.
 * @param mask The 4-byte mask key for a client's frame, or null for a server's.
 * @returns The index in `out` just past the frame, or `WS_NO_ROOM` or `WS_REFUSED`.
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
  if (off < 0 || len < 0 || off > size || len > size - off || len > WS_MAX_FRAME_PAYLOAD) {
    return WS_REFUSED
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
  const headerLength: i32 = websocketHeaderLength(len, mask !== null)
  const outLength: i32 = toI32(out.length)
  if (at < 0 || at > outLength || toI64(headerLength) + toI64(len) > toI64(outLength) - toI64(at)) {
    return WS_NO_ROOM
  }
  const finBit: i32 = fin ? 0x80 : 0
  const maskBit: i32 = mask === null ? 0 : 0x80
  // The room check covers the header; each form's own check on `at` says so
  // in the form the index proofs read.
  let extended: i32 = 8
  if (len < 126) {
    extended = 0
    if (at >= outLength - 1) {
      return WS_NO_ROOM
    }
    out[at] = toU8(finBit | opcode)
    out[at + 1] = toU8(maskBit | len)
  } else if (len < 65536) {
    extended = 2
    if (at >= outLength - 3) {
      return WS_NO_ROOM
    }
    out[at] = toU8(finBit | opcode)
    out[at + 1] = toU8(maskBit | 126)
    out[at + 2] = toU8(len >> 8)
    out[at + 3] = toU8(len)
  } else {
    if (at >= outLength - 9) {
      return WS_NO_ROOM
    }
    out[at] = toU8(finBit | opcode)
    out[at + 1] = toU8(maskBit | 127)
    // The top four bytes are zero: `len` is an `i32`.
    out[at + 2] = 0
    out[at + 3] = 0
    out[at + 4] = 0
    out[at + 5] = 0
    out[at + 6] = toU8(len >> 24)
    out[at + 7] = toU8(len >> 16)
    out[at + 8] = toU8(len >> 8)
    out[at + 9] = toU8(len)
  }
  const payloadAt: i32 = websocketAdd(at, headerLength)
  if (!tryCopyBytes(out, payloadAt, payload, off, len)) {
    return WS_NO_ROOM
  }
  if (mask !== null) {
    const keyAt: i32 = websocketAdd(at, 2 + extended)
    // Masking and unmasking are the same XOR, so the copied payload goes
    // through the decoder's own loop, reading the key just written.
    if (
      !tryCopyBytes(out, keyAt, mask, 0, 4) ||
      !websocketUnmaskInto(out, payloadAt, len, true, keyAt, 0, out, payloadAt)
    ) {
      return WS_NO_ROOM
    }
  }
  return websocketAdd(payloadAt, len)
}

/**
 * One frame, as `websocketWriteFrame` writes it, in an array of its own; the
 * same refusals, a window outside `payload` among them, answer `null`.
 *
 * @param fin Whether this is the message's last frame; a control frame must set it.
 * @param opcode The frame's opcode, such as `WS_OP_TEXT` or `WS_OP_PING`.
 * @param payload The array holding the payload; it is not changed, even when masked.
 * @param off Where the payload starts in `payload`.
 * @param len The payload's length in bytes.
 * @param mask The 4-byte mask key for a client's frame, or null for a server's.
 * @returns The whole frame, `websocketFrameSize(len, mask !== null)` bytes, or null for a frame `websocketWriteFrame` refuses.
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
  if (off < 0 || len < 0 || off > size || len > size - off || len > WS_MAX_FRAME_PAYLOAD) {
    return null
  }
  const out: u8[] = websocketBytes(websocketFrameSize(len, mask !== null))
  const at: i32 = 0
  return websocketWriteFrame(out, at, fin, opcode, payload, off, len, mask) < 0 ? null : out
}

/**
 * The payload of a close frame (§5.5.1): `code` in two bytes, then `reason`.
 * Answers `null` for a code that may not be sent (1005, 1006 and 1015 among
 * them; §7.4), a reason that is not UTF-8, and one longer than 123 bytes,
 * which would take the frame past 125.
 *
 * @param code The close status code, such as 1000 for a normal closure.
 * @param reason Why the connection closes, for a person to read; "" for no reason.
 * @returns The payload for a `WS_OP_CLOSE` frame, the code big-endian and then the reason's bytes, or null when refused.
 */
export const websocketClosePayload = (code: i32, reason: string): u8[] | null => {
  const n: i32 = toI32(reason.length)
  if (!websocketIsSendableCode(code) || n > WS_MAX_CONTROL - 2) {
    return null
  }
  const out: u8[] = [toU8(code >> 8), toU8(code)]
  for (let k: i32 = 0; k < n; k += 1) {
    out.push(toU8(reason.charCodeAt(k)))
  }
  const reasonStart: i32 = 2
  if (!websocketUtf8Whole(out, reasonStart, n)) {
    return null
  }
  return out
}

// --- The opening handshake ----------------------------------------------------

/** The bytes of `text`, as the language holds a string. */
const websocketBytesOf = (text: string): u8[] => {
  const n: i32 = toI32(text.length)
  const out: u8[] = websocketBytes(n)
  const outLength: i32 = toI32(out.length)
  for (let k: i32 = 0; k < outLength && k < n; k += 1) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

/** The length of a valid `Sec-WebSocket-Key`: 16 bytes in padded base64. */
/** Zero as an `i32`, for offsets under `--number-mode f64`. */
const WS_ZERO: i32 = 0

const WS_KEY_LENGTH: i32 = 24
/** The length of `Sec-WebSocket-Accept`: 20 bytes of SHA-1 in padded base64. */
const WS_ACCEPT_LENGTH: i32 = 28

/**
 * Whether `text[start .. end)` is a valid `Sec-WebSocket-Key` (§4.2.1 item 5):
 * 24 characters of padded standard base64 that decode to 16 bytes in their
 * one canonical spelling, read where they lie and allocating nothing.
 */
const websocketKeySpanIsValid = (text: u8[], start: i32, end: i32): boolean =>
  start >= 0 &&
  end >= 0 &&
  end <= toI32(text.length) &&
  end - start === WS_KEY_LENGTH &&
  base64StdPadDecodedLength(text, start, WS_KEY_LENGTH) === 16

/**
 * The accept key of one handshake after another, in storage the caller keeps:
 * a server builds one per connection and computes every handshake's
 * `Sec-WebSocket-Accept` into it, allocating nothing after it is built (the
 * fix for H1-3 in `docs/security/http1-codec.md`).
 *
 *     const accept = new WsAcceptKey();
 *     if (accept.compute(p.head, start, end)) {
 *       // accept.value[0 .. 28) is the field's value
 *     }
 */
export class WsAcceptKey {
  /** The hasher, its state kept from one handshake to the next. */
  hasher: Sha1
  /** The key followed by `WS_GUID`: what is hashed (§4.2.2 item 5.4). */
  input: u8[]
  /** The SHA-1 of `input`. */
  digest: u8[]
  /** The accept value's 28 characters, one a byte, once `compute` answers true. */
  value: u8[]

  /** Storage for one accept value, its hasher and buffers allocated. */
  constructor() {
    this.hasher = new Sha1()
    const text: string = WS_GUID
    const guid: i32 = toI32(text.length)
    // The 24-character key and the 36-character GUID.
    const input: u8[] = new Array<u8>(60)
    const inputLength: i32 = toI32(input.length)
    let t: i32 = WS_KEY_LENGTH
    for (let k: i32 = 0; k < guid && t >= 0 && t < inputLength; k += 1) {
      input[t] = toU8(text.charCodeAt(k))
      t += 1
    }
    this.input = input
    this.digest = new Array<u8>(SHA1_SIZE)
    this.value = new Array<u8>(WS_ACCEPT_LENGTH)
  }

  /**
   * Computes into `value` the accept value of the key in `text[start .. end)`
   * (§4.2.2 item 5.4), when that is a valid key.
   *
   * @param text The buffer holding the client's key, one character a byte, such as an `Http1Parser`'s `head`.
   * @param start Where in `text` the key starts.
   * @param end Where in `text` it ends.
   * @returns True with `value` written, or false, `value` unchanged, when the key is not valid.
   */
  compute(text: u8[], start: i32, end: i32): boolean {
    if (!websocketKeySpanIsValid(text, start, end)) {
      return false
    }
    const input: u8[] = this.input
    // A valid key is 24 bytes inside `text`, so the copy fits.
    if (!tryCopyBytes(input, WS_ZERO, text, start, WS_KEY_LENGTH)) {
      return false
    }
    this.hasher.digestInto(input, WS_ZERO, toI32(input.length), this.digest, WS_ZERO)
    base64StdPadEncodeInto(this.digest, WS_ZERO, SHA1_SIZE, this.value, WS_ZERO)
    return true
  }
}

/**
 * `Sec-WebSocket-Accept` for the client's `Sec-WebSocket-Key` (§4.2.2 item
 * 5.4): the SHA-1 of the key and `WS_GUID`, in padded standard base64.
 *
 * @param key The key as the client sent it; it is not checked here, so check it with `websocketKeyIsValid` first.
 * @returns The 28-character accept value.
 */
export const websocketAcceptKey = (key: string): string => {
  const input: u8[] = websocketBytesOf(`${key}${WS_GUID}`)
  const digest: u8[] = new Array<u8>(SHA1_SIZE)
  new Sha1().digestInto(input, WS_ZERO, toI32(input.length), digest, WS_ZERO)
  const text: u8[] = new Array<u8>(WS_ACCEPT_LENGTH)
  base64StdPadEncodeInto(digest, WS_ZERO, SHA1_SIZE, text, WS_ZERO)
  return http1Text(text, 0, WS_ACCEPT_LENGTH, false)
}

/**
 * Whether `key` is a valid `Sec-WebSocket-Key` (§4.2.1 item 5): padded
 * standard base64 that decodes to exactly 16 bytes, in its one canonical
 * spelling.
 *
 * @param key The field's value, as the client sent it.
 * @returns True for a 24-character key ending in `==` whose other characters decode to 16 bytes.
 */
export const websocketKeyIsValid = (key: string): boolean => {
  if (toI32(key.length) !== WS_KEY_LENGTH) {
    return false
  }
  const bytes: u8[] = websocketBytesOf(key)
  return websocketKeySpanIsValid(bytes, 0, WS_KEY_LENGTH)
}

/**
 * Which field of the head `p` has just read holds the client's key, when that
 * head is a valid opening handshake (§4.2.1): a GET in HTTP/1.1, asking to
 * upgrade to `websocket` (alone, in any case), at version 13, with a valid
 * first `Sec-WebSocket-Key`. Otherwise -1. Nothing is allocated: the key is
 * `p.head[p.spans[4 * i + 2] .. p.spans[4 * i + 3])`, for `WsAcceptKey`.
 *
 * @param p The server's parser, at the `HTTP1_HEAD` of the request.
 * @returns The key's field index, or -1 when the request is not a valid handshake.
 */
export const websocketRequestKeyField = (p: Http1Parser): i32 => {
  if (!p.methodIs("GET") || p.minor !== 1 || !p.upgradeIs("websocket")) {
    return -1
  }
  if (!p.headerIs("sec-websocket-version", "13")) {
    return -1
  }
  const i: i32 = p.headerIndex("sec-websocket-key")
  const spans: i32[] = p.spans
  const at: i32 = websocketValueAt(spans, i)
  if (at < 0 || at >= toI32(spans.length) - 1 || !websocketKeySpanIsValid(p.head, spans[at], spans[at + 1])) {
    return -1
  }
  return i
}

/**
 * The client's key when the head `p` has just read is a valid opening
 * handshake (§4.2.1), as `websocketRequestKeyField` judges it. Otherwise
 * `null`, and the server answers 400 (or 426 with `Sec-WebSocket-Version: 13`
 * when only the version is wrong, §4.4).
 *
 * @param p The server's parser, at the `HTTP1_HEAD` of the request.
 * @returns The `Sec-WebSocket-Key` to pass to `websocketUpgradeResponse`, or null when the request is not a valid handshake.
 */
export const websocketRequestKey = (p: Http1Parser): string | null => {
  const spans: i32[] = p.spans
  const at: i32 = websocketValueAt(spans, websocketRequestKeyField(p))
  if (at < 0 || at >= toI32(spans.length) - 1) {
    return null
  }
  return http1Text(p.head, spans[at], spans[at + 1], false)
}

/**
 * Where field `i`'s value span starts in `spans` (four entries a field: the
 * name's start and end, then the value's), or -1 when `i` is not a field
 * `spans` holds; `spans[at]` and `spans[at + 1]` are then the value's ends.
 */
const websocketValueAt = (spans: i32[], i: i32): i32 => {
  if (i < 0 || i > 536870910) {
    return -1
  }
  const at: i32 = 4 * i + 2
  if (at >= toI32(spans.length) - 1) {
    return -1
  }
  return at
}

/** Writes `text` into `out` from `at`; the caller has checked it fits. */
const websocketPutText = (out: u8[], at: i32, text: string): i32 => {
  const n: i32 = toI32(text.length)
  const outLength: i32 = toI32(out.length)
  let j: i32 = at
  for (let k: i32 = 0; k < n && j >= 0 && j < outLength; k += 1) {
    out[j] = toU8(text.charCodeAt(k))
    j += 1
  }
  return j
}

/** The 101's status line and its first two fields, which never change. */
const WS_SWITCHING: string =
  "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "

/**
 * Writes the server's 101 response to an opening handshake (§4.2.2) into
 * `out` from `at`, allocating nothing: `Upgrade`, `Connection`,
 * `Sec-WebSocket-Accept` with the 28 bytes `accept` holds, and
 * `Sec-WebSocket-Protocol` when `protocol` is not empty. The bytes are those
 * of `websocketUpgradeResponse`.
 *
 * @param out The buffer the head is written into.
 * @param at Where in `out` it starts.
 * @param accept The accept value, its 28 characters one a byte: a `WsAcceptKey`'s `value`.
 * @param protocol The subprotocol the server chose from `websocketOfferedProtocols`, or "" for none.
 * @returns The index just past the head, `HTTP1_REFUSED` when `protocol` is not a token or `accept` is not 28 bytes, or `HTTP1_NO_ROOM` when the head does not fit, `out` unchanged either way.
 */
export const websocketWriteUpgradeResponse = (out: u8[], at: i32, accept: u8[], protocol: string): i32 => {
  const p: i32 = toI32(protocol.length)
  if (p < 0 || p > 65536) {
    return HTTP1_REFUSED
  }
  if (toI32(accept.length) !== WS_ACCEPT_LENGTH || (p > 0 && !http1IsToken(protocol))) {
    return HTTP1_REFUSED
  }
  const fixed: i32 = toI32(WS_SWITCHING.length)
  let named: i32 = 0
  if (p > 0) {
    named = 26 + p
  }
  const length: i32 = websocketAdd(fixed, named + WS_ACCEPT_LENGTH + 4)
  if (at < 0 || toI64(at) + toI64(length) > toI64(toI32(out.length))) {
    return HTTP1_NO_ROOM
  }
  let j: i32 = websocketPutText(out, at, WS_SWITCHING)
  if (!tryCopyBytes(out, j, accept, WS_ZERO, WS_ACCEPT_LENGTH)) {
    return HTTP1_NO_ROOM
  }
  j = websocketPutText(out, websocketAdd(j, WS_ACCEPT_LENGTH), "\r\n")
  if (p > 0) {
    j = websocketPutText(out, j, "Sec-WebSocket-Protocol: ")
    j = websocketPutText(out, j, protocol)
    j = websocketPutText(out, j, "\r\n")
  }
  return websocketPutText(out, j, "\r\n")
}

/**
 * The server's 101 response to an opening handshake (§4.2.2): `Upgrade`,
 * `Connection`, `Sec-WebSocket-Accept`, and `Sec-WebSocket-Protocol` when
 * `protocol` is not empty (the caller picks it from the client's list).
 * Answers `null` for an invalid key or a protocol that is not a token. A
 * server answering handshake after handshake writes the same bytes with
 * `WsAcceptKey` and `websocketWriteUpgradeResponse` instead, allocating
 * nothing.
 *
 * @param key The client's `Sec-WebSocket-Key`, as `websocketRequestKey` gave it.
 * @param protocol The subprotocol the server chose from `websocketOfferedProtocols`, or "" for none.
 * @returns The whole response head, ending in the empty line, or null when refused.
 */
export const websocketUpgradeResponse = (key: string, protocol: string): u8[] | null => {
  const bytes: u8[] = websocketBytesOf(key)
  const accept = new WsAcceptKey()
  if (!accept.compute(bytes, WS_ZERO, toI32(bytes.length))) {
    return null
  }
  const out: u8[] = websocketBytes(
    websocketAdd(websocketAdd(toI32(WS_SWITCHING.length), WS_ACCEPT_LENGTH + 30), toI32(protocol.length))
  )
  const end: i32 = websocketWriteUpgradeResponse(out, WS_ZERO, accept.value, protocol)
  if (end < 0) {
    return null
  }
  const head: u8[] = websocketBytes(end)
  for (let k: i32 = 0; k < toI32(head.length) && k < toI32(out.length); k++) {
    head[k] = out[k]
  }
  return head
}

/**
 * The subprotocols the opening handshake `p` has just read offers, in the
 * order offered (§4.2.1 item 8, §11.3.4): every `Sec-WebSocket-Protocol`
 * field's comma-separated list, joined, each element trimmed of OWS and the
 * empty ones dropped (RFC 9110 §5.6.1). Answers `[]` when there is no such
 * field, and `null` when an element is not a token: a server picks one of
 * these, or none, for `websocketUpgradeResponse`.
 *
 * @param p The server's parser, at the `HTTP1_HEAD` of the request.
 * @returns The offered subprotocols in order, `[]` when none are offered, or null when one is not a token.
 */
export const websocketOfferedProtocols = (p: Http1Parser): string[] | null => {
  const out: string[] = []
  const head: u8[] = p.head
  const spans: i32[] = p.spans
  // `s` steps through the four spans of each field in turn.
  let s: i32 = 0
  for (let i: i32 = 0; i < p.headerCount && s >= 0 && s < toI32(spans.length) - 3; i += 1) {
    const valueStart: i32 = spans[s + 2]
    const valueEnd: i32 = spans[s + 3]
    const offers: boolean = websocketSpanIs(head, spans[s], spans[s + 1], "sec-websocket-protocol")
    s += 4
    if (offers) {
      websocketListInto(head, valueStart, valueEnd, out)
    }
  }
  for (let k: i32 = 0; k < toI32(out.length); k += 1) {
    if (!http1IsToken(out[k])) {
      return null
    }
  }
  return out
}

/**
 * Whether the request's `Origin` is one of `allowed`: the check a server makes
 * before `acceptWebSocket` so that a page on another site cannot open a
 * WebSocket that rides the user's cookies (cross-site WebSocket hijacking,
 * RFC 6455 §10.2). A browser always sends `Origin` on the opening handshake
 * and a page cannot change it; the handshake itself is not refused without
 * one, because a client that is not a browser need not send it, so the check
 * is the program's to opt into.
 *
 * An origin is compared whole, in any ASCII case, as the browser serializes
 * it: `https://example.com`, or `https://example.com:8443` for a port that is
 * not the scheme's default, with no path and no trailing slash. Answers false
 * for a request with no `Origin` or with more than one, so a program that also
 * serves clients that are not browsers lets those through itself. Allocates
 * nothing.
 *
 * @param p the parser holding the request's head, as `Http1Connection.parser` does at `H1_REQUEST`
 * @param allowed the origins to accept, each written as a browser sends it; "null" accepts an opaque origin, which any sandboxed page can send
 * @returns true when exactly one `Origin` field is present and its value is one of `allowed`
 */
export const websocketOriginAllowed = (p: Http1Parser, allowed: string[]): boolean => {
  const head: u8[] = p.head
  const spans: i32[] = p.spans
  // `s` steps through the four spans of each field in turn; `found` is where
  // the `Origin` field's spans start.
  let found: i32 = -1
  let s: i32 = 0
  for (let i: i32 = 0; i < p.headerCount && s >= 0 && s < toI32(spans.length) - 3; i += 1) {
    if (websocketSpanIs(head, spans[s], spans[s + 1], "origin")) {
      if (found >= 0) {
        return false
      }
      found = s
    }
    s += 4
  }
  if (found < 0 || found >= toI32(spans.length) - 3) {
    return false
  }
  for (let k: i32 = 0; k < toI32(allowed.length); k += 1) {
    if (websocketSpanFolds(head, spans[found + 2], spans[found + 3], allowed[k])) {
      return true
    }
  }
  return false
}

/**
 * Whether `bytes[a .. b)` is `text` with ASCII letters in either case on
 * either side, as an origin's scheme and host compare. Allocates nothing.
 */
const websocketSpanFolds = (bytes: u8[], a: i32, b: i32, text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (a < 0 || b < 0 || b - a !== n || b > toI32(bytes.length)) {
    return false
  }
  let at: i32 = a
  for (let k: i32 = 0; k < n; k += 1) {
    if (at < 0 || at >= toI32(bytes.length) || k >= toI32(text.length)) {
      return false
    }
    let c: i32 = toI32(bytes[at])
    if (c >= 65 && c <= 90) {
      c += 32
    }
    let w: i32 = toI32(text.charCodeAt(k))
    if (w >= 65 && w <= 90) {
      w += 32
    }
    if (c !== w) {
      return false
    }
    at += 1
  }
  return true
}

/** Whether `bytes[a .. b)` is `word`, which is lower case, in any ASCII case. Allocates nothing. */
const websocketSpanIs = (bytes: u8[], a: i32, b: i32, word: string): boolean => {
  const n: i32 = toI32(word.length)
  if (a < 0 || b < 0 || b - a !== n || b > toI32(bytes.length)) {
    return false
  }
  let at: i32 = a
  for (let k: i32 = 0; k < n; k += 1) {
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
    at += 1
  }
  return true
}

/**
 * Appends the elements of the comma-separated list in `bytes[from .. to)`
 * (RFC 9110 §5.6.1) to `out`, each trimmed of OWS, the empty ones dropped.
 */
const websocketListInto = (bytes: u8[], from: i32, to: i32, out: string[]): void => {
  const n: i32 = toI32(bytes.length)
  if (from < 0 || to > n) {
    return
  }
  let start: i32 = from
  for (let k: i32 = from; k >= 0 && k < to && k < toI32(bytes.length); k += 1) {
    if (toI32(bytes[k]) === 44) {
      websocketElementInto(bytes, start, k, out)
      start = k + 1
    }
  }
  websocketElementInto(bytes, start, to, out)
}

/** Appends `bytes[a .. b)`, trimmed of OWS, to `out` unless it is empty. */
const websocketElementInto = (bytes: u8[], a: i32, b: i32, out: string[]): void => {
  const n: i32 = toI32(bytes.length)
  let x: i32 = a
  let y: i32 = b
  while (x < y && x >= 0 && x < n && http1IsOws(toI32(bytes[x]))) {
    x += 1
  }
  while (y > x && y > 0 && y <= n) {
    const c: i32 = y - 1
    if (c < 0 || c >= n || !http1IsOws(toI32(bytes[c]))) {
      break
    }
    y = c
  }
  if (y > x) {
    out.push(http1Text(bytes, x, y, false))
  }
}

/** Whether the comma-separated list `value` (RFC 9110 §5.6.1) has an element that is `word`, which is lower case, in any ASCII case. */
const websocketListHas = (value: string, word: string): boolean => {
  const n: i32 = toI32(value.length)
  let start: i32 = 0
  for (let k: i32 = 0; k >= 0 && k < n; k += 1) {
    if (toI32(value.charCodeAt(k)) === 44) {
      if (websocketElementIs(value, start, k, word)) {
        return true
      }
      start = k + 1
    }
  }
  return websocketElementIs(value, start, n, word)
}

/** Whether `value[a .. b)`, trimmed of OWS, is `word` in any ASCII case. */
const websocketElementIs = (value: string, a: i32, b: i32, word: string): boolean => {
  const n: i32 = toI32(value.length)
  let x: i32 = a
  let y: i32 = b
  while (x < y && x >= 0 && x < n && http1IsOws(toI32(value.charCodeAt(x)))) {
    x += 1
  }
  while (y > x && y > 0 && y <= n) {
    const c: i32 = y - 1
    if (c < 0 || c >= n || !http1IsOws(toI32(value.charCodeAt(c)))) {
      break
    }
    y = c
  }
  return http1SameWord(value, x, y, word)
}

/**
 * The `Sec-WebSocket-Key` for a client's opening handshake (§4.1 item 7): the
 * 16-byte `nonce` in padded standard base64, 24 characters. Answers `null` for
 * a nonce of any other length. The nonce is the caller's, drawn from
 * `crypto.getRandomValues` and fresh for every connection: a key that repeats
 * or can be guessed lets a cache or an intermediary replay an old handshake's
 * answer. This module draws no randomness itself.
 *
 * @param nonce 16 fresh random bytes; the caller keeps the returned key to check the response with.
 * @returns The 24-character key, or null when `nonce` is not 16 bytes.
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
 * `nish/net/http1-client-codec`'s `http1UpgradeRequestHead`. Answers `null` for a
 * key `websocketKeyIsValid` refuses, a protocol that is not a token (an empty
 * one, or one holding a comma, a space, CR or LF), a protocol offered twice, an
 * empty host, and everything the request writer refuses (CR, LF or another
 * control byte in `host`, a `target` that is not a request target).
 *
 * @param host The `Host` field's value: the server's host, and its port when it is not the scheme's default.
 * @param target The request target, such as `/chat?room=1`.
 * @param key The client's key, from `websocketClientKey`.
 * @param protocols The subprotocols the client offers, in order of preference; `[]` for none.
 * @returns The whole request head, ending in the empty line, or null when refused.
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
  /** `WS_HS_OK`, or the `WS_HS_*` rule the response broke. */
  error: i32 = 0

  /**
   * The answer to one handshake check.
   * @param error `WS_HS_OK`, or the rule the response broke.
   * @param protocol The subprotocol the server chose, or `""`.
   */
  constructor(error: i32, protocol: string) {
    this.error = error
    this.protocol = protocol
  }
}

/**
 * Reads the server's answer to `websocketUpgradeRequest(…, key, offered)`
 * (§4.1, the client's checks of the response): call it at the parser's
 * `HTTP1_HEAD`.
 *
 * It fails closed, and the connection is closed on any failure: a status other
 * than 101 (`WS_HS_STATUS`; a redirect is not followed), a version other than
 * HTTP/1.1, `Upgrade` absent, repeated or not `websocket`, no `Connection`
 * listing `upgrade`, `Sec-WebSocket-Accept` absent, repeated or not
 * `websocketAcceptKey(key)` (a forged or replayed answer, or any answer when
 * `key` is not a valid key), any `Sec-WebSocket-Extensions` (this client offers
 * none, so none may be in use), and a `Sec-WebSocket-Protocol` that is present
 * when nothing was offered, repeated, a list, or not one of `offered`.
 *
 * On `WS_HS_OK` the parser's next events are `HTTP1_END` and `HTTP1_UPGRADE`;
 * its `tunnelBytes()` go to `WsDecoder(false, …)`, and every frame the client
 * sends is masked with a fresh mask key from `crypto.getRandomValues` (§5.3).
 *
 * @param response The client's parser, at the `HTTP1_HEAD` of the response.
 * @param key The key the request sent, from `websocketClientKey`.
 * @param offered The subprotocols the request offered, as passed to `websocketUpgradeRequest`.
 * @returns `WS_HS_OK` and the chosen subprotocol, or the first `WS_HS_*` rule the response broke.
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
      if (upgrades < 2) {
        upgrades += 1
      }
      upgradeOk = http1SameWord(value, 0, toI32(value.length), "websocket")
    } else if (name === "connection") {
      if (websocketListHas(value, "upgrade")) {
        connection = true
      }
    } else if (name === "sec-websocket-accept") {
      if (accepts < 2) {
        accepts += 1
      }
      acceptOk = toI32(expected.length) > 0 && value === expected
    } else if (name === "sec-websocket-extensions") {
      extensions = true
    } else if (name === "sec-websocket-protocol") {
      if (protocols < 2) {
        protocols += 1
      }
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
