import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const mkTops = (n: i32): Top[] => { const ts: Top[] = []; for (let i = 0; i < n; i++) { ts.push(new Top()); } return ts; };
const bump = (h: Holder): i32 => { const ts = mkTops(3); for (const t of ts) { t.mid.leaf.x = 2; } ts[1].mid = new Mid(); ts[1].mid.leaf.x = 7; return ts[0].mid.leaf.x + ts[1].mid.leaf.x + ts[2].mid.leaf.x + h.leaf.x; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = bump(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
