/**
 * `std/json` — the value of a field, or of several, of one flat JSON object.
 *
 * It exists because the compiler's own machine-readable surface is JSON: under
 * `--json` every diagnostic is one flat object on a line of stdout, whose `code`
 * is a stable rule identifier (`AGENTS.md`, and `docs/wp12-release.md` for the
 * exit-code bands). A Nish program that reads that surface — a wrapper, an
 * editor plug-in, or `tests/nish/cli.ts`, which pins the contract — needs the
 * value of a named field and nothing else, and the language has no `JSON.parse`
 * to give it.
 *
 * So this is a **reader, not a parser**, and the difference is worth stating:
 *
 *   - It answers **text**. A string field comes back with its escapes decoded
 *     and without its quotes; a number, a `true` or a `null` comes back as the
 *     bytes it was written with, for `parseInt` or `===` at the call site. A
 *     field whose value is `null` and one whose value is the *string* `"null"`
 *     therefore answer the same thing, which is the one ambiguity a program that
 *     needs to tell them apart cannot live with — and the sign that it wants a
 *     real parser rather than this.
 *   - It answers `null` for a field that is not there, so "absent" and "empty"
 *     stay apart the way they do in `getenv`.
 *   - It **does not validate**. A nested object or array is stepped over so that
 *     the fields after it are still reachable, and a truncated object still
 *     answers the fields that precede the truncation. A program that has to know
 *     whether the whole line was well-formed is asking a question this does not
 *     answer.
 *
 * There are two exported functions, and few on purpose. A `std/` module is
 * compiled into the program that imports it and the symbol namespace is flat
 * (`std/README.md`), so every name here is a name its importer cannot use: the
 * helpers are `json`-prefixed and the readers are the only exports. Splitting a
 * stream into lines and picking the ones that start with `{` is two calls the
 * caller already has — `splitLines` from `std/text` and `startsWith` — and
 * duplicating them here would cost more names than it saves.
 *
 *     import { jsonField } from "nish/json";
 *
 *     for (const line of splitLines(stdout)) {
 *       if (!line.startsWith("{")) {
 *         continue;
 *       }
 *       const code = jsonField(line, "code");
 *       if (code !== null && code === "NL0003") {
 *         panic("the compiler crashed");
 *       }
 *     }
 *
 * `jsonField` scans from the start of the line on every call, so a caller that
 * wants three fields of each line reads each line three times. `jsonFields`
 * reads it once: `jsonFields(line, ["code", "line", "message"])` answers an
 * array whose slot `k` is exactly what `jsonField(line, names[k])` answers —
 * absent, first-of-a-duplicate and malformed input included — because the two
 * share the step that reads one member (`jsonReadMember`) and stop at the same
 * one. Its array goes back to the caller with the values in it, so a loop that
 * calls it keeps its per-pass arena release, as one calling `jsonField` does;
 * `jsonFields`' own comment says when that holds.
 *
 * Every offset here is a **byte** offset and every width is spelled, with each
 * length and byte a builtin answers read through `toI32` — `.length` and
 * `charCodeAt` answer `number`, which is `f64` under `--number-mode f64`, so the
 * conversion is what makes this one module in both modes rather than two
 * (`docs/wp26-stdlib.md` §4).
 */

const JSON_BACKSPACE: i32 = 8
const JSON_TAB: i32 = 9
const JSON_NEWLINE: i32 = 10
const JSON_FORM_FEED: i32 = 12
const JSON_CARRIAGE_RETURN: i32 = 13
const JSON_SPACE: i32 = 32
const JSON_QUOTE: i32 = 34
const JSON_COMMA: i32 = 44
const JSON_COLON: i32 = 58
const JSON_BACKSLASH: i32 = 92
const JSON_LETTER_U: i32 = 117
const JSON_OPEN_BRACKET: i32 = 91
const JSON_CLOSE_BRACKET: i32 = 93
const JSON_OPEN_BRACE: i32 = 123
const JSON_CLOSE_BRACE: i32 = 125
/**
 * The UTF-8 tags a `\u` escape is rebuilt out of: a two-byte lead is
 * `110xxxxx`, a three-byte lead `1110xxxx`, a continuation byte `10xxxxxx`, and
 * `LOW_SIX` is the six bits each continuation carries.
 *
 * They are named constants rather than the literals `192`, `224`, `128` and `63`
 * for a reason that is the module's rule and not a style preference: a bare
 * numeric literal is a `number`, which is an `f64` under `--number-mode f64`, so
 * `192 + (code >> 6)` adds an `f64` to an `i32` there and does not compile at all
 * (`docs/wp26-stdlib.md` §4, and `tests/link/std_text_f64` is what says so). A
 * constant declared `i32` means the same thing in both modes.
 */
