// NL2610: an element pushed onto the root's array in this `enter` is new in
// it, so the child may not keep it when it is read back.
import { Region, childWith, enter, free, region } from "nish:region";

class Item {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class Box {
  items: Item[];
  constructor() {
    this.items = [];
  }
}

class Holder {
  item: Item;
  constructor(item: Item) {
    this.item = item;
  }
}

const hold = (item: Item): Holder => new Holder(item);
const keep = (root: Box): Region<Holder> => {
  root.items.push(new Item("new"));
  return childWith(root.items[0], hold);
};

export const main = (): i32 => {
  const p = region((): Box => new Box());
  enter(p, keep);
  free(p);
  return 0;
};
