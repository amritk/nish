// NL2710: Typed JSON options are read from the class's text: a spread into them names
// nothing that text can show, so it is refused with its own message.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

const base: i32 = 0;

class User {
  static readonly json = { ...base, optional: ["id"] };
  id: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