const JSON_UTF8_TWO_BYTE_LEAD: i32 = 192
const JSON_UTF8_THREE_BYTE_LEAD: i32 = 224
const JSON_UTF8_CONTINUATION: i32 = 128
const JSON_UTF8_LOW_SIX: i32 = 63
/** The first code point that needs two UTF-8 bytes, and the first that needs three. */
const JSON_UTF8_TWO_BYTE_FLOOR: i32 = 128
const JSON_UTF8_THREE_BYTE_FLOOR: i32 = 2048
/** The base `jsonHex4` accumulates in. */
const JSON_HEX_BASE: i32 = 16

/** The four bytes JSON allows between tokens. */
const jsonIsBlankByte = (code: i32): boolean =>
  code === JSON_SPACE || code === JSON_TAB || code === JSON_NEWLINE || code === JSON_CARRIAGE_RETURN

/**
 * The first index at or after `from` that is not blank, or the length.
 *
 * Every caller hands in an index it has already found, so `from` is never
 * negative; the guard says so in a form the bounds proof reads, and is what
 * lets the loop below read `text` without a check.
 */
const jsonSkipBlank = (text: string, from: i32): i32 => {
  if (from < 0) {
    return from
  }
  const length: i32 = toI32(text.length)
  let i: i32 = from
  while (i < length && jsonIsBlankByte(toI32(text.charCodeAt(i)))) {
    i += 1
  }
  return i
}

/**
 * How many bytes of a string body the scanners read one at a time before they
 * hand the rest to `jsonClosingQuote`. A key or a short value ends inside
 * them, and for those a call into the runtime costs more than the bytes do.
 */
const JSON_INLINE_SCAN: i32 = 16

/**
 * The index of the closing quote of a string body that has run on past the
 * bytes the scanners read one at a time, searching from `start`, a byte no
 * backslash has taken; `-1` when no quote closes it.
 *
 * The body is not walked: `indexOf` jumps to the next quote, which is one
 * `memchr` in the runtime, and the run of backslashes just before that quote
 * says whether it is escaped. The byte before the run is not a backslash — at
 * the latest it is the opening quote — so the run starts where an escape can:
 * an odd run ends in a backslash that takes this quote, and an even one is
 * pairs of `\\` that leave it alone. The run may reach back past `start`, and
 * that changes nothing: what lies before `start` ends on a byte no escape took,
 * so any backslashes there are whole pairs. An escaped quote moves the search
 * one byte past it, and the next run's count stops at that quote, so every
 * backslash is counted once.
 *
 * The byte loops stay in the scanners rather than in here: most strings end
 * in them and never make this call.
 */
const jsonClosingQuote = (text: string, start: i32): i32 => {
  const length: i32 = toI32(text.length)
  if (start < 0) {
    return -1
  }
  let quote: i32 = toI32(text.indexOf('"', start))
  // `quote >= start` is false for the `-1` of a miss.
  while (quote >= start && quote < length) {
    // The count stops at the opening quote at the latest, so `j >= 0` always
    // holds, and `j < length` does because `j` starts below `quote`; both are
    // spelled out because the bounds proof reads neither from a decrement of a
    // callee's answer.
    let j: i32 = quote - 1
    while (j >= 0 && j < length && toI32(text.charCodeAt(j)) === JSON_BACKSLASH) {
      j -= 1
    }
    if (((quote - 1 - j) & 1) === 0) {
      return quote
    }
    quote = toI32(text.indexOf('"', quote + 1))
  }
  return -1
}

