// Every token kind, every error code, every limit and every method of
// JsonTokenizer, each on the smallest input that reaches it.
import {
  JSON_DEFAULT_MAX_DEPTH,
  JSON_DEFAULT_MAX_NUMBER_BYTES,
  JSON_DEFAULT_MAX_STRING_BYTES,
  JSON_DEFAULT_MAX_TOTAL_BYTES,
  JSON_TOK_ARRAY_BEGIN,
  JSON_TOK_ARRAY_END,
  JSON_TOK_END,
  JSON_TOK_ERR_SYNTAX,
  JSON_TOK_FALSE,
  JSON_TOK_KEY,
  JSON_TOK_NULL,
  JSON_TOK_NUMBER,
  JSON_TOK_OBJECT_BEGIN,
  JSON_TOK_OBJECT_END,
  JSON_TOK_STRING,
  JSON_TOK_TRUE,
  JsonLimits,
  JsonTokenizer,
} from "../../../std/json-tokenizer";
import { messageInto } from "../../../docs/cookbook/json-tokenizer";
import { Suite } from "../../../std/testing";
import { jtBytes, jtCodeName, jtHex, jtTokens, jtTokensOf, jtVerdict, jtVerdictOf, jtWord } from "./common";

/** Limits of `depth`, `stringBytes`, `numberBytes` and `totalBytes`. */
const jtLimits = (depth: i32, stringBytes: i32, numberBytes: i32, totalBytes: i32): JsonLimits => {
  const l = new JsonLimits();
  l.maxDepth = depth;
  l.maxStringBytes = stringBytes;
  l.maxNumberBytes = numberBytes;
  l.maxTotalBytes = totalBytes;
  return l;
};

/** A tokenizer over the bytes of `text`, moved on to its first token of kind `kind`; `null` if none comes. */
const jtAt = (text: string, kind: i32): JsonTokenizer | null => {
  const bytes = jtBytes(text);
  const t = new JsonTokenizer(bytes, 0, toI32(bytes.length), new JsonLimits());
  let k: i32 = t.next();
  while (k > 0 && k !== kind) {
    k = t.next();
  }
  return k === kind ? t : null;
};

/** The current number of `text`'s first number token as `numberF64`'s bits, or `-1` with no number. */
const jtF64Bits = (text: string): i64 => {
  const t = jtAt(text, JSON_TOK_NUMBER);
  return t === null ? -1 : f64ToBits(t.numberF64());
};

/** `n` bytes of `a`, then `m` of `b`, then `last` when it is not 0. */
const jtRuns = (a: i32, n: i32, b: i32, m: i32, last: i32): u8[] => {
  const out: u8[] = [];
  let i: i32 = 0;
  while (i < n) {
    out.push(toU8(a));
    i += 1;
  }
  i = 0;
  while (i < m) {
    out.push(toU8(b));
    i += 1;
  }
  if (last !== 0) {
    out.push(toU8(last));
  }
  return out;
};

const tokenKinds = (t: Suite): void => {
  t.eqStr(
    "every token kind, in a document that holds each",
    jtTokens(' { "a" : [ 1 , -2.5e1 , "x" , true , false , null , { } , [ ] ] } '),
    "{ k:a [ n:1 n:-25 s:x t f z { } [ ] ] } END"
  );
  t.eqStr("a scalar is a whole document", jtTokens("  7  "), "n:7 END");
  t.eqStr("a string is a whole document", jtTokens('"s"'), "s:s END");
  t.eqStr("each literal is a whole document", jtTokens("true false null"), "t TRAILING@5");
  t.eqStr("the four blanks are skipped", jtTokens("\t\n\r [ ]\t\n\r "), "[ ] END");
  t.eqStr("an empty object and an empty array", jtTokens("[{},[]]"), "[ { } [ ] ] END");
  t.eqStr("members after the first", jtTokens('{"a":1,"b":{"c":[]}}'), "{ k:a n:1 k:b { k:c [ ] } } END");

  const bytes = jtBytes('{"ab":[10,"cd"]}');
  const tok = new JsonTokenizer(bytes, 0, toI32(bytes.length), new JsonLimits());
  t.eqI32("kind before the first next() is END", tok.kind, JSON_TOK_END);
  t.eqI32("the first token is OBJECT_BEGIN", tok.next(), JSON_TOK_OBJECT_BEGIN);
  t.eqI32("...at depth 1", tok.depth, 1);
  t.eqI32("...spanning byte 0", tok.tokEnd - tok.tokStart, 1);
  t.eqI32("then KEY", tok.next(), JSON_TOK_KEY);
  t.eqI32("...whose span holds its quotes", tok.tokStart * 100 + tok.tokEnd, 105);
  t.eqI32("then ARRAY_BEGIN, past the colon", tok.next(), JSON_TOK_ARRAY_BEGIN);
  t.eqI32("...at depth 2", tok.depth, 2);
  t.eqI32("then NUMBER", tok.next(), JSON_TOK_NUMBER);
  t.eqI32("...spanning its two digits", tok.tokStart * 100 + tok.tokEnd, 709);
  t.eqI32("then STRING", tok.next(), JSON_TOK_STRING);
  t.eqI32("then ARRAY_END", tok.next(), JSON_TOK_ARRAY_END);
  t.eqI32("...back at depth 1", tok.depth, 1);
  t.eqI32("then OBJECT_END", tok.next(), JSON_TOK_OBJECT_END);
  t.eqI32("...at depth 0", tok.depth, 0);
  t.eqI32("then END", tok.next(), JSON_TOK_END);
  t.eqI32("and END again", tok.next(), JSON_TOK_END);
  t.eqI32("kind is END after it", tok.kind, JSON_TOK_END);
  t.eqI32("failed stays 0 on a valid document", tok.failed, 0);
  t.eqI32("errorAt stays -1 on a valid document", tok.errorAt, -1);

  const lits = jtBytes("[true,false,null]");
  const lt = new JsonTokenizer(lits, 0, toI32(lits.length), new JsonLimits());
  lt.next();
  t.eqI32("TRUE", lt.next(), JSON_TOK_TRUE);
  t.eqI32("FALSE", lt.next(), JSON_TOK_FALSE);
  t.eqI32("NULL", lt.next(), JSON_TOK_NULL);
};

