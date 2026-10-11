// R7 asks what a task's argument reaches: the `Mutex` is a field of `Job`,
// and the parent locks it after the scope's first `spawn`.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Job {
  total: Mutex<Counter>;

  constructor(total: Mutex<Counter>) {
    this.total = total;
  }
}

const bump = (job: Job): i32 => {
  using g = job.total.lock();
  g.value.n = g.value.n + 1;
  return 0;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const done: i32[] = [0];
  let seen: i32 = 0;
  {
    using s = scope();
    s.spawn(bump, new Job(m), done, 0);
    using g = m.lock();
    seen = g.value.n;
  }
  return seen;
};
