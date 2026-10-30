/**
 * `nish/json-format` — the string formats of JSON Schema draft 2020-12
 * (§7.3 of the validation vocabulary), each a predicate, and one dispatcher
 * that answers valid, invalid or unknown for a format named in a schema.
 *
 *     import { jsonFormatId, jsonFormatCheck, isEmail, JSON_FORMAT_VALID } from "nish/json-format"
 *
 *     isEmail("joe.bloggs@example.com")           // true
 *     const id = jsonFormatId("date-time")        // resolve the name once, when the schema is read
 *     jsonFormatCheck(id, "1963-06-19T08:30:06Z") // JSON_FORMAT_VALID, for each instance
 *     jsonFormatValidate("idn-email", "x@y")      // JSON_FORMAT_UNKNOWN: not checked here
 *
 * **What each format is.** Each predicate is the grammar of the RFC the
 * specification names, applied to the whole string:
 *
 * - `date-time`, `date` and `time` are RFC 3339 §5.6: `T` and `Z` in either
 *   case, a fraction of any length, an offset of at most 23:59, the month's
 *   length in the year's calendar, and a second of 60 only where the time is
 *   23:59 in UTC once the offset is taken off.
 * - `duration` is RFC 3339 Appendix A as written: units in order, none
 *   skipped (`P1Y1D` is invalid, since a year may be followed only by a
 *   month), a `T` before any hour, minute or second and at least one after
 *   it, and weeks alone.
 * - `email` is RFC 5321's `Mailbox`: a dot-string or a quoted string of at
 *   most 64 octets, then a domain of at most 255 that is a `hostname` or an
 *   address literal (`[127.0.0.1]`, `[IPv6:::1]`, or a tag and its content).
 * - `hostname` is RFC 1123: labels of 1 to 63 letters, digits and hyphens
 *   with no hyphen at either end, 253 octets in all, and no trailing dot. An
 *   A-label (`xn--`) is checked as letters and digits; its Punycode is not
 *   decoded.
 * - `ipv4` is RFC 2673's dotted quad: four decimal parts of 0 to 255, with no
 *   leading zero. `ipv6` is RFC 4291 §2.2: at most one `::`, groups of 1 to 4
 *   hex digits, an IPv4 tail counted as two, and no zone or prefix length.
 * - `uuid` is RFC 4122's 8-4-4-4-12 hex digits, in either case, of any
 *   version or variant.
 * - `uri` and `uri-reference` are RFC 3986 §3 and §4.1; `iri` and
 *   `iri-reference` are RFC 3987 §2.2, the same grammar with any `ucschar`
 *   where an unreserved character goes and `iprivate` in the query.
 * - `uri-template` is RFC 6570 §2, any level.
 * - `regex` is a pattern `nish/regex` compiles (see "What is not checked").
 *
 * **Why the URI grammar is checked here and not by `nish/net/url`.**
 * `urlParse` reads an absolute URL a client is about to fetch, and refuses
 * what two readers could take for different hosts: a percent-encoded host
 * byte, a numeric host that is not a dotted-decimal IPv4 address, an
 * IPvFuture literal, a port above 65535, any byte past ASCII, and a reference
 * with no scheme (`std/net/url.ts`). Each of those is a valid RFC 3986 URI,
 * IRI or relative reference, which this module must answer valid. It also
 * allocates the parts it answers. So this module walks the ABNF itself, over
 * the string, allocating nothing.
 *
 * **What is not checked.** `jsonFormatId` answers -1, and the dispatcher
 * `JSON_FORMAT_UNKNOWN`, for `idn-email`, `idn-hostname`, `json-pointer`,
 * `relative-json-pointer` and any other name: an unknown format is an
 * annotation, which a validator accepts (§7.2.3). `regex` is answered by
 * `regexCompile`, which is stricter than ECMA-262: it refuses lookaround and
 * backreferences, which it does not implement, and reads the pattern with the
 * `u` flag's rules, so a lone `{` or `]` is an error. Such a pattern is valid
 * ECMA-262 and is answered invalid here, a false negative.
 *
 * **What a call costs.** Every check but `regex` is linear in the length of
 * its string: each unit is read a small fixed number of times (at most four, in
 * a URI's authority, which is found and then split at `@` and `:`). It
 * allocates nothing and cannot panic. `jsonFormatId` compares the
 * name with up to 15 strings; resolve it once per schema, not per instance.
 * `isRegex` compiles the pattern, which allocates the program `nish/regex`
 * builds and is linear in the pattern's length.
 *
 * Offsets are code units: UTF-8 bytes natively and UTF-16 units under Node.
 * The checks answer the same on both, since every non-ASCII character is
 * decoded where a grammar allows one and refused everywhere else.
 */
import { regexCompile } from "nish/regex"

