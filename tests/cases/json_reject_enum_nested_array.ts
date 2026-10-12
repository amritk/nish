// Typed JSON: an array of enums is read and written, and an array of those
// arrays is refused, as every array of arrays is.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

enum Level {
  Low,
  High,
}

class Grid {
  rows: Level[][];
  constructor() {
    this.rows = [];
  }
}
export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Grid());
  return w.failed;
};
