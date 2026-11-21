// `split` on an empty separator gives `text`'s code points, one piece each,
// natively and under Node alike: JavaScript's UTF-16 units would be bytes
// natively, and a byte of a multi-byte character is not text. The emoji is one
// piece on both hosts. `tests/run.js` holds the run under Node to the same
// output.
import { split } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: ${split("a,b", ",").length}`);
  console.log(`after: ${split("a,b", "").length}`);
  console.log(`wide: ${split("a\u00e9\u{1F600}", "").join("|")}`);
  console.log(`empty: ${split("", "").length}`);
  return 0;
};
