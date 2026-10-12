import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const put0 = (a: Top, h: Holder): void => { a.mid.leaf.x = h.leaf.x + 1; };
const put = (a: Top, h: Holder): void => { put0(a, h); };
const bump = (h: Holder): i32 => { const t = new Top(); put(t, h); t.mid.leaf.x = t.mid.leaf.x + 1; return t.mid.leaf.x; };
export const main = (): i32 => {
  const h = new Holder(); h.leaf.x = 4; const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = bump(h); }
  console.log(`${done[0]} ${r} ${h.leaf.x}`); return 0;
};
