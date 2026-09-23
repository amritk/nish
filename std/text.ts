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
 * like `s.length` itself, and every function is ASCII-only where it inspects
 * characters at all — a UTF-8 string passes through `splitLines` and `split`
 * untouched, because a newline and a space cannot appear inside a multi-byte
 * sequence.
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

const NEWLINE: i32 = 10;
const CARRIAGE_RETURN: i32 = 13;
const SPACE: i32 = 32;
const TAB: i32 = 9;

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
  code === SPACE || code === TAB || code === NEWLINE || code === CARRIAGE_RETURN;

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
  const length: i32 = toI32(text.length);
  const lines: string[] = [];
  let start: i32 = 0;
  let i: i32 = 0;
  while (i < length) {
    if (toI32(text.charCodeAt(i)) === NEWLINE) {
      // `start` is never negative and never passes `i`, which is below
      // `length`, so this test always holds. It is written because it is what
      // proves `start` within `text`: the clamp on that bound is dead once it
      // is proven, and the emitter drops it.
      if (start >= 0 && start < length) {
        lines.push(text.substring(start, i));
      }
      start = i + 1;
    }
    i += 1;
  }
  if (start < length) {
    lines.push(text.substring(start, length));
  }
  return lines;
};

/**
 * The runs of non-blank bytes in `text`, with every blank run as the separator.
 * Leading, trailing and repeated blanks produce no empty elements, which is what
 * splitting a line of command-line flags wants — and it is why this is not
 * `split(text, " ")`, which would.
 */
export const splitWhitespace = (text: string): string[] => {
  const length: i32 = toI32(text.length);
  const parts: string[] = [];
  let start: i32 = -1;
  let i: i32 = 0;
  while (i < length) {
    if (isTextBlankByte(toI32(text.charCodeAt(i)))) {
      // `start` is `-1` or a byte already passed, so the second half always
      // holds when the first does; it proves the bound, as in `splitLines`.
      if (start >= 0 && start < length) {
        parts.push(text.substring(start, i));
        start = -1;
      }
    } else if (start < 0) {
      start = i;
    }
    i += 1;
  }
  if (start >= 0) {
    parts.push(text.substring(start, length));
  }
  return parts;
};

/** `text` without its leading blank bytes. */
export const trimStart = (text: string): string => {
  const length: i32 = toI32(text.length);
  let i: i32 = 0;
  while (i < length && isTextBlankByte(toI32(text.charCodeAt(i)))) {
    i += 1;
  }
  return text.substring(i, length);
};

/** `text` without its trailing blank bytes. */
export const trimEnd = (text: string): string => {
  let end: i32 = toI32(text.length);
  while (end > 0 && isTextBlankByte(toI32(text.charCodeAt(end - 1)))) {
    end -= 1;
  }
  return text.substring(0, end);
};

/** `text` without blank bytes at either end. */
export const trim = (text: string): string => trimEnd(trimStart(text));

/**
 * Whether `needle` occurs anywhere in `haystack`. One `indexOf`, named, because
 * `indexOf(...) >= 0` at a call site reads as arithmetic where the question is a
 * yes or a no. `contains(s, "")` is `true`, as `indexOf("")` is `0`.
 */
export const contains = (haystack: string, needle: string): boolean => toI32(haystack.indexOf(needle)) >= 0;

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
  const needleLength: i32 = toI32(needle.length);
  if (needleLength === 0) {
    return text;
  }
  const parts: string[] = [];
  let rest = text;
  while (true) {
    const at: i32 = toI32(rest.indexOf(needle));
    // `indexOf` never answers past `rest.length`, so the second half never
    // holds; it is written because its negation is what proves `at` within
    // `rest` for the `substring` below, as in `splitLines`.
    if (at < 0 || at > toI32(rest.length)) {
      parts.push(rest);
      return parts.join(replacement);
    }
    parts.push(rest.substring(0, at));
    rest = rest.substring(at + needleLength, toI32(rest.length));
  }
};

/**
 * The index of the first line at which `left` and `right` differ, or `-1` when
 * one is a prefix of the other and they have the same length — that is, when
 * they are equal. A caller comparing generated text against a golden wants the
 * first differing line and not a boolean, because printing two whole files is
 * not a diagnostic.
 */
export const firstDifference = (left: string[], right: string[]): i32 => {
  const leftLength: i32 = toI32(left.length);
  const rightLength: i32 = toI32(right.length);
  let i: i32 = 0;
  // Two tests rather than one against the shorter length: each proves `i`
  // within one of the arrays, and a minimum taken with a ternary proves
  // neither. The loop ends with `i` at the shorter length.
  while (i < leftLength && i < rightLength) {
    if (left[i] !== right[i]) {
      return i;
    }
    i += 1;
  }
  return leftLength === rightLength ? -1 : i;
};
