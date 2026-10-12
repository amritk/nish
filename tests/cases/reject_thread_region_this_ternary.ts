// `this` as an arm of a `?:`: whatever the expression is handed to may store
// into `this`, so the object is not fresh after.
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

const attach = (w: Shell, h: Holder): void => {
  w.inner = h.inner;
};

class Shell {
  inner: Inner;

  constructor(h: Holder, other: Shell | null) {
    this.inner = new Inner();
    attach(other === null ? this : other, h);
  }
}

const build = (h: Holder): void => {
  const w = new Shell(h, null);
  w.inner.x = 1;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    build(h);
  }
  console.log(`${done[0]}`);
  return 0;
};
