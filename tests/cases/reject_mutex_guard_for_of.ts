// R3: an array the guard reaches is only the base of an element access, not
// walked: the walk would hold the array, not one element of it.
import { Mutex } from "nish/threads";

class Bins {
  xs: i32[];

  constructor() {
    this.xs = [0, 0];
  }
}

export const main = (): i32 => {
  const m = new Mutex<Bins>(new Bins());
  let total: i32 = 0;
  using g = m.lock();
  for (const x of g.value.xs) {
    total = total + x;
  }
  return total;
};
