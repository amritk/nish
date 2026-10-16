// `parallelFrom` hands back no class instance: one would point into the arena
// of the worker that made it, which the join does not copy.
import { parallelFrom } from "nish/threads";

class Pair {
  a: i32 = 0;
}

export const main = (): i32 => {
  const ps = parallelFrom(2, (i) => new Pair());
  return ps.length;
};
