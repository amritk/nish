// `std/text` checked with `std/testing`, the way a user would compose the two:
// one program, two library modules, and a report the binary prints itself. The
// assertions are the edge cases the doc comments in `std/text.ts` *decide* —
// no phantom line after a trailing newline, a `\r\n` line keeping its `\r`, no
// empty elements from `splitWhitespace`, `contains(s, "")` being true, an empty
// needle leaving `replaceAll` alone — so changing one of those decisions makes
// this case the diff that says so.
//
// The same program runs under Node too (`tests/run.js`, "link/std_text: under
// the Node prelude it exits 0 and prints expected.out"), which is why the imports name the `.ts` file: Node
// resolves a relative path only as written, and Nish takes either spelling.
import { Suite } from "../../../std/testing.ts";
import {
  asciiLower,
  asciiUpper,
  codePointLength,
  contains,
  firstDifference,
  padEnd,
  padStart,
  replaceAll,
  split,
  splitLines,
  splitWhitespace,
  trim,
  trimEnd,
  trimStart,
} from "../../../std/text.ts";

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

  // --- split ---------------------------------------------------------------
  // JavaScript's `split` for a separator that is not empty: an empty piece at
  // each end and between adjacent separators, which is what `splitWhitespace`
  // drops. Each piece is checked through `join`, which keeps the empty ones.
  const fields: string[] = split(",a,,b,", ",");
  t.eqI32("split: separators at both ends and side by side give empty pieces", fields.length, 5);
  t.eqStr("split: and the pieces are in order", fields.join("|"), "|a||b|");
  t.eqStr("split: a separator that never occurs gives the whole text", split("alpha", ",").join("|"), "alpha");
  t.eqI32("split: and that is one piece", split("alpha", ",").length, 1);
  t.eqI32("split: the empty text is one empty piece", split("", ",").length, 1);
  t.eqStr("split: and that piece is empty", split("", ",")[0], "");
  t.eqI32("split: the separator alone is two empty pieces", split(",", ",").length, 2);
  t.eqStr("split: a multi-byte ASCII separator", split("a::b::c", "::").join("|"), "a|b|c");
  // Overlapping candidates: the leftmost wins and the search goes on past it,
  // as in `replaceAll`, so "aaa" on "aa" is "" and "a".
  t.eqStr("split: overlapping candidates match leftmost, once each", split("aaa", "aa").join("|"), "|a");
  t.eqStr("split: the whole text as the separator", split("alpha", "alpha").join("|"), "|");
  // A separator that is not ASCII is a whole sequence natively and a whole
  // run of units under Node, so both find the same pieces.
  t.eqStr("split: a two-byte separator", split("a\u00e9b\u00e9c", "\u00e9").join("|"), "a|b|c");
  t.eqStr("split: a four-byte separator, a surrogate pair under Node", split("x😀y😀", "😀").join("|"), "x|y|");
  t.eqStr("split: multi-byte text on an ASCII separator", split("h\u00e9llo w\u00f6rld", " ").join("|"), "h\u00e9llo|w\u00f6rld");
  // `é` written as `e` and a combining accent holds an `e`, which a `split`
  // on "e" finds natively and under Node alike.
  t.eqStr("split: an ASCII separator inside a decomposed character", split("e\u0301", "e").join("|"), "|\u0301");

  // --- asciiUpper / asciiLower ---------------------------------------------
  t.eqStr("asciiUpper: the ASCII letters change", asciiUpper("get_user-ID 42"), "GET_USER-ID 42");
  t.eqStr("asciiLower: the ASCII letters change", asciiLower("Get_User-ID 42"), "get_user-id 42");
  t.eqStr("asciiUpper: the empty text", asciiUpper(""), "");
  t.eqStr("asciiLower: the empty text", asciiLower(""), "");
  // The bytes either side of each range: `@` and `[` round `A`-`Z`, and the
  // backtick and `{` round `a`-`z`.
  t.eqStr("asciiUpper: only a to z move", asciiUpper("@AZ[`az{"), "@AZ[`AZ{");
  t.eqStr("asciiLower: only A to Z move", asciiLower("@AZ[`az{"), "@az[`az{");
  // Not `toUpperCase`: JavaScript makes "ß" "SS" and "é" "É"; these leave
  // every byte that is not an ASCII letter alone.
  t.eqStr("asciiUpper: \u00df and \u00e9 are not ASCII and stay", asciiUpper("stra\u00dfe caf\u00e9"), "STRA\u00dfE CAF\u00e9");
  t.eqStr("asciiLower: \u00c9 is not ASCII and stays", asciiLower("CAF\u00c9"), "caf\u00c9");
  t.eqStr("asciiUpper: a four-byte sequence passes through", asciiUpper("a😀b"), "A😀B");
  t.eqStr("asciiLower: a four-byte sequence passes through", asciiLower("A😀B"), "a😀b");
  t.eqI32("asciiUpper: the length is the input's", asciiUpper("stra\u00dfe").length, "stra\u00dfe".length);

  // --- padStart / padEnd ---------------------------------------------------
  // JavaScript's answers for ASCII text. Text that is not ASCII counts bytes
  // natively and units under Node: `tests/link/std_text_pad_native`.
  t.eqStr("padStart: zeros in front", padStart("7", 3, "0"), "007");
  t.eqStr("padEnd: spaces after", padEnd("ab", 4, " "), "ab  ");
  t.eqStr("padStart: a several-character fill repeats and is cut at the width", padStart("7", 4, "ab"), "aba7");
  t.eqStr("padEnd: and the same after", padEnd("7", 4, "ab"), "7aba");
  t.eqStr("padStart: a fill that fits exactly is not cut", padStart("7", 5, "ab"), "abab7");
  t.eqStr("padStart: a width equal to the length changes nothing", padStart("abc", 3, "0"), "abc");
  t.eqStr("padEnd: a width below the length changes nothing", padEnd("abc", 1, "0"), "abc");
  t.eqStr("padStart: a negative width changes nothing", padStart("abc", -4, "0"), "abc");
  t.eqStr("padStart: an empty fill changes nothing", padStart("abc", 8, ""), "abc");
  t.eqStr("padEnd: an empty fill changes nothing", padEnd("abc", 8, ""), "abc");
  t.eqStr("padStart: the empty text is all fill", padStart("", 3, "-"), "---");
  // A fill longer than the room left is cut to it.
  t.eqStr("padEnd: a fill longer than the room is cut", padEnd("ab", 3, "xyz"), "abx");

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

  // --- codePointLength -----------------------------------------------------
  // One code point per sequence, whatever its width: natively that is one byte
  // in 1, 2, 3 or 4, and under Node one UTF-16 unit or one surrogate pair.
  t.eqI32("codePointLength: the empty string has none", codePointLength(""), 0);
  t.eqI32("codePointLength: ASCII is one per byte", codePointLength("alpha beta"), 10);
  t.eqI32("codePointLength: a two-byte sequence is one", codePointLength("é"), 1);
  t.eqI32("codePointLength: a three-byte sequence is one", codePointLength("€"), 1);
  t.eqI32("codePointLength: a four-byte sequence, a surrogate pair under Node, is one", codePointLength("😀"), 1);
  t.eqI32("codePointLength: a mix of every width", codePointLength("aé€😀z"), 5);
  // Latin-1 from U+0080 to U+00BF is one UTF-16 unit each in the continuation
  // byte range, so a byte rule applied under Node would count nothing here.
  t.eqI32("codePointLength: continuation-range Latin-1 counts one each", codePointLength("©®±"), 3);
  t.eqI32("codePointLength: the pair written as two escapes is one", codePointLength("\ud83d\ude00"), 1);
  t.eqI32("codePointLength: a lone surrogate is one", codePointLength("a\ud800b"), 3);

  return t.done();
};
