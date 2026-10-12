import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
class W { mid: Mid; constructor() { this.mid = new Mid(); } me(): W { return this; } getMid(): Mid { return this.mid; } }
const bump = (h: Holder): void => {
  const w = new W(); const ws: W[] = [];
  ws.push(w.me());
  ws[0].mid.leaf = h.leaf;
  w.mid.leaf.x = 1;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
