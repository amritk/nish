import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const bump = (h: Holder): void => {
  const words = ["a", "b", "a"]; const counts = new Map<string, i32>(); const out: i32[] = [];
  for (const w of words) { counts.set(w, (counts.get(w) ?? 0) + 1); }
  out.push(counts.get("a") ?? 0);
  if (out[0] !== 2) { console.log("bad"); }
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
