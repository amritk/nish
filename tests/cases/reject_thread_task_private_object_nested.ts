// Two levels down in a task's own object: `o.a.b = box`, then `o.a.b.bump()`.
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

class Outer {
  a: HB;

  constructor(a: HB) {
    this.a = a;
  }
}

const work = (box: Box): void => {
  const o = new Outer(new HB(new Box()));
  o.a.b = box;
  o.a.b.bump();
};

export const main = (): i32 => {
  const box = new Box();
  {
    using s = scope();
    s.spawn(work, box);
  }
  return box.n;
};
