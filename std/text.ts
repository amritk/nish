/**
 * `std/text` — the string operations a program has to write itself.
 *
 * The language gives a string `length`, `charCodeAt`, `substring`, `indexOf`,
 * `startsWith`, `endsWith` and `===` by content, and an array `join`. It does
 * **not** give `split`, `trim`, `toLowerCase` or a regular expression, and that
 * is a decision rather than a gap: each of those allocates, and several of them
 * need a locale or a character table that this runtime has no room for
 * (`docs/wp7-runtime.md` keeps the runtime under a measured byte budget).
 *
 * So a program that reads a file and wants its lines writes the loop. This
 * module is that loop, written once. Every offset here is a **byte** offset,
 * like `s.length` itself, and every function but one is ASCII-only where it
 * inspects characters at all — a UTF-8 string passes through `splitLines` and
 * `split` untouched, because a newline and a space cannot appear inside a
 * multi-byte sequence. The one is `codePointLength`, which counts code points
 * rather than bytes and answers the same natively and under Node; it says how.
 *
 * Every width this module declares is spelled (`i32`, never `number`) *and*
 * every value a builtin hands it is converted at the read: `s.length`,
 * `a.length`, `s.charCodeAt(i)` and `s.indexOf(t)` all answer `number`
 * (LANGUAGE.md, *Arrays and strings as receivers*), and `number` is `f64` under
 * `--number-mode f64`. Spelling the declarations is therefore necessary and not
 * sufficient — without the `toI32` at each read this module does not compile in
 * that mode at all (`docs/wp26-stdlib.md` §4). A length a loop tests on every
 * iteration is read into an `i32` local once rather than converted per
 * iteration, which is both cheaper and how the loop wants to read; a string is
 * immutable, so its length cannot change underneath the local.
 */

const NEWLINE: i32 = 10
const CARRIAGE_RETURN: i32 = 13
const SPACE: i32 = 32
const TAB: i32 = 9

/**
 * Whether `code` is one of the four ASCII bytes this module treats as blank.
 *
 * The name is deliberately not `isBlank`. A `std/` module's private functions
 * share the importing program's flat symbol namespace, so a program that
 * declares its own `isBlank` could not compile against this module
 * (`docs/wp26-stdlib.md` §3e); naming the module and the unit of inspection
 * makes the collision unlikely instead.
 */
const isTextBlankByte = (code: i32): boolean =>
  code === SPACE || code === TAB || code === NEWLINE || code === CARRIAGE_RETURN

/**
 * The lines of `text`, without their terminators.
 *
 * A trailing newline does **not** produce a final empty line, because a text
 * file that ends in one has as many lines as it has newlines and a caller
 * comparing two files line by line would otherwise see a phantom difference at
 * the end. A `\r\n` line ending keeps its `\r`: stripping it would make this
 * function guess at the file's provenance, and a caller that needs it gone can
 * `trimEnd` each line.
 */
export const splitLines = (text: string): string[] => {
  const length: i32 = toI32(text.length)
  const lines: string[] = []
  let start: i32 = 0
  let i: i32 = 0
  while (i < length) {
    if (toI32(text.charCodeAt(i)) === NEWLINE) {
      // `start` is never negative and never passes `i`, which is below
      // `length`, so this test always holds. It is written because it is what
      // proves `start` within `text`: the clamp on that bound is dead once it
      // is proven, and the emitter drops it.
      if (start >= 0 && start < length) {
        lines.push(text.substring(start, i))
      }
      start = i + 1
    }
    i += 1
  }
  if (start < length) {
    lines.push(text.substring(start, length))
  }
  return lines
}

/**
 * The runs of non-blank bytes in `text`, with every blank run as the separator.
 * Leading, trailing and repeated blanks produce no empty elements, which is what
 * splitting a line of command-line flags wants — and it is why this is not
 * `split(text, " ")`, which would.
 */
export const splitWhitespace = (text: string): string[] => {
  const length: i32 = toI32(text.length)
  const parts: string[] = []
  let start: i32 = -1
  let i: i32 = 0
  while (i < length) {
    if (isTextBlankByte(toI32(text.charCodeAt(i)))) {
      // `start` is `-1` or a byte already passed, so the second half always
      // holds when the first does; it proves the bound, as in `splitLines`.
      if (start >= 0 && start < length) {
        parts.push(text.substring(start, i))
        start = -1
      }
    } else if (start < 0) {
      start = i
    }
    i += 1
  }
  if (start >= 0) {
    parts.push(text.substring(start, length))
  }
  return parts
}

/** `text` without its leading blank bytes. */
export const trimStart = (text: string): string => {
  const length: i32 = toI32(text.length)
  let i: i32 = 0
  while (i < length && isTextBlankByte(toI32(text.charCodeAt(i)))) {
    i += 1
  }
  return text.substring(i, length)
}