/** The dispatcher's answer for a string the format accepts. */
export const JSON_FORMAT_VALID: i32 = 1
/** The dispatcher's answer for a string the format refuses. */
export const JSON_FORMAT_INVALID: i32 = 0
/** The dispatcher's answer for a format this module does not check. */
export const JSON_FORMAT_UNKNOWN: i32 = -1

/** The id of `date-time`, for `jsonFormatCheck`. */
export const JSON_FORMAT_DATE_TIME: i32 = 0
/** The id of `date`. */
export const JSON_FORMAT_DATE: i32 = 1
/** The id of `time`. */
export const JSON_FORMAT_TIME: i32 = 2
/** The id of `duration`. */
export const JSON_FORMAT_DURATION: i32 = 3
/** The id of `email`. */
export const JSON_FORMAT_EMAIL: i32 = 4
/** The id of `hostname`. */
export const JSON_FORMAT_HOSTNAME: i32 = 5
/** The id of `ipv4`. */
export const JSON_FORMAT_IPV4: i32 = 6
/** The id of `ipv6`. */
export const JSON_FORMAT_IPV6: i32 = 7
/** The id of `uuid`. */
export const JSON_FORMAT_UUID: i32 = 8
/** The id of `uri`. */
export const JSON_FORMAT_URI: i32 = 9
/** The id of `uri-reference`. */
export const JSON_FORMAT_URI_REFERENCE: i32 = 10
/** The id of `iri`. */
export const JSON_FORMAT_IRI: i32 = 11
/** The id of `iri-reference`. */
export const JSON_FORMAT_IRI_REFERENCE: i32 = 12
/** The id of `uri-template`. */
export const JSON_FORMAT_URI_TEMPLATE: i32 = 13
/** The id of `regex`. */
export const JSON_FORMAT_REGEX: i32 = 14

// The URI grammar's character classes, as `jfUriUnit` reads them. Each names
// the ASCII set of one RFC 3986 rule; the IRI forms add `ucschar`, and the
// query alone `iprivate`.
const JF_REG_NAME: i32 = 0 // unreserved / sub-delims
const JF_USERINFO: i32 = 1 // unreserved / sub-delims / ":"
const JF_SEGMENT: i32 = 2 // pchar: unreserved / sub-delims / ":" / "@"
const JF_PATH: i32 = 3 // pchar / "/"
const JF_FRAGMENT: i32 = 4 // pchar / "/" / "?"
const JF_QUERY: i32 = 5 // the fragment's set, and `iprivate` in an IRI

/**
 * The code unit of `s` at `i`, or -1 past its end, so that a grammar can look
 * one unit ahead without testing the length first.
 */
const jfUnitAt = (s: string, i: i32): i32 => (i < toI32(s.length) ? toI32(s.charCodeAt(i)) : -1)

const jfIsDigit = (c: i32): boolean => c >= 48 && c <= 57

const jfIsAlpha = (c: i32): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122)

const jfIsHex = (c: i32): boolean => jfIsDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)

/** `c` as a lower-case ASCII letter, so that `T` and `t` compare alike. */
const jfLower = (c: i32): i32 => (c >= 65 && c <= 90 ? c + 32 : c)

/** The value of the `n` decimal digits of `s` at `at`, or -1 if any is not one. */
const jfDigits = (s: string, at: i32, n: i32): i32 => {
  let value: i32 = 0
  let i: i32 = 0
  while (i < n) {
    const c = jfUnitAt(s, at + i)
    if (!jfIsDigit(c)) {
      return -1
    }
    value = value * 10 + (c - 48)
    i += 1
  }
  return value
}

/** The number of days in `month` (1 to 12) of the Gregorian `year`. */
const jfDaysInMonth = (year: i32, month: i32): i32 => {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return leap ? 29 : 28
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

/** Whether `s` holds RFC 3339's `full-date`, `YYYY-MM-DD`, at `at`. */
const jfFullDateAt = (s: string, at: i32): boolean => {
  const year = jfDigits(s, at, 4)
  const month = jfDigits(s, at + 5, 2)
  const day = jfDigits(s, at + 8, 2)
  return (
    year >= 0 &&
    jfUnitAt(s, at + 4) === 45 &&
    jfUnitAt(s, at + 7) === 45 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= jfDaysInMonth(year, month)
  )
}

/**
 * Whether `s` from `at` to its end is RFC 3339's `full-time`:
 * `HH:MM:SS[.frac]` and `Z` or `±HH:MM`.
 *
 * A leap second is the last second of a UTC day, so `23:59:60Z` and
 * `15:59:60-08:00` are valid and `22:59:60Z` is not: the offset is taken off
 * the local minute of the day and what is left must be 23:59.
 */
const jfFullTimeFrom = (s: string, at: i32): boolean => {
  const hour = jfDigits(s, at, 2)
  const minute = jfDigits(s, at + 3, 2)
  const second = jfDigits(s, at + 6, 2)
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 60) {
    return false
  }
  if (jfUnitAt(s, at + 2) !== 58 || jfUnitAt(s, at + 5) !== 58) {
    return false
  }
  let i = at + 8
  if (jfUnitAt(s, i) === 46) {
    i += 1
    const start = i
    while (jfIsDigit(jfUnitAt(s, i))) {
      i += 1
    }
    if (i === start) {
      return false
    }
  }
  const sign = jfUnitAt(s, i)
  let offset: i32 = 0
  if (jfLower(sign) === 122) {
    i += 1
  } else if (sign === 43 || sign === 45) {
    const offsetHour = jfDigits(s, i + 1, 2)
    const offsetMinute = jfDigits(s, i + 4, 2)
    if (
      offsetHour < 0 ||
      offsetHour > 23 ||
      offsetMinute < 0 ||
      offsetMinute > 59 ||
      jfUnitAt(s, i + 3) !== 58
    ) {
      return false
    }
    offset = offsetHour * 60 + offsetMinute
    if (sign === 45) {
      offset = -offset
    }
    i += 6
  } else {
    return false
  }
  if (i !== toI32(s.length)) {
    return false
  }
  // The UTC minute of the day is in -1439 to 2878 before the wrap.
  return second !== 60 || (hour * 60 + minute - offset + 1440) % 1440 === 1439
}

