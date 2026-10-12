// Typed JSON options on a generic class: typed JSON reads no generic class,
// so options on one are refused where it is instantiated (NL2492).
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Box<T> {
  static readonly json = { rename: { id: "box_id" } };
  id: i32 = 0;
  value: T;

  constructor(value: T) {
    this.value = value;
  }
}

class User {
  id: i32 = 0;
}

export const main = (): i32 => {
  const b = new Box<i32>(1);
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new User());
  return b.id + w.failed;
};
