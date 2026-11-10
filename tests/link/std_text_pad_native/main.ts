// `padStart` and `padEnd` where the native and Node answers part: on text
// that is not ASCII, because the width counts what `text.length` counts, bytes
// natively and UTF-16 units under Node. expected.out holds the native
// answers, which the doc comment on `padStart` gives; `tests/run.js` runs the
// same file under the Node prelude and holds it to Node's. The brackets show
// where the padding went.
import { padEnd, padStart } from "../../../std/text.ts";

export const main = (): number => {
  // `é` is two bytes and one unit: one space natively, two under Node.
  console.log(`start: [${padStart("é", 3, " ")}]`);
  console.log(`end: [${padEnd("é", 3, " ")}]`);
  // `😀` is four bytes and two units: nothing natively, which is the width
  // already passed, and two dots under Node.
  console.log(`emoji: [${padStart("😀", 4, ".")}]`);
  // `ß` and `x`: three bytes, two units, so one zero natively and two under Node.
  console.log(`mixed: [${padStart("ßx", 4, "0")}]`);
  return 0;
};
