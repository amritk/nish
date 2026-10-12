// Two functions that hand an object of their own on, run between a scope's
// first `spawn` and its join, and neither writes anything the task reads:
// `build` fills an object it made and returns it, which hands it to the
// caller rather than to anything that could fill it from elsewhere; `count`
// hands its object to a method that stores a number into it, which keeps
// none of the caller's memory there. Natively the task runs at the join and
// under Node at the spawn, and both print the same.
import { scope } from "nish/threads";

class Inner {
  x: i32 = 0;
}

class Holder {
  inner: Inner;
  nums: i32[];

  constructor() {
    this.inner = new Inner();
    this.nums = [5];
  }
}

class Wrap {
  items: Inner[];

  constructor() {
    this.items = [new Inner()];
  }
}

class Counter {
  n: i32;
  inner: Inner;

  constructor() {
    this.n = 0;
    this.inner = new Inner();
  }

  reset(v: i32): void {
    this.n = v;
  }
}

const read = (h: Holder): i32 => h.inner.x + h.nums[0] + 1;

const build = (src: Holder): Wrap => {
  const w = new Wrap();
  w.items.push(new Inner());
  w.items[0].x = src.nums[0];
  return w;
};

const count = (h: Holder): i32 => {
  const c = new Counter();
  c.reset(h.nums[0]);
  c.n = c.n + 1;
  c.inner.x = 3;
  return c.n * 10 + c.inner.x;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let w = new Wrap();
  let counted: i32 = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    w = build(h);
    counted = count(h);
  }
  console.log(`${done[0]} ${w.items[0].x} ${toI32(w.items.length)} ${counted}`);
  return 0;
};
