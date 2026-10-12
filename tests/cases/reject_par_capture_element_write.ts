// A captured array is read-only: a store into one of its elements is a write
// every thread could make to the same slot.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

export const main = (): i32 => {
  const seen: i32[] = [0, 0];
  const ys = parallelMap([0, 1], (x): i32 => {
    seen[x] = 1;
    return x;
  });
  return ys[0] + seen[0];
};
