// R5: one lock at a time, across the declarators of one `using` too. `h`
// asks for the lock `g` already holds, and would wait on itself for ever.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock(), h = m.lock();
  return g.value.n + h.value.n;
};
