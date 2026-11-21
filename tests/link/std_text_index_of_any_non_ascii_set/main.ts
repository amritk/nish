// `indexOfAny` with a non-ASCII set: natively each byte of `"é"` is a member
// and under Node its UTF-16 unit is; here both find the `é`, at a byte offset
// natively and a unit offset under Node, which agree since only ASCII precedes
// it (docs/LANGUAGE.md, "Byte search"). `tests/run.js` holds the native run
// and the run under Node to the same output.
import { indexOfAny } from "nish/text";

export const main = (): number => {
  console.log(`before: ${indexOfAny("a,b", ",", 0)}`);
  console.log(`after: ${indexOfAny("a,é", "é", 0)}`);
  return 0;
};
