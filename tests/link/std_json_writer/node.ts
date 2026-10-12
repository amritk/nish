// The half of `JsonWriter` whose answer does not depend on how a string or an
// integer is read: ASCII text, no `i64`. `tests/run.js` builds this natively
// and runs it under Node, and holds both to `JSON.stringify` of the same
// values, computed there — so each line below is checked against JavaScript's
// own spelling rather than against a golden this repository wrote. The order
// of the lines is the order of `JSON_WRITER_NODE_VALUES` in `tests/run.js`,
// then `JSON_WRITER_NODE_PRETTY` once per indent of `JSON_WRITER_NODE_INDENTS`,
// then `JSON_WRITER_NODE_STRICT`.
import { JsonWriter, jsonStringifyString } from "nish/json";

/** Prints what `w` wrote, then starts it over on the same buffer. */
const flush = (w: JsonWriter, out: u8[]): void => {
  console.log(w.complete() ? w.text() : `failed ${w.failed}`);
  w.reset(out, 0);
};

/**
 * The values the indented runs write, each flushed: an object that holds
 * every kind of member — empty and full containers, nested both ways, a
 * string with an escape, numbers — then a top-level empty object and array,
 * a string and a number, which indent leaves as they are.
 */
const writePretty = (w: JsonWriter, out: u8[]): void => {
  // { message: "Hello", empty: {}, none: [], list: [1, [2, []], { a: null }], deep: { b: { c: [true, false] } }, s: "x\ny", f: 1.5 }
  const half: f64 = 1.5;
  w.beginObject();
  w.key("message");
  w.string("Hello");
  w.key("empty");
  w.beginObject();
  w.endObject();
  w.key("none");
  w.beginArray();
  w.endArray();
  w.key("list");
  w.beginArray();
  w.i32(1);
  w.beginArray();
  w.i32(2);
  w.beginArray();
  w.endArray();
  w.endArray();
  w.beginObject();
  w.key("a");
  w.nullValue();
  w.endObject();
  w.endArray();
  w.key("deep");
  w.beginObject();
  w.key("b");
  w.beginObject();
  w.key("c");
  w.beginArray();
  w.boolean(true);
  w.boolean(false);
  w.endArray();
  w.endObject();
  w.endObject();
  w.key("s");
  w.string("x\ny");
  w.key("f");
  w.f64(half);
  w.endObject();
  flush(w, out);
  // [[{}]], {}, [], "top", -7
  w.beginArray();
  w.beginArray();
  w.beginObject();
  w.endObject();
  w.endArray();
  w.endArray();
  flush(w, out);
  w.beginObject();
  w.endObject();
  flush(w, out);
  w.beginArray();
  w.endArray();
  flush(w, out);
  w.string("top");
  flush(w, out);
  w.i32(-7);
  flush(w, out);
};

export const main = (): number => {
  const out = new Array<u8>(1024);
  const w = new JsonWriter(out, 0);

  // { message: "Hello, World!" }
  w.beginObject();
  w.key("message");
  w.string("Hello, World!");
  w.endObject();
  flush(w, out);

  // [] and {}
  w.beginArray();
  w.endArray();
  flush(w, out);
  w.beginObject();
  w.endObject();
  flush(w, out);

  // [[], {}, { a: [{}, 1], b: { c: null } }]
  w.beginArray();
  w.beginArray();
  w.endArray();
  w.beginObject();
  w.endObject();
  w.beginObject();
  w.key("a");
  w.beginArray();
  w.beginObject();
  w.endObject();
  w.i32(1);
  w.endArray();
  w.key("b");
  w.beginObject();
  w.key("c");
  w.nullValue();
  w.endObject();
  w.endObject();
  w.endArray();
  flush(w, out);

  // The seven short escapes, then every other byte below 0x20, 0x7f and `/`.
  w.string(`"\\${String.fromCharCode(8)}${String.fromCharCode(12)}\n\r\t`);
  flush(w, out);
  const parts: string[] = [];
  for (let c: i32 = 0; c < 32; c += 1) {
    parts.push(String.fromCharCode(c));
  }
  parts.push(String.fromCharCode(127));
  parts.push("/ ~");
  w.string(parts.join(""));
  flush(w, out);

  // [0, -7, 2147483647, -2147483648]
  w.beginArray();
  w.i32(0);
  w.i32(-7);
  w.i32(2147483647);
  w.i32(-2147483647 - 1);
  w.endArray();
  flush(w, out);

  // [0, 7, 4294967295, 2147483648, 4294967286]
  const uMax: u32 = 4294967295;
  const pastI32: u32 = 2147483648;
  const endsInSix: u32 = 4294967286;
  w.beginArray();
  w.u32(toU32(0));
  w.u32(toU32(7));
  w.u32(uMax);
  w.u32(pastI32);
  w.u32(endsInSix);
  w.endArray();
  flush(w, out);

  // [-0, 1e21, 1e-7, 0.1, 123, 5e-324, 1.7976931348623157e308, NaN, Infinity, -Infinity, 1.5, -2.5e-10]
  const negZero: f64 = -0.0;
  const big: f64 = 1e21;
  const small: f64 = 1e-7;
  const tenth: f64 = 0.1;
  const tiny: f64 = 5e-324;
  const huge: f64 = 1.7976931348623157e308;
  const nan: f64 = toF64(0) / toF64(0);
  const inf: f64 = toF64(1) / toF64(0);
  const half: f64 = 1.5;
  const wee: f64 = -2.5e-10;
  w.beginArray();
  w.f64(negZero);
  w.f64(big);
  w.f64(small);
  w.f64(tenth);
  w.f64(toF64(123));
  w.f64(tiny);
  w.f64(huge);
  w.f64(nan);
  w.f64(inf);
  w.f64(-inf);
  w.f64(half);
  w.f64(wee);
  w.endArray();
  flush(w, out);

  // [true, false, null]
  w.beginArray();
  w.boolean(true);
  w.boolean(false);
  w.nullValue();
  w.endArray();
  flush(w, out);

  // "" and { 'k"\n': "v" }
  w.string("");
  flush(w, out);
  w.beginObject();
  w.key('k"\n');
  w.string("v");
  w.endObject();
  flush(w, out);

  // jsonStringifyString('a\t"\u0001'), which is JSON.stringify of the string.
  console.log(jsonStringifyString(`a\t"${String.fromCharCode(1)}`));

  // The indented text: the nested value and the top-level scalars, once per
  // indent of `JSON_WRITER_NODE_INDENTS`, in its order, then the minified
  // text again. 11 is clamped to 10 and -3 is minified, as JSON.stringify does.
  const spaces: i32[] = [2, 4, 1, 10, 11, 0, -3];
  for (const n of spaces) {
    w.setIndent(n);
    writePretty(w, out);
  }
  w.setIndentTab();
  writePretty(w, out);
  w.setIndent(0);
  writePretty(w, out);

  // Strict mode: a finite f64 as ever, and each non-finite one is
  // JSON_WRITE_NON_FINITE (-8), written as nothing.
  w.setStrict(true);
  w.beginArray();
  w.f64(half);
  w.f64(negZero);
  w.endArray();
  flush(w, out);
  w.f64(nan);
  flush(w, out);
  w.beginArray();
  w.f64(inf);
  flush(w, out);
  w.beginObject();
  w.key("x");
  w.f64(-inf);
  console.log(`written ${w.written()}`);
  flush(w, out);
  w.setStrict(false);
  w.f64(nan);
  flush(w, out);
  return 0;
};
