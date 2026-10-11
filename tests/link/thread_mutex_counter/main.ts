// WP29 P3: four tasks each add 1 to one guarded counter 100,000 times, on four
// threads at once, and the parent reads the total after the join. Every
// increment is a read and a store under the lock, so none is lost: the total
// is 4 * 100000 natively, and under Node, where the tasks run one at a time.
// The second number is the tasks' own count of the increments they made, so
// the line prints two equal numbers exactly when the lock lost none.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Job {
  times: i32;
  total: Mutex<Counter>;

  constructor(times: i32, total: Mutex<Counter>) {
    this.times = times;
    this.total = total;
  }
}

const addMany = (job: Job): i32 => {
  for (let k: i32 = 0; k < job.times; k++) {
    using g = job.total.lock();
    g.value.n = g.value.n + 1;
  }
  return job.times;
};

export const main = (): i32 => {
  const total = new Mutex<Counter>(new Counter());
  const done: i32[] = [0, 0, 0, 0];
  {
    using s = scope();
    for (let t: i32 = 0; t < 4; t++) {
      s.spawn(addMany, new Job(100000, total), done, t);
    }
  }
  using g = total.lock();
  console.log(`${g.value.n} ${done[0] + done[1] + done[2] + done[3]}`);
  return 0;
};
