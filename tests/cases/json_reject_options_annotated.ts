// Typed JSON options are written without a type annotation: their type is
// the literal's (NL2492).
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class User {
  static readonly json: string = "x";
  id: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
