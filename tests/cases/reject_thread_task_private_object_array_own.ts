// An element of a task's own array of its own objects, given the argument:
// `hs[0].b = box`, then `hs[0].b.bump()`.
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
  const hs: HB[] = [new HB(new Box())];
  hs[0].b = box;
  hs[0].b.bump();
};

export const main = (): i32 => {
  const box = new Box();
  {
    using s = scope();
    s.spawn(work, box);
  }
  return box.n;
};
