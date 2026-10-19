// R3, a guard handed to a helper: a destructured guard parameter would bind `value` to a name of its own; Nish has no destructured parameters.
import { Channel, Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const r = ({ value }: MutexGuard<Counter>): void => { value.n = 1; };
export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    r(g);
  }
  return 0;
};
