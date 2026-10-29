/**
 * `nish/net/url` — the request target's path and query, split and
 * percent-decoded in place, and its query string read as key/value pairs; and
 * whole URLs, parsed into their parts and references resolved against them.
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
 *         if (n >= 0) {
 *           // out[0, n) is the value
 *         } // else n is a URL_DECODE_ERR_* code: a peer's `%zz`, never read out
 *       }   // else no such key, or URL_QUERY_ERR_PAIRS past the cap
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
 * **A fragment is not part of a request target** (RFC 9112 §3.2), so the byte
 * API never looks for a `#`: in a target that holds one, it is a byte of the
 * path or of the last value.
 *
 * **A whole URL is parsed strictly, and nothing in it is decoded.** A client
 * that is handed `http://…` by a user, a redirect or a link needs its host and
 * port before it connects, and the place each reference points to:
 *
 *     import { Url, urlOrigin, urlParse, urlResolve, urlSerialize } from "nish/net/url";
 *
 *     const base: Url | null = urlParse("https://example.com/a/b?q")
 *     if (base !== null) {
 *       const next: Url | null = urlResolve(base, "../c#top")  // https://example.com/c#top
 *       // next.host, next.port (-1: the default), urlOrigin(next) === "https://example.com:443"
 *     }
 *
 * `urlParse` and `urlResolve` follow RFC 3986 (§3 for the parts, §5.2 to
 * resolve, dot segments removed) and refuse, with null, what two readers could
 * take for different hosts: a byte outside printable ASCII, a backslash, a
 * malformed `%`, a second `@`, a percent-encoded or otherwise non-unreserved
 * host byte, a host that looks numeric but is not a strict dotted-decimal IPv4
 * address (`127.1`, `0x7f.0.0.1`, `2130706433`), an IPv6 zone or IPvFuture
 * literal, and a port past 65535. The scheme and host are lower-cased; every
 * other part is kept as written, still percent-encoded.
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
 * is made; a negative cap is read as zero, so every query with a pair fails.
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

const URL_HASH: i32 = 35
const URL_DOT: i32 = 46
const URL_COLON: i32 = 58
const URL_AT: i32 = 64
const URL_OPEN_BRACKET: i32 = 91
const URL_CLOSE_BRACKET: i32 = 93
const URL_BACKSLASH: i32 = 92
/** The largest port a URL may name (RFC 6335 §6: a port is 16 bits). */
const URL_MAX_PORT: i32 = 65535

/**
 * A URL split into its parts (RFC 3986 §3). Each part is held as it was
 * written, still percent-encoded, except that `scheme` and `host` are
 * lower-cased. `urlParse` and `urlResolve` make one; `urlSerialize` writes one
 * back.
 */
export class Url {
  /** Lower-cased, without its `:`: `http`. */
  scheme: string = ""
  /** True when the URL has a `//` authority; `mailto:a@b` has none and `file:///x` has an empty one. */
  hasAuthority: boolean = false
  /** The userinfo before its first `:`, as written; empty when there is none. */
  username: string = ""
  /** The userinfo after its first `:`, as written; empty when there is none. */
  password: string = ""
  /** A lower-cased reg-name, a dotted IPv4 address, or an IPv6 address without its brackets. */
  host: string = ""
  /** 0 to 65535, or -1 when the URL names none; `urlOrigin` supplies the scheme's default. */
  port: i32 = -1
  /** With its dot segments removed; empty, or starting with `/` when there is an authority. */
  path: string = ""
  /** Without its `?`, or null when there is no `?`. */
  query: string | null = null
  /** Without its `#`, or null when there is no `#`. */
  fragment: string | null = null
}

/** `bytes[a, b)` as a string with A to Z lower-cased. */
const urlLowerString = (bytes: u8[], a: i32, b: i32): string => {
  const out: u8[] = new Array<u8>(b - a)
  let i: i32 = a
  while (i >= 0 && i < b && i - a < toI32(out.length)) {
    const c: i32 = toI32(bytes[i])
    out[i - a] = c >= 65 && c <= 90 ? toU8(c + 32) : toU8(c)
    i += 1
  }
  return String.fromBytes(out, 0, b - a)
}

