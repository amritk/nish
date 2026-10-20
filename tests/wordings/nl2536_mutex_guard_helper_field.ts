// NL2536: the helper the remedy writes reads what the refused callee reads
// through the guard, `total` here, not the first field the data holds.
import { Mutex, MutexGuard } from "nish/threads";

class Counter {
  n: i32 = 0;
  total: f64 = 1.5;
}

class Report {
  shown: f64 = 0;

  show(p: MutexGuard<Counter>): void {
    this.shown = p.value.total;
  }
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    new Report().show(g);
  }
  return 0;
};
