// A walk of a body's own array of the caller's object hands that object to a
// helper that writes it: `bumpBox(b)` writes `box` on every element at once.
import { parallelMapInto } from "nish/threads";
class Box {
  n: i32 = 0;

  bump(): void {
    this.n = this.n + 1;
  }
}

const bumpBox = (b: Box): void => {
  b.bump();
};

const step = (box: Box, x: i32): i32 => {
  const bs: Box[] = [box];
  for (const b of bs) {
    bumpBox(b);
  }
  return x;
};

export const main = (): i32 => {
  const box = new Box();
  const xs: i32[] = [1, 2, 3, 4];
  const dst: i32[] = [0, 0, 0, 0];
  parallelMapInto(xs, dst, (x) => step(box, x));
  return box.n;
};
