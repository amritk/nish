// NL2614: `regionWith(g, (a) => a)`: the root is the outside value it was
// handed, not memory the region allocated.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region";

class Box {
  n: i32 = 0;
  items: i32[];
  constructor() {
    this.items = [];
  }
}

export const main = (): i32 => {
  const g = new Box();
  const r = regionWith(g, (a: Box): Box => a);
  free(r);
  return 0;
};
