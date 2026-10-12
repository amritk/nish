// Typed JSON: an array of arrays is not a field type the route reads.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Grid {
  cells: i32[][];
  constructor() {
    this.cells = [];
  }
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Grid());
  return w.failed;
};
