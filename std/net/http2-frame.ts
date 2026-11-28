/**
 * `nish/net/http2-frame` — the frames of HTTP/2 (RFC 9113 §4 and §6): the
 * nine-byte header, every one of the ten frame types read and written, and
 * the size, flag, padding and stream-identifier rules each one carries.
 *
 * It is sans-IO, like every lane of WP34 §5 below the sockets, and it never
 * allocates: a frame is read out of the caller's buffer into an `Http2Frame`
 * the caller reuses, its content left where it lies as a window, and a frame
 * is written into the caller's buffer at an offset.
 *
 *     import {
 *       H2_FLAG_END_STREAM, Http2Frame, http2ReadHeader, http2ParseFrame, http2WriteData,
 *     } from "nish/net/http2-frame";
 *
 *     // `buf[off, off + len)` is what the peer sent; `maxFrameSize` is this side's SETTINGS_MAX_FRAME_SIZE.
 *     const read = (frame: Http2Frame, buf: u8[], off: i32, len: i32, maxFrameSize: i32): void => {
 *       if (http2ReadHeader(frame, buf, off, len) && len >= 9 + frame.length) {
 *         const error: i32 = http2ParseFrame(frame, buf, off, maxFrameSize);
 *         // 0, or the connection error to close with; frame.streamError, the
 *         // stream error to reset the stream with; then buf[frame.contentStart ..
 *         // frame.contentStart + frame.contentLength) is the DATA, the header
 *         // block fragment or the GOAWAY debug data.
 *       }
 *     };
 *     // `body[0, n)` goes into `out` at `at` as the last DATA of `streamId`; `end` is the offset after it.
 *     const send = (out: u8[], at: i32, streamId: i32, body: u8[], n: i32): void => {
 *       const end: i32 = http2WriteData(out, at, streamId, body, 0, n, H2_FLAG_END_STREAM, -1);
 *     };
 *
 * **What a parse refuses**, as the error code RFC 9113 names, which closes the
 * connection: a frame longer than the receiver's SETTINGS_MAX_FRAME_SIZE
 * (FRAME_SIZE_ERROR, §4.2); DATA, HEADERS, PRIORITY, RST_STREAM, PUSH_PROMISE
 * or CONTINUATION on stream 0, and SETTINGS, PING or GOAWAY on any other
 * (PROTOCOL_ERROR); a frame too short for its fixed fields, a RST_STREAM or
 * WINDOW_UPDATE that is not four bytes, a PING that is not eight, a SETTINGS
 * whose length is not a multiple of six or an ACK with a payload, and a GOAWAY
 * under eight (FRAME_SIZE_ERROR); padding as long as what it pads or longer
 * (PROTOCOL_ERROR, §6.1); and a WINDOW_UPDATE of zero on the connection
 * (PROTOCOL_ERROR, §6.9).
 *
 *  Two refusals only reset the stream, and come back in `streamError` with a
 *  parse that answers 0: a PRIORITY of the wrong length (FRAME_SIZE_ERROR,
 *  §6.3), and a WINDOW_UPDATE of zero on a stream (PROTOCOL_ERROR). A HEADERS or
 *  PRIORITY that makes a stream depend on itself is the same (PROTOCOL_ERROR,
 *  §5.3.1). A frame of a type this module does not know is read and answers 0:
 *  §4.1 says it is ignored, and that is the connection's to do.
 *
 * SETTINGS values are checked one at a time by `http2SettingError`, because
 * which value a refusal names is the reader's business (§6.5.2): an
 * ENABLE_PUSH or ENABLE_CONNECT_PROTOCOL other than 0 or 1, and a
 * MAX_FRAME_SIZE outside 2^14 to 2^24 − 1, are PROTOCOL_ERROR; an
 * INITIAL_WINDOW_SIZE past 2^31 − 1 is FLOW_CONTROL_ERROR.
 *
 * **The writers** answer the offset after the frame, or -1 when it would not
 * fit in the buffer, which is then unchanged; a window outside its source
 * buffer, a stream identifier outside 0 to 2^31 − 1 and padding past 255 are
 * the program's mistakes and panic. The writers of a frame type write none
 * the reader refuses, so a program cannot send what its peer must close for,
 * save a payload past the peer's SETTINGS_MAX_FRAME_SIZE, which they cannot
 * know: they stop at 2^24 − 1. `http2WriteHeader` checks no type's rules.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9113, not ported from another implementation.
 */

import { tryCopyBytes } from "nish/bytes"

/** The size of a frame header: a 24-bit length, a type, flags and a 31-bit stream identifier (§4.1). */
export const H2_FRAME_HEADER_SIZE: i32 = 9

/** The frame types of §6, the header's type byte. DATA (0x0): a stream's body bytes (§6.1). */
export const H2_FRAME_DATA: i32 = 0
/** HEADERS (0x1): opens a stream with a header block fragment, or carries trailers (§6.2). */
export const H2_FRAME_HEADERS: i32 = 1
/** PRIORITY (0x2): a stream's dependency and weight, a scheme RFC 9113 deprecates (§6.3, §5.3.2). */
export const H2_FRAME_PRIORITY: i32 = 2
/** RST_STREAM (0x3): ends one stream at once with an error code (§6.4). */
export const H2_FRAME_RST_STREAM: i32 = 3
/** SETTINGS (0x4): the sender's settings, or with ACK their acknowledgement (§6.5). */
export const H2_FRAME_SETTINGS: i32 = 4
/** PUSH_PROMISE (0x5): reserves a stream for a server push, with its request's header block (§6.6). */
export const H2_FRAME_PUSH_PROMISE: i32 = 5
/** PING (0x6): eight opaque bytes the peer echoes back with ACK (§6.7). */
export const H2_FRAME_PING: i32 = 6
/** GOAWAY (0x7): the sender is going away; names the last stream it may have processed (§6.8). */
export const H2_FRAME_GOAWAY: i32 = 7
/** WINDOW_UPDATE (0x8): widens a stream's or the connection's flow-control window (§6.9). */
export const H2_FRAME_WINDOW_UPDATE: i32 = 8
/** CONTINUATION (0x9): the next fragment of a header block a HEADERS or PUSH_PROMISE began (§6.10). */
export const H2_FRAME_CONTINUATION: i32 = 9

/** END_STREAM (0x1) on DATA and HEADERS: the sender's last frame on the stream. */
export const H2_FLAG_END_STREAM: i32 = 1
/** ACK (0x1) on SETTINGS and PING, the same bit as END_STREAM: the frame acknowledges the peer's. */
export const H2_FLAG_ACK: i32 = 1
/** END_HEADERS on HEADERS, PUSH_PROMISE and CONTINUATION. */
export const H2_FLAG_END_HEADERS: i32 = 4
/** PADDED on DATA, HEADERS and PUSH_PROMISE. */
export const H2_FLAG_PADDED: i32 = 8
/** PRIORITY on HEADERS. */
export const H2_FLAG_PRIORITY: i32 = 32

