// NL2472: after a scope's first `spawn` the parent does not lock what its tasks
// share. Natively the task has not run here and under Node it has, so `seen`
// would be 0 compiled and 1 under Node.
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
  const done: i32[] = [0];
  let seen: i32 = 0;
  {
    using s = scope();
    s.spawn(bump, m, done, 0);
    {
      using g = m.lock();
      seen = g.value.n;
    }
  }
  return seen;
};
