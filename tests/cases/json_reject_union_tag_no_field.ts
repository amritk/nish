// NL2723: `tag` names the string a variant writes its tag as, and a class with
// no tag field is no variant.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Point {
  static readonly json = { tag: "point" };
  x: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(16), 0);
  jsonEncode(w, new Point());
  return w.failed;
};
