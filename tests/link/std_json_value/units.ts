// Every reader, builder and writer of `JsonDocument`, each with its exact
// answer: kinds and handles, lossless numbers at every integer edge, the
// duplicate-key policy both ways, the builders' refusals, non-ASCII text and a
// window that ends on a string's last byte.
import { JSON_WRITE_FULL, JSON_WRITE_OK, JSON_WRITE_TOO_DEEP, JsonWriter } from "nish/json";
import {
  JSON_TOK_ERR_DEPTH,
  JSON_TOK_ERR_NUMBER_LIMIT,
  JSON_TOK_ERR_STRING_LIMIT,
  JSON_TOK_ERR_SYNTAX,
  JSON_TOK_ERR_TRAILING,
  JSON_TOK_ERR_TRUNCATED,
  JSON_TOK_ERR_WINDOW,
  JsonLimits,
} from "nish/json-tokenizer";
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_BOOLEAN,
  JSON_VALUE_DEFAULT_MAX_VALUES,
  JSON_VALUE_DUPLICATE_LAST,
  JSON_VALUE_DUPLICATE_REFUSE,
  JSON_VALUE_ERR_ATTACHED,
  JSON_VALUE_ERR_DUPLICATE,
  JSON_VALUE_ERR_HANDLE,
  JSON_VALUE_ERR_NUMBER,
  JSON_VALUE_ERR_VALUES,
  JSON_VALUE_MAX_VALUES,
  JSON_VALUE_NONE,
  JSON_VALUE_NULL,
  JSON_VALUE_NUMBER,
  JSON_VALUE_OBJECT,
  JSON_VALUE_OK,
  JSON_VALUE_STRING,
  JsonDocument,
} from "nish/json-value";
import { Suite } from "nish/testing";
import { jvBytes, jvHexOf } from "./common";

/** `n` arrays, each inside the last. */
const jvNested = (n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    parts.push("[");
  }
  for (let i: i32 = 0; i < n; i += 1) {
    parts.push("]");
  }
  return parts.join("");
};

/** An object of `n` members `"k0":0` to `"k<n-1>":<n-1>`, then `"k<n-2>":"last"`: a repeat at the last pair. */
const jvRepeatAtLast = (n: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    parts.push(`"k${i}":${i}`);
  }
  parts.push(`"k${n - 1}":"last"`);
  return `{${parts.join(",")}}`;
};

/** `text` parsed and written straight back. */
const jvRound = (doc: JsonDocument, text: string): string => {
  const root = doc.parseText(text);
  return root < 0 ? `error ${root}@${doc.errorAt}` : doc.stringify(root);
};

