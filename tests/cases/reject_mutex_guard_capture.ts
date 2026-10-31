// R3: a guard is never captured. An arrow argument may read its function's
// `const` locals, but not one whose type holds a guard, a lock, a channel or a
// scope, since its callee may hand it on to a `spawn`.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock();
  return apply((x) => g.value.n + x, 1);
};
