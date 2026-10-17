// R5, a guard handed to a helper: the helper takes a second Mutex as a parameter and locks it while the caller's guard holds the first.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const r = (g: MutexGuard<Counter>, o: Mutex<Counter>): void => { using h = o.lock(); h.value.n = g.value.n; };
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const m2 = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    r(g, m2);
  }
  return 0;
};
