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

class Wrap {
  inner: Inner;

  constructor() {
    this.inner = new Inner();
  }

  bind(h: Holder): void {
    this.inner = h.inner;
  }
}

const bump = (h: Holder): void => {
  const w = new Wrap();
  w.bind(h);
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
