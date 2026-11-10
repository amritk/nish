// NL2609: in an `enter` of a handle that may be a child's, memory new in this
// `enter` may not be stored into the root, which may be an ancestor's.
import { Region, child, enter, free, region } from "nish:region";

class Item {
  name: string;
  next: Item | null = null;
  constructor(name: string) {
    this.name = name;
  }
}

const make = (): Item => new Item("kid");
const spawnChild = (root: Item): Region<Item> => child(make);
const link = (root: Item): i32 => {
  root.next = new Item("new");
  return 0;
};

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  const c = enter(p, spawnChild);
  enter(c, link);
  free(p);
  return 0;
};
