// Typed JSON: a decode stores what it makes into the object it fills, so a
// call inside a `using a = arena()` block is refused (NL2424): the strings it
// stores would outlive the release.
import { JsonLimits } from "nish/json-tokenizer";
import { JsonDecoder, jsonDecode } from "nish/json-typed";

class Note {
  text: string = "";
}

export const main = (): i32 => {
  const d = new JsonDecoder([], 0, 0, new JsonLimits());
  const n = new Note();
  let failed: i32 = 0;
  for (let i: i32 = 0; i < 2; i += 1) {
    using a = arena();
    failed = jsonDecode(d, n);
  }
  return failed;
};
