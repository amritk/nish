// An array literal of the body's own that holds the capture is a path to it.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const t: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x): i32 => {
    const w = [t];
    w[0][0] = x;
    return x;
  });
  return ys[0];
};
