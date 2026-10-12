import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
class MH { m: Map<string, Mid>; constructor() { this.m = new Map<string, Mid>(); this.m.set("a", new Mid()); } }
const readM = (w: MH): i32 => { let t = 0; for (const v of w.m.values()) { t += v.leaf.x; } return t; };
const fill = (w: MH): void => { for (const v of w.m.values()) { v.leaf.x = 1; } };

export const main = (): i32 => {
  const w = new MH(); const done: i32[] = [0];
  { using s = scope(); s.spawn(readM, w, done, 0); fill(w); }
  console.log(`${done[0]}`); return 0;
};
