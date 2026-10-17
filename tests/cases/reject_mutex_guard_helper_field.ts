// R3, a guard handed to a helper: the helper stores the guard into a field of an object it was given: the object outlives the block, and with it the guard.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Holder {
  g: MutexGuard<Counter> | null = null;
}

const keep = (g: MutexGuard<Counter>, h: Holder): void => {
  h.g = g;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    keep(g, new Holder());
  }
  return 0;
};
