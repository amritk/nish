// R3, a guard handed to a helper: a generic helper receives the guard: a generic's body treats `T` as any value.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const touch = <T>(x: T): void => {};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    touch(g);
  }
  return 0;
};