const jvReaders = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  const root = doc.parseText(' { "name" : "nish", "ok": true, "no": false, "none": null, "tags": ["a", 2, {}], "n": -12.5e1 } ');
  if (!t.ok("readers: the document parses", root >= 0)) {
    return;
  }
  t.eqI32("readers: the root is an object", doc.kind(root), JSON_VALUE_OBJECT);
  t.eqI32("readers: it has six members", doc.length(root), 6);
  t.eqStr("readers: keyAt answers the keys in order", `${doc.keyAt(root, 0)},${doc.keyAt(root, 3)},${doc.keyAt(root, 5)}`, "name,none,n");
  t.eqStr("readers: get finds a string member", doc.string(doc.get(root, "name")), "nish");
  t.ok("readers: stringEquals compares without allocating", doc.stringEquals(doc.get(root, "name"), "nish"));
  t.ok("readers: stringEquals refuses another string", !doc.stringEquals(doc.get(root, "name"), "nisH") && !doc.stringEquals(doc.get(root, "name"), "nis"));
  t.ok("readers: boolean reads true and false", doc.boolean(doc.get(root, "ok")) && !doc.boolean(doc.get(root, "no")));
  t.eqI32("readers: kind of a boolean", doc.kind(doc.get(root, "ok")), JSON_VALUE_BOOLEAN);
  t.eqI32("readers: kind of null", doc.kind(doc.get(root, "none")), JSON_VALUE_NULL);
  const tags = doc.get(root, "tags");
  t.eqI32("readers: an array's kind and length", doc.kind(tags) * 10 + doc.length(tags), JSON_VALUE_ARRAY * 10 + 3);
  t.eqStr("readers: at reads elements in order", `${doc.string(doc.at(tags, 0))} ${doc.numberText(doc.at(tags, 1))} ${doc.length(doc.at(tags, 2))}`, "a 2 0");
  t.eqStr("readers: at on an object reads a member's value", doc.string(doc.at(root, 0)), "nish");
  t.eqStr("readers: a number keeps its text", doc.numberText(doc.get(root, "n")), "-12.5e1");
  t.ok("readers: f64 reads it", doc.f64(doc.get(root, "n")) === toF64(-125));
  t.eqStr("readers: the whole document written back", doc.stringify(root), '{"name":"nish","ok":true,"no":false,"none":null,"tags":["a",2,{}],"n":-12.5e1}');
  t.eqI32("readers: get of a missing key is -1", doc.get(root, "nope"), -1);
  t.eqI32("readers: get on an array is -1", doc.get(tags, "a"), -1);
  t.eqI32("readers: at past the end is -1", doc.at(tags, 3), -1);
  t.eqI32("readers: at before the start is -1", doc.at(tags, -1), -1);
  t.eqStr("readers: keyAt on an array is empty", doc.keyAt(tags, 0), "");
  t.eqStr("readers: keyAt past the end is empty", doc.keyAt(root, 6), "");
  t.eqI32("readers: length of a string is -1", doc.length(doc.get(root, "name")), -1);
  t.eqStr("readers: string of a number is empty", doc.string(doc.get(root, "n")), "");
  t.eqStr("readers: numberText of a string is empty", doc.numberText(doc.get(root, "name")), "");
  t.ok("readers: boolean of a string is false", !doc.boolean(doc.get(root, "name")));
  t.eqI32("readers: kind of -1 is NONE", doc.kind(-1), JSON_VALUE_NONE);
  t.eqI32("readers: kind past the last value is NONE", doc.kind(1000), JSON_VALUE_NONE);
  t.ok("readers: f64 of a string is 0", doc.f64(doc.get(root, "name")) === 0);
  t.eqStr("readers: stringify of no value is empty", doc.stringify(-1), "");
  t.eqStr("readers: an empty string", jvRound(doc, '[""]'), '[""]');
  // Thirty control bytes, six bytes each when escaped: past stringify's first buffer, so it doubles.
  const controls: string[] = [];
  for (let i: i32 = 0; i < 30; i += 1) {
    controls.push("\\u0001");
  }
  const escaped = `"${controls.join("")}"`;
  t.eqStr("readers: stringify doubles its buffer for a text longer than its first guess", jvRound(doc, escaped), escaped);
  t.eqStr("readers: a scalar root", jvRound(doc, " 42 "), "42");
  t.eqStr("readers: a string root", jvRound(doc, '"x"'), '"x"');
  t.eqStr("readers: escapes are decoded and written as JSON.stringify writes them", jvRound(doc, '["\\/\\u0041\\b\\f\\n\\r\\t\\"\\\\\\u001f\\u007f"]'), '["/A\\b\\f\\n\\r\\t\\"\\\\\\u001f\u007f"]');
  const nested = doc.parseText('{"a":{"b":[[],[{"c":"d"}]]}}');
  t.eqStr("readers: a nested path", doc.string(doc.get(doc.at(doc.at(doc.get(doc.get(nested, "a"), "b"), 1), 0), "c")), "d");
};

