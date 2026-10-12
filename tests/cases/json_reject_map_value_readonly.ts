// Typed JSON: decoding assigns every field of every class it reaches, a
// class a `Map` holds included, so a `readonly` field there is refused.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Key {
  readonly id: i32 = 0;
}

class Ring {
  keys: Map<string, Key>;
  constructor() {
    this.keys = new Map<string, Key>();
  }
}
export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, new Ring());
};
