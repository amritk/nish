// NL2609: a child's root may reach the child's own memory, which outer
// memory may not keep, whatever the parent's rules would allow.
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
const leak = (root: Item, outer: Item): i32 => {
  outer.next = root;
  return 0;
};

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  const c = enter(p, spawnChild);
  const outer = new Item("outer");
  enterWith(c, outer, leak);
  free(p);
  return 0;
};
