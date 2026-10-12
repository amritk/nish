// Binding the capture to a local of the body names the same array, so the
// store through the local is the store through the capture.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const t: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x): i32 => {
    const u = t;
    u[0] = x;
    return x;
  });
  return ys[0];
};
