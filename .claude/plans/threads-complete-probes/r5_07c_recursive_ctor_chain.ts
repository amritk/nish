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

class Node2 {
  inner: Inner;
  next: Node2 | null;

  constructor(h: Holder, n: i32) {
    this.inner = new Inner();
    this.next = null;
    if (n <= 0) {
      this.inner = h.inner;
    } else {
      this.next = new Node2(h, n - 1);
    }
  }
}

const bump = (h: Holder): void => {
  const n = new Node2(h, 2);
  const a = n.next;
  if (a !== null) {
    const b = a.next;
    if (b !== null) {
      b.inner.x = 1;
    }
  }
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
