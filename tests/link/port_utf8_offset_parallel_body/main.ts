// WP33 NL8001 (#629): an offset a data-parallel body answers is stored in the
// array the call fills, so it is reported like any other stored offset. A body
// written inline is reported at the value it answers; a named function handed
// over as the body is reported at the argument, quoting what it answers. A
// string the body captures from its host is a source like any other: a
// `const` the host initialises with text that is not ASCII, or one bound to a
// `let` the host writes such text to.
import { parallelFrom, parallelMap, parallelMapInto } from "nish/threads";

const step = (k: i32): i32 => "héllo".indexOf("l") + k;

export const main = (): number => {
  const xs: i32[] = [1, 2, 3];
  const concise = parallelMap(xs, (k) => "héllo".indexOf("l") + k);
  const block = parallelMap(xs, (k): i32 => {
    const at = "héllo".indexOf("l");
    return at + k;
  });
  const named = parallelMap(xs, step);
  const dst: i32[] = [0, 0, 0];
  parallelMapInto(xs, dst, step);
  const made = parallelFrom(3, (i) => "héllo".length + i);
  console.log(concise[0] + block[1] + named[2] + dst[0] + made[1]);
  const word = "héllo";
  const caught = parallelMap(xs, (k) => word.indexOf("l") + k);
  let text = "plain";
  text = "naïve";
  const now = text;
  const later = parallelMap(xs, (k) => now.length + k);
  console.log(caught[0] + later[1]);
  return 0;
};
