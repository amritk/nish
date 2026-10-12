// Typed JSON: a `| null` field that holds `null` is given a `new C()` to
// decode into, so the same constructor rule holds there.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Badge {
  level: i32;
  constructor(level: i32) {
    this.level = level;
  }
}

class Profile {
  badge: Badge | null = null;
}

export const main = (): i32 => {
  const d = new JsonDecoder([], 0, 0, new JsonLimits());
  return jsonDecode(d, new Profile());
};
