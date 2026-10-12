// NL2494: an arrow passed to a data-parallel form reads `this`.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

class Scaler {
  k: i32 = 2;
  run(xs: i32[]): i32[] {
    return parallelMap(xs, (x) => x * this.k);
  }
}

export const main = (): i32 => new Scaler().run([1, 2])[0];
