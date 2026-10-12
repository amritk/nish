import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
class MH { m: Map<string, i32>; constructor() { this.m = new Map<string, i32>(); this.m.set("a", 1); } }
const readM = (w: MH): i32 => w.m.size;
const fill = (w: MH): boolean => w.m.delete("a");

export const main = (): i32 => {
  const w = new MH(); const done: i32[] = [0];
  { using s = scope(); s.spawn(readM, w, done, 0); fill(w); }
  console.log(`${done[0]} ${w.m.size}`); return 0;
};
