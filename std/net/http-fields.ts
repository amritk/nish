/**
 * `nish/net/http-fields` — the header model HTTP/2 and HTTP/3 share: what a
 * field name and a field value may hold, the pseudo-header fields and the
 * order and count they come in, the connection-specific fields neither
 * version carries, and the shapes of a request, a response and a trailer
 * section.
 *
 *     import { HttpFields, HTTP_FIELDS_OK } from "nish/net/http-fields";
 *
 *     const request = new HttpFields();
 *     if (request.readRequest(decoder.names, decoder.values, extendedConnect) === HTTP_FIELDS_OK) {
 *       // request.method, request.path, request.get("content-type"), ...
 *     }
 *
 * It is version-neutral on purpose: RFC 9113 §8 and RFC 9114 §4 state the
 * same rules for a field section, and each version answers a section that
 * breaks one in its own words — HTTP/2 with a stream error of type
 * PROTOCOL_ERROR (RFC 9113 §8.1.1), HTTP/3 with H3_MESSAGE_ERROR (RFC 9114
 * §4.1.2). So every check here answers one of the `HTTP_FIELDS_*` codes and
 * nothing more, and nothing here knows about frames, streams or a codec.
 *
 * **What it refuses** (RFC 9110 §5, RFC 9113 §8.2 and §8.3, RFC 9114 §4.2
 * and §4.3, RFC 8441 §4):
 *
 * - a field name that is empty, holds a character outside RFC 9110's `tchar`,
 *   or holds an uppercase letter — both versions send names in lowercase and
 *   call an uppercase one malformed (`HTTP_FIELDS_BAD_NAME`);
 * - a field value with a NUL, CR or LF anywhere, or a space or tab at either
 *   end (`HTTP_FIELDS_BAD_VALUE`) — the first three are what lets a value end
 *   a line once the message is turned back into HTTP/1.1;
 * - `connection`, `proxy-connection`, `keep-alive`, `transfer-encoding`,
 *   `upgrade`, and `te` with any value but `trailers`
 *   (`HTTP_FIELDS_CONNECTION_SPECIFIC`);
 * - a pseudo-header that is not one of the five a request has or the one a
 *   response has (`HTTP_FIELDS_PSEUDO_UNKNOWN`), one that appears twice
 *   (`_PSEUDO_REPEATED`), one after a regular field (`_PSEUDO_AFTER_FIELD`),
 *   one the shape does not allow — `:status` in a request, `:path` in a
 *   plain CONNECT, any in a trailer section, `:protocol` where extended
 *   CONNECT was not enabled or with a method but CONNECT
 *   (`_PSEUDO_FORBIDDEN`) — and a required one that is absent
 *   (`_PSEUDO_MISSING`);
 * - a pseudo-header value of the wrong shape: a `:method` or `:protocol`
 *   that is not a token, a `:scheme` that is not RFC 3986's, an empty
 *   `:path` or one that starts with neither `/` nor is OPTIONS's `*`, an
 *   `:authority` with userinfo, a `:status` that is not three digits from
 *   100 to 599 (`HTTP_FIELDS_BAD_PSEUDO_VALUE`);
 * - a `host` field that names another authority than `:authority`, letters
 *   compared without case (`HTTP_FIELDS_AUTHORITY_MISMATCH`);
 * - a `content-length` that is not one run of at most eighteen digits, or two
 *   that disagree (`HTTP_FIELDS_BAD_CONTENT_LENGTH`). Matching it against
 *   the body is the version's job, since only it sees the body.
 *
 * Names and values are octets (`u8[]`), as HPACK and QPACK answer them. A
 * section that passes keeps references to the caller's arrays, not copies, so
 * it is valid for as long as they are.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9110, RFC 9113, RFC 9114 and RFC 8441, not ported from
 * another implementation.
 */

/** A field section that has the shape asked for. */
export const HTTP_FIELDS_OK: i32 = 0

/** A field name that is empty, not a token, or not in lowercase. */
export const HTTP_FIELDS_BAD_NAME: i32 = -1

/** A field value with a NUL, CR or LF, or whitespace at either end. */
export const HTTP_FIELDS_BAD_VALUE: i32 = -2

/** A connection-specific field (RFC 9113 §8.2.2, RFC 9114 §4.2). */
export const HTTP_FIELDS_CONNECTION_SPECIFIC: i32 = -3

