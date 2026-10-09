// `indexOfAny` refuses a set with a byte that is not ASCII: natively it would
// be one byte of a multi-byte sequence and under Node a UTF-16 unit, and the
// two readings would find different things (docs/LANGUAGE.md, "Byte search").
// `tests/run.js` holds the native run and the run under Node to the same message.
import { indexOfAny } from "nish/text";

export const main = (): number => {
  console.log(`before: ${indexOfAny("a,b", ",", 0)}`);
  console.log(`after: ${indexOfAny("a,é", "é", 0)}`);
  return 0;
};
