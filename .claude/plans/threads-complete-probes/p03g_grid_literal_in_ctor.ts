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

class Grid {
  cells: i32[];

  constructor(n: i32) {
    this.cells = [0, 0, 0, 0];
    this.cells[0] = n;
  }
}

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    const g = new Grid(4); g.cells[1] = 2; console.log(`${g.cells[0] + g.cells[1]}`);
  }
  console.log(`${done[0]}`);
  return 0;
};
