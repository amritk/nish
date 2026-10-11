// R5 holds through calls: `both` opens a scope, whose block waits for its
// tasks, and a task may want the lock `g` holds.
import { Mutex, parallelMapInto, parallelReduce, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const one = (n: i32): i32 => n + 1;

const both = (n: i32): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(one, n, out, 0);
  }
  return out[0];
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock();
  return both(g.value.n);
};
