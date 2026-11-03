// NL2610: as reject_region_arrow_compose, with what `g` answers held in a
// local of `compose` before `f` is handed it.
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
const compose = (f: (x: Box) => i32, g: () => Box): i32 => {
  const t = g();
  return f(t);
};

const link = (b: Box, h: Holder): i32 => {
  const n = h.node;
  compose((x: Box): i32 => {
    b.child = x;
    return 0;
  }, (): Box => n);
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const r = region(mk);
  const n = enterWith(r, h, link);
  free(r);
  return n;
};
