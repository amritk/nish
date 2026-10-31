// R3, a guard handed to a helper: a guard parameter whose default is the guard before it would be a second name for the one lock; a default is a number, a boolean, a string or an enum member, so a guard has none.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const d = (g: MutexGuard<Counter>, h: MutexGuard<Counter> = g): void => { h.value.n = 1; };
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    d(g);
  }
  return 0;
};