const errors = (t: Suite): void => {
  // SYNTAX: a byte that cannot stand where it stands.
  t.eqStr("SYNTAX: a trailing comma in an array", jtVerdict("[1,]"), "SYNTAX@3");
  t.eqStr("SYNTAX: a trailing comma in an object", jtVerdict('{"a":1,}'), "SYNTAX@7");
  t.eqStr("SYNTAX: no colon after a key", jtVerdict('{"a" 1}'), "SYNTAX@5");
  t.eqStr("SYNTAX: a key that is not a string", jtVerdict("{1:1}"), "SYNTAX@1");
  t.eqStr("SYNTAX: a closer of the wrong kind for an array", jtVerdict("[1}"), "SYNTAX@2");
  t.eqStr("SYNTAX: a closer of the wrong kind for an object", jtVerdict('{"a":1]'), "SYNTAX@6");
  t.eqStr("SYNTAX: a closer of the wrong kind right after an opener", jtVerdict("[}"), "SYNTAX@1");
  t.eqStr("SYNTAX: two values with no comma", jtVerdict("[1 2]"), "SYNTAX@3");
  t.eqStr("SYNTAX: a comma first", jtVerdict("[,1]"), "SYNTAX@1");
  t.eqStr("SYNTAX: a leading +", jtVerdict("+1"), "SYNTAX@0");
  t.eqStr("SYNTAX: a leading .", jtVerdict(".5"), "SYNTAX@0");
  t.eqStr("SYNTAX: a misspelt literal", jtVerdict("[trux]"), "SYNTAX@4");
  t.eqStr("SYNTAX: a literal in capitals", jtVerdict("True"), "SYNTAX@0");
  t.eqStr("SYNTAX: a literal that goes wrong on its last letter", jtVerdict("nulx"), "SYNTAX@3");
  t.eqStr("SYNTAX: a leading zero is a 0 and then a stray digit", jtVerdict("[01]"), "SYNTAX@2");
  t.eqStr("TRAILING: a leading zero at the top level is a 0 and then trailing data", jtVerdict("01"), "TRAILING@1");
  t.eqStr("SYNTAX: a letter after a number", jtVerdict("[1x]"), "SYNTAX@2");
  t.eqStr("SYNTAX: a single quote", jtVerdict("['a']"), "SYNTAX@1");
  t.eqStr("SYNTAX: a form feed is not a blank", jtVerdict("[\f]"), "SYNTAX@1");
  t.eqStr("SYNTAX: a byte-order mark", jtVerdictOf([239, 187, 191, 91, 93], new JsonLimits()), "SYNTAX@0");
  t.eqStr("SYNTAX: a non-ASCII byte outside a string", jtVerdictOf([91, 195, 169, 93], new JsonLimits()), "SYNTAX@1");
  // TRUNCATED: the window ends inside a value.
  t.eqStr("TRUNCATED: an empty window", jtVerdict(""), "TRUNCATED@0");
  t.eqStr("TRUNCATED: only blanks", jtVerdict("  "), "TRUNCATED@2");
  t.eqStr("TRUNCATED: after an opening bracket", jtVerdict("["), "TRUNCATED@1");
  t.eqStr("TRUNCATED: after an opening brace", jtVerdict("{"), "TRUNCATED@1");
  t.eqStr("TRUNCATED: after a key", jtVerdict('{"a"'), "TRUNCATED@4");
  t.eqStr("TRUNCATED: after a colon", jtVerdict('{"a":'), "TRUNCATED@5");
  t.eqStr("TRUNCATED: after a comma in an object", jtVerdict('{"a":1,'), "TRUNCATED@7");
  t.eqStr("TRUNCATED: after a comma in an array", jtVerdict("[1,"), "TRUNCATED@3");
  t.eqStr("TRUNCATED: after a value in an array", jtVerdict("[1"), "TRUNCATED@2");
  t.eqStr("TRUNCATED: an unclosed string", jtVerdict('"abc'), "TRUNCATED@4");
  t.eqStr("TRUNCATED: inside a literal", jtVerdict("[tru"), "TRUNCATED@4");
  t.eqStr("TRUNCATED: a lone minus", jtVerdict("-"), "TRUNCATED@1");
  t.eqStr("TRUNCATED: a fraction with no digit", jtVerdict("1."), "TRUNCATED@2");
  t.eqStr("TRUNCATED: an exponent with no digit", jtVerdict("1e+"), "TRUNCATED@3");
  t.eqStr("TRUNCATED: a backslash at the end", jtVerdict('"\\'), "TRUNCATED@2");
  t.eqStr("TRUNCATED: a \\u escape cut short", jtVerdict('"\\u12'), "TRUNCATED@3");
  t.eqStr("TRUNCATED: a surrogate pair's second half cut short", jtVerdict('"\\uD834\\uDD'), "TRUNCATED@9");
  // TRAILING: anything but blanks after the top-level value.
  t.eqStr("TRAILING: a second document", jtVerdict("[] []"), "TRAILING@3");
  t.eqStr("TRAILING: a second scalar", jtVerdict("1 2"), "TRAILING@2");
  t.eqStr("TRAILING: a stray closer", jtVerdict("{}}"), "TRAILING@2");
  t.eqStr("TRAILING: a NUL after the value", jtVerdictOf([91, 93, 0], new JsonLimits()), "TRAILING@2");
  // NUMBER: outside the RFC 8259 §6 grammar.
  t.eqStr("NUMBER: a minus and a letter", jtVerdict("-a"), "NUMBER@1");
  t.eqStr("NUMBER: -Infinity", jtVerdict("-Infinity"), "NUMBER@1");
  t.eqStr("NUMBER: a dot and a letter", jtVerdict("1.a"), "NUMBER@2");
  t.eqStr("NUMBER: an exponent and a letter", jtVerdict("1ea"), "NUMBER@2");
  t.eqStr("NUMBER: an exponent sign and a letter", jtVerdict("1e-a"), "NUMBER@3");
  // CONTROL: a raw byte below 0x20 in a string.
  t.eqStr("CONTROL: a raw tab", jtVerdict('"a\tb"'), "CONTROL@2");
  t.eqStr("CONTROL: a raw NUL", jtVerdictOf([34, 0, 34], new JsonLimits()), "CONTROL@1");
  t.eqStr("CONTROL: a raw newline in a key", jtVerdict('{"a\n":1}'), "CONTROL@3");
  // ESCAPE: a backslash and something that is not an escape.
  t.eqStr("ESCAPE: \\x", jtVerdict('"\\x"'), "ESCAPE@2");
  t.eqStr("ESCAPE: \\U in capitals", jtVerdict('"\\U0041"'), "ESCAPE@2");
  t.eqStr("ESCAPE: a \\u with a non-hex digit", jtVerdict('"\\u12G4"'), "ESCAPE@3");
  t.eqStr("ESCAPE: a surrogate pair whose second half has a non-hex digit", jtVerdict('"\\uD834\\uDDZE"'), "ESCAPE@9");
  t.eqStr("ESCAPE: a bad escape in a key", jtVerdict('{"\\q":1}'), "ESCAPE@3");
};

