// A `let` could change between the call and a thread's read of it, so the
// body may not read one: bind the value to a `const` first.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  let m: i32 = 3;
  m = m + 1;
  const ys = parallelMap([1, 2], (x) => x * m);
  return ys[0];
};
