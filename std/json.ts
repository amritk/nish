/**
 * `std/json` — the value of a field, or of several, of one flat JSON object;
 * and `JsonWriter`, which writes any JSON value into a byte buffer.
 *
 * The reader exists because the compiler's own machine-readable surface is
 * JSON: under `--json` every diagnostic is one flat object on a line of
 * stdout, whose `code` is a stable rule identifier (`AGENTS.md`, and `docs/wp12-release.md` for the
 * exit-code bands). A Nish program that reads that surface — a wrapper, an
 * editor plug-in, or `tests/nish/cli.ts`, which pins the contract — needs the
 * value of a named field and nothing else, and the language has no `JSON.parse`
 * to give it.
 *
 * So the reading half is a **reader, not a parser**, and the difference is
 * worth stating:
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
 * The reader is two exported functions, and few on purpose. A `std/` module
 * is compiled into the program that imports it and the symbol namespace is
 * flat (`std/README.md`), so every name here is a name its importer cannot
 * use: every helper is `json`-prefixed or a method of `JsonWriter`. Splitting a
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
 * **The writer** is for the other direction: a server's response body
 * (WP34 N11, whose first caller is a TechEmpower `/json` entry writing
 * `{"message":"Hello, World!"}` on every request). `JsonWriter` writes into a
 * `u8[]` the caller owns and reuses, puts in every comma and colon itself,
 * and allocates nothing per call except an `f64`'s digits, which it gives back
 * before the call returns. What it writes is byte for byte what
 * `JSON.stringify` writes for the same value: the seven short escapes and
 * `\u00xx` below `0x20`, `/` and `0x7f` as themselves, integers as their
 * digits, an `f64` as `String(v)` spells it with `-0` as `0`, and NaN and the
 * infinities as `null`. `jsonStringifyString` is the same string rule
 * answered as a string.
 *
 * **Misuse is a sticky code**, as in `nish/net/hpack`: never a panic, and no
 * `Result` to carry on the hot path. The first call that cannot be honoured
 * sets `failed` to a negative `JSON_WRITE_*` code — a value where a key is
 * due, a key where a value is due, an unbalanced or mismatched `end*`,
 * nesting past `JSON_WRITER_MAX_DEPTH`, a buffer with no room, a second
 * top-level value, a bad `raw` window or `start` — and every later call does
 * nothing. A call that fails writes nothing past `buf.length` (a full buffer
 * is checked before the bytes go in, never by the bounds check), so the
 * caller writes the whole value, reads `failed` once at the end, and grows
 * the buffer and retries or answers a 500. `complete()` says whether one
 * whole value was written with every container closed.
 *
 * **A string is its bytes** (WP33 class C, `docs/wp33-round-trip.md` §3.2,
 * the first row). The writer escapes by byte and copies every byte at or
 * above `0x80`, so UTF-8 text comes out as the UTF-8 that `JSON.stringify`'s
 * answer encodes to, and a string that is not UTF-8 — a lone `0xFF` — comes
 * out raw, where no Node string could hold it in the first place. Under Node
 * the same source reads UTF-16 units, which agree on ASCII and only there;
 * `tests/link/std_json_writer` pins both edges natively, and its `node.ts`
 * is the ASCII half that `tests/run.js` holds to `JSON.stringify` under Node.
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

// ---- The writer ---------------------------------------------------------------

/** `JsonWriter.failed` while every call so far has been a well-formed write that fitted. */
export const JSON_WRITE_OK: i32 = 0
/** A value, an opener or a `raw` fragment, written in an object where a key is due. */
export const JSON_WRITE_KEY_EXPECTED: i32 = -1
/** `key` outside an object or straight after another key, or `endObject` straight after a key. */
export const JSON_WRITE_VALUE_EXPECTED: i32 = -2
/** `endObject` or `endArray` with no container open, or closing the other kind. */
export const JSON_WRITE_UNBALANCED: i32 = -3
/** A `beginObject` or `beginArray` that would nest deeper than `JSON_WRITER_MAX_DEPTH`. */
export const JSON_WRITE_TOO_DEEP: i32 = -4
/** A write that does not fit between the cursor and `buf.length`; nothing past `buf.length` is touched. */
export const JSON_WRITE_FULL: i32 = -5
/** A second value at the top level, after the first was written whole. */
export const JSON_WRITE_DONE: i32 = -6
/** A `raw` window outside its array, or a `start` outside the writer's buffer. */
export const JSON_WRITE_BAD_WINDOW: i32 = -7