/** A pseudo-header that neither a request nor a response defines. */
export const HTTP_FIELDS_PSEUDO_UNKNOWN: i32 = -4

/** A pseudo-header that appears more than once. */
export const HTTP_FIELDS_PSEUDO_REPEATED: i32 = -5

/** A pseudo-header after a regular field. */
export const HTTP_FIELDS_PSEUDO_AFTER_FIELD: i32 = -6

/** A pseudo-header the shape requires and the section does not have. */
export const HTTP_FIELDS_PSEUDO_MISSING: i32 = -7

/** A pseudo-header the shape does not allow. */
export const HTTP_FIELDS_PSEUDO_FORBIDDEN: i32 = -8

/** A pseudo-header whose value does not have its field's syntax. */
export const HTTP_FIELDS_BAD_PSEUDO_VALUE: i32 = -9

/** A `host` field that names another authority than `:authority`. */
export const HTTP_FIELDS_AUTHORITY_MISMATCH: i32 = -10

/** A `content-length` that is not a run of digits, or two that disagree. */
export const HTTP_FIELDS_BAD_CONTENT_LENGTH: i32 = -11

/** `contentLength` when the section has no `content-length`. */
export const HTTP_FIELDS_NO_LENGTH: i64 = -1

/** The pseudo-headers, as bits of a mask while a section is read. */
const HTTP_FIELDS_METHOD: i32 = 1
const HTTP_FIELDS_SCHEME: i32 = 2
const HTTP_FIELDS_AUTHORITY: i32 = 4
const HTTP_FIELDS_PATH: i32 = 8
const HTTP_FIELDS_PROTOCOL: i32 = 16
const HTTP_FIELDS_STATUS: i32 = 32

/** The longest `content-length` read: eighteen digits stay inside an `i64`. */
const HTTP_FIELDS_MAX_LENGTH_DIGITS: i32 = 18

/** A typed zero, so that a bare literal does not become an `f64` under `--number-mode f64`. */
const HTTP_FIELDS_ZERO: i32 = 0

/** Whether `c` is a `tchar` of RFC 9110 §5.6.2, uppercase letters left out. */
const httpFieldsLowerTchar = (c: i32): boolean => {
  if ((c >= 97 && c <= 122) || (c >= 48 && c <= 57)) {
    return true
  }
  switch (c) {
    case 33: // !
    case 35: // #
    case 36: // $
    case 37: // %
    case 38: // &
    case 39: // '
    case 42: // *
    case 43: // +
    case 45: // -
    case 46: // .
    case 94: // ^
    case 95: // _
    case 96: // `
    case 124: // |
    case 126: // ~
      return true
    default:
      return false
  }
}

/** Whether `bytes` is a non-empty token, with uppercase letters in it only when `upper`. */
const httpFieldsAllTchar = (bytes: u8[], upper: boolean): boolean => {
  if (toI32(bytes.length) === 0) {
    return false
  }
  for (const b of bytes) {
    const c: i32 = toI32(b)
    if (!httpFieldsLowerTchar(c) && !(upper && c >= 65 && c <= 90)) {
      return false
    }
  }
  return true
}

/**
 * Whether `name` may be sent as a regular field name in HTTP/2 or HTTP/3: a
 * non-empty token in lowercase (RFC 9110 §5.1, RFC 9113 §8.2.1, RFC 9114
 * §4.2). A pseudo-header's name starts with a colon and is not one.
 */
export const httpFieldNameValid = (name: u8[]): boolean => httpFieldsAllTchar(name, false)

/**
 * Whether `value` may be sent as a field value: no NUL, CR or LF, and no
 * space or tab as its first or last octet (RFC 9113 §8.2.1, RFC 9114 §4.2).
 * Other octets, obs-text included, pass as they are.
 */
export const httpFieldValueValid = (value: u8[]): boolean => {
  const n: i32 = toI32(value.length)
  for (const b of value) {
    const c: i32 = toI32(b)
    if (c === 0 || c === 10 || c === 13) {
      return false
    }
  }
  if (n === 0) {
    return true
  }
  const first: i32 = toI32(value[0])
  const last: i32 = toI32(value[n - 1])
  return first !== 32 && first !== 9 && last !== 32 && last !== 9
}

