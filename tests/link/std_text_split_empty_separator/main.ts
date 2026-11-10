// `split` refuses an empty separator: JavaScript splits on "" into UTF-16
// units, which natively would be bytes, and the two answers differ on any text
// that is not ASCII. `tests/run.js` holds the native run and the run under
// Node to the same message.
import { split } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: ${split("a,b", ",").length}`);
  console.log(`after: ${split("a,b", "").length}`);
  return 0;
};
