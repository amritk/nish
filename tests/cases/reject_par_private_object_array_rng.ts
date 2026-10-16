// A body's own array holding the captured `Rng`: `rs[0].nextI32()` steps
// `shared`, which every element steps at once.
import { parallelFrom, parallelMapInto, scope } from "nish/threads";
import { Rng } from "nish/random";

export const main = (): i32 => {
  const shared = new Rng(7);
  const xs = parallelFrom(4, (i: i32): i32 => {
    const rs: Rng[] = [shared];
    return rs[0].nextI32() + i;
  });
  return xs[0];
};
