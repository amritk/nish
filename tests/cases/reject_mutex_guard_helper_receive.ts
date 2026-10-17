// R3, a guard handed to a helper: the helper receives from a channel while the caller holds the lock: a receive waits for another thread, and R5 follows the call.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const drain = (g: MutexGuard<Counter>, ch: Channel<i32>): void => {
  for (const v of ch) {
    g.value.n = g.value.n + v;
  }
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const ch = new Channel<i32>();
  {
    using g = m.lock();
    drain(g, ch);
  }
  return 0;
};
