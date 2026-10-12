// Typed JSON reads a numeric enum as its number. An enum whose members are
// strings is not one the language declares at all: Phase 0 refuses it before
// any call can name it, so typed JSON never meets one.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

enum Color {
  Red = "red",
  Green = "green",
}

class Paint {
  color: Color;
  constructor() {
    this.color = Color.Red;
  }
}
export const main = (): i32 => {
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, new Paint());
  return w.failed;
};
