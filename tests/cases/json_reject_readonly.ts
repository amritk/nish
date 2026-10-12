// Typed JSON: decoding assigns every field, so a `readonly` one is refused,
// here in the class of a `| null` field. Encoding the same class is fine.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Key {
  readonly id: i32 = 0;
}

class Door {
  key: Key | null = null;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Door());
  const d = new JsonDecoder([], 0, 0, new JsonLimits());
  return jsonDecode(d, new Door());
};
