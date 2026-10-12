// Round 5's matrix: a field of a fresh object used as an argument of a function that keeps it, which the analysis does not
// follow, so the argument's memory can reach it through the other name, and
// the write through the first name counts. (`docs/LANGUAGE.md`, "Scoped tasks".)
import { scope } from "nish/threads";

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

const link = (u: Top, m: Mid): void => {
  u.mid = m;
};

const bump = (h: Holder, c: boolean): void => {
  const t = new Top();
  const u = new Top();
  link(u, t.mid);
  u.mid.leaf = h.leaf;
  t.mid.leaf.x = 1;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    bump(h, true);
  }
  console.log(`${done[0]}`);
  return 0;
};
