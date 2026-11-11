// `toFixed` refuses a digit count below 0, where JavaScript throws a
// `RangeError`. `tests/run.js` holds the native run and the run under Node to
// the same message.
import { toFixed } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: ${toFixed(1.5, 0)}`);
  console.log(`after: ${toFixed(1.5, -1)}`);
  return 0;
};