const strings = (t: Suite): void => {
  // UTF8: RFC 3629's table, row by row.
  const d = new JsonLimits();
  t.eqStr("UTF8: a stray continuation byte", jtVerdictOf([34, 128, 34], d), "UTF8@1");
  t.eqStr("UTF8: C0, an overlong lead", jtVerdictOf([34, 192, 128, 34], d), "UTF8@1");
  t.eqStr("UTF8: C1, an overlong lead", jtVerdictOf([34, 193, 191, 34], d), "UTF8@1");
  t.eqStr("UTF8: a two-byte lead and no continuation", jtVerdictOf([34, 195, 34], d), "UTF8@1");
  t.eqStr("UTF8: E0 80, an overlong three-byte form", jtVerdictOf([34, 224, 128, 128, 34], d), "UTF8@1");
  t.eqStr("UTF8: E0 9F BF, the last overlong three-byte form", jtVerdictOf([34, 224, 159, 191, 34], d), "UTF8@1");
  t.eqStr("UTF8: ED A0, a surrogate", jtVerdictOf([34, 237, 160, 128, 34], d), "UTF8@1");
  t.eqStr("UTF8: a three-byte form whose third byte is not a continuation", jtVerdictOf([34, 226, 130, 34], d), "UTF8@1");
  t.eqStr("UTF8: F0 80, an overlong four-byte form", jtVerdictOf([34, 240, 128, 128, 128, 34], d), "UTF8@1");
  t.eqStr("UTF8: F0 8F BF BF, the last overlong four-byte form", jtVerdictOf([34, 240, 143, 191, 191, 34], d), "UTF8@1");
  t.eqStr("UTF8: a four-byte form whose fourth byte is not a continuation", jtVerdictOf([34, 240, 159, 152, 65, 34], d), "UTF8@1");
  t.eqStr("UTF8: F4 90, past U+10FFFF", jtVerdictOf([34, 244, 144, 128, 128, 34], d), "UTF8@1");
  t.eqStr("UTF8: F5, never a lead", jtVerdictOf([34, 245, 128, 128, 128, 34], d), "UTF8@1");
  t.eqStr("UTF8: FF, never a byte", jtVerdictOf([34, 255, 34], d), "UTF8@1");
  t.eqStr("TRUNCATED: a four-byte form the window cuts short", jtVerdictOf([34, 240, 159, 152], d), "TRUNCATED@1");
  t.eqStr("TRUNCATED: a two-byte form the window cuts short", jtVerdictOf([34, 195], d), "TRUNCATED@1");
  t.eqStr("UTF8: an invalid byte in a key", jtVerdictOf([123, 34, 255, 34, 58, 49, 125], d), "UTF8@2");
  // Every well-formed row, at its edges.
  t.eqStr(
    "UTF8: C2 80, DF BF, E0 A0 80, ED 9F BF, EE 80 80, EF BF BF, F0 90 80 80, F4 8F BF BF are accepted",
    jtVerdictOf(
      [34, 194, 128, 223, 191, 224, 160, 128, 237, 159, 191, 238, 128, 128, 239, 191, 191, 240, 144, 128, 128, 244, 143, 191, 191, 34],
      d
    ),
    "END"
  );
  t.eqStr("UTF8: E1 80 80 and F1 80 80 80 are accepted", jtVerdictOf([34, 225, 128, 128, 241, 128, 128, 128, 34], d), "END");
  // SURROGATE: a \u escape of a surrogate that is not a high-then-low pair.
  t.eqStr("SURROGATE: a lone high surrogate", jtVerdict('"\\uD800"'), "SURROGATE@1");
  t.eqStr("SURROGATE: a lone low surrogate", jtVerdict('"\\uDC00"'), "SURROGATE@1");
  t.eqStr("SURROGATE: a high surrogate and a plain byte", jtVerdict('"\\uD800abcdef"'), "SURROGATE@1");
  t.eqStr("SURROGATE: a high surrogate and a short escape", jtVerdict('"\\uD800\\n"'), "SURROGATE@1");
  t.eqStr("SURROGATE: two high surrogates", jtVerdict('"\\uD800\\uD800"'), "SURROGATE@1");
  t.eqStr("SURROGATE: a high surrogate and a non-surrogate", jtVerdict('"\\uD800\\u0041"'), "SURROGATE@1");
  t.eqStr("SURROGATE: a low then a high", jtVerdict('"\\uDC00\\uD800"'), "SURROGATE@1");
  t.eqStr("TRUNCATED: a high surrogate at the end of the window", jtVerdict('"\\uDBFF'), "TRUNCATED@7");
  t.eqStr("TRUNCATED: a high surrogate and a backslash at the end of the window", jtVerdict('"\\uDBFF\\'), "TRUNCATED@8");
  t.eqStr("a surrogate pair is accepted", jtVerdict('"\\uD834\\uDD1E"'), "END");
  // Each edge of both halves' ranges, from both sides.
  t.eqStr("SURROGATE: a high surrogate and U+E000, one past the low range", jtVerdict('"\\uD800\\uE000"'), "SURROGATE@1");
  t.eqStr("SURROGATE: a lone U+DFFF, the last low surrogate", jtVerdict('"\\uDFFF"'), "SURROGATE@1");
  t.eqStr("U+D7FF, one below the surrogates, is accepted alone", jtVerdict('"\\uD7FF"'), "END");
  t.eqStr("U+E000, one above the surrogates, is accepted alone", jtVerdict('"\\uE000"'), "END");
  t.eqStr(
    "\\uDBFF\\uDFFF, the last pair, decodes to U+10FFFF",
    jtHexOfString('"\\uDBFF\\uDFFF"'),
    "f48fbfbf"
  );
  t.eqStr("\\uD7FF decodes to its three bytes", jtHexOfString('"\\uD7FF"'), "ed9fbf");
  // The \u width boundaries, on both sides, and the low-surrogate floor.
  t.eqStr("\\u007F decodes to one byte", jtHexOfString('"\\u007F"'), "7f");
  t.eqStr("\\u0080 decodes to two bytes", jtHexOfString('"\\u0080"'), "c280");
  t.eqStr("\\u07FF decodes to two bytes", jtHexOfString('"\\u07FF"'), "dfbf");
  t.eqStr("\\u0800 decodes to three bytes", jtHexOfString('"\\u0800"'), "e0a080");
  t.eqStr("\\uFFFF decodes to three bytes", jtHexOfString('"\\uFFFF"'), "efbfbf");
  t.eqStr("\\uD800\\uDC00, the first pair, decodes to U+10000's four bytes", jtHexOfString('"\\uD800\\uDC00"'), "f0908080");
  t.eqStr("\\uE000 decodes to its three bytes", jtHexOfString('"\\uE000"'), "ee8080");
  t.eqStr("\\u0000 is accepted", jtVerdict('"\\u0000"'), "END");

  // stringInto, stringLength and keyEquals.
  const scratch = new Array<u8>(64);
  const s = jtAt('["a\\"\\\\\\/\\b\\f\\n\\r\\tz"]', JSON_TOK_STRING);
  if (s !== null) {
    t.eqI32("stringLength: the short escapes decode to one byte each", s.stringLength(), 10);
    t.eqI32("stringInto answers the decoded length", s.stringInto(scratch, 0), 10);
    t.eqI32(
      "stringInto: the bytes of the quote, backslash, slash and backspace escapes",
      toI32(scratch[1]) * 1000000 + toI32(scratch[2]) * 10000 + toI32(scratch[3]) * 100 + toI32(scratch[4]),
      34924708
    );
    t.eqStr(
      "stringInto: the control escapes' bytes, then the plain z",
      `${scratch[5]} ${scratch[6]} ${scratch[7]} ${scratch[8]} ${scratch[9]}`,
      "12 10 13 9 122"
    );
  } else {
    t.fail("a string token with every short escape", "no STRING token");
  }
  const u = jtAt('"\\u0041\\u00e9\\u20AC\\uD83D\\uDE00!"', JSON_TOK_STRING);
  if (u !== null) {
    t.eqI32("stringLength: \\u escapes of 1, 2, 3 and 4 bytes, and a plain byte", u.stringLength(), 11);
    t.eqI32("stringInto at an offset", u.stringInto(scratch, 3), 11);
    t.eqStr(
      "stringInto: the UTF-8 of A, é, € and 😀",
      `${scratch[3]} ${scratch[4]} ${scratch[5]} ${scratch[6]} ${scratch[7]} ${scratch[8]} ${scratch[9]} ${scratch[10]} ${scratch[11]} ${scratch[12]} ${scratch[13]}`,
      "65 195 169 226 130 172 240 159 152 128 33"
    );
    t.eqI32("stringInto: -1 when out is a byte short", u.stringInto(new Array<u8>(10), 0), -1);
    t.eqI32("stringInto: -1 when the offset leaves too few bytes", u.stringInto(scratch, 54), -1);
    t.eqI32("stringInto: -1 for a negative offset", u.stringInto(scratch, -1), -1);
    t.eqI32("stringInto: an array exactly long enough", u.stringInto(new Array<u8>(11), 0), 11);
    t.ok("keyEquals: a string token decoded with escapes", u.keyEquals("Aé€😀!"));
    t.ok("keyEquals: a byte that differs inside an escape's UTF-8", !u.keyEquals("Aè€😀!"));
    t.ok("keyEquals: a byte that differs outside an escape", !u.keyEquals("Aé€😀?"));
  } else {
    t.fail("a string token with \\u escapes", "no STRING token");
  }
  const raw = jtBytes('"caf');
  raw.push(195);
  raw.push(169);
  raw.push(34);
  const r = new JsonTokenizer(raw, 0, toI32(raw.length), new JsonLimits());
  t.eqI32("a string of raw UTF-8", r.next(), JSON_TOK_STRING);
  t.eqI32("stringLength of raw UTF-8 counts its bytes", r.stringLength(), 5);
  t.ok("keyEquals on raw UTF-8", r.keyEquals("café"));
  const e = jtAt('""', JSON_TOK_STRING);
  if (e !== null) {
    const kept: u8[] = [7, 7];
    t.eqI32("stringLength of an empty string", e.stringLength(), 0);
    t.eqI32("stringInto of an empty string writes nothing and answers 0", e.stringInto(kept, 1), 0);
    t.ok("...leaving out as it was", toI32(kept[0]) === 7 && toI32(kept[1]) === 7);
    const none: u8[] = [];
    t.eqI32("stringInto of an empty string into an empty array", e.stringInto(none, 0), 0);
    t.eqI32("stringInto of an empty string at the end of an array", e.stringInto(kept, 2), 0);
  } else {
    t.fail("an empty string token", "no STRING token");
  }

  const k = jtAt('{"message":1}', JSON_TOK_KEY);
  if (k !== null) {
    t.ok("keyEquals: the same key", k.keyEquals("message"));
    t.ok("keyEquals: a prefix is not the key", !k.keyEquals("mess"));
    t.ok("keyEquals: a longer name is not the key", !k.keyEquals("messages"));
    t.ok("keyEquals: same length, a byte differs", !k.keyEquals("massage"));
    t.eqI32("stringLength of a key", k.stringLength(), 7);
    t.eqI32("the key's value comes next", k.next(), JSON_TOK_NUMBER);
    t.ok("keyEquals: false on a number token", !k.keyEquals("1"));
    t.eqI32("stringLength: -1 on a number token", k.stringLength(), -1);
    t.eqI32("stringInto: -1 on a number token", k.stringInto(scratch, 0), -1);
  } else {
    t.fail("a key token", "no KEY token");
  }
  const ek = jtAt('{"m\\u0065ss":1}', JSON_TOK_KEY);
  if (ek !== null) {
    t.ok("keyEquals: an escaped key", ek.keyEquals("mess"));
    t.ok("keyEquals: an escaped key, a byte differs after the escape", !ek.keyEquals("mesz"));
    t.ok("keyEquals: an escaped key, the escape's byte differs", !ek.keyEquals("mass"));
  } else {
    t.fail("an escaped key token", "no KEY token");
  }
  const empty = jtAt('{"":1}', JSON_TOK_KEY);
  t.ok("keyEquals: the empty key", empty !== null && empty.keyEquals(""));
};