const jvNumbers = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  const root = doc.parseText(
    "[-0,9223372036854775807,-9223372036854775808,9223372036854775808,-9223372036854775809,18446744073709551615,18446744073709551616,1.0,1e2,0.1000000000000000055511151231257827,-1,0,123456789012345678901234567890,1E400,5e-324]"
  );
  if (!t.ok("numbers: the array parses", root >= 0 && doc.length(root) === 15)) {
    return;
  }
  t.ok("numbers: -0 is an i64 0", doc.isI64(doc.at(root, 0)) && doc.i64(doc.at(root, 0)) === toI64(0));
  t.ok("numbers: -0 is not a u64", !doc.isU64(doc.at(root, 0)));
  t.eqStr("numbers: i64 max", `${doc.isI64(doc.at(root, 1))} ${doc.i64(doc.at(root, 1))} ${doc.isU64(doc.at(root, 1))} ${doc.u64(doc.at(root, 1))}`, "true 9223372036854775807 true 9223372036854775807");
  t.eqStr("numbers: i64 min", `${doc.isI64(doc.at(root, 2))} ${doc.i64(doc.at(root, 2))} ${doc.isU64(doc.at(root, 2))} ${doc.u64(doc.at(root, 2))}`, "true -9223372036854775808 false 0");
  t.eqStr("numbers: i64 max + 1 is a u64 only", `${doc.isI64(doc.at(root, 3))} ${doc.i64(doc.at(root, 3))} ${doc.isU64(doc.at(root, 3))} ${doc.u64(doc.at(root, 3))}`, "false 0 true 9223372036854775808");
  t.eqStr("numbers: i64 min - 1 is neither", `${doc.isI64(doc.at(root, 4))} ${doc.isU64(doc.at(root, 4))} ${doc.numberText(doc.at(root, 4))}`, "false false -9223372036854775809");
  t.eqStr("numbers: u64 max", `${doc.isI64(doc.at(root, 5))} ${doc.isU64(doc.at(root, 5))} ${doc.u64(doc.at(root, 5))}`, "false true 18446744073709551615");
  t.eqStr("numbers: u64 max + 1 is neither, and keeps its text", `${doc.isI64(doc.at(root, 6))} ${doc.isU64(doc.at(root, 6))} ${doc.u64(doc.at(root, 6))} ${doc.numberText(doc.at(root, 6))} ${doc.f64(doc.at(root, 6))}`, "false false 0 18446744073709551616 18446744073709552000");
  t.eqStr("numbers: 1.0 is not an integer", `${doc.isI64(doc.at(root, 7))} ${doc.isU64(doc.at(root, 7))} ${doc.f64(doc.at(root, 7))}`, "false false 1");
  t.eqStr("numbers: 1e2 is not an integer", `${doc.isI64(doc.at(root, 8))} ${doc.f64(doc.at(root, 8))} ${doc.numberText(doc.at(root, 8))}`, "false 100 1e2");
  t.eqStr("numbers: 34 significant digits read as the nearest f64 and keep their text", `${doc.f64(doc.at(root, 9))} ${doc.numberText(doc.at(root, 9))}`, "0.1 0.1000000000000000055511151231257827");
  t.eqStr("numbers: -1 is an i64, not a u64", `${doc.i64(doc.at(root, 10))} ${doc.isU64(doc.at(root, 10))}`, "-1 false");
  t.eqStr("numbers: 0 is both", `${doc.isI64(doc.at(root, 11))} ${doc.isU64(doc.at(root, 11))} ${doc.u64(doc.at(root, 11))}`, "true true 0");
  t.eqStr("numbers: 30 digits", `${doc.isI64(doc.at(root, 12))} ${doc.isU64(doc.at(root, 12))} ${doc.f64(doc.at(root, 12))}`, "false false 1.2345678901234568e+29");
  t.ok("numbers: 1E400 reads as an infinity", doc.f64(doc.at(root, 13)) > toF64(0) && doc.f64(doc.at(root, 13)) - doc.f64(doc.at(root, 13)) !== toF64(0));
  t.ok("numbers: 5e-324 reads as the smallest subnormal", doc.f64(doc.at(root, 14)) > toF64(0) && doc.f64(doc.at(root, 14)) / toF64(2) === toF64(0));
  t.eqStr(
    "numbers: every one written back as its text, byte for byte",
    doc.stringify(root),
    "[-0,9223372036854775807,-9223372036854775808,9223372036854775808,-9223372036854775809,18446744073709551615,18446744073709551616,1.0,1e2,0.1000000000000000055511151231257827,-1,0,123456789012345678901234567890,1E400,5e-324]"
  );
  const tie = doc.parseText("[9007199254740993]");
  t.eqStr("numbers: 2^53 + 1 reads as 2^53, ties to even, and keeps its text", `${doc.f64(doc.at(tie, 0))} ${doc.numberText(doc.at(tie, 0))}`, "9007199254740992 9007199254740993");
  t.ok("numbers: i64 of a string is 0", doc.i64(doc.newString("1")) === toI64(0) && !doc.isI64(doc.newString("1")));
  t.ok("numbers: u64 of null is 0", doc.u64(doc.newNull()) === toU64(0) && !doc.isU64(doc.newNull()));
};

const jvErrors = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  const cases: string[] = ["", "[1,]", "[1] x", '{"a" 1}', "[01]", "[", '"abc', "nul"];
  const want: string[] = [
    `${JSON_TOK_ERR_TRUNCATED}@0`,
    `${JSON_TOK_ERR_SYNTAX}@3`,
    `${JSON_TOK_ERR_TRAILING}@4`,
    `${JSON_TOK_ERR_SYNTAX}@5`,
    `${JSON_TOK_ERR_SYNTAX}@2`,
    `${JSON_TOK_ERR_TRUNCATED}@1`,
    `${JSON_TOK_ERR_TRUNCATED}@4`,
    `${JSON_TOK_ERR_TRUNCATED}@3`,
  ];
  for (let i: i32 = 0; i < toI32(cases.length) && i < toI32(want.length); i += 1) {
    const r = doc.parseText(cases[i]);
    t.eqStr(`errors: '${cases[i]}' is the tokenizer's code and offset`, `${r}@${doc.errorAt} ${doc.failed === r}`, `${want[i]} true`);
  }
  t.eqI32("errors: a failed parse leaves no value", doc.kind(0), JSON_VALUE_NONE);
  const ok = doc.parseText("[1]");
  t.ok("errors: the next parse clears the error", ok >= 0 && doc.failed === 0 && doc.errorAt === -1);
  const limits = new JsonLimits();
  limits.maxDepth = 2;
  limits.maxStringBytes = 3;
  limits.maxNumberBytes = 3;
  const small = new JsonDocument(limits);
  t.eqStr("errors: the depth limit is the tokenizer's", `${small.parseText("[[[1]]]")}@${small.errorAt}`, `${JSON_TOK_ERR_DEPTH}@2`);
  t.eqStr("errors: the string limit is the tokenizer's", `${small.parseText('["abcd"]')}@${small.errorAt}`, `${JSON_TOK_ERR_STRING_LIMIT}@5`);
  t.eqStr("errors: the number limit is the tokenizer's", `${small.parseText("[1234]")}@${small.errorAt}`, `${JSON_TOK_ERR_NUMBER_LIMIT}@4`);
  t.ok("errors: within every limit it parses", small.parseText('[["abc",123]]') >= 0);
  const buf = jvBytes("[1]");
  t.eqStr("errors: a window outside its array is the tokenizer's", `${doc.parse(buf, 2, 5)}@${doc.errorAt}`, `${JSON_TOK_ERR_WINDOW}@2`);
};

