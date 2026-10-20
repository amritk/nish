// NL2536: the helper the remedy writes reads what a generic callee reads
// through the guard, `total` here, from the instantiation's own body, not
// the first field the data holds.
import { Mutex, MutexGuard } from "nish/threads";

class Counter {
  n: i32 = 0;
  total: f64 = 1.5;
}

class Other {
  label: string = "x";
}

const helper = <T>(o: Other, p: MutexGuard<Counter>, t: T): void => {
  console.log(o.label);
  console.log(p.value.total);
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    helper(new Other(), g, 1);
  }
  return 0;
};
