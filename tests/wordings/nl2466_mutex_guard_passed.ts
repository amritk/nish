// NL2466: a guard is used only as `g.value`. Handed to a function, it could be
// kept past the block that holds the lock.
import { Mutex, MutexGuard } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (g: MutexGuard<Counter>): void => {
  g.value.n = g.value.n + 1;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    bump(g);
  }
  return 0;
};
