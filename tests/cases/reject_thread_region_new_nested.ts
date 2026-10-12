// #564: a constructor that calls another constructor writes what that one
// writes: `Outer`'s builds a `Bump`, whose constructor writes the counter.
import { scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

class Bump {
  constructor(c: Counter) {
    c.n = 5;
  }
}

class Outer {
  b: Bump;

  constructor(c: Counter) {
    this.b = new Bump(c);
  }
}

const read = (c: Counter): i32 => c.n;

export const main = (): i32 => {
  const counter = new Counter();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, counter, done, 0);
    const o = new Outer(counter);
  }
  return done[0];
};