const numbers = (t: Suite): void => {
  const lo: i64 = -9007199254740992;
  const min: i64 = lo << 10;
  const max: i64 = -(min + 1);
  const ints = [
    "0",
    "-0",
    "123",
    "-123",
    "9223372036854775807",
    "-9223372036854775808",
    "9223372036854775808",
    "-9223372036854775809",
    "99999999999999999999",
    "1.0",
    "1e2",
  ];
  const isInt = [true, true, true, true, true, true, false, false, false, false, false];
  const values: i64[] = [0, 0, 123, -123, max, min, 0, 0, 0, 0, 0];
  let i: i32 = 0;
  while (i < toI32(ints.length) && i < toI32(isInt.length) && i < toI32(values.length)) {
    const text = ints[i];
    const want: i64 = values[i];
    const integer: boolean = isInt[i];
    const n = jtAt(text, JSON_TOK_NUMBER);
    if (n === null) {
      t.fail(`a number token for ${text}`, "none");
    } else {
      t.eqBool(`isInteger(${text})`, n.isInteger(), integer);
      t.eqI64(`numberI64(${text})`, n.numberI64(), want);
    }
    i += 1;
  }
  const str = jtAt('"1"', JSON_TOK_STRING);
  if (str !== null) {
    t.ok("isInteger is false on a string token", !str.isInteger());
    t.eqI64("numberI64 is 0 on a string token", str.numberI64(), toI64(0));
    t.eqF64("numberF64 is 0 on a string token", str.numberF64(), toF64(0));
  }

  // numberF64 is correctly rounded: the bits of what JSON.parse answers.
  const zero: i64 = 0;
  const infinity: i64 = toI64(2047) << 52;
  t.eqI64("numberF64(0)", jtF64Bits("0"), zero);
  t.eqI64("numberF64(-0) is negative zero", jtF64Bits("-0"), min);
  t.eqI64("numberF64(-0.0e5) is negative zero", jtF64Bits("-0.0e5"), min);
  t.eqF64("numberF64(1.5)", jtF64OfText("1.5"), toF64(3) / toF64(2));
  t.eqStr("numberF64(-2.25E3)", `${jtF64OfText("-2.25E3")}`, "-2250");
  t.eqStr("numberF64(1E+2)", `${jtF64OfText("1E+2")}`, "100");
  t.eqStr("numberF64(0.000001)", `${jtF64OfText("0.000001")}`, "0.000001");
  t.eqStr("numberF64(0.1), the fast path's divide", `${jtF64OfText("0.1")}`, "0.1");
  t.eqStr("numberF64(1e22), the largest exact power", `${jtF64OfText("1e22")}`, "1e+22");
  t.eqStr("numberF64(1e23), parseFloat's path", `${jtF64OfText("1e23")}`, "1e+23");
  t.eqStr("numberF64(1e-23), parseFloat's path", `${jtF64OfText("1e-23")}`, "1e-23");
  t.eqStr("numberF64 of 17 significant digits goes to parseFloat", `${jtF64OfText("1234567890123456.7")}`, "1234567890123456.8");
  // 16 digits are one too many for the fast path: 9007199254740993 rounds to
  // ...992 as a double, and ten times that is not the nearest double to the text.
  t.eqStr(
    "numberF64 of 16 significant digits goes to parseFloat",
    `${jtF64OfText("9007199254740993e1")}`,
    "90071992547409940"
  );
  t.eqStr("numberF64 of 15 significant digits after leading zeros", `${jtF64OfText("0.000123456789012345")}`, "0.000123456789012345");
  t.eqStr("numberF64(123456789012345678)", `${jtF64OfText("123456789012345678")}`, "123456789012345680");
  t.eqI64("numberF64(2.2250738585072011e-308), the largest subnormal", jtF64Bits("2.2250738585072011e-308"), (toI64(1) << 52) - 1);
  t.eqI64("numberF64(5e-324), the smallest subnormal", jtF64Bits("5e-324"), toI64(1));
  t.eqI64("numberF64(1e-400) underflows to zero", jtF64Bits("1e-400"), zero);
  t.eqI64("numberF64(1.7976931348623157e308), the largest double", jtF64Bits("1.7976931348623157e308"), infinity - 1);
  t.eqI64("numberF64(1e400) is an infinity", jtF64Bits("1e400"), infinity);
  t.eqI64("numberF64(-1e400) is minus infinity", jtF64Bits("-1e400"), min + infinity);
  t.eqI64("numberF64 of an exponent past the cap", jtF64Bits("1e9999999999"), infinity);
  t.eqI64("numberF64 of zero with an exponent past the cap", jtF64Bits("0e9999999999"), zero);
  t.eqStr("numberF64 of an exponent with leading zeros", `${jtF64OfText("1e0000000000000000002")}`, "100");
  t.eqStr("numberF64(9007199254740993) rounds to even", `${jtF64OfText("9007199254740993")}`, "9007199254740992");
};

/** `numberF64` of the first number in `text`, or 0. */
const jtF64OfText = (text: string): f64 => {
  const n = jtAt(text, JSON_TOK_NUMBER);
  return n === null ? toF64(0) : n.numberF64();
};

