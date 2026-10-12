// Typed JSON: an enum is a `Map` key the language allows, and still not a
// string, so a map keyed by one is refused like any other non-string key.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

enum Level {
  Low,
  High,
}

class Index {
  byLevel: Map<Level, string>;
  constructor() {
    this.byLevel = new Map<Level, string>();
  }
}
export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, new Index());
};
