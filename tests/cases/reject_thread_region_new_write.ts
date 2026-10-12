// #564: the region's write rule holds through a constructor, which is a call:
// `new Bump(counter)` writes the counter a task of `s` is reading.
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
    const b = new Bump(counter);
  }
  return done[0];
};