/**
 * The index just past the string literal whose opening quote is at `at`, or `-1`
 * when the quote is never closed. A backslash takes the byte after it with it,
 * which is all a scanner needs to know about escapes: `\"` cannot end the
 * literal and `\\` cannot make the next quote an escape. The first
 * `JSON_INLINE_SCAN` bytes are read here and the rest searched by
 * `jsonClosingQuote`; the step over an escape can take the cursor one past
 * them, which is still a byte no backslash has taken.
 */
const jsonEndOfString = (text: string, at: i32): i32 => {
  const length: i32 = toI32(text.length)
  if (at < 0) {
    return -1
  }
  const stop: i32 = at + 1 + JSON_INLINE_SCAN < length ? at + 1 + JSON_INLINE_SCAN : length
  let i: i32 = at + 1
  // `i < length` follows from `i < stop`, and is there for the bounds proof.
  while (i < stop && i < length) {
    const code: i32 = toI32(text.charCodeAt(i))
    if (code === JSON_BACKSLASH) {
      i += 2
      continue
    }
    if (code === JSON_QUOTE) {
      return i + 1
    }
    i += 1
  }
  if (i >= length) {
    return -1
  }
  const quote: i32 = jsonClosingQuote(text, i)
  return quote < 0 ? -1 : quote + 1
}

/**
 * The index just past the value that starts at `at`, or `-1` when it does not
 * end.
 *
 * A string ends at its quote and an object or array at the closer that brings
 * the depth back to zero, with strings inside it skipped whole so that a `}` in
 * a message cannot close it. Anything else — a number, `true`, `false`, `null` —
 * ends at the first byte that cannot be part of it, which is the comma, the
 * closer or the blank that follows.
 *
 * A string value goes through the same loop as a string inside an object, and
 * ends where its closing quote leaves the loop at depth zero. Each string is
 * read as `jsonEndOfString` reads one, its first `JSON_INLINE_SCAN` bytes a
 * byte at a time and the rest searched by `jsonClosingQuote`, and the byte loop
 * is written out here rather than called: a call to `jsonEndOfString` from
 * a second site is one LLVM stops inlining into `jsonReadMember`, and a call
 * per string is what a line of short strings feels most.
 */
const jsonEndOfValue = (text: string, at: i32): i32 => {
  const length: i32 = toI32(text.length)
  if (at < 0 || at >= length) {
    return -1
  }
  const first: i32 = toI32(text.charCodeAt(at))
  if (first === JSON_QUOTE || first === JSON_OPEN_BRACE || first === JSON_OPEN_BRACKET) {
    let depth: i32 = 0
    let i: i32 = at
    // `i >= 0` always holds — `i` starts at `at` and only moves forward — and
    // is in the test because a long string moves `i` to where
    // `jsonClosingQuote` answers, and a cursor assigned a callee's answer is
    // one the bounds proof stops following.
    while (i >= 0 && i < length) {
      const code: i32 = toI32(text.charCodeAt(i))
      if (code === JSON_QUOTE) {
        const stop: i32 = i + 1 + JSON_INLINE_SCAN < length ? i + 1 + JSON_INLINE_SCAN : length
        let j: i32 = i + 1
        let close: i32 = -1
        while (j < stop && j < length) {
          const inner: i32 = toI32(text.charCodeAt(j))
          if (inner === JSON_BACKSLASH) {
            j += 2
            continue
          }
          if (inner === JSON_QUOTE) {
            close = j
            break
          }
          j += 1
        }
        if (close < 0) {
          if (j >= length) {
            return -1
          }
          close = jsonClosingQuote(text, j)
          if (close < 0) {
            return -1
          }
        }
        if (depth === 0) {
          return close + 1
        }
        i = close + 1
        continue
      }
      if (code === JSON_OPEN_BRACE || code === JSON_OPEN_BRACKET) {
        depth += 1
      } else if (code === JSON_CLOSE_BRACE || code === JSON_CLOSE_BRACKET) {
        depth -= 1
        if (depth === 0) {
          return i + 1
        }
      }
      i += 1
    }
    return -1
  }
  let i: i32 = at
  while (i < length) {
    const code: i32 = toI32(text.charCodeAt(i))
    if (code === JSON_COMMA || code === JSON_CLOSE_BRACE || code === JSON_CLOSE_BRACKET) {
      return i
    }
    if (jsonIsBlankByte(code)) {
      return i
    }
    i += 1
  }
  return length
}

