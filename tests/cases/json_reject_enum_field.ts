// Typed JSON: an enum has no JSON reading of its own (its name or its number
// would both be a guess), so a field of one is refused at the call.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

enum Color {
  Red,
  Green,
}

class Paint {
  color: Color;
  constructor() {
    this.color = Color.Red;
  }
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Paint());
  return w.failed;
};
