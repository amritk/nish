/**
 * `std/text` — the string operations a program has to write itself.
 *
 *     import { asciiUpper, padStart, replaceAll, split, splitLines, splitWhitespace, trim } from "nish/text";
 *
 *     export const main = (): i32 => {
 *       const lines: string[] = splitLines("a b\n  c  \n"); // ["a b", "  c  "]
 *       const words: string[] = splitWhitespace(lines[0]); // ["a", "b"]
 *       const c: string = trim(lines[1]); // "c"
 *       const dashed: string = replaceAll("a b", " ", "-"); // "a-b"
 *       const fields: string[] = split("a,,b", ","); // ["a", "", "b"]
 *       const loud: string = asciiUpper("get_id"); // "GET_ID"
 *       const code: string = padStart("7", 3, "0"); // "007"
 *       return toI32(words.length);
 *     };
 *
 * **The language gives a string `length`, `charCodeAt`, `substring`, `indexOf`,
 * `startsWith`, `endsWith` and `===` by content, and an array `join`.** It does
 * **not** give `split`, `trim`, `toLowerCase` or a regular expression (that is
 * `std/regex`), and that is a decision rather than a gap: each allocates, and
 * several need a locale or a character table this runtime has no room for
 * (`docs/wp7-runtime.md` keeps the runtime under a measured byte budget).
 *
 * **So a program that reads a file and wants its lines writes the loop.** This
 * module is that loop, written once. Every offset here is a **byte** offset,
 * like `s.length` itself, and every function but one is ASCII-only where it
 * inspects characters at all — a UTF-8 string passes through `splitLines`,
 * `splitWhitespace`, `asciiUpper` and `asciiLower` untouched, because an ASCII
 * byte cannot appear inside a multi-byte sequence. The one is
 * `codePointLength`, which counts code points rather than bytes and answers the
 * same natively and under Node; it says how. `padStart` and `padEnd` count a
 * width in `s.length`'s units, so they are the two whose answers differ under
 * Node on text that is not ASCII; each says by how much.
 *
 * **Every width this module declares is spelled** (`i32`, never `number`) *and*
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
 *
 * @param text The text to split; an empty one has no lines.
 * @returns A fresh array of the lines, in order.
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
 *
 * @param text The text to split; the blanks are space, tab, newline and
 *   carriage return.
 * @returns A fresh array of the non-blank runs, in order; empty when `text` is
 *   all blank.
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

/**
 * `text` without its leading blank bytes.
 *
 * @param text The text to trim; the blanks are space, tab, newline and
 *   carriage return.
 * @returns `text` from its first non-blank byte on, or `""` when it is all
 *   blank.
 */
export const trimStart = (text: string): string => {
  const length: i32 = toI32(text.length)
  let i: i32 = 0
  while (i < length && isTextBlankByte(toI32(text.charCodeAt(i)))) {
    i += 1
  }
  return text.substring(i, length)
}

/**
 * `text` without its trailing blank bytes.
 *
 * @param text The text to trim; the blanks are space, tab, newline and
 *   carriage return.
 * @returns `text` up to and including its last non-blank byte, or `""` when it
 *   is all blank.
 */
export const trimEnd = (text: string): string => {
  let end: i32 = toI32(text.length)
  while (end > 0 && isTextBlankByte(toI32(text.charCodeAt(end - 1)))) {
    end -= 1
  }
  return text.substring(0, end)
}

/**
 * `text` without blank bytes at either end.
 *
 * @param text The text to trim; the blanks are space, tab, newline and
 *   carriage return.
 * @returns `text` from its first non-blank byte to its last, or `""` when it is
 *   all blank.
 */
export const trim = (text: string): string => trimEnd(trimStart(text))

/**
 * Whether `needle` occurs anywhere in `haystack`. One `indexOf`, named, because
 * `indexOf(...) >= 0` at a call site reads as arithmetic where the question is a
 * yes or a no. `contains(s, "")` is `true`, as `indexOf("")` is `0`.
 *
 * @param haystack The text searched.
 * @param needle The text looked for, compared byte for byte.
 * @returns `true` when `needle` occurs in `haystack`.
 */
