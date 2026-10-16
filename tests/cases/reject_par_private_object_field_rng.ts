// A body's own object holding the captured `Rng` steps the shared generator:
// `h.r.nextI32()` writes `shared`, which every element steps at once.
import { parallelFrom, parallelMapInto } from "nish/threads";
import { Rng } from "nish/random";

class HR {
  r: Rng;

  constructor(r: Rng) {
    this.r = r;
  }
}

export const main = (): i32 => {
  const shared = new Rng(7);
  const xs = parallelFrom(4, (i: i32): i32 => {
    const h = new HR(new Rng(i));
    h.r = shared;
    return h.r.nextI32();
  });
  return xs[0];
};
