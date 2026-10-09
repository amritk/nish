// `indexOfAny` refuses an empty set: a set with no byte in it matches nothing,
// so a call that passes one is a mistake, and the program panics rather than
// answering -1 (docs/LANGUAGE.md, "Byte search"). `tests/run.js` holds the
// native run and the run under Node to the same message.
import { indexOfAny } from "nish/text";

export const main = (): number => {
  console.log(`before: ${indexOfAny("a,b", ",", 0)}`);
  console.log(`after: ${indexOfAny("a,b", "", 0)}`);
  return 0;
};
