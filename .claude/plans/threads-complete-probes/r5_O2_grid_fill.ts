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

class Grid {
  cells: i32[];

  constructor() {
    this.cells = [0, 0, 0, 0];
  }
}

const fill = (g: Grid): void => {
  g.cells[0] = 1;
};

const f = (src: Holder): i32 => {
  const g = new Grid();
  fill(g);
  return g.cells[0] + src.nums[0];
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let got = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    got = f(h);
  }
  console.log(`${done[0]} ${got}`);
  return 0;
};
