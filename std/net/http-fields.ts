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
 *   the body is the version's job, since only it sees the body;
 * - in a section a program sends, a second `date` field: `Date` is a
 *   singleton (RFC 9110 §5.3, §6.6.1) whose value holds a comma, so two
 *   cannot be combined into one and a reader cannot tell which to believe
 *   (`HTTP_FIELDS_DATE_REPEATED`).
 *
 * **The date.** `httpDateWrite` writes a second since 1970 as an IMF-fixdate
 * (RFC 9110 §5.6.7), `Fri, 16 Oct 2026 08:11:54 GMT`, the form every version's
 * `Date` field takes. It reads no clock, so a wasm32 build can import it; the
 * caller supplies the second.
 *
 * **Media types.** `mediaTypeParse` reads a `Content-Type` value (RFC 9110
 * §8.3.1): a `type/subtype` pair of tokens, lowercased, then `;`-separated
 * parameters whose names are lowercased tokens and whose values are tokens or
 * quoted strings, a backslash in one escaping the octet after it. A
 * parameter named twice is refused, since two readers could believe
 * different ones, and so is a 17th, which keeps that check linear in the
 * value. `formDataDispositionParse` reads the `Content-Disposition`
 * of a `multipart/form-data` part the same way, except that a backslash in a
 * quoted value is a backslash: the HTML form submission algorithm writes `"`
 * as `%22` and leaves `\` alone, so `filename="C:\x.txt"` names the file a
 * browser sent. `mediaTypeParam` looks a parameter up.
 *
 * Names and values are octets (`u8[]`), as HPACK and QPACK answer them. A
 * section that passes keeps references to the caller's arrays, not copies, so
 * it is valid for as long as they are.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 *
 * Written from RFC 9110, RFC 9113, RFC 9114, RFC 8441 and the HTML form
 * submission algorithm, not ported from another implementation.
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

/** A `date` field that a section about to be sent holds more than once (RFC 9110 §5.3). */
export const HTTP_FIELDS_DATE_REPEATED: i32 = -12

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
 *
 * @param name the field name's octets, as the program would send them
 * @returns true when the name may go on the wire as it is; false for an empty
 *   name, a non-token character or an uppercase letter
 */
export const httpFieldNameValid = (name: u8[]): boolean => httpFieldsAllTchar(name, false)

/**
 * Whether `value` may be sent as a field value: no NUL, CR or LF, and no
 * space or tab as its first or last octet (RFC 9113 §8.2.1, RFC 9114 §4.2).
 * Other octets, obs-text included, pass as they are.
 *
 * @param value the field value's octets, as the program would send them
 * @returns true when the value cannot end a line or smuggle whitespace at its
 *   edges, so it may be sent as it is
 */
export const httpFieldValueValid = (value: u8[]): boolean => {
  const n: i32 = toI32(value.length)
  for (const b of value) {
    const c: i32 = toI32(b)
    if (c === 0 || c === 10 || c === 13) {
      return false
    }
  }
  // `n` is the length, so only an empty value, which has no edges to hold
  // whitespace, takes this branch; the test is what proves the two indexes.
  const lastAt: i32 = n - 1
  if (lastAt < 0 || lastAt >= toI32(value.length) || toI32(value.length) < 1) {
    return true
  }
  const first: i32 = toI32(value[0])
  const last: i32 = toI32(value[lastAt])
  return first !== 32 && first !== 9 && last !== 32 && last !== 9
}

/**
 * Whether the octets of `bytes` spell `text` exactly.
 *
 * @param bytes the octets to compare, such as a decoded field name
 * @param text the expected spelling, one character an octet; case matters
 * @returns true only when both have the same length and every octet matches
 */
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

/**
 * The octets of `text`, one a character: what a field name or value is sent as.
 *
 * @param text the name or value to turn into octets; each character's code is
 *   kept in one octet, so it should be Latin-1
 * @returns a fresh array the caller owns, one octet per character of `text`
 */
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
 *
 * @param name the field name's octets, in lowercase
 * @param value the field's value, which matters only for `te`
 * @returns true when the field belongs to one HTTP/1.1 hop and must not be
 *   sent or accepted in an HTTP/2 or HTTP/3 message
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
 *
 * @param name the field name's octets, in lowercase
 * @returns true when the encoder should send this field never-indexed
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
  if (toI32(name.length) < 1 || toI32(name[0]) !== 58) {
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
    // The length test above allows three digits, so `code` is at most 99
    // before the last one; the test is what proves the sum cannot overflow.
    if (code < 0 || code > 99) {
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
  // The value stays `u64` throughout: at most eighteen digits stay below
  // 10^18, so the sum never wraps and its value fits an `i64` exactly.
  let length: u64 = 0
  for (const b of value) {
    const digit: i32 = toI32(b) - 48
    if (digit < 0 || digit > 9) {
      return toI64(-1)
    }
    length = length * 10 + toU64(digit)
  }
  return toI64(length)
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
 * connection-specific, at most one `date` (a singleton, RFC 9110 §5.3), and
 * as many values as names. Answers `HTTP_FIELDS_OK` or the first refusal. A
 * version's writer refuses what this refuses, so that a program's string can
 * never reach the wire as a field it was not.
 *
 * @param names the regular field names about to be sent, in order
 * @param values the value for each name, at the same index
 * @returns `HTTP_FIELDS_OK` when the whole section may be sent, or the
 *   `HTTP_FIELDS_*` code of the first field that may not (`HTTP_FIELDS_BAD_VALUE`
 *   too when the two lists differ in length)
 */
export const httpFieldsCheckOutgoing = (names: u8[][], values: u8[][]): i32 => {
  const n: i32 = toI32(names.length)
  if (n !== toI32(values.length)) {
    return HTTP_FIELDS_BAD_VALUE
  }
  let dated: boolean = false
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
    if (httpFieldIs(name, "date")) {
      if (dated) {
        return HTTP_FIELDS_DATE_REPEATED
      }
      dated = true
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
  private none: u8[]

  /** Makes an empty section, ready for its first read; no field is set yet. */
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

  /**
   * Whether the method is CONNECT, plain (RFC 9113 §8.5) or extended (RFC 8441).
   *
   * @returns true when the last read section's `:method` is exactly `CONNECT`
   */
  isConnect(): boolean {
    return httpFieldIs(this.method, "CONNECT")
  }

  /**
   * The value of the first regular field named `name` (lowercase), or `null`.
   *
   * @param name the field name to look for, in lowercase as HTTP/2 and HTTP/3
   *   send it
   * @returns the caller's own value array for that field, not a copy, or `null`
   *   when the section has no such field
   */
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
  private readSection(names: u8[][], values: u8[][], allowed: i32): i32 {
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
  private takePseudo(pseudo: i32, value: u8[]): i32 {
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
   *
   * @param names the decoded field names, pseudo-headers first, in wire order
   * @param values the decoded value for each name, at the same index
   * @param extendedConnect whether this connection sent
   *   SETTINGS_ENABLE_CONNECT_PROTOCOL, so a `:protocol` is allowed
   * @returns `HTTP_FIELDS_OK` when the section is a well-formed request and
   *   this object now describes it, or the `HTTP_FIELDS_*` code of the first
   *   rule it breaks
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

  /**
   * Reads a response's field section: exactly one `:status`, and no other pseudo-header (RFC 9113 §8.3.2).
   *
   * @param names the decoded field names, `:status` first, in wire order
   * @param values the decoded value for each name, at the same index
   * @returns `HTTP_FIELDS_OK` when the section is a well-formed response and
   *   `status` holds its code, or the `HTTP_FIELDS_*` code of the first rule
   *   it breaks
   */
  readResponse(names: u8[][], values: u8[][]): i32 {
    const seen: i32 = this.readSection(names, values, HTTP_FIELDS_STATUS)
    if (seen < 0) {
      return seen
    }
    return (seen & HTTP_FIELDS_STATUS) !== 0 ? HTTP_FIELDS_OK : HTTP_FIELDS_PSEUDO_MISSING
  }

  /**
   * Reads a trailer section: regular fields only (RFC 9113 §8.1).
   *
   * @param names the decoded trailer field names, in wire order
   * @param values the decoded value for each name, at the same index
   * @returns `HTTP_FIELDS_OK` when every field is a valid regular field, or the
   *   `HTTP_FIELDS_*` code of the first that is not (a known pseudo-header
   *   here is `HTTP_FIELDS_PSEUDO_FORBIDDEN`)
   */
  readTrailers(names: u8[][], values: u8[][]): i32 {
    const seen: i32 = this.readSection(names, values, HTTP_FIELDS_ZERO)
    return seen < 0 ? seen : HTTP_FIELDS_OK
  }
}

// ---- The date ------------------------------------------------------------------

/** An IMF-fixdate's length: `Sun, 06 Nov 1994 08:49:37 GMT` (RFC 9110 §5.6.7). */
export const HTTP_DATE_SIZE: i32 = 29

/** The last second an IMF-fixdate can name, 9999-12-31T23:59:59Z, in seconds since 1970. */
export const HTTP_DATE_LAST_SECOND: i64 = 253402300799

/** The day names from Sunday, then the month names from January, three letters each. */
const HTTP_FIELDS_DATE_NAMES: string = "SunMonTueWedThuFriSatJanFebMarAprMayJunJulAugSepOctNovDec"

/**
 * Writes `b` at `out[at + k]`. Its one caller, `httpDateWrite`, has checked
 * `0 <= at` and `at + HTTP_DATE_SIZE <= out.length` before the first write,
 * and every `k` it passes is a constant from 0 to 28, under `HTTP_DATE_SIZE`:
 * so `at + k` is inside `out` and the tests always hold. The first test,
 * whose literals are `HTTP_DATE_SIZE - 1` and `2^31 - 1` less that, proves
 * the sum cannot overflow, and the second proves the index; nothing is
 * allocated, and a byte it skipped would show in the `httpDateWrite` round
 * trips `tests/run.js` pins byte for byte (`tests/link/net_http_date`). The
 * skip is unreachable by that room check in `httpDateWrite`, which the prover
 * does not carry across the call, so the tests stay.
 */
const httpFieldsPut = (out: u8[], at: i32, k: i32, b: u32): void => {
  if (at < 0 || at > 2147483619 || k < 0 || k > 28) {
    return
  }
  const pos: i32 = at + k
  if (pos < toI32(out.length)) {
    out[pos] = toU8(b)
  }
}

/**
 * Writes the three letters at `HTTP_FIELDS_DATE_NAMES[3 * index ..)` at
 * `out[at + k ..)`. `httpDateWrite` passes a weekday, `(days + 4) % 7`, so 0
 * to 6, or `6 + month` with `month` 1 to 12 by the 153-day rule, so 7 to 18:
 * `3 * index + 2` is at most 56, under the table's 57 letters, and the test
 * always holds. It is what proves the index. Every `k` it is passed is 0 or
 * 8, so the test on `k`, whose 26 is `HTTP_DATE_SIZE - 3`, always holds too;
 * it is what proves `k + d` cannot overflow.
 */
const httpFieldsPutName = (out: u8[], at: i32, k: i32, index: u32): void => {
  if (k < 0 || k > 26) {
    return
  }
  const names: string = HTTP_FIELDS_DATE_NAMES
  for (let d: i32 = 0; d < 3; d++) {
    // The letter's place is worked in `u32`, as `index` is: at most 56.
    const step: u32 = toU32(d)
    const pos: i32 = toI32(index * 3 + step)
    if (pos >= 0 && pos < toI32(names.length)) {
      httpFieldsPut(out, at, k + d, toU32(names.charCodeAt(pos)))
    }
  }
}

/**
 * Writes `n`, 0 to 99, as two digits at `out[at + k ..)`. Every `k` it is
 * passed is at most 23, so the test, whose 27 is `HTTP_DATE_SIZE - 2`, always
 * holds; it is what proves `k + 1` cannot overflow.
 */
const httpFieldsPutTwo = (out: u8[], at: i32, k: i32, n: u32): void => {
  if (k < 0 || k > 27) {
    return
  }
  httpFieldsPut(out, at, k, toU32(48) + n / 10)
  httpFieldsPut(out, at, k + 1, toU32(48) + (n % 10))
}

/**
 * Writes the IMF-fixdate of `seconds` since 1970-01-01T00:00:00Z at
 * `out[at .. at + HTTP_DATE_SIZE)` and answers where it ends; -1, with nothing
 * written, for a second before 1970 or after `HTTP_DATE_LAST_SECOND`, whose
 * year has no four digits, or for an `out` without the room. It reads no
 * clock, so it compiles for wasm32 too: `HttpDate` in `nish/net/http1-server`
 * is the cache that reads one and calls this at most once a second.
 *
 * The date follows Howard Hinnant's `civil_from_days` ("chrono-Compatible
 * Low-Level Date Algorithms"), step for step and with its constants, which
 * its author donated to the public domain: days are counted from 0000-03-01,
 * so a leap day is the last day of its year and a 400-year era is always
 * 146,097 days long. Every step
 * is `u64` arithmetic on numbers that never wrap, so `--number-mode f64`
 * writes the same bytes.
 *
 * @param out the buffer to write into; its length is not changed
 * @param at the index in `out` where the date's first letter goes
 * @param seconds the instant to name, in whole seconds since 1970 UTC
 * @returns the index just past the date's last octet (`at + HTTP_DATE_SIZE`),
 *   or -1 when nothing was written
 */
export const httpDateWrite = (out: u8[], at: i32, seconds: i64): i32 => {
  if (seconds < 0 || seconds > HTTP_DATE_LAST_SECOND || at < 0 || at > toI32(out.length) - 29) {
    return -1
  }
  // The test above keeps `seconds` far below 2^63, so every step is `u64`
  // arithmetic on numbers that neither wrap nor go below 0.
  const total: u64 = toU64(seconds)
  const days: u64 = total / 86400
  const inDay: u32 = toU32(total % 86400)
  // 1970-01-01 was a Thursday, and 0 is Sunday.
  const weekday: u32 = toU32((days + 4) % 7)
  // From 0000-03-01 to 1970-01-01 is 719,468 days.
  const z: u64 = days + 719468
  const era: u64 = z / 146097
  const dayOfEra: u64 = z - era * 146097
  const yearOfEra: u64 = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365
  const dayOfYear: u64 = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
  // Months from March, each 30 or 31 days by the 153-day rule.
  const marchMonth: u64 = (5 * dayOfYear + 2) / 153
  const day: u32 = toU32(dayOfYear - (153 * marchMonth + 2) / 5 + 1)
  const month: u32 = toU32(marchMonth < 10 ? marchMonth + 3 : marchMonth - 9)
  const year: u32 = toU32(yearOfEra + era * 400) + (month <= 2 ? 1 : 0)
  httpFieldsPutName(out, at, 0, weekday)
  httpFieldsPut(out, at, 3, 44)
  httpFieldsPut(out, at, 4, 32)
  httpFieldsPutTwo(out, at, 5, day)
  httpFieldsPut(out, at, 7, 32)
  httpFieldsPutName(out, at, 8, 6 + month)
  httpFieldsPut(out, at, 11, 32)
  httpFieldsPutTwo(out, at, 12, year / 100)
  httpFieldsPutTwo(out, at, 14, year % 100)
  httpFieldsPut(out, at, 16, 32)
  httpFieldsPutTwo(out, at, 17, inDay / 3600)
  httpFieldsPut(out, at, 19, 58)
  httpFieldsPutTwo(out, at, 20, (inDay / 60) % 60)
  httpFieldsPut(out, at, 22, 58)
  httpFieldsPutTwo(out, at, 23, inDay % 60)
  httpFieldsPut(out, at, 25, 32)
  httpFieldsPut(out, at, 26, 71)
  httpFieldsPut(out, at, 27, 77)
  httpFieldsPut(out, at, 28, 84)
  // The room test above, whose 29 is `HTTP_DATE_SIZE`, keeps the end at most
  // `out.length`; it is what proves the sum cannot overflow.
  return at + 29
}

/**
 * A media type or a disposition as `mediaTypeParse` and
 * `formDataDispositionParse` read it: the type and subtype in lowercase, and
 * the parameters in the order they came, each name in lowercase beside its
 * value with any quoting removed.
 */
export class MediaType {
  /** The type, `text` in `text/html`, or a disposition's type, in lowercase. */
  type: string = ""
  /** The subtype, `html` in `text/html`, in lowercase; empty for a disposition. */
  subtype: string = ""
  /** The parameter names, in lowercase, in the order they came. */
  names: string[] = []
  /** The parameter values, `values[k]` beside `names[k]`, quotes removed. */
  values: string[] = []
}

/** The most parameters a media type or disposition may carry; one more is refused. */
const HTTP_FIELDS_MAX_PARAMS: i32 = 16

/** Whether `c` is a `tchar` (RFC 9110 §5.6.2), in either case. */
const httpFieldsTchar = (c: i32): boolean => httpFieldsLowerTchar(c) || (c >= 65 && c <= 90)

/** Whether `c` is optional whitespace (RFC 9110 §5.6.3): a space or a tab. */
const httpFieldsOws = (c: i32): boolean => c === 32 || c === 9

/**
 * Whether `c` may stand inside a quoted string as itself (RFC 9110 §5.6.4's
 * `qdtext`): a tab, a space, any visible character but `"` and `\`, or
 * obs-text.
 */
