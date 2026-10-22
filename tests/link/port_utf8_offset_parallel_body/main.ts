// WP33 NL8001 (#629): an offset a data-parallel body answers is stored in the
// array the call fills, so it is reported like any other stored offset. A body
// written inline is reported at the value it answers; a named function handed
// over as the body is reported at the argument, quoting what it answers.
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
  return 0;
};
