// Only `static readonly json` holds typed JSON options and may leave out its
// type: an instance field called `json` is an ordinary field, which needs one.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class User {
  readonly json = { rename: { id: "user_id" } };
  id: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
