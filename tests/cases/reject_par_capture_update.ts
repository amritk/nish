// The same rule once the body has read the capture: `k` is already one of
// the arrow's parameters when `k++` writes it.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const k: i32 = 3;
  const ys = parallelMap([1, 2], (x): i32 => {
    const y = x + k;
    k++;
    return y;
  });
  return ys[0];
};
