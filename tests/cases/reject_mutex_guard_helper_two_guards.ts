// R3, a guard handed to a helper: two guards of the same mutex, one passed beside the other: the second `lock()` waits for the first, so R5 refuses it before either reaches the helper.
import { Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const two = (a: MutexGuard<Counter>, b: MutexGuard<Counter>): void => {
  a.value.n = b.value.n + 1;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock(), h = m.lock();
    two(g, h);
  }
  return 0;
};
