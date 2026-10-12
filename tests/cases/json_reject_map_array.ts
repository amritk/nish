// Typed JSON: an array holds scalars, strings, enums or objects of a class,
// and a `Map` is none of those, so an array of maps is refused.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Pages {
  counts: Map<string, i32>[];
  constructor() {
    this.counts = [];
  }
}
export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Pages());
  return w.failed;
};
