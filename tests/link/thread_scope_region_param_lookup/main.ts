// A function that only looks a key up in its argument's own table, between a
// scope's first `spawn` and its join: `has` and `get` read the table, so
// they write nothing the task reads, and native, where the task runs at the
// join, and Node, where it runs at the spawn, print the same.
import { scope } from "nish/threads";

class Leaf {
  x: i32 = 0;
}

class Holder {
  table: Map<string, i32>;

  constructor() {
    this.table = new Map<string, i32>();
    this.table.set("x", 1);
  }
}

const read = (h: Holder): i32 => h.table.size;

const bump = (p: Holder): i32 => {
  const n = p.table.has("x") ? 1 : 0;
  const g = p.table.get("x") ?? 0;
  const o: Leaf[] = [new Leaf()];
  o[0].x = n + g;
  return o[0].x;
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
