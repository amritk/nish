// A constructor that hands its argument to a helper which stores into a
// field of a field of it writes what the helper writes.
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

  constructor() {
    this.inner = new Inner();
    this.items = [new Inner()];
  }
}

const read = (h: Holder): i32 => h.inner.x + h.items[0].x;

const deep = (h: Holder): void => {
  h.inner.x = 1;
};

class Bump {
  constructor(h: Holder) {
    deep(h);
  }
}

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    const b = new Bump(h);
  }
  console.log(`${done[0]}`);
  return 0;
};