/** The error codes of §7. NO_ERROR (0x0): not an error, as in a graceful GOAWAY; the parsers' "accepted". */
export const H2_NO_ERROR: i32 = 0
/** PROTOCOL_ERROR (0x1): a generic protocol violation (§7). */
export const H2_PROTOCOL_ERROR: i32 = 1
/** INTERNAL_ERROR (0x2): the sender hit an unexpected internal error (§7). */
export const H2_INTERNAL_ERROR: i32 = 2
/** FLOW_CONTROL_ERROR (0x3): the peer broke flow control (§7). */
export const H2_FLOW_CONTROL_ERROR: i32 = 3
/** SETTINGS_TIMEOUT (0x4): a SETTINGS was not acknowledged in time (§7). */
export const H2_SETTINGS_TIMEOUT: i32 = 4
/** STREAM_CLOSED (0x5): a frame arrived on a stream that was half-closed for it (§7). */
export const H2_STREAM_CLOSED: i32 = 5
/** FRAME_SIZE_ERROR (0x6): a frame had an invalid size (§7). */
export const H2_FRAME_SIZE_ERROR: i32 = 6
/** REFUSED_STREAM (0x7): the stream was refused before any of it was processed; it may be retried (§7). */
export const H2_REFUSED_STREAM: i32 = 7
/** CANCEL (0x8): the stream is no longer needed (§7). */
export const H2_CANCEL: i32 = 8
/** COMPRESSION_ERROR (0x9): the field-compression context cannot be kept (§7). */
export const H2_COMPRESSION_ERROR: i32 = 9
/** CONNECT_ERROR (0xa): the connection a CONNECT request made was reset or closed (§7). */
export const H2_CONNECT_ERROR: i32 = 10
/** ENHANCE_YOUR_CALM (0xb): the peer is generating excessive load (§7). */
export const H2_ENHANCE_YOUR_CALM: i32 = 11
/** INADEQUATE_SECURITY (0xc): the transport does not meet the minimum security requirements (§7). */
export const H2_INADEQUATE_SECURITY: i32 = 12
/** HTTP_1_1_REQUIRED (0xd): the endpoint requires HTTP/1.1 instead of HTTP/2 (§7). */
export const H2_HTTP_1_1_REQUIRED: i32 = 13

/**
 * The settings of §6.5.2, and RFC 8441's, by identifier. SETTINGS_HEADER_TABLE_SIZE (0x1): the most
 * bytes of HPACK dynamic table the sender lets its peer's encoder use.
 */
export const H2_SETTINGS_HEADER_TABLE_SIZE: i32 = 1
/** SETTINGS_ENABLE_PUSH (0x2): 0 or 1, whether the sender allows server push. */
export const H2_SETTINGS_ENABLE_PUSH: i32 = 2
/** SETTINGS_MAX_CONCURRENT_STREAMS (0x3): the most streams the sender lets its peer open at once. */
export const H2_SETTINGS_MAX_CONCURRENT_STREAMS: i32 = 3
/** SETTINGS_INITIAL_WINDOW_SIZE (0x4): every stream's initial send window, in bytes, 0 to 2^31 − 1. */
export const H2_SETTINGS_INITIAL_WINDOW_SIZE: i32 = 4
/** SETTINGS_MAX_FRAME_SIZE (0x5): the longest frame payload the sender takes, 2^14 to 2^24 − 1 bytes. */
export const H2_SETTINGS_MAX_FRAME_SIZE: i32 = 5
/** SETTINGS_MAX_HEADER_LIST_SIZE (0x6): advisory, the largest field section the sender takes (§6.5.2). */
export const H2_SETTINGS_MAX_HEADER_LIST_SIZE: i32 = 6
/** SETTINGS_ENABLE_CONNECT_PROTOCOL (0x8): 0 or 1, whether the sender takes extended CONNECT (RFC 8441). */
export const H2_SETTINGS_ENABLE_CONNECT_PROTOCOL: i32 = 8

/** A window's initial size, 65,535 bytes, on the connection and on every stream (§6.9.2). */
export const H2_DEFAULT_WINDOW: i32 = 65535
/** The largest a window may reach, and the largest INITIAL_WINDOW_SIZE: 2^31 − 1 bytes (§6.9.1). */
export const H2_MAX_WINDOW: i32 = 2147483647

/** SETTINGS_MAX_FRAME_SIZE's initial value, which is also its least: 2^14 bytes (§6.5.2). */
export const H2_DEFAULT_MAX_FRAME: i32 = 16384
/** SETTINGS_MAX_FRAME_SIZE's greatest value, 2^24 − 1 bytes; a writer panics past it (§6.5.2). */
export const H2_MAX_FRAME_LIMIT: i32 = 16777215

/** The size of one setting: a 16-bit identifier and a 32-bit value. */
export const H2_SETTING_SIZE: i32 = 6

/** A typed zero: a bare literal is an `f64` under `--number-mode f64`. */
const H2_FRAME_ZERO: i32 = 0

/** A typed one: the Pad Length field's size. */
const H2_FRAME_ONE: i32 = 1

/** A typed -1, for a field that is absent. */
const H2_FRAME_NONE: i32 = -1

/** The exclusive bit of a stream dependency (§5.3.1), above the 31-bit identifier. */
const H2_FRAME_EXCLUSIVE: i64 = 2147483648

/** The largest 32-bit value, which bounds a setting's value. */
const H2_FRAME_U32_MAX: i64 = 4294967295

/**
 * One frame, as `http2ReadHeader` and `http2ParseFrame` read it. The next
 * header read overwrites the header's fields; the next parse overwrites the
 * content window, the padding and priority fields and `streamError`, and a
 * type's own fields when it parses that type. A field only another type
 * carries (`errorCode`, `lastStreamId`, `increment`, `promisedId`) keeps its
 * last value, so a reader reads the fields of the type it parsed. One frame
 * serves a whole connection.
 */