const jvDuplicates = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  t.eqI32("duplicates: refused by default", doc.duplicates, JSON_VALUE_DUPLICATE_REFUSE);
  t.eqStr("duplicates: a repeated key is refused at the repeat", `${doc.parseText('{"a":1,"b":2,"a":3}')}@${doc.errorAt}`, `${JSON_VALUE_ERR_DUPLICATE}@13`);
  t.eqStr("duplicates: the first repeat in the text is the one named", `${doc.parseText('{"b":0,"a":1,"b":2,"a":3}')}@${doc.errorAt}`, `${JSON_VALUE_ERR_DUPLICATE}@13`);
  t.eqStr("duplicates: inside an array inside an object", `${doc.parseText('{"x":[{"k":1,"k":2}]}')}@${doc.errorAt}`, `${JSON_VALUE_ERR_DUPLICATE}@13`);
  t.ok("duplicates: the same key in two objects is not a repeat", doc.parseText('[{"a":1},{"a":2},{"a":{"a":3}}]') >= 0);
  t.ok("duplicates: keys that differ in their last byte are not a repeat", doc.parseText('{"ab":1,"ac":2,"a":3,"abc":4}') >= 0);
  t.ok("duplicates: an escape that decodes to the same key is a repeat", doc.parseText('{"a":1,"\\u0061":2}') === JSON_VALUE_ERR_DUPLICATE);
  doc.duplicates = JSON_VALUE_DUPLICATE_LAST;
  t.eqStr("duplicates: LAST keeps the first place and the last value", jvRound(doc, '{"a":1,"b":2,"a":3}'), '{"a":3,"b":2}');
  t.eqStr("duplicates: LAST with three of one key", jvRound(doc, '{"a":1,"a":2,"b":0,"a":3}'), '{"a":3,"b":0}');
  t.eqStr("duplicates: LAST nested", jvRound(doc, '[{"k":[1],"k":{"k":2,"k":3}}]'), '[{"k":{"k":3}}]');
  t.eqStr("duplicates: LAST, and the dropped value's slot is not written", doc.stringify(doc.get(doc.parseText('{"a":[1,2],"a":true}'), "a")), "true");
  doc.duplicates = JSON_VALUE_DUPLICATE_REFUSE;
  t.eqI32("duplicates: switching back refuses again on the next parse", doc.parseText('{"a":1,"a":2}'), JSON_VALUE_ERR_DUPLICATE);

  // Past eight members the check sorts: the same answers, at every place.
  const keys: string[] = [];
  for (let i: i32 = 0; i < 40; i += 1) {
    keys.push(`"k${(i * 17) % 40}":${i}`);
  }
  const big = `{${keys.join(",")}}`;
  t.ok("duplicates: forty distinct keys parse", doc.parseText(big) >= 0 && doc.length(doc.parseText(big)) === 40);
  t.eqStr("duplicates: a repeat of the first key at the end of forty", `${doc.parseText(`{${keys.join(",")},"k0":99}`)}@${doc.errorAt}`, `${JSON_VALUE_ERR_DUPLICATE}@${toI32(big.length)}`);
  t.eqStr("duplicates: a repeat in the middle of forty is named before a later one", `${doc.parseText(`{"k5":0,${keys.join(",")}}`)}@${doc.errorAt}`, `${JSON_VALUE_ERR_DUPLICATE}@${7 + toI32(big.indexOf('"k5"'))}`);
  doc.duplicates = JSON_VALUE_DUPLICATE_LAST;
  const merged = doc.parseText(`{"k5":-1,${keys.join(",")},"k0":99,"k5":-5}`);
  t.eqStr(
    "duplicates: LAST past eight members keeps each first place and each last value",
    `${doc.length(merged)} ${doc.keyAt(merged, 0)}=${doc.numberText(doc.at(merged, 0))} ${doc.keyAt(merged, 1)}=${doc.numberText(doc.at(merged, 1))} ${doc.numberText(doc.get(merged, "k17"))}`,
    "40 k5=-5 k0=99 1"
  );
  doc.duplicates = JSON_VALUE_DUPLICATE_REFUSE;

  // The pairwise check takes up to eight members and the sort nine or more:
  // a repeat of the last pair on each side of the boundary.
  const eight = jvRepeatAtLast(7);
  const nine = jvRepeatAtLast(8);
  t.eqStr("duplicates: eight members, the last repeating the one before, pairwise", `${doc.parseText(eight)}@${doc.errorAt}`, `${JSON_VALUE_ERR_DUPLICATE}@${toI32(eight.length) - 12}`);
  t.eqStr("duplicates: nine members, the last repeating the one before, sorted", `${doc.parseText(nine)}@${doc.errorAt}`, `${JSON_VALUE_ERR_DUPLICATE}@${toI32(nine.length) - 12}`);
  doc.duplicates = JSON_VALUE_DUPLICATE_LAST;
  t.eqStr("duplicates: LAST at eight", doc.stringify(doc.parseText(eight)), '{"k0":0,"k1":1,"k2":2,"k3":3,"k4":4,"k5":5,"k6":"last"}');
  t.eqStr("duplicates: LAST at nine", doc.stringify(doc.parseText(nine)), '{"k0":0,"k1":1,"k2":2,"k3":3,"k4":4,"k5":5,"k6":6,"k7":"last"}');
  doc.duplicates = JSON_VALUE_DUPLICATE_REFUSE;
};

