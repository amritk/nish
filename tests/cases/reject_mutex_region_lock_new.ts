// R7 sees through `new`: `Peek`'s constructor takes the lock the task
// shares, between the scope's first `spawn` and its join, so `p.seen` would
// be 0 natively and 1 under Node.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Peek {
  seen: i32;

  constructor(m: Mutex<Counter>) {
    using g = m.lock();
    this.seen = g.value.n;
  }
}

const bump = (m: Mutex<Counter>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n + 1;
  return 0;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const done: i32[] = [0];
  let seen: i32 = 0;
  {
    using s = scope();
    s.spawn(bump, m, done, 0);
    const p = new Peek(m);
    seen = p.seen;
  }
  return seen;
};
