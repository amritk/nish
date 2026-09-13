// `std/json` against the shape it exists for: the compiler's own `--json` line.
//
// The object below is a real one, produced by
// `node dist/index.js bad.ts --json` for a program that adds a string to an
// `i32` — which is why the message has backticks and a parenthesis in it and the
// `file` is an absolute path. The rest of the case is the awkward material a
// reader of that surface meets: escapes, a `}` inside a message, a nested value
// to step over, a field that is not there, and text that is not an object at all.
import { jsonField } from "../../../std/json";
import { Suite } from "../../../std/testing";

/** The value of `name`, or a marker, so a check reads as one line. */
const jsonCaseField = (object: string, name: string): string => {
  const value = jsonField(object, name);
  return value === null ? "<absent>" : value;
};

export const main = (): number => {
  const t = new Suite("json");

  const diagnostic =
    '{"file":"/tmp/bad.ts","line":2,"column":10,"endLine":2,"endColumn":17,"severity":"error","code":"NL2231","message":"Operator `+` requires two operands of the same numeric type or two strings, got string and i32 (no implicit string conversion; use a template literal)"}';
  t.eqStr("a string field loses its quotes", jsonCaseField(diagnostic, "file"), "/tmp/bad.ts");
  t.eqStr("a number field is its own bytes", jsonCaseField(diagnostic, "line"), "2");
  t.eqI32("and parseInt reads it", parseInt(jsonCaseField(diagnostic, "column")), 10);
  t.eqStr("the last field is reachable", jsonCaseField(diagnostic, "code"), "NL2231");
  t.contains("the message comes back whole", jsonCaseField(diagnostic, "message"), "use a template literal");
  t.eqStr("a field that is not there is absent", jsonCaseField(diagnostic, "hint"), "<absent>");
  // `sever` is a prefix of `severity` and `everity` a suffix: a reader that
  // searched for the name rather than matching a whole key would find both.
  t.eqStr("a prefix of a field name is not that field", jsonCaseField(diagnostic, "sever"), "<absent>");
  t.eqStr("nor is a suffix", jsonCaseField(diagnostic, "everity"), "<absent>");

  // The seven short escapes and two `\u` forms. The expectation is written in
  // bytes rather than as a literal, because that is what the decode has to
  // produce: `é` is two bytes of UTF-8 and `✓` is three.
  const escapes = '{"quote":"a\\"b","backslash":"a\\\\b","newline":"a\\nb","tab":"a\\tb","solidus":"a\\/b"}';
  t.eqStr("an escaped quote", jsonCaseField(escapes, "quote"), 'a"b');
  t.eqStr("an escaped backslash", jsonCaseField(escapes, "backslash"), "a\\b");
  t.eqStr("an escaped newline", jsonCaseField(escapes, "newline"), "a\nb");
  t.eqStr("an escaped tab", jsonCaseField(escapes, "tab"), "a\tb");
  t.eqStr("an escaped solidus stands for itself", jsonCaseField(escapes, "solidus"), "a/b");

  const unicode = '{"bell":"\\u0007","acute":"\\u00e9","tick":"\\u2713","broken":"\\uZZZZ"}';
  const bell = jsonCaseField(unicode, "bell");
  if (!t.eqI32("a control escape is one byte", toI32(bell.length), 1)) {
    return t.done();
  }
  t.eqI32("and it is the byte it names", toI32(bell.charCodeAt(0)), 7);
  const acute = jsonCaseField(unicode, "acute");
  if (!t.eqI32("a code point below 0x800 is two bytes", toI32(acute.length), 2)) {
    return t.done();
  }
  t.eqI32("the lead byte of the two", toI32(acute.charCodeAt(0)), 195);
  t.eqI32("the continuation byte", toI32(acute.charCodeAt(1)), 169);
  const tick = jsonCaseField(unicode, "tick");
  if (!t.eqI32("a code point above it is three", toI32(tick.length), 3)) {
    return t.done();
  }
  t.eqI32("the lead byte of the three", toI32(tick.charCodeAt(0)), 226);
  t.eqStr("a `\\u` with no hex digits is copied through", jsonCaseField(unicode, "broken"), "\\uZZZZ");

  // A closing brace inside a string ends nothing, and a nested value is stepped
  // over rather than searched: `inner` is not a field of this object.
  const awkward = '{"message":"a } b","nested":{"inner":1},"list":[1,{"deep":2}],"after":3}';
  t.eqStr("a brace in a string closes nothing", jsonCaseField(awkward, "message"), "a } b");
  t.eqStr("a nested object comes back as its text", jsonCaseField(awkward, "nested"), '{"inner":1}');
  t.eqStr("so does an array", jsonCaseField(awkward, "list"), '[1,{"deep":2}]');
  t.eqStr("a field after both is still found", jsonCaseField(awkward, "after"), "3");
  t.eqStr("a field of a nested object is not a field of this one", jsonCaseField(awkward, "inner"), "<absent>");

  // The other value forms, and the ambiguity the module header admits to: a
  // `null` value and the string `"null"` answer the same four bytes.
  const values = '{"yes":true,"no":false,"nothing":null,"quoted":"null","float":-1.5e3}';
  t.eqStr("a boolean is its own bytes", jsonCaseField(values, "yes"), "true");
  t.eqStr("so is false", jsonCaseField(values, "no"), "false");
  t.eqStr("a null value", jsonCaseField(values, "nothing"), "null");
  t.eqStr("and the string that reads the same", jsonCaseField(values, "quoted"), "null");
  t.eqStr("an exponent is not reformatted", jsonCaseField(values, "float"), "-1.5e3");

  // Blanks between the tokens, which the compiler never writes and another
  // producer might.
  t.eqStr("blanks around a key and a value", jsonCaseField('{ "a" : 1 , "b" : "two" }', "b"), "two");
  t.eqStr("the first of two fields of one name", jsonCaseField('{"a":1,"a":2}', "a"), "1");

  // Nothing here is well-formed, and the answer to every one of them is the same
  // one a missing field gets: this is a reader, not a validator.
  t.eqStr("text that is not an object", jsonCaseField("wrote build/main.ll", "file"), "<absent>");
  t.eqStr("an empty object", jsonCaseField("{}", "file"), "<absent>");
  t.eqStr("an empty string", jsonCaseField("", "file"), "<absent>");
  t.eqStr("a key with no value", jsonCaseField('{"a":', "a"), "<absent>");
  t.eqStr("an unterminated string", jsonCaseField('{"a":"b', "a"), "<absent>");
  t.eqStr("a truncated object still answers the field before the cut", jsonCaseField('{"a":"b","c', "a"), "b");

  return t.done();
};
