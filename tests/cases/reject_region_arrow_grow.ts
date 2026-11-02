// NL2615: an arrow handed to a user function grows an array outside the
// region while the region is entered.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  child: Box | null = null;
}

class Holder {
  box: Box | null = null;
  node: Box | null = null;
  xs: i32[];
  constructor() {
    this.xs = [];
  }
}

const mk = (): Box => new Box();
const each = (cb: () => void): void => {
  cb();
};

const grow = (b: Box, h: Holder): i32 => {
  each(() => {
    h.xs.push(b.n);
  });
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  h.node = new Box();
  const r = region(mk);
  const n = enterWith(r, h, grow);
  free(r);
  return n;
};
