// A task's own `Set` holding its argument: the walk's `b` is `box`.
import { scope } from "nish/threads";
class Box {
  n: i32 = 0;

  bump(): void {
    this.n = this.n + 1;
  }
}

const work = (box: Box): void => {
  const st = new Set<Box>();
  st.add(box);
  for (const b of st) {
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
