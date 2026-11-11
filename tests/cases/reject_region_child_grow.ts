// NL2615: growing a parent array inside the child's `f` would take the
// new storage from the child's arena.
import { Region, childWith, enter, free, region } from "nish:region";

class Items {
  all: i32[];
  constructor() {
    this.all = [];
  }
}

class Count {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
}

const grow = (items: Items): Count => {
  items.all.push(1);
  return new Count(items.all.length);
};
const keep = (root: Items): Region<Count> => childWith(root, grow);

export const main = (): i32 => {
  const p = region((): Items => new Items());
  enter(p, keep);
  free(p);
  return 0;
};
