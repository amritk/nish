// A task's own array holds the task's argument once it is pushed: `hs[0].bump()` writes `box`,
// which another task bumps too, however only the task made `hs` (round 1, H1).
import { scope } from "nish/threads";
class Box {
  n: i32 = 0;

  bump(): void {
    this.n = this.n + 1;
  }
}

const work = (box: Box): void => {
  const hs: Box[] = [];
  hs.push(box);
  hs[0].bump();
};

export const main = (): i32 => {
  const box = new Box();
  {
    using s = scope();
    s.spawn(work, box);
  }
  return box.n;
};
