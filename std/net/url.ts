/**
 * `nish/net/url` — the request target's path and query, split and
 * percent-decoded in place, and its query string read as key/value pairs.
 *
 * A handler that routes on a path or reads `?name=…` from a query otherwise
 * writes its own byte scan, and each such scan decides differently what `%zz`,
 * `%00`, `+` or a hundred thousand `&` mean. This module decides once:
 *
 *     import { UrlQuery, UrlQueryLimits, URL_DECODE_FORM, URL_QUERY_PAIR, percentDecode, urlQueryFind, urlQueryStart } from "nish/net/url";
 *
 *     const q: i32 = urlQueryStart(target, 0, len)    // -1: no `?`, so no query
 *     if (q >= 0) {
 *       const query: UrlQuery = new UrlQuery(new UrlQueryLimits())
 *       query.reset(target, q + 1, len - q - 1)
 *       if (urlQueryFind(query, "name") === URL_QUERY_PAIR) {
 *         const n: i32 = percentDecode(target, query.valueStart, query.valueLength, out, 0, URL_DECODE_FORM)
 *         // n >= 0: out[0, n) is the value; n < 0: a URL_DECODE_ERR_* code
 *       }
 *     }
 *
 * **The byte API allocates nothing.** `urlQueryStart`, `percentDecode`,
 * `UrlPathSegments` and `UrlQuery` read a window `bytes[off, off + len)` and
 * answer offsets into it, or write into the caller's array; `reset` reuses an
 * iterator, so a server that holds one per connection allocates nothing per
 * request. No byte outside the window is read. A window outside its array, or
 * an `at` outside `out`, is a bug in the caller and panics; nothing a peer
 * sends does.
 *
 * **Decoding is strict unless asked otherwise.** With no flags,
 * `percentDecode` refuses a `%` not followed by two hex digits
 * (`URL_DECODE_ERR_ESCAPE`) and `%00` (`URL_DECODE_ERR_NUL`), and copies `+`
 * as it stands. `URL_DECODE_FORM` reads `+` as a space, as
 * `application/x-www-form-urlencoded` does; `URL_DECODE_LENIENT` copies a
 * malformed escape as it stands, as the WHATWG URL Standard's percent-decode
 * and `URLSearchParams` do; `URL_DECODE_ALLOW_NUL` decodes `%00` to a 0 byte.
 * For valid UTF-8, `URLSearchParams` is `URL_DECODE_FORM | URL_DECODE_LENIENT |
 * URL_DECODE_ALLOW_NUL`; it replaces an invalid sequence with U+FFFD.
 *
 * **Decoded bytes are bytes.** The byte API does not check that what it
 * decodes is UTF-8, where `decodeURIComponent` throws on `%FF`: a path segment
 * or a value may be binary, and whatever reads it as text checks it.
 * `urlDecode` and `urlQueryGet`, which answer a string, refuse anything that is
 * not valid UTF-8.
 *
 * **A path is split before it is decoded.** `UrlPathSegments` splits on the
 * raw `/` only, and `percentDecodePathSegment` decodes one segment, so `%2F`
 * is a 0x2F byte inside its segment and never starts a new one: `/a%2Fb/c` is
 * the two segments `a/b` and `c`. `+` is literal in a path.
 *
 * **A query yields at most `UrlQueryLimits.maxPairs` pairs** (100 by default),
 * and past it `next()` answers `URL_QUERY_ERR_PAIRS` and stays spent. Empty
 * pairs (`a&&b`, a leading or trailing `&`) are skipped and not counted, as
 * `URLSearchParams` skips them.
 *
 * **A fragment is not part of a request target** (RFC 9112 §3.2), so nothing
 * here looks for a `#`: in a target that holds one, it is a byte of the path
 * or of the last value.
 *
 * The record of what this module refuses and why is `docs/security/url.md`.
 */

/** `+` is a space, as `application/x-www-form-urlencoded` writes one. */
export const URL_DECODE_FORM: i32 = 1
/** A `%` not followed by two hex digits is copied as it stands rather than refused (WHATWG percent-decode). */
export const URL_DECODE_LENIENT: i32 = 2
/** `%00` decodes to a 0 byte rather than being refused. */
export const URL_DECODE_ALLOW_NUL: i32 = 4

