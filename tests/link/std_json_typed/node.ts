// What a typed JSON program does under Node: the types are erased, so
// `jsonDecode` has no fields to read into and ends the program with a panic
// naming that (docs/LANGUAGE.md, "Typed JSON", class C). `tests/run.js` runs
// this under `runtime/nish.mjs` and holds the panic. Natively it prints
// `0 Hello, World!`.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Greeting {
  message: string = "";
}

export const main = (): i32 => {
  const text = `{"message":"Hello, World!"}`;
  const src = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(src.length) && i < toI32(text.length); i += 1) {
    src[i] = toU8(text.charCodeAt(i));
  }
  const g = new Greeting();
  const code = jsonDecode(new JsonDecoder(src, 0, toI32(src.length), new JsonLimits()), g);
  console.log(`${code} ${g.message}`);
  return code;
};
