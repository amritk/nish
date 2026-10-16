// A task's own array of its own objects, once one pushed onto it was made
// around the argument: `hs[1].b.bump()` writes `box`, which no direct store put there.
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
  hs.push(new HB(box));
  hs[1].b.bump();
};

export const main = (): i32 => {
  const box = new Box();
  {
    using s = scope();
    s.spawn(work, box);
  }
  return box.n;
};
