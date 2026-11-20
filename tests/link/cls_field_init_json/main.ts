// Typed JSON's missing optional key runs a `[]` or `new` initializer as
// `new` does: two decoded objects get their own array and child, and an
// object decoded into again gets fresh ones in place of what the earlier
// input gave it.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Inner {
  n: i32 = 0;
}

class Item {
  static readonly json = { optional: ["tags", "inner"] };
  id: i32 = 0;
  tags: string[] = [];
  inner: Inner = new Inner();
}

const decode = (text: string, out: Item): i32 => {
  const src = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(src.length); i += 1) {
    src[i] = toU8(text.charCodeAt(i));
  }
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  jsonDecode(d, out);
  return d.failed;
};

export const main = (): i32 => {
  const a = new Item();
  const b = new Item();
  console.log(decode(`{"id":1}`, a));
  console.log(decode(`{"id":2}`, b));
  a.tags.push("a");
  a.inner.n = 5;
  console.log(`${a.id} ${a.tags.length} ${a.inner.n}`);
  console.log(`${b.id} ${b.tags.length} ${b.inner.n}`);
  console.log(a.tags !== b.tags);
  console.log(a.inner !== b.inner);

  // Given, the keys are read; missing again, they are reset.
  console.log(decode(`{"id":4,"tags":["x","y"],"inner":{"n":9}}`, b));
  console.log(`${b.id} ${b.tags.length} ${b.inner.n}`);
  const held = a.inner;
  console.log(decode(`{"id":3}`, a));
  console.log(`${a.id} ${a.tags.length} ${a.inner.n}`);
  console.log(a.inner !== held);
  console.log(held.n);
  console.log(decode(`{"id":5}`, b));
  console.log(`${b.id} ${b.tags.length} ${b.inner.n}`);
  return 0;
};
