// Two tasks of one scope read the same `Map` and `Set` at once: `get`, `has`
// and `size` read the tables and write nothing, so neither task sees the
// other, and native, where the tasks run at the join, and Node, where each
// runs at its spawn, print the same.
import { scope } from "nish/threads";

class Index {
  counts: Map<string, i32>;
  seen: Set<i32>;

  constructor() {
    this.counts = new Map<string, i32>();
    this.counts.set("a", 3);
    this.counts.set("b", 4);
    this.seen = new Set<i32>();
    this.seen.add(7);
  }
}

const lookA = (ix: Index): i32 => {
  const a = ix.counts.get("a") ?? 0;
  return a * 10 + (ix.counts.has("z") ? 1 : 0);
};

const lookB = (ix: Index): i32 => {
  const b = ix.counts.get("b") ?? 0;
  return b * 100 + ix.counts.size + (ix.seen.has(7) ? 1000 : 0) + ix.seen.size;
};

export const main = (): i32 => {
  const ix = new Index();
  const out: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(lookA, ix, out, 0);
    s.spawn(lookB, ix, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
