// `nish/net/url` against Node's own decoders: seeded inputs over an alphabet
// heavy in `%`, hex digits, `+`, `&` and `=`, each printed with what the
// module made of it. tests/run.js parses the lines and holds them to
// decodeURIComponent, URLSearchParams and the strict rule's regex, natively
// and under Node.
//
//   I <input hex>
//   S <strict result> <hex>        flags 0
//   L <hex>                        lenient | form | allow-NUL
//   P <key hex> <value hex or !>   each pair, both decoded as L is
//   E <the iterator's last answer>
import { Rng } from "nish/random"
import {
  URL_DECODE_ALLOW_NUL,
  URL_DECODE_FORM,
  URL_DECODE_LENIENT,
  URL_QUERY_PAIR,
  UrlQuery,
  UrlQueryLimits,
  percentDecode,
} from "nish/net/url"

const ALPHABET: string = "%%%%0123456789aAfFgz+&&==/x"
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

/** The window decoded as `LOOSE`, as hex. */
const looseHex = (src: u8[], off: i32, len: i32, out: u8[]): string => {
  const n: i32 = percentDecode(src, off, len, out, 0, LOOSE)
  return n >= 0 ? hexOf(out, 0, n) : `err${n}`
}

export const main = (): i32 => {
  if (LOOSE !== (URL_DECODE_LENIENT | URL_DECODE_FORM | URL_DECODE_ALLOW_NUL)) {
    panic("fuzz: LOOSE is not the three flags")
  }
  const r: Rng = new Rng(717)
  const q: UrlQuery = new UrlQuery(new UrlQueryLimits())
  const lines: string[] = []
  let c: i32 = 0
  while (c < CASES) {
    const len: i32 = (r.nextI32() >>> 1) % 25
    const src: u8[] = new Array<u8>(len)
    let i: i32 = 0
    while (i < len) {
      const k: i32 = (r.nextI32() >>> 1) % toI32(ALPHABET.length)
      src[i] = toU8(ALPHABET.charCodeAt(k))
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
    c += 1
  }
  console.log(lines.join("\n"))
  return 0
}
