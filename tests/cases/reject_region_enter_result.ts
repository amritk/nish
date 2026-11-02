// NL2611: `enter`'s function answers an array, which would point into the
// region from outside it; only scalars and handles leave.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const itemsOf = (b: Box): i32[] => b.items;

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const xs = enter(r, itemsOf);
  free(r);
  return xs.length;
};
