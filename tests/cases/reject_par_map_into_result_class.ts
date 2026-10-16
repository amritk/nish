// `parallelMapInto` stores no class instance: one would point into the arena
// of the worker that made it, which the join does not copy.
import { parallelMapInto } from "nish/threads";

class Pair {
  a: i32 = 0;
}

export const main = (): i32 => {
  const ps: Pair[] = [new Pair(), new Pair()];
  parallelMapInto([1, 2], ps, (x) => new Pair());
  return ps.length;
};
