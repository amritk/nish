// A function that builds an object of its own and writes into what that
// object holds writes nothing a task can read, so it may run between a
// scope's first `spawn` and its join: `Grid`'s constructor keeps no
// argument's memory, so `r.cells` is the function's own array. Natively the
// task runs at the join and under Node at the spawn, and both print the same.
import { scope } from "nish/threads";

class Inner {
  x: i32 = 0;
}

class Holder {
  inner: Inner;

  constructor(x: i32) {
    this.inner = new Inner();
    this.inner.x = x;
  }
}

class Grid {
  cells: i32[];
  size: i32;

  constructor(size: i32) {
    this.cells = [0, 0, 0, 0];
    this.size = size;
  }
}

const read = (h: Holder): i32 => h.inner.x;

const sum = (h: Holder): i32 => {
  const r = new Grid(4);
  r.cells[0] = h.inner.x;
  r.cells[1] = 4;
  r.cells.push(r.size);
  let t: i32 = 0;
  for (const c of r.cells) {
    t = t + c;
  }
  return t;
};

export const main = (): i32 => {
  const h = new Holder(7);
  const done: i32[] = [0];
  let total: i32 = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    total = sum(h);
  }
  console.log(`${done[0]} ${total}`);
  return 0;
};
