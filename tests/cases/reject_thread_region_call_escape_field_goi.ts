// #608's escape matrix: `getOrInsert(m, …)`, which answers what `m` holds,
// used as the right side of a field store, which the analysis does not follow,
// so the argument's memory stored through the other name lands in the table,
// and the write through the table counts.
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

class Cell {
  v: Mid;

  constructor() {
    this.v = new Mid();
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
  const m = new Map<string, Mid>();
  const c = new Cell();
  c.v = getOrInsert(m, "a", new Mid());
  c.v.leaf = h.leaf;
  getOrInsert(m, "a", new Mid()).leaf.x = 1;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    bump(h);
  }
  console.log(`${done[0]} ${h.leaf.x}`);
  return 0;
};
