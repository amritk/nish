// R1: fresh all the way down. `new Hist(bins)` is a fresh object, but `bins`
// is still the program's, so `bins[0] = 9` would write the data without the lock.
import { Mutex } from "nish/threads";

class Hist {
  bins: i32[];

  constructor(bins: i32[]) {
    this.bins = bins;
  }
}

export const main = (): i32 => {
  const bins: i32[] = [0, 0];
  const m = new Mutex<Hist>(new Hist(bins));
  bins[0] = 9;
  using g = m.lock();
  return g.value.bins[0];
};