export class Http2Frame {
  /** The payload's length, from the header. */
  length: i32 = 0
  /** The frame type from the header, 0 to 255: an `H2_FRAME_*`, or a type this module does not know. */
  type: i32 = 0
  /** The flags byte from the header, as sent, bits a type does not define included; `has` tests one. */
  flags: i32 = 0
  /** The stream identifier, the reserved bit dropped. */
  streamId: i32 = 0
  /**
   * Where the payload starts in the buffer read.
   *
   * @internal Read by this module's parse and setting readers; a caller reads `contentStart`.
   */
  payload: i32 = 0
  /**
   * The frame's content, `[contentStart, contentStart + contentLength)` of the
   * buffer: DATA's data, a header block fragment, PING's eight bytes, GOAWAY's
   * debug data, SETTINGS' settings; padding and fixed fields left out.
   */
  contentStart: i32 = 0
  /**
   * The content's length in bytes, from `contentStart`. For every type but DATA, HEADERS,
   * PUSH_PROMISE and GOAWAY, the window is the whole payload.
   */
  contentLength: i32 = 0
  /** The Pad Length field, or -1 without PADDED. */
  padLength: i32 = -1
  /** Whether a HEADERS frame carried the PRIORITY fields, as a PRIORITY frame always does. */
  hasPriority: boolean = false
  /** Whether the stream dependency is exclusive (§5.3.1); false without priority fields. */
  exclusive: boolean = false
  /** The stream this one depends on, the exclusive bit dropped; 0 without priority fields. */
  dependency: i32 = 0
  /** The weight, 1 to 256. */
  weight: i32 = 0
  /** RST_STREAM's and GOAWAY's error code, a 32-bit value. */
  errorCode: i64 = 0
  /** GOAWAY's last stream identifier. */
  lastStreamId: i32 = 0
  /** WINDOW_UPDATE's increment. */
  increment: i32 = 0
  /** PUSH_PROMISE's promised stream identifier. */
  promisedId: i32 = 0
  /** A stream error the frame is, or 0: the stream is reset and the connection lives. */
  streamError: i32 = 0

  /**
   * Whether the flag `bit` is set.
   *
   * @param bit A flag mask, an `H2_FLAG_*`.
   * @returns True when `flags` has any bit of `bit` set.
   */
  has(bit: i32): boolean {
    return (this.flags & bit) !== 0
  }
}

/** Panics unless `[off, off + len)` lies inside `buf`: a window outside it is the program's mistake. */
const http2FrameCheckWindow = (what: string, buf: u8[], off: i32, len: i64): void => {
  if (off < 0 || len < toI64(0) || len > toI64(buf.length) - toI64(off)) {
    panic(`${what}: the window [${off}, ${off} + ${len}) is outside a buffer of ${buf.length} bytes`)
  }
}

/** Panics unless `id` is a stream identifier, 0 to 2^31 − 1. */
const http2FrameCheckStream = (what: string, id: i32): void => {
  if (id < 0) {
    panic(`${what}: a stream identifier of ${id}`)
  }
}

/**
 * The big-endian 32-bit value at `buf[at]`, or -1 when the four bytes are not
 * all inside `buf`; every caller has checked they are.
 */
const http2FrameU32 = (buf: u8[], at: i32): i64 => {
  // `at` is below `length - 3`, so `at + 3` is inside `buf` and cannot wrap.
  if (at < 0 || at >= toI32(buf.length) - 3) {
    return toI64(-1)
  }
  return (
    (toI64(buf[at]) << toI64(24)) |
    (toI64(buf[at + 1]) << toI64(16)) |
    (toI64(buf[at + 2]) << toI64(8)) |
    toI64(buf[at + 3])
  )
}

/** The big-endian 31-bit value at `buf[at]`, its reserved top bit dropped, or -1 as `http2FrameU32` answers it. */
const http2FrameU31 = (buf: u8[], at: i32): i32 => {
  const value: i64 = http2FrameU32(buf, at)
  return value < toI64(0) ? H2_FRAME_NONE : toI32(value & toI64(2147483647))
}

/**
 * Writes `value`'s low 32 bits big-endian at `out[at]` and answers true, or
 * answers false and writes nothing when the four bytes are not all inside
 * `out`; every caller has checked they are.
 */
const http2FramePut32 = (out: u8[], at: i32, value: i64): boolean => {
  // `at` is below `length - 3`, so `at + 3` is inside `out` and cannot wrap.
  if (at < 0 || at >= toI32(out.length) - 3) {
    return false
  }
  out[at] = toU8((value >> toI64(24)) & toI64(255))
  out[at + 1] = toU8((value >> toI64(16)) & toI64(255))
  out[at + 2] = toU8((value >> toI64(8)) & toI64(255))
  out[at + 3] = toU8(value & toI64(255))
  return true
}

/**
 * A frame length summed in `i64`, held at its largest when past an `i32`: `http2WriteHeader` refuses
 * that as past 2^24 − 1, as it does any length there.
 */
const http2FrameLength = (total: i64): i32 => (total > toI64(H2_MAX_WINDOW) ? H2_MAX_WINDOW : toI32(total))

/** `a + b` for two offsets whose sum a caller has checked fits an `i32`; widened, so it cannot wrap. */
const http2FrameAdd = (a: i32, b: i32): i32 => toI32(toI64(a) + toI64(b))

/**
 * Reads the nine-byte header at `buf[off]` into `frame`, when `len` bytes from
 * `off` hold one, and answers whether they did. The payload need not be there
 * yet: a reader checks `frame.length` against its limit before it waits for
 * the rest, which is what keeps a peer from making it buffer more.
 *
 * @param frame The frame its length, type, flags and stream identifier are written into; left as it was
 *   when the header is not all there.
 * @param buf The bytes received, read and not kept.
 * @param off Where the header starts in `buf`.
 * @param len How many bytes from `off` have arrived; `[off, off + len)` outside `buf` panics.
 * @returns True when nine bytes were there and the header was read; false when fewer were, with `frame`
 *   untouched, so the reader waits for more.
 */
export const http2ReadHeader = (frame: Http2Frame, buf: u8[], off: i32, len: i32): boolean => {
  http2FrameCheckWindow("http2ReadHeader", buf, off, toI64(len))
  // The window is inside `buf`, so with nine bytes in it `off` is below
  // `length - 8`: every byte read is inside `buf` and `off + 9` cannot wrap.
  if (len < H2_FRAME_HEADER_SIZE || off < 0 || off >= toI32(buf.length) - 8) {
    return false
  }
  frame.length = (toI32(buf[off]) << 16) | (toI32(buf[off + 1]) << 8) | toI32(buf[off + 2])
  frame.type = toI32(buf[off + 3])
  frame.flags = toI32(buf[off + 4])
  frame.streamId =
    ((toI32(buf[off + 5]) & 127) << 24) |
    (toI32(buf[off + 6]) << 16) |
    (toI32(buf[off + 7]) << 8) |
    toI32(buf[off + 8])
  frame.payload = off + H2_FRAME_HEADER_SIZE
  return true
}

/**
 * Takes the Pad Length field off the front of a padded frame's payload, when
 * PADDED is set, leaving `fixed` bytes of fixed fields after it; sets the
 * content window to what lies between them and the padding. Answers 0 or the
 * connection error.
 */
