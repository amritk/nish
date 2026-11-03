// NL2615: `Map.set` on an outer map, in a callee of the region's function.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const note = (seen: Map<i32, i32>, n: i32): void => {
  seen.set(n, 1);
};

const serve = (b: Box, seen: Map<i32, i32>): i32 => {
  note(seen, b.n);
  return 0;
};

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const seen = new Map<i32, i32>();
  enterWith(r, seen, serve);
  free(r);
  return seen.size;
};
