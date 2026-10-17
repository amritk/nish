// R3, a guard handed to a helper: the helper takes a function and calls it with the guard, `each(f, g)` calling `f(g)`; a function-typed parameter makes `each` a generic, so the guard may not reach it.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const each = (f: (h: MutexGuard<Counter>) => void, g: MutexGuard<Counter>): void => {
  f(g);
};
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    each((h: MutexGuard<Counter>): void => { h.value.n = 1; }, g);
  }
  return 0;
};