/** The first `c` in `bytes[a, b)`, or `b`. */
const urlFind = (bytes: u8[], a: i32, b: i32, c: i32): i32 => {
  let i: i32 = a
  while (i >= 0 && i < b && toI32(bytes[i]) !== c) {
    i += 1
  }
  return i
}

const urlIsAlpha = (c: i32): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122)

const urlIsDigit = (c: i32): boolean => c >= 48 && c <= 57

/** RFC 3986's unreserved set: what a host may hold. */
const urlIsUnreserved = (c: i32): boolean =>
  urlIsAlpha(c) || urlIsDigit(c) || c === 45 || c === URL_DOT || c === 95 || c === 126

/**
 * True when `bytes[a, b)` is a dotted-decimal IPv4 address exactly as RFC
 * 3986 §3.2.2 writes one: four parts of one to three digits, each at most 255,
 * with no leading zero.
 */
const urlIsIpv4 = (bytes: u8[], a: i32, b: i32): boolean => {
  let parts: i32 = 0
  let i: i32 = a
  while (parts < 4) {
    const start: i32 = i
    let value: i32 = 0
    while (i < b && i - start < 4 && urlIsDigit(toI32(bytes[i]))) {
      value = value * 10 + toI32(bytes[i]) - 48
      i += 1
    }
    const digits: i32 = i - start
    if (digits === 0 || digits > 3 || value > 255 || (digits > 1 && toI32(bytes[start]) === 48)) {
      return false
    }
    parts += 1
    if (parts < 4) {
      if (i >= b || toI32(bytes[i]) !== URL_DOT) {
        return false
      }
      i += 1
    }
  }
  return i === b
}

/**
 * True when `bytes[a, b)` is an IPv6 address as RFC 4291 §2.2 writes one:
 * eight groups of one to four hex digits, or fewer with one `::` standing for
 * the rest, the last two optionally a dotted IPv4 address. A zone (`%25eth0`)
 * and an IPvFuture literal (`v1.x`) are not.
 */
const urlIsIpv6 = (bytes: u8[], a: i32, b: i32): boolean => {
  let groups: i32 = 0
  let elided: boolean = false
  let i: i32 = a
  if (b - a >= 2 && toI32(bytes[a]) === URL_COLON && toI32(bytes[a + 1]) === URL_COLON) {
    elided = true
    i = a + 2
  }
  while (i < b) {
    const start: i32 = i
    while (i < b && urlHexValue(toI32(bytes[i])) >= 0) {
      i += 1
    }
    if (i === start) {
      return false
    }
    if (i < b && toI32(bytes[i]) === URL_DOT) {
      if (!urlIsIpv4(bytes, start, b)) {
        return false
      }
      groups += 2
      i = b
    } else {
      if (i - start > 4) {
        return false
      }
      groups += 1
      if (i < b) {
        if (toI32(bytes[i]) !== URL_COLON || i + 1 === b) {
          return false
        }
        i += 1
        if (toI32(bytes[i]) === URL_COLON) {
          if (elided) {
            return false
          }
          elided = true
          i += 1
        }
      }
    }
  }
  return elided ? groups <= 7 : groups === 8
}

/**
 * True when a reg-name `bytes[a, b)` would be read as a number by a resolver
 * or by the WHATWG host parser: its last label (a trailing `.` aside) is all
 * digits or `0x` and hex. Such a host must be a dotted-decimal IPv4 address
 * exactly, so `127.1`, `0x7f.0.0.1` and `017700000001` never reach a lookup
 * that reads them as 127.0.0.1.
 */
const urlLooksNumeric = (bytes: u8[], a: i32, b: i32): boolean => {
  let end: i32 = b
  if (end > a && toI32(bytes[end - 1]) === URL_DOT) {
    end -= 1
  }
  let start: i32 = end
  while (start > a && toI32(bytes[start - 1]) !== URL_DOT) {
    start -= 1
  }
  if (start === end) {
    return false
  }
  let i: i32 = start
  if (end - start >= 2 && toI32(bytes[start]) === 48 && (toI32(bytes[start + 1]) | 32) === 120) {
    i = start + 2
    while (i < end && urlHexValue(toI32(bytes[i])) >= 0) {
      i += 1
    }
    return i === end
  }
  while (i < end && urlIsDigit(toI32(bytes[i]))) {
    i += 1
  }
  return i === end
}

