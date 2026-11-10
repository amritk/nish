// NL2614: the parent's memory as the child's root would leave the child
// with nothing of its own.
import { Region, child, childWith, enter, free, region } from "nish:region";

class Item {
  name: string;
  next: Item | null = null;
  constructor(name: string) {
    this.name = name;
  }
}

class Holder {
  item: Item;
  constructor(item: Item) {
    this.item = item;
  }
}

const same = (item: Item): Item => item;
const keep = (root: Item): Region<Item> => childWith(root, same);

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  enter(p, keep);
  free(p);
  return 0;
};
