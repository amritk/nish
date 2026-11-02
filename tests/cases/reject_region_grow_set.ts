// NL2615: `Set.add` on an outer set grows it from the region's arena.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const serve = (b: Box, seen: Set<i32>): i32 => {
  seen.add(b.n);
  return 0;
};

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const seen = new Set<i32>();
  enterWith(r, seen, serve);
  free(r);
  return seen.size;
};