/** Whether `s` is an RFC 3339 `date-time`, `1963-06-19T08:30:06.283185Z`. */
export const isDateTime = (s: string): boolean =>
  jfFullDateAt(s, 0) && jfLower(jfUnitAt(s, 10)) === 116 && jfFullTimeFrom(s, 11)

/** Whether `s` is an RFC 3339 `full-date`, `1963-06-19`. */
export const isDate = (s: string): boolean => toI32(s.length) === 10 && jfFullDateAt(s, 0)

/** Whether `s` is an RFC 3339 `full-time`, `08:30:06Z` or `08:30:06+01:00`. */
export const isTime = (s: string): boolean => jfFullTimeFrom(s, 0)

/** The place of unit `u` in `units`, or -1 if it is not one of them. */
const jfUnitIndex = (u: i32, units: string): i32 => {
  let k: i32 = 0
  while (k < toI32(units.length)) {
    if (toI32(units.charCodeAt(k)) === u) {
      return k
    }
    k += 1
  }
  return -1
}

/**
 * Whether `s` is an RFC 3339 Appendix A `duration`, `P3Y6M4DT12H30M5S`.
 *
 * The ABNF lets each unit be followed only by the next one (`dur-year =
 * 1*DIGIT "Y" [dur-month]`), so the units of each half must be consecutive
 * in `YMD` and `HMS` order: `P1Y1D` and `PT1H1S` are invalid as written,
 * though ISO 8601 allows them.
 */
export const isDuration = (s: string): boolean => {
  const length: i32 = toI32(s.length)
  if (jfUnitAt(s, 0) !== 80) {
    return false
  }
  let i: i32 = 1
  let inTime = false
  let last: i32 = -1
  let count: i32 = 0
  let timeCount: i32 = 0
  while (i < length) {
    if (jfUnitAt(s, i) === 84) {
      if (inTime) {
        return false
      }
      inTime = true
      last = -1
      i += 1
      continue
    }
    const start = i
    while (jfIsDigit(jfUnitAt(s, i))) {
      i += 1
    }
    const unit = jfUnitAt(s, i)
    if (i === start || unit < 0) {
      return false
    }
    i += 1
    if (unit === 87) {
      // `dur-week` is the whole duration.
      return !inTime && count === 0 && i === length
    }
    const k = jfUnitIndex(unit, inTime ? "HMS" : "YMD")
    if (k < 0 || (last >= 0 && k !== last + 1)) {
      return false
    }
    last = k
    count += 1
    if (inTime) {
      timeCount += 1
    }
  }
  return count > 0 && (!inTime || timeCount > 0)
}

/** Whether `s[from, to)` is a dotted-quad IPv4 address. */
const jfIpv4Range = (s: string, from: i32, to: i32): boolean => {
  let i = from
  let part: i32 = 0
  while (part < 4) {
    if (part > 0) {
      if (i >= to || jfUnitAt(s, i) !== 46) {
        return false
      }
      i += 1
    }
    const start = i
    let value: i32 = 0
    while (i < to && i - start < 3 && jfIsDigit(jfUnitAt(s, i))) {
      value = value * 10 + (jfUnitAt(s, i) - 48)
      i += 1
    }
    const n = i - start
    if (n === 0 || value > 255 || (n > 1 && jfUnitAt(s, start) === 48)) {
      return false
    }
    part += 1
  }
  return i === to
}

