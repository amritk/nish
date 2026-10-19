// R3, a guard handed to a helper: a helper with a default parameter beside the guard; Nish has no default parameters, so there is no second, implicit way to call the helper.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const d = (g: MutexGuard<Counter>, n: i32 = 1): void => { g.value.n = n; };
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    d(g);
  }
  return 0;
};
