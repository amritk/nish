// R3: an array the guard reaches is not stored anywhere: `h.xs` would be a
// second, unguarded path to the bins.
import { Mutex } from "nish/threads";

class Bins {
  xs: i32[];

  constructor() {
    this.xs = [0, 0];
  }
}

export const main = (): i32 => {
  const m = new Mutex<Bins>(new Bins());
  const h = new Bins();
  {
    using g = m.lock();
    h.xs = g.value.xs;
  }
  return h.xs[0];
};
