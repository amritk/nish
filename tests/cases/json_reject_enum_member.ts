// Typed JSON reads an enum as any of its members, so a field of an enum member
// type, which holds one member, is not a field it can decode into.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

enum Level {
  Low,
  High,
}

class Gauge {
  readonly level: Level.High = Level.High;
}

export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, new Gauge());
};
