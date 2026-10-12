// Round 5's matrix: a field of a constructor's `this` used as a property of an object literal,
// which the analysis does not follow, so the argument's memory can reach it,
// and a write through the object the `new` made counts.
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

interface MidRec {
  mid: Mid;
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

class Shell {
  mid: Mid;

  constructor(h: Holder, c: boolean) {
    this.mid = new Mid();
    const u = new Top();
    const r: MidRec = { mid: this.mid };
    r.mid.leaf = h.leaf;
  }
}

const build = (h: Holder): void => {
  const w = new Shell(h, true);
  w.mid.leaf.x = 1;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    build(h);
  }
  console.log(`${done[0]}`);
  return 0;
};
