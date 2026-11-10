// NL2610: a child's root may reach its parent's memory, which may keep
// nothing the parent may not.
import { Region, child, enter, enterWith, free, region } from "nish:region";

class Item {
  name: string;
  next: Item | null = null;
  constructor(name: string) {
    this.name = name;
  }
}

const make = (): Item => new Item("kid");
const spawnChild = (root: Item): Region<Item> => child(make);
const adopt = (root: Item, outer: Item): i32 => {
  root.next = outer;
  return 0;
};

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  const c = enter(p, spawnChild);
  const outer = new Item("outer");
  enterWith(c, outer, adopt);
  free(p);
  return 0;
};
