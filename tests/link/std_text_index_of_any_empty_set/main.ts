// `indexOfAny` with an empty set matches nothing and answers -1
// (docs/LANGUAGE.md, "Byte search"). `tests/run.js` holds the native run and
// the run under Node to the same output.
import { indexOfAny } from "nish/text";

export const main = (): number => {
  console.log(`before: ${indexOfAny("a,b", ",", 0)}`);
  console.log(`after: ${indexOfAny("a,b", "", 0)}`);
  return 0;
};
