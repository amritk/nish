// NL2495: an arrow passed to a data-parallel form assigns to a name of the
// function it is written in.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const k: i32 = 3;
  const ys = parallelMap([1, 2], (x): i32 => {
    k = x;
    return x;
  });
  return ys[0];
};