/**
 * How deep a writer nests objects and arrays. The kind of each open container
 * is one bit of two `i32` fields inside the writer, so a nesting past it is
 * `JSON_WRITE_TOO_DEEP` rather than a stack that grows.
 */
export const JSON_WRITER_MAX_DEPTH: i32 = 64
/** How many container kinds one of the writer's two words holds. */
const JSON_WRITER_WORD_BITS: i32 = 32
/** The lowest bit, spelled `i32` so that `<<` has an `i32` on its left under `--number-mode f64` too. */
const JSON_WRITER_BIT: i32 = 1

const JSON_SLASH_B: i32 = 98
const JSON_SLASH_F: i32 = 102
const JSON_SLASH_N: i32 = 110
const JSON_SLASH_R: i32 = 114
const JSON_SLASH_T: i32 = 116
const JSON_DIGIT_ZERO: i32 = 48
const JSON_MINUS: i32 = 45
const JSON_DECIMAL_BASE: i32 = 10
const JSON_LOWER_A: i32 = 97

/**
 * The letter of the short escape for `code` — `"`, `\`, backspace, form feed,
 * newline, carriage return or tab — or `0` when it has none.
 */
const jsonShortEscape = (code: i32): i32 => {
  if (code === JSON_QUOTE || code === JSON_BACKSLASH) {
    return code
  }
  if (code === JSON_NEWLINE) {
    return JSON_SLASH_N
  }
  if (code === JSON_TAB) {
    return JSON_SLASH_T
  }
  if (code === JSON_CARRIAGE_RETURN) {
    return JSON_SLASH_R
  }
  if (code === JSON_BACKSPACE) {
    return JSON_SLASH_B
  }
  if (code === JSON_FORM_FEED) {
    return JSON_SLASH_F
  }
  return 0
}

/** One lower-case hex digit, as `JSON.stringify` writes the last two of a `\u00xx`. */
const jsonHexByte = (nibble: i32): i32 =>
  nibble < JSON_DECIMAL_BASE ? JSON_DIGIT_ZERO + nibble : JSON_LOWER_A + nibble - JSON_DECIMAL_BASE

/** Whether byte `code` of a string goes inside the quotes as itself: JSON escapes only `"`, `\` and the bytes below a space. */
const jsonIsPlainByte = (code: i32): boolean =>
  code >= JSON_SPACE && code !== JSON_QUOTE && code !== JSON_BACKSLASH

/**
 * How many bytes byte `code` of a string takes inside the quotes: itself, a
 * two-byte short escape, or the six bytes of `\u00xx`.
 */
const jsonEscapedWidth = (code: i32): i32 => {
  if (jsonIsPlainByte(code)) {
    return 1
  }
  return jsonShortEscape(code) !== 0 ? 2 : 6
}

/**
 * A JSON text written into a byte buffer the caller owns: `buf[start ..)`,
 * up to `buf.length`, with `end` the cursor. Every comma and colon is the
 * writer's, so the caller says only what the value is:
 *
 *     const w = new JsonWriter(out, 0)
 *     w.beginObject()
 *     w.key("message")
 *     w.string("Hello, World!")
 *     w.endObject()
 *     if (w.complete()) {
 *       // out[0 .. w.end) is {"message":"Hello, World!"}
 *     }
 *
 * No call allocates except `f64` (whose digits are a string the call
 * releases before it returns) and `text`: a writer reset onto the same buffer
 * for each request keeps `Arena.used()` flat, which `tests/link/std_json_writer`
 * measures over 10,000 writes.
 *
 * Misuse is a sticky code, not a panic and not a `Result` (the module header
 * has the policy). Once `failed` is negative every later call does nothing, so
 * a caller writes the whole value and reads `failed` once at the end.
 */
export class JsonWriter {
  buf: u8[]
  start: i32 = 0
  /** The cursor: the bytes written are `buf[start .. end)`. */
  end: i32 = 0
  /** `JSON_WRITE_OK`, or the first `JSON_WRITE_*` code a call hit. */
  failed: i32 = 0
  /** How many containers are open. */
  depth: i32 = 0
  /**
   * Bit `d` of these 64 is whether the container at depth `d + 1` is an
   * object rather than an array: the first 32 in `objectsLow`, the rest in
   * `objectsHigh`. Two `i32` words rather than an `i64` or an array, so that
   * a writer allocates nothing and the module still runs under Node, where
   * an `i64` is a BigInt.
   */
  objectsLow: i32 = 0
  objectsHigh: i32 = 0
  /** Whether a comma goes before the next key or element of the innermost container. */
  needComma: boolean = false
  /** Whether a key has been written in the innermost object and its value is due. */
  afterKey: boolean = false
  /** Whether the top-level value has been written whole. */
  done: boolean = false

