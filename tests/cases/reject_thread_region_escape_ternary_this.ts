// Round 5's matrix: a constructor's `this` used as an arm of a `?:`, which the
// analysis does not follow, so the argument's memory can reach the object the
// `new` makes, and a write through it counts.
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

class Node3 {
  leaf: Leaf;

  constructor(h: Holder, c: boolean, k: i32) {
    this.leaf = new Leaf();
    const arr = [c ? this : this];
    arr[0].leaf = h.leaf;
  }
}

interface NRec {
  n: Node3;
}

const linkN = (xs: Node3[], n: Node3): void => {
  xs.push(n);
};

const read = (h: Holder): i32 => h.leaf.x;

const link = (u: Top, m: Mid): void => {
  u.mid = m;
};


const build = (h: Holder): void => {
  const w = new Node3(h, true, 0);
  w.leaf.x = 1;
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
