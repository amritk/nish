// WP51 §2.2: typed JSON's field whitelist names no function type, so a class
// with a reference field has no JSON form (NL2485).
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

type F = (x: i32) => i32

const inc = (x: i32): i32 => x + 1

class Stage {
  op: F
  constructor(op: F) {
    this.op = op
  }
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(16), 0)
  jsonEncode(w, new Stage(inc))
  return w.failed
}
