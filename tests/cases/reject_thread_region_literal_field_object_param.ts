// Round 5, hole A (15e: an object literal stored into a fresh object's field): an object literal's
// properties are values like any other, so what one holds is the argument's
// memory, and the write through it counts.
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

interface Pair {
  inner: Inner;
}

class PK {
  p: Pair;

  constructor(p: Pair) {
    this.p = p;
  }
}

const bump = (h: Holder): void => {
  const inner = h.inner;
  const o = new PK({ inner: new Inner() });
  o.p = { inner };
  o.p.inner.x = 1;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    bump(h);
  }
  console.log(`${done[0]}`);
  return 0;
};
