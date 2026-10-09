// `std/json` against the shape it exists for: the compiler's own `--json` line.
//
// The object below is a real one, produced by
// `node dist/index.js bad.ts --json` for a program that adds a string to an
// `i32` — which is why the message has backticks and a parenthesis in it and the
// `file` is an absolute path. The rest of the case is the awkward material a
// reader of that surface meets: escapes, a `}` inside a message, a nested value
// to step over, a field that is not there, and text that is not an object at all.
//
// `jsonFields` is held to `jsonField` on all of it: every name asked of an
// object below is asked again of `jsonFields`, all at once, in the order asked
// and reversed, and each slot must be what `jsonField` answers for its name.
import { jsonField, jsonFields } from "../../../std/json";
import { Suite } from "../../../std/testing";

/**
 * The names asked of the current object, and what holding `jsonFields` to
 * `jsonField` on them has found so far: how many slots were compared, and the
 * first that disagreed, or `""`.
 */
class JsonAsked {
  object: string = "";
  names: string[];
  slots: i32 = 0;
  disagreement: string = "";

  constructor() {
    this.names = [];
  }
}

/** Whether two answers are the same: both absent, or the same bytes. */
const sameAnswer = (a: string | null, b: string | null): boolean => {
  if (a === null || b === null) {
    return a === null && b === null;
  }
  return a === b;
};

/** `jsonFields(object, names)`, after holding it to `jsonField(object, names[k])` slot for slot. */
const agreeOn = (asked: JsonAsked, object: string, names: string[]): (string | null)[] => {
  const values = jsonFields(object, names);
  if (toI32(values.length) !== toI32(names.length) && asked.disagreement.length === 0) {
    asked.disagreement = `${values.length} slots for ${names.length} names in ${object}`;
  }
  let k: i32 = 0;
  while (k < toI32(names.length) && k < toI32(values.length)) {
    // Both read before the call, which is where the bounds proof forgets a length.
    const got = values[k];
    const name = names[k];
    asked.slots += 1;
    if (!sameAnswer(got, jsonField(object, name)) && asked.disagreement.length === 0) {
      asked.disagreement = `slot ${k}, ${name}, in ${object}`;
    }
    k += 1;
  }
  return values;
};

/** Checks the names asked of the current object, as asked and reversed, then moves on to `object`. */
const agreeAndMove = (asked: JsonAsked, object: string): void => {
  const count: i32 = toI32(asked.names.length);
  if (count > 0) {
    agreeOn(asked, asked.object, asked.names);
    const reversed: string[] = [];
    let k: i32 = count - 1;
    while (k >= 0) {
      reversed.push(asked.names[k]);
      k -= 1;
    }
    agreeOn(asked, asked.object, reversed);
  }
  asked.object = object;
  asked.names = [];
};

/** The value of `name`, or a marker, so a check reads as one line; `name` is remembered for `jsonFields`. */
const jsonCaseField = (asked: JsonAsked, object: string, name: string): string => {
  if (object !== asked.object) {
    agreeAndMove(asked, object);
  }
  asked.names.push(name);
  const value = jsonField(object, name);
  return value === null ? "<absent>" : value;
};

/** `jsonFields`' slots joined with `|`, each absent one as a marker, after holding them to `jsonField`. */
const jsonCaseFields = (asked: JsonAsked, object: string, names: string[]): string => {
  const parts: string[] = [];
  for (const value of agreeOn(asked, object, names)) {
    parts.push(value === null ? "<absent>" : value);
  }
  return parts.join("|");
};

/**
 * The bytes of `code`, `line` and `message` of `line`, summed over `rounds`
 * calls of `jsonFields`. It takes only a string and a number, so nothing it is
 * handed can hold a pointer, and that is what gives it a scope of its own: what
 * the calls allocate is taken back when it returns.
 */
const jsonFieldsRounds = (line: string, rounds: i32): i32 => {
  const names = ["code", "line", "message"];
  let sum: i32 = 0;
  let i: i32 = 0;
  while (i < rounds) {
    for (const value of jsonFields(line, names)) {
      if (value !== null) {
        sum += toI32(value.length);
      }
    }
    i += 1;
  }
  return sum;
};

/**
 * How far `Arena.used()` moves across `passes` passes of a loop over
 * `jsonFields`, read after every pass: 0 when each pass's per-pass release
 * takes back what the call built.
 */
