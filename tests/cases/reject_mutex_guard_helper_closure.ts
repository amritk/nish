// R3, a guard handed to a helper: the helper closes an arrow over the guard: a function is never a value, and the arrow would carry the guard out with it.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const keep = (g: MutexGuard<Counter>): void => {
  const f = (): i32 => g.value.n;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    keep(g);
  }
  return 0;
};
