// NL2609: a generic callee's arrow is walked with its parameter bound to what
// the call is handed: `y` is the region's root, kept in `h`.
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
const each2 = <T>(x: T, cb: (x: T) => void): void => {
  cb(x);
};

const keep = (b: Box, h: Holder): i32 => {
  each2(b, (y: Box): void => {
    h.box = y;
  });
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  h.node = new Box();
  const r = region(mk);
  const n = enterWith(r, h, keep);
  free(r);
  return n;
};
