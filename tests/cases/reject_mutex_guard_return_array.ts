// R3: neither is an array the guard reaches: `g.value.xs` returned would be
// written by the caller with no lock held.
import { Mutex } from "nish/threads";

class Bins {
  xs: i32[];

  constructor() {
    this.xs = [0, 0];
  }
}

const take = (m: Mutex<Bins>): i32[] => {
  using g = m.lock();
  return g.value.xs;
};

export const main = (): i32 => {
  const m = new Mutex<Bins>(new Bins());
  return take(m)[0];
};
