import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const bump = (h: Holder): void => {
  const words = ["a", "b", "a", "c", "a"]; const counts = new Map<string, Leaf>(); const out: i32[] = [];
  for (const w of words) { getOrInsert(counts, w, new Leaf()).x += 1; }
  for (const w of words) { const c = counts.get(w); out.push(c === undefined ? 0 : c.x); }
  let t = 0; for (const v of out) { t += v; }
  if (t !== 11) { console.log("bad"); }
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
