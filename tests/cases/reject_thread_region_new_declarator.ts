// #564: every declarator of a statement in the region is judged, the second
// as well as the first: `b`'s constructor writes the counter a task reads.
import { scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Bump {
  constructor(c: Counter) {
    c.n = 5;
  }
}

const read = (c: Counter): i32 => c.n;

export const main = (): i32 => {
  const counter = new Counter();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, counter, done, 0);
    const a: i32 = 1,
      b = new Bump(counter);
  }
  return done[0];
};