const jvBuilders = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  const o = doc.newObject();
  const tags = doc.newArray();
  t.eqI32("builders: push a string", doc.push(tags, doc.newString("a")), JSON_VALUE_OK);
  doc.push(tags, doc.newNull());
  doc.push(tags, doc.newBoolean(true));
  doc.push(tags, doc.newBoolean(false));
  t.eqI32("builders: set a new key", doc.set(o, "tags", tags), JSON_VALUE_OK);
  doc.set(o, "i", doc.newI64(toI64(-2147483648) << toI64(32)));
  doc.set(o, "u", doc.newU64(toU64(0) - toU64(1)));
  doc.set(o, "f", doc.newF64(toF64(1) / toF64(10)));
  doc.set(o, "z", doc.newF64(toF64(0) * toF64(-1)));
  doc.set(o, "big", doc.newNumber("1e400"));
  doc.set(o, "x", doc.newObject());
  t.eqStr("builders: the tree written", doc.stringify(o), '{"tags":["a",null,true,false],"i":-9223372036854775808,"u":18446744073709551615,"f":0.1,"z":0,"big":1e400,"x":{}}');
  const replaced = doc.get(o, "i");
  t.eqI32("builders: set an existing key", doc.set(o, "i", doc.newString("now")), JSON_VALUE_OK);
  t.eqStr("builders: it keeps its place", doc.stringify(o), '{"tags":["a",null,true,false],"i":"now","u":18446744073709551615,"f":0.1,"z":0,"big":1e400,"x":{}}');
  t.eqI32("builders: the replaced value is free to go elsewhere", doc.push(tags, replaced), JSON_VALUE_OK);
  t.eqStr("builders: and is there", doc.stringify(tags), '["a",null,true,false,-9223372036854775808]');
  // A container grows past its first slots after another took the slots after it.
  const a = doc.newArray();
  const b = doc.newArray();
  for (let i: i32 = 0; i < 9; i += 1) {
    doc.push(a, doc.newI64(toI64(i)));
    doc.push(b, doc.newI64(toI64(10 + i)));
  }
  t.eqStr("builders: two arrays grown in turn", `${doc.stringify(a)}${doc.stringify(b)}`, "[0,1,2,3,4,5,6,7,8][10,11,12,13,14,15,16,17,18]");
  const p = doc.parseText('{"keep":[1,2]}');
  const q = doc.newArray();
  t.eqI32("builders: a parsed array grows by push", doc.push(doc.get(p, "keep"), q), JSON_VALUE_OK);
  doc.push(q, doc.newString("in"));
  t.eqI32("builders: a parsed object grows by set", doc.set(p, "more", doc.newI64(toI64(3))), JSON_VALUE_OK);
  t.eqStr("builders: a parsed tree changed", doc.stringify(p), '{"keep":[1,2,["in"]],"more":3}');

  t.eqI32("builders: push onto an object", doc.push(p, doc.newNull()), JSON_VALUE_ERR_HANDLE);
  t.eqI32("builders: set on an array", doc.set(q, "k", doc.newNull()), JSON_VALUE_ERR_HANDLE);
  t.eqI32("builders: push of no value", doc.push(q, -1), JSON_VALUE_ERR_HANDLE);
  t.eqI32("builders: set of no value", doc.set(p, "k", 9999), JSON_VALUE_ERR_HANDLE);
  t.eqI32("builders: push onto no value", doc.push(-7, doc.newNull()), JSON_VALUE_ERR_HANDLE);
  t.eqI32("builders: push of a value already in a container", doc.push(q, doc.get(p, "more")), JSON_VALUE_ERR_ATTACHED);
  t.eqI32("builders: set of a value already in a container", doc.set(p, "again", doc.get(p, "keep")), JSON_VALUE_ERR_ATTACHED);
  t.eqI32("builders: push of an array into itself", doc.push(q, q), JSON_VALUE_ERR_ATTACHED);
  t.eqI32("builders: push of the root into its own grandchild", doc.push(q, p), JSON_VALUE_ERR_ATTACHED);
  const lone = doc.newObject();
  t.eqI32("builders: set of an object on itself", doc.set(lone, "self", lone), JSON_VALUE_ERR_ATTACHED);
  t.eqStr("builders: a refused call changed nothing", `${doc.stringify(p)} ${doc.stringify(lone)}`, '{"keep":[1,2,["in"]],"more":3} {}');
  t.eqI32("builders: newNumber refuses a leading zero", doc.newNumber("01"), JSON_VALUE_ERR_NUMBER);
  t.eqI32("builders: newNumber refuses a trailing blank", doc.newNumber("1 "), JSON_VALUE_ERR_NUMBER);
  t.eqI32("builders: newNumber refuses a leading blank", doc.newNumber(" 1"), JSON_VALUE_ERR_NUMBER);
  t.eqI32("builders: newNumber refuses a lone minus", doc.newNumber("-"), JSON_VALUE_ERR_NUMBER);
  t.eqI32("builders: newNumber refuses an empty text", doc.newNumber(""), JSON_VALUE_ERR_NUMBER);
  t.eqI32("builders: newNumber refuses two numbers", doc.newNumber("[1]"), JSON_VALUE_ERR_NUMBER);
  const nan: f64 = toF64(0) / toF64(0);
  t.eqI32("builders: newF64 refuses NaN", doc.newF64(nan), JSON_VALUE_ERR_NUMBER);
  t.eqI32("builders: newF64 refuses an infinity", doc.newF64(toF64(1) / toF64(0)), JSON_VALUE_ERR_NUMBER);
  const wide = doc.newNumber("-123456789012345678901234567890.5e-7");
  t.eqStr("builders: newNumber keeps any JSON number", `${doc.kind(wide) === JSON_VALUE_NUMBER} ${doc.stringify(wide)}`, "true -123456789012345678901234567890.5e-7");
  t.eqStr("builders: newF64 spells as String(x)", `${doc.numberText(doc.newF64(toF64(1000000000) * toF64(1000000000) * toF64(1000)))} ${doc.numberText(doc.newF64(toF64(15) / toF64(100000000)))} ${doc.numberText(doc.newF64(toF64(493) / toF64(4)))}`, "1e+21 1.5e-7 123.25");
  t.eqStr("builders: a string built with every escape", doc.stringify(doc.newString('a"\\\n\u0001/\u007f')), '"a\\"\\\\\\n\\u0001/\u007f"');
};

