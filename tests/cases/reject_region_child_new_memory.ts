// NL2610: memory new in this `enter` may be released by a scope while the
// child lives on, so the child may not keep it.
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

const hold = (item: Item): Holder => new Holder(item);
const keep = (root: Item): Region<Holder> => childWith(new Item(root.name + "!"), hold);

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  enter(p, keep);
  free(p);
  return 0;
};
