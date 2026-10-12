// #608's escape matrix: a table call used as the value of another table's `set`, which the analysis
// does not follow, so the argument's memory stored through the other name lands
// in the table, and the write through the table counts. `set` also keeps its
// value argument (its `ArgEdge`), so this case is refused by both rules.
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
  const inner = new Map<string, Leaf>();
  const outer = new Map<string, Map<string, Leaf>>();
  outer.set("k", inner.set("x", new Leaf()));
  const g = outer.get("k");
  if (g !== undefined) {
    g.set("b", h.leaf);
  }
  for (const v of inner.values()) {
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
