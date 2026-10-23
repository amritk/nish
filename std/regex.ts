/**
 * `nish/regex` — regular expressions whose matching time is linear in the
 * input, whatever the pattern.
 *
 *     import { Regex, RegexMatch, regexCompile } from "nish/regex";
 *
 *     const compiled = regexCompile("(?<year>\\d{4})-(?<month>\\d{2})", "")
 *     if (compiled.isErr()) {
 *       // compiled.error is the reason, such as "regex: missing ) at byte 0"
 *     } else {
 *       const re: Regex = compiled.value
 *       const m: RegexMatch = new RegexMatch()
 *       if (re.exec("due 2026-10", 0, m)) {
 *         // m.start() 4, m.end() 11, m.named("month") "10"
 *       }
 *       re.replaceAll("2026-10 and 2027-01", "$<month>/$<year>")  // "10/2026 and 01/2027"
 *     }
 *
 * **The syntax is JavaScript's**, with the `u` flag's strictness: literals,
 * `.`, classes `[a-z]` and `[^…]`, `\d \w \s` and their negations, `\b \B ^
 * $`, groups `(…)`, `(?:…)` and `(?<name>…)`, `|`, and the quantifiers `* + ?
 * {n} {n,} {n,m}` with their lazy `?` forms. Escapes are `\n \r \t \f \v \0`,
 * `\cX`, `\xHH`, `\uHHHH`, `\u{H…}` and a backslash before any syntax
 * character; a `{`, `}` or `]` that does not belong to a quantifier or a
 * class is an error rather than a literal, so write `\{`. The flags are `i`
 * (ASCII letters only), `m` (`^` and `$` at line terminators) and `s` (`.`
 * matches them too). **Backreferences and
 * lookaround are refused at compile time**: they are what makes a matcher
 * backtrack, and this one never does. A repeat count is at most 1,000 and a
 * pattern at most 100,000 instructions once its repeats are written out.
 *
 * **Matching is a Pike VM**, the construction RE2, Go's `regexp` and Rust's
 * `regex` use: every alternative is followed at once, one step per character,
 * so a match costs O(pattern × input) at worst and `(a+)+$` against a
 * thousand `a`s and a `b` is as quick as `a+$`. Which match is found is the
 * one JavaScript finds — the leftmost, and of those the one the first
 * alternative and the greediest quantifier prefer — and a group inside a
 * quantifier keeps only its last iteration's capture, as in JavaScript. An
 * iteration past a quantifier's minimum that matches empty is rejected, as
 * JavaScript rejects it. One corner differs: where a quantified body that can
 * match empty sits inside another quantifier, the VM follows only one thread
 * per instruction and position, so a group's capture can be a different
 * iteration's than JavaScript's — `(a*?)+?$` on "aa" captures "aa" where
 * JavaScript captures "a". The match's bounds are the same.
 *
 * **Strings are UTF-8 and offsets are bytes**, like `s.length`. The VM steps
 * a code point at a time, so `.` and `[^a]` consume a whole character; a byte
 * that is not part of valid UTF-8 is one character of its own, which no
 * literal and no range matches. `\w`, `\d` and `\b` are ASCII, as they are in
 * JavaScript; `\s` is JavaScript's whitespace, U+FEFF and U+3000 included.
 * After an empty match `findAll`, `replaceAll` and `split` step one character.
 *
 * **What a call costs.** A search allocates nothing: the VM's two thread
 * lists, its capture tables and its stack are allocated once by
 * `regexCompile`. `test` tracks no captures, `findAll`, `split` and a
 * `replace` whose template names no group track only the match's bounds, and
 * only `exec`, `find` and a template with `$1` or `$<name>` pay for every
 * group. A pattern that starts with a literal is searched for with
 * `s.indexOf` before the VM runs, one that starts with one of at most 16
 * ASCII bytes with `indexOfAny`, any other whose first characters are known
 * skips the bytes that cannot start a match with a 128-entry table, and a
 * pattern that is nothing but a literal never starts the VM at all. Because
 * the scratch memory lives in the
 * `Regex`, one `Regex` is used by one thread at a time.
 */

import { indexOfAny } from "nish/text"

/** The most instructions a compiled pattern may have. */
export const REGEX_MAX_INSTRUCTIONS: i32 = 100000
/** The largest count `{n}`, `{n,}` or `{n,m}` may give. */
export const REGEX_MAX_REPEAT: i32 = 1000
/** How deeply groups may nest. */
export const REGEX_MAX_DEPTH: i32 = 250
/** The most entries one thread list's capture table may have: instructions × slots per thread. */
const REGEX_MAX_SLOT_TABLE: i32 = 4194304

// Instructions. Each is an opcode with up to two operands, `ia` and `ib`.
/** Consume a code point equal to `ia` or `ib` (its other case under `i`). */
const OP_CHAR: i32 = 0
/** Consume a code point in class `ia`. */
const OP_CLASS: i32 = 1
/** Consume any code point. */
const OP_ANY: i32 = 2
/** Consume any code point but a line terminator. */
const OP_ANY_NL: i32 = 3
/** Go on at `ia` and, at lower priority, at `ib`. */
const OP_SPLIT: i32 = 4
/** Go on at `ia`. */
const OP_JMP: i32 = 5
/** Record the position in slot `ia`. */
const OP_SAVE: i32 = 6
/** Reset slots `[ia, ib)`: a quantified group's captures, at each iteration. */
const OP_CLEAR: i32 = 7
/** Go on only where assertion `ia` holds. */
const OP_ASSERT: i32 = 8
/** The pattern has matched. */
const OP_MATCH: i32 = 9
/** Record where an optional iteration starts, in slot `ia`. */
const OP_MARK: i32 = 10
/** Go on only if the iteration that slot `ia` marked consumed something. */
const OP_CHECK: i32 = 11

/**
 * An operand an instruction or node does not use, or one patched later. The
 * constants are named, not bare `0` and `-1`, because under `--number-mode f64`
 * a bare literal argument or `push` is an `f64`.
 */
const REGEX_NIL: i32 = 0
/** No node, instruction or mark: the end of a list, or a field not yet set. */
const REGEX_NONE: i32 = -1
/** Group 0, the whole match, whose bounds are slots 0 and 1. */
const REGEX_WHOLE: i32 = 0
/** The program's first instruction. */
const REGEX_ENTRY: i32 = 0
/** A text's first byte. */
const REGEX_TEXT_START: i32 = 0
/** The nesting depth of the pattern's outermost alternation. */
const REGEX_TOP: i32 = 0
/** `run` asked only whether there is a match, or for its bounds as well. */
const REGEX_WANT_NONE: i32 = 0
const REGEX_WANT_BOUNDS: i32 = 2
/** The digits of `\xHH` and of `\uHHHH`. */
const REGEX_HEX_BYTE: i32 = 2
const REGEX_HEX_UNIT: i32 = 4

const ASSERT_BEGIN_TEXT: i32 = 0
const ASSERT_END_TEXT: i32 = 1
const ASSERT_BEGIN_LINE: i32 = 2
const ASSERT_END_LINE: i32 = 3
const ASSERT_WORD: i32 = 4
const ASSERT_NOT_WORD: i32 = 5

// The parsed pattern's nodes.
const NODE_EMPTY: i32 = 0
const NODE_CHAR: i32 = 1
const NODE_CLASS: i32 = 2
const NODE_ANY: i32 = 3
const NODE_ASSERT: i32 = 4
const NODE_CAT: i32 = 5
const NODE_ALT: i32 = 6
const NODE_GROUP: i32 = 7
const NODE_REPEAT: i32 = 8

// The escapes that stand for a set: `\d`, `\w`, `\s`.
const SET_DIGIT: i32 = 0
const SET_WORD: i32 = 1
const SET_SPACE: i32 = 2

/** The highest code point. */
const REGEX_MAX_CP: i32 = 0x10ffff
/** A byte `b` that is not part of valid UTF-8 is the character `REGEX_INVALID + b`, which nothing written in a pattern equals. */
const REGEX_INVALID: i32 = 0x110000

/** The other case of an ASCII letter, and any other code point itself. */
const regexOtherCase = (c: i32): i32 => {
  if (c >= 97 && c <= 122) {
    return c - 32
  }
  if (c >= 65 && c <= 90) {
    return c + 32
  }
  return c
}

/** Whether `b` is an ASCII word byte, `[A-Za-z0-9_]`, as `\w` and `\b` read it. */
const isRegexWordByte = (b: i32): boolean =>
  (b >= 97 && b <= 122) || (b >= 65 && b <= 90) || (b >= 48 && b <= 57) || b === 95

