// Typed JSON (`nish/json-typed`): the compiler writes the decoding and the
// encoding of a class from its fields. This module is kept small on purpose:
// `main.ll` beside it is the golden of the code written for `Hello`, one
// string field, so a change to what the compiler writes reads as a diff of a
// few dozen lines. `checks.ts` is the rest of the suite, `kinds.ts` its
// section for `u64`, enums, maps and the key dispatch, `tag.ts` the golden of
// the code written for those kinds, `models.ts` the classes, `node.ts` and
// `readers.ts` what Node is held to, and `round-trip.txt` and
// `round-trip-kinds.txt` the inputs `tests/run.js` holds to Node's
// `JSON.stringify(JSON.parse(x))`.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";
import { jtChecks, jtModes } from "./checks.ts";

class Hello {
  message: string = "";
}

export const main = (): i32 => {
  const mode = jtModes(process.argv);
  if (mode >= 0) {
    return mode;
  }
  const text = `{"message":"Hello, World!"}`;
  const src = new Array<u8>(toI32(text.length));
  for (let i: i32 = 0; i < toI32(src.length) && i < toI32(text.length); i += 1) {
    src[i] = toU8(text.charCodeAt(i));
  }
  const d = new JsonDecoder(src, 0, toI32(src.length), new JsonLimits());
  const hello = new Hello();
  const code = jsonDecode(d, hello);
  const w = new JsonWriter(new Array<u8>(64), 0);
  jsonEncode(w, hello);
  console.log(`${code} ${hello.message} ${w.text()}`);
  return jtChecks();
};
