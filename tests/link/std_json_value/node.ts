// Every public method of `JsonDocument` once, on ASCII text, printing what it
// answers. `tests/run.js` runs this under the Node prelude and builds it
// natively, and holds both to the same lines: the module has to load there
// (no `using`, every `i64` and `u64` from `toI64` and `toU64`), and `u64` is
// read with BigInt arithmetic that must not wrap.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JSON_VALUE_DUPLICATE_LAST, JsonDocument } from "nish/json-value";

export const main = (): number => {
  const doc = new JsonDocument(new JsonLimits());
  const root = doc.parseText(
    '{"s":"a\\"b\\u0041","t":true,"f":false,"z":null,"i":-9223372036854775808,"u":18446744073709551615,"w":18446744073709551616,"x":1.5e3,"a":[1,[],{}]}'
  );
  console.log(`parseText ${root >= 0} kind ${doc.kind(root)} length ${doc.length(root)} keyAt ${doc.keyAt(root, 8)}`);
  const s = doc.get(root, "s");
  console.log(`string ${doc.string(s)} stringEquals ${doc.stringEquals(s, 'a"bA')} ${doc.stringEquals(s, "ab")}`);
  console.log(`boolean ${doc.boolean(doc.get(root, "t"))} ${doc.boolean(doc.get(root, "f"))} null ${doc.kind(doc.get(root, "z"))}`);
  const i = doc.get(root, "i");
  const u = doc.get(root, "u");
  const w = doc.get(root, "w");
  console.log(`i64 ${doc.isI64(i)} ${doc.i64(i)} u64 ${doc.isU64(u)} ${doc.u64(u)} wide ${doc.isI64(w)} ${doc.isU64(w)} ${doc.u64(w)} ${doc.numberText(w)}`);
  console.log(`f64 ${doc.f64(doc.get(root, "x"))} text ${doc.numberText(doc.get(root, "x"))} at ${doc.length(doc.at(doc.get(root, "a"), 1))}`);
  console.log(`stringify ${doc.stringify(root)}`);
  const out = new Array<u8>(256);
  const writer = new JsonWriter(out, 0);
  doc.write(doc.get(root, "a"), writer);
  console.log(`write ${writer.complete()} ${writer.text()}`);

  const bytes = new Array<u8>(8);
  const text = "  [7] ";
  for (let k: i32 = 0; k < toI32(text.length) && k < toI32(bytes.length); k += 1) {
    bytes[k] = toU8(text.charCodeAt(k));
  }
  const p = doc.parse(bytes, 1, 5);
  console.log(`parse ${p >= 0} ${doc.stringify(p)} error ${doc.parse(bytes, 0, 8)}@${doc.errorAt}`);
  console.log(`duplicates ${doc.parseText('{"a":1,"a":2}')}@${doc.errorAt}`);
  doc.duplicates = JSON_VALUE_DUPLICATE_LAST;
  console.log(`last ${doc.stringify(doc.parseText('{"a":1,"b":0,"a":2}'))}`);

  doc.duplicates = 0;
  const kept = doc.parseText('{"a":"one"}');
  const member = doc.get(kept, "a");
  const next = doc.parseText('{"a":"two"}');
  console.log(`stale ${doc.kind(kept)} ${doc.kind(member)} "${doc.string(member)}" fresh ${doc.string(doc.get(next, "a"))}`);
  doc.maxValues = 2;
  console.log(`maxValues ${doc.parseText("[1,2]")}@${doc.errorAt} ${doc.length(doc.parseText("[1]"))}`);
  doc.maxValues = 1000;

  doc.clear();
  const o = doc.newObject();
  const arr = doc.newArray();
  doc.push(arr, doc.newNull());
  doc.push(arr, doc.newBoolean(true));
  doc.push(arr, doc.newString("x"));
  doc.push(arr, doc.newI64(toI64(-5)));
  doc.push(arr, doc.newU64(toU64(7)));
  doc.push(arr, doc.newF64(toF64(1) / toF64(4)));
  doc.push(arr, doc.newNumber("123456789012345678901234567890"));
  console.log(`set ${doc.set(o, "arr", arr)} ${doc.set(o, "k", doc.newObject())} ${doc.set(o, "k", doc.newString("v"))}`);
  console.log(`refused ${doc.push(o, doc.newNull())} ${doc.push(arr, arr)} ${doc.newNumber("1.")} ${doc.newF64(toF64(1) / toF64(0))}`);
  console.log(`built ${doc.stringify(o)}`);
  return 0;
};
