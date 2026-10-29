/**
 * `nish/net/http1-client` — the client side of HTTP/1.1, sans-IO: a request
 * writer and an incremental response parser, bytes in, events and bytes out,
 * and no socket anywhere. `nish/net/http1` is the server side; the event
 * constants and the chunk writers are shared and imported from there.
 *
 * **The writer** is `http1RequestHead`, which answers a request line and
 * header section with the framing field the body needs, and
 * `http1WriteRequestHead`, which writes the same head into a caller's buffer
 * with nothing allocated. A chunked body is written with `http1Chunk` and
 * `http1LastChunk` from `nish/net/http1`. The writer refuses anything that
 * would let a caller's string end a line early or frame the body itself — the
 * request-splitting and request-smuggling shapes.
 *
 * **The parser** is a push-pull machine, like the server's. A caller tells it
 * what it asked (`expect`), `feed`s whatever slice the socket gave it, cut
 * anywhere, and calls `next()` until it answers `HTTP1_NEED_MORE`:
 *
 *     import { HTTP1_NEED_MORE, HTTP1_HEAD, HTTP1_BODY, HTTP1_END, HTTP1_ERROR } from "nish/net/http1";
 *     import { Http1ResponseParser } from "nish/net/http1-client";
 *
 *     const p = new Http1ResponseParser(maxStatusLine, maxHeaderBytes, maxHeaders, maxBody, maxTrailerBytes);
 *     p.expect(false, false);
 *     p.feed(received, 0, n); // and p.finish() when the server closes
 *     let event: i32 = p.next();
 *     while (event !== HTTP1_NEED_MORE) {
 *       // HTTP1_HEAD: p.status, p.reason, p.header("content-type"), ...
 *       // HTTP1_BODY: p.body[p.bodyOff .. p.bodyOff + p.bodyLen)
 *       // HTTP1_ERROR: p.error and p.errorText say why; close
 *       event = p.next();
 *     }
 *
 * The events are `HTTP1_INFORMATIONAL` (an interim 1xx response was read; the
 * final one follows), `HTTP1_HEAD` (the final response's status line and
 * header section are in), `HTTP1_BODY` (some body bytes, de-chunked),
 * `HTTP1_END` (the response is complete; with `keepAlive()` the next one
 * follows), `HTTP1_UPGRADE` (a CONNECT was answered with 2xx and the
 * connection is a tunnel now: `tunnelBytes()` answers what was fed past the
 * head), `HTTP1_CLOSED` (the connection is done) and `HTTP1_ERROR`. The last
 * three repeat on every later call. Only complete lines are acted on, body
 * bytes are counted, never guessed, and every refusal is decided by the same
 * byte wherever the input was cut, so the sequence of events, the
 * concatenated body and the error code do not depend on the split —
 * `tests/link/net_http1_client` feeds a corpus at every split point.
 *
 * **How a response ends** (RFC 9112 §6.3): a response to HEAD, a 1xx, 204 or
 * 304 has no body whatever its fields say; a 2xx to CONNECT is a tunnel; a
 * `Transfer-Encoding: chunked` response is de-chunked; a `Content-Length`
 * response is that many bytes; anything else is read until the server closes,
 * which `finish()` reports. A connection closed anywhere else is
 * `HTTP1_E_TRUNCATED`, so a cut-short body is never taken for a whole one.
 *
 * **What it refuses**, each with its own code in `error`: a malformed status
 * line, an HTTP major version other than 1, a bare LF, a malformed field line
 * (an obs-fold, whitespace before the colon, a control byte in a value), a 101
 * (this client never asks to switch protocols), `Transfer-Encoding` together
 * with `Content-Length`, a transfer coding other than one `chunked` or one in
 * an HTTP/1.0 response, a `Content-Length` that is not one value, a malformed
 * chunk, a status line, header section, field count, body or trailer section
 * over the caller's limit, a chunk-size line over `HTTP1_MAX_CHUNK_LINE` and
 * more than `HTTP1_MAX_INFORMATIONAL` interim responses. Each of these is a
 * response-smuggling or a resource shape, and each is refused rather than
 * repaired: a client that repairs one differently from a proxy disagrees with
 * it about where the next response starts. An error is final.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9112 and RFC 9110, not ported from another implementation.
 */
import { copyBytes } from "nish/bytes"
import {
  HTTP1_BODY,
  HTTP1_CLOSED,
  HTTP1_END,
  HTTP1_ERROR,
  HTTP1_HEAD,
  HTTP1_NEED_MORE,
  HTTP1_NO_ROOM,
  HTTP1_REFUSED,
  HTTP1_UPGRADE,
  HTTP1_FIRST_INPUT,
  http1HexValue,
  http1IsFieldText,
  http1IsOws,
  http1IsToken,
  http1IsTokenByte,
  http1IsValueByte,
  http1PutText,
  http1SameWord,
  http1Text,
} from "nish/net/http1"

/** `next()`: an interim 1xx response was read; `status` and the fields are its. */
export const HTTP1_INFORMATIONAL: i32 = 7

/** The longest chunk-size line, extension included, the parser reads. */
export const HTTP1_MAX_CHUNK_LINE: i32 = 4096
/** The most interim 1xx responses the parser reads before a final one. */
export const HTTP1_MAX_INFORMATIONAL: i32 = 32

