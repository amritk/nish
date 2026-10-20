// `nish/net/url`: every edge case of the plan, printed as text or hex so the
// native run and the Node run print the same bytes. Each line names its case.
import {
  URL_DECODE_ALLOW_NUL,
  URL_DECODE_FORM,
  URL_DECODE_LENIENT,
  URL_DEFAULT_MAX_PAIRS,
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

const bytesOf = (text: string): u8[] => {
  const n: i32 = toI32(text.length)
  const out: u8[] = new Array<u8>(n)
  let i: i32 = 0
  while (i < n) {
    out[i] = toU8(text.charCodeAt(i))
    i += 1
  }
  return out
}

const HEX: string = "0123456789abcdef"

const hexOf = (bytes: u8[], off: i32, len: i32): string => {
  let s: string = ""
  let i: i32 = 0
  while (i < len) {
    const b: i32 = toI32(bytes[off + i])
    s = s + HEX.substring(b >> 4, (b >> 4) + 1) + HEX.substring(b & 15, (b & 15) + 1)
    i += 1
  }
  return s
}

const textOf = (bytes: u8[], off: i32, len: i32): string => String.fromBytes(bytes, off, off + len)

/** One decode: the count or code, the error offset, and the bytes as hex. */
const decode = (label: string, input: string, flags: i32): void => {
  const src: u8[] = bytesOf(input)
  const len: i32 = toI32(src.length)
  const out: u8[] = new Array<u8>(len)
  const n: i32 = percentDecode(src, 0, len, out, 0, flags)
  const at: i32 = percentDecodeErrorAt(src, 0, len, new Array<u8>(len), 0, flags)
  const shown: string = n >= 0 ? hexOf(out, 0, n) : "-"
  console.log(label + " " + input + " -> " + `${n}` + " at " + `${at}` + " " + shown)
}

/** Every pair of a query, raw, with `!` for a pair written without `=`. */
const pairs = (label: string, query: string, limits: UrlQueryLimits): void => {
  const src: u8[] = bytesOf(query)
  const q: UrlQuery = new UrlQuery(limits)
  q.reset(src, 0, toI32(src.length))
  let line: string = label + " " + query + " ->"
  let k: i32 = q.next()
  while (k === URL_QUERY_PAIR) {
    const key: string = textOf(src, q.keyStart, q.keyLength)
    line = line + " [" + key + (q.hasValue ? "=" + textOf(src, q.valueStart, q.valueLength) : "!") + "]"
    k = q.next()
  }
  console.log(line + " end " + `${k}` + " again " + `${q.next()}` + " failed " + `${q.failed}`)
}

const segments = (label: string, path: string): void => {
  const src: u8[] = bytesOf(path)
  const it: UrlPathSegments = new UrlPathSegments()
  it.reset(src, 0, toI32(src.length))
  const out: u8[] = new Array<u8>(toI32(src.length))
  let line: string = label + " " + path + " ->"
  let count: i32 = 0
  while (it.next()) {
    const n: i32 = percentDecodePathSegment(src, it.start, it.length, out, 0, URL_DECODE_FORM)
    line = line + " [" + (n >= 0 ? textOf(out, 0, n) : "err " + `${n}`) + "]"
    count += 1
  }
  console.log(line + " count " + `${count}` + " again " + (it.next() ? "true" : "false"))
}

const shownOrNull = (s: string | null): string => {
  if (s === null) {
    return "null"
  }
  return "\"" + s + "\""
}

/** `s`'s bytes as hex, or `null`. */
const stringHex = (s: string | null): string => {
  if (s === null) {
    return "null"
  }
  const bytes: u8[] = new Array<u8>(toI32(s.length))
  let i: i32 = 0
  while (i < toI32(bytes.length)) {
    bytes[i] = toU8(s.charCodeAt(i))
    i += 1
  }
  return hexOf(bytes, 0, toI32(bytes.length))
}

/** `urlDecode(input, 0)` as hex: a well-formed sequence at an edge of its lead's range, or one just past it. */
const utf8 = (input: string): void => {
  console.log("utf8 " + input + " -> " + stringHex(urlDecode(input, 0)))
}

/** `urlDecode` of raw bytes given in hex, a sequence cut short at the end of its string. */
const rawUtf8 = (hex: string): void => {
  const bytes: u8[] = new Array<u8>(toI32(hex.length) >> 1)
  let i: i32 = 0
  while (i < toI32(bytes.length)) {
    const hi: i32 = HEX.indexOf(hex.substring(2 * i, 2 * i + 1))
    const lo: i32 = HEX.indexOf(hex.substring(2 * i + 1, 2 * i + 2))
    bytes[i] = toU8(hi * 16 + lo)
    i += 1
  }
  console.log("raw " + hex + " -> " + stringHex(urlDecode(String.fromBytes(bytes, 0, toI32(bytes.length)), 0)))
}

const split = (target: string): void => {
  const src: u8[] = bytesOf(target)
  const q: i32 = urlQueryStart(src, 0, toI32(src.length))
  console.log("split " + target + " -> " + `${q}`)
}

export const main = (): i32 => {
  split("/search?q=1")
  split("/plain")
  split("?")
  split("/a?b?c")
  split("/frag#x?y")
  // A window that stops before the `?`.
  const w: u8[] = bytesOf("/ab?c")
  console.log("split window -> " + `${urlQueryStart(w, 0, 3)}` + " " + `${urlQueryStart(w, 1, 4)}`)

  const dflt: UrlQueryLimits = new UrlQueryLimits()
  console.log(`default cap ${dflt.maxPairs} is URL_DEFAULT_MAX_PAIRS ${dflt.maxPairs === URL_DEFAULT_MAX_PAIRS}`)
  pairs("pairs", "a&b=", dflt)
  pairs("pairs", "a=b=c", dflt)
  pairs("pairs", "&&a&&b=1&&", dflt)
  pairs("pairs", "", dflt)
  pairs("pairs", "&", dflt)
  pairs("pairs", "=&=x", dflt)
  pairs("pairs", "k=1&k=2&k=3", dflt)

  const three: UrlQueryLimits = new UrlQueryLimits()
  three.maxPairs = 3
  pairs("cap3", "a&b&c", three)
  pairs("cap3", "a&&b&c&", three)
  pairs("cap3", "a&b&c&d", three)
  const none: UrlQueryLimits = new UrlQueryLimits()
  none.maxPairs = -1
  pairs("cap-1", "", none)
  pairs("cap-1", "a", none)

  // Reset clears a spent iterator.
  const again: UrlQuery = new UrlQuery(three)
  const big: u8[] = bytesOf("a&b&c&d")
  again.reset(big, 0, 7)
  let k: i32 = again.next()
  while (k === URL_QUERY_PAIR) {
    k = again.next()
  }
  again.reset(big, 0, 3)
  console.log("reset " + `${k}` + " " + `${again.next()}` + " " + `${again.next()}` + " " + `${again.next()}`)

  // The default cap: exactly 100 pairs, then 101.
  let hundred: string = "x"
  let i: i32 = 1
  while (i < 100) {
    hundred = hundred + "&x"
    i += 1
  }
  const hq: UrlQuery = new UrlQuery(dflt)
  const hb: u8[] = bytesOf(hundred)
  hq.reset(hb, 0, toI32(hb.length))
  let count: i32 = 0
  while (hq.next() === URL_QUERY_PAIR) {
    count += 1
  }
  console.log("cap100 " + `${count}` + " failed " + `${hq.failed}`)
  const hb1: u8[] = bytesOf(hundred + "&x")
  hq.reset(hb1, 0, toI32(hb1.length))
  count = 0
  while (hq.next() === URL_QUERY_PAIR) {
    count += 1
  }
  console.log("cap101 " + `${count}` + " failed " + `${hq.failed}`)

  // Find: an encoded key, repeated keys in order, a malformed key that never matches.
  const fq: UrlQuery = new UrlQuery(dflt)
  const fb: u8[] = bytesOf("na%6De=x&a+b=1&name=y&%zz=2&name")
  fq.reset(fb, 0, toI32(fb.length))
  let f: i32 = urlQueryFind(fq, "name")
  while (f === URL_QUERY_PAIR) {
    console.log("find name -> " + textOf(fb, fq.valueStart, fq.valueLength) + " has " + (fq.hasValue ? "true" : "false"))
    f = urlQueryFind(fq, "name")
  }
  console.log("find name end " + `${f}`)
  fq.reset(fb, 0, toI32(fb.length))
  console.log("find a b -> " + `${urlQueryFind(fq, "a b")}` + " " + textOf(fb, fq.valueStart, fq.valueLength))
  fq.reset(fb, 0, toI32(fb.length))
  console.log("find %zz -> " + `${urlQueryFind(fq, "%zz")}`)
  fq.reset(fb, 0, toI32(fb.length))
  console.log("find nam -> " + `${urlQueryFind(fq, "nam")}`)
  // A key that is a strict prefix of the name never matches it.
  const pb: u8[] = bytesOf("a=1&n%61=2")
  fq.reset(pb, 0, toI32(pb.length))
  console.log("find ab -> " + `${urlQueryFind(fq, "ab")}`)
  fq.reset(pb, 0, toI32(pb.length))
  console.log("find name over na -> " + `${urlQueryFind(fq, "name")}`)
  const capped: UrlQuery = new UrlQuery(three)
  const cb: u8[] = bytesOf("a&b&c&name=late")
  capped.reset(cb, 0, toI32(cb.length))
  console.log("find past cap -> " + `${urlQueryFind(capped, "name")}`)

  // Decoding: `+` in both modes, both hex cases, the malformed escapes, `%00`, lenient.
  decode("strict", "a+b%20c", 0)
  decode("form", "a+b%20c", URL_DECODE_FORM)
  decode("hex", "%4a%4A%7e%7E%ff", 0)
  decode("strict", "%zz", 0)
  decode("strict", "ab%4", 0)
  decode("strict", "ab%", 0)
  decode("strict", "a%g1", 0)
  decode("strict", "%00", 0)
  decode("nul", "%00", URL_DECODE_ALLOW_NUL)
  decode("lenient", "%zz%4%", URL_DECODE_LENIENT)
  decode("lenient", "%%41", URL_DECODE_LENIENT)
  decode("lenient", "%00", URL_DECODE_LENIENT)
  decode("all", "a+%zz%00%41", URL_DECODE_FORM | URL_DECODE_LENIENT | URL_DECODE_ALLOW_NUL)
  decode("empty", "", 0)
  decode("utf8", "%E2%82%AC%C3", 0)

  // Output space: one byte too small, exactly enough, and writing at an offset.
  const src: u8[] = bytesOf("ab%41")
  const small: u8[] = new Array<u8>(2)
  console.log("space small -> " + `${percentDecode(src, 0, 5, small, 0, 0)}` + " at " + `${percentDecodeErrorAt(src, 0, 5, small, 0, 0)}` + " " + hexOf(small, 0, 2))
  const exact: u8[] = new Array<u8>(3)
  console.log("space exact -> " + `${percentDecode(src, 0, 5, exact, 0, 0)}` + " " + hexOf(exact, 0, 3))
  const offset: u8[] = new Array<u8>(5)
  console.log("space at 2 -> " + `${percentDecode(src, 0, 5, offset, 2, 0)}` + " " + hexOf(offset, 0, 5))
  console.log("space at 3 -> " + `${percentDecode(src, 0, 5, offset, 3, 0)}`)
  console.log("space at end -> " + `${percentDecode(src, 0, 0, offset, 5, 0)}`)
  // A window inside the array.
  const mid: u8[] = new Array<u8>(1)
  console.log("window -> " + `${percentDecode(src, 2, 3, mid, 0, 0)}` + " " + hexOf(mid, 0, 1))
  // A `%` or `%4` at the window's end, with the hex digits it lacks just past it in the array.
  const cut: u8[] = new Array<u8>(2)
  let wl: i32 = 1
  while (wl <= 2) {
    const strict: i32 = percentDecode(src, 2, wl, cut, 0, 0)
    const strictAt: i32 = percentDecodeErrorAt(src, 2, wl, cut, 0, 0)
    const loose: i32 = percentDecode(src, 2, wl, cut, 0, URL_DECODE_LENIENT)
    const looseHex: string = loose >= 0 ? hexOf(cut, 0, loose) : "-"
    const seg: i32 = percentDecodePathSegment(src, 2, wl, cut, 0, URL_DECODE_LENIENT)
    const segHex: string = seg >= 0 ? hexOf(cut, 0, seg) : "-"
    console.log(
      "window cut " + `${wl}` + " -> " + `${strict}` + " at " + `${strictAt}` + " lenient " + `${loose}` + " " + looseHex +
        " segment " + `${percentDecodePathSegment(src, 2, wl, cut, 0, 0)}` + " lenient " + `${seg}` + " " + segHex
    )
    wl += 1
  }
  // The same cut through a query: the value's window, and a key `urlQueryFind` must not read past.
  const kv: u8[] = bytesOf("k%41=%41")
  const cq: UrlQuery = new UrlQuery(new UrlQueryLimits())
  cq.reset(kv, 0, 7)
  const ck: i32 = cq.next()
  const cv: i32 = percentDecode(kv, cq.valueStart, cq.valueLength, cut, 0, URL_DECODE_FORM)
  const cvLoose: i32 = percentDecode(kv, cq.valueStart, cq.valueLength, cut, 0, URL_DECODE_FORM | URL_DECODE_LENIENT)
  console.log(
    "window query -> " + `${ck}` + " value " + `${cq.valueLength}` + " " + `${cv}` + " lenient " + `${cvLoose}` + " " +
      (cvLoose >= 0 ? hexOf(cut, 0, cvLoose) : "-")
  )
  cq.reset(kv, 0, 3)
  console.log("window find kA -> " + `${urlQueryFind(cq, "kA")}`)
  cq.reset(kv, 0, 4)
  console.log("window find kA whole -> " + `${urlQueryFind(cq, "kA")}`)

  // Paths: split on the raw `/` before decoding.
  segments("path", "/a%2Fb/c")
  segments("path", "/")
  segments("path", "")
  segments("path", "/a//b/")
  segments("path", "a+b/c%20d")
  segments("path", "/x%zz/y")

  // Strings.
  console.log("urlDecode " + shownOrNull(urlDecode("caf%41+x%21", 0)))
  // Non-ASCII: the length is the byte count natively and the latin1 code-unit count under Node.
  const cafe: string | null = urlDecode("caf%C3%A9", 0)
  console.log("urlDecode cafe " + (cafe === null ? "null" : `${cafe.length}`))
  // A valid multi-byte value, as bytes: two-, three- and four-byte sequences.
  const mb: u8[] = bytesOf("caf%C3%A9+%E2%82%AC%F0%9F%98%80")
  const mbOut: u8[] = new Array<u8>(toI32(mb.length))
  const mbN: i32 = percentDecode(mb, 0, toI32(mb.length), mbOut, 0, URL_DECODE_FORM)
  console.log("multibyte -> " + `${mbN}` + " " + hexOf(mbOut, 0, mbN))
  console.log("urlDecode " + shownOrNull(urlDecode("a+b", URL_DECODE_FORM)))
  console.log("urlDecode " + shownOrNull(urlDecode("%zz", 0)))
  console.log("urlDecode " + shownOrNull(urlDecode("%zz", URL_DECODE_LENIENT)))
  console.log("urlDecode " + shownOrNull(urlDecode("%FF", 0)))
  console.log("urlDecode " + shownOrNull(urlDecode("%C0%AF", 0)))
  console.log("urlDecode " + shownOrNull(urlDecode("%ED%A0%80", 0)))
  console.log("urlDecode " + shownOrNull(urlDecode("", 0)))
  // Every edge of RFC 3629's table: the first and last well-formed sequence of
  // each restricted lead, and the byte just outside it.
  utf8("%C2%80")
  utf8("%DF%BF")
  utf8("%C1%BF")
  utf8("%E0%A0%80")
  utf8("%E0%9F%BF")
  utf8("%E0%80%AF")
  utf8("%E2%82%AC")
  utf8("%ED%9F%BF")
  utf8("%ED%A0%80")
  utf8("%EF%BF%BF")
  utf8("%F0%90%80%80")
  utf8("%F0%8F%BF%BF")
  utf8("%F0%9F%98%80")
  utf8("%F4%8F%BF%BF")
  utf8("%F4%90%80%80")
  utf8("%F5%80%80%80")
  // A continuation byte missing in the middle, and a sequence cut short at the end.
  utf8("%E2%41%AC")
  utf8("%E2%82%41")
  utf8("%F0%9F%41%80")
  utf8("%F0%9F%98%41")
  utf8("%C3")
  utf8("%E2%82")
  utf8("%F0%9F%98")
  utf8("a%C3%A9%E2")
  rawUtf8("c3")
  rawUtf8("e282")
  rawUtf8("f09f98")
  rawUtf8("61c3a9")
  console.log("get " + shownOrNull(urlQueryGet("/s?na%6De=J%20Doe&name=2", "name")))
  console.log("get " + shownOrNull(urlQueryGet("/s?flag&x=1", "flag")))
  console.log("get " + shownOrNull(urlQueryGet("/s?x=1", "flag")))
  console.log("get " + shownOrNull(urlQueryGet("/s", "x")))
  console.log("get " + shownOrNull(urlQueryGet("/s?x=%zz", "x")))
  console.log("get " + shownOrNull(urlQueryGet("/s?x=%FF", "x")))
  console.log("get " + stringHex(urlQueryGet("/s?x=%F0%9F%98%80", "x")))
  console.log("get " + stringHex(urlQueryGet("/s?x=%F4%90%80%80", "x")))
  console.log("get " + stringHex(urlQueryGet("/s?x=%E0%80%AF", "x")))
  console.log("get " + shownOrNull(urlQueryGet("/s?x=a+b%2Bc", "x")))
  console.log("get " + shownOrNull(urlQueryGet("/s?" + hundred + "&late=1", "late")))
  console.log("get " + shownOrNull(urlQueryGet("/s?y=1#x=2", "x")))
  return 0
}
