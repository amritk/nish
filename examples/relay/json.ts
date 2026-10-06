/**
 * The grant's JSON, read by hand: WP34's N11 phase-one case
 * (`docs/wp34-hosting-cs.md`), an object of strings and integers and nothing
 * else, read from a byte window into tables made once.
 *
 * What it takes is RFC 8259 narrowed to what `JSON.stringify` writes for a
 * `SessionGrant`: a top-level object whose values are strings, integers
 * (`-?(0|[1-9][0-9]*)`, within an i64) or objects of the same, at most
 * `RELAY_JSON_DEPTH` deep, with at most `RELAY_JSON_MEMBERS` members at the
 * top, no key twice there, in a document of at most `RELAY_JSON_LENGTH`
 * bytes of UTF-8. Strings take every escape RFC 8259 §7 has, `\u` surrogate
 * pairs included; a lone surrogate, a raw control character or a byte that is
 * not UTF-8 is refused. Everything else is refused too — arrays, `true`,
 * `false`, `null`, a fraction or an exponent, an integer past i64, a second
 * value after the first — which is the difference from frame.rs's
 * `serde_json`: a grant is written by `signGrant`, and nothing it writes is
 * refused here.
 *
 * Only the top level is recorded, since the grant's fields are there: each
 * member's key and string value are unescaped into `text`, and an integer is
 * kept in `integer`. Nothing allocates after the constructor, and the work is
 * one pass over the bytes.
 */
import { h3CheckWindow } from "nish/net/http3-frame"
import { websocketIsUtf8 } from "nish/net/websocket"

/** The most bytes a document may have. */
export const RELAY_JSON_LENGTH: i32 = 1024

/** The most members the top-level object may have. */
export const RELAY_JSON_MEMBERS: i32 = 16

/** The deepest an object may nest, the top level being 1. */
export const RELAY_JSON_DEPTH: i32 = 4

/** What a member's value is. */
export const JSON_STRING: i32 = 1
export const JSON_INTEGER: i32 = 2
export const JSON_OBJECT: i32 = 3

/** i64's largest value, which an integer may not pass: 2^63 - 1, spelt as arithmetic over exact literals. */
const JSON_HALF: i64 = 2147483648 * 2147483648
const JSON_I64_MAX: i64 = JSON_HALF - 1 + JSON_HALF

/** Typed constants, since a bare literal handed to a method is an `f64` under `--number-mode f64`. */
const JSON_NO_MEMBER: i32 = -1
const JSON_SUPPLEMENTARY: i32 = 0x10000
/** UTF-8's lead bytes of a two-, three- and four-byte sequence. */
const JSON_LEAD_TWO: i32 = 0xc0
const JSON_LEAD_THREE: i32 = 0xe0
const JSON_LEAD_FOUR: i32 = 0xf0
const JSON_TAIL: i32 = 0x80

/** Appends byte `b` to `j.text`; false when it is full. */
const relayJsonPut = (j: RelayJson, b: i32): boolean => {
  if (j.fill < 0 || j.fill >= toI32(j.text.length)) {
    return false
  }
  j.text[j.fill] = toU8(b)
  j.fill = j.fill + 1
  return true
}

/** Appends code point `cp` to `j.text` as UTF-8. */
const relayJsonPutCodePoint = (j: RelayJson, cp: i32): boolean => {
  if (cp < 0x80) {
    return relayJsonPut(j, cp)
  }
  if (cp < 0x800) {
    return relayJsonPut(j, JSON_LEAD_TWO | (cp >> 6)) && relayJsonPut(j, JSON_TAIL | (cp & 0x3f))
  }
  if (cp < 0x10000) {
    return (
      relayJsonPut(j, JSON_LEAD_THREE | (cp >> 12)) &&
      relayJsonPut(j, JSON_TAIL | ((cp >> 6) & 0x3f)) &&
      relayJsonPut(j, JSON_TAIL | (cp & 0x3f))
    )
  }
  return (
    relayJsonPut(j, JSON_LEAD_FOUR | (cp >> 18)) &&
    relayJsonPut(j, JSON_TAIL | ((cp >> 12) & 0x3f)) &&
    relayJsonPut(j, JSON_TAIL | ((cp >> 6) & 0x3f)) &&
    relayJsonPut(j, JSON_TAIL | (cp & 0x3f))
  )
}

