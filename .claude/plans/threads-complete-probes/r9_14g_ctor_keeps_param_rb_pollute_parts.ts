import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
class Reg { parts: Mid[]; constructor(m: Map<string, Mid>) { this.parts = [getOrInsert(m, "a", new Mid())]; } }
const bump = (h: Holder): void => {
  const m = new Map<string, Mid>();
  const r = new Reg(m);
  const mm = new Mid(); mm.leaf = h.leaf;
  m.set("a", mm);
  r.parts[0].leaf.x = 1;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
