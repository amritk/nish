// Typed JSON's `presence` option: a presence field has no key, so no option renames it (NL2585).
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Patch {
  static readonly json = { rename: { hasA: "has_a" }, presence: { a: "hasA" } };
  a: i32 = 0;
  b: i32 = 0;
  hasA: boolean = false;
}

export const main = (): i32 => {
  const src = new Array<u8>(2);
  const d = new JsonDecoder(src, 0, 2, new JsonLimits());
  jsonDecode(d, new Patch());
  return d.failed;
};
