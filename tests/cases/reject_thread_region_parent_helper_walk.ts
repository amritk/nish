// A walk in a helper the parent calls counts the walk into the table as one in
// the region itself does: the rule follows the call.
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

const total = (s: Set<i32>): i32 => {
  let n = 0;
  for (const k of s) {
    n = n + k;
  }
  return n;
};

export const main = (): i32 => {
  const ix = new Index();
  const out: i32[] = [0];
  let t = 0;
  {
    using s = scope();
    s.spawn(look, ix, out, 0);
    t = total(ix.seen);
  }
  console.log(`${out[0]} ${t}`);
  return 0;
};
