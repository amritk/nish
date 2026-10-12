import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const swap = (a: Top, b: Top): void => { const m = a.mid; a.mid = b.mid; b.mid = m; };
const bump = (h: Holder): void => { const t = new Top(); const u = new Top(); swap(u, t); const v = new Top(); v.mid = t.mid; u.mid.leaf = h.leaf; t.mid.leaf.x = 1; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
