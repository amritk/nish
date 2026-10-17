// R3, a guard handed to a helper: the same guard is passed twice to one call: the helper would hold two names for one lock.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const two = (a: MutexGuard<Counter>, b: MutexGuard<Counter>): void => {
  a.value.n = b.value.n + 1;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    two(g, g);
  }
  return 0;
};