/** Reads the authority `bytes[a, b)` into `u`, or answers false when it breaks a rule `urlParse` names. */
const urlReadAuthority = (bytes: u8[], a: i32, b: i32, u: Url): boolean => {
  const at: i32 = urlFind(bytes, a, b, URL_AT)
  let h: i32 = a
  if (at < b) {
    if (urlFind(bytes, at + 1, b, URL_AT) < b) {
      return false
    }
    if (urlFind(bytes, a, at, URL_OPEN_BRACKET) < at || urlFind(bytes, a, at, URL_CLOSE_BRACKET) < at) {
      return false
    }
    const colon: i32 = urlFind(bytes, a, at, URL_COLON)
    u.username = String.fromBytes(bytes, a, colon)
    if (colon < at) {
      u.password = String.fromBytes(bytes, colon + 1, at)
    }
    h = at + 1
  }
  let portAt: i32 = b
  if (h < b && toI32(bytes[h]) === URL_OPEN_BRACKET) {
    const close: i32 = urlFind(bytes, h, b, URL_CLOSE_BRACKET)
    if (close === b || !urlIsIpv6(bytes, h + 1, close)) {
      return false
    }
    u.host = urlLowerString(bytes, h + 1, close)
    if (close + 1 < b) {
      if (toI32(bytes[close + 1]) !== URL_COLON) {
        return false
      }
      portAt = close + 1
    }
  } else {
    portAt = urlFind(bytes, h, b, URL_COLON)
    let i: i32 = h
    while (i < portAt && urlIsUnreserved(toI32(bytes[i]))) {
      i += 1
    }
    if (i < portAt) {
      return false
    }
    if (urlLooksNumeric(bytes, h, portAt) && !urlIsIpv4(bytes, h, portAt)) {
      return false
    }
    u.host = urlLowerString(bytes, h, portAt)
  }
  if (portAt + 1 < b) {
    let port: i32 = 0
    let i: i32 = portAt + 1
    while (i < b) {
      const c: i32 = toI32(bytes[i])
      if (!urlIsDigit(c)) {
        return false
      }
      port = port * 10 + c - 48
      if (port > URL_MAX_PORT) {
        return false
      }
      i += 1
    }
    u.port = port
  }
  return true
}

/**
 * `s` split into a `Url` whose scheme is empty when `s` is a relative
 * reference, with its path as written; null when it breaks one of the rules
 * `urlParse` names, the host a scheme with a default port needs aside, which
 * only a resolved URL is held to.
 */
const urlReadReference = (s: string): Url | null => {
  const bytes: u8[] | null = urlBytesOf(s)
  if (bytes === null) {
    return null
  }
  const n: i32 = toI32(bytes.length)
  let i: i32 = 0
  while (i < n) {
    const c: i32 = toI32(bytes[i])
    // A WHATWG parser reads `\` as `/` under http(s), so it would end the
    // authority or start one where this reading does not: refused everywhere.
    if (
      c <= URL_SPACE ||
      c >= 127 ||
      c === URL_BACKSLASH ||
      (c === URL_PERCENT && urlEscapeAt(bytes, i, n) < 0)
    ) {
      return null
    }
    i += 1
  }
  const u: Url = new Url()
  const hash: i32 = urlFind(bytes, 0, n, URL_HASH)
  if (hash < n) {
    u.fragment = String.fromBytes(bytes, hash + 1, n)
  }
  const question: i32 = urlFind(bytes, 0, hash, URL_QUESTION)
  if (question < hash) {
    u.query = String.fromBytes(bytes, question + 1, hash)
  }
  let pos: i32 = 0
  if (question > 0 && urlIsAlpha(toI32(bytes[0]))) {
    let j: i32 = 1
    while (j < question) {
      const c: i32 = toI32(bytes[j])
      if (!(urlIsAlpha(c) || urlIsDigit(c) || c === URL_PLUS || c === 45 || c === URL_DOT)) {
        break
      }
      j += 1
    }
    if (j < question && toI32(bytes[j]) === URL_COLON) {
      u.scheme = urlLowerString(bytes, 0, j)
      pos = j + 1
    }
  }
  if (question - pos >= 2 && toI32(bytes[pos]) === URL_SLASH && toI32(bytes[pos + 1]) === URL_SLASH) {
    const end: i32 = urlFind(bytes, pos + 2, question, URL_SLASH)
    u.hasAuthority = true
    if (!urlReadAuthority(bytes, pos + 2, end, u)) {
      return null
    }
    pos = end
  }
  u.path = String.fromBytes(bytes, pos, question)
  return u
}

