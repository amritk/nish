// Two constructors that keep what they are handed, run between a scope's
// first `spawn` and its join, and each writes nothing a task reads: `Grid`
// keeps the helper's own array, so the store through `g.cells` is into the
// helper's memory; `Keep` pushes the argument's object onto an array it made
// itself, which writes that array and nothing of `h`'s. Natively the task runs
// at the join and under Node at the spawn, and both print the same.
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

  constructor(size: i32, cells: i32[]) {
    this.size = size;
    this.cells = cells;
  }
}

class Keep {
  items: Inner[];

  constructor(h: Holder) {
    this.items = [];
    this.items.push(h.inner);
  }
}

const read = (h: Holder): i32 => h.inner.x;

const sum = (h: Holder): i32 => {
  const arr = [0, 0, 0, 0];
  const g = new Grid(4, arr);
  g.cells[0] = 1;
  return g.cells[0] + arr[0] + g.size;
};

export const main = (): i32 => {
  const h = new Holder(6);
  const done: i32[] = [0];
  let total: i32 = 0;
  let kept: i32 = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    total = sum(h);
    const k = new Keep(h);
    kept = toI32(k.items.length) + k.items[0].x;
  }
  console.log(`${done[0]} ${total} ${kept}`);
  return 0;
};
