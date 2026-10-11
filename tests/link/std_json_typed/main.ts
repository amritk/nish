// Typed JSON (`nish/json-typed`): the compiler writes the decoding and the
// encoding of a class from its fields. This module is kept small on purpose:
// `main.ll` beside it is the golden of the code written for `Hello`, one
// string field, so a change to what the compiler writes reads as a diff of a
// few dozen lines. `checks.ts` is the rest of the suite, `models.ts` the
// classes, and `round-trip.txt` the inputs `tests/run.js` holds to Node's
// `JSON.stringify(JSON.parse(x))`.
import { JsonWriter } from "nish/json";
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode, jsonEncode } from "nish/json-typed";
import { jtBench, jtChecks, jtRoundTripFile } from "./checks.ts";

class Hello {
  message: string = "";
}

export const main = (): i32 => {
  const argv = process.argv;
  if (argv.length > 2 && argv[1] === "--round-trip") {
    return jtRoundTripFile(argv[2]);
  }
  if (argv.length > 2 && argv[1] === "--bench") {
    return jtBench(toI32(parseInt(argv[2])));
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
