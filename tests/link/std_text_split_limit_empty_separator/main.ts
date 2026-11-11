// `splitLimit` refuses an empty separator whatever the limit, as `split` does,
// even a limit of 0, for which JavaScript would answer `[]`. `tests/run.js`
// holds the native run and the run under Node to the same message.
import { splitLimit } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: ${splitLimit("a,b", ",", 0).length}`);
  console.log(`after: ${splitLimit("a,b", "", 0).length}`);
  return 0;
};
