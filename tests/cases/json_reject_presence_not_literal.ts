// Typed JSON's `presence` option: a presence field is named by a string literal (NL2493).
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";
const FLAG: string = "hasA";

class Patch {
  static readonly json = { presence: { a: FLAG } };
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