/** A `%` not followed by two hex digits: `%zz`, or `%4` or `%` at the end of the window. */
export const URL_DECODE_ERR_ESCAPE: i32 = -1
/** `%00` without `URL_DECODE_ALLOW_NUL`. */
export const URL_DECODE_ERR_NUL: i32 = -2
/** `out` has no room for the next byte; nothing is written at or past `out.length`. */
export const URL_DECODE_ERR_SPACE: i32 = -3

/** `next()` found a pair; the iterator's windows bound it. */
export const URL_QUERY_PAIR: i32 = 1
/** The window holds no more pairs; every later `next()` answers the same. */
export const URL_QUERY_END: i32 = 0
/** The query holds more than `maxPairs` pairs; sticky in `failed`. */
export const URL_QUERY_ERR_PAIRS: i32 = -4

/** The default for `UrlQueryLimits.maxPairs`. */
export const URL_DEFAULT_MAX_PAIRS: i32 = 100

const URL_SPACE: i32 = 32
const URL_PERCENT: i32 = 37
const URL_AMPERSAND: i32 = 38
const URL_PLUS: i32 = 43
const URL_SLASH: i32 = 47
const URL_EQUALS: i32 = 61
const URL_QUESTION: i32 = 63

/** Panics unless `bytes[off, off + len)` lies inside `bytes`. */
const urlCheckWindow = (bytes: u8[], off: i32, len: i32, who: string): void => {
  const size: i32 = toI32(bytes.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(who + ": the window is outside the array")
  }
}

/** The value of one hex digit, either case, or -1. */
const urlHexValue = (b: i32): i32 => {
  if (b >= 48 && b <= 57) {
    return b - 48
  }
  if (b >= 65 && b <= 70) {
    return b - 55
  }
  if (b >= 97 && b <= 102) {
    return b - 87
  }
  return -1
}

/** The byte the escape at `bytes[i]` (a `%`) stands for, or -1 when two hex digits do not follow it before `end`. */
const urlEscapeAt = (bytes: u8[], i: i32, end: i32): i32 => {
  if (end - i < 3) {
    return -1
  }
  const hi: i32 = urlHexValue(toI32(bytes[i + 1]))
  const lo: i32 = urlHexValue(toI32(bytes[i + 2]))
  if (hi < 0 || lo < 0) {
    return -1
  }
  return hi * 16 + lo
}

/**
 * `percentDecode`'s loop, shared with `percentDecodeErrorAt` so the two agree
 * on where an error is: with `wantPos` it answers the input offset of the
 * error, or -1 when there is none, rather than the count or the code.
 */
const urlDecodeRun = (
  src: u8[],
  off: i32,
  len: i32,
  out: u8[],
  at: i32,
  flags: i32,
  wantPos: boolean
): i32 => {
  urlCheckWindow(src, off, len, "percentDecode")
  const size: i32 = toI32(out.length)
  if (at < 0 || at > size) {
    panic("percentDecode: at is outside out")
  }
  const form: boolean = (flags & URL_DECODE_FORM) !== 0
  const lenient: boolean = (flags & URL_DECODE_LENIENT) !== 0
  const allowNul: boolean = (flags & URL_DECODE_ALLOW_NUL) !== 0
  const end: i32 = off + len
  let i: i32 = off
  let w: i32 = at
  const n: i32 = toI32(src.length)
  while (i >= 0 && i < end && i < n) {
    let b: i32 = toI32(src[i])
    let step: i32 = 1
    if (b === URL_PERCENT) {
      const e: i32 = urlEscapeAt(src, i, end)
      if (e >= 0) {
        if (e === 0 && !allowNul) {
          return wantPos ? i : URL_DECODE_ERR_NUL
        }
        b = e
        step = 3
      } else if (!lenient) {
        return wantPos ? i : URL_DECODE_ERR_ESCAPE
      }
    } else if (form && b === URL_PLUS) {
      b = URL_SPACE
    }
    if (w >= size) {
      return wantPos ? i : URL_DECODE_ERR_SPACE
    }
    out[w] = toU8(b)
    w += 1
    i += step
  }
  return wantPos ? -1 : w - at
}

/**
 * The index of the first `?` in `bytes[off, off + len)`, or -1 when there is
 * none. The path is `[off, q)` and the query `(q, off + len)`; nothing is
 * copied. A `#` is not looked for: a request target holds no fragment.
 */
export const urlQueryStart = (bytes: u8[], off: i32, len: i32): i32 => {
  urlCheckWindow(bytes, off, len, "urlQueryStart")
  const end: i32 = off + len
  const n: i32 = toI32(bytes.length)
  let i: i32 = off
  while (i >= 0 && i < end && i < n) {
    if (toI32(bytes[i]) === URL_QUESTION) {
      return i
    }
    i += 1
  }
  return -1
}

