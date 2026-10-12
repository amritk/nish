// Typed JSON: the rule follows a map's values into a map they hold, so an
// `f32` two maps down is refused at the field that holds the outer one.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Gauges {
  byRoom: Map<string, Map<string, f32>>;
  constructor() {
    this.byRoom = new Map<string, Map<string, f32>>();
  }
}
export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, new Gauges());
};
