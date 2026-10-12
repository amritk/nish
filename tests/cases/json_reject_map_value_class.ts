// Typed JSON: a class a `Map` holds is reached like a field's class, so a
// field of it that typed JSON cannot write is refused, naming that class.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

class Gauge {
  level: f32 = 0;
}

class Panel {
  gauges: Map<string, Gauge>;
  constructor() {
    this.gauges = new Map<string, Gauge>();
  }
}
export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Panel());
  return w.failed;
};
