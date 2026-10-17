// NL2466: a guard is used only as `g.value`, or handed to a helper whose
// parameter is a `MutexGuard<T>`. Stored in a field, it could be kept past the
// block that holds the lock.
import { Mutex, MutexGuard } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Box {
  g: MutexGuard<Counter> | null = null;
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const box = new Box();
  {
    using g = m.lock();
    box.g = g;
  }
  return 0;
};
