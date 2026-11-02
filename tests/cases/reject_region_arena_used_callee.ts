// NL2617 (RT-45): `enter`'s function reaches `Arena.used` through a callee,
// which inside the region would read the region's own arena.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const usage = (): i64 => Arena.used();

const count = (b: Box): i32 => {
  b.n = toI32(usage());
  return b.n;
};

export const main = (): i32 => {
  const r = region((): Box => new Box());
  const n = enter(r, count);
  free(r);
  return n;
};
