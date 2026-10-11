// R5: nothing is waited on while a lock is held. A scope's join waits for its
// tasks, and one of them may want the lock this block holds.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const one = (n: i32): i32 => n + 1;

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const out: i32[] = [0];
  {
    using g = m.lock();
    {
      using s = scope();
      s.spawn(one, g.value.n, out, 0);
    }
  }
  return out[0];
};