const jvUnicode = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  // é (2 bytes), 日本 (3 each), 😀 (4), and the same through escapes.
  const root = doc.parseText('{"é":["é","\\u00e9","日本","\\u65e5\\u672c","😀","\\ud83d\\ude00","€\\u20ac"]}');
  if (!t.ok("unicode: the document parses", root >= 0)) {
    return;
  }
  const a = doc.get(root, "é");
  t.ok("unicode: get with a two-byte key", a >= 0 && doc.length(a) === 7);
  t.eqStr("unicode: keyAt is the key's UTF-8", jvHexOf(doc.keyAt(root, 0)), "c3a9");
  t.eqStr("unicode: a two-byte string and its escape decode alike", `${jvHexOf(doc.string(doc.at(a, 0)))} ${jvHexOf(doc.string(doc.at(a, 1)))}`, "c3a9 c3a9");
  t.eqStr("unicode: three-byte strings and their escapes decode alike", `${jvHexOf(doc.string(doc.at(a, 2)))} ${jvHexOf(doc.string(doc.at(a, 3)))}`, "e697a5e69cac e697a5e69cac");
  t.eqStr("unicode: a four-byte string and its surrogate pair decode alike", `${jvHexOf(doc.string(doc.at(a, 4)))} ${jvHexOf(doc.string(doc.at(a, 5)))}`, "f09f9880 f09f9880");
  t.ok("unicode: stringEquals against the UTF-8", doc.stringEquals(doc.at(a, 6), "€€"));
  t.eqStr(
    "unicode: written back as UTF-8, escapes and all",
    jvHexOf(doc.stringify(root)),
    jvHexOf('{"é":["é","é","日本","日本","😀","😀","€€"]}')
  );
  // A window whose last byte is a string's closing quote, inside a longer array.
  const buf = jvBytes('xx["日本"]yy');
  const r = doc.parse(buf, 2, toI32(buf.length) - 4);
  t.eqStr("unicode: a window ending on the closing bracket after a 3-byte string", `${r >= 0} ${jvHexOf(doc.stringify(r))}`, `true ${jvHexOf('["日本"]')}`);
  const tail = jvBytes('xx"😀"');
  const s = doc.parse(tail, 2, toI32(tail.length) - 2);
  t.eqStr("unicode: a top-level string ending on the window's last byte", `${doc.kind(s) === JSON_VALUE_STRING} ${jvHexOf(doc.string(s))}`, "true f09f9880");
  const cut = jvBytes('"日本"');
  t.eqStr("unicode: a window that cuts a 3-byte sequence is the tokenizer's", `${doc.parse(cut, 0, 3)}@${doc.errorAt}`, `${JSON_TOK_ERR_TRUNCATED}@1`);
  t.eqStr("unicode: a built string's bytes go out as they came in", jvHexOf(doc.stringify(doc.newString("ü😀"))), jvHexOf('"ü😀"'));
};

