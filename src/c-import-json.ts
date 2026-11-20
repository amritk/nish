// The JSON reader `nish c-import` reads clang's AST and the overrides file
// with. It is apart from `nish/json-value` so that the compiler's own build
// links no `nish/bytes`: a document is a table of values, each a kind and a
// span, and a container's members are a run of `kids`. Strings are decoded
// into `text` as they are read, so `stringEquals` compares bytes and
// allocates nothing. The grammar is RFC 8259's, strictly: no comments, no
// trailing commas, no control bytes in a string, nothing after the value.
// A key repeated in an object is kept as written; the overrides reader
// refuses it (`refuseDuplicate` in `src/c-import.ts`).

/** A `null`. */
const CJ_NULL: i32 = 1
/** `true` or `false`. */
export const CJ_BOOLEAN: i32 = 2
/** A number, kept as its text. */
export const CJ_NUMBER: i32 = 3
/** A string. */
export const CJ_STRING: i32 = 4
/** An array. */
export const CJ_ARRAY: i32 = 5
/** An object, whose `kids` alternate key and value. */
export const CJ_OBJECT: i32 = 6

/** How deep containers may nest. */
const CJ_MAX_DEPTH: i32 = 64
/** How many values one document may hold. */
const CJ_MAX_VALUES: i32 = 4194304

/** The byte at `p`, or -1 past either end. */
const jsonByteAt = (src: u8[], p: i32): i32 => (p >= 0 && p < toI32(src.length) ? toI32(src[p]) : -1)

/** The value of hex digit `c`, or -1. */
const jsonHexValue = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48
  }
  if (c >= 97 && c <= 102) {
    return c - 87
  }
  if (c >= 65 && c <= 70) {
    return c - 55
  }
  return -1
}

/** One parsed document. Every handle is an index into its tables; -1 is none. */
export class CJson {
  kinds: i32[]
  /** A string's or number's offset in `text`, a container's in `kids`, a boolean's value. */
  offs: i32[]
  /** A string's or number's byte length, a container's member count. */
  lens: i32[]
  kids: i32[]
  text: u8[]
  /** The members of the containers still open, in order. */
  stack: i32[]
  src: u8[]
  pos: i32 = 0
  depth: i32 = 0
  bad: boolean = false

  constructor() {
    this.kinds = []
    this.offs = []
    this.lens = []
    this.kids = []
    this.text = []
    this.stack = []
    this.src = []
  }

  /** Forgets every value. */
  clear(): void {
    this.kinds = []
    this.offs = []
    this.lens = []
    this.kids = []
    this.text = []
    this.stack = []
    this.src = []
  }

  /** Parses the JSON text `s`; the root's handle, or -1. */
  parseText(s: string): i32 {
    const bytes: u8[] = []
    for (let i = 0; i < s.length; i++) {
      bytes.push(toU8(s.charCodeAt(i)))
    }
    return this.parse(bytes)
  }

  /** Parses `src` whole; the root's handle, or -1 when it is not one JSON value or passes a cap. */
  parse(src: u8[]): i32 {
    this.clear()
    this.src = src
    this.pos = 0
    this.depth = 0
    this.bad = false
    this.blank()
    const root = this.value()
    this.blank()
    const ok = !this.bad && root >= 0 && this.pos === toI32(src.length)
    this.src = []
    this.stack = []
    return ok ? root : -1
  }

  // ---- Reading ----

  blank(): void {
    let c = jsonByteAt(this.src, this.pos)
    while (c === 32 || c === 9 || c === 10 || c === 13) {
      this.pos += 1
      c = jsonByteAt(this.src, this.pos)
    }
  }

  /** A new value of `kind`; -1 past the cap. */
  add(kind: i32, off: i32, len: i32): i32 {
    if (this.kinds.length >= CJ_MAX_VALUES) {
      this.bad = true
      return -1
    }
    this.kinds.push(kind)
    this.offs.push(off)
    this.lens.push(len)
    return toI32(this.kinds.length) - 1
  }

  /** Whether the bytes at `pos` spell `word`, stepping past them when they do. */
  word(word: string): boolean {
    for (let i = 0; i < word.length; i++) {
      if (jsonByteAt(this.src, this.pos + i) !== toI32(word.charCodeAt(i))) {
        return false
      }
    }
    this.pos += toI32(word.length)
    return true
  }

  value(): i32 {
    const c = jsonByteAt(this.src, this.pos)
    if (c === 123 || c === 91) {
      return this.container(c === 123)
    }
    if (c === 34) {
      return this.str()
    }
    if (c === 45 || (c >= 48 && c <= 57)) {
      return this.number()
    }
    if (this.word("true")) {
      return this.add(CJ_BOOLEAN, 1, 0)
    }
    if (this.word("false")) {
      return this.add(CJ_BOOLEAN, 0, 0)
    }
    if (this.word("null")) {
      return this.add(CJ_NULL, 0, 0)
    }
    this.bad = true
    return -1
  }

