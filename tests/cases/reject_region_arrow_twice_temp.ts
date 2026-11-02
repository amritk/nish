// NL2610: as reject_region_arrow_twice, with the first answer held in a local
// of `twice` before the second call.
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
const twice = (f: (x: Box) => Box, x: Box): Box => {
  const t = f(x);
  return f(t);
};

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
