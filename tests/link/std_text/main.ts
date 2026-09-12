// `std/text` checked with `std/testing`, the way a user would compose the two:
// one program, two library modules, and a report the binary prints itself. The
// assertions are the edge cases the doc comments in `std/text.ts` *decide* —
// no phantom line after a trailing newline, a `\r\n` line keeping its `\r`, no
// empty elements from `splitWhitespace`, `contains(s, "")` being true, an empty
// needle leaving `replaceAll` alone — so changing one of those decisions makes
// this case the diff that says so.
import { Suite } from "../../../std/testing";
import {
  contains,
  firstDifference,
  replaceAll,
  splitLines,
  splitWhitespace,
  trim,
  trimEnd,
  trimStart,
} from "../../../std/text";

export const main = (): number => {
  const t = new Suite("text");

  // --- splitLines ----------------------------------------------------------
  // A file that ends in a newline has as many lines as it has newlines: the
  // terminator ends the last line rather than starting an empty one.
  const trailing: string[] = splitLines("alpha\nbeta\n");
  if (!t.eqI32("splitLines: a trailing newline adds no phantom line", trailing.length, 2)) {
    return t.done();
  }
  t.eqStr("splitLines: first line", trailing[0], "alpha");
  t.eqStr("splitLines: last line", trailing[1], "beta");
  t.eqI32(
    "splitLines: a trailing newline makes no difference to the line list",
    firstDifference(trailing, splitLines("alpha\nbeta")),
    -1
  );

  // `\r\n` keeps its `\r`, because stripping it would be a guess about the
  // file's provenance; `trimEnd` is the caller's way out.
  const crlf: string[] = splitLines("alpha\r\nbeta");
  if (!t.eqI32("splitLines: a CRLF text has two lines", crlf.length, 2)) {
    return t.done();
  }
  t.eqStr("splitLines: a CRLF line keeps its carriage return", crlf[0], "alpha\r");
  t.eqStr("splitLines: trimEnd is how a caller drops that carriage return", trimEnd(crlf[0]), "alpha");
  t.eqStr("splitLines: the line after a CRLF ending is intact", crlf[1], "beta");

  t.eqI32("splitLines: an empty text has no lines", splitLines("").length, 0);

  const lone: string[] = splitLines("\n");
  if (!t.eqI32("splitLines: a lone newline is one line", lone.length, 1)) {
    return t.done();
  }
  t.eqStr("splitLines: and that line is empty", lone[0], "");

  const blankInside: string[] = splitLines("alpha\n\nbeta");
  if (!t.eqI32("splitLines: an interior blank line is kept", blankInside.length, 3)) {
    return t.done();
  }
  t.eqStr("splitLines: the blank line is empty, not dropped", blankInside[1], "");

  t.eqI32("splitLines: a text with no newline at all is one line", splitLines("alpha").length, 1);

  // A trailing CRLF is one terminator, so it ends the only line and leaves its
  // `\r` on it: the two decisions above meet here.
  const trailingCrlf: string[] = splitLines("alpha\r\n");
  if (!t.eqI32("splitLines: a trailing CRLF is one line, not two", trailingCrlf.length, 1)) {
    return t.done();
  }
  t.eqStr("splitLines: and that line still carries the carriage return", trailingCrlf[0], "alpha\r");

  // Every offset here is a byte offset, and a newline cannot appear inside a
  // multi-byte UTF-8 sequence, so multi-byte text passes through untouched.
  const utf8: string[] = splitLines("h\u00e9llo\nw\u00f6rld\n");
  if (!t.eqI32("splitLines: UTF-8 text splits on its newlines", utf8.length, 2)) {
    return t.done();
  }
  t.eqStr("splitLines: a multi-byte line passes through untouched", utf8[0], "h\u00e9llo");

  // --- splitWhitespace -----------------------------------------------------
  // Leading, trailing and repeated blanks are all separators, so no element is
  // ever empty. This is the difference from splitting on a single space.
  const padded: string[] = splitWhitespace("   alpha   beta   ");
  if (!t.eqI32("splitWhitespace: leading, trailing and repeated blanks add no empty elements", padded.length, 2)) {
    return t.done();
  }
  t.eqStr("splitWhitespace: first word", padded[0], "alpha");
  t.eqStr("splitWhitespace: last word", padded[1], "beta");

  // All four blank bytes the module recognises: space, tab, newline, return.
  const mixed: string[] = splitWhitespace("alpha\tbeta\ngamma\rdelta");
  if (!t.eqI32("splitWhitespace: tab, newline and carriage return separate too", mixed.length, 4)) {
    return t.done();
  }
  t.eqStr("splitWhitespace: the word after a tab", mixed[1], "beta");
  t.eqStr("splitWhitespace: the word after a carriage return", mixed[3], "delta");

  t.eqI32("splitWhitespace: an all-blank text has no words", splitWhitespace(" \t\r\n ").length, 0);
  t.eqI32("splitWhitespace: an empty text has no words", splitWhitespace("").length, 0);

  const solo: string[] = splitWhitespace("alpha");
  if (!t.eqI32("splitWhitespace: one word with no blanks is one element", solo.length, 1)) {
    return t.done();
  }
  t.eqStr("splitWhitespace: that one element is the whole text", solo[0], "alpha");

  const utf8Words: string[] = splitWhitespace("  h\u00e9llo  w\u00f6rld  ");
  if (!t.eqI32("splitWhitespace: multi-byte words split on the blanks between them", utf8Words.length, 2)) {
    return t.done();
  }
  t.eqStr("splitWhitespace: a multi-byte word is not cut mid-sequence", utf8Words[1], "w\u00f6rld");

  // --- trimStart / trimEnd / trim ------------------------------------------
  t.eqStr("trimStart: only the leading blanks go", trimStart("  alpha  "), "alpha  ");
  t.eqStr("trimEnd: only the trailing blanks go", trimEnd("  alpha  "), "  alpha");
  t.eqStr("trim: both ends go", trim("  alpha  "), "alpha");
  t.eqStr("trim: interior blanks are not touched", trim("  alpha   beta  "), "alpha   beta");
  t.eqStr("trim: an all-blank string trims to empty", trim(" \t\r\n "), "");
  t.eqStr("trim: an empty string trims to itself", trim(""), "");
  t.eqStr("trim: a string with nothing to trim is unchanged", trim("alpha"), "alpha");
  t.eqStr("trimStart: an all-blank string trims to empty", trimStart("\t\t"), "");
  t.eqStr("trimEnd: a CRLF terminator counts as blank", trimEnd("alpha\r\n"), "alpha");

  // --- contains ------------------------------------------------------------
  t.eqBool("contains: an interior occurrence", contains("alphabet", "phab"), true);
  t.eqBool("contains: a needle that does not occur", contains("alphabet", "beta"), false);
  t.eqBool("contains: the empty needle is in every string", contains("alphabet", ""), true);
  t.eqBool("contains: the empty needle is in the empty string too", contains("", ""), true);
  t.eqBool("contains: nothing else is in the empty string", contains("", "alpha"), false);
  t.eqBool("contains: a string contains itself", contains("alphabet", "alphabet"), true);
  t.eqBool("contains: a needle longer than the haystack", contains("alpha", "alphabet"), false);

  // --- replaceAll ----------------------------------------------------------
  t.eqStr("replaceAll: every occurrence, not just the first", replaceAll("a-b-c", "-", "+"), "a+b+c");
  t.eqStr("replaceAll: an empty needle answers the input unchanged", replaceAll("a-b-c", "", "+"), "a-b-c");
  t.eqStr("replaceAll: a needle that does not occur answers the input", replaceAll("a-b-c", "_", "+"), "a-b-c");
  // Overlapping candidates: the leftmost match wins and the scan resumes after
  // it, so "aaa" has one "aa" and a leftover "a" rather than two matches.
  t.eqStr("replaceAll: overlapping candidates match leftmost, once each", replaceAll("aaa", "aa", "b"), "ba");
  t.eqStr("replaceAll: and an even run matches twice", replaceAll("aaaa", "aa", "b"), "bb");
  t.eqStr("replaceAll: adjacent occurrences", replaceAll("--", "-", "+"), "++");
  t.eqStr("replaceAll: an empty replacement deletes the needle", replaceAll("a-b-c", "-", ""), "abc");
  t.eqStr("replaceAll: a needle at both ends", replaceAll("-a-", "-", "+"), "+a+");
  t.eqStr("replaceAll: the whole string as the needle", replaceAll("alpha", "alpha", "beta"), "beta");
  t.eqStr("replaceAll: an empty text answers empty", replaceAll("", "-", "+"), "");
  t.eqStr("replaceAll: a multi-character replacement is copied whole, and the needle is literal", replaceAll("a.b", ".", " -> "), "a -> b");

  // --- firstDifference -----------------------------------------------------
  const want: string[] = splitLines("alpha\nbeta\ngamma\n");
  t.eqI32("firstDifference: equal line lists answer -1", firstDifference(want, splitLines("alpha\nbeta\ngamma\n")), -1);
  t.eqI32("firstDifference: the index of the first differing line", firstDifference(want, splitLines("alpha\nBETA\ngamma\n")), 1);
  t.eqI32("firstDifference: a difference on the very first line", firstDifference(want, splitLines("ALPHA\nbeta\ngamma\n")), 0);
  // One a prefix of the other: the answer is the shorter length, which is the
  // index of the first line only the longer list has — and it is symmetric.
  t.eqI32("firstDifference: a prefix answers the shorter length", firstDifference(splitLines("alpha\nbeta\n"), want), 2);
  t.eqI32("firstDifference: the same answer with the arguments swapped", firstDifference(want, splitLines("alpha\nbeta\n")), 2);
  const none: string[] = [];
  t.eqI32("firstDifference: two empty lists are equal", firstDifference(none, splitLines("")), -1);
  t.eqI32("firstDifference: an empty list against a non-empty one differs at 0", firstDifference(none, want), 0);
  t.eqI32("firstDifference: a trailing blank line is a difference", firstDifference(want, splitLines("alpha\nbeta\ngamma\n\n")), 3);

  return t.done();
};
