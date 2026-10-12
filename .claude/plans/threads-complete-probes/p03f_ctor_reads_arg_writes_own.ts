import { scope } from "nish/threads";

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

class Snap {
  x: i32;
  arr: i32[];

  constructor(h: Holder) {
    this.x = h.inner.x;
    this.arr = [h.nums[0], 0];
    this.arr[1] = 7;
  }
}

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    const k = new Snap(h); console.log(`${k.x + k.arr[1]}`);
  }
  console.log(`${done[0]}`);
  return 0;
};