  constructor(buf: u8[], start: i32) {
    this.buf = buf
    this.reset(buf, start)
  }

  /**
   * Starts a new text at `buf[start ..)`, forgetting everything the last one
   * wrote and every error it hit: what a server calls once per response, on
   * the buffer it reuses. A `start` outside `buf` is `JSON_WRITE_BAD_WINDOW`.
   */
  reset(buf: u8[], start: i32): void {
    this.buf = buf
    this.start = start
    this.end = start
    this.depth = 0
    this.needComma = false
    this.afterKey = false
    this.done = false
    this.failed = start < 0 || start > toI32(buf.length) ? JSON_WRITE_BAD_WINDOW : JSON_WRITE_OK
  }

  /** How many bytes have been written since `reset`. */
  written(): i32 {
    return this.end - this.start
  }

  /** Whether one whole value has been written, every container closed, and nothing failed. */
  complete(): boolean {
    return this.failed === JSON_WRITE_OK && this.done
  }

  /**
   * The bytes written so far, `buf[start .. end)`, as a string. A convenience
   * that allocates a byte at a time, for a caller that wants text rather than
   * bytes; a server sends `buf` itself.
   */
  text(): string {
    const buf: u8[] = this.buf
    const parts: string[] = []
    for (let k: i32 = this.start; k >= 0 && k < this.end && k < toI32(buf.length); k += 1) {
      parts.push(String.fromCharCode(toI32(buf[k])))
    }
    return parts.join("")
  }

  beginObject(): void {
    jsonWriterOpen(this, true, JSON_OPEN_BRACE)
  }

  endObject(): void {
    jsonWriterClose(this, true, JSON_CLOSE_BRACE)
  }

  beginArray(): void {
    jsonWriterOpen(this, false, JSON_OPEN_BRACKET)
  }

  endArray(): void {
    jsonWriterClose(this, false, JSON_CLOSE_BRACKET)
  }

  /** The next member's key, with the comma before it and the colon after it. */
  key(name: string): void {
    if (this.failed !== JSON_WRITE_OK) {
      return
    }
    if (this.depth === 0 && this.done) {
      this.failed = JSON_WRITE_DONE
      return
    }
    if (!jsonWriterInObject(this) || this.afterKey) {
      this.failed = JSON_WRITE_VALUE_EXPECTED
      return
    }
    if (this.needComma && !jsonWriterPutByte(this, JSON_COMMA)) {
      return
    }
    if (jsonWriterPutString(this, name) && jsonWriterPutByte(this, JSON_COLON)) {
      this.afterKey = true
    }
  }

  /** `s` quoted and escaped as `JSON.stringify` escapes it; every other byte goes through as itself. */
  string(s: string): void {
    if (jsonWriterValueDue(this) && jsonWriterPutString(this, s)) {
      jsonWriterValueDone(this)
    }
  }

  i32(v: i32): void {
    if (jsonWriterValueDue(this) && jsonWriterPutDigits(this, v, -1)) {
      jsonWriterValueDone(this)
    }
  }

  /**
   * One past `i32`'s range is ten digits, so the last digit is split off in
   * `u32` and the nine before it are an `i32`'s.
   */
  u32(v: u32): void {
    if (!jsonWriterValueDue(this)) {
      return
    }
    // The largest `u32` whose digits fit an `i32`; a module constant cannot be a `u32`.
    const i32Max: u32 = 2147483647
    let written: boolean = false
    if (v <= i32Max) {
      written = jsonWriterPutDigits(this, toI32(v), -1)
    } else {
      const ten: u32 = 10
      const last: u32 = v % ten
      written = jsonWriterPutDigits(this, toI32((v - last) / ten), toI32(last))
    }
    if (written) {
      jsonWriterValueDone(this)
    }
  }

  /** The digits of `v`, the minimum included: the arithmetic stays on the negative side, where it fits. */
  i64(v: i64): void {
    if (jsonWriterValueDue(this) && jsonWriterPutDigits64(this, v)) {
      jsonWriterValueDone(this)
    }
  }