const limits = (t: Suite): void => {
  const d = new JsonLimits();
  t.eqI32("JsonLimits: the default depth", d.maxDepth, JSON_DEFAULT_MAX_DEPTH);
  t.eqI32("JsonLimits: the default string bytes", d.maxStringBytes, JSON_DEFAULT_MAX_STRING_BYTES);
  t.eqI32("JsonLimits: the default number bytes", d.maxNumberBytes, JSON_DEFAULT_MAX_NUMBER_BYTES);
  t.eqI32("JsonLimits: the default total bytes", d.maxTotalBytes, JSON_DEFAULT_MAX_TOTAL_BYTES);
  t.eqStr("the defaults: 128, 1 MiB, 256 and 16 MiB", `${d.maxDepth} ${d.maxStringBytes} ${d.maxNumberBytes} ${d.maxTotalBytes}`, "128 1048576 256 16777216");

  // DEPTH
  const two = jtLimits(2, 100, 100, 100);
  t.eqStr("DEPTH: two levels fit a depth of 2", jtVerdictOf(jtBytes("[[1]]"), two), "END");
  t.eqStr("DEPTH: a third level is refused at its opener", jtVerdictOf(jtBytes("[[[1]]]"), two), "DEPTH@2");
  t.eqStr("DEPTH: objects count as levels", jtVerdictOf(jtBytes('{"a":{"b":{}}}'), two), "DEPTH@10");
  t.eqStr("DEPTH: 128 levels fit the default", jtVerdictOf(jtRuns(91, 128, 93, 128, 0), new JsonLimits()), "END");
  t.eqStr("DEPTH: 129 levels do not", jtVerdictOf(jtRuns(91, 129, 93, 129, 0), new JsonLimits()), "DEPTH@128");
  t.eqStr(
    "DEPTH: a bomb of 100,000 openers is refused at the limit",
    jtVerdictOf(jtRuns(91, 100000, 93, 0, 0), new JsonLimits()),
    "DEPTH@128"
  );
  const none = jtLimits(0, 100, 100, 100);
  t.eqStr("DEPTH: a depth of 0 takes a scalar", jtVerdictOf(jtBytes("1"), none), "END");
  t.eqStr("DEPTH: a depth of 0 refuses []", jtVerdictOf(jtBytes("[]"), none), "DEPTH@0");
  const negative = jtLimits(-5, -5, -5, -5);
  t.eqStr("a negative limit reads as 0: the total refuses one byte", jtVerdictOf(jtBytes("1"), negative), "TOTAL_LIMIT@0");
  t.eqStr("a negative limit reads as 0: the empty window then truncates", jtVerdictOf([], negative), "TRUNCATED@0");
  t.eqStr("a negative string limit reads as 0", jtVerdictOf(jtBytes('""'), jtLimits(1, -1, 1, 10)), "END");
  t.eqStr("a negative number limit reads as 0", jtVerdictOf(jtBytes("1"), jtLimits(1, 1, -1, 10)), "NUMBER_LIMIT@0");

  // STRING_LIMIT
  const three = jtLimits(4, 3, 100, 100);
  t.eqStr("STRING_LIMIT: three bytes fit a limit of 3", jtVerdictOf(jtBytes('"abc"'), three), "END");
  t.eqStr("STRING_LIMIT: the fourth byte is refused where it stands", jtVerdictOf(jtBytes('"abcd"'), three), "STRING_LIMIT@4");
  t.eqStr("STRING_LIMIT: escapes count as written", jtVerdictOf(jtBytes('"\\n\\n"'), three), "STRING_LIMIT@4");
  t.eqStr("STRING_LIMIT: an escape that steps past the limit", jtVerdictOf(jtBytes('"ab\\u0041"'), three), "STRING_LIMIT@4");
  t.eqStr("STRING_LIMIT: a key is held to it too", jtVerdictOf(jtBytes('{"abcd":1}'), three), "STRING_LIMIT@5");
  t.eqStr(
    "STRING_LIMIT: an unclosed string at the limit is truncated, not too long",
    jtVerdictOf(jtBytes('"abc'), three),
    "TRUNCATED@4"
  );
  t.eqStr(
    "STRING_LIMIT: a multi-byte character that steps past the limit",
    jtVerdictOf([34, 97, 98, 195, 169, 34], three),
    "STRING_LIMIT@4"
  );
  t.eqStr(
    "STRING_LIMIT: a megabyte string fits the default",
    jtVerdictOf(jtRuns(34, 1, 120, 1048576, 34), new JsonLimits()),
    "END"
  );
  t.eqStr(
    "STRING_LIMIT: a byte more does not",
    jtVerdictOf(jtRuns(34, 1, 120, 1048577, 34), new JsonLimits()),
    "STRING_LIMIT@1048577"
  );

  // NUMBER_LIMIT
  const num = jtLimits(4, 100, 3, 100);
  t.eqStr("NUMBER_LIMIT: three bytes fit a limit of 3", jtVerdictOf(jtBytes("-12"), num), "END");
  t.eqStr("NUMBER_LIMIT: four do not", jtVerdictOf(jtBytes("1234"), num), "NUMBER_LIMIT@3");
  t.eqStr("NUMBER_LIMIT: an exponent counts", jtVerdictOf(jtBytes("[1e10]"), num), "NUMBER_LIMIT@4");
  t.eqStr("NUMBER_LIMIT: the scan stops past the limit, before the grammar fails", jtVerdictOf(jtBytes("1234.x"), num), "NUMBER_LIMIT@3");
  t.eqStr("NUMBER_LIMIT: a fraction that runs past the limit", jtVerdictOf(jtBytes("1.2345"), num), "NUMBER_LIMIT@3");
  t.eqStr("NUMBER_LIMIT: a number cut short at the limit is only truncated", jtVerdictOf(jtBytes("12."), num), "TRUNCATED@3");
  t.eqStr("NUMBER_LIMIT: 256 digits fit the default", jtVerdictOf(jtRuns(49, 256, 49, 0, 0), new JsonLimits()), "END");
  t.eqStr("NUMBER_LIMIT: 257 do not", jtVerdictOf(jtRuns(49, 257, 49, 0, 0), new JsonLimits()), "NUMBER_LIMIT@256");

  // TOTAL_LIMIT
  const total = jtLimits(4, 100, 100, 3);
  t.eqStr("TOTAL_LIMIT: three bytes fit a total of 3", jtVerdictOf(jtBytes("[1]"), total), "END");
  t.eqStr("TOTAL_LIMIT: four are refused before anything is read", jtVerdictOf(jtBytes("[1] "), total), "TOTAL_LIMIT@3");
  t.eqStr("TOTAL_LIMIT: even a malformed window is refused for its size", jtVerdictOf(jtBytes("xxxx"), total), "TOTAL_LIMIT@3");

  // Changing the limits object afterwards changes nothing for a tokenizer made from it.
  const later = jtLimits(1, 100, 100, 100);
  const body = jtBytes("[[]]");
  const tok = new JsonTokenizer(body, 0, toI32(body.length), later);
  later.maxDepth = 10;
  tok.next();
  t.eqStr("the tokenizer copied the limits", jtCodeName(tok.next()), "DEPTH");
};


const windows = (t: Suite): void => {
  const bytes = jtBytes('xx[1,"a"]yy');
  t.eqStr("a window in the middle of an array", jtTokensOf(jtWindow(bytes, 2, 7), new JsonLimits(), false), "[ n:1 s:a ] END");
  const w = new JsonTokenizer(bytes, 2, 7, new JsonLimits());
  t.eqI32("a window's first token", w.next(), JSON_TOK_ARRAY_BEGIN);
  t.eqI32("...is at its offset", w.tokStart, 2);
  w.next();
  w.next();
  t.ok("keyEquals inside a window", w.keyEquals("a"));
  w.next();
  t.eqI32("the window ends after its last byte", w.next(), JSON_TOK_END);
  t.eqStr("a window that stops after a comma", jtVerdictWindow(bytes, 2, 3), "TRUNCATED@5");
  t.eqStr("a window that stops inside a value", jtVerdictWindow(bytes, 2, 5), "TRUNCATED@7");
  t.eqStr("a window that stops before the closing quote", jtVerdictWindow(jtBytes('"abc"'), 0, 4), "TRUNCATED@4");
  t.eqStr("a window that stops inside a literal", jtVerdictWindow(jtBytes("true"), 0, 3), "TRUNCATED@3");
  t.eqStr("a window that stops inside an escape", jtVerdictWindow(jtBytes('"\\u0041"'), 0, 5), "TRUNCATED@3");
  t.eqStr("WINDOW: a negative offset", jtVerdictWindow(bytes, -1, 3), "WINDOW@-1");
  t.eqStr("WINDOW: a negative length", jtVerdictWindow(bytes, 0, -1), "WINDOW@0");
  t.eqStr("WINDOW: a window past the end", jtVerdictWindow(bytes, 5, 7), "WINDOW@5");
  t.eqStr("WINDOW: an offset past the end", jtVerdictWindow(bytes, 12, 0), "WINDOW@12");
  // A length near 2^31: `off + len` would overflow, and the guard must refuse it before adding.
  t.eqStr("WINDOW: an offset and a length of 2^31 - 1, refused without overflow", jtVerdictWindow(bytes, 5, 2147483647), "WINDOW@5");
  t.eqStr("WINDOW: a length of 2^31 - 1 from 0", jtVerdictWindow(bytes, 0, 2147483647), "WINDOW@0");
  t.eqStr("an empty window at the end is only truncated", jtVerdictWindow(bytes, 11, 0), "TRUNCATED@11");
};

