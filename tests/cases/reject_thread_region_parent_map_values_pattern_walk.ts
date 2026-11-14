// A pattern in a walk's body leaves the walk under the region rule: the parent
// may not walk a table a task reads before the join, whatever the body binds.
// A pattern head cannot carry the walk itself: over a `Map` it is NL2375 and
// over its `values()` NL2785, before the region rule is reached.
import { scope } from "nish/threads";

class Cell {
  n: i32;
  m: i32;

  constructor(n: i32, m: i32) {
    this.n = n;
    this.m = m;
  }
}

class Index {
  cells: Map<string, Cell>;

  constructor() {
    this.cells = new Map<string, Cell>();
    this.cells.set("a", new Cell(3, 4));
  }
}

const look = (ix: Index): i32 => ix.cells.size;

export const main = (): i32 => {
  const ix = new Index();
  const out: i32[] = [0];
  let t = 0;
  {
    using s = scope();
    s.spawn(look, ix, out, 0);
    for (const cell of ix.cells.values()) {
      const { n, m } = cell;
      t = t + n + m;
    }
  }
  console.log(`${out[0]} ${t}`);
  return 0;
};
