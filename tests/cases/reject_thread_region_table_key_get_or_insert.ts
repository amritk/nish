// The key `getOrInsert` from `nish/map` is handed is kept: the argument's
// `Leaf` used as a key is what the walk of `keys()` gives, so the write through
// it counts.
import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";

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
  const seen = new Map<Leaf, i32>();
  getOrInsert(seen, h.leaf, 1);
  for (const k of seen.keys()) {
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
