// `getOrInsert` keeps the argument's own `Leaf` in an own map and gives it
// back, so the write through what it answers is a write the task can see.
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
  const m = new Map<string, Leaf>();
  const l = getOrInsert(m, "a", h.leaf);
  l.x = 9;
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
