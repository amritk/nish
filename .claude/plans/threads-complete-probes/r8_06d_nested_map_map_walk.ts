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
const bump = (h: Holder): void => { const outer = new Map<string, Map<string, Mid>>(); getOrInsert(outer, "o", new Map<string, Mid>()).set("i", new Mid()); for (const a of outer.values()) { for (const v of a.values()) { v.leaf = h.leaf; } } const im = outer.get("o"); if (im !== undefined) { const l = im.get("i"); if (l !== undefined) { l.leaf.x = 1; } } };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
