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

class Counter {
  n: i32;

  constructor() {
    this.n = 5;
    this.init();
  }

  init(): void {
    this.n = 0;
  }
}

const make = (h: Holder): i32 => {
  const c = new Counter();
  c.n = c.n + 2;
  return c.n;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    console.log(`${make(h)}`);
  }
  console.log(`${done[0]}`);
  return 0;
};
