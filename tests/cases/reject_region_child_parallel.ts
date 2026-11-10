// NL2351: a parallel body may not make a child region: each thread has an
// arena of its own.
import { child, enter, free, region } from "nish:region";
import { parallelMap } from "nish/threads";

class Item {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

const make = (): Item => new Item("kid");
const keep = (root: Item): i32 => {
  const ys = parallelMap([1, 2], (x: i32): i32 => {
    child(make);
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
