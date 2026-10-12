// A body may not run a data-parallel form of its own: the inner region is
// started from every element at once.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const ys = parallelMap(xs, (x) => parallelMap([4, 5], (y) => y)[0] + x);
  return ys[2];
};
