// NL2614: a parent node read back out of the builder's own list is still the
// parent's memory, so it may not be the child's root.
import { Region, childWith, enter, free, region } from "nish:region";

class Item {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class Holder {
  seen: Item[];
  constructor() {
    this.seen = [];
  }
}

const same = (r: Item): Item => {
  const h = new Holder();
  h.seen.push(r);
  return h.seen[0];
};
const keep = (root: Item): Region<Item> => childWith(root, same);

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  enter(p, keep);
  free(p);
  return 0;
};
