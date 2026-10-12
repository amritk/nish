// Typed JSON options are read from the class's text: a computed key in them
// is a computed name, which Phase 0 refuses wherever it is written (NL1041).
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

const option: string = "rename";

class User {
  static readonly json = { [option]: { id: "user_id" } };
  id: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