/** The value of hex digit `c`, or -1. */
const regexHexValue = (c: i32): i32 => {
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

/**
 * The code point at byte `p` of `text`, packed as `cp * 8 + width`. `p` is
 * below `len`. A byte that does not start a valid UTF-8 sequence — a stray
 * continuation byte, an overlong form, a surrogate, a truncated sequence — is
 * one character, `REGEX_INVALID + byte`, of width 1.
 */
const regexDecodeAt = (text: string, p: i32, len: i32): i32 => {
  const b0: i32 = toI32(text.charCodeAt(p))
  if (b0 < 0x80) {
    return b0 * 8 + 1
  }
  const invalid: i32 = (REGEX_INVALID + (b0 & 0xff)) * 8 + 1
  if (b0 < 0xc2 || b0 > 0xf4) {
    return invalid
  }
  if (p + 1 >= len) {
    return invalid
  }
  const b1: i32 = toI32(text.charCodeAt(p + 1))
  if ((b1 & 0xc0) !== 0x80) {
    return invalid
  }
  if (b0 < 0xe0) {
    return (((b0 & 0x1f) << 6) | (b1 & 0x3f)) * 8 + 2
  }
  if (
    (b0 === 0xe0 && b1 < 0xa0) ||
    (b0 === 0xed && b1 >= 0xa0) ||
    (b0 === 0xf0 && b1 < 0x90) ||
    (b0 === 0xf4 && b1 >= 0x90)
  ) {
    return invalid
  }
  if (p + 2 >= len) {
    return invalid
  }
  const b2: i32 = toI32(text.charCodeAt(p + 2))
  if ((b2 & 0xc0) !== 0x80) {
    return invalid
  }
  if (b0 < 0xf0) {
    return (((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f)) * 8 + 3
  }
  if (p + 3 >= len) {
    return invalid
  }
  const b3: i32 = toI32(text.charCodeAt(p + 3))
  if ((b3 & 0xc0) !== 0x80) {
    return invalid
  }
  return (((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)) * 8 + 4
}

/** How many bytes the character at `p` takes: 1 at or past the end. */
const regexWidthAt = (text: string, p: i32, len: i32): i32 => {
  if (p >= len) {
    return 1
  }
  return regexDecodeAt(text, p, len) & 7
}

/** Append the UTF-8 encoding of `cp` to `out`. */
const regexPushUtf8 = (out: u8[], cp: i32): void => {
  if (cp < 0x80) {
    out.push(toU8(cp))
  } else if (cp < 0x800) {
    out.push(toU8((cp >> 6) | 0xc0))
    out.push(toU8((cp & 0x3f) | 0x80))
  } else if (cp < 0x10000) {
    out.push(toU8((cp >> 12) | 0xe0))
    out.push(toU8(((cp >> 6) & 0x3f) | 0x80))
    out.push(toU8((cp & 0x3f) | 0x80))
  } else {
    out.push(toU8((cp >> 18) | 0xf0))
    out.push(toU8(((cp >> 12) & 0x3f) | 0x80))
    out.push(toU8(((cp >> 6) & 0x3f) | 0x80))
    out.push(toU8((cp & 0x3f) | 0x80))
  }
}

/**
 * The pattern read into a tree of nodes, and its classes built.
 *
 * A node is an index into the parallel arrays: `kind`, three operands, the
 * group range a repeat clears, its first child and its next sibling. A
 * class is 128 bytes of `clsAscii` — membership of each ASCII code point,
 * negation already applied — and a sorted, merged run of non-ASCII ranges
 * `[clsFrom, clsTo)` in `clsLo` / `clsHi`, read through `clsNeg`.
 */
class RegexParser {
  // Widest first, so the alignment rules insert no padding.
  src: string
  error: string

  kind: i32[]
  na: i32[]
  nb: i32[]
  nc: i32[]
  nd: i32[]
  ne: i32[]
  kid: i32[]
  next: i32[]

  names: string[]

  clsAscii: u8[]
  clsLo: i32[]
  clsHi: i32[]
  clsFrom: i32[]
  clsTo: i32[]
  clsNeg: u8[]
  /** The class being parsed: its ranges, unsorted, `tmpCount` of them. */
  tmpLo: i32[]
  tmpHi: i32[]

  len: i32
  pos: i32
  errorAt: i32
  /** Capture groups, the whole match (group 0) included. */
  groups: i32
  tmpCount: i32
  /** What `parseBraces` read. */
  qMin: i32
  qMax: i32

  icase: boolean
  multiline: boolean
  dotAll: boolean
  failed: boolean
  hasNames: boolean

  constructor(src: string, icase: boolean, multiline: boolean, dotAll: boolean) {
    this.src = src
    this.len = toI32(src.length)
    this.pos = 0
    this.icase = icase
    this.multiline = multiline
    this.dotAll = dotAll
    this.failed = false
    this.error = ""
    this.errorAt = 0
    this.kind = []
    this.na = []
    this.nb = []
    this.nc = []
    this.nd = []
    this.ne = []
    this.kid = []
    this.next = []
    this.groups = 1
    this.names = [""]
    this.hasNames = false
    this.clsAscii = []
    this.clsLo = []
    this.clsHi = []
    this.clsFrom = []
    this.clsTo = []
    this.clsNeg = []
    this.tmpLo = []
    this.tmpHi = []
    this.tmpCount = 0
    this.qMin = 0
    this.qMax = 0
  }

  fail(message: string, at: i32): i32 {
    if (!this.failed) {
      this.failed = true
      this.error = message
      this.errorAt = at
    }
    return -1
  }

  byteAt(i: i32): i32 {
    return toI32(this.src.charCodeAt(i))
  }

  node(kind: i32, a: i32, b: i32): i32 {
    const n: i32 = toI32(this.kind.length)
    this.kind.push(kind)
    this.na.push(a)
    this.nb.push(b)
    this.nc.push(REGEX_NIL)
    this.nd.push(REGEX_NIL)
    this.ne.push(REGEX_NIL)
    this.kid.push(REGEX_NONE)
    this.next.push(REGEX_NONE)
    return n
  }

  /** A node for code point `cp`, with its other case under `i`. */
  charNode(cp: i32): i32 {
    if (this.icase) {
      return this.node(NODE_CHAR, cp, regexOtherCase(cp))
    }
    return this.node(NODE_CHAR, cp, cp)
  }

  /** `alternative ('|' alternative)*`. */
  parseAlt(depth: i32): i32 {
    if (depth > REGEX_MAX_DEPTH) {
      return this.fail("groups nest too deeply", this.pos)
    }
    const first: i32 = this.parseSeq(depth)
    if (this.failed) {
      return -1
    }
    if (!(this.pos < this.len && this.byteAt(this.pos) === 124)) {
      return first
    }
    const alt: i32 = this.node(NODE_ALT, REGEX_NIL, REGEX_NIL)
    this.kid[alt] = first
    let last: i32 = first
    while (this.pos < this.len && this.byteAt(this.pos) === 124) {
      this.pos += 1
      const n: i32 = this.parseSeq(depth)
      if (this.failed) {
        return -1
      }
      this.next[last] = n
      last = n
    }
    return alt
  }

  /** The terms up to a `|`, a `)` or the end. */
  parseSeq(depth: i32): i32 {
    let first: i32 = -1
    let last: i32 = -1
    let count: i32 = 0
    while (this.pos < this.len) {
      const c: i32 = this.byteAt(this.pos)
      if (c === 124 || c === 41) {
        break
      }
      const t: i32 = this.parseTerm(depth)
      if (this.failed) {
        return -1
      }
      if (first === -1) {
        first = t
      } else {
        this.next[last] = t
      }
      last = t
      count += 1
    }
    if (count === 0) {
      return this.node(NODE_EMPTY, REGEX_NIL, REGEX_NIL)
    }
    if (count === 1) {
      return first
    }
    const cat: i32 = this.node(NODE_CAT, REGEX_NIL, REGEX_NIL)
    this.kid[cat] = first
    return cat
  }

  /** An atom and at most one quantifier. */
  parseTerm(depth: i32): i32 {
    const groupsBefore: i32 = this.groups
    const atomAt: i32 = this.pos
    const atom: i32 = this.parseAtom(depth)
    if (this.failed || this.pos >= this.len) {
      return atom
    }
    const c: i32 = this.byteAt(this.pos)
    let min: i32 = 0
    let max: i32 = 0
    if (c === 42) {
      max = -1
      this.pos += 1
    } else if (c === 43) {
      min = 1
      max = -1
      this.pos += 1
    } else if (c === 63) {
      max = 1
      this.pos += 1
    } else if (c === 123 && this.parseBraces()) {
      if (this.failed) {
        return -1
      }
      min = this.qMin
      max = this.qMax
    } else {
      return atom
    }
    if (this.kind[atom] === NODE_ASSERT) {
      return this.fail("nothing to repeat", atomAt)
    }
    let greedy: i32 = 1
    if (this.pos < this.len && this.byteAt(this.pos) === 63) {
      greedy = 0
      this.pos += 1
    }
    if (this.pos < this.len) {
      const at: i32 = this.pos
      const d: i32 = this.byteAt(at)
      if (d === 42 || d === 43 || d === 63 || (d === 123 && this.parseBraces())) {
        return this.fail("nothing to repeat", at)
      }
    }
    const r: i32 = this.node(NODE_REPEAT, min, max)
    this.nc[r] = greedy
    this.nd[r] = groupsBefore
    this.ne[r] = this.groups
    this.kid[r] = atom
    return r
  }

  /**
   * At a `{`: whether `{n}`, `{n,}` or `{n,m}` follows, and if so its bounds
   * in `qMin` / `qMax` (-1 unbounded) with the cursor past it. Anything else
   * leaves the cursor where it was.
   */
  parseBraces(): boolean {
    let i: i32 = this.pos + 1
    const start: i32 = this.pos
    let min: i32 = 0
    let digits: i32 = 0
    while (i < this.len && this.byteAt(i) >= 48 && this.byteAt(i) <= 57) {
      if (min <= REGEX_MAX_REPEAT) {
        min = min * 10 + (this.byteAt(i) - 48)
      }
      digits += 1
      i += 1
    }
    if (digits === 0 || i >= this.len) {
      return false
    }
    let max: i32 = min
    if (this.byteAt(i) === 44) {
      i += 1
      max = -1
      let maxDigits: i32 = 0
      let m: i32 = 0
      while (i < this.len && this.byteAt(i) >= 48 && this.byteAt(i) <= 57) {
        if (m <= REGEX_MAX_REPEAT) {
          m = m * 10 + (this.byteAt(i) - 48)
        }
        maxDigits += 1
        i += 1
      }
      if (maxDigits > 0) {
        max = m
      }
    }
    if (i >= this.len || this.byteAt(i) !== 125) {
      return false
    }
    this.pos = i + 1
    if (min > REGEX_MAX_REPEAT || max > REGEX_MAX_REPEAT) {
      this.fail("a repeat count is over 1000", start)
      return true
    }
    if (max !== -1 && max < min) {
      this.fail("numbers out of order in {} quantifier", start)
      return true
    }
    this.qMin = min
    this.qMax = max
    return true
  }

  parseAtom(depth: i32): i32 {
    const c: i32 = this.byteAt(this.pos)
    if (c === 40) {
      return this.parseGroup(depth)
    }
    if (c === 91) {
      return this.parseClass()
    }
    if (c === 46) {
      this.pos += 1
      return this.node(NODE_ANY, REGEX_NIL, REGEX_NIL)
    }
    if (c === 94) {
      this.pos += 1
      return this.node(NODE_ASSERT, this.multiline ? ASSERT_BEGIN_LINE : ASSERT_BEGIN_TEXT, REGEX_NIL)
    }
    if (c === 36) {
      this.pos += 1
      return this.node(NODE_ASSERT, this.multiline ? ASSERT_END_LINE : ASSERT_END_TEXT, REGEX_NIL)
    }
    if (c === 92) {
      return this.parseEscape()
    }
    if (c === 42 || c === 43 || c === 63) {
      return this.fail("nothing to repeat", this.pos)
    }
    if (c === 123) {
      const at: i32 = this.pos
      if (this.parseBraces()) {
        return this.fail("nothing to repeat", at)
      }
      return this.fail("lone quantifier bracket", at)
    }
    if (c === 125) {
      return this.fail("lone quantifier bracket", this.pos)
    }
    if (c === 93) {
      return this.fail("lone ]", this.pos)
    }
    const packed: i32 = regexDecodeAt(this.src, this.pos, this.len)
    if (packed >> 3 >= REGEX_INVALID) {
      return this.fail("the pattern is not valid UTF-8", this.pos)
    }
    this.pos += packed & 7
    return this.charNode(packed >> 3)
  }

  parseGroup(depth: i32): i32 {
    const open: i32 = this.pos
    this.pos += 1
    let capture: boolean = true
    let name: string = ""
    if (this.pos < this.len && this.byteAt(this.pos) === 63) {
      const k: i32 = this.pos + 1 < this.len ? this.byteAt(this.pos + 1) : -1
      if (k === 58) {
        capture = false
        this.pos += 2
      } else if (k === 61 || k === 33) {
        return this.fail("lookahead is not supported", open)
      } else if (k === 60) {
        const k2: i32 = this.pos + 2 < this.len ? this.byteAt(this.pos + 2) : -1
        if (k2 === 61 || k2 === 33) {
          return this.fail("lookbehind is not supported", open)
        }
        const nameAt: i32 = this.pos + 2
        let i: i32 = nameAt
        while (i < this.len && this.byteAt(i) !== 62) {
          const b: i32 = this.byteAt(i)
          const first: boolean = (b >= 97 && b <= 122) || (b >= 65 && b <= 90) || b === 95 || b === 36
          if (!(first || (i > nameAt && b >= 48 && b <= 57))) {
            return this.fail("invalid group name", nameAt)
          }
          i += 1
        }
        if (i >= this.len || i === nameAt) {
          return this.fail("invalid group name", nameAt)
        }
        name = this.src.slice(nameAt, i)
        if (this.names.indexOf(name) >= 0) {
          return this.fail("duplicate group name", nameAt)
        }
        this.pos = i + 1
      } else {
        return this.fail("unsupported group syntax", open)
      }
    }
    let index: i32 = 0
    if (capture) {
      index = this.groups
      this.groups += 1
      this.names.push(name)
      if (name !== "") {
        this.hasNames = true
      }
    }
    const inner: i32 = this.parseAlt(depth + 1)
    if (this.failed) {
      return -1
    }
    if (this.pos >= this.len || this.byteAt(this.pos) !== 41) {
      return this.fail("missing )", open)
    }
    this.pos += 1
    if (!capture) {
      return inner
    }
    const g: i32 = this.node(NODE_GROUP, index, REGEX_NIL)
    this.kid[g] = inner
    return g
  }

  /** A `\` outside a class. */
  parseEscape(): i32 {
    const at: i32 = this.pos
    this.pos += 1
    if (this.pos >= this.len) {
      return this.fail("\\ at end of pattern", at)
    }
    const c: i32 = this.byteAt(this.pos)
    if (c === 100 || c === 68 || c === 119 || c === 87 || c === 115 || c === 83) {
      this.pos += 1
      this.tmpCount = 0
      this.addSet(c)
      return this.finishClass(false)
    }
    if (c === 98) {
      this.pos += 1
      return this.node(NODE_ASSERT, ASSERT_WORD, REGEX_NIL)
    }
    if (c === 66) {
      this.pos += 1
      return this.node(NODE_ASSERT, ASSERT_NOT_WORD, REGEX_NIL)
    }
    if ((c >= 49 && c <= 57) || c === 107) {
      return this.fail("backreferences are not supported", at)
    }
    const cp: i32 = this.parseCharEscape(false)
    if (this.failed) {
      return -1
    }
    return this.charNode(cp)
  }

  /**
   * The code point an escape stands for, the cursor on the byte after the
   * `\`. Shared by escapes inside and outside a class; inside one, `\b` is a
   * backspace and `\-` a hyphen.
   */
  parseCharEscape(inClass: boolean): i32 {
    const at: i32 = this.pos - 1
    const c: i32 = this.byteAt(this.pos)
    this.pos += 1
    if (c === 110) {
      return 10
    }
    if (c === 114) {
      return 13
    }
    if (c === 116) {
      return 9
    }
    if (c === 102) {
      return 12
    }
    if (c === 118) {
      return 11
    }
    if (c === 48) {
      if (this.pos < this.len && this.byteAt(this.pos) >= 48 && this.byteAt(this.pos) <= 57) {
        return this.fail("octal escapes are not supported", at)
      }
      return 0
    }
    if (c === 99) {
      if (this.pos < this.len) {
        const l: i32 = this.byteAt(this.pos)
        if ((l >= 97 && l <= 122) || (l >= 65 && l <= 90)) {
          this.pos += 1
          return l % 32
        }
      }
      return this.fail("invalid \\c escape", at)
    }
    if (c === 120) {
      const v: i32 = this.parseHex(REGEX_HEX_BYTE)
      if (v < 0) {
        return this.fail("invalid \\x escape", at)
      }
      return v
    }
    if (c === 117) {
      return this.parseUnicodeEscape(at)
    }
    if (inClass && c === 98) {
      return 8
    }
    if (inClass && c === 45) {
      return 45
    }
    // ^ $ \ . * + ? ( ) [ ] { } | /
    if (
      c === 94 ||
      c === 36 ||
      c === 92 ||
      c === 46 ||
      c === 42 ||
      c === 43 ||
      c === 63 ||
      c === 40 ||
      c === 41 ||
      c === 91 ||
      c === 93 ||
      c === 123 ||
      c === 125 ||
      c === 124 ||
      c === 47
    ) {
      return c
    }
    return this.fail("invalid escape", at)
  }

  /** Exactly `n` hex digits at the cursor, or -1 with the cursor left. */
  parseHex(n: i32): i32 {
    if (this.pos + n > this.len) {
      return -1
    }
    let v: i32 = 0
    let i: i32 = 0
    while (i < n) {
      const h: i32 = regexHexValue(this.byteAt(this.pos + i))
      if (h < 0) {
        return -1
      }
      v = v * 16 + h
      i += 1
    }
    this.pos += n
    return v
  }

  /** `\uHHHH`, a surrogate pair of them, or `\u{H…}`, the cursor after the `u`. */
  parseUnicodeEscape(at: i32): i32 {
    if (this.pos < this.len && this.byteAt(this.pos) === 123) {
      let i: i32 = this.pos + 1
      let v: i32 = 0
      while (i < this.len && regexHexValue(this.byteAt(i)) >= 0) {
        v = v * 16 + regexHexValue(this.byteAt(i))
        if (v > REGEX_MAX_CP) {
          return this.fail("invalid \\u escape", at)
        }
        i += 1
      }
      if (i === this.pos + 1 || i >= this.len || this.byteAt(i) !== 125) {
        return this.fail("invalid \\u escape", at)
      }
      this.pos = i + 1
      return v
    }
    const v: i32 = this.parseHex(REGEX_HEX_UNIT)
    if (v < 0) {
      return this.fail("invalid \\u escape", at)
    }
    if (
      v >= 0xd800 &&
      v <= 0xdbff &&
      this.pos + 6 <= this.len &&
      this.byteAt(this.pos) === 92 &&
      this.byteAt(this.pos + 1) === 117
    ) {
      const save: i32 = this.pos
      this.pos += 2
      const lo: i32 = this.parseHex(REGEX_HEX_UNIT)
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        return ((v - 0xd800) << 10) + (lo - 0xdc00) + 0x10000
      }
      this.pos = save
    }
    return v
  }

  addRange(lo: i32, hi: i32): void {
    if (this.tmpCount < toI32(this.tmpLo.length)) {
      this.tmpLo[this.tmpCount] = lo
      this.tmpHi[this.tmpCount] = hi
    } else {
      this.tmpLo.push(lo)
      this.tmpHi.push(hi)
    }
    this.tmpCount += 1
  }

  /**
   * Add the ranges of `\d`, `\w`, `\s` or their capitals — `letter` is the
   * escape's letter — to the class being parsed. A capital adds the complement, the
   * gaps between the set's sorted ranges.
   */
  addSet(letter: i32): void {
    const negate: boolean = letter === 68 || letter === 87 || letter === 83
    const lower: i32 = negate ? letter + 32 : letter
    let set: i32 = SET_SPACE
    if (lower === 100) {
      set = SET_DIGIT
    } else if (lower === 119) {
      set = SET_WORD
    }
    // The set's ranges, in order, as lo/hi pairs.
    const r: i32[] = []
    if (set === SET_DIGIT) {
      r.push(48)
      r.push(57)
    } else if (set === SET_WORD) {
      r.push(48)
      r.push(57)
      r.push(65)
      r.push(90)
      r.push(95)
      r.push(95)
      r.push(97)
      r.push(122)
    } else {
      r.push(9)
      r.push(13)
      r.push(32)
      r.push(32)
      r.push(0xa0)
      r.push(0xa0)
      r.push(0x1680)
      r.push(0x1680)
      r.push(0x2000)
      r.push(0x200a)
      r.push(0x2028)
      r.push(0x2029)
      r.push(0x202f)
      r.push(0x202f)
      r.push(0x205f)
      r.push(0x205f)
      r.push(0x3000)
      r.push(0x3000)
      r.push(0xfeff)
      r.push(0xfeff)
    }
    if (!negate) {
      let i: i32 = 0
      while (i >= 0 && i + 1 < toI32(r.length)) {
        this.addRange(r[i], r[i + 1])
        i += 2
      }
      return
    }
    let from: i32 = 0
    let i: i32 = 0
    while (i >= 0 && i + 1 < toI32(r.length)) {
      const lo: i32 = r[i]
      const hi: i32 = r[i + 1]
      if (lo > from) {
        this.addRange(from, lo - 1)
      }
      from = hi + 1
      i += 2
    }
    if (from <= REGEX_MAX_CP) {
      this.addRange(from, REGEX_MAX_CP)
    }
  }

  /** One member of a class: a code point, or -2 once a set escape has added its ranges. */
  parseClassAtom(): i32 {
    const c: i32 = this.byteAt(this.pos)
    if (c === 92) {
      const at: i32 = this.pos
      this.pos += 1
      if (this.pos >= this.len) {
        return this.fail("\\ at end of pattern", at)
      }
      const e: i32 = this.byteAt(this.pos)
      if (e === 100 || e === 68 || e === 119 || e === 87 || e === 115 || e === 83) {
        this.pos += 1
        this.addSet(e)
        return -2
      }
      if ((e >= 49 && e <= 57) || e === 107) {
        return this.fail("backreferences are not supported", at)
      }
      return this.parseCharEscape(true)
    }
    const packed: i32 = regexDecodeAt(this.src, this.pos, this.len)
    if (packed >> 3 >= REGEX_INVALID) {
      return this.fail("the pattern is not valid UTF-8", this.pos)
    }
    this.pos += packed & 7
    return packed >> 3
  }

  /** `[…]` or `[^…]`. */
  parseClass(): i32 {
    const open: i32 = this.pos
    this.pos += 1
    let negated: boolean = false
    if (this.pos < this.len && this.byteAt(this.pos) === 94) {
      negated = true
      this.pos += 1
    }
    this.tmpCount = 0
    while (true) {
      if (this.pos >= this.len) {
        return this.fail("missing ]", open)
      }
      if (this.byteAt(this.pos) === 93) {
        this.pos += 1
        break
      }
      const atAtom: i32 = this.pos
      const lo: i32 = this.parseClassAtom()
      if (this.failed) {
        return -1
      }
      const dash: boolean =
        this.pos + 1 < this.len && this.byteAt(this.pos) === 45 && this.byteAt(this.pos + 1) !== 93
      if (!dash) {
        if (lo >= 0) {
          this.addRange(lo, lo)
        }
        continue
      }
      if (lo === -2) {
        return this.fail("invalid class range", atAtom)
      }
      this.pos += 1
      const hi: i32 = this.parseClassAtom()
      if (this.failed) {
        return -1
      }
      if (hi === -2) {
        return this.fail("invalid class range", atAtom)
      }
      if (hi < lo) {
        return this.fail("class range out of order", atAtom)
      }
      this.addRange(lo, hi)
    }
    // A class of one code point, unnegated, is that code point.
    if (!negated && this.tmpCount === 1 && this.tmpLo[0] === this.tmpHi[0]) {
      return this.charNode(this.tmpLo[0])
    }
    return this.finishClass(negated)
  }

  /** Store the class in `tmpLo` / `tmpHi` and answer its node. */
  finishClass(negated: boolean): i32 {
    const k: i32 = toI32(this.clsFrom.length)
    const base: i32 = toI32(this.clsAscii.length)
    let j: i32 = 0
    while (j < 128) {
      this.clsAscii.push(toU8(0))
      j += 1
    }
    let i: i32 = 0
    while (i < this.tmpCount) {
      const lo: i32 = this.tmpLo[i]
      const hi: i32 = this.tmpHi[i]
      let c: i32 = lo
      while (c <= hi && c < 128) {
        this.clsAscii[base + c] = 1
        c += 1
      }
      i += 1
    }
    if (this.icase) {
      let c: i32 = 65
      while (c <= 90) {
        if (this.clsAscii[base + c] === 1 || this.clsAscii[base + c + 32] === 1) {
          this.clsAscii[base + c] = 1
          this.clsAscii[base + c + 32] = 1
        }
        c += 1
      }
    }
    if (negated) {
      let c: i32 = 0
      while (c < 128) {
        this.clsAscii[base + c] = this.clsAscii[base + c] === 1 ? 0 : 1
        c += 1
      }
    }
    // The non-ASCII ranges, insertion-sorted by their start and merged.
    const from: i32 = toI32(this.clsLo.length)
    i = 0
    while (i < this.tmpCount) {
      let lo: i32 = this.tmpLo[i]
      const hi: i32 = this.tmpHi[i]
      i += 1
      if (hi < 128) {
        continue
      }
      if (lo < 128) {
        lo = 128
      }
      this.clsLo.push(lo)
      this.clsHi.push(hi)
      let m: i32 = toI32(this.clsLo.length) - 1
      while (m > from && this.clsLo[m - 1] > lo) {
        this.clsLo[m] = this.clsLo[m - 1]
        this.clsHi[m] = this.clsHi[m - 1]
        m -= 1
      }
      this.clsLo[m] = lo
      this.clsHi[m] = hi
    }
    // Merge in place, then drop what merging left past the end by copying
    // the merged run back over a fresh tail.
    const end: i32 = toI32(this.clsLo.length)
    let out: i32 = from
    i = from
    while (i < end) {
      const lo: i32 = this.clsLo[i]
      const hi: i32 = this.clsHi[i]
      if (out > from && lo <= this.clsHi[out - 1] + 1) {
        if (hi > this.clsHi[out - 1]) {
          this.clsHi[out - 1] = hi
        }
      } else {
        this.clsLo[out] = lo
        this.clsHi[out] = hi
        out += 1
      }
      i += 1
    }
    this.clsFrom.push(from)
    this.clsTo.push(out)
    this.clsNeg.push(negated ? toU8(1) : toU8(0))
    // The merged ranges past `out` are dead; later classes start after them.
    return this.node(NODE_CLASS, k, REGEX_NIL)
  }
}

/** Whether node `n` can match without consuming anything. */
const regexNullable = (p: RegexParser, n: i32): boolean => {
  const kind: i32 = p.kind[n]
  if (kind === NODE_CHAR || kind === NODE_CLASS || kind === NODE_ANY) {
    return false
  }
  if (kind === NODE_GROUP) {
    return regexNullable(p, p.kid[n])
  }
  if (kind === NODE_REPEAT) {
    return p.na[n] === 0 || regexNullable(p, p.kid[n])
  }
  if (kind === NODE_CAT || kind === NODE_ALT) {
    const all: boolean = kind === NODE_CAT
    let c: i32 = p.kid[n]
    while (c !== -1) {
      if (regexNullable(p, c) !== all) {
        return !all
      }
      c = p.next[c]
    }
    return all
  }
  // NODE_EMPTY and NODE_ASSERT.
  return true
}

/** One match: the input it was found in and the byte offsets of every group. */
export class RegexMatch {
  /** The text that was searched. */
  input: string
  /** `start, end` of group 0, then of each group in order; -1 for a group that took no part. */
  slots: i32[]
  /** Each group's name, "" for an unnamed one. */
  names: string[]

  constructor() {
    this.input = ""
    this.slots = []
    this.names = []
  }

  /** Where the match starts. */
  start(): i32 {
    return this.slots[0]
  }

  /** Where the match ends, one past its last byte. */
  end(): i32 {
    return this.slots[1]
  }

  /** The matched text. */
  text(): string {
    return this.group(REGEX_WHOLE)
  }

  /** How many groups there are, the whole match (group 0) included. */
  groupCount(): i32 {
    return toI32(this.slots.length) / 2
  }

  /** Whether group `k` took part in the match. */
  matched(k: i32): boolean {
    return k >= 0 && k < this.groupCount() && this.slots[2 * k] >= 0
  }

  /** Where group `k` starts, or -1. */
  groupStart(k: i32): i32 {
    return this.matched(k) ? this.slots[2 * k] : -1
  }

  /** Where group `k` ends, or -1. */
  groupEnd(k: i32): i32 {
    return this.matched(k) ? this.slots[2 * k + 1] : -1
  }

  /** Group `k`'s text: "" when it took no part, so test `matched` to tell the two apart. */
  group(k: i32): string {
    if (!this.matched(k)) {
      return ""
    }
    return this.input.slice(this.slots[2 * k], this.slots[2 * k + 1])
  }

  /** The text of the group named `name`; "" when there is none or it took no part. */
  named(name: string): string {
    return this.group(toI32(this.names.indexOf(name)))
  }
}

/**
 * A compiled pattern: its program, its classes, what the prefilters read and
 * the VM's scratch memory. Made by `regexCompile`.
 */
export class Regex {
  // Widest first, so the alignment rules insert no padding.
  /** The pattern as written. */
  readonly source: string
  /** The flags as written. */
  readonly flags: string
  /** Each repeat node's mark slot, or -1 before it has one. */
  markOf: i32[]
  names: string[]

  op: i32[]
  ia: i32[]
  ib: i32[]

  clsAscii: u8[]
  clsLo: i32[]
  clsHi: i32[]
  clsFrom: i32[]
  clsTo: i32[]
  clsNeg: u8[]

  /** The literal every match starts with, or "". */
  prefix: string
  /** The ASCII bytes a match can start with, at most 16 of them, or "". */
  firstBytes: string
  /**
   * Which ASCII bytes a match can start with, when `firstBytes` is too small
   * to say, or empty when any byte can start one.
   */
  firstSet: u8[]

  // Two lists of threads, each with a capture table indexed by pc. A list
  // holds only the threads that wait for a character or have matched, in
  // priority order; the instructions a closure has passed through are in
  // `visit`, stamped with the closure's generation `gen`.
  cDense: i32[]
  cSlots: i32[]
  nDense: i32[]
  nSlots: i32[]
  visit: i32[]
  /** The closure's stack: explore `stkA` (kind 0) or restore slot `stkA` to `stkB` (kind 1). */
  stkKind: i32[]
  stkA: i32[]
  stkB: i32[]
  /** The captures of the thread being followed. */
  caps: i32[]
  /** The best match so far. */
  mslots: i32[]

  /** Capture groups, the whole match included. */
  groups: i32
  /** Slots a thread carries: two per group, then one mark per repeat that can iterate empty. */
  width: i32
  cCount: i32
  nCount: i32
  gen: i32

  hasNames: boolean
  tooBig: boolean
  /** The pattern is `prefix` and nothing else. */
  literal: boolean
  /** The pattern starts with `^` outside multiline mode. */
  anchored: boolean
  /** Whether a byte above ASCII can start a match, when `firstSet` is not empty. */
  firstWide: boolean

  constructor(source: string, flags: string) {
    this.source = source
    this.flags = flags
    this.groups = 1
    this.width = 2
    this.markOf = []
    this.names = []
    this.hasNames = false
    this.op = []
    this.ia = []
    this.ib = []
    this.tooBig = false
    this.clsAscii = []
    this.clsLo = []
    this.clsHi = []
    this.clsFrom = []
    this.clsTo = []
    this.clsNeg = []
    this.prefix = ""
    this.literal = false
    this.anchored = false
    this.firstBytes = ""
    this.firstSet = []
    this.firstWide = false
    this.cDense = []
    this.cSlots = []
    this.cCount = 0
    this.nDense = []
    this.nSlots = []
    this.nCount = 0
    this.visit = []
    this.gen = 0
    this.stkKind = []
    this.stkA = []
    this.stkB = []
    this.caps = []
    this.mslots = []
  }

  /** How many groups there are, the whole match (group 0) included. */
  groupCount(): i32 {
    return this.groups
  }

  /** The number of the group named `name`, or -1. */
  groupIndex(name: string): i32 {
    if (name === "") {
      return -1
    }
    return toI32(this.names.indexOf(name))
  }

  emit(op: i32, a: i32, b: i32): i32 {
    const pc: i32 = toI32(this.op.length)
    if (pc >= REGEX_MAX_INSTRUCTIONS) {
      this.tooBig = true
      return 0
    }
    this.op.push(op)
    this.ia.push(a)
    this.ib.push(b)
    return pc
  }

  pc(): i32 {
    return toI32(this.op.length)
  }

  /** One iteration of a repeat's body: its groups cleared, then the body. */
  compileIteration(p: RegexParser, r: i32): void {
    if (p.ne[r] > p.nd[r]) {
      this.emit(OP_CLEAR, 2 * p.nd[r], 2 * p.ne[r])
    }
    this.compileNode(p, p.kid[r])
  }

  compileNode(p: RegexParser, n: i32): void {
    if (this.tooBig) {
      return
    }
    const kind: i32 = p.kind[n]
    if (kind === NODE_EMPTY) {
      return
    }
    if (kind === NODE_CHAR) {
      this.emit(OP_CHAR, p.na[n], p.nb[n])
      return
    }
    if (kind === NODE_CLASS) {
      this.emit(OP_CLASS, p.na[n], REGEX_NIL)
      return
    }
    if (kind === NODE_ANY) {
      this.emit(p.dotAll ? OP_ANY : OP_ANY_NL, REGEX_NIL, REGEX_NIL)
      return
    }
    if (kind === NODE_ASSERT) {
      this.emit(OP_ASSERT, p.na[n], REGEX_NIL)
      return
    }
    if (kind === NODE_CAT) {
      let c: i32 = p.kid[n]
      while (c !== -1) {
        this.compileNode(p, c)
        c = p.next[c]
      }
      return
    }
    if (kind === NODE_GROUP) {
      this.emit(OP_SAVE, 2 * p.na[n], REGEX_NIL)
      this.compileNode(p, p.kid[n])
      this.emit(OP_SAVE, 2 * p.na[n] + 1, REGEX_NIL)
      return
    }
    if (kind === NODE_ALT) {
      const jumps: i32[] = []
      let c: i32 = p.kid[n]
      while (c !== -1 && !this.tooBig) {
        if (p.next[c] !== -1) {
          const split: i32 = this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL)
          this.ia[split] = this.pc()
          this.compileNode(p, c)
          jumps.push(this.emit(OP_JMP, REGEX_NIL, REGEX_NIL))
          this.ib[split] = this.pc()
        } else {
          this.compileNode(p, c)
        }
        c = p.next[c]
      }
      const exit: i32 = this.pc()
      for (const j of jumps) {
        this.ia[j] = exit
      }
      return
    }
    // NODE_REPEAT
    const min: i32 = p.na[n]
    const max: i32 = p.nb[n]
    const greedy: boolean = p.nc[n] === 1
    if (max !== min && regexNullable(p, p.kid[n])) {
      this.compileEmptyCheckedRepeat(p, n, min, max, greedy)
      return
    }
    if (max === -1 && min === 0) {
      // L: SPLIT body, exit; body; JMP L
      const split: i32 = this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL)
      this.compileIteration(p, n)
      this.emit(OP_JMP, split, REGEX_NIL)
      const exit: i32 = this.pc()
      this.ia[split] = greedy ? split + 1 : exit
      this.ib[split] = greedy ? exit : split + 1
      return
    }
    if (max === -1) {
      // body × (min - 1); L: body; SPLIT L, exit
      let i: i32 = 1
      while (i < min && !this.tooBig) {
        this.compileIteration(p, n)
        i += 1
      }
      const loop: i32 = this.pc()
      this.compileIteration(p, n)
      const split: i32 = this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL)
      this.ia[split] = greedy ? loop : split + 1
      this.ib[split] = greedy ? split + 1 : loop
      return
    }
    // body × min; then (SPLIT next, exit; body) × (max - min)
    let i: i32 = 0
    while (i < min && !this.tooBig) {
      this.compileIteration(p, n)
      i += 1
    }
    const splits: i32[] = []
    i = min
    while (i < max && !this.tooBig) {
      splits.push(this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL))
      this.compileIteration(p, n)
      i += 1
    }
    const exit: i32 = this.pc()
    for (const s of splits) {
      this.ia[s] = greedy ? s + 1 : exit
      this.ib[s] = greedy ? exit : s + 1
    }
  }

  /**
   * A repeat whose body can match empty, which JavaScript iterates by its own
   * rule: an iteration past the minimum that consumes nothing fails, and the
   * search goes on inside that iteration, at its next alternative. A Pike VM
   * left to itself would instead let the empty iteration end the loop, so
   * `(|a)+` on "a" would match "" where JavaScript matches "a". So the
   * mandatory iterations are copies of their own and each optional one is
   * bracketed by a mark of where it started and a check that it moved on.
   *
   *   body × min; L: SPLIT M, exit; M: MARK k; body; CHECK k; JMP L     (unbounded)
   *   body × min; (SPLIT M, exit; M: MARK k; body; CHECK k) × (max - min)
   */
  compileEmptyCheckedRepeat(p: RegexParser, n: i32, min: i32, max: i32, greedy: boolean): void {
    while (toI32(this.markOf.length) <= n) {
      this.markOf.push(REGEX_NONE)
    }
    if (this.markOf[n] < 0) {
      this.markOf[n] = this.width
      this.width += 1
    }
    const k: i32 = this.markOf[n]
    let i: i32 = 0
    while (i < min && !this.tooBig) {
      this.compileIteration(p, n)
      i += 1
    }
    const splits: i32[] = []
    if (max === -1) {
      const split: i32 = this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL)
      splits.push(split)
      this.emit(OP_MARK, k, REGEX_NIL)
      this.compileIteration(p, n)
      this.emit(OP_CHECK, k, REGEX_NIL)
      this.emit(OP_JMP, split, REGEX_NIL)
    } else {
      while (i < max && !this.tooBig) {
        splits.push(this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL))
        this.emit(OP_MARK, k, REGEX_NIL)
        this.compileIteration(p, n)
        this.emit(OP_CHECK, k, REGEX_NIL)
        i += 1
      }
    }
    const exit: i32 = this.pc()
    for (const s of splits) {
      this.ia[s] = greedy ? s + 1 : exit
      this.ib[s] = greedy ? exit : s + 1
    }
  }

  /** Compile the parsed pattern and size the VM. Answers an error, or "". */
  build(p: RegexParser, root: i32): string {
    this.groups = p.groups
    this.width = 2 * p.groups
    this.names = p.names
    this.hasNames = p.hasNames
    this.clsAscii = p.clsAscii
    this.clsLo = p.clsLo
    this.clsHi = p.clsHi
    this.clsFrom = p.clsFrom
    this.clsTo = p.clsTo
    this.clsNeg = p.clsNeg
    this.emit(OP_SAVE, 2 * REGEX_WHOLE, REGEX_NIL)
    this.compileNode(p, root)
    this.emit(OP_SAVE, 2 * REGEX_WHOLE + 1, REGEX_NIL)
    this.emit(OP_MATCH, REGEX_NIL, REGEX_NIL)
    if (this.tooBig) {
      return "the pattern compiles to more than 100000 instructions"
    }
    const count: i32 = this.pc()
    const slots: i32 = this.width
    if (count > REGEX_MAX_SLOT_TABLE / slots) {
      return "too many groups for the pattern's size"
    }
    this.cDense = new Array<i32>(count)
    this.cSlots = new Array<i32>(count * slots)
    this.nDense = new Array<i32>(count)
    this.nSlots = new Array<i32>(count * slots)
    this.visit = new Array<i32>(count)
    this.caps = new Array<i32>(slots)
    this.mslots = new Array<i32>(slots)
    // Each instruction is visited once per closure, and pushes at most one
    // frame, or one per slot it clears.
    let frames: i32 = 1
    let pc: i32 = 0
    while (pc < count) {
      const o: i32 = this.op[pc]
      if (o === OP_SPLIT || o === OP_SAVE || o === OP_MARK) {
        frames += 1
      } else if (o === OP_CLEAR) {
        frames += this.ib[pc] - this.ia[pc]
      }
      pc += 1
    }
    this.stkKind = new Array<i32>(frames)
    this.stkA = new Array<i32>(frames)
    this.stkB = new Array<i32>(frames)
    this.findPrefilters()
    return ""
  }

  /** The literal prefix, whether the pattern is only that literal, the anchor, and the first-byte set. */
  findPrefilters(): void {
    const bytes: u8[] = []
    let pc: i32 = 0
    while (true) {
      const o: i32 = this.op[pc]
      const a: i32 = this.ia[pc]
      if (o === OP_SAVE) {
        pc += 1
        continue
      }
      if (o === OP_CHAR && a === this.ib[pc] && !(a >= 0xd800 && a <= 0xdfff)) {
        regexPushUtf8(bytes, a)
        pc += 1
        continue
      }
      break
    }
    const n: i32 = toI32(bytes.length)
    if (n > 0) {
      this.prefix = String.fromBytes(bytes, 0, n)
      this.literal = this.op[pc] === OP_MATCH && this.groups === 1
    }
    pc = 0
    while (this.op[pc] === OP_SAVE) {
      pc += 1
    }
    this.anchored = this.op[pc] === OP_ASSERT && this.ia[pc] === ASSERT_BEGIN_TEXT
    if (n > 0 || this.anchored) {
      return
    }
    // Every byte a match can start with, if the pattern cannot match empty:
    // the ASCII ones in `set`, and whether any byte above them can.
    const count: i32 = this.pc()
    const seen: u8[] = new Array<u8>(count)
    const set: u8[] = new Array<u8>(128)
    let wide: boolean = false
    const work: i32[] = [0]
    while (toI32(work.length) > 0) {
      // The top of the stack, read before it is popped: `pop` answers
      // `T | undefined` to TypeScript. The test always holds inside the loop
      // and is what proves the index.
      const top: i32 = toI32(work.length) - 1
      if (top < 0 || top >= toI32(work.length)) {
        break
      }
      const at: i32 = work[top]
      work.pop()
      if (at < 0 || at >= toI32(seen.length) || seen[at] === 1) {
        continue
      }
      seen[at] = 1
      const o: i32 = this.op[at]
      if (o === OP_JMP) {
        work.push(this.ia[at])
      } else if (o === OP_SPLIT) {
        work.push(this.ib[at])
        work.push(this.ia[at])
      } else if (o === OP_SAVE || o === OP_CLEAR || o === OP_ASSERT || o === OP_MARK || o === OP_CHECK) {
        work.push(at + 1)
      } else if (o === OP_CHAR) {
        const lower: i32 = this.ia[at]
        const other: i32 = this.ib[at]
        if (lower >= 0 && lower < toI32(set.length)) {
          set[lower] = 1
        } else {
          wide = true
        }
        if (other >= 0 && other < toI32(set.length)) {
          set[other] = 1
        } else {
          wide = true
        }
      } else if (o === OP_CLASS) {
        const k: i32 = this.ia[at]
        if (this.clsNeg[k] === 1 || this.clsTo[k] > this.clsFrom[k]) {
          wide = true
        }
        let c: i32 = 0
        while (c >= 0 && c < toI32(set.length)) {
          if (this.clsAscii[k * 128 + c] === 1) {
            set[c] = 1
          }
          c += 1
        }
      } else {
        // OP_ANY, OP_ANY_NL, or OP_MATCH: an empty match is possible.
        return
      }
    }
    const members: u8[] = []
    let c: i32 = 0
    while (c >= 0 && c < toI32(set.length)) {
      if (set[c] === 1) {
        members.push(toU8(c))
      }
      c += 1
    }
    const m: i32 = toI32(members.length)
    if (!wide && m >= 1 && m <= 16) {
      // The runtime's vector search, which wants a small ASCII set.
      this.firstBytes = String.fromBytes(members, 0, m)
    } else if (!wide || m < 128) {
      this.firstSet = set
      this.firstWide = wide
    }
  }

  /** Whether class `k` holds code point `cp`, which is at least 0. */
  classHas(k: i32, cp: i32): boolean {
    if (cp < 128) {
      return this.clsAscii[k * 128 + cp] === 1
    }
    let lo: i32 = this.clsFrom[k]
    let hi: i32 = this.clsTo[k]
    let found: boolean = false
    while (lo < hi) {
      const mid: i32 = (lo + hi) >> 1
      if (cp < this.clsLo[mid]) {
        hi = mid
      } else if (cp > this.clsHi[mid]) {
        lo = mid + 1
      } else {
        found = true
        break
      }
    }
    return found !== (this.clsNeg[k] === 1)
  }

  /** Whether assertion `kind` holds at byte `p` of `text`. */
  assertHolds(kind: i32, text: string, p: i32, len: i32): boolean {
    if (kind === ASSERT_BEGIN_TEXT) {
      return p === 0
    }
    if (kind === ASSERT_END_TEXT) {
      return p === len
    }
    if (kind === ASSERT_BEGIN_LINE) {
      if (p === 0) {
        return true
      }
      const b: i32 = toI32(text.charCodeAt(p - 1))
      if (b === 10 || b === 13) {
        return true
      }
      // U+2028 and U+2029 end in E2 80 A8 and E2 80 A9.
      return (
        (b === 0xa8 || b === 0xa9) &&
        p >= 3 &&
        toI32(text.charCodeAt(p - 2)) === 0x80 &&
        toI32(text.charCodeAt(p - 3)) === 0xe2
      )
    }
    if (kind === ASSERT_END_LINE) {
      if (p >= len) {
        return true
      }
      const b: i32 = toI32(text.charCodeAt(p))
      if (b === 10 || b === 13) {
        return true
      }
      if (b !== 0xe2 || p + 2 >= len) {
        return false
      }
      const b2: i32 = toI32(text.charCodeAt(p + 2))
      return toI32(text.charCodeAt(p + 1)) === 0x80 && (b2 === 0xa8 || b2 === 0xa9)
    }
    const before: boolean = p > 0 && isRegexWordByte(toI32(text.charCodeAt(p - 1)))
    const after: boolean = p < len && isRegexWordByte(toI32(text.charCodeAt(p)))
    return kind === ASSERT_WORD ? before !== after : before === after
  }

  /** Start a closure that has visited nothing, wrapping the stamps before they overflow. */
  newGeneration(): void {
    if (this.gen >= 2147483647) {
      const count: i32 = toI32(this.visit.length)
      let pc: i32 = 0
      while (pc < count) {
        this.visit[pc] = 0
        pc += 1
      }
      this.gen = 0
    }
    this.gen += 1
  }

  /**
   * Add the thread at `pc0` to a list, following every instruction that
   * consumes nothing, at byte `p`. The thread's captures are in `caps`, which
   * is as it was when this returns. Answers the list's new length.
   */
  addThread(dense: i32[], slots: i32[], count0: i32, pc0: i32, text: string, p: i32, len: i32, ns: i32): i32 {
    let count: i32 = count0
    this.stkKind[0] = 0
    this.stkA[0] = pc0
    let top: i32 = 1
    while (top > 0) {
      top -= 1
      if (this.stkKind[top] === 1) {
        this.caps[this.stkA[top]] = this.stkB[top]
        continue
      }
      let pc: i32 = this.stkA[top]
      while (true) {
        if (this.visit[pc] === this.gen) {
          break
        }
        this.visit[pc] = this.gen
        const o: i32 = this.op[pc]
        if (o === OP_JMP) {
          pc = this.ia[pc]
          continue
        }
        if (o === OP_SPLIT) {
          this.stkKind[top] = 0
          this.stkA[top] = this.ib[pc]
          top += 1
          pc = this.ia[pc]
          continue
        }
        if (o === OP_SAVE || o === OP_MARK) {
          const k: i32 = this.ia[pc]
          if (k < ns) {
            this.stkKind[top] = 1
            this.stkA[top] = k
            this.stkB[top] = this.caps[k]
            top += 1
            this.caps[k] = p
          }
          pc += 1
          continue
        }
        if (o === OP_CLEAR) {
          let k: i32 = this.ia[pc]
          const end: i32 = this.ib[pc] < ns ? this.ib[pc] : ns
          while (k < end) {
            this.stkKind[top] = 1
            this.stkA[top] = k
            this.stkB[top] = this.caps[k]
            top += 1
            this.caps[k] = -1
            k += 1
          }
          pc += 1
          continue
        }
        if (o === OP_ASSERT) {
          if (this.assertHolds(this.ia[pc], text, p, len)) {
            pc += 1
            continue
          }
          break
        }
        if (o === OP_CHECK) {
          // Untracked marks only reorder matches, never add or remove one,
          // so a search that wants no slots lets every iteration through.
          const k: i32 = this.ia[pc]
          if (k < ns && this.caps[k] === p) {
            break
          }
          pc += 1
          continue
        }
        // A thread that waits for a character, or has matched.
        if (count >= 0 && count < toI32(dense.length)) {
          dense[count] = pc
          count += 1
        }
        const base: i32 = pc * ns
        let k: i32 = 0
        while (k < ns) {
          slots[base + k] = this.caps[k]
          k += 1
        }
        break
      }
    }
    return count
  }

  /**
   * The VM: whether the pattern matches `text` at or after byte `from`, and
   * the leftmost-first match's first `want` slots in `mslots`. `want` is 0 to
   * learn only whether there is a match, 2 for its bounds, or every group's.
   * Any slots at all bring the marks along, because which match comes first
   * depends on them.
   */
  run(text: string, from: i32, want: i32): boolean {
    const ns: i32 = want > 0 && this.width > 2 * this.groups ? this.width : want
    const len: i32 = toI32(text.length)
    if (from < 0 || from > len) {
      return false
    }
    if (this.literal) {
      const at: i32 = toI32(text.indexOf(this.prefix, from))
      if (at < 0) {
        return false
      }
      if (ns >= 2) {
        this.mslots[0] = at
        this.mslots[1] = at + toI32(this.prefix.length)
      }
      return true
    }
    const hasPrefix: boolean = this.prefix !== ""
    const hasFirst: boolean = this.firstBytes !== ""
    const hasSet: boolean = toI32(this.firstSet.length) > 0
    this.cCount = 0
    let matched: boolean = false
    let p: i32 = from
    while (true) {
      if (!matched && (p === from || !this.anchored)) {
        if (this.cCount === 0) {
          if (!this.anchored) {
            if (hasPrefix) {
              const at: i32 = toI32(text.indexOf(this.prefix, p))
              if (at < 0) {
                break
              }
              p = at
            } else if (hasFirst) {
              const at: i32 = indexOfAny(text, this.firstBytes, p)
              if (at < 0) {
                break
              }
              p = at
            } else if (hasSet) {
              // Byte by byte, so it stops on the first byte of a character
              // before any byte inside one.
              while (p >= 0 && p < len) {
                const b: i32 = toI32(text.charCodeAt(p))
                if (b >= 128 ? this.firstWide : this.firstSet[b] === 1) {
                  break
                }
                p += 1
              }
              if (p >= len) {
                break
              }
            }
          }
          // The closure starts afresh at a new byte.
          this.newGeneration()
        }
        let k: i32 = 0
        while (k < ns) {
          this.caps[k] = -1
          k += 1
        }
        this.cCount = this.addThread(this.cDense, this.cSlots, this.cCount, REGEX_ENTRY, text, p, len, ns)
      }
      if (this.cCount === 0) {
        if (matched || this.anchored || p >= len) {
          break
        }
        p += regexWidthAt(text, p, len)
        continue
      }
      let cp: i32 = -1
      let w: i32 = 1
      if (p >= 0 && p < len) {
        cp = toI32(text.charCodeAt(p))
        if (cp >= 128) {
          const packed: i32 = regexDecodeAt(text, p, len)
          cp = packed >> 3
          w = packed & 7
        }
      }
      this.newGeneration()
      this.nCount = 0
      let i: i32 = 0
      while (i < this.cCount) {
        const pc: i32 = this.cDense[i]
        i += 1
        const o: i32 = this.op[pc]
        let hit: boolean = false
        if (o === OP_CHAR) {
          hit = cp === this.ia[pc] || cp === this.ib[pc]
        } else if (o === OP_CLASS) {
          if (cp >= 0 && cp < 128) {
            hit = this.clsAscii[this.ia[pc] * 128 + cp] === 1
          } else {
            hit = cp >= 0 && this.classHas(this.ia[pc], cp)
          }
        } else if (o === OP_ANY_NL) {
          hit = cp >= 0 && cp !== 10 && cp !== 13 && cp !== 0x2028 && cp !== 0x2029
        } else if (o === OP_ANY) {
          hit = cp >= 0
        } else if (o === OP_MATCH) {
          if (ns === 0) {
            return true
          }
          const base: i32 = pc * ns
          let k: i32 = 0
          while (k < ns) {
            this.mslots[k] = this.cSlots[base + k]
            k += 1
          }
          matched = true
          // Every thread after this one has lower priority.
          break
        }
        if (hit) {
          const base: i32 = pc * ns
          let k: i32 = 0
          while (k < ns) {
            this.caps[k] = this.cSlots[base + k]
            k += 1
          }
          this.nCount = this.addThread(this.nDense, this.nSlots, this.nCount, pc + 1, text, p + w, len, ns)
        }
      }
      const d: i32[] = this.cDense
      this.cDense = this.nDense
      this.nDense = d
      const t: i32[] = this.cSlots
      this.cSlots = this.nSlots
      this.nSlots = t
      this.cCount = this.nCount
      if (p >= len) {
        break
      }
      p += w
    }
    return matched
  }

  /** Whether the pattern matches anywhere in `text`. */
  test(text: string): boolean {
    return this.run(text, REGEX_TEXT_START, REGEX_WANT_NONE)
  }

  /**
   * Search `text` from byte `from` and fill `m` with the first match and
   * every group. Answers whether there was one; `m` is untouched when not.
   * Reusing one `RegexMatch` makes a loop of searches allocate nothing.
   */
  exec(text: string, from: i32, m: RegexMatch): boolean {
    const ns: i32 = 2 * this.groups
    if (!this.run(text, from, ns)) {
      return false
    }
    if (toI32(m.slots.length) !== ns) {
      m.slots = new Array<i32>(ns)
    }
    let k: i32 = 0
    while (k < ns) {
      m.slots[k] = this.mslots[k]
      k += 1
    }
    m.input = text
    m.names = this.names
    return true
  }

  /** The first match at or after byte `from`, or null. */
  find(text: string, from: i32): RegexMatch | null {
    const m: RegexMatch = new RegexMatch()
    if (this.exec(text, from, m)) {
      return m
    }
    return null
  }

  /** The text of every match, left to right, none overlapping. */
  findAll(text: string): string[] {
    const out: string[] = []
    const len: i32 = toI32(text.length)
    let pos: i32 = 0
    while (pos <= len && this.run(text, pos, REGEX_WANT_BOUNDS)) {
      const s: i32 = this.mslots[0]
      const e: i32 = this.mslots[1]
      out.push(text.slice(s, e))
      if (e === s) {
        if (e >= len) {
          break
        }
        pos = e + regexWidthAt(text, e, len)
      } else {
        pos = e
      }
    }
    return out
  }

  /** How many matches `findAll` would answer. */
  count(text: string): i32 {
    const len: i32 = toI32(text.length)
    let n: i32 = 0
    let pos: i32 = 0
    while (pos <= len && this.run(text, pos, REGEX_WANT_BOUNDS)) {
      n += 1
      const s: i32 = this.mslots[0]
      const e: i32 = this.mslots[1]
      if (e === s) {
        if (e >= len) {
          break
        }
        pos = e + regexWidthAt(text, e, len)
      } else {
        pos = e
      }
    }
    return n
  }

  /**
   * `text` with its first match replaced by `replacement`, which is
   * `String.prototype.replace`'s template: `$$` is `$`, `$&` the match,
   * `` $` `` and `$'` the text before and after it, `$1` to `$99` a group
   * and `$<name>` a named one; a group that took no part is "".
   */
  replace(text: string, replacement: string): string {
    return this.replaceMatches(text, replacement, false)
  }

  /** `text` with every match replaced by `replacement`, as `replace` reads it. */
  replaceAll(text: string, replacement: string): string {
    return this.replaceMatches(text, replacement, true)
  }

  replaceMatches(text: string, replacement: string, all: boolean): string {
    const len: i32 = toI32(text.length)
    // Track every group only when the template can name one.
    let ns: i32 = 2
    let i: i32 = toI32(replacement.indexOf("$"))
    while (i >= 0 && i + 1 < toI32(replacement.length)) {
      const c: i32 = toI32(replacement.charCodeAt(i + 1))
      if ((c >= 48 && c <= 57) || c === 60) {
        ns = 2 * this.groups
        break
      }
      i = toI32(replacement.indexOf("$", i + 2))
    }
    const parts: string[] = []
    let last: i32 = 0
    let pos: i32 = 0
    while (pos <= len && this.run(text, pos, ns)) {
      const s: i32 = this.mslots[0]
      const e: i32 = this.mslots[1]
      parts.push(text.slice(last, s))
      this.expand(replacement, text, ns, parts)
      last = e
      if (!all) {
        break
      }
      if (e === s) {
        if (e >= len) {
          break
        }
        pos = e + regexWidthAt(text, e, len)
      } else {
        pos = e
      }
    }
    if (toI32(parts.length) === 0) {
      return text
    }
    parts.push(text.slice(last, len))
    return parts.join("")
  }

  /** Group `k` of the match in `mslots`, or "". */
  slotText(text: string, ns: i32, k: i32): string {
    if (k < 0 || 2 * k + 1 >= ns || this.mslots[2 * k] < 0) {
      return ""
    }
    return text.slice(this.mslots[2 * k], this.mslots[2 * k + 1])
  }

  /** Append the replacement template, expanded for the match in `mslots`, to `parts`. */
  expand(rep: string, text: string, ns: i32, parts: string[]): void {
    const n: i32 = toI32(rep.length)
    const groupsAfterZero: i32 = this.groups - 1
    let lit: i32 = 0
    let i: i32 = toI32(rep.indexOf("$"))
    while (i >= 0 && i + 1 < n) {
      const c: i32 = toI32(rep.charCodeAt(i + 1))
      let used: i32 = 0
      let value: string = ""
      if (c === 36) {
        value = "$"
        used = 2
      } else if (c === 38) {
        value = this.slotText(text, ns, REGEX_WHOLE)
        used = 2
      } else if (c === 96) {
        value = text.slice(0, this.mslots[0])
        used = 2
      } else if (c === 39) {
        value = text.slice(this.mslots[1], toI32(text.length))
        used = 2
      } else if (c >= 48 && c <= 57) {
        const one: i32 = c - 48
        const d: i32 = i + 2 < n ? toI32(rep.charCodeAt(i + 2)) : -1
        if (d >= 48 && d <= 57 && one * 10 + (d - 48) >= 1 && one * 10 + (d - 48) <= groupsAfterZero) {
          value = this.slotText(text, ns, one * 10 + (d - 48))
          used = 3
        } else if (one >= 1 && one <= groupsAfterZero) {
          value = this.slotText(text, ns, one)
          used = 2
        }
      } else if (c === 60 && this.hasNames) {
        const close: i32 = toI32(rep.indexOf(">", i + 2))
        if (close >= 0) {
          value = this.slotText(text, ns, this.groupIndex(rep.slice(i + 2, close)))
          used = close + 1 - i
        }
      }
      if (used === 0) {
        i = toI32(rep.indexOf("$", i + 1))
        continue
      }
      parts.push(rep.slice(lit, i))
      parts.push(value)
      lit = i + used
      i = toI32(rep.indexOf("$", lit))
    }
    parts.push(rep.slice(lit, n))
  }

  /**
   * `text` cut at every match, as `String.prototype.split` cuts it: each
   * group's text follows the piece before its match ("" for one that took no
   * part), an empty match where the last piece ended or at the end cuts
   * nothing, and "" splits to nothing when the pattern matches it, else to
   * `[""]`.
   */
  split(text: string): string[] {
    const len: i32 = toI32(text.length)
    const out: string[] = []
    const ns: i32 = 2 * this.groups
    if (len === 0) {
      if (!this.run(text, REGEX_TEXT_START, REGEX_WANT_NONE)) {
        out.push(text)
      }
      return out
    }
    let p: i32 = 0
    let q: i32 = 0
    while (q < len && this.run(text, q, ns)) {
      const s: i32 = this.mslots[0]
      const e: i32 = this.mslots[1]
      if (s >= len) {
        break
      }
      if (e === p) {
        q = s + regexWidthAt(text, s, len)
        continue
      }
      out.push(text.slice(p, s))
      let k: i32 = 1
      while (k < this.groups) {
        out.push(this.slotText(text, ns, k))
        k += 1
      }
      p = e
      q = p
    }
    out.push(text.slice(p, len))
    return out
  }
}

