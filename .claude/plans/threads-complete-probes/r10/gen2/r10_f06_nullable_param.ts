import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const bump = (l: Leaf | null): void => {
  const m = new Map<string, Leaf | null>(); m.set("k", l);
  const y = m.get("k"); if (y !== undefined) { if (y !== null) { y.x = 1; } }
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h.leaf); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
