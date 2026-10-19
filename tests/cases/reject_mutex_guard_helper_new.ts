// R3, a guard handed to a helper: a constructor receives the guard via `new`: a constructor is a call, and `this` leaves it.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Box {
  n: i32;

  constructor(g: MutexGuard<Counter>) {
    this.n = g.value.n;
  }
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    new Box(g);
  }
  return 0;
};