/** `error`: nothing is wrong. */
export const HTTP1_E_NONE: i32 = 0
/** `error`: the status line is not `HTTP/1.x`, a three-digit status from 100 to 599 and a reason. */
export const HTTP1_E_STATUS_LINE: i32 = 1
/** `error`: the response's HTTP major version is not 1. */
export const HTTP1_E_VERSION: i32 = 2
/** `error`: a line ended in a LF without its CR (RFC 9112 §2.2). */
export const HTTP1_E_BARE_LF: i32 = 3
/** `error`: a malformed field line: an obs-fold, a bad name, whitespace before the colon, a control byte. */
export const HTTP1_E_FIELD: i32 = 4
/** `error`: a 101, which this client never asks for. */
export const HTTP1_E_SWITCH: i32 = 5
/** `error`: both `Transfer-Encoding` and `Content-Length` (RFC 9112 §6.1). */
export const HTTP1_E_FRAMING: i32 = 6
/** `error`: a transfer coding list that is not one `chunked`, or one in an HTTP/1.0 response. */
export const HTTP1_E_CODING: i32 = 7
/** `error`: a `Content-Length` that is not a run of digits, or values that differ. */
export const HTTP1_E_LENGTH: i32 = 8
/** `error`: a malformed chunk size, chunk extension or chunk terminator (RFC 9112 §7.1). */
export const HTTP1_E_CHUNK: i32 = 9
/** `error`: the connection closed before the response ended. */
export const HTTP1_E_TRUNCATED: i32 = 10
/** `error`: a status line longer than `maxStatusLine`. */
export const HTTP1_E_STATUS_LINE_LIMIT: i32 = 11
/** `error`: a header section longer than `maxHeaderBytes`. */
export const HTTP1_E_HEADER_LIMIT: i32 = 12
/** `error`: more fields, trailers included, than `maxHeaders`. */
export const HTTP1_E_COUNT_LIMIT: i32 = 13
/** `error`: a declared or a received body longer than `maxBody`. */
export const HTTP1_E_BODY_LIMIT: i32 = 14
/** `error`: a trailer section longer than `maxTrailerBytes`. */
export const HTTP1_E_TRAILER_LIMIT: i32 = 15
/** `error`: a chunk-size line longer than `HTTP1_MAX_CHUNK_LINE`. */
export const HTTP1_E_CHUNK_LINE_LIMIT: i32 = 16
/** `error`: more than `HTTP1_MAX_INFORMATIONAL` interim responses. */
export const HTTP1_E_INFORMATIONAL_LIMIT: i32 = 17

// --- The writer -------------------------------------------------------------

/** How many decimal digits `n`, which is not negative, takes. */
const http1ClientDigits = (n: i64): i32 => {
  let digits: i32 = 1
  let v: i64 = n
  while (v >= toI64(10)) {
    v = v / toI64(10)
    digits += 1
  }
  return digits
}

/** Writes the decimal digits of `n`, which is not negative, at `out[at ..)`, which holds them, and answers where they end. */
const http1ClientPutDecimal = (out: u8[], at: i32, n: i64): i32 => {
  const digits: i32 = http1ClientDigits(n)
  let v: i64 = n
  for (let k: i32 = at + digits - 1; k >= at && k >= 0 && k < toI32(out.length); k -= 1) {
    out[k] = toU8(toI32(v % toI64(10)) + 48)
    v = v / toI64(10)
  }
  return at + digits
}

