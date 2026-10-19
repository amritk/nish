// R3, a guard handed to a helper: the helper pushes the guard onto an array it was given: `push` is a method, and a method could keep what it is handed.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const keep = (g: MutexGuard<Counter>, kept: MutexGuard<Counter>[]): void => {
  kept.push(g);
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    keep(g, []);
  }
  return 0;
};
