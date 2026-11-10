// NL2697: a function that makes a child, called outside an `enter` as well
// as by one, would make it with no parent.
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

const make = (): Item => new Item("kid");
const keep = (root: Item): Region<Item> => child(make);

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  enter(p, keep);
  const stray = keep(new Item("outer"));
  free(stray);
  free(p);
  return 0;
};
