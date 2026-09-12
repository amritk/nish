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
 */

const NEWLINE: i32 = 10;
const CARRIAGE_RETURN: i32 = 13;
const SPACE: i32 = 32;
const TAB: i32 = 9;

/** Whether `code` is one of the four ASCII bytes this module treats as blank. */
const isBlank = (code: i32): boolean =>
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
  const lines: string[] = [];
  let start: i32 = 0;
  let i: i32 = 0;
  while (i < text.length) {
    if (text.charCodeAt(i) === NEWLINE) {
      lines.push(text.substring(start, i));
      start = i + 1;
    }
    i += 1;
  }
  if (start < text.length) {
    lines.push(text.substring(start, text.length));
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
  const parts: string[] = [];
  let start: i32 = -1;
  let i: i32 = 0;
  while (i < text.length) {
    if (isBlank(text.charCodeAt(i))) {
      if (start >= 0) {
        parts.push(text.substring(start, i));
        start = -1;
      }
    } else if (start < 0) {
      start = i;
    }
    i += 1;
  }
  if (start >= 0) {
    parts.push(text.substring(start, text.length));
  }
  return parts;
};

/** `text` without its leading blank bytes. */
export const trimStart = (text: string): string => {
  let i: i32 = 0;
  while (i < text.length && isBlank(text.charCodeAt(i))) {
    i += 1;
  }
  return text.substring(i, text.length);
};

/** `text` without its trailing blank bytes. */
export const trimEnd = (text: string): string => {
  let end: i32 = text.length;
  while (end > 0 && isBlank(text.charCodeAt(end - 1))) {
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
export const contains = (haystack: string, needle: string): boolean => haystack.indexOf(needle) >= 0;

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
  if (needle.length === 0) {
    return text;
  }
  const parts: string[] = [];
  let rest = text;
  while (true) {
    const at = rest.indexOf(needle);
    if (at < 0) {
      parts.push(rest);
      return parts.join(replacement);
    }
    parts.push(rest.substring(0, at));
    rest = rest.substring(at + needle.length, rest.length);
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
  const shorter = left.length < right.length ? left.length : right.length;
  let i: i32 = 0;
  while (i < shorter) {
    if (left[i] !== right[i]) {
      return i;
    }
    i += 1;
  }
  return left.length === right.length ? -1 : shorter;
};