const http2FrameUnpad = (frame: Http2Frame, buf: u8[], fixed: i32): i32 => {
  const padded: boolean = frame.has(H2_FLAG_PADDED)
  // The callers pass 0, 4 or 5 fixed bytes, so `head` is 0 to 6; widened,
  // the sum cannot wrap.
  const head: i32 = padded ? toI32(toI64(fixed) + toI64(1)) : fixed
  const length: i32 = frame.length
  if (fixed < 0 || length < head) {
    return H2_FRAME_SIZE_ERROR
  }
  const p: i32 = frame.payload
  if (padded) {
    // `http2ParseFrame` checked the payload is inside `buf`, and it is at
    // least `head` bytes, so its first byte is there.
    if (p < 0 || p >= toI32(buf.length)) {
      return H2_FRAME_SIZE_ERROR
    }
    frame.padLength = toI32(buf[p])
  } else {
    frame.padLength = H2_FRAME_NONE
  }
  const pad: i32 = padded ? frame.padLength : H2_FRAME_ZERO
  // Widened, so neither the difference nor the sums below can wrap.
  if (toI64(pad) > toI64(length) - toI64(head)) {
    return H2_PROTOCOL_ERROR
  }
  // Both lie inside the payload `http2ParseFrame` checked, so both fit an `i32`.
  frame.contentStart = toI32(toI64(p) + toI64(head))
  frame.contentLength = toI32(toI64(length) - toI64(head) - toI64(pad))
  return H2_NO_ERROR
}

/**
 * Reads the five bytes of priority fields at `buf[at]` into `frame` (§6.3). A
 * stream may not depend on itself (§5.3.1). Answers 0, or
 * `H2_FRAME_SIZE_ERROR` with `frame` unchanged when the five bytes are not all
 * inside `buf`; every caller has checked they are.
 */
const http2FramePriority = (frame: Http2Frame, buf: u8[], at: i32): i32 => {
  // `at` is below `length - 4`, so `at + 4` is inside `buf` and cannot wrap.
  if (at < 0 || at >= toI32(buf.length) - 4) {
    return H2_FRAME_SIZE_ERROR
  }
  frame.hasPriority = true
  frame.exclusive = (toI32(buf[at]) & 128) !== 0
  frame.dependency =
    ((toI32(buf[at]) & 127) << 24) |
    (toI32(buf[at + 1]) << 16) |
    (toI32(buf[at + 2]) << 8) |
    toI32(buf[at + 3])
  // A byte is 0 to 255, so the weight is 1 to 256 and the sum cannot overflow.
  frame.weight = toI32(buf[at + 4]) + 1
  if (frame.dependency === frame.streamId) {
    frame.streamError = H2_PROTOCOL_ERROR
  }
  return H2_NO_ERROR
}

/**
 * Parses the frame whose header `http2ReadHeader` read from `buf[off]`; its
 * whole payload must be in `buf`. `maxFrameSize` is the reader's
 * SETTINGS_MAX_FRAME_SIZE. Answers 0, with the type's fields set and any
 * stream error in `streamError`, or the connection error the module comment
 * lists.
 *
 * @param frame The frame `http2ReadHeader` filled from the same `buf` and `off`; its content window,
 *   padding, priority fields, `streamError` and the parsed type's own fields are set.
 * @param buf The bytes received; the content window points into it, so it must stay as it is while the
 *   content is read. `[off, off + 9 + frame.length)` outside `buf` panics.
 * @param off Where the frame's header starts in `buf`.
 * @param maxFrameSize This side's SETTINGS_MAX_FRAME_SIZE in bytes; a longer payload is refused.
 * @returns 0 (`H2_NO_ERROR`) when the frame is accepted, `streamError` then holding 0 or the stream error
 *   to reset with (`H2_FRAME_SIZE_ERROR` or `H2_PROTOCOL_ERROR`); otherwise the connection error to close
 *   with, `H2_FRAME_SIZE_ERROR` or `H2_PROTOCOL_ERROR`.
 */
export const http2ParseFrame = (frame: Http2Frame, buf: u8[], off: i32, maxFrameSize: i32): i32 => {
  http2FrameCheckWindow("http2ParseFrame", buf, off, toI64(H2_FRAME_HEADER_SIZE) + toI64(frame.length))
  // The window holds the nine header bytes unless `frame.length` is negative,
  // which no header `http2ReadHeader` read can give; with `off` below
  // `length - 8`, `off + 9` cannot wrap.
  if (frame.length < 0 || off < 0 || off >= toI32(buf.length) - 8) {
    return H2_FRAME_SIZE_ERROR
  }
  frame.payload = off + H2_FRAME_HEADER_SIZE
  frame.contentStart = frame.payload
  frame.contentLength = frame.length
  frame.padLength = H2_FRAME_NONE
  frame.hasPriority = false
  frame.exclusive = false
  frame.dependency = 0
  frame.weight = 0
  frame.streamError = 0
  if (frame.length > maxFrameSize) {
    return H2_FRAME_SIZE_ERROR
  }
  const p: i32 = frame.payload
  const onStream: boolean = frame.streamId !== 0
  switch (frame.type) {
    case H2_FRAME_DATA:
      return onStream ? http2FrameUnpad(frame, buf, H2_FRAME_ZERO) : H2_PROTOCOL_ERROR
    case H2_FRAME_HEADERS: {
      if (!onStream) {
        return H2_PROTOCOL_ERROR
      }
      const priority: boolean = frame.has(H2_FLAG_PRIORITY)
      const error: i32 = http2FrameUnpad(frame, buf, priority ? 5 : 0)
      if (error === H2_NO_ERROR && priority) {
        // `http2FrameUnpad` put the content 5 bytes or more past the payload's start.
        return http2FramePriority(frame, buf, http2FrameAdd(frame.contentStart, -5))
      }
      return error
    }
    case H2_FRAME_PRIORITY:
      if (!onStream) {
        return H2_PROTOCOL_ERROR
      }
      if (frame.length !== 5) {
        frame.streamError = H2_FRAME_SIZE_ERROR
        return H2_NO_ERROR
      }
      return http2FramePriority(frame, buf, p)
    case H2_FRAME_RST_STREAM:
      if (!onStream) {
        return H2_PROTOCOL_ERROR
      }
      if (frame.length !== 4) {
        return H2_FRAME_SIZE_ERROR
      }
      // The four bytes are inside the window checked above; -1 cannot come back.
      frame.errorCode = http2FrameU32(buf, p)
      return frame.errorCode < toI64(0) ? H2_FRAME_SIZE_ERROR : H2_NO_ERROR
    case H2_FRAME_SETTINGS:
      if (onStream) {
        return H2_PROTOCOL_ERROR
      }
      if (frame.has(H2_FLAG_ACK) ? frame.length > 0 : frame.length % H2_SETTING_SIZE !== 0) {
        return H2_FRAME_SIZE_ERROR
      }
      return H2_NO_ERROR
    case H2_FRAME_PUSH_PROMISE: {
      if (!onStream) {
        return H2_PROTOCOL_ERROR
      }
      const error: i32 = http2FrameUnpad(frame, buf, 4)
      if (error !== H2_NO_ERROR) {
        return error
      }
      // `http2FrameUnpad` put the content 4 bytes or more past the payload's
      // start, inside the window checked above; -1 cannot come back.
      frame.promisedId = http2FrameU31(buf, http2FrameAdd(frame.contentStart, -4))
      return frame.promisedId < 0 ? H2_FRAME_SIZE_ERROR : H2_NO_ERROR
    }
    case H2_FRAME_PING:
      if (onStream) {
        return H2_PROTOCOL_ERROR
      }
      return frame.length === 8 ? H2_NO_ERROR : H2_FRAME_SIZE_ERROR
    case H2_FRAME_GOAWAY:
      if (onStream) {
        return H2_PROTOCOL_ERROR
      }
      if (frame.length < 8) {
        return H2_FRAME_SIZE_ERROR
      }
      // The 8 bytes are inside the window checked above, so the sums fit an
      // `i32` and -1 cannot come back.
      frame.lastStreamId = http2FrameU31(buf, p)
      frame.errorCode = http2FrameU32(buf, http2FrameAdd(p, 4))
      frame.contentStart = http2FrameAdd(p, 8)
      frame.contentLength = http2FrameAdd(frame.length, -8)
      return frame.lastStreamId < 0 || frame.errorCode < toI64(0) ? H2_FRAME_SIZE_ERROR : H2_NO_ERROR
    case H2_FRAME_WINDOW_UPDATE:
      if (frame.length !== 4) {
        return H2_FRAME_SIZE_ERROR
      }
      // The four bytes are inside the window checked above; -1 cannot come back.
      frame.increment = http2FrameU31(buf, p)
      if (frame.increment < 0) {
        return H2_FRAME_SIZE_ERROR
      }
      if (frame.increment === 0) {
        if (!onStream) {
          return H2_PROTOCOL_ERROR
        }
        frame.streamError = H2_PROTOCOL_ERROR
      }
      return H2_NO_ERROR
    case H2_FRAME_CONTINUATION:
      return onStream ? H2_NO_ERROR : H2_PROTOCOL_ERROR
    default:
      return H2_NO_ERROR
  }
}

