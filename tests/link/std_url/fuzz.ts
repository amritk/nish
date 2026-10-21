// `nish/net/url` against Node's own decoders: seeded inputs over an alphabet
// heavy in `%`, hex digits, `+`, `&` and `=`, mixed with UTF-8 sequences —
// valid and broken, escaped and raw — each printed with what the module made
// of it. tests/run.js parses the lines and holds them to
// decodeURIComponent, URLSearchParams and the strict rule's regex, natively
// and under Node.
//
//   I <input hex>
//   S <strict result> <hex>        flags 0
//   L <hex>                        lenient | form | allow-NUL
//   P <key hex> <value hex or !>   each pair, both decoded as L is
//   E <the iterator's last answer>
//   D <hex or null>                urlDecode of the input as a string, flags 0
//   G <hex or null>                urlQueryGet("/?v=" + the input, "v")
import { Rng } from "nish/random"
import {
  URL_DECODE_ALLOW_NUL,
  URL_DECODE_FORM,
  URL_DECODE_LENIENT,
  URL_QUERY_PAIR,
  UrlQuery,
  UrlQueryLimits,
  percentDecode,
  urlDecode,
  urlQueryGet,
} from "nish/net/url"

const ALPHABET: string = "%%%%0123456789aAbBcCdDeEfFgGz:@`+&&==/x"
/**
 * UTF-8 sequences in hex, space-separated: valid two-, three- and four-byte
 * ones, each at the edge of its lead's range, then overlong forms (`C0`, `C1`,
 * `E0 80..9F`, `F0 80..8F`), a surrogate, code points past U+10FFFF, a lone
 * continuation, truncated two-, three- and four-byte leads, a lead with an
 * ASCII byte after it, and 0xFF; then each unrestricted lead (`E1`,
 * `E3..EC`, `EE`, `F1..F3`) well-formed and with a byte past the continuation
 * range.
 */
const SEQUENCES: string =
  "c3a9 c280 dfbf e0a080 e282ac ed9fbf efbfbd f0908080 f09f9880 f48fbfbf c0af c1bf e080af e09fbf f08fbfbf eda080 f4908080 f5808080 80 c3 e282 f09f98 c341 e2c3a9 ff e180bf e180c0 e380bf e380c0 e480bf e480c0 e580bf e580c0 e680bf e680c0 e780bf e780c0 e880bf e880c0 e980bf e980c0 ea80bf ea80c0 eb80bf eb80c0 ec80bf ec80c0 ee80bf ee80c0 f180bf80 f180c080 f280bf80 f280c080 f380bf80 f380c080"
/** The most bytes one input step writes: a four-byte sequence, escaped. */
const STEP_MAX: i32 = 12
const STEPS: i32 = 16
const CASES: i32 = 3000
/** Lenient, form and allow-NUL: a constant may not be an `|`, so main checks the sum. */
const LOOSE: i32 = 7
const DIGITS: string = "0123456789abcdef"

const hexOf = (bytes: u8[], off: i32, len: i32): string => {
  const parts: string[] = []
  let i: i32 = 0
  while (i < len) {
    const b: i32 = toI32(bytes[off + i])
    parts.push(DIGITS.substring(b >> 4, (b >> 4) + 1))
    parts.push(DIGITS.substring(b & 15, (b & 15) + 1))
    i += 1
  }
  return parts.join("")
}

/** The ASCII code of hex digit `v`, upper case when `upper` is 1. */
const hexDigit = (v: i32, upper: i32): i32 => {
  if (v < 10) {
    return 48 + v
  }
  return (upper === 1 ? 55 : 87) + v
}

/** The window decoded as `LOOSE`, as hex. */
const looseHex = (src: u8[], off: i32, len: i32, out: u8[]): string => {
  const n: i32 = percentDecode(src, off, len, out, 0, LOOSE)
  return n >= 0 ? hexOf(out, 0, n) : `err${n}`
}

/** A string's bytes as hex, or `null`. */
const stringHex = (s: string | null): string => {
  if (s === null) {
    return "null"
  }
  const parts: string[] = []
  let i: i32 = 0
  while (i < toI32(s.length)) {
    const b: i32 = toI32(s.charCodeAt(i))
    parts.push(DIGITS.substring(b >> 4, (b >> 4) + 1))
    parts.push(DIGITS.substring(b & 15, (b & 15) + 1))
    i += 1
  }
  return parts.join("")
}

