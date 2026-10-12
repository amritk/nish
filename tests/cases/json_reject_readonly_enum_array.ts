// Typed JSON: decoding assigns an array field the array it decoded into, so
// a `readonly` array of enums is refused as a `readonly` array of numbers is.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

enum Level {
  Low,
  High,
}

class Gauge {
  levels: readonly Level[];
  constructor() {
    this.levels = [];
  }
}

export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, new Gauge());
};
