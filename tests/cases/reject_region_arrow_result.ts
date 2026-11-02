// NL2610: what an arrow handed to a user function answers is what the call
// answers: `pick` hands back memory outside the region, stored in the root.
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
const pick = (g: () => Box): Box => g();

const link = (b: Box, h: Holder): i32 => {
  const n = h.node;
  if (n !== null) {
    b.child = pick((): Box => n);
  }
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  h.node = new Box();
  const r = region(mk);
  const n = enterWith(r, h, link);
  free(r);
  return n;
};
