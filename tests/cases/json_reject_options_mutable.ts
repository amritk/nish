// Typed JSON options are `static readonly`: a `static json` without
// `readonly` is an ordinary field to the parser, and needs a type.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class User {
  static json = { rename: { id: "user_id" } };
  id: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
