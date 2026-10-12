// Probe: the smallest Mutex program, for the lock and unlock lowering.
import { Mutex, scope } from "nish/threads";

class Job {
  m: Mutex<i32>;
  constructor(m: Mutex<i32>) {
    this.m = m;
  }
}

const bump = (j: Job): i32 => {
  using g = j.m.lock();
  g.value = g.value + 1;
  return 0;
};

export const main = (): i32 => {
  const m = new Mutex<i32>(0);
  const done: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(bump, new Job(m), done, 0);
    s.spawn(bump, new Job(m), done, 1);
  }
  using g = m.lock();
  console.log(`${g.value}`);
  return 0;
};