/** `text` without its trailing blank bytes. */
export const trimEnd = (text: string): string => {
  let end: i32 = toI32(text.length)
  while (end > 0 && isTextBlankByte(toI32(text.charCodeAt(end - 1)))) {
    end -= 1
  }
  return text.substring(0, end)
}

/** `text` without blank bytes at either end. */
export const trim = (text: string): string => trimEnd(trimStart(text))

/**
 * Whether `needle` occurs anywhere in `haystack`. One `indexOf`, named, because
 * `indexOf(...) >= 0` at a call site reads as arithmetic where the question is a
 * yes or a no. `contains(s, "")` is `true`, as `indexOf("")` is `0`.
 */
export const contains = (haystack: string, needle: string): boolean => toI32(haystack.indexOf(needle)) >= 0

/**
 * `text` with every occurrence of `needle` replaced by `replacement`.
 *
 * The parts are collected and `join`ed once rather than concatenated in the loop:
 * `s = s + t` inside a loop is quadratic in time *and* in arena, which is the one
 * string mistake this project has measured the cost of — 180 MB of peak memory
 * for 88 KB of output (`docs/wp14-selfhost.md` §3).
 *
 * An empty `needle` answers `text` unchanged, because every other answer is a
 * choice about how many empty matches a string contains.
 */
export const replaceAll = (text: string, needle: string, replacement: string): string => {
  const needleLength: i32 = toI32(needle.length)
  if (needleLength === 0) {
    return text
  }
  const parts: string[] = []
  let rest = text
  while (true) {
    const at: i32 = toI32(rest.indexOf(needle))
    // `indexOf` never answers past `rest.length`, so the second half never
    // holds; it is written because its negation is what proves `at` within
    // `rest` for the `substring` below, as in `splitLines`.
    if (at < 0 || at > toI32(rest.length)) {
      parts.push(rest)
      return parts.join(replacement)
    }
    parts.push(rest.substring(0, at))
    rest = rest.substring(at + needleLength, toI32(rest.length))
  }
}

/**
 * The index of the first line at which `left` and `right` differ, or `-1` when
 * one is a prefix of the other and they have the same length — that is, when
 * they are equal. A caller comparing generated text against a golden wants the
 * first differing line and not a boolean, because printing two whole files is
 * not a diagnostic.
 */
export const firstDifference = (left: string[], right: string[]): i32 => {
  const leftLength: i32 = toI32(left.length)
  const rightLength: i32 = toI32(right.length)
  let i: i32 = 0
  // Two tests rather than one against the shorter length: each proves `i`
  // within one of the arrays, and a minimum taken with a ternary proves
  // neither. The loop ends with `i` at the shorter length.
  while (i < leftLength && i < rightLength) {
    if (left[i] !== right[i]) {
      return i
    }
    i += 1
  }
  return leftLength === rightLength ? -1 : i
}

/** The most bytes `indexOfAny` takes in its set: what one 16-byte vector of the runtime kernel compares. */
const INDEX_OF_ANY_MAX_SET: i32 = 16

/** The first byte that is not ASCII; `indexOfAny`'s set must stay below it. */
const NON_ASCII: i32 = 128

/**
 * The first index at or after `from` whose byte is one of `bytes`, or -1.
 *
 * `bytes` is a set of 1 to 16 ASCII bytes, and anything else panics: an empty
 * set matches nothing, more than 16 is more than one vector of the runtime
 * kernel compares, and an ASCII set is what keeps the answer the same under Node,
 * where `charCodeAt` reads a UTF-16 unit rather than a byte. An ASCII byte
 * never occurs inside a multi-byte UTF-8 sequence, so a non-ASCII `text`
 * passes through and only its ASCII bytes can match — as in `splitLines`, the
 * index is a byte offset natively. `from` is clamped to `[0, text.length]`,
 * as `substring` clamps, so a negative `from` searches from the start and one
 * past the end answers -1.
 *
 * Natively the search is the runtime's `nish_str_index_of_any`, which reads
 * 16 or 32 bytes at a time (docs/LANGUAGE.md, "Byte search"). It is
 * **variable-time**: how long it takes says where the first match is, so it is
 * never for secret data.
 */
export const indexOfAny = (text: string, bytes: string, from: i32): i32 => {
  const count: i32 = toI32(bytes.length)
  if (count < 1 || count > INDEX_OF_ANY_MAX_SET) {
    panic("indexOfAny: the set must hold 1 to 16 bytes")
  }
  let j: i32 = 0
  while (j < count) {
    if (toI32(bytes.charCodeAt(j)) >= NON_ASCII) {
      panic("indexOfAny: every byte of the set must be ASCII")
    }
    j += 1
  }
  const length: i32 = toI32(text.length)
  let start: i32 = from
  if (start < 0) {
    start = 0
  }
  if (start > length) {
    start = length
  }
  return indexOfAnyFrom(text, bytes, start)
}

