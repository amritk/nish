// The same through `getOrInsert` from `nish/map`: the map is its first
// argument, and the value it is handed is a store into it.
import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";

class Leaf {
  x: i32 = 0;
}

class Mid {
  leaf: Leaf;

  constructor() {
    this.leaf = new Leaf();
  }
}

class Top {
  mid: Mid;

  constructor() {
    this.mid = new Mid();
  }
}

class Holder {
  leaf: Leaf;

  constructor() {
    this.leaf = new Leaf();
  }
}

const read = (h: Holder): i32 => h.leaf.x;

const bump = (h: Holder): void => {
  const t = new Top();
  const m = new Map<string, Mid>();
  const g = getOrInsert(m, "a", t.mid);
  g.leaf = h.leaf;
  t.mid.leaf.x = 1;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    bump(h);
  }
  console.log(`${done[0]}`);
  return 0;
};
