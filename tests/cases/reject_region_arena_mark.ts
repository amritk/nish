// NL2617 (RT-45): `Arena.mark` inside a region's function would read the
// region's own arena; before this rule a mark taken in `f` and released
// outside it moved the thread's arena by the region's offsets.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

const make = (): Box => {
  const m = Arena.mark();
  const b = new Box();
  b.n = toI32(m);
  return b;
};

export const main = (): i32 => {
  const r = region(make);
  free(r);
  return 0;
};
