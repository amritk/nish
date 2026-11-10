// `padStart` and `padEnd` refuse a fill that is not ASCII: natively a cut at a
// byte width could end in half a UTF-8 sequence. The check comes before the
// width's, so `"abc"` at width 1, which needs no padding, still panics.
// `tests/run.js` holds the native run and the run under Node to the same
// message.
import { padEnd, padStart } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: [${padStart("abc", 5, "-")}]`);
  console.log(`after: [${padEnd("abc", 1, "é")}]`);
  return 0;
};
