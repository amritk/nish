// R3, a guard handed to a helper: the helper returns the guard: the caller could bind it past the block.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const keep = (g: MutexGuard<Counter>): MutexGuard<Counter> => {
  return g;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    keep(g);
  }
  return 0;
};
