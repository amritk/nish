// R5: the rule holds through calls: `add` takes a lock of its own, which would
// be a second lock while `g` holds the first.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const add = (m: Mutex<Counter>, k: i32): void => {
  using g = m.lock();
  g.value.n = g.value.n + k;
};

export const main = (): i32 => {
  const a = new Mutex<Counter>(new Counter());
  const b = new Mutex<Counter>(new Counter());
  {
    using g = a.lock();
    add(b, g.value.n);
  }
  return 0;
};