  /**
   * `v` as `String(v)` spells it, which is `JSON.stringify`'s rule: the
   * shortest digits that read back as `v`, `-0` as `0`, and `null` for NaN
   * and both infinities, which JSON cannot spell.
   */
  f64(v: f64): void {
    // `v - v` is `0` for every finite `v`, and NaN for NaN and both infinities.
    if (v - v !== toF64(0)) {
      this.nullValue()
    } else if (jsonWriterValueDue(this) && jsonWriterPutF64(this, v)) {
      jsonWriterValueDone(this)
    }
  }

  boolean(v: boolean): void {
    if (jsonWriterValueDue(this) && jsonWriterPutText(this, v ? "true" : "false")) {
      jsonWriterValueDone(this)
    }
  }

  /** `null`. The method is not named `null`, which the parser refuses as a member name. */
  nullValue(): void {
    if (jsonWriterValueDue(this) && jsonWriterPutText(this, "null")) {
      jsonWriterValueDone(this)
    }
  }

  /**
   * `bytes[off .. off + len)`, copied as it is and counted as one value: a
   * fragment the caller encoded already, such as a cached object. Nothing in
   * it is checked, so a fragment that is not one whole JSON value makes a
   * text that is not JSON either. The bytes are copied front to back, so
   * `bytes` is not the writer's own buffer at a window the copy overtakes.
   */
  raw(bytes: u8[], off: i32, len: i32): void {
    if (this.failed !== JSON_WRITE_OK) {
      return
    }
    if (off < 0 || len < 0 || off > toI32(bytes.length) - len) {
      this.failed = JSON_WRITE_BAD_WINDOW
      return
    }
    if (!jsonWriterValueDue(this)) {
      return
    }
    const buf: u8[] = this.buf
    const at: i32 = this.end
    if (at < 0 || at > toI32(buf.length) - len) {
      this.failed = JSON_WRITE_FULL
      return
    }
    for (let k: i32 = 0; k < len && off + k < toI32(bytes.length) && at + k < toI32(buf.length); k += 1) {
      if (off + k >= 0 && at + k >= 0) {
        buf[at + k] = bytes[off + k]
      }
    }
    this.end = at + len
    jsonWriterValueDone(this)
  }
}

/** Whether the innermost open container is an object; `false` at the top level. */
const jsonWriterInObject = (w: JsonWriter): boolean => {
  const d: i32 = w.depth - 1
  if (d < 0) {
    return false
  }
  const word: i32 = d < JSON_WRITER_WORD_BITS ? w.objectsLow : w.objectsHigh
  return ((word >> (d & 31)) & 1) === 1
}

/**
 * Whether a value may be written now, with the comma before it written when
 * one is due; `false`, with `failed` set, when the writer has failed, a key
 * is due, or the top-level value is already whole.
 */
const jsonWriterValueDue = (w: JsonWriter): boolean => {
  if (w.failed !== JSON_WRITE_OK) {
    return false
  }
  if (w.depth === 0) {
    if (w.done) {
      w.failed = JSON_WRITE_DONE
      return false
    }
    return true
  }
  if (w.afterKey) {
    w.afterKey = false
    return true
  }
  if (jsonWriterInObject(w)) {
    w.failed = JSON_WRITE_KEY_EXPECTED
    return false
  }
  return !w.needComma || jsonWriterPutByte(w, JSON_COMMA)
}

/** After a whole value: the next element needs a comma, and at the top level the text is done. */
const jsonWriterValueDone = (w: JsonWriter): void => {
  w.needComma = true
  if (w.depth === 0) {
    w.done = true
  }
}

/** `beginObject` and `beginArray`: the opener, and a slot for the new container. */
const jsonWriterOpen = (w: JsonWriter, object: boolean, opener: i32): void => {
  if (w.failed === JSON_WRITE_OK && w.depth >= JSON_WRITER_MAX_DEPTH) {
    w.failed = JSON_WRITE_TOO_DEEP
    return
  }
  if (!jsonWriterValueDue(w) || !jsonWriterPutByte(w, opener)) {
    return
  }
  const d: i32 = w.depth
  const bit: i32 = JSON_WRITER_BIT << (d & 31)
  if (d < JSON_WRITER_WORD_BITS) {
    w.objectsLow = object ? w.objectsLow | bit : w.objectsLow & ~bit
  } else {
    w.objectsHigh = object ? w.objectsHigh | bit : w.objectsHigh & ~bit
  }
  w.depth = d + 1
  w.needComma = false
}