/** The decoded bytes, in hex, of the first string in `text`; `none` with none. */
const jtHexOfString = (text: string): string => {
  const t = jtAt(text, JSON_TOK_STRING);
  if (t === null) {
    return "none";
  }
  const out = new Array<u8>(8);
  return jtHex(out, t.stringInto(out, 0));
};

/** A copy of `bytes[off, off + len)`. */
const jtWindow = (bytes: u8[], off: i32, len: i32): u8[] => {
  const out: u8[] = [];
  let i: i32 = off;
  while (i < off + len && i >= 0 && i < toI32(bytes.length)) {
    out.push(bytes[i]);
    i += 1;
  }
  return out;
};

/** The verdict over `bytes[off, off + len)`, read in place. */
const jtVerdictWindow = (bytes: u8[], off: i32, len: i32): string => {
  const t = new JsonTokenizer(bytes, off, len, new JsonLimits());
  let k: i32 = t.next();
  let steps: i32 = 0;
  while (k > 0 && steps < 100) {
    k = t.next();
    steps += 1;
  }
  return k === JSON_TOK_END ? "END" : `${jtCodeName(k)}@${t.errorAt}`;
};


const stickyAndReset = (t: Suite): void => {
  const bad = jtBytes("[1,]");
  const tok = new JsonTokenizer(bad, 0, toI32(bad.length), new JsonLimits());
  t.eqI32("an error is answered by next()", jtRunTo(tok), JSON_TOK_ERR_SYNTAX);
  t.eqI32("...and recorded in failed", tok.failed, JSON_TOK_ERR_SYNTAX);
  t.eqI32("...at errorAt", tok.errorAt, 3);
  t.eqI32("next() answers it again", tok.next(), JSON_TOK_ERR_SYNTAX);
  t.eqI32("skipValue() answers it too", tok.skipValue(), JSON_TOK_ERR_SYNTAX);
  t.eqI32("errorAt does not move", tok.errorAt, 3);
  const after = jtBytes('["ab","\\u20ac\\x"]');
  const at = new JsonTokenizer(after, 0, toI32(after.length), new JsonLimits());
  at.next();
  at.next();
  t.eqI32("an error in the string after a string token", at.next(), -5);
  t.ok("...leaves the token before it readable", at.stringLength() === 2 && at.keyEquals("ab"));
  const good = jtBytes('{"a":true}');
  tok.reset(good, 0, toI32(good.length));
  t.eqI32("reset clears the error", tok.failed, 0);
  t.eqI32("reset clears errorAt", tok.errorAt, -1);
  t.eqI32("reset starts at depth 0", tok.depth, 0);
  t.eqI32("and the new window reads from its start", tok.next(), JSON_TOK_OBJECT_BEGIN);
  tok.reset(good, 5, 4);
  t.eqI32("reset to a window of the same array", tok.next(), JSON_TOK_TRUE);
  t.eqI32("...which is a whole document", tok.next(), JSON_TOK_END);
  tok.reset(good, 9, 5);
  t.eqI32("reset to a window outside the array", tok.next(), -13);
};

/** `next()` until it stops, answering what it stopped on. */
const jtRunTo = (tok: JsonTokenizer): i32 => {
  let k: i32 = tok.next();
  let steps: i32 = 0;
  while (k > 0 && steps < 1000) {
    k = tok.next();
    steps += 1;
  }
  return k;
};

const skipping = (t: Suite): void => {
  const bytes = jtBytes('{"skip":{"x":[1,{"y":"]"}],"z":null},"keep":[2],"last":3}');
  const tok = new JsonTokenizer(bytes, 0, toI32(bytes.length), new JsonLimits());
  tok.next();
  t.eqI32("skipValue: the key", tok.next(), JSON_TOK_KEY);
  t.eqI32("skipValue after a key steps over its object value, to its closer", tok.skipValue(), JSON_TOK_OBJECT_END);
  t.eqI32("...back at the key's depth", tok.depth, 1);
  t.eqI32("...and the next key follows", tok.next(), JSON_TOK_KEY);
  t.ok("...which is keep", tok.keyEquals("keep"));
  t.eqI32("the array opener", tok.next(), JSON_TOK_ARRAY_BEGIN);
  t.eqI32("skipValue on an opener steps to its closer", tok.skipValue(), JSON_TOK_ARRAY_END);
  t.eqI32("the last key", tok.next(), JSON_TOK_KEY);
  t.eqI32("skipValue after a key with a scalar value answers the scalar", tok.skipValue(), JSON_TOK_NUMBER);
  t.eqI32("skipValue on a scalar does nothing", tok.skipValue(), JSON_TOK_NUMBER);
  t.eqI32("the outer closer", tok.next(), JSON_TOK_OBJECT_END);
  t.eqI32("skipValue on a closer does nothing", tok.skipValue(), JSON_TOK_OBJECT_END);
  t.eqI32("END", tok.next(), JSON_TOK_END);
  t.eqI32("skipValue at END answers END", tok.skipValue(), JSON_TOK_END);

  const broken = jtBytes('{"a":[1,2,}');
  const b = new JsonTokenizer(broken, 0, toI32(broken.length), new JsonLimits());
  b.next();
  b.next();
  t.eqI32("skipValue answers an error inside the skipped value", b.skipValue(), JSON_TOK_ERR_SYNTAX);
  const cut = jtBytes('{"a":');
  const c = new JsonTokenizer(cut, 0, toI32(cut.length), new JsonLimits());
  c.next();
  c.next();
  t.eqI32("skipValue after a key whose value is missing", c.skipValue(), -2);
};

const duplicates = (t: Suite): void => {
  t.eqStr("duplicate keys are two keys: the reader decides", jtTokens('{"a":1,"a":2}'), "{ k:a n:1 k:a n:2 } END");
};

const cookbook = (t: Suite): void => {
  const out = new Array<u8>(32);
  const tok = new JsonTokenizer([], 0, 0, new JsonLimits());
  t.eqI32(
    "cookbook: messageInto finds the top-level message past a nested one",
    messageInto(tok, jtBytes('{"m":{"message":"no"},"message":"Hello, World!"}'), out),
    13
  );
  t.eqI32("cookbook: ...and copies it out", toI32(out[7]), 87);
  t.eqI32("cookbook: a message that is not a string is skipped", messageInto(tok, jtBytes('{"message":[1]}'), out), -1);
  t.eqI32("cookbook: a malformed body is -1", messageInto(tok, jtBytes('{"message":"x"'), out), -1);
  t.eqI32("cookbook: ...and failed says how", tok.failed, -2);
};

/**
 * Every token of `bytes[off, off + len)`, read in place under `limits`, as
 * words: a key's or a string's decoded bytes in hex, anything else as
 * `jtWord` spells it; then the verdict.
 */
const jtTokensIn = (bytes: u8[], off: i32, len: i32, limits: JsonLimits): string => {
  const t = new JsonTokenizer(bytes, off, len, limits);
  const scratch = new Array<u8>(toI32(bytes.length));
  const words: string[] = [];
  let steps: i32 = 0;
  let k: i32 = t.next();
  while (k > 0 && steps <= len + 2) {
    words.push(jtWord(t, k, scratch, k === JSON_TOK_KEY || k === JSON_TOK_STRING));
    steps += 1;
    k = t.next();
  }
  words.push(k === JSON_TOK_END ? "END" : `${jtCodeName(k)}@${t.errorAt}`);
  return words.join(" ");
};