/** The width of a `.` (1) or `%2e` (3) at `s[i]`, or 0. */
const urlDotAt = (s: string, i: i32, end: i32): i32 => {
  if (i < end && toI32(s.charCodeAt(i)) === URL_DOT) {
    return 1
  }
  if (
    end - i >= 3 &&
    toI32(s.charCodeAt(i)) === URL_PERCENT &&
    toI32(s.charCodeAt(i + 1)) === 50 &&
    (toI32(s.charCodeAt(i + 2)) | 32) === 101
  ) {
    return 3
  }
  return 0
}

/** 1 when the segment `s[a, b)` is `.`, 2 when it is `..`, either written with `%2e`, else 0. */
const urlDotSegment = (s: string, a: i32, b: i32): i32 => {
  const first: i32 = urlDotAt(s, a, b)
  if (first === 0) {
    return 0
  }
  if (a + first === b) {
    return 1
  }
  const second: i32 = urlDotAt(s, a + first, b)
  if (second > 0 && a + first + second === b) {
    return 2
  }
  return 0
}

/** The first `/` in `s[i, n)`, or `n`. */
const urlSlashFrom = (s: string, i: i32, n: i32): i32 => {
  let j: i32 = i
  while (j < n && toI32(s.charCodeAt(j)) !== URL_SLASH) {
    j += 1
  }
  return j
}

/**
 * RFC 3986 §5.2.4 remove_dot_segments, reading `%2e` as `.` the way the WHATWG
 * URL Standard does, so `/a/%2e%2e/b` is `/b` here and at a server that
 * decodes before it resolves. The output is kept as its segments, each with
 * the `/` before it, so "remove the last segment" is a `pop`.
 */
const urlRemoveDotSegments = (s: string): string => {
  const n: i32 = toI32(s.length)
  const out: string[] = []
  let i: i32 = 0
  while (i < n) {
    if (toI32(s.charCodeAt(i)) !== URL_SLASH) {
      const j: i32 = urlSlashFrom(s, i, n)
      if (urlDotSegment(s, i, j) > 0) {
        i = j < n ? j + 1 : n
      } else {
        out.push(s.slice(i, j))
        i = j
      }
    } else {
      const j: i32 = urlSlashFrom(s, i + 1, n)
      const dots: i32 = urlDotSegment(s, i + 1, j)
      if (dots === 0) {
        out.push(s.slice(i, j))
      } else if (dots === 2 && out.length > 0) {
        out.pop()
      }
      if (dots > 0 && j === n) {
        out.push("/")
      }
      i = j
    }
  }
  return out.join("")
}

/** `u` when a URL with its scheme may stand as it is, or null: a scheme with a default port needs a host. */
const urlFinish = (u: Url): Url | null => {
  if (urlDefaultPort(u.scheme) >= 0 && u.host === "") {
    return null
  }
  return u
}

/**
 * The absolute URL `s` split into its parts, or null when it is not one this
 * module accepts. `s` is refused when it has no scheme, holds a byte outside
 * printable ASCII (a control byte, a space, DEL or anything past 0x7F), a
 * backslash or a `%` not followed by two hex digits, or its authority has more
 * than one `@`, a host with a byte outside RFC 3986's unreserved set (so a
 * percent-encoded one), a host whose last label is numeric but that is not a
 * dotted-decimal IPv4 address, a malformed IPv6 literal or a port that is not
 * digits or is above 65535. An http, https, ws or wss URL needs a non-empty
 * host. The path's dot segments are removed, as RFC 3986 §5.2.2 removes them
 * from a reference with a scheme. Nothing is decoded. It allocates its answer.
 */
