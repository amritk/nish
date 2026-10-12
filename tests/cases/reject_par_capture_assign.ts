// A captured binding is read by every thread at once, so the body may not
// assign to it: the first mention of `k` here is the assignment.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const k: i32 = 3;
  const ys = parallelMap([1, 2], (x): i32 => {
    k = x;
    return x;
  });
  return ys[0];
};
