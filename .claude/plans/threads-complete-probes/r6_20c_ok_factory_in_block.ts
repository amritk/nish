import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const mkTop = (): Top => { const t = new Top(); t.mid.leaf.x = 2; return t; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); const t = mkTop(); t.mid.leaf.x = t.mid.leaf.x + 3; const u = mkTop(); u.mid = t.mid; u.mid.leaf.x = u.mid.leaf.x + 1; r = t.mid.leaf.x; }
  console.log(`${done[0]} ${r}`); return 0;
};
