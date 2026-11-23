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
 *   request with more than one (§3.2, RFC 9110 §7.2), or a `Host` that is not
 *   `uri-host [":" port]` (§3.2, by `urlIsHostPort`); `Content-Length` that is
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
import { tryCopyBytes } from "nish/bytes"
import { urlIsHostPort } from "nish/net/url"
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
   * The request line (method to version, no CRLF) and then the header
   * section's lines with their CRLFs, the closing CRLF last, copied out of
   * `buf` as each is read, names in lowercase: what the spans below index.
   * A field's line runs from its name's start to its value's end, any OWS
   * around the value, and a CRLF; nothing else is in the head. The bytes from
   * `headLength` on are slack: the section scan stores a line's first bytes
   * there before the line is whole. Kept from one request to the next, so a
   * slot that has seen its largest head allocates nothing for the next one.
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
  /**
   * How much of `head` the request uses: the request line, each kept field
   * line and its CRLF, and the closing CRLF, so `headerCount + 1` CRLFs.
   */
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
   * The index of the last Host field, or -1.
   * @internal Set by the field-line parser in this module, and read by `http1EndOfHead`.
   */
  hostField: i32 = -1
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
    // The spans likewise wait for the first field line (`http1SpanSet`). An
    // empty array cannot be written, only replaced, so one serves for both
    // buffers. The lists share one only until the `restart` below, which
    // replaces both while `keepText` is on, as it is here even for a parser
    // `Http1Connection` turns it off on: the sharing saves one empty array,
    // not both.
    this.spans = []
    this.buf = []
    this.body = this.buf
    this.head = this.buf
    this.names = []
    this.values = this.names
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
    if (!this.tryFeed(data, off, len)) {
      panic("Http1Parser: the window is outside the buffer")
    }
  }

  /**
   * `feed` that answers false, taking nothing and leaving the parser as it
   * was, where `feed` panics: a window outside `data`. A caller a strict
   * module reaches uses this one.
   *
   * @param data the bytes the socket gave, which the parser copies and does not keep
   * @param off where in `data` the new bytes start
   * @param len how many bytes from `off` to append
   * @returns false when the window lies outside `data`; true otherwise, the
   *   bytes taken, dropped (a closed or refused parser) or refused with a 413
   */
  tryFeed(data: u8[], off: i32, len: i32): boolean {
    const size: i32 = toI32(data.length)
    if (off < 0 || len < 0 || off > size || len > size - off) {
      return false
    }
    if (this.state === HTTP1_S_CLOSED || this.state === HTTP1_S_ERROR) {
      return true
    }
    if (!http1Reserve(this, len)) {
      return true
    }
    const buf: u8[] = this.buf
    const at: i32 = this.end
    // One move: http1Reserve made room for `len` bytes at `at`, and the
    // window was checked above, so it always succeeds; were it to fail, the
    // parser refuses rather than drop the bytes.
    if (!tryCopyBytes(buf, at, data, off, len)) {
      http1Fail(this, 413, "the buffer could not take the input")
      return true
    }
    // In range, because the move fit: `at + len` is at most `buf.length`.
    this.end = toI32(toU32(at) + toU32(len))
    return true
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
    const spans: i32[] = this.spans
    const k: i32 = http1FieldSpans(this, name)
    if (k < 0 || k >= toI32(spans.length) - 3) {
      return null
    }
    const i: i32 = k >>> 2
    if (this.keepText && i < toI32(this.values.length)) {
      return this.values[i]
    }
    return http1Text(this.head, spans[k + 2], spans[k + 3], false)
  }

  /**
   * The index of the first field named `name` (any case), or -1.
   * @param name the field name to look for, compared in any case
   * @returns which field it is, so its spans are `spans[4 * i ..]`, or -1 when the request has none
   */
  headerIndex(name: string): i32 {
    const k: i32 = http1FieldSpans(this, name)
    return k < 0 ? -1 : k >>> 2
  }

  /**
   * Whether the first field named `name` (any case) has exactly the value `value`.
   * @param name the field name to look for, compared in any case
   * @param value the value to compare with, byte for byte
   * @returns true when that field exists and its trimmed value is `value`, with nothing allocated
   */
  headerIs(name: string, value: string): boolean {
    const spans: i32[] = this.spans
    const k: i32 = http1FieldSpans(this, name)
    if (k < 0 || k >= toI32(spans.length) - 3) {
      return false
    }
    return http1HeadIs(this.head, spans[k + 2], spans[k + 3], value, false)
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
    const n: i32 = toI32(spans.length)
    let found: i32 = -1
    // Field `i` has its spans at `spans[k ..]`, `k` four times `i`.
    let k: i32 = 0
    for (let i: i32 = 0; i < this.headerCount && k < n - 3; i += 1) {
      if (http1HeadIs(this.head, spans[k], spans[k + 1], "upgrade", false)) {
        if (found >= 0) {
          return false
        }
        found = k
      }
      k += 4
    }
    if (found < 0 || found >= n - 3) {
      return false
    }
    return http1HeadIs(this.head, spans[found + 2], spans[found + 3], protocol, true)
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
    // `start` never passes `end`, and both are offsets into `buf`.
    return toI32(toU32(this.end) - toU32(this.start))
  }

  /**
   * After `HTTP1_UPGRADE`: every byte fed past the request, as a fresh array.
   * @returns a copy the caller owns of the bytes that belong to the next protocol, empty when none arrived yet
   */
  upgradeBytes(): u8[] {
    const buf: u8[] = this.buf
    const to: i32 = this.end
    // Built by `push`, so no length is computed for `new Array`.
    const out: u8[] = []
    for (let k: i32 = this.start; k >= 0 && k < toI32(buf.length) && k < to; k += 1) {
      out.push(buf[k])
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
/** The spans a parser makes at its first field line: four per field, room for sixteen. */
const HTTP1_FIRST_SPANS: i32 = 64

/** The largest input buffer a parser grows to: 2^30 bytes. */
const HTTP1_MOST_INPUT: i32 = 1073741824

/**
 * Makes room for `len` more bytes at `p.end`, moving the live bytes down
 * first. False, with the parser refused, when that would take a buffer past
 * `HTTP1_MOST_INPUT` (a 413) or the live bytes are not a window of `buf` (a
 * 400).
 */
const http1Reserve = (p: Http1Parser, len: i32): boolean => {
  const old: u8[] = p.buf
  const capacity: u32 = toU32(old.length)
  const from: i32 = p.start
  if (len < 0 || from < 0 || p.end < from || p.end > toI32(capacity)) {
    // The parser keeps `0 <= start <= end <= buf.length`. The fields are
    // public, so a caller may have moved them: such a parser is refused with
    // a 400 rather than read outside `buf`.
    http1Fail(p, 400, "the input window is out of order")
    return false
  }
  // `len` is non-negative and `start <= end <= buf.length`, checked above, so
  // these unsigned counts are the real ones and add up without wrapping in u32.
  const want: u32 = toU32(len)
  const end: u32 = toU32(p.end)
  if (want <= capacity - end) {
    return true
  }
  const live: u32 = end - toU32(from)
  if (want > toU32(HTTP1_MOST_INPUT) - live) {
    http1Fail(p, 413, "more than 2^30 bytes buffered")
    return false
  }
  let size: u32 = capacity < toU32(HTTP1_FIRST_INPUT) ? toU32(HTTP1_FIRST_INPUT) : capacity
  while (size - live < want) {
    size = size * 2
  }
  // A fresh array when it has to grow, and the same one otherwise: either way
  // the live bytes move to the front, and every index into them moves too.
  // One move, overlapping when the buffer is the same one; the offsets keep it
  // in range.
  const buf: u8[] = size === capacity ? old : http1Grown(old, from, live, size)
  if (size === capacity && !tryCopyBytes(buf, 0, old, from, toI32(live))) {
    // Never false: the window was checked above. Were it, the parser is
    // refused rather than left with bytes it did not move.
    http1Fail(p, 400, "the input window is out of order")
    return false
  }
  p.buf = buf
  p.lineStart = toI32(toU32(p.lineStart) - toU32(from))
  p.lineEnd = toI32(toU32(p.lineEnd) - toU32(from))
  p.scan = toI32(toU32(p.scan) - toU32(from))
  p.start = 0
  p.end = toI32(live)
  return true
}

/**
 * A buffer of `size` bytes whose first `live` are `old[from ..]`. A size past
 * a `u16` is built by `push`, so no unchecked length reaches `new Array`; the
 * first input buffer, `HTTP1_FIRST_INPUT` bytes, is the common one and copies
 * nothing.
 */
const http1Grown = (old: u8[], from: i32, live: u32, size: u32): u8[] => {
  if (old.length === 0 && size === toU32(HTTP1_FIRST_INPUT)) {
    return new Array<u8>(HTTP1_FIRST_INPUT)
  }
  if (old.length === 0 && size === toU32(HTTP1_FIRST_HEAD)) {
    return new Array<u8>(HTTP1_FIRST_HEAD)
  }
  const to: i32 = toI32(toU32(from) + live)
  if (size <= toU32(65535)) {
    // A size that fits a `u16` is one allocation whose length needs no check.
    const sized: u8[] = new Array<u8>(toU16(toI32(size)))
    let at: i32 = 0
    for (let k: i32 = from; k >= 0 && k < toI32(old.length) && k < to && at < toI32(sized.length); k += 1) {
      sized[at] = old[k]
      at += 1
    }
    return sized
  }
  const buf: u8[] = []
  for (let k: i32 = from; k >= 0 && k < toI32(old.length) && k < to; k += 1) {
    buf.push(old[k])
  }
  while (toU32(buf.length) < size) {
    buf.push(0)
  }
  return buf
}

/** Refuses the input with `status`. Answers `HTTP1_ERROR`, so a caller can `return` it. */
const http1Fail = (p: Http1Parser, status: i32, reason: string): i32 => {
  p.state = HTTP1_S_ERROR
  p.status = status
  p.reason = reason
  p.keepAlive = false
  return HTTP1_ERROR
}

/**
 * Where the first field named `name` (any case) has its spans: `k` such that
 * the field is `spans[k .. k + 4)`, four times its index, or -1 when the
 * request has none.
 */
const http1FieldSpans = (p: Http1Parser, name: string): i32 => {
  const spans: i32[] = p.spans
  const count: i32 = p.headerCount
  const n: i32 = toI32(spans.length)
  let k: i32 = 0
  for (let i: i32 = 0; i < count && k < n - 3; i += 1) {
    if (http1HeadIs(p.head, spans[k], spans[k + 1], name, true)) {
      return k
    }
    k += 4
  }
  return -1
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
  p.hostField = -1
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
  const from: i32 = p.start
  if (from < 0 || end < from) {
    // The parser keeps `0 <= start <= end`. The fields are public, so a caller may
    // have moved them: such a parser is refused with a 400 rather than read
    // outside `buf`.
    return http1Fail(p, 400, "the input window is out of order")
  }
  let i: i32 = from
  if (p.scan > from) {
    i = p.scan
  } else {
    p.lineControl = false
  }
  const stop: i32 = end < toI32(buf.length) ? end : toI32(buf.length)
  while (i >= 0 && i < stop && i < toI32(buf.length)) {
    // Most bytes are printable: sixteen at a time while a whole vector is,
    // and the vector that is not answers where its first control byte is.
    // The bytes after a control byte, and a tail shorter than a vector, go
    // one at a time.
    let found: boolean = false
    while (!found && i >= 0 && i <= toI32(buf.length) - 16 && i + 16 <= stop) {
      const v: u8x16 = loadU8x16(buf, i)
      const bad: u32 = toU32(bitmask(or(lt(v, splatU8x16(32)), eq(v, splatU8x16(127)))))
      if (bad !== 0) {
        // The lowest set lane, 0 to 15: sixteen lanes set at most bit 15.
        const lane: i32 = toI32(31) - toI32(Math.clz32(bad & (toU32(0) - bad)))
        if (lane >= 0 && lane < 16) {
          i += lane
        }
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
    const c: i32 = toI32(buf[i])
    if (c === 13 && i + 1 < stop && i < toI32(buf.length) - 1 && buf[i + 1] === 10) {
      // CRLF, the end of almost every line: its LF is the next byte, so it
      // is taken here rather than by another trip through the scan.
      if (i - from > limit) {
        return http1Fail(p, overStatus, "a line over its limit")
      }
      p.lineStart = from
      p.lineEnd = i
      p.start = i + 2
      p.scan = i + 2
      return HTTP1_LINE
    }
    if (c === 10) {
      // A CR before it would have ended the line above, or waited at the end
      // of the bytes for this one.
      return http1Fail(p, 400, "a line ended in a bare LF")
    }
    if (c === 13 && i + 1 >= stop) {
      // A CR at the end of the bytes so far: whether it ends the line is
      // the next byte's to say, so the next call looks at it again.
      break
    }
    if (c !== 9) {
      // A control byte, or a CR with no LF after it.
      p.lineControl = true
    }
    i += 1
  }
  p.scan = i
  // `0 <= from <= end`, checked above, so the u32 difference is the count
  // held; the limits are small constants.
  if (toU32(end) - toU32(from) > toU32(limit) + toU32(1)) {
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
    const bad: u32 = toU32(http1NonTokenLanes(v))
    let run: i32 = 16
    if (bad !== 0) {
      // The lowest set lane, 0 to 15.
      run = toI32(31) - toI32(Math.clz32(bad & (toU32(0) - bad)))
    }
    // `0 <= k < stop`, so the u32 difference is the bytes left.
    const left: i32 = toI32(toU32(stop) - toU32(k))
    if (run > left) {
      run = left
    }
    const upper: mask8x16 = and(
      lt(subWrapping(v, splatU8x16(65)), splatU8x16(26)),
      lt(lanes, splatU8x16(toU8(run)))
    )
    store(select(upper, or(v, splatU8x16(32)), v), head, k)
    // `run` is at most the bytes left before `stop`, so the sum fits.
    k = toI32(toU32(k) + toU32(run))
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
  // `0 <= a <= b`, so the u32 difference is the slice's length.
  if (a < 0 || b < a || b > toI32(text.length) || toI32(toU32(b) - toU32(a)) !== n) {
    return false
  }
  let j: i32 = a
  for (let k: i32 = 0; k < n && j >= 0 && j < b; k += 1) {
    let c: i32 = toI32(text.charCodeAt(j))
    j += 1
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
  // `0 <= a <= b`, so the u32 difference is the slice's length.
  if (a < 0 || b < a || b > toI32(bytes.length) || toI32(toU32(b) - toU32(a)) !== n) {
    return false
  }
  // `j` walks `bytes[a .. b)` beside `k`: the lengths are equal.
  let j: i32 = a
  if (!fold) {
    for (let k: i32 = 0; k < n && j >= 0 && j < toI32(bytes.length); k += 1) {
      if (toI32(word.charCodeAt(k)) !== toI32(bytes[j])) {
        return false
      }
      j += 1
    }
    return true
  }
  for (let k: i32 = 0; k < n && j >= 0 && j < toI32(bytes.length); k += 1) {
    let c: i32 = toI32(word.charCodeAt(k))
    let d: i32 = toI32(bytes[j])
    j += 1
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
 * common one stays small enough to inline. It answers false, and grows
 * nothing, when the head would pass 2^30 bytes: the caller refuses it.
 */
const http1HeadGrow = (p: Http1Parser, n: i32): boolean => {
  const old: u8[] = p.head
  const capacity: u32 = toU32(old.length)
  // u32 throughout: each term is at most 2^30 once checked, so no sum wraps.
  const at: u32 = toU32(p.headLength)
  const more: u32 = n < 0 ? toU32(0) : toU32(n)
  const most: u32 = toU32(HTTP1_MOST_INPUT) - toU32(16)
  if (at > most || more > most - at) {
    return false
  }
  const want: u32 = at + more + toU32(16)
  let size: u32 = capacity < toU32(HTTP1_FIRST_HEAD) ? toU32(HTTP1_FIRST_HEAD) : capacity
  while (size < want) {
    size = size * 2
  }
  if (size !== capacity) {
    p.head = http1Grown(old, 0, capacity, size)
  }
  return true
}

/**
 * Copies `buf[from .. to)` to the end of `head` and answers where the copy
 * starts: the request line, the one line the section scan does not copy
 * itself. It relies on the caller having called `http1HeadGrow` when the
 * line would leave fewer than sixteen bytes of slack; without that it copies
 * nothing and only moves `headLength`. The head keeps sixteen bytes past its
 * last line, so a short line is copied as whole vectors and a vector load at
 * any byte of the head is in bounds: the name and value compares read one. A
 * vector's lanes past the line write bytes past `headLength`, which nothing
 * reads until the section scan overwrites them. It answers -1, with the
 * parser refused, when the line or the head's length is out of order or the
 * line does not fit: the caller returns `HTTP1_ERROR` then.
 */
const http1HeadAppend = (p: Http1Parser, from: i32, to: i32): i32 => {
  const at: i32 = p.headLength
  if (from < 0 || to < from || at < 0) {
    // `http1RequestLine` checks the line and grows the head first, so this
    // refuses only a parser whose public fields were moved out of order.
    http1Fail(p, 400, "the request line is outside the buffer")
    return -1
  }
  // `0 <= from <= to`, so the u32 difference is the line's length.
  const n: i32 = toI32(toU32(to) - toU32(from))
  const head: u8[] = p.head
  const buf: u8[] = p.buf
  // A line of up to 32 bytes is one or two vector stores; a longer one, or
  // one that ends within a vector of `buf`'s end, is one `copyBytes`, which
  // outruns a loop of stores at a Cookie or User-Agent line's length.
  if (n <= 16 && from <= toI32(buf.length) - 16 && at <= toI32(head.length) - 16) {
    store(loadU8x16(buf, from), head, at)
  } else if (n <= 32 && from <= toI32(buf.length) - 32 && at <= toI32(head.length) - 32) {
    store(loadU8x16(buf, from), head, at)
    store(loadU8x16(buf, from + 16), head, at + 16)
  } else if (!tryCopyBytes(head, at, buf, from, n)) {
    // `http1HeadGrow` left room for the line, so this refuses only a head
    // moved by hand.
    http1Fail(p, 400, "the request line does not fit the head")
    return -1
  }
  // Both are at most 2^30, so the u32 sum fits.
  p.headLength = toI32(toU32(at) + toU32(n))
  return at
}

/** Sets `spans[at]`, growing the array when it must: first to `HTTP1_FIRST_SPANS`, then by doubling. */
const http1SpanSet = (p: Http1Parser, at: i32, value: i32): void => {
  if (at >= toI32(p.spans.length)) {
    const old: i32[] = p.spans
    // Built by `push`, so no length is computed for `new Array`; `at` counts
    // four spans a field, far below 2^31, so the u32 size does not wrap.
    const size: u32 = at < HTTP1_FIRST_SPANS ? toU32(HTTP1_FIRST_SPANS) : toU32(at) * toU32(2) + toU32(4)
    const grown: i32[] = []
    for (let k: i32 = 0; k < toI32(old.length); k += 1) {
      grown.push(old[k])
    }
    while (toU32(grown.length) < size) {
      grown.push(0)
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
  while (start >= 0 && start <= to && start <= toI32(head.length)) {
    // The element runs to the next comma, or to the value's end.
    let end: i32 = start
    while (end >= 0 && end < to && end < toI32(head.length) && head[end] !== 44) {
      end += 1
    }
    let a: i32 = start
    let b: i32 = end
    while (a >= 0 && a < b && a < toI32(head.length) && http1IsOws(toI32(head[a]))) {
      a += 1
    }
    while (b > a && b > 0 && b <= toI32(head.length) && http1IsOws(toI32(head[b - 1]))) {
      b -= 1
    }
    // Each element holds a byte of a head under 2^30 bytes, so the counts
    // stay below it.
    const elements: i32 = tally.elements
    if (b > a && elements < HTTP1_MOST_INPUT) {
      tally.elements = elements + 1
      tally.lastMatches = http1HeadIs(head, a, b, word, true)
      const matches: i32 = tally.matches
      if (tally.lastMatches && matches < HTTP1_MOST_INPUT) {
        tally.matches = matches + 1
      }
    }
    if (end < 0 || end >= to || end >= toI32(head.length)) {
      break
    }
    start = end + 1
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
  const n: i32 = toI32(spans.length)
  let k: i32 = 0
  for (let i: i32 = 0; i < p.headerCount && k < n - 3; i += 1) {
    if (http1HeadIs(p.head, spans[k], spans[k + 1], name, false)) {
      http1TallyRun(tally, p.head, spans[k + 2], spans[k + 3], word)
    }
    k += 4
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
  if (at < 0 || n < 0 || n > 16) {
    // No word compared here is longer than a vector, so nothing matches.
    return false
  }
  if (at > toI32(head.length) - 16) {
    // An offset into the head and a length of at most 16: the u32 sum fits.
    return http1HeadIs(head, at, toI32(toU32(at) + toU32(n)), text, fold)
  }
  let v: u8x16 = loadU8x16(head, at)
  if (fold) {
    v = select(lt(subWrapping(v, splatU8x16(65)), splatU8x16(26)), or(v, splatU8x16(32)), v)
  }
  const want: i32 = n >= 16 ? 65535 : toI32((toU32(1) << toU32(n)) - toU32(1))
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
    const g: boolean = at >= 0 && at < toI32(head.length) - 16 && head[at + 16] === 103
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
  while (start >= 0 && start <= to && start <= length) {
    // The element runs to the next comma, or to the value's end.
    let end: i32 = start
    let seeking: boolean = true
    while (seeking && end >= 0 && end < to) {
      if (end <= length - 16) {
        const commas: u32 = toU32(bitmask(eq(loadU8x16(head, end), splatU8x16(44))))
        if (commas !== 0) {
          // The lowest set lane, 0 to 15.
          const lane: i32 = toI32(31) - toI32(Math.clz32(commas & (toU32(0) - commas)))
          if (lane >= 0 && lane < 16) {
            end += lane
          }
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
    while (a < b && a >= 0 && a < length && http1IsOws(toI32(head[a]))) {
      a += 1
    }
    while (b > a && b > 0 && b <= toI32(head.length) && http1IsOws(toI32(head[b - 1]))) {
      b -= 1
    }
    // `0 <= a <= b`, so the u32 difference is the element's length.
    const n: i32 = a >= 0 && b >= a ? toI32(toU32(b) - toU32(a)) : 0
    if (n === 5 && http1HeadIsVector(head, a, n, close, "close", true)) {
      found = found | HTTP1_CONNECTION_CLOSE
    } else if (n === 10 && http1HeadIsVector(head, a, n, keepAlive, "keep-alive", true)) {
      found = found | HTTP1_CONNECTION_KEEP_ALIVE
    } else if (n === 7 && http1HeadIsVector(head, a, n, upgrade, "upgrade", true)) {
      found = found | HTTP1_CONNECTION_UPGRADE
    }
    if (end < 0 || end >= to || end >= length) {
      break
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
  const from: i32 = p.start
  if (from < 0 || p.scan < from) {
    // The parser keeps `0 <= start <= scan`. The fields are public, so a
    // caller may have moved them: such a window says nothing about the
    // method, and `http1TakeLine` refuses the parser with a 400.
    return false
  }
  if (toU32(p.scan) - toU32(from) > toU32(HTTP1_MAX_METHOD)) {
    return false
  }
  const buf: u8[] = p.buf
  const n: i32 = toI32(buf.length)
  // A space, CR or LF in the first sixteen bytes, buffered or not, is
  // before `HTTP1_MAX_METHOD`: the loop below would answer false at it, or
  // at `end` before it.
  if (from <= n - 16) {
    const v: u8x16 = loadU8x16(buf, from)
    if (any(or(or(eq(v, splatU8x16(32)), eq(v, splatU8x16(13))), eq(v, splatU8x16(10))))) {
      return false
    }
  }
  // `start` is within a buffer under 2^30 bytes, so the sum is an i32.
  const stop: i32 = toI32(toU32(from) + toU32(HTTP1_MAX_METHOD))
  for (let k: i32 = from; k >= 0 && k < p.end && k < toI32(buf.length); k += 1) {
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
  if (a < 0 || b < a) {
    // `http1TakeLine` hands out a line inside `buf`. The fields are public, so a
    // caller may have moved them: such a parser is refused with a 400 rather than
    // read outside `buf`.
    return http1Fail(p, 400, "the request line is out of order")
  }
  // The method is tchars, sixteen at a time as a field name is read; the
  // line's CR, a control byte, ends the run if no space or other byte does.
  let i: i32 = a
  let ended: boolean = false
  while (!ended && i >= 0 && i < b && i <= toI32(buf.length) - 16) {
    const bad: u32 = toU32(http1NonTokenLanes(loadU8x16(buf, i)))
    if (bad !== 0) {
      // The lowest set lane, 0 to 15.
      const lane: i32 = toI32(31) - toI32(Math.clz32(bad & (toU32(0) - bad)))
      if (lane >= 0 && lane < 16) {
        i += lane
      }
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
  // `a <= i`, so the u32 difference is the method's length.
  if (
    i === a ||
    toU32(i) - toU32(a) > toU32(HTTP1_MAX_METHOD) ||
    i >= b ||
    i < 0 ||
    i >= toI32(buf.length) ||
    buf[i] !== 32
  ) {
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
    const bad: u32 = toU32(bitmask(gt(subWrapping(loadU8x16(buf, i), splatU8x16(33)), splatU8x16(93))))
    if (bad !== 0) {
      // The lowest set lane, 0 to 15.
      const lane: i32 = toI32(31) - toI32(Math.clz32(bad & (toU32(0) - bad)))
      if (lane >= 0 && lane < 16) {
        i += lane
      }
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
  // `targetStart <= i`, so the u32 difference is the target's length.
  if (toU32(i) - toU32(targetStart) > toU32(p.maxTarget)) {
    return http1Fail(p, 414, "the request target is over the limit")
  }
  if (i === targetStart || i >= b || i < 0 || i >= toI32(buf.length) || buf[i] !== 32) {
    return http1Fail(p, 400, "a malformed request target")
  }
  const targetEnd: i32 = i
  i += 1
  // "HTTP/" DIGIT "." DIGIT, case-sensitive (§2.3), and the end of the line:
  // with sixteen bytes to load, one compare for the five letters and the dot
  // and one range test for the two digits, else a byte at a time.
  let version: boolean = false
  // `i < b` here, so the u32 difference is what is left of the line.
  const eight: boolean = i >= 0 && i <= b && toU32(b) - toU32(i) === toU32(8)
  if (eight && i <= toI32(buf.length) - 16) {
    const v: u8x16 = loadU8x16(buf, i)
    const fixed: i32 = bitmask(eq(v, u8x16(72, 84, 84, 80, 47, 0, 46, 0, 0, 0, 0, 0, 0, 0, 0, 0)))
    const digits: i32 = bitmask(lt(subWrapping(v, splatU8x16(48)), splatU8x16(10)))
    version = (fixed & 95) === 95 && (digits & 160) === 160
  } else if (eight && i <= toI32(buf.length) - 8) {
    version =
      buf[i] === 72 &&
      buf[i + 1] === 84 &&
      buf[i + 2] === 84 &&
      buf[i + 3] === 80 &&
      buf[i + 4] === 47 &&
      buf[i + 5] >= 48 &&
      buf[i + 5] <= 57 &&
      buf[i + 6] === 46 &&
      buf[i + 7] >= 48 &&
      buf[i + 7] <= 57
  }
  if (!version || i < 0 || i > toI32(buf.length) - 8) {
    return http1Fail(p, 400, "a malformed HTTP version")
  }
  if (buf[i + 5] !== 49) {
    return http1Fail(p, 505, "an HTTP major version other than 1")
  }
  p.minor = buf[i + 7] === 48 ? 0 : 1
  // `a <= b`, checked above.
  const lineLength: i32 = toI32(toU32(b) - toU32(a))
  if (p.headLength < 0 || toU64(p.headLength) + toU64(lineLength) + toU64(16) > toU64(p.head.length)) {
    if (!http1HeadGrow(p, lineLength)) {
      return http1Fail(p, 431, "a head of more than 2^30 bytes")
    }
  }
  const at: i32 = http1HeadAppend(p, a, b)
  if (at < 0) {
    return HTTP1_ERROR
  }
  p.methodStart = at
  // Each mark is within the line, `a` to `b`, and the line is in the head.
  p.methodEnd = http1Past(at, toI32(toU32(methodEnd) - toU32(a)))
  p.targetStart = http1Past(at, toI32(toU32(targetStart) - toU32(a)))
  p.targetEnd = http1Past(at, toI32(toU32(targetEnd) - toU32(a)))
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
  if (a < 0 || b < a) {
    // `http1Section` hands out a line inside `buf`. The fields are public, so a
    // caller may have moved them: such a parser is refused with a 400 rather than
    // read outside `buf`.
    return http1Fail(p, 400, "a field line out of order")
  }
  // Every offset below is in the line, `a` to `b`, or its copy in the head,
  // both under 2^31 bytes, so they are added with `http1Past` and
  // subtracted with `http1Less`, which do not check what cannot wrap.
  // A kept line's name is read in the head's copy, each upper-case letter
  // lowered as the scan passes it: one walk over the name, not a check of
  // `buf` and then a second walk of the copy. The copy of a line refused
  // below is never read, since a refusal ends the parse.
  let at: i32 = 0
  let i: i32 = a
  if (keep) {
    at = http1Past(a, delta)
    i = http1Past(a, http1Less(http1LowerName(p.head, at, http1Past(at, http1Less(b, a))), at))
  } else {
    while (i >= 0 && i < b && i < toI32(buf.length) && http1IsTokenByte(toI32(buf[i]))) {
      i += 1
    }
  }
  if (i === a || i >= b || i < 0 || i >= toI32(buf.length) || buf[i] !== 58) {
    // Whitespace is no tchar, so an obs-fold line has an empty name: its
    // own refusal is told apart here, off the path every field takes.
    if (i === a && a >= 0 && a < b && a < toI32(buf.length) && (buf[a] === 32 || buf[a] === 9)) {
      return http1Fail(p, 400, "a field line that starts with whitespace (obs-fold)")
    }
    return http1Fail(p, 400, "a malformed field name")
  }
  const nameEnd: i32 = i
  // The name is tchars and the colon is field text, so a byte no value may
  // hold anywhere on the line is one in the value.
  if (p.lineControl) {
    return http1Fail(p, 400, "a control character in a field value")
  }
  // The count is at most `maxHeaders` before it, checked below each time.
  p.fieldCount = http1Past(p.fieldCount, 1)
  if (p.fieldCount > p.maxHeaders) {
    return http1Fail(p, 431, "more fields than the limit")
  }
  // A trailer is checked and counted, but not kept: nothing here reads one.
  if (keep) {
    let valueStart: i32 = http1Past(nameEnd, 1)
    let valueEnd: i32 = b
    while (
      valueStart >= 0 &&
      valueStart < valueEnd &&
      valueStart < toI32(buf.length) &&
      (buf[valueStart] === 32 || buf[valueStart] === 9)
    ) {
      valueStart += 1
    }
    while (
      valueEnd >= 1 &&
      valueEnd > valueStart &&
      valueEnd <= toI32(buf.length) &&
      (buf[valueEnd - 1] === 32 || buf[valueEnd - 1] === 9)
    ) {
      valueEnd -= 1
    }
    // The fields that frame the message are counted here, as their names
    // are read, for `http1EndOfHead`: every kept field asks the same question.
    // Each count is at most `fieldCount`, and the value bytes at most the
    // head's.
    const kind: i32 = http1FramingField(p.head, at, http1Less(nameEnd, a))
    if (kind === HTTP1_FIELD_HOST) {
      p.hostFields = http1Past(p.hostFields, 1)
      p.hostField = p.headerCount
    } else if (kind === HTTP1_FIELD_LENGTH) {
      p.lengthFields = http1Past(p.lengthFields, 1)
      p.lengthField = p.headerCount
    } else if (kind === HTTP1_FIELD_CODING) {
      p.codingFields = http1Past(p.codingFields, 1)
    } else if (kind === HTTP1_FIELD_CONNECTION) {
      p.connectionOptions =
        p.connectionOptions |
        http1ConnectionList(
          p.head,
          http1Past(at, http1Less(valueStart, a)),
          http1Past(at, http1Less(valueEnd, a))
        )
    } else if (kind === HTTP1_FIELD_UPGRADE) {
      p.upgradeFields = http1Past(p.upgradeFields, 1)
      p.upgradeValueBytes = http1Past(p.upgradeValueBytes, http1Less(valueEnd, valueStart))
    }
    // Four spans a field, and fields are at most `maxHeaders`.
    const base: i32 = toI32(toU32(4) * toU32(p.headerCount))
    http1SpanSet(p, http1Past(base, 3), http1Past(at, http1Less(valueEnd, a)))
    // The last of the four is set first, so the array has room for them all.
    const spans: i32[] = p.spans
    if (base >= 0 && base < toI32(spans.length) - 2) {
      spans[base] = at
      spans[base + 1] = http1Past(at, http1Less(nameEnd, a))
      spans[base + 2] = http1Past(at, http1Less(valueStart, a))
    }
    p.headerCount = http1Past(p.headerCount, 1)
    if (p.keepText) {
      p.names.push(http1Text(buf, a, nameEnd, true))
      p.values.push(http1Text(buf, valueStart, valueEnd, false))
    }
  }
  return HTTP1_NEED_MORE
}

/**
 * Where field `field`'s four spans start in `spans`: `4 * field`, or -1 when
 * no such field is recorded.
 */
const http1FieldBase = (spans: i32[], field: i32): i32 => {
  if (field < 0 || field > 536870911) {
    return -1
  }
  // `field < 2^29`, so the shifted index is below 2^31.
  const k: i32 = toI32(toU32(field) << toU32(2))
  return k < toI32(spans.length) - 3 ? k : -1
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
  const lengthAt: i32 = http1FieldBase(spans, p.lengthField)
  if ((p.minor === 1 && hosts !== 1) || hosts > 1) {
    return http1Fail(p, 400, "a request without exactly one Host")
  }
  // The one Host must be a host and an optional port (§3.2): a value such as
  // `a@b`, `a/b` or `a, b` is read one way by this program and another by a
  // proxy or a virtual-host table in front of it. An empty Host is allowed.
  const hostAt: i32 = http1FieldBase(spans, p.hostField)
  if (
    hosts === 1 &&
    hostAt >= 0 &&
    hostAt < toI32(spans.length) - 3 &&
    !urlIsHostPort(head, spans[hostAt + 2], spans[hostAt + 3])
  ) {
    return http1Fail(p, 400, "a Host that is not a host and port")
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
  } else if (lengths === 1 && lengthAt >= 0 && lengthAt < toI32(spans.length) - 3) {
    const size: i32 = http1ContentLength(head, spans[lengthAt + 2], spans[lengthAt + 3], p.maxBody)
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
  // In 32 unsigned bits: `value` never passes `limit`, an i32, so it
  // neither wraps nor fails to fit back.
  let value: u32 = 0
  let over: boolean = limit < 0
  const most: u32 = toU32(limit)
  for (let k: i32 = from; k < to && k >= 0 && k < toI32(bytes.length); k += 1) {
    const c: i32 = toI32(bytes[k])
    if (c < 48 || c > 57) {
      return -1
    }
    if (!over) {
      // The digit is compared on its own first, so `most - digit` does not wrap.
      const digit: u32 = toU32(c) - toU32(48)
      if (digit > most || value > (most - digit) / toU32(10)) {
        over = true
      } else {
        value = value * toU32(10) + digit
      }
    }
  }
  return over ? -2 : toI32(value)
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
 * Where the quoted-string that opens at `bytes[from]` ends (RFC 9110 §5.6.4):
 * the index just past its closing DQUOTE, or -1 when the line ends first or
 * a byte inside is neither qdtext nor a quoted-pair. A backslash takes the
 * byte after it whatever it is, a DQUOTE included, as long as that byte is
 * HTAB, SP, VCHAR or obs-text.
 */
const http1QuotedStringEnd = (bytes: u8[], from: i32, to: i32): i32 => {
  let i: i32 = from + 1
  while (i >= 0 && i < to && i < toI32(bytes.length)) {
    const c: i32 = toI32(bytes[i])
    if (c === 34) {
      return i + 1
    }
    if (c === 92) {
      i += 1
      if (i < 0 || i >= to || i >= toI32(bytes.length) || !http1IsValueByte(toI32(bytes[i]))) {
        return -1
      }
    } else if (!http1IsValueByte(c)) {
      return -1
    }
    i += 1
  }
  return -1
}

/** The first index from `from` on, before `to`, that is not OWS. */
const http1SkipOws = (bytes: u8[], from: i32, to: i32): i32 => {
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(bytes.length) && http1IsOws(toI32(bytes[i]))) {
    i += 1
  }
  return i
}

/**
 * Whether `bytes[from .. to)`, what follows a chunk size on its line, is the
 * chunk-ext of RFC 9112 §7.1.1 and nothing else:
 * `*( BWS ";" BWS chunk-ext-name [ BWS "=" BWS chunk-ext-val ] )`, the name
 * a token and the value a token or a quoted-string. An empty window holds no
 * extensions and is valid. The extensions are not interpreted, but they are
 * parsed whole: a parser that skips to the line's end and one that reads a
 * quoted-string across it disagree about where the chunk's data starts (the
 * chunk-extension smuggling of Jetty's CVE-2026-2332 and Netty's
 * CVE-2026-33870), so an unclosed quote, an empty name or value, a stray `;`
 * or `=`, and whitespace that leads nowhere are each refused. The server's
 * parser and the client's both read their chunk-size lines through this.
 * @param bytes the buffer holding the chunk-size line
 * @param from the index just past the chunk size's last hex digit
 * @param to the index of the line's CR, exclusive
 * @returns true when the window is zero or more well-formed chunk extensions
 */
export const http1ChunkExtValid = (bytes: u8[], from: i32, to: i32): boolean => {
  const end: i32 = to < toI32(bytes.length) ? to : toI32(bytes.length)
  let i: i32 = from
  while (i >= 0 && i < end) {
    i = http1SkipOws(bytes, i, end)
    if (i < 0 || i >= end || i >= toI32(bytes.length) || toI32(bytes[i]) !== 59) {
      return false
    }
    i = http1SkipOws(bytes, i + 1, end)
    const nameStart: i32 = i
    while (i >= 0 && i < end && i < toI32(bytes.length) && http1IsTokenByte(toI32(bytes[i]))) {
      i += 1
    }
    if (i === nameStart) {
      return false
    }
    const nameEnd: i32 = i
    i = http1SkipOws(bytes, i, end)
    if (i >= 0 && i < end && i < toI32(bytes.length) && toI32(bytes[i]) === 61) {
      i = http1SkipOws(bytes, i + 1, end)
      if (i >= 0 && i < end && i < toI32(bytes.length) && toI32(bytes[i]) === 34) {
        i = http1QuotedStringEnd(bytes, i, end)
        if (i < 0) {
          return false
        }
      } else {
        const valueStart: i32 = i
        while (i >= 0 && i < end && i < toI32(bytes.length) && http1IsTokenByte(toI32(bytes[i]))) {
          i += 1
        }
        if (i === valueStart) {
          return false
        }
      }
    } else {
      // Whitespace after a name is BWS only before the next `;`, which the
      // loop's next turn reads from the name's end.
      i = nameEnd
    }
  }
  return true
}

/**
 * Reads a chunk-size line (§7.1): 1*HEXDIG, then the chunk extensions
 * `http1ChunkExtValid` reads, parsed but not interpreted. Sets `left` and
 * answers `HTTP1_NEED_MORE`, or the refusal.
 */
const http1ChunkSize = (p: Http1Parser): i32 => {
  const buf: u8[] = p.buf
  const n: i32 = toI32(buf.length)
  const a: i32 = p.lineStart
  const b: i32 = p.lineEnd < n ? p.lineEnd : n
  // Never more than `maxBody` is counted, so `room` is not negative.
  const total: i32 = p.bodyTotal
  const room: u32 = total >= 0 && total <= p.maxBody ? toU32(p.maxBody) - toU32(total) : toU32(0)
  // In 32 unsigned bits: `size` never passes `room`, an i32.
  let size: u32 = 0
  let over: boolean = false
  let i: i32 = a
  while (i >= 0 && i < b && i < toI32(buf.length)) {
    const hex: i32 = http1HexValue(toI32(buf[i]))
    if (hex < 0) {
      break
    }
    if (!over) {
      const digit: u32 = toU32(hex)
      if (digit > room || size > (room - digit) / toU32(16)) {
        over = true
      } else {
        size = size * toU32(16) + digit
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
  if (i >= 0 && i < b && i < toI32(buf.length)) {
    if (buf[i] !== 59) {
      return http1Fail(p, 400, "a malformed chunk size")
    }
    for (let k: i32 = i + 1; k >= 0 && k < b && k < toI32(buf.length); k += 1) {
      if (!http1IsValueByte(toI32(buf[k]))) {
        return http1Fail(p, 400, "a control character in a chunk extension")
      }
    }
    if (!http1ChunkExtValid(buf, digitsEnd, b)) {
      return http1Fail(p, 400, "a malformed chunk extension")
    }
  }
  if (over) {
    return http1Fail(p, 413, "a chunked body over the limit")
  }
  p.left = toI32(size)
  p.state = size === 0 ? HTTP1_S_TRAILERS : HTTP1_S_CHUNK_DATA
  p.sectionBytes = 0
  return HTTP1_NEED_MORE
}

/**
 * Hands the caller up to `p.left` of the buffered body bytes, and moves to
 * `after` once the last of them is handed out.
 */
const http1BodyWindow = (p: Http1Parser, after: i32): i32 => {
  const from: i32 = p.start
  const to: i32 = p.end
  if (from < 0 || to <= from) {
    return HTTP1_NEED_MORE
  }
  const ready: i32 = toI32(toU32(to) - toU32(from))
  let take: i32 = ready < p.left ? ready : p.left
  if (take > p.maxChunk && p.maxChunk > 0) {
    take = p.maxChunk
  }
  const total: i32 = p.bodyTotal
  if (take < 0 || total < 0) {
    // The parser keeps `left` and the body's total 0 or more. The fields are
    // public, so a caller may have moved them: such a parser is refused with a 400
    // rather than read outside `buf`.
    return http1Fail(p, 400, "the body window is out of order")
  }
  p.body = p.buf
  p.bodyOff = from
  p.bodyLen = take
  // `take` is at most `end - start`, and at most `left`, which was counted
  // within `maxBody`: none of the three wraps.
  p.start = http1Past(from, take)
  p.scan = p.start
  p.left = toI32(toU32(p.left) - toU32(take))
  p.bodyTotal = http1Past(total, take)
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
  //
  // Every offset here is a position in `buf` or the head, both under 2^31
  // bytes, and `delta` moves one to the other, so the sums below are taken
  // with `http1Past` and `http1Less`, which do not check what cannot pass.
  const copy: boolean = !trailer
  const delta: i32 = http1Less(p.headLength, p.start)
  const wideStop: i64 = toI64(p.start) + toI64(p.maxHeaderBytes) - toI64(p.sectionBytes) + toI64(2)
  let copyStop: i32 = 2147483647
  if (wideStop >= toI64(-2147483647) && wideStop < toI64(2147483647)) {
    copyStop = toI32(wideStop)
  }
  // A vector at `q` is copied when `q < copyEnd`; the head is grown when `q`
  // passes `growAt`, so most vectors pay one compare for each.
  const copyEnd: i32 = copy ? copyStop : -2147483647
  let head: u8[] = p.head
  let growAt: i32 = http1Less(http1Less(toI32(head.length), 32), delta)
  // Bit `k` of `bits` is set when `buf[base + k]` is a control byte or DEL
  // at or past `i`: the vector last loaded, its lanes before `i` cleared.
  let base: i32 = http1Less(i, 16)
  let bits: u32 = 0
  while (true) {
    // The next control byte at or past `i`, or the end of the bytes so far.
    let j: i32 = stop
    let seeking: boolean = true
    while (seeking) {
      if (bits !== 0) {
        // The lowest set bit, 0 to 15.
        j = http1Past(base, toI32(31) - toI32(Math.clz32(bits & (toU32(0) - bits))))
        seeking = false
      } else {
        const next: i32 = http1Past(base, 16)
        const q: i32 = next > i ? next : i
        if (q >= stop) {
          seeking = false
        } else if (q >= 0 && q <= toI32(buf.length) - 16) {
          // The vector may run past `stop` into bytes not yet fed: its lanes
          // there are dropped from `bits`, and its copy of them is
          // overwritten when they arrive.
          const v: u8x16 = loadU8x16(buf, q)
          if (q < copyEnd) {
            if (q > growAt) {
              if (!http1HeadGrow(p, http1Less(http1Past(http1Past(q, delta), 16), p.headLength))) {
                return http1Fail(p, 431, "a head of more than 2^30 bytes")
              }
              head = p.head
              growAt = http1Less(http1Less(toI32(head.length), 32), delta)
            }
            // `q <= growAt` here, so the vector fits in the head.
            const to: i32 = http1Past(q, delta)
            if (to >= 0 && to <= toI32(head.length) - 16) {
              store(v, head, to)
            }
          }
          bits = toU32(bitmask(or(lt(v, splatU8x16(32)), eq(v, splatU8x16(127)))))
          // `q < stop` here: keep the lanes before `stop`, 1 to 15 of them.
          const keep: i32 = http1Less(stop, q)
          if (keep < 16) {
            bits = bits & ((toU32(1) << toU32(keep)) - toU32(1))
          }
          base = q
        } else {
          // Fewer than sixteen bytes are left in `buf`: a byte at a time.
          let k: i32 = q
          while (k >= 0 && k < stop && k < toI32(buf.length) && buf[k] >= 32 && buf[k] !== 127) {
            k += 1
          }
          const last: i32 = k < stop ? http1Past(k, 1) : stop
          const end: i32 = last < copyStop ? last : copyStop
          if (copy && q < end) {
            const endAt: i32 = http1Past(end, delta)
            if (endAt > toI32(p.head.length) - 16) {
              if (!http1HeadGrow(p, http1Less(endAt, p.headLength))) {
                return http1Fail(p, 431, "a head of more than 2^30 bytes")
              }
            }
            if (!tryCopyBytes(p.head, http1Past(q, delta), buf, q, http1Less(end, q))) {
              // The head was grown past `endAt` just above, so this refuses
              // only a head moved by hand.
              return http1Fail(p, 431, "a head of more than 2^30 bytes")
            }
            head = p.head
            growAt = http1Less(http1Less(toI32(head.length), 32), delta)
          }
          j = k
          base = http1Less(k, 15)
          seeking = false
        }
      }
    }
    if (j < 0 || j >= stop || j >= toI32(buf.length)) {
      i = j < 0 ? i : j
      break
    }
    const c: i32 = toI32(buf[j])
    let lf: i32 = -1
    if (c === 13 && j + 1 < stop && j + 1 < toI32(buf.length) && buf[j + 1] === 10) {
      lf = j + 1
    } else if (c === 10) {
      lf = j
    }
    if (lf >= 0) {
      const start: i32 = p.start
      if (lf === start || lf < 1 || lf > toI32(buf.length) || buf[lf - 1] !== 13) {
        return http1Fail(p, 400, "a line ended in a bare LF")
      }
      // The line, `start` to `lf`, is in `buf`.
      const after: i32 = http1Past(lf, 1)
      const sectionBytes: i32 = http1Past(p.sectionBytes, http1Less(after, start))
      if (toI64(sectionBytes) - toI64(2) > toI64(p.maxHeaderBytes)) {
        return http1Fail(p, 431, "a line over its limit")
      }
      // The scan stops at the CR, so the LF after it may be in no vector
      // or tail copied: store it, and the head holds each line's CRLF.
      const at: i32 = http1Past(lf, delta)
      if (copy && at >= 0 && at < toI32(head.length)) {
        head[at] = 10
      }
      p.lineStart = start
      p.lineEnd = lf - 1
      p.start = after
      p.scan = after
      i = after
      // The lowest bit is the line's end at `j`, and a CR's LF is the next
      // one when it is in this vector, as a control byte: drop them both.
      bits = bits & (bits - toU32(1))
      if (c === 13) {
        bits = bits & (bits - toU32(1))
      }
      p.sectionBytes = sectionBytes
      if (sectionBytes > p.maxHeaderBytes) {
        return http1Fail(p, 431, "a header section over the limit")
      }
      if (lf - 1 === start) {
        if (trailer) {
          p.state = HTTP1_S_MESSAGE_END
          return HTTP1_LINE
        }
        p.headLength = http1Past(p.start, delta)
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
      i = http1Past(j, 1)
      bits = bits & (bits - toU32(1))
    }
  }
  p.scan = i
  if (copy) {
    p.headLength = http1Past(p.start, delta)
  }
  if (toI64(p.end) - toI64(p.start) > toI64(p.maxHeaderBytes) - toI64(p.sectionBytes) + toI64(1)) {
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
        // `maxTarget` is clamped to 2^30, so the sum is an i32.
        const got: i32 = http1TakeLine(p, http1Past(p.maxTarget, HTTP1_MAX_METHOD + 10), 414)
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
  const out: u8[] = []
  for (let k: i32 = 0; k < n; k += 1) {
    out.push(toU8(text.charCodeAt(k)))
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
  const end: i32 = http1TryWriteChunk(out, at, data, off, len)
  if (end === HTTP1_BAD_WINDOW) {
    panic("http1WriteChunk: the window is outside the buffer")
  }
  return end
}

/**
 * `http1WriteChunk` that answers `HTTP1_BAD_WINDOW`, with `out` untouched,
 * where `http1WriteChunk` panics: a window outside `data`. A caller a strict
 * module reaches uses this one.
 *
 * @param out the caller's buffer the chunk is written into
 * @param at where in `out` the chunk starts
 * @param data the body bytes to send
 * @param off where in `data` the chunk's bytes start
 * @param len how many bytes of `data` the chunk carries
 * @returns the offset in `out` just past the chunk, `HTTP1_NO_ROOM` when it
 *   does not fit, or `HTTP1_BAD_WINDOW` when the window lies outside `data`
 */
export const http1TryWriteChunk = (out: u8[], at: i32, data: readonly u8[], off: i32, len: i32): i32 => {
  const size: i32 = toI32(data.length)
  if (off < 0 || len < 0 || off > size || toU32(len) > toU32(size) - toU32(off)) {
    return HTTP1_BAD_WINDOW
  }
  if (len === 0) {
    return at
  }
  const digits: i32 = http1HexDigits(len)
  const outLength: i32 = toI32(out.length)
  // The chunk's size, in 64 bits so that it cannot wrap.
  const need: u64 = toU64(digits) + toU64(len) + toU64(4)
  if (at < 0 || at > outLength || need > toU64(toU32(outLength) - toU32(at))) {
    return HTTP1_NO_ROOM
  }
  // It fits, so none of the offsets below passes `outLength`.
  const end: i32 = http1Past(at, digits)
  const headEnd: i32 = http1Past(end, 2)
  // The bytes go first, so a copy that fails leaves `out` untouched. It
  // cannot: the window is inside `data` and the chunk fits, both checked.
  if (!tryCopyBytes(out, headEnd, data, off, len)) {
    return HTTP1_NO_ROOM
  }
  let v: i32 = len
  // The digits are written last first, `out[k - 1]` each time.
  for (let k: i32 = end; k > 0 && k > at && k <= toI32(out.length); k -= 1) {
    const d: i32 = v & 15
    out[k - 1] = toU8(d < 10 ? 48 + d : 87 + d)
    v = v >> 4
  }
  http1PutCrlf(out, end)
  return http1PutCrlf(out, http1Past(headEnd, len))
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
  if (off < 0 || len < 0 || off > size || toU32(len) > toU32(size) - toU32(off)) {
    panic("http1Chunk: the window is outside the buffer")
  }
  if (len === 0) {
    return []
  }
  // Built by `push`, as `http1WriteChunk` would write it.
  const out: u8[] = []
  for (let d: i32 = http1HexDigits(len); d > 0; d -= 1) {
    const nibble: u32 = (toU32(len) >> (toU32(d - 1) * toU32(4))) & toU32(15)
    out.push(toU8(nibble < 10 ? toU32(48) + nibble : toU32(87) + nibble))
  }
  out.push(13)
  out.push(10)
  // The window is inside `data`, checked above, so the sum is an i32.
  const stop: i32 = http1Past(off, len)
  for (let k: i32 = off; k >= 0 && k < toI32(data.length) && k < stop; k += 1) {
    out.push(data[k])
  }
  out.push(13)
  out.push(10)
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
/** `http1TryWriteChunk`: the window lies outside the body bytes; nothing is written. */
export const HTTP1_BAD_WINDOW: i32 = -3

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
  const last: i32 = toI32(bytes.length) - 16
  return (
    k === n ||
    (last >= 0 && last <= toI32(bytes.length) - 16 && http1LanesAreFieldText(loadU8x16(bytes, last)))
  )
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
  // An i32 has at most ten digits, so the second test always holds.
  while (v > 0 && digits < 10) {
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
  // Every caller has made sure it fits; outside `out` nothing is written.
  // Before its start the text is skipped, so a negative `at` writes the tail.
  let k: i32 = 0
  if (at < 0) {
    k = at > -n ? http1Less(0, at) : n
  }
  let j: i32 = http1Past(at, k)
  while (k >= 0 && k < n && j >= 0 && j < toI32(out.length)) {
    out[j] = toU8(text.charCodeAt(k))
    j += 1
    k += 1
  }
  return http1Past(at, n)
}

/**
 * `at + n` for an `n` that is not negative, wrapping as an i32 where the sum
 * would pass 2^31: the writers' callers measure the head first, so it never
 * does for them.
 */
const http1Past = (at: i32, n: i32): i32 => toI32(toU32(at) + toU32(n))

/**
 * `at - n`, wrapping as an i32 where the difference would leave its range:
 * the parser takes it only between offsets in one buffer, so it never does.
 */
const http1Less = (at: i32, n: i32): i32 => toI32(toU32(at) - toU32(n))

/** Writes CR LF at `out[at ..)`, likewise: two stores, where `http1PutText` walks a string. */
const http1PutCrlf = (out: u8[], at: i32): i32 => {
  if (at >= 0 && at < toI32(out.length) - 1) {
    out[at] = 13
    out[at + 1] = 10
  }
  return http1Past(at, 2)
}

/** Writes `: ` at `out[at ..)`, likewise. */
const http1PutColonSpace = (out: u8[], at: i32): i32 => {
  if (at >= 0 && at < toI32(out.length) - 1) {
    out[at] = 58
    out[at + 1] = 32
  }
  return http1Past(at, 2)
}

/** Writes `bytes` at `out[at ..)`, likewise, as one copy when it fits. */
const http1PutBytes = (out: u8[], at: i32, bytes: u8[]): i32 => {
  const n: i32 = toI32(bytes.length)
  if (!tryCopyBytes(out, at, bytes, 0, n)) {
    let j: i32 = at
    for (let k: i32 = 0; k < n && k < toI32(bytes.length) && j >= 0 && j < toI32(out.length); k += 1) {
      out[j] = bytes[k]
      j += 1
    }
  }
  return http1Past(at, n)
}

/**
 * Writes `text`, at most sixteen ASCII bytes, at `out[at ..)`, likewise, as
 * one sixteen-byte store of `v`, which holds `text` in its first lanes: when
 * `at + 16` does not pass `limit`, the end of the head being written, whose
 * every byte from `at` on is written after this one, so the lanes past
 * `text` are overwritten before the head is done. Byte by byte otherwise.
 */
const http1PutFixed = (out: u8[], at: i32, limit: i32, v: u8x16, text: string): i32 => {
  if (at >= 0 && limit >= 16 && at <= limit - 16 && at <= toI32(out.length) - 16) {
    store(v, out, at)
    return http1Past(at, toI32(text.length))
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
  if (at >= 0 && limit >= 16 && at <= limit - 16 && at <= toI32(out.length) - 16) {
    // "HTTP/1.1 000 ", and three lanes the head's next bytes overwrite.
    const line: u8x16 = u8x16(72, 84, 84, 80, 47, 49, 46, 49, 32, 48, 48, 48, 32, 32, 32, 32)
    store(
      replace(replace(replace(line, 9, toU8(48 + hundreds)), 10, toU8(48 + tens)), 11, toU8(48 + ones)),
      out,
      at
    )
    return http1Past(at, 13)
  }
  const end: i32 = http1PutText(out, at, "HTTP/1.1 ")
  if (end >= 0 && end < toI32(out.length) - 3) {
    out[end] = toU8(48 + hundreds)
    out[end + 1] = toU8(48 + tens)
    out[end + 2] = toU8(48 + ones)
    out[end + 3] = 32
  }
  return http1Past(end, 4)
}

/** Writes the decimal digits of `n`, which is not negative, at `out[at ..)`, likewise. */
const http1PutDecimal = (out: u8[], at: i32, n: i32): i32 => {
  const digits: i32 = http1DecimalDigits(n)
  const end: i32 = http1Past(at, digits)
  let v: i32 = n
  // The digits are written last first, `out[k - 1]` each time.
  for (let k: i32 = end; k > 0 && k > at && k <= toI32(out.length); k -= 1) {
    const digit: i32 = v % 10
    out[k - 1] = toU8(48 + digit)
    v = v / 10
  }
  return end
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
  let need: u64 = toU64(17) + toU64(reason.length)
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
    need = need + toU64(name.length) + toU64(value.length) + toU64(4)
  }
  const sendDate: boolean = status >= 200 && toI32(date.length) > 0 && !dated
  if (sendDate) {
    // "Date: " value CRLF: 37 bytes for an IMF-fixdate.
    need = need + toU64(8) + toU64(date.length)
  }
  if (bodyLength >= 0) {
    need = need + toU64(18) + toU64(http1DecimalDigits(bodyLength))
  } else if (bodyLength === HTTP1_CHUNKED) {
    need = need + toU64(28)
  }
  if (toI32(connection.length) > 0) {
    need = need + toU64(14) + toU64(connection.length)
  }
  if (at < 0 || at > toI32(out.length) || need > toU64(toI32(out.length) - at)) {
    return HTTP1_NO_ROOM
  }
  // A status is three digits, checked above: no division loop for them.
  // `need` fits in the room past `at`, so the end is an i32.
  const limit: i32 = http1Past(at, toI32(need))
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
