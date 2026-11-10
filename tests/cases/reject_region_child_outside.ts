// NL2697: `child` outside the function `enter` runs has no parent.
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

export const main = (): i32 => {
  const c = child((): Item => new Item("orphan"));
  free(c);
  return 0;
};
