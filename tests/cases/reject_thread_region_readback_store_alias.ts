// A store through what `get` reads back is a store into the map's element,
// which is also the object the function named before it set it: the
// argument's memory stored through one name is written through the other.
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

class Holder {
  leaf: Leaf;

  constructor() {
    this.leaf = new Leaf();
  }
}

const read = (h: Holder): i32 => h.leaf.x;

const work = (h: Holder): i32 => {
  const m = new Map<string, Mid>();
  const t = new Mid();
  m.set("a", t);
  const g = m.get("a");
  if (g !== undefined) {
    g.leaf = h.leaf;
  }
  t.leaf.x = 1;
  return 0;
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
