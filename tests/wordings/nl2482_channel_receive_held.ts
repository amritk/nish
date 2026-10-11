// NL2482, C7: nothing receives while a lock is held, here through a constructor, which
// a `new` calls: a receive waits, and the lock's holder must not.
import { Channel, Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const one = (n: i32): i32 => n + 1;

const settle = (): i32 => {
  const out: i32[] = [0];
  const ch = new Channel<i32>();
  {
    using s = scope();
    s.spawn(one, 1, out, 0);
  }
  let sum: i32 = 0;
  for (const x of ch) {
    sum = sum + x;
  }
  return sum + out[0];
};

class Tally {
  total: i32;

  constructor() {
    this.total = settle();
  }
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock();
  const t = new Tally();
  g.value.n = t.total;
  return g.value.n;
};
