// A fresh object stored into another, which is handed to a function that
// fills it from the argument: the first object is no longer only this
// function's, so a write through it counts.
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

class Wrap {
  inner: Inner;
  items: Inner[];

  constructor() {
    this.inner = new Inner();
    this.items = [new Inner()];
  }
}

class Box {
  w: Wrap;

  constructor(w: Wrap) {
    this.w = w;
  }
}

const attachBox = (b: Box, h: Holder): void => {
  b.w.inner = h.inner;
};

const bump = (h: Holder): void => {
  const w = new Wrap();
  const holder: Wrap[] = [w];
  attachBox(new Box(holder[0]), h);
  w.inner.x = 1;
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