/**
 * Compile `pattern` with `flags`, a string of `i`, `m` and `s` in any order.
 * The error names what is wrong and its byte in the pattern.
 */
export const regexCompile = (pattern: string, flags: string): Result<Regex, string> => {
  let icase: boolean = false
  let multiline: boolean = false
  let dotAll: boolean = false
  const nflags: i32 = toI32(flags.length)
  let i: i32 = 0
  while (i < nflags) {
    const c: i32 = toI32(flags.charCodeAt(i))
    if (c === 105 && !icase) {
      icase = true
    } else if (c === 109 && !multiline) {
      multiline = true
    } else if (c === 115 && !dotAll) {
      dotAll = true
    } else {
      return Err(`regex: invalid flags "${flags}"`)
    }
    i += 1
  }
  const p: RegexParser = new RegexParser(pattern, icase, multiline, dotAll)
  const root: i32 = p.parseAlt(REGEX_TOP)
  if (!p.failed && p.pos < p.len) {
    p.fail("unmatched )", p.pos)
  }
  if (p.failed) {
    return Err(`regex: ${p.error} at byte ${p.errorAt}`)
  }
  const re: Regex = new Regex(pattern, flags)
  const error: string = re.build(p, root)
  if (error !== "") {
    return Err(`regex: ${error}`)
  }
  return Ok(re)
}

/** `text` with every syntax character escaped, so that it compiles to a pattern matching exactly `text`. */
export const regexEscape = (text: string): string => {
  const parts: string[] = []
  const n: i32 = toI32(text.length)
  let lit: i32 = 0
  let i: i32 = 0
  while (i < n) {
    const c: i32 = toI32(text.charCodeAt(i))
    // ^ $ \ . * + ? ( ) [ ] { } | /
    if (
      c === 94 ||
      c === 36 ||
      c === 92 ||
      c === 46 ||
      c === 42 ||
      c === 43 ||
      c === 63 ||
      c === 40 ||
      c === 41 ||
      c === 91 ||
      c === 93 ||
      c === 123 ||
      c === 125 ||
      c === 124 ||
      c === 47
    ) {
      parts.push(text.slice(lit, i))
      parts.push("\\")
      lit = i
    }
    i += 1
  }
  if (lit === 0) {
    return text
  }
  parts.push(text.slice(lit, n))
  return parts.join("")
}
