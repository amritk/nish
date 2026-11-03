// NL2610: `twice` hands what an arrow answers back to the same arrow, so its
// parameter may be memory outside the region after the first call.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  child: Box | null = null;
}

class Holder {
  node: Box;
  constructor() {
    this.node = new Box();
  }
}

const mk = (): Box => new Box();
const twice = (f: (x: Box) => Box, x: Box): Box => f(f(x));

const link = (b: Box, h: Holder): i32 => {
  const n = h.node;
  twice((y: Box): Box => {
    b.child = y;
    return n;
  }, b);
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const r = region(mk);
  const n = enterWith(r, h, link);
  free(r);
  return n;
};
