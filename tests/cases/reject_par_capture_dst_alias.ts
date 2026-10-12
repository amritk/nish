// A second `const` bound to `dst` is `dst`: only a capture bound to an
// array of its own is known not to be it.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const dst: i32[] = [0, 0];
  const t = dst;
  parallelMapInto([1, 2], dst, (x) => t[0] + x);
  return dst[0];
};
