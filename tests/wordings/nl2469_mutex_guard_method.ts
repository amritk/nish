// NL2469: no method is called through a guard. `push` can move the array's storage
// into the arena of the task that holds the lock, which is freed at the join.
import { Mutex } from "nish/threads";

class Bins {
  xs: i32[];

  constructor() {
    this.xs = [0, 0];
  }
}

export const main = (): i32 => {
  const m = new Mutex<Bins>(new Bins());
  {
    using g = m.lock();
    g.value.xs.push(1);
  }
  return 0;
};