const jvWriting = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  const root = doc.parseText('{"a":[1,"two",null]}');
  const out = new Array<u8>(64);
  const w = new JsonWriter(out, 0);
  doc.write(root, w);
  t.eqStr("write: into a caller's writer", `${w.complete()} ${w.text()}`, 'true {"a":[1,"two",null]}');
  w.reset(out, 0);
  w.beginArray();
  doc.write(doc.get(root, "a"), w);
  doc.write(doc.at(doc.get(root, "a"), 1), w);
  w.endArray();
  t.eqStr("write: values as elements of a caller's array", w.text(), '[[1,"two",null],"two"]');
  w.reset(out, 0);
  doc.write(-1, w);
  t.ok("write: no value writes nothing and fails nothing", w.failed === JSON_WRITE_OK && w.written() === 0);
  const tiny = new JsonWriter(new Array<u8>(5), 0);
  doc.write(root, tiny);
  t.eqI32("write: a full buffer is JSON_WRITE_FULL exactly", tiny.failed, JSON_WRITE_FULL);
  // The document's depth is the writer's: 64 parses and writes back, 65 and 128 are the tokenizer's DEPTH.
  const deep = new JsonDocument(new JsonLimits());
  const d64 = deep.parseText(jvNested(64));
  t.ok("depth: 64 nested arrays parse and write back whole", d64 >= 0 && deep.stringify(d64) === jvNested(64));
  t.eqStr("depth: 65 is the tokenizer's DEPTH at the 65th bracket", `${deep.parseText(jvNested(65))}@${deep.errorAt}`, `${JSON_TOK_ERR_DEPTH}@64`);
  t.eqStr("depth: 128, the tokenizer's own default, is refused at the same bracket", `${deep.parseText(jvNested(128))}@${deep.errorAt}`, `${JSON_TOK_ERR_DEPTH}@64`);
  const shallow = new JsonLimits();
  shallow.maxDepth = 3;
  t.eqStr("depth: a lower limit is kept", `${new JsonDocument(shallow).parseText(jvNested(4))}`, `${JSON_TOK_ERR_DEPTH}`);
  // A built tree has no parse to stop it: past 64 the write is the writer's TOO_DEEP.
  const built = new JsonDocument(new JsonLimits());
  let inner = built.newArray();
  for (let i: i32 = 1; i < 65; i += 1) {
    const outer = built.newArray();
    built.push(outer, inner);
    inner = outer;
  }
  const big = new JsonWriter(new Array<u8>(512), 0);
  built.write(inner, big);
  t.eqI32("depth: a built tree 65 deep writes JSON_WRITE_TOO_DEEP", big.failed, JSON_WRITE_TOO_DEEP);
  t.eqStr("depth: and stringify answers empty for it", built.stringify(inner), "");
};

const jvPretty = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  const root = doc.parseText('{"a":[1,{},[],"x",{"k":null}],"é":{"n":1.50e2},"e":""}');
  const out = new Array<u8>(512);
  const w = new JsonWriter(out, 0);
  w.setIndent(2);
  w.reset(out, 0);
  doc.write(root, w);
  t.eqStr(
    "pretty: two spaces, as JSON.stringify(v, null, 2) lays it out, numbers as written",
    `${w.complete()} ${jvHexOf(w.text())}`,
    `true ${jvHexOf('{\n  "a": [\n    1,\n    {},\n    [],\n    "x",\n    {\n      "k": null\n    }\n  ],\n  "é": {\n    "n": 1.50e2\n  },\n  "e": ""\n}')}`
  );
  w.setIndentTab();
  w.reset(out, 0);
  doc.write(doc.get(root, "é"), w);
  t.eqStr("pretty: a tab", w.text(), '{\n\t"n": 1.50e2\n}');
  w.setIndent(0);
  w.reset(out, 0);
  doc.write(root, w);
  t.eqStr("pretty: an indent of 0 is minified again", jvHexOf(w.text()), jvHexOf('{"a":[1,{},[],"x",{"k":null}],"é":{"n":1.50e2},"e":""}'));
  w.setIndent(4);
  w.reset(new Array<u8>(9), 0);
  doc.write(root, w);
  t.eqI32("pretty: a full buffer is JSON_WRITE_FULL", w.failed, JSON_WRITE_FULL);
};

const jvClear = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  const r = doc.parseText("[1,2,3]");
  const last = doc.at(r, 2);
  doc.clear();
  t.ok("clear: every handle names nothing", doc.kind(r) === JSON_VALUE_NONE && doc.kind(last) === JSON_VALUE_NONE);
  const fresh = doc.newArray();
  t.ok("clear: building starts again", doc.kind(fresh) === JSON_VALUE_ARRAY && doc.stringify(fresh) === "[]");
  t.ok("clear: the new handle is not the old one", fresh !== r && doc.kind(r) === JSON_VALUE_NONE);
};

