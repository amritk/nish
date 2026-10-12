import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
class MapBox { m: Map<string, Leaf>; constructor() { this.m = new Map<string, Leaf>(); } put(l: Leaf): void { this.m.set("k", l); } poke(): void { const l = this.m.get("k"); if (l !== undefined) { l.x = 1; } } }
const bump = (h: Holder): void => { const w = new MapBox(); w.put(h.leaf); const l = w.m.get("k"); if (l !== undefined) { l.x = 1; } };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
