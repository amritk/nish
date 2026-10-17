// R3, a guard handed to a helper: the helper is reached through a `?:` alias of two functions: a function is never a value, so the call names no function the guard's rule could follow.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

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
  {
    using g = m.lock();
    (m === m ? bumpA : bumpB)(g);
  }
  return 0;
};
