// NL2465: `lock()` is only the initialiser of a `using` declaration; a guard bound
// by `const` is one no block end releases.
import { Mutex } from "nish/threads";

class Counter {
  n: i32 = 0;
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const g = m.lock();
  return 0;
};
