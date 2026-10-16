// The forwarding method again, the argument stored into the field after the
// object was made: `h.b = box`, then `h.bumpInner()`.
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
  const h = new Fwd(new Box());
  h.b = box;
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
