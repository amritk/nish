import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
interface MP { mid: Mid; }
const bump = (h: Holder): void => {
  const m = new Map<string, Mid>();
  const mid = getOrInsert(m, "a", new Mid());
  const o: MP = { mid };
  o.mid.leaf = h.leaf;
  getOrInsert(m, "a", new Mid()).leaf.x = 1;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
