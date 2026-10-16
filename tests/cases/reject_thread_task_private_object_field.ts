// A task's own object holds its argument once `h.b = box` stores it there:
// `h.b.bump()` writes `box`, which the scope's other task bumps too.
import { scope } from "nish/threads";
class Box {
  n: i32 = 0;

  bump(): void {
    this.n = this.n + 1;
  }
}
class HB {
  b: Box;

  constructor(b: Box) {
    this.b = b;
  }
}

const work = (box: Box): void => {
  const h = new HB(new Box());
  h.b = box;
  h.b.bump();
};

export const main = (): i32 => {
  const box = new Box();
  {
    using s = scope();
    s.spawn(work, box);
  }
  return box.n;
};
