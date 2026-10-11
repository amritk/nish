// NL2485: a field typed JSON cannot read or write.
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

class Gauge {
  level: f32 = 0;
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(16), 0);
  jsonEncode(w, new Gauge());
  return w.failed;
};
