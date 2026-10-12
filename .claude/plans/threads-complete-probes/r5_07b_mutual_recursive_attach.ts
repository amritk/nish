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

const attachA = (w: Wrap, h: Holder, n: i32): void => {
  if (n <= 0) {
    w.items.push(h.inner);
    return;
  }
  attachB(w, h, n - 1);
};

const attachB = (w: Wrap, h: Holder, n: i32): void => {
  attachA(w, h, n);
};

const bump = (h: Holder): void => {
  const w = new Wrap();
  attachA(w, h, 3);
  w.items[1].x = 1;
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