/** `jtTokensIn` over the bytes of `text`, from 0, under the default limits. */
const jtScan = (text: string, len: i32): string => jtTokensIn(jtBytes(text), 0, len, new JsonLimits());

/**
 * The runs the scanners step over in one loop: a string's plain bytes, the
 * blanks between tokens, and a number's digits. A run is bounded by the
 * window and, in a string, by the length limit, so each check ends one on
 * such an edge with a byte past it that would change the answer if it were
 * read: a closing quote, a closer, another digit.
 */
const scans = (t: Suite): void => {
  // Strings.
  t.eqStr("scan: a run of plain bytes the window cuts short is truncated, not closed by the quote past it", jtScan('"abcdefgh"', 5), "TRUNCATED@5");
  t.eqStr("scan: a string closed on the window's last byte", jtScan('"abcdefgh"]', 10), "s:6162636465666768 END");
  t.eqStr("scan: a run stops at the string limit", jtTokensIn(jtBytes('"abcdefgh"'), 0, 10, jtLimits(1, 4, 1, 100)), "STRING_LIMIT@5");
  t.eqStr("scan: a run that ends one byte under the string limit", jtTokensIn(jtBytes('"abcdefgh"'), 0, 10, jtLimits(1, 7, 1, 100)), "STRING_LIMIT@8");
  t.eqStr("scan: a run exactly as long as the string limit", jtTokensIn(jtBytes('"abcdefgh"'), 0, 10, jtLimits(1, 8, 1, 100)), "s:6162636465666768 END");
  const long = jtRuns(34, 1, 97, 1000, 34);
  t.eqStr("scan: a run of 1,000 plain bytes fits a limit of 1,000", jtVerdictOf(long, jtLimits(1, 1000, 1, 2000)), "END");
  t.eqStr("scan: ...and is refused at its last byte by a limit of 999", jtVerdictOf(long, jtLimits(1, 999, 1, 2000)), "STRING_LIMIT@1000");
  t.eqStr("scan: space and DEL, the plain bytes' edges, are plain", jtTokensIn([34, 32, 127, 34], 0, 4, new JsonLimits()), "s:207f END");
  t.eqStr("scan: 0x1F after a run is CONTROL where it stands", jtVerdictOf([34, 97, 98, 31, 34], new JsonLimits()), "CONTROL@3");
  t.eqStr("scan: 0x80 after a run is UTF8 where it stands", jtVerdictOf([34, 97, 98, 128, 34], new JsonLimits()), "UTF8@3");
  t.eqStr(
    "scan: raw two-, three- and four-byte UTF-8 between runs",
    jtScan('"ab é cd € ef 😀 gh"', 25),
    "s:616220c3a920636420e282ac20656620f09f9880206768 END"
  );
  t.eqStr(
    "scan: escapes of two-, three- and four-byte characters between runs",
    jtScan('"ab\\u00e9cd\\u20acef\\ud83d\\ude00gh"', 34),
    "s:6162c3a96364e282ac6566f09f98806768 END"
  );
  const escaped = jtAt('["ab\\u00e9cd\\u20acef\\ud83d\\ude00gh"]', JSON_TOK_STRING);
  if (escaped !== null) {
    t.eqI32("scan: stringLength of those escapes between runs", escaped.stringLength(), 17);
    t.ok("scan: keyEquals of those escapes' UTF-8", escaped.keyEquals("abécd€ef😀gh"));
  }
  t.eqStr("scan: a two-byte character closed on the window's last byte", jtScan('"abé"x', 6), "s:6162c3a9 END");
  t.eqStr("scan: a two-byte character and no closing quote in the window", jtScan('"abé"', 5), "TRUNCATED@5");
  t.eqStr("scan: a two-byte character the window cuts after its lead", jtScan('"abé"', 4), "TRUNCATED@3");
  t.eqStr("scan: a three-byte character the window cuts after its second byte", jtScan('"a€"', 4), "TRUNCATED@2");
  t.eqStr("scan: a four-byte character closed on the window's last byte", jtScan('"a😀"]', 7), "s:61f09f9880 END");
  t.eqStr("scan: a four-byte character the window cuts after its third byte", jtScan('"a😀"', 5), "TRUNCATED@2");

  // Blanks.
  t.eqStr("scan: blanks the window cuts short are truncated, not closed by the closer past them", jtScan("[1   ]", 5), "[ n:1 TRUNCATED@5");
  t.eqStr("scan: blanks that run on past the window are truncated at its end", jtScan("[1      ]", 4), "[ n:1 TRUNCATED@4");
  t.eqStr("scan: blanks up to the window's last byte end a top-level value", jtScan("1   2", 4), "n:1 END");
  t.eqStr("scan: ...and the value past them is trailing in a wider window", jtScan("1   2", 5), "n:1 TRAILING@4");
  t.eqStr("scan: a run of all four blanks", jtScan(" \t\n\r[ \t\n\r] \t\n\r", 14), "[ ] END");

  // Digits.
  t.eqStr("scan: an integer that ends on the window's last byte", jtScan("12345678", 4), "n:1234 END");
  t.eqStr("scan: a fraction that ends on the window's last byte", jtScan("1.25999", 4), "n:1.25 END");
  t.eqStr("scan: an exponent that ends on the window's last byte", jtScan("1e225", 4), "n:1e+22 END");
  t.eqStr("scan: parseFloat reads the token alone, not the digit past the window", jtScan("1e230", 4), "n:1e+23 END");
  // A blank after the exponent is the byte that, read as a digit, would make it -6.
  t.eqStr("scan: an exponent's digits stop at the token's end", jtScan("1e1 ", 4), "n:10 END");
  t.eqStr("scan: parseFloat of 16 significant digits that end on the window's last byte", jtScan("0.30000000000000004", 18), "n:0.3 END");
  t.eqStr("scan: ...and of 17, one byte wider", jtScan("0.30000000000000004", 19), "n:0.30000000000000004 END");
  t.eqStr("scan: the number limit inside an integer's run", jtTokensIn(jtBytes("123456"), 0, 6, jtLimits(1, 1, 4, 100)), "NUMBER_LIMIT@4");
  t.eqStr("scan: the number limit inside a fraction's run", jtTokensIn(jtBytes("1.2345"), 0, 6, jtLimits(1, 1, 4, 100)), "NUMBER_LIMIT@4");
  t.eqStr("scan: a number exactly as long as the number limit", jtTokensIn(jtBytes("1.2345"), 0, 6, jtLimits(1, 1, 6, 100)), "n:1.2345 END");
  const cut = new JsonTokenizer(jtBytes("12345678"), 0, 4, new JsonLimits());
  if (cut.next() === JSON_TOK_NUMBER) {
    t.eqI64("scan: numberI64 of an integer the window cuts", cut.numberI64(), toI64(1234));
    t.eqStr("scan: numberU64 of an integer the window cuts", `${cut.numberU64()}`, "1234");
  } else {
    t.fail("scan: a number token from a cut window", "none");
  }
};

/** `numberU64`: every edge of the u64 range, and every number that is not one. */
const unsigned = (t: Suite): void => {
  const texts = [
    "0",
    "1",
    "9999999999999999999",
    "10000000000000000000",
    "9223372036854775807",
    "10000000000000000001",
    "18446744073709551614",
    "18446744073709551615",
    "18446744073709551616",
    "18446744073709551625",
    "19999999999999999999",
    "28446744073709551615",
    "99999999999999999999",
    "100000000000000000000",
    "-0",
    "-1",
    "1.0",
    "1e2",
  ];
  const fits = [
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ];
  let i: i32 = 0;
  while (i < toI32(texts.length) && i < toI32(fits.length)) {
    const text = texts[i];
    const fit: boolean = fits[i];
    const want = fit ? text : "0";
    const n = jtAt(text, JSON_TOK_NUMBER);
    if (n === null) {
      t.fail(`a number token for ${text}`, "none");
    } else {
      t.eqBool(`isU64(${text})`, n.isU64(), fit);
      t.eqStr(`numberU64(${text})`, `${n.numberU64()}`, want);
    }
    i += 1;
  }
  const str = jtAt('"1"', JSON_TOK_STRING);
  if (str !== null) {
    t.ok("isU64 is false on a string token", !str.isU64());
    t.eqStr("numberU64 is 0 on a string token", `${str.numberU64()}`, "0");
  }
};

