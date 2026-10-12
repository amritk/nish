// A value stored into a `Map` of the function's own is what `get` reads back:
// the argument's `Leaf` stored with `set` and written through `get`'s answer
// is a write into memory the task reads.
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
  const m = new Map<string, Leaf>();
  m.set("a", h.leaf);
  const l = m.get("a");
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
