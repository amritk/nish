// #608's escape matrix: `m.set(…)`, which answers `m` itself, used as a
// property of an object literal, which the analysis does not follow, so the
// argument's memory stored through the other name lands in the table, and the
// write through the table counts.
import { scope } from "nish/threads";

class Leaf {
  x: i32 = 0;
}

interface Rec {
  v: Map<string, Leaf>;
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
  const r: Rec = { v: m.set("x", new Leaf()) };
  r.v.set("b", h.leaf);
  for (const v of m.values()) {
    v.x = 1;
  }
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