const httpFieldsQdtext = (c: i32): boolean =>
  c === 9 || c === 32 || c === 33 || (c >= 35 && c <= 91) || (c >= 93 && c <= 126) || (c >= 128 && c <= 255)

/**
 * The octets in `bytes[from .. to)` as a string, letters in lowercase when
 * `lower`; empty when the window is not inside `bytes`. It goes a byte at a
 * time because `String.fromBytes` keeps a range check no proof removes; each
 * `String.fromCharCode` is the one octet, so the string's bytes are the
 * window's.
 */
const httpFieldsString = (bytes: readonly u8[], from: i32, to: i32, lower: boolean): string => {
  const parts: string[] = []
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(bytes.length)) {
    const c: i32 = toI32(bytes[i])
    parts.push(String.fromCharCode(lower && c >= 65 && c <= 90 ? c | 32 : c))
    i = i + 1
  }
  return parts.join("")
}

/** The end of the run of `tchar` that starts at `from`, at most `to`. */
const httpFieldsTokenEnd = (bytes: readonly u8[], from: i32, to: i32): i32 => {
  const n: i32 = toI32(bytes.length)
  let i: i32 = from
  while (i >= 0 && i < to && i < n && httpFieldsTchar(toI32(bytes[i]))) {
    i = i + 1
  }
  return i
}

