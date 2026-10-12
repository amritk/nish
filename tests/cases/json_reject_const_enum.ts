// Typed JSON reads a numeric enum as its number. A `const enum` is refused
// where it is declared, so a field of one never reaches the call.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

const enum Level {
  Low,
  High,
}

class Gauge {
  level: Level;
  constructor() {
    this.level = Level.Low;
  }
}
export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Gauge());
  return w.failed;
};
