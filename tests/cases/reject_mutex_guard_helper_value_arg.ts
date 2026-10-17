// R3, a guard handed to a helper: `r(g, g.value)` hands the guarded object to the helper beside the guard, as a plain parameter the guard's rules do not hold.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const r = (g: MutexGuard<Counter>, c: Counter): void => { c.n = 1; };
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    r(g, g.value);
  }
  return 0;
};
