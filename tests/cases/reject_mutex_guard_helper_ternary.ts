// R3, a guard handed to a helper: the guard reaches the helper through a `?:`: the conditional is a second binding of the guard, which the rule refuses wherever it stands.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (g: MutexGuard<Counter>): void => {
  g.value.n = g.value.n + 1;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    bump(m === m ? g : g);
  }
  return 0;
};
