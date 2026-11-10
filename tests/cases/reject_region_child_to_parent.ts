// NL2609: the parent outlives the child, so the parent may not keep the
// child's memory.
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

const link = (item: Item): Holder => {
  item.next = new Item("child");
  return new Holder(item);
};
const keep = (root: Item): Region<Holder> => childWith(root, link);

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  enter(p, keep);
  free(p);
  return 0;
};
