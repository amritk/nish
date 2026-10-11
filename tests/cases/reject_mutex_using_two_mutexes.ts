// R5: two locks in one `using` are two locks held at once. Two tasks that
// wrote `a, b` and `b, a` would each wait for the other's.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const a = new Mutex<Counter>(new Counter());
  const b = new Mutex<Counter>(new Counter());
  using g = a.lock(), h = b.lock();
  return g.value.n + h.value.n;
};
