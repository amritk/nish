// NL2470: one lock is held at a time. A second `lock()` inside a guard's block is
// how two tasks taking the same two locks in opposite orders deadlock.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const a = new Mutex<Counter>(new Counter());
  const b = new Mutex<Counter>(new Counter());
  {
    using ga = a.lock();
    using gb = b.lock();
    ga.value.n = gb.value.n;
  }
  return 0;
};
