// A function that builds an object whose constructor keeps its argument's
// memory, and writes through that object, writes the argument's memory: the
// object is fresh, and what its field holds is not.
import { scope } from "nish/threads";

class Inner {
  x: i32 = 0;
}

class Holder {
  inner: Inner;
  items: Inner[];
  nums: i32[];

  constructor() {
    this.inner = new Inner();
    this.items = [new Inner()];
    this.nums = [5];
  }
}

const read = (h: Holder): i32 => h.inner.x + h.items[0].x + h.nums.length + h.nums[0];

class Wrap {
  inner: Inner;

  constructor(inner: Inner) {
    this.inner = inner;
  }
}

const bump = (h: Holder): void => {
  const w = new Wrap(h.inner);
  w.inner.x = 1;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    bump(h);
  }
  console.log(`${done[0]}`);
  return 0;
};