export const contains = (haystack: string, needle: string): boolean => toI32(haystack.indexOf(needle)) >= 0

/**
 * The pieces of `text` between the occurrences of `sep`: JavaScript's
 * `text.split(sep)` for a separator that is not empty. A separator at the
 * start, at the end or next to another gives an empty piece, so
 * `split(",a,,b,", ",")` is `["", "a", "", "b", ""]`; `split("", ",")` is
 * `[""]`; and a separator that never occurs gives `[text]`. Compare
 * `splitWhitespace`, which drops the empty pieces.
 *
 * The pieces are the same natively and under Node for any text and any
 * separator, multi-byte ones included: a match is a whole UTF-8 sequence
 * natively and a whole run of UTF-16 units under Node, and a well-formed
 * string holds a code point's encoding only where that code point is. So
 * there is nothing for NL8001 (`--warn-portability`) to warn about, and it
 * does not; the pieces' own `.length`s are still counted in each platform's
 * units, and NL8001 reads those where the program does.
 *
 * **An empty separator panics.** JavaScript splits a string on `""` into its
 * UTF-16 units, which natively would be its bytes, and the two answers differ
 * on any text that is not ASCII. A separator is almost always a literal the
 * caller chose, so an empty one is a mistake in the program, like an index out
 * of range, and not a condition a caller could recover from.
 *
 * @param text The text to split.
 * @param sep The separator, compared byte for byte; it must not be empty.
 *   Occurrences are found left to right and do not overlap.
 * @returns A fresh array of the pieces, in order; never empty.
 */
export const split = (text: string, sep: string): string[] => splitTextPieces(text, sep, -1, "split")

/**
 * The first `limit` pieces of `text` between the occurrences of `sep`:
 * JavaScript's `text.split(sep, limit)` for a separator that is not empty, and
 * `split`'s pieces otherwise. The pieces past the limit are dropped, not joined
 * into the last one, so `splitLimit("a,b,c", ",", 2)` is `["a", "b"]`, and a
 * limit of 0 gives `[]`.
 *
 * **A negative limit keeps every piece**, as it does under Node: JavaScript
 * reads the limit with `ToUint32`, so `-1` is 4294967295, and any negative
 * `i32` is at least 2147483648 there, more pieces than a string can split
 * into. So `splitLimit(text, sep, -1)` is `split(text, sep)`, and the two
 * readings agree on every `i32`. Refusing a negative limit would have been a
 * panic where JavaScript answers.
 *
 * **An empty separator panics**, whatever the limit, for the reason `split`
 * gives; JavaScript would answer `[]` for a limit of 0, and its UTF-16 units
 * otherwise.
 *
 * @param text The text to split.
 * @param sep The separator, compared byte for byte; it must not be empty.
 *   Occurrences are found left to right and do not overlap.
 * @param limit The most pieces kept; a negative one keeps them all.
 * @returns A fresh array of at most `limit` pieces, in order.
 */
export const splitLimit = (text: string, sep: string, limit: i32): string[] =>
  splitTextPieces(text, sep, limit, "splitLimit")

/**
 * `split` and `splitLimit`'s one walk: the pieces of `text` between the
 * occurrences of `sep`, stopping once `limit` are taken. A negative `limit`
 * never equals a count, so it takes them all. `caller` names the function in
 * the panic for an empty separator. The name is long for the reason
 * `isTextBlankByte`'s is.
 */
