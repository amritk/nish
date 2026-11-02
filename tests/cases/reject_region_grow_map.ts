// NL2615: `Map.set` on an outer map grows it from the region's arena.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const serve = (b: Box, seen: Map<i32, i32>): i32 => {
  seen.set(b.n, 1);
  return 0;
};

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const seen = new Map<i32, i32>();
  enterWith(r, seen, serve);
  free(r);
  return seen.size;
};
