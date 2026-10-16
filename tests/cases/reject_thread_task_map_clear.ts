// A task's `clear` on a table another task reads writes it.
import { scope } from "nish/threads";

class Leaf {
  x: i32 = 0;
}

class Index {
  counts: Map<string, i32>;
  leaves: Map<string, Leaf>;
  seen: Set<i32>;

  constructor() {
    this.counts = new Map<string, i32>();
    this.counts.set("a", 3);
    this.leaves = new Map<string, Leaf>();
    this.leaves.set("a", new Leaf());
    this.seen = new Set<i32>();
    this.seen.add(7);
  }
}

const look = (ix: Index): i32 => ix.counts.size + ix.seen.size;

const touch = (ix: Index): i32 => {
  ix.counts.clear();
  return 0;
};

export const main = (): i32 => {
  const ix = new Index();
  const out: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(look, ix, out, 0);
    s.spawn(touch, ix, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
