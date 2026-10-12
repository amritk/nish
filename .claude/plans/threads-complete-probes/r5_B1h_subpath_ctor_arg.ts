import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const link = (u: Top, m: Mid): void => { u.mid = m; };
class MidHolder { mid: Mid; constructor(m: Mid) { this.mid = m; } }
interface MidRec { mid: Mid; }
const midOf = (t: Top): Mid => t.mid;
const bump = (h: Holder): void => {
  const t = new Top();
  const u = new MidHolder(t.mid);
  u.mid.leaf = h.leaf;
  t.mid.leaf.x = 1;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]}`); return 0;
};
