// Typed JSON: a `Map`'s values are held to the rule a field is, so a map
// of a type typed JSON cannot write is refused, naming the field.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Gauges {
  levels: Map<string, f32>;
  constructor() {
    this.levels = new Map<string, f32>();
  }
}
export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Gauges());
  return w.failed;
};
