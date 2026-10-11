// NL2464: a `Mutex` has no member a program may name but `lock`: its guard,
// reached as a field, would be a path to the data that skips the lock.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  m.guard.value.n = 1;
  return 0;
};
