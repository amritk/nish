// R3: a guard is never captured, not even by an arrow passed to a
// data-parallel form, which may read its function's `const` locals.
import { Mutex, parallelMap } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock();
  const ys = parallelMap([1, 2], (x) => g.value.n + x);
  return ys[0];
};
