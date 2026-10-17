// NL2522: a guard is handed only to a function named at the call, which a
// method is not: `this` is a second way out that the parameter's rule does not cover.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Box {
  n: i32 = 0;

  take(g: MutexGuard<Counter>): void {
    this.n = g.value.n;
  }
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    new Box().take(g);
  }
  return 0;
};