const jvStale = (t: Suite): void => {
  // A handle kept across a refill of the same shape must not read the new document.
  const doc = new JsonDocument(new JsonLimits());
  const a = doc.parseText('{"user":"alice","admin":false}');
  const name = doc.get(a, "user");
  const admin = doc.get(a, "admin");
  const b = doc.parseText('{"user":"mallory","admin":true}');
  t.eqI32("stale: the old root names nothing after a same-size refill", doc.kind(a), JSON_VALUE_NONE);
  t.eqStr("stale: an old member reads nothing, not the new one", `${doc.string(name)}|${doc.boolean(admin)}|${doc.kind(name)}`, "|false|0");
  t.ok("stale: every reader refuses it", doc.length(a) === -1 && doc.get(a, "user") === -1 && doc.at(a, 0) === -1 && doc.keyAt(a, 0) === "" && !doc.stringEquals(name, "mallory") && doc.stringify(a) === "");
  t.eqStr("stale: the new handles read the new document", `${doc.string(doc.get(b, "user"))} ${doc.boolean(doc.get(b, "admin"))}`, "mallory true");
  t.eqI32("stale: push of a stale value", doc.push(doc.newArray(), name), JSON_VALUE_ERR_HANDLE);
  t.eqI32("stale: set on a stale object", doc.set(a, "k", doc.newNull()), JSON_VALUE_ERR_HANDLE);
  doc.parseText("[1,2]");
  const larger = doc.parseText("[[1,2,3,4,5,6],[7,8,9]]");
  t.ok("stale: and after a larger refill", doc.kind(b) === JSON_VALUE_NONE && doc.kind(name) === JSON_VALUE_NONE && doc.length(larger) === 2);
  // Each step on its own: a clear is one bump of the generation, a parse one, a failed parse two.
  const g0: i32 = doc.generation;
  doc.clear();
  const g1: i32 = doc.generation;
  doc.parseText("[1]");
  const g2: i32 = doc.generation;
  doc.parseText("[");
  const g3: i32 = doc.generation;
  t.eqStr("stale: a clear bumps the generation by one, a parse by one, a failed parse by two", `${g1 - g0} ${g2 - g1} ${g3 - g2}`, "1 1 2");
  // The generation wraps after 511 parses and clears: the documented limit of the check.
  const kept = doc.parseText("[7]");
  for (let i: i32 = 0; i < 510; i += 1) {
    doc.clear();
  }
  t.eqI32("stale: 510 clears later the handle still names nothing", doc.kind(kept), JSON_VALUE_NONE);
  // The parse clears once more: the 511th move of the generation.
  doc.parseText("[8]");
  t.eqI32("stale: 511 generations later it names the new root, as documented", doc.kind(kept), JSON_VALUE_ARRAY);
};

const jvValues = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  t.eqI32("values: the default cap", doc.maxValues, JSON_VALUE_DEFAULT_MAX_VALUES);
  doc.maxValues = 3;
  t.ok("values: three values fit a cap of three", doc.length(doc.parseText("[1,2]")) === 2);
  t.eqStr("values: a fourth is JSON_VALUE_ERR_VALUES at its first byte", `${doc.parseText("[1,2,3]")}@${doc.errorAt}`, `${JSON_VALUE_ERR_VALUES}@5`);
  t.eqStr("values: a container past the cap too", `${doc.parseText("[1,2,[]]")}@${doc.errorAt}`, `${JSON_VALUE_ERR_VALUES}@5`);
  const refused = doc.parseText("[1,2,3]");
  t.ok("values: and nothing is kept: no values, slots or bytes", refused === JSON_VALUE_ERR_VALUES && doc.top === 0 && doc.slotTop === 0 && doc.byteTop === 0);
  doc.clear();
  doc.newNull();
  doc.newNull();
  doc.newNull();
  t.eqStr("values: a builder past the cap", `${doc.newNull()} ${doc.newString("x")} ${doc.newArray()} ${doc.newNumber("1")}`, `${JSON_VALUE_ERR_VALUES} ${JSON_VALUE_ERR_VALUES} ${JSON_VALUE_ERR_VALUES} ${JSON_VALUE_ERR_VALUES}`);
  doc.maxValues = 2147483647;
  doc.clear();
  t.ok("values: a cap past JSON_VALUE_MAX_VALUES still parses a small body", doc.length(doc.parseText("[1,2,3]")) === 3);
  // The clamp to JSON_VALUE_MAX_VALUES, without building four million values:
  // the count of values in use is set just under it by hand, the way only a
  // test should, and the next value is refused even though maxValues allows it.
  // Without the clamp it would be index 2^22, whose handle would spill into the
  // generation's bits.
  doc.clear();
  doc.top = JSON_VALUE_MAX_VALUES - 1;
  const lastIndex = doc.newNull();
  const pastIt = doc.newNull();
  t.eqStr("values: the value at index 2^22 - 1 is made, the one at 2^22 is JSON_VALUE_ERR_VALUES whatever maxValues says", `${lastIndex >= 0} ${pastIt}`, `true ${JSON_VALUE_ERR_VALUES}`);
  doc.clear();
};

export const jvUnits = (t: Suite): void => {
  jvReaders(t);
  jvNumbers(t);
  jvErrors(t);
  jvDuplicates(t);
  jvBuilders(t);
  jvUnicode(t);
  jvWriting(t);
  jvPretty(t);
  jvClear(t);
  jvStale(t);
  jvValues(t);
};
