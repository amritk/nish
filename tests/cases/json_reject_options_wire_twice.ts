// Two renames to one key would give one key to two fields (NL2497).
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class User {
  static readonly json = { rename: { id: "key", name: "key" } };
  id: i32 = 0;
  name: string = "";
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
