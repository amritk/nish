// R5: `parallelReduce` waits for its threads too, so it is not called while
// a lock is held.
import { Mutex, parallelMapInto, parallelReduce, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const src: i32[] = [1, 2];
  using g = m.lock();
  return parallelReduce(src, (a, b) => a + b, 0) + g.value.n;
};
