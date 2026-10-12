import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const mkLeafs = (n: i32): Leaf[] => { const xs: Leaf[] = []; for (let i = 0; i < n; i++) { const l = new Leaf(); l.x = i; xs.push(l); } return xs; };
const bump = (h: Holder): i32 => { const xs = mkLeafs(3); xs[0].x = 5; xs[2].x = xs[2].x + h.leaf.x; return xs[0].x + xs[1].x + xs[2].x; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = bump(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
