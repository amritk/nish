// R3: a guard is never captured. An arrow argument is lifted into a function
// of its own, so naming `g` in it is refused before the lock rules run.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock();
  return apply((x) => g.value.n + x, 1);
};
