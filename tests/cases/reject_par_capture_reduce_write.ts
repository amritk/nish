// The rule holds for `parallelReduce`'s operator too.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const last: i32[] = [0];
  return parallelReduce(
    [1, 2],
    (a, b): i32 => {
      last[0] = b;
      return a + b;
    },
    0
  );
};
