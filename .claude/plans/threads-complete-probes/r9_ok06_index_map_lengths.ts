import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const bump = (h: Holder): void => {
  const words = ["a", "b", "a", "c"]; const idx = new Map<string, i32[]>(); const lens: i32[] = []; let i = 0;
  for (const w of words) { getOrInsert(idx, w, new Array<i32>(0)).push(i); i += 1; }
  for (const w of words) { lens.push(getOrInsert(idx, w, new Array<i32>(0)).length); }
  getOrInsert(idx, "a", new Array<i32>(0))[0] = 9;
  if (lens[0] !== 2) { console.log("bad"); }
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