/** The members of one top-level object, read by `read`. */
export class RelayJson {
  /** Each member's integer, when its kind is `JSON_INTEGER`. */
  integer: i64[]
  /** The unescaped keys and string values, back to back. */
  text: u8[]
  /** Each member's key, `text[keyStart .. keyStart + keyLength)`, its kind and its string value. */
  keyStart: i32[]
  keyLength: i32[]
  kind: i32[]
  valueStart: i32[]
  valueLength: i32[]
  /** How many members `read` found. */
  count: i32 = 0
  /** Where the next unescaped byte goes in `text`. */
  fill: i32 = 0
  /** Where `read` is in the document, and its end. */
  at: i32 = 0
  end: i32 = 0

  constructor() {
    this.integer = new Array<i64>(RELAY_JSON_MEMBERS)
    this.text = new Array<u8>(RELAY_JSON_LENGTH)
    this.keyStart = new Array<i32>(RELAY_JSON_MEMBERS)
    this.keyLength = new Array<i32>(RELAY_JSON_MEMBERS)
    this.kind = new Array<i32>(RELAY_JSON_MEMBERS)
    this.valueStart = new Array<i32>(RELAY_JSON_MEMBERS)
    this.valueLength = new Array<i32>(RELAY_JSON_MEMBERS)
  }

  /**
   * Reads the document `buf[off .. off + len)`: whether it is one object as
   * the module comment says. The members are in the tables until the next
   * call. A window outside `buf` is the program's mistake and panics.
   */
  read(buf: u8[], off: i32, len: i32): boolean {
    h3CheckWindow("RelayJson.read", buf, off, len)
    this.count = 0
    this.fill = 0
    this.at = off
    this.end = off + len
    if (len > RELAY_JSON_LENGTH || !websocketIsUtf8(buf, off, len)) {
      return false
    }
    this.space(buf)
    if (!this.object(buf)) {
      return false
    }
    this.space(buf)
    return this.at === this.end
  }

  /** The byte at the cursor, or -1 at the end. */
  peek(buf: u8[]): i32 {
    return this.at >= 0 && this.at < this.end && this.at < toI32(buf.length) ? toI32(buf[this.at]) : -1
  }

  /** Steps over whitespace (RFC 8259 §2). */
  space(buf: u8[]): void {
    let c: i32 = this.peek(buf)
    while (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
      this.at = this.at + 1
      c = this.peek(buf)
    }
  }

  /**
   * The top-level object at the cursor, recording its members; nested
   * objects are read and checked by `nested`, not recorded.
   */
  object(buf: u8[]): boolean {
    if (this.peek(buf) !== 0x7b) {
      return false
    }
    this.at = this.at + 1
    this.space(buf)
    if (this.peek(buf) === 0x7d) {
      this.at = this.at + 1
      return true
    }
    for (let guard: i32 = 0; guard <= RELAY_JSON_MEMBERS; guard++) {
      if (this.count >= RELAY_JSON_MEMBERS) {
        return false
      }
      const m: i32 = this.count
      this.keyStart[m] = this.fill
      if (!this.string(buf)) {
        return false
      }
      this.keyLength[m] = this.fill - this.keyStart[m]
      if (this.duplicate(m)) {
        return false
      }
      this.space(buf)
      if (this.peek(buf) !== 0x3a) {
        return false
      }
      this.at = this.at + 1
      this.space(buf)
      const c: i32 = this.peek(buf)
      this.valueStart[m] = this.fill
      this.valueLength[m] = 0
      this.integer[m] = 0
      if (c === 0x22) {
        this.kind[m] = JSON_STRING
        if (!this.string(buf)) {
          return false
        }
        this.valueLength[m] = this.fill - this.valueStart[m]
      } else if (c === 0x7b) {
        this.kind[m] = JSON_OBJECT
        if (!this.nested(buf)) {
          return false
        }
      } else {
        this.kind[m] = JSON_INTEGER
        if (!this.number(buf, m)) {
          return false
        }
      }
      this.count = this.count + 1
      this.space(buf)
      const next: i32 = this.peek(buf)
      this.at = this.at + 1
      if (next === 0x7d) {
        return true
      }
      if (next !== 0x2c) {
        return false
      }
      this.space(buf)
    }
    return false
  }

