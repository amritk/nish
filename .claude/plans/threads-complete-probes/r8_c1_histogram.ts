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
const bump = (h: Holder): void => { const m = new Map<i32, i32>(); const xs = [3, 1, 4, 1, 5]; for (const x of xs) { m.set(x % 3, (m.get(x % 3) ?? 0) + 1); } let t = 0; for (const v of m.values()) { t += v; } if (t !== 5) { console.log("bad"); } };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