export const main = (): i32 => {
  if (LOOSE !== (URL_DECODE_LENIENT | URL_DECODE_FORM | URL_DECODE_ALLOW_NUL)) {
    panic("fuzz: LOOSE is not the three flags")
  }
  // `SEQUENCES` as bytes, each sequence led by its length, and where each starts.
  const seq: u8[] = []
  const starts: i32[] = []
  const total: i32 = toI32(SEQUENCES.length)
  let p: i32 = 0
  while (p < total) {
    starts.push(toI32(seq.length))
    seq.push(toU8(0))
    const lead: i32 = toI32(seq.length) - 1
    while (p + 1 < total && SEQUENCES.charCodeAt(p) !== 32) {
      const hi: i32 = DIGITS.indexOf(SEQUENCES.substring(p, p + 1))
      const lo: i32 = DIGITS.indexOf(SEQUENCES.substring(p + 1, p + 2))
      seq.push(toU8(hi * 16 + lo))
      seq[lead] = toU8(toI32(seq[lead]) + 1)
      p += 2
    }
    p += 1
  }
  const r: Rng = new Rng(717)
  const q: UrlQuery = new UrlQuery(new UrlQueryLimits())
  const lines: string[] = []
  let c: i32 = 0
  while (c < CASES) {
    const steps: i32 = (r.nextI32() >>> 1) % STEPS
    const buf: u8[] = new Array<u8>(STEPS * STEP_MAX)
    let len: i32 = 0
    let s: i32 = 0
    while (s < steps && len >= 0 && len + STEP_MAX <= toI32(buf.length)) {
      const pick: i32 = (r.nextI32() >>> 1) % 8
      if (pick < 5) {
        const k: i32 = (r.nextI32() >>> 1) % toI32(ALPHABET.length)
        buf[len] = toU8(ALPHABET.charCodeAt(k))
        len += 1
      } else {
        // A sequence, escaped (upper or lower case hex) or written raw.
        const which: i32 = (r.nextI32() >>> 1) % toI32(starts.length)
        const at: i32 = starts[which]
        const n: i32 = toI32(seq[at])
        const raw: boolean = pick === 7
        const upper: i32 = (r.nextI32() >>> 1) % 2
        let j: i32 = 0
        while (j < n && at + 1 + j < toI32(seq.length) && len + 3 <= toI32(buf.length)) {
          const b: i32 = toI32(seq[at + 1 + j])
          if (raw) {
            buf[len] = toU8(b)
            len += 1
          } else {
            buf[len] = toU8(37)
            buf[len + 1] = toU8(hexDigit(b >> 4, upper))
            buf[len + 2] = toU8(hexDigit(b & 15, upper))
            len += 3
          }
          j += 1
        }
      }
      s += 1
    }
    const src: u8[] = new Array<u8>(len)
    let i: i32 = 0
    while (i < len) {
      src[i] = buf[i]
      i += 1
    }
    const out: u8[] = new Array<u8>(len)
    lines.push(`I ${hexOf(src, 0, len)}`)
    const strict: i32 = percentDecode(src, 0, len, out, 0, 0)
    lines.push(`S ${strict} ${strict >= 0 ? hexOf(out, 0, strict) : "-"}`)
    lines.push(`L ${looseHex(src, 0, len, out)}`)
    q.reset(src, 0, len)
    let kind: i32 = q.next()
    while (kind === URL_QUERY_PAIR) {
      const key: string = looseHex(src, q.keyStart, q.keyLength, out)
      const value: string = q.hasValue ? looseHex(src, q.valueStart, q.valueLength, out) : "!"
      lines.push(`P ${key} ${value}`)
      kind = q.next()
    }
    lines.push(`E ${kind}`)
    const text: string = String.fromBytes(src, 0, len)
    lines.push(`D ${stringHex(urlDecode(text, 0))}`)
    lines.push(`G ${stringHex(urlQueryGet("/?v=" + text, "v"))}`)
    c += 1
  }
  console.log(lines.join("\n"))
  return 0
}
