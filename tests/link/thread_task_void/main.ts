// WP29: `s.spawn(entry, arg)` runs a task that answers `void`, with nothing to
// store when the scope joins, and so needs no destination. Its argument may
// carry a `Mutex`, which is how a task with no answer is seen at all, or a
// `Channel` it sends on, whose sender the scope counts as it does for a task
// with a destination. The four-argument form beside it still stores its
// answer. Under Node each task runs at its spawn, the producers before the one
// consumer, and every update commutes, so both print the same.
import { Channel, Mutex, scope } from "nish/threads";

class Tally {
  total: i32 = 0;
}

class Job {
  xs: i32[];
  tally: Mutex<Tally>;

  constructor(xs: i32[], tally: Mutex<Tally>) {
    this.xs = xs;
    this.tally = tally;
  }
}

class Pipe {
  ch: Channel<i32>;
  n: i32;

  constructor(ch: Channel<i32>, n: i32) {
    this.ch = ch;
    this.n = n;
  }
}

const addAll = (job: Job): void => {
  let t: i32 = 0;
  for (const x of job.xs) {
    t = t + x;
  }
  using g = job.tally.lock();
  g.value.total = g.value.total + t;
};

const produce = (p: Pipe): void => {
  for (let i: i32 = 1; i <= p.n; i++) {
    p.ch.send(i);
  }
};

const consume = (p: Pipe): i32 => {
  let t: i32 = 0;
  for (const x of p.ch) {
    t = t + x;
  }
  return t;
};

export const main = (): i32 => {
  const tally = new Mutex<Tally>(new Tally());
  const ch = new Channel<i32>();
  const sums: i32[] = [0];
  {
    using s = scope();
    s.spawn(addAll, new Job([1, 2, 3], tally));
    s.spawn(addAll, new Job([40, 50], tally));
    s.spawn(produce, new Pipe(ch, 10));
    s.spawn(produce, new Pipe(ch, 4));
    s.spawn(consume, new Pipe(ch, 0), sums, 0);
  }
  using g = tally.lock();
  console.log(`${g.value.total} ${sums[0]}`);
  return 0;
};
