// `parallelMap` hands back only scalars, as `parallelMapInto` does: a class
// result would point into the arena of the worker that made it.
import { parallelMap } from "nish/threads";

class Pair {
  a: i32 = 0;
}

export const main = (): i32 => {
  const ps = parallelMap([1, 2], (x) => new Pair());
  return ps.length;
};
