// NL2492: an arrow passed to a data-parallel form reads a `let` of the function
// it is written in, which could change while the threads read it.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  let m: i32 = 3;
  m = m + 1;
  const ys = parallelMap([1, 2], (x) => x * m);
  return ys[0];
};
