/**
 * `nish/net/http1` — an incremental HTTP/1.1 request parser and a response
 * writer, sans-IO: bytes in, events and bytes out, and no socket anywhere.
 *
 * **The parser** is a push-pull machine. A caller `feed`s whatever slice the
 * socket gave it, of any length and cut anywhere, and then calls `next()`
 * until it answers `HTTP1_NEED_MORE`:
 *
 *     import { Http1Parser, HTTP1_HEAD, HTTP1_BODY, HTTP1_END, HTTP1_ERROR } from "nish/net/http1";
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

/** `next()`: the input so far holds no further event; feed more. */
export const HTTP1_NEED_MORE: i32 = 0
/** `next()`: a request line and header section were read. */
export const HTTP1_HEAD: i32 = 1
/** `next()`: `bodyLen` body bytes are at `body[bodyOff ..]`, valid until the next `feed`. */
export const HTTP1_BODY: i32 = 2
/** `next()`: the request's body is complete. */
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
 * One connection's request parser, from the first byte to the close: requests
 * on a kept-alive connection follow one another through the same parser.
 */
export class Http1Parser {
  // The fields are declared widest first, references before numbers before
  // flags, so the struct carries no padding; the groups say what each is.

  // --- the request: valid from its `HTTP1_HEAD` until the next request's -----
  method: string = ""
  target: string = ""
  /** The field names, in lowercase, in the order they arrived; `values` beside them. */
  names: string[]
  values: string[]
  /** The `Upgrade` field when `Connection` asked for it, else empty. */
  upgrade: string = ""
  /** The buffer the last `HTTP1_BODY`'s bytes are in, at `bodyOff`, `bodyLen` long. */
  body: u8[]
  /** What was wrong, once `next()` said `HTTP1_ERROR`; for a log, not for the response. */
  reason: string = ""
  /** The bytes fed and not yet consumed are `buf[start .. end)`. */
  buf: u8[]

  // --- limits, the caller's --------------------------------------------------
  maxTarget: i32 = 0
  maxHeaderBytes: i32 = 0
  maxHeaders: i32 = 0
  maxBody: i32 = 0

  /** The minor version: 0 for HTTP/1.0, 1 for HTTP/1.1 and anything above it. */
  minor: i32 = 1
  /** The declared body length, or -1 when the request has none or is chunked. */
  contentLength: i32 = -1
  bodyOff: i32 = 0
  bodyLen: i32 = 0
  /** The status code to answer once `next()` said `HTTP1_ERROR`. */
  status: i32 = 0

  // --- internal --------------------------------------------------------------
  start: i32 = 0
  end: i32 = 0
  /** Where the search for the next LF resumes, so a line fed a byte at a time is scanned once. */
  scan: i32 = 0
  state: i32 = 0
  /** Bytes left in a length-delimited body or in the current chunk. */
  left: i32 = 0
  /** De-chunked body bytes so far, against `maxBody`. */
  bodyTotal: i32 = 0
  /** Bytes of the header or trailer section so far, against `maxHeaderBytes`. */
  sectionBytes: i32 = 0
  /** Field lines of the request so far, its trailers included, against `maxHeaders`. */
  fieldCount: i32 = 0
  /** The line `http1TakeLine` found is `buf[lineStart .. lineEnd)`, its CRLF dropped. */
  lineStart: i32 = 0
  lineEnd: i32 = 0

  chunked: boolean = false
  keepAlive: boolean = false

  /**
   * Each limit is clamped into 0 to 2^30, so that the sums the parser makes
   * of them (a request line is the method, the target and ten bytes more)
   * cannot overflow an `i32`.
   */
  constructor(maxTarget: i32, maxHeaderBytes: i32, maxHeaders: i32, maxBody: i32) {
    this.maxTarget = http1Clamp(maxTarget)
    this.maxHeaderBytes = http1Clamp(maxHeaderBytes)
    this.maxHeaders = http1Clamp(maxHeaders)
    this.maxBody = http1Clamp(maxBody)
    this.buf = new Array<u8>(1024)
    this.body = this.buf
    this.names = []
    this.values = []
  }