/** `endObject` and `endArray`: the closer, when the innermost container is of that kind and not waiting on a value. */
const jsonWriterClose = (w: JsonWriter, object: boolean, closer: i32): void => {
  if (w.failed !== JSON_WRITE_OK) {
    return
  }
  if (w.depth === 0 || jsonWriterInObject(w) !== object) {
    w.failed = JSON_WRITE_UNBALANCED
    return
  }
  if (w.afterKey) {
    w.failed = JSON_WRITE_VALUE_EXPECTED
    return
  }
  if (jsonWriterPutByte(w, closer)) {
    w.depth -= 1
    jsonWriterValueDone(w)
  }
}

/** One byte at the cursor, or `JSON_WRITE_FULL` when the buffer has no room for it. */
const jsonWriterPutByte = (w: JsonWriter, code: i32): boolean => {
  const buf: u8[] = w.buf
  const at: i32 = w.end
  if (at < 0 || at >= toI32(buf.length)) {
    w.failed = JSON_WRITE_FULL
    return false
  }
  buf[at] = toU8(code)
  w.end = at + 1
  return true
}

/**
 * The bytes of `text`, which needs no escaping, at the cursor; all of them or,
 * with `JSON_WRITE_FULL`, none.
 */
const jsonWriterPutText = (w: JsonWriter, text: string): boolean => {
  const buf: u8[] = w.buf
  const n: i32 = toI32(text.length)
  const at: i32 = w.end
  if (at < 0 || at > toI32(buf.length) - n) {
    w.failed = JSON_WRITE_FULL
    return false
  }
  for (let k: i32 = 0; k < n && at + k < toI32(buf.length); k += 1) {
    if (at + k >= 0) {
      buf[at + k] = toU8(text.charCodeAt(k))
    }
  }
  w.end = at + n
  return true
}

/**
 * `s` as a JSON string at the cursor: the quotes, the seven short escapes,
 * `\u00xx` for the other bytes below `0x20`, and every other byte as itself.
 * That is `jsonQuote`'s rule in `src/strings.ts`, and `JSON.stringify`'s on a
 * string that is ASCII. A byte at or above `0x80` is copied, so UTF-8 comes
 * out as the UTF-8 `JSON.stringify` makes once it is encoded, and a byte that
 * is not UTF-8 at all comes out raw (the module header says why).
 *
 * The cursor is a local and is stored back only when the whole string fits,
 * so a `JSON_WRITE_FULL` moves nothing.
 */
const jsonWriterPutString = (w: JsonWriter, s: string): boolean => {
  const buf: u8[] = w.buf
  const cap: i32 = toI32(buf.length)
  const n: i32 = toI32(s.length)
  let at: i32 = w.end
  if (at < 0 || at >= cap) {
    w.failed = JSON_WRITE_FULL
    return false
  }
  buf[at] = toU8(JSON_QUOTE)
  at += 1
  for (let i: i32 = 0; i < n; i += 1) {
    const code: i32 = toI32(s.charCodeAt(i))
    // A plain byte is almost every byte, and costs one test of the room.
    // Each branch moves the cursor by a constant, which is what lets the
    // bounds proof keep `at >= 0` from one byte to the next.
    if (jsonIsPlainByte(code)) {
      if (at >= cap) {
        w.failed = JSON_WRITE_FULL
        return false
      }
      buf[at] = toU8(code)
      at += 1
      continue
    }
    const letter: i32 = jsonShortEscape(code)
    if (letter !== 0) {
      if (at < 0 || at + 1 >= cap) {
        w.failed = JSON_WRITE_FULL
        return false
      }
      buf[at] = toU8(JSON_BACKSLASH)
      buf[at + 1] = toU8(letter)
      at += 2
      continue
    }
    if (at < 0 || at + 5 >= cap) {
      w.failed = JSON_WRITE_FULL
      return false
    }
    buf[at] = toU8(JSON_BACKSLASH)
    buf[at + 1] = toU8(JSON_LETTER_U)
    buf[at + 2] = toU8(JSON_DIGIT_ZERO)
    buf[at + 3] = toU8(JSON_DIGIT_ZERO)
    buf[at + 4] = toU8(jsonHexByte(code >> 4))
    buf[at + 5] = toU8(jsonHexByte(code & 15))
    at += 6
  }
  if (at >= cap) {
    w.failed = JSON_WRITE_FULL
    return false
  }
  buf[at] = toU8(JSON_QUOTE)
  w.end = at + 1
  return true
}

