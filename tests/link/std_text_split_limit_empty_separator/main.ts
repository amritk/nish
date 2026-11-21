// `splitLimit` on an empty separator keeps the first `limit` code points, as
// `split` gives them; a limit of 0 keeps none, as in JavaScript.
// `tests/run.js` holds the run under Node to the same output.
import { splitLimit } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: ${splitLimit("a,b", ",", 0).length}`);
  console.log(`after: ${splitLimit("a,b", "", 0).length}`);
  console.log(`two: ${splitLimit("a\u00e9b", "", 2).join("|")}`);
  return 0;
};