/**
 * `indexOfAny`'s walk, once its arguments are checked: the first index at or
 * after `from` whose byte is in `bytes`, or -1.
 *
 * This loop is what runs under Node. Natively the compiler recognises the one
 * call `indexOfAny` makes to it and calls the runtime kernel instead
 * (`src/kernels.ts`), so the loop is the kernel's meaning written in the
 * language rather than its implementation. The name is long for the reason
 * `isTextBlankByte`'s is.
 */
const indexOfAnyFrom = (text: string, bytes: string, from: i32): i32 => {
  const length: i32 = toI32(text.length)
  const count: i32 = toI32(bytes.length)
  let i: i32 = from
  // `from` is never negative, because `indexOfAny` clamped it; the test is
  // written because it is what proves `i` within `text`, as in `splitLines`.
  while (i >= 0 && i < length) {
    const code: i32 = toI32(text.charCodeAt(i))
    let j: i32 = 0
    while (j < count) {
      if (toI32(bytes.charCodeAt(j)) === code) {
        return i
      }
      j += 1
    }
    i += 1
  }
  return -1
}

/** The top two bits of a UTF-8 byte, which say whether it starts a code point. */
const TEXT_UTF8_TOP_BITS: i32 = 0xc0

/** What those two bits are on a continuation byte: `10xxxxxx`, never a code point's first byte. */
const TEXT_UTF8_CONTINUATION: i32 = 0x80

/** The first high surrogate, the unit that opens a UTF-16 pair. */
const TEXT_HIGH_SURROGATE: i32 = 0xd800

/** The first low surrogate, the unit that closes a pair; the high ones end just below it. */
const TEXT_LOW_SURROGATE: i32 = 0xdc00

/** One past the last low surrogate. */
const TEXT_SURROGATE_END: i32 = 0xe000

/**
 * Whether a string's units are UTF-8 bytes, as they are natively, rather than
 * UTF-16 units, as they are under Node.
 *
 * `é` is two bytes and one UTF-16 unit, so its length says which host is
 * running. Natively the length of a literal is a load from a constant, and the
 * optimiser folds this call to `true` and drops the other walk in
 * `codePointLength`. The name is long for the reason `isTextBlankByte`'s is.
 */
const textUnitsAreBytes = (): boolean => toI32("é".length) === 2

/**
 * The number of Unicode code points in `text`: what JSON Schema's
 * `minLength` and `maxLength` count, and not what `text.length` counts.
 * `codePointLength("é")` is 1 where `"é".length` is 2, and
 * `codePointLength("😀")` is 1 where its length is 4.
 *
 * Natively a string is its UTF-8 bytes, and every code point has exactly one
 * byte that is not a continuation byte (`10xxxxxx`), so that is what is
 * counted. Under Node the same `charCodeAt` reads UTF-16 units, where a byte
 * rule would miscount: `"©®±"` is three units in `0x80`–`0xBF`, which are
 * continuation bytes in UTF-8 but whole characters here. So the function asks
 * which host it is on (`textUnitsAreBytes`) and, under Node, counts every unit
 * except the low half of a surrogate pair. Both walks answer the same for any
 * string literal, a lone surrogate escape included: it is three WTF-8 bytes
 * with one leading byte natively, and one unit under Node. The answers can
 * differ only for text that is not well-formed — bytes that are not UTF-8
 * natively, where each stray continuation byte counts nothing, or the two
 * halves of a pair joined at run time, which are one string under Node and
 * two lone surrogates natively.
 */
export const codePointLength = (text: string): i32 => {
  const length: i32 = toI32(text.length)
  let count: i32 = 0
  let i: i32 = 0
  if (textUnitsAreBytes()) {
    while (i < length) {
      // `count` never passes `i`, which is below `length`, so `count < length`
      // always holds: it is written because it proves the `+ 1` cannot wrap,
      // which keeps this function callable where panics are denied.
      if ((toI32(text.charCodeAt(i)) & TEXT_UTF8_TOP_BITS) !== TEXT_UTF8_CONTINUATION && count < length) {
        count += 1
      }
      i += 1
    }
    return count
  }
  // A low surrogate right after a high one closes a pair the high one already
  // counted. Any other unit, a lone surrogate included, is a code point.
  let previous: i32 = 0
  while (i < length) {
    const unit: i32 = toI32(text.charCodeAt(i))
    const closesPair: boolean =
      unit >= TEXT_LOW_SURROGATE &&
      unit < TEXT_SURROGATE_END &&
      previous >= TEXT_HIGH_SURROGATE &&
      previous < TEXT_LOW_SURROGATE
    if (!closesPair && count < length) {
      count += 1
    }
    previous = unit
    i += 1
  }
  return count
}
