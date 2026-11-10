// NL2351: a spawned function may not make a child region: the task's
// thread has an arena of its own.
import { Region, child, enter, free, region } from "nish:region";
import { scope } from "nish/threads";

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
const run = (n: i32): i32 => {
  const c = child(make);
  free(c);
  return n;
};
const keep = (root: Item): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(run, 1, out, 0);
  }
  return out[0];
};

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  const n = enter(p, keep);
  free(p);
  return n;
};
