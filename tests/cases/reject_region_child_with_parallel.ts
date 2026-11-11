// NL2351: a parallel body may not make a child region with `childWith`: each
// thread has an arena of its own.
import { childWith, enter, free, region } from "nish:region";
import { parallelMap } from "nish/threads";

class Item {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

const named = (n: i32): Item => new Item(`kid${n}`);
const keep = (root: Item): i32 => {
  const ys = parallelMap([1, 2], (x: i32): i32 => {
    childWith(x, named);
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
