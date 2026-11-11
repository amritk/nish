// NL2723: `jsonDecodeUnion` picks a variant by its tag, so its value is a
// union; a class is decoded into with `jsonDecode`.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecodeUnion } from "nish/json-typed";

class Point {
  x: i32 = 0;
}

export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  const p = jsonDecodeUnion(d, new Point());
  return p.x;
};
