// #608's escape matrix: `s.add(…)`, which answers `s` itself, used as the
// right side of an element store, which the analysis does not follow, so the
// argument's memory stored through the other name lands in the table, and the
// write through the table counts.
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

const bump = (h: Holder): void => {
  const s = new Set<Leaf>();
  const xs: Set<Leaf>[] = [new Set<Leaf>()];
  xs[0] = s.add(new Leaf());
  xs[0].add(h.leaf);
  for (const k of s) {
    k.x = 1;
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