/** Whether `s[from, to)` is an RFC 4291 IPv6 address, with no zone or prefix. */
const jfIpv6Range = (s: string, from: i32, to: i32): boolean => {
  let i = from
  let groups: i32 = 0
  let elided = false
  if (i + 1 < to && jfUnitAt(s, i) === 58 && jfUnitAt(s, i + 1) === 58) {
    elided = true
    i += 2
  }
  while (i < to) {
    const start = i
    while (i < to && jfIsHex(jfUnitAt(s, i))) {
      i += 1
    }
    if (i < to && jfUnitAt(s, i) === 46) {
      // An IPv4 tail ends the address and fills two groups.
      if (!jfIpv4Range(s, start, to)) {
        return false
      }
      groups += 2
      break
    }
    if (i === start || i - start > 4) {
      return false
    }
    groups += 1
    if (i === to) {
      break
    }
    if (jfUnitAt(s, i) !== 58) {
      return false
    }
    i += 1
    if (i < to && jfUnitAt(s, i) === 58) {
      if (elided) {
        return false
      }
      elided = true
      i += 1
    } else if (i === to) {
      return false
    }
  }
  return elided ? groups <= 7 : groups === 8
}

/** Whether `s` is a dotted-quad IPv4 address, `192.168.0.1`. */
export const isIpv4 = (s: string): boolean => jfIpv4Range(s, 0, toI32(s.length))

/** Whether `s` is an IPv6 address, `::ffff:192.168.0.1`. */
export const isIpv6 = (s: string): boolean => jfIpv6Range(s, 0, toI32(s.length))

const jfIsLdh = (c: i32): boolean => jfIsAlpha(c) || jfIsDigit(c) || c === 45

/** Whether `s[from, to)` is an RFC 1123 host name. */
const jfHostnameRange = (s: string, from: i32, to: i32): boolean => {
  if (to <= from || to - from > 253) {
    return false
  }
  let start = from
  let i = from
  while (i <= to) {
    if (i === to || jfUnitAt(s, i) === 46) {
      const n = i - start
      if (n === 0 || n > 63 || jfUnitAt(s, start) === 45 || jfUnitAt(s, i - 1) === 45) {
        return false
      }
      start = i + 1
    } else if (!jfIsLdh(jfUnitAt(s, i))) {
      return false
    }
    i += 1
  }
  return true
}

/** Whether `s` is a host name, `www.example.com`. */
export const isHostname = (s: string): boolean => jfHostnameRange(s, 0, toI32(s.length))

/** Whether `c` is RFC 5322's `atext`: a letter, a digit or one of ``!#$%&'*+-/=?^_`{|}~``. */
const jfIsAtext = (c: i32): boolean =>
  jfIsAlpha(c) ||
  jfIsDigit(c) ||
  c === 33 ||
  (c >= 35 && c <= 39) ||
  c === 42 ||
  c === 43 ||
  c === 45 ||
  c === 47 ||
  c === 61 ||
  c === 63 ||
  (c >= 94 && c <= 96) ||
  (c >= 123 && c <= 126)

/**
 * The end of the RFC 5321 `Local-part` at the start of `s`, a dot-string or a
 * quoted string, or -1 when it is neither.
 */
const jfLocalPartEnd = (s: string): i32 => {
  let i: i32 = 0
  if (jfUnitAt(s, 0) === 34) {
    i = 1
    while (true) {
      const c = jfUnitAt(s, i)
      if (c === 34) {
        return i + 1
      }
      if (c === 92) {
        const quoted = jfUnitAt(s, i + 1)
        if (quoted < 32 || quoted > 126) {
          return -1
        }
        i += 2
      } else if (c === 32 || c === 33 || (c >= 35 && c <= 91) || (c >= 93 && c <= 126)) {
        i += 1
      } else {
        return -1
      }
    }
  }
  while (true) {
    const start = i
    while (jfIsAtext(jfUnitAt(s, i))) {
      i += 1
    }
    if (i === start) {
      return -1
    }
    if (jfUnitAt(s, i) !== 46) {
      return i
    }
    i += 1
  }
}

/**
 * Whether `s[from, to)` is RFC 5321's general address literal content,
 * `Standardized-tag ":" 1*dcontent`, for a tag other than `IPv6`.
 */
const jfGeneralLiteral = (s: string, from: i32, to: i32): boolean => {
  let i = from
  while (i < to && jfIsLdh(jfUnitAt(s, i))) {
    i += 1
  }
  if (i === from || jfUnitAt(s, i - 1) === 45 || i >= to || jfUnitAt(s, i) !== 58) {
    return false
  }
  i += 1
  if (i === to) {
    return false
  }
  while (i < to) {
    const c = jfUnitAt(s, i)
    if (c < 33 || (c > 90 && c < 94) || c > 126) {
      return false
    }
    i += 1
  }
  return true
}

