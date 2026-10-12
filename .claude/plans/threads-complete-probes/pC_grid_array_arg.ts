import { scope } from "nish/threads";

class Inner {
  x: i32 = 0;
}

class Holder {
  inner: Inner;

  constructor() {
    this.inner = new Inner();
  }
}

const read = (h: Holder): i32 => h.inner.x;

class Grid {
  cells: i32[];
  size: i32;

  constructor(size: i32, cells: i32[]) {
    this.size = size;
    this.cells = cells;
  }
}

const sum = (h: Holder): i32 => {
  const arr = [0, 0, 0, 0];
  const g = new Grid(4, arr);
  g.cells[0] = 1;
  return g.cells[0];
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    console.log(`${sum(h)}`);
  }
  console.log(`${done[0]}`);
  return 0;
};