  /** Whether member `m`'s key is an earlier member's. */
  duplicate(m: i32): boolean {
    for (let k: i32 = 0; k < m; k++) {
      if (
        this.keyLength[k] === this.keyLength[m] &&
        this.sameText(this.keyStart[k], this.keyStart[m], this.keyLength[m])
      ) {
        return true
      }
    }
    return false
  }

  /** Whether `text[a .. a + n)` and `text[b .. b + n)` are the same bytes. */
  sameText(a: i32, b: i32, n: i32): boolean {
    const text: u8[] = this.text
    for (let k: i32 = 0; k < n; k++) {
      const i: i32 = a + k
      const j: i32 = b + k
      if (i < 0 || j < 0 || i >= toI32(text.length) || j >= toI32(text.length) || text[i] !== text[j]) {
        return false
      }
    }
    return true
  }

  /**
   * A nested object at the cursor, read through without recording: its
   * values strings, integers or objects, at most `RELAY_JSON_DEPTH` deep
   * counting the top level. Iterative, with the depth as the only state,
   * since an object holds nothing that needs a stack.
   */
  nested(buf: u8[]): boolean {
    let depth: i32 = 1
    // After `{` a key or `}` may come; after a value, `,` or `}`.
    let afterValue: boolean = false
    this.at = this.at + 1
    const fill: i32 = this.fill
    for (let guard: i32 = 0; guard < RELAY_JSON_LENGTH; guard++) {
      this.space(buf)
      const c: i32 = this.peek(buf)
      if (c === 0x7d) {
        this.at = this.at + 1
        depth = depth - 1
        afterValue = true
        if (depth === 0) {
          this.fill = fill
          return true
        }
        continue
      }
      if (afterValue) {
        if (c !== 0x2c) {
          return false
        }
        this.at = this.at + 1
        this.space(buf)
      }
      // A key, then `:`, then a value.
      if (!this.string(buf)) {
        return false
      }
      this.space(buf)
      if (this.peek(buf) !== 0x3a) {
        return false
      }
      this.at = this.at + 1
      this.space(buf)
      const v: i32 = this.peek(buf)
      this.fill = fill
      if (v === 0x7b) {
        if (depth + 2 > RELAY_JSON_DEPTH) {
          return false
        }
        depth = depth + 1
        this.at = this.at + 1
        this.space(buf)
        afterValue = false
        continue
      }
      if (v === 0x22) {
        if (!this.string(buf)) {
          return false
        }
      } else if (!this.number(buf, JSON_NO_MEMBER)) {
        return false
      }
      this.fill = fill
      afterValue = true
    }
    return false
  }

  /** The four hex digits of a `\u` escape at the cursor, or -1. */
  hex4(buf: u8[]): i32 {
    let v: i32 = 0
    for (let k: i32 = 0; k < 4; k++) {
      const c: i32 = this.peek(buf)
      let d: i32 = -1
      if (c >= 0x30 && c <= 0x39) {
        d = c - 0x30
      } else if (c >= 0x41 && c <= 0x46) {
        d = c - 0x37
      } else if (c >= 0x61 && c <= 0x66) {
        d = c - 0x57
      }
      if (d < 0) {
        return -1
      }
      v = (v << 4) | d
      this.at = this.at + 1
    }
    return v
  }

