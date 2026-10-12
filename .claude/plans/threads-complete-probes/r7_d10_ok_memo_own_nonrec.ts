import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const look = (n: i32, memo: Map<i32, i32>): i32 => { const c = memo.get(n); if (c !== undefined) { return c; } memo.set(n, n * 2); return n * 2; };
const bump = (h: Holder): i32 => { const memo = new Map<i32, i32>(); return look(h.leaf.x, memo); };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = bump(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
