// R3: a chain read through a guard yields a scalar or is the base of another
// access. `b` would still name the bins after the block, racing a later
// guarded write from another task.
import { Mutex } from "nish/threads";

class Hist {
  bins: i32[];

  constructor() {
    this.bins = [0, 0];
  }
}

export const main = (): i32 => {
  const m = new Mutex<Hist>(new Hist());
  let first: i32 = 0;
  {
    using g = m.lock();
    const b = g.value.bins;
    first = b[0];
  }
  return first;
};
