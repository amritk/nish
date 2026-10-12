// Typed JSON options are read from the class's text: the options object
// itself reached through a module constant is not a literal (NL2493).
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

const OPTIONS: string = "rename";

class User {
  static readonly json = OPTIONS;
  id: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
