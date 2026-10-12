import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const bump0 = <T extends Mid>(h: Holder, d: T): void => {
  const m = new Map<string, T>(); const arr: T[] = [];
  arr.push(getOrInsert(m, "a", d));
  arr[0].leaf = h.leaf;
  getOrInsert(m, "a", d).leaf.x = 1;
};
const bump = (h: Holder): void => { bump0(h, new Mid()); };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
