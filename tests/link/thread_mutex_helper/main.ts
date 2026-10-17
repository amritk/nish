// R3's helper rule: a guard is handed to a function of its own, which reads
// and stores through it as the block that holds the lock would. Four tasks
// each take the lock 1,000 times and call `record`, which calls `bump` and
// `tally` with the same guard: a field, a string field and an array element
// are written under the lock, so the parent reads 4000, the last writer's
// mark, and a histogram whose cells sum to 4000, natively at every pool size
// and under Node.
import { Mutex, MutexGuard, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
  mark: string = "";
  cells: i32[];

  constructor() {
    this.cells = [0, 0, 0, 0];
  }
}

class Job {
  id: i32;
  total: Mutex<Counter>;

  constructor(id: i32, total: Mutex<Counter>) {
    this.id = id;
    this.total = total;
  }
}

const bump = (g: MutexGuard<Counter>): void => {
  g.value.n = g.value.n + 1;
};

const tally = (g: MutexGuard<Counter>, cell: i32): void => {
  g.value.cells[cell] = g.value.cells[cell] + 1;
  g.value.mark = "set";
};

const record = (g: MutexGuard<Counter>, cell: i32): void => {
  bump(g);
  tally(g, cell);
};

const work = (job: Job): i32 => {
  for (let k: i32 = 0; k < 1000; k++) {
    using g = job.total.lock();
    record(g, job.id);
  }
  return job.id;
};

export const main = (): i32 => {
  const total = new Mutex<Counter>(new Counter());
  const done: i32[] = [0, 0, 0, 0];
  {
    using s = scope();
    for (let t: i32 = 0; t < 4; t++) {
      s.spawn(work, new Job(t, total), done, t);
    }
  }
  using g = total.lock();
  const cells = g.value.cells[0] + g.value.cells[1] + g.value.cells[2] + g.value.cells[3];
  console.log(`${g.value.n} ${g.value.mark} ${cells} ${done[0] + done[1] + done[2] + done[3]}`);
  return 0;
};
