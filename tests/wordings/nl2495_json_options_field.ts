// NL2495: a typed JSON option naming no field of the class.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class User {
  static readonly json = { rename: { userID: "user_id" } };
  userId: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
