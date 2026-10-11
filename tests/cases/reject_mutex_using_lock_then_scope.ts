// R5 across declarators: `s = scope()` is opened while `g` holds its lock, and
// a scope's block waits for its tasks, which may want that lock.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock(), s = scope();
  return g.value.n;
};
