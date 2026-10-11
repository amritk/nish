// Typed JSON: a generic class's instance is not a declared class, so a field
// holding one is refused, a `Map` included.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Index {
  byName: Map<string, i32>;
  constructor() {
    this.byName = new Map<string, i32>();
  }
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Index());
  return w.failed;
};
