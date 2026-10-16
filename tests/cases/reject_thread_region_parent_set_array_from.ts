// `Array.from(s)` would walk the table as `for...of` does. It is not a builtin
// in this version; pinned so that adding it meets the region rule here.
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
    const a = Array.from(ix.seen);
    t = a.length;
  }
  console.log(`${out[0]} ${t}`);
  return 0;
};