/**
 * Percent-decodes `src[off, off + len)` into `out` from `out[at]` on, and
 * answers the number of bytes written, or a negative `URL_DECODE_ERR_*` code;
 * `flags` is a sum of `URL_DECODE_*` (0 is strict: malformed escapes and `%00`
 * refused, `+` kept). Decoding never makes the input longer, so `len` bytes
 * of room always suffice; with less, `URL_DECODE_ERR_SPACE` is answered before
 * any write at or past `out.length`. On an error the bytes before it have been
 * written. What is decoded is not checked as UTF-8.
 */
export const percentDecode = (src: u8[], off: i32, len: i32, out: u8[], at: i32, flags: i32): i32 =>
  urlDecodeRun(src, off, len, out, at, flags, false)

/**
 * The offset in `src` of the byte `percentDecode` with the same arguments
 * fails at — the `%` of a malformed escape or of `%00`, or the first byte
 * `out` has no room for — or -1 when it does not fail. It writes what
 * `percentDecode` would have written before the error.
 */
export const percentDecodeErrorAt = (src: u8[], off: i32, len: i32, out: u8[], at: i32, flags: i32): i32 =>
  urlDecodeRun(src, off, len, out, at, flags, true)

/**
 * `percentDecode` for one path segment: `+` is literal whatever `flags` say,
 * and `%2F` is a 0x2F byte in the segment. Split the path with
 * `UrlPathSegments` first, then decode each segment.
 */
export const percentDecodePathSegment = (
  src: u8[],
  off: i32,
  len: i32,
  out: u8[],
  at: i32,
  flags: i32
): i32 => urlDecodeRun(src, off, len, out, at, (flags | URL_DECODE_FORM) ^ URL_DECODE_FORM, false)

/**
 * The segments of a path, split on the raw `/`. A leading `/` starts the
 * path rather than an empty segment, so `/a//b/` is `a`, ``, `b`, ``, `/` is
 * one empty segment and an empty window has none. Each segment's raw bytes
 * are `bytes[start, start + length)`; decode one with
 * `percentDecodePathSegment`.
 */
export class UrlPathSegments {
  bytes: u8[]
  /** The current segment's first byte. */
  start: i32 = 0
  /** The current segment's length in raw bytes. */
  length: i32 = 0
  pos: i32 = 0
  end: i32 = 0
  done: boolean = true

  /** An iterator over nothing until `reset`. */
  constructor() {
    this.bytes = new Array<u8>(0)
  }

  /** Starts over on the path `bytes[off, off + len)`; panics when the window is outside the array. */
  reset(bytes: u8[], off: i32, len: i32): void {
    urlCheckWindow(bytes, off, len, "UrlPathSegments")
    this.bytes = bytes
    this.pos = off
    this.end = off + len
    this.start = off
    this.length = 0
    this.done = len === 0
    if (len > 0 && toI32(bytes[off]) === URL_SLASH) {
      this.pos = off + 1
    }
  }

  /** Moves to the next segment and answers true, or answers false when the path has no more. */
  next(): boolean {
    if (this.done) {
      return false
    }
    const bytes: u8[] = this.bytes
    let j: i32 = this.pos
    const n: i32 = toI32(bytes.length)
    while (j >= 0 && j < this.end && j < n && toI32(bytes[j]) !== URL_SLASH) {
      j += 1
    }
    this.start = this.pos
    this.length = j - this.pos
    if (j < this.end) {
      this.pos = j + 1
    } else {
      this.done = true
    }
    return true
  }
}

/**
 * What a `UrlQuery` refuses to yield. The iterator copies the number when it
 * is made; a negative cap is read as zero, so every non-empty query fails.
 */
export class UrlQueryLimits {
  /** The most pairs one query yields, `URL_DEFAULT_MAX_PAIRS` (a field starts at a literal); past it `next()` answers `URL_QUERY_ERR_PAIRS` and stays spent. */
  maxPairs: i32 = 100
}

/**
 * The pairs of a query string, one per `next()`, in order. The window is the
 * query without its `?`. `&` separates pairs and the first `=` in a pair ends
 * its key: `a&b=&c=d=e` is `a` with no value, `b` with an empty one and `c`
 * with `d=e`. A key's raw bytes are `bytes[keyStart, keyStart + keyLength)`
 * and a value's `bytes[valueStart, valueStart + valueLength)`; decode them
 * with `percentDecode` and `URL_DECODE_FORM`.
 */
