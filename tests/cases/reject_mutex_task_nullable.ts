// R8: the argument is the class that carries the `Mutex`, not a nullable one.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Job {
  m: Mutex<Counter>;

  constructor(m: Mutex<Counter>) {
    this.m = m;
  }
}

const maybe = (j: Job | null): i32 => {
  if (j !== null) {
    using g = j.m.lock();
    g.value.n = g.value.n + 1;
  }
  return 0;
};

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const j: Job | null = new Job(m);
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(maybe, j, done, 0);
  }
  return done[0];
};
