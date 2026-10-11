// R6: a task writes shared memory only through a guard. `hits` is the parent's
// array, written here without a lock while the other task writes it too.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Job {
  total: Mutex<Counter>;
  hits: i32[];
  constructor(total: Mutex<Counter>, hits: i32[]) {
    this.total = total;
    this.hits = hits;
  }
}

const count = (job: Job): i32 => {
  {
    using g = job.total.lock();
    g.value.n = g.value.n + 1;
  }
  job.hits[0] = job.hits[0] + 1;
  return 0;
};

export const main = (): i32 => {
  const total = new Mutex<Counter>(new Counter());
  const hits: i32[] = [0];
  const done: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(count, new Job(total, hits), done, 0);
    s.spawn(count, new Job(total, hits), done, 1);
  }
  return hits[0];
};