/** Whether `c` may follow the first letter of a URI scheme (RFC 3986 §3.1). */
const http1ClientIsSchemeByte = (c: i32): boolean =>
  (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46

/**
 * Whether `target` is a request target `method` may send (RFC 9112 §3.2):
 * authority-form (`host:port`) for CONNECT and for nothing else, `*` for
 * OPTIONS only, and otherwise origin-form (`/path?query`) or absolute-form
 * (`scheme:...`). No form holds a byte at or below SP, DEL, a non-ASCII byte
 * or a `#`: a fragment is never sent, and the others would end the target or
 * the line early.
 */
const http1ClientTargetOk = (method: string, target: string): boolean => {
  const n: i32 = toI32(target.length)
  if (n === 0) {
    return false
  }
  for (let k: i32 = 0; k < n; k += 1) {
    const c: i32 = toI32(target.charCodeAt(k))
    if (c <= 32 || c >= 127 || c === 35) {
      return false
    }
  }
  if (method === "CONNECT") {
    // uri-host ":" port, with no path, query or userinfo; an IPv6 host is
    // bracketed, so the port follows the last colon.
    let colon: i32 = -1
    for (let k: i32 = 0; k < n; k += 1) {
      const c: i32 = toI32(target.charCodeAt(k))
      if (c === 47 || c === 63 || c === 64) {
        return false
      }
      if (c === 58) {
        colon = k
      }
    }
    if (colon < 1 || n - colon - 1 < 1 || n - colon - 1 > 5) {
      return false
    }
    for (let k: i32 = colon + 1; k < n; k += 1) {
      const c: i32 = toI32(target.charCodeAt(k))
      if (c < 48 || c > 57) {
        return false
      }
    }
    return true
  }
  const first: i32 = toI32(target.charCodeAt(0))
  if (first === 42) {
    return n === 1 && method === "OPTIONS"
  }
  if (first === 47) {
    return true
  }
  // absolute-form: a scheme, a letter then scheme bytes, and its colon.
  if (!((first >= 97 && first <= 122) || (first >= 65 && first <= 90))) {
    return false
  }
  for (let k: i32 = 1; k < n; k += 1) {
    const c: i32 = toI32(target.charCodeAt(k))
    if (c === 58) {
      return true
    }
    if (!http1ClientIsSchemeByte(c)) {
      return false
    }
  }
  return false
}

/** Whether `value[k]` is a comma, the list separator of RFC 9110 §5.6.1. */
const http1ClientIsComma = (value: string, k: i32): boolean =>
  k >= 0 && k < toI32(value.length) && toI32(value.charCodeAt(k)) === 44

/** Where `value[a .. b)` starts once its leading OWS is dropped. */
const http1ClientTrimStart = (value: string, a: i32, b: i32): i32 => {
  let i: i32 = a
  while (i >= 0 && i < b && i < toI32(value.length) && http1IsOws(toI32(value.charCodeAt(i)))) {
    i += 1
  }
  return i
}

/** Where `value[a .. b)` ends once its trailing OWS is dropped. */
const http1ClientTrimEnd = (value: string, a: i32, b: i32): i32 => {
  let i: i32 = b
  while (i > a && i > 0 && i <= toI32(value.length)) {
    const j: i32 = i - 1
    if (j < 0 || j >= toI32(value.length) || !http1IsOws(toI32(value.charCodeAt(j)))) {
      return i
    }
    i = j
  }
  return i
}

/**
 * Whether the comma-separated list in `value` (RFC 9110 §5.6.1) holds `word`,
 * which is lowercase, in any case, each element trimmed of OWS.
 */
const http1ClientListHas = (value: string, word: string): boolean => {
  const n: i32 = toI32(value.length)
  let start: i32 = 0
  for (let k: i32 = 0; k <= n; k += 1) {
    if (k === n || http1ClientIsComma(value, k)) {
      const a: i32 = http1ClientTrimStart(value, start, k)
      const b: i32 = http1ClientTrimEnd(value, a, k)
      if (http1SameWord(value, a, b, word)) {
        return true
      }
      start = k + 1
    }
  }
  return false
}

/**
 * The bytes `http1WriteRequestHead` writes for these arguments, counted in 64
 * bits so that no caller's lengths can wrap the sum, or -1 for a head it
 * refuses. Every check is made here, before anything is written.
 */
const http1ClientRequestNeed = (
  method: string,
  target: string,
  names: string[],
  values: string[],
  bodyLength: i64
): i64 => {
  if (!http1IsToken(method) || !http1ClientTargetOk(method, target)) {
    return toI64(-1)
  }
  if (bodyLength < toI64(-2)) {
    return toI64(-1)
  }
  const count: i32 = toI32(names.length)
  if (toI32(values.length) !== count) {
    return toI64(-1)
  }
  // method SP target SP "HTTP/1.1" CRLF, the fields, the framing field and
  // the empty line.
  let need: i64 = toI64(method.length) + toI64(target.length) + toI64(14)
  let hosts: i32 = 0
  for (let i: i32 = 0; i < count && i < toI32(values.length); i += 1) {
    const name: string = names[i]
    const value: string = values[i]
    const nameLength: i32 = toI32(name.length)
    if (!http1IsToken(name) || !http1IsFieldText(value)) {
      return toI64(-1)
    }
    if (
      http1SameWord(name, 0, nameLength, "content-length") ||
      http1SameWord(name, 0, nameLength, "transfer-encoding")
    ) {
      return toI64(-1)
    }
    if (http1SameWord(name, 0, nameLength, "connection") && http1ClientListHas(value, "upgrade")) {
      return toI64(-1)
    }
    if (http1SameWord(name, 0, nameLength, "host")) {
      hosts += 1
    }
    need = need + toI64(nameLength) + toI64(value.length) + toI64(4)
  }
  if (hosts !== 1) {
    return toI64(-1)
  }
  if (bodyLength >= toI64(0)) {
    need = need + toI64(18 + http1ClientDigits(bodyLength))
  } else if (bodyLength === toI64(-1)) {
    need = need + toI64(28)
  }
  return need
}

/** Writes field `i` at `out[at ..)`, which holds it, and answers where it ends. */
const http1ClientPutField = (out: u8[], at: i32, names: string[], values: string[], i: i32): i32 => {
  if (i < 0 || i >= toI32(names.length) || i >= toI32(values.length)) {
    return at
  }
  let end: i32 = http1PutText(out, at, names[i])
  end = http1PutText(out, end, ": ")
  end = http1PutText(out, end, values[i])
  return http1PutText(out, end, "\r\n")
}

/**
 * An HTTP/1.1 request line and header section (RFC 9112 §3, §5), ending in
 * the empty line, written into `out` at `at` with nothing allocated, and
 * answers where it ends. `Host` goes first, as RFC 9110 §7.2 asks, then the
 * caller's other fields in order, then the framing field `bodyLength` asks
 * for: `Content-Length: n` for `n >= 0`, `Transfer-Encoding: chunked` for -1
 * (`HTTP1_CHUNKED`), and neither for -2 (`HTTP1_NO_BODY`).
 *
 * Answers `HTTP1_REFUSED` for a method that is not a token; a target that is
 * not a form the method may send (see the guide) or that holds a space, a
 * control byte, a non-ASCII byte or a `#`; a field name that is not a token or
 * a value holding CR, LF or another control byte (which would end the line
 * early and let the rest be read as a field or a second request); `names` and
 * `values` of different lengths; not exactly one `Host`; a `Content-Length` or
 * `Transfer-Encoding` among the caller's fields, since the framing is decided
 * here; a `Connection` that lists `upgrade`, which the parser refuses the
 * answer to; and a `bodyLength` below -2. Answers `HTTP1_NO_ROOM` when it is
 * well formed but does not fit. Either way `out` is untouched.
 */
export const http1WriteRequestHead = (
  out: u8[],
  at: i32,
  method: string,
  target: string,
  names: string[],
  values: string[],
  bodyLength: i64
): i32 => {
  const need: i64 = http1ClientRequestNeed(method, target, names, values, bodyLength)
  if (need < toI64(0)) {
    return HTTP1_REFUSED
  }
  if (at < 0 || at > toI32(out.length) || need > toI64(toI32(out.length) - at)) {
    return HTTP1_NO_ROOM
  }
  return http1ClientPutHead(out, at, method, target, names, values, bodyLength)
}

/** Writes a head `http1ClientRequestNeed` accepted into room it counted; answers the end. */
const http1ClientPutHead = (
  out: u8[],
  at: i32,
  method: string,
  target: string,
  names: string[],
  values: string[],
  bodyLength: i64
): i32 => {
  let end: i32 = http1PutText(out, at, method)
  end = http1PutText(out, end, " ")
  end = http1PutText(out, end, target)
  end = http1PutText(out, end, " HTTP/1.1\r\n")
  const count: i32 = toI32(names.length)
  for (let i: i32 = 0; i < count; i += 1) {
    if (http1SameWord(names[i], 0, toI32(names[i].length), "host")) {
      end = http1ClientPutField(out, end, names, values, i)
    }
  }
  for (let i: i32 = 0; i < count; i += 1) {
    if (!http1SameWord(names[i], 0, toI32(names[i].length), "host")) {
      end = http1ClientPutField(out, end, names, values, i)
    }
  }
  if (bodyLength >= toI64(0)) {
    end = http1PutText(out, end, "Content-Length: ")
    end = http1ClientPutDecimal(out, end, bodyLength)
    end = http1PutText(out, end, "\r\n")
  } else if (bodyLength === toI64(-1)) {
    end = http1PutText(out, end, "Transfer-Encoding: chunked\r\n")
  }
  return http1PutText(out, end, "\r\n")
}

/**
 * `http1WriteRequestHead`'s head in an array of its own, or `null` for
 * everything it refuses.
 */
export const http1RequestHead = (
  method: string,
  target: string,
  names: string[],
  values: string[],
  bodyLength: i64
): u8[] | null => {
  const need: i64 = http1ClientRequestNeed(method, target, names, values, bodyLength)
  if (need < toI64(0) || need > toI64(1073741824)) {
    return null
  }
  const out: u8[] = new Array<u8>(toI32(need))
  http1ClientPutHead(out, 0, method, target, names, values, bodyLength)
  return out
}

// --- The parser -------------------------------------------------------------

// The parser's states, one per kind of thing it is waiting for.
const HTTP1_CLIENT_S_STATUS_LINE: i32 = 0
const HTTP1_CLIENT_S_FIELDS: i32 = 1
const HTTP1_CLIENT_S_LENGTH_BODY: i32 = 2
const HTTP1_CLIENT_S_CLOSE_BODY: i32 = 3
const HTTP1_CLIENT_S_CHUNK_SIZE: i32 = 4
const HTTP1_CLIENT_S_CHUNK_DATA: i32 = 5
const HTTP1_CLIENT_S_CHUNK_CRLF: i32 = 6
const HTTP1_CLIENT_S_TRAILERS: i32 = 7
const HTTP1_CLIENT_S_MESSAGE_END: i32 = 8
const HTTP1_CLIENT_S_TUNNEL: i32 = 9
const HTTP1_CLIENT_S_CLOSED: i32 = 10
const HTTP1_CLIENT_S_ERROR: i32 = 11

/** `http1ClientTakeLine`'s answer when a whole line is ready; never an event. */
const HTTP1_CLIENT_LINE: i32 = -1

/** The largest `maxBody`: 2^53, so that sums of it cannot overflow an `i64`. */
const HTTP1_CLIENT_MAX_BODY: i64 = 9007199254740992

/** `limit` clamped into 0 to 2^30. */
const http1ClientClamp = (limit: i32): i32 => {
  if (limit < 0) {
    return 0
  }
  return limit > 1073741824 ? 1073741824 : limit
}

/**
 * One connection's response parser: responses on a kept-alive connection
 * follow one another through the same parser, each after its `expect`.
 */
export class Http1ResponseParser {
  // --- the response: valid from its HEAD or INFORMATIONAL until the next ----
  /** The reason phrase, which RFC 9112 §4 says a client ignores; for a log. */
  reason: string = ""
  /** The field names, in lowercase, in the order they arrived; `values` beside them, OWS trimmed. */
  names: string[]
  values: string[]
  /** The buffer the last `HTTP1_BODY`'s bytes are in, at `bodyOff`, `bodyLen` long. */
  body: u8[]
  /** What was wrong, once `next()` said `HTTP1_ERROR`; for a log. */
  errorText: string = ""
  /** The bytes fed and not yet consumed are `buf[start .. end)`. */
  buf: u8[]

  // --- limits, the caller's --------------------------------------------------
  maxBody: i64 = 0
  /** The declared body length, or -1 when the response has none or is chunked or read until close. */
  contentLength: i64 = -1
  /** Bytes left in a length-delimited body or in the current chunk. */
  left: i64 = 0
  /** De-chunked body bytes so far, against `maxBody`. */
  bodyTotal: i64 = 0
  maxStatusLine: i32 = 0
  maxHeaderBytes: i32 = 0
  maxHeaders: i32 = 0
  maxTrailerBytes: i32 = 0

  /** The status code of the response last read. */
  status: i32 = 0
  /** The minor version: 0 for HTTP/1.0, 1 for HTTP/1.1 and anything above it. */
  minor: i32 = 1
  bodyOff: i32 = 0
  bodyLen: i32 = 0
  /** Why `next()` said `HTTP1_ERROR`: one of the `HTTP1_E_` codes. */
  error: i32 = 0

  // --- internal --------------------------------------------------------------
  start: i32 = 0
  end: i32 = 0
  /** Where the search for the next LF resumes, so a line fed a byte at a time is scanned once. */
  scan: i32 = 0
  state: i32 = 0
  /** Bytes of the header or trailer section so far, against its limit. */
  sectionBytes: i32 = 0
  /** Field lines of the response so far, its trailers included, against `maxHeaders`. */
  fieldCount: i32 = 0
  /** Interim responses before this request's final one, against `HTTP1_MAX_INFORMATIONAL`. */
  informational: i32 = 0
  /** The line `http1ClientTakeLine` found is `buf[lineStart .. lineEnd)`, its CRLF dropped. */
  lineStart: i32 = 0
  lineEnd: i32 = 0

  chunked: boolean = false
  persistent: boolean = false
  /** What `expect` said of the request this response answers. */
  wasHead: boolean = false
  wasConnect: boolean = false
  /** Whether `finish()` said the server closed the connection. */
  closed: boolean = false

  /**
   * Each `i32` limit is clamped into 0 to 2^30 and `maxBody` into 0 to 2^53,
   * so that the sums the parser makes of them cannot overflow.
   */
  constructor(maxStatusLine: i32, maxHeaderBytes: i32, maxHeaders: i32, maxBody: i64, maxTrailerBytes: i32) {
    this.maxStatusLine = http1ClientClamp(maxStatusLine)
    this.maxHeaderBytes = http1ClientClamp(maxHeaderBytes)
    this.maxHeaders = http1ClientClamp(maxHeaders)
    this.maxTrailerBytes = http1ClientClamp(maxTrailerBytes)
    let body: i64 = maxBody
    if (body < toI64(0)) {
      body = toI64(0)
    }
    this.maxBody = body > HTTP1_CLIENT_MAX_BODY ? HTTP1_CLIENT_MAX_BODY : body
    this.buf = []
    this.body = this.buf
    this.names = []
    this.values = []
    http1ClientStartResponse(this)
  }

  /**
   * Says what the request this response answers was: a response to HEAD has
   * no body, and a 2xx to CONNECT is a tunnel. It takes effect only while the
   * parser waits for a response's first status line, and the parser forgets it
   * after that response's `HTTP1_END`; anywhere else it does nothing, so a
   * pipelining caller says it once per response, after the last one's end.
   */
  expect(methodWasHead: boolean, wasConnect: boolean): void {
    if (this.state === HTTP1_CLIENT_S_STATUS_LINE && this.informational === 0) {
      this.wasHead = methodWasHead
      this.wasConnect = wasConnect
    }
  }

  /**
   * Appends `data[off .. off + len)` to the input. A window outside `data`
   * panics. After `finish()`, or once the parser has closed or refused, the
   * input is dropped; in a tunnel it is kept for `tunnelBytes()`.
   */
  feed(data: u8[], off: i32, len: i32): void {
    const size: i32 = toI32(data.length)
    if (off < 0 || len < 0 || off > size || len > size - off) {
      panic("Http1ResponseParser: the window is outside the buffer")
    }
    if (this.closed || this.state === HTTP1_CLIENT_S_CLOSED || this.state === HTTP1_CLIENT_S_ERROR) {
      return
    }
    http1ClientReserve(this, len)
    const at: i32 = this.end
    copyBytes(this.buf, at, data, off, len)
    this.end = at + len
  }

  /**
   * Says the server closed the connection: a body read until close ends
   * there, a parser waiting for a response with nothing fed is closed, and
   * anything else is `HTTP1_E_TRUNCATED` once the bytes fed before it are read.
   */
  finish(): void {
    this.closed = true
  }

  /** The next event the input holds; see the module comment. */
  next(): i32 {
    const event: i32 = http1ClientNext(this)
    if (event !== HTTP1_NEED_MORE || !this.closed) {
      return event
    }
    if (this.state === HTTP1_CLIENT_S_CLOSE_BODY) {
      this.state = HTTP1_CLIENT_S_MESSAGE_END
      return http1ClientNext(this)
    }
    if (this.state === HTTP1_CLIENT_S_STATUS_LINE && this.informational === 0 && this.end === this.start) {
      this.state = HTTP1_CLIENT_S_CLOSED
      return HTTP1_CLOSED
    }
    return http1ClientFail(this, HTTP1_E_TRUNCATED, "the connection closed before the response ended")
  }

  /**
   * Whether the connection may carry the next request once this response has
   * ended (RFC 9112 §9.3): a 1.1 response unless `Connection` lists `close`,
   * a 1.0 response only when it lists `keep-alive`, and never one read until
   * close, a tunnel or an error.
   */
  keepAlive(): boolean {
    return this.persistent
  }

  /** The value of the first field named `name` (any case), or `null`. */
  header(name: string): string | null {
    const names: string[] = this.names
    const n: i32 = toI32(name.length)
    for (let i: i32 = 0; i < toI32(names.length) && i < toI32(this.values.length); i += 1) {
      if (http1SameWord(name, 0, n, names[i])) {
        return this.values[i]
      }
    }
    return null
  }

  /** How many bytes were fed and not consumed yet. */
  buffered(): i32 {
    return this.end - this.start
  }

  /** In a tunnel: every byte fed past the response head, as a fresh array. */
  tunnelBytes(): u8[] {
    let n: i32 = this.end - this.start
    if (n < 0 || this.state !== HTTP1_CLIENT_S_TUNNEL) {
      n = 0
    }
    const out: u8[] = new Array<u8>(n)
    if (n > 0) {
      copyBytes(out, 0, this.buf, this.start, n)
    }
    return out
  }
}

/** Makes room for `len` more bytes at `p.end`, moving the live bytes down first. */
const http1ClientReserve = (p: Http1ResponseParser, len: i32): void => {
  const old: u8[] = p.buf
  const capacity: i32 = toI32(old.length)
  if (len <= capacity - p.end) {
    return
  }
  const live: i32 = p.end - p.start
  let size: i32 = capacity < HTTP1_FIRST_INPUT ? HTTP1_FIRST_INPUT : capacity
  while (size - live < len) {
    if (size > 1073741823) {
      panic("Http1ResponseParser: more than 2^31 - 1 bytes buffered")
    }
    size = size * 2
  }
  // A fresh array when it has to grow, and the same one otherwise: either way
  // the live bytes move to the front, and every index into them moves too.
  const buf: u8[] = size === capacity ? old : new Array<u8>(size)
  const from: i32 = p.start
  if (live > 0) {
    copyBytes(buf, 0, old, from, live)
  }
  p.buf = buf
  p.lineStart -= from
  p.lineEnd -= from
  p.scan -= from
  p.start = 0
  p.end = live
}

/**
 * Refuses the input with `code` and drops what is buffered: nothing after a
 * refusal is read. Answers `HTTP1_ERROR`, so a caller can `return` it.
 */
const http1ClientFail = (p: Http1ResponseParser, code: i32, text: string): i32 => {
  p.state = HTTP1_CLIENT_S_ERROR
  p.start = p.end
  p.error = code
  p.errorText = text
  p.persistent = false
  return HTTP1_ERROR
}

/** Clears the per-response fields and waits for a status line. */
const http1ClientStartHead = (p: Http1ResponseParser): void => {
  p.state = HTTP1_CLIENT_S_STATUS_LINE
  p.status = 0
  p.reason = ""
  p.minor = 1
  p.names = []
  p.values = []
  p.contentLength = toI64(-1)
  p.chunked = false
  p.persistent = false
  p.bodyLen = 0
  p.bodyTotal = toI64(0)
  p.sectionBytes = 0
  p.fieldCount = 0
}

/** Clears the per-request fields too: the next response answers a new request. */
const http1ClientStartResponse = (p: Http1ResponseParser): void => {
  http1ClientStartHead(p)
  p.informational = 0
  p.wasHead = false
  p.wasConnect = false
}

/**
 * Finds the next line: answers `HTTP1_CLIENT_LINE` with it in `lineStart ..
 * lineEnd`, `HTTP1_NEED_MORE` when no LF has arrived yet, or the refusal. A
 * line ends in CRLF and in nothing else. A line longer than `limit` bytes is
 * refused with `overCode`, and that is decided before the bare-LF check, so
 * that a long line ending in a bare LF is refused with the same code whether
 * its LF arrived with it or after the limit was already passed.
 */
const http1ClientTakeLine = (p: Http1ResponseParser, limit: i32, overCode: i32, overText: string): i32 => {
  const buf: u8[] = p.buf
  const end: i32 = p.end
  let i: i32 = p.scan > p.start ? p.scan : p.start
  while (i >= 0 && i < end && i < toI32(buf.length)) {
    if (buf[i] === 10) {
      if (i - p.start > limit + 1) {
        return http1ClientFail(p, overCode, overText)
      }
      if (i === p.start || buf[i - 1] !== 13) {
        return http1ClientFail(p, HTTP1_E_BARE_LF, "a line ended in a bare LF")
      }
      p.lineStart = p.start
      p.lineEnd = i - 1
      p.start = i + 1
      p.scan = i + 1
      return HTTP1_CLIENT_LINE
    }
    i += 1
  }
  p.scan = end
  if (end - p.start > limit + 1) {
    return http1ClientFail(p, overCode, overText)
  }
  return HTTP1_NEED_MORE
}

/** Whether `buf[i]` is an ASCII digit. */
const http1ClientDigitAt = (buf: u8[], i: i32): boolean =>
  i >= 0 && i < toI32(buf.length) && buf[i] >= 48 && buf[i] <= 57

/**
 * Reads the status line in `lineStart .. lineEnd` (RFC 9112 §4):
 * `HTTP/` DIGIT `.` DIGIT SP 3DIGIT SP reason-phrase. A missing reason and its
 * space are taken as an empty reason, since the reason means nothing.
 */
const http1ClientStatusLine = (p: Http1ResponseParser): i32 => {
  const buf: u8[] = p.buf
  const a: i32 = p.lineStart
  const b: i32 = p.lineEnd < toI32(buf.length) ? p.lineEnd : toI32(buf.length)
  if (
    b - a < 12 ||
    a < 0 ||
    buf[a] !== 72 ||
    buf[a + 1] !== 84 ||
    buf[a + 2] !== 84 ||
    buf[a + 3] !== 80 ||
    buf[a + 4] !== 47 ||
    !http1ClientDigitAt(buf, a + 5) ||
    buf[a + 6] !== 46 ||
    !http1ClientDigitAt(buf, a + 7) ||
    buf[a + 8] !== 32 ||
    !http1ClientDigitAt(buf, a + 9) ||
    !http1ClientDigitAt(buf, a + 10) ||
    !http1ClientDigitAt(buf, a + 11) ||
    (b - a > 12 && buf[a + 12] !== 32)
  ) {
    return http1ClientFail(p, HTTP1_E_STATUS_LINE, "a malformed status line")
  }
  if (buf[a + 5] !== 49) {
    return http1ClientFail(p, HTTP1_E_VERSION, "an HTTP major version other than 1")
  }
  const status: i32 =
    (toI32(buf[a + 9]) - 48) * 100 + (toI32(buf[a + 10]) - 48) * 10 + (toI32(buf[a + 11]) - 48)
  if (status < 100 || status > 599) {
    return http1ClientFail(p, HTTP1_E_STATUS_LINE, "a status code outside 100 to 599")
  }
  for (let k: i32 = a + 13; k < b && k < toI32(buf.length); k += 1) {
    if (!http1IsValueByte(toI32(buf[k]))) {
      return http1ClientFail(p, HTTP1_E_STATUS_LINE, "a control character in the reason phrase")
    }
  }
  p.minor = buf[a + 7] === 48 ? 0 : 1
  p.status = status
  p.reason = b - a > 13 ? http1Text(buf, a + 13, b, false) : ""
  p.state = HTTP1_CLIENT_S_FIELDS
  return HTTP1_NEED_MORE
}

/**
 * Reads one field line in `lineStart .. lineEnd` (RFC 9112 §5) into `names`
 * and `values`, or, for a trailer, only checks it. Answers `HTTP1_NEED_MORE`
 * or the refusal.
 */
const http1ClientFieldLine = (p: Http1ResponseParser, keep: boolean): i32 => {
  const buf: u8[] = p.buf
  const a: i32 = p.lineStart
  const b: i32 = p.lineEnd < toI32(buf.length) ? p.lineEnd : toI32(buf.length)
  if (a >= 0 && a < b && http1IsOws(toI32(buf[a]))) {
    return http1ClientFail(p, HTTP1_E_FIELD, "a field line that starts with whitespace (obs-fold)")
  }
  let i: i32 = a
  while (i >= 0 && i < b && i < toI32(buf.length) && http1IsTokenByte(toI32(buf[i]))) {
    i += 1
  }
  if (i === a || i >= b || buf[i] !== 58) {
    return http1ClientFail(p, HTTP1_E_FIELD, "a malformed field name")
  }
  const nameEnd: i32 = i
  for (let k: i32 = nameEnd + 1; k >= 0 && k < b && k < toI32(buf.length); k += 1) {
    if (!http1IsValueByte(toI32(buf[k]))) {
      return http1ClientFail(p, HTTP1_E_FIELD, "a control character in a field value")
    }
  }
  p.fieldCount += 1
  if (p.fieldCount > p.maxHeaders) {
    return http1ClientFail(p, HTTP1_E_COUNT_LIMIT, "more fields than the limit")
  }
  // A trailer is checked and counted, but not kept: nothing here reads one.
  if (keep) {
    let valueStart: i32 = nameEnd + 1
    let valueEnd: i32 = b
    while (
      valueStart >= 0 &&
      valueStart < valueEnd &&
      valueStart < toI32(buf.length) &&
      http1IsOws(toI32(buf[valueStart]))
    ) {
      valueStart += 1
    }
    while (
      valueEnd > valueStart &&
      valueEnd - 1 < toI32(buf.length) &&
      http1IsOws(toI32(buf[valueEnd - 1]))
    ) {
      valueEnd -= 1
    }
    p.names.push(http1Text(buf, a, nameEnd, true))
    p.values.push(http1Text(buf, valueStart, valueEnd, false))
  }
  return HTTP1_NEED_MORE
}

/**
 * Reads one `Content-Length` value: a comma-separated list (RFC 9110 §8.6
 * lets a recipient take a list of one repeated value as that value) whose
 * elements are each a run of digits and all the same as each other and as
 * `seen`, the value of an earlier field (-1 for none). Answers the value, -1
 * when an element is empty or not digits, or -2 when two values differ. A
 * value past 2^53 is saturated to 2^53 + 1: over any `maxBody`.
 */
const http1ClientLengthList = (value: string, seen: i64): i64 => {
  const n: i32 = toI32(value.length)
  let found: i64 = seen
  let start: i32 = 0
  for (let k: i32 = 0; k <= n; k += 1) {
    if (k === n || http1ClientIsComma(value, k)) {
      const a: i32 = http1ClientTrimStart(value, start, k)
      const b: i32 = http1ClientTrimEnd(value, a, k)
      if (a === b) {
        return toI64(-1)
      }
      let v: i64 = toI64(0)
      for (let j: i32 = a; j >= 0 && j < b && j < n; j += 1) {
        const c: i32 = toI32(value.charCodeAt(j))
        if (c < 48 || c > 57) {
          return toI64(-1)
        }
        if (v <= (HTTP1_CLIENT_MAX_BODY - toI64(c - 48)) / toI64(10)) {
          v = v * toI64(10) + toI64(c - 48)
        } else {
          v = HTTP1_CLIENT_MAX_BODY + toI64(1)
        }
      }
      if (found >= toI64(0) && found !== v) {
        return toI64(-2)
      }
      found = v
      start = k + 1
    }
  }
  return found
}

/**
 * The fields of `name` together as one comma-separated list (RFC 9110 §5.3),
 * tallied for `word`: answers the element count times 4, plus 2 when `word`
 * appears more than once and 1 when it is the last element.
 */
const http1ClientTally = (p: Http1ResponseParser, name: string, word: string): i32 => {
  let elements: i32 = 0
  let matches: i32 = 0
  let last: boolean = false
  const names: string[] = p.names
  const values: string[] = p.values
  for (let i: i32 = 0; i < toI32(names.length) && i < toI32(values.length); i += 1) {
    if (names[i] === name) {
      const value: string = values[i]
      const n: i32 = toI32(value.length)
      let start: i32 = 0
      for (let k: i32 = 0; k <= n; k += 1) {
        if (k === n || http1ClientIsComma(value, k)) {
          const a: i32 = http1ClientTrimStart(value, start, k)
          const b: i32 = http1ClientTrimEnd(value, a, k)
          if (b > a) {
            elements += 1
            last = http1SameWord(value, a, b, word)
            if (last) {
              matches += 1
            }
          }
          start = k + 1
        }
      }
    }
  }
  return elements * 4 + (matches > 1 ? 2 : 0) + (last ? 1 : 0)
}

/** Whether a `Connection` field of the response lists `word`. */
const http1ClientConnectionHas = (p: Http1ResponseParser, word: string): boolean => {
  const names: string[] = p.names
  for (let i: i32 = 0; i < toI32(names.length) && i < toI32(p.values.length); i += 1) {
    if (names[i] === "connection" && http1ClientListHas(p.values[i], word)) {
      return true
    }
  }
  return false
}

/**
 * A header section has ended: answer `HTTP1_INFORMATIONAL` for a 1xx, or
 * decide the final response's framing and the connection's fate (RFC 9112
 * §6.3, §9.3) and answer `HTTP1_HEAD`, or the refusal.
 */
const http1ClientEndOfHead = (p: Http1ResponseParser): i32 => {
  const status: i32 = p.status
  if (status === 101) {
    return http1ClientFail(p, HTTP1_E_SWITCH, "a 101 Switching Protocols this client never asks for")
  }
  if (status < 200) {
    if (p.informational >= HTTP1_MAX_INFORMATIONAL) {
      return http1ClientFail(p, HTTP1_E_INFORMATIONAL_LIMIT, "more interim responses than the limit")
    }
    // The 1xx's status and fields stay readable until the next status line.
    p.informational += 1
    p.state = HTTP1_CLIENT_S_STATUS_LINE
    return HTTP1_INFORMATIONAL
  }
  if (p.wasConnect && status < 300) {
    // RFC 9110 §9.3.6: a 2xx to CONNECT has no content, and its framing
    // fields are ignored; what follows the head is the tunnel's.
    p.persistent = false
    p.state = HTTP1_CLIENT_S_MESSAGE_END
    return HTTP1_HEAD
  }
  let codings: boolean = false
  let length: i64 = toI64(-1)
  const names: string[] = p.names
  for (let i: i32 = 0; i < toI32(names.length) && i < toI32(p.values.length); i += 1) {
    if (names[i] === "transfer-encoding") {
      codings = true
    } else if (names[i] === "content-length") {
      length = http1ClientLengthList(p.values[i], length)
      if (length === toI64(-2)) {
        return http1ClientFail(p, HTTP1_E_LENGTH, "Content-Length values that differ")
      }
      if (length < toI64(0)) {
        return http1ClientFail(p, HTTP1_E_LENGTH, "a Content-Length that is not one run of digits")
      }
    }
  }
  if (codings) {
    if (length >= toI64(0)) {
      return http1ClientFail(p, HTTP1_E_FRAMING, "both Content-Length and Transfer-Encoding")
    }
    if (p.minor === 0) {
      return http1ClientFail(p, HTTP1_E_CODING, "Transfer-Encoding in an HTTP/1.0 response")
    }
    const tally: i32 = http1ClientTally(p, "transfer-encoding", "chunked")
    if ((tally & 1) === 0) {
      return http1ClientFail(p, HTTP1_E_CODING, "a transfer coding list that does not end in chunked")
    }
    if ((tally & 2) !== 0) {
      return http1ClientFail(p, HTTP1_E_CODING, "chunked applied twice")
    }
    if (tally >> 2 > 1) {
      return http1ClientFail(p, HTTP1_E_CODING, "a transfer coding other than chunked")
    }
  }
  const close: boolean = http1ClientConnectionHas(p, "close")
  p.persistent = p.minor === 1 ? !close : !close && http1ClientConnectionHas(p, "keep-alive")
  if (p.wasHead || status === 204 || status === 304) {
    // RFC 9112 §6.3 rules 1 and 2: no content, whatever the fields say,
    // and their syntax has been checked so that a smuggled one still fails.
    p.state = HTTP1_CLIENT_S_MESSAGE_END
    return HTTP1_HEAD
  }
  if (codings) {
    p.chunked = true
    p.state = HTTP1_CLIENT_S_CHUNK_SIZE
  } else if (length >= toI64(0)) {
    if (length > p.maxBody) {
      return http1ClientFail(p, HTTP1_E_BODY_LIMIT, "a Content-Length over the limit")
    }
    p.contentLength = length
    p.left = length
    p.state = length > toI64(0) ? HTTP1_CLIENT_S_LENGTH_BODY : HTTP1_CLIENT_S_MESSAGE_END
  } else {
    p.persistent = false
    p.state = HTTP1_CLIENT_S_CLOSE_BODY
  }
  return HTTP1_HEAD
}

/**
 * Reads a chunk-size line (RFC 9112 §7.1): 1*HEXDIG, then optional
 * whitespace and a `;` extension that is read past but not interpreted. Sets
 * `left` and answers `HTTP1_NEED_MORE`, or the refusal.
 */
const http1ClientChunkSize = (p: Http1ResponseParser): i32 => {
  const buf: u8[] = p.buf
  const a: i32 = p.lineStart
  const b: i32 = p.lineEnd < toI32(buf.length) ? p.lineEnd : toI32(buf.length)
  const room: i64 = p.maxBody - p.bodyTotal
  let size: i64 = toI64(0)
  let over: boolean = false
  let i: i32 = a
  while (i >= 0 && i < b && i < toI32(buf.length)) {
    const digit: i32 = http1HexValue(toI32(buf[i]))
    if (digit < 0) {
      break
    }
    if (!over) {
      if (toI64(digit) > room || size > (room - toI64(digit)) / toI64(16)) {
        over = true
      } else {
        size = size * toI64(16) + toI64(digit)
      }
    }
    i += 1
  }
  if (i === a) {
    return http1ClientFail(p, HTTP1_E_CHUNK, "a chunk size with no hex digits")
  }
  // Whitespace may follow the size only as the BWS before a chunk extension's
  // `;`, so whitespace that runs to the end of the line is refused.
  const digitsEnd: i32 = i
  while (i >= 0 && i < b && i < toI32(buf.length) && http1IsOws(toI32(buf[i]))) {
    i += 1
  }
  if (i >= b && i > digitsEnd) {
    return http1ClientFail(p, HTTP1_E_CHUNK, "a malformed chunk size")
  }
  if (i >= 0 && i < b) {
    if (buf[i] !== 59) {
      return http1ClientFail(p, HTTP1_E_CHUNK, "a malformed chunk size")
    }
    for (let k: i32 = i + 1; k >= 0 && k < b && k < toI32(buf.length); k += 1) {
      if (!http1IsValueByte(toI32(buf[k]))) {
        return http1ClientFail(p, HTTP1_E_CHUNK, "a control character in a chunk extension")
      }
    }
  }
  if (over) {
    return http1ClientFail(p, HTTP1_E_BODY_LIMIT, "a chunked body over the limit")
  }
  p.left = size
  p.state = size === toI64(0) ? HTTP1_CLIENT_S_TRAILERS : HTTP1_CLIENT_S_CHUNK_DATA
  p.sectionBytes = 0
  return HTTP1_NEED_MORE
}

/**
 * Hands the caller up to `p.left` of the buffered body bytes, and moves to
 * `after` once the last of them is handed out.
 */
const http1ClientBodyWindow = (p: Http1ResponseParser, after: i32): i32 => {
  const ready: i32 = p.end - p.start
  if (ready <= 0) {
    return HTTP1_NEED_MORE
  }
  const take: i32 = toI64(ready) < p.left ? ready : toI32(p.left)
  p.body = p.buf
  p.bodyOff = p.start
  p.bodyLen = take
  p.start += take
  p.scan = p.start
  p.left = p.left - toI64(take)
  p.bodyTotal = p.bodyTotal + toI64(take)
  if (p.left === toI64(0)) {
    p.state = after
  }
  return HTTP1_BODY
}

/** A body read until the server closes: every byte fed, up to `maxBody`. */
const http1ClientCloseBody = (p: Http1ResponseParser): i32 => {
  const ready: i32 = p.end - p.start
  if (ready <= 0) {
    return HTTP1_NEED_MORE
  }
  const room: i64 = p.maxBody - p.bodyTotal
  if (room <= toI64(0)) {
    return http1ClientFail(p, HTTP1_E_BODY_LIMIT, "a body read until close over the limit")
  }
  // `left` is the room, and the state stays: only the close ends this body.
  p.left = room
  return http1ClientBodyWindow(p, HTTP1_CLIENT_S_CLOSE_BODY)
}

/** The state machine behind `next()`. */
const http1ClientNext = (p: Http1ResponseParser): i32 => {
  while (true) {
    switch (p.state) {
      case HTTP1_CLIENT_S_STATUS_LINE: {
        const got: i32 = http1ClientTakeLine(
          p,
          p.maxStatusLine,
          HTTP1_E_STATUS_LINE_LIMIT,
          "a status line over the limit"
        )
        if (got !== HTTP1_CLIENT_LINE) {
          return got
        }
        http1ClientStartHead(p)
        if (http1ClientStatusLine(p) === HTTP1_ERROR) {
          return HTTP1_ERROR
        }
        break
      }
      case HTTP1_CLIENT_S_FIELDS:
      case HTTP1_CLIENT_S_TRAILERS: {
        const trailer: boolean = p.state === HTTP1_CLIENT_S_TRAILERS
        const limit: i32 = trailer ? p.maxTrailerBytes : p.maxHeaderBytes
        const code: i32 = trailer ? HTTP1_E_TRAILER_LIMIT : HTTP1_E_HEADER_LIMIT
        const text: string = trailer ? "a trailer section over the limit" : "a header section over the limit"
        const got: i32 = http1ClientTakeLine(p, limit - p.sectionBytes, code, text)
        if (got !== HTTP1_CLIENT_LINE) {
          return got
        }
        p.sectionBytes += p.lineEnd - p.lineStart + 2
        if (p.sectionBytes > limit) {
          return http1ClientFail(p, code, text)
        }
        if (p.lineEnd === p.lineStart) {
          if (trailer) {
            p.state = HTTP1_CLIENT_S_MESSAGE_END
            break
          }
          return http1ClientEndOfHead(p)
        }
        if (http1ClientFieldLine(p, !trailer) === HTTP1_ERROR) {
          return HTTP1_ERROR
        }
        break
      }
      case HTTP1_CLIENT_S_LENGTH_BODY:
        return http1ClientBodyWindow(p, HTTP1_CLIENT_S_MESSAGE_END)
      case HTTP1_CLIENT_S_CLOSE_BODY:
        return http1ClientCloseBody(p)
      case HTTP1_CLIENT_S_CHUNK_SIZE: {
        const got: i32 = http1ClientTakeLine(
          p,
          HTTP1_MAX_CHUNK_LINE,
          HTTP1_E_CHUNK_LINE_LIMIT,
          "a chunk-size line over the limit"
        )
        if (got !== HTTP1_CLIENT_LINE) {
          return got
        }
        if (http1ClientChunkSize(p) === HTTP1_ERROR) {
          return HTTP1_ERROR
        }
        break
      }
      case HTTP1_CLIENT_S_CHUNK_DATA:
        return http1ClientBodyWindow(p, HTTP1_CLIENT_S_CHUNK_CRLF)
      case HTTP1_CLIENT_S_CHUNK_CRLF: {
        // The CRLF after chunk data is an empty line, so a limit of zero
        // refuses anything else in its place.
        const got: i32 = http1ClientTakeLine(p, 0, HTTP1_E_CHUNK, "chunk data not followed by CRLF")
        if (got !== HTTP1_CLIENT_LINE) {
          return got
        }
        p.state = HTTP1_CLIENT_S_CHUNK_SIZE
        break
      }
      case HTTP1_CLIENT_S_MESSAGE_END: {
        if (p.wasConnect && p.status >= 200 && p.status < 300) {
          p.state = HTTP1_CLIENT_S_TUNNEL
        } else if (!p.persistent) {
          p.state = HTTP1_CLIENT_S_CLOSED
        } else {
          // The fields stay readable until the next status line arrives.
          p.state = HTTP1_CLIENT_S_STATUS_LINE
          p.informational = 0
          p.wasHead = false
          p.wasConnect = false
        }
        return HTTP1_END
      }
      case HTTP1_CLIENT_S_TUNNEL:
        return HTTP1_UPGRADE
      case HTTP1_CLIENT_S_CLOSED:
        return HTTP1_CLOSED
      default:
        return HTTP1_ERROR
    }
  }
}
