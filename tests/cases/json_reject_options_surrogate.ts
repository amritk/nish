// A key on the wire is UTF-8: a rename to a lone surrogate is a key no input
// could give, since the decoder refuses one, so it is refused (NL2499).
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class User {
  static readonly json = { rename: { id: "a\ud800" } };
  id: i32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
