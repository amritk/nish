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
 * **Matching never backtracks.** A search runs a lazy DFA first: it builds
 * its states from the compiled program as the text needs them, so it reads a
 * byte per step and the leftmost-first match's end comes from a table lookup.
 * A reverse DFA, run back from that end, finds where the match starts, and a
 * Pike VM, the construction RE2, Go's `regexp` and Rust's `regex` use, runs
 * from that start only when a group's capture is wanted. A pattern with a
 * literal no match can avoid, such as `\w+@example`, is searched for by that
 * literal and the match grown both ways from it. Every engine follows every
 * alternative at once, so a match costs O(pattern × input) at worst and
 * `(a+)+$` against a thousand `a`s and a `b` is as quick as `a+$`. Which match
 * is found is the one JavaScript finds — the leftmost, and of those the one
 * the first alternative and the greediest quantifier prefer — and a group
 * inside a quantifier keeps only its last iteration's capture, as in
 * JavaScript. An iteration past a quantifier's minimum that matches empty is
 * rejected, as JavaScript rejects it. One corner differs: where a quantified
 * body that can match empty sits inside another quantifier, the VM follows
 * only one thread per instruction and position, so a group's capture, and
 * now and then the match's end, can be a different iteration's than
 * JavaScript's — `(a*?)+?$` on "aa" captures "aa" where JavaScript captures
 * "a".
 *
 * **Strings are UTF-8 and offsets are bytes**, like `s.length`. The VM steps
 * a code point at a time, so `.` and `[^a]` consume a whole character; a byte
 * that is not part of valid UTF-8 is one character of its own, which no
 * literal and no range matches. `\w`, `\d` and `\b` are ASCII, as they are in
 * JavaScript; `\s` is JavaScript's whitespace, U+FEFF and U+3000 included.
 * After an empty match `findAll`, `replaceAll` and `split` step one character.
 *
 * **What a call costs.** The VM's two thread lists, its capture tables and
 * its stack are allocated once by `regexCompile`. `test` tracks no captures, `findAll`, `split` and a
 * `replace` whose template names no group track only the match's bounds, and
 * only `exec`, `find` and a template with `$1` or `$<name>` pay for every
 * group. A pattern that starts with a literal is searched for with
 * `s.indexOf`; one whose first few bytes are each one of a set rare enough to
 * be worth it, like `[A-Z][a-z]` or `cat|dog`, is searched for those bytes by
 * a runtime kernel that tests sixteen or thirty-two starts at a time; any
 * other whose first characters are known skips the bytes that cannot start a
 * match with a 128-entry table; and a pattern that is nothing but a literal
 * never starts an engine at all. The DFA's states are
 * built as searches need them and kept, so only a search that meets new
 * states allocates, and only up to a bound:
 * its table holds at most 2,048 states and 262,144 transitions (1 MiB), and
 * a search that fills it clears it and goes on; one that keeps clearing it
 * without reading at least 10 bytes per state hands the rest of the text to
 * the VM, which is slower but never needs more memory. Because the scratch
 * memory lives in the `Regex`, one `Regex` is used by one thread at a time.
 */

import { uncheckedGet } from "nish:unsafe"

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

/** Whether every character of `s` is ASCII. */
const isRegexAscii = (s: string): boolean => {
  let i: i32 = 0
  while (i < toI32(s.length)) {
    if (toI32(s.charCodeAt(i)) >= 128) {
      return false
    }
    i += 1
  }
  return true
}

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

// The lazy DFA. A state is a list of instructions waiting for a character, in
// priority order, with flags: whether a match may still start at the next
// byte (`DFA_RESTART`), the kind of character just read and whether it runs
// the reverse program. A transition is one i32, 0 until it is computed. A
// plain one is the next state's offset itself, which is never 0 because the
// first row is never a state, so the hot loop's chain from one byte to the
// next is a load and an `|`. Any other is `-(next << 4 | flags)`, with
// `DFA_MATCH` when a match ends before the character, `DFA_DEAD` when no
// thread survives it and `DFA_IDLE` when the next state waits for a match to
// start and a prefilter can find one. The hot loop follows a plain entry and
// one with only `DFA_MATCH`, and leaves on any other.
const DFA_MATCH: i32 = 1
const DFA_DEAD: i32 = 2
const DFA_IDLE: i32 = 4
const DFA_KNOWN: i32 = 8
const DFA_RESTART: i32 = 1
const DFA_REV: i32 = 16
const DFA_UNANCHORED: i32 = 0
const DFA_ANCHORED: i32 = 1
const DFA_REVERSE: i32 = 2
const DFA_INNER: i32 = 3
/** A search that finds no match. */
const DFA_NONE: i32 = -1
/** A search that built too many states for the bytes it read, and leaves the rest to the VM. */
const DFA_GAVE_UP: i32 = -2
/** At most this many units are refined into byte classes, and this much work spent doing it. */
const DFA_MAX_UNITS: i32 = 1048576
const DFA_MAX_WORK: i32 = 4194304
/** At most 2^12 classes, so a state's row is at most 4096 transitions. */
const DFA_MAX_SHIFT: i32 = 12
const DFA_MAX_STATES: i32 = 2048
const DFA_MAX_TABLE: i32 = 262144
const DFA_FIRST_STATES: i32 = 64
const DFA_FIRST_POOL: i32 = 1024
const DFA_MIN_POOL: i32 = 16384
const DFA_HASH_MASK: i32 = 1048575
/** A cache cleared more than this often must read 10 bytes per state it can hold, or the search gives up. */
const DFA_FREE_FLUSHES: i32 = 3
const DFA_BYTES_PER_STATE: i32 = 10
const DFA_EPOCH_MASK: i32 = 1073741823
/** How far the inner search may read in vain before it gives way to the plain one. */
const DFA_INNER_SLACK: f64 = 65536.0

// The kind of a character, as the assertions read it. `CTX_START` stands
// before the text (or after it, read in reverse) and `CTX_EOT` after it.
const CTX_START: i32 = 0
const CTX_WORD: i32 = 1
const CTX_LINE: i32 = 2
const CTX_OTHER: i32 = 3
const CTX_EOT: i32 = 4
const CTX_KINDS: i32 = 5
const CTX_SLOTS: i32 = 4

/**
 * Which kinds a program's assertions tell apart, as a map from each kind to
 * the one a state records. `bits` has bit `1 << kind` for every assertion
 * kind present; a pattern with none keeps one context, so it builds no state
 * twice.
 */
const regexContextMask = (bits: i32): i32[] => {
  const m: i32[] = new Array<i32>(CTX_KINDS)
  const line: boolean = (bits & (1 << ASSERT_BEGIN_LINE)) !== 0
  if ((bits & (1 << ASSERT_BEGIN_TEXT)) !== 0) {
    m[CTX_START] = CTX_START
  } else if (line) {
    m[CTX_START] = CTX_LINE
  } else {
    m[CTX_START] = CTX_OTHER
  }
  const word: boolean = (bits & ((1 << ASSERT_WORD) | (1 << ASSERT_NOT_WORD))) !== 0
  m[CTX_WORD] = word ? CTX_WORD : CTX_OTHER
  m[CTX_LINE] = line ? CTX_LINE : CTX_OTHER
  m[CTX_OTHER] = CTX_OTHER
  m[CTX_EOT] = CTX_OTHER
  return m
}

/** Sort `a` ascending, a bottom-up merge sort. */
const regexSortPoints = (a: i32[]): void => {
  const n: i32 = toI32(a.length)
  const tmp: i32[] = new Array<i32>(n)
  let width: i32 = 1
  while (width < n) {
    let lo: i32 = 0
    while (lo < n) {
      const mid: i32 = n - lo > width ? lo + width : n
      const hi: i32 = n - mid > width ? mid + width : n
      let i: i32 = lo
      let j: i32 = mid
      let k: i32 = lo
      while (k < hi) {
        if (i < mid && (j >= hi || a[i] <= a[j])) {
          tmp[k] = a[i]
          i += 1
        } else {
          tmp[k] = a[j]
          j += 1
        }
        k += 1
      }
      lo = hi
    }
    let k: i32 = 0
    while (k < n) {
      a[k] = tmp[k]
      k += 1
    }
    width *= 2
  }
}

/** English letters, most frequent first. */
const REGEX_LETTER_ORDER: string = "etaoinshrdlcumwfgypbvkjxqz"

/** How common ASCII byte `b` is in text, roughly: a prefix is searched for by its rarest byte. */
const regexByteScore = (b: i32): i32 => {
  if (b === 32) {
    return 100
  }
  if (b >= 97 && b <= 122) {
    let i: i32 = 0
    while (i < 26) {
      if (toI32(REGEX_LETTER_ORDER.charCodeAt(i)) === b) {
        return 95 - i
      }
      i += 1
    }
  }
  if (b === 46 || b === 44) {
    return 50
  }
  if (b === 10) {
    return 45
  }
  if (b >= 65 && b <= 90) {
    return 40
  }
  if (b >= 48 && b <= 57) {
    return 30
  }
  return 10
}

