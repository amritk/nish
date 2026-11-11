// `toFixed` refuses more than 100 digits, where JavaScript throws a
// `RangeError`. `tests/run.js` holds the native run and the run under Node to
// the same message.
import { toFixed } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: ${toFixed(1.5, 100).length}`);
  console.log(`after: ${toFixed(1.5, 101)}`);
  return 0;
};
