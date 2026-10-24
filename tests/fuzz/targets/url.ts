/**
 * Fuzz target: percent-decoding and the URL iterators (std/net/url.ts).
 *
 * The whole input is the text. It is percent-decoded under all eight
 * combinations of `URL_DECODE_FORM`, `URL_DECODE_LENIENT` and
 * `URL_DECODE_ALLOW_NUL`, into room for every byte and into room for half,
 * and decoded as a path segment; walked as a path and as a query, each
 * segment and each key and value decoded; and handed to `urlDecode` and
 * `urlQueryGet` as a string. The answers are checked against each other: a
 * decode reports an error exactly when `percentDecodeErrorAt` names a byte,
 * writes no more bytes than it reads, and a lenient decode of a text the
 * strict one accepts writes the same bytes. A refusal is a negative code or
 * a null; a panic, or answers that disagree, is a crash.
 */
import {
  URL_DECODE_LENIENT,
  URL_QUERY_PAIR,
  UrlPathSegments,
  UrlQuery,
  UrlQueryLimits,
  percentDecode,
  percentDecodeErrorAt,
  percentDecodePathSegment,
  urlDecode,
  urlQueryFind,
  urlQueryGet,
  urlQueryStart,
} from "nish/net/url"

/** Decodes `src[off, off + len)` with `flags` into room for every byte, checking what it answers. */
const decodeChecked = (src: u8[], off: i32, len: i32, flags: i32): void => {
  const out: u8[] = new Array<u8>(len)
  const n: i32 = percentDecode(src, off, len, out, 0, flags)
  const errorAt: i32 = percentDecodeErrorAt(src, off, len, out, 0, flags)
  if ((n < 0) !== (errorAt >= 0)) {
    panic(`url: percentDecode answered ${n} and percentDecodeErrorAt ${errorAt}`)
  }
  if (errorAt >= 0 && (errorAt < off || errorAt >= off + len)) {
    panic(`url: percentDecodeErrorAt ${errorAt} is outside the window`)
  }
  if (n > len) {
    panic("url: percentDecode wrote more bytes than it read")
  }
  if (n >= 0 && (flags & URL_DECODE_LENIENT) === 0) {
    const lenient: u8[] = new Array<u8>(len)
    if (percentDecode(src, off, len, lenient, 0, flags | URL_DECODE_LENIENT) !== n) {
      panic("url: a lenient decode of a strict text answered another length")
    }
    let i: i32 = 0
    while (i < n) {
      if (lenient[i] !== out[i]) {
        panic("url: a lenient decode of a strict text wrote other bytes")
      }
      i += 1
    }
  }
  // Half the room, and at an offset into it: a short `out` is ERR_SPACE, never a write past it.
  const half: i32 = len / 2
  const short: u8[] = new Array<u8>(half + 1)
  percentDecode(src, off, len, short, 1, flags)
  percentDecodePathSegment(src, off, len, out, 0, flags)
}

export const fuzzOne = (data: u8[]): void => {
  const len: i32 = toI32(data.length)
  let flags: i32 = 0
  while (flags < 8) {
    decodeChecked(data, 0, len, flags)
    flags += 1
  }

  const path: UrlPathSegments = new UrlPathSegments()
  path.reset(data, 0, len)
  let covered: i32 = 0
  let segments: i32 = 0
  while (path.next()) {
    if (path.start < 0 || path.length < 0 || path.start + path.length > len) {
      panic("url: a path segment is outside the path")
    }
    decodeChecked(data, path.start, path.length, 0)
    covered += path.length
    segments += 1
    if (segments > len + 1) {
      panic("url: more path segments than bytes")
    }
  }
  if (len > 0 && covered + segments - 1 > len) {
    panic("url: the path segments cover more than the path")
  }

  const limits: UrlQueryLimits = new UrlQueryLimits()
  limits.maxPairs = 16
  const q: UrlQuery = new UrlQuery(limits)
  const at: i32 = urlQueryStart(data, 0, len)
  const from: i32 = at < 0 ? 0 : at + 1
  q.reset(data, from, len - from)
  let pairs: i32 = 0
  while (q.next() === URL_QUERY_PAIR) {
    if (q.keyStart < from || q.keyLength < 0 || q.keyStart + q.keyLength > len) {
      panic("url: a query key is outside the query")
    }
    if (q.valueStart < from || q.valueLength < 0 || q.valueStart + q.valueLength > len) {
      panic("url: a query value is outside the query")
    }
    decodeChecked(data, q.keyStart, q.keyLength, 1)
    decodeChecked(data, q.valueStart, q.valueLength, 1)
    pairs += 1
    if (pairs > limits.maxPairs) {
      panic("url: the query answered more pairs than its cap")
    }
  }
  q.reset(data, from, len - from)
  urlQueryFind(q, "a")

  const text: string = String.fromBytes(data, 0, len)
  urlDecode(text, 0)
  urlDecode(text, 1)
  urlQueryGet(text, "a")
}
