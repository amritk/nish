// A map read back out of an own map is that map's element: the argument's
// `Leaf` set into it is what the walk of the outer map's values gives, and
// the write through it is a write into memory the task reads.
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

const work = (h: Holder): i32 => {
  const outer = new Map<string, Map<string, Leaf>>();
  outer.set("a", new Map<string, Leaf>());
  const inner = outer.get("a");
  if (inner !== undefined) {
    inner.set("x", h.leaf);
  }
  let t = 0;
  for (const m of outer.values()) {
    for (const l of m.values()) {
      l.x = 3;
      t = t + l.x;
    }
  }
  return t;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let r = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    r = work(h);
  }
  console.log(`${done[0]} ${r}`);
  return 0;
};
