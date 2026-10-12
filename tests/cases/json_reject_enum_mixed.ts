// Typed JSON reads a numeric enum as its number. An enum with one string
// member among numeric ones is refused by Phase 0 as a string enum is.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";

enum Mode {
  Off = 0,
  On = "on",
}

class Switch {
  mode: Mode;
  constructor() {
    this.mode = Mode.Off;
  }
}
export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  return jsonDecode(d, new Switch());
};