/** The value of one lower-case or upper-case hex digit, or `-1`. */
const jsonHexDigit = (code: i32): i32 => {
  if (code >= 48 && code <= 57) {
    return code - 48
  }
  if (code >= 97 && code <= 102) {
    return code - 87
  }
  if (code >= 65 && code <= 70) {
    return code - 55
  }
  return -1
}

/** The four hex digits at `at` as one code point, or `-1` when they are not four hex digits. */
const jsonHex4 = (text: string, at: i32, end: i32): i32 => {
  if (at + 4 > end) {
    return -1
  }
  let value: i32 = 0
  let i: i32 = 0
  while (i < 4) {
    const digit: i32 = jsonHexDigit(toI32(text.charCodeAt(at + i)))
    if (digit < 0) {
      return -1
    }
    value = value * JSON_HEX_BASE + digit
    i += 1
  }
  return value
}

/**
 * `code` as UTF-8, one to three bytes.
 *
 * A surrogate pair is **not** recombined: each half becomes its own three-byte
 * sequence, which is what `😀` reads as here. Nothing this module
 * exists to read produces one — `JSON.stringify`, and `jsonQuote` in
 * `src/strings.ts` which matches it byte for byte, escape only the seven short
 * forms and `\u00xx` below `0x20`, and pass every other byte through as itself —
 * so the alternative would be code with no caller to keep it honest.
 */
const jsonUtf8 = (code: i32): string => {
  if (code < JSON_UTF8_TWO_BYTE_FLOOR) {
    return String.fromCharCode(code)
  }
  if (code < JSON_UTF8_THREE_BYTE_FLOOR) {
    const lead: string = String.fromCharCode(JSON_UTF8_TWO_BYTE_LEAD + (code >> 6))
    return `${lead}${String.fromCharCode(JSON_UTF8_CONTINUATION + (code & JSON_UTF8_LOW_SIX))}`
  }
  const lead: string = String.fromCharCode(JSON_UTF8_THREE_BYTE_LEAD + (code >> 12))
  const middle: string = String.fromCharCode(JSON_UTF8_CONTINUATION + ((code >> 6) & JSON_UTF8_LOW_SIX))
  return `${lead}${middle}${String.fromCharCode(JSON_UTF8_CONTINUATION + (code & JSON_UTF8_LOW_SIX))}`
}

/** The number of bytes `jsonUtf8(code)` answers. */
const jsonUtf8Width = (code: i32): i32 => {
  if (code < JSON_UTF8_TWO_BYTE_FLOOR) {
    return 1
  }
  if (code < JSON_UTF8_THREE_BYTE_FLOOR) {
    return 2
  }
  return 3
}

/**
 * Byte `k` of the `width` bytes `jsonUtf8(code)` answers: its arithmetic, one
 * byte at a time, for a caller that compares the bytes rather than keeps them.
 */
const jsonUtf8Byte = (code: i32, width: i32, k: i32): i32 => {
  if (width === 1) {
    return code
  }
  if (k === 0) {
    if (width === 2) {
      return JSON_UTF8_TWO_BYTE_LEAD + (code >> 6)
    }
    return JSON_UTF8_THREE_BYTE_LEAD + (code >> 12)
  }
  if (k === width - 1) {
    return JSON_UTF8_CONTINUATION + (code & JSON_UTF8_LOW_SIX)
  }
  return JSON_UTF8_CONTINUATION + ((code >> 6) & JSON_UTF8_LOW_SIX)
}

/**
 * The bytes of `text[at..end)` with the JSON escapes decoded — the body of a
 * string literal, without its quotes.
 *
 * A literal with no backslash in it is answered as a substring, which is the
 * common case and the whole reason for the first loop: a diagnostic's `file` and
 * `code` never carry an escape, and building them out of parts would allocate an
 * array to copy a string that was already there. An unknown escape stands for
 * the byte it escapes, which is what `\"`, `\\` and `\/` want and is the lenient
 * reading of anything else.
 */
