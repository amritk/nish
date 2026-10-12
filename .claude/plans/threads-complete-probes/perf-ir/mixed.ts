// Probe: two mutexes taken one after another in a fixed order, a guard
// released by an early `return`, by a `break`, and by a `continue`, all
// contended by N tasks. Every total must be exact.
import { Mutex, scope } from "nish/threads";

class Pair {
  a: i32 = 0;
  b: i32 = 0;
}

class Job {
  iters: i32;
  first: Mutex<Pair>;
  second: Mutex<i32>;
  third: Mutex<i32>;

  constructor(iters: i32, first: Mutex<Pair>, second: Mutex<i32>, third: Mutex<i32>) {
    this.iters = iters;
    this.first = first;
    this.second = second;
    this.third = third;
  }
}

/** Adds 1 under the guard and returns from inside its block when `k` is odd. */
const bumpOrReturn = (m: Mutex<i32>, k: i32): i32 => {
  using g = m.lock();
  g.value = g.value + 1;
  if ((k & 1) === 1) {
    return g.value & 1;
  }
  return 0;
};

/** Takes the lock on every pass; `continue` on odd, `break` at 10: 6 increments (0,2,4,6,8,10). */
const loopExits = (m: Mutex<i32>): i32 => {
  for (let i: i32 = 0; i < 100; i++) {
    using g = m.lock();
    if ((i & 1) === 1) {
      continue;
    }
    g.value = g.value + 1;
    if (i === 10) {
      break;
    }
  }
  return 0;
};

const work = (j: Job): i32 => {
  let r: i32 = 0;
  for (let k: i32 = 0; k < j.iters; k++) {
    {
      using g = j.first.lock();
      g.value.a = g.value.a + 1;
    }
    {
      using h = j.second.lock();
      h.value = h.value + 2;
    }
    {
      using g = j.first.lock();
      g.value.b = g.value.b + 3;
    }
    r = r + bumpOrReturn(j.third, k);
    if ((k & 15) === 0) {
      r = r + loopExits(j.second);
    }
  }
  return r & 1;
};

export const main = (): i32 => {
  const tasks: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : 8;
  const iters: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 5000;
  const first = new Mutex<Pair>(new Pair());
  const second = new Mutex<i32>(0);
  const third = new Mutex<i32>(0);
  const done: i32[] = new Array<i32>(64);
  {
    using s = scope();
    for (let t: i32 = 0; t < tasks; t++) {
      s.spawn(work, new Job(iters, first, second, third), done, t);
    }
  }
  const total: i32 = tasks * iters;
  const loops: i32 = tasks * ((iters + 15) / 16 | 0);
  let a: i32 = 0;
  let b: i32 = 0;
  let c: i32 = 0;
  let d: i32 = 0;
  {
    using g = first.lock();
    a = g.value.a;
    b = g.value.b;
  }
  {
    using h = second.lock();
    c = h.value;
  }
  {
    using h = third.lock();
    d = h.value;
  }
  const ok = a === total && b === 3 * total && c === 2 * total + 6 * loops && d === total;
  console.log(`${ok ? "OK" : "BAD"} a=${a} b=${b} c=${c} d=${d} total=${total} loops=${loops}`);
  return ok ? 0 : 1;
};
