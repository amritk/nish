// R3, a guard handed to a helper: the helper opens a scope while the caller holds the lock: R5 follows the call.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const work = (g: MutexGuard<Counter>): void => {
  using s = scope();
  g.value.n = 1;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    work(g);
  }
  return 0;
};
