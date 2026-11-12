/**
 * `nish/net/http1-codec` — an incremental HTTP/1.1 request parser and a response
 * writer, sans-IO: bytes in, events and bytes out, and no socket anywhere.
 *
 * **The parser** is a push-pull machine. A caller `feed`s whatever slice the
 * socket gave it, of any length and cut anywhere, and then calls `next()`
 * until it answers `HTTP1_NEED_MORE`:
 *
 *     import { Http1Parser, HTTP1_NEED_MORE, HTTP1_HEAD, HTTP1_BODY, HTTP1_END, HTTP1_ERROR } from "nish/net/http1-codec";
 *
 *     const p = new Http1Parser(maxTarget, maxHeaderBytes, maxHeaders, maxBody);
 *     p.feed(received, 0, n);
 *     let event: i32 = p.next();
 *     while (event !== HTTP1_NEED_MORE) {
 *       // HTTP1_HEAD: p.method, p.target, p.header("host"), ...
 *       // HTTP1_BODY: p.body[p.bodyOff .. p.bodyOff + p.bodyLen)
 *       // HTTP1_ERROR: answer p.status and close
 *       event = p.next();
 *     }
 *
 * The events are `HTTP1_HEAD` (the request line and header section are in),
 * `HTTP1_BODY` (some body bytes, de-chunked), `HTTP1_END` (the message is
 * complete; with keep-alive the next request follows), `HTTP1_UPGRADE` (the
 * request asked to switch protocols and has ended: the bytes after it are not
 * HTTP), `HTTP1_CLOSED` (the request said `Connection: close`, so nothing
 * after it is read) and `HTTP1_ERROR` (with the status to answer in `status`).
 * The last three repeat on every later call. Only complete lines are acted on
 * and body bytes are counted, never guessed, so the sequence of heads, the
 * concatenated body and the final event do not depend on where the input was
 * cut — `tests/link/net_http1_split` feeds a corpus at every split point.
 *
 * **What it refuses, and with what** (RFC 9112 unless named):
 *
 * - 400: a malformed request line or field line; a bare LF or a stray CR
 *   (§2.2); whitespace before the first field or an obs-fold (§2.2, §5.2);
 *   whitespace between a field name and its colon (§5.1); a field value with a
 *   control character; a 1.1 request without exactly one `Host`, or a 1.0
 *   request with more than one (§3.2, RFC 9110 §7.2); `Content-Length` that is
 *   not one run of digits, or that appears twice (§6.3); `Transfer-Encoding`
 *   together with `Content-Length`, in a 1.0 request, or whose last coding is
 *   not `chunked` (§6.1, §6.3); a malformed chunk size, chunk extension or
 *   chunk terminator (§7.1). These are the request-smuggling shapes, and each
 *   one is refused rather than repaired, because two parsers that repair one
 *   differently disagree on where the next request starts.
 * - 413: a declared or a de-chunked body longer than `maxBody`.
 * - 414: a request target longer than `maxTarget`.
 * - 431: a header (or trailer) section longer than `maxHeaderBytes`, or with
 *   more than `maxHeaders` fields.
 * - 501: a transfer coding other than `chunked` (§6.1).
 * - 505: an HTTP major version other than 1. A 1.x minor version above 1 is
 *   read as 1.1, as RFC 9110 §6.2 asks.
 *
 * An error is final: the parser answers `HTTP1_ERROR` from then on and
 * ignores further input, and the caller answers `status` and closes. Every
 * limit is the caller's number. A method is at most `HTTP1_MAX_METHOD` bytes.
 *
 * **Connection management.** `keepAlive` is true for a 1.1 request unless
 * `Connection` lists `close`, and for a 1.0 request only when it lists
 * `keep-alive` (§9.3). `upgrade` is the `Upgrade` field's value when a 1.1
 * request also lists `upgrade` in `Connection`, and empty otherwise (RFC 9110
 * §7.8 says a 1.0 request's `Upgrade` is ignored). After such a request's
 * `HTTP1_END` the parser stops at `HTTP1_UPGRADE`; `upgradeBytes()` answers
 * what was fed past the request, for the next protocol, and `declineUpgrade()`
 * goes back to HTTP for a server that answered without switching.
 *
 * **The writer** is `http1ResponseHead`, which answers a status line and
 * header section with the framing field the body needs, and `http1Chunk` and
 * `http1LastChunk` for a chunked body. It refuses (`null`) anything that would
 * let a caller's string end a line early — the response-splitting shape.
 * `http1WriteResponseHead` writes the same head into a caller's buffer with
 * nothing allocated, and adds a `Date` field from the bytes it is given
 * (`httpDateWrite` in `nish/net/http-fields` makes them) to a final response.
 *
 * Field names are kept in lowercase, the form RFC 9110 §5.1 says they compare
 * in and the form HTTP/2 sends them in. Strings in the language are bytes, so a
 * field value holding obs-text (0x80 to 0xFF) arrives byte for byte.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9112 and RFC 9110, not ported from another implementation.
 */
import { copyBytes } from "nish/bytes"
import {
  and,
  any,
  bitmask,
  eq,
  gt,
  loadU8x16,
  lt,
  mask8x16,
  ne,
  or,
  replace,
  select,
  splatU8x16,
  store,
  subWrapping,
  u8x16,
} from "nish:simd"

/** `next()`: the input so far holds no further event; feed more. */
export const HTTP1_NEED_MORE: i32 = 0
/** `next()`: a request line and header section were read. */
export const HTTP1_HEAD: i32 = 1
/** `next()`: `bodyLen` body bytes are at `body[bodyOff ..]`, valid until the next `feed`. */
export const HTTP1_BODY: i32 = 2
/**
 * `next()`: the request's body is complete. Its head (method, target,
 * version, fields, `keepAlive`) still reads as this request's until the next
 * call to `next()`, so a response written at `HTTP1_END` sees the request it
 * answers and never the pipelined one behind it.
 */
export const HTTP1_END: i32 = 3
/** `next()`, from now on: the request switched protocols; see `upgradeBytes()`. */
export const HTTP1_UPGRADE: i32 = 4
/** `next()`, from now on: the request closed the connection; nothing more is read. */
export const HTTP1_CLOSED: i32 = 5
/** `next()`, from now on: the input is refused; `status` and `reason` say why. */
export const HTTP1_ERROR: i32 = 6

/** The longest method this parser reads; a longer one is a 400. */
export const HTTP1_MAX_METHOD: i32 = 32

/** `http1ResponseHead`'s `bodyLength` for a chunked body. */
export const HTTP1_CHUNKED: i32 = -1
/** `http1ResponseHead`'s `bodyLength` for a response that carries no body field (1xx, 204, 304, HEAD). */
export const HTTP1_NO_BODY: i32 = -2

/** `limit` clamped into 0 to 2^30. */
const http1Clamp = (limit: i32): i32 => {
  if (limit < 0) {
    return 0
  }
  return limit > 1073741824 ? 1073741824 : limit
}

// The parser's states, one per kind of thing it is waiting for.
const HTTP1_S_REQUEST_LINE: i32 = 0
const HTTP1_S_FIELDS: i32 = 1
const HTTP1_S_LENGTH_BODY: i32 = 2
const HTTP1_S_CHUNK_SIZE: i32 = 3
const HTTP1_S_CHUNK_DATA: i32 = 4
const HTTP1_S_CHUNK_CRLF: i32 = 5
const HTTP1_S_TRAILERS: i32 = 6
const HTTP1_S_MESSAGE_END: i32 = 7
const HTTP1_S_UPGRADED: i32 = 8
const HTTP1_S_CLOSED: i32 = 9
const HTTP1_S_ERROR: i32 = 10

/**
 * What `http1Tally` found in a comma-separated list: how many elements it
 * has, how many of them are the word asked about, and whether the last is.
 */
class Http1ListTally {
  /**
   * How many elements the list has.
   * @internal Written by `http1Tally` and read by the field checks in this module.
   */
  elements: i32 = 0
  /**
   * How many elements are the word asked about.
   * @internal Written by `http1Tally` and read by the field checks in this module.
   */
  matches: i32 = 0
  /**
   * Whether the last element is the word asked about.
   * @internal Written by `http1Tally` and read by the field checks in this module.
   */
  lastMatches: boolean = false
}

/**
 * One connection's request parser, from the first byte to the close: requests
 * on a kept-alive connection follow one another through the same parser.
 */
export class Http1Parser {
  // The fields a request reads come first, so that a kept-alive connection
  // whose parser has gone cold between requests brings back two or three
  // cache lines of it, not all four: the buffers, then the offsets `feed`,
  // `buffered`, `http1TakeLine` and the head's lines move, then the flags,
  // then the rest of the request's numbers and the caller's limits. What only
  // `keepText`, an error or a chunked body reads follows. Each group packs as
  // widest first does, and the flags' two bytes of padding are the only ones
  // inside it: its fields sum to 228 bytes, which round to 232.

  // --- the request's buffers -------------------------------------------------
  /**
   * The bytes fed and not yet consumed are `buf[start .. end)`.
   * @internal Filled by `feed` in this module, and swapped for a pooled buffer
   * by std/net/http1-server.ts when it parks or resumes the input; written
   * directly by bench/http1-conn.
   */
  buf: u8[]
  /**
   * The request line and the kept field lines of the request, copied out of
   * `buf` as each is read, names in lowercase: what the spans below index.
   * Kept from one request to the next, so a slot that has seen its largest
   * head allocates nothing for the next one.
   */
  head: u8[]
  /** Four entries per field, into `head`: name start and end, value start and end (OWS trimmed). */
  spans: i32[]
  /** The buffer the last `HTTP1_BODY`'s bytes are in, at `bodyOff`, `bodyLen` long. */
  body: u8[]

  // --- where the parser is ----------------------------------------------------
  /**
   * Where the unconsumed input starts in `buf`.
   * @internal Moved by the parser's free functions in this module, and reset by
   * std/net/http1-server.ts when it parks the input buffer, and read there to
   * hand the bytes after an upgrade to the WebSocket reader.
   */
  start: i32 = 0
  /**
   * Where the unconsumed input ends in `buf`.
   * @internal Moved by `feed` in this module, reset by
   * std/net/http1-server.ts when it parks the input buffer, and moved directly
   * by bench/http1-conn.
   */
  end: i32 = 0
  /**
   * Where the search for the next LF resumes, so a line fed a byte at a time is scanned once.
   * @internal Moved by `http1TakeLine` in this module, and reset by
   * std/net/http1-server.ts when it parks the input buffer.
   */
  scan: i32 = 0
  /**
   * Which kind of thing the parser waits for, one of the `HTTP1_S_` states.
   * @internal Read and written by the parser's free functions in this module to drive the state machine.
   */
  state: i32 = 0
  /**
   * The line `http1TakeLine` found is `buf[lineStart .. lineEnd)`, its CRLF dropped.
   * @internal Set by `http1TakeLine` in this module, and reset by
   * std/net/http1-server.ts when it parks the input buffer.
   */
  lineStart: i32 = 0
  /**
   * Where the line `http1TakeLine` found ends, before its CRLF.
   * @internal Set by `http1TakeLine` in this module, and reset by
   * std/net/http1-server.ts when it parks the input buffer.
   */
  lineEnd: i32 = 0
  /** How many fields the request's header section kept: the spans of field `i` are `spans[4 * i ..]`. */
  headerCount: i32 = 0
  /** How much of `head` the request uses. */
  headLength: i32 = 0
  /**
   * Whether the line being scanned holds a byte a field value may not: a
   * control byte other than HTAB, or DEL (RFC 9110 §5.5). `http1TakeLine`
   * sets it as it looks for the line's end, so a field line's bytes are read
   * once, not once for the LF and again for the check.
   * @internal Set by `http1TakeLine` and read by the field-line parser in this module.
   */
  lineControl: boolean = false
  /** Whether the request's body is chunked (`Transfer-Encoding: chunked`), so it has no `contentLength`. */
  chunked: boolean = false
  /**
   * Whether the connection stays open after this request: HTTP/1.1 unless it
   * sent `Connection: close`, HTTP/1.0 only when it sent `keep-alive`. A
   * server closes after its response when this is false.
   */
  keepAlive: boolean = false
  /** Whether the request asked to switch protocols (`upgrade` is its value when `keepText`). */
  upgrading: boolean = false
  /**
   * Whether a kept-alive request ended and its head is still held for the
   * response: the next `next()` clears it before it reads a byte more.
   * @internal Read and written by the parser's free functions in this module to keep a finished request's head readable.
   */
  headHeld: boolean = false
  /**
   * Whether `method`, `target`, `names`, `values` and `upgrade` are filled as
   * strings. A server that must allocate nothing per request turns it off and
   * reads the head through `head`, the spans and the `...Is` methods.
   */
  keepText: boolean = true

