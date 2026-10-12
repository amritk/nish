import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
class Parts { parts: Mid[]; constructor() { this.parts = []; } }
class WI { inner: Parts; constructor() { this.inner = new Parts(); } }
const bump = (h: Holder): void => {
  const w = new WI(); const m = new Map<string, Mid>();
  w.inner.parts.push(getOrInsert(m, "a", new Mid()));
  w.inner.parts[0].leaf = h.leaf;
  getOrInsert(m, "a", new Mid()).leaf.x = 1;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
