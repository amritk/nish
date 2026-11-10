// NL2610: a fresh holder that names the root is written through,
// so the root may reach memory new in this `enter`, and the child may not
// keep it.
import { Region, childWith, enter, free, region } from "nish:region";

class Item {
  name: string;
  next: Item | null;
  constructor(name: string) {
    this.name = name;
    this.next = null;
  }
}

class Holder {
  item: Item;
  constructor(item: Item) {
    this.item = item;
  }
}

const hold = (item: Item): Holder => new Holder(item);
const keep = (root: Item): Region<Holder> => {
  const t = new Holder(root);
  t.item.next = new Item("x");
  return childWith(root, hold);
};

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  enter(p, keep);
  free(p);
  return 0;
};