/**
 * How many settings a SETTINGS frame `http2ParseFrame` accepted carries.
 *
 * @param frame The SETTINGS frame just parsed.
 * @returns The payload's length over six: 0 for an ACK or an empty SETTINGS.
 */
export const http2SettingCount = (frame: Http2Frame): i32 => frame.length / H2_SETTING_SIZE

/**
 * Where setting `k` of the SETTINGS frame in `buf` starts, or -1 for a `k`
 * outside the frame's settings or six bytes not all inside `buf`. Summed in
 * `i64`, where a `k` from any `i32` cannot wrap it.
 */
const http2SettingAt = (frame: Http2Frame, buf: u8[], k: i32): i32 => {
  if (k < 0 || k >= http2SettingCount(frame)) {
    return -1
  }
  // `k` is below the count, so the widened product and sum cannot wrap.
  const at: i64 = toI64(frame.payload) + toI64(k) * toI64(H2_SETTING_SIZE)
  if (at < toI64(0) || at > toI64(buf.length) - toI64(H2_SETTING_SIZE)) {
    return -1
  }
  return toI32(at)
}

/**
 * The identifier of setting `k` of the SETTINGS frame in `buf`.
 *
 * @param frame The SETTINGS frame `http2ParseFrame` accepted.
 * @param buf The buffer that frame was read from, unchanged since.
 * @param k Which setting, 0 to `http2SettingCount(frame)` − 1.
 * @returns The 16-bit identifier, 0 to 65,535: an `H2_SETTINGS_*`, or one this module does not know; -1
 *   for a `k` outside 0 to `http2SettingCount(frame)` − 1, or a setting not inside `buf`.
 */
export const http2SettingId = (frame: Http2Frame, buf: u8[], k: i32): i32 => {
  const at: i32 = http2SettingAt(frame, buf, k)
  // `http2SettingAt` answers -1 or an offset below `length - 5`, so `at + 1` cannot wrap.
  if (at < 0 || at >= toI32(buf.length) - 1) {
    return -1
  }
  return (toI32(buf[at]) << 8) | toI32(buf[at + 1])
}

/**
 * The value of setting `k` of the SETTINGS frame in `buf`.
 *
 * @param frame The SETTINGS frame `http2ParseFrame` accepted.
 * @param buf The buffer that frame was read from, unchanged since.
 * @param k Which setting, 0 to `http2SettingCount(frame)` − 1.
 * @returns The value as sent, 0 to 2^32 − 1, not yet checked: `http2SettingError` checks it; -1 for a `k`
 *   outside 0 to `http2SettingCount(frame)` − 1, or a setting not inside `buf`.
 */
export const http2SettingValue = (frame: Http2Frame, buf: u8[], k: i32): i64 => {
  const at: i32 = http2SettingAt(frame, buf, k)
  // `http2SettingAt` answers -1 or an offset below `length - 5`, so `at + 2` cannot wrap.
  return at < 0 ? toI64(-1) : http2FrameU32(buf, http2FrameAdd(at, 2))
}

/**
 * The connection error a setting's value is, or 0 (§6.5.2, RFC 8441 §3). A
 * setting this module does not know is not an error: §6.5.2 says it is
 * ignored.
 *
 * @param id The setting's identifier, as `http2SettingId` reads it.
 * @param value The setting's value, as `http2SettingValue` reads it, 0 to 2^32 − 1.
 * @returns `H2_PROTOCOL_ERROR` for an ENABLE_PUSH or ENABLE_CONNECT_PROTOCOL above 1 or a MAX_FRAME_SIZE
 *   outside 2^14 to 2^24 − 1; `H2_FLOW_CONTROL_ERROR` for an INITIAL_WINDOW_SIZE above 2^31 − 1;
 *   otherwise 0, every other identifier included.
 */
export const http2SettingError = (id: i32, value: i64): i32 => {
  switch (id) {
    case H2_SETTINGS_ENABLE_PUSH:
    case H2_SETTINGS_ENABLE_CONNECT_PROTOCOL:
      return value > toI64(1) ? H2_PROTOCOL_ERROR : H2_NO_ERROR
    case H2_SETTINGS_INITIAL_WINDOW_SIZE:
      return value > toI64(H2_MAX_WINDOW) ? H2_FLOW_CONTROL_ERROR : H2_NO_ERROR
    case H2_SETTINGS_MAX_FRAME_SIZE:
      return value < toI64(H2_DEFAULT_MAX_FRAME) || value > toI64(H2_MAX_FRAME_LIMIT)
        ? H2_PROTOCOL_ERROR
        : H2_NO_ERROR
    default:
      return H2_NO_ERROR
  }
}

