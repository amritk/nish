// R5 sees through `new`: `Peek`'s constructor takes the lock `g` holds,
// so the program would wait on itself.
import { Mutex } from "nish/threads";

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

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock();
  const p = new Peek(m);
  return p.seen + g.value.n;
};