export class UrlQuery {
  bytes: u8[]
  keyStart: i32 = 0
  keyLength: i32 = 0
  valueStart: i32 = 0
  valueLength: i32 = 0
  /** 0, or the `URL_QUERY_ERR_*` code every later `next()` answers. */
  failed: i32 = 0
  maxPairs: i32
  pos: i32 = 0
  end: i32 = 0
  count: i32 = 0
  /** False for a pair written without `=` (`a`), true for `a=` with `valueLength` 0. */
  hasValue: boolean = false

  /** An iterator over nothing until `reset`, with the cap in `limits`. */
  constructor(limits: UrlQueryLimits) {
    this.bytes = new Array<u8>(0)
    this.maxPairs = limits.maxPairs < 0 ? 0 : limits.maxPairs
  }

  /** Starts over on the query `bytes[off, off + len)`, clearing `failed`; panics when the window is outside the array. */
  reset(bytes: u8[], off: i32, len: i32): void {
    urlCheckWindow(bytes, off, len, "UrlQuery")
    this.bytes = bytes
    this.pos = off
    this.end = off + len
    this.count = 0
    this.failed = 0
    this.keyStart = off
    this.keyLength = 0
    this.valueStart = off
    this.valueLength = 0
    this.hasValue = false
  }

  /** `URL_QUERY_PAIR` with the windows set to the next pair, `URL_QUERY_END`, or `failed`. */
  next(): i32 {
    if (this.failed !== 0) {
      return this.failed
    }
    const bytes: u8[] = this.bytes
    const end: i32 = this.end
    let i: i32 = this.pos
    const n: i32 = toI32(bytes.length)
    while (i >= 0 && i < end && i < n && toI32(bytes[i]) === URL_AMPERSAND) {
      i += 1
    }
    this.pos = i
    if (i >= end) {
      return URL_QUERY_END
    }
    if (this.count >= this.maxPairs) {
      this.failed = URL_QUERY_ERR_PAIRS
      return this.failed
    }
    let eq: i32 = -1
    while (i >= 0 && i < end && i < n) {
      const b: i32 = toI32(bytes[i])
      if (b === URL_AMPERSAND) {
        break
      }
      if (b === URL_EQUALS && eq < 0) {
        eq = i
      }
      i += 1
    }
    this.keyStart = this.pos
    if (eq < 0) {
      this.keyLength = i - this.pos
      this.valueStart = i
      this.valueLength = 0
      this.hasValue = false
    } else {
      this.keyLength = eq - this.pos
      this.valueStart = eq + 1
      this.valueLength = i - eq - 1
      this.hasValue = true
    }
    this.pos = i
    this.count += 1
    return URL_QUERY_PAIR
  }
}

/**
 * Whether `bytes[off, off + len)`, decoded strictly in form mode, is `name`'s
 * bytes. Nothing is written: a malformed escape or `%00` in the key matches
 * no name.
 */
const urlKeyEquals = (bytes: u8[], off: i32, len: i32, name: string): boolean => {
  const n: i32 = toI32(name.length)
  const end: i32 = off + len
  let i: i32 = off
  let o: i32 = 0
  const size: i32 = toI32(bytes.length)
  while (i >= 0 && i < end && i < size) {
    let b: i32 = toI32(bytes[i])
    let step: i32 = 1
    if (b === URL_PERCENT) {
      b = urlEscapeAt(bytes, i, end)
      if (b <= 0) {
        return false
      }
      step = 3
    } else if (b === URL_PLUS) {
      b = URL_SPACE
    }
    if (o >= n || b !== toI32(name.charCodeAt(o))) {
      return false
    }
    o += 1
    i += step
  }
  return o === n
}

/**
 * Moves `q` on to the first of its remaining pairs whose key, decoded in form
 * mode, equals `name`, and answers `URL_QUERY_PAIR` with `q`'s windows on it;
 * or `URL_QUERY_END`, or the error `next()` answered. Nothing is allocated.
 * `?na%6De=x` holds the key `name`; a key with a malformed escape or `%00`
 * matches nothing. Call it again for the next pair with the same key.
 * `name` is ASCII: natively it is compared with the key's bytes, under Node
 * with its UTF-16 code units, so a non-ASCII name answers differently.
 */
