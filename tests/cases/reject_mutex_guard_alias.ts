// R3: what a guard reaches is only the base of a field or element access. `c`
// would hold the data after the block that holds the lock has ended.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  let n: i32 = 0;
  {
    using g = m.lock();
    const c = g.value;
    n = c.n;
  }
  return n;
};
