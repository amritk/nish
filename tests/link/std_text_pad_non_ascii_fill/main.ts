// `padEnd` takes a fill that is not ASCII; `"abc"` at width 1 needs no
// padding, so the fill is never cut and both hosts answer `"abc"`.
// `std_text_pad_native` holds what a non-ASCII fill pads to on each host.
// `tests/run.js` holds the run under Node to the same output.
import { padEnd, padStart } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: [${padStart("abc", 5, "-")}]`);
  console.log(`after: [${padEnd("abc", 1, "é")}]`);
  return 0;
};
