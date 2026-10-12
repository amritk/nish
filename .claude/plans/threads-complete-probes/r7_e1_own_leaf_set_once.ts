import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder { v: i32 = 1; leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.v + h.leaf.x;

const f = (h: Holder): i32 => { const m = new Map<string, Leaf>(); const o = new Leaf(); m.set("a", o); return h.v; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = f(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
