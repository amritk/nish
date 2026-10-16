// A method of the task's own object that forwards to a field's method: the
// constructor kept `box`, and `bumpInner` writes it.
import { scope } from "nish/threads";
class Box {
  n: i32 = 0;

  bump(): void {
    this.n = this.n + 1;
  }
}

class Fwd {
  b: Box;

  constructor(b: Box) {
    this.b = b;
  }

  bumpInner(): void {
    this.b.bump();
  }
}

const work = (box: Box): void => {
  const h = new Fwd(box);
  h.bumpInner();
};

export const main = (): i32 => {
  const box = new Box();
  {
    using s = scope();
    s.spawn(work, box);
  }
  return box.n;
};