const jsonFieldsPassSpread = (line: string, passes: i32): i64 => {
  const names = ["code", "line", "message"];
  let lo: i64 = -1;
  let hi: i64 = 0;
  let i: i32 = 0;
  while (i < passes) {
    const got = jsonFields(line, names);
    if (got[2] === null) {
      return -1;
    }
    const used = Arena.used();
    if (lo < 0 || used < lo) {
      lo = used;
    }
    if (used > hi) {
      hi = used;
    }
    i += 1;
  }
  return hi - lo;
};

/** One byte as a string, so a check can spell a name's UTF-8 byte by byte. */
const byte = (code: i32): string => String.fromCharCode(code);

export const main = (): number => {
  const t = new Suite("json");
  const asked = new JsonAsked();

  const diagnostic =
    '{"file":"/tmp/bad.ts","line":2,"column":10,"endLine":2,"endColumn":17,"severity":"error","code":"NL2231","message":"Operator `+` requires two operands of the same numeric type or two strings, got string and i32 (no implicit string conversion; use a template literal)"}';
  t.eqStr("a string field loses its quotes", jsonCaseField(asked, diagnostic, "file"), "/tmp/bad.ts");
  t.eqStr("a number field is its own bytes", jsonCaseField(asked, diagnostic, "line"), "2");
  t.eqI32("and parseInt reads it", parseInt(jsonCaseField(asked, diagnostic, "column")), 10);
  t.eqStr("the last field is reachable", jsonCaseField(asked, diagnostic, "code"), "NL2231");
  t.contains("the message comes back whole", jsonCaseField(asked, diagnostic, "message"), "use a template literal");
  t.eqStr("a field that is not there is absent", jsonCaseField(asked, diagnostic, "hint"), "<absent>");
  // `sever` is a prefix of `severity` and `everity` a suffix: a reader that
  // searched for the name rather than matching a whole key would find both.
  t.eqStr("a prefix of a field name is not that field", jsonCaseField(asked, diagnostic, "sever"), "<absent>");
  t.eqStr("nor is a suffix", jsonCaseField(asked, diagnostic, "everity"), "<absent>");

  // The seven short escapes and two `\u` forms. The expectation is written in
  // bytes rather than as a literal, because that is what the decode has to
  // produce: `é` is two bytes of UTF-8 and `✓` is three.
  const escapes = '{"quote":"a\\"b","backslash":"a\\\\b","newline":"a\\nb","tab":"a\\tb","solidus":"a\\/b"}';
  t.eqStr("an escaped quote", jsonCaseField(asked, escapes, "quote"), 'a"b');
  t.eqStr("an escaped backslash", jsonCaseField(asked, escapes, "backslash"), "a\\b");
  t.eqStr("an escaped newline", jsonCaseField(asked, escapes, "newline"), "a\nb");
  t.eqStr("an escaped tab", jsonCaseField(asked, escapes, "tab"), "a\tb");
  t.eqStr("an escaped solidus stands for itself", jsonCaseField(asked, escapes, "solidus"), "a/b");

  const unicode = '{"bell":"\\u0007","acute":"\\u00e9","tick":"\\u2713","broken":"\\uZZZZ"}';
  const bell = jsonCaseField(asked, unicode, "bell");
  if (!t.eqI32("a control escape is one byte", toI32(bell.length), 1)) {
    return t.done();
  }
  t.eqI32("and it is the byte it names", toI32(bell.charCodeAt(0)), 7);
  const acute = jsonCaseField(asked, unicode, "acute");
  if (!t.eqI32("a code point below 0x800 is two bytes", toI32(acute.length), 2)) {
    return t.done();
  }
  t.eqI32("the lead byte of the two", toI32(acute.charCodeAt(0)), 195);
  t.eqI32("the continuation byte", toI32(acute.charCodeAt(1)), 169);
  const tick = jsonCaseField(asked, unicode, "tick");
  if (!t.eqI32("a code point above it is three", toI32(tick.length), 3)) {
    return t.done();
  }
  t.eqI32("the lead byte of the three", toI32(tick.charCodeAt(0)), 226);
  t.eqStr("a `\\u` with no hex digits is copied through", jsonCaseField(asked, unicode, "broken"), "\\uZZZZ");

  // A key is matched by its decoded bytes, compared where it stands: every
  // escape a value can carry means the same in a key. A key whose decoded bytes
  // differ from `name` at any point, including one byte into a two-byte `\u`,
  // is not that field.
  const keys =
    '{"n\\nb":1,"t\\tb":2,"r\\rb":3,"b\\bb":4,"f\\fb":5,"q\\"b":6,"s\\\\b":7,"o\\/b":8,"x\\qb":9,"\\u0041":10,"\\u00e9":11,"\\u2713":12,"\\uZZ":13,"\\u12":14}';
  t.eqStr("an escaped newline in a key", jsonCaseField(asked, keys, "n\nb"), "1");
  t.eqStr("an escaped tab in a key", jsonCaseField(asked, keys, "t\tb"), "2");
  t.eqStr("an escaped carriage return in a key", jsonCaseField(asked, keys, "r\rb"), "3");
  t.eqStr("an escaped backspace in a key", jsonCaseField(asked, keys, `b${String.fromCharCode(8)}b`), "4");
  t.eqStr("an escaped form feed in a key", jsonCaseField(asked, keys, `f${String.fromCharCode(12)}b`), "5");
  t.eqStr("an escaped quote in a key", jsonCaseField(asked, keys, 'q"b'), "6");
  t.eqStr("an escaped backslash in a key", jsonCaseField(asked, keys, "s\\b"), "7");
  t.eqStr("an escaped solidus in a key", jsonCaseField(asked, keys, "o/b"), "8");
  t.eqStr("an unknown escape in a key stands for its byte", jsonCaseField(asked, keys, "xqb"), "9");
  t.eqStr("a one-byte `\\u` in a key", jsonCaseField(asked, keys, "A"), "10");
  const acuteKey = `${String.fromCharCode(195)}${String.fromCharCode(169)}`;
  t.eqStr("a two-byte `\\u` in a key", jsonCaseField(asked, keys, acuteKey), "11");
  const tickKey = `${String.fromCharCode(226)}${String.fromCharCode(156)}${String.fromCharCode(147)}`;
  t.eqStr("a three-byte `\\u` in a key", jsonCaseField(asked, keys, tickKey), "12");
  t.eqStr("a broken `\\u` in a key is copied through", jsonCaseField(asked, keys, "\\uZZ"), "13");
  t.eqStr("so is one cut short by the key's end", jsonCaseField(asked, keys, "\\u12"), "14");
  t.eqStr("an escape that decodes to another byte is not a match", jsonCaseField(asked, keys, "n\tb"), "<absent>");
  t.eqStr("nor is the escape's own spelling", jsonCaseField(asked, keys, "n\\nb"), "<absent>");
  const acuteWrong = `${String.fromCharCode(195)}${String.fromCharCode(168)}`;
  t.eqStr("a `\\u` whose second byte differs", jsonCaseField(asked, keys, acuteWrong), "<absent>");
  t.eqStr("a name that differs from a broken `\\u`", jsonCaseField(asked, keys, "\\vZZ"), "<absent>");
  t.eqStr("a name that stops inside a broken `\\u`", jsonCaseField(asked, keys, "\\"), "<absent>");
  t.eqStr("a name that stops inside a `\\u`'s bytes", jsonCaseField(asked, keys, String.fromCharCode(195)), "<absent>");
  t.eqStr("a name that stops before an escape", jsonCaseField(asked, keys, "n"), "<absent>");

  // `\u` keys at each UTF-8 width boundary, an upper-case spelling and a lone
  // surrogate, which is encoded as three bytes of its own. Each matches the
  // bytes `jsonUtf8` builds, and a name whose last byte is one off misses:
  // a threshold off by one encodes the boundary at the wrong width and fails
  // the first check of its pair.
  const widths = '{"\\u007f":1,"\\u0080":2,"\\u07ff":3,"\\u0800":4,"\\uffff":5,"\\u00E9":6,"\\ud83d":7}';
  t.eqStr("`\\u007f`, the last one-byte code point", jsonCaseField(asked, widths, byte(127)), "1");
  t.eqStr("and a byte one below it misses", jsonCaseField(asked, widths, byte(126)), "<absent>");
  t.eqStr("`\\u0080`, the first two-byte one", jsonCaseField(asked, widths, `${byte(194)}${byte(128)}`), "2");
  t.eqStr("and its last byte one off misses", jsonCaseField(asked, widths, `${byte(194)}${byte(129)}`), "<absent>");
  t.eqStr("`\\u07ff`, the last two-byte one", jsonCaseField(asked, widths, `${byte(223)}${byte(191)}`), "3");
  t.eqStr("and its last byte one off misses", jsonCaseField(asked, widths, `${byte(223)}${byte(190)}`), "<absent>");
  t.eqStr("`\\u0800`, the first three-byte one", jsonCaseField(asked, widths, `${byte(224)}${byte(160)}${byte(128)}`), "4");
  t.eqStr("and its last byte one off misses", jsonCaseField(asked, widths, `${byte(224)}${byte(160)}${byte(129)}`), "<absent>");
  t.eqStr("`\\uffff`, the last one", jsonCaseField(asked, widths, `${byte(239)}${byte(191)}${byte(191)}`), "5");
  t.eqStr("and its last byte one off misses", jsonCaseField(asked, widths, `${byte(239)}${byte(191)}${byte(190)}`), "<absent>");
  t.eqStr("an upper-case `\\u00E9`", jsonCaseField(asked, widths, `${byte(195)}${byte(169)}`), "6");
  t.eqStr("and its last byte one off misses", jsonCaseField(asked, widths, `${byte(195)}${byte(168)}`), "<absent>");
  t.eqStr("a lone surrogate `\\ud83d` is three bytes", jsonCaseField(asked, widths, `${byte(237)}${byte(160)}${byte(189)}`), "7");
  t.eqStr("and its last byte one off misses", jsonCaseField(asked, widths, `${byte(237)}${byte(160)}${byte(188)}`), "<absent>");

  // Prefixes either way round, plain and escaped: a key that is a prefix of the
  // name runs out first, and a name that is a prefix of the key does.
  const prefixes = '{"ab":1,"c\\n":2,"de\\t":3}';
  t.eqStr("a key that is a prefix of the name is not that field", jsonCaseField(asked, prefixes, "abc"), "<absent>");
  t.eqStr("nor is one that ends in an escape", jsonCaseField(asked, prefixes, "c\nd"), "<absent>");
  t.eqStr("a name that is a prefix of the key is not that field", jsonCaseField(asked, prefixes, "a"), "<absent>");
  t.eqStr("nor is one that stops before the key's escape", jsonCaseField(asked, prefixes, "de"), "<absent>");
  t.eqStr("the key itself is found", jsonCaseField(asked, prefixes, "de\t"), "3");

  // Two spellings of one key are one key, and the first answers.
  t.eqStr("an escaped and a plain spelling are the same key", jsonCaseField(asked, '{"\\u0061":1,"a":2}', "a"), "1");
  // A backslash with no letter after it stands for itself, as it does in a
  // value. A key cannot end in one — the backslash would take the closing quote
  // with it — but a NUL byte after it reads as no letter, so `\` then NUL
  // decodes to a backslash and then the NUL.
  const nul = String.fromCharCode(0);
  t.eqStr(
    "a backslash before a NUL stands for itself",
    jsonCaseField(asked, `{"k\\${nul}":1}`, `k\\${nul}`),
    "1",
  );

  // A closing brace inside a string ends nothing, and a nested value is stepped
  // over rather than searched: `inner` is not a field of this object.
  const awkward = '{"message":"a } b","nested":{"inner":1},"list":[1,{"deep":2}],"after":3}';
  t.eqStr("a brace in a string closes nothing", jsonCaseField(asked, awkward, "message"), "a } b");
  t.eqStr("a nested object comes back as its text", jsonCaseField(asked, awkward, "nested"), '{"inner":1}');
  t.eqStr("so does an array", jsonCaseField(asked, awkward, "list"), '[1,{"deep":2}]');
  t.eqStr("a field after both is still found", jsonCaseField(asked, awkward, "after"), "3");
  t.eqStr("a field of a nested object is not a field of this one", jsonCaseField(asked, awkward, "inner"), "<absent>");

  // A string inside a nested value is skipped whole, by the nested-value scan's
  // own string rule: a closer or an escaped quote in it ends nothing, a doubled
  // backslash does not escape the quote after it, and a string that never ends
  // leaves the value unended, so neither it nor any field after it answers.
  const nestedBrace = '{"a":{"m":"x } y"},"b":1}';
  t.eqStr("a brace in a nested string closes nothing", jsonCaseField(asked, nestedBrace, "a"), '{"m":"x } y"}');
  t.eqStr("and the field after it is found", jsonCaseField(asked, nestedBrace, "b"), "1");
  const nestedBracket = '{"a":["x ] y"],"b":2}';
  t.eqStr("a bracket in a nested string closes nothing", jsonCaseField(asked, nestedBracket, "a"), '["x ] y"]');
  t.eqStr("and the field after it is found", jsonCaseField(asked, nestedBracket, "b"), "2");
  const nestedQuote = '{"a":["x\\"]y"],"b":2}';
  t.eqStr("an escaped quote in a nested string ends nothing", jsonCaseField(asked, nestedQuote, "a"), '["x\\"]y"]');
  t.eqStr("and the field after it is found", jsonCaseField(asked, nestedQuote, "b"), "2");
  const nestedBackslash = '{"a":{"m":"\\\\"},"b":3}';
  t.eqStr("a doubled backslash does not escape a nested string's quote", jsonCaseField(asked, nestedBackslash, "a"), '{"m":"\\\\"}');
  t.eqStr("and the field after it is found", jsonCaseField(asked, nestedBackslash, "b"), "3");
  const nestedUnended = '{"a":{"m":"x},"b":4}';
  t.eqStr("a nested string that never ends leaves its value unended", jsonCaseField(asked, nestedUnended, "a"), "<absent>");
  t.eqStr("and nothing after it answers", jsonCaseField(asked, nestedUnended, "b"), "<absent>");

  // The other value forms, and the ambiguity the module header admits to: a
  // `null` value and the string `"null"` answer the same four bytes.
  const values = '{"yes":true,"no":false,"nothing":null,"quoted":"null","float":-1.5e3}';
  t.eqStr("a boolean is its own bytes", jsonCaseField(asked, values, "yes"), "true");
  t.eqStr("so is false", jsonCaseField(asked, values, "no"), "false");
  t.eqStr("a null value", jsonCaseField(asked, values, "nothing"), "null");
  t.eqStr("and the string that reads the same", jsonCaseField(asked, values, "quoted"), "null");
  t.eqStr("an exponent is not reformatted", jsonCaseField(asked, values, "float"), "-1.5e3");

  // Blanks between the tokens, which the compiler never writes and another
  // producer might.
  t.eqStr("blanks around a key and a value", jsonCaseField(asked, '{ "a" : 1 , "b" : "two" }', "b"), "two");
  t.eqStr("the first of two fields of one name", jsonCaseField(asked, '{"a":1,"a":2}', "a"), "1");

  // Nothing here is well-formed, and the answer to every one of them is the same
  // one a missing field gets: this is a reader, not a validator.
  t.eqStr("text that is not an object", jsonCaseField(asked, "wrote build/main.ll", "file"), "<absent>");
  t.eqStr("an empty object", jsonCaseField(asked, "{}", "file"), "<absent>");
  t.eqStr("an empty string", jsonCaseField(asked, "", "file"), "<absent>");
  t.eqStr("a key with no value", jsonCaseField(asked, '{"a":', "a"), "<absent>");
  t.eqStr("an unterminated string", jsonCaseField(asked, '{"a":"b', "a"), "<absent>");
  t.eqStr("a truncated object still answers the field before the cut", jsonCaseField(asked, '{"a":"b","c', "a"), "b");

  // `jsonFields` on its own: several names in one scan. Each check also holds
  // its slots to `jsonField`, as every check above was.
  const none: string[] = [];
  t.eqI32("no names answer no slots", toI32(jsonFields(diagnostic, none).length), 0);
  t.eqI32("even of text that is not an object", toI32(jsonFields("not json", none).length), 0);
  t.eqStr(
    "three fields of a diagnostic, in the order asked",
    jsonCaseFields(asked, diagnostic, ["code", "line", "file"]),
    "NL2231|2|/tmp/bad.ts",
  );
  t.eqStr("a name asked twice answers in both slots", jsonCaseFields(asked, diagnostic, ["code", "line", "code"]), "NL2231|2|NL2231");
  t.eqStr("names that are not there are absent", jsonCaseFields(asked, diagnostic, ["hint", "sever", "everity"]), "<absent>|<absent>|<absent>");
  t.eqStr("and present ones beside them still answer", jsonCaseFields(asked, diagnostic, ["hint", "column"]), "<absent>|10");
  t.eqStr("keys in the reverse order of the names", jsonCaseFields(asked, '{"c":3,"b":2,"a":1}', ["a", "b", "c"]), "1|2|3");
  t.eqStr("and in no order at all", jsonCaseFields(asked, '{"b":2,"c":3,"a":1}', ["c", "a", "b"]), "3|1|2");
  t.eqStr("the first of two fields of one name, in every slot that asks", jsonCaseFields(asked, '{"a":1,"b":2,"a":3}', ["a", "b", "a"]), "1|2|1");
  t.eqStr("a key spelt with an escape is the same name", jsonCaseFields(asked, '{"\\u0061":1,"a":2,"b":3}', ["b", "a"]), "3|1");
  t.eqStr("a nested field is not a field", jsonCaseFields(asked, awkward, ["inner", "after", "deep"]), "<absent>|3|<absent>");

  // Malformed objects: every slot answers what `jsonField` answers for its
  // name, which is the fields before the fault and nothing after it.
  t.eqStr("a truncated object answers the fields before the cut", jsonCaseFields(asked, '{"a":"b","c', ["c", "a"]), "<absent>|b");
  t.eqStr("a missing comma ends the object after the value it follows", jsonCaseFields(asked, '{"a":1 "b":2}', ["b", "a"]), "<absent>|1");
  t.eqStr("a value that never ends answers nothing after it", jsonCaseFields(asked, nestedUnended, ["b", "a"]), "<absent>|<absent>");
  t.eqStr("a key with no colon answers nothing from there on", jsonCaseFields(asked, '{"a":1,"b" 2,"c":3}', ["c", "b", "a"]), "<absent>|<absent>|1");
  t.eqStr("text that is not an object answers nothing", jsonCaseFields(asked, "wrote build/main.ll", ["file", "code"]), "<absent>|<absent>");
  // A colon with no value after it: the value is empty, and `jsonField` has
  // always answered the empty string for it and read on past the comma.
  t.eqStr("an empty value answers the empty string, and the scan reads on", jsonCaseFields(asked, '{"a":,"b":1}', ["b", "a"]), "1|");

  // The empty name. A key may be `""`, and the name `""` asks for exactly that
  // key: it is the one name whose compare ends before it reads a byte.
  t.eqStr("the empty name finds the empty key", jsonCaseField(asked, '{"":1,"a":2}', ""), "1");
  t.eqStr("and is absent where no key is empty", jsonCaseField(asked, '{"a":1,"b":2}', ""), "<absent>");
  t.eqStr("an empty key is not a field of any other name", jsonCaseField(asked, '{"":1}', "a"), "<absent>");
  t.eqStr("the empty name beside others, asked twice", jsonCaseFields(asked, '{"a":1,"":2}', ["", "a", ""]), "2|1|2");
  t.eqStr("and absent beside a name that answers", jsonCaseFields(asked, '{"a":1}', ["", "a"]), "<absent>|1");
  // A fault after every name has answered leaves the answers as they are.
  // These do not pin the early stop: a slot is only ever filled once, so a
  // scan that read on to the fault would answer the same. That stop is a
  // speed path no answer can observe.
  t.eqStr("a fault after every answer leaves the answers", jsonCaseFields(asked, '{"a":1,"b":2,"c', ["b", "a"]), "2|1");
  t.eqStr("and so does one after a name asked twice", jsonCaseFields(asked, '{"a":1,"b":2 junk', ["a", "a"]), "1|1");

  // The last object's names, then everything at once.
  agreeAndMove(asked, "");
  t.eqStr("jsonFields agrees with jsonField, slot for slot, on every object above", asked.disagreement, "");
  t.eqI32("and it compared every slot asked", asked.slots, 227);

  // 1,000 calls leave the arena where one call left it, because the function
  // around them takes back what they allocated when it returns.
  const before = Arena.used();
  const once = jsonFieldsRounds(diagnostic, 1);
  const afterOnce = Arena.used() - before;
  const again = Arena.used();
  const many = jsonFieldsRounds(diagnostic, 1000);
  t.eqI64("1,000 jsonFields calls leave Arena.used() where one call left it", Arena.used() - again, afterOnce);
  t.eqI32("and every call answered the same bytes", many, once * 1000);

  // And the loop keeps its own per-pass release: each value is stored into the
  // array `jsonFields` allocates and returns, so it travels with that array,
  // and the pass takes both back (LANGUAGE.md, "Memory model").
  const flat: i64 = 0;
  t.eqI64("a 1,000-pass jsonFields loop keeps Arena.used() flat on every pass", jsonFieldsPassSpread(diagnostic, 1000), flat);

  return t.done();
};
