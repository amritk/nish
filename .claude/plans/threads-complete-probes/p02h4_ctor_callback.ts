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

const setOne = (i: Inner): void => {
  i.x = 1;
};

class Bump {
  inner: Inner;

  constructor(h: Holder, f: (i: Inner) => void) {
    this.inner = h.inner;
    f(this.inner);
  }
}

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    const b = new Bump(h, setOne);
  }
  console.log(`${done[0]}`);
  return 0;
};
