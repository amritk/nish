// A walk of an own map's `keys()` gives the keys set into it: the argument's
// `Leaf` used as a key, so the write through the loop variable is a write the
// task can see.
import { scope } from "nish/threads";

class Leaf {
  x: i32 = 0;
}

class Holder {
  leaf: Leaf;

  constructor() {
    this.leaf = new Leaf();
  }
}

const read = (h: Holder): i32 => h.leaf.x;

const work = (h: Holder): i32 => {
  const m = new Map<Leaf, i32>();
  m.set(h.leaf, 1);
  for (const k of m.keys()) {
    k.x = 1;
  }
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let r = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    r = work(h);
  }
  console.log(`${done[0]} ${r}`);
  return 0;
};