/** `REGEX_LETTER_ORDER`'s letters as per-mille of English text, two decimal digits each. */
const REGEX_LETTER_PER_MILLE: string = "9570626055555048463331222219181716151411080602010101"

/** How many of every thousand bytes of English text the `i`th letter of `REGEX_LETTER_ORDER` is. */
const regexLetterPerMille = (i: i32): i32 => {
  const tens: i32 = toI32(REGEX_LETTER_PER_MILLE.charCodeAt(2 * i)) - 48
  return tens * 10 + toI32(REGEX_LETTER_PER_MILLE.charCodeAt(2 * i + 1)) - 48
}

/** How many of every thousand bytes of text are ASCII byte `b`, roughly: what a scan window is chosen by. */
const regexBytePerMille = (b: i32): i32 => {
  if (b === 32) {
    return 170
  }
  if (b >= 97 && b <= 122) {
    let i: i32 = 0
    while (i < 26) {
      if (toI32(REGEX_LETTER_ORDER.charCodeAt(i)) === b) {
        return regexLetterPerMille(i)
      }
      i += 1
    }
  }
  if (b === 46 || b === 44) {
    return 8
  }
  if (b === 10) {
    return 15
  }
  if ((b >= 65 && b <= 90) || (b >= 48 && b <= 57)) {
    return 2
  }
  return 1
}

/** How many leading byte positions of a match `findScan` works out the sets of. */
const REGEX_SCAN_DEPTH: i32 = 8
/** The most of them the runtime's scan tests at once; its contract allows 4. */
const REGEX_SCAN_WIDTH: i32 = 3

/**
 * The scan's walk: the first index at or after `from` where each of the
 * `depth` bytes from it is in its position's set, or -1. `masks` holds each
 * set twice, as `runtime/nish.h` says `nish_regex_scan` reads them: 32 bytes a
 * position for the vector window, then a table of 256 a position, from
 * `32 * depth`, which is the one read here. Under Node, where a character
 * above ASCII is a code unit rather than bytes, any such unit reads as 0xFF,
 * which is in a set exactly when every byte above ASCII is. The `width` positions from `off`
 * are tested first, as the kernel looks for them first; the answer does not
 * depend on which they are.
 *
 * This loop is what runs under Node. Natively the compiler replaces the calls
 * to it with that kernel (`src/kernels.ts`), as it does `nish/text`'s
 * `indexOfAnyFrom`. Every caller hands it a `from` in `[0, length]`, a depth
 * of 1 to `REGEX_SCAN_DEPTH`, a window of 1 to `REGEX_SCAN_WIDTH` positions
 * inside it and a `masks` 288 bytes a position long.
 */
