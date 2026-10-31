// Typed JSON's `presence` option: `presence` names a field the class declares (NL2495).
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Patch {
  static readonly json = { presence: { zz: "hasA" } };
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
