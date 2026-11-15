// Typed JSON: a string enum is not a `string`, so a `Map` keyed by one is
// refused like a map keyed by a numeric enum: a map's keys are read and
// written as strings.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

enum Role {
  Admin = "admin",
  Guest = "guest",
}

class Grants {
  byRole: Map<Role, string>;
  constructor() {
    this.byRole = new Map<Role, string>();
  }
}
export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, new Grants());
};
