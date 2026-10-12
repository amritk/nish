// Typed JSON: a `Map`'s values are held to the rule a field is, so a map of
// `readonly` arrays is refused as a `readonly` array field is.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Series {
  points: Map<string, readonly i32[]>;
  constructor() {
    this.points = new Map<string, readonly i32[]>();
  }
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Series());
  return w.failed;
};
