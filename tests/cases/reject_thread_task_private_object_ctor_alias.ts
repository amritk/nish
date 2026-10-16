// A constructor keeps the task's argument in the task's own object, and a
// `const` read back out of it names the argument: `b.bump()` writes `box`.
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
  const h = new HB(box);
  const b = h.b;
  b.bump();
};

export const main = (): i32 => {
  const box = new Box();
  {
    using s = scope();
    s.spawn(work, box);
  }
  return box.n;
};
