// NL2536: a constructor reached by `new` is a call too, so the helper the
// remedy writes reads what the constructor reads through the guard, `total`
// here, not the first field the data holds.
import { Mutex, MutexGuard } from "nish/threads";

class Counter {
  n: i32 = 0;
  total: f64 = 1.5;
}

class Other {
  label: string = "x";
}

class Report {
  shown: f64 = 0;

  constructor(o: Other, p: MutexGuard<Counter>) {
    console.log(o.label);
    this.shown = p.value.total;
  }
}

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  {
    using g = m.lock();
    new Report(new Other(), g);
  }
  return 0;
};
