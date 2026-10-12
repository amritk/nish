// As `reject_thread_region_new_alias_field`, for an array kept in `this` and
// pushed onto.
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
  nums: i32[];

  constructor(h: Holder) {
    this.nums = h.nums;
    this.nums.push(1);
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
