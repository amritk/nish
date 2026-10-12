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

class Box {
  items: i32[];
  n: i32 = 0;

  constructor() {
    this.items = [];
  }
}

const f = (src: i32[]): i32 => {
  const b = new Box();
  b.items.push(src[0]);
  return b.items.length;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let got = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    got = f(h.nums);
  }
  console.log(`${done[0]} ${got}`);
  return 0;
};
