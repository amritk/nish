// NL2498: an optional field with no initializer.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class User {
  static readonly json = { optional: ["name"] };
  id: i32 = 0;
  name: string;

  constructor() {
    this.name = "";
  }
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return w.failed;
};