  /** Steps over digits; how many there were. */
  digits(): i32 {
    let n = 0
    let c = jsonByteAt(this.src, this.pos)
    while (c >= 48 && c <= 57) {
      this.pos += 1
      n++
      c = jsonByteAt(this.src, this.pos)
    }
    return n
  }

  number(): i32 {
    const start = this.pos
    if (jsonByteAt(this.src, this.pos) === 45) {
      this.pos += 1
    }
    if (jsonByteAt(this.src, this.pos) === 48) {
      this.pos += 1
    } else if (this.digits() === 0) {
      this.bad = true
      return -1
    }
    if (jsonByteAt(this.src, this.pos) === 46) {
      this.pos += 1
      if (this.digits() === 0) {
        this.bad = true
        return -1
      }
    }
    const e = jsonByteAt(this.src, this.pos)
    if (e === 101 || e === 69) {
      this.pos += 1
      const sign = jsonByteAt(this.src, this.pos)
      if (sign === 43 || sign === 45) {
        this.pos += 1
      }
      if (this.digits() === 0) {
        this.bad = true
        return -1
      }
    }
    const off = toI32(this.text.length)
    for (let p = start; p < this.pos; p++) {
      this.text.push(toU8(jsonByteAt(this.src, p)))
    }
    return this.add(CJ_NUMBER, off, this.pos - start)
  }

  /** Four hex digits at `pos`, or -1. */
  hex4(): i32 {
    let v = 0
    for (let i = 0; i < 4; i++) {
      const d = jsonHexValue(jsonByteAt(this.src, this.pos))
      if (d < 0) {
        return -1
      }
      v = v * 16 + d
      this.pos += 1
    }
    return v
  }

  /** Appends code point `cp` to `text` as UTF-8. */
  utf8(cp: i32): void {
    if (cp < 128) {
      this.text.push(toU8(cp))
    } else if (cp < 2048) {
      this.text.push(toU8(192 | (cp >> 6)))
      this.text.push(toU8(128 | (cp & 63)))
    } else if (cp < 65536) {
      this.text.push(toU8(224 | (cp >> 12)))
      this.text.push(toU8(128 | ((cp >> 6) & 63)))
      this.text.push(toU8(128 | (cp & 63)))
    } else {
      this.text.push(toU8(240 | (cp >> 18)))
      this.text.push(toU8(128 | ((cp >> 12) & 63)))
      this.text.push(toU8(128 | ((cp >> 6) & 63)))
      this.text.push(toU8(128 | (cp & 63)))
    }
  }

  /** The escape after a backslash at `pos`, appended to `text`; false when it is not one. */
  escape(): boolean {
    const c = jsonByteAt(this.src, this.pos)
    this.pos += 1
    if (c === 34 || c === 92 || c === 47) {
      this.text.push(toU8(c))
    } else if (c === 98) {
      this.text.push(toU8(8))
    } else if (c === 102) {
      this.text.push(toU8(12))
    } else if (c === 110) {
      this.text.push(toU8(10))
    } else if (c === 114) {
      this.text.push(toU8(13))
    } else if (c === 116) {
      this.text.push(toU8(9))
    } else if (c === 117) {
      let cp = this.hex4()
      if (cp < 0 || (cp >= 56320 && cp < 57344)) {
        return false
      }
      if (cp >= 55296 && cp < 56320) {
        // A high surrogate is half of a pair; the low half must follow.
        if (jsonByteAt(this.src, this.pos) !== 92 || jsonByteAt(this.src, this.pos + 1) !== 117) {
          return false
        }
        this.pos += 2
        const low = this.hex4()
        if (low < 56320 || low >= 57344) {
          return false
        }
        cp = 65536 + ((cp - 55296) << 10) + (low - 56320)
      }
      this.utf8(cp)
    } else {
      return false
    }
    return true
  }

  str(): i32 {
    this.pos += 1
    const off = toI32(this.text.length)
    let c = jsonByteAt(this.src, this.pos)
    while (c !== 34) {
      if (c < 32) {
        // The end of the input (-1) or a control byte, which JSON escapes.
        this.bad = true
        return -1
      }
      this.pos += 1
      if (c === 92) {
        if (!this.escape()) {
          this.bad = true
          return -1
        }
      } else {
        this.text.push(toU8(c))
      }
      c = jsonByteAt(this.src, this.pos)
    }
    this.pos += 1
    return this.add(CJ_STRING, off, toI32(this.text.length) - off)
  }