const jsonUnescape = (text: string, at: i32, end: i32): string => {
  // Both callers pass the inside of a literal the scanners found, so
  // `0 <= at` and `end <= text.length` always hold. Saying so here is what
  // proves every read below in range and drops the `substring` clamps.
  if (at < 0 || end > toI32(text.length)) {
    return ""
  }
  let i: i32 = at
  while (i < end && toI32(text.charCodeAt(i)) !== JSON_BACKSLASH) {
    i += 1
  }
  if (i >= end) {
    return text.substring(at, end)
  }
  const parts: string[] = []
  let start: i32 = at
  while (i < end) {
    if (toI32(text.charCodeAt(i)) !== JSON_BACKSLASH) {
      i += 1
      continue
    }
    // `start === i` is an escape straight after another, and the empty run
    // between them adds nothing to the join. The `start >= 0` half is always
    // true — `start` is `at` or a cursor that has only moved forward — and is
    // there because `start` is reassigned in the loop, which is where the
    // bounds proof stops following it.
    if (start >= 0 && start < i) {
      parts.push(text.substring(start, i))
    }
    // A trailing backslash has nothing after it: `0` is no escape letter, so it
    // falls to the default below and stands for itself.
    const letter: i32 = i + 1 < end ? toI32(text.charCodeAt(i + 1)) : 0
    if (letter === 110) {
      parts.push("\n")
      i += 2
    } else if (letter === 116) {
      parts.push("\t")
      i += 2
    } else if (letter === 114) {
      parts.push("\r")
      i += 2
    } else if (letter === 98) {
      parts.push(String.fromCharCode(8))
      i += 2
    } else if (letter === 102) {
      parts.push(String.fromCharCode(12))
      i += 2
    } else if (letter === 117) {
      const code: i32 = jsonHex4(text, i + 2, end)
      if (code < 0) {
        // Not four hex digits after the `u`: the escape is broken, and copying it
        // through unchanged is the reading that loses nothing.
        parts.push("\\u")
        i += 2
      } else {
        parts.push(jsonUtf8(code))
        i += 6
      }
    } else if (letter === 0) {
      parts.push("\\")
      i += 1
    } else {
      parts.push(String.fromCharCode(letter))
      i += 2
    }
    start = i
  }
  parts.push(text.substring(start, end))
  return parts.join("")
}

/** Whether byte `j` of `name` is `code`; an index past either end is not. */
const jsonNameHas = (name: string, j: i32, code: i32): boolean =>
  j >= 0 && j < toI32(name.length) && toI32(name.charCodeAt(j)) === code

/**
 * Whether `jsonUnescape(text, at, end)` would answer `name`, decided without
 * building it.
 *
 * `jsonField` and `jsonFields` ask this of every key they walk past, and almost
 * every answer is no, so the question is answered the way it is asked: the literal and `name`
 * are walked together, each escape decoded where it stands, and the first byte
 * that differs ends the walk. Every escape reads as `jsonUnescape` reads it —
 * the short forms, a `\u` as the bytes `jsonUtf8` would build, a broken `\u`
 * as the two bytes `\u`, a backslash with no letter after it as itself, and
 * any other escape as the byte it escapes — so a key matches here exactly when
 * its decoded text would.
 */
const jsonKeyEquals = (text: string, at: i32, end: i32, name: string): boolean => {
  // `jsonUnescape`'s guard, for the same reason: every caller passes the
  // inside of a key `jsonReadMember` found with `jsonEndOfString`.
  if (at < 0 || end > toI32(text.length)) {
    return false
  }
  let i: i32 = at
  let j: i32 = 0
  while (i < end) {
    const code: i32 = toI32(text.charCodeAt(i))
    if (code !== JSON_BACKSLASH) {
      if (!jsonNameHas(name, j, code)) {
        return false
      }
      i += 1
      j += 1
      continue
    }
    const letter: i32 = i + 1 < end ? toI32(text.charCodeAt(i + 1)) : 0
    if (letter === JSON_LETTER_U) {
      const point: i32 = jsonHex4(text, i + 2, end)
      if (point < 0) {
        if (!jsonNameHas(name, j, JSON_BACKSLASH) || !jsonNameHas(name, j + 1, JSON_LETTER_U)) {
          return false
        }
        i += 2
        j += 2
        continue
      }
      const width: i32 = jsonUtf8Width(point)
      let k: i32 = 0
      while (k < width) {
        if (!jsonNameHas(name, j + k, jsonUtf8Byte(point, width, k))) {
          return false
        }
        k += 1
      }
      i += 6
      j += width
      continue
    }
    // Every other escape decodes to one byte.
    let decoded: i32 = letter
    if (letter === 110) {
      decoded = JSON_NEWLINE
    } else if (letter === 116) {
      decoded = JSON_TAB
    } else if (letter === 114) {
      decoded = JSON_CARRIAGE_RETURN
    } else if (letter === 98) {
      decoded = JSON_BACKSPACE
    } else if (letter === 102) {
      decoded = JSON_FORM_FEED
    } else if (letter === 0) {
      decoded = JSON_BACKSLASH
    }
    if (!jsonNameHas(name, j, decoded)) {
      return false
    }
    // A backslash with no letter after it is one byte of the literal and every
    // other escape two. The steps are constants rather than a variable because
    // a cursor moved by a variable is one the bounds proof stops following.
    if (letter === 0) {
      i += 1
    } else {
      i += 2
    }
    j += 1
  }
  return j === toI32(name.length)
}

