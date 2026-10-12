// Typed JSON: a `readonly` array cannot be decoded into, element by element,
// so a field of one is refused, for encoding too in this version.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Fixed {
  values: readonly i32[];
  constructor() {
    this.values = [1, 2];
  }
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Fixed());
  return w.failed;
};
