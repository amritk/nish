// `indexOfAny` refuses a set of 17 bytes: 16 is what one vector of the runtime
// kernel compares, and a longer set panics rather than being searched some
// slower way (docs/LANGUAGE.md, "Byte search"). `tests/run.js` holds the
// native run and the run under Node to the same message.
import { indexOfAny } from "nish/text";

export const main = (): number => {
  console.log(`before: ${indexOfAny("a,b", "0123456789abcdef", 0)}`);
  console.log(`after: ${indexOfAny("a,b", "0123456789abcdefg", 0)}`);
  return 0;
};