/**
 * Writes a frame header at `out[at]` for a payload of `length` bytes, and
 * answers where the payload goes, or -1 when the header and the payload would
 * not both fit. It checks no type's rules: the payload is the caller's to write.
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param length The payload's length in bytes, 0 to 2^24 − 1; outside that panics.
 * @param type The frame type byte, an `H2_FRAME_*` or another 0 to 255; only its low 8 bits are written.
 * @param flags The flags byte, unchecked; only its low 8 bits are written.
 * @param streamId The stream identifier, 0 for the connection, to 2^31 − 1; a negative one panics.
 * @returns `at + 9`, where the payload goes, or -1 when `out` has no room for the header and `length`
 *   bytes after it, `out` then unchanged.
 */
export const http2WriteHeader = (
  out: u8[],
  at: i32,
  length: i32,
  type: i32,
  flags: i32,
  streamId: i32
): i32 => {
  http2FrameCheckStream("http2WriteHeader", streamId)
  if (at < 0 || length < 0 || length > H2_MAX_FRAME_LIMIT) {
    panic(`http2WriteHeader: a frame of ${length} bytes at ${at}`)
  }
  // With room for the header, `at` is below `length - 8`: the nine bytes are
  // inside `out` and `at + 9` cannot wrap.
  if (
    toI64(at) + toI64(H2_FRAME_HEADER_SIZE) + toI64(length) > toI64(out.length) ||
    at >= toI32(out.length) - 8
  ) {
    return -1
  }
  out[at] = toU8((length >> 16) & 255)
  out[at + 1] = toU8((length >> 8) & 255)
  out[at + 2] = toU8(length & 255)
  out[at + 3] = toU8(type)
  out[at + 4] = toU8(flags)
  out[at + 5] = toU8((streamId >> 24) & 255)
  out[at + 6] = toU8((streamId >> 16) & 255)
  out[at + 7] = toU8((streamId >> 8) & 255)
  out[at + 8] = toU8(streamId & 255)
  return at + H2_FRAME_HEADER_SIZE
}

/**
 * The shared shape of DATA, HEADERS, PUSH_PROMISE and CONTINUATION: the
 * header, the Pad Length when `pad` is 0 to 255 (-1 for none), `fixed` bytes
 * the caller fills just before the content, the content and
 * the padding. Answers the offset after the frame, or -1.
 */
const http2FrameWritePadded = (
  out: u8[],
  at: i32,
  type: i32,
  flags: i32,
  streamId: i32,
  fixed: i32,
  src: u8[],
  off: i32,
  len: i32,
  pad: i32
): i32 => {
  http2FrameCheckWindow("http2Write", src, off, toI64(len))
  if (pad > 255) {
    panic(`http2Write: ${pad} bytes of padding, past 255`)
  }
  const padded: boolean = pad >= 0
  // `fixed` is 0 or 4, `pad` -1 to 255 and `len` 0 to 2^31 − 1, so the widened sums cannot wrap.
  const head: i32 = padded ? toI32(toI64(fixed) + toI64(1)) : fixed
  const tail: i32 = padded ? pad : H2_FRAME_ZERO
  const total: i64 = toI64(head) + toI64(len) + toI64(tail)
  const at2: i32 = http2WriteHeader(
    out,
    at,
    http2FrameLength(total),
    type,
    padded ? flags | H2_FLAG_PADDED : flags & ~H2_FLAG_PADDED,
    streamId
  )
  if (at2 < 0) {
    return -1
  }
  // `http2WriteHeader` found room for `total` bytes from `at2`, so every
  // offset below is inside `out` and fits an `i32`.
  const body: i32 = toI32(toI64(at2) + toI64(head))
  const end: i32 = toI32(toI64(body) + toI64(len) + toI64(tail))
  if (padded) {
    if (at2 >= toI32(out.length)) {
      return -1
    }
    out[at2] = toU8(pad)
  }
  if (!tryCopyBytes(out, body, src, off, len)) {
    return -1
  }
  out.fill(0, toI32(toI64(body) + toI64(len)), end)
  return end
}

