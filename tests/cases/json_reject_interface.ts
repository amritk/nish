// Typed JSON: the value is read and written through a declared class's
// fields; an interface's record is not one in this version.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

interface Point {
  x: i32;
  y: i32;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  const p: Point = { x: 1, y: 2 };
  jsonEncode(w, p);
  return w.failed;
};