  // --- the request's numbers: valid from its `HTTP1_HEAD` until the `next()` after its `HTTP1_END`
  /**
   * Bytes of the header or trailer section so far, against `maxHeaderBytes`.
   * @internal Read and written by the parser's free functions in this module to enforce the 431 limit.
   */
  sectionBytes: i32 = 0
  /**
   * Field lines of the request so far, its trailers included, against `maxHeaders`.
   * @internal Read and written by the parser's free functions in this module to enforce the 431 limit.
   */
  fieldCount: i32 = 0
  /**
   * Host fields the request's head has kept so far.
   * @internal Counted by the field-line parser in this module as each name is lowered, and read by `http1EndOfHead`.
   */
  hostFields: i32 = 0
  /**
   * Content-Length fields the request's head has kept so far.
   * @internal Counted by the field-line parser in this module, and read by `http1EndOfHead`.
   */
  lengthFields: i32 = 0
  /**
   * The index of the last Content-Length field, or -1.
   * @internal Set by the field-line parser in this module, and read by `http1EndOfHead`.
   */
  lengthField: i32 = -1
  /**
   * Transfer-Encoding fields the request's head has kept so far.
   * @internal Counted by the field-line parser in this module, and read by `http1EndOfHead`.
   */
  codingFields: i32 = 0
  /**
   * Upgrade fields the request's head has kept so far.
   * @internal Counted by the field-line parser in this module, and read by `http1EndOfHead`.
   */
  upgradeFields: i32 = 0
  /**
   * The bytes of the Upgrade fields' values, OWS trimmed, summed.
   * @internal Counted by the field-line parser in this module, and read by `http1EndOfHead`.
   */
  upgradeValueBytes: i32 = 0
  /**
   * The `HTTP1_CONNECTION_` options the Connection fields so far name.
   * @internal Gathered by the field-line parser in this module as each Connection field is read, and read by `http1EndOfHead`.
   */
  connectionOptions: i32 = 0
  /** The minor version: 0 for HTTP/1.0, 1 for HTTP/1.1 and anything above it. */
  minor: i32 = 1
  /**
   * Bytes left in a length-delimited body or in the current chunk.
   * @internal Read and written by the parser's free functions in this module to count body bytes rather than guess them.
   */
  left: i32 = 0
  /** The declared body length, or -1 when the request has none or is chunked. */
  contentLength: i32 = -1
  /** Where the bytes the last `HTTP1_BODY` handed over start in `body`. */
  bodyOff: i32 = 0
  /** How many bytes the last `HTTP1_BODY` handed over, from `body[bodyOff]`; 0 before the first. */
  bodyLen: i32 = 0
  /** The method is `head[methodStart .. methodEnd)` and the target `head[targetStart .. targetEnd)`. */
  methodStart: i32 = 0
  /** Where the method ends in `head`, one past its last byte. */
  methodEnd: i32 = 0
  /** Where the request target starts in `head`. */
  targetStart: i32 = 0
  /** Where the request target ends in `head`, one past its last byte. */
  targetEnd: i32 = 0

  // --- limits, the caller's --------------------------------------------------
  /**
   * The longest request target, in bytes, before a 414.
   * @internal Set by the constructor and read by the request-line parser in this module.
   */
  maxTarget: i32 = 0
  /**
   * The longest header or trailer section, in bytes, before a 431.
   * @internal Set by the constructor and read by the field-line parser in this module.
   */
  maxHeaderBytes: i32 = 0
  /**
   * The most field lines one request may carry, before a 431.
   * @internal Set by the constructor and read by the field-line parser in this module.
   */
  maxHeaders: i32 = 0
  /**
   * The longest body, declared or de-chunked, in bytes, before a 413.
   * @internal Set by the constructor and read by the body readers in this module.
   */
  maxBody: i32 = 0
  /** The most body bytes one `HTTP1_BODY` hands over; a caller's number, 2^30 unless set. */
  maxChunk: i32 = 1073741824

  // --- what `keepText`, an error or a chunked body reads ----------------------
  /** The request's method as text when `keepText` is on, else empty. */
  method: string = ""
  /** The request target (path and query) as text when `keepText` is on, else empty. */
  target: string = ""
  /** The field names, in lowercase, in the order they arrived; `values` beside them. */
  names: string[]
  /** The field values, in the order they arrived, each at its name's index in `names`; filled only when `keepText`. */
  values: string[]
  /** The `Upgrade` field when `Connection` asked for it, else empty. */
  upgrade: string = ""
  /** What was wrong, once `next()` said `HTTP1_ERROR`; for a log, not for the response. */
  reason: string = ""
  /**
   * Reused by every list `http1Tally` walks.
   * @internal Filled by `http1Tally` and read by the field checks in this module, so a list costs no allocation.
   */
  tally: Http1ListTally
  /** The status code to answer once `next()` said `HTTP1_ERROR`. */
  status: i32 = 0
  /**
   * De-chunked body bytes so far, against `maxBody`.
   * @internal Read and written by the parser's free functions in this module to enforce the 413 limit on a chunked body.
   */
  bodyTotal: i32 = 0

  /**
   * Each limit is clamped into 0 to 2^30, so that the sums the parser makes
   * of them (a request line is the method, the target and ten bytes more)
   * cannot overflow an `i32`.
   *
   * @param maxTarget the longest request target in bytes; a longer one is a 414
   * @param maxHeaderBytes the longest header or trailer section in bytes; a longer one is a 431
   * @param maxHeaders the most field lines a request may carry, trailers included; more is a 431
   * @param maxBody the longest body in bytes, declared or de-chunked; a longer one is a 413
   */
  constructor(maxTarget: i32, maxHeaderBytes: i32, maxHeaders: i32, maxBody: i32) {
    this.maxTarget = http1Clamp(maxTarget)
    this.maxHeaderBytes = http1Clamp(maxHeaderBytes)
    this.maxHeaders = http1Clamp(maxHeaders)
    this.maxBody = http1Clamp(maxBody)
    // The input and the head are made by the first byte fed and the first
    // head kept, at HTTP1_FIRST_INPUT and HTTP1_FIRST_HEAD bytes: a parser
    // that is built and never fed (a pool's spare slot) costs neither, and a
    // caller that lends them out between requests puts empty ones here.
    // The spans are made first: the arena places each block after the last,
    // so their header and first entries sit just behind the parser's fields
    // rather than behind four empty arrays.
    this.spans = new Array<i32>(64)
    this.buf = []
    this.body = this.buf
    this.head = []
    this.names = []
    this.values = []
    this.tally = new Http1ListTally()
    this.restart()
  }

  /**
   * Appends `data[off .. off + len)` to the input. A window outside `data`
   * panics, as the crypto modules' `update` does. Once the parser has closed
   * or refused, the input is dropped; once it has upgraded, it is kept for
   * `upgradeBytes()`.
   *
   * @param data the bytes the socket gave, which the parser copies and does not keep
   * @param off where in `data` the new bytes start
   * @param len how many bytes from `off` to append
   */
  feed(data: u8[], off: i32, len: i32): void {
    const size: i32 = toI32(data.length)
    if (off < 0 || len < 0 || off > size || len > size - off) {
      panic("Http1Parser: the window is outside the buffer")
    }
    if (this.state === HTTP1_S_CLOSED || this.state === HTTP1_S_ERROR) {
      return
    }
    http1Reserve(this, len)
    const buf: u8[] = this.buf
    const at: i32 = this.end
    // One move: http1Reserve made room for `len` bytes at `at`, and the
    // window was checked above.
    copyBytes(buf, at, data, off, len)
    this.end = at + len
  }

  /**
   * The next event the input holds; see the module comment.
   * @returns one of the `HTTP1_` events, `HTTP1_NEED_MORE` when the input must grow before anything more can happen
   */
  next(): i32 {
    return http1Next(this)
  }

  /**
   * The value of the first field named `name` (any case), or `null`. A field
   * that may repeat is read through the spans. The answer is a fresh string;
   * `headerIndex` and `headerIs` allocate nothing.
   *
   * @param name the field name to look for, compared in any case
   * @returns the first such field's value with its surrounding whitespace trimmed, or `null` when the request has none
   */
  header(name: string): string | null {
    const i: i32 = this.headerIndex(name)
    if (i < 0) {
      return null
    }
    if (this.keepText && i < toI32(this.values.length)) {
      return this.values[i]
    }
    const spans: i32[] = this.spans
    const at: i32 = 4 * i
    if (at + 3 >= toI32(spans.length)) {
      return null
    }
    return http1Text(this.head, spans[at + 2], spans[at + 3], false)
  }

  /**
   * The index of the first field named `name` (any case), or -1.
   * @param name the field name to look for, compared in any case
   * @returns which field it is, so its spans are `spans[4 * i ..]`, or -1 when the request has none
   */
  headerIndex(name: string): i32 {
    const spans: i32[] = this.spans
    const count: i32 = this.headerCount
    for (let i: i32 = 0; i < count && 4 * i + 1 < toI32(spans.length); i += 1) {
      if (http1HeadIs(this.head, spans[4 * i], spans[4 * i + 1], name, true)) {
        return i
      }
    }
    return -1
  }

  /**
   * Whether the first field named `name` (any case) has exactly the value `value`.
   * @param name the field name to look for, compared in any case
   * @param value the value to compare with, byte for byte
   * @returns true when that field exists and its trimmed value is `value`, with nothing allocated
   */
  headerIs(name: string, value: string): boolean {
    const i: i32 = this.headerIndex(name)
    const spans: i32[] = this.spans
    if (i < 0 || 4 * i + 3 >= toI32(spans.length)) {
      return false
    }
    return http1HeadIs(this.head, spans[4 * i + 2], spans[4 * i + 3], value, false)
  }

  /**
   * Whether the method is exactly `text` (methods are case-sensitive, RFC 9110 §9.1).
   * @param text the method to compare with, such as `"GET"`
   * @returns true when the request's method is those bytes in that case
   */
  methodIs(text: string): boolean {
    return http1HeadIs(this.head, this.methodStart, this.methodEnd, text, false)
  }

  /**
   * Whether the request target is exactly `text`.
   * @param text the target to compare with, such as `"/index.html"`
   * @returns true when the request's target is those bytes, compared without decoding
   */
  targetIs(text: string): boolean {
    return http1HeadIs(this.head, this.targetStart, this.targetEnd, text, false)
  }

  /**
   * Whether the request asked to switch to exactly `protocol` (any case): one
   * `Upgrade` field holding that one token, with `upgrade` in `Connection`.
   *
   * @param protocol the protocol token to look for, such as `"websocket"`, compared in any case
   * @returns true only when the request asks for that protocol and nothing else
   */
  upgradeIs(protocol: string): boolean {
    if (!this.upgrading) {
      return false
    }
    const spans: i32[] = this.spans
    let found: i32 = -1
    for (let i: i32 = 0; i < this.headerCount && 4 * i + 1 < toI32(spans.length); i += 1) {
      if (http1HeadIs(this.head, spans[4 * i], spans[4 * i + 1], "upgrade", false)) {
        if (found >= 0) {
          return false
        }
        found = i
      }
    }
    if (found < 0 || 4 * found + 3 >= toI32(spans.length)) {
      return false
    }
    return http1HeadIs(this.head, spans[4 * found + 2], spans[4 * found + 3], protocol, true)
  }

  /**
   * Whether the parser waits for a request line with nothing fed and unread,
   * so its input and head buffers hold nothing it needs: a caller may lend
   * them out and leave empty arrays in `buf`, `body` and `head`, which the
   * next feed and head make or the caller puts back first.
   *
   * @returns true when the parser holds no bytes it still needs, so its buffers may be lent out
   */
  resting(): boolean {
    return this.state === HTTP1_S_REQUEST_LINE && this.end === this.start && !this.headHeld
  }

