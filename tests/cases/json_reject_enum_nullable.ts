// Typed JSON reads an enum as its number, and a number has no `null`: the
// checker refuses `Level | null` where it is written (NL2010), so typed JSON
// never meets one as a field.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

enum Level {
  Low,
  High,
}

class Gauge {
  level: Level | null;
  constructor() {
    this.level = null;
  }
}

export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, new Gauge());
};