/** Whether `s` is an RFC 5321 mailbox, `joe.bloggs@example.com`. */
export const isEmail = (s: string): boolean => {
  const length: i32 = toI32(s.length)
  const at = jfLocalPartEnd(s)
  if (at < 0 || at > 64 || jfUnitAt(s, at) !== 64) {
    return false
  }
  const from = at + 1
  if (length - from > 255) {
    return false
  }
  if (jfUnitAt(s, from) !== 91) {
    return jfHostnameRange(s, from, length)
  }
  if (jfUnitAt(s, length - 1) !== 93) {
    return false
  }
  const inner = from + 1
  const end = length - 1
  if (
    end - inner > 5 &&
    jfLower(jfUnitAt(s, inner)) === 105 &&
    jfLower(jfUnitAt(s, inner + 1)) === 112 &&
    jfLower(jfUnitAt(s, inner + 2)) === 118 &&
    jfUnitAt(s, inner + 3) === 54 &&
    jfUnitAt(s, inner + 4) === 58
  ) {
    return jfIpv6Range(s, inner + 5, end)
  }
  return jfIpv4Range(s, inner, end) || jfGeneralLiteral(s, inner, end)
}

/** Whether `s` is a UUID, `2eb8aa08-aa98-11ea-b4aa-73b441d16380`. */
export const isUuid = (s: string): boolean => {
  if (toI32(s.length) !== 36) {
    return false
  }
  let i: i32 = 0
  while (i < 36) {
    const c = jfUnitAt(s, i)
    if (i === 8 || i === 13 || i === 18 || i === 23 ? c !== 45 : !jfIsHex(c)) {
      return false
    }
    i += 1
  }
  return true
}

/** Whether host-side code units are UTF-8 bytes, as natively, or UTF-16 units, as under Node. */
const jfUnitsAreBytes = (): boolean => toI32("é".length) === 2

/** Whether `cp` is RFC 3987's `iprivate`. */
const jfIsPrivate = (cp: i32): boolean =>
  (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && (cp & 0xffff) <= 0xfffd)

/** Whether `cp` is RFC 3987's `ucschar`. */
const jfIsUcschar = (cp: i32): boolean => {
  if (cp < 0x10000) {
    return (cp >= 0xa0 && cp <= 0xd7ff) || (cp >= 0xf900 && cp <= 0xfdcf) || (cp >= 0xfdf0 && cp <= 0xffef)
  }
  // Planes 1 to 13 bar their last two code points; plane 14 starts at E1000.
  return cp < 0xf0000 && (cp & 0xffff) <= 0xfffd && (cp < 0xe0000 || cp >= 0xe1000)
}

/**
 * The code units of the non-ASCII character of `s` at `i`, when it is a
 * `ucschar`, or an `iprivate` where `privateOk`; else 0, for a character
 * outside those ranges or units that do not encode one.
 */
const jfUcsWidth = (s: string, i: i32, privateOk: boolean): i32 => {
  const lead = jfUnitAt(s, i)
  let cp: i32 = 0
  let width: i32 = 0
  if (jfUnitsAreBytes()) {
    // UTF-8: no overlong form, no surrogate, nothing past U+10FFFF.
    const b1 = jfUnitAt(s, i + 1)
    let low: i32 = 0x80
    let high: i32 = 0xbf
    if (lead >= 0xc2 && lead <= 0xdf) {
      width = 2
      cp = lead & 0x1f
    } else if (lead >= 0xe0 && lead <= 0xef) {
      width = 3
      cp = lead & 0x0f
      low = lead === 0xe0 ? 0xa0 : 0x80
      high = lead === 0xed ? 0x9f : 0xbf
    } else if (lead >= 0xf0 && lead <= 0xf4) {
      width = 4
      cp = lead & 0x07
      low = lead === 0xf0 ? 0x90 : 0x80
      high = lead === 0xf4 ? 0x8f : 0xbf
    } else {
      return 0
    }
    if (b1 < low || b1 > high) {
      return 0
    }
    cp = (cp << 6) | (b1 & 0x3f)
    let k: i32 = 2
    while (k < width) {
      const b = jfUnitAt(s, i + k)
      if (b < 0x80 || b > 0xbf) {
        return 0
      }
      cp = (cp << 6) | (b & 0x3f)
      k += 1
    }
  } else if (lead >= 0xd800 && lead <= 0xdbff) {
    const trail = jfUnitAt(s, i + 1)
    if (trail < 0xdc00 || trail > 0xdfff) {
      return 0
    }
    width = 2
    cp = ((lead - 0xd800) << 10) + (trail - 0xdc00) + 0x10000
  } else if (lead >= 0xdc00 && lead <= 0xdfff) {
    return 0
  } else {
    width = 1
    cp = lead
  }
  return jfIsUcschar(cp) || (privateOk && jfIsPrivate(cp)) ? width : 0
}

const jfIsUnreserved = (c: i32): boolean =>
  jfIsAlpha(c) || jfIsDigit(c) || c === 45 || c === 46 || c === 95 || c === 126

/** Whether `c` is RFC 3986's `sub-delims`: ``!$&'()*+,;=``. */
const jfIsSubDelim = (c: i32): boolean => c === 33 || c === 36 || (c >= 38 && c <= 44) || c === 59 || c === 61