/**
 * The decimal digits of `v`, then `suffix` as one more digit when it is not
 * negative, at the cursor; all of them or, with `JSON_WRITE_FULL`, none.
 *
 * The digits are counted first and then written right to left, straight into
 * the buffer. A negative `v` is never negated, so `-2147483648` needs no case
 * of its own: each step takes the remainder, which is zero or negative, and
 * divides what is left exactly. The exact division is also what keeps the
 * step the same under Node, where `/` does not truncate.
 */
const jsonWriterPutDigits = (w: JsonWriter, v: i32, suffix: i32): boolean => {
  let digits: i32 = 1
  let rest: i32 = v
  while (rest <= -JSON_DECIMAL_BASE || rest >= JSON_DECIMAL_BASE) {
    rest = (rest - (rest % JSON_DECIMAL_BASE)) / JSON_DECIMAL_BASE
    digits += 1
  }
  const sign: i32 = v < 0 ? 1 : 0
  const extra: i32 = suffix >= 0 ? 1 : 0
  const buf: u8[] = w.buf
  const at: i32 = w.end
  const width: i32 = sign + digits + extra
  if (at < 0 || at > toI32(buf.length) - width) {
    w.failed = JSON_WRITE_FULL
    return false
  }
  if (sign === 1) {
    buf[at] = toU8(JSON_MINUS)
  }
  if (extra === 1 && at + width - 1 < toI32(buf.length) && at + width - 1 >= 0) {
    buf[at + width - 1] = toU8(JSON_DIGIT_ZERO + suffix)
  }
  rest = v
  for (let k: i32 = at + sign + digits - 1; k >= at + sign && k >= 0 && k < toI32(buf.length); k -= 1) {
    const digit: i32 = rest % JSON_DECIMAL_BASE
    buf[k] = toU8(JSON_DIGIT_ZERO + (digit < 0 ? -digit : digit))
    rest = (rest - digit) / JSON_DECIMAL_BASE
  }
  w.end = at + width
  return true
}

/** `jsonWriterPutDigits` in 64 bits, for `i64`, whose minimum likewise needs no case of its own. */
const jsonWriterPutDigits64 = (w: JsonWriter, v: i64): boolean => {
  const ten: i64 = 10
  let digits: i32 = 1
  let rest: i64 = v
  while (rest <= -ten || rest >= ten) {
    rest = rest / ten
    digits += 1
  }
  const sign: i32 = v < 0 ? 1 : 0
  const buf: u8[] = w.buf
  const at: i32 = w.end
  const width: i32 = sign + digits
  if (at < 0 || at > toI32(buf.length) - width) {
    w.failed = JSON_WRITE_FULL
    return false
  }
  if (sign === 1) {
    buf[at] = toU8(JSON_MINUS)
  }
  rest = v
  for (let k: i32 = at + width - 1; k >= at + sign && k >= 0 && k < toI32(buf.length); k -= 1) {
    const digit: i32 = toI32(rest % ten)
    buf[k] = toU8(JSON_DIGIT_ZERO + (digit < 0 ? -digit : digit))
    rest = rest / ten
  }
  w.end = at + width
  return true
}

/**
 * The digits `${v}` spells for a finite `v`, at the cursor. They are a string
 * the runtime builds, and nothing holds it once its bytes are copied, so the
 * function's automatic arena scope (LANGUAGE.md, "Memory model", item 2)
 * gives it back before the call returns: a loop of `f64` writes keeps
 * `Arena.used()` flat like every other write, and `tests/link/std_json_writer`
 * measures it. The scope is the compiler's rather than a `using a = arena()`
 * block because this module also runs under Node, which `tests/run.js` holds
 * to `JSON.stringify`, and Node 22 does not parse `using`.
 */
const jsonWriterPutF64 = (w: JsonWriter, v: f64): boolean => jsonWriterPutText(w, `${v}`)

/**
 * `s` as `JSON.stringify(s)` writes it — quoted, with the escapes
 * `JsonWriter.string` writes — as a string. A thin layer on the writer: it
 * sizes a buffer to fit exactly, writes into it and reads it back. A string
 * with nothing to escape skips the writer and is only quoted.
 */
export const jsonStringifyString = (s: string): string => {
  const n: i32 = toI32(s.length)
  let width: i32 = 2
  for (let i: i32 = 0; i < n; i += 1) {
    width += jsonEscapedWidth(toI32(s.charCodeAt(i)))
  }
  if (width === n + 2) {
    return `"${s}"`
  }
  const w: JsonWriter = new JsonWriter(new Array<u8>(width), 0)
  w.string(s)
  return w.text()
}
