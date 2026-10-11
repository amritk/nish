// R3: `g.value` is not returned: the caller would hold the data after the
// block that holds the lock has ended.
import { Mutex } from "nish/threads";

class Bins {
  xs: i32[];

  constructor() {
    this.xs = [0, 0];
  }
}

const take = (m: Mutex<Bins>): Bins => {
  using g = m.lock();
  return g.value;
};

export const main = (): i32 => {
  const m = new Mutex<Bins>(new Bins());
  return take(m).xs[0];
};
