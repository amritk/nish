import { parallelMapInto, scope } from "nish/threads";

class Inner {
  x: i32 = 0;

  bump(): void {
    this.x = 1;
  }
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

const write = (h: Holder): i32 => {
  h.inner.x = 1;
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let seen: i32 = 0;
  {
    using s = scope();
    s.spawn(write, h, done, 0);
    seen = h.inner.x;
  }
  console.log(`${seen} ${h.inner.x}`);
  return 0;
};
