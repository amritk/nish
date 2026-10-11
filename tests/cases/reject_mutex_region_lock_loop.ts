// R7's window starts at the statement that holds the first `spawn`, as P2's
// rule does. The lock comes before the spawn in the loop's body, but on the
// second pass the first pass's task has been filed: natively it has not run,
// and under Node it has.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (m: Mutex<Counter>): i32 => {
  using g = m.lock();
  g.value.n = g.value.n + 1;
  return 0;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const seen: i32[] = [0, 0];
  const done: i32[] = [0, 0];
  {
    using s = scope();
    for (let t: i32 = 0; t < 2; t++) {
      {
        using g = m.lock();
        g.value.n = g.value.n + 10;
      }
      s.spawn(bump, m, done, t);
    }
  }
  return seen[0];
};
