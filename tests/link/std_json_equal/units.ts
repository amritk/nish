// `nish/json-equal`'s answers by JSON Schema's rules, its canonical text and
// hash pinned by value, and a tree deeper than any recursion would survive.
import { jsonEqual, jsonEqualCanonical, jsonEqualFirstDuplicate, jsonEqualHash } from "nish/json-equal";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDocument } from "nish/json-value";
import { Suite } from "nish/testing";

/** Whether `a` and `b`, each parsed into its own document, are equal. */
const jeEqual = (a: string, b: string): boolean => {
  const da = new JsonDocument(new JsonLimits());
  const db = new JsonDocument(new JsonLimits());
  return jsonEqual(da, da.parseText(a), db, db.parseText(b));
};

const jeCanonicalOf = (text: string): string => {
  const doc = new JsonDocument(new JsonLimits());
  return jsonEqualCanonical(doc, doc.parseText(text));
};

const jeHashOf = (text: string): string => {
  const doc = new JsonDocument(new JsonLimits());
  return `${jsonEqualHash(doc, doc.parseText(text))}`;
};

const jeDuplicateOf = (text: string): i32 => {
  const doc = new JsonDocument(new JsonLimits());
  return jsonEqualFirstDuplicate(doc, doc.parseText(text));
};

const jeEquality = (t: Suite): void => {
  const same: string[] = [
    "null|null",
    "true|true",
    "false|false",
    "1|1.0",
    "1|1e0",
    "-0|0",
    "100|1e2",
    '"a"|"a"',
    '"\\u0061"|"a"',
    "[]|[]",
    "{}|{}",
    "[1,[2]]|[1.0,[2e0]]",
    '{"a":1,"b":2}|{"b":2,"a":1}',
    '{"a":{"x":[1,{"y":null}]}}|{"a":{"x":[1,{"y":null}]}}',
    "1e1000000000000001|1e1000000000000001",
  ];
  const differ: string[] = [
    "null|false",
    "true|1",
    "false|0",
    '1|"1"',
    "1|2",
    "0.1|0.10000000000000001",
    "9007199254740993|9007199254740992",
    '"a"|"b"',
    '"a"|"ab"',
    "[]|{}",
    "[1]|[1,1]",
    "[1,2]|[2,1]",
    '{"a":1}|{"a":1,"b":1}',
    '{"a":1}|{"b":1}',
    '{"a":1}|{"a":2}',
    "[[]]|[{}]",
    // A refused number is equal only to its own spelling.
    "1e1000000000000001|10e1000000000000000",
  ];
  const wrong: string[] = [];
  for (const pair of same) {
    const bar: i32 = toI32(pair.indexOf("|"));
    if (!jeEqual(pair.slice(0, bar), pair.slice(bar + 1)) || !jeEqual(pair.slice(bar + 1), pair.slice(0, bar))) {
      wrong.push(`${pair} should be equal`);
    }
  }
  for (const pair of differ) {
    const bar: i32 = toI32(pair.indexOf("|"));
    if (jeEqual(pair.slice(0, bar), pair.slice(bar + 1)) || jeEqual(pair.slice(bar + 1), pair.slice(0, bar))) {
      wrong.push(`${pair} should differ`);
    }
  }
  t.eqStr("equal: every pair answers both ways round", wrong.join("; "), "");
  const doc = new JsonDocument(new JsonLimits());
  const one: i32 = doc.parseText("1");
  t.eqBool("equal: a handle naming no value equals nothing", jsonEqual(doc, -1, doc, one), false);
  t.eqBool("equal: not even another", jsonEqual(doc, -1, doc, -1), false);
};

const jeCanonical = (t: Suite): void => {
  t.eqStr("canonical: scalars", jeCanonicalOf('[null,true,false,1.50,"h\\u00e9"]'), "a5:ztfn15e-1;s3:hé");
  t.eqStr("canonical: members in key-byte order", jeCanonicalOf('{"b":[],"a":{},"":0}'), "o3:0:n0;1:ao0:1:ba0:");
  t.eqStr("canonical: a refused number keeps its text", jeCanonicalOf("[1e1000000000000001]"), "a1:x1e1000000000000001;");
  const doc = new JsonDocument(new JsonLimits());
  t.eqStr("canonical: a handle naming no value", jsonEqualCanonical(doc, -1), "");
};

const jeHash = (t: Suite): void => {
  // FNV-1a 64 of the canonical bytes, computed independently.
  t.eqStr("hash: null", jeHashOf("null"), "12638216887369603693");
  t.eqStr("hash: [1.0, \"x\"]", jeHashOf('[1.0,"x"]'), "15884115026190979387");
  const doc = new JsonDocument(new JsonLimits());
  t.eqStr("hash: no value is the offset basis", `${jsonEqualHash(doc, -1)}`, "14695981039346656037");
  t.eqStr("hash: equal values agree", jeHashOf('{"a":[1],"b":2}'), jeHashOf('{"b":2.0,"a":[1e0]}'));
};

const jeDuplicates = (t: Suite): void => {
  t.eqI32("duplicate: not an array", jeDuplicateOf('{"a":1,"b":1}'), -1);
  t.eqI32("duplicate: empty", jeDuplicateOf("[]"), -1);
  t.eqI32("duplicate: none", jeDuplicateOf('[1,"1",true,[1],{"a":1},null]'), -1);
  t.eqI32("duplicate: 1.0 repeats 1", jeDuplicateOf("[1,2,1.0]"), 2);
  t.eqI32("duplicate: the first repeat is named", jeDuplicateOf("[0,5,5,0]"), 2);
  t.eqI32("duplicate: objects in another key order", jeDuplicateOf('[{"a":1,"b":2},{"b":2,"a":1}]'), 1);
  t.eqI32("duplicate: strings past U+00FF stay apart", jeDuplicateOf('["Ā","\\u0000","ā","\\u0001"]'), -1);
  t.eqI32("duplicate: 0e9999999999999999 repeats 0", jeDuplicateOf("[0,0e9999999999999999]"), 1);
};

/** An array nested `depth` deep, built from the inside out: `[[[...[1]...]]]`. */
const jeDeep = (doc: JsonDocument, depth: i32): i32 => {
  let at: i32 = doc.newNumber("1");
  for (let i: i32 = 0; i < depth; i++) {
    const outer: i32 = doc.newArray();
    doc.push(outer, at);
    at = outer;
  }
  return at;
};

const jeDepth = (t: Suite): void => {
  const da = new JsonDocument(new JsonLimits());
  const db = new JsonDocument(new JsonLimits());
  const a: i32 = jeDeep(da, 100000);
  const b: i32 = jeDeep(db, 100000);
  t.eqBool("depth: 100000 levels compare without recursion", jsonEqual(da, a, db, b), true);
  t.eqBool("depth: and differ by one level", jsonEqual(da, a, db, db.at(b, 0)), false);
  t.eqI32("depth: the canonical text has every level", toI32(jsonEqualCanonical(da, a).length), 100000 * 3 + 5);
  t.eqStr("depth: the hashes agree", `${jsonEqualHash(da, a)}`, `${jsonEqualHash(db, b)}`);
};

export const jeUnits = (t: Suite): void => {
  jeEquality(t);
  jeCanonical(t);
  jeHash(t);
  jeDuplicates(t);
  jeDepth(t);
};
