// `getOrInsert` from `nish/map` on the argument's own table writes it, through the table method's
// `this`, while the task reads its size: a lookup is a read, and this is not.
import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";

class Holder {
  table: Map<string, i32>;

  constructor() {
    this.table = new Map<string, i32>();
    this.table.set("x", 1);
  }
}

const read = (h: Holder): i32 => h.table.size;

const bump = (p: Holder): i32 => {
  getOrInsert(p.table, "y", 3);
  return 0;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  let r = 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    r = bump(h);
  }
  console.log(`${done[0]} ${r}`);
  return 0;
};