/** Whether the ASCII `c` belongs to the URI character class `set` (a `JF_` constant). */
const jfInSet = (c: i32, set: i32): boolean => {
  if (jfIsUnreserved(c) || jfIsSubDelim(c)) {
    return true
  }
  if (set === JF_REG_NAME) {
    return false
  }
  if (c === 58) {
    return true
  }
  if (set === JF_USERINFO) {
    return false
  }
  if (c === 64) {
    return true
  }
  if (set === JF_SEGMENT) {
    return false
  }
  return c === 47 || (set !== JF_PATH && c === 63)
}

/**
 * The code units of one character of the class `set` at `i` of `s`: 1 for an
 * ASCII member, 3 for `%` and two hex digits, the character's width for one
 * past ASCII where `iri` allows it, and 0 where none fits.
 */
const jfUriUnit = (s: string, i: i32, set: i32, iri: boolean): i32 => {
  const c = jfUnitAt(s, i)
  if (c < 0) {
    return 0
  }
  if (c === 37) {
    return jfIsHex(jfUnitAt(s, i + 1)) && jfIsHex(jfUnitAt(s, i + 2)) ? 3 : 0
  }
  if (c < 0x80) {
    return jfInSet(c, set) ? 1 : 0
  }
  return iri ? jfUcsWidth(s, i, set === JF_QUERY) : 0
}

/** Whether every character of `s[from, to)` belongs to the URI class `set`. */
const jfUriRun = (s: string, from: i32, to: i32, set: i32, iri: boolean): boolean => {
  let i = from
  while (i < to) {
    const w = jfUriUnit(s, i, set, iri)
    if (w === 0) {
      return false
    }
    i += w
  }
  return i === to
}

/** The first index in `[from, to)` whose unit is `a` or `b`, or `to`. */
const jfFind = (s: string, from: i32, to: i32, a: i32, b: i32): i32 => {
  let i = from
  while (i < to) {
    const u = jfUnitAt(s, i)
    if (u === a || u === b) {
      return i
    }
    i += 1
  }
  return to
}

/**
 * Whether `s[from, to)` is RFC 3986's `IP-literal` content: an IPv6 address
 * or `IPvFuture`, `"v" 1*HEXDIG "." 1*( unreserved / sub-delims / ":" )`.
 */
const jfIpLiteral = (s: string, from: i32, to: i32): boolean => {
  if (jfLower(jfUnitAt(s, from)) !== 118) {
    return jfIpv6Range(s, from, to)
  }
  let i = from + 1
  while (i < to && jfIsHex(jfUnitAt(s, i))) {
    i += 1
  }
  if (i === from + 1 || i >= to || jfUnitAt(s, i) !== 46 || i + 1 === to) {
    return false
  }
  return jfUriRun(s, i + 1, to, JF_USERINFO, false)
}

/** Whether `s[from, to)` is an RFC 3986 `authority`: `[ userinfo "@" ] host [ ":" port ]`. */
const jfAuthority = (s: string, from: i32, to: i32, iri: boolean): boolean => {
  // `userinfo` cannot hold an `@`, so the first one ends it.
  const at = jfFind(s, from, to, 64, 64)
  let host = from
  if (at < to) {
    if (!jfUriRun(s, from, at, JF_USERINFO, iri)) {
      return false
    }
    host = at + 1
  }
  let port: i32 = 0
  if (jfUnitAt(s, host) === 91) {
    const close = jfFind(s, host, to, 93, 93)
    if (close === to || !jfIpLiteral(s, host + 1, close)) {
      return false
    }
    port = close + 1
  } else {
    // A `reg-name` cannot hold a `:`, so the first one starts the port; an
    // IPv4 address is a `reg-name` too, so it needs no check of its own.
    port = jfFind(s, host, to, 58, 58)
    if (!jfUriRun(s, host, port, JF_REG_NAME, iri)) {
      return false
    }
  }
  if (port === to) {
    return true
  }
  if (jfUnitAt(s, port) !== 58) {
    return false
  }
  let i = port + 1
  while (i < to) {
    if (!jfIsDigit(jfUnitAt(s, i))) {
      return false
    }
    i += 1
  }
  return true
}

/**
 * Whether `s` is a URI, or with `reference` a URI reference, and with `iri`
 * the IRI forms of either: RFC 3986 §3 and §4.1, and RFC 3987 §2.2.
 */
