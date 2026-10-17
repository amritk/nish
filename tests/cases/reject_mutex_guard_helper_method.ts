// R3, a guard handed to a helper: a method receives the guard: `this` is a second way out of a method that the parameter's rule does not cover.
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
