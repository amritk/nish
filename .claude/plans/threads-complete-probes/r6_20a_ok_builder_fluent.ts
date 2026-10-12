import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
class Product { v: i32 = 0; leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Builder { n: i32 = 0; add(k: i32): Builder { this.n = this.n + k; return this; } build(): Product { const p = new Product(); p.v = this.n; p.leaf.x = this.n * 2; return p; } }
const bump = (h: Holder): i32 => { const p = new Builder().add(h.leaf.x).add(2).add(3).build(); p.v = p.v + 1; p.leaf.x = p.leaf.x + 1; return p.v * 100 + p.leaf.x; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = bump(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
