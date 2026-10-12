// Typed JSON options on a subclass: there is no inheritance, so the class is
// refused at `extends` and its options are never read.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Base {
  id: i32 = 0;
}

class User extends Base {
  static readonly json = { rename: { id: "user_id" } };
  name: string = "";
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
