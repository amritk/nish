// The negative of `mem_capture_read_stack` through a named function: the
// arrow passes what it captures to `stash`, which keeps it. The capture is an
// argument to the arrow, and the arrow's parameter inherits `stash`'s facts
// through the fixpoint, so `b` and `name` escape. Each kept value reads back
// intact after `churn` has reused every byte a wrong release would have freed.

class Box {
  s: string;

  constructor(s: string) {
    this.s = s;
  }
}

class Shelf {
  boxes: Box[];
  names: string[];

  constructor() {
    this.boxes = [];
    this.names = [];
  }
}

const each = (xs: i32[], f: (x: i32) => void): void => {
  for (const x of xs) {
    f(x);
  }
};

const stash = (shelf: Shelf, b: Box, name: string): void => {
  shelf.boxes.push(b);
  shelf.names.push(name);
};

// Reuse the arena above wherever the kept values live.
const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy${i}`.length;
  }
  return t;
};

const fill = (shelf: Shelf, n: i32): void => {
  for (let i = 0; i < n; i++) {
    const b = new Box(`b${i}`);
    const name = `n${i}`;
    each([i], (x) => {
      stash(shelf, b, name);
    });
  }
};

export const main = (): void => {
  const shelf = new Shelf();
  fill(shelf, 300);
  console.log(`${churn()}`);
  console.log(`${shelf.boxes[0].s} ${shelf.boxes[299].s} ${shelf.names[0]} ${shelf.names[299]}`);
};
