// #612: a destination bound to a captured array is that array, so it is no
// fresh `const` and the rule does not apply.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3, 4];
  const weights = parallelMap(src, (x) => x * 2);
  const d = weights;
  parallelMapInto(src, d, (x) => weights[x % 4] + 1);
  return d[0];
};
