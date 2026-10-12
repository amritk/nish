// NL2497: two fields with one key on the wire.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class User {
  static readonly json = { rename: { id: "name" } };
  id: i32 = 0;
  name: string = "";
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
