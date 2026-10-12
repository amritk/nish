import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const gather = (a: Mid[], m: Map<string, Mid>): void => { for (const v of m.values()) { a.push(v); } };
const bump = (h: Holder): void => {
  const m = new Map<string, Mid>(); m.set("a", new Mid()); const arr: Mid[] = [];
  gather(arr, m);
  getOrInsert(m, "a", new Mid()).leaf = h.leaf;
  arr[0].leaf.x = 1;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