const regexScanFrom = (text: string, masks: u8[], depth: i32, off: i32, width: i32, from: i32): i32 => {
  const length: i32 = toI32(text.length)
  let i: i32 = from
  while (i >= 0 && i <= length - depth) {
    let k: i32 = 0
    while (k < depth) {
      // The window's positions, then the ones before it, then the ones after.
      let j: i32 = k
      if (k < width) {
        j = off + k
      } else if (k < off + width) {
        j = k - width
      }
      let b: i32 = toI32(text.charCodeAt(i + j))
      if (b > 255) {
        b = 255
      }
      const slot: i32 = 32 * depth + (j << 8) + b
      if (masks[slot] === 0) {
        break
      }
      k += 1
    }
    if (k === depth) {
      return i
    }
    i += 1
  }
  return -1
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
  /** The prefix's rarest byte, which `findPrefix` searches for, at `rareAt`. */
  rareStr: string
  /** A literal inside every match that the part before it cannot read, or "": see `dfaInner`. */
  innerLit: string
  /** Which ASCII bytes a match can start with, or empty when any byte can start one. */
  firstSet: u8[]
  /**
   * The byte sets of a match's first `scanDepth` positions, 32 bytes each in
   * `regexScanFrom`'s layout. Every position but the last is ASCII only, so
   * each is one byte of the text.
   */
  posMasks: u8[]

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

  // The lazy DFA, built on first use by `dfaInit`. State `id` lives at
  // offset `id << dShift` of `dTrans`, one transition per byte class; its
  // instructions are `dPool[dStart[id] .. + dLen[id])` and `dHash` finds a
  // state by them, holding `id + 1`.
  dTrans: i32[]
  dPool: i32[]
  dStart: i32[]
  dLen: i32[]
  dFlags: i32[]
  dHash: i32[]
  // Scratch for one step: the closure's stamps, leaves and stack, and the
  // next state's instructions.
  dVisit: i32[]
  dLeaf: i32[]
  dBuf: i32[]
  dStk: i32[]
  /** The class of each ASCII byte; every byte above it maps to the spare column, never filled. */
  dCls: i32[]
  /** The classes of the code points from `dWlo[i]` up to the next: every one above ASCII. */
  dWlo: i32[]
  dWcls: i32[]
  /** A code point of each class, or -1 for the end of the text, and its kind. */
  dRep: i32[]
  dNextK: i32[]
  /** The context a class leaves behind, read forward and in reverse. */
  dCtxF: i32[]
  dCtxR: i32[]
  dMaskF: i32[]
  dMaskR: i32[]
  /**
   * Whether no forward assertion reads the character before it, so every
   * forward state after a character holds the same context and a state with
   * no thread left is the unanchored start state wherever the text resumes.
   */
  dCtxFree: boolean
  /** Each start state's offset + 1, by mode and context, or 0. */
  dStartOff: i32[]
  /**
   * Whether a match can start only where the ASCII `prefix` is and no
   * assertion reads the context, so the unanchored start state after the
   * prefix's bytes is one state, `dPrefOff`.
   */
  dPrefFast: boolean
  /** That state's offset + 1, or 0 until it is computed. */
  dPrefOff: i32
  /** Bytes the inner search read in vain past its literal, and bytes it moved past: see `dfaInner`. */
  innerWaste: f64
  innerGain: f64

  /** Capture groups, the whole match included. */
  groups: i32
  /** Slots a thread carries: two per group, then one mark per repeat that can iterate empty. */
  width: i32
  cCount: i32
  nCount: i32
  gen: i32
  /** The forward program's length; the reverse one follows it, at `revEntry`. */
  fwdCount: i32
  revEntry: i32
  /** The reverse of the part before `innerLit`, which the inner search runs back from it. */
  innerEntry: i32
  /** Where `dfaForward` stopped reading, and where `dfaInner`'s match starts. */
  dStop: i32
  dBegin: i32
  /** Where `rareStr` is in `prefix`. */
  rareAt: i32
  scanDepth: i32
  scanWidth: i32
  scanOff: i32
  dShift: i32
  dCount: i32
  dCap: i32
  dMax: i32
  dPoolLen: i32
  dPoolMax: i32
  dGen: i32
  /** Bumped by every flush, so a step can tell its row was cleared under it. */
  dEpoch: i32
  dFlushes: i32
  /** Where the last flush happened. */
  dPos: i32
  /** The class of the end of the text, and how many intervals above ASCII there are. */
  dEot: i32
  dWide: i32

  hasNames: boolean
  tooBig: boolean
  /** The pattern is `prefix` and nothing else. */
  literal: boolean
  /** The pattern starts with `^` outside multiline mode. */
  anchored: boolean
  /** Whether a byte above ASCII can start a match, when `firstSet` is not empty. */
  firstWide: boolean
  /** The pattern can match the empty string. */
  nullable: boolean
  /** The reverse program was compiled. */
  revOk: boolean
  /** `dfaInit` has run, and whether the DFA may be used. */
  dReady: boolean
  dOk: boolean
  /** An idle state skips ahead with the prefilter. */
  dSkip: boolean
  /** The scan's window is rare enough in text to search with. */
  scanSel: boolean
  /** The scan's first positions are exactly the prefix's bytes, all ASCII: see `prefixIsScan`. */
  prefixExact: boolean

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
    this.innerLit = ""
    this.firstSet = []
    this.posMasks = []
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
    this.rareStr = ""
    this.rareAt = 0
    this.scanDepth = 0
    this.scanWidth = 0
    this.scanOff = 0
    this.fwdCount = 0
    this.revEntry = 0
    this.innerLit = ""
    this.innerEntry = 0
    this.innerWaste = 0.0
    this.innerGain = 0.0
    this.dStop = 0
    this.dBegin = 0
    this.nullable = true
    this.revOk = false
    this.dTrans = []
    this.dPool = []
    this.dStart = []
    this.dLen = []
    this.dFlags = []
    this.dHash = []
    this.dVisit = []
    this.dLeaf = []
    this.dBuf = []
    this.dStk = []
    this.dCls = []
    this.dWlo = []
    this.dWcls = []
    this.dRep = []
    this.dNextK = []
    this.dCtxF = []
    this.dCtxR = []
    this.dMaskF = []
    this.dMaskR = []
    this.dCtxFree = false
    this.dStartOff = []
    this.dPrefFast = false
    this.dPrefOff = 0
    this.dShift = 0
    this.dCount = 0
    this.dCap = 0
    this.dMax = 0
    this.dPoolLen = 0
    this.dPoolMax = 0
    this.dGen = 0
    this.dEpoch = 0
    this.dFlushes = 0
    this.dPos = 0
    this.dEot = 0
    this.dWide = 0
    this.dReady = false
    this.dOk = false
    this.dSkip = false
    this.scanSel = false
    this.prefixExact = false
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
  compileIteration(p: RegexParser, r: i32, rev: boolean): void {
    if (p.ne[r] > p.nd[r]) {
      this.emit(OP_CLEAR, 2 * p.nd[r], 2 * p.ne[r])
    }
    this.compileNode(p, p.kid[r], rev)
  }

  /**
   * Emit node `n`. Reversed (`rev`), it matches the same text read from its
   * end: a concatenation's parts come last first and each assertion trades
   * places with its mirror, `^` with `$`. The reverse DFA runs that program.
   */
  compileNode(p: RegexParser, n: i32, rev: boolean): void {
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
      // The text and line assertions are numbered so that the low bit picks
      // the beginning or the end.
      const a: i32 = p.na[n]
      this.emit(OP_ASSERT, rev && a < ASSERT_WORD ? a ^ 1 : a, REGEX_NIL)
      return
    }
    if (kind === NODE_CAT) {
      const kids: i32[] = []
      let c: i32 = p.kid[n]
      while (c !== -1) {
        kids.push(c)
        c = p.next[c]
      }
      const count: i32 = toI32(kids.length)
      let i: i32 = 0
      while (i < count) {
        let k: i32 = i
        if (rev) {
          k = count - 1 - i
        }
        this.compileNode(p, kids[k], rev)
        i += 1
      }
      return
    }
    if (kind === NODE_GROUP) {
      this.emit(OP_SAVE, 2 * p.na[n], REGEX_NIL)
      this.compileNode(p, p.kid[n], rev)
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
          this.compileNode(p, c, rev)
          jumps.push(this.emit(OP_JMP, REGEX_NIL, REGEX_NIL))
          this.ib[split] = this.pc()
        } else {
          this.compileNode(p, c, rev)
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
      this.compileEmptyCheckedRepeat(p, n, min, max, greedy, rev)
      return
    }
    if (max === -1 && min === 0) {
      // L: SPLIT body, exit; body; JMP L
      const split: i32 = this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL)
      this.compileIteration(p, n, rev)
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
        this.compileIteration(p, n, rev)
        i += 1
      }
      const loop: i32 = this.pc()
      this.compileIteration(p, n, rev)
      const split: i32 = this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL)
      this.ia[split] = greedy ? loop : split + 1
      this.ib[split] = greedy ? split + 1 : loop
      return
    }
    // body × min; then (SPLIT next, exit; body) × (max - min)
    let i: i32 = 0
    while (i < min && !this.tooBig) {
      this.compileIteration(p, n, rev)
      i += 1
    }
    const splits: i32[] = []
    i = min
    while (i < max && !this.tooBig) {
      splits.push(this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL))
      this.compileIteration(p, n, rev)
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
  compileEmptyCheckedRepeat(p: RegexParser, n: i32, min: i32, max: i32, greedy: boolean, rev: boolean): void {
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
      this.compileIteration(p, n, rev)
      i += 1
    }
    const splits: i32[] = []
    if (max === -1) {
      const split: i32 = this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL)
      splits.push(split)
      this.emit(OP_MARK, k, REGEX_NIL)
      this.compileIteration(p, n, rev)
      this.emit(OP_CHECK, k, REGEX_NIL)
      this.emit(OP_JMP, split, REGEX_NIL)
    } else {
      while (i < max && !this.tooBig) {
        splits.push(this.emit(OP_SPLIT, REGEX_NIL, REGEX_NIL))
        this.emit(OP_MARK, k, REGEX_NIL)
        this.compileIteration(p, n, rev)
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
    this.compileNode(p, root, false)
    this.emit(OP_SAVE, 2 * REGEX_WHOLE + 1, REGEX_NIL)
    this.emit(OP_MATCH, REGEX_NIL, REGEX_NIL)
    if (this.tooBig) {
      return "the pattern compiles to more than 100000 instructions"
    }
    const count: i32 = this.pc()
    this.fwdCount = count
    this.nullable = regexNullable(p, root)
    // The reverse program, which the reverse DFA runs to find where a match
    // starts once the forward one has found where it ends. Without marks
    // only: a mark reorders the matches, and the reverse search reads none.
    if (this.width === 2 * this.groups && 2 * count <= REGEX_MAX_INSTRUCTIONS) {
      this.revEntry = count
      this.compileNode(p, root, true)
      this.emit(OP_MATCH, REGEX_NIL, REGEX_NIL)
      this.revOk = !this.tooBig
      this.tooBig = false
    }
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
    if (this.revOk && !this.anchored && this.prefix === "") {
      this.findInner(p, root)
    }
    return ""
  }

  /**
   * A run of literal ASCII characters among the top-level parts of the
   * pattern, not the first, whose first byte no part before it can read:
   * every match then holds the run's first occurrence at or after where it
   * starts, so the search looks for the run and runs back from it. Takes the
   * run with the rarest first byte, the longest of those, and compiles the
   * parts before it reversed, at `innerEntry`.
   */
  findInner(p: RegexParser, root: i32): void {
    if (p.kind[root] !== NODE_CAT) {
      return
    }
    const kids: i32[] = []
    let c: i32 = p.kid[root]
    while (c !== -1) {
      kids.push(c)
      c = p.next[c]
    }
    const count: i32 = toI32(kids.length)
    let best: i32 = 0
    let bestLen: i32 = 0
    let bestScore: i32 = 0
    let i: i32 = 1
    while (i < count) {
      let n: i32 = 0
      while (i + n < count && this.isAsciiChar(p, kids[i + n])) {
        n += 1
      }
      if (n > 0) {
        const b: i32 = p.na[kids[i]]
        const score: i32 = regexByteScore(b)
        if (bestLen === 0 || score < bestScore || (score === bestScore && n > bestLen)) {
          let j: i32 = 0
          while (j < i && !this.canConsume(p, kids[j], b)) {
            j += 1
          }
          if (j === i) {
            best = i
            bestLen = n
            bestScore = score
          }
        }
        i += n
      } else {
        i += 1
      }
    }
    if (bestLen === 0) {
      return
    }
    const bytes: u8[] = new Array<u8>(bestLen)
    i = 0
    while (i < bestLen) {
      bytes[i] = toU8(p.na[kids[best + i]])
      i += 1
    }
    this.innerEntry = this.pc()
    i = best - 1
    while (i >= 0) {
      this.compileNode(p, kids[i], true)
      i -= 1
    }
    this.emit(OP_MATCH, REGEX_NIL, REGEX_NIL)
    if (this.tooBig) {
      this.tooBig = false
      return
    }
    this.innerLit = String.fromBytes(bytes, 0, bestLen)
  }

  /** Whether node `n` is one ASCII character, matched exactly. */
  isAsciiChar(p: RegexParser, n: i32): boolean {
    return p.kind[n] === NODE_CHAR && p.na[n] === p.nb[n] && p.na[n] < 128
  }

  /** Whether node `n` can read the ASCII byte `b`. */
  canConsume(p: RegexParser, n: i32, b: i32): boolean {
    const kind: i32 = p.kind[n]
    if (kind === NODE_CHAR) {
      return p.na[n] === b || p.nb[n] === b
    }
    if (kind === NODE_CLASS) {
      return this.classHas(p.na[n], b)
    }
    if (kind === NODE_ANY) {
      return true
    }
    if (kind === NODE_GROUP || kind === NODE_REPEAT) {
      return this.canConsume(p, p.kid[n], b)
    }
    if (kind === NODE_CAT || kind === NODE_ALT) {
      let c: i32 = p.kid[n]
      while (c !== -1) {
        if (this.canConsume(p, c, b)) {
          return true
        }
        c = p.next[c]
      }
    }
    return false
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
      let best: i32 = 1000
      let i: i32 = 0
      while (i < n) {
        const b: i32 = toI32(bytes[i])
        if (b < 128 && regexByteScore(b) < best) {
          best = regexByteScore(b)
          this.rareAt = i
        }
        i += 1
      }
      this.rareStr = this.prefix.slice(this.rareAt, this.rareAt + 1)
    }
    pc = 0
    while (this.op[pc] === OP_SAVE) {
      pc += 1
    }
    this.anchored = this.op[pc] === OP_ASSERT && this.ia[pc] === ASSERT_BEGIN_TEXT
    if (!this.anchored) {
      this.findScan()
    }
  }

  /**
   * The byte sets of a match's first positions, and the window of them the
   * scan searches for. Each position's set is every byte the program can read
   * there, from the instructions a match can have reached after that many
   * bytes, which is more than a match can always read there but never less.
   * The walk stops at a position where a match can already end, which makes
   * the positions before it ones every match has, and after a position where
   * a character above ASCII can start, since the next byte of the text may be
   * inside that character.
   */
  findScan(): void {
    const count: i32 = this.pc()
    const masks: u8[] = new Array<u8>(32 * REGEX_SCAN_DEPTH)
    const odds: i32[] = new Array<i32>(REGEX_SCAN_DEPTH)
    // `seen[at]` is the depth plus one at which `at` was last walked.
    const seen: i32[] = new Array<i32>(count)
    let frontier: i32[] = [REGEX_ENTRY]
    let depth: i32 = 0
    let ended: boolean = false
    while (depth < REGEX_SCAN_DEPTH && !ended) {
      const set: u8[] = new Array<u8>(128)
      const next: i32[] = []
      let wide: boolean = false
      const work: i32[] = []
      let f: i32 = 0
      while (f < toI32(frontier.length)) {
        work.push(frontier[f])
        f += 1
      }
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
        if (at < 0 || at >= toI32(seen.length) || seen[at] === depth + 1) {
          continue
        }
        seen[at] = depth + 1
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
          next.push(at + 1)
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
          next.push(at + 1)
        } else if (o === OP_ANY || o === OP_ANY_NL) {
          let c: i32 = 0
          while (c >= 0 && c < toI32(set.length)) {
            set[c] = 1
            c += 1
          }
          wide = true
        } else {
          // OP_MATCH: a match can end here.
          ended = true
          break
        }
      }
      if (ended) {
        break
      }
      let odd: i32 = wide ? 100 : 0
      let c: i32 = 0
      while (c >= 0 && c < 128) {
        if (set[c] === 1) {
          const row: i32 = (depth << 5) | (c & 15)
          const bit: i32 = toI32(1) << (c >> 4)
          masks[row] |= toU8(bit)
          odd += regexBytePerMille(c)
        }
        c += 1
      }
      if (wide) {
        let k: i32 = 16
        while (k < 32) {
          const row: i32 = (depth << 5) | k
          masks[row] = 255
          k += 1
        }
      }
      odds[depth] = odd > 1000 ? 1000 : odd
      if (depth === 0 && this.prefix === "") {
        // The first position also feeds the VM's table, which wants a set
        // that leaves some byte out.
        let m: i32 = 0
        c = 0
        while (c >= 0 && c < 128) {
          m += toI32(set[c])
          c += 1
        }
        if (!wide || m < 128) {
          this.firstSet = set
          this.firstWide = wide
        }
      }
      depth += 1
      if (wide) {
        break
      }
      frontier = next
    }
    // No position, or a first one that can be inside a character: no scan.
    if (depth === 0 || masks[16] !== 0) {
      return
    }
    this.scanDepth = depth
    // The 32-byte forms the vector window reads, then a membership table of
    // 256 bytes a position, which the walker and the kernel's other positions
    // read a load a byte.
    const both: u8[] = new Array<u8>(288 * depth)
    let at: i32 = 0
    while (at >= 0 && at < 32 * depth && at < toI32(both.length)) {
      both[at] = masks[at]
      at += 1
    }
    at = 0
    while (at >= 0 && at < 256 * depth) {
      const b: i32 = at & 255
      const row: i32 = ((at >> 8) << 5) | ((b >> 7) << 4) | (b & 15)
      const slot: i32 = 32 * depth + at
      if (slot < toI32(both.length) && ((toI32(masks[row]) >> ((b >> 4) & 7)) & 1) === 1) {
        both[slot] = 1
      }
      at += 1
    }
    this.posMasks = both
    // The rarest window of each width from two, and the narrowest of them
    // that lets through about one start in 256: a narrower window is fewer
    // loads a block, a wider one fewer false starts.
    const most: i32 = depth < REGEX_SCAN_WIDTH ? depth : REGEX_SCAN_WIDTH
    let width: i32 = most < 2 ? most : 2
    let best: i32 = -1
    let all: i32 = 1
    while (true) {
      all = 1
      best = -1
      let off: i32 = 0
      while (off + width <= depth) {
        let odd: i32 = 1
        let j: i32 = 0
        while (j < width) {
          odd *= odds[off + j]
          j += 1
        }
        if (best < 0 || odd < best) {
          best = odd
          this.scanOff = off
        }
        off += 1
      }
      let j: i32 = 0
      while (j < width) {
        all *= 1000
        j += 1
      }
      if (width >= most || best < all / 256) {
        break
      }
      width += 1
    }
    this.scanWidth = width
    // Worth it when fewer than one start in sixteen passes the window.
    this.scanSel = best < all / 16
    this.prefixExact = this.prefixIsScan()
  }

  /**
   * Whether `posMasks` starts with the prefix's bytes, each ASCII, and nothing
   * else. The positions after them hold for every match too, so a start the
   * scan finds is then the prefix's next occurrence that can begin a match.
   */
  prefixIsScan(): boolean {
    const n: i32 = toI32(this.prefix.length)
    if (n === 0 || n > this.scanDepth) {
      return false
    }
    let j: i32 = 0
    while (j < n) {
      const c: i32 = toI32(this.prefix.charCodeAt(j))
      if (c >= 128) {
        return false
      }
      let k: i32 = 0
      while (k < 32) {
        const bit: i32 = toI32(1) << (c >> 4)
        const want: i32 = k === (c & 15) ? bit : 0
        if (toI32(this.posMasks[32 * j + k]) !== want) {
          return false
        }
        k += 1
      }
      j += 1
    }
    return true
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
   * The first match of `prefix` at or after `from`, or -1: a search for its
   * rarest byte, then a comparison of the bytes around it.
   */
  findPrefix(text: string, from: i32): i32 {
    if (this.scanSel) {
      return this.findPrefixScan(text, from)
    }
    if (this.rareAt === 0) {
      return toI32(text.indexOf(this.prefix, from))
    }
    const len: i32 = toI32(text.length)
    const n: i32 = toI32(this.prefix.length)
    let p: i32 = from + this.rareAt
    while (true) {
      const at: i32 = toI32(text.indexOf(this.rareStr, p))
      if (at < 0) {
        return -1
      }
      const s: i32 = at - this.rareAt
      if (s > len - n) {
        return -1
      }
      let k: i32 = 0
      while (k < n && text.charCodeAt(s + k) === this.prefix.charCodeAt(k)) {
        k += 1
      }
      if (k === n) {
        return s
      }
      p = at + 1
    }
  }

  /**
   * `findPrefix` by the scan, which is rarer than the prefix's rarest byte
   * alone. When `prefixExact` the scan's positions are the prefix's bytes and
   * a start it finds is a match.
   */
  findPrefixScan(text: string, from: i32): i32 {
    const len: i32 = toI32(text.length)
    const n: i32 = toI32(this.prefix.length)
    let p: i32 = from
    while (p >= 0 && p <= len) {
      const s: i32 = this.scanTo(text, p)
      if (s < 0 || this.prefixExact) {
        return s
      }
      if (s > len - n) {
        return -1
      }
      let k: i32 = 0
      while (k < n && text.charCodeAt(s + k) === this.prefix.charCodeAt(k)) {
        k += 1
      }
      if (k >= n) {
        return s
      }
      p = s + 1
    }
    return -1
  }

  /**
   * The first index at or after `from`, which is at least 0, whose bytes pass
   * every position of `posMasks`, or -1. No match starts anywhere it skips.
   */
  scanTo(text: string, from: i32): i32 {
    if (from > toI32(text.length)) {
      return -1
    }
    return regexScanFrom(text, this.posMasks, this.scanDepth, this.scanOff, this.scanWidth, from)
  }

  /** Where the next match can start at or after `p`, by the prefilter, or -1. */
  dSkipTo(text: string, p: i32): i32 {
    if (this.prefix !== "") {
      return this.findPrefix(text, p)
    }
    return this.scanTo(text, p)
  }

  /**
   * Split the characters into the classes the program cannot tell apart, and
   * size the DFA. Each ASCII byte, the end of the text and each interval of
   * code points between the program's boundaries is a unit; every literal,
   * class and kind the assertions read splits the units it holds from those
   * it does not. Leaves `dOk` false when the split or the table would be too
   * big, and the VM does all the work.
   */
  dfaInit(): void {
    this.dReady = true
    const total: i32 = this.pc()
    const count: i32 = this.fwdCount
    let bitsF: i32 = 0
    let bitsR: i32 = 0
    let anyNl: boolean = false
    let pc: i32 = 0
    while (pc < total) {
      const o: i32 = this.op[pc]
      if (o === OP_ASSERT) {
        if (pc < count) {
          bitsF |= 1 << this.ia[pc]
        } else {
          bitsR |= 1 << this.ia[pc]
        }
      } else if (o === OP_ANY_NL) {
        anyNl = true
      }
      pc += 1
    }
    const bits: i32 = bitsF | bitsR
    const lines: boolean = anyNl || (bits & ((1 << ASSERT_BEGIN_LINE) | (1 << ASSERT_END_LINE))) !== 0
    const words: boolean = (bits & ((1 << ASSERT_WORD) | (1 << ASSERT_NOT_WORD))) !== 0
    // The boundaries above ASCII: where a literal, a range or a line
    // terminator starts and where it stops. The reverse program reads the
    // same characters, so the forward one is enough.
    const classes: i32 = toI32(this.clsFrom.length)
    const seenCls: u8[] = new Array<u8>(classes)
    const points: i32[] = []
    pc = 0
    while (pc < count) {
      const o: i32 = this.op[pc]
      if (o === OP_CHAR) {
        const a: i32 = this.ia[pc]
        const b: i32 = this.ib[pc]
        if (a >= 128) {
          points.push(a)
          points.push(a + 1)
        }
        if (b >= 128 && b !== a) {
          points.push(b)
          points.push(b + 1)
        }
      } else if (o === OP_CLASS) {
        const k: i32 = this.ia[pc]
        if (seenCls[k] === 0) {
          seenCls[k] = 1
          let r: i32 = this.clsFrom[k]
          while (r < this.clsTo[k]) {
            const hi: i32 = this.clsHi[r]
            if (hi >= 128) {
              const lo: i32 = this.clsLo[r]
              points.push(lo > 128 ? lo : 128)
              points.push(hi + 1)
            }
            r += 1
          }
        }
      }
      pc += 1
    }
    if (lines) {
      points.push(0x2028)
      points.push(0x202a)
    }
    regexSortPoints(points)
    const lows: i32[] = [128]
    let i: i32 = 0
    while (i < toI32(points.length)) {
      const v: i32 = points[i]
      if (v > lows[toI32(lows.length) - 1]) {
        lows.push(v)
      }
      i += 1
    }
    const wide: i32 = toI32(lows.length)
    const units: i32 = 129 + wide
    if (units > DFA_MAX_UNITS) {
      return
    }
    const rep: i32[] = new Array<i32>(units)
    let u: i32 = 0
    while (u < 128) {
      rep[u] = u
      u += 1
    }
    rep[128] = -1
    i = 0
    while (i < wide) {
      rep[129 + i] = lows[i]
      i += 1
    }
    // Refine one predicate at a time: a unit's class is its old class and
    // whether the predicate holds for it.
    const cls: i32[] = new Array<i32>(units)
    const hit: u8[] = new Array<u8>(units)
    const remap: i32[] = new Array<i32>(2 * units)
    let n: i32 = 1
    let work: i32 = 0
    u = 0
    while (u < units) {
      hit[u] = toU8(u === 128 ? 1 : 0)
      u += 1
    }
    n = this.dRefine(cls, hit, units, n, remap)
    const pairs: u8[] = new Array<u8>(16384)
    i = 0
    while (i < classes) {
      seenCls[i] = 0
      i += 1
    }
    pc = 0
    while (pc < count) {
      const o: i32 = this.op[pc]
      const a: i32 = this.ia[pc]
      const b: i32 = this.ib[pc]
      let use: boolean = false
      if (o === OP_CHAR) {
        if (a < 128 && b < 128) {
          const key: i32 = a * 128 + b
          use = pairs[key] === 0
          pairs[key] = 1
        } else {
          use = true
        }
        if (use) {
          u = 0
          while (u < units) {
            hit[u] = toU8(rep[u] === a || rep[u] === b ? 1 : 0)
            u += 1
          }
        }
      } else if (o === OP_CLASS) {
        use = seenCls[a] === 0
        seenCls[a] = 1
        if (use) {
          u = 0
          while (u < units) {
            hit[u] = toU8(u !== 128 && this.classHas(a, rep[u]) ? 1 : 0)
            u += 1
          }
        }
      }
      if (use) {
        work += units
        if (work > DFA_MAX_WORK) {
          return
        }
        n = this.dRefine(cls, hit, units, n, remap)
      }
      pc += 1
    }
    if (lines) {
      u = 0
      while (u < units) {
        const r: i32 = rep[u]
        hit[u] = toU8(r === 10 || r === 13 || r === 0x2028 || r === 0x2029 ? 1 : 0)
        u += 1
      }
      n = this.dRefine(cls, hit, units, n, remap)
    }
    if (words) {
      u = 0
      while (u < units) {
        const r: i32 = rep[u]
        hit[u] = toU8(r >= 0 && r < 128 && isRegexWordByte(r) ? 1 : 0)
        u += 1
      }
      n = this.dRefine(cls, hit, units, n, remap)
    }
    // One column past the classes for every byte above ASCII, whose entries
    // stay 0: the hot loop reads such a byte as a transition it cannot take
    // and leaves for the slow path, which decodes the character.
    let shift: i32 = 0
    while (1 << shift < n + 1) {
      shift += 1
    }
    if (shift > DFA_MAX_SHIFT) {
      return
    }
    this.dShift = shift
    this.dCls = new Array<i32>(256)
    u = 0
    while (u < 256) {
      this.dCls[u] = u < 128 ? cls[u] : n
      u += 1
    }
    this.dEot = cls[128]
    this.dWlo = lows
    this.dWide = wide
    this.dWcls = new Array<i32>(wide)
    i = 0
    while (i < wide) {
      this.dWcls[i] = cls[129 + i]
      i += 1
    }
    // Each class's representative and kind: the first unit in it.
    this.dMaskF = regexContextMask(bitsF)
    this.dMaskR = regexContextMask(bitsR)
    this.dCtxFree =
      this.dMaskF[CTX_START] === CTX_OTHER &&
      this.dMaskF[CTX_WORD] === CTX_OTHER &&
      this.dMaskF[CTX_LINE] === CTX_OTHER
    this.dRep = new Array<i32>(n)
    this.dNextK = new Array<i32>(n)
    this.dCtxF = new Array<i32>(n)
    this.dCtxR = new Array<i32>(n)
    const done: u8[] = new Array<u8>(n)
    u = 0
    while (u < units) {
      const c: i32 = cls[u]
      if (done[c] === 0) {
        done[c] = 1
        const r: i32 = rep[u]
        this.dRep[c] = r
        let kind: i32 = CTX_OTHER
        if (r < 0) {
          kind = CTX_EOT
        } else if (r === 10 || r === 13 || r === 0x2028 || r === 0x2029) {
          kind = CTX_LINE
        } else if (r < 128 && isRegexWordByte(r)) {
          kind = CTX_WORD
        }
        this.dNextK[c] = kind
        this.dCtxF[c] = this.dMaskF[kind]
        this.dCtxR[c] = this.dMaskR[kind]
      }
      u += 1
    }
    this.dVisit = new Array<i32>(total)
    this.dLeaf = new Array<i32>(total)
    this.dBuf = new Array<i32>(total)
    this.dStk = new Array<i32>(total + 1)
    this.dMax = DFA_MAX_TABLE >> shift < DFA_MAX_STATES ? DFA_MAX_TABLE >> shift : DFA_MAX_STATES
    this.dCap = this.dMax < DFA_FIRST_STATES ? this.dMax : DFA_FIRST_STATES
    this.dTrans = new Array<i32>(this.dCap << shift)
    this.dStart = new Array<i32>(this.dCap)
    this.dLen = new Array<i32>(this.dCap)
    this.dFlags = new Array<i32>(this.dCap)
    this.dHash = new Array<i32>(this.dHashSize(this.dCap))
    this.dPoolMax = 2 * total > DFA_MIN_POOL ? 2 * total : DFA_MIN_POOL
    this.dPool = new Array<i32>(DFA_FIRST_POOL)
    this.dPoolLen = 0
    // Row 0 is never a state, so a plain transition, the next row's offset,
    // is never 0, the entry not yet computed.
    this.dCount = 1
    this.dStartOff = new Array<i32>(4 * CTX_SLOTS)
    this.dSkip = !this.anchored && (this.prefix !== "" || this.scanSel)
    this.dPrefFast = this.dSkip && this.dCtxFree && this.prefix !== "" && isRegexAscii(this.prefix)
    this.dPrefOff = 0
    this.dOk = true
  }

  /**
   * Split each of the `n` classes of `cls` by `hit`, numbering the new
   * classes in order of first appearance. Answers how many there are.
   */
  dRefine(cls: i32[], hit: u8[], units: i32, n: i32, remap: i32[]): i32 {
    let k: i32 = 0
    while (k < 2 * n) {
      remap[k] = -1
      k += 1
    }
    let next: i32 = 0
    let u: i32 = 0
    while (u < units) {
      const key: i32 = cls[u] * 2 + toI32(hit[u])
      if (remap[key] < 0) {
        remap[key] = next
        next += 1
      }
      cls[u] = remap[key]
      u += 1
    }
    return next
  }

  /** The smallest power of two that holds `cap` states at most half full. */
  dHashSize(cap: i32): i32 {
    let size: i32 = 1
    while (size < 2 * cap) {
      size *= 2
    }
    return size
  }

  /** The class of code point `cp`, which is above ASCII. */
  dWideClass(cp: i32): i32 {
    if (this.dWide === 1) {
      return this.dWcls[0]
    }
    let lo: i32 = 0
    let hi: i32 = this.dWide - 1
    while (lo < hi) {
      const mid: i32 = (lo + hi + 1) >> 1
      if (this.dWlo[mid] <= cp) {
        lo = mid
      } else {
        hi = mid - 1
      }
    }
    return this.dWcls[lo]
  }

  /** Whether assertion `kind` holds between a character of kind `ctx` and one of kind `nk`. */
  dAssert(kind: i32, ctx: i32, nk: i32): boolean {
    if (kind === ASSERT_BEGIN_TEXT) {
      return ctx === CTX_START
    }
    if (kind === ASSERT_END_TEXT) {
      return nk === CTX_EOT
    }
    if (kind === ASSERT_BEGIN_LINE) {
      return ctx === CTX_START || ctx === CTX_LINE
    }
    if (kind === ASSERT_END_LINE) {
      return nk === CTX_EOT || nk === CTX_LINE
    }
    const boundary: boolean = (ctx === CTX_WORD) !== (nk === CTX_WORD)
    return kind === ASSERT_WORD ? boundary : !boundary
  }

  /**
   * Follow every instruction from `pc0` that consumes nothing, between a
   * character of kind `ctx` and one of kind `nk`, and append the ones that
   * wait for a character or match to `dLeaf` in priority order. Answers the
   * new length.
   */
  dClose(pc0: i32, ctx: i32, nk: i32, n0: i32): i32 {
    let n: i32 = n0
    this.dStk[0] = pc0
    let top: i32 = 1
    while (top > 0) {
      top -= 1
      let pc: i32 = this.dStk[top]
      while (true) {
        if (this.dVisit[pc] === this.dGen) {
          break
        }
        this.dVisit[pc] = this.dGen
        const o: i32 = this.op[pc]
        if (o === OP_JMP) {
          pc = this.ia[pc]
          continue
        }
        if (o === OP_SPLIT) {
          this.dStk[top] = this.ib[pc]
          top += 1
          pc = this.ia[pc]
          continue
        }
        if (o === OP_SAVE || o === OP_MARK || o === OP_CLEAR || o === OP_CHECK) {
          pc += 1
          continue
        }
        if (o === OP_ASSERT) {
          if (this.dAssert(this.ia[pc], ctx, nk)) {
            pc += 1
            continue
          }
          break
        }
        this.dLeaf[n] = pc
        n += 1
        break
      }
    }
    return n
  }

  /**
   * Compute and record the transition from the state at `off` on class `c`,
   * read at byte `p`. Answers the entry as stored, or 0 when the cache gave up.
   */
  dStep(off: i32, c: i32, p: i32): i32 {
    const id: i32 = off >> this.dShift
    const start: i32 = this.dStart[id]
    const len: i32 = this.dLen[id]
    const flags: i32 = this.dFlags[id]
    const restart: boolean = (flags & DFA_RESTART) !== 0
    const rev: boolean = (flags & DFA_REV) !== 0
    const ctx: i32 = (flags >> 1) & 3
    const nk: i32 = this.dNextK[c]
    const epoch: i32 = this.dEpoch
    if (this.dGen >= 2147483647) {
      let k: i32 = 0
      while (k < toI32(this.dVisit.length)) {
        this.dVisit[k] = 0
        k += 1
      }
      this.dGen = 0
    }
    this.dGen += 1
    let n: i32 = 0
    let i: i32 = 0
    while (i < len) {
      n = this.dClose(this.dPool[start + i], ctx, nk, n)
      i += 1
    }
    if (restart) {
      n = this.dClose(REGEX_ENTRY, ctx, nk, n)
    }
    let matched: boolean = false
    let entry: i32 = DFA_KNOWN | DFA_DEAD
    let to: i32 = 0
    if (c === this.dEot) {
      i = 0
      while (i < n) {
        if (this.op[this.dLeaf[i]] === OP_MATCH) {
          matched = true
          break
        }
        i += 1
      }
    } else {
      const r: i32 = this.dRep[c]
      let nb: i32 = 0
      i = 0
      while (i < n) {
        const pc: i32 = this.dLeaf[i]
        i += 1
        const o: i32 = this.op[pc]
        let hit: boolean = false
        if (o === OP_CHAR) {
          hit = r === this.ia[pc] || r === this.ib[pc]
        } else if (o === OP_CLASS) {
          hit = this.classHas(this.ia[pc], r)
        } else if (o === OP_ANY) {
          hit = true
        } else if (o === OP_ANY_NL) {
          hit = nk !== CTX_LINE
        } else if (o === OP_MATCH) {
          matched = true
          if (!rev) {
            // Every thread after this one has lower priority.
            break
          }
        }
        if (hit) {
          this.dBuf[nb] = pc + 1
          nb += 1
        }
      }
      const restart2: boolean = restart && !matched
      if (nb > 0 || restart2) {
        const ctx2: i32 = rev ? this.dCtxR[c] : this.dCtxF[c]
        let flags2: i32 = ctx2 << 1
        if (restart2) {
          flags2 |= DFA_RESTART
        }
        if (rev) {
          flags2 |= DFA_REV
        }
        const next: i32 = this.dIntern(nb, flags2, p)
        if (next < 0) {
          return 0
        }
        to = next
        entry = (next << 4) | DFA_KNOWN
        if (nb === 0 && this.dSkip) {
          entry |= DFA_IDLE
        }
      }
    }
    if (matched) {
      entry |= DFA_MATCH
    }
    if (to !== 0 && entry === ((to << 4) | DFA_KNOWN)) {
      entry = to
    } else {
      entry = -entry
    }
    if (epoch === this.dEpoch) {
      this.dTrans[off + c] = entry
    }
    return entry
  }

  /** The hash of a state's flags and its `n` instructions in `src` from `at`. */
  dHashOf(src: i32[], at: i32, n: i32, flags: i32): i32 {
    let h: i32 = flags
    let i: i32 = 0
    while (i < n) {
      h = (h * 31 + src[at + i]) & DFA_HASH_MASK
      i += 1
    }
    return h
  }

  /**
   * The offset of the state with flags `flags` and the `n` instructions in
   * `dBuf`, made if it is new. Answers -1 when the cache is full and was
   * cleared too recently, at byte `p`, to clear again.
   */
  dIntern(n: i32, flags: i32, p: i32): i32 {
    const mask: i32 = toI32(this.dHash.length) - 1
    const at: i32 = 0
    let slot: i32 = this.dHashOf(this.dBuf, at, n, flags) & mask
    while (this.dHash[slot] !== 0) {
      const id: i32 = this.dHash[slot] - 1
      if (this.dFlags[id] === flags && this.dLen[id] === n) {
        const start: i32 = this.dStart[id]
        let k: i32 = 0
        while (k < n && this.dPool[start + k] === this.dBuf[k]) {
          k += 1
        }
        if (k === n) {
          return id << this.dShift
        }
      }
      slot = (slot + 1) & mask
    }
    if (this.dCount === this.dCap) {
      if (this.dCap < this.dMax) {
        this.dGrow()
      } else if (!this.dFlush(p)) {
        return -1
      }
      return this.dIntern(n, flags, p)
    }
    if (this.dPoolLen + n > toI32(this.dPool.length)) {
      const size: i32 = toI32(this.dPool.length)
      if (size >= this.dPoolMax) {
        if (!this.dFlush(p)) {
          return -1
        }
        return this.dIntern(n, flags, p)
      }
      let grown: i32 = 2 * size
      while (grown < this.dPoolLen + n) {
        grown *= 2
      }
      if (grown > this.dPoolMax) {
        grown = this.dPoolMax
      }
      const pool: i32[] = new Array<i32>(grown)
      let k: i32 = 0
      while (k < this.dPoolLen) {
        pool[k] = this.dPool[k]
        k += 1
      }
      this.dPool = pool
    }
    const id: i32 = this.dCount
    this.dCount += 1
    this.dStart[id] = this.dPoolLen
    this.dLen[id] = n
    this.dFlags[id] = flags
    let k: i32 = 0
    while (k < n) {
      this.dPool[this.dPoolLen + k] = this.dBuf[k]
      k += 1
    }
    this.dPoolLen += n
    const off: i32 = id << this.dShift
    const row: i32 = 1 << this.dShift
    k = 0
    while (k < row) {
      this.dTrans[off + k] = 0
      k += 1
    }
    this.dHash[slot] = id + 1
    return off
  }

  /** Double the state table, up to `dMax` states. */
  dGrow(): void {
    let cap: i32 = 2 * this.dCap
    if (cap > this.dMax) {
      cap = this.dMax
    }
    const used: i32 = this.dCount << this.dShift
    const trans: i32[] = new Array<i32>(cap << this.dShift)
    let k: i32 = 0
    while (k < used) {
      trans[k] = this.dTrans[k]
      k += 1
    }
    const start: i32[] = new Array<i32>(cap)
    const len: i32[] = new Array<i32>(cap)
    const flags: i32[] = new Array<i32>(cap)
    const hash: i32[] = new Array<i32>(this.dHashSize(cap))
    const mask: i32 = toI32(hash.length) - 1
    k = 1
    while (k < this.dCount) {
      start[k] = this.dStart[k]
      len[k] = this.dLen[k]
      flags[k] = this.dFlags[k]
      let slot: i32 = this.dHashOf(this.dPool, start[k], len[k], flags[k]) & mask
      while (hash[slot] !== 0) {
        slot = (slot + 1) & mask
      }
      hash[slot] = k + 1
      k += 1
    }
    this.dTrans = trans
    this.dStart = start
    this.dLen = len
    this.dFlags = flags
    this.dHash = hash
    this.dCap = cap
  }

  /**
   * Forget every state, unless the cache was cleared more than a few times
   * already and fewer than 10 bytes per state ago: then the DFA is building a
   * state for nearly every byte and the VM is cheaper. Answers whether it
   * cleared.
   */
  dFlush(p: i32): boolean {
    this.dFlushes += 1
    const moved: i32 = p > this.dPos ? p - this.dPos : this.dPos - p
    if (this.dFlushes > DFA_FREE_FLUSHES && moved < DFA_BYTES_PER_STATE * this.dMax) {
      return false
    }
    this.dPos = p
    this.dCount = 1
    this.dPoolLen = 0
    let k: i32 = 0
    while (k < toI32(this.dHash.length)) {
      this.dHash[k] = 0
      k += 1
    }
    k = 0
    while (k < toI32(this.dStartOff.length)) {
      this.dStartOff[k] = 0
      k += 1
    }
    this.dPrefOff = 0
    this.dEpoch = (this.dEpoch + 1) & DFA_EPOCH_MASK
    return true
  }

  /** The start state for `mode` after a character of kind `ctx`, or -1. */
  dStartAt(mode: i32, ctx: i32, p: i32): i32 {
    const k: i32 = mode * CTX_SLOTS + ctx
    const cached: i32 = this.dStartOff[k]
    if (cached > 0) {
      return cached - 1
    }
    let n: i32 = 0
    let flags: i32 = ctx << 1
    if (mode === DFA_UNANCHORED) {
      flags |= DFA_RESTART
    } else if (mode === DFA_ANCHORED) {
      this.dBuf[0] = REGEX_ENTRY
      n = 1
    } else {
      this.dBuf[0] = mode === DFA_INNER ? this.innerEntry : this.revEntry
      n = 1
      flags |= DFA_REV
    }
    const off: i32 = this.dIntern(n, flags, p)
    if (off >= 0) {
      this.dStartOff[k] = off + 1
    }
    return off
  }

  /**
   * The unanchored start state after the bytes of `prefix`, read from byte
   * `p`, or -1 when a step on the way is not a plain transition; then
   * `dPrefFast` goes off.
   */
  dAfterPrefix(p: i32): i32 {
    let off: i32 = this.dStartAt(DFA_UNANCHORED, this.dMaskF[CTX_OTHER], p)
    const n: i32 = toI32(this.prefix.length)
    let k: i32 = 0
    while (off >= 0 && k < n) {
      const c: i32 = this.dCls[toI32(this.prefix.charCodeAt(k))]
      let e: i32 = this.dTrans[off + c]
      if (e === 0) {
        e = this.dStep(off, c, p + k)
      }
      off = e > 0 ? e : -1
      k += 1
    }
    if (off < 0) {
      this.dPrefFast = false
      return -1
    }
    this.dPrefOff = off + 1
    return off
  }

  /** The kind of the character before byte `p`, as the forward program tells kinds apart. */
  ctxBefore(text: string, p: i32): i32 {
    let kind: i32 = CTX_OTHER
    if (p <= 0) {
      kind = CTX_START
    } else {
      const b: i32 = toI32(text.charCodeAt(p - 1))
      if (b === 10 || b === 13) {
        kind = CTX_LINE
      } else if (isRegexWordByte(b)) {
        kind = CTX_WORD
      } else if (
        (b === 0xa8 || b === 0xa9) &&
        p >= 3 &&
        toI32(text.charCodeAt(p - 2)) === 0x80 &&
        toI32(text.charCodeAt(p - 3)) === 0xe2
      ) {
        kind = CTX_LINE
      }
    }
    return this.dMaskF[kind]
  }

  /** The kind of the character at byte `p`, as the reverse program tells kinds apart. */
  ctxAt(text: string, p: i32): i32 {
    const len: i32 = toI32(text.length)
    let kind: i32 = CTX_OTHER
    if (p >= len) {
      kind = CTX_START
    } else {
      const b: i32 = toI32(text.charCodeAt(p))
      if (b === 10 || b === 13) {
        kind = CTX_LINE
      } else if (isRegexWordByte(b)) {
        kind = CTX_WORD
      } else if (b === 0xe2 && p + 2 < len && toI32(text.charCodeAt(p + 1)) === 0x80) {
        const b2: i32 = toI32(text.charCodeAt(p + 2))
        if (b2 === 0xa8 || b2 === 0xa9) {
          kind = CTX_LINE
        }
      }
    }
    return this.dMaskR[kind]
  }

  /**
   * The forward DFA: where the leftmost-first match at or after `from` ends,
   * or, with `first`, where the earliest-ending match does — enough to know
   * there is one. `pinned` tries only a match that starts at `from`. Answers
   * `DFA_NONE` or `DFA_GAVE_UP` otherwise, and leaves where it stopped
   * reading in `dStop`.
   */
  dfaForward(text: string, from: i32, first: boolean, pinned: boolean): i32 {
    const len: i32 = toI32(text.length)
    const mode: i32 = this.anchored || pinned ? DFA_ANCHORED : DFA_UNANCHORED
    let p: i32 = from
    this.dStop = len
    let off: i32 = -1
    if (this.dSkip && !pinned) {
      p = this.dSkipTo(text, p)
      if (p < 0) {
        return DFA_NONE
      }
      if (this.dPrefFast) {
        // The prefix is at `p`: start past it.
        off = this.dPrefOff > 0 ? this.dPrefOff - 1 : this.dAfterPrefix(p)
        if (off >= 0) {
          p += toI32(this.prefix.length)
        }
      }
    }
    if (off < 0) {
      off = this.dStartAt(mode, this.dCtxFree ? this.dMaskF[CTX_OTHER] : this.ctxBefore(text, p), p)
      if (off < 0) {
        return DFA_GAVE_UP
      }
    }
    let end: i32 = DFA_NONE
    let trans: i32[] = this.dTrans
    const cls: i32[] = this.dCls
    while (true) {
      // The hot loop: an ASCII byte and a transition already computed.
      while (p < len) {
        const b: i32 = toI32(text.charCodeAt(p))
        const e: i32 = uncheckedGet(trans, off | uncheckedGet(cls, b))
        if (e > 0) {
          off = e
          p += 1
        } else if (e === 0 || (-e & (DFA_DEAD | DFA_IDLE)) !== 0) {
          break
        } else {
          // A match ends before this byte and the search goes on.
          if (first) {
            this.dStop = p
            return p
          }
          end = p
          off = -e >> 4
          p += 1
        }
      }
      let c: i32 = this.dEot
      let w: i32 = 1
      if (p < len) {
        const b: i32 = toI32(text.charCodeAt(p))
        if (b < 128) {
          c = cls[b]
        } else {
          const packed: i32 = regexDecodeAt(text, p, len)
          c = this.dWideClass(packed >> 3)
          w = packed & 7
        }
      }
      let e: i32 = trans[off + c]
      if (e === 0) {
        e = this.dStep(off, c, p)
        if (e === 0) {
          return DFA_GAVE_UP
        }
        trans = this.dTrans
      }
      if (e > 0) {
        if (p >= len) {
          this.dStop = p
          return end
        }
        off = e
        p += w
        continue
      }
      e = -e
      if ((e & DFA_MATCH) !== 0) {
        if (first) {
          this.dStop = p
          return p
        }
        end = p
      }
      if ((e & DFA_DEAD) !== 0 || p >= len) {
        this.dStop = p
        return end
      }
      off = e >> 4
      p += w
      if ((e & DFA_IDLE) !== 0) {
        // No thread is alive and no match has been seen: skip to where the
        // next one can start. The state reached is the start state there
        // when the skip stays put or no assertion reads the context.
        const q: i32 = this.dSkipTo(text, p)
        if (q < 0) {
          return end
        }
        if (q !== p && !this.dCtxFree) {
          off = this.dStartAt(DFA_UNANCHORED, this.ctxBefore(text, q), q)
          if (off < 0) {
            return DFA_GAVE_UP
          }
          trans = this.dTrans
        }
        p = q
        if (this.dPrefOff > 0 && this.dPrefFast) {
          off = this.dPrefOff - 1
          p = q + toI32(this.prefix.length)
        }
      }
    }
  }

  /**
   * The reverse DFA: where the match that ends at `e` starts, the furthest
   * back at or after `from`, or in `DFA_INNER` mode where the part before
   * `innerLit` does when the literal is at `e`. Answers `DFA_NONE` or
   * `DFA_GAVE_UP` otherwise.
   */
  dfaReverse(text: string, from: i32, e: i32, mode: i32): i32 {
    const len: i32 = toI32(text.length)
    let p: i32 = e
    let off: i32 = this.dStartAt(mode, this.ctxAt(text, e), e)
    if (off < 0) {
      return DFA_GAVE_UP
    }
    let s: i32 = DFA_NONE
    let trans: i32[] = this.dTrans
    const cls: i32[] = this.dCls
    while (true) {
      while (p > from) {
        const b: i32 = toI32(text.charCodeAt(p - 1))
        const t: i32 = uncheckedGet(trans, off | uncheckedGet(cls, b))
        if (t > 0) {
          off = t
          p -= 1
        } else if (t === 0 || (-t & DFA_DEAD) !== 0) {
          break
        } else {
          if ((-t & DFA_MATCH) !== 0) {
            s = p
          }
          off = -t >> 4
          p -= 1
        }
      }
      // The character before `p`. At `from` it is read only for its kind,
      // so it is decoded from the start of the text.
      let c: i32 = this.dEot
      let w: i32 = 1
      if (p > 0) {
        const b: i32 = toI32(text.charCodeAt(p - 1))
        if (b < 128) {
          c = cls[b]
        } else {
          const lim: i32 = p > from ? from : 0
          let cp: i32 = REGEX_INVALID + b
          let k: i32 = 2
          while (k <= 4 && p - k >= lim) {
            const lead: i32 = toI32(text.charCodeAt(p - k))
            if (lead >= 0xc2) {
              const packed: i32 = regexDecodeAt(text, p - k, len)
              if ((packed & 7) === k) {
                cp = packed >> 3
                w = k
              }
              break
            }
            if (lead < 0x80 || lead >= 0xc0) {
              break
            }
            k += 1
          }
          c = this.dWideClass(cp)
        }
      }
      let t: i32 = trans[off + c]
      if (t === 0) {
        t = this.dStep(off, c, p)
        if (t === 0) {
          return DFA_GAVE_UP
        }
        trans = this.dTrans
      }
      if (t > 0) {
        if (p <= from) {
          return s
        }
        off = t
        p -= w
        continue
      }
      t = -t
      if ((t & DFA_MATCH) !== 0) {
        s = p
      }
      if ((t & DFA_DEAD) !== 0 || p <= from) {
        return s
      }
      off = t >> 4
      p -= w
    }
  }

  /**
   * The leftmost-first match at or after `from`, found by `innerLit`: its end,
   * with its start in `dBegin`, or with `first` the earliest end of a match
   * that starts there. Answers `DFA_NONE` or `DFA_GAVE_UP` otherwise.
   *
   * The part before the literal cannot read its first byte, so a match that
   * starts at or before the literal's first occurrence `i` holds that
   * occurrence, and one that starts after it, a later one. The reverse DFA
   * finds the furthest-back start of the part before `i`; whether a match
   * goes on from the literal does not depend on that start, so the forward
   * DFA from it either finds the match or rules out every start up to `i`.
   * That forward search can read past `i` in vain each time, so the bytes it
   * wastes are counted against those the search moves past, over the life of
   * the regex: past twice those and a slack, the inner search is dropped for
   * the plain one, which keeps the cost linear.
   */
  dfaInner(text: string, from: i32, first: boolean): i32 {
    let lower: i32 = from
    while (this.innerLit !== "") {
      const i: i32 = toI32(text.indexOf(this.innerLit, lower))
      if (i < 0) {
        return DFA_NONE
      }
      this.innerGain += toF64(i + 1 - lower)
      const s: i32 = this.dfaReverse(text, lower, i, DFA_INNER)
      if (s === DFA_GAVE_UP) {
        return DFA_GAVE_UP
      }
      if (s >= 0) {
        const e: i32 = this.dfaForward(text, s, first, true)
        if (e !== DFA_NONE) {
          this.dBegin = s
          return e
        }
        this.innerWaste += toF64(this.dStop - i)
        if (this.innerWaste > 2.0 * this.innerGain + DFA_INNER_SLACK) {
          this.innerLit = ""
        }
      }
      lower = i + 1
    }
    // No match starts before `lower`.
    const e: i32 = this.dfaForward(text, lower, first, false)
    if (e < 0) {
      return e
    }
    this.dBegin = this.dfaReverse(text, lower, e, DFA_REVERSE)
    return this.dBegin < 0 ? DFA_GAVE_UP : e
  }

  /**
   * Whether the pattern matches `text` at or after byte `from`, and the
   * leftmost-first match's first `want` slots in `mslots`: the DFA finds
   * whether there is one and where it ends, the reverse DFA where it starts,
   * and the VM, from that start, the groups.
   */
  run(text: string, from: i32, want: i32): boolean {
    const len: i32 = toI32(text.length)
    if (from < 0 || from > len) {
      return false
    }
    if (this.literal) {
      const at: i32 = this.findPrefix(text, from)
      if (at < 0) {
        return false
      }
      if (want >= REGEX_WANT_BOUNDS) {
        this.mslots[0] = at
        this.mslots[1] = at + toI32(this.prefix.length)
      }
      return true
    }
    if (!this.dReady) {
      this.dfaInit()
    }
    if (this.dOk && this.innerLit !== "") {
      const e: i32 = this.dfaInner(text, from, want === REGEX_WANT_NONE)
      if (e === DFA_NONE) {
        return false
      }
      if (e >= 0 && want <= REGEX_WANT_BOUNDS) {
        if (want > 0) {
          this.mslots[0] = this.dBegin
          this.mslots[1] = e
        }
        return true
      }
      if (e >= 0) {
        return this.vm(text, this.dBegin, want, true)
      }
    } else if (this.dOk) {
      if (want === REGEX_WANT_NONE) {
        const e: i32 = this.dfaForward(text, from, true, false)
        if (e !== DFA_GAVE_UP) {
          return e >= 0
        }
      } else if (this.revOk) {
        const e: i32 = this.dfaForward(text, from, false, false)
        if (e === DFA_NONE) {
          return false
        }
        if (e >= 0) {
          const s: i32 = this.dfaReverse(text, from, e, DFA_REVERSE)
          if (s >= 0 && want <= REGEX_WANT_BOUNDS) {
            this.mslots[0] = s
            this.mslots[1] = e
            return true
          }
          if (s >= 0) {
            return this.vm(text, s, want, true)
          }
        }
      }
    }
    return this.vm(text, from, want, false)
  }

  /**
   * The VM: whether the pattern matches `text` at or after byte `from`, and
   * the leftmost-first match's first `want` slots in `mslots`. `want` is 0 to
   * learn only whether there is a match, 2 for its bounds, or every group's.
   * Any slots at all bring the marks along, because which match comes first
   * depends on them. `pinned` tries only a match that starts at `from`.
   */
  vm(text: string, from: i32, want: i32, pinned: boolean): boolean {
    const ns: i32 = want > 0 && this.width > 2 * this.groups ? this.width : want
    const len: i32 = toI32(text.length)
    const anchored: boolean = this.anchored || pinned
    const hasPrefix: boolean = this.prefix !== ""
    const hasScan: boolean = this.scanSel
    const hasSet: boolean = toI32(this.firstSet.length) > 0
    this.cCount = 0
    let matched: boolean = false
    let p: i32 = from
    while (true) {
      if (!matched && (p === from || !anchored)) {
        if (this.cCount === 0) {
          if (!anchored) {
            if (hasPrefix) {
              const at: i32 = this.findPrefix(text, p)
              if (at < 0) {
                break
              }
              p = at
            } else if (hasScan) {
              const at: i32 = this.scanTo(text, p)
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
        if (matched || anchored || p >= len) {
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
    if (this.literal && this.prefix !== "") {
      const n0: i32 = toI32(this.prefix.length)
      while (true) {
        const at: i32 = this.findPrefix(text, pos)
        if (at < 0) {
          return n
        }
        n += 1
        pos = at + n0
      }
    }
    if (!this.dReady) {
      this.dfaInit()
    }
    // A match that cannot be empty ends past where its search started, so
    // the forward DFA alone counts them; marks could move the end.
    if (this.dOk && !this.literal && !this.nullable && this.width === 2 * this.groups) {
      while (pos <= len) {
        let e: i32 = DFA_NONE
        if (this.innerLit !== "") {
          e = this.dfaInner(text, pos, false)
        } else {
          e = this.dfaForward(text, pos, false, false)
        }
        if (e === DFA_NONE) {
          return n
        }
        if (e === DFA_GAVE_UP) {
          break
        }
        n += 1
        pos = e
      }
    }
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
