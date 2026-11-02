// NL2615: `Set.add` on an outer set, in a callee of the region's function.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const note = (seen: Set<i32>, n: i32): void => {
  seen.add(n);
};

const serve = (b: Box, seen: Set<i32>): i32 => {
  note(seen, b.n);
  return 0;
};

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const seen = new Set<i32>();
  enterWith(r, seen, serve);
  free(r);
  return seen.size;
};
