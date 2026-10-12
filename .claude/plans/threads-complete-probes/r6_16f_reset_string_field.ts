import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
class Named { name: string = ""; leaf: Leaf; constructor() { this.leaf = new Leaf(); } set(s: string): void { this.name = s; } }
class HS { leaf: Leaf; s: string; constructor() { this.leaf = new Leaf(); this.s = "ab"; } }
const count = (h: Holder): i32 => { const c = new Named(); c.set("x"); c.leaf.x = 3; return c.leaf.x; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = count(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
