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

class Outer {
  w: Wrap;

  constructor() {
    this.w = new Wrap();
  }
}

const attach = (w: Wrap, h: Holder): void => {
  w.inner = h.inner;
};

interface HasInner {
  inner: Inner;
}

class AW implements HasInner {
  inner: Inner;

  constructor() {
    this.inner = new Inner();
  }
}

class BW implements HasInner {
  inner: Inner;
  y: i32;

  constructor() {
    this.inner = new Inner();
    this.y = 0;
  }
}

const bump = (h: Holder): void => {
  const a = new AW();
  const b = new BW();
  const xs: HasInner[] = [a, b];
  xs[1].inner = h.inner;
  b.inner.x = 1;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    bump(h);
  }
  console.log(`${done[0]} ${h.inner.x}`);
  return 0;
};