/** The first index from `from` that is not optional whitespace, at most `to`. */
const httpFieldsOwsEnd = (bytes: readonly u8[], from: i32, to: i32): i32 => {
  const n: i32 = toI32(bytes.length)
  let i: i32 = from
  while (i >= 0 && i < to && i < n && httpFieldsOws(toI32(bytes[i]))) {
    i = i + 1
  }
  return i
}

/**
 * Reads the parameters in `bytes[from .. to)` into `into`: each is optional
 * whitespace, `;`, optional whitespace and then, unless the list ends or
 * another `;` follows, a token name, `=` and a value that is a token or a
 * quoted string (RFC 9110 §5.6.6). With `escapes`, a backslash inside the
 * quotes takes the next octet as itself (§5.6.4); without, it is an octet
 * like any other, as HTML form submission writes a name (it escapes `"` as
 * `%22` instead). Answers false for any other shape, for a name given
 * twice, letters compared without case, and for a 17th parameter.
 */
const httpFieldsParams = (
  bytes: readonly u8[],
  from: i32,
  to: i32,
  escapes: boolean,
  into: MediaType
): boolean => {
  let i: i32 = from
  while (i >= 0 && i < to && i < toI32(bytes.length)) {
    i = httpFieldsOwsEnd(bytes, i, to)
    if (i === to) {
      return true
    }
    if (i < 0 || i >= toI32(bytes.length) || toI32(bytes[i]) !== 59) {
      return false
    }
    i = httpFieldsOwsEnd(bytes, i + 1, to)
    if (i === to) {
      return true
    }
    if (i < 0 || i >= toI32(bytes.length)) {
      return false
    }
    if (toI32(bytes[i]) === 59) {
      continue
    }
    const nameEnd: i32 = httpFieldsTokenEnd(bytes, i, to)
    if (
      nameEnd === i ||
      nameEnd < 0 ||
      nameEnd >= to ||
      nameEnd >= toI32(bytes.length) ||
      toI32(bytes[nameEnd]) !== 61
    ) {
      return false
    }
    // A cap on the count keeps the repeat check below from going quadratic.
    if (toI32(into.names.length) >= HTTP_FIELDS_MAX_PARAMS) {
      return false
    }
    const name: string = httpFieldsString(bytes, i, nameEnd, true)
    for (const seen of into.names) {
      if (seen === name) {
        return false
      }
    }
    i = nameEnd + 1
    if (i < to && i < toI32(bytes.length) && toI32(bytes[i]) === 34) {
      const out: string[] = []
      i = i + 1
      let closed: boolean = false
      while (!closed && i >= 0 && i < to && i < toI32(bytes.length)) {
        const c: i32 = toI32(bytes[i])
        if (c === 34) {
          closed = true
        } else if (c === 92 && escapes) {
          // A quoted pair: the octet after the backslash is a tab, a space,
          // a visible character or obs-text, and stands for itself.
          i = i + 1
          if (i >= to || i >= toI32(bytes.length)) {
            return false
          }
          const e: i32 = toI32(bytes[i])
          if (!(e === 9 || (e >= 32 && e <= 126) || (e >= 128 && e <= 255))) {
            return false
          }
          out.push(String.fromCharCode(e))
        } else if (httpFieldsQdtext(c) || c === 92) {
          out.push(String.fromCharCode(c))
        } else {
          return false
        }
        i = i + 1
      }
      if (!closed) {
        return false
      }
      into.names.push(name)
      into.values.push(out.join(""))
    } else {
      const valueEnd: i32 = httpFieldsTokenEnd(bytes, i, to)
      if (valueEnd === i) {
        return false
      }
      into.names.push(name)
      into.values.push(httpFieldsString(bytes, i, valueEnd, false))
      i = valueEnd
    }
  }
  return i === to
}

