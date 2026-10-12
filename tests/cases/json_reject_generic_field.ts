// Typed JSON: a generic class's instance is not a declared class, so a field
// holding one is refused. A `Map` with `string` keys is the one generic
// class typed JSON reads and writes (`json_reject_map_key`).
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}

class Shelf {
  box: Box<i32>;
  constructor() {
    this.box = new Box<i32>(1);
  }
}
export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Shelf());
  return w.failed;
};
