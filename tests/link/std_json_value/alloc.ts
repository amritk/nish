// One document reused across bodies: the values of each parse are read back
// whole after `churn` has reused every byte a wrongly released pool would have
// given back, the next parse replaces them, and once the document has grown to
// the largest body, a parse, every read that allocates nothing, and a write
// into a reused buffer leave `Arena.used()` where they found it.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JSON_VALUE_NONE, JsonDocument } from "nish/json-value";
import { Suite } from "nish/testing";
import { jvBytes } from "./common";

/** Allocates and drops enough strings to reuse whatever the arena had released. */
const churn = (): i32 => {
  let t: i32 = 0;
  for (let i: i32 = 0; i < 2000; i++) {
    t = t + toI32(`xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx${i}`.length);
  }
  return t;
};

/** Bodies after the warm-up, every one measured. */
const JV_ALLOC_ROUNDS: i32 = 10000;

/**
 * One request: the body's bytes rewritten in place for round `k` (a digit of
 * the id changes every round, so nothing can be computed once), parsed, read
 * through every reader that allocates nothing, and written into `out`.
 * Answers a checksum of what it read, or `-1`.
 */
const jvOneRequest = (doc: JsonDocument, body: u8[], w: JsonWriter, out: u8[], k: i32): i64 => {
  const digit: i32 = 48 + (k % 10);
  if (toI32(body.length) > 9) {
    body[9] = toU8(digit);
  }
  const root = doc.parse(body, 0, toI32(body.length));
  if (root < 0) {
    return toI64(-1);
  }
  let sum: i64 = doc.i64(doc.get(root, "id"));
  sum = sum + toI64(doc.length(doc.get(root, "tags")));
  if (doc.stringEquals(doc.get(root, "name"), "café 😀")) {
    sum = sum + toI64(1000);
  }
  if (doc.isU64(doc.get(root, "wide"))) {
    sum = sum + toI64(7);
  }
  const x: f64 = doc.f64(doc.get(root, "long"));
  sum = sum + (x > toF64(0) ? toI64(3) : toI64(0));
  w.reset(out, 0);
  doc.write(root, w);
  return w.complete() ? sum + toI64(w.written()) : toI64(-1);
};

export const jvAlloc = (t: Suite): void => {
  const doc = new JsonDocument(new JsonLimits());
  const first = doc.parseText('{"a":"first string","b":[1.5,"two",{"c":"three"}],"n":18446744073709551616}');
  const b = doc.get(first, "b");
  churn();
  t.eqStr(
    "reuse: a parsed tree reads back whole after churn",
    `${doc.string(doc.get(first, "a"))} ${doc.numberText(doc.at(b, 0))} ${doc.string(doc.at(b, 1))} ${doc.string(doc.get(doc.at(b, 2), "c"))} ${doc.numberText(doc.get(first, "n"))}`,
    "first string 1.5 two three 18446744073709551616"
  );
  t.eqStr("reuse: and writes back whole after churn", doc.stringify(first), '{"a":"first string","b":[1.5,"two",{"c":"three"}],"n":18446744073709551616}');
  // A second, larger body: every array grows, then the first one's handles past the end name nothing.
  const parts: string[] = [];
  for (let i: i32 = 0; i < 200; i += 1) {
    parts.push(`{"k${i}":"value number ${i}","n":${i}.25}`);
  }
  const second = doc.parseText(`[${parts.join(",")}]`);
  churn();
  t.eqStr(
    "reuse: a second, larger body replaces the first and reads back after churn",
    `${doc.length(second)} ${doc.string(doc.get(doc.at(second, 199), "k199"))} ${doc.f64(doc.get(doc.at(second, 0), "n"))}`,
    "200 value number 199 0.25"
  );
  const third = doc.parseText("[true]");
  t.ok("reuse: a third, smaller body names only its own values", doc.kind(third + 2) === JSON_VALUE_NONE && doc.boolean(doc.at(third, 0)));
  const built = doc.newArray();
  for (let i: i32 = 0; i < 50; i += 1) {
    doc.push(built, doc.newString(`built ${i}`));
  }
  churn();
  t.eqStr("reuse: a built tree reads back after churn", `${doc.string(doc.at(built, 0))} ${doc.string(doc.at(built, 49))}`, "built 0 built 49");

  const body = jvBytes(
    '{"id":1234,"name":"caf\\u00e9 \\ud83d\\ude00","wide":18446744073709551615,"long":0.12345678901234567,"tags":["a","b",{"k":[null,false]}],"k":1}'
  );
  const out = new Array<u8>(512);
  const w = new JsonWriter(out, 0);
  let checksum: i64 = 0;
  let k: i32 = 0;
  while (k < 5) {
    checksum = checksum + jvOneRequest(doc, body, w, out, k);
    k += 1;
  }
  let failures: i32 = 0;
  let kept: i64 = 0;
  k = 0;
  while (k < JV_ALLOC_ROUNDS) {
    const before: i64 = Arena.used();
    const got: i64 = jvOneRequest(doc, body, w, out, k);
    kept = kept + (Arena.used() - before);
    if (got < 0) {
      failures += 1;
    }
    checksum = checksum + got;
    k += 1;
  }
  t.eqI32("alloc: 10,000 reused bodies parse, read and write", failures, 0);
  t.eqI64("alloc: Arena.used() is flat across every one, parseFloat's numbers and the write included", kept, toI64(0));
  t.ok("alloc: the checksum is the work being done", checksum > 0);
  t.eqStr("alloc: the last body as written", w.text(), '{"id":1239,"name":"café 😀","wide":18446744073709551615,"long":0.12345678901234567,"tags":["a","b",{"k":[null,false]}],"k":1}');
};