  container(isObject: boolean): i32 {
    this.depth += 1
    if (this.depth > CJ_MAX_DEPTH) {
      this.bad = true
      return -1
    }
    this.pos += 1
    const close = isObject ? 125 : 93
    const base = toI32(this.stack.length)
    this.blank()
    let more = jsonByteAt(this.src, this.pos) !== close
    while (more && !this.bad) {
      if (isObject) {
        if (jsonByteAt(this.src, this.pos) !== 34) {
          this.bad = true
          return -1
        }
        this.stack.push(this.str())
        this.blank()
        if (jsonByteAt(this.src, this.pos) !== 58) {
          this.bad = true
          return -1
        }
        this.pos += 1
        this.blank()
      }
      this.stack.push(this.value())
      this.blank()
      const c = jsonByteAt(this.src, this.pos)
      if (c === 44) {
        this.pos += 1
        this.blank()
      } else if (c !== close) {
        this.bad = true
        return -1
      }
      more = c === 44
    }
    if (this.bad) {
      return -1
    }
    this.pos += 1
    this.depth -= 1
    const off = toI32(this.kids.length)
    let n = 0
    for (let j = base; j >= 0 && j < this.stack.length; j++) {
      this.kids.push(this.stack[j])
      n++
    }
    while (this.stack.length > base) {
      this.stack.pop()
    }
    return this.add(isObject ? CJ_OBJECT : CJ_ARRAY, off, isObject ? n >> 1 : n)
  }

  // ---- Asking ----

  /** The kind of `v`, or 0 for none. */
  kind(v: i32): i32 {
    return v >= 0 && v < this.kinds.length ? this.kinds[v] : 0
  }

  off(v: i32): i32 {
    return v >= 0 && v < this.offs.length ? this.offs[v] : 0
  }

  len(v: i32): i32 {
    return v >= 0 && v < this.lens.length ? this.lens[v] : 0
  }

  kid(j: i32): i32 {
    return j >= 0 && j < this.kids.length ? this.kids[j] : -1
  }

  /** How many members container `v` has; 0 for anything else. */
  length(v: i32): i32 {
    const k = this.kind(v)
    return k === CJ_ARRAY || k === CJ_OBJECT ? this.len(v) : 0
  }

  /** Member `i` of array `v`, or value `i` of object `v`; -1 when there is none. */
  at(v: i32, i: i32): i32 {
    const k = this.kind(v)
    if (i < 0 || i >= this.length(v)) {
      return -1
    }
    return this.kid(this.off(v) + (k === CJ_OBJECT ? i * 2 + 1 : i))
  }

  /** The handle of key `i` of object `v`, or -1. */
  keyHandle(v: i32, i: i32): i32 {
    if (this.kind(v) !== CJ_OBJECT || i < 0 || i >= this.len(v)) {
      return -1
    }
    return this.kid(this.off(v) + i * 2)
  }

  /** Key `i` of object `v`, or empty. */
  keyAt(v: i32, i: i32): string {
    return this.string(this.keyHandle(v, i))
  }

  /** Whether key `i` of object `v` is `s`. Allocates nothing. */
  keyIs(v: i32, i: i32, s: string): boolean {
    return this.stringEquals(this.keyHandle(v, i), s)
  }

  /** The value object `v` holds under `key`, or -1. */
  get(v: i32, key: string): i32 {
    if (this.kind(v) !== CJ_OBJECT) {
      return -1
    }
    const n = this.len(v)
    for (let i = 0; i < n; i++) {
      if (this.keyIs(v, i, key)) {
        return this.at(v, i)
      }
    }
    return -1
  }

  /** String `v`'s decoded text, or empty for anything else. */
  string(v: i32): string {
    if (this.kind(v) !== CJ_STRING) {
      return ""
    }
    const off = this.off(v)
    return String.fromBytes(this.text, off, off + this.len(v))
  }

  /** Whether `v` is a string whose decoded bytes are `s`'s. Allocates nothing. */
  stringEquals(v: i32, s: string): boolean {
    if (this.kind(v) !== CJ_STRING || this.len(v) !== s.length) {
      return false
    }
    const off = this.off(v)
    for (let i = 0; i < s.length; i++) {
      if (jsonByteAt(this.text, off + i) !== toI32(s.charCodeAt(i))) {
        return false
      }
    }
    return true
  }

  /** Whether string `v` ends with `s`. Allocates nothing. */
  stringEndsWith(v: i32, s: string): boolean {
    const n = this.len(v)
    if (this.kind(v) !== CJ_STRING || n < s.length) {
      return false
    }
    const off = this.off(v) + n - toI32(s.length)
    for (let i = 0; i < s.length; i++) {
      if (jsonByteAt(this.text, off + i) !== toI32(s.charCodeAt(i))) {
        return false
      }
    }
    return true
  }

  /** Boolean `v`'s value; false for anything else. */
  boolean(v: i32): boolean {
    return this.kind(v) === CJ_BOOLEAN && this.off(v) === 1
  }

  /** Number `v`'s text, or empty. */
  numberText(v: i32): string {
    if (this.kind(v) !== CJ_NUMBER) {
      return ""
    }
    const off = this.off(v)
    return String.fromBytes(this.text, off, off + this.len(v))
  }

  /** Number `v` when it is a decimal integer that fits an `i32`, else -1. Allocates nothing. */
  smallInt(v: i32): i32 {
    if (this.kind(v) !== CJ_NUMBER) {
      return -1
    }
    const off = this.off(v)
    const n = this.len(v)
    let x = 0
    for (let i = 0; i < n; i++) {
      const c = jsonByteAt(this.text, off + i)
      if (c < 48 || c > 57 || x > 214748363) {
        return -1
      }
      x = x * 10 + (c - 48)
    }
    return x
  }
}
