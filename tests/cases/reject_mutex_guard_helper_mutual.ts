// R3, a guard handed to a helper: two helpers that call each other, one of which binds the guard to a second name; the walk follows the cycle and the binding is refused.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const a = (g: MutexGuard<Counter>, n: i32): void => {
  if (n > 0) { b(g, n - 1); }
};
const b = (g: MutexGuard<Counter>, n: i32): void => {
  if (n === 1) { const h = g; }
  a(g, n);
};
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    a(g, 3);
  }
  return 0;
};