export const urlQueryFind = (q: UrlQuery, name: string): i32 => {
  let k: i32 = q.next()
  while (k === URL_QUERY_PAIR) {
    if (urlKeyEquals(q.bytes, q.keyStart, q.keyLength, name)) {
      return k
    }
    k = q.next()
  }
  return k
}

/** Whether `buf[off, off + len)` is well-formed UTF-8 (RFC 3629: no overlong form, no surrogate, nothing past U+10FFFF, nothing cut short). */
const urlIsUtf8 = (buf: u8[], off: i32, len: i32): boolean => {
  const end: i32 = off + len
  let i: i32 = off
  const n: i32 = toI32(buf.length)
  while (i >= 0 && i < end && i < n) {
    const b: i32 = toI32(buf[i])
    if (b < 0x80) {
      i += 1
      continue
    }
    let need: i32 = 0
    let lo: i32 = 0x80
    let hi: i32 = 0xbf
    if (b >= 0xc2 && b <= 0xdf) {
      need = 1
    } else if (b === 0xe0) {
      need = 2
      lo = 0xa0
    } else if (b === 0xed) {
      need = 2
      hi = 0x9f
    } else if (b >= 0xe1 && b <= 0xef) {
      need = 2
    } else if (b === 0xf0) {
      need = 3
      lo = 0x90
    } else if (b === 0xf4) {
      need = 3
      hi = 0x8f
    } else if (b >= 0xf1 && b <= 0xf3) {
      need = 3
    } else {
      return false
    }
    if (end - i - 1 < need || i + 1 >= n) {
      return false
    }
    const second: i32 = toI32(buf[i + 1])
    if (second < lo || second > hi) {
      return false
    }
    let k: i32 = 2
    while (k <= need) {
      const c: i32 = toI32(buf[i + k])
      if (c < 0x80 || c > 0xbf) {
        return false
      }
      k += 1
    }
    i += need + 1
  }
  return true
}

/** `s`'s bytes, or null when it holds a code unit past 0xFF (only possible under Node, where a string is UTF-16). */
const urlBytesOf = (s: string): u8[] | null => {
  const n: i32 = toI32(s.length)
  const bytes: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n && i < toI32(bytes.length)) {
    const c: i32 = toI32(s.charCodeAt(i))
    if (c > 0xff) {
      return null
    }
    bytes[i] = toU8(c)
    i += 1
  }
  return bytes
}

/** `percentDecode` of `src[off, off + len)` as a new string, or null on an error or when the result is not UTF-8. */
const urlDecodeString = (src: u8[], off: i32, len: i32, flags: i32): string | null => {
  const out: u8[] = new Array<u8>(len)
  const n: i32 = percentDecode(src, off, len, out, 0, flags)
  if (n < 0 || !urlIsUtf8(out, 0, n)) {
    return null
  }
  return String.fromBytes(out, 0, n)
}

/**
 * `s` percent-decoded with `flags`, or null when `percentDecode` refuses it
 * or what it decodes to is not valid UTF-8, which is where
 * `decodeURIComponent` throws. `s` is expected to be ASCII, as a URL on the
 * wire is. It allocates its answer.
 */
export const urlDecode = (s: string, flags: i32): string | null => {
  const bytes: u8[] | null = urlBytesOf(s)
  if (bytes === null) {
    return null
  }
  return urlDecodeString(bytes, 0, toI32(bytes.length), flags)
}

/**
 * The first value for `name` in the query of the request target `target`,
 * form-decoded strictly: `""` for a key written without `=`, as
 * `URLSearchParams.get` answers, and null when the target has no query, the
 * key is absent, the value is malformed or not UTF-8, or the key comes after
 * `URL_DEFAULT_MAX_PAIRS` pairs. It allocates its answer.
 */
export const urlQueryGet = (target: string, name: string): string | null => {
  const bytes: u8[] | null = urlBytesOf(target)
  if (bytes === null) {
    return null
  }
  const len: i32 = toI32(bytes.length)
  const q: i32 = urlQueryStart(bytes, 0, len)
  if (q < 0) {
    return null
  }
  const query: UrlQuery = new UrlQuery(new UrlQueryLimits())
  query.reset(bytes, q + 1, len - q - 1)
  if (urlQueryFind(query, name) !== URL_QUERY_PAIR) {
    return null
  }
  if (!query.hasValue) {
    return ""
  }
  return urlDecodeString(bytes, query.valueStart, query.valueLength, URL_DECODE_FORM)
}
