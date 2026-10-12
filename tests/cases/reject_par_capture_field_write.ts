// A captured object is read-only too: a store into one of its fields.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

class Tally {
  count: i32 = 0;
}

export const main = (): i32 => {
  const t = new Tally();
  const ys = parallelMap([1, 2], (x): i32 => {
    t.count = x;
    return x;
  });
  return ys[0] + t.count;
};
