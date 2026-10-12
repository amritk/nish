// Typed JSON: a `Map`'s value is held to the rule a field is, and the checker
// refuses `Level | null` as a type argument as it does as a field (NL2010).
import { JsonWriter } from "nish/json";
import { jsonEncode } from "nish/json-typed";

enum Level {
  Low,
  High,
}

class Gauges {
  levels: Map<string, Level | null>;
  constructor() {
    this.levels = new Map<string, Level | null>();
  }
}

export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Gauges());
  return w.failed;
};
