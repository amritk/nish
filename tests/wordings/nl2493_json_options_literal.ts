// NL2493: a typed JSON option that is not written as a literal.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

const KEY: string = "user_id";

class User {
  static readonly json = { rename: { id: KEY } };
  id: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
