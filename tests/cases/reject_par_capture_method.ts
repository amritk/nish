// A method of the captured object that writes `this` writes the capture.
import { parallelFrom, parallelMap, parallelMapInto, parallelReduce } from "nish/threads";

class Counter {
  n: i32 = 0;
  bump(v: i32): i32 {
    this.n = this.n + v;
    return this.n;
  }
}

export const main = (): i32 => {
  const c = new Counter();
  const ys = parallelMap([1, 2], (x) => c.bump(x));
  return ys[0];
};
