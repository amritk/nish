// R3, a guard handed to a helper: the helper stores the guard into a Map it was given: `set` is a method.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const keep = (g: MutexGuard<Counter>, kept: Map<string, MutexGuard<Counter>>): void => {
  kept.set("k", g);
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    keep(g, new Map<string, MutexGuard<Counter>>());
  }
  return 0;
};
