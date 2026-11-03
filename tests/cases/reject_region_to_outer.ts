// NL2609: `enterWith`'s function keeps the region's root in memory outside
// the region, which would point at freed memory once `free` runs.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

class Holder {
  box: Box | null = null;
}

const keep = (b: Box, h: Holder): i32 => {
  h.box = b;
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const r = region((): Box => new Box());
  const n = enterWith(r, h, keep);
  free(r);
  return n;
};