const splitTextPieces = (text: string, sep: string, limit: i32, caller: string): string[] => {
  const sepLength: i32 = toI32(sep.length)
  if (sepLength === 0) {
    panic(`${caller}: an empty separator`)
  }
  const length: i32 = toI32(text.length)
  const parts: string[] = []
  if (limit === 0) {
    return parts
  }
  let start: i32 = 0
  while (true) {
    // Searching from `start` rather than cutting `text` down after each match
    // copies nothing until the piece is taken.
    const at: i32 = toI32(text.indexOf(sep, start))
    // `start` is 0 or one past a match, so it is never negative and never
    // past `length`, and a hit starts at or after `start` and a whole
    // separator before `length`. The tests around the `substring`s therefore
    // always hold, but for the empty tail after a final separator; they are
    // written because they are what proves both bounds within `text`, as in
    // `splitLines`.
    if (at < 0) {
      parts.push(start >= 0 && start < length ? text.substring(start, length) : "")
      return parts
    }
    if (start >= 0 && start < length && at >= 0 && at < length) {
      parts.push(text.substring(start, at))
    }
    if (toI32(parts.length) === limit) {
      return parts
    }
    start = at + sepLength
  }
}

/** The most digits `toFixed` takes after the point; JavaScript throws a `RangeError` past it. */
const TO_FIXED_MAX_DIGITS: i32 = 100

/** Where `toFixed` stops writing fixed notation and answers `String(x)`, as JavaScript does. */
const TO_FIXED_LIMIT: f64 = 1e21

/** 2^52 and 2^53: an `f64` from the first up to the second is an integer, and its whole significand. */
const TWO_TO_52: f64 = 4503599627370496
const TWO_TO_53: f64 = 9007199254740992

/** The byte `0`; a decimal digit `d` is written as this plus `d`. */
const ASCII_ZERO: i32 = 48

/** The byte `.`. */
const ASCII_DOT: i32 = 46

/** The byte `-`. */
const ASCII_MINUS: i32 = 45

/**
 * `digits`, a decimal number with its units digit first, halved in place,
 * reading only its lowest `count` digits (the rest are zero). The answer is
 * the bit the halving dropped, 0 or 1.
 *
 * It is written with `>>` and `&` rather than `/` and `%` because under Node
 * an `i32` is a JavaScript number, and `/` there would give a fraction. The
 * name is long for the reason `isTextBlankByte`'s is.
 */
const fixedDigitsHalve = (digits: i32[], count: i32): i32 => {
  let carry: i32 = 0
  let i: i32 = count - 1
  while (i >= 0 && i < toI32(digits.length)) {
    const value: i32 = carry * 10 + digits[i]
    digits[i] = value >> 1
    carry = value & 1
    i -= 1
  }
  return carry
}

/**
 * `digits`, a decimal number with its units digit first, doubled in place when
 * `doubling` is set, and then with `amount`, 0 or 1, added at the units. The
 * array grows by a digit when the answer carries out of the top. The name is
 * long for the reason `isTextBlankByte`'s is.
 */
const fixedDigitsAdd = (digits: i32[], doubling: boolean, amount: i32): void => {
  let carry: i32 = amount
  let i: i32 = 0
  const length: i32 = toI32(digits.length)
  while (i < length) {
    const value: i32 = (doubling ? digits[i] * 2 : digits[i]) + carry
    digits[i] = value >= 10 ? value - 10 : value
    carry = value >= 10 ? 1 : 0
    i += 1
  }
  if (carry > 0) {
    digits.push(carry)
  }
}

