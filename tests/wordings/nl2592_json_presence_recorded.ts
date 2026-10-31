// NL2592: a field whose presence is recorded is itself named as a presence field.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Patch {
  static readonly json = { presence: { hasA: "hasB", a: "hasA" } };
  a: i32 = 0;
  b: i32 = 0;
  hasA: boolean = false;
  hasB: boolean = false;
}

export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  jsonDecode(d, new Patch());
  return d.failed;
};
