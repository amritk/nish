// #564's review: a constructor that stores into a field of a field of its
// argument writes memory a task reading that argument reads. Natively the task
// ran at the join and saw 1; under Node it ran at the spawn and saw 0.
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

class Bump {
  constructor(h: Holder) {
    h.inner.x = 1;
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