/** Whether the octets of `bytes` spell `text` exactly. */
export const httpFieldIs = (bytes: u8[], text: string): boolean => {
  const n: i32 = toI32(bytes.length)
  if (n !== toI32(text.length)) {
    return false
  }
  for (let k: i32 = 0; k < n && k < toI32(bytes.length) && k < toI32(text.length); k++) {
    if (toI32(bytes[k]) !== toI32(text.charCodeAt(k))) {
      return false
    }
  }
  return true
}

/** The octets of `text`, one a character: what a field name or value is sent as. */
export const httpFieldBytes = (text: string): u8[] => {
  const out: u8[] = []
  const n: i32 = toI32(text.length)
  for (let k: i32 = 0; k < n; k++) {
    out.push(toU8(text.charCodeAt(k)))
  }
  return out
}

/**
 * Whether a field named `name` with `value` is connection-specific, which
 * HTTP/2 and HTTP/3 refuse in a message (RFC 9113 §8.2.2, RFC 9114 §4.2):
 * the fields RFC 9110 §7.6.1 names, `keep-alive`, `proxy-connection`,
 * `transfer-encoding` and `upgrade`, and `te` with any value but
 * `trailers`.
 */
export const httpFieldConnectionSpecific = (name: u8[], value: u8[]): boolean => {
  if (httpFieldIs(name, "te")) {
    return !httpFieldIs(value, "trailers")
  }
  return (
    httpFieldIs(name, "connection") ||
    httpFieldIs(name, "proxy-connection") ||
    httpFieldIs(name, "keep-alive") ||
    httpFieldIs(name, "transfer-encoding") ||
    httpFieldIs(name, "upgrade")
  )
}

/**
 * Whether a field named `name` carries a credential an encoder should never
 * put in a compression table, here or at any intermediary: `authorization`,
 * `proxy-authorization`, `cookie` and `set-cookie` (RFC 7541 §7.1.3, RFC 9204
 * §7.1.3). A table entry can be probed by a peer that controls part of what
 * is compressed beside it, so a secret sent indexed can leak through the
 * compressed length (CRIME's shape).
 */
export const httpFieldSensitive = (name: u8[]): boolean =>
  httpFieldIs(name, "authorization") ||
  httpFieldIs(name, "proxy-authorization") ||
  httpFieldIs(name, "cookie") ||
  httpFieldIs(name, "set-cookie")

/** An ASCII letter in lowercase, any other octet as it is. */
const httpFieldsLower = (c: i32): i32 => (c >= 65 && c <= 90 ? c + 32 : c)

/**
 * Whether `bytes` and `other` hold the same octets, ASCII letters compared
 * without case, as a host name is (RFC 3986 §3.2.2).
 */
const httpFieldsSameHost = (bytes: u8[], other: u8[]): boolean => {
  const n: i32 = toI32(bytes.length)
  if (n !== toI32(other.length)) {
    return false
  }
  for (let k: i32 = 0; k < n && k < toI32(bytes.length) && k < toI32(other.length); k++) {
    if (httpFieldsLower(toI32(bytes[k])) !== httpFieldsLower(toI32(other[k]))) {
      return false
    }
  }
  return true
}

/** The pseudo-header bit `name` is, 0 for a regular field, -1 for a name that starts with a colon and is none of them. */
const httpFieldsPseudoOf = (name: u8[]): i32 => {
  if (toI32(name.length) === 0 || toI32(name[0]) !== 58) {
    return 0
  }
  if (httpFieldIs(name, ":method")) {
    return HTTP_FIELDS_METHOD
  }
  if (httpFieldIs(name, ":scheme")) {
    return HTTP_FIELDS_SCHEME
  }
  if (httpFieldIs(name, ":authority")) {
    return HTTP_FIELDS_AUTHORITY
  }
  if (httpFieldIs(name, ":path")) {
    return HTTP_FIELDS_PATH
  }
  if (httpFieldIs(name, ":protocol")) {
    return HTTP_FIELDS_PROTOCOL
  }
  if (httpFieldIs(name, ":status")) {
    return HTTP_FIELDS_STATUS
  }
  return -1
}