/**
 * `x` written with exactly `digits` digits after the point: JavaScript's
 * `x.toFixed(digits)`, and the same text natively and under Node.
 *
 * The answer is the decimal closest to the **exact binary value** of `x`, and
 * a tie between two takes the larger, as ECMA-262 says. That is not rounding
 * the shortest printed decimal: `1.005` is stored as a little less than
 * 1.005, so `toFixed(1.005, 2)` is `"1.00"`, while `2.5` is exact and a tie, so
 * `toFixed(2.5, 0)` is `"3"` and `toFixed(-2.5, 0)` is `"-3"`. The digits are
 * worked out in full, one decimal digit per array element, so the value is
 * never rounded on the way; that is why this is written here and not with a
 * multiplication by a power of ten, which rounds twice.
 *
 * The edges are JavaScript's. `NaN` gives `"NaN"`. `x` at or beyond 1e21 in
 * size gives `String(x)`, the text a template hole gives, so
 * `toFixed(1e21, 2)` is `"1e+21"`, and the infinities give `"Infinity"` and
 * `"-Infinity"`. `-0` loses its sign, `"0.00"`, but a negative value that
 * rounds to zero keeps it: `toFixed(-0.0001, 2)` is `"-0.00"`.
 *
 * **`digits` outside 0 to 100 panics**, where JavaScript throws a
 * `RangeError`: the count is almost always a literal the caller chose, so a
 * bad one is a mistake in the program, as `split`'s empty separator is.
 *
 * @param x The number to write.
 * @param digits How many digits to write after the point, from 0 to 100; with
 *   0 there is no point.
 * @returns `x` in fixed notation, or `String(x)` when `x` is NaN or at least
 *   1e21 in size.
 */
export const toFixed = (x: f64, digits: i32): string => {
  if (digits < 0 || digits > TO_FIXED_MAX_DIGITS) {
    panic("toFixed: digits must be 0 to 100")
  }
  // biome-ignore lint/suspicious/noSelfCompare: NaN is the only value that is not itself; Nish has no Number.isNaN
  if (x !== x || x >= TO_FIXED_LIMIT || x <= -TO_FIXED_LIMIT) {
    return `${x}`
  }
  const negative: boolean = x < 0
  // `x` is `m * 2^exponent` for an integer `m` below 2^53: scaling it into
  // [2^52, 2^53) by twos is exact, a subnormal included, and says `exponent`.
  let m: f64 = negative ? -x : x
  let exponent: i32 = 0
  if (m > 0) {
    while (m < TWO_TO_52) {
      m *= 2
      exponent -= 1
    }
    while (m >= TWO_TO_53) {
      m /= 2
      exponent += 1
    }
  }
  // The number written is `m * 10^digits * 2^exponent`, rounded to an
  // integer, with its last `digits` digits after the point. Multiplying by
  // `10^digits` is that many zeros under the units; `m`'s own digits are exact
  // to take out, since every step stays an integer below 2^53.
  const decimal: i32[] = []
  let i: i32 = 0
  while (i < digits) {
    decimal.push(0)
    i += 1
  }
  while (m > 0) {
    const last: f64 = m % 10
    decimal.push(toI32(last))
    m = (m - last) / 10
  }
  while (exponent > 0) {
    fixedDigitsAdd(decimal, true, 0)
    exponent -= 1
  }
  // A negative exponent halves the number that many times. The integer part
  // is what is left; it rounds up exactly when the last bit dropped is 1,
  // which is a remainder of at least a half, a tie included. Once the number
  // is zero every bit still to drop is zero too, so the walk stops there.
  let count: i32 = toI32(decimal.length)
  let dropped: i32 = 0
  while (exponent < 0 && count > 0) {
    dropped = fixedDigitsHalve(decimal, count)
    while (count > 0 && count <= toI32(decimal.length) && decimal[count - 1] === 0) {
      count -= 1
    }
    exponent += 1
  }
  if (exponent === 0 && dropped === 1) {
    fixedDigitsAdd(decimal, false, 1)
  }
  while (toI32(decimal.length) <= digits) {
    decimal.push(0)
  }
  // The text is the digits from the highest that is not zero down, but never
  // from below the units, which is index `digits`; the halving leaves zeros
  // above the number. The point goes before the last `digits` of them, and a
  // minus in front of any negative `x`.
  let at: i32 = toI32(decimal.length) - 1
  while (at > digits && at >= 0 && at < toI32(decimal.length) && decimal[at] === 0) {
    at -= 1
  }
  const bytes: u8[] = []
  if (negative) {
    bytes.push(toU8(ASCII_MINUS))
  }
  while (at >= 0 && at < toI32(decimal.length)) {
    // Read before the pushes: a push may move an array, so it ends the proof.
    const digit: i32 = decimal[at]
    if (at === digits - 1) {
      bytes.push(toU8(ASCII_DOT))
    }
    bytes.push(toU8(ASCII_ZERO + digit))
    at -= 1
  }
  return String.fromBytes(bytes, 0, toI32(bytes.length))
}

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
 *
 * @param text The text whose occurrences are replaced.
 * @param needle The text looked for. Occurrences are found left to right and
 *   do not overlap: after a match the search goes on past its end.
 * @param replacement The text each occurrence becomes; it is not searched.
 * @returns The text with every occurrence replaced.
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
 *
 * @param left One side's lines.
 * @param right The other side's lines, compared to `left`'s with `!==` by
 *   content.
 * @returns The index of the first line that differs, the shorter length when
 *   one side is a prefix of the other, or `-1` when they are equal.
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
 *
 * @param text The text searched.
 * @param bytes The set of bytes looked for, written as a string of 1 to 16
 *   ASCII characters; their order does not matter.
 * @param from Where the search starts, as a byte offset, clamped into
 *   `[0, text.length]`.
 * @returns The byte offset of the first match at or after `from`, or -1 when
 *   there is none.
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
const UTF8_TOP_BITS: i32 = 0xc0

