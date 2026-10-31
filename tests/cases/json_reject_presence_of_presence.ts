// Typed JSON's `presence` option: a presence field is off the wire, so its own presence is not recorded (NL2592).
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Patch {
  static readonly json = { presence: { a: "hasA", hasA: "hasB" } };
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
