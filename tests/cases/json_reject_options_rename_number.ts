// A wire name is a string literal; a number is refused (NL2496).
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class User {
  static readonly json = { rename: { id: 7 } };
  id: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
