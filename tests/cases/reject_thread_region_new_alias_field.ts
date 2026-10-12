// #564's third review: a constructor that keeps a parameter's memory in a
// field of `this` and then writes through that field writes the argument's
// memory, however fresh `this` itself is. Native and Node printed 1 and 0.
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

class Bump {
  inner: Inner;

  constructor(h: Holder) {
    this.inner = h.inner;
    this.inner.x = 1;
  }
}

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    const b = new Bump(h);
  }
  console.log(`${done[0]}`);
  return 0;
};
