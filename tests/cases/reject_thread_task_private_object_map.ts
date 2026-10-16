// A task's own `Map` holding its argument: what `get` reads back is `box`.
import { scope } from "nish/threads";
class Box {
  n: i32 = 0;

  bump(): void {
    this.n = this.n + 1;
  }
}

const work = (box: Box): void => {
  const m = new Map<i32, Box>();
  m.set(0, box);
  const b = m.get(0);
  if (b !== undefined) {
    b.bump();
  }
};

export const main = (): i32 => {
  const box = new Box();
  {
    using s = scope();
    s.spawn(work, box);
  }
  return box.n;
};
