// NL2351: a parallel body may not make a child region: each thread has an
// arena of its own.
import { Region, child, enter, free, region } from "nish:region";
import { parallelMap } from "nish/threads";

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
const keep = (root: Item): i32 => {
  const ys = parallelMap([1, 2], (x: i32): i32 => {
    const c = child(make);
    free(c);
    return x;
  });
  return ys.length;
};

export const main = (): i32 => {
  const p = region((): Item => new Item("root"));
  const n = enter(p, keep);
  free(p);
  return n;
};
