// R7 is transitive: `peek` takes the lock of a `Mutex` the scope's task can
// reach, and calling it between the scope's first `spawn` and its join is
// taking that lock there.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (m: Mutex<Counter>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n + 1;
  return 0;
};

const peek = (m: Mutex<Counter>): i32 => {
  using g = m.lock();
  return g.value.n;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const done: i32[] = [0];
  let seen: i32 = 0;
  {
    using s = scope();
    s.spawn(bump, m, done, 0);
    seen = peek(m);
  }
  return seen;
};
