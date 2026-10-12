import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const attach = (w: Wrap, h: Holder): void => { w.leaf = h.leaf; };
const build = (h: Holder): Wrap => { const w = new Wrap(); attach(w, h); return w; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let w = new Wrap();
  { using s = scope(); s.spawn(read, h, done, 0); w = build(h); w.leaf.x = 1; }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