export const urlParse = (s: string): Url | null => {
  const u: Url | null = urlReadReference(s)
  if (u === null || u.scheme === "") {
    return null
  }
  u.path = urlRemoveDotSegments(u.path)
  return urlFinish(u)
}

/** RFC 3986 §5.2.3: `path` merged onto `base`'s directory. */
const urlMerge = (base: Url, path: string): string => {
  if (base.hasAuthority && base.path === "") {
    return "/" + path
  }
  let k: i32 = toI32(base.path.length)
  while (k > 0 && toI32(base.path.charCodeAt(k - 1)) !== URL_SLASH) {
    k -= 1
  }
  return base.path.slice(0, k) + path
}

/**
 * The reference `ref` resolved against the absolute URL `base` by RFC 3986
 * §5.2.2, strictly (`http:g` is `http:g`, not relative), or null when `ref`
 * breaks a rule `urlParse` names or what it resolves to is an http, https, ws
 * or wss URL without a host. `base`'s fragment is never carried over. It
 * allocates its answer and does not change `base`.
 */
export const urlResolve = (base: Url, ref: string): Url | null => {
  const r: Url | null = urlReadReference(ref)
  if (r === null) {
    return null
  }
  if (r.scheme === "") {
    r.scheme = base.scheme
    if (!r.hasAuthority) {
      r.hasAuthority = base.hasAuthority
      r.username = base.username
      r.password = base.password
      r.host = base.host
      r.port = base.port
      if (r.path === "") {
        r.path = base.path
        if (r.query === null) {
          r.query = base.query
        }
        return urlFinish(r)
      }
      if (toI32(r.path.charCodeAt(0)) !== URL_SLASH) {
        r.path = urlMerge(base, r.path)
      }
    }
  }
  r.path = urlRemoveDotSegments(r.path)
  return urlFinish(r)
}

/** `u`'s host as a URL writes it: an IPv6 address, the one host with a `:`, in brackets. */
const urlHostText = (u: Url): string => (u.host.indexOf(":") >= 0 ? "[" + u.host + "]" : u.host)

/**
 * `u` written back as RFC 3986 §5.3 recomposes it, an IPv6 host in brackets.
 * The userinfo is written when either half is non-empty. A path that starts
 * with `//` under no authority is written after `/.`, as the WHATWG URL
 * Standard writes it, so the string does not read back with an authority.
 */
export const urlSerialize = (u: Url): string => {
  const parts: string[] = []
  if (u.scheme !== "") {
    parts.push(u.scheme + ":")
  }
  if (u.hasAuthority) {
    parts.push("//")
    if (u.username !== "" || u.password !== "") {
      parts.push(u.password !== "" ? u.username + ":" + u.password + "@" : u.username + "@")
    }
    parts.push(urlHostText(u))
    if (u.port >= 0) {
      parts.push(`:${u.port}`)
    }
  } else if (u.path.startsWith("//")) {
    parts.push("/.")
  }
  parts.push(u.path)
  const query: string | null = u.query
  if (query !== null) {
    parts.push("?" + query)
  }
  const fragment: string | null = u.fragment
  if (fragment !== null) {
    parts.push("#" + fragment)
  }
  return parts.join("")
}

/** The port a scheme uses when a URL names none: 80 for `http` and `ws`, 443 for `https` and `wss`, else -1. */
export const urlDefaultPort = (scheme: string): i32 => {
  if (scheme === "http" || scheme === "ws") {
    return 80
  }
  if (scheme === "https" || scheme === "wss") {
    return 443
  }
  return -1
}

/**
 * `u`'s origin as `scheme://host:port`, the port always written (the scheme's
 * default when `u` names none), so two URLs are same-origin exactly when their
 * origins are equal strings: `http://A.com/x` and `http://a.com:80/y` are both
 * `http://a.com:80`. Null for a scheme other than http, https, ws or wss, which
 * has no origin to compare. IPv6 hosts are compared as written, so `[::1]` and
 * `[0::1]` are different origins.
 */
export const urlOrigin = (u: Url): string | null => {
  const fallback: i32 = urlDefaultPort(u.scheme)
  if (fallback < 0) {
    return null
  }
  const port: i32 = u.port >= 0 ? u.port : fallback
  return `${u.scheme}://${urlHostText(u)}:${port}`
}