  /**
   * Appends `data[off .. off + len)` to the input. A window outside `data`
   * panics, as the crypto modules' `update` does. Once the parser has closed
   * or refused, the input is dropped; once it has upgraded, it is kept for
   * `upgradeBytes()`.
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
    return http1Next(this)
  }

  /**
   * The value of the first field named `name` (any case), or `null`. A field
   * that may repeat is read through `names` and `values`.
   */
  header(name: string): string | null {
    const want: string = http1Lower(name)
    const names: string[] = this.names
    const count: i32 = toI32(names.length)
    for (let i: i32 = 0; i < count; i += 1) {
      if (names[i] === want) {
        return this.values[i]
      }
    }
    return null
  }

  /** After `HTTP1_UPGRADE`: every byte fed past the request, as a fresh array. */
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
   * After `HTTP1_UPGRADE`: the server answered without switching, so the
   * bytes that follow are the next HTTP request. Anywhere else it does nothing.
   */
  declineUpgrade(): void {
    if (this.state === HTTP1_S_UPGRADED) {
      http1StartRequest(this)
    }
  }
}

/** Makes room for `len` more bytes at `p.end`, moving the live bytes down first. */
const http1Reserve = (p: Http1Parser, len: i32): void => {
  const old: u8[] = p.buf
  const capacity: i32 = toI32(old.length)
  if (len <= capacity - p.end) {
    return
  }
  const live: i32 = p.end - p.start
  let size: i32 = capacity
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
  for (let k: i32 = 0; k < live && k < toI32(buf.length); k += 1) {
    buf[k] = old[from + k]
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
  p.names = []
  p.values = []
  p.contentLength = -1
  p.chunked = false
  p.keepAlive = false
  p.upgrade = ""
  p.bodyLen = 0
  p.bodyTotal = 0
  p.sectionBytes = 0
  p.fieldCount = 0
}

/**
 * Finds the next line: answers 1 with it in `lineStart .. lineEnd`, 0 when no
 * LF has arrived yet, or `HTTP1_ERROR`'s refusal. A line ends in CRLF and in
 * nothing else; a LF without its CR is a 400. A line that has not ended by
 * `limit` bytes is refused with `overStatus`.
 */
const http1TakeLine = (p: Http1Parser, limit: i32, overStatus: i32): i32 => {
  const buf: u8[] = p.buf
  const end: i32 = p.end
  let i: i32 = p.scan > p.start ? p.scan : p.start
  while (i >= 0 && i < end && i < toI32(buf.length)) {
    if (buf[i] === 10) {
      if (i === p.start || buf[i - 1] !== 13) {
        http1Fail(p, 400, "a line ended in a bare LF")
        return -1
      }
      if (i - 1 - p.start > limit) {
        http1Fail(p, overStatus, "a line over its limit")
        return -1
      }
      p.lineStart = p.start
      p.lineEnd = i - 1
      p.start = i + 1
      p.scan = i + 1
      return 1
    }
    i += 1
  }
  p.scan = end
  if (end - p.start > limit + 1) {
    http1Fail(p, overStatus, "a line over its limit")
    return -1
  }
  return 0
}

/** Whether `c` is a tchar of RFC 9110 §5.6.2, the bytes a token is made of. */
const http1IsTokenByte = (c: i32): boolean =>
  (c >= 97 && c <= 122) ||
  (c >= 65 && c <= 90) ||
  (c >= 48 && c <= 57) ||
  c === 33 ||
  (c >= 35 && c <= 39) ||
  c === 42 ||
  c === 43 ||
  c === 45 ||
  c === 46 ||
  c === 94 ||
  c === 95 ||
  c === 96 ||
  c === 124 ||
  c === 126

/** Whether `c` may appear in a field value (RFC 9110 §5.5): HTAB, SP, VCHAR or obs-text. */
const http1IsValueByte = (c: i32): boolean => c === 9 || (c >= 32 && c !== 127)

/** `buf[from .. to)` as a string, each upper-case ASCII letter lowered when `lower`. */
const http1Text = (buf: u8[], from: i32, to: i32, lower: boolean): string => {
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

/** `text` with its ASCII letters in lowercase. */
const http1Lower = (text: string): string => {
  const parts: string[] = []
  const n: i32 = toI32(text.length)
  for (let k: i32 = 0; k < n; k += 1) {
    let c: i32 = toI32(text.charCodeAt(k))
    if (c >= 65 && c <= 90) {
      c += 32
    }
    parts.push(String.fromCharCode(c))
  }
  return parts.join("")
}

/** Whether `c` is optional whitespace, a space or a tab (OWS, RFC 9110 §5.6.3). */
const http1IsOws = (c: i32): boolean => c === 32 || c === 9

/** Whether `text[a .. b)` is `word`, which is lowercase, in any ASCII case. */
const http1SameWord = (text: string, a: i32, b: i32, word: string): boolean => {
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
 * What `http1ListTally` found in a comma-separated list: how many elements it
 * has, how many of them are the word asked about, and whether the last is.
 */
class Http1ListTally {
  elements: i32 = 0
  matches: i32 = 0
  lastMatches: boolean = false
}

/**
 * Walks the comma-separated list in `text` (RFC 9110 §5.6.1), each element
 * trimmed of OWS and compared with `word` in any case. Empty elements are
 * skipped, as the rule says a recipient must accept them. Nothing is copied.
 */
const http1ListTally = (text: string, word: string): Http1ListTally => {
  const tally: Http1ListTally = new Http1ListTally()
  const n: i32 = toI32(text.length)
  let from: i32 = 0
  for (let k: i32 = 0; k <= n; k += 1) {
    const c: i32 = k < n ? toI32(text.charCodeAt(k)) : 44
    if (c === 44) {
      let a: i32 = from
      let b: i32 = k
      while (a >= 0 && a < b && a < n && http1IsOws(toI32(text.charCodeAt(a)))) {
        a += 1
      }
      while (b > a && b - 1 >= 0 && b - 1 < n && http1IsOws(toI32(text.charCodeAt(b - 1)))) {
        b -= 1
      }
      if (b > a) {
        tally.elements += 1
        tally.lastMatches = http1SameWord(text, a, b, word)
        if (tally.lastMatches) {
          tally.matches += 1
        }
      }
      from = k + 1
    }
  }
  return tally
}

/**
 * Whether the buffered start of a request line holds more than
 * `HTTP1_MAX_METHOD` bytes before its first space (or line end).
 */
const http1MethodOverrun = (p: Http1Parser): boolean => {
  const buf: u8[] = p.buf
  const n: i32 = toI32(buf.length)
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
  let i: i32 = a
  while (i >= 0 && i < b && i < toI32(buf.length) && http1IsTokenByte(toI32(buf[i]))) {
    i += 1
  }
  if (i === a || i - a > HTTP1_MAX_METHOD || i >= b || buf[i] !== 32) {
    return http1Fail(p, 400, "a malformed method")
  }
  const methodEnd: i32 = i
  i += 1
  const targetStart: i32 = i
  while (i >= 0 && i < b && i < toI32(buf.length) && buf[i] > 32 && buf[i] < 127) {
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
  p.method = http1Text(buf, a, methodEnd, false)
  p.target = http1Text(buf, targetStart, targetEnd, false)
  p.state = HTTP1_S_FIELDS
  return HTTP1_NEED_MORE
}

/**
 * Reads one field line in `lineStart .. lineEnd` (§5) into `names` and
 * `values`, or, for a trailer, only checks it. Answers `HTTP1_NEED_MORE` or the
 * refusal.
 */
const http1FieldLine = (p: Http1Parser, keep: boolean): i32 => {
  const buf: u8[] = p.buf
  const n: i32 = toI32(buf.length)
  const a: i32 = p.lineStart
  const b: i32 = p.lineEnd < n ? p.lineEnd : n
  if (a >= 0 && a < b && (buf[a] === 32 || buf[a] === 9)) {
    return http1Fail(p, 400, "a field line that starts with whitespace (obs-fold)")
  }
  let i: i32 = a
  while (i >= 0 && i < b && i < toI32(buf.length) && http1IsTokenByte(toI32(buf[i]))) {
    i += 1
  }
  if (i === a || i >= b || buf[i] !== 58) {
    return http1Fail(p, 400, "a malformed field name")
  }
  const nameEnd: i32 = i
  for (let k: i32 = nameEnd + 1; k >= 0 && k < b && k < toI32(buf.length); k += 1) {
    if (!http1IsValueByte(toI32(buf[k]))) {
      return http1Fail(p, 400, "a control character in a field value")
    }
  }
  p.fieldCount += 1
  if (p.fieldCount > p.maxHeaders) {
    return http1Fail(p, 431, "more fields than the limit")
  }
  // A trailer is checked and counted, but not kept: nothing here reads one.
  if (keep) {
    let valueStart: i32 = nameEnd + 1
    let valueEnd: i32 = b
    while (valueStart >= 0 && valueStart < valueEnd && valueStart < n && http1IsOws(toI32(buf[valueStart]))) {
      valueStart += 1
    }
    while (valueEnd > valueStart && valueEnd - 1 >= 0 && http1IsOws(toI32(buf[valueEnd - 1]))) {
      valueEnd -= 1
    }
    p.names.push(http1Text(buf, a, nameEnd, true))
    p.values.push(http1Text(buf, valueStart, valueEnd, false))
  }
  return HTTP1_NEED_MORE
}

/**
 * The header section has ended: decide the framing and the connection's fate
 * (§6.3, §9.3) and answer `HTTP1_HEAD`, or the refusal.
 */
const http1EndOfHead = (p: Http1Parser): i32 => {
  const names: string[] = p.names
  const values: string[] = p.values
  const count: i32 = toI32(values.length)
  let hosts: i32 = 0
  let lengths: i32 = 0
  let lengthValue: string = ""
  // A field that may repeat is one list (RFC 9110 §5.3), so each is gathered
  // and joined once rather than read field by field.
  const codingFields: string[] = []
  const connectionFields: string[] = []
  const upgradeFields: string[] = []
  for (let i: i32 = 0; i < count && i < toI32(names.length); i += 1) {
    // `values` is pushed beside `names`, so the two lengths are one; the
    // test on each is what proves both reads.
    const name: string = names[i]
    const value: string = i < toI32(values.length) ? values[i] : ""
    if (name === "host") {
      hosts += 1
    } else if (name === "content-length") {
      lengths += 1
      lengthValue = value
    } else if (name === "transfer-encoding") {
      codingFields.push(value)
    } else if (name === "connection") {
      connectionFields.push(value)
    } else if (name === "upgrade") {
      upgradeFields.push(value)
    }
  }
  if ((p.minor === 1 && hosts !== 1) || hosts > 1) {
    return http1Fail(p, 400, "a request without exactly one Host")
  }
  if (toI32(codingFields.length) > 0) {
    if (lengths > 0) {
      return http1Fail(p, 400, "both Content-Length and Transfer-Encoding")
    }
    if (p.minor === 0) {
      return http1Fail(p, 400, "Transfer-Encoding in an HTTP/1.0 request")
    }
    const codings: Http1ListTally = http1ListTally(codingFields.join(","), "chunked")
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
  } else if (lengths === 1) {
    const size: i32 = http1ContentLength(lengthValue, p.maxBody)
    if (size === -1) {
      return http1Fail(p, 400, "a Content-Length that is not a run of digits")
    }
    if (size === -2) {
      return http1Fail(p, 413, "a Content-Length over the limit")
    }
    p.contentLength = size
  }
  const connection: string = connectionFields.join(",")
  const close: boolean = http1ListTally(connection, "close").matches > 0
  const keep: boolean = http1ListTally(connection, "keep-alive").matches > 0
  const upgradeAsked: boolean = http1ListTally(connection, "upgrade").matches > 0
  const upgradeValue: string = upgradeFields.join(", ")
  p.keepAlive = p.minor === 1 ? !close : keep && !close
  p.upgrade = p.minor === 1 && upgradeAsked ? upgradeValue : ""
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
 * `text` as a Content-Length (1*DIGIT, RFC 9112 §6.2): the value, -1 when it
 * is not a run of digits, or -2 when it is one over `limit`. The digits are
 * all read even past the limit, so `12x` is a 400 however long it is.
 */
const http1ContentLength = (text: string, limit: i32): i32 => {
  const n: i32 = toI32(text.length)
  if (n === 0) {
    return -1
  }
  let value: i32 = 0
  let over: boolean = false
  for (let k: i32 = 0; k < n; k += 1) {
    const c: i32 = toI32(text.charCodeAt(k))
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

/** The value of the hex digit `c`, or -1. */
const http1HexValue = (c: i32): i32 => {
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
  while (i >= 0 && i < b && i < toI32(buf.length) && http1HexValue(toI32(buf[i])) >= 0) {
    const digit: i32 = http1HexValue(toI32(buf[i]))
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
  while (i >= 0 && i < b && i < toI32(buf.length) && http1IsOws(toI32(buf[i]))) {
    i += 1
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

/** Hands the caller up to `p.left` of the buffered body bytes. */
const http1BodyWindow = (p: Http1Parser): i32 => {
  const ready: i32 = p.end - p.start
  if (ready <= 0) {
    return HTTP1_NEED_MORE
  }
  const take: i32 = ready < p.left ? ready : p.left
  p.body = p.buf
  p.bodyOff = p.start
  p.bodyLen = take
  p.start += take
  p.scan = p.start
  p.left -= take
  p.bodyTotal += take
  return HTTP1_BODY
}

/** The state machine behind `next()`. */
const http1Next = (p: Http1Parser): i32 => {
  while (true) {
    switch (p.state) {
      case HTTP1_S_REQUEST_LINE: {
        // A method too long is a 400, decided before the line's length can
        // call it a long target and answer 414.
        if (http1MethodOverrun(p)) {
          return http1Fail(p, 400, "a malformed method")
        }
        // The longest well-formed request line: the method, the target, two
        // spaces and "HTTP/1.1".
        const got: i32 = http1TakeLine(p, HTTP1_MAX_METHOD + p.maxTarget + 10, 414)
        if (got <= 0) {
          return got < 0 ? HTTP1_ERROR : HTTP1_NEED_MORE
        }
        // RFC 9112 §2.2: an empty line before a request line is ignored.
        if (p.lineEnd > p.lineStart && http1RequestLine(p) === HTTP1_ERROR) {
          return HTTP1_ERROR
        }
        break
      }
      case HTTP1_S_FIELDS:
      case HTTP1_S_TRAILERS: {
        const got: i32 = http1TakeLine(p, p.maxHeaderBytes - p.sectionBytes, 431)
        if (got <= 0) {
          return got < 0 ? HTTP1_ERROR : HTTP1_NEED_MORE
        }
        p.sectionBytes += p.lineEnd - p.lineStart + 2
        if (p.sectionBytes > p.maxHeaderBytes) {
          return http1Fail(p, 431, "a header section over the limit")
        }
        const trailer: boolean = p.state === HTTP1_S_TRAILERS
        if (p.lineEnd === p.lineStart) {
          if (trailer) {
            p.state = HTTP1_S_MESSAGE_END
            break
          }
          return http1EndOfHead(p)
        }
        if (http1FieldLine(p, !trailer) === HTTP1_ERROR) {
          return HTTP1_ERROR
        }
        break
      }
      case HTTP1_S_LENGTH_BODY: {
        const event: i32 = http1BodyWindow(p)
        if (p.left === 0) {
          p.state = HTTP1_S_MESSAGE_END
        }
        return event
      }
      case HTTP1_S_CHUNK_SIZE: {
        const got: i32 = http1TakeLine(p, p.maxHeaderBytes, 400)
        if (got <= 0) {
          return got < 0 ? HTTP1_ERROR : HTTP1_NEED_MORE
        }
        if (http1ChunkSize(p) === HTTP1_ERROR) {
          return HTTP1_ERROR
        }
        break
      }
      case HTTP1_S_CHUNK_DATA: {
        const event: i32 = http1BodyWindow(p)
        if (p.left === 0) {
          p.state = HTTP1_S_CHUNK_CRLF
        }
        return event
      }
      case HTTP1_S_CHUNK_CRLF: {
        if (p.end - p.start < 2) {
          return HTTP1_NEED_MORE
        }
        const buf: u8[] = p.buf
        const at: i32 = p.start
        let crlf: boolean = false
        if (at >= 0 && at < toI32(buf.length) && at + 1 < toI32(buf.length)) {
          crlf = buf[at] === 13 && buf[at + 1] === 10
        }
        if (!crlf) {
          return http1Fail(p, 400, "chunk data not followed by CRLF")
        }
        p.start = at + 2
        p.scan = p.start
        p.state = HTTP1_S_CHUNK_SIZE
        break
      }
      case HTTP1_S_MESSAGE_END: {
        if (toI32(p.upgrade.length) > 0) {
          p.state = HTTP1_S_UPGRADED
        } else if (!p.keepAlive) {
          p.state = HTTP1_S_CLOSED
        } else {
          http1StartRequest(p)
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

/** Whether every byte of `text` is a tchar, and there is at least one. */
const http1IsToken = (text: string): boolean => {
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

/** Whether every byte of `text` may stand in a field value or a reason phrase. */
const http1IsFieldText = (text: string): boolean => {
  const n: i32 = toI32(text.length)
  for (let k: i32 = 0; k < n; k += 1) {
    if (!http1IsValueByte(toI32(text.charCodeAt(k)))) {
      return false
    }
  }
  return true
}

const HTTP1_HEX_DIGITS: string = "0123456789abcdef"

/** `n` (at least 0) in lowercase hex, without leading zeros. */
const http1Hex = (n: i32): string => {
  if (n === 0) {
    return "0"
  }
  const digits: string[] = []
  let v: i32 = n
  while (v > 0) {
    const d: i32 = v & 15
    digits.push(HTTP1_HEX_DIGITS.substring(d, d + 1))
    v = v >> 4
  }
  const parts: string[] = []
  for (let k: i32 = toI32(digits.length) - 1; k >= 0 && k < toI32(digits.length); k -= 1) {
    parts.push(digits[k])
  }
  return parts.join("")
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
 * caller's fields, since the framing is decided here; a 1xx or 204 response
 * with a body length (RFC 9110 §15.2, §15.3.5); and any other `bodyLength`
 * below zero.
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

/**
 * `data[off .. off + len)` as one chunk of a chunked body (RFC 9112 §7.1):
 * the size in hex, CRLF, the bytes, CRLF. An empty window answers an empty
 * array, because a chunk of size zero is the end of the body and only
 * `http1LastChunk` writes that. A window outside `data` panics.
 */
export const http1Chunk = (data: u8[], off: i32, len: i32): u8[] => {
  const size: i32 = toI32(data.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic("http1Chunk: the window is outside the buffer")
  }
  if (len === 0) {
    return []
  }
  const head: u8[] = http1BytesOf(`${http1Hex(len)}\r\n`)
  const headLength: i32 = toI32(head.length)
  const out: u8[] = new Array<u8>(headLength + len + 2)
  const outLength: i32 = toI32(out.length)
  out.set(head)
  for (let k: i32 = 0; k < len && headLength + k < outLength; k += 1) {
    out[headLength + k] = data[off + k]
  }
  out[headLength + len] = 13
  out[headLength + len + 1] = 10
  return out
}

/** The last chunk and the empty trailer section that end a chunked body: `0\r\n\r\n`. */
export const http1LastChunk = (): u8[] => http1BytesOf("0\r\n\r\n")
