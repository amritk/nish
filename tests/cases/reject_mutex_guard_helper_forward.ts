// R3, a guard handed to a helper: the helper passes the guard on to a function that escapes it: the second call is judged by the same rule, and `stash` binds it.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const stash = (g: MutexGuard<Counter>): void => {
  const h = g;
};

const pass = (g: MutexGuard<Counter>): void => {
  stash(g);
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    pass(g);
  }
  return 0;
};