  /**
   * How many bytes were fed and not consumed yet: what a caller bounds its reads by.
   * @returns the count of unread input bytes, at `buf[start ..]`
   */
  buffered(): i32 {
    return this.end - this.start
  }

  /**
   * After `HTTP1_UPGRADE`: every byte fed past the request, as a fresh array.
   * @returns a copy the caller owns of the bytes that belong to the next protocol, empty when none arrived yet
   */
  upgradeBytes(): u8[] {
    let n: i32 = this.end - this.start
    if (n < 0) {
      n = 0
    }
    const out: u8[] = new Array<u8>(n)
    const outLength: i32 = toI32(out.length)
    const buf: u8[] = this.buf
    const from: i32 = this.start
    for (let k: i32 = 0; k < outLength; k += 1) {
      out[k] = buf[from + k]
    }
    return out
  }

  /**
   * Puts the parser back as the constructor left it, for the next
   * connection, keeping every buffer it has grown: a slot that is reused
   * allocates nothing to start over.
   */
  restart(): void {
    this.start = 0
    this.end = 0
    this.scan = 0
    this.lineStart = 0
    this.lineEnd = 0
    this.bodyOff = 0
    this.left = 0
    this.status = 0
    this.reason = ""
    this.body = this.buf
    http1StartRequest(this)
  }

  /**
   * After `HTTP1_UPGRADE`: the server answered without switching, so the
   * bytes that follow are the next HTTP request. Anywhere else it does nothing.
   */
  declineUpgrade(): void {
    if (this.state === HTTP1_S_UPGRADED) {
      http1StartRequest(this)
    }
  }
}

/** The input buffer a parser makes on its first feed, the smallest it grows from. */
export const HTTP1_FIRST_INPUT: i32 = 1024
/** The head buffer a parser makes for its first head. */
export const HTTP1_FIRST_HEAD: i32 = 256

/** Makes room for `len` more bytes at `p.end`, moving the live bytes down first. */
const http1Reserve = (p: Http1Parser, len: i32): void => {
  const old: u8[] = p.buf
  const capacity: i32 = toI32(old.length)
  if (len <= capacity - p.end) {
    return
  }
  const live: i32 = p.end - p.start
  let size: i32 = capacity < HTTP1_FIRST_INPUT ? HTTP1_FIRST_INPUT : capacity
  while (size - live < len) {
    if (size > 1073741823) {
      panic("Http1Parser: more than 2^31 - 1 bytes buffered")
    }
    size = size * 2
  }
  // A fresh array when it has to grow, and the same one otherwise: either way
  // the live bytes move to the front, and every index into them moves too.
  const buf: u8[] = size === capacity ? old : new Array<u8>(size)
  const from: i32 = p.start
  if (live > 0) {
    // One move, overlapping when the buffer is the same one.
    copyBytes(buf, 0, old, from, live)
  }
  p.buf = buf
  p.lineStart -= from
  p.lineEnd -= from
  p.scan -= from
  p.start = 0
  p.end = live
}

/** Refuses the input with `status`. Answers `HTTP1_ERROR`, so a caller can `return` it. */
const http1Fail = (p: Http1Parser, status: i32, reason: string): i32 => {
  p.state = HTTP1_S_ERROR
  p.status = status
  p.reason = reason
  p.keepAlive = false
  return HTTP1_ERROR
}

/** Clears the per-request fields and waits for a request line. */
const http1StartRequest = (p: Http1Parser): void => {
  p.state = HTTP1_S_REQUEST_LINE
  p.method = ""
  p.target = ""
  p.minor = 1
  if (p.keepText) {
    p.names = []
    p.values = []
  }
  p.headLength = 0
  p.headerCount = 0
  p.methodStart = 0
  p.methodEnd = 0
  p.targetStart = 0
  p.targetEnd = 0
  p.contentLength = -1
  p.chunked = false
  p.keepAlive = false
  p.upgrading = false
  p.upgrade = ""
  p.bodyLen = 0
  p.bodyTotal = 0
  p.sectionBytes = 0
  p.fieldCount = 0
  p.hostFields = 0
  p.lengthFields = 0
  p.lengthField = -1
  p.codingFields = 0
  p.upgradeFields = 0
  p.upgradeValueBytes = 0
  p.connectionOptions = 0
  p.headHeld = false
}

/** `http1TakeLine`'s answer when a whole line is ready; never an event. */
const HTTP1_LINE: i32 = -1

/**
 * Finds the next line: answers `HTTP1_LINE` with it in `lineStart ..
 * lineEnd`, `HTTP1_NEED_MORE` when no LF has arrived yet, or the refusal. A line ends in CRLF and in
 * nothing else; a LF without its CR is a 400. A line that has not ended by
 * `limit` bytes is refused with `overStatus`. On the way it sets
 * `lineControl` when the line holds a byte no field value may, which
 * `http1FieldLine` reads instead of scanning the value again.
 */
const http1TakeLine = (p: Http1Parser, limit: i32, overStatus: i32): i32 => {
  const buf: u8[] = p.buf
  const end: i32 = p.end
  let i: i32 = p.start
  if (p.scan > p.start) {
    i = p.scan
  } else {
    p.lineControl = false
  }
  const stop: i32 = end < toI32(buf.length) ? end : toI32(buf.length)
  if (i < 0) {
    i = 0
  }
  while (i < stop) {
    // Most bytes are printable: sixteen at a time while a whole vector is,
    // and the vector that is not answers where its first control byte is.
    // The bytes after a control byte, and a tail shorter than a vector, go
    // one at a time.
    let found: boolean = false
    while (!found && i >= 0 && i <= stop - 16 && i <= toI32(buf.length) - 16) {
      const v: u8x16 = loadU8x16(buf, i)
      const bad: i32 = bitmask(or(lt(v, splatU8x16(32)), eq(v, splatU8x16(127))))
      if (bad !== 0) {
        i += toI32(31) - toI32(Math.clz32(toU32(bad & -bad)))
        found = true
      } else {
        i += 16
      }
    }
    while (!found && i >= 0 && i < stop && i < toI32(buf.length) && buf[i] >= 32 && buf[i] !== 127) {
      i += 1
    }
    if (i < 0 || i >= stop || i >= toI32(buf.length)) {
      break
    }
    let c: i32 = toI32(buf[i])
    if (c === 13 && i + 1 < stop && i + 1 < toI32(buf.length) && buf[i + 1] === 10) {
      // CRLF, the end of almost every line: its LF is the next byte, so it
      // is taken here rather than by another trip through the scan.
      i += 1
      c = 10
    }
    if (c === 10) {
      if (i === p.start || buf[i - 1] !== 13) {
        return http1Fail(p, 400, "a line ended in a bare LF")
      }
      if (i - 1 - p.start > limit) {
        return http1Fail(p, overStatus, "a line over its limit")
      }
      p.lineStart = p.start
      p.lineEnd = i - 1
      p.start = i + 1
      p.scan = i + 1
      return HTTP1_LINE
    }
    if (c === 13 && i + 1 >= stop) {
      // A CR at the end of the bytes so far: whether it ends the line is
      // the next byte's to say, so the next call looks at it again.
      break
    }
    if (c !== 9 && !(c === 13 && i + 1 < toI32(buf.length) && buf[i + 1] === 10)) {
      p.lineControl = true
    }
    i += 1
  }
  p.scan = i
  if (end - p.start > limit + 1) {
    return http1Fail(p, overStatus, "a line over its limit")
  }
  return HTTP1_NEED_MORE
}

/**
 * The tchars of RFC 9110 §5.6.2 as three 32-bit masks, bit `c - 32`,
 * `c - 64` and `c - 96` of each: `!` `#`-`'` `*` `+` `-` `.` and the digits
 * in the first (0x03ff6cfa); the upper-case letters, `^` and `_` in the
 * second (0xc7fffffe); `` ` ``, the lower-case letters, `|` and `~` in the
 * third (0x57ffffff). No byte below 33 or above 126 is a tchar.
 * `http1IsTokenByte` reads them as two 64-bit masks, one for the bytes 0 to
 * 63 and one for 64 to 127, so the test is a select and a shift with no
 * branch on the byte. A field name goes sixteen bytes at a time through
 * `http1NonTokenLanes`, the same set; this test is for the method, a trailer's
 * name, and a name's last bytes when fewer than sixteen are left in the head.
 */
const HTTP1_TCHAR_32: i32 = 67071226
const HTTP1_TCHAR_64: i32 = -939524098
const HTTP1_TCHAR_96: i32 = 1476395007

/**
 * Whether `c` is a tchar of RFC 9110 §5.6.2, the bytes a token is made of.
 * @param c the byte to test, as a number 0 to 255
 * @returns true when `c` may stand in a method, a field name or another token
 */
export const http1IsTokenByte = (c: i32): boolean => {
  const low: u64 = toU64(toU32(HTTP1_TCHAR_32)) << toU64(32)
  const high: u64 = (toU64(toU32(HTTP1_TCHAR_96)) << toU64(32)) | toU64(toU32(HTTP1_TCHAR_64))
  const word: u64 = c < 64 ? low : high
  return c >= 0 && c < 128 && ((word >> toU64(c & 63)) & toU64(1)) !== toU64(0)
}

/**
 * Which lanes of `v` are not tchars, as `http1IsTokenByte` answers for each,
 * bit `k` for lane `k`: a byte outside 33 to 126, or one of the seventeen
 * delimiters among them, `"` `(` `)` `,` `/` `:` to `@` (seven), `[` `\` `]`
 * `{` and `}`. A name is mostly one vector, so these compares run once for
 * the sixteen bytes where the table test ran once for each.
 */
const http1NonTokenLanes = (v: u8x16): i32 => {
  const outside: mask8x16 = gt(subWrapping(v, splatU8x16(33)), splatU8x16(93))
  const quote: mask8x16 = or(eq(v, splatU8x16(34)), lt(subWrapping(v, splatU8x16(40)), splatU8x16(2)))
  const comma: mask8x16 = or(eq(v, splatU8x16(44)), eq(v, splatU8x16(47)))
  const colon: mask8x16 = lt(subWrapping(v, splatU8x16(58)), splatU8x16(7))
  const bracket: mask8x16 = lt(subWrapping(v, splatU8x16(91)), splatU8x16(3))
  const brace: mask8x16 = or(eq(v, splatU8x16(123)), eq(v, splatU8x16(125)))
  return bitmask(or(or(or(outside, quote), or(comma, colon)), or(bracket, brace)))
}

/**
 * Lowercases a field name in `head` from `k`, sixteen bytes at a time, and
 * answers where it ends: the first byte before `stop` that is not a tchar, or
 * `stop`. Each vector's name lanes are lowered, and every other lane is
 * stored back as it was, so the value after the name and the bytes past the
 * line keep their case. A tail of under sixteen bytes before `head`'s end
 * goes a byte at a time. The answer and the bytes written are the byte loop's.
 */
const http1LowerName = (head: u8[], k0: i32, stop: i32): i32 => {
  // Lane `j` holds `j`: the name's lanes are those below its length.
  const lanes: u8x16 = u8x16(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)
  let k: i32 = k0
  while (k >= 0 && k < stop && k <= toI32(head.length) - 16) {
    const v: u8x16 = loadU8x16(head, k)
    const bad: i32 = http1NonTokenLanes(v)
    let run: i32 = 16
    if (bad !== 0) {
      run = toI32(31) - toI32(Math.clz32(toU32(bad & -bad)))
    }
    if (run > stop - k) {
      run = stop - k
    }
    const upper: mask8x16 = and(
      lt(subWrapping(v, splatU8x16(65)), splatU8x16(26)),
      lt(lanes, splatU8x16(toU8(run)))
    )
    store(select(upper, or(v, splatU8x16(32)), v), head, k)
    k += run
    if (run < 16) {
      return k
    }
  }
  while (k >= 0 && k < stop && k < toI32(head.length)) {
    const c: i32 = toI32(head[k])
    if (!http1IsTokenByte(c)) {
      break
    }
    head[k] = toU8(c >= 65 && c <= 90 ? c + 32 : c)
    k += 1
  }
  return k
}