/**
 * Writes a DATA frame of `src[off, off + len)` on `streamId`, with `flags` (END_STREAM) and `pad` bytes of
 * padding, -1 for none (§6.1).
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param streamId The stream the data belongs to, 1 to 2^31 − 1; 0 or a negative identifier panics.
 * @param src The buffer holding the data; copied, not kept.
 * @param off Where the data starts in `src`.
 * @param len The data's length in bytes; `[off, off + len)` outside `src` panics, and so does a
 *   payload past 2^24 − 1 bytes. Keeping it within the peer's SETTINGS_MAX_FRAME_SIZE is the caller's.
 * @param flags `H2_FLAG_END_STREAM` or 0; any other bit is dropped.
 * @param pad Bytes of zero padding, 0 to 255, or -1 (any negative) for none; past 255 panics. PADDED is
 *   set from it, never from `flags`.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WriteData = (
  out: u8[],
  at: i32,
  streamId: i32,
  src: u8[],
  off: i32,
  len: i32,
  flags: i32,
  pad: i32
): i32 => {
  if (streamId === 0) {
    panic("http2WriteData: DATA on stream 0")
  }
  return http2FrameWritePadded(
    out,
    at,
    H2_FRAME_DATA,
    flags & H2_FLAG_END_STREAM,
    streamId,
    H2_FRAME_ZERO,
    src,
    off,
    len,
    pad
  )
}

/**
 * Writes a HEADERS frame carrying the header block fragment `src[off, off +
 * len)` on `streamId`, with `flags` (END_STREAM, END_HEADERS) and `pad`
 * bytes of padding, -1 for none (§6.2). It never sets PRIORITY, which RFC
 * 9113 deprecates.
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param streamId The stream the headers open or belong to, 1 to 2^31 − 1; 0 or a negative identifier
 *   panics.
 * @param src The buffer holding the fragment; copied, not kept.
 * @param off Where the fragment starts in `src`.
 * @param len The fragment's length in bytes; `[off, off + len)` outside `src` panics, and so does a
 *   payload past 2^24 − 1 bytes. Keeping it within the peer's SETTINGS_MAX_FRAME_SIZE is the caller's.
 * @param flags `H2_FLAG_END_STREAM` and `H2_FLAG_END_HEADERS`, either or both or neither; any other bit
 *   is dropped.
 * @param pad Bytes of zero padding, 0 to 255, or -1 (any negative) for none; past 255 panics. PADDED is
 *   set from it, never from `flags`.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WriteHeaders = (
  out: u8[],
  at: i32,
  streamId: i32,
  src: u8[],
  off: i32,
  len: i32,
  flags: i32,
  pad: i32
): i32 => {
  if (streamId === 0) {
    panic("http2WriteHeaders: HEADERS on stream 0")
  }
  const allowed: i32 = H2_FLAG_END_STREAM | H2_FLAG_END_HEADERS
  return http2FrameWritePadded(
    out,
    at,
    H2_FRAME_HEADERS,
    flags & allowed,
    streamId,
    H2_FRAME_ZERO,
    src,
    off,
    len,
    pad
  )
}

/**
 * Writes a PRIORITY frame: `streamId` depends on `dependency`, exclusively or not, with `weight` 1 to 256
 * (§6.3).
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param streamId The stream whose priority this sets, 1 to 2^31 − 1; 0 or a negative identifier panics.
 * @param dependency The stream it depends on, 0 to 2^31 − 1; negative, or `streamId` itself, panics.
 * @param exclusive Whether the dependency is exclusive (§5.3.1).
 * @param weight The weight, 1 to 256, sent as one less; outside that panics.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WritePriority = (
  out: u8[],
  at: i32,
  streamId: i32,
  dependency: i32,
  exclusive: boolean,
  weight: i32
): i32 => {
  http2FrameCheckStream("http2WritePriority", dependency)
  if (streamId === 0 || streamId === dependency || weight < 1 || weight > 256) {
    panic(`http2WritePriority: stream ${streamId} on ${dependency} with weight ${weight}`)
  }
  const body: i32 = http2WriteHeader(out, at, 5, H2_FRAME_PRIORITY, H2_FRAME_ZERO, streamId)
  // With room for the 5 bytes, `body` is below `length - 4`, so `body + 5` cannot wrap.
  if (body < 0 || body >= toI32(out.length) - 4) {
    return -1
  }
  http2FramePut32(out, body, toI64(dependency) | (exclusive ? H2_FRAME_EXCLUSIVE : toI64(0)))
  // The check above put `weight` at 1 to 256.
  out[body + 4] = toU8(toU32(weight) - toU32(1))
  return body + 5
}

/**
 * Writes a RST_STREAM frame closing `streamId` with `code` (§6.4).
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param streamId The stream to close, 1 to 2^31 − 1; 0 or a negative identifier panics.
 * @param code The error code, an `H2_*` of §7 or another 32-bit value; only its low 32 bits are sent.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WriteRstStream = (out: u8[], at: i32, streamId: i32, code: i64): i32 => {
  if (streamId === 0) {
    panic("http2WriteRstStream: RST_STREAM on stream 0")
  }
  const body: i32 = http2WriteHeader(out, at, 4, H2_FRAME_RST_STREAM, H2_FRAME_ZERO, streamId)
  // With room for the 4 bytes, `body` is below `length - 3`, so `body + 4` cannot wrap.
  if (body < 0 || !http2FramePut32(out, body, code) || body >= toI32(out.length) - 3) {
    return -1
  }
  return body + 4
}

/**
 * Writes a SETTINGS frame of the settings `ids[k]` = `values[k]` (§6.5).
 * A value `http2SettingError` refuses panics, as two lists of different
 * lengths do.
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param ids The settings' identifiers, each 0 to 65,535, in the order sent; read, not kept.
 * @param values The settings' values, `values[k]` for `ids[k]`, each 0 to 2^32 − 1; read, not kept.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WriteSettings = (out: u8[], at: i32, ids: i32[], values: i64[]): i32 => {
  const n: i32 = toI32(ids.length)
  if (n !== toI32(values.length)) {
    panic(`http2WriteSettings: ${n} identifiers for ${values.length} values`)
  }
  for (let k: i32 = 0; k < n && k < toI32(ids.length) && k < toI32(values.length); k++) {
    if (
      ids[k] < 0 ||
      ids[k] > 65535 ||
      values[k] < toI64(0) ||
      values[k] > H2_FRAME_U32_MAX ||
      http2SettingError(ids[k], values[k]) !== H2_NO_ERROR
    ) {
      panic(`http2WriteSettings: setting ${ids[k]} = ${values[k]}`)
    }
  }
  // Summed in `i64`, where `n` settings cannot wrap.
  const total: i64 = toI64(n) * toI64(H2_SETTING_SIZE)
  const body: i32 = http2WriteHeader(
    out,
    at,
    http2FrameLength(total),
    H2_FRAME_SETTINGS,
    H2_FRAME_ZERO,
    H2_FRAME_ZERO
  )
  if (body < 0) {
    return -1
  }
  for (let k: i32 = 0; k < n && k < toI32(ids.length) && k < toI32(values.length); k++) {
    // Inside the `total` bytes `http2WriteHeader` found room for, so it fits an `i32`.
    const at2: i32 = toI32(toI64(body) + toI64(k) * toI64(H2_SETTING_SIZE))
    // Below `length - 5`, so `at2 + 2` cannot wrap.
    if (at2 < 0 || at2 >= toI32(out.length) - 5) {
      return -1
    }
    out[at2] = toU8((ids[k] >> 8) & 255)
    out[at2 + 1] = toU8(ids[k] & 255)
    if (!http2FramePut32(out, at2 + 2, values[k])) {
      return -1
    }
  }
  return toI32(toI64(body) + toI64(n) * toI64(H2_SETTING_SIZE))
}

/**
 * Writes the empty SETTINGS frame with ACK that acknowledges the peer's (§6.5.3).
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WriteSettingsAck = (out: u8[], at: i32): i32 =>
  http2WriteHeader(out, at, H2_FRAME_ZERO, H2_FRAME_SETTINGS, H2_FLAG_ACK, H2_FRAME_ZERO)

/**
 * Writes a PUSH_PROMISE frame on `streamId` reserving `promisedId`, carrying
 * the header block fragment `src[off, off + len)`, with `flags`
 * (END_HEADERS) and `pad` bytes of padding, -1 for none (§6.6).
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param streamId The stream of the request the promise answers, 1 to 2^31 − 1; 0 or a negative
 *   identifier panics.
 * @param promisedId The stream reserved for the push, 1 to 2^31 − 1; 0 or a negative identifier panics.
 * @param src The buffer holding the fragment; copied, not kept.
 * @param off Where the fragment starts in `src`.
 * @param len The fragment's length in bytes; `[off, off + len)` outside `src` panics, and so does a
 *   payload past 2^24 − 1 bytes. Keeping it within the peer's SETTINGS_MAX_FRAME_SIZE is the caller's.
 * @param flags `H2_FLAG_END_HEADERS` or 0; any other bit is dropped.
 * @param pad Bytes of zero padding, 0 to 255, or -1 (any negative) for none; past 255 panics. PADDED is
 *   set from it, never from `flags`.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WritePushPromise = (
  out: u8[],
  at: i32,
  streamId: i32,
  promisedId: i32,
  src: u8[],
  off: i32,
  len: i32,
  flags: i32,
  pad: i32
): i32 => {
  http2FrameCheckStream("http2WritePushPromise", promisedId)
  if (streamId === 0 || promisedId === 0) {
    panic(`http2WritePushPromise: stream ${streamId} promising ${promisedId}`)
  }
  const end: i32 = http2FrameWritePadded(
    out,
    at,
    H2_FRAME_PUSH_PROMISE,
    flags & H2_FLAG_END_HEADERS,
    streamId,
    4,
    src,
    off,
    len,
    pad
  )
  // The frame was written from `at`, so the field's offset is inside `out` and fits an `i32`.
  const field: i64 = toI64(at) + toI64(H2_FRAME_HEADER_SIZE) + toI64(pad >= 0 ? H2_FRAME_ONE : H2_FRAME_ZERO)
  if (end < 0 || !http2FramePut32(out, toI32(field), toI64(promisedId))) {
    return -1
  }
  return end
}

/**
 * Writes a PING frame of the eight bytes `opaque[off, off + 8)`, an ACK when `ack` (§6.7).
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param opaque The buffer holding the eight bytes; copied, not kept.
 * @param off Where the eight bytes start in `opaque`; `[off, off + 8)` outside it panics.
 * @param ack Whether this answers the peer's PING, its bytes echoed, rather than asking.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WritePing = (out: u8[], at: i32, opaque: u8[], off: i32, ack: boolean): i32 => {
  http2FrameCheckWindow("http2WritePing", opaque, off, toI64(8))
  const body: i32 = http2WriteHeader(out, at, 8, H2_FRAME_PING, ack ? H2_FLAG_ACK : 0, H2_FRAME_ZERO)
  // With room for the 8 bytes, `body` is below `length - 7`, so `body + 8` cannot wrap.
  if (body < 0 || body >= toI32(out.length) - 7 || !tryCopyBytes(out, body, opaque, off, 8)) {
    return -1
  }
  return body + 8
}

/**
 * Writes a GOAWAY frame naming `lastStreamId` and `code`, with the debug data `debug[off, off + len)`
 * (§6.8).
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param lastStreamId The highest peer-opened stream this side may have processed, 0 to 2^31 − 1; a
 *   negative one panics.
 * @param code The error code, an `H2_*` of §7 or another 32-bit value; only its low 32 bits are sent.
 * @param debug The buffer holding the debug data; copied, not kept.
 * @param off Where the debug data starts in `debug`.
 * @param len The debug data's length in bytes, 0 for none; `[off, off + len)` outside `debug` panics,
 *   and so does a payload past 2^24 − 1 bytes.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WriteGoaway = (
  out: u8[],
  at: i32,
  lastStreamId: i32,
  code: i64,
  debug: u8[],
  off: i32,
  len: i32
): i32 => {
  http2FrameCheckStream("http2WriteGoaway", lastStreamId)
  http2FrameCheckWindow("http2WriteGoaway", debug, off, toI64(len))
  // `len` is 0 to 2^31 − 1, so the sum fits an `i64`.
  const total: i64 = toI64(8) + toI64(len)
  const body: i32 = http2WriteHeader(
    out,
    at,
    http2FrameLength(total),
    H2_FRAME_GOAWAY,
    H2_FRAME_ZERO,
    H2_FRAME_ZERO
  )
  // With room for `total` bytes, `body` is below `length - 7`, so `body + 4`
  // and `body + 8` cannot wrap, and `body + total` fits an `i32`.
  if (
    body < 0 ||
    body >= toI32(out.length) - 7 ||
    !http2FramePut32(out, body, toI64(lastStreamId)) ||
    !http2FramePut32(out, body + 4, code) ||
    !tryCopyBytes(out, body + 8, debug, off, len)
  ) {
    return -1
  }
  return toI32(toI64(body) + toI64(8) + toI64(len))
}

/**
 * Writes a WINDOW_UPDATE frame adding `increment`, 1 to 2^31 − 1, to `streamId`'s window, or the
 * connection's for 0 (§6.9).
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param streamId The stream whose window widens, or 0 for the connection's; a negative one panics.
 * @param increment The bytes added to the window, 1 to 2^31 − 1; below 1 panics.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WriteWindowUpdate = (out: u8[], at: i32, streamId: i32, increment: i32): i32 => {
  if (increment < 1) {
    panic(`http2WriteWindowUpdate: an increment of ${increment}`)
  }
  const body: i32 = http2WriteHeader(out, at, 4, H2_FRAME_WINDOW_UPDATE, H2_FRAME_ZERO, streamId)
  // With room for the 4 bytes, `body` is below `length - 3`, so `body + 4` cannot wrap.
  if (body < 0 || body >= toI32(out.length) - 3 || !http2FramePut32(out, body, toI64(increment))) {
    return -1
  }
  return body + 4
}

/**
 * Writes a CONTINUATION frame of the header block fragment `src[off, off + len)`, with `flags`
 * (END_HEADERS) (§6.10). It is never padded.
 *
 * @param out The buffer the frame is written into.
 * @param at Where the frame starts in `out`; a negative offset panics.
 * @param streamId The stream whose header block this continues, 1 to 2^31 − 1; 0 or a negative
 *   identifier panics.
 * @param src The buffer holding the fragment; copied, not kept.
 * @param off Where the fragment starts in `src`.
 * @param len The fragment's length in bytes; `[off, off + len)` outside `src` panics, and so does a
 *   payload past 2^24 − 1 bytes. Keeping it within the peer's SETTINGS_MAX_FRAME_SIZE is the caller's.
 * @param flags `H2_FLAG_END_HEADERS` or 0; any other bit is dropped.
 * @returns The offset just past the frame in `out`, or -1 when it would not fit, `out` then unchanged.
 */
export const http2WriteContinuation = (
  out: u8[],
  at: i32,
  streamId: i32,
  src: u8[],
  off: i32,
  len: i32,
  flags: i32
): i32 => {
  if (streamId === 0) {
    panic("http2WriteContinuation: CONTINUATION on stream 0")
  }
  return http2FrameWritePadded(
    out,
    at,
    H2_FRAME_CONTINUATION,
    flags & H2_FLAG_END_HEADERS,
    streamId,
    H2_FRAME_ZERO,
    src,
    off,
    len,
    H2_FRAME_NONE
  )
}