/** Whether `scheme` has RFC 3986 §3.1's syntax: a letter, then letters, digits, `+`, `-` and `.`. */
const httpFieldsSchemeValid = (scheme: u8[]): boolean => {
  const n: i32 = toI32(scheme.length)
  for (let k: i32 = 0; k < n && k < toI32(scheme.length); k++) {
    const c: i32 = toI32(scheme[k])
    const letter: boolean = (c >= 97 && c <= 122) || (c >= 65 && c <= 90)
    const rest: boolean = (c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46
    if (!letter && (k === 0 || !rest)) {
      return false
    }
  }
  return n > 0
}

/** The status code three ASCII digits from 100 to 599 spell, or -1. */
const httpFieldsStatusOf = (value: u8[]): i32 => {
  if (toI32(value.length) !== 3) {
    return -1
  }
  let code: i32 = 0
  for (const b of value) {
    const digit: i32 = toI32(b) - 48
    if (digit < 0 || digit > 9) {
      return -1
    }
    code = code * 10 + digit
  }
  return code >= 100 && code <= 599 ? code : -1
}

/** The length one run of at most eighteen ASCII digits spells, or -1. */
const httpFieldsLengthOf = (value: u8[]): i64 => {
  const n: i32 = toI32(value.length)
  if (n === 0 || n > HTTP_FIELDS_MAX_LENGTH_DIGITS) {
    return toI64(-1)
  }
  let length: i64 = 0
  for (const b of value) {
    const digit: i32 = toI32(b) - 48
    if (digit < 0 || digit > 9) {
      return toI64(-1)
    }
    length = length * toI64(10) + toI64(digit)
  }
  return length
}

/** Whether `authority` holds an `@`, which only userinfo would put there (RFC 9113 §8.3.1). */
const httpFieldsHasUserinfo = (authority: u8[]): boolean => {
  for (const b of authority) {
    if (toI32(b) === 64) {
      return true
    }
  }
  return false
}

/**
 * Checks a field section a program is about to send, pseudo-headers left
 * out: every name valid and in lowercase, every value valid, nothing
 * connection-specific, and as many values as names. Answers `HTTP_FIELDS_OK`
 * or the first refusal. A version's writer refuses what this refuses, so
 * that a program's string can never reach the wire as a field it was not.
 */
export const httpFieldsCheckOutgoing = (names: u8[][], values: u8[][]): i32 => {
  const n: i32 = toI32(names.length)
  if (n !== toI32(values.length)) {
    return HTTP_FIELDS_BAD_VALUE
  }
  for (let k: i32 = 0; k < n && k < toI32(names.length) && k < toI32(values.length); k++) {
    const name: u8[] = names[k]
    const value: u8[] = values[k]
    if (!httpFieldNameValid(name)) {
      return HTTP_FIELDS_BAD_NAME
    }
    if (!httpFieldValueValid(value)) {
      return HTTP_FIELDS_BAD_VALUE
    }
    if (httpFieldConnectionSpecific(name, value)) {
      return HTTP_FIELDS_CONNECTION_SPECIFIC
    }
  }
  return HTTP_FIELDS_OK
}

/**
 * One field section read into its shape: the pseudo-headers by name, and the
 * regular fields in order. `readRequest`, `readResponse` and `readTrailers`
 * each clear it and fill it from a decoded section, and answer
 * `HTTP_FIELDS_OK` or the first refusal; after a refusal what it holds is
 * partial and not to be used. Every read empties and refills the same two
 * lists rather than making new ones, so a caller that keeps a section past
 * the next read copies it.
 */
export class HttpFields {
  /** `:method`, empty in a response or a trailer section. */
  method: u8[]
  /** `:scheme`, empty when absent. */
  scheme: u8[]
  /** `:authority`, empty when absent. */
  authority: u8[]
  /** `:path`, empty when absent. */
  path: u8[]
  /** `:protocol` of an extended CONNECT (RFC 8441), empty when absent. */
  protocol: u8[]
  /** `:status` of a response, or 0. */
  status: i32 = 0
  /** The regular fields' names, in order. */
  names: u8[][]
  /** The regular fields' values, beside their names. */
  values: u8[][]
  /** The `content-length`, or `HTTP_FIELDS_NO_LENGTH`. */
  contentLength: i64 = -1
  /** The empty value an absent pseudo-header reads as, made once. */
  none: u8[]

  constructor() {
    this.method = []
    this.scheme = []
    this.authority = []
    this.path = []
    this.protocol = []
    this.none = []
    this.names = []
    this.values = []
  }

  /** Empties every field, so the next read starts from nothing. */
  clear(): void {
    this.method = this.none
    this.scheme = this.none
    this.authority = this.none
    this.path = this.none
    this.protocol = this.none
    this.status = 0
    while (toI32(this.names.length) > 0) {
      this.names.pop()
    }
    while (toI32(this.values.length) > 0) {
      this.values.pop()
    }
    this.contentLength = HTTP_FIELDS_NO_LENGTH
  }

  /** Whether the method is CONNECT, plain (RFC 9113 §8.5) or extended (RFC 8441). */
  isConnect(): boolean {
    return httpFieldIs(this.method, "CONNECT")
  }

  /** The value of the first regular field named `name` (lowercase), or `null`. */
  get(name: string): u8[] | null {
    const n: i32 = toI32(this.names.length)
    for (let k: i32 = 0; k < n && k < toI32(this.names.length) && k < toI32(this.values.length); k++) {
      if (httpFieldIs(this.names[k], name)) {
        return this.values[k]
      }
    }
    return null
  }

  /**
   * Reads `names` and `values` as a section whose pseudo-headers are those
   * `allowed` names, recording them and the regular fields. The shape's own
   * rules — which pseudo-headers are required — are the caller's. Answers
   * the mask of pseudo-headers seen, or a negative refusal.
   */
  readSection(names: u8[][], values: u8[][], allowed: i32): i32 {
    this.clear()
    const n: i32 = toI32(names.length)
    if (n !== toI32(values.length)) {
      return HTTP_FIELDS_BAD_VALUE
    }
    let seen: i32 = 0
    let regular: boolean = false
    for (let k: i32 = 0; k < n && k < toI32(names.length) && k < toI32(values.length); k++) {
      const name: u8[] = names[k]
      const value: u8[] = values[k]
      if (!httpFieldValueValid(value)) {
        return HTTP_FIELDS_BAD_VALUE
      }
      const pseudo: i32 = httpFieldsPseudoOf(name)
      if (pseudo < 0) {
        return HTTP_FIELDS_PSEUDO_UNKNOWN
      }
      if (pseudo > 0) {
        if (regular) {
          return HTTP_FIELDS_PSEUDO_AFTER_FIELD
        }
        if ((seen & pseudo) !== 0) {
          return HTTP_FIELDS_PSEUDO_REPEATED
        }
        if ((allowed & pseudo) === 0) {
          return HTTP_FIELDS_PSEUDO_FORBIDDEN
        }
        seen = seen | pseudo
        const result: i32 = this.takePseudo(pseudo, value)
        if (result !== HTTP_FIELDS_OK) {
          return result
        }
        continue
      }
      regular = true
      if (!httpFieldNameValid(name)) {
        return HTTP_FIELDS_BAD_NAME
      }
      if (httpFieldConnectionSpecific(name, value)) {
        return HTTP_FIELDS_CONNECTION_SPECIFIC
      }
      if (httpFieldIs(name, "content-length")) {
        const length: i64 = httpFieldsLengthOf(value)
        if (length < toI64(0) || (this.contentLength >= toI64(0) && this.contentLength !== length)) {
          return HTTP_FIELDS_BAD_CONTENT_LENGTH
        }
        this.contentLength = length
      }
      this.names.push(name)
      this.values.push(value)
    }
    return seen
  }

  /** Records the pseudo-header `pseudo` as `value`, checking its syntax. */
  takePseudo(pseudo: i32, value: u8[]): i32 {
    switch (pseudo) {
      case HTTP_FIELDS_METHOD:
        this.method = value
        return httpFieldsAllTchar(value, true) ? HTTP_FIELDS_OK : HTTP_FIELDS_BAD_PSEUDO_VALUE
      case HTTP_FIELDS_SCHEME:
        this.scheme = value
        return httpFieldsSchemeValid(value) ? HTTP_FIELDS_OK : HTTP_FIELDS_BAD_PSEUDO_VALUE
      case HTTP_FIELDS_AUTHORITY:
        this.authority = value
        return httpFieldsHasUserinfo(value) ? HTTP_FIELDS_BAD_PSEUDO_VALUE : HTTP_FIELDS_OK
      case HTTP_FIELDS_PATH:
        this.path = value
        return toI32(value.length) > 0 ? HTTP_FIELDS_OK : HTTP_FIELDS_BAD_PSEUDO_VALUE
      case HTTP_FIELDS_PROTOCOL:
        this.protocol = value
        return httpFieldsAllTchar(value, true) ? HTTP_FIELDS_OK : HTTP_FIELDS_BAD_PSEUDO_VALUE
      default:
        this.status = httpFieldsStatusOf(value)
        return this.status > 0 ? HTTP_FIELDS_OK : HTTP_FIELDS_BAD_PSEUDO_VALUE
    }
  }

  /**
   * Reads a request's field section (RFC 9113 §8.3.1, RFC 9114 §4.3.1).
   * Every request has `:method`. A CONNECT without `:protocol` has
   * `:authority` and neither `:scheme` nor `:path` (RFC 9113 §8.5). An
   * extended CONNECT — `:protocol` present, which only `extendedConnect`
   * allows, the version having sent SETTINGS_ENABLE_CONNECT_PROTOCOL — has
   * all four of the others (RFC 8441 §4). Any other request has `:scheme`
   * and `:path`. A `:path` that does not start with `/` is OPTIONS's `*` or
   * refused, and a `host` field must name `:authority` when both are there.
   */
  readRequest(names: u8[][], values: u8[][], extendedConnect: boolean): i32 {
    const all: i32 =
      HTTP_FIELDS_METHOD |
      HTTP_FIELDS_SCHEME |
      HTTP_FIELDS_AUTHORITY |
      HTTP_FIELDS_PATH |
      HTTP_FIELDS_PROTOCOL
    const seen: i32 = this.readSection(names, values, all)
    if (seen < 0) {
      return seen
    }
    if ((seen & HTTP_FIELDS_METHOD) === 0) {
      return HTTP_FIELDS_PSEUDO_MISSING
    }
    const connect: boolean = this.isConnect()
    if ((seen & HTTP_FIELDS_PROTOCOL) !== 0) {
      if (!extendedConnect || !connect) {
        return HTTP_FIELDS_PSEUDO_FORBIDDEN
      }
      const tunnel: i32 = HTTP_FIELDS_SCHEME | HTTP_FIELDS_AUTHORITY | HTTP_FIELDS_PATH
      if ((seen & tunnel) !== tunnel) {
        return HTTP_FIELDS_PSEUDO_MISSING
      }
    } else if (connect) {
      if ((seen & (HTTP_FIELDS_SCHEME | HTTP_FIELDS_PATH)) !== 0) {
        return HTTP_FIELDS_PSEUDO_FORBIDDEN
      }
      if ((seen & HTTP_FIELDS_AUTHORITY) === 0) {
        return HTTP_FIELDS_PSEUDO_MISSING
      }
    } else if ((seen & (HTTP_FIELDS_SCHEME | HTTP_FIELDS_PATH)) !== (HTTP_FIELDS_SCHEME | HTTP_FIELDS_PATH)) {
      return HTTP_FIELDS_PSEUDO_MISSING
    }
    if (toI32(this.path.length) > 0 && toI32(this.path[0]) !== 47) {
      if (!httpFieldIs(this.path, "*") || !httpFieldIs(this.method, "OPTIONS")) {
        return HTTP_FIELDS_BAD_PSEUDO_VALUE
      }
    }
    const host: u8[] | null = this.get("host")
    if (host !== null && (seen & HTTP_FIELDS_AUTHORITY) !== 0 && !httpFieldsSameHost(host, this.authority)) {
      return HTTP_FIELDS_AUTHORITY_MISMATCH
    }
    return HTTP_FIELDS_OK
  }

  /** Reads a response's field section: exactly one `:status`, and no other pseudo-header (RFC 9113 §8.3.2). */
  readResponse(names: u8[][], values: u8[][]): i32 {
    const seen: i32 = this.readSection(names, values, HTTP_FIELDS_STATUS)
    if (seen < 0) {
      return seen
    }
    return (seen & HTTP_FIELDS_STATUS) !== 0 ? HTTP_FIELDS_OK : HTTP_FIELDS_PSEUDO_MISSING
  }

  /** Reads a trailer section: regular fields only (RFC 9113 §8.1). */
  readTrailers(names: u8[][], values: u8[][]): i32 {
    const seen: i32 = this.readSection(names, values, HTTP_FIELDS_ZERO)
    return seen < 0 ? seen : HTTP_FIELDS_OK
  }
}