const jfUriCheck = (s: string, iri: boolean, reference: boolean): boolean => {
  const length: i32 = toI32(s.length)
  let i: i32 = 0
  if (jfIsAlpha(jfUnitAt(s, 0))) {
    let j: i32 = 1
    while (true) {
      const c = jfUnitAt(s, j)
      if (!(jfIsAlpha(c) || jfIsDigit(c) || c === 43 || c === 45 || c === 46)) {
        break
      }
      j += 1
    }
    if (jfUnitAt(s, j) === 58) {
      i = j + 1
    }
  }
  if (i === 0 && !reference) {
    return false
  }
  const pathEnd = jfFind(s, i, length, 63, 35)
  if (jfUnitAt(s, i) === 47 && jfUnitAt(s, i + 1) === 47) {
    const authorityEnd = jfFind(s, i + 2, pathEnd, 47, 47)
    if (!jfAuthority(s, i + 2, authorityEnd, iri)) {
      return false
    }
    i = authorityEnd
  } else if (i === 0) {
    // `path-noscheme`: a relative path's first segment cannot hold a `:`,
    // or it would read as a scheme.
    const firstSegmentEnd = jfFind(s, i, pathEnd, 47, 47)
    if (jfFind(s, i, firstSegmentEnd, 58, 58) < firstSegmentEnd) {
      return false
    }
  }
  if (!jfUriRun(s, i, pathEnd, JF_PATH, iri)) {
    return false
  }
  i = pathEnd
  if (jfUnitAt(s, i) === 63) {
    const queryEnd = jfFind(s, i + 1, length, 35, 35)
    if (!jfUriRun(s, i + 1, queryEnd, JF_QUERY, iri)) {
      return false
    }
    i = queryEnd
  }
  if (jfUnitAt(s, i) === 35) {
    return jfUriRun(s, i + 1, length, JF_FRAGMENT, iri)
  }
  return true
}

/** Whether `s` is an absolute URI, `http://example.com/a?b#c`. */
export const isUri = (s: string): boolean => jfUriCheck(s, false, false)

/** Whether `s` is a URI or a relative reference, `../a?b#c`. */
export const isUriReference = (s: string): boolean => jfUriCheck(s, false, true)

/** Whether `s` is an absolute IRI, `http://ƒøø.ßår/?∂éœ=πîx`. */
export const isIri = (s: string): boolean => jfUriCheck(s, true, false)

/** Whether `s` is an IRI or a relative IRI reference. */
export const isIriReference = (s: string): boolean => jfUriCheck(s, true, true)

/** The code units of RFC 6570's `varchar` at `i` of `s`, `ALPHA / DIGIT / "_" / pct-encoded`, or 0. */
const jfVarchar = (s: string, i: i32): i32 => {
  const c = jfUnitAt(s, i)
  if (jfIsAlpha(c) || jfIsDigit(c) || c === 95) {
    return 1
  }
  return c === 37 && jfIsHex(jfUnitAt(s, i + 1)) && jfIsHex(jfUnitAt(s, i + 2)) ? 3 : 0
}

/**
 * The end of the RFC 6570 `expression` whose `{` is at `open`, or -1 when the
 * text there is not one: an operator, then `varspec`s separated by commas,
 * each a `varname` and a `:` prefix of 1 to 9999 or a `*`.
 */
const jfExpressionEnd = (s: string, open: i32): i32 => {
  let i = open + 1
  const op = jfUnitAt(s, i)
  if (jfUnitIndex(op, "+#./;?&=,!@|") >= 0) {
    i += 1
  }
  while (true) {
    let w = jfVarchar(s, i)
    if (w === 0) {
      return -1
    }
    i += w
    while (true) {
      if (jfUnitAt(s, i) === 46) {
        w = jfVarchar(s, i + 1)
        if (w === 0) {
          return -1
        }
        i += 1 + w
      } else {
        w = jfVarchar(s, i)
        if (w === 0) {
          break
        }
        i += w
      }
    }
    const modifier = jfUnitAt(s, i)
    if (modifier === 58) {
      const first = jfUnitAt(s, i + 1)
      if (first < 49 || first > 57) {
        return -1
      }
      i += 2
      let more: i32 = 0
      while (more < 3 && jfIsDigit(jfUnitAt(s, i))) {
        i += 1
        more += 1
      }
    } else if (modifier === 42) {
      i += 1
    }
    const next = jfUnitAt(s, i)
    if (next === 125) {
      return i + 1
    }
    if (next !== 44) {
      return -1
    }
    i += 1
  }
}

/**
 * Whether the ASCII `c` is RFC 6570's `literals`: anything but a control,
 * space and ``"'%<>\^`{|}``.
 */
const jfIsTemplateLiteral = (c: i32): boolean =>
  c === 33 ||
  c === 35 ||
  c === 36 ||
  c === 38 ||
  (c >= 40 && c <= 59) ||
  c === 61 ||
  (c >= 63 && c <= 91) ||
  c === 93 ||
  c === 95 ||
  (c >= 97 && c <= 122) ||
  c === 126

