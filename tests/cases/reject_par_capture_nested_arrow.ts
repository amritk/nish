// Only an arrow written directly in a function's body captures: one inside
// another arrow is refused, whatever it reads from outside.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const k: i32 = 3;
  const xs: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x) => parallelMap(xs, (y) => y + k)[0]);
  return ys[0];
};
