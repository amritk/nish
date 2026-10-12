// A function that stores through the variable of a `for...of` over its
// argument's array writes the objects that array holds.
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

const bump = (h: Holder): void => {
  for (const it of h.items) {
    it.x = 1;
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
  console.log(`${done[0]}`);
  return 0;
};