/** Whether `s` is an RFC 6570 URI template, `http://example.com/{term:1}/{term}`. */
export const isUriTemplate = (s: string): boolean => {
  const length: i32 = toI32(s.length)
  let i: i32 = 0
  while (i < length) {
    const c = jfUnitAt(s, i)
    if (c === 123) {
      i = jfExpressionEnd(s, i)
      if (i < 0) {
        return false
      }
    } else if (c === 37) {
      if (!jfIsHex(jfUnitAt(s, i + 1)) || !jfIsHex(jfUnitAt(s, i + 2))) {
        return false
      }
      i += 3
    } else if (c < 0x80) {
      if (!jfIsTemplateLiteral(c)) {
        return false
      }
      i += 1
    } else {
      const w = jfUcsWidth(s, i, true)
      if (w === 0) {
        return false
      }
      i += w
    }
  }
  return true
}

/**
 * Whether `s` is a regular expression `nish/regex` compiles with no flags.
 * Lookaround, backreferences and what the `u` flag refuses are answered
 * false, though ECMA-262 accepts them (see the module header).
 */
export const isRegex = (s: string): boolean => regexCompile(s, "").isOk()

/**
 * The id of the format `name` for `jsonFormatCheck`, one of the
 * `JSON_FORMAT_*` ids, or -1 for a format this module does not check.
 */
export const jsonFormatId = (name: string): i32 => {
  if (name === "date-time") {
    return JSON_FORMAT_DATE_TIME
  }
  if (name === "date") {
    return JSON_FORMAT_DATE
  }
  if (name === "time") {
    return JSON_FORMAT_TIME
  }
  if (name === "duration") {
    return JSON_FORMAT_DURATION
  }
  if (name === "email") {
    return JSON_FORMAT_EMAIL
  }
  if (name === "hostname") {
    return JSON_FORMAT_HOSTNAME
  }
  if (name === "ipv4") {
    return JSON_FORMAT_IPV4
  }
  if (name === "ipv6") {
    return JSON_FORMAT_IPV6
  }
  if (name === "uuid") {
    return JSON_FORMAT_UUID
  }
  if (name === "uri") {
    return JSON_FORMAT_URI
  }
  if (name === "uri-reference") {
    return JSON_FORMAT_URI_REFERENCE
  }
  if (name === "iri") {
    return JSON_FORMAT_IRI
  }
  if (name === "iri-reference") {
    return JSON_FORMAT_IRI_REFERENCE
  }
  if (name === "uri-template") {
    return JSON_FORMAT_URI_TEMPLATE
  }
  if (name === "regex") {
    return JSON_FORMAT_REGEX
  }
  return -1
}

/** Whether `value` passes the format `id`, which is one of the `JSON_FORMAT_*` ids. */
const jfPasses = (id: i32, value: string): boolean => {
  if (id === JSON_FORMAT_DATE_TIME) {
    return isDateTime(value)
  }
  if (id === JSON_FORMAT_DATE) {
    return isDate(value)
  }
  if (id === JSON_FORMAT_TIME) {
    return isTime(value)
  }
  if (id === JSON_FORMAT_DURATION) {
    return isDuration(value)
  }
  if (id === JSON_FORMAT_EMAIL) {
    return isEmail(value)
  }
  if (id === JSON_FORMAT_HOSTNAME) {
    return isHostname(value)
  }
  if (id === JSON_FORMAT_IPV4) {
    return isIpv4(value)
  }
  if (id === JSON_FORMAT_IPV6) {
    return isIpv6(value)
  }
  if (id === JSON_FORMAT_UUID) {
    return isUuid(value)
  }
  if (id === JSON_FORMAT_URI) {
    return isUri(value)
  }
  if (id === JSON_FORMAT_URI_REFERENCE) {
    return isUriReference(value)
  }
  if (id === JSON_FORMAT_IRI) {
    return isIri(value)
  }
  if (id === JSON_FORMAT_IRI_REFERENCE) {
    return isIriReference(value)
  }
  if (id === JSON_FORMAT_URI_TEMPLATE) {
    return isUriTemplate(value)
  }
  return isRegex(value)
}

/**
 * `value` checked against the format `id` from `jsonFormatId`:
 * `JSON_FORMAT_VALID` or `JSON_FORMAT_INVALID`, or `JSON_FORMAT_UNKNOWN`
 * for an id that names no format, -1 included.
 */
export const jsonFormatCheck = (id: i32, value: string): i32 => {
  if (id < JSON_FORMAT_DATE_TIME || id > JSON_FORMAT_REGEX) {
    return JSON_FORMAT_UNKNOWN
  }
  return jfPasses(id, value) ? JSON_FORMAT_VALID : JSON_FORMAT_INVALID
}

/**
 * `value` checked against the format named `name`: `JSON_FORMAT_VALID`,
 * `JSON_FORMAT_INVALID`, or `JSON_FORMAT_UNKNOWN` for a format this module
 * does not check. A validator that checks many instances against one schema
 * resolves the name once with `jsonFormatId` and calls `jsonFormatCheck`.
 */
export const jsonFormatValidate = (name: string, value: string): i32 =>
  jsonFormatCheck(jsonFormatId(name), value)
