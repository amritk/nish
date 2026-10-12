// Typed JSON: a `Set` has no JSON reading of its own (an array would drop
// the rule that its elements are distinct), so a field of one is refused.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Tags {
  names: Set<string>;
  constructor() {
    this.names = new Set<string>();
  }
}
export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Tags());
  return w.failed;
};
