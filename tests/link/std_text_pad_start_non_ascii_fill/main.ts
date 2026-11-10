// `padStart`'s own refusal of a fill that is not ASCII, the twin of
// `std_text_pad_non_ascii_fill`, which reaches only `padEnd`'s: each names
// itself in the panic. The fill is checked before the width, so `"abc"` at
// width 1, which needs no padding, still panics. `tests/run.js` holds the
// native run and the run under Node to the same message.
import { padEnd, padStart } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: [${padEnd("abc", 5, "-")}]`);
  console.log(`after: [${padStart("abc", 1, "ß")}]`);
  return 0;
};