/**
 * Whether `c` may appear in a field value (RFC 9110 §5.5): HTAB, SP, VCHAR or obs-text.
 * @param c the byte to test, as a number 0 to 255
 * @returns true when `c` cannot end the line early or smuggle a control byte into the value
 */
export const http1IsValueByte = (c: i32): boolean => c === 9 || (c >= 32 && c !== 127)

/**
 * `buf[from .. to)` as a string, each upper-case ASCII letter lowered when `lower`.
 * @param buf the bytes to read from
 * @param from where the text starts in `buf`
 * @param to where the text ends in `buf`, exclusive
 * @param lower true to lowercase ASCII letters, as a field name wants
 * @returns a fresh string of those bytes, one character per byte
 */
export const http1Text = (buf: u8[], from: i32, to: i32, lower: boolean): string => {
  const parts: string[] = []
  for (let k: i32 = from; k >= 0 && k < to && k < toI32(buf.length); k += 1) {
    let c: i32 = toI32(buf[k])
    if (lower && c >= 65 && c <= 90) {
      c += 32
    }
    parts.push(String.fromCharCode(c))
  }
  return parts.join("")
}

/**
 * Whether `c` is optional whitespace, a space or a tab (OWS, RFC 9110 §5.6.3).
 * @param c the byte to test, as a number 0 to 255
 * @returns true when `c` is whitespace a field value is trimmed of
 */
export const http1IsOws = (c: i32): boolean => c === 32 || c === 9

/**
 * Whether `text[a .. b)` is `word`, which is lowercase, in any ASCII case.
 * @param text the string holding the candidate
 * @param a where the candidate starts in `text`
 * @param b where the candidate ends in `text`, exclusive
 * @param word the lowercase word to compare with
 * @returns true when the slice is `word` with any letters in either case
 */
