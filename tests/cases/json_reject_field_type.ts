// Typed JSON: a field whose type has no JSON reading is refused at the call,
// naming the class and the field. An `f32` would round on the way in.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Sample {
  id: i32 = 0;
  ratio: f32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Sample());
  return w.failed;
};
