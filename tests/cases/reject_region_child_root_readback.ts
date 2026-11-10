// NL2610: memory stored into the root in this `enter` and read back off it
// is new in this `enter`, so the child may not keep it.
import { Region, childWith, enter, free, region } from "nish:region";

class Item {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class Box {
  item: Item;
  constructor(item: Item) {
    this.item = item;
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
  root.item = new Item("new");
  const fresh = root.item;
  return childWith(fresh, hold);
};

export const main = (): i32 => {
  const p = region((): Box => new Box(new Item("root")));
  enter(p, keep);
  free(p);
  return 0;
};