/** What those two bits are on a continuation byte: `10xxxxxx`, never a code point's first byte. */
const UTF8_CONTINUATION: i32 = 0x80

/** The first high surrogate, the unit that opens a UTF-16 pair. */
const HIGH_SURROGATE: i32 = 0xd800

/** The first low surrogate, the unit that closes a pair; the high ones end just below it. */
const LOW_SURROGATE: i32 = 0xdc00

/** One past the last low surrogate. */
const SURROGATE_END: i32 = 0xe000

/**
 * Whether a string's units are UTF-8 bytes, as they are natively, rather than
 * UTF-16 units, as they are under Node.
 *
 * `é` is two bytes and one UTF-16 unit, so its length says which host is
 * running. It is written as an escape so that how this file is saved, `é` as
 * one code point or as `e` and a combining accent, cannot change the answer.
 * Natively the length of a literal is a load from a constant, and the
 * optimiser folds this call to `true` and drops the other walk in
 * `codePointLength`. The name is long for the reason `isTextBlankByte`'s is.
 */
const textUnitsAreBytes = (): boolean => toI32("\u00e9".length) === 2

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
 * except the low half of a surrogate pair.
 *
 * Both walks answer the same for any string literal, a lone surrogate escape
 * included: it is three WTF-8 bytes with one leading byte natively, and one
 * unit under Node. They differ for text built from bytes: `String.fromBytes`
 * and `String.fromCharCode` give one unit per byte under Node, so a string
 * decoded that way, as `nish/json` decodes a `\u` escape, counts its UTF-8
 * bytes there. They also differ for text that is not well-formed — bytes that
 * are not UTF-8 natively, where each stray continuation byte counts nothing, or
 * the two halves of a pair joined at run time, which are one string under Node
 * and two lone surrogates natively.
 *
 * @param text The text whose code points are counted.
 * @returns How many code points `text` holds, counted as above.
 */
export const codePointLength = (text: string): i32 => {
  const length: i32 = toI32(text.length)
  // `count` never passes `i`, which stays below `length`, so it never wraps.
  // It is a `u32` because unsigned addition carries no overflow check: an
  // `i32` would need a panic branch, or a `count < length` guard to prove it
  // away, and either one keeps the byte walk from vectorizing.
  let count: u32 = 0
  let i: i32 = 0
  if (textUnitsAreBytes()) {
    while (i < length) {
      if ((toI32(text.charCodeAt(i)) & UTF8_TOP_BITS) !== UTF8_CONTINUATION) {
        count += 1
      }
      i += 1
    }
    return toI32(count)
  }
  // A low surrogate right after a high one closes a pair the high one already
  // counted. Any other unit, a lone surrogate included, is a code point.
  let afterHigh: boolean = false
  while (i < length) {
    const unit: i32 = toI32(text.charCodeAt(i))
    if (!(afterHigh && unit >= LOW_SURROGATE && unit < SURROGATE_END)) {
      count += 1
    }
    afterHigh = unit >= HIGH_SURROGATE && unit < LOW_SURROGATE
    i += 1
  }
  return toI32(count)
}

