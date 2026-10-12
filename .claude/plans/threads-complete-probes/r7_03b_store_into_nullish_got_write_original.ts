import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const bump = (h: Holder): void => { const m = new Map<string, Mid>(); const mid = new Mid(); m.set("a", mid); (m.get("a") ?? new Mid()).leaf = h.leaf; mid.leaf.x = 1; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
