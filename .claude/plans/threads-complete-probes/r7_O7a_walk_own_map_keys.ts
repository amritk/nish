import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder { v: i32 = 1; leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.v + h.leaf.x;

const tally = (h: Holder): i32 => { const m = new Map<string, i32>(); m.set("a", 1); m.set("bb", 2); let n = 0; for (const k of m.keys()) { n += k.length; } return n + h.v; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = tally(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
