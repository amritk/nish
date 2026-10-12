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

class Wrap {
  inner: Inner;
  items: Inner[];

  constructor() {
    this.inner = new Inner();
    this.items = [new Inner()];
  }
}

const build = (src: Holder): Wrap => {
  const w = new Wrap();
  w.items.push(new Inner());
  w.items[0].x = src.nums[0];
  return w;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let w = new Wrap();
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    w = build(h);
  }
  console.log(`${done[0]} ${w.items[0].x} ${w.items.length}`);
  return 0;
};
