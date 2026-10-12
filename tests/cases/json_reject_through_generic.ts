// Typed JSON: a call inside a generic function is checked for the class each
// instantiation binds, so the refusal reaches through the wrapper.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Bad {
  small: u16 = 0;
}

const decodeAny = <T>(d: JsonDecoder, out: T): i32 => jsonDecode(d, out);

export const main = (): i32 => {
  const d = new JsonDecoder([], 0, 0, new JsonLimits());
  return decodeAny(d, new Bad());
};
