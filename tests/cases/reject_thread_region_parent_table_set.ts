// A task may read a shared table, so its parent may not write it before the
// join: the `set` between the `spawn` and the end of the block is refused.
import { scope } from "nish/threads";

class Index {
  counts: Map<string, i32>;
  seen: Set<i32>;

  constructor() {
    this.counts = new Map<string, i32>();
    this.counts.set("a", 3);
    this.seen = new Set<i32>();
    this.seen.add(7);
  }
}

const look = (ix: Index): i32 => (ix.counts.get("a") ?? 0) + ix.seen.size;

export const main = (): i32 => {
  const ix = new Index();
  const out: i32[] = [0];
  let t = 0;
  {
    using s = scope();
    s.spawn(look, ix, out, 0);
    ix.counts.set("b", 4);
  }
  console.log(`${out[0]} ${t}`);
  return 0;
};
