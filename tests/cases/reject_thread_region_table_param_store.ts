// A function that sets its argument's `Leaf` into a map it is handed pollutes
// that map: the caller's own map then holds memory the task reads, and the
// write through what `get` reads back out of it counts.
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

const keep = (memo: Map<string, Leaf>, l: Leaf): i32 => {
  memo.set("a", l);
  return 0;
};

const work = (h: Holder): i32 => {
  const memo = new Map<string, Leaf>();
  keep(memo, h.leaf);
  const l = memo.get("a");
  if (l !== undefined) {
    l.x = 1;
  }
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
