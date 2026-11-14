// `jsonEncode` writes each field's key as one copy: the compiler quotes and
// escapes the key, colon included, into a string constant (`"\22id\22:"`,
// `"\22a\5C\22b\22:"`) and passes it to `JsonWriter.keyQuoted` beside the
// plain name. A minified writer copies the constant; an indenting one writes
// the name through `key`, as every key was written before. Every line printed
// is what `JSON.stringify` writes for the same object.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Item {
  static readonly json = { rename: { quoted: 'a"b', slashed: "c\\d", line: "e\nf", accent: "é" } };
  quoted: i64 = 0;
  slashed: string = "";
  accent: f64 = 0;
  id: i32 = 0;
  line: boolean = false;
}

const encode = (item: Item, indent: i32): string => {
  const w = new JsonWriter(new Array<u8>(256), 0);
  if (indent > 0) {
    w.setIndent(indent);
  }
  jsonEncode(w, item);
  return w.complete() ? w.text() : `error ${w.failed}`;
};

export const main = (): i32 => {
  const item = new Item();
  item.id = -7;
  item.quoted = toI64(1000000);
  item.slashed = "x";
  item.line = true;
  item.accent = 0.5;
  console.log(encode(item, 0));
  console.log(encode(item, 2));
  console.log(encode(new Item(), 0));
  return 0;
};
