// R3, a guard handed to a helper: the helper is reached through a `?:` of two functions, a function reference, and the guard's rule follows only a function named at the call, so neither may be named as a value.
import { Mutex, MutexGuard } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bumpA = (g: MutexGuard<Counter>): void => {
  g.value.n = g.value.n + 1;
};

const bumpB = (g: MutexGuard<Counter>): void => {
  g.value.n = g.value.n + 2;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const k: i32 = m.lock().value.n;
  {
    using g = m.lock();
    (k > 1 ? bumpA : bumpB)(g);
  }
  return 0;
};
