// `indexOfAny` with a set of 17 bytes, more than one vector of the runtime
// kernel compares, is searched by a plain loop and finds what a short set
// would (docs/LANGUAGE.md, "Byte search"). `tests/run.js` holds the native run
// and the run under Node to the same output.
import { indexOfAny } from "nish/text";

export const main = (): number => {
  console.log(`before: ${indexOfAny("a,b", "0123456789abcdef", 0)}`);
  console.log(`after: ${indexOfAny("a,b", "0123456789abcdefg", 0)}`);
  return 0;
};