/**
 * Where one member of an object lies, as `jsonReadMember` found it: the inside
 * of its key literal, its value, and the opening quote of the key after it.
 *
 * It is a class so that one step can answer the four offsets together, and
 * each reader allocates exactly one, which never leaves the reader: that is
 * what keeps it a stack slot rather than an arena allocation.
 */
class JsonMember {
  keyAt: i32 = 0
  keyEnd: i32 = 0
  valueAt: i32 = 0
  valueEnd: i32 = 0
  /** The opening quote of the next key, or `-1` when no comma follows the value. */
  next: i32 = -1
}

/**
 * The opening quote of the first key of `object`, or `-1` when `object` does
 * not start, past any blanks, with a `{`.
 */
const jsonFirstKey = (object: string): i32 => {
  const length: i32 = toI32(object.length)
  const i: i32 = jsonSkipBlank(object, 0)
  if (i >= length || toI32(object.charCodeAt(i)) !== JSON_OPEN_BRACE) {
    return -1
  }
  return jsonSkipBlank(object, i + 1)
}

/**
 * Reads the member whose key's opening quote is at `at` into `member`, and
 * answers whether there was one.
 *
 * This is the per-key step `jsonField` and `jsonFields` share, so they cannot
 * disagree about where a member ends: `false` for anything that is not a key,
 * a colon and a whole value in that order, which is the point at which both
 * stop. A value need not be followed by a comma — a truncated object still
 * answers the fields before the cut — so a missing one only sets `next` to
 * `-1`, and the read that follows answers `false`.
 */
const jsonReadMember = (object: string, at: i32, member: JsonMember): boolean => {
  const length: i32 = toI32(object.length)
  // `jsonSkipBlank` never answers a negative index for a non-negative one, but
  // the bounds proof does not look inside a callee, so every cursor it answers
  // is tested for `i < 0` beside `i >= length`: the pair is what lets each read
  // below go without a check.
  if (at < 0 || at >= length || toI32(object.charCodeAt(at)) !== JSON_QUOTE) {
    return false
  }
  const keyEnd: i32 = jsonEndOfString(object, at)
  if (keyEnd < 0) {
    return false
  }
  const colon: i32 = jsonSkipBlank(object, keyEnd)
  if (colon < 0 || colon >= length || toI32(object.charCodeAt(colon)) !== JSON_COLON) {
    return false
  }
  const valueAt: i32 = jsonSkipBlank(object, colon + 1)
  const valueEnd: i32 = jsonEndOfValue(object, valueAt)
  if (valueEnd < 0) {
    return false
  }
  member.keyAt = at + 1
  member.keyEnd = keyEnd - 1
  member.valueAt = valueAt
  member.valueEnd = valueEnd
  const comma: i32 = jsonSkipBlank(object, valueEnd)
  if (comma < 0 || comma >= length || toI32(object.charCodeAt(comma)) !== JSON_COMMA) {
    member.next = -1
  } else {
    member.next = jsonSkipBlank(object, comma + 1)
  }
  return true
}

/**
 * The text a member's value answers: a string unquoted and unescaped, anything
 * else as the bytes it was written with.
 */
