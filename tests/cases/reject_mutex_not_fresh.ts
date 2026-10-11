// R1: `new Mutex` takes a fresh value. `c` is still the program's after the
// lock owns it, so `c.n = 1` would write the data without the lock.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const c = new Counter();
  const m = new Mutex<Counter>(c);
  c.n = 1;
  using g = m.lock();
  return g.value.n;
};
