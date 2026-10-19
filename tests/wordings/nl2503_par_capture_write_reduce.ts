// NL2503: the reducer passed to `parallelReduce` assigns to a name of the
// function it is written in.
import { parallelReduce } from "nish/threads";

export const main = (): i32 => {
  let calls: i32 = 0;
  const total = parallelReduce([1, 2, 3], (a: i32, b: i32): i32 => {
    calls += 1;
    return a + b;
  }, 0);
  return total + calls;
};