const jsonValueText = (object: string, member: JsonMember): string => {
  const valueAt: i32 = member.valueAt
  const valueEnd: i32 = member.valueEnd
  // `jsonReadMember` only fills in a value `jsonEndOfValue` ended, which starts
  // inside the object and never ends past it, so this changes no answer: it is
  // the range the value's first byte and its `substring` are proved in.
  if (valueAt < 0 || valueAt >= valueEnd || valueEnd > toI32(object.length)) {
    return ""
  }
  if (toI32(object.charCodeAt(valueAt)) === JSON_QUOTE) {
    return jsonUnescape(object, valueAt + 1, valueEnd - 1)
  }
  return object.substring(valueAt, valueEnd)
}

/**
 * The value of `name` in `object`, or `null` when the object does not have that
 * field.
 *
 * A string value comes back unquoted and unescaped; any other value comes back
 * as the bytes it was written with, so `parseInt` reads a number and `=== "true"`
 * reads a boolean. The scan is left to right and answers the **first** field of
 * that name, which is what a duplicated key means to every JSON reader that does
 * not build a map.
 *
 * A nested value is stepped over rather than searched, so `name` is a field of
 * this object and not a path into it: that is the "flat" in the module header,
 * and it is the shape the compiler's `--json` line has.
 */
export const jsonField = (object: string, name: string): string | null => {
  const member: JsonMember = new JsonMember()
  let at: i32 = jsonFirstKey(object)
  while (jsonReadMember(object, at, member)) {
    // The key is compared where it stands rather than unescaped into a string
    // first: every key before the one asked for is a no, and a no should not
    // cost an allocation.
    if (jsonKeyEquals(object, member.keyAt, member.keyEnd, name)) {
      return jsonValueText(object, member)
    }
    at = member.next
  }
  return null
}

/**
 * The value of every one of `names` in `object`, in the order of `names`: slot
 * `k` is exactly what `jsonField(object, names[k])` answers.
 *
 * It is for a caller that wants several fields of one line — a diagnostic's
 * `code`, `line` and `message` — and would otherwise scan the line once per
 * field. This scans it once, left to right, and stops as soon as every name has
 * answered: a speed path and nothing more, since a slot is filled only once
 * and reading on could change no answer. Each slot keeps the **first** field of its name, as `jsonField`
 * does; a name asked for twice answers in both slots; and a malformed object
 * answers in each slot what `jsonField` answers for that name, because both
 * stop at the same member.
 *
 * The answer is a fresh array and the only allocation besides the values. Each
 * value is stored into it by a plain `values[k] = text` statement, and the
 * array is only stored into, tested and returned, so the values travel with
 * the array: the call lets nothing else out (LANGUAGE.md, "Memory model", a
 * value stored into an array that is returned with it). A loop calling this
 * keeps its per-pass release on a line older than the pass, as `jsonField`'s
 * does, and a `using a = arena()` block may hold the call. On a line built in
 * the pass neither reader keeps the release (LANGUAGE.md, "Memory model").
 * Reading `values` back, passing it to a function, or storing it anywhere
 * before the return would undo this; `tests/link/std_json` pins the flat
 * arena and the `using` block.
 */
export const jsonFields = (object: string, names: string[]): (string | null)[] => {
  const count: i32 = toI32(names.length)
  const values: (string | null)[] = new Array<string | null>(count)
  const member: JsonMember = new JsonMember()
  let missing: i32 = count
  let at: i32 = jsonFirstKey(object)
  while (missing > 0 && jsonReadMember(object, at, member)) {
    // A value is built once per member however many names it answers, and
    // only when one of them does.
    let text: string | null = null
    let k: i32 = 0
    // Bounded by both lengths, which are the same, because the bounds proof
    // follows each array by its own length and not by `count`.
    while (k < toI32(values.length) && k < toI32(names.length)) {
      if (values[k] === null && jsonKeyEquals(object, member.keyAt, member.keyEnd, names[k])) {
        if (text === null) {
          text = jsonValueText(object, member)
        }
        // Always true: the loop's own test. A call stands between it and the
        // store, and a call is where the bounds proof forgets a length.
        if (k < toI32(values.length)) {
          values[k] = text
        }
        missing -= 1
      }
      k += 1
    }
    at = member.next
  }
  return values
}
