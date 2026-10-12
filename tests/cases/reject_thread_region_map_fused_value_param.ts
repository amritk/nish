// The same as `reject_thread_region_map_value_param` through a `has` and
// `set` pair, which the compiler fuses into one probe of the table: the value
// the fused `set` stores is a store into the map all the same.
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

const bump = (h: Holder): void => {
  const m = new Map<string, Leaf>();
  if (!m.has("a")) {
    m.set("a", h.leaf);
  }
  const l = m.get("a") ?? new Leaf();
  l.x = 9;
};

export const main = (): i32 => {
  const h = new Holder();
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    bump(h);
  }
  console.log(`${done[0]}`);
  return 0;
};
