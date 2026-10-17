// R3, a guard handed to a helper: the helper's parameter is `MutexGuard<Counter> | null`, not the guard's own type: a nullable slot can be stored and compared, which the guard's rules do not follow.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const bump = (g: MutexGuard<Counter> | null): void => {};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    bump(g);
  }
  return 0;
};
