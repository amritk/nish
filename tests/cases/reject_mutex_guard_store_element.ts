// R3: nor stored into an element: `all[0]` would outlive the lock.
import { Mutex } from "nish/threads";

class Bins {
  xs: i32[];

  constructor() {
    this.xs = [0, 0];
  }
}

export const main = (): i32 => {
  const m = new Mutex<Bins>(new Bins());
  const all: i32[][] = [[1]];
  {
    using g = m.lock();
    all[0] = g.value.xs;
  }
  return all[0][0];
};
