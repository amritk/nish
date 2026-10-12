// `getOrInsert` from `nish/map` answers what the map holds, here the
// argument's `Leaf` it was handed, so the write through its answer is a write
// into memory the task reads.
import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";

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
  getOrInsert(m, "a", h.leaf).x = 1;
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