/**
 * Reads a `Content-Type` value (RFC 9110 §8.3.1): a `type/subtype` pair of
 * tokens, then parameters, each `; name=value` with optional whitespace
 * around the `;`, the value a token or a quoted string whose backslash takes
 * the next octet as itself. Whitespace may also open and close the value.
 * Type, subtype and parameter names are answered in lowercase; values as
 * given, less their quoting.
 *
 *     const m: MediaType | null = mediaTypeParse(value, 0, toI32(value.length));
 *     // m.type === "multipart", mediaTypeParam(m, "boundary") === "xyz"
 *
 * @param value the octets that hold the field value
 * @param from where the value starts in `value`
 * @param to where it ends, one past its last octet
 * @returns the media type, or null when the window is not inside `value`, a
 *   token is empty or holds a non-`tchar`, a quoted string is not closed or
 *   holds a control character, a parameter has no `=`, a parameter name
 *   comes twice, or more than 16 parameters come
 */
export const mediaTypeParse = (value: readonly u8[], from: i32, to: i32): MediaType | null => {
  const n: i32 = toI32(value.length)
  if (from < 0 || to < from || to > n) {
    return null
  }
  const start: i32 = httpFieldsOwsEnd(value, from, to)
  const typeEnd: i32 = httpFieldsTokenEnd(value, start, to)
  if (typeEnd === start || typeEnd < 0 || typeEnd >= to || typeEnd >= n || toI32(value[typeEnd]) !== 47) {
    return null
  }
  const subStart: i32 = typeEnd + 1
  const subEnd: i32 = httpFieldsTokenEnd(value, subStart, to)
  if (subEnd === subStart) {
    return null
  }
  const m: MediaType = new MediaType()
  m.type = httpFieldsString(value, start, typeEnd, true)
  m.subtype = httpFieldsString(value, subStart, subEnd, true)
  return httpFieldsParams(value, subEnd, to, true, m) ? m : null
}

