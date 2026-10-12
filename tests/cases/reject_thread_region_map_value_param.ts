// A `Map` of a function's own keeps what `set` hands it: here the argument's
// own `Leaf`, so a write through what `get` gives back is a write into memory
// the task reads. (`docs/LANGUAGE.md`, "Scoped tasks".)
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
  m.set("a", h.leaf);
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