  /** A `\u` escape's code point, the cursor past the `u`: a surrogate pair is one, a lone surrogate -1. */
  unicode(buf: u8[]): i32 {
    const first: i32 = this.hex4(buf)
    if (first < 0 || (first >= 0xdc00 && first <= 0xdfff)) {
      return -1
    }
    if (first < 0xd800 || first > 0xdbff) {
      return first
    }
    if (this.peek(buf) !== 0x5c) {
      return -1
    }
    this.at = this.at + 1
    if (this.peek(buf) !== 0x75) {
      return -1
    }
    this.at = this.at + 1
    const second: i32 = this.hex4(buf)
    if (second < 0xdc00 || second > 0xdfff) {
      return -1
    }
    return JSON_SUPPLEMENTARY + ((first - 0xd800) << 10) + (second - 0xdc00)
  }

  /** The string at the cursor, unescaped onto `text` (RFC 8259 §7). */
  string(buf: u8[]): boolean {
    if (this.peek(buf) !== 0x22) {
      return false
    }
    this.at = this.at + 1
    for (let guard: i32 = 0; guard < RELAY_JSON_LENGTH; guard++) {
      const c: i32 = this.peek(buf)
      if (c < 0x20) {
        // The end of the document, or a raw control character.
        return false
      }
      this.at = this.at + 1
      if (c === 0x22) {
        return true
      }
      if (c !== 0x5c) {
        if (!relayJsonPut(this, c)) {
          return false
        }
        continue
      }
      const e: i32 = this.peek(buf)
      this.at = this.at + 1
      let out: i32 = -1
      if (e === 0x22 || e === 0x5c || e === 0x2f) {
        out = e
      } else if (e === 0x62) {
        out = 0x08
      } else if (e === 0x66) {
        out = 0x0c
      } else if (e === 0x6e) {
        out = 0x0a
      } else if (e === 0x72) {
        out = 0x0d
      } else if (e === 0x74) {
        out = 0x09
      } else if (e === 0x75) {
        out = this.unicode(buf)
      }
      if (out < 0 || !relayJsonPutCodePoint(this, out)) {
        return false
      }
    }
    return false
  }

  /** The integer at the cursor, into member `m`'s slot when `m` is one. */
  number(buf: u8[], m: i32): boolean {
    let negative: boolean = false
    if (this.peek(buf) === 0x2d) {
      negative = true
      this.at = this.at + 1
    }
    let c: i32 = this.peek(buf)
    if (c < 0x30 || c > 0x39) {
      return false
    }
    let value: i64 = 0
    if (c === 0x30) {
      this.at = this.at + 1
    } else {
      while (c >= 0x30 && c <= 0x39) {
        const digit: i64 = toI64(c - 0x30)
        if (value > (JSON_I64_MAX - digit) / 10) {
          return false
        }
        value = value * 10 + digit
        this.at = this.at + 1
        c = this.peek(buf)
      }
    }
    // A fraction, an exponent, or a digit after a leading zero.
    const after: i32 = this.peek(buf)
    if (after === 0x2e || after === 0x65 || after === 0x45 || (after >= 0x30 && after <= 0x39)) {
      return false
    }
    if (m >= 0 && m < toI32(this.integer.length)) {
      this.integer[m] = negative ? -value : value
    }
    return true
  }

  /** The member whose key is `name` (ASCII), or -1. */
  find(name: string): i32 {
    const n: i32 = toI32(name.length)
    for (let m: i32 = 0; m < this.count; m++) {
      if (this.keyLength[m] === n && this.keyIs(m, name)) {
        return m
      }
    }
    return -1
  }

  /** Whether member `m`'s key is `name`'s bytes. */
  keyIs(m: i32, name: string): boolean {
    const start: i32 = this.keyStart[m]
    for (let k: i32 = 0; k < toI32(name.length); k++) {
      const at: i32 = start + k
      if (at < 0 || at >= toI32(this.text.length) || toI32(this.text[at]) !== toI32(name.charCodeAt(k))) {
        return false
      }
    }
    return true
  }
}