export const http1SameWord = (text: string, a: i32, b: i32, word: string): boolean => {
  const n: i32 = toI32(word.length)
  if (a < 0 || b - a !== n || b > toI32(text.length)) {
    return false
  }
  for (let k: i32 = 0; k < n; k += 1) {
    let c: i32 = toI32(text.charCodeAt(a + k))
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
 * Whether `bytes[a .. b)` is `word`; with `fold`, an uppercase ASCII letter in
 * `word` matches its lowercase form in `bytes`, which is how a stored field
 * name (already in lowercase) is compared with a caller's.
 */
const http1HeadIs = (bytes: u8[], a: i32, b: i32, word: string, fold: boolean): boolean => {
  const n: i32 = toI32(word.length)
  if (a < 0 || b - a !== n || b > toI32(bytes.length)) {
    return false
  }
  if (!fold) {
    for (let k: i32 = 0; k < n; k += 1) {
      if (toI32(word.charCodeAt(k)) !== toI32(bytes[a + k])) {
        return false
      }
    }
    return true
  }
  for (let k: i32 = 0; k < n; k += 1) {
    let c: i32 = toI32(word.charCodeAt(k))
    let d: i32 = toI32(bytes[a + k])
    if (c >= 65 && c <= 90) {
      c += 32
    }
    if (d >= 65 && d <= 90) {
      d += 32
    }
    if (c !== d) {
      return false
    }
  }
  return true
}

/**
 * Grows `p.head` so that `n` more bytes and sixteen of slack fit past
 * `p.headLength`, keeping every byte already there, those `http1Section` has
 * copied past `headLength` for a line not yet whole included: the rare path
 * of `http1HeadAppend` and of the section scan's copy, apart so that the
 * common one stays small enough to inline.
 */
const http1HeadGrow = (p: Http1Parser, n: i32): void => {
  const at: i32 = p.headLength
  let size: i32 = toI32(p.head.length)
  if (size < HTTP1_FIRST_HEAD) {
    size = HTTP1_FIRST_HEAD
  }
  while (size - at - 16 < n) {
    if (size > 1073741823) {
      panic("Http1Parser: a head of more than 2^31 - 1 bytes")
    }
    size = size * 2
  }
  const grown: u8[] = new Array<u8>(size)
  const old: u8[] = p.head
  const kept: i32 = toI32(old.length) < size ? toI32(old.length) : size
  if (kept > 0) {
    copyBytes(grown, 0, old, 0, kept)
  }
  p.head = grown
}

/**
 * Copies `buf[from .. to)` to the end of `head`, which the caller has grown
 * with `http1HeadGrow` when the line would leave it fewer than sixteen bytes
 * of slack, and answers where the copy starts. The head keeps sixteen bytes past its last
 * line, so a short line is copied as whole vectors and a vector load at any
 * byte of the head is in bounds: the name and value compares read one. A
 * vector's lanes past the line write bytes past `headLength`, which nothing
 * reads.
 */
const http1HeadAppend = (p: Http1Parser, from: i32, to: i32): i32 => {
  const n: i32 = to - from
  const at: i32 = p.headLength
  const head: u8[] = p.head
  const buf: u8[] = p.buf
  // A line of up to 32 bytes is one or two vector stores; a longer one, or
  // one that ends within a vector of `buf`'s end, is one `copyBytes`, which
  // outruns a loop of stores at a Cookie or User-Agent line's length.
  const room: i32 = n <= 16 ? 16 : 32
  if (n <= 32 && from >= 0 && from <= toI32(buf.length) - room && at <= toI32(head.length) - room) {
    store(loadU8x16(buf, from), head, at)
    if (n > 16) {
      store(loadU8x16(buf, from + 16), head, at + 16)
    }
  } else if (n > 0 && from >= 0 && from <= toI32(buf.length) - n && at <= toI32(head.length) - n) {
    copyBytes(head, at, buf, from, n)
  }
  p.headLength = at + n
  return at
}

/** Sets `spans[at]`, growing the array when it must. */
const http1SpanSet = (p: Http1Parser, at: i32, value: i32): void => {
  if (at >= toI32(p.spans.length)) {
    const old: i32[] = p.spans
    const grown: i32[] = new Array<i32>(2 * at + 4)
    for (let k: i32 = 0; k < toI32(old.length) && k < toI32(grown.length); k += 1) {
      grown[k] = old[k]
    }
    p.spans = grown
  }
  const spans: i32[] = p.spans
  if (at >= 0 && at < toI32(spans.length)) {
    spans[at] = value
  }
}

/**
 * Walks the comma-separated list in `head[from .. to)` (RFC 9110 §5.6.1),
 * each element trimmed of OWS and compared with `word` in any case, adding to
 * `tally`. Empty elements are skipped, as the rule says a recipient must
 * accept them. Nothing is copied.
 */
const http1TallyRun = (tally: Http1ListTally, head: u8[], from: i32, to: i32, word: string): void => {
  let start: i32 = from
  for (let k: i32 = from; k <= to; k += 1) {
    const c: i32 = k < to && k >= 0 && k < toI32(head.length) ? toI32(head[k]) : 44
    if (c === 44) {
      let a: i32 = start
      let b: i32 = k
      while (a >= 0 && a < b && a < toI32(head.length) && http1IsOws(toI32(head[a]))) {
        a += 1
      }
      while (b > a && b - 1 >= 0 && b - 1 < toI32(head.length) && http1IsOws(toI32(head[b - 1]))) {
        b -= 1
      }
      if (b > a) {
        tally.elements += 1
        tally.lastMatches = http1HeadIs(head, a, b, word, true)
        if (tally.lastMatches) {
          tally.matches += 1
        }
      }
      start = k + 1
    }
  }
}

/**
 * The list every field named `name` makes together (RFC 9110 §5.3: the
 * fields of one name are one list), tallied for `word` into `p.tally`.
 */
const http1Tally = (p: Http1Parser, name: string, word: string): Http1ListTally => {
  const tally: Http1ListTally = p.tally
  tally.elements = 0
  tally.matches = 0
  tally.lastMatches = false
  const spans: i32[] = p.spans
  for (let i: i32 = 0; i < p.headerCount && 4 * i + 3 < toI32(spans.length); i += 1) {
    if (http1HeadIs(p.head, spans[4 * i], spans[4 * i + 1], name, false)) {
      http1TallyRun(tally, p.head, spans[4 * i + 2], spans[4 * i + 3], word)
    }
  }
  return tally
}

/** `http1FramingField`: a Host field. */
const HTTP1_FIELD_HOST: i32 = 1
/** `http1FramingField`: a Content-Length field. */
const HTTP1_FIELD_LENGTH: i32 = 2
/** `http1FramingField`: a Transfer-Encoding field. */
const HTTP1_FIELD_CODING: i32 = 3
/** `http1FramingField`: a Connection field. */
const HTTP1_FIELD_CONNECTION: i32 = 4
/** `http1FramingField`: an Upgrade field. */
const HTTP1_FIELD_UPGRADE: i32 = 5

/**
 * Whether `head[at .. at + n)` is `word`'s first `n` bytes, `n` at most 16,
 * each upper-case ASCII letter of the head lowered when `fold`: one vector
 * compare, or `http1HeadIs` when fewer than sixteen bytes follow `at`.
 */
const http1HeadIsVector = (
  head: u8[],
  at: i32,
  n: i32,
  word: u8x16,
  text: string,
  fold: boolean
): boolean => {
  if (at < 0 || at > toI32(head.length) - 16 || n > 16) {
    return http1HeadIs(head, at, at + n, text, fold)
  }
  let v: u8x16 = loadU8x16(head, at)
  if (fold) {
    v = select(lt(subWrapping(v, splatU8x16(65)), splatU8x16(26)), or(v, splatU8x16(32)), v)
  }
  const want: i32 = n >= 16 ? 65535 : (1 << n) - 1
  return (bitmask(eq(v, word)) & want) === want
}

/**
 * Which of the fields that frame a message (RFC 9112 §6, §9.6, RFC 9110 §7.2,
 * §7.8) the lowercase name `head[at .. at + n)` is, as an `HTTP1_FIELD_`
 * kind, or 0. Every kept field line asks once, as its name is read, so the
 * end of the head counts them without reading a name again; the length picks
 * the one name a field could be, and one vector compare answers.
 */
const http1FramingField = (head: u8[], at: i32, n: i32): i32 => {
  if (n === 4) {
    const host: u8x16 = u8x16(104, 111, 115, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    return http1HeadIsVector(head, at, n, host, "host", false) ? HTTP1_FIELD_HOST : 0
  }
  if (n === 7) {
    const upgrade: u8x16 = u8x16(117, 112, 103, 114, 97, 100, 101, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    return http1HeadIsVector(head, at, n, upgrade, "upgrade", false) ? HTTP1_FIELD_UPGRADE : 0
  }
  if (n === 10) {
    const connection: u8x16 = u8x16(99, 111, 110, 110, 101, 99, 116, 105, 111, 110, 0, 0, 0, 0, 0, 0)
    return http1HeadIsVector(head, at, n, connection, "connection", false) ? HTTP1_FIELD_CONNECTION : 0
  }
  if (n === 14) {
    const length: u8x16 = u8x16(99, 111, 110, 116, 101, 110, 116, 45, 108, 101, 110, 103, 116, 104, 0, 0)
    return http1HeadIsVector(head, at, n, length, "content-length", false) ? HTTP1_FIELD_LENGTH : 0
  }
  if (n === 17) {
    // "transfer-encodin" in the vector, and the "g" after it.
    const coding: u8x16 = u8x16(116, 114, 97, 110, 115, 102, 101, 114, 45, 101, 110, 99, 111, 100, 105, 110)
    const g: boolean = at >= 0 && at + 16 < toI32(head.length) && head[at + 16] === 103
    return g && http1HeadIsVector(head, at, 16, coding, "transfer-encodin", false) ? HTTP1_FIELD_CODING : 0
  }
  return 0
}

/** `http1ConnectionList`: the Connection list names `close`. */
const HTTP1_CONNECTION_CLOSE: i32 = 1
/** `http1ConnectionList`: the Connection list names `keep-alive`. */
const HTTP1_CONNECTION_KEEP_ALIVE: i32 = 2
/** `http1ConnectionList`: the Connection list names `upgrade`. */
const HTTP1_CONNECTION_UPGRADE: i32 = 4

/**
 * Which of `close`, `keep-alive` and `upgrade` the Connection value
 * `head[from .. to)` names, in any case, as `HTTP1_CONNECTION_` bits. The
 * commas are found sixteen bytes at a time; each element is trimmed of OWS and
 * compared whole (RFC 9110 §5.6.1, §7.6.1), its length picking the one word it
 * could be, and empty elements are skipped.
 */
const http1ConnectionList = (head: u8[], from: i32, to: i32): i32 => {
  const close: u8x16 = u8x16(99, 108, 111, 115, 101, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
  const keepAlive: u8x16 = u8x16(107, 101, 101, 112, 45, 97, 108, 105, 118, 101, 0, 0, 0, 0, 0, 0)
  const upgrade: u8x16 = u8x16(117, 112, 103, 114, 97, 100, 101, 0, 0, 0, 0, 0, 0, 0, 0, 0)
  const length: i32 = toI32(head.length)
  let found: i32 = 0
  let start: i32 = from
  while (start >= 0 && start <= to) {
    // The element runs to the next comma, or to the value's end.
    let end: i32 = start
    let seeking: boolean = true
    while (seeking && end < to) {
      if (end <= length - 16) {
        const commas: i32 = bitmask(eq(loadU8x16(head, end), splatU8x16(44)))
        if (commas !== 0) {
          end += toI32(31) - toI32(Math.clz32(toU32(commas & -commas)))
          seeking = false
        } else {
          end += 16
        }
      } else if (end < length && head[end] !== 44) {
        end += 1
      } else {
        seeking = false
      }
    }
    if (end > to) {
      end = to
    }
    let a: i32 = start
    let b: i32 = end
    while (a < b && a < length && http1IsOws(toI32(head[a]))) {
      a += 1
    }
    while (b > a && b - 1 < length && http1IsOws(toI32(head[b - 1]))) {
      b -= 1
    }
    const n: i32 = b - a
    if (n === 5 && http1HeadIsVector(head, a, n, close, "close", true)) {
      found = found | HTTP1_CONNECTION_CLOSE
    } else if (n === 10 && http1HeadIsVector(head, a, n, keepAlive, "keep-alive", true)) {
      found = found | HTTP1_CONNECTION_KEEP_ALIVE
    } else if (n === 7 && http1HeadIsVector(head, a, n, upgrade, "upgrade", true)) {
      found = found | HTTP1_CONNECTION_UPGRADE
    }
    start = end + 1
  }
  return found
}

/**
 * Whether the buffered start of a request line holds more than
 * `HTTP1_MAX_METHOD` bytes before its first space (or line end).
 */
const http1MethodOverrun = (p: Http1Parser): boolean => {
  // Bytes up to `scan` were seen by an earlier call, which found a space
  // in time if there were more than `HTTP1_MAX_METHOD` of them.
  if (p.scan - p.start > HTTP1_MAX_METHOD) {
    return false
  }
  const buf: u8[] = p.buf
  const n: i32 = toI32(buf.length)
  // A space, CR or LF in the first sixteen bytes, buffered or not, is
  // before `HTTP1_MAX_METHOD`: the loop below would answer false at it, or
  // at `end` before it.
  if (p.start >= 0 && p.start <= n - 16) {
    const v: u8x16 = loadU8x16(buf, p.start)
    if (any(or(or(eq(v, splatU8x16(32)), eq(v, splatU8x16(13))), eq(v, splatU8x16(10))))) {
      return false
    }
  }
  const stop: i32 = p.start + HTTP1_MAX_METHOD
  for (let k: i32 = p.start; k >= 0 && k < p.end && k < n; k += 1) {
    if (buf[k] === 32 || buf[k] === 13 || buf[k] === 10) {
      return false
    }
    if (k >= stop) {
      return true
    }
  }
  return false
}

/**
 * Reads the request line in `lineStart .. lineEnd`: method SP target SP
 * version (§3), with exactly one space at each gap.
 */
const http1RequestLine = (p: Http1Parser): i32 => {
  const buf: u8[] = p.buf
  const n: i32 = toI32(buf.length)
  const a: i32 = p.lineStart
  const b: i32 = p.lineEnd < n ? p.lineEnd : n
  // The method is tchars, sixteen at a time as a field name is read; the
  // line's CR, a control byte, ends the run if no space or other byte does.
  let i: i32 = a
  let ended: boolean = false
  while (!ended && i >= 0 && i < b && i <= toI32(buf.length) - 16) {
    const bad: i32 = http1NonTokenLanes(loadU8x16(buf, i))
    if (bad !== 0) {
      i += toI32(31) - toI32(Math.clz32(toU32(bad & -bad)))
      ended = true
    } else {
      i += 16
    }
  }
  if (i > b) {
    i = b
  }
  while (!ended && i >= 0 && i < b && i < toI32(buf.length) && http1IsTokenByte(toI32(buf[i]))) {
    i += 1
  }
  if (i === a || i - a > HTTP1_MAX_METHOD || i >= b || buf[i] !== 32) {
    return http1Fail(p, 400, "a malformed method")
  }
  const methodEnd: i32 = i
  i += 1
  const targetStart: i32 = i
  // The target is visible ASCII, 33 to 126: sixteen bytes at a time, as far
  // as the first that is not or the line's end, and a byte at a time for a
  // tail shorter than a vector before `buf`'s end.
  let found: boolean = false
  while (!found && i >= 0 && i < b && i <= toI32(buf.length) - 16) {
    const bad: i32 = bitmask(gt(subWrapping(loadU8x16(buf, i), splatU8x16(33)), splatU8x16(93)))
    if (bad !== 0) {
      i += toI32(31) - toI32(Math.clz32(toU32(bad & -bad)))
      found = true
    } else {
      i += 16
    }
  }
  if (i > b) {
    i = b
  }
  while (!found && i >= 0 && i < b && i < toI32(buf.length) && buf[i] > 32 && buf[i] < 127) {
    i += 1
  }
  if (i - targetStart > p.maxTarget) {
    return http1Fail(p, 414, "the request target is over the limit")
  }
  if (i === targetStart || i >= b || buf[i] !== 32) {
    return http1Fail(p, 400, "a malformed request target")
  }
  const targetEnd: i32 = i
  i += 1
  // "HTTP/" DIGIT "." DIGIT, case-sensitive (§2.3), and the end of the line.
  if (
    b - i !== 8 ||
    buf[i] !== 72 ||
    buf[i + 1] !== 84 ||
    buf[i + 2] !== 84 ||
    buf[i + 3] !== 80 ||
    buf[i + 4] !== 47 ||
    buf[i + 5] < 48 ||
    buf[i + 5] > 57 ||
    buf[i + 6] !== 46 ||
    buf[i + 7] < 48 ||
    buf[i + 7] > 57
  ) {
    return http1Fail(p, 400, "a malformed HTTP version")
  }
  if (buf[i + 5] !== 49) {
    return http1Fail(p, 505, "an HTTP major version other than 1")
  }
  p.minor = buf[i + 7] === 48 ? 0 : 1
  if (b - a > toI32(p.head.length) - p.headLength - 16) {
    http1HeadGrow(p, b - a)
  }
  const at: i32 = http1HeadAppend(p, a, b)
  p.methodStart = at
  p.methodEnd = at + (methodEnd - a)
  p.targetStart = at + (targetStart - a)
  p.targetEnd = at + (targetEnd - a)
  if (p.keepText) {
    p.method = http1Text(buf, a, methodEnd, false)
    p.target = http1Text(buf, targetStart, targetEnd, false)
  }
  p.state = HTTP1_S_FIELDS
  return HTTP1_NEED_MORE
}

/**
 * Reads one field line in `lineStart .. lineEnd` (§5) into `names` and
 * `values`, or, for a trailer, only checks it. A kept line is already in the
 * head, `http1Section`'s copy of it: `buf[x]` is at `head[x + delta]`.
 * Answers `HTTP1_NEED_MORE` or the refusal.
 */
const http1FieldLine = (p: Http1Parser, keep: boolean, delta: i32): i32 => {
  const buf: u8[] = p.buf
  const n: i32 = toI32(buf.length)
  const a: i32 = p.lineStart
  const b: i32 = p.lineEnd < n ? p.lineEnd : n
  if (a >= 0 && a < b && (buf[a] === 32 || buf[a] === 9)) {
    return http1Fail(p, 400, "a field line that starts with whitespace (obs-fold)")
  }
  // A kept line's name is read in the head's copy, each upper-case letter
  // lowered as the scan passes it: one walk over the name, not a check of
  // `buf` and then a second walk of the copy. The copy of a line refused
  // below is never read, since a refusal ends the parse.
  let at: i32 = 0
  let i: i32 = a
  if (keep) {
    at = a + delta
    i = a + (http1LowerName(p.head, at, at + (b - a)) - at)
  } else {
    while (i >= 0 && i < b && i < toI32(buf.length) && http1IsTokenByte(toI32(buf[i]))) {
      i += 1
    }
  }
  if (i === a || i >= b || buf[i] !== 58) {
    return http1Fail(p, 400, "a malformed field name")
  }
  const nameEnd: i32 = i
  // The name is tchars and the colon is field text, so a byte no value may
  // hold anywhere on the line is one in the value.
  if (p.lineControl) {
    return http1Fail(p, 400, "a control character in a field value")
  }
  p.fieldCount += 1
  if (p.fieldCount > p.maxHeaders) {
    return http1Fail(p, 431, "more fields than the limit")
  }
  // A trailer is checked and counted, but not kept: nothing here reads one.
  if (keep) {
    let valueStart: i32 = nameEnd + 1
    let valueEnd: i32 = b
    while (valueStart < valueEnd && (buf[valueStart] === 32 || buf[valueStart] === 9)) {
      valueStart += 1
    }
    while (valueEnd > valueStart && (buf[valueEnd - 1] === 32 || buf[valueEnd - 1] === 9)) {
      valueEnd -= 1
    }
    // The fields that frame the message are counted here, as their names
    // are read, for `http1EndOfHead`: every kept field asks the same question.
    const kind: i32 = http1FramingField(p.head, at, nameEnd - a)
    if (kind === HTTP1_FIELD_HOST) {
      p.hostFields += 1
    } else if (kind === HTTP1_FIELD_LENGTH) {
      p.lengthFields += 1
      p.lengthField = p.headerCount
    } else if (kind === HTTP1_FIELD_CODING) {
      p.codingFields += 1
    } else if (kind === HTTP1_FIELD_CONNECTION) {
      p.connectionOptions =
        p.connectionOptions | http1ConnectionList(p.head, at + (valueStart - a), at + (valueEnd - a))
    } else if (kind === HTTP1_FIELD_UPGRADE) {
      p.upgradeFields += 1
      p.upgradeValueBytes += valueEnd - valueStart
    }
    const base: i32 = 4 * p.headerCount
    http1SpanSet(p, base + 3, at + (valueEnd - a))
    // The last of the four is set first, so the array has room for them all.
    const spans: i32[] = p.spans
    if (base >= 0 && base + 2 < toI32(spans.length)) {
      spans[base] = at
      spans[base + 1] = at + (nameEnd - a)
      spans[base + 2] = at + (valueStart - a)
    }
    p.headerCount += 1
    if (p.keepText) {
      p.names.push(http1Text(buf, a, nameEnd, true))
      p.values.push(http1Text(buf, valueStart, valueEnd, false))
    }
  }
  return HTTP1_NEED_MORE
}

/**
 * The header section has ended: decide the framing and the connection's fate
 * (§6.3, §9.3) and answer `HTTP1_HEAD`, or the refusal. It reads the counts
 * the field lines left, and allocates nothing unless `keepText` asks for
 * `upgrade` as a string.
 */
const http1EndOfHead = (p: Http1Parser): i32 => {
  const spans: i32[] = p.spans
  const head: u8[] = p.head
  const hosts: i32 = p.hostFields
  const lengths: i32 = p.lengthFields
  const lengthField: i32 = p.lengthField
  if ((p.minor === 1 && hosts !== 1) || hosts > 1) {
    return http1Fail(p, 400, "a request without exactly one Host")
  }
  if (p.codingFields > 0) {
    if (lengths > 0) {
      return http1Fail(p, 400, "both Content-Length and Transfer-Encoding")
    }
    if (p.minor === 0) {
      return http1Fail(p, 400, "Transfer-Encoding in an HTTP/1.0 request")
    }
    const codings: Http1ListTally = http1Tally(p, "transfer-encoding", "chunked")
    if (!codings.lastMatches) {
      return http1Fail(p, 400, "a transfer coding list that does not end in chunked")
    }
    if (codings.matches > 1) {
      return http1Fail(p, 400, "chunked applied twice")
    }
    if (codings.elements > 1) {
      return http1Fail(p, 501, "a transfer coding other than chunked")
    }
    p.chunked = true
  } else if (lengths > 1) {
    return http1Fail(p, 400, "Content-Length given twice")
  } else if (lengths === 1 && 4 * lengthField + 3 < toI32(spans.length) && lengthField >= 0) {
    const size: i32 = http1ContentLength(
      head,
      spans[4 * lengthField + 2],
      spans[4 * lengthField + 3],
      p.maxBody
    )
    if (size === -1) {
      return http1Fail(p, 400, "a Content-Length that is not a run of digits")
    }
    if (size === -2) {
      return http1Fail(p, 413, "a Content-Length over the limit")
    }
    p.contentLength = size
  }
  const options: i32 = p.connectionOptions
  const close: boolean = (options & HTTP1_CONNECTION_CLOSE) !== 0
  const keep: boolean = (options & HTTP1_CONNECTION_KEEP_ALIVE) !== 0
  const upgradeAsked: boolean = (options & HTTP1_CONNECTION_UPGRADE) !== 0
  p.keepAlive = p.minor === 1 ? !close : keep && !close
  // The fields of one name joined with ", " are empty only when there is one
  // field and it is empty: the same test, without the join.
  p.upgrading = p.minor === 1 && upgradeAsked && (p.upgradeFields > 1 || p.upgradeValueBytes > 0)
  if (p.keepText && p.upgrading) {
    const upgrades: string[] = []
    const names: string[] = p.names
    for (let i: i32 = 0; i < toI32(names.length) && i < toI32(p.values.length); i += 1) {
      if (names[i] === "upgrade") {
        upgrades.push(p.values[i])
      }
    }
    p.upgrade = upgrades.join(", ")
  }
  if (p.chunked) {
    p.state = HTTP1_S_CHUNK_SIZE
  } else if (p.contentLength > 0) {
    p.left = p.contentLength
    p.state = HTTP1_S_LENGTH_BODY
  } else {
    p.state = HTTP1_S_MESSAGE_END
  }
  return HTTP1_HEAD
}

/**
 * `bytes[from .. to)` as a Content-Length (1*DIGIT, RFC 9112 §6.2): the
 * value, -1 when it is not a run of digits, or -2 when it is one over
 * `limit`. The digits are all read even past the limit, so `12x` is a 400
 * however long it is.
 */
const http1ContentLength = (bytes: u8[], from: i32, to: i32, limit: i32): i32 => {
  if (to <= from) {
    return -1
  }
  let value: i32 = 0
  let over: boolean = false
  for (let k: i32 = from; k < to && k >= 0 && k < toI32(bytes.length); k += 1) {
    const c: i32 = toI32(bytes[k])
    if (c < 48 || c > 57) {
      return -1
    }
    if (!over) {
      // `limit - digit` may be negative, and its division truncates toward
      // zero, so the digit is compared on its own first.
      if (c - 48 > limit || value > (limit - (c - 48)) / 10) {
        over = true
      } else {
        value = value * 10 + (c - 48)
      }
    }
  }
  return over ? -2 : value
}

/**
 * The value of the hex digit `c`, or -1.
 * @param c the byte to read, as a number 0 to 255
 * @returns 0 to 15 for a hex digit in either case, or -1 when `c` is not one
 */
export const http1HexValue = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48
  }
  if (c >= 97 && c <= 102) {
    return c - 87
  }
  if (c >= 65 && c <= 70) {
    return c - 55
  }
  return -1
}

/**
 * Reads a chunk-size line (§7.1): 1*HEXDIG, then optional whitespace and a
 * `;` extension that is read past but not interpreted. Sets `left` and answers
 * `HTTP1_NEED_MORE`, or the refusal.
 */
const http1ChunkSize = (p: Http1Parser): i32 => {
  const buf: u8[] = p.buf
  const n: i32 = toI32(buf.length)
  const a: i32 = p.lineStart
  const b: i32 = p.lineEnd < n ? p.lineEnd : n
  const room: i32 = p.maxBody - p.bodyTotal
  let size: i32 = 0
  let over: boolean = false
  let i: i32 = a
  while (i >= 0 && i < b && i < toI32(buf.length)) {
    const digit: i32 = http1HexValue(toI32(buf[i]))
    if (digit < 0) {
      break
    }
    if (!over) {
      if (digit > room || size > (room - digit) / 16) {
        over = true
      } else {
        size = size * 16 + digit
      }
    }
    i += 1
  }
  if (i === a) {
    return http1Fail(p, 400, "a chunk size with no hex digits")
  }
  // Whitespace may follow the size only as the BWS before a chunk extension's
  // `;` (§7.1), so whitespace that runs to the end of the line is refused.
  const digitsEnd: i32 = i
  while (i >= 0 && i < b && i < toI32(buf.length) && http1IsOws(toI32(buf[i]))) {
    i += 1
  }
  if (i >= b && i > digitsEnd) {
    return http1Fail(p, 400, "a malformed chunk size")
  }
  if (i >= 0 && i < b) {
    if (buf[i] !== 59) {
      return http1Fail(p, 400, "a malformed chunk size")
    }
    for (let k: i32 = i + 1; k >= 0 && k < b && k < toI32(buf.length); k += 1) {
      if (!http1IsValueByte(toI32(buf[k]))) {
        return http1Fail(p, 400, "a control character in a chunk extension")
      }
    }
  }
  if (over) {
    return http1Fail(p, 413, "a chunked body over the limit")
  }
  p.left = size
  p.state = size === 0 ? HTTP1_S_TRAILERS : HTTP1_S_CHUNK_DATA
  p.sectionBytes = 0
  return HTTP1_NEED_MORE
}

/**
 * Hands the caller up to `p.left` of the buffered body bytes, and moves to
 * `after` once the last of them is handed out.
 */
const http1BodyWindow = (p: Http1Parser, after: i32): i32 => {
  const ready: i32 = p.end - p.start
  if (ready <= 0) {
    return HTTP1_NEED_MORE
  }
  let take: i32 = ready < p.left ? ready : p.left
  if (take > p.maxChunk && p.maxChunk > 0) {
    take = p.maxChunk
  }
  p.body = p.buf
  p.bodyOff = p.start
  p.bodyLen = take
  p.start += take
  p.scan = p.start
  p.left -= take
  p.bodyTotal += take
  if (p.left === 0) {
    p.state = after
  }
  return HTTP1_BODY
}

/**
 * Reads a header or trailer section's lines while whole ones are buffered:
 * `http1TakeLine` and `http1FieldLine` in one loop, each line limited by what
 * is left of `maxHeaderBytes` as `http1TakeLine` limits it, and the section's
 * bytes counted after it. The control bytes of the vector that held one line's
 * CRLF are kept for the next line, which mostly starts in the same vector, so
 * each buffered byte is loaded once however many lines a read brought.
 * Answers `HTTP1_LINE` when a trailer section has ended and the state machine
 * goes on, or what `next()` answers: `HTTP1_HEAD`, `HTTP1_NEED_MORE` or the
 * refusal. Its limits, refusals, spans and `scan` are `http1TakeLine`'s.
 */
const http1Section = (p: Http1Parser): i32 => {
  const buf: u8[] = p.buf
  const length: i32 = toI32(buf.length)
  const stop: i32 = p.end < length ? p.end : length
  const trailer: boolean = p.state === HTTP1_S_TRAILERS
  let i: i32 = p.start
  if (p.scan > p.start) {
    i = p.scan
  } else {
    p.lineControl = false
  }
  if (i < 0) {
    i = 0
  }
  // A header section is copied into the head as it is scanned, each vector
  // stored as it is loaded, CRLFs and all: `buf[x]` lands at `head[x +
  // delta]`, so a field line is in the head before it is read, and a line
  // that ends in a later call finds its first bytes where this one left them.
  // Nothing past `copyStop` is copied: a line reaching it is over its limit
  // (see the 431 below; what is left of `maxHeaderBytes` is the same at every
  // line), so the copy, and the head, stay within the limit.
  const copy: boolean = !trailer
  const delta: i32 = p.headLength - p.start
  const room: i32 = p.maxHeaderBytes - p.sectionBytes + 2
  const copyStop: i32 = p.start > 2147483647 - room ? 2147483647 : p.start + room
  // Bit `k` of `bits` is set when `buf[base + k]` is a control byte or DEL
  // at or past `i`: the vector last loaded, its lanes before `i` cleared.
  let base: i32 = i - 16
  let bits: i32 = 0
  while (true) {
    // The next control byte at or past `i`, or the end of the bytes so far.
    let j: i32 = stop
    let seeking: boolean = true
    while (seeking) {
      if (bits !== 0) {
        j = base + (toI32(31) - toI32(Math.clz32(toU32(bits & -bits))))
        seeking = false
      } else {
        const q: i32 = base + 16 > i ? base + 16 : i
        if (q >= stop) {
          seeking = false
        } else if (q >= 0 && q <= length - 16) {
          // The vector may run past `stop` into bytes not yet fed: its lanes
          // there are dropped from `bits`, and its copy of them is
          // overwritten when they arrive.
          const v: u8x16 = loadU8x16(buf, q)
          if (copy && q < copyStop) {
            const at: i32 = q + delta
            if (at > toI32(p.head.length) - 32) {
              http1HeadGrow(p, at + 16 - p.headLength)
            }
            store(v, p.head, at)
          }
          bits = bitmask(or(lt(v, splatU8x16(32)), eq(v, splatU8x16(127))))
          if (q > stop - 16) {
            bits = bits & ((toI32(1) << (stop - q)) - 1)
          }
          base = q
        } else {
          // Fewer than sixteen bytes are left in `buf`: a byte at a time.
          let k: i32 = q
          while (k >= 0 && k < stop && buf[k] >= 32 && buf[k] !== 127) {
            k += 1
          }
          const last: i32 = k < stop ? k + 1 : stop
          const end: i32 = last < copyStop ? last : copyStop
          if (copy && q < end) {
            if (end + delta > toI32(p.head.length) - 16) {
              http1HeadGrow(p, end + delta - p.headLength)
            }
            copyBytes(p.head, q + delta, buf, q, end - q)
          }
          j = k
          base = k + 1 - 16
          seeking = false
        }
      }
    }
    if (j < 0 || j >= stop) {
      i = j < 0 ? i : j
      break
    }
    const c: i32 = toI32(buf[j])
    let lf: i32 = -1
    if (c === 13 && j + 1 < stop && buf[j + 1] === 10) {
      lf = j + 1
    } else if (c === 10) {
      lf = j
    }
    if (lf >= 0) {
      const start: i32 = p.start
      if (lf === start || buf[lf - 1] !== 13) {
        return http1Fail(p, 400, "a line ended in a bare LF")
      }
      if (lf - 1 - start > p.maxHeaderBytes - p.sectionBytes) {
        return http1Fail(p, 431, "a line over its limit")
      }
      p.lineStart = start
      p.lineEnd = lf - 1
      p.start = lf + 1
      p.scan = lf + 1
      i = lf + 1
      const consumed: i32 = i - base
      bits = consumed >= 31 ? 0 : bits & ~((1 << consumed) - 1)
      p.sectionBytes += lf + 1 - start
      if (p.sectionBytes > p.maxHeaderBytes) {
        return http1Fail(p, 431, "a header section over the limit")
      }
      if (lf - 1 === start) {
        if (trailer) {
          p.state = HTTP1_S_MESSAGE_END
          return HTTP1_LINE
        }
        p.headLength = p.start + delta
        return http1EndOfHead(p)
      }
      if (http1FieldLine(p, copy, delta) === HTTP1_ERROR) {
        return HTTP1_ERROR
      }
      p.lineControl = false
    } else if (c === 13 && j + 1 >= stop) {
      // A CR at the end of the bytes so far: whether it ends the line is
      // the next byte's to say, so the next call looks at it again.
      i = j
      break
    } else {
      if (c !== 9) {
        p.lineControl = true
      }
      i = j + 1
      bits = bits & (bits - 1)
    }
  }
  p.scan = i
  if (copy) {
    p.headLength = p.start + delta
  }
  if (p.end - p.start > p.maxHeaderBytes - p.sectionBytes + 1) {
    return http1Fail(p, 431, "a line over its limit")
  }
  return HTTP1_NEED_MORE
}

/** The state machine behind `next()`. */
const http1Next = (p: Http1Parser): i32 => {
  while (true) {
    switch (p.state) {
      case HTTP1_S_REQUEST_LINE: {
        // The request that ended was answered while its head was held; the
        // pipelined bytes behind it are only read once it is cleared.
        if (p.headHeld) {
          http1StartRequest(p)
        }
        // A method too long is a 400, decided before the line's length can
        // call it a long target and answer 414.
        if (http1MethodOverrun(p)) {
          return http1Fail(p, 400, "a malformed method")
        }
        // The longest well-formed request line: the method, the target, two
        // spaces and "HTTP/1.1".
        const got: i32 = http1TakeLine(p, HTTP1_MAX_METHOD + p.maxTarget + 10, 414)
        if (got !== HTTP1_LINE) {
          return got
        }
        // RFC 9112 §2.2: an empty line before a request line is ignored.
        if (p.lineEnd > p.lineStart && http1RequestLine(p) === HTTP1_ERROR) {
          return HTTP1_ERROR
        }
        break
      }
      case HTTP1_S_FIELDS:
      case HTTP1_S_TRAILERS: {
        const got: i32 = http1Section(p)
        if (got !== HTTP1_LINE) {
          return got
        }
        break
      }
      case HTTP1_S_LENGTH_BODY:
        return http1BodyWindow(p, HTTP1_S_MESSAGE_END)
      case HTTP1_S_CHUNK_SIZE: {
        const got: i32 = http1TakeLine(p, p.maxHeaderBytes, 400)
        if (got !== HTTP1_LINE) {
          return got
        }
        if (http1ChunkSize(p) === HTTP1_ERROR) {
          return HTTP1_ERROR
        }
        break
      }
      case HTTP1_S_CHUNK_DATA:
        return http1BodyWindow(p, HTTP1_S_CHUNK_CRLF)
      case HTTP1_S_CHUNK_CRLF: {
        // The CRLF after chunk data is an empty line, so a limit of zero
        // refuses anything else in its place with 400.
        const got: i32 = http1TakeLine(p, 0, 400)
        if (got !== HTTP1_LINE) {
          return got
        }
        p.state = HTTP1_S_CHUNK_SIZE
        break
      }
      case HTTP1_S_MESSAGE_END: {
        if (p.upgrading) {
          p.state = HTTP1_S_UPGRADED
        } else if (!p.keepAlive) {
          p.state = HTTP1_S_CLOSED
        } else {
          // The head stays this request's until the next call, which clears
          // it before reading on: a response written at HTTP1_END reads its
          // own method, version and fields, and no copy is made.
          p.state = HTTP1_S_REQUEST_LINE
          p.headHeld = true
        }
        return HTTP1_END
      }
      case HTTP1_S_UPGRADED:
        return HTTP1_UPGRADE
      case HTTP1_S_CLOSED:
        return HTTP1_CLOSED
      default:
        return HTTP1_ERROR
    }
  }
}

// --- The writer -------------------------------------------------------------

/** The bytes of `text`, as the language holds a string. */
const http1BytesOf = (text: string): u8[] => {
  const n: i32 = toI32(text.length)
  const out: u8[] = new Array<u8>(n)
  const outLength: i32 = toI32(out.length)
  for (let k: i32 = 0; k < outLength && k < n; k += 1) {
    out[k] = toU8(text.charCodeAt(k))
  }
  return out
}

/**
 * Whether every byte of `text` is a tchar, and there is at least one.
 * @param text the candidate token, such as a field name a caller wants to send
 * @returns true when `text` is a valid token, false for an empty string
 */
export const http1IsToken = (text: string): boolean => {
  const n: i32 = toI32(text.length)
  if (n === 0) {
    return false
  }
  for (let k: i32 = 0; k < n; k += 1) {
    if (!http1IsTokenByte(toI32(text.charCodeAt(k)))) {
      return false
    }
  }
  return true
}

/**
 * Whether every byte of `text` may stand in a field value or a reason phrase.
 * @param text the candidate value or reason phrase
 * @returns true when nothing in `text` could end the line early; an empty string passes
 */
export const http1IsFieldText = (text: string): boolean => {
  const n: i32 = toI32(text.length)
  for (let k: i32 = 0; k < n; k += 1) {
    if (!http1IsValueByte(toI32(text.charCodeAt(k)))) {
      return false
    }
  }
  return true
}

/**
 * An HTTP/1.1 status line and header section (RFC 9112 §4, §5), ending in
 * the empty line, with the framing field `bodyLength` asks for appended:
 * `Content-Length: n` for `n >= 0`, `Transfer-Encoding: chunked` for
 * `HTTP1_CHUNKED`, and neither for `HTTP1_NO_BODY`.
 *
 * Answers `null`, and writes nothing, for a status outside 100 to 599; a
 * reason phrase or field value holding CR, LF or another control character
 * (which would end the line early and let the rest be read as a field or a
 * second response); a field name that is not a token; `names` and `values` of
 * different lengths; a `Content-Length` or `Transfer-Encoding` among the
 * caller's fields, since the framing is decided here; two `Date` fields in
 * any case, since `Date` is a singleton (RFC 9110 §5.3); a 1xx or 204 response
 * with a body length (RFC 9110 §15.2, §15.3.5); and any other `bodyLength`
 * below zero.
 *
 * @param status the status code, 100 to 599
 * @param reason the reason phrase after the code, which may be empty
 * @param names the caller's field names, one per field, beside `values`
 * @param values the caller's field values, `values[i]` for `names[i]`
 * @param bodyLength the body's length in bytes, or `HTTP1_CHUNKED` or `HTTP1_NO_BODY`
 * @returns the head's bytes in a fresh array the caller owns, or `null` when the head is refused
 */
export const http1ResponseHead = (
  status: i32,
  reason: string,
  names: string[],
  values: string[],
  bodyLength: i32
): u8[] | null => {
  if (status < 100 || status > 599 || !http1IsFieldText(reason)) {
    return null
  }
  if (bodyLength < HTTP1_NO_BODY) {
    return null
  }
  if ((status < 200 || status === 204) && bodyLength !== HTTP1_NO_BODY) {
    return null
  }
  const count: i32 = toI32(names.length)
  if (toI32(values.length) !== count) {
    return null
  }
  const parts: string[] = [`HTTP/1.1 ${status} ${reason}\r\n`]
  let dated: boolean = false
  for (let i: i32 = 0; i < count && i < toI32(names.length) && i < toI32(values.length); i += 1) {
    const name: string = names[i]
    const value: string = values[i]
    const nameLength: i32 = toI32(name.length)
    if (!http1IsToken(name) || !http1IsFieldText(value)) {
      return null
    }
    if (
      http1SameWord(name, 0, nameLength, "content-length") ||
      http1SameWord(name, 0, nameLength, "transfer-encoding")
    ) {
      return null
    }
    if (http1SameWord(name, 0, nameLength, "date")) {
      if (dated) {
        return null
      }
      dated = true
    }
    parts.push(`${name}: ${value}\r\n`)
  }
  if (bodyLength >= 0) {
    parts.push(`Content-Length: ${bodyLength}\r\n`)
  } else if (bodyLength === HTTP1_CHUNKED) {
    parts.push("Transfer-Encoding: chunked\r\n")
  }
  parts.push("\r\n")
  return http1BytesOf(parts.join(""))
}

/** How many hex digits `len` takes, without leading zeros: at least one. */
const http1HexDigits = (len: i32): i32 => {
  let digits: i32 = 1
  while (digits < 8 && len >> (4 * digits) !== 0) {
    digits += 1
  }
  return digits
}

/**
 * Writes `data[off .. off + len)` as one chunk of a chunked body (RFC 9112
 * §7.1) into `out` at `at` — the size in lowercase hex, CRLF, the bytes,
 * CRLF — and answers where it ends, or `HTTP1_NO_ROOM` when it does not fit,
 * with `out` untouched. An empty window writes nothing and answers `at`,
 * because a chunk of size zero ends the body. A window outside `data` panics.
 *
 * @param out the caller's buffer the chunk is written into
 * @param at where in `out` the chunk starts
 * @param data the body bytes to send
 * @param off where in `data` the chunk's bytes start
 * @param len how many bytes of `data` the chunk carries
 * @returns the offset in `out` just past the chunk, or `HTTP1_NO_ROOM` when it does not fit
 */
export const http1WriteChunk = (out: u8[], at: i32, data: readonly u8[], off: i32, len: i32): i32 => {
  const size: i32 = toI32(data.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic("http1WriteChunk: the window is outside the buffer")
  }
  if (len === 0) {
    return at
  }
  const digits: i32 = http1HexDigits(len)
  const outLength: i32 = toI32(out.length)
  if (at < 0 || at > outLength || len > outLength - at - digits - 4) {
    return HTTP1_NO_ROOM
  }
  let v: i32 = len
  for (let k: i32 = at + digits - 1; k >= at && k >= 0 && k < outLength; k -= 1) {
    const d: i32 = v & 15
    out[k] = toU8(d < 10 ? 48 + d : 87 + d)
    v = v >> 4
  }
  const headEnd: i32 = at + digits + 2
  out[headEnd - 2] = 13
  out[headEnd - 1] = 10
  for (let k: i32 = 0; k < len && headEnd + k < outLength; k += 1) {
    out[headEnd + k] = data[off + k]
  }
  out[headEnd + len] = 13
  out[headEnd + len + 1] = 10
  return headEnd + len + 2
}

/**
 * `data[off .. off + len)` as one chunk of a chunked body, in an array of its
 * own; `http1WriteChunk` writes the same bytes into a buffer the caller owns.
 * An empty window answers an empty array, because a chunk of size zero is the
 * end of the body and only `http1LastChunk` writes that. A window outside
 * `data` panics.
 *
 * @param data the body bytes to send
 * @param off where in `data` the chunk's bytes start
 * @param len how many bytes of `data` the chunk carries
 * @returns the chunk's bytes, framing included, in a fresh array the caller owns
 */
export const http1Chunk = (data: u8[], off: i32, len: i32): u8[] => {
  const size: i32 = toI32(data.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic("http1Chunk: the window is outside the buffer")
  }
  if (len === 0) {
    return []
  }
  const out: u8[] = new Array<u8>(http1HexDigits(len) + len + 4)
  http1WriteChunk(out, 0, data, off, len)
  return out
}

/**
 * The last chunk and the empty trailer section that end a chunked body: `0\r\n\r\n`.
 * @returns those five bytes in a fresh array the caller owns
 */
export const http1LastChunk = (): u8[] => [48, 13, 10, 13, 10]

/**
 * Writes `http1LastChunk`'s five bytes into `out` at `at` and answers where
 * they end, or `HTTP1_NO_ROOM` with `out` untouched.
 *
 * @param out the caller's buffer the last chunk is written into
 * @param at where in `out` the last chunk starts
 * @returns the offset in `out` just past the five bytes, or `HTTP1_NO_ROOM` when they do not fit
 */
export const http1WriteLastChunk = (out: u8[], at: i32): i32 => {
  if (at < 0 || at > toI32(out.length) - 5) {
    return HTTP1_NO_ROOM
  }
  return http1PutText(out, at, "0\r\n\r\n")
}

/** `http1WriteResponseHead` and `http1WriteChunk`: the bytes do not fit at `at`. */
export const HTTP1_NO_ROOM: i32 = -1
/** `http1WriteResponseHead`: a head the writer refuses to write. */
export const HTTP1_REFUSED: i32 = -2

/** Whether `bytes` is a non-empty run of tchars. */
const http1BytesAreToken = (bytes: u8[]): boolean => {
  for (const b of bytes) {
    if (!http1IsTokenByte(toI32(b))) {
      return false
    }
  }
  return toI32(bytes.length) > 0
}

/**
 * Whether no lane of `v` is a byte a field value may not hold: below 32 and
 * not HTAB, or DEL. `http1IsValueByte` on sixteen bytes at once, exactly, so
 * a vector may overlap one already checked.
 */
const http1LanesAreFieldText = (v: u8x16): boolean => {
  const control: mask8x16 = and(lt(v, splatU8x16(32)), ne(v, splatU8x16(9)))
  return !any(or(control, eq(v, splatU8x16(127))))
}

/**
 * Whether every byte of `bytes` may stand in a field value: sixteen at a
 * time, the last vector ending at the last byte and overlapping the one
 * before it, and one at a time below sixteen.
 */
const http1BytesAreFieldText = (bytes: u8[]): boolean => {
  const n: i32 = toI32(bytes.length)
  if (n < 16) {
    for (let k: i32 = 0; k < n; k += 1) {
      if (!http1IsValueByte(toI32(bytes[k]))) {
        return false
      }
    }
    return true
  }
  let k: i32 = 0
  while (k >= 0 && k <= n - 16) {
    if (!http1LanesAreFieldText(loadU8x16(bytes, k))) {
      return false
    }
    k += 16
  }
  return k === n || http1LanesAreFieldText(loadU8x16(bytes, n - 16))
}

/**
 * Whether the octets of `bytes` spell `word`, which is lowercase, in any ASCII case: a field name compared as RFC 9110 §5.1 says.
 * @param bytes the field name as octets, as `nish/net/http-fields` holds it
 * @param word the lowercase name to compare with
 * @returns true when `bytes` is `word` with any letters in either case
 */
export const http1BytesAre = (bytes: u8[], word: string): boolean =>
  http1HeadIs(bytes, 0, toI32(bytes.length), word, true)

/** How many decimal digits `n`, which is not negative, takes. */
const http1DecimalDigits = (n: i32): i32 => {
  if (n < 10) {
    return 1
  }
  if (n < 100) {
    return 2
  }
  if (n < 1000) {
    return 3
  }
  let digits: i32 = 4
  let v: i32 = n / 10000
  while (v > 0) {
    v = v / 10
    digits += 1
  }
  return digits
}

/**
 * Writes `text` at `out[at ..)`, which the caller has made sure holds it, and answers where it ends.
 * @param out the caller's buffer
 * @param at where in `out` the text starts
 * @param text the text to write, one byte per character
 * @returns the offset in `out` just past the text
 */
export const http1PutText = (out: u8[], at: i32, text: string): i32 => {
  const n: i32 = toI32(text.length)
  if (at >= 0 && at <= toI32(out.length) - n) {
    // It fits, the case every caller makes sure of: one test, then a loop
    // with no bounds check in it.
    for (let k: i32 = 0; k < n; k += 1) {
      out[at + k] = toU8(text.charCodeAt(k))
    }
    return at + n
  }
  for (let k: i32 = 0; k < n && at + k < toI32(out.length); k += 1) {
    if (at + k >= 0) {
      out[at + k] = toU8(text.charCodeAt(k))
    }
  }
  return at + n
}

/** Writes CR LF at `out[at ..)`, likewise: two stores, where `http1PutText` walks a string. */
const http1PutCrlf = (out: u8[], at: i32): i32 => {
  if (at >= 0 && at < toI32(out.length) - 1) {
    out[at] = 13
    out[at + 1] = 10
  }
  return at + 2
}

/** Writes `: ` at `out[at ..)`, likewise. */
const http1PutColonSpace = (out: u8[], at: i32): i32 => {
  if (at >= 0 && at < toI32(out.length) - 1) {
    out[at] = 58
    out[at + 1] = 32
  }
  return at + 2
}

/** Writes `bytes` at `out[at ..)`, likewise, as one copy when it fits. */
const http1PutBytes = (out: u8[], at: i32, bytes: u8[]): i32 => {
  const n: i32 = toI32(bytes.length)
  if (at >= 0 && at <= toI32(out.length) - n) {
    copyBytes(out, at, bytes, 0, n)
    return at + n
  }
  for (let k: i32 = 0; k < n && at + k < toI32(out.length); k += 1) {
    if (at + k >= 0) {
      out[at + k] = bytes[k]
    }
  }
  return at + n
}

/**
 * Writes `text`, at most sixteen ASCII bytes, at `out[at ..)`, likewise, as
 * one sixteen-byte store of `v`, which holds `text` in its first lanes: when
 * `at + 16` does not pass `limit`, the end of the head being written, whose
 * every byte from `at` on is written after this one, so the lanes past
 * `text` are overwritten before the head is done. Byte by byte otherwise.
 */
const http1PutFixed = (out: u8[], at: i32, limit: i32, v: u8x16, text: string): i32 => {
  if (at >= 0 && at <= limit - 16 && limit <= toI32(out.length)) {
    store(v, out, at)
    return at + toI32(text.length)
  }
  return http1PutText(out, at, text)
}

/**
 * Writes `HTTP/1.1 `, the three digits of `status`, which is 100 to 599, and
 * a space at `out[at ..)`, likewise: one store, the digits replacing three
 * lanes of the constant.
 */
const http1PutStatusLine = (out: u8[], at: i32, limit: i32, status: i32): i32 => {
  const hundreds: i32 = status / 100
  const tens: i32 = (status / 10) % 10
  const ones: i32 = status % 10
  if (at >= 0 && at <= limit - 16 && limit <= toI32(out.length)) {
    // "HTTP/1.1 000 ", and three lanes the head's next bytes overwrite.
    const line: u8x16 = u8x16(72, 84, 84, 80, 47, 49, 46, 49, 32, 48, 48, 48, 32, 32, 32, 32)
    store(
      replace(replace(replace(line, 9, toU8(48 + hundreds)), 10, toU8(48 + tens)), 11, toU8(48 + ones)),
      out,
      at
    )
    return at + 13
  }
  const end: i32 = http1PutText(out, at, "HTTP/1.1 ")
  if (end >= 0 && end < toI32(out.length) - 3) {
    out[end] = toU8(48 + hundreds)
    out[end + 1] = toU8(48 + tens)
    out[end + 2] = toU8(48 + ones)
    out[end + 3] = 32
  }
  return end + 4
}

/** Writes the decimal digits of `n`, which is not negative, at `out[at ..)`, likewise. */
const http1PutDecimal = (out: u8[], at: i32, n: i32): i32 => {
  const digits: i32 = http1DecimalDigits(n)
  let v: i32 = n
  for (let k: i32 = at + digits - 1; k >= at && k >= 0 && k < toI32(out.length); k -= 1) {
    const digit: i32 = v % 10
    out[k] = toU8(48 + digit)
    v = v / 10
  }
  return at + digits
}

/**
 * `http1ResponseHead`'s status line and header section, written into `out` at
 * `at` with nothing allocated: field names and values are octets (as
 * `nish/net/http-fields` holds them), and `connection`, when not empty, is sent
 * as a `Connection` field after the caller's. `date`, when not empty, is sent
 * as a `Date` field between the caller's fields and the framing ones (RFC 9110
 * §6.6.1), on a final status only, and not when the caller's fields already
 * hold a `date` in any case: the caller's wins, so a response carries one.
 *
 * Answers where the head ends; `HTTP1_REFUSED` for everything
 * `http1ResponseHead` refuses, a `Connection` among the caller's fields when
 * `connection` is given, a `connection` that is not field text, two `date`
 * fields among the caller's (a singleton, RFC 9110 §5.3), and a `date`
 * that is not field text on a final status, the only one it is sent on;
 * `HTTP1_NO_ROOM` when it is well formed but does not fit, the `Date` line
 * counted when it is sent. Either way `out` is untouched.
 *
 * @param out the caller's buffer the head is written into
 * @param at where in `out` the head starts
 * @param status the status code, 100 to 599
 * @param reason the reason phrase after the code, which may be empty
 * @param names the caller's field names as octets, beside `values`
 * @param values the caller's field values as octets, `values[i]` for `names[i]`
 * @param bodyLength the body's length in bytes, or `HTTP1_CHUNKED` or `HTTP1_NO_BODY`
 * @param connection the `Connection` field's value to send, such as `"close"`, or empty for none
 * @param date the IMF-fixdate bytes to send as `Date`, or empty for none
 * @returns the offset in `out` just past the head, `HTTP1_REFUSED` for a head it will not write, or `HTTP1_NO_ROOM`
 */
export const http1WriteResponseHead = (
  out: u8[],
  at: i32,
  status: i32,
  reason: string,
  names: u8[][],
  values: u8[][],
  bodyLength: i32,
  connection: string,
  date: u8[]
): i32 => {
  if (status < 100 || status > 599 || !http1IsFieldText(reason) || !http1IsFieldText(connection)) {
    return HTTP1_REFUSED
  }
  if (status >= 200 && !http1BytesAreFieldText(date)) {
    return HTTP1_REFUSED
  }
  if (bodyLength < HTTP1_NO_BODY || ((status < 200 || status === 204) && bodyLength !== HTTP1_NO_BODY)) {
    return HTTP1_REFUSED
  }
  const count: i32 = toI32(names.length)
  if (toI32(values.length) !== count) {
    return HTTP1_REFUSED
  }
  // "HTTP/1.1 " status SP reason CRLF, then each field, then the framing
  // field, the connection field and the empty line: counted before anything
  // is written, in 64 bits so that no caller's lengths can wrap the sum.
  let need: i64 = toI64(17) + toI64(reason.length)
  let dated: boolean = false
  for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
    const name: u8[] = names[i]
    const value: u8[] = values[i]
    if (!http1BytesAreToken(name) || !http1BytesAreFieldText(value)) {
      return HTTP1_REFUSED
    }
    if (http1BytesAre(name, "content-length") || http1BytesAre(name, "transfer-encoding")) {
      return HTTP1_REFUSED
    }
    if (toI32(connection.length) > 0 && http1BytesAre(name, "connection")) {
      return HTTP1_REFUSED
    }
    if (http1BytesAre(name, "date")) {
      // Date is a singleton (RFC 9110 §5.3): a second one is refused.
      if (dated) {
        return HTTP1_REFUSED
      }
      dated = true
    }
    need = need + toI64(name.length) + toI64(value.length) + toI64(4)
  }
  const sendDate: boolean = status >= 200 && toI32(date.length) > 0 && !dated
  if (sendDate) {
    // "Date: " value CRLF: 37 bytes for an IMF-fixdate.
    need = need + toI64(8) + toI64(date.length)
  }
  if (bodyLength >= 0) {
    need = need + toI64(18 + http1DecimalDigits(bodyLength))
  } else if (bodyLength === HTTP1_CHUNKED) {
    need = need + toI64(28)
  }
  if (toI32(connection.length) > 0) {
    need = need + toI64(14) + toI64(connection.length)
  }
  if (at < 0 || at > toI32(out.length) || need > toI64(toI32(out.length) - at)) {
    return HTTP1_NO_ROOM
  }
  // A status is three digits, checked above: no division loop for them.
  const limit: i32 = at + toI32(need)
  let end: i32 = http1PutStatusLine(out, at, limit, status)
  end = http1PutText(out, end, reason)
  end = http1PutCrlf(out, end)
  for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
    end = http1PutBytes(out, end, names[i])
    end = http1PutColonSpace(out, end)
    end = http1PutBytes(out, end, values[i])
    end = http1PutCrlf(out, end)
  }
  if (sendDate) {
    end = http1PutFixed(
      out,
      end,
      limit,
      u8x16(68, 97, 116, 101, 58, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32),
      "Date: "
    )
    end = http1PutBytes(out, end, date)
    end = http1PutCrlf(out, end)
  }
  if (bodyLength >= 0) {
    end = http1PutFixed(
      out,
      end,
      limit,
      u8x16(67, 111, 110, 116, 101, 110, 116, 45, 76, 101, 110, 103, 116, 104, 58, 32),
      "Content-Length: "
    )
    end = http1PutDecimal(out, end, bodyLength)
    end = http1PutCrlf(out, end)
  } else if (bodyLength === HTTP1_CHUNKED) {
    end = http1PutText(out, end, "Transfer-Encoding: chunked\r\n")
  }
  if (toI32(connection.length) > 0) {
    end = http1PutFixed(
      out,
      end,
      limit,
      u8x16(67, 111, 110, 110, 101, 99, 116, 105, 111, 110, 58, 32, 32, 32, 32, 32),
      "Connection: "
    )
    end = http1PutText(out, end, connection)
    end = http1PutCrlf(out, end)
  }
  return http1PutCrlf(out, end)
}