/** `"`, then `n` plain `a`s, then `tail`: a string whose run is long before what ends it. */
const jtLongRun = (n: i32, tail: u8[]): u8[] => {
  const out: u8[] = [34];
  let i: i32 = 0;
  while (i < n) {
    out.push(97);
    i += 1;
  }
  let k: i32 = 0;
  while (k < toI32(tail.length)) {
    out.push(tail[k]);
    k += 1;
  }
  return out;
};

/**
 * The verdict over `bytes[0, len)`, and for a string the length it decodes
 * to and the hex of its last `last` decoded bytes: an exact check that does
 * not spell out a thousand `a`s.
 */
const jtLongVerdict = (bytes: u8[], len: i32, last: i32): string => {
  const t = new JsonTokenizer(bytes, 0, len, new JsonLimits());
  const k: i32 = t.next();
  if (k !== JSON_TOK_STRING) {
    return k < 0 ? `${jtCodeName(k)}@${t.errorAt}` : `token ${k}`;
  }
  const n: i32 = t.stringLength();
  const out = new Array<u8>(n);
  t.stringInto(out, 0);
  const tail = new Array<u8>(last);
  let i: i32 = 0;
  while (i < last && n - last + i >= 0 && n - last + i < toI32(out.length) && i < toI32(tail.length)) {
    tail[i] = out[n - last + i];
    i += 1;
  }
  const end: i32 = t.next();
  return `${end === JSON_TOK_END ? "END" : `${jtCodeName(end)}@${t.errorAt}`} ${n} ${jtHex(tail, last)}`;
};

/**
 * A run of 1,000 plain bytes, then each kind of byte that ends one: a 2-, 3-
 * and 4-byte character, the control bytes 0x00 and 0x1F, an escape, and a
 * window that cuts an escape or a character short.
 */
const longRuns = (t: Suite): void => {
  const twoByte = jtLongRun(1000, [195, 169, 34]);
  t.eqStr("long run: then a two-byte character", jtLongVerdict(twoByte, toI32(twoByte.length), 3), "END 1002 61c3a9");
  const threeByte = jtLongRun(1000, [226, 130, 172, 34]);
  t.eqStr("long run: then a three-byte character", jtLongVerdict(threeByte, toI32(threeByte.length), 4), "END 1003 61e282ac");
  const fourByte = jtLongRun(1000, [240, 159, 152, 128, 34]);
  t.eqStr("long run: then a four-byte character", jtLongVerdict(fourByte, toI32(fourByte.length), 5), "END 1004 61f09f9880");
  const nul = jtLongRun(1000, [0, 34]);
  t.eqStr("long run: then 0x00 is CONTROL where it stands", jtLongVerdict(nul, toI32(nul.length), 0), "CONTROL@1001");
  const unit = jtLongRun(1000, [31, 34]);
  t.eqStr("long run: then 0x1F is CONTROL where it stands", jtLongVerdict(unit, toI32(unit.length), 0), "CONTROL@1001");
  // \n, then b, then \u00e9.
  const escaped = jtLongRun(1000, [92, 110, 98, 92, 117, 48, 48, 101, 57, 34]);
  t.eqStr("long run: then escapes", jtLongVerdict(escaped, toI32(escaped.length), 5), "END 1004 610a62c3a9");
  t.eqStr("long run: then a \\u escape the window cuts after two hex digits", jtLongVerdict(escaped, 1008, 0), "TRUNCATED@1006");
  t.eqStr("long run: then a backslash on the window's last byte", jtLongVerdict(escaped, 1002, 0), "TRUNCATED@1002");
  t.eqStr("long run: then a two-byte character the window cuts after its lead", jtLongVerdict(twoByte, 1002, 0), "TRUNCATED@1001");
  t.eqStr("long run: then a four-byte character the window cuts after its third byte", jtLongVerdict(fourByte, 1004, 0), "TRUNCATED@1001");
  t.eqStr("long run: then a three-byte character closed past the window", jtLongVerdict(threeByte, 1004, 0), "TRUNCATED@1004");
};

/**
 * Every run is bounded by the array's length as well as the window's end, so
 * a caller that shortens `src` after `next()` read it gets a verdict, not a
 * read past the array. `pop` keeps the capacity and the bytes in it, so a run
 * that ignored the length would read on into them and answer differently.
 */
const shrunk = (t: Suite): void => {
  // A blank run: `[1,` and the blanks after it are left of `[1,      2]`.
  const blanks = jtBytes("[1,      2]");
  const b = new JsonTokenizer(blanks, 0, toI32(blanks.length), new JsonLimits());
  b.next();
  b.next();
  let cut: i32 = 0;
  while (cut < 6) {
    blanks.pop();
    cut += 1;
  }
  t.eqStr("shrunk: a blank run stops at the array's end", `${jtCodeName(b.next())}@${b.errorAt}`, "TRUNCATED@5");
  // A digit run: `[1234` is left of `[12345678]`.
  const digits = jtBytes("[12345678]");
  const d = new JsonTokenizer(digits, 0, toI32(digits.length), new JsonLimits());
  d.next();
  cut = 0;
  while (cut < 5) {
    digits.pop();
    cut += 1;
  }
  t.eqI32("shrunk: a digit run stops at the array's end", d.next(), JSON_TOK_NUMBER);
  t.eqI32("shrunk: ...and the number is the digits left", d.tokEnd, 5);
  // A string run: `["abc` is left of `["abcdefg"]`.
  const plain = jtBytes('["abcdefg"]');
  const p = new JsonTokenizer(plain, 0, toI32(plain.length), new JsonLimits());
  p.next();
  cut = 0;
  while (cut < 6) {
    plain.pop();
    cut += 1;
  }
  t.eqStr("shrunk: a string run stops at the array's end", `${jtCodeName(p.next())}@${p.errorAt}`, "TRUNCATED@5");
  // The readers of a token already scanned answer their `false` or `0`.
  const wide = jtBytes("[12345678901234567890]");
  const w = new JsonTokenizer(wide, 0, toI32(wide.length), new JsonLimits());
  w.next();
  w.next();
  cut = 0;
  while (cut < 10) {
    wide.pop();
    cut += 1;
  }
  t.ok("shrunk: isU64 is false once the token is past the array", !w.isU64());
  t.eqStr("shrunk: numberU64 is 0", `${w.numberU64()}`, "0");
  t.ok("shrunk: isInteger is false", !w.isInteger());
  t.eqI64("shrunk: numberF64 is 0, through numberSlow", f64ToBits(w.numberF64()), toI64(0));
  const text = jtBytes('["abcdefg"]');
  const s = new JsonTokenizer(text, 0, toI32(text.length), new JsonLimits());
  s.next();
  s.next();
  cut = 0;
  while (cut < 6) {
    text.pop();
    cut += 1;
  }
  const into = new Array<u8>(8);
  t.eqI32("shrunk: stringInto copies only the bytes left", s.stringInto(into, 0), 3);
};

/** Every unit check. */
export const jtUnits = (t: Suite): void => {
  tokenKinds(t);
  errors(t);
  strings(t);
  numbers(t);
  unsigned(t);
  limits(t);
  windows(t);
  scans(t);
  longRuns(t);
  shrunk(t);
  stickyAndReset(t);
  skipping(t);
  duplicates(t);
  cookbook(t);
};
