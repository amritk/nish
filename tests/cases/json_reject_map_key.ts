// Typed JSON: a JSON object's keys are strings, so a `Map` whose keys are
// anything else is refused at the call, naming the field.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Index {
  byId: Map<i32, string>;
  constructor() {
    this.byId = new Map<i32, string>();
  }
}
export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Index());
  return w.failed;
};
