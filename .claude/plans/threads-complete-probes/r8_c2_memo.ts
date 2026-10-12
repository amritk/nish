import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
class MidBox { mid: Mid; constructor(m: Mid) { this.mid = m; } }
class TabBox { t: Map<string, Leaf>; constructor() { this.t = new Map<string, Leaf>(); } }
const read = (h: Holder): i32 => h.leaf.x;
const fibm = (n: i32, memo: Map<i32, i32>): i32 => { const c = memo.get(n); if (c !== undefined) { return c; } const r = n < 2 ? n : fibm(n - 1, memo) + fibm(n - 2, memo); memo.set(n, r); return r; };
const bump = (h: Holder): void => { const memo = new Map<i32, i32>(); if (fibm(20, memo) !== 6765) { console.log("bad"); } };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
