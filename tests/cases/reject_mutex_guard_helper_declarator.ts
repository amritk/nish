// R3, a guard handed to a helper: the guard is one declarator of a `using` statement whose next declarator opens a scope: every declarator is held to the guard's block.
import { Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (g: MutexGuard<Counter>): void => {
  g.value.n = g.value.n + 1;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock(), s = scope();
    bump(g);
  }
  return 0;
};
