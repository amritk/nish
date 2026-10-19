// R3, a guard handed to a helper: a rest parameter would gather guards into an array; Nish has no rest parameters.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const r = (...gs: MutexGuard<Counter>[]): void => { };
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    r(g);
  }
  return 0;
};