/**
 * Reads a part's `Content-Disposition` value the way a browser writes one in
 * a `multipart/form-data` body (RFC 7578 §4.2, and HTML's form submission):
 * a disposition type token, then parameters as `mediaTypeParse` reads them,
 * except that a backslash inside quotes is an octet like any other. A sender
 * writes a `"`, CR or LF in a name as `%22`, `%0D` or `%0A`, which are kept
 * as given; Windows paths keep their backslashes.
 *
 * @param value the octets that hold the field value
 * @param from where the value starts in `value`
 * @param to where it ends, one past its last octet
 * @returns the disposition, its type in `type` and `subtype` empty, or null
 *   on the shapes `mediaTypeParse` refuses past the type
 */
export const formDataDispositionParse = (value: readonly u8[], from: i32, to: i32): MediaType | null => {
  const n: i32 = toI32(value.length)
  if (from < 0 || to < from || to > n) {
    return null
  }
  const start: i32 = httpFieldsOwsEnd(value, from, to)
  const typeEnd: i32 = httpFieldsTokenEnd(value, start, to)
  if (typeEnd === start) {
    return null
  }
  const m: MediaType = new MediaType()
  m.type = httpFieldsString(value, start, typeEnd, true)
  return httpFieldsParams(value, typeEnd, to, false, m) ? m : null
}

/**
 * The value of parameter `name` of `m`, its letters compared without case.
 *
 * @param m a media type or disposition `mediaTypeParse` or
 *   `formDataDispositionParse` answered
 * @param name the parameter's name, in any case
 * @returns its value, quotes removed, or null when `m` has no such parameter
 */
export const mediaTypeParam = (m: MediaType, name: string): string | null => {
  const raw: u8[] = httpFieldBytes(name)
  const key: string = httpFieldsString(raw, 0, toI32(raw.length), true)
  const count: i32 =
    toI32(m.names.length) < toI32(m.values.length) ? toI32(m.names.length) : toI32(m.values.length)
  let k: i32 = 0
  while (k >= 0 && k < count && k < toI32(m.names.length) && k < toI32(m.values.length)) {
    if (m.names[k] === key) {
      return m.values[k]
    }
    k = k + 1
  }
  return null
}