/** The first and last lower-case ASCII letters, `a` and `z`. */
const ASCII_LOWER_A: i32 = 97
const ASCII_LOWER_Z: i32 = 122

/** The first and last upper-case ASCII letters, `A` and `Z`. */
const ASCII_UPPER_A: i32 = 65
const ASCII_UPPER_Z: i32 = 90

/** How far apart an ASCII letter's two cases are: `a` is `A` plus this. */
const ASCII_CASE_DISTANCE: i32 = 32

/**
 * `text` with every unit from `low` to `high` moved by `delta`, and every other
 * unit as it was: `asciiUpper` and `asciiLower`'s one walk.
 *
 * Natively the units are bytes, so the answer is built as bytes, one array and
 * one `String.fromBytes`. Under Node a unit can be wider than a byte, so the
 * unchanged runs are cut out of `text` whole and only the changed letters are
 * made one at a time. The name is long for the reason `isTextBlankByte`'s is.
 */
const shiftTextAsciiRange = (text: string, low: i32, high: i32, delta: i32): string => {
  const length: i32 = toI32(text.length)
  let i: i32 = 0
  if (textUnitsAreBytes()) {
    const bytes: u8[] = []
    while (i < length) {
      const code: i32 = toI32(text.charCodeAt(i))
      bytes.push(toU8(code >= low && code <= high ? code + delta : code))
      i += 1
    }
    return String.fromBytes(bytes, 0, length)
  }
  const parts: string[] = []
  let start: i32 = 0
  while (i < length) {
    const code: i32 = toI32(text.charCodeAt(i))
    if (code >= low && code <= high) {
      // `start` never passes `i`, which is below `length`, so this always
      // holds; it is what proves `start` within `text`, as in `splitLines`.
      if (start >= 0 && start < length) {
        parts.push(text.substring(start, i))
      }
      parts.push(String.fromCharCode(code + delta))
      start = i + 1
    }
    i += 1
  }
  if (start < length) {
    parts.push(text.substring(start, length))
  }
  return parts.join("")
}

/**
 * `text` with its ASCII letters `a` to `z` made `A` to `Z`, and nothing else
 * changed: every other byte, a UTF-8 sequence's included, passes through.
 *
 * This is not JavaScript's `toUpperCase`, which knows Unicode's case table:
 * that gives `"SS"` for `"ß"` and `"É"` for `"é"`, where this gives `"ß"` and
 * `"é"`. That table is more than this runtime has room for, and the text this
 * is for, identifiers, keywords and protocol tokens, is ASCII. On ASCII text
 * the two agree, and this answers the same natively and under Node for any
 * text, since a byte or unit from 97 to 122 is always the letter itself, so
 * NL8001 (`--warn-portability`) has nothing to warn about, and does not.
 *
 * @param text The text whose ASCII letters are upper-cased.
 * @returns A fresh string as long as `text`.
 */
export const asciiUpper = (text: string): string =>
  shiftTextAsciiRange(text, ASCII_LOWER_A, ASCII_LOWER_Z, -ASCII_CASE_DISTANCE)

/**
 * `text` with its ASCII letters `A` to `Z` made `a` to `z`, and nothing else
 * changed: every other byte, a UTF-8 sequence's included, passes through.
 *
 * This is not JavaScript's `toLowerCase`, for the reason `asciiUpper` gives:
 * `"É"` stays `"É"` here. On ASCII text the two agree, and this answers the
 * same natively and under Node for any text.
 *
 * @param text The text whose ASCII letters are lower-cased.
 * @returns A fresh string as long as `text`.
 */
