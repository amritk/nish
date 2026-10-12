// NL2501: an arrow inside an arrow reads a name from outside both; only an
// arrow written directly in a function's body captures.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const k: i32 = 3;
  const xs: i32[] = [1, 2];
  const ys = parallelMap([1, 2], (x) => parallelMap(xs, (y) => y + k)[0]);
  return ys[0];
};
