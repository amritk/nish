// Probe: N tasks each take one Mutex M times. argv: tasks iters inner outer.
// `inner` is busy work done while holding the lock (long critical section,
// waiters go to sleep); `outer` is busy work between acquisitions.
import { Mutex, scope } from "nish/threads";

class Tally {
  n: i32 = 0;
  sum: i32 = 0;
}

class Job {
  id: i32;
  iters: i32;
  inner: i32;
  outer: i32;
  count: Mutex<i32>;
  tally: Mutex<Tally>;

  constructor(id: i32, iters: i32, inner: i32, outer: i32, count: Mutex<i32>, tally: Mutex<Tally>) {
    this.id = id;
    this.iters = iters;
    this.inner = inner;
    this.outer = outer;
    this.count = count;
    this.tally = tally;
  }
}

const spin = (seed: i32, n: i32): i32 => {
  let v: i32 = seed;
  for (let i: i32 = 0; i < n; i++) {
    v = (v * 75 + 74) % 65537;
  }
  return v;
};

const work = (j: Job): i32 => {
  let v: i32 = j.id + 1;
  for (let k: i32 = 0; k < j.iters; k++) {
    {
      using g = j.count.lock();
      g.value = g.value + 1;
    }
    if (j.outer > 0) {
      v = spin(v, j.outer);
    }
    using h = j.tally.lock();
    h.value.n = h.value.n + 1;
    if (j.inner > 0) {
      v = spin(v + h.value.n % 7, j.inner);
    }
    h.value.sum = (h.value.sum + (v & 1023)) % 1000003;
  }
  return v & 1;
};

export const main = (): i32 => {
  const tasks: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 8;
  const iters: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 10000;
  const inner: i32 = process.argv.length > 3 ? parseInt(process.argv[3]) : 0;
  const outer: i32 = process.argv.length > 4 ? parseInt(process.argv[4]) : 0;
  const count = new Mutex<i32>(0);
  const tally = new Mutex<Tally>(new Tally());
  const done: i32[] = new Array<i32>(64);
  {
    using s = scope();
    for (let t: i32 = 0; t < tasks; t++) {
      s.spawn(work, new Job(t, iters, inner, outer, count, tally), done, t);
    }
  }
  let c: i32 = 0;
  {
    using g = count.lock();
    c = g.value;
  }
  using h = tally.lock();
  const want: i32 = tasks * iters;
  const ok = c === want && h.value.n === want;
  console.log(`${ok ? "OK" : "BAD"} count=${c} n=${h.value.n} want=${want}`);
  return ok ? 0 : 1;
};