export const asciiLower = (text: string): string =>
  shiftTextAsciiRange(text, ASCII_UPPER_A, ASCII_UPPER_Z, ASCII_CASE_DISTANCE)

/**
 * The padding `padStart` and `padEnd` put beside `text`: `fill` repeated and
 * cut so that `text` and the padding together are `width` units long, or `""`
 * when `text` is that long already or `fill` is empty.
 *
 * `fill` must be ASCII, and `caller` names the function in the panic when it
 * is not. A multi-byte fill cut at a byte width could end in half a UTF-8
 * sequence natively, which is text that is not well-formed, and padding is
 * done with spaces and zeros. The fill is checked before the width, so a bad
 * fill panics whether or not any padding was needed. The name is long for the
 * reason `isTextBlankByte`'s is.
 */
const textPadding = (text: string, width: i32, fill: string, caller: string): string => {
  const fillLength: i32 = toI32(fill.length)
  let j: i32 = 0
  while (j < fillLength) {
    if (toI32(fill.charCodeAt(j)) >= NON_ASCII) {
      panic(`${caller}: every byte of the fill must be ASCII`)
    }
    j += 1
  }
  const needed: i32 = width - toI32(text.length)
  if (needed <= 0 || fillLength === 0) {
    return ""
  }
  const parts: string[] = []
  let left: i32 = needed
  while (left >= fillLength) {
    parts.push(fill)
    left -= fillLength
  }
  parts.push(fill.substring(0, left))
  return parts.join("")
}

/**
 * `text` with `fill` repeated in front of it until it is `width` units long:
 * JavaScript's `text.padStart(width, fill)` for ASCII text. A `width` no
 * longer than `text`, or an empty `fill`, gives `text` unchanged, and a fill of
 * several characters repeats and is cut at the width, so
 * `padStart("7", 4, "ab")` is `"aba7"`.
 *
 * **`width` counts the units `text.length` counts**: bytes natively and UTF-16
 * units under Node. So on text that is not ASCII the two answers differ:
 * `padStart("é", 3, " ")` is `" é"` natively, where `é` is two bytes, and
 * `"  é"` under Node, where it is one unit. NL8001 (`--warn-portability`)
 * does not warn about it: the warning reads offsets in the program it is given,
 * the library's own `text.length` is not walked, and what reaches the caller is
 * a string rather than a number. Pad ASCII text, or count the width with
 * `codePointLength` yourself, when the answer must be the same on both.
 *
 * **A fill that is not ASCII panics**, for the reason `indexOfAny`'s set must
 * be ASCII: natively it would be cut in the middle of a UTF-8 sequence.
 *
 * @param text The text to pad.
 * @param width The length the answer is padded to, in `text.length`'s units.
 * @param fill The ASCII text repeated as the padding; `" "` and `"0"` are
 *   the usual ones.
 * @returns `text` with the padding in front; `text` unchanged when no
 *   padding is needed.
 */
export const padStart = (text: string, width: i32, fill: string): string =>
  textPadding(text, width, fill, "padStart") + text

/**
 * `text` with `fill` repeated after it until it is `width` units long:
 * JavaScript's `text.padEnd(width, fill)` for ASCII text, with `padStart`'s
 * rules. `padEnd("7", 4, "ab")` is `"7aba"`, and `padEnd("é", 3, " ")` is
 * `"é "` natively and `"é  "` under Node.
 *
 * @param text The text to pad.
 * @param width The length the answer is padded to, in `text.length`'s units.
 * @param fill The ASCII text repeated as the padding.
 * @returns `text` with the padding after it; `text` unchanged when no
 *   padding is needed.
 */
export const padEnd = (text: string, width: i32, fill: string): string =>
  text + textPadding(text, width, fill, "padEnd")
