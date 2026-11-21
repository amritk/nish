// `padStart`'s twin of `std_text_pad_non_ascii_fill`: a fill that is not
// ASCII, at a width that needs no padding, answers `"abc"` on both hosts.
// `tests/run.js` holds the run under Node to the same output.
import { padEnd, padStart } from "../../../std/text.ts";

export const main = (): number => {
  console.log(`before: [${padEnd("abc", 5, "-")}]`);
  console.log(`after: [${padStart("abc", 1, "ß")}]`);
  return 0;
};
